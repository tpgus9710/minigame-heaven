'use strict';
/* 🛡️ 탱크 대포 — 차례대로 이동·조준·발사. 궤적과 결과는 서버가 계산해서 모두에게 보냅니다.
 *   🚁 헬기 보급 (v13.3): 차례가 바뀔 때 tank-core 가 정한 보급(drop)을 tank:turn 에 실어 보내요.
 *      이동하다 상자에 닿으면 tank:item, 포탄으로 가져가면 tank:shot 의 got 으로 알려요. */
const TC = require('../public/js/shared/tank-core');
const TURN_SEC = 30;

module.exports = H => {
  const active = g => TC.active(g.s);

  function finish(room) {
    const g = room.game, s = g.s;
    const ranked = s.tanks.slice().sort((a, b) => (b.alive - a.alive) || (g.deaths.indexOf(b.id) - g.deaths.indexOf(a.id)) || (b.hp - a.hp));
    const win = s.tanks.find(t => t.id === s.winner);
    H.finishGame(room, {
      title: win ? `🛡️ ${win.name} 승리!` : '💥 모두 파괴됐어요', subtitle: '탱크 대포',
      ranking: ranked.map(t => ({ id: t.id, name: t.name, value: t.alive ? `HP ${t.hp}` : '파괴' })), winners: win ? [win.id] : [],
    });
  }
  function startTurn(room) {
    const g = room.game, t = active(g);
    g.phase = 'aim'; g.moveDir = 0;
    const drop = g.s.drop; g.s.drop = null;
    H.emit(room, 'tank:turn', { id: t.id, name: t.name, wind: g.s.wind, seconds: TURN_SEC, tanks: TC.view(g.s), items: TC.items(g.s), drop });
    H.cancel(room, g.timer);
    g.timer = H.later(room, TURN_SEC * 1000, () => {
      if (g.phase !== 'aim') return;
      H.emit(room, 'tank:log', { msg: `⏰ ${t.name} 님 시간 초과 — 차례가 넘어가요` });
      TC.nextTurn(g.s); startTurn(room);
    });
  }

  return {
    games: { tank: { name: '탱크 대포', min: 2, max: 6 } },
    start(room) {
      const parts = H.shuffle(H.participants(room));
      const s = TC.newGame(parts.map(p => ({ id: p.id, name: p.name })), Math.random);
      const g = room.game = { type: 'tank', s, phase: 'wait', moveDir: 0, deaths: [] };
      H.emit(room, 'tank:start', { h: s.h, tanks: s.tanks.map(t => ({ id: t.id, name: t.name, color: t.color })), view: TC.view(s), items: TC.items(s) });
      H.later(room, 1500, () => startTurn(room));
      let n = 0;
      H.loop(room, 1000 / 30, () => {                   // 이동 중인 탱크 움직이기
        if (g.phase !== 'aim' || !g.moveDir) return;
        const t = active(g);
        if (TC.move(s, t.id, g.moveDir, 1 / 30) && ++n % 2 === 0) H.emit(room, 'tank:pos', { id: t.id, x: Math.round(t.x), y: Math.round(t.y), fuel: Math.round(t.fuel) });
        if (s.got.length) H.emit(room, 'tank:item', { got: s.got.splice(0), tanks: TC.view(s), items: TC.items(s) });   // 이동하다 상자에 닿았어요
      });
    },
    events: {
      'tank:move'(room, me, dir) {
        const g = room.game;
        if (g.phase !== 'aim' || active(g).id !== me.id) return;
        g.moveDir = H.clamp(H.int(dir), -1, 1);
        if (!g.moveDir) { const t = active(g); H.emit(room, 'tank:pos', { id: t.id, x: Math.round(t.x), y: Math.round(t.y), fuel: Math.round(t.fuel) }); }
      },
      'tank:aim'(room, me, d, socket) {
        const g = room.game;
        if (g.phase !== 'aim' || active(g).id !== me.id || !d) return;
        const t = active(g);
        t.angle = H.clamp(H.int(d.angle), 0, 180); t.power = H.clamp(H.int(d.power), 0, 100);
        socket.to(room.code).emit('tank:aim', { id: me.id, angle: t.angle, power: t.power });
      },
      'tank:fire'(room, me, d) {
        const g = room.game;
        if (g.phase !== 'aim' || active(g).id !== me.id || !d) return;
        g.phase = 'shot'; g.moveDir = 0;
        H.cancel(room, g.timer);
        const before = new Set(g.s.tanks.filter(t => t.alive).map(t => t.id));
        const r = TC.fire(g.s, me.id, H.num(d.angle), H.num(d.power), String(d.weapon || 'normal'));
        g.s.tanks.forEach(t => { if (before.has(t.id) && !t.alive) { g.deaths.push(t.id); H.emit(room, 'game:out', { id: t.id }); } });
        H.emit(room, 'tank:shot', r);
        const frames = Math.max(...r.shots.map(p => p.length)) * 2;            // 궤적 1점 = 2프레임
        H.later(room, Math.min(9000, frames * (1000 / 60) + 1400), () => {
          if (g.s.over) return finish(room);
          TC.nextTurn(g.s); startTurn(room);
        });
      },
    },
    leave(room, p) {
      const g = room.game, t = g.s.tanks.find(x => x.id === p.id);
      if (!t || !t.alive) return;
      const wasTurn = active(g).id === p.id;
      t.alive = false; t.hp = 0; g.deaths.push(p.id);
      const alive = g.s.tanks.filter(x => x.alive);
      if (alive.length <= 1) { g.s.over = true; g.s.winner = alive[0] ? alive[0].id : null; return finish(room); }
      if (wasTurn && g.phase === 'aim') { TC.nextTurn(g.s); startTurn(room); }
    },
  };
};
