/* =====================================================================
 *  🃏 도둑잡기 규칙 — 52장 + 조커 1장을 모두 나눠 갖고, 같은 숫자 두 장은 버려요.
 *  내 차례에는 다음 사람의 패에서 한 장을 몰래 뽑아요. 짝이 맞으면 버리고, 패를 다 버리면 탈출!
 *  마지막까지 조커를 들고 있는 사람이 도둑(꼴찌)이에요.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.ThiefCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const rankOf = c => (c === 'JK' ? 'JK' : c.slice(1));
  const RANK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', JK: '조커' };
  const rankName = r => RANK[r] || r;
  function deck() { const d = ['JK']; for (const s of 'SHDC') for (let r = 1; r <= 13; r++) d.push(s + r); return d; }
  /** 손패에서 같은 숫자 두 장씩 버리기 */
  function discardPairs(hand) {
    const open = {}, pairs = [];
    for (const c of hand) { const r = rankOf(c); if (r !== 'JK' && open[r]) { pairs.push([open[r], c]); delete open[r]; } else open[r] = c; }
    const left = new Set(Object.values(open));
    return { hand: hand.filter(c => left.has(c)), pairs };
  }
  const cur = s => s.players[s.turn];
  const P = (s, id) => s.players.find(p => p.id === id);
  /** i번 다음 사람 중 카드가 있는 사람 */
  function nextWithCards(s, i, includeSelf) {
    const n = s.players.length;
    for (let k = includeSelf ? 0 : 1; k <= n; k++) { const j = (i + k) % n; if (s.players[j].hand.length && (includeSelf || j !== i)) return j; }
    return -1;
  }
  const targetIdx = s => nextWithCards(s, s.turn, false);

  function setup(players, rnd) {
    const d = shuffle(deck(), rnd), hands = players.map(() => []);
    d.forEach((c, i) => hands[i % players.length].push(c));
    const s = {
      rnd, turn: 0, outN: 0, over: false, loser: null, hover: null, last: null, discard: [], log: [], seq: 0, msg: '',
      players: players.map((p, i) => { const r = discardPairs(hands[i]); return { id: p.id, name: p.name, hand: shuffle(r.hand, rnd), out: 0, pairs: r.pairs.length }; }),
    };
    s.discard = [];
    for (const p of s.players) if (!p.hand.length) p.out = ++s.outN;
    s.turn = nextWithCards(s, Math.floor(rnd() * players.length), true);
    const left = s.players.filter(p => p.hand.length);
    if (left.length <= 1) { s.over = true; s.loser = left.length ? left[0].id : null; s.msg = '처음부터 짝이 다 맞아서 바로 끝났어요!'; return s; }
    s.msg = `짝을 모두 버렸어요! ${cur(s).name} 님부터 ${s.players[targetIdx(s)].name} 님의 카드를 뽑아요.`;
    return s;
  }

  function act(s, id, a) {
    const p = cur(s);
    if (s.over) return '게임이 끝났어요.';
    if (a.t === 'shuffle') {
      const me = P(s, id);
      if (!me || me.hand.length < 2) return '섞을 카드가 없어요.';
      me.hand = shuffle(me.hand, s.rnd); s.shuffled = { id, n: (s.shuffled ? s.shuffled.n : 0) + 1 };
      if (s.players[targetIdx(s)] === me) s.hover = null;
      return;
    }
    if (p.id !== id) return '지금은 내 차례가 아니에요.';
    const t = s.players[targetIdx(s)];
    if (a.t === 'hover') { s.hover = a.i == null || !(+a.i in t.hand) ? null : +a.i; return; }
    if (a.t !== 'draw') return '카드를 한 장 뽑아 주세요.';
    const idx = +a.i;
    if (!Number.isInteger(idx) || idx < 0 || idx >= t.hand.length) return '뽑을 카드를 골라 주세요.';
    const card = t.hand.splice(idx, 1)[0], r = rankOf(card);
    const j = r === 'JK' ? -1 : p.hand.findIndex(c => rankOf(c) === r);
    let pair = null;
    if (j >= 0) { pair = [p.hand.splice(j, 1)[0], card]; p.pairs++; s.discard.push(pair); if (s.discard.length > 8) s.discard.shift(); }
    else p.hand.splice(Math.floor(s.rnd() * (p.hand.length + 1)), 0, card);
    s.hover = null;
    s.last = { from: t.id, to: p.id, card, pair: !!pair, n: (s.last ? s.last.n : 0) + 1 };
    log(s, { t: 'draw', from: t.id, to: p.id, pair: pair ? r : null });
    s.msg = pair ? `${p.name} 님이 ${t.name} 님에게서 뽑은 카드로 ${rankName(r)} 짝을 맞췄어요!` : `${p.name} 님이 ${t.name} 님의 카드를 한 장 가져갔어요.`;
    for (const q of [t, p]) if (!q.hand.length && !q.out) { q.out = ++s.outN; log(s, { t: 'out', id: q.id, rank: q.out }); s.msg += ` ${q.name} 님 ${q.out}등으로 탈출!`; }
    const left = s.players.filter(q => q.hand.length);
    if (left.length <= 1) {
      s.over = true; s.loser = left.length ? left[0].id : null;
      s.msg = left.length ? `${left[0].name} 님이 조커를 끝까지 들고 있었어요. 도둑은 바로 ${left[0].name} 님!` : '모두 탈출했어요!';
      return;
    }
    // 다음 차례: 방금 카드를 뺏긴 사람 (패가 없으면 그다음 사람)
    s.turn = nextWithCards(s, s.players.indexOf(t), true);
  }
  function ai(s, id) {
    const t = s.players[targetIdx(s)];
    return { t: 'draw', i: Math.floor(s.rnd() * t.hand.length) };
  }
  function view(s, viewer) {
    const ti = s.over ? -1 : targetIdx(s), L = s.last;
    return {
      players: s.players.map(p => ({ id: p.id, name: p.name, n: p.hand.length, out: p.out, pairs: p.pairs, hand: p.id === viewer || s.over ? p.hand : null })),
      turnId: s.over ? null : cur(s).id, targetId: ti >= 0 ? s.players[ti].id : null, hover: s.hover,
      last: L ? { from: L.from, to: L.to, pair: L.pair, n: L.n, card: L.pair || s.over || viewer === L.from || viewer === L.to ? L.card : null } : null,
      shuffled: s.shuffled || null, discard: s.discard.slice(-6), over: s.over, loser: s.loser, msg: s.msg, log: s.log.slice(-10), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const order = s.players.slice().sort((a, b) => (a.out || 99) - (b.out || 99));
    const loser = P(s, s.loser);
    return {
      title: loser ? `🃏 도둑은 ${loser.name} 님!` : '🃏 도둑잡기 끝!', subtitle: '패를 먼저 다 버린 순서대로 순위가 정해져요.',
      ranking: order.map(p => ({ id: p.id, value: p.id === s.loser ? '도둑 (조커)' : `${p.out}등 탈출` })),
    };
  }
  return {
    meta: { name: '도둑잡기', min: 2, max: 6, bots: true, turnSec: 20, botDelay: [900, 1700],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] }] },
    rankOf, discardPairs,
    setup, act, ai, view, result,
    free: (s, id, a) => a.t === 'hover' || a.t === 'shuffle',
    pending: s => (s.over ? [] : [cur(s).id]),
  };
});
