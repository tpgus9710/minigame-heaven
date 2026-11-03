/* =====================================================================
 *  🥢 윷놀이 규칙 — 윷을 던져 말을 움직이고, 모든 말이 먼저 판을 한 바퀴 돌아 나가면 승리!
 *  도 1 · 개 2 · 걸 3 · 윷 4(한 번 더) · 모 5(한 번 더) · 빽도 -1
 *  모서리(모 · 뒷모)와 가운데(방)에 '멈추면' 지름길로 가요. 상대 말을 잡으면 한 번 더, 내 말끼리는 업어서 같이 가요.
 *
 *  칸 번호: 0 출발/참먹이(오른쪽 아래), 1~4 오른쪽 위로, 5 모(오른쪽 위 모서리), 6~9 위쪽 왼쪽으로, 10 뒷모,
 *          11~14 왼쪽 아래로, 15 찌모, 16~19 아래쪽 오른쪽으로 → 0 → 나감
 *          지름길A 5→20→21→22(방)→23→24→15,  지름길B 10→25→26→22(방)→27→28→0
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.YutCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { log } = TableKit.util;
  const NAME = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
  const ODDS = [[-1, 1], [1, 3], [2, 6], [3, 4], [4, 1], [5, 1]];          // 16분의 몇
  const COLORS = ['#e74c3c', '#2e86de', '#f1c40f', '#27ae60'];

  /* 판 좌표 (600×600) */
  const POS = {};
  POS[0] = [540, 540];
  for (let k = 1; k <= 4; k++) POS[k] = [540, 540 - k * 96];
  POS[5] = [540, 60];
  for (let k = 6; k <= 9; k++) POS[k] = [540 - (k - 5) * 96, 60];
  POS[10] = [60, 60];
  for (let k = 11; k <= 14; k++) POS[k] = [60, 60 + (k - 10) * 96];
  POS[15] = [60, 540];
  for (let k = 16; k <= 19; k++) POS[k] = [60 + (k - 15) * 96, 540];
  Object.assign(POS, { 20: [460, 140], 21: [380, 220], 22: [300, 300], 23: [220, 380], 24: [140, 460], 25: [140, 140], 26: [220, 220], 27: [380, 380], 28: [460, 460] });
  const LINES = [[0, 5], [5, 10], [10, 15], [15, 0], [5, 15], [10, 0]];
  const BIG = [0, 5, 10, 15, 22];

  /** 한 칸 앞으로: cur 에서 출발(isStart)했는지, 어디서 왔는지(prev)에 따라 길이 달라져요 */
  function next(cur, prev, isStart) {
    if (cur === -1) return 1;
    if (cur === 0) return 'done';
    if (cur === 5) return isStart ? 20 : 6;
    if (cur === 10) return isStart ? 25 : 11;
    if (cur === 22) return isStart ? 27 : prev === 21 ? 23 : 27;
    if (cur === 19 || cur === 28) return 0;
    if (cur === 24) return 15;
    if (cur === 20 || cur === 21 || cur === 23 || cur === 25 || cur === 27) return cur + 1;
    if (cur === 26) return 22;
    return cur + 1;                                    // 1~18 바깥 길
  }
  /** pos 에서 steps 만큼 (trail: 지나온 칸 기록 — 빽도 때 되돌아가는 길) */
  function walk(pos, steps, trail) {
    if (pos === 'done') return null;
    if (steps === -1) {
      if (pos === -1) return null;
      const t = trail.slice(0, -1), to = t.length ? t[t.length - 1] : 0;
      return { path: [to], to, trail: t.length ? t : [0] };
    }
    let cur = pos, prev = trail.length >= 2 ? trail[trail.length - 2] : null;
    const path = [], t = trail.slice();
    for (let k = 0; k < steps; k++) {
      const nx = next(cur, prev, k === 0);
      if (nx === 'done') { path.push('done'); return { path, to: 'done', trail: t }; }
      prev = cur; cur = nx; path.push(nx); t.push(nx);
    }
    return { path, to: cur, trail: t };
  }
  /* AI용: 나가기까지 남은 거리 (지름길에 멈춘다고 가정) */
  const DIST = {};
  for (let n = 0; n <= 28; n++) DIST[n] = 99;
  for (let it = 0; it < 40; it++) for (let n = 0; n <= 28; n++) {
    const opts = n === 0 ? ['done'] : [next(n, null, true), next(n, 21, false), next(n, 26, false)];
    DIST[n] = Math.min(DIST[n], ...opts.map(o => 1 + (o === 'done' ? 0 : DIST[o])));
  }
  DIST[-1] = 1 + DIST[1]; DIST.done = 0;

  const cur = s => s.players[s.turn];
  const onBoard = pc => pc.pos !== -1 && pc.pos !== 'done';
  function roll(rnd) {
    let r = rnd() * 16;
    for (const [v, w] of ODDS) { if (r < w) return v; r -= w; }
    return 2;
  }
  function setup(players, rnd, opts) {
    const n = Math.max(2, Math.min(4, +(opts && opts.pieces) || 4));
    const s = {
      rnd, turn: 0, phase: 'throw', throws: [], over: false, winner: null, log: [], seq: 0, msg: '', N: n,
      players: players.map((p, i) => ({ id: p.id, name: p.name, color: COLORS[i % COLORS.length], pieces: Array.from({ length: n }, () => ({ pos: -1, trail: [] })), done: 0 })),
    };
    s.msg = `${cur(s).name} 님부터 윷을 던져요!`;
    return s;
  }
  /** 쓸 수 없는 빽도는 버려요 (판 위에 말이 없을 때) */
  function prune(s) {
    const p = cur(s);
    if (!p.pieces.some(onBoard)) s.throws = s.throws.filter(v => v !== -1);
  }
  function nextTurn(s) {
    s.throws = []; s.turn = (s.turn + 1) % s.players.length; s.phase = 'throw';
    s.msg = `${cur(s).name} 님 차례예요. 윷을 던지세요!`;
  }
  /** 지금 할 수 있는 이동 목록: 같은 칸에 업힌 말은 하나로, 기다리는 말도 하나로 */
  function moves(s) {
    if (s.phase !== 'move') return [];
    const p = cur(s), out = [], seen = new Set();
    p.pieces.forEach((pc, i) => {
      if (pc.pos === 'done') return;
      const key = String(pc.pos);
      if (seen.has(key)) return; seen.add(key);
      s.throws.forEach((v, r) => { const w = walk(pc.pos, v, pc.trail); if (w) out.push({ r, piece: i, to: w.to, path: w.path }); });
    });
    return out;
  }
  function act(s, id, a) {
    const p = cur(s);
    if (s.over) return '게임이 끝났어요.';
    if (p.id !== id) return '지금은 내 차례가 아니에요.';
    if (s.phase === 'throw') {
      if (a.t !== 'throw') return '윷을 던져 주세요.';
      const v = roll(s.rnd);
      s.throws.push(v);
      log(s, { t: 'throw', id, v });
      if (v === 4 || v === 5) { s.msg = `${NAME[v]}! 한 번 더 던져요.`; return; }
      s.phase = 'move'; prune(s);
      if (!s.throws.length) { log(s, { t: 'skip', id }); s.msg = '빽도인데 판 위에 말이 없어서 넘어가요.'; nextTurn(s); return; }
      s.msg = `${p.name} 님, 말을 움직여요. (${s.throws.map(x => NAME[x]).join(' · ')})`;
      return;
    }
    if (s.phase !== 'move' || a.t !== 'move') return '말을 골라 움직여 주세요.';
    const r = +a.r, pc = p.pieces[+a.piece];
    if (!(r >= 0 && r < s.throws.length) || !pc || pc.pos === 'done') return '움직일 말을 골라 주세요.';
    const v = s.throws[r], w = walk(pc.pos, v, pc.trail);
    if (!w) return pc.pos === -1 ? '빽도는 판 위에 있는 말만 움직일 수 있어요.' : '그 말은 움직일 수 없어요.';
    const group = pc.pos === -1 ? [pc] : p.pieces.filter(q => q.pos === pc.pos);
    const from = pc.pos;
    s.throws.splice(r, 1);
    let captured = [];
    if (w.to === 'done') { group.forEach(q => { q.pos = 'done'; q.trail = []; }); p.done += group.length; }
    else {
      for (const o of s.players) if (o !== p) o.pieces.forEach((q, qi) => { if (q.pos === w.to) { captured.push({ id: o.id, i: qi }); q.pos = -1; q.trail = []; } });
      group.forEach(q => { q.pos = w.to; q.trail = w.trail.slice(); });
      p.pieces.forEach(q => { if (q.pos === w.to) q.trail = w.trail.slice(); });   // 업기
    }
    const stack = w.to === 'done' ? group.length : p.pieces.filter(q => q.pos === w.to).length;
    log(s, { t: 'move', id, from, to: w.to, path: w.path, n: group.length, v, captured, stack });
    if (p.done === s.N) {
      s.over = true; s.winner = p.id; s.phase = 'over';
      s.msg = `${p.name} 님의 말이 모두 들어왔어요! 우승!`;
      return;
    }
    const nm = NAME[v];
    if (captured.length) {
      s.phase = 'throw';
      s.msg = `${nm}로 잡았다! ${p.name} 님 한 번 더 던져요.`;
      return;
    }
    s.msg = w.to === 'done' ? `${p.name} 님 말 ${group.length}개 골인!` : stack > 1 && group.length < stack ? `${nm}! 말을 업었어요 (${stack}개).` : `${nm}!`;
    prune(s);
    if (!s.throws.length) return void nextTurn(s);
    s.msg += ` 남은 윷: ${s.throws.map(x => NAME[x]).join(' · ')}`;
  }

  /* ── AI: 잡기 > 골인 > 업기 · 지름길 > 전진, 잡힐 위험은 피하기 ── */
  function risk(s, p, node, size) {
    if (node === 'done' || node === -1) return 0;
    let r = 0;
    for (const o of s.players) {
      if (o === p) continue;
      const seen = new Set();
      for (const q of o.pieces) {
        if (q.pos === 'done' || seen.has(String(q.pos))) continue;
        seen.add(String(q.pos));
        for (const [v, w] of ODDS) { const m = walk(q.pos, v, q.trail); if (m && m.to === node) r += w / 16; }
      }
    }
    return Math.min(1, r) * size;
  }
  function score(s, p, m) {
    const pc = p.pieces[m.piece], size = pc.pos === -1 ? 1 : p.pieces.filter(q => q.pos === pc.pos).length;
    let sc = (DIST[pc.pos] - DIST[m.to]) * 2 * size;
    if (m.to === 'done') return 100 + sc + 20 * size;
    let cap = 0;
    for (const o of s.players) if (o !== p) o.pieces.forEach(q => { if (q.pos === m.to) cap += 1 + (DIST[-1] - DIST[q.pos]) / 6; });
    if (cap) sc += 50 + cap * 15;
    const mine = p.pieces.filter(q => q.pos === m.to && q !== pc && !(pc.pos !== -1 && q.pos === pc.pos)).length;
    if (mine) sc += 10;
    if ([5, 10, 22].includes(m.to)) sc += 8;
    sc -= risk(s, p, m.to, size + mine) * 45;
    sc += risk(s, p, pc.pos, size) * 30;                // 위험한 자리에서 도망치면 좋아요
    return sc;
  }
  function ai(s, id) {
    if (s.phase === 'throw') return { t: 'throw' };
    const p = cur(s), ms = moves(s);
    if (!ms.length) return null;
    let best = ms[0], bs = -1e9;
    for (const m of ms) { const sc = score(s, p, m) + s.rnd() * 0.5; if (sc > bs) { bs = sc; best = m; } }
    return { t: 'move', r: best.r, piece: best.piece };
  }

  function view(s) {
    return {
      players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, done: p.done, pieces: p.pieces.map(q => ({ pos: q.pos })) })),
      turnId: cur(s).id, phase: s.phase, throws: s.throws.slice(), moves: s.over ? [] : moves(s), N: s.N,
      over: s.over, winner: s.winner, msg: s.msg, log: s.log.slice(-14), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const prog = p => p.done * 100 + p.pieces.reduce((a, q) => a + (q.pos === 'done' ? 0 : DIST[-1] - DIST[q.pos]), 0);
    const ranked = s.players.slice().sort((a, b) => prog(b) - prog(a));
    return {
      title: `🥢 ${ranked[0].name} 님 우승!`, subtitle: '말이 모두 먼저 들어온 사람이 이겨요.',
      ranking: ranked.map(p => ({ id: p.id, value: `골인 ${p.done}/${s.N}` })),
    };
  }
  return {
    meta: {
      name: '윷놀이', min: 2, max: 4, bots: true, turnSec: 30, botDelay: [900, 1500],
      options: [
        { key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
        { key: 'pieces', label: '♟️ 말 개수', def: 4, values: [[2, '2개'], [3, '3개'], [4, '4개']] },
      ],
    },
    NAME, POS, LINES, BIG, ODDS, next, walk, DIST,
    setup, act, ai, view, result,
    pending: s => (s.over ? [] : [cur(s).id]),
  };
});
