/* 🌷 정원 — 울타리 · 새집 · 해바라기 · 튤립 · 데이지 · 장미 덤불 · 징검돌 · 무당벌레 · 나비 · 벌 · 달팽이 · 물뿌리개 · 난쟁이 인형 · 버섯 (spot-core.js 장면) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other } = U;
  const TULIP = ['#e8304a', '#ff8a3d', '#ffd23f', '#f06fa8', '#9b59d0', '#f4f1ea'];
  const ROSE = ['#d9233a', '#f06fa8', '#ffcf4a', '#f4f1ea', '#ff7a5a'];

  SC.scene('garden', {
    name: '🌷 정원',
    tone: () => '#fff0b0',
    build(rnd, lv) {
      const objs = [], fc = pick(rnd, ['#f4f1ea', '#e8dcc0', '#b98a5a']);
      for (let x = 2; x < 400; x += 17) objs.push({ t: 'picket', x, top: n1(56 + (rnd() < 0.2 ? rint(rnd, -4, 6) : 0) + (x % 34 ? 2 : 0)), c: fc });
      objs.push({ t: 'bhouse', x: rint(rnd, 40, 360), y: 60, c: pick(rnd, ['#d9342b', '#2f6fd1', '#f2c12e', '#3a9a4a']), rc: pick(rnd, ['#5a3a28', '#2a2a2a', '#8a2a2a']), perch: 1 });
      for (let k = rint(rnd, 2, 3); k > 0; k--) objs.push({ t: 'sunf', x: rint(rnd, 20, 380), y: rint(rnd, 128, 140), h: rint(rnd, 50, 64), s: n1(0.9 + rnd() * 0.2), c: '#ffc21a' });
      const placed = [];
      const free = (x, y, r) => placed.every(p => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) > (p.r + r) * (p.r + r));
      const put = (r, y0, y1, make, tries = 30) => { for (let t = 0; t < tries; t++) { const x = n1(r + 4 + rnd() * (392 - 2 * r)), y = n1(y0 + rnd() * (y1 - y0)); if (free(x, y, r)) { placed.push({ x, y, r }); objs.push(make(x, y)); return; } } };
      // 징검돌 (아래 왼쪽 → 가운데)
      const sx = rint(rnd, 60, 200);
      for (let i = 0; i < 6; i++) { const x = n1(sx + i * 22 + (rnd() - 0.5) * 8), y = n1(292 - i * 24); placed.push({ x, y, r: 14 }); objs.push({ t: 'stone', x, y, rx: rint(rnd, 11, 14), ry: rint(rnd, 6, 8), c: pick(rnd, ['#a8a49a', '#9a958a', '#b8b2a6']) }); }
      for (let k = rint(rnd, 2, 3); k > 0; k--) put(26, 170, 270, (x, y) => ({ t: 'bush', x, y, r: rint(rnd, 20, 25), c: pick(rnd, ROSE), n: rint(rnd, 5, 7), seed: rint(rnd, 1, 9999), miss: -1 }));
      for (let k = rint(rnd, 5, 7) + (lv > 3 ? 2 : 0); k > 0; k--) put(12, 140, 290, (x, y) => ({ t: 'tulip', x, y, h: rint(rnd, 24, 34), c: pick(rnd, TULIP), leaf: 2 }));
      for (let k = rint(rnd, 4, 6); k > 0; k--) put(11, 150, 292, (x, y) => ({ t: 'daisy', x, y, r: rint(rnd, 7, 9), n: rint(rnd, 10, 12), cc: '#f2b81a' }));
      if (rnd() < 0.8) put(20, 210, 285, (x, y) => ({ t: 'can', x, y, c: pick(rnd, ['#3a9a4a', '#2f6fd1', '#d9342b', '#9aa3ad']), dir: rnd() < 0.5 ? 1 : -1 }));
      if (rnd() < 0.7) put(18, 180, 270, (x, y) => ({ t: 'gnome', x, y, hat: pick(rnd, ['#d9233a', '#2f6fd1', '#3a9a4a']), coat: pick(rnd, ['#2f6fd1', '#3a9a4a', '#8a4fd1']) }));
      for (let k = rint(rnd, 1, 2); k > 0; k--) put(10, 220, 292, (x, y) => ({ t: 'mush', x, y, c: pick(rnd, ['#d9233a', '#c98a4e']), dots: 1 }));
      if (rnd() < 0.7) put(12, 230, 290, (x, y) => ({ t: 'snail', x, y, dir: rnd() < 0.5 ? 1 : -1, c: pick(rnd, ['#c98a4e', '#e0b070', '#a86a3a']) }));
      for (let k = rint(rnd, 2, 3); k > 0; k--) objs.push({ t: 'bfly', x: rint(rnd, 30, 370), y: rint(rnd, 90, 200), c1: pick(rnd, ['#ff8a3d', '#4aa8ff', '#ffd23f', '#f06fa8', '#9b59d0']), c2: '#2a2a2a', s: n1(0.9 + rnd() * 0.3) });
      for (let k = rint(rnd, 2, 3); k > 0; k--) objs.push({ t: 'lady', x: rint(rnd, 20, 380), y: rint(rnd, 150, 290), rot: rint(rnd, 0, 7), spots: rint(rnd, 5, 7) });
      if (rnd() < 0.8) objs.push({ t: 'bee', x: rint(rnd, 30, 370), y: rint(rnd, 100, 220), dir: rnd() < 0.5 ? 1 : -1 });
      return { bg: { seed: rint(rnd, 1, 9999), sky: pick(rnd, [['#9fd4ff', '#e8f6ff'], ['#ffd6a8', '#fff2dc'], ['#b8e0ff', '#f4fbff']]) }, objs };
    },
    adds: [
      { zone: [20, 380, 150, 290], r: 8, d: 3, make: (rnd, x, y) => ({ t: 'lady', x, y, rot: rint(rnd, 0, 7), spots: 6 }) },
      { zone: [20, 380, 160, 290], r: 12, d: 2, make: (rnd, x, y) => ({ t: 'tulip', x, y, h: 26, c: pick(rnd, TULIP), leaf: 2 }) },
    ],
    back(c, bg, X) {
      const g = c.createLinearGradient(0, 0, 0, 80); g.addColorStop(0, bg.sky[0]); g.addColorStop(1, bg.sky[1]);
      c.fillStyle = g; c.fillRect(0, 0, 400, 80);
      const R = U.rng(bg.seed);
      for (let i = 0; i < 4; i++) { const x = R() * 400, y = 10 + R() * 25; c.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + k * 9 - 18, y + (k % 2) * 3, 8 + R() * 5, 0, Math.PI * 2); c.fill(); } }
      c.fillStyle = '#4f7a3a'; c.beginPath(); c.moveTo(0, 60); for (let x = 0; x <= 400; x += 16) c.lineTo(x, 44 + R() * 14); c.lineTo(400, 90); c.lineTo(0, 90); c.fill();     // 먼 나무 줄
      c.beginPath(); c.rect(0, 40, 400, 50); X.tex(c, 91, 0.45, 'overlay', 5);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 74, 400, 3); c.fillRect(0, 98, 400, 3);              // 울타리 가로대 그림자
      const gg = c.createLinearGradient(0, 95, 0, 300); gg.addColorStop(0, '#5f9a3a'); gg.addColorStop(1, '#3f7a2a');
      c.fillStyle = gg; c.fillRect(0, 95, 400, 205);
      c.beginPath(); c.rect(0, 95, 400, 205); X.tex(c, 92, 0.55, 'overlay', 2.5, 0.5, 1.6); X.tex(c, 93, 0.3, 'multiply', 22);
      c.strokeStyle = 'rgba(160,220,110,.35)'; c.lineWidth = 0.8;
      for (let i = 0; i < 260; i++) { const x = R() * 400, y = 100 + R() * 200; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 4); c.stroke(); }
    },
  });
  SC.type('picket', {
    z: 10,
    bb: o => ({ x: o.x + 7, y: (o.top + 112) / 2, r: (112 - o.top) / 2 + 3 }),
    cover: (o, x, y) => x > o.x && x < o.x + 14 && y > o.top + 2 && y < 112,
    muts: [
      { k: 'remove', d: 2, w: 0.7, apply: () => null },
      { k: 'size', d: 3, w: 0.8, apply: o => ({ ...o, top: o.top - 9 }), at: o => ({ x: o.x + 7, y: o.top - 2, r: 10 }) },
      { k: 'color', d: 3, w: 0.5, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2.5)) }) },
    ],
    draw(c, o) {
      const { x, top } = o;
      c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 3, top + 4, 14, 112 - top - 2);
      c.beginPath(); c.moveTo(x, top + 7); c.lineTo(x + 7, top); c.lineTo(x + 14, top + 7); c.lineTo(x + 14, 112); c.lineTo(x, 112); c.closePath();
      c.fillStyle = P.hgrad(c, x, x + 14, o.c, 0.15, -0.28); c.fill();
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(x + 7, 78, 1, 0, Math.PI * 2); c.arc(x + 7, 102, 1, 0, Math.PI * 2); c.fill();
    },
  });
  SC.type('bhouse', {
    z: 12,
    bb: o => ({ x: o.x, y: o.y + 4, r: 22 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }), at: o => ({ x: o.x, y: o.y + 8, r: 14 }) },
      { k: 'color', d: 3, w: 0.8, apply: (o, rnd, lv) => ({ ...o, rc: shift(rnd, o.rc, Math.max(lv, 2.5)) }), at: o => ({ x: o.x, y: o.y - 8, r: 17 }) },
      { k: 'part', d: 4, w: 0.7, apply: o => ({ ...o, perch: 0 }), at: o => ({ x: o.x, y: o.y + 15.5, r: 9 }) },
    ],
    draw(c, o) {
      const { x, y } = o;
      c.fillStyle = '#6b4a2a'; c.fillRect(x - 2, y + 18, 4, 30);
      c.fillStyle = P.hgrad(c, x - 11, x + 11, o.c, 0.2, -0.3); c.fillRect(x - 11, y - 2, 22, 22);
      c.beginPath(); c.moveTo(x - 15, y); c.lineTo(x, y - 14); c.lineTo(x + 15, y); c.closePath(); c.fillStyle = P.vgrad(c, y - 14, y, o.rc, 0.2, -0.2); c.fill();
      c.fillStyle = '#1a1410'; c.beginPath(); c.arc(x, y + 7, 3.6, 0, Math.PI * 2); c.fill();
      if (o.perch) { c.fillStyle = '#5a3a1e'; c.fillRect(x - 1, y + 12, 2, 7); c.beginPath(); c.arc(x, y + 19, 1.6, 0, Math.PI * 2); c.fill(); }
    },
  });
  SC.type('sunf', {
    z: 15,
    bb: o => ({ x: o.x, y: o.y - o.h, r: 17 * o.s }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) },
      { k: 'size', d: 3, w: 0.8, apply: o => ({ ...o, s: n1(o.s * 0.78) }) },
    ],
    draw(c, o) {
      const { x, s } = o, y = o.y - o.h;
      c.strokeStyle = '#3f7a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(o.x, o.y); c.quadraticCurveTo(x + 4, (y + o.y) / 2, x, y + 6); c.stroke();
      c.fillStyle = '#4f8a32'; P.ell(c, x + 7, (y + o.y) / 2 + 4, 7, 3, -0.4); c.fill(); P.ell(c, x - 7, (y + o.y) / 2 + 12, 7, 3, 0.4); c.fill();
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; c.save(); c.translate(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s); c.rotate(a); P.ell(c, 0, 0, 6 * s, 2.6 * s); c.fillStyle = P.lit(o.c, (i % 2) * 0.12 - 0.04); c.fill(); c.restore(); }
      c.beginPath(); c.arc(x, y, 7 * s, 0, Math.PI * 2); P.ballFill(c, x, y, 7 * s, '#6b3f1a', 0.15, -0.4);
      c.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(x + ((i * 7) % 9 - 4) * s, y + ((i * 5) % 9 - 4) * s, 0.8, 0, Math.PI * 2); c.fill(); }
    },
  });
  SC.type('stone', {
    z: 5,
    bb: o => ({ x: o.x + 1, y: o.y + 1, r: o.rx + 3 }),
    muts: [{ k: 'remove', d: 2, w: 0.9, apply: () => null }, { k: 'color', d: 3, w: 0.7, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2.5)) }) }],
    draw(c, o, X) {
      P.shadow(c, o.x + 2, o.y + 2, o.rx + 2, o.ry + 2, 0.4);
      P.ell(c, o.x, o.y, o.rx, o.ry); c.fillStyle = P.vgrad(c, o.y - o.ry, o.y + o.ry, o.c, 0.25, -0.25); c.fill();
      X.tex(c, 95, 0.4, 'overlay', 4);
    },
  });
  /** 장미 덤불: 장미 자리 (씨앗으로 · 덧셈만) */
  const roses = o => { const R = U.rng(o.seed); return Array.from({ length: o.n }, () => ({ x: o.x + (R() - 0.5) * o.r * 1.3, y: o.y - o.r * 0.3 + (R() - 0.5) * o.r * 0.9 })); };
  SC.type('bush', {
    z: 18,
    bb: o => ({ x: o.x, y: o.y - o.r * 0.3, r: o.r + 3 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: other(rnd, ROSE, o.c, lv) }) },
      { k: 'count', d: 3, w: 1, apply: (o, rnd) => ({ ...o, miss: rint(rnd, 0, o.n - 1) }), at: (o, nb) => { const p = roses(o)[nb.miss]; return { x: p.x, y: p.y, r: 9 }; } },
    ],
    draw(c, o, X) {
      const { x, y, r } = o;
      P.shadow(c, x + 3, y + 3, r * 1.1, r * 0.4, 0.4);
      const R = X.R(o.id * 3 + 1);
      for (let i = 0; i < 12; i++) { const a = R() * Math.PI, d = R() * r * 0.6, bx = x + Math.cos(a + Math.PI) * d * 1.2, by = y - Math.sin(a) * d * 0.9, rr = r * (0.38 + R() * 0.2); c.beginPath(); c.arc(bx, by, rr, 0, Math.PI * 2); P.ballFill(c, bx, by, rr, i % 2 ? '#2f6a2a' : '#3f7a32', 0.25, -0.4); }
      roses(o).forEach((p, i) => {
        if (i === o.miss) return;
        c.beginPath(); c.arc(p.x, p.y, 3.8, 0, Math.PI * 2); P.ballFill(c, p.x, p.y, 3.8, o.c, 0.3, -0.4);
        c.strokeStyle = P.rgba(P.lit(o.c, -0.45), 0.7); c.lineWidth = 0.7; c.beginPath(); c.arc(p.x + 0.4, p.y + 0.3, 1.8, 0.5, 5); c.stroke();
      });
    },
  });
  SC.type('tulip', {
    z: 20,
    bb: o => ({ x: o.x, y: o.y - (o.h + 9) / 2, r: (o.h + 9) / 2 + 4 }),
    muts: [
      { k: 'color', d: 2, w: 1.4, apply: (o, rnd, lv) => ({ ...o, c: lv < 2.5 ? other(rnd, TULIP, o.c, lv) : shift(rnd, o.c, lv) }), at: o => ({ x: o.x, y: o.y - o.h - 3, r: 10 }) },
      { k: 'remove', d: 1, w: 0.8, apply: () => null },
    ],
    draw(c, o) {
      const { x, y, h } = o;
      c.strokeStyle = '#3f7a2a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h + 4); c.stroke();
      c.fillStyle = '#4f8a32'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 9, y - 10, x - 3, y - 18); c.quadraticCurveTo(x - 2, y - 8, x, y); c.fill();
      if (o.leaf > 1) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 9, y - 9, x + 4, y - 16); c.quadraticCurveTo(x + 2, y - 7, x, y); c.fill(); }
      const ty = y - h;
      c.beginPath(); c.moveTo(x - 5.5, ty - 4); c.lineTo(x - 3, ty - 9); c.lineTo(x, ty - 5); c.lineTo(x + 3, ty - 9); c.lineTo(x + 5.5, ty - 4); c.quadraticCurveTo(x + 6, ty + 4, x, ty + 5); c.quadraticCurveTo(x - 6, ty + 4, x - 5.5, ty - 4); c.closePath();
      c.fillStyle = P.hgrad(c, x - 6, x + 6, o.c, 0.3, -0.35); c.fill();
      c.strokeStyle = P.rgba(P.lit(o.c, -0.4), 0.5); c.lineWidth = 0.6; c.beginPath(); c.moveTo(x, ty - 5); c.lineTo(x, ty + 4); c.stroke();
    },
  });
  SC.type('daisy', {
    z: 21,
    bb: o => ({ x: o.x, y: o.y - 8, r: o.r + 3 }),
    muts: [
      { k: 'count', d: 4, w: 1, apply: o => ({ ...o, n: o.n - 2 }) },
      { k: 'color', d: 3, w: 1, apply: o => ({ ...o, cc: o.cc === '#f2b81a' ? '#c86a2a' : '#f2b81a' }) },
      { k: 'remove', d: 2, w: 0.7, apply: () => null },
    ],
    draw(c, o) {
      const { x, r } = o, y = o.y - 8;
      c.strokeStyle = '#3f7a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, o.y + 4); c.lineTo(x, y); c.stroke();
      for (let i = 0; i < o.n; i++) { const a = i * 2 * Math.PI / o.n; c.save(); c.translate(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.45); c.rotate(a); P.ell(c, 0, 0, r * 0.5, r * 0.17); c.fillStyle = i % 2 ? '#fbfbf6' : '#eceae2'; c.fill(); c.restore(); }
      c.beginPath(); c.arc(x, y, r * 0.3, 0, Math.PI * 2); P.ballFill(c, x, y, r * 0.3, o.cc, 0.3, -0.3);
    },
  });
  SC.type('lady', {
    z: 40,
    bb: o => ({ x: o.x, y: o.y, r: 9 }),
    muts: [{ k: 'count', d: 4, w: 1, apply: o => ({ ...o, spots: o.spots - 3 }) }, { k: 'remove', d: 2, w: 0.8, apply: () => null }],
    draw(c, o) {
      c.translate(o.x, o.y); c.rotate(o.rot * Math.PI / 4);
      P.shadow(c, 1, 2, 5, 3, 0.4);
      c.beginPath(); c.arc(0, 0, 4.6, 0, Math.PI * 2); P.ballFill(c, 0, 0, 4.6, '#d9233a', 0.35, -0.35);
      c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(0, -4.4, 2.2, 0, Math.PI * 2); c.fill(); c.fillRect(-0.3, -3, 0.6, 7.4);
      const sp = [[-2.2, -1.5], [2.2, -1.5], [-2.4, 1.6], [2.4, 1.6], [0, 2.8], [-1, 0.2], [1.2, 0.4]];
      for (let i = 0; i < o.spots; i++) { c.beginPath(); c.arc(sp[i][0], sp[i][1], 0.85, 0, Math.PI * 2); c.fill(); }
    },
  });
  SC.type('bfly', {
    z: 42,
    bb: o => ({ x: o.x, y: o.y, r: 15 * o.s + 2 }),
    muts: [
      { k: 'color', d: 2, w: 1.2, apply: (o, rnd, lv) => ({ ...o, c1: shift(rnd, o.c1, lv) }) },
      { k: 'part', d: 3, w: 0.8, apply: o => ({ ...o, c2: o.c2 === '#2a2a2a' ? '#f4f1ea' : '#2a2a2a' }) },
      { k: 'remove', d: 1, w: 0.7, apply: () => null },
    ],
    draw(c, o) {
      c.translate(o.x, o.y); c.scale(o.s, o.s);
      for (const sx of [-1, 1]) {
        c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(sx * 10, -12, sx * 14, -4, sx * 9, 1); c.bezierCurveTo(sx * 12, 6, sx * 6, 11, 0, 2); c.closePath();
        c.fillStyle = P.hgrad(c, -12, 12, o.c1, 0.25, -0.2); c.fill();
        c.strokeStyle = o.c2; c.lineWidth = 1; c.stroke();
        c.fillStyle = o.c2; c.beginPath(); c.arc(sx * 8, -5, 1.4, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#2a2a2a'; P.ell(c, 0, 1, 1.2, 5); c.fill();
      c.strokeStyle = '#2a2a2a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0, -3); c.lineTo(-3, -8); c.moveTo(0, -3); c.lineTo(3, -8); c.stroke();
    },
  });
  SC.type('bee', {
    z: 43,
    bb: o => ({ x: o.x, y: o.y, r: 10 }),
    muts: [{ k: 'remove', d: 2, w: 1, apply: () => null }, { k: 'flip', d: 3, w: 0.6, apply: o => ({ ...o, dir: -o.dir }) }],
    draw(c, o) {
      c.translate(o.x, o.y); c.scale(o.dir, 1);
      c.fillStyle = 'rgba(230,245,255,.75)'; P.ell(c, -1, -4.5, 3.5, 2.4, -0.4); c.fill(); P.ell(c, 2, -4.5, 3.2, 2.2, 0.3); c.fill();
      P.ell(c, 0, 0, 5.5, 3.6); c.fillStyle = '#f2c12e'; c.fill();
      c.fillStyle = '#1a1a1a'; c.fillRect(-2.4, -3.4, 1.5, 6.8); c.fillRect(0.8, -3.4, 1.5, 6.8);
      c.beginPath(); c.arc(5.2, 0, 2, 0, Math.PI * 2); c.fill();
    },
  });
  SC.type('snail', {
    z: 30,
    bb: o => ({ x: o.x, y: o.y - 3, r: 11 }),
    muts: [{ k: 'color', d: 3, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2.5)) }) }, { k: 'flip', d: 2, w: 0.8, apply: o => ({ ...o, dir: -o.dir }) }],
    draw(c, o) {
      c.translate(o.x, o.y); c.scale(o.dir, 1);
      P.shadow(c, 1, 3, 10, 2.5, 0.35);
      c.fillStyle = '#c8b89a'; c.beginPath(); c.moveTo(-9, 2); c.quadraticCurveTo(0, -1, 9, 1); c.quadraticCurveTo(10, -4, 7, -5); c.lineTo(5, 2); c.fill();
      c.strokeStyle = '#c8b89a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(7, -4); c.lineTo(9, -9); c.moveTo(6, -4); c.lineTo(6, -9); c.stroke();
      c.beginPath(); c.arc(-1, -4, 6.4, 0, Math.PI * 2); P.ballFill(c, -1, -4, 6.4, o.c, 0.3, -0.35);
      c.strokeStyle = P.lit(o.c, -0.45); c.lineWidth = 0.9; c.beginPath(); for (let t = 0; t < 12; t += 0.3) { const rr = t * 0.48; c.lineTo(-1 + Math.cos(t) * rr, -4 + Math.sin(t) * rr); } c.stroke();
    },
  });
  SC.type('can', {
    z: 25,
    bb: o => ({ x: o.x, y: o.y - 9, r: 25 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) }, { k: 'flip', d: 2, w: 0.8, apply: o => ({ ...o, dir: -o.dir }) }],
    draw(c, o) {
      c.translate(o.x, o.y); c.scale(o.dir, 1);
      P.shadow(c, 2, 1, 16, 3.5, 0.45);
      c.strokeStyle = P.lit(o.c, -0.2); c.lineWidth = 2.4; c.beginPath(); c.moveTo(6, -6); c.lineTo(18, -18); c.stroke();
      c.fillStyle = P.lit(o.c, -0.25); c.beginPath(); c.ellipse(19, -19, 2.4, 3.4, -0.8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.lit(o.c, -0.1); c.lineWidth = 2; c.beginPath(); c.arc(-3, -15, 6, Math.PI, 0); c.stroke();
      c.fillStyle = P.hgrad(c, -11, 8, o.c, 0.3, -0.35); P.rr(c, -11, -14, 19, 14, 3); c.fill();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-9, -12, 3, 9);
    },
  });
  SC.type('gnome', {
    z: 26,
    bb: o => ({ x: o.x, y: o.y - 12, r: 17 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, hat: shift(rnd, o.hat, lv) }), at: o => ({ x: o.x, y: o.y - 24, r: 9 }) }, { k: 'color', d: 3, w: 0.8, apply: (o, rnd, lv) => ({ ...o, coat: shift(rnd, o.coat, Math.max(lv, 2)) }), at: o => ({ x: o.x, y: o.y - 5, r: 10 }) }, { k: 'remove', d: 1, w: 0.6, apply: () => null }],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 2, y + 1, 10, 3, 0.45);
      c.fillStyle = P.hgrad(c, x - 7, x + 7, o.coat, 0.3, -0.3); c.beginPath(); c.moveTo(x - 7, y); c.quadraticCurveTo(x - 8, y - 10, x, y - 13); c.quadraticCurveTo(x + 8, y - 10, x + 7, y); c.closePath(); c.fill();
      c.fillStyle = '#f4f1ea'; c.beginPath(); c.moveTo(x - 4.5, y - 14); c.quadraticCurveTo(x, y - 2, x + 4.5, y - 14); c.fill();
      c.fillStyle = '#f2c4a0'; c.beginPath(); c.arc(x, y - 15.5, 3.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.hgrad(c, x - 5, x + 5, o.hat, 0.3, -0.3); c.beginPath(); c.moveTo(x - 5, y - 17); c.quadraticCurveTo(x - 1, y - 24, x + 3, y - 32); c.quadraticCurveTo(x + 3, y - 22, x + 5, y - 17); c.closePath(); c.fill();
    },
  });
  SC.type('mush', {
    z: 24,
    bb: o => ({ x: o.x, y: o.y - 6, r: 10 }),
    muts: [{ k: 'part', d: 3, w: 1, apply: o => ({ ...o, dots: 0 }) }, { k: 'color', d: 2, w: 0.8, apply: o => ({ ...o, c: o.c === '#d9233a' ? '#c98a4e' : '#d9233a' }) }],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 2, y + 1, 8, 2.5, 0.4);
      c.fillStyle = '#f4ecd8'; c.fillRect(x - 2.2, y - 7, 4.4, 7);
      c.beginPath(); c.moveTo(x - 8, y - 6); c.quadraticCurveTo(x, y - 18, x + 8, y - 6); c.closePath(); c.fillStyle = P.hgrad(c, x - 8, x + 8, o.c, 0.3, -0.3); c.fill();
      if (o.dots) { c.fillStyle = '#fbf6ea'; for (const [dx, dy] of [[-3.5, -9], [2.5, -11], [4.5, -7.5], [-1, -6.8]]) { c.beginPath(); c.arc(x + dx, y + dy, 1.1, 0, Math.PI * 2); c.fill(); } }
    },
  });
});
