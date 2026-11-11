/* 🖊️책상 위 (위에서 본 모습) — 나무 책상 · 공책 · 연필 · 볼펜 · 동전 · 클립 · 지우개 · 머그컵 · 휴대폰 · 안경 · 메모지 · 자 · 계산기 · 열쇠 (spot-core.js 장면)
 *  돌린 각도는 15° 단위 번호(0~23) — 정답 자리는 아래 cos · sin 표로만 계산해요 (기기마다 같게) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other, charX, digitSwap } = U;
  const CS = [1, 0.965926, 0.866025, 0.707107, 0.5, 0.258819, 0, -0.258819, -0.5, -0.707107, -0.866025, -0.965926, -1, -0.965926, -0.866025, -0.707107, -0.5, -0.258819, 0, 0.258819, 0.5, 0.707107, 0.866025, 0.965926];
  const SN = i => CS[(i + 18) % 24];
  const along = (o, d) => ({ x: o.x + CS[o.rot] * d, y: o.y + SN(o.rot) * d });     // 물건 축을 따라 d 만큼
  const rad = k => k * Math.PI / 12;
  const PENCIL = ['#f2c12e', '#2f6fd1', '#d9342b', '#3a9a4a', '#8a4fd1', '#f08a2a', '#2a2a2a'];
  const STICKY = ['#fff07a', '#ffb3c7', '#9fe0ff', '#b8f29a', '#ffcf8a'];
  const NOTES = ['우유', '3시', 'A+', '17', '숙제', '시험', '5천원', '전화', '책', 'B반'];
  const COIN = { 10: { r: 9, c: '#c98a4e' }, 50: { r: 10.5, c: '#c9ccd2' }, 100: { r: 11.5, c: '#d0d3d8' }, 500: { r: 13, c: '#d7dade' } };
  /** 그림자 (캔버스 배율에 맞춰) */
  const sh = (c, X, blur = 5, ox = 2.5, oy = 3.5, a = 0.45) => { c.shadowColor = `rgba(0,0,0,${a})`; c.shadowBlur = blur * X.Q; c.shadowOffsetX = ox * X.Q; c.shadowOffsetY = oy * X.Q; };
  const nosh = c => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };

  SC.scene('desk', {
    name: '🖊️ 책상 위',
    tone: () => '#ffe2b8',
    build(rnd, lv) {
      const objs = [], placed = [];
      const fits = (x, y, r) => x - r > 4 && x + r < 396 && y - r > 4 && y + r < 296 && placed.every(p => { const dx = p.x - x, dy = p.y - y, m = p.r + r + 3; return dx * dx + dy * dy > m * m; });
      const put = (r, make, tries = 40) => { for (let t = 0; t < tries; t++) { const x = n1(r + 6 + rnd() * (388 - 2 * r)), y = n1(r + 6 + rnd() * (288 - 2 * r)); if (fits(x, y, r)) { placed.push({ x, y, r }); const o = make(x, y); objs.push(o); return o; } } return null; };
      const px = rint(rnd, 40, 150), py = rint(rnd, 30, 60);
      objs.push({ t: 'paper', x: px, y: py, w: 150, h: 200, rot: pick(rnd, [-3, -2, 2, 3]), seed: rint(rnd, 1, 9999), bgo: 1 });
      put(31, (x, y) => ({ t: 'mug', x, y, r: 21, c: pick(rnd, ['#f4f1ea', '#2f6fd1', '#d9342b', '#2a2a2a', '#3a9a4a']), rot: rint(rnd, 0, 23), fill: pick(rnd, ['coffee', 'latte']) }));
      put(42, (x, y) => ({ t: 'phone', x, y, c: pick(rnd, ['#2a2a2e', '#e8e4dc', '#3a5a8a', '#d98aa0']), tm: `${rint(rnd, 1, 12)}:${rint(rnd, 1, 5)}${rint(rnd, 0, 9)}` }));
      if (rnd() < 0.8) put(40, (x, y) => ({ t: 'calc', x, y, c: pick(rnd, ['#3a3f4a', '#e8e4dc']), disp: String(rint(rnd, 12, 987)), key: pick(rnd, ['#f08a2a', '#d9342b', '#2f6fd1']) }));
      if (rnd() < 0.85) put(30, (x, y) => ({ t: 'glasses', x, y, rot: pick(rnd, [0, 1, 23, 22, 2]), c: pick(rnd, ['#2a2a2a', '#8a5a2b', '#b8323a', '#2f6fd1']), tint: rnd() < 0.3 ? 1 : 0 }));
      for (let k = rint(rnd, 2, 3); k > 0; k--) put(44, (x, y) => ({ t: 'pencil', x, y, len: rint(rnd, 72, 86), rot: rint(rnd, 0, 23), c: pick(rnd, PENCIL), tip: 1, er: pick(rnd, ['#f2a0a8', '#f5c0c8']) }));
      for (let k = rint(rnd, 1, 2); k > 0; k--) put(40, (x, y) => ({ t: 'pen', x, y, len: 72, rot: rint(rnd, 0, 23), c: pick(rnd, ['#f4f1ea', '#2a2a2a', '#2f6fd1', '#d9342b']), cap: pick(rnd, ['#2f6fd1', '#d9342b', '#2a2a2a', '#3a9a4a']), clip: 1 }));
      for (let k = rint(rnd, 2, 3); k > 0; k--) put(20, (x, y) => ({ t: 'sticky', x, y, rot: pick(rnd, [0, 1, 23, 22, 2]), c: pick(rnd, STICKY), txt: pick(rnd, NOTES) }));
      for (let k = rint(rnd, 4, 7) + (lv > 3 ? 2 : 0); k > 0; k--) { const v = pick(rnd, [10, 50, 100, 100, 500]); put(COIN[v].r + 3, (x, y) => ({ t: 'coin', x, y, v })); }
      for (let k = rint(rnd, 2, 4); k > 0; k--) put(14, (x, y) => ({ t: 'clip', x, y, rot: rint(rnd, 0, 23), c: pick(rnd, ['#c9ccd2', '#c9ccd2', '#e85a5a', '#4a8ad8', '#5ac85a']) }));
      if (rnd() < 0.8) put(18, (x, y) => ({ t: 'eraser', x, y, rot: rint(rnd, 0, 23), c: pick(rnd, ['#2f6fd1', '#3a9a4a', '#d9342b', '#2a2a2a']) }));
      if (rnd() < 0.7) put(22, (x, y) => ({ t: 'key', x, y, rot: rint(rnd, 0, 23), c: pick(rnd, ['#d9b45a', '#c9ccd2']), tag: pick(rnd, ['#e85a5a', '#4a8ad8', '#f2c12e']) }));
      if (rnd() < 0.6) put(18, (x, y) => ({ t: 'tape', x, y, c: pick(rnd, ['#e85a5a', '#4a8ad8', '#f2c12e', '#5ac85a']) }));
      if (rnd() < 0.6) put(80, (x, y) => ({ t: 'ruler', x, y, len: 150, c: pick(rnd, ['#f2e6c0', '#dfe8f0']), nums: '0123456789' }), 30);
      return { bg: { wood: pick(rnd, ['#a8743f', '#8f5f32', '#b9874e', '#7a5232']), planks: rint(rnd, 3, 4) }, objs };
    },
    adds: [
      { zone: [20, 380, 20, 280], r: 14, d: 2, make: (rnd, x, y) => ({ t: 'coin', x, y, v: pick(rnd, [10, 50, 100]) }) },
      { zone: [20, 380, 20, 280], r: 14, d: 2, make: (rnd, x, y) => ({ t: 'clip', x, y, rot: rint(rnd, 0, 23), c: '#c9ccd2' }) },
    ],
    back(c, bg, X) {
      c.fillStyle = bg.wood; c.fillRect(0, 0, 400, 300);
      const ph = 300 / bg.planks;
      for (let i = 0; i < bg.planks; i++) {
        c.beginPath(); c.rect(0, i * ph, 400, ph);
        c.fillStyle = P.vgrad(c, i * ph, (i + 1) * ph, P.lit(bg.wood, (i % 2) * 0.06 - 0.03), 0.06, -0.08); c.fill();
        X.tex(c, 140 + i, 0.55, 'overlay', 18, 6, 0.25); X.tex(c, 150 + i, 0.25, 'multiply', 6, 4, 0.2);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, (i + 1) * ph - 1, 400, 1.4);
      }
      const g = c.createRadialGradient(90, 40, 20, 160, 120, 380); g.addColorStop(0, 'rgba(255,240,210,.25)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
      c.fillStyle = g; c.fillRect(0, 0, 400, 300);
    },
  });

  SC.type('paper', {
    z: 2, bb: o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: 120 }), muts: [],
    draw(c, o, X) {
      c.translate(o.x + o.w / 2, o.y + o.h / 2); c.rotate(o.rot * Math.PI / 180);
      sh(c, X, 6, 3, 4, 0.35); c.fillStyle = '#f7f5ee'; c.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); nosh(c);
      c.beginPath(); c.rect(-o.w / 2, -o.h / 2, o.w, o.h); X.tex(c, 160, 0.12, 'multiply', 8);
      c.strokeStyle = 'rgba(80,130,200,.35)'; c.lineWidth = 0.7;
      for (let y = -o.h / 2 + 22; y < o.h / 2 - 6; y += 11) { c.beginPath(); c.moveTo(-o.w / 2, y); c.lineTo(o.w / 2, y); c.stroke(); }
      c.strokeStyle = 'rgba(220,80,80,.45)'; c.beginPath(); c.moveTo(-o.w / 2 + 18, -o.h / 2); c.lineTo(-o.w / 2 + 18, o.h / 2); c.stroke();
      const R = U.rng(o.seed); c.strokeStyle = 'rgba(40,50,90,.55)'; c.lineWidth = 0.8;           // 손글씨 흉내
      for (let y = -o.h / 2 + 30; y < o.h / 2 - 20; y += 11) { if (R() < 0.25) continue; let x = -o.w / 2 + 24; const end = o.w / 2 - 10 - R() * 50; c.beginPath(); c.moveTo(x, y); while (x < end) { x += 2 + R() * 3; c.lineTo(x, y - 1 - R() * 4); } c.stroke(); }
    },
  });
  SC.type('pencil', {
    z: 20,
    bb: o => ({ x: o.x, y: o.y, r: o.len / 2 + 9 }),
    muts: [
      { k: 'color', d: 2, w: 1.3, apply: (o, rnd, lv) => ({ ...o, c: lv < 2.5 ? other(rnd, PENCIL, o.c, lv) : shift(rnd, o.c, lv) }) },
      { k: 'part', d: 3, w: 1, apply: o => ({ ...o, tip: 0 }), at: o => ({ ...along(o, o.len / 2 - 4), r: 9 }) },
      { k: 'color', d: 4, w: 0.7, apply: o => ({ ...o, er: o.er === '#f2a0a8' ? '#7ab8f0' : '#9ad08a' }), at: o => ({ ...along(o, -o.len / 2 + 4), r: 9 }) },
      { k: 'rot', d: 2, w: 0.8, apply: o => ({ ...o, rot: (o.rot + 3) % 24 }) },
    ],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      const L = o.len / 2, w = 4.2;
      sh(c, X);
      c.fillStyle = o.c; c.fillRect(-L + 10, -w, 2 * L - 24, 2 * w);
      nosh(c);
      const g = c.createLinearGradient(0, -w, 0, w); g.addColorStop(0, P.lit(o.c, 0.35)); g.addColorStop(0.35, o.c); g.addColorStop(0.55, P.lit(o.c, -0.15)); g.addColorStop(0.62, P.lit(o.c, 0.1)); g.addColorStop(1, P.lit(o.c, -0.35));
      c.fillStyle = g; c.fillRect(-L + 10, -w, 2 * L - 24, 2 * w);
      c.fillStyle = '#c9ccd2'; c.fillRect(-L + 4, -w, 7, 2 * w); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-L + 6, -w, 0.8, 2 * w); c.fillRect(-L + 8.5, -w, 0.8, 2 * w);
      c.fillStyle = P.vgrad(c, -w, w, o.er, 0.2, -0.25); P.rr(c, -L, -w, 6, 2 * w, 2); c.fill();
      c.beginPath(); c.moveTo(L - 14, -w); c.lineTo(L - (o.tip ? 2 : 7), -(o.tip ? 0.9 : 2)); c.lineTo(L - (o.tip ? 2 : 7), o.tip ? 0.9 : 2); c.lineTo(L - 14, w); c.closePath();
      c.fillStyle = '#e8c79a'; c.fill();
      c.beginPath(); c.moveTo(L - 7, -1.8); c.lineTo(L - (o.tip ? 0 : 6), 0); c.lineTo(L - 7, 1.8); c.closePath(); c.fillStyle = '#3a3a3e'; c.fill();
    },
  });
  SC.type('pen', {
    z: 21,
    bb: o => ({ x: o.x, y: o.y, r: o.len / 2 + 9 }),
    muts: [
      { k: 'color', d: 3, w: 1, apply: (o, rnd, lv) => ({ ...o, cap: shift(rnd, o.cap, Math.max(lv, 2)) }), at: o => ({ ...along(o, o.len / 2 - 11), r: 13 }) },
      { k: 'part', d: 4, w: 0.8, apply: o => ({ ...o, clip: 0 }), at: o => ({ ...along(o, o.len / 2 - 14), r: 11 }) },
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) },
    ],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      const L = o.len / 2, w = 3.6;
      sh(c, X);
      P.rr(c, -L, -w, 2 * L - 2, 2 * w, w); c.fillStyle = o.c; c.fill();
      nosh(c);
      P.rr(c, -L, -w, 2 * L - 2, 2 * w, w); c.fillStyle = P.vgrad(c, -w, w, o.c, 0.4, -0.35); c.fill();
      P.rr(c, L - 22, -w - 0.4, 22, 2 * w + 0.8, w); c.fillStyle = P.vgrad(c, -w, w, o.cap, 0.35, -0.35); c.fill();
      if (o.clip) { c.fillStyle = '#d8dce2'; c.fillRect(L - 20, -1, 14, 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(L - 20, 1, 14, 0.6); }
      c.fillStyle = '#9aa0a8'; c.beginPath(); c.moveTo(-L, -2); c.lineTo(-L - 5, 0); c.lineTo(-L, 2); c.fill();
    },
  });
  SC.type('coin', {
    z: 25,
    bb: o => ({ x: o.x, y: o.y, r: COIN[o.v].r + 4 }),
    muts: [
      { k: 'text', d: 3, w: 1.3, apply: o => ({ ...o, v: o.v === 100 ? 500 : o.v === 500 ? 100 : o.v === 10 ? 50 : 10 }) },
      { k: 'remove', d: 2, w: 1, apply: () => null },
    ],
    draw(c, o, X) {
      const C = COIN[o.v], r = C.r;
      sh(c, X, 3, 1.5, 2, 0.5); c.beginPath(); c.arc(o.x, o.y, r, 0, Math.PI * 2); c.fillStyle = C.c; c.fill(); nosh(c);
      c.beginPath(); c.arc(o.x, o.y, r, 0, Math.PI * 2);
      const g = c.createLinearGradient(o.x - r, o.y - r, o.x + r, o.y + r); g.addColorStop(0, P.lit(C.c, 0.45)); g.addColorStop(0.5, C.c); g.addColorStop(1, P.lit(C.c, -0.3)); c.fillStyle = g; c.fill();
      c.strokeStyle = P.lit(C.c, -0.25); c.lineWidth = 0.8; c.beginPath(); c.arc(o.x, o.y, r - 1.6, 0, Math.PI * 2); c.stroke();
      P.mono(c, String(o.v), o.x, o.y + 0.5, o.v === 500 ? 7.5 : 7, P.lit(C.c, -0.45), 900);
    },
  });
  SC.type('clip', {
    z: 24,
    bb: o => ({ x: o.x, y: o.y, r: 13 }),
    muts: [
      { k: 'color', d: 3, w: 1, apply: (o, rnd, lv) => ({ ...o, c: o.c === '#c9ccd2' ? pick(rnd, ['#e85a5a', '#4a8ad8', '#5ac85a']) : shift(rnd, o.c, lv) }) },
      { k: 'remove', d: 2, w: 0.8, apply: () => null },
      { k: 'rot', d: 3, w: 0.6, apply: o => ({ ...o, rot: (o.rot + 6) % 24 }) },
    ],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      sh(c, X, 2, 1, 1.5, 0.45);
      c.strokeStyle = o.c; c.lineWidth = 1.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, 4); c.lineTo(8, 4); c.arc(8, 0, 4, Math.PI / 2, -Math.PI / 2, true); c.lineTo(-8, -4); c.arc(-8, -1, 3, -Math.PI / 2, Math.PI / 2, true); c.lineTo(5, 2); c.arc(5, 0, 2, Math.PI / 2, -Math.PI / 2, true); c.lineTo(-4, -2); c.stroke();
      nosh(c);
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-3, 3.6); c.lineTo(8, 3.6); c.stroke();
    },
  });
  SC.type('eraser', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y, r: 17 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) }, { k: 'remove', d: 1, w: 0.7, apply: () => null }],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      sh(c, X); P.rr(c, -13, -7, 26, 14, 2.5); c.fillStyle = '#f4f1ea'; c.fill(); nosh(c);
      P.rr(c, -13, -7, 26, 14, 2.5); c.fillStyle = P.vgrad(c, -7, 7, '#f4f1ea', 0.3, -0.15); c.fill();
      c.fillStyle = P.vgrad(c, -7.4, 7.4, o.c, 0.25, -0.25); c.fillRect(-6, -7.4, 19, 14.8);
      P.mono(c, 'MONO', 3.5, 0.5, 5, 'rgba(255,255,255,.85)', 900);
    },
  });
  SC.type('mug', {
    z: 26,
    bb: o => ({ x: o.x, y: o.y, r: o.r + 12 }),
    muts: [
      { k: 'rot', d: 2, w: 1, apply: o => ({ ...o, rot: (o.rot + 6) % 24 }), at: o => U.union({ ...along(o, o.r + 6), r: 14 }, { ...along({ ...o, rot: (o.rot + 6) % 24 }, o.r + 6), r: 14 }) },
      { k: 'color', d: 2, w: 1, apply: o => ({ ...o, fill: o.fill === 'coffee' ? 'latte' : 'coffee' }), at: o => ({ x: o.x, y: o.y, r: o.r - 2 }) },
      { k: 'color', d: 3, w: 0.8, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2)) }) },
    ],
    draw(c, o, X) {
      const { x, y, r } = o;
      c.save(); c.translate(x, y); c.rotate(rad(o.rot));
      sh(c, X, 6, 3, 4, 0.45); c.strokeStyle = o.c; c.lineWidth = 4.5; c.beginPath(); c.arc(r + 4, 0, 6.5, -Math.PI / 2, Math.PI / 2); c.stroke(); nosh(c);
      c.strokeStyle = P.lit(o.c, 0.15); c.lineWidth = 4.5; c.beginPath(); c.arc(r + 4, 0, 6.5, -Math.PI / 2, Math.PI / 2); c.stroke();
      c.restore();
      sh(c, X, 7, 3, 4, 0.5); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = o.c; c.fill(); nosh(c);
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); P.ballFill(c, x, y, r, o.c, 0.35, -0.3);
      c.beginPath(); c.arc(x, y, r - 3, 0, Math.PI * 2); c.fillStyle = P.lit(o.c, -0.25); c.fill();
      const fc = o.fill === 'coffee' ? '#3a2214' : '#b88a5a';
      c.beginPath(); c.arc(x, y, r - 4.5, 0, Math.PI * 2); const g = c.createRadialGradient(x - 4, y - 4, 1, x, y, r - 4.5); g.addColorStop(0, P.lit(fc, 0.25)); g.addColorStop(1, P.lit(fc, -0.2)); c.fillStyle = g; c.fill();
      if (o.fill === 'latte') { c.strokeStyle = 'rgba(250,240,225,.8)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y + 2, 6, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(x, y + 2, 3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.45)'; P.ell(c, x - r * 0.4, y - r * 0.55, 3, 1.5, -0.6); c.fill();
    },
  });
  SC.type('phone', {
    z: 23,
    bb: o => ({ x: o.x, y: o.y, r: 40 }),
    muts: [
      { k: 'text', d: 3, w: 1.2, apply(o, rnd) { const [s, i] = digitSwap(rnd, o.tm); return i < 0 ? undefined : { ...o, tm: s, di: i }; }, at: (o, nb) => ({ x: charX(nb.tm, nb.di, 13, o.x), y: o.y - 18, r: 9 }) },
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2)) }) },
      { k: 'part', d: 3, w: 0.8, apply: o => ({ ...o, app: 1 }), at: o => ({ x: o.x + 4, y: o.y + 11.8, r: 9 }) },
    ],
    draw(c, o, X) {
      const { x, y } = o;
      sh(c, X, 7, 3, 4, 0.5); P.rr(c, x - 21, y - 38, 42, 76, 7); c.fillStyle = o.c; c.fill(); nosh(c);
      P.rr(c, x - 21, y - 38, 42, 76, 7); c.fillStyle = P.hgrad(c, x - 21, x + 21, o.c, 0.2, -0.25); c.fill();
      P.rr(c, x - 18, y - 35, 36, 70, 5); const g = c.createLinearGradient(x - 18, y - 35, x + 18, y + 35); g.addColorStop(0, '#1d2a4a'); g.addColorStop(1, '#4a2a5a'); c.fillStyle = g; c.fill();
      P.mono(c, o.tm, x, y - 18, 13, '#f4f6ff', 400);
      P.mono(c, '11월 11일 수요일', x, y - 7, 4.6, 'rgba(244,246,255,.75)', 500);
      const ic = ['#4ad87a', '#4a8ad8', '#f2c12e', '#e85a5a'];
      for (let i = 0; i < 4; i++) { P.rr(c, x - 14 + i * 7.6, y + 9, 5.6, 5.6, 1.4); c.fillStyle = i === 2 && o.app ? '#9a6ad8' : ic[i]; c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.7)'; P.rr(c, x - 6, y + 31, 12, 1.4, 0.7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(x - 18, y - 35); c.lineTo(x + 2, y - 35); c.lineTo(x - 18, y + 5); c.fill();
      c.fillStyle = P.lit(o.c, -0.3); c.beginPath(); c.arc(x, y - 33, 1.2, 0, Math.PI * 2); c.fill();
    },
  });
  SC.type('glasses', {
    z: 27,
    bb: o => ({ x: o.x, y: o.y, r: 28 }),
    muts: [
      { k: 'color', d: 3, w: 1, apply: o => ({ ...o, tint: o.tint ? 0 : 1 }) },
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2)) }) },
    ],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      sh(c, X, 3, 2, 3, 0.4);
      c.strokeStyle = o.c; c.lineWidth = 2;
      for (const s of [-1, 1]) { P.ell(c, s * 11, 0, 9, 7); c.stroke(); }
      c.beginPath(); c.moveTo(-2.5, -1); c.quadraticCurveTo(0, -3.5, 2.5, -1); c.stroke();
      c.beginPath(); c.moveTo(-20, -3); c.lineTo(-24, 14); c.moveTo(20, -3); c.lineTo(24, 14); c.stroke();
      nosh(c);
      for (const s of [-1, 1]) { P.ell(c, s * 11, 0, 8, 6); c.fillStyle = o.tint ? 'rgba(60,40,20,.55)' : 'rgba(200,230,255,.18)'; c.fill(); c.fillStyle = 'rgba(255,255,255,.45)'; P.ell(c, s * 11 - 3, -2.5, 2.5, 1, -0.5); c.fill(); }
    },
  });
  SC.type('sticky', {
    z: 28,
    bb: o => ({ x: o.x, y: o.y, r: 19 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: other(rnd, STICKY, o.c, lv) }) },
      { k: 'text', d: 3, w: 1, apply: (o, rnd) => ({ ...o, txt: pick(rnd, NOTES.filter(t => t !== o.txt)) }), at: o => ({ x: o.x, y: o.y + 1, r: 13 }) },
    ],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot > 12 ? o.rot - 24 : o.rot) * 0.5);
      sh(c, X, 4, 2, 3, 0.35); c.fillStyle = o.c; c.fillRect(-13, -13, 26, 26); nosh(c);
      const g = c.createLinearGradient(0, -13, 0, 13); g.addColorStop(0, P.lit(o.c, -0.08)); g.addColorStop(0.2, o.c); g.addColorStop(1, P.lit(o.c, 0.15)); c.fillStyle = g; c.fillRect(-13, -13, 26, 26);
      P.mono(c, o.txt, 0, 1, o.txt.length > 3 ? 6 : 8.5, '#2a3a8a', 700, 'center', '"Nanum Pen Script", "Noto Sans KR", cursive');
    },
  });
  SC.type('ruler', {
    z: 19,
    bb: o => ({ x: o.x, y: o.y, r: o.len / 2 + 5 }),
    muts: [{ k: 'text', d: 4, w: 0.9, apply(o, rnd) { const i = rint(rnd, 1, 8), s = [...o.nums]; s[i] = String((+s[i] + pick(rnd, [2, 3, 4])) % 10); return { ...o, nums: s.join(''), di: i }; }, at: (o, nb) => ({ x: o.x - o.len / 2 + 8 + nb.di * 15, y: o.y + 2, r: 9 }) }],
    draw(c, o, X) {
      const x0 = o.x - o.len / 2, y0 = o.y - 11;
      sh(c, X, 4, 2, 3, 0.35); c.fillStyle = P.rgba(o.c, 0.92); c.fillRect(x0, y0, o.len, 22); nosh(c);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x0, y0, o.len, 3);
      c.strokeStyle = 'rgba(30,30,40,.75)'; c.lineWidth = 0.6;
      for (let i = 0; i <= 140; i += 3) { const L = i % 15 === 0 ? 7 : i % 15 === 6 || i % 15 === 9 ? 3 : 4.5; c.beginPath(); c.moveTo(x0 + 8 + i, y0); c.lineTo(x0 + 8 + i, y0 + L); c.stroke(); }
      for (let i = 0; i < 10; i++) P.mono(c, o.nums[i], x0 + 8 + i * 15, o.y + 2, 5.5, '#222', 700);
    },
  });
  SC.type('calc', {
    z: 23,
    bb: o => ({ x: o.x, y: o.y, r: 38 }),
    muts: [
      { k: 'text', d: 3, w: 1.1, apply(o, rnd) { const [s, i] = digitSwap(rnd, o.disp); return i < 0 ? undefined : { ...o, disp: s, di: i }; }, at: (o, nb) => ({ x: o.x + 15 - (nb.disp.length - 1 - nb.di) * 6, y: o.y - 18, r: 9 }) },
      { k: 'color', d: 3, w: 0.9, apply: (o, rnd, lv) => ({ ...o, key: shift(rnd, o.key, Math.max(lv, 2.5)) }), at: o => ({ x: o.x + 13, y: o.y + 23, r: 9 }) },
    ],
    draw(c, o, X) {
      const { x, y } = o;
      sh(c, X, 6, 3, 4, 0.5); P.rr(c, x - 23, y - 33, 46, 66, 5); c.fillStyle = o.c; c.fill(); nosh(c);
      P.rr(c, x - 23, y - 33, 46, 66, 5); c.fillStyle = P.vgrad(c, y - 33, y + 33, o.c, 0.15, -0.2); c.fill();
      c.fillStyle = '#b8c4a8'; P.rr(c, x - 19, y - 28, 38, 15, 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x - 19, y - 28, 38, 2);
      [...o.disp].forEach((ch, i) => P.mono(c, ch, x + 15 - (o.disp.length - 1 - i) * 6, y - 20.5, 9.5, '#2a3020', 700, 'center', '"Courier New", monospace'));
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
        const kx = x - 19 + k * 10, ky = y - 8 + r * 10, last = r === 3 && k === 3;
        P.rr(c, kx, ky, 8, 7.5, 1.6); c.fillStyle = last ? o.key : o.c === '#e8e4dc' ? '#c8c4bc' : '#5a606c'; c.fill();
        c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(kx + 1, ky + 1, 6, 1.2);
      }
    },
  });
  SC.type('key', {
    z: 24,
    bb: o => ({ x: o.x, y: o.y, r: 21 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, tag: shift(rnd, o.tag, Math.max(lv, 2)) }) }, { k: 'remove', d: 2, w: 0.8, apply: () => null }],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      sh(c, X, 3, 1.5, 2.5, 0.45);
      c.strokeStyle = '#b8bcc4'; c.lineWidth = 1.6; c.beginPath(); c.arc(-9, 0, 6, 0, Math.PI * 2); c.stroke();
      c.fillStyle = o.c; P.rr(c, -3, -4, 10, 8, 3); c.fill(); c.fillRect(6, -1.6, 13, 3.2);
      c.fillRect(13, 1.6, 2, 2.4); c.fillRect(16, 1.6, 2, 3);
      nosh(c);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(6, -1.6, 13, 1);
      c.fillStyle = o.tag; P.rr(c, -21, -5, 8, 10, 2); c.fill();
    },
  });
  SC.type('tape', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y, r: 17 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) }],
    draw(c, o, X) {
      sh(c, X, 4, 2, 3, 0.45); c.beginPath(); c.arc(o.x, o.y, 13, 0, Math.PI * 2); c.fillStyle = o.c; c.fill(); nosh(c);
      c.beginPath(); c.arc(o.x, o.y, 13, 0, Math.PI * 2); P.ballFill(c, o.x, o.y, 13, o.c, 0.3, -0.25);
      c.beginPath(); c.arc(o.x, o.y, 7, 0, Math.PI * 2); c.fillStyle = '#e8dcc0'; c.fill();
      c.beginPath(); c.arc(o.x, o.y, 5.5, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill();
    },
  });
});
