/* =====================================================================
 *  🂡 블랙잭 규칙 — 딜러보다 21에 가깝게! 21을 넘으면 버스트.
 *  모두 동시에 베팅 → 카드 2장씩 → 차례대로 히트/스탠드/더블/스플릿 → 딜러는 17 이상까지 뽑기
 *  블랙잭(처음 두 장으로 21)은 1.5배. 정한 라운드가 끝나면 칩이 가장 많은 사람이 승리
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.BlackjackCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const START = 1000, BETS = [50, 100, 200, 500];
  const MS = { bet: 20000, deal: 1400, dealer: 850, result: 5000 };
  const rankOf = c => +c.slice(1);
  function value(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { const r = rankOf(c); if (r === 1) { aces++; t += 11; } else t += Math.min(10, r); }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { total: t, soft: aces > 0 };
  }
  const isBJ = h => h.cards.length === 2 && value(h.cards).total === 21 && !h.split;
  function shoe(rnd) { const d = []; for (let k = 0; k < 4; k++) for (const s of 'SHDC') for (let r = 1; r <= 13; r++) d.push(s + r); return shuffle(d, rnd); }
  const P = (s, id) => s.players.find(p => p.id === id);
  const inRound = p => p.hands.length > 0;

  function setup(players, rnd, opts) {
    const s = {
      rnd, shoe: shoe(rnd), round: 0, maxRounds: [5, 8, 12].includes(+(opts && opts.rounds)) ? +opts.rounds : 8,
      players: players.map(p => ({ id: p.id, name: p.name, chips: START, bet: 0, hands: [], cur: 0 })),
      dealer: [], phase: 'bet', turn: -1, deadline: null, over: false, log: [], seq: 0, msg: '',
    };
    startRound(s);
    return s;
  }
  function draw(s) { if (s.shoe.length < 20) { s.shoe = shoe(s.rnd); log(s, { t: 'shuffle' }); } return s.shoe.pop(); }
  function startRound(s) {
    s.round++; s.dealer = []; s.turn = -1;
    for (const p of s.players) { p.bet = 0; p.hands = []; p.cur = 0; }
    s.phase = 'bet'; s.deadline = Date.now() + MS.bet;
    s.msg = `${s.round}라운드 — 베팅하세요! (${s.maxRounds}라운드까지)`;
    log(s, { t: 'round', round: s.round });
  }
  function deal(s) {
    const live = s.players.filter(p => p.bet > 0);
    if (!live.length) return finish(s, '아무도 베팅하지 않았어요.');
    for (const p of live) { p.chips -= p.bet; p.hands = [{ cards: [draw(s), draw(s)], bet: p.bet, done: false, result: null }]; }
    s.dealer = [draw(s), draw(s)];
    log(s, { t: 'deal' });
    s.phase = 'deal'; s.deadline = Date.now() + MS.deal;
    s.msg = '카드를 나눠 줬어요!';
  }
  /** 다음에 행동할 손패로 (블랙잭 · 끝난 손은 건너뛰기) */
  function advanceTurn(s) {
    const dealerBJ = value(s.dealer).total === 21;
    if (dealerBJ) { s.turn = s.players.length; return dealerPhase(s); }
    for (let i = Math.max(0, s.turn); i < s.players.length; i++) {
      const p = s.players[i];
      if (!inRound(p)) continue;
      while (p.cur < p.hands.length && (p.hands[p.cur].done || isBJ(p.hands[p.cur]) || value(p.hands[p.cur].cards).total >= 21)) { p.hands[p.cur].done = true; p.cur++; }
      if (p.cur < p.hands.length) { s.turn = i; s.phase = 'play'; s.deadline = null; s.msg = `${p.name} 님 차례 — 히트 또는 스탠드!`; return; }
    }
    s.turn = s.players.length;
    dealerPhase(s);
  }
  function dealerPhase(s) {
    s.phase = 'dealer'; s.deadline = Date.now() + MS.dealer;
    const anyLive = s.players.some(p => p.hands.some(h => value(h.cards).total <= 21 && !isBJ(h)));
    s.dealerNeeds = anyLive;
    s.msg = '딜러가 카드를 공개해요…';
    log(s, { t: 'reveal' });
  }
  function dealerStep(s) {
    const v = value(s.dealer);
    if (s.dealerNeeds && (v.total < 17)) { s.dealer.push(draw(s)); log(s, { t: 'dealer' }); s.deadline = Date.now() + MS.dealer; s.msg = `딜러 ${value(s.dealer).total}`; return; }
    settle(s);
  }
  function settle(s) {
    const d = value(s.dealer), dBJ = s.dealer.length === 2 && d.total === 21;
    for (const p of s.players) for (const h of p.hands) {
      const v = value(h.cards).total;
      let win = 0;
      if (v > 21) h.result = 'bust';
      else if (isBJ(h) && !dBJ) { h.result = 'bj'; win = h.bet * 2.5; }
      else if (dBJ && !isBJ(h)) h.result = 'lose';
      else if (d.total > 21 || v > d.total) { h.result = 'win'; win = h.bet * 2; }
      else if (v === d.total) { h.result = 'push'; win = h.bet; }
      else h.result = 'lose';
      h.win = Math.floor(win); p.chips += h.win;
    }
    s.phase = 'result'; s.deadline = Date.now() + MS.result;
    s.msg = d.total > 21 ? `딜러 버스트! (${d.total})` : dBJ ? '딜러 블랙잭!' : `딜러 ${d.total}`;
    log(s, { t: 'settle' });
  }
  function finish(s, why) {
    s.over = true; s.phase = 'over'; s.deadline = null;
    s.msg = why || '게임 끝! 칩이 가장 많은 사람이 승리!';
  }
  function afterResult(s) {
    if (s.round >= s.maxRounds || s.players.every(p => p.chips < BETS[0])) return finish(s, s.round >= s.maxRounds ? '마지막 라운드가 끝났어요!' : '모두 칩이 떨어졌어요!');
    startRound(s);
  }
  function timeup(s) {
    if (s.over) return;
    if (s.phase === 'bet') {      // 시간 안에 안 건 사람은 최소 금액으로
      for (const p of s.players) if (!p.bet && p.chips >= BETS[0]) { p.bet = BETS[0]; log(s, { t: 'bet', id: p.id, amt: p.bet, auto: true }); }
      return deal(s);
    }
    if (s.phase === 'deal') return advanceTurn(s);
    if (s.phase === 'dealer') return dealerStep(s);
    if (s.phase === 'result') return afterResult(s);
  }
  function act(s, id, a) {
    const p = P(s, id);
    if (!p || s.over) return '지금은 할 수 없어요.';
    if (s.phase === 'bet') {
      if (a.t !== 'bet') return '베팅해 주세요.';
      if (p.bet) return '이미 베팅했어요.';
      const amt = Math.floor(+a.amt);
      if (!(amt >= BETS[0]) || amt > p.chips) return '베팅 금액을 확인해 주세요.';
      p.bet = amt; log(s, { t: 'bet', id, amt });
      if (s.players.every(q => q.bet || q.chips < BETS[0])) deal(s);
      return;
    }
    if (s.phase !== 'play' || s.players[s.turn] !== p) return '지금은 내 차례가 아니에요.';
    const h = p.hands[p.cur];
    if (a.t === 'hit') {
      h.cards.push(draw(s)); log(s, { t: 'hit', id });
      const v = value(h.cards).total;
      if (v >= 21) { h.done = true; if (v > 21) log(s, { t: 'bust', id }); }
    } else if (a.t === 'stand') h.done = true;
    else if (a.t === 'double') {
      if (h.cards.length !== 2 || p.chips < h.bet) return '처음 두 장일 때, 칩이 충분해야 더블할 수 있어요.';
      p.chips -= h.bet; h.bet *= 2; h.doubled = true; h.cards.push(draw(s)); h.done = true; log(s, { t: 'double', id });
    } else if (a.t === 'split') {
      if (h.cards.length !== 2 || Math.min(10, rankOf(h.cards[0])) !== Math.min(10, rankOf(h.cards[1])) || p.hands.length > 1 || p.chips < h.bet) return '같은 숫자 두 장일 때 한 번만 나눌 수 있어요.';
      p.chips -= h.bet;
      const second = { cards: [h.cards.pop(), draw(s)], bet: h.bet, done: false, result: null, split: true };
      h.cards.push(draw(s)); h.split = true;
      p.hands.push(second); log(s, { t: 'split', id });
      if (rankOf(second.cards[0]) === 1) { h.done = true; second.done = true; }   // 에이스 스플릿은 한 장씩만
    } else return '히트 · 스탠드 · 더블 · 스플릿 중에서 골라 주세요.';
    if (h.done) { p.cur++; advanceTurn(s); }
  }
  function ai(s, id) {
    const p = P(s, id);
    if (s.phase === 'bet') { const opts = BETS.filter(b => b <= p.chips && b <= Math.max(100, p.chips / 4)); return { t: 'bet', amt: opts[Math.floor(s.rnd() * opts.length)] || BETS[0] }; }
    const h = p.hands[p.cur], { total, soft } = value(h.cards), up = Math.min(10, rankOf(s.dealer[0])) === 1 ? 11 : Math.min(10, rankOf(s.dealer[0]));
    const r0 = rankOf(h.cards[0]), pair = h.cards.length === 2 && Math.min(10, r0) === Math.min(10, rankOf(h.cards[1]));
    if (pair && p.hands.length === 1 && p.chips >= h.bet && (r0 === 1 || r0 === 8)) return { t: 'split' };
    if (h.cards.length === 2 && p.chips >= h.bet && !soft && (total === 11 || (total === 10 && up <= 9))) return { t: 'double' };
    if (soft) return { t: total <= 17 || (total === 18 && up >= 9) ? 'hit' : 'stand' };
    if (total <= 11) return { t: 'hit' };
    if (total >= 17) return { t: 'stand' };
    if (total === 12) return { t: up >= 4 && up <= 6 ? 'stand' : 'hit' };
    return { t: up >= 7 ? 'hit' : 'stand' };
  }
  function pending(s) {
    if (s.over) return [];
    if (s.phase === 'bet') return s.players.filter(p => !p.bet && p.chips >= BETS[0]).map(p => p.id);
    if (s.phase === 'play' && s.players[s.turn]) return [s.players[s.turn].id];
    return [];
  }
  function view(s) {
    const hide = s.phase === 'deal' || s.phase === 'play';
    const dv = value(s.dealer);
    return {
      phase: s.phase, round: s.round, maxRounds: s.maxRounds, msg: s.msg, over: s.over, seq: s.seq, log: s.log.slice(-12), bets: BETS,
      turnId: s.phase === 'play' && s.players[s.turn] ? s.players[s.turn].id : null,
      dealer: { cards: s.dealer.map((c, i) => (hide && i === 1 ? null : c)), total: hide ? null : dv.total, up: s.dealer[0] ? value([s.dealer[0]]).total : null },
      players: s.players.map(p => ({ id: p.id, name: p.name, chips: p.chips, bet: p.bet, cur: p.cur,
        hands: p.hands.map(h => ({ cards: h.cards, bet: h.bet, done: h.done, result: h.result, win: h.win || 0, total: value(h.cards).total, soft: value(h.cards).soft, bj: isBJ(h), doubled: !!h.doubled })) })),
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => b.chips - a.chips);
    return {
      title: `🂡 ${ranked[0].name} 님이 칩왕!`, subtitle: `${s.round}라운드 · 시작 칩 ${START.toLocaleString()}`,
      ranking: ranked.map(p => ({ id: p.id, value: `${p.chips.toLocaleString()}칩 (${p.chips >= START ? '+' : ''}${(p.chips - START).toLocaleString()})` })),
    };
  }
  return {
    meta: {
      name: '블랙잭', min: 1, max: 6, bots: true, turnSec: 25, botDelay: [800, 1500],
      options: [
        { key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
        { key: 'rounds', label: '🔁 라운드', def: 8, values: [[5, '5'], [8, '8'], [12, '12']] },
      ],
    },
    value, BETS, START,
    setup, act, ai, view, result, pending, timeup,
    /** 사람이 모두 칩을 잃으면 봇끼리 이어 하지 않고 끝내요 (TableKit: out · endNow) */
    out: (s, id) => { const p = s.players.find(x => x.id === id); return !p || (p.chips < BETS[0] && !p.hands.some(h => h.bet > 0)); },
    endNow(s) { finish(s, '사람이 모두 칩을 잃어서 게임을 마쳤어요.'); return result(s); },
    auto: (s, id) => (s.phase === 'bet' ? { t: 'bet', amt: BETS[0] } : { t: 'stand' }),
    deadline: s => (s.over || s.phase === 'play' ? null : s.deadline),
  };
});
