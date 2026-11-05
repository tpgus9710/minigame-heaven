'use strict';
/**
 * 계정 · 게임 기록 · 레벨 · 친구 · 방 초대 · 랭킹 (얼굴 로그인)
 *
 *  얼굴 인식은 영천GO 키오스크와 같은 방식이에요.
 *   - 브라우저가 InsightFace 모델로 얼굴 특징값(숫자 512개)을 만들어 보내요. 사진은 받지도 저장하지도 않아요.
 *   - 가입: 여러 장면의 특징값 평균만 저장. 이미 가입된 얼굴(유사도 0.45 이상)이면 다시 가입할 수 없어요.
 *   - 로그인: 가장 닮은 회원이 유사도 0.45 이상이고, 두 번째로 닮은 회원보다 0.08 이상 앞설 때만 인정해요.
 *   - 탈퇴하면 특징값과 기록이 바로 지워져요.
 *
 *  저장: lib/store.js (DATABASE_URL 이 있으면 PostgreSQL, 없으면 userdata/accounts.json)
 */
const crypto = require('crypto');
const { openStore } = require('./store');
const D = require('./daily');                      // 출석 체크 · 오늘의 미션
const Titles = require('../public/js/shared/titles');   // 레벨 테두리 · 칭호 (화면과 같이 써요)

const DIM = 512;
// 영천GO 규칙: 가장 닮은 회원이 0.45 이상 + 두 번째보다 0.08 이상 앞서야 인정 (환경 변수로 더 엄격하게 바꿀 수 있어요)
const MATCH = Number(process.env.FACE_MATCH) || 0.45, MARGIN = Number(process.env.FACE_MARGIN) || 0.08;
const MAX_USERS = Number(process.env.MAX_ACCOUNTS) || 5000;
// 친구 접속 알림: 이만큼 안 보이다 들어오면 알려요 · 서버를 켠 직후 다시 연결되는 사람은 빼요 (검사할 때 환경 변수로 줄일 수 있어요)
const ONLINE_AWAY = process.env.ACCT_ONLINE_AWAY_MS !== undefined ? Number(process.env.ACCT_ONLINE_AWAY_MS) : 60000;
const BOOT_GRACE = process.env.ACCT_BOOT_GRACE_MS !== undefined ? Number(process.env.ACCT_BOOT_GRACE_MS) : 120000;
const MIN_GAME_MS = process.env.ACCT_MIN_GAME_MS !== undefined ? Number(process.env.ACCT_MIN_GAME_MS) : 15000;   // 이보다 짧은 판은 경험치 없음
const AV_COUNT = 24, COLOR_COUNT = 8;           // 아바타 이모지 · 색 개수 (public/js/account.js 와 같아야 해요)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// 싱글 게임 (public/js/core.js 의 SOLO_GAMES). 새 싱글 게임을 만들면 여기에도 넣어야 기록돼요.
const SOLO_KEYS = new Set(['sudoku', 'nonogram', 'chess', 'gostop', 'kart', 'dalmuti', 'coup', 'bang', 'rummi', 'shisen', 'reversi', 'davinci', 'liardice', 'blackjack', 'yacht', 'yut',
  'thief', 'life', 'marble', 'breakout', 'dodge', 'plat', 'zombie', 'volley', 'bomb', 'tank', 'shooter', 'gem', 'fruit', 'stack', 'mole',
  'mine', 'g2048', 'snake', 'rain', 'tetris', 'apple', 'omok', 'pong', 'race']);
const LOW_BETTER = new Set(['race', 'mine', 'sudoku', 'nonogram']);     // 기록이 작을수록 좋은 게임 (시간)

