// 🚀 우주 슈팅 v14.0 규칙 검사 (js/shared/shooter-core.js · 화면 없이)
//   같은 씨앗 = 같은 판 · 무기 3종 × 파워 · 아이템 · 메달 · 편대 보너스 · 폭탄 · 맞기 · 이어하기 · 목숨 +1 · 보스(부위 · 단계 · 도망) · 레이저 예고
//   · 봇으로 1스테이지를 끝까지 (중간 보스 · 보스 · 점수표 · 2스테이지) · 오래 돌려도 숫자가 깨지지 않아요
const SC = require('../public/js/shared/shooter-core.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const { W, STEP } = SC;
const run = (g, sec, inp = () => ({})) => { for (let i = 0, n = Math.round(sec / STEP); i < n; i++) { SC.step(g, inp(g)); } };
const evs = (g, k) => g.ev.filter(e => e.k === k);
/** 피하면서 적 아래로 가는 봇 (탄을 0.1초 늦게 봐요) */
function bot(g) {
  const p = g.p, H = g.H;
  if (!p.alive || p.enter > 0) return {};
  let tx = W / 2, best = 1e9;
  for (const e of g.en) { if (e.dead || e.armor || e.y < 0 || e.y > p.y - 30) continue; const d = Math.abs(e.x - p.x) + (p.y - e.y) * 0.3; if (d < best) { best = d; tx = e.x; } }
  const cands = [[p.x, p.y]];
  for (let a = 0; a < 16; a++) for (const r of [10, 24, 44]) cands.push([p.x + Math.cos(a / 16 * 6.283) * r, p.y + Math.sin(a / 16 * 6.283) * r]);
  const near = g.eb.filter(b => b.age >= 0.1 && Math.abs(b.x - p.x) < 90 && b.y > p.y - 160 && b.y < p.y + 60);
  let bc = cands[0], bv = 1e9;
  for (const [cx0, cy0] of cands) {
    const cx = Math.max(7, Math.min(W - 7, cx0)), cy = Math.max(16, Math.min(H - 10, cy0)), dist = Math.hypot(cx - p.x, cy - p.y);
    let danger = 0;
    for (let k = 1; k <= 24; k += k < 10 ? 1 : 2) {
      const f = dist ? Math.min(1, (k * 520 * STEP) / dist) : 1, px = p.x + (cx - p.x) * f, py = p.y + (cy - p.y) * f;
      for (const b of near) { const dd = Math.hypot(b.x + b.vx * STEP * k - px, b.y + b.vy * STEP * k - py), lim = b.r + 3; if (dd < lim) danger += (lim - dd) * (k < 6 ? 60 : k < 12 ? 20 : 6); }
    }
    for (const e of g.en) { if (e.dead || !SC.EN[e.type].body) continue; const d = Math.hypot(e.x - cx, e.y - cy); if (d < e.r + 10) danger += (e.r + 10 - d) * 25; }
    if (g.boss) { const b = g.boss, D = b.def, nx = (cx - b.x) / (D.w * 0.45), ny = (cy - b.y) / (D.h * 0.45); if (nx * nx + ny * ny < 1) danger += 400; }
    for (const h of g.hz) if (Math.abs(cx - h.x) < h.w / 2 + 6 && cy > h.y0) danger += h.warn > 0 ? 300 : 1000;
    const v = danger * 10 + Math.abs(cx - tx) * 0.4 + Math.abs(cy - (H - 44)) * 0.25 + dist * 0.05;
    if (v < bv) { bv = v; bc = [cx, cy]; }
  }
  return { tx: bc[0], ty: bc[1], fast: true, bomb: bv > 3000 };
}

console.log('▶ 같은 씨앗 · 같은 조작이면 같은 판');
{
  const a = SC.create(7), b = SC.create(7), c = SC.create(8);
  run(a, 40, bot); run(b, 40, bot); run(c, 40, bot);
  ok(a.score === b.score && a.p.x === b.p.x && a.en.length === b.en.length && a.stat.kills === b.stat.kills, `씨앗 7 두 번: 점수 ${a.score} · 격추 ${a.stat.kills}`);
  ok(a.score !== c.score || a.p.x !== c.p.x, '씨앗이 다르면 판이 달라요');
}

console.log('▶ 무기 3종 × 파워');
{
  const vol = (w, lv) => { const g = SC.create(1); Object.assign(g.p, { enter: 0, y: 280, weapon: w, power: lv }); g.shots = []; g.msl = []; SC.step(g, {}); return g; };
  for (let lv = 1; lv <= 5; lv++) { const g = vol('V', lv); ok(g.shots.length === SC.VPAT[lv - 1].length, `발칸 ${lv}단계: ${g.shots.length}갈래`); }
  const L1 = vol('L', 1), L5 = vol('L', 5);
  ok(L1.shots.length === 1 && L1.shots[0].k === 'L' && L5.shots[0].r > L1.shots[0].r && L5.shots[0].dmg > L1.shots[0].dmg, '레이저: 단계가 오르면 굵고 세져요');
  const M1 = vol('M', 1), M5 = vol('M', 5);
  ok(M1.msl.length === 2 && M5.msl.length === 6, `미사일: 1단계 ${M1.msl.length}발 · 5단계 ${M5.msl.length}발`);
  // 미사일은 적을 쫓아가요
  const g = SC.create(2); Object.assign(g.p, { enter: 0, x: 40, y: 280, weapon: 'M', power: 1 });
  const e = g.en[g.en.push({ id: 99, type: 'heavy', x: 200, y: 120, vx: 0, vy: 0, hp: 999, max: 999, r: 17, age: 1, mv: 'none', hit: 0, ang: 0, ft: 99 }) - 1];
  run(g, 1.6);
  ok(e.hp < 999, `유도 미사일이 옆에 있는 적을 맞혀요 (체력 ${Math.round(e.hp)})`);
  // 드론
  const d = SC.create(3); Object.assign(d.p, { enter: 0, y: 280, weapon: 'V', power: 1, drones: 2, dft: 0 }); d.shots = []; SC.step(d, {});
  ok(d.shots.length === 4 && SC.dronePos(d).length === 2, '드론 2기도 같이 쏴요');
  d.p.focus = true; const near = SC.dronePos(d); d.p.focus = false; const far = SC.dronePos(d);
  ok(Math.abs(near[0].x - d.p.x) < Math.abs(far[0].x - d.p.x), '천천히(Shift) 움직이면 드론이 가까이 모여요');
}

console.log('▶ 아이템 · 메달');
{
  const g = SC.create(4); Object.assign(g.p, { enter: 0, x: 120, y: 280 });
  const give = (k, extra = {}) => { g.items.push(Object.assign({ k, x: g.p.x, y: g.p.y, vx: 0, vy: 0, t: 0, ph: 0 }, extra)); SC.step(g, {}); };
  give('P'); ok(g.p.power === 2, '파워 +1');
  give('W', { t: 1.6 }); ok(g.p.weapon === 'L' && g.p.power === 2, '무기 수정은 1.5초마다 색이 바뀌어요: 지금 색(레이저)으로');
  give('W', { t: 1.6 }); ok(g.p.weapon === 'L' && g.p.power === 3, '같은 무기를 또 먹으면 파워 +1');
  give('B'); ok(g.p.bombs === 4, '폭탄 +1');
  give('S'); ok(g.p.shield, '실드');
  give('D'); give('D'); give('D'); ok(g.p.drones === 2, '드론은 2기까지');
  const s0 = g.score; give('m'); give('m'); give('m');
  ok(g.score - s0 === 100 + 200 + 300 && g.mi === 3, `메달: 모을수록 100 → 200 → 300 (다음 ${SC.MEDAL_V[g.mi]})`);
  g.items.push({ k: 'm', x: 10, y: g.H + 8, vx: 0, vy: 50, t: 0, ph: 0 }); Object.assign(g.p, { x: 220 }); run(g, 0.3, () => ({ tx: 220, ty: 200 }));
  ok(g.mi === 0 && evs(g, 'medalLost').length, '메달을 놓치면 값이 처음(100)으로');
}

console.log('▶ 편대 전멸 보너스');
{
  const g = SC.create(5);
  g.phase = 'play'; Object.assign(g.p, { enter: 0, power: 5, x: 120, y: 280 });
  const tl = [[0, 'vform', { type: 'zako', n: 5, x: 120, drop: 'B' }]];
  const orig = SC.STAGES[0].tl; SC.STAGES[0].tl = tl; g.wi = 0; g.st = 0;
  let got = null, dropped = false;
  run(g, 4, gg => { for (const e of gg.ev) if (e.k === 'formation' && !got) { got = e; dropped = gg.items.some(i => i.k === 'B'); } gg.ev.length = 0; return { tx: 120, ty: 280 }; });
  SC.STAGES[0].tl = orig;
  ok(got && got.pts > 0 && dropped, `5대를 모두 잡으면 보너스 +${got && got.pts} · 편대가 들고 있던 아이템(폭탄)이 떨어져요`);
}

console.log('▶ 폭탄');
{
  const g = SC.create(6); Object.assign(g.p, { enter: 0, x: 120, y: 280, inv: 0 });
  for (let i = 0; i < 30; i++) g.eb.push({ x: 20 + i * 7, y: 150, vx: 0, vy: 30, r: 2.2, kind: 'o', age: 1 });
  g.en.push({ id: 500, type: 'gun', x: 120, y: 80, vx: 0, vy: 0, hp: 60, max: 60, r: 10, age: 1, mv: 'none', hit: 0, ang: 0, ft: 99 });
  const b0 = g.p.bombs;
  SC.step(g, { bomb: true });
  ok(g.p.bombs === b0 - 1 && g.eb.length === 0 && g.items.filter(i => i.k === 'star').length >= 25, `적 탄 ${30}개 → 점수 별 · 폭탄 ${b0} → ${g.p.bombs}`);
  const s0 = g.score; run(g, 1.5);
  ok(g.score > s0 && !g.en.some(e => e.id === 500), `별을 빨아들여 점수 +${g.score - s0} · 포격선도 터졌어요`);
  g.eb.push({ x: g.p.x, y: g.p.y, vx: 0, vy: 0, r: 3, kind: 'o', age: 1 }); SC.step(g, {});
  ok(g.p.alive && g.p.lives === 3, '폭탄이 터지는 동안은 무적');
}

console.log('▶ 맞기 · 다시 나오기 · 게임 오버 · 이어하기');
{
  const g = SC.create(9); Object.assign(g.p, { enter: 0, x: 120, y: 280, inv: 0, power: 3 });
  for (let i = 0; i < 10; i++) g.eb.push({ x: 40 + i * 10, y: 100, vx: 0, vy: 10, r: 2.2, kind: 'o', age: 1 });
  g.eb.push({ x: 120.5, y: 280.5, vx: 0, vy: 0, r: 2.2, kind: 'o', age: 1 });
  SC.step(g, {});
  ok(!g.p.alive && g.p.lives === 2 && g.p.power === 2 && g.eb.length === 0 && g.items.some(i => i.k === 'P'), '맞으면 목숨 −1 · 파워 −1 (파워 아이템이 떨어져요) · 화면의 적 탄이 사라져요');
  run(g, 1.6);
  ok(g.p.alive && g.p.inv > 1 && g.p.bombs >= 3, '1.5초 뒤 다시 나와요 (깜빡이는 동안 무적 · 폭탄은 3개로)');
  // 실드
  const s = SC.create(10); Object.assign(s.p, { enter: 0, x: 120, y: 280, inv: 0, shield: true });
  s.eb.push({ x: 120, y: 280, vx: 0, vy: 0, r: 2.2, kind: 'o', age: 1 }); SC.step(s, {});
  ok(s.p.alive && !s.p.shield && s.p.lives === 3, '실드가 있으면 실드만 깨져요');
  // 맞는 곳은 가운데 작은 점: 날개를 스치는 탄은 괜찮아요
  const w = SC.create(11); Object.assign(w.p, { enter: 0, x: 120, y: 280, inv: 0 });
  w.eb.push({ x: 126, y: 284, vx: 0, vy: 0, r: 2.2, kind: 'o', age: 1 }); SC.step(w, {});
  ok(w.p.alive, '날개 끝(6칸 옆)을 스치는 탄은 괜찮아요');
  // 게임 오버 → 이어하기
  const o = SC.create(12); Object.assign(o.p, { enter: 0, x: 120, y: 280, inv: 0, lives: 1 }); o.score = 12345; o.best = 12345;
  o.eb.push({ x: 120, y: 280, vx: 0, vy: 0, r: 2.2, kind: 'o', age: 1 }); SC.step(o, {});
  ok(o.phase === 'over' && evs(o, 'over').length, '마지막 목숨을 잃으면 GAME OVER');
  ok(SC.cont(o) && o.score === 0 && o.best === 12345 && o.p.lives === 3 && o.credits === 2 && o.phase !== 'over', '이어하기: 점수 0부터 · 목숨 3 · 기록은 한 번에 낸 최고 점수(12,345)');
}

console.log('▶ 목숨 +1 (15만점)');
{
  const g = SC.create(13); g.score = 149990; g.p.lives = 2; Object.assign(g.p, { enter: 0, x: 120, y: 280 });
  g.items.push({ k: 'm', x: 120, y: 280, vx: 0, vy: 0, t: 0, ph: 0 });
  SC.step(g, {});
  ok(g.p.lives === 3 && evs(g, 'extend').length === 1, '15만 점을 넘으면 목숨 +1');
}

console.log('▶ 보스: 부위를 부숴야 코어가 열려요 · 단계 · 도망');
{
  const g = SC.create(14); g.phase = 'play';
  const tl = SC.STAGES[0].tl, bi = tl.findIndex(r => r[1] === 'boss');
  g.wi = bi; g.st = tl[bi][0];
  run(g, 0.1);
  ok(g.warn > 0 && evs(g, 'warn').length, 'WARNING (3초 뒤 보스)');
  run(g, 3.4);
  const b = g.boss, core = b && b.parts.find(p => p.core);
  ok(b && b.def.name === '강철 게' && core, '1스테이지 보스: 강철 게');
  run(g, 2.6);
  ok(core.armor, '집게가 살아 있으면 코어는 단단해요');
  const hp0 = core.hp; g.shots.push({ x: core.x, y: core.y + 4, vx: 0, vy: -10, dmg: 5, r: 3, k: 'V', src: 0 }); SC.step(g, {});
  ok(core.hp === hp0, '단단한 코어는 맞아도 안 깎여요 (튕기는 소리)');
  for (const p of b.parts) if (!p.core) p.hp = 0.1;
  g.shots.push(...b.parts.filter(p => !p.core).map(p => ({ x: p.x, y: p.y, vx: 0, vy: 0, dmg: 1, r: 3, k: 'V', src: 0 }))); SC.step(g, {}); SC.step(g, {});
  ok(!core.armor && b.ph === 1 && evs(g, 'partKill').length === 2, '집게를 다 부수면 코어가 열리고 다음 단계로');
  core.hp = core.max * 0.3; SC.step(g, {});
  ok(b.ph === 2, '코어 체력 35% 아래: 마지막 단계');
  // 도망: 시간이 다 되면 보스가 떠나고 스테이지는 끝나요
  b.timer = 0.02; run(g, 3);
  ok(!g.boss && evs(g, 'escape').length && g.phase === 'clear' && evs(g, 'clear').some(e => e.killed === false), '시간이 다 되면 보스가 도망가고 스테이지 끝 (보스 점수 없이)');
}

console.log('▶ 레이저: 1초 넘게 예고한 뒤 쏴요 · 가운데만 아파요');
{
  const g = SC.create(15); Object.assign(g.p, { enter: 0, x: 100, y: 280, inv: 0 });
  g.hz.push({ x: 100, y0: 60, w: 13, warn: 1.15, on: 0.65 });
  run(g, 1.0, () => ({}));
  ok(g.p.alive, '예고(빨간 선) 중에는 괜찮아요');
  g.p.x = 107; run(g, 0.3, () => ({}));
  ok(g.p.alive, '굵기 13 · 가운데에서 7칸 옆은 괜찮아요');
  g.p.x = 102; SC.step(g, {});
  ok(!g.p.alive, '광선 안에 있으면 맞아요');
}

console.log('▶ 세로가 긴 판 (휴대폰)');
{
  const g = SC.create(16, { H: 400 }); run(g, 2);
  ok(g.H === 400 && g.p.y > 320, `판 세로 400: 비행기는 아래쪽(y=${Math.round(g.p.y)})에서 시작`);
  run(g, 1, () => ({ tx: 120, ty: 999 })); ok(g.p.y <= 390, '아래 끝을 넘지 않아요');
  ok(SC.create(1, { H: 999 }).H === 440 && SC.create(1, { H: 100 }).H === 320, '세로는 320 ~ 440');
}

console.log('▶ 봇으로 1스테이지 끝까지');
{
  const t0 = Date.now(), g = SC.create(2024);
  const seen = new Set();
  let n = 0, bad = 0;
  while (n++ < 60 * 200 && !(g.stage === 2 && g.phase === 'play')) {
    SC.step(g, bot(g));
    for (const e of g.ev) seen.add(e.k);
    g.ev.length = 0;
    for (const e of g.en) if (!Number.isFinite(e.x + e.y + e.hp)) bad++;
    for (const b of g.eb) if (!Number.isFinite(b.x + b.y)) bad++;
    if (!Number.isFinite(g.p.x + g.p.y + g.score)) bad++;
    if (g.phase === 'over') SC.cont(g);
  }
  const ms = Date.now() - t0;
  ok(g.stage === 2, `1스테이지 클리어 → 2스테이지 (${Math.round(g.t)}초 · 점수 ${g.score} · 격추 ${g.stat.kills} · 놓친 목숨 ${g.stat.miss})`);
  ok(['midIn', 'midEnd', 'warn', 'bossIn', 'bossDie', 'bossEnd', 'clear', 'stage', 'kill', 'medal', 'formation'].every(k => seen.has(k)), '중간 보스 · WARNING · 보스 · 점수표 · 메달 · 편대 보너스가 다 나와요', [...seen].join(','));
  ok(!bad, `숫자 깨짐 ${bad}`);
  ok(ms < 8000, `1스테이지 계산 ${ms}ms (휴대폰에서도 가벼워요)`);
}

console.log(fails ? `\n❌ 우주 슈팅: ${fails}개 실패` : '\n✅ 우주 슈팅: 모두 통과');
process.exit(fails ? 1 : 0);
