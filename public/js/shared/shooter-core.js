/* =====================================================================
 *  🚀 우주 슈팅 규칙 (v14.1 다시 만듦) — 그리기 · 조작은 js/shooter.js · js/shooter-art.js, 소리는 js/shooter-audio.js, 검사는 tests/shooter.test.js
 *  오락실 세로 슈팅:
 *  · 5스테이지 (성운 지대 · 소행성대 · 우주 정거장 · 붉은 행성 · 모선) — 스테이지마다 편대 · 중간 보스 · 보스(부위를 부숴야 코어가 열려요)
 *    다 깨면 2주차: 적 탄이 빨라지고, 쓰러진 적이 마지막 탄을 쏴요.
 *  · 총은 자동. 무기 3가지(퍼짐탄 · 레이저 · 유도탄) × 파워 1~6, 폭탄(처음 3개 · 터뜨리는 동안 무적 · 적 탄을 지워요)
 *  · 아이템은 4가지뿐: P 파워(다 차면 더 안 나와요) · 무기(정해진 색 — 수송선이 지금과 다른 무기를 차례로 줘요) · B 폭탄
 *    (메달 · 점수 별처럼 탄과 헷갈리는 건 없어요)
 *  · 점수: 격추 + 편대 전멸 보너스 + 보스(빨리 잡을수록 더) + 스테이지 보너스 · 5만 · 15만 · 30만 · 50만 … 점에 목숨 +1
 *  · 맞으면 목숨 −1 · 파워 −1 (떨어진 P 는 다시 주울 수 있어요) · 목숨을 다 잃으면 이어하기(점수는 0부터, 기록은 한 번에 낸 최고 점수)
 *  · 같은 씨앗(seed)과 같은 조작이면 같은 판이에요 (Math.random 을 쓰지 않아요). 1/60초씩 step 으로 움직여요.
 *  · 판 크기 가로 240 × 세로 320 — 길쭉한 휴대폰 화면은 세로를 440 까지 늘려요 (create 의 opt.H)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 240, H = 320, STEP = 1 / 60, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  /** 배열에서 조건에 맞는 것만 남겨요 (그 자리에서 — 매 걸음 새 배열을 만들지 않아서 가벼워요) */
  function keep(a, f) { let j = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (f(v)) a[j++] = v; } a.length = j; return a; }
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ───────── 무기 · 아이템 ───────── */
  const PMAX = 6, BMAX = 5;
  const WEAPONS = {
    V: { name: '퍼짐탄', en: 'SPREAD', color: '#4aa3ff', desc: '넓게 퍼지는 연사 — 적이 많을 때' },
    L: { name: '레이저', en: 'LASER', color: '#35d98a', desc: '앞으로 곧게 나가는 센 광선 — 보스에게' },
    M: { name: '유도탄', en: 'HOMING', color: '#a77bff', desc: '알아서 쫓아가는 미사일 — 조준 없이' },
  };
  const WCYCLE = ['V', 'L', 'M'];
  const ITEMS = {
    P: { name: '파워', color: '#ff6b6b' }, B: { name: '폭탄', color: '#ffb020' },
    V: { name: '퍼짐탄', color: '#4aa3ff' }, L: { name: '레이저', color: '#35d98a' }, M: { name: '유도탄', color: '#a77bff' },
  };
  // 퍼짐탄 갈래: [옆 위치, 각도(도)] — 파워 1~6
  const VPAT = [
    [[-3, 0], [3, 0]],
    [[-3, 0], [3, 0], [-5, -10], [5, 10]],
    [[-5, 0], [0, 0], [5, 0], [-6, -10], [6, 10]],
    [[-5, 0], [0, 0], [5, 0], [-6, -9], [6, 9], [-8, -19], [8, 19]],
    [[-6, 0], [-2, 0], [2, 0], [6, 0], [-6, -9], [6, 9], [-8, -19], [8, 19]],
    [[-6, 0], [-2, 0], [2, 0], [6, 0], [-6, -8], [6, 8], [-8, -17], [8, 17], [-10, -27], [10, 27]],
  ];
  const LASER_DPS = [40, 48, 56, 64, 74, 86], LASER_W = [2.5, 3.2, 4, 4.8, 5.6, 6.5];
  const MSL_N = [2, 2, 4, 4, 6, 6], MSL_EVERY = [0.5, 0.42, 0.46, 0.4, 0.44, 0.36], MSL_DMG = 2.6;
  /** 난이도 (0 쉬움 · 1 보통 · 2 어려움): 적 탄 빠르기 · 쏘는 빈도 · 체력 · 졸개가 쏠 확률 · 목숨 · 보스 시간 · 목숨 +1 점수 */
  const DIFF = [
    { key: 'easy', name: '쉬움', bsp: 0.84, frate: 0.7, hpm: 0.85, zako: 0.6, lives: 4, bossT: 150, ext: [50000, 150000, 300000, 500000], extStep: 300000 },
    { key: 'normal', name: '보통', bsp: 1, frate: 1, hpm: 1, zako: 1, lives: 3, bossT: 120, ext: [100000, 300000, 600000], extStep: 500000 },
    { key: 'hard', name: '어려움', bsp: 1.12, frate: 1.28, hpm: 1.15, zako: 1.4, lives: 3, bossT: 120, ext: [150000, 500000], extStep: 800000 },
  ];
  const EXTEND = DIFF[1].ext;
  /** 연습: 2스테이지 이상에서 시작하면 그 스테이지에 맞는 파워로 */
  const START_POWER = [1, 3, 5, 6, 6];
  /** 스테이지 별 3개: 클리어 · 노 미스 · 격추율 85% 이상 */
  const STAR_RATE = 0.85;

  /* ───────── 적 ───────── */
  // hp 는 1스테이지 기준 (스테이지마다 늘어요) · r 맞는 판정 · pts 점수 · sz 폭발 크기 1~3 · body 몸에 부딪히면 다쳐요
  const EN = {
    pop: { hp: 1, r: 5, pts: 50, sz: 1, body: true },              // 작은 마름모 드론 (떼로 와요)
    zako: { hp: 2, r: 5.5, pts: 100, sz: 1, body: true },          // 작은 전투기
    swoop: { hp: 3, r: 6, pts: 150, sz: 1, body: true },           // 화살 전투기 (편대 비행)
    kami: { hp: 6, r: 6, pts: 300, sz: 1, body: true },            // 멈칫했다가 들이받는 가시 기체
    mine: { hp: 8, r: 6.5, pts: 200, sz: 1, body: true },          // 우주 기뢰 (터지면 탄을 뿌려요)
    pebble: { hp: 4, r: 6, pts: 50, sz: 1, body: true },           // 작은 돌
    rock: { hp: 26, r: 13, pts: 300, sz: 2, body: true },          // 큰 돌 → 작은 돌 2개
    gun: { hp: 28, r: 10, pts: 600, sz: 2, body: true },           // 포격선 (멈춰서 3갈래)
    turret: { hp: 16, r: 7, pts: 400, sz: 2, body: false },        // 정거장 포탑
    carrier: { hp: 20, r: 9, pts: 500, sz: 2, body: false },       // 수송선 (부수면 무기 아이템)
    heavy: { hp: 120, r: 17, pts: 2000, sz: 3, body: true },       // 중순양함
    part: { hp: 1, r: 10, pts: 0, sz: 3, body: false },            // 보스 부위 (값은 보스마다)
  };

  /* ───────── 편대 경로 (왼쪽 기준 · 오른쪽은 좌우 뒤집기) ───────── */
  const PATHS = {
    swoopA: [[-14, 40], [30, 62], [80, 112], [118, 150], [150, 140], [180, 96], [212, 54], [262, 30]],
    loopA: [[-14, 70], [50, 80], [104, 118], [128, 166], [108, 206], [72, 196], [62, 154], [92, 116], [160, 96], [262, 84]],
    diveA: [[64, -14], [64, 70], [74, 128], [110, 160], [170, 156], [262, 128]],
    uturnA: [[46, -14], [46, 110], [60, 150], [90, 158], [112, 130], [112, 60], [112, -24]],
    crossA: [[20, -14], [70, 60], [150, 140], [262, 220]],
    zigA: [[40, -14], [100, 40], [40, 92], [100, 144], [40, 196], [100, 248], [40, 300], [100, 352]],
  };
  const pathCache = {};
  const cr = (a, b, c, d, t, k) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t3); };
  function pathOf(name, mir) {
    const key = name + (mir ? '>' : '<');
    if (pathCache[key]) return pathCache[key];
    const src = PATHS[name].map(([x, y]) => [mir ? W - x : x, y]), pts = [];
    for (let i = 0; i < src.length - 1; i++) {
      const a = src[Math.max(0, i - 1)], b = src[i], c = src[i + 1], d = src[Math.min(src.length - 1, i + 2)];
      for (let k = 0; k < 12; k++) { const t = k / 12; pts.push([cr(a, b, c, d, t, 0), cr(a, b, c, d, t, 1)]); }
    }
    pts.push(src[src.length - 1]);
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return (pathCache[key] = { pts, L, len: L[L.length - 1] });
  }
  function pathAt(P, d) {
    if (d >= P.len) return null;
    let lo = 0, hi = P.L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.L[m] <= d) lo = m; else hi = m; }
    const seg = P.L[hi] - P.L[lo] || 1, t = (d - P.L[lo]) / seg, a = P.pts[lo], b = P.pts[hi];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  /* ───────── 보스 · 중간 보스 ───────── */
  // 부위: id · dx dy (몸 기준) · r · hp · core(코어) · armor: 'guns' (다른 부위를 다 부숴야 열려요) · orbit: 몸 둘레를 돌아요
  // 단계(phases): when 'guns' = 코어 말고 다 부서지면 · 숫자 = 코어 체력이 그 비율 아래로 · pats = 쏘는 방법 (src 부위가 살아 있을 때만)
  //   pat: aim(노려 n갈래) · ring(둥글게) · spiral(돌아가며) · sweep(부채질) · burst(노려 연속) · split(터지는 큰 탄) · laser(예고 뒤 세로 광선) · mines · summon · rain(위에서)
  //   kind: o 분홍 구슬 · O 큰 주황 구슬 · n 하늘색 바늘 · s 보라 별 · B 터지는 큰 탄
  const MIDS = {
    stinger: { name: '스팅어', en: 'STINGER', w: 60, h: 46, y: 64, sway: 70, swayW: 0.7, pts: 8000,
      parts: [{ id: 'core', dx: 0, dy: 2, r: 15, hp: 340, core: true }],
      phases: [
        { pats: [{ src: 'core', pat: 'aim', n: 5, spread: 0.2, sp: 78, every: 1.8, delay: 0.8, kind: 'n' },
          { src: 'core', pat: 'ring', n: 12, sp: 52, rot: 0.11, every: 3.4, delay: 2.2, kind: 'o' }] },
        { when: 0.45, pats: [{ src: 'core', pat: 'spiral', arms: 1, sp: 64, spin: 0.42, every: 0.14, kind: 'o' },
          { src: 'core', pat: 'aim', n: 3, spread: 0.26, sp: 84, every: 2, delay: 0.6, kind: 'n' }] },
      ] },
    orb: { name: '오브 십', en: 'ORB SHIP', w: 64, h: 56, y: 66, sway: 60, swayW: 0.9, pts: 9000,
      parts: [{ id: 'core', dx: 0, dy: 0, r: 15, hp: 340, core: true, armor: 'guns' }, { id: 'podL', dx: -26, dy: 8, r: 9, hp: 100 }, { id: 'podR', dx: 26, dy: 8, r: 9, hp: 100 }],
      phases: [
        { pats: [{ src: 'podL', pat: 'aim', n: 2, spread: 0.18, sp: 82, every: 1.6, delay: 0.6, kind: 'n' },
          { src: 'podR', pat: 'aim', n: 2, spread: 0.18, sp: 82, every: 1.6, delay: 1.4, kind: 'n' },
          { src: 'core', pat: 'ring', n: 10, sp: 50, rot: 0.2, every: 3.8, delay: 2.4, kind: 'O' }] },
        { when: 'guns', pats: [{ src: 'core', pat: 'sweep', n: 1, sp: 70, a0: 0.5, a1: 2.64, sw: 1.6, every: 0.12, kind: 'o' },
          { src: 'core', pat: 'aim', n: 3, spread: 0.2, sp: 82, every: 2.6, delay: 1, kind: 'n' }] },
      ] },
  };
  const BOSSES = [
    { name: '강철 게', en: 'IRON CRAB', w: 124, h: 74, y: 70, sway: 56, swayW: 0.55, pts: 20000,
      parts: [{ id: 'core', dx: 0, dy: -2, r: 14, hp: 520, core: true, armor: 'guns' },
        { id: 'clawL', dx: -46, dy: 16, r: 12, hp: 150 }, { id: 'clawR', dx: 46, dy: 16, r: 12, hp: 150 }],
      phases: [
        { pats: [{ src: 'clawL', pat: 'aim', n: 3, spread: 0.26, sp: 78, every: 2.1, delay: 0.6, kind: 'n' },
          { src: 'clawR', pat: 'aim', n: 3, spread: 0.26, sp: 78, every: 2.1, delay: 1.65, kind: 'n' },
          { src: 'core', pat: 'ring', n: 12, sp: 48, rot: 0.13, every: 3.6, delay: 2.2, kind: 'O' }] },
        { when: 'guns', pats: [{ src: 'core', pat: 'spiral', arms: 2, sp: 58, spin: 0.26, every: 0.17, kind: 'o' },
          { src: 'core', pat: 'aim', n: 3, spread: 0.22, sp: 84, every: 2.6, delay: 1.2, kind: 'n' }] },
        { when: 0.35, pats: [{ src: 'core', pat: 'spiral', arms: 3, sp: 60, spin: 0.22, every: 0.16, kind: 'o' },
          { src: 'core', pat: 'ring', n: 12, sp: 46, rot: 0.1, every: 3.4, delay: 1, kind: 'O' }] },
      ] },
    { name: '바위 요새', en: 'ROCK FORTRESS', w: 112, h: 104, y: 74, sway: 46, swayW: 0.5, pts: 25000,
      parts: [{ id: 'core', dx: 0, dy: 0, r: 16, hp: 760, core: true, armor: 'guns' },
        ...[0, 1, 2, 3].map(i => ({ id: 'gun' + i, dx: 0, dy: 0, r: 9, hp: 120, orbit: { r: 42, a0: i * Math.PI / 2 + Math.PI / 4, w: 0.55 } }))],
      phases: [
        { pats: [0, 1, 2, 3].map(i => ({ src: 'gun' + i, pat: 'aim', n: 1, spread: 0, sp: 84, every: 2.3, delay: 0.5 + i * 0.57, kind: 'n' }))
          .concat([{ src: 'core', pat: 'mines', n: 2, every: 6, delay: 3 }, { src: 'core', pat: 'ring', n: 10, sp: 46, rot: 0.3, every: 4.4, delay: 2, kind: 'O' }]) },
        { when: 'guns', pats: [{ src: 'core', pat: 'ring', n: 18, gap: 4, sp: 50, rot: 0.37, every: 2, kind: 'o' },
          { src: 'core', pat: 'rain', n: 2, sp: 62, every: 1.8, delay: 0.8, kind: 'O' }] },
        { when: 0.35, pats: [{ src: 'core', pat: 'spiral', arms: 2, sp: 58, spin: 0.21, every: 0.15, kind: 'o' },
          { src: 'core', pat: 'aim', n: 3, spread: 0.3, sp: 86, every: 2.2, kind: 'n' }] },
      ] },
    { name: '방어 코어', en: 'GUARD CORE', w: 152, h: 60, y: 62, sway: 40, swayW: 0.45, pts: 30000,
      parts: [{ id: 'core', dx: 0, dy: 0, r: 14, hp: 820, core: true, armor: 'guns' },
        { id: 'emL', dx: -58, dy: 6, r: 11, hp: 230 }, { id: 'emR', dx: 58, dy: 6, r: 11, hp: 230 }],
      phases: [
        { pats: [{ src: 'emL', pat: 'laser', every: 3.9, delay: 1, w: 13 }, { src: 'emR', pat: 'laser', every: 3.9, delay: 2.95, w: 13 },
          { src: 'core', pat: 'aim', n: 3, spread: 0.22, sp: 76, every: 2.1, delay: 0.5, kind: 'O' },
          { src: 'emL', pat: 'aim', n: 1, sp: 86, every: 1.8, delay: 0.2, kind: 'n' }, { src: 'emR', pat: 'aim', n: 1, sp: 86, every: 1.8, delay: 1.1, kind: 'n' }] },
        { when: 'guns', pats: [{ src: 'core', pat: 'sweep', n: 1, sp: 78, a0: 0.4, a1: 2.74, sw: 2.2, every: 0.09, kind: 'o' },
          { src: 'core', pat: 'laser', every: 4.8, delay: 2, w: 15 }] },
        { when: 0.35, pats: [{ src: 'core', pat: 'spiral', arms: 3, sp: 60, spin: 0.24, every: 0.16, kind: 'o' },
          { src: 'core', pat: 'burst', n: 5, sp: 98, every: 2.5, delay: 1, kind: 'n' }] },
      ] },
    { name: '붉은 포격함', en: 'CRIMSON BOMBER', w: 136, h: 82, y: 72, sway: 52, swayW: 0.6, pts: 35000,
      parts: [{ id: 'core', dx: 0, dy: 10, r: 15, hp: 900, core: true, armor: 'guns' },
        { id: 'gunL', dx: -50, dy: 4, r: 11, hp: 250 }, { id: 'gunR', dx: 50, dy: 4, r: 11, hp: 250 }],
      phases: [
        { pats: [{ src: 'gunL', pat: 'sweep', n: 1, sp: 72, a0: 0.9, a1: 2.3, sw: 1.4, every: 0.18, kind: 'o' },
          { src: 'gunR', pat: 'sweep', n: 1, sp: 72, a0: 0.9, a1: 2.3, sw: -1.4, every: 0.18, kind: 'o' },
          { src: 'core', pat: 'split', sp: 50, every: 3.2, delay: 1.6, split: { after: 1.1, n: 8, sp: 62, kind: 'o' } }] },
        { when: 'guns', pats: [{ src: 'core', pat: 'burst', n: 6, sp: 100, every: 2, delay: 0.6, kind: 'n' },
          { src: 'core', pat: 'split', sp: 54, every: 2.7, delay: 1.4, split: { after: 1, n: 10, sp: 64, kind: 'o' } }] },
        { when: 0.35, pats: [{ src: 'core', pat: 'split', sp: 56, every: 1.9, split: { after: 0.9, n: 10, sp: 66, kind: 's' } },
          { src: 'core', pat: 'ring', n: 16, sp: 48, rot: 0.16, every: 2.3, delay: 1, kind: 'o' }] },
      ] },
    { name: '모선 코어', en: 'MOTHER CORE', w: 156, h: 112, y: 80, sway: 36, swayW: 0.4, pts: 50000,
      parts: [{ id: 'core', dx: 0, dy: 4, r: 17, hp: 1300, core: true, armor: 'guns' },
        { id: 'pod0', dx: -52, dy: -22, r: 10, hp: 210 }, { id: 'pod1', dx: 52, dy: -22, r: 10, hp: 210 },
        { id: 'pod2', dx: -40, dy: 34, r: 10, hp: 210 }, { id: 'pod3', dx: 40, dy: 34, r: 10, hp: 210 }],
      phases: [
        { pats: [0, 1, 2, 3].map(i => ({ src: 'pod' + i, pat: 'aim', n: 3, spread: 0.22, sp: 80, every: 2.4, delay: 0.5 + i * 0.6, kind: 'n' }))
          .concat([{ src: 'core', pat: 'ring', n: 16, sp: 48, rot: 0.12, every: 3.2, delay: 2, kind: 'O' }]) },
        { when: 'guns', pats: [{ src: 'core', pat: 'spiral', arms: 3, sp: 58, spin: 0.2, every: 0.16, kind: 'o' },
          { src: 'core', pat: 'summon', every: 7.5, delay: 3 }] },
        { when: 0.4, pats: [{ src: 'core', pat: 'ring', n: 16, sp: 48, rot: 0.13, every: 1.15, kind: 'o' },
          { src: 'core', pat: 'ring', n: 16, sp: 62, rot: -0.13, every: 1.15, delay: 0.57, kind: 's' },
          { src: 'core', pat: 'burst', n: 5, sp: 100, every: 2.6, delay: 1.1, kind: 'n' }] },
      ] },
  ];
  const BULLET_R = { o: 2.2, O: 3.6, n: 1.8, s: 2.6, B: 4.6 };

  /* ───────── 스테이지 ───────── */
  // [시각(초), 할 일, 값] — 중간 보스 · 보스가 있는 동안은 시간이 멈춰요
  // drop: 'P' 파워(다 찼으면 안 나와요) · 'B' 폭탄 — 수송선(carrier)은 언제나 무기 아이템 (지금과 다른 색을 차례로)
  const STAGES = [
    { name: '성운 지대', en: 'NEBULA', mid: 'stinger', tl: [
      [1.5, 'snake', { type: 'pop', n: 8, side: 'L', y: 58 }],
      [4.5, 'snake', { type: 'pop', n: 8, side: 'R', y: 86 }],
      [7.5, 'vform', { type: 'zako', n: 5, x: 120, drop: 'P' }],
      [11, 'path', { type: 'swoop', n: 5, path: 'swoopA' }],
      [13, 'path', { type: 'swoop', n: 5, path: 'swoopA', mir: true }],
      [16, 'carrier', { side: 'L', y: 70 }],
      [18, 'line', { type: 'zako', n: 4, x: 50 }], [18.2, 'line', { type: 'zako', n: 4, x: 190 }],
      [21.5, 'gun', { xs: [70, 170], y: 64 }],
      [27, 'rain', { type: 'pop', n: 14, dur: 4 }],
      [30, 'path', { type: 'zako', n: 6, path: 'diveA' }], [31, 'path', { type: 'zako', n: 6, path: 'diveA', mir: true }],
      [35, 'heavy', { x: 120 }],
      [41, 'vform', { type: 'zako', n: 7, x: 120, drop: 'B' }],
      [45, 'mid'],
      [46, 'carrier', { side: 'R', y: 80 }],
      [48, 'snake', { type: 'pop', n: 10, side: 'L', y: 50 }], [49, 'snake', { type: 'pop', n: 10, side: 'R', y: 100 }],
      [53, 'gun', { xs: [50, 120, 190], y: 70 }],
      [58, 'path', { type: 'swoop', n: 6, path: 'loopA', drop: 'P' }], [61, 'path', { type: 'swoop', n: 6, path: 'loopA', mir: true }],
      [65, 'kami', { xs: [60, 180] }], [66.5, 'kami', { xs: [100, 140] }],
      [70, 'heavy', { x: 70 }], [72, 'heavy', { x: 170 }],
      [78, 'rain', { type: 'zako', n: 10, dur: 5 }],
      [86, 'boss'],
    ] },
    { name: '소행성대', en: 'ASTEROID BELT', mid: 'orb', tl: [
      [1.5, 'rocks', { n: 5, dur: 6 }],
      [4, 'snake', { type: 'pop', n: 8, side: 'L', y: 70 }],
      [8, 'path', { type: 'swoop', n: 5, path: 'crossA' }], [9, 'path', { type: 'swoop', n: 5, path: 'crossA', mir: true }],
      [12, 'mines', { n: 5, dur: 5 }],
      [15, 'carrier', { side: 'R', y: 60 }],
      [17, 'gun', { xs: [60, 180], y: 60 }],
      [22, 'rocks', { n: 7, dur: 7 }],
      [24, 'vform', { type: 'zako', n: 7, x: 120, drop: 'P' }],
      [29, 'path', { type: 'zako', n: 7, path: 'uturnA' }], [30, 'path', { type: 'zako', n: 7, path: 'uturnA', mir: true }],
      [34, 'heavy', { x: 80 }], [36, 'heavy', { x: 160 }],
      [42, 'mid'],
      [43, 'carrier', { side: 'L', y: 80 }],
      [45, 'mines', { n: 8, dur: 6 }], [45.5, 'rocks', { n: 6, dur: 6 }],
      [52, 'snake', { type: 'swoop', n: 8, side: 'R', y: 60 }],
      [56, 'gun', { xs: [50, 120, 190], y: 64 }],
      [61, 'path', { type: 'swoop', n: 6, path: 'loopA', drop: 'B' }], [63, 'path', { type: 'swoop', n: 6, path: 'loopA', mir: true }],
      [67, 'kami', { xs: [40, 120, 200] }],
      [71, 'rocks', { n: 8, dur: 7 }], [72, 'rain', { type: 'zako', n: 10, dur: 6 }],
      [82, 'boss'],
    ] },
    { name: '우주 정거장', en: 'SPACE STATION', mid: 'stinger', tl: [
      [1.5, 'deck', { x: 62, w: 92, turrets: [-24, 24] }],
      [4, 'deck', { x: 178, w: 92, turrets: [-24, 24] }],
      [6, 'snake', { type: 'pop', n: 10, side: 'L', y: 64 }],
      [9, 'path', { type: 'swoop', n: 6, path: 'diveA' }], [10, 'path', { type: 'swoop', n: 6, path: 'diveA', mir: true }],
      [12, 'deck', { x: 120, w: 150, turrets: [-50, 0, 50] }],
      [15, 'carrier', { side: 'L', y: 70 }],
      [18, 'kami', { xs: [50, 190] }], [19.5, 'kami', { xs: [90, 150] }],
      [22, 'gun', { xs: [60, 120, 180], y: 58 }],
      [27, 'deck', { x: 68, w: 110, turrets: [-32, 0, 32] }], [29, 'deck', { x: 172, w: 110, turrets: [-32, 0, 32] }],
      [31, 'vform', { type: 'zako', n: 7, x: 120, drop: 'P' }],
      [36, 'heavy', { x: 120 }],
      [42, 'mid'],
      [43, 'carrier', { side: 'R', y: 70 }],
      [46, 'deck', { x: 120, w: 200, turrets: [-70, -24, 24, 70] }],
      [49, 'path', { type: 'zako', n: 8, path: 'loopA' }], [50, 'path', { type: 'zako', n: 8, path: 'loopA', mir: true }],
      [55, 'mines', { n: 6, dur: 5 }],
      [59, 'heavy', { x: 60 }], [61, 'heavy', { x: 180, drop: 'B' }],
      [66, 'snake', { type: 'swoop', n: 10, side: 'L', y: 56 }], [68, 'snake', { type: 'swoop', n: 10, side: 'R', y: 96 }],
      [73, 'kami', { xs: [30, 90, 150, 210] }],
      [80, 'boss'],
    ] },
    { name: '붉은 행성', en: 'CRIMSON PLANET', mid: 'orb', tl: [
      [1.5, 'path', { type: 'swoop', n: 7, path: 'swoopA' }], [2.5, 'path', { type: 'swoop', n: 7, path: 'swoopA', mir: true }],
      [6, 'gun', { xs: [50, 190], y: 56 }],
      [9, 'snake', { type: 'pop', n: 12, side: 'L', y: 60 }], [10, 'snake', { type: 'pop', n: 12, side: 'R', y: 90 }],
      [14, 'carrier', { side: 'L', y: 64 }],
      [16, 'heavy', { x: 120, drop: 'P' }],
      [22, 'path', { type: 'zako', n: 8, path: 'zigA' }], [22.5, 'path', { type: 'zako', n: 8, path: 'zigA', mir: true }],
      [27, 'kami', { xs: [40, 120, 200] }], [28.5, 'kami', { xs: [80, 160] }],
      [32, 'vform', { type: 'swoop', n: 9, x: 120, drop: 'P' }],
      [37, 'gun', { xs: [40, 100, 140, 200], y: 60 }],
      [43, 'mid'],
      [44, 'carrier', { side: 'R', y: 70 }],
      [47, 'heavy', { x: 70 }], [48, 'heavy', { x: 170 }],
      [53, 'rain', { type: 'swoop', n: 14, dur: 6 }],
      [60, 'path', { type: 'zako', n: 10, path: 'loopA', drop: 'B' }], [61, 'path', { type: 'zako', n: 10, path: 'loopA', mir: true }],
      [66, 'mines', { n: 8, dur: 6 }],
      [72, 'gun', { xs: [60, 120, 180], y: 64 }],
      [80, 'boss'],
    ] },
    { name: '모선', en: 'MOTHERSHIP', mid: 'stinger', tl: [
      [1.5, 'deck', { x: 120, w: 200, turrets: [-70, -24, 24, 70] }],
      [5, 'snake', { type: 'swoop', n: 10, side: 'L', y: 60 }], [6, 'snake', { type: 'swoop', n: 10, side: 'R', y: 92 }],
      [10, 'carrier', { side: 'L', y: 60 }],
      [12, 'heavy', { x: 70 }], [13, 'heavy', { x: 170, drop: 'P' }],
      [19, 'kami', { xs: [30, 90, 150, 210] }],
      [22, 'deck', { x: 68, w: 120, turrets: [-36, 0, 36] }], [24, 'deck', { x: 172, w: 120, turrets: [-36, 0, 36] }],
      [27, 'path', { type: 'zako', n: 10, path: 'loopA' }], [28, 'path', { type: 'zako', n: 10, path: 'loopA', mir: true }],
      [33, 'gun', { xs: [40, 100, 140, 200], y: 60 }],
      [38, 'mines', { n: 10, dur: 6 }],
      [43, 'mid'],
      [44, 'carrier', { side: 'R', y: 66 }],
      [46, 'vform', { type: 'swoop', n: 11, x: 120, drop: 'P' }],
      [51, 'heavy', { x: 60 }], [52, 'heavy', { x: 120 }], [53, 'heavy', { x: 180, drop: 'B' }],
      [60, 'rain', { type: 'zako', n: 16, dur: 6 }],
      [67, 'path', { type: 'swoop', n: 8, path: 'crossA' }], [67.5, 'path', { type: 'swoop', n: 8, path: 'crossA', mir: true }],
      [72, 'kami', { xs: [40, 100, 140, 200] }],
      [78, 'boss'],
    ] },
  ];

  /* ───────── 새 판 ───────── */
  function create(seed, opt = {}) {
    const h = Math.round(clamp(opt.H || H, 320, 440));                // 판 세로 길이: 휴대폰처럼 길쭉한 화면은 길게 (가로 240 은 그대로)
    const diff = opt.diff === 0 || opt.diff === 2 ? opt.diff : 1, stage = Math.max(1, Math.min(STAGES.length, Math.floor(opt.stage) || 1));
    const g = {
      H: h, seed: seed >>> 0, rnd: rng(seed), t: 0, uid: 0, diff, D: DIFF[diff], start: stage,
      stage, loop: 0,
      phase: 'intro', phaseT: 0, st: 0, wi: 0, hold: false, warn: 0, scroll: 26,
      p: newPlayer(h, DIFF[diff]), bombT: 0, stars: {},
      shots: [], msl: [], en: [], eb: [], items: [], hz: [], decks: [], pend: [], form: {}, boss: null, tg: [],
      score: 0, best: 0, credits: 1, ext: 0, wq: 1,
      stat: { kills: 0, spawned: 0, miss: 0, bombs: 0 }, sstat: null, clearT: 0, bonus: null, allClear: false,
      ev: [], step: 0,
    };
    g.sstat = { kills: 0, spawned: 0, miss: 0, t0: 0 };
    if (stage > 1) g.p.power = START_POWER[stage - 1];                // 연습 (순위에는 안 올라가요)
    tune(g);
    ev(g, 'stage', { n: g.stage, loop: g.loop, name: STAGES[g.stage - 1].name, en: STAGES[g.stage - 1].en });
    return g;
  }
  function newPlayer(h, D) {
    return { x: W / 2, y: (h || H) + 16, alive: true, enter: 0.9, inv: 2.2, dead: 0, lives: (D || DIFF[1]).lives, bombs: 3, power: 1, weapon: 'V',
      focus: false, bank: 0, ft: 0, mt: 0, vx: 0, vy: 0 };
  }
  /** 스테이지 · 주차에 따라 적 탄 빠르기 · 쏘는 빈도 · 체력 (1스테이지는 살살 → 5스테이지로 갈수록 조금씩) */
  const T_BSP = [0.9, 1, 1.08, 1.15, 1.22], T_FRATE = [0.8, 0.95, 1.08, 1.2, 1.3];
  const BOSS_HP = [1.3, 1.45, 1.6, 1.6, 1.5];                          // 보스는 파워가 다 찬 비행기에도 오래 버티게
  function tune(g) {
    const s = g.stage - 1, L = g.loop;
    g.bsp = T_BSP[s] * (L ? 1.15 + 0.05 * (L - 1) : 1) * g.D.bsp;
    g.frate = T_FRATE[s] * (L ? 1.2 + 0.08 * (L - 1) : 1) * g.D.frate;
    g.hpm = (1 + 0.12 * s) * (L ? 1.4 + 0.2 * (L - 1) : 1) * g.D.hpm;
  }
  const ev = (g, k, o) => { g.ev.push(Object.assign({ k }, o)); };

  /* ───────── 적 만들기 ───────── */
  function spawn(g, type, o) {
    const D = EN[type];
    const hp = Math.max(1, Math.round(D.hp * (type === 'pop' || type === 'zako' ? Math.min(g.hpm, 1.6) : g.hpm)));
    const e = Object.assign({ id: ++g.uid, type, x: 0, y: -12, vx: 0, vy: 0, hp, max: hp, r: D.r, age: 0, mv: 'lin', hit: 0, ang: Math.PI / 2, ft: 9, shots: 0 }, o);
    g.en.push(e);
    if (type !== 'part') { g.stat.spawned++; g.sstat.spawned++; }
    return e;
  }
  const later = (g, dt, fn) => g.pend.push({ at: g.t + dt, fn });
  function newForm(g, drop, n) { const id = 'f' + (++g.uid); g.form[id] = { n, kill: 0, gone: 0, drop, done: false }; return id; }
  /** 졸개가 한 번 쏠지: 스테이지가 오를수록 자주 */
  function zakoFire(g, type) {
    const s = g.stage - 1, L = g.loop ? 0.2 : 0;
    const p = type === 'zako' ? 0.26 + 0.09 * s + L : type === 'swoop' ? (s ? 0.18 + 0.07 * s + L : 0.1) : type === 'pop' ? (s >= 3 ? 0.12 + L : L * 0.5) : 0;
    return g.rnd() < p * g.D.zako ? 0.7 + g.rnd() * 1.6 : 99;
  }
  const OPS = {
    snake(g, a) {
      const f = newForm(g, a.drop, a.n), L = a.side === 'L';
      for (let i = 0; i < a.n; i++) later(g, i * (a.gap || 0.2), () => spawn(g, a.type, { mv: 'sine', x: L ? -10 : W + 10, y: a.y, y0: a.y, vx: (L ? 1 : -1) * (a.sp || 72), vy: 7, amp: a.amp || 15, w: 3.1, form: f, ft: zakoFire(g, a.type) }));
    },
    vform(g, a) {
      const f = newForm(g, a.drop, a.n);
      for (let i = 0; i < a.n; i++) {
        const k = Math.ceil(i / 2), s = i % 2 ? -1 : 1;
        spawn(g, a.type, { mv: 'lin', x: a.x + s * k * 16, y: -12 - k * 13, vy: a.sp || 62, form: f, ft: zakoFire(g, a.type) });
      }
    },
    path(g, a) {
      const f = newForm(g, a.drop, a.n);
      for (let i = 0; i < a.n; i++) later(g, i * (a.gap || 0.24), () => spawn(g, a.type, { mv: 'path', path: a.path, mir: !!a.mir, sp: a.sp || 92, x: -40, y: -40, form: f, ft: zakoFire(g, a.type) }));
    },
    line(g, a) {
      const f = newForm(g, a.drop, a.n);
      for (let i = 0; i < a.n; i++) later(g, i * 0.36, () => spawn(g, a.type, { mv: 'lin', x: a.x, y: -12, vy: a.sp || 86, form: f, ft: zakoFire(g, a.type) }));
    },
    rain(g, a) {
      for (let i = 0; i < a.n; i++) {
        const x = 20 + g.rnd() * (W - 40), sp = 64 + g.rnd() * 34, at = (i / a.n) * a.dur;
        later(g, at, () => spawn(g, a.type, { mv: 'lin', x, y: -12, vy: sp, vx: (W / 2 - x) * 0.08, ft: zakoFire(g, a.type) }));
      }
    },
    gun(g, a) { a.xs.forEach((x, i) => later(g, i * 0.3, () => spawn(g, 'gun', { mv: 'hover', x, y: -18, stopY: a.y + (i % 2) * 10, stay: a.stay || 6.5, ft: 1.1 + i * 0.3 }))); },
    heavy(g, a) { spawn(g, 'heavy', { mv: 'heavy', x: a.x, y: -26, vy: 22, ft: 1.4, ft2: 2.6, drop: a.drop }); },
    carrier(g, a) { const L = a.side === 'L'; spawn(g, 'carrier', { mv: 'cross', x: L ? -20 : W + 20, y: a.y, y0: a.y, vx: L ? 50 : -50, item: 'W' }); },
    kami(g, a) { a.xs.forEach(x => spawn(g, 'kami', { mv: 'kami', x, y: -12, ky: 36 + g.rnd() * 24 })); },
    mines(g, a) { for (let i = 0; i < a.n; i++) { const x = 24 + g.rnd() * (W - 48), at = (i / a.n) * a.dur; later(g, at, () => spawn(g, 'mine', { mv: 'mine', x, y: -12, vy: 26 + g.rnd() * 10, x0: x, w: 1 + g.rnd() })); } },
    rocks(g, a) { for (let i = 0; i < a.n; i++) { const x = 20 + g.rnd() * (W - 40), at = (i / a.n) * a.dur; later(g, at, () => spawn(g, 'rock', { mv: 'drift', x, y: -18, vx: (g.rnd() - 0.5) * 24, vy: 30 + g.rnd() * 16, spin: (g.rnd() - 0.5) * 2 })); } },
    deck(g, a) {
      const d = { id: ++g.uid, x: a.x, y: -30, w: a.w, h: 34 };
      g.decks.push(d);
      for (const dx of a.turrets) spawn(g, 'turret', { mv: 'deck', deck: d, dx, x: a.x + dx, y: d.y, ft: 1 + g.rnd() * 1.4 });
    },
    mid(g) { g.hold = true; spawnBoss(g, MIDS[STAGES[g.stage - 1].mid], true); },
    boss(g) { g.hold = true; g.warn = 3.2; const B = BOSSES[g.stage - 1]; ev(g, 'warn', { name: B.name, en: B.en }); },
  };

  /* ───────── 보스 ───────── */
  function spawnBoss(g, def, mid) {
    const mul = g.hpm * (mid ? 1 : BOSS_HP[g.stage - 1]);
    const b = { def, mid, x: W / 2, y: -def.h, ty: def.y, t: 0, enter: 2.6, ph: 0, guns: [], dying: 0, gone: false, timer: mid ? 30 : g.D.bossT, booms: 0, flash: 0, nb: 0 };
    b.parts = def.parts.map(pd => {
      const hp = Math.round(pd.hp * mul);
      return spawn(g, 'part', { mv: 'part', boss: b, pid: pd.id, pd, dx: pd.dx, dy: pd.dy, r: pd.r, hp, max: hp, core: !!pd.core, x: b.x + pd.dx, y: b.y + pd.dy });
    });
    b.core = b.parts.find(p => p.core);
    g.boss = b;
    setPhase(g, b, 0);
    ev(g, mid ? 'midIn' : 'bossIn', { name: def.name, en: def.en });
    return b;
  }
  function setPhase(g, b, i) {
    b.ph = i;
    b.guns = b.def.phases[i].pats.map(p => ({ p, t: p.delay || 0.3, a: 0, sw: 0 }));
    if (i > 0) { cancel(g); ev(g, 'phase', { x: b.x, y: b.y }); }
  }
  const partOf = (b, id) => b.parts.find(p => p.pid === id);
  const gunsDead = b => b.parts.every(p => p.core || p.dead);
  function bossUpdate(g) {
    const b = g.boss, D = b.def;
    b.t += STEP; b.flash = Math.max(0, b.flash - STEP);
    if (b.dying > 0) {                                                     // 터지는 중: 여기저기 폭발
      b.dying -= STEP; b.y += 8 * STEP;
      if ((b.booms += STEP) > 0.2) { b.booms = 0; b.nb++; ev(g, 'bossBoom', { x: b.x + (g.rnd() - 0.5) * D.w * 0.8, y: b.y + (g.rnd() - 0.5) * D.h * 0.7, mid: b.mid, n: b.nb }); }
      if (b.dying <= 0) bossGone(g, b, true);
      return;
    }
    if (b.leaving) { b.y -= 70 * STEP; if (b.y < -D.h - 10) bossGone(g, b, false); return; }
    if (b.enter > 0) { b.enter -= STEP; b.y += (b.ty - b.y) * Math.min(1, STEP * 2.2); }
    else {
      b.x = W / 2 + Math.sin(b.t * D.swayW) * D.sway;
      b.y = b.ty + Math.sin(b.t * D.swayW * 1.7) * 6;
      if ((b.timer -= STEP) <= 0) { b.leaving = true; for (const p of b.parts) p.armor = true; ev(g, 'escape', { mid: b.mid }); return; }
    }
    const open = !b.parts.some(p => !p.core && !p.dead);
    for (const p of b.parts) {                                              // 부위 위치
      if (p.pd.orbit) { const o = p.pd.orbit, a = o.a0 + b.t * o.w; p.dx = Math.cos(a) * o.r; p.dy = Math.sin(a) * o.r * 0.8; }
      p.x = b.x + p.dx; p.y = b.y + p.dy;
      p.armor = b.enter > 0 || (p.core && p.pd.armor === 'guns' && !open);
    }
    if (b.enter > 0) return;
    // 다음 단계?
    const nx = D.phases[b.ph + 1];
    if (nx && ((nx.when === 'guns' && open) || (typeof nx.when === 'number' && b.core.hp <= b.core.max * nx.when))) setPhase(g, b, b.ph + 1);
    if (!g.p.alive) return;
    for (const gn of b.guns) {
      const src = partOf(b, gn.p.src);
      if (!src || src.dead) continue;
      if ((gn.t -= STEP * g.frate) > 0) continue;
      gn.t += gn.p.every;
      pattern(g, gn, src.x, src.y + 4, b);
    }
  }
  function bossGone(g, b, killed) {
    g.boss = null; g.hold = false;
    for (const p of b.parts) { p.dead = true; p.gone = true; }
    if (!b.mid) { if (killed) ev(g, 'bossEnd', { x: b.x, y: b.y }); stageClear(g, killed); }
    else if (killed) ev(g, 'midEnd', { x: b.x, y: b.y });
  }
  function bossKilled(g, b) {
    const D = b.def;
    b.dying = b.mid ? 0.9 : 1.8; b.flash = 0.3; b.booms = 0.1;
    cancel(g);
    const pts = D.pts + (b.mid ? 0 : Math.max(0, Math.round((90 - b.t) * 200)));
    addScore(g, pts);
    ev(g, 'bossDie', { x: b.x, y: b.y, pts, mid: b.mid });
    if (b.mid) { const d = powerDrop(g); if (d) dropItem(g, d, b.x - 12, b.y); dropItem(g, 'B', b.x + 12, b.y); }
  }

  /* ───────── 쏘기 ───────── */
  function bullet(g, x, y, ang, sp, kind = 'o', extra) {
    const s = sp * g.bsp;
    g.eb.push(Object.assign({ x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, r: BULLET_R[kind] || 2.2, kind, age: 0 }, extra));
  }
  const aimAt = (g, x, y) => Math.atan2(g.p.y - y, g.p.x - x);
  function fan(g, x, y, ang, n, spread, sp, kind) { for (let i = 0; i < n; i++) bullet(g, x, y, ang + (i - (n - 1) / 2) * spread, sp, kind); }
  function pattern(g, gn, x, y, b) {
    const P = gn.p, k = P.kind || 'o';
    switch (P.pat) {
      case 'aim': fan(g, x, y, aimAt(g, x, y), P.n, P.spread || 0, P.sp, k); break;
      case 'ring': {
        gn.a += P.rot || 0;
        const n = P.n, gap = P.gap || 0, g0 = gap ? Math.floor(((gn.a / TAU) % 1 + 1) % 1 * n) : -1;
        for (let i = 0; i < n; i++) { if (gap && ((i - g0 + n) % n) < gap) continue; bullet(g, x, y, gn.a + (i / n) * TAU, P.sp, k); }
        break;
      }
      case 'spiral': gn.a += P.spin; for (let i = 0; i < P.arms; i++) bullet(g, x, y, gn.a + (i / P.arms) * TAU, P.sp, k); break;
      case 'sweep': {
        gn.sw += P.every * P.sw;
        const m = (Math.sin(gn.sw) + 1) / 2, a = P.a0 + (P.a1 - P.a0) * m;
        for (let i = 0; i < P.n; i++) bullet(g, x, y, a + (i - (P.n - 1) / 2) * 0.5, P.sp, k);
        break;
      }
      case 'burst': { const a = aimAt(g, x, y); for (let i = 0; i < P.n; i++) later(g, i * 0.075, () => { if (g.boss === b && b.dying <= 0 && !b.leaving) bullet(g, b.x + (x - b.x), b.y + (y - b.y), a, P.sp, k); }); break; }
      case 'split': bullet(g, x, y, aimAt(g, x, y) + (g.rnd() - 0.5) * 0.3, P.sp, 'B', { split: P.split }); break;
      case 'laser': { const lx = clamp(g.p.x, 10, W - 10); g.hz.push({ x: lx, y0: y, w: P.w || 13, warn: 1.15, on: 0.65 }); ev(g, 'laserWarn', { x: lx }); break; }
      case 'mines': for (let i = 0; i < P.n; i++) spawn(g, 'mine', { mv: 'mine', x: x + (i ? 20 : -20), y, vy: 34, x0: x + (i ? 20 : -20), w: 1.2 }); break;
      case 'summon': [-1, 1].forEach(s => spawn(g, 'kami', { mv: 'kami', x: x + s * 40, y: y, ky: y + 30 })); break;
      case 'rain': for (let i = 0; i < P.n; i++) bullet(g, 14 + g.rnd() * (W - 28), -6, Math.PI / 2 + (g.rnd() - 0.5) * 0.2, P.sp, k); break;
    }
    ev(g, 'eshot', { x, y });
  }

  /* ───────── 적 움직임 · 쏘기 ───────── */
  function moveEnemy(g, e) {
    e.age += STEP;
    const px = e.x, py = e.y;
    switch (e.mv) {
      case 'lin': e.x += e.vx * STEP; e.y += e.vy * STEP; break;
      case 'sine': e.x += e.vx * STEP; e.y = e.y0 + Math.sin(e.age * e.w) * e.amp + e.vy * e.age; break;
      case 'path': {
        const q = pathAt(pathOf(e.path, e.mir), e.age * e.sp);
        if (!q) { e.gone = true; return; }
        e.x = q[0]; e.y = q[1];
        break;
      }
      case 'hover':
        if (!e.leave) { e.y += (e.stopY - e.y) * Math.min(1, STEP * 2.4); e.x += Math.sin(e.age * 1.3) * 10 * STEP; if (e.age > e.stay) e.leave = true; }
        else { e.vy = Math.max(-90, (e.vy || 0) - 120 * STEP); e.y += e.vy * STEP; }
        break;
      case 'heavy': e.y += (e.y < 70 ? e.vy : 9) * STEP; e.x += Math.sin(e.age * 0.6) * 6 * STEP; break;
      case 'cross': e.x += e.vx * STEP; e.y = e.y0 + Math.sin(e.age * 2.4) * 6; break;
      case 'kami':
        if (e.age < 0.7) e.y += (e.ky - e.y) * Math.min(1, STEP * 5);
        else if (e.age < 1.25) { e.warn = true; }
        else {
          if (!e.dash) { e.dash = true; e.warn = false; const a = g.p.alive ? Math.atan2(g.p.y - e.y, g.p.x - e.x) : Math.PI / 2; e.vx = Math.cos(a) * 205; e.vy = Math.sin(a) * 205; ev(g, 'dash', { x: e.x, y: e.y }); }
          e.x += e.vx * STEP; e.y += e.vy * STEP;
        }
        break;
      case 'mine': e.y += e.vy * STEP; e.x = e.x0 + Math.sin(e.age * e.w * 1.6) * 10; if (e.age > 7.5 && e.y > 0 && e.y < g.H) { boom(g, e, true); return; } break;
      case 'drift': e.x += e.vx * STEP; e.y += e.vy * STEP; e.ang += (e.spin || 0) * STEP; if (e.x < 8 || e.x > W - 8) e.vx = -e.vx; break;
      case 'deck': e.x = e.deck.x + e.dx; e.y = e.deck.y + 4; break;
      case 'part': return;
    }
    if (e.mv !== 'drift') { const dx = e.x - px, dy = e.y - py; if (dx * dx + dy * dy > 0.0004) e.ang = Math.atan2(dy, dx); }
    if (e.age > 0.6 && (e.x < -44 || e.x > W + 44 || e.y > g.H + 44 || e.y < -80)) e.gone = true;
  }
  const canFire = (g, e) => g.p.alive && g.p.enter <= 0 && e.y > 6 && e.y < Math.min(g.H * 0.72, 250) && d2(e.x, e.y, g.p.x, g.p.y) > 44 * 44;
  function fireEnemy(g, e) {
    if (e.mv === 'part') return;
    e.ft -= STEP * g.frate;
    if (e.ft > 0 || !canFire(g, e)) return;
    const t = e.type;
    if (t === 'zako' || t === 'swoop' || t === 'pop') { bullet(g, e.x, e.y + 4, aimAt(g, e.x, e.y), 78, 'o'); e.ft = 99; }
    else if (t === 'gun') { fan(g, e.x, e.y + 8, aimAt(g, e.x, e.y), 3, 0.24, 84, 'n'); e.ft = 1.7; }
    else if (t === 'turret') { bullet(g, e.x, e.y, aimAt(g, e.x, e.y), 80, 'O'); e.ft = 2.0; }
    else if (t === 'heavy') {
      for (const s of [-1, 1]) fan(g, e.x + s * 14, e.y + 10, aimAt(g, e.x + s * 14, e.y + 10), 2, 0.12, 82, 'n');
      e.ft = 1.5;
      if (g.stage >= 2 || g.loop) { if ((e.ft2 -= 1.5) <= 0) { e.ft2 = 3.5; for (let i = 0; i < 10; i++) bullet(g, e.x, e.y, (i / 10) * TAU + e.age, 50, 'O'); } }
    } else return;
    ev(g, 'eshot', { x: e.x, y: e.y });
  }

  /* ───────── 내 비행기 ───────── */
  function addShot(g, x, y, deg, sp, dmg, k, src) {
    const a = (deg * Math.PI) / 180;
    g.shots.push({ x, y, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, dmg, r: 3, k, src: src || 0 });
  }
  function playerFire(g) {
    const p = g.p, lv = p.power;
    // 쏘는 시계: 다른 무기를 쓰는 동안 미사일 시계가 계속 줄어들면, 유도탄으로 바꾸는 순간 밀린 만큼 매 걸음 미사일이 쏟아져요 (v14.0 버그)
    // → 지금 무기의 시계만 줄이고, 한 걸음보다 더 밀리지 않게 막아요
    p.ft = Math.max(-STEP, p.ft - STEP);
    if (p.weapon === 'M') p.mt = Math.max(-STEP, p.mt - STEP);
    let fired = false;
    if (p.weapon === 'V') {
      if (p.ft <= 0) { p.ft += 0.075; for (const [dx, a] of VPAT[lv - 1]) addShot(g, p.x + dx, p.y - 8, a, 430, 1, 'V'); fired = true; }
    } else if (p.weapon === 'L') {
      g.shots.push({ x: p.x, y: p.y - 10, vx: 0, vy: -760, dmg: LASER_DPS[lv - 1] * STEP, r: LASER_W[lv - 1], k: 'L', src: 0 });
      if (p.ft <= 0) { p.ft += 0.09; fired = true; }
    } else {
      if (p.ft <= 0) { p.ft += 0.1; addShot(g, p.x - 3, p.y - 8, 0, 430, 1, 'M'); addShot(g, p.x + 3, p.y - 8, 0, 430, 1, 'M'); fired = true; }
      if (p.mt <= 0) {
        p.mt += MSL_EVERY[lv - 1];
        const n = MSL_N[lv - 1];
        for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1, k = Math.floor(i / 2); g.msl.push({ x: p.x + s * 6, y: p.y + 2, a: -Math.PI / 2 + s * (0.9 + k * 0.35), sp: 120, dmg: MSL_DMG, life: 2.6, src: 0 }); }
      }
    }
    if (fired) ev(g, 'shot', { w: p.weapon });
  }
  function movePlayer(g, inp) {
    const p = g.p;
    p.focus = !!inp.focus;
    if (p.enter > 0) { p.enter -= STEP; p.y += (g.H - 46 - p.y) * Math.min(1, STEP * 6); p.bank *= 0.8; return; }
    const ox = p.x, oy = p.y;
    if (inp.kx || inp.ky) {
      const n = Math.hypot(inp.kx, inp.ky) || 1, sp = p.focus ? 74 : 152;
      p.x += (inp.kx / n) * sp * STEP; p.y += (inp.ky / n) * sp * STEP;
    } else if (inp.tx != null && Number.isFinite(inp.tx) && Number.isFinite(inp.ty)) {
      const dx = inp.tx - p.x, dy = inp.ty - p.y, d = Math.hypot(dx, dy), max = (inp.fast ? 520 : 330) * (p.focus ? 0.5 : 1) * STEP;
      if (d > max) { p.x += (dx / d) * max; p.y += (dy / d) * max; } else { p.x = inp.tx; p.y = inp.ty; }
    }
    p.x = clamp(p.x, 7, W - 7); p.y = clamp(p.y, 16, g.H - 10);
    p.vx = (p.x - ox) / STEP; p.vy = (p.y - oy) / STEP;
    p.bank += (clamp(p.vx / 120, -1, 1) - p.bank) * Math.min(1, STEP * 10);
  }

  /* ───────── 맞히기 · 점수 ───────── */
  function addScore(g, v) {
    g.score += v;
    while (g.score >= nextExtend(g, g.ext)) { g.ext++; if (g.p.lives < 6) { g.p.lives++; ev(g, 'extend', {}); } }
    if (g.score > g.best) g.best = g.score;
  }
  /** 목숨 +1 점수 (난이도마다 · 표가 끝나면 일정한 간격으로) */
  const nextExtend = (g, i) => { const X = g.D.ext; return i < X.length ? X[i] : X[X.length - 1] + (i - X.length + 1) * g.D.extStep; };
  function hurt(g, e, dmg, x, y) {
    if (e.dead || e.gone) return;
    if (e.armor) { if (g.rnd() < 0.15) ev(g, 'clink', { x, y }); return; }
    e.hp -= dmg; e.hit = 3;
    if (e.boss) e.boss.flash = Math.max(e.boss.flash, 0.04);
    if (g.rnd() < (e.type === 'part' || e.type === 'heavy' ? 0.2 : 0.35)) ev(g, 'hit', { x, y, big: e.type === 'part' || e.type === 'heavy' });
    if (e.hp <= 0) kill(g, e);
  }
  function kill(g, e) {
    if (e.dead) return;
    e.dead = true;
    const D = EN[e.type];
    if (e.type === 'part') {
      const b = e.boss;
      if (e.core) { bossKilled(g, b); return; }
      const pts = b.mid ? 1500 : 3000;
      addScore(g, pts);
      ev(g, 'partKill', { x: e.x, y: e.y, pts });
      return;
    }
    g.stat.kills++; g.sstat.kills++;
    const pts = D.pts;
    addScore(g, pts);
    ev(g, 'kill', { x: e.x, y: e.y, sz: D.sz, type: e.type, pts, ang: e.ang });
    if (e.drop) { const d = e.drop === 'P' ? powerDrop(g) : e.drop; if (d) dropItem(g, d, e.x, e.y); }
    if (e.item) dropItem(g, weaponDrop(g), e.x, e.y);
    if (e.type === 'mine') boom(g, e, false);
    if (e.type === 'rock') for (const s of [-1, 1]) spawn(g, 'pebble', { mv: 'drift', x: e.x + s * 6, y: e.y, vx: s * (26 + g.rnd() * 20), vy: 40 + g.rnd() * 20, spin: s * 3, ang: 0 });
    // 2주차: 쓰러지면서 마지막 탄 한 발
    if (g.loop && D.sz === 1 && e.type !== 'mine' && g.p.alive && d2(e.x, e.y, g.p.x, g.p.y) > 60 * 60) bullet(g, e.x, e.y, aimAt(g, e.x, e.y), 72, 'o');
    if (e.form) {
      const f = g.form[e.form];
      f.kill++;
      if (!f.done && f.kill === f.n && !f.gone) {
        f.done = true;
        const bonus = Math.round((300 + 100 * f.n) * (1 + 0.25 * (g.stage - 1)) / 100) * 100;
        addScore(g, bonus);
        ev(g, 'formation', { x: e.x, y: e.y, pts: bonus });
        if (f.drop) { const d = f.drop === 'P' ? powerDrop(g) : f.drop; if (d) dropItem(g, d, e.x, e.y); }
      }
    }
  }
  /** 기뢰: 터지면 둥글게 탄 (스스로 터질 때도) */
  function boom(g, e, self) {
    if (self) { e.dead = true; e.gone = true; ev(g, 'kill', { x: e.x, y: e.y, sz: 1, type: 'mine', pts: 0, self: true }); }
    if (g.stage >= 2 || g.loop || self) { const n = self ? 10 : 8; for (let i = 0; i < n; i++) bullet(g, e.x, e.y, (i / n) * TAU + e.age, 58, 'o'); }
  }
  function dropItem(g, k, x, y, o) {
    g.items.push(Object.assign({ k, x: clamp(x, 10, W - 10), y, vx: (g.rnd() - 0.5) * 24, vy: -40, t: 0, ph: g.rnd() * 6 }, o));
  }
  /** P 파워: 다 찼으면 안 나와요 (폭탄이 모자라면 폭탄으로) */
  function powerDrop(g) { return g.p.power < PMAX ? 'P' : g.p.bombs < 2 ? 'B' : null; }
  /** 수송선의 무기 아이템: 지금 쓰는 것과 다른 색을 차례로 (퍼짐탄 → 레이저 → 유도탄) */
  function weaponDrop(g) {
    let w = WCYCLE[g.wq % 3];
    if (w === g.p.weapon) { g.wq++; w = WCYCLE[g.wq % 3]; }
    g.wq++;
    return w;
  }
  /** 화면의 적 탄을 지워요 (그림은 잠깐 흐려지며 사라져요) */
  function cancel(g) {
    if (g.eb.length) {
      const list = [];
      for (const b of g.eb) if (b.y > -6 && b.y < g.H + 6 && list.length < 160) list.push([b.x, b.y, b.kind]);
      ev(g, 'cancel', { list });
    }
    g.eb = []; g.hz = [];
  }
  function pickup(g, it) {
    const p = g.p, k = it.k;
    let txt = '';
    if (k === 'P') { if (p.power < PMAX) { p.power++; txt = p.power === PMAX ? '파워 MAX' : `파워 ${p.power}`; } else { addScore(g, 1000); txt = '+1,000'; } }
    else if (WEAPONS[k]) { if (p.weapon === k) { addScore(g, 1000); txt = '+1,000'; } else { p.weapon = k; p.ft = 0; p.mt = 0.2; txt = WEAPONS[k].name; } }
    else if (k === 'B') { if (p.bombs < BMAX) { p.bombs++; txt = '폭탄 +1'; } else { addScore(g, 1000); txt = '+1,000'; } }
    ev(g, 'pick', { item: k, x: it.x, y: it.y, txt, w: p.weapon, power: p.power });   // (k 는 사건 이름이라 아이템은 item 으로)
  }

  /* ───────── 내가 맞았을 때 ───────── */
  function die(g, cause) {
    const p = g.p;
    if (p.inv > 0 || !p.alive || g.bombT > 0) return;
    p.alive = false; p.lives--; p.dead = 1.5; g.stat.miss++; g.sstat.miss++;
    ev(g, 'die', { x: p.x, y: p.y, cause });
    if (p.power > 1) { p.power = Math.max(1, p.power - 2); dropItem(g, 'P', p.x, Math.min(p.y - 10, g.H - 60), { vy: -60 }); }   // 파워 −2 (떨어진 P 를 주우면 1 되찾아요)
    cancel(g);
    if (p.lives <= 0) { g.phase = 'over'; g.phaseT = 0; ev(g, 'over', { score: g.score }); }
  }
  function bomb(g) {
    const p = g.p;
    if (!p.alive || p.enter > 0 || p.bombs <= 0 || g.bombT > 0 || g.phase === 'over') return false;
    p.bombs--; g.bombT = 2.1; p.inv = Math.max(p.inv, 2.5); g.stat.bombs++;
    ev(g, 'bomb', { x: p.x, y: p.y });
    cancel(g);
    for (const e of g.en) if (!e.dead && onScreen(g, e)) hurt(g, e, e.type === 'part' ? 24 : 40, e.x, e.y);
    return true;
  }
  const onScreen = (g, e) => e.x > -10 && e.x < W + 10 && e.y > -10 && e.y < g.H + 10;

  /** 이어하기: 점수는 0부터 · 목숨 3 · 폭탄 3 · 그 자리에서 (무기는 그대로 · 파워는 2 이상) */
  function cont(g) {
    if (g.phase !== 'over') return false;
    g.credits++;
    g.score = 0; g.ext = 0;
    const p = g.p, keep = { weapon: p.weapon, power: Math.max(2, p.power) };
    g.p = Object.assign(newPlayer(g.H, g.D), keep);
    g.phase = g.boss || g.warn > 0 ? 'play' : (g.clearT > 0 ? 'clear' : 'play');
    g.eb = []; g.hz = [];
    ev(g, 'cont', {});
    return true;
  }

  /* ───────── 스테이지 끝 ───────── */
  function stageClear(g, killed) {
    const s = g.sstat, rate = s.spawned ? Math.min(1, s.kills / s.spawned) : 0;
    const bonus = [
      ['격추율 ' + Math.round(rate * 100) + '%', Math.round(rate * 10000 / 100) * 100],
      ['노 미스', s.miss ? 0 : 10000 * g.stage],
      ['남은 폭탄 ' + g.p.bombs, g.p.bombs * 2000],
    ];
    if (g.stage === STAGES.length && killed) bonus.push(['올 클리어', 50000 * (g.loop + 1)]);
    const total = bonus.reduce((a, [, v]) => a + v, 0);
    addScore(g, total);
    g.phase = 'clear'; g.clearT = 4.6; g.bonus = bonus;
    g.allClear = g.stage === STAGES.length;
    // 별 3개: 클리어 · 노 미스 · 격추율 85% (2주차는 1주차 별에 더해요)
    const stars = [!!killed, killed && !s.miss, killed && rate >= STAR_RATE];
    const key = g.stage;
    g.stars[key] = (g.stars[key] || 0) | (stars[0] ? 1 : 0) | (stars[1] ? 2 : 0) | (stars[2] ? 4 : 0);
    ev(g, 'clear', { stage: g.stage, bonus, total, all: g.allClear, killed, stars, rate });
  }
  function nextStage(g) {
    if (g.stage === STAGES.length) { g.stage = 1; g.loop++; } else g.stage++;
    tune(g);
    Object.assign(g, { phase: 'intro', phaseT: 0, st: 0, wi: 0, hold: false, warn: 0, decks: [], form: {}, pend: [], allClear: false });
    g.en = g.en.filter(e => !e.dead && e.type !== 'part');
    g.sstat = { kills: 0, spawned: 0, miss: 0, t0: g.t };
    ev(g, 'stage', { n: g.stage, loop: g.loop, name: STAGES[g.stage - 1].name, en: STAGES[g.stage - 1].en });
  }

  /* ───────── 한 걸음 (1/60초) ───────── */
  function step(g, inp = {}) {
    g.t += STEP; g.step++; g.phaseT += STEP;
    const p = g.p;
    // 단계
    if (g.phase === 'intro' && g.phaseT > 2.6) { g.phase = 'play'; g.phaseT = 0; }
    if (g.phase === 'clear') { if ((g.clearT -= STEP) <= 0) nextStage(g); }
    if (g.phase === 'play' && !g.hold) {
      g.st += STEP;
      const tl = STAGES[g.stage - 1].tl;
      while (g.wi < tl.length && tl[g.wi][0] <= g.st) { const [, op, a] = tl[g.wi++]; OPS[op](g, a || {}); }
    }
    if (g.warn > 0 && (g.warn -= STEP) <= 0) spawnBoss(g, BOSSES[g.stage - 1], false);
    for (let i = 0; i < g.pend.length; i++) if (g.pend[i].at <= g.t) { const f = g.pend[i].fn; g.pend.splice(i--, 1); f(); }
    // 나
    if (p.alive) {
      movePlayer(g, inp);
      if (inp.bomb) bomb(g);
      p.inv -= STEP;
      if (p.enter <= 0 && g.phase !== 'over') playerFire(g);
    } else if (g.phase !== 'over' && (p.dead -= STEP) <= 0) {
      Object.assign(p, { alive: true, x: W / 2, y: g.H + 16, enter: 0.8, inv: 3.2, bombs: Math.max(p.bombs, 3), ft: 0, mt: 0.3, bank: 0 });
      ev(g, 'respawn', {});
    }
    if (g.bombT > 0) {
      g.bombT -= STEP;
      if (g.bombT > 1.1 && g.eb.length) cancel(g);
      for (const e of g.en) if (!e.dead && onScreen(g, e)) hurt(g, e, (e.type === 'part' ? 26 : 60) * STEP, e.x, e.y);
    }
    // 적
    if (g.boss) bossUpdate(g);
    for (const d of g.decks) d.y += g.scroll * 1.15 * STEP;
    g.decks = g.decks.filter(d => d.y < g.H + 60);
    for (const e of g.en) {
      if (e.dead) continue;
      moveEnemy(g, e);
      if (e.mv === 'deck' && !g.decks.includes(e.deck)) e.gone = true;
      if (!e.dead && !e.gone) fireEnemy(g, e);
      if (e.hit > 0) e.hit--;
    }
    // 탄
    for (const s of g.shots) { s.x += s.vx * STEP; s.y += s.vy * STEP; }
    for (const m of g.msl) {
      m.life -= STEP;
      if (!m.tgt || m.tgt.dead || m.tgt.gone || m.tgt.armor) {
        let best = null, bd = 1e9;
        for (const e of g.en) { if (e.dead || e.gone || e.armor || !onScreen(g, e)) continue; const d = d2(e.x, e.y, m.x, m.y); if (d < bd) { bd = d; best = e; } }
        m.tgt = best;
      }
      if (m.tgt) { const want = Math.atan2(m.tgt.y - m.y, m.tgt.x - m.x); const da = ((want - m.a + Math.PI * 3) % TAU) - Math.PI; m.a += clamp(da, -6 * STEP, 6 * STEP); }
      m.sp = Math.min(380, m.sp + 520 * STEP);
      m.x += Math.cos(m.a) * m.sp * STEP; m.y += Math.sin(m.a) * m.sp * STEP;
    }
    for (const b of g.eb) {
      b.age += STEP;
      b.x += b.vx * STEP; b.y += b.vy * STEP;
      if (b.split && b.age >= b.split.after) {
        b.dead = true;
        const S = b.split;
        for (let i = 0; i < S.n; i++) bullet(g, b.x, b.y, (i / S.n) * TAU + b.age, S.sp, S.kind);
        ev(g, 'split', { x: b.x, y: b.y });
      }
    }
    for (const h of g.hz) { if (h.warn > 0) { h.warn -= STEP; if (h.warn <= 0) ev(g, 'laserOn', { x: h.x }); } else h.on -= STEP; }
    // 명중: 내 탄 → 적
    const tg = g.tg; tg.length = 0;
    for (const e of g.en) if (!e.dead && !e.gone && e.y > -20) tg.push(e);
    for (const s of g.shots) {
      for (const e of tg) {
        if (e.dead) continue;
        if (s.k === 'L') { if (Math.abs(s.x - e.x) > e.r + s.r || Math.abs(s.y - e.y) > e.r + 7) continue; }
        else if (d2(s.x, s.y, e.x, e.y) > (e.r + s.r) * (e.r + s.r)) continue;
        s.hit = true; hurt(g, e, s.dmg, s.x, s.y); break;
      }
    }
    for (const m of g.msl) {
      for (const e of tg) {
        if (e.dead || d2(m.x, m.y, e.x, e.y) > (e.r + 3) * (e.r + 3)) continue;
        m.hit = true; ev(g, 'mhit', { x: m.x, y: m.y });
        hurt(g, e, m.dmg, m.x, m.y);
        for (const o of tg) if (o !== e && !o.dead && d2(m.x, m.y, o.x, o.y) < 14 * 14) hurt(g, o, m.dmg * 0.4, o.x, o.y);   // 작은 폭발
        break;
      }
    }
    // 내가 맞았나 (판정은 가운데 작은 점)
    if (p.alive && p.enter <= 0 && p.inv <= 0 && g.bombT <= 0) {
      let hit = null;
      for (const b of g.eb) if (d2(b.x, b.y, p.x, p.y) < (b.r + 1.6) * (b.r + 1.6)) { b.dead = true; hit = 'bullet:' + b.kind; break; }
      if (!hit) for (const e of g.en) { if (e.dead || e.gone || !EN[e.type].body) continue; const r = e.r * 0.72 + 2; if (d2(e.x, e.y, p.x, p.y) < r * r) { hit = 'body:' + e.type; break; } }
      if (!hit && g.boss && g.boss.enter <= 0 && !g.boss.dying) { const b = g.boss, D = b.def; const nx = (p.x - b.x) / (D.w * 0.38), ny = (p.y - b.y) / (D.h * 0.32); if (nx * nx + ny * ny < 1) hit = 'boss'; }
      if (!hit) for (const h of g.hz) if (h.warn <= 0 && h.on > 0 && p.y > h.y0 && Math.abs(p.x - h.x) < h.w / 2 - 1) { hit = 'laser'; break; }
      if (hit) die(g, hit);
    }
    // 아이템: 천천히 떨어져요 · 가까이 가면 끌려와요
    for (const it of g.items) {
      it.t += STEP;
      const dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
      if (p.alive && p.enter <= 0 && d < 24) {
        it.x += (dx / (d || 1)) * 200 * STEP; it.y += (dy / (d || 1)) * 200 * STEP;
        if (d < 9) { it.dead = true; pickup(g, it); }
        continue;
      }
      it.vy = Math.min(32, it.vy + 110 * STEP);
      it.x += (it.vx + Math.sin(it.t * 1.8 + it.ph) * 10) * STEP; it.y += it.vy * STEP;
      if (it.x < 8 || it.x > W - 8) { it.vx = -it.vx; it.x = clamp(it.x, 8, W - 8); }
      if (it.y > g.H + 10) it.dead = true;
    }
    // 정리 (새 배열을 만들지 않고 그 자리에서)
    for (const e of g.en) if (e.gone && e.form && !e.dead) { const f = g.form[e.form]; if (f) f.gone++; }
    keep(g.en, e => !e.dead && !e.gone);
    keep(g.shots, s => !s.hit && s.y > -24 && s.x > -20 && s.x < W + 20);
    keep(g.msl, m => !m.hit && m.life > 0 && m.y > -30 && m.y < g.H + 30 && m.x > -30 && m.x < W + 30);
    keep(g.eb, b => !b.dead && b.y < g.H + 12 && b.y > -50 && b.x > -16 && b.x < W + 16);
    keep(g.items, it => !it.dead);
    keep(g.hz, h => h.warn > 0 || h.on > 0);
    return g;
  }

  return { W, H, STEP, PMAX, BMAX, WEAPONS, WCYCLE, ITEMS, EN, BOSSES, MIDS, STAGES, EXTEND, DIFF, START_POWER, STAR_RATE, BULLET_R, VPAT, PATHS,
    create, step, bomb, cont, pathOf, pathAt, rng, powerDrop, weaponDrop, nextExtend };
});
