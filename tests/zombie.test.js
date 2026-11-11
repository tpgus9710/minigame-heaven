'use strict';
/* 🧟 좀비 웨이브 규칙 검사 (public/js/shared/zombie-core.js) — node tests/zombie.test.js
 *  무기 7종 · 방패 · 뚱보 연쇄 폭발 · 산성 침 피하기 · 보스 공격 · 강화 · 게이트 · 콤보 · 그리고
 *  "시간만 들이면 끝없이 버티는 판"이 없는지 (잘하는 봇 · 피해를 일부 안 받는 봇도 결국 끝나요) */
const Z = require('../public/js/shared/zombie-core.js');
let fails = 0;
const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };
const DT = 1 / 60;
const run = (g, sec, inp = {}) => { for (let t = 0; t < sec && !g.over && g.phase !== 'perk'; t += DT) { Z.step(g, DT, inp); } };
const empty = (seed, o) => { const g = Z.create(seed, o); g.script = []; return g; };      // 길에 아무것도 안 나오는 판 (검사용)

/* ── 잘하는 사람 흉내 봇: 위험 피하기 · 게이트 · 화력 집중 · 아이템 · 수류탄 ── */
function plan(g) {
  const R = Z.radius(g);
  let best = g.x, bv = -1e9;
  for (let x = Z.ROAD_L + 12; x <= Z.ROAD_R - 12; x += 8) {
    let v = -Math.abs(x - g.x) * 0.02;
    for (const a of g.acid) if (Math.abs(x - a.x) < a.r + R * 0.45 + 8) v -= 400;
    for (const m of g.marks) {
      if (m.k === 'slam' && Math.abs(x - m.x) < m.r + R * 0.4 + 8) v -= 500;
      if (m.k === 'lane' && Math.abs(x - m.x) < Z.LANE_W / 2 + R * 0.4 + 8) v -= 600;
    }
    if (g.boss && g.boss.st === 'tele' && Math.abs(x - g.boss.lane) < Z.LANE_W / 2 + R * 0.4 + 8) v -= 600;
    for (const o of g.objs) {
      if (o.t === 'z') {
        if (o.lock && o.lock.vy > 0) { const tt = (Z.SQ_Y - o.y) / o.lock.vy, xc = o.x + o.lock.vx * tt; if (tt > 0 && tt < 1.6 && Math.abs(x - xc) < R + o.r + 6) v -= 150 * o.dmg; }
        if (Math.abs(x - o.x) < Math.max(14, R * 0.85) + o.r && o.y > 0 && o.y < Z.SQ_Y - 30) v += (o.k === 'bloater' ? (o.y < Z.SQ_Y - 220 ? 6 : -4) : o.k === 'spitter' || o.k === 'screamer' ? 4 : o.k === 'brute' ? 3 : 1) * (0.5 + o.y / Z.SQ_Y) * 3;
        if (o.y > Z.SQ_Y - 140 && Math.abs(x - o.x) < R + o.r + 4) v -= o.k === 'bloater' ? 60 : o.k === 'brute' ? 40 : 6;
      } else if (o.t === 'gate' && o.y > Z.SQ_Y - 260 && o.y < Z.SQ_Y && Math.abs(x - o.x) < o.w / 2) {
        const val = o.op === '+' ? o.v : o.op === '×' ? g.n : o.op === '−' ? -o.v : -g.n / 2;
        v += (val > 0 ? Math.min(val, Math.max(0, g.cap - g.n) + 2) : val) * 12;
      } else if (o.t === 'item' && o.y > 0 && Math.abs(x - o.x) < R + 14) v += (o.k === 'w' ? 60 : o.k === 'men' ? 50 : 35) * (0.4 + o.y / Z.SQ_Y);
      else if (o.t === 'crate' && o.y > 0 && o.y < Z.SQ_Y - 100 && Math.abs(x - o.x) < Math.max(14, R * 0.85) + 20) v += 14;
      else if (o.t === 'boss' && Math.abs(x - o.x) < 50) v += 8;
    }
    if (v > bv) { bv = v; best = x; }
  }
  const zs = g.objs.filter(o => o.t === 'z' && o.y > 100 && o.y < Z.SQ_Y - 60);
  const nade = g.nades > 0 && (zs.filter(o => o.y > Z.SQ_Y - 260).length >= 7 || zs.some(o => (o.k === 'brute' || o.k === 'bloater') && o.y > Z.SQ_Y - 200) || (g.boss && g.boss.hp < g.boss.max * 0.5 && g.nades >= 2));
  return { target: best, nade };
}
const PREF = ['dmg', 'rate', 'cap', 'pierce', 'armor', 'ammo', 'heal', 'nade', 'combo', 'magnet', 'lucky'];
function play(seed, how = 'good', limit = 3600, god = false) {
  const g = Z.create(seed);
  let t = 0, think = 0, inp = {};
  while (!g.over && t < limit) {
    if (g.phase === 'perk') { const o = g.offer.slice().sort((a, b) => PREF.indexOf(a) - PREF.indexOf(b)); Z.pick(g, g.n < g.cap * 0.35 && g.offer.includes('heal') ? 'heal' : o[0]); continue; }
    if (how === 'good' && (think -= DT) <= 0) { think = 0.05; inp = plan(g); }
    Z.step(g, DT, inp); inp.nade = false;
    if (god) for (const e of g.ev) if (e.t === 'hurt' && ['acid', 'slam', 'charge'].includes(e.why) && !g.over) g.n += e.k;   // 이 공격들은 완벽하게 피했다고 쳐요
    g.ev.length = 0; t += DT;
  }
  return { g, t };
}

