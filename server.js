'use strict';
/* =========================================================================
 *  🎮 미니게임 천국 — 게임 서버 (server.js)
 *
 *  실행 :  npm install   →   node server.js     (또는 start.bat 더블클릭)
 *  접속 :  http://localhost:3000
 *  인터넷 공개 :  node server.js --online   (또는 start-online.bat) → https://xxxx.trycloudflare.com 주소가 생겨요
 *  클라우드 배포 :  Render 등에 올리면 PORT · RENDER_EXTERNAL_URL 을 자동으로 읽어요 (DEPLOY.md 참고)
 *                  KEEP_AWAKE=1 이면 10분마다 자기 주소를 불러서 무료 서버가 잠들지 않게 해요
 *  계정 저장   :  DATABASE_URL(무료 PostgreSQL 주소)이 있으면 DB에, 없으면 userdata/accounts.json 에 저장해요
 *
 *  폴더 구조
 *    server.js        방 만들기·입장·채팅 같은 공통 기능
 *    lib/             공통 도구 (accounts.js = 얼굴 로그인 · 기록 · 친구, store.js = 계정 저장소)
 *    data/            단어 목록
 *    games/*.js       게임 하나당 파일 하나 (멀티 51종, 보드·카드 게임은 games/table.js 하나로)
 *    public/          화면 (index.html, style.css, js/*.js)
 * ========================================================================= */
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { Server } = require('socket.io');
const makeHelpers = require('./lib/helpers');

const PORT = Number(process.env.PORT) || 3000;
const ONLINE = process.argv.includes('--online') || process.env.ONLINE === '1';    // 내 PC를 인터넷에 공개 (start-online.bat)
const CLOUD = !!(process.env.RENDER || process.env.PUBLIC_URL);                    // 클라우드 서버(Render 등)에서 실행 중
const KEEP_AWAKE = process.env.KEEP_AWAKE === '1';                                    // 클라우드 무료 서버가 15분 쉬면 잠드는 것 막기
let publicUrl = String(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
// 인터넷에 공개된 서버를 지키는 한도 (환경 변수로 바꿀 수 있어요)
const LIMITS = {
  clients: Number(process.env.MAX_CLIENTS) || 400,   // 동시 접속 전체
  perIp: Number(process.env.MAX_PER_IP) || 50,        // 한 IP(한 집·한 학교)에서 동시 접속
  rooms: Number(process.env.MAX_ROOMS) || 200,        // 동시에 열린 방
  eventsPerSec: 150,                                  // 한 사람이 1초에 보내는 메시지 (넘치면 무시)
};

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);
// 연결이 잠깐 끊겨도 (휴대폰 · 태블릿에서 다른 앱으로 넘어감, 와이파이 끊김) 이 시간 안에 돌아오면 같은 자리로 이어서 해요
const AWAY_GAME_MS = Number(process.env.RECONNECT_MS) || 180000;          // 게임 중: 3분
const AWAY_LOBBY_MS = Math.min(AWAY_GAME_MS, Number(process.env.RECONNECT_LOBBY_MS) || 45000);   // 대기실: 45초 (방장이 오래 비우면 다른 사람이 못 시작해서)
const io = new Server(server, { pingTimeout: 20000, maxHttpBufferSize: 64 * 1024,
  // socket.io 연결 복구: 다시 연결되면 같은 id · 같은 방으로 돌아오고, 그동안 놓친 메시지도 받아요
  // (자리는 아래 타이머가 정확히 AWAY 시간에 빼요. 복구 정보는 1분 더 넉넉히 둬서 '자리가 없어졌어요' 안내까지 할 수 있게)
  connectionStateRecovery: { maxDisconnectionDuration: AWAY_GAME_MS + 60000, skipMiddlewares: false } });
