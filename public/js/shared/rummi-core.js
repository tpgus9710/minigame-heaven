/* =====================================================================
 *  🀫 러미 타일 규칙 (루미큐브 방식) — 1~13 숫자 타일 4색 × 2벌 + 조커 2개 = 106개
 *  14개씩 받아 시작. 세트는 3개 이상: 런(같은 색 연속 숫자) 또는 그룹(같은 숫자 · 서로 다른 색, 최대 4개)
 *  첫 등록: 내 타일로만 만든 새 세트 합이 30 이상. 등록 뒤에는 바닥 세트를 떼고 붙여 자유롭게 다시 짤 수 있어요.
 *  (차례가 끝날 때 바닥의 모든 세트가 맞아야 하고, 바닥 타일을 내 패로 가져올 수는 없어요)
 *  낼 게 없으면 한 장 가져가요. 먼저 다 내면 승리 — 남은 타일 합(조커 30점)이 벌점, 승자는 그 합만큼 점수!
 *  타일 번호: 0~103 = 색(26개씩: 빨강 · 파랑 · 주황 · 검정) × 숫자 1~13 × 2벌, 104 · 105 = 조커
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.RummiCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const COLORS = ['r', 'b', 'o', 'k'];
  const CNAME = { r: '빨강', b: '파랑', o: '주황', k: '검정' };
  const JV = 30;                                         // 남은 조커 벌점
  const isJ = id => id >= 104;
  const tile = id => (isJ(id) ? { id, j: true, c: 'j', n: 0 } : { id, j: false, c: COLORS[Math.floor(id / 26)], n: (id % 13) + 1 });
  const pen = id => (isJ(id) ? JV : tile(id).n);
  const rackValue = ids => ids.reduce((a, id) => a + pen(id), 0);
  const P = (s, id) => s.players.find(p => p.id === id);
  const cur = s => s.players[s.turn];

  /** 세트 판정 → { ok, kind: 'run'|'group', order(보여줄 순서), vals(조커가 대신하는 숫자), value } 또는 { ok:false, why } */
  function check(ids) {
    const L = ids.length;
    if (L < 3) return { ok: false, why: '세트는 3개 이상이어야 해요' };
    const real = ids.filter(id => !isJ(id)).map(tile), jk = ids.filter(isJ);
    const sameColor = real.every(t => t.c === real[0].c), ns = real.map(t => t.n);
    if (sameColor && new Set(ns).size === ns.length && L <= 13) {     // 런
      const mn = Math.min(...ns), mx = Math.max(...ns);
      if (mx - mn + 1 <= L) {
        let start = mn, end = mx, extra = L - (mx - mn + 1);
        while (extra > 0 && end < 13) { end++; extra--; }               // 남는 조커는 높은 쪽부터
        while (extra > 0 && start > 1) { start--; extra--; }
        if (!extra) {
          const byN = new Map(real.map(t => [t.n, t.id]));
          const order = [], vals = [];
          let ji = 0;
          for (let n = start; n <= end; n++) { order.push(byN.has(n) ? byN.get(n) : jk[ji++]); vals.push(n); }
          return { ok: true, kind: 'run', order, vals, value: vals.reduce((a, b) => a + b, 0) };
        }
      }
    }
    if (new Set(ns).size === 1) {                                      // 그룹
      if (L > 4) return { ok: false, why: '같은 숫자 그룹은 4개까지예요' };
      const cs = real.map(t => t.c);
      if (new Set(cs).size !== cs.length) return { ok: false, why: '그룹은 색이 모두 달라야 해요' };
      const n = real[0].n;
      const order = real.slice().sort((a, b) => COLORS.indexOf(a.c) - COLORS.indexOf(b.c)).map(t => t.id).concat(jk);
      return { ok: true, kind: 'group', order, vals: order.map(() => n), value: n * L };
    }
    if (sameColor) return { ok: false, why: '런은 숫자가 빈틈없이 이어져야 해요' };
    return { ok: false, why: '런(같은 색 연속 숫자)이나 그룹(같은 숫자 · 다른 색)이 아니에요' };
  }
  /** 보여줄 순서 (맞지 않는 세트는 색 · 숫자 순) */
  function arrange(ids) {
    const r = check(ids);
    if (r.ok) return r.order;
    return ids.slice().sort((a, b) => (isJ(a) - isJ(b)) || (tile(a).n - tile(b).n) || (COLORS.indexOf(tile(a).c) - COLORS.indexOf(tile(b).c)));
  }

  /** 한 차례의 최종 배치가 규칙에 맞는지 → { ok, played, value } 또는 { err } */
  function validatePlay(oldTable, newSets, rack, melded) {
    if (!Array.isArray(newSets) || newSets.length > 60) return { err: '배치가 잘못됐어요.' };
    const seen = new Set();
    for (const set of newSets) {
      if (!Array.isArray(set) || !set.length) return { err: '빈 세트가 있어요.' };
      for (const id of set) { if (!Number.isInteger(id) || id < 0 || id > 105 || seen.has(id)) return { err: '타일이 겹쳤어요.' }; seen.add(id); }
    }
    const oldIds = new Set([].concat(...oldTable));
    for (const id of oldIds) if (!seen.has(id)) return { err: '바닥에 있던 타일은 내 패로 가져올 수 없어요.' };
    const rackSet = new Set(rack);
    const played = [...seen].filter(id => !oldIds.has(id));
    if (played.some(id => !rackSet.has(id))) return { err: '내 타일이 아니에요.' };
    if (!played.length) return { err: '타일을 하나 이상 내려놓아야 해요. 낼 게 없으면 뽑기!' };
    const checks = newSets.map(check);
    const bad = checks.findIndex(r => !r.ok);
    if (bad >= 0) return { err: `맞지 않는 세트가 있어요 — ${checks[bad].why}`, bad };
    if (!melded) {
      const k = set => set.slice().sort((a, b) => a - b).join(',');
      const olds = new Map();
      for (const set of oldTable) olds.set(k(set), (olds.get(k(set)) || 0) + 1);
      let value = 0;
      for (let i = 0; i < newSets.length; i++) {
        const key = k(newSets[i]);
        if (olds.get(key)) { olds.set(key, olds.get(key) - 1); continue; }
        if (newSets[i].some(id => oldIds.has(id))) return { err: '첫 등록은 바닥 세트를 건드리지 않고 내 타일로만 새 세트를 만들어야 해요.' };
        value += checks[i].value;
      }
      if (value < 30) return { err: `첫 등록은 합이 30 이상이어야 해요. (지금 ${value}점)`, value };
      return { ok: true, played, value };
    }
    return { ok: true, played };
  }

  function setup(players, rnd, opts) {
    const pool = shuffle(Array.from({ length: 106 }, (_, i) => i), rnd);
    const s = {
      rnd, pool, table: [], turn: Math.floor(rnd() * players.length), turnNo: 0, over: false, winner: null, reason: '',
      log: [], seq: 0, msg: '', lastIds: [], lastBy: null, idle: 0, timeSec: Math.max(0, +(opts && opts.time) || 0),
      players: players.map(p => ({ id: p.id, name: p.name, rack: pool.splice(0, 14), melded: false, score: 0, left: null })),
    };
    beginTurn(s);
    return s;
  }
  function beginTurn(s) { s.turnNo++; s.turnStart = Date.now(); if (s.turnNo === 1) s.msg = `${cur(s).name} 님부터 시작해요.`; }
  function nextTurn(s) { s.turn = (s.turn + 1) % s.players.length; beginTurn(s); }
  function finish(s, winnerId, reason) {
    s.over = true; s.reason = reason;
    const vals = s.players.map(p => rackValue(p.rack));
    if (!winnerId) { const mn = Math.min(...vals); winnerId = s.players[vals.indexOf(mn)].id; }
    s.winner = winnerId;
    const w = P(s, winnerId), wv = rackValue(w.rack);
    let gain = 0;                                         // 문서: 진 사람은 남은 타일 합만큼 벌점, 이긴 사람은 그 합만큼 점수
    s.players.forEach((p, i) => { p.left = vals[i]; if (p !== w) { p.score = -vals[i]; gain += vals[i]; } });
    w.score = gain;
    s.msg = reason === 'rummi' ? `${w.name} 님이 타일을 모두 내려놓았어요! 러미!` : `더 이상 낼 수 없어요 — 남은 타일 합이 가장 적은 ${w.name} 님 승리!`;
    log(s, { t: 'end', id: winnerId });
  }

  function act(s, id, a) {
    if (s.over) return '게임이 끝났어요.';
    if (!s.timing && s.afk) delete s.afk[id];
    const p = cur(s);
    if (p.id !== id) return '지금은 내 차례가 아니에요.';
    if (a.t === 'draw') {
      if (s.pool.length) {
        const t = s.pool.pop(); p.rack.push(t);
        s.lastDraw = { id, tile: t, n: (s.lastDraw ? s.lastDraw.n : 0) + 1 };
        log(s, { t: 'draw', id });
        s.msg = `${p.name} 님이 타일을 한 장 가져갔어요.`;
      } else {
        s.idle++;
        log(s, { t: 'pass', id });
        s.msg = `더미가 비었어요. ${p.name} 님은 넘겨요.`;
        if (s.idle >= s.players.length) return void finish(s, null, 'stuck');
      }
      return void nextTurn(s);
    }
    if (a.t !== 'play') return '세트를 만들어 내려놓거나 뽑기를 눌러 주세요.';
    const r = validatePlay(s.table, a.sets, p.rack, p.melded);
    if (r.err) return r.err;
    const first = !p.melded;
    const played = new Set(r.played);
    p.rack = p.rack.filter(t => !played.has(t));
    s.table = a.sets.map(set => check(set).order);
    p.melded = true; s.idle = 0;
    s.lastIds = r.played; s.lastBy = id;
    log(s, { t: 'play', id, n: r.played.length, first });
    s.msg = first ? `${p.name} 님 첫 등록! (${r.value}점, 타일 ${r.played.length}개)` : `${p.name} 님이 타일 ${r.played.length}개를 내려놓았어요.`;
    if (!p.rack.length) return void finish(s, id, 'rummi');
    nextTurn(s);
  }

  /* ─────────── 봇 ─────────── */
  function subsets(arr) { const out = []; for (let m = 1; m < 1 << arr.length; m++) out.push(arr.filter((_, i) => m & (1 << i))); return out; }
  /** 내 패로 만들 수 있는 세트 후보들 */
  function rackSets(ids) {
    const tiles = ids.map(tile), J = ids.filter(isJ), out = [];
    for (let n = 1; n <= 13; n++) {
      const by = {};
      tiles.forEach(t => { if (!t.j && t.n === n && by[t.c] == null) by[t.c] = t.id; });
      for (const sub of subsets(Object.values(by))) for (let j = 0; j <= J.length; j++) { const L = sub.length + j; if (L >= 3 && L <= 4) out.push(sub.concat(J.slice(0, j))); }
    }
    for (const c of COLORS) {
      const by = {};
      tiles.forEach(t => { if (!t.j && t.c === c && by[t.n] == null) by[t.n] = t.id; });
      for (let a = 1; a <= 11; a++) for (let b = a + 2; b <= 13; b++) {
        const got = [];
        let miss = 0;
        for (let n = a; n <= b; n++) { if (by[n] != null) got.push(by[n]); else miss++; }
        if (!got.length || miss > J.length || by[a] == null && by[b] == null && miss) continue;   // 양 끝이 다 조커인 건 굳이 안 만들어요
        out.push(got.concat(J.slice(0, miss)));
      }
    }
    return out;
  }
  /** 겹치지 않게 세트를 골라 가장 많이(첫 등록이면 점수 높게) 내려놓기 */
  function bestCombo(ids, wantValue) {
    const cands = rackSets(ids).map(set => ({ set, v: check(set).value, jk: set.filter(isJ).length }));
    cands.sort((x, y) => y.set.length - x.set.length || y.v - x.v);
    let best = { sets: [], n: 0, v: 0, jk: 0 }, nodes = 0;
    const used = new Set();
    const score = (n, v, jk) => (wantValue ? v * 100 + n : n * 1000 + v - jk * 40);
    (function dfs(i, chosen, n, v, jk) {
      if (++nodes > 20000) return;
      if (score(n, v, jk) > score(best.n, best.v, best.jk)) best = { sets: chosen.slice(), n, v, jk };
      for (let k = i; k < cands.length; k++) {
        const c = cands[k];
        if (c.set.some(t => used.has(t))) continue;
        c.set.forEach(t => used.add(t)); chosen.push(c.set);
        dfs(k + 1, chosen, n + c.set.length, v + c.v, jk + c.jk);
        chosen.pop(); c.set.forEach(t => used.delete(t));
        if (nodes > 20000) return;
      }
    })(0, [], 0, 0, 0);
    return best;
  }
  /** 바닥 세트에서 하나 떼어내도 세트가 유지되는 타일 (런의 양 끝 · 4개 그룹의 아무거나) */
  function spare(set) {
    const r = check(set);
    if (!r.ok || set.length < 4) return [];
    if (r.kind === 'group') return r.order.filter(id => !isJ(id));
    return [r.order[0], r.order[r.order.length - 1]].filter(id => !isJ(id));
  }
  function aiPlay(s, p) {
    let rack = p.rack.slice();
    if (!p.melded) {
      const b = bestCombo(rack, true);
      if (b.v < 30) return null;
      return s.table.map(x => x.slice()).concat(b.sets);
    }
    const table = s.table.map(x => x.slice());
    const take = ids => { const st = new Set(ids); rack = rack.filter(t => !st.has(t)); };
    // 1) 내 패로 새 세트
    const b = bestCombo(rack, false);
    b.sets.forEach(set => { table.push(set.slice()); take(set); });
    // 2) 바닥 세트에 붙이기 · 런 쪼개 끼우기 (조커는 아껴 두기)
    let changed = true, guard = 0;
    while (changed && guard++ < 40) {
      changed = false;
      for (const t of rack.filter(x => !isJ(x))) {
        let done = false;
        for (const set of table) { if (check(set.concat(t)).ok) { set.push(t); take([t]); done = true; break; } }
        if (!done) {
          for (let i = 0; i < table.length && !done; i++) {
            const r = check(table[i]);
            if (!r.ok || r.kind !== 'run' || tile(t).c !== tile(r.order.find(x => !isJ(x))).c) continue;
            const pos = r.vals.indexOf(tile(t).n);
            if (pos >= 2 && r.order.length - pos >= 3) {
              const left = r.order.slice(0, pos + 1), right = [t].concat(r.order.slice(pos + 1));
              if (check(left).ok && check(right).ok) { table.splice(i, 1, left, right); take([t]); done = true; }
            }
          }
        }
        if (done) { changed = true; break; }
      }
      // 3) 내 타일 2개 + 바닥에서 떼어 낸 1개로 새 세트
      if (!changed) {
        outer: for (let i = 0; i < rack.length; i++) for (let j = i + 1; j < rack.length; j++) {
          for (let k = 0; k < table.length; k++) for (const sp of spare(table[k])) {
            const trio = [rack[i], rack[j], sp];
            if (!check(trio).ok) continue;
            table[k] = table[k].filter(x => x !== sp);
            table.push(trio); take([rack[i], rack[j]]);
            changed = true; break outer;
          }
        }
      }
    }
    // 4) 남은 조커: 붙일 수 있으면 마지막에 (패를 다 비울 수 있을 때만)
    for (const t of rack.filter(isJ)) {
      if (rack.length > 2) break;
      const set = table.find(x => check(x.concat(t)).ok);
      if (set) { set.push(t); take([t]); }
    }
    return table;
  }
  /* ─────────── 봇: 한 차례에 낼 수 있는 가장 좋은 배치 (정확한 계산) ───────────
   *  봇은 사람과 똑같이 '내 패'와 '모두에게 보이는 바닥'만 봐요 — 다른 사람 패 · 더미 순서는 몰라요.
   *  바닥 타일은 모두 바닥에 남기되(떼고 붙여 다시 짜도 OK) 내 패를 가장 많이 내려놓는 배치를 찾아요.
   *  숫자 1 → 13 순서로 훑으며, 색마다 이어 가는 런 2줄의 길이(0 · 1 · 2 · 3 이상) + 쓴 조커 수를 상태로 삼고
   *  런에 쓰고 남은 같은 숫자 타일은 그룹(1~2개)으로 묶어요. 모든 경우를 따지므로 사람이 찾을 수 있는 배치는 봇도 찾아요.
   *  조커는 아껴 두다가(내 타일 2장 이상을 더 낼 수 있을 때만) 쓰고, 패를 다 털 수 있으면 조커도 내요. */
  const PAIRS = [], PIDX = [];
  for (let h = 0; h <= 3; h++) { PIDX[h] = []; for (let l = 0; l <= h; l++) { PIDX[h][l] = PAIRS.length; PAIRS.push([h, l]); } }
  const pidx = (a, b) => (a >= b ? PIDX[a][b] : PIDX[b][a]);
  const ENDOK = [PIDX[0][0], PIDX[3][0], PIDX[3][3]];
  const SOLVE_LIMIT = 2e6;                               // 계산이 너무 길어지면(드물게 0.3초 넘게) 간단한 방법(aiPlay)으로
  const AI_CFG = { keep: -1500 };                        // 내 패의 조커를 낼 때 점수: 진짜 타일 1장 = 1000+숫자 → 2장 이상 더 낼 수 있을 때만 조커를 써요

  /** 같은 숫자 그룹 나누기: 그룹에 2장 넣는 색 수 c2 · 1장 넣는 색 수 c1 · 조커 jg → 그룹 0~2개 { k, b1(1번 그룹에 넣을 한 장짜리 색 수), j1 } */
  function groupSplit(c2, c1, jg) {
    if (!c2 && !c1) return jg ? null : { k: 0, b1: 0, j1: 0 };
    if (!c2 && c1 + jg >= 3 && c1 + jg <= 4) return { k: 1, b1: c1, j1: jg };
    for (let b1 = 0; b1 <= c1; b1++) for (let j1 = 0; j1 <= jg; j1++) {
      const s1 = c2 + b1 + j1, s2 = c2 + c1 - b1 + jg - j1;
      if (s1 >= 3 && s1 <= 4 && s2 >= 3 && s2 <= 4 && c2 + b1 >= 1 && c2 + c1 - b1 >= 1) return { k: 2, b1, j1 };
    }
    return null;
  }

  /**
   * 바닥 타일(모두 써야 함) + 내 패(골라 씀)로 만들 수 있는 가장 좋은 배치.
   * mode.first: 첫 등록 — 내 패로만 · 합 30 이상 / mode.jw: 내 패의 조커 한 장을 낼 때 점수(음수면 아끼기)
   * → { sets, placed(내려놓은 내 패), value } · 못 만들면 null
   * 상태 키 = 색마다 런 2줄 길이(10가지) 4자리 + 1만 × (쓴 조커 + 3 × (이 숫자에서 그룹에 넣은 색 요약 + 25 × 첫 등록 점수))
   * 숫자 하나를 색 4개로 나눠 한 색씩 넘겨요(경우의 수가 곱이 아니라 합으로 늘어서 빨라요).
   */
  function solve(tableIds, rackIds, mode) {
    const first = !!mode.first, jw = mode.jw || 0;
    const TA = [0, 1, 2, 3].map(() => Array.from({ length: 16 }, () => [])), RA = [0, 1, 2, 3].map(() => Array.from({ length: 16 }, () => []));
    const JT = [], JR = [];
    for (const id of tableIds) { if (isJ(id)) JT.push(id); else { const t = tile(id); TA[COLORS.indexOf(t.c)][t.n].push(id); } }
    for (const id of rackIds) { if (isJ(id)) JR.push(id); else { const t = tile(id); RA[COLORS.indexOf(t.c)][t.n].push(id); } }
    const JB = JT.length + JR.length;
    const has = (c, n) => n <= 13 && TA[c][n].length + RA[c][n].length > 0;
    const POW = [1, 10, 100, 1000];
    let work = 0;
    let cur = new Map([[0, { sc: 0, prev: null, ch: null }]]);
    const put = (map, k, sc, prev, ch) => { const old = map.get(k); if (!old || old.sc < sc) map.set(k, { sc, prev, ch }); };
    for (let n = 1; n <= 13; n++) {
      for (let c = 0; c < 4; c++) {
        const next = new Map(), memo = new Map();
        const T = TA[c][n].length, R = RA[c][n].length, look1 = has(c, n + 1), look = look1 || has(c, n + 2);
        const acts = L => {                                // [새 길이, 0 안 씀 · 1 진짜 타일 · 2 조커]
          if (L === 1 && n === 13) return [];
          if (L === 1 || L === 2) return [[L + 1, 1], [L + 1, 2]];
          if (L === 3) return JT.length || look1 ? [[3, 1], [3, 2], [0, 0]] : [[3, 1], [0, 0]];
          return n <= 11 ? (look ? [[1, 1], [1, 2], [0, 0]] : [[1, 1], [0, 0]]) : [[0, 0]];
        };
        /** 이 색 · 이 숫자에서 할 수 있는 일들 (런 2줄을 잇기 · 끝내기 · 새로 시작 + 남는 타일은 그룹으로) */
        const optsFor = (pi, jl) => {
          const mk = pi * 3 + jl;
          let list = memo.get(mk);
          if (list) return list;
          list = [];
          const [hi, lo] = PAIRS[pi], A = acts(hi), B = acts(lo);
          for (let i = 0; i < A.length; i++) for (let k = hi === lo ? i : 0; k < B.length; k++) {   // 길이가 같은 두 줄은 순서만 다른 경우를 빼요
            const [h2, x1] = A[i], [l2, x2] = B[k];
            const rr = (x1 === 1) + (x2 === 1), jr = (x1 === 2) + (x2 === 2);
            if (jr > jl) continue;
            for (let u = T; u <= T + R; u++) {
              const gg = u - rr;
              if (gg < 0 || gg > 2) continue;
              list.push({ ns: pidx(h2, l2), a: [x1, x2], u, rk: u - T, jr, g: gg, c, n });
            }
          }
          memo.set(mk, list);
          return list;
        };
        for (const [key, node] of cur) {
          const runs = key % 10000, rest = (key - runs) / 10000;
          const j = rest % 3, gs = Math.floor(rest / 3) % 25, v = Math.floor(rest / 75);
          const pi = Math.floor(runs / POW[c]) % 10, base = runs - pi * POW[c];
          for (const o of optsFor(pi, JB - j)) {
            if (++work > SOLVE_LIMIT) throw new Error('solve-limit');
            const gs2 = gs + (o.g === 2 ? 5 : o.g === 1 ? 1 : 0);
            const v2 = first ? Math.min(30, v + (o.u + o.jr) * n) : 0;
            put(next, base + o.ns * POW[c] + 10000 * (j + o.jr + 3 * (gs2 + 25 * v2)), node.sc + o.rk * (1000 + n), node, o);
          }
        }
        cur = next;
        if (!cur.size) return null;
      }
      // 이 숫자의 그룹: 그룹에 넣기로 한 타일 + 조커로 그룹 1~2개를 만들 수 있나
      const next = new Map();
      for (const [key, node] of cur) {
        const runs = key % 10000, rest = (key - runs) / 10000;
        const j = rest % 3, gs = Math.floor(rest / 3) % 25, v = Math.floor(rest / 75);
        const c2 = Math.floor(gs / 5), c1 = gs % 5;
        for (let jg = 0; jg <= JB - j; jg++) {
          if (++work > SOLVE_LIMIT) throw new Error('solve-limit');
          const sp = groupSplit(c2, c1, jg);
          if (!sp) continue;
          const v2 = first ? Math.min(30, v + jg * n) : 0;
          put(next, runs + 10000 * (j + jg + 75 * v2), node.sc, node, { jg, sp, n });
        }
      }
      cur = next;
      if (!cur.size) return null;
    }
    let best = null, bestSc = -Infinity, bestJ = 0;
    for (const [key, node] of cur) {
      const runs = key % 10000, rest = (key - runs) / 10000;
      if (!ENDOK.includes(runs % 10) || !ENDOK.includes(Math.floor(runs / 10) % 10) || !ENDOK.includes(Math.floor(runs / 100) % 10) || !ENDOK.includes(Math.floor(runs / 1000))) continue;
      const j = rest % 3, v = Math.floor(rest / 75);
      if (j < JT.length || (first && v < 30)) continue;
      const sc = node.sc + (j - JT.length) * jw;
      if (sc > bestSc) { bestSc = sc; best = node; bestJ = j; }
    }
    if (!best) return null;
    // 되짚어 가며 실제 세트로
    const chain = [];
    for (let x = best; x && x.ch; x = x.prev) chain.push(x.ch);
    chain.reverse();
    const jok = JT.concat(JR);
    let ji = 0, value = 0;
    const runs = [0, 1, 2, 3].map(() => [[], []]), sets = [], placed = [];
    let gr = [];
    for (const ch of chain) {
      const n = ch.n;
      if (ch.sp) {                                       // 이 숫자의 그룹
        value += ch.jg * n;
        if (ch.sp.k) {
          const two = gr.filter(x => x.length === 2), one = gr.filter(x => x.length === 1).map(x => x[0]);
          const g1 = two.map(x => x[0]).concat(one.slice(0, ch.sp.b1)), g2 = two.map(x => x[1]).concat(one.slice(ch.sp.b1));
          for (let k = 0; k < ch.sp.j1; k++) g1.push(jok[ji++]);
          if (ch.sp.k === 2) { for (let k = ch.sp.j1; k < ch.jg; k++) g2.push(jok[ji++]); sets.push(g1, g2); }
          else sets.push(g1);
        }
        gr = [];
        continue;
      }
      const o = ch, c = o.c, slots = runs[c], reals = TA[c][n].slice();
      for (let k = 0; k < o.rk; k++) { reals.push(RA[c][n][k]); placed.push(RA[c][n][k]); }
      value += (o.u + o.jr) * n;
      for (let si = 0; si < 2; si++) {
        const x = o.a[si];
        if (x === 1) slots[si].push(reals.pop());
        else if (x === 2) slots[si].push(jok[ji++]);
        else { if (slots[si].length >= 3) sets.push(slots[si]); slots[si] = []; }
      }
      slots.sort((p, q) => Math.min(3, q.length) - Math.min(3, p.length));
      if (reals.length) gr.push(reals);
    }
    for (const slots of runs) for (const r of slots) if (r.length) sets.push(r);
    for (let k = JT.length; k < bestJ; k++) placed.push(jok[k]);
    return { sets, placed, value };
  }
  /** 바닥 순서를 되도록 그대로: 안 바뀐 세트는 제자리 · 바뀐 세트는 가장 많이 겹치는 원래 세트 바로 뒤 · 새 세트는 맨 뒤 */
  function stableOrder(oldTable, sets) {
    const key = x => x.slice().sort((a, b) => a - b).join(','), oldKeys = oldTable.map(key), taken = new Set();
    const where = new Map();
    oldTable.forEach((set, i) => set.forEach(id => where.set(id, i)));
    const pos = sets.map((set, k) => {
      const i = oldKeys.findIndex((x, ii) => !taken.has(ii) && x === key(set));
      if (i >= 0) { taken.add(i); return i; }
      const cnt = new Map();
      for (const id of set) if (where.has(id)) cnt.set(where.get(id), (cnt.get(where.get(id)) || 0) + 1);
      let bi = -1, bc = 0;
      for (const [ii, n] of cnt) if (n > bc || (n === bc && ii < bi)) { bi = ii; bc = n; }
      return bi >= 0 ? bi + 0.5 + k / 1e4 : 1e6 + k;
    });
    return sets.map((set, k) => [pos[k], arrange(set)]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  /** 봇의 배치: 첫 등록이면 내 패로만 30점 이상 · 등록 뒤에는 바닥까지 다시 짜서 가장 많이 (다 털 수 있으면 털기) */
  function aiSolve(s, p) {
    if (!p.melded) {
      const r = solve([], p.rack, { first: true, jw: AI_CFG.keep });
      return r && r.placed.length ? s.table.map(x => x.slice()).concat(r.sets.map(arrange)) : null;
    }
    const tableIds = [].concat(...s.table);
    let r = solve(tableIds, p.rack, { jw: 1000 });
    if (r && r.placed.length < p.rack.length && r.placed.some(isJ)) r = solve(tableIds, p.rack, { jw: AI_CFG.keep });   // 다 못 털면 조커는 아껴요
    return r && r.placed.length ? stableOrder(s.table, r.sets) : null;
  }
  function ai(s, id) {
    const p = P(s, id);
    let sets = null;
    try { sets = aiSolve(s, p); } catch (e) { sets = null; }                       // 계산이 너무 길면 간단한 방법으로
    if (sets && validatePlay(s.table, sets, p.rack, p.melded).ok) return { t: 'play', sets };
    sets = aiPlay(s, p);
    if (sets && validatePlay(s.table, sets, p.rack, p.melded).ok) return { t: 'play', sets };
    return { t: 'draw' };
  }

  function view(s, viewer) {
    const me = P(s, viewer);
    return {
      players: s.players.map(p => ({ id: p.id, name: p.name, count: p.rack.length, melded: p.melded, score: p.score, left: p.left, rack: s.over ? p.rack.slice() : null })),
      rack: me ? me.rack.slice() : [], melded: me ? me.melded : false,
      table: s.table, turnId: s.over ? null : cur(s).id, turnNo: s.turnNo, pool: s.pool.length,
      lastIds: s.lastIds, lastBy: s.lastBy, lastDraw: s.lastDraw && s.lastDraw.id === viewer ? s.lastDraw : (s.lastDraw ? { id: s.lastDraw.id, n: s.lastDraw.n } : null),
      over: s.over, winner: s.winner, reason: s.reason, msg: s.msg, log: s.log.slice(-8), seq: s.seq, timeSec: s.timeSec,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const w = P(s, s.winner);
    const order = s.players.slice().sort((a, b) => b.score - a.score);
    return {
      title: `🀫 ${w.name} 님 승리!`, subtitle: s.reason === 'rummi' ? '타일을 가장 먼저 모두 내려놓았어요' : '남은 타일 합이 가장 적어요',
      lines: s.players.filter(p => p.left).map(p => `${p.name}: 남은 타일 ${p.rack.length}개 (${p.left}점)`),
      ranking: order.map(p => ({ id: p.id, value: `${p.score > 0 ? '+' : ''}${p.score}점` })),
    };
  }
  return {
    meta: {
      name: '러미 타일', min: 2, max: 4, bots: true, turnSec: 0, botDelay: [1400, 2400],
      options: [
        { key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
        { key: 'time', label: '⏱️ 차례 시간', def: 60, values: [[30, '30초'], [45, '45초'], [60, '60초'], [90, '90초'], [0, '없음']] },
      ],
    },
    COLORS, CNAME, JV, isJ, tile, pen, rackValue, check, arrange, validatePlay,
    setup, act, ai, view, result, _solve: solve, _aiPlay: aiPlay, _cfg: AI_CFG,
    auto: () => ({ t: 'draw' }),
    pending: s => (s.over ? [] : [cur(s).id]),
    deadline: s => (s.over || !s.timeSec ? null : s.turnStart + (s.afk && s.afk[cur(s).id] >= 2 ? Math.min(10, s.timeSec) : s.timeSec) * 1000),
    timeup: s => { if (s.over) return; const p = cur(s), had = s.pool.length; (s.afk = s.afk || {})[p.id] = (s.afk[p.id] || 0) + 1; s.timing = true; act(s, p.id, { t: 'draw' }); s.timing = false; if (!s.over) s.msg = had ? `시간 초과! ${p.name} 님은 타일을 한 장 가져갔어요.` : `시간 초과! ${p.name} 님 차례를 넘겨요.`; },
  };
});
