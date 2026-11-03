'use strict';
/* 🔨 두더지 잡기 대결 — 서버가 두더지를 올리고, 가장 먼저 때린 사람이 점수를 가져갑니다. */
const HOLES = 16, SECONDS = 60, DELAY = 2000;
const PTS = { mole: 1, gold: 3, bomb: -3 };

module.exports = H => {
  const { rand } = H;

  function finish(room) {
    const ranked = H.participants(room).slice().sort((a, b) => b.score - a.score);
    H.finishGame(room, { title: `🔨 ${ranked[0] ? ranked[0].name : ''} 우승!`, subtitle: '두더지 잡기 대결 끝', ranking: H.rankScores(room, '점') });
  }

  function spawn(room) {
    const g = room.game, t = (Date.now() - g.t0) / 1000;
    const maxUp = Math.min(6, 2 + Math.floor(t / 12));
    if (g.moles.size >= maxUp || Math.random() > 0.45 + t * 0.006) return;
    const used = new Set([...g.moles.values()].map(m => m.h));
    const free = [...Array(HOLES).keys()].filter(h => !used.has(h));
    if (!free.length) return;
    const r = Math.random(), k = r < 0.1 ? 'gold' : r < 0.22 ? 'bomb' : 'mole';
    const d = k === 'gold' ? 650 : k === 'bomb' ? 1500 : Math.max(650, 1150 - t * 7);
    const m = { id: ++g.seq, h: free[rand(free.length)], k };
    g.moles.set(m.id, m);
    H.emit(room, 'mole:up', { ...m, d });
    H.later(room, d, () => { if (g.moles.delete(m.id)) H.emit(room, 'mole:down', { id: m.id }); });
  }

  return {
    games: { mole: { name: '두더지 잡기 대결', min: 1, max: 8 } },
    start(room) {
      room.game = { type: 'mole', moles: new Map(), seq: 0, t0: Date.now() + DELAY };
      H.emit(room, 'mole:start', { holes: HOLES, seconds: SECONDS, delay: DELAY });
      H.pushScores(room);
      H.later(room, DELAY, () => H.loop(room, 160, () => spawn(room)));
      H.later(room, DELAY + SECONDS * 1000, () => finish(room));
    },
    events: {
      'mole:hit'(room, me, id) {
        const g = room.game, m = g.moles.get(H.int(id));
        if (!m || me.role === 'spectator') return;
        g.moles.delete(m.id);
        me.score += PTS[m.k];
        H.emit(room, 'mole:hit', { id: m.id, by: me.id, name: me.name, pts: PTS[m.k] });
        H.pushScores(room);
      },
    },
  };
};
