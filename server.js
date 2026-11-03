'use strict';
/* =========================================================================
 *  🎮 미니게임 천국 — 게임 서버 (server.js)
 *
 *  실행 :  npm install   →   node server.js     (또는 start.bat 더블클릭)
 *  접속 :  http://localhost:3000
 *  인터넷 공개 :  node server.js --online   (또는 start-online.bat) → https://xxxx.trycloudflare.com 주소가 생겨요
 *  클라우드 배포 :  Render 등에 올리면 PORT · RENDER_EXTERNAL_URL 을 자동으로 읽어요 (DEPLOY.md 참고)
 *
 *  폴더 구조
 *    server.js        방 만들기·입장·채팅 같은 공통 기능
 *    lib/             공통 도구
 *    data/            단어 목록
 *    games/*.js       게임 하나당 파일 하나 (멀티 43종, 보드·카드 게임은 games/table.js 하나로)
 *    public/          화면 (index.html, style.css, js/*.js)
 * ========================================================================= */
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const makeHelpers = require('./lib/helpers');

const PORT = Number(process.env.PORT) || 3000;
const ONLINE = process.argv.includes('--online') || process.env.ONLINE === '1';    // 내 PC를 인터넷에 공개 (start-online.bat)
const CLOUD = !!(process.env.RENDER || process.env.PUBLIC_URL);                    // 클라우드 서버(Render 등)에서 실행 중
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
const io = new Server(server, { pingTimeout: 20000, maxHttpBufferSize: 64 * 1024 });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size, players: io.engine.clientsCount }));   // 클라우드 상태 확인용

// 🛡️ 어떤 오류가 나도 서버가 꺼지지 않게 (로그만 남김)
process.on('uncaughtException', e => console.error('⚠️  처리되지 않은 오류 (서버는 계속 실행됩니다):', e));
process.on('unhandledRejection', e => console.error('⚠️  처리되지 않은 비동기 오류 (서버는 계속 실행됩니다):', e));

/* ─────────────────────────── 게임 모듈 등록 ─────────────────────────── */
const rooms = new Map();
let REGISTRY = {};                                   // 게임 키 → { name, min, max, roles, mod }
const moduleOf = room => (REGISTRY[room.gameType] || {}).mod;
const H = makeHelpers(io, rooms, moduleOf);

const MODULES = [
  'cards', 'apple', 'race', 'catch', 'liar', 'tetris', 'omok', 'pong',
  'mine', 'g2048', 'snake', 'rain', 'bingo',
  'dodge', 'plat', 'volley', 'bomb', 'tank', 'onecard', 'halli', 'ox', 'word', 'mole', 'scorerace', 'kart',
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
  const name = cleanName(rawName);
  const isHost = room.players.length === 0;
  room.players.push({ id: socket.id, name, isHost, isReady: isHost, score: 0, chips: 1000000, role: assignRole(room), lastChat: 0 });
  socket.join(room.code);
  socket.data.code = room.code;
  socket.emit('joined', { code: room.code, myId: socket.id });
  sys(room, `👋 ${name} 님이 들어왔습니다.`);
  pushRoom(room);
}

function leaveRoom(socket) {
  const room = rooms.get(socket.data.code);
  socket.data.code = null;
  if (!room) return;
  socket.leave(room.code);
  const idx = room.players.findIndex(p => p.id === socket.id);
  if (idx < 0) return;
  const [p] = room.players.splice(idx, 1);

  if (!room.players.length) { stopTimers(room); rooms.delete(room.code); return; }
  if (p.isHost) { room.players[0].isHost = true; room.players[0].isReady = true; sys(room, `👑 ${room.players[0].name} 님이 새 방장이 되었습니다.`); }
  sys(room, `🚪 ${p.name} 님이 나갔습니다.`);

  if (room.isStarted && room.game && !room.game.over) {
    const info = REGISTRY[room.gameType];
    if (info.mod.leave) info.mod.leave(room, p);
    if (room.isStarted && room.game && !room.game.over && participants(room).length < info.min) {
      endToLobby(room, '인원이 부족해서 게임이 종료되었습니다.');
    }
  }
  pushRoom(room);
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && (i.family === 'IPv4' || i.family === 4) && !i.internal).map(i => i.address);
}

const serverInfo = () => ({ lan: CLOUD ? [] : lanAddresses(), port: PORT, publicUrl, online: ONLINE || CLOUD });

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
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    return { room, me: room ? getPlayer(room, socket.id) : null };
  };

  socket.emit('serverInfo', serverInfo());
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
    leaveRoom(socket);
    addPlayer(room, socket, d.playerName);
  });

  on('leaveRoom', () => leaveRoom(socket));
  on('disconnect', () => leaveRoom(socket));

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
    if (room.isStarted) return;
    const info = REGISTRY[room.gameType];
    const parts = participants(room);
    if (info.requireRoles && !info.requireRoles.every(r => room.players.some(p => p.role === r))) return toast(info.requireMsg);
    if (parts.length < info.min) return toast(`${info.name}은(는) 최소 ${info.min}명이 필요해요.`);
    const notReady = parts.filter(p => !p.isHost && !p.isReady);
    if (notReady.length) return toast(`아직 준비 안 한 사람: ${notReady.map(p => p.name).join(', ')}`);

    stopTimers(room);
    room.session++;
    room.isStarted = true;
    room.players.forEach(p => { p.score = 0; });
    info.mod.start(room);
    pushRoom(room);
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
    H.emit(room, 'chat', { id: me.id, name: me.name, msg, emoji });
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
