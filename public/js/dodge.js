/* =====================================================================
 *  🎯 총알피하기 (싱글: 총알 모드 · 대나무 모드 / 멀티: 총알피하기 배틀)
 * ===================================================================== */
const DG = { W: 720, H: 520 };
makeScreen('dodge', {
  title: '🎯 총알피하기', stats: [['time', '버틴 시간'], ['best', '최고 기록']],
  body: `<div class="mode-row" id="dodge-modes"><button class="seg-btn" data-act="dodgeMode" data-mode="bullet">총알 모드</button><button class="seg-btn" data-act="dodgeMode" data-mode="bamboo">대나무 모드</button></div>
  <div class="center"><canvas id="dodge-cv" class="game-cv" width="${DG.W}" height="${DG.H}"></canvas></div>
  <p class="center small muted" id="dodge-help">방향키·WASD 또는 마우스(터치)를 누른 채 움직이세요</p>`,
});

const Dodge = {
  mode: 'bullet',
  reset(multi) {
    Object.assign(this, { multi, t: 0, bullets: [], bamboo: [], dead: false, over: false, acc: 0, wallT: 8, others: {}, sendT: 0, pointer: null, t0: 0 });
    this.me = this.mode === 'bamboo' ? { x: DG.W / 2, y: DG.H - 26 } : { x: DG.W / 2, y: DG.H / 2 };
  },
  startSolo(mode) {
    stopLocal();
    if (mode) this.mode = mode;
    S.solo = 'dodge';
    this.reset(false);
    $('#dodge-modes').classList.remove('hidden');
    $$('#dodge-modes .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.mode === this.mode));
    $('#dodge-help').textContent = this.mode === 'bamboo'
      ? (TOUCH ? '엄지로 좌우로 밀어서 피하세요. 빨간 표시가 뜬 곳에 대나무가 떨어져요!' : '←→ (A·D) 또는 마우스로 좌우로 피하세요. 빨간 표시가 뜬 곳에 대나무가 떨어져요!')
      : (TOUCH ? '아래쪽을 엄지로 밀면 조이스틱 — 살짝 밀면 천천히, 끝까지 밀면 빠르게. 총알이 점점 많아져요!' : '방향키·WASD 또는 마우스를 누른 채 움직이세요. 총알이 점점 많아져요!');
    setStatus('dodge', this.mode === 'bamboo' ? '🎋 대나무 모드 — 하늘에서 떨어지는 대나무를 피하세요' : '🎯 총알 모드 — 사방에서 날아오는 총알을 피하세요');
    $('#dodge-best-label').textContent = '최고 기록';
    setStat('dodge', 'best', (+store.get('best-dodge-' + this.mode, 0)).toFixed(1) + '초');
    show('dodge');
    this.t0 = performance.now() + 1000;
    gameLoop((dt, now) => this.frame(dt, now));
  },
  startMulti(d) {
    stopLocal();
    this.mode = 'bullet';
    this.reset(true);
    this.names = d.names; this.me = d.pos[S.myId] ? { ...d.pos[S.myId] } : { x: DG.W / 2, y: DG.H / 2 };
    if (!d.pos[S.myId]) this.dead = true;                     // 관전
    for (const [id, p] of Object.entries(d.pos)) if (id !== S.myId) this.others[id] = { x: p.x, y: p.y, tx: p.x, ty: p.y };
    $('#dodge-modes').classList.add('hidden');
    $('#dodge-help').textContent = TOUCH ? '아래쪽을 엄지로 밀면 조이스틱 — 살짝 밀면 천천히, 끝까지 밀면 빠르게. 맞으면 탈락!' : '방향키·WASD 또는 마우스를 누른 채 움직이세요. 맞으면 탈락!';
    setStatus('dodge', '🎯 총알피하기 배틀 — 마지막까지 살아남으세요!');
    setStat('dodge', 'best', `${Object.keys(d.pos).length}명`); $('#dodge-best-label').textContent = '참가';
    show('dodge'); renderScores();
    this.t0 = performance.now() + d.delay;
    gameLoop((dt, now) => this.frame(dt, now));
  },
  frame(dt, now) {
    const started = now >= this.t0;
    if (started && !this.dead && !this.over) { this.t += dt; setStat('dodge', 'time', this.t.toFixed(1) + '초'); }
    if (!this.dead && !this.over) this.moveMe(dt);
    if (started && !this.over) this.mode === 'bamboo' ? this.stepBamboo(dt) : this.stepBullets(dt);
    if (this.multi) {
      for (const o of Object.values(this.others)) { o.x += (o.tx - o.x) * Math.min(1, dt * 12); o.y += (o.ty - o.y) * Math.min(1, dt * 12); }
      if (!this.dead && (this.sendT -= dt) <= 0) { this.sendT = 0.066; socket.emit('dodge:pos', { x: Math.round(this.me.x), y: Math.round(this.me.y) }); }
    }
    this.draw(started ? 0 : Math.ceil((this.t0 - now) / 1000));
  },
  moveMe(dt) {
    const bam = this.mode === 'bamboo', sp = bam ? 330 : 230;
    let dx = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
    let dy = bam ? 0 : (held('ArrowDown', 'KeyS') ? 1 : 0) - (held('ArrowUp', 'KeyW') ? 1 : 0);
    const v = !dx && !dy && typeof Stick !== 'undefined' && Stick.key === 'dodge' ? Stick.vec() : null;
    if (v) { dx = v.x; dy = bam ? 0 : v.y; }                     // 터치 조이스틱: 미는 만큼 (살짝 밀면 천천히)
    else if (this.pointer && !dx && !dy) {                      // 마우스(손가락)를 누르고 있으면 그쪽으로
      const px = this.pointer.x - this.me.x, py = bam ? 0 : this.pointer.y - this.me.y, d = Math.hypot(px, py);
      if (d > 3) { const k = Math.min(1, d / (sp * dt)); dx = (px / d) * k; dy = (py / d) * k; }
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.me.x = clamp(this.me.x + dx * sp * dt, 8, DG.W - 8);
    if (!bam) this.me.y = clamp(this.me.y + dy * sp * dt, 8, DG.H - 8);
  },
  stepBullets(dt) {
    if (!this.multi) {                                           // 싱글: 화면 속 총알 수가 점점 늘어남
      const want = Math.min(170, 26 + this.t * 1.6);
      while (this.bullets.length < want) this.bullets.push(this.spawnBullet());
    }
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    this.bullets = this.bullets.filter(b => b.x > -30 && b.x < DG.W + 30 && b.y > -30 && b.y < DG.H + 30);
    if (!this.dead && this.bullets.some(b => Math.hypot(b.x - this.me.x, b.y - this.me.y) < b.r + 3.5)) this.die();
  },
  spawnBullet() {
    const side = rand(4), u = Math.random();
    const x = side === 0 ? u * DG.W : side === 1 ? DG.W + 10 : side === 2 ? u * DG.W : -10;
    const y = side === 0 ? -10 : side === 1 ? u * DG.H : side === 2 ? DG.H + 10 : u * DG.H;
    const tx = this.me.x + (Math.random() - 0.5) * 140, ty = this.me.y + (Math.random() - 0.5) * 140;
    const sp = 100 + Math.min(this.t * 2.4, 170) + Math.random() * 70, d = Math.hypot(tx - x, ty - y) || 1;
    return { x, y, vx: ((tx - x) / d) * sp, vy: ((ty - y) / d) * sp, r: Math.random() < 0.06 ? 8 : 3 + rand(3) };
  },
  stepBamboo(dt) {
    this.acc += (1.3 + this.t * 0.09) * dt;
    while (this.acc >= 1) { this.acc--; this.bamboo.push({ x: 20 + Math.random() * (DG.W - 40), w: 12 + rand(6), len: 70 + rand(50), y: -130, warn: 0.75 }); }
    if ((this.wallT -= dt) <= 0) {                               // 가끔 한 칸만 비운 대나무 벽
      this.wallT = Math.max(5, 11 - this.t * 0.08);
      const gap = 40 + Math.random() * (DG.W - 80);
      for (let x = 24; x < DG.W; x += 48) if (Math.abs(x - gap) > 50) this.bamboo.push({ x, w: 14, len: 90, y: -130, warn: 1.1 });
    }
    const v = Math.min(950, 380 + this.t * 7);
    for (const b of this.bamboo) { if (b.warn > 0) b.warn -= dt; else b.y += v * dt; }
    this.bamboo = this.bamboo.filter(b => b.y < DG.H + 10);
    const m = this.me;
    if (!this.dead && this.bamboo.some(b => b.warn <= 0 && Math.abs(b.x - m.x) < b.w / 2 + 9 && b.y + b.len > m.y - 14 && b.y < m.y + 14)) this.die();
  },
  die() {
    this.dead = true;
    if (this.multi) { socket.emit('dodge:dead'); setStatus('dodge', '💥 맞았어요! 남은 사람들을 응원해 주세요.'); return; }
    this.over = true;
    const best = Math.max(+store.get('best-dodge-' + this.mode, 0), this.t);
    store.set('best-dodge-' + this.mode, best.toFixed(2));
    after(700, () => showResult({ title: '💥 맞았어요!', subtitle: `${this.mode === 'bamboo' ? '🎋 대나무' : '🎯 총알'} 모드 · ${this.t.toFixed(2)}초 버팀 · 최고 기록 ${best.toFixed(2)}초`, solo: 'dodge', rec: { k: this.mode, v: +this.t.toFixed(2) } }));
  },
  onTick(d) {
    if (!isScreen('dodge') || !this.multi) return;
    for (const b of d.b) this.bullets.push({ x: b[0], y: b[1], vx: b[2], vy: b[3], r: b[4] });
    for (const [id, p] of Object.entries(d.p)) {
      if (id === S.myId) continue;
      const o = this.others[id] || (this.others[id] = { x: p[0], y: p[1] });
      o.tx = p[0]; o.ty = p[1]; o.alive = true;
    }
    for (const id of Object.keys(this.others)) if (!d.p[id]) delete this.others[id];
  },

  draw(countdown) {
    const c = $('#dodge-cv').getContext('2d'), { W, H } = DG, bam = this.mode === 'bamboo';
    if (bam) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f2a1d'); g.addColorStop(1, '#1d4a2c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(120,200,120,.08)';
      for (let x = 30; x < W; x += 90) c.fillRect(x, 0, 16, H);
      c.fillStyle = '#2f5d34'; c.fillRect(0, H - 8, W, 8);
    } else {
      c.fillStyle = '#0b1022'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    }
    for (const b of this.bamboo) {
      if (b.warn > 0) { c.fillStyle = `rgba(255,80,80,${0.4 + 0.4 * Math.sin(performance.now() / 60)})`; c.beginPath(); c.moveTo(b.x - 9, 4); c.lineTo(b.x + 9, 4); c.lineTo(b.x, 18); c.fill(); continue; }
      c.fillStyle = '#7bc96f'; c.fillRect(b.x - b.w / 2, b.y, b.w, b.len);
      c.fillStyle = '#4e9a48'; for (let y = b.y + 18; y < b.y + b.len; y += 22) c.fillRect(b.x - b.w / 2 - 1, y, b.w + 2, 3);
      c.fillStyle = '#c9f0b8'; c.beginPath(); c.moveTo(b.x - b.w / 2, b.y + b.len); c.lineTo(b.x + b.w / 2, b.y + b.len); c.lineTo(b.x, b.y + b.len + 12); c.fill();
    }
    c.shadowBlur = 8;
    for (const b of this.bullets) { c.fillStyle = b.r > 6 ? '#ff4d5e' : '#ffb347'; c.shadowColor = c.fillStyle; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); }
    c.shadowBlur = 0;
    c.font = 'bold 12px "Noto Sans KR", sans-serif'; c.textAlign = 'center';
    for (const [id, o] of Object.entries(this.others)) {
      c.fillStyle = avColor(id); c.beginPath(); c.arc(o.x, o.y, 6, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.fillText((this.names && this.names[id]) || '', o.x, o.y - 11);
    }
    if (!this.dead || this.over) {
      const m = this.me;
      if (bam) {
        c.fillStyle = this.dead ? '#888' : '#ffe066'; c.beginPath(); c.roundRect(m.x - 10, m.y - 16, 20, 30, 7); c.fill();
        c.fillStyle = '#222'; c.fillRect(m.x - 10, m.y - 10, 20, 5);           // 머리띠
        c.fillStyle = '#ff5d73'; c.fillRect(m.x + 8, m.y - 10, 8, 3);
      } else {
        c.shadowColor = '#ffe066'; c.shadowBlur = 14;
        c.fillStyle = this.dead ? '#888' : '#ffe066'; c.beginPath(); c.arc(m.x, m.y, 6, 0, 7); c.fill(); c.shadowBlur = 0;
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      }
      if (this.multi) { c.fillStyle = '#ffe066'; c.fillText('나', m.x, m.y - (bam ? 22 : 12)); }
    }
    if (countdown) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '72px \"Black Han Sans\", sans-serif'; c.fillText(countdown, W / 2, H / 2 + 24); }
  },
};
(() => {
  const cv = $('#dodge-cv');
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); Dodge.pointer = cvPoint(cv, e); });
  cv.addEventListener('pointermove', e => { if (Dodge.pointer) Dodge.pointer = cvPoint(cv, e); });
  ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => { Dodge.pointer = null; }));
})();
ACT.dodgeMode = el => Dodge.startSolo(el.dataset.mode);
// 휴대폰 · 태블릿: 조이스틱 하나 (세로 화면은 아래 전체 · 가로 화면은 양옆 어느 쪽이든) · 미는 세기만큼 빠르게 (stick.js) — 키보드 · 마우스는 그대로
register('dodge', {
  solo: () => Dodge.startSolo(), stop: () => { Dodge.over = true; },
  stick: { analog: true, full: true, y: () => Dodge.mode !== 'bamboo', hint: () => (Dodge.mode === 'bamboo' ? '엄지로 밀어서 좌우로 피하기' : '엄지로 밀어서 이동 · 살짝 밀면 천천히') },
});
socket.on('dodge:start', d => Dodge.startMulti(d));
socket.on('dodge:tick', d => Dodge.onTick(d));
