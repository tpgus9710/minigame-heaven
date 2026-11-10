'use strict';
/**
 * 🔄 새 버전으로 갈아타기 (Render 무중단 배포 · 클라우드에서만)
 *
 *  Render 는 새 버전 서버가 준비되면 새 접속을 새 서버로 보내고, 1분 뒤 옛 서버에 SIGTERM 을 보내요.
 *  옛 서버는 그 뒤로 render.yaml 의 maxShutdownDelaySeconds(300초)까지 더 살아 있을 수 있어요. 이 시간 동안
 *   - 게임 중인 방은 그대로 끝까지 하고, 판이 끝나 대기실로 돌아오면 그 방 사람들을 새 서버로 옮겨요.
 *   - 대기실 · 메뉴에 있는 사람은 바로 옮겨요 (싱글 게임 중이면 화면이 끝난 뒤에 옮겨요).
 *   - 새 게임은 시작하지 않아요. 시간이 다 되면 남은 판은 거기서 끝내고 옮겨요.
 *  새 서버가 떴는지는 바깥 주소의 /health 가 알려 주는 부팅 번호(boot)가 '나보다 나중에 켜진 서버'인지로 알아요.
 *  SIGTERM 을 받으면 2초마다 확인해요 (평소에는 확인하지 않아요 — 무료 서버 데이터 사용량을 아끼려고.
 *  환경 변수 SUCC_POLL_MS 를 주면 평소에도 그 간격으로 확인해서 SIGTERM 보다 1분 먼저 옮기기 시작해요).
 *  새 서버가 끝내 안 보이면(Render 가 그냥 다시 켜는 경우) 옮기지 않고, 하던 판만 기다렸다가 꺼요.
 *
 *  옮기기: 서버가 서명한 '이사 표'(방 코드 · 게임 · 옵션 · 비공개 · 방장 · 칩 · 계정)를 주면 화면이 새로 고쳐지고,
 *  새 서버에서 그 표(room:rejoin)로 같은 방에 다시 모여요. 먼저 온 사람이 방을 다시 만들고, 원래 방장이 오면 방장을 돌려줘요.
 *  표는 10분 동안 한 번만 쓸 수 있고, 서명 열쇠는 두 서버가 함께 가진 비밀 환경 변수(ADMIN_KEY · DATABASE_URL)로 만들어요.
 */
const crypto = require('crypto');
const http = require('http'), https = require('https');

