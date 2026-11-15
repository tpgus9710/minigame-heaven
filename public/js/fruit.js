/* =====================================================================
 *  🍉 과일 합치기 (싱글: 기록 도전 / 멀티: 2분 점수 대결) — 같은 과일이 닿으면 한 단계 큰 과일로!
 *  v13.9: 높이 떨어뜨릴수록 세게 부딪혀 옆으로 퍼지고 굴러가요 · 잘 미끄러지고 · 같은 과일은 살짝 끌어당겨요(더 잘 합쳐져요)
 *         합쳐질 때 옆 과일을 밀어내요(연쇄!) · 콤보 점수 · 과즙 · 점수 글자 · 흔들림 · 소리 · 다음 과일은 과일 그림으로
 * ===================================================================== */
const FR = {
  W: 400, H: 620, L: 18, R: 382, FLOOR: 604, LINE: 118, DROP_Y: 70,
  RAD: [14, 19, 24, 30, 36, 43, 50, 59, 68, 79, 91],          // v13.9: 7% 작게 (상자에 자리가 더 많아요)
  NAME: ['체리', '딸기', '포도', '귤', '레몬', '사과', '배', '복숭아', '파인애플', '멜론', '수박'],
  // [밝은색, 기본색, 어두운색]
  COLOR: [['#ff7a8a', '#d0102f', '#6e0016'], ['#ff8f9e', '#ec2d4f', '#8c0d24'], ['#c99cff', '#7b3fc4', '#3a1470'], ['#ffd08a', '#ff8a1c', '#b04d00'], ['#fff7a6', '#f5d322', '#a88a00'],
    ['#ff8f7a', '#e0261d', '#7d0c08'], ['#f2ffb0', '#c4d94a', '#6f7f12'], ['#ffe0cf', '#ffa58a', '#d0584a'], ['#ffe9a0', '#e6b23a', '#8a5f10'], ['#e6ffd0', '#9ccf6e', '#4f7f2a'], ['#8fe08a', '#2f9a43', '#145a22']],
};
makeScreen('fruit', {
  title: '🍉 과일 합치기',
  status: (TOUCH ? '끌어서 조준하고 떼면 떨어져요' : '마우스로 조준하고 클릭 (← → · 스페이스도 돼요)') + ' · 빠르게 두 번 연속도 돼요! 선 위에 3초 넘게 머물면 끝',
  stats: [['score', '점수'], ['next', '다음'], ['time', '최고 점수']],
  body: `<div class="center"><canvas id="fr-cv" class="game-cv" width="${FR.W}" height="${FR.H}"></canvas></div>`,
});
$('#fruit-next').innerHTML = '<canvas id="fr-next" width="72" height="72" role="img" aria-label="다음 과일"></canvas>';   // 다음 과일: 글자 대신 그림

/* ── 물리: 원(과일)끼리 부딪히는 강체 물리 (실제 수박 게임 느낌으로) ──
 *  · 속도 · 회전을 가진 과일: 충격량으로 튕기고 · 마찰로 굴러가요 (잘 미끄러지게 마찰은 낮게)
 *  · 무게 = 크기(넓이)에 비례 → 큰 과일이 작은 과일을 밀어내요
 *  · 겹친 만큼은 '위치'만 조금씩 밀어서 풀어요 (속도로 바꾸지 않아요) → 합쳐질 때 과일이 천장까지 튀지 않아요
 *  · 손맛(v13.9): 떨어진 과일이 처음 부딪히면 그 속도만큼 둘 다 옆으로 퍼져요(높이 떨어뜨릴수록 세게) ·
 *    같은 과일이 아주 가까우면 살짝 끌어당기고 · 합쳐질 때 옆 과일을 밀어내요(연쇄)
 *  · 넘침: 선 위에 과일이 '멈춘 채로' 3초 넘게 있으면 끝 (합쳐지며 잠깐 뜬 과일 · 떨어지는 과일은 세지 않아요) */