console.log('▶ 같은 씨앗 + 같은 조작 = 같은 판');
{
  const a = play(4242, 'good', 120).g, b = play(4242, 'good', 120).g;
  ok(a.score === b.score && a.kills === b.kills && a.n === b.n && a.stage === b.stage, `점수 ${a.score} · 처치 ${a.kills} · 스테이지 ${a.stage} 가 똑같아요`);
}

console.log('▶ 끝없이 버티는 판이 없어요 (실력이 있어야 높이 가요)');
{
  const idle = [11, 22, 33, 44, 55].map(s => play(s, 'idle', 1200));
  ok(idle.every(r => r.g.over && r.g.stage <= 2), `가만히 있으면 금방 끝나요 (스테이지 ${idle.map(r => r.g.stage).join(', ')})`);
  const good = [101, 202, 303, 404, 505, 606].map(s => play(s, 'good', 3600));
  const st = good.map(r => r.g.stage);
  ok(good.every(r => r.g.over), `잘하는 봇도 결국 끝나요 (스테이지 ${st.join(', ')} · ${good.map(r => Math.round(r.t / 60) + '분').join(', ')})`);
  ok(Math.min(...st) >= 3 && st.reduce((a, b) => a + b, 0) / st.length > idle.reduce((a, r) => a + r.g.stage, 0) / idle.length + 2, '잘하면 훨씬 멀리 가요');
  const god = [7, 8, 9].map(s => play(s, 'good', 3600, true));
  ok(god.every(r => r.g.over && r.t < 3000), `산성 · 보스 공격을 다 피해도 좀비가 강해져서 끝나요 (스테이지 ${god.map(r => r.g.stage).join(', ')})`);
  const hp = s => Z.hpMul(s);
  ok(hp(11) / hp(1) > 4 && Z.power({ n: 999, pk: {} }) < Z.power({ n: 10, pk: {} }) * 11, `좀비 체력은 곱으로(10스테이지 뒤 ×${hp(11).toFixed(1)}), 화력은 병사 수의 제곱근만큼만`);
}

