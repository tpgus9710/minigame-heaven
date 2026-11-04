// 핑퐁 물리 검사 (shared/pong-core.js): 빠른 공이 패들을 뚫지 않는지 · 벽 안에 있는지 · 빨라지는 정도 · 떨어질 자리 예측 · AI 끼리 랠리
const P = require('../public/js/shared/pong-core.js');
const { C } = P;
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

console.log('▶ 뚫림 없음: 패들을 떨어질 자리에 두면 아무리 빨라도 막아요');
{
  const r = rng(1); let tries = 0, blocked = 0, bad = '';
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
    for (let i = 0; i < 400; i++) {
      const g = P.newGame({ bottom: true, top: true }, { rnd: r });
      P.serve(g, 'bottom', 0);
      const sp = C.V0 + r() * (C.VMAX - C.V0), ang = Math.PI / 2 + (r() - 0.5) * 2 * 1.0;
      Object.assign(g.ball, { x: 60 + r() * 480, y: 200 + r() * 200, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, sp });
      const pr = P.predict(g, 'bottom');
      if (!pr) continue;
      g.sides.bottom.p = g.sides.bottom.pp = Math.max(C.HALF, Math.min(C.F - C.HALF, pr.at + (r() - 0.5) * 2 * (C.HALF - 2)));
      if (Math.abs(g.sides.bottom.p - pr.at) > C.HALF) continue;   // 끝에 붙어서 못 닿는 자리
      tries++;
      let res = null;
      for (let k = 0; k < 400 && !res; k++) { for (const e of P.step(g, dt)) if (e[1] === 'bottom') res = e[0]; }
      if (res === 'hit') blocked++; else if (!bad) bad = `dt=${dt.toFixed(3)} sp=${sp.toFixed(0)} → ${res}`;
    }
  }
  ok(blocked === tries && tries > 1000, `${tries}번 중 ${blocked}번 막음 (프레임 간격 1/120 ~ 1/20초 · 속도 ${C.V0}~${C.VMAX})`, bad);
}

console.log('▶ 벽: 네 자리가 모두 벽이면 공이 판 밖으로 안 나가요');
{
  const r = rng(2), g = P.newGame({}, { rnd: r });
  g.ball = { x: 300, y: 300, vx: 1234, vy: -987, sp: 1580 }; g.freeze = 0;
  let out = 0, walls = 0;
  for (let i = 0; i < 20000; i++) {
    for (const e of P.step(g, 1 / 60)) if (e[0] === 'wall') walls++;
    const b = g.ball;
    if (!b || b.x < C.R - 0.01 || b.x > C.F - C.R + 0.01 || b.y < C.R - 0.01 || b.y > C.F - C.R + 0.01) out++;
  }
  ok(!out && walls > 1000, `20000번 계산 · 벽 ${walls}번 튕김 · 밖으로 나감 ${out}번`);
}

console.log('▶ 빨라지기: 맞을 때마다 빨라지고, 끝없이 조금씩 더 (최고 속도 넘지 않음)');
{
  let sp = C.V0; const list = [];
  for (let i = 1; i <= 30; i++) { sp = Math.min(C.VMAX, sp + (C.VMAX - sp) * C.GROW); if ([1, 3, 5, 10, 15, 20, 30].includes(i)) list.push(`${i}번 ${Math.round(sp)}`); }
  ok(sp < C.VMAX && sp > 1300, '패들 맞은 횟수별 속도(px/초): ' + list.join(' · '));
  const g = P.newGame({ bottom: true, top: true }, { rnd: rng(3) }); P.serve(g, 'bottom', 0);
  g.ball.x = 300; g.ball.vx = 0; g.ball.vy = 500; g.ball.sp = 500; g.sides.bottom.p = 300;
  let hit = null; for (let k = 0; k < 200 && !hit; k++) for (const e of P.step(g, 1 / 60)) if (e[0] === 'hit') hit = e;
  ok(hit && g.ball.vy < 0 && Math.abs(Math.hypot(g.ball.vx, g.ball.vy) - g.ball.sp) < 0.01 && g.ball.sp > 500, `가운데에 맞으면 곧게 되돌아가요 (vx ${g.ball.vx.toFixed(1)} · 속도 ${g.ball.sp.toFixed(0)})`);
  const g2 = P.newGame({ bottom: true, top: true }, { rnd: rng(4) }); P.serve(g2, 'bottom', 0);
  Object.assign(g2.ball, { x: 300 + C.HALF, vx: 0, vy: 600, sp: 600 }); g2.sides.bottom.p = 300;
  for (let k = 0; k < 200 && g2.ball.vy > 0; k++) P.step(g2, 1 / 60);
  const ang = Math.atan2(g2.ball.vx, -g2.ball.vy);
  ok(ang > 0.8 && ang <= C.ANG + 1e-6, `끝에 맞으면 크게 꺾여요 (${(ang * 180 / Math.PI).toFixed(0)}°)`);
}

