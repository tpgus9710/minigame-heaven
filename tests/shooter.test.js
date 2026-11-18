// 🚀 우주 슈팅 v14.1 규칙 검사 (js/shared/shooter-core.js · 화면 없이)
//   같은 씨앗 = 같은 판 · 무기 3종 × 파워 6 · 미사일 버그(무기를 바꾸면 쏟아지던 것) · 아이템(P · 무기 · B — 메달 없음) · 파워가 다 차면 P 안 나와요
//   · 수송선은 지금과 다른 무기를 차례로 · 편대 보너스 · 폭탄(탄 지우기) · 맞기(파워 −2) · 이어하기 · 목숨 +1 · 난이도 · 연습 시작 · 별 3개
//   · 보스(부위 · 단계 · 도망) · 레이저 예고 · 봇으로 1스테이지를 끝까지 · 오래 돌려도 숫자가 깨지지 않아요
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

console.log('▶ 무기 3종 × 파워 1~6');
{
  const vol = (w, lv) => { const g = SC.create(1); Object.assign(g.p, { enter: 0, y: 280, weapon: w, power: lv }); g.shots = []; g.msl = []; SC.step(g, {}); return g; };
  ok(SC.PMAX === 6 && SC.VPAT.length === 6, '파워는 6단계');
  for (let lv = 1; lv <= 6; lv++) { const g = vol('V', lv); ok(g.shots.length === SC.VPAT[lv - 1].length, `퍼짐탄 ${lv}단계: ${g.shots.length}갈래`); }
  const L1 = vol('L', 1), L6 = vol('L', 6);
  ok(L1.shots.length === 1 && L1.shots[0].k === 'L' && L6.shots[0].r > L1.shots[0].r && L6.shots[0].dmg > L1.shots[0].dmg, '레이저: 단계가 오르면 굵고 세져요');
  const M1 = vol('M', 1), M6 = vol('M', 6);
  ok(M1.msl.length === 2 && M6.msl.length === 6, `유도탄: 1단계 ${M1.msl.length}발 · 6단계 ${M6.msl.length}발`);
  const g = SC.create(2); Object.assign(g.p, { enter: 0, x: 40, y: 280, weapon: 'M', power: 1 });
  const e = g.en[g.en.push({ id: 99, type: 'heavy', x: 200, y: 120, vx: 0, vy: 0, hp: 999, max: 999, r: 17, age: 1, mv: 'none', hit: 0, ang: 0, ft: 99 }) - 1];
  run(g, 1.6);
  ok(e.hp < 999, `유도 미사일이 옆에 있는 적을 맞혀요 (체력 ${Math.round(e.hp)})`);
}

console.log('▶ 미사일 버그 (v14.0): 다른 무기를 오래 쓰다가 유도탄으로 바꿔도 미사일이 쏟아지지 않아요');
{
  // 퍼짐탄으로 60초 → 유도탄 아이템 → 3초 동안 쏜 미사일 수 (6발씩 0.36초마다 → 50발쯤)
  let n = 0;
  const h = SC.create(3); Object.assign(h.p, { enter: 0, x: 120, y: 280, power: 6, weapon: 'V' }); h.phase = 'play';
  run(h, 60, gg => { gg.p.inv = 99; gg.p.lives = 9; return {}; });
  h.items.push({ k: 'M', x: h.p.x, y: h.p.y, vx: 0, vy: 0, t: 0, ph: 0 });
  for (let i = 0; i < 180; i++) { const b = h.msl.length; SC.step(h, {}); h.p.inv = 99; n += Math.max(0, h.msl.length - b); }
  ok(h.p.weapon === 'M' && n > 30 && n <= 54, `바꾼 뒤 3초 동안 미사일 ${n}발 (v14.0 은 400발 넘게 쏟아졌어요)`);
}