console.log('▶ 무기');
{
  // 부대 앞 150px 에 고정한 과녁 (길이 흘러도 그 자리)
  const pin = (h, q) => { for (let t = 0; t < 1; t += DT) { q.x = 240; q.y = Z.SQ_Y - 160; Z.step(h, DT, { target: 240 }); } };
  const g = empty(1, { n: 20 });
  const z = Z.spawnZ(g, 'walker', 240, 300); z.hp = z.max = 1e6;
  pin(g, z);
  const rifle = 1e6 - z.hp;
  ok(rifle > 0 && g.shots.every(s => s.k === 'b'), `소총: 정면 좀비에게 1초 피해 ${Math.round(rifle)}`);
  const dps = {};
  for (const id of Z.SPECIAL) {
    const h = empty(1, { n: 20 }), q = Z.spawnZ(h, 'walker', 240, 300);
    q.hp = q.max = 1e6; q.lat = 0; q.sp = 0;
    h.wpn = { id, lv: 1, ammo: 99, max: 99 };
    pin(h, q);
    dps[id] = Math.round(1e6 - q.hp);
  }
  ok(Z.SPECIAL.every(id => dps[id] > rifle * 0.9), `특수 무기 7가지 모두 소총보다 세요 (${Z.SPECIAL.map(id => Z.WEAPONS[id].name + ' ' + dps[id]).join(' · ')})`);
  // 탄약이 다 떨어지면 소총으로
  const a = empty(2, { n: 20 }); a.wpn = { id: 'mg', lv: 1, ammo: 0.5, max: 14 };
  run(a, 1, { target: 240 });
  ok(a.wpn === null, '탄약(초)이 다 떨어지면 소총으로 돌아와요');
  // 같은 무기를 또 주우면 Lv 업 · 다른 무기면 바뀜
  const b = empty(3, { n: 20 }); b.wpn = { id: 'lz', lv: 1, ammo: 2, max: 10 };
  Z.take(b, { t: 'item', k: 'w', w: 'lz', x: 0, y: 0 });
  ok(b.wpn.lv === 2 && b.wpn.ammo === Z.ammoOf(b, 'lz'), '같은 무기 → Lv.2 · 탄약 다시 가득');
  Z.take(b, { t: 'item', k: 'w', w: 'lz' }); Z.take(b, { t: 'item', k: 'w', w: 'lz' });
  ok(b.wpn.lv === 3, 'Lv.3 까지만');
  Z.take(b, { t: 'item', k: 'w', w: 'rk' });
  ok(b.wpn.id === 'rk' && b.wpn.lv === 1, '다른 무기를 주우면 그 무기 Lv.1 로 바뀌어요');
}

console.log('▶ 방패병 · 뚱보 · 얼리기');
{
  const g = empty(5, { n: 20 });
  const s = Z.spawnZ(g, 'shield', 240, 300); s.lat = 0; s.sp = 0;
  const hp0 = s.hp, sh0 = s.sh;
  run(g, 0.5, { target: 240 });
  ok(s.hp === hp0 && s.sh < sh0, '소총 총알은 방패가 먼저 막아요 (체력 그대로)');
  const h = empty(5, { n: 20 }), s2 = Z.spawnZ(h, 'shield', 240, 300); s2.lat = 0; s2.sp = 0; s2.hp = s2.max = 1e5;
  h.wpn = { id: 'lz', lv: 1, ammo: 9, max: 9 };
  const sh2 = s2.sh;
  run(h, 0.5, { target: 240 });
  ok(s2.hp < 1e5 && s2.sh === sh2, '레이저는 방패를 무시하고 바로 들어가요');
  // 뚱보 연쇄 폭발
  const b = empty(6, { n: 20 });
  const bl = Z.spawnZ(b, 'bloater', 240, 330), near = [[195, 330], [285, 330], [200, 295], [280, 295]].map(([x, y]) => Z.spawnZ(b, 'walker', x, y));
  const far = Z.spawnZ(b, 'walker', 430, 330);
  [bl, ...near, far].forEach(z => { z.lat = 0; z.sp = -Z.ROAD_V; });                 // 제자리에 서 있게
  bl.hp = 0.01;
  run(b, 1, { target: 240 });
  ok(bl.dead && near.every(z => z.dead) && !far.dead, `뚱보가 터지면 주변 좀비 ${near.length}마리도 같이 (멀리 있는 좀비는 그대로)`);
  // 냉동포: 느려지고 얼어요
  const c = empty(7, { n: 20 }), w = Z.spawnZ(c, 'walker', 240, 200); w.hp = w.max = 1e5; w.lat = 0;
  c.wpn = { id: 'cr', lv: 2, ammo: 9, max: 9 };
  let froze = false;
  for (let t = 0; t < 1.5; t += DT) { Z.step(c, DT, { target: 240 }); if (w.frz > 0) froze = true; }
  ok(w.slow > 0 && froze, '냉동포에 맞으면 느려지고, 여러 번 맞으면 얼어요');
}

