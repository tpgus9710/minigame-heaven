// 🍉 과일 합치기 v13.9 검사 (화면 없이 물리만 돌려요)
//   다음 과일 그림 · 빠르게 두 번 떨어뜨리기 · 첫 충돌 퍼짐 · 같은 과일 끌어당기기 · 연쇄 콤보 점수 · 넘침 3초 · 대결 과일 순서 · 오래 해도 상자 안
const fs = require('fs');
const path = require('path');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

// ── 브라우저 대신 쓰는 가짜 도구들 (fruit.js가 쓰는 것만) ──
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'fruit.js'), 'utf8');
const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let NOW = 1000, arcs = 0;
const ctx = () => new Proxy({}, { get: (t, k) => k in t ? t[k] : () => { if (k === 'arc') arcs++; return { addColorStop() {} }; }, set: (t, k, v) => { t[k] = v; return true; } });
const els = {};
const $ = sel => els[sel] || (els[sel] = { innerHTML: '', textContent: '', title: '', dataset: {}, attrs: {}, addEventListener() {}, setAttribute(k, v) { this.attrs[k] = v; }, getContext() { return this.c || (this.c = ctx()); } });
const results = [], sent = [];
let screen = null, reg = null, touch = null;
const stub = {
  $, makeScreen: (id, o) => { screen = o; }, register: (k, d) => { reg = d; }, TouchArea: { add: (k, h) => { touch = h; } }, cvPoint: (cv, e) => ({ x: e.x, y: 0 }),
  stopLocal() {}, S: {}, store: { get: (k, d) => d, set() {} }, setStat() {}, setStatus() {}, show() {}, renderScores() {}, gameLoop() {}, held: () => false,
  after: (ms, fn) => fn(), showResult: r => results.push(r), socket: { emit: (e, v) => sent.push([e, v]) }, leftSec: () => 0,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), Sound: { play() {}, blip() {} }, seeded, TOUCH: true, performance: { now: () => NOW },
};
const names = Object.keys(stub);
const { Fruit, FR, FPHYS } = new Function(...names, SRC + '\n;return { Fruit, FR, FPHYS };')(...names.map(n => stub[n]));

const tick = (sec, each) => { for (let i = 0, n = Math.round(sec * 60); i < n && !Fruit.over; i++) { NOW += 1000 / 60; if (each) each(); Fruit.update(1 / 60, NOW); } };
/** 빈 상자로 새 판 (효과용 난수도 고정 → 매번 같은 결과) */
const fresh = (seed = 1) => { NOW += 10000; Fruit.start({}); Fruit.rnd = seeded(seed); Fruit.fruits = []; Fruit.warm = new Map(); Fruit.cool = 0; };
/** 바닥(또는 y)에 가만히 놓인 과일 하나 */
const put = (lv, x, y = FR.FLOOR - FR.RAD[lv]) => { const f = Fruit.body(lv, x, y, 0, 0, NOW - 5000); Fruit.fruits.push(f); return f; };
const drops = () => Fruit.picks - 2;                                  // 처음에 지금 · 다음 과일 2개를 뽑아요
const tryDrop = () => { const n = drops(); Fruit.drop(); return drops() > n; };

console.log('▶ 「다음」 칸: 글자 대신 과일 그림');
{
  fresh();
  const cv = $('#fr-next');
  ok(/<canvas id="fr-next"/.test($('#fruit-next').innerHTML), '「다음」 칸에 과일 그림판(canvas)');
  ok(cv.dataset.lv === String(Fruit.next) && cv.attrs['aria-label'] === `다음 과일: ${FR.NAME[Fruit.next]}` && arcs > 0, `다음 과일을 그리고 이름표도 달아요 (${FR.NAME[Fruit.next]})`);
  let n = 0;
  const prev = Fruit.next, a0 = arcs;
  while (Fruit.next === prev && n++ < 40) { Fruit.cool = 0; Fruit.drop(); }
  ok(cv.dataset.lv === String(Fruit.next) && arcs > a0, `다음 과일이 바뀌면 다시 그려요 (${FR.NAME[prev]} → ${FR.NAME[Fruit.next]})`);
  const a1 = arcs; Fruit.hud();
  ok(arcs === a1, '같은 과일이면 다시 그리지 않아요');
  ok(/끌어서 조준/.test(screen.status) && /두 번/.test(screen.status) && /3초/.test(screen.status), '안내 문구: 끌어서 조준 · 빠르게 두 번 · 3초');
}

