/* =====================================================================
 *  🏎️ 드리프트 카트 — 위에서 내려다보는 카트 레이싱
 *  싱글: AI 카트 7대와 레이스 · 멀티: 각자 자기 카트를 화면에서 몰고, 서버(games/kart.js)는
 *  위치 · 아이템 · 골인 순서를 서로에게 전달해요. 맞았는지는 맞은 사람 화면이 판정합니다.
 *  조작: 방향키/WASD 운전 · Shift(스페이스) 누른 채 꺾으면 드리프트 · Ctrl/E 아이템 · R 트랙으로 복귀
 * ===================================================================== */
const KT = {
  STEP: 1 / 120, MAX: 520, ACC: 430, BRAKE: 950, REV: 170, COAST: 0.45,
  TURN: 2.7, DRIFT_TURN: 3.5, GRIP: 14, DRIFT_GRIP: 5, R: 14,
  OFF: 0.5,                                   // 잔디 · 눈 · 모래 위 최고 속도 비율
  N2O: 1.5, N2O_T: 1.7,                       // 부스터: 최고 속도 ×1.5, 1.7초
  DRIFT_LV: [0.55, 1.2], MINI: [1, 1.2, 1.3], MINI_T: [0, 0.45, 0.85],   // 드리프트를 오래 하면 놓을 때 짧은 대시
  GAUGE: 34,                                  // 스피드전: 드리프트 1초에 게이지 %
  KMH: 0.3,
  COLORS: ['#ff4757', '#3d8bff', '#ffc93c', '#2ed573', '#a55eea', '#ff8a3d', '#1fd1e0', '#ff6bb5'],
  AI_NAMES: ['번개', '질주', '토네이도', '로켓', '은하', '태풍', '불꽃'],
  ITEM_NAME: { banana: '바나나', balloon: '물풍선', missile: '미사일', shield: '실드', boost: '부스터' },
};
const KT_THEMES = {
  grass: { ground: '#4f9e43', speck: ['#468f3b', '#5bab4d', '#3f8636', '#63b455'], runoff: '#79c25c', wall: '#23262e', wall2: '#e84a3f',
    curbA: '#f7f7f7', curbB: '#e84a3f', road: '#4b505b', edge: '#f2f2f2', dash: 'rgba(255,255,255,.32)', skid: 'rgba(16,16,20,.30)', dust: 'rgba(120,96,60,.55)' },
  ice: { ground: '#e6f2fb', speck: ['#d3e6f4', '#f7fbff', '#cbe0f1', '#dbebf8'], runoff: '#cde4f5', wall: '#8cc4ea', wall2: '#f4fbff',
    curbA: '#ffffff', curbB: '#3d8bff', road: '#8ec3e4', edge: '#ffffff', dash: 'rgba(255,255,255,.6)', skid: 'rgba(255,255,255,.6)', dust: 'rgba(255,255,255,.8)' },
  sand: { ground: '#e3bf78', speck: ['#d8b06a', '#ecce90', '#d2a65f', '#efd59c'], runoff: '#d3a964', wall: '#7f5230', wall2: '#c7884e',
    curbA: '#ffffff', curbB: '#ff7f32', road: '#57555c', edge: '#ffe9b0', dash: 'rgba(255,240,200,.38)', skid: 'rgba(25,20,15,.32)', dust: 'rgba(205,165,100,.7)' },
};
/** 트랙: 중심선 조절점(이 순서로 달려요) · 폭 · 바깥 여유(벽까지) · 접지력 */
const KART_TRACKS = [
  { id: 'sunny', name: '햇살 서킷', desc: 'S자 코너와 헤어핀 · 기본 코스', theme: 'grass', w: 170, run: 70, grip: 1,
    pts: [[800, 2300], [2000, 2300], [2900, 2250], [3400, 1900], [3500, 1300], [3200, 900], [2700, 900], [2400, 1300], [1900, 1500], [1500, 1200], [1600, 700], [1300, 350], [700, 400], [350, 900], [400, 1700], [550, 2150]] },
  { id: 'ice', name: '얼음 계곡', desc: '미끄러운 빙판 · 좁은 헤어핀', theme: 'ice', w: 156, run: 62, grip: 0.55,
    pts: [[700, 1900], [1700, 1900], [2300, 1800], [2600, 1450], [2400, 1100], [1900, 1050], [1700, 750], [2000, 450], [2700, 400], [3200, 650], [3300, 1300], [3200, 2100], [2800, 2450], [1800, 2500], [900, 2450], [450, 2200]] },
  { id: 'desert', name: '사막 하이웨이', desc: '긴 직선과 시케인 · 초고속', theme: 'sand', w: 180, run: 80, grip: 0.9,
    pts: [[900, 2400], [2400, 2400], [3600, 2350], [4300, 2000], [4450, 1300], [4100, 800], [3500, 700], [3100, 1000], [2700, 800], [2200, 650], [1300, 600], [600, 800], [350, 1500], [500, 2150]] },
];

/* ─── 작은 도구 ─── */
function ktRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ktWrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const ktFmt = t => { if (t == null || !isFinite(t)) return '-:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
function ktShade(hex, f) {
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('');
}
function ktRR(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/** 구심 캐트멀-롬 곡선 위의 점 (조절점 사이를 부드럽게) */
function ktCR(p0, p1, p2, p3, t) {
  const tj = (ti, a, b) => ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) + 1e-6;
  const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3), u = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => [a[0] * (tb - u) / (tb - ta) + b[0] * (u - ta) / (tb - ta), a[1] * (tb - u) / (tb - ta) + b[1] * (u - ta) / (tb - ta)];
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}

/* ─── 트랙 만들기: 중심선을 20 간격으로 고르게 나누고, 출발선 · 출발 칸 · 아이템 상자 · 장식을 정해요 ─── */
function ktBuild(def, idx) {
  const P = def.pts.map(([x, y]) => [x * 1.35, y * 1.35]), n = P.length, dense = [];   // 조절점은 작게 적고 1.35배로 키워요 (한 바퀴 약 25초)
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let j = 0; j < 30; j++) dense.push(ktCR(p0, p1, p2, p3, j / 30));
  }
  const sx = P[0][0] + (P[1][0] - P[0][0]) * 0.45, sy = P[0][1] + (P[1][1] - P[0][1]) * 0.45;
  let si = 0, bd = Infinity;
  dense.forEach((p, i) => { const d = (p[0] - sx) ** 2 + (p[1] - sy) ** 2; if (d < bd) { bd = d; si = i; } });
  const D = dense.slice(si).concat(dense.slice(0, si)), M = D.length, cum = [0];
  for (let i = 1; i <= M; i++) { const a = D[i - 1], b = D[i % M]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const len = cum[M], N = Math.round(len / 20), sp = len / N, pts = [];
  for (let i = 0, j = 0; i < N; i++) {
    const s = i * sp; while (j < M - 1 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1), a = D[j], b = D[(j + 1) % M];
    pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  const ang = [];
  for (let i = 0; i < N; i++) { const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N]; ang.push(Math.atan2(b[1] - a[1], b[0] - a[0])); }
  const half = def.w / 2, lim = half + def.run;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [x, y] of pts) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  const T = { def, idx, name: def.name, theme: KT_THEMES[def.theme], pts, N, sp, len, ang, w: def.w, half, run: def.run, lim, grip: def.grip, bx0, by0, bx1, by1 };
  // 출발 칸 (출발선 뒤 2줄, 엇갈리게)
  T.grid = [];
  for (let i = 0; i < 8; i++) {
    const row = Math.floor(i / 2), col = i % 2, s = len - 66 - row * 58 - col * 24, p = ktAt(T, s), lat = (col ? 1 : -1) * half * 0.42;
    T.grid.push({ x: p.x + p.nx * lat, y: p.y + p.ny * lat, a: p.a, s });
  }
  // 아이템 상자 줄 (아이템전)
  T.boxes = [];
  for (const f of [0.2, 0.47, 0.74]) { const s = len * f, p = ktAt(T, s); for (const l of [-0.6, -0.2, 0.2, 0.6]) T.boxes.push({ x: p.x + p.nx * l * half, y: p.y + p.ny * l * half, s }); }
  // 장식 (트랙 바깥에만)
  const rng = ktRng(9173 + idx * 7919), deco = [], th = def.theme;
  const far = (x, y) => { let m = Infinity; for (let i = 0; i < N; i += 3) { const d = (x - pts[i][0]) ** 2 + (y - pts[i][1]) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
  // 관중석: 출발 직선 바깥쪽
  if (th !== 'ice') {
    const p = ktAt(T, len * 0.004 + 140);
    for (const side of [1, -1]) {
      const cx = p.x + p.nx * (lim + 70) * side, cy = p.y + p.ny * (lim + 70) * side;
      if (far(cx, cy) > lim + 55) { deco.push({ t: 'stand', x: cx, y: cy, a: p.a, r: 230, v: 0 }); break; }
    }
  }
  const TYPES = { grass: [['tree', 0.55], ['bush', 0.25], ['flower', 0.12], ['tires', 0.08]], ice: [['pine', 0.58], ['iceblock', 0.18], ['snowrock', 0.18], ['snowman', 0.06]], sand: [['cactus', 0.4], ['rock', 0.32], ['palm', 0.16], ['drybush', 0.12]] }[th];
  const SIZE = { tree: [34, 58], bush: [16, 26], flower: [10, 16], tires: [14, 18], pine: [30, 50], iceblock: [18, 30], snowrock: [18, 32], snowman: [16, 18], cactus: [16, 26], rock: [16, 34], palm: [34, 48], drybush: [12, 20] };
  for (let tries = 0; deco.length < 260 && tries < 9000; tries++) {
    const x = bx0 - 700 + rng() * (bx1 - bx0 + 1400), y = by0 - 700 + rng() * (by1 - by0 + 1400);
    let u = rng(), t = TYPES[0][0];
    for (const [k, w] of TYPES) { if (u < w) { t = k; break; } u -= w; }
    const [r0, r1] = SIZE[t], r = r0 + rng() * (r1 - r0), dist = far(x, y);
    if (dist < lim + 34 + r) continue;
    if ((t === 'tires' || t === 'flower') && dist > lim + 200) continue;
    if (deco.some(d => (d.x - x) ** 2 + (d.y - y) ** 2 < (d.r + r + 6) ** 2)) continue;
    deco.push({ t, x, y, r, v: rng(), a: rng() * 6.28 });
  }
  T.deco = deco;
  return T;
}
const KT_CACHE = {};
const ktTrack = i => KT_CACHE[i] || (KT_CACHE[i] = ktBuild(KART_TRACKS[i], i));
/** 진행 거리 s 위치의 점 · 방향 · 법선(진행 방향 오른쪽) */
function ktAt(T, s) {
  s = ((s % T.len) + T.len) % T.len;
  const f = s / T.sp, i = Math.floor(f) % T.N, j = (i + 1) % T.N, u = f - Math.floor(f), a = T.pts[i], b = T.pts[j];
  const an = T.ang[i] + ktWrap(T.ang[j] - T.ang[i]) * u;
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, a: an, nx: -Math.sin(an), ny: Math.cos(an) };
}
/** s0 → s1 사이에 트랙이 꺾이는 각도 합 (+ 오른쪽) */
function ktTurn(T, s0, s1) {
  let i = Math.floor((((s0 % T.len) + T.len) % T.len) / T.sp) % T.N, sum = 0;
  const n = Math.max(1, Math.round((s1 - s0) / T.sp));
  for (let q = 0; q < n; q++) { const j = (i + 1) % T.N; sum += ktWrap(T.ang[j] - T.ang[i]); i = j; }
  return sum;
}
/** 가장 가까운 중심선 구간 (hint 근처만 찾아서 지름길 · 순간이동을 막아요) */
function ktLocate(T, x, y, hint) {
  const N = T.N, full = hint == null, cnt = full ? N : 13, st = full ? 0 : hint - 6;
  let best = Infinity, bi = 0, bt = 0;
  for (let q = 0; q < cnt; q++) {
    const i = ((st + q) % N + N) % N, a = T.pts[i], b = T.pts[(i + 1) % N], ex = b[0] - a[0], ey = b[1] - a[1];
    let t = ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a[0] + ex * t, py = a[1] + ey * t, d2 = (x - px) ** 2 + (y - py) ** 2;
    if (d2 < best) { best = d2; bi = i; bt = t; }
  }
  const a = T.pts[bi], b = T.pts[(bi + 1) % N], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1;
  const px = a[0] + ex * bt, py = a[1] + ey * bt;
  return { i: bi, s: (bi + bt) * T.sp, d: (x - px) * (-ey / L) + (y - py) * (ex / L), px, py };
}

/* ─── 화면 ─── */
makeScreen('kart', {
  title: '🏎️ 드리프트 카트',
  status: TOUCH ? '왼손 엄지 조이스틱으로 조종 · 오른손 엄지 드리프트 · 아이템 · 가속은 자동' : '방향키/WASD 운전 · Shift 누른 채 꺾으면 드리프트 · Ctrl/E 아이템 · R 트랙 복귀',
  stats: [['best', '최고 기록']],
  body: `<div class="kt-stage" id="kt-stage"><canvas id="kt-cv"></canvas><div class="kt-setup hidden" id="kt-setup"></div></div>`,
});
$('#scr-kart').dataset.fitOverflow = 'ok';   // 휴대폰 가로에서 무대가 패드 사이까지 일부러 내려가요 → 화면 맞춤이 넘친 것으로 보지 않게
LOBBY_OPTIONS.kart = [
  { key: 'ktMode', label: '모드', def: 'speed', values: [['speed', '스피드전'], ['item', '아이템전']] },
  { key: 'ktTrack', label: '트랙', def: 0, values: [[0, '햇살 서킷'], [1, '얼음 계곡'], [2, '사막 하이웨이'], [-1, '랜덤']] },
  { key: 'ktLaps', label: '바퀴 수', def: 3, values: [[1, '1바퀴'], [2, '2바퀴'], [3, '3바퀴'], [5, '5바퀴']] },
];
const ktGuard = e => { e.preventDefault(); e.returnValue = ''; };   // 레이스 중 Ctrl+W 같은 실수로 창이 닫히지 않게

