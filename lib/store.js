'use strict';
/**
 * 계정 저장소
 *  - 환경 변수 DATABASE_URL 이 있으면 PostgreSQL (Neon · Supabase 같은 무료 DB) 에 저장 → 서버를 다시 켜도 그대로예요.
 *  - 없으면 userdata/accounts.json 파일에 저장 (내 컴퓨터에서 켤 때). DATA_DIR 로 폴더를 바꿀 수 있어요.
 * 계정은 모두 서버 메모리에 올려 두고, 바뀐 계정만 모아서 잠시 뒤에 한꺼번에 저장해요.
 */
const fs = require('fs');
const path = require('path');

const TABLE = 'mg_users';
/** JSON 으로 바꾸면서 반쪽 이모지(짝 없는 서러게이트)를 빼요 — PostgreSQL jsonb 가 거절하지 않게 */
const toJSON = v => JSON.stringify(v, (k, x) => (typeof x === 'string' ? x.replace(/\p{Cs}/gu, '') : x));
/** 다시 시도해도 안 되는 DB 오류 (잘못된 글자 등) */
const FATAL = new Set(['22P02', '22P05', '22021', '54000']);

/** 파일 저장소: 전체를 임시 파일에 쓴 뒤 이름을 바꿔서, 쓰는 도중 꺼져도 파일이 깨지지 않게 */
function fileStore(dir) {
  const file = path.join(dir, 'accounts.json');
  const docs = new Map();
  let timer = null, dirty = false;
  const writeNow = () => {
    clearTimeout(timer); timer = null;
    if (!dirty) return;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, toJSON({ v: 1, users: [...docs.values()] }));
      fs.renameSync(tmp, file);
      dirty = false;
    } catch (e) {                                       // 백신 · 색인 프로그램이 잠깐 파일을 잡고 있을 수 있어요 → 잠시 뒤 다시
      console.error('⚠️  계정 파일 저장 실패 (5초 뒤 다시 시도):', e.message);
      timer = setTimeout(writeNow, 5000);
    }
  };
  return {
    kind: 'file', where: file,
    async load() {
      let raw = null;
      try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (raw) {
        try {
          const d = JSON.parse(raw);
          for (const u of d.users || []) if (u && u.id) docs.set(u.id, u);
        } catch (e) {                                   // 파일이 깨졌으면 옆에 남겨 두고 새로 시작
          const bad = file + '.broken-' + Date.now();
          try { fs.renameSync(file, bad); } catch { /* 무시 */ }
          console.error(`⚠️  계정 파일을 읽을 수 없어서 ${bad} 로 옮겨 두고 새로 시작해요:`, e.message);
        }
      }
      return [...docs.values()];
    },
    put(doc) { docs.set(doc.id, doc); dirty = true; if (!timer) timer = setTimeout(writeNow, 800); },
    del(id) { docs.delete(id); dirty = true; if (!timer) timer = setTimeout(writeNow, 300); },
    async flush() { writeNow(); },
    flushSync() { writeNow(); },
  };
}

/** Neon 등에서 복사한 주소를 그대로 넣어도 되게 정리 (sslmode=require → 인증서 확인 없이 암호화) */
function tidyUrl(url) {
  try {
    const u = new URL(url);
    const mode = u.searchParams.get('sslmode');
    if (['require', 'prefer', 'verify-ca'].includes(mode)) u.searchParams.set('sslmode', 'no-verify');
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch { return url; }
}

/** PostgreSQL 저장소: 계정 하나 = 한 줄 (id, data jsonb) */
function pgStore(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: tidyUrl(url), max: 3, idleTimeoutMillis: 20000, connectionTimeoutMillis: 15000 });
  pool.on('error', e => console.error('⚠️  DB 연결 오류 (자동으로 다시 연결해요):', e.message));
  const dirty = new Map();                 // id → 문서(또는 null = 지우기)
  let timer = null, busy = null;
  const run = async () => {
    timer = null;
    if (busy) { await busy; return run(); }
    const batch = [...dirty.entries()];
    dirty.clear();
    if (!batch.length) return;
    busy = (async () => {
      const failed = [];
      for (const [id, doc] of batch) {
        try {
          if (doc) await pool.query(`insert into ${TABLE} (id, data, updated_at) values ($1, $2, now())
            on conflict (id) do update set data = excluded.data, updated_at = now()`, [id, toJSON(doc)]);
          else await pool.query(`delete from ${TABLE} where id = $1`, [id]);
        } catch (e) {
          if (FATAL.has(e.code)) { console.error(`⚠️  계정 ${id} 저장 실패 (다시 시도하지 않아요):`, e.message); continue; }
          failed.push([id, doc]); console.error('⚠️  계정 저장 실패 (잠시 뒤 다시 시도):', e.message);
        }
      }
      for (const [id, doc] of failed) if (!dirty.has(id)) dirty.set(id, doc);
      if (failed.length && !timer) timer = setTimeout(run, 10000);
    })();
    try { await busy; } finally { busy = null; }
  };
  const later = ms => { if (!timer) timer = setTimeout(run, ms); };
  return {
    kind: 'db', where: (() => { try { return new URL(url).hostname; } catch { return 'database'; } })(),
    async load() {
      await pool.query(`create table if not exists ${TABLE} (id text primary key, data jsonb not null, updated_at timestamptz not null default now())`);
      const r = await pool.query(`select data from ${TABLE}`);
      return r.rows.map(x => x.data).filter(d => d && d.id);
    },
    put(doc) { dirty.set(doc.id, doc); later(1000); },
    del(id) { dirty.set(id, null); later(200); },
    async flush() { clearTimeout(timer); timer = null; await run(); },
    flushSync() { /* DB는 비동기라 flush() 를 기다려야 해요 */ },
    /** 계정 하나를 DB에서 다시 읽기 (새 버전으로 갈아탈 때 옛 서버가 그사이 저장한 기록을 받으려고) */
    async getOne(id) {
      const r = await pool.query(`select data from ${TABLE} where id = $1`, [id]);
      return r.rows[0] ? r.rows[0].data : null;
    },
    /** 로그인 표(토큰 해시)로 계정 찾기 — 옛 서버에서 그사이 로그인한 사람 */
    async findByToken(h) {
      const r = await pool.query(`select data from ${TABLE} where data->'tokens' @> $1::jsonb limit 1`, [JSON.stringify([{ h }])]);
      return r.rows[0] ? r.rows[0].data : null;
    },
    end: () => pool.end(),
  };
}

function openStore() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (url) return pgStore(url);
  return fileStore(path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'userdata')));
}

module.exports = { openStore, fileStore, pgStore, tidyUrl };