const TTL = 10 * 60000;
const SUCC_WAIT = 20000;                                           // SIGTERM 뒤 새 서버를 찾아보는 시간 (하던 판이 없을 때)
const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = function makeHandoff({ io, rooms, H, ACC, REGISTRY, cloud, boot, publicUrl, makeRoom, addPlayer, leaveRoom, genCode, log = console.log }) {
  const SECRET = String(process.env.MOVE_SECRET || process.env.ADMIN_KEY || process.env.DATABASE_URL || '');
  const KEY = crypto.createHash('sha256').update('mg-move|' + (SECRET || process.env.RENDER_SERVICE_ID || 'local')).digest();
  const STRONG = SECRET.length >= 8;                               // 비밀 열쇠가 있을 때만 칩까지 옮겨요
  const DRAIN_MAX = Math.max(20, Math.min(290, Number(process.env.DRAIN_MAX_S) || 280)) * 1000;   // SIGTERM 뒤 최대 (300초보다 조금 짧게 — 저장할 시간)
  const POLL_MS = Number(process.env.SUCC_POLL_MS) > 0 ? Math.max(1000, Number(process.env.SUCC_POLL_MS)) : 0;   // 0 = 평소에는 확인 안 함
  const used = new Map();                                          // 쓴 표 → 만료 시각
  const moving = new Set();                                        // 옮기는 중인 방 (저장을 기다리는 중)
  const D = { on: false, at: 0, sig: 0, succ: false, ticks: 0, timer: null, exiting: false };

  /* ───────── 이사 표 ───────── */
  const mac = body => crypto.createHmac('sha256', KEY).update(body).digest('base64url');
  function sign(p) {
    const body = Buffer.from(JSON.stringify({ v: 1, j: crypto.randomBytes(9).toString('base64url'), e: Date.now() + TTL, ...p })).toString('base64url');
    return body + '.' + mac(body);
  }
  function verify(t) {
    if (typeof t !== 'string' || t.length > 6000) return null;
    const [body, m] = t.split('.');
    if (!body || !m) return null;
    const want = mac(body);
    if (m.length !== want.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(want))) return null;
    let p;
    try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
    if (!p || p.v !== 1 || typeof p.j !== 'string' || !(p.e > Date.now()) || typeof p.c !== 'string' || typeof p.g !== 'string') return null;
    return p;
  }
  setInterval(() => { const now = Date.now(); for (const [j, e] of used) if (e < now) used.delete(j); }, 60000).unref();

  /* ───────── 옛 서버: 방 옮기기 ───────── */
  function moveRoom(room, why) {
    if (room.moved) return Promise.resolve();
    room.moved = true;
    const job = moveRoom0(room, why).finally(() => moving.delete(job));
    moving.add(job);
    return job;
  }
  async function moveRoom0(room, why) {
    try { await Promise.race([ACC.flush(), wait(3000)]); } catch { /* 저장은 계속 다시 시도돼요 */ }   // 새 서버가 최신 기록을 읽게 먼저 저장
    if (rooms.get(room.code) !== room) return;
    const rid = room.rid || crypto.randomBytes(6).toString('base64url');
    let n = 0;
    for (const p of room.players) {
      const s = io.sockets.sockets.get(p.id);
      if (!s) continue;                                            // 연결이 끊긴 채 자리만 있던 사람은 방 코드로 다시 들어와요
      const ticket = sign({ rid, c: room.code, g: room.gameType, o: room.options, pv: !!room.private, h: !!p.isHost,
        ...(STRONG ? { ch: p.chips } : {}), u: p.uid || null, n: p.name });
      s.leave(room.code); s.data.code = null; s.data.moveSent = true;
      s.emit('server:move', { ticket, code: room.code, why });
      n++;
    }
    H.stopTimers(room);
    rooms.delete(room.code);
    log(`   🔄 방 ${room.code} (${room.gameType}) ${n}명 → 새 버전`);
  }
  function moveIdle() {
    for (const room of [...rooms.values()]) if (!room.isStarted) moveRoom(room, 'idle');
    for (const s of io.sockets.sockets.values()) {
      if (s.data.code || s.data.moveSent) continue;
      s.data.moveSent = true;
      s.emit('server:move', { why: 'idle' });                       // 방에 없는 사람: 화면이 한가할 때 새로 고쳐요
    }
  }
  const busy = () => [...rooms.values()].filter(r => r.isStarted && !r.moved);

  /* ───────── 옛 서버: 갈아타기 시작 · 끝 ───────── */
  function start(reason) {
    if (D.on || !cloud) return;
    D.on = true; D.at = Date.now();
    if (ACC.setDraining) ACC.setDraining(true);
    log(`🔄 새 버전으로 갈아타는 중 (${reason}) — 게임 중인 방 ${busy().length}개는 판이 끝나면 옮겨요`);
    io.emit('server:drain', { at: D.at });
    D.timer = setInterval(tick, 1000);
    if (!D.succ) poll();
  }
  function onSuccessor() {
    if (D.succ) return;
    D.succ = true;
    log('🔄 새 서버가 떴어요 — 대기실 · 메뉴에 있는 사람부터 옮겨요');
    moveIdle();
  }
  function tick() {
    if (!D.on || D.exiting) return;
    D.ticks++;
    if (!D.succ && D.ticks % 2 === 0) poll();
    if (D.succ) moveIdle();
    if (!D.sig) return;                                            // SIGTERM 전에는 끄지 않아요 (Render 가 곧 보내요)
    const since = Date.now() - D.sig, late = since > DRAIN_MAX;
    if (late) {
      for (const room of busy()) {
        H.sys(room, '⏰ 새 버전으로 옮길 시간이 다 돼서 이번 판은 여기서 끝나요.');
        if (D.succ) moveRoom(room, 'late');
      }
    }
    // 하던 판이 다 끝났으면 꺼요 — 새 서버를 아직 못 찾았으면 20초까지는 찾아보고 (대기실 · 메뉴 사람도 옮겨 주려고)
    if (late || (!busy().length && (D.succ || since > SUCC_WAIT))) exit(late ? 'late' : D.succ ? 'done' : 'nosucc');
  }
  async function exit(why) {
    if (D.exiting) return;
    D.exiting = true;
    clearInterval(D.timer);
    log(`🔄 옛 서버를 꺼요 (${why === 'late' ? '시간이 다 됨' : why === 'nosucc' ? '새 서버가 안 보임' : '모든 판이 끝남'} · ${Math.round((Date.now() - D.at) / 1000)}초 걸림)`);
    await Promise.race([Promise.all([...moving]), wait(5000)]);    // 옮기는 중인 방이 표를 다 받을 때까지
    await wait(1500);                                              // 방금 보낸 '옮기기'가 화면에 닿게
    try { await Promise.race([ACC.flush(), wait(4000)]); } catch { /* 무시 */ }
    process.exit(0);
  }
  /** SIGTERM: 클라우드면 갈아타기 (true), 아니면 false → 원래처럼 바로 저장하고 꺼요 */
  function onSigterm() {
    if (!cloud) return false;
    if (D.sig) return true;
    D.sig = Date.now();
    try { if (ACC.flushSync) ACC.flushSync(); ACC.flush().catch(() => {}); } catch { /* 무시 */ }
    start('SIGTERM');
    return true;
  }

  /* ───────── 새 서버가 떴나요? (바깥 주소의 /health 부팅 번호) ───────── */
  /** 부팅 번호 = 켜진 시각(36진수) + '.' + 무작위. 내 것보다 나중에 켜진 서버인가요? */
  const bootTime = b => (typeof b === 'string' && /^[0-9a-z]+\.[0-9a-z]+$/.test(b) ? parseInt(b.split('.')[0], 36) : NaN);
  const newer = b => b !== boot && bootTime(b) > bootTime(boot);
  function poll() {
    const url = publicUrl();
    if (!url || D.exiting) return;
    let req;
    try {
      req = (url.startsWith('https') ? https : http).get(url + '/health?b=' + Date.now(), { timeout: 4000, headers: { 'cache-control': 'no-cache' } }, r => {
        let s = '';
        r.setEncoding('utf8');
        r.on('data', c => { if (s.length < 4000) s += c; });
        r.on('end', () => {
          let j = null;
          try { j = JSON.parse(s); } catch { return; }
          if (!j || !j.ok || !newer(j.boot)) return;                // 바깥 주소가 나보다 나중에 켜진 서버로 가면 = 새 버전이 떴어요
          if (!D.on) start('새 서버 확인');                          // (새 서버가 막 켜져 아직 옛 서버로 가는 동안에는 더 오래된 번호라 무시해요)
          onSuccessor();
        });
      });
    } catch { return; }
    req.on('timeout', () => req.destroy());
    req.on('error', () => {});
  }
  if (cloud && POLL_MS) setInterval(poll, POLL_MS).unref();

  /* ───────── server.js 가 부르는 곳 ───────── */
  /** 게임 시작 막기 (갈아타는 중) → true 면 시작하지 않아요 */
  function blockStart(room, say) {
    if (!D.on) return false;
    say('🔄 새 버전으로 옮기는 중이에요 — 잠깐 뒤 새 버전에서 시작해 주세요.');
    if (D.succ) moveRoom(room, 'start');
    return true;
  }
  /** 방 만들기 · 들어가기 (갈아타는 중 · 새 서버가 떴으면) → 새 서버로 보내요 */
  function redirect(socket) {
    if (!D.on || !D.succ) return false;
    socket.data.moveSent = true;
    socket.emit('server:move', { why: 'join' });
    return true;
  }
  /** 대기실로 돌아온 방 (판이 끝남) → 갈아타는 중이면 옮겨요 */
  function afterLobby(room) { if (D.on && D.succ && !room.isStarted && rooms.get(room.code) === room) moveRoom(room, 'lobby'); }

  /* ───────── 새 서버: 이사 표로 같은 방에 다시 모이기 ───────── */
  function applyOptions(room, o) {
    if (!o || typeof o !== 'object') return;
    if (['2card', '3card'].includes(o.seotdaType)) room.options.seotdaType = o.seotdaType;
    if (['5card', '7card'].includes(o.pokerType)) room.options.pokerType = o.pokerType;
    for (const opt of REGISTRY[room.gameType].options || []) {
      const v = o[opt.key];
      if (opt.values.some(([x]) => String(x) === String(v))) room.options[opt.key] = Number.isNaN(+v) ? v : +v;
    }
  }
  function attach(socket, on) {
    on('room:rejoin', d => {
      const t = verify(d && d.ticket);
      const fail = why => socket.emit('server:rejoined', { ok: false, why });
      if (!t) return fail('bad');
      if (used.has(t.j)) return fail('used');
      if (!REGISTRY[t.g]) return fail('bad');
      used.set(t.j, t.e);
      const same = !t.u || socket.data.uid === t.u;                  // 로그인한 사람의 표는 같은 계정일 때만 칩 · 방장을 돌려줘요
      let room = rooms.get(t.c);
      if (room && room.rid !== t.rid) room = [...rooms.values()].find(r => r.rid === t.rid) || null;
      if (room) {
        if (room.players.some(p => p.id === socket.id)) return socket.emit('server:rejoined', { ok: true, code: room.code });
        if (room.isStarted) return fail('started');
        if (room.players.length >= REGISTRY[room.gameType].max) return fail('full');
        leaveRoom(socket);
        addPlayer(room, socket, t.n);
      } else {
        leaveRoom(socket);
        room = makeRoom(rooms.has(t.c) ? genCode() : t.c, t.g);
        room.rid = t.rid; room.private = !!t.pv;
        applyOptions(room, t.o);
        rooms.set(room.code, room);
        addPlayer(room, socket, t.n);
      }
      const p = room.players.find(x => x.id === socket.id);
      if (p && same) {
        if (STRONG && Number.isFinite(t.ch)) p.chips = Math.max(0, Math.min(1e12, Math.floor(t.ch)));
        if (t.h && !p.isHost) {
          for (const x of room.players) { if (x.isHost) { x.isHost = false; x.isReady = false; } }
          p.isHost = true; p.isReady = true;
        }
      }
      H.pushRoom(room);
      socket.emit('server:rejoined', { ok: true, code: room.code });
    });
  }

  return { attach, onSigterm, blockStart, redirect, afterLobby, draining: () => D.on, _test: { sign, verify, D, moveRoom, start, onSuccessor, bootTime, newer } };
};
