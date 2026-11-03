'use strict';
/* 🃏 원카드 — 카드 코드: 무늬(S♠ H♥ D♦ C♣) + 숫자(1=A … 11=J 12=Q 13=K), 조커는 JB(흑백) · JC(컬러) */
const SUITS = ['S', 'H', 'D', 'C'];
const HAND = 7, BUST = 20, TURN_SEC = 20, ONE_MS = 4000;

const isJoker = c => c === 'JB' || c === 'JC';
const suitOf = c => (isJoker(c) ? '' : c[0]);
const rankOf = c => (isJoker(c) ? 0 : +c.slice(1));
/** 공격 카드가 더하는 장 수 */
function attackOf(c) {
  if (c === 'JC') return 7;
  if (c === 'JB') return 5;
  const r = rankOf(c);
  if (r === 1) return suitOf(c) === 'S' ? 5 : 3;
  return r === 2 ? 2 : 0;
}
/** 공격 카드의 세기 (같거나 센 카드로만 받아칠 수 있음) */
function powerOf(c) {
  if (c === 'JC') return 5;
  if (c === 'JB') return 4;
  const r = rankOf(c);
  if (r === 1) return suitOf(c) === 'S' ? 3 : 2;
  return r === 2 ? 1 : 0;
}
function canPlay(g, c) {
  const top = g.discard[g.discard.length - 1];
  if (g.attack > 0) {                                 // 공격을 받는 중: 같거나 센 공격 카드로만 받아치기
    if (!attackOf(c) || powerOf(c) < powerOf(top)) return false;
    if (isJoker(c) || isJoker(top)) return true;
    return suitOf(c) === suitOf(top) || rankOf(c) === rankOf(top);
  }
  if (isJoker(c) || isJoker(top)) return true;
  if (g.suit) return suitOf(c) === g.suit || rankOf(c) === 7;   // 7로 바뀐 무늬
  return suitOf(c) === suitOf(top) || rankOf(c) === rankOf(top);
}
function newDeck(shuffle) {
  const d = ['JB', 'JC'];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push(s + r);
  return shuffle(d);
}