// 조용한 대기실에서도 복구가 되도록 50초마다 아주 작은 신호를 보내요 (화면이 마지막으로 받은 메시지 번호가 너무 오래되지 않게)
setInterval(() => io.emit('hb'), 50000).unref();
// 실시간 게임이 1초에 수십 번 보내는 움직임 정보는 복구용으로 보관하지 않아요 (똑같이 바로 보내요).
// 몇 분치를 쌓아 두면 메모리를 많이 쓰고, 돌아온 사람에게 지난 움직임을 한꺼번에 다시 보내 화면이 버벅여요 → 돌아오면 다음 최신 상태부터 받아요
const STREAM_EVENTS = new Set(['bomb:s', 'dodge:tick', 'kt:sts', 'plat:ghosts', 'pong:state', 'snake:state', 'tank:pos', 'tank:aim', 'volley:s']);
{
  const ad = io.of('/').adapter, plain = Object.getPrototypeOf(Object.getPrototypeOf(ad) || {});
  if (ad && Array.isArray(ad.packets) && plain && typeof plain.broadcast === 'function') {
    const keep = ad.broadcast.bind(ad);
    ad.broadcast = (packet, opts) => (packet && Array.isArray(packet.data) && STREAM_EVENTS.has(packet.data[0])
      ? plain.broadcast.call(ad, packet, opts) : keep(packet, opts));
  }
}
// 같은 화면이 다시 연결했는데 서버는 예전 연결이 아직 살아 있다고 알 때 → 예전 연결을 정리하고 한 번 더 연결하게 해요
const quietAway = new Set();                         // 이렇게 정리한 예전 연결 (채팅에 '끊겼어요'를 남기지 않아요)
const takeovers = new Map();                         // 복구 정보 → 최근 정리한 시각들 (같은 탭을 복제해서 서로 뺏는 일 막기)
function takeoverOk(pid) {
  const now = Date.now(), list = (takeovers.get(pid) || []).filter(t => now - t < 60000);
  if (list.length >= 3) return false;
  list.push(now); takeovers.set(pid, list);
  if (takeovers.size > 500) for (const [k, v] of takeovers) if (now - v[v.length - 1] > 60000) takeovers.delete(k);
  return true;
}
let compression = null;
try { compression = require('compression'); } catch { /* 예전 node_modules 그대로면 압축 없이 */ }
if (compression) app.use(compression());           // 화면 파일을 압축해서 보내요 (무료 서버 데이터 한도 아끼기)
// 얼굴 인식 모델 · 실행기는 크고 바뀌지 않아서 브라우저가 오래 보관하게 해요 (폴더 이름에 버전이 들어 있어요)
app.use(['/vendor', '/models'], (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); next(); });
app.use(express.static(path.join(__dirname, 'public')));
const APP_VERSION = (() => { try { return require('./package.json').version; } catch { return ''; } })();   // 패치 버전 (화면 왼쪽 아래 · 메뉴에도 보여요)
app.get('/health', (req, res) => res.json({ ok: true, version: APP_VERSION, rooms: rooms.size, players: io.engine.clientsCount, accounts: ACC.status() }));   // 클라우드 상태 확인용

// 🛡️ 어떤 오류가 나도 서버가 꺼지지 않게 (로그만 남김)
process.on('uncaughtException', e => console.error('⚠️  처리되지 않은 오류 (서버는 계속 실행됩니다):', e));
process.on('unhandledRejection', e => console.error('⚠️  처리되지 않은 비동기 오류 (서버는 계속 실행됩니다):', e));

/* ─────────────────────────── 게임 모듈 등록 ─────────────────────────── */
const rooms = new Map();
let REGISTRY = {};                                   // 게임 키 → { name, min, max, roles, mod }
const moduleOf = room => (REGISTRY[room.gameType] || {}).mod;
const H = makeHelpers(io, rooms, moduleOf);
// 계정 · 기록 · 친구 (게임 모듈보다 먼저 만들어야 게임이 끝날 때 기록돼요)
const ACC = require('./lib/accounts')({ io, rooms, H, registry: () => REGISTRY, ipOf: s => ipOf(s), cloud: CLOUD });
// 운영자 · 전체 공지 (환경 변수 ADMIN_KEY 로 최고 운영자 인증)
const ADM = require('./lib/admin')({ io, rooms, acc: ACC, limiter: ACC._int.limiter });
// 버그 · 불편 신고함 (운영자만 볼 수 있어요)
const REP = require('./lib/report')({ io, rooms, acc: ACC, limiter: ACC._int.limiter });
/** 화면 파일 버전: 패치로 화면 파일이 바뀌면 값이 달라져요 → 열려 있던 화면에 '새로 고침' 안내 (서버만 다시 켜진 것은 그대로) */
const BUILD = (() => {
  const h = crypto.createHash('sha1');
  const walk = dir => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { if (f.name !== 'vendor' && f.name !== 'models') walk(p); }
      else if (/\.(js|css|html)$/.test(f.name)) h.update(f.name).update(fs.readFileSync(p));
    }
  };
  try { walk(path.join(__dirname, 'public')); return h.digest('hex').slice(0, 12); } catch { return 'dev'; }
})();

