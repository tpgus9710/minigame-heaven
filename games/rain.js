'use strict';
/* ☔ 산성비 타자 대결 — 모두에게 같은 단어가 떨어지고, 먼저 친 사람이 점수 */
const { RAIN_WORDS } = require('../data/words');
const SECONDS = 120;

module.exports = H => {
  const { emit, later } = H;

  function spawn(room) {
    const g = room.game;
    if (!g || g.over) return;
    const t = (Date.now() - g.startAt) / 1000;
    const dur = Math.round(Math.max(4500, 9500 - t * 40));    // 갈수록 빨리 떨어짐
    const gap = Math.round(Math.max(600, 1700 - t * 9));      // 갈수록 자주 내림
    const active = new Set([...g.words.values()].map(w => w.text));
    let text = H.pick(RAIN_WORDS);
    for (let i = 0; i < 6 && active.has(text); i++) text = H.pick(RAIN_WORDS);
    const id = ++g.seq;
    g.words.set(id, { text, expire: Date.now() + dur });
    emit(room, 'rain:word', { id, text, x: +(0.03 + Math.random() * 0.8).toFixed(3), dur });
    later(room, dur + 300, () => g.words.delete(id));
    later(room, gap, () => spawn(room));
  }

  return {
    games: { rain: { name: '산성비 타자 대결', min: 1, max: 8 } },
    start(room) {
      room.game = { type: 'rain', words: new Map(), seq: 0, startAt: Date.now() + 2000 };
      emit(room, 'rain:start', { seconds: SECONDS });
      H.pushScores(room);
      later(room, 2000, () => spawn(room));
      later(room, SECONDS * 1000 + 2500, () => { const top = H.participants(room).slice().sort((a, b) => b.score - a.score)[0]; H.finishGame(room, { title: `☔ ${top ? top.name : ''} 우승!`, subtitle: '산성비 타자 대결 종료', ranking: H.rankScores(room, '점') }); });
    },
    events: {
      'rain:type'(room, me, txt) {
        const g = room.game;
        const t = H.normWord(txt).slice(0, 20);
        if (!t) return;
        let hit = null;
        for (const [id, w] of g.words) if (w.text === t && w.expire > Date.now() && (hit === null || id < hit)) hit = id;
        if (hit === null) return void H.toPlayer(me.id, 'rain:miss', {});
        g.words.delete(hit);
        const pts = t.length * 10;
        me.score += pts;
        emit(room, 'rain:hit', { id: hit, by: me.id, name: me.name, pts });
        H.pushScores(room);
      },
    },
  };
};
