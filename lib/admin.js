'use strict';
/**
 * 운영자 · 전체 공지
 *
 *  - 최고 운영자: 서버 환경 변수 ADMIN_KEY 를 아는 사람이 [내 정보 → 설정 → 운영자 인증]에 그 값을 넣으면 돼요.
 *    (Render: Environment → ADMIN_KEY 추가. 값은 남이 짐작하지 못하게 길게)
 *  - 운영자: 최고 운영자가 지정하거나 해제해요. 운영자는 전체 공지 · 서버 현황 · 활동 기록을 쓸 수 있어요.
 *  - 전체 공지: 일반 · 업데이트 예고(카운트다운) · 긴급. 접속한 모두에게 바로 보이고, 나중에 들어온 사람에게도 보여요.
 *    게임 중인 사람에게는 화면을 가리지 않게 위쪽 띠로만 보여 줘요 (화면 쪽: public/js/admin.js).
 *  - 공지 · 활동 기록은 계정 저장소의 '__sys' 문서에 저장돼요 (서버를 다시 켜도 그대로).
 */
const crypto = require('crypto');

const KEY = String(process.env.ADMIN_KEY || '').trim();
const KINDS = new Set(['info', 'patch', 'urgent']);
const DURS = new Set([0, 10, 60, 1440]);            // 일반 · 긴급 공지를 보여 줄 시간(분) · 0 = 내릴 때까지
const KEEP_HIST = 20, KEEP_LOG = 100;
const hash = t => crypto.createHash('sha256').update(String(t)).digest();
/** 글자 정리: 줄바꿈(본문)만 남기고 제어 문자 · 반쪽 이모지는 빼요 */
const clean = (s, n, lines) => {
  let t = String(s ?? '').replace(/\p{Cs}/gu, '').replace(/\r\n?/g, '\n');
  t = lines ? t.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n') : t.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ');
  return [...t.trim()].slice(0, n).join('').trim();
};
const ROLE_NAME = { owner: '최고 운영자', admin: '운영자' };

