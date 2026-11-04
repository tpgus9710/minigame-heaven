'use strict';
/* 🏓 4인 핑퐁 — 서버가 1초에 60번 공을 움직이고(같은 물리: public/js/shared/pong-core.js) 그때마다 상태를 보내요.
 *  각자 자기 패들만 조종해요. 빠른 공도 화면이 부드럽게 이어 그려요(화면이 50ms 늦춰서 그림). 패들 판정은 8px 여유(인터넷 지연 몫). */
const PC = require('../public/js/shared/pong-core');
const ORDER = ['bottom', 'top', 'right', 'left'];                 // 화면에 보내는 배열 순서

module.exports = H => {
  const { clamp } = H;

  function check(room) {
    const G = room.game, alive = PC.alive(G.g);
    if (alive.length > 1) return false;
    const w = alive[0];
    H.finishGame(room, { title: w ? `🏆 ${G.names[w]} 우승!` : '무승부', subtitle: '마지막까지 공을 막아냈습니다.', winners: w ? [G.ids[w]] : [] });
    return true;
  }
  function step(room) {
    const G = room.game;
    if (!G || G.over) return;
    const now = Date.now(), dt = Math.min(0.05, Math.max(0, (now - G.last) / 1000)); G.last = now;
    const g = G.g, ev = PC.step(g, dt);
    for (const e of ev) {
      if (e[0] !== 'miss') continue;
      const n = e[1];
      if (!g.sides[n].a) H.sys(room, `💀 ${G.names[n]} 님 탈락!`);
      else H.sys(room, `💥 ${G.names[n]} 님 실점! (남은 목숨 ${e[2]})`);
      if (check(room)) return;
      PC.serve(g, n, 1.0);                                         // 놓친 사람 쪽으로 다시 출발
    }
    const s = g.sides, b = g.ball, r1 = v => Math.round(v * 10) / 10;
    H.emit(room, 'pong:state', {
      t: now, b: b ? [r1(b.x), r1(b.y)] : null, sp: b ? Math.round(b.sp) : 0, f: Math.round(g.freeze * 1000), r: g.rally,
      p: ORDER.map(n => Math.round(s[n].p)), h: ORDER.map(n => s[n].hp), a: ORDER.map(n => (s[n].a ? 1 : 0)),
      e: ev.length ? ev : undefined, n: G.tick++ % 60 === 0 ? G.names : undefined,
    });
  }

  return {
    games: { pong: { name: '4인 핑퐁', min: 2, max: 10, roles: ['bottom', 'top', 'left', 'right'] } },
    start(room) {
      const active = {}, names = {}, ids = {};
      for (const n of ORDER) {
        const p = room.players.find(pl => pl.role === n);
        active[n] = !!p; if (p) { names[n] = p.name; ids[n] = p.id; }
      }
      const g = PC.newGame(active, { tol: 8 });
      room.game = { type: 'pong', g, names, ids, last: Date.now(), tick: 0 };
      PC.serve(g, null, 2.5);
      H.emit(room, 'pong:start', { names, ids });
      H.loop(room, 1000 / 60, () => step(room));
    },
    resync(room, p, socket) { if (room.game && !room.game.over) socket.emit('pong:start', { names: room.game.names, ids: room.game.ids }); },
    events: {
      'pong:move'(room, me, pos) {
        const G = room.game, s = G && G.g.sides[me.role];
        if (s && G.ids[me.role] === me.id && s.a) s.p = clamp(H.num(pos, 300), PC.C.HALF, PC.C.F - PC.C.HALF);
      },
    },
    leave(room, p) {
      const G = room.game; if (!G) return;
      for (const n of ORDER) if (G.ids[n] === p.id) { G.g.sides[n].a = false; G.g.sides[n].hp = 0; }   // 나간 자리는 벽
      check(room);
    },
  };
};
