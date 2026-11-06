'use strict';
/* ⭕ OX 퀴즈 — 15문제, 정답 10점 + 빨리 확정할수록 보너스(최대 5점)
 *  고른 답은 정답 공개 전까지 아무에게도 안 보여요(몇 명이 골랐는지도). 확정 전에는 몇 번이든 바꿀 수 있어요.
 *  모두 확정하면 시간이 남아도 바로 정답 공개. 시간이 다 되면 확정 안 한 사람은 마지막으로 고른 답으로 (보너스 없음) */
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
    g.phase = 'ask'; g.answers = {}; g.askedAt = Date.now(); g.soon = false;
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
      if (a && a.v === answer) { gained[p.id] = 10 + (a.lock ? Math.max(0, Math.round(5 * (1 - a.lt / (SECONDS * 1000)))) : 0); p.score += gained[p.id]; }
    }
    H.emit(room, 'ox:reveal', { answer, explain, picks: Object.fromEntries(Object.entries(g.answers).map(([id, a]) => [id, a.v])), lock: Object.keys(g.answers).filter(id => g.answers[id].lock), gained });
    H.pushScores(room);
    H.later(room, REVEAL, () => ask(room));
  }

  /** 모두 확정했으면 바로 정답 공개 */
  function lockCheck(room) {
    const g = room.game;
    if (!g || g.phase !== 'ask') return;
    const ps = participants(room), n = ps.filter(p => g.answers[p.id] && g.answers[p.id].lock).length;
    H.emit(room, 'ox:locked', { n, total: ps.length });
    if (ps.length && n === ps.length && !g.soon) { g.soon = true; H.later(room, 450, () => { g.soon = false; reveal(room); }); }
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
      /** 고르기 · 바꾸기 (확정 전까지). 다른 사람에게는 아무것도 안 보내요 */
      'ox:pick'(room, me, v) {
        const g = room.game;
        if (g.phase !== 'ask' || me.role === 'spectator' || (g.answers[me.id] && g.answers[me.id].lock)) return;
        g.answers[me.id] = { v: !!v, t: Date.now() - g.askedAt, lock: false };
      },
      /** 확정: 더는 못 바꿔요. 몇 명이 확정했는지만 알려요 */
      'ox:lock'(room, me) {
        const g = room.game, a = g.answers[me.id];
        if (g.phase !== 'ask' || me.role === 'spectator' || !a || a.lock) return;
        a.lock = true; a.lt = Date.now() - g.askedAt;
        lockCheck(room);
      },
    },
    leave(room) { lockCheck(room); },
  };
};
