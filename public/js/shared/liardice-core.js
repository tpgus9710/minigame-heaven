/* =====================================================================
 *  🎲 라이어 다이스 규칙 — 모두 주사위 5개를 몰래 굴리고, 판 전체에 '어떤 눈이 몇 개 이상' 있는지 부르기!
 *  1은 아무 눈으로나 쳐요(와일드). 다음 사람은 더 높게 부르거나 "거짓말!"을 외쳐요.
 *  거짓말이 맞으면 부른 사람이, 틀리면 외친 사람이 주사위 하나를 잃어요. "딱 맞아!"가 맞으면 주사위 하나를 되찾아요.
 *  주사위를 모두 잃으면 탈락, 마지막까지 남은 사람이 승리!
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.LiarDiceCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { log } = TableKit.util;
  const START = 5, REVEAL_MS = 6500;
  const P = (s, id) => s.players.find(p => p.id === id);
  const alive = s => s.players.filter(p => p.dice.length);
  const totalDice = s => s.players.reduce((a, p) => a + p.dice.length, 0);
  const cur = s => s.players[s.turn];
  const countFace = (dice, f) => dice.filter(d => d === f || d === 1).length;

  function rollAll(s) {
    for (const p of s.players) p.dice = p.dice.map(() => 1 + Math.floor(s.rnd() * 6)).sort((a, b) => a - b);
    s.bid = null; s.history = []; s.phase = 'bid'; s.reveal = null; s.deadline = null; s.roundN++;
    log(s, { t: 'roll', round: s.roundN });
  }
  function setup(players, rnd) {
    const s = { rnd, players: players.map(p => ({ id: p.id, name: p.name, dice: Array(START).fill(1) })), turn: 0, bid: null, history: [], phase: 'bid', reveal: null, roundN: 0, over: false, winner: null, outOrder: [], log: [], seq: 0, msg: '' };
    rollAll(s);
    s.msg = `모두 주사위를 굴렸어요! ${cur(s).name} 님부터 불러요. (1은 아무 눈으로나 쳐요)`;
    return s;
  }
  const higher = (q, f, b) => !b || q > b.q || (q === b.q && f > b.f);
  function nextAlive(s, i) { const n = s.players.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (s.players[j].dice.length) return j; } return i; }

  function act(s, id, a) {
    const p = cur(s);
    if (s.over) return '게임이 끝났어요.';
    if (s.phase !== 'bid' || p.id !== id) return '지금은 내 차례가 아니에요.';
    if (a.t === 'bid') {
      const q = Math.floor(+a.q), f = Math.floor(+a.f);
      if (!(f >= 2 && f <= 6)) return '눈은 2~6 중에서 불러요. (1은 와일드)';
      if (!(q >= 1 && q <= totalDice(s))) return `개수는 1~${totalDice(s)} 사이로 불러요.`;
      if (!higher(q, f, s.bid)) return `지금(${s.bid.q}개의 ${s.bid.f})보다 높게 불러야 해요.`;
      s.bid = { id, q, f }; s.history.push({ id, q, f });
      log(s, { t: 'bid', id, q, f });
      s.turn = nextAlive(s, s.turn);
      s.msg = `${p.name}: "${q}개의 ${f}!" — ${cur(s).name} 님, 더 높게 부르거나 거짓말을 외쳐요.`;
      return;
    }
    if (a.t === 'liar' || a.t === 'exact') {
      if (!s.bid) return '먼저 누군가 불러야 해요.';
      const b = s.bid, bidder = P(s, b.id);
      const all = s.players.flatMap(q => q.dice), count = countFace(all, b.f);
      let loser = null, gainer = null, text;
      if (a.t === 'liar') {
        if (count >= b.q) { loser = p; text = `실제로 ${count}개! ${bidder.name} 님 말이 맞았어요. ${p.name} 님이 주사위 하나를 잃어요.`; }
        else { loser = bidder; text = `실제로 ${count}개뿐! 거짓말 성공! ${bidder.name} 님이 주사위 하나를 잃어요.`; }
      } else {
        if (count === b.q) { gainer = p; text = `정확히 ${count}개! ${p.name} 님 대단해요! 주사위 하나를 되찾아요.`; }
        else { loser = p; text = `실제로 ${count}개라 틀렸어요. ${p.name} 님이 주사위 하나를 잃어요.`; }
      }
      s.reveal = { caller: p.id, kind: a.t, bid: b, count, loser: loser && loser.id, gainer: gainer && gainer.id, dice: s.players.map(q => ({ id: q.id, dice: q.dice.slice() })) };
      if (loser) loser.dice.pop();
      if (gainer && gainer.dice.length < START) gainer.dice.push(1);
      log(s, { t: 'call', id, kind: a.t, count, loser: loser && loser.id, gainer: gainer && gainer.id });
      s.phase = 'reveal'; s.deadline = Date.now() + REVEAL_MS; s.msg = text;
      if (loser && !loser.dice.length) { s.msg += ` ${loser.name} 님 탈락!`; s.outOrder.push(loser.id); }
      const next = loser && loser.dice.length ? loser : gainer || (loser ? s.players[nextAlive(s, s.players.indexOf(loser))] : p);
      s.turn = s.players.indexOf(next);
      if (alive(s).length <= 1) { s.over = true; s.phase = 'over'; s.winner = alive(s)[0].id; s.deadline = null; s.msg += ` ${alive(s)[0].name} 님 최후의 승리!`; }
      return;
    }
    return '부르기 · 거짓말 · 딱 맞아 중에서 골라 주세요.';
  }
  function timeup(s) {
    if (s.over || s.phase !== 'reveal') return;
    if (!cur(s).dice.length) s.turn = nextAlive(s, s.turn);
    rollAll(s);
    s.msg = `새 판! 다시 굴렸어요. ${cur(s).name} 님부터 불러요.`;
  }

  /* ── AI: 내 주사위 + 나머지는 확률(1/3)로 계산 ── */
  function binomTail(n, k, p) {      // P(X >= k), X ~ B(n, p)
    if (k <= 0) return 1; if (k > n) return 0;
    let c = 1, sum = 0;
    for (let i = 0; i <= n; i++) { if (i >= k) sum += c * p ** i * (1 - p) ** (n - i); c = (c * (n - i)) / (i + 1); }
    return sum;
  }
  function binomExact(n, k, p) { if (k < 0 || k > n) return 0; let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c * p ** k * (1 - p) ** (n - k); }
  function ai(s, id) {
    const p = P(s, id), unknown = totalDice(s) - p.dice.length, b = s.bid;
    const prob = (q, f) => binomTail(unknown, q - countFace(p.dice, f), 1 / 3);
    if (b) {
      const pt = prob(b.q, b.f);
      if (pt < 0.32 + s.rnd() * 0.12) {
        const ex = binomExact(unknown, b.q - countFace(p.dice, b.f), 1 / 3);
        return { t: ex > 0.32 && s.rnd() < 0.6 ? 'exact' : 'liar' };
      }
    }
    // 올릴 후보 중 가장 그럴듯한 것
    let best = null;
    const total = totalDice(s);
    for (let f = 2; f <= 6; f++) for (let q = 1; q <= total; q++) {
      if (!higher(q, f, b)) continue;
      if (b && q > b.q + 2) break;
      const pr = prob(q, f) + countFace(p.dice, f) * 0.02 + (s.rnd() - 0.5) * 0.12;
      const score = pr + (b ? 0 : q * 0.03);
      if (pr > 0.5 && (!best || score > best.score || (Math.abs(score - best.score) < 0.04 && q > best.q))) best = { q, f, score };
    }
    if (!best) {
      if (b) return { t: 'liar' };
      let f = 2; for (let x = 2; x <= 6; x++) if (countFace(p.dice, x) > countFace(p.dice, f)) f = x;
      return { t: 'bid', q: Math.max(1, countFace(p.dice, f)), f };
    }
    return { t: 'bid', q: best.q, f: best.f };
  }

  function view(s, viewer) {
    const R = s.reveal && (s.phase === 'reveal' || s.over);
    return {
      phase: s.phase, roundN: s.roundN, bid: s.bid, history: s.history.slice(-8), total: totalDice(s),
      turnId: s.over ? null : cur(s).id, over: s.over, winner: s.winner, msg: s.msg, log: s.log.slice(-12), seq: s.seq,
      players: s.players.map(p => ({ id: p.id, name: p.name, n: p.dice.length, dice: p.id === viewer || s.over ? p.dice : null })),
      reveal: R ? s.reveal : null,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = [s.winner].concat(s.players.map(p => p.id).filter(id => id !== s.winner && !s.outOrder.includes(id)), s.outOrder.slice().reverse());
    const name = id => P(s, id).name;
    return {
      title: `🎲 ${name(s.winner)} 님이 끝까지 살아남았어요!`, subtitle: '라이어 다이스 — 허세와 확률의 승부',
      ranking: [...new Set(ranked)].map((id, i) => ({ id, value: i === 0 ? `주사위 ${P(s, id).dice.length}개 남음` : '탈락' })),
    };
  }
  return {
    meta: { name: '라이어 다이스', min: 2, max: 6, bots: true, turnSec: 30, botDelay: [1100, 2000],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명'], [4, '4명']] }] },
    countFace, START,
    setup, act, ai, view, result, timeup,
    /** 사람이 모두 탈락하면 봇끼리 이어 하지 않고 끝내요 (TableKit: out · endNow) */
    out: (s, id) => { const p = P(s, id); return !p || !p.dice.length; },
    endNow(s) {
      s.over = true; s.phase = 'over'; s.winner = null; s.deadline = null;
      s.msg = '사람이 모두 탈락해서 게임을 마쳤어요.';
      const order = s.players.filter(p => p.dice.length).map(p => p.id).concat(s.outOrder.slice().reverse());
      return { title: '🏁 게임 끝!', subtitle: '사람이 모두 탈락해서 봇끼리는 더 하지 않아요',
        ranking: [...new Set(order)].map(id => ({ id, value: P(s, id).dice.length ? `주사위 ${P(s, id).dice.length}개 남음` : '탈락' })), winners: [] };
    },
    auto: (s, id) => (s.bid ? { t: 'liar' } : ai(s, id)),
    deadline: s => (s.over || s.phase !== 'reveal' ? null : s.deadline),
    pending: s => (s.over || s.phase !== 'bid' ? [] : [cur(s).id]),
  };
});
