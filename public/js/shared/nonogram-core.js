/* =====================================================================
 *  🖼️ 노노그램 규칙 · 퍼즐 만들기 — 화면(싱글)과 서버(멀티 대결)가 같은 코드를 써요.
 *   - 줄 옆 숫자(단서) = 그 줄에 칠해진 칸 덩어리의 길이 (순서대로, 덩어리 사이는 한 칸 이상 비어요)
 *   - 줄 풀이기: 한 줄에 단서를 놓을 수 있는 모든 경우를 따져서 「반드시 칠해지는 칸 · 반드시 빈 칸」을 찾아요.
 *     가로 · 세로를 번갈아 끝까지 풀리면 → 답이 하나뿐이고, 찍지 않고 풀 수 있는 퍼즐이에요 (그런 것만 내요).
 *   - 퍼즐: 직접 그린 그림 + 무작위 무늬(뭉쳐 보이게 다듬은 뒤 대칭)
 *   - 힌트: 지금 판에서 줄 하나만 보고 알 수 있는 칸과 그 이유
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NonogramCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** 한 줄(0/1 배열)의 단서 */
  const clue = line => { const out = []; let n = 0; for (const v of line) { if (v === 1) n++; else if (n) { out.push(n); n = 0; } } if (n) out.push(n); return out; };
  const rowOf = (g, w, r) => g.slice(r * w, r * w + w);
  const colOf = (g, w, h, c) => Array.from({ length: h }, (_, r) => g[r * w + c]);
  const cluesOf = (g, w, h) => ({ rows: Array.from({ length: h }, (_, r) => clue(rowOf(g, w, r))), cols: Array.from({ length: w }, (_, c) => clue(colOf(g, w, h, c))) });

  /** 줄 풀이: known(-1 모름 · 0 빈칸 · 1 칠함) → 새 known, 모순이면 null */
  function lineSolve(cl, known) {
    const n = known.length, k = cl.length;
    const filledIn = new Int32Array(n + 1);           // [0,i) 안의 「칠함 확정」 수
    const emptyIn = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) { filledIn[i + 1] = filledIn[i] + (known[i] === 1); emptyIn[i + 1] = emptyIn[i] + (known[i] === 0); }
    const anyFilled = (a, b) => filledIn[b] - filledIn[a] > 0, anyEmpty = (a, b) => emptyIn[b] - emptyIn[a] > 0;
    // can[i][j]: i 번째 칸부터 끝까지에 j 번째 이후 덩어리를 놓을 수 있나
    const can = Array.from({ length: n + 2 }, () => new Uint8Array(k + 1));
    for (let i = n + 1; i >= 0; i--) {
      for (let j = k; j >= 0; j--) {
        if (i > n) { can[i][j] = 0; continue; }
        if (j === k) { can[i][j] = !anyFilled(i, n) ? 1 : 0; continue; }
        let ok = 0;
        if (i < n && known[i] !== 1 && can[i + 1][j]) ok = 1;
        const L = cl[j];
        if (!ok && i + L <= n && !anyEmpty(i, i + L) && (i + L === n || known[i + L] !== 1)) {
          const next = i + L === n ? n : i + L + 1;
          if (can[next][j + 1]) ok = 1;
        }
        can[i][j] = ok;
      }
    }
    if (!can[0][0]) return null;
    const canFill = new Uint8Array(n), canEmpty = new Uint8Array(n);
    const reach = Array.from({ length: n + 2 }, () => new Uint8Array(k + 1));
    reach[0][0] = 1;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= k; j++) {
        if (!reach[i][j] || !can[i][j]) continue;
        if (j === k) { for (let c = i; c < n; c++) canEmpty[c] = 1; continue; }
        if (i < n && known[i] !== 1 && can[i + 1][j]) { canEmpty[i] = 1; reach[i + 1][j] = 1; }
        const L = cl[j];
        if (i + L <= n && !anyEmpty(i, i + L) && (i + L === n || known[i + L] !== 1)) {
          const next = i + L === n ? n : i + L + 1;
          if (can[next][j + 1]) {
            for (let c = i; c < i + L; c++) canFill[c] = 1;
            if (i + L < n) canEmpty[i + L] = 1;
            reach[next][j + 1] = 1;
          }
        }
      }
    }
    const out = known.slice();
    for (let c = 0; c < n; c++) {
      if (!canFill[c] && !canEmpty[c]) return null;
      if (canFill[c] && !canEmpty[c]) out[c] = 1;
      else if (!canFill[c] && canEmpty[c]) out[c] = 0;
    }
    return out;
  }
  /** 가로 · 세로 줄 풀이를 번갈아 끝까지 → { solved, grid(known), steps } */
  function solve(w, h, rows, cols, start) {
    const g = start ? start.slice() : new Array(w * h).fill(-1);
    let changed = true, steps = 0;
    while (changed) {
      changed = false; steps++;
      for (let r = 0; r < h; r++) {
        const cur = rowOf(g, w, r), nx = lineSolve(rows[r], cur);
        if (!nx) return { solved: false, bad: true, grid: g, steps };
        for (let c = 0; c < w; c++) if (nx[c] !== cur[c]) { g[r * w + c] = nx[c]; changed = true; }
      }
      for (let c = 0; c < w; c++) {
        const cur = colOf(g, w, h, c), nx = lineSolve(cols[c], cur);
        if (!nx) return { solved: false, bad: true, grid: g, steps };
        for (let r = 0; r < h; r++) if (nx[r] !== cur[r]) { g[r * w + c] = nx[r]; changed = true; }
      }
    }
    return { solved: g.every(v => v !== -1), grid: g, steps };
  }

  /* ─────────────── 그림 퍼즐 (직접 그림: # 칠함 · . 빈칸) ─────────────── */
  const PICTURES = [
    { name: '하트', art: ['.##....##.', '####..####', '##########', '##########', '##########', '.########.', '..######..', '...####...', '....##....', '..........'] },
    { name: '집', art: ['....##....', '...####...', '..######..', '.########.', '##########', '.#......#.', '.#.##.#.#.', '.#.##...#.', '.#.##.###.', '.########.'] },
    { name: '고양이', art: ['#........#', '##......##', '###....###', '##########', '#..####..#', '#.#.##.#.#', '##########', '###.##.###', '.########.', '..######..'] },
    { name: '로봇', art: ['....##....', '....##....', '.########.', '.#..##..#.', '.########.', '..######..', '#.######.#', '#.######.#', '..##..##..', '.###..###.'] },
    { name: '나무', art: ['....##....', '...####...', '..######..', '.########.', '..######..', '.########.', '##########', '....##....', '....##....', '..######..'] },
    { name: '별', art: ['....##....', '.....#....', '...####...', '##########', '.########.', '..######..', '..######..', '.###..###.', '.##....##.', '#........#'] },
    { name: '우산', art: ['....##....', '..######..', '.########.', '##########', '#.#.##.#.#', '....##....', '....##....', '....##....', '..#.##....', '..####....'] },
    { name: '물고기', art: ['..........', '...####...', '.#######.#', '##.######.', '#########.', '#########.', '#########.', '.#######.#', '...####...', '..........'] },
    { name: '음표', art: ['....######', '....######', '....#....#', '....#....#', '....#....#', '....#....#', '.####..###', '#####.####', '#####.####', '.###...##.'] },
    { name: '오리', art: ['...###....', '..#####...', '..##.##...', '..#####...', '#####.....', '..######.#', '.#########', '.#########', '..#######.', '...#####..'] },
    { name: '자동차', art: ['...............', '....######.....', '...#.#..#.##...', '..#..#..#..#...', '.#############.', '###############', '###############', '#####.####.####', '.###...##...###', '.....#....#....', '...............', '...............', '...............', '...............', '...............'] },
    { name: '로켓', art: ['.......#.......', '......###......', '.....#####.....', '.....##.##.....', '.....#...#.....', '.....##.##.....', '.....#####.....', '.....#####.....', '....#######....', '...##.###.##...', '..###.###.###..', '..##..###..##..', '......#.#......', '.....#...#.....', '......#.#......'] },
    { name: '해골', art: ['....#######....', '..###########..', '.#############.', '.#############.', '###...###...###', '###...###...###', '###...###...###', '######.#.######', '.#####...#####.', '..###########..', '...#.#.#.#.#...', '...#########...', '....#.#.#.#....', '.....#####.....', '...............'] },
    { name: '하트 화살', art: ['...............', '..###...###....', '.#####.#####...', '#############..', '#############.#', '.###########.#.', '..#########.#..', '...#######.#...', '....#####.#....', '....####.#.....', '......#.#......', '.....#.#.......', '....###........', '...............', '...............'] },
    { name: '버섯', art: ['...............', '.....#####.....', '...#########...', '..###########..', '.####.###.####.', '.###...#...###.', '###############', '###############', '.#############.', '....#######....', '....#.....#....', '....#.#.#.#....', '....#.....#....', '....#######....', '...............'] },
    { name: '강아지', art: ['...............', '.##.........##.', '####.......####', '####.#####.####', '###.#######.###', '.#.#########.#.', '...##.###.##...', '...##.###.##...', '...#########...', '...####.####...', '....#.....#....', '....##...##....', '.....#####.....', '......###......', '...............'] },
    { name: '커피잔', art: ['...............', '....#..#..#....', '...#..#..#.....', '....#..#..#....', '...............', '.###########...', '.#.........###.', '.#.........#.#.', '.#.........#.#.', '.#.........###.', '..#.......#....', '...#######.....', '#############..', '.###########...', '...............'] },
  ];
  const parseArt = art => { const h = art.length, w = art[0].length; const g = []; for (const row of art) for (const ch of row) g.push(ch === '#' ? 1 : 0); return { w, h, g }; };
  /** 이 그림이 줄 풀이로 끝까지 풀리나 (답이 하나뿐) */
  const unique = (w, h, g) => { const c = cluesOf(g, w, h); return solve(w, h, c.rows, c.cols).solved; };
  const GOOD = PICTURES.map(p => ({ ...p, ...parseArt(p.art) })).filter(p => p.w === p.h && (p.w === 10 || p.w === 15) && p.g.some(Boolean) && unique(p.w, p.h, p.g));

  /* ─────────────── 무작위 무늬 ─────────────── */
  function randomPic(size, rnd) {
    const w = size, h = size;
    for (let tries = 0; tries < 400; tries++) {
      let g = Array.from({ length: w * h }, () => (rnd() < 0.56 ? 1 : 0));
      // 이웃을 보고 다듬기 (흩어진 점 대신 덩어리 모양)
      for (let it = 0; it < 2; it++) {
        const n = g.slice();
        for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
          let s = 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < h && cc >= 0 && cc < w) s += g[rr * w + cc]; }
          n[r * w + c] = s >= 5 ? 1 : s <= 3 ? 0 : g[r * w + c];
        }
        g = n;
      }
      if (size >= 10 && rnd() < 0.6) for (let r = 0; r < h; r++) for (let c = 0; c < w / 2; c++) g[r * w + (w - 1 - c)] = g[r * w + c];   // 좌우 대칭
      const fill = g.reduce((a, v) => a + v, 0) / (w * h);
      if (fill < 0.35 || fill > 0.72) continue;
      if (unique(w, h, g)) return { w, h, g, name: '무작위 무늬' };
    }
    // (거의 없지만) 못 찾으면 가로줄 무늬 — 늘 풀려요
    const g = Array.from({ length: w * h }, (_, i) => (Math.floor(i / w) % 2 ? 1 : 0));
    return { w, h, g, name: '줄무늬' };
  }
  const LEVELS = { s5: { label: '입문 5×5', size: 5 }, s10: { label: '보통 10×10', size: 10 }, s15: { label: '어려움 15×15', size: 15 } };
  /** 퍼즐 하나 → { w, h, sol: '0101…', rows, cols, name, pic } (pic = 그림 번호 · 무작위는 -1) */
  function make(level = 's10', opts = {}) {
    const L = LEVELS[level] || LEVELS.s10, rnd = opts.seed == null ? Math.random : rng(opts.seed);
    let P = null, pic = -1;
    const pool = GOOD.map((p, i) => ({ p, i })).filter(x => x.p.w === L.size && !(opts.skip || []).includes(x.p.name));
    if (L.size > 5 && pool.length && (opts.picture === true || (opts.picture !== false && rnd() < 0.5))) { const x = pool[Math.floor(rnd() * pool.length)]; P = x.p; pic = x.i; }
    if (!P) P = randomPic(L.size, rnd);
    const c = cluesOf(P.g, P.w, P.h);
    return { w: P.w, h: P.h, sol: P.g.join(''), rows: c.rows, cols: c.cols, name: P.name, pic, level };
  }

  /* ─────────────── 화면 도구 ─────────────── */
  /** 줄이 단서와 딱 맞나 (칠한 칸 = 1, 나머지는 빈칸으로 보고) */
  const lineDone = (cl, line) => { const got = clue(line.map(v => (v === 1 ? 1 : 0))); return got.length === cl.length && got.every((x, i) => x === cl[i]); };
  /** 가르쳐 주는 힌트: 맞게 칠한 칸 · 맞게 X 한 칸만 믿고, 줄 하나에서 새로 알 수 있는 칸 → { line:'row'|'col', idx, cells:[i…], fill } */
  function hint(w, h, rows, cols, sol, cur) {
    const S = Array.from(sol, Number);
    const known = cur.map((v, i) => (v === 1 && S[i] === 1 ? 1 : v === 2 && S[i] === 0 ? 0 : -1));
    const wrong = cur.findIndex((v, i) => v === 1 && S[i] === 0);
    if (wrong >= 0) return { kind: 'wrong', cells: [wrong], fill: false, line: 'row', idx: Math.floor(wrong / w), text: `${Math.floor(wrong / w) + 1}번째 줄 ${wrong % w + 1}번째 칸은 칠하면 안 되는 칸이에요.` };
    let best = null;
    const consider = (line, idx, cl, before, cellIdx) => {
      const nx = lineSolve(cl, before); if (!nx) return;
      const fills = [], empties = [];
      nx.forEach((v, k) => { if (before[k] === -1 && v !== -1) (v === 1 ? fills : empties).push(cellIdx(k)); });
      if (!fills.length && !empties.length) return;
      const score = fills.length * 2 + empties.length;                       // 칠할 칸이 많은 줄을 먼저 알려 줘요
      if (!best || score > best.score) best = { line, idx, fills, empties, score, cl };
    };
    for (let r = 0; r < h; r++) consider('row', r, rows[r], rowOf(known, w, r), k => r * w + k);
    for (let c = 0; c < w; c++) consider('col', c, cols[c], colOf(known, w, h, c), k => k * w + c);
    if (!best) return null;
    const where = best.line === 'row' ? `${best.idx + 1}번째 가로줄` : `${best.idx + 1}번째 세로줄`;
    const cl = best.cl.length ? best.cl.join(' ') : '0';
    const fill = best.fills.length > 0;
    return {
      kind: 'line', line: best.line, idx: best.idx, cells: fill ? best.fills : best.empties, fill,
      text: fill ? `${where}의 단서 [${cl}]를 놓을 수 있는 모든 경우에 공통으로 칠해지는 칸이 있어요.`
        : `${where}의 단서 [${cl}]로는 이 칸들이 칠해질 수 없어요 → X 표시.`,
    };
  }
  /** 멀티 진행률: 칠한 칸 수 기준(정답 여부는 안 알려 줘요) · 다 맞으면 done · 정답률(끝날 때 순위용) */
  function progress(sol, str) {
    if (typeof str !== 'string' || str.length !== sol.length || /[^012]/.test(str)) return null;
    let need = 0, filled = 0, right = 0, wrongFill = 0;
    for (let i = 0; i < sol.length; i++) {
      const f = str[i] === '1';
      if (sol[i] === '1') { need++; if (f) right++; }
      else if (f) wrongFill++;
      if (f) filled++;
    }
    const done = right === need && wrongFill === 0;
    return { pct: done ? 100 : Math.min(99, Math.floor(filled / Math.max(1, need) * 100)), done, acc: Math.max(0, Math.floor((right - wrongFill) / Math.max(1, need) * 100)) };
  }
  return { LEVELS, PICTURES: GOOD, clue, cluesOf, lineSolve, solve, unique, make, randomPic, lineDone, hint, progress, rng };
});
