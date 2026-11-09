'use strict';
/* ═══════════════════════════ 🃏 카드 게임 (섯다 · 포커) ═══════════════════════════
 *  - 섯다: 2장/3장, 포커: 5장/7장 (방장이 대기실에서 선택)
 *  - 기본 자금 100만원, 판돈 5천원, 한 바퀴 베팅이 끝나면 다음 카드
 *  - 3장 섯다 (v12.8): 2장 받기 → 모두 동시에 보여줄 카드 1장 고르기(open) → 베팅
 *                     → 1장 더 받기 → 모두 동시에 족보로 쓸 2장 고르기(pick) → 마지막 베팅 → 공개
 *    고른 건 모두 고를 때까지(또는 시간이 끝날 때까지) 남에게 안 보여요. 시간 초과면 첫 카드 공개 · 가장 높은 조합.
 *  - 이긴 사람이 다음 판 선, 누군가 0원이 되면 결과 → 대기실
 */
const START_CHIPS = 1000000;
const ANTE = 5000;
const TURN_SECONDS = 25;
const OPEN_SECONDS = 15;   // 3장 섯다: 보여줄 카드 고르기
const PICK_SECONDS = 20;   // 3장 섯다: 3장 중 족보로 쓸 2장 고르기
const PAIRS = [[0, 1], [0, 2], [1, 2]];

// 화투 20장: 각 월 2장. 1·3·8월에 광, 4·7·9월에 열끗
const HWATU = [];
for (let m = 1; m <= 10; m++) {
  HWATU.push({ m, k: [1, 3, 8].includes(m) ? 'gwang' : [4, 7, 9].includes(m) ? 'yeol' : 'pi' });
  HWATU.push({ m, k: 'pi' });
}
const POKER_DECK = [];
for (const s of ['♠', '♥', '♦', '♣']) for (let r = 2; r <= 14; r++) POKER_DECK.push({ r, s });

/** 섯다 2장 족보 */
function seotdaPair(a, b) {
  const [x, y] = a.m <= b.m ? [a, b] : [b, a];
  const gw = x.k === 'gwang' && y.k === 'gwang';
  if (gw && x.m === 3 && y.m === 8) return { score: 1000, name: '38광땡' };
  if (gw && x.m === 1 && y.m === 8) return { score: 990, name: '18광땡' };
  if (gw && x.m === 1 && y.m === 3) return { score: 980, name: '13광땡' };
  if (x.m === y.m) return { score: 900 + x.m, name: x.m === 10 ? '장땡' : `${x.m}땡` };
  const named = { '1-2': [800, '알리'], '1-4': [790, '독사'], '1-9': [780, '구삥'], '1-10': [770, '장삥'], '4-10': [760, '장사'], '4-6': [750, '세륙'] };
  const key = `${x.m}-${y.m}`;
  if (named[key]) return { score: named[key][0], name: named[key][1] };
  let special = null;
  if (x.m === 3 && y.m === 7 && x.k === 'gwang' && y.k === 'yeol') special = 'ddaeng';   // 땡잡이
  if (x.m === 4 && y.m === 7 && x.k === 'yeol' && y.k === 'yeol') special = 'amhaeng';   // 암행어사
  if (x.m === 4 && y.m === 9) special = x.k === 'yeol' && y.k === 'yeol' ? 'mgusa' : 'gusa';
  const k = (x.m + y.m) % 10;
  const base = k === 9 ? '갑오' : k === 0 ? '망통' : `${k}끗`;
  const sname = { ddaeng: '땡잡이', amhaeng: '암행어사', gusa: '구사', mgusa: '멍텅구리구사' }[special];
  return { score: k, name: sname ? `${sname}(${base})` : base, special };
}
/** 섯다 패 평가 (3장이면 가장 높은 2장 — 3장 섯다는 직접 고르고, 이건 시간 초과 때만 써요) */
function evalSeotda(hand) {
  if (hand.length < 2) return { score: -1, name: hand.length ? `${hand[0].m}월` : '' };
  if (hand.length === 2) return seotdaPair(hand[0], hand[1]);
  return bestPair(hand).ev;
}
/** 3장 중 점수가 가장 높은 2장 { p: [i, j], ev } */
function bestPair(hand) {
  let best = null;
  for (const p of PAIRS) {
    const ev = seotdaPair(hand[p[0]], hand[p[1]]);
    if (!best || ev.score > best.ev.score) best = { p, ev };
  }
  return best;
}
/** 섯다 쇼다운: 땡잡이 · 암행어사 · 구사(재경기) 처리 */
function seotdaResolve(list) {
  for (const c of list) {
    const top = Math.max(...list.filter(o => o.id !== c.id).map(o => o.ev.score));
    if (c.ev.special === 'gusa' && top <= 800) return { replay: true, id: c.id, name: '구사' };
    if (c.ev.special === 'mgusa' && top <= 909) return { replay: true, id: c.id, name: '멍텅구리구사' };
  }
  const best = Math.max(...list.map(c => c.ev.score));
  const eff = {};
  for (const c of list) {
    eff[c.id] = c.ev.score;
    if (c.ev.special === 'amhaeng' && (best === 990 || best === 980)) eff[c.id] = 995;   // 13·18광땡 잡음
    if (c.ev.special === 'ddaeng' && best >= 901 && best <= 909) eff[c.id] = 909.5;     // 1~9땡 잡음
  }
  return { eff };
}

