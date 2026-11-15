'use strict';
/**
 * ⏳ 키즈 모드 (v13.8) — 최고 운영자가 회원마다 하루 게임 시간 · 할 수 있는 시간대를 정해요
 *
 *  - 정하는 것: 평일 · 주말(토 · 일) 하루 시간(분, 0 = 제한 없음) · 할 수 있는 시간대(예: 18:00 ~ 21:00, 자정을 넘겨도 돼요)
 *    오늘만 더 주기(+분) · 오늘은 그만(지금 잠그기 → 내일 다시 열려요)
 *  - 시간은 게임하는 동안만 세요: 싱글 게임 화면 · 시작한 멀티 방. 화면이 안 보이면(다른 탭 · 화면 꺼짐) · 메뉴 · 대기실은 빼요.
 *    하루는 한국 시간 0시에 바뀌어요.
 *  - 잠기면(시간을 다 씀 · 시간대가 아님 · 오늘은 그만) 새 게임을 시작할 수 없어요 (방 만들기 · 들어가기 · 빠른 참가 · 한 판 더 · 시작).
 *    싱글 게임은 화면이 바로 끝내요(js/kid.js). 멀티 게임은 하던 판만 마무리해요 → 판이 끝나면(최대 10분) 방에서 나가요.
 *  - 그 계정으로 로그인했던 기기(최대 5대)는 기기 키로 기억해요 → 로그아웃하고 손님으로 해도 똑같이 세고 막아요.
 *    다른 계정으로 로그인하면 그 계정 기준이에요. 키즈 모드를 끄면 기억한 기기도 모두 잊어요.
 *  - 계산은 public/js/shared/kid-core.js (화면과 같이 써요) · 저장은 계정 문서의 kid 칸 (lib/accounts.js normalize)
 *  - 설정 · 바꾼 기록은 운영자 활동 기록에 남아요 (lib/admin.js note)
 */
const crypto = require('crypto');
const K = require('../public/js/shared/kid-core');

const TICK = Number(process.env.KID_TICK_MS) || 5000;                                          // 시간을 세는 간격
const GRACE = process.env.KID_GRACE_MS !== undefined ? Number(process.env.KID_GRACE_MS) : 10 * 60000;   // 멀티: 하던 판 마무리 최대
const OVER_WAIT = process.env.KID_OVER_MS !== undefined ? Number(process.env.KID_OVER_MS) : 6000;       // 판이 끝나고 결과를 볼 시간
const SCALE = Math.max(1, Number(process.env.KID_TIME_SCALE) || 1);                              // 검사용: 시간을 빨리 흐르게 (보통 1)
const SAVE_MS = 60000;                                                                          // 게임하는 동안 저장 간격
const PUSH_MS = 30000;                                                                          // 게임하는 동안 남은 시간 다시 알려 주기
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');

