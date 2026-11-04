/* =====================================================================
 *  🏃 점프 어드벤처 (싱글: 스테이지 모험 / 멀티: 점프 레이스)
 *  스테이지는 시드로 만들어져서 같은 시드면 모두 같은 맵을 달려요.
 * ===================================================================== */
const PL = { T: 32, W: 800, H: 448, ROWS: 14, GRAV: 1900, JUMP: 640, WALK: 250, RUN: 330 };
const PL_SOLID = new Set(['#', 'B', 'P', 'I', 'U', 'J']);
makeScreen('plat', {
  title: '🏃 점프 어드벤처', status: '←→ 이동 · ↑/스페이스 점프 · Shift 달리기 · 적은 위에서 밟아요!',
  stats: [['stage', '스테이지'], ['coin', '코인'], ['life', '목숨']],
  body: `<div class="center"><canvas id="plat-cv" class="game-cv" width="${PL.W}" height="${PL.H}"></canvas></div>`,
});

/** 스테이지 만들기: 여러 구간(구덩이·계단·적·가시·움직이는 발판 …)을 이어 붙임 */
function genPlatLevel(seed, stage) {
  const rnd = seeded(seed * 31 + stage * 7919), R = PL.ROWS, T = PL.T, cols = [], ents = [];
  const ri = n => Math.floor(rnd() * n);
  let gh = 11;
  const col = h => { const c = Array(R).fill('.'); for (let y = h == null ? gh : h; y < R; y++) c[y] = '#'; cols.push(c); };
  const at = (x, y, ch) => { if (cols[x] && y >= 0 && y < R) cols[x][y] = ch; };
  const flat = n => { for (let i = 0; i < n; i++) col(); };
  const pit = n => { for (let i = 0; i < n; i++) col(R); };
  const coins = (x0, n, y) => { for (let i = 0; i < n; i++) at(x0 + i, y, 'C'); };
  const enemy = (type, x, y) => ents.push({ type, x: x * T + 3, y: (y + 1) * T - (type === 'spiker' ? 24 : type === 'bat' ? 16 : 20), x0: x * T, y0: y * T });
  const SEG = {
    gap() { const n = 2 + ri(2 + Math.min(1, stage >> 1)), x0 = cols.length; pit(n); coins(x0, n, gh - 3); flat(2); },
    step() { gh = clamp(gh + (rnd() < 0.5 ? -1 : 1) * (1 + ri(2)), 8, 12); flat(3 + ri(3)); },
    pyramid() { const k = 3 + ri(2); for (let i = 0; i < k * 2; i++) { col(); const h = i < k ? i + 1 : k * 2 - i; for (let y = 1; y <= h; y++) at(cols.length - 1, gh - y, 'B'); } flat(2); },
    floaters() { const n = 5 + ri(3), x0 = cols.length; pit(n); for (let p = 0; p * 3 < n - 1; p++) { const px = x0 + p * 3, py = gh - 2 - ri(2); at(px, py, 'B'); at(px + 1, py, 'B'); at(px, py - 2, 'C'); } flat(2); },
    boxes() { const x0 = cols.length; flat(7); for (let i = 1; i < 6; i++) at(x0 + i, gh - 4, i % 2 ? 'B' : 'I'); if (rnd() < 0.7) enemy('slime', x0 + 5, gh - 1); },
    enemies() { const x0 = cols.length, n = 7 + ri(3); flat(n); const k = 1 + ri(2 + Math.min(2, stage >> 1)); for (let i = 0; i < k; i++) enemy(stage >= 2 && rnd() < 0.3 ? 'spiker' : 'slime', x0 + 2 + i * 2, gh - 1); coins(x0 + 1, n - 2, gh - 3); },
    spikes() { const x0 = cols.length, n = 1 + ri(2 + Math.min(1, stage >> 1)); flat(3 + n + 3); for (let i = 0; i < n; i++) at(x0 + 3 + i, gh - 1, 'S'); coins(x0 + 3, n, gh - 4); },
    pillar() { const x0 = cols.length, h = 2 + ri(2); flat(7); for (let i = 0; i < 2; i++) for (let y = 1; y <= h; y++) at(x0 + 2 + i, gh - y, 'P'); if (stage >= 2 && rnd() < 0.5) enemy('spiker', x0 + 5, gh - 1); },
    mover() { const n = 6 + ri(3), x0 = cols.length; pit(n); ents.push({ type: 'mover', x0: x0 * T + 4, x1: (x0 + n - 3) * T - 4, y: (gh - 1) * T, w: 96, h: 14, t: rnd() * 6, x: x0 * T }); flat(2); },
    spring() { const x0 = cols.length, h = 4 + ri(2); flat(8); at(x0 + 1, gh - 1, 'J'); for (let i = 0; i < 2; i++) for (let y = 1; y <= h; y++) at(x0 + 3 + i, gh - y, 'P'); coins(x0 + 3, 2, gh - h - 2); },
    bats() { const x0 = cols.length; flat(8); enemy('bat', x0 + 4, gh - 3); if (stage >= 3) enemy('bat', x0 + 7, gh - 4); },
  };
  const pool = ['gap', 'step', 'pyramid', 'floaters', 'boxes', 'enemies', 'spikes', 'pillar', 'mover', 'spring', 'bats', 'enemies', 'gap', 'boxes', 'step'];
  flat(10);
  const length = 120 + stage * 25;
  let check = null;
  while (cols.length < length) {
    SEG[pool[ri(pool.length)]]();
    if (!check && cols.length > length / 2) { const x = cols.length; flat(3); check = { type: 'check', x: x * T, y: (gh - 2) * T, rx: x * T, ry: (gh - 1) * T - 28 }; ents.push(check); }
  }
  flat(4);
  const gx = cols.length;
  flat(12);
  ents.push({ type: 'goal', x: gx * T, y: (gh - 3) * T });
  const tiles = [];
  for (let y = 0; y < R; y++) tiles.push(cols.map(c => c[y]));
  return { w: cols.length, tiles, ents, goalX: gx * T, startY: (11 - 1) * T - 28 };
}

