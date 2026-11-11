/* =====================================================================
 *  🔍 틀린그림찾기 — 씨앗(seed) 하나로 그림(장면)과 「다른 곳」을 똑같이 만들어요.
 *   화면(싱글 · AI 대결)과 서버(멀티: games/spot.js)가 같은 코드를 써서, 서버는 누른 자리가 맞는지만 확인해요.
 *   장면: 🏡 마을 · 🏖️ 바닷가 · 🛋️ 방 (그림 크기 400 × 300) — 물건마다 바꿀 수 있는 곳(색 · 없애기 · 크기 · 방향 · 부분)이 있어요.
 *   다른 곳 n개는 서로 겹치지 않게 고르고, 오른쪽 그림에만 바꿔 그려요. 정답 자리는 원(x, y, r)이에요.
 *   ⚠️ 장면 · 다른 곳을 고를 때는 rnd 와 정수 계산만 써요 (기기마다 sin · cos 끝자리가 달라도 결과가 같게).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpotCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 400, H = 300, OL = '#3b3450';
  const THEMES = ['village', 'sea', 'room'];
  const THEME_NAMES = { village: '🏡 마을', sea: '🏖️ 바닷가', room: '🛋️ 방' };
  /** 씨앗 → 0 ~ 1 난수 (Park–Miller) */
  function rng(seed) {
    let h = Math.abs(Math.floor(seed)) >>> 0;                     // 씨앗을 한 번 잘 섞어요 (비슷한 씨앗도 첫 값부터 고르게)
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
    let s = h % 2147483646 + 1;
    const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
    next(); next();
    return next;
  }
  const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
  const rint = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  /** 색 차이 (R · G · B 차이 합) — 바꾼 색은 이만큼(100) 넘게 달라야 잘 보여요 */
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const cdist = (a, b) => { const x = hex(a), y = hex(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); };
  function other(rnd, list, cur) {
    const far = list.filter(c => c !== cur && (!/^#[0-9a-f]{6}$/i.test(cur) || cdist(c, cur) >= 100));
    if (far.length) return pick(rnd, far);
    return list.filter(c => c !== cur).sort((a, b) => cdist(b, cur) - cdist(a, cur))[0];
  }
  const n1 = v => Math.round(v * 10) / 10;
  const st = (w = 2) => `stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const pts = a => a.map(p => `${n1(p[0])},${n1(p[1])}`).join(' ');
  const flipG = (o, inner) => (o.dir === -1 ? `<g transform="translate(${n1(o.x * 2)},0) scale(-1,1)">${inner}</g>` : inner);

  const PAL = {
    wall: ['#ffd29a', '#fff4dc', '#ffb3b3', '#a9d8ff', '#bfe8a8', '#d9b8ff', '#ffe066'],
    roof: ['#e5534b', '#4a6fe3', '#2f9e74', '#8a5cf6', '#e58a2e', '#7a5236'],
    door: ['#8b5a2b', '#e5534b', '#3b82f6', '#16a34a', '#7c3aed'],
    car: ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ec4899'],
    flower: ['#ff5d8f', '#ffd23f', '#8b7bff', '#ff8a3d', '#ffffff', '#3cc6ff'],
    balloon: ['#ff4d6d', '#ffd23f', '#4dabff', '#5ee07a', '#c77dff', '#ff8a3d'],
    leaf: ['#4caf50', '#3a9d5d', '#7cc242'], autumn: ['#f59e0b', '#ef6c3a', '#d9442b'],
    sail: ['#ffffff', '#ff5d5d', '#ffd23f', '#5aa9ff', '#7ee08a'], hull: ['#c0392b', '#2c6fd1', '#8b5a2b', '#2f9e74'],
    fish: ['#ff8a3d', '#ffd23f', '#ff5d8f', '#5aa9ff', '#8b7bff'],
    pot: ['#d9763a', '#3b82f6', '#e5534b', '#f5f5f5', '#7c3aed'],
    rug: ['#e5534b', '#3b82f6', '#16a34a', '#a855f7', '#f59e0b'],
    book: ['#e5534b', '#3b82f6', '#16a34a', '#f59e0b', '#a855f7', '#0ea5e9', '#ec4899'],
    cat: ['#f5a142', '#9aa0a8', '#3b3b3b', '#f3eadb'],
    shade: ['#ffd23f', '#ff8fa3', '#7dd3fc', '#86efac', '#c4b5fd'],
  };

  /* ───────── 물건마다: z(앞뒤 순서) · bb(자리 원) · draw(그림) · muts(바꿀 수 있는 곳) ─────────
   *  muts: [{ k: 이름, w: 뽑힐 비율, d: 어려움(1 쉬움 ~ 3 어려움), ok(o), apply(o, rnd) → 바뀐 물건(null 이면 없앰), at(o) → 정답 원 }] */
  const T = {};
  const big = (o, k = 1.32) => ({ ...o, s: n1(o.s * k) });
  const removeMut = (w = 2, d = 1) => ({ k: 'remove', w, d, ok: () => true, apply: () => null, at: o => T[o.t].bb(o) });
  const colorMut = (key, list, w = 3, d = 1, at) => ({ k: 'color', w, d, ok: () => true, apply: (o, r) => ({ ...o, [key]: other(r, list, o[key]) }), at: at || (o => T[o.t].bb(o)) });

  /* ─── 하늘 ─── */
  T.sun = {
    z: 1, bb: o => ({ x: o.x, y: o.y, r: 27 * o.s }),
    draw(o) {
      const r = 16 * o.s; let rays = '';
      if (o.rays) for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, c = Math.cos(a), sn = Math.sin(a); rays += `<line x1="${n1(o.x + c * (r + 4))}" y1="${n1(o.y + sn * (r + 4))}" x2="${n1(o.x + c * (r + 11 * o.s))}" y2="${n1(o.y + sn * (r + 11 * o.s))}" stroke="${o.c}" stroke-width="${n1(3 * o.s)}" stroke-linecap="round"/>`; }
      const face = o.face ? `<circle cx="${n1(o.x - 5 * o.s)}" cy="${n1(o.y - 3 * o.s)}" r="${n1(1.8 * o.s)}" fill="${OL}"/><circle cx="${n1(o.x + 5 * o.s)}" cy="${n1(o.y - 3 * o.s)}" r="${n1(1.8 * o.s)}" fill="${OL}"/><path d="M${n1(o.x - 6 * o.s)},${n1(o.y + 3 * o.s)} Q${n1(o.x)},${n1(o.y + 9 * o.s)} ${n1(o.x + 6 * o.s)},${n1(o.y + 3 * o.s)}" fill="none" ${st(1.6)}/>` : '';
      return `${rays}<circle cx="${n1(o.x)}" cy="${n1(o.y)}" r="${n1(r)}" fill="${o.c}" ${st()}/>${face}`;
    },
    muts: [
      { k: 'color', w: 2, d: 1, ok: () => true, apply: o => ({ ...o, c: o.c === '#ffd23f' ? '#ff9636' : '#ffd23f' }), at: o => ({ x: o.x, y: o.y, r: 22 * o.s }) },
      { k: 'rays', w: 2, d: 2, ok: o => o.rays, apply: o => ({ ...o, rays: false }), at: o => T.sun.bb(o) },
      { k: 'face', w: 2, d: 2, ok: o => o.face, apply: o => ({ ...o, face: false }), at: o => ({ x: o.x, y: o.y, r: 15 * o.s }) },
    ],
  };
  T.moon = {
    z: 1, bb: o => ({ x: o.x, y: o.y, r: 20 * o.s }),
    draw: o => `<circle cx="${n1(o.x)}" cy="${n1(o.y)}" r="${n1(16 * o.s)}" fill="${o.c}" ${st()}/><circle cx="${n1(o.x - 5 * o.s)}" cy="${n1(o.y - 4 * o.s)}" r="${n1(3 * o.s)}" fill="rgba(0,0,0,.08)"/><circle cx="${n1(o.x + 5 * o.s)}" cy="${n1(o.y + 5 * o.s)}" r="${n1(2.2 * o.s)}" fill="rgba(0,0,0,.08)"/>`,
    muts: [colorMut('c', ['#fff3b0', '#ffb36b'], 2, 1)],
  };
  T.cloud = {
    z: 2, bb: o => ({ x: o.x, y: o.y, r: 25 * o.s }),
    draw(o) {
      const c = [[-13, 3, 10], [0, -4, 13], [13, 3, 10], [5, 5, 10], [-5, 5, 10]].map(([dx, dy, r]) => [o.x + dx * o.s, o.y + dy * o.s, r * o.s]);
      const out = c.map(([x, y, r]) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r + 1.6)}" fill="#c5d3e3"/>`).join('');
      return out + c.map(([x, y, r]) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${o.c}"/>`).join('');
    },
    muts: [removeMut(2, 1), { k: 'size', w: 1, d: 2, ok: () => true, apply: o => big(o, 1.45), at: o => T.cloud.bb(big(o, 1.45)) }, colorMut('c', ['#ffffff', '#cdd5e1'], 1, 2)],
  };
  T.gull = {
    z: 3, bb: o => ({ x: o.x, y: o.y - 2, r: 12 * o.s }),
    draw: o => `<path d="M${n1(o.x - 10 * o.s)},${n1(o.y)} Q${n1(o.x - 5 * o.s)},${n1(o.y - 8 * o.s)} ${n1(o.x)},${n1(o.y)} Q${n1(o.x + 5 * o.s)},${n1(o.y - 8 * o.s)} ${n1(o.x + 10 * o.s)},${n1(o.y)}" fill="none" ${st(2.4)}/>`,
    muts: [removeMut(2, 2)],
  };
  T.balloon = {
    z: 4, bb: o => ({ x: o.x, y: o.y + 9 * o.s, r: 26 * o.s }),
    draw: o => `<path d="M${n1(o.x)},${n1(o.y + 13 * o.s)} q${n1(-4 * o.s)},${n1(8 * o.s)} ${n1(2 * o.s)},${n1(13 * o.s)} t${n1(1 * o.s)},${n1(8 * o.s)}" fill="none" stroke="${OL}" stroke-width="1.2"/>`
      + `<ellipse cx="${n1(o.x)}" cy="${n1(o.y)}" rx="${n1(10 * o.s)}" ry="${n1(13 * o.s)}" fill="${o.c}" ${st()}/><path d="M${n1(o.x - 2.5 * o.s)},${n1(o.y + 15 * o.s)} L${n1(o.x)},${n1(o.y + 12.5 * o.s)} L${n1(o.x + 2.5 * o.s)},${n1(o.y + 15 * o.s)}Z" fill="${o.c}" ${st(1.3)}/>`
      + `<ellipse cx="${n1(o.x - 3.5 * o.s)}" cy="${n1(o.y - 5 * o.s)}" rx="${n1(2.5 * o.s)}" ry="${n1(4 * o.s)}" fill="#fff" opacity=".55"/>`,
    muts: [colorMut('c', PAL.balloon, 3, 1), removeMut(2, 1)],
  };
  T.bfly = {
    z: 6, bb: o => ({ x: o.x, y: o.y, r: 12 * o.s }),
    draw: o => `<ellipse cx="${n1(o.x - 5 * o.s)}" cy="${n1(o.y - 3 * o.s)}" rx="${n1(5 * o.s)}" ry="${n1(6 * o.s)}" fill="${o.c}" ${st(1.4)}/><ellipse cx="${n1(o.x + 5 * o.s)}" cy="${n1(o.y - 3 * o.s)}" rx="${n1(5 * o.s)}" ry="${n1(6 * o.s)}" fill="${o.c}" ${st(1.4)}/>`
      + `<ellipse cx="${n1(o.x - 4 * o.s)}" cy="${n1(o.y + 4 * o.s)}" rx="${n1(3.5 * o.s)}" ry="${n1(4 * o.s)}" fill="${o.c}" ${st(1.4)}/><ellipse cx="${n1(o.x + 4 * o.s)}" cy="${n1(o.y + 4 * o.s)}" rx="${n1(3.5 * o.s)}" ry="${n1(4 * o.s)}" fill="${o.c}" ${st(1.4)}/>`
      + `<line x1="${n1(o.x)}" y1="${n1(o.y - 7 * o.s)}" x2="${n1(o.x)}" y2="${n1(o.y + 7 * o.s)}" ${st(2.2)}/><path d="M${n1(o.x)},${n1(o.y - 7 * o.s)} l${n1(-3 * o.s)},${n1(-4 * o.s)} M${n1(o.x)},${n1(o.y - 7 * o.s)} l${n1(3 * o.s)},${n1(-4 * o.s)}" fill="none" ${st(1.1)}/>`,
    muts: [colorMut('c', PAL.flower, 2, 2), removeMut(2, 2)],
  };
  T.star = {
    z: 2, bb: o => ({ x: o.x, y: o.y, r: 9 * o.s }),
    draw(o) { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = (k % 2 ? 2.6 : 6.5) * o.s; p.push([o.x + Math.cos(a) * r, o.y + Math.sin(a) * r]); } return `<polygon points="${pts(p)}" fill="${o.c}"/>`; },
    muts: [removeMut(2, 2)],
  };

  /* ─── 🏡 마을 ─── */
  T.house = {
    z: 10, bb: o => ({ x: o.x, y: o.y - 34 * o.s, r: 42 * o.s }),
    draw(o) {
      const s = o.s, w = 62 * s, h = 44 * s, x = o.x, y = o.y;
      const chim = o.ch ? `<rect x="${n1(x + 13 * s)}" y="${n1(y - h - 27 * s)}" width="${n1(9 * s)}" height="${n1(20 * s)}" fill="#b5523b" ${st()}/>` : '';
      const win = (wx, shape) => {
        if (shape === 'none') return '';
        if (shape === 'rd') return `<circle cx="${n1(wx)}" cy="${n1(y - 30 * s)}" r="${n1(6.5 * s)}" fill="#bfe6ff" ${st(1.8)}/><line x1="${n1(wx - 6.5 * s)}" y1="${n1(y - 30 * s)}" x2="${n1(wx + 6.5 * s)}" y2="${n1(y - 30 * s)}" ${st(1.4)}/>`;
        return `<rect x="${n1(wx - 6.5 * s)}" y="${n1(y - 36.5 * s)}" width="${n1(13 * s)}" height="${n1(13 * s)}" fill="#bfe6ff" ${st(1.8)}/><path d="M${n1(wx)},${n1(y - 36.5 * s)} v${n1(13 * s)} M${n1(wx - 6.5 * s)},${n1(y - 30 * s)} h${n1(13 * s)}" ${st(1.4)}/>`;
      };
      return chim + `<rect x="${n1(x - w / 2)}" y="${n1(y - h)}" width="${n1(w)}" height="${n1(h)}" fill="${o.wall}" ${st()}/>`
        + `<polygon points="${pts([[x - w / 2 - 6 * s, y - h], [x, y - h - 30 * s], [x + w / 2 + 6 * s, y - h]])}" fill="${o.roof}" ${st()}/>`
        + `<rect x="${n1(x - 7 * s)}" y="${n1(y - 23 * s)}" width="${n1(14 * s)}" height="${n1(23 * s)}" rx="${n1(2 * s)}" fill="${o.door}" ${st()}/><circle cx="${n1(x + 3.8 * s)}" cy="${n1(y - 11 * s)}" r="${n1(1.5 * s)}" fill="#ffd23f"/>`
        + win(x - 19 * s, o.wl) + win(x + 19 * s, o.wr);
    },
    muts: [
      colorMut('wall', PAL.wall, 3, 1, o => ({ x: o.x, y: o.y - 22 * o.s, r: 38 * o.s })),
      colorMut('roof', PAL.roof, 3, 1, o => ({ x: o.x, y: o.y - 56 * o.s, r: 37 * o.s })),
      colorMut('door', PAL.door, 2, 2, o => ({ x: o.x, y: o.y - 11 * o.s, r: 13 * o.s })),
      { k: 'chimney', w: 2, d: 2, ok: o => o.ch, apply: o => ({ ...o, ch: false }), at: o => ({ x: o.x + 17.5 * o.s, y: o.y - 61 * o.s, r: 12 * o.s }) },
      { k: 'window', w: 2, d: 3, ok: o => o.wl === 'sq', apply: o => ({ ...o, wl: 'rd' }), at: o => ({ x: o.x - 19 * o.s, y: o.y - 30 * o.s, r: 11 * o.s }) },
      { k: 'window', w: 1, d: 2, ok: o => o.wr !== 'none', apply: o => ({ ...o, wr: 'none' }), at: o => ({ x: o.x + 19 * o.s, y: o.y - 30 * o.s, r: 11 * o.s }) },
    ],
  };
  const APPLE = [[-12, -44], [10, -51], [1, -63], [16, -37]];
  T.tree = {
    z: 9, bb: o => ({ x: o.x, y: o.y - 44 * o.s, r: 37 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y, c = [[-14, -41, 16], [14, -41, 16], [0, -57, 19]].map(([dx, dy, r]) => [x + dx * s, y + dy * s, r * s]);
      return `<rect x="${n1(x - 5 * s)}" y="${n1(y - 32 * s)}" width="${n1(10 * s)}" height="${n1(32 * s)}" fill="#8b5a2b" ${st()}/>`
        + c.map(([cx, cy, r]) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r + 1.2)}" fill="${OL}"/>`).join('')
        + c.map(([cx, cy, r]) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r - 0.8)}" fill="${o.c}"/>`).join('')
        + APPLE.map(([dx, dy], i) => (o.ap[i] ? `<circle cx="${n1(x + dx * s)}" cy="${n1(y + dy * s)}" r="${n1(3.8 * s)}" fill="#ff4d4d" ${st(1.2)}/>` : '')).join('');
    },
    muts: [
      { k: 'apple', w: 3, d: 2, ok: o => o.ap.some(Boolean), apply: o => { const i = o.ap.indexOf(true); const ap = o.ap.slice(); ap[i] = false; return { ...o, ap }; }, at: o => { const [dx, dy] = APPLE[o.ap.indexOf(true)]; return { x: o.x + dx * o.s, y: o.y + dy * o.s, r: 9 * o.s }; } },
      { k: 'color', w: 2, d: 1, ok: o => PAL.leaf.includes(o.c), apply: (o, r) => ({ ...o, c: pick(r, PAL.autumn) }), at: o => ({ x: o.x, y: o.y - 48 * o.s, r: 30 * o.s }) },
      { k: 'size', w: 1, d: 2, ok: () => true, apply: o => big(o, 1.25), at: o => T.tree.bb(big(o, 1.25)) },
    ],
  };
  T.pine = {
    z: 9, bb: o => ({ x: o.x, y: o.y - 36 * o.s, r: 30 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y, tri = (top, half, bot) => `<polygon points="${pts([[x, y - top * s], [x - half * s, y - bot * s], [x + half * s, y - bot * s]])}" fill="${o.c}" ${st()}/>`;
      return `<rect x="${n1(x - 4 * s)}" y="${n1(y - 14 * s)}" width="${n1(8 * s)}" height="${n1(14 * s)}" fill="#8b5a2b" ${st()}/>` + tri(44, 22, 12) + tri(58, 17, 30) + tri(70, 12, 46);
    },
    muts: [colorMut('c', ['#2f8f5b', '#1f6f4a', '#8bc34a'], 2, 2, o => ({ x: o.x, y: o.y - 40 * o.s, r: 26 * o.s })), { k: 'size', w: 1, d: 2, ok: () => true, apply: o => big(o, 1.3), at: o => T.pine.bb(big(o, 1.3)) }, removeMut(1, 1)],
  };
  T.flower = {
    z: 20, bb: o => ({ x: o.x, y: o.y - 17 * o.s, r: 12 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, cy = o.y - 20 * s;
      let p = '';
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5; p += `<circle cx="${n1(x + Math.cos(a) * 5.2 * s)}" cy="${n1(cy + Math.sin(a) * 5.2 * s)}" r="${n1(4 * s)}" fill="${o.c}" ${st(1.3)}/>`; }
      return `<path d="M${n1(x)},${n1(o.y)} V${n1(cy)}" stroke="#3a9d5d" stroke-width="${n1(2.4 * s)}"/><ellipse cx="${n1(x + 4 * s)}" cy="${n1(o.y - 7 * s)}" rx="${n1(4 * s)}" ry="${n1(2 * s)}" fill="#4caf50" transform="rotate(-30 ${n1(x + 4 * s)} ${n1(o.y - 7 * s)})"/>`
        + p + `<circle cx="${n1(x)}" cy="${n1(cy)}" r="${n1(2.9 * s)}" fill="${o.cc}" ${st(1.2)}/>`;
    },
    muts: [colorMut('c', PAL.flower, 3, 2), removeMut(2, 2)],
  };
  T.fence = {
    z: 15, flat: true, bb: o => ({ x: (o.x1 + o.x2) / 2, y: o.y - 13, r: 16 }),
    draw(o) {
      const n = Math.floor((o.x2 - o.x1) / 12) + 1;
      let p = `<rect x="${n1(o.x1 - 4)}" y="${n1(o.y - 19)}" width="${n1(o.x2 - o.x1 + 8)}" height="4" fill="${o.c}" ${st(1.5)}/><rect x="${n1(o.x1 - 4)}" y="${n1(o.y - 9)}" width="${n1(o.x2 - o.x1 + 8)}" height="4" fill="${o.c}" ${st(1.5)}/>`;
      for (let k = 0; k < n; k++) if (!o.miss || o.miss !== k + 1) { const px = o.x1 + k * 12; p += `<polygon points="${pts([[px - 4, o.y], [px - 4, o.y - 22], [px, o.y - 27], [px + 4, o.y - 22], [px + 4, o.y]])}" fill="${o.c}" ${st(1.5)}/>`; }
      return p;
    },
    muts: [
      { k: 'picket', w: 2, d: 3, ok: o => (o.x2 - o.x1) >= 48, apply: (o, r) => ({ ...o, miss: 2 + Math.floor(r() * (Math.floor((o.x2 - o.x1) / 12) - 2)) }), at: o => ({ x: o.x1 + (o.miss - 1) * 12, y: o.y - 13, r: 11 }) },
    ],
    // 울타리 말뚝 자리는 바꾼 뒤에야 알아요 → pickDiffs 가 apply 뒤 at(바뀐 물건)으로 계산해요
    atAfter: true,
  };
  T.car = {
    z: 25, bb: o => ({ x: o.x, y: o.y - 13 * o.s, r: 29 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y;
      const body = `<rect x="${n1(x - 24 * s)}" y="${n1(y - 16 * s)}" width="${n1(48 * s)}" height="${n1(12 * s)}" rx="${n1(4 * s)}" fill="${o.c}" ${st()}/>`
        + `<polygon points="${pts([[x - 14 * s, y - 16 * s], [x - 9 * s, y - 26 * s], [x + 7 * s, y - 26 * s], [x + 14 * s, y - 16 * s]])}" fill="${o.c}" ${st()}/>`
        + `<polygon points="${pts([[x - 11 * s, y - 16.5 * s], [x - 7.5 * s, y - 23.5 * s], [x - 1 * s, y - 23.5 * s], [x - 1 * s, y - 16.5 * s]])}" fill="#cfeaff" ${st(1.3)}/>`
        + `<polygon points="${pts([[x + 1.5 * s, y - 16.5 * s], [x + 1.5 * s, y - 23.5 * s], [x + 6 * s, y - 23.5 * s], [x + 11 * s, y - 16.5 * s]])}" fill="#cfeaff" ${st(1.3)}/>`
        + `<circle cx="${n1(x + 21.5 * s)}" cy="${n1(y - 11 * s)}" r="${n1(2.3 * s)}" fill="#fff59d" ${st(1.2)}/>`
        + [-13, 13].map(dx => `<circle cx="${n1(x + dx * s)}" cy="${n1(y - 3.5 * s)}" r="${n1(5.6 * s)}" fill="#2b2b2b" ${st(1.4)}/><circle cx="${n1(x + dx * s)}" cy="${n1(y - 3.5 * s)}" r="${n1(2.2 * s)}" fill="${o.hub}"/>`).join('');
      return flipG(o, body);
    },
    muts: [colorMut('c', PAL.car, 3, 1, o => ({ x: o.x, y: o.y - 13 * o.s, r: 29 * o.s })), { k: 'flip', w: 2, d: 2, ok: () => true, apply: o => ({ ...o, dir: -o.dir }), at: o => T.car.bb(o) }],
  };
  T.mail = {
    z: 18, bb: o => ({ x: o.x, y: o.y - 30 * o.s, r: 20 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y;
      const flag = o.flag ? `<line x1="${n1(x + 11 * s)}" y1="${n1(y - 30 * s)}" x2="${n1(x + 11 * s)}" y2="${n1(y - 47 * s)}" ${st(1.8)}/><rect x="${n1(x + 11 * s)}" y="${n1(y - 47 * s)}" width="${n1(8 * s)}" height="${n1(6 * s)}" fill="#ef4444" ${st(1.4)}/>` : '';
      return `<rect x="${n1(x - 2.2 * s)}" y="${n1(y - 28 * s)}" width="${n1(4.4 * s)}" height="${n1(28 * s)}" fill="#8b5a2b" ${st(1.4)}/>`
        + `<path d="M${n1(x - 11 * s)},${n1(y - 27 * s)} V${n1(y - 36 * s)} A${n1(11 * s)},${n1(7 * s)} 0 0 1 ${n1(x + 11 * s)},${n1(y - 36 * s)} V${n1(y - 27 * s)} Z" fill="${o.c}" ${st()}/>` + flag;
    },
    muts: [{ k: 'flag', w: 2, d: 2, ok: o => o.flag, apply: o => ({ ...o, flag: false }), at: o => ({ x: o.x + 14 * o.s, y: o.y - 40 * o.s, r: 10 * o.s }) }, colorMut('c', ['#3b82f6', '#ef4444', '#16a34a', '#f59e0b'], 2, 1)],
  };
  T.mush = {
    z: 19, bb: o => ({ x: o.x, y: o.y - 9 * o.s, r: 12 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y;
      const dots = o.dots ? [[-4.5, -12], [2, -15], [5.5, -10.5]].map(([dx, dy]) => `<circle cx="${n1(x + dx * s)}" cy="${n1(y + dy * s)}" r="${n1(1.8 * s)}" fill="#fff"/>`).join('') : '';
      return `<rect x="${n1(x - 3.5 * s)}" y="${n1(y - 9 * s)}" width="${n1(7 * s)}" height="${n1(9 * s)}" rx="${n1(2 * s)}" fill="#f5ead6" ${st(1.4)}/>`
        + `<path d="M${n1(x - 10 * s)},${n1(y - 8 * s)} A${n1(10 * s)},${n1(10 * s)} 0 0 1 ${n1(x + 10 * s)},${n1(y - 8 * s)} Z" fill="${o.c}" ${st(1.6)}/>` + dots;
    },
    muts: [{ k: 'dots', w: 2, d: 3, ok: o => o.dots, apply: o => ({ ...o, dots: false }), at: o => ({ x: o.x, y: o.y - 12 * o.s, r: 11 * o.s }) }, colorMut('c', ['#e5534b', '#8b5cf6', '#f59e0b', '#3b82f6'], 2, 2), removeMut(1, 2)],
  };

  /* ─── 🏖️ 바닷가 ─── */
  T.boat = {
    z: 12, bb: o => ({ x: o.x, y: o.y - 24 * o.s, r: 30 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y;
      const flag = o.flag ? `<polygon points="${pts([[x + 1 * s, y - 52 * s], [x + 11 * s, y - 49 * s], [x + 1 * s, y - 46 * s]])}" fill="#ef4444" ${st(1.2)}/>` : '';
      const g = `<polygon points="${pts([[x - 26 * s, y - 10 * s], [x + 26 * s, y - 10 * s], [x + 18 * s, y], [x - 18 * s, y]])}" fill="${o.hull}" ${st()}/>`
        + `<line x1="${n1(x + 1 * s)}" y1="${n1(y - 10 * s)}" x2="${n1(x + 1 * s)}" y2="${n1(y - 52 * s)}" ${st(2.2)}/>`
        + `<polygon points="${pts([[x - 1.5 * s, y - 48 * s], [x - 1.5 * s, y - 13 * s], [x - 22 * s, y - 13 * s]])}" fill="${o.sail}" ${st()}/>`
        + `<polygon points="${pts([[x + 3.5 * s, y - 43 * s], [x + 3.5 * s, y - 13 * s], [x + 19 * s, y - 13 * s]])}" fill="${o.sail2}" ${st()}/>` + flag;
      return flipG(o, g);
    },
    muts: [colorMut('sail', PAL.sail, 3, 1, o => ({ x: o.x - 9 * o.s * o.dir, y: o.y - 26 * o.s, r: 17 * o.s })), colorMut('hull', PAL.hull, 2, 1, o => ({ x: o.x, y: o.y - 5 * o.s, r: 22 * o.s })),
      { k: 'flag', w: 2, d: 2, ok: o => o.flag, apply: o => ({ ...o, flag: false }), at: o => ({ x: o.x + 6 * o.s * o.dir, y: o.y - 49 * o.s, r: 10 * o.s }) },
      { k: 'flip', w: 1, d: 2, ok: () => true, apply: o => ({ ...o, dir: -o.dir }), at: o => T.boat.bb(o) }],
  };
  T.fish = {
    z: 11, bb: o => ({ x: o.x, y: o.y, r: 14 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y;
      const g = `<polygon points="${pts([[x - 9 * s, y], [x - 17 * s, y - 7 * s], [x - 17 * s, y + 7 * s]])}" fill="${o.c}" ${st(1.6)}/>`
        + `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(11 * s)}" ry="${n1(7 * s)}" fill="${o.c}" ${st(1.8)}/><circle cx="${n1(x + 5.5 * s)}" cy="${n1(y - 1.5 * s)}" r="${n1(1.7 * s)}" fill="${OL}"/>`
        + (o.stripe ? `<path d="M${n1(x - 2 * s)},${n1(y - 6.5 * s)} V${n1(y + 6.5 * s)}" stroke="#fff" stroke-width="${n1(2.2 * s)}"/>` : '');
      return flipG(o, g);
    },
    muts: [colorMut('c', PAL.fish, 3, 1), { k: 'flip', w: 2, d: 2, ok: () => true, apply: o => ({ ...o, dir: -o.dir }), at: o => T.fish.bb(o) }, removeMut(2, 1),
      { k: 'stripe', w: 1, d: 3, ok: o => o.stripe, apply: o => ({ ...o, stripe: false }), at: o => ({ x: o.x - 2 * o.s * o.dir, y: o.y, r: 9 * o.s }) }],
  };
  T.palm = {
    z: 13, bb: o => ({ x: o.x + 6 * o.s, y: o.y - 62 * o.s, r: 38 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y, tx = x + 10 * s, ty = y - 76 * s;
      const leaves = [[-34, 6], [-22, -12], [0, -18], [22, -12], [34, 6]].map(([dx, dy]) => `<path d="M${n1(tx)},${n1(ty)} Q${n1(tx + dx * 0.5 * s)},${n1(ty + (dy - 14) * s)} ${n1(tx + dx * s)},${n1(ty + dy * s)} Q${n1(tx + dx * 0.55 * s)},${n1(ty + (dy - 2) * s)} ${n1(tx)},${n1(ty)}Z" fill="${o.c}" ${st(1.6)}/>`).join('');
      const nuts = [[-4, 3], [3, 4], [9, 2]].slice(0, o.nuts).map(([dx, dy]) => `<circle cx="${n1(tx + dx * s)}" cy="${n1(ty + dy * s)}" r="${n1(3.6 * s)}" fill="#7a4b23" ${st(1.2)}/>`).join('');
      return `<path d="M${n1(x - 6 * s)},${n1(y)} Q${n1(x - 2 * s)},${n1(y - 44 * s)} ${n1(tx - 3 * s)},${n1(ty)} L${n1(tx + 3 * s)},${n1(ty)} Q${n1(x + 6 * s)},${n1(y - 40 * s)} ${n1(x + 6 * s)},${n1(y)}Z" fill="#b77b43" ${st()}/>` + leaves + nuts;
    },
    muts: [{ k: 'nuts', w: 3, d: 2, ok: o => o.nuts > 0, apply: o => ({ ...o, nuts: o.nuts - 1 }), at: o => ({ x: o.x + 10 * o.s + [-4, 3, 9][o.nuts - 1] * o.s, y: o.y - 73 * o.s, r: 9 * o.s }), atBefore: true },
      colorMut('c', ['#3a9d5d', '#7cc242', '#2e7d4f'], 1, 2, o => ({ x: o.x + 10 * o.s, y: o.y - 80 * o.s, r: 30 * o.s }))],
  };
  T.umb = {
    z: 16, bb: o => ({ x: o.x, y: o.y - 34 * o.s, r: 30 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y, top = y - 46 * s, r = 28 * s;
      let segs = '';
      for (let k = 0; k < 4; k++) {
        const a0 = Math.PI + (k * Math.PI) / 4, a1 = Math.PI + ((k + 1) * Math.PI) / 4;
        const p0 = [x + Math.cos(a0) * r, top + 12 * s + Math.sin(a0) * r * 0.75], p1 = [x + Math.cos(a1) * r, top + 12 * s + Math.sin(a1) * r * 0.75];
        segs += `<path d="M${n1(x)},${n1(top)} L${n1(p0[0])},${n1(p0[1])} Q${n1((p0[0] + p1[0]) / 2)},${n1((p0[1] + p1[1]) / 2 - 3 * s)} ${n1(p1[0])},${n1(p1[1])} Z" fill="${k % 2 ? (o.stripes ? '#ffffff' : o.c) : o.c}" ${st(1.5)}/>`;
      }
      return `<line x1="${n1(x)}" y1="${n1(top)}" x2="${n1(x + 3 * s)}" y2="${n1(y)}" ${st(2.4)}/>` + segs;
    },
    muts: [colorMut('c', ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#a855f7'], 3, 1, o => ({ x: o.x, y: o.y - 40 * o.s, r: 26 * o.s })),
      { k: 'stripes', w: 2, d: 2, ok: o => o.stripes, apply: o => ({ ...o, stripes: false }), at: o => ({ x: o.x, y: o.y - 40 * o.s, r: 26 * o.s }) }],
  };
  T.ball = {
    z: 22, bb: o => ({ x: o.x, y: o.y - 9 * o.s, r: 11 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, cy = o.y - 9 * s, r = 9 * s;
      return `<circle cx="${n1(x)}" cy="${n1(cy)}" r="${n1(r)}" fill="#fff" ${st()}/><path d="M${n1(x)},${n1(cy - r)} A${n1(r)},${n1(r)} 0 0 1 ${n1(x + r)},${n1(cy)} L${n1(x)},${n1(cy)}Z" fill="${o.c}"/><path d="M${n1(x - r)},${n1(cy)} A${n1(r)},${n1(r)} 0 0 0 ${n1(x)},${n1(cy + r)} L${n1(x)},${n1(cy)}Z" fill="${o.c2}"/><circle cx="${n1(x)}" cy="${n1(cy)}" r="${n1(r)}" fill="none" ${st()}/>`;
    },
    muts: [colorMut('c', ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b'], 2, 2), removeMut(2, 1), { k: 'size', w: 1, d: 2, ok: () => true, apply: o => big(o, 1.4), at: o => T.ball.bb(big(o, 1.4)) }],
  };
  T.castle = {
    z: 17, bb: o => ({ x: o.x, y: o.y - 20 * o.s, r: 26 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y, sand = '#e9c37d';
      const tower = dx => `<rect x="${n1(x + dx * s - 6 * s)}" y="${n1(y - 30 * s)}" width="${n1(12 * s)}" height="${n1(30 * s)}" fill="${sand}" ${st(1.6)}/><path d="M${n1(x + dx * s - 6 * s)},${n1(y - 30 * s)} v${n1(-4 * s)} h${n1(3 * s)} v${n1(3 * s)} h${n1(3 * s)} v${n1(-3 * s)} h${n1(3 * s)} v${n1(3 * s)} h${n1(3 * s)} v${n1(-3 * s)} V${n1(y - 30 * s)}" fill="${sand}" ${st(1.4)}/>`;
      const flag = o.flag ? `<line x1="${n1(x + 12 * s)}" y1="${n1(y - 34 * s)}" x2="${n1(x + 12 * s)}" y2="${n1(y - 46 * s)}" ${st(1.4)}/><polygon points="${pts([[x + 12 * s, y - 46 * s], [x + 20 * s, y - 43 * s], [x + 12 * s, y - 40 * s]])}" fill="${o.fc}" ${st(1)}/>` : '';
      return `<rect x="${n1(x - 18 * s)}" y="${n1(y - 18 * s)}" width="${n1(36 * s)}" height="${n1(18 * s)}" fill="${sand}" ${st(1.6)}/>` + tower(-12) + tower(12)
        + `<path d="M${n1(x - 4 * s)},${n1(y)} v${n1(-8 * s)} a${n1(4 * s)},${n1(4 * s)} 0 0 1 ${n1(8 * s)},0 v${n1(8 * s)}" fill="#a0784a" ${st(1.4)}/>` + flag;
    },
    muts: [{ k: 'flag', w: 2, d: 2, ok: o => o.flag, apply: o => ({ ...o, flag: false }), at: o => ({ x: o.x + 15 * o.s, y: o.y - 42 * o.s, r: 10 * o.s }) }],
  };
  T.crab = {
    z: 21, bb: o => ({ x: o.x, y: o.y - 7 * o.s, r: 14 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y - 6 * s;
      const legs = [-1, 1].map(d => `<path d="M${n1(x + d * 6 * s)},${n1(y + 3 * s)} l${n1(d * 6 * s)},${n1(5 * s)} M${n1(x + d * 3 * s)},${n1(y + 4 * s)} l${n1(d * 4 * s)},${n1(6 * s)}" fill="none" ${st(1.4)}/>`).join('');
      const claws = [-1, 1].map(d => `<circle cx="${n1(x + d * 13 * s)}" cy="${n1(y - 5 * s)}" r="${n1(3.6 * s)}" fill="${o.c}" ${st(1.3)}/>`).join('');
      return legs + claws + `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(9 * s)}" ry="${n1(6 * s)}" fill="${o.c}" ${st(1.6)}/>`
        + [-3, 3].map(dx => `<line x1="${n1(x + dx * s)}" y1="${n1(y - 5 * s)}" x2="${n1(x + dx * s)}" y2="${n1(y - 10 * s)}" ${st(1.2)}/><circle cx="${n1(x + dx * s)}" cy="${n1(y - 10.5 * s)}" r="${n1(1.7 * s)}" fill="#fff" ${st(1)}/>`).join('');
    },
    muts: [colorMut('c', ['#ef4444', '#f97316', '#a855f7'], 2, 2), removeMut(2, 2)],
  };
  T.sfish = {
    z: 20, bb: o => ({ x: o.x, y: o.y - 7 * o.s, r: 10 * o.s }),
    draw(o) { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = (k % 2 ? 3.4 : 8.5) * o.s; p.push([o.x + Math.cos(a) * r, o.y - 7 * o.s + Math.sin(a) * r]); } return `<polygon points="${pts(p)}" fill="${o.c}" ${st(1.4)}/>`; },
    muts: [colorMut('c', ['#ff8a3d', '#ff5d8f', '#ffd23f', '#a855f7'], 2, 2), removeMut(2, 2)],
  };
  T.shell = {
    z: 20, bb: o => ({ x: o.x, y: o.y - 5 * o.s, r: 9 * o.s }),
    draw(o) {
      const s = o.s, x = o.x, y = o.y;
      return `<path d="M${n1(x - 7 * s)},${n1(y - 2 * s)} Q${n1(x)},${n1(y - 16 * s)} ${n1(x + 7 * s)},${n1(y - 2 * s)} L${n1(x + 2 * s)},${n1(y)} L${n1(x - 2 * s)},${n1(y)} Z" fill="${o.c}" ${st(1.4)}/><path d="M${n1(x)},${n1(y)} V${n1(y - 10 * s)} M${n1(x)},${n1(y)} L${n1(x - 4 * s)},${n1(y - 8 * s)} M${n1(x)},${n1(y)} L${n1(x + 4 * s)},${n1(y - 8 * s)}" fill="none" ${st(1)}/>`;
    },
    muts: [removeMut(2, 2)],
  };

  /* ─── 🛋️ 방 ─── */
  T.window = {
    z: 5, bb: o => ({ x: o.x, y: o.y, r: 44 }),
    draw(o) {
      const x = o.x, y = o.y, w = 70, h = 64;
      const cur = side => (o.cur === 'both' || o.cur === side ? `<path d="M${n1(side === 'l' ? x - w / 2 - 6 : x + w / 2 + 6)},${n1(y - h / 2 - 6)} Q${n1(side === 'l' ? x - w / 2 + 14 : x + w / 2 - 14)},${n1(y)} ${n1(side === 'l' ? x - w / 2 + 2 : x + w / 2 - 2)},${n1(y + h / 2 + 8)} L${n1(side === 'l' ? x - w / 2 - 12 : x + w / 2 + 12)},${n1(y + h / 2 + 8)} Z" fill="${side === 'l' ? o.cl : o.cr}" ${st(1.6)}/>` : '');
      return `<rect x="${n1(x - w / 2)}" y="${n1(y - h / 2)}" width="${w}" height="${h}" fill="#9fd8ff" ${st(2.4)}/><circle cx="${n1(x + 16)}" cy="${n1(y - 14)}" r="7" fill="#fff6b0"/>`
        + `<path d="M${n1(x - w / 2)},${n1(y + 10)} Q${n1(x - 10)},${n1(y - 4)} ${n1(x + w / 2)},${n1(y + 12)} V${n1(y + h / 2)} H${n1(x - w / 2)}Z" fill="#8fd18a"/>`
        + (o.cross ? `<path d="M${n1(x)},${n1(y - h / 2)} V${n1(y + h / 2)} M${n1(x - w / 2)},${n1(y)} H${n1(x + w / 2)}" ${st(2.4)}/>` : '')
        + `<rect x="${n1(x - w / 2)}" y="${n1(y - h / 2)}" width="${w}" height="${h}" fill="none" ${st(2.4)}/>` + cur('l') + cur('r')
        + `<rect x="${n1(x - w / 2 - 14)}" y="${n1(y - h / 2 - 9)}" width="${w + 28}" height="5" rx="2" fill="#8b5a2b" ${st(1.4)}/>`;
    },
    muts: [colorMut('cl', ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#ec4899'], 3, 1, o => ({ x: o.x - 40, y: o.y + 6, r: 36 })),
      { k: 'curtain', w: 2, d: 1, ok: o => o.cur === 'both', apply: o => ({ ...o, cur: 'l' }), at: o => ({ x: o.x + 40, y: o.y + 6, r: 36 }) },
      { k: 'cross', w: 2, d: 2, ok: o => o.cross, apply: o => ({ ...o, cross: false }), at: o => ({ x: o.x, y: o.y, r: 22 }) }],
  };
  T.frame = {
    z: 5, bb: o => ({ x: o.x, y: o.y, r: 33 }),
    draw(o) {
      const x = o.x, y = o.y, w = 50, h = 38;
      const pic = `<rect x="${n1(x - w / 2 + 4)}" y="${n1(y - h / 2 + 4)}" width="${w - 8}" height="${h - 8}" fill="#cdeeff"/>`
        + `<polygon points="${pts([[x - w / 2 + 4, y + h / 2 - 4], [x - 6 * o.m, y - 6], [x + 8 * o.m, y + h / 2 - 4]])}" fill="#6aa86a"/>`
        + `<polygon points="${pts([[x + 2 * o.m, y + h / 2 - 4], [x + 12 * o.m, y - 1], [x + (w / 2 - 4) * o.m, y + h / 2 - 4]])}" fill="#4f8f5a"/>`
        + (o.sun ? `<circle cx="${n1(x - 12 * o.m)}" cy="${n1(y - 8)}" r="4.5" fill="#ffd23f"/>` : '');
      return `<rect x="${n1(x - w / 2)}" y="${n1(y - h / 2)}" width="${w}" height="${h}" fill="${o.c}" ${st(2)}/>` + pic + `<rect x="${n1(x - w / 2 + 4)}" y="${n1(y - h / 2 + 4)}" width="${w - 8}" height="${h - 8}" fill="none" ${st(1.4)}/>`;
    },
    muts: [colorMut('c', ['#c8902f', '#8b5a2b', '#3b82f6', '#e5534b', '#2f2f2f'], 2, 1, o => ({ x: o.x, y: o.y, r: 33 })), { k: 'sun', w: 2, d: 2, ok: o => o.sun, apply: o => ({ ...o, sun: false }), at: o => ({ x: o.x - 12 * o.m, y: o.y - 8, r: 9 }) },
      { k: 'mirror', w: 1, d: 3, ok: () => true, apply: o => ({ ...o, m: -o.m }), at: o => ({ x: o.x, y: o.y, r: 27 }) }],
  };
  T.clock = {
    z: 5, bb: o => ({ x: o.x, y: o.y, r: 19 }),
    draw(o) {
      const x = o.x, y = o.y, r = 15, ha = (o.h * 30 - 90) * Math.PI / 180, ma = (o.mi * 6 - 90) * Math.PI / 180;
      let ticks = '';
      for (let k = 0; k < 12; k += 3) { const a = (k * 30 - 90) * Math.PI / 180; ticks += `<circle cx="${n1(x + Math.cos(a) * 11.5)}" cy="${n1(y + Math.sin(a) * 11.5)}" r="1.3" fill="${OL}"/>`; }
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${o.c}" stroke-width="3.5"/><circle cx="${x}" cy="${y}" r="${r + 1.8}" fill="none" ${st(1.2)}/>` + ticks
        + `<line x1="${x}" y1="${y}" x2="${n1(x + Math.cos(ha) * 7)}" y2="${n1(y + Math.sin(ha) * 7)}" ${st(2.4)}/><line x1="${x}" y1="${y}" x2="${n1(x + Math.cos(ma) * 11)}" y2="${n1(y + Math.sin(ma) * 11)}" ${st(1.6)}/><circle cx="${x}" cy="${y}" r="1.6" fill="${OL}"/>`;
    },
    muts: [{ k: 'time', w: 3, d: 2, ok: () => true, apply: o => ({ ...o, h: (o.h + 3) % 12 }), at: o => T.clock.bb(o) }, colorMut('c', ['#e5534b', '#3b82f6', '#16a34a', '#a855f7'], 2, 1)],
  };
  T.shelf = {
    z: 5, bb: o => ({ x: o.x, y: o.y - 12, r: 30 }),
    draw(o) {
      const x = o.x, y = o.y;
      let bx = x - 26, out = '';
      o.books.forEach(b => { if (!b[3]) out += `<rect x="${n1(bx)}" y="${n1(y - b[1])}" width="${b[2]}" height="${b[1]}" rx="1.2" fill="${b[0]}" ${st(1.3)}/>`; bx += b[2] + 1; });   // [색, 높이, 너비, 빠짐]
      return out + `<rect x="${n1(x - 32)}" y="${n1(y)}" width="64" height="5" rx="1.5" fill="#a86b3c" ${st(1.4)}/>`;
    },
    muts: [
      { k: 'book', w: 3, d: 2, ok: o => o.books.length >= 4, apply: (o, r) => { const books = o.books.slice(), k = 1 + Math.floor(r() * (books.length - 2)); books[k] = [other(r, PAL.book, books[k][0]), books[k][1], books[k][2]]; return { ...o, books, bk: k }; }, at: o => T.shelf.bookAt(o, o.bk) },
      { k: 'book', w: 2, d: 2, ok: o => o.books.length >= 4, apply: (o, r) => { const books = o.books.slice(), k = 1 + Math.floor(r() * (books.length - 2)); books[k] = [books[k][0], books[k][1], books[k][2], true]; return { ...o, books, bk: k }; }, at: o => T.shelf.bookAt(o, o.bk) },
    ],
    atAfter: true,
    bookAt(o, k) { let bx = o.x - 26; for (let i = 0; i < k; i++) bx += o.books[i][2] + 1; const b = o.books[k]; return { x: bx + b[2] / 2, y: o.y - b[1] / 2, r: b[1] / 2 + 4 }; },
  };
  T.lamp = {
    z: 14, bb: o => ({ x: o.x, y: o.y - 48, r: 30 }),
    draw(o) {
      const x = o.x, y = o.y;
      return `<ellipse cx="${x}" cy="${n1(y - 2)}" rx="13" ry="4" fill="#5b4636" ${st(1.4)}/><line x1="${x}" y1="${n1(y - 3)}" x2="${x}" y2="${n1(y - 66)}" ${st(2.6)}/>`
        + `<polygon points="${pts([[x - 18, y - 62], [x + 18, y - 62], [x + 11, y - 86], [x - 11, y - 86]])}" fill="${o.c}" ${st()}/>` + (o.on ? `<ellipse cx="${x}" cy="${n1(y - 58)}" rx="22" ry="6" fill="#fff59d" opacity=".45"/>` : '');
    },
    muts: [colorMut('c', PAL.shade, 3, 1, o => ({ x: o.x, y: o.y - 74, r: 20 })), { k: 'light', w: 1, d: 2, ok: o => o.on, apply: o => ({ ...o, on: false }), at: o => ({ x: o.x, y: o.y - 60, r: 18 }) }],
  };
  T.table = {
    z: 15, bb: o => ({ x: o.x, y: o.y - 30, r: 34 }),
    draw(o) {
      const x = o.x, y = o.y;
      const cup = o.cup ? `<path d="M${n1(x - 18)},${n1(y - 42)} h12 v8 a4,4 0 0 1 -4,4 h-4 a4,4 0 0 1 -4,-4 Z" fill="${o.cc}" ${st(1.4)}/><path d="M${n1(x - 6)},${n1(y - 39)} a3,3 0 0 1 0,6" fill="none" ${st(1.4)}/>`
        + (o.steam ? `<path d="M${n1(x - 14)},${n1(y - 46)} q-3,-4 0,-8 M${n1(x - 9)},${n1(y - 46)} q-3,-4 0,-8" fill="none" stroke="#9aa6b8" stroke-width="1.6" stroke-linecap="round"/>` : '') : '';
      const vase = `<path d="M${n1(x + 8)},${n1(y - 30)} q-3,-8 2,-14 h6 q5,6 2,14 Z" fill="${o.vc}" ${st(1.4)}/><path d="M${n1(x + 12)},${n1(y - 44)} V${n1(y - 54)}" stroke="#3a9d5d" stroke-width="2"/><circle cx="${n1(x + 12)}" cy="${n1(y - 57)}" r="4.2" fill="${o.fc}" ${st(1.2)}/>`;
      return `<rect x="${n1(x - 30)}" y="${n1(y - 30)}" width="60" height="6" rx="2" fill="#b07a46" ${st()}/><rect x="${n1(x - 26)}" y="${n1(y - 24)}" width="5" height="24" fill="#8b5a2b" ${st(1.4)}/><rect x="${n1(x + 21)}" y="${n1(y - 24)}" width="5" height="24" fill="#8b5a2b" ${st(1.4)}/>` + cup + vase;
    },
    muts: [{ k: 'cup', w: 2, d: 2, ok: o => o.cup, apply: o => ({ ...o, cup: false }), at: o => ({ x: o.x - 12, y: o.y - 38, r: 11 }) },
      { k: 'steam', w: 1, d: 3, ok: o => o.cup && o.steam, apply: o => ({ ...o, steam: false }), at: o => ({ x: o.x - 11, y: o.y - 50, r: 9 }) },
      colorMut('fc', ['#ef4444', '#ffd23f', '#a855f7', '#3cc6ff'], 2, 2, o => ({ x: o.x + 12, y: o.y - 56, r: 9 })),
      colorMut('vc', ['#3b82f6', '#16a34a', '#e5534b', '#f59e0b'], 2, 2, o => ({ x: o.x + 12, y: o.y - 37, r: 10 }))],
  };
  T.rug = {
    z: 7, flat: true, bb: o => ({ x: o.x, y: o.y, r: 40 }),          // 바꾸지 않아요 (원 하나로는 넓적한 깔개를 다 덮을 수 없어서)
    draw: o => `<ellipse cx="${o.x}" cy="${o.y}" rx="62" ry="17" fill="${o.c}" ${st(1.6)}/><ellipse cx="${o.x}" cy="${o.y}" rx="48" ry="11" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="${o.dash ? '6 5' : '0'}" opacity=".85"/>`,
    muts: [],
  };
  T.cat = {
    z: 24, bb: o => ({ x: o.x, y: o.y - 18, r: 30 }),
    draw(o) {
      const x = o.x, y = o.y, c = o.c;
      const tail = o.tail ? `<path d="M${n1(x + 11)},${n1(y - 4)} q14,-2 12,-16 q-1,-6 4,-8" fill="none" stroke="${OL}" stroke-width="7" stroke-linecap="round"/><path d="M${n1(x + 11)},${n1(y - 4)} q14,-2 12,-16 q-1,-6 4,-8" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>` : '';
      const g = tail + `<ellipse cx="${x}" cy="${n1(y - 11)}" rx="13" ry="11" fill="${c}" ${st()}/><circle cx="${n1(x - 3)}" cy="${n1(y - 27)}" r="9.5" fill="${c}" ${st()}/>`
        + `<polygon points="${pts([[x - 11, y - 30], [x - 9, y - 40], [x - 4, y - 34]])}" fill="${c}" ${st(1.6)}/><polygon points="${pts([[x - 1, y - 35], [x + 4, y - 40], [x + 5, y - 30]])}" fill="${c}" ${st(1.6)}/>`
        + `<circle cx="${n1(x - 6.5)}" cy="${n1(y - 28)}" r="1.6" fill="${c === '#3b3b3b' ? '#ffe066' : OL}"/><circle cx="${n1(x + 0.5)}" cy="${n1(y - 28)}" r="1.6" fill="${c === '#3b3b3b' ? '#ffe066' : OL}"/><path d="M${n1(x - 4.5)},${n1(y - 24.5)} q1.5,1.5 3,0" fill="none" stroke="${c === '#3b3b3b' ? '#ddd' : OL}" stroke-width="1.1" stroke-linecap="round"/>`;
      return flipG(o, g);
    },
    muts: [colorMut('c', PAL.cat, 2, 1), { k: 'tail', w: 2, d: 2, ok: o => o.tail, apply: o => ({ ...o, tail: false }), at: o => ({ x: o.x + 19 * o.dir, y: o.y - 16, r: 17 }) }, { k: 'flip', w: 1, d: 2, ok: () => true, apply: o => ({ ...o, dir: -o.dir }), at: o => T.cat.bb(o) }],
  };
  T.plant = {
    z: 23, bb: o => ({ x: o.x, y: o.y - 22, r: 22 }),
    draw(o) {
      const x = o.x, y = o.y;
      const leaves = [[-14, -34], [-6, -44], [6, -44], [14, -34], [0, -50]].slice(0, o.lv).map(([dx, dy]) => `<path d="M${x},${n1(y - 16)} Q${n1(x + dx * 1.2)},${n1(y + dy * 0.55)} ${n1(x + dx)},${n1(y + dy)} Q${n1(x + dx * 0.3)},${n1(y + dy * 0.7)} ${x},${n1(y - 16)}Z" fill="#3a9d5d" ${st(1.4)}/>`).join('');
      return leaves + `<polygon points="${pts([[x - 12, y - 18], [x + 12, y - 18], [x + 9, y], [x - 9, y]])}" fill="${o.c}" ${st()}/><rect x="${n1(x - 14)}" y="${n1(y - 21)}" width="28" height="5" rx="2" fill="${o.c}" ${st(1.5)}/>`;
    },
    muts: [colorMut('c', PAL.pot, 3, 1, o => ({ x: o.x, y: o.y - 10, r: 14 })), { k: 'leaf', w: 2, d: 3, ok: o => o.lv >= 4, apply: o => ({ ...o, lv: o.lv - 1 }), at: o => { const l = [[-14, -34], [-6, -44], [6, -44], [14, -34], [0, -50]][o.lv - 1]; return { x: o.x + l[0] * 0.8, y: o.y + l[1] * 0.85, r: 11 }; }, atBefore: true }],
  };
  T.toy = {
    z: 26, bb: o => ({ x: o.x, y: o.y - 8, r: 10 }),
    draw: o => `<circle cx="${o.x}" cy="${n1(o.y - 8)}" r="8" fill="${o.c}" ${st()}/><path d="M${n1(o.x - 8)},${n1(o.y - 8)} Q${o.x},${n1(o.y - 2)} ${n1(o.x + 8)},${n1(o.y - 8)}" fill="none" stroke="#fff" stroke-width="2"/>`,
    muts: [colorMut('c', ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#a855f7'], 2, 2), removeMut(2, 2)],
  };

  /* ───────── 장면 만들기 ───────── */
  /** 빈자리 찾기: 다른 물건 자리 원과 겹치지 않게 (gap 여유) */
  function place(rnd, objs, make, zone, tries = 40, gap = 4) {
    for (let k = 0; k < tries; k++) {
      const o = make(rint(rnd, zone[0], zone[1]), rint(rnd, zone[2], zone[3]));
      const b = T[o.t].bb(o);
      if (b.x - b.r < -6 || b.x + b.r > W + 6) continue;
      if (T[o.t].flat || objs.every(p => { if (T[p.t].flat) return true; const c = T[p.t].bb(p), dx = c.x - b.x, dy = c.y - b.y, m = c.r + b.r + gap; return dx * dx + dy * dy > m * m; })) { objs.push(o); return o; }
    }
    return null;
  }
  /** 「더하기」로 새로 넣을 수 있는 작은 물건 (장면마다) */
  const ADDS = {
    village: [
      { zone: [20, 380, 26, 110], make: (r, x, y) => ({ t: 'gull', x, y, s: 1 }) },
      { zone: [20, 380, 222, 258], make: (r, x, y) => ({ t: 'flower', x, y, s: 1, c: pick(r, PAL.flower), cc: '#ffb020' }) },
      { zone: [20, 380, 130, 230], make: (r, x, y) => ({ t: 'bfly', x, y, s: 1, c: pick(r, PAL.flower) }) },
      { zone: [20, 380, 224, 258], make: (r, x, y) => ({ t: 'mush', x, y, s: 1, c: '#e5534b', dots: true }) },
    ],
    sea: [
      { zone: [20, 380, 24, 100], make: (r, x, y) => ({ t: 'gull', x, y, s: 1 }) },
      { zone: [20, 380, 160, 196], make: (r, x, y) => ({ t: 'fish', x, y, s: 0.9, c: pick(r, PAL.fish), dir: r() < 0.5 ? 1 : -1, stripe: false }) },
      { zone: [20, 380, 236, 292], make: (r, x, y) => ({ t: 'sfish', x, y, s: 1.15, c: '#ff8a3d' }) },
      { zone: [20, 380, 236, 292], make: (r, x, y) => ({ t: 'shell', x, y, s: 1.1, c: '#ffe0ec' }) },
    ],
    room: [
      { zone: [30, 370, 248, 294], make: (r, x, y) => ({ t: 'toy', x, y, c: pick(r, ['#ef4444', '#3b82f6', '#f59e0b']) }) },
    ],
  };

  function village(rnd) {
    const day = rnd() < 0.7;
    const bg = { t: 'village', day, hill1: '#9ad37a', hill2: '#7cc062', ground: '#86c86a', g2: '#73b65a', road: rnd() < 0.75 };
    const objs = [];
    const sx = rnd() < 0.5 ? rint(rnd, 40, 90) : rint(rnd, 310, 360);
    objs.push(day ? { t: 'sun', x: sx, y: rint(rnd, 38, 52), s: 1, c: '#ffd23f', rays: true, face: rnd() < 0.7 } : { t: 'moon', x: sx, y: rint(rnd, 38, 52), s: 1, c: '#fff3b0' });
    if (!day) for (let k = 0; k < 6; k++) place(rnd, objs, (x, y) => ({ t: 'star', x, y, s: 1, c: '#fff6b0' }), [15, 385, 12, 100], 20, 2);
    const nh = rint(rnd, 1, 3);
    for (let k = 0; k < nh; k++) place(rnd, objs, (x, y) => ({ t: 'house', x, y, s: n1(0.95 + rnd() * 0.25), wall: pick(rnd, PAL.wall), roof: pick(rnd, PAL.roof), door: pick(rnd, PAL.door), ch: rnd() < 0.75, wl: 'sq', wr: rnd() < 0.5 ? 'sq' : 'rd' }), [50, 350, 196, 214]);
    for (let k = 0; k < rint(rnd, 2, 3); k++) {
      if (rnd() < 0.6) place(rnd, objs, (x, y) => ({ t: 'tree', x, y, s: n1(0.9 + rnd() * 0.25), c: pick(rnd, PAL.leaf), ap: [0, 1, 2, 3].map(() => rnd() < 0.6) }), [30, 370, 200, 222]);
      else place(rnd, objs, (x, y) => ({ t: 'pine', x, y, s: n1(0.85 + rnd() * 0.3), c: '#2f8f5b' }), [30, 370, 200, 222]);
    }
    for (let k = 0; k < rint(rnd, 2, 3); k++) place(rnd, objs, (x, y) => ({ t: 'cloud', x, y, s: n1(0.8 + rnd() * 0.5), c: '#ffffff' }), [30, 370, 22, 92]);
    for (let k = 0; k < rint(rnd, 1, 3); k++) place(rnd, objs, (x, y) => ({ t: 'gull', x, y, s: n1(0.8 + rnd() * 0.4) }), [20, 380, 30, 120]);
    if (rnd() < 0.6) place(rnd, objs, (x, y) => ({ t: 'balloon', x, y, s: 1, c: pick(rnd, PAL.balloon) }), [30, 370, 60, 120]);
    if (rnd() < 0.8) { const len = rint(rnd, 5, 10) * 12, c = rnd() < 0.6 ? '#fff5e1' : '#d9a066'; place(rnd, objs, x => ({ t: 'fence', x1: x, x2: x + len, y: 246, c }), [16, 384 - len, 0, 0], 1); }
    if (rnd() < 0.6) place(rnd, objs, (x, y) => ({ t: 'mail', x, y, s: 1, c: pick(rnd, ['#3b82f6', '#ef4444', '#16a34a']), flag: true }), [30, 370, 236, 250]);
    for (let k = 0; k < rint(rnd, 3, 6); k++) place(rnd, objs, (x, y) => ({ t: 'flower', x, y, s: n1(0.9 + rnd() * 0.3), c: pick(rnd, PAL.flower), cc: '#ffb020' }), [16, 384, 226, 262]);
    if (rnd() < 0.6) place(rnd, objs, (x, y) => ({ t: 'mush', x, y, s: 1, c: pick(rnd, ['#e5534b', '#8b5cf6']), dots: true }), [16, 384, 230, 262]);
    if (rnd() < 0.7) place(rnd, objs, (x, y) => ({ t: 'bfly', x, y, s: 1, c: pick(rnd, PAL.flower) }), [20, 380, 140, 230]);
    if (bg.road) place(rnd, objs, (x, y) => ({ t: 'car', x, y, s: 1.05, c: pick(rnd, PAL.car), dir: rnd() < 0.5 ? 1 : -1, hub: '#d0d4dc' }), [40, 360, 291, 291]);
    else for (let k = 0; k < 2; k++) place(rnd, objs, (x, y) => ({ t: 'flower', x, y, s: 1.1, c: pick(rnd, PAL.flower), cc: '#ffb020' }), [16, 384, 270, 296]);
    return { bg, objs };
  }
  function sea(rnd) {
    const bg = { t: 'sea', sunset: rnd() < 0.3 };
    const objs = [];
    objs.push({ t: 'sun', x: rnd() < 0.5 ? rint(rnd, 40, 90) : rint(rnd, 310, 360), y: rint(rnd, 38, 52), s: 1, c: bg.sunset ? '#ff9636' : '#ffd23f', rays: true, face: rnd() < 0.6 });
    const pl = rnd() < 0.5;
    place(rnd, objs, x => ({ t: 'palm', x, y: 262, s: n1(0.95 + rnd() * 0.15), c: '#3a9d5d', nuts: rint(rnd, 2, 3) }), pl ? [30, 70, 0, 0] : [326, 360, 0, 0], 10);
    for (let k = 0; k < rint(rnd, 2, 3); k++) place(rnd, objs, (x, y) => ({ t: 'cloud', x, y, s: n1(0.8 + rnd() * 0.5), c: '#ffffff' }), [30, 370, 22, 96]);
    for (let k = 0; k < rint(rnd, 2, 4); k++) place(rnd, objs, (x, y) => ({ t: 'gull', x, y, s: n1(0.8 + rnd() * 0.4) }), [20, 380, 24, 112]);
    for (let k = 0; k < rint(rnd, 1, 2); k++) place(rnd, objs, (x, y) => ({ t: 'boat', x, y, s: n1(0.85 + rnd() * 0.25), hull: pick(rnd, PAL.hull), sail: '#ffffff', sail2: pick(rnd, PAL.sail), flag: true, dir: rnd() < 0.5 ? 1 : -1 }), [40, 360, 178, 192]);
    for (let k = 0; k < rint(rnd, 2, 3); k++) place(rnd, objs, (x, y) => ({ t: 'fish', x, y, s: n1(0.85 + rnd() * 0.3), c: pick(rnd, PAL.fish), dir: rnd() < 0.5 ? 1 : -1, stripe: rnd() < 0.6 }), [24, 376, 158, 198]);
    place(rnd, objs, (x, y) => ({ t: 'umb', x, y, s: 1, c: pick(rnd, ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b']), stripes: true }), [90, 310, 248, 266]);
    if (rnd() < 0.8) place(rnd, objs, (x, y) => ({ t: 'castle', x, y, s: 1, flag: true, fc: '#ef4444' }), [60, 340, 268, 292]);
    if (rnd() < 0.8) place(rnd, objs, (x, y) => ({ t: 'ball', x, y, s: 1.1, c: '#ef4444', c2: '#3b82f6' }), [30, 370, 250, 292]);
    for (let k = 0; k < rint(rnd, 1, 2); k++) place(rnd, objs, (x, y) => ({ t: 'crab', x, y, s: 1, c: '#ef4444' }), [24, 376, 240, 294]);
    for (let k = 0; k < rint(rnd, 1, 3); k++) place(rnd, objs, (x, y) => ({ t: 'sfish', x, y, s: n1(1.05 + rnd() * 0.3), c: pick(rnd, ['#ff8a3d', '#ff5d8f', '#ffd23f']) }), [20, 380, 236, 296]);
    for (let k = 0; k < rint(rnd, 1, 3); k++) place(rnd, objs, (x, y) => ({ t: 'shell', x, y, s: 1.1, c: pick(rnd, ['#ffe0ec', '#fff2c6', '#e2d6ff']) }), [20, 380, 236, 296]);
    return { bg, objs };
  }
  function room(rnd) {
    const bg = { t: 'room', wall: pick(rnd, ['#f6e7d0', '#dcecf7', '#e8f3dc', '#f7dfe6', '#ece4f7']), floor: pick(rnd, ['#c99a6b', '#b8875a', '#d6ab7a']) };
    const objs = [];
    const wl = rnd() < 0.5;
    const cc = pick(rnd, ['#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#ec4899']);
    objs.push({ t: 'window', x: wl ? rint(rnd, 74, 104) : rint(rnd, 296, 326), y: 86, cl: cc, cr: cc, cur: 'both', cross: true });
    place(rnd, objs, (x, y) => ({ t: 'frame', x, y, c: pick(rnd, ['#c8902f', '#8b5a2b', '#3b82f6']), sun: true, m: rnd() < 0.5 ? 1 : -1 }), [150, 260, 60, 100]);
    place(rnd, objs, (x, y) => ({ t: 'clock', x, y, c: pick(rnd, ['#e5534b', '#3b82f6', '#16a34a']), h: rint(rnd, 0, 11), mi: rint(rnd, 0, 11) * 5 }), [40, 360, 28, 60]);
    place(rnd, objs, (x, y) => ({ t: 'shelf', x, y, books: Array.from({ length: rint(rnd, 5, 6) }, () => [pick(rnd, PAL.book), rint(rnd, 15, 22), rint(rnd, 7, 9)]) }), [50, 350, 140, 170]);
    place(rnd, objs, (x, y) => ({ t: 'rug', x, y, c: pick(rnd, PAL.rug), dash: true }), [120, 280, 262, 272]);
    place(rnd, objs, (x, y) => ({ t: 'lamp', x, y, c: pick(rnd, PAL.shade), on: true }), [30, 370, 240, 250]);
    place(rnd, objs, (x, y) => ({ t: 'table', x, y, cup: true, steam: true, cc: pick(rnd, ['#ffffff', '#ffd23f', '#7dd3fc']), vc: pick(rnd, ['#3b82f6', '#16a34a', '#e5534b']), fc: pick(rnd, ['#ef4444', '#ffd23f', '#a855f7']) }), [50, 350, 238, 250]);
    place(rnd, objs, (x, y) => ({ t: 'cat', x, y, c: pick(rnd, PAL.cat), tail: true, dir: rnd() < 0.5 ? 1 : -1 }), [40, 360, 262, 292]);
    place(rnd, objs, (x, y) => ({ t: 'plant', x, y, c: pick(rnd, PAL.pot), lv: 5 }), [24, 376, 244, 260]);
    for (let k = 0; k < rint(rnd, 1, 2); k++) place(rnd, objs, (x, y) => ({ t: 'toy', x, y, c: pick(rnd, ['#ef4444', '#3b82f6', '#f59e0b', '#a855f7']) }), [24, 376, 266, 294]);
    return { bg, objs };
  }
  const BUILD = { village, sea, room };

  /** 다른 곳 고르기: 물건 하나에 하나씩 · 정답 원끼리 겹치지 않게 · level(1 쉬움 ~ 3 어려움)에 맞는 것부터 */
  function pickDiffs(sc, n, level, rnd) {
    const cands = [];
    sc.objs.forEach((o, i) => T[o.t].muts.forEach((m, mi) => { if (m.ok(o)) cands.push({ i, mi, m, w: m.w * (m.d <= level ? 2 : m.d === level + 1 ? 0.7 : 0.25) }); }));
    const out = [], used = new Set();
    const okAt = a => a.r >= 8 && a.x > 4 && a.x < W - 4 && a.y > 4 && a.y < H - 4 && out.every(d => { const dx = d.x - a.x, dy = d.y - a.y, m = d.r + a.r + 6; return dx * dx + dy * dy > m * m; });
    let guard = 0;
    while (out.length < n && cands.length && guard++ < 400) {
      // 「더하기」: 가끔 빈자리에 작은 물건을 새로 넣어요
      if (rnd() < 0.16) {
        const ad = pick(rnd, ADDS[sc.bg.t]), tmp = sc.objs.slice();
        const o = place(rnd, tmp, (x, y) => ad.make(rnd, x, y), ad.zone, 30, 8);
        if (o) { const a = T[o.t].bb(o), at = { x: a.x, y: a.y, r: Math.max(a.r, 10) }; if (okAt(at)) { out.push({ kind: 'add', obj: o, ...at }); continue; } }
      }
      let sum = 0; for (const c of cands) sum += c.w;
      let r = rnd() * sum, c = cands[0];
      for (const x of cands) { r -= x.w; if (r <= 0) { c = x; break; } }
      cands.splice(cands.indexOf(c), 1);
      if (used.has(c.i)) continue;
      const o = sc.objs[c.i], nb = c.m.apply(o, rnd);
      const raw = T[o.t].atAfter && nb ? c.m.at(nb) : c.m.at(o);          // 울타리 말뚝 · 책처럼 「어느 것」을 바꿨는지는 바꾼 뒤에 알아요
      const at = { x: n1(raw.x), y: n1(raw.y), r: n1(Math.max(raw.r, 9)) };
      if (!okAt(at)) continue;
      used.add(c.i);
      out.push({ kind: c.m.k, i: c.i, obj: nb, ...at });
    }
    return out;
  }
  /** 씨앗 하나로 문제 하나: { seed, theme, bg, left(물건들), right(물건들), diffs[{x, y, r, kind}] } */
  function make(seed, n = 5, level = 2, theme) {
    const rnd = rng(seed);
    const th = THEMES.includes(theme) ? theme : THEMES[Math.floor(rnd() * THEMES.length)];
    const sc = BUILD[th](rnd);
    const diffs = pickDiffs(sc, Math.max(1, Math.min(9, n)), Math.max(1, Math.min(3, level)), rnd);
    const right = sc.objs.slice();
    for (const d of diffs) { if (d.kind === 'add') right.push(d.obj); else right[d.i] = d.obj; }
    return { seed, theme: th, bg: sc.bg, left: sc.objs, right: right.filter(Boolean), diffs: diffs.map(d => ({ x: d.x, y: d.y, r: d.r, kind: d.kind })) };
  }
  /** 누른 자리(x, y) → 아직 못 찾은 다른 곳 번호 (없으면 -1) · tol: 손가락 여유 */
  function hit(diffs, x, y, found, tol = 9) {
    let best = -1, bd = 1e9;
    diffs.forEach((d, i) => {
      if (found && found[i]) return;
      const dist = Math.sqrt((d.x - x) * (d.x - x) + (d.y - y) * (d.y - y));
      if (dist <= d.r + tol && dist - d.r < bd) { bd = dist - d.r; best = i; }
    });
    return best;
  }
  /** 이미 찾은 곳을 또 눌렀나요 (틀린 걸로 치지 않아요) */
  const near = (diffs, x, y, found, tol = 9) => diffs.some((d, i) => found && found[i] && (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y) <= (d.r + tol) * (d.r + tol));

  /* ───────── 그리기 (화면만) ───────── */
  function background(bg) {
    if (bg.t === 'village') {
      const sky = bg.day ? ['#8ed0ff', '#dff4ff'] : ['#2b3a78', '#6c6fb5'];
      return `<defs><linearGradient id="sky-v${bg.day ? 1 : 0}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>`
        + `<rect width="${W}" height="${H}" fill="url(#sky-v${bg.day ? 1 : 0})"/>`
        + `<path d="M0,170 Q60,120 130,160 T270,150 T400,160 V${H} H0Z" fill="${bg.day ? bg.hill1 : '#4f7a5a'}"/>`
        + `<path d="M0,190 Q90,160 180,185 T400,180 V${H} H0Z" fill="${bg.day ? bg.hill2 : '#456c4e'}"/>`
        + `<rect y="200" width="${W}" height="${H - 200}" fill="${bg.day ? bg.ground : '#3f6a48'}"/><rect y="200" width="${W}" height="5" fill="${bg.day ? bg.g2 : '#386041'}" opacity=".7"/>`
        + (bg.road ? `<rect y="262" width="${W}" height="38" fill="#d8c7a3"/><rect y="262" width="${W}" height="3" fill="#b9a57d"/><path d="M0,281 H${W}" stroke="#fff" stroke-width="2.5" stroke-dasharray="14 12" opacity=".8"/>` : '');
    }
    if (bg.t === 'sea') {
      const sky = bg.sunset ? ['#ff9e7a', '#ffe1b8'] : ['#7cc8ff', '#d9f2ff'];
      let waves = '';
      for (let y = 150; y < 205; y += 13) waves += `<path d="M0,${y} q12,-4 24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0" fill="none" stroke="#fff" stroke-width="1.4" opacity=".35"/>`;
      return `<defs><linearGradient id="sky-s${bg.sunset ? 1 : 0}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient><linearGradient id="sea-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fa7e0"/><stop offset="1" stop-color="#1f7fc4"/></linearGradient></defs>`
        + `<rect width="${W}" height="${H}" fill="url(#sky-s${bg.sunset ? 1 : 0})"/><rect y="140" width="${W}" height="70" fill="url(#sea-s)"/>` + waves
        + `<path d="M0,212 Q100,200 200,210 T400,206 V${H} H0Z" fill="#f3d89c"/><path d="M0,212 Q100,200 200,210 T400,206" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>`;
    }
    return `<rect width="${W}" height="215" fill="${bg.wall}"/><rect y="200" width="${W}" height="15" fill="#fff" opacity=".45"/><rect y="215" width="${W}" height="${H - 215}" fill="${bg.floor}"/>`
      + Array.from({ length: 5 }, (_, k) => `<path d="M0,${232 + k * 17} H${W}" stroke="rgba(0,0,0,.12)" stroke-width="1.2"/>`).join('')
      + `<rect y="213" width="${W}" height="5" fill="#8b5a2b" opacity=".6"/>`;
  }
  /** 물건들 → SVG 안쪽 (앞뒤 순서 z, 같은 z 면 아래에 있는 것을 나중에) */
  function render(bg, objs) {
    const list = objs.slice().sort((a, b) => T[a.t].z - T[b.t].z || (a.y || 0) - (b.y || 0));
    return background(bg) + list.map(o => T[o.t].draw(o)).join('');
  }
  return { W, H, THEMES, THEME_NAMES, rng, make, hit, near, render, T };
});
