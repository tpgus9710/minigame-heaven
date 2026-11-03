'use strict';
/* 💎🍉 점수 대결 — 모두 같은 시드(같은 판·같은 순서)로 각자 플레이하고 점수로 겨룹니다.
 *  보석 맞추기 · 과일 합치기 · 사천성이 이 모듈을 함께 씁니다. 화면 쪽은 register(키, { multi }) 로 시작됩니다. */
const CONFIG = {
  gem: { name: '보석 맞추기 대결', seconds: 60 },
  fruit: { name: '과일 합치기 대결', seconds: 120 },
  shisen: { name: '사천성 대결', seconds: 180 },
};

module.exports = H => {
  const { participants, pushScores } = H;

  function finish(room, why) {
    const cfg = CONFIG[room.gameType];
    const ranked = participants(room).slice().sort((a, b) => b.score - a.score);
    H.finishGame(room, {
      title: `🏆 ${ranked[0] ? ranked[0].name : ''} 우승!`, subtitle: `${cfg.name} · ${why}`,
      ranking: ranked.map(p => ({ id: p.id, name: p.name, value: `${p.score.toLocaleString()}점` })),
    });
  }
  const checkEnd = room => { if (participants(room).every(p => room.game.done.has(p.id))) finish(room, '모두 끝났어요'); };

  return {
    games: Object.fromEntries(Object.entries(CONFIG).map(([k, c]) => [k, { name: c.name, min: 1, max: 8 }])),
    start(room) {
      const cfg = CONFIG[room.gameType];
      room.game = { type: room.gameType, done: new Set() };
      H.emit(room, 'sr:start', { game: room.gameType, seed: H.rand(1e9), seconds: cfg.seconds });
      pushScores(room);
      H.later(room, cfg.seconds * 1000 + 1500, () => finish(room, '⏰ 시간 종료'));
    },
    events: {
      'sr:score'(room, me, n) {
        if (room.game.done.has(me.id)) return;
        me.score = H.clamp(H.int(n), 0, 99999999);
        pushScores(room);
      },
      'sr:over'(room, me) {
        const g = room.game;
        if (g.done.has(me.id)) return;
        g.done.add(me.id);
        H.sys(room, `🏁 ${me.name} 님 끝! (${me.score.toLocaleString()}점)`);
        H.emit(room, 'game:out', { id: me.id });
        checkEnd(room);
      },
    },
    leave(room) { checkEnd(room); },
  };
};