const Plat = {
  begin(multi, seed, stage) {
    this.multi = multi; this.seed = seed; this.stage = stage;
    const L = this.L = genPlatLevel(seed, stage);
    this.enemies = L.ents.filter(e => ['slime', 'spiker', 'bat'].includes(e.type)).map(e => ({ ...e, w: 26, h: e.type === 'spiker' ? 24 : e.type === 'bat' ? 16 : 20, vx: e.type === 'spiker' ? -40 : -55, vy: 0, alive: true, t: 0 }));
    this.movers = L.ents.filter(e => e.type === 'mover').map(e => ({ ...e }));
    this.check = L.ents.find(e => e.type === 'check');
    this.goal = L.ents.find(e => e.type === 'goal');
    this.spawn = { x: 3 * PL.T, y: L.startY };
    this.p = { x: this.spawn.x, y: this.spawn.y, w: 22, h: 28, vx: 0, vy: 0, onGround: false, face: 1, coyote: 0, buffer: 0, inv: 0, shield: false, dead: false, deadT: 0, anim: 0, ride: null };
    this.cam = 0; this.done = false; this.pops = []; this.checked = false; this.clearT = 0;
  },
  startSolo() {
    stopLocal();
    S.solo = 'plat';
    this.lives = 3; this.coins = 0; this.score = 0; this.over = false;
    this.begin(false, rand(1e9), 1);
    setStatus('plat', TOUCH ? '왼쪽 엄지로 밀어서 이동(끝까지 밀면 달리기) · 오른쪽을 누르면 점프 · 적은 위에서 밟아요!' : '←→ 이동 · ↑/스페이스 점프 · Shift 달리기 · 적은 위에서 밟아요!');
    $('#plat-life-label').textContent = '목숨'; $('#plat-coin-label').textContent = '코인';
    show('plat'); this.hud();
    this.t0 = performance.now() + 600;
    gameLoop((dt, now) => this.frame(dt, now));
  },
  startMulti(d) {
    stopLocal();
    this.lives = Infinity; this.coins = 0; this.score = 0; this.over = false;
    this.begin(true, d.seed, d.stage);
    this.ghosts = {}; this.sendT = 0; this.endAt = performance.now() + d.delay + d.seconds * 1000;
    $('#plat-life-label').textContent = '남은 시간'; $('#plat-coin-label').textContent = '진행';
    setStatus('plat', '🏁 같은 스테이지를 누가 먼저 통과할까! 떨어지면 체크포인트에서 다시 시작해요.');
    show('plat'); renderScores(); this.hud();
    this.t0 = performance.now() + d.delay;
    gameLoop((dt, now) => this.frame(dt, now));
  },
  hud() {
    setStat('plat', 'stage', this.stage);
    if (this.multi) { setStat('plat', 'coin', this.progress() + '%'); setStat('plat', 'life', leftSec(this.endAt)); }
    else { setStat('plat', 'coin', this.coins); setStat('plat', 'life', '❤️'.repeat(Math.max(0, this.lives))); }
  },
  progress() { return clamp(Math.round((this.p.x / this.L.goalX) * 100), 0, this.done ? 100 : 99); },

  solid(tx, ty) {
    if (tx < 0) return true;
    if (tx >= this.L.w || ty < 0 || ty >= PL.ROWS) return false;
    return PL_SOLID.has(this.L.tiles[ty][tx]);
  },
  tile(tx, ty) { return ty >= 0 && ty < PL.ROWS && tx >= 0 && tx < this.L.w ? this.L.tiles[ty][tx] : '.'; },
  moveX(o, dx) {
    o.x += dx; o.hitWall = false;
    const T = PL.T, y0 = Math.floor(o.y / T), y1 = Math.floor((o.y + o.h - 1) / T);
    const tx = dx > 0 ? Math.floor((o.x + o.w) / T) : Math.floor(o.x / T);
    if (!dx) return;
    for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { o.x = dx > 0 ? tx * T - o.w : (tx + 1) * T; o.vx = 0; o.hitWall = true; return; }
  },
  moveY(o, dy) {
    o.y += dy; o.onGround = false; o.bump = null; o.land = null;
    const T = PL.T, x0 = Math.floor(o.x / T), x1 = Math.floor((o.x + o.w - 1) / T);
    if (dy > 0) { const ty = Math.floor((o.y + o.h) / T); for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) { o.y = ty * T - o.h; o.vy = 0; o.onGround = true; o.land = [tx, ty]; return; } }
    else if (dy < 0) { const ty = Math.floor(o.y / T); for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) { o.y = (ty + 1) * T; o.vy = 0; o.bump = [tx, ty]; return; } }
  },

  frame(dt, now) {
    if (now >= this.t0 && !this.over) {
      const n = dt > 1 / 50 ? 2 : 1;
      for (let i = 0; i < n; i++) this.step(dt / n);
    }
    if (this.multi) {
      for (const g of Object.values(this.ghosts)) { g.x += (g.tx - g.x) * Math.min(1, dt * 12); g.y += (g.ty - g.y) * Math.min(1, dt * 12); }
      if ((this.sendT -= dt) <= 0) { this.sendT = 0.1; socket.emit('plat:pos', { x: this.p.x, y: this.p.y, f: this.p.face < 0, a: this.p.dead ? 7 : this.p.onGround ? (Math.abs(this.p.vx) > 20 ? 1 : 0) : 2, p: this.progress() }); }
      this.hud();
    }
    this.draw(now < this.t0 ? Math.ceil((this.t0 - now) / 1000) : 0);
  },
  step(dt) {
    const p = this.p, T = PL.T;
    for (const m of this.movers) { m.t += dt; const nx = m.x0 + (m.x1 - m.x0) * (Math.sin(m.t * 0.9) + 1) / 2; m.dx = nx - m.x; m.x = nx; }
    this.pops = this.pops.filter(q => (q.t -= dt) > 0);
    if (this.clearT > 0) { if ((this.clearT -= dt) <= 0) this.nextStage(); return; }
    if (p.dead) {
      p.vy += PL.GRAV * dt; p.y += p.vy * dt;
      if ((p.deadT -= dt) <= 0) this.respawn();
      return;
    }
    // 입력
    const dir = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
    const max = held('ShiftLeft', 'ShiftRight', 'KeyX') ? PL.RUN : PL.WALK;
    if (dir) { p.vx = clamp(p.vx + dir * 1500 * dt, -max, max); p.face = dir; }
    else p.vx = Math.abs(p.vx) < 1800 * dt ? 0 : p.vx - Math.sign(p.vx) * 1800 * dt;
    const jumpHeld = held('Space', 'ArrowUp', 'KeyW');
    p.buffer -= dt; p.coyote -= dt; p.inv -= dt;
    if (p.buffer > 0 && (p.onGround || p.coyote > 0)) { p.vy = -PL.JUMP; p.buffer = 0; p.coyote = 0; p.onGround = false; p.ride = null; }
    p.vy = Math.min(900, p.vy + PL.GRAV * (p.vy < 0 && !jumpHeld ? 2.3 : 1) * dt);
    if (p.ride && p.onGround) this.moveX(p, p.ride.dx);
    this.moveX(p, p.vx * dt);
    const prevBottom = p.y + p.h, wasGround = p.onGround;
    this.moveY(p, p.vy * dt);
    if (!p.onGround) p.ride = null;
    for (const m of this.movers) {                                // 움직이는 발판: 위에서만 올라탈 수 있음
      if (p.vy >= 0 && prevBottom <= m.y + 2 && p.y + p.h >= m.y && p.x + p.w > m.x && p.x < m.x + m.w) { p.y = m.y - p.h; p.vy = 0; p.onGround = true; p.ride = m; }
    }
    if (wasGround && !p.onGround && p.vy >= 0) p.coyote = 0.09;
    if (p.land && this.tile(p.land[0], p.land[1]) === 'J') { p.vy = -PL.JUMP * 1.5; p.onGround = false; this.pops.push({ x: p.x, y: p.y + p.h, t: 0.3, txt: '🌀' }); }
    if (p.bump) this.hitBox(p.bump[0], p.bump[1]);
    p.anim += Math.abs(p.vx) * dt * 0.05;
    // 코인 · 가시
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 1) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 1) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = this.tile(tx, ty);
      if (t === 'C') { this.L.tiles[ty][tx] = '.'; this.addCoin(); }
      if (t === 'S' && p.y + p.h > ty * T + 14) this.hurt();
    }
    if (p.y > PL.ROWS * T + 40) return this.die();
    // 적
    for (const e of this.enemies) {
      if (!e.alive) { e.t -= dt; continue; }
      if (Math.abs(e.x - p.x) > PL.W) continue;
      if (e.type === 'bat') { e.t += dt; e.x = e.x0 + Math.sin(e.t * 1.3) * 80; e.y = e.y0 + Math.sin(e.t * 3) * 18; }
      else {
        e.vy = Math.min(900, e.vy + PL.GRAV * dt);
        this.moveX(e, e.vx * dt);
        if (e.hitWall) e.vx = -e.vx;
        this.moveY(e, e.vy * dt);
        if (e.onGround) { const fx = Math.floor((e.vx > 0 ? e.x + e.w + 2 : e.x - 2) / T), fy = Math.floor((e.y + e.h + 4) / T); if (!this.solid(fx, fy)) e.vx = -e.vx; }
        if (e.y > PL.ROWS * T) e.alive = false;
      }
      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        if (e.type !== 'spiker' && p.vy > 0 && p.y + p.h - e.y < 18) { e.alive = false; e.t = 0.4; p.vy = -440; this.score += 50; this.pops.push({ x: e.x, y: e.y, t: 0.6, txt: '+50' }); }
        else this.hurt();
      }
    }
    if (this.check && !this.checked && p.x > this.check.x) { this.checked = true; this.spawn = { x: this.check.rx, y: this.check.ry }; this.pops.push({ x: this.check.x, y: this.check.y - 10, t: 1, txt: '체크포인트!' }); }
    if (!this.done && p.x + p.w > this.goal.x + 8) this.reachGoal();
    this.cam = clamp(p.x - PL.W * 0.4, 0, this.L.w * T - PL.W);
  },
  hitBox(tx, ty) {
    if (this.tile(tx, ty) !== 'I') return;
    this.L.tiles[ty][tx] = 'U';
    if (!this.p.shield && Math.random() < 0.3) { this.p.shield = true; this.pops.push({ x: tx * PL.T, y: ty * PL.T - 20, t: 0.9, txt: '🛡️ 보호막!' }); }
    else { this.addCoin(); this.pops.push({ x: tx * PL.T + 8, y: ty * PL.T - 20, t: 0.6, txt: '🪙' }); }
  },
  addCoin() {
    this.coins++; this.score += 10;
    if (!this.multi && this.coins % 50 === 0) { this.lives++; this.pops.push({ x: this.p.x, y: this.p.y - 20, t: 1, txt: '❤️ +1' }); }
    if (!this.multi) this.hud();
  },
  hurt() {
    const p = this.p;
    if (p.inv > 0 || p.dead) return;
    if (p.shield) { p.shield = false; p.inv = 1.5; return; }
    this.die();
  },
  die() {
    const p = this.p;
    if (p.dead) return;
    p.dead = true; p.deadT = 1.2; p.vy = -520; p.shield = false;
    if (!this.multi) { this.lives--; this.hud(); }
  },
  respawn() {
    if (!this.multi && this.lives <= 0) return this.gameOver();
    Object.assign(this.p, { x: this.spawn.x, y: this.spawn.y, vx: 0, vy: 0, dead: false, inv: 1.5, ride: null });
  },
  reachGoal() {
    this.done = true;
    if (this.multi) { socket.emit('plat:finish'); setStatus('plat', '🏁 골인! 다른 사람들을 기다리는 중…'); this.p.vx = 0; this.over = true; return; }
    this.score += 500;
    this.clearT = 1.6;
    this.pops.push({ x: this.goal.x - 40, y: this.goal.y - 30, t: 1.6, txt: `스테이지 ${this.stage} 클리어!` });
  },
  nextStage() {
    const keep = { lives: this.lives, coins: this.coins, score: this.score, shield: this.p.shield };
    this.begin(false, rand(1e9), this.stage + 1);
    Object.assign(this, { lives: keep.lives, coins: keep.coins, score: keep.score });
    this.p.shield = keep.shield;
    this.hud();
  },
  gameOver() {
    this.over = true;
    const best = Math.max(+store.get('best-plat', 0), this.stage);
    store.set('best-plat', best);
    showResult({ title: '💫 게임 오버', subtitle: `스테이지 ${this.stage} · 코인 ${this.coins}개 · 점수 ${this.score} · 최고 스테이지 ${best}`, solo: 'plat', rec: { v: this.stage } });
  },

  draw(countdown) {
    const c = $('#plat-cv').getContext('2d'), { W, H, T } = PL, cam = this.cam, hue = (200 + this.stage * 37) % 360;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${hue},70%,72%)`); g.addColorStop(1, `hsl(${hue},60%,90%)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 6; i++) { const x = ((i * 260 - cam * 0.15) % (W + 200) + W + 200) % (W + 200) - 100; c.beginPath(); c.ellipse(x, 50 + (i % 3) * 30, 44, 14, 0, 0, 7); c.fill(); }
    for (const [k, col, hgt] of [[0.25, `hsl(${100 + (this.stage * 23) % 70},30%,64%)`, 150], [0.5, `hsl(${100 + (this.stage * 23) % 70},38%,50%)`, 100]]) {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) c.lineTo(x, H - hgt + Math.sin((x + cam * k) * 0.012) * 30 + Math.sin((x + cam * k) * 0.031) * 12);
      c.lineTo(W, H); c.fill();
    }
    const tx0 = Math.floor(cam / T), tx1 = Math.min(this.L.w - 1, tx0 + Math.ceil(W / T) + 1);
    for (let ty = 0; ty < PL.ROWS; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = this.L.tiles[ty][tx]; if (t === '.') continue;
      const x = tx * T - cam, y = ty * T;
      if (t === '#') {
        c.fillStyle = '#8a5a35'; c.fillRect(x, y, T, T);
        c.fillStyle = '#6f4527'; c.fillRect(x + 6, y + 12, 5, 5); c.fillRect(x + 20, y + 22, 4, 4);
        if (!PL_SOLID.has(this.tile(tx, ty - 1))) { c.fillStyle = '#4caf50'; c.fillRect(x, y, T, 8); c.fillStyle = '#66cc66'; c.fillRect(x, y, T, 3); }
      } else if (t === 'B') {
        c.fillStyle = '#d9763b'; c.fillRect(x, y, T, T); c.strokeStyle = '#a8522a'; c.lineWidth = 2;
        c.strokeRect(x + 1, y + 1, T - 2, T - 2); c.beginPath(); c.moveTo(x, y + T / 2); c.lineTo(x + T, y + T / 2); c.moveTo(x + T / 2, y); c.lineTo(x + T / 2, y + T / 2); c.stroke();
      } else if (t === 'P') {
        c.fillStyle = '#8d93a8'; c.fillRect(x, y, T, T); c.fillStyle = '#a9afc2'; c.fillRect(x + 2, y + 2, T - 4, 6); c.strokeStyle = '#6b7086'; c.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      } else if (t === 'I' || t === 'U') {
        c.fillStyle = t === 'I' ? '#f2b631' : '#9b7a4a'; c.beginPath(); c.roundRect(x + 1, y + 1, T - 2, T - 2, 5); c.fill();
        if (t === 'I') { c.fillStyle = '#fff6c9'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('★', x + T / 2, y + 23); }
      } else if (t === 'S') {
        c.fillStyle = '#cfd6e6';
        for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + i * 8, y + T); c.lineTo(x + i * 8 + 4, y + 12); c.lineTo(x + i * 8 + 8, y + T); c.fill(); }
      } else if (t === 'J') {
        c.fillStyle = '#ff5d73'; c.fillRect(x + 4, y + 14, T - 8, 6); c.fillStyle = '#ccc'; c.fillRect(x + 8, y + 20, T - 16, 12); c.fillStyle = '#ff5d73'; c.fillRect(x + 2, y + 10, T - 4, 6);
      } else if (t === 'C') {
        const s = Math.abs(Math.sin(performance.now() / 300 + tx));
        c.fillStyle = '#ffd23f'; c.beginPath(); c.ellipse(x + T / 2, y + T / 2, 9 * s + 2, 11, 0, 0, 7); c.fill(); c.strokeStyle = '#e0a800'; c.lineWidth = 2; c.stroke();
      }
    }
    for (const m of this.movers) { c.fillStyle = '#6d4c9f'; c.beginPath(); c.roundRect(m.x - cam, m.y, m.w, m.h, 6); c.fill(); c.fillStyle = '#9b7ad1'; c.fillRect(m.x - cam + 4, m.y + 2, m.w - 8, 4); }
    if (this.check) {
      const x = this.check.x - cam;
      c.fillStyle = '#555'; c.fillRect(x, this.check.y - 20, 4, 84);
      c.fillStyle = this.checked ? '#3fcf9b' : '#bbb'; c.beginPath(); c.moveTo(x + 4, this.check.y - 20); c.lineTo(x + 30, this.check.y - 10); c.lineTo(x + 4, this.check.y); c.fill();
    }
    { const x = this.goal.x - cam, y = this.goal.y;                 // 골: 체크무늬 깃발 문
      c.fillStyle = '#444'; c.fillRect(x, y - 10, 6, 106); c.fillRect(x + 54, y - 10, 6, 106);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(x + 6 + i * 8, y - 10 + j * 8, 8, 8); }
      c.fillStyle = 'rgba(255,230,120,.25)'; c.fillRect(x + 6, y + 6, 48, 90); }
    for (const e of this.enemies) {
      const x = e.x - cam;
      if (x < -40 || x > W + 40) continue;
      if (!e.alive) { if (e.t > 0) { c.fillStyle = '#8b5cf6'; c.fillRect(x, e.y + e.h - 6, e.w, 6); } continue; }
      if (e.type === 'slime') {
        c.fillStyle = '#8b5cf6'; c.beginPath(); c.ellipse(x + 13, e.y + 12, 14, 10 + Math.sin(performance.now() / 120) * 1.5, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.fillRect(x + 6, e.y + 7, 5, 6); c.fillRect(x + 15, e.y + 7, 5, 6); c.fillStyle = '#222'; c.fillRect(x + (e.vx < 0 ? 6 : 8), e.y + 9, 3, 3); c.fillRect(x + (e.vx < 0 ? 15 : 17), e.y + 9, 3, 3);
      } else if (e.type === 'spiker') {
        c.fillStyle = '#d64545'; c.beginPath(); c.arc(x + 13, e.y + 14, 11, 0, 7); c.fill();
        c.fillStyle = '#eee'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; c.beginPath(); c.moveTo(x + 13 + Math.cos(a) * 18, e.y + 14 + Math.sin(a) * 18); c.lineTo(x + 13 + Math.cos(a + 0.4) * 10, e.y + 14 + Math.sin(a + 0.4) * 10); c.lineTo(x + 13 + Math.cos(a - 0.4) * 10, e.y + 14 + Math.sin(a - 0.4) * 10); c.fill(); }
        c.fillStyle = '#fff'; c.fillRect(x + 8, e.y + 10, 4, 4); c.fillRect(x + 15, e.y + 10, 4, 4);
      } else {
        const wing = Math.sin(performance.now() / 70) * 6;
        c.fillStyle = '#3b3355'; c.beginPath(); c.moveTo(x + 13, e.y + 8); c.lineTo(x - 6, e.y + wing); c.lineTo(x + 4, e.y + 12); c.moveTo(x + 13, e.y + 8); c.lineTo(x + 32, e.y + wing); c.lineTo(x + 22, e.y + 12); c.fill();
        c.beginPath(); c.arc(x + 13, e.y + 9, 8, 0, 7); c.fill(); c.fillStyle = '#ffde59'; c.fillRect(x + 9, e.y + 6, 3, 3); c.fillRect(x + 15, e.y + 6, 3, 3);
      }
    }
    if (this.multi) for (const [id, g2] of Object.entries(this.ghosts)) this.drawBot(c, g2.x - cam, g2.y, g2.f ? -1 : 1, avColor(id), 0.5, g2.name, false, g2.a);
    const p = this.p;
    if (!(p.inv > 0 && !p.dead && Math.floor(performance.now() / 80) % 2)) this.drawBot(c, p.x - cam, p.y, p.face, '#26b5c4', 1, this.multi ? '나' : '', p.shield, p.dead ? 7 : p.onGround ? 1 : 2);
    c.textAlign = 'center';
    for (const q of this.pops) { c.globalAlpha = Math.min(1, q.t * 2); c.fillStyle = '#fff'; c.strokeStyle = '#333'; c.lineWidth = 3; c.font = 'bold 16px "Noto Sans KR", sans-serif'; c.strokeText(q.txt, q.x - cam + 12, q.y - (1 - q.t) * 20); c.fillText(q.txt, q.x - cam + 12, q.y - (1 - q.t) * 20); c.globalAlpha = 1; }
    if (!this.multi) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(8, 8, 150, 24); c.fillStyle = '#fff'; c.font = 'bold 14px "Noto Sans KR", sans-serif'; c.textAlign = 'left'; c.fillText(`점수 ${this.score}`, 16, 25); }
    else { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(W / 2 - 150, 10, 300, 8); c.fillStyle = '#3fcf9b'; c.fillRect(W / 2 - 150, 10, this.progress() * 3, 8); }
    if (countdown) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '72px \"Black Han Sans\", sans-serif'; c.textAlign = 'center'; c.fillText(countdown, W / 2, H / 2 + 24); }
  },
  /** 주인공 로봇 (이 게임만의 캐릭터) */
  drawBot(c, x, y, face, color, alpha, label, shield, a) {
    c.globalAlpha = alpha;
    const leg = a === 1 ? Math.sin(this.p.anim * 6) * 4 : 0;
    c.fillStyle = '#334'; c.fillRect(x + 4, y + 22 + Math.max(0, leg), 6, 6); c.fillRect(x + 12, y + 22 + Math.max(0, -leg), 6, 6);
    c.fillStyle = color; c.beginPath(); c.roundRect(x, y + 4, 22, 21, 7); c.fill();
    c.fillStyle = '#1c2340'; c.beginPath(); c.roundRect(x + 3, y + 8, 16, 9, 4); c.fill();
    c.fillStyle = '#7ef9ff'; c.fillRect(x + (face > 0 ? 11 : 5), y + 10, 3, 5); c.fillRect(x + (face > 0 ? 15 : 9), y + 10, 3, 5);
    c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 11, y + 4); c.lineTo(x + 11, y - 3); c.stroke();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x + 11, y - 4, 3, 0, 7); c.fill();
    if (shield) { c.strokeStyle = 'rgba(120,220,255,.85)'; c.lineWidth = 3; c.beginPath(); c.arc(x + 11, y + 14, 21, 0, 7); c.stroke(); }
    if (label) { c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3; c.font = 'bold 12px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.strokeText(label, x + 11, y - 10); c.fillText(label, x + 11, y - 10); }
    c.globalAlpha = 1;
  },
};
register('plat', {
  solo: () => Plat.startSolo(),
  stop: () => { Plat.over = true; },
  key: e => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code) && !e.repeat) Plat.p && (Plat.p.buffer = 0.12); },
  // 휴대폰 · 태블릿: 왼쪽 엄지 조이스틱(끝까지 밀면 달리기) + 오른쪽 어디든 점프 (stick.js) — 키보드는 그대로
  stick: { run: 'ShiftLeft', hint: '엄지로 밀어서 이동 · 끝까지 밀면 달리기', act: { code: 'Space', label: '점프', icon: 'arrow-up', hint: '오른쪽 어디든 점프 · 길게 누르면 높이' } },
});
socket.on('plat:start', d => Plat.startMulti(d));
socket.on('plat:ghosts', d => {
  if (!isScreen('plat') || !Plat.multi) return;
  for (const [id, v] of Object.entries(d)) {
    if (id === S.myId) continue;
    const g = Plat.ghosts[id] || (Plat.ghosts[id] = { x: v[0], y: v[1], name: (S.room && (S.room.players.find(p => p.id === id) || {}).name) || '' });
    g.tx = v[0]; g.ty = v[1]; g.f = v[2]; g.a = v[3];
  }
});
socket.on('plat:goal', d => { if (d.id !== S.myId) toast(`🏁 ${d.name} 님 ${d.rank}등 골인!`, 'info'); });
socket.on('plat:hurry', d => { Plat.endAt = Math.min(Plat.endAt, performance.now() + d.seconds * 1000); if (!Plat.done) setStatus('plat', `⏰ 1등이 골인했어요! ${d.seconds}초 안에 도착하세요!`); });
