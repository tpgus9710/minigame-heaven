/* =====================================================================
 *  🏗️ 탑 쌓기 — 움직이는 블록을 딱 맞게 멈춰서 높이 쌓기. 삐져나온 부분은 잘려요!
 * ===================================================================== */
const ST = { W: 400, H: 640, BH: 26, BASE: 220 };
makeScreen('stack', {
  title: '🏗️ 탑 쌓기', status: '화면을 누르거나 스페이스로 블록을 멈춰요. 딱 맞추면 콤보!',
  stats: [['score', '높이'], ['best', '최고 기록']],
  body: `<div class="center"><canvas id="st-cv" class="game-cv" width="${ST.W}" height="${ST.H}"></canvas></div>`,
});

const Stack = {
  start() {
    stopLocal();
    S.solo = 'stack';
    Object.assign(this, { blocks: [{ x: (ST.W - ST.BASE) / 2, w: ST.BASE }], falling: [], combo: 0, over: false, cam: 0, hue: Math.random() * 360, flash: 0 });
    this.newMover();
    setStat('stack', 'best', store.get('best-stack', 0));
    show('stack'); this.hud();
    gameLoop(dt => { this.update(dt); this.draw(); });
  },
  hud() { setStat('stack', 'score', this.blocks.length - 1); },
  newMover() {
    const top = this.blocks[this.blocks.length - 1], fromLeft = this.blocks.length % 2 === 0;
    this.mover = { x: fromLeft ? -top.w : ST.W, w: top.w, dir: fromLeft ? 1 : -1, sp: 170 + Math.min(260, this.blocks.length * 6) };
  },
  place() {
    if (this.over) return;
    const m = this.mover, top = this.blocks[this.blocks.length - 1];
    if (Math.abs(m.x - top.x) < 5) {                                   // 딱 맞음
      m.x = top.x; this.combo++; this.flash = 0.25;
      if (this.combo >= 3) { const grow = Math.min(10, ST.BASE - top.w); m.x -= grow / 2; m.w = top.w + grow; }
    } else {
      this.combo = 0;
      const l = Math.max(m.x, top.x), r = Math.min(m.x + m.w, top.x + top.w);
      if (r <= l) { this.falling.push({ x: m.x, w: m.w, y: this.blocks.length, vy: 0 }); return this.gameOver(); }
      if (m.x < l) this.falling.push({ x: m.x, w: l - m.x, y: this.blocks.length, vy: 0 });
      if (m.x + m.w > r) this.falling.push({ x: r, w: m.x + m.w - r, y: this.blocks.length, vy: 0 });
      m.x = l; m.w = r - l;
    }
    this.blocks.push({ x: m.x, w: m.w });
    this.hud(); this.newMover();
  },
  update(dt) {
    if (!this.over) {
      const m = this.mover;
      m.x += m.dir * m.sp * dt;
      if (m.x > ST.W - m.w * 0.2) m.dir = -1;
      if (m.x < -m.w * 0.8) m.dir = 1;
    }
    for (const f of this.falling) { f.vy += 20 * dt; f.y -= f.vy * dt; }
    this.falling = this.falling.filter(f => f.y > -40);
    const want = Math.max(0, this.blocks.length - 12);
    this.cam += (want - this.cam) * Math.min(1, dt * 5);
    this.flash -= dt;
  },
  gameOver() {
    this.over = true;
    const h = this.blocks.length - 1, best = Math.max(+store.get('best-stack', 0), h);
    store.set('best-stack', best);
    after(900, () => showResult({ title: '🏗️ 탑이 무너졌어요!', subtitle: `높이 ${h}층 · 최고 기록 ${best}층`, solo: 'stack' }));
  },
  draw() {
    const c = $('#st-cv').getContext('2d'), H = ST.H, BH = ST.BH;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${(this.hue + this.blocks.length * 4) % 360},45%,22%)`); g.addColorStop(1, `hsl(${(this.hue + 60 + this.blocks.length * 4) % 360},50%,40%)`);
    c.fillStyle = g; c.fillRect(0, 0, ST.W, H);
    const yOf = i => H - 60 - (i - this.cam) * BH;
    const col = i => `hsl(${(this.hue + i * 9) % 360},70%,60%)`;
    this.blocks.forEach((b, i) => {
      const y = yOf(i); if (y > H + BH || y < -BH) return;
      c.fillStyle = col(i); c.fillRect(b.x, y - BH, b.w, BH - 1);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(b.x, y - BH, b.w, 4);
    });
    for (const f of this.falling) { c.fillStyle = col(Math.round(f.y)); c.globalAlpha = 0.8; c.fillRect(f.x, yOf(f.y) - BH, f.w, BH - 1); c.globalAlpha = 1; }
    if (!this.over) { const m = this.mover, y = yOf(this.blocks.length); c.fillStyle = col(this.blocks.length); c.fillRect(m.x, y - BH, m.w, BH - 1); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(m.x, y - BH, m.w, 4); }
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '56px \"Black Han Sans\", sans-serif'; c.fillText(this.blocks.length - 1, ST.W / 2, 90);
    if (this.flash > 0 && this.combo) { c.font = 'bold 22px "Noto Sans KR", sans-serif'; c.fillText(`딱 맞음! ×${this.combo}`, ST.W / 2, 130); }
  },
};
$('#st-cv').addEventListener('pointerdown', () => Stack.place());
register('stack', { solo: () => Stack.start(), stop: () => { Stack.over = true; }, key: e => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) Stack.place(); } });
