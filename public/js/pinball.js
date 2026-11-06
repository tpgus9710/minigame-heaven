/* =====================================================================
 *  🎯 핀볼 (싱글: 기록 도전 / 멀티: 4분 점수 대결)
 *  · 플리퍼: 화면 왼쪽 · 오른쪽을 눌러요 (두 손가락 동시에 OK) · 키보드 ← → (Z · /)
 *  · 발사: 공이 발사대에 있으면 아무 데나 길게 눌렀다 떼기 (Space · ↓)
 *  · 범퍼 · 슬링샷 · 드롭 타깃 · 위쪽 레인 · 왼쪽 궤도 · 오른쪽 스피너 · 구멍(세이버)
 *  · 드롭 타깃을 다 쓰러뜨리면 「잠금」 점등 → 구멍에 2번 넣으면 3볼 멀티볼 · 궤도 · 스피너로 잭팟!
 *  · 미션을 차례로 깨면 레벨이 오르고, 3번째 미션마다 엑스트라 볼
 * ===================================================================== */
const PB = { W: 540, H: 960, R: 12, G: 1500, HZ: 300, VMAX: 2700, DRAG: 0.99985 };
makeScreen('pinball', {
  title: '🎯 핀볼', status: '왼쪽 · 오른쪽을 눌러 플리퍼! 길게 눌렀다 떼면 발사 · 미션 · 멀티볼 · 잭팟',
  stats: [['score', '점수'], ['ball', '볼'], ['best', '최고 점수']],
  body: `<div class="pb-wrap"><aside class="pb-side" id="pb-l"></aside><canvas id="pb-cv" class="game-cv" width="${PB.W}" height="${PB.H}"></canvas><aside class="pb-side" id="pb-r"></aside></div>`,
});

/* ── 판 모양 (월드 좌표 540 × 960) ── */
const PBT = (() => {
  const segs = [], circles = [], deco = [];
  const seg = (ax, ay, bx, by, o = {}) => { const s = { ax, ay, bx, by, e: o.e ?? 0.45, kick: o.kick || 0, id: o.id || '', one: o.one || 0, r: o.r || 0, col: o.col || 'wall', on: true }; segs.push(s); return s; };
  const poly = (pts, o) => { for (let i = 1; i < pts.length; i++) seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], o); };
  const circ = (x, y, r, o = {}) => { const c = { x, y, r, e: o.e ?? 0.6, kick: o.kick || 0, id: o.id || '', col: o.col || 'post' }; circles.push(c); return c; };
  // 바깥 벽: 왼쪽 · 위쪽 둥근 지붕 · 오른쪽 (발사 길 포함)
  const arc = [];
  for (let i = 0; i <= 44; i++) { const t = Math.PI - Math.PI * i / 44; arc.push([270 + 250 * Math.cos(t), 262 - 238 * Math.sin(t)]); }
  poly([[20, 1010], [20, 262]], { col: 'outer' }); poly(arc, { col: 'outer' }); poly([[520, 262], [520, 1010]], { col: 'outer' });
  // 발사 길: 안쪽 벽 · 바닥(플런저) · 한쪽으로만 열리는 문
  poly([[488, 1010], [488, 300]], { col: 'lane' });
  const plungerFloor = seg(488, 912 + PB.R, 520, 912 + PB.R, { e: 0.15, col: 'none' });
  seg(488, 300, 520, 252, { one: -1, e: 0.4, col: 'gate' });
  // 궤도 · 스피너 길에서 내려온 공을 인레인 쪽으로 살짝 밀어 주는 턱 (아웃레인으로 바로 빠지지 않게)
  seg(20, 628, 40, 646, { col: 'guide', e: 0.3 }); seg(488, 640, 468, 658, { col: 'guide', e: 0.3 });
  // 왼쪽 궤도 안쪽 벽 · 오른쪽 스피너 길 안쪽 벽
  poly([[92, 610], [92, 330], [100, 282], [124, 236], [150, 206]], { col: 'guide' });
  circ(92, 610, 7, { col: 'post' }); circ(150, 206, 6, { col: 'post' });
  poly([[412, 630], [412, 340], [404, 300]], { col: 'guide' });
  circ(412, 630, 7, { col: 'post' }); circ(404, 300, 6, { col: 'post' });
  // 위쪽 레인 칸막이 (4개)
  const LANES = [194, 254, 314];
  for (const x of [164, 224, 284, 344]) { seg(x, 118, x, 160, { r: 3, col: 'guide', e: 0.5 }); circ(x, 116, 6, { col: 'post' }); }
  // 팝 범퍼 3개
  const BUMPERS = [[200, 252], [308, 252], [254, 336]].map(([x, y], i) => circ(x, y, 26, { e: 0.85, kick: 560, id: 'bumper' + i, col: 'bumper' }));
  // 아래쪽: 아웃레인 칸막이 · 인레인 안내 벽 · 슬링샷 (왼쪽, 오른쪽은 거울)
  const SLINGS = [];
  for (const m of [1, -1]) {
    const X = x => (m > 0 ? x : 508 - x);
    circ(X(58), 690, 7, { col: 'post' });
    poly([[X(58), 690], [X(58), 784], [X(158), 829]], { col: 'guide' });       // 인레인 끝은 플리퍼 윗면과 이어지게 (공이 끼지 않게)
    const A = [X(102), 698], B = [X(102), 762], C = [X(148), 790];
    seg(A[0], A[1], B[0], B[1], { e: 0.35, col: 'sling' });
    seg(B[0], B[1], C[0], C[1], { e: 0.35, col: 'sling' });
    const kick = seg(C[0], C[1], A[0], A[1], { e: 0.4, kick: 480, id: m > 0 ? 'slingL' : 'slingR', col: 'slingK' });
    circ(A[0], A[1], 6, { col: 'sling' }); circ(B[0], B[1], 6, { col: 'sling' }); circ(C[0], C[1], 6, { col: 'sling' });
    SLINGS.push({ id: kick.id, A, B, C });
  }
  // 드롭 타깃 4개 (아래에서 맞히면 쓰러져요)
  const TARGETS = [206, 238, 270, 302].map((x, i) => seg(x - 12, 520, x + 12, 520, { r: 5, e: 0.3, id: 'target' + i, col: 'target' }));
  const SAUCER = { x: 136, y: 452, r: 15 };
  const FLIPPERS = [
    { side: 'L', x: 166, y: 846, L: 74, r1: 11, r2: 6, rest: 0.52, up: -0.52, a: 0.52, w: 0, on: false },
    { side: 'R', x: 342, y: 846, L: 74, r1: 11, r2: 6, rest: Math.PI - 0.52, up: Math.PI + 0.52, a: Math.PI - 0.52, w: 0, on: false },
  ];
  return { segs, circles, LANES, BUMPERS, SLINGS, TARGETS, SAUCER, FLIPPERS, plungerFloor, deco,
    ORBIT: { x0: 24, x1: 88, y0: 430, y1: 470 }, SPINNER: { x0: 416, x1: 484, y0: 468, y1: 492, x: 450, y: 480 }, PLUNGE: { x: 504, y: 912 } };
})();

