/* =====================================================================
 *  🧟 좀비 웨이브 — 부대를 좌우로 움직여 게이트로 병력을 불리고, 좀비 떼와 보스를 쓰러뜨려요.
 *  2스테이지부터 빠른 좀비(러너), 3스테이지부터 덩치 큰 좀비(브루트)가 나와요.
 * ===================================================================== */
const ZW = { W: 480, H: 720, SQUAD_Y: 610 };
makeScreen('zombie', {
  title: '🧟 좀비 웨이브', status: '마우스(터치)나 ←→로 부대를 움직여요. 파란 게이트는 병력 증가, 빨간 게이트는 감소!',
  stats: [['stage', '스테이지'], ['n', '병력'], ['gun', '무기']],
  body: `<div class="center"><canvas id="zw-cv" class="game-cv" width="${ZW.W}" height="${ZW.H}"></canvas></div>`,
});

const Zombie = {
  start() {
    stopLocal();
    S.solo = 'zombie';
    Object.assign(this, { stage: 1, n: 12, gun: 1, kills: 0, over: false, x: ZW.W / 2, target: null, shake: 0 });
    this.newStage();
    show('zombie');
    gameLoop(dt => { if (!this.over) this.update(dt); this.draw(); });
  },
  newStage() {
    Object.assign(this, { objs: [], bullets: [], fx: [], decals: [], dist: 0, fireT: 0, boss: null, bossSpawned: false, clearT: 0, banner: { txt: `STAGE ${this.stage}`, t: 1.6 } });
    this.length = 2800 + this.stage * 500;
    this.script = [{ d: 420, k: 'gate' }];
    for (let d = 760; d < this.length - 300; d += 300 + rand(110)) {
      const r = Math.random();
      this.script.push({ d, k: r < 0.34 ? 'gate' : r < 0.88 ? 'horde' : 'barrel' });
    }
    this.props = Array.from({ length: 6 }, (_, i) => ({ y: i * 140, side: i % 2, kind: rand(3) }));
    this.hud();
  },
  hud() { setStat('zombie', 'stage', this.stage); setStat('zombie', 'n', this.n); setStat('zombie', 'gun', 'Lv.' + this.gun); },
  radius() { return 18 + Math.sqrt(Math.min(this.n, 140)) * 3.6; },
  dps() { return this.n * 1.5 * Math.pow(1.3, this.gun - 1); },
  spawn(ev) {
    const st = this.stage;
    if (ev.k === 'gate') {
      const good = () => (Math.random() < 0.15 && this.n <= 80 ? { op: '×', v: 2 } : { op: '+', v: 4 + rand(6) + st * 2 });
      // 나쁜 게이트: 아프지만 한 번에 전멸하지는 않게 (초반 55%, 나중엔 70%까지)
      const bad = () => (Math.random() < 0.3 ? { op: '÷', v: 2 } : { op: '-', v: Math.max(3, Math.min(4 + rand(5) + st * 3 + Math.floor(this.n * 0.12), Math.ceil(this.n * (st <= 2 ? 0.55 : 0.7)))) });
      const pair = Math.random() < 0.15 ? [good(), good()] : Math.random() < 0.5 ? [good(), bad()] : [bad(), good()];
      pair.forEach((g, i) => this.objs.push({ t: 'gate', x: i ? ZW.W * 0.75 - 8 : ZW.W * 0.25 + 8, y: -40, w: ZW.W / 2 - 46, ...g }));
    } else if (ev.k === 'horde') {
      const k = 4 + rand(3) + st * 3 + Math.floor(this.n / 25), cx = 70 + Math.random() * (ZW.W - 140), hp = 2 + st * 2 + st * st * 0.6;   // 병력이 많을수록 떼도 커져요
      for (let i = 0; i < k; i++) {
        const runner = st >= 2 && Math.random() < 0.18;
        this.objs.push({ t: 'z', kind: runner ? 'runner' : 'walker', x: clamp(cx + (i % 5 - 2) * 26 + Math.random() * 8, 24, ZW.W - 24), y: -30 - Math.floor(i / 5) * 28,
          hp: runner ? hp * 0.6 : hp, max: runner ? hp * 0.6 : hp, sp: runner ? 85 + Math.random() * 30 : 22 + Math.random() * 18, r: 11, wob: Math.random() * 6, power: 1 + Math.floor(st / 2) });
      }
      if (st >= 3) for (let i = 0; i < 1 + rand(st >= 5 ? 3 : 2); i++) {
        const bh = hp * 6;
        this.objs.push({ t: 'z', kind: 'brute', x: clamp(cx + (Math.random() - 0.5) * 120, 30, ZW.W - 30), y: -90 - i * 40, hp: bh, max: bh, sp: 18, r: 20, wob: 0, power: 4 + st });
      }
    } else {
      const hp = 40 + st * 35;
      this.objs.push({ t: 'barrel', x: 60 + Math.random() * (ZW.W - 120), y: -40, hp, max: hp, reward: Math.random() < 0.5 ? 'gun' : 'men' });
    }
  },
  update(dt) {
    this.banner.t -= dt; this.shake = Math.max(0, this.shake - dt * 20);
    if (this.clearT > 0) { if ((this.clearT -= dt) <= 0) { this.stage++; this.newStage(); } return; }
    const dir = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
    if (dir) this.x += dir * 380 * dt;
    else if (this.target != null) this.x += (this.target - this.x) * Math.min(1, dt * 10);
    this.x = clamp(this.x, 24, ZW.W - 24);
    const v = this.boss ? 0 : 120;
    this.dist += v * dt;
    for (const p of this.props) { p.y += v * dt; if (p.y > ZW.H + 80) { p.y -= 840; p.kind = rand(3); } }
    while (this.script.length && this.script[0].d <= this.dist) this.spawn(this.script.shift());
    if (!this.bossSpawned && this.dist >= this.length) {
      this.bossSpawned = true;
      const hp = 150 + this.stage * 200 + this.stage * this.stage * 120;
      this.boss = { t: 'boss', x: ZW.W / 2, y: -80, hp, max: hp, summon: 3 };
      this.objs.forEach(o => { if (o.t === 'gate') o.dead = true; });     // 보스전에선 길이 멈추니 남은 게이트는 치워요
      this.objs.push(this.boss);
      this.banner = { txt: '⚠ BOSS', t: 1.4 };
    }
    if ((this.fireT -= dt) <= 0 && this.n > 0) {
      this.fireT = 0.1;
      const k = Math.min(1 + Math.floor(this.n / 4), 14), dmg = (this.dps() * 0.1) / k, R = this.radius();
      for (let i = 0; i < k; i++) this.bullets.push({ x: this.x + (Math.random() - 0.5) * Math.max(100, R * 1.7), y: ZW.SQUAD_Y - 14, dmg });
    }
    for (const b of this.bullets) b.y -= 780 * dt;
    const R = this.radius();
    for (const o of this.objs) {
      if (o.t === 'gate') { o.y += v * dt; if (!o.used && o.y > ZW.SQUAD_Y - 10 && o.y < ZW.SQUAD_Y + 10 && Math.abs(this.x - o.x) < o.w / 2) this.passGate(o); }
      else if (o.t === 'z') {
        o.y += (v + o.sp) * dt; o.wob += dt * (o.kind === 'runner' ? 12 : 6);
        if (o.y > 170) o.x += Math.sign(this.x - o.x) * Math.min(Math.abs(this.x - o.x), (o.kind === 'runner' ? 80 : 55) * dt);
        if (Math.hypot(o.x - this.x, o.y - ZW.SQUAD_Y) < R + o.r) { o.dead = true; this.loseMen(o.power); this.splat(o.x, o.y, o.r); }
      } else if (o.t === 'barrel') o.y += v * dt;
      else if (o.t === 'boss') {
        o.y = Math.min(o.y + (16 + this.stage * 2) * dt, ZW.SQUAD_Y - 52);
        if ((o.summon -= dt) <= 0) {                                   // 보스가 졸개를 부름
          o.summon = this.stage >= 3 ? 4 : 5;
          for (let i = 0, m = this.stage >= 3 ? 6 : 4; i < m; i++) this.objs.push({ t: 'z', kind: 'walker', x: clamp(o.x + (i - (m - 1) / 2) * 30, 24, ZW.W - 24), y: o.y + 30, hp: 2 + this.stage * 2, max: 2 + this.stage * 2, sp: 50, r: 11, wob: i, power: 1 + Math.floor(this.stage / 2) });
        }
        if (o.y >= ZW.SQUAD_Y - 53) { o.bite = (o.bite || 0) - dt; if (o.bite <= 0) { o.bite = 0.25; this.loseMen(4 + this.stage * 2); this.shake = 6; } }
      }
      if (o.y > ZW.H + 60) o.dead = true;
    }
    const front = this.objs.filter(o => !o.dead && o.t !== 'gate').sort((p, q) => q.y - p.y);   // 총알은 가까운 것부터 맞아요
    for (const b of this.bullets) {
      if (b.hit || b.y < -20) continue;
      for (const o of front) {
        if (o.dead || o.t === 'gate') continue;
        const r = o.t === 'boss' ? 50 : o.t === 'barrel' ? 20 : o.r + 2;
        if (Math.abs(b.x - o.x) < r && Math.abs(b.y - o.y) < r) {
          b.hit = true; o.hp -= b.dmg; o.flash = 0.06;
          if (o.hp <= 0) this.kill(o);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.hit && b.y > -20);
    this.objs = this.objs.filter(o => !o.dead);
    for (const o of this.objs) if (o.flash) o.flash -= dt;
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    for (const d of this.decals) d.y += v * dt;
    this.decals = this.decals.filter(d => d.y < ZW.H + 30).slice(-60);
  },
  splat(x, y, r) {
    this.decals.push({ x, y, r: r * (1.2 + Math.random()), a: Math.random() * 6 });
    for (let i = 0; i < 6; i++) this.fx.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, t: 0.35, c: '#6b1010', p: true });
  },
  passGate(o) {
    const pair = this.objs.filter(g => g.t === 'gate' && !g.used && Math.abs(g.y - o.y) < 2);
    pair.forEach(g => { g.used = true; g.dead = true; });
    const before = this.n;
    if (o.op === '+') this.n += o.v; if (o.op === '-') this.n -= o.v; if (o.op === '×') this.n *= o.v; if (o.op === '÷') this.n = Math.ceil(this.n / o.v);
    this.n = Math.max(0, Math.min(999, this.n));
    this.fx.push({ x: this.x, y: ZW.SQUAD_Y - 54, t: 0.9, txt: `${this.n >= before ? '+' : ''}${this.n - before}`, c: this.n >= before ? '#5cc8ff' : '#ff5d73' });
    this.hud();
    if (this.n <= 0) this.gameOver();
  },
  kill(o) {
    o.dead = true;
    if (o.t === 'z') { this.kills++; this.splat(o.x, o.y, o.r); }
    if (o.t === 'barrel') {
      for (let i = 0; i < 12; i++) this.fx.push({ x: o.x, y: o.y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, t: 0.45, c: i % 2 ? '#ffb347' : '#ff5d2b', p: true });
      if (o.reward === 'gun') { this.gun++; this.fx.push({ x: o.x, y: o.y, t: 1, txt: '무기 강화!', c: '#ffd23f' }); }
      else { const add = 6 + this.stage * 3; this.n += add; this.fx.push({ x: o.x, y: o.y, t: 1, txt: `+${add} 병력`, c: '#5cc8ff' }); }
      this.hud();
    }
    if (o.t === 'boss') {
      this.boss = null; this.kills += 10; this.clearT = 2.2; this.shake = 10;
      this.banner = { txt: `STAGE ${this.stage} CLEAR`, t: 2 };
      this.objs.filter(z => z.t === 'z').forEach(z => { z.dead = true; this.splat(z.x, z.y, z.r); });
    }
  },
  loseMen(k) {
    this.n = Math.max(0, this.n - k); this.hud(); this.shake = Math.max(this.shake, 3);
    if (this.n <= 0) this.gameOver();
  },
  gameOver() {
    if (this.over) return;
    this.over = true;
    const best = Math.max(+store.get('best-zombie', 0), this.stage);
    store.set('best-zombie', best);
    after(700, () => showResult({ title: '🧟 부대가 전멸했어요!', subtitle: `스테이지 ${this.stage} · 처치 ${this.kills}마리 · 최고 스테이지 ${best}`, solo: 'zombie' }));
  },

  draw() {
    const c = $('#zw-cv').getContext('2d'), { W, H } = ZW;
    c.save();
    if (this.shake) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    c.fillStyle = '#1d2117'; c.fillRect(-10, -10, W + 20, H + 20);
    c.fillStyle = '#3a3d40'; c.fillRect(36, -10, W - 72, H + 20);                     // 도로
    const g = c.createLinearGradient(36, 0, W - 36, 0); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = g; c.fillRect(36, -10, W - 72, H + 20);
    c.fillStyle = '#55595e'; c.fillRect(30, -10, 6, H + 20); c.fillRect(W - 36, -10, 6, H + 20);
    const off = this.dist % 80;
    c.fillStyle = 'rgba(230,200,90,.55)';
    for (let y = -80 + off; y < H; y += 80) c.fillRect(W / 2 - 3, y, 6, 40);
    for (const p of this.props) {                                                       // 길가 잔해
      const x = p.side ? W - 18 : 18;
      c.fillStyle = ['#4b3a2a', '#33373d', '#5a2e2a'][p.kind];
      if (p.kind === 0) { c.fillRect(x - 10, p.y, 20, 34); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x - 10, p.y + 10, 20, 4); }
      else if (p.kind === 1) { c.beginPath(); c.arc(x, p.y, 9, 0, 7); c.fill(); }
      else { c.save(); c.translate(x, p.y); c.rotate(0.4); c.fillRect(-6, -18, 12, 36); c.restore(); }
    }
    c.fillStyle = 'rgba(90,10,10,.55)';
    for (const d of this.decals) { c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * 0.7, d.a, 0, 7); c.fill(); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const o of this.objs) {
      if (o.t === 'gate') {
        const good = o.op === '+' || o.op === '×', col = good ? '#3aa0ff' : '#ff4d5e';
        c.save(); c.shadowColor = col; c.shadowBlur = 18;
        c.fillStyle = good ? 'rgba(40,120,220,.35)' : 'rgba(220,40,60,.35)'; c.strokeStyle = col; c.lineWidth = 3;
        c.beginPath(); c.roundRect(o.x - o.w / 2, o.y - 24, o.w, 48, 6); c.fill(); c.stroke(); c.restore();
        c.fillStyle = '#e8eef7'; c.fillRect(o.x - o.w / 2 - 6, o.y - 34, 6, 68); c.fillRect(o.x + o.w / 2, o.y - 34, 6, 68);
        c.fillStyle = '#fff'; c.font = '30px "Black Han Sans", sans-serif'; c.fillText(`${o.op}${o.v}`, o.x, o.y + 2);
      } else if (o.t === 'z') this.drawZombie(c, o);
      else if (o.t === 'boss') this.drawBoss(c, o);
      else if (o.t === 'barrel') {
        c.fillStyle = o.flash > 0 ? '#fff' : '#a8281f'; c.beginPath(); c.roundRect(o.x - 18, o.y - 22, 36, 44, 5); c.fill();
        c.fillStyle = '#ffcc00'; for (let i = 0; i < 4; i++) { c.save(); c.beginPath(); c.rect(o.x - 18, o.y - 6, 36, 12); c.clip(); c.fillRect(o.x - 22 + i * 12, o.y - 6, 6, 12); c.restore(); }
        c.fillStyle = '#222'; c.font = 'bold 12px "Noto Sans KR", sans-serif'; c.fillText(o.reward === 'gun' ? '무기' : '병력', o.x, o.y + 14);
        c.fillStyle = '#fff'; c.font = 'bold 14px "Noto Sans KR", sans-serif'; c.fillText(Math.ceil(o.hp), o.x, o.y - 32);
      }
    }
    c.strokeStyle = 'rgba(255,214,120,.9)'; c.lineWidth = 2;
    for (const b of this.bullets) { c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x, b.y + 12); c.stroke(); }
    this.drawSquad(c);
    for (const f of this.fx) {
      c.globalAlpha = Math.min(1, f.t * 2.5);
      if (f.txt) { c.fillStyle = f.c; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 4; c.font = '26px "Black Han Sans", sans-serif'; c.strokeText(f.txt, f.x, f.y - (1 - f.t) * 30); c.fillText(f.txt, f.x, f.y - (1 - f.t) * 30); }
      else if (f.p) { f.x += f.vx / 60; f.y += f.vy / 60; c.fillStyle = f.c; c.fillRect(f.x - 2, f.y - 2, 4, 4); }
      c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(44, 12, W - 88, 8);
    c.fillStyle = '#e9b949'; c.fillRect(44, 12, (W - 88) * Math.min(1, this.dist / this.length), 8);
    c.fillStyle = '#ff4d5e'; c.beginPath(); c.arc(W - 44, 16, 7, 0, 7); c.fill();
    if (this.boss) {
      const b = this.boss;
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(40, 30, W - 80, 12);
      c.fillStyle = '#c0392b'; c.fillRect(40, 30, (W - 80) * Math.max(0, b.hp / b.max), 12);
      c.fillStyle = '#fff'; c.font = 'bold 11px "Noto Sans KR", sans-serif'; c.fillText('BOSS', W / 2, 37);
    }
    if (this.banner.t > 0) {
      c.globalAlpha = Math.min(1, this.banner.t * 2); c.fillStyle = '#f2f2f2'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 6; c.font = '48px "Black Han Sans", sans-serif';
      c.strokeText(this.banner.txt, W / 2, H * 0.35); c.fillText(this.banner.txt, W / 2, H * 0.35); c.globalAlpha = 1;
    }
    c.restore();
  },
  drawZombie(c, o) {
    const skin = o.flash > 0 ? '#ffffff' : o.kind === 'runner' ? '#a86452' : o.kind === 'brute' ? '#5f6472' : '#6f8a5c';
    const r = o.r, sw = Math.sin(o.wob) * (o.kind === 'brute' ? 1.5 : 3);
    c.strokeStyle = skin; c.lineWidth = o.kind === 'brute' ? 7 : 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(o.x - r * 0.7, o.y + 2); c.lineTo(o.x - r * 0.9, o.y + r * 1.3 + sw); c.moveTo(o.x + r * 0.7, o.y + 2); c.lineTo(o.x + r * 0.9, o.y + r * 1.3 - sw); c.stroke();
    c.fillStyle = o.kind === 'brute' ? '#3b3f4a' : '#3d4a33'; c.beginPath(); c.ellipse(o.x, o.y + 2, r, r * 0.85, 0, 0, 7); c.fill();   // 옷
    c.fillStyle = skin; c.beginPath(); c.arc(o.x, o.y - r * 0.25, r * 0.72, 0, 7); c.fill();                                           // 머리
    c.fillStyle = '#ff2b2b'; c.beginPath(); c.arc(o.x - r * 0.25, o.y - r * 0.2, r * 0.12, 0, 7); c.arc(o.x + r * 0.25, o.y - r * 0.2, r * 0.12, 0, 7); c.fill();
    if (o.kind === 'brute') {
      c.fillStyle = '#888c96'; c.fillRect(o.x - r * 0.8, o.y + 2, r * 1.6, 5);
      c.fillStyle = '#111'; c.fillRect(o.x - 16, o.y - r - 12, 32, 4); c.fillStyle = '#d64545'; c.fillRect(o.x - 16, o.y - r - 12, 32 * Math.max(0, o.hp / o.max), 4);
    }
  },
  drawBoss(c, o) {
    const r = 50;
    c.save(); c.shadowColor = '#ff2020'; c.shadowBlur = 25;
    c.fillStyle = o.flash > 0 ? '#fff' : '#5a1e22'; c.beginPath(); c.arc(o.x, o.y, r, 0, 7); c.fill(); c.restore();
    c.fillStyle = '#3b1215'; c.beginPath(); c.arc(o.x, o.y + 10, r * 0.75, 0, Math.PI); c.fill();
    c.strokeStyle = '#7a2a2e'; c.lineWidth = 12; c.lineCap = 'round';
    const sw = Math.sin(performance.now() / 300) * 6;
    c.beginPath(); c.moveTo(o.x - r * 0.8, o.y + 10); c.lineTo(o.x - r * 1.35, o.y + r + sw); c.moveTo(o.x + r * 0.8, o.y + 10); c.lineTo(o.x + r * 1.35, o.y + r - sw); c.stroke();
    c.fillStyle = '#ffde00'; c.beginPath(); c.arc(o.x - 16, o.y - 12, 7, 0, 7); c.arc(o.x + 16, o.y - 12, 7, 0, 7); c.fill();
    c.fillStyle = '#ff2020'; c.beginPath(); c.arc(o.x - 16, o.y - 12, 3, 0, 7); c.arc(o.x + 16, o.y - 12, 3, 0, 7); c.fill();
  },
  drawSquad(c) {
    const shown = Math.min(this.n, 140), firing = performance.now() % 100 < 50;
    for (let i = 0; i < shown; i++) {
      const r = 5.6 * Math.sqrt(i), a = i * 2.399;
      const x = this.x + Math.cos(a) * r, y = ZW.SQUAD_Y + Math.sin(a) * r * 0.75;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 5, 6, 3, 0, 0, 7); c.fill();
      c.strokeStyle = '#1b1b1b'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 3, y); c.lineTo(x + 3, y - 10); c.stroke();     // 총
      c.fillStyle = '#4b5a3a'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill();                                                  // 몸
      c.fillStyle = '#2f3826'; c.beginPath(); c.arc(x, y - 1.5, 4.6, 0, 7); c.fill();                                          // 헬멧
      if (firing && i % 3 === 0) { c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(x + 3, y - 12, 2.2, 0, 7); c.fill(); }
    }
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 5; c.font = '24px "Black Han Sans", sans-serif';
    c.strokeText(this.n, this.x, ZW.SQUAD_Y + this.radius() + 18); c.fillText(this.n, this.x, ZW.SQUAD_Y + this.radius() + 18);
  },
};
(() => {
  const cv = $('#zw-cv');
  const set = e => { Zombie.target = cvPoint(cv, e).x; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); set(e); });
  cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') set(e); });
})();
register('zombie', { solo: () => Zombie.start(), stop: () => { Zombie.over = true; }, pad: ['ArrowLeft', 'ArrowRight'] });
