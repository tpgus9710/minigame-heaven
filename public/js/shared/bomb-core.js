/* =====================================================================
 *  💥 폭탄 배틀 엔진 — 화면(싱글 · 봇)과 서버(멀티)가 같은 코드를 씁니다.
 *  격자 15×13, 1번 step = 1/30초. 입력: { dir: 0정지 1위 2오른쪽 3아래 4왼쪽, bomb: true/false }
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BombCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const COLS = 15, ROWS = 13, TICK = 1 / 30, FUSE = 2.4, FLAME = 0.55, LIMIT = 180;
  const DIRS = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]];
  const SPAWNS = [[1, 1], [13, 11], [13, 1], [1, 11], [7, 1], [7, 11]];
  const COLORS = ['#4aa8ff', '#ff5d73', '#3fcf9b', '#ffc24b', '#a77cff', '#ff9f43'];
  const key = (x, y) => x + ',' + y;

  function newGame(players, rnd) {
    const safe = new Set();
    SPAWNS.slice(0, Math.max(players.length, 4)).forEach(([x, y]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => safe.add(key(x + dx, y + dy))));
    const grid = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) row.push('#');
        else row.push(!safe.has(key(x, y)) && rnd() < 0.72 ? 'x' : '.');
      }
      grid.push(row);
    }
    return {
      grid, rnd, time: 0, limit: LIMIT, over: false, winner: null, events: [], bombs: [], flames: new Map(), owner: new Map(), items: new Map(),
      players: players.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, color: COLORS[i % COLORS.length], x: SPAWNS[i][0] + 0.5, y: SPAWNS[i][1] + 0.5,
        dir: 3, moving: false, alive: true, speed: 3.4, bombs: 1, range: 2, active: 0, kills: 0, think: 0, plan: { dir: 0, bomb: false } })),
    };
  }

  const bombAt = (s, x, y) => s.bombs.find(b => !b.done && b.x === x && b.y === y);
  function blocked(s, x, y, p) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || s.grid[y][x] !== '.') return true;
    const b = bombAt(s, x, y);
    return !!b && !(p && b.pass.has(p.id));
  }

  /** 격자 이동 + 모퉁이 보정 (조금 어긋나 있어도 길로 미끄러져 들어가요) */
  function move(s, p, dir) {
    p.moving = !!dir;
    if (!dir) return;
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    let budget = p.speed * TICK;
    const cx = Math.floor(p.x), cy = Math.floor(p.y);
    if (dx) {
      const off = p.y - (cy + 0.5);
      if (Math.abs(off) > 0.02) {
        let row = cy;
        if (blocked(s, cx + dx, cy, p)) {
          const alt = cy + Math.sign(off);
          if (blocked(s, cx + dx, alt, p) || blocked(s, cx, alt, p)) return;
          row = alt;
        }
        const d = row + 0.5 - p.y, a = Math.min(Math.abs(d), budget);
        p.y += Math.sign(d) * a; budget -= a;
        if (Math.abs(row + 0.5 - p.y) > 0.02) return;
        p.y = row + 0.5;
      }
      const r = Math.floor(p.y), c = Math.floor(p.x);
      let nx = p.x + dx * budget;
      if (blocked(s, c + dx, r, p)) nx = dx > 0 ? Math.min(nx, c + 0.5) : Math.max(nx, c + 0.5);
      p.x = nx;
    } else {
      const off = p.x - (cx + 0.5);
      if (Math.abs(off) > 0.02) {
        let col = cx;
        if (blocked(s, cx, cy + dy, p)) {
          const alt = cx + Math.sign(off);
          if (blocked(s, alt, cy + dy, p) || blocked(s, alt, cy, p)) return;
          col = alt;
        }
        const d = col + 0.5 - p.x, a = Math.min(Math.abs(d), budget);
        p.x += Math.sign(d) * a; budget -= a;
        if (Math.abs(col + 0.5 - p.x) > 0.02) return;
        p.x = col + 0.5;
      }
      const r = Math.floor(p.y), c = Math.floor(p.x);
      let ny = p.y + dy * budget;
      if (blocked(s, c, r + dy, p)) ny = dy > 0 ? Math.min(ny, r + 0.5) : Math.max(ny, r + 0.5);
      p.y = ny;
    }
  }

  function placeBomb(s, p) {
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (p.active >= p.bombs || bombAt(s, x, y) || s.grid[y][x] !== '.') return;
    const pass = new Set(s.players.filter(o => o.alive && Math.floor(o.x) === x && Math.floor(o.y) === y).map(o => o.id));
    s.bombs.push({ x, y, t: FUSE, range: p.range, owner: p.id, pass });
    p.active++;
    s.events.push({ e: 'bomb', x, y });
  }

  /** 폭탄이 터질 칸 목록 (상자에서 멈춤) */
  function blast(s, b) {
    const cells = [[b.x, b.y]];
    for (let d = 1; d <= 4; d++) {
      const [dx, dy] = DIRS[d];
      for (let i = 1; i <= b.range; i++) {
        const x = b.x + dx * i, y = b.y + dy * i, c = s.grid[y] && s.grid[y][x];
        if (!c || c === '#') break;
        cells.push([x, y]);
        if (c === 'x') break;
      }
    }
    return cells;
  }
  function explode(s, b) {
    b.done = true;
    const owner = s.players.find(p => p.id === b.owner);
    if (owner) owner.active = Math.max(0, owner.active - 1);
    for (const [x, y] of blast(s, b)) {
      const k = key(x, y);
      if (s.grid[y][x] === 'x') {
        s.grid[y][x] = '.';
        if (s.rnd() < 0.34) s.items.set(k, ['b', 'f', 's'][Math.floor(s.rnd() * 3)]);
      } else if (s.items.has(k) && !(x === b.x && y === b.y)) s.items.delete(k);
      const other = bombAt(s, x, y);
      if (other) other.t = 0;                          // 연쇄 폭발
      s.flames.set(k, FLAME); s.owner.set(k, b.owner);
    }
    s.events.push({ e: 'boom', x: b.x, y: b.y });
  }

  function step(s, inputs) {
    s.events = [];
    if (s.over) return s;
    s.time += TICK;
    for (const p of s.players) {
      if (!p.alive) continue;
      const inp = p.bot ? botInput(s, p) : (inputs[p.id] || {});
      if (inp.bomb) placeBomb(s, p);                   // 폭탄은 지금 서 있는 칸에 먼저 놓고 이동
      move(s, p, inp.dir || 0);
    }
    for (const b of s.bombs) {                           // 폭탄 위에서 벗어나면 다시 못 지나감
      b.t -= TICK;
      for (const id of b.pass) { const p = s.players.find(o => o.id === id); if (!p || Math.abs(p.x - b.x - 0.5) > 0.9 || Math.abs(p.y - b.y - 0.5) > 0.9) b.pass.delete(id); }
    }
    let boom = s.bombs.filter(b => !b.done && b.t <= 0);
    while (boom.length) { boom.forEach(b => { if (!b.done) explode(s, b); }); boom = s.bombs.filter(b => !b.done && b.t <= 0); }
    s.bombs = s.bombs.filter(b => !b.done);
    for (const [k, t] of s.flames) { if (t - TICK <= 0) { s.flames.delete(k); s.owner.delete(k); } else s.flames.set(k, t - TICK); }
    for (const p of s.players) {
      if (!p.alive) continue;
      const k = key(Math.floor(p.x), Math.floor(p.y));
      if (s.flames.has(k)) {
        p.alive = false;
        const by = s.players.find(o => o.id === s.owner.get(k));
        if (by && by !== p) by.kills++;
        s.events.push({ e: 'die', id: p.id, by: by ? by.id : null });
      } else if (s.items.has(k)) {
        const it = s.items.get(k);
        s.items.delete(k);
        if (it === 'b') p.bombs = Math.min(8, p.bombs + 1);
        if (it === 'f') p.range = Math.min(8, p.range + 1);
        if (it === 's') p.speed = Math.min(6, p.speed + 0.45);
        s.events.push({ e: 'item', id: p.id, it });
      }
    }
    const alive = s.players.filter(p => p.alive);
    if ((s.players.length > 1 && alive.length <= 1) || alive.length === 0) { s.over = true; s.winner = alive[0] ? alive[0].id : null; }
    else if (s.time >= s.limit) { s.over = true; s.winner = null; }
    return s;
  }

  /* ─── 봇: 위험한 칸 피하기 → 아이템 줍기 → 상자·상대 옆에 폭탄 ─── */
  function dangerMap(s, extra) {
    const m = new Map();
    for (const k of s.flames.keys()) m.set(k, 0);
    const bombs = s.bombs.map(b => ({ x: b.x, y: b.y, t: b.t, range: b.range })).concat(extra ? [extra] : []);
    const cells = bombs.map(b => blast(s, b));
    for (let it = 0; it < 3; it++) bombs.forEach((a, i) => bombs.forEach(b => { if (b.t > a.t && cells[i].some(([x, y]) => x === b.x && y === b.y)) b.t = a.t; }));
    bombs.forEach((b, i) => cells[i].forEach(([x, y]) => { const k = key(x, y); m.set(k, Math.min(m.has(k) ? m.get(k) : 99, b.t)); }));
    return m;
  }
  function bfs(s, p, danger, maxD) {
    const sx = Math.floor(p.x), sy = Math.floor(p.y), start = key(sx, sy);
    const dist = new Map([[start, 0]]), first = new Map([[start, 0]]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift(), k0 = key(x, y), d0 = dist.get(k0);
      if (d0 >= maxD) continue;
      for (let d = 1; d <= 4; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], k = key(nx, ny);
        if (dist.has(k) || blocked(s, nx, ny, null)) continue;
        const arrive = (d0 + 1) / p.speed;
        if (danger.has(k)) { const t = danger.get(k); if (t < arrive + 0.4 && t > arrive - 0.75) continue; }   // 지나갈 때 불길이 있는 칸은 피함
        dist.set(k, d0 + 1); first.set(k, d0 === 0 ? d : first.get(k0)); q.push([nx, ny]);
      }
    }
    return { dist, first };
  }
  function nearest(found, test) {
    let best = null, bd = 1e9;
    for (const [k, d] of found.dist) if (d < bd && test(k)) { bd = d; best = k; }
    return best == null ? null : { k: best, d: bd, dir: found.first.get(best) };
  }
  const hasSafeSpot = (found, danger) => !!nearest(found, k => !danger.has(k));

  function botInput(s, p) {
    if (p.think-- > 0) return { dir: p.plan.dir, bomb: false };
    p.think = 2;
    const here = key(Math.floor(p.x), Math.floor(p.y));
    const danger = dangerMap(s);
    const found = bfs(s, p, danger, 12);
    let plan = { dir: 0, bomb: false };
    if (danger.has(here)) {
      const safe = nearest(found, k => !danger.has(k));
      plan.dir = safe ? safe.dir : 0;
    } else {
      const item = nearest(found, k => s.items.has(k) && !danger.has(k));
      const cx = Math.floor(p.x), cy = Math.floor(p.y);
      const nearBox = [1, 2, 3, 4].some(d => s.grid[cy + DIRS[d][1]][cx + DIRS[d][0]] === 'x');
      const foe = s.players.find(o => o !== p && o.alive && blast(s, { x: cx, y: cy, range: p.range }).some(([x, y]) => x === Math.floor(o.x) && y === Math.floor(o.y)));
      if (item && item.d <= 6) plan.dir = item.dir;
      else if ((nearBox || foe) && p.active < p.bombs && !bombAt(s, cx, cy) && s.rnd() < 0.85) {
        const extra = { x: cx, y: cy, t: FUSE, range: p.range };
        const d2 = dangerMap(s, extra);
        const f2 = bfs(s, p, d2, 10);
        const esc = nearest(f2, k => !d2.has(k));
        if (esc && esc.d / p.speed < FUSE - 0.6) plan = { dir: esc.dir, bomb: true };
      }
      if (!plan.bomb && !plan.dir) {
        const target = nearest(found, k => {
          if (danger.has(k)) return false;
          const [x, y] = k.split(',').map(Number);
          return [1, 2, 3, 4].some(d => s.grid[y + DIRS[d][1]][x + DIRS[d][0]] === 'x') ||
            s.players.some(o => o !== p && o.alive && Math.abs(Math.floor(o.x) - x) + Math.abs(Math.floor(o.y) - y) <= 2);
        });
        plan.dir = target && target.d > 0 ? target.dir : 0;
        if (!plan.dir && s.rnd() < 0.3) {                 // 할 일이 없으면 열린 안전한 칸으로 어슬렁
          const cx2 = Math.floor(p.x), cy2 = Math.floor(p.y);
          const open = [1, 2, 3, 4].filter(d => !blocked(s, cx2 + DIRS[d][0], cy2 + DIRS[d][1], null) && !danger.has(key(cx2 + DIRS[d][0], cy2 + DIRS[d][1])));
          if (open.length) plan.dir = open[Math.floor(s.rnd() * open.length)];
        }
        if (plan.dir) {                                    // 가려는 칸이 위험하면 멈춤
          const nx = Math.floor(p.x) + DIRS[plan.dir][0], ny = Math.floor(p.y) + DIRS[plan.dir][1];
          if (danger.has(key(nx, ny))) plan.dir = 0;
        }
      }
      if (plan.bomb && !hasSafeSpot(found, danger)) plan.bomb = false;
    }
    p.plan = plan;
    return plan;
  }

  /** 네트워크로 보낼 상태 */
  function snap(s) {
    return {
      g: s.grid.map(r => r.join('')).join(''),
      p: s.players.map(p => [+p.x.toFixed(2), +p.y.toFixed(2), p.dir, p.alive ? 1 : 0, p.moving ? 1 : 0, p.bombs, p.range, +p.speed.toFixed(2)]),
      b: s.bombs.map(b => [b.x, b.y, +b.t.toFixed(2)]), f: [...s.flames.keys()], i: [...s.items].map(([k, v]) => k + ':' + v),
      t: Math.max(0, Math.ceil(s.limit - s.time)), ev: s.events,
    };
  }
  return { COLS, ROWS, TICK, FUSE, COLORS, newGame, step, snap };
});
