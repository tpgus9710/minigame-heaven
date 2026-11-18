/* =====================================================================
 *  🎨 우주 슈팅 그림 (v14.1 다시 그림) — 그림 파일 없이 코드로 그린 매끈한 그림 (도트 아님)
 *   · 모든 그림은 처음에 한 번만 화면 해상도(k = 게임 1칸이 몇 화소인지)에 맞춰 캔버스에 그려 두고, 게임 중에는 붙이기만 해요 (가볍게)
 *   · 색 약속 — 빛나는 동그라미 · 바늘 = 적 탄(분홍 · 주황 · 보라)  /  쇳빛 몸 = 적  /  흰 테두리 네모 = 아이템  /  파랑 · 초록 · 보라 줄 = 내 탄
 *     → 적 탄과 헷갈리는 모양(메달 · 별)은 없어요. 배경에는 별과 옅은 빛만 (돌 같은 건 그리지 않아요)
 *   · build(k) → 그림 모음. 그릴 때는 (x - w/2, y - h/2, w, h) 게임 단위로 붙이면 화소와 딱 맞아요
 * ===================================================================== */
const ShArt = (() => {
  'use strict';
  const TAU = Math.PI * 2;
  const INK = '#0b0f1e';
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  /* ───── 기본 도구 ───── */
  /** 그림 하나: w × h (게임 단위, 가운데가 0,0) 를 k 배 화소로 */
  function spr(k, w, h, draw) {
    const c = canvas(w * k, h * k), x = c.getContext('2d');
    x.setTransform(c.width / w, 0, 0, c.height / h, c.width / 2, c.height / 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    draw(x);
    return { c, w, h };
  }
  const path = (x, pts) => { x.beginPath(); for (let i = 0; i < pts.length; i++) i ? x.lineTo(pts[i][0], pts[i][1]) : x.moveTo(pts[i][0], pts[i][1]); x.closePath(); };
  /** 매끈한 닫힌 곡선 (점들 사이 가운데를 지나요) */
  function smooth(x, pts) {
    const n = pts.length, mid = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    x.beginPath(); const s = mid(n - 1); x.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); x.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    x.closePath();
  }
  /** 오른쪽 절반(위 가운데 → 아래 가운데) → 좌우 대칭 */
  const sym = half => half.concat(half.slice(1, -1).reverse().map(([a, b]) => [-a, b]));
  const flipX = pts => pts.map(([a, b]) => [-a, b]);
  function lin(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
  function rad(x, cx, cy, r, stops, r0 = 0, fx = cx, fy = cy) { const g = x.createRadialGradient(fx, fy, r0, cx, cy, r); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
  function line(x, w = 0.7, col = INK) { x.lineWidth = w; x.strokeStyle = col; x.stroke(); }
  function rrect(x, X, Y, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); }
  function circle(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); }
  function ellipse(x, cx, cy, rx, ry, a = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, a, 0, TAU); }
  /** 작은 빛 (안쪽 흰색 → 색 → 투명) */
  function light(x, cx, cy, r, col) { circle(x, cx, cy, r); x.fillStyle = rad(x, cx, cy, r, [[0, '#ffffff'], [0.35, col], [1, 'rgba(0,0,0,0)']]); x.fill(); }
  /** 몸통 칠하기: 위가 밝고 아래가 어두운 금속 + 테두리 */
  function hull(x, pts, top, bot, y0, y1, isSmooth) {
    isSmooth ? smooth(x, pts) : path(x, pts);
    x.fillStyle = lin(x, 0, y0, 0, y1, [[0, top], [1, bot]]); x.fill();
    line(x, 0.8);
  }
  /** 테두리 안쪽에 밝은 윤곽 (입체감) — 위쪽 가장자리만 */
  function rim(x, pts, col = 'rgba(255,255,255,.35)', w = 0.6, isSmooth) {
    x.save(); isSmooth ? smooth(x, pts) : path(x, pts); x.clip();
    x.translate(0, 0.9); isSmooth ? smooth(x, pts) : path(x, pts); x.translate(0, -0.9);
    x.lineWidth = w * 2; x.strokeStyle = col; x.stroke();
    x.restore();
  }
  /** 흰 번쩍 그림 (맞았을 때) · 어두운 그림 (부서진 부위) — 처음 쓸 때 만들어요 */
  function flash(s) {
    if (s.f) return s.f;
    const c = canvas(s.c.width, s.c.height), x = c.getContext('2d');
    x.drawImage(s.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    return (s.f = c);
  }
  function dark(s) {
    if (s.d) return s.d;
    const c = canvas(s.c.width, s.c.height), x = c.getContext('2d');
    x.drawImage(s.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(16,12,20,.72)'; x.fillRect(0, 0, c.width, c.height);
    return (s.d = c);
  }

  /* ───── 내 비행기 · 내 탄 ───── */
  function ship(x) {
    const wing = [[0, -5], [3, -1.6], [9, 5], [9, 7.2], [3.4, 6.3], [0, 7.4]];
    path(x, sym(wing)); x.fillStyle = lin(x, 0, -5, 0, 7.4, [[0, '#6f9bff'], [1, '#1e3c99']]); x.fill(); line(x);
    for (const s of [-1, 1]) {   // 날개 앞쪽 밝은 선 · 끝 줄무늬
      x.beginPath(); x.moveTo(s * 2.2, -2.2); x.lineTo(s * 8.3, 5); x.lineWidth = 0.55; x.strokeStyle = 'rgba(200,222,255,.8)'; x.stroke();
      x.beginPath(); x.moveTo(s * 6.3, 4.4); x.lineTo(s * 8.6, 6.6); x.lineWidth = 0.9; x.strokeStyle = '#8ff0ff'; x.stroke();
    }
    const body = [[0, -10.6], [1.35, -8.4], [2.5, -4], [2.9, 2], [2.4, 7], [1.2, 8.8], [0, 9]];
    path(x, sym(body)); x.fillStyle = lin(x, -2.9, 0, 2.9, 0, [[0, '#b9c4de'], [0.45, '#ffffff'], [1, '#8f9cbc']]); x.fill(); line(x);
    ellipse(x, 0, -4.1, 1.25, 2.6); x.fillStyle = lin(x, 0, -6.7, 0, -1.5, [[0, '#a8f6ff'], [1, '#1677c9']]); x.fill(); line(x, 0.45);
    ellipse(x, -0.35, -5, 0.4, 0.9); x.fillStyle = 'rgba(255,255,255,.85)'; x.fill();
    for (const s of [-1, 1]) { rrect(x, s * 1.6 - 0.75, 7.4, 1.5, 1.8, 0.4); x.fillStyle = '#2a3150'; x.fill(); line(x, 0.4); }
  }
  /** 엔진 불꽃 (아래로) */
  function flame(x) {
    ellipse(x, 0, 0, 1.5, 4); x.fillStyle = rad(x, 0, -2.2, 4.4, [[0, '#ffffff'], [0.3, '#b8f0ff'], [0.65, 'rgba(70,160,255,.55)'], [1, 'rgba(40,90,255,0)']]); x.fill();
  }
  function shotV(x) {   // 퍼짐탄: 파랑 빛 줄
    rrect(x, -1.5, -4.6, 3, 9.2, 1.5); x.fillStyle = 'rgba(80,160,255,.35)'; x.fill();
    rrect(x, -0.75, -4, 1.5, 8, 0.75); x.fillStyle = lin(x, 0, -4, 0, 4, [[0, '#ffffff'], [0.6, '#bfe0ff'], [1, 'rgba(120,180,255,.2)']]); x.fill();
  }
  function shotM(x) {   // 유도탄의 앞 총: 연보라 작은 줄
    rrect(x, -1.2, -3.8, 2.4, 7.6, 1.2); x.fillStyle = 'rgba(170,130,255,.35)'; x.fill();
    rrect(x, -0.6, -3.3, 1.2, 6.6, 0.6); x.fillStyle = lin(x, 0, -3.3, 0, 3.3, [[0, '#ffffff'], [1, 'rgba(200,170,255,.3)']]); x.fill();
  }
  function missile(x) {   // 위쪽을 보는 미사일 (돌려서 그려요)
    for (const s of [-1, 1]) { path(x, [[s * 0.9, 1.5], [s * 2.2, 3.6], [s * 0.9, 3.4]]); x.fillStyle = '#5a35b8'; x.fill(); }
    rrect(x, -0.95, -3.6, 1.9, 7, 0.95); x.fillStyle = lin(x, -1, 0, 1, 0, [[0, '#8b62f0'], [0.5, '#d9c8ff'], [1, '#6b43d6']]); x.fill(); line(x, 0.35);
    ellipse(x, 0, -3, 0.75, 1); x.fillStyle = '#ffffff'; x.fill();
  }

  /* ───── 적 탄 (빛나는 것 = 적 탄) ───── */
  function orb(x, r, col, mid) {
    circle(x, 0, 0, r); x.fillStyle = rad(x, 0, 0, r, [[0, '#ffffff'], [0.28, '#ffffff'], [0.42, mid], [0.66, col], [1, 'rgba(0,0,0,0)']]); x.fill();
  }
  function needle(x) {   // 아래를 보는 주황 바늘 (돌려서 그려요)
    ellipse(x, 0, 0, 2, 4.4); x.fillStyle = rad(x, 0, 0, 4.4, [[0, 'rgba(255,150,40,.55)'], [1, 'rgba(255,120,30,0)']]); x.fill();
    ellipse(x, 0, 0.3, 1.05, 3.3); x.fillStyle = lin(x, 0, -3, 0, 3.6, [[0, '#ffb24a'], [0.45, '#fff3d6'], [1, '#ffffff']]); x.fill();
  }
  function bigBomb(x) {
    orb(x, 7, 'rgba(230,40,70,.8)', '#ff8c9a');
    circle(x, 0, 0, 4.4); x.lineWidth = 0.8; x.strokeStyle = 'rgba(255,255,255,.9)'; x.setLineDash([1.6, 1.2]); x.stroke(); x.setLineDash([]);
  }

  /* ───── 아이템 (흰 테두리 네모 + 그림) ───── */
  function itemBase(x, top, bot) {
    rrect(x, -5.4, -4.6, 10.8, 10.8, 3); x.fillStyle = 'rgba(0,0,0,.35)'; x.fill();               // 그림자
    rrect(x, -5.6, -5.6, 11.2, 11.2, 3.1); x.fillStyle = lin(x, 0, -5.6, 0, 5.6, [[0, top], [1, bot]]); x.fill();
    x.lineWidth = 1; x.strokeStyle = '#ffffff'; x.stroke();
    rrect(x, -4.4, -4.6, 8.8, 4.2, 2.2); x.fillStyle = 'rgba(255,255,255,.22)'; x.fill();         // 윗부분 윤기
  }
  const icon = { lineWidth: 1.1, strokeStyle: '#ffffff', fillStyle: '#ffffff' };
  function itemV(x) {   // 퍼짐: 부채꼴 세 줄
    itemBase(x, '#5aa6ff', '#1f5fd6'); Object.assign(x, icon);
    for (const a of [-0.5, 0, 0.5]) { x.beginPath(); x.moveTo(0, 2.8); x.lineTo(Math.sin(a) * 6, 2.8 - Math.cos(a) * 6); x.stroke(); }
  }
  function itemL(x) {   // 레이저: 곧은 굵은 줄
    itemBase(x, '#3fe08f', '#14935a'); Object.assign(x, icon);
    rrect(x, -1.2, -4, 2.4, 8, 1.2); x.fill();
    x.lineWidth = 0.7; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 3, -2.6); x.lineTo(s * 3, 3.6); x.stroke(); }
  }
  function itemM(x) {   // 유도: 휘어 가는 화살표
    itemBase(x, '#b48aff', '#6b3fd6'); Object.assign(x, icon);
    x.beginPath(); x.moveTo(-2.8, 3.2); x.quadraticCurveTo(-2.6, -2.2, 2.2, -2.4); x.stroke();
    path(x, [[3.6, -2.4], [1.4, -4.2], [1.4, -0.6]]); x.fill();
  }
  function itemP(x) {   // 파워: 빨강 + 위로 화살표 두 개
    itemBase(x, '#ff7b7b', '#d6334a'); Object.assign(x, icon);
    x.lineWidth = 1.3;
    for (const y of [0.4, -2.6]) { x.beginPath(); x.moveTo(-3, y + 2.6); x.lineTo(0, y); x.lineTo(3, y + 2.6); x.stroke(); }
  }
  function itemB(x) {   // 폭탄
    itemBase(x, '#ffc54a', '#e08712'); Object.assign(x, icon);
    circle(x, -0.4, 1, 2.9); x.fill();
    x.beginPath(); x.moveTo(1.4, -1.2); x.quadraticCurveTo(2.6, -3.4, 3.6, -3.2); x.lineWidth = 0.9; x.stroke();
    circle(x, -1.3, 0.1, 0.8); x.fillStyle = 'rgba(224,135,18,.55)'; x.fill();
  }

  /* ───── 적 (모두 아래를 봐요 · 쇳빛 몸) ───── */
  const ST = ['#8792b4', '#343b57'];   // 기본 쇳빛 (위 · 아래)
  function pop(x) {   // 작은 마름모 드론
    const d = [[0, -5], [5, 0], [0, 5], [-5, 0]];
    path(x, d); x.fillStyle = lin(x, 0, -5, 0, 5, [[0, '#9aa5c6'], [1, '#2f3550']]); x.fill(); x.lineWidth = 1.2; x.strokeStyle = INK; x.stroke();
    path(x, [[0, -2.9], [2.9, 0], [0, 2.9], [-2.9, 0]]); x.fillStyle = '#262c44'; x.fill();
    light(x, 0, 0, 2.1, '#ff5a6a');
  }
  function zako(x) {   // 작은 전투기
    const h = [[0, -4.6], [1.6, -4.6], [3, -2.3], [6.2, -0.4], [6.2, 1.6], [2.7, 1.9], [1.4, 5.6], [0, 6]];
    hull(x, sym(h), ST[0], ST[1], -4.6, 6); rim(x, sym(h));
    ellipse(x, 0, 0.6, 1.15, 2.1); x.fillStyle = lin(x, 0, -1.5, 0, 2.7, [[0, '#ff9a9a'], [1, '#b51f35']]); x.fill(); line(x, 0.4);
    for (const s of [-1, 1]) { circle(x, s * 5.3, 0.6, 0.6); x.fillStyle = '#ff6b78'; x.fill(); }
  }
  function swoop(x) {   // 화살 모양 전투기
    const h = [[0, -4.2], [1.5, -3.5], [6.8, -5.4], [6, -3.4], [2.5, 2.1], [0, 6.6]];
    hull(x, sym(h), '#4fcac1', '#1b5560', -5.4, 6.6); rim(x, sym(h), 'rgba(220,255,250,.45)');
    for (const s of [-1, 1]) { path(x, [[s * 6.8, -5.4], [s * 6, -3.4], [s * 4.6, -4.4]]); x.fillStyle = '#ffd23f'; x.fill(); }
    x.beginPath(); x.moveTo(0, -3); x.lineTo(0, 4.5); x.lineWidth = 0.7; x.strokeStyle = 'rgba(10,40,45,.7)'; x.stroke();
    ellipse(x, 0, -0.6, 0.8, 1.5); x.fillStyle = '#e8fffb'; x.fill();
  }
  function kami(x) {   // 가시 기체 (멈칫했다가 돌진)
    const spikes = [[[0, 2.6], [1.4, 3], [0, 8.4], [-1.4, 3]], [[3, -0.6], [3.2, 1.4], [7.4, 1.6]], [[-3, -0.6], [-3.2, 1.4], [-7.4, 1.6]], [[-1, -3], [1, -3], [0, -6.2]]];
    for (const s of spikes) { path(x, s); x.fillStyle = lin(x, 0, -6, 0, 8, [[0, '#9b2a3c'], [1, '#5a1020']]); x.fill(); line(x, 0.6); }
    circle(x, 0, 0, 3.9); x.fillStyle = rad(x, -1, -1.2, 4.4, [[0, '#e0566a'], [1, '#55101d']]); x.fill(); line(x, 0.7);
    circle(x, 0, 0.4, 1.35); x.fillStyle = rad(x, 0, 0.4, 1.35, [[0, '#ffffff'], [0.5, '#ffe08a'], [1, '#ff9a3c']]); x.fill();
  }
  function mine(on) {
    return x => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU, c = Math.cos(a), s = Math.sin(a);
        path(x, [[c * 3.6 - s * 1.1, s * 3.6 + c * 1.1], [c * 6.6, s * 6.6], [c * 3.6 + s * 1.1, s * 3.6 - c * 1.1]]); x.fillStyle = '#4a5068'; x.fill(); line(x, 0.5);
      }
      circle(x, 0, 0, 4.5); x.fillStyle = rad(x, -1.3, -1.5, 5.2, [[0, '#7a8098'], [1, '#1b1e2c']]); x.fill(); line(x, 0.8);
      circle(x, 0, 0, 2.6); x.lineWidth = 0.6; x.strokeStyle = 'rgba(0,0,0,.55)'; x.stroke();
      if (on) light(x, 0, 0, 2.2, '#ff4d5e'); else { circle(x, 0, 0, 1.3); x.fillStyle = '#6a1a26'; x.fill(); }
    };
  }
  /** 돌: 부술 수 있는 적이라서 또렷한 테두리 · 밝은 윗면 (배경에는 돌이 없어요) */
  function rock(R, seed) {
    return x => {
      const r = rng(seed), n = 10, pts = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + r() * 0.3, d = R * (0.78 + r() * 0.26); pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
      smooth(x, pts); x.fillStyle = rad(x, -R * 0.35, -R * 0.4, R * 1.5, [[0, '#b8a48e'], [0.55, '#7a6553'], [1, '#3e3129']]); x.fill();
      x.lineWidth = 1.1; x.strokeStyle = '#1a120d'; x.stroke();
      x.save(); smooth(x, pts); x.clip();
      for (let i = 0; i < (R > 8 ? 4 : 2); i++) {   // 구덩이
        const cx = (r() - 0.5) * R * 1.1, cy = (r() - 0.5) * R * 1.1, cr = R * (0.14 + r() * 0.16);
        circle(x, cx, cy, cr); x.fillStyle = 'rgba(40,28,20,.45)'; x.fill();
        x.beginPath(); x.arc(cx, cy, cr, 0.2, Math.PI - 0.2); x.lineWidth = 0.5; x.strokeStyle = 'rgba(230,210,180,.35)'; x.stroke();
      }
      x.restore();
      smooth(x, pts); x.save(); x.clip(); x.translate(0.8, 1); smooth(x, pts); x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,240,215,.35)'; x.stroke(); x.restore();
    };
  }
  function gun(x) {   // 포격선 (멈춰서 3갈래)
    for (const s of [-1, 1]) { rrect(x, s * 4.6 - 1.1, 4, 2.2, 7, 0.8); x.fillStyle = lin(x, 0, 4, 0, 11, [[0, '#4a5170'], [1, '#141826']]); x.fill(); line(x, 0.5); }
    const h = [[0, -8.2], [4, -8.4], [9.2, -4.2], [11.2, 0.8], [9.2, 5], [4.6, 6.6], [2.2, 9.4], [0, 9.6]];
    hull(x, sym(h), '#8e99bb', '#323a56', -8.4, 9.6); rim(x, sym(h));
    x.save(); path(x, sym(h)); x.clip(); x.fillStyle = 'rgba(255,150,60,.85)'; x.fillRect(-12, -1.2, 24, 2.2); x.restore();
    path(x, sym([[0, -5.6], [3, -5.4], [5, -2.6], [0, -1.6]])); x.fillStyle = '#262c44'; x.fill();
    light(x, 0, -3.6, 1.6, '#ffb24a');
  }
  function turretBase(x) {   // 정거장 포탑 받침 (포신은 그릴 때 따로)
    circle(x, 0, 0, 7); x.fillStyle = lin(x, 0, -7, 0, 7, [[0, '#6b7594'], [1, '#262c42']]); x.fill(); line(x, 0.8);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; circle(x, Math.cos(a) * 5.6, Math.sin(a) * 5.6, 0.5); x.fillStyle = '#1a1f30'; x.fill(); }
    circle(x, 0, 0, 4.2); x.fillStyle = rad(x, -1.2, -1.4, 5, [[0, '#c3cce2'], [1, '#3f4862']]); x.fill(); line(x, 0.6);
  }
  function carrier(x) {   // 수송선 (부수면 아이템): 밝은 흰 몸 + 초록 짐칸
    for (const s of [-1, 1]) { path(x, [[-11, s * 3], [-14, s * 7], [-8, s * 4.4]]); x.fillStyle = '#8f9ab3'; x.fill(); line(x, 0.5); }
    rrect(x, -13, -5, 26, 10, 5); x.fillStyle = lin(x, 0, -5, 0, 5, [[0, '#f4f7fd'], [1, '#98a4bd']]); x.fill(); line(x, 0.8);
    rrect(x, -6.2, -3.7, 12.4, 7.4, 2.2); x.fillStyle = lin(x, 0, -3.7, 0, 3.7, [[0, '#7dfbb3'], [1, '#16935a']]); x.fill(); line(x, 0.6);
    x.lineWidth = 1.1; x.strokeStyle = '#ffffff'; x.beginPath(); x.moveTo(-2.2, 0); x.lineTo(2.2, 0); x.moveTo(0, -2.2); x.lineTo(0, 2.2); x.stroke();
    for (const s of [-1, 1]) { circle(x, s * 10, 0, 0.9); x.fillStyle = '#3fe08f'; x.fill(); }
  }
  function heavy(x) {   // 중순양함
    for (const s of [-1, 1]) {
      rrect(x, s * 5.4 - 1.3, 12, 2.6, 8, 1); x.fillStyle = lin(x, 0, 12, 0, 20, [[0, '#4a5170'], [1, '#121522']]); x.fill(); line(x, 0.5);
      rrect(x, s * 6.5 - 2.2, -19.4, 4.4, 3.4, 1.2); x.fillStyle = '#7cc4ff'; x.fill();    // 엔진 (위)
    }
    const h = [[0, -17.4], [6, -17.4], [12.4, -12.4], [19.4, -4.4], [20.4, 4], [15.4, 10.4], [9.4, 13.4], [5, 18], [0, 18.6]];
    hull(x, sym(h), '#7d88aa', '#252b42', -17.4, 18.6); rim(x, sym(h));
    const inner = [[0, -13], [5, -13], [10, -8], [14, -2], [14, 4], [9, 9], [0, 11]];
    path(x, sym(inner)); x.fillStyle = 'rgba(20,24,40,.35)'; x.fill(); x.lineWidth = 0.5; x.strokeStyle = 'rgba(190,205,240,.35)'; x.stroke();
    for (const y of [-6, 0, 6]) { x.beginPath(); x.moveTo(-12, y); x.lineTo(12, y); x.lineWidth = 0.4; x.strokeStyle = 'rgba(10,12,24,.45)'; x.stroke(); }
    for (const s of [-1, 1]) light(x, s * 13, 1, 1.5, '#ff5a6a');
    circle(x, 0, 3, 3.4); x.fillStyle = '#1a1e30'; x.fill(); line(x, 0.5); light(x, 0, 3, 2.6, '#ff6b5b');
  }

  /* ───── 보스 몸 (부위는 따로 그려서 붙여요) ───── */
  function crab(x) {   // 강철 게
    x.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {   // 다리
      const y0 = -8 + i * 11;
      x.beginPath(); x.moveTo(s * 36, y0); x.lineTo(s * 54, y0 - 8 + i * 4); x.lineTo(s * 60, y0 + 6 + i * 4);
      x.lineWidth = 4.2; x.strokeStyle = INK; x.stroke(); x.lineWidth = 2.6; x.strokeStyle = '#5a6788'; x.stroke();
    }
    const sh = [[0, -31], [18, -30], [34, -25], [46, -15], [52, -2], [48, 10], [36, 20], [20, 26], [0, 28]];
    hull(x, sym(sh), '#90a0c8', '#283150', -31, 28, true);
    rim(x, sym(sh), 'rgba(255,255,255,.3)', 0.8, true);
    const in1 = [[0, -22], [14, -21], [27, -16], [36, -7], [38, 3], [30, 12], [16, 17], [0, 19]];
    smooth(x, sym(in1)); x.fillStyle = 'rgba(15,20,40,.28)'; x.fill(); x.lineWidth = 0.6; x.strokeStyle = 'rgba(200,215,250,.35)'; x.stroke();
    for (const s of [-1, 1]) {   // 등딱지 무늬 · 주황 빛
      x.beginPath(); x.moveTo(s * 20, -26); x.quadraticCurveTo(s * 30, -6, s * 22, 18); x.lineWidth = 0.6; x.strokeStyle = 'rgba(10,14,30,.5)'; x.stroke();
      light(x, s * 31, -9, 2, '#ffa23f');
      // 눈
      x.beginPath(); x.moveTo(s * 8, 24); x.lineTo(s * 11, 31); x.lineWidth = 1.6; x.strokeStyle = '#3d4664'; x.stroke();
      light(x, s * 11, 32, 2.2, '#7ff0ff');
    }
    circle(x, 0, -2, 17); x.fillStyle = '#161b2e'; x.fill(); line(x, 0.8);   // 코어 자리
  }
  function fortress(x) {   // 바위 요새: 바위에 박힌 쇠 요새
    const r = rng(77), oct = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8, d = 44 + (r() - 0.5) * 3; oct.push([Math.cos(a) * d, Math.sin(a) * d * 0.94]); }
    path(x, oct); x.fillStyle = rad(x, -12, -16, 64, [[0, '#9a8b7d'], [0.6, '#5d5048'], [1, '#2a221e']]); x.fill(); x.lineWidth = 1.2; x.strokeStyle = INK; x.stroke();
    x.save(); path(x, oct); x.clip();
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = 30 + r() * 12; circle(x, Math.cos(a) * d, Math.sin(a) * d, 3 + r() * 3); x.fillStyle = 'rgba(30,22,18,.35)'; x.fill(); }
    x.restore();
    circle(x, 0, 0, 30); x.fillStyle = lin(x, 0, -30, 0, 30, [[0, '#9aa4bd'], [1, '#2d3448']]); x.fill(); line(x, 1);
    circle(x, 0, 0, 24); x.lineWidth = 0.6; x.strokeStyle = 'rgba(220,230,255,.35)'; x.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; light(x, Math.cos(a) * 26.5, Math.sin(a) * 26.5, 1.7, '#ffb347'); }
    circle(x, 0, 0, 19); x.fillStyle = '#161b2e'; x.fill(); line(x, 0.8);
  }
  function guard(x) {   // 방어 코어: 넓은 정거장
    rrect(x, -73, -8.5, 146, 17, 8.5); x.fillStyle = lin(x, 0, -8.5, 0, 8.5, [[0, '#dfe6f4'], [1, '#6d7894']]); x.fill(); line(x, 1);
    for (const s of [-1, 1]) {
      rrect(x, s * 26 - (s > 0 ? 0 : 22), -2, 22, 4, 2); x.fillStyle = 'rgba(80,220,255,.75)'; x.fill();
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(s * (30 + i * 8), -8); x.lineTo(s * (30 + i * 8), 8); x.lineWidth = 0.5; x.strokeStyle = 'rgba(30,40,70,.45)'; x.stroke(); }
      circle(x, s * 58, 6, 13.5); x.fillStyle = lin(x, 0, -8, 0, 20, [[0, '#c7cfe2'], [1, '#4d5672']]); x.fill(); line(x, 0.9);
    }
    circle(x, 0, 0, 25); x.fillStyle = lin(x, 0, -25, 0, 25, [[0, '#eef2fa'], [1, '#687391']]); x.fill(); line(x, 1);
    circle(x, 0, 0, 21); x.lineWidth = 0.7; x.strokeStyle = 'rgba(60,80,120,.45)'; x.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; light(x, Math.cos(a) * 22.5, Math.sin(a) * 22.5, 1.5, '#59d8ff'); }
    circle(x, 0, 0, 17); x.fillStyle = '#161b2e'; x.fill(); line(x, 0.8);
  }
  function bomber(x) {   // 붉은 포격함
    const wg = [[0, -22], [14, -18], [66, 1], [66, 8], [22, 10], [10, 30], [0, 33]];
    hull(x, sym(wg), '#e0606f', '#5a1622', -22, 33); rim(x, sym(wg), 'rgba(255,220,225,.35)');
    for (const s of [-1, 1]) {
      x.beginPath(); x.moveTo(s * 16, -14); x.lineTo(s * 60, 3); x.lineWidth = 0.6; x.strokeStyle = 'rgba(40,6,12,.55)'; x.stroke();
      path(x, [[s * 56, 1.6], [s * 66, 1], [s * 66, 8], [s * 58, 7.6]]); x.fillStyle = '#2b2f42'; x.fill();
      light(x, s * 63, 4.6, 1.6, '#ffd23f');
      circle(x, s * 50, 4, 12.5); x.fillStyle = '#3a1018'; x.fill(); line(x, 0.8);
    }
    rrect(x, -12.5, -35, 25, 66, 12.5); x.fillStyle = lin(x, -12.5, 0, 12.5, 0, [[0, '#7a2230'], [0.5, '#b8404f'], [1, '#6a1a26']]); x.fill(); line(x, 1);
    for (const s of [-1, 1]) { rrect(x, s * 6 - 3, -38, 6, 5, 2); x.fillStyle = '#ffb36b'; x.fill(); }
    ellipse(x, 0, -20, 5, 7); x.fillStyle = lin(x, 0, -27, 0, -13, [[0, '#ffe1c2'], [1, '#c2410c']]); x.fill(); line(x, 0.6);
    circle(x, 0, 10, 17.5); x.fillStyle = '#1b0d14'; x.fill(); line(x, 0.8);
  }
  function mother(x) {   // 모선 코어
    const hh = [[0, -55], [30, -51], [60, -31], [77, 0], [65, 34], [35, 54], [0, 58]];
    hull(x, sym(hh), '#7b69b0', '#1f1836', -55, 58, true); rim(x, sym(hh), 'rgba(230,220,255,.28)', 0.8, true);
    for (const r of [44, 34]) { circle(x, 0, 4, r); x.lineWidth = 0.7; x.strokeStyle = 'rgba(210,190,255,.3)'; x.stroke(); }
    for (let i = 0; i < 12; i++) {   // 갈비 무늬
      const a = (i / 12) * TAU; x.beginPath(); x.moveTo(Math.cos(a) * 24, 4 + Math.sin(a) * 24); x.lineTo(Math.cos(a) * 46, 4 + Math.sin(a) * 46);
      x.lineWidth = 0.6; x.strokeStyle = 'rgba(15,10,30,.45)'; x.stroke();
    }
    for (const [px, py] of [[-52, -22], [52, -22], [-40, 34], [40, 34]]) { circle(x, px, py, 12.5); x.fillStyle = '#1c1530'; x.fill(); line(x, 0.8); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; light(x, Math.cos(a) * 39, 4 + Math.sin(a) * 39, 1.6, '#c58bff'); }
    circle(x, 0, 4, 20); x.fillStyle = '#140f22'; x.fill(); line(x, 0.8);
  }
  function stinger(x) {   // 중간 보스: 말벌 — 가운데 코어가 가슴, 아래 줄무늬 배 · 침
    for (const s of [-1, 1]) {   // 날개 (반투명)
      ellipse(x, s * 21, -7, 16, 7.5, s * -0.32); x.fillStyle = 'rgba(200,230,255,.26)'; x.fill(); x.lineWidth = 0.7; x.strokeStyle = 'rgba(220,240,255,.65)'; x.stroke();
      ellipse(x, s * 18, 3, 11, 4.5, s * 0.28); x.fillStyle = 'rgba(200,230,255,.18)'; x.fill(); x.lineWidth = 0.6; x.strokeStyle = 'rgba(220,240,255,.45)'; x.stroke();
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(s * 10, -2 + i * 6); x.lineTo(s * 18, 2 + i * 7); x.lineTo(s * 20, 8 + i * 7); x.lineWidth = 1.6; x.strokeStyle = INK; x.stroke(); x.lineWidth = 0.9; x.strokeStyle = '#4a5068'; x.stroke(); }
    }
    path(x, [[-3.4, 22], [3.4, 22], [0, 31]]); x.fillStyle = lin(x, 0, 22, 0, 31, [[0, '#3a3f55'], [1, '#12141f']]); x.fill(); line(x, 0.6);   // 침
    ellipse(x, 0, 16, 11, 9); x.fillStyle = lin(x, 0, 7, 0, 25, [[0, '#ffd75a'], [1, '#c98a10']]); x.fill(); line(x, 0.9);
    x.save(); ellipse(x, 0, 16, 11, 9); x.clip(); x.fillStyle = 'rgba(30,22,10,.78)'; for (const y of [15, 20]) x.fillRect(-12, y, 24, 2.4); x.restore();
    circle(x, 0, 2, 16.5); x.fillStyle = lin(x, 0, -14, 0, 18, [[0, '#ffd75a'], [1, '#a86e08']]); x.fill(); line(x, 0.9);   // 가슴 (코어 자리)
    ellipse(x, 0, -15, 9, 6.5); x.fillStyle = lin(x, 0, -21, 0, -9, [[0, '#4a5068'], [1, '#1b1e2c']]); x.fill(); line(x, 0.8);
    for (const s of [-1, 1]) { light(x, s * 4.2, -16, 2, '#ff5a6a'); x.beginPath(); x.moveTo(s * 3, -21); x.quadraticCurveTo(s * 6, -26, s * 10, -25); x.lineWidth = 0.8; x.strokeStyle = '#3a3f55'; x.stroke(); }
  }
  function orbShip(x) {   // 중간 보스: 둥근 배
    for (const s of [-1, 1]) { rrect(x, s * 14 - (s > 0 ? 0 : 14), 4, 14, 8, 4); x.fillStyle = '#3a4562'; x.fill(); line(x, 0.6); }
    circle(x, 0, 0, 25); x.fillStyle = rad(x, -8, -10, 34, [[0, '#a6d6d2'], [0.6, '#3e6b74'], [1, '#16282e']]); x.fill(); line(x, 1);
    ellipse(x, 0, 0, 25, 7); x.lineWidth = 0.7; x.strokeStyle = 'rgba(220,255,250,.35)'; x.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; light(x, Math.cos(a) * 20.5, Math.sin(a) * 20.5 * 0.9, 1.4, '#7dffe0'); }
    circle(x, 0, 0, 17.5); x.fillStyle = '#121a22'; x.fill(); line(x, 0.8);
  }

  /* ───── 보스 부위 ───── */
  function coreOpen(col1, col2, col3) {
    return x => {
      circle(x, 0, 0, 16); x.fillStyle = lin(x, 0, -16, 0, 16, [[0, '#59617e'], [1, '#1c2032']]); x.fill(); line(x, 0.9);
      circle(x, 0, 0, 12); x.fillStyle = rad(x, -3, -4, 13, [[0, '#ffffff'], [0.25, col1], [0.65, col2], [1, col3]]); x.fill(); line(x, 0.7);
      ellipse(x, -4, -5, 3, 2, -0.6); x.fillStyle = 'rgba(255,255,255,.55)'; x.fill();
    };
  }
  function coreClosed(x) {   // 닫힌 코어 (옆 부위를 다 부숴야 열려요)
    circle(x, 0, 0, 16); x.fillStyle = lin(x, 0, -16, 0, 16, [[0, '#59617e'], [1, '#1c2032']]); x.fill(); line(x, 0.9);
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * TAU + 0.06, a1 = ((i + 1) / 4) * TAU - 0.06;
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 12, a0, a1); x.closePath();
      x.fillStyle = lin(x, 0, -12, 0, 12, [[0, '#a9b3cc'], [1, '#4a536e']]); x.fill(); line(x, 0.5);
    }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; circle(x, Math.cos(a) * 7, Math.sin(a) * 7, 0.9); x.fillStyle = '#2a3048'; x.fill(); }
  }
  function claw(x) {   // 집게 (왼쪽) — 오른쪽은 뒤집어 써요
    x.scale(1.3, 1.3);
    x.beginPath(); x.moveTo(8, -10); x.quadraticCurveTo(2, -4, 0, 2); x.lineWidth = 5; x.strokeStyle = INK; x.stroke(); x.lineWidth = 3.4; x.strokeStyle = '#6b7a9f'; x.stroke();
    const top = [[-2, -2], [-9, -8], [-13, -2], [-10, 6], [-5, 11], [-2, 5]];
    hull(x, top, '#a3b2d6', '#3a4566', -8, 11, true);
    const jaw = [[2, 0], [6, 6], [4, 13], [-1, 12], [-1, 5]];
    hull(x, jaw, '#8d9cc2', '#2f3858', 0, 13, true);
    path(x, [[-10, 6], [-6, 13], [-5, 9]]); x.fillStyle = '#ffa23f'; x.fill(); line(x, 0.5);
    path(x, [[4, 13], [1, 16], [0, 12]]); x.fillStyle = '#ffa23f'; x.fill(); line(x, 0.5);
    light(x, -4, 0, 1.6, '#ffa23f');
  }
  function emitter(x) {   // 레이저 장치: 빨간 수정 (빨간 빛줄기를 쏴요)
    circle(x, 0, 0, 11); x.fillStyle = lin(x, 0, -11, 0, 11, [[0, '#c9d1e4'], [1, '#495270']]); x.fill(); line(x, 0.9);
    circle(x, 0, 0, 7.5); x.fillStyle = '#1b2034'; x.fill();
    path(x, [[0, -6], [4.6, 0], [0, 6.6], [-4.6, 0]]); x.fillStyle = lin(x, 0, -6, 0, 6.6, [[0, '#ffd0da'], [0.5, '#ff4d6d'], [1, '#9a1030']]); x.fill(); line(x, 0.5);
  }
  function wingGun(x) {   // 날개 포대
    for (const s of [-1, 1]) { rrect(x, s * 3.6 - 1.1, 3, 2.2, 9, 0.8); x.fillStyle = lin(x, 0, 3, 0, 12, [[0, '#4a5170'], [1, '#121522']]); x.fill(); line(x, 0.5); }
    rrect(x, -9, -8, 18, 14, 5); x.fillStyle = lin(x, 0, -8, 0, 6, [[0, '#9aa4bd'], [1, '#353d55']]); x.fill(); line(x, 0.9);
    light(x, 0, -2, 2, '#ffd23f');
  }
  function pod(x) {   // 모선 · 오브 십 포드
    circle(x, 0, 0, 9.5); x.fillStyle = rad(x, -3, -3.5, 12, [[0, '#cfc3ff'], [0.55, '#6a55b5'], [1, '#231a45']]); x.fill(); line(x, 0.9);
    circle(x, 0, 2.6, 3.4); x.fillStyle = '#1a1430'; x.fill(); light(x, 0, 2.6, 2.6, '#d08bff');
  }
  function orbitGun(x) {   // 바위 요새 둘레의 포대
    rrect(x, -1.3, 2, 2.6, 8, 1); x.fillStyle = '#1d2233'; x.fill(); line(x, 0.5);
    circle(x, 0, 0, 8); x.fillStyle = lin(x, 0, -8, 0, 8, [[0, '#a7b0c8'], [1, '#3a4256']]); x.fill(); line(x, 0.9);
    circle(x, 0, 0, 4.4); x.fillStyle = rad(x, -1, -1, 5, [[0, '#ffe1a6'], [0.5, '#ffa23f'], [1, '#8a3a08']]); x.fill(); line(x, 0.5);
  }

  /* ───── 효과 ───── */
  function fire(x) {   // 폭발 불덩이 (크기를 바꿔 가며 그려요)
    circle(x, 0, 0, 32); x.fillStyle = rad(x, 0, 0, 32, [[0, 'rgba(255,255,245,1)'], [0.16, 'rgba(255,242,190,.95)'], [0.38, 'rgba(255,176,70,.8)'], [0.66, 'rgba(230,80,40,.35)'], [1, 'rgba(120,30,30,0)']]); x.fill();
  }
  function smoke(x) { circle(x, 0, 0, 24); x.fillStyle = rad(x, 0, 0, 24, [[0, 'rgba(90,92,110,.5)'], [0.6, 'rgba(60,62,80,.28)'], [1, 'rgba(40,42,60,0)']]); x.fill(); }
  function spark(x) { circle(x, 0, 0, 3); x.fillStyle = rad(x, 0, 0, 3, [[0, '#ffffff'], [0.4, 'rgba(255,230,160,.9)'], [1, 'rgba(255,180,80,0)']]); x.fill(); }
  function shard(i) {
    return x => { const p = [[[-2, -1.6], [2.4, -0.6], [0.6, 2]], [[-1.6, -2], [1.8, -1.2], [1.2, 1.8], [-1.8, 1]], [[-2.4, 0], [0, -1.4], [2.2, 0.4], [0, 1.4]]][i];
      path(x, p); x.fillStyle = ['#8792b4', '#5a6382', '#b0a090'][i]; x.fill(); line(x, 0.4); };
  }
  function star(x) { circle(x, 0, 0, 1.5); x.fillStyle = rad(x, 0, 0, 1.5, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(220,230,255,.7)'], [1, 'rgba(200,215,255,0)']]); x.fill(); }

  /* ───── 배경: 스테이지마다 색 · 옅은 빛만 (모양 있는 물체는 없어요) ───── */
  const THEMES = [
    { name: 'nebula', top: '#0a0f2c', bot: '#161c4a', blobs: [[60, 0.25, 110, 'rgba(120,80,220,.16)'], [190, 0.6, 130, 'rgba(60,120,230,.14)'], [90, 0.92, 100, 'rgba(200,90,200,.08)']] },
    { name: 'belt', top: '#0e0c1a', bot: '#1d1726', blobs: [[180, 0.2, 120, 'rgba(200,140,80,.08)'], [50, 0.7, 120, 'rgba(150,110,90,.08)']] },
    { name: 'station', top: '#060b16', bot: '#0d1a2c', blobs: [[120, 0.5, 160, 'rgba(60,140,200,.09)']] },
    { name: 'planet', top: '#12060f', bot: '#2a0d17', blobs: [[60, 0.3, 110, 'rgba(220,70,60,.09)']], planet: true },
    { name: 'mother', top: '#0b0716', bot: '#1c1030', blobs: [[120, 0.35, 150, 'rgba(150,80,230,.12)'], [40, 0.9, 90, 'rgba(230,80,180,.07)']] },
  ];
  function background(k, i, H) {
    const T = THEMES[i % THEMES.length];
    const c = canvas(240 * k, H * k), x = c.getContext('2d');
    x.setTransform(c.width / 240, 0, 0, c.height / H, 0, 0);
    x.fillStyle = lin(x, 0, 0, 0, H, [[0, T.top], [1, T.bot]]); x.fillRect(0, 0, 240, H);
    for (const [bx, by, r, col] of T.blobs) { circle(x, bx, by * H, r); x.fillStyle = rad(x, bx, by * H, r, [[0, col], [1, 'rgba(0,0,0,0)']]); x.fill(); }
    if (T.planet) {   // 아주 멀리 있는 큰 행성 가장자리 (흐릿하게)
      circle(x, 250, H + 120, 230); x.fillStyle = rad(x, 200, H + 40, 260, [[0, 'rgba(120,30,30,.30)'], [0.85, 'rgba(80,20,25,.22)'], [1, 'rgba(255,120,90,.0)']]); x.fill();
      circle(x, 250, H + 120, 230); x.lineWidth = 3; x.strokeStyle = 'rgba(255,140,110,.10)'; x.stroke();
    }
    return c;
  }
  function deck(k, w) {   // 정거장 철판 (포탑이 올라앉아요) — 높이 34
    return spr(k, w + 2, 36, x => {
      rrect(x, -w / 2, -17, w, 34, 5); x.fillStyle = lin(x, 0, -17, 0, 17, [[0, '#56607e'], [1, '#262c42']]); x.fill(); line(x, 1);
      rrect(x, -w / 2 + 3, -13, w - 6, 26, 3); x.fillStyle = 'rgba(16,20,34,.35)'; x.fill(); x.lineWidth = 0.5; x.strokeStyle = 'rgba(200,215,250,.22)'; x.stroke();
      for (let i = -w / 2 + 14; i < w / 2 - 8; i += 18) { x.beginPath(); x.moveTo(i, -13); x.lineTo(i, 13); x.lineWidth = 0.5; x.strokeStyle = 'rgba(8,10,20,.45)'; x.stroke(); }
      for (const s of [-1, 1]) { circle(x, s * (w / 2 - 4.5), -12.5, 1.1); x.fillStyle = '#ffb347'; x.fill(); }
    });
  }

  /* ───── 한 번에 만들기 ───── */
  function build(k) {
    k = Math.max(1, k || 2);
    const S = (w, h, f) => spr(k, w, h, f);
    const A = {
      k,
      ship: S(21, 23, ship), flame: S(4, 9, flame),
      shotV: S(4, 10, shotV), shotM: S(3.4, 8.6, shotM), missile: S(5.4, 9, missile),
      eb: { o: S(7.2, 7.2, x => orb(x, 3.6, 'rgba(255,60,150,.75)', '#ff8fc4')), O: S(11, 11, x => orb(x, 5.5, 'rgba(255,90,40,.78)', '#ffb38a')),
        s: S(8.4, 8.4, x => orb(x, 4.2, 'rgba(170,90,255,.78)', '#d6b6ff')), n: S(4.4, 9.4, needle), B: S(14.4, 14.4, bigBomb) },
      items: { P: S(13, 13, itemP), V: S(13, 13, itemV), L: S(13, 13, itemL), M: S(13, 13, itemM), B: S(13, 13, itemB) },
      en: { pop: S(12, 12, pop), zako: S(14.4, 13.4, zako), swoop: S(15.6, 14.4, swoop), kami: S(17, 17, kami),
        mine: [S(15, 15, mine(true)), S(15, 15, mine(false))],
        pebble: [0, 1, 2].map(i => S(15, 15, rock(6.2, 11 + i))), rock: [0, 1, 2].map(i => S(31, 31, rock(13.4, 31 + i))),
        gun: S(25, 23, gun), turretBase: S(16, 16, turretBase), carrier: S(30, 16, carrier), heavy: S(44, 42, heavy) },
      boss: { crab: S(126, 70, crab), fortress: S(96, 92, fortress), guard: S(150, 54, guard), bomber: S(136, 78, bomber), mother: S(158, 118, mother),
        stinger: S(76, 66, stinger), orb: S(60, 54, orbShip) },
      part: { coreO: S(34, 34, coreOpen('#ffe7a6', '#ff8a2a', '#9a2410')), coreP: S(34, 34, coreOpen('#f0d6ff', '#b06bff', '#4a1a8a')),
        coreC: S(34, 34, coreClosed), clawL: S(38, 42, claw), emitter: S(24, 24, emitter), wingGun: S(20, 26, wingGun), pod: S(21, 21, pod), turret: S(18, 22, orbitGun) },
      fx: { fire: S(64, 64, fire), smoke: S(48, 48, smoke), spark: S(6, 6, spark), shard: [0, 1, 2].map(i => S(6, 6, shard(i))) },
      star: S(3, 3, star),
      flash, dark,
      _bg: {}, _deck: {},
      bg(i, H) { const key = i + ':' + H; return this._bg[key] || (this._bg[key] = background(k, i, H)); },
      deck(w) { return this._deck[w] || (this._deck[w] = deck(k, w)); },
    };
    A.part.clawR = spr(k, 38, 42, x => { x.scale(-1, 1); claw(x); });
    // 맞았을 때 · 부서졌을 때 그림도 미리 (게임 중에 처음 만들다가 멈칫하지 않게)
    const each = o => { for (const v of Object.values(o)) for (const s of Array.isArray(v) ? v : [v]) flash(s); };
    each(A.en); each(A.part);
    for (const s of Object.values(A.part)) dark(s);
    return A;
  }
  return { build, THEMES, rng, flash, dark };
})();