console.log('▶ 아이템 (P 파워 · 무기 · B 폭탄 — 메달 · 점수 별 없음)');
{
  const g = SC.create(4); Object.assign(g.p, { enter: 0, x: 120, y: 280 });
  const give = (k, extra = {}) => { g.items.push(Object.assign({ k, x: g.p.x, y: g.p.y, vx: 0, vy: 0, t: 0, ph: 0 }, extra)); SC.step(g, {}); };
  give('P'); ok(g.p.power === 2, '파워 +1');
  give('L'); ok(g.p.weapon === 'L' && g.p.power === 2, '무기 아이템: 그 무기로 (파워는 그대로)');
  const s0 = g.score; give('L'); ok(g.p.weapon === 'L' && g.score - s0 === 1000, '같은 무기를 또 먹으면 +1,000점');
  give('B'); ok(g.p.bombs === 4, '폭탄 +1');
  g.p.power = 6; const s1 = g.score; give('P'); ok(g.p.power === 6 && g.score - s1 === 1000, '파워가 다 찼을 때 P 는 +1,000점');
  ok(!Object.keys(SC.ITEMS).some(k => !['P', 'B', 'V', 'L', 'M'].includes(k)) && !('MEDAL_V' in SC), '아이템은 5가지뿐 (메달 · 실드 · 드론 없음)');
  // 떨어뜨릴 것: 파워가 다 차면 P 대신 (폭탄이 모자랄 때만) 폭탄 · 아니면 아무것도
  const d = SC.create(5);
  d.p.power = 3; ok(SC.powerDrop(d) === 'P', '파워가 덜 찼으면 P');
  d.p.power = 6; d.p.bombs = 1; ok(SC.powerDrop(d) === 'B', '파워가 다 찼고 폭탄이 모자라면 B');
  d.p.bombs = 3; ok(SC.powerDrop(d) === null, '파워가 다 찼으면 아무것도 안 떨어져요');
  // 수송선: 지금 무기와 다른 무기를 차례로
  const w = SC.create(6); w.p.weapon = 'V';
  const got = [SC.weaponDrop(w), SC.weaponDrop(w), SC.weaponDrop(w), SC.weaponDrop(w)];
  ok(got.every(x => x !== 'V') && got.includes('L') && got.includes('M'), `수송선 무기: ${got.join(' → ')} (지금 쓰는 퍼짐탄은 안 나와요)`);
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
  // 파워가 다 찬 비행기에게는 편대의 P 가 안 떨어져요
  const h = SC.create(5); h.phase = 'play'; Object.assign(h.p, { enter: 0, power: 6, x: 120, y: 280 });
  const orig2 = SC.STAGES[0].tl; SC.STAGES[0].tl = [[0, 'vform', { type: 'zako', n: 5, x: 120, drop: 'P' }]]; h.wi = 0; h.st = 0;
  let fm = false;
  run(h, 4, gg => { if (gg.ev.some(e => e.k === 'formation')) fm = true; gg.ev.length = 0; return { tx: 120, ty: 280 }; });
  SC.STAGES[0].tl = orig2;
  ok(fm && !h.items.some(i => i.k === 'P'), '파워가 다 찼으면 편대 보너스만 · P 는 안 나와요');
}

console.log('▶ 폭탄');
{
  const g = SC.create(6); Object.assign(g.p, { enter: 0, x: 120, y: 280, inv: 0 });
  for (let i = 0; i < 30; i++) g.eb.push({ x: 20 + i * 7, y: 150, vx: 0, vy: 30, r: 2.2, kind: 'o', age: 1 });
  g.en.push({ id: 500, type: 'gun', x: 120, y: 80, vx: 0, vy: 0, hp: 60, max: 60, r: 10, age: 1, mv: 'none', hit: 0, ang: 0, ft: 99 });
  const b0 = g.p.bombs;
  SC.step(g, { bomb: true });
  const cancel = evs(g, 'cancel')[0];
  ok(g.p.bombs === b0 - 1 && g.eb.length === 0 && g.items.length === 0 && cancel && cancel.list.length === 30, `적 탄 30개를 지워요 (점수 별 없음) · 폭탄 ${b0} → ${g.p.bombs}`);
  run(g, 1.5);
  ok(!g.en.some(e => e.id === 500), '화면의 포격선도 터졌어요');
  g.eb.push({ x: g.p.x, y: g.p.y, vx: 0, vy: 0, r: 3, kind: 'o', age: 1 }); SC.step(g, {});
  ok(g.p.alive && g.p.lives === 3, '폭탄이 터지는 동안은 무적');
}