const own = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const lvOf = xp => Math.min(99, Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1);
const xpAt = lv => 25 * (lv - 1) * (lv - 1);
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
/** 글자(코드 포인트) 단위로 자르고 반쪽 이모지(짝 없는 서러게이트)는 빼요 — DB(jsonb)가 거절하지 않게 */
const cut = (s, n) => [...String(s ?? '').replace(/\p{Cs}/gu, '')].slice(0, n).join('');
const cleanName = n => cut(String(n ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim(), 10).trim();
/** 운영자를 흉내 내는 이름 (운영자 · 관리자 · admin …) — 진짜 운영자가 아니면 쓸 수 없어요 */
const RESERVED = /운\s*영\s*(자|진|팀)|관\s*리\s*자|어\s*드\s*민|admin|\bgm\b|staff/i;

/** 짧은 시간 동안 횟수 제한 */
function limiter(max, ms, cap = 20000) {
  const m = new Map();
  const sweep = () => { const now = Date.now(); for (const [k, a] of m) if (now - a.t > ms) m.delete(k); };
  setInterval(sweep, Math.max(ms, 60000)).unref();
  return key => {
    const now = Date.now();
    let a = m.get(key);
    if (!a || now - a.t > ms) {
      if (!a && m.size >= cap) { sweep(); if (m.size >= cap) return false; }      // 표가 가득 차면 새 키는 거절 (메모리 보호)
      a = { t: now, n: 0 }; m.set(key, a);
    }
    return ++a.n <= max;
  };
}

function toB64(v) { return Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64'); }
function fromB64(s) {
  const b = Buffer.from(String(s || ''), 'base64');
  if (b.length !== DIM * 4) return null;
  const f = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  return f.every(Number.isFinite) ? f : null;
}
/** 브라우저가 보낸 특징값 검사 → 길이 1로 맞춘 Float32Array (이상하면 null) */
function parseEmb(e) {
  if (!Array.isArray(e) || e.length !== DIM) return null;
  const v = new Float32Array(DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) {
    const x = Number(e[i]);
    if (!Number.isFinite(x) || Math.abs(x) > 1) return null;
    v[i] = x; n += x * x;
  }
  n = Math.sqrt(n);
  if (n < 0.5 || n > 1.5) return null;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < DIM; i++) s += a[i] * b[i]; return s; };

/** 칭호용 숫자 (연승 · 최고 기록 깬 횟수 · 미션 · 친구와 한 판 · 귓속말 …) */
function normStats(v) {
  const o = v && typeof v === 'object' ? v : {}, k = x => Math.max(0, Math.min(1e9, Math.floor(+x || 0)));
  return { best: k(o.best), ws: k(o.ws), wsMax: k(o.wsMax), stMax: k(o.stMax), ac: k(o.ac), acCur: k(o.acCur), acRow: k(o.acRow),
    acDay: typeof o.acDay === 'string' && /^\d{4}-\d\d-\d\d$/.test(o.acDay) ? o.acDay : '', fg: k(o.fg), dm: k(o.dm), big: k(o.big) };
}
/** 받은 칭호 { id: 받은 시각 } (모르는 칭호는 버려요) */
function normTtl(v) {
  const out = {};
  if (v && typeof v === 'object') for (const [id, t] of Object.entries(v)) if (Titles.byId[id] && +t > 0) out[id] = +t;
  return out;
}

/** 저장돼 있던 문서를 지금 모양으로 (빠진 칸 채우기) */
function normalize(u) {
  const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const ttl = normTtl(u.ttl);
  return {
    id: String(u.id), name: cleanName(u.name) || '게이머', av: Number.isInteger(u.av) ? u.av : -1, color: Number.isInteger(u.color) ? u.color : 0,
    code: String(u.code || ''), created: +u.created || Date.now(), seen: +u.seen || Date.now(),
    face: u.face && u.face.v ? { v: String(u.face.v), n: +u.face.n || 0, at: +u.face.at || 0 } : null,
    xp: Math.max(0, +u.xp || 0), plays: +u.plays || 0, wins: +u.wins || 0, sp: +u.sp || 0,
    multi: obj(u.multi), solo: obj(u.solo), recent: Array.isArray(u.recent) ? u.recent.slice(0, 30) : [],
    friends: arr(u.friends), reqIn: arr(u.reqIn), reqOut: arr(u.reqOut),
    tokens: Array.isArray(u.tokens) ? u.tokens.filter(t => t && typeof t.h === 'string').slice(-8) : [],
    hide: !!u.hide,                                    // true = '지금 접속 중' 목록에 안 보이기
    role: u.role === 'owner' || u.role === 'admin' ? u.role : '',   // 운영자 (lib/admin.js)
    daily: D.normalize(u.daily),                       // 오늘의 미션 · 연속 출석
    st: normStats(u.st), ttl,                          // 칭호용 숫자 · 받은 칭호
    tt: typeof u.tt === 'string' && ttl[u.tt] ? u.tt : '',                         // 단 칭호 ('' = 없음)
    fr: Number.isInteger(u.fr) && u.fr >= 0 && u.fr <= 9 ? u.fr : -1,               // 고른 테두리 (-1 = 레벨에 맞춰 자동)
    ttlSeen: +u.ttlSeen || 0,                          // 이 시각까지 받은 칭호는 축하 화면을 봤어요
  };
}
/** 칭호 조건에 쓰는 통계 (public/js/shared/titles.js 의 v(s) 가 읽어요) */
function statsOf(u) {
  let sw = 0;
  const kinds = new Set(Object.keys(u.multi)), gw = { gostop: 0, chess: 0, omok: 0 };
  for (const [k, st] of Object.entries(u.multi)) if (k in gw) gw[k] += st.w || 0;
  for (const [k, st] of Object.entries(u.solo)) {
    const base = k.split(':')[0];
    kinds.add(base); sw += st.w || 0;
    if (base in gw) gw[base] += st.w || 0;
  }
  return { games: u.plays + u.sp, mw: u.wins, sw, best: u.st.best, ws: u.st.ws, wsMax: u.st.wsMax, stMax: Math.max(u.st.stMax, u.daily.streak || 0),
    ac: u.st.ac, acRow: u.st.acRow, kinds: kinds.size, friends: u.friends.length, fg: u.st.fg, dm: u.st.dm, big: u.st.big,
    lv: lvOf(u.xp), created: u.created, g: gw };
}

module.exports = function makeAccounts({ io, rooms, H, registry, ipOf, cloud }) {
  let store = null, state = 'loading', sysDoc = null;
  const sysDocs = new Map();          // '__' 로 시작하는 운영용 문서 ('__sys' 공지 · 기록, '__rep' 신고함)
  const readyFns = [];               // 계정을 다 불러온 뒤 부를 함수 (lib/admin.js)
  const users = new Map();          // id → 문서
  const faces = new Map();          // id → Float32Array(512)
  const byToken = new Map();        // sha256(토큰) → id
  const byCode = new Map();         // 친구 코드 → id
  const online = new Map();         // id → Set(socket)
  const BOOT = Date.now();
  const linkCodes = new Map();      // 기기 연결 코드(8글자) → { id, exp }
  const soloXpAt = new Map();       // id → 마지막으로 싱글 경험치를 받은 시각 (짧은 판 반복으로 경험치 모으기 방지)
  // 귓속말: 서버 메모리에만 잠깐 보관해요 (DB에 저장하지 않아서, 서버가 다시 켜지면 사라져요)
  const convos = new Map();         // '아이디|아이디' → [{ id, f: 보낸 사람, x: 내용, t: 시각, q: 조용히 전달 }]
  const unreadDM = new Map();       // 받는 사람 id → Map(보낸 사람 id → 안 읽은 개수)
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  let dmSeq = 0;
  const dmTotal = id => { let n = 0; for (const v of (unreadDM.get(id) || new Map()).values()) n += v; return n; };
  const dmOf = (me, from) => (unreadDM.get(me) || new Map()).get(from) || 0;
  const DM_MAX_CONVOS = 2000, DM_KEEP = 40, DM_TTL = 24 * 3600000;   // 대화 2000개 · 대화마다 최근 40개 · 하루 지나면 지워요
  function dmForget(a, b) {          // 친구를 끊거나 탈퇴하면 · 오래되면 대화도 지워요 (안 읽은 개수도 같이)
    convos.delete(pairKey(a, b));
    if (unreadDM.has(a)) unreadDM.get(a).delete(b);
    if (unreadDM.has(b)) unreadDM.get(b).delete(a);
  }
  const dmDrop = key => { const [a, b] = key.split('|'); dmForget(a, b); };
  setInterval(() => {
    const old = Date.now() - DM_TTL;
    for (const [k, c] of convos) if (!c.length || c[c.length - 1].t < old) dmDrop(k);
  }, 600000).unref();
  // 기기 연결 코드: 서버 전체로 10분에 200번 틀리면 그 10분 동안은 맞는 코드도 받지 않아요 (여러 곳에서 마구 넣어 맞히기 방지)
  let codeFails = { t: 0, n: 0 };
  const codeLocked = () => { const now = Date.now(); if (now - codeFails.t > 600000) codeFails = { t: now, n: 0 }; return codeFails.n >= 200; };
  setInterval(() => { const now = Date.now(); for (const [c, l] of linkCodes) if (l.exp < now) linkCodes.delete(c); }, 600000).unref();

  const lim = {
    face: limiter(20, 60000), faceIp: limiter(300, 600000),             // 학교처럼 여러 명이 같은 인터넷(IP)을 써도 넉넉하게
    join: limiter(30, 600000), code: limiter(6, 60000), codeIp: limiter(20, 600000),
    // IP는 브라우저가 보낸 머리글로 속일 수 있어서, 서버 전체 한도도 함께 둬요
    joinAll: limiter(60, 3600000),
    act: limiter(60, 10000), invite: limiter(20, 60000), pair: limiter(1, 6000), solo: limiter(1, 2000),
    dm: limiter(8, 10000),                                              // 귓속말: 10초에 8개까지
  };

  /* ───────── 기본 도구 ───────── */
  /** 꾸미기: 고른 테두리(fr, 자동이면 빼요) · 단 칭호(tt) */
  const look = u => ({ ...(u.fr >= 0 ? { fr: u.fr } : {}), ...(u.tt ? { tt: u.tt } : {}) });
  const pub = u => ({ id: u.id, name: u.name, av: u.av, color: u.color, lv: lvOf(u.xp), ...(u.role ? { op: u.role } : {}), ...look(u) });
  const meView = u => {
    const lv = lvOf(u.xp);
    return { ...pub(u), code: u.code, xp: u.xp, cur: xpAt(lv), next: xpAt(lv + 1), plays: u.plays, wins: u.wins, sp: u.sp, reqs: u.reqIn.length, face: !!u.face, created: u.created, hide: !!u.hide, dm: dmTotal(u.id), daily: D.view(u), role: u.role || '',
      st: statsOf(u), ttl: u.ttl, ttlSeen: u.ttlSeen, frSel: u.fr };
  };
  /** 방 안의 자리에 계정 모습을 붙여요 (레벨 · 아바타 · 운영자 · 테두리 · 칭호) */
  const applyLook = (p, u) => { p.lv = lvOf(u.xp); p.av = u.av; p.color = u.color; p.op = u.role || ''; p.fr = u.fr; p.tt = u.tt || ''; };
  const save = u => { if (store) store.put(u); };
  const newCode = () => { let c; do { c = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (byCode.has(c)); return c; };
  const status = () => ({ state, kind: store ? store.kind : null, users: users.size, online: online.size });   // 오류 내용은 서버 기록(로그)에만
  const persistInfo = () => ({ kind: store ? store.kind : null, cloud: !!cloud, ready: state === 'ready' });

  function addXp(u, n) {
    const before = lvOf(u.xp);
    u.xp += Math.max(0, Math.round(n));
    const after = lvOf(u.xp);
    if (Titles.tierOf(after) > Titles.tierOf(before)) feat(u, { kind: 'tier', tier: Titles.tierOf(after), lv: after });   // 새 테두리 → 친구들에게
    return after > before;
  }
  /** 접속 중인 친구들에게 자랑 (새 테두리 · 영웅 이상 칭호) */
  function feat(u, d) { for (const fid of u.friends) emitUser(fid, 'fr:feat', { u: pub(u), ...d }); }
  /** 조건을 채운 칭호를 줘요 → 새로 받은 칭호 id 목록. 축하 화면은 화면이 ttl(받은 시각) > ttlSeen 으로 알아서 띄워요 */
  function award(u, quiet) {
    const now = Date.now(), got = [];
    for (const id of Titles.earned(statsOf(u))) if (!own(u.ttl, id)) { u.ttl[id] = now; got.push(id); }
    if (got.length && !quiet) {
      const top = got.map(id => Titles.byId[id]).filter(t => t.r >= 3).sort((a, b) => b.r - a.r)[0];
      if (top) feat(u, { kind: 'title', id: top.id });
    }
    return got;
  }
  /** 오늘 처음이면 출석 경험치 (알림은 조금 뒤에: 화면이 로그인을 마친 다음) */
  function checkin(u) {
    const ci = D.ensure(u);
    if (!ci) return null;
    u.st.stMax = Math.max(u.st.stMax, ci.streak);
    const up = addXp(u, ci.xp);
    award(u);
    save(u);
    return { ...ci, up, lv: lvOf(u.xp) };
  }
  /** 미션 진행 → 끝낸 미션이 있으면 경험치 · 알림 */
  function dailyTrack(u, e) {
    const ci = checkin(u);                               // 접속한 채로 하루가 바뀌었으면 새 미션부터
    if (ci) emitUser(u.id, 'acct:daily', { checkin: ci, view: D.view(u) });
    const r = D.track(u, e);
    if (!r.xp) return;
    if (r.bonus) {                                       // 오늘의 미션을 모두 끝냈어요 (연속 기록도)
      const today = u.daily.d;
      u.st.ac++;
      u.st.acCur = u.st.acDay === D.prevDay(today) ? u.st.acCur + 1 : u.st.acDay === today ? u.st.acCur : 1;
      u.st.acDay = today; u.st.acRow = Math.max(u.st.acRow, u.st.acCur);
    }
    const up = addXp(u, r.xp);
    award(u);
    save(u);
    emitUser(u.id, 'acct:daily', { done: r.done, bonus: r.bonus, xp: r.xp, up, lv: lvOf(u.xp), view: D.view(u) });
    emitUser(u.id, 'acct:me', meView(u));
  }
  function pushRecent(u, r) { u.recent.unshift(r); if (u.recent.length > 30) u.recent.length = 30; }

  /** 가장 닮은 회원 찾기 { id, sim, second } */
  function bestMatch(v, except) {
    let id = null, sim = -1, second = -1;
    for (const [k, f] of faces) {
      if (k === except) continue;
      const d = dot(v, f);
      if (d > sim) { second = sim; sim = d; id = k; } else if (d > second) second = d;
    }
    return { id, sim, second };
  }

  function issueToken(u) {
    const t = crypto.randomBytes(24).toString('base64url'), h = sha(t);
    u.tokens.push({ h, at: Date.now(), last: Date.now() });
    while (u.tokens.length > 8) { const old = u.tokens.shift(); byToken.delete(old.h); }
    byToken.set(h, u.id);
    return { t, h };
  }

  /* ───────── 접속 상태 (친구에게 보여 줄 것) ───────── */
  const pingTimers = new Map();
  /** 친구들에게 "내 상태가 바뀌었어요" 알림 (잠깐 모았다가 한 번에) */
  function pingFriends(u) {
    if (!u || pingTimers.has(u.id)) return;
    pingTimers.set(u.id, setTimeout(() => {
      pingTimers.delete(u.id);
      for (const fid of u.friends) for (const s of online.get(fid) || []) s.emit('fr:ping');
    }, 1200));
  }
  function whereOf(id) {
    const set = online.get(id);
    if (!set) return { on: false };
    let solo = null;
    for (const s of set) {
      const room = rooms.get(s.data.code);
      if (!room) { solo = solo || s.data.solo || null; continue; }
      const info = registry()[room.gameType] || {};
      return { on: true, room: room.code, gk: room.gameType, game: info.name || '', playing: !!room.isStarted, n: room.players.length, max: info.max || 0 };
    }
    return solo ? { on: true, solo } : { on: true };
  }
  /** 방 안의 내 자리 정보도 계정에 맞춰요 (로그인·로그아웃·정보 수정) */
  function syncPlayer(socket) {
    const room = rooms.get(socket.data.code);
    const p = room && room.players.find(x => x.id === socket.id);
    if (!p) return;
    const u = socket.data.uid && users.get(socket.data.uid);
    p.uid = u ? u.id : null;
    if (u) applyLook(p, u); else { p.lv = 0; p.av = null; p.color = null; p.op = ''; p.fr = -1; p.tt = ''; }
    if (u && !room.isStarted) p.name = u.name;
    H.pushRoom(room);
  }
  function bind(socket, u, h) {
    unbind(socket, true);
    socket.data.uid = u.id; socket.data.th = h;
    let set = online.get(u.id);
    const first = !set, away = Date.now() - (u.seen || 0);
    if (!set) online.set(u.id, set = new Set());
    set.add(socket);
    u.seen = Date.now(); save(u);
    syncPlayer(socket);
    if (first) pingFriends(u);
    // 1분 넘게 안 보이다가 들어오면 친구들에게 '접속했어요' (서버를 막 켰을 때 다시 연결되는 사람들은 빼요)
    if (first && away > ONLINE_AWAY && Date.now() - BOOT > BOOT_GRACE) setTimeout(() => { if (online.has(u.id)) for (const fid of u.friends) emitUser(fid, 'fr:online', pub(u)); }, 1500);
    const ci = checkin(u);
    if (ci) setTimeout(() => { if (socket.connected && socket.data.uid === u.id) socket.emit('acct:daily', { checkin: ci, view: D.view(u) }); }, 1500);
  }
  function unbind(socket, quiet) {
    const id = socket.data.uid;
    if (!id) return;
    socket.data.uid = null; socket.data.th = null;
    const set = online.get(id);
    if (set) {
      set.delete(socket);
      if (!set.size) { online.delete(id); const u = users.get(id); if (u) { u.seen = Date.now(); save(u); pingFriends(u); } }
    }
    if (!quiet) syncPlayer(socket);
  }
  const emitUser = (id, ev, d) => { for (const s of online.get(id) || []) s.emit(ev, d); };

  /* ───────── 계정 만들기 · 지우기 ───────── */
  function index(u) {
    users.set(u.id, u);
    if (u.code) byCode.set(u.code, u.id);
    for (const t of u.tokens) byToken.set(t.h, u.id);
    const f = u.face && fromB64(u.face.v);
    if (f) faces.set(u.id, f); else faces.delete(u.id);
  }
  function removeUser(u) {
    for (const t of u.tokens) byToken.delete(t.h);
    byCode.delete(u.code); faces.delete(u.id); users.delete(u.id);
    for (const [c, l] of linkCodes) if (l.id === u.id) linkCodes.delete(c);
    for (const k of [...convos.keys()]) if (k.split('|').includes(u.id)) convos.delete(k);
    unreadDM.delete(u.id);
    for (const m of unreadDM.values()) m.delete(u.id);
    for (const other of users.values()) {
      let ch = false;
      for (const k of ['friends', 'reqIn', 'reqOut']) { const i = other[k].indexOf(u.id); if (i >= 0) { other[k].splice(i, 1); ch = true; } }
      if (ch) { save(other); emitUser(other.id, 'fr:ping'); }
    }
    if (store) store.del(u.id);
    for (const s of [...(online.get(u.id) || [])]) { unbind(s); s.emit('acct:out', { why: 'deleted' }); }
    online.delete(u.id);
  }

  /* ───────── 멀티 게임 결과 기록 (H.finishGame 이 부를 때마다) ───────── */
  function onFinish(room, d) {
    if (state !== 'ready' || !room) return;
    const parts = H.participants(room), snap = room.acct || { at: 0, parts: [] };
    const humans = [], seen = new Set();
    for (const p of parts) if (p.uid && users.has(p.uid) && !seen.has(p.uid)) { seen.add(p.uid); humans.push(p); }
    // 시작할 때 있었는데 끝날 때 없는 계정 = 중간에 나간 사람 (기권패로 기록)
    const left = snap.parts.filter(q => q.uid && users.has(q.uid) && !seen.has(q.uid) && !parts.some(p => p.id === q.id));
    if (!humans.length && !left.length) return;
    const rk = Array.isArray(d.ranking) ? d.ranking : [];
    const n = Math.max(snap.parts.length, parts.length, rk.length);   // 나간 사람도 인원에 넣어요 (2인 게임 기권승)
    const pos = new Map(), pool = parts.slice();            // 결과표 → 방의 사람: id 가 있으면 id로, 없으면 이름으로
    rk.forEach((r, i) => {
      const k = r && r.id != null ? pool.findIndex(p => p.id === r.id) : pool.findIndex(p => p.name === r.name);
      if (k >= 0) { pos.set(pool[k].id, { i, v: String((r && r.value) ?? '') }); pool.splice(k, 1); }
    });
    let win;
    if (Array.isArray(d.winners)) win = new Set(d.winners);
    else {
      win = new Set();
      if (rk.length && !/무승부|아무도|모두 (탈락|파괴|쓰러)/.test(String(d.title || ''))) {
        let top = 1;
        while (top < rk.length && String(rk[top].value) === String(rk[0].value)) top++;     // 공동 1등
        for (const [id, x] of pos) if (x.i < top) win.add(id);
      }
    }
    const now = Date.now(), counted = now - (snap.at || now) >= MIN_GAME_MS;      // 너무 짧은 판은 경험치 없이 기록만
    for (const p of humans) {
      const u = users.get(p.uid), x = pos.get(p.id), w = n >= 2 && win.has(p.id);
      const st = own(u.multi, room.gameType) || (u.multi[room.gameType] = { p: 0, w: 0 });
      st.p++; u.plays++;
      if (w) { st.w++; u.wins++; }
      const friend = humans.some(q => q !== p && u.friends.includes(q.uid));
      if (counted) {                                          // 칭호용: 연승 · 친구와 한 판 · 큰 판 1등 (너무 짧은 판은 빼요)
        u.st.ws = w ? u.st.ws + 1 : 0; u.st.wsMax = Math.max(u.st.wsMax, u.st.ws);
        if (friend) u.st.fg++;
        if (w && n >= 6) u.st.big++;
      }
      pushRecent(u, { g: room.gameType, m: 1, t: now, r: x ? x.i + 1 : 0, n, w, v: x ? cut(x.v, 40) : '', with: humans.filter(q => q !== p).map(q => q.uid).slice(0, 7) });
      const gain = counted ? 20 + (w ? 30 : 0) + (!w && x && x.i === 1 && n >= 3 ? 10 : 0) : 0;
      const x0 = u.xp, up = addXp(u, gain);
      award(u);
      p.lv = lvOf(u.xp);
      save(u);
      io.to(p.id).emit('acct:gain', { xp: gain, lv: lvOf(u.xp), up, win: w, rank: x ? x.i + 1 : 0, n, short: !counted, x0, x1: u.xp, ws: u.st.ws });
      emitUser(u.id, 'acct:me', meView(u));
      if (counted) dailyTrack(u, { type: 'multi', g: room.gameType, win: w, friend });
    }
    for (const q of left) {                                   // 중간에 나간 사람: 한 판 · 승리 없음 · 경험치 없음 · 연승 끊김
      const u = users.get(q.uid);
      const st = own(u.multi, room.gameType) || (u.multi[room.gameType] = { p: 0, w: 0 });
      st.p++; u.plays++; u.st.ws = 0;
      pushRecent(u, { g: room.gameType, m: 1, t: now, r: 0, n, w: false, v: '중간에 나감', with: humans.map(h => h.uid).slice(0, 7) });
      award(u);
      save(u);
    }
  }

  // 게임 중에 바꾼 계정 이름 · 레벨은 대기실로 돌아올 때 반영해요
  const lobby0 = H.endToLobby;
  H.endToLobby = (room, msg) => {
    for (const p of room.players) { const u = p.uid && users.get(p.uid); if (u) { p.name = u.name; applyLook(p, u); } }
    lobby0(room, msg);
  };
  // 모든 게임 모듈이 만들어지기 전에 H.finishGame 을 감싸요 (모듈들이 H 에서 꺼내 쓰기 때문)
  const finish0 = H.finishGame;
  H.finishGame = (room, d) => {
    const live = room && room.game && !room.game.over;
    finish0(room, d);
    if (live) { try { onFinish(room, d || {}); } catch (e) { console.error('⚠️  기록 저장 오류:', e); } }
  };

  /* ───────── 랭킹 ───────── */
  function ranking(k, g, me) {
    let list = [...users.values()], val, low = false;
    if (k === 'wins') val = u => u.wins;
    else if (k === 'friends') { list = me ? [me, ...me.friends.map(id => users.get(id)).filter(Boolean)] : []; val = u => u.xp; }
    else if (k === 'solo') {
      const [base, sub] = String(g || '').split(':');
      if (!SOLO_KEYS.has(base) || (sub !== undefined && !/^[a-z0-9-]{1,16}$/.test(sub))) return { list: [] };
      low = LOW_BETTER.has(base);
      val = u => { const st = own(u.solo, g); return st && st.b != null ? st.b : null; };
    } else val = u => u.xp;
    list = list.filter(u => val(u) != null && (k !== 'wins' || u.wins > 0));
    list.sort((a, b) => (low ? val(a) - val(b) : val(b) - val(a)) || a.created - b.created);
    const out = list.slice(0, 50).map((u, i) => ({ ...pub(u), rank: i + 1, v: val(u) }));
    const mi = me ? list.indexOf(me) : -1;
    return { list: out, me: mi >= 0 ? { rank: mi + 1, v: val(me) } : null, low };
  }

  /* ───────── 소켓 이벤트 ───────── */
  function attach(socket, on) {
    const ip = () => ipOf(socket);
    const reply = (cb, d) => { if (typeof cb === 'function') cb(d); };
    const ready = cb => { if (state === 'ready') return true; reply(cb, { ok: false, why: state === 'error' ? 'down' : 'loading' }); return false; };
    const need = cb => {
      if (!ready(cb)) return null;
      const u = socket.data.uid && users.get(socket.data.uid);
      if (!u) { reply(cb, { ok: false, why: 'login' }); return null; }
      if (!lim.act(socket.id)) { reply(cb, { ok: false, why: 'limit' }); return null; }
      return u;
    };
    const login = (u, cb, extra) => {
      const { t, h } = issueToken(u);
      bind(socket, u, h);
      save(u);
      reply(cb, { ok: true, token: t, me: meView(u), ...extra });
    };

    on('acct:hello', (t, cb) => {
      if (state !== 'ready') return reply(cb, { ok: false, why: state === 'error' ? 'down' : 'loading', persist: persistInfo() });
      const h = typeof t === 'string' && t.length < 100 ? sha(t) : null;
      const u = h && users.get(byToken.get(h));
      if (!u) { unbind(socket); return reply(cb, { ok: true, me: null, persist: persistInfo() }); }
      const tk = u.tokens.find(x => x.h === h);
      if (tk && Date.now() - tk.last > 3600000) { tk.last = Date.now(); }
      bind(socket, u, h);
      reply(cb, { ok: true, me: meView(u), persist: persistInfo() });
    });

    /** 얼굴로 로그인 */
    on('acct:login', (d, cb) => {
      if (!ready(cb)) return;
      if (!lim.face(socket.id) || !lim.faceIp(ip())) return reply(cb, { ok: false, why: 'limit' });
      const v = parseEmb(d && d.e);
      if (!v) return reply(cb, { ok: false, why: 'bad' });
      const m = bestMatch(v);
      if (!m.id || m.sim < MATCH) return reply(cb, { ok: false, why: 'nomatch' });
      if (m.sim - m.second < MARGIN) return reply(cb, { ok: false, why: 'unsure' });
      login(users.get(m.id), cb, { sim: Math.round(m.sim * 100) / 100 });
    });

    /** 얼굴로 회원가입 */
    on('acct:join', (d, cb) => {
      if (!ready(cb)) return;
      if (!d || d.agree !== true) return reply(cb, { ok: false, why: 'agree' });
      const name = cleanName(d.name);
      if (!name) return reply(cb, { ok: false, why: 'name' });
      if (RESERVED.test(name)) return reply(cb, { ok: false, why: 'reserved' });
      const v = parseEmb(d.e);
      if (!v || !(Number(d.n) >= 3)) return reply(cb, { ok: false, why: 'bad' });
      if (users.size >= MAX_USERS) return reply(cb, { ok: false, why: 'full' });
      if (!lim.face(socket.id) || !lim.join(ip())) return reply(cb, { ok: false, why: 'limit' });
      const m = bestMatch(v);
      if (m.id && m.sim >= MATCH) return reply(cb, { ok: false, why: 'dup' });
      if (!lim.joinAll('all')) return reply(cb, { ok: false, why: 'limit' });          // 서버 전체로 한 시간에 60명까지
      const u = normalize({
        id: 'u' + crypto.randomBytes(6).toString('hex'), name, code: newCode(),
        av: Number.isInteger(d.av) && d.av >= -1 && d.av < AV_COUNT ? d.av : -1,
        color: Number.isInteger(d.color) && d.color >= 0 && d.color < COLOR_COUNT ? d.color : crypto.randomInt(COLOR_COUNT),
        face: { v: toB64(v), n: Math.min(30, Math.floor(d.n)), at: Date.now() }, created: Date.now(),
      });
      index(u);
      login(u, cb, { joined: true });
    });

    /** 로그인한 채로 얼굴 다시 등록 (잘 안 알아볼 때) */
    on('acct:reface', (d, cb) => {
      const u = need(cb); if (!u) return;
      if (!lim.face(socket.id)) return reply(cb, { ok: false, why: 'limit' });
      const v = parseEmb(d && d.e);
      if (!v || !(Number(d.n) >= 3)) return reply(cb, { ok: false, why: 'bad' });
      const m = bestMatch(v, u.id);
      if (m.id && m.sim >= MATCH) return reply(cb, { ok: false, why: 'dup' });
      u.face = { v: toB64(v), n: Math.min(30, Math.floor(d.n)), at: Date.now() };
      faces.set(u.id, v); save(u);
      reply(cb, { ok: true, me: meView(u) });
    });

    /** 다른 기기 연결 코드 (카메라 없는 기기에서 로그인) */
    on('acct:mkcode', (_, cb) => {
      const u = need(cb); if (!u) return;
      for (const [c, l] of linkCodes) if (l.id === u.id || l.exp < Date.now()) linkCodes.delete(c);
      let c; do { c = Array.from({ length: 8 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (linkCodes.has(c));
      const exp = Date.now() + 5 * 60000;
      linkCodes.set(c, { id: u.id, exp });
      reply(cb, { ok: true, code: c, exp });
    });
    on('acct:code', (d, cb) => {
      if (!ready(cb)) return;
      if (!lim.code(socket.id) || !lim.codeIp(ip()) || codeLocked()) return reply(cb, { ok: false, why: 'limit' });
      const c = String((d && d.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const l = linkCodes.get(c);
      if (!l || l.exp < Date.now() || !users.has(l.id)) {
        if (l) linkCodes.delete(c);
        codeFails.n++;
        return reply(cb, { ok: false, why: 'code' });
      }
      linkCodes.delete(c);
      login(users.get(l.id), cb);
    });

    on('acct:logout', (_, cb) => {
      const id = socket.data.uid, u = id && users.get(id), h = socket.data.th;
      if (u && h) {
        u.tokens = u.tokens.filter(x => x.h !== h); byToken.delete(h); save(u);
        for (const s of [...(online.get(id) || [])]) if (s !== socket && s.data.th === h) { unbind(s); s.emit('acct:out', { why: 'logout' }); }
      }
      unbind(socket);
      reply(cb, { ok: true });
    });

    on('acct:delete', (d, cb) => {
      const u = need(cb); if (!u) return;
      if (!d || d.sure !== true) return reply(cb, { ok: false, why: 'sure' });
      removeUser(u);
      reply(cb, { ok: true });
    });

    on('acct:edit', (d, cb) => {
      const u = need(cb); if (!u || !d) return;
      if (d.name !== undefined) {
        const n = cleanName(d.name);
        if (!n) return reply(cb, { ok: false, why: 'name' });
        if (n !== u.name && RESERVED.test(n) && !u.role) return reply(cb, { ok: false, why: 'reserved' });   // 운영자만 '운영자 …' 같은 이름을 쓸 수 있어요
        u.name = n;
      }
      if (Number.isInteger(d.av) && d.av >= -1 && d.av < AV_COUNT) u.av = d.av;
      if (Number.isInteger(d.color) && d.color >= 0 && d.color < COLOR_COUNT) u.color = d.color;
      if (typeof d.hide === 'boolean') u.hide = d.hide;
      save(u);
      for (const s of online.get(u.id) || []) syncPlayer(s);
      emitUser(u.id, 'acct:me', meView(u));
      pingFriends(u);
      reply(cb, { ok: true, me: meView(u) });
    });

    /** 꾸미기: 테두리 고르기(fr: -1 자동 · 0~9, 지금 레벨까지) · 칭호 달기(tt: 받은 칭호 id, '' = 떼기) */
    on('acct:look', (d, cb) => {
      const u = need(cb); if (!u || !d) return;
      if (d.fr !== undefined) {
        if (!Number.isInteger(d.fr) || d.fr < -1 || d.fr > Titles.tierOf(lvOf(u.xp))) return reply(cb, { ok: false, why: 'locked' });
        u.fr = d.fr;
      }
      if (d.tt !== undefined) {
        if (d.tt !== '' && !(typeof d.tt === 'string' && own(u.ttl, d.tt))) return reply(cb, { ok: false, why: 'locked' });
        u.tt = d.tt;
      }
      save(u);
      for (const s of online.get(u.id) || []) syncPlayer(s);
      emitUser(u.id, 'acct:me', meView(u));
      pingFriends(u);
      reply(cb, { ok: true, me: meView(u) });
    });
    /** 새 칭호 축하 화면을 봤어요 (t: 본 칭호 중 가장 늦게 받은 시각) */
    on('acct:ttlseen', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = Math.min(Date.now(), +(d && d.t) || Date.now());
      if (t > u.ttlSeen) { u.ttlSeen = t; save(u); }
      reply(cb, { ok: true });
    });
    /** 친구에게 축하 보내기 (새 테두리 · 칭호 알림에서) */
    on('fr:cheer', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      if (!u.friends.includes(t.id)) return reply(cb, { ok: false, why: 'notfriend' });
      if (!online.has(t.id)) return reply(cb, { ok: false, why: 'offline' });
      if (!lim.pair('cheer:' + u.id + '>' + t.id)) return reply(cb, { ok: false, why: 'limit' });
      emitUser(t.id, 'fr:cheered', { from: pub(u) });
      reply(cb, { ok: true });
    });

    /** 내 기록 (게임별 · 최근 경기) */
    on('acct:profile', (_, cb) => {
      const u = need(cb); if (!u) return;
      const name = id => { const x = users.get(id); return x ? { id, name: x.name } : null; };
      reply(cb, {
        ok: true, me: meView(u),
        multi: Object.entries(u.multi).map(([g, s]) => ({ g, p: s.p, w: s.w })),
        solo: Object.entries(u.solo).map(([g, s]) => ({ g, p: s.p, w: s.w || 0, b: s.b ?? null, low: LOW_BETTER.has(g.split(':')[0]) })),
        recent: u.recent.map(r => ({ ...r, with: (r.with || []).map(name).filter(Boolean) })),
      });
    });

    on('acct:rank', (d, cb) => {
      if (!ready(cb)) return;
      if (!lim.act(socket.id)) return reply(cb, { ok: false, why: 'limit' });
      const me = socket.data.uid && users.get(socket.data.uid);
      const k = ['xp', 'wins', 'friends', 'solo'].includes(d && d.k) ? d.k : 'xp';
      reply(cb, { ok: true, k, g: d && d.g, ...ranking(k, d && d.g, me) });
    });

    /** 싱글 게임 기록 (브라우저가 보내요) */
    on('acct:solo', (d, cb) => {
      const u = need(cb); if (!u || !d) return;
      const base = String(d.g || '');
      if (!SOLO_KEYS.has(base)) return reply(cb, { ok: false, why: 'bad' });
      if (!lim.solo(u.id)) return reply(cb, { ok: false, why: 'limit' });
      const rec = d.rec && typeof d.rec === 'object' ? d.rec : null;
      const sub = rec && typeof rec.k === 'string' && /^[a-z0-9-]{1,16}$/.test(rec.k) ? rec.k : '';
      const key = sub ? `${base}:${sub}` : base;
      let st = own(u.solo, key);
      if (!st) { if (Object.keys(u.solo).length >= 80) return reply(cb, { ok: false, why: 'bad' }); st = u.solo[key] = { p: 0, w: 0 }; }
      const win = d.win === true, low = LOW_BETTER.has(base);
      const v = rec ? Number(rec.v) : NaN;
      let best = false, first = false;
      if (Number.isFinite(v) && v >= 0 && v < 1e9 && !(low && v === 0)) {
        if (st.b == null) { first = true; st.b = Math.round(v * 100) / 100; }
        else if (low ? v < st.b : v > st.b) { best = true; st.b = Math.round(v * 100) / 100; }
      }
      st.p++; if (win) st.w = (st.w || 0) + 1;
      u.sp++;
      if (best) u.st.best++;
      pushRecent(u, { g: key, m: 0, t: Date.now(), w: win, v: Number.isFinite(v) ? Math.round(v * 100) / 100 : null, b: best });
      const now = Date.now(), cool = now - (soloXpAt.get(u.id) || 0) < 15000;
      const gain = cool ? 0 : 8 + (win ? 12 : 0) + (best ? 10 : 0);
      if (!cool) soloXpAt.set(u.id, now);
      const x0 = u.xp, up = addXp(u, gain);
      award(u);
      save(u);
      if (!cool) dailyTrack(u, { type: 'solo', g: base, win, best: best || first });     // 첫 기록도 '기록 깨기'로 쳐요
      reply(cb, { ok: true, xp: gain, lv: lvOf(u.xp), up, best, first, short: cool, x0, x1: u.xp, me: meView(u) });
    });

    /* ── 친구 ── */
    on('fr:list', (_, cb) => {
      const u = need(cb); if (!u) return;
      const list = ids => ids.map(id => users.get(id)).filter(Boolean);
      const friends = list(u.friends).map(f => ({ ...pub(f), ...whereOf(f.id), seen: f.seen, unread: dmOf(u.id, f.id) }))
        .sort((a, b) => (b.on - a.on) || (b.seen - a.seen));
      const fset = new Set([u.id, ...u.friends, ...u.reqOut, ...u.reqIn]);
      const recent = [];
      for (const r of u.recent) for (const id of r.with || []) if (!fset.has(id) && users.has(id) && recent.length < 12) { fset.add(id); recent.push(pub(users.get(id))); }
      const rel = id => (u.friends.includes(id) ? 'friend' : u.reqOut.includes(id) ? 'sent' : u.reqIn.includes(id) ? 'got' : '');
      const here = [];
      for (const id of online.keys()) {
        const x = users.get(id);
        if (!x || id === u.id || x.hide) continue;
        const w = whereOf(id);
        here.push({ ...pub(x), rel: rel(id), st: w.room ? (w.playing ? 'game' : 'room') : w.solo ? 'solo' : 'home', game: w.game || '', solo: w.solo || undefined, seen: x.seen });
      }
      here.sort((a, b) => ((a.rel === 'friend') - (b.rel === 'friend')) || (b.seen - a.seen));
      reply(cb, { ok: true, code: u.code, friends, reqIn: list(u.reqIn).map(pub), reqOut: list(u.reqOut).map(pub), recent, online: here.slice(0, 100), onlineN: here.length });
    });
    /** 친구 코드 없이 바로 신청할 수 있는 사람: 나에게 신청한 사람 · 접속 중(숨기지 않음) · 같은 방 · 같이 게임한 사람 */
    const known = (u, t) => {
      const room = rooms.get(socket.data.code);
      return u.reqIn.includes(t.id) || (online.has(t.id) && !t.hide) || (!!room && room.players.some(p => p.uid === t.id)) || u.recent.some(r => (r.with || []).includes(t.id));
    };
    /** 프로필 카드: 레벨 · 전적 · 자주 하는 게임 · 최근 경기 (누구나 볼 수 있는 정보만) */
    on('acct:card', (d, cb) => {
      if (!ready(cb)) return;
      if (!lim.act(socket.id)) return reply(cb, { ok: false, why: 'limit' });
      const t = d && typeof d.uid === 'string' && users.get(d.uid);
      if (!t) return reply(cb, { ok: false, why: 'nouser' });
      const me = socket.data.uid && users.get(socket.data.uid);
      const rel = !me ? '' : me.id === t.id ? 'me' : me.friends.includes(t.id) ? 'friend' : me.reqOut.includes(t.id) ? 'sent' : me.reqIn.includes(t.id) ? 'got' : '';
      const fav = Object.entries(t.multi).map(([g, s]) => ({ g, p: s.p, w: s.w, m: 1 }))
        .concat(Object.entries(t.solo).map(([g, s]) => ({ g, p: s.p, w: s.w || 0, m: 0, b: s.b ?? null })))
        .sort((a, b) => b.p - a.p).slice(0, 4);
      const lv = lvOf(t.xp), today = D.dayKey();
      const ttl = Object.keys(t.ttl).sort((a, b) => Titles.byId[b].r - Titles.byId[a].r || t.ttl[b] - t.ttl[a]);   // 귀한 칭호부터
      reply(cb, { ok: true, rel, canAdd: !!me && rel === '' && known(me, t),
        where: rel === 'friend' || rel === 'me' ? whereOf(t.id) : { on: online.has(t.id) && !t.hide },
        u: { ...pub(t), xp: t.xp, cur: xpAt(lv), next: xpAt(lv + 1), plays: t.plays, wins: t.wins, sp: t.sp, friends: t.friends.length, created: t.created, ttl, nT: Titles.LIST.length,
          streak: t.daily.d === today || t.daily.d === D.prevDay(today) ? t.daily.streak : 0, fav,
          recent: t.recent.slice(0, 5).map(r => ({ g: r.g, m: r.m, w: !!r.w, r: r.r || 0, n: r.n || 0, t: r.t, b: !!r.b })) } });
    });
    on('fr:add', (d, cb) => {
      const u = need(cb); if (!u || !d) return;
      let t = null;
      if (typeof d.code === 'string') t = users.get(byCode.get(d.code.toUpperCase().replace(/[^A-Z0-9]/g, '')));
      else if (typeof d.uid === 'string') {
        t = users.get(d.uid);
        if (t && !known(u, t)) return reply(cb, { ok: false, why: 'unknown' });
      }
      if (!t) return reply(cb, { ok: false, why: 'nouser' });
      if (t === u) return reply(cb, { ok: false, why: 'self' });
      if (u.friends.includes(t.id)) return reply(cb, { ok: false, why: 'already' });
      if (u.reqIn.includes(t.id)) return accept(u, t, cb);               // 상대가 먼저 신청했으면 바로 친구
      if (u.reqOut.includes(t.id)) return reply(cb, { ok: false, why: 'sent' });
      if (u.friends.length >= 200 || t.friends.length >= 200) return reply(cb, { ok: false, why: 'max' });
      if (u.reqOut.length >= 50 || t.reqIn.length >= 100) return reply(cb, { ok: false, why: 'max' });
      u.reqOut.push(t.id); t.reqIn.push(u.id);
      save(u); save(t);
      emitUser(t.id, 'fr:ping', { req: pub(u) });
      reply(cb, { ok: true, sent: pub(t) });
    });
    const drop = (arr, id) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); };
    function accept(u, t, cb) {
      drop(u.reqIn, t.id); drop(u.reqOut, t.id); drop(t.reqIn, u.id); drop(t.reqOut, u.id);
      if (!u.friends.includes(t.id)) u.friends.push(t.id);
      if (!t.friends.includes(u.id)) t.friends.push(u.id);
      const gu = award(u), gt = award(t);                                // 친구 칭호 (인싸 …)
      save(u); save(t);
      emitUser(t.id, 'fr:ping', { accepted: pub(u) });
      if (gt.length) emitUser(t.id, 'acct:me', meView(t));
      if (gu.length) emitUser(u.id, 'acct:me', meView(u));
      reply(cb, { ok: true, friend: pub(t) });
    }
    const other = (d, cb) => { const t = d && typeof d.uid === 'string' && users.get(d.uid); if (!t) reply(cb, { ok: false, why: 'nouser' }); return t; };
    on('fr:accept', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      if (!u.reqIn.includes(t.id)) return reply(cb, { ok: false, why: 'noreq' });
      accept(u, t, cb);
    });
    on('fr:decline', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      drop(u.reqIn, t.id); drop(t.reqOut, u.id); save(u); save(t);
      reply(cb, { ok: true });
    });
    on('fr:cancel', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      drop(u.reqOut, t.id); drop(t.reqIn, u.id); save(u); save(t);
      emitUser(t.id, 'fr:ping');
      reply(cb, { ok: true });
    });
    on('fr:remove', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      drop(u.friends, t.id); drop(t.friends, u.id); save(u); save(t);
      dmForget(u.id, t.id);
      emitUser(t.id, 'fr:ping');
      reply(cb, { ok: true });
    });

    /* ── 귓속말 (친구끼리, 접속 중일 때) ── */
    on('dm:send', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      if (!u.friends.includes(t.id)) return reply(cb, { ok: false, why: 'notfriend' });
      if (!online.has(t.id)) return reply(cb, { ok: false, why: 'offline' });
      const text = cut((typeof d.text === 'string' ? d.text : '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(), 200);
      if (!text) return reply(cb, { ok: false, why: 'empty' });
      if (!lim.dm(u.id)) return reply(cb, { ok: false, why: 'limit' });
      const key = pairKey(u.id, t.id);
      const c = convos.get(key) || [];
      convos.delete(key); convos.set(key, c);                            // 최근 대화를 맨 뒤로 (오래된 대화부터 정리)
      while (convos.size > DM_MAX_CONVOS) dmDrop(convos.keys().next().value);
      const w = whereOf(t.id);
      const m = { id: ++dmSeq, f: u.id, x: text, t: Date.now(), q: !!(w.playing || w.solo) };   // q: 게임 중이라 조용히 전달
      c.push(m); if (c.length > DM_KEEP) c.shift();
      if (!unreadDM.has(t.id)) unreadDM.set(t.id, new Map());
      unreadDM.get(t.id).set(u.id, Math.min(99, dmOf(t.id, u.id) + 1));
      const msg = { ...m, from: pub(u), to: t.id };
      emitUser(t.id, 'dm:msg', msg);
      for (const s of online.get(u.id) || []) if (s !== socket) s.emit('dm:msg', msg);   // 내 다른 기기에도
      reply(cb, { ok: true, msg, to: w });
      u.st.dm++;
      if (award(u).length) emitUser(u.id, 'acct:me', meView(u));
      save(u);
      dailyTrack(u, { type: 'dm' });
    });
    on('dm:history', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      if (!u.friends.includes(t.id)) return reply(cb, { ok: false, why: 'notfriend' });
      reply(cb, { ok: true, friend: { ...pub(t), ...whereOf(t.id) }, list: (convos.get(pairKey(u.id, t.id)) || []).slice(-DM_KEEP) });
    });
    on('acct:busy', d => {              // 싱글 게임 중인지 (친구 목록 · 귓속말 창에 '게임 중'으로 보여요 · 멀티 게임은 서버가 이미 알아요)
      const g = d && typeof d.g === 'string' ? d.g : '';
      socket.data.solo = SOLO_KEYS.has(g) ? g : null;
    });
    on('dm:read', (d, cb) => {
      const u = need(cb); if (!u) return;
      if (!d || typeof d.uid !== 'string') return reply(cb, { ok: false, why: 'bad' });
      if (unreadDM.has(u.id)) unreadDM.get(u.id).delete(d.uid);
      for (const s of online.get(u.id) || []) s.emit('dm:unread', { from: d.uid, total: dmTotal(u.id) });
      reply(cb, { ok: true });
    });

    /** 친구를 내가 있는 방으로 초대 */
    on('fr:invite', (d, cb) => {
      const u = need(cb); if (!u) return;
      const t = other(d, cb); if (!t) return;
      if (!u.friends.includes(t.id)) return reply(cb, { ok: false, why: 'notfriend' });
      const room = rooms.get(socket.data.code);
      if (!room) return reply(cb, { ok: false, why: 'noroom' });
      if (!online.has(t.id)) return reply(cb, { ok: false, why: 'offline' });
      if (room.players.some(p => p.uid === t.id)) return reply(cb, { ok: false, why: 'here' });
      if (!lim.invite(socket.id) || !lim.pair(u.id + '>' + t.id)) return reply(cb, { ok: false, why: 'limit' });
      const info = registry()[room.gameType] || {};
      emitUser(t.id, 'fr:invited', { from: pub(u), code: room.code, gk: room.gameType, game: info.name || '', n: room.players.length, max: info.max || 0, playing: !!room.isStarted });
      reply(cb, { ok: true });
    });

    // 접속 표시는 바로 내리고, 계정 정보는 남겨 둬요 (연결 복구로 돌아오면 resume 에서 다시 붙여요)
    socket.on('disconnect', () => { const { uid, th } = socket.data; unbind(socket, true); socket.data.uid = uid; socket.data.th = th; });
  }

  /* ───────── 시작: 저장소에서 계정 불러오기 (DB가 잠깐 안 되면 다시 시도) ───────── */
  async function init() {
    try { store = openStore(); } catch (e) {        // 예: DATABASE_URL 은 있는데 pg 부품이 설치 안 됨
      state = 'error';
      console.error('⚠️  계정 저장소를 열 수 없어요:', e.message, '→ npm install 을 다시 실행해 주세요.');
      return;
    }
    for (let tries = 1; ; tries++) {
      try {
        const docs = await store.load();
        for (const d of docs) { if (String(d.id).startsWith('__')) { sysDocs.set(d.id, d); if (d.id === '__sys') sysDoc = d; continue; } try { const u = normalize(d); if (!u.code || byCode.has(u.code)) u.code = newCode(); index(u); } catch (e) { console.error('⚠️  계정 하나를 읽지 못했어요:', e.message); } }
        state = 'ready';
        let given = 0;                                            // 예전부터 채운 칭호 (조용히 · 화면이 다음 접속 때 축하해요)
        for (const u of users.values()) { const g = award(u, true); if (g.length) { given += g.length; save(u); } }
        if (given) console.log(`   🏅 칭호 ${given}개를 새로 줬어요`);
        for (const f of readyFns) { try { f(sysDoc); } catch (e) { console.error('⚠️  운영 정보를 읽지 못했어요:', e.message); } }
        prune();
        setInterval(prune, 6 * 3600000).unref();
        console.log(`   👤 계정 ${users.size}명 불러옴 · 저장 위치: ${store.kind === 'db' ? 'DB (' + store.where + ')' : store.where}`);
        if (cloud && store.kind === 'file') console.log('   ⚠️  DATABASE_URL 이 없어요. 클라우드 서버를 다시 시작하면 계정·기록이 지워질 수 있어요. (DEPLOY.md 참고)');
        io.emit('acct:ready');
        return;
      } catch (e) {
        state = 'error';
        console.error(`⚠️  계정 저장소에 연결하지 못했어요 (${tries}번째): ${e.message} — 15초 뒤 다시 시도해요.`);
        await new Promise(r => setTimeout(r, 15000));
      }
    }
  }
  /** 가입 인원이 한도에 가까우면, 한 번도 게임하지 않고 7일 넘게 안 들어온 빈 계정을 정리해요 (장난 가입 방지) */
  function prune() {
    if (users.size < MAX_USERS * 0.8) return;
    const old = Date.now() - 7 * 86400000;
    let n = 0;
    for (const u of [...users.values()]) {
      if (u.plays || u.sp || u.friends.length || u.reqIn.length || u.reqOut.length || u.created > old || u.seen > old || online.has(u.id)) continue;
      removeUser(u); n++;
    }
    if (n) console.log(`   🧹 게임 기록이 없는 오래된 빈 계정 ${n}개를 정리했어요`);
  }
  async function flush() { if (store) await store.flush(); }
  function flushSync() { if (store && store.flushSync) store.flushSync(); }

  /** 방에 들어갈 때 쓸 계정 정보 */
  function playerProps(socket) {
    const u = state === 'ready' && socket.data.uid && users.get(socket.data.uid);
    return u ? { uid: u.id, name: u.name, lv: lvOf(u.xp), av: u.av, color: u.color, op: u.role || '', fr: u.fr, tt: u.tt || '' } : null;
  }
  function touch(socket) { const u = socket.data.uid && users.get(socket.data.uid); if (u) pingFriends(u); }
  /** 연결 복구로 돌아온 소켓: 계정을 다시 붙여요 (화면도 곧 acct:hello 로 다시 인사해요) */
  function resume(socket) {
    const u = state === 'ready' && socket.data.uid && users.get(socket.data.uid);
    const th = socket.data.th;
    socket.data.uid = null; socket.data.th = null;
    if (u && th && u.tokens.some(x => x.h === th)) bind(socket, u, th);      // 그사이 로그아웃했으면 붙이지 않아요
  }

  /** 게임 시작 때 참가자를 기억해요 (중간에 나간 사람 · 2인 게임 기권승 기록용) */
  const onStart = room => { room.acct = { at: Date.now(), parts: H.participants(room).map(p => ({ id: p.id, uid: p.uid || null })) }; };
  /** 운영자 모듈(lib/admin.js)이 쓰는 도구 */
  const _int = {
    users, online, pub, meView, save, emitUser, ipOf, limiter, ready: () => state === 'ready',
    onReady: f => { if (state === 'ready') f(sysDoc); else readyFns.push(f); },
    saveSys: d => { sysDoc = d; sysDocs.set(d.id, d); if (store) store.put(d); },
    sysGet: id => sysDocs.get(id) || null,                     // 다른 운영용 문서 (불러온 뒤에)
    sysPut: d => { sysDocs.set(d.id, d); if (store) store.put(d); },
    syncAll: id => { for (const s of online.get(id) || []) syncPlayer(s); },
  };
  return { init, attach, flush, flushSync, status, playerProps, touch, resume, onStart, _int,
    _test: { users, faces, bestMatch, parseEmb, lvOf, xpAt, statsOf, award } };
};