console.log('▶ 빠르게 두 번 연속 떨어뜨리기');
{
  fresh();
  ok(tryDrop() && Fruit.cool <= FPHYS.QUICK + 1e-9, `첫 번째 → ${FPHYS.QUICK}초 뒤면 또 떨어뜨릴 수 있어요`);
  tick(0.13);
  ok(tryDrop(), '0.13초 뒤 두 번째 (빠르게 연속)');
  tick(0.2);
  ok(!tryDrop() && !Fruit.queued, '두 번 연속 뒤에는 0.5초 쉬어요 (0.2초 뒤엔 아직 · 기억도 안 해요)');
  tick(0.32);
  ok(tryDrop(), '0.5초 쉬고 다시 떨어뜨려요');
  tick(0.3);
  ok(!tryDrop(), '계속 몰아서 떨어뜨리면 0.5초 간격');
  tick(0.75);
  ok(tryDrop() && (tick(0.13), tryDrop()), '0.6초 넘게 쉬면 다시 빠르게 두 번');
  // 아주 빠른 두 번 탭(0.12초 안): 씹히지 않고 기억했다가 떨어뜨려요 · 누른 자리 그대로
  fresh(); NOW += 1000;
  Fruit.x = 120; ok(tryDrop(), '탭 ①');
  tick(0.05); Fruit.x = 280; Fruit.drop();
  ok(drops() === 1 && Fruit.queued, '0.05초 만에 탭 ② → 기억해 둬요');
  Fruit.x = 200; tick(0.1);
  const second = Fruit.fruits[Fruit.fruits.length - 1];
  ok(drops() === 2 && !Fruit.queued && Math.abs(second.x - 280) < 1 && Fruit.x === 200, `기다림이 끝나면 탭 ② 자리(x=280)에 떨어져요 (x=${second && second.x.toFixed(0)})`);
  // 손가락 · 키보드
  fresh();
  touch.up({ x: 100 }); tick(0.13); reg.key({ code: 'Space', repeat: false });
  ok(drops() === 2 && Fruit.fruits.some(f => Math.abs(f.x - 100) < 1), '손을 떼면 그 자리에 떨어지고 · 스페이스로 바로 한 번 더');
  // 같은 과일을 빠르게 두 번 → 공중에서 바로 합쳐져요
  fresh(); Fruit.cur = Fruit.next = 0;
  Fruit.x = 200; tryDrop(); tick(0.13); tryDrop(); tick(0.05);
  ok(Fruit.score === 2 && Fruit.fruits.length === 1 && Fruit.fruits[0].lv === 1, '체리 + 체리를 빠르게 두 번 → 바로 딸기 (+2)');
  ok(Fruit.fruits[0].fresh === true, '공중에서 합쳐진 딸기도 떨어지면서 퍼져요 (첫 충돌 그대로)');
}

console.log('▶ 높은 데서 떨어진 과일은 세게 부딪혀 옆으로 퍼져요');
{
  const spread = (hit, x) => {
    fresh(3); const save = FPHYS.HIT; FPHYS.HIT = hit;
    const L = put(4, 200);                                            // 바닥에 레몬
    Fruit.cur = 2; Fruit.x = x; Fruit.drop();                         // 그 위(살짝 옆)로 맨 위에서 포도
    const G = Fruit.fruits[1];
    tick(1.5); FPHYS.HIT = save;
    return { lemon: L.x - 200, grape: G.x - x };
  };
  const off = spread(0, 212), on = spread(FPHYS.HIT, 212);          // 가운데에서 12px 오른쪽 (딱 가운데면 왼쪽 · 오른쪽 아무 쪽으로나)
  ok(on.lemon < off.lemon - 30, `맞은 레몬이 옆으로 굴러가요: ${on.lemon.toFixed(0)}px (퍼짐이 없으면 ${off.lemon.toFixed(0)}px)`, JSON.stringify({ off, on }));
  ok(on.grape > 20, `떨어진 포도는 반대쪽으로 튕겨요: +${on.grape.toFixed(0)}px`, JSON.stringify(on));
  const left = spread(FPHYS.HIT, 188);
  ok(left.lemon > 25 && left.grape < -20, `왼쪽에 떨어뜨리면 반대로 (레몬 +${left.lemon.toFixed(0)} · 포도 ${left.grape.toFixed(0)})`, JSON.stringify(left));
  // 살살 내려놓으면(첫 충돌이 느리면) 그 자리에
  fresh(4);
  const L = put(5, 200);
  const f = Fruit.body(3, 200, L.y - L.r - FR.RAD[3] - 2, 0, 0, NOW); f.fresh = true; Fruit.fruits.push(f);
  tick(0.05);
  ok(Math.abs(L.vx) < 20, `낮은 곳에 살살 놓으면 옆으로 튕기지 않아요 (사과 옆 속도 ${L.vx.toFixed(1)})`);
}