console.log('▶ 맞기 · 다시 나오기 · 게임 오버 · 이어하기');
{
  const g = SC.create(9); Object.assign(g.p, { enter: 0, x: 120, y: 280, inv: 0, power: 3 });
  for (let i = 0; i < 10; i++) g.eb.push({ x: 40 + i * 10, y: 100, vx: 0, vy: 10, r: 2.2, kind: 'o', age: 1 });
  g.eb.push({ x: 120.5, y: 280.5, vx: 0, vy: 0, r: 2.2, kind: 'o', age: 1 });
  SC.step(g, {});
  ok(!g.p.alive && g.p.lives === 2 && g.p.power === 1 && g.eb.length === 0 && g.items.filter(i => i.k === 'P').length === 1, '맞으면 목숨 −1 · 파워 −2 (P 하나가 떨어져요 → 주우면 1 되찾아요) · 화면의 적 탄이 사라져요');
  run(g, 1.6);
  ok(g.p.alive && g.p.inv > 1 && g.p.bombs >= 3, '1.5초 뒤 다시 나와요 (깜빡이는 동안 무적 · 폭탄은 3개로)');
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

console.log('▶ 목숨 +1 (난이도마다)');
{
  const g = SC.create(13); g.score = 99990; g.p.lives = 2; Object.assign(g.p, { enter: 0, x: 120, y: 280, power: 6 });
  g.items.push({ k: 'P', x: 120, y: 280, vx: 0, vy: 0, t: 0, ph: 0 });
  SC.step(g, {});
  ok(g.p.lives === 3 && evs(g, 'extend').length === 1, '보통: 10만 점을 넘으면 목숨 +1');
  const e = SC.create(13, { diff: 0 }), h = SC.create(13, { diff: 2 });
  ok(SC.nextExtend(e, 0) < SC.nextExtend(g, 0) && SC.nextExtend(g, 0) < SC.nextExtend(h, 0) && SC.nextExtend(g, 3) === 600000 + 500000, '쉬움은 더 일찍 · 어려움은 더 늦게 · 표가 끝나면 일정한 간격');
}

console.log('▶ 난이도 · 연습 시작 · 별 3개');
{
  const e = SC.create(20, { diff: 0 }), n = SC.create(20), h = SC.create(20, { diff: 2 });
  ok(e.D.key === 'easy' && n.D.key === 'normal' && h.D.key === 'hard' && e.p.lives === 4 && n.p.lives === 3 && h.p.lives === 3, '쉬움은 목숨 4개 · 보통 · 어려움 3개');
  ok(e.bsp < n.bsp && n.bsp < h.bsp && e.frate < n.frate && n.frate < h.frate && e.hpm < n.hpm && n.hpm < h.hpm, '탄 빠르기 · 쏘는 빈도 · 체력: 쉬움 < 보통 < 어려움');
  const p3 = SC.create(21, { stage: 3 });
  ok(p3.stage === 3 && p3.start === 3 && p3.p.power === SC.START_POWER[2], `연습: 3스테이지부터 · 파워 ${p3.p.power}로 시작`);
  // 별: 클리어 · 노 미스 · 격추율 85%
  const g = SC.create(22); g.phase = 'play';
  const tl = SC.STAGES[0].tl, bi = tl.findIndex(r => r[1] === 'boss'); g.wi = bi; g.st = tl[bi][0];
  run(g, 3.6);
  const b = g.boss; b.enter = 0; b.core.armor = false; for (const p of b.parts) { if (!p.core) { p.dead = true; p.hp = 0; } }
  g.sstat = { kills: 90, spawned: 100, miss: 0, t0: 0 };
  b.core.hp = 0.1; g.shots.push({ x: b.core.x, y: b.core.y, vx: 0, vy: 0, dmg: 5, r: 3, k: 'V', src: 0 });
  let clr = null;
  run(g, 3, gg => { for (const x of gg.ev) if (x.k === 'clear') clr = x; gg.ev.length = 0; return {}; });
  ok(clr && clr.killed && clr.stars.join() === 'true,true,true' && g.stars[1] === 7, `보스를 잡고 · 안 맞고 · 격추율 90% → 별 3개 (${clr && clr.stars})`);
  const m = SC.create(23); m.sstat = { kills: 50, spawned: 100, miss: 1, t0: 0 }; m.phase = 'play';
  m.wi = bi; m.st = tl[bi][0]; run(m, 3.6); const mb = m.boss; mb.enter = 0; for (const p of mb.parts) if (!p.core) { p.dead = true; p.hp = 0; }
  m.sstat = { kills: 50, spawned: 100, miss: 1, t0: 0 }; mb.core.armor = false; mb.core.hp = 0.1; m.shots.push({ x: mb.core.x, y: mb.core.y, vx: 0, vy: 0, dmg: 5, r: 3, k: 'V', src: 0 });
  let c2 = null; run(m, 3, gg => { for (const x of gg.ev) if (x.k === 'clear') c2 = x; gg.ev.length = 0; return {}; });
  ok(c2 && c2.stars.join() === 'true,false,false' && m.stars[1] === 1, `한 번 맞고 · 격추율 50% → 별 1개 (${c2 && c2.stars})`);
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
  ok(['midIn', 'midEnd', 'warn', 'bossIn', 'bossDie', 'bossEnd', 'clear', 'stage', 'kill', 'pick', 'formation'].every(k => seen.has(k)), '중간 보스 · WARNING · 보스 · 점수표 · 아이템 · 편대 보너스가 다 나와요', [...seen].join(','));
  ok(!bad, `숫자 깨짐 ${bad}`);
  ok(ms < 8000, `1스테이지 계산 ${ms}ms (휴대폰에서도 가벼워요)`);
}

console.log(fails ? `\n❌ 우주 슈팅: ${fails}개 실패` : '\n✅ 우주 슈팅: 모두 통과');
process.exit(fails ? 1 : 0);
