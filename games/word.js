'use strict';
/* 🔤 끝말잇기 — 끝 글자(두음법칙 허용)로 시작하는 단어 잇기. 다른 사람들이 👎로 거절할 수 있어요. */
const HEARTS = 2, VOTE_SECONDS = 3;
const START_WORDS = ['사과', '기차', '나무', '바다', '하늘', '구름', '친구', '학교', '가방', '연필', '우산', '시계', '거울', '고양이', '강아지',
  '토끼', '호랑이', '자동차', '비행기', '컴퓨터', '로봇', '피아노', '기타', '축구', '야구', '바나나', '포도', '딸기', '수박', '김밥', '라면',
  '버스', '지하철', '소나무', '도서관', '운동장', '선생님', '눈사람', '무지개', '해바라기', '자전거', '냉장고', '텔레비전', '스마트폰', '편지'];

/** 마지막 글자 + 두음법칙으로 바뀐 글자 (예: 력 → 역, 로 → 노) */
function startsFor(word) {
  const last = word[word.length - 1], code = last.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return [last];
  const cho = Math.floor(code / 588), jung = Math.floor((code % 588) / 28), jong = code % 28;
  const make = c => String.fromCharCode(0xAC00 + c * 588 + jung * 28 + jong);
  const Y = [2, 6, 7, 12, 17, 20];                     // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
  if (cho === 5) {                                      // ㄹ
    if (Y.includes(jung)) return [last, make(11)];      // 리 → 이
    if ([0, 1, 8, 11, 13, 18].includes(jung)) return [last, make(2)];   // 라 → 나
  }
  if (cho === 2 && Y.includes(jung)) return [last, make(11)];           // 녀 → 여
  return [last];
}

module.exports = H => {
  const { participants } = H;
  const alive = g => g.order.filter(id => g.hearts[id] > 0);
  const turnId = g => g.order[g.turn];
  const seconds = g => Math.max(7, 15 - g.round * 0.4);

  function finish(room) {
    const g = room.game;
    const out = g.outOrder;
    const ranked = participants(room).slice().sort((a, b) =>
      ((g.hearts[b.id] > 0) - (g.hearts[a.id] > 0)) || (out.indexOf(b.id) - out.indexOf(a.id)) || (b.score - a.score));
    H.finishGame(room, {
      title: `🔤 ${ranked[0] ? ranked[0].name : ''} 우승!`, subtitle: `이어진 단어 ${g.used.size - 1}개`,
      lines: [g.chain.slice(-12).join(' → ')],
      ranking: ranked.map(p => ({ name: p.name, value: `${p.score}단어` })),
    });
  }
  function nextTurn(room, advance) {
    const g = room.game;
    if (alive(g).length <= 1) return finish(room);
    if (advance) do { g.turn = (g.turn + 1) % g.order.length; } while (g.hearts[turnId(g)] <= 0);
    g.phase = 'turn';
    const id = turnId(g), p = H.getPlayer(room, id), sec = seconds(g);
    H.emit(room, 'word:turn', { id, name: p ? p.name : '?', word: g.word, starts: startsFor(g.word), seconds: sec, hearts: g.hearts });
    g.timer = H.later(room, sec * 1000, () => fail(room, id, '⏰ 시간 초과'));
  }
  function fail(room, id, why) {
    const g = room.game;
    H.cancel(room, g.timer);
    g.hearts[id] = Math.max(0, g.hearts[id] - 1);
    const p = H.getPlayer(room, id);
    H.emit(room, 'word:fail', { id, name: p ? p.name : '?', why, hearts: g.hearts });
    if (g.hearts[id] <= 0) { g.outOrder.push(id); H.emit(room, 'game:out', { id }); H.sys(room, `💔 ${p ? p.name : '?'} 님 탈락!`); }
    g.phase = 'pause';
    H.later(room, 1500, () => nextTurn(room, true));
  }
  function resolveVote(room) {
    const g = room.game;
    if (g.phase !== 'vote') return;
    H.cancel(room, g.voteTimer);
    const { w, by } = g.pending;
    if (g.votes.size >= g.need) { H.emit(room, 'word:rejected', { word: w, by }); return fail(room, by, `👎 '${w}' 거절됨`); }
    g.used.add(w); g.chain.push(w); g.word = w; g.round++;
    const p = H.getPlayer(room, by);
    if (p) { p.score++; H.pushScores(room); }
    H.emit(room, 'word:accepted', { word: w, by, name: p ? p.name : '?' });
    nextTurn(room, true);
  }

  return {
    games: { word: { name: '끝말잇기', min: 2, max: 8 } },
    start(room) {
      const order = H.shuffle(participants(room).map(p => p.id));
      const word = H.pick(START_WORDS);
      room.game = { type: 'word', order, turn: 0, word, used: new Set([word]), chain: [word], hearts: Object.fromEntries(order.map(id => [id, HEARTS])),
        phase: 'wait', round: 0, outOrder: [], votes: new Set() };
      H.emit(room, 'word:start', { order: order.map(id => ({ id, name: H.getPlayer(room, id).name })), word, hearts: room.game.hearts });
      H.pushScores(room);
      H.later(room, 2000, () => nextTurn(room, false));
    },
    events: {
      'word:say'(room, me, text) {
        const g = room.game;
        if (g.phase !== 'turn' || turnId(g) !== me.id) return '내 차례가 아니에요.';
        const w = H.normWord(text);
        if (!/^[가-힣]{2,12}$/.test(w)) return '한글 2~12글자로 입력해 주세요.';
        const starts = startsFor(g.word);
        if (!starts.includes(w[0])) return `'${starts.join("' 또는 '")}'(으)로 시작해야 해요.`;
        if (g.used.has(w)) return '이미 나온 단어예요.';
        H.cancel(room, g.timer);
        g.phase = 'vote'; g.pending = { w, by: me.id }; g.votes = new Set();
        const others = alive(g).filter(id => id !== me.id).length;
        g.need = Math.floor(others / 2) + 1;
        H.emit(room, 'word:vote', { word: w, by: me.id, name: me.name, seconds: VOTE_SECONDS, need: g.need });
        g.voteTimer = H.later(room, VOTE_SECONDS * 1000, () => resolveVote(room));
      },
      'word:veto'(room, me) {
        const g = room.game;
        if (g.phase !== 'vote' || me.id === g.pending.by || !(g.hearts[me.id] > 0) || g.votes.has(me.id)) return;
        g.votes.add(me.id);
        H.emit(room, 'word:vetoCount', { n: g.votes.size, need: g.need });
        if (g.votes.size >= g.need) resolveVote(room);
      },
    },
    leave(room, p) {
      const g = room.game;
      if (!(g.hearts[p.id] > 0)) return;
      g.hearts[p.id] = 0; g.outOrder.push(p.id);
      if (alive(g).length <= 1) return finish(room);
      if ((g.phase === 'turn' && turnId(g) === p.id) || (g.phase === 'vote' && g.pending.by === p.id)) { H.cancel(room, g.timer); H.cancel(room, g.voteTimer); nextTurn(room, true); }
    },
  };
};
module.exports.startsFor = startsFor;
