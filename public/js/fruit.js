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
  title: '🍉 과일 합치기', status: '마우스로 위치를 정하고 눌러서 · 화면을 끌어서 조준하고 떼면 떨어져요. 선 위에 과일이 쌓여 2초 넘게 머물면 끝!',
  stats: [['score', '점수'], ['next', '다음'], ['time', '최고 점수']],
  body: `<div class="center"><canvas id="fr-cv" class="game-cv" width="${FR.W}" height="${FR.H}"></canvas></div>`,
});

/* ── 물리: 원(과일)끼리 부딪히는 강체 물리 (실제 수박 게임 느낌으로) ──
 *  · 속도 · 회전을 가진 과일: 충격량으로 튕기고(조금만) · 마찰로 굴러가요 (미끄러지기만 하지 않게)
 *  · 무게 = 크기(넓이)에 비례 → 큰 과일이 작은 과일을 밀어내요
 *  · 겹친 만큼은 '위치'만 조금씩 밀어서 풀어요 (속도로 바꾸지 않아요) → 합쳐질 때 과일이 천장까지 튀지 않아요
 *  · 넘침: 선 위에 과일이 '멈춘 채로' 2초 넘게 있으면 끝 (합쳐지며 잠깐 뜬 과일 · 떨어지는 과일은 세지 않아요) */
