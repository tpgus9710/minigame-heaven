/* 🍎 과일 가게 — 줄무늬 차양 · 백열전구 · 칠판 · 나무 상자 가득 과일 · 가격표 (spot-core.js 장면) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other, digitSwap, charX } = U;
  const FRUIT = {
    apple: { name: '사과', c: ['#c62a2f', '#b51f2a', '#d23a2c'], r: 1, leaf: 0.5 },
    gapple: { name: '풋사과', c: ['#93c13d', '#8bb839'], r: 1, leaf: 0.4 },
    orange: { name: '오렌지', c: ['#f08a1c', '#ef7f14'], r: 1.02, leaf: 0.25 },
    lemon: { name: '레몬', c: ['#f2d22a', '#f5da3a'], r: 0.92, leaf: 0.3 },
    lime: { name: '라임', c: ['#74b230', '#6aa82c'], r: 0.86, leaf: 0 },
    plum: { name: '자두', c: ['#5e2550', '#6a2a5c'], r: 0.84, leaf: 0.2 },
    tomato: { name: '토마토', c: ['#d9341f', '#e0402a'], r: 0.98, leaf: 0 },
    peach: { name: '복숭아', c: ['#f3a16a', '#f29a66'], r: 1, leaf: 0.45 },
  };
  const KINDS = Object.keys(FRUIT);
  const AWN = [['#2f6f4e', '#f1e9d6'], ['#b8323a', '#f3ebdc'], ['#2c5a8f', '#f0eadb'], ['#c9832a', '#f4ecd9']];
  const price = rnd => `${rint(rnd, 1, 9)},${pick(rnd, ['000', '500', '900', '800'])}`;
  /** 글자 바꾸기 → 바뀐 글자 자리에 정답 원 (o.di: 바뀐 글자 번호) */
  const swapText = key => (o, rnd) => { const [s, i] = digitSwap(rnd, o[key]); return i < 0 ? undefined : { ...o, [key]: s, di: i }; };

  SC.scene('fruit', {
    name: '🍎 과일 가게',
    tone: () => '#ffc27a',
    build(rnd, lv) {
      const objs = [], awn = pick(rnd, AWN), K = rint(rnd, 9, 11), sw = 400 / K;
      for (let i = 0; i < K; i++) objs.push({ t: 'stripe', x: n1(i * sw), y: 0, w: n1(sw), c: awn[i % 2], sc: 1 });
      const nb = rint(rnd, 2, 3);
      for (let i = 0; i < nb; i++) objs.push({ t: 'bulb', x: n1(40 + (i + 0.5) * (320 / nb) + (rnd() - 0.5) * 30), y: n1(54 + rnd() * 14), on: 1, c: '#ffd27a' });
      const bx = rnd() < 0.5 ? rint(rnd, 12, 40) : rint(rnd, 250, 285);
      objs.push({ t: 'board', x: bx, y: 40, w: 104, h: 60, item: pick(rnd, KINDS), num: rint(rnd, 2, 5), pr: price(rnd), doodle: pick(rnd, ['star', 'heart', 'smile']), fc: pick(rnd, ['#8a5a2b', '#6b4426', '#9c6b3a']) });
      // 상자 두 줄 (뒤 4개 · 앞 3개)
      const rows = [{ n: 4, y: 102, h: 80, w: 88, gap: 8, fr: 10.5 + (lv > 3 ? -1 : 0), rows: 2 }, { n: 3, y: 184, h: 112, w: 122, gap: 9, fr: 14 + (lv > 3 ? -1.5 : 0), rows: 3 }];
      const kinds = U.shuffle(rnd, KINDS);
      let ki = 0;
      for (const row of rows) {
        const x0 = (400 - row.n * row.w - (row.n - 1) * row.gap) / 2;
        for (let j = 0; j < row.n; j++) {
          const x = n1(x0 + j * (row.w + row.gap)), k = kinds[ki++ % kinds.length], F = FRUIT[k];
          const plank = row.y + row.h - (row.rows === 3 ? 30 : 22), wood = pick(rnd, ['#b9874e', '#a87742', '#c49358']);
          objs.push({ t: 'crateb', x, y: row.y, w: row.w, h: row.h, c: wood, bgo: 1 });
          objs.push({ t: 'cratef', x, y: plank, w: row.w, h: row.y + row.h - plank, c: wood, lab: pick(rnd, ['국산', '산지직송', '특품', 'FRESH']), lc: pick(rnd, ['#2f6f4e', '#b8323a', '#2c5a8f', '#3a3a3a']), nails: 1 });
          const r = n1(row.fr * F.r), cols = Math.floor((row.w - 10) / (r * 1.86)), lines = row.rows + 1;
          for (let q = 0; q < lines; q++) {
            const off = q % 2 ? r * 0.93 : 0, n = cols - (q % 2 ? 1 : 0);
            for (let m = 0; m < n; m++) {
              const fx = n1(x + 6 + r + off + m * r * 1.86 + (rnd() - 0.5) * 2.4), fy = n1(row.y + 8 + r * 0.6 + q * r * 1.45 + (rnd() - 0.5) * 2);
              if (fy - r > plank - 4) continue;
              objs.push({ t: 'fruit', k, x: fx, y: fy, r: n1(r * (0.94 + rnd() * 0.1)), c: pick(rnd, F.c), stem: k === 'lime' ? 0 : 1, leaf: rnd() < F.leaf ? 1 : 0, lr: rnd() < 0.5 ? -1 : 1, vis: fy + r * 0.25 < plank ? 1 : 0, bruise: 0 });
            }
          }
          objs.push({ t: 'tag', x: n1(x + 10 + rnd() * (row.w - 50)), y: n1(row.y + (row.rows === 3 ? 4 : 0)), name: F.name, pr: price(rnd), c: pick(rnd, ['#f6f1e4', '#efe0b8', '#fdf6d8']), rot: n1((rnd() - 0.5) * 10) });
        }
      }
      return { bg: { awn, wall: pick(rnd, ['#4a3426', '#3e2c22', '#54392a']), sw }, objs };
    },
    back(c, bg, X) {
      c.fillStyle = bg.wall; c.fillRect(0, 0, 400, 300);
      for (let x = 0; x < 400; x += 26) {                          // 세로 판자
        c.beginPath(); c.rect(x, 26, 25, 160);
        c.fillStyle = P.hgrad(c, x, x + 25, bg.wall, 0.08, -0.25); c.fill();
        X.tex(c, 11 + x, 0.35, 'overlay', 18, 0.18, 2.5);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 25, 26, 1.2, 160);
      }
      const g = c.createLinearGradient(0, 90, 0, 190); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
      c.fillStyle = g; c.fillRect(0, 90, 400, 100);
      c.fillStyle = P.vgrad(c, 176, 300, '#5a3a24', 0.05, -0.35); c.fillRect(0, 178, 400, 122);   // 진열대
      c.beginPath(); c.rect(0, 178, 400, 122); X.tex(c, 77, 0.3, 'overlay', 20, 3, 0.3);
    },
  });

  /* 차양 줄무늬 하나 (아래 반원 장식) */
  SC.type('stripe', {
    z: 60,
    bb: o => ({ x: o.x + o.w / 2, y: 22, r: Math.sqrt((o.w / 2) * (o.w / 2) + 24 * 24) + 1 }),
    muts: [
      { k: 'color', d: 2, w: 1.2, apply: (o, rnd, lv) => ({ ...o, c: shift(rnd, o.c, lv) }) },
      { k: 'part', d: 3, w: 1, apply: o => ({ ...o, sc: 0 }), at: o => ({ x: o.x + o.w / 2, y: 33, r: o.w / 2 }) },
    ],
    draw(c, o) {
      const { x, w } = o;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w, 28);
      if (o.sc) c.arc(x + w / 2, 28, w / 2, 0, Math.PI); else c.lineTo(x, 28);
      c.closePath();
      const g = c.createLinearGradient(0, 0, 0, 30 + w / 2); g.addColorStop(0, P.lit(o.c, -0.35)); g.addColorStop(0.6, o.c); g.addColorStop(1, P.lit(o.c, -0.12));
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 0.8; c.stroke();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, 0, w, 6);
      c.beginPath(); c.moveTo(x, 28); c.lineTo(x + w, 28); c.lineTo(x + w, 31); c.lineTo(x, 31); c.fillStyle = 'rgba(0,0,0,.08)'; c.fill();
    },
  });
  SC.type('bulb', {
    z: 55,
    bb: o => U.union({ x: o.x, y: (o.y + 26) / 2, r: (o.y - 26) / 2 + 8 }, { x: o.x, y: o.y + 4, r: 24 }),
    muts: [
      { k: 'light', d: 2, w: 1, apply: o => ({ ...o, on: o.on ? 0 : 1 }), at: o => ({ x: o.x, y: o.y + 4, r: 24 }) },
      { k: 'remove', d: 1, w: 0.7, apply: () => null },
    ],
    draw(c, o) {
      const { x, y } = o;
      if (o.on) { const g = c.createRadialGradient(x, y + 4, 2, x, y + 4, 22); g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y + 4, 22, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = '#1d1a18'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x, 26); c.lineTo(x, y - 6); c.stroke();
      c.fillStyle = '#2b2622'; P.rr(c, x - 3.2, y - 8, 6.4, 6, 1.2); c.fill();
      c.beginPath(); c.moveTo(x - 3, y - 2); c.bezierCurveTo(x - 9, y + 4, x - 7, y + 14, x, y + 14); c.bezierCurveTo(x + 7, y + 14, x + 9, y + 4, x + 3, y - 2); c.closePath();
      if (o.on) { const g = c.createRadialGradient(x, y + 6, 1, x, y + 6, 9); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.5, '#ffd77c'); g.addColorStop(1, '#e8a43c'); c.fillStyle = g; }
      else { c.fillStyle = 'rgba(190,190,180,.55)'; }
      c.fill();
      c.strokeStyle = o.on ? 'rgba(255,240,200,.9)' : 'rgba(80,70,60,.8)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x - 2, y + 1); c.lineTo(x - 1, y + 8); c.lineTo(x + 1, y + 6); c.lineTo(x + 2, y + 1); c.stroke();
    },
  });
  SC.type('board', {
    z: 45,
    bb: o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: o.w / 2 }),
    muts: [
      { k: 'text', d: 3, w: 1.1, apply: swapText('pr'), at: (o, nb) => ({ x: charX(nb.pr + '원', nb.di, 13, o.x + o.w / 2), y: o.y + 45, r: 10 }) },
      { k: 'count', d: 3, w: 0.8, apply: o => ({ ...o, num: o.num === 2 ? 3 : o.num - 1 }), at: o => { const s = boardLine(o); return { x: charX(s, s.length - 2, 10, o.x + o.w / 2 + 2), y: o.y + 29, r: 10 }; } },
      { k: 'part', d: 2, w: 0.9, apply: o => ({ ...o, doodle: o.doodle === 'star' ? 'heart' : o.doodle === 'heart' ? 'smile' : 'star' }), at: o => ({ x: o.x + o.w - 15, y: o.y + 15, r: 11 }) },
    ],
    draw(c, o, X) {
      const { x, y, w, h } = o;
      P.shadow(c, x + w / 2 + 4, y + h + 2, w * 0.55, 6, 0.4);
      P.rr(c, x - 4, y - 4, w + 8, h + 8, 3); c.fillStyle = P.vgrad(c, y - 4, y + h + 4, o.fc, 0.18, -0.3); c.fill();
      X.tex(c, 501, 0.4, 'overlay', 16, 3, 0.3);
      c.fillStyle = '#1f2a24'; c.fillRect(x, y, w, h);
      c.beginPath(); c.rect(x, y, w, h); X.tex(c, 502, 0.5, 'soft-light', 10);
      c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(x + 4, y + 6, w - 20, h - 14);
      const chalk = 'rgba(244,240,228,.92)';
      P.mono(c, '오늘의 특가', x + 8, y + 13, 10.5, chalk, 700, 'left');
      P.mono(c, boardLine(o), x + w / 2 + 2, y + 29, 10, '#ffd36b', 700);
      P.mono(c, `${o.pr}원`, x + w / 2, y + 45, 13, chalk, 900);
      const dx = x + w - 15, dy = y + 15;
      c.strokeStyle = 'rgba(255,170,170,.9)'; c.fillStyle = 'rgba(255,170,170,.9)'; c.lineWidth = 1.2;
      if (o.doodle === 'star') { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 2.6 : 6; c.lineTo(dx + Math.cos(a) * rr, dy + Math.sin(a) * rr); } c.closePath(); c.stroke(); }
      else if (o.doodle === 'heart') { c.beginPath(); c.moveTo(dx, dy + 5); c.bezierCurveTo(dx - 8, dy - 1, dx - 3, dy - 7, dx, dy - 2); c.bezierCurveTo(dx + 3, dy - 7, dx + 8, dy - 1, dx, dy + 5); c.stroke(); }
      else { c.beginPath(); c.arc(dx, dy, 5.5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(dx, dy + 0.5, 3, 0.2, Math.PI - 0.2); c.stroke(); c.fillRect(dx - 2.4, dy - 2.2, 1.3, 1.3); c.fillRect(dx + 1.1, dy - 2.2, 1.3, 1.3); }
    },
  });
  function boardLine(o) { return `${FRUIT[o.item].name} ${o.num}개`; }
  SC.type('crateb', {
    z: 10,
    bb: o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: o.w / 2 }),
    muts: [],
    draw(c, o, X) {
      const { x, y, w, h } = o;
      P.shadow(c, x + w / 2 + 5, y + h, w * 0.6, 8, 0.5);
      c.fillStyle = P.lit(o.c, -0.35); c.fillRect(x, y, w, h);
      c.beginPath(); c.rect(x, y, w, h); X.tex(c, 300 + (o.id % 6), 0.45, 'overlay', 14, 4, 0.35);
      const g = c.createLinearGradient(0, y, 0, y + h * 0.6); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
      c.fillStyle = g; c.fillRect(x + 4, y + 2, w - 8, h - 4);
      c.fillStyle = P.lit(o.c, -0.1); c.fillRect(x, y, 4, h); c.fillRect(x + w - 4, y, 4, h);
    },
  });
  SC.type('cratef', {
    z: 30,
    bb: o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.max(o.h, 20) }),
    cover: (o, x, y) => x > o.x && x < o.x + o.w && y > o.y - 2 && y < o.y + o.h,
    muts: [
      { k: 'color', d: 2, w: 0.9, apply: (o, rnd, lv) => ({ ...o, lc: other(rnd, ['#2f6f4e', '#b8323a', '#2c5a8f', '#3a3a3a', '#c9832a'], o.lc, lv) }), at: o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.min(o.w - 26, 52) / 2 + 3 }) },
      { k: 'text', d: 3, w: 0.8, apply: o => ({ ...o, lab: o.lab === '국산' ? '수입' : o.lab === '특품' ? '특상' : o.lab === 'FRESH' ? 'FRESK' : '산지배송' }), at: o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.min(o.w - 26, 52) / 2 + 2 }) },
      { k: 'part', d: 4, w: 0.7, apply: o => ({ ...o, nails: 0 }), at: o => ({ x: o.x + 5, y: o.y + o.h / 2, r: 9 }) },
    ],
    draw(c, o, X) {
      const { x, y, w, h } = o;
      c.fillStyle = P.vgrad(c, y, y + h, o.c, 0.16, -0.2); c.fillRect(x, y, w, h);
      c.beginPath(); c.rect(x, y, w, h); X.tex(c, 900 + (Math.round(o.x) % 7), 0.55, 'overlay', 12, 5, 0.3);
      c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x, y + h / 2 - 0.5, w, 1.2);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, w, 1.4);
      const lw = Math.min(w - 26, 52), lh = Math.min(h - 8, 16), lx = x + w / 2 - lw / 2, ly = y + h / 2 - lh / 2;
      c.globalAlpha = 0.85; P.rr(c, lx, ly, lw, lh, 2); c.fillStyle = o.lc; c.fill(); c.globalAlpha = 1;
      P.mono(c, o.lab, x + w / 2, y + h / 2 + 0.5, Math.min(9, lh - 6, (lw - 6) / U.textW(o.lab, 1)), 'rgba(250,246,236,.95)', 900);
      c.fillStyle = '#2a2420';
      const nl = (nx, ny) => { c.beginPath(); c.arc(nx, ny, 1.8, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(nx - 0.5, ny - 0.5, 0.6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2a2420'; };
      if (o.nails) { nl(x + 5, y + h / 2 - 5); nl(x + 5, y + h / 2 + 5); }
      nl(x + w - 5, y + h / 2 - 5); nl(x + w - 5, y + h / 2 + 5);
    },
  });
  /** 과일 몸 · 잎 자리 (정답 원) — 잎은 꼭지 끝에서 왼쪽 · 오른쪽 위로 */
  const bodyR = o => o.r * (o.k === 'lemon' ? 1.24 : o.k === 'lime' ? 1.12 : 1.1) + 3;
  const leafC = o => ({ x: o.x + o.r * 0.12 + o.lr * o.r * 0.42, y: o.y - o.r * 1.1, r: o.r * 0.5 + 3 });
  const fruitBB = o => U.union({ x: o.x + o.r * 0.08, y: o.y + o.r * 0.08, r: bodyR(o) }, o.leaf ? leafC(o) : { x: o.x + o.r * 0.2, y: o.y - o.r * 1.02, r: 3 });
  SC.type('fruit', {
    z: 20,
    bb: fruitBB,
    muts: [
      { k: 'color', d: 2, w: 2.2, ok: o => o.vis, apply: (o, rnd, lv) => ({ ...o, c: lv < 2 ? FRUIT[pick(rnd, KINDS.filter(k => k !== o.k && U.cdist(FRUIT[k].c[0], o.c) > 160))].c[0] : shift(rnd, o.c, lv) }) },
      { k: 'remove', d: 1, w: 1.6, ok: o => o.vis, apply: () => null },
      { k: 'swap', d: 2, w: 1.4, ok: o => o.vis, apply: (o, rnd, lv) => { const near = KINDS.filter(k => k !== o.k && (lv < 2.5 ? U.cdist(FRUIT[k].c[0], o.c) > 150 : U.cdist(FRUIT[k].c[0], o.c) < 170)); const k = pick(rnd, near.length ? near : KINDS.filter(k => k !== o.k)); return { ...o, k, c: FRUIT[k].c[0], leaf: 0, stem: k === 'lime' ? 0 : 1 }; } },
      { k: 'leaf', d: 3, w: 1.2, ok: o => o.vis && o.r >= 12.5 && o.k !== 'lime' && o.k !== 'tomato', apply: o => ({ ...o, leaf: o.leaf ? 0 : 1 }), at: o => leafC(o) },
      { k: 'spot', d: 4, w: 0.8, ok: o => o.vis && o.r >= 11 && o.k !== 'plum', apply: o => ({ ...o, bruise: 1 }), at: o => ({ x: o.x + o.r * 0.25, y: o.y + o.r * 0.1, r: Math.max(9, o.r * 0.7) }) },
      { k: 'size', d: 3, w: 0.8, ok: o => o.vis, apply: o => ({ ...o, r: n1(o.r * 0.78) }), at: o => fruitBB(o) },
    ],
    draw(c, o, X) {
      const { x, y, r, k } = o, col = o.c;
      P.shadow(c, x + r * 0.3, y + r * 0.72, r * 1.08, r * 0.5, 0.42);
      c.beginPath();
      if (k === 'lemon' || k === 'lime') {
        const L = k === 'lemon' ? 1.22 : 1.1;
        c.moveTo(x - r * L, y); c.bezierCurveTo(x - r * L * 0.9, y - r * 0.95, x + r * L * 0.9, y - r * 0.95, x + r * L, y); c.bezierCurveTo(x + r * L * 0.9, y + r * 0.95, x - r * L * 0.9, y + r * 0.95, x - r * L, y);
      } else if (k === 'apple' || k === 'gapple') c.ellipse(x, y + r * 0.03, r * 1.05, r * 0.96, 0, 0, Math.PI * 2);
      else if (k === 'tomato') c.ellipse(x, y + r * 0.05, r * 1.06, r * 0.9, 0, 0, Math.PI * 2);
      else c.arc(x, y, r, 0, Math.PI * 2);
      P.ballFill(c, x, y, r, col, k === 'plum' ? 0.3 : 0.4, -0.55);
      if (k === 'orange' || k === 'lemon' || k === 'lime') X.tex(c, 41, 0.35, 'multiply', 3, 0.6, 0.6, 64);
      if (k === 'peach') { c.save(); c.clip(); const g = c.createRadialGradient(x + r * 0.35, y + r * 0.2, 0, x + r * 0.35, y + r * 0.2, r); g.addColorStop(0, 'rgba(225,70,60,.5)'); g.addColorStop(1, 'rgba(225,70,60,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore(); c.strokeStyle = P.rgba(P.lit(col, -0.4), 0.5); c.lineWidth = 0.9; c.beginPath(); c.moveTo(x - r * 0.1, y - r * 0.9); c.quadraticCurveTo(x - r * 0.45, y, x - r * 0.05, y + r * 0.85); c.stroke(); }
      if (k === 'apple' || k === 'gapple') {
        const R = X.R(o.id); c.save(); c.clip(); c.globalAlpha = 0.16; c.strokeStyle = P.lit(col, k === 'apple' ? 0.55 : 0.4); c.lineWidth = 0.9;
        for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36 + R() * 0.15; c.beginPath(); c.moveTo(x + a * r * 0.2, y - r * 0.6); c.quadraticCurveTo(x + a * r * 1.25, y, x + a * r * 0.55, y + r * 0.9); c.stroke(); }
        c.restore();
        P.ell(c, x + r * 0.05, y - r * 0.62, r * 0.3, r * 0.1); c.fillStyle = P.rgba(P.lit(col, -0.65), 0.55); c.fill();
      }
      if (k === 'plum') { c.save(); c.clip(); c.globalAlpha = 0.22; c.fillStyle = '#c9c3d8'; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore(); c.strokeStyle = 'rgba(30,8,30,.4)'; c.lineWidth = 0.8; c.beginPath(); c.arc(x + r * 0.9, y - r * 0.2, r * 0.95, Math.PI * 0.8, Math.PI * 1.15); c.stroke(); }
      if (o.bruise) { P.ell(c, x + r * 0.25, y + r * 0.1, r * 0.34, r * 0.26, 0.4); c.fillStyle = 'rgba(70,40,20,.55)'; c.fill(); }
      if (k === 'tomato') {
        c.fillStyle = '#3f7a2a'; c.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.12 : r * 0.42; c.lineTo(x + Math.cos(a) * rr, y - r * 0.68 + Math.sin(a) * rr * 0.55); }
        c.closePath(); c.fill();
      }
      if (o.stem && k !== 'tomato') { c.strokeStyle = '#4e3218'; c.lineWidth = Math.max(1.1, r * 0.11); c.lineCap = 'round'; c.beginPath(); c.moveTo(x + r * 0.05, y - r * 0.66); c.quadraticCurveTo(x + r * 0.08, y - r * 0.95, x + r * 0.26, y - r * 1.08); c.stroke(); }
      if (o.leaf) {
        c.save(); c.translate(x + r * 0.14, y - r * 0.95); c.scale(o.lr, 1); c.rotate(-0.42);
        c.beginPath(); c.moveTo(-r * 0.05, 0); c.quadraticCurveTo(r * 0.36, -r * 0.42, r * 0.86, -r * 0.02); c.quadraticCurveTo(r * 0.38, r * 0.34, -r * 0.05, 0);
        const g = c.createLinearGradient(0, -r * 0.4, 0, r * 0.3); g.addColorStop(0, '#6fae3a'); g.addColorStop(1, '#2f6a22'); c.fillStyle = g; c.fill();
        c.strokeStyle = 'rgba(220,255,180,.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 0.75, -r * 0.03); c.stroke();
        c.restore();
      }
      P.spec(c, x, y, r, k === 'plum' ? 0.25 : 0.42);
    },
  });
  SC.type('tag', {
    z: 40,
    bb: o => ({ x: o.x + 17, y: o.y + 8, r: 19 }),
    muts: [
      { k: 'text', d: 3, w: 1.3, apply: swapText('pr'), at: (o, nb) => ({ x: o.x + 17 + (charX(nb.pr, nb.di, 9.5, 0)), y: o.y + 12.8, r: 9 }) },
      { k: 'color', d: 2, w: 0.8, apply: (o, rnd, lv) => ({ ...o, c: other(rnd, ['#f6f1e4', '#efe0b8', '#fdf6d8', '#ffd1d1', '#d4ecff', '#d9f2c9'], o.c, Math.max(lv, 2.5)) }) },
      { k: 'remove', d: 1, w: 0.6, apply: () => null },
      { k: 'rot', d: 3, w: 0.6, apply: o => ({ ...o, rot: n1(o.rot > 0 ? o.rot - 16 : o.rot + 16) }) },
    ],
    draw(c, o) {
      c.translate(o.x + 17, o.y + 8); c.rotate(o.rot * Math.PI / 180);
      c.strokeStyle = '#a07a4a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 8); c.lineTo(1, 20); c.stroke();
      c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 3; c.shadowOffsetX = 1.5; c.shadowOffsetY = 2;
      P.rr(c, -17, -9, 34, 19, 2); c.fillStyle = o.c; c.fill();
      c.shadowColor = 'transparent';
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 0.6; c.stroke();
      P.mono(c, o.name, 0, -3.5, 6.5, '#5b4a36', 700);
      P.mono(c, o.pr, 0, 4.8, 9.5, '#b8232c', 900);
    },
  });
});
