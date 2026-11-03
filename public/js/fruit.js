/* =====================================================================
 *  🍉 과일 합치기 (싱글: 기록 도전 / 멀티: 2분 점수 대결) — 같은 과일이 닿으면 한 단계 큰 과일로!
 * ===================================================================== */
const FR = {
  W: 400, H: 620, L: 18, R: 382, FLOOR: 604, LINE: 118, DROP_Y: 70,
  RAD: [15, 20, 26, 32, 39, 46, 54, 63, 73, 85, 98],
  NAME: ['체리', '딸기', '포도', '귤', '레몬', '사과', '배', '복숭아', '파인애플', '멜론', '수박'],
  // [밝은색, 기본색, 어두운색]
  COLOR: [['#ff7a8a', '#d0102f', '#6e0016'], ['#ff8f9e', '#ec2d4f', '#8c0d24'], ['#c99cff', '#7b3fc4', '#3a1470'], ['#ffd08a', '#ff8a1c', '#b04d00'], ['#fff7a6', '#f5d322', '#a88a00'],
    ['#ff8f7a', '#e0261d', '#7d0c08'], ['#f2ffb0', '#c4d94a', '#6f7f12'], ['#ffe0cf', '#ffa58a', '#d0584a'], ['#ffe9a0', '#e6b23a', '#8a5f10'], ['#e6ffd0', '#9ccf6e', '#4f7f2a'], ['#8fe08a', '#2f9a43', '#145a22']],
};
makeScreen('fruit', {
  title: '🍉 과일 합치기', status: '마우스(터치)로 위치를 정하고 눌러서 떨어뜨려요. 빨간 선을 넘으면 끝!',
  stats: [['score', '점수'], ['next', '다음'], ['time', '최고 점수']],
  body: `<div class="center"><canvas id="fr-cv" class="game-cv" width="${FR.W}" height="${FR.H}"></canvas></div>`,
});

