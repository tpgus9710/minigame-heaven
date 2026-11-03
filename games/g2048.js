'use strict';
/* 🔢 2048 대결 — 3분 동안 가장 높은 점수 (계산은 각자 화면에서) */
const SECONDS = 180;

module.exports = H => {
  const { participants, pushScores } = H;
  const topName = room => { const top = participants(room).slice().sort((a, b) => b.score - a.score)[0]; return top ? top.name : '?'; };
  const finish = (room, subtitle) => H.finishGame(room, { title: `🔢 ${topName(room)} 우승!`, subtitle, ranking: H.rankScores(room, '점') });
  const checkEnd = room => { if (participants(room).every(p => room.game.done.has(p.id))) finish(room, '모두 더 이상 움직일 수 없어요.'); };

  return {
    games: { g2048: { name: '2048 대결', min: 1, max: 8 } },
    start(room) {
      room.game = { type: 'g2048', done: new Set() };
      H.emit(room, 'g2048:start', { seconds: SECONDS });
      pushScores(room);
      H.later(room, SECONDS * 1000 + 500, () => finish(room, '⏰ 시간 종료!'));
    },
    events: {
      'g2048:score'(room, me, s) {
        if (room.game.done.has(me.id)) return;
        me.score = H.clamp(H.int(s), 0, 10000000);
        pushScores(room);
      },
      'g2048:over'(room, me) {
        const g = room.game;
        if (g.done.has(me.id)) return;
        g.done.add(me.id);
        H.sys(room, `🧱 ${me.name} 님 게임 오버! (${me.score}점)`);
        H.emit(room, 'game:out', { id: me.id });
        checkEnd(room);
      },
    },
    leave(room) { checkEnd(room); },
  };
};
