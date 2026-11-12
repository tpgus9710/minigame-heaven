'use strict';
/* 🔍 틀린그림찾기 — 모두 같은 사진 두 장을 보고, 다른 곳을 먼저 찾아 누른 사람이 가져가요 (1곳 = 1점).
 *  v13.6: 진짜 사진(CC0)을 사람이 하나하나 고쳐서 만든 차이 · 사진 난이도 옵션(쉬움 ~ 지옥: 작고 헷갈리는 곳을 더 많이)
 *  사진마다 새 씨앗 → shared/spot-core.js 가 화면 · 서버에서 똑같은 판(사진 · 고친 곳 · 어느 쪽)을 만들어요. 서버는 누른 자리만 확인해요.
 *  한 게임 안에서는 같은 사진이 다시 나오지 않아요. 다음 사진 번호를 미리 알려 줘서 화면이 미리 받아 둬요.
 *  틀리면 1.5초 동안 못 눌러요. 다 찾거나 시간이 끝나면 다음 사진 (못 찾은 곳은 모두에게 보여 줘요).
 *  봇 0~3명 (쉬움 · 보통 · 고수: 찾는 데 걸리는 시간). 혼자 방을 시작하면 봇 1명과 해요. */
const Core = require('../public/js/shared/spot-core');

const BOT_NAMES = ['봇 돋보기', '봇 망원경', '봇 현미경'];
const LOCK_MS = 1500, GAP_MS = 3800, READY_MS = 1200;
const BOT_MS = { easy: [11000, 22000], normal: [6500, 14000], hard: [3500, 8000] };
const OPTIONS = [
  { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
  { key: 'dfLv', label: '🤖 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '고수']] },
  { key: 'dfPic', label: '🖼️ 사진 난이도', def: 2.5, values: [[1.5, '쉬움'], [2.5, '보통'], [3.5, '어려움'], [4.5, '지옥']] },
  { key: 'rounds', label: '🖼️ 사진 수', def: 5, values: [[3, '3장'], [5, '5장'], [7, '7장']] },
  { key: 'diffs', label: '🔍 사진마다 다른 곳', def: 5, values: [[3, '3곳'], [5, '5곳'], [7, '7곳']] },
  { key: 'dfSec', label: '⏱️ 사진마다 시간', def: 90, values: [[60, '60초'], [90, '90초'], [120, '120초']] },
];

module.exports = H => {
  const { participants } = H;
  const opt = (room, key) => { const o = OPTIONS.find(x => x.key === key), v = room.options[key]; return o.values.some(([x]) => String(x) === String(v)) ? (typeof o.def === 'number' ? Number(v) : v) : o.def; };
  const roundView = g => ({ round: g.round, rounds: g.rounds, seed: g.puz.seed, photo: g.puz.photo, n: g.n, lv: g.lvPic, sec: g.sec, left: Math.max(0, g.endAt - Date.now()), found: Object.entries(g.found).map(([i, id]) => [+i, id]), score: g.score });
  /** 다른 곳을 g.n 곳 낼 수 있는 사진 중 아직 이 게임에서 안 나온 것 하나 */
  function freshPhoto(g) {
    const all = Core.eligible(g.n), pool = all.filter(i => !g.used.includes(i));
    const list = pool.length ? pool : all;
    return list[Math.floor(Math.random() * list.length)];
  }

  function syncScores(room) {
    const g = room.game;
    for (const p of participants(room)) if (g.score[p.id] != null) p.score = g.score[p.id];
    H.pushScores(room);
  }
  function finish(room, why) {
    const g = room.game;
    if (!g || g.over) return;
    const ranked = g.order.slice().sort((a, b) => g.score[b] - g.score[a]);
    const top = ranked[0], tie = ranked.length > 1 && g.score[ranked[1]] === g.score[top];
    H.finishGame(room, {
      title: tie ? '🔍 공동 1등!' : `🔍 ${g.names[top]} 우승!`, subtitle: `${why} · 사진 ${g.rounds}장 · 다른 곳 ${g.total}곳`,
      ranking: ranked.map(id => ({ id, name: g.names[id], value: `${g.score[id]}곳` })),
      winners: ranked.filter(id => g.score[id] === g.score[top]),
    });
  }
  function nextRound(room) {
    const g = room.game;
    if (!g || g.over) return;
    if (g.round >= g.rounds) return finish(room, '사진을 모두 봤어요');
    g.round++;
    const photo = g.next != null ? g.next : freshPhoto(g);
    g.used.push(photo);
    g.next = g.round < g.rounds ? freshPhoto(g) : null;
    g.puz = Core.make(1 + Math.floor(Math.random() * 2147480000), g.n, g.lvPic, { photo });
    g.found = {}; g.phase = 'play';
    g.startAt = Date.now() + READY_MS; g.endAt = g.startAt + g.sec * 1000;
    g.total += g.puz.diffs.length;
    H.emit(room, 'df:round', { ...roundView(g), at: READY_MS });
    H.cancel(room, g.timer);
    g.timer = H.later(room, READY_MS + g.sec * 1000, () => endRound(room, 'time'));
    for (const b of g.bots) planBot(room, b, g.round);
  }
  /** 봇: 실력만큼 기다렸다가 아직 아무도 못 찾은 곳 하나를 찾아요 (찾으면 다음 곳을 또) */
  function planBot(room, id, round) {
    const g = room.game, [lo, hi] = BOT_MS[g.lv] || BOT_MS.normal, k = 1 + 0.15 * (g.lvPic - 2.5);   // 어려운 사진은 봇도 오래 걸려요
    H.later(room, READY_MS + (lo + Math.random() * (hi - lo)) * k, () => {
      if (g.over || g.round !== round || g.phase !== 'play') return;
      const left = g.puz.diffs.map((_, i) => i).filter(i => g.found[i] == null);
      if (!left.length) return;
      take(room, id, left[Math.floor(Math.random() * left.length)]);
      planBot(room, id, round);
    });
  }
  function take(room, id, i) {
    const g = room.game;
    g.found[i] = id; g.score[id]++;
    H.emit(room, 'df:found', { round: g.round, i, id, name: g.names[id], score: g.score });
    syncScores(room);
    if (Object.keys(g.found).length >= g.puz.diffs.length) endRound(room, 'all');
  }
  function endRound(room, why) {
    const g = room.game;
    if (!g || g.over || g.phase !== 'play') return;
    g.phase = 'gap';
    H.cancel(room, g.timer);
    const missed = g.puz.diffs.map((_, i) => i).filter(i => g.found[i] == null);
    H.emit(room, 'df:end', { round: g.round, rounds: g.rounds, why, missed, score: g.score, next: g.next });
    g.timer = H.later(room, GAP_MS, () => nextRound(room));
  }

  return {
    games: { spot: { name: '틀린그림찾기', min: 1, max: 8, options: OPTIONS } },
    start(room) {
      const humans = participants(room).map(p => ({ id: p.id, name: p.name }));
      const nb = Math.min(3, Math.max(humans.length < 2 ? 1 : 0, H.int(opt(room, 'bots'))));   // 혼자면 봇 1명은 꼭
      const bots = Array.from({ length: nb }, (_, i) => ({ id: 'bot' + i, name: BOT_NAMES[i], bot: true }));
      const all = humans.concat(bots), n = opt(room, 'diffs');
      room.game = {
        type: 'spot', order: all.map(p => p.id), names: Object.fromEntries(all.map(p => [p.id, p.name])), bots: bots.map(b => b.id),
        score: Object.fromEntries(all.map(p => [p.id, 0])), lock: {}, round: 0, rounds: opt(room, 'rounds'), n, lvPic: opt(room, 'dfPic'),
        sec: opt(room, 'dfSec'), lv: opt(room, 'dfLv'), total: 0, phase: 'ready', found: {}, puz: null, over: false, used: [], next: null,
      };
      room.game.next = freshPhoto(room.game);
      H.emit(room, 'df:start', { players: all.map(p => ({ id: p.id, name: p.name, bot: !!p.bot })), rounds: room.game.rounds, n, sec: room.game.sec, lv: room.game.lv, next: room.game.next });
      syncScores(room);
      H.later(room, 1500, () => nextRound(room));
    },
    events: {
      'df:tap'(room, me, d) {
        const g = room.game;
        if (!g || g.over || g.phase !== 'play' || g.score[me.id] == null || !d || H.int(d.r) !== g.round) return;
        if (Date.now() < g.startAt || (g.lock[me.id] || 0) > Date.now()) return;
        const x = H.num(d.x), y = H.num(d.y), t = H.num(d.tol);
        if (!(x >= 0 && x <= Core.W && y >= 0 && y <= Core.H)) return;
        const tol = t >= 5 && t <= 22 ? t : 9;                         // 손가락 여유 (화면이 작을수록 크게 · 최대 22)
        const i = Core.hit(g.puz.diffs, x, y, g.found, tol);
        if (i >= 0) return take(room, me.id, i);
        if (Core.near(g.puz.diffs, x, y, g.found, tol)) return H.toPlayer(me.id, 'df:dup', { x, y });   // 이미 찾은 곳 — 벌칙 없음
        g.lock[me.id] = Date.now() + LOCK_MS;
        H.toPlayer(me.id, 'df:miss', { x, y, lock: LOCK_MS });
      },
    },
    leave(room) {
      const g = room.game;
      if (g && !g.over && !participants(room).length) finish(room, '모두 나갔어요');
    },
    resync(room, p, socket) {
      const g = room.game;
      if (!g) return;
      socket.emit('df:start', { players: g.order.map(id => ({ id, name: g.names[id], bot: g.bots.includes(id) })), rounds: g.rounds, n: g.n, sec: g.sec, lv: g.lv, resync: true, score: g.score, next: g.next });
      if (g.puz) socket.emit('df:round', { ...roundView(g), at: 0, resync: true, gap: g.phase === 'gap' });
    },
  };
};
Object.assign(module.exports, { OPTIONS, BOT_MS });
