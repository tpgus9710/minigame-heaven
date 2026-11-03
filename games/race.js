'use strict';
/* ⏱️ 1 to 50 — 1부터 50까지 가장 먼저 누르는 사람이 우승 */
module.exports = H => ({
  games: { race: { name: '1 to 50', min: 1, max: 8 } },
  start(room) {
    room.game = { type: 'race', startAt: Date.now() };
    H.emit(room, 'race:start', {});
    H.pushScores(room);
    H.later(room, 180000, () => H.finishGame(room, { title: '⏱️ 시간 종료!', subtitle: '3분 안에 아무도 끝내지 못했어요.', ranking: H.rankScores(room, '/50') }));
  },
  events: {
    'race:progress'(room, me, n) {
      me.score = H.clamp(H.int(n), 0, 50);
      H.pushScores(room);
      if (me.score >= 50) {
        const sec = ((Date.now() - room.game.startAt) / 1000).toFixed(2);
        H.finishGame(room, { title: `🏁 ${me.name} 우승!`, subtitle: `기록 ${sec}초`, ranking: H.rankScores(room, '/50') });
      }
    },
  },
});
