'use strict';
/* 🧱 테트리스 배틀 — 줄을 지워 공격, 마지막 생존자 우승 (블록 계산은 각자 화면에서) */
module.exports = H => {
  function check(room) {
    const g = room.game;
    if (g.alive.size > 1) return;
    const w = H.getPlayer(room, [...g.alive][0]);
    H.finishGame(room, { title: w ? `🏆 ${w.name} 최후의 생존자!` : '무승부', ranking: H.rankScores(room, '점') });
  }
  return {
    games: { tetris: { name: '테트리스 배틀', min: 2, max: 8 } },
    start(room) {
      room.game = { type: 'tetris', alive: new Set(H.participants(room).map(p => p.id)) };
      H.emit(room, 'tetris:start', {});
      H.pushScores(room);
    },
    events: {
      'tetris:attack'(room, me, n) {
        const g = room.game;
        if (!g.alive.has(me.id)) return;
        const targets = [...g.alive].filter(id => id !== me.id);
        if (targets.length) H.toPlayer(H.pick(targets), 'tetris:garbage', { lines: H.clamp(H.int(n, 1), 1, 4), from: me.name });
      },
      'tetris:score'(room, me, s) { me.score = H.clamp(H.int(s), 0, 9999999); H.pushScores(room); },
      'tetris:dead'(room, me) {
        const g = room.game;
        if (!g.alive.has(me.id)) return;
        g.alive.delete(me.id);
        H.sys(room, `💀 ${me.name} 님 탈락!`);
        H.emit(room, 'game:out', { id: me.id });
        check(room);
      },
    },
    leave(room, p) { room.game.alive.delete(p.id); check(room); },
  };
};
