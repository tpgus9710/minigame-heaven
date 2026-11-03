/* =====================================================================
 *  🤴 계급 전쟁 규칙 (달무티 방식) — 1(달무티)~12(농노) 카드가 숫자만큼 + 어릿광대 2장 = 80장
 *  숫자가 낮을수록 강해요. 선은 같은 숫자를 원하는 만큼 내고, 다음 사람은 같은 장수로 더 낮은 숫자를 내거나 패스.
 *  모두 패스하면 마지막에 낸 사람이 새로 시작. 어릿광대는 다른 카드와 함께면 그 숫자, 혼자면 13.
 *  먼저 다 낸 순서로 다음 판 계급이 정해지고, 농노 → 달무티 2장 · 소작농 → 총리대신 1장 세금!
 *  어릿광대 2장을 받으면 혁명(세금 없음), 농노가 받으면 대혁명(계급 뒤집기).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.DalmutiCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const J = 13;
  const NAMES = ['', '달무티', '대주교', '시종장', '남작부인', '수녀원장', '기사', '재봉사', '석공', '요리사', '양치기', '광부', '농노', '어릿광대'];
  const SUMMARY_MS = 10000;
  const titleOf = (pos, n) => (pos === 0 ? '달무티' : pos === 1 ? '총리대신' : pos === n - 1 ? '농노' : pos === n - 2 ? '소작농' : '상인');

  const P = (s, id) => s.players.find(p => p.id === id);
  const bySeat = s => s.seat.map(id => P(s, id));
  const active = s => s.players.filter(p => p.hand.length > 0);
  const counts = hand => { const c = new Array(14).fill(0); for (const x of hand) c[x]++; return c; };
  const sortHand = h => h.sort((a, b) => a - b);
  function say(s, text, t, extra) { s.msg = text; log(s, Object.assign({ t: t || 'info', text }, extra || {})); }
  function cardsText(num, cards) {
    const jn = cards.filter(x => x === J).length;
    if (num === J) return `어릿광대 ${cards.length}장`;
    return `${NAMES[num]}(${num}) ${cards.length}장${jn ? ` (광대 ${jn}장 포함)` : ''}`;
  }
  /** hand 에서 cards(여러 장)를 빼요. 없으면 false */
  function take(hand, cards) {
    const h = hand.slice();
    for (const x of cards) { const i = h.indexOf(x); if (i < 0) return false; h.splice(i, 1); }
    hand.length = 0; hand.push(...h);
    return true;
  }
  const hasAll = (hand, cards) => { const h = hand.slice(); for (const x of cards) { const i = h.indexOf(x); if (i < 0) return false; h.splice(i, 1); } return true; };

  function setup(players, rnd, opts) {
    const n = players.length;
    const s = { rnd, n, rounds: [3, 5].includes(+(opts && opts.rounds)) ? +opts.rounds : 3, round: 0, phase: 'deal', seat: [], trick: null, pile: [], passes: 0, passedIds: [],
      finished: [], revolution: null, owe: {}, taxNotes: {}, taxPublic: [], ready: [], summaryEnd: null, lastSummary: null,
      over: false, winner: null, log: [], seq: 0, msg: '', solo: !!(opts && opts.solo), sortEnd: null, revoltPick: null };
    const order = shuffle(players.map((p, i) => i), rnd);       // 첫 판 계급: 카드 뽑기로 정한 셈
    s.players = players.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, pos: order.indexOf(i), hand: [], score: 0, place: null, last: null }));
    say(s, '카드를 한 장씩 뽑아 첫 판 계급을 정했어요.', 'start');
    startRound(s);
    return s;
  }
  function startRound(s) {
    s.round++;
    s.seat = s.players.slice().sort((a, b) => a.pos - b.pos).map(p => p.id);
    s.trick = null; s.pile = []; s.passes = 0; s.passedIds = []; s.finished = []; s.revolution = null; s.owe = {}; s.taxNotes = {}; s.taxPublic = [];
    s.ready = []; s.summaryEnd = null; s.gone = new Array(14).fill(0);
    let deck = [];
    for (let v = 1; v <= 12; v++) for (let k = 0; k < v; k++) deck.push(v);
    deck.push(J, J);
    deck = shuffle(deck, s.rnd);
    const per = Math.floor(deck.length / s.n), extra = deck.length % s.n;
    bySeat(s).forEach((p, i) => { p.place = null; p.hand = sortHand(deck.splice(0, per + (i >= s.n - extra ? 1 : 0))); });
    say(s, `${s.round}판 시작! 카드를 나눴어요${extra ? ' (남는 카드는 낮은 계급부터 한 장씩)' : ''}.`, 'round');
    const holder = s.players.find(p => p.hand.filter(x => x === J).length === 2);
    s.revoltBy = null; s.revoltPick = null; s.sortEnd = null;
    if (!s.solo) {                 // 멀티: 모두 똑같이 6초 동안 카드 정리 — 누가 어릿광대 2장을 들었는지 시간으로 티 나지 않게
      s.phase = 'revolt'; s.sortEnd = Date.now() + 6000;
      if (holder && !holder.bot) s.revoltBy = holder.id;
      else if (holder && botRevolt(s, holder.id)) s.revoltPick = holder.id;
      return;
    }
    if (holder && !holder.bot) { s.phase = 'revolt'; s.revoltBy = holder.id; return; }
    if (holder && botRevolt(s, holder.id)) { revolt(s, holder); return; }
    doTax(s);
  }
  function endSort(s) {
    const by = s.revoltPick && P(s, s.revoltPick);
    s.revoltBy = null; s.revoltPick = null; s.sortEnd = null;
    if (by) revolt(s, by); else doTax(s);
  }
  function revolt(s, p) {
    const great = p.pos === s.n - 1;
    s.revolution = { by: p.id, great };
    if (great) {
      for (const q of s.players) q.pos = s.n - 1 - q.pos;
      s.seat = s.players.slice().sort((x, y) => x.pos - y.pos).map(q => q.id);
      say(s, `대혁명! 농노 ${p.name} 님이 어릿광대 2장을 공개했어요. 이번 판은 계급이 뒤집히고 세금이 없어요!`, 'revolt', { id: p.id });
    } else say(s, `혁명! ${p.name} 님이 어릿광대 2장을 공개했어요. 이번 판은 세금이 없어요!`, 'revolt', { id: p.id });
    startPlay(s);
  }
  function bestCards(hand, k) {     // 숫자가 가장 낮은(좋은) 카드 k장 (어릿광대는 13)
    return hand.slice().sort((a, b) => a - b).slice(0, k);
  }
  function doTax(s) {
    const seat = bySeat(s), n = s.n;
    const dal = seat[0], pm = seat[1], lesser = seat[n - 2], peon = seat[n - 1];
    const pay = (from, to, k, owe) => {
      const cards = bestCards(from.hand, k);
      take(from.hand, cards); to.hand.push(...cards); sortHand(to.hand);
      s.taxNotes[from.id] = { gave: cards.slice(), to: to.id };
      s.taxNotes[to.id] = { got: cards.slice(), from: from.id, owe };
      s.owe[to.id] = { n: owe, to: from.id };
      s.taxPublic.push({ from: from.id, to: to.id, n: k });
    };
    pay(peon, dal, 2, 2);
    pay(lesser, pm, 1, 1);
    say(s, `세금! 농노 ${peon.name} 님은 달무티 ${dal.name} 님에게 가장 좋은 카드 2장을, 소작농 ${lesser.name} 님은 총리대신 ${pm.name} 님에게 1장을 바쳐요.`, 'tax');
    s.phase = 'tax';
  }
  function startPlay(s) {
    s.phase = 'play'; s.trick = null; s.pile = []; s.passes = 0; s.passedIds = [];
    s.turn = s.seat[0];
    say(s, `${P(s, s.turn).name} 님(${titleOf(0, s.n)})이 먼저 내요.`, 'lead', { id: s.turn });
  }
  function nextActive(s, fromId) {
    const i = s.seat.indexOf(fromId);
    for (let k = 1; k <= s.n; k++) { const id = s.seat[(i + k) % s.n]; if (P(s, id).hand.length) return id; }
    return null;
  }
  function finishIfOut(s, p) {
    if (p.hand.length || p.place) return;
    s.finished.push(p.id); p.place = s.finished.length;
    say(s, `${p.name} 님이 ${p.place}번째로 카드를 다 냈어요!`, 'out', { id: p.id, place: p.place });
  }
  function endRound(s) {
    for (const p of active(s)) { s.finished.push(p.id); p.place = s.finished.length; }
    const rows = s.finished.map((id, i) => { const p = P(s, id), pts = s.n - 1 - i; p.score += pts; p.last = i; return { id, place: i + 1, oldTitle: titleOf(p.pos, s.n), title: titleOf(i, s.n), pts, total: p.score }; });
    s.finished.forEach((id, i) => { P(s, id).pos = i; });
    s.seat = s.finished.slice();
    s.lastSummary = { round: s.round, rows };
    s.trick = null; s.pile = []; s.passedIds = [];
    if (s.round >= s.rounds) {
      s.over = true; s.phase = 'over';
      const top = s.players.slice().sort((a, b) => b.score - a.score || a.last - b.last)[0];
      s.winner = top.id;
      say(s, `${s.round}판 모두 끝! ${top.name} 님이 ${top.score}점으로 우승!`, 'win', { id: top.id });
      return;
    }
    s.phase = 'summary'; s.ready = []; s.summaryEnd = Date.now() + SUMMARY_MS;
    say(s, `${s.round}판 끝! 새 달무티는 ${P(s, s.finished[0]).name} 님, 농노는 ${P(s, s.finished[s.n - 1]).name} 님이에요.`, 'round');
  }

  /* ── 행동 ── */
  function parsePlay(s, p, cards) {
    if (!Array.isArray(cards) || !cards.length || cards.length > 14) return { err: '낼 카드를 골라 주세요.' };
    cards = cards.map(Number);
    if (cards.some(x => !(Number.isInteger(x) && x >= 1 && x <= J))) return { err: '잘못된 카드예요.' };
    if (!hasAll(p.hand, cards)) return { err: '손에 없는 카드예요.' };
    const nums = [...new Set(cards.filter(x => x !== J))];
    if (nums.length > 1) return { err: '같은 숫자 카드만 함께 낼 수 있어요. (어릿광대는 어디에나)' };
    const num = nums.length ? nums[0] : J;
    const t = s.trick;
    if (t) {
      if (cards.length !== t.count) return { err: `이번엔 ${t.count}장을 내야 해요.` };
      if (!(num < t.num)) return { err: `${t.num}보다 낮은 숫자를 내야 해요.` };
    }
    return { cards, num };
  }
  function act(s, id, a) {
    if (s.over) return '게임이 끝났어요.';
    const p = P(s, id);
    if (!p) return '참가자가 아니에요.';
    if (s.phase === 'revolt') {
      if (s.revoltBy !== id) return '지금은 기다려 주세요.';
      if (a.t !== 'revolt') return '혁명을 일으킬지 골라 주세요.';
      s.revoltBy = null;
      if (!s.solo) { s.revoltPick = a.yes ? id : null; return; }     // 멀티: 정리 시간이 끝나면 함께 처리
      if (a.yes) revolt(s, p); else doTax(s);
      return;
    }
    if (s.phase === 'tax') {
      const o = s.owe[id];
      if (!o) return '지금은 기다려 주세요.';
      if (a.t !== 'give') return `돌려줄 카드 ${o.n}장을 골라 주세요.`;
      const cards = (a.cards || []).map(Number);
      if (cards.length !== o.n) return `돌려줄 카드 ${o.n}장을 골라 주세요.`;
      if (!hasAll(p.hand, cards)) return '손에 없는 카드예요.';
      const to = P(s, o.to);
      take(p.hand, cards); to.hand.push(...cards); sortHand(to.hand);
      s.taxNotes[id].back = cards.slice();
      s.taxNotes[to.id].back = cards.slice();
      delete s.owe[id];
      say(s, `${p.name} 님이 ${to.name} 님에게 카드 ${o.n}장을 돌려줬어요.`, 'tax', { id });
      if (!Object.keys(s.owe).length) startPlay(s);
      return;
    }
    if (s.phase === 'summary') {
      if (a.t !== 'next') return '다음 판을 기다려요.';
      if (!s.ready.includes(id)) s.ready.push(id);
      if (s.players.filter(q => !q.bot).every(q => s.ready.includes(q.id))) startRound(s);
      return;
    }
    if (s.phase !== 'play') return '지금은 할 수 없어요.';
    if (s.turn !== id) return '지금은 내 차례가 아니에요.';
    if (a.t === 'pass') {
      if (!s.trick) return '선은 패스할 수 없어요. 카드를 내 주세요.';
      s.passes++;
      if (!s.passedIds.includes(id)) s.passedIds.push(id);
      const last = P(s, s.trick.by), need = active(s).length - (last.hand.length ? 1 : 0);
      if (s.passes >= need) {
        const lead = last.hand.length ? last.id : nextActive(s, last.id);
        s.trick = null; s.pile = []; s.passes = 0; s.passedIds = [];
        s.turn = lead;
        say(s, `모두 패스! ${P(s, lead).name} 님이 새로 시작해요.`, 'lead', { id: lead });
      } else s.turn = nextActive(s, id);
      return;
    }
    if (a.t !== 'play') return '카드를 내거나 패스해 주세요.';
    const r = parsePlay(s, p, a.cards);
    if (r.err) return r.err;
    take(p.hand, r.cards);
    for (const x of r.cards) s.gone[x]++;
    s.trick = { num: r.num, count: r.cards.length, by: id, cards: r.cards.slice().sort((x, y) => x - y) };
    s.pile.push({ by: id, cards: s.trick.cards.slice(), num: r.num });
    if (s.pile.length > 8) s.pile.shift();
    s.passes = 0; s.passedIds = [];
    say(s, `${p.name} 님: ${cardsText(r.num, r.cards)}`, 'play', { id, num: r.num, count: r.cards.length });
    finishIfOut(s, p);
    if (active(s).length <= 1) { endRound(s); return; }
    s.turn = nextActive(s, id);
  }

  /* ── 봇 ── */
  function botPlay(s, id) {
    const p = P(s, id), hand = p.hand, c = counts(hand), jn = c[J], R = s.rnd, total = hand.length;
    const nums = []; for (let v = 1; v <= 12; v++) if (c[v]) nums.push(v);
    const t = s.trick;
    const make = (v, k, j) => new Array(k - j).fill(v).concat(new Array(j).fill(J));
    if (!t) {
      if (!nums.length) return { t: 'play', cards: new Array(jn).fill(J) };
      if (nums.length === 1) return { t: 'play', cards: make(nums[0], c[nums[0]] + jn, jn) };      // 남은 걸 한 번에
      let best = null;
      for (const v of nums) {
        if (v === 1) continue;                                                 // 1은 주도권 되찾기용으로 아껴요
        const sc = v + c[v] * 0.9 + R() * 0.6;
        if (!best || sc > best.sc) best = { v, sc };
      }
      if (!best) best = { v: nums[nums.length - 1] };
      return { t: 'play', cards: make(best.v, c[best.v], 0) };
    }
    const need = t.count, opts = [];
    for (const v of nums) {
      if (v >= t.num) continue;
      if (c[v] >= need) opts.push({ v, j: 0, left: c[v] - need });
      else if (c[v] + jn >= need) opts.push({ v, j: need - c[v], left: 0 });
    }
    if (!opts.length) return { t: 'pass' };
    const finisher = opts.find(o => need === total);
    if (finisher) return { t: 'play', cards: make(finisher.v, need, finisher.j) };
    let best = null;
    for (const o of opts) {
      const sc = o.v - (o.left ? 1.5 + o.left * 0.4 : 0) - o.j * (total > 6 ? 5 : 1.5) - (o.v <= 2 && total > 5 ? 4 : 0);
      if (!best || sc > best.sc) best = Object.assign({ sc }, o);
    }
    if (best.v <= 3 && total > 6 && R() < 0.55) return { t: 'pass' };
    if (best.j && total > 8 && R() < 0.7) return { t: 'pass' };
    return { t: 'play', cards: make(best.v, need, best.j) };
  }
  function worstCards(s, id, k) {
    const hand = P(s, id).hand, c = counts(hand);
    return hand.map(x => ({ x, sc: x === J ? -9 : x + (c[x] === 1 ? 3 : 0) - (c[x] >= 4 ? 2 : 0) }))
      .sort((a, b) => b.sc - a.sc).slice(0, k).map(o => o.x);
  }
  function botRevolt(s, id) {
    const p = P(s, id);
    if (p.pos === s.n - 1) return true;
    if (p.pos === s.n - 2) return s.rnd() < 0.9;
    if (p.pos >= 2) return s.rnd() < 0.25;
    return false;
  }
  function ai(s, id) {
    if (s.phase === 'revolt') return { t: 'revolt', yes: botRevolt(s, id) };
    if (s.phase === 'tax') return s.owe[id] ? { t: 'give', cards: worstCards(s, id, s.owe[id].n) } : null;
    if (s.phase === 'summary') return { t: 'next' };
    if (s.phase === 'play') return botPlay(s, id);
    return null;
  }
  function auto(s, id) {        // 시간 초과: 따라갈 땐 패스, 선이면 봇처럼 내기
    if (s.phase === 'play' && s.trick) return { t: 'pass' };
    return ai(s, id);
  }
  function pending(s) {
    if (s.over) return [];
    if (s.phase === 'revolt') return s.revoltBy ? [s.revoltBy] : [];
    if (s.phase === 'tax') return Object.keys(s.owe);
    if (s.phase === 'play') return s.turn ? [s.turn] : [];
    if (s.phase === 'summary') return s.players.filter(p => !p.bot && !s.ready.includes(p.id)).map(p => p.id);
    return [];
  }
  function view(s, viewer) {
    const me = P(s, viewer), wait = s.phase === 'revolt' && viewer !== s.revoltBy ? [] : pending(s);
    let ask = null;
    if (me && !s.over && wait.includes(viewer)) {
      if (s.phase === 'play') ask = { k: 'play', lead: !s.trick, canPass: !!s.trick, need: s.trick ? s.trick.count : null, below: s.trick ? s.trick.num : null };
      else if (s.phase === 'tax') ask = { k: 'give', n: s.owe[viewer].n, to: s.owe[viewer].to };
      else if (s.phase === 'revolt') ask = { k: 'revolt', great: me.pos === s.n - 1 };
      else if (s.phase === 'summary') ask = { k: 'next' };
    }
    return {
      round: s.round, rounds: s.rounds, phase: s.phase === 'revolt' && viewer !== s.revoltBy ? 'deal' : s.phase, n: s.n, seat: s.seat.slice(),
      players: s.players.map(p => ({ id: p.id, name: p.name, pos: p.pos, title: titleOf(p.pos, s.n), n: p.hand.length, place: p.place,
        passed: s.passedIds.includes(p.id), score: p.score, last: p.last, ready: s.ready.includes(p.id) })),
      turnId: s.phase === 'play' ? s.turn : null,
      trick: s.trick ? Object.assign({}, s.trick, { cards: s.trick.cards.slice() }) : null,
      pile: s.pile.map(x => ({ by: x.by, num: x.num, cards: x.cards.slice() })),
      my: me ? { hand: me.hand.slice(), pos: me.pos, title: titleOf(me.pos, s.n) } : null,
      tax: me ? (s.taxNotes[viewer] || null) : null, taxPublic: s.taxPublic.slice(),
      revolution: s.revolution, revoltBy: s.phase === 'revolt' && viewer === s.revoltBy ? s.revoltBy : null,
      ask, wait, finished: s.finished.slice(), summary: s.lastSummary, summaryEnd: s.summaryEnd,
      over: s.over, winner: s.winner, msg: s.msg, log: s.log.slice(-14), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const order = s.players.slice().sort((a, b) => b.score - a.score || a.last - b.last);
    return {
      title: `${order[0].name} 님이 최고의 달무티!`, subtitle: `${s.rounds}판 점수 합계 (1등 ${s.n - 1}점 … 꼴찌 0점)`,
      ranking: order.map(p => ({ id: p.id, value: `${p.score}점 · 마지막 판 ${titleOf(p.last, s.n)}` })),
    };
  }
  return {
    meta: { name: '계급 전쟁', min: 4, max: 8, bots: true, turnSec: 30, botDelay: [500, 1000],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명'], [4, '4명'], [5, '5명'], [6, '6명'], [7, '7명']] },
        { key: 'rounds', label: '🔁 판 수', def: 3, values: [[3, '3판'], [5, '5판']] }] },
    NAMES, J, titleOf, counts,
    setup, act, ai, auto, pending, view, result,
    deadline: s => (s.phase === 'summary' ? s.summaryEnd : s.phase === 'revolt' && s.sortEnd ? s.sortEnd : null),
    timeup: s => { if (s.phase === 'summary') startRound(s); else if (s.phase === 'revolt' && s.sortEnd) endSort(s); },
  };
});
