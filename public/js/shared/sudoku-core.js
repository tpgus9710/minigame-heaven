/* =====================================================================
 *  🔢 스도쿠 규칙 · 퍼즐 만들기 — 화면(싱글)과 서버(멀티 대결)가 같은 코드를 써요.
 *   - 판: 81칸 배열 (0 = 빈칸), 가로줄 · 세로줄 · 3×3 칸마다 1~9가 한 번씩
 *   - 퍼즐 만들기: 무작위 정답판 → 대칭으로 칸을 지우며 「답이 하나뿐」인지 확인 (풀이 개수 세기)
 *   - 난이도: 사람이 쓰는 풀이 기법으로 끝까지 풀어 보고, 가장 어려운 기법으로 정해요 (찍기 없이 풀리는 퍼즐만)
 *       쉬움 = 한 칸에 숫자 하나 · 한 줄에 자리 하나 (싱글)  /  보통 = 자리 하나(숨은 싱글)가 꼭 필요
 *       어려움 = 후보 지우기(포인팅 · 박스-줄 · 짝)가 꼭 필요
 *   - 힌트: 지금 판에서 바로 알 수 있는 칸 하나와 그 이유를 알려 줘요 (가르쳐 주는 힌트)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SudokuCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ALL = 0x3fe;                                         // 1~9 비트 (1 << d)
  const ROW = i => Math.floor(i / 9), COL = i => i % 9, BOX = i => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
  const UNITS = [];                                          // 27개: 가로 0~8 · 세로 9~17 · 칸 18~26
  for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) { const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3; UNITS.push(Array.from({ length: 9 }, (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3))); }
  const UNIT_OF = Array.from({ length: 81 }, (_, i) => [ROW(i), 9 + COL(i), 18 + BOX(i)]);
  const PEERS = Array.from({ length: 81 }, (_, i) => { const s = new Set(); for (const u of UNIT_OF[i]) for (const j of UNITS[u]) if (j !== i) s.add(j); return [...s]; });
  const bits = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  const digitsOf = m => { const out = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d); return out; };
  const UNIT_NAME = u => (u < 9 ? `${u + 1}번째 가로줄` : u < 18 ? `${u - 8}번째 세로줄` : `${['왼쪽 위', '가운데 위', '오른쪽 위', '왼쪽 가운데', '한가운데', '오른쪽 가운데', '왼쪽 아래', '가운데 아래', '오른쪽 아래'][u - 18]} 3×3 칸`);

  /** 시드 난수 (멀티에서 같은 퍼즐이 필요할 때) */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ─────────────── 풀이 개수 세기 (찍어 보며 모두 찾기, limit 개까지) ─────────────── */
  function count(grid, limit = 2) {
    const g = grid.slice(), rows = new Uint16Array(9), cols = new Uint16Array(9), boxs = new Uint16Array(9);
    for (let i = 0; i < 81; i++) {
      const v = g[i]; if (!v) continue;
      const b = 1 << v;
      if ((rows[ROW(i)] | cols[COL(i)] | boxs[BOX(i)]) & b) return 0;     // 이미 겹침
      rows[ROW(i)] |= b; cols[COL(i)] |= b; boxs[BOX(i)] |= b;
    }
    let found = 0;
    const go = () => {
      let best = -1, bm = 0, bn = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const m = ALL & ~(rows[ROW(i)] | cols[COL(i)] | boxs[BOX(i)]);
        const n = bits(m);
        if (n < bn) { bn = n; best = i; bm = m; if (n <= 1) break; }
      }
      if (best < 0) { found++; return found >= limit; }
      if (!bn) return false;
      const r = ROW(best), c = COL(best), x = BOX(best);
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d; if (!(bm & b)) continue;
        g[best] = d; rows[r] |= b; cols[c] |= b; boxs[x] |= b;
        if (go()) return true;
        g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxs[x] &= ~b;
      }
      return false;
    };
    go();
    return found;
  }
  /** 답 하나 찾기 (검사용) → 81칸 배열 또는 null */
  function solveGrid(grid) {
    const g = grid.slice();
    const ok = (i, d) => SudokuPeersOk(g, i, d);
    const go = () => {
      let best = -1, bn = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) { let n = 0; for (let d = 1; d <= 9; d++) if (ok(i, d)) n++; if (n < bn) { bn = n; best = i; } }
      if (best < 0) return true;
      for (let d = 1; d <= 9; d++) if (ok(best, d)) { g[best] = d; if (go()) return true; g[best] = 0; }
      return false;
    };
    return go() ? g : null;
  }
  const SudokuPeersOk = (g, i, d) => PEERS[i].every(j => g[j] !== d);
  /** 무작위 정답판 */
  function fullGrid(rnd) {
    const g = new Array(81).fill(0);
    const ok = (i, d) => PEERS[i].every(j => g[j] !== d);
    const go = i => {
      if (i === 81) return true;
      for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) { if (!ok(i, d)) continue; g[i] = d; if (go(i + 1)) return true; }
      g[i] = 0; return false;
    };
    go(0);
    return g;
  }

  /* ─────────────── 사람처럼 풀기 (난이도 · 힌트) ─────────────── */
  const TECH = { naked: 1, hidden: 2, pointing: 3, claiming: 3, nakedPair: 3, hiddenPair: 4 };
  function candidates(g) {
    const cand = new Uint16Array(81);
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let m = ALL; for (const j of PEERS[i]) if (g[j]) m &= ~(1 << g[j]);
      cand[i] = m;
    }
    return cand;
  }
  /** 바로 들어갈 수 있는 칸 하나 (싱글): { i, v, kind:'naked'|'hidden', unit } */
  function single(g, cand) {
    for (let i = 0; i < 81; i++) if (!g[i] && bits(cand[i]) === 1) return { i, v: digitsOf(cand[i])[0], kind: 'naked' };
    for (let u = 0; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d; let at = -1, n = 0, placed = false;
        for (const i of UNITS[u]) { if (g[i] === d) { placed = true; break; } if (!g[i] && (cand[i] & b)) { at = i; n++; } }
        if (!placed && n === 1) return { i: at, v: d, kind: 'hidden', unit: u };
      }
    }
    return null;
  }
  /** 후보 지우기 한 번 (포인팅 · 박스-줄 · 짝). 지운 게 있으면 기법 이름 */
  function eliminate(g, cand) {
    // 포인팅: 3×3 칸 안에서 숫자 d 의 자리가 한 줄에만 있으면 → 그 줄의 다른 칸에서 d 지우기
    for (let bx = 0; bx < 9; bx++) for (let d = 1; d <= 9; d++) {
      const b = 1 << d, cells = UNITS[18 + bx].filter(i => !g[i] && (cand[i] & b));
      if (cells.length < 2) continue;
      for (const [f, base] of [[ROW, 0], [COL, 9]]) {
        if (cells.every(i => f(i) === f(cells[0]))) {
          let hit = false;
          for (const j of UNITS[base + f(cells[0])]) if (!g[j] && BOX(j) !== bx && (cand[j] & b)) { cand[j] &= ~b; hit = true; }
          if (hit) return 'pointing';
        }
      }
    }
    // 박스-줄: 한 줄 안에서 d 의 자리가 한 3×3 칸에만 있으면 → 그 칸의 다른 자리에서 d 지우기
    for (let u = 0; u < 18; u++) for (let d = 1; d <= 9; d++) {
      const b = 1 << d, cells = UNITS[u].filter(i => !g[i] && (cand[i] & b));
      if (cells.length < 2 || !cells.every(i => BOX(i) === BOX(cells[0]))) continue;
      let hit = false;
      for (const j of UNITS[18 + BOX(cells[0])]) if (!g[j] && !UNITS[u].includes(j) && (cand[j] & b)) { cand[j] &= ~b; hit = true; }
      if (hit) return 'claiming';
    }
    // 드러난 짝: 한 줄 · 칸에서 후보가 똑같은 두 숫자인 두 칸 → 다른 칸에서 그 두 숫자 지우기
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u].filter(i => !g[i] && bits(cand[i]) === 2);
      for (let a = 0; a < cells.length; a++) for (let c = a + 1; c < cells.length; c++) {
        if (cand[cells[a]] !== cand[cells[c]]) continue;
        const m = cand[cells[a]]; let hit = false;
        for (const j of UNITS[u]) if (!g[j] && j !== cells[a] && j !== cells[c] && (cand[j] & m)) { cand[j] &= ~m; hit = true; }
        if (hit) return 'nakedPair';
      }
    }
    // 숨은 짝: 두 숫자가 한 줄 · 칸에서 똑같은 두 칸에만 들어갈 수 있으면 → 그 두 칸은 그 두 숫자만
    for (let u = 0; u < 27; u++) {
      const where = {};
      for (let d = 1; d <= 9; d++) { const b = 1 << d; const cs = UNITS[u].filter(i => !g[i] && (cand[i] & b)); if (cs.length === 2) where[d] = cs; }
      const ds = Object.keys(where).map(Number);
      for (let a = 0; a < ds.length; a++) for (let c = a + 1; c < ds.length; c++) {
        const x = where[ds[a]], y = where[ds[c]];
        if (x[0] !== y[0] || x[1] !== y[1]) continue;
        const m = (1 << ds[a]) | (1 << ds[c]); let hit = false;
        for (const i of x) if (cand[i] & ~m) { cand[i] &= m; hit = true; }
        if (hit) return 'hiddenPair';
      }
    }
    return null;
  }
  /** 사람처럼 끝까지 풀어 봐요 → { solved, max(가장 어려운 기법 단계), used } */
  function rate(grid) {
    const g = grid.slice();
    let cand = candidates(g), max = 0, guard = 0;
    const used = {};
    while (guard++ < 2000) {
      if (g.every(v => v)) return { solved: true, max, used };
      const s = single(g, cand);
      if (s) {
        g[s.i] = s.v; cand[s.i] = 0;
        for (const j of PEERS[s.i]) cand[j] &= ~(1 << s.v);
        max = Math.max(max, TECH[s.kind]); used[s.kind] = (used[s.kind] || 0) + 1;
        continue;
      }
      const t = eliminate(g, cand);
      if (!t) return { solved: false, max, used };
      max = Math.max(max, TECH[t]); used[t] = (used[t] || 0) + 1;
    }
    return { solved: false, max, used };
  }

  /* ─────────────── 퍼즐 만들기 ─────────────── */
  const LEVELS = {
    easy: { label: '쉬움', min: 36, max: 40, tech: [1, 2] },
    normal: { label: '보통', min: 28, max: 33, tech: [2, 2] },
    hard: { label: '어려움', min: 23, max: 30, tech: [3, 4] },
  };
  /** 퍼즐 하나 → { givens: '0…', solution: '…', level, clues, rating } */
  function make(level = 'normal', seed) {
    const L = LEVELS[level] || LEVELS.normal;
    const rnd = seed == null ? Math.random : rng(seed);
    let best = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const sol = fullGrid(rnd), g = sol.slice();
      const target = L.min + Math.floor(rnd() * (L.max - L.min + 1));        // 이번 퍼즐의 남길 숫자 수
      const pairs = shuffle(Array.from({ length: 41 }, (_, i) => i), rnd);   // 180° 대칭 짝 (40번은 한가운데 혼자)
      let clues = 81;
      for (const i of pairs) {
        if (clues <= target) break;
        const j = 80 - i, both = i !== j, a = g[i], b = g[j];
        g[i] = 0; g[j] = 0;
        let keep = count(g, 2) === 1;                            // 답이 하나뿐일 때만 지워요
        if (keep && clues - (both ? 2 : 1) <= L.max) {           // 이만큼 지웠으면 사람이 찍지 않고 풀 수 있는지
          const r = rate(g);
          keep = r.solved && r.max <= L.tech[1];
        }
        if (keep) clues -= both ? 2 : 1; else { g[i] = a; g[j] = b; }
      }
      if (clues > L.max) continue;
      const r = rate(g);
      if (!r.solved || r.max > L.tech[1]) continue;
      const p = pack(g, sol, level, clues, r);
      if (r.max >= L.tech[0]) return p;                          // 원하는 기법이 꼭 필요한 퍼즐
      if (!best || r.max > best.rating) best = p;                // (못 찾으면 가장 가까운 것)
    }
    return best || pack(fullGrid(rnd), null, level, 81, { max: 0 });
  }
  const pack = (g, sol, level, clues, r) => ({ givens: g.join(''), solution: (sol || g).join(''), level, clues, rating: r.max });

  /* ─────────────── 화면에서 쓰는 도구 ─────────────── */
  const parse = s => Array.from(String(s), c => +c || 0);
  /** 규칙에 안 맞는 칸 (같은 줄 · 칸에 같은 숫자) */
  function conflicts(g) {
    const bad = new Set();
    for (const u of UNITS) {
      const seen = {};
      for (const i of u) { const v = g[i]; if (!v) continue; (seen[v] = seen[v] || []).push(i); }
      for (const k in seen) if (seen[k].length > 1) seen[k].forEach(i => bad.add(i));
    }
    return bad;
  }
  /** 가르쳐 주는 힌트: 맞게 채운 칸만 보고 바로 알 수 있는 칸 + 이유 (없으면 정답 한 칸) */
  function hint(cur, solution) {
    const sol = parse(solution), g = cur.map((v, i) => (v && v === sol[i] ? v : 0));
    const cand = candidates(g);
    // 지금 판에서 안 되면 후보 지우기를 몇 번 해 보고 다시 (어려움 퍼즐)
    let s = single(g, cand), tries = 0, tech = null;
    while (!s && tries++ < 30) { tech = eliminate(g, cand) || tech; if (!tech) break; s = single(g, cand); }
    const wrong = cur.findIndex((v, i) => v && v !== sol[i]);
    if (wrong >= 0) return { i: wrong, v: sol[wrong], kind: 'wrong', text: `빨간 표시가 없어도 이 칸의 숫자는 틀렸어요. 정답은 ${sol[wrong]}예요.` };
    if (!s) { const i = g.findIndex(v => !v); return i < 0 ? null : { i, v: sol[i], kind: 'reveal', text: `이 칸의 답은 ${sol[i]}예요.` }; }
    const r = ROW(s.i) + 1, c = COL(s.i) + 1;
    if (s.kind === 'naked') {
      const seen = new Set(PEERS[s.i].map(j => g[j]).filter(Boolean));
      return { ...s, text: `${r}행 ${c}열: 같은 가로줄 · 세로줄 · 3×3 칸에 ${[...seen].sort().join(' · ')}이(가) 이미 있어서 ${s.v}만 들어갈 수 있어요.`, tech };
    }
    return { ...s, text: `${UNIT_NAME(s.unit)}에서 ${s.v}이(가) 들어갈 수 있는 자리는 ${r}행 ${c}열 하나뿐이에요.${tech ? ' (후보를 몇 개 지우고 나면 보여요)' : ''}`, tech };
  }
  /** 멀티 진행률: 비어 있던 칸 중 맞게 채운 칸 % · 다 맞으면 done */
  function progress(givens, solution, str) {
    if (typeof str !== 'string' || str.length !== 81 || /[^0-9]/.test(str)) return null;
    let empty = 0, right = 0;
    for (let i = 0; i < 81; i++) {
      if (givens[i] !== '0') { if (str[i] !== givens[i]) return null; continue; }
      empty++; if (str[i] === solution[i]) right++;
    }
    return { pct: Math.floor(right / Math.max(1, empty) * 100), done: right === empty };
  }

  return { LEVELS, UNITS, PEERS, ROW, COL, BOX, rng, count, solveGrid, fullGrid, rate, make, parse, conflicts, hint, progress, candidates, digitsOf };
});
