'use strict';
/* 🏓 4인 핑퐁 — 서버가 공을 움직이고, 각자 자기 패들만 조종 */
const PONG = { F: 600, R: 8, OFF: 18, HALF: 55, MAXV: 11, HP: 5 };
// [자리, 막는 축, 방향(+1: 큰 좌표쪽), 패들이 움직이는 축]
const SIDES = [['bottom', 'y', 1, 'x'], ['top', 'y', -1, 'x'], ['right', 'x', 1, 'y'], ['left', 'x', -1, 'y']];

module.exports = H => {
  const { clamp } = H;

  function resetBall(g) {
    const ang = Math.PI / 4 + H.rand(4) * Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    g.ball = { x: 300, y: 300, vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5 };
    g.freezeUntil = Date.now() + 1000;
  }
  function check(room) {
    const alive = Object.values(room.game.sides).filter(s => s.active);
    if (alive.length > 1) return false;
    H.finishGame(room, { title: alive[0] ? `🏆 ${alive[0].name} 우승!` : '무승부', subtitle: '마지막까지 공을 막아냈습니다.', winners: alive[0] ? [alive[0].playerId] : [] });
    return true;
  }
  function step(room) {
    const g = room.game;
    if (!g || g.over) return;
    const { F, R, OFF, HALF, MAXV } = PONG;
    if (Date.now() >= g.freezeUntil) {
      const b = g.ball, px = b.x, py = b.y;
      b.x += b.vx; b.y += b.vy;
      for (const [name, axis, dir, along] of SIDES) {
        const s = g.sides[name];
        const vk = axis === 'x' ? 'vx' : 'vy', ok = axis === 'x' ? 'vy' : 'vx';
        if (Math.sign(b[vk]) !== dir) continue;
        const pos = b[axis], prev = axis === 'x' ? px : py;
        if (!s.active) {                                  // 빈 자리는 벽
          const wall = dir > 0 ? F : 0;
          if ((pos + dir * R - wall) * dir >= 0) { b[axis] = wall - dir * R; b[vk] = -b[vk]; }
          continue;
        }
        const line = dir > 0 ? F - OFF : OFF;
        const crossed = (prev + dir * R - line) * dir < 0 && (pos + dir * R - line) * dir >= 0;
        if (crossed && Math.abs(b[along] - s.pos) <= HALF + R) {          // 패들에 맞음
          b[axis] = line - dir * R;
          b[vk] = -dir * Math.min(Math.abs(b[vk]) * 1.06 + 0.1, MAXV);
          b[ok] = clamp(b[ok] + (b[along] - s.pos) * 0.07, -MAXV, MAXV);
        } else if ((pos - dir * R - (dir > 0 ? F : 0)) * dir > 0) {       // 놓침
          s.hp--;
          if (s.hp <= 0) { s.active = false; H.sys(room, `💀 ${s.name} 님 탈락!`); }
          else H.sys(room, `💥 ${s.name} 님 실점! (남은 목숨 ${s.hp})`);
          resetBall(g);
          if (check(room)) return;
          break;
        }
      }
      for (const k of ['vx', 'vy']) if (Math.abs(g.ball[k]) < 1.5) g.ball[k] = (g.ball[k] >= 0 ? 1 : -1) * 1.5;
    }
    const s = {};
    for (const [n] of SIDES) { const x = g.sides[n]; s[n] = { a: x.active, hp: x.hp, p: Math.round(x.pos), id: x.playerId, n: x.name }; }
    H.emit(room, 'pong:state', { b: { x: Math.round(g.ball.x), y: Math.round(g.ball.y) }, s });
  }

  return {
    games: { pong: { name: '4인 핑퐁', min: 2, max: 10, roles: ['bottom', 'top', 'left', 'right'] } },
    start(room) {
      const sides = {};
      for (const [name] of SIDES) {
        const p = room.players.find(pl => pl.role === name);
        sides[name] = { active: !!p, hp: p ? PONG.HP : 0, pos: 300, playerId: p ? p.id : null, name: p ? p.name : '' };
      }
      room.game = { type: 'pong', sides, ball: null, freezeUntil: 0 };
      resetBall(room.game);
      room.game.freezeUntil = Date.now() + 2500;
      H.emit(room, 'pong:start', {});
      H.loop(room, 1000 / 30, () => step(room));
    },
    events: {
      'pong:move'(room, me, pos) {
        const s = room.game.sides[me.role];
        if (s && s.playerId === me.id && s.active) s.pos = clamp(H.num(pos, 300), PONG.HALF, PONG.F - PONG.HALF);
      },
    },
    leave(room, p) {
      for (const s of Object.values(room.game.sides)) if (s.playerId === p.id) { s.active = false; s.hp = 0; }
      check(room);
    },
  };
};
