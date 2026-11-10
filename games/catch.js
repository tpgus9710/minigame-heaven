'use strict';
/* 🎨 캐치마인드 — 돌아가며 그리고, 채팅으로 정답 맞히기
 *   대기실 옵션 (v13.3): 🔁 라운드(한 사람이 그리는 횟수 1~6번, 기본 3번) · ⏱ 그리는 시간(60~150초, 기본 80초) */
const { nextCatchWord } = require('../data/words');      // 518개 · 한 번씩 다 나오기 전엔 겹치지 않아요
const OPTIONS = [
  { key: 'rounds', label: '🔁 라운드 (한 사람이 그리는 횟수)', def: 3, values: [[1, '1번'], [2, '2번'], [3, '3번'], [4, '4번'], [5, '5번'], [6, '6번']] },
  { key: 'sec', label: '⏱ 그리는 시간', def: 80, values: [[60, '60초'], [80, '80초'], [100, '100초'], [120, '120초'], [150, '150초']] },
];
const optOf = (room, key) => {                           // 대기실에서 고른 값 (목록에 없는 값이면 기본값)
  const o = OPTIONS.find(x => x.key === key), v = Number(room.options && room.options[key]);
  return o.values.some(([x]) => x === v) ? v : o.def;
};

module.exports = H => {
  const { emit, sys, later, cancel, getPlayer, participants, pushScores, rankScores, finishGame } = H;

  function next(room) {
    const g = room.game;
    if (!g || g.over) return;
    cancel(room, g.timer);
    let drawer = null;
    while (++g.turn < g.total) { drawer = getPlayer(room, g.order[g.turn % g.order.length]); if (drawer) break; }
    if (!drawer) return finishGame(room, { title: '🎨 캐치마인드 종료!', ranking: rankScores(room, '점') });

    g.word = nextCatchWord(); g.drawerId = drawer.id; g.solved = false;
    const token = ++g.token;
    emit(room, 'catch:turn', { drawerId: drawer.id, drawerName: drawer.name, length: g.word.length, turn: g.turn + 1, total: g.total, seconds: g.sec,
      round: Math.floor(g.turn / g.order.length) + 1, rounds: g.rounds });
    H.toPlayer(drawer.id, 'catch:word', { word: g.word });
    sys(room, `🎨 ${drawer.name} 님이 그릴 차례! (${g.turn + 1}/${g.total})`);
    g.timer = later(room, g.sec * 1000, () => {
      if (g.token !== token) return;
      sys(room, `⏰ 시간 종료! 정답은 [${g.word}] 였습니다.`);
      next(room);
    });
  }

  return {
    games: { catch: { name: '캐치마인드', min: 2, max: 8, options: OPTIONS } },
    start(room) {
      const order = participants(room).map(p => p.id);
      const rounds = optOf(room, 'rounds'), sec = optOf(room, 'sec');
      room.game = { type: 'catch', order, turn: -1, total: order.length * rounds, rounds, sec, word: '', drawerId: null, solved: false, token: 0, timer: null };
      sys(room, `🎨 한 사람이 ${rounds}번씩 그려요 (모두 ${room.game.total}차례 · 한 차례 ${sec}초)`);
      emit(room, 'catch:start', { total: room.game.total, rounds, sec });
      pushScores(room);
      next(room);
    },
    /** 채팅이 정답이면 점수를 주고 채팅으로는 보내지 않음 */
    chat(room, me, msg, emoji) {
      if (emoji) return false;
      const g = room.game;
      if (me.id === g.drawerId && !g.solved && g.word && H.normWord(msg).includes(g.word)) {     // 그리는 사람이 채팅으로 정답을 말하면 안 보내요
        H.toPlayer(me.id, 'toast', { msg: '그리는 사람은 채팅으로 정답을 말할 수 없어요!', type: 'error' });
        return true;
      }
      if (g.solved || me.id === g.drawerId || H.normWord(msg) !== g.word) return false;
      g.solved = true;
      me.score += 10;
      const drawer = getPlayer(room, g.drawerId); if (drawer) drawer.score += 5;
      sys(room, `🎉 ${me.name} 님 정답! [${g.word}]  (맞힌 사람 +10점, 그린 사람 +5점)`);
      emit(room, 'catch:solved', { word: g.word, by: me.name });
      pushScores(room);
      cancel(room, g.timer);
      const token = g.token;
      g.timer = later(room, 3000, () => { if (g.token === token) next(room); });
      return true;
    },
    events: {
      draw(room, me, d, socket) { if (room.game.drawerId === me.id) H.relayDraw(room, socket, d); },
      'draw:clear'(room, me) { if (room.game.drawerId === me.id) emit(room, 'draw:clear'); },
      /** 한 획 되돌리기: 그리는 사람만 · 다른 사람 화면에서도 그 획을 지워요 */
      'draw:undo'(room, me, k, socket) {
        if (room.game.drawerId !== me.id || !Number.isFinite(+k)) return;
        socket.to(room.code).emit('draw:undo', { k: Math.floor(Math.max(0, Math.min(1e9, +k))) });
      },
      'catch:skip'(room, me) {
        const g = room.game;
        if (g.solved || g.drawerId !== me.id) return;
        sys(room, `⏩ ${me.name} 님이 패스했습니다. 정답은 [${g.word}]`);
        next(room);
      },
    },
    leave(room, p) { if (room.game.drawerId === p.id) next(room); },
  };
};
