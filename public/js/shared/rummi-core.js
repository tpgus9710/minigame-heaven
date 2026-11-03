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
  function ai(s, id) {
    const p = P(s, id);
    const sets = aiPlay(s, p);
    if (sets) {
      const r = validatePlay(s.table, sets, p.rack, p.melded);
      if (r.ok) return { t: 'play', sets };
    }
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
    setup, act, ai, view, result,
    auto: () => ({ t: 'draw' }),
    pending: s => (s.over ? [] : [cur(s).id]),
    deadline: s => (s.over || !s.timeSec ? null : s.turnStart + (s.afk && s.afk[cur(s).id] ? Math.min(5, s.timeSec) : s.timeSec) * 1000),
    timeup: s => { if (s.over) return; const p = cur(s), had = s.pool.length; (s.afk = s.afk || {})[p.id] = true; s.timing = true; act(s, p.id, { t: 'draw' }); s.timing = false; if (!s.over) s.msg = had ? `시간 초과! ${p.name} 님은 타일을 한 장 가져갔어요.` : `시간 초과! ${p.name} 님 차례를 넘겨요.`; },
  };
});
