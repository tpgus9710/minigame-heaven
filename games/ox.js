'use strict';
/* ⭕ OX 퀴즈 — 15문제, 정답 10점 + 빨리 고를수록 보너스(최대 5점) */
const QUESTIONS = require('../data/quiz');
const TOTAL = 15, SECONDS = 10, REVEAL = 4500;

module.exports = H => {
  const { participants } = H;

  function finish(room) {
    const ranked = participants(room).slice().sort((a, b) => b.score - a.score);
    H.finishGame(room, { title: `⭕ ${ranked[0] ? ranked[0].name : ''} 우승!`, subtitle: `OX 퀴즈 ${TOTAL}문제 끝`, ranking: H.rankScores(room, '점') });
  }
  function ask(room) {
    const g = room.game;
    if (++g.idx >= g.qs.length) return finish(room);
    g.phase = 'ask'; g.answers = {}; g.askedAt = Date.now();
    H.emit(room, 'ox:q', { n: g.idx + 1, total: g.qs.length, q: g.qs[g.idx][0], seconds: SECONDS });
    g.timer = H.later(room, SECONDS * 1000, () => reveal(room));
  }
  function reveal(room) {
    const g = room.game;
    if (g.phase !== 'ask') return;
    g.phase = 'reveal';
    H.cancel(room, g.timer);
    const [, answer, explain] = g.qs[g.idx];
    const gained = {};
    for (const p of participants(room)) {
      const a = g.answers[p.id];
      if (a && a.v === answer) { gained[p.id] = 10 + Math.max(0, Math.round(5 * (1 - a.t / (SECONDS * 1000)))); p.score += gained[p.id]; }
    }
    H.emit(room, 'ox:reveal', { answer, explain, picks: Object.fromEntries(Object.entries(g.answers).map(([id, a]) => [id, a.v])), gained });
    H.pushScores(room);
    H.later(room, REVEAL, () => ask(room));
  }

  return {
    games: { ox: { name: 'OX 퀴즈', min: 2, max: 8 } },
    start(room) {
      room.game = { type: 'ox', qs: H.shuffle(QUESTIONS).slice(0, TOTAL), idx: -1, phase: 'wait', answers: {} };
      H.emit(room, 'ox:start', { total: TOTAL });
      H.pushScores(room);
      H.later(room, 2500, () => ask(room));
    },
    events: {
      'ox:pick'(room, me, v) {
        const g = room.game;
        if (g.phase !== 'ask' || g.answers[me.id] || me.role === 'spectator') return;
        g.answers[me.id] = { v: !!v, t: Date.now() - g.askedAt };
        const vals = Object.values(g.answers);
        H.emit(room, 'ox:count', { o: vals.filter(a => a.v).length, x: vals.filter(a => !a.v).length });
        if (participants(room).every(p => g.answers[p.id])) H.later(room, 700, () => reveal(room));
      },
    },
  };
};
