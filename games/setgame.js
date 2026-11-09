'use strict';
/* 🔺 세트 찾기 (보드게임 SET 방식) — 모두 같은 바닥을 보고, 세트(카드 3장)를 먼저 찾아 누른 사람이 가져가요.
 *  세트 = 개수 · 모양 · 색 · 채우기 네 가지가 각각 '모두 같거나 모두 다른' 3장 (규칙: public/js/shared/setgame-core.js)
 *  틀리면 -1점(0점 아래로는 안 내려가요) · 2초 동안 못 눌러요. 바닥에 세트가 없으면 3장 더. 더미가 비고 세트가 없으면 끝.
 *  봇 0~3명 (실력: 쉬움 · 보통 · 고수) — 봇도 바닥만 보고 찾아요. 1명이면 봇과 둘이서. */
const Core = require('../public/js/shared/setgame-core');

const BOT_NAMES = ['봇 세모', '봇 네모', '봇 동그라미'];
const LOCK_MS = 2000, LIMIT_MS = 15 * 60 * 1000;
const OPTIONS = [
  { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
  { key: 'sgLv', label: '🤖 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '고수']] },
];

module.exports = H => {
  const { participants } = H;
  const opt = (room, key) => { const o = OPTIONS.find(x => x.key === key), v = room.options[key]; return o.values.some(([x]) => String(x) === String(v)) ? v : o.def; };
  const view = g => ({ table: g.s.table, deck: g.s.deck.length, ver: g.ver, score: g.score, added: g.s.added });

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
      title: tie ? '🔺 공동 1등!' : `🔺 ${g.names[top]} 우승!`, subtitle: `${why} · 찾은 세트 ${g.found}개`,
      ranking: ranked.map(id => ({ id, name: g.names[id], value: `${g.score[id]}세트` })),
      winners: ranked.filter(id => g.score[id] === g.score[top]),
    });
  }
  /** 바닥이 바뀔 때마다 봇마다 '찾는 시간'을 새로 정해요 */
  function planBots(room) {
    const g = room.game;
    for (const b of g.bots) {
      H.cancel(room, g.botT[b]);
      const ver = g.ver;
      g.botT[b] = H.later(room, Core.botDelay(g.lv, Math.random, g.s.table.length), () => {
        if (g.over || g.ver !== ver) return;
        const sets = Core.findSets(g.s.table);
        if (sets.length) take(room, b, H.pick(sets));
      });
    }
  }
  /** 세트를 가져가요 (사람 · 봇 공통) */
  function take(room, id, ids) {
    const g = room.game;
    const r = Core.claim(g.s, ids);
    if (r !== 'ok') return r;
    g.score[id]++; g.found++; g.ver++;
    H.emit(room, 'sg:got', { id, name: g.names[id], ids, ...view(g) });
    syncScores(room);
    if (g.s.over) { H.later(room, 1200, () => finish(room, '더미가 비고 남은 카드에 세트가 없어요')); return r; }
    planBots(room);
    return r;
  }

  return {
    games: { setgame: { name: '세트 찾기', min: 1, max: 8, options: OPTIONS } },
    start(room) {
      const humans = participants(room).map(p => ({ id: p.id, name: p.name }));
      const nb = Math.min(3, Math.max(humans.length < 2 ? 1 : 0, H.int(opt(room, 'bots'))));   // 혼자면 봇 1명은 꼭
      const bots = Array.from({ length: nb }, (_, i) => ({ id: 'bot' + i, name: BOT_NAMES[i], bot: true }));
      const all = humans.concat(bots);
      const g = room.game = {
        type: 'setgame', s: Core.newGame(Math.random), ver: 1, found: 0, lv: opt(room, 'sgLv'),
        order: all.map(p => p.id), names: Object.fromEntries(all.map(p => [p.id, p.name])), bots: bots.map(b => b.id), botT: {},
        score: Object.fromEntries(all.map(p => [p.id, 0])), lock: {}, startAt: Date.now() + 1500,
      };
      H.emit(room, 'sg:start', { players: all.map(p => ({ id: p.id, name: p.name, bot: !!p.bot })), lv: g.lv, at: 1500, ...view(g) });
      syncScores(room);
      H.later(room, 1500, () => planBots(room));
      H.later(room, LIMIT_MS, () => finish(room, '⏰ 15분이 지났어요'));
    },
    events: {
      'sg:claim'(room, me, ids) {
        const g = room.game;
        if (!g || g.over || g.score[me.id] == null || Date.now() < g.startAt) return;
        if ((g.lock[me.id] || 0) > Date.now()) return;
        if (!Array.isArray(ids) || ids.length !== 3) return;
        ids = ids.map(x => H.int(x));
        const r = take(room, me.id, ids);
        if (r === 'late') return H.toPlayer(me.id, 'sg:late', { ids });
        if (r === 'bad') {
          g.score[me.id] = Math.max(0, g.score[me.id] - 1);
          g.lock[me.id] = Date.now() + LOCK_MS;
          H.emit(room, 'sg:bad', { id: me.id, name: me.name, ids, why: Core.why(...ids), lock: LOCK_MS, score: g.score });
          syncScores(room);
        }
      },
    },
    leave(room) {
      const g = room.game;
      if (g && !g.over && !participants(room).length) finish(room, '모두 나갔어요');
    },
    resync(room, p, socket) {
      const g = room.game;
      if (!g) return;
      socket.emit('sg:start', { players: g.order.map(id => ({ id, name: g.names[id], bot: g.bots.includes(id) })), lv: g.lv, at: 0, resync: true, ...view(g) });
    },
  };
};
