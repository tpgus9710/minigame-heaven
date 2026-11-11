/* 🚗 주차장 (위에서 본 모습) — 아스팔트 · 주차 칸 번호 · 자동차 · 화살표 · 라바콘 · 카트 · 사람 · 나무 (spot-core.js 장면) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other, charX, digitSwap } = U;
  const PAINT = ['#d9342b', '#f4f4f2', '#1f2329', '#9aa3ad', '#2f6fd1', '#1f4a8a', '#3a7a4a', '#f2c12e', '#7a2f3a', '#e8e0d0', '#5a6068', '#f08a2a'];
  const SW = 48, TOP = [16, 112], BOT = [188, 284];
  const sh = (c, X, blur = 6, ox = 3, oy = 4, a = 0.5) => { c.shadowColor = `rgba(0,0,0,${a})`; c.shadowBlur = blur * X.Q; c.shadowOffsetX = ox * X.Q; c.shadowOffsetY = oy * X.Q; };
  const nosh = c => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };

  SC.scene('parking', {
    name: '🚗 주차장',
    tone: () => '#cfe0ff',
    build(rnd, lv) {
      const objs = [], letter = pick(rnd, ['A', 'B', 'C', 'D']), base = rint(rnd, 1, 4) * 10;
      const n = 8, x0 = (400 - n * SW) / 2;
      for (const [row, [y0, y1]] of [[0, TOP], [1, BOT]]) {
        for (let i = 0; i < n; i++) {
          const cx = n1(x0 + (i + 0.5) * SW), cy = (y0 + y1) / 2, label = `${letter}${base + row * 10 + i + 1}`;
          objs.push({ t: 'num', x: cx, y: row ? y0 - 8 : y1 + 8, s: label });
          if (rnd() < 0.82 - (lv > 3 ? -0.1 : 0)) {
            objs.push({ t: 'car', x: n1(cx + (rnd() - 0.5) * 4), y: n1(cy + (rnd() - 0.5) * 6), dir: (row ? 1 : -1) * (rnd() < 0.85 ? 1 : -1), c: pick(rnd, PAINT), l: rint(rnd, 70, 78), w: rint(rnd, 33, 37),
              roof: pick(rnd, ['plain', 'plain', 'sun', 'rack']), stripe: rnd() < 0.15 ? 1 : 0, mir: 1 });
          }
        }
      }
      for (let i = 0; i < 2; i++) objs.push({ t: 'arrow', x: n1(100 + i * 200), y: 150, dir: i ? 1 : -1 });
      const spots = U.shuffle(rnd, [30, 75, 120, 165, 210, 255, 300, 345, 380]);                // 길 위 물건은 서로 안 겹치게 자리부터
      const lane = () => ({ x: n1(spots.pop() + (rnd() - 0.5) * 14), y: rint(rnd, 134, 166) });
      if (rnd() < 0.8) objs.push({ t: 'cone', ...lane(), c: pick(rnd, ['#f26a1a', '#f2c12e']) });
      if (rnd() < 0.7) objs.push({ t: 'cone', ...lane(), c: '#f26a1a' });
      if (rnd() < 0.7) objs.push({ t: 'cart', ...lane(), rot: pick(rnd, [-1, 1]) });
      for (let k = rint(rnd, 1, 2); k > 0; k--) objs.push({ t: 'man', ...lane(), c: pick(rnd, ['#d9342b', '#2f6fd1', '#3a9a4a', '#f2c12e', '#8a4fd1']), h: pick(rnd, ['#2a1f1a', '#5a3a1e', '#d9b45a']) });
      objs.push({ t: 'hole', ...lane() });
      for (let k = 0; k < 4; k++) objs.push({ t: 'tree', x: n1(30 + k * 113 + rnd() * 20), y: k % 2 ? 296 : 4, r: rint(rnd, 16, 20) });
      return { bg: { seed: rint(rnd, 1, 9999), line: pick(rnd, ['#f2f2ee', '#f2d24a']) }, objs };
    },
    adds: [{ zone: [30, 370, 132, 168], r: 12, d: 2, make: (rnd, x, y) => ({ t: 'cone', x, y, c: '#f26a1a' }) }],
    back(c, bg, X) {
      c.fillStyle = '#4a4d52'; c.fillRect(0, 0, 400, 300);
      c.beginPath(); c.rect(0, 0, 400, 300); X.tex(c, 81, 0.5, 'overlay', 3); X.tex(c, 82, 0.3, 'multiply', 30);
      const R = U.rng(bg.seed);
      for (let i = 0; i < 8; i++) { c.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.12})`; P.ell(c, R() * 400, 20 + R() * 260, 6 + R() * 14, 4 + R() * 8, R() * 3); c.fill(); }
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { let x = R() * 400, y = R() * 300; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (R() - 0.5) * 20; y += (R() - 0.5) * 20; c.lineTo(x, y); } c.stroke(); }
      c.fillStyle = '#5a8a3a'; c.fillRect(0, 0, 400, 10); c.fillRect(0, 290, 400, 10);
      c.beginPath(); c.rect(0, 0, 400, 10); c.rect(0, 290, 400, 10); X.tex(c, 83, 0.5, 'overlay', 3);
      c.fillStyle = '#b8b4aa'; c.fillRect(0, 10, 400, 4); c.fillRect(0, 286, 400, 4);
      // 주차 칸 선
      c.fillStyle = bg.line; c.globalAlpha = 0.85;
      const x0 = (400 - 8 * SW) / 2;
      for (const [y0, y1] of [TOP, BOT]) for (let i = 0; i <= 8; i++) c.fillRect(x0 + i * SW - 1.2, y0, 2.4, y1 - y0);
      c.fillRect(x0, TOP[1] - 1.2, 8 * SW, 2.4); c.fillRect(x0, BOT[0] - 1.2, 8 * SW, 2.4);
      c.globalAlpha = 0.55; for (let x = 0; x < 400; x += 26) c.fillRect(x, 149, 14, 2);
      c.globalAlpha = 1;
      c.beginPath(); c.rect(0, 14, 400, 272); X.tex(c, 84, 0.25, 'multiply', 2.5);
    },
  });
  SC.type('num', {
    z: 5,
    bb: o => ({ x: o.x, y: o.y, r: 12 }),
    muts: [{ k: 'text', d: 3, w: 1, apply(o, rnd) { const [s, i] = digitSwap(rnd, o.s); return i < 0 ? undefined : { ...o, s, di: i }; }, at: (o, nb) => ({ x: charX(nb.s, nb.di, 10.5, o.x), y: o.y, r: 9 }) }],
    draw(c, o) { c.globalAlpha = 0.9; P.mono(c, o.s, o.x, o.y, 10.5, '#f4f4f0', 900); },
  });
  SC.type('car', {
    z: 20,
    bb: o => ({ x: o.x + 1.5, y: o.y + 2, r: o.l / 2 + 7 }),
    cover: (o, x, y) => Math.abs(x - o.x) < o.w / 2 && Math.abs(y - o.y) < o.l / 2,
    muts: [
      { k: 'color', d: 2, w: 2, apply: (o, rnd, lv) => ({ ...o, c: lv < 2.5 ? other(rnd, PAINT, o.c, lv) : shift(rnd, o.c, lv) }) },
      { k: 'remove', d: 1, w: 0.9, apply: () => null },
      { k: 'flip', d: 2, w: 0.7, apply: o => ({ ...o, dir: -o.dir }) },
      { k: 'part', d: 3, w: 0.8, ok: o => o.roof !== 'rack', apply: o => ({ ...o, roof: o.roof === 'sun' ? 'plain' : 'sun' }), at: o => ({ x: o.x, y: o.y + o.dir * o.l * 0.045, r: 13 }) },
      { k: 'part', d: 3, w: 0.6, ok: o => o.roof !== 'sun', apply: o => ({ ...o, roof: o.roof === 'rack' ? 'plain' : 'rack' }), at: o => ({ x: o.x, y: o.y + o.dir * o.l * 0.045, r: (o.w - 8) / 2 + 3 }) },
      { k: 'stripe', d: 3, w: 0.7, apply: o => ({ ...o, stripe: o.stripe ? 0 : 1 }) },
      { k: 'part', d: 4, w: 0.5, apply: o => ({ ...o, mir: 0 }), at: o => ({ x: o.x - o.dir * (o.w / 2 + 1.5), y: o.y - o.dir * o.l * 0.16, r: 9 }) },
    ],
    draw(c, o, X) {
      const { w, l } = o;
      c.translate(o.x, o.y); if (o.dir < 0) c.rotate(Math.PI);
      // 앞이 위(-y) 쪽
      sh(c, X); P.rr(c, -w / 2, -l / 2, w, l, 8); c.fillStyle = o.c; c.fill(); nosh(c);
      P.rr(c, -w / 2, -l / 2, w, l, 8); c.fillStyle = P.hgrad(c, -w / 2, w / 2, o.c, 0.28, -0.42); c.fill();
      if (o.mir) { c.fillStyle = P.lit(o.c, -0.2); P.ell(c, -w / 2 - 1.5, -l * 0.16, 2.6, 1.8); c.fill(); }
      c.fillStyle = P.lit(o.c, -0.2); P.ell(c, w / 2 + 1.5, -l * 0.16, 2.6, 1.8); c.fill();
      if (o.stripe) { const [r, g, b] = U.hexRgb(o.c); c.fillStyle = (0.3 * r + 0.59 * g + 0.11 * b) / 255 > 0.55 ? 'rgba(31,35,41,.85)' : 'rgba(244,244,242,.85)'; c.fillRect(-4, -l / 2 + 2, 2.6, l - 4); c.fillRect(1.4, -l / 2 + 2, 2.6, l - 4); }
      const glass = c.createLinearGradient(0, -l * 0.3, 0, l * 0.3); glass.addColorStop(0, '#1d2633'); glass.addColorStop(1, '#3a4a5c');
      c.fillStyle = glass;
      c.beginPath(); c.moveTo(-w / 2 + 4, -l * 0.2); c.quadraticCurveTo(0, -l * 0.3, w / 2 - 4, -l * 0.2); c.lineTo(w / 2 - 5, -l * 0.06); c.lineTo(-w / 2 + 5, -l * 0.06); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-w / 2 + 5, l * 0.24); c.lineTo(w / 2 - 5, l * 0.24); c.quadraticCurveTo(0, l * 0.32, -w / 2 + 5, l * 0.24); c.lineTo(-w / 2 + 6, l * 0.16); c.lineTo(w / 2 - 6, l * 0.16); c.lineTo(w / 2 - 5, l * 0.24); c.fill();
      c.fillStyle = 'rgba(30,38,50,.85)'; c.fillRect(-w / 2 + 1.5, -l * 0.05, 2.5, l * 0.22); c.fillRect(w / 2 - 4, -l * 0.05, 2.5, l * 0.22);
      P.rr(c, -w / 2 + 5, -l * 0.06, w - 10, l * 0.22, 3); c.fillStyle = P.hgrad(c, -w / 2, w / 2, o.c, 0.35, -0.3); c.fill();
      if (o.roof === 'sun') { P.rr(c, -w / 2 + 9, -l * 0.02, w - 18, l * 0.13, 2); c.fillStyle = '#1a222c'; c.fill(); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(-w / 2 + 10, -l * 0.015, (w - 20) * 0.5, 1.2); }
      if (o.roof === 'rack') { c.fillStyle = '#2a2d33'; c.fillRect(-w / 2 + 4, -l * 0.03, w - 8, 2.4); c.fillRect(-w / 2 + 4, l * 0.1, w - 8, 2.4); }
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(-w / 2 + 6, -l * 0.19); c.lineTo(-w / 2 + 12, -l * 0.21); c.lineTo(-w / 2 + 8, -l * 0.08); c.fill();
      c.fillStyle = '#fff6d8'; P.ell(c, -w / 2 + 5, -l / 2 + 3, 3.4, 2); c.fill(); P.ell(c, w / 2 - 5, -l / 2 + 3, 3.4, 2); c.fill();
      c.fillStyle = '#c4202a'; c.fillRect(-w / 2 + 2, l / 2 - 3, 7, 2.4); c.fillRect(w / 2 - 9, l / 2 - 3, 7, 2.4);
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-w / 2 + 4, -l * 0.33); c.quadraticCurveTo(0, -l * 0.36, w / 2 - 4, -l * 0.33); c.stroke();
    },
  });
  SC.type('arrow', {
    z: 6,
    bb: o => ({ x: o.x, y: o.y, r: 22 }),
    muts: [{ k: 'flip', d: 2, w: 1, apply: o => ({ ...o, dir: -o.dir }) }],
    draw(c, o) {
      c.translate(o.x, o.y); c.scale(o.dir, 1); c.globalAlpha = 0.8; c.fillStyle = '#f2f2ee';
      c.beginPath(); c.moveTo(-18, -3); c.lineTo(6, -3); c.lineTo(6, -9); c.lineTo(18, 0); c.lineTo(6, 9); c.lineTo(6, 3); c.lineTo(-18, 3); c.closePath(); c.fill();
    },
  });
  SC.type('cone', {
    z: 25,
    bb: o => ({ x: o.x + 1, y: o.y + 1, r: 12 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: o => ({ ...o, c: o.c === '#f26a1a' ? '#3a8ad8' : '#f26a1a' }) }, { k: 'remove', d: 1, w: 0.8, apply: () => null }],
    draw(c, o, X) {
      sh(c, X, 4, 2, 3, 0.5); c.fillStyle = '#2a2a2a'; c.fillRect(o.x - 8, o.y - 8, 16, 16); nosh(c);
      c.beginPath(); c.arc(o.x, o.y, 6.5, 0, Math.PI * 2); P.ballFill(c, o.x, o.y, 6.5, o.c, 0.3, -0.3);
      c.strokeStyle = '#f4f4f0'; c.lineWidth = 1.6; c.beginPath(); c.arc(o.x, o.y, 4, 0, Math.PI * 2); c.stroke();
      c.fillStyle = P.lit(o.c, 0.3); c.beginPath(); c.arc(o.x, o.y, 1.6, 0, Math.PI * 2); c.fill();
    },
  });
  SC.type('cart', {
    z: 24,
    bb: o => ({ x: o.x, y: o.y, r: 19 }),
    muts: [{ k: 'remove', d: 2, w: 1, apply: () => null }, { k: 'flip', d: 3, w: 0.6, apply: o => ({ ...o, rot: -o.rot }) }],
    draw(c, o, X) {
      c.translate(o.x, o.y); c.rotate(o.rot * 0.35);
      sh(c, X, 3, 2, 3, 0.45);
      c.strokeStyle = '#b8bcc4'; c.lineWidth = 1.4; P.rr(c, -9, -13, 18, 22, 2); c.stroke();
      nosh(c);
      c.lineWidth = 0.6; for (let i = -6; i <= 6; i += 3) { c.beginPath(); c.moveTo(i, -13); c.lineTo(i, 9); c.stroke(); }
      c.fillStyle = '#d9342b'; c.fillRect(-8, 10, 16, 3);
    },
  });
  SC.type('man', {
    z: 30,
    bb: o => ({ x: o.x + 1, y: o.y + 1, r: 11 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) }, { k: 'remove', d: 1, w: 0.7, apply: () => null }],
    draw(c, o, X) {
      sh(c, X, 3, 2, 3, 0.5); P.ell(c, o.x, o.y, 8, 4.6); c.fillStyle = o.c; c.fill(); nosh(c);
      P.ell(c, o.x, o.y, 8, 4.6); c.fillStyle = P.vgrad(c, o.y - 5, o.y + 5, o.c, 0.3, -0.3); c.fill();
      c.beginPath(); c.arc(o.x, o.y, 3.6, 0, Math.PI * 2); P.ballFill(c, o.x, o.y, 3.6, o.h, 0.3, -0.3);
    },
  });
  SC.type('hole', {
    z: 4,
    bb: o => ({ x: o.x, y: o.y, r: 10 }),
    muts: [{ k: 'remove', d: 3, w: 1, apply: () => null }],
    draw(c, o) {
      c.beginPath(); c.arc(o.x, o.y, 8, 0, Math.PI * 2); c.fillStyle = '#3a3c40'; c.fill();
      c.strokeStyle = '#2a2c30'; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.6; for (let i = -6; i <= 6; i += 3) { c.beginPath(); c.moveTo(o.x - 6, o.y + i); c.lineTo(o.x + 6, o.y + i); c.stroke(); }
    },
  });
  SC.type('tree', {
    z: 40,
    bb: o => ({ x: o.x + 2, y: o.y + 2, r: o.r + 5 }),
    muts: [{ k: 'size', d: 3, w: 0.8, apply: o => ({ ...o, r: o.r - 5 }) }, { k: 'remove', d: 2, w: 0.6, apply: () => null }],
    draw(c, o, X) {
      sh(c, X, 6, 3, 4, 0.5); c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fillStyle = '#2f5a2a'; c.fill(); nosh(c);
      const R = X.R(o.id % 7);
      for (let i = 0; i < 9; i++) { const a = R() * Math.PI * 2, d = R() * o.r * 0.6, rr = o.r * (0.35 + R() * 0.25); c.beginPath(); c.arc(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, rr, 0, Math.PI * 2); P.ballFill(c, o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, rr, i % 2 ? '#3f7a32' : '#4a8a3a', 0.25, -0.35); }
    },
  });
});
