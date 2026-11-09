'use strict';
/* 🔤 끝말잇기 — 끝 글자(두음법칙 허용)로 시작하는 단어 잇기.
 *  판정은 사람이 아니라 국어사전(표준국어대사전 · 우리말샘 표제어 전부, lib/kodict.js)이 해요.
 *  사전 범위(대기실): 모든 낱말(기본 · 부사 · 동사 · 어근까지) · 명사만 · 표준어 명사만
 *  사전에 없는 말은 모두에게 ✗ 로 보이고, 시간 안에 다시 낼 수 있어요. 시간이 다 되면 ❤️ -1 → 새 단어로 다시 시작. */
const Dict = require('../lib/kodict');

const HEARTS = 2, TRY_GAP_MS = 350, DEAD_WAIT_MS = 2600;
const BOT_NAMES = ['봇 알파', '봇 브라보', '봇 찰리', '봇 델타', '봇 에코', '봇 폭스', '봇 골프'];
const START_WORDS = ['사과', '기차', '나무', '바다', '하늘', '구름', '친구', '학교', '가방', '연필', '우산', '시계', '거울', '고양이', '강아지',
  '토끼', '호랑이', '자동차', '비행기', '컴퓨터', '피아노', '축구', '야구', '바나나', '포도', '딸기', '수박', '김밥', '라면',
  '버스', '지하철', '소나무', '도서관', '운동장', '선생님', '눈사람', '무지개', '해바라기', '자전거', '냉장고', '편지', '여행',
  '노래', '사진', '가수', '공원', '달력', '모자', '바지', '치마', '양말', '안경', '책상', '의자', '침대', '이불', '베개', '창문',
  '우유', '빵집', '과자', '사탕', '김치', '만두', '국수', '떡국', '호떡', '감자', '고구마', '당근', '오이', '참외', '자두', '귤나무',
  '기린', '사자', '여우', '오리', '거북', '고래', '상어', '문어', '나비', '참새', '제비', '까치', '하마', '판다', '펭귄',
  '경찰', '소방관', '의사', '요리사', '화가', '농부', '어부', '마술사', '로켓', '우주', '지구', '태양', '별빛', '바람', '번개',
  '겨울', '여름', '가을', '소풍', '생일', '선물', '풍선', '인형', '장난감', '퍼즐', '보물', '지도', '나침반', '등대', '항구'];
