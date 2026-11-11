/* 📚 책장 — 나무 책장 4칸 · 빽빽한 책 · 꽃병 · 화분 · 지구본 · 액자 · 시계 · 촛대 (spot-core.js 장면) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other } = U;
  const BOOK = ['#2b3f63', '#6b1f2a', '#2f5a3e', '#b8892d', '#e8dfc8', '#5a3a28', '#1f1f24', '#2f6b73', '#7a2f4f', '#8a8f3a', '#c4553a', '#3e4a7a', '#a37b5c', '#4a6b2a'];
  const BAND = ['#d9b45a', '#efe6cf', '#c9a04a'];
  const SH = [{ top: 14, bot: 78 }, { top: 86, bot: 150 }, { top: 158, bot: 222 }, { top: 230, bot: 292 }];   // 칸마다 위 · 바닥
  const DECO = ['vase', 'plant', 'globe', 'frame', 'clock', 'candle', 'stack', 'cat'];
  const W0 = { vase: 30, plant: 30, globe: 38, frame: 40, clock: 32, candle: 22, stack: 44, cat: 26 };

  SC.scene('shelf', {
    name: '📚 책장',
    tone: () => '#ffd9a0',
    build(rnd, lv) {
      const objs = [], wood = pick(rnd, ['#6b4428', '#5a3820', '#7a5232', '#4a2f1c']);
      objs.push({ t: 'case', x: 0, y: 0, c: wood, bgo: 1 });
      const decos = U.shuffle(rnd, DECO).slice(0, rint(rnd, 4, 6));
      let di = 0;
      SH.forEach((s, row) => {
        let x = 26;
        const want = row < 3 || rnd() < 0.5 ? 1 + (rnd() < 0.5 ? 1 : 0) : 1;     // 칸마다 장식 1~2개
        const slots = [];
        for (let k = 0; k < want && di < decos.length; k++) slots.push(rint(rnd, 0, 2));
        let made = 0;
        while (x < 372) {
          if (slots.length && made >= slots[0] * 4 && di < decos.length && rnd() < 0.35) {
            const k = decos[di++], w = W0[k];
            if (x + w > 374) break;
            slots.shift(); objs.push(deco(rnd, k, x + w / 2, s.bot, lv)); x += w + 4; continue;
          }
          if (rnd() < 0.06 && x < 350) { x += rint(rnd, 3, 9); continue; }       // 빈틈
          const w = rint(rnd, 7, 15) + (lv > 3 ? -1 : 0), h = rint(rnd, 40, s.bot - s.top - 6);
          if (x + w > 374) break;
          objs.push({ t: 'book', x, y: s.bot, w, h, c: pick(rnd, BOOK), band: rnd() < 0.6 ? 2 : rnd() < 0.5 ? 1 : 0, bc: pick(rnd, BAND), lab: rnd() < 0.45 ? 1 : 0, lc: pick(rnd, ['#efe6cf', '#1f1f24', '#d9b45a']), lean: 0 });
          x += w + (rnd() < 0.85 ? 0.6 : 2); made++;
        }
      });
      return { bg: { wood, wall: pick(rnd, ['#d8c8a8', '#c9b89a', '#b9c4b0', '#c8b4a4']) }, objs };
    },
    back(c, bg, X) {
      c.fillStyle = bg.wall; c.fillRect(0, 0, 400, 300);
      c.beginPath(); c.rect(0, 0, 400, 300); X.tex(c, 5, 0.25, 'overlay', 30);
    },
  });
  function deco(rnd, k, x, y, lv) {
    if (k === 'vase') return { t: 'vase', x, y, c: pick(rnd, ['#2f6b73', '#c4553a', '#e8dfc8', '#3e4a7a']), fl: [pick(rnd, ['#e84a5f', '#ffd23f', '#f7f3ea']), pick(rnd, ['#e84a5f', '#ffd23f', '#c77dff']), pick(rnd, ['#ff8a3d', '#f7f3ea', '#e84a5f'])], n: 3 };
    if (k === 'plant') return { t: 'plant', x, y, c: pick(rnd, ['#c4553a', '#e8dfc8', '#2b3f63', '#7a5a40']), n: rint(rnd, 5, 7) };
    if (k === 'globe') return { t: 'globe', x, y, c: pick(rnd, ['#b8892d', '#5a3a28', '#2f2f35']), tilt: rnd() < 0.5 ? 1 : -1 };
    if (k === 'frame') return { t: 'frame', x, y, c: pick(rnd, ['#b8892d', '#2f2f35', '#e8dfc8', '#7a2f4f']), pic: pick(rnd, ['mountain', 'sea', 'tree']), sun: 1 };
    if (k === 'clock') return { t: 'clock', x, y, c: pick(rnd, ['#b8892d', '#7a2f4f', '#2f5a3e']), hh: rint(rnd, 0, 11), mm: rint(rnd, 0, 11) };
    if (k === 'candle') return { t: 'candle', x, y, c: pick(rnd, ['#f4efe4', '#e84a5f', '#2f6b73']), lit: 1 };
    if (k === 'stack') return { t: 'stack', x, y, bk: Array.from({ length: 3 }, () => [rint(rnd, 34, 42), rint(rnd, 6, 9), pick(rnd, BOOK)]) };
    return { t: 'cat', x, y, c: pick(rnd, ['#2f2f35', '#f4efe4', '#b8892d', '#c4553a']), tail: 1 };
  }

  SC.type('case', {
    z: 1, bb: () => ({ x: 200, y: 150, r: 200 }), muts: [],
    draw(c, o, X) {
      const wood = o.c;
      c.fillStyle = P.vgrad(c, 0, 300, wood, 0.1, -0.2); c.fillRect(8, 2, 384, 298);
      c.beginPath(); c.rect(8, 2, 384, 298); X.tex(c, 61, 0.5, 'overlay', 14, 0.25, 4);
      SH.forEach(s => {
        const g = c.createLinearGradient(0, s.top, 0, s.bot); g.addColorStop(0, P.lit(wood, -0.62)); g.addColorStop(1, P.lit(wood, -0.42));
        c.fillStyle = g; c.fillRect(22, s.top, 356, s.bot - s.top);
        c.beginPath(); c.rect(22, s.top, 356, s.bot - s.top); X.tex(c, 62, 0.35, 'overlay', 10, 4, 0.3);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(22, s.top, 356, 5);
        c.fillStyle = P.vgrad(c, s.bot, s.bot + 8, wood, 0.25, -0.1); c.fillRect(14, s.bot, 372, 8);
        c.beginPath(); c.rect(14, s.bot, 372, 8); X.tex(c, 63, 0.45, 'overlay', 12, 4, 0.3);
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(14, s.bot, 372, 1.2);
      });
      c.fillStyle = P.hgrad(c, 8, 22, wood, 0.18, -0.15); c.fillRect(8, 2, 14, 298); c.fillStyle = P.hgrad(c, 378, 392, wood, 0.05, -0.3); c.fillRect(378, 2, 14, 298);
    },
  });
  SC.type('book', {
    z: 20,
    bb: o => ({ x: o.x + o.w / 2, y: o.y - o.h / 2, r: Math.sqrt(o.w * o.w + o.h * o.h) / 2 + 1 }),
    muts: [
      { k: 'color', d: 2, w: 2, apply: (o, rnd, lv) => ({ ...o, c: lv < 2.5 ? other(rnd, BOOK, o.c, lv) : shift(rnd, o.c, lv) }) },
      { k: 'remove', d: 1, w: 1.2, apply: () => null },
      { k: 'band', d: 3, w: 0.35, ok: o => o.band && U.cdist(o.bc, o.c) >= 150, apply: o => ({ ...o, band: o.band - 1 }), at: o => ({ x: o.x + o.w / 2, y: o.band === 2 ? o.y - o.h + 6 : o.y - 7, r: 9 }) },
      { k: 'label', d: 3, w: 1.1, ok: o => o.lab, apply: (o, rnd, lv) => ({ ...o, lc: other(rnd, ['#efe6cf', '#1f1f24', '#d9b45a', '#c4553a'], o.lc, lv) }), at: o => ({ x: o.x + o.w / 2, y: o.y - 27, r: Math.max(9, o.w * 0.4 + 5) }) },
      { k: 'size', d: 3, w: 0.15, ok: o => o.h <= 52, apply: o => ({ ...o, h: o.h + 8 }), at: o => ({ x: o.x + o.w / 2, y: o.y - o.h, r: Math.sqrt(o.w * o.w / 4 + 64) + 1.5 }) },
      { k: 'size', d: 4, w: 0.08, ok: o => o.h >= 46, apply: o => ({ ...o, h: o.h - 6 }), at: o => ({ x: o.x + o.w / 2, y: o.y - o.h + 6.5, r: Math.sqrt(o.w * o.w / 4 + 42) + 1.5 }) },
    ],
    draw(c, o, X) {
      const { x, w, h } = o, y = o.y - h;
      c.fillStyle = P.hgrad(c, x, x + w, o.c, 0.22, -0.35); c.fillRect(x, y, w, h);
      c.beginPath(); c.rect(x, y, w, h); X.tex(c, 70 + (o.id % 5), 0.3, 'overlay', 6, 0.5, 2);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + w * 0.18, y, w * 0.12, h);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + w - 1, y, 1, h);
      if (o.band >= 1) { c.fillStyle = o.bc; c.fillRect(x, o.y - 8, w, 2); }
      if (o.band >= 2) { c.fillStyle = o.bc; c.fillRect(x, y + 5, w, 2); }
      if (o.lab) { c.fillStyle = o.lc; c.fillRect(x + w * 0.2, o.y - 32, w * 0.6, 10); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x + w * 0.2, o.y - 23, w * 0.6, 1); }
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x, y, w, 1.5);
    },
  });
  SC.type('vase', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y - 30, r: 30 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }), at: o => ({ x: o.x, y: o.y - 11, r: 13 }) },
      { k: 'remove', d: 3, w: 1, apply: o => ({ ...o, n: 2 }), at: o => ({ x: o.x + 6, y: o.y - 36, r: 15 }) },
      { k: 'color', d: 3, w: 1, apply: (o, rnd, lv) => ({ ...o, fl: [shift(rnd, o.fl[0], lv), o.fl[1], o.fl[2]] }), at: o => ({ x: o.x - 9, y: o.y - 46, r: 10 }) },
    ],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 4, y - 1, 14, 3.5, 0.45);
      const fl = [[-9, -46, -0.35], [0, -54, 0], [9, -44, 0.4]];
      for (let i = 0; i < 3; i++) {
        if (i === 2 && o.n < 3) continue;
        const [dx, dy] = fl[i];
        c.strokeStyle = '#3f6a2a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y - 20); c.quadraticCurveTo(x + dx * 0.4, y - 34, x + dx, y + dy + 5); c.stroke();
        c.fillStyle = '#4f8a32'; P.ell(c, x + dx * 0.5 + 3, y - 32, 4, 1.8, -0.6); c.fill();
        for (let p = 0; p < 6; p++) { const a = p * Math.PI / 3; P.ell(c, x + dx + Math.cos(a) * 3.2, y + dy + Math.sin(a) * 3.2, 2.6, 2.6); c.fillStyle = P.lit(o.fl[i], p % 2 ? -0.08 : 0.08); c.fill(); }
        P.ell(c, x + dx, y + dy, 1.8, 1.8); c.fillStyle = '#e8b830'; c.fill();
      }
      c.beginPath(); c.moveTo(x - 5, y - 24); c.bezierCurveTo(x - 6, y - 16, x - 13, y - 14, x - 11, y - 4); c.quadraticCurveTo(x - 10, y, x, y); c.quadraticCurveTo(x + 10, y, x + 11, y - 4); c.bezierCurveTo(x + 13, y - 14, x + 6, y - 16, x + 5, y - 24); c.closePath();
      c.fillStyle = P.hgrad(c, x - 12, x + 12, o.c, 0.35, -0.4); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; P.ell(c, x - 6, y - 10, 1.6, 4.5); c.fill();
    },
  });
  SC.type('plant', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y - 18, r: 20 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }), at: o => ({ x: o.x, y: o.y - 8, r: 15 }) },
      { k: 'count', d: 4, w: 0.8, apply: o => ({ ...o, n: o.n - 1 }), at: o => ({ x: o.x, y: o.y - 24, r: 15 }) },
    ],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 4, y - 1, 13, 3.5, 0.45);
      for (let i = 0; i < o.n; i++) {
        const a = -Math.PI / 2 + (i - (o.n - 1) / 2) * 0.42, L = 15 - Math.abs(i - (o.n - 1) / 2) * 1.6;
        c.save(); c.translate(x, y - 13); c.rotate(a + Math.PI / 2);
        P.ell(c, 0, -L / 2, 3.6, L / 2); const g = c.createLinearGradient(-3.6, 0, 3.6, 0); g.addColorStop(0, '#8cc06a'); g.addColorStop(1, '#3e7a3a'); c.fillStyle = g; c.fill();
        c.restore();
      }
      c.beginPath(); c.moveTo(x - 10, y - 14); c.lineTo(x + 10, y - 14); c.lineTo(x + 8, y); c.lineTo(x - 8, y); c.closePath();
      c.fillStyle = P.hgrad(c, x - 10, x + 10, o.c, 0.3, -0.35); c.fill();
      c.fillStyle = P.lit(o.c, 0.15); c.fillRect(x - 11, y - 16, 22, 3);
    },
  });
  SC.type('globe', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y - 24, r: 24 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) },
      { k: 'flip', d: 3, w: 1, apply: o => ({ ...o, tilt: -o.tilt }), at: o => ({ x: o.x, y: o.y - 28, r: 20 }) },
    ],
    draw(c, o, X) {
      const { x, y } = o, cy = y - 30;
      P.shadow(c, x + 4, y - 1, 14, 3.5, 0.45);
      c.fillStyle = P.hgrad(c, x - 11, x + 11, o.c, 0.3, -0.3); P.rr(c, x - 11, y - 5, 22, 5, 2); c.fill();
      c.fillRect(x - 1.5, y - 14, 3, 10);
      c.strokeStyle = P.lit(o.c, 0.2); c.lineWidth = 1.6; c.beginPath(); c.arc(x, cy, 16, Math.PI * (o.tilt > 0 ? 0.35 : -0.35) + Math.PI * 0.3, Math.PI * (o.tilt > 0 ? 0.35 : -0.35) + Math.PI * 1.3); c.stroke();
      c.beginPath(); c.arc(x, cy, 13.5, 0, Math.PI * 2); P.ballFill(c, x, cy, 13.5, '#2f7ab0', 0.35, -0.5);
      c.save(); c.clip(); c.translate(x, cy); c.rotate(o.tilt * 0.4);
      c.fillStyle = '#6fa04a'; P.ell(c, -4, -4, 6, 4.5, 0.4); c.fill(); P.ell(c, 5, 5, 4, 6, -0.3); c.fill(); P.ell(c, 7, -7, 3, 2); c.fill();
      c.restore();
      P.spec(c, x, cy, 13.5, 0.35);
    },
  });
  SC.type('frame', {
    z: 22,
    bb: o => ({ x: o.x + 1, y: o.y - 23, r: 29 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2)) }) },
      { k: 'pic', d: 2, w: 1, apply: o => ({ ...o, pic: o.pic === 'mountain' ? 'sea' : o.pic === 'sea' ? 'tree' : 'mountain' }), at: o => ({ x: o.x, y: o.y - 24, r: 22 }) },
      { k: 'part', d: 3, w: 1, apply: o => ({ ...o, sun: 0 }), at: o => ({ x: o.x + 7, y: o.y - 33, r: 9 }) },
    ],
    draw(c, o) {
      const { x, y } = o, x0 = x - 17, y0 = y - 46;
      P.shadow(c, x + 6, y - 2, 18, 4, 0.5);
      c.fillStyle = P.vgrad(c, y0, y, o.c, 0.3, -0.25); c.fillRect(x0, y0, 34, 44);
      const ix = x0 + 5, iy = y0 + 5, iw = 24, ih = 34;
      const g = c.createLinearGradient(0, iy, 0, iy + ih); g.addColorStop(0, o.pic === 'sea' ? '#8fc4e8' : '#a9d0ef'); g.addColorStop(1, '#e8eff5'); c.fillStyle = g; c.fillRect(ix, iy, iw, ih);
      if (o.sun) { c.fillStyle = '#ffcf4a'; c.beginPath(); c.arc(x + 7, y - 33, 3.4, 0, Math.PI * 2); c.fill(); }
      if (o.pic === 'mountain') { c.fillStyle = '#5a7a8a'; c.beginPath(); c.moveTo(ix, iy + ih); c.lineTo(ix + 9, iy + 14); c.lineTo(ix + 16, iy + 24); c.lineTo(ix + 20, iy + 18); c.lineTo(ix + iw, iy + ih); c.fill(); c.fillStyle = '#f4f8fb'; c.beginPath(); c.moveTo(ix + 9, iy + 14); c.lineTo(ix + 11.5, iy + 18); c.lineTo(ix + 6.5, iy + 18); c.fill(); }
      else if (o.pic === 'sea') { c.fillStyle = '#2f6fa8'; c.fillRect(ix, iy + 20, iw, ih - 20); c.fillStyle = '#f4f1e6'; c.beginPath(); c.moveTo(ix + 8, iy + 20); c.lineTo(ix + 12, iy + 10); c.lineTo(ix + 12, iy + 20); c.fill(); }
      else { c.fillStyle = '#6aa04a'; c.fillRect(ix, iy + 26, iw, ih - 26); c.fillStyle = '#5a3a28'; c.fillRect(ix + 11, iy + 16, 2.5, 11); c.fillStyle = '#3f7a3a'; c.beginPath(); c.arc(ix + 12, iy + 14, 6.5, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.strokeRect(ix, iy, iw, ih);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(ix, iy); c.lineTo(ix + 12, iy); c.lineTo(ix, iy + 20); c.fill();
    },
  });
  SC.type('clock', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y - 17, r: 18 }),
    muts: [
      { k: 'hands', d: 3, w: 1.2, apply: o => ({ ...o, hh: (o.hh + 3) % 12 }), at: o => ({ x: o.x, y: o.y - 19, r: 11 }) },
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) },
    ],
    draw(c, o) {
      const { x, y } = o, cy = y - 19;
      P.shadow(c, x + 4, y - 1, 15, 3.5, 0.45);
      c.fillStyle = P.vgrad(c, y - 6, y, o.c, 0.2, -0.3); P.rr(c, x - 13, y - 6, 26, 6, 2); c.fill();
      c.beginPath(); c.arc(x, cy, 13, 0, Math.PI * 2); P.ballFill(c, x, cy, 13, o.c, 0.35, -0.4);
      c.beginPath(); c.arc(x, cy, 10, 0, Math.PI * 2); c.fillStyle = '#f6f1e6'; c.fill();
      c.fillStyle = '#3a3330'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.fillRect(x + Math.cos(a) * 8.2 - 0.5, cy + Math.sin(a) * 8.2 - 0.5, 1, 1); }
      const ha = (o.hh / 12) * Math.PI * 2 - Math.PI / 2, ma = (o.mm / 12) * Math.PI * 2 - Math.PI / 2;
      c.strokeStyle = '#2a2420'; c.lineCap = 'round'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, cy); c.lineTo(x + Math.cos(ha) * 5, cy + Math.sin(ha) * 5); c.stroke();
      c.lineWidth = 1; c.beginPath(); c.moveTo(x, cy); c.lineTo(x + Math.cos(ma) * 8, cy + Math.sin(ma) * 8); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.3)'; P.ell(c, x - 4, cy - 5, 4, 2, -0.5); c.fill();
    },
  });
  SC.type('candle', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y - 18, r: 16 }),
    muts: [
      { k: 'light', d: 2, w: 1, apply: o => ({ ...o, lit: o.lit ? 0 : 1 }), at: o => ({ x: o.x, y: o.y - 32, r: 15 }) },
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }), at: o => ({ x: o.x, y: o.y - 14, r: 11 }) },
    ],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 3, y - 1, 10, 3, 0.45);
      c.fillStyle = P.hgrad(c, x - 9, x + 9, '#b8892d', 0.4, -0.3); P.rr(c, x - 9, y - 4, 18, 4, 2); c.fill();
      c.fillStyle = P.hgrad(c, x - 4, x + 4, o.c, 0.25, -0.25); c.fillRect(x - 4, y - 26, 8, 22);
      c.strokeStyle = '#2a2420'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y - 26); c.lineTo(x, y - 29); c.stroke();
      if (o.lit) {
        const g = c.createRadialGradient(x, y - 32, 1, x, y - 32, 14); g.addColorStop(0, 'rgba(255,220,140,.6)'); g.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = g; c.fillRect(x - 14, y - 46, 28, 28);
        c.beginPath(); c.moveTo(x, y - 38); c.quadraticCurveTo(x + 3.2, y - 31, x, y - 28.5); c.quadraticCurveTo(x - 3.2, y - 31, x, y - 38); c.fillStyle = '#ffd56a'; c.fill();
        P.ell(c, x, y - 31, 1, 1.8); c.fillStyle = '#fff6d8'; c.fill();
      }
    },
  });
  SC.type('stack', {
    z: 21,
    bb: o => ({ x: o.x, y: o.y - 12, r: 22 }),
    muts: [
      { k: 'color', d: 3, w: 1, apply: (o, rnd, lv) => ({ ...o, bk: o.bk.map((b, i) => (i === 1 ? [b[0], b[1], shift(rnd, b[2], lv)] : b)) }), at: o => ({ x: o.x, y: o.y - o.bk[0][1] - o.bk[1][1] / 2, r: o.bk[1][0] / 2 + 3 }) },
      { k: 'remove', d: 2, w: 1, apply: o => ({ ...o, bk: o.bk.slice(0, 2) }), at: o => ({ x: o.x + 2, y: o.y - o.bk[0][1] - o.bk[1][1] - o.bk[2][1] / 2, r: o.bk[2][0] / 2 + 3 }) },
    ],
    draw(c, o, X) {
      let y = o.y;
      P.shadow(c, o.x + 4, y - 1, 22, 3.5, 0.45);
      o.bk.forEach(([w, h, col], i) => {
        const x = o.x - w / 2 + (i - 1) * 2;
        c.fillStyle = P.vgrad(c, y - h, y, col, 0.25, -0.3); c.fillRect(x, y - h, w, h);
        c.fillStyle = '#efe6cf'; c.fillRect(x + w - 2.5, y - h + 1, 2.5, h - 2);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y - 0.8, w, 0.8);
        y -= h;
      });
      void X;
    },
  });
  SC.type('cat', {
    z: 22,
    bb: o => ({ x: o.x, y: o.y - 15, r: 16 }),
    muts: [
      { k: 'color', d: 2, w: 1, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, Math.max(lv, 2)) }) },
      { k: 'part', d: 4, w: 0.8, apply: o => ({ ...o, tail: 0 }), at: o => ({ x: o.x + 10, y: o.y - 8, r: 9 }) },
    ],
    draw(c, o) {
      const { x, y } = o;
      P.shadow(c, x + 3, y - 1, 12, 3, 0.45);
      if (o.tail) { c.strokeStyle = P.lit(o.c, -0.1); c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 6, y - 2); c.quadraticCurveTo(x + 15, y - 4, x + 12, y - 14); c.stroke(); }
      c.beginPath(); c.moveTo(x - 8, y); c.quadraticCurveTo(x - 9, y - 16, x - 3, y - 18); c.lineTo(x + 3, y - 18); c.quadraticCurveTo(x + 9, y - 16, x + 8, y); c.closePath();
      c.fillStyle = P.hgrad(c, x - 9, x + 9, o.c, 0.3, -0.35); c.fill();
      c.beginPath(); c.arc(x, y - 22, 6, 0, Math.PI * 2); P.ballFill(c, x, y - 22, 6, o.c, 0.3, -0.4);
      c.fillStyle = P.lit(o.c, -0.2); c.beginPath(); c.moveTo(x - 6, y - 25); c.lineTo(x - 5, y - 31); c.lineTo(x - 1.5, y - 27); c.fill(); c.beginPath(); c.moveTo(x + 6, y - 25); c.lineTo(x + 5, y - 31); c.lineTo(x + 1.5, y - 27); c.fill();
      c.fillStyle = '#e8d24a'; c.fillRect(x - 3.2, y - 23, 1.6, 1.6); c.fillRect(x + 1.6, y - 23, 1.6, 1.6);
    },
  });
});
