'use strict';
/* 🎲 차례형 보드·카드 게임 호스트 — public/js/shared/*-core.js 규칙을 서버에서 돌리고,
 *  사람마다 보여줄 정보(view)를 따로 보냅니다. 빈자리는 봇으로 채울 수 있고, 나간 사람은 봇이 대신해요. */
const TableKit = require('../public/js/shared/table');
const CORES = {};
for (const name of ['marble', 'life', 'mafia', 'thief', 'yut', 'yacht', 'blackjack', 'liardice', 'davinci', 'reversi',
  'rummi', 'bang', 'coup', 'dalmuti', 'relay', 'chess', 'gostop']) {
  try { CORES[name] = require(`../public/js/shared/${name}-core`); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
}
const BOT_NAMES = ['봇 알파', '봇 브라보', '봇 찰리', '봇 델타', '봇 에코', '봇 폭스', '봇 골프', '봇 호텔'];

module.exports = H => {
  function push(room) {
    const g = room.game;
    for (const p of room.players) H.toPlayer(p.id, 'tb:view', { game: room.gameType, v: g.T.view(p.id) });
  }
  function finish(room, res) {
    const names = Object.fromEntries(room.game.players.map(p => [p.id, p.name]));
    for (const r of res.ranking || []) { const pl = H.getPlayer(room, r.id); if (pl && typeof r.score === 'number') pl.score = r.score; }
    H.finishGame(room, {
      title: res.title, subtitle: res.subtitle || '', lines: res.lines || [], returnIn: 12,
      ranking: (res.ranking || []).map(r => ({ id: r.id, name: names[r.id] || '?', value: r.value })),
      ...(Array.isArray(res.winners) ? { winners: res.winners } : {}),
    });
  }

  return {
    games: Object.fromEntries(Object.entries(CORES).map(([k, C]) => [k, { name: C.meta.name, min: C.meta.bots ? 1 : C.meta.min, max: C.meta.max, options: C.meta.options }])),
    start(room) {
      const Core = CORES[room.gameType];
      const players = H.participants(room).slice(0, Core.meta.max).map(p => ({ id: p.id, name: p.name }));
      if (Core.meta.bots) {
        const want = Math.min(Core.meta.max, Math.max(Core.meta.min, players.length + H.int(room.options.bots || 0)));
        for (let i = 0; players.length < want; i++) players.push({ id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], bot: true });
      }
      const g = room.game = { type: room.gameType, players };
      g.T = TableKit.createTable(Core, players, {
        rnd: Math.random, opts: room.options,
        setTimer: (fn, ms) => H.later(room, ms, fn), clearTimer: t => H.cancel(room, t),
        onUpdate: () => push(room),
        onEnd: res => { push(room); H.later(room, 1500, () => finish(room, res)); },
        log: m => console.warn('⚠️ ', room.gameType, m),
      });
      H.emit(room, 'tb:start', { game: room.gameType });
      push(room);
    },
    events: {
      'tb:act'(room, me, a) {
        const err = room.game.T.act(me.id, a);
        if (typeof err === 'string') return err;
      },
      /** 화면을 만지는 중 (시간 초과로 짧아진 차례 시간을 원래대로) */
      'tb:here'(room, me) { room.game.T.here(me.id); },
    },
    leave(room, p) {
      const g = room.game;
      if (!g.players.some(x => x.id === p.id)) return;
      if (!CORES[room.gameType].drop) H.sys(room, `🤖 ${p.name} 님 대신 봇이 이어서 해요.`);
      g.T.drop(p.id);
    },
    /** 연결이 끊긴 사람 (자리는 맡아 둠): 그 사람 차례는 짧게 기다려요 · 돌아오면 원래 시간으로 */
    away(room, p) { const g = room.game; if (g && g.T && g.players.some(x => x.id === p.id)) g.T.away(p.id); },
    back(room, p) { const g = room.game; if (g && g.T && g.players.some(x => x.id === p.id)) g.T.here(p.id); },
    /** 새로 고침하고 돌아온 사람에게 게임 화면을 다시 보내요 */
    resync(room, p, socket) {
      const g = room.game;
      if (!g || !g.T) return;
      socket.emit('tb:start', { game: room.gameType });
      socket.emit('tb:view', { game: room.gameType, v: g.T.view(p.id) });
    },
    /** 마피아처럼 채팅을 일부에게만 보내야 하는 게임 */
    chat(room, me, msg, emoji) {
      const Core = CORES[room.gameType];
      if (!Core.chatRoute) return false;
      const route = Core.chatRoute(room.game.T.state, me.id);
      if (!route || route === 'all') return false;
      if (route === 'none') { H.toPlayer(me.id, 'toast', { msg: '지금은 말할 수 없어요.', type: 'error' }); return true; }
      for (const id of route.ids) H.toPlayer(id, 'chat', { id: me.id, name: me.name, msg, emoji, tag: route.tag });
      return true;
    },
  };
};