module.exports = function makeAdmin({ io, rooms, acc, limiter }) {
  const A = acc._int;                                // 계정 쪽 도구 (users · online · pub · meView · save · emitUser)
  let sys = { id: '__sys', sys: 1, notice: null, hist: [], logs: [] };
  let seq = 0;
  const lim = {
    claim: limiter(5, 600000), claimIp: limiter(10, 600000), claimAll: limiter(40, 3600000),   // 운영자 인증: 마구 넣어 맞히기 방지
    notice: limiter(1, 8000), act: limiter(30, 10000),
  };
  const saveSys = () => A.saveSys(sys);
  const isOp = u => !!u && (u.role === 'owner' || u.role === 'admin');

  A.onReady(doc => {
    if (doc && typeof doc === 'object') {
      sys.notice = doc.notice && typeof doc.notice === 'object' && KINDS.has(doc.notice.kind) ? doc.notice : null;
      sys.hist = Array.isArray(doc.hist) ? doc.hist.slice(0, KEEP_HIST) : [];
      sys.logs = Array.isArray(doc.logs) ? doc.logs.slice(0, KEEP_LOG) : [];
    }
    // 업데이트 예고 시각이 지나서 서버가 다시 켜졌으면 = 업데이트가 끝난 것 → 예고는 내려요
    if (sys.notice && sys.notice.kind === 'patch' && sys.notice.eta && Date.now() > sys.notice.eta) { endNotice(null, true); }
    else if (sys.notice && !live(sys.notice)) endNotice(null, true);
  });

  const live = n => !!n && (!n.until || Date.now() < n.until);
  /** 화면에 보낼 공지 (시각은 '지금부터 몇 ms' 로 → 기기 시계가 틀려도 맞아요) */
  const view = n => n && live(n) ? { id: n.id, kind: n.kind, title: n.title, body: n.body, by: n.by && n.by.name, ago: Date.now() - n.at,
    left: n.until ? n.until - Date.now() : 0, eta: n.eta ? n.eta - Date.now() : 0 } : null;
  function log(u, a, x) {
    sys.logs.unshift({ t: Date.now(), by: u ? u.name : '서버', uid: u ? u.id : '', a, x: clean(x, 120) });
    if (sys.logs.length > KEEP_LOG) sys.logs.length = KEEP_LOG;
  }
  function endNotice(u, quiet) {
    const n = sys.notice;
    if (!n) return false;
    sys.notice = null;
    const h = sys.hist.find(x => x.id === n.id);
    if (h) h.ended = Date.now();
    if (u) log(u, 'end', n.title);
    saveSys();
    if (!quiet) io.emit('notice:end', { id: n.id });
    return true;
  }
  // 보여 줄 시간이 끝난 공지는 내려요
  setInterval(() => { if (sys.notice && !live(sys.notice)) endNotice(null); }, 15000).unref();

  /** 운영자 목록 · 현황 · 기록 (운영자 화면) */
  function stateFor(u) {
    const ops = [...A.users.values()].filter(isOp)
      .sort((a, b) => (a.role === b.role ? a.created - b.created : a.role === 'owner' ? -1 : 1))
      .map(x => ({ ...A.pub(x), role: x.role, on: A.online.has(x.id), seen: x.seen, me: x.id === u.id }));
    let playing = 0;
    for (const r of rooms.values()) if (r.isStarted) playing++;
    return {
      ok: true, role: u.role, hasKey: !!KEY, notice: view(sys.notice),
      hist: sys.hist.slice(0, 10).map(h => ({ id: h.id, kind: h.kind, title: h.title, at: h.at, by: h.by && h.by.name, ended: h.ended || 0, live: !!sys.notice && sys.notice.id === h.id })),
      ops, logs: sys.logs.slice(0, 50),
      stats: { sockets: io.engine.clientsCount, online: A.online.size, users: A.users.size, rooms: rooms.size, playing, up: Math.round(process.uptime()) },
    };
  }
  /** 역할이 바뀐 사람에게 알려요 (내 정보 · 방 안의 내 자리 표시) */
  function roleChanged(t, msg) {
    A.save(t);
    A.emitUser(t.id, 'acct:me', A.meView(t));
    A.emitUser(t.id, 'admin:role', { role: t.role, msg });
    A.syncAll(t.id);
  }

  function attach(socket, on) {
    const reply = (cb, d) => { if (typeof cb === 'function') cb(d); };
    const ip = () => A.ipOf(socket);
    /** 로그인한 계정 (+ 운영자/최고 운영자 확인) */
    const who = (cb, need) => {
      if (!A.ready()) { reply(cb, { ok: false, why: 'loading' }); return null; }
      const u = socket.data.uid && A.users.get(socket.data.uid);
      if (!u) { reply(cb, { ok: false, why: 'login' }); return null; }
      if (!lim.act(socket.id)) { reply(cb, { ok: false, why: 'limit' }); return null; }
      if (need === 'op' && !isOp(u)) { reply(cb, { ok: false, why: 'noperm' }); return null; }
      if (need === 'owner' && u.role !== 'owner') { reply(cb, { ok: false, why: 'noperm' }); return null; }
      return u;
    };

    const n0 = view(sys.notice);
    if (n0) socket.emit('notice', n0);                 // 지금 걸린 공지는 들어오자마자
    on('notice:get', (_, cb) => reply(cb, { ok: true, n: view(sys.notice) }));

    /** 최고 운영자 인증 (ADMIN_KEY) */
    on('admin:claim', (d, cb) => {
      const u = who(cb); if (!u) return;
      if (!KEY) return reply(cb, { ok: false, why: 'nokey' });
      if (u.role === 'owner') return reply(cb, { ok: true, role: u.role });
      if (!lim.claim(u.id) || !lim.claimIp(ip()) || !lim.claimAll('all')) return reply(cb, { ok: false, why: 'limit' });
      const k = String((d && d.key) || '').trim().slice(0, 200);
      if (!k || !crypto.timingSafeEqual(hash(k), hash(KEY))) {
        log(u, 'claim-fail', '운영자 인증 실패');
        saveSys();
        return reply(cb, { ok: false, why: 'key' });
      }
      u.role = 'owner';
      log(u, 'claim', '최고 운영자 인증');
      saveSys();
      roleChanged(u, '최고 운영자가 됐어요.');
      reply(cb, { ok: true, role: u.role });
    });
    /** 운영자 그만두기 (나 스스로) */
    on('admin:resign', (_, cb) => {
      const u = who(cb, 'op'); if (!u) return;
      const was = u.role;
      u.role = '';
      log(u, 'resign', `${ROLE_NAME[was]} 그만둠`);
      saveSys();
      roleChanged(u, '운영자를 그만뒀어요.');
      reply(cb, { ok: true });
    });
    on('admin:state', (_, cb) => {
      const u = who(cb, 'op'); if (!u) return;
      reply(cb, stateFor(u));
    });
    /** 운영자로 지정할 회원 찾기 (이름 일부로) */
    on('admin:find', (d, cb) => {
      const u = who(cb, 'owner'); if (!u) return;
      const q = clean(d && d.q, 10).toLowerCase();
      if (!q) return reply(cb, { ok: true, list: [] });
      const list = [...A.users.values()].filter(x => x.name.toLowerCase().includes(q))
        .sort((a, b) => (A.online.has(b.id) - A.online.has(a.id)) || b.seen - a.seen).slice(0, 20)
        .map(x => ({ ...A.pub(x), role: x.role || '', on: A.online.has(x.id), seen: x.seen, created: x.created, plays: x.plays + x.sp }));
      reply(cb, { ok: true, list });
    });
    on('admin:grant', (d, cb) => {
      const u = who(cb, 'owner'); if (!u) return;
      const t = d && typeof d.uid === 'string' && A.users.get(d.uid);
      if (!t) return reply(cb, { ok: false, why: 'nouser' });
      if (t.role) return reply(cb, { ok: false, why: 'already' });
      if ([...A.users.values()].filter(isOp).length >= 30) return reply(cb, { ok: false, why: 'opmax' });
      t.role = 'admin';
      log(u, 'grant', `${t.name} 님을 운영자로 지정`);
      saveSys();
      roleChanged(t, `${u.name} 님이 나를 운영자로 지정했어요.`);
      reply(cb, { ok: true, u: { ...A.pub(t), role: t.role } });
    });
    on('admin:revoke', (d, cb) => {
      const u = who(cb, 'owner'); if (!u) return;
      const t = d && typeof d.uid === 'string' && A.users.get(d.uid);
      if (!t) return reply(cb, { ok: false, why: 'nouser' });
      if (t.role !== 'admin') return reply(cb, { ok: false, why: t.role === 'owner' ? 'owner' : 'notop' });
      t.role = '';
      log(u, 'revoke', `${t.name} 님 운영자 해제`);
      saveSys();
      roleChanged(t, '운영자에서 해제됐어요.');
      reply(cb, { ok: true });
    });

    /** 전체 공지 보내기 */
    on('admin:notice', (d, cb) => {
      const u = who(cb, 'op'); if (!u || !d) return;
      const kind = KINDS.has(d.kind) ? d.kind : 'info';
      const title = clean(d.title, 40), body = clean(d.body, 400, true);
      if (!title) return reply(cb, { ok: false, why: 'title' });
      const min = Math.round(Number(d.min)), dur = Number(d.dur) || 0;
      if (kind === 'patch' && !(min >= 1 && min <= 120)) return reply(cb, { ok: false, why: 'min' });
      if (kind !== 'patch' && !DURS.has(dur)) return reply(cb, { ok: false, why: 'dur' });
      if (!lim.notice(u.id)) return reply(cb, { ok: false, why: 'limit' });   // 제대로 된 공지만 횟수에 넣어요
      const now = Date.now();
      const n = { id: 'n' + now.toString(36) + (++seq), kind, title, body, at: now, by: { id: u.id, name: u.name }, until: 0, eta: 0 };
      if (kind === 'patch') {
        n.eta = now + min * 60000;
        n.until = n.eta + 15 * 60000;                   // 업데이트가 늦어져도 15분 뒤에는 저절로 내려가요
      } else if (dur) n.until = now + dur * 60000;
      if (sys.notice) { const h = sys.hist.find(x => x.id === sys.notice.id); if (h) h.ended = now; }   // 새 공지가 지난 공지를 대신해요
      sys.notice = n;
      sys.hist.unshift({ id: n.id, kind, title, at: now, by: n.by, ended: 0 });
      if (sys.hist.length > KEEP_HIST) sys.hist.length = KEEP_HIST;
      log(u, 'notice', `[${{ info: '공지', patch: '업데이트 예고', urgent: '긴급' }[kind]}] ${title}`);
      saveSys();
      io.emit('notice', view(n));
      reply(cb, { ok: true, n: view(n) });
    });
    on('admin:end', (_, cb) => {
      const u = who(cb, 'op'); if (!u) return;
      if (!endNotice(u)) return reply(cb, { ok: false, why: 'nonotice' });
      reply(cb, { ok: true });
    });
  }

  return { attach, isOp, hasKey: !!KEY, _test: { sys: () => sys } };
};