console.log('▶ 같은 과일은 살짝 끌어당겨 합쳐져요');
{
  fresh(5);
  put(2, 160); put(2, 160 + 48 + 6);                                  // 포도 둘 · 6px 틈
  tick(1);
  ok(Fruit.fruits.length === 1 && Fruit.fruits[0].lv === 3 && Fruit.score === 12, '6px 떨어진 포도 둘 → 끌어당겨 귤로 (+12)');
  fresh(6);
  put(2, 120); put(2, 120 + 48 + 30);                                 // 30px 틈: 너무 멀어요
  tick(1);
  ok(Fruit.fruits.length === 2 && Fruit.score === 0, '30px 떨어지면 그대로 (자석은 아주 가까울 때만)');
  fresh(7);
  put(2, 120); put(3, 120 + 24 + 30 + 1);                             // 포도 · 귤 (다른 과일)은 닿아 있어도 그대로
  tick(1);
  ok(Fruit.fruits.length === 2 && Fruit.score === 0, '다른 과일끼리는 끌어당기지 않아요');
}

console.log('▶ 연쇄 콤보: 합쳐진 과일이 또 합쳐지면 점수 ×1.25 …');
{
  fresh(8);
  put(1, 200);                                                        // 딸기
  put(0, 158 - 14); put(0, 158 + 14 - 0.5);                           // 그 옆에 붙은 체리 둘 → 딸기가 되어 → 옆 딸기와 또 합쳐져 포도
  let saw = false;
  tick(1.2, () => { if (Fruit.texts.some(t => t.combo === 2)) saw = true; });
  ok(Fruit.fruits.length === 1 && Fruit.fruits[0].lv === 2, '체리 둘 → 딸기 → 옆 딸기와 또 합쳐져 포도 (연쇄)');
  ok(Fruit.score === 2 + Math.round(6 * 1.25) && Fruit.bestCombo === 2, `점수 2 + 6 × 1.25 = ${Fruit.score} · 최고 콤보 ${Fruit.bestCombo}`);
  ok(saw, '「콤보 ×2」 글자가 떠요');
  const mul = c => Math.min(FPHYS.COMBO_MAX, 1 + (c - 1) * FPHYS.COMBO_K);
  ok(mul(1) === 1 && mul(3) === 1.5 && mul(5) === 2 && mul(20) === 3, '콤보 배율 1 → ×1.5(3콤보) → ×2(5콤보) · 최대 ×3');
  Fruit.cur = 0; Fruit.cool = 0; Fruit.x = 300; Fruit.drop();
  ok(Fruit.combo === 0, '다음 과일을 떨어뜨리면 콤보는 새로 시작');
  // 수박 + 수박: +132 + 보너스 200, 둘 다 사라져요
  fresh(9); put(10, 120); put(10, 120 + 182 - 0.5);
  tick(0.2);
  ok(Fruit.fruits.length === 0 && Fruit.score === 332 && Fruit.texts.some(t => t.hero), '수박 + 수박 → 펑! +332 (큰 글자)');
}