module.exports = H => {
  const { participants } = H;
  const cur = g => g.order[g.turn];
  const nameOf = (room, id) => { const p = H.getPlayer(room, id); return p ? p.name : '?'; };
  const activeIds = g => g.order.filter(id => !g.out[id]);

  function take(g, id, n) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      if (!g.deck.length) {                           // 뽑을 카드가 없으면 버린 카드를 섞어서 다시
        const top = g.discard.pop();
        g.deck = H.shuffle(g.discard); g.discard = [top];
        if (!g.deck.length) break;
      }
      g.hands[id].push(g.deck.pop()); got++;
    }
    return got;
  }
  function advance(g, steps) {
    const n = g.order.length;
    for (let k = 0; k < steps; k++) {
      let guard = 0;
      do { g.turn = (g.turn + g.dir + n) % n; } while (g.out[cur(g)] && ++guard < n);
    }
  }
  function push(room) {
    const g = room.game;
    const base = {
      players: g.order.map(id => ({ id, name: nameOf(room, id), n: g.hands[id].length, out: !!g.out[id] })),
      top: g.discard[g.discard.length - 1], suit: g.suit, attack: g.attack, turnId: cur(g), dir: g.dir,
      deckN: g.deck.length, phase: g.phase, left: Math.max(0, g.deadline - Date.now()), one: g.one ? g.one.id : null,
    };
    for (const id of g.order) {
      const mine = cur(g) === id && g.phase === 'play';
      H.toPlayer(id, 'oc:state', { ...base, hand: g.hands[id], playable: mine ? g.hands[id].filter(c => canPlay(g, c)) : [] });
    }
  }
  function resetTimer(room) {
    const g = room.game;
    H.cancel(room, g.timer);
    g.deadline = Date.now() + TURN_SEC * 1000;
    g.timer = H.later(room, TURN_SEC * 1000, () => {
      if (g.phase === 'suit') return chooseSuit(room, cur(g), bestSuit(g.hands[cur(g)]), true);
      draw(room, cur(g), true);
    });
  }
  const bestSuit = hand => SUITS.map(s => [s, hand.filter(c => suitOf(c) === s).length]).sort((a, b) => b[1] - a[1])[0][0];

  function finish(room, winnerId, why) {
    const g = room.game;
    const ranked = g.order.slice().sort((a, b) => (b === winnerId) - (a === winnerId) || (!!g.out[a] - !!g.out[b]) || g.hands[a].length - g.hands[b].length);
    H.finishGame(room, {
      title: `🃏 ${nameOf(room, winnerId)} 승리!`, subtitle: why,
      ranking: ranked.map(id => ({ id, name: nameOf(room, id), value: g.out[id] ? '파산' : id === winnerId ? '다 털었어요!' : `${g.hands[id].length}장` })), winners: winnerId ? [winnerId] : [],
    });
  }
  function bust(room, id, why) {
    const g = room.game;
    g.out[id] = true;
    g.deck.unshift(...g.hands[id]); g.hands[id] = [];
    H.emit(room, 'game:out', { id });
    H.emit(room, 'oc:log', { msg: `💥 ${nameOf(room, id)} 님 ${why}` });
    const left = activeIds(g);
    if (left.length <= 1) { finish(room, left[0], '나머지가 모두 파산했어요'); return true; }
    return false;
  }
  function nextTurn(room, steps) {
    const g = room.game;
    advance(g, steps);
    g.phase = 'play';
    resetTimer(room);
    push(room);
  }

  function draw(room, id, auto) {
    const g = room.game;
    if (g.over || g.phase !== 'play' || cur(g) !== id) return;
    const n = g.attack > 0 ? g.attack : 1;
    const got = take(g, id, n);
    const wasAttack = g.attack > 0;
    g.attack = 0;
    if (g.one && g.one.id === id) g.one = null;
    H.emit(room, 'oc:log', { msg: `${auto ? '⏰ ' : ''}${nameOf(room, id)} 님이 ${got}장 ${wasAttack ? '공격을 맞았어요' : '먹었어요'}` });
    if (g.hands[id].length > BUST && bust(room, id, `카드가 ${BUST}장을 넘어 파산!`)) return;
    nextTurn(room, 1);
  }
  function chooseSuit(room, id, s, auto) {
    const g = room.game;
    if (g.phase !== 'suit' || cur(g) !== id || !SUITS.includes(s)) return;
    g.suit = s;
    H.emit(room, 'oc:log', { msg: `${auto ? '⏰ ' : ''}${nameOf(room, id)} 님이 무늬를 ${{ S: '♠', H: '♥', D: '♦', C: '♣' }[s]}로 바꿨어요` });
    nextTurn(room, 1);
  }

  return {
    games: { onecard: { name: '원카드', min: 2, max: 6 } },
    start(room) {
      const order = H.shuffle(participants(room).map(p => p.id));
      const g = room.game = { type: 'onecard', order, turn: 0, dir: 1, attack: 0, suit: null, phase: 'play', out: {}, hands: {}, deck: newDeck(H.shuffle), discard: [], one: null, deadline: 0 };
      for (const id of order) { g.hands[id] = []; take(g, id, HAND); }
      let first = g.deck.pop();                        // 첫 카드는 평범한 숫자 카드로
      while (attackOf(first) || [7, 11, 12, 13].includes(rankOf(first)) || isJoker(first)) { g.deck.unshift(first); first = g.deck.pop(); }
      g.discard.push(first);
      H.emit(room, 'oc:start', { order: order.map(id => ({ id, name: nameOf(room, id) })) });
      resetTimer(room);
      push(room);
    },
    events: {
      'oc:play'(room, me, d) {
        const g = room.game;
        if (g.phase !== 'play' || cur(g) !== me.id) return '내 차례가 아니에요.';
        const hand = g.hands[me.id];
        const cards = (Array.isArray(d && d.cards) ? d.cards : [d && d.card]).map(String).slice(0, 8);
        if (!cards.length || new Set(cards).size !== cards.length || cards.some(c => !hand.includes(c))) return;
        if (!canPlay(g, cards[0])) return g.attack ? '공격을 받는 중이에요! 같거나 센 공격 카드를 내거나 카드를 먹으세요.' : '무늬나 숫자가 맞지 않아요.';
        const sameRank = c => (isJoker(c) ? isJoker(cards[0]) : !isJoker(cards[0]) && rankOf(c) === rankOf(cards[0]));
        if (!cards.every(sameRank)) return '같은 숫자 카드만 한 번에 낼 수 있어요.';
        for (const c of cards) { hand.splice(hand.indexOf(c), 1); g.discard.push(c); }   // 마지막 장이 맨 위
        g.suit = null;
        const atk = cards.reduce((a, c) => a + attackOf(c), 0), r = rankOf(cards[0]), n = cards.length;
        if (atk) g.attack += atk;
        H.emit(room, 'oc:play', { id: me.id, name: me.name, cards, card: cards[n - 1], attack: g.attack });
        if (!hand.length) return finish(room, me.id, '카드를 모두 털었어요!');
        if (hand.length === 1) {
          g.one = { id: me.id };
          H.emit(room, 'oc:one', { id: me.id, name: me.name, ms: ONE_MS });
          H.cancel(room, g.oneTimer);
          g.oneTimer = H.later(room, ONE_MS, () => { if (g.one && g.one.id === me.id) { g.one = null; push(room); } });
        }
        if (r === 7) { g.phase = 'suit'; resetTimer(room); return void push(room); }
        if (r === 13) { resetTimer(room); return void push(room); }          // K: 한 번 더
        if (r === 12 && n % 2) g.dir *= -1;                                   // Q: 방향 바꾸기 (두 장이면 제자리)
        nextTurn(room, r === 11 ? 1 + n : 1);                                 // J: 낸 장수만큼 건너뛰기
      },
      'oc:draw'(room, me) { draw(room, me.id, false); },
      'oc:suit'(room, me, s) { chooseSuit(room, me.id, s, false); },
      'oc:shout'(room, me) {
        const g = room.game;
        if (!g.one || g.out[me.id]) return;
        const target = g.one.id;
        g.one = null;
        H.cancel(room, g.oneTimer);
        if (target === me.id) H.emit(room, 'oc:shout', { by: me.id, name: me.name, target, safe: true });
        else {
          take(g, target, 1);
          H.emit(room, 'oc:shout', { by: me.id, name: me.name, target, targetName: nameOf(room, target), safe: false });
        }
        push(room);
      },
    },
    leave(room, p) {
      const g = room.game;
      if (g.out[p.id] || !g.hands[p.id]) return;
      const wasTurn = cur(g) === p.id;
      if (bust(room, p.id, '나가서 탈락')) return;
      if (wasTurn) nextTurn(room, 1); else push(room);
    },
  };
};
Object.assign(module.exports, { canPlay, attackOf, powerOf });
