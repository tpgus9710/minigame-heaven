'use strict';
/* 🍎 사과 게임 — 모두 같은 판으로 2분 동안 점수 대결 */
module.exports = H => ({
  games: { apple: { name: '사과 게임', min: 1, max: 8 } },
  start(room) {
    const board = Array.from({ length: 10 }, () => Array.from({ length: 17 }, () => 1 + H.rand(9)));
    room.game = { type: 'apple' };
    H.emit(room, 'apple:start', { board, duration: 120 });
    H.pushScores(room);
    H.later(room, 121000, () => H.finishGame(room, { title: '🍎 사과 게임 종료!', ranking: H.rankScores(room, '개') }));
  },
  events: {
    'apple:score'(room, me, s) { me.score = H.clamp(H.int(s), 0, 170); H.pushScores(room); },
  },
});
