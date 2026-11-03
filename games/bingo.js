'use strict';
/* 🎱 빙고 — 돌아가며 숫자를 부르고, 먼저 3줄을 완성하면 승리 */
const TARGET = 3, SETUP_SECONDS = 12, TURN_SECONDS = 20;
const LINES = [];
for (let i = 0; i < 5; i++) { LINES.push([0, 1, 2, 3, 4].map(k => i * 5 + k)); LINES.push([0, 1, 2, 3, 4].map(k => k * 5 + i)); }
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
const countLines = (board, called) => LINES.filter(line => line.every(i => called.has(board[i]))).length;
const newBoard = shuffle => shuffle(Array.from({ length: 25 }, (_, i) => i + 1));

module.exports = H => {
  const { emit, later, cancel, getPlayer, participants } = H;

  function next(room) {
    const g = room.game;
    if (!g || g.over) return;
    g.phase = 'play';
    cancel(room, g.timer);
    let p = null;
    for (let k = 0; k < g.order.length && !p; k++) { g.turn = (g.turn + 1) % g.order.length; p = getPlayer(room, g.order[g.turn]); }
    if (!p) return;
    g.turnId = p.id;
    const token = ++g.token;
    emit(room, 'bingo:turn', { id: p.id, name: p.name, seconds: TURN_SECONDS });
    g.timer = later(room, TURN_SECONDS * 1000, () => {
      if (g.token !== token) return;
      const left = Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !g.called.includes(n));
      call(room, H.pick(left), p, true);
    });
  }
  function call(room, n, by, auto) {
    const g = room.game;
    g.called.push(n);
    g.token++;
    const set = new Set(g.called);
    const parts = participants(room);
    parts.forEach(p => { p.score = countLines(g.boards[p.id], set); });
    emit(room, 'bingo:called', { n, by: by.name, auto });
    H.pushScores(room);
    const winners = parts.filter(p => p.score >= TARGET);
    if (winners.length) {
      return H.finishGame(room, {
        title: winners.length > 1 ? `🤝 ${winners.map(p => p.name).join(', ')} 동시 빙고!` : `🎉 ${winners[0].name} 빙고!`,
        subtitle: `${g.called.length}번째 숫자 [${n}]로 ${TARGET}줄 완성!`,
        ranking: H.rankScores(room, '줄'),
      });
    }
    next(room);
  }

  return {
    games: { bingo: { name: '빙고', min: 2, max: 6 } },
    start(room) {
      const parts = participants(room);
      room.game = { type: 'bingo', boards: {}, called: [], order: H.shuffle(parts.map(p => p.id)), turn: -1, turnId: null, phase: 'setup', token: 0, timer: null };
      parts.forEach(p => {
        room.game.boards[p.id] = newBoard(H.shuffle);
        H.toPlayer(p.id, 'bingo:start', { board: room.game.boards[p.id], seconds: SETUP_SECONDS, target: TARGET });
      });
      H.pushScores(room);
      H.sys(room, `🎱 ${SETUP_SECONDS}초 동안 판을 섞을 수 있어요. 그다음 돌아가며 숫자를 부릅니다!`);
      room.game.timer = later(room, SETUP_SECONDS * 1000, () => next(room));
    },
    events: {
      'bingo:shuffle'(room, me) {
        const g = room.game;
        if (g.phase !== 'setup' || !g.boards[me.id]) return;
        g.boards[me.id] = newBoard(H.shuffle);
        H.toPlayer(me.id, 'bingo:board', { board: g.boards[me.id] });
      },
      'bingo:pick'(room, me, n) {
        const g = room.game;
        n = H.int(n);
        if (g.phase !== 'play' || g.turnId !== me.id) return '지금은 내 차례가 아니에요.';
        if (n < 1 || n > 25 || g.called.includes(n)) return;
        call(room, n, me, false);
      },
    },
    leave(room, p) {
      const g = room.game;
      delete g.boards[p.id];
      if (g.phase === 'play' && g.turnId === p.id) next(room);
    },
  };
};