const MODULES = [
  'cards', 'apple', 'race', 'catch', 'liar', 'tetris', 'omok', 'pong',
  'mine', 'g2048', 'snake', 'rain', 'bingo',
  'dodge', 'plat', 'volley', 'bomb', 'tank', 'onecard', 'halli', 'ox', 'word', 'setgame', 'mole', 'scorerace', 'kart', 'puzzle',
  'table',   // 차례형 보드·카드 게임들 (public/js/shared/*-core.js)
].map(name => require(`./games/${name}`)(H));
for (const mod of MODULES) for (const [key, info] of Object.entries(mod.games)) REGISTRY[key] = { ...info, mod };

const { getPlayer, participants, pushRoom, sys, endToLobby, stopTimers, cleanName, rand } = H;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 O/0, I/1 제외
  let c; do { c = Array.from({ length: 4 }, () => chars[rand(chars.length)]).join(''); } while (rooms.has(c));
  return c;
}

/* ─────────────────────────── 방 입장/퇴장 ─────────────────────────── */
function assignRole(room) {
  const roles = REGISTRY[room.gameType].roles;
  if (!roles) return null;
  return roles.find(r => !room.players.some(p => p.role === r)) || 'spectator';
}

function addPlayer(room, socket, rawName) {
  const acc = ACC.playerProps(socket);                 // 로그인했으면 계정 이름 · 레벨 · 아바타로
  const name = acc ? acc.name : cleanName(rawName);
  const isHost = room.players.length === 0;
  room.players.push({ id: socket.id, name, isHost, isReady: isHost, score: 0, chips: 1000000, role: assignRole(room), lastChat: 0,
    uid: acc ? acc.uid : null, lv: acc ? acc.lv : 0, av: acc ? acc.av : null, color: acc ? acc.color : null, op: acc ? acc.op : '', fr: acc ? acc.fr : -1, tt: acc ? acc.tt : '' });
  socket.join(room.code);
  socket.data.code = room.code;
  socket.emit('joined', { code: room.code, myId: socket.id });
  sys(room, `👋 ${name} 님이 들어왔습니다.`);
  pushRoom(room);
  ACC.touch(socket);
}

function leaveRoom(socket) {
  const room = rooms.get(socket.data.code);
  socket.data.code = null;
  if (!room) return;
  socket.leave(room.code);
  ACC.touch(socket);
  dropPlayer(room, socket.id);
}
/** 방에서 사람 빼기 (나가기 · 연결이 끊긴 채 돌아오지 않음) */
function dropPlayer(room, id, msg) {
  const idx = room.players.findIndex(p => p.id === id);
  if (idx < 0) return;
  const [p] = room.players.splice(idx, 1);
  clearTimeout(p.awayTimer);

  if (!room.players.length) { stopTimers(room); rooms.delete(room.code); return; }
  if (p.isHost) {
    const next = room.players.find(x => !x.away) || room.players[0];            // 연결이 끊긴 사람보다 지금 있는 사람에게
    next.isHost = true; next.isReady = true; sys(room, `👑 ${next.name} 님이 새 방장이 되었습니다.`);
  }
  sys(room, msg || `🚪 ${p.name} 님이 나갔습니다.`);

  if (room.isStarted && room.game && !room.game.over) {
    const info = REGISTRY[room.gameType];
    if (info.mod.leave) info.mod.leave(room, p);
    if (room.isStarted && room.game && !room.game.over && participants(room).length < info.min) {
      endToLobby(room, '인원이 부족해서 게임이 종료되었습니다.');
    }
  }
  pushRoom(room);
}

/** 게임 시작 (방장이 누를 때 · 모두 '한 판 더'를 눌렀을 때). 시작 못 하면 이유를 say 로 알려요 */
function tryStart(room, say) {
  if (room.isStarted) return false;
  const info = REGISTRY[room.gameType];
  const parts = participants(room);
  if (info.requireRoles && !info.requireRoles.every(r => room.players.some(p => p.role === r))) { say(info.requireMsg); return false; }
  if (parts.length < info.min) { say(`${info.name}은(는) 최소 ${info.min}명이 필요해요.`); return false; }
  const notReady = parts.filter(p => !p.isHost && !p.isReady);
  if (notReady.length) { say(`아직 준비 안 한 사람: ${notReady.map(p => p.name).join(', ')}`); return false; }
  stopTimers(room);
  room.session++;
  room.isStarted = true;
  room.rematch = null;
  room.players.forEach(p => { p.score = 0; });
  ACC.onStart(room);                                   // 시작할 때 참가자 기억 (기록용)
  info.mod.start(room);
  pushRoom(room);
  return true;
}
/** 열린 방 목록에 보여 줄 방 (비공개 · 게임 중 · 가득 찬 방은 빼요) */
const joinable = room => !room.isStarted && !room.private && room.players.length > 0 && room.players.length < REGISTRY[room.gameType].max;
const kickedFrom = (room, socket) => !!room.kicked && (room.kicked.has(socket.id) || (!!socket.data.uid && room.kicked.has('u:' + socket.data.uid)));

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && (i.family === 'IPv4' || i.family === 4) && !i.internal).map(i => i.address);
}

