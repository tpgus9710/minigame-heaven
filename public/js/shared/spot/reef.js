/* 🐠 바닷속 — 햇살 · 산호(가지 · 부채 · 뇌) · 말미잘 · 물고기 · 불가사리 · 조개 · 해파리 · 거품 · 보물상자 (spot-core.js 장면) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other } = U;
  const FISH = {
    clown: { c1: '#ff7a1f', c2: '#ffffff', stripes: 3 },
    tang: { c1: '#2a6fe8', c2: '#ffd23f', stripes: 0 },
    yellow: { c1: '#ffd23f', c2: '#fff4b0', stripes: 0 },
    angel: { c1: '#f2e6c8', c2: '#2a2a2a', stripes: 3 },
    red: { c1: '#e8443a', c2: '#ffd0c4', stripes: 0 },
    green: { c1: '#3fbf8f', c2: '#d6ffe9', stripes: 2 },
  };
  const CORAL = ['#ff6b8a', '#ff8a3d', '#c77dff', '#ffcf4a', '#ff5d5d', '#4fd1c5'];

  SC.scene('reef', {
    name: '🐠 바닷속',
    tone: () => '#7fd6ff',
    build(rnd, lv) {
      const objs = [], sea = pick(rnd, [['#1aa0c4', '#0a5a86', '#06324f'], ['#22b3b0', '#0b6b8a', '#073a52'], ['#1e88c8', '#0b4f8f', '#05284a']]);
      // 바닥 생물 (앞쪽)
      const floor = [];
      for (let k = 0; k < rint(rnd, 3, 4); k++) floor.push('coral');
      floor.push('fan', 'brain', 'anem', 'weed', 'weed');
      if (rnd() < 0.6) floor.push('chest');
      const xs = U.shuffle(rnd, floor).map((k, i, a) => [k, n1(20 + (i + 0.2 + rnd() * 0.6) * (360 / a.length))]);
      for (const [k, x] of xs) {
        const y = n1(250 + rnd() * 30);
        if (k === 'coral') objs.push({ t: 'coral', x, y, s: n1(0.85 + rnd() * 0.4), c: pick(rnd, CORAL), seed: rint(rnd, 1, 99999), cut: -1 });
        else if (k === 'fan') objs.push({ t: 'fan', x, y, s: n1(0.9 + rnd() * 0.3), c: pick(rnd, ['#c77dff', '#ff6b8a', '#ffb86b']) });
        else if (k === 'brain') objs.push({ t: 'brain', x, y: y + 4, r: rint(rnd, 15, 20), c: pick(rnd, ['#d9b06a', '#c9a0d0', '#9fd06a']) });
        else if (k === 'anem') objs.push({ t: 'anem', x, y, s: 1, c: pick(rnd, ['#ff8fb1', '#c9a2ff', '#ffd27a']), n: rint(rnd, 9, 12) });
        else if (k === 'weed') objs.push({ t: 'weed', x, y: y + 6, h: rint(rnd, 56, 80), c: pick(rnd, ['#3f9a4a', '#5aa83a', '#2f8a5a']), n: rint(rnd, 3, 4), ph: rint(rnd, 0, 99) });
        else objs.push({ t: 'chest', x, y: y + 2, open: rnd() < 0.5 ? 1 : 0, c: pick(rnd, ['#7a4a26', '#6a3e20']) });
      }
      for (let k = rint(rnd, 2, 3); k > 0; k--) objs.push({ t: 'star', x: rint(rnd, 20, 380), y: rint(rnd, 272, 292), s: n1(0.9 + rnd() * 0.3), c: pick(rnd, ['#ff7a3d', '#ff4d6d', '#ffcf4a']), arms: 5, rot: rint(rnd, 0, 71) });
      for (let k = rint(rnd, 3, 5); k > 0; k--) objs.push({ t: 'shell', x: rint(rnd, 14, 386), y: rint(rnd, 276, 294), s: n1(1.1 + rnd() * 0.3), c: pick(rnd, ['#f6d5c8', '#fff0c8', '#e8d0f0', '#ffd0b0']), k: pick(rnd, ['scallop', 'conch']) });
      // 물고기 (가운데)
      const nf = rint(rnd, 6, 9) + (lv > 3 ? 2 : 0);
      for (let k = 0; k < nf; k++) {
        const sp = pick(rnd, Object.keys(FISH)), F = FISH[sp];
        objs.push({ t: 'fish', x: rint(rnd, 30, 370), y: rint(rnd, 60, 220), s: n1(0.8 + rnd() * 0.5), sp, c1: F.c1, c2: F.c2, st: F.stripes, dir: rnd() < 0.5 ? 1 : -1, fin: 1, eye: '#111111' });
      }
      if (rnd() < 0.7) objs.push({ t: 'jelly', x: rint(rnd, 40, 360), y: rint(rnd, 40, 110), s: n1(0.9 + rnd() * 0.3), c: pick(rnd, ['#ffb3e6', '#b3d9ff', '#e6ccff']), n: 5 });
      for (let k = rint(rnd, 2, 4); k > 0; k--) objs.push({ t: 'bub', x: rint(rnd, 20, 380), y: rint(rnd, 30, 200), n: rint(rnd, 3, 5), seed: rint(rnd, 1, 9999) });
      return { bg: { sea, rays: rint(rnd, 1, 9999) }, objs };
    },
    adds: [
      { zone: [30, 370, 60, 200], r: 14, d: 2, make: (rnd, x, y) => ({ t: 'fish', x, y, s: 0.75, sp: 'yellow', c1: FISH.yellow.c1, c2: FISH.yellow.c2, st: 0, dir: rnd() < 0.5 ? 1 : -1, fin: 1, eye: '#111111' }) },
      { zone: [20, 380, 40, 200], r: 10, d: 3, make: (rnd, x, y) => ({ t: 'bub', x, y, n: 3, seed: rint(rnd, 1, 9999) }) },
    ],
    back(c, bg, X) {
      const g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, bg.sea[0]); g.addColorStop(0.55, bg.sea[1]); g.addColorStop(1, bg.sea[2]);
      c.fillStyle = g; c.fillRect(0, 0, 400, 300);
      const R = U.rng(bg.rays);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {                                                        // 햇살
        const x = R() * 440 - 20, w = 14 + R() * 30, sk = 60 + R() * 60;
        const lg = c.createLinearGradient(0, 0, 0, 260); lg.addColorStop(0, 'rgba(200,250,255,.16)'); lg.addColorStop(1, 'rgba(200,250,255,0)');
        c.fillStyle = lg; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w + sk, 260); c.lineTo(x + sk - w * 0.5, 260); c.closePath(); c.fill();
      }
      c.restore();
      c.beginPath(); c.rect(0, 0, 400, 60); X.tex(c, 21, 0.18, 'screen', 14, 1, 0.4);        // 물결 빛
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(10,40,60,.35)'; P.ell(c, R() * 400, 230 + R() * 20, 40 + R() * 50, 18 + R() * 12); c.fill(); }   // 먼 바위
      const sg = c.createLinearGradient(0, 238, 0, 300); sg.addColorStop(0, '#c9b07a'); sg.addColorStop(1, '#8e7a52');   // 모래
      c.fillStyle = sg; c.beginPath(); c.moveTo(0, 250); for (let x = 0; x <= 400; x += 20) c.lineTo(x, 244 + Math.sin(x * 0.03 + bg.rays) * 5); c.lineTo(400, 300); c.lineTo(0, 300); c.closePath(); c.fill();
      X.tex(c, 22, 0.4, 'overlay', 3); X.tex(c, 23, 0.25, 'multiply', 10, 1, 0.3);
      c.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 30; i++) { P.ell(c, R() * 400, 255 + R() * 45, 6 + R() * 10, 1); c.fill(); }
    },
    front(c, bg) {
      const g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(120,220,255,.06)'); g.addColorStop(1, 'rgba(0,30,60,.18)');
      c.fillStyle = g; c.fillRect(0, 0, 400, 300); void bg;
    },
  });

  /** 가지 산호: 씨앗으로 정해진 가지 (cut: 없앤 가지 번호) — 가지 끝 자리는 정답 원에 써요 (sin · cos 없이) */
  function branches(o) {
    const R = U.rng(o.seed), out = [];
    const grow = (x, y, dx, dy, len, depth, id) => {
      const ex = x + dx * len, ey = y + dy * len;
      out.push({ x, y, ex, ey, w: 2 + depth * 1.6, d: depth, id });
      if (depth <= 0) return;
      const k = R() < 0.5 ? 2 : 3;
      for (let i = 0; i < k; i++) { const ndx = dx + (i - (k - 1) / 2) * 0.55 + (R() - 0.5) * 0.25, ndy = dy * 0.9 - 0.1; const L = Math.sqrt(ndx * ndx + ndy * ndy); grow(ex, ey, ndx / L, ndy / L, len * (0.7 + R() * 0.15), depth - 1, id * 4 + i + 1); }
    };
    grow(o.x, o.y, 0, -1, 22 * o.s, 2, 0);
    return out;
  }
  SC.type('coral', {
    z: 30,
    bb: o => ({ x: o.x, y: o.y - 30 * o.s, r: 34 * o.s }),
    muts: [
      { k: 'color', d: 2, w: 1.2, apply: (o, rnd, lv) => ({ ...o, c: lv < 2 ? other(rnd, CORAL, o.c, lv) : shift(rnd, o.c, lv) }) },
      { k: 'part', d: 3, w: 1.2, apply(o, rnd) { const tips = branches(o).filter(b => b.d === 0); const t = pick(rnd, tips); return { ...o, cut: t.id }; },
        at(o, nb) { const b = branches(o).find(q => q.id === nb.cut); return { x: (b.x + b.ex) / 2, y: (b.y + b.ey) / 2, r: Math.sqrt((b.ex - b.x) * (b.ex - b.x) + (b.ey - b.y) * (b.ey - b.y)) / 2 + 5 }; } },
    ],
    draw(c, o) {
      P.shadow(c, o.x + 4, o.y + 2, 22 * o.s, 5, 0.4);
      const bs = branches(o);
      c.lineCap = 'round';
      for (const b of bs) {
        if (b.id === o.cut) continue;
        const g = c.createLinearGradient(b.x - b.w, 0, b.x + b.w, 0); g.addColorStop(0, P.lit(o.c, 0.3)); g.addColorStop(1, P.lit(o.c, -0.35));
        c.strokeStyle = g; c.lineWidth = b.w; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.ex, b.ey); c.stroke();
        if (b.d === 0) { c.fillStyle = P.lit(o.c, 0.45); c.beginPath(); c.arc(b.ex, b.ey, b.w * 0.7, 0, Math.PI * 2); c.fill(); }
      }
    },
  });
  SC.type('fan', {
    z: 28,
    bb: o => ({ x: o.x, y: o.y - 26 * o.s, r: 30 * o.s }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.min(lv, 2)) }) }],
    draw(c, o) {
      const { x, y, s } = o;
      c.save(); c.translate(x, y); c.scale(s, s);
      c.beginPath(); c.moveTo(0, 0); for (let a = -2.4; a <= -0.7; a += 0.1) c.lineTo(Math.cos(a) * 30, Math.sin(a) * 34 - 8); c.closePath();
      const g = c.createRadialGradient(0, -10, 2, 0, -14, 36); g.addColorStop(0, P.lit(o.c, -0.2)); g.addColorStop(1, P.rgba(o.c, 0.6)); c.fillStyle = g; c.fill();
      c.strokeStyle = P.lit(o.c, -0.35); c.lineWidth = 0.7;
      for (let a = -2.4; a <= -0.7; a += 0.17) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a) * 14, Math.sin(a) * 16 - 4, Math.cos(a) * 29, Math.sin(a) * 33 - 8); c.stroke(); }
      for (let r = 10; r < 34; r += 6) { c.beginPath(); c.arc(0, -8, r, -2.4, -0.7); c.stroke(); }
      c.restore();
    },
  });
  SC.type('brain', {
    z: 29,
    bb: o => ({ x: o.x, y: o.y - o.r * 0.6, r: o.r + 2 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) }, { k: 'size', d: 3, w: 0.7, apply: o => ({ ...o, r: o.r + 4 }) }],
    draw(c, o, X) {
      const { x, r } = o, y = o.y - r * 0.6;
      P.shadow(c, x + 4, o.y + 1, r * 1.2, 5, 0.45);
      c.beginPath(); c.ellipse(x, y, r, r * 0.72, 0, Math.PI, 0); c.lineTo(x + r, o.y); c.lineTo(x - r, o.y); c.closePath();
      P.ballFill(c, x, y, r, o.c, 0.3, -0.45);
      c.save(); c.clip(); c.strokeStyle = P.lit(o.c, -0.35); c.lineWidth = 1; const R = X.R(o.id);
      for (let i = 0; i < 9; i++) { c.beginPath(); let px = x - r + R() * 2 * r, py = y - r * 0.6 + R() * r; c.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 9; py += (R() - 0.5) * 6; c.lineTo(px, py); } c.stroke(); }
      c.restore();
    },
  });
  SC.type('anem', {
    z: 31,
    bb: o => ({ x: o.x, y: o.y - 12, r: 20 }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) }],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 3, y + 1, 16, 4, 0.4);
      c.lineCap = 'round';
      for (let i = 0; i < o.n; i++) {
        const t = (i / (o.n - 1)) * 2 - 1, ex = x + t * 18, ey = y - 18 - (1 - t * t) * 10;
        c.strokeStyle = P.lit(o.c, (i % 2) * 0.15 - 0.05); c.lineWidth = 3.2; c.beginPath(); c.moveTo(x + t * 6, y - 4); c.quadraticCurveTo(x + t * 16, y - 10, ex, ey); c.stroke();
        c.fillStyle = P.lit(o.c, 0.4); c.beginPath(); c.arc(ex, ey, 2, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = P.vgrad(c, y - 8, y, o.c, -0.1, -0.45); P.ell(c, x, y - 3, 9, 5); c.fill();
    },
  });
  SC.type('weed', {
    z: 25,
    bb: o => ({ x: o.x, y: o.y - o.h / 2, r: o.h / 2 + 4 }),
    muts: [{ k: 'count', d: 3, w: 0.8, apply: o => ({ ...o, n: o.n - 1 }), at: o => ({ x: o.x + (o.n - 2.5) * 7, y: o.y - o.h / 2, r: o.h / 2 + 6 }) }],
    draw(c, o) {
      c.lineCap = 'round';
      for (let i = 0; i < o.n; i++) {
        const bx = o.x + (i - 1.5) * 7, h = o.h * (0.75 + ((i * 37 + o.ph) % 10) / 40);
        c.strokeStyle = P.lit(o.c, (i % 2) * 0.12 - 0.06); c.lineWidth = 4;
        c.beginPath(); c.moveTo(bx, o.y);
        for (let k = 1; k <= 8; k++) c.lineTo(bx + Math.sin(k * 0.9 + o.ph + i) * 4, o.y - h * k / 8);
        c.stroke();
      }
    },
  });
  SC.type('chest', {
    z: 32,
    bb: o => ({ x: o.x + 1, y: o.y - 14, r: 25 }),
    muts: [{ k: 'part', d: 2, w: 1, apply: o => ({ ...o, open: o.open ? 0 : 1 }) }, { k: 'color', d: 2, w: 0.6, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) }],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 4, y + 1, 18, 4, 0.5);
      c.fillStyle = P.vgrad(c, y - 16, y, o.c, 0.15, -0.3); c.fillRect(x - 15, y - 16, 30, 16);
      c.fillStyle = '#c9a23a'; c.fillRect(x - 15, y - 16, 30, 2); c.fillRect(x - 2, y - 16, 4, 16);
      if (o.open) {
        c.fillStyle = '#ffd23f'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x - 9 + i * 3.6, y - 17 - (i % 2) * 2, 2.2, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = P.lit(o.c, -0.2); c.beginPath(); c.moveTo(x - 15, y - 17); c.lineTo(x - 12, y - 31); c.lineTo(x + 18, y - 31); c.lineTo(x + 15, y - 17); c.fill();
      } else { c.fillStyle = P.vgrad(c, y - 26, y - 16, o.c, 0.2, -0.1); c.beginPath(); c.moveTo(x - 15, y - 16); c.quadraticCurveTo(x, y - 30, x + 15, y - 16); c.fill(); c.fillStyle = '#c9a23a'; c.fillRect(x - 2, y - 22, 4, 6); }
    },
  });
  SC.type('star', {
    z: 35,
    bb: o => ({ x: o.x, y: o.y, r: 13 * o.s }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) },
      { k: 'part', d: 4, w: 0.9, apply: o => ({ ...o, arms: 4 }) },
      { k: 'remove', d: 1, w: 0.6, apply: () => null },
    ],
    draw(c, o) {
      const { x, y, s } = o;
      P.shadow(c, x + 2, y + 2, 12 * s, 5 * s, 0.4);
      c.save(); c.translate(x, y); c.rotate(o.rot * Math.PI / 36); c.scale(s, s * 0.8);
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        if (o.arms === 4 && (i === 0)) { c.lineTo(0, -3.5); continue; }
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4.5 : 12; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
      const g = c.createRadialGradient(-2, -2, 1, 0, 0, 12); g.addColorStop(0, P.lit(o.c, 0.35)); g.addColorStop(1, P.lit(o.c, -0.3)); c.fillStyle = g; c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; if (o.arms === 4 && i === 0) continue; c.beginPath(); c.arc(Math.cos(a) * 6, Math.sin(a) * 6, 0.9, 0, Math.PI * 2); c.fill(); }
      c.restore();
    },
  });
  SC.type('shell', {
    z: 34,
    bb: o => ({ x: o.x, y: o.y, r: 9 * o.s + 2 }),
    muts: [{ k: 'remove', d: 2, w: 0.8, apply: () => null }],
    draw(c, o) {
      const { x, y, s } = o;
      P.shadow(c, x + 2, y + 2, 8 * s, 3, 0.4);
      if (o.k === 'scallop') {
        c.beginPath(); c.moveTo(x, y + 4 * s); for (let a = Math.PI * 1.1; a <= Math.PI * 1.9; a += 0.1) c.lineTo(x + Math.cos(a) * 8 * s, y + 4 * s + Math.sin(a) * 9 * s); c.closePath();
        c.fillStyle = P.vgrad(c, y - 6 * s, y + 4 * s, o.c, 0.3, -0.2); c.fill();
        c.strokeStyle = P.lit(o.c, -0.3); c.lineWidth = 0.6; for (let a = Math.PI * 1.15; a < Math.PI * 1.9; a += 0.15) { c.beginPath(); c.moveTo(x, y + 4 * s); c.lineTo(x + Math.cos(a) * 8 * s, y + 4 * s + Math.sin(a) * 9 * s); c.stroke(); }
      } else {
        c.beginPath(); c.moveTo(x - 8 * s, y + 2); c.quadraticCurveTo(x - 2 * s, y - 7 * s, x + 8 * s, y - 2 * s); c.quadraticCurveTo(x + 2 * s, y + 4 * s, x - 8 * s, y + 2); c.fillStyle = P.vgrad(c, y - 7 * s, y + 4 * s, o.c, 0.3, -0.25); c.fill();
        c.strokeStyle = P.lit(o.c, -0.35); c.lineWidth = 0.6; for (let i = 1; i < 4; i++) { c.beginPath(); c.arc(x + 4 * s - i * 3 * s, y - 1, 2.5 * s, Math.PI, Math.PI * 2); c.stroke(); }
      }
    },
  });
  SC.type('fish', {
    z: 40,
    bb: o => ({ x: o.x, y: o.y, r: 21 * o.s + 2 }),
    muts: [
      { k: 'color', d: 2, w: 1.4, apply: (o, rnd, lv) => ({ ...o, c1: shift(rnd, o.c1, lv) }) },
      { k: 'flip', d: 2, w: 1, apply: o => ({ ...o, dir: -o.dir }) },
      { k: 'stripe', d: 3, w: 1.2, ok: o => o.st > 0, apply: o => ({ ...o, st: o.st - 1 }) },
      { k: 'part', d: 3, w: 0.9, ok: o => o.st > 0 || o.sp === 'tang', apply: (o, rnd, lv) => ({ ...o, c2: shift(rnd, o.c2, Math.max(lv, 2.5)) }) },
      { k: 'part', d: 4, w: 0.7, apply: o => ({ ...o, fin: 0 }), at: o => ({ x: o.x, y: o.y - 9 * o.s, r: Math.max(9, 8 * o.s) }) },
      { k: 'remove', d: 1, w: 0.8, apply: () => null },
    ],
    draw(c, o) {
      const { x, y, s } = o;
      c.save(); c.translate(x, y); c.scale(o.dir * s, s);
      c.beginPath(); c.moveTo(-12, 0); c.lineTo(-20, -8); c.quadraticCurveTo(-17, 0, -20, 8); c.closePath(); c.fillStyle = P.lit(o.sp === 'tang' ? o.c2 : o.c1, -0.15); c.fill();
      if (o.fin) { c.beginPath(); c.moveTo(-6, -7); c.quadraticCurveTo(0, -15, 7, -7); c.closePath(); c.fillStyle = P.lit(o.sp === 'tang' ? '#1a1a2a' : o.c1, -0.2); c.fill(); }
      c.beginPath(); c.ellipse(0, 0, 14, o.sp === 'angel' ? 10 : 8, 0, 0, Math.PI * 2);
      const g = c.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, P.lit(o.c1, -0.15)); g.addColorStop(0.45, P.lit(o.c1, 0.15)); g.addColorStop(1, P.lit(o.c1, 0.35)); c.fillStyle = g; c.fill();
      c.save(); c.clip();
      if (o.st) { c.fillStyle = o.c2; const xs = o.st === 3 ? [-7, 0, 7] : o.st === 2 ? [-4, 5] : [3]; for (const sx of xs.slice(0, o.st)) { c.beginPath(); c.ellipse(sx, 0, 2.2, 11, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.6; c.stroke(); } }
      if (o.sp === 'tang') { c.fillStyle = '#1a1a2a'; c.beginPath(); c.ellipse(-1, -2, 8, 3, 0.1, 0, Math.PI * 2); c.fill(); }
      if (o.sp === 'red' || o.sp === 'yellow') { c.fillStyle = P.rgba(o.c2, 0.5); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-4 + i * 4, 3, 1.1, 0, Math.PI * 2); c.fill(); } }
      c.restore();
      c.fillStyle = 'rgba(255,255,255,.35)'; P.ell(c, 2, -4, 7, 1.6, -0.1); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(8, -2, 2.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = o.eye; c.beginPath(); c.arc(8.5, -2, 1.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-1, 4); c.quadraticCurveTo(2, 9, 5, 5); c.closePath(); c.fillStyle = P.lit(o.c1, -0.25); c.fill();
      c.restore();
    },
  });
  SC.type('jelly', {
    z: 38,
    bb: o => ({ x: o.x, y: o.y + 8 * o.s, r: 22 * o.s }),
    muts: [{ k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2)) }) }, { k: 'count', d: 4, w: 0.8, apply: o => ({ ...o, n: o.n - 2 }), at: o => ({ x: o.x + 5 * o.s, y: o.y + 14 * o.s, r: 15 * o.s }) }],
    draw(c, o) {
      const { x, y, s } = o;
      c.save(); c.translate(x, y); c.scale(s, s);
      c.strokeStyle = P.rgba(o.c, 0.7); c.lineWidth = 1.2;
      for (let i = 0; i < o.n; i++) { const tx = -9 + i * (18 / 4); c.beginPath(); c.moveTo(tx, 2); c.bezierCurveTo(tx + 3, 10, tx - 3, 18, tx + 1, 26); c.stroke(); }
      c.beginPath(); c.ellipse(0, 0, 14, 11, 0, Math.PI, 0); c.quadraticCurveTo(0, 6, -14, 0);
      const g = c.createRadialGradient(-3, -5, 1, 0, -2, 14); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.5, P.rgba(o.c, 0.7)); g.addColorStop(1, P.rgba(o.c, 0.35)); c.fillStyle = g; c.fill();
      c.restore();
    },
  });
  SC.type('bub', {
    z: 45,
    bb: o => ({ x: o.x, y: o.y - 4 * o.n, r: 4 * o.n + 5 }),
    muts: [{ k: 'count', d: 3, w: 0.9, apply: o => ({ ...o, n: o.n + 2 }) }, { k: 'remove', d: 2, w: 0.6, apply: () => null }],
    draw(c, o) {
      const R = U.rng(o.seed);
      for (let i = 0; i < o.n; i++) {
        const bx = o.x + (R() - 0.5) * 8, by = o.y - i * 8 - R() * 3, r = 1.8 + R() * 2.4;
        c.strokeStyle = 'rgba(230,255,255,.75)'; c.lineWidth = 0.8; c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.stroke();
        c.fillStyle = 'rgba(230,255,255,.18)'; c.fill();
        c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(bx - r * 0.35, by - r * 0.35, r * 0.3, 0, Math.PI * 2); c.fill();
      }
    },
  });
});