const FPHYS = {
  G: 1900,          // 중력 (px/s²)
  SUB: 8, IT: 6,    // 한 프레임을 8번 나눠 계산 · 접촉마다 6번씩 다듬기 (지난 걸음의 힘에서 시작: 쌓인 과일이 안정적으로)
  E: 0.3, EW: 0.22, // 튕김 (과일끼리 · 벽)
  BOUNCE_V: 45,     // 이보다 느리게 부딪히면 튕기지 않고 멈춰요 (쌓인 과일이 덜덜 떨지 않게)
  MU: 0.12, MUW: 0.14,   // 마찰 (과일끼리 · 벽과 바닥) — 낮을수록 잘 미끄러져 틈으로 들어가요
  SLOP: 0.35, BETA: 0.22, MAXC: 1.6,   // 겹침 풀기: 조금 남겨 두고 · 한 번에 22% · 최대 1.6px
  LD: 0.9998, AD: 0.9993,              // 공기 저항 · 구름 저항 (구르는 게 오래가요)
  REST: 6,                             // 이보다 느리면 조금씩 더 멈춰요 (쌓인 과일의 미세한 떨림 없애기)
  HIT: 0.5, HIT_MIN: 140, HIT_MAX: 320,    // 떨어진 과일의 첫 충돌: 부딪힌 속도 × 0.5 만큼 옆으로 (140px/s 아래는 그냥 · 최대 320)
  MAG: 2800, MAG_R: 0.6,               // 같은 과일끼리 자석처럼 끌어당기기 (사이가 작은 쪽 반지름의 60% + 3px 안쪽이면)
  MTOL: 1.5,                           // 이만큼 떨어져 있어도 닿은 걸로 쳐서 합쳐요
  POP: 170,                            // 합쳐질 때 옆 과일을 밀어내는 힘
  OVER: 3,                             // 선 위에 멈춰서 이만큼(초) 있으면 끝
  QUICK: 0.12, CD: 0.5, QUICK_WIN: 600,   // 떨어뜨린 뒤 0.12초면 한 번 더(빠르게 두 번 연속) · 그다음은 0.5초 쉬기 · 0.6초 넘게 쉬면 다시 두 번
  QUEUE: 0.15,                         // 기다림이 이만큼만 남았을 때 누르면 기억했다가 바로 떨어뜨려요 (빠른 두 번 탭이 씹히지 않게)
  COMBO_T: 1300, COMBO_K: 0.25, COMBO_MAX: 3,   // 한 번 떨어뜨린 뒤 1.3초 안에 또 합쳐지면 콤보 (연쇄) · 콤보마다 점수 +25% · 최대 3배
};
let FRUIT_ID = 0;
const Fruit = {
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'fruit';
    this.rnd = Math.random;                                           // 모양 · 효과 (사람마다 달라도 돼요)
    this.prnd = this.multi ? seeded(opt.seed) : Math.random;         // 나올 과일 순서 (멀티: 모두 같은 순서)
    Object.assign(this, { fruits: [], score: 0, x: FR.W / 2, cool: 0, over: false, danger: 0, fx: [], parts: [], texts: [], shake: 0,
      picks: 0, combo: 0, lastMerge: -1e9, bestCombo: 0, blipAt: 0, lastSent: -1, warm: new Map(), lastDrop: -1e9, streak: 0, queued: false, qx: 0 });
    this.cur = this.pick(); this.next = this.pick();
    this.endAt = opt.seconds ? performance.now() + opt.seconds * 1000 : 0;
    $('#fruit-time-label').textContent = this.multi ? '남은 시간' : '최고 점수';
    if (!this.multi) setStat('fruit', 'time', store.get('best-fruit', 0));
    show('fruit'); renderScores(); this.hud();
    gameLoop((dt, now) => { if (!this.over) this.update(dt, now); this.draw(now); });
  },
  /** 다음 과일: 처음 6개는 작은 것만 (체리 · 딸기 · 포도) · 그다음은 작을수록 자주 */
  pick() {
    const r = this.prnd(), n = this.picks++;
    if (n < 6) return r < 0.4 ? 0 : r < 0.75 ? 1 : 2;
    return r < 0.3 ? 0 : r < 0.56 ? 1 : r < 0.78 ? 2 : r < 0.93 ? 3 : 4;
  },
  hud() {
    setStat('fruit', 'score', this.score);
    const cv = $('#fr-next');
    if (cv && cv.dataset.lv !== String(this.next)) {                  // 다음 과일 그림 (바뀔 때만 다시 그려요)
      const c = cv.getContext('2d'), lv = this.next;
      c.clearRect(0, 0, 72, 72);
      paintFruit(c, lv, 36, 40, lv === 8 ? 23 : 26);
      cv.dataset.lv = String(lv); cv.title = `다음: ${FR.NAME[lv]}`; cv.setAttribute('aria-label', `다음 과일: ${FR.NAME[lv]}`);
    }
    if (this.multi && this.score !== this.lastSent) { this.lastSent = this.score; socket.emit('sr:score', this.score); }
  },
  /** 과일 하나 (무게 · 회전 관성은 크기로) */
  body(lv, x, y, vx = 0, vy = 0, now = performance.now()) {
    const r = FR.RAD[lv], m = r * r, I = 0.5 * m * r * r;
    return { id: ++FRUIT_ID, lv, r, x, y, vx, vy, a: (this.rnd() - 0.5) * 0.6, w: 0, im: 1 / m, ii: 1 / I, born: now, ot: 0, pop: 0 };
  },
  /** 떨어뜨리기: 한 번 떨어뜨리면 곧바로(0.12초) 한 번 더 떨어뜨릴 수 있어요 → 두 번째 뒤에는 0.5초 쉬어요 */
  drop() {
    if (this.over) return;
    const P = FPHYS;
    if (this.cool > 0) { if (this.cool <= P.QUEUE) { this.queued = true; this.qx = this.x; } return; }   // 거의 다 기다렸으면 기억해 둬요
    const t = performance.now();
    this.queued = false;
    this.streak = t - this.lastDrop < P.QUICK_WIN ? this.streak + 1 : 1;
    this.lastDrop = t;
    const r = FR.RAD[this.cur], x = clamp(this.x, FR.L + r, FR.R - r);
    const f = this.body(this.cur, x, FR.DROP_Y);
    f.fresh = true;                                                   // 처음 부딪힐 때 옆으로 퍼져요
    this.fruits.push(f);
    this.combo = 0;                                                   // 콤보는 한 번 떨어뜨린 뒤 이어지는 연쇄만
    this.cur = this.next; this.next = this.pick(); this.cool = this.streak >= 2 ? P.CD : P.QUICK; this.hud();
  },
  update(dt, now) {
    this.cool -= dt;
    if (this.queued && this.cool <= 0) { const x = this.x; this.x = this.qx; this.drop(); this.x = x; }   // 눌러 둔 자리에 떨어뜨려요
    if (held('ArrowLeft', 'KeyA')) this.x -= 300 * dt;
    if (held('ArrowRight', 'KeyD')) this.x += 300 * dt;
    this.x = clamp(this.x, FR.L, FR.R);
    const P = FPHYS, h = Math.min(dt, 1 / 30) / P.SUB;
    for (let s = 0; s < P.SUB; s++) this.step(h, now);
    for (const f of this.fruits) { if (f.pop > 0) f.pop -= dt; if (f.fresh && now - f.born > 2500) f.fresh = false; }
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    for (const p of this.parts) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }
    this.parts = this.parts.filter(p => p.t > 0 && p.y < FR.H + 20);
    for (const t of this.texts) { t.y -= 38 * dt; t.t -= dt; }
    this.texts = this.texts.filter(t => t.t > 0);
    this.shake = Math.max(0, this.shake - dt);
    if (this.combo && now - this.lastMerge > P.COMBO_T) this.combo = 0;
    // 넘침: 선 위에서 멈춰 있는 과일만 시간을 세요 (떨어지는 중 · 합쳐지며 잠깐 뜬 과일은 빼고)
    let worst = 0;
    for (const f of this.fruits) {
      const still = Math.hypot(f.vx, f.vy) < 90, above = f.y - f.r < FR.LINE && now - f.born > 900;
      f.ot = above && still ? f.ot + dt : Math.max(0, f.ot - dt * 2);
      worst = Math.max(worst, f.ot);
    }
    this.danger = worst;
    if (worst > P.OVER) this.end('넘쳤어요!');
    if (this.endAt) { setStat('fruit', 'time', leftSec(this.endAt)); if (now >= this.endAt) this.end('⏰ 시간 종료'); }
  },
  /** 아주 짧은 시간(h초) 한 걸음: 속도(+끌어당기기) → 부딪힘(충격량 · 마찰 · 첫 충돌 퍼짐) → 위치 → 겹침 풀기 → 합치기 */
  step(h, now) {
    const P = FPHYS, F = this.fruits;
    for (const f of F) { f.vy += P.G * h; f.vx *= P.LD; f.vy *= P.LD; f.w *= P.AD; }
    const C = [], merges = [];
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
        const same = a.lv === b.lv && !a.m && !b.m, reach = same ? min + P.MAG_R * Math.min(a.r, b.r) + 3 : min;
        if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) continue;
        const d2 = dx * dx + dy * dy; if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2) || 0.01;
        if (same && d < min + P.MTOL) { a.m = b.m = true; merges.push([a, b]); continue; }
        if (same && d >= min) {                                      // 같은 과일이 아주 가까워요 → 살짝 끌어당겨요
          const k = P.MAG * (1 - (d - min) / (reach - min)) * h, nx = dx / d, ny = dy / d, sa = b.im / (a.im + b.im), sb = 1 - sa;
          a.vx += nx * k * 2 * sa; a.vy += ny * k * 2 * sa; b.vx -= nx * k * 2 * sb; b.vy -= ny * k * 2 * sb;
          continue;
        }
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
      if (c.b.fresh || (c.a && c.a.fresh)) this.hit(c, -vn);
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
  /** 떨어진 과일의 첫 충돌: 부딪힌 속도(높이 떨어뜨릴수록 빨라요)만큼 두 과일이 옆으로 퍼지고 굴러요 */
  hit(c, speed) {
    if (speed <= 0) return;                                           // 서로 멀어지는 중 (빠르게 두 번: 공중에서 잠깐 겹쳐요) → 아직 첫 충돌 아님
    const P = FPHYS, { a, b } = c, fresh = b.fresh ? b : a, other = fresh === b ? a : b;
    fresh.fresh = false;
    if (!other || speed < P.HIT_MIN) return;                         // 바닥 · 벽이거나 살살 내려놓았으면 그냥
    const dirx = other === b ? c.nx : -c.nx;                          // 맞은 과일이 밀려나는 쪽 (가로)
    const s = Math.abs(dirx) < 0.12 ? (this.rnd() < 0.5 ? -1 : 1) : Math.sign(dirx), lean = Math.max(0.55, Math.abs(dirx));
    const mf = 1 / fresh.im, mo = 1 / other.im, share = mf / (mf + mo);
    const ko = Math.min(P.HIT_MAX, speed * P.HIT * share * 1.6) * lean, kf = Math.min(P.HIT_MAX * 0.7, speed * P.HIT * (1 - share)) * lean;
    other.vx += s * ko; other.w += s * ko / other.r;
    fresh.vx -= s * kf; fresh.w -= s * kf / fresh.r;
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
  /** 같은 과일이 닿으면: 두 과일 가운데에 한 단계 큰 과일 (속도는 두 과일의 평균) · 옆 과일은 밀려나요 · 콤보 · 과즙 */
  merge(merges, now) {
    const P = FPHYS;
    for (const [a, b] of merges) {
      const lv = a.lv, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      a.dead = b.dead = true;
      this.combo = now - this.lastMerge < P.COMBO_T ? this.combo + 1 : 1;
      this.lastMerge = now; this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mul = Math.min(P.COMBO_MAX, 1 + (this.combo - 1) * P.COMBO_K), pts = Math.round((lv + 1) * (lv + 2) * mul) + (lv === 10 ? 200 : 0);
      this.score += pts;
      const nl = Math.min(10, lv + 1), nr = FR.RAD[nl];
      this.fx.push({ x, y, t: 0.35, r: nr });
      this.juice(x, y, lv, nr);
      this.texts.push({ x, y: y - nr * 0.3, t: 0.9, txt: `+${pts}`, big: lv >= 7, combo: this.combo >= 2 ? this.combo : 0 });
      if (lv >= 6) this.shake = Math.max(this.shake, lv >= 9 ? 0.45 : lv >= 8 ? 0.32 : 0.2);
      if (lv === 9) this.texts.push({ x: FR.W / 2, y: FR.H * 0.42, t: 1.8, txt: '🍉 수박 완성!', hero: true });
      if (lv === 10) this.texts.push({ x: FR.W / 2, y: FR.H * 0.42, t: 1.8, txt: '🍉🍉 수박 펑! +200', hero: true });
      this.sound(lv);
      if (lv < 10) {
        const nf = this.body(nl, clamp(x, FR.L + nr, FR.R - nr), Math.min(y, FR.FLOOR - nr), (a.vx + b.vx) / 2, (a.vy + b.vy) / 2, now);
        nf.a = (a.a + b.a) / 2; nf.pop = 0.16;
        nf.fresh = !!(a.fresh && b.fresh);                            // 빠르게 두 번 떨어뜨려 공중에서 합쳐지면 → 떨어질 때 퍼져요
        // 커진 과일이 옆 과일을 밀어내요 → 굴러가서 또 합쳐질 수 있어요 (연쇄) · 같은 과일(바로 또 합쳐질 짝)은 밀지 않아요
        for (const f of this.fruits) {
          if (f.dead || f.lv === nl) continue;
          const dx = f.x - nf.x, dy = f.y - nf.y, d = Math.hypot(dx, dy) || 0.01, gap = d - nr - f.r;
          if (gap > 10) continue;
          const sp = P.POP * (1 + lv * 0.08) * nr / (nr + f.r) * (gap < 0 ? 1 : 1 - gap / 10);
          f.vx += dx / d * sp; f.vy += Math.max(-0.5, dy / d) * sp * 0.7; f.w += (dx / d) * sp / f.r * 0.5;
        }
        this.fruits.push(nf);
      }
    }
    this.fruits = this.fruits.filter(f => !f.dead);
    this.hud();
  },
  /** 과즙이 톡톡 (과일 색) */
  juice(x, y, lv, r) {
    const n = Math.min(26, 8 + lv * 2), col = FR.COLOR[lv];
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, sp = 120 + this.rnd() * (160 + lv * 18);
      this.parts.push({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, r: 2 + this.rnd() * (2 + lv * 0.35), c: col[this.rnd() < 0.5 ? 0 : 1], t: 0.45 + this.rnd() * 0.4 });
    }
    if (lv >= 9) for (let i = 0; i < 40; i++) {                      // 수박: 색종이
      const a = this.rnd() * Math.PI * 2, sp = 200 + this.rnd() * 340;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, r: 3 + this.rnd() * 3, c: ['#ffd23f', '#ff6b9a', '#5ce1ff', '#7dff9a', '#fff'][i % 5], t: 1 + this.rnd() * 0.6, sq: true });
    }
  },
  /** 합칠 때 '뽁' (큰 과일일수록 낮게 · 콤보일수록 높게) */
  sound(lv) {
    if (typeof Sound === 'undefined') return;
    const t = performance.now(); if (t - this.blipAt < 45) return;
    this.blipAt = t;
    Sound.blip(Math.min(1800, 760 * Math.pow(0.93, lv) * (1 + Math.min(8, this.combo - 1) * 0.09)), 0.05 + lv * 0.006, 0.8 + Math.min(0.6, lv * 0.06));
    if (lv >= 9) Sound.play('mission');
  },
  end(why) {
    if (this.over) return;
    this.over = true;
    if (this.multi) { socket.emit('sr:score', this.score); socket.emit('sr:over'); setStatus('fruit', `${why} ${this.score}점 — 결과를 기다리는 중…`); return; }
    const best = Math.max(+store.get('best-fruit', 0), this.score); store.set('best-fruit', best);
    const top = this.fruits.reduce((m, f) => Math.max(m, f.lv), 0);
    after(600, () => showResult({ title: '🍉 ' + why, subtitle: `점수 ${this.score} · 최고 콤보 ${this.bestCombo} · 가장 큰 과일 ${FR.NAME[top]} · 최고 점수 ${best}`, solo: 'fruit', rec: { v: this.score } }));
  },
  draw(now) {
    const c = $('#fr-cv').getContext('2d');
    c.save();
    if (this.shake > 0) c.translate((this.rnd() - 0.5) * this.shake * 22, (this.rnd() - 0.5) * this.shake * 22);   // 큰 과일이 합쳐지면 흔들
    const bg = c.createLinearGradient(0, 0, 0, FR.H); bg.addColorStop(0, '#2a2236'); bg.addColorStop(1, '#3a2a2a'); c.fillStyle = bg; c.fillRect(-12, -12, FR.W + 24, FR.H + 24);
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
    for (const p of this.parts) {                                      // 과즙 · 색종이
      c.globalAlpha = Math.min(1, p.t * 2.2); c.fillStyle = p.c;
      if (p.sq) c.fillRect(p.x - p.r, p.y - p.r * 0.6, p.r * 2, p.r * 1.2); else { c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const t of this.texts) {                                      // +점수 · 콤보 · 수박!
      const k = t.hero ? Math.min(1, (1.8 - t.t) * 6) : 1;
      c.globalAlpha = Math.min(1, t.t * 2.5);
      c.font = t.hero ? `${Math.round(34 * (0.6 + 0.4 * k))}px "Black Han Sans", sans-serif` : `${t.big ? 26 : 19}px "Black Han Sans", sans-serif`;
      c.lineWidth = t.hero ? 7 : 5; c.strokeStyle = 'rgba(30,14,24,.85)'; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.hero ? '#7dff9a' : '#fff'; c.fillText(t.txt, t.x, t.y);
      if (t.combo) {
        c.font = '17px "Black Han Sans", sans-serif'; const s = `콤보 ×${t.combo}`;
        c.lineWidth = 4; c.strokeText(s, t.x, t.y - 22); c.fillStyle = '#ffd23f'; c.fillText(s, t.x, t.y - 22);
      }
    }
    c.globalAlpha = 1;
    if (warn && !this.over) {                                       // 넘치기 직전: 남은 시간
      c.fillStyle = 'rgba(255,60,60,.9)'; c.font = 'bold 15px "Noto Sans KR", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText(`넘치기 ${Math.max(0, FPHYS.OVER - this.danger).toFixed(1)}초 전!`, FR.R, FR.LINE - 4);
    }
    if (this.combo >= 2 && !this.over) {                               // 지금 콤보 (오른쪽 위)
      c.font = '16px "Black Han Sans", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(30,14,24,.85)'; c.strokeText(`🔥 ${this.combo} 콤보`, FR.R, 46); c.fillStyle = '#ffd23f'; c.fillText(`🔥 ${this.combo} 콤보`, FR.R, 46);
    }
    c.font = '12px "Noto Sans KR", sans-serif'; c.fillStyle = '#a58a6a'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('진화', 10, 20);
    for (let i = 0; i < 11; i++) paintFruit(c, i, 46 + i * 21, 20, 8);
    c.restore();
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