const PB_MISSIONS = [
  { k: 'bumper', n: 20, t: n => `범퍼 ${n}번 치기` },
  { k: 'bank', n: 1, t: () => '드롭 타깃 4개 모두 쓰러뜨리기' },
  { k: 'spin', n: 40, t: n => `스피너 ${n}바퀴 돌리기` },
  { k: 'lanes', n: 2, t: n => `위쪽 레인 3개 다 켜기 ${n}번` },
  { k: 'saucer', n: 2, t: n => `구멍에 공 ${n}번 넣기` },
  { k: 'orbit', n: 2, t: n => `왼쪽 궤도로 ${n}번 쏘기` },
  { k: 'combo', n: 2, t: n => `콤보 ${n}번 (4초 안에 연속 샷)` },
  { k: 'multi', n: 1, t: () => '멀티볼 시작하기 (잠금 2번)' },
];
const PB_RANKS = ['연습생', '루키', '아마추어', '프로', '에이스', '마스터', '그랜드마스터', '레전드', '핀볼 신'];

const Pinball = {
  ptr: new Map(), holdKeys: new Set(), balls: [], over: true,
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'pinball';
    this.rnd = this.multi ? seeded(opt.seed) : Math.random;
    this.endAt = opt.seconds ? performance.now() + opt.seconds * 1000 : 0;
    const best = +store.get('best-pinball', 0);
    Object.assign(this, {
      score: 0, ballNo: 1, balls: [], extra: 0, mult: 1, kickLit: true, lanes: [false, false, false], laneDone: 0, bankDone: 0, lockLit: false, locks: 0,
      multiball: false, jackpots: 0, saveUntil: 0, saveAuto: 0, ebLit: false, missionI: 0, level: 1, mprog: 0, missionsDone: 0,
      combo: 0, lastShot: -9, combos: 0, skillLane: 0, skillUntil: 0, charge: 0, charging: false, holdKeys: new Set(),
      fx: [], pops: [], msgs: [], shake: 0, flash: {}, spinA: 0, spinV: 0, t: 0, acc: 0, over: false, bonusBase: 0,
      stats: { bumper: 0, target: 0, orbit: 0, spin: 0, jackpot: 0, combo: 0 }, best, newBest: false, lastSent: -1, saucer: null, ejectQ: 0,
      ptr: new Map(), endTimer: 0, state: 'play', bonusShow: null, sndT: 0,
    });
    for (const f of PBT.FLIPPERS) { f.a = f.rest; f.w = 0; f.on = false; }
    for (const t of PBT.TARGETS) t.on = true;
    this.newBall();
    $('#pinball-best-label').textContent = this.multi ? '남은 시간' : '최고 점수';
    show('pinball'); renderScores();
    this.setupCanvas();
    this.hud(); this.side();
    this.msg('공을 쏘세요!', '길게 눌렀다 떼면 발사', 2.2);
    gameLoop((dt, now) => this.frame(dt, now));
  },
  /* ── 캔버스: 화면 밀도에 맞춰 선명하게 (판 좌표는 그대로 540 × 960) ── */
  setupCanvas() {
    const cv = $('#pb-cv');
    this.Q = Math.min(2, Math.max(1, Math.round((window.devicePixelRatio || 1) * 2) / 2));
    if (cv.width !== PB.W * this.Q) { cv.width = PB.W * this.Q; cv.height = PB.H * this.Q; }
    this.ctx = cv.getContext('2d');
    this.bg = this.drawStatic();
  },
  newBall() {
    const p = PBT.PLUNGE;
    this.balls.push({ x: p.x, y: p.y, vx: 0, vy: 0, st: 'lane', trail: [], lane: -1, inO: false, inS: false, id: Math.random() });
    this.skillLane = Math.floor(this.rnd() * 3); this.skillUntil = 0;
    this.fresh = false;                       // 새 공은 새로 눌러야 발사 (누르던 손가락으로 바로 쏘지 않게)
  },
  ready() { return this.balls.length === 1 && this.balls[0].st === 'lane' && !this.over; },
  launch() {
    const b = this.balls.find(x => x.st === 'lane');
    if (!b) return;
    const pw = Math.max(0.12, this.charge);
    b.st = 'free'; b.vy = -(900 + 1650 * pw); b.vx = 0;
    if (!this.saveUntil || this.t > this.saveUntil) this.saveUntil = this.t + 10;
    this.skillUntil = this.t + 5;
    this.charge = 0; this.charging = false;
    Sound.blip(160, 0.12, 1.4);
  },

  /* ── 입력: 누르고 있는 손가락 · 키 → 플리퍼 / 발사 ── */
  plungeMode() { return this.balls.some(b => b.st === 'lane') && !this.balls.some(b => b.st === 'free' || b.st === 'hold'); },
  input() {
    if (this.over) return;
    const v = [...this.ptr.values(), ...[...this.holdKeys].map(k => PB_KEYS[k] || 'P')], any = v.length > 0;
    if (this.plungeMode()) {
      for (const f of PBT.FLIPPERS) f.on = false;
      if (any && !this.charging && this.fresh) { this.charging = true; this.charge = 0; }
      else if (!any && this.charging) this.launch();
      return;
    }
    if (this.charging) { this.charging = false; this.charge = 0; }
    this.flip(PBT.FLIPPERS[0], v.includes('L'));
    this.flip(PBT.FLIPPERS[1], v.includes('R'));
  },
  flip(f, on) {
    if (on && !f.on) { Sound.blip(f.side === 'L' ? 210 : 230, 0.03, 0.6); this.laneShift(f.side === 'L' ? -1 : 1); this.buzz(6); }
    f.on = on;
  },
  /** 플리퍼를 누르면 켜진 위쪽 레인이 옆으로 (불 꺼진 레인을 노리기 쉽게) */
  laneShift(d) {
    if (this.lanes.every(x => x) || this.lanes.every(x => !x)) return;
    this.lanes = d < 0 ? [this.lanes[1], this.lanes[2], this.lanes[0]] : [this.lanes[2], this.lanes[0], this.lanes[1]];
  },
  sideAt(e) { const r = $('#pb-cv').getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'L' : 'R'; },

  /* ── 한 프레임 ── */
  frame(dt, now) {
    if (!this.over) {
      if (this.endAt) { setStat('pinball', 'best', leftSec(this.endAt)); if (now >= this.endAt) return void this.gameOver('⏰ 시간 종료'); }
      this.acc += dt;
      const h = 1 / PB.HZ;
      let n = 0;
      while (this.acc >= h && n < 30) { this.step(h); this.acc -= h; n++; }
      if (n >= 30) this.acc = 0;
      if (this.charging) this.charge = Math.min(1, this.charge + dt * 0.9);
      else if (this.plungeMode() && !this.skillUntil && (this.skillT = (this.skillT || 0) + dt) > 0.9) { this.skillT = 0; this.skillLane = (this.skillLane + 1) % 3; }   // 스킬 샷 레인이 돌아가요 (누르는 순간 고정)
    }
    this.draw(dt);
  },
  step(h) {
    this.t += h;
    // 플리퍼
    for (const f of PBT.FLIPPERS) {
      const target = f.on ? f.up : f.rest, dir = Math.sign(target - f.a);
      if (!dir) { f.w = 0; continue; }
      const sp = f.on ? 30 : 17;
      f.w = dir * sp;
      let na = f.a + f.w * h;
      if ((target - na) * dir <= 0) na = target;
      f.a = na;
    }
    // 스피너
    this.spinA += this.spinV * h; this.spinV *= 0.996;
    if (Math.abs(this.spinV) < 2) this.spinV = 0;
    // 공
    for (const b of this.balls) {
      if (b.st === 'lane') { b.x = PBT.PLUNGE.x; b.y = PBT.PLUNGE.y + this.charge * 26; b.vx = b.vy = 0; continue; }
      if (b.st === 'hold') continue;
      b.vy += PB.G * h; b.vx *= PB.DRAG; b.vy *= PB.DRAG;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > PB.VMAX) { b.vx *= PB.VMAX / sp; b.vy *= PB.VMAX / sp; }
      b.x += b.vx * h; b.y += b.vy * h;
      for (const s of PBT.segs) if (s.on) this.hitSeg(b, s);
      for (const c of PBT.circles) this.hitCircle(b, c);
      for (const f of PBT.FLIPPERS) this.hitFlipper(b, f);
      const sp2 = Math.hypot(b.vx, b.vy);
      if (sp2 > PB.VMAX * 1.15) { b.vx *= PB.VMAX * 1.15 / sp2; b.vy *= PB.VMAX * 1.15 / sp2; }
      this.sensors(b);
      // 어딘가에 끼어 4초 넘게 멈춘 공: 살짝 흔들어 줘요 (플리퍼로 잡고 있을 때는 그대로)
      if (b.sx == null || Math.abs(b.x - b.sx) + Math.abs(b.y - b.sy) > 3) { b.sx = b.x; b.sy = b.y; b.still = 0; }
      else if (!PBT.FLIPPERS.some(f => f.on) && (b.still = (b.still || 0) + h) > 4) { b.vx += (b.x < 270 ? 1 : -1) * 260; b.vy -= 420; b.still = 0; this.shake = 4; }
    }
    // 공끼리 (멀티볼)
    const fr = this.balls.filter(b => b.st === 'free');
    for (let i = 0; i < fr.length; i++) for (let j = i + 1; j < fr.length; j++) {
      const a = fr[i], c = fr[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
      if (d >= PB.R * 2 || !d) continue;
      const nx = dx / d, ny = dy / d, o = (PB.R * 2 - d) / 2;
      a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
      const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (vn < 0) { const k = vn * 0.95; a.vx += k * nx; a.vy += k * ny; c.vx -= k * nx; c.vy -= k * ny; }
    }
    // 구멍에 잡힌 공 내보내기
    if (this.saucer && this.t >= this.saucer.until) this.ejectSaucer();
    // 빠진 공
    for (const b of this.balls) if (b.st === 'free' && b.y > PB.H + 30) b.st = 'gone';
    if (this.balls.some(b => b.st === 'gone')) this.drain();
  },
  hitSeg(b, s) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
    let t = ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s.ax + dx * t, py = s.ay + dy * t, rr = PB.R + s.r;
    let nx = b.x - px, ny = b.y - py;
    const d2 = nx * nx + ny * ny;
    if (d2 >= rr * rr || d2 === 0) return;
    if (s.one && ((b.x - s.ax) * -dy + (b.y - s.ay) * dx) * s.one < 0) return;   // 한쪽으로만 막는 문
    const d = Math.sqrt(d2); nx /= d; ny /= d;
    b.x = px + nx * rr; b.y = py + ny * rr;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    b.vx -= (1 + s.e) * vn * nx; b.vy -= (1 + s.e) * vn * ny;
    const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
    b.vx -= vt * 0.015 * tx; b.vy -= vt * 0.015 * ty;
    if (s.kick && -vn > 50) { b.vx += nx * s.kick; b.vy += ny * s.kick; this.event(s.id, b, px, py); }
    else if (s.col === 'target') this.event(s.id, b, px, py);
    else if (-vn > 280) this.tick(-vn);
  },
  hitCircle(b, c) {
    const nx0 = b.x - c.x, ny0 = b.y - c.y, rr = PB.R + c.r, d2 = nx0 * nx0 + ny0 * ny0;
    if (d2 >= rr * rr || d2 === 0) return;
    const d = Math.sqrt(d2), nx = nx0 / d, ny = ny0 / d;
    b.x = c.x + nx * rr; b.y = c.y + ny * rr;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0 && !c.kick) return;
    if (vn < 0) { b.vx -= (1 + c.e) * vn * nx; b.vy -= (1 + c.e) * vn * ny; }
    if (c.kick) { b.vx += nx * c.kick; b.vy += ny * c.kick; this.event(c.id, b, c.x + nx * c.r, c.y + ny * c.r); }
    else if (-vn > 280) this.tick(-vn);
  },
  hitFlipper(b, f) {
    const tx = f.x + Math.cos(f.a) * f.L, ty = f.y + Math.sin(f.a) * f.L, dx = tx - f.x, dy = ty - f.y, L2 = dx * dx + dy * dy;
    let t = ((b.x - f.x) * dx + (b.y - f.y) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = f.x + dx * t, py = f.y + dy * t, rf = f.r1 + (f.r2 - f.r1) * t, rr = PB.R + rf;
    let nx = b.x - px, ny = b.y - py;
    const d2 = nx * nx + ny * ny;
    if (d2 >= rr * rr || d2 === 0) return;
    const d = Math.sqrt(d2); nx /= d; ny /= d;
    b.x = px + nx * rr; b.y = py + ny * rr;
    const rx = px + nx * rf - f.x, ry = py + ny * rf - f.y;           // 닿은 점 (회전축 기준)
    const vfx = -f.w * ry, vfy = f.w * rx;                              // 그 점의 플리퍼 속도
    const rvx = b.vx - vfx, rvy = b.vy - vfy, vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    b.vx -= (1 + 0.28) * vn * nx; b.vy -= (1 + 0.28) * vn * ny;
    if (f.w && -vn > 400) Sound.blip(300 + Math.min(600, -vn / 4), 0.03, 0.8);
  },
  /** 센서: 위쪽 레인 · 궤도 · 스피너 · 구멍 · 발사대로 돌아온 공 */
  sensors(b) {
    const L = PBT.LANES;
    let lane = -1;
    if (b.y > 118 && b.y < 160) for (let i = 0; i < 3; i++) if (Math.abs(b.x - L[i]) < 24) lane = i;
    if (lane >= 0 && b.lane !== lane) this.laneHit(lane, b);
    b.lane = lane;
    const O = PBT.ORBIT, inO = b.x > O.x0 && b.x < O.x1 && b.y > O.y0 && b.y < O.y1;
    if (inO && !b.inO && b.vy < -250) this.shot('orbit', b);
    b.inO = inO;
    const Sp = PBT.SPINNER, inS = b.x > Sp.x0 && b.x < Sp.x1 && b.y > Sp.y0 && b.y < Sp.y1;
    if (inS && !b.inS) {
      const n = Math.max(2, Math.min(30, Math.round(Math.abs(b.vy) / 85)));
      this.spinV = (b.vy < 0 ? -1 : 1) * n * 6;
      this.add(200 * n, Sp.x, Sp.y - 30); this.stats.spin += n; this.bonusBase += 20 * n; this.progress('spin', n);
      for (let i = 0; i < Math.min(n, 8); i++) setTimeout(() => Sound.blip(1100 + i * 20, 0.015, 0.5), i * 45);
      if (b.vy < -300) this.shot('spinner', b);
    }
    b.inS = inS;
    const C = PBT.SAUCER;
    if (!this.saucer && this.t > (this.saucerCool || 0) && Math.hypot(b.x - C.x, b.y - C.y) < 16 && Math.hypot(b.vx, b.vy) < 1150) this.capture(b);
    if (this.kickLit && b.x < 56 && b.y > 760 && b.y < 900 && b.vy > 0) {      // 왼쪽 아웃레인 킥백: 한 번 살려 줘요
      this.kickLit = false; b.vx = 40; b.vy = -1750; b.x = 39;
      this.msg('킥백!', '위쪽 레인을 다 켜면 다시 켜져요', 1.3); this.shake = 6; Sound.blip(200, 0.15, 1.4); this.burst(40, 880, '#7cffb2', 14);
    }
    if (b.x > 490 && b.y > 860 && Math.abs(b.vy) < 40 && Math.abs(b.vx) < 40 && b.st === 'free') {   // 약하게 쏴서 발사대로 돌아온 공
      b.st = 'lane';
    }
  },

  /* ── 규칙 · 점수 ── */
  add(n, x, y) {
    const v = Math.round(n);
    this.score += v;
    if (x != null) this.pops.push({ x, y, t: 0, s: '+' + v.toLocaleString() });
    if (!this.multi && !this.newBest && this.best > 0 && this.score > this.best) { this.newBest = true; this.msg('🎉 신기록!', '최고 점수를 넘었어요', 1.6); Sound.play('title'); }
    this.hud();
  },
  tick(v) { if (this.t - this.sndT > 0.04) { this.sndT = this.t; Sound.blip(140 + Math.min(220, v / 6), 0.02, 0.35); } },
  event(id, b, x, y) {
    if (id.startsWith('bumper')) {
      this.flash[id] = 1; this.shake = Math.max(this.shake, 3.5);
      this.add(1000, x, y); this.stats.bumper++; this.bonusBase += 100; this.progress('bumper', 1);
      this.burst(x, y, '#7ef9ff', 10); Sound.blip(520 + 60 * +id.slice(-1), 0.06, 1.1); this.buzz(12);
    } else if (id.startsWith('sling')) {
      this.flash[id] = 1; this.shake = Math.max(this.shake, 2);
      this.add(300, x, y); this.burst(x, y, '#ffb547', 6); Sound.blip(380, 0.05, 0.9);
    } else if (id.startsWith('target')) {
      const s = PBT.TARGETS[+id.slice(-1)];
      if (!s.on) return;
      s.on = false; this.flash[id] = 1;
      this.add(3000, (s.ax + s.bx) / 2, s.ay); this.stats.target++; this.bonusBase += 1000;
      this.burst((s.ax + s.bx) / 2, s.ay, '#ff5d73', 8); Sound.blip(660, 0.07, 1);
      if (PBT.TARGETS.every(x => !x.on)) {
        this.bankDone++; this.add(25000); this.progress('bank', 1);
        this.lockLit = true;
        this.msg('타깃 클리어!', this.locks ? '잠금 점등 — 구멍에 넣어 멀티볼!' : '잠금 점등 — 구멍에 넣으세요', 1.6);
        Sound.play('pop');
        after(1300, () => { for (const t of PBT.TARGETS) t.on = true; });
      }
    }
  },
  laneHit(i, b) {
    if (this.skillUntil && this.t < this.skillUntil) {
      this.skillUntil = 0;
      if (i === this.skillLane) { this.add(30000, PBT.LANES[i], 140); this.msg('스킬 샷!', '+30,000', 1.4); Sound.play('mission'); }
    }
    if (this.lanes[i]) { this.add(500, PBT.LANES[i], 140); return; }
    this.lanes[i] = true; this.add(2000, PBT.LANES[i], 140); this.bonusBase += 1500; Sound.blip(740 + i * 80, 0.05, 0.9);
    if (this.lanes.every(x => x)) {
      this.laneDone++; this.progress('lanes', 1);
      this.mult = Math.min(5, this.mult + 1);
      this.kickLit = true;
      this.add(10000);
      this.msg(`보너스 ×${this.mult}`, '위쪽 레인 완성!', 1.3);
      after(500, () => { this.lanes = [false, false, false]; });
    }
  },
  /** 샷: 궤도 · 스피너 길 · 구멍 → 콤보 · 잭팟 */
  shot(kind, b) {
    const now = this.t;
    this.combo = now - this.lastShot < 4 ? this.combo + 1 : 1;
    this.lastShot = now;
    if (kind === 'orbit') { this.stats.orbit++; this.add(10000, 56, 420); this.bonusBase += 2000; this.progress('orbit', 1); Sound.blip(880, 0.08, 1); }
    if (this.combo >= 2) {
      const v = 5000 * Math.min(this.combo, 6);
      this.combos++; this.stats.combo++; this.add(v); this.msg(`콤보 ×${this.combo}`, `+${v.toLocaleString()}`, 1); this.progress('combo', 1);
    }
    if (this.multiball && kind !== 'saucer') {
      this.jackpots++; this.stats.jackpot++;
      const v = 100000 + 50000 * (this.jackpots - 1);
      this.add(v); this.msg('잭팟!', `+${v.toLocaleString()}`, 1.6); this.shake = 9; this.buzz(60);
      this.burst(b.x, b.y, '#ffd54f', 24); Sound.play('title');
    }
  },
  capture(b) {
    const C = PBT.SAUCER;
    b.st = 'hold'; b.x = C.x; b.y = C.y; b.vx = b.vy = 0;
    this.saucer = { b, until: this.t + 1.1, n: 1 };
    this.add(5000, C.x, C.y - 20); this.progress('saucer', 1); this.stats.saucer = (this.stats.saucer || 0) + 1; Sound.blip(330, 0.12, 1.2);
    this.shot('saucer', b);
    if (this.ebLit) { this.ebLit = false; this.extra++; this.msg('엑스트라 볼!', '이 공이 빠져도 한 번 더', 1.8); Sound.play('tier'); }
    if (this.lockLit && !this.multiball) {
      this.lockLit = false; this.locks++;
      if (this.locks >= 2) {                                      // 멀티볼: 잡힌 공 + 잠가 둔 공 2개 = 3볼
        this.locks = 0; this.multiball = true; this.jackpots = 0; this.progress('multi', 1);
        this.saucer.n = 3; this.saucer.until = this.t + 1.4;
        this.saveUntil = this.t + 14;
        this.msg('멀티볼!', '궤도 · 스피너로 잭팟!', 2); this.shake = 10; Sound.play('tier'); this.buzz(80);
      } else {
        this.msg('볼 잠금 1', '한 번 더 잠그면 멀티볼!', 1.6);
        this.saucer.until = this.t + 0.8; this.saucer.lockOne = true;
      }
    }
  },
  ejectSaucer() {
    const s = this.saucer, C = PBT.SAUCER;
    if (s.lockOne) {                                               // 잠긴 공은 안에 두고, 새 공을 발사대로
      this.balls = this.balls.filter(x => x !== s.b);
      this.saucer = null; this.newBall();
      return;
    }
    const kick = bb => { bb.st = 'free'; bb.x = C.x + 6; bb.y = C.y + 4; bb.vx = 300 + this.rnd() * 60; bb.vy = 330; };
    kick(s.b);
    this.saucerCool = this.t + 1.6;                                // 방금 나온 공이 바로 다시 잡히지 않게
    Sound.blip(260, 0.08, 1.1);
    s.n--;
    if (s.n > 0) {                                                 // 멀티볼: 0.45초마다 한 개씩 더
      const nb = { x: C.x, y: C.y, vx: 0, vy: 0, st: 'hold', trail: [], lane: -1, inO: false, inS: false, id: Math.random() };
      this.balls.push(nb);
      this.saucer = { b: nb, until: this.t + 0.45, n: s.n };
    } else this.saucer = null;
  },
  drain() {
    const gone = this.balls.filter(b => b.st === 'gone');
    this.balls = this.balls.filter(b => b.st !== 'gone');
    for (let i = 0; i < gone.length; i++) {
      if (this.t >= this.saveUntil) continue;
      this.msg('볼 세이브!', '공을 다시 쏴 드려요', 1.2); Sound.play('pop');       // 볼 세이브: 발사대로 (자동 발사)
      const p = PBT.PLUNGE, nb = { x: p.x, y: p.y, vx: 0, vy: 0, st: 'lane', trail: [], lane: -1, inO: false, inS: false, id: Math.random() };
      this.balls.push(nb);
      after(700 + i * 500, () => { if (this.over || nb.st !== 'lane') return; nb.st = 'free'; nb.vy = -2050; this.charging = false; this.charge = 0; });
    }
    if (this.multiball && this.balls.length <= 1) { this.multiball = false; this.msg('멀티볼 끝', `잭팟 ${this.jackpots}번`, 1.4); }
    if (!this.balls.length) this.endBall();
    else { this.hud(); }
    if (!this.multi) Sound.blip(110, 0.2, 1);
  },
  endBall() {
    if (this.over || this.state === 'bonus') return;
    this.state = 'bonus';
    for (const f of PBT.FLIPPERS) f.on = false;
    const bonus = this.bonusBase * this.mult;
    this.bonusShow = { base: this.bonusBase, mult: this.mult, total: bonus, t: 0 };
    Sound.play('bad');
    after(1700, () => {
      if (this.over) return;
      this.add(bonus);
      this.bonusBase = 0; this.mult = 1; this.bonusShow = null; this.state = 'play';
      this.lockLit = false; this.saveUntil = 0;
      if (this.extra > 0) { this.extra--; this.msg('한 번 더!', '엑스트라 볼', 1.4); this.newBall(); this.hud(); return; }
      if (this.ballNo >= 3) return void this.gameOver('게임 끝');
      this.ballNo++; this.newBall(); this.hud(); this.side();
      this.msg(`볼 ${this.ballNo}`, '길게 눌렀다 떼면 발사', 1.4);
    });
  },
  progress(k, n) {
    const m = PB_MISSIONS[this.missionI];
    if (!m || m.k !== k) return;
    this.mprog += n;
    const need = this.need(m);
    if (this.mprog >= need) {
      this.missionsDone++;
      const v = 20000 * this.level;
      this.add(v);
      this.msg('미션 클리어!', `${m.t(need)} · +${v.toLocaleString()}`, 1.8); Sound.play('mission');
      this.burst(270, 480, '#a99dff', 30);
      if (this.missionsDone % 3 === 0) { this.ebLit = true; after(1900, () => this.msg('엑스트라 볼 점등', '구멍에 넣으면 볼 +1', 1.6)); }
      this.missionI++; this.mprog = 0;
      if (this.missionI >= PB_MISSIONS.length) { this.missionI = 0; this.level++; after(1900, () => this.msg(`레벨 ${this.level}!`, '미션이 더 어려워져요', 1.6)); }
    }
    this.side();
  },
  need(m) { return Math.max(1, Math.round(m.n * (1 + 0.5 * (this.level - 1)))); },
  rank() { return PB_RANKS[Math.min(PB_RANKS.length - 1, Math.floor(this.missionsDone / 3))]; },
  /** 안드로이드: 짧은 진동 (손맛) — 너무 자주 울리지 않게 */
  buzz(ms) { const n = performance.now(); if (n - (this.bzT || 0) < 60) return; this.bzT = n; try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* 무시 */ } },
  msg(big, small, dur) { this.msgs.push({ big, small, t: 0, dur }); if (this.msgs.length > 3) this.msgs.shift(); },
  burst(x, y, col, n) { const R = Math.random; for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, s = 120 + R() * 380; this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.35 + R() * 0.35, col }); } },
  hud() {
    setStat('pinball', 'score', this.score.toLocaleString());
    setStat('pinball', 'ball', `${Math.min(3, this.ballNo)} / 3${this.extra ? ` +${this.extra}` : ''}`);
    if (!this.multi) setStat('pinball', 'best', Math.max(this.best, this.score).toLocaleString());
    if (this.multi && this.score !== this.lastSent) { this.lastSent = this.score; socket.emit('sr:score', this.score); }
    const n = performance.now();                    // 넓은 화면 양옆 패널은 0.25초마다 (기록 · 미션 숫자)
    if (n - (this.sideT || 0) > 250) { this.sideT = n; this.side(); }
  },
  /** 넓은 화면: 판 양옆에 미션 · 기록 */
  side() {
    const m = PB_MISSIONS[this.missionI], need = m ? this.need(m) : 1;
    $('#pb-l').innerHTML = `<h4>🎯 미션 <small>레벨 ${this.level}</small></h4>
      <div class="pb-mis"><b>${esc(m ? m.t(need) : '')}</b><div class="pb-bar"><i style="width:${Math.min(100, this.mprog / need * 100)}%"></i></div><small>${Math.min(this.mprog, need)} / ${need}</small></div>
      <p class="pb-rank">계급 <b>${this.rank()}</b> · 미션 ${this.missionsDone}개 깸</p>
      <ul class="pb-tips"><li>드롭 타깃 4개 → <b>잠금</b> 점등</li><li>구멍에 2번 잠그면 <b>멀티볼</b></li><li>멀티볼 중 궤도 · 스피너 = <b>잭팟</b></li><li>위쪽 레인 3개 → 보너스 <b>×${Math.min(5, this.mult + 1)}</b></li><li>4초 안에 연속 샷 = <b>콤보</b></li></ul>`;
    $('#pb-r').innerHTML = `<h4>🏆 기록</h4><div class="pb-big">${this.score.toLocaleString()}</div>
      <p class="pb-st">${this.multi ? '점수 대결 중' : `최고 ${Math.max(this.best, this.score).toLocaleString()}`}</p>
      <ul class="pb-tips"><li>범퍼 ${this.stats.bumper}번</li><li>타깃 ${this.stats.target}개</li><li>궤도 ${this.stats.orbit}번 · 스피너 ${this.stats.spin}바퀴</li><li>콤보 ${this.stats.combo}번 · 잭팟 ${this.stats.jackpot}번</li></ul>
      <p class="pb-keys">⌨️ ← → 또는 Z · / 플리퍼<br>Space 길게 눌렀다 떼면 발사</p>`;
  },
  gameOver(why) {
    if (this.over) return;
    this.over = true;
    for (const f of PBT.FLIPPERS) f.on = false;
    this.hud(); this.side();
    if (this.multi) { socket.emit('sr:score', this.score); socket.emit('sr:over'); setStatus('pinball', `${why}! ${this.score.toLocaleString()}점 — 결과를 기다리는 중…`); return; }
    const best = Math.max(this.best, this.score); store.set('best-pinball', best);
    const topM = Math.max(+store.get('pinball-missions', 0), this.missionsDone); store.set('pinball-missions', topM);
    const topRank = PB_RANKS[Math.min(PB_RANKS.length - 1, Math.floor(topM / 3))];
    after(900, () => showResult({
      title: this.score > this.best && this.best > 0 ? '🎉 신기록!' : '🎯 ' + why, subtitle: `점수 ${this.score.toLocaleString()} · 최고 점수 ${best.toLocaleString()}`,
      lines: [`미션 ${this.missionsDone}개 (계급 ${this.rank()}) · 콤보 ${this.stats.combo}번 · 잭팟 ${this.stats.jackpot}번 · 범퍼 ${this.stats.bumper}번`, `내 최고 계급: ${topRank} (한 판 미션 ${topM}개)`],
      solo: 'pinball', rec: { v: this.score },
    }));
  },

  /* ── 그리기 ── */
  COL: { outer: '#46e3ff', lane: '#46e3ff', guide: '#ff5fd2', sling: '#ffb547', slingK: '#ffd27a', gate: '#9effa0', post: '#ffffff', target: '#ff5d73', none: null },
  drawStatic() {
    const Q = this.Q, cv = document.createElement('canvas');
    cv.width = PB.W * Q; cv.height = PB.H * Q;
    const c = cv.getContext('2d');
    c.scale(Q, Q);
    const g = c.createLinearGradient(0, 0, 0, PB.H); g.addColorStop(0, '#120c2e'); g.addColorStop(0.5, '#0d1838'); g.addColorStop(1, '#0a0f24'); c.fillStyle = g; c.fillRect(0, 0, PB.W, PB.H);
    // 판 안쪽
    c.save(); c.beginPath(); c.moveTo(20, PB.H); c.lineTo(20, 262);
    for (let i = 0; i <= 44; i++) { const t = Math.PI - Math.PI * i / 44; c.lineTo(270 + 250 * Math.cos(t), 262 - 238 * Math.sin(t)); }
    c.lineTo(520, PB.H); c.closePath(); c.clip();
    const pf = c.createRadialGradient(270, 420, 40, 270, 520, 620); pf.addColorStop(0, '#24306e'); pf.addColorStop(0.6, '#15204d'); pf.addColorStop(1, '#0b1230'); c.fillStyle = pf; c.fillRect(0, 0, PB.W, PB.H);
    // 무늬: 빛살 · 격자 점
    c.globalAlpha = 0.07; c.strokeStyle = '#8fb3ff'; c.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; c.beginPath(); c.moveTo(254, 600); c.lineTo(254 + Math.cos(a) * 700, 600 + Math.sin(a) * 700); c.stroke(); }
    c.globalAlpha = 0.12; c.fillStyle = '#a7b8ff';
    for (let y = 40; y < PB.H; y += 32) for (let x = 30; x < 500; x += 32) c.fillRect(x, y, 2, 2);
    c.globalAlpha = 1;
    // 가운데 로고
    c.save(); c.translate(254, 640); c.rotate(-0.08);
    c.font = '900 46px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillText('PINBALL', 0, 0);
    c.font = '900 20px "Black Han Sans", sans-serif'; c.fillStyle = 'rgba(255,214,90,.12)'; c.fillText('미니게임 천국', 0, 34);
    c.restore();
    // 발사 길
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(488, 250, 32, PB.H);
    // 아랫부분 램프 자리 (보너스 배수 · 볼 세이브)
    c.font = '700 11px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    ['×2', '×3', '×4', '×5'].forEach((t, i) => { const x = 206 + i * 32; c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(x, 910, 10, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillText(t, x, 910); });
    c.restore();
    // 슬링샷 몸통
    for (const s of PBT.SLINGS) {
      c.beginPath(); c.moveTo(...s.A); c.lineTo(...s.B); c.lineTo(...s.C); c.closePath();
      const sg = c.createLinearGradient(s.A[0], s.A[1], s.C[0], s.C[1]); sg.addColorStop(0, '#5a2a00'); sg.addColorStop(1, '#2a1400');
      c.fillStyle = sg; c.fill();
    }
    // 벽 (네온)
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (const s of PBT.segs) {
        const col = this.COL[s.col]; if (!col || s.col === 'target') continue;
        c.strokeStyle = col; c.lineWidth = (s.r ? s.r * 2 : 4) + (pass ? 0 : 6);
        c.globalAlpha = pass ? 1 : 0.18;
        c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke();
      }
    }
    c.globalAlpha = 1;
    for (const p of PBT.circles) {
      if (p.col === 'bumper') continue;
      c.fillStyle = this.COL[p.col] || '#fff'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(p.x + 1, p.y + 1.5, p.r * 0.55, 0, 7); c.fill();
    }
    // 구멍 테두리 · 궤도 · 스피너 표시
    const S = PBT.SAUCER;
    c.fillStyle = '#05070f'; c.beginPath(); c.arc(S.x, S.y, S.r + 3, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.beginPath(); c.arc(S.x, S.y, S.r + 6, 0, 7); c.stroke();
    c.font = '900 12px "Black Han Sans", sans-serif'; c.fillStyle = 'rgba(255,255,255,.35)'; c.textAlign = 'center';
    c.save(); c.translate(56, 520); c.rotate(-Math.PI / 2); c.fillText('ORBIT', 0, 0); c.restore();
    c.save(); c.translate(450, 560); c.rotate(-Math.PI / 2); c.fillText('SPINNER', 0, 0); c.restore();
    c.fillText('LOCK', S.x, S.y + 34);
    return cv;
  },
  draw(dt) {
    const c = this.ctx, Q = this.Q;
    if (!c) return;
    const blink = Math.floor(this.t * 6) % 2 === 0;
    c.setTransform(Q, 0, 0, Q, 0, 0);
    let sx = 0, sy = 0;
    if (this.shake > 0.2) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.002, dt); }
    c.translate(sx, sy);
    c.drawImage(this.bg, 0, 0, PB.W, PB.H);
    // 위쪽 레인 램프
    PBT.LANES.forEach((x, i) => {
      const lit = this.lanes[i], skill = this.skillUntil === 0 && this.balls.some(b => b.st === 'lane') && i === this.skillLane;
      c.fillStyle = lit ? '#ffd54f' : skill && blink ? '#7cffb2' : 'rgba(255,255,255,.12)';
      c.beginPath(); c.arc(x, 96, 8, 0, 7); c.fill();
      if (lit || (skill && blink)) { c.fillStyle = lit ? 'rgba(255,213,79,.25)' : 'rgba(124,255,178,.25)'; c.beginPath(); c.arc(x, 96, 15, 0, 7); c.fill(); }
    });
    if (this.balls.some(b => b.st === 'lane') && !this.skillUntil) {
      c.font = '700 11px "Noto Sans KR", sans-serif'; c.fillStyle = 'rgba(124,255,178,.9)'; c.textAlign = 'center'; c.fillText('스킬 샷', PBT.LANES[this.skillLane], 178);
    }
    // 궤도 · 스피너 화살표 (잭팟 · 콤보 때 깜빡)
    const arrow = (x, y, on, col) => {
      c.fillStyle = on ? col : 'rgba(255,255,255,.1)';
      c.beginPath(); c.moveTo(x, y - 16); c.lineTo(x + 12, y + 6); c.lineTo(x - 12, y + 6); c.closePath(); c.fill();
    };
    const hot = this.multiball || (this.t - this.lastShot < 4 && this.combo >= 1);
    arrow(56, 600, hot && blink, this.multiball ? '#ffd54f' : '#7ef9ff');
    arrow(450, 610, hot && !blink, this.multiball ? '#ffd54f' : '#7ef9ff');
    // 보너스 배수 램프
    for (let i = 0; i < 4; i++) if (this.mult >= i + 2) { const x = 206 + i * 32; c.fillStyle = 'rgba(255,213,79,.85)'; c.beginPath(); c.arc(x, 910, 10, 0, 7); c.fill(); c.fillStyle = '#2b1d00'; c.font = '900 11px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`×${i + 2}`, x, 910); }
    // 킥백 램프 (왼쪽 아웃레인)
    c.save(); c.translate(39, 820); c.rotate(-Math.PI / 2); c.font = '900 11px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = this.kickLit ? (blink ? '#7cffb2' : 'rgba(124,255,178,.6)') : 'rgba(255,255,255,.12)'; c.fillText('KICKBACK', 0, 0); c.restore();
    // 볼 세이브 · 엑스트라 볼 램프
    c.font = '900 12px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (this.t < this.saveUntil && (this.saveUntil - this.t > 2 || blink)) { c.fillStyle = '#7cffb2'; c.fillText('BALL SAVE', 254, 952); }
    else if (this.extra) { c.fillStyle = '#ffd54f'; c.fillText('SHOOT AGAIN', 254, 952); }
    // 구멍 (잠금 · 엑스트라 볼 점등)
    const S = PBT.SAUCER;
    if (this.lockLit || this.ebLit) {
      c.strokeStyle = this.ebLit ? '#ffd54f' : '#ff5fd2'; c.lineWidth = blink ? 4 : 2;
      c.beginPath(); c.arc(S.x, S.y, S.r + 8, 0, 7); c.stroke();
      c.fillStyle = this.ebLit ? '#ffd54f' : '#ff5fd2'; c.font = '900 12px "Black Han Sans", sans-serif';
      c.fillText(this.ebLit ? 'EXTRA BALL' : `LOCK ${this.locks + 1}`, S.x, S.y - 30);
    }
    // 드롭 타깃
    for (const s of PBT.TARGETS) {
      const x = (s.ax + s.bx) / 2;
      if (s.on) {
        const tg = c.createLinearGradient(0, 512, 0, 528); tg.addColorStop(0, '#ff9aa6'); tg.addColorStop(1, '#d0102f');
        c.fillStyle = tg; c.fillRect(x - 13, 512, 26, 16); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x - 11, 514, 22, 3);
      } else { c.fillStyle = 'rgba(255,93,115,.18)'; c.fillRect(x - 13, 523, 26, 5); }
    }
    // 범퍼
    for (const b of PBT.BUMPERS) {
      const f = this.flash[b.id] || 0;
      const g = c.createRadialGradient(b.x - 7, b.y - 9, 4, b.x, b.y, b.r + 4);
      g.addColorStop(0, f > 0.1 ? '#ffffff' : '#9ef7ff'); g.addColorStop(0.55, f > 0.1 ? '#b5fbff' : '#1fb6d6'); g.addColorStop(1, '#0a3a5a');
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r + f * 4, 0, 7); c.fill();
      c.strokeStyle = f > 0.1 ? '#fff' : '#ff5fd2'; c.lineWidth = 4; c.beginPath(); c.arc(b.x, b.y, b.r - 6, 0, 7); c.stroke();
      if (f > 0.05) { c.fillStyle = `rgba(126,249,255,${f * 0.35})`; c.beginPath(); c.arc(b.x, b.y, b.r + 14 * f + 6, 0, 7); c.fill(); }
    }
    // 슬링샷 반짝
    for (const s of PBT.SLINGS) {
      const f = this.flash[s.id] || 0;
      if (f > 0.05) { c.strokeStyle = `rgba(255,240,180,${f})`; c.lineWidth = 7; c.beginPath(); c.moveTo(...s.C); c.lineTo(...s.A); c.stroke(); }
    }
    // 스피너
    const Sp = PBT.SPINNER, sw = Math.abs(Math.sin(this.spinA)) * 26 + 3;
    c.fillStyle = '#e8eefc'; c.fillRect(Sp.x - 32, Sp.y - 2, 64, 4);
    c.fillStyle = '#ffd54f'; c.fillRect(Sp.x - 30, Sp.y - sw / 2, 60, sw);
    // 플리퍼
    for (const f of PBT.FLIPPERS) {
      const tx = f.x + Math.cos(f.a) * f.L, ty = f.y + Math.sin(f.a) * f.L, n = [-(ty - f.y) / f.L, (tx - f.x) / f.L];
      c.beginPath();
      c.moveTo(f.x + n[0] * f.r1, f.y + n[1] * f.r1); c.lineTo(tx + n[0] * f.r2, ty + n[1] * f.r2);
      c.arc(tx, ty, f.r2, Math.atan2(n[1], n[0]), Math.atan2(n[1], n[0]) + Math.PI, f.side === 'L');
      c.lineTo(f.x - n[0] * f.r1, f.y - n[1] * f.r1);
      c.arc(f.x, f.y, f.r1, Math.atan2(-n[1], -n[0]), Math.atan2(-n[1], -n[0]) + Math.PI, f.side === 'L');
      c.closePath();
      c.fillStyle = f.on ? '#fff3c4' : '#e8eefc'; c.fill();
      c.lineWidth = 3; c.strokeStyle = f.on ? '#ffb547' : '#ff5fd2'; c.stroke();
      c.fillStyle = '#ff5fd2'; c.beginPath(); c.arc(f.x, f.y, 4, 0, 7); c.fill();
    }
    // 플런저 (발사대)
    const pl = 912 + PB.R + this.charge * 26;
    c.fillStyle = '#9aa7c7'; c.fillRect(497, pl, 14, PB.H - pl);
    c.fillStyle = '#ff5d73'; c.fillRect(493, pl, 22, 6);
    if (this.charging || this.charge > 0) {
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(524, 760, 10, 150);
      const k = this.charge, pg = c.createLinearGradient(0, 910, 0, 760); pg.addColorStop(0, '#7cffb2'); pg.addColorStop(1, '#ff5d73');
      c.fillStyle = pg; c.fillRect(524, 910 - 150 * k, 10, 150 * k);
    }
    // 공 (꼬리 + 금속 공)
    for (const b of this.balls) {
      if (b.st === 'free') { b.trail.push([b.x, b.y]); if (b.trail.length > 7) b.trail.shift(); } else b.trail = [];
      b.trail.forEach(([x, y], i) => { c.fillStyle = `rgba(160,220,255,${(i + 1) / b.trail.length * 0.18})`; c.beginPath(); c.arc(x, y, PB.R * (0.5 + i / b.trail.length * 0.5), 0, 7); c.fill(); });
      const g = c.createRadialGradient(b.x - 4, b.y - 5, 1, b.x, b.y, PB.R);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#dfe6f5'); g.addColorStop(1, '#5d6b8c');
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, PB.R, 0, 7); c.fill();
    }
    // 불꽃 · 점수
    this.fx = this.fx.filter(p => (p.t += dt) < p.life);
    for (const p of this.fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.col; c.fillRect(p.x - 2, p.y - 2, 4, 4); }
    c.globalAlpha = 1;
    this.pops = this.pops.filter(p => (p.t += dt) < 0.8);
    c.font = '900 15px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of this.pops) { c.globalAlpha = 1 - p.t / 0.8; c.fillStyle = '#fff'; c.fillText(p.s, p.x, p.y - p.t * 40); }
    c.globalAlpha = 1;
    for (const k in this.flash) { this.flash[k] -= dt * 4; if (this.flash[k] <= 0) delete this.flash[k]; }
    c.setTransform(Q, 0, 0, Q, 0, 0);
    // 점수 (판 위쪽)
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 30px "Black Han Sans", sans-serif'; c.fillStyle = '#fff'; c.fillText(this.score.toLocaleString(), 254, 62);
    c.font = '700 12px "Noto Sans KR", sans-serif'; c.fillStyle = 'rgba(200,215,255,.8)';
    c.fillText(`볼 ${Math.min(3, this.ballNo)}/3${this.extra ? ` +${this.extra}` : ''}${this.mult > 1 ? ` · 보너스 ×${this.mult}` : ''}${this.multiball ? ' · 멀티볼' : ''}`, 254, 86);
    // 미션 (아래)
    const m = PB_MISSIONS[this.missionI];
    if (m && !this.over) {
      const need = this.need(m);
      c.font = '700 11px "Noto Sans KR", sans-serif'; c.fillStyle = 'rgba(200,215,255,.8)';
      c.fillText(`🎯 ${m.t(need)} · ${Math.min(this.mprog, need)}/${need}`, 254, 932);
    }
    // 가운데 큰 글자
    this.msgs = this.msgs.filter(x => (x.t += dt) < x.dur);
    const top = this.msgs[this.msgs.length - 1];
    if (top) {
      const k = Math.min(1, top.t / 0.15), out = top.dur - top.t < 0.25 ? (top.dur - top.t) / 0.25 : 1, sc = 0.6 + 0.4 * k;
      c.save(); c.globalAlpha = Math.min(k, out); c.translate(254, 430); c.scale(sc, sc);
      c.fillStyle = 'rgba(8,10,30,.62)'; c.beginPath(); if (c.roundRect) c.roundRect(-190, -42, 380, top.small ? 84 : 62, 18); else c.rect(-190, -42, 380, top.small ? 84 : 62); c.fill();
      c.font = '900 34px "Black Han Sans", sans-serif'; c.fillStyle = '#ffd54f'; c.fillText(top.big, 0, top.small ? -12 : -11);
      if (top.small) { c.font = '700 14px "Noto Sans KR", sans-serif'; c.fillStyle = '#fff'; c.fillText(top.small, 0, 22); }
      c.restore();
    }
    // 끝난 공 보너스
    if (this.bonusShow) {
      const B = this.bonusShow; B.t += dt;
      c.fillStyle = 'rgba(5,8,22,.7)'; c.fillRect(0, 380, PB.W, 150);
      c.font = '900 26px "Black Han Sans", sans-serif'; c.fillStyle = '#ffd54f'; c.fillText('보너스', 254, 420);
      c.font = '900 30px "Black Han Sans", sans-serif'; c.fillStyle = '#fff';
      c.fillText(`${Math.round(B.base * Math.min(1, B.t / 0.8)).toLocaleString()} × ${B.mult} = ${Math.round(B.total * Math.min(1, B.t / 1.1)).toLocaleString()}`, 254, 470);
    }
    // 발사 안내
    if (this.ready() && !this.charging && !this.over) {
      c.font = '700 13px "Noto Sans KR", sans-serif'; c.fillStyle = blink ? '#7cffb2' : 'rgba(124,255,178,.55)';
      c.save(); c.translate(472, 820); c.rotate(-Math.PI / 2); c.fillText('길게 눌렀다 떼기 ▶', 0, 0); c.restore();
    }
    if (this.over) { c.fillStyle = 'rgba(5,8,22,.55)'; c.fillRect(0, 0, PB.W, PB.H); c.font = '900 40px "Black Han Sans", sans-serif'; c.fillStyle = '#fff'; c.fillText('GAME OVER', 254, 460); }
  },
};

