/* =====================================================================
 *  🧟 좀비 웨이브 (v13.5 리뉴얼) — 화면 · 조작 · 효과. 규칙은 js/shared/zombie-core.js (ZCore)
 *  조작: 끌기(어디든) · 마우스 · ← → (A D) 로 부대 이동 · 💣 수류탄: 스페이스(G) 또는 오른쪽 아래 버튼
 *  스테이지 클리어 → 강화 3개 중 하나 고르기 (누르기 또는 1 · 2 · 3)
 * ===================================================================== */
const ZW = { W: 480, H: 720, NADE: { x: 434, y: 674, r: 30 } };
makeScreen('zombie', {
  title: '🧟 좀비 웨이브', status: '끌거나 ←→ 로 부대를 움직여요 · 상자를 부수면 특수 무기 · 💣 수류탄: 스페이스 / 오른쪽 아래 버튼',
  stats: [['score', '점수'], ['stage', '스테이지'], ['n', '병력']],
  body: `<div class="center zw-center"><canvas id="zw-cv" class="game-cv" width="${ZW.W}" height="${ZW.H}"></canvas><div class="zw-perk" id="zw-perk" hidden></div></div>`,
});

const ZW_THEMES = [
  { name: '도심', kind: 'city', road: [56, 59, 64], side: [46, 49, 55], line: 'rgba(238,238,232,.55)', mid: 'rgba(240,200,90,.7)', lanes: 3 },
  { name: '숲길', kind: 'forest', road: [60, 58, 54], side: [40, 70, 42], line: 'rgba(235,235,225,.5)', mid: 'rgba(240,200,90,.65)', lanes: 2 },
  { name: '강 위 다리', kind: 'bridge', road: [66, 69, 74], side: [30, 70, 98], line: 'rgba(238,238,232,.55)', mid: 'rgba(240,200,90,.7)', lanes: 3 },
  { name: '사막 도로', kind: 'desert', road: [74, 65, 57], side: [198, 162, 110], line: 'rgba(250,240,220,.55)', mid: 'rgba(250,215,120,.7)', lanes: 2 },
  { name: '눈길', kind: 'snow', road: [86, 92, 100], side: [222, 230, 238], line: 'rgba(250,250,255,.6)', mid: 'rgba(250,215,120,.7)', lanes: 2 },
];
const ZW_LOOK = {
  walker: { skin: ['#86a372', '#7b9a6c', '#93a97c'], cloth: ['#4d5d3e', '#5a4b3a', '#3f4f5f', '#5d3f3f'], hair: '#2a2620' },
  runner: { skin: ['#b98a72', '#a87d68'], cloth: ['#6a2e2a', '#4a2a3a'], hair: '#1d1715' },
  spitter: { skin: ['#93c24e', '#88b648'], cloth: ['#3e5a26'], hair: '#30451d' },
  brute: { skin: ['#7c8594', '#858d99'], cloth: ['#3a3f4a'], hair: '#2c3038' },
  bloater: { skin: ['#b4bb63', '#a9b05c'], cloth: ['#76733e'], hair: '#5b5a30' },
  shield: { skin: ['#8fa07e', '#86977a'], cloth: ['#2b3d68'], hair: '#1e2a48' },
  screamer: { skin: ['#b49ad0', '#a88fc4'], cloth: ['#432d5e'], hair: '#efe7f7' },
};
const ZW_BOSS_NAME = k => ZCore.BOSSES[k].name;
const zrgb = (a, k = 0) => `rgb(${clamp(a[0] + k, 0, 255)},${clamp(a[1] + k, 0, 255)},${clamp(a[2] + k, 0, 255)})`;
const zfmt = n => Math.round(n).toLocaleString('ko-KR');

