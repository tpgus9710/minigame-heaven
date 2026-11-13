'use strict';
/* ☔ 산성비 타자 대결 — 모두에게 같은 단어가 떨어지고, 먼저 친 사람이 점수
 *  v13.7: 대기실 옵션 「⌨️ 타자」 한글 · 영어(영타). 영어는 public/js/shared/rain-en.js 의 단어 · 비교 방법을 화면과 같이 써요
 *         (한/영 키를 깜빡하고 한글 자판으로 쳐도 누른 키로 바꿔서 확인 · 대소문자 상관없음) */
const { RAIN_WORDS } = require('../data/words');
const EN = require('../public/js/shared/rain-en.js');
const SECONDS = 120;
const OPTIONS = [
  { key: 'rainLang', label: '⌨️ 타자', def: 'ko', values: [['ko', '한글'], ['en', '영어 (영타)']] },
];

module.exports = H => {
  const { emit, later } = H;

  function spawn(room) {
    const g = room.game;
    if (!g || g.over) return;
    const t = (Date.now() - g.startAt) / 1000;
    const dur = Math.round(Math.max(4500, 9500 - t * 40));    // 갈수록 빨리 떨어짐
    const gap = Math.round(Math.max(600, 1700 - t * 9));      // 갈수록 자주 내림
    const active = new Set([...g.words.values()].map(w => w.text));
    let text = H.pick(g.list);
    for (let i = 0; i < 6 && active.has(text); i++) text = H.pick(g.list);
    const id = ++g.seq;
    g.words.set(id, { text, expire: Date.now() + dur });
    emit(room, 'rain:word', { id, text, x: +(0.03 + Math.random() * 0.8).toFixed(3), dur });
    later(room, dur + 300, () => g.words.delete(id));
    later(room, gap, () => spawn(room));
  }

  return {
    games: { rain: { name: '산성비 타자 대결', min: 1, max: 8, options: OPTIONS } },
    start(room) {
      const lang = room.options && room.options.rainLang === 'en' ? 'en' : 'ko';
      room.game = { type: 'rain', lang, list: lang === 'en' ? EN.WORDS : RAIN_WORDS, words: new Map(), seq: 0, startAt: Date.now() + 2000 };
      emit(room, 'rain:start', { seconds: SECONDS, lang });
      H.pushScores(room);
      later(room, 2000, () => spawn(room));
      later(room, SECONDS * 1000 + 2500, () => { const top = H.participants(room).slice().sort((a, b) => b.score - a.score)[0]; H.finishGame(room, { title: `☔ ${top ? top.name : ''} 우승!`, subtitle: `산성비 타자 대결 (${lang === 'en' ? '영어' : '한글'}) 종료`, ranking: H.rankScores(room, '점') }); });
    },
    events: {
      'rain:type'(room, me, txt) {
        const g = room.game;
        const t = (g.lang === 'en' ? EN.norm(String(txt ?? '').slice(0, 40)) : H.normWord(txt)).slice(0, 20);
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
Object.assign(module.exports, { OPTIONS });
