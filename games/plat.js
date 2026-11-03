'use strict';
/* 🏃 점프 레이스 — 모두 같은 시드의 스테이지를 각자 달리고, 서버는 위치를 서로에게 전달합니다. */
const SECONDS = 180, HURRY = 25, STAGE = 3;

module.exports = H => {
  const { participants, clamp, num } = H;

  function finish(room, why) {
    const g = room.game;
    const order = new Map(g.finished.map((f, i) => [f.id, i]));
    const ranked = participants(room).slice().sort((a, b) =>
      (order.has(a.id) ? order.get(a.id) : 99) - (order.has(b.id) ? order.get(b.id) : 99) || b.score - a.score);
    H.finishGame(room, {
      title: g.finished.length ? `🏁 ${ranked[0].name} 우승!` : '⏰ 아무도 골인하지 못했어요',
      subtitle: why,
      ranking: ranked.map(p => {
        const f = g.finished.find(x => x.id === p.id);
        return { name: p.name, value: f ? `${(f.t / 1000).toFixed(1)}초 골인` : `${p.score}% 진행` };
      }),
    });
  }

  return {
    games: { plat: { name: '점프 레이스', min: 1, max: 8 } },
    start(room) {
      const g = room.game = { type: 'plat', seed: H.rand(1e9), finished: [], pos: {}, t0: Date.now() + 3000, hurry: false };
      H.emit(room, 'plat:start', { seed: g.seed, stage: STAGE, seconds: SECONDS, delay: 3000 });
      H.pushScores(room);
      let n = 0;
      H.loop(room, 100, () => {
        H.emit(room, 'plat:ghosts', g.pos);
        if (++n % 5 === 0) H.pushScores(room);
      });
      H.later(room, 3000 + SECONDS * 1000, () => finish(room, '⏰ 시간 종료'));
    },
    events: {
      'plat:pos'(room, me, d) {
        if (!d || me.role === 'spectator') return;
        room.game.pos[me.id] = [Math.round(num(d.x)), Math.round(num(d.y)), d.f ? 1 : 0, H.int(d.a) % 8];
        if (!room.game.finished.some(f => f.id === me.id)) me.score = Math.max(me.score, clamp(H.int(d.p), 0, 99));
      },
      'plat:finish'(room, me) {
        const g = room.game;
        if (g.finished.some(f => f.id === me.id) || Date.now() < g.t0) return;
        const t = Date.now() - g.t0;
        g.finished.push({ id: me.id, t });
        me.score = 100;
        H.pushScores(room);
        H.emit(room, 'plat:goal', { id: me.id, name: me.name, rank: g.finished.length, t });
        H.sys(room, `🏁 ${me.name} 님 ${g.finished.length}등으로 골인! (${(t / 1000).toFixed(1)}초)`);
        const parts = participants(room);
        if (g.finished.length >= parts.length) return void H.later(room, 800, () => finish(room, '모두 골인!'));
        if (!g.hurry && parts.length > 1) {
          g.hurry = true;
          H.emit(room, 'plat:hurry', { seconds: HURRY });
          H.later(room, HURRY * 1000, () => finish(room, '1등 골인 후 제한 시간 끝'));
        }
      },
    },
    leave(room) {
      const g = room.game, parts = participants(room);
      if (parts.length && parts.every(p => g.finished.some(f => f.id === p.id))) finish(room, '모두 골인!');
    },
  };
};