const OPTIONS = [
  { key: 'wdDict', label: '📖 사전', def: 'all', values: [['all', '모든 낱말 (95만)'], ['wide', '명사만 (84만)'], ['std', '표준어 명사만 (73만)']] },
  { key: 'wdKill', label: '💥 한방 단어', def: 'on', values: [['on', '허용'], ['off', '금지']] },
  { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
];

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
  const opt = (room, key) => { const o = OPTIONS.find(x => x.key === key), v = room.options[key]; return o.values.some(([x]) => String(x) === String(v)) ? v : o.def; };
  const alive = g => g.order.filter(id => g.hearts[id] > 0);
  const turnId = g => g.order[g.turn];
  const seconds = g => Math.max(7, 15 - g.round * 0.4);
  const nameOf = (g, id) => g.names[id] || '?';
  const isDead = (g, w) => !Dict.canStart(startsFor(w), g.used, g.mode);      // 이을 말이 없는 한방 단어?

  function startWord(g) {
    const pool = START_WORDS.filter(w => !g.used.has(w) && Dict.allowed(Dict.lookup(w), g.mode) && !isDead(g, w));
    return pool.length ? H.pick(pool) : (Dict.pick(['가', '나', '사', '자'], { used: g.used, mode: 'std', maxLen: 3, alive: w => !isDead(g, w) }) || '사과');
  }
  function syncScores(room) {
    const g = room.game;
    for (const p of participants(room)) if (g.score[p.id] != null) p.score = g.score[p.id];
    H.pushScores(room);
  }
  function finish(room) {
    const g = room.game;
    H.cancel(room, g.timer); H.cancel(room, g.botTimer);
    const out = g.outOrder;
    const ranked = g.order.slice().sort((a, b) =>
      ((g.hearts[b] > 0) - (g.hearts[a] > 0)) || (out.indexOf(b) - out.indexOf(a)) || (g.score[b] - g.score[a]));
    const top = ranked[0];
    H.finishGame(room, {
      title: `🔤 ${top ? nameOf(g, top) : ''} 우승!`, subtitle: `이어진 단어 ${g.words}개${g.best ? ` · 가장 긴 말 「${g.best}」` : ''}`,
      lines: [g.chain.filter(x => x.by).slice(-12).map(x => x.w).join(' → ')],
      ranking: ranked.map(id => ({ id, name: nameOf(g, id), value: `${g.score[id]}단어` })), winners: top ? [top] : [],
    });
  }
  /** 차례 시작. advance: 다음 사람으로 넘기기 */
  function nextTurn(room, advance) {
    const g = room.game;
    const live = alive(g);
    if (live.length <= 1 || !live.some(id => !g.bots.has(id))) return finish(room);
    if (advance) do { g.turn = (g.turn + 1) % g.order.length; } while (g.hearts[turnId(g)] <= 0);
    g.phase = 'turn';
    const id = turnId(g), sec = seconds(g), starts = startsFor(g.word);
    g.turnAt = Date.now();
    if (isDead(g, g.word)) {                           // 💥 한방: 이을 말이 사전에 없어요 → 잠깐 보여 주고 실패
      H.emit(room, 'word:turn', { id, name: nameOf(g, id), word: g.word, starts, seconds: DEAD_WAIT_MS / 1000, hearts: g.hearts, dead: true });
      g.timer = H.later(room, DEAD_WAIT_MS, () => fail(room, id, '💥 한방! 이을 말이 사전에 없어요'));
      return;
    }
    H.emit(room, 'word:turn', { id, name: nameOf(g, id), word: g.word, starts, seconds: sec, hearts: g.hearts });
    g.timer = H.later(room, sec * 1000, () => fail(room, id, '⏰ 시간 초과'));
    if (g.bots.has(id)) botMove(room, id, sec);
  }
  function fail(room, id, why) {
    const g = room.game;
    if (g.phase !== 'turn' || turnId(g) !== id) return;
    H.cancel(room, g.timer); H.cancel(room, g.botTimer);
    g.phase = 'pause';
    g.hearts[id] = Math.max(0, g.hearts[id] - 1);
    const dead = isDead(g, g.word);
    const examples = dead ? [] : Dict.examples(startsFor(g.word), { used: g.used, mode: g.mode }, 3);
    H.emit(room, 'word:fail', { id, name: nameOf(g, id), why, hearts: g.hearts, word: g.word, examples });
    if (g.hearts[id] <= 0) { g.outOrder.push(id); H.emit(room, 'game:out', { id }); H.sys(room, `💔 ${nameOf(g, id)} 님 탈락!`); }
    H.later(room, 2600, () => newRound(room, id));
  }
  /** 실패한 다음: 새 단어로 다시 시작 (실패한 사람이 살아 있으면 그 사람부터) */
  function newRound(room, failedId) {
    const g = room.game;
    const live = alive(g);
    if (live.length <= 1 || !live.some(id => !g.bots.has(id))) return finish(room);
    g.word = startWord(g); g.used.add(g.word); g.chain.push({ w: g.word, by: null });
    H.emit(room, 'word:round', { word: g.word });
    const keep = g.hearts[failedId] > 0;
    if (!keep) { g.turn = g.order.indexOf(failedId); }
    g.phase = 'wait';
    H.later(room, 1300, () => nextTurn(room, !keep));
  }
  function accept(room, id, w, kind) {
    const g = room.game;
    H.cancel(room, g.timer); H.cancel(room, g.botTimer);
    g.used.add(w); g.chain.push({ w, by: id }); g.word = w; g.round++; g.words++;
    g.score[id] = (g.score[id] || 0) + 1;
    if (!g.best || w.length > g.best.length) g.best = w;
    const dead = isDead(g, w);
    H.emit(room, 'word:accepted', { word: w, by: id, name: nameOf(g, id), kind, dead, score: g.score });
    syncScores(room);
    g.phase = 'pause';
    H.later(room, dead ? 900 : 350, () => nextTurn(room, true));
  }
  /** 낸 말 판정 → 통과면 null, 아니면 { why, show } (show: 모두에게 ✗ 로 보여 줄지) */
  function judge(g, w) {
    if (!/^[가-힣]{2,20}$/.test(w)) return { why: '한글 2~20글자로 입력해 주세요 (한 글자 말은 안 돼요).' };
    const starts = startsFor(g.word);
    if (!starts.includes(w[0])) return { why: `'${starts.join("' 또는 '")}'(으)로 시작해야 해요.` };
    if (g.used.has(w)) return { why: '이미 나온 단어', show: true };
    const kind = Dict.lookup(w);
    if (!kind) return { why: '사전에 없는 말', show: true };
    if (!Dict.allowed(kind, g.mode)) {
      return { why: kind === 'other' ? '사전에는 있지만 명사가 아니에요 (이 방은 「명사만」)' : '사전에는 있지만 표준어 명사가 아니에요 (이 방은 「표준어 명사만」)', show: true };
    }
    if (!g.kill && isDead(g, w)) {
      return { why: `사전에는 있지만 '${startsFor(w).join("' · '")}'(으)로 시작하는 말이 없는 💥 한방 단어예요 (이 방은 한방 금지)`, show: true };
    }
    return { kind };
  }
  function botMove(room, id, sec) {
    const g = room.game, session = g.turnAt;
    const word = g.word;
    const blank = Math.random() < 0.07;               // 가끔은 봇도 말이 막혀요
    const w = blank ? null : Dict.pick(startsFor(word), { used: g.used, mode: g.mode, maxLen: 6, alive: x => !isDead(g, x) })
      || Dict.pick(startsFor(word), { used: g.used, mode: g.mode, common: false, maxLen: 8, alive: x => g.kill || !isDead(g, x) });
    if (!w) return;                                    // 정말 없으면 시간 초과로
    const wait = Math.min(sec * 1000 - 1200, 1500 + Math.random() * 2200 + w.length * 140);
    g.botTimer = H.later(room, wait, () => {
      if (g.phase !== 'turn' || turnId(g) !== id || g.turnAt !== session) return;
      const r = judge(g, w);
      if (r.kind) accept(room, id, w, r.kind);
    });
  }

  return {
    games: { word: { name: '끝말잇기', min: 1, max: 8, options: OPTIONS } },
    start(room) {
      const humans = participants(room).map(p => ({ id: p.id, name: p.name }));
      const want = Math.min(8, Math.max(2, humans.length + H.int(opt(room, 'bots'))));
      const bots = [];
      for (let i = 0; humans.length + bots.length < want; i++) bots.push({ id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length] });
      const all = humans.concat(bots);
      const order = H.shuffle(all.map(p => p.id));
      const g = room.game = {
        type: 'word', order, turn: 0, names: Object.fromEntries(all.map(p => [p.id, p.name])), bots: new Set(bots.map(b => b.id)),
        hearts: Object.fromEntries(order.map(id => [id, HEARTS])), score: Object.fromEntries(order.map(id => [id, 0])),
        used: new Set(), chain: [], phase: 'wait', round: 0, words: 0, outOrder: [], tries: {},
        mode: opt(room, 'wdDict'), kill: opt(room, 'wdKill') !== 'off', best: '',
      };
      g.word = startWord(g); g.used.add(g.word); g.chain.push({ w: g.word, by: null });
      H.emit(room, 'word:start', {
        order: order.map(id => ({ id, name: g.names[id], bot: g.bots.has(id) })), word: g.word, hearts: g.hearts,
        mode: g.mode, std: g.mode === 'std', kill: g.kill, size: Dict.count()[g.mode],
      });
      syncScores(room);
      H.later(room, 2000, () => nextTurn(room, false));
    },
    events: {
      'word:say'(room, me, text) {
        const g = room.game;
        if (g.phase !== 'turn' || turnId(g) !== me.id) return '내 차례가 아니에요.';
        const now = Date.now();
        if (now - (g.tries[me.id] || 0) < TRY_GAP_MS) return;
        g.tries[me.id] = now;
        const w = H.normWord(text).slice(0, 20);
        const r = judge(g, w);
        if (r.kind) return accept(room, me.id, w, r.kind);
        if (!r.show) return r.why;
        H.emit(room, 'word:miss', { id: me.id, name: me.name, word: w, why: r.why });
      },
    },
    leave(room, p) {
      const g = room.game;
      if (!(g.hearts[p.id] > 0)) return;
      g.hearts[p.id] = 0; g.outOrder.push(p.id);
      const live = alive(g);
      if (live.length <= 1 || !live.some(id => !g.bots.has(id))) return finish(room);
      if (g.phase === 'turn' && turnId(g) === p.id) { H.cancel(room, g.timer); H.cancel(room, g.botTimer); nextTurn(room, true); }
    },
    resync(room, p, socket) {
      const g = room.game;
      if (!g) return;
      socket.emit('word:start', {
        order: g.order.map(id => ({ id, name: g.names[id], bot: g.bots.has(id) })), word: g.word, hearts: g.hearts, mode: g.mode, std: g.mode === 'std', kill: g.kill,
        chain: g.chain.filter(x => x.by).map(x => ({ w: x.w, name: nameOf(g, x.by) })), score: g.score, resync: true,
      });
      if (g.phase === 'turn') {                         // 지금 차례도 다시 (남은 시간만큼)
        const id = turnId(g), dead = isDead(g, g.word), total = dead ? DEAD_WAIT_MS / 1000 : seconds(g);
        const left = Math.max(1, total - (Date.now() - g.turnAt) / 1000);
        socket.emit('word:turn', { id, name: nameOf(g, id), word: g.word, starts: startsFor(g.word), seconds: left, hearts: g.hearts, ...(dead ? { dead: true } : {}) });
      }
    },
  };
};
module.exports.startsFor = startsFor;
module.exports.START_WORDS = START_WORDS;
