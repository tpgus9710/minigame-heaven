/* =====================================================================
 *  🚀 우주 슈팅 — 무기 3종(발칸·레이저·유도 미사일) × 5단계, 보조 드론, 실드·폭탄 아이템, 5웨이브마다 보스
 *  v13.7: 캡슐을 글자 한 자(P · V · L · M …) 대신 모양 · 그림 · 이름표로 — 무기는 육각형, 파워는 동그라미 별빛,
 *         실드는 방패, 폭탄은 둥근 폭탄, 드론은 마름모. 캡슐 아래에 「발칸 · 레이저 · 미사일 · 파워 · 실드 · 폭탄 · 드론」 이름표
 * ===================================================================== */
const SH = { W: 480, H: 640 };
const SH_WEAPON = {
  V: { name: '발칸', color: '#ffd23f', desc: '넓게 퍼지는 연사' },
  L: { name: '레이저', color: '#5ce1ff', desc: '적을 꿰뚫는 광선' },
  M: { name: '유도 미사일', color: '#ff6b5b', desc: '알아서 쫓아가는 미사일' },
};
/** 캡슐: 이름 · 색 · 모양 (무기 V · L · M 는 육각형) */
const SH_ITEM = {
  P: { name: '파워', color: '#fff6c8', shape: 'circle' }, V: { name: '발칸', color: '#ffd23f', shape: 'hex' },
  L: { name: '레이저', color: '#5ce1ff', shape: 'hex' }, M: { name: '미사일', color: '#ff6b5b', shape: 'hex' },
  S: { name: '실드', color: '#3fe0a0', shape: 'shield' }, B: { name: '폭탄', color: '#ff9f43', shape: 'bomb' }, D: { name: '드론', color: '#c39bff', shape: 'diamond' },
};
makeScreen('shooter', {
  title: '🚀 우주 슈팅', status: '마우스(터치)·방향키로 이동, 총은 자동 발사! 캡슐 이름표를 보고 먹어요: 파워 · 발칸 · 레이저 · 미사일 · 드론 · 실드 · 폭탄 (폭탄은 B·X 키)',
  stats: [['score', '점수'], ['wave', '웨이브'], ['life', '목숨']],
  body: `<div class="center col"><canvas id="sh-cv" class="game-cv" width="${SH.W}" height="${SH.H}"></canvas><button class="btn sm ghost" data-act="shBomb" style="margin-top:8px">💣 폭탄 쓰기 (B)</button></div>`,
});