console.log('▶ 떨어질 자리 예측 (벽 튕김 포함)');
{
  const r = rng(5); let n = 0, good = 0, worst = 0;
  for (let i = 0; i < 300; i++) {
    const g = P.newGame({ bottom: true, top: true }, { rnd: r }); P.serve(g, 'top', 0);
    const sp = 400 + r() * 1000, a = -Math.PI / 2 + (r() - 0.5) * 2 * 1.05;
    Object.assign(g.ball, { x: 100 + r() * 400, y: 400, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp });
    const pr = P.predict(g, 'top'); if (!pr) continue;
    g.sides.top.p = 300; g.tol = 999;                                         // 어디든 막게 해서 지나는 자리를 재요
    let at = null;
    for (let k = 0; k < 600 && at == null; k++) { const bx = g.ball.x; for (const e of P.step(g, 1 / 240)) if (e[0] === 'hit') at = g.sides.top.p + e[2]; void bx; }
    n++; const d = Math.abs(at - pr.at); worst = Math.max(worst, d); if (d < 1.5) good++;
  }
  ok(n > 250 && good === n, `${n}번 중 ${good}번 맞음 (가장 큰 차이 ${worst.toFixed(2)}px)`);
}

console.log('▶ AI 끼리 (같은 난이도): 랠리 길이 · 빨라진 속도 · 끝없는 랠리 없음');
for (const lv of ['easy', 'normal', 'hard']) {
  const r = rng(lv.length * 77); let points = 0, hits = 0, long = 0, maxSp = 0, spSum = 0;
  for (let game = 0; game < 40; game++) {
    const g = P.newGame({ bottom: true, top: true }, { rnd: r }), mem = { top: {}, bottom: {} };
    P.serve(g, null, 0.3);
    let guard = 0;
    while (g.sides.top.a && g.sides.bottom.a && guard++ < 60 * 60 * 30) {
      g.sides.top.p = P.ai(g, 'top', lv, mem.top, 1 / 60);
      g.sides.bottom.p = P.ai(g, 'bottom', lv, mem.bottom, 1 / 60);
      const sp = g.ball ? g.ball.sp : 0;
      for (const e of P.step(g, 1 / 60)) {
        if (e[0] === 'hit') hits++;
        if (e[0] === 'miss') { points++; spSum += sp; maxSp = Math.max(maxSp, sp); if (g.rally > 60) long++; if (g.sides.top.a && g.sides.bottom.a) P.serve(g, null, 0.3); }
      }
    }
  }
  const avg = hits / points;
  ok(points >= 40 * 5 && long === 0 && avg > 2 && avg < 40, `${lv}: ${points}점 · 한 점에 평균 ${avg.toFixed(1)}번 치기 · 점수 날 때 평균 속도 ${Math.round(spSum / points)} · 최고 ${Math.round(maxSp)}px/초`);
}

console.log('▶ 4인: 빈 자리는 벽 · 목숨이 다 떨어지면 벽이 돼요');
{
  const r = rng(9), g = P.newGame({ bottom: true, top: true, left: true, right: false }, { rnd: r, hp: 2 }), mem = {};
  P.serve(g, null, 0);
  let guard = 0, gone = [];
  while (P.alive(g).length > 1 && guard++ < 60 * 60 * 20) {
    for (const n of P.alive(g)) { mem[n] = mem[n] || {}; g.sides[n].p = P.ai(g, n, 'easy', mem[n], 1 / 60); }
    for (const e of P.step(g, 1 / 60)) if (e[0] === 'miss') { if (!g.sides[e[1]].a) gone.push(e[1]); if (P.alive(g).length > 1) P.serve(g, null, 0); }
  }
  ok(P.alive(g).length === 1 && gone.length === 2 && !g.sides.right.a, `탈락 순서 ${gone.join(' → ')} · 우승 ${P.alive(g)[0]}`);
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
