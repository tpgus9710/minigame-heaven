'use strict';
/* 💥 폭탄 배틀 — 서버가 30fps로 계산해서 상태를 보냅니다. */
const BC = require('../public/js/shared/bomb-core');

module.exports = H => {
  function finish(room) {
    const g = room.game, s = g.s;
    const order = g.deaths;                                // 늦게 죽을수록 높은 순위
    const ranked = s.players.slice().sort((a, b) => (b.alive - a.alive) || (order.indexOf(b.id) - order.indexOf(a.id)) || (b.kills - a.kills));
    const win = s.winner && s.players.find(p => p.id === s.winner);
    H.finishGame(room, {
      title: win ? `💥 ${win.name} 승리!` : '🤝 무승부', subtitle: win ? '최후의 생존자!' : (s.time >= s.limit ? '⏰ 시간 종료' : '모두 쓰러졌어요'),
      ranking: ranked.map(p => ({ name: p.name, value: `${p.kills}킬${p.alive ? ' · 생존' : ''}` })),
    });
  }

  return {
    games: { bomb: { name: '폭탄 배틀', min: 2, max: 6 } },
    start(room) {
      const parts = H.shuffle(H.participants(room)).slice(0, 6);
      const s = BC.newGame(parts.map(p => ({ id: p.id, name: p.name })), Math.random);
      const g = room.game = { type: 'bomb', s, inputs: {}, deaths: [], startAt: Date.now() + 3000 };
      H.emit(room, 'bomb:start', { players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color })), snap: BC.snap(s), delay: 3000 });
      H.later(room, 3000, () => H.loop(room, 1000 / 30, () => {
        BC.step(s, g.inputs);
        for (const id in g.inputs) g.inputs[id].bomb = false;
        for (const e of s.events) if (e.e === 'die') {
          g.deaths.push(e.id);
          H.emit(room, 'game:out', { id: e.id });
          const dead = s.players.find(p => p.id === e.id), by = s.players.find(p => p.id === e.by);
          H.sys(room, by && by !== dead ? `💥 ${by.name} 님이 ${dead.name} 님을 잡았어요!` : `💥 ${dead.name} 님 탈락!`);
          s.players.forEach(p => { const pl = H.getPlayer(room, p.id); if (pl) pl.score = p.kills; });
          H.pushScores(room);
        }
        H.emit(room, 'bomb:s', BC.snap(s));
        if (s.over && !g.ending) { g.ending = true; H.later(room, 1500, () => finish(room)); }
      }));
    },
    events: {
      'bomb:in'(room, me, d) {
        const g = room.game;
        if (!d || !g.s.players.some(p => p.id === me.id)) return;
        const cur = g.inputs[me.id] || { dir: 0, bomb: false };
        g.inputs[me.id] = { dir: H.clamp(H.int(d.dir), 0, 4), bomb: cur.bomb || !!d.bomb };
      },
    },
    leave(room, p) {
      const pl = room.game.s.players.find(x => x.id === p.id);
      if (pl && pl.alive) { pl.alive = false; room.game.deaths.push(p.id); }
    },
  };
};
