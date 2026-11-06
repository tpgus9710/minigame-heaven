'use strict';
/**
 * 게임 모듈들이 함께 쓰는 방(room) 도구 모음.
 * server.js 가 한 번 만들어서 모든 games/*.js 에 넘겨줍니다.
 */
const U = require('./util');

const RESULT_SECONDS = 10;   // 결과 화면을 보여준 뒤 대기실로 돌아가기까지(초)

module.exports = function makeHelpers(io, rooms, moduleOf) {
  const H = { ...U, io, rooms, RESULT_SECONDS };

  H.emit = (room, ev, data) => io.to(room.code).emit(ev, data);
  H.toPlayer = (id, ev, data) => io.to(id).emit(ev, data);
  H.sys = (room, msg) => H.emit(room, 'chat', { system: true, msg });
  H.getPlayer = (room, id) => room.players.find(p => p.id === id);
  H.participants = room => room.players.filter(p => p.role !== 'spectator');

  /** 방에 묶인 타이머. 게임이 끝나거나 대기실로 돌아가면 자동으로 무시됩니다. */
  H.later = (room, ms, fn) => {
    const session = room.session;
    const t = setTimeout(() => {
      room.timers.delete(t);
      if (rooms.get(room.code) !== room || room.session !== session) return;
      try { fn(); } catch (e) { console.error('⚠️  타이머 오류:', e); }
    }, ms);
    room.timers.add(t);
    return t;
  };
  H.cancel = (room, t) => { if (t) { clearTimeout(t); room.timers.delete(t); } };
  /** 일정 간격으로 반복 (게임이 끝나면 자동 정지) */
  H.loop = (room, ms, fn) => {
    if (room.loop) clearInterval(room.loop);
    room.loop = setInterval(() => { try { fn(); } catch (e) { console.error('⚠️  게임 루프 오류:', e); } }, ms);
  };
  H.stopTimers = room => {
    room.timers.forEach(clearTimeout); room.timers.clear();
    if (room.loop) { clearInterval(room.loop); room.loop = null; }
  };

  H.publicRoom = room => ({
    code: room.code, gameType: room.gameType, options: room.options, isStarted: room.isStarted, private: !!room.private,
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, isReady: p.isReady, chips: p.chips, role: p.role, score: p.score,
      uid: p.uid || null, lv: p.lv || 0, av: p.av ?? null, color: p.color ?? null, ...(p.op ? { op: p.op } : {}), ...(p.away ? { away: true } : {}),
      ...(p.fr >= 0 ? { fr: p.fr } : {}), ...(p.tt ? { tt: p.tt } : {}) })),
  });
  H.pushRoom = room => H.emit(room, 'room', H.publicRoom(room));
  H.pushScores = room => H.emit(room, 'scores', H.participants(room).map(p => ({ id: p.id, name: p.name, score: p.score })));
  H.rankScores = (room, unit) => H.participants(room).slice().sort((a, b) => b.score - a.score).map(p => ({ id: p.id, name: p.name, value: `${p.score}${unit}` }));

  /** 그림 한 획을 다른 사람들에게 전달 (캐치마인드 · 라이어) */
  H.relayDraw = (room, socket, d) => {
    if (!d) return;
    const { clamp, num } = U;
    socket.to(room.code).emit('draw', {
      x0: clamp(num(d.x0), 0, 1), y0: clamp(num(d.y0), 0, 1), x1: clamp(num(d.x1), 0, 1), y1: clamp(num(d.y1), 0, 1),
      color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#222222', size: clamp(num(d.size, 4), 1, 80),
      k: Math.floor(clamp(num(d.k, 0), 0, 1e9)),                              // 획 번호 (캐치마인드 되돌리기)
    });
  };

  /** 게임 종료 → 결과 화면 → returnIn초 뒤 대기실 */
  /** winners: 이긴 사람 id 목록 (팀 게임 · 결과표가 없는 게임). 없으면 결과표 1등이 이긴 걸로 기록돼요 (lib/accounts.js) */
  H.finishGame = (room, { title, subtitle = '', lines = [], ranking = [], returnIn = RESULT_SECONDS }) => {
    const g = room.game;
    if (!g || g.over) return;
    g.over = true;
    H.stopTimers(room);
    room.rematch = new Set();                          // 결과창 '한 판 더' 누른 사람
    H.emit(room, 'gameOver', { title, subtitle, lines, ranking, returnIn });
    H.later(room, returnIn * 1000, () => H.endToLobby(room));
  };

  /** 대기실로 복귀 */
  H.endToLobby = (room, msg = '') => {
    const mod = moduleOf(room);
    if (room.game && mod && mod.beforeLobby) mod.beforeLobby(room);
    H.stopTimers(room);
    room.session++;
    room.isStarted = false;
    room.game = null;
    room.players.forEach(p => { p.isReady = p.isHost || !!(room.rematch && room.rematch.has(p.id)); });   // '한 판 더'를 누른 사람은 준비 완료로
    room.rematch = null;
    H.emit(room, 'toLobby', { msg });
    H.pushRoom(room);
  };

  return H;
};
