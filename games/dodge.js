'use strict';
/* 🎯 총알피하기 배틀 — 서버가 총알을 뿌리고(모두에게 같은 총알), 맞았는지는 각자 화면에서 판정합니다. */
const W = 720, HGT = 520, SECONDS = 150, DELAY = 3000;

module.exports = H => {
  const { participants, rand, clamp, num } = H;
  const elapsed = g => Math.max(0, (Date.now() - g.t0) / 1000);

  function finish(room) {
    const g = room.game;
    const t = Math.floor(elapsed(g));
    participants(room).forEach(p => { if (g.alive.has(p.id)) p.score = t; });
    const ranked = participants(room).slice().sort((a, b) => (g.alive.has(b.id) - g.alive.has(a.id)) || (b.score - a.score));
    H.finishGame(room, {
      title: `🎯 ${ranked[0] ? ranked[0].name : ''} 우승!`,
      subtitle: g.alive.size > 1 ? `⏰ 시간 종료 · ${g.alive.size}명 생존` : '최후의 생존자!',
      ranking: ranked.map(p => ({ name: p.name, value: `${p.score}초${g.alive.has(p.id) ? ' 생존' : ''}` })),
    });
  }
  function checkEnd(room) {
    const g = room.game;
    if (g.alive.size <= 1 && !g.ending) { g.ending = true; H.later(room, 1200, () => finish(room)); }
  }

  /** 총알 하나: 테두리에서 출발해 살아 있는 누군가(또는 아무 곳)를 향해 */
  function bullet(g) {
    const t = elapsed(g), side = rand(4), u = Math.random();
    const x = side === 0 ? u * W : side === 1 ? W + 8 : side === 2 ? u * W : -8;
    const y = side === 0 ? -8 : side === 1 ? u * HGT : side === 2 ? HGT + 8 : u * HGT;
    const ids = [...g.alive];
    let tx = 60 + Math.random() * (W - 120), ty = 60 + Math.random() * (HGT - 120);
    if (ids.length && Math.random() < 0.65) { const p = g.pos[ids[rand(ids.length)]]; tx = p.x + (Math.random() - 0.5) * 70; ty = p.y + (Math.random() - 0.5) * 70; }
    const sp = 110 + Math.min(t * 2.2, 170) + Math.random() * 60, d = Math.hypot(tx - x, ty - y) || 1;
    const r = Math.random() < 0.06 ? 9 : 4 + rand(3);
    return [Math.round(x), Math.round(y), +((tx - x) / d * sp).toFixed(1), +((ty - y) / d * sp).toFixed(1), r];
  }

  function tick(room) {
    const g = room.game;
    g.acc += (5 + elapsed(g) * 0.24) * 0.1;          // 1초에 뿌리는 총알 수가 점점 늘어남
    const b = [];
    while (g.acc >= 1) { g.acc--; b.push(bullet(g)); }
    const p = {};
    for (const id of g.alive) p[id] = [Math.round(g.pos[id].x), Math.round(g.pos[id].y)];
    H.emit(room, 'dodge:tick', { b, p });
    if (++g.ticks % 10 === 0) {
      const t = Math.floor(elapsed(g));
      participants(room).forEach(pl => { if (g.alive.has(pl.id)) pl.score = t; });
      H.pushScores(room);
    }
  }

  return {
    games: { dodge: { name: '총알피하기 배틀', min: 2, max: 8 } },
    start(room) {
      const parts = participants(room);
      const g = room.game = { type: 'dodge', alive: new Set(parts.map(p => p.id)), pos: {}, t0: Date.now() + DELAY, acc: 0, ticks: 0 };
      parts.forEach((p, i) => {
        const a = (i / parts.length) * Math.PI * 2;
        g.pos[p.id] = { x: W / 2 + Math.cos(a) * 70, y: HGT / 2 + Math.sin(a) * 70 };
      });
      H.emit(room, 'dodge:start', { w: W, h: HGT, delay: DELAY, seconds: SECONDS, pos: g.pos, names: Object.fromEntries(parts.map(p => [p.id, p.name])) });
      H.pushScores(room);
      H.later(room, DELAY, () => H.loop(room, 100, () => tick(room)));
      H.later(room, DELAY + SECONDS * 1000, () => finish(room));
    },
    events: {
      'dodge:pos'(room, me, d) {
        const g = room.game;
        if (!g.alive.has(me.id) || !d) return;
        g.pos[me.id] = { x: clamp(num(d.x), 0, W), y: clamp(num(d.y), 0, HGT) };
      },
      'dodge:dead'(room, me) {
        const g = room.game;
        if (!g.alive.has(me.id) || Date.now() < g.t0) return;
        g.alive.delete(me.id);
        me.score = Math.floor(elapsed(g));
        H.emit(room, 'game:out', { id: me.id });
        H.sys(room, `💥 ${me.name} 님 탈락! (${me.score}초)`);
        H.pushScores(room);
        checkEnd(room);
      },
    },
    leave(room, p) { room.game.alive.delete(p.id); checkEnd(room); },
  };
};
