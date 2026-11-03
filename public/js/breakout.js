/* =====================================================================
 *  🧱 벽돌깨기 (스와이프 방식) — 조준해서 공을 한꺼번에 쏘고, 턴마다 벽돌이 한 줄씩 내려와요.
 *  초록 +1 링을 먹으면 다음 턴부터 공이 하나씩 늘어나요.
 * ===================================================================== */
const BK = { W: 420, H: 640, COLS: 7, CELL: 60, TOP: 56, FLOOR: 596, R: 7, SPEED: 760, ROWS: 9 };
makeScreen('breakout', {
  title: '🧱 벽돌깨기', status: '화면을 누른 채 끌어서 조준하고, 손을 떼면 발사! (키보드: ←→ 조준 · 스페이스 발사)',
  stats: [['turn', '단계'], ['balls', '공'], ['best', '최고']],
  body: `<div class="center col"><canvas id="bk-cv" class="game-cv" width="${BK.W}" height="${BK.H}"></canvas>
    <div class="row-btns"><button class="btn sm ghost" data-act="bkFast" id="bk-fast">⏩ 빠르게 ×1</button><button class="btn sm ghost" data-act="bkRecall">⤓ 공 모두 회수</button></div></div>`,
});

const Brick = {
  start() {
    stopLocal();
    S.solo = 'breakout';
    Object.assign(this, { turn: 1, balls: 1, lx: BK.W / 2, bricks: [], items: [], flying: [], toLaunch: 0, launchT: 0, phase: 'aim',
      angle: -Math.PI / 2, aiming: false, fast: 1, firstLand: null, gain: 0, over: false, flash: [] });
    this.addRow();
    this.rebuild();
    show('breakout'); this.hud();
    $('#bk-fast').textContent = '⏩ 빠르게 ×1';
    gameLoop(dt => { this.update(dt); this.draw(); });
  },
  addRow() {
    const cols = shuffle([...Array(BK.COLS).keys()]);
    const count = 2 + rand(Math.min(5, 2 + Math.floor(this.turn / 6)));
    for (let i = 0; i < count; i++) this.bricks.push({ c: cols[i], r: 0, hp: this.turn > 5 && Math.random() < 0.2 ? this.turn * 2 : this.turn });
    this.items.push({ c: cols[count], r: 0 });
  },
  rebuild() { this.grid = new Map(this.bricks.map(b => [b.c + ',' + b.r, b])); },
  rect(b) { return { x0: b.c * BK.CELL + 3, y0: BK.TOP + b.r * BK.CELL + 3, x1: (b.c + 1) * BK.CELL - 3, y1: BK.TOP + (b.r + 1) * BK.CELL - 3 }; },
  itemPos(it) { return { x: it.c * BK.CELL + BK.CELL / 2, y: BK.TOP + it.r * BK.CELL + BK.CELL / 2 }; },
  hud() { setStat('breakout', 'turn', this.turn); setStat('breakout', 'balls', this.balls); setStat('breakout', 'best', store.get('best-breakout2', 0)); },

  fire() {
    if (this.phase !== 'aim' || this.over) return;
    this.phase = 'fly'; this.toLaunch = this.balls; this.launchT = 0; this.firstLand = null; this.turnTime = 0;
  },
  setAim(p) {
    const dx = p.x - this.lx, dy = p.y - (BK.FLOOR - BK.R);
    let a = Math.atan2(dy, dx);
    if (a > -0.12) a = dx >= 0 ? -0.12 : -Math.PI + 0.12;          // 너무 눕지 않게 (아래로는 못 쏨)
    this.angle = clamp(a, -Math.PI + 0.12, -0.12);
  },
  update(dt) {
    if (this.over) return;
    if (this.phase === 'aim') {
      if (held('ArrowLeft', 'KeyA')) this.angle = Math.max(-Math.PI + 0.12, this.angle - 1.3 * dt);
      if (held('ArrowRight', 'KeyD')) this.angle = Math.min(-0.12, this.angle + 1.3 * dt);
      return;
    }
    this.turnTime += dt;
    const steps = Math.ceil(dt * 240) * this.fast, h = dt * this.fast / steps;
    for (let i = 0; i < steps; i++) this.physics(h);
    this.flash = this.flash.filter(f => (f.t -= dt) > 0);
    if (this.toLaunch === 0 && this.flying.length === 0) this.endTurn();
  },
  physics(h) {
    if (this.toLaunch > 0 && (this.launchT -= h) <= 0) {
      this.launchT = 0.065; this.toLaunch--;
      this.flying.push({ x: this.lx, y: BK.FLOOR - BK.R, vx: Math.cos(this.angle) * BK.SPEED, vy: Math.sin(this.angle) * BK.SPEED });
    }
    const R = BK.R;
    for (const b of this.flying) {
      if (b.home) {                                             // 바닥에 닿은 공은 첫 공 자리로 모임
        const d = this.firstLand - b.x;
        b.x += Math.sign(d) * Math.min(Math.abs(d), 900 * h);
        if (Math.abs(d) < 1) b.gone = true;
        continue;
      }
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
      if (b.x > BK.W - R) { b.x = BK.W - R; b.vx = -Math.abs(b.vx); }
      if (b.y < BK.TOP + R) { b.y = BK.TOP + R; b.vy = Math.abs(b.vy); }
      if (Math.abs(b.vy) < 60) b.vy = b.vy < 0 ? -60 : 60;       // 수평으로 끝없이 튕기지 않게
      const c = Math.floor(b.x / BK.CELL), r = Math.floor((b.y - BK.TOP) / BK.CELL);
      hit: for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        const bk = this.grid.get((c + dc) + ',' + (r + dr));
        if (!bk) continue;
        const q = this.rect(bk), nx = clamp(b.x, q.x0, q.x1), ny = clamp(b.y, q.y0, q.y1);
        let dx = b.x - nx, dy = b.y - ny;
        if (dx * dx + dy * dy >= R * R) continue;
        if (dx === 0 && dy === 0) { dy = -Math.sign(b.vy) || 1; }
        if (Math.abs(dx) > Math.abs(dy)) { b.vx = Math.sign(dx) * Math.abs(b.vx); b.x = nx + Math.sign(dx) * R; }
        else { b.vy = Math.sign(dy) * Math.abs(b.vy); b.y = ny + Math.sign(dy) * R; }
        if (--bk.hp <= 0) {
          this.bricks.splice(this.bricks.indexOf(bk), 1); this.grid.delete(bk.c + ',' + bk.r);
          this.flash.push({ x: (q.x0 + q.x1) / 2, y: (q.y0 + q.y1) / 2, t: 0.3 });
        }
        break hit;
      }
      for (let i = this.items.length - 1; i >= 0; i--) {
        const p = this.itemPos(this.items[i]);
        if (Math.hypot(p.x - b.x, p.y - b.y) < R + 12) { this.items.splice(i, 1); this.gain++; this.flash.push({ x: p.x, y: p.y, t: 0.4, plus: true }); }
      }
      if (b.vy > 0 && b.y >= BK.FLOOR - R) {
        b.y = BK.FLOOR - R;
        if (this.firstLand === null) { this.firstLand = clamp(b.x, R, BK.W - R); b.gone = true; } else b.home = true;
      }
    }
    this.flying = this.flying.filter(b => !b.gone);
  },
  recall() {
    if (this.phase !== 'fly') return;
    this.toLaunch = 0;
    if (this.firstLand === null) this.firstLand = this.lx;
    this.flying = [];
  },
  endTurn() {
    this.balls += this.gain; this.gain = 0;
    if (this.firstLand !== null) this.lx = this.firstLand;
    this.bricks.forEach(b => b.r++); this.items.forEach(it => it.r++);
    this.items = this.items.filter(it => it.r < BK.ROWS - 1);
    this.turn++; this.fast = 1; $('#bk-fast').textContent = '⏩ 빠르게 ×1';
    if (this.bricks.some(b => b.r >= BK.ROWS - 1)) return this.gameOver();
    this.addRow(); this.rebuild();
    this.phase = 'aim';
    this.hud();
  },
  gameOver() {
    this.over = true; this.phase = 'over'; this.rebuild(); this.draw();
    const lv = this.turn - 1, best = Math.max(+store.get('best-breakout2', 0), lv);
    store.set('best-breakout2', best);
    after(600, () => showResult({ title: '🧱 벽돌이 바닥까지 내려왔어요!', subtitle: `${lv}단계 · 공 ${this.balls}개 · 최고 기록 ${best}단계`, solo: 'breakout' }));
  },

  draw() {
    const c = $('#bk-cv').getContext('2d'), { W, H, TOP, FLOOR, R, CELL } = BK;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#151b36'); g.addColorStop(1, '#0b0f20');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, 0, W, TOP);
    c.fillStyle = '#fff'; c.font = 'bold 20px \"Black Han Sans\", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${this.turn}단계`, W / 2, TOP / 2);
    c.strokeStyle = 'rgba(255,93,115,.5)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(0, FLOOR); c.lineTo(W, FLOOR); c.stroke(); c.setLineDash([]);
    for (const b of this.bricks) {
      const q = this.rect(b), t = Math.min(1, b.hp / (this.turn * 1.4));
      c.fillStyle = `hsl(${200 - t * 200}, 80%, ${58 - t * 8}%)`;
      c.beginPath(); c.roundRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0, 8); c.fill();
      c.fillStyle = '#fff'; c.font = `bold ${b.hp > 99 ? 16 : 20}px "Noto Sans KR", sans-serif`;
      c.fillText(b.hp, (q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2 + 1);
    }
    const pulse = 1 + Math.sin(performance.now() / 160) * 0.12;
    for (const it of this.items) {
      const p = this.itemPos(it);
      c.strokeStyle = '#3fcf9b'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 11 * pulse, 0, 7); c.stroke();
      c.fillStyle = '#3fcf9b'; c.font = 'bold 12px sans-serif'; c.fillText('+1', p.x, p.y + 1);
    }
    for (const f of this.flash) {
      c.globalAlpha = Math.min(1, f.t * 3); c.fillStyle = f.plus ? '#3fcf9b' : '#fff';
      c.beginPath(); c.arc(f.x, f.y, (f.plus ? 26 : 34) * (1 - f.t), 0, 7); c.fill(); c.globalAlpha = 1;
    }
    if (this.phase === 'aim' && !this.over) {                   // 조준선 (벽에 한 번 튕기는 것까지)
      let x = this.lx, y = FLOOR - R, dx = Math.cos(this.angle), dy = Math.sin(this.angle), left = 520;
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; left > 0 && i < 60; i++) {
        x += dx * 14; y += dy * 14; left -= 14;
        if (x < R || x > W - R) { dx = -dx; x = clamp(x, R, W - R); }
        if (y < TOP + R) break;
        c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill();
      }
    }
    c.fillStyle = '#fff';
    for (const b of this.flying) { c.beginPath(); c.arc(b.x, b.y, R, 0, 7); c.fill(); }
    if (this.phase === 'aim' || this.toLaunch > 0) {
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(this.lx, FLOOR - R, R + 1, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif';
      c.fillText(`×${this.phase === 'aim' ? this.balls : this.toLaunch}`, clamp(this.lx, 30, W - 30), FLOOR + 20);
    }
    if (this.gain) { c.fillStyle = '#3fcf9b'; c.font = 'bold 15px sans-serif'; c.fillText(`+${this.gain}`, W - 30, FLOOR + 20); }
  },
};
(() => {
  const cv = $('#bk-cv');
  cv.addEventListener('pointerdown', e => { if (Brick.phase !== 'aim') return; Brick.aiming = true; cv.setPointerCapture(e.pointerId); Brick.setAim(cvPoint(cv, e)); });
  cv.addEventListener('pointermove', e => { if (Brick.aiming) Brick.setAim(cvPoint(cv, e)); });
  cv.addEventListener('pointerup', e => { if (!Brick.aiming) return; Brick.aiming = false; Brick.setAim(cvPoint(cv, e)); Brick.fire(); });
})();
Object.assign(ACT, {
  bkFast: () => { Brick.fast = Brick.fast >= 4 ? 1 : Brick.fast * 2; $('#bk-fast').textContent = `⏩ 빠르게 ×${Brick.fast}`; },
  bkRecall: () => Brick.recall(),
});
register('breakout', {
  solo: () => Brick.start(),
  stop: () => { Brick.over = true; },
  key: e => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) Brick.fire(); if (e.code === 'KeyF') ACT.bkFast(); },
  pad: ['ArrowLeft', 'ArrowRight', '|', 'Space'], padLabel: { Space: '발사' },
});
