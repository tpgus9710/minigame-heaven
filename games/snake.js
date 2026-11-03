'use strict';
/* 🐍 스네이크 배틀 — 벽·몸에 부딪히면 탈락, 마지막 생존자 또는 3분 뒤 가장 긴 뱀 우승 */
const W = 40, HGT = 28, TICK = 110, SECONDS = 180, FOOD = 7;
const COLORS = ['#4aa8ff', '#ff7a59', '#3fcf9b', '#a77cff', '#ffc24b', '#e85d9c', '#26b5c4', '#c9d1ff'];
const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];                 // 위, 오른쪽, 아래, 왼쪽
const STARTS = [[6, 6, 1], [33, 21, 3], [33, 6, 3], [6, 21, 1], [20, 4, 2], [19, 23, 0], [6, 14, 1], [33, 14, 3]];

module.exports = H => {
  const key = (x, y) => x + ',' + y;

  function addFood(g) {
    const occ = new Set(g.food.map(f => key(f[0], f[1])));
    for (const s of Object.values(g.snakes)) if (s.alive) s.body.forEach(c => occ.add(key(c[0], c[1])));
    for (let i = 0; i < 300; i++) {
      const x = H.rand(W), y = H.rand(HGT);
      if (!occ.has(key(x, y))) { g.food.push([x, y]); return; }
    }
  }
  function finish(room, title) {
    const g = room.game;
    const ranking = Object.entries(g.snakes)
      .sort(([, a], [, b]) => b.alive - a.alive || b.body.length - a.body.length)
      .map(([id, s]) => ({ id, name: s.name, value: `${s.alive ? '🐍' : '💀'} 길이 ${s.body.length}`, alive: s.alive }));
    // 이긴 사람: 살아남은 뱀 중 1등 (모두 탈락이면 없음)
    H.finishGame(room, { title, ranking, winners: ranking[0] && ranking[0].alive ? [ranking[0].id] : [] });
  }
  function checkEnd(room) {
    const g = room.game;
    const alive = Object.values(g.snakes).filter(s => s.alive);
    if (alive.length <= 1) { finish(room, alive[0] ? `🏆 ${alive[0].name} 최후의 생존자!` : '💥 모두 탈락!'); return true; }
    if (Date.now() >= g.endAt) {
      const best = alive.slice().sort((a, b) => b.body.length - a.body.length)[0];
      finish(room, `⏰ 시간 종료! ${best.name} 님이 가장 길어요!`);
      return true;
    }
    return false;
  }
  function kill(room, s) {
    s.alive = false;
    H.sys(room, `💀 ${s.name} 님 탈락! (길이 ${s.body.length})`);
    const g = room.game;
    s.body.forEach((c, i) => {                    // 쓰러진 뱀은 먹이가 됨
      if (i % 2 === 0 && c[0] >= 0 && c[0] < W && c[1] >= 0 && c[1] < HGT && g.food.length < 40) g.food.push([c[0], c[1]]);
    });
  }
  function step(room) {
    const g = room.game;
    if (!g || g.over) return;
    if (Date.now() >= g.freezeUntil) {
      const alive = Object.values(g.snakes).filter(s => s.alive);
      let changed = false;
      for (const s of alive) {
        if (s.queue.length) s.dir = s.queue.shift();
        const h = s.body[0];
        const nh = [h[0] + D[s.dir][0], h[1] + D[s.dir][1]];
        s.body.unshift(nh);
        const fi = g.food.findIndex(f => f[0] === nh[0] && f[1] === nh[1]);
        if (fi >= 0) { g.food.splice(fi, 1); s.grow += 2; changed = true; }
        if (s.grow > 0) s.grow--; else s.body.pop();
      }
      const cells = new Map();
      for (const s of alive) for (const c of s.body) { const k = key(c[0], c[1]); cells.set(k, (cells.get(k) || 0) + 1); }
      const dead = alive.filter(s => {
        const [x, y] = s.body[0];
        return x < 0 || x >= W || y < 0 || y >= HGT || cells.get(key(x, y)) > 1;
      });
      dead.forEach(s => kill(room, s));
      while (g.food.length < FOOD) addFood(g);
      for (const [id, s] of Object.entries(g.snakes)) { const p = H.getPlayer(room, id); if (p) p.score = s.body.length; }
      if (changed || dead.length) H.pushScores(room);
      if ((dead.length || Date.now() >= g.endAt) && checkEnd(room)) return;
    }
    H.emit(room, 'snake:state', {
      s: Object.entries(g.snakes).map(([id, s]) => ({ id, b: s.body, c: s.color, a: s.alive, n: s.name })),
      f: g.food, t: Math.max(0, Math.ceil((g.endAt - Date.now()) / 1000)), fz: Math.max(0, Math.ceil((g.freezeUntil - Date.now()) / 1000)),
    });
  }

  return {
    games: { snake: { name: '스네이크 배틀', min: 2, max: 8 } },
    start(room) {
      const snakes = {};
      H.participants(room).forEach((p, i) => {
        const [x, y, d] = STARTS[i];
        snakes[p.id] = { body: [0, 1, 2, 3].map(k => [x - D[d][0] * k, y - D[d][1] * k]), dir: d, queue: [], alive: true, grow: 0, color: COLORS[i], name: p.name };
        p.score = 4;
      });
      room.game = { type: 'snake', snakes, food: [], freezeUntil: Date.now() + 3000, endAt: Date.now() + 3000 + SECONDS * 1000 };
      for (let i = 0; i < FOOD; i++) addFood(room.game);
      H.emit(room, 'snake:start', { w: W, h: HGT });
      H.pushScores(room);
      H.loop(room, TICK, () => step(room));
    },
    events: {
      'snake:dir'(room, me, d) {
        const s = room.game.snakes[me.id];
        d = H.int(d, -1);
        if (!s || !s.alive || d < 0 || d > 3) return;
        const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
        if (d === last || (d + 2) % 4 === last) return;      // 같은 방향·정반대 방향 무시
        if (s.queue.length < 2) s.queue.push(d);
      },
    },
    leave(room, p) {
      const s = room.game.snakes[p.id];
      if (s && s.alive) { kill(room, s); checkEnd(room); }
    },
  };
};
