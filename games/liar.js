'use strict';
/* 🤫 라이어 게임 — 한 붓씩 그리고 투표로 라이어 찾기 */
const { nextLiarWord } = require('../data/words');       // 주제 13가지 · 한 번씩 다 나오기 전엔 겹치지 않아요

module.exports = H => {
  const { emit, sys, later, cancel, getPlayer, participants, finishGame } = H;
  const citizens = room => participants(room).filter(p => p.id !== room.game.liarId).map(p => p.id);   // 시민 승리 → 라이어 말고 모두

  function next(room) {
    const g = room.game;
    if (!g || g.over || g.phase !== 'draw') return;
    cancel(room, g.timer);
    let d = null;
    while (++g.turn < g.total) { d = getPlayer(room, g.order[g.turn % g.order.length]); if (d) break; }
    if (!d) return vote(room);
    g.drawerId = d.id;
    const token = ++g.token;
    emit(room, 'liar:turn', { drawerId: d.id, drawerName: d.name, turn: g.turn + 1, total: g.total, seconds: 20 });
    g.timer = later(room, 20000, () => { if (g.token === token) next(room); });
  }
  function vote(room) {
    const g = room.game;
    g.phase = 'vote'; g.drawerId = null; g.votes = new Map();
    const token = ++g.token;
    emit(room, 'liar:vote', { candidates: participants(room).map(p => ({ id: p.id, name: p.name })), seconds: 40 });
    sys(room, '🗳️ 그리기 끝! 라이어라고 생각하는 사람에게 투표하세요. (채팅으로 토론 가능)');
    g.timer = later(room, 40000, () => { if (g.token === token) tally(room); });
  }
  function tally(room) {
    const g = room.game;
    if (!g || g.phase !== 'vote' || g.over) return;
    cancel(room, g.timer);
    const count = {};
    for (const t of g.votes.values()) count[t] = (count[t] || 0) + 1;
    const max = Math.max(0, ...Object.values(count));
    const top = Object.keys(count).filter(k => count[k] === max);
    const liar = getPlayer(room, g.liarId);
    const summary = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${(getPlayer(room, id) || {}).name || '?'} ${n}표`).join(', ') || '투표 없음';

    if (max === 0 || top.length !== 1 || top[0] !== g.liarId) {
      return finishGame(room, {
        title: '🤫 라이어 승리!', winners: [g.liarId],
        subtitle: `라이어는 ${liar ? liar.name : '?'} 님이었습니다. 제시어: [${g.word}] (${g.category})`,
        lines: [`투표 결과: ${summary}`],
      });
    }
    g.phase = 'guess';
    const token = ++g.token;
    emit(room, 'liar:caught', { liarId: g.liarId, liarName: liar.name, seconds: 30 });
    sys(room, `🚨 라이어 ${liar.name} 님 검거! 30초 안에 제시어를 맞히면 라이어 역전승! (투표: ${summary})`);
    g.timer = later(room, 30000, () => {
      if (g.token === token) finishGame(room, { winners: citizens(room), title: '🧑‍🤝‍🧑 시민 승리!', subtitle: `라이어 ${liar.name} 님이 시간 안에 답하지 못했습니다. 제시어: [${g.word}]` });
    });
  }

  return {
    games: { liar: { name: '라이어 게임', min: 3, max: 8 } },
    start(room) {
      const parts = participants(room);
      const [category, word] = nextLiarWord();
      const liar = H.pick(parts);
      room.game = { type: 'liar', order: H.shuffle(parts.map(p => p.id)), turn: -1, total: parts.length * 2, category, word, liarId: liar.id, phase: 'draw', votes: new Map(), drawerId: null, token: 0, timer: null };
      parts.forEach(p => H.toPlayer(p.id, 'liar:start', { isLiar: p.id === liar.id, category, word: p.id === liar.id ? null : word, total: room.game.total }));
      next(room);
    },
    events: {
      draw(room, me, d, socket) { const g = room.game; if (g.phase === 'draw' && g.drawerId === me.id) H.relayDraw(room, socket, d); },
      'liar:pass'(room, me) { const g = room.game; if (g.phase === 'draw' && g.drawerId === me.id) next(room); },
      'liar:voteFor'(room, me, targetId) {
        const g = room.game;
        if (g.phase !== 'vote' || g.votes.has(me.id) || !getPlayer(room, targetId)) return;
        g.votes.set(me.id, targetId);
        sys(room, `🗳️ ${me.name} 님 투표 완료 (${g.votes.size}/${participants(room).length})`);
        if (g.votes.size >= participants(room).length) tally(room);
      },
      'liar:guess'(room, me, w) {
        const g = room.game;
        if (g.phase !== 'guess' || me.id !== g.liarId) return;
        const guess = String(w ?? '').trim().slice(0, 20);
        if (H.normWord(guess) === H.normWord(g.word)) finishGame(room, { winners: [g.liarId], title: '🤫 라이어 역전승!', subtitle: `${me.name} 님이 제시어 [${g.word}]를 맞혔습니다!` });
        else finishGame(room, { winners: citizens(room), title: '🧑‍🤝‍🧑 시민 승리!', subtitle: `라이어 ${me.name} 님의 답 [${guess}] — 정답은 [${g.word}]` });
      },
    },
    leave(room, p) {
      const g = room.game;
      if (g.liarId === p.id) return finishGame(room, { winners: citizens(room), title: '🧑‍🤝‍🧑 시민 승리!', subtitle: `라이어 ${p.name} 님이 도망쳤습니다. 제시어는 [${g.word}]` });
      if (g.drawerId === p.id) next(room);
      if (g.phase === 'vote') { g.votes.delete(p.id); if (g.votes.size >= participants(room).length) tally(room); }
    },
  };
};