const RN = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));
/** 포커 패 평가 (5장 이하) */
function evalHand(cards) {
  if (!cards.length) return { score: 0, name: '' };
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const five = cards.length === 5;
  const flush = five && cards.every(c => c.s === cards[0].s);
  const u = [...new Set(rs)];
  let sh = 0;
  if (five && u.length === 5) { if (u[0] - u[4] === 4) sh = u[0]; else if (u[0] === 14 && u[1] === 5) sh = 5; }
  const cnt = {}; rs.forEach(r => { cnt[r] = (cnt[r] || 0) + 1; });
  const groups = Object.entries(cnt).map(([r, c]) => [+r, c]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map(g => g[0]);
  const c0 = groups[0][1], c1 = groups[1] ? groups[1][1] : 0;
  let cat, tie;
  if (sh && flush) { cat = sh === 14 ? 9 : 8; tie = [sh]; }
  else if (c0 === 4) { cat = 7; tie = byGroup; }
  else if (c0 === 3 && c1 === 2) { cat = 6; tie = byGroup; }
  else if (flush) { cat = 5; tie = rs; }
  else if (sh) { cat = 4; tie = [sh]; }
  else if (c0 === 3) { cat = 3; tie = byGroup; }
  else if (c0 === 2 && c1 === 2) { cat = 2; tie = byGroup; }
  else if (c0 === 2) { cat = 1; tie = byGroup; }
  else { cat = 0; tie = rs; }
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (tie[i] || 0);
  const t = tie;
  const name = [
    `${RN(t[0])} 탑`, `${RN(t[0])} 원페어`, `${RN(t[0])}·${RN(t[1])} 투페어`, `${RN(t[0])} 트리플`, `${RN(t[0])} 스트레이트`,
    `${RN(t[0])} 플러시`, `${RN(t[0])} 풀하우스`, `${RN(t[0])} 포카드`, `${RN(t[0])} 스트레이트 플러시`, '로얄 스트레이트 플러시',
  ][cat];
  return { score, name };
}
/** 6~7장이면 가장 좋은 5장 조합 */
function evalBest(cards) {
  if (cards.length <= 5) return evalHand(cards);
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const r = evalHand([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      if (!best || r.score > best.score) best = r;
    }
  return best;
}

/** 사이드팟까지 고려해서 판돈 분배 */
function distribute(g, scoreOf) {
  const ids = Object.keys(g.seats);
  const alive = ids.filter(id => !g.seats[id].folded);
  const levels = [...new Set(ids.map(id => g.seats[id].total).filter(v => v > 0))].sort((a, b) => a - b);
  const payout = {};
  let prev = 0, first = true;
  for (const lv of levels) {
    let slice = 0;
    for (const id of ids) slice += Math.max(0, Math.min(g.seats[id].total, lv) - prev);
    if (first) { slice += g.carry; first = false; }
    let eligible = alive.filter(id => g.seats[id].total >= lv);
    if (!eligible.length) { const mx = Math.max(...alive.map(id => g.seats[id].total)); eligible = alive.filter(id => g.seats[id].total === mx); }
    const best = Math.max(...eligible.map(scoreOf));
    const winners = eligible.filter(id => scoreOf(id) === best);
    const share = Math.floor(slice / winners.length);
    winners.forEach((id, i) => { payout[id] = (payout[id] || 0) + share + (i === 0 ? slice - share * winners.length : 0); });
    prev = lv;
  }
  return payout;
}

// 숨김 카드 위치: 섯다는 전부 (3장 섯다는 모두 고른 뒤 각자 보여준 1장만 공개), 5장 포커는 첫 장, 7장 포커는 1·2·7번째
const isHidden = (g, i, s) => (g.kind === 'seotda' ? !(g.opened && s && s.open === i) : g.mode === '5card' ? i === 0 : (i === 0 || i === 1 || i === 6));
/** 3장 섯다에서 이번 고르기를 마쳤는지 */
const chosen = (g, s) => (g.phase === 'open' ? s.open >= 0 : g.phase === 'pick' ? !!s.pick : true);
function cardsForRound(g) {
  if (g.kind === 'seotda') return g.mode === '3card' ? (g.round === 1 ? 2 : 1) : 1;
  if (g.mode === '5card') return g.round === 1 ? 2 : 1;
  return g.round === 1 ? 3 : 1;
}
const evaluate = (g, hand) => (g.kind === 'seotda' ? evalSeotda(hand) : evalBest(hand));

module.exports = H => {
  const { emit, sys, later, cancel, getPlayer, finishGame, endToLobby, toPlayer, shuffle, won } = H;

  function startHand(room) {
    const players = room.players;
    if (players.length < 2) return endToLobby(room, '인원이 부족해서 대기실로 돌아갑니다.');
    const kind = room.gameType;
    const mode = kind === 'seotda' ? room.options.seotdaType : room.options.pokerType;
    if (!getPlayer(room, room.firstPlayerId)) room.firstPlayerId = players[0].id;
    const fi = players.findIndex(p => p.id === room.firstPlayerId);
    const order = [...players.slice(fi), ...players.slice(0, fi)].map(p => p.id);
    const prevHandNo = room.game && room.game.type === 'card' ? room.game.handNo : 0;

    const g = {
      type: 'card', kind, mode, order, seats: {}, deck: shuffle(kind === 'seotda' ? HWATU : POKER_DECK),
      round: 0, maxRounds: kind === 'seotda' ? 2 : mode === '7card' ? 5 : 4,
      pot: room.carry, carry: room.carry, currentBet: 0, toAct: [], turnId: null, turnEndsAt: 0,
      phase: 'dealing', token: 0, turnTimer: null, handNo: prevHandNo + 1, revealAll: false, settled: false,
      three: kind === 'seotda' && mode === '3card', opened: false, phaseEndsAt: 0, phaseSeconds: 0,
    };
    room.carry = 0;
    for (const p of players) {
      const a = Math.min(ANTE, p.chips);
      p.chips -= a; g.pot += a;
      g.seats[p.id] = { name: p.name, hand: [], ev: null, roundBet: 0, total: a, folded: false, allIn: p.chips === 0, left: false, lastAction: '', open: -1, pick: null };
    }
    room.game = g;
    emit(room, 'card:start', { handNo: g.handNo });
    emit(room, 'card:log', `🃏 ${g.handNo}번째 판 시작! 참가비 ${won(ANTE)} · 선: ${getPlayer(room, room.firstPlayerId).name}`);
    sync(room);
    later(room, 900, () => dealRound(room));
  }

  function dealRound(room) {
    const g = room.game;
    if (!g || g.type !== 'card' || g.over) return;
    g.round++;
    const alive = g.order.filter(id => !g.seats[id].folded);
    if (alive.length <= 1) return showdown(room);
    const n = cardsForRound(g);
    for (let k = 0; k < n; k++) for (const id of alive) g.seats[id].hand.push(g.deck.pop());
    for (const id of alive) { const s = g.seats[id]; s.ev = g.three && s.hand.length > 2 ? null : evaluate(g, s.hand); }   // 3장은 고른 뒤에 정해요
    g.currentBet = 0;
    for (const id of g.order) { g.seats[id].roundBet = 0; if (!g.seats[id].folded) g.seats[id].lastAction = ''; }
    emit(room, 'card:log', `🎴 ${g.round}/${g.maxRounds} 라운드 카드를 나눠줍니다.`);
    if (g.three) return startChoice(room, g.round === 1 ? 'open' : 'pick');
    startBetting(room);
  }

  function startBetting(room) {
    const g = room.game;
    if (!g || g.type !== 'card' || g.over || g.phase === 'showdown') return;
    const alive = g.order.filter(id => !g.seats[id].folded);
    if (alive.length <= 1) return showdown(room);
    g.phase = 'betting';
    g.toAct = alive.filter(id => !g.seats[id].allIn);
    if (g.toAct.length <= 1) {            // 베팅할 사람이 없으면(전원 올인) 다음 카드로
      g.toAct = []; g.turnId = null; sync(room);
      later(room, 1500, () => (g.round >= g.maxRounds ? showdown(room) : dealRound(room)));
      return;
    }
    setTurn(room);
  }

  /** 3장 섯다: 모두 동시에 고르기 — open: 보여줄 카드 1장 · pick: 족보로 쓸 2장 */
  function startChoice(room, kind) {
    const g = room.game;
    cancel(room, g.turnTimer);
    g.phase = kind; g.turnId = null; g.toAct = [];
    const sec = kind === 'open' ? OPEN_SECONDS : PICK_SECONDS;
    g.phaseSeconds = sec; g.phaseEndsAt = Date.now() + sec * 1000;
    const token = ++g.token;
    emit(room, 'card:log', kind === 'open' ? '👀 모두 보여줄 카드 1장을 골라요.' : '🃏 3장 중 족보로 쓸 2장을 골라요.');
    g.turnTimer = later(room, sec * 1000, () => {
      if (g.token !== token || g.phase !== kind || g.over) return;
      for (const id of g.order) {
        const s = g.seats[id];
        if (s.folded || chosen(g, s)) continue;
        if (kind === 'open') s.open = 0;
        else { const b = bestPair(s.hand); s.pick = b.p; s.ev = b.ev; }
        sys(room, `⏰ ${s.name} 님 시간 초과 → ${kind === 'open' ? '첫 번째 카드를 보여줘요' : '가장 높은 조합으로 정했어요'}`);
      }
      finishChoice(room);
    });
    sync(room);
  }
  function chooseOpen(room, id, i) {
    const g = room.game;
    if (!g || g.type !== 'card' || g.phase !== 'open') return '지금은 보여줄 카드를 고를 때가 아니에요.';
    const s = g.seats[id];
    if (!s || s.folded) return '이번 판에는 참여하지 않아요.';
    if (s.open >= 0) return null;                          // 이미 골랐어요
    i = Number(i);
    if ((i !== 0 && i !== 1) || !s.hand[i]) return '보여줄 카드를 다시 골라 주세요.';
    s.open = i;
    checkChoice(room);
    return null;
  }
  function choosePick(room, id, pair) {
    const g = room.game;
    if (!g || g.type !== 'card' || g.phase !== 'pick') return '지금은 족보를 고를 때가 아니에요.';
    const s = g.seats[id];
    if (!s || s.folded) return '이번 판에는 참여하지 않아요.';
    if (s.pick) return null;
    const p = Array.isArray(pair) ? pair.map(Number).sort((a, b) => a - b) : [];
    if (p.length !== 2 || !p.every(Number.isInteger) || p[0] === p[1] || p[0] < 0 || p[1] > 2 || !s.hand[p[1]]) return '카드 2장을 골라 주세요.';
    s.pick = p; s.ev = seotdaPair(s.hand[p[0]], s.hand[p[1]]);
    checkChoice(room);
    return null;
  }
  /** 모두 골랐으면 다음으로 (한 명만 남으면 바로 승부) */
  function checkChoice(room) {
    const g = room.game;
    const alive = g.order.filter(id => !g.seats[id].folded);
    if (alive.length <= 1) return showdown(room);
    if (alive.every(id => chosen(g, g.seats[id]))) return finishChoice(room);
    sync(room);
  }
  function finishChoice(room) {
    const g = room.game;
    if (!g || g.type !== 'card' || g.over || (g.phase !== 'open' && g.phase !== 'pick')) return;
    cancel(room, g.turnTimer); g.token++;
    if (g.phase === 'open') { g.opened = true; emit(room, 'card:log', '👀 보여줄 카드를 모두 공개했어요!'); }
    else emit(room, 'card:log', '🃏 모두 족보를 정했어요. 마지막 베팅!');
    startBetting(room);
  }

  function setTurn(room) {
    const g = room.game;
    cancel(room, g.turnTimer);
    g.turnId = g.toAct[0];
    g.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
    const token = ++g.token;
    g.turnTimer = later(room, TURN_SECONDS * 1000, () => {
      if (g.token !== token || !g.turnId) return;
      const s = g.seats[g.turnId];
      const call = g.currentBet - s.roundBet;
      sys(room, `⏰ ${s.name} 님 시간 초과 → 자동 ${call > 0 ? '다이' : '체크'}`);
      performBet(room, g.turnId, call > 0 ? 'die' : 'call');
    });
    sync(room);
  }

  function performBet(room, id, action) {
    const g = room.game;
    if (!g || g.type !== 'card' || g.over || g.phase !== 'betting' || g.turnId !== id) return '지금은 내 차례가 아닙니다.';
    const s = g.seats[id], p = getPlayer(room, id);
    if (!s || !p) return '플레이어를 찾을 수 없습니다.';
    const call = Math.max(0, g.currentBet - s.roundBet);
    let pay = 0, label;
    switch (action) {
      case 'die': s.folded = true; label = '다이'; break;
      case 'call': pay = call; label = call ? '콜' : '체크'; break;
      case 'bbing':
        if (g.currentBet > 0) return '삥은 이번 라운드 첫 베팅에서만 할 수 있어요.';
        pay = ANTE; label = '삥'; break;
      case 'quarter': pay = call + Math.max(ANTE, Math.floor((g.pot + call) / 4)); label = '쿼터'; break;
      case 'half': pay = call + Math.max(ANTE, Math.floor((g.pot + call) / 2)); label = '하프'; break;
      case 'allin': pay = p.chips; label = '올인'; break;
      default: return '알 수 없는 베팅입니다.';
    }
    let raised = false;
    if (action !== 'die') {
      if (pay >= p.chips) { pay = p.chips; s.allIn = true; label = '올인'; }
      p.chips -= pay; s.roundBet += pay; s.total += pay; g.pot += pay;
      if (s.roundBet > g.currentBet) { g.currentBet = s.roundBet; raised = true; }
    }
    s.lastAction = pay ? `${label} ${won(pay)}` : label;
    g.toAct = g.toAct.filter(x => x !== id);
    if (raised) {           // 레이즈하면 나머지 사람들은 다시 응답해야 함
      const i = g.order.indexOf(id);
      const after = [...g.order.slice(i + 1), ...g.order.slice(0, i)];
      g.toAct = after.filter(x => !g.seats[x].folded && !g.seats[x].allIn);
    }
    emit(room, 'card:log', `${s.name} · ${s.lastAction}`);
    advance(room);
    return null;
  }

  function advance(room) {
    const g = room.game;
    const alive = g.order.filter(id => !g.seats[id].folded);
    if (alive.length <= 1) return showdown(room);
    g.toAct = g.toAct.filter(id => !g.seats[id].folded && !g.seats[id].allIn);
    if (!g.toAct.length) {                     // 한 바퀴 베팅 완료
      g.turnId = null; cancel(room, g.turnTimer); g.token++;
      sync(room);
      later(room, 900, () => (g.round >= g.maxRounds ? showdown(room) : dealRound(room)));
      return;
    }
    setTurn(room);
  }

  function showdown(room) {
    const g = room.game;
    if (!g || g.phase === 'showdown') return;
    g.phase = 'showdown'; g.turnId = null; cancel(room, g.turnTimer); g.token++;
    const alive = g.order.filter(id => !g.seats[id].folded);
    g.revealAll = alive.length > 1;

    let scoreOf = () => 1;
    if (alive.length > 1 && g.three) {         // 혹시 못 고른 사람이 있으면 가장 높은 조합 (원래는 고르기 단계에서 다 정해져요)
      for (const id of alive) { const s = g.seats[id]; if (!s.pick || !s.ev) { const b = bestPair(s.hand); s.pick = b.p; s.ev = b.ev; } }
    }
    if (alive.length > 1) {
      if (g.kind === 'seotda') {
        const res = seotdaResolve(alive.map(id => ({ id, ev: g.seats[id].ev })));
        if (res.replay) {                      // 구사 → 재경기 (판돈 이월)
          room.carry = g.pot; g.settled = true;
          const msg = `🔁 ${g.seats[res.id].name} 님의 ${res.name}! 재경기 — 판돈 ${won(g.pot)}이 다음 판으로 넘어갑니다.`;
          sync(room);
          emit(room, 'card:result', { winners: [], message: msg, nextIn: 6 });
          sys(room, msg);
          later(room, 6000, () => nextHand(room));
          return;
        }
        scoreOf = id => res.eff[id];
      } else {
        scoreOf = id => g.seats[id].ev.score;
      }
    }
    const payout = distribute(g, scoreOf);
    const winners = Object.entries(payout).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    for (const [id, v] of winners) { const p = getPlayer(room, id); if (p) p.chips += v; }
    g.settled = true;
    if (winners.length) room.firstPlayerId = winners[0][0];   // 이긴 사람이 다음 판 선
    const list = winners.map(([id, v]) => ({ id, name: g.seats[id].name, amount: v, hand: g.revealAll ? (g.seats[id].ev ? g.seats[id].ev.name : '') : '기권승' }));
    const message = list.map(w => `🏆 ${w.name} +${won(w.amount)} (${w.hand})`).join('  ');
    sync(room);
    emit(room, 'card:result', { winners: list, message, nextIn: 6 });
    sys(room, message);
    later(room, 6000, () => nextHand(room));
  }

  function nextHand(room) {
    const broke = room.players.filter(p => p.chips <= 0);
    if (broke.length) {
      return finishGame(room, {
        title: '💸 파산자 발생!',
        subtitle: `${broke.map(p => p.name).join(', ')} 님의 돈이 바닥났습니다. 대기실로 이동합니다.`,
        ranking: room.players.slice().sort((a, b) => b.chips - a.chips).map(p => ({ id: p.id, name: p.name, value: won(p.chips) })),
        lines: ['파산한 사람은 다음 게임을 시작할 때 100만원을 다시 받습니다.'],
        returnIn: 8,
      });
    }
    if (room.players.length < 2) return endToLobby(room, '인원이 부족해서 대기실로 돌아갑니다.');
    startHand(room);
  }

  function view(room, viewer) {
    const g = room.game;
    const reveal = g.phase === 'showdown' && g.revealAll;
    const choosing = g.phase === 'open' || g.phase === 'pick';
    return {
      kind: g.kind, mode: g.mode, round: g.round, maxRounds: g.maxRounds, pot: g.pot, carry: g.carry, currentBet: g.currentBet,
      ante: ANTE, phase: g.phase, handNo: g.handNo, turnId: g.turnId, turnLeft: g.turnId ? Math.max(0, g.turnEndsAt - Date.now()) : 0,
      turnSeconds: TURN_SECONDS, firstId: room.firstPlayerId,
      three: !!g.three, opened: !!g.opened,
      phaseLeft: choosing ? Math.max(0, g.phaseEndsAt - Date.now()) : 0, phaseSeconds: choosing ? g.phaseSeconds : 0,
      seats: g.order.map(id => {
        const s = g.seats[id], p = getPlayer(room, id), mine = id === viewer, open = mine || (reveal && !s.folded);
        const visible = s.hand.filter((c, i) => !isHidden(g, i, s));
        const out = {
          id, name: s.name, chips: p ? p.chips : 0, folded: s.folded, allIn: s.allIn, left: s.left,
          roundBet: s.roundBet, total: s.total, lastAction: s.lastAction,
          cards: s.hand.map((c, i) => (open || !isHidden(g, i, s) ? c : null)),
          hid: s.hand.map((c, i) => isHidden(g, i, s)),
          handName: open ? (s.ev ? s.ev.name : '') : (g.kind === 'poker' && visible.length ? `보이는 패: ${evalBest(visible).name}` : ''),
        };
        if (g.three) {
          out.openIdx = mine || g.opened ? s.open : -1;               // 보여준(보여줄) 카드 — 남의 것은 모두 고른 뒤에
          out.pick = open && s.pick ? s.pick : null;                  // 족보로 쓴 2장 — 남의 것은 공개할 때
          out.ready = choosing && !s.folded && chosen(g, s);           // 다 골랐는지만 (무엇을 골랐는지는 비밀)
          if (mine && s.hand.length === 3) out.combos = PAIRS.map(pr => ({ i: pr, name: seotdaPair(s.hand[pr[0]], s.hand[pr[1]]).name }));
        }
        return out;
      }),
    };
  }
  function sync(room) {
    if (!room.game || room.game.type !== 'card') return;
    for (const p of room.players) toPlayer(p.id, 'card:state', view(room, p.id));
  }

  return {
    games: {
      seotda: { name: '섯다', min: 2, max: 6 },
      poker: { name: '포커', min: 2, max: 6 },
    },
    start(room) {
      room.players.forEach(p => {
        if (p.chips <= 0) { p.chips = START_CHIPS; sys(room, `💰 ${p.name} 님에게 기본 자금 ${won(START_CHIPS)}이 다시 지급되었습니다.`); }
      });
      room.firstPlayerId = (room.players.find(p => p.isHost) || room.players[0]).id;   // 첫 판 선 = 방장
      room.carry = 0;
      room.game = null;
      startHand(room);
    },
    events: {
      'card:bet'(room, me, action) { return performBet(room, me.id, String(action)) || undefined; },
      'card:open'(room, me, i) { return chooseOpen(room, me.id, i) || undefined; },
      'card:pick'(room, me, pair) { return choosePick(room, me.id, pair) || undefined; },
    },
    leave(room, p) {
      const g = room.game;
      const s = g.seats[p.id];
      if (s) { s.folded = true; s.left = true; s.lastAction = '나감'; g.toAct = g.toAct.filter(x => x !== p.id); }
      if (room.players.length < 2) return endToLobby(room, '상대방이 나가서 대기실로 돌아갑니다.');
      if (g.phase === 'betting') {
        const alive = g.order.filter(x => !g.seats[x].folded);
        if (g.turnId === p.id || alive.length <= 1) return advance(room);
      }
      if (g.phase === 'open' || g.phase === 'pick') return checkChoice(room);
      sync(room);
    },
    /** 게임 도중 대기실로 가면 이번 판에 걸었던 돈은 돌려주고, 이월된 판돈은 똑같이 나눔 */
    beforeLobby(room) {
      const g = room.game;
      if (g && g.type === 'card' && !g.settled) {
        for (const [id, s] of Object.entries(g.seats)) { const p = getPlayer(room, id); if (p) p.chips += s.total; }
        room.carry = g.carry;
        g.settled = true;
      }
      if (room.carry > 0 && room.players.length) {
        const share = Math.floor(room.carry / room.players.length);
        room.players.forEach(p => { p.chips += share; });
      }
      room.carry = 0;
    },
  };
};

// 테스트용으로 계산 함수들을 내보냄
Object.assign(module.exports, { seotdaPair, evalSeotda, bestPair, seotdaResolve, evalHand, evalBest, distribute, OPEN_SECONDS, PICK_SECONDS });
