/* 🚀 우주 — 성운 · 별 · 행성(줄무늬 · 고리) · 위성 · 우주인 · 인공위성 · 로켓 · 소행성 · 혜성 (spot-core.js 장면)
 *  돌린 각도는 15° 단위 번호(0~23) — 정답 자리는 cos · sin 표로만 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other } = U;
  const CS = [1, 0.965926, 0.866025, 0.707107, 0.5, 0.258819, 0, -0.258819, -0.5, -0.707107, -0.866025, -0.965926, -1, -0.965926, -0.866025, -0.707107, -0.5, -0.258819, 0, 0.258819, 0.5, 0.707107, 0.866025, 0.965926];
  const SN = i => CS[(i + 18) % 24];
  const along = (o, d) => ({ x: o.x + CS[o.rot] * d, y: o.y + SN(o.rot) * d });
  const rad = k => k * Math.PI / 12;
  const PLANET = [['#d98a4a', '#f2c38a'], ['#4a8ad8', '#a8d8ff'], ['#c9a06a', '#f2e0b8'], ['#8a4fd1', '#d8b8ff'], ['#3aa88a', '#b8f0d8'], ['#d94a4a', '#ffb8a0']];

  SC.scene('space', {
    name: '🚀 우주',
    tone: () => '#b8a8ff',
    build(rnd, lv) {
      const objs = [], placed = [];
      const fits = (x, y, r) => placed.every(p => { const dx = p.x - x, dy = p.y - y, m = p.r + r + 2; return dx * dx + dy * dy > m * m; });
      const put = (r, make, x0 = r + 4, x1 = 396 - r, y0 = r + 4, y1 = 296 - r, tries = 40) => { for (let t = 0; t < tries; t++) { const x = n1(x0 + rnd() * (x1 - x0)), y = n1(y0 + rnd() * (y1 - y0)); if (fits(x, y, r)) { placed.push({ x, y, r }); objs.push(make(x, y)); return; } } };
      const big = rint(rnd, 38, 46), [a1, a2] = pick(rnd, PLANET);
      put(big * 1.9, (x, y) => ({ t: 'planet', x, y, r: big, c1: a1, c2: a2, bands: rint(rnd, 3, 4), bc: -1, ring: rnd() < 0.6 ? 1 : 0, rc: pick(rnd, ['#e8d8b8', '#c8d8f0', '#f0c8a8']) }), 60, 340, 70, 230);
      for (let k = rint(rnd, 1, 2); k > 0; k--) { const r = rint(rnd, 16, 24), [b1, b2] = pick(rnd, PLANET); put(r + 4, (x, y) => ({ t: 'planet', x, y, r, c1: b1, c2: b2, bands: rint(rnd, 0, 3), bc: -1, ring: rnd() < 0.3 ? 1 : 0, rc: '#e8d8b8' })); }
      for (let k = rint(rnd, 2, 3); k > 0; k--) put(14, (x, y) => ({ t: 'moonp', x, y, r: rint(rnd, 8, 12), cr: rint(rnd, 3, 5), seed: rint(rnd, 1, 9999), c: pick(rnd, ['#b8b4aa', '#c8bca8', '#a8a8b0']) }));
      if (rnd() < 0.85) put(22, (x, y) => ({ t: 'astro', x, y, rot: rint(rnd, 0, 23), vc: pick(rnd, ['#e8b84a', '#4aa8e8', '#e86a4a']), pc: pick(rnd, ['#d8dce2', '#e86a4a', '#4a8ad8']), flag: 1 }));
      if (rnd() < 0.85) put(30, (x, y) => ({ t: 'sat', x, y, rot: rint(rnd, 0, 23), pc: pick(rnd, ['#2a5ab8', '#2a8ab8', '#5a3ab8']), ant: 1 }));
      if (rnd() < 0.8) put(30, (x, y) => ({ t: 'ship', x, y, rot: rint(rnd, 0, 23), c: pick(rnd, ['#e8e4dc', '#d9342b', '#f2c12e']), win: rint(rnd, 2, 3), fl: 1 }));
      for (let k = rint(rnd, 3, 5) + (lv > 3 ? 2 : 0); k > 0; k--) put(12, (x, y) => ({ t: 'rock', x, y, r: rint(rnd, 6, 10), seed: rint(rnd, 1, 9999), cr: rint(rnd, 2, 3) }));
      if (rnd() < 0.6) put(26, (x, y) => ({ t: 'comet', x, y, dir: rnd() < 0.5 ? 1 : -1 }));
      for (let k = rint(rnd, 6, 9); k > 0; k--) put(7, (x, y) => ({ t: 'sstar', x, y, s: n1(1.2 + rnd() * 1.2), c: pick(rnd, ['#ffffff', '#cfe0ff', '#ffe6b8', '#ffd0d0']) }));
      return { bg: { seed: rint(rnd, 1, 9999), neb: pick(rnd, [['#ff4da6', '#4a6bff'], ['#3ad8c8', '#8a4fd1'], ['#ff8a3d', '#d84a8a'], ['#4ad87a', '#2a5ab8']]) }, objs };
    },
    adds: [
      { zone: [20, 380, 20, 280], r: 7, d: 3, make: (rnd, x, y) => ({ t: 'sstar', x, y, s: 1.8, c: '#ffffff' }) },
      { zone: [20, 380, 20, 280], r: 12, d: 2, make: (rnd, x, y) => ({ t: 'rock', x, y, r: 8, seed: rint(rnd, 1, 9999), cr: 2 }) },
    ],
    back(c, bg, X) {
      const g = c.createLinearGradient(0, 0, 400, 300); g.addColorStop(0, '#05060f'); g.addColorStop(1, '#0d1030');
      c.fillStyle = g; c.fillRect(0, 0, 400, 300);
      c.save(); c.globalCompositeOperation = 'screen';                                 // 성운
      const R = U.rng(bg.seed);
      for (let i = 0; i < 2; i++) {
        const cx = R() * 400, cy = R() * 300, rr = 140 + R() * 120, ng = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
        ng.addColorStop(0, P.rgba(bg.neb[i], 0.35)); ng.addColorStop(1, P.rgba(bg.neb[i], 0));
        c.fillStyle = ng; c.fillRect(0, 0, 400, 300);
      }
      c.restore();
      c.beginPath(); c.rect(0, 0, 400, 300); X.tex(c, 101, 0.35, 'multiply', 50); X.tex(c, 102, 0.12, 'screen', 14);
      for (let i = 0; i < 320; i++) { const a = R(); c.fillStyle = `rgba(255,255,255,${0.15 + a * 0.6})`; const s = a > 0.97 ? 1.4 : 0.8; c.fillRect(R() * 400, R() * 300, s, s); }
    },
  });
  SC.type('planet', {
    z: 10,
    bb: o => ({ x: o.x, y: o.y, r: o.r * (o.ring ? 1.9 : 1) + 3 }),
    cover: (o, x, y) => (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) < (o.r - 2) * (o.r - 2),
    muts: [
      { k: 'part', d: 2, w: 1, ok: o => o.r <= 25, apply: o => ({ ...o, ring: o.ring ? 0 : 1 }) },
      { k: 'color', d: 3, w: 1.2, ok: o => o.bands >= 2 && o.r >= 20, apply: (o, rnd) => ({ ...o, bc: rint(rnd, 0, o.bands - 1) }), at(o, nb) { const off = band(o, nb.bc); return { x: o.x, y: o.y + off.y, r: Math.min(46, Math.sqrt(Math.max(9, o.r * o.r - off.y * off.y)) + 2) }; } },
      { k: 'color', d: 2, w: 1, ok: o => o.r <= 24 && !o.ring, apply: (o, rnd, lv) => ({ ...o, c1: shift(rnd, o.c1, lv) }) },
    ],
    draw(c, o) {
      const { x, y, r } = o;
      if (o.ring) { c.save(); c.translate(x, y); c.rotate(-0.35); c.strokeStyle = P.rgba(o.rc, 0.6); c.lineWidth = r * 0.16; P.ell(c, 0, 0, r * 1.75, r * 0.42); c.save(); c.beginPath(); c.rect(-r * 2, -r, r * 4, r); c.clip(); P.ell(c, 0, 0, r * 1.75, r * 0.42); c.stroke(); c.restore(); c.restore(); }
      const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r * 1.05); g.addColorStop(0, P.lit(o.c2, 0.2)); g.addColorStop(0.5, o.c1); g.addColorStop(1, P.lit(o.c1, -0.65));
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
      c.save(); c.clip();
      for (let i = 0; i < o.bands; i++) { const b = band(o, i); c.fillStyle = i === o.bc ? P.rgba(P.lit(o.c1, -0.6), 0.75) : P.rgba(o.c2, 0.32); c.fillRect(x - r, y + b.y - b.h / 2, 2 * r, b.h); }
      const sh = c.createRadialGradient(x - r * 0.5, y - r * 0.5, r * 0.3, x, y, r * 1.15); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = sh; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.restore();
      if (o.ring) { c.save(); c.translate(x, y); c.rotate(-0.35); c.strokeStyle = P.rgba(o.rc, 0.75); c.lineWidth = r * 0.16; c.beginPath(); c.rect(-r * 2, 0, r * 4, r); c.clip(); P.ell(c, 0, 0, r * 1.75, r * 0.42); c.stroke(); c.restore(); }
    },
  });
  /** i번째 줄무늬 자리 (가운데에서 y 만큼 · 두께 h) */
  function band(o, i) { const step = (o.r * 1.6) / Math.max(1, o.bands); return { y: -o.r * 0.8 + step * (i + 0.5), h: step * 0.6 }; }
  SC.type('moonp', {
    z: 12,
    bb: o => ({ x: o.x, y: o.y, r: o.r + 3 }),
    muts: [{ k: 'count', d: 4, w: 1, apply: o => ({ ...o, cr: o.cr - 2 }) }, { k: 'remove', d: 1, w: 0.7, apply: () => null }, { k: 'size', d: 3, w: 0.7, apply: o => ({ ...o, r: o.r + 4 }) }],
    draw(c, o) {
      c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); P.ballFill(c, o.x, o.y, o.r, o.c, 0.3, -0.7);
      const R = U.rng(o.seed);
      for (let i = 0; i < o.cr; i++) { const a = R() * Math.PI * 2, d = R() * o.r * 0.55, cr = o.r * (0.16 + R() * 0.14); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.arc(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, cr, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.6; c.beginPath(); c.arc(o.x + Math.cos(a) * d + 0.5, o.y + Math.sin(a) * d + 0.5, cr, Math.PI, Math.PI * 1.6); c.stroke(); }
    },
  });
  SC.type('astro', {
    z: 30,
    bb: o => ({ x: o.x, y: o.y, r: 21 }),
    muts: [
      { k: 'color', d: 2, w: 1.2, apply: (o, rnd, lv) => ({ ...o, vc: other(rnd, ['#e8b84a', '#4aa8e8', '#e86a4a', '#5ad87a', '#c86ad8'], o.vc, lv) }), at: o => ({ ...along(o, 8), r: 10 }) },
      { k: 'color', d: 3, w: 0.9, apply: (o, rnd, lv) => ({ ...o, pc: shift(rnd, o.pc, Math.max(lv, 2.5)) }) },
      { k: 'remove', d: 1, w: 0.6, apply: () => null },
    ],
    draw(c, o) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot) + Math.PI / 2);
      c.fillStyle = P.vgrad(c, -10, 10, o.pc, 0.2, -0.3); P.rr(c, -9, -6, 18, 15, 3); c.fill();
      c.fillStyle = '#eef0f4'; P.rr(c, -7, -4, 14, 16, 5); c.fill();
      c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-7, 6, 14, 2);
      c.strokeStyle = '#e4e6ea'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-12, 6); c.moveTo(6, 0); c.lineTo(12, -4); c.moveTo(-3, 11); c.lineTo(-4, 18); c.moveTo(3, 11); c.lineTo(5, 17); c.stroke();
      c.beginPath(); c.arc(0, -8, 7, 0, Math.PI * 2); P.ballFill(c, 0, -8, 7, '#f4f6fa', 0.3, -0.25);
      c.beginPath(); c.ellipse(0.5, -8, 5, 3.8, 0, 0, Math.PI * 2); const g = c.createLinearGradient(-4, -12, 4, -4); g.addColorStop(0, P.lit(o.vc, 0.5)); g.addColorStop(1, P.lit(o.vc, -0.4)); c.fillStyle = g; c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; P.ell(c, -1.5, -9.5, 1.6, 0.8, -0.5); c.fill();
    },
  });
  SC.type('sat', {
    z: 28,
    bb: o => ({ x: o.x, y: o.y, r: 28 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, pc: shift(rnd, o.pc, Math.max(lv, 2)) }) },
      { k: 'part', d: 3, w: 0.9, apply: o => ({ ...o, ant: 0 }), at: o => ({ ...along({ ...o, rot: (o.rot + 6) % 24 }, -12.5), r: 10 }) },
    ],
    draw(c, o) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      c.strokeStyle = '#9aa0a8'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-26, 0); c.lineTo(26, 0); c.stroke();
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -26 : 9;
        c.fillStyle = P.vgrad(c, -6, 6, o.pc, 0.25, -0.3); c.fillRect(x0, -6, 17, 12);
        c.strokeStyle = 'rgba(200,220,255,.45)'; c.lineWidth = 0.5;
        for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x0 + k * 4.25, -6); c.lineTo(x0 + k * 4.25, 6); c.stroke(); }
        c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 17, 0); c.stroke();
      }
      c.fillStyle = P.hgrad(c, -7, 7, '#d9b45a', 0.35, -0.35); c.fillRect(-7, -7, 14, 14);
      c.fillStyle = 'rgba(0,0,0,.2)'; for (let k = -5; k < 6; k += 3) c.fillRect(-7, k, 14, 0.6);
      if (o.ant) { c.strokeStyle = '#c8ccd2'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -7); c.lineTo(0, -13); c.stroke(); c.fillStyle = '#e8eaee'; c.beginPath(); c.arc(0, -15, 3.4, Math.PI * 0.1, Math.PI * 0.9, true); c.fill(); }
    },
  });
  SC.type('ship', {
    z: 29,
    bb: o => ({ x: o.x, y: o.y, r: 27 }),
    muts: [
      { k: 'count', d: 3, w: 1, apply: o => ({ ...o, win: o.win === 3 ? 2 : 3 }), at: o => ({ ...along(o, 4), r: 11 }) },
      { k: 'part', d: 2, w: 1, apply: o => ({ ...o, fl: 0 }), at: o => ({ ...along(o, -22), r: 10 }) },
      { k: 'color', d: 2, w: 0.9, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2)) }) },
    ],
    draw(c, o) {
      c.translate(o.x, o.y); c.rotate(rad(o.rot));
      // 앞이 +x 쪽
      if (o.fl) { const g = c.createLinearGradient(-26, 0, -14, 0); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, '#ffd56a'); c.fillStyle = g; c.beginPath(); c.moveTo(-14, -4); c.quadraticCurveTo(-24, 0, -14, 4); c.lineTo(-27, 0); c.closePath(); c.fill(); c.fillStyle = '#fff6d8'; c.beginPath(); c.moveTo(-14, -2); c.lineTo(-19, 0); c.lineTo(-14, 2); c.fill(); }
      c.fillStyle = '#d9342b'; c.beginPath(); c.moveTo(-12, -6); c.lineTo(-17, -12); c.lineTo(-7, -6); c.fill(); c.beginPath(); c.moveTo(-12, 6); c.lineTo(-17, 12); c.lineTo(-7, 6); c.fill();
      c.beginPath(); c.moveTo(-14, -6); c.lineTo(10, -6); c.quadraticCurveTo(22, -4, 24, 0); c.quadraticCurveTo(22, 4, 10, 6); c.lineTo(-14, 6); c.closePath();
      c.fillStyle = P.vgrad(c, -6, 6, o.c, 0.35, -0.35); c.fill();
      c.fillStyle = o.c === '#d9342b' ? '#e8e4dc' : '#d9342b'; c.beginPath(); c.moveTo(14, -5.2); c.quadraticCurveTo(22, -4, 24, 0); c.quadraticCurveTo(22, 4, 14, 5.2); c.closePath(); c.fill();
      const wx = o.win === 3 ? [-6, 1, 8] : [-3, 5];
      for (const x of wx) { c.beginPath(); c.arc(x, 0, 2.4, 0, Math.PI * 2); c.fillStyle = '#5ab8ff'; c.fill(); c.strokeStyle = '#8a8f98'; c.lineWidth = 0.8; c.stroke(); }
    },
  });
  SC.type('rock', {
    z: 20,
    bb: o => ({ x: o.x, y: o.y, r: o.r * 1.2 + 2 }),
    muts: [{ k: 'remove', d: 2, w: 1, apply: () => null }, { k: 'size', d: 3, w: 0.8, apply: o => ({ ...o, r: o.r + 4 }) }, { k: 'count', d: 4, w: 0.6, apply: o => ({ ...o, cr: 0 }) }],
    draw(c, o) {
      const R = U.rng(o.seed);
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = o.r * (0.8 + R() * 0.35); c.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); }
      c.closePath(); P.ballFill(c, o.x, o.y, o.r, '#8a7a6a', 0.3, -0.6);
      for (let i = 0; i < o.cr; i++) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(o.x + (R() - 0.5) * o.r, o.y + (R() - 0.5) * o.r, o.r * 0.2, 0, Math.PI * 2); c.fill(); }
    },
  });
  SC.type('comet', {
    z: 15,
    bb: o => ({ x: o.x - o.dir * 10, y: o.y - 6, r: 26 }),
    muts: [{ k: 'flip', d: 2, w: 1, apply: o => ({ ...o, dir: -o.dir }) }, { k: 'remove', d: 1, w: 0.6, apply: () => null }],
    draw(c, o) {
      c.translate(o.x, o.y); c.scale(o.dir, 1);
      const g = c.createLinearGradient(0, 0, -34, -12); g.addColorStop(0, 'rgba(200,240,255,.8)'); g.addColorStop(1, 'rgba(200,240,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(2, -3); c.lineTo(-34, -16); c.lineTo(-30, -8); c.lineTo(2, 3); c.closePath(); c.fill();
      c.fillStyle = '#f4fbff'; c.beginPath(); c.arc(0, 0, 3.2, 0, Math.PI * 2); c.fill();
      const gl = c.createRadialGradient(0, 0, 0, 0, 0, 9); gl.addColorStop(0, 'rgba(200,240,255,.6)'); gl.addColorStop(1, 'rgba(200,240,255,0)'); c.fillStyle = gl; c.fillRect(-9, -9, 18, 18);
    },
  });
  SC.type('sstar', {
    z: 5,
    bb: o => ({ x: o.x, y: o.y, r: Math.max(9, o.s * 4.3 + 1) }),
    muts: [{ k: 'remove', d: 3, w: 0.8, apply: () => null }, { k: 'color', d: 4, w: 0.4, apply: o => ({ ...o, c: o.c === '#ffd0d0' ? '#cfe0ff' : '#ffb07a', s: o.s + 0.5 }) }],
    draw(c, o) {
      const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.s * 4); g.addColorStop(0, P.rgba(o.c, 0.9)); g.addColorStop(1, P.rgba(o.c, 0));
      c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.s * 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.rgba(o.c, 0.65); c.lineWidth = 0.6; c.beginPath(); c.moveTo(o.x - o.s * 4.2, o.y); c.lineTo(o.x + o.s * 4.2, o.y); c.moveTo(o.x, o.y - o.s * 4.2); c.lineTo(o.x, o.y + o.s * 4.2); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(o.x, o.y, o.s * 0.7, 0, Math.PI * 2); c.fill();
    },
  });
});