const Shooter = {
  start() {
    stopLocal();
    S.solo = 'shooter';
    Object.assign(this, { p: { x: SH.W / 2, y: SH.H - 90 }, target: null, shots: [], missiles: [], enemies: [], ebul: [], items: [], fx: [], parts: [],
      score: 0, lives: 3, bombs: 2, weapon: 'V', power: 1, drones: 0, shield: false, inv: 2, fireT: 0, mslT: 0, droneT: 0,
      wave: 0, waveT: 1.5, spawnQ: [], spawnClock: 0, carrierT: 14, over: false, boss: null, flashT: 0, t: 0 });
    this.stars = [0, 1, 2].flatMap(layer => Array.from({ length: 40 }, () => ({ x: Math.random() * SH.W, y: Math.random() * SH.H, s: 20 + layer * 45 + Math.random() * 20, z: layer })));
    this.nebula = Array.from({ length: 3 }, (_, i) => ({ x: Math.random() * SH.W, y: i * 260, r: 160 + Math.random() * 120, h: [260, 200, 320][i] }));
    show('shooter'); this.hud();
    gameLoop(dt => { this.t += dt; if (!this.over) this.update(dt); this.draw(); });
  },
  hud() { setStat('shooter', 'score', this.score.toLocaleString()); setStat('shooter', 'wave', this.wave); setStat('shooter', 'life', '❤'.repeat(Math.max(0, this.lives)) + (this.bombs ? ` 💣${this.bombs}` : '')); },

  nextWave() {
    this.wave++; this.hud();
    const w = this.wave;
    if (w % 5 === 0) {
      const hp = 220 + w * 55;
      this.boss = { t: 'boss', x: SH.W / 2, y: -90, hp, max: hp, r: 52, ph: 0, fire: 1.4, age: 0 };
      this.enemies.push(this.boss); this.banner = { txt: 'WARNING · BOSS', t: 1.8 };
      return;
    }
    const n = 7 + w * 2;
    for (let i = 0; i < n; i++) {
      const r = Math.random(), type = w >= 3 && r < 0.16 ? 'tank' : w >= 2 && r < 0.38 ? 'gunship' : r < 0.68 ? 'zig' : 'grunt';
      this.spawnQ.push({ at: i * Math.max(0.22, 0.6 - w * 0.03), type });
    }
    this.spawnClock = 0;
  },
  spawn(type) {
    const x = 30 + Math.random() * (SH.W - 60), w = this.wave;
    const base = { grunt: { hp: 2, r: 14, vy: 130 }, zig: { hp: 3, r: 15, vy: 105 }, gunship: { hp: 5, r: 17, vy: 85 }, tank: { hp: 16, r: 26, vy: 45 }, carrier: { hp: 8, r: 20, vy: 0 } }[type];
    const hp = base.hp + Math.floor(w / 2);
    const e = { t: type, x, x0: x, y: -30, ...base, hp, max: hp, age: 0, fire: 1 + Math.random() };
    if (type === 'carrier') Object.assign(e, { y: 80 + Math.random() * 80, x: -30, vx: 110, hp: 8 + w, max: 8 + w });
    this.enemies.push(e);
  },
  /** 무기별 발사 */
  fire(dt) {
    const p = this.p, lv = this.power;
    if (this.weapon === 'V') {
      if ((this.fireT -= dt) > 0) return; this.fireT = 0.11;
      const pat = [[[0, 0]], [[-7, 0], [7, 0]], [[-12, -0.12], [0, 0], [12, 0.12]], [[-16, -0.24], [-8, -0.1], [0, 0], [8, 0.1], [16, 0.24]], [[-18, -0.3], [-9, -0.14], [0, 0], [9, 0.14], [18, 0.3], [-20, -0.6], [20, 0.6]]][lv - 1];
      for (const [dx, a] of pat) this.shots.push({ x: p.x + dx, y: p.y - 18, vx: Math.sin(a) * 640, vy: -Math.cos(a) * 640, dmg: 1, k: 'V', pierce: 0 });
    } else if (this.weapon === 'L') {
      if ((this.fireT -= dt) > 0) return; this.fireT = 0.075;
      const lanes = lv >= 5 ? [-14, 0, 14] : lv >= 3 ? [-6, 6] : [0];
      for (const dx of lanes) this.shots.push({ x: p.x + dx, y: p.y - 22, vx: 0, vy: -900, dmg: 0.7, k: 'L', pierce: lv, hitSet: new Set() });
    } else {
      if ((this.fireT -= dt) <= 0) { this.fireT = 0.16; this.shots.push({ x: p.x, y: p.y - 18, vx: 0, vy: -620, dmg: 0.6, k: 'V', pierce: 0 }); }
      if ((this.mslT -= dt) <= 0) {
        this.mslT = 0.45;
        const n = [1, 2, 2, 3, 4][lv - 1];
        for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, a = -Math.PI / 2 + side * (0.5 + i * 0.15); this.missiles.push({ x: p.x + side * 10, y: p.y, a, sp: 380, dmg: 3, life: 3 }); }
      }
    }
    if (this.drones && (this.droneT -= dt) <= 0) {                                  // 보조 드론
      this.droneT = this.weapon === 'L' ? 0.12 : 0.2;
      for (const d of this.dronePos()) {
        if (this.weapon === 'M') this.missiles.push({ x: d.x, y: d.y, a: -Math.PI / 2, sp: 360, dmg: 2, life: 2.5 });
        else this.shots.push({ x: d.x, y: d.y - 8, vx: 0, vy: this.weapon === 'L' ? -900 : -620, dmg: this.weapon === 'L' ? 0.5 : 0.8, k: this.weapon, pierce: this.weapon === 'L' ? 2 : 0, hitSet: new Set() });
      }
    }
  },
  dronePos() { return [-1, 1].slice(0, this.drones).map(s => ({ x: this.p.x + s * 38, y: this.p.y + 14 + Math.sin(this.t * 4 + s) * 4 })); },
  aimed(e, n, spread, speed) {
    const a = Math.atan2(this.p.y - e.y, this.p.x - e.x);
    for (let i = 0; i < n; i++) { const b = a + (i - (n - 1) / 2) * spread; this.ebul.push({ x: e.x, y: e.y, vx: Math.cos(b) * speed, vy: Math.sin(b) * speed }); }
  },
  update(dt) {
    const p = this.p;
    for (const s of this.stars) { s.y += s.s * dt; if (s.y > SH.H) { s.y = 0; s.x = Math.random() * SH.W; } }
    for (const n of this.nebula) { n.y += 12 * dt; if (n.y - n.r > SH.H) { n.y = -n.r; n.x = Math.random() * SH.W; } }
    const dx = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0), dy = (held('ArrowDown', 'KeyS') ? 1 : 0) - (held('ArrowUp', 'KeyW') ? 1 : 0);
    if (dx || dy) { p.x += dx * 320 * dt; p.y += dy * 320 * dt; }
    else if (this.target) { p.x += (this.target.x - p.x) * Math.min(1, dt * 12); p.y += (this.target.y - 40 - p.y) * Math.min(1, dt * 12); }
    p.x = clamp(p.x, 18, SH.W - 18); p.y = clamp(p.y, 70, SH.H - 24);
    this.inv -= dt; this.flashT -= dt;
    this.fire(dt);
    if (!this.spawnQ.length && !this.enemies.some(e => e.t !== 'carrier')) { if ((this.waveT -= dt) <= 0) { this.waveT = 1.4; this.nextWave(); } }
    if (this.spawnQ.length) { this.spawnClock += dt; while (this.spawnQ.length && this.spawnQ[0].at <= this.spawnClock) this.spawn(this.spawnQ.shift().type); }
    if ((this.carrierT -= dt) <= 0 && !this.boss) { this.carrierT = 18; this.spawn('carrier'); }
    for (const e of this.enemies) {
      e.age += dt;
      if (e.t === 'boss') { this.bossAI(e, dt); continue; }
      if (e.t === 'carrier') { e.x += e.vx * dt; e.y += Math.sin(e.age * 3) * 30 * dt; if (e.x > SH.W + 40) e.dead = true; continue; }
      e.y += e.vy * dt;
      if (e.t === 'zig') e.x = e.x0 + Math.sin(e.age * 3) * 60;
      if (e.t === 'gunship') { if (e.y > 150) e.y = 150 + Math.sin(e.age) * 6; if ((e.fire -= dt) <= 0) { e.fire = 1.5; this.aimed(e, this.wave >= 6 ? 2 : 1, 0.2, 230); } if (e.age > 9) { e.vy = 150; e.t = 'grunt'; } }
      if (e.t === 'tank' && (e.fire -= dt) <= 0) { e.fire = 2; this.aimed(e, 3, 0.25, 190); }
      if (e.y > SH.H + 40) e.dead = true;
    }
    for (const s of this.shots) { s.x += s.vx * dt; s.y += s.vy * dt; }
    for (const m of this.missiles) {                                                  // 유도 미사일: 가장 가까운 적 쪽으로 회전
      m.life -= dt;
      let best = null, bd = 1e9;
      for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; best = e; } }
      if (best) { const want = Math.atan2(best.y - m.y, best.x - m.x); let da = ((want - m.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; m.a += clamp(da, -4.5 * dt, 4.5 * dt); }
      m.sp = Math.min(560, m.sp + 300 * dt);
      m.x += Math.cos(m.a) * m.sp * dt; m.y += Math.sin(m.a) * m.sp * dt;
      if (Math.random() < 0.6) this.parts.push({ x: m.x, y: m.y, vx: 0, vy: 0, t: 0.25, c: 'rgba(255,170,90,.6)', s: 2 });
    }
    for (const b of this.ebul) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const it of this.items) { it.y += 85 * dt; it.x += Math.sin(this.t * 2 + it.ph) * 20 * dt; }
    // 명중
    for (const s of this.shots) for (const e of this.enemies) {
      if (s.hit || e.dead || Math.hypot(s.x - e.x, s.y - e.y) > e.r + 5) continue;
      if (s.k === 'L') { if (s.hitSet.has(e)) continue; s.hitSet.add(e); if (--s.pierce < 0) s.hit = true; } else s.hit = true;
      this.damage(e, s.dmg, s.x, s.y);
    }
    for (const m of this.missiles) for (const e of this.enemies) {
      if (m.hit || e.dead || Math.hypot(m.x - e.x, m.y - e.y) > e.r + 6) continue;
      m.hit = true; this.damage(e, m.dmg, m.x, m.y); this.boom(m.x, m.y, 10, '#ffb347');
    }
    if (this.inv <= 0) {
      const hitBy = this.ebul.find(b => Math.hypot(b.x - p.x, b.y - p.y) < 7) || this.enemies.find(e => !e.dead && e.t !== 'carrier' && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 8);
      if (hitBy) { if (hitBy.vx !== undefined && hitBy.t === undefined) hitBy.dead = true; this.hurt(); }
    }
    for (const it of this.items) if (!it.dead && Math.hypot(it.x - p.x, it.y - p.y) < 24) { it.dead = true; this.pickup(it.k); }
    this.shots = this.shots.filter(s => !s.hit && s.y > -30 && s.x > -30 && s.x < SH.W + 30);
    this.missiles = this.missiles.filter(m => !m.hit && m.life > 0 && m.y > -40 && m.y < SH.H + 40 && m.x > -40 && m.x < SH.W + 40);
    this.ebul = this.ebul.filter(b => !b.dead && b.y < SH.H + 20 && b.y > -40 && b.x > -40 && b.x < SH.W + 40);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.items = this.items.filter(it => !it.dead && it.y < SH.H + 20);
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
    this.parts = this.parts.filter(q => (q.t -= dt) > 0).slice(-500);
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    for (const e of this.enemies) if (e.flash) e.flash -= dt;
    if (this.banner) this.banner.t -= dt;
  },
  bossAI(e, dt) {
    e.y = Math.min(e.y + 60 * dt, 120); e.x = SH.W / 2 + Math.sin(e.age * 0.7) * 140;
    if ((e.fire -= dt) > 0) return;
    e.ph = (e.ph + 1) % 4; e.fire = Math.max(0.55, 1.1 - this.wave * 0.03);
    if (e.ph === 0) for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + e.age; this.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150 }); }
    else if (e.ph === 1) this.aimed(e, 5, 0.16, 240);
    else if (e.ph === 2) for (let i = 0; i < 8; i++) this.ebul.push({ x: e.x - 70 + i * 20, y: e.y + 34, vx: 0, vy: 210 });
    else for (let i = 0; i < 3; i++) setTimeout(() => { if (!e.dead && !this.over) this.aimed({ x: e.x + (i - 1) * 40, y: e.y + 20 }, 1, 0, 300); }, i * 120);
  },
  damage(e, dmg, x, y) {
    e.hp -= dmg; e.flash = 0.06;
    if (Math.random() < 0.5) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 120, t: 0.2, c: '#fff6c0', s: 2 });
    if (e.hp <= 0) this.kill(e);
  },
  boom(x, y, r, col) {
    for (let i = 0; i < r * 1.6; i++) { const a = Math.random() * 6.28, sp = 60 + Math.random() * r * 18; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.3 + Math.random() * 0.4, c: i % 3 ? col : '#fff', s: 2 + Math.random() * 2 }); }
    this.fx.push({ x, y, t: 0.35, r, ring: true });
  },
  kill(e) {
    if (e.dead) return;
    e.dead = true;
    const pts = { grunt: 10, zig: 15, gunship: 30, tank: 80, carrier: 50, boss: 2000 }[e.t];
    this.score += pts; this.hud();
    this.boom(e.x, e.y, e.r, e.t === 'boss' ? '#ff6b5b' : '#ffb347');
    if (e.t === 'boss') {
      this.boss = null; this.ebul = []; this.banner = { txt: 'BOSS 격파!', t: 1.6 }; this.flashT = 0.3;
      ['P', 'D', 'S'].forEach((k, i) => this.drop(e.x - 34 + i * 34, e.y, k));
    } else if (e.t === 'carrier') this.drop(e.x, e.y, ['V', 'L', 'M', 'D'][rand(4)]);
    else if (Math.random() < 0.08) this.drop(e.x, e.y, Math.random() < 0.55 ? 'P' : ['S', 'B', 'V', 'L', 'M'][rand(5)]);
  },
  drop(x, y, k) { this.items.push({ x, y, k, ph: Math.random() * 6 }); },
  pickup(k) {
    let txt;
    if (k === 'P') { this.power = Math.min(5, this.power + 1); txt = `파워 업! Lv.${this.power}`; }
    else if ('VLM'.includes(k)) { if (this.weapon === k) this.power = Math.min(5, this.power + 1); this.weapon = k; txt = `${SH_WEAPON[k].name} Lv.${this.power}`; }
    else if (k === 'S') { this.shield = true; txt = '실드!'; }
    else if (k === 'B') { this.bombs = Math.min(5, this.bombs + 1); txt = '폭탄 +1'; }
    else if (k === 'D') { if (this.drones < 2) this.drones++; else this.power = Math.min(5, this.power + 1); txt = `드론 ${this.drones}기`; }
    this.fx.push({ x: this.p.x, y: this.p.y - 30, t: 0.9, txt, c: SH_ITEM[k].color }); this.hud();
  },
  hurt() {
    if (this.shield) { this.shield = false; this.inv = 1; return; }
    this.lives--; this.power = Math.max(1, this.power - 1); this.drones = Math.max(0, this.drones - 1); this.inv = 2.2; this.hud();
    this.boom(this.p.x, this.p.y, 26, '#5ce1ff');
    if (this.lives <= 0) {
      this.over = true;
      const best = Math.max(+store.get('best-shooter', 0), this.score); store.set('best-shooter', best);
      after(900, () => showResult({ title: '🚀 격추됐어요!', subtitle: `웨이브 ${this.wave} · 점수 ${this.score.toLocaleString()} · 최고 점수 ${best.toLocaleString()}`, solo: 'shooter', rec: { v: this.score } }));
    }
  },
  bomb() {
    if (this.over || this.bombs <= 0) return;
    this.bombs--; this.hud(); this.flashT = 0.35;
    this.ebul = [];
    for (const e of this.enemies) this.damage(e, e.t === 'boss' ? 40 : 99, e.x, e.y);
  },

  /** 캡슐 하나: 모양(무기 육각형 · 파워 동그라미 · 실드 방패 · 폭탄 · 드론 마름모) + 그림 + 아래 이름표 */
  drawItem(c, k, x, y, s = 1, ph = 0) {
    const I = SH_ITEM[k], col = I.color, t = this.t + ph;
    c.save(); c.translate(x, y); c.scale(s, s);
    c.shadowColor = col; c.shadowBlur = 16;
    c.fillStyle = 'rgba(8,12,28,.92)'; c.strokeStyle = col; c.lineWidth = 2.6; c.lineJoin = 'round';
    this.itemShape(c, I.shape); c.fill(); c.stroke();
    c.shadowBlur = 0;
    this.itemIcon(c, k, col, t);
    c.font = '700 13px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(I.name).width + 12;
    c.fillStyle = 'rgba(5,8,20,.9)'; c.strokeStyle = col; c.lineWidth = 1.2;
    c.beginPath(); c.roundRect(-w / 2, 20, w, 18, 9); c.fill(); c.globalAlpha = 0.6; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = col; c.fillText(I.name, 0, 29.5);
    c.restore();
  },
  itemShape(c, shape) {
    c.beginPath();
    if (shape === 'hex') for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 17.5, Math.sin(a) * 17.5); }
    else if (shape === 'shield') { c.moveTo(0, -17); c.lineTo(14.5, -11); c.lineTo(13.5, 3); c.quadraticCurveTo(10, 12, 0, 17.5); c.quadraticCurveTo(-10, 12, -13.5, 3); c.lineTo(-14.5, -11); }
    else if (shape === 'diamond') { c.moveTo(0, -18.5); c.lineTo(17.5, 0); c.lineTo(0, 18.5); c.lineTo(-17.5, 0); }
    else c.arc(0, 0, 16, 0, Math.PI * 2);
    c.closePath();
  },
  itemIcon(c, k, col, t) {
    c.save();
    if (k === 'P') {                                                                  // 파워: 위로 겹화살표 + 반짝
      c.strokeStyle = col; c.lineWidth = 3.2; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const oy of [-3, 4]) { c.beginPath(); c.moveTo(-7, oy + 3); c.lineTo(0, oy - 4); c.lineTo(7, oy + 3); c.stroke(); }
      c.fillStyle = '#ffd23f'; c.globalAlpha = 0.6 + Math.sin(t * 7) * 0.4; c.beginPath(); c.arc(9, -9, 2.2, 0, 7); c.fill();
    } else if (k === 'V') {                                                           // 발칸: 부채꼴로 퍼지는 총알 3발
      c.fillStyle = col;
      for (const a of [-0.5, 0, 0.5]) { c.save(); c.translate(0, 8); c.rotate(a); c.beginPath(); c.ellipse(0, -11, 2.4, 5.2, 0, 0, 7); c.fill(); c.restore(); }
      c.beginPath(); c.arc(0, 8, 2.6, 0, 7); c.fill();
    } else if (k === 'L') {                                                           // 레이저: 세로 광선
      c.fillStyle = col; c.globalAlpha = 0.3; c.fillRect(-5.5, -12, 11, 24); c.globalAlpha = 1;
      c.fillRect(-2.2, -12, 4.4, 24); c.fillStyle = '#fff'; c.fillRect(-0.7, -12, 1.4, 24);
    } else if (k === 'M') {                                                           // 미사일: 비스듬히 날아가는 미사일 + 연기
      c.fillStyle = 'rgba(255,170,90,.55)'; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(-4 - i * 3.2, 4 + i * 3.2, 1.6 + i * 0.4, 0, 7); c.fill(); }
      c.rotate(Math.PI / 4);
      c.fillStyle = '#ffd6c9'; c.fillRect(-2.6, -7, 5.2, 12);
      c.fillStyle = col; c.beginPath(); c.moveTo(-2.6, -7); c.lineTo(0, -12); c.lineTo(2.6, -7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-2.6, 2); c.lineTo(-5.5, 6.5); c.lineTo(-2.6, 5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(2.6, 2); c.lineTo(5.5, 6.5); c.lineTo(2.6, 5); c.closePath(); c.fill();
      c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-1.8, 5); c.lineTo(0, 9 + Math.sin(t * 20) * 1.5); c.lineTo(1.8, 5); c.closePath(); c.fill();
    } else if (k === 'S') {                                                           // 실드: 안쪽 방패 + 빛
      c.fillStyle = col; c.globalAlpha = 0.32; c.scale(0.62, 0.62); this.itemShape(c, 'shield'); c.fill();
      c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 3; c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-1.5, 5); c.lineTo(7, -5); c.stroke();
    } else if (k === 'B') {                                                           // 폭탄: 둥근 몸통 · 심지 · 불꽃
      c.fillStyle = '#2a2f45'; c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(-1, 3, 8.5, 0, 7); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(-4, 0, 2.4, 0, 7); c.fill();
      c.strokeStyle = '#d9c7a0'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(4, -4); c.quadraticCurveTo(7, -9, 10, -9); c.stroke();
      const f = 2.2 + Math.abs(Math.sin(t * 14)) * 1.6; c.fillStyle = Math.floor(t * 10) % 2 ? '#fff3a0' : col;
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? f * 0.45 : f; c[i ? 'lineTo' : 'moveTo'](10.5 + Math.cos(a) * r, -9.5 + Math.sin(a) * r); } c.closePath(); c.fill();
    } else if (k === 'D') {                                                           // 드론: 작은 비행기 + 양쪽 프로펠러
      c.strokeStyle = col; c.lineWidth = 1.6;
      for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * 9, -5, 4.6, 1.8, Math.sin(t * 25) * 0.6, 0, 7); c.stroke(); }
      c.fillStyle = col; c.beginPath(); c.moveTo(0, -9); c.lineTo(-7.5, 7); c.lineTo(7.5, 7); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 2, 2.1, 0, 7); c.fill();
    }
    c.restore();
  },
  drawShip(c, x, y) {
    const t = this.t;
    c.save(); c.translate(x, y);
    const fl = 10 + Math.random() * 8;                                               // 엔진 불꽃
    const g = c.createLinearGradient(0, 8, 0, 8 + fl * 1.6); g.addColorStop(0, 'rgba(120,220,255,.95)'); g.addColorStop(1, 'rgba(120,220,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-6, 10); c.lineTo(6, 10); c.lineTo(0, 10 + fl * 1.6); c.fill();
    c.fillStyle = '#2b3550'; c.beginPath(); c.moveTo(0, -6); c.lineTo(-22, 12); c.lineTo(-20, 16); c.lineTo(-6, 10); c.lineTo(6, 10); c.lineTo(20, 16); c.lineTo(22, 12); c.closePath(); c.fill();   // 날개
    const body = c.createLinearGradient(-8, 0, 8, 0); body.addColorStop(0, '#9aa6c2'); body.addColorStop(0.5, '#eef2fb'); body.addColorStop(1, '#8a96b3');
    c.fillStyle = body; c.beginPath(); c.moveTo(0, -24); c.lineTo(8, 0); c.lineTo(7, 12); c.lineTo(-7, 12); c.lineTo(-8, 0); c.closePath(); c.fill();
    const glass = c.createLinearGradient(0, -14, 0, -2); glass.addColorStop(0, '#9be7ff'); glass.addColorStop(1, '#1f6fb5');
    c.fillStyle = glass; c.beginPath(); c.ellipse(0, -8, 3.5, 7, 0, 0, 7); c.fill();
    c.fillStyle = Math.floor(t * 4) % 2 ? '#ff5d73' : '#5ce1ff'; c.fillRect(-21, 11, 3, 3); c.fillRect(18, 11, 3, 3);
    c.restore();
  },
  drawEnemy(c, e) {
    c.save(); c.translate(e.x, e.y);
    const hit = e.flash > 0;
    const col = { grunt: ['#ff9f43', '#7a3d0c'], zig: ['#b388ff', '#3c2470'], gunship: ['#ff5d73', '#6b1424'], tank: ['#8d93a8', '#3a3f52'], carrier: ['#ffd23f', '#6e5410'], boss: ['#c0392b', '#3a0e0b'] }[e.t];
    const g = c.createLinearGradient(0, -e.r, 0, e.r); g.addColorStop(0, hit ? '#fff' : col[0]); g.addColorStop(1, hit ? '#fff' : col[1]);
    c.fillStyle = g;
    if (e.t === 'boss') {
      c.beginPath(); c.moveTo(-80, -10); c.lineTo(-40, -36); c.lineTo(40, -36); c.lineTo(80, -10); c.lineTo(50, 30); c.lineTo(-50, 30); c.closePath(); c.fill();
      c.fillStyle = '#ffde59'; for (const tx of [-50, 0, 50]) { c.beginPath(); c.arc(tx, 22, 6, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(255,80,60,.8)'; c.beginPath(); c.arc(0, -8, 12 + Math.sin(this.t * 6) * 2, 0, 7); c.fill();
    } else if (e.t === 'carrier') {
      c.beginPath(); c.ellipse(0, 0, e.r + 8, e.r * 0.55, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(160,240,255,.8)'; c.beginPath(); c.ellipse(0, -6, 10, 8, 0, Math.PI, 0); c.fill();
      for (let i = 0; i < 5; i++) { c.fillStyle = Math.floor(this.t * 8 + i) % 2 ? '#fff' : '#ffd23f'; c.beginPath(); c.arc(-20 + i * 10, 4, 2, 0, 7); c.fill(); }
    } else if (e.t === 'tank') {
      c.beginPath(); c.moveTo(-e.r, -10); c.lineTo(-e.r * 0.6, -e.r); c.lineTo(e.r * 0.6, -e.r); c.lineTo(e.r, -10); c.lineTo(e.r * 0.7, e.r); c.lineTo(-e.r * 0.7, e.r); c.closePath(); c.fill();
      c.fillStyle = '#ff5d73'; c.fillRect(-4, e.r - 6, 8, 10);
    } else {
      c.beginPath(); c.moveTo(0, e.r); c.lineTo(-e.r, -e.r * 0.5); c.lineTo(-e.r * 0.35, -e.r * 0.2); c.lineTo(0, -e.r); c.lineTo(e.r * 0.35, -e.r * 0.2); c.lineTo(e.r, -e.r * 0.5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(0, 2, 3, 0, 7); c.fill();
    }
    c.restore();
    if ((e.t === 'tank' || e.t === 'carrier') && e.hp < e.max) { c.fillStyle = '#222'; c.fillRect(e.x - 24, e.y - e.r - 14, 48, 4); c.fillStyle = '#ff5d73'; c.fillRect(e.x - 24, e.y - e.r - 14, 48 * e.hp / e.max, 4); }
  },
  draw() {
    const c = $('#sh-cv').getContext('2d'), p = this.p;
    c.fillStyle = '#05070f'; c.fillRect(0, 0, SH.W, SH.H);
    for (const n of this.nebula) { const g = c.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r); g.addColorStop(0, `hsla(${n.h},70%,45%,.16)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); }
    for (const s of this.stars) { c.fillStyle = `rgba(220,230,255,${0.25 + s.z * 0.3})`; c.fillRect(s.x, s.y, s.z + 1, s.z === 2 ? 3 : s.z + 1); }
    c.globalCompositeOperation = 'lighter';
    for (const s of this.shots) {
      if (s.k === 'L') { c.fillStyle = 'rgba(92,225,255,.9)'; c.fillRect(s.x - 1.5, s.y - 16, 3, 22); c.fillStyle = 'rgba(92,225,255,.25)'; c.fillRect(s.x - 4, s.y - 18, 8, 26); }
      else { c.fillStyle = 'rgba(255,220,90,.95)'; c.beginPath(); c.ellipse(s.x, s.y, 2.5, 7, Math.atan2(s.vx, -s.vy), 0, 7); c.fill(); }
    }
    for (const m of this.missiles) { c.save(); c.translate(m.x, m.y); c.rotate(m.a); c.fillStyle = '#ffd6c9'; c.fillRect(-6, -2, 12, 4); c.fillStyle = '#ff6b5b'; c.fillRect(4, -2, 4, 4); c.restore(); }
    for (const q of this.parts) { c.globalAlpha = Math.min(1, q.t * 3); c.fillStyle = q.c; c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
    c.globalAlpha = 1;
    for (const b of this.ebul) { const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, 7); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ff4d8a'); g.addColorStop(1, 'rgba(255,77,138,0)'); c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, 7, 0, 7); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    for (const e of this.enemies) this.drawEnemy(c, e);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const it of this.items) this.drawItem(c, it.k, it.x, it.y, 1 + Math.sin(this.t * 6 + it.ph) * 0.06, it.ph);   // 아이템 캡슐
    if (!this.over && !(this.inv > 0 && Math.floor(this.t * 11) % 2)) {
      for (const d of this.dronePos()) {
        c.fillStyle = '#b388ff'; c.beginPath(); c.moveTo(d.x, d.y - 9); c.lineTo(d.x - 7, d.y + 6); c.lineTo(d.x + 7, d.y + 6); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(d.x, d.y, 2, 0, 7); c.fill();
      }
      this.drawShip(c, p.x, p.y);
      if (this.shield) { c.strokeStyle = `rgba(63,224,160,${0.5 + Math.sin(this.t * 8) * 0.3})`; c.lineWidth = 2.5; c.beginPath(); c.arc(p.x, p.y, 28, 0, 7); c.stroke(); }
    }
    for (const f of this.fx) {
      if (f.txt) { c.globalAlpha = Math.min(1, f.t * 2); c.fillStyle = f.c || '#fff'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 4; c.font = '17px "Black Han Sans", sans-serif'; c.strokeText(f.txt, f.x, f.y - (0.9 - f.t) * 34); c.fillText(f.txt, f.x, f.y - (0.9 - f.t) * 34); }
      else if (f.ring) { c.globalAlpha = f.t * 2.5; c.strokeStyle = '#ffd9a0'; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, f.r * (2.2 - f.t * 3), 0, 7); c.stroke(); }
      c.globalAlpha = 1;
    }
    if (this.boss) { const b = this.boss; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(40, 14, SH.W - 80, 10); c.fillStyle = '#ff5d73'; c.fillRect(40, 14, (SH.W - 80) * Math.max(0, b.hp / b.max), 10); }
    // 무기 표시
    const w = SH_WEAPON[this.weapon];
    c.fillStyle = 'rgba(5,8,20,.7)'; c.beginPath(); c.roundRect(10, SH.H - 40, 200, 30, 8); c.fill();
    c.fillStyle = w.color; c.font = '15px "Black Han Sans", sans-serif'; c.textAlign = 'left'; c.fillText(w.name, 20, SH.H - 24);
    for (let i = 0; i < 5; i++) { c.fillStyle = i < this.power ? w.color : 'rgba(255,255,255,.15)'; c.fillRect(110 + i * 14, SH.H - 31, 10, 14); }
    for (let i = 0; i < this.drones; i++) { const dx = 186 + i * 13, dy = SH.H - 25; c.fillStyle = '#c39bff'; c.beginPath(); c.moveTo(dx, dy - 7); c.lineTo(dx - 5.5, dy + 5); c.lineTo(dx + 5.5, dy + 5); c.closePath(); c.fill(); }   // 드론 수
    if (this.flashT > 0) { c.fillStyle = `rgba(255,255,255,${this.flashT * 1.5})`; c.fillRect(0, 0, SH.W, SH.H); }
    if (this.banner && this.banner.t > 0) { c.globalAlpha = Math.min(1, this.banner.t * 2); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '38px "Black Han Sans", sans-serif'; c.fillText(this.banner.txt, SH.W / 2, SH.H * 0.4); c.globalAlpha = 1; }
  },
};
(() => {
  const cv = $('#sh-cv');
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); Shooter.target = cvPoint(cv, e); });
  cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') Shooter.target = cvPoint(cv, e); });
  cv.addEventListener('pointerleave', () => { Shooter.target = null; });
})();
ACT.shBomb = () => Shooter.bomb();
register('shooter', {
  solo: () => Shooter.start(), stop: () => { Shooter.over = true; },
  key: e => { if ((e.code === 'KeyB' || e.code === 'KeyX') && !e.repeat) Shooter.bomb(); },
  pad: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '|', 'KeyB'], padLabel: { KeyB: '💣' },
});
