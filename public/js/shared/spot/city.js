/* 🌃 밤의 도시 — 빌딩 창문 불빛 · 옥상 안테나 · 간판 · 달 · 별 · 강변 도로 (spot-core.js 장면) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f; else f(root.SpotCore); })(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';
  const { U, P } = SC, { pick, rint, n1, shift, other } = U;
  const GROUND = 232;
  const FACADE = ['#2a3142', '#33303a', '#263a44', '#3a3a46', '#2e2a36', '#24303c', '#3c3530'];
  const SIGNS = [['CAFE', 'CAKE'], ['HOTEL', 'MOTEL'], ['24H', '12H'], ['BAR', 'BAT'], ['치킨', '피자'], ['노래방', '놀이방'], ['PC방', 'PS방'], ['BANK', 'BARK']];
  const NEON = ['#ff4d8d', '#38e0ff', '#ffd23f', '#7cff6b', '#c77dff', '#ff7a3d'];

  /** 빌딩 창문 칸 (x, y, w, h) — 정답 원 계산 · 그리기가 같이 써요 */
  function cell(o, r, k) { return { x: o.x + o.mx + k * (o.ww + o.gx), y: o.top + 10 + r * (o.wh + o.gy), w: o.ww, h: o.wh }; }
  SC.scene('city', {
    name: '🌃 밤의 도시',
    tone: () => '#8fb0ff',
    build(rnd, lv) {
      const objs = [], warm = rnd() < 0.6;
      objs.push({ t: 'moon', x: rint(rnd, 40, 360), y: rint(rnd, 28, 52), r: rint(rnd, 13, 17), ph: rnd() < 0.5 ? 'full' : 'cres' });
      let x = rint(rnd, -6, 4);
      const fill = lv > 3 ? 0.55 : 0.45;
      while (x < 396) {
        const w = rint(rnd, 38, 66), top = rint(rnd, 46, 168), ww = rint(rnd, 4, 6), wh = rint(rnd, 5, 7), gx = rint(rnd, 3, 5), gy = rint(rnd, 4, 6);
        const cols = Math.max(2, Math.floor((w - 10 + gx) / (ww + gx))), mx = n1((w - (cols * ww + (cols - 1) * gx)) / 2);
        const rows = Math.max(2, Math.floor((GROUND - top - 18 + gy) / (wh + gy)));
        const lit = Array.from({ length: rows * cols }, () => (rnd() < fill ? 1 : 0));
        const b = { t: 'bldg', x, w, top, c: pick(rnd, FACADE), ww, wh, gx, gy, cols, rows, mx, lit: lit.join(''), wc: warm ? pick(rnd, ['#ffd98a', '#ffe7a8', '#ffcf73']) : pick(rnd, ['#cfe6ff', '#fff2c4']), roof: pick(rnd, ['flat', 'ant', 'ant', 'tank', 'spire']), red: 1 };
        if (rnd() < 0.35 && w >= 44) { const [a] = pick(rnd, SIGNS); b.sign = a; b.sc = pick(rnd, NEON); b.sy = n1(top + 10 + rint(rnd, 1, Math.max(1, rows - 3)) * (wh + gy) - 2); }
        objs.push(b);
        x += w + rint(rnd, 0, 5);
      }
      for (let k = rint(rnd, 6, 10); k > 0; k--) objs.push({ t: 'bstar', x: rint(rnd, 10, 390), y: rint(rnd, 8, 70), s: n1(1.2 + rnd() * 1.1), c: pick(rnd, ['#ffffff', '#cfe0ff', '#ffe6b8']) });
      if (rnd() < 0.7) objs.push({ t: 'plane', x: rint(rnd, 40, 360), y: rint(rnd, 18, 46) });
      for (let k = rint(rnd, 4, 7), i = 0; i < k; i++) objs.push({ t: 'carl', x: n1(20 + (i + rnd() * 0.6) * (360 / k)), y: GROUND + 6, red: rnd() < 0.5 ? 1 : 0 });
      for (let i = 0; i < 6; i++) objs.push({ t: 'lampc', x: n1(30 + i * 68 + (rnd() - 0.5) * 10), y: GROUND + 14, on: 1 });
      return { bg: { sky: pick(rnd, [['#070b1f', '#1f2450', '#5a3a62'], ['#05070f', '#14234a', '#3d4a7a'], ['#0b0a18', '#2a1f48', '#6a3d4f']]), far: rint(rnd, 1, 9999) }, objs };
    },
    back(c, bg, X) {
      const g = c.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, bg.sky[0]); g.addColorStop(0.65, bg.sky[1]); g.addColorStop(1, bg.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, 400, GROUND);
      const R = U.rng(bg.far);
      for (let i = 0; i < 140; i++) { const x = R() * 400, y = R() * 150, a = 0.2 + R() * 0.6; c.fillStyle = `rgba(255,255,255,${a * (1 - y / 170)})`; c.fillRect(x, y, R() < 0.9 ? 0.8 : 1.3, R() < 0.9 ? 0.8 : 1.3); }
      c.beginPath(); c.rect(0, 60, 400, 120); X.tex(c, 33, 0.08, 'screen', 60);
      let x = 0; c.fillStyle = P.mix(bg.sky[2], '#000000', 0.55);                    // 먼 빌딩 그림자
      while (x < 400) { const w = 14 + R() * 26, h = 30 + R() * 70; c.fillRect(x, GROUND - h, w, h); if (R() < 0.3) c.fillRect(x + w / 2 - 1, GROUND - h - 10, 2, 10); x += w; }
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,220,150,.25)'; c.fillRect(R() * 400, GROUND - 10 - R() * 60, 1.4, 1.6); }
      const hz = c.createLinearGradient(0, GROUND - 80, 0, GROUND); hz.addColorStop(0, 'rgba(255,170,140,0)'); hz.addColorStop(1, 'rgba(255,170,140,.16)');
      c.fillStyle = hz; c.fillRect(0, GROUND - 80, 400, 80);
      // 강변 도로 · 강
      c.fillStyle = '#1b1d24'; c.fillRect(0, GROUND, 400, 12);
      c.fillStyle = 'rgba(255,255,255,.15)'; for (let x2 = 0; x2 < 400; x2 += 22) c.fillRect(x2, GROUND + 5.5, 11, 1);
      c.fillStyle = '#2b2d33'; c.fillRect(0, GROUND + 12, 400, 4);
      const wg = c.createLinearGradient(0, GROUND + 16, 0, 300); wg.addColorStop(0, '#0d1424'); wg.addColorStop(1, '#05080f');
      c.fillStyle = wg; c.fillRect(0, GROUND + 16, 400, 300 - GROUND - 16);
      for (let i = 0; i < 26; i++) {                                                  // 물에 비친 불빛 (일반 무늬)
        const x2 = R() * 400, col = R() < 0.6 ? '255,214,140' : '160,200,255';
        for (let y2 = GROUND + 20; y2 < 296; y2 += 3 + R() * 3) { c.fillStyle = `rgba(${col},${0.08 + R() * 0.2})`; c.fillRect(x2 + (R() - 0.5) * 6, y2, 2 + R() * 9, 1); }
      }
      c.beginPath(); c.rect(0, GROUND + 16, 400, 70); X.tex(c, 34, 0.12, 'overlay', 6, 3, 0.4);
    },
  });
  SC.type('moon', {
    z: 2,
    bb: o => ({ x: o.x, y: o.y, r: o.r + 6 }),
    muts: [
      { k: 'shape', d: 2, w: 1, apply: o => ({ ...o, ph: o.ph === 'full' ? 'cres' : 'full' }) },
      { k: 'size', d: 3, w: 0.6, apply: o => ({ ...o, r: o.r + 4 }) },
    ],
    draw(c, o) {
      const g = c.createRadialGradient(o.x, o.y, 8, o.x, o.y, 50); g.addColorStop(0, 'rgba(230,236,255,.26)'); g.addColorStop(1, 'rgba(230,236,255,0)');   // 달빛은 크기와 상관없이 같게
      c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, 50, 0, Math.PI * 2); c.fill();
      c.save(); c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      if (o.ph === 'cres') { c.arc(o.x + o.r * 0.55, o.y - o.r * 0.25, o.r * 0.92, 0, Math.PI * 2, true); }
      c.clip();
      c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); P.ballFill(c, o.x, o.y, o.r, '#e9e6d6', 0.3, -0.25);
      c.fillStyle = 'rgba(150,145,130,.35)'; P.ell(c, o.x - o.r * 0.3, o.y + o.r * 0.1, o.r * 0.22, o.r * 0.18); c.fill(); P.ell(c, o.x + o.r * 0.2, o.y + o.r * 0.42, o.r * 0.15, o.r * 0.12); c.fill(); P.ell(c, o.x - o.r * 0.05, o.y - o.r * 0.45, o.r * 0.12, o.r * 0.1); c.fill();
      c.restore();
    },
  });
  SC.type('bstar', {
    z: 3,
    bb: o => ({ x: o.x, y: o.y, r: 9 }),
    muts: [
      { k: 'remove', d: 3, w: 0.8, apply: () => null },
      { k: 'color', d: 4, w: 0.4, apply: o => ({ ...o, c: o.c === '#ffffff' ? '#ffb38a' : '#ffffff', s: o.s + 0.4 }) },
    ],
    draw(c, o) {
      const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.s * 4); g.addColorStop(0, P.rgba(o.c, 0.9)); g.addColorStop(1, P.rgba(o.c, 0));
      c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, o.s * 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = P.rgba(o.c, 0.7); c.lineWidth = 0.6; c.beginPath(); c.moveTo(o.x - o.s * 4, o.y); c.lineTo(o.x + o.s * 4, o.y); c.moveTo(o.x, o.y - o.s * 4); c.lineTo(o.x, o.y + o.s * 4); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(o.x, o.y, o.s * 0.7, 0, Math.PI * 2); c.fill();
    },
  });
  SC.type('plane', {
    z: 3,
    bb: o => ({ x: o.x, y: o.y, r: 10 }),
    muts: [{ k: 'remove', d: 2, w: 1, apply: () => null }],
    draw(c, o) {
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(o.x - 1, o.y - 0.6, 2, 1.2);
      c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(o.x - 5, o.y, 1.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4dff7a'; c.beginPath(); c.arc(o.x + 5, o.y, 1.1, 0, Math.PI * 2); c.fill();
      const g = c.createRadialGradient(o.x - 5, o.y, 0, o.x - 5, o.y, 5); g.addColorStop(0, 'rgba(255,60,60,.5)'); g.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = g; c.fillRect(o.x - 10, o.y - 5, 10, 10);
    },
  });
  SC.type('bldg', {
    z: 10,
    bb: o => ({ x: o.x + o.w / 2, y: (o.top + GROUND) / 2, r: (GROUND - o.top) / 2 + o.w / 2 }),
    cover: (o, x, y) => x > o.x && x < o.x + o.w && y > o.top - (o.roof === 'flat' ? 0 : 20) && y < GROUND,
    muts: [
      { k: 'light', d: 2, w: 1.3, ok: o => o.rows >= 3 && o.cols >= 2, apply(o, rnd) {
        const r = rint(rnd, 0, o.rows - 2), k = rint(rnd, 0, o.cols - 2), lit = [...o.lit], ids = [r * o.cols + k, r * o.cols + k + 1, (r + 1) * o.cols + k, (r + 1) * o.cols + k + 1];
        const on = ids.filter(i => lit[i] === '1').length, to = on >= 2 ? '0' : '1';
        ids.forEach(i => { lit[i] = to; });
        if (lit.join('') === o.lit || Math.abs(ids.filter(i => lit[i] === '1').length - on) < 2) return undefined;
        return { ...o, lit: lit.join(''), cr: r, ck: k, cn: 2 };
      }, at(o, nb) { const a = cell(o, nb.cr, nb.ck), b = cell(o, nb.cr + 1, nb.ck + 1); return { x: (a.x + b.x + b.w) / 2, y: (a.y + b.y + b.h) / 2, r: Math.sqrt((b.x + b.w - a.x) * (b.x + b.w - a.x) + (b.y + b.h - a.y) * (b.y + b.h - a.y)) / 2 + 3 }; } },
      { k: 'light', d: 4, w: 0.7, ok: o => o.rows >= 3, apply(o, rnd) {
        const i = rint(rnd, 0, o.lit.length - 1), lit = [...o.lit]; lit[i] = lit[i] === '1' ? '0' : '1';
        return { ...o, lit: lit.join(''), cr: Math.floor(i / o.cols), ck: i % o.cols, cn: 1 };
      }, at(o, nb) { const a = cell(o, nb.cr, nb.ck); return { x: a.x + a.w / 2, y: a.y + a.h / 2, r: 9 }; } },
      { k: 'part', d: 2, w: 1.5, ok: o => o.roof === 'ant' || o.roof === 'flat', apply: o => ({ ...o, roof: o.roof === 'ant' ? 'flat' : 'ant' }), at: o => ({ x: o.x + o.w / 2, y: o.top - 12, r: 14 }) },
      { k: 'light', d: 3, w: 0.8, ok: o => o.roof === 'ant', apply: o => ({ ...o, red: 0 }), at: o => ({ x: o.x + o.w / 2, y: o.top - 24, r: 9 }) },
      { k: 'size', d: 3, w: 0.8, ok: o => o.roof === 'flat' && o.top > 50, apply: o => ({ ...o, top: o.top - o.wh - o.gy, rows: o.rows + 1, lit: '0'.repeat(o.cols) + o.lit }), at: o => ({ x: o.x + o.w / 2, y: o.top - 1.5, r: Math.sqrt(o.w * o.w / 4 + 132) + 2.5 }) },
      { k: 'color', d: 2, w: 1.5, ok: o => !!o.sign, apply: (o, rnd, lv) => ({ ...o, sc: other(rnd, NEON, o.sc, lv) }), at: o => ({ x: o.x + o.w / 2, y: o.sy + 5, r: Math.min(o.w, 40) / 2 + 3 }) },
      { k: 'text', d: 3, w: 1.4, ok: o => !!o.sign, apply: o => ({ ...o, sign: SIGNS.find(p => p[0] === o.sign)[1] }), at: o => ({ x: o.x + o.w / 2, y: o.sy + 5, r: Math.min(o.w, 40) / 2 + 3 }) },
    ],
    draw(c, o, X) {
      const { x, w, top } = o;
      // 옥상
      if (o.roof === 'ant') {
        c.strokeStyle = '#4a4f5c'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + w / 2, top); c.lineTo(x + w / 2, top - 22); c.stroke();
        c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + w / 2 - 5, top - 12); c.lineTo(x + w / 2 + 5, top - 12); c.moveTo(x + w / 2 - 3, top - 17); c.lineTo(x + w / 2 + 3, top - 17); c.stroke();
        if (o.red) { const g = c.createRadialGradient(x + w / 2, top - 23, 0, x + w / 2, top - 23, 6); g.addColorStop(0, 'rgba(255,60,60,.9)'); g.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = g; c.fillRect(x + w / 2 - 6, top - 29, 12, 12); c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(x + w / 2, top - 23, 1.3, 0, Math.PI * 2); c.fill(); }
      } else if (o.roof === 'tank') {
        c.fillStyle = '#3a3f4a'; c.fillRect(x + w * 0.62, top - 12, 3, 12); c.fillRect(x + w * 0.62 + 10, top - 12, 3, 12);
        c.fillStyle = P.hgrad(c, x + w * 0.6, x + w * 0.6 + 16, '#5a4a3c', 0.15, -0.3); c.fillRect(x + w * 0.6, top - 22, 16, 12);
        c.beginPath(); c.moveTo(x + w * 0.6 - 1, top - 22); c.lineTo(x + w * 0.6 + 8, top - 28); c.lineTo(x + w * 0.6 + 17, top - 22); c.fillStyle = '#4a3c30'; c.fill();
      } else if (o.roof === 'spire') {
        c.beginPath(); c.moveTo(x + w * 0.3, top); c.lineTo(x + w / 2, top - 26); c.lineTo(x + w * 0.7, top); c.closePath(); c.fillStyle = P.hgrad(c, x + w * 0.3, x + w * 0.7, o.c, 0.25, -0.3); c.fill();
      }
      // 벽
      c.fillStyle = P.hgrad(c, x, x + w, o.c, 0.12, -0.32); c.fillRect(x, top, w, GROUND - top);
      c.beginPath(); c.rect(x, top, w, GROUND - top); X.tex(c, 50 + (o.id % 4), 0.25, 'overlay', 8, 1, 1);
      c.fillStyle = 'rgba(160,180,230,.18)'; c.fillRect(x, top, 1.5, GROUND - top);
      c.fillStyle = P.lit(o.c, 0.18); c.fillRect(x - 1, top - 2, w + 2, 3);
      // 창문
      for (let r = 0; r < o.rows; r++) for (let k = 0; k < o.cols; k++) {
        const q = cell(o, r, k), on = o.lit[r * o.cols + k] === '1';
        if (q.y + q.h > GROUND - 4) continue;
        if (on) {
          c.fillStyle = P.rgba(o.wc, 0.22); c.fillRect(q.x - 1.5, q.y - 1.5, q.w + 3, q.h + 3);
          const g = c.createLinearGradient(0, q.y, 0, q.y + q.h); g.addColorStop(0, P.lit(o.wc, 0.4)); g.addColorStop(1, o.wc); c.fillStyle = g; c.fillRect(q.x, q.y, q.w, q.h);
        } else { c.fillStyle = 'rgba(12,16,28,.85)'; c.fillRect(q.x, q.y, q.w, q.h); c.fillStyle = 'rgba(120,150,200,.12)'; c.fillRect(q.x, q.y, q.w, q.h * 0.35); }
      }
      if (o.sign) {
        const sw = Math.min(w - 8, Math.max(26, U.textW(o.sign, 8) + 8)), sx = x + w / 2 - sw / 2;
        c.fillStyle = 'rgba(10,10,14,.9)'; P.rr(c, sx, o.sy, sw, 11, 2); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = P.rgba(o.sc, 0.18); P.rr(c, sx - 2, o.sy - 2, sw + 4, 15, 4); c.fill(); c.globalCompositeOperation = 'source-over';
        P.mono(c, o.sign, x + w / 2, o.sy + 5.8, 7.5, o.sc, 900);
        c.strokeStyle = P.rgba(o.sc, 0.8); c.lineWidth = 0.6; P.rr(c, sx, o.sy, sw, 11, 2); c.stroke();
      }
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, GROUND - 6, w, 6);
    },
  });
  SC.type('carl', {
    z: 30,
    bb: o => ({ x: o.x, y: o.y, r: 11 }),
    muts: [
      { k: 'color', d: 3, w: 1, apply: o => ({ ...o, red: o.red ? 0 : 1 }) },
      { k: 'remove', d: 2, w: 0.8, apply: () => null },
    ],
    draw(c, o) {
      const col = o.red ? '255,70,60' : '255,246,220';
      c.fillStyle = 'rgba(20,22,28,.9)'; P.rr(c, o.x - 7, o.y - 3, 14, 5, 2); c.fill();
      const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, 9); g.addColorStop(0, `rgba(${col},.45)`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(o.x - 9, o.y - 9, 18, 18);
      c.fillStyle = `rgb(${col})`; c.fillRect(o.x - 6, o.y - 1, 2.4, 1.6); c.fillRect(o.x + 3.6, o.y - 1, 2.4, 1.6);
    },
  });
  SC.type('lampc', {
    z: 31,
    bb: o => ({ x: o.x, y: o.y + 2, r: 13 }),
    muts: [
      { k: 'light', d: 3, w: 1, apply: o => ({ ...o, on: 0 }) },
      { k: 'remove', d: 2, w: 0.6, apply: () => null },
    ],
    draw(c, o) {
      c.strokeStyle = '#3a3f4a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(o.x, o.y + 12); c.lineTo(o.x, o.y - 2); c.stroke();
      c.fillStyle = '#2a2e36'; c.fillRect(o.x - 2.2, o.y - 4, 4.4, 2.5);
      if (o.on) {
        const g = c.createRadialGradient(o.x, o.y - 1, 0, o.x, o.y - 1, 9); g.addColorStop(0, 'rgba(255,220,150,.7)'); g.addColorStop(1, 'rgba(255,220,150,0)');
        c.fillStyle = g; c.fillRect(o.x - 9, o.y - 10, 18, 18); c.fillStyle = '#fff3c8'; c.fillRect(o.x - 1.5, o.y - 1.6, 3, 1.6);
      }
    },
  });
});