const Fruit = {
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'fruit';
    this.rnd = this.multi ? seeded(opt.seed) : Math.random;
    Object.assign(this, { fruits: [], score: 0, x: FR.W / 2, cool: 0, over: false, danger: 0, fx: [], lastSent: -1 });
    this.cur = this.pick(); this.next = this.pick();
    this.endAt = opt.seconds ? performance.now() + opt.seconds * 1000 : 0;
    $('#fruit-time-label').textContent = this.multi ? '남은 시간' : '최고 점수';
    if (!this.multi) setStat('fruit', 'time', store.get('best-fruit', 0));
    show('fruit'); renderScores(); this.hud();
    gameLoop((dt, now) => { if (!this.over) this.update(dt, now); this.draw(now); });
  },
  pick() { const r = this.rnd(); return r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.75 ? 2 : r < 0.9 ? 3 : 4; },
  hud() {
    setStat('fruit', 'score', this.score); setStat('fruit', 'next', FR.NAME[this.next]);
    if (this.multi && this.score !== this.lastSent) { this.lastSent = this.score; socket.emit('sr:score', this.score); }
  },
  drop() {
    if (this.over || this.cool > 0) return;
    const r = FR.RAD[this.cur], x = clamp(this.x, FR.L + r, FR.R - r);
    this.fruits.push({ lv: this.cur, x, y: FR.DROP_Y, px: x, py: FR.DROP_Y, born: performance.now() });
    this.cur = this.next; this.next = this.pick(); this.cool = 0.55; this.hud();
  },
  update(dt, now) {
    this.cool -= dt;
    if (held('ArrowLeft', 'KeyA')) this.x -= 300 * dt;
    if (held('ArrowRight', 'KeyD')) this.x += 300 * dt;
    this.x = clamp(this.x, FR.L, FR.R);
    const F = this.fruits, SUB = 8, sdt = Math.min(dt, 1 / 30) / SUB, G = 1500;
    const merges = [];
    for (let s = 0; s < SUB; s++) {
      for (const f of F) {
        const vx = (f.x - f.px) * 0.995, vy = (f.y - f.py) * 0.995;
        f.px = f.x; f.py = f.y; f.x += vx; f.y += vy + G * sdt * sdt;
      }
      for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
        const a = F[i], b = F[j], ra = FR.RAD[a.lv], rb = FR.RAD[b.lv];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = ra + rb;
        if (d >= min || d === 0) continue;
        if (a.lv === b.lv && !a.m && !b.m) { a.m = b.m = true; merges.push([a, b]); continue; }
        const ov = (min - d) / d, ma = ra * ra, mb = rb * rb, ka = mb / (ma + mb), kb = ma / (ma + mb);
        a.x -= dx * ov * ka; a.y -= dy * ov * ka; b.x += dx * ov * kb; b.y += dy * ov * kb;
      }
      for (const f of F) {
        const r = FR.RAD[f.lv];
        if (f.x < FR.L + r) { f.x = FR.L + r; }
        if (f.x > FR.R - r) { f.x = FR.R - r; }
        if (f.y > FR.FLOOR - r) { f.y = FR.FLOOR - r; f.px = f.x - (f.x - f.px) * 0.85; }
      }
    }
    if (merges.length) {
      for (const [a, b] of merges) {
        const lv = a.lv, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        a.dead = b.dead = true;
        this.score += (lv + 1) * (lv + 2);
        this.fx.push({ x, y, t: 0.35, r: FR.RAD[Math.min(10, lv + 1)] });
        if (lv < 10) F.push({ lv: lv + 1, x, y, px: x, py: y, born: now - 2000 });
        else this.score += 200;
      }
      this.fruits = F.filter(f => !f.dead);
      this.hud();
    }
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    const above = this.fruits.some(f => now - f.born > 1500 && f.y - FR.RAD[f.lv] < FR.LINE);
    this.danger = above ? this.danger + dt : 0;
    if (this.danger > 2.2) this.end('넘쳤어요!');
    if (this.endAt) { setStat('fruit', 'time', leftSec(this.endAt)); if (now >= this.endAt) this.end('⏰ 시간 종료'); }
  },
  end(why) {
    if (this.over) return;
    this.over = true;
    if (this.multi) { socket.emit('sr:score', this.score); socket.emit('sr:over'); setStatus('fruit', `${why} ${this.score}점 — 결과를 기다리는 중…`); return; }
    const best = Math.max(+store.get('best-fruit', 0), this.score); store.set('best-fruit', best);
    after(600, () => showResult({ title: '🍉 ' + why, subtitle: `점수 ${this.score} · 최고 점수 ${best}`, solo: 'fruit' }));
  },
  draw(now) {
    const c = $('#fr-cv').getContext('2d');
    const bg = c.createLinearGradient(0, 0, 0, FR.H); bg.addColorStop(0, '#2a2236'); bg.addColorStop(1, '#3a2a2a'); c.fillStyle = bg; c.fillRect(0, 0, FR.W, FR.H);
    c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(FR.L, FR.LINE, FR.R - FR.L, FR.FLOOR - FR.LINE);
    c.fillStyle = '#7a5434'; c.fillRect(FR.L - 8, FR.LINE, 8, FR.FLOOR - FR.LINE + 8); c.fillRect(FR.R, FR.LINE, 8, FR.FLOOR - FR.LINE + 8); c.fillRect(FR.L - 8, FR.FLOOR, FR.R - FR.L + 16, 10);
    c.strokeStyle = this.danger > 0 && Math.floor(now / 150) % 2 ? '#ff2d2d' : 'rgba(255,80,80,.6)'; c.setLineDash([8, 6]); c.lineWidth = 2;
    c.beginPath(); c.moveTo(FR.L, FR.LINE); c.lineTo(FR.R, FR.LINE); c.stroke(); c.setLineDash([]);
    const drawFruit = (lv, x, y, a = 1) => { c.globalAlpha = a; paintFruit(c, lv, x, y, FR.RAD[lv]); c.globalAlpha = 1; };
    if (!this.over) {
      const r = FR.RAD[this.cur], x = clamp(this.x, FR.L + r, FR.R - r);
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.moveTo(x, FR.DROP_Y); c.lineTo(x, FR.FLOOR); c.stroke();
      drawFruit(this.cur, x, FR.DROP_Y, this.cool > 0 ? 0.4 : 1);
    }
    for (const f of this.fruits) drawFruit(f.lv, f.x, f.y);
    for (const f of this.fx) { c.globalAlpha = f.t * 2; c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * (1.5 - f.t), 0, 7); c.fill(); c.globalAlpha = 1; }
    c.font = '12px "Noto Sans KR", sans-serif'; c.fillStyle = '#a58a6a'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('진화', 10, 20);
    for (let i = 0; i < 11; i++) paintFruit(c, i, 46 + i * 21, 20, 8);
  },
};
(() => {
  const cv = $('#fr-cv');
  cv.addEventListener('pointermove', e => { Fruit.x = cvPoint(cv, e).x; });
  cv.addEventListener('pointerdown', e => { Fruit.x = cvPoint(cv, e).x; });
  cv.addEventListener('pointerup', () => Fruit.drop());
})();
register('fruit', {
  solo: () => Fruit.start({}), multi: d => Fruit.start({ seed: d.seed, seconds: d.seconds }), stop: () => { Fruit.over = true; },
  key: e => { if ((e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') && !e.repeat) Fruit.drop(); },
  pad: ['ArrowLeft', 'ArrowRight', '|', 'Space'], padLabel: { Space: '떨구기' },
});

/** 과일 그리기: 구 모양 그라데이션 + 과일마다 특징(꼭지 · 씨 · 줄무늬 · 그물 무늬 …) */
function paintFruit(c, lv, x, y, r) {
  const [hi, base, dark] = FR.COLOR[lv];
  const sphere = (cx, cy, rr, h = hi, b = base, d = dark) => {
    const g = c.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.08, cx, cy, rr);
    g.addColorStop(0, h); g.addColorStop(0.55, b); g.addColorStop(1, d);
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill();
  };
  const stem = (len, bend = 0.3, col = '#5b3a1a') => { c.strokeStyle = col; c.lineWidth = Math.max(1.5, r * 0.09); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - r * 0.82); c.quadraticCurveTo(x + r * bend * 0.5, y - r - len * 0.6, x + r * bend, y - r - len); c.stroke(); };
  const leaf = (ang, size, col = '#3fae4a') => { c.save(); c.translate(x + r * 0.12, y - r * 0.9); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.ellipse(size * 0.6, 0, size * 0.62, size * 0.28, 0, 0, 7); c.fill(); c.restore(); };
  c.save();
  c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = r * 0.25; c.shadowOffsetY = r * 0.08;
  if (lv === 2) {   // 포도: 작은 알 여러 개
    c.shadowBlur = 0;
    const pts = [[0, -0.45], [-0.42, -0.2], [0.42, -0.2], [0, 0.05], [-0.38, 0.3], [0.38, 0.3], [0, 0.55], [-0.2, -0.05], [0.2, 0.2]];
    for (const [dx, dy] of pts) sphere(x + dx * r, y + dy * r, r * 0.36);
    stem(r * 0.25, 0.1, '#6b4a1a');
    c.restore(); return;
  }
  sphere(x, y, r);
  c.shadowColor = 'transparent';
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  if (lv === 1) {   // 딸기: 씨
    c.fillStyle = 'rgba(255,230,120,.9)';
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const px = x + i * r * 0.36 + (j % 2) * r * 0.18, py = y + j * r * 0.34 + r * 0.1; c.beginPath(); c.ellipse(px, py, r * 0.045, r * 0.07, 0, 0, 7); c.fill(); }
  } else if (lv === 3) {   // 귤: 점점이 무늬
    c.fillStyle = 'rgba(160,70,0,.18)';
    for (let i = 0; i < 26; i++) { const a = i * 2.4, d = r * (0.2 + (i % 5) * 0.16); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.035, 0, 7); c.fill(); }
  } else if (lv === 6) {   // 배: 주근깨
    c.fillStyle = 'rgba(110,90,20,.28)';
    for (let i = 0; i < 22; i++) { const a = i * 2.1, d = r * (0.25 + (i % 4) * 0.18); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.03, 0, 7); c.fill(); }
  } else if (lv === 7) {   // 복숭아: 가운데 골
    c.strokeStyle = 'rgba(190,70,60,.45)'; c.lineWidth = r * 0.07; c.beginPath(); c.moveTo(x + r * 0.05, y - r); c.quadraticCurveTo(x - r * 0.35, y, x + r * 0.05, y + r); c.stroke();
  } else if (lv === 8) {   // 파인애플: 마름모 격자
    c.strokeStyle = 'rgba(110,70,10,.5)'; c.lineWidth = r * 0.05;
    for (let k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(x + k * r * 0.4 - r, y - r); c.lineTo(x + k * r * 0.4 + r, y + r); c.stroke(); c.beginPath(); c.moveTo(x + k * r * 0.4 + r, y - r); c.lineTo(x + k * r * 0.4 - r, y + r); c.stroke(); }
  } else if (lv === 9) {   // 멜론: 그물 무늬
    c.strokeStyle = 'rgba(240,255,220,.55)'; c.lineWidth = Math.max(1, r * 0.03);
    for (let k = 0; k < 9; k++) { c.beginPath(); for (let t = 0; t <= 12; t++) { const px = x - r + (t / 12) * 2 * r, py = y - r + (k + 0.5) * (2 * r / 9) + Math.sin(t * 1.7 + k * 2) * r * 0.06; t ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); }
    for (let k = 0; k < 9; k++) { c.beginPath(); for (let t = 0; t <= 12; t++) { const py = y - r + (t / 12) * 2 * r, px = x - r + (k + 0.5) * (2 * r / 9) + Math.sin(t * 1.3 + k * 3) * r * 0.06; t ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); }
  } else if (lv === 10) {  // 수박: 진한 줄무늬
    c.fillStyle = '#0f3d16';
    for (let k = -3; k <= 3; k++) { c.beginPath(); for (let t = 0; t <= 16; t++) { const py = y - r + (t / 16) * 2 * r, px = x + k * r * 0.3 + Math.sin(t * 1.1 + k) * r * 0.05 - r * 0.06; t ? c.lineTo(px, py) : c.moveTo(px, py); } for (let t = 16; t >= 0; t--) { const py = y - r + (t / 16) * 2 * r, px = x + k * r * 0.3 + Math.sin(t * 1.1 + k + 0.6) * r * 0.05 + r * 0.06; c.lineTo(px, py); } c.fill(); }
  } else if (lv === 5) {   // 사과: 위쪽 오목
    c.fillStyle = 'rgba(80,0,0,.35)'; c.beginPath(); c.ellipse(x, y - r * 0.82, r * 0.28, r * 0.12, 0, 0, 7); c.fill();
  }
  // 반짝임
  c.fillStyle = 'rgba(255,255,255,.38)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.15, -0.6, 0, 7); c.fill();
  c.restore();
  // 꼭지 · 잎 · 왕관
  if (lv === 0) { stem(r * 0.9, 0.6, '#4d6b1a'); leaf(-0.9, r * 0.6); }
  else if (lv === 1) { c.fillStyle = '#2e9a3e'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; c.beginPath(); c.moveTo(x, y - r * 0.85); c.lineTo(x + Math.cos(a - 0.25) * r * 0.55, y - r * 0.85 + Math.sin(a - 0.25) * r * 0.35 + r * 0.15); c.lineTo(x + Math.cos(a) * r * 0.62, y - r * 0.85 + Math.sin(a) * r * 0.4 + r * 0.2); c.fill(); } }
  else if (lv === 3 || lv === 4) { c.fillStyle = '#4d7a1a'; c.beginPath(); c.arc(x, y - r * 0.88, r * 0.08, 0, 7); c.fill(); if (lv === 3) leaf(-0.4, r * 0.45); }
  else if (lv === 5 || lv === 6) { stem(r * 0.35, 0.15); leaf(-0.5, r * 0.5); }
  else if (lv === 7) leaf(-0.7, r * 0.55);
  else if (lv === 8) { c.fillStyle = '#3c8f2e'; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * r * 0.1 - r * 0.08, y - r * 0.85); c.lineTo(x + i * r * 0.22, y - r * 1.25 - (3 - Math.abs(i)) * r * 0.07); c.lineTo(x + i * r * 0.1 + r * 0.08, y - r * 0.85); c.fill(); } }
  else if (lv === 9) stem(r * 0.18, 0, '#6b5a2a');
  else if (lv === 10) stem(r * 0.15, 0.1, '#5a7a2a');
  c.restore();
}