module.exports = function makeKid({ io, rooms, acc, adm, leaveRoom }) {
  const A = acc._int;
  const kids = new Set();             // 키즈 모드가 켜진 회원 id
  const devs = new Map();             // sha256(기기 키) → 회원 id
  const guests = new Map();           // 회원 id → Set(socket) — 로그인하지 않은 키즈 기기
  const carry = new Map();            // 회원 id → 아직 초로 못 넘긴 ms
  const saved = new Map();            // 회원 id → 마지막 저장 시각
  const dirty = new Set();            // 저장할 게 남은 회원 id
  const lastWhy = new Map();          // 회원 id → 지난번 잠김 이유 (바뀌면 바로 알려요)
  const lim = { act: A.limiter(30, 10000), hello: A.limiter(20, 60000) };
  let lastTick = Date.now();

  A.onReady(() => {
    for (const u of A.users.values()) {
      if (u.kid.on) kids.add(u.id);
      for (const d of u.kid.devs) devs.set(d.h, u.id);
    }
  });

  /* ───────── 누구 기준인지 ───────── */
  /** 이 화면에 걸린 키즈 모드 회원 (로그인했으면 그 계정 · 손님이면 기억한 기기의 계정) */
  function kidOf(s) {
    if (s.data.uid) { const u = A.users.get(s.data.uid); return u && u.kid.on ? u : null; }
    const g = s.data.kidDev && A.users.get(s.data.kidDev);
    return g && g.kid.on ? g : null;
  }
  /** 그 회원의 화면들 (로그인한 화면 + 손님으로 들어온 키즈 기기) */
  function socketsOf(u) {
    const out = [...(A.online.get(u.id) || [])];
    for (const s of guests.get(u.id) || []) if (s.connected && !s.data.uid) out.push(s);
    return out;
  }
  const inGame = s => { const room = rooms.get(s.data.code); return !!room && room.isStarted && room.players.some(p => p.id === s.id); };
  /** 지금 게임하는 중인지: 화면이 보이고 + 싱글 게임 화면이거나 시작한 멀티 방 */
  const playing = s => s.connected && s.data.vis !== false && (!!s.data.solo || inGame(s));
  const view = (u, s, msg) => ({ ...K.state(u.kid, Date.now()), name: u.name, guest: !s.data.uid, ...(msg ? { msg } : {}) });
  function push(u, msg, extra) {
    const now = Date.now();
    for (const s of socketsOf(u)) { s.data.kidAt = now; s.emit('kid:state', { ...view(u, s, msg), ...(extra || {}) }); }
  }
  /** 저장 (새 버전으로 갈아타는 동안에도 저장해요 — 새 서버는 로그인할 때 DB에서 최신 것을 다시 읽어요, lib/accounts.js refresh) */
  function save(u) { A.save(u); saved.set(u.id, Date.now()); dirty.delete(u.id); }
  function unguest(s) {
    const id = s.data.kidDev;
    if (!id) return;
    s.data.kidDev = null;
    const set = guests.get(id);
    if (set) { set.delete(s); if (!set.size) guests.delete(id); }
  }

  /* ───────── 잠겼을 때: 방에서 나가기 ───────── */
  function out(u, s, why) {
    s.data.kidGrace = 0; s.data.kidOver = 0;
    leaveRoom(s);
    s.emit('kid:out', { ...view(u, s), why });
  }
  function enforce(u, st, socks, now) {
    for (const s of socks) {
      if (!st.why) { s.data.kidGrace = 0; s.data.kidOver = 0; continue; }
      const room = rooms.get(s.data.code);
      if (!room || !room.players.some(p => p.id === s.id)) continue;
      if (!room.isStarted) { out(u, s, 'lobby'); continue; }                                     // 대기실이면 바로
      if (room.game && room.game.over) {                                                      // 판이 끝났으면 결과를 잠깐 보고
        s.data.kidOver = s.data.kidOver || now;
        if (now - s.data.kidOver >= OVER_WAIT) out(u, s, 'over');
        continue;
      }
      s.data.kidGrace = s.data.kidGrace || now;                                               // 하던 판은 마무리 (최대 10분)
      if (now - s.data.kidGrace >= GRACE) out(u, s, 'mid');
    }
  }

  /* ───────── 시간 세기 ───────── */
  function tick() {
    const now = Date.now(), dt = Math.min(TICK * 3, 30000, Math.max(0, now - lastTick));   // 서버가 잠깐 멈췄다 돌아와도 한 번에 30초까지만
    lastTick = now;
    if (!A.ready()) return;
    for (const id of [...kids]) {
      const u = A.users.get(id);
      if (!u || !u.kid.on) { kids.delete(id); continue; }
      const socks = socketsOf(u);
      if (!socks.length) { if (dirty.has(id)) save(u); lastWhy.delete(id); continue; }
      const k = u.kid;
      let changed = K.roll(k, now);
      const play = socks.some(playing);
      if (play) {
        const c = (carry.get(id) || 0) + dt * SCALE, sec = Math.floor(c / 1000);
        carry.set(id, c - sec * 1000);
        if (sec) { k.s = Math.min(86400, k.s + sec); dirty.add(id); }
      }
      const st = K.state(k, now);
      if (st.why !== (lastWhy.get(id) ?? st.why)) changed = true;
      lastWhy.set(id, st.why);
      if (dirty.has(id) && (changed || now - (saved.get(id) || 0) >= SAVE_MS)) save(u);
      for (const s of socks) {
        if (changed || !s.data.kidAt || (playing(s) && now - s.data.kidAt >= PUSH_MS)) { s.data.kidAt = now; s.emit('kid:state', view(u, s)); }
      }
      enforce(u, st, socks, now);
    }
  }
  setInterval(tick, TICK).unref();

  /** 잠겼으면 게임 시작을 막고 화면에 알려요 (server.js: 방 만들기 · 들어가기 · 빠른 참가 · 한 판 더 · 시작) */
  function block(socket, quiet) {
    const u = A.ready() && kidOf(socket);
    if (!u) return false;
    K.roll(u.kid, Date.now());
    const st = K.state(u.kid, Date.now());
    if (!st.why) return false;
    if (!quiet) socket.emit('kid:block', view(u, socket));
    return true;
  }
  /** 남아 있던 저장 — 계정 저장(ACC.flush · flushSync)을 부를 때 먼저 (서버를 끄기 전 · 새 버전으로 갈아탈 때 lib/handoff.js) */
  function flush() { for (const id of [...dirty]) { const u = A.users.get(id); if (u) save(u); else dirty.delete(id); } }
  const flush0 = acc.flush, flushSync0 = acc.flushSync;
  acc.flush = (...a) => { flush(); return flush0(...a); };
  acc.flushSync = (...a) => { flush(); return flushSync0(...a); };

  /* ───────── 기기 키 ───────── */
  function issue(u) {
    const t = crypto.randomBytes(18).toString('base64url'), h = sha(t), now = Date.now();
    u.kid.devs.push({ h, at: now, last: now });
    while (u.kid.devs.length > K.MAX_DEVS) { const old = u.kid.devs.shift(); if (devs.get(old.h) === u.id) devs.delete(old.h); }
    devs.set(h, u.id);
    save(u);
    return t;
  }
  /** 기기 키의 주인 — 표에 없으면 계정들에서 한 번 더 찾아요 (새 버전으로 갈아타는 사이 옛 서버가 준 키) */
  function devOwner(h) {
    const id = devs.get(h), u = id && A.users.get(id);
    if (u && u.kid.on && u.kid.devs.some(d => d.h === h)) return u;
    if (id) devs.delete(h);
    for (const x of A.users.values()) if (x.kid.on && x.kid.devs.some(d => d.h === h)) { devs.set(h, x.id); return x; }
    return null;
  }
  function forget(u) {
    for (const d of u.kid.devs) if (devs.get(d.h) === u.id) devs.delete(d.h);
    u.kid.devs = [];
  }

  /* ───────── 최고 운영자 화면에 보여 줄 것 ───────── */
  function row(u) {
    const now = Date.now(), socks = socketsOf(u);
    if (u.kid.on) K.roll(u.kid, now);
    return { ...A.pub(u), seen: u.seen, on: socks.length > 0, play: socks.some(playing),
      k: { on: u.kid.on, wd: u.kid.wd, we: u.kid.we, from: u.kid.from, to: u.kid.to, by: u.kid.by, at: u.kid.at }, st: K.state(u.kid, now), devs: u.kid.devs.length };
  }
  const hist = u => {
    const today = K.dayKey(), m = new Map(u.kid.h);
    if (u.kid.d === today) m.set(today, u.kid.s);
    const out = [];
    for (let i = 6; i >= 0; i--) { const d = K.dayKey(Date.now() - i * K.DAY); out.push([d, m.get(d) || 0]); }
    return out;
  };
  const toMin = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(K.MAX_MIN, n) : 0; };
  const hmOk = v => typeof v === 'string' && K.parseHM(v) >= 0;

  function attach(socket, on) {
    const reply = (cb, d) => { if (typeof cb === 'function') cb(d); };
    socket.on('disconnect', () => unguest(socket));

    /** 화면이 켜질 때 · 로그인 · 로그아웃할 때: 지금 걸린 키즈 모드 (k: 이 기기에 기억한 기기 키) */
    on('kid:hello', (d, cb) => {
      if (!A.ready()) return reply(cb, { ok: false, why: 'loading' });
      if (!lim.hello(socket.id)) return reply(cb, { ok: false, why: 'limit' });
      const k = d && typeof d.k === 'string' && d.k.length <= 64 ? d.k : '', h = k ? sha(k) : '';
      unguest(socket);
      const now = Date.now();
      if (socket.data.uid) {
        const u = A.users.get(socket.data.uid);
        if (!u || !u.kid.on) return reply(cb, { ok: true, on: false, drop: !!h && !devOwner(h) });
        K.roll(u.kid, now);
        kids.add(u.id);
        let key = null;
        if (!h || devOwner(h) !== u) key = issue(u);                             // 이 기기를 기억해요
        else { const dv = u.kid.devs.find(x => x.h === h); if (dv) dv.last = now; }
        socket.data.kidAt = now;
        return reply(cb, { ok: true, on: true, key, st: view(u, socket) });
      }
      const g = h && devOwner(h);
      if (!g) return reply(cb, { ok: true, on: false, drop: !!h });
      K.roll(g.kid, now);
      kids.add(g.id);
      socket.data.kidDev = g.id;
      if (!guests.has(g.id)) guests.set(g.id, new Set());
      guests.get(g.id).add(socket);
      const dv = g.kid.devs.find(x => x.h === h); if (dv) dv.last = now;
      socket.data.kidAt = now;
      reply(cb, { ok: true, on: true, st: view(g, socket) });
    });

    /* ── 최고 운영자 ── */
    const owner = cb => {
      if (!A.ready()) { reply(cb, { ok: false, why: 'loading' }); return null; }
      const u = socket.data.uid && A.users.get(socket.data.uid);
      if (!u) { reply(cb, { ok: false, why: 'login' }); return null; }
      if (u.role !== 'owner') { reply(cb, { ok: false, why: 'noperm' }); return null; }
      if (!lim.act(socket.id)) { reply(cb, { ok: false, why: 'limit' }); return null; }
      return u;
    };
    const target = (d, cb) => {
      const t = d && typeof d.uid === 'string' && A.users.get(d.uid);
      if (!t) { reply(cb, { ok: false, why: 'nouser' }); return null; }
      if (t.role === 'owner') { reply(cb, { ok: false, why: 'kidowner' }); return null; }
      return t;
    };
    on('kid:list', (_, cb) => {
      if (!owner(cb)) return;
      const list = [...kids].map(id => A.users.get(id)).filter(u => u && u.kid.on).map(row)
        .sort((a, b) => (b.play - a.play) || (b.on - a.on) || a.name.localeCompare(b.name, 'ko'));
      reply(cb, { ok: true, list });
    });
    on('kid:get', (d, cb) => {
      if (!owner(cb)) return;
      const t = target(d, cb); if (!t) return;
      reply(cb, { ok: true, u: row(t), hist: hist(t) });
    });
    /** 켜기 · 바꾸기 · 끄기 { uid, on, wd, we, from, to } */
    on('kid:set', (d, cb) => {
      const me = owner(cb); if (!me) return;
      const t = target(d, cb); if (!t) return;
      const k = t.kid, was = k.on, now = Date.now();
      if (d.on !== true) {
        if (!was) return reply(cb, { ok: true, u: row(t) });
        k.on = false; k.by = me.name; k.at = now;
        forget(t); kids.delete(t.id); lastWhy.delete(t.id);
        save(t);
        adm.note(me, 'kid', `${t.name} 님 키즈 모드 끔`);
        for (const s of socketsOf(t)) s.emit('kid:state', { on: false, drop: true, msg: '키즈 모드가 꺼졌어요. 이제 시간 제한 없이 할 수 있어요.' });
        for (const s of [...(guests.get(t.id) || [])]) unguest(s);
        return reply(cb, { ok: true, u: row(t) });
      }
      let from = hmOk(d.from) ? d.from : '', to = hmOk(d.to) ? d.to : '';
      if (!from || !to || from === to) { from = ''; to = ''; }
      Object.assign(k, { on: true, wd: toMin(d.wd), we: toMin(d.we), from, to, by: me.name, at: now });
      K.roll(k, now);
      kids.add(t.id);
      save(t);
      const desc = K.ruleText(k);
      adm.note(me, 'kid', `${t.name} 님 키즈 모드 ${was ? '바꿈' : '켬'}: ${desc}`);
      push(t, was ? `⏳ 키즈 모드가 바뀌었어요 — ${desc}` : `⏳ 최고 운영자가 키즈 모드를 켰어요 — ${desc}`);
      tick0(t);
      reply(cb, { ok: true, u: row(t) });
    });
    /** 오늘만 더 주기 { uid, min } (+5 ~ +240분 · 하루에 모두 12시간까지) */
    on('kid:bonus', (d, cb) => {
      const me = owner(cb); if (!me) return;
      const t = target(d, cb); if (!t) return;
      if (!t.kid.on) return reply(cb, { ok: false, why: 'kidoff' });
      const min = Math.round(Number(d.min));
      if (!(min >= 5 && min <= 240)) return reply(cb, { ok: false, why: 'bad' });
      K.roll(t.kid, Date.now());
      t.kid.b = Math.min(K.MAX_BONUS, t.kid.b + min);
      save(t);
      adm.note(me, 'kid', `${t.name} 님 오늘만 +${K.fmtMin(min)}`);
      push(t, `🎁 오늘만 ${K.fmtMin(min)} 더 할 수 있어요!`);
      tick0(t);
      reply(cb, { ok: true, u: row(t) });
    });
    /** 오늘은 그만 (지금 잠그기 · v: false 면 풀기) */
    on('kid:stop', (d, cb) => {
      const me = owner(cb); if (!me) return;
      const t = target(d, cb); if (!t) return;
      if (!t.kid.on) return reply(cb, { ok: false, why: 'kidoff' });
      K.roll(t.kid, Date.now());
      t.kid.stop = d.v !== false;
      save(t);
      adm.note(me, 'kid', `${t.name} 님 ${t.kid.stop ? '오늘은 그만 (잠금)' : '잠금 풂'}`);
      push(t, t.kid.stop ? '🔒 최고 운영자가 오늘 게임을 잠갔어요.' : '🔓 게임 잠금이 풀렸어요.');
      tick0(t);
      reply(cb, { ok: true, u: row(t) });
    });
  }
  /** 설정을 바꾼 뒤 바로 한 번: 잠겼으면 방에서 나가기 등 (시간은 세지 않아요) */
  function tick0(u) {
    const now = Date.now(), st = K.state(u.kid, now);
    lastWhy.set(u.id, st.why);
    enforce(u, st, socketsOf(u), now);
  }

  return { attach, block, flush, _test: { tick, kids, devs, guests, kidOf } };
};