console.log('▶ 넘침: 선 위에 멈춘 채로 3초 넘게 있어야 끝');
{
  fresh(10);
  const f = put(4, 200, FR.LINE - 10);                                // 레몬이 선 위에 (잡아 둬요: 떨어지지 않게)
  const hold = () => { f.x = 200; f.y = FR.LINE - 10; f.vx = f.vy = 0; };
  tick(2.8, hold);
  ok(!Fruit.over && Fruit.danger > 2.5, `2.8초: 아직 (넘치기 ${(FPHYS.OVER - Fruit.danger).toFixed(1)}초 전 경고)`);
  tick(0.4, hold);
  ok(Fruit.over && results.length && /넘쳤어요/.test(results[results.length - 1].title) && /최고 콤보/.test(results[results.length - 1].subtitle), '3초 넘으면 끝 · 결과에 최고 콤보');
  fresh(11);
  const g = put(4, 200, FR.LINE - 10);
  tick(2.5, () => { g.x = 200; g.y = FR.LINE - 10; g.vx = 0; g.vy = -200; });   // 움직이는(튀는) 과일은 세지 않아요
  ok(!Fruit.over && Fruit.danger === 0, '움직이는 과일은 세지 않아요');
}

console.log('▶ 대결: 모두 같은 순서로 과일이 나와요 · 처음엔 작은 과일만');
{
  const seq = (seed, noise) => {
    NOW += 10000; Fruit.start({ seed, seconds: 120 });
    for (let i = 0; i < noise; i++) Fruit.rnd();                       // 과즙 · 흔들림 같은 효과는 사람마다 달라도
    const s = [Fruit.cur, Fruit.next];
    for (let i = 0; i < 40; i++) s.push(Fruit.pick());
    Fruit.over = true;
    return s;
  };
  const a = seq(777, 0), b = seq(777, 50), c = seq(778, 0);
  ok(a.join() === b.join(), '같은 씨앗이면 효과와 상관없이 같은 순서');
  ok(a.join() !== c.join(), '다른 씨앗이면 다른 순서');
  let small = true, big = true;
  for (let s = 1; s <= 200; s++) { const q = seq(s, 0); if (q.slice(0, 6).some(v => v > 2)) small = false; if (q.some(v => v > 4)) big = false; }
  ok(small, '처음 6개는 체리 · 딸기 · 포도만');
  ok(big, '떨어뜨리는 과일은 레몬까지');
  ok(sent.some(([e, v]) => e === 'sr:score' && v === 0), '대결 점수는 서버로 보내요');
}

console.log('▶ 오래 해도 과일이 상자 밖으로 나가거나 터지지 않아요 (봇 300번)');
{
  fresh(12);
  const r = seeded(99);
  let bad = 0, nan = 0, n = 0, merges = 0;
  const m0 = Fruit.merge.bind(Fruit);
  Fruit.merge = (ms, now) => { merges += ms.length; return m0(ms, now); };
  while (!Fruit.over && n < 300) {
    const rad = FR.RAD[Fruit.cur];
    Fruit.x = FR.L + rad + r() * (FR.R - FR.L - 2 * rad); Fruit.cool = 0; Fruit.drop(); n++;
    tick(r() < 0.3 ? 0.15 : 0.6, () => {
      for (const f of Fruit.fruits) {
        if (!Number.isFinite(f.x + f.y + f.vx + f.vy + f.w)) nan++;
        if (f.x - f.r < FR.L - 3 || f.x + f.r > FR.R + 3 || f.y + f.r > FR.FLOOR + 3) bad++;
      }
    });
  }
  Fruit.merge = m0;
  ok(!nan && !bad, `${n}번 떨어뜨리는 동안 숫자 깨짐 ${nan} · 상자 밖 ${bad}`);
  ok(n >= 150 && merges / n > 0.7, `아무 데나 떨어뜨려도 ${n}번 버티고 · 떨어뜨릴 때마다 ${(merges / n).toFixed(2)}번 합쳐져요`);
  if (!Fruit.over) {
    tick(3);
    const p0 = new Map(Fruit.fruits.map(f => [f.id, [f.x, f.y]]));
    tick(3);
    const moved = Math.max(...Fruit.fruits.map(f => { const p = p0.get(f.id); return p ? Math.hypot(f.x - p[0], f.y - p[1]) : 0; }));
    ok(moved < 12, `가만히 두면 쌓인 과일이 멈춰요 (3초 동안 가장 많이 움직인 과일 ${moved.toFixed(1)}px · ${Fruit.fruits.length}개)`);
  }
}

console.log(fails ? `\n❌ 과일 합치기: ${fails}개 실패` : '\n✅ 과일 합치기: 모두 통과');
process.exit(fails ? 1 : 0);