console.log('▶ 피하기 (산성 침 · 러너 돌진 · 보스)');
{
  const stay = empty(8, { n: 30 }), move = empty(8, { n: 30 });
  for (const g of [stay, move]) g.acid.push({ x0: 240, y0: 200, x: 240, y: Z.SQ_Y, t: 0, T: 0.95, r: 30, dmg: 3 });
  run(stay, 1.2, { target: 240 }); run(move, 1.2, { target: 400 });
  ok(stay.n < 30 && move.n === 30, `초록 원에 그대로 있으면 병사를 잃고 (${30 - stay.n}명), 피하면 그대로`);
  // 러너: 멈칫했다가 그 자리로 돌진 → 옆으로 피하면 지나가요
  const r1 = empty(9, { n: 20 }), r2 = empty(9, { n: 20 });
  for (const g of [r1, r2]) { g.x = 240; const z = Z.spawnZ(g, 'runner', 240, 220); z.hp = z.max = 1e6; }
  let locked = false;
  for (let t = 0; t < 2.5; t += DT) { Z.step(r1, DT, { target: 240 }); }
  for (let t = 0; t < 2.5; t += DT) { Z.step(r2, DT, { target: r2.objs.some(o => o.lock) ? 420 : 240 }); if (r2.objs.some(o => o.lock)) locked = true; }
  ok(locked && r1.n < 20 && r2.n === 20, '러너는 돌진할 곳을 정한 뒤 달려와요 → 가만히 있으면 물리고, 옆으로 피하면 비껴가요');
  // 보스: 내려찍기 · 돌진은 지금 병력의 비율만큼
  const b = empty(10, { n: 50 }); Z.spawnZ; b.dist = b.length; run(b, 0.05, { target: 240 });
  ok(b.phase === 'boss' && b.boss && b.objs.every(o => o.t !== 'gate' && o.t !== 'crate'), '길 끝 → 보스 등장 (남은 게이트 · 상자는 치워요)');
  b.boss.y = 150; b.boss.st = 'idle'; b.boss.hp = b.boss.max = 1e9; b.boss.cd = 99;
  b.marks.push({ k: 'slam', x: 240, y: Z.SQ_Y, r: 64, t: 0, T: 0.5 });
  run(b, 0.6, { target: 240 });
  const lost = 50 - b.n;
  ok(lost >= Math.round(50 * 0.16) - 1, `내려찍기에 맞으면 병력의 16% (−${lost})`);
  const n1 = b.n;
  b.boss.lane = 240; b.boss.st = 'tele'; b.boss.at = 0.3;
  run(b, 1.6, { target: 240 });
  ok(b.n < n1 && b.boss.st !== 'charge', `돌진 길에 있으면 크게 잃어요 (−${n1 - b.n})`);
  // 보스는 다가와서 물어요
  const c = empty(11, { n: 40 }); c.dist = c.length; run(c, 0.05, {});
  c.boss.hp = c.boss.max = 1e9; c.boss.cd = 999; c.boss.st = 'idle'; c.boss.y = 150; c.boss.home = 150;
  run(c, 50, { target: 60 });
  const mid = c.n;
  run(c, 30, { target: 60 });
  ok(c.boss.y > 400 && (c.n < mid || c.over), `보스는 조금씩 다가와서 (y ${Math.round(c.boss.y)}) 부대 앞에서 병사를 물어 가요`);
}

console.log('▶ 보스 처치 → 강화 고르기 → 다음 스테이지');
{
  const g = empty(12, { n: 30 }); g.dist = g.length;
  run(g, 0.05, {});
  const s0 = g.score;
  Object.assign(g.boss, { hp: 1, y: 150, st: 'idle', cd: 99 });
  run(g, 0.8, { target: g.boss.x });
  ok(g.phase === 'clear' && g.score >= s0 + 1000, `보스를 쓰러뜨리면 스테이지 보너스 (+${g.score - s0})`);
  run(g, 3, {});
  ok(g.phase === 'perk' && g.offer.length === 3 && new Set(g.offer).size === 3, `강화 3개 중 하나 (${g.offer.map(id => Z.PERK[id].name).join(' · ')})`);
  ok(!Z.pick(g, 'nope'), '목록에 없는 강화는 못 골라요');
  const want = g.offer[0], cap0 = g.cap, n0 = g.n;
  Z.pick(g, want);
  ok(g.phase === 'run' && g.stage === 2 && g.pk[want] === 1, `「${Z.PERK[want].name}」 → 2스테이지`);
  const h = empty(13, { n: 20 }); h.phase = 'perk'; h.offer = ['cap', 'heal', 'dmg'];
  Z.pick(h, 'cap');
  ok(h.cap === 65 && h.n === 26, '부대 확장: 최대 병력 +15 · 지금 +6');
  const p1 = Z.power(h); h.pk.dmg = 2; ok(Math.abs(Z.power(h) / p1 - 1.5) < 1e-9, '화력 강화 2번 = 피해 ×1.5');
  void cap0; void n0;
  const all = Z.PERKS.every(p => p.max >= 1 && p.name && p.d && p.ic);
  ok(all && Z.PERKS.length >= 10, `강화 ${Z.PERKS.length}가지`);
}

