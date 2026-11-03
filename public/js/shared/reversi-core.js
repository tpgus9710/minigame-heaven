/* =====================================================================
 *  ⚫ 리버시 규칙 (오델로 방식) — 상대 돌을 내 돌 사이에 끼우면 뒤집혀요. 둘 곳이 없으면 자동으로 넘어가요.
 *  더 이상 둘 곳이 없으면 돌이 많은 쪽이 승리!
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.ReversiCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { log } = TableKit.util;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const W = [                                  // 자리 가치 (모서리 최고, 모서리 옆은 위험)
    120, -20, 20, 5, 5, 20, -20, 120,
    -20, -40, -5, -5, -5, -5, -40, -20,
    20, -5, 15, 3, 3, 15, -5, 20,
    5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5,
    20, -5, 15, 3, 3, 15, -5, 20,
    -20, -40, -5, -5, -5, -5, -40, -20,
    120, -20, 20, 5, 5, 20, -20, 120];
  function flips(b, i, c) {
    if (b[i]) return [];
    const r = i >> 3, col = i & 7, o = 3 - c, out = [];
    for (const [dr, dc] of DIRS) {
      let rr = r + dr, cc = col + dc; const line = [];
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === o) { line.push(rr * 8 + cc); rr += dr; cc += dc; }
      if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === c) out.push(...line);
    }
    return out;
  }
  function legal(b, c) { const m = []; for (let i = 0; i < 64; i++) if (!b[i] && flips(b, i, c).length) m.push(i); return m; }
  const count = (b, c) => b.reduce((a, x) => a + (x === c), 0);
  const cur = s => s.players[s.color - 1];

  function setup(players, rnd, opts) {
    const b = Array(64).fill(0);
    b[27] = b[36] = 2; b[28] = b[35] = 1;
    const order = rnd() < 0.5 ? players : players.slice().reverse();
    return {
      rnd, board: b, color: 1, over: false, winner: null, last: null, flipped: [], passN: 0, log: [], seq: 0,
      level: ['easy', 'normal', 'hard'].includes(opts && opts.level) ? opts.level : 'normal',
      players: order.slice(0, 2).map((p, i) => ({ id: p.id, name: p.name, color: i + 1 })),
      msg: `${order[0].name} 님(흑)부터 시작해요!`,
    };
  }
  function act(s, id, a) {
    const p = cur(s);
    if (s.over) return '게임이 끝났어요.';
    if (p.id !== id) return '지금은 내 차례가 아니에요.';
    const i = +a.i, f = Number.isInteger(i) && i >= 0 && i < 64 ? flips(s.board, i, s.color) : [];
    if (a.t !== 'move' || !f.length) return '그 자리에는 둘 수 없어요.';
    s.board[i] = s.color; f.forEach(j => { s.board[j] = s.color; });
    s.last = i; s.flipped = f;
    log(s, { t: 'move', id, i, n: f.length });
    s.color = 3 - s.color;
    if (!legal(s.board, s.color).length) {
      if (!legal(s.board, 3 - s.color).length) return finish(s);
      s.msg = `${cur(s).name} 님은 둘 곳이 없어서 넘어가요!`;
      log(s, { t: 'pass', id: cur(s).id });
      s.color = 3 - s.color;
    } else s.msg = `${cur(s).name} 님 차례 (${s.color === 1 ? '흑' : '백'})`;
  }
  function finish(s) {
    s.over = true;
    const b = count(s.board, 1), w = count(s.board, 2);
    s.winner = b === w ? null : s.players[b > w ? 0 : 1].id;
    s.msg = b === w ? `${b} : ${w} 무승부!` : `${b} : ${w} — ${s.players[b > w ? 0 : 1].name} 님 승리!`;
  }

  /* ── AI: 알파-베타 탐색 + 자리 가치 · 둘 수 있는 수 · 모서리 ── */
  function evaluate(b, c) {
    let sc = 0;
    for (let i = 0; i < 64; i++) if (b[i]) sc += b[i] === c ? W[i] : -W[i];
    const mob = legal(b, c).length - legal(b, 3 - c).length;
    const empty = b.filter(x => !x).length;
    if (empty < 12) sc += (count(b, c) - count(b, 3 - c)) * 8;
    return sc + mob * 6;
  }
  function search(b, c, me, depth, alpha, beta) {
    const moves = legal(b, c);
    if (!depth || (!moves.length && !legal(b, 3 - c).length)) {
      if (!moves.length && !legal(b, 3 - c).length) { const d = count(b, me) - count(b, 3 - me); return d * 1000; }
      return evaluate(b, me);
    }
    if (!moves.length) return search(b, 3 - c, me, depth - 1, alpha, beta);
    moves.sort((x, y) => W[y] - W[x]);
    if (c === me) {
      let best = -1e9;
      for (const m of moves) { const nb = b.slice(); nb[m] = c; flips(b, m, c).forEach(j => { nb[j] = c; }); best = Math.max(best, search(nb, 3 - c, me, depth - 1, alpha, beta)); alpha = Math.max(alpha, best); if (alpha >= beta) break; }
      return best;
    }
    let best = 1e9;
    for (const m of moves) { const nb = b.slice(); nb[m] = c; flips(b, m, c).forEach(j => { nb[j] = c; }); best = Math.min(best, search(nb, 3 - c, me, depth - 1, alpha, beta)); beta = Math.min(beta, best); if (alpha >= beta) break; }
    return best;
  }
  function ai(s) {
    const c = s.color, moves = legal(s.board, c);
    if (!moves.length) return null;
    const depth = { easy: 1, normal: 3, hard: 4 }[s.level] || 3;
    if (s.level === 'easy' && s.rnd() < 0.35) return { t: 'move', i: moves[Math.floor(s.rnd() * moves.length)] };
    let best = moves[0], bs = -1e9;
    for (const m of moves) {
      const nb = s.board.slice(); nb[m] = c; flips(s.board, m, c).forEach(j => { nb[j] = c; });
      const v = search(nb, 3 - c, c, depth - 1, -1e9, 1e9) + s.rnd() * 2;
      if (v > bs) { bs = v; best = m; }
    }
    return { t: 'move', i: best };
  }
  function view(s) {
    return {
      board: s.board, color: s.color, turnId: s.over ? null : cur(s).id, legal: s.over ? [] : legal(s.board, s.color),
      players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, n: count(s.board, p.color) })),
      last: s.last, flipped: s.flipped, over: s.over, winner: s.winner, msg: s.msg, log: s.log.slice(-8), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => count(s.board, b.color) - count(s.board, a.color));
    return {
      title: s.winner ? `⚫ ${s.players.find(p => p.id === s.winner).name} 님 승리!` : '⚪ 무승부!', subtitle: s.msg,
      ranking: ranked.map(p => ({ id: p.id, value: `${p.color === 1 ? '흑' : '백'} ${count(s.board, p.color)}개` })),
    };
  }
  return {
    meta: {
      name: '리버시', min: 2, max: 2, bots: true, turnSec: 45, botDelay: [500, 900],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명']] }, { key: 'level', label: '🧠 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']] }],
    },
    flips, legal,
    setup, act, ai, view, result,
    pending: s => (s.over ? [] : [cur(s).id]),
  };
});
