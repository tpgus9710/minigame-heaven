'use strict';
/* 🔔 과일 종치기 — 펼쳐진 카드에서 같은 과일이 딱 5개면 먼저 종을 친 사람이 카드를 모두 가져가요. */
const FRUITS = 4, COUNTS = { 1: 5, 2: 3, 3: 3, 4: 2, 5: 1 };   // 과일마다 14장, 모두 56장
const TURN_MS = 3200, LIMIT = 240;

module.exports = H => {
  const { participants } = H;

  function deck() {
    const d = [];
    for (let f = 0; f < FRUITS; f++) for (const [n, c] of Object.entries(COUNTS)) for (let i = 0; i < c; i++) d.push({ f, n: +n });
    return H.shuffle(d);
  }
  const total = s => s.deck.length + s.pile.length;
  const active = g => g.seats.filter(s => !s.out);
  const fives = g => {
    const sum = [0, 0, 0, 0];
    for (const s of g.seats) { const top = s.pile[s.pile.length - 1]; if (top) sum[top.f] += top.n; }
    return sum.includes(5);
  };

  function view(g) {
    return {
      seats: g.seats.map(s => ({ id: s.id, name: s.name, deck: s.deck.length, pile: s.pile.length, top: s.pile[s.pile.length - 1] || null, out: s.out })),
      turnId: g.seats[g.turn] ? g.seats[g.turn].id : null, lock: g.lock,
    };
  }
  function push(room) {
    const g = room.game;
    g.seats.forEach(s => { const p = H.getPlayer(room, s.id); if (p) p.score = total(s); });
    H.pushScores(room);
    H.emit(room, 'halli:state', view(g));
  }
  function finish(room, why) {
    const g = room.game;
    const ranked = g.seats.slice().sort((a, b) => (a.out - b.out) || (total(b) - total(a)));
    H.finishGame(room, { title: `🔔 ${ranked[0].name} 우승!`, subtitle: why, ranking: ranked.map(s => ({ name: s.name, value: `${total(s)}장` })) });
  }
  /** 카드가 다 떨어진 사람은 탈락 (펼친 카드는 다른 사람이 종을 칠 때까지 남아요) */
  function checkOut(room) {
    const g = room.game;
    for (const s of g.seats) if (!s.out && s.deck.length === 0 && s.pile.length === 0) { s.out = true; H.emit(room, 'game:out', { id: s.id }); H.sys(room, `😵 ${s.name} 님 카드가 떨어져 탈락!`); }
    const left = g.seats.filter(s => !s.out && s.deck.length > 0);
    if (left.length <= 1) { finish(room, left.length ? '마지막까지 카드를 지켰어요!' : '카드가 모두 떨어졌어요'); return true; }
    return false;
  }
  function nextTurn(room, from) {
    const g = room.game;
    let i = from;
    for (let k = 0; k < g.seats.length; k++) { i = (i + 1) % g.seats.length; if (!g.seats[i].out && g.seats[i].deck.length) break; }
    g.turn = i;
    H.cancel(room, g.timer);
    g.timer = H.later(room, TURN_MS, () => flip(room, g.seats[g.turn].id));
    push(room);
  }
  function flip(room, id) {
    const g = room.game, s = g.seats[g.turn];
    if (!s || s.id !== id || g.lock) return;
    const card = s.deck.pop();
    if (!card) return nextTurn(room, g.turn);
    s.pile.push(card);
    H.emit(room, 'halli:flip', { id, card });
    if (!checkOut(room)) nextTurn(room, g.turn);
  }

  return {
    games: { halli: { name: '과일 종치기', min: 2, max: 6 } },
    start(room) {
      const parts = H.shuffle(participants(room));
      const seats = parts.map(p => ({ id: p.id, name: p.name, deck: [], pile: [], out: false }));
      const d = deck(), per = Math.floor(d.length / seats.length);
      seats.forEach((s, i) => { s.deck = d.slice(i * per, (i + 1) * per); });
      room.game = { type: 'halli', seats, turn: seats.length - 1, lock: true };
      H.emit(room, 'halli:start', { seats: seats.map(s => ({ id: s.id, name: s.name })) });
      push(room);
      H.later(room, 2500, () => { room.game.lock = false; nextTurn(room, room.game.turn); });
      H.later(room, LIMIT * 1000, () => finish(room, '⏰ 시간 종료 · 카드가 가장 많은 사람 승리'));
    },
    events: {
      'halli:flip'(room, me) { flip(room, me.id); },
      'halli:ring'(room, me) {
        const g = room.game, s = g.seats.find(x => x.id === me.id);
        if (!s || s.out || g.lock) return;
        g.lock = true;
        H.cancel(room, g.timer);
        const ok = fives(g);
        let got = 0;
        if (ok) {
          const cards = [];
          g.seats.forEach(x => { cards.push(...x.pile); x.pile = []; });
          got = cards.length;
          s.deck.unshift(...H.shuffle(cards));            // 모은 카드는 내 카드 묶음 맨 아래로
        } else {
          for (const x of g.seats) if (x !== s && !x.out && s.deck.length) x.deck.unshift(s.deck.pop());
        }
        H.emit(room, 'halli:ring', { id: me.id, name: me.name, ok, got });
        push(room);
        H.later(room, ok ? 1600 : 900, () => {
          g.lock = false;
          if (checkOut(room)) return;
          const idx = g.seats.indexOf(s);
          nextTurn(room, ok && s.deck.length ? (idx - 1 + g.seats.length) % g.seats.length : g.turn - 1 < 0 ? g.seats.length - 1 : g.turn - 1);
        });
      },
    },
    leave(room, p) {
      const g = room.game, s = g.seats.find(x => x.id === p.id);
      if (!s) return;
      s.out = true; s.deck = [];
      if (!checkOut(room) && g.seats[g.turn] === s) nextTurn(room, g.turn);
    },
  };
};