const FPHYS = {
  G: 1700,          // 중력 (px/s²) — 빈 상자 바닥까지 약 0.75초
  SUB: 8, IT: 6,    // 한 프레임을 8번 나눠 계산 · 접촉마다 6번씩 다듬기 (지난 걸음의 힘에서 시작: 쌓인 과일이 안정적으로)
  E: 0.14, EW: 0.1, // 튕김 (과일끼리 · 벽)
  BOUNCE_V: 70,     // 이보다 느리게 부딪히면 튕기지 않고 멈춰요 (쌓인 과일이 덜덜 떨지 않게)
  MU: 0.32, MUW: 0.24,   // 마찰 (과일끼리 · 벽과 바닥)
  SLOP: 0.35, BETA: 0.22, MAXC: 1.6,   // 겹침 풀기: 조금 남겨 두고 · 한 번에 22% · 최대 1.6px
  LD: 0.9997, AD: 0.996,               // 공기 저항 · 구름 저항
  REST: 6,                             // 이보다 느리면 조금씩 더 멈춰요 (쌓인 과일의 미세한 떨림 없애기)
};
let FRUIT_ID = 0;
const Fruit = {
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'fruit';
    this.rnd = this.multi ? seeded(opt.seed) : Math.random;
    Object.assign(this, { fruits: [], score: 0, x: FR.W / 2, cool: 0, over: false, danger: 0, fx: [], lastSent: -1, warm: new Map() });
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
  /** 과일 하나 (무게 · 회전 관성은 크기로) */
  body(lv, x, y, vx = 0, vy = 0, now = performance.now()) {
    const r = FR.RAD[lv], m = r * r, I = 0.5 * m * r * r;
    return { id: ++FRUIT_ID, lv, r, x, y, vx, vy, a: (this.rnd() - 0.5) * 0.6, w: 0, im: 1 / m, ii: 1 / I, born: now, ot: 0, pop: 0 };
  },
  drop() {
    if (this.over || this.cool > 0) return;
    const r = FR.RAD[this.cur], x = clamp(this.x, FR.L + r, FR.R - r);
    this.fruits.push(this.body(this.cur, x, FR.DROP_Y));
    this.cur = this.next; this.next = this.pick(); this.cool = 0.5; this.hud();
  },
  update(dt, now) {
    this.cool -= dt;
    if (held('ArrowLeft', 'KeyA')) this.x -= 300 * dt;
    if (held('ArrowRight', 'KeyD')) this.x += 300 * dt;
    this.x = clamp(this.x, FR.L, FR.R);
    const P = FPHYS, h = Math.min(dt, 1 / 30) / P.SUB;
    for (let s = 0; s < P.SUB; s++) this.step(h, now);
    for (const f of this.fruits) if (f.pop > 0) f.pop -= dt;
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    // 넘침: 선 위에서 멈춰 있는 과일만 시간을 세요 (떨어지는 중 · 합쳐지며 잠깐 뜬 과일은 빼고)
    let worst = 0;
    for (const f of this.fruits) {
      const still = Math.hypot(f.vx, f.vy) < 90, above = f.y - f.r < FR.LINE && now - f.born > 900;
      f.ot = above && still ? f.ot + dt : Math.max(0, f.ot - dt * 2);
      worst = Math.max(worst, f.ot);
    }
    this.danger = worst;
    if (worst > 2) this.end('넘쳤어요!');
    if (this.endAt) { setStat('fruit', 'time', leftSec(this.endAt)); if (now >= this.endAt) this.end('⏰ 시간 종료'); }
  },
  /** 아주 짧은 시간(h초) 한 걸음: 속도 → 부딪힘(충격량 · 마찰) → 위치 → 겹침 풀기 → 합치기 */
  step(h, now) {
    const P = FPHYS, F = this.fruits;
    for (const f of F) { f.vy += P.G * h; f.vx *= P.LD; f.vy *= P.LD; f.w *= P.AD; }
    const C = [], merges = [];
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
        if (Math.abs(dx) >= min || Math.abs(dy) >= min) continue;
        const d2 = dx * dx + dy * dy; if (d2 >= min * min) continue;
        if (a.lv === b.lv && !a.m && !b.m) { a.m = b.m = true; merges.push([a, b]); continue; }
        const d = Math.sqrt(d2) || 0.01;
        C.push({ k: a.id + ':' + b.id, a, b, nx: dx / d, ny: dy / d, pen: min - d, mu: P.MU, e: P.E, jn: 0, jt: 0 });
      }
      // 벽 · 바닥 (움직이지 않는 상대: a = null, 법선은 벽에서 과일 쪽)
      if (a.x - a.r < FR.L) C.push({ k: 'L' + a.id, a: null, b: a, nx: 1, ny: 0, pen: FR.L - (a.x - a.r), mu: P.MUW, e: P.EW, jn: 0, jt: 0 });
      if (a.x + a.r > FR.R) C.push({ k: 'R' + a.id, a: null, b: a, nx: -1, ny: 0, pen: a.x + a.r - FR.R, mu: P.MUW, e: P.EW, jn: 0, jt: 0 });
      if (a.y + a.r > FR.FLOOR) C.push({ k: 'F' + a.id, a: null, b: a, nx: 0, ny: -1, pen: a.y + a.r - FR.FLOOR, mu: P.MUW, e: P.EW, jn: 0, jt: 0 });
    }
    // 처음 부딪히는 속도로 튕김 정하기 (느리면 튕기지 않게) · 계속 닿아 있던 접촉은 지난 걸음의 힘부터 (warm start)
    const warm = new Map();
    for (const c of C) {
      const vn = this.relV(c).n; c.bounce = vn < -P.BOUNCE_V ? -c.e * vn : 0;
      const w = this.warm.get(c.k);
      if (w && !c.bounce) { c.jn = w[0] * 0.85; c.jt = w[1] * 0.85; this.kick(c, c.jn, c.jt); }
    }
    for (let it = 0; it < P.IT; it++) for (const c of C) this.solve(c);
    for (const c of C) warm.set(c.k, [c.jn, c.jt]);
    this.warm = warm;
    for (const f of F) { const v = Math.hypot(f.vx, f.vy); if (v < P.REST) { f.vx *= 0.9; f.vy *= 0.9; f.w *= 0.9; } }
    for (const f of F) { f.x += f.vx * h; f.y += f.vy * h; f.a += f.w * h; }
    // 겹침 풀기: 위치만 조금씩 (속도는 그대로) → 튀지 않아요
    for (const c of C) {
      const { a, b } = c;
      let pen;
      if (a) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01; pen = a.r + b.r - d; c.nx = dx / d; c.ny = dy / d; }
      else pen = c.nx ? (c.nx > 0 ? FR.L - (b.x - b.r) : b.x + b.r - FR.R) : b.y + b.r - FR.FLOOR;
      const k = Math.min(P.MAXC, Math.max(0, pen - P.SLOP) * P.BETA); if (!k) continue;
      const ima = a ? a.im : 0, sum = ima + b.im;
      if (a) { a.x -= c.nx * k * ima / sum; a.y -= c.ny * k * ima / sum; }
      b.x += c.nx * k * b.im / sum; b.y += c.ny * k * b.im / sum;
    }
    for (const f of F) {                                            // 벽 · 바닥 밖으로는 절대 안 나가게 (마지막 안전장치)
      if (f.x < FR.L + f.r - 2) f.x = FR.L + f.r - 2;
      if (f.x > FR.R - f.r + 2) f.x = FR.R - f.r + 2;
      if (f.y > FR.FLOOR - f.r + 2) f.y = FR.FLOOR - f.r + 2;
    }
    if (merges.length) this.merge(merges, now);
  },
  /** 접촉점에서 상대 속도 (법선 n · 접선 t 방향) */
  relV(c) {
    const { a, b, nx, ny } = c, tx = -ny, ty = nx;
    // 접촉점: a 쪽 = a 중심 + n·ra, b 쪽 = b 중심 - n·rb · 회전 속도 w × r = (-w·ry, w·rx)
    const vbx = b.vx + b.w * (ny * b.r), vby = b.vy - b.w * (nx * b.r);
    const vax = a ? a.vx - a.w * (ny * a.r) : 0, vay = a ? a.vy + a.w * (nx * a.r) : 0;
    const rx = vbx - vax, ry = vby - vay;
    return { n: rx * nx + ry * ny, t: rx * tx + ry * ty };
  },
  /** 충격량 주기 (밀어내는 jn · 마찰 jt) */
  kick(c, jn, jt) {
    const { a, b, nx, ny } = c, tx = -ny, ty = nx;
    if (a) { a.vx -= (nx * jn + tx * jt) * a.im; a.vy -= (ny * jn + ty * jt) * a.im; a.w -= jt * a.r * a.ii; }
    b.vx += (nx * jn + tx * jt) * b.im; b.vy += (ny * jn + ty * jt) * b.im; b.w -= jt * b.r * b.ii;
  },
  /** 접촉 하나 다듬기: 밀어내는 힘(누적 ≥ 0) + 마찰(누적 ≤ μ·밀어내는 힘) → 마찰이 회전도 만들어요 */
  solve(c) {
    const { a, b, nx, ny } = c, tx = -ny, ty = nx, ima = a ? a.im : 0, iia = a ? a.ii : 0;
    let v = this.relV(c);
    let jn = -(v.n - c.bounce) / (ima + b.im);
    const jn0 = c.jn; c.jn = Math.max(0, jn0 + jn); jn = c.jn - jn0;
    if (a) { a.vx -= nx * jn * ima; a.vy -= ny * jn * ima; }
    b.vx += nx * jn * b.im; b.vy += ny * jn * b.im;
    v = this.relV(c);
    const kt = ima + b.im + (a ? a.r * a.r * iia : 0) + b.r * b.r * b.ii;
    let jt = -v.t / kt;
    const jt0 = c.jt, lim = c.mu * c.jn; c.jt = Math.max(-lim, Math.min(lim, jt0 + jt)); jt = c.jt - jt0;
    if (a) { a.vx -= tx * jt * ima; a.vy -= ty * jt * ima; a.w -= jt * a.r * iia; }
    b.vx += tx * jt * b.im; b.vy += ty * jt * b.im; b.w -= jt * b.r * b.ii;
  },
  /** 같은 과일이 닿으면: 두 과일 가운데에 한 단계 큰 과일 (속도는 두 과일의 평균) */
  merge(merges, now) {
    for (const [a, b] of merges) {
      const lv = a.lv, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      a.dead = b.dead = true;
      this.score += (lv + 1) * (lv + 2);
      this.fx.push({ x, y, t: 0.35, r: FR.RAD[Math.min(10, lv + 1)] });
      if (lv < 10) {
        const r = FR.RAD[lv + 1], nf = this.body(lv + 1, clamp(x, FR.L + r, FR.R - r), Math.min(y, FR.FLOOR - r), (a.vx + b.vx) / 2, (a.vy + b.vy) / 2, now);
        nf.a = (a.a + b.a) / 2; nf.pop = 0.16;
        this.fruits.push(nf);
      } else this.score += 200;
    }
    this.fruits = this.fruits.filter(f => !f.dead);
    this.hud();
  },
  end(why) {
    if (this.over) return;
    this.over = true;
    if (this.multi) { socket.emit('sr:score', this.score); socket.emit('sr:over'); setStatus('fruit', `${why} ${this.score}점 — 결과를 기다리는 중…`); return; }
    const best = Math.max(+store.get('best-fruit', 0), this.score); store.set('best-fruit', best);
    after(600, () => showResult({ title: '🍉 ' + why, subtitle: `점수 ${this.score} · 최고 점수 ${best}`, solo: 'fruit', rec: { v: this.score } }));
  },
  draw(now) {
    const c = $('#fr-cv').getContext('2d');
    const bg = c.createLinearGradient(0, 0, 0, FR.H); bg.addColorStop(0, '#2a2236'); bg.addColorStop(1, '#3a2a2a'); c.fillStyle = bg; c.fillRect(0, 0, FR.W, FR.H);
    c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(FR.L, FR.LINE, FR.R - FR.L, FR.FLOOR - FR.LINE);
    c.fillStyle = '#7a5434'; c.fillRect(FR.L - 8, FR.LINE, 8, FR.FLOOR - FR.LINE + 8); c.fillRect(FR.R, FR.LINE, 8, FR.FLOOR - FR.LINE + 8); c.fillRect(FR.L - 8, FR.FLOOR, FR.R - FR.L + 16, 10);
    const warn = this.danger > 0.15;
    c.strokeStyle = warn && Math.floor(now / 150) % 2 ? '#ff2d2d' : 'rgba(255,80,80,.6)'; c.setLineDash([8, 6]); c.lineWidth = warn ? 3 : 2;
    c.beginPath(); c.moveTo(FR.L, FR.LINE); c.lineTo(FR.R, FR.LINE); c.stroke(); c.setLineDash([]);
    const drawFruit = (lv, x, y, a = 1, ang = 0, k = 1) => { c.globalAlpha = a; paintFruit(c, lv, x, y, FR.RAD[lv] * k, ang); c.globalAlpha = 1; };
    if (!this.over) {
      const r = FR.RAD[this.cur], x = clamp(this.x, FR.L + r, FR.R - r);
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, FR.DROP_Y + r); c.lineTo(x, FR.FLOOR); c.stroke();
      drawFruit(this.cur, x, FR.DROP_Y, this.cool > 0 ? 0.4 : 1);
    }
    for (const f of this.fruits) drawFruit(f.lv, f.x, f.y, 1, f.a, f.pop > 0 ? 1 - f.pop * 1.1 : 1);
    for (const f of this.fx) { c.globalAlpha = f.t * 2; c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, f.r * (1.5 - f.t), 0, 7); c.fill(); c.globalAlpha = 1; }
    if (warn && !this.over) {                                       // 넘치기 직전: 남은 시간
      c.fillStyle = 'rgba(255,60,60,.9)'; c.font = 'bold 15px "Noto Sans KR", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText(`넘치기 ${Math.max(0, 2 - this.danger).toFixed(1)}초 전!`, FR.R, FR.LINE - 4);
    }
    c.font = '12px "Noto Sans KR", sans-serif'; c.fillStyle = '#a58a6a'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('진화', 10, 20);
    for (let i = 0; i < 11; i++) paintFruit(c, i, 46 + i * 21, 20, 8);
  },
};
/* 조작: 마우스는 판 위에서 움직이면 조준 · 누르면 떨구기. 터치는 화면 어디든(판 밖 빈 곳도) 끌어서 조준 · 떼면 떨구기 */
(() => {
  const cv = $('#fr-cv'), aim = e => { Fruit.x = cvPoint(cv, e).x; };
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') aim(e); });
  TouchArea.add('fruit', { mouse: true, down: aim, move: aim, up: e => { aim(e); Fruit.drop(); } });
})();
register('fruit', {
  solo: () => Fruit.start({}), multi: d => Fruit.start({ seed: d.seed, seconds: d.seconds }), stop: () => { Fruit.over = true; },
  key: e => { if ((e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') && !e.repeat) Fruit.drop(); },
  // 터치 화면은 버튼 없이: 화면 어디든 끌어서 조준 · 떼면 떨어져요 (실제 수박 게임처럼) → 판이 더 커져요
});

/** 과일 그리기: 구 모양 그라데이션 + 과일마다 특징(꼭지 · 씨 · 줄무늬 · 그물 무늬 …) */
function paintFruit(c, lv, X, Y, r, ang = 0) {
  const [hi, base, dark] = FR.COLOR[lv];
  // 무늬 · 꼭지 · 잎은 과일과 함께 굴러요 (회전 ang) · 빛(그라데이션 · 반짝임)은 늘 왼쪽 위에서
  const rot = (px, py) => [X + (px - X) * Math.cos(ang) - (py - Y) * Math.sin(ang), Y + (px - X) * Math.sin(ang) + (py - Y) * Math.cos(ang)];
  const x = X, y = Y;
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
    for (const [dx, dy] of pts) { const [px, py] = rot(x + dx * r, y + dy * r); sphere(px, py, r * 0.36); }
    c.save(); c.translate(x, y); c.rotate(ang); c.translate(-x, -y); stem(r * 0.25, 0.1, '#6b4a1a'); c.restore();
    c.restore(); return;
  }
  sphere(x, y, r);
  c.shadowColor = 'transparent';
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  c.save(); c.translate(x, y); c.rotate(ang); c.translate(-x, -y);
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
  c.restore();
  // 반짝임 (돌지 않아요)
  c.fillStyle = 'rgba(255,255,255,.38)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.15, -0.6, 0, 7); c.fill();
  c.restore();
  // 꼭지 · 잎 · 왕관 (과일과 함께 돌아요)
  c.translate(x, y); c.rotate(ang); c.translate(-x, -y);
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