const Zombie = {
  g: null, Q: 1, over: true,
  start() {
    stopLocal();
    S.solo = 'zombie';
    const Z = ZCore;
    this.g = Z.create((Math.random() * 4294967296) >>> 0);
    Object.assign(this, { over: false, target: null, drag: null, inp: {}, T: 0, shake: 0, red: 0, parts: [], decals: [], texts: [], banner: null, tip: null,
      best: +store.get('zw-best', 0) || 0, rec: false, last: {}, snd: {}, props: [], themeI: -1, tile: null, flameT: 0, dead: 0 });
    this.setupCanvas();
    this.hidePerk();
    this.setTheme();
    this.say(`STAGE 1`, ZW_THEMES[0].name, '#f2f2f2', 1.8);
    show('zombie');
    this.hud(true);
    gameLoop(dt => this.frame(dt));
  },
  setupCanvas() {
    const cv = $('#zw-cv');
    this.Q = Math.min(2, Math.max(1, Math.round((window.devicePixelRatio || 1) * 2) / 2));
    if (cv.width !== ZW.W * this.Q) { cv.width = ZW.W * this.Q; cv.height = ZW.H * this.Q; }
    this.ctx = cv.getContext('2d');
    this.vig = null; this.tile = null; this.themeI = -1; this.splats = null;
  },
  theme() { return ZW_THEMES[(this.g.stage - 1) % ZW_THEMES.length]; },
  setTheme() {
    const i = (this.g.stage - 1) % ZW_THEMES.length;
    if (i === this.themeI && this.tile) return;
    this.themeI = i; this.tile = this.makeTile(ZW_THEMES[i]);
    const R = seeded(7 + i * 131);
    this.props = Array.from({ length: 10 }, (_, j) => ({ y: j * 84 - 60, side: j % 2, k: Math.floor(R() * 4), s: 0.8 + R() * 0.4, r: R() }));
  },
  frame(dt) {
    const g = this.g;
    this.T += dt;
    if (!this.over) {
      const dir = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
      this.inp.dir = dir; this.inp.target = dir ? null : this.target;
      const ph = g.phase;
      ZCore.step(g, dt, this.inp);
      this.events();
      if (ph !== 'run' && g.phase === 'run') this.setTheme();
      this.hud();
    }
    this.fx(dt);
    this.draw();
  },
  hud(force) {
    const g = this.g, L = this.last;
    const put = (k, v) => { if (force || L[k] !== v) { L[k] = v; setStat('zombie', k, v); } };
    put('score', zfmt(g.score)); put('stage', g.stage); put('n', g.n + ' / ' + g.cap);
  },

  /* ───────── 규칙에서 온 일 → 효과 · 소리 · 글자 ───────── */
  events() {
    const g = this.g, Z = ZCore;
    for (const e of g.ev) {
      switch (e.t) {
        case 'kill': {
          const green = e.k === 'spitter' || e.k === 'bloater';
          this.burst(e.x, e.y, green ? '#8fd14f' : '#8e1b1b', 5 + Math.round(e.r / 3), 150);
          this.decal(e.x, e.y + 2, green ? 1 : 0, e.r * 1.4);
          if (e.big) this.float(e.x, e.y - 14, '+' + zfmt(e.pts), '#ffe08a', 15);
          this.sfx('kill', 70, () => Sound.blip(180 + Math.random() * 60, 0.03, 0.5));
          break;
        }
        case 'hurt':
          this.red = Math.min(0.45, this.red + 0.12 + e.k * 0.02); this.shake = Math.max(this.shake, Math.min(10, 3 + e.k));
          this.float(g.x + (Math.random() - 0.5) * 30, Z.SQ_Y - 40, '−' + e.k, '#ff5d73', 20);
          this.sfx('hurt', 260, () => Sound.play('bad'));
          break;
        case 'bite': this.burst(e.x, e.y, '#8e1b1b', 6, 120); break;
        case 'gate': {
          const good = e.d >= 0;
          this.float(g.x, Z.SQ_Y - 60, (good ? '+' : '−') + Math.abs(e.d), good ? '#5cc8ff' : '#ff5d73', 30);
          if (e.extra) this.float(g.x, Z.SQ_Y - 92, `정원 초과 +${zfmt(e.extra * 25 * Z.ptMul(g.stage))}점`, '#ffe08a', 15);
          Sound.blip(good ? 660 : 220, 0.08, 0.9); if (good) setTimeout(() => Sound.blip(880, 0.08, 0.8), 70);
          break;
        }
        case 'open':
          this.burst(e.x, e.y, '#a8743f', 12, 220, 'chip'); this.burst(e.x, e.y, '#ffd36b', 6, 160, 'spark');
          Sound.blip(520, 0.05, 0.8);
          break;
        case 'take': {
          if (e.k === 'w') { const W = Z.WEAPONS[e.w]; this.say(`${W.name}${e.lv > 1 ? ' Lv.' + e.lv : ''}!`, W.desc, W.col, 1.4, true); }
          else if (e.k === 'men') this.float(g.x, Z.SQ_Y - 70, `지원군 +${e.d}${e.extra ? ' (정원 초과 → 점수)' : ''}`, '#5cc8ff', 18);
          else if (e.k === 'nade') this.float(g.x, Z.SQ_Y - 70, g.nades >= g.nadeMax ? '수류탄 가득 → +점수' : '수류탄 +1', '#ffd36b', 18);
          else if (e.k === 'gold') this.say('점수 ×2', '12초 동안 모든 점수 2배!', '#ffd23f', 1.3, true);
          Sound.play('pop');
          break;
        }
        case 'boom': {
          const big = e.kind === 'nade' || e.kind === 'bloat';
          this.explode(e.x, e.y, e.r, e.kind === 'bloat' ? '#b8e05a' : '#ffb347');
          this.shake = Math.max(this.shake, big ? 9 : 4);
          this.sfx('boom', 90, () => Sound.blip(90 + Math.random() * 40, 0.12, big ? 1.4 : 0.8));
          break;
        }
        case 'splash':
          this.burst(e.x, e.y, '#9be04a', 10, 140); this.decal(e.x, e.y, 1, e.r * 1.1);
          this.sfx('splash', 120, () => Sound.blip(300, 0.05, 0.6));
          break;
        case 'slam': this.ring(e.x, e.y, e.r * 1.3, '#d8c7a8'); this.burst(e.x, e.y, '#9a8c74', 16, 260, 'chip'); this.shake = 12; Sound.blip(70, 0.2, 1.6); break;
        case 'charge': this.shake = Math.max(this.shake, 6); Sound.blip(110, 0.25, 1.2); break;
        case 'shbreak': this.burst(e.x, e.y + 10, '#cfd8e3', 10, 200, 'spark'); this.float(e.x, e.y - 18, '방패 깨짐!', '#cfd8e3', 14); Sound.blip(1200, 0.04, 0.7); break;
        case 'spit': this.burst(e.x, e.y + 8, '#9be04a', 4, 60); break;
        case 'scream': this.ring(e.x, e.y, 170, '#c69cff'); this.sfx('scream', 400, () => Sound.blip(1500, 0.18, 0.5)); break;
        case 'nade': Sound.blip(400, 0.06, 0.6); break;
        case 'empty': this.float(g.x, Z.SQ_Y - 70, '탄약 끝 → 소총', '#c8ced8', 16); break;
        case 'new': { const Zm = Z.ZOMBIES[e.k]; this.tip = { txt: `새 좀비: ${Zm.name}`, sub: Zm.tip, t: 4.2, T: 4.2 }; Sound.play('turn'); break; }
        case 'boss': this.say('⚠ BOSS', ZW_BOSS_NAME(e.k), '#ff5d73', 2); Sound.play('turn'); break;
        case 'clear': {
          this.say(`STAGE ${e.stage} CLEAR`, `클리어 +${zfmt(e.clear)} · 빠르게 +${zfmt(e.fast)}${e.perfect ? ` · 무피해 +${zfmt(e.perfect)}` : ''}`, '#7dffb0', 2.2);
          this.explode(e.x, e.y, 90, '#ff7b5a'); this.shake = 12;
          Sound.play('mission');
          break;
        }
        case 'perk': this.showPerk(); break;
        case 'stage': this.say(`STAGE ${e.s}`, this.theme().name + (e.s % 5 === 0 ? ' · 고비예요!' : ''), '#f2f2f2', 1.8); break;
        case 'over': this.gameOver(); break;
      }
    }
    g.ev.length = 0;
    if (!this.rec && this.best > 0 && g.score > this.best) {
      this.rec = true;
      this.say('신기록!', `지난 최고 ${zfmt(this.best)}점을 넘었어요`, '#ffd23f', 1.8, true);
      Sound.play('title');
    }
  },
  sfx(k, gap, fn) { const now = performance.now(); if (now - (this.snd[k] || 0) < gap) return; this.snd[k] = now; fn(); },
  say(txt, sub, col, T, small) { this.banner = { txt, sub, col, t: T, T, small: !!small }; },
  float(x, y, txt, col, size) { this.texts.push({ x, y, txt, col, size, t: 1.1, T: 1.1 }); if (this.texts.length > 40) this.texts.shift(); },
  burst(x, y, col, n, sp, k = 'dot') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7);
      this.parts.push({ k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.35 + Math.random() * 0.3, T: 0.6, s: k === 'chip' ? 2 + Math.random() * 3 : 1.5 + Math.random() * 2.5, c: col, dr: 3.5, rot: Math.random() * 6 });
    }
    if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
  },
  ring(x, y, r, col) { this.parts.push({ k: 'ring', x, y, vx: 0, vy: 0, t: 0.45, T: 0.45, s: r, c: col }); },
  explode(x, y, r, col) {
    this.ring(x, y, r, col);
    for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283, v = r * (1 + Math.random() * 2.2); this.parts.push({ k: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.3 + Math.random() * 0.35, T: 0.65, s: 6 + Math.random() * r * 0.18, c: col, dr: 4 }); }
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.283, v = r * Math.random(); this.parts.push({ k: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0.8 + Math.random() * 0.6, T: 1.4, s: 8 + Math.random() * 10, c: '#3a3a3a', dr: 2 }); }
    this.decal(x, y, 2, r * 0.9);
  },
  decal(x, y, kind, r) {
    if (!this.splats) this.makeSplats();
    const imgs = this.splats[kind];
    this.decals.push({ x, y, img: imgs[Math.floor(Math.random() * imgs.length)], r: r * (0.9 + Math.random() * 0.5), a: Math.random() * 6.283, k: kind });
    if (this.decals.length > 90) this.decals.shift();
  },
  /** 효과 움직이기 (규칙과 따로 · 일시정지 중엔 gameLoop 가 안 불러요) */
  fx(dt) {
    const g = this.g, v = g && g.phase === 'run' && !this.over ? ZCore.ROAD_V : 0;
    this.shake = Math.max(0, this.shake - dt * 30); this.red = Math.max(0, this.red - dt * 1.4);
    for (const p of this.parts) {
      p.t -= dt;
      if (p.k === 'ring') continue;
      const k = Math.max(0, 1 - (p.dr || 0) * dt);
      p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += (p.vy + (p.k === 'smoke' || p.k === 'fire' ? 0 : v)) * dt;
      if (p.k === 'smoke') { p.s += dt * 14; p.y += v * dt * 0.5; }
      if (p.k === 'flame') p.s += dt * 24;
    }
    this.parts = this.parts.filter(p => p.t > 0);
    for (const d of this.decals) d.y += v * dt;
    this.decals = this.decals.filter(d => d.y < ZW.H + 60);
    for (const t of this.texts) { t.t -= dt; t.y -= dt * 34; }
    this.texts = this.texts.filter(t => t.t > 0);
    for (const p of this.props) { p.y += v * dt; if (p.y > ZW.H + 90) { p.y -= 840; p.k = Math.floor(Math.random() * 4); p.s = 0.8 + Math.random() * 0.4; p.r = Math.random(); } }
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.tip && (this.tip.t -= dt) <= 0) this.tip = null;
    // 불꽃 · 로켓 연기 (그리기용 알갱이)
    if (g && g.flame && !this.over) {
      const f = g.flame;
      for (let i = 0; i < 5; i++) {
        const a = (Math.random() - 0.5) * 0.74, sp = f.range * (1.6 + Math.random() * 0.9);
        this.parts.push({ k: 'flame', x: f.x + (Math.random() - 0.5) * 10, y: ZCore.SQ_Y - 22, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, t: 0.42, T: 0.42, s: 2.5 + Math.random() * 2.5, dr: 1.2 });
      }
    }
    if (g) for (const s of g.shots) if (s.k === 'rk' && Math.random() < 0.7) this.parts.push({ k: 'smoke', x: s.x, y: s.y, vx: (Math.random() - 0.5) * 20, vy: 0, t: 0.5, T: 0.5, s: 3 + Math.random() * 2, c: '#8a8a8a', dr: 3 });
    if (g) for (const z of g.objs) if (z.t === 'z' && z.burn > 0 && Math.random() < 0.35) this.parts.push({ k: 'flame', x: z.x + (Math.random() - 0.5) * z.r, y: z.y, vx: 0, vy: -40, t: 0.3, T: 0.3, s: 3 + Math.random() * 3, dr: 1 });
  },

  /* ───────── 그리기 ───────── */
  draw() {
    const c = this.ctx, g = this.g, Z = ZCore, T = this.T;
    if (!c || !g) return;
    c.setTransform(this.Q, 0, 0, this.Q, 0, 0);
    c.save();
    if (this.shake > 0.3) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawRoad(c, g);
    for (const d of this.decals) { c.save(); c.translate(d.x, d.y); c.rotate(d.a); c.globalAlpha = d.k === 2 ? 0.55 : 0.75; c.drawImage(d.img, -d.r, -d.r, d.r * 2, d.r * 2); c.restore(); }
    c.globalAlpha = 1;
    this.drawProps(c);
    this.drawMarks(c, g, T);
    for (const o of g.objs) if (o.t === 'gate') this.drawGate(c, o);
    for (const o of g.objs) if (o.t === 'crate') this.drawCrate(c, o, T); else if (o.t === 'item') this.drawItem(c, o, T);
    const zs = g.objs.filter(o => o.t === 'z').sort((a, b) => a.y - b.y);
    for (const z of zs) this.drawZ(c, z, T, g);
    if (g.boss) this.drawBoss(c, g.boss, T);
    this.drawShots(c, g, T);
    this.drawSquad(c, g, T);
    this.drawParts(c);
    this.drawAcid(c, g);
    for (const f of g.flying) {
      const k = f.t / f.T, x = f.x0 + (f.x - f.x0) * k, y = f.y0 + (f.y - f.y0) * k - Math.sin(Math.PI * k) * 70;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(f.x0 + (f.x - f.x0) * k, f.y0 + (f.y - f.y0) * k + 6, 5, 2.5, 0, 0, 7); c.fill();
      c.fillStyle = '#3d4a2c'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.fillStyle = '#c9b25a'; c.fillRect(x - 1.5, y - 8, 3, 4);
    }
    for (const t of this.texts) {
      c.globalAlpha = Math.min(1, t.t * 3); c.font = `${t.size}px "Black Han Sans", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = Math.max(3, t.size / 5); c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.col; c.fillText(t.txt, t.x, t.y);
    }
    c.globalAlpha = 1;
    c.restore();
    if (!this.vig) this.vig = this.makeVignette();
    c.drawImage(this.vig, 0, 0, ZW.W, ZW.H);
    if (this.red > 0.01) { c.fillStyle = `rgba(200,20,30,${this.red * 0.5})`; c.fillRect(0, 0, ZW.W, ZW.H); }
    if (g.gold > 0) { c.strokeStyle = `rgba(255,210,63,${0.35 + 0.2 * Math.sin(T * 8)})`; c.lineWidth = 6; c.strokeRect(3, 3, ZW.W - 6, ZW.H - 6); }
    this.drawHud(c, g, T);
  },
  makeVignette() {
    const cv = document.createElement('canvas'); cv.width = ZW.W; cv.height = ZW.H;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(ZW.W / 2, ZW.H * 0.55, ZW.H * 0.3, ZW.W / 2, ZW.H * 0.55, ZW.H * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
    c.fillStyle = gr; c.fillRect(0, 0, ZW.W, ZW.H);
    return cv;
  },
  makeSplats() {
    const mk = (cols, seed, spikes) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const c = cv.getContext('2d'), R = seeded(seed);
      for (let k = 0; k < cols.length; k++) {
        c.fillStyle = cols[k]; c.beginPath();
        const n = 14, r0 = 15 - k * 4;
        for (let i = 0; i <= n; i++) { const a = i / n * 6.283, r = r0 * (0.7 + R() * 0.5); c[i ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
        c.fill();
      }
      for (let i = 0; i < spikes; i++) { const a = R() * 6.283, d = 16 + R() * 12; c.fillStyle = cols[0]; c.beginPath(); c.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1.5 + R() * 3, 0, 7); c.fill(); }
      return cv;
    };
    this.splats = [
      [0, 1, 2].map(i => mk(['rgba(110,14,14,.85)', 'rgba(80,8,8,.9)'], 11 + i, 7)),
      [0, 1].map(i => mk(['rgba(120,170,40,.75)', 'rgba(90,130,30,.85)'], 51 + i, 6)),
      [0, 1].map(i => mk(['rgba(20,18,16,.75)', 'rgba(10,9,8,.85)'], 91 + i, 3)),
    ];
  },
  /** 길 무늬 (테마마다 한 번 그려 두고 아래로 흘려요) */
  makeTile(th) {
    const Q = this.Q, cv = document.createElement('canvas'), TH = 256;
    cv.width = ZW.W * Q; cv.height = TH * Q;
    const c = cv.getContext('2d'), R = seeded(th.kind.length * 9973 + 17), L = 36, Rr = 444;
    c.scale(Q, Q);
    c.fillStyle = zrgb(th.side); c.fillRect(0, 0, ZW.W, TH);
    const speck = (x0, x1, n, k, a) => { for (let i = 0; i < n; i++) { const v = (R() - 0.5) * k; c.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${Math.abs(v) * a})`; c.fillRect(x0 + R() * (x1 - x0), R() * TH, 1 + R() * 2, 1 + R() * 2); } };
    for (const [x0, x1] of [[0, L], [Rr, ZW.W]]) {
      if (th.kind === 'city') { speck(x0, x1, 120, 1, 0.12); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; for (let y = 0; y < TH; y += 24) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); } }
      else if (th.kind === 'forest') { for (let i = 0; i < 160; i++) { const x = x0 + R() * (x1 - x0), y = R() * TH; c.strokeStyle = `rgba(${R() < 0.5 ? '90,140,70' : '20,45,22'},.6)`; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 4, y - 3 - R() * 4); c.stroke(); } }
      else if (th.kind === 'bridge') { c.strokeStyle = 'rgba(160,210,240,.25)'; c.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const x = x0 + R() * (x1 - x0 - 10), y = R() * TH; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 5, y - 3, x + 10, y); c.stroke(); } }
      else if (th.kind === 'desert') { speck(x0, x1, 200, 1, 0.16); c.strokeStyle = 'rgba(150,110,60,.35)'; for (let i = 0; i < 10; i++) { const y = R() * TH; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y - 4, x1, y + 2); c.stroke(); } }
      else { speck(x0, x1, 140, 1, 0.1); }
    }
    // 아스팔트
    c.fillStyle = zrgb(th.road); c.fillRect(L, 0, Rr - L, TH);
    speck(L, Rr, 1600, 1, 0.13);
    for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.06})`; c.fillRect(L + R() * 360, R() * TH, 30 + R() * 60, 16 + R() * 40); }  // 덧씌운 자국
    for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(L + 40 + R() * 320, R() * TH, 10 + R() * 14, 6 + R() * 8, R() * 3, 0, 7); c.fill(); }   // 기름 자국
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
    for (let i = 0; i < 5; i++) { let x = L + 20 + R() * 360, y = R() * TH; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 18; y += 4 + R() * 8; c.lineTo(x, y); } c.stroke(); }  // 금
    if (th.kind === 'snow') { for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(240,246,252,.25)'; c.beginPath(); c.ellipse(L + R() * 408, R() * TH, 6 + R() * 18, 2 + R() * 4, 0, 0, 7); c.fill(); } }
    if (th.kind === 'desert') { for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(200,165,110,.18)'; c.beginPath(); c.ellipse(R() < 0.5 ? L + R() * 50 : Rr - R() * 50, R() * TH, 8 + R() * 20, 3 + R() * 6, 0, 0, 7); c.fill(); } }
    // 길 가장자리 그늘 · 연석
    const gr = c.createLinearGradient(L, 0, Rr, 0);
    gr.addColorStop(0, 'rgba(0,0,0,.32)'); gr.addColorStop(0.12, 'rgba(0,0,0,0)'); gr.addColorStop(0.88, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.32)');
    c.fillStyle = gr; c.fillRect(L, 0, Rr - L, TH);
    c.fillStyle = th.kind === 'bridge' ? '#9aa1aa' : th.kind === 'city' ? '#8a8f97' : 'rgba(0,0,0,.25)';
    c.fillRect(L - 4, 0, 4, TH); c.fillRect(Rr, 0, 4, TH);
    if (th.kind === 'bridge') { c.fillStyle = '#6d747d'; for (let y = 0; y < TH; y += 32) { c.fillRect(L - 9, y, 6, 6); c.fillRect(Rr + 3, y, 6, 6); } c.fillStyle = '#7d848d'; c.fillRect(L - 7, 0, 2, TH); c.fillRect(Rr + 5, 0, 2, TH); }
    return cv;
  },
  drawRoad(c, g) {
    const th = this.theme(), TH = 256, off = g.dist % TH;
    if (!this.tile || this.themeI !== (g.stage - 1) % ZW_THEMES.length) this.setTheme();
    for (let y = -TH + off; y < ZW.H; y += TH) c.drawImage(this.tile, 0, y, ZW.W, TH);
    const d = g.dist % 80;
    c.fillStyle = th.line;
    c.fillRect(44, -10, 3, ZW.H + 20); c.fillRect(433, -10, 3, ZW.H + 20);
    if (th.lanes === 3) { for (let y = -80 + d; y < ZW.H; y += 80) { c.fillRect(170, y, 4, 40); c.fillRect(306, y, 4, 40); } }
    else { c.fillStyle = th.mid; for (let y = -80 + d; y < ZW.H; y += 80) c.fillRect(238, y, 4, 42); }
  },
  drawProps(c) {
    const k = this.theme().kind;
    for (const p of this.props) {
      const x = p.side ? 462 : 18, y = p.y, s = p.s, f = p.side ? -1 : 1;
      c.save(); c.translate(x, y);
      if (k === 'city') {
        if (p.k === 0) { c.fillStyle = '#2b2f36'; c.fillRect(-18 * f - (f < 0 ? 0 : 0), -40, 30 * f, 80); c.fillStyle = '#3a3f48'; c.fillRect(-16 * f, -34, 10 * f, 10); c.fillRect(-16 * f, 8, 12 * f, 12); }   // 건물 지붕
        else if (p.k === 1) { this.lamp(c, f); }
        else if (p.k === 2) { c.fillStyle = '#4a5260'; c.beginPath(); c.roundRect(-6, -10, 12, 20, 3); c.fill(); c.fillStyle = '#5d6676'; c.fillRect(-5, -9, 10, 4); }   // 쓰레기통
        else { c.fillStyle = '#b8352f'; c.beginPath(); c.arc(0, 0, 5 * s, 0, 7); c.fill(); c.fillStyle = '#e0e0e0'; c.beginPath(); c.arc(0, 0, 2, 0, 7); c.fill(); }   // 소화전
      } else if (k === 'forest') {
        if (p.k === 3) { c.fillStyle = '#5a4632'; c.beginPath(); c.roundRect(-4, -14, 8, 28, 3); c.fill(); }
        else this.tree(c, 22 * s, ['#1f4a26', '#2c6634', '#3c7d42'], p.r);
      } else if (k === 'bridge') {
        if (p.k < 2) this.lamp(c, f);
        else { c.strokeStyle = 'rgba(200,230,250,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(0, -4, 8, 0); c.stroke(); }
      } else if (k === 'desert') {
        if (p.k === 0 || p.k === 2) { c.fillStyle = '#3f7a3a'; c.beginPath(); c.roundRect(-5 * s, -16 * s, 10 * s, 32 * s, 5); c.fill(); c.fillRect(-12 * s, -4 * s, 8 * s, 5 * s); c.fillRect(4 * s, -10 * s, 8 * s, 5 * s); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-1, -16 * s, 2, 32 * s); }
        else { c.fillStyle = '#8a7356'; c.beginPath(); c.ellipse(0, 0, 11 * s, 8 * s, p.r * 3, 0, 7); c.fill(); c.fillStyle = '#a08a6a'; c.beginPath(); c.ellipse(-2, -2, 6 * s, 4 * s, p.r * 3, 0, 7); c.fill(); }
      } else {
        if (p.k === 3) { c.fillStyle = '#f4f8fb'; c.beginPath(); c.arc(0, 4, 8, 0, 7); c.arc(0, -6, 6, 0, 7); c.fill(); c.fillStyle = '#e08a3a'; c.fillRect(-1, -6, 5, 2); }
        else this.tree(c, 20 * s, ['#1d3b2a', '#2a5038', '#e9f0f5'], p.r);
      }
      c.restore();
    }
  },
  tree(c, r, cols, rr) {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(4, 6, r, r * 0.8, 0, 0, 7); c.fill();
    c.fillStyle = cols[0]; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.fillStyle = cols[1]; c.beginPath(); c.arc(-r * 0.2, -r * 0.2, r * 0.72, 0, 7); c.fill();
    c.fillStyle = cols[2]; c.globalAlpha = 0.8; c.beginPath(); c.arc(-r * 0.35 + rr * 4, -r * 0.35, r * 0.38, 0, 7); c.fill(); c.globalAlpha = 1;
  },
  lamp(c, f) {
    const g2 = c.createRadialGradient(26 * f, 0, 4, 26 * f, 0, 60);
    g2.addColorStop(0, 'rgba(255,226,150,.22)'); g2.addColorStop(1, 'rgba(255,226,150,0)');
    c.fillStyle = g2; c.beginPath(); c.arc(26 * f, 0, 60, 0, 7); c.fill();
    c.strokeStyle = '#7a808a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(24 * f, 0); c.stroke();
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(26 * f, 0, 4, 0, 7); c.fill();
  },
  drawMarks(c, g, T) {
    for (const m of g.marks) {
      const k = Math.min(1, m.t / m.T), pulse = 0.5 + 0.5 * Math.sin(T * 20);
      if (m.k === 'slam') {
        c.fillStyle = `rgba(255,60,60,${0.12 + 0.18 * k})`; c.beginPath(); c.arc(m.x, m.y, m.r, 0, 7); c.fill();
        c.fillStyle = `rgba(255,80,80,${0.25 + 0.25 * k})`; c.beginPath(); c.arc(m.x, m.y, m.r * k, 0, 7); c.fill();
        c.strokeStyle = `rgba(255,90,90,${0.6 + 0.4 * pulse})`; c.lineWidth = 3; c.beginPath(); c.arc(m.x, m.y, m.r, 0, 7); c.stroke();
      } else if (m.k === 'lane') {
        const x0 = m.x - m.w / 2;
        c.fillStyle = `rgba(255,50,50,${0.12 + 0.2 * k})`; c.fillRect(x0, 0, m.w, ZW.H);
        c.strokeStyle = `rgba(255,80,80,${0.5 + 0.5 * pulse})`; c.lineWidth = 3; c.strokeRect(x0, -4, m.w, ZW.H + 8);
        c.fillStyle = `rgba(255,120,120,${0.5 + 0.4 * k})`;
        for (let y = ((T * 260) % 90) - 90; y < ZW.H; y += 90) { c.beginPath(); c.moveTo(m.x - 18, y); c.lineTo(m.x, y + 22); c.lineTo(m.x + 18, y); c.lineTo(m.x + 18, y + 10); c.lineTo(m.x, y + 32); c.lineTo(m.x - 18, y + 10); c.fill(); }
      }
    }
    for (const a of g.acid) {
      const k = clamp(a.t / a.T, 0, 1);
      c.fillStyle = `rgba(150,230,60,${0.1 + 0.22 * k})`; c.beginPath(); c.arc(a.x, a.y, a.r, 0, 7); c.fill();
      c.strokeStyle = `rgba(170,250,80,${0.45 + 0.4 * k})`; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.arc(a.x, a.y, a.r, 0, 7); c.stroke(); c.setLineDash([]);
      c.fillStyle = `rgba(170,250,80,${0.35 * k})`; c.beginPath(); c.arc(a.x, a.y, a.r * k, 0, 7); c.fill();
    }
  },
  drawAcid(c, g) {
    for (const a of g.acid) {
      if (a.t < 0) continue;
      const k = clamp(a.t / a.T, 0, 1), x = a.x0 + (a.x - a.x0) * k, y = a.y0 + (a.y - a.y0) * k - Math.sin(Math.PI * k) * 80;
      c.fillStyle = '#7fd02f'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill();
      c.fillStyle = '#d9ff7a'; c.beginPath(); c.arc(x - 2, y - 2, 2.5, 0, 7); c.fill();
    }
  },
  drawGate(c, o) {
    const good = o.op === '+' || o.op === '×', col = good ? '#3aa0ff' : '#ff4d5e', x0 = o.x - o.w / 2;
    const gr = c.createLinearGradient(0, o.y - 26, 0, o.y + 26);
    gr.addColorStop(0, good ? 'rgba(70,160,255,.55)' : 'rgba(255,70,90,.55)'); gr.addColorStop(1, good ? 'rgba(30,90,200,.25)' : 'rgba(180,30,50,.25)');
    c.fillStyle = gr; c.beginPath(); c.roundRect(x0, o.y - 26, o.w, 52, 8); c.fill();
    c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0 + 6, o.y - 22, o.w - 12, 6);
    c.fillStyle = '#e8eef7'; c.fillRect(x0 - 6, o.y - 36, 7, 72); c.fillRect(x0 + o.w - 1, o.y - 36, 7, 72);
    c.font = '32px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.45)'; c.strokeText(`${o.op}${o.v}`, o.x, o.y + 2);
    c.fillStyle = '#fff'; c.fillText(`${o.op}${o.v}`, o.x, o.y + 2);
  },
  drawCrate(c, o, T) {
    const x = o.x, y = o.y, fl = o.flash > 0, W = ZCore.WEAPONS;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + 3, y + 18, 22, 7, 0, 0, 7); c.fill();
    if (o.k === 'wpn') {
      c.fillStyle = fl ? '#fff' : '#8a5a2b'; c.beginPath(); c.roundRect(x - 20, y - 20, 40, 40, 4); c.fill();
      c.strokeStyle = '#5d3b1b'; c.lineWidth = 3; c.strokeRect(x - 17, y - 17, 34, 34);
      c.beginPath(); c.moveTo(x - 17, y - 17); c.lineTo(x + 17, y + 17); c.stroke();
      const col = W[o.w].col;
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill();
      c.fillStyle = '#1b1b1b'; c.font = '14px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(W[o.w].ch, x, y + 1);
    } else if (o.k === 'sup') {
      c.fillStyle = fl ? '#fff' : '#3f6b45'; c.beginPath(); c.roundRect(x - 20, y - 18, 40, 36, 5); c.fill();
      c.strokeStyle = '#2b4a30'; c.lineWidth = 2; c.strokeRect(x - 17, y - 15, 34, 30);
      if (o.sup === 'men') { c.fillStyle = '#f2f2f2'; c.fillRect(x - 3, y - 10, 6, 20); c.fillRect(x - 10, y - 3, 20, 6); }
      else this.nadeIcon(c, x, y, 8);
    } else {
      c.fillStyle = fl ? '#fff' : '#d9a520'; c.beginPath(); c.roundRect(x - 20, y - 20, 40, 40, 5); c.fill();
      c.strokeStyle = '#8a6510'; c.lineWidth = 3; c.strokeRect(x - 16, y - 16, 32, 32);
      c.fillStyle = '#fff6c8'; c.font = '16px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('×2', x, y + 1);
      c.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(T * 6)})`; c.fillRect(x - 16, y - 16, 8, 32);
    }
    if (o.hp < o.max) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 20, y - 30, 40, 5); c.fillStyle = '#ffd36b'; c.fillRect(x - 20, y - 30, 40 * Math.max(0, o.hp / o.max), 5); }
  },
  nadeIcon(c, x, y, r) {
    c.fillStyle = '#4b5a33'; c.beginPath(); c.arc(x, y + 1, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r, y + 1); c.lineTo(x + r, y + 1); c.moveTo(x, y + 1 - r); c.lineTo(x, y + 1 + r); c.stroke();
    c.fillStyle = '#c9b25a'; c.fillRect(x - r * 0.35, y - r * 1.25, r * 0.7, r * 0.5);
    c.strokeStyle = '#c9b25a'; c.lineWidth = 2; c.beginPath(); c.arc(x + r * 0.55, y - r * 1.05, r * 0.4, Math.PI, Math.PI * 2.2); c.stroke();
  },
  drawItem(c, o, T) {
    const x = o.x, y = o.y + Math.sin(o.bob * 5) * 3, W = ZCore.WEAPONS;
    const col = o.k === 'w' ? W[o.w].col : o.k === 'men' ? '#5cc8ff' : o.k === 'gold' ? '#ffd23f' : '#c9e07a';
    const gr = c.createRadialGradient(x, y, 4, x, y, 26);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.45 + 0.2 * Math.sin(T * 8); c.fillStyle = gr; c.beginPath(); c.arc(x, y, 26, 0, 7); c.fill(); c.globalAlpha = 1;
    c.fillStyle = 'rgba(20,24,32,.85)'; c.beginPath(); c.arc(x, y, 15, 0, 7); c.fill();
    c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.k === 'w') { c.fillStyle = col; c.font = '15px "Black Han Sans", sans-serif'; c.fillText(W[o.w].ch, x, y + 1); }
    else if (o.k === 'men') { c.fillStyle = col; c.font = '13px "Black Han Sans", sans-serif'; c.fillText('+' + o.v, x, y + 1); }
    else if (o.k === 'gold') { c.fillStyle = col; c.font = '13px "Black Han Sans", sans-serif'; c.fillText('×2', x, y + 1); }
    else this.nadeIcon(c, x, y + 1, 7);
  },
  drawZ(c, z, T, g) {
    const L = ZW_LOOK[z.k], fl = z.flash > 0, frz = z.frz > 0;
    const skin = fl ? '#ffffff' : L.skin[z.id % L.skin.length], cloth = fl ? '#eeeeee' : L.cloth[z.id % L.cloth.length];
    const r = z.r, x = z.x, y = z.y, sw = Math.sin(z.wob) * (z.k === 'brute' ? 2 : 3.5);
    c.fillStyle = 'rgba(0,0,0,.33)'; c.beginPath(); c.ellipse(x + 2, y + r * 0.8, r * 1.05, r * 0.42, 0, 0, 7); c.fill();
    if (z.haste > 0) { c.strokeStyle = 'rgba(255,70,70,.55)'; c.lineWidth = 2; c.beginPath(); for (const dx of [-r * 0.6, 0, r * 0.6]) { c.moveTo(x + dx, y - r - 4); c.lineTo(x + dx, y - r - 14); } c.stroke(); }
    c.lineCap = 'round';
    if (z.k === 'bloater') {
      const p = 1 + Math.sin(T * 6 + z.id) * 0.05;
      c.strokeStyle = skin; c.lineWidth = r * 0.28;
      c.beginPath(); c.moveTo(x - r * 0.7, y + r * 0.3); c.lineTo(x - r * 0.8 + sw * 0.3, y + r * 1.05 + sw); c.moveTo(x + r * 0.7, y + r * 0.3); c.lineTo(x + r * 0.8 - sw * 0.3, y + r * 1.05 - sw); c.stroke();
      c.fillStyle = cloth; c.beginPath(); c.ellipse(x, y - r * 0.1, r * p, r * 0.92 * p, 0, 0, 7); c.fill();
      c.fillStyle = skin; c.beginPath(); c.ellipse(x, y + r * 0.05, r * 0.82 * p, r * 0.72 * p, 0, 0, 7); c.fill();
      c.fillStyle = fl ? '#fff' : '#c9d46a';
      for (let i = 0; i < 5; i++) { const a = z.id + i * 1.7; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.42, r * 0.13, 0, 7); c.fill(); }
      c.fillStyle = fl ? '#fff' : L.skin[0]; c.beginPath(); c.arc(x, y + r * 0.62, r * 0.36, 0, 7); c.fill();
      c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(x - r * 0.13, y + r * 0.74, r * 0.06, 0, 7); c.arc(x + r * 0.13, y + r * 0.74, r * 0.06, 0, 7); c.fill();
    } else {
      const wide = z.k === 'brute' ? 1.15 : z.k === 'runner' ? 0.82 : 1;
      c.strokeStyle = skin; c.lineWidth = r * (z.k === 'brute' ? 0.5 : 0.34);
      if (z.k === 'runner' && !(z.wind > 0)) {      // 팔을 뒤로 젖히고 달려요
        c.beginPath(); c.moveTo(x - r * 0.6, y); c.lineTo(x - r * 0.95, y - r * 0.9 + sw * 0.5); c.moveTo(x + r * 0.6, y); c.lineTo(x + r * 0.95, y - r * 0.9 - sw * 0.5); c.stroke();
      } else {
        c.beginPath(); c.moveTo(x - r * 0.72 * wide, y + r * 0.1); c.lineTo(x - r * 0.55 * wide + sw * 0.3, y + r * 1.25 + sw); c.moveTo(x + r * 0.72 * wide, y + r * 0.1); c.lineTo(x + r * 0.55 * wide - sw * 0.3, y + r * 1.25 - sw); c.stroke();
      }
      c.fillStyle = cloth; c.beginPath(); c.ellipse(x, y, r * wide, r * 0.68, 0, 0, 7); c.fill();
      if (!fl) { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x + r * 0.3, y - r * 0.15, r * 0.35, r * 0.2, 0.6, 0, 7); c.fill(); }   // 찢어진 옷
      if (z.k === 'spitter') {
        const glow = z.held && z.cd < 0.4 ? 1 : 0.55;
        c.fillStyle = fl ? '#fff' : `rgba(200,255,90,${glow})`;
        c.beginPath(); c.arc(x - r * 0.45, y - r * 0.35, r * 0.32, 0, 7); c.arc(x + r * 0.45, y - r * 0.35, r * 0.32, 0, 7); c.fill();
      }
      if (z.k === 'brute') { c.fillStyle = fl ? '#fff' : '#5a5f6a'; c.fillRect(x - r * 0.9, y + r * 0.15, r * 1.8, r * 0.16); }
      const hr = z.k === 'brute' ? 0.44 : 0.56;
      c.fillStyle = skin; c.beginPath(); c.arc(x, y + r * 0.12, r * hr, 0, 7); c.fill();
      c.fillStyle = fl ? '#ddd' : L.hair; c.beginPath(); c.arc(x, y + r * 0.04, r * hr * 0.98, Math.PI * 1.05, Math.PI * 1.95); c.fill();
      if (z.k === 'screamer') {
        c.strokeStyle = fl ? '#fff' : L.hair; c.lineWidth = 1.5;
        c.beginPath(); for (let i = -3; i <= 3; i++) { c.moveTo(x + i * 2.4, y - r * 0.3); c.lineTo(x + i * 3.4 + sw * 0.4, y - r * 1.3); } c.stroke();
        if (z.held && z.cd > 3.6) { c.fillStyle = '#1b0f22'; c.beginPath(); c.ellipse(x, y + r * 0.42, r * 0.22, r * 0.28, 0, 0, 7); c.fill(); }
      }
      const eye = z.k === 'runner' && z.wind > 0 ? '#ff1f1f' : '#ff3b30';
      c.fillStyle = eye; c.beginPath(); c.arc(x - r * 0.18, y + r * 0.38, r * 0.085, 0, 7); c.arc(x + r * 0.18, y + r * 0.38, r * 0.085, 0, 7); c.fill();
    }
    if (z.k === 'shield' && z.sh > 0) {
      const k = z.sh / z.shMax;
      c.fillStyle = fl ? '#fff' : '#a9b4c3'; c.beginPath(); c.roundRect(x - r * 1.2, y + r * 0.7, r * 2.4, r * 0.62, 4); c.fill();
      c.strokeStyle = '#5d6878'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(40,60,90,.45)'; c.fillRect(x - r * 0.7, y + r * 0.82, r * 1.4, r * 0.18);
      if (k < 0.5) { c.strokeStyle = 'rgba(30,30,30,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r * 0.4, y + r * 0.72); c.lineTo(x - r * 0.1, y + r * 1.0); c.lineTo(x - r * 0.3, y + r * 1.3); c.stroke(); }
    }
    if (z.k === 'runner' && z.wind > 0 && !z.lock) {
      c.strokeStyle = 'rgba(255,60,60,.6)'; c.lineWidth = 2; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(x, y); c.lineTo(g.x, ZCore.SQ_Y); c.stroke(); c.setLineDash([]);
    }
    if (z.zap > 0) { c.strokeStyle = 'rgba(150,240,255,.9)'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y + 2, r * 1.05, 0, 7); c.stroke(); }
    if (z.burn > 0) { c.fillStyle = 'rgba(255,120,40,.22)'; c.beginPath(); c.arc(x, y + 2, r * 1.1, 0, 7); c.fill(); }
    if (frz) { c.fillStyle = 'rgba(190,240,255,.6)'; c.beginPath(); c.arc(x, y + 2, r * 1.15, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.stroke(); }
    else if (z.slow > 0) { c.strokeStyle = 'rgba(140,220,255,.75)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y + 2, r * 1.15, 0, 7); c.stroke(); }
    const big = z.k !== 'walker' && z.k !== 'runner';
    if (big && (z.hp < z.max || (z.shMax && z.sh < z.shMax))) {
      const w = Math.max(22, r * 2);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - w / 2, y - r - 10, w, 4);
      c.fillStyle = '#e74c3c'; c.fillRect(x - w / 2, y - r - 10, w * Math.max(0, z.hp / z.max), 4);
      if (z.shMax) { c.fillStyle = '#b8c4d4'; c.fillRect(x - w / 2, y - r - 15, w * Math.max(0, z.sh / z.shMax), 3); }
    }
  },
  drawBoss(c, b, T) {
    const r = ZCore.BOSS_R, fl = b.flash > 0;
    let x = b.x, y = b.y;
    if (b.st === 'tele') { x += Math.sin(T * 70) * 3; }
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x + 4, y + r * 0.9, r * 1.3, r * 0.5, 0, 0, 7); c.fill();
    if (b.st === 'tele' || b.st === 'charge') { const gr = c.createRadialGradient(x, y, r * 0.5, x, y, r * 1.8); gr.addColorStop(0, 'rgba(255,40,40,.35)'); gr.addColorStop(1, 'rgba(255,40,40,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r * 1.8, 0, 7); c.fill(); }
    const sw = Math.sin(T * 4) * 6;
    c.lineCap = 'round';
    if (b.k === 'king') {
      c.strokeStyle = fl ? '#fff' : '#7a2e29'; c.lineWidth = 16;
      c.beginPath(); c.moveTo(x - r * 0.9, y); c.lineTo(x - r * 1.1, y + r * 1.05 + sw); c.moveTo(x + r * 0.9, y); c.lineTo(x + r * 1.1, y + r * 1.05 - sw); c.stroke();
      c.fillStyle = fl ? '#fff' : '#e8dcc0'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * r * 1.1, y + r * 1.1 + (s < 0 ? sw : -sw)); c.lineTo(x + s * r * 1.25, y + r * 1.4); c.lineTo(x + s * r * 0.95, y + r * 1.3); c.fill(); }
      c.fillStyle = fl ? '#fff' : '#5e2622'; c.beginPath(); c.ellipse(x, y, r * 1.25, r * 0.78, 0, 0, 7); c.fill();
      c.fillStyle = fl ? '#fff' : '#4a1d1a'; c.beginPath(); c.ellipse(x, y - r * 0.15, r * 0.9, r * 0.45, 0, 0, 7); c.fill();
      c.fillStyle = fl ? '#fff' : '#8a3a33'; c.beginPath(); c.arc(x, y + r * 0.2, r * 0.5, 0, 7); c.fill();
      c.fillStyle = fl ? '#fff' : '#e8dcc0';
      for (let i = 0; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.2); c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.42, y + r * 0.2 + Math.sin(a) * r * 0.42); c.lineTo(x + Math.cos(a) * r * 0.78, y + r * 0.2 + Math.sin(a) * r * 0.78); c.lineTo(x + Math.cos(a + 0.18) * r * 0.45, y + r * 0.2 + Math.sin(a + 0.18) * r * 0.45); c.fill(); }
      c.fillStyle = '#ffde00'; c.beginPath(); c.arc(x - r * 0.18, y + r * 0.42, 4.5, 0, 7); c.arc(x + r * 0.18, y + r * 0.42, 4.5, 0, 7); c.fill();
    } else if (b.k === 'queen') {
      c.strokeStyle = fl ? '#fff' : '#3f6b1f'; c.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const a = Math.PI * (1.05 + i * 0.18); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * r * 1.2 + sw, y + Math.sin(a) * r * 1.1, x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.5 + sw); c.stroke(); }
      c.fillStyle = fl ? '#fff' : '#4e7a2a'; c.beginPath(); c.ellipse(x, y, r * 1.15, r * 0.95, 0, 0, 7); c.fill();
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + 0.3, sx = x + Math.cos(a) * r * 0.68, sy = y + Math.sin(a) * r * 0.55, glow = 0.6 + 0.4 * Math.sin(T * 5 + i);
        c.fillStyle = fl ? '#fff' : `rgba(210,255,90,${glow})`; c.beginPath(); c.arc(sx, sy, 6 + (i % 3) * 2, 0, 7); c.fill();
      }
      c.fillStyle = fl ? '#fff' : '#6f9a3a'; c.beginPath(); c.arc(x, y + r * 0.35, r * 0.42, 0, 7); c.fill();
      c.fillStyle = '#ff6bd5'; c.beginPath(); c.arc(x - r * 0.15, y + r * 0.5, 4, 0, 7); c.arc(x + r * 0.15, y + r * 0.5, 4, 0, 7); c.fill();
      c.fillStyle = 'rgba(180,255,80,.8)'; c.beginPath(); c.ellipse(x, y + r * 0.72, 5, 7 + Math.sin(T * 3) * 2, 0, 0, 7); c.fill();
    } else {
      for (let i = 0; i < 4; i++) { const a = T * 1.6 + i * Math.PI / 2, ox = x + Math.cos(a) * r * 1.45, oy = y + Math.sin(a) * r * 0.9; c.fillStyle = 'rgba(160,110,255,.25)'; c.beginPath(); c.arc(ox, oy, 12, 0, 7); c.fill(); c.fillStyle = '#e9e4f5'; c.beginPath(); c.arc(ox, oy, 6, 0, 7); c.fill(); c.fillStyle = '#2b1a3d'; c.fillRect(ox - 3, oy, 2, 2); c.fillRect(ox + 1, oy, 2, 2); }
      c.fillStyle = fl ? '#fff' : '#3b2452';
      c.beginPath(); c.moveTo(x - r * 1.1, y - r * 0.3); c.quadraticCurveTo(x, y - r * 1.0, x + r * 1.1, y - r * 0.3); c.lineTo(x + r * 0.8, y + r * 0.9); c.quadraticCurveTo(x, y + r * 1.15, x - r * 0.8, y + r * 0.9); c.closePath(); c.fill();
      c.strokeStyle = fl ? '#fff' : '#5a3a7a'; c.lineWidth = 2; c.stroke();
      c.fillStyle = fl ? '#fff' : '#22142f'; c.beginPath(); c.arc(x, y + r * 0.12, r * 0.48, 0, 7); c.fill();
      c.fillStyle = '#5ce1ff'; c.beginPath(); c.arc(x - r * 0.16, y + r * 0.25, 4, 0, 7); c.arc(x + r * 0.16, y + r * 0.25, 4, 0, 7); c.fill();
      c.strokeStyle = `rgba(150,100,255,${0.3 + 0.2 * Math.sin(T * 3)})`; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r * 1.25, 0, 7); c.stroke();
    }
    if (b.slow > 0) { c.strokeStyle = 'rgba(140,220,255,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r * 1.3, 0, 7); c.stroke(); }
  },
  drawShots(c, g, T) {
    const W = ZCore.WEAPONS, Y = ZCore.SQ_Y;
    if (g.beam) {
      const b = g.beam, flick = 0.85 + Math.random() * 0.15;
      const gr = c.createLinearGradient(b.x - b.w, 0, b.x + b.w, 0);
      gr.addColorStop(0, 'rgba(92,225,255,0)'); gr.addColorStop(0.5, `rgba(92,225,255,${0.55 * flick})`); gr.addColorStop(1, 'rgba(92,225,255,0)');
      c.fillStyle = gr; c.fillRect(b.x - b.w, -10, b.w * 2, Y - 10);
      c.fillStyle = `rgba(230,252,255,${0.9 * flick})`; c.fillRect(b.x - b.w * 0.18, -10, b.w * 0.36, Y - 10);
      c.fillStyle = 'rgba(200,250,255,.9)'; c.beginPath(); c.arc(b.x, Y - 22, b.w * 0.5, 0, 7); c.fill();
    }
    c.lineCap = 'round';
    for (const s of g.shots) {
      if (s.k === 'b') { c.strokeStyle = g.wpn && g.wpn.id === 'mg' ? '#ffc06a' : '#ffe7a3'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 0.013, s.y - s.vy * 0.013); c.stroke(); }
      else if (s.k === 'p') { c.strokeStyle = '#ff9a5c'; c.lineWidth = 3; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 0.01, s.y - s.vy * 0.01); c.stroke(); }
      else if (s.k === 'ice') { c.fillStyle = 'rgba(160,235,255,.35)'; c.beginPath(); c.arc(s.x, s.y, 7, 0, 7); c.fill(); c.fillStyle = '#e6fbff'; c.beginPath(); c.moveTo(s.x, s.y - 7); c.lineTo(s.x + 3.5, s.y); c.lineTo(s.x, s.y + 6); c.lineTo(s.x - 3.5, s.y); c.fill(); }
      else if (s.k === 'rk') {
        const a = Math.atan2(s.vy, s.vx);
        c.save(); c.translate(s.x, s.y); c.rotate(a);
        c.fillStyle = `rgba(255,${150 + Math.random() * 80},60,.9)`; c.beginPath(); c.moveTo(-6, -3); c.lineTo(-14 - Math.random() * 6, 0); c.lineTo(-6, 3); c.fill();
        c.fillStyle = '#d8dde4'; c.beginPath(); c.roundRect(-7, -3, 14, 6, 3); c.fill(); c.fillStyle = W.rk.col; c.fillRect(4, -3, 3, 6);
        c.restore();
      }
    }
    for (const b of g.bolts) {
      c.strokeStyle = `rgba(200,170,255,${b.t / 0.14})`; c.lineWidth = 3; c.beginPath();
      b.pts.forEach(([x, y], i) => { if (!i) { c.moveTo(x, y); return; } const [px, py] = b.pts[i - 1]; for (let k = 1; k <= 3; k++) c.lineTo(px + (x - px) * k / 4 + (Math.random() - 0.5) * 14, py + (y - py) * k / 4 + (Math.random() - 0.5) * 14); c.lineTo(x, y); });
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.2; c.stroke();
    }
  },
  drawSquad(c, g, T) {
    const n = Math.min(g.n, 90), cx = g.x, cy = ZCore.SQ_Y, W = ZCore.WEAPONS, wid = g.wpn ? g.wpn.id : 'rifle';
    if (this.order === undefined || this.orderN !== n) {
      this.orderN = n;
      this.order = Array.from({ length: n }, (_, i) => { const rr = 5.4 * Math.sqrt(i + 0.5), a = i * 2.39996; return [Math.cos(a) * rr, Math.sin(a) * rr * 0.78, i]; }).sort((a, b) => a[1] - b[1]);
    }
    const flash = !this.over && (g.phase === 'run' || g.phase === 'boss') && (Math.floor(T * 30) % 2 === 0);
    const gunCol = W[wid].col;
    for (const [ox, oy, i] of this.order) {
      const x = cx + ox, y = cy + oy + Math.sin(T * 10 + i) * 0.6;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 1.5, y + 4.5, 5.5, 2.6, 0, 0, 7); c.fill();
      c.fillStyle = '#4f5e3c'; c.beginPath(); c.ellipse(x, y + 1, 5.8, 4.4, 0, 0, 7); c.fill();
      c.fillStyle = '#39442b'; c.fillRect(x - 3.2, y + 2.2, 6.4, 2.6);
      c.strokeStyle = '#1b1b1b'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 2.6, y - 0.5); c.lineTo(x + 2.6, y - 10.5); c.stroke();
      if (wid !== 'rifle') { c.fillStyle = gunCol; c.fillRect(x + 1.6, y - 6, 2, 3); }
      c.fillStyle = '#5d6b46'; c.beginPath(); c.arc(x, y - 0.6, 4.1, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x - 1.2, y - 1.8, 1.6, 0, 7); c.fill();
      if (flash && (i + Math.floor(T * 30)) % 4 === 0 && wid !== 'lz' && wid !== 'fl') { c.fillStyle = wid === 'cr' ? '#c8f4ff' : '#ffd36b'; c.beginPath(); c.arc(x + 2.6, y - 12, 2.2, 0, 7); c.fill(); }
    }
    const R = ZCore.radius(g);
    c.font = '22px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(g.n, cx, cy + R + 14); c.fillStyle = g.n >= g.cap ? '#7dffb0' : '#fff'; c.fillText(g.n, cx, cy + R + 14);
  },
  drawParts(c) {
    for (const p of this.parts) {
      const k = Math.max(0, p.t / p.T);
      if (p.k === 'ring') { c.strokeStyle = p.c; c.globalAlpha = k; c.lineWidth = 3 + 5 * k; c.beginPath(); c.arc(p.x, p.y, p.s * (1 - k * 0.7), 0, 7); c.stroke(); continue; }
      if (p.k === 'smoke') { c.globalAlpha = 0.35 * k; c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); continue; }
      if (p.k === 'flame' || p.k === 'fire') {                       // 불은 더해서 그려야 빛나 보여요
        c.globalCompositeOperation = k > 0.2 ? 'lighter' : 'source-over';
        if (p.k === 'flame') { c.globalAlpha = Math.min(0.85, k * 1.3); c.fillStyle = k > 0.75 ? '#ffd56a' : k > 0.45 ? '#ff8a2c' : k > 0.2 ? '#d9441f' : 'rgba(70,55,50,.7)'; }
        else { c.globalAlpha = k; c.fillStyle = k > 0.55 ? '#ffd88a' : p.c; }
        c.beginPath(); c.arc(p.x, p.y, p.k === 'fire' ? p.s * (0.5 + k * 0.5) : p.s, 0, 7); c.fill();
        c.globalCompositeOperation = 'source-over';
        continue;
      }
      c.globalAlpha = Math.min(1, k * 1.6); c.fillStyle = p.c;
      if (p.k === 'chip') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot + p.t * 10); c.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); c.restore(); }
      else if (p.k === 'spark') { c.fillRect(p.x - 1, p.y - 1, 2.5, 2.5); }
      else { c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
  },
  drawHud(c, g, T) {
    const W = ZW.W, Z = ZCore;
    c.textBaseline = 'middle';
    // 위: 진행 막대 · 보스 체력
    if (g.boss && g.boss.st !== undefined) {
      const b = g.boss;
      c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.roundRect(40, 10, W - 80, 16, 8); c.fill();
      c.fillStyle = '#e0453a'; c.beginPath(); c.roundRect(40, 10, (W - 80) * Math.max(0, b.hp / b.max), 16, 8); c.fill();
      c.fillStyle = '#fff'; c.font = '12px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText(`${ZW_BOSS_NAME(b.k)}${g.bossT > 40 ? ' · 분노!' : ''}`, W / 2, 18.5);
    } else if (g.phase === 'run') {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.roundRect(44, 12, W - 88, 8, 4); c.fill();
      c.fillStyle = '#e9b949'; c.beginPath(); c.roundRect(44, 12, (W - 88) * Math.min(1, g.dist / g.length), 8, 4); c.fill();
      c.fillStyle = '#ff4d5e'; c.beginPath(); c.arc(W - 44, 16, 7, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(W - 46.5, 13, 2, 2); c.fillRect(W - 43, 13, 2, 2);
    }
    // 왼쪽 위: 최고 기록
    c.textAlign = 'left'; c.font = '12px "Noto Sans KR", sans-serif';
    const bestTxt = this.rec ? '신기록 갱신 중!' : this.best ? `최고 ${zfmt(this.best)}` : '첫 기록 도전!';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(bestTxt, 46, 38); c.fillStyle = this.rec ? '#ffd23f' : 'rgba(255,255,255,.8)'; c.fillText(bestTxt, 46, 38);
    // 오른쪽 위: 콤보
    if (g.combo >= 2) {
      const k = Math.max(0, 1 - (g.t - g.lastKill) / Z.comboWin(g)), m = Z.mult(g);
      c.textAlign = 'right'; c.font = '20px "Black Han Sans", sans-serif';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(`콤보 ${g.combo}`, W - 46, 44); c.fillStyle = m >= 4 ? '#ff6b9a' : m >= 2.5 ? '#ffb347' : '#ffe08a'; c.fillText(`콤보 ${g.combo}`, W - 46, 44);
      c.font = '14px "Black Han Sans", sans-serif'; c.strokeText(`×${m.toFixed(1)}`, W - 46, 64); c.fillText(`×${m.toFixed(1)}`, W - 46, 64);
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(W - 126, 74, 80, 4); c.fillStyle = '#ffe08a'; c.fillRect(W - 126, 74, 80 * k, 4);
    }
    // 왼쪽 아래: 무기
    const w = g.wpn, info = Z.WEAPONS[w ? w.id : 'rifle'];
    c.fillStyle = 'rgba(12,16,24,.72)'; c.beginPath(); c.roundRect(10, ZW.H - 62, 156, 50, 12); c.fill();
    c.fillStyle = info.col; c.beginPath(); c.arc(36, ZW.H - 37, 16, 0, 7); c.fill();
    c.fillStyle = '#16181d'; c.font = '16px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.fillText(info.ch, 36, ZW.H - 36);
    c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = '15px "Black Han Sans", sans-serif'; c.fillText(info.name + (w ? ` Lv.${w.lv}` : ''), 58, ZW.H - 46);
    if (w) {
      const k = Math.max(0, w.ammo / w.max);
      c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(58, ZW.H - 31, 98, 6);
      c.fillStyle = k < 0.25 && Math.sin(T * 16) > 0 ? '#ff5d73' : info.col; c.fillRect(58, ZW.H - 31, 98 * k, 6);
    } else { c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '11px "Noto Sans KR", sans-serif'; c.fillText('탄약 무한 · 상자를 노려요', 58, ZW.H - 27); }
    if (g.gold > 0) { c.fillStyle = '#ffd23f'; c.font = '14px "Black Han Sans", sans-serif'; c.textAlign = 'left'; c.fillText(`점수 ×2 · ${Math.ceil(g.gold)}초`, 14, ZW.H - 76); }
    // 오른쪽 아래: 수류탄 버튼
    const N = ZW.NADE, ok = g.nades > 0 && g.nadeCd <= 0 && (g.phase === 'run' || g.phase === 'boss');
    c.fillStyle = ok ? 'rgba(255,210,90,.92)' : 'rgba(60,64,72,.75)'; c.beginPath(); c.arc(N.x, N.y, N.r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
    this.nadeIcon(c, N.x, N.y + 2, 11);
    c.fillStyle = '#16181d'; c.beginPath(); c.arc(N.x + 20, N.y - 20, 11, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = '13px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.fillText(g.nades, N.x + 20, N.y - 19);
    // 가운데: 알림 글자
    const bn = this.banner;
    if (bn) {
      const a = Math.min(1, bn.t * 3, (bn.T - bn.t) * 6 + 0.2), y = bn.small ? ZW.H * 0.44 : ZW.H * 0.34;
      c.globalAlpha = a; c.textAlign = 'center';
      c.font = `${bn.small ? 34 : 50}px "Black Han Sans", sans-serif`; c.lineWidth = 7; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(bn.txt, W / 2, y); c.fillStyle = bn.col; c.fillText(bn.txt, W / 2, y);
      if (bn.sub) { c.font = '15px "Noto Sans KR", sans-serif'; c.lineWidth = 4; c.strokeText(bn.sub, W / 2, y + (bn.small ? 30 : 40)); c.fillStyle = '#fff'; c.fillText(bn.sub, W / 2, y + (bn.small ? 30 : 40)); }
      c.globalAlpha = 1;
    }
    const tp = this.tip;
    if (tp) {
      const a = Math.min(1, tp.t * 2, (tp.T - tp.t) * 5);
      c.globalAlpha = a; c.fillStyle = 'rgba(14,16,22,.82)'; c.beginPath(); c.roundRect(40, 92, W - 80, 52, 12); c.fill();
      c.strokeStyle = 'rgba(255,93,115,.7)'; c.lineWidth = 2; c.stroke();
      c.textAlign = 'center'; c.fillStyle = '#ff8a9a'; c.font = '16px "Black Han Sans", sans-serif'; c.fillText('⚠ ' + tp.txt, W / 2, 110);
      c.fillStyle = '#e8ecf3'; c.font = '12px "Noto Sans KR", sans-serif'; c.fillText(tp.sub, W / 2, 131);
      c.globalAlpha = 1;
    }
  },

  /* ───────── 강화 고르기 ───────── */
  showPerk() {
    const g = this.g, box = $('#zw-perk');
    if (!g.offer) return;
    box.innerHTML = `<div class="zw-pk-box"><h3>STAGE ${g.stage} 클리어!</h3><p>강화를 하나 골라요 <small>(1 · 2 · 3)</small></p>
      <div class="zw-pk-list">${g.offer.map((id, i) => { const p = ZCore.PERK[id], lv = g.pk[id] || 0;
        return `<button class="zw-pk" data-act="zwPerk" data-id="${id}"><i>${p.ic}</i><b>${esc(p.name)}</b><small>${esc(p.d)}</small>${p.max < 99 ? `<em>${'●'.repeat(lv)}${'○'.repeat(p.max - lv)}</em>` : '<em>언제든</em>'}<kbd>${i + 1}</kbd></button>`; }).join('')}</div>
      <p class="zw-pk-st">병력 ${g.n}/${g.cap} · 수류탄 ${g.nades} · ${g.wpn ? ZCore.WEAPONS[g.wpn.id].name + ' Lv.' + g.wpn.lv : '소총'}</p></div>`;
    box.hidden = false;
  },
  hidePerk() { const box = $('#zw-perk'); if (box) { box.hidden = true; box.innerHTML = ''; } },
  choose(id) {
    if (this.over || !this.g || this.g.phase !== 'perk') return;
    if (ZCore.pick(this.g, id)) { this.hidePerk(); Sound.play('pop'); this.events(); this.setTheme(); this.hud(); }
  },
  nade() { if (!this.over && this.g) this.inp.nade = true; },

  gameOver() {
    if (this.over) return;
    this.over = true;
    const g = this.g, best = Math.max(this.best, g.score);
    store.set('zw-best', best);
    this.say('전멸', `점수 ${zfmt(g.score)}`, '#ff5d73', 3);
    after(1100, () => showResult({
      title: '🧟 부대가 전멸했어요!', win: false,
      subtitle: `점수 ${zfmt(g.score)} · 스테이지 ${g.stage} · 처치 ${zfmt(g.kills)} · 최고 콤보 ${g.bestCombo}${g.score > this.best ? ' · 🎉 신기록!' : ` · 최고 ${zfmt(best)}`}`,
      solo: 'zombie', rec: { v: g.score },
    }));
  },
};

(() => {
  const cv = $('#zw-cv');
  const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * ZW.W / r.width, y: (e.clientY - r.top) * ZW.H / r.height }; };
  const onNade = p => { const N = ZW.NADE; return (p.x - N.x) ** 2 + (p.y - N.y) ** 2 < (N.r + 12) ** 2; };
  // 마우스: 판 위에서 움직이면 따라가요 · 수류탄 버튼 누르기
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !Zombie.over) Zombie.target = pt(e).x; });
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && onNade(pt(e))) Zombie.nade(); });
  // 터치: 화면 어디서든 끌면 (판 밖 빈 곳 포함) 손가락이 움직인 만큼 부대가 움직여요
  TouchArea.add('zombie', {
    down(e) { const p = pt(e); if (onNade(p)) { Zombie.nade(); Zombie.drag = null; return; } Zombie.drag = { fx: p.x, gx: Zombie.g ? Zombie.g.x : ZW.W / 2 }; },
    move(e) { const d = Zombie.drag; if (!d) return; Zombie.target = d.gx + (pt(e).x - d.fx) * 1.25; },
    up() { Zombie.drag = null; },
    cancel() { Zombie.drag = null; },
  });
})();
Object.assign(ACT, { zwPerk: el => Zombie.choose(el.dataset.id) });
register('zombie', {
  solo: () => Zombie.start(),
  stop: () => { Zombie.over = true; Zombie.hidePerk(); },
  key: e => {
    if ((e.code === 'Space' || e.code === 'KeyG') && !e.repeat) { if (e.preventDefault) e.preventDefault(); Zombie.nade(); }
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (n !== undefined && Zombie.g && Zombie.g.phase === 'perk' && Zombie.g.offer) Zombie.choose(Zombie.g.offer[n]);
  },
});
window.addEventListener('resize', () => { if (isScreen('zombie') && Zombie.ctx && Math.min(2, Math.max(1, Math.round((window.devicePixelRatio || 1) * 2) / 2)) !== Zombie.Q) { Zombie.setupCanvas(); Zombie.setTheme(); } });
