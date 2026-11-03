/* =====================================================================
 *  🏐 점프 배구 물리 엔진 — 화면(싱글 · AI)과 서버(멀티)가 같은 코드를 씁니다.
 *  1번 step = 1/60초. 입력: { l, r, u, d, p } (p = 이번 프레임에 스파이크 키를 눌렀는지)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VolleyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 800, H = 500, GROUND = 440, NET_X = 400, NET_HALF = 7, NET_TOP = 285;
  const PR = 34, BR = 21, TARGET = 15;
  const GRAV_P = 0.95, JUMP = -18, SPEED = 6.5, GRAV_B = 0.36, MAXV = 23;

  const home = side => (side ? W - 110 : 110);
  const blank = () => ({ l: false, r: false, u: false, d: false, p: false });
  const newPlayer = side => ({ side, x: home(side), y: GROUND - PR, vx: 0, vy: 0, st: 'idle', t: 0, dir: side ? -1 : 1, spiked: false, cool: 0 });

  function serve(s) {
    s.players = [newPlayer(0), newPlayer(1)];
    s.ball = { x: home(s.server), y: 130, vx: 0, vy: 0 };
    s.phase = 'ready'; s.t = 55;
  }
  function newGame(target, firstServer) {
    const s = { score: [0, 0], players: [], ball: null, phase: 'ready', t: 0, server: firstServer != null ? firstServer : (Math.random() < 0.5 ? 0 : 1),
      target: target || TARGET, winner: -1, hit: 0, frame: 0, events: [] };
    serve(s);
    return s;
  }

  function stepPlayer(s, p, inp) {
    const onGround = p.y >= GROUND - PR - 0.01;
    if (p.cool > 0) p.cool--;
    if (p.st === 'dive') {
      p.x += p.vx; p.vx *= 0.96;
      if (--p.t <= 0) { p.st = 'recover'; p.t = 14; p.vx = 0; }
    } else if (p.st === 'recover') {
      if (--p.t <= 0) p.st = 'idle';
    } else if (s.phase !== 'over') {
      const mv = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      p.vx = mv * SPEED;
      if (mv) p.dir = mv;
      if (onGround) {
        if (inp.p && mv && s.phase === 'play') { p.st = 'dive'; p.t = 16; p.vx = mv * 12; }
        else if (inp.u) { p.vy = JUMP; p.st = 'jump'; p.spiked = false; }
      } else if (inp.p && !p.spiked) { p.st = 'spike'; p.t = 16; p.spiked = true; }
      if (p.st !== 'dive') p.x += p.vx;
    }
    if (p.y < GROUND - PR || p.vy < 0) {                 // 공중: 중력
      p.vy += GRAV_P; p.y += p.vy;
      if (p.y >= GROUND - PR) { p.y = GROUND - PR; p.vy = 0; if (p.st === 'jump' || p.st === 'spike') p.st = 'idle'; }
    }
    if (p.st === 'spike' && --p.t <= 0) p.st = p.y < GROUND - PR ? 'jump' : 'idle';
    const lo = p.side ? NET_X + NET_HALF + PR : PR, hi = p.side ? W - PR : NET_X - NET_HALF - PR;
    p.x = Math.max(lo, Math.min(hi, p.x));
  }

  function stepBall(s, inputs) {
    const b = s.ball;
    if (s.phase === 'ready') return;
    b.vy += GRAV_B;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
    b.x += b.vx; b.y += b.vy;
    if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); }
    if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); }
    // 네트 (네모 기둥과 원의 충돌)
    const cx = Math.max(NET_X - NET_HALF, Math.min(NET_X + NET_HALF, b.x)), cy = Math.max(NET_TOP, Math.min(GROUND, b.y));
    let dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
    if (d < BR) {
      if (d < 0.001) { dx = b.x < NET_X ? -1 : 1; dy = 0; d = 1; }
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * BR; b.y = cy + ny * BR;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; }
    }
    // 선수와 부딪힘
    for (const p of s.players) {
      const py = p.y - 4;
      dx = b.x - p.x; dy = b.y - py; d = Math.hypot(dx, dy);
      if (d >= BR + PR || p.cool > 0) continue;
      const nx = d ? dx / d : 0, ny = d ? dy / d : -1;
      b.x = p.x + nx * (BR + PR); b.y = py + ny * (BR + PR);
      const inp = inputs[p.side], fwd = p.side ? -1 : 1;
      if (p.st === 'spike' && ny < 0.35) {               // 스파이크: 방향키로 방향 조절
        const back = fwd > 0 ? inp.l : inp.r, front = fwd > 0 ? inp.r : inp.l;
        b.vx = fwd * (back ? 9 : front ? 21 : 18);
        b.vy = inp.u ? -11 : inp.d ? 10 : -2;
        p.st = 'jump'; s.hit = 8; s.events.push('spike');
      } else {
        const speed = Math.max(10, Math.min(16, Math.hypot(b.vx, b.vy) * 0.7 + 5));
        b.vx = nx * speed + p.vx * 0.35;
        b.vy = Math.min(ny * speed - 3, -6);
        if (Math.abs(b.vx) < 1.5) b.vx = fwd * 2.5;        // 가만히 서 있어도 공이 머리 위에서 끝없이 튀지 않게 네트 쪽으로
        if (p.st === 'dive') b.vy = Math.min(b.vy, -12);
        s.events.push('bump');
      }
      p.cool = 6;
    }
    // 바닥: 득점
    if (b.y >= GROUND - BR) {
      b.y = GROUND - BR;
      if (s.phase === 'play') {
        const win = b.x < NET_X ? 1 : 0;
        s.score[win]++; s.server = win; s.lastPoint = win;
        s.phase = s.score[win] >= s.target ? 'over' : 'point'; s.t = 80;
        if (s.phase === 'over') s.winner = win;
        s.events.push('point');
      }
      b.vy = -Math.abs(b.vy) * 0.45; b.vx *= 0.7;
      if (Math.abs(b.vy) < 1.2) b.vy = 0;
    }
  }

  function step(s, inputs) {
    s.frame++; s.events.length = 0;
    for (const p of s.players) stepPlayer(s, p, inputs[p.side] || blank());
    if (s.phase === 'ready' && --s.t <= 0) s.phase = 'play';
    stepBall(s, inputs);
    if (s.phase === 'point' && --s.t <= 0) serve(s);
    if (s.hit > 0) s.hit--;
    return s;
  }

  /** 공이 머리 높이까지 내려올 때의 x 위치 예측 */
  function predictX(s) {
    const b = s.ball;
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
    for (let i = 0; i < 160; i++) {
      vy += GRAV_B; x += vx; y += vy;
      if (x < BR) { x = BR; vx = -vx; }
      if (x > W - BR) { x = W - BR; vx = -vx; }
      if (vy > 0 && y > GROUND - PR * 2 - 6) break;
    }
    return x;
  }
  /** 컴퓨터 선수. level 0~1 (클수록 잘함) */
  function ai(s, side, level) {
    const lv = level == null ? 0.7 : level;
    const p = s.players[side], b = s.ball, fwd = side ? -1 : 1, inp = blank();
    if (s.phase === 'over') return inp;
    const mine = x => (side ? x > NET_X : x < NET_X);
    let tx = home(side);
    if (s.phase === 'ready') tx = s.server === side ? b.x - fwd * 14 : home(side);
    else {
      const px = predictX(s);
      if (mine(px)) tx = px - fwd * (12 + lv * 10);
      else tx = side ? NET_X + 150 : NET_X - 150;
    }
    if (Math.random() < 0.08 * (1 - lv)) return inp;   // 가끔 멍때림
    if (Math.abs(tx - p.x) > 7) { if (tx < p.x) inp.l = true; else inp.r = true; }
    const dx = b.x - p.x, dy = (p.y - 4) - b.y;
    if (s.phase === 'play' && mine(b.x) && Math.abs(dx) < 60 + lv * 20 && dy > 70 && dy < 240 && b.vy > -2) inp.u = true;
    if (p.y < GROUND - PR - 20 && Math.hypot(dx, dy) < 100 && mine(b.x) && Math.random() < 0.5 + lv * 0.4) {
      inp.p = true;
      const net = Math.abs(NET_X - p.x), r = Math.random();   // 네트 가까이에서만 내리꽂기, 멀면 길게
      if (net < 120) { if (r < 0.7) inp.d = true; }
      else if (net > 260 && r < 0.4) inp.u = true;
    }
    return inp;
  }

  /** 네트워크로 보낼 작은 상태 */
  function snap(s) {
    const r = Math.round;
    return { b: [r(s.ball.x), r(s.ball.y)], p: s.players.map(p => [r(p.x), r(p.y), p.st, p.dir]), sc: s.score, ph: s.phase, sv: s.server, hit: s.hit };
  }
  return { W, H, GROUND, NET_X, NET_HALF, NET_TOP, PR, BR, TARGET, newGame, step, ai, blank, snap };
});