const Kart = {
  R: null, cv: null, c: null, W: 0, H: 0, dpr: 1, pat: {}, debug: { autopilot: false },
  q: 2, ft: null, qT: 0,                                            // 그림 품질: 느린 컴퓨터면 자동으로 낮춰요 (2 → 1 → 0)
  cfg: { mode: 'speed', track: 0, laps: 3, stick: 'dir' },        // stick: 휴대폰 조이스틱 — dir 가고 싶은 방향 · wheel 좌우 핸들

  /* ═════════ 레이스 준비 ═════════ */
  newRace({ track, mode, laps, multi = false, attract = false }) {
    const T = ktTrack(track);
    return {
      T, mode, laps, multi, attract, karts: [], hz: [], hzN: 0, boxes: T.boxes.map(b => ({ ...b, hide: 0, rot: Math.random() * 6 })),
      fx: [], skid: [], msgs: [], t: 0, cd: attract ? 0 : 3.6, go: attract, acc: 0, finN: 0, lapTimes: [], lapStart: 0,
      cam: null, shake: 0, over: false, endIn: null, rankT: 0, order: [], me: null, banner: null, hurry: null, wrongT: 0,
    };
  },
  makeKart(R, id, name, slot, opt = {}) {
    const g = R.T.grid[slot % 8], color = KT.COLORS[slot % 8];
    const k = {
      id, name, slot, color, c1: ktShade(color, 0.32), c2: ktShade(color, -0.38), x: g.x, y: g.y, a: g.a, vx: 0, vy: 0, steer: 0,
      drift: 0, driftT: 0, driftCD: 0, boost: 0, boostPow: 1, gauge: 0, items: [], itemSpin: 0, holdT: 0, shield: 0, stun: 0, trap: 0, inv: 0, spin: 0, boom: 0,
      seg: 0, s: g.s, d: 0, lap: 0, cp: false, fin: null, finRank: 0, pos: slot + 1, perf: 1, lane: 0, laneGoal: 0, laneT: 0, stuckT: 0, th0: null,
      ai: false, local: false, remote: false, snaps: null, rl: null, rr: null, wallN: 0, resp: 0,
    };
    k.seg = ktLocate(R.T, k.x, k.y).i;
    return Object.assign(k, opt);
  },
  /** AI 7대 + (있으면) 나 */
  fillAI(R, n, from) {
    const perfs = shuffle([0.99, 0.98, 0.97, 0.96, 0.95, 0.94, 0.93]);
    for (let i = 0; i < n; i++) R.karts.push(this.makeKart(R, 'ai' + i, KT.AI_NAMES[i % 7], from + i, { ai: true, local: true, perf: perfs[i % 7] }));
  },

  /* ═════════ 싱글: 설정 화면 (뒤에서 AI끼리 달리는 모습) → 출발 ═════════ */
  solo() {
    stopLocal();
    const st = store.get('kt_cfg', '');
    try { if (st) Object.assign(this.cfg, JSON.parse(st)); } catch { /* 저장된 설정이 깨졌으면 기본값 */ }
    this.cfg.track = clamp(+this.cfg.track || 0, 0, KART_TRACKS.length - 1);
    if (![1, 2, 3, 5].includes(+this.cfg.laps)) this.cfg.laps = 3;
    if (!['speed', 'item'].includes(this.cfg.mode)) this.cfg.mode = 'speed';
    show('kart');
    this.mount();
    this.renderSetup();
    this.attract();
  },
  attract() {
    const R = this.R = this.newRace({ track: this.cfg.track, mode: this.cfg.mode, laps: 99, attract: true });
    this.fillAI(R, 8, 0);
    R.me = R.karts[0];
    this.prep(R);
    this.loop();
  },
  renderSetup() {
    const s = this.cfg, el = $('#kt-setup');
    el.classList.remove('hidden');
    el.innerHTML = `<div class="kt-card">
      <h3>${icon('steering-wheel')}레이스 준비</h3>
      <div class="kt-sec"><small>모드</small><div class="kt-seg">${[['speed', '스피드전', '드리프트로 부스터를 모아요'], ['item', '아이템전', '아이템 상자로 역전!']].map(([v, n, d]) =>
        `<button class="kt-opt ${s.mode === v ? 'on' : ''}" data-act="ktCfg" data-k="mode" data-v="${v}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
      <div class="kt-sec"><small>트랙</small><div class="kt-tracks">${KART_TRACKS.map((t, i) =>
        `<button class="kt-track ${s.track === i ? 'on' : ''}" data-act="ktCfg" data-k="track" data-v="${i}"><canvas width="240" height="150" data-kt-prev="${i}"></canvas><b>${t.name}</b><small>${t.desc}</small><em>${this.bestText(i, s.laps, s.mode)}</em></button>`).join('')}</div></div>
      <div class="kt-sec"><small>바퀴 수</small><div class="kt-seg">${[1, 2, 3, 5].map(n =>
        `<button class="kt-opt sm ${+s.laps === n ? 'on' : ''}" data-act="ktCfg" data-k="laps" data-v="${n}"><b>${n}바퀴</b></button>`).join('')}</div></div>
      ${TOUCH ? `<div class="kt-sec kt-stick"><small>조이스틱 (왼손 엄지)</small><div class="kt-seg">${[['dir', '방향 조종', '가고 싶은 쪽으로 밀어요'], ['wheel', '핸들 조종', '좌우로 밀면 핸들처럼']].map(([v, n, d]) =>
        `<button class="kt-opt ${(s.stick === 'wheel' ? 'wheel' : 'dir') === v ? 'on' : ''}" data-act="ktCfg" data-k="stick" data-v="${v}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>` : ''}
      <button class="btn good kt-go" data-act="ktGo">${icon('flag-3')}<span>출발!</span></button>
      <p class="kt-keys">${TOUCH ? '<b>왼손 엄지</b> 조이스틱(아무 데나 대고 밀기) · <b>오른손 엄지</b> 드리프트 · 아이템 · 브레이크 · 가속은 자동<br>드리프트 버튼을 누른 채 꺾고, 색이 바뀌면 놓아서 순간 대시! 출발 신호 직전에 조이스틱을 잡으면 출발 부스터!' : '<b>↑</b> 가속 · <b>↓</b> 브레이크 · <b>← →</b> 핸들 · <b>Shift</b> 누른 채 꺾으면 드리프트 · <b>Ctrl / E</b> 아이템 · <b>R</b> 트랙 복귀<br>드리프트를 길게 하고 놓으면 순간 대시! 출발 신호 직전에 가속을 누르면 출발 부스터!'}</p>
    </div>`;
    $$('#kt-setup [data-kt-prev]').forEach(cv => this.drawPreview(cv, ktTrack(+cv.dataset.ktPrev)));
    setStat('kart', 'best', this.bestText(s.track, s.laps, s.mode, true));
  },
  bestKey: (i, laps, mode) => `kt_best_${KART_TRACKS[i].id}_${laps}_${mode}`,
  bestText(i, laps, mode, bare) { const v = +store.get(this.bestKey(i, laps, mode), 0); return v ? (bare ? '' : '최고 ') + ktFmt(v / 1000) : bare ? '-' : '기록 없음'; },
  startSolo() {
    const s = this.cfg;
    store.set('kt_cfg', JSON.stringify(s));
    stopLocal();
    S.solo = 'kart';
    $('#kt-setup').classList.add('hidden');
    const R = this.R = this.newRace({ track: s.track, mode: s.mode, laps: +s.laps });
    const meSlot = 7;                                              // 나는 맨 뒤에서 출발 (추월하는 재미!)
    R.me = this.makeKart(R, 'me', nick(), meSlot, { local: true });
    this.fillAI(R, 7, 0);
    R.karts.push(R.me);
    this.prep(R);
    setStat('kart', 'best', this.bestText(s.track, s.laps, s.mode, true));
    window.addEventListener('beforeunload', ktGuard);
    this.loop();
  },

  /* ═════════ 멀티: 서버가 알려준 출발 순서대로 ═════════ */
  startMulti(d) {
    stopLocal();
    show('kart');
    this.mount();
    $('#kt-setup').classList.add('hidden');
    const R = this.R = this.newRace({ track: clamp(+d.track || 0, 0, 2), mode: d.mode === 'item' ? 'item' : 'speed', laps: clamp(+d.laps || 3, 1, 9), multi: true });
    R.cd = Math.max(1, d.delay / 1000);
    d.grid.forEach(([id, name], i) => {
      const k = this.makeKart(R, id, name, i);
      if (id === S.myId) { k.local = true; R.me = k; } else { k.remote = true; k.snaps = []; }
      R.karts.push(k);
    });
    if (!R.me) R.me = R.karts[0];                                    // (구경꾼이면 1번 카트를 따라가요)
    this.prep(R);
    setStat('kart', 'best', this.bestText(R.T.idx, R.laps, R.mode, true));
    renderScores();
    window.addEventListener('beforeunload', ktGuard);
    every(50, () => this.send());
    this.loop();
  },
  prep(R) {
    const me = R.me;
    R.cam = { x: me.x + Math.cos(me.a) * 120, y: me.y + Math.sin(me.a) * 120, z: this.baseZoom() };
    this.rankAll();
    this.patterns(R.T.theme);
    R.mm = null;
    if (document.fonts && document.fonts.load) document.fonts.load('20px "Black Han Sans"').catch(() => {});
  },
  stop() {
    this.R = null;
    window.removeEventListener('beforeunload', ktGuard);
    if (TOUCH) KTouch.sync();                                     // 조작 버튼 숨기고 누르던 것 모두 놓기
  },
  loop() {
    gameLoop((dt, now) => {
      const R = this.R; if (!R) return;
      const t0 = performance.now();
      if (!this.fitted || this.cv.clientWidth !== this.W || this.moved()) this.fit();
      R.acc = Math.min(R.acc + dt, 0.1);
      while (R.acc >= KT.STEP) { R.acc -= KT.STEP; this.tick(KT.STEP); if (this.R !== R) return; }
      if (R.multi) this.interp(now, dt);
      this.effects(dt);
      this.render(now);
      if (TOUCH) KTouch.sync();
      const w = performance.now() - t0;
      this.ft = this.ft == null ? w : this.ft * 0.93 + w * 0.07;
      if (this.ft > 19 && this.q > 0 && now - this.qT > 2000) { this.q--; this.qT = now; this.ft = null; if (this.q === 0) this.fitted = false; }
    });
  },

  /* ═════════ 한 걸음 (1/120초) ═════════ */
  tick(dt) {
    const R = this.R, T = R.T;
    if (!R.go) {
      R.cd -= dt;
      const me = R.me;
      if (me.local && !me.ai) { const th = TOUCH ? !!KTouch.stick || held('ArrowUp', 'KeyW') : this.input(me).throttle > 0; if (TOUCH) this.input(me); if (th && me.th0 == null) me.th0 = R.cd; if (!th) me.th0 = null; }
      if (R.cd <= 0) {
        R.go = true; R.t = 0;
        for (const k of R.karts) {
          if (!k.local) continue;
          const good = k.ai ? Math.random() < 0.45 : k.th0 != null && k.th0 <= 0.6;
          if (good) { k.boost = 0.9; k.boostPow = 1.35; if (k === me) this.flash('출발 부스터!', '#7cf2ff'); }
        }
      }
      return;
    }
    R.t += dt;
    for (const k of R.karts) {
      if (!k.local) continue;
      if (k.driftCD > 0) k.driftCD -= dt;
      const inp = k.ai || (k === R.me && this.debug.autopilot) ? this.ai(k, dt) : this.input(k);
      this.phys(k, inp, dt);
      if (R.mode === 'item' && (k.ai || (k === R.me && this.debug.autopilot) || k.fin != null)) this.aiItems(k, dt);
      // 걸려서 못 움직이면 트랙으로 (AI · 자동 주행)
      const sp = Math.hypot(k.vx, k.vy), auto = k.ai || this.debug.autopilot || k.fin != null;
      if (sp < (auto ? 30 : 25) && k.stun <= 0 && k.trap <= 0) {
        k.stuckT += dt;
        if (auto && k.stuckT > 1.6) this.respawn(k);
        else if (!auto && k.stuckT > 2.4) { k.stuckT = -4; if (TOUCH) { this.respawn(k); if (k === R.me) this.flash('트랙으로 돌아왔어요', '#ffffff'); } else this.flash('R 키를 누르면 트랙으로 돌아가요', '#ffffff'); }
      } else if (k.stuckT > 0) k.stuckT = 0;
    }
    this.bump();
    this.hazards(dt);
    if (R.mode === 'item') this.boxes(dt);
    if ((R.rankT -= dt) <= 0) { R.rankT = 0.2; this.rankAll(); if (!R.multi && !R.attract) this.rubber(); }
    // 역주행 알림
    const me = R.me;
    if (me.local && me.fin == null) {
      const p = ktAt(T, me.s), along = me.vx * Math.cos(p.a) + me.vy * Math.sin(p.a);
      R.wrongT = along < -40 ? R.wrongT + dt : Math.max(0, R.wrongT - dt * 2);
    }
    if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 2.5);
    for (const m of R.msgs) m.t -= dt;
    R.msgs = R.msgs.filter(m => m.t > 0);
    if (R.hurry != null) R.hurry -= dt;
    // 싱글: 내가 골인하면 잠깐 뒤 결과 (AI가 다 들어오면 바로)
    if (!R.multi && !R.attract) {
      const lead = R.karts.find(k => k.finRank === 1);
      if (R.endIn == null && lead && lead !== me && R.t - lead.fin > 45) R.endIn = 0;
      if (R.endIn != null) { R.endIn -= dt; if (R.endIn <= 0 || R.karts.every(k => k.fin != null)) this.endSolo(); }
    }
  },
  input(k) {
    const brake = held('ArrowDown', 'KeyS'), acc = held('ArrowUp', 'KeyW') || (TOUCH && !brake);
    let dir = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
    if (TOUCH && k === this.R.me) { const js = KTouch.steer(k, this.viewRot); if (js != null) dir = js; }      // 휴대폰: 조이스틱 (아날로그)
    k.steer += (dir - k.steer) * Math.min(1, KT.STEP * (dir === 0 ? 16 : 10));
    return { throttle: brake ? -1 : acc ? 1 : 0, steer: k.steer, drift: held('ShiftLeft', 'ShiftRight', 'Space') };
  },
  phys(k, inp, dt) {
    const R = this.R, T = R.T;
    if (k.inv > 0) k.inv -= dt;
    if (k.shield > 0) k.shield -= dt;
    if (k.itemSpin > 0) k.itemSpin -= dt;
    if (k.boom > 0) k.boom -= dt;
    const off = Math.abs(k.d) > T.half + 4, ca = Math.cos(k.a), sa = Math.sin(k.a);
    let vf = k.vx * ca + k.vy * sa, vr = -k.vx * sa + k.vy * ca;
    if (k.stun > 0 || k.trap > 0) {
      if (k.stun > 0) { k.stun -= dt; k.spin += dt * 13; if (k.stun <= 0) k.spin = 0; }
      if (k.trap > 0) k.trap -= dt;
      const damp = Math.exp(-(k.trap > 0 ? 6 : 2) * dt); vf *= damp; vr *= damp;
      k.drift = 0; k.boost = 0; k.boostPow = 1;
    } else {
      let maxSp = KT.MAX * k.perf * (off ? KT.OFF : 1);
      if (k.boost > 0) {
        k.boost -= dt; maxSp = KT.MAX * k.perf * k.boostPow * (off ? 0.8 : 1);
        if (vf < maxSp) vf += 1300 * dt;
        if (k.boost <= 0) k.boostPow = 1;
      }
      const th = inp.throttle;
      if (th > 0) { if (vf < maxSp) vf += KT.ACC * th * (1.15 - 0.75 * Math.max(0, vf) / maxSp) * dt; }
      else if (th < 0) { if (vf > 15) vf -= KT.BRAKE * -th * dt; else vf = Math.max(-KT.REV, vf - KT.ACC * 0.7 * dt); }
      else vf -= vf * KT.COAST * dt;
      if (vf > maxSp) vf -= (vf - maxSp) * Math.min(1, 2.6 * dt);
      if (!k.drift && inp.drift && Math.abs(inp.steer) > 0.3 && vf > KT.MAX * 0.36 && k.driftCD <= 0) { k.drift = Math.sign(inp.steer); k.driftT = 0; k.a += k.drift * 0.05; }
      if (k.drift) {
        if (!inp.drift || vf < KT.MAX * 0.2) this.endDrift(k, vf);
        else {
          k.driftT += dt;
          k.a += k.drift * KT.DRIFT_TURN * (0.62 + 0.38 * clamp(inp.steer * k.drift, -1, 1)) * dt;
          if (R.mode === 'speed') this.addGauge(k, KT.GAUGE * dt * Math.min(1, vf / KT.MAX));
          vf -= vf * 0.06 * dt;
        }
      }
      if (!k.drift) {
        const sf = Math.min(1, Math.abs(vf) / 140) * (vf < 0 ? -1 : 1);
        k.a += inp.steer * KT.TURN * sf * (1 - 0.22 * Math.min(1, Math.abs(vf) / KT.MAX)) * dt;
      }
      const grip = k.drift ? KT.DRIFT_GRIP * (0.75 + 0.25 * T.grip) : KT.GRIP * T.grip * (off ? 0.85 : 1);
      const rem = vr * (1 - Math.exp(-grip * dt));
      vr -= rem;
      vf += (vf < 0 ? -1 : 1) * Math.abs(rem) * (k.drift ? 0.97 : 0.86);
    }
    k.vx = ca * vf - sa * vr; k.vy = sa * vf + ca * vr;
    k.x += k.vx * dt; k.y += k.vy * dt;
    this.locate(k);
  },
  endDrift(k, vf, crash) {
    const lv = crash ? 0 : k.driftT >= KT.DRIFT_LV[1] ? 2 : k.driftT >= KT.DRIFT_LV[0] ? 1 : 0;
    if (lv && vf > 0) { k.boost = Math.max(k.boost, KT.MINI_T[lv]); if (k.boostPow < KT.MINI[lv]) k.boostPow = KT.MINI[lv]; k.dash = 0.3; }
    k.drift = 0; k.driftT = 0; k.driftCD = 0.18;
  },
  addGauge(k, v) {
    k.gauge += v;
    if (k.gauge < 100) return;
    if (k.items.length < 2) { k.items.push('boost'); k.gauge -= 100; if (k === this.R.me) this.flash('부스터 충전!', '#7cc8ff'); }
    else k.gauge = 100;
  },
  locate(k) {
    const T = this.R.T, L = ktLocate(T, k.x, k.y, k.seg), lim = T.lim - KT.R;
    k.seg = L.i; k.d = L.d;
    this.progress(k, L.s);
    if (Math.abs(L.d) <= lim) return;
    const dx = k.x - L.px, dy = k.y - L.py, dist = Math.hypot(dx, dy) || 1, ox = dx / dist, oy = dy / dist;
    k.x = L.px + ox * lim; k.y = L.py + oy * lim;
    const vn = k.vx * ox + k.vy * oy;
    if (vn <= 0) return;
    k.vx -= ox * vn * 1.35; k.vy -= oy * vn * 1.35;
    const sc = 0.9 - Math.min(0.32, vn / 1000); k.vx *= sc; k.vy *= sc;
    const ta = T.ang[L.i], along = Math.abs(ktWrap(ta - k.a)) < Math.PI / 2 ? ta : ta + Math.PI;   // 벽을 따라 미끄러지게 머리를 살짝 돌려요
    k.a += clamp(ktWrap(along - k.a), -1, 1) * Math.min(0.3, vn / 1200);
    if (k.drift) this.endDrift(k, 0, true);
    k.wallN++;
    if (vn > 80) this.wallFx(k, vn, ox, oy);
  },
  progress(k, s) {
    const L = this.R.T.len, prev = k.s;
    if (prev > L * 0.7 && s < L * 0.3) { if (k.lap === 0 || k.cp) { k.lap++; k.cp = false; this.onLap(k); } }
    else if (prev < L * 0.3 && s > L * 0.7 && k.lap > 0) { k.lap--; k.cp = true; }
    if (k.lap > 0 && s > L * 0.35 && s < L * 0.65) k.cp = true;
    k.s = s;
  },
  onLap(k) {
    const R = this.R;
    if (R.attract) return;
    if (k === R.me && k.lap > 1 && k.fin == null) { R.lapTimes.push(R.t - R.lapStart); R.lapStart = R.t; }
    if (k.lap > R.laps && k.fin == null) return this.finishKart(k);
    if (k === R.me && k.lap === R.laps && R.laps > 1 && k.fin == null) this.flash('마지막 바퀴!', '#ffd23f');
  },
  finishKart(k) {
    const R = this.R;
    k.fin = R.t;
    if (!R.multi) k.finRank = ++R.finN;
    if (k !== R.me) return;
    k.ai = true; R.banner = 0;
    if (R.multi) socket.emit('kt:finish');
    else if (R.endIn == null) R.endIn = 8;
  },
  respawn(k) {
    const T = this.R.T, p = ktAt(T, k.s + 10);
    k.x = p.x; k.y = p.y; k.a = p.a; k.vx = Math.cos(p.a) * 60; k.vy = Math.sin(p.a) * 60;
    k.drift = 0; k.stun = 0; k.trap = 0; k.spin = 0; k.inv = Math.max(k.inv, 1.2); k.stuckT = 0; k.resp++;
    k.seg = ktLocate(T, k.x, k.y, k.seg).i;
    this.puff(k.x, k.y, '#ffffff', 10);
  },

  /* ─── AI: 앞쪽 중심선(+코너 안쪽)을 보고 핸들 · 코너에서 드리프트 · 직선에서 부스터 ─── */
  ai(k, dt) {
    const R = this.R, T = R.T, sp = Math.hypot(k.vx, k.vy), inp = { throttle: 1, steer: 0, drift: false };
    if ((k.laneT -= dt) <= 0) { k.laneT = 1.5 + Math.random() * 3; k.laneGoal = (Math.random() * 2 - 1) * 0.3; }
    k.lane += (k.laneGoal - k.lane) * Math.min(1, dt * 0.7);
    const turn = ktTurn(T, k.s + 30, k.s + 30 + Math.max(150, sp * 0.6)), sharp = Math.abs(turn);
    const P = ktAt(T, k.s + 60 + sp * 0.36);
    const lat = clamp(k.lane + Math.sign(turn) * Math.min(0.45, sharp * 0.35), -0.6, 0.6) * T.half;
    const diff = ktWrap(Math.atan2(P.y + P.ny * lat - k.y, P.x + P.nx * lat - k.x) - k.a);
    k.steer += (clamp(diff * 3, -1, 1) - k.steer) * Math.min(1, dt * 12);
    inp.steer = k.steer;
    const safe = KT.MAX * k.perf * (sharp > 1.6 ? 0.6 : sharp > 1.15 ? 0.72 : sharp > 0.8 ? 0.86 : 1.05);
    if (k.drift) inp.drift = Math.sign(diff) === k.drift && (Math.abs(diff) > 0.05 || sharp > 0.45);
    else if (sp > safe && sharp > 0.55 && Math.abs(diff) > 0.08 && sp > KT.MAX * 0.45) inp.drift = true;
    else if (sp > safe + 60) inp.throttle = -0.5;
    if (Math.abs(diff) > 1.6 && sp < 120) inp.throttle = 1;                       // 돌아서 있으면 일단 가속하며 돌기
    if (R.mode === 'speed' && k.items.length && !k.drift && sharp < 0.35 && Math.abs(ktTurn(T, k.s, k.s + 500)) < 0.6 && sp > KT.MAX * 0.6 && k.boost <= 0) this.useItem(k);
    return inp;
  },
  /** 싱글: 너무 앞서거나 뒤처진 AI는 살짝 조절 */
  rubber() {
    const R = this.R, L = R.T.len, me = R.me, pm = (me.lap - 1) * L + me.s;
    for (const k of R.karts) {
      if (!k.ai || k === me) continue;
      const gap = (k.lap - 1) * L + k.s - pm;
      k.perf = clamp(k.perfBase || (k.perfBase = k.perf), 0.85, 1.1) + (gap > 900 ? -0.05 : gap < -700 ? 0.05 : 0);
    }
  },
  prog(k) { return (k.lap - 1) * this.R.T.len + k.s; },
  rankAll() {
    const R = this.R, fr = k => k.finRank || (k.fin != null ? 50 : 99);
    R.order = R.karts.slice().sort((a, b) => (fr(a) - fr(b)) || (this.prog(b) - this.prog(a)));
    R.order.forEach((k, i) => { k.pos = i + 1; });
  },
  /** 바로 앞 카트 (미사일 · 물풍선 목표) */
  ahead(k) {
    let best = null, bg = Infinity;
    for (const o of this.R.karts) { if (o === k || o.fin != null) continue; const g = this.prog(o) - this.prog(k); if (g > 0 && g < bg) { bg = g; best = o; } }
    return best && bg < 2600 ? best : null;
  },

  /* ─── 카트끼리 부딪힘 ─── */
  bump() {
    const ks = this.R.karts, r2 = KT.R * 2;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i], b = ks[j];
      if (!a.local && !b.local) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= r2 * r2 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = r2 - d, vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (a.local && b.local) {
        a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
        if (vn > 0) { const im = vn * 0.62; a.vx -= nx * im; a.vy -= ny * im; b.vx += nx * im; b.vy += ny * im; }
      } else {
        const m = a.local ? a : b, s = a.local ? -1 : 1;           // 내 카트만 밀려나요 (상대는 상대 화면이 계산)
        m.x += s * nx * ov; m.y += s * ny * ov;
        if (vn > 0) { m.vx += s * nx * vn * 0.62; m.vy += s * ny * vn * 0.62; }
      }
      if (vn > 160 && (a === this.R.me || b === this.R.me)) { this.R.shake = Math.max(this.R.shake, 0.25); this.puff((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffe9a8', 6); }
    }
  },

  /* ═════════ 아이템 ═════════ */
  roll(k) {
    const n = this.R.karts.length, f = n > 1 ? (k.pos - 1) / (n - 1) : 0.5;   // 0 = 1등, 1 = 꼴찌
    const w = [['banana', 3 - 2 * f], ['shield', 1.8 - f], ['balloon', 2], ['missile', 0.5 + 2.6 * f], ['boost', 0.8 + 2.4 * f]];
    let u = Math.random() * w.reduce((a, [, x]) => a + x, 0);
    for (const [it, x] of w) { if (u < x) return it; u -= x; }
    return 'banana';
  },
  boxes(dt) {
    const R = this.R;
    R.boxes.forEach((b, i) => {
      b.rot += dt * 1.6;
      if (b.hide > 0) { b.hide -= dt; return; }
      for (const k of R.karts) {
        if (!k.local || (k.x - b.x) ** 2 + (k.y - b.y) ** 2 > 30 * 30) continue;
        b.hide = 3;
        this.puff(b.x, b.y, '#fff3a8', 10);
        if (k.items.length < 2 && k.fin == null) { k.items.push(this.roll(k)); k.itemSpin = 0.6; k.holdT = 0; }
        if (R.multi && k === R.me) socket.emit('kt:box', { i });
        break;
      }
    });
  },
  useItem(k) {
    const R = this.R;
    if (!R.go || !k.items.length || k.itemSpin > 0 || k.stun > 0 || k.trap > 0) return;
    const it = k.items.shift(), ca = Math.cos(k.a), sa = Math.sin(k.a), sp = Math.max(0, k.vx * ca + k.vy * sa);
    let h = null;
    if (it === 'boost') { k.boost = KT.N2O_T; k.boostPow = KT.N2O; k.dash = 0.4; if (k === R.me) R.shake = Math.max(R.shake, 0.18); }
    else if (it === 'shield') k.shield = 6;
    else if (it === 'banana') h = { k: 'banana', x: k.x - ca * 32, y: k.y - sa * 32 };
    else if (it === 'balloon') { const v = 700 + sp; h = { k: 'balloon', x: k.x + ca * 26, y: k.y + sa * 26, vx: ca * v, vy: sa * v, v }; }
    else if (it === 'missile') { const tg = this.ahead(k); h = { k: 'missile', x: k.x + ca * 26, y: k.y + sa * 26, a: k.a, target: tg ? tg.id : '' }; if (tg && tg === R.me) this.flash('미사일이 날아와요!', '#ff6b6b'); }
    if (h) {
      h.id = `${k.id}:${++R.hzN}`; h.owner = k.id; h.t = 0;
      R.hz.push(h);
      if (R.multi && k === R.me) socket.emit('kt:use', { k: it, id: h.id, x: Math.round(h.x), y: Math.round(h.y), a: +k.a.toFixed(3), v: Math.round(h.v || 0), t: h.target || '' });
    }
  },
  aiItems(k, dt) {
    if (!k.items.length || k.itemSpin > 0 || k.stun > 0 || k.trap > 0) return;
    const R = this.R, it = k.items[0], sp = Math.hypot(k.vx, k.vy);
    k.holdT += dt;
    let use = false;
    if (it === 'boost') use = (!k.drift && Math.abs(ktTurn(R.T, k.s, k.s + 420)) < 0.45 && sp > KT.MAX * 0.55) || k.holdT > 7;
    else if (it === 'shield') use = R.hz.some(h => h.k === 'missile' && h.target === k.id) || k.holdT > 10;
    else if (it === 'banana') use = R.karts.some(o => o !== k && o.fin == null && this.prog(k) - this.prog(o) > 30 && this.prog(k) - this.prog(o) < 260) || k.holdT > 8;
    else if (it === 'missile') use = k.holdT > 0.8 && !!this.ahead(k);
    else if (it === 'balloon') { const t = this.ahead(k), g = t ? this.prog(t) - this.prog(k) : 0; use = (t && g > 110 && g < 520 && Math.abs(ktWrap(Math.atan2(t.y - k.y, t.x - k.x) - k.a)) < 0.3) || k.holdT > 9; }
    if (use) { k.holdT = 0; this.useItem(k); }
  },
  hazards(dt) {
    const R = this.R;
    for (const h of R.hz) {
      h.t += dt;
      if (h.k === 'balloon') { h.x += h.vx * dt; h.y += h.vy * dt; if (h.t > 0.62) { h.k = 'splash'; h.t = 0; h.r = 62; this.puff(h.x, h.y, '#9fe0ff', 18); } }
      else if (h.k === 'missile') {
        const tg = h.target && R.karts.find(k => k.id === h.target && k.fin == null);
        if (tg) h.a += clamp(ktWrap(Math.atan2(tg.y - h.y, tg.x - h.x) - h.a), -4.6 * dt, 4.6 * dt);
        h.x += Math.cos(h.a) * 900 * dt; h.y += Math.sin(h.a) * 900 * dt;
        if (h.t > 5) h.dead = true;
      } else if (h.k === 'splash') { if (h.t > 2.6) h.dead = true; }
      else if (h.k === 'banana' && h.t > 45) h.dead = true;
    }
    for (const k of R.karts) {
      if (!k.local || k.inv > 0 || k.fin != null) continue;
      for (const h of R.hz) {
        if (h.dead) continue;
        const d2 = (k.x - h.x) ** 2 + (k.y - h.y) ** 2;
        let hit = null;
        if (h.k === 'banana' && d2 < 22 * 22) hit = 'spin';
        else if (h.k === 'balloon' && d2 < 28 * 28 && (h.owner !== k.id || h.t > 0.3)) hit = 'trap';
        else if (h.k === 'splash' && d2 < h.r * h.r) hit = 'trap';
        else if (h.k === 'missile' && h.target === k.id && d2 < 26 * 26) hit = 'boom';
        if (!hit) continue;
        if (h.k !== 'splash') h.dead = true;
        const blocked = this.hit(k, hit);
        if (R.multi && k === R.me) socket.emit('kt:hit', { id: h.id, k: blocked ? 'block' : hit });
        break;
      }
    }
    R.hz = R.hz.filter(h => !h.dead);
  },
  /** 맞음! (실드가 있으면 막고 true) */
  hit(k, kind) {
    const R = this.R, me = k === R.me;
    k.hitN = (k.hitN || 0) + 1;
    if (k.shield > 0) { k.shield = 0; k.inv = 0.8; this.puff(k.x, k.y, '#8fe3ff', 14); if (me) this.flash('실드가 막았어요!', '#8fe3ff'); return true; }
    if (kind === 'spin') { k.stun = 1.05; if (me) this.flash('미끌!', '#ffe14d'); }
    else if (kind === 'boom') { k.stun = 1.5; k.boom = 0.5; this.boomFx(k.x, k.y); if (me) this.flash('미사일에 맞았어요!', '#ff6b6b'); }
    else { k.trap = 1.5; this.puff(k.x, k.y, '#9fe0ff', 14); if (me) this.flash('물풍선에 갇혔어요!', '#7cc8ff'); }
    k.inv = (k.stun || k.trap) + 0.8; k.drift = 0;
    if (me) R.shake = Math.max(R.shake, kind === 'boom' ? 0.7 : 0.4);
    return false;
  },

  /* ═════════ 멀티 통신 ═════════ */
  send() {
    const R = this.R, k = R && R.me;
    if (!R || !R.multi || !k || !k.local) return;
    const f = (k.drift ? 1 : 0) | (k.boost > 0 ? 2 : 0) | (k.stun > 0 ? 4 : 0) | (k.shield > 0 ? 8 : 0) | (k.trap > 0 ? 16 : 0) | (k.fin != null ? 32 : 0) | (k.boom > 0 ? 64 : 0);
    socket.emit('kt:st', [Math.round(k.x), Math.round(k.y), +ktWrap(k.a).toFixed(3), Math.round(Math.hypot(k.vx, k.vy)), f, k.lap, Math.round(k.s), k.drift, k.boostPow > 1.4 ? 1 : 0]);
  },
  onStates(d) {
    const R = this.R; if (!R || !R.multi) return;
    const now = performance.now();
    for (const k of R.karts) {
      const v = k.remote && d[k.id];
      if (!v) continue;
      const last = k.snaps[k.snaps.length - 1];
      if (last && last.x === v[0] && last.y === v[1] && last.a === v[2] && now - last.t < 200) { last.f = v[4]; continue; }   // 같은 상태가 또 오면 시간만 그대로
      k.snaps.push({ t: now, x: v[0], y: v[1], a: v[2], sp: v[3], f: v[4], lap: v[5], s: v[6], dd: v[7], n2o: v[8] });
      if (k.snaps.length > 14) k.snaps.shift();
    }
  },
  interp(now, dt) {
    const rt = now - 110;
    for (const k of this.R.karts) {
      if (!k.remote || !k.snaps.length) continue;
      const sn = k.snaps, L = sn[sn.length - 1];
      let a = sn[0], b = null;
      for (let i = sn.length - 1; i >= 0; i--) if (sn[i].t <= rt) { a = sn[i]; b = sn[i + 1] || null; break; }
      if (b) {
        const u = clamp((rt - a.t) / ((b.t - a.t) || 1), 0, 1), sec = Math.max(0.001, (b.t - a.t) / 1000);
        k.x = a.x + (b.x - a.x) * u; k.y = a.y + (b.y - a.y) * u; k.a = a.a + ktWrap(b.a - a.a) * u;
        k.vx = (b.x - a.x) / sec; k.vy = (b.y - a.y) / sec;
      } else {
        const ex = clamp((rt - a.t) / 1000, 0, 0.15);
        k.x = a.x + k.vx * ex * 0.5; k.y = a.y + k.vy * ex * 0.5; k.a = a.a;
      }
      k.drift = L.f & 1 ? (L.dd || 1) : 0;
      k.driftT = k.drift ? (k.driftT || 0) + dt : 0;
      k.boost = L.f & 2 ? 0.2 : 0; k.boostPow = L.n2o ? KT.N2O : 1.2;
      k.trap = L.f & 16 ? 0.3 : 0; k.shield = L.f & 8 ? 1 : 0; k.boom = L.f & 64 ? 0.3 : 0;
      if (L.f & 4) { k.stun = 0.3; k.spin += dt * 13; } else { k.stun = 0; k.spin = 0; }
      k.lap = L.lap; k.s = L.s;
      if (L.f & 32 && k.fin == null) k.fin = this.R.t;
    }
  },
  onUse(d) {
    const R = this.R;
    if (!R || !R.multi || d.from === S.myId || R.hz.some(h => h.id === d.id)) return;
    const h = { k: d.k, id: d.id, owner: d.from, x: d.x, y: d.y, t: 0, a: d.a, target: d.t || '' };
    if (d.k === 'balloon') { h.vx = Math.cos(d.a) * d.v; h.vy = Math.sin(d.a) * d.v; }
    if (d.k === 'missile' && d.t === S.myId) this.flash('미사일이 날아와요!', '#ff6b6b');
    R.hz.push(h);
    if (R.hz.length > 80) R.hz.splice(0, R.hz.length - 80);
  },
  onHit(d) {
    const R = this.R;
    if (!R || !R.multi || d.from === S.myId) return;
    const h = R.hz.find(x => x.id === d.id);
    if (h && h.k !== 'splash') h.dead = true;
    const k = R.karts.find(x => x.id === d.from);
    if (k && d.k === 'boom') this.boomFx(k.x, k.y);
    else if (k) this.puff(k.x, k.y, d.k === 'trap' ? '#9fe0ff' : d.k === 'block' ? '#8fe3ff' : '#ffe14d', 10);
    R.hz = R.hz.filter(x => !x.dead);
  },

  /* ═════════ 싱글 결과 ═════════ */
  endSolo() {
    const R = this.R;
    if (!R || R.over) return;
    R.over = true;
    this.rankAll();
    const me = R.me, T = R.T, key = this.bestKey(T.idx, R.laps, R.mode), prev = +store.get(key, 0) || 0;
    const rec = me.fin != null && (!prev || me.fin * 1000 < prev);
    if (rec) store.set(key, Math.round(me.fin * 1000));
    const bestLap = R.lapTimes.length ? Math.min(...R.lapTimes) : null;
    window.removeEventListener('beforeunload', ktGuard);
    showResult({
      title: me.fin == null ? '🏁 레이스 종료' : me.pos === 1 ? '🏆 1위로 골인!' : `🏁 ${me.pos}위로 골인!`,
      subtitle: `${T.name} · ${R.mode === 'item' ? '아이템전' : '스피드전'} · ${R.laps}바퀴`,
      lines: [me.fin != null ? `기록 ${ktFmt(me.fin)}${rec ? (prev ? ' · 최고 기록 갱신!' : ' · 첫 기록!') : ` · 최고 ${ktFmt(prev / 1000)}`}` : '아쉽게 완주하지 못했어요', bestLap && R.laps > 1 ? `가장 빠른 바퀴 ${ktFmt(bestLap)}` : ''].filter(Boolean),
      ranking: R.order.map(k => ({ name: k === me ? `${k.name} (나)` : k.name, value: k.fin != null ? ktFmt(k.fin) : `${clamp(k.lap, 0, R.laps)}/${R.laps}바퀴` })),
      solo: 'kart', win: me.fin != null && me.pos === 1 && R.order.length > 1,
    });
  },
  flash(text, color) { const R = this.R; if (!R || R.attract) return; R.msgs = R.msgs.filter(m => m.text !== text); R.msgs.push({ text, color, t: 1.7 }); if (R.msgs.length > 3) R.msgs.shift(); },

  /* ═════════ 효과 (파티클 · 스키드 자국) ═════════ */
  puff(x, y, color, n) {
    const fx = this.R && this.R.fx; if (!fx) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 40 + Math.random() * 160; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, max: 0.9, c: color, s: 3 + Math.random() * 4, k: 'dot' }); }
  },
  boomFx(x, y) {
    const fx = this.R && this.R.fx; if (!fx) return;
    fx.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, c: '#ffd166', s: 60, k: 'ring' });
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 260; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.5, max: 1.1, c: i % 3 ? '#ff8a3d' : '#ffe066', s: 4 + Math.random() * 6, k: 'dot' }); }
    for (let i = 0; i < 8; i++) fx.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 1.2, max: 1.2, c: 'rgba(60,60,70,.5)', s: 14 + Math.random() * 12, k: 'smoke' });
  },
  wallFx(k, vn, ox, oy) {
    const R = this.R;
    for (let i = 0; i < Math.min(14, vn / 25); i++) { const a = Math.atan2(-oy, -ox) + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * vn * 0.5; R.fx.push({ x: k.x + ox * 14, y: k.y + oy * 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.3, max: 0.6, c: '#ffd36b', s: 2 + Math.random() * 2.5, k: 'spark' }); }
    if (k === R.me) R.shake = Math.max(R.shake, Math.min(0.6, vn / 700));
  },
  effects(dt) {
    const R = this.R, T = R.T, th = T.theme;
    for (const k of R.karts) {
      const ca = Math.cos(k.a), sa = Math.sin(k.a), sp = Math.hypot(k.vx, k.vy);
      const rl = [k.x - ca * 12 + sa * 10, k.y - sa * 12 - ca * 10], rr = [k.x - ca * 12 - sa * 10, k.y - sa * 12 + ca * 10];
      const slip = sp > 80 ? Math.abs(-k.vx * sa + k.vy * ca) / sp : 0;
      const skid = (k.drift || slip > 0.34 || k.stun > 0) && sp > 70;
      if (skid && k.rl) { R.skid.push([k.rl[0], k.rl[1], rl[0], rl[1], R.t]); R.skid.push([k.rr[0], k.rr[1], rr[0], rr[1], R.t]); }
      k.rl = rl; k.rr = rr;
      if (k.drift && sp > 120 && Math.random() < 0.8) {
        const lv = k.driftT >= KT.DRIFT_LV[1] ? 2 : k.driftT >= KT.DRIFT_LV[0] ? 1 : 0, w = k.drift > 0 ? rl : rr;
        const c = ['#ffffff', '#6cc6ff', '#ffa62b'][lv];
        R.fx.push({ x: w[0], y: w[1], vx: -k.vx * 0.15 + (Math.random() - 0.5) * 120, vy: -k.vy * 0.15 + (Math.random() - 0.5) * 120, life: 0.25 + Math.random() * 0.2, max: 0.45, c, s: 1.6 + lv + Math.random() * 1.5, k: 'spark' });
      }
      if (k.boost > 0 && Math.random() < 0.7) {
        const n2o = k.boostPow >= 1.45;
        R.fx.push({ x: k.x - ca * 22, y: k.y - sa * 22, vx: -ca * 160 + (Math.random() - 0.5) * 60, vy: -sa * 160 + (Math.random() - 0.5) * 60, life: 0.25, max: 0.25, c: n2o ? '#9fdcff' : '#ffb347', s: 5 + Math.random() * 4, k: 'dot' });
      }
      if (Math.abs(k.d) > T.half + 4 && sp > 150 && Math.random() < 0.5) R.fx.push({ x: rl[0], y: rl[1], vx: -k.vx * 0.1, vy: -k.vy * 0.1, life: 0.6, max: 0.6, c: th.dust, s: 6 + Math.random() * 6, k: 'smoke' });
    }
    for (const h of R.hz) if (h.k === 'missile' && Math.random() < 0.9) R.fx.push({ x: h.x - Math.cos(h.a) * 14, y: h.y - Math.sin(h.a) * 14, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.5, max: 0.5, c: 'rgba(230,230,240,.7)', s: 6 + Math.random() * 4, k: 'smoke' });
    for (const p of R.fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
    R.fx = R.fx.filter(p => p.life > 0);
    if (R.fx.length > 700) R.fx.splice(0, R.fx.length - 700);
    const old = R.t - 9;
    if (R.skid.length > 2400 || (R.skid.length && R.skid[0][4] < old)) R.skid = R.skid.filter(s => s[4] >= old).slice(-2400);
    if (R.banner != null) R.banner += dt;
    // 카메라: 내 카트 앞쪽을 보고, 빠를수록 살짝 멀리
    const me = R.attract ? R.order[0] || R.me : R.me, cam = R.cam, sp = Math.hypot(me.vx, me.vy), f = 1 - Math.exp(-5 * dt);
    cam.rot = this.H > this.W * 1.05;                        // 세로 화면: 트랙 진행 방향이 위로 오게 화면을 돌려요 (앞이 더 잘 보이게)
    let tx = me.x + me.vx * 0.32, ty = me.y + me.vy * 0.32;
    if (cam.rot) {
      const ta = ktAt(T, me.s + 110).a;
      if (cam.ang == null) cam.ang = ta;
      cam.ang += ktWrap(ta - cam.ang) * (1 - Math.exp(-3 * dt));
      const ahead = this.H * 0.2 / cam.z;
      tx = me.x + Math.cos(cam.ang) * ahead; ty = me.y + Math.sin(cam.ang) * ahead;
    }
    cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f;
    const tz = this.baseZoom() * (R.attract ? 0.82 : 1 - 0.13 * Math.min(1.3, sp / KT.MAX));
    cam.z += (tz - cam.z) * (1 - Math.exp(-2.5 * dt));
  },

  /* ═════════ 그리기 ═════════ */
  mount() {
    this.cv = $('#kt-cv'); this.c = this.cv.getContext('2d');
    if (!this.resizeBound) { this.resizeBound = true; window.addEventListener('resize', () => { this.fitted = false; }); }
    this.fit();
  },
  fit() {
    const cv = this.cv, st = $('#kt-stage'), sec = $('#scr-kart');
    const w = st.clientWidth || 800, mob = w < 640;
    // 캔버스 높이 = core.js Fit 이 쓰는 남는 높이(창 높이 - 화면 위치 - 아래 여백 - 가상 패드) - 제목 줄 → 화면 전체를 줄이지 않고 딱 맞아요
    // (Fit 이 화면을 줄여 둔 상태여도 줄이기 전 크기로 계산해요 — 그래야 다시 맞출 때 원래 크기로 돌아와요)
    const padH = TOUCH && KTouch.on && KTouch.port ? KTouch.strip + 6 : 0;   // 휴대폰 · 태블릿 세로: 아래 조작 띠(엄지 자리)만큼 비워요 · 가로는 조작이 화면 위에 떠 있어요
    const shellB = parseFloat(getComputedStyle(sec.parentElement.parentElement).paddingBottom) || 0;
    const sr = sec.getBoundingClientRect(), z = +sec.dataset.z || 1;
    this.above = Math.round((cv.getBoundingClientRect().top - sr.top) / z);
    const room = window.innerHeight - (sr.top + window.scrollY) - shellB - padH - this.above - 2;
    const tall = window.innerHeight > window.innerWidth;           // 세로로 긴 태블릿 · 폴드: 화면을 더 길게 써요
    const h = Math.round(clamp(Math.min(room, mob ? w * 1.6 : w * (tall ? 1 : 0.62)), 200, mob ? 760 : 860));
    this.dpr = Math.min(this.q === 0 ? 1 : 2, window.devicePixelRatio || 1);
    this.W = w; this.H = h;
    cv.style.height = h + 'px';
    cv.width = Math.round(w * this.dpr); cv.height = Math.round(h * this.dpr);
    this.fitted = !!st.clientWidth;
    if (this.R) this.R.mm = null;
  },
  /** 제목 줄 높이가 바뀌어 캔버스 위치가 달라졌는지 (글꼴 로드 · 안내 문구 줄바꿈) → 다시 맞추기 */
  moved() {
    const sec = this.cv && this.cv.closest('.screen');
    if (!sec || !sec.classList.contains('active')) return false;
    const z = +sec.dataset.z || 1;
    return Math.abs(Math.round((this.cv.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z) - (this.above || 0)) > 1;
  },
  /** 낮고 넓은 화면(휴대폰 가로)에서는 조금 멀리서 봐서 앞길이 더 보이게 */
  baseZoom() { const W = this.W || 900, H = this.H || 520; return W < 640 ? clamp(W / 520, 0.58, 0.8) : clamp(Math.min(W / 930, H < 400 ? H / 420 : 9), 0.66, 1.32); },
  patterns(th) {
    if (this.pat.th !== th) this.pat = { th, cells: new Map() };
  },
  /** 바닥 무늬: 칸마다 정해진 점들을 색깔별로 한 번에 (패턴 채우기보다 훨씬 빨라요) */
  speckles(c, x0, y0, x1, y1, th) {
    const C = 160, cells = this.pat.cells || (this.pat.cells = new Map()), n = th.speck.length, paths = th.speck.map(() => new Path2D());
    for (let cy = Math.floor(y0 / C); cy <= Math.floor(y1 / C); cy++) for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) {
      const key = cx * 65536 + cy;
      let arr = cells.get(key);
      if (!arr) {
        const r = ktRng(((cx * 73856093) ^ (cy * 19349663)) >>> 0); arr = [];
        for (let i = 0; i < 16; i++) arr.push([cx * C + r() * C, cy * C + r() * C, 2 + r() * 6, 1.5 + r() * 3.5, r() * 3, Math.floor(r() * n)]);
        cells.set(key, arr);
      }
      for (const [x, y, rx, ry, a, ci] of arr) { const p = paths[ci]; p.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a)); p.ellipse(x, y, rx, ry, a, 0, 6.2832); }
    }
    c.globalAlpha = 0.8;
    paths.forEach((p, i) => { c.fillStyle = th.speck[i]; c.fill(p); });
    c.globalAlpha = 1;
  },
  drawPreview(cv, T) {
    const g = cv.getContext('2d'), th = T.theme, W = cv.width, Hh = cv.height, pad = 16;
    const sc = Math.min((W - pad * 2) / (T.bx1 - T.bx0), (Hh - pad * 2) / (T.by1 - T.by0));
    const ox = (W - (T.bx1 - T.bx0) * sc) / 2, oy = (Hh - (T.by1 - T.by0) * sc) / 2;
    g.fillStyle = th.ground; g.fillRect(0, 0, W, Hh);
    const path = () => { g.beginPath(); T.pts.forEach(([x, y], i) => { const X = ox + (x - T.bx0) * sc, Y = oy + (y - T.by0) * sc; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); };
    g.lineJoin = 'round';
    path(); g.strokeStyle = th.curbB; g.lineWidth = T.w * sc + 6; g.stroke();
    path(); g.strokeStyle = th.road; g.lineWidth = T.w * sc + 1; g.stroke();
    const s0 = ktAt(T, 0);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + (s0.x - T.bx0) * sc, oy + (s0.y - T.by0) * sc, 4, 0, 7); g.fill();
  },
  /** 화면 안에 들어오는 트랙 조각들 (긴 트랙 전체를 매번 그리지 않도록) */
  runs(T, x0, y0, x1, y1) {
    const m = T.lim + 50, N = T.N, inside = i => { const [x, y] = T.pts[i]; return x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m; };
    const out = [];
    let start = -1;
    for (let i = 0; i < N && start < 0; i++) if (!inside(i)) start = i;
    if (start < 0) return [{ i0: 0, n: N, closed: true }];
    let cur = null;
    for (let q = 1; q <= N; q++) {
      const i = (start + q) % N;
      if (inside(i)) { if (!cur) cur = { i0: (i - 1 + N) % N, n: 1 }; cur.n++; }
      else if (cur) { cur.n++; out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  },
  strokeRuns(c, T, runs, width, color, dash, period) {
    c.lineWidth = width; c.strokeStyle = color;
    for (const r of runs) {
      c.beginPath();
      for (let q = 0; q < r.n; q++) { const p = T.pts[(r.i0 + q) % T.N]; if (q) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
      if (r.closed) c.closePath();
      if (dash) { c.setLineDash(dash); c.lineDashOffset = (r.i0 * T.sp) % period; }
      c.stroke();
      if (dash) c.setLineDash([]);
    }
  },
  render(now) {
    const R = this.R, c = this.c; if (!R || !c) return;
    const W = this.W, H = this.H, dpr = this.dpr, T = R.T, th = T.theme, cam = R.cam, z = cam.z;
    let sx = 0, sy = 0;
    if (R.shake > 0) { sx = (Math.random() - 0.5) * R.shake * 16; sy = (Math.random() - 0.5) * R.shake * 16; }
    this.viewRot = cam.rot ? -(cam.ang + Math.PI / 2) : 0;
    c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 + sx), dpr * (H / 2 + sy));
    if (this.viewRot) c.rotate(this.viewRot);
    c.translate(-cam.x, -cam.y);
    const hw = (this.viewRot ? Math.hypot(W, H) / 2 : W / 2) / z + 40, hh = (this.viewRot ? Math.hypot(W, H) / 2 : H / 2) / z + 40;
    const x0 = cam.x - hw, y0 = cam.y - hh, x1 = cam.x + hw, y1 = cam.y + hh;
    c.fillStyle = th.ground; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (this.q >= 2) this.speckles(c, x0, y0, x1, y1, th);
    // 트랙: 벽 → 바깥 여유 → 연석 → 도로 → 가장자리 선 → 중앙 점선
    const runs = this.runs(T, x0, y0, x1, y1);
    c.lineJoin = 'round'; c.lineCap = 'butt';
    this.strokeRuns(c, T, runs, T.lim * 2 + 22, th.wall);
    if (this.q >= 1) this.strokeRuns(c, T, runs, T.lim * 2 + 22, th.wall2, [16, 16], 32);
    this.strokeRuns(c, T, runs, T.lim * 2, th.runoff);
    this.strokeRuns(c, T, runs, T.w + 26, th.curbA);
    this.strokeRuns(c, T, runs, T.w + 26, th.curbB, [30, 30], 60);
    this.strokeRuns(c, T, runs, T.w, th.road);
    this.strokeRuns(c, T, runs, T.w - 10, th.edge);
    this.strokeRuns(c, T, runs, T.w - 16, th.road);
    this.strokeRuns(c, T, runs, 4, th.dash, [36, 44], 80);
    this.drawStart(c, T);
    // 스키드 자국
    if (R.skid.length) {
      c.strokeStyle = th.skid; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath();
      for (const s of R.skid) { if (s[0] < x0 || s[0] > x1 || s[1] < y0 || s[1] > y1) continue; c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); }
      c.stroke();
    }
    // 장식
    for (const d of T.deco) if (d.x + d.r * 2.5 > x0 && d.x - d.r * 2.5 < x1 && d.y + d.r * 2.5 > y0 && d.y - d.r * 2.5 < y1) this.drawDeco(c, d, now);
    if (R.mode === 'item') for (const b of R.boxes) if (b.hide <= 0) this.drawBox(c, b, now);
    const onScr = h => h.x > x0 - 80 && h.x < x1 + 80 && h.y > y0 - 80 && h.y < y1 + 80;
    for (const h of R.hz) if ((h.k === 'splash' || h.k === 'banana') && onScr(h)) this.drawHazard(c, h, now);
    for (const k of R.karts) this.drawKart(c, k, now);
    if (TOUCH && !R.attract) this.drawAim(c);
    for (const h of R.hz) if ((h.k === 'balloon' || h.k === 'missile') && onScr(h)) this.drawHazard(c, h, now);
    this.drawFx(c);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!R.attract) this.drawNames(c, z);
    if (!R.attract) this.hud(c, W, H, now);
  },
  /** 방향 조종: 조이스틱이 가리키는 쪽(차가 돌아갈 방향)을 내 카트 앞에 작은 화살표로 */
  drawAim(c) {
    const v = KTouch.vec(), me = this.R.me;
    if (!v || v.m < KTouch.DEAD || KTouch.mode !== 'dir' || !me || me.fin != null) return;
    const wa = v.a - (this.viewRot || 0), d = 50;
    c.save(); c.translate(me.x + Math.cos(wa) * d, me.y + Math.sin(wa) * d); c.rotate(wa);
    c.globalAlpha = 0.35 + 0.35 * v.m; c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(13, 0); c.lineTo(-7, -10); c.lineTo(-2, 0); c.lineTo(-7, 10); c.closePath(); c.stroke(); c.fill();
    c.restore();
  },
  drawStart(c, T) {
    const p = ktAt(T, 0), sq = T.w / 10;
    c.save(); c.translate(p.x, p.y); c.rotate(p.a);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) { c.fillStyle = (i + r) % 2 ? '#1c1d22' : '#ffffff'; c.fillRect(-sq + r * sq, -T.half + i * sq, sq, sq); }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3;
    for (const g of T.grid) {
      c.save(); c.translate(g.x, g.y); c.rotate(g.a);
      c.beginPath(); c.moveTo(-6, -18); c.lineTo(22, -18); c.moveTo(22, -18); c.lineTo(22, 18); c.lineTo(-6, 18); c.stroke();
      c.restore();
    }
  },
  drawDeco(c, d, now) {
    const { x, y, r } = d;
    const shadow = (rx, ry, k = 0.24) => { c.fillStyle = `rgba(0,0,0,${k})`; c.beginPath(); c.ellipse(x + r * 0.28, y + r * 0.32, rx, ry, 0, 0, 7); c.fill(); };
    const circ = (cx, cy, rr, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill(); };
    switch (d.t) {
      case 'tree': shadow(r * 1.05, r * 0.9); circ(x, y, r, d.v < 0.5 ? '#2c7a33' : '#357f2c'); circ(x - r * 0.2, y - r * 0.24, r * 0.7, d.v < 0.5 ? '#3e9a3f' : '#49a33a'); circ(x - r * 0.36, y - r * 0.42, r * 0.32, 'rgba(255,255,255,.14)'); break;
      case 'bush': shadow(r * 1.2, r * 0.8, 0.2); for (let i = 0; i < 3; i++) circ(x + Math.cos(d.a + i * 2.1) * r * 0.45, y + Math.sin(d.a + i * 2.1) * r * 0.45, r * 0.62, i % 2 ? '#3f9a3a' : '#358a33'); circ(x - r * 0.2, y - r * 0.25, r * 0.3, 'rgba(255,255,255,.12)'); break;
      case 'flower': for (let i = 0; i < 5; i++) circ(x + Math.cos(d.a + i * 1.26) * r * 0.6, y + Math.sin(d.a + i * 1.26) * r * 0.6, r * 0.22, ['#ff6b9a', '#ffd23f', '#ffffff', '#b98cff'][Math.floor(d.v * 4)]); circ(x, y, r * 0.2, '#ffcf3f'); break;
      case 'tires': for (let i = 0; i < 3; i++) { const tx = x + (i - 1) * r * 1.1, ty = y; circ(tx + 2, ty + 3, r * 0.6, 'rgba(0,0,0,.25)'); circ(tx, ty, r * 0.6, '#1e2026'); circ(tx, ty, r * 0.28, i % 2 ? '#e84a3f' : '#f2f2f2'); } break;
      case 'pine': {
        shadow(r * 0.95, r * 0.8, 0.16);
        c.fillStyle = '#1f5e46'; c.beginPath();
        for (let i = 0; i < 16; i++) { const a = d.a + i * Math.PI / 8, rr = i % 2 ? r * 0.55 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath();
        for (let i = 0; i < 16; i++) { const a = d.a + i * Math.PI / 8, rr = (i % 2 ? r * 0.3 : r * 0.58); c.lineTo(x - r * 0.12 + Math.cos(a) * rr, y - r * 0.15 + Math.sin(a) * rr); }
        c.closePath(); c.fill(); circ(x - r * 0.12, y - r * 0.15, r * 0.12, '#2d6f55'); break;
      }
      case 'iceblock': c.save(); c.translate(x, y); c.rotate(d.a); c.fillStyle = 'rgba(40,90,140,.16)'; ktRR(c, -r + 5, -r * 0.7 + 6, r * 2, r * 1.4, 6); c.fill(); c.fillStyle = '#bfe4fb'; ktRR(c, -r, -r * 0.7, r * 2, r * 1.4, 6); c.fill(); c.fillStyle = '#e9f7ff'; ktRR(c, -r * 0.8, -r * 0.55, r * 1.1, r * 0.5, 4); c.fill(); c.restore(); break;
      case 'snowrock': shadow(r, r * 0.8, 0.14); circ(x, y, r, '#a9b8c6'); circ(x - r * 0.15, y - r * 0.2, r * 0.78, '#f4f9fd'); break;
      case 'snowman': shadow(r * 1.1, r * 0.9, 0.14); circ(x, y + r * 0.2, r, '#ffffff'); circ(x - r * 0.1, y - r * 0.55, r * 0.62, '#f7fbff'); circ(x + r * 0.35, y - r * 0.55, r * 0.14, '#ff8a3d'); break;
      case 'cactus': shadow(r * 1.05, r * 0.85, 0.2); circ(x, y, r, '#3d8b4a'); c.strokeStyle = '#2f7039'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * 0.785; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92); c.stroke(); } circ(x, y, r * 0.24, d.v < 0.5 ? '#ff6b9a' : '#ffd23f'); break;
      case 'rock': {
        shadow(r * 1.05, r * 0.8, 0.22);
        c.fillStyle = '#a07650'; c.beginPath();
        for (let i = 0; i < 7; i++) { const a = d.a + i * 0.9, rr = r * (0.75 + ((d.v * 7 + i * 0.37) % 1) * 0.3); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); c.fill(); circ(x - r * 0.25, y - r * 0.25, r * 0.4, 'rgba(255,240,210,.25)'); break;
      }
      case 'palm': shadow(r, r * 0.8, 0.18); c.strokeStyle = '#3f8f3a'; c.lineWidth = r * 0.22; c.lineCap = 'round'; for (let i = 0; i < 7; i++) { const a = d.a + i * 0.9; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7 - 6, x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); } circ(x, y, r * 0.18, '#7a5233'); c.lineCap = 'butt'; break;
      case 'drybush': c.strokeStyle = '#9b7a47'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { const a = d.a + i * 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); } break;
      case 'stand': {
        c.save(); c.translate(x, y); c.rotate(d.a);
        c.fillStyle = 'rgba(0,0,0,.25)'; ktRR(c, -220 + 8, -46 + 10, 440, 92, 10); c.fill();
        c.fillStyle = '#5b6274'; ktRR(c, -220, -46, 440, 92, 10); c.fill();
        const rng = ktRng(5 + Math.round(x)), cols = ['#ff4757', '#ffc93c', '#3d8bff', '#ffffff', '#2ed573', '#ff6bb5'];
        for (let i = 0; i < 120; i++) { const px = -205 + (i % 30) * 14, py = -34 + Math.floor(i / 30) * 18; c.fillStyle = cols[Math.floor(rng() * cols.length)]; c.beginPath(); c.arc(px + Math.sin(now / 300 + i) * 1.2, py, 5, 0, 7); c.fill(); }
        c.fillStyle = '#e84a3f'; c.fillRect(-220, 34, 440, 12); c.fillStyle = '#fff'; for (let i = 0; i < 11; i++) c.fillRect(-220 + i * 40, 34, 20, 12);
        c.restore(); break;
      }
    }
  },
  drawBox(c, b, now) {
    const bob = 1 + Math.sin(now / 260 + b.x) * 0.06;
    c.save(); c.translate(b.x, b.y);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(4, 7, 15, 9, 0, 0, 7); c.fill();
    c.rotate(b.rot); c.scale(bob, bob);
    const g = c.createLinearGradient(-14, -14, 14, 14); g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ff8fd0'); g.addColorStop(1, '#7c6cff');
    c.fillStyle = g; ktRR(c, -14, -14, 28, 28, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.5; ktRR(c, -14, -14, 28, 28, 7); c.stroke();
    c.rotate(-b.rot - (this.viewRot || 0));
    c.fillStyle = '#fff'; c.font = '20px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 1);
    c.restore();
  },
  drawHazard(c, h, now) {
    c.save(); c.translate(h.x, h.y);
    if (h.k === 'banana') {
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(3, 4, 13, 8, 0, 0, 7); c.fill();
      c.rotate(h.t * 0.5 + (h.x % 6));
      this.itemIcon(c, 'banana', 0, 0, 26);
    } else if (h.k === 'splash') {
      const life = 1 - h.t / 2.6, r = h.r * (0.7 + 0.3 * Math.min(1, h.t * 4));
      c.globalAlpha = Math.min(1, life * 2);
      c.fillStyle = 'rgba(90,190,255,.35)'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
      c.strokeStyle = 'rgba(220,245,255,.8)'; c.lineWidth = 3;
      for (let i = 0; i < 2; i++) { const rr = r * (((now / 900 + i * 0.5) % 1) * 0.9 + 0.1); c.beginPath(); c.arc(0, 0, rr, 0, 7); c.stroke(); }
      c.globalAlpha = 1;
    } else if (h.k === 'balloon') {
      const u = h.t / 0.62, ht = Math.sin(Math.PI * Math.min(1, u)) * 46;
      c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(0, 0, 12, 7, 0, 0, 7); c.fill();
      const vr = this.viewRot || 0;                                // 화면 위쪽으로 떠오르게 (화면이 돌아가도)
      this.itemIcon(c, 'balloon', -ht * Math.sin(vr), -ht * Math.cos(vr), 26);
    } else if (h.k === 'missile') {
      c.rotate(h.a);
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(4, 8, 16, 6, 0, 0, 7); c.fill();
      c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-14, -4); c.lineTo(-24 - Math.random() * 8, 0); c.lineTo(-14, 4); c.fill();
      c.fillStyle = '#e8eaf2'; ktRR(c, -14, -5, 26, 10, 5); c.fill();
      c.fillStyle = '#ff4757'; c.beginPath(); c.moveTo(12, -5); c.quadraticCurveTo(22, 0, 12, 5); c.fill();
      c.fillStyle = '#ff4757'; c.beginPath(); c.moveTo(-12, -5); c.lineTo(-16, -11); c.lineTo(-6, -5); c.moveTo(-12, 5); c.lineTo(-16, 11); c.lineTo(-6, 5); c.fill();
    }
    c.restore();
  },
  /** 아이템 그림 (칸 · 바닥 공용) */
  itemIcon(c, it, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s / 32, s / 32);
    if (it === 'banana') {
      c.fillStyle = '#ffd93b'; c.beginPath(); c.moveTo(-13, -6); c.quadraticCurveTo(-4, 14, 14, 4); c.quadraticCurveTo(2, 7, -8, -8); c.closePath(); c.fill();
      c.strokeStyle = '#c9a313'; c.lineWidth = 1.6; c.stroke();
      c.fillStyle = '#6b4b1f'; c.beginPath(); c.arc(-11, -7, 2.6, 0, 7); c.fill(); c.beginPath(); c.arc(13.5, 4, 2, 0, 7); c.fill();
    } else if (it === 'balloon') {
      const g = c.createRadialGradient(-5, -6, 2, 0, 0, 14); g.addColorStop(0, '#d8f4ff'); g.addColorStop(0.45, '#5cc2ff'); g.addColorStop(1, '#1f7fd6');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill();
      c.fillStyle = '#1f7fd6'; c.beginPath(); c.moveTo(-3, 12); c.lineTo(3, 12); c.lineTo(0, 16); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(-5, -6, 3.5, 2.2, -0.6, 0, 7); c.fill();
    } else if (it === 'missile') {
      c.rotate(-0.6);
      c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-10, -4); c.lineTo(-17, 0); c.lineTo(-10, 4); c.fill();
      c.fillStyle = '#e8eaf2'; ktRR(c, -10, -5.5, 22, 11, 5.5); c.fill();
      c.fillStyle = '#ff4757'; c.beginPath(); c.moveTo(10, -5.5); c.quadraticCurveTo(20, 0, 10, 5.5); c.fill();
      c.beginPath(); c.moveTo(-8, -5); c.lineTo(-13, -12); c.lineTo(-2, -5); c.moveTo(-8, 5); c.lineTo(-13, 12); c.lineTo(-2, 5); c.fill();
    } else if (it === 'shield') {
      c.strokeStyle = '#8fe3ff'; c.lineWidth = 3.5; c.fillStyle = 'rgba(143,227,255,.25)';
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(-4, -5, 3, 2, -0.6, 0, 7); c.fill();
    } else if (it === 'boost') {
      c.rotate(-0.5);
      c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-9, -5); c.lineTo(-17, 0); c.lineTo(-9, 5); c.fill();
      const g = c.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, '#7cc8ff'); g.addColorStop(1, '#2f6fe0');
      c.fillStyle = g; ktRR(c, -9, -7, 20, 14, 5); c.fill();
      c.fillStyle = '#ffffff'; c.font = 'bold 8px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N₂O', 1, 0.5);
    }
    c.restore();
  },
  drawKart(c, k, now) {
    const st = clamp(k.steer || 0, -1, 1) * 0.45, ang = k.a + (k.spin || 0);
    c.save(); c.translate(k.x, k.y);
    // 그림자
    c.save(); c.translate(4, 6); c.rotate(ang); c.fillStyle = 'rgba(0,0,0,.28)'; ktRR(c, -19, -12, 39, 24, 10); c.fill(); c.restore();
    c.rotate(ang);
    if (k.boom > 0) c.scale(1 + k.boom * 0.4, 1 + k.boom * 0.4);
    // 부스터 불꽃
    if (k.boost > 0) {
      const n2o = k.boostPow >= 1.45, L = (n2o ? 30 : 20) + Math.random() * 10;
      const g = c.createLinearGradient(-20, 0, -20 - L, 0);
      g.addColorStop(0, n2o ? '#ffffff' : '#fff2b0'); g.addColorStop(0.35, n2o ? '#7cd0ff' : '#ffb347'); g.addColorStop(1, 'rgba(255,90,40,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-18, -7); c.quadraticCurveTo(-20 - L * 0.6, -6, -20 - L, 0); c.quadraticCurveTo(-20 - L * 0.6, 6, -18, 7); c.fill();
    }
    // 바퀴
    c.fillStyle = '#16181f';
    ktRR(c, -17, -15.5, 11, 6.5, 2.5); c.fill(); ktRR(c, -17, 9, 11, 6.5, 2.5); c.fill();
    for (const wy of [-12.3, 12.3]) { c.save(); c.translate(10, wy); c.rotate(st); ktRR(c, -5, -3, 10, 6, 2.5); c.fill(); c.restore(); }
    // 몸체
    const body = sc => { c.beginPath(); c.moveTo(21 * sc, 0); c.quadraticCurveTo(20 * sc, -7.5 * sc, 11 * sc, -9 * sc); c.lineTo(-11 * sc, -10.5 * sc); c.quadraticCurveTo(-16.5 * sc, -10.5 * sc, -16.5 * sc, -6 * sc); c.lineTo(-16.5 * sc, 6 * sc); c.quadraticCurveTo(-16.5 * sc, 10.5 * sc, -11 * sc, 10.5 * sc); c.lineTo(11 * sc, 9 * sc); c.quadraticCurveTo(20 * sc, 7.5 * sc, 21 * sc, 0); c.closePath(); };
    body(1); c.fillStyle = k.c2; c.fill();
    c.save(); c.translate(-0.8, -0.8); body(0.88); c.fillStyle = k.color; c.fill(); c.restore();
    c.fillStyle = k.c1; c.beginPath(); c.moveTo(19, 0); c.quadraticCurveTo(17, -4, 10, -5); c.lineTo(4, -5); c.lineTo(4, 5); c.lineTo(10, 5); c.quadraticCurveTo(17, 4, 19, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(5, -1.6, 12, 3.2);
    // 뒤 날개
    c.fillStyle = '#20232b'; ktRR(c, -21, -11.5, 5, 23, 2); c.fill();
    c.fillStyle = k.c1; c.fillRect(-21, -11.5, 5, 3); c.fillRect(-21, 8.5, 5, 3);
    // 운전자 헬멧
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(-2, 1.2, 7, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-3, 0, 6.6, 0, 7); c.fill();
    c.fillStyle = k.color; c.fillRect(-9.4, -1.4, 12.8, 2.8);
    c.fillStyle = '#1d2533'; c.beginPath(); c.arc(-3, 0, 6.6, -0.95, 0.95); c.lineTo(-3 + Math.cos(0.95) * 3, Math.sin(0.95) * 3); c.arc(-3, 0, 3, 0.95, -0.95, true); c.closePath(); c.fill();
    c.restore();
    // 물풍선에 갇힘 · 실드
    if (k.trap > 0) {
      const g = c.createRadialGradient(k.x - 8, k.y - 10, 4, k.x, k.y, 30); g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(0.5, 'rgba(120,205,255,.35)'); g.addColorStop(1, 'rgba(60,150,255,.55)');
      c.fillStyle = g; c.beginPath(); c.arc(k.x, k.y, 30 + Math.sin(now / 120) * 1.5, 0, 7); c.fill();
    }
    if (k.shield > 0) {
      c.strokeStyle = `rgba(143,227,255,${0.55 + Math.sin(now / 90) * 0.25})`; c.lineWidth = 3; c.fillStyle = 'rgba(143,227,255,.12)';
      c.beginPath(); c.arc(k.x, k.y, 28, 0, 7); c.fill(); c.stroke();
    }
    // 미사일 조준 표시
    if (this.R.hz.some(h => h.k === 'missile' && h.target === k.id)) {
      c.strokeStyle = `rgba(255,70,80,${0.6 + Math.sin(now / 70) * 0.35})`; c.lineWidth = 2.5;
      c.beginPath(); c.arc(k.x, k.y, 24, 0, 7); c.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + now / 300; c.beginPath(); c.moveTo(k.x + Math.cos(a) * 18, k.y + Math.sin(a) * 18); c.lineTo(k.x + Math.cos(a) * 31, k.y + Math.sin(a) * 31); c.stroke(); }
    }
  },
  drawFx(c) {
    for (const p of this.R.fx) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.k === 'ring') { c.strokeStyle = p.c; c.globalAlpha = a; c.lineWidth = 6 * a; c.beginPath(); c.arc(p.x, p.y, p.s * (1.4 - a), 0, 7); c.stroke(); }
      else if (p.k === 'spark') { c.strokeStyle = p.c; c.globalAlpha = a; c.lineWidth = p.s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke(); }
      else { c.fillStyle = p.c; c.globalAlpha = p.k === 'smoke' ? a * 0.8 : a; c.beginPath(); c.arc(p.x, p.y, p.k === 'smoke' ? p.s * (1.6 - a * 0.6) : p.s * (0.4 + a * 0.6), 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
  },
  /** 월드 좌표 → 화면 좌표 (이름표는 화면이 돌아가도 똑바로) */
  w2s(x, y) {
    const cam = this.R.cam, z = cam.z, a = this.viewRot || 0, dx = x - cam.x, dy = y - cam.y;
    return [this.W / 2 + (dx * Math.cos(a) - dy * Math.sin(a)) * z, this.H / 2 + (dx * Math.sin(a) + dy * Math.cos(a)) * z];
  },
  drawNames(c, z) {
    const R = this.R, up = 24 * z + 4;
    c.textAlign = 'center'; c.textBaseline = 'bottom'; c.font = 'bold 13px "Noto Sans KR", sans-serif'; c.lineWidth = 3.4; c.strokeStyle = 'rgba(0,0,0,.6)';
    for (const k of R.karts) {
      const [x, y] = this.w2s(k.x, k.y);
      if (x < -60 || x > this.W + 60 || y < -40 || y > this.H + 40) continue;
      if (k === R.me) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x, y - up + 2); c.lineTo(x - 7, y - up - 9); c.lineTo(x + 7, y - up - 9); c.closePath(); c.fill(); continue; }
      c.fillStyle = k.c1; c.strokeText(k.name, x, y - up); c.fillText(k.name, x, y - up);
    }
  },

  /* ─── HUD (화면 좌표) ─── */
  panel(c, x, y, w, h, r = 14) { c.fillStyle = 'rgba(12,14,30,.62)'; ktRR(c, x, y, w, h, r); c.fill(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.stroke(); },
  hud(c, W, H, now) {
    // 낮은 화면(휴대폰 가로)은 휴대폰 배치: 속도 · 아이템 칸을 위쪽에 (아래 모서리는 가상 패드 자리)
    const R = this.R, me = R.me, mob = W < 640 || H < 400 || (TOUCH && KTouch.on && !KTouch.port), u = mob ? clamp(W / 420, 0.72, 0.95) : clamp(W / 1100, 0.85, 1.2);
    const F = (px, fam = '"Black Han Sans", sans-serif') => `${Math.round(px * u)}px ${fam}`;
    const BH = '"Black Han Sans", sans-serif', NS = '"Noto Sans KR", sans-serif';
    c.textBaseline = 'alphabetic';
    // ① 순위 · 바퀴 · 시간
    const px = 12, py = 12, pw = (mob ? 150 : 176) * u, ph = 94 * u;
    this.panel(c, px, py, pw, ph);
    const pos = me.pos || 1;
    c.textAlign = 'left'; c.fillStyle = pos === 1 ? '#ffd23f' : '#ffffff'; c.font = F(50, BH);
    c.fillText(String(pos), px + 14 * u, py + 54 * u);
    const pwid = c.measureText(String(pos)).width;
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = F(19, BH); c.fillText(`위 / ${R.karts.length}`, px + 18 * u + pwid, py + 52 * u);
    c.font = F(15, BH); c.fillStyle = '#ffffff';
    c.fillText(`${clamp(me.lap, 1, R.laps)} / ${R.laps} 바퀴`, px + 14 * u, py + 80 * u);
    c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,.8)'; c.font = F(15, BH);
    c.fillText(ktFmt(me.fin != null ? me.fin : R.go ? R.t : 0), px + pw - 12 * u, py + 80 * u);
    // ② 미니맵 + 순위표
    const ms = (mob ? 118 : 178) * u, mx = W - ms - 12, my = 12;
    if (!R.mm || R.mm.size !== ms) R.mm = this.makeMini(R.T, ms);
    this.panel(c, mx, my, ms, ms);
    c.drawImage(R.mm.cv, mx, my, ms, ms);
    for (const k of R.order.slice().reverse()) {
      const X = mx + R.mm.ox + (k.x - R.T.bx0) * R.mm.sc, Y = my + R.mm.oy + (k.y - R.T.by0) * R.mm.sc;
      c.fillStyle = k.color; c.beginPath(); c.arc(X, Y, (k === me ? 5.5 : 4) * u, 0, 7); c.fill();
      if (k === me) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
    }
    if (!mob) {
      const rows = R.order, rh = 21 * u, ly = my + ms + 8, lh = rows.length * rh + 12;
      this.panel(c, mx, ly, ms, lh, 12);
      rows.forEach((k, i) => {
        const yy = ly + 6 + i * rh + rh * 0.72;
        if (k === me) { c.fillStyle = 'rgba(124,108,255,.35)'; ktRR(c, mx + 4, ly + 6 + i * rh, ms - 8, rh, 6); c.fill(); }
        c.textAlign = 'left'; c.fillStyle = i === 0 ? '#ffd23f' : 'rgba(255,255,255,.8)'; c.font = F(13, BH); c.fillText(String(i + 1), mx + 12, yy);
        c.fillStyle = k.color; c.beginPath(); c.arc(mx + 36 * u, yy - 5 * u, 5 * u, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.font = `${k === me ? 700 : 500} ${Math.round(12.5 * u)}px ${NS}`;
        c.fillText(k.name.length > 7 ? k.name.slice(0, 7) + '…' : k.name, mx + 48 * u, yy);
        if (k.fin != null) { c.textAlign = 'right'; c.fillStyle = '#7cf2b0'; c.font = F(11, BH); c.fillText('골인', mx + ms - 10, yy); }
      });
    }
    // ③ 속도 · 게이지 · 아이템
    const sp = Math.hypot(me.vx, me.vy) * KT.KMH;
    const iw = 64 * u, gapI = 10 * u;
    let sX, sY, sW, iX, iY;
    const slotW = mob ? 44 * u : iw;
    if (mob) { sW = pw; sX = px; sY = py + ph + 8; iX = W - 12 - slotW * 1.8 - gapI; iY = my + ms + 10; }
    else { sW = 230 * u; sX = 12; sY = H - 12 - 84 * u; iX = W - 12 - iw * 1.8 - gapI; iY = H - 12 - iw - 14 * u; }
    const sH = (R.mode === 'speed' ? (mob ? 52 : 84) : (mob ? 40 : 62)) * u;
    if (!mob) sY = H - 12 - sH;
    this.panel(c, sX, sY, sW, sH);
    c.textAlign = 'left'; c.fillStyle = me.boost > 0 ? '#7cd0ff' : '#ffffff'; c.font = F(mob ? 24 : 36, BH);
    c.fillText(String(Math.round(sp)), sX + 14 * u, sY + (mob ? 28 : 44) * u);
    const sw = c.measureText(String(Math.round(sp))).width;
    c.fillStyle = 'rgba(255,255,255,.65)'; c.font = F(mob ? 11 : 14, BH); c.fillText('km/h', sX + 18 * u + sw, sY + (mob ? 27 : 42) * u);
    // 속도 막대
    const bx = sX + 14 * u, bw = sW - 28 * u;
    if (R.mode === 'speed') {
      const gy = sY + sH - (mob ? 15 : 24) * u, gh = (mob ? 8 : 11) * u;
      c.fillStyle = 'rgba(255,255,255,.12)'; ktRR(c, bx, gy, bw, gh, gh / 2); c.fill();
      const gr = c.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#3d8bff'); gr.addColorStop(1, '#7cf2ff');
      c.fillStyle = gr; ktRR(c, bx, gy, Math.max(gh, bw * clamp(me.gauge / 100, 0, 1)), gh, gh / 2); c.fill();
      if (!mob) { c.fillStyle = 'rgba(255,255,255,.7)'; c.font = F(11, BH); c.textAlign = 'right'; c.fillText('부스터 게이지', sX + sW - 14 * u, gy - 6 * u); }
    }
    // 아이템 칸 2개
    for (let i = 0; i < 2; i++) {
      const X = iX + i * (slotW + gapI), Y = iY, sz = i === 0 ? slotW : slotW * 0.8, oy = i === 0 ? 0 : slotW * 0.1;
      this.panel(c, X, Y + oy, sz, sz, 12);
      const it = me.items[i];
      if (it) {
        const spin = i === 0 && me.itemSpin > 0;
        const show = spin ? ['banana', 'balloon', 'missile', 'shield', 'boost'][Math.floor(now / 70) % 5] : it;
        if (R.mode === 'speed' || !spin) this.itemIcon(c, show, X + sz / 2, Y + oy + sz / 2, sz * 0.62);
        else { c.globalAlpha = 0.6; this.itemIcon(c, show, X + sz / 2, Y + oy + sz / 2, sz * 0.62); c.globalAlpha = 1; }
      }
      if (i === 0 && !TOUCH) { c.font = F(10, BH); c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.55)'; c.strokeText('Ctrl / E', X + sz / 2, Y + sz + 12 * u); c.fillStyle = 'rgba(255,255,255,.85)'; c.fillText('Ctrl / E', X + sz / 2, Y + sz + 12 * u); }
    }
    // ④ 가운데 글자: 출발 신호 · 알림 · 역주행 · 골인
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (!R.go) {
      const n = Math.ceil(R.cd), lights = clamp(4 - n, 0, 3);
      const lw = 46 * u, lx = W / 2 - lw * 1.6, ly = mob ? H * 0.33 : H * 0.22;
      this.panel(c, lx - 10 * u, ly - lw / 2 - 8 * u, lw * 3.2 + 20 * u, lw + 16 * u, 18);
      for (let i = 0; i < 3; i++) { c.fillStyle = i < lights ? '#ff4757' : 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(lx + lw * 0.5 + i * lw * 1.1, ly, lw * 0.38, 0, 7); c.fill(); }
      c.fillStyle = '#fff'; c.font = F(n > 3 ? 40 : 84, BH);
      c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.35)';
      const txt = n > 3 ? '준비' : String(n);
      c.strokeText(txt, W / 2, H * 0.45); c.fillText(txt, W / 2, H * 0.45);
      if (TOUCH && !R.attract && me.local) {                                       // 휴대폰: 출발 부스터 타이밍 안내
        c.font = F(15, BH); c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.5)'; c.fillStyle = me.th0 != null && me.th0 > 0.6 ? '#ffb4a2' : '#7cf2ff';
        const tip = me.th0 != null && me.th0 > 0.6 ? '너무 빨라요! 손을 뗐다가 출발 직전에 다시' : '출발 직전에 조이스틱을 잡으면 출발 부스터!';
        c.strokeText(tip, W / 2, H * 0.45 + 62 * u); c.fillText(tip, W / 2, H * 0.45 + 62 * u);
      }
    } else if (R.t < 0.9 && !R.attract) {
      c.globalAlpha = 1 - R.t / 0.9; c.fillStyle = '#2ed573'; c.font = F(84 + R.t * 40, BH);
      c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.35)'; c.strokeText('출발!', W / 2, H * 0.45); c.fillText('출발!', W / 2, H * 0.45); c.globalAlpha = 1;
    }
    R.msgs.forEach((m, i) => {
      c.globalAlpha = clamp(m.t / 0.4, 0, 1); c.font = F(26, BH); c.fillStyle = m.color; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.45)';
      const y = H * 0.3 + i * 34 * u; c.strokeText(m.text, W / 2, y); c.fillText(m.text, W / 2, y); c.globalAlpha = 1;
    });
    if (R.wrongT > 0.7 && me.fin == null) {
      c.globalAlpha = 0.65 + Math.sin(now / 120) * 0.35; c.fillStyle = '#ff6b6b'; c.font = F(30, BH); c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.45)';
      c.strokeText('역주행 중이에요!', W / 2, H * 0.62); c.fillText('역주행 중이에요!', W / 2, H * 0.62); c.globalAlpha = 1;
    }
    if (R.hz.some(h => h.k === 'missile' && h.target === me.id) && me.fin == null) {
      c.fillStyle = `rgba(255,60,70,${0.12 + Math.sin(now / 80) * 0.08})`; c.fillRect(0, 0, W, H);
      c.fillStyle = '#ff4757'; c.font = F(24, BH); c.fillText('미사일 경고!', W / 2, H * 0.7);
    }
    if (R.hurry != null && R.hurry > 0 && me.fin == null) {
      c.fillStyle = '#ffd23f'; c.font = F(22, BH); c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.45)';
      const t = `1위 골인! ${Math.ceil(R.hurry)}초 안에 들어오세요`; c.strokeText(t, W / 2, H * 0.16 + (mob ? 70 : 0)); c.fillText(t, W / 2, H * 0.16 + (mob ? 70 : 0));
    }
    if (me.fin != null && R.banner != null) {
      const a = clamp(R.banner * 3, 0, 1), sc = 1 + Math.max(0, 0.4 - R.banner) * 1.2;
      c.globalAlpha = a; this.panel(c, W / 2 - 190 * u, H * 0.4 - 56 * u, 380 * u, 112 * u, 20);
      c.fillStyle = '#ffd23f'; c.font = F(46 * sc, BH); c.fillText('골인!', W / 2, H * 0.4 - 16 * u);
      c.fillStyle = '#fff'; c.font = F(19, BH);
      const rank = me.finRank ? `${me.finRank}위 · ` : '';
      c.fillText(`${rank}${ktFmt(me.fin)}`, W / 2, H * 0.4 + 24 * u);
      c.globalAlpha = 1;
      if (R.multi) { c.fillStyle = 'rgba(255,255,255,.8)'; c.font = F(14, NS); c.fillText('다른 사람이 들어오길 기다리는 중… (자동 주행)', W / 2, H * 0.4 + 76 * u); }
    }
    // 부스터 속도선
    if (me.boost > 0 && me.boostPow >= 1.25) {
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r0 = Math.min(W, H) * (0.42 + Math.random() * 0.1); c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); c.lineTo(W / 2 + Math.cos(a) * (r0 + 60), H / 2 + Math.sin(a) * (r0 + 60)); c.stroke(); }
    }
  },
  makeMini(T, size) {
    const dpr = this.dpr, cv = document.createElement('canvas'); cv.width = cv.height = Math.round(size * dpr);
    const g = cv.getContext('2d'), pad = 12, sc = Math.min((size - pad * 2) / (T.bx1 - T.bx0), (size - pad * 2) / (T.by1 - T.by0));
    const ox = (size - (T.bx1 - T.bx0) * sc) / 2, oy = (size - (T.by1 - T.by0) * sc) / 2;
    g.scale(dpr, dpr); g.lineJoin = 'round';
    g.beginPath(); T.pts.forEach(([x, y], i) => { const X = ox + (x - T.bx0) * sc, Y = oy + (y - T.by0) * sc; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 9; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.88)'; g.lineWidth = 5; g.stroke();
    const s0 = ktAt(T, 0);
    g.save(); g.translate(ox + (s0.x - T.bx0) * sc, oy + (s0.y - T.by0) * sc); g.rotate(s0.a); g.fillStyle = '#1c1d22'; g.fillRect(-2, -6, 4, 12); g.fillStyle = '#fff'; g.fillRect(-2, -6, 2, 3); g.fillRect(0, -3, 2, 3); g.fillRect(-2, 0, 2, 3); g.fillRect(0, 3, 2, 3); g.restore();
    return { cv, size, sc, ox, oy };
  },
  key(e) {
    const R = this.R;
    if (!R || R.attract || e.repeat) return;
    const me = R.me;
    if (!me.local || me.ai) return;
    if (R.go && (e.ctrlKey || e.metaKey) && e.code !== 'KeyW') e.preventDefault();      // Ctrl(아이템)+D 같은 브라우저 단축키 막기
    if (['ControlLeft', 'ControlRight', 'KeyE'].includes(e.code)) this.useItem(me);
    else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && R.go) {
      if (me.stun > 0 || me.trap > 0 || me.spin > 0) return this.flash('맞은 동안은 복귀할 수 없어요', '#ffb4a2');
      if (R.t - (me.respAt || -99) < 3) return;
      me.respAt = R.t;
      this.respawn(me);
    }
  },
};

/* ═════════ 휴대폰 · 태블릿 조작: 왼손 엄지 조이스틱(밀어서 조종) + 오른손 엄지 버튼 ═════════
 *  - 조이스틱은 왼쪽 아무 데나 엄지를 대면 그 자리에 생겨요(떠 있는 조이스틱). 멀리 밀면 받침이 따라와요.
 *    방향 조종(기본): 화면에서 가고 싶은 쪽으로 밀면 차가 그쪽으로 돌아요 (가로 화면처럼 화면이 안 돌아도 헷갈리지 않게)
 *    핸들 조종: 좌우로 민 만큼 핸들을 꺾어요 (키보드 ← → 와 같은 방식, 아날로그)
 *  - 오른쪽: 드리프트(가장 크게 · 엄지가 쉬는 자리) · 아이템 · 브레이크. 드리프트 버튼 색 = 모인 대시(흰색 → 파랑 → 주황)
 *  - 세로 화면은 화면 아래 띠(엄지 자리)에, 가로 화면은 길 위에 떠 있어요. 앱을 내리면 누르던 것은 모두 놓아요. */
const KTouch = {
  el: null, zone: null, joy: null, knob: null, stick: null, on: false, port: true, s: 1, R: 54, strip: 160, home: { x: 80, y: 600 },
  mode: 'dir', DEAD: 0.2, lv: null, has: null, hintT: 0,
  init() {
    if (!TOUCH || this.el) return;
    const el = this.el = document.createElement('div');
    el.id = 'kt-touch'; el.className = 'hidden'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="kt-zone" id="kt-zone"><div class="kt-joy idle" id="kt-joy"><i class="kt-base"><s class="l"></s><s class="r"></s><s class="u"></s><s class="d"></s></i>
        <i class="kt-knob" id="kt-knob"><b class="kt-kic" id="kt-kic">${icon('arrow-up')}</b></i><span class="kt-zhint" id="kt-zhint">엄지로 밀어서 조종</span></div></div>
      <button class="kt-b kt-drift" data-code="ShiftLeft" tabindex="-1">${icon('route')}<small>드리프트</small></button>
      <button class="kt-b kt-item" data-code="KeyE" tabindex="-1">${icon('sparkles')}<small>아이템</small></button>
      <button class="kt-b kt-brake" data-code="ArrowDown" tabindex="-1">${icon('hand-stop')}<small>브레이크</small></button>`;
    document.body.append(el);
    this.zone = el.querySelector('#kt-zone'); this.joy = el.querySelector('#kt-joy'); this.knob = el.querySelector('#kt-knob'); this.kic = el.querySelector('#kt-kic');
    this.drift = el.querySelector('.kt-drift'); this.item = el.querySelector('.kt-item');
    const z = this.zone;
    z.addEventListener('pointerdown', e => this.down(e));
    z.addEventListener('pointermove', e => this.move(e));
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) z.addEventListener(t, e => this.up(e));
    for (const b of el.querySelectorAll('.kt-b')) {
      b.addEventListener('pointerdown', e => this.press(e, b));
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, e => this.release(e, b));
    }
    el.addEventListener('contextmenu', e => e.preventDefault());                 // 길게 눌러도 메뉴 · 글자 고르기가 뜨지 않게
    addEventListener('resize', () => { if (this.on) this.layout(); });
    addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  },
  /** 화면 방향 · 크기에 맞춰 엄지 자리 다시 정하기 */
  layout() {
    const el = this.el; if (!el) return;
    const W = innerWidth, H = innerHeight;
    this.port = H >= W;
    this.s = clamp(Math.min(W, H) / 390, 1, 1.32);                               // 태블릿은 조금 크게
    this.strip = Math.round(clamp(H * 0.19, 138, 200));
    this.R = Math.round(52 * this.s);
    el.classList.toggle('port', this.port); el.classList.toggle('land', !this.port);
    el.style.setProperty('--s', this.s.toFixed(3)); el.style.setProperty('--strip', this.strip + 'px');
    el.style.setProperty('--jr', this.R + 'px'); el.style.setProperty('--kr', Math.round(this.R * 0.48) + 'px');
    el.classList.toggle('wheel', this.mode === 'wheel');
    // 조이스틱 자리는 버튼 왼쪽까지만 (세로 화면은 한 줄 띠라서 버튼과 겹치지 않게)
    const bl = Math.min(...[...el.querySelectorAll('.kt-b')].map(b => b.getBoundingClientRect().left));
    this.zone.style.width = this.port && isFinite(bl) ? Math.max(120, Math.round(bl - 14)) + 'px' : '';
    const r = this.zone.getBoundingClientRect();
    this.home = this.port
      ? { x: r.left + clamp(r.width * 0.42, this.R + 16, r.width - this.R - 8), y: r.top + r.height / 2 }
      : { x: r.left + clamp(r.width * 0.34, this.R + 26, r.width - this.R), y: r.top + r.height * 0.66 };
    this.draw();
  },
  /* ── 조이스틱 ── */
  down(e) {
    if (this.stick || !this.on) return;
    e.preventDefault();
    const m = this.R + 4, x = clamp(e.clientX, m, innerWidth - m), y = clamp(e.clientY, m, innerHeight - m);
    this.stick = { id: e.pointerId, bx: x, by: y, x: e.clientX, y: e.clientY };
    try { this.zone.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    this.hintT = 0; this.el.classList.add('nohint');
    this.draw();
  },
  move(e) {
    const s = this.stick; if (!s || e.pointerId !== s.id) return;
    e.preventDefault();
    s.x = e.clientX; s.y = e.clientY;
    const dx = s.x - s.bx, dy = s.y - s.by, d = Math.hypot(dx, dy), R = this.R;
    if (d > R) { const k = (d - R) / d; s.bx += dx * k; s.by += dy * k; }        // 손가락이 받침 밖으로 나가면 받침이 따라와요
    this.draw();
  },
  up(e) { const s = this.stick; if (!s || e.pointerId !== s.id) return; this.stick = null; this.draw(); },
  /** 조이스틱 방향 · 세기 (안 잡았으면 null) */
  vec() {
    const s = this.stick; if (!s) return null;
    const dx = s.x - s.bx, dy = s.y - s.by;
    return { dx, dy, m: Math.min(1, Math.hypot(dx, dy) / this.R), a: Math.atan2(dy, dx) };
  },
  /** 카트 핸들 값 (-1 ~ 1) · viewRot = 화면이 돌아간 만큼 (세로 화면) */
  steer(k, viewRot) {
    const v = this.vec(); if (!v) return null;
    if (this.mode === 'wheel') {
      const x = clamp(v.dx / this.R, -1, 1), dz = 0.1, ax = Math.abs(x);
      return ax < dz ? 0 : Math.sign(x) * Math.pow((ax - dz) / (1 - dz), 1.25);   // 가운데는 섬세하게, 끝까지 밀면 최대
    }
    if (v.m < this.DEAD) return 0;
    const want = v.a - (viewRot || 0);                                           // 화면 방향 → 트랙(세상) 방향
    return clamp(ktWrap(want - k.a) * 2.3, -1, 1);
  },
  draw() {
    if (!this.joy) return;
    const s = this.stick, r = this.zone.getBoundingClientRect();
    const bx = s ? s.bx : this.home.x, by = s ? s.by : this.home.y;
    this.joy.style.transform = `translate(${Math.round(bx - r.left)}px, ${Math.round(by - r.top)}px)`;
    let kx = 0, ky = 0;
    if (s) { const dx = s.x - s.bx, dy = s.y - s.by, d = Math.hypot(dx, dy), f = d > this.R ? this.R / d : 1; kx = dx * f; ky = dy * f; }
    if (this.mode === 'wheel') ky = 0;
    this.knob.style.transform = `translate(${Math.round(kx)}px, ${Math.round(ky)}px)`;
    this.kic.style.transform = this.mode === 'wheel' ? `rotate(${Math.round(clamp(kx / this.R, -1, 1) * 100)}deg)`
      : s && Math.hypot(kx, ky) > this.R * this.DEAD ? `rotate(${(Math.atan2(ky, kx) + Math.PI / 2).toFixed(3)}rad)` : '';
    this.joy.classList.toggle('idle', !s);
  },
  /* ── 오른쪽 버튼 ── */
  press(e, b) {
    e.preventDefault();
    if (!this.on || b.classList.contains('on')) return;
    try { b.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const code = b.dataset.code;
    b.classList.add('on'); Keys.add(code);
    if (code === 'KeyE') Kart.key({ code, repeat: false, ctrlKey: false, metaKey: false, preventDefault() {} });
    if (code !== 'ArrowDown' && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* 무시 */ } }   // 안드로이드: 살짝 떨림
  },
  release(e, b) { if (!b.classList.contains('on')) return; b.classList.remove('on'); Keys.delete(b.dataset.code); },
  /** 누르던 것 모두 놓기 (앱을 내리거나 게임이 끝날 때 — 드리프트 · 브레이크가 눌린 채로 남지 않게) */
  reset() {
    this.stick = null;
    if (this.el) for (const b of this.el.querySelectorAll('.kt-b.on')) { b.classList.remove('on'); Keys.delete(b.dataset.code); }
    this.draw();
  },
  /** 매 화면: 보일 때인지 · 드리프트 단계 · 아이템 준비 */
  sync() {
    if (!this.el) return;
    const R = Kart.R, ov = $('#overlay');
    const on = !!(R && !R.attract && R.me && R.me.local && S.screen === 'kart' && !(ov && ov.classList.contains('show')));   // 구경할 때는 안 보여요
    if (on !== this.on) {
      this.on = on;
      this.el.classList.toggle('hidden', !on);
      if (on) { this.mode = Kart.cfg.stick === 'wheel' ? 'wheel' : 'dir'; this.layout(); this.hintT = 6; this.el.classList.remove('nohint'); } else this.reset();
      Kart.fitted = false;                                                       // 세로 화면은 조작 띠만큼 길이 짧아져요
    }
    if (!on) return;
    const me = R.me;
    const lv = me && me.drift ? (me.driftT >= KT.DRIFT_LV[1] ? 2 : me.driftT >= KT.DRIFT_LV[0] ? 1 : 0) : -1;
    if (lv !== this.lv) { this.lv = lv; this.drift.dataset.lv = lv; }
    const has = !!(me && me.items.length && me.itemSpin <= 0 && me.fin == null);
    if (has !== this.has) { this.has = has; this.item.classList.toggle('has', has); }
    if (this.hintT > 0 && R.go) { this.hintT -= 1 / 60; if (this.hintT <= 0) this.el.classList.add('nohint'); }
    const fin = !!(me && me.fin != null);
    if (fin !== this.fin) { this.fin = fin; this.el.classList.toggle('fin', fin); if (fin) this.reset(); }   // 골인하면 흐리게 (자동으로 달려요)
  },
};
try { const st = store.get('kt_cfg', ''); if (st) Object.assign(Kart.cfg, JSON.parse(st)); } catch { /* 저장된 설정이 깨졌으면 기본값 */ }   // 멀티로 바로 들어와도 고른 조이스틱 방식을 써요
KTouch.init();

