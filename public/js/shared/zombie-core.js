/* =====================================================================
 *  🧟 좀비 웨이브 규칙 (v13.5 새로 만듦) — 그리기 · 조작은 js/zombie.js, 검사는 tests/zombie.test.js
 *  · 부대(병사 수 = 체력)가 길을 따라 올라가며 저절로 쏴요. 게이트로 병사를 불리고, 상자를 부숴 특수 무기 · 수류탄 · 지원군을 얻어요.
 *  · 특수 무기 7가지 (기관총 · 산탄총 · 레이저 · 로켓 · 화염방사기 · 테슬라 · 냉동포): 탄약(초)이 다 떨어지면 소총으로 돌아와요.
 *    같은 무기를 또 먹으면 Lv.3 까지 강해지고 탄약이 다시 차요.
 *  · 좀비 7종이 스테이지마다 하나씩 새로 나와요 (러너 · 침쟁이 · 브루트 · 뚱보 · 방패병 · 비명꾼). 스테이지 끝 보스 3종은 공격 예고를 보고 피해요.
 *  · 보스를 쓰러뜨리면 강화 3개 중 하나를 골라요.
 *  · 실력이 있어야 오래가요: 좀비 체력은 스테이지마다 1.2배(지수)씩 늘지만, 화력은 병사 수의 제곱근만큼만 커지고 최대 병력도 정해져 있어요.
 *    (예전처럼 병사만 불리면 끝없이 버티던 판이 없어요)
 *  · 점수: 처치 점수 × 콤보 배율(최대 ×5, 맞으면 끊겨요) + 스테이지 보너스(빨리 잡기 · 무피해). 기록 = 점수.
 *  · 같은 씨앗(seed)과 같은 조작이면 같은 판이에요 (Math.random 을 쓰지 않아요).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 480, H = 720, SQ_Y = 610, ROAD_L = 36, ROAD_R = 444, ROAD_V = 120, STEP = 1 / 60;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const d2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /** 스테이지 배율 — 좀비 체력은 지수로 (1.2배씩), 점수는 조금씩 */
  const hpMul = s => Math.pow(1.16, s - 1);
  const ptMul = s => 1 + 0.15 * (s - 1);

  const ZOMBIES = {
    walker: { name: '좀비', hp: 7, r: 11, sp: 26, lat: 34, dmg: 1, pts: 10, tip: '' },
    runner: { name: '러너', hp: 4, r: 10, sp: 64, lat: 0, dmg: 1, pts: 15, tip: '멈칫한 뒤 내 쪽으로 돌진해요 · 옆으로 피하세요' },
    spitter: { name: '침쟁이', hp: 9, r: 12, sp: 24, lat: 10, dmg: 1, pts: 25, tip: '멀리서 산성 침을 뱉어요 · 초록 표시를 피하세요' },
    brute: { name: '브루트', hp: 44, r: 20, sp: 15, lat: 20, dmg: 4, pts: 60, tip: '아주 단단해요 · 닿으면 병사를 많이 잃어요' },
    bloater: { name: '뚱보', hp: 16, r: 17, sp: 18, lat: 24, dmg: 5, pts: 40, tip: '쓰러지면 터져서 주변 좀비까지 날려요 · 가까이서 터지면 아파요' },
    shield: { name: '방패병', hp: 10, sh: 20, r: 13, sp: 22, lat: 30, dmg: 2, pts: 50, tip: '방패가 총알을 막아요 · 폭발 · 불 · 레이저 · 번개는 그냥 들어가요' },
    screamer: { name: '비명꾼', hp: 12, r: 11, sp: 22, lat: 10, dmg: 1, pts: 40, tip: '소리를 질러 주변 좀비를 빠르게 만들어요 · 먼저 잡으세요' },
  };
  const FROM = { runner: 2, spitter: 2, brute: 3, bloater: 4, shield: 5, screamer: 6 };   // 처음 나오는 스테이지
  const BOSSES = {
    king: { name: '거대 좀비 왕', acts: ['slam', 'charge', 'summon'], more: ['volley'] },
    queen: { name: '산성 여왕', acts: ['volley', 'spawnSpit', 'slam'], more: ['charge'] },
    necro: { name: '울부짖는 군주', acts: ['summon', 'scream', 'volley', 'charge'], more: ['slam'] },
  };
  const BOSS_R = 46, LANE_W = 84;
  /** 특수 무기 — ammo: 쏠 수 있는 시간(초) */
  const WEAPONS = {
    rifle: { name: '소총', ch: '총', col: '#ffd36b', desc: '기본 총 · 탄약 무한' },
    mg: { name: '기관총', ch: '기', col: '#ffb347', ammo: 14, desc: '아주 빠르게 쏴요' },
    sg: { name: '산탄총', ch: '산', col: '#ff8a5c', ammo: 12, desc: '가까이 넓게 · 밀쳐 내요' },
    lz: { name: '레이저', ch: '레', col: '#5ce1ff', ammo: 10, desc: '한 줄을 모두 꿰뚫어요 · 방패 무시' },
    rk: { name: '로켓', ch: '로', col: '#ff5d73', ammo: 11, desc: '따라가서 넓게 터져요' },
    fl: { name: '화염방사기', ch: '화', col: '#ff7b2e', ammo: 10, desc: '앞쪽을 태워요 · 방패 무시' },
    ts: { name: '테슬라', ch: '번', col: '#b388ff', ammo: 12, desc: '번개가 여러 마리로 튀어요' },
    cr: { name: '냉동포', ch: '냉', col: '#9fe8ff', ammo: 13, desc: '느리게 · 얼려요' },
  };
  const SPECIAL = ['mg', 'sg', 'lz', 'rk', 'fl', 'ts', 'cr'];
  const PERKS = [
    { id: 'dmg', ic: '🔫', name: '화력 강화', d: '모든 무기 피해 +25%', max: 6 },
    { id: 'rate', ic: '⚡', name: '빠른 손', d: '연사 속도 +15%', max: 4 },
    { id: 'pierce', ic: '🎯', name: '철갑탄', d: '소총 총알이 1마리 더 뚫어요', max: 3 },
    { id: 'cap', ic: '🪖', name: '부대 확장', d: '최대 병력 +15 · 지금 +6명', max: 3 },
    { id: 'heal', ic: '💊', name: '지원군', d: '병사 +15명', max: 99 },
    { id: 'nade', ic: '💣', name: '수류탄 가방', d: '수류탄 +2 · 최대 +1개', max: 3 },
    { id: 'ammo', ic: '🔋', name: '탄약 벨트', d: '특수 무기 탄약 +40%', max: 3 },
    { id: 'armor', ic: '🛡️', name: '방탄복', d: '받는 피해 −20%', max: 2 },
    { id: 'combo', ic: '⏱️', name: '집중력', d: '콤보 유지 시간 +0.7초', max: 2 },
    { id: 'magnet', ic: '🧲', name: '자석', d: '아이템을 멀리서도 주워요', max: 1 },
    { id: 'lucky', ic: '🍀', name: '보급 운', d: '보급 상자가 더 자주 나와요', max: 2 },
  ];
  const PERK = Object.fromEntries(PERKS.map(p => [p.id, p]));

  /* ───────── 계산 도우미 ───────── */
  const radius = g => 16 + Math.sqrt(Math.min(g.n, 120)) * 3.2;                       // 부대 크기 (병사가 많으면 피하기 어려워요)
  const power = g => 18 * Math.sqrt(Math.max(1, g.n) / 10) * (1 + 0.25 * (g.pk.dmg || 0));   // 1초 화력의 기준
  const rateOf = g => 1 + 0.15 * (g.pk.rate || 0);
  const comboWin = g => 2 + 0.7 * (g.pk.combo || 0);
  const mult = g => 1 + Math.min(40, g.combo) * 0.1;                                 // 콤보 배율 (최대 ×5)
  const ammoOf = (g, id) => WEAPONS[id].ammo * (1 + 0.4 * (g.pk.ammo || 0));
  const hitR = o => (o.t === 'boss' ? BOSS_R : o.r);
  const target = o => !o.dead && (o.t === 'z' || o.t === 'crate' || o.t === 'boss');
  const nadeDmg = g => 70 * Math.pow(hpMul(g.stage), 0.9);

  function create(seed, o = {}) {
    const g = {
      seed: seed >>> 0, R: rng(seed), t: 0, uid: 0, stage: o.stage || 1, phase: 'run', over: false,
      x: W / 2, n: o.n || 12, cap: 50, wpn: null, fireT: 0, beam: null, flame: null,
      nades: 2, nadeMax: 3, nadeCd: 0, pk: {}, score: 0, kills: 0, combo: 0, lastKill: -99, bestCombo: 0, gold: 0,
      objs: [], shots: [], acid: [], marks: [], flying: [], bolts: [], ev: [], seen: { walker: 1 },
      lost: 0, bossT: 0, clearT: 0, offer: null, boss: null, dist: 0, length: 1, script: [], stats: { taken: 0, crates: 0, nades: 0 },
    };
    newStage(g);
    return g;
  }

  /** 스테이지 길 만들기: 게이트 · 좀비 떼 · 보급 상자 순서 (거리 px) */
  function newStage(g) {
    const s = g.stage, R = g.R;
    Object.assign(g, { phase: 'run', dist: 0, length: Math.min(7000, 2400 + 420 * s), boss: null, bossT: 0, lost: 0, clearT: 0,
      objs: g.objs.filter(o => o.t === 'item' && !o.dead), shots: [], acid: [], marks: [], flying: [], bolts: [] });
    const sc = [{ d: 360, k: 'gate' }], gap = Math.max(200, 300 - 8 * s), lucky = 0.15 + 0.06 * (g.pk.lucky || 0);
    let last = 'gate';
    for (let d = 640; d < g.length - 220; d += gap + R() * 110) {
      const r = R();
      const k = last !== 'gate' && r < 0.27 ? 'gate' : last !== 'crate' && r < 0.27 + lucky ? 'crate' : 'horde';
      sc.push({ d, k }); last = k;
    }
    g.script = sc;
  }

  function spawnZ(g, kind, x, y) {
    const b = ZOMBIES[kind], m = hpMul(g.stage), s = g.stage, R = g.R;
    const heavy = kind === 'brute' || kind === 'bloater';
    const z = { t: 'z', id: ++g.uid, k: kind, x: clamp(x, ROAD_L + 14, ROAD_R - 14), y, hp: b.hp * m, max: b.hp * m, sh: (b.sh || 0) * m, shMax: (b.sh || 0) * m, r: b.r,
      sp: b.sp * (1 + 0.03 * Math.min(s - 1, 15)) * (0.85 + R() * 0.3), lat: b.lat, dmg: b.dmg + Math.floor((s - 1) / 3) * (heavy ? 2 : 1), pts: b.pts,
      wob: R() * 6, slow: 0, chill: 0, frz: 0, haste: 0, burn: 0, burnD: 0, cd: 0.8 + R() * 1.2, hold: 0, held: false, stopY: 0, lock: null, wind: 0, flash: 0 };
    if (kind === 'spitter') z.stopY = 140 + R() * 120;
    if (kind === 'screamer') z.stopY = 170 + R() * 90;
    if (!g.seen[kind]) { g.seen[kind] = 1; g.ev.push({ t: 'new', k: kind }); }
    g.objs.push(z);
    return z;
  }

  function horde(g) {
    const s = g.stage, R = g.R, kinds = [];
    const k = Math.round(5 + 1.2 * s + R() * 3), cx = 80 + R() * (W - 160);
    for (let i = 0; i < k; i++) {
      const r = R();
      kinds.push(s >= FROM.runner && r < 0.1 + 0.01 * s ? 'runner' : s >= FROM.shield && r < 0.16 + 0.018 * s ? 'shield' : 'walker');
    }
    if (s >= FROM.spitter && R() < 0.4 + 0.03 * s) kinds.push('spitter');
    if (s >= 7 && R() < 0.35) kinds.push('spitter');
    if (s >= FROM.brute && R() < 0.45 + 0.04 * s) kinds.push('brute');
    if (s >= 8 && R() < 0.4) kinds.push('brute');
    if (s >= FROM.bloater && R() < 0.4 + 0.03 * s) kinds.push('bloater');
    if (s >= FROM.screamer && R() < 0.3 + 0.025 * s) kinds.push('screamer');
    kinds.forEach((kind, i) => spawnZ(g, kind, cx + ((i % 5) - 2) * 26 + (R() - 0.5) * 10, -30 - Math.floor(i / 5) * 30));
  }

  function gates(g) {
    const s = g.stage, R = g.R, pair = ++g.uid;
    const good = () => (R() < 0.14 && g.n <= g.cap * 0.4 ? { op: '×', v: 2 } : { op: '+', v: 3 + Math.floor(R() * 5) + Math.floor(s / 2) });
    const bad = () => (R() < 0.25 && g.n >= 12 ? { op: '÷', v: 2 } : { op: '−', v: 3 + Math.floor(R() * 4) + s });
    const r = R();
    const two = r < 0.68 ? (R() < 0.5 ? [good(), bad()] : [bad(), good()]) : r < 0.9 ? [good(), good()] : [bad(), bad()];
    two.forEach((q, i) => g.objs.push({ t: 'gate', id: ++g.uid, pair, x: i ? W * 0.75 - 8 : W * 0.25 + 8, y: -40, w: W / 2 - 46, ...q }));
  }

  function crate(g) {
    const s = g.stage, R = g.R, r = R();
    const k = r < 0.55 ? 'wpn' : r < 0.9 ? 'sup' : 'gold';
    const hp = (k === 'gold' ? 34 : 24) * (1 + 0.45 * (s - 1));
    const c = { t: 'crate', id: ++g.uid, k, x: 70 + R() * (W - 140), y: -40, hp, max: hp, r: 20, flash: 0 };
    if (k === 'wpn') c.w = SPECIAL[Math.floor(R() * SPECIAL.length)];
    if (k === 'sup') c.sup = R() < 0.6 ? 'men' : 'nade';
    g.objs.push(c);
  }

  function spawnBoss(g) {
    const s = g.stage, k = ['king', 'queen', 'necro'][(s - 1) % 3], hp = 160 * hpMul(s) * (1 + 0.05 * (s - 1));
    g.boss = { t: 'boss', id: ++g.uid, k, x: W / 2, y: -70, home: 150, hp, max: hp, st: 'enter', cd: 1.6, at: 0, lane: 0, i: 0, slow: 0, flash: 0, bite: 0 };
    for (const o of g.objs) if (o.t === 'gate' || o.t === 'crate') o.dead = true;          // 보스전엔 길이 멈추니 남은 게이트 · 상자는 치워요
    g.objs.push(g.boss);
    g.phase = 'boss'; g.bossT = 0;
    g.ev.push({ t: 'boss', k });
  }

  /* ───────── 피해 · 처치 ───────── */
  function hurt(g, k, why) {
    if (g.over || k <= 0) return 0;
    k = Math.min(g.n, Math.max(1, Math.round(k * (1 - 0.2 * (g.pk.armor || 0)))));
    g.n -= k; g.lost += k; g.stats.taken += k; g.combo = 0;
    g.ev.push({ t: 'hurt', k, why });
    if (g.n <= 0) end(g);
    return k;
  }
  function end(g) { g.n = 0; g.over = true; g.phase = 'over'; g.beam = g.flame = null; g.ev.push({ t: 'over' }); }

  /** how: 'b' = 총알 (방패에 막혀요) · 'x' = 폭발 · 불 · 레이저 · 번개 (방패 무시) */
  function dmg(g, o, d, how, beam) {
    if (o.dead || d <= 0) return;
    if (beam) o.zap = 0.08; else o.flash = 0.06;                                    // 레이저 · 불처럼 계속 닿는 피해는 하얗게 깜빡이지 않게
    if (o.t === 'crate') { o.hp -= d; if (o.hp <= 0) openCrate(g, o); return; }
    if (o.t === 'boss') { o.hp -= d; if (o.hp <= 0) bossDown(g); return; }
    if (how === 'b' && o.sh > 0) { o.sh -= d; if (o.sh <= 0) { o.sh = 0; g.ev.push({ t: 'shbreak', x: o.x, y: o.y }); } return; }
    o.hp -= d;
    if (o.hp <= 0) kill(g, o);
  }
  function kill(g, z, half) {
    z.dead = true; g.kills++;
    if (!half) {
      g.combo = g.t - g.lastKill <= comboWin(g) ? g.combo + 1 : 1; g.lastKill = g.t;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
    }
    const pts = Math.round(z.pts * ptMul(g.stage) * (half ? 0.5 : mult(g)) * (g.gold > 0 ? 2 : 1));
    g.score += pts;
    g.ev.push({ t: 'kill', k: z.k, x: z.x, y: z.y, r: z.r, pts, big: z.pts >= 40 });
    if (z.k === 'bloater' && !half) blast(g, z.x, z.y, 85, 40 * hpMul(g.stage), 'bloat');
  }
  /** 폭발 (로켓 · 수류탄 · 뚱보) — 좀비 · 상자 · 보스 모두에게 (방패 무시). 뚱보가 부대 가까이서 터지면 병사도 잃어요 */
  function blast(g, x, y, r, d, kind) {
    g.ev.push({ t: 'boom', x, y, r, kind });
    for (const o of g.objs) {
      if (!target(o)) continue;
      const rr = r + hitR(o);
      if (d2(o.x, o.y, x, y) < rr * rr) {
        dmg(g, o, d, 'x');
        if (o.t === 'z' && !o.dead && o.k !== 'brute') o.y -= 14;                     // 살짝 밀려나요
      }
    }
    if (kind === 'bloat' && !g.over) { const rr = r * 0.8 + radius(g) * 0.5; if (d2(g.x, SQ_Y, x, y) < rr * rr) hurt(g, 3 + Math.floor(g.stage / 3), 'boom'); }
  }
  function addMen(g, v) {
    const before = g.n;
    let n = g.n + v, extra = 0;
    if (n > g.cap) { extra = n - g.cap; n = g.cap; g.score += Math.round(extra * 25 * ptMul(g.stage)); }
    g.n = n;
    return { d: n - before, extra };
  }

  function openCrate(g, c) {
    c.dead = true; g.stats.crates++;
    const it = { t: 'item', id: ++g.uid, x: c.x, y: c.y, k: c.k === 'wpn' ? 'w' : c.k === 'gold' ? 'gold' : c.sup, w: c.w, v: c.sup === 'men' ? 5 + g.stage : 1, bob: 0 };
    g.objs.push(it);
    g.ev.push({ t: 'open', x: c.x, y: c.y, k: it.k, w: it.w });
  }
  function take(g, it) {
    it.dead = true;
    let lv = 0, d = 0, extra = 0;
    if (it.k === 'w') {
      if (g.wpn && g.wpn.id === it.w) { g.wpn.lv = Math.min(3, g.wpn.lv + 1); g.wpn.max = g.wpn.ammo = ammoOf(g, it.w); }
      else g.wpn = { id: it.w, lv: 1, ammo: ammoOf(g, it.w), max: ammoOf(g, it.w) };
      lv = g.wpn.lv; g.fireT = 0;
    } else if (it.k === 'men') ({ d, extra } = addMen(g, it.v));
    else if (it.k === 'nade') { if (g.nades < g.nadeMax) g.nades++; else g.score += Math.round(150 * ptMul(g.stage)); }
    else if (it.k === 'gold') g.gold = 12;
    g.ev.push({ t: 'take', k: it.k, w: it.w, lv, d, extra, x: it.x, y: it.y });
  }

  function passGate(g, o) {
    for (const q of g.objs) if (q.t === 'gate' && q.pair === o.pair) q.dead = true;
    const before = g.n;
    let n = g.n, extra = 0;
    if (o.op === '+') n += o.v; else if (o.op === '−') n -= o.v; else if (o.op === '×') n *= o.v; else if (o.op === '÷') n = Math.ceil(n / o.v);
    if (n >= before) extra = addMen(g, n - before).extra;
    else { g.n = Math.max(0, n); g.lost += before - g.n; g.stats.taken += before - g.n; }
    g.ev.push({ t: 'gate', d: g.n - before, extra, op: o.op, v: o.v });
    if (g.n <= 0) end(g);
  }

  /* ───────── 보스 ───────── */
  function bossDown(g) {
    const b = g.boss, s = g.stage;
    b.dead = true; g.boss = null; g.kills++;
    for (const o of g.objs) if (o.t === 'z' && !o.dead) kill(g, o, true);              // 남은 졸개는 반 점수로 정리
    const clear = 1000 * s, fast = Math.max(0, Math.round((40 - g.bossT) * 30 * s)), perfect = g.lost === 0 ? 800 * s : 0;
    g.score += Math.round((clear + fast + perfect) * (g.gold > 0 ? 2 : 1));
    g.acid = []; g.marks = []; g.flying = [];
    g.phase = 'clear'; g.clearT = 2.2; g.beam = g.flame = null;
    g.ev.push({ t: 'clear', stage: s, clear, fast, perfect, x: b.x, y: b.y, k: b.k });
  }
  function startAct(g, b) {
    const s = g.stage, R = g.R, B = BOSSES[b.k], acts = s >= 4 ? B.acts.concat(B.more) : B.acts;
    const a = acts[(b.i++ + (R() < 0.3 ? 1 : 0)) % acts.length];
    const T = Math.max(0.72, 1.1 - 0.03 * (s - 1));
    if (a === 'slam') { g.marks.push({ k: 'slam', x: g.x, y: SQ_Y, r: 62 + 3 * Math.min(s, 12), t: 0, T }); b.st = 'cast'; b.at = T + 0.2; }
    else if (a === 'charge') { b.lane = clamp(g.x, ROAD_L + LANE_W / 2, ROAD_R - LANE_W / 2); g.marks.push({ k: 'lane', x: b.lane, w: LANE_W, t: 0, T }); b.st = 'tele'; b.at = T; }
    else if (a === 'volley') {
      const c = 3 + Math.min(4, Math.floor(s / 3));
      for (let i = 0; i < c; i++) {
        const x = i < 3 ? g.x + (i - 1) * 95 + (R() - 0.5) * 20 : ROAD_L + 20 + R() * (ROAD_R - ROAD_L - 40);   // 3개는 나를 노리고, 나머지는 아무 데나
        g.acid.push({ x0: b.x, y0: b.y + 20, x: clamp(x, ROAD_L + 12, ROAD_R - 12), y: SQ_Y, t: -i * 0.08, T: 1.05, r: 32, dmg: 2 + Math.floor(s / 3), boss: 1 });
      }
      b.st = 'cast'; b.at = 0.7;
    } else if (a === 'summon') {
      const c = 3 + Math.min(8, s);
      for (let i = 0; i < c; i++) spawnZ(g, s >= 2 && i % 3 === 2 ? 'runner' : 'walker', b.x + (i - (c - 1) / 2) * 28, b.y + 36 + (i % 2) * 14);
      b.st = 'cast'; b.at = 0.7;
    } else if (a === 'spawnSpit') {
      for (let i = 0; i < 2; i++) spawnZ(g, 'spitter', b.x + (i ? 70 : -70), b.y + 30);
      for (let i = 0; i < 2 + Math.floor(s / 4); i++) spawnZ(g, 'walker', b.x + (i - 1) * 30, b.y + 50);
      b.st = 'cast'; b.at = 0.6;
    } else if (a === 'scream') {
      for (const o of g.objs) if (o.t === 'z' && !o.dead) o.haste = 3.5;
      for (let i = 0; i < 2 + Math.floor(s / 4); i++) spawnZ(g, 'runner', b.x + (i - 1) * 40, b.y + 40);
      b.st = 'cast'; b.at = 0.8;
    }
    g.ev.push({ t: 'act', a, k: b.k });
  }
  /** 보스는 조금씩 다가와요 (약 1분이면 부대 앞) — 부대 앞까지 오면 병사를 계속 물어 가요 → 오래 끌 수 없어요 */
  const BITE_Y = SQ_Y - 84;
  function updBoss(g, b, dt) {
    const s = g.stage, cdBase = Math.max(1.15, 2.7 - 0.09 * (s - 1)) * (g.bossT > 40 ? 0.6 : 1);   // 40초가 지나면 화가 나서 더 자주
    const f = b.slow > 0 ? 0.7 : 1;
    b.slow = Math.max(0, b.slow - dt); b.flash = Math.max(0, b.flash - dt);
    if (b.st !== 'enter') b.home = Math.min(BITE_Y, b.home + (5.5 + 0.4 * Math.min(s, 15)) * f * dt);
    if (b.st === 'idle' || b.st === 'cast') {
      b.y += clamp(b.home - b.y, -120 * dt, 120 * dt);
      if (b.y >= BITE_Y - 1 && (b.bite -= dt) <= 0) { b.bite = 0.5; hurt(g, Math.max(2, Math.round(g.n * 0.08)), 'boss'); }
    }
    if (b.st === 'enter') { b.y += 110 * dt; if (b.y >= 150) { b.y = 150; b.st = 'idle'; } }
    else if (b.st === 'idle') { b.x += clamp(g.x - b.x, -40 * dt, 40 * dt); if ((b.cd -= dt * f) <= 0) startAct(g, b); }
    else if (b.st === 'cast') { if ((b.at -= dt) <= 0) { b.st = 'idle'; b.cd = cdBase; } }
    else if (b.st === 'tele') { b.x += (b.lane - b.x) * Math.min(1, dt * 8); if ((b.at -= dt * f) <= 0) { b.st = 'charge'; b.x = b.lane; g.ev.push({ t: 'charge' }); } }
    else if (b.st === 'charge') {
      const y0 = b.y; b.y += 900 * dt;
      if (y0 < SQ_Y && b.y >= SQ_Y && Math.abs(g.x - b.lane) < LANE_W / 2 + radius(g) * 0.4) hurt(g, Math.max(4, Math.round(g.n * 0.22)), 'charge');
      if (b.y > H + 90) { b.y = -90; b.st = 'back'; }
    } else if (b.st === 'back') { b.y += 170 * dt; if (b.y >= b.home) { b.y = b.home; b.st = 'idle'; b.cd = cdBase; } }
  }

  /* ───────── 쏘기 ───────── */
  /** 로켓 · 테슬라가 노릴 적: 보스 > 가까운 큰 적 */
  function pickTarget(g) {
    if (g.boss && g.boss.y > 0) return g.boss;
    let best = null, bv = -1;
    for (const o of g.objs) {
      if (o.dead || o.t !== 'z' || o.y < 0 || o.y > SQ_Y - 20) continue;
      const v = o.hp + o.sh + o.y * 0.05 * o.max;
      if (v > bv) { bv = v; best = o; }
    }
    return best;
  }
  function fire(g, dt) {
    g.beam = g.flame = null;
    let w = g.wpn;
    if (w && w.ammo <= 0) { g.ev.push({ t: 'empty', w: w.id }); g.wpn = w = null; }
    if (w) w.ammo -= dt;
    const P = power(g), rt = rateOf(g), R = g.R, rad = radius(g), id = w ? w.id : 'rifle', lv = w ? w.lv : 1, Y = SQ_Y - 16;
    if (id === 'lz') {
      const half = [7, 10, 14][lv - 1], d = P * [1.7, 2.2, 2.8][lv - 1] * rt * dt;
      g.beam = { x: g.x, w: half * 2, lv };
      for (const o of g.objs) if (target(o) && o.y < SQ_Y && Math.abs(o.x - g.x) < half + hitR(o)) dmg(g, o, d, 'x', 1);
      return;
    }
    if (id === 'fl') {
      const range = [200, 230, 260][lv - 1], d = P * [2.2, 2.7, 3.3][lv - 1] * rt * dt;
      g.flame = { x: g.x, range, lv };
      for (const o of g.objs) {
        if (!target(o)) continue;
        const dx = o.x - g.x, dy = Y - o.y, r = hitR(o);
        if (dy < -r) continue;
        const L = Math.sqrt(dx * dx + dy * dy);
        if (L - r > range || Math.abs(dx) > 0.38 * Math.max(dy, 0) + r + 12) continue;
        dmg(g, o, d, 'x', 1);
        if (o.t === 'z' && !o.dead) { o.burn = 2; o.burnD = P * 0.4; }
      }
      return;
    }
    if ((g.fireT -= dt) > 0) return;
    if (g.fireT < -0.2) g.fireT = 0;
    if (id === 'rifle') {
      const iv = 0.12, k = clamp(1 + Math.floor(g.n / 6), 1, 10), d = P * iv / k, spread = Math.max(14, rad * 0.85);
      g.fireT += iv / rt;
      for (let i = 0; i < k; i++) g.shots.push({ k: 'b', x: g.x + (R() * 2 - 1) * spread, y: Y, vx: 0, vy: -820, dmg: d, pierce: g.pk.pierce || 0, life: 1.2 });
    } else if (id === 'mg') {
      const iv = 0.05, c = lv + 1, d = P * [1.9, 2.4, 3][lv - 1] * iv / c;
      g.fireT += iv / rt;
      for (let i = 0; i < c; i++) { const a = (R() - 0.5) * 0.12; g.shots.push({ k: 'b', x: g.x + (i - (c - 1) / 2) * 9, y: Y, vx: Math.sin(a) * 900, vy: -Math.cos(a) * 900, dmg: d, pierce: 0, life: 1 }); }
    } else if (id === 'sg') {
      const iv = 0.42, c = [7, 9, 12][lv - 1], d = P * [3.8, 4.6, 5.4][lv - 1] * iv / c, range = [280, 300, 320][lv - 1];
      g.fireT += iv / rt;
      for (let i = 0; i < c; i++) { const a = -0.3 + 0.6 * (i + 0.2 + R() * 0.6) / c; g.shots.push({ k: 'p', x: g.x, y: Y, vx: Math.sin(a) * 760, vy: -Math.cos(a) * 760, dmg: d, pierce: 0, life: range / 760, kb: 20 }); }
    } else if (id === 'rk') {
      const iv = [0.75, 0.65, 0.55][lv - 1], tg = pickTarget(g);
      g.fireT += iv / rt;
      g.shots.push({ k: 'rk', x: g.x, y: Y - 4, vx: (R() - 0.5) * 120, vy: -260, tg: tg ? tg.id : 0, dmg: P * [2, 2.3, 2.6][lv - 1] * iv, rad: [70, 80, 92][lv - 1], life: 1.8 });
    } else if (id === 'ts') {
      const iv = 0.3, n = [4, 6, 8][lv - 1], d = P * [1.6, 1.9, 2.3][lv - 1] * iv, hit = new Set(), pts = [[g.x, Y - 6]];
      g.fireT += iv / rt;
      let cx = g.x, cy = Y;
      for (let i = 0; i < n; i++) {
        let best = null, bd = (i ? 130 : 380) ** 2;
        for (const o of g.objs) if (!o.dead && (o.t === 'z' || o.t === 'boss') && !hit.has(o.id) && o.y < SQ_Y && o.y > -20) { const q = d2(o.x, o.y, cx, cy); if (q < bd) { bd = q; best = o; } }
        if (!best) break;
        hit.add(best.id); pts.push([best.x, best.y]); cx = best.x; cy = best.y;
        dmg(g, best, d, 'x');
      }
      if (pts.length > 1) g.bolts.push({ pts, t: 0.14 });
    } else if (id === 'cr') {
      const iv = 0.2, c = lv + 1, d = P * [1.3, 1.5, 1.8][lv - 1] * iv / c;
      g.fireT += iv / rt;
      for (let i = 0; i < c; i++) g.shots.push({ k: 'ice', x: g.x + (i - (c - 1) / 2) * 9, y: Y, vx: 0, vy: -700, dmg: d, pierce: 0, life: 1.3 });
    }
  }
  function chill(o) {
    if (o.t === 'boss') { o.slow = 2.5; return; }
    if (o.t !== 'z' || o.dead) return;
    o.slow = 2.5;
    if (++o.chill >= 4) { o.chill = 0; o.frz = 1.2; }
  }
  function rocketBoom(g, s) { s.dead = true; blast(g, s.x, s.y, s.rad, s.dmg, 'rk'); }
  function moveShots(g, dt) {
    const list = g.objs.filter(target).sort((a, b) => b.y - a.y);                // 가까운 적부터 맞아요
    for (const s of g.shots) {
      if (s.dead) continue;
      if ((s.life -= dt) <= 0) { if (s.k === 'rk') rocketBoom(g, s); s.dead = true; continue; }
      if (s.k === 'rk') {
        let tg = s.tg && list.find(o => o.id === s.tg && !o.dead);
        if (!tg) { const p = pickTarget(g); tg = p; s.tg = p ? p.id : 0; }
        const sp = Math.min(470, Math.hypot(s.vx, s.vy) + 900 * dt);
        let a = Math.atan2(s.vy, s.vx);
        if (tg) { const want = Math.atan2(tg.y - s.y, tg.x - s.x); let da = want - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; a += clamp(da, -5 * dt, 5 * dt); }
        s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
      }
      const y0 = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y < -40 || s.x < -30 || s.x > W + 30 || s.y > H + 30) { s.dead = true; continue; }
      for (const o of list) {
        if (o.dead) continue;
        const r = hitR(o) + (s.k === 'rk' ? 6 : 3);
        const hit = s.vx === 0 ? Math.abs(s.x - o.x) < r && o.y + r >= s.y && o.y - r <= y0 : d2(s.x, s.y, o.x, o.y) < r * r;
        if (!hit || (s.hit && s.hit.includes(o.id))) continue;
        if (s.k === 'rk') { rocketBoom(g, s); break; }
        const shielded = o.t === 'z' && o.sh > 0;
        dmg(g, o, s.dmg, 'b');
        if (s.k === 'ice') { chill(o); for (const q of list) if (q !== o && q.t === 'z' && !q.dead && d2(q.x, q.y, o.x, o.y) < 26 * 26) chill(q); }
        if (s.kb && o.t === 'z' && !o.dead && o.k !== 'brute') o.y -= s.kb;
        if (s.pierce > 0 && o.t === 'z' && !shielded) { s.pierce--; (s.hit || (s.hit = [])).push(o.id); continue; }
        s.dead = true; break;
      }
    }
    g.shots = g.shots.filter(s => !s.dead);
  }

  /* ───────── 수류탄 ───────── */
  function throwNade(g) {
    if (g.nades <= 0 || g.nadeCd > 0 || (g.phase !== 'run' && g.phase !== 'boss')) return false;
    const zs = g.objs.filter(o => o.t === 'z' && !o.dead && o.y > 60 && o.y < SQ_Y - 50);
    let best = null, bc = 0;
    for (const a of zs) {
      let c = 0;
      for (const b of zs) if (d2(a.x, a.y, b.x, b.y) < 95 * 95) c += b.k === 'bloater' ? 3 : b.k === 'brute' ? 2 : 1;
      if (c > bc) { bc = c; best = a; }
    }
    const T = 0.5;
    let tx, ty;
    if (best) { tx = best.x; ty = best.y + ((g.phase === 'run' ? ROAD_V : 0) + best.sp) * T; }
    else if (g.boss) { tx = g.boss.x; ty = g.boss.y; }
    else { tx = g.x; ty = SQ_Y - 260; }
    g.nades--; g.nadeCd = 0.5; g.stats.nades++;
    g.flying.push({ x0: g.x, y0: SQ_Y - 20, x: tx, y: Math.min(ty, SQ_Y - 70), t: 0, T });
    g.ev.push({ t: 'nade' });
    return true;
  }

  /* ───────── 한 걸음 ───────── */
  /** inp: { dir: -1 | 0 | 1 (키보드), target: x | null (끌기 · 마우스), nade: true (이번에 한 번) } */
  function step(g, dt, inp = {}) {
    if (g.phase === 'over' || g.phase === 'perk') return;
    if (inp.nade) { throwNade(g); inp.nade = false; }
    while (dt > 1e-6 && g.phase !== 'over' && g.phase !== 'perk') { const h = Math.min(STEP, dt); sub(g, h, inp); dt -= h; }
  }
  function sub(g, dt, inp) {
    g.t += dt;
    const lo = ROAD_L + 12, hi = ROAD_R - 12;
    let tx = inp.target != null ? inp.target : null;
    if (inp.dir) tx = g.x + inp.dir * 1000;
    if (tx != null) { const d = clamp(tx, lo, hi) - g.x, vmax = (inp.dir ? 430 : 620) * dt; g.x += clamp(d * Math.min(1, dt * 14), -vmax, vmax); }
    g.x = clamp(g.x, lo, hi);
    for (const b of g.bolts) b.t -= dt;
    g.bolts = g.bolts.filter(b => b.t > 0);
    if (g.phase === 'clear') {
      moveShots(g, dt);
      for (const o of g.objs) if (o.t === 'item' && !o.dead) moveItem(g, o, dt, 0);
      if ((g.clearT -= dt) <= 0) { g.phase = 'perk'; g.offer = offer(g); g.shots = []; g.ev.push({ t: 'perk' }); }
      return;
    }
    const road = g.phase === 'run' ? ROAD_V : 0, s = g.stage;
    if (g.phase === 'run') {
      g.dist += road * dt;
      while (g.script.length && g.script[0].d <= g.dist) { const e = g.script.shift(); if (e.k === 'gate') gates(g); else if (e.k === 'crate') crate(g); else horde(g); }
      if (g.dist >= g.length && !g.boss) spawnBoss(g);
    }
    if (g.boss) { g.bossT += dt; updBoss(g, g.boss, dt); }
    g.nadeCd = Math.max(0, g.nadeCd - dt); g.gold = Math.max(0, g.gold - dt);
    if (g.combo && g.t - g.lastKill > comboWin(g)) g.combo = 0;
    fire(g, dt);
    moveShots(g, dt);
    const rad = radius(g);
    for (const o of g.objs) {
      if (o.dead) continue;
      if (o.t === 'gate') { const y0 = o.y; o.y += road * dt; if (y0 < SQ_Y && o.y >= SQ_Y && Math.abs(g.x - o.x) < o.w / 2) passGate(g, o); }
      else if (o.t === 'crate') { o.y += road * dt; o.flash = Math.max(0, o.flash - dt); }
      else if (o.t === 'item') moveItem(g, o, dt, road);
      else if (o.t === 'z') moveZ(g, o, dt, road || 40, rad);                    // 보스전: 길은 멈춰도 좀비는 걸어와요
      if (o.t !== 'boss' && (o.y > H + 50 || o.x < -60 || o.x > W + 60)) o.dead = true;   // 보스는 돌진으로 화면 밖에 잠깐 나가요
      if (g.over) return;
    }
    for (const a of g.acid) {
      if ((a.t += dt) < a.T) continue;
      a.dead = true;
      g.ev.push({ t: 'splash', x: a.x, y: a.y, r: a.r });
      const rr = a.r + rad * 0.45;
      if (d2(a.x, a.y, g.x, SQ_Y) < rr * rr) hurt(g, a.dmg, 'acid');
    }
    for (const m of g.marks) {
      if ((m.t += dt) < m.T) continue;
      m.dead = true;
      if (m.k === 'slam') {
        g.ev.push({ t: 'slam', x: m.x, y: m.y, r: m.r });
        const rr = m.r + rad * 0.4;
        if (d2(m.x, m.y, g.x, SQ_Y) < rr * rr) hurt(g, Math.max(3, Math.round(g.n * 0.16)), 'slam');
      }
    }
    for (const f of g.flying) if ((f.t += dt) >= f.T) { f.dead = true; blast(g, f.x, f.y, 100, nadeDmg(g), 'nade'); }
    g.acid = g.acid.filter(a => !a.dead); g.marks = g.marks.filter(m => !m.dead); g.flying = g.flying.filter(f => !f.dead);
    g.objs = g.objs.filter(o => !o.dead);
    if (g.ev.length > 400) g.ev.splice(0, g.ev.length - 400);
    void s;
  }
  function moveItem(g, o, dt, road) {
    o.y += (road || 90) * dt; o.bob += dt;
    const reach = radius(g) + 16 + 50 * (g.pk.magnet || 0);
    if (d2(o.x, o.y, g.x, SQ_Y) < reach * reach) take(g, o);
  }
  function moveZ(g, z, dt, road, rad) {
    const s = g.stage;
    z.flash = Math.max(0, z.flash - dt); z.slow = Math.max(0, z.slow - dt); z.frz = Math.max(0, z.frz - dt); z.haste = Math.max(0, z.haste - dt);
    if (z.burn > 0) { z.burn -= dt; dmg(g, z, z.burnD * dt, 'x', 1); if (z.dead) return; }
    if (z.zap > 0) z.zap -= dt;
    const f = z.frz > 0 ? 0 : (z.slow > 0 ? 0.5 : 1) * (z.haste > 0 ? 1.6 : 1);
    z.wob += dt * (z.k === 'runner' ? 12 : 6) * Math.max(0.2, f);
    if (z.k === 'runner') {
      if (!z.lock && !z.wind && z.y > 230) { z.wind = 0.3; g.ev.push({ t: 'lock', id: z.id }); }
      if (z.wind > 0 && !z.lock) {
        z.y += road * dt;                                                    // 멈칫 (길만 따라 내려와요)
        if ((z.wind -= dt * Math.max(0.3, f)) <= 0) { const dx = g.x - z.x, dy = SQ_Y - z.y, L = Math.hypot(dx, dy) || 1, v = 250 + 6 * Math.min(s, 15); z.lock = { vx: dx / L * v, vy: dy / L * v }; z.wind = -1; }
      } else if (z.lock) { z.x += z.lock.vx * f * dt; z.y += z.lock.vy * f * dt; }
      else z.y += (road + z.sp * f) * dt;
    } else if (z.k === 'spitter' || z.k === 'screamer') {
      if (!z.held && z.y >= z.stopY) { z.held = true; z.hold = 8; }
      if (z.hold > 0) {
        z.hold -= dt;
        if ((z.cd -= dt * Math.max(0.3, f)) <= 0) {
          if (z.k === 'spitter') {
            z.cd = Math.max(1.3, 2.4 - 0.06 * (s - 1));
            g.acid.push({ x0: z.x, y0: z.y, x: clamp(g.x + (g.R() - 0.5) * 16, ROAD_L + 12, ROAD_R - 12), y: SQ_Y, t: 0, T: 0.95, r: 30, dmg: 2 + Math.floor(s / 3) });
            g.ev.push({ t: 'spit', x: z.x, y: z.y });
          } else {
            z.cd = 4.2;
            for (const o of g.objs) if (o.t === 'z' && !o.dead && o !== z && d2(o.x, o.y, z.x, z.y) < 170 * 170) o.haste = 3;
            g.ev.push({ t: 'scream', x: z.x, y: z.y });
          }
        }
      } else { z.y += (road + z.sp * f) * dt; if (z.y > 120) z.x += clamp(g.x - z.x, -z.lat * f * dt, z.lat * f * dt); }
    } else {
      z.y += (road + z.sp * f) * dt;
      const lat = z.lat * f * (1 + clamp((z.y - 380) / 230, 0, 1));            // 가까워질수록 더 바짝 쫓아와요 (막판에 옆으로 피하기 어렵게)
      if (z.y > 110) z.x += clamp(g.x - z.x, -lat * dt, lat * dt);
    }
    const rr = rad + z.r;
    if (d2(z.x, z.y, g.x, SQ_Y) < rr * rr) {                                  // 부대에 닿았어요
      z.dead = true;
      if (z.k === 'bloater') { g.ev.push({ t: 'boom', x: z.x, y: z.y, r: 70, kind: 'bloat' }); hurt(g, z.dmg, 'bloat'); }
      else { g.ev.push({ t: 'bite', x: z.x, y: z.y, k: z.k }); hurt(g, z.dmg, 'bite'); }
    }
  }

  /* ───────── 강화 고르기 ───────── */
  function offer(g) {
    const R = g.R, can = PERKS.filter(p => (g.pk[p.id] || 0) < p.max).map(p => p.id);
    for (let i = can.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [can[i], can[j]] = [can[j], can[i]]; }
    return can.slice(0, 3);
  }
  function pick(g, id) {
    if (g.phase !== 'perk' || !g.offer || !g.offer.includes(id)) return false;
    g.pk[id] = (g.pk[id] || 0) + 1;
    if (id === 'cap') { g.cap += 15; addMen(g, 6); }
    else if (id === 'heal') addMen(g, 15);
    else if (id === 'nade') { g.nadeMax += 1; g.nades = Math.min(g.nadeMax, g.nades + 2); }
    else if (id === 'ammo' && g.wpn) { const k = ammoOf(g, g.wpn.id) / g.wpn.max; g.wpn.max *= k; g.wpn.ammo *= k; }
    g.offer = null; g.stage++;
    newStage(g);
    g.ev.push({ t: 'stage', s: g.stage });
    return true;
  }

  return { W, H, SQ_Y, ROAD_L, ROAD_R, ROAD_V, LANE_W, BOSS_R, ZOMBIES, FROM, BOSSES, WEAPONS, SPECIAL, PERKS, PERK,
    rng, hpMul, ptMul, radius, power, rateOf, mult, comboWin, ammoOf, nadeDmg, create, step, pick, throwNade, spawnZ, spawnBoss, take, hurt };
});
