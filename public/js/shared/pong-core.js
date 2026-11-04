/* =====================================================================
 *  🏓 핑퐁 물리 — 화면(싱글 · AI)과 서버(멀티 4인)가 같은 코드를 씁니다.
 *   - 속도는 px/초. 한 번 계산할 때 잘게 나눠 움직여서 아주 빠른 공도 패들을 뚫고 지나가지 않아요.
 *   - 패들에 맞을 때마다 빨라져요: 처음 V0 → VMAX 쪽으로 (맞을 때마다 남은 차이의 GROW 만큼 · 랠리가 길수록 끝없이 조금씩 더)
 *   - 맞은 자리로 각도가 정해져요: 가운데 = 똑바로 · 끝 = 최대 ANG 만큼 꺾임. 패들을 움직이며 치면 그쪽으로 조금 더 휘어요(SPIN).
 *  g.ev 에 이번 계산에서 생긴 일을 담아요: ['hit', 자리, 맞은 자리] · ['wall', 자리] · ['miss', 자리, 남은 목숨]
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PongCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = { F: 600, R: 8, OFF: 18, HALF: 55, T: 12, HP: 5, V0: 400, VMAX: 1500, GROW: 0.085, ANG: 1.08, SPIN: 0.2, FREEZE: 0.9 };
  // [자리, 막는 축, 방향(+1: 큰 좌표 쪽), 패들이 움직이는 축]
  const SIDES = [['bottom', 'y', 1, 'x'], ['top', 'y', -1, 'x'], ['right', 'x', 1, 'y'], ['left', 'x', -1, 'y']];
  const NORMAL = { bottom: Math.PI / 2, top: -Math.PI / 2, right: 0, left: Math.PI };   // 그 자리 쪽으로 가는 방향 (각도)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** active: { bottom: true, top: true, … } · opt: { hp, tol(패들 판정 여유 px), rnd } */
  function newGame(active, opt = {}) {
    const g = { sides: {}, ball: null, freeze: 0, rally: 0, hits: 0, serial: 0, tol: opt.tol || 0, rnd: opt.rnd || Math.random, ev: [] };
    for (const [n] of SIDES) g.sides[n] = { a: !!active[n], hp: active[n] ? (opt.hp || C.HP) : 0, p: C.F / 2, pp: C.F / 2, v: 0 };
    return g;
  }
  const alive = g => SIDES.map(s => s[0]).filter(n => g.sides[n].a);
  /** 가운데에서 다시 출발: 살아 있는 자리 중 하나 쪽으로 (to 를 주면 그 자리로) */
  function serve(g, to, freeze) {
    const list = alive(g), side = to && g.sides[to] && g.sides[to].a ? to : list[Math.floor(g.rnd() * list.length)] || 'bottom';
    const ang = NORMAL[side] + (g.rnd() - 0.5) * 1.0;
    g.ball = { x: C.F / 2, y: C.F / 2, vx: Math.cos(ang) * C.V0, vy: Math.sin(ang) * C.V0, sp: C.V0 };
    g.freeze = freeze == null ? C.FREEZE : freeze; g.rally = 0; g.serial++;
    return side;
  }
  /** dt 초 만큼 진행 (패들 위치 s.p 는 부르는 쪽이 미리 넣어 둬요) */
  function step(g, dt) {
    g.ev = [];
    for (const [n] of SIDES) {                                // 패들 속도 (치는 순간 휘게 하는 데 써요)
      const s = g.sides[n], v = (s.p - s.pp) / Math.max(1e-3, dt);
      s.v = s.v * 0.55 + v * 0.45; s.pp = s.p;
    }
    if (!g.ball) return g.ev;
    if (g.freeze > 0) { g.freeze = Math.max(0, g.freeze - dt); return g.ev; }
    const b = g.ball, n = Math.max(1, Math.ceil(b.sp * dt / 5));
    for (let i = 0; i < n && g.ball === b; i++) sub(g, dt / n);
    return g.ev;
  }
  function sub(g, h) {
    const b = g.ball, { F, R, OFF, HALF } = C;
    const x0 = b.x, y0 = b.y;
    b.x += b.vx * h; b.y += b.vy * h;
    for (const [name, axis, dir, along] of SIDES) {
      const s = g.sides[name], vk = axis === 'x' ? 'vx' : 'vy';
      if (Math.sign(b[vk]) !== dir) continue;
      const pos = b[axis], prev = axis === 'x' ? x0 : y0;
      if (!s.a) {                                             // 빈 자리 · 탈락한 자리 = 벽
        const wall = dir > 0 ? F : 0, over = (pos + dir * R - wall) * dir;
        if (over >= 0) { b[axis] = wall - dir * R - dir * over; b[vk] = -b[vk]; g.ev.push(['wall', name]); }
        continue;
      }
      const line = dir > 0 ? F - OFF : OFF, e0 = prev + dir * R, e1 = pos + dir * R;   // 공 앞쪽 끝이 패들 줄을 지나는지
      if ((e0 - line) * dir < 0 && (e1 - line) * dir >= 0) {
        const t = (line - e0) / (e1 - e0), a0 = along === 'x' ? x0 : y0, ac = a0 + (b[along] - a0) * t;
        const off = ac - s.p;
        if (Math.abs(off) <= HALF + R + g.tol) {               // 막음
          hit(g, s, name, axis, dir, along, off);
          b[axis] = line - dir * R; b[along] = ac;
          const rest = (1 - t) * h;                             // 이번 조각의 남은 시간만큼 새 방향으로
          b.x += b.vx * rest; b.y += b.vy * rest;
          return;
        }
      } else if ((pos - dir * R - (dir > 0 ? F : 0)) * dir > 0) {   // 판 밖으로 완전히 나감 → 실점
        s.hp--;
        if (s.hp <= 0) { s.hp = 0; s.a = false; }
        g.ev.push(['miss', name, s.hp]);
        g.ball = null;
        return;
      }
    }
    // 모서리에서 벽 두 개 사이에 끼지 않게 (아주 드물게)
    b.x = clamp(b.x, -R * 3, F + R * 3); b.y = clamp(b.y, -R * 3, F + R * 3);
  }
  function hit(g, s, name, axis, dir, along, off) {
    const b = g.ball;
    b.sp = Math.min(C.VMAX, b.sp + (C.VMAX - b.sp) * C.GROW);
    const k = clamp(off / (C.HALF + C.R), -1, 1);
    const ang = clamp(k * C.ANG + clamp(s.v / 1400, -1, 1) * C.SPIN, -C.ANG, C.ANG);   // 끝으로 칠수록 · 패들을 움직이며 칠수록 꺾여요
    const perp = -dir * Math.cos(ang) * b.sp, par = Math.sin(ang) * b.sp;
    if (axis === 'y') { b.vy = perp; b.vx = par; } else { b.vx = perp; b.vy = par; }
    g.rally++; g.hits++; g.serial++;
    g.ev.push(['hit', name, Math.round(off)]);
  }
  /** 공이 이 자리 패들 줄에 닿을 때의 위치 (벽에 튕기는 것까지) · 시간(초) — AI 가 써요. 다른 패들에 먼저 맞으면 null */
  function predict(g, name) {
    const b = g.ball; if (!b) return null;
    const along = SIDES.find(x => x[0] === name)[3];
    const { F, R, OFF } = C;
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy, t = 0;
    for (let i = 0; i < 8; i++) {
      // 다음에 닿는 줄 (벽 · 패들 줄) 찾기
      let best = Infinity, who = null;
      for (const [n2, ax2, d2] of SIDES) {
        const v = ax2 === 'x' ? vx : vy, p = ax2 === 'x' ? x : y;
        if (Math.sign(v) !== d2 || !v) continue;
        const s2 = g.sides[n2], lim = s2.a ? (d2 > 0 ? F - OFF - R : OFF + R) : (d2 > 0 ? F - R : R);
        const tt = (lim - p) / v;
        if (tt >= 0 && tt < best) { best = tt; who = n2; }
      }
      if (!who) return null;
      x += vx * best; y += vy * best; t += best;
      if (who === name) return { at: along === 'x' ? x : y, t };
      if (g.sides[who].a) return null;                         // 다른 사람 패들 쪽으로 가요
      const ax2 = SIDES.find(s => s[0] === who)[1];
      if (ax2 === 'x') vx = -vx; else vy = -vy;
    }
    return null;
  }
  /* ─── 🤖 AI 패들 (싱글 · 검사) ───
   *  공이 오면 반응 시간 뒤에 떨어질 자리(벽 튕김까지 계산)로 움직여요. 움직이는 속도는 공이 빠를수록 빨라지지만 한계가 있어요.
   *  공이 빠르고 각도가 클수록 놓칠 확률이 올라가요(놓치기로 한 공은 손이 조금 모자라게 가요). 잘 치면 상대가 없는 쪽으로 꺾어 보내요. */
  const LV = {
    easy:   { react: 0.24, err: 14, v0: 300, vk: 0.42, aim: 0, miss: [0.12, 0.42, 1.2] },
    normal: { react: 0.16, err: 9,  v0: 380, vk: 0.55, aim: 0.32, miss: [0.05, 0.3, 1.4] },
    hard:   { react: 0.1,  err: 5,  v0: 460, vk: 0.68, aim: 0.55, miss: [0.018, 0.2, 1.7] },
  };
  /** mem: 이 AI 가 기억하는 것 (계획) · 돌려주는 값: 새 패들 위치 */
  function ai(g, name, lv, mem, dt) {
    const s = g.sides[name], L = LV[lv] || LV.normal, b = g.ball, { F, HALF, R, V0, VMAX } = C;
    let target = F / 2, speed = L.v0 + L.vk * (b ? b.sp : V0);
    const pr = b && g.freeze <= 0 ? predict(g, name) : null;
    if (pr) {
      if (mem.serial !== g.serial) {                            // 공이 새로 날아옴 → 계획 (놓칠지 · 어디로 보낼지)
        mem.serial = g.serial; mem.t = 0;
        const fast = clamp((b.sp - V0) / (VMAX - V0), 0, 1), wide = Math.abs(b.vx * (name === 'top' || name === 'bottom' ? 1 : 0) + b.vy * (name === 'left' || name === 'right' ? 1 : 0)) / b.sp;
        const p = (L.miss[0] + L.miss[1] * Math.pow(fast, L.miss[2])) * (1 + 0.6 * wide);
        mem.miss = g.rnd() < p;
        const opp = alive(g).filter(n => n !== name).map(n => g.sides[n].p);
        const away = opp.length ? (opp.reduce((a, v) => a + v, 0) / opp.length > F / 2 ? 1 : -1) : 0;
        mem.off = mem.miss ? 0 : away * HALF * L.aim * (0.6 + 0.4 * g.rnd()) + (g.rnd() + g.rnd() - 1) * L.err;
        mem.side = g.rnd() < 0.5 ? -1 : 1;
      }
      mem.t += dt;
      if (mem.t < L.react) target = s.p;                       // 아직 반응 전
      else if (mem.miss) {                                       // 손이 조금 모자라게: 공 바로 옆까지만
        const near = pr.at - s.p > 0 ? -1 : 1;
        target = pr.at + near * (HALF + R + 10 + 14 * Math.abs(mem.side));
      } else target = pr.at + mem.off;
    } else speed *= 0.5;                                         // 공이 멀어지면 천천히 가운데로
    const mv = clamp(target - s.p, -speed * dt, speed * dt);
    return clamp(s.p + mv, HALF, F - HALF);
  }
  return { C, SIDES, NORMAL, LV, newGame, serve, step, predict, alive, ai };
});
