/* =====================================================================
 *  🧠 카드 짝 맞추기 (기억력 게임) — 차례대로 카드 2장을 뒤집어 같은 그림이면 가져가요.
 *   맞히면 한 번 더 · 틀리면 다시 엎고 다음 사람. 카드가 다 없어지면 많이 가져간 사람이 우승!
 *   처음에 잠깐 모두 보여 주기(옵션) · 봇 실력 = 기억력 (쉬움 · 보통 · 고수: 본 카드를 얼마나 · 몇 장까지 기억하나)
 *   화면(싱글: AI 대결) · 서버(멀티, games/table.js) 가 같은 코드를 써요. 혼자 단계 도전은 화면(memory.js)이 따로 돌려요.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.MemoryCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { log, shuffle } = TableKit.util;
  /** 카드 그림 (모두 잘 구별되는 이모지 30개씩) */
  const THEMES = {
    animal: ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐤', '🦉', '🐴', '🦄', '🐝', '🐞', '🦋', '🐢', '🐙', '🦀', '🐠', '🐬', '🐳', '🐘', '🦒'],
    food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🥕', '🌽', '🍆', '🥑', '🥦', '🍄', '🍞', '🧀', '🍔', '🍕', '🌭', '🍟', '🍩', '🍪', '🎂', '🍦', '🍭', '🍫', '🍙'],
    thing: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🎲', '🎯', '🎮', '🎸', '🎺', '🥁', '🎹', '🚗', '🚌', '🚑', '🚜', '🚲', '✈️', '🚀', '🚁', '⛵', '🎈', '🎁', '🔔', '💡', '📷', '⏰', '🔑'],
  };
  const THEME_NAMES = { animal: '동물', food: '먹을 것', thing: '물건', mix: '섞어서' };
  const PAIRS = [8, 12, 18, 24];
  /** 봇 기억력: p = 본 카드를 기억할 확률 · cap = 기억하는 카드 수 · slip = 알고도 실수할 확률 */
  const LEVELS = { easy: { p: 0.35, cap: 4, slip: 0.3 }, normal: { p: 0.6, cap: 8, slip: 0.1 }, hard: { p: 0.97, cap: 60, slip: 0 } };
  const MISS_MS = 1150, HIT_MS = 650;
  const OPTIONS = [
    { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
    { key: 'mmLv', label: '🤖 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '고수']] },
    { key: 'pairs', label: '🃏 카드 수', def: 12, values: [[8, '16장'], [12, '24장'], [18, '36장'], [24, '48장']] },
    { key: 'peek', label: '👀 처음에 모두 보여 주기', def: 3, values: [[0, '안 보여 줌'], [3, '3초'], [6, '6초']] },
    { key: 'theme', label: '🎨 그림', def: 'mix', values: [['mix', '섞어서'], ['animal', '동물'], ['food', '먹을 것'], ['thing', '물건']] },
  ];

  /** 그림 고르기: 짝 수만큼 그림을 골라 두 장씩 섞어요 */
  function deal(pairs, theme, rnd) {
    const pool = theme === 'mix' || !THEMES[theme] ? [].concat(THEMES.animal, THEMES.food, THEMES.thing) : THEMES[theme];
    const faces = shuffle(pool, rnd).slice(0, pairs);
    return shuffle(faces.concat(faces), rnd);
  }
  const cur = s => s.players[s.turn];
  const open = s => s.faces.map((_, i) => i).filter(i => s.owner[i] < 0 && !s.sel.includes(i));
  const leftPairs = s => s.owner.filter(o => o < 0).length / 2;
  /** 모두가 본 카드 → 봇마다 실력만큼 기억해요 (오래된 것부터 잊어요) */
  function remember(s, i, k = 1) {
    for (const p of s.players) {
      if (!p.bot) continue;
      const L = levelOf(s, p.id), m = s.mem[p.id] || (s.mem[p.id] = []);
      if (s.rnd() > L.p * k) continue;
      const at = m.findIndex(x => x[0] === i);
      if (at >= 0) m.splice(at, 1);
      m.push([i, s.faces[i]]);
      while (m.length > L.cap) m.shift();
    }
  }
  /** 봇 실력 (판 전체 실력 · 봇마다 따로 정할 수도 있어요: s.lv[id]) */
  const levelOf = (s, id) => LEVELS[(s.lv && s.lv[id]) || s.level] || LEVELS.normal;
  const forget = (s, ...ids) => { for (const id in s.mem) s.mem[id] = s.mem[id].filter(x => !ids.includes(x[0])); };

  function setup(players, rnd, opts) {
    opts = opts || {};
    const pairs = PAIRS.includes(+opts.pairs) ? +opts.pairs : 12;
    const theme = THEMES[opts.theme] || opts.theme === 'mix' ? opts.theme : 'mix';
    const peek = [0, 3, 6].includes(+opts.peek) ? +opts.peek : 3;
    const lv = opts.mmLv || opts.level;
    const order = shuffle(players, rnd);
    const s = {
      rnd, pairs, theme, peek, level: LEVELS[lv] ? lv : 'normal',
      faces: deal(pairs, theme, rnd), owner: [], sel: [], turn: 0, combo: 0, mem: {}, flips: 0, misses: 0,
      players: order.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, n: 0 })),
      phase: peek ? 'peek' : 'play', peekEnd: peek ? Date.now() + peek * 1000 + 700 : 0,
      last: null, lagUntil: 0, over: false, winners: [], log: [], seq: 0,
      msg: peek ? `${peek}초 동안 카드 자리를 외워요!` : `${order[0].name} 님부터 시작해요!`,
    };
    s.owner = s.faces.map(() => -1);
    if (peek) s.faces.forEach((_, i) => remember(s, i, peek >= 6 ? 0.6 : 0.4));   // 봇도 처음 보여 줄 때 조금 외워요
    return s;
  }
  function view(s, viewer) {
    const peeking = s.phase === 'peek' || s.over;
    return {
      phase: s.phase, peekEnd: s.peekEnd, pairs: s.pairs, theme: s.theme, left: leftPairs(s), combo: s.combo,
      turnId: s.over || s.phase !== 'play' ? null : cur(s).id,
      cards: s.faces.map((f, i) => ({ f: peeking || s.owner[i] >= 0 || s.sel.includes(i) ? f : null, o: s.owner[i] })),
      sel: s.sel.slice(), last: s.last, msg: s.msg, over: s.over, winners: s.winners,
      players: s.players.map((p, i) => ({ id: p.id, name: p.name, bot: p.bot, n: p.n, k: i })),
    };
  }
  const pending = s => (s.over || s.phase !== 'play' ? [] : [cur(s).id]);
  const deadline = s => (s.phase === 'peek' ? s.peekEnd : null);
  function timeup(s) {
    if (s.phase !== 'peek') return;
    s.phase = 'play';
    s.msg = `카드를 엎었어요 — ${cur(s).name} 님부터!`;
  }
  /** 화면이 맞힌 · 틀린 두 장을 보여 주는 동안은 봇 · 제한 시간이 기다려요 */
  const lag = s => Math.max(0, (s.lagUntil || 0) - Date.now());

  function act(s, id, a) {
    if (s.over) return '게임이 끝났어요.';
    if (s.phase !== 'play') return '지금은 카드를 외우는 시간이에요.';
    if (cur(s).id !== id) return '지금은 내 차례가 아니에요.';
    if (!a || a.t !== 'flip') return '카드를 눌러 뒤집어요.';
    const i = +a.i;
    if (!Number.isInteger(i) || i < 0 || i >= s.faces.length) return '없는 카드예요.';
    if (s.owner[i] >= 0) return '이미 가져간 카드예요.';
    if (s.sel.includes(i)) return '이미 뒤집은 카드예요.';
    s.flips++;
    remember(s, i);
    if (!s.sel.length) { s.sel = [i]; log(s, { t: 'flip', id, i }); return; }
    const j = s.sel[0], p = cur(s), ok = s.faces[i] === s.faces[j];
    s.sel = [];
    s.last = { i: j, j: i, fi: s.faces[j], fj: s.faces[i], ok, by: id, n: (s.last ? s.last.n : 0) + 1 };
    log(s, { t: ok ? 'pair' : 'miss', id, i: j, j: i });
    if (ok) {
      s.owner[i] = s.owner[j] = s.turn; p.n++; s.combo++;
      forget(s, i, j);
      s.lagUntil = Date.now() + HIT_MS;
      if (!leftPairs(s)) return finish(s);
      s.msg = `${p.name} 님 짝 맞춤!${s.combo > 1 ? ` (${s.combo}연속)` : ''} 한 번 더!`;
    } else {
      s.misses++; s.combo = 0;
      s.turn = (s.turn + 1) % s.players.length;
      s.lagUntil = Date.now() + MISS_MS;
      s.msg = `${p.name} 님 땡! 이제 ${cur(s).name} 님 차례`;
    }
  }
  function finish(s) {
    s.over = true;
    const top = Math.max(...s.players.map(p => p.n));
    s.winners = s.players.filter(p => p.n === top).map(p => p.id);
    s.msg = s.winners.length > 1 ? '무승부!' : `${s.players.find(p => p.id === s.winners[0]).name} 님 우승!`;
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => b.n - a.n);
    const tie = s.winners.length > 1;
    return {
      title: tie ? (s.winners.length === s.players.length ? '🧠 무승부!' : '🧠 공동 1등!') : `🧠 ${ranked[0].name} 우승!`,
      subtitle: `카드 ${s.pairs * 2}장 · ${s.flips}번 뒤집었어요`,
      ranking: ranked.map(p => ({ id: p.id, value: `${p.n}쌍` })),
      winners: s.winners.slice(),
    };
  }
  /** 봇: 기억 속에 짝이 있으면 그걸, 아니면 아직 모르는 카드를 뒤집어요 (실력만큼 가끔 실수) */
  function ai(s, id) {
    const L = levelOf(s, id), m = (s.mem[id] || []).filter(x => s.owner[x[0]] < 0 && !s.sel.includes(x[0]));
    const can = open(s);
    if (!can.length) return null;
    const known = new Set(m.map(x => x[0]));
    const pick = pool => pool[Math.floor(s.rnd() * pool.length)];
    const unknown = can.filter(i => !known.has(i));
    if (!s.sel.length) {
      if (s.rnd() >= L.slip) for (let a = 0; a < m.length; a++) for (let b = a + 1; b < m.length; b++) if (m[a][1] === m[b][1]) return { t: 'flip', i: m[a][0] };
      return { t: 'flip', i: pick(unknown.length ? unknown : can) };
    }
    const f = s.faces[s.sel[0]];
    if (s.rnd() >= L.slip) { const k = m.find(x => x[1] === f); if (k) return { t: 'flip', i: k[0] }; }
    const pool = unknown.length ? unknown : can;
    return { t: 'flip', i: pick(pool) };
  }
  /** 시간 초과: 아무 카드나 */
  const auto = s => { const can = open(s); return can.length ? { t: 'flip', i: can[Math.floor(s.rnd() * can.length)] } : null; };
  /** 나간 사람: 봇이 대신 (기억은 빈 채로) */

  return {
    meta: { name: '카드 짝 맞추기', min: 2, max: 8, bots: true, turnSec: 15, botDelay: s => (s.sel.length ? [550, 1000] : [700, 1300]), options: OPTIONS },
    THEMES, THEME_NAMES, PAIRS, LEVELS, deal,
    setup, view, act, pending, ai, auto, result, deadline, timeup, lag,
  };
});