/* ── 조작: 화면 왼쪽 · 오른쪽 어디든 (판 밖 빈 곳 포함 · 손가락 여러 개) ── */
TouchArea.add('pinball', { mouse: true, down() {}, move() {}, up() {} });      // 화면을 끌어도 페이지가 움직이지 않게 (body.tarea)
document.addEventListener('pointerdown', e => {
  if (S.screen !== 'pinball' || !TouchArea.pick(e) || Pinball.over) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  Pinball.ptr.set(e.pointerId, Pinball.sideAt(e));
  Pinball.fresh = true;
  Pinball.input();
}, { passive: true });
const pbUp = e => { if (Pinball.ptr.delete(e.pointerId)) Pinball.input(); };
document.addEventListener('pointerup', pbUp);
document.addEventListener('pointercancel', pbUp);
window.addEventListener('blur', () => { Pinball.ptr.clear(); Pinball.holdKeys.clear(); Pinball.charging = false; Pinball.charge = 0; for (const f of PBT.FLIPPERS) f.on = false; });
const PB_KEYS = { ArrowLeft: 'L', KeyZ: 'L', ShiftLeft: 'L', KeyA: 'L', ArrowRight: 'R', Slash: 'R', ShiftRight: 'R', KeyL: 'R', KeyD: 'R' };
register('pinball', {
  solo: () => Pinball.start({}), multi: d => Pinball.start({ seed: d.seed, seconds: d.seconds }), stop: () => { Pinball.over = true; Pinball.ptr.clear(); Pinball.holdKeys.clear(); },
  key: e => {
    if (e.repeat) return;
    if (!PB_KEYS[e.code] && !['Space', 'ArrowDown', 'Enter'].includes(e.code)) return;
    Pinball.holdKeys.add(e.code); Pinball.fresh = true; Pinball.input();
  },
  keyup: e => {
    if (Pinball.holdKeys.delete(e.code)) Pinball.input();
  },
});
window.addEventListener('resize', () => { if (isScreen('pinball') && Pinball.ctx && Math.round((window.devicePixelRatio || 1) * 2) / 2 !== Pinball.Q) Pinball.setupCanvas(); });
