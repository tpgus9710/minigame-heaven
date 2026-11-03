'use strict';
/* ⚫ 오목 — 흑·백 1:1, 나머지는 관전 */
function omokWin(b, r, c, v) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < 15 && cc >= 0 && cc < 15 && b[rr][cc] === v) { n++; rr += dr * s; cc += dc * s; }
    }
    if (n >= 5) return true;
  }
  return false;
}

module.exports = H => ({
  games: {
    omok: { name: '오목', min: 2, max: 10, roles: ['black', 'white'], requireRoles: ['black', 'white'], requireMsg: '흑돌과 백돌 자리에 모두 앉아야 시작할 수 있어요.' },
  },
  start(room) {
    const black = room.players.find(p => p.role === 'black');
    const white = room.players.find(p => p.role === 'white');
    room.game = { type: 'omok', board: Array.from({ length: 15 }, () => Array(15).fill(0)), turn: 'black', moves: 0 };
    H.emit(room, 'omok:start', { black: black.name, white: white.name, blackId: black.id, whiteId: white.id });
  },
  events: {
    'omok:place'(room, me, d) {
      const g = room.game;
      if (me.role !== g.turn) return;
      const r = H.int(d && d.r, -1), c = H.int(d && d.c, -1);
      if (r < 0 || r > 14 || c < 0 || c > 14 || g.board[r][c]) return;
      const v = g.turn === 'black' ? 1 : 2;
      g.board[r][c] = v; g.moves++;
      const win = omokWin(g.board, r, c, v);
      const next = g.turn === 'black' ? 'white' : 'black';
      H.emit(room, 'omok:move', { r, c, color: g.turn, next: win ? null : next });
      if (win) return void H.finishGame(room, { title: `🏆 ${me.name} 승리!`, subtitle: `${g.turn === 'black' ? '⚫ 흑돌' : '⚪ 백돌'}이 5목을 완성했습니다.` });
      if (g.moves >= 225) return void H.finishGame(room, { title: '🤝 무승부', subtitle: '판이 가득 찼습니다.' });
      g.turn = next;
    },
  },
  leave(room, p) {
    if (p.role !== 'black' && p.role !== 'white') return;
    const winner = room.players.find(x => x.role === (p.role === 'black' ? 'white' : 'black'));
    H.finishGame(room, { title: `🏆 ${winner ? winner.name : '상대'} 기권승!`, subtitle: `${p.name} 님이 게임을 나갔습니다.` });
  },
});
