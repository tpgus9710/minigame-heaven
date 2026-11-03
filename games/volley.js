'use strict';
/* 🏐 점프 배구 (1:1) — 서버가 60fps로 물리를 계산하고 30fps로 상태를 보냅니다. */
const VC = require('../public/js/shared/volley-core');
const BITS = { l: 1, r: 2, u: 4, d: 8, p: 16 };

module.exports = H => {
  const sideOf = (room, id) => { const p = H.getPlayer(room, id); return p && p.role === 'left' ? 0 : p && p.role === 'right' ? 1 : -1; };

  function finish(room, winSide, why) {
    const g = room.game;
    const names = [g.names[0], g.names[1]];
    H.finishGame(room, {
      title: `🏐 ${names[winSide]} 승리!`, subtitle: why || `${g.s.score[0]} : ${g.s.score[1]}`,
      ranking: [winSide, 1 - winSide].map(i => ({ id: g.ids[i], name: names[i], value: `${g.s.score[i]}점` })), winners: [g.ids[winSide]],
    });
  }

  return {
    games: { volley: { name: '점프 배구', min: 2, max: 10, roles: ['left', 'right'], requireRoles: ['left', 'right'], requireMsg: '왼쪽·오른쪽 코트에 한 명씩 앉아야 시작할 수 있어요.' } },
    start(room) {
      const L = room.players.find(p => p.role === 'left'), R = room.players.find(p => p.role === 'right');
      const g = room.game = { type: 'volley', s: VC.newGame(15), inputs: [VC.blank(), VC.blank()], latch: [false, false], names: [L.name, R.name], ids: [L.id, R.id], ev: [] };
      H.emit(room, 'volley:start', { names: g.names, ids: g.ids, target: g.s.target });
      let frame = 0;
      H.loop(room, 1000 / 60, () => {
        const inp = g.inputs.map((x, i) => ({ ...x, p: x.p && g.latch[i] }));
        g.latch = [false, false];
        VC.step(g.s, inp);
        g.ev.push(...g.s.events);
        if (++frame % 2 === 0) { H.emit(room, 'volley:s', { ...VC.snap(g.s), ev: g.ev }); g.ev = []; }
        if (g.s.events.includes('point')) {
          room.players.forEach(p => { const sd = sideOf(room, p.id); if (sd >= 0) p.score = g.s.score[sd]; });
          H.pushScores(room);
        }
        if (g.s.phase === 'over' && !g.ending) { g.ending = true; H.later(room, 1500, () => finish(room, g.s.winner)); }
      });
    },
    events: {
      'volley:in'(room, me, mask) {
        const g = room.game, side = sideOf(room, me.id);
        if (side < 0) return;
        const m = H.int(mask);
        const prev = g.inputs[side];
        g.inputs[side] = { l: !!(m & BITS.l), r: !!(m & BITS.r), u: !!(m & BITS.u), d: !!(m & BITS.d), p: !!(m & BITS.p) };
        if (g.inputs[side].p && !prev.p) g.latch[side] = true;   // 아주 짧게 눌러도 놓치지 않게
      },
    },
    leave(room, p) {
      const g = room.game, side = g.ids.indexOf(p.id);
      if (side >= 0) finish(room, 1 - side, `${p.name} 님이 나가서 기권승!`);
    },
  };
};
