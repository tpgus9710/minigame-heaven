'use strict';
/* 💣 지뢰찾기 대결 — 모두 같은 판, 먼저 다 찾는 사람이 우승. 지뢰를 밟으면 탈락 */
const W = 16, HGT = 16, MINES = 40, SECONDS = 300;

module.exports = H => {
  const { participants, pushScores, finishGame } = H;

  function finish(room, title, subtitle = '') {
    const g = room.game;
    const ranking = participants(room).slice()
      .sort((a, b) => (g.state[b.id] === 'clear') - (g.state[a.id] === 'clear') || b.score - a.score)
      .map(p => ({ name: p.name, value: g.state[p.id] === 'clear' ? '✅ 완료' : g.state[p.id] === 'boom' ? `💥 ${p.score}%` : `${p.score}%` }));
    finishGame(room, { title, subtitle, ranking });
  }
  function checkEnd(room) {
    const g = room.game;
    if (participants(room).some(p => g.state[p.id] === 'play')) return;
    const best = participants(room).slice().sort((a, b) => b.score - a.score)[0];
    finish(room, best ? `🏆 ${best.name} 승리!` : '게임 종료', '모두 지뢰를 밟았어요. 가장 많이 연 사람이 이깁니다.');
  }

  return {
    games: { mine: { name: '지뢰찾기 대결', min: 1, max: 8 } },
    start(room) {
      // 시작 칸 주변 3x3에는 지뢰를 두지 않음 → 모두 같은 곳에서 안전하게 시작
      const sr = 2 + H.rand(HGT - 4), sc = 2 + H.rand(W - 4);
      const cells = [];
      for (let r = 0; r < HGT; r++) for (let c = 0; c < W; c++) if (Math.abs(r - sr) > 1 || Math.abs(c - sc) > 1) cells.push(r * W + c);
      const mines = H.shuffle(cells).slice(0, MINES);
      room.game = { type: 'mine', startAt: Date.now(), state: {} };
      participants(room).forEach(p => { room.game.state[p.id] = 'play'; });
      H.emit(room, 'mine:start', { w: W, h: HGT, mines, start: [sr, sc], seconds: SECONDS });
      pushScores(room);
      H.later(room, SECONDS * 1000 + 500, () => finish(room, '⏰ 시간 종료!', '가장 많이 연 사람이 이깁니다.'));
    },
    events: {
      'mine:progress'(room, me, n) {
        if (room.game.state[me.id] !== 'play') return;
        me.score = H.clamp(H.int(n), 0, 99);
        pushScores(room);
      },
      'mine:boom'(room, me) {
        const g = room.game;
        if (g.state[me.id] !== 'play') return;
        g.state[me.id] = 'boom';
        H.sys(room, `💥 ${me.name} 님이 지뢰를 밟았습니다! (${me.score}% 진행)`);
        H.emit(room, 'game:out', { id: me.id });
        checkEnd(room);
      },
      'mine:clear'(room, me) {
        const g = room.game;
        if (g.state[me.id] !== 'play') return;
        g.state[me.id] = 'clear'; me.score = 100;
        pushScores(room);
        const sec = ((Date.now() - g.startAt) / 1000).toFixed(1);
        finish(room, `🏆 ${me.name} 지뢰 제거 완료!`, `${sec}초 만에 모든 칸을 열었습니다.`);
      },
    },
    leave(room, p) { delete room.game.state[p.id]; checkEnd(room); },
  };
};