console.log('▶ 게이트 · 정원 · 콤보 · 수류탄');
{
  const g = empty(14, { n: 20 });
  g.objs.push({ t: 'gate', id: 901, pair: 1, x: 128, y: Z.SQ_Y - 30, w: 194, op: '×', v: 2 }, { t: 'gate', id: 902, pair: 1, x: 352, y: Z.SQ_Y - 30, w: 194, op: '−', v: 9 });
  run(g, 0.5, { target: 100 });
  ok(g.n === 40 && !g.objs.some(o => o.t === 'gate'), '×2 게이트를 지나면 병력 2배, 옆 게이트는 사라져요');
  g.objs.push({ t: 'gate', id: 903, pair: 2, x: 128, y: Z.SQ_Y - 30, w: 194, op: '+', v: 30 }, { t: 'gate', id: 904, pair: 2, x: 352, y: Z.SQ_Y - 30, w: 194, op: '+', v: 1 });
  const sc = g.score;
  run(g, 0.5, { target: 100 });
  ok(g.n === g.cap && g.score > sc, `최대 병력(${g.cap})을 넘친 병사는 점수로 (+${g.score - sc})`);
  const gap = empty(15, { n: 10 });
  gap.objs.push({ t: 'gate', id: 905, pair: 3, x: 128, y: Z.SQ_Y - 30, w: 194, op: '−', v: 9 }, { t: 'gate', id: 906, pair: 3, x: 352, y: Z.SQ_Y - 30, w: 194, op: '−', v: 9 });
  run(gap, 0.5, { target: 240 });
  ok(gap.n === 10, '빨간 게이트 둘이면 가운데 틈으로 빠져나가요');
  // 콤보
  const c = empty(16, { n: 40 });
  for (let i = 0; i < 12; i++) { const z = Z.spawnZ(c, 'walker', 240, 420 - i * 22); z.lat = 0; z.sp = -Z.ROAD_V; }
  run(c, 4, { target: 240 });
  ok(c.bestCombo >= 6 && c.score > c.kills * 10, `이어서 잡으면 콤보 → 점수 배율 (최고 ${c.bestCombo} · ×${Z.mult({ combo: c.bestCombo }).toFixed(1)} · ${c.kills}마리 ${c.score}점)`);
  c.combo = 9; Z.hurt(c, 1, 'test');
  ok(c.combo === 0, '병사를 잃으면 콤보가 끊겨요');
  // 수류탄: 가장 많이 모인 곳에
  const n = empty(17, { n: 5 });
  const pack = Array.from({ length: 6 }, (_, i) => Z.spawnZ(n, 'walker', 100 + (i % 3) * 20, 300 + Math.floor(i / 3) * 20));
  const lone = Z.spawnZ(n, 'walker', 400, 300);
  [...pack, lone].forEach(z => { z.sp = 0; z.lat = 0; });
  const k0 = n.nades;
  run(n, 0.05, { target: 400, nade: true });
  run(n, 0.7, { target: 400 });
  ok(n.nades === k0 - 1 && pack.every(z => z.dead) && !lone.dead, '수류탄은 좀비가 가장 많이 모인 곳에 떨어져요');
  ok(!Z.throwNade(Object.assign(empty(18), { nades: 0 })), '수류탄이 없으면 못 던져요');
}

console.log('▶ 아이템은 부대가 직접 닿아야 주워요');
{
  const g = empty(19, { n: 20 });
  g.objs.push({ t: 'item', id: 951, k: 'men', v: 7, x: 400, y: Z.SQ_Y - 200, bob: 0 });
  run(g, 2.5, { target: 100 });
  ok(g.n === 20, '피하면 못 주워요');
  g.objs.push({ t: 'item', id: 952, k: 'men', v: 7, x: 100, y: Z.SQ_Y - 200, bob: 0 });
  run(g, 2.5, { target: 100 });
  ok(g.n === 27, '닿으면 지원군 +7');
  const c = empty(20, { n: 20 });
  c.objs.push({ t: 'crate', id: 953, k: 'wpn', w: 'ts', x: 240, y: 200, hp: 5, max: 5, r: 20, flash: 0 });
  run(c, 4, { target: 240 });
  ok(c.wpn && c.wpn.id === 'ts', '상자를 쏴서 부수면 무기가 떨어지고, 지나가며 주워요');
}

console.log(fails ? `\n❌ ${fails}개 실패` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
