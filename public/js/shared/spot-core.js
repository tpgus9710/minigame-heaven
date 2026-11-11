/* =====================================================================
 *  🔍 틀린그림찾기 v2 (v13.5) — 씨앗(seed) 하나로 실사풍 그림 두 장과 「다른 곳」을 똑같이 만들어요.
 *   화면(싱글 · AI 대결)과 서버(멀티: games/spot.js)가 같은 코드를 써서, 서버는 누른 자리가 맞는지만 확인해요.
 *   장면은 shared/spot/*.js 에 하나씩 (과일 가게 · 책장 · 밤의 도시 · 바닷속 · 책상 위 · 주차장 · 정원 · 우주 …)
 *   그림 크기 400 × 300 (그리기는 캔버스에 2~3배로 선명하게) · 정답 자리는 원(x, y, r)이에요.
 *   어려움 level 1(쉬움) ~ 4.5(지옥): 높을수록 비슷한 색 · 작은 부분 · 개수 · 글자처럼 헷갈리는 차이가 나와요.
 *   ⚠️ 장면 · 다른 곳을 고를 때는 rnd 와 사칙연산 · sqrt 만 써요 (기기마다 sin · cos 끝자리가 달라도 정답이 같게).
 *      그리기(paint)는 화면에서만 — 왼쪽 · 오른쪽을 같은 순서 · 같은 씨앗으로 그려서 다른 곳 말고는 한 점도 다르지 않아요.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const api = factory();
    module.exports = api;
    for (const f of api.FILES) require('./spot/' + f + '.js')(api);       // 서버 · 검사: 장면 파일을 여기서 불러와요
  } else root.SpotCore = factory();                                      // 화면: index.html 이 장면 파일을 따로 불러와요
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 400, H = 300;
  const FILES = ['fruit', 'shelf', 'city', 'reef', 'desk', 'parking', 'garden', 'space'];
  const SCENES = {}, TYPES = {}, THEMES = [], THEME_NAMES = {};

  /* ───────── 난수 · 계산 도우미 (정답을 정할 때 쓰는 것들: 기기마다 같은 결과) ───────── */
  /** 씨앗 → 0 ~ 1 난수 (Park–Miller · 씨앗을 한 번 잘 섞어요) */
  function rng(seed) {
    let h = Math.abs(Math.floor(seed)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
    let s = h % 2147483646 + 1;
    const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
    next(); next();
    return next;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
  const rint = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const n1 = v => Math.round(v * 10) / 10;
  const shuffle = (rnd, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbHex = a => '#' + a.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  function rgbHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; }
    return [h, s, l];
  }
  function hslRgb([h, s, l]) {
    h = (((h % 360) + 360) % 360) / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = t < 0 ? t + 1 : t > 1 ? t - 1 : t; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  /** 색 차이 (R · G · B 차이 합) */
  const cdist = (a, b) => { const x = hexRgb(a), y = hexRgb(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]); };
  /** 어려울수록 비슷한 색으로 (RGB 차이 합 목표: 쉬움 220 → 지옥 95 · 그림자 · 색감 처리 뒤에도 보이게) */
  const colorNeed = lv => (lv < 1.5 ? 220 : lv < 2.5 ? 160 : lv < 3.5 ? 120 : 95);
  function shift(rnd, hex, lv) {
    const [h, s, l] = rgbHsl(hexRgb(hex)), need = colorNeed(lv);
    let best = hex, bd = 1e9;
    for (let k = 0; k < 24; k++) {
      let nh = h, ns = s, nl = l;
      if (s > 0.22 && rnd() < 0.65) nh = h + (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 160);
      else nl = clamp(l + (rnd() < 0.5 ? -1 : 1) * (0.06 + rnd() * 0.36), 0.05, 0.95);
      if (rnd() < 0.3) ns = clamp(s + (rnd() - 0.5) * 0.4, 0, 1);
      const c = rgbHex(hslRgb([nh, ns, nl])), d = cdist(c, hex);
      const sc = Math.abs(d - need) + (d < need * 0.85 ? 500 : 0);
      if (sc < bd) { bd = sc; best = c; }
    }
    return best;
  }
  /** 팔레트에서 지금 색과 (어려움에 맞게) 다른 색 하나 */
  function other(rnd, list, cur, lv = 1) {
    const need = colorNeed(lv) * 0.7, ok = list.filter(c => c !== cur && cdist(c, cur) >= need);
    const near = ok.slice().sort((a, b) => Math.abs(cdist(a, cur) - colorNeed(lv)) - Math.abs(cdist(b, cur) - colorNeed(lv)));
    return near.length ? near[Math.min(near.length - 1, Math.floor(rnd() * Math.min(3, near.length)))] : shift(rnd, cur, lv);
  }
  /** 두 원을 모두 덮는 원 */
  function union(a, b) {
    if (!b) return a;
    if (!a) return b;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d + b.r <= a.r) return a;
    if (d + a.r <= b.r) return b;
    const r = (d + a.r + b.r) / 2, k = d ? (r - a.r) / d : 0;
    return { x: a.x + dx * k, y: a.y + dy * k, r };
  }
  /** 글자 자리 (기기마다 글꼴이 달라도 글자 칸은 같게): 숫자 0.6 · 영어 0.62 · 쉼표 0.32 · 빈칸 0.3 · 한글 1 (글자 크기 배) */
  const adv = (ch, size) => size * (/[0-9]/.test(ch) ? 0.6 : /[,.:'\-]/.test(ch) ? 0.32 : ch === ' ' ? 0.3 : /[A-Za-z]/.test(ch) ? 0.62 : 1);
  const textW = (s, size) => { let w = 0; for (const ch of s) w += adv(ch, size); return w; };
  /** s 의 i번째 글자 가운데 x */
  function charX(s, i, size, x, align = 'center') {
    let x0 = align === 'center' ? x - textW(s, size) / 2 : align === 'right' ? x - textW(s, size) : x, k = 0;
    for (const ch of s) { if (k === i) return x0 + adv(ch, size) / 2; x0 += adv(ch, size); k++; }
    return x0;
  }
  /** 숫자 하나 바꾸기 → [새 글자, 바뀐 자리] (0 은 그대로 두고, 바뀐 숫자는 모양이 많이 다르게) */
  function digitSwap(rnd, s) {
    const chars = [...s], idx = chars.map((ch, i) => (/[1-9]/.test(ch) ? i : -1)).filter(i => i >= 0);
    if (!idx.length) return [s, -1];
    const i = pick(rnd, idx), d = +chars[i], to = { 1: [4, 7], 2: [5, 7], 3: [8, 6], 4: [1, 9], 5: [2, 6], 6: [5, 8], 7: [1, 2], 8: [3, 6], 9: [4, 6] }[d];
    chars[i] = String(pick(rnd, to));
    return [chars.join(''), i];
  }
  const U = { rng, clamp, pick, rint, n1, shuffle, hexRgb, rgbHex, rgbHsl, hslRgb, cdist, shift, other, union, colorNeed, adv, textW, charX, digitSwap };

  /* ───────── 장면 · 물건 등록 ─────────
   *  scene(name, { name: '🍎 과일 가게', build(rnd, lv) → { bg, objs }, adds: [{ zone: [x0, x1, y0, y1], r, make(rnd, x, y, lv) }], back(c, bg, X), front?(c, bg, X), tone })
   *  type(name, { z, bb(o) → {x, y, r}, muts: [{ k, d(1~4 어려움), w(비율), ok?(o, lv), apply(o, rnd, lv) → 바뀐 물건 · null(없앰) · undefined(못 바꿈), at?(o, nb) → 원 }], draw(c, o, X) }) */
  function scene(name, def) { SCENES[name] = def; if (!THEMES.includes(name)) THEMES.push(name); THEME_NAMES[name] = def.name; }
  function type(name, def) { TYPES[name] = def; }
  const bbOf = o => TYPES[o.t].bb(o);

  /** 바뀐 곳 가운데가 나중에 그리는(위에 덮이는) 물건에 가려지나요 — 가려진 차이는 못 찾으니 고르지 않아요 */
  const after = (q, o) => { const a = TYPES[q.t].z, b = TYPES[o.t].z; return a > b || (a === b && (q.y > o.y || (q.y === o.y && q.id > o.id))); };
  function covers(q, x, y) {
    const T = TYPES[q.t];
    if (T.cover) return T.cover(q, x, y);
    const b = T.bb(q), dx = b.x - x, dy = b.y - y, m = b.r - 4;
    return m > 0 && dx * dx + dy * dy < m * m;
  }
  const hidden = (objs, o, at) => objs.some(q => q !== o && !q.bgo && !q.ghost && after(q, o) && covers(q, at.x, at.y));
  /** 어려움에 맞는 차이일수록 자주 (쉬운 판엔 큰 차이, 어려운 판엔 작은 · 헷갈리는 차이) */
  const lvW = (d, lv) => { const g = d - lv; return g <= -2.5 ? 0.12 : g <= -1.5 ? 0.35 : g <= -0.5 ? 0.9 : g <= 0.5 ? 1.6 : g <= 1.5 ? 0.4 : 0.06; };
  function pickDiffs(sc, theme, n, lv, rnd) {
    const S = SCENES[theme], cands = [];
    sc.objs.forEach((o, i) => (TYPES[o.t].muts || []).forEach(m => { if (!m.ok || m.ok(o, lv)) cands.push({ i, m, w: (m.w || 1) * lvW(m.d, lv) }); }));
    const out = [], used = new Set();
    const okAt = a => a.r >= 9 && a.r <= 48 && a.x > 3 && a.x < W - 3 && a.y > 3 && a.y < H - 3
      && out.every(d => { const dx = d.x - a.x, dy = d.y - a.y, m = d.r + a.r + 6; return dx * dx + dy * dy > m * m; });
    const free = (x, y, r) => sc.objs.every(o => { if (o.bgo) return true; const b = bbOf(o), dx = b.x - x, dy = b.y - y, m = b.r + r + 2; return dx * dx + dy * dy > m * m; });
    let guard = 0, addId = 1000;
    while (out.length < n && guard++ < 700) {
      if (S.adds && S.adds.length && rnd() < 0.13) {                         // 빈자리에 작은 물건이 새로 생겨요
        const ad = pick(rnd, S.adds), [x0, x1, y0, y1] = ad.zone;
        for (let t = 0; t < 12; t++) {
          const x = n1(x0 + rnd() * (x1 - x0)), y = n1(y0 + rnd() * (y1 - y0));
          if (!free(x, y, ad.r)) continue;
          const o = ad.make(rnd, x, y, lv);
          o.id = ++addId;
          const b = bbOf(o), at = { x: n1(b.x), y: n1(b.y), r: n1(Math.max(9, b.r)) };
          if (okAt(at)) { out.push({ kind: 'add', obj: o, ...at, d: ad.d || 2 }); sc.objs.push({ ...o, ghost: 1 }); }
          break;
        }
        continue;
      }
      if (!cands.length) break;
      let sum = 0; for (const c of cands) sum += c.w;
      let r = rnd() * sum, c = cands[0];
      for (const x of cands) { r -= x.w; if (r <= 0) { c = x; break; } }
      cands.splice(cands.indexOf(c), 1);
      if (used.has(c.i) || sc.objs[c.i].ghost) continue;
      const o = sc.objs[c.i], nb = c.m.apply(o, rnd, lv);
      if (nb === undefined) continue;
      const raw = c.m.at ? c.m.at(o, nb) : union(bbOf(o), nb ? bbOf(nb) : null);
      const at = { x: n1(raw.x), y: n1(raw.y), r: n1(Math.max(9, raw.r)) };
      if (!okAt(at) || hidden(sc.objs, o, at)) continue;
      used.add(c.i);
      out.push({ kind: c.m.k, i: c.i, obj: nb, ...at, d: c.m.d });
    }
    sc.objs = sc.objs.filter(o => !o.ghost);
    return out;
  }
  /** 씨앗 하나로 문제 하나: { seed, theme, lv, bg, left(물건들), right(물건들), diffs[{x, y, r, kind}] } */
  function make(seed, n = 5, level = 2, theme) {
    const rnd = rng(seed), lv = clamp(+level || 2, 1, 4.5);
    const th = THEMES.includes(theme) ? theme : THEMES[Math.floor(rnd() * THEMES.length)];
    const sc = SCENES[th].build(rnd, lv);
    sc.objs.forEach((o, i) => { o.id = i + 1; });
    const diffs = pickDiffs(sc, th, clamp(Math.round(n), 1, 12), lv, rnd);
    const right = sc.objs.slice();
    for (const d of diffs) if (d.kind !== 'add') right[d.i] = d.obj;
    for (const d of diffs) if (d.kind === 'add') right.push(d.obj);
    return { seed, theme: th, lv, bg: sc.bg, left: sc.objs, right: right.filter(Boolean), diffs: diffs.map(d => ({ x: d.x, y: d.y, r: d.r, kind: d.kind, d: d.d })) };
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

  /* ───────── 그리기 도우미 (화면만 · 빛은 왼쪽 위에서) ───────── */
  const P = {
    rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; },
    /** k > 0 밝게(흰색 쪽) · k < 0 어둡게(검은색 쪽) */
    lit(hex, k) { const c = hexRgb(hex); return rgbHex(c.map(v => (k >= 0 ? v + (255 - v) * k : v * (1 + k)))); },
    mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); },
    rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); },
    ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); },
    /** 부드러운 그림자 (흐림 필터 없이 방사형 그라데이션) */
    shadow(c, x, y, rx, ry, a = 0.32) {
      c.save(); c.translate(x, y); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
    },
    /** 공 모양 음영 (경로를 먼저 만든 뒤 fill 대신 불러요) */
    ballFill(c, x, y, r, col, hi = 0.42, lo = -0.5) {
      const g = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r * 1.08);
      g.addColorStop(0, P.lit(col, hi)); g.addColorStop(0.35, col); g.addColorStop(0.85, P.lit(col, lo * 0.7)); g.addColorStop(1, P.lit(col, lo));
      c.fillStyle = g; c.fill();
    },
    ball(c, x, y, r, col, hi, lo) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); P.ballFill(c, x, y, r, col, hi, lo); },
    spec(c, x, y, r, a = 0.55) { P.ell(c, x - r * 0.36, y - r * 0.42, r * 0.28, r * 0.17, -0.6); c.fillStyle = `rgba(255,255,255,${a})`; c.fill(); },
    /** 세로 그라데이션 (위 밝게 → 아래 어둡게) */
    vgrad(c, y0, y1, col, hi = 0.14, lo = -0.18) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, P.lit(col, hi)); g.addColorStop(1, P.lit(col, lo)); return g; },
    hgrad(c, x0, x1, col, hi = 0.14, lo = -0.22) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, P.lit(col, hi)); g.addColorStop(0.45, col); g.addColorStop(1, P.lit(col, lo)); return g; },
    /** 글자 칸을 고정해서 한 글자씩 (U.charX 와 같은 자리 — 정답 원이 글꼴과 상관없이 맞아요) */
    mono(c, s, x, y, size, col, weight = 700, align = 'center', font = '"Noto Sans KR", sans-serif') {
      c.font = `${weight} ${size}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col;
      let x0 = align === 'center' ? x - textW(s, size) / 2 : align === 'right' ? x - textW(s, size) : x;
      for (const ch of s) { const a = adv(ch, size); if (ch !== ' ') c.fillText(ch, x0 + a / 2, y); x0 += a; }
    },
    /** 글자 (테두리 없이) */
    text(c, s, x, y, size, col, weight = 700, align = 'center', font = '"Noto Sans KR", sans-serif') {
      c.font = `${weight} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y);
    },
  };
  /** 씨앗으로 만든 이음새 없는 잡음 무늬 (캔버스) — 같은 씨앗이면 같은 무늬 · 기기 안에서 한 번만 만들어요 */
  const noiseCache = new Map();
  function noiseCanvas(seed, size, cell, octaves = 3) {
    const key = `${seed}:${size}:${cell}:${octaves}`;
    if (noiseCache.has(key)) return noiseCache.get(key);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d'), img = c.createImageData(size, size), R = rng(seed), acc = new Float32Array(size * size);
    let amp = 1, tot = 0;
    for (let o = 0; o < octaves; o++) {
      const n = Math.max(2, Math.round(size / (cell / (1 << o)))), grid = Array.from({ length: n * n }, () => R());
      const at = (i, j) => grid[((j % n + n) % n) * n + ((i % n + n) % n)];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const fx = x / size * n, fy = y / size * n, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
        acc[y * size + x] += (a + (b - a) * sy) * amp;
      }
      tot += amp; amp *= 0.5;
    }
    for (let k = 0; k < size * size; k++) { const v = Math.round(acc[k] / tot * 255); img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
    noiseCache.set(key, cv);
    return cv;
  }
  /** 잡음 무늬를 경로 안에 덧칠 (나무결 · 천 · 돌 · 아스팔트 질감) — mode: 'overlay' · 'multiply' · 'soft-light' */
  function texture(c, seed, alpha, mode = 'overlay', cell = 24, sx = 1, sy = 1, size = 128) {
    const cv = noiseCanvas(seed, size, cell), pat = c.createPattern(cv, 'repeat');
    if (pat && pat.setTransform && (sx !== 1 || sy !== 1) && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(sx, sy));
    c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = mode; c.fillStyle = pat; c.fill(); c.restore();
  }
  /** 그림 전체 마무리: 색감 · 가장자리 어둡게 · 사진 같은 알갱이 (왼쪽 · 오른쪽 똑같이) */
  function finish(c, puz, X) {
    const S = SCENES[puz.theme], tone = (S.tone && S.tone(puz.bg)) || '#ffd8a8';
    c.save();
    c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.22; c.fillStyle = tone; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.34)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.beginPath(); c.rect(0, 0, W, H);
    texture(c, 7, 0.09, 'overlay', 2.2, 0.5, 0.5, 128);                         // 알갱이 무늬는 하나만 만들어 두고 계속 써요
    c.restore();
  }
  /** 그리기: 캔버스 · 문제 · 0(왼쪽) / 1(오른쪽) · Q(선명도 배율) */
  function paint(cv, puz, side, Q = 2) {
    const S = SCENES[puz.theme], c = cv.getContext('2d');
    if (cv.width !== Math.round(W * Q) || cv.height !== Math.round(H * Q)) { cv.width = Math.round(W * Q); cv.height = Math.round(H * Q); }
    c.setTransform(Q, 0, 0, Q, 0, 0);
    c.clearRect(0, 0, W, H);
    const X = { seed: puz.seed, lv: puz.lv, bg: puz.bg, Q, R: k => rng((puz.seed % 1000003) * 131 + k * 7919 + 17), tex: texture, noise: noiseCanvas, P, U };
    c.save(); S.back(c, puz.bg, X); c.restore();
    const objs = (side ? puz.right : puz.left).slice().sort((a, b) => (TYPES[a.t].z - TYPES[b.t].z) || (a.y - b.y) || (a.id - b.id));
    for (const o of objs) { c.save(); TYPES[o.t].draw(c, o, X); c.restore(); }
    if (S.front) { c.save(); S.front(c, puz.bg, X); c.restore(); }
    finish(c, puz, X);
  }

  return { W, H, FILES, THEMES, THEME_NAMES, SCENES, T: TYPES, U, P, rng, scene, type, make, hit, near, paint, texture, noiseCanvas, bbOf };
});
