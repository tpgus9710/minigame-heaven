// 🛡️ 탱크 대포 검사 (public/js/shared/tank-core.js): 🚁 보급 헬기 · ❤️ 회복 키트 · 🔆 광역 레이저 · ☄️ 유성우 · 상자 가져가기
const TC = require('../public/js/shared/tank-core.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const game = (n = 3, seed = 11) => TC.newGame(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i })), seeded(seed));
/** 평평한 땅 (높이 400) 으로 바꾸기 — 계산을 예측하기 쉽게 */
function flat(s, y = 400) {
  s.m.fill(0);
  for (let x = 0; x < TC.W; x++) for (let yy = y; yy < TC.H; yy++) s.m[yy * TC.W + x] = 1;
  s.tanks.forEach(t => { t.y = TC.restY(s, t.x, 0); });
}

console.log('▶ 시작 상태');
{
  const s = game();
  ok(s.tanks.every(t => t.ammo.laser === 0 && t.ammo.meteor === 0 && t.ammo.big === 2), '특별탄(레이저 · 유성우)은 처음엔 0발 — 보급으로만');
  ok(Array.isArray(s.items) && s.items.length === 0 && TC.items(s).length === 0, '처음엔 상자 없음');
}

console.log('▶ 🚁 보급 헬기');
{
  const s = game(3, 5);
  let first = null, maxItems = 0, drops = 0, kinds = new Set();
  for (let i = 0; i < 300; i++) {
    TC.nextTurn(s);
    if (s.drop) { drops++; kinds.add(s.drop.kind); if (first === null) first = s.turns; }
    maxItems = Math.max(maxItems, s.items.length);
    if (s.items.length >= 2) s.items.shift();                     // 누가 가져간 셈 치고 계속
  }
  ok(first !== null && first >= 2, `첫 보급은 두 번째 차례부터 (${first}번째)`);
  ok(drops > 40 && drops < 160, `가끔 와요 (300번 중 ${drops}번)`);
  ok(maxItems <= 2, '판 위 상자는 2개까지');
  ok(kinds.has('heal') && kinds.has('laser') && kinds.has('meteor'), '회복 키트 · 광역 레이저 · 유성우 모두 나와요');
  const s2 = game(3, 9); flat(s2);
  const d = TC.spawnDrop(s2);
  ok(d && d.y === 400 && s2.tanks.every(t => Math.abs(t.x - d.x) > 46), `상자는 땅 위에 · 탱크 바로 위는 피해서 (x ${d.x})`);
}

console.log('▶ 상자 가져가기: 닿기 · 쏘기');
{
  const s = game(2, 3); flat(s);
  const me = s.tanks[s.turn];
  me.hp = 60;
  s.items.push({ id: 99, kind: 'heal', x: Math.round(me.x + 26), y: 400 });
  for (let i = 0; i < 40 && s.items.length; i++) TC.move(s, me.id, 1, 1 / 30);
  const g = s.got.splice(0);
  ok(g.length === 1 && g[0].id === me.id && g[0].kind === 'heal' && me.hp === 90 && g[0].hp === 30, `닿으면 회복 키트 +30 (HP 60 → ${me.hp})`);
  me.hp = 95;
  s.items.push({ id: 100, kind: 'heal', x: Math.round(me.x + 26), y: 400 });
  for (let i = 0; i < 40 && s.items.length; i++) TC.move(s, me.id, 1, 1 / 30);
  ok(me.hp === 100 && s.got.splice(0)[0].hp === 5, 'HP 는 100 까지만');
  // 쏘기: 상자 근처에서 터지면 쏜 사람이 가져가요
  const s2 = game(2, 4); flat(s2);
  const a = s2.tanks[s2.turn], b = s2.tanks.find(t => t !== a);
  let best = null;                                                 // 상자를 둘 곳: 실제로 떨어지는 자리
  for (let p = 30; p <= 100 && !best; p += 2) {
    const probe = JSON.parse(JSON.stringify({ x: a.x }));
    const sim = TC.fire(Object.assign(Object.create(null), JSON.parse(JSON.stringify({ ...s2, m: null, rnd: null })), { m: s2.m.slice(), rnd: s2.rnd, carves: [], items: [], got: [] }), a.id, a.x < TC.W / 2 ? 50 : 130, p, 'normal');
    if (sim.booms[0] && Math.abs(sim.booms[0].x - b.x) > 80 && Math.abs(sim.booms[0].x - a.x) > 80) best = { p, x: sim.booms[0].x }; void probe;
  }
  ok(!!best, '빈 땅에 떨어지는 힘 찾기');
  if (best) {
    s2.items.push({ id: 7, kind: 'laser', x: best.x, y: 400 });
    const r = TC.fire(s2, a.id, a.x < TC.W / 2 ? 50 : 130, best.p, 'normal');
    ok(r.got.length === 1 && r.got[0].id === a.id && a.ammo.laser === 1 && r.items.length === 0, '포탄이 상자 근처에서 터지면 쏜 사람이 가져가요 (광역 레이저 +1)');
  }
}

console.log('▶ 🔆 광역 레이저');
{
  const s = game(3, 21); flat(s);
  const [a, b, c] = s.tanks;
  a.x = 120; b.x = 600; c.x = 680; s.tanks.forEach(t => { t.y = TC.restY(s, t.x, 0); });
  s.turn = 0; a.ammo.laser = 1;
  let shot = null;
  for (let p = 40; p <= 100 && !shot; p += 0.5) {                  // b · c 가운데(640)쯤 떨어지는 힘
    const copy = { ...s, m: s.m.slice(), carves: [], items: [], got: [], tanks: s.tanks.map(t => ({ ...t, ammo: { ...t.ammo } })) };
    const r = TC.fire(copy, a.id, 45, p, 'normal');
    if (r.booms[0] && Math.abs(r.booms[0].x - 640) < 14) shot = p;
  }
  ok(shot != null, `b · c 사이에 떨어지는 힘 ${shot}`);
  if (shot != null) {
    const hb = b.hp, hc = c.hp;
    const r = TC.fire(s, a.id, 45, shot, 'laser');
    ok(r.weapon === 'laser' && a.ammo.laser === 0 && r.booms[0].beam === true, '레이저 1발 쓰고 0발 · 빛기둥 표시');
    ok(hb - b.hp >= 35 && hc - c.hp >= 35, `넓게 맞아요: b −${hb - b.hp} · c −${hc - c.hp} (서로 80px 떨어진 두 탱크 모두 크게)`);
    const big = TC.WEAPONS.big, las = TC.WEAPONS.laser;
    ok(las.r > big.r * 1.8 && (las.carve || las.r) < las.r, `범위는 대형탄의 ${(las.r / big.r).toFixed(1)}배 · 땅은 덜 파여요`);
  }
}

console.log('▶ ☄️ 유성우');
{
  const s = game(2, 31); flat(s);
  const a = s.tanks[s.turn];
  a.ammo.meteor = 1;
  const r = TC.fire(s, a.id, a.x < TC.W / 2 ? 55 : 125, 70, 'meteor');
  ok(r.weapon === 'meteor' && r.shots.length === 6 && a.ammo.meteor === 0, `첫 발 + 운석 5개 (궤적 ${r.shots.length}개)`);
  ok(r.booms.length >= 5, `폭발 ${r.booms.length}번`);
  const main = r.shots[0].length;
  ok(r.shots.slice(1).every((p, i) => p.length > main && p[0][1] < 0 && p[main - 1][0] === p[0][0]), '운석은 첫 발이 닿은 뒤에 하늘(화면 위)에서 출발');
  const xs = r.booms.slice(1).map(b => b.x);
  ok(Math.max(...xs) - Math.min(...xs) > 120, `넓게 흩어져요 (${Math.min(...xs)} ~ ${Math.max(...xs)})`);
}

console.log('▶ 상자 밑 땅이 파이면');
{
  const s = game(2, 41); flat(s);
  s.items.push({ id: 5, kind: 'heal', x: 480, y: 400 });
  for (let yy = 380; yy < 480; yy++) for (let x = 470; x <= 490; x++) s.m[yy * TC.W + x] = 0;   // 상자 밑을 480 까지 파기
  const t = s.tanks[s.turn];
  TC.fire(s, t.id, 90, 5, 'normal');                                // 거의 제자리 (settle 를 돌리려고)
  const it = s.items.find(x => x.id === 5);
  ok(it && it.y === 480, `상자가 파인 바닥까지 떨어져요 (y 400 → ${it && it.y})`);
  for (let yy = 0; yy < TC.H; yy++) for (let x = 470; x <= 490; x++) s.m[yy * TC.W + x] = 0;   // 바닥까지 뚫기
  const r = TC.fire(s, t.id, 90, 5, 'normal');
  ok(!s.items.some(x => x.id === 5) && r.got.some(g => g.item === 5 && g.lost), '바닥 없는 구멍이면 상자가 사라져요');
}

console.log('▶ 같은 씨앗이면 서버 · 화면 결과가 같아요');
{
  const run = () => {
    const s = game(3, 77); const out = [];
    for (let i = 0; i < 12 && !s.over; i++) {
      const t = TC.active(s), plan = TC.aiPlan(s, t.id, 0.6);
      const r = TC.fire(s, t.id, plan.angle, plan.power, plan.weapon);
      out.push([r.weapon, r.booms.map(b => b.x).join('/'), r.got.length]);
      TC.nextTurn(s); out.push(s.drop && [s.drop.kind, s.drop.x]);
    }
    return JSON.stringify(out);
  };
  ok(run() === run(), '똑같이 다시 돌려도 결과가 같아요');
}

console.log('▶ AI 는 받은 특별탄을 써요');
{
  const s = game(2, 51);
  const t = s.tanks[s.turn];
  t.ammo.laser = 1;
  const uses = Array.from({ length: 20 }, () => TC.aiPlan(s, t.id, 0.6).weapon).filter(w => w === 'laser').length;
  ok(uses >= 9, `레이저가 있으면 자주 써요 (${uses}/20)`);
}

console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