const serverInfo = () => ({ lan: CLOUD ? [] : lanAddresses(), port: PORT, publicUrl, online: ONLINE || CLOUD, build: BUILD, version: APP_VERSION });

/* ─── 접속 한도: 인터넷에 공개해도 서버가 버티도록 ─── */
const perIp = new Map();
const ipOf = socket => {
  const h = socket.handshake.headers;
  return String(h['cf-connecting-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || socket.handshake.address || '').trim();
};
io.use((socket, next) => {
  if (io.engine.clientsCount > LIMITS.clients) return next(new Error('server-full'));
  const ip = ipOf(socket), n = perIp.get(ip) || 0;
  if (n >= LIMITS.perIp) return next(new Error('too-many'));
  perIp.set(ip, n + 1);
  socket.once('disconnect', () => { const k = (perIp.get(ip) || 1) - 1; if (k > 0) perIp.set(ip, k); else perIp.delete(ip); });
  next();
});

/* ═══════════════════════════ 소켓 이벤트 ═══════════════════════════ */
io.on('connection', socket => {
  let evCount = 0, evWindow = Date.now();
  const on = (ev, fn) => socket.on(ev, (...args) => {
    if (ev !== 'disconnect') {                                   // 도배 방지: 1초에 너무 많이 보내면 무시, 심하면 연결 끊기
      const now = Date.now();
      if (now - evWindow > 1000) { evWindow = now; evCount = 0; }
      if (++evCount > LIMITS.eventsPerSec) { if (evCount > LIMITS.eventsPerSec * 4) socket.disconnect(true); return; }
    }
    try { fn(...args); } catch (e) { console.error(`⚠️  [${ev}] 처리 중 오류:`, e); }
  });
  const toast = (msg, type = 'error') => socket.emit('toast', { msg, type });
  const reply = (cb, d) => { if (typeof cb === 'function') cb(d); };
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    return { room, me: room ? getPlayer(room, socket.id) : null };
  };

  socket.emit('serverInfo', serverInfo());
  // 연결 복구: 잠깐 끊겼다 돌아온 사람 → 맡아 둔 자리로 (socket.io 가 같은 id · 방 · data 를 되돌려 줘요)
  if (socket.recovered) {
    // 다 쓴 복구 정보는 지워요 (socket.io 는 남겨 두는데, 같은 정보로 또 들어오면 같은 id 연결이 둘이 돼서 꼬여요 → 아래 정리 과정으로)
    try { socket.nsp.adapter.sessions.delete(socket.pid); } catch { /* socket.io 내부가 바뀌었으면 그냥 둬요 */ }
    const room = rooms.get(socket.data.code), p = room && room.players.find(x => x.id === socket.id);
    if (p) {
      clearTimeout(p.awayTimer); p.awayTimer = null;
      if (p.away) {
        if (!p.awayQuiet) sys(room, `📶 ${p.name} 님이 다시 연결됐어요.`);
        p.away = 0; p.awayQuiet = false;
        const mod = moduleOf(room);                   // 차례형 게임: 짧아졌던 내 차례 시간을 원래대로
        if (room.isStarted && room.game && !room.game.over && mod && mod.back) { try { mod.back(room, p); } catch (e) { console.error('⚠️  복귀 처리 오류:', e); } }
      }
      ACC.resume(socket);
      pushRoom(room);
      socket.emit('resumed', { code: room.code, myId: socket.id, room: H.publicRoom(room), playing: !!(room.isStarted && room.game && !room.game.over) });
    } else if (socket.data.code) {                    // 너무 오래 끊겨서 자리가 없어졌어요 (또는 그사이 방장이 내보냄)
      const kicked = !!room && kickedFrom(room, socket);
      socket.leave(socket.data.code); socket.data.code = null;
      socket.emit(kicked ? 'kicked' : 'resumeFail', { code: room ? room.code : null });
    }
  } else if (typeof (socket.handshake.auth || {}).pid === 'string') {
    // 복구 정보를 들고 왔는데 복구가 안 됐어요. 서버가 예전 연결을 아직 살아 있다고 알고 있으면 (휴대폰이 잠깐 멈췄다 돌아옴 · 새로 고침)
    // 예전 연결을 정리해서 자리를 맡아 두고, 화면에게 한 번 더 연결해 달라고 해요. 아니면 자리가 없어졌다고 알려요.
    const pid = socket.handshake.auth.pid;
    const old = [...io.sockets.sockets.values()].find(s => s !== socket && s.pid === pid);
    if (old && old.data.code && rooms.has(old.data.code) && takeoverOk(pid)) {
      quietAway.add(old.id);
      old.conn.close(true);                           // 'forced close' → socket.io 가 복구 정보를 보관하고 아래 disconnect 에서 자리를 맡아 둬요
      quietAway.delete(old.id);
      socket.emit('resumeRetry');
    } else socket.emit('resumeFail');
  }
  ACC.attach(socket, on);                                                          // 계정 · 친구 이벤트 (acct:* · fr:*)
  ADM.attach(socket, on);                                                          // 운영자 · 전체 공지 (admin:* · notice:*)
  REP.attach(socket, on);                                                          // 신고함 (report:* · admin:report*)
  on('ping:t', (t, cb) => { if (typeof cb === 'function') cb(t); });              // 화면 위 지연 시간(ms) 표시용
  /** 초대 링크로 들어온 사람에게 방 정보 미리 보여주기 */
  on('peekRoom', (code, cb) => {
    if (typeof cb !== 'function') return;
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb(null);
    const info = REGISTRY[room.gameType];
    cb({ code: room.code, game: info.name, players: room.players.length, max: info.max, started: room.isStarted, host: (room.players.find(p => p.isHost) || {}).name || '' });
  });

  on('createRoom', d => {
    if (!d || !REGISTRY[d.gameType]) return toast('알 수 없는 게임입니다.');
    if (rooms.size >= LIMITS.rooms) return toast('지금은 열린 방이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    leaveRoom(socket);
    const room = {
      code: genCode(), gameType: d.gameType, options: { seotdaType: '2card', pokerType: '5card' },
      players: [], isStarted: false, game: null, timers: new Set(), loop: null, session: 0,
    };
    for (const o of REGISTRY[d.gameType].options || []) room.options[o.key] = o.def;   // 보드게임 옵션 기본값 (봇 수 · 시간 등)
    rooms.set(room.code, room);
    addPlayer(room, socket, d.playerName);
  });

  on('joinRoom', d => {
    const room = rooms.get(String((d && d.roomCode) || '').toUpperCase().trim());
    if (!room) return toast('존재하지 않는 방 코드입니다.');
    if (room.players.some(p => p.id === socket.id)) return;
    if (room.isStarted) return toast('이미 게임이 진행 중인 방입니다. 끝난 뒤 다시 들어와 주세요.');
    if (room.players.length >= REGISTRY[room.gameType].max) return toast('방이 가득 찼습니다.');
    if (kickedFrom(room, socket)) return toast('방장이 내보낸 방이라 다시 들어갈 수 없어요.');
    leaveRoom(socket);
    addPlayer(room, socket, d.playerName);
  });

  /* ── 열린 방 목록 · 빠른 참가 ── */
  on('rooms:list', (_, cb) => {
    if (typeof cb !== 'function') return;
    const open = [];
    let playing = 0;
    for (const room of rooms.values()) {
      if (room.private || !room.players.length) continue;
      if (room.isStarted) { playing++; continue; }
      if (!joinable(room)) continue;
      const info = REGISTRY[room.gameType], host = room.players.find(p => p.isHost) || room.players[0];
      open.push({ code: room.code, game: room.gameType, n: room.players.length, max: info.max, min: info.min,
        host: host.name, lv: host.lv || 0, av: host.av ?? null, color: host.color ?? null, uid: host.uid || null, mine: room.code === socket.data.code });
    }
    open.sort((a, b) => (b.n >= b.min) - (a.n >= a.min) || b.n - a.n);     // 곧 시작할 수 있는 방 · 사람 많은 방부터
    cb({ open: open.slice(0, 60), more: Math.max(0, open.length - 60), playing });
  });
  on('rooms:quick', (d, cb) => {
    const want = d && typeof d.game === 'string' && REGISTRY[d.game] ? d.game : null;
    let best = null;
    for (const room of rooms.values()) {
      if (!joinable(room) || room.code === socket.data.code || (want && room.gameType !== want) || kickedFrom(room, socket)) continue;
      if (!best || room.players.length > best.players.length) best = room;
    }
    if (!best) return reply(cb, { ok: false });
    leaveRoom(socket);
    addPlayer(best, socket, d && d.playerName);
    reply(cb, { ok: true, code: best.code, game: best.gameType });
  });
  /** 방장: 비공개 (방 코드로만 입장) */
  on('setPrivate', v => {
    const { room, me } = ctx();
    if (!room || !me || !me.isHost || room.private === !!v) return;
    room.private = !!v;
    sys(room, room.private ? '🔒 비공개 방이 됐어요. 방 코드로만 들어올 수 있어요.' : '🌐 공개 방이 됐어요. 열린 방 목록에 보여요.');
    pushRoom(room);
  });
  /** 방장: 내보내기 (대기실에서만) */
  on('kick', id => {
    const { room, me } = ctx();
    if (!room || !me || !me.isHost || room.isStarted || typeof id !== 'string' || id === me.id) return;
    const p = getPlayer(room, id); if (!p) return;
    room.kicked = room.kicked || new Set();
    room.kicked.add(id); if (p.uid) room.kicked.add('u:' + p.uid);
    const s = io.sockets.sockets.get(id);
    if (s) { leaveRoom(s); s.emit('kicked', { code: room.code }); }
    else dropPlayer(room, id, `🚫 방장이 ${p.name} 님을 내보냈어요.`);       // 연결이 끊긴 채 자리만 있는 사람
    if (s) sys(room, `🚫 방장이 ${p.name} 님을 내보냈어요.`);
  });

  on('leaveRoom', () => leaveRoom(socket));
  on('disconnect', reason => {
    const room = rooms.get(socket.data.code), p = room && room.players.find(x => x.id === socket.id);
    // 일부러 나간 것(방 나가기 · 서버 종료)이면 바로 빼고, 연결이 끊긴 것이면 잠깐 자리를 맡아 둬요
    if (!room || !p || /namespace disconnect|shutting down/.test(String(reason))) return leaveRoom(socket);
    const ms = room.isStarted ? AWAY_GAME_MS : AWAY_LOBBY_MS;
    p.away = Date.now(); p.awayQuiet = quietAway.has(socket.id);
    clearTimeout(p.awayTimer);
    p.awayTimer = setTimeout(() => {
      if (rooms.get(room.code) === room && room.players.includes(p) && p.away) dropPlayer(room, p.id, `🚪 ${p.name} 님이 돌아오지 않아서 방에서 나갔습니다.`);
    }, ms);
    const mod = moduleOf(room);                       // 차례형 게임: 끊긴 사람 차례는 짧게 기다려요 (다른 사람이 오래 기다리지 않게)
    if (room.isStarted && room.game && !room.game.over && mod && mod.away) { try { mod.away(room, p); } catch (e) { console.error('⚠️  연결 끊김 처리 오류:', e); } }
    if (!p.awayQuiet) sys(room, `📶 ${p.name} 님의 연결이 끊겼어요. ${ms >= 60000 ? Math.round(ms / 60000) + '분' : Math.round(ms / 1000) + '초'} 안에 돌아오면 그대로 이어서 해요.`);
    pushRoom(room);
  });
  /** 새로 고침한 뒤 다시 연결됐을 때: 진행 중인 게임 화면을 다시 보내 줘요 (차례형 게임) */
  on('resync', () => {
    const { room, me } = ctx();
    if (!room || !me) return;
    pushRoom(room);
    const mod = moduleOf(room);
    if (room.isStarted && room.game && !room.game.over && mod && mod.resync) mod.resync(room, me, socket);
  });

  on('setOption', d => {
    const { room, me } = ctx();
    if (!room || !me || !me.isHost || room.isStarted || !d) return;
    if (d.key === 'seotdaType' && ['2card', '3card'].includes(d.value)) room.options.seotdaType = d.value;
    if (d.key === 'pokerType' && ['5card', '7card'].includes(d.value)) room.options.pokerType = d.value;
    const o = (REGISTRY[room.gameType].options || []).find(x => x.key === d.key);         // 보드게임 옵션 (봇 수 · 라운드 등)
    if (o && o.values.some(([v]) => String(v) === String(d.value))) room.options[d.key] = Number.isNaN(+d.value) ? d.value : +d.value;
    pushRoom(room);
  });

  /** 대기실에서 방장이 다른 게임으로 바꾸기 (방을 나가지 않아도 됨) */
  on('setGame', key => {
    const { room, me } = ctx();
    if (!room || !me || room.isStarted) return;
    if (!me.isHost) return toast('방장만 게임을 바꿀 수 있어요.');
    const info = REGISTRY[key];
    if (!info) return toast('알 수 없는 게임입니다.');
    if (key === room.gameType) return;
    if (room.players.length > info.max) return toast(`${info.name}은(는) 최대 ${info.max}명까지 할 수 있어요. (지금 ${room.players.length}명)`);
    room.gameType = key;
    room.options = { seotdaType: room.options.seotdaType, pokerType: room.options.pokerType };     // 게임별 옵션은 새 게임 기본값으로
    for (const o of info.options || []) room.options[o.key] = o.def;
    room.players.forEach(p => { p.role = null; p.isReady = p.isHost; });
    room.players.forEach(p => { p.role = assignRole(room); });      // 자리가 있는 게임이면 들어온 순서대로 다시 앉힘
    sys(room, `🎮 방장이 게임을 [${info.name}](으)로 바꿨어요. 다시 준비 완료를 눌러 주세요!`);
    pushRoom(room);
  });

  on('setRole', role => {
    const { room, me } = ctx();
    if (!room || !me || room.isStarted) return;
    const roles = REGISTRY[room.gameType].roles;
    if (!roles || (role !== 'spectator' && !roles.includes(role))) return;
    if (role !== 'spectator' && room.players.some(p => p.role === role && p.id !== me.id)) return toast('이미 다른 사람이 앉은 자리입니다.');
    me.role = role;
    pushRoom(room);
  });

  on('toggleReady', () => {
    const { room, me } = ctx();
    if (!room || !me || me.isHost || room.isStarted) return;
    me.isReady = !me.isReady;
    pushRoom(room);
  });

  on('startGame', () => {
    const { room, me } = ctx();
    if (!room || !me) return;
    if (!me.isHost) return toast('방장만 시작할 수 있습니다.');
    tryStart(room, toast);
  });

  /** 결과창 '한 판 더': 모두 누르면 3초 뒤 같은 게임을 바로 다시 시작해요 */
  on('rematch', v => {
    const { room, me } = ctx();
    if (!room || !me || !room.game || !room.game.over || !room.rematch || me.role === 'spectator') return;
    if (v === false) room.rematch.delete(me.id); else room.rematch.add(me.id);
    const parts = participants(room), have = parts.filter(p => room.rematch.has(p.id)).length;
    H.emit(room, 'rematch', { ids: [...room.rematch], have, need: parts.length });
    if (have < parts.length || parts.length < REGISTRY[room.gameType].min) return;
    endToLobby(room, '🔁 모두 한 판 더! 3초 뒤에 시작해요');          // 누른 사람은 준비 완료로 돌아와요
    const session = room.session;
    H.emit(room, 'rematch:go', { at: Date.now() + 3000 });
    H.later(room, 3000, () => { if (room.session === session && !room.isStarted) tryStart(room, msg => sys(room, `⚠️ 바로 시작하지 못했어요: ${msg}`)); });
  });

  on('returnToLobby', () => {
    const { room, me } = ctx();
    if (room && me && me.isHost && room.isStarted) endToLobby(room, '방장이 대기실로 돌아왔습니다.');
  });

  /* ── 채팅 & 이모티콘 (모든 게임 공통) ── */
  on('chat', d => {
    const { room, me } = ctx();
    if (!room || !me) return;
    const now = Date.now();
    if (now - me.lastChat < 200) return;
    me.lastChat = now;
    const emoji = !!(d && d.emoji);
    const msg = String((d && d.msg) ?? '').trim().slice(0, emoji ? 8 : 120);
    if (!msg) return;
    const mod = moduleOf(room);
    if (room.game && !room.game.over && mod && mod.chat && mod.chat(room, me, msg, emoji)) return;   // 캐치마인드 정답 · 마피아 밤 채팅 등
    H.emit(room, 'chat', { id: me.id, name: me.name, msg, emoji, ...(me.op ? { op: me.op } : {}) });   // op: 운영자 표시
  });

  /* ── 게임별 이벤트: 해당 게임이 진행 중일 때만 그 모듈로 전달 ── */
  for (const mod of MODULES) {
    for (const [ev, fn] of Object.entries(mod.events || {})) {
      on(ev, data => {
        const { room, me } = ctx();
        if (!room || !me || !room.game || room.game.over || !mod.games[room.gameType]) return;
        const err = fn(room, me, data, socket);
        if (typeof err === 'string') toast(err);
      });
    }
  }
});

/* ─────────────────────────── 서버 시작 ─────────────────────────── */
ACC.init();                                            // 계정 불러오기 (DB가 느려도 서버는 먼저 켜져요)
let closing = false;
const shutdown = sig => {                              // 끄기 전에 바뀐 계정을 저장해요 (Render 재배포 · Ctrl+C · 창 닫기)
  if (closing) return; closing = true;
  ACC.flushSync();
  Promise.race([ACC.flush(), new Promise(r => setTimeout(r, 4000))]).finally(() => process.exit(sig === 'SIGINT' ? 130 : 0));
};
['SIGTERM', 'SIGINT', 'SIGHUP'].forEach(s => process.on(s, () => shutdown(s)));
server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n❌ ${PORT}번 포트가 이미 사용 중입니다. (서버가 이미 켜져 있어요)`);
    console.error('   → 열려 있는 다른 서버 창을 닫거나, 작업 관리자에서 node.exe 를 종료한 뒤 다시 실행하세요.');
    console.error(`   → 다른 포트로 켜려면:  set PORT=3001 && node server.js\n`);
    process.exit(1);
  }
  console.error(e);
});

/** 인터넷 주소를 크게 보여주기 */
function bigBox(lines) {
  const width = t => [...t].reduce((a, ch) => a + (ch.codePointAt(0) > 0x1100 ? 2 : 1), 0);   // 한글·이모지는 2칸
  const w = Math.max(...lines.map(width)) + 4;
  console.log('\n  ┏' + '━'.repeat(w) + '┓');
  lines.forEach(l => console.log('  ┃  ' + l + ' '.repeat(w - width(l) - 2) + '┃'));
  console.log('  ┗' + '━'.repeat(w) + '┛\n');
}

server.listen(PORT, () => {
  console.log('\n🚀 미니게임 천국 서버가 켜졌습니다!  (멀티 게임 ' + Object.keys(REGISTRY).length + '종)');
  if (CLOUD) {
    console.log(`   인터넷 주소 : ${publicUrl || '(클라우드가 알려주는 주소)'}`);
    if (KEEP_AWAKE && publicUrl) {                     // 바깥 주소로 나갔다 들어오는 요청이라 '접속'으로 쳐서 잠들지 않아요
      const min = Math.max(5, Math.min(14, Number(process.env.KEEP_AWAKE_MIN) || 10));
      const ping = () => {
        try { require(publicUrl.startsWith('https') ? 'https' : 'http').get(publicUrl + '/health', r => r.resume()).on('error', () => {}); }
        catch { /* 다음에 다시 */ }
      };
      setInterval(ping, min * 60 * 1000);
      console.log(`   💤 잠들지 않게 ${min}분마다 스스로 깨워요 (KEEP_AWAKE=1)`);
    }
    return;
  }
  console.log(`   내 컴퓨터     : http://localhost:${PORT}`);
  lanAddresses().forEach(ip => console.log(`   같은 와이파이 : http://${ip}:${PORT}`));
  console.log('   (이 창을 닫으면 서버가 꺼집니다)\n');
  if (!ONLINE) { console.log('   💡 다른 동네 친구와 하려면 start-online.bat 으로 켜세요 (인터넷 주소가 생겨요)\n'); return; }
  if (process.platform === 'win32') { try { require('child_process').spawn('explorer', [`http://localhost:${PORT}`]).on('error', () => {}); } catch { /* 브라우저 열기 실패는 무시 */ } }
  require('./lib/tunnel').startTunnel(PORT, {
    onUrl(url) {
      publicUrl = url;
      io.emit('serverInfo', serverInfo());
      bigBox(['🌍 인터넷 주소가 준비됐어요! 이 주소를 친구에게 보내세요', '', url, '', '어디서든(다른 와이파이·휴대폰 데이터) 접속할 수 있어요.', '이 창을 닫으면 주소도 사라져요. 다시 켜면 주소가 바뀌어요.']);
      if (process.platform === 'win32') {                       // 클립보드에 복사해 두기
        try { const c = require('child_process').spawn('cmd', ['/c', 'clip']); c.on('error', () => {}); c.stdin.end(url); console.log('   📋 주소를 클립보드에 복사했어요. 카톡에 붙여넣기(Ctrl+V) 하세요!\n'); } catch { /* 복사 실패는 무시 */ }
      }
    },
    onDown() { publicUrl = ''; io.emit('serverInfo', serverInfo()); },
  });
});