register('kart', {
  solo: () => Kart.solo(),
  stop: () => Kart.stop(),
  key: e => Kart.key(e),
  // 휴대폰 · 태블릿은 공용 가상 패드 대신 전용 조작(KTouch: 왼손 조이스틱 + 오른손 버튼)을 써요
});
Object.assign(ACT, {
  ktCfg: el => {
    const k = el.dataset.k, v = el.dataset.v, prevTrack = Kart.cfg.track;
    Kart.cfg[k] = k === 'mode' || k === 'stick' ? v : +v;
    if (k === 'stick') KTouch.mode = v === 'wheel' ? 'wheel' : 'dir';
    store.set('kt_cfg', JSON.stringify(Kart.cfg));
    Kart.renderSetup();
    if ((k === 'track' && prevTrack !== Kart.cfg.track) || k === 'mode') { stopLocal(); S.solo = null; Kart.attract(); }
  },
  ktGo: () => Kart.startSolo(),
});
socket.on('kt:start', d => Kart.startMulti(d));
socket.on('kt:sts', d => Kart.onStates(d));
socket.on('kt:use', d => Kart.onUse(d));
socket.on('kt:hit', d => Kart.onHit(d));
socket.on('kt:box', d => { const R = Kart.R; if (R && R.multi && d.from !== S.myId && R.boxes[d.i]) R.boxes[d.i].hide = 3; });
socket.on('kt:goal', d => {
  const R = Kart.R; if (!R || !R.multi) return;
  const k = R.karts.find(x => x.id === d.id);
  if (k) { k.finRank = d.rank; if (k.fin == null) k.fin = d.t / 1000; if (k === R.me) k.fin = d.t / 1000; }
  if (d.id !== S.myId) Kart.flash(`${d.name} 님 ${d.rank}위 골인!`, '#ffffff');
  Kart.rankAll();
});
socket.on('kt:hurry', d => { const R = Kart.R; if (R && R.multi) R.hurry = d.seconds; });
socket.on('kt:left', d => { const R = Kart.R; if (R && R.multi) { R.karts = R.karts.filter(k => k.id !== d.id || k === R.me); Kart.rankAll(); } });
