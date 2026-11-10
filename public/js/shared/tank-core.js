/* =====================================================================
 *  🛡️ 탱크 대포 엔진 — 화면(싱글 · AI)과 서버(멀티)가 같은 코드를 씁니다.
 *  지형은 처음에 x마다 땅 높이(h[x])로 만들고, 게임 중에는 픽셀 단위 땅 지도(m)로 계산해요.
 *  (포트리스처럼 옆면에 맞아도 둥글게 파이고, 굴 · 처마도 생겨요) 포탄은 1/60초 단위로 계산합니다.
 *  🚁 헬기 보급 (v13.3): 차례가 바뀔 때 가끔 헬기가 지나가며 상자를 떨어뜨려요 (판 위 상자는 2개까지)
 *     ❤️ 회복 키트 (+30 HP) · 🔆 광역 레이저 · ☄️ 유성우 (특별탄 1발)
 *     가져가기: 탱크가 상자에 닿거나(이동) · 내 포탄이 상자 근처에서 터지면 쏜 사람이 가져가요
 *     상자 밑 땅이 파이면 상자도 떨어지고, 화면 아래로 빠지면 없어져요
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TankCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 960, H = 540, G = 0.18, TANK_R = 14, MAX_FUEL = 100;
  const COLORS = ['#4aa8ff', '#ff5d73', '#3fcf9b', '#ffc24b', '#a77cff', '#ff9f43'];
  const WEAPONS = {
    normal: { name: '일반탄', icon: '●', dmg: 34, r: 30 },
    big: { name: '대형탄', icon: '💣', dmg: 48, r: 46, ammo: 2 },
    triple: { name: '3연발', icon: '✨', dmg: 22, r: 24, ammo: 2 },
    laser: { name: '광역 레이저', icon: '🔆', dmg: 52, r: 90, carve: 44, beam: true, drop: true },    // 맞은 자리에 하늘에서 넓은 빛기둥 (가로 거리로 피해)
    meteor: { name: '유성우', icon: '☄️', dmg: 24, r: 28, rain: 5, drop: true },                        // 맞은 자리 둘레에 운석 5개
  };
  const ITEMS = {
    heal: { name: '회복 키트', icon: '❤️' },
    laser: { name: '광역 레이저', icon: '🔆' },
    meteor: { name: '유성우', icon: '☄️' },
  };
  const HEAL = 30, DROP_CHANCE = 0.35, MAX_ITEMS = 2;
  const rad = a => (a * Math.PI) / 180;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const FOOT = 10;                                   // 탱크 바퀴 반 너비: 이 안에 땅이 한 곳이라도 있으면 걸쳐서 서 있어요

  /* ── 픽셀 땅 지도: m[y*W+x] = 1 이면 땅 ── */
  function buildMask(h) {
    const m = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) for (let y = Math.max(0, Math.round(h[x])); y < H; y++) m[y * W + x] = 1;
    return m;
  }
  /** 이 점이 땅인지 (화면 아래 끝은 땅, 양옆 바깥 · 위쪽은 하늘) */
  function solid(s, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || x >= W || y < 0) return false;
    if (y >= H) return true;
    return s.m[y * W + x] === 1;
  }
  /** x 줄에서 y0 아래로 처음 만나는 땅 (없으면 H) */
  function below(s, x, y0) {
    x = clamp(Math.round(x), 0, W - 1);
    for (let y = Math.max(0, Math.round(y0)); y < H; y++) if (s.m[y * W + x]) return y;
    return H;
  }
  /** 탱크가 x에서 y0 높이부터 내려오면 멈추는 곳 (바퀴 폭 안에서 가장 높은 땅) */
  function restY(s, x, y0) {
    let best = H;
    for (let c = Math.round(x) - FOOT; c <= Math.round(x) + FOOT; c++) if (c >= 0 && c < W) best = Math.min(best, below(s, c, y0));
    return best;
  }
  /** 줄마다 맨 위 땅 높이 (예전 화면과 맞추려고 보내요) */
  const tops = s => Array.from({ length: W }, (_, x) => below(s, x, 0));
  /** 둥글게 파기 */
  function carve(s, cx, cy, r) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))));
      const x0 = Math.max(0, cx - half), x1 = Math.min(W - 1, cx + half);
      if (x0 <= x1) s.m.fill(0, y * W + x0, y * W + x1 + 1);
    }
    s.carves.push([cx, cy, r]);
  }

  function makeTerrain(rnd) {
    const base = 330 + rnd() * 70, waves = [];
    for (let i = 0; i < 4; i++) waves.push({ a: (45 + rnd() * 55) / (i + 1), f: (0.0035 + rnd() * 0.004) * (i + 1), p: rnd() * 6.28 });
    const h = [];
    for (let x = 0; x < W; x++) h.push(Math.round(clamp(waves.reduce((y, w) => y + w.a * Math.sin(w.f * x + w.p), base), 150, H - 50)));
    return h;
  }
  const windRoll = rnd => Math.round((rnd() * 2 - 1) * 10);

  function newGame(players, rnd) {
    const h = makeTerrain(rnd), n = players.length, margin = 90;
    const xs = players.map((_, i) => (n === 1 ? W / 2 : margin + ((W - margin * 2) / (n - 1)) * i + (rnd() - 0.5) * 40));
    for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
    const s = {
      W, H, h, rnd, wind: windRoll(rnd), turn: 0, over: false, winner: null,
      tanks: players.map((p, i) => {
        const x = Math.round(xs[i]);
        return { id: p.id, name: p.name, bot: !!p.bot, color: COLORS[i % COLORS.length], x, y: 0, hp: 100, alive: true,
          angle: x < W / 2 ? 55 : 125, power: 60, fuel: MAX_FUEL, ammo: { big: WEAPONS.big.ammo, triple: WEAPONS.triple.ammo, laser: 0, meteor: 0 } };
      }),
      items: [], itemSeq: 0, turns: 0, drop: null, got: [],
    };
    s.tanks.forEach(t => flatten(s, t.x));
    s.m = buildMask(h); s.carves = [];
    s.tanks.forEach(t => { t.y = restY(s, t.x, 0); });
    return s;
  }
  /** 탱크가 설 자리를 살짝 평평하게 */
  function flatten(s, x) {
    const y = s.h[clamp(x, 0, W - 1)];
    for (let i = x - 12; i <= x + 12; i++) if (i >= 0 && i < W) s.h[i] = Math.round((s.h[i] + y) / 2);
  }
  const active = s => s.tanks[s.turn];
  const muzzle = (t, a) => ({ x: t.x + Math.cos(rad(a)) * 20, y: t.y - 12 - Math.sin(rad(a)) * 20 });

  /** 포탄 궤적 계산 (땅이나 탱크에 닿을 때까지) — 한 칸씩 잘게 나눠 봐서 얇은 벽도 뚫고 지나가지 않아요 */
  function simulate(s, x, y, vx, vy, shooterId) {
    const path = [[Math.round(x), Math.round(y)]], ax = s.wind * 0.0045;
    for (let i = 0; i < 1600; i++) {
      vx += ax; vy += G;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)) / 3));
      for (let k = 1; k <= n; k++) {
        const px = x + (vx * k) / n, py = y + (vy * k) / n;
        if (solid(s, px, py)) { path.push([Math.round(px), Math.round(py)]); return { path, hit: { x: px, y: py } }; }
        for (const t of s.tanks) {
          if (!t.alive || (t.id === shooterId && i < 8)) continue;
          const dx = t.x - px, dy = t.y - 9 - py;
          if (dx * dx + dy * dy < TANK_R * TANK_R) { path.push([Math.round(px), Math.round(py)]); return { path, hit: { x: px, y: py } }; }
        }
      }
      x += vx; y += vy;
      if (i % 2 === 1) path.push([Math.round(x), Math.round(y)]);
      if (x < -400 || x > W + 400 || y > H + 60) return { path, hit: null };
    }
    return { path, hit: null };
  }
  function explode(s, cx, cy, w, shooterId) {
    const R = w.r;
    carve(s, cx, cy, w.carve || R);                     // 옆면 · 아래 · 위 어디에 맞아도 둥글게 파여요 (레이저는 땅은 덜 파요)
    const hits = [];
    for (const t of s.tanks) {
      if (!t.alive) continue;
      const d = w.beam ? Math.abs(t.x - cx) : Math.hypot(t.x - cx, t.y - 9 - cy);   // 빛기둥: 위아래 상관없이 가로 거리
      if (d < R + 16) {
        const k = w.beam ? (d < R * 0.6 ? 1 : Math.max(0.3, 1 - (d - R * 0.6) / (R * 0.4 + 16)))      // 빛기둥: 가운데 넓게 같은 피해
          : Math.max(0.3, 1 - d / (R + 16));
        const dmg = Math.round(w.dmg * k); t.hp -= dmg; hits.push({ id: t.id, dmg });
      }
    }
    const shooter = s.tanks.find(t => t.id === shooterId);         // 상자 근처에서 터지면 쏜 사람이 가져가요
    for (const it of s.items.slice()) {
      const d = w.beam ? Math.abs(it.x - cx) : Math.hypot(it.x - cx, it.y - 8 - cy);
      if (d < R + 14) collect(s, shooter, it);
    }
    return { x: Math.round(cx), y: Math.round(cy), r: R, hits, beam: !!w.beam };
  }
  /* ── 🚁 보급 상자 ── */
  /** 상자 가져가기 (쏜 사람이 이미 파괴됐으면 상자만 없어져요) */
  function collect(s, t, it) {
    s.items = s.items.filter(x => x !== it);
    if (!t || t.hp <= 0) { s.got.push({ id: null, kind: it.kind, x: it.x, y: it.y, item: it.id, lost: true }); return null; }
    const g = { id: t.id, name: t.name, kind: it.kind, x: it.x, y: it.y, item: it.id };
    if (it.kind === 'heal') { const b = t.hp; t.hp = Math.min(100, t.hp + HEAL); g.hp = t.hp - b; }
    else t.ammo[it.kind] = (t.ammo[it.kind] || 0) + 1;
    s.got.push(g);
    return g;
  }
  /** 탱크가 상자에 닿았는지 (이동 · 떨어짐 뒤) */
  function touch(s, t) {
    if (!t || !t.alive) return;
    for (const it of s.items.slice()) if (Math.abs(t.x - it.x) < 22 && Math.abs(t.y - it.y) < 26) collect(s, t, it);
  }
  /** 헬기가 떨어뜨릴 상자 (차례가 바뀔 때 가끔) */
  function spawnDrop(s) {
    const r = s.rnd(), kind = r < 0.6 ? 'heal' : r < 0.85 ? 'laser' : 'meteor';
    let x = W / 2;
    for (let k = 0; k < 14; k++) {
      x = Math.round(60 + s.rnd() * (W - 120));
      if (s.tanks.every(t => !t.alive || Math.abs(t.x - x) > 46) && s.items.every(o => Math.abs(o.x - x) > 46)) break;
    }
    const y = below(s, x, 0);
    if (y >= H - 4) return null;                          // 바닥 없는 구멍 위면 그만
    const it = { id: ++s.itemSeq, kind, x, y };
    s.items.push(it);
    return { ...it, dir: s.rnd() < 0.5 ? 1 : -1 };
  }
  const items = s => s.items.map(it => ({ id: it.id, kind: it.kind, x: it.x, y: it.y }));
  /** 땅이 꺼지면 탱크 · 상자가 떨어짐 (탱크는 높이 떨어지면 피해) */
  function settle(s) {
    for (const it of s.items.slice()) {                  // 상자: 밑 땅이 없으면 떨어지고, 화면 아래로 빠지면 없어져요
      const y = below(s, it.x, it.y - 2);
      if (y >= H - 2) { s.items = s.items.filter(x => x !== it); s.got.push({ id: null, kind: it.kind, x: it.x, y: it.y, item: it.id, lost: true }); }
      else if (y > it.y) it.y = y;
    }
    const falls = [];
    for (const t of s.tanks) {
      if (!t.alive) continue;
      const y = restY(s, t.x, t.y);                     // 바퀴 밑 땅이 사라지면 떨어져요
      if (y > t.y + 1) {
        const fall = y - t.y;
        t.y = y;
        if (fall > 30) { const dmg = Math.round((fall - 30) / 3); t.hp -= dmg; falls.push({ id: t.id, dmg }); }
        if (y >= H - 2) t.hp = 0;
      }
    }
    for (const t of s.tanks) if (t.alive && t.hp > 0) touch(s, t);   // 떨어진 자리에 상자가 있으면 가져가요
    return falls;
  }
  function checkDeaths(s) {
    for (const t of s.tanks) if (t.alive && t.hp <= 0) { t.hp = 0; t.alive = false; }
    const alive = s.tanks.filter(t => t.alive);
    if (alive.length <= 1 && s.tanks.length > 1) { s.over = true; s.winner = alive[0] ? alive[0].id : null; }
  }

  function fire(s, id, angle, power, weapon) {
    const t = s.tanks.find(o => o.id === id);
    let wk = WEAPONS[weapon] ? weapon : 'normal';
    if (wk !== 'normal') { if (t.ammo[wk] > 0) t.ammo[wk]--; else wk = 'normal'; }
    const w = WEAPONS[wk];
    t.angle = clamp(Math.round(angle), 0, 180); t.power = clamp(Math.round(power), 5, 100);
    const angles = wk === 'triple' ? [t.angle - 5, t.angle, t.angle + 5] : [t.angle];
    const shots = angles.map(a => {
      const m = muzzle(t, a), v = (t.power / 100) * 15.5;
      return simulate(s, m.x, m.y, Math.cos(rad(a)) * v, -Math.sin(rad(a)) * v, id);
    });
    const booms = shots.filter(sh => sh.hit).map(sh => explode(s, sh.hit.x, sh.hit.y, w, id));
    if (w.rain && shots[0].hit) {                          // ☄️ 유성우: 맞은 자리 둘레에 하늘에서 운석이 차례로 (첫 발이 닿은 뒤에)
      const hx = shots[0].hit.x, wait = shots[0].path.length;
      for (let i = 0; i < w.rain; i++) {
        const x0 = clamp(hx + (i - (w.rain - 1) / 2) * 46 + (s.rnd() - 0.5) * 18, 4, W - 4);
        const sim = simulate(s, x0 - s.wind * 3, -30, s.wind * 0.12, 3, null);
        sim.path = Array(wait + i * 7).fill(sim.path[0]).concat(sim.path);   // 앞을 같은 점으로 채워서 늦게 출발
        shots.push(sim);
        if (sim.hit) booms.push(explode(s, sim.hit.x, sim.hit.y, w, id));
      }
    }
    const falls = settle(s);
    checkDeaths(s);
    return { id, angle: t.angle, power: t.power, weapon: wk, shots: shots.map(sh => sh.path), booms, falls, carves: s.carves.slice(), h: tops(s), tanks: view(s),
      got: s.got.splice(0), items: items(s) };
  }
  function nextTurn(s) {
    if (s.over) return;
    for (let k = 0; k < s.tanks.length; k++) { s.turn = (s.turn + 1) % s.tanks.length; if (s.tanks[s.turn].alive) break; }
    s.wind = windRoll(s.rnd);
    active(s).fuel = MAX_FUEL;
    s.turns = (s.turns || 0) + 1;                         // 🚁 두 번째 차례부터, 판 위 상자가 2개보다 적으면 가끔
    s.drop = s.turns >= 2 && s.items.length < MAX_ITEMS && s.rnd() < DROP_CHANCE ? spawnDrop(s) : null;
  }
  /** 내 차례에 좌우 이동 (연료 소모, 너무 가파르면 못 올라감) */
  function move(s, id, dir, dt) {
    const t = active(s);
    if (!t || t.id !== id || !dir || t.fuel <= 0) return false;
    const nx = clamp(t.x + dir * 45 * dt, 8, W - 8), up = 45 * dt * 1.6;
    const ny = restY(s, nx, t.y - up - 1);              // 조금 높은 곳까지는 올라가고, 더 높으면 벽이에요
    if (ny < t.y - up || ny >= H - 2) return false;     // 너무 가파르거나 · 바닥 없는 구멍으로는 못 가요
    t.fuel = Math.max(0, t.fuel - Math.abs(nx - t.x));
    t.x = nx; t.y = ny;
    touch(s, t);                                        // 상자에 닿으면 가져가요 (s.got 에 쌓여요)
    return true;
  }
  const view = s => s.tanks.map(t => ({ id: t.id, x: Math.round(t.x), y: Math.round(t.y), hp: t.hp, alive: t.alive, angle: t.angle, power: t.power, fuel: Math.round(t.fuel), ammo: t.ammo }));

  /** AI: 각도·힘을 바꿔 가며 미리 쏴 보고 가장 가까이 떨어지는 값을 고름 (level 0~1) */
  function aiPlan(s, id, level) {
    const lv = level == null ? 0.6 : level;
    const t = s.tanks.find(o => o.id === id);
    const foes = s.tanks.filter(o => o.alive && o.id !== id).sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x));
    const target = foes[0];
    if (!target) return { angle: t.angle, power: t.power, weapon: 'normal' };
    const right = target.x > t.x;
    let best = { d: 1e9, angle: right ? 45 : 135, power: 60 };
    for (let a = 15; a <= 80; a += 3) {
      const ang = right ? a : 180 - a;
      for (let p = 25; p <= 100; p += 3) {
        const m = muzzle(t, ang), v = (p / 100) * 15.5;
        const sim = simulate(s, m.x, m.y, Math.cos(rad(ang)) * v, -Math.sin(rad(ang)) * v, id);
        if (!sim.hit) continue;
        const d = Math.hypot(sim.hit.x - target.x, sim.hit.y - target.y);
        if (d < best.d) best = { d, angle: ang, power: p };
      }
    }
    const err = 1 - lv;
    const weapon = t.ammo.laser > 0 && s.rnd() < 0.7 ? 'laser' : t.ammo.meteor > 0 && s.rnd() < 0.6 ? 'meteor'
      : t.ammo.big > 0 && s.rnd() < 0.3 ? 'big' : t.ammo.triple > 0 && s.rnd() < 0.25 ? 'triple' : 'normal';
    return { angle: clamp(Math.round(best.angle + (s.rnd() - 0.5) * 10 * err), 0, 180), power: clamp(Math.round(best.power + (s.rnd() - 0.5) * 16 * err), 10, 100), weapon };
  }
  return { W, H, G, TANK_R, MAX_FUEL, WEAPONS, ITEMS, HEAL, COLORS, newGame, fire, nextTurn, move, aiPlan, view, items, active, muzzle, solid, restY, tops, collect, spawnDrop };
});
