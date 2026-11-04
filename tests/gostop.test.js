// 고스톱 · 맞고 규칙 검사: 족보 · 뻑 · 쪽 · 따닥 · 판쓸 · 폭탄 · 흔들기 · 보너스피 · 고/스톱 · 정산(박) · 총통 · 3뻑 · 나가리
// + 무작위 수천 판 (패 50장이 늘 한 장씩만 있는지 · 점수 합이 0인지 · 끝까지 가는지)
const G = require('../public/js/shared/gostop-core.js');
const TableKit = require('../public/js/shared/table.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const T = (cap, g) => G.tally(cap, g).s.total;

console.log('▶ 족보');
ok(T([0, 8, 28]) === 3 && T([0, 8, 44]) === 2 && T([0, 8, 28, 44]) === 4 && T([0, 8, 28, 40, 44]) === 15, '광: 3광 3점 · 비광 3광 2점 · 4광 4점 · 5광 15점');
ok(T([0, 8]) === 0, '광 2장은 0점');
ok(T([4, 12, 29]) === 5 && T([4, 12, 45]) === 0, '고도리(2·4·8월 새) 5점 · 12월 제비는 고도리 아님');
ok(T([16, 20, 24, 36, 45]) === 1 && T([16, 20, 24, 36, 45, 32]) === 2, '열끗 5장 1점 · 6장 2점');
ok(T([1, 5, 9]) === 3 && T([21, 33, 37]) === 3 && T([13, 17, 25]) === 3 && T([13, 17, 46]) === 0, '홍단 · 청단 · 초단 3점 · 비띠는 초단 아님');
ok(T([1, 5, 9, 13, 46]) === 4, '띠 5장 1점 + 홍단 3점 = 4점 (비띠도 띠 장수에 들어가요)');
ok(T([2, 3, 6, 7, 10, 11, 14, 15, 18, 19]) === 1 && T([2, 3, 6, 7, 10, 11, 14, 15, 41]) === 1 && T([2, 3, 6, 7, 10, 11, 14, 49]) === 1, '피 10장 1점 · 쌍피 2장 · 삼피 3장');
ok(T([2, 3, 6, 7, 10, 11, 14, 15, 32]) === 0 && T([2, 3, 6, 7, 10, 11, 14, 15, 32], true) === 1 && G.best([2, 3, 6, 7, 10, 11, 14, 15, 32]).s.total === 1, '국진(9월 열끗): 쌍피로 쓰면 피 10장 → 좋은 쪽으로 자동');
ok(G.tally([16, 20, 24, 36, 45, 4, 12]).n.yl === 7, '열끗 7장 (멍따 조건)');

// ── 장면 검사 도구: 판을 직접 만들어요 ──
function scene(n, setupFn) {
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: '사람' + i }));
  const s = G.setup(players, () => 0.01, { rounds: 3 });
  for (const p of s.players) Object.assign(p, { hand: [], cap: [], go: 0, goScore: 0, shake: 0, bomb: 0, ppuk: 0, flipOnly: 0, shown: [] });
  Object.assign(s, { floor: [], stock: [], stuck: {}, phase: 'play', ask: null, T: null, turn: 0, dealer: 0, nagari: 0, events: [] });
  setupFn(s);
  return s;
}
const act = (s, i, a) => G.act(s, s.players[i].id, a);
const has = (arr, ids) => ids.every(x => arr.includes(x));
const filler = [20, 24, 36, 16];                                   // 다른 달 패 (손패 채우기)

console.log('▶ 패 맞추기');
{
  const s = scene(2, s => { s.players[0].hand = [2, 20]; s.floor = [0]; s.stock = [10, 22]; s.players[1].hand = [24]; });
  act(s, 0, { t: 'play', c: 2 });
  ok(has(s.players[0].cap, [0, 2]) && s.floor.join() === '10' && s.turn === 1, '맞는 패 먹기 · 뒤집은 패는 바닥에');
}
{
  const s = scene(2, s => { s.players[0].hand = [2, 20]; s.floor = [0]; s.stock = [3, 22]; s.players[1].hand = [1, 24]; s.players[0].cap = [6, 7]; });
  act(s, 0, { t: 'play', c: 2 });
  ok(s.players[0].ppuk === 1 && has(s.floor, [0, 2, 3]) && s.stuck[1] === 0 && !s.players[0].cap.includes(0), '뻑: 세 장이 바닥에 남아요');
  act(s, 1, { t: 'play', c: 1 });
  ok(has(s.players[1].cap, [0, 1, 2, 3]) && s.players[1].cap.length === 5 && s.players[0].cap.length === 1 && !s.stuck[1], `뻑 먹기: 네 장 + 피 1장 뺏기 (${s.players[1].cap})`);
}
{
  const s = scene(2, s => { s.players[0].hand = [2, 1, 20]; s.floor = [0]; s.stock = [3, 22, 23]; s.players[1].hand = [24, 26]; s.players[1].cap = [6, 7, 10]; });
  act(s, 0, { t: 'play', c: 2 });
  act(s, 1, { t: 'play', c: 24 });
  act(s, 0, { t: 'play', c: 1 });
  ok(has(s.players[0].cap, [0, 1, 2, 3]) && s.players[1].cap.length === 1 && s.events.some(e => e.t === 'steal' && /자뻑/.test(e.why)), `자뻑: 내가 싼 뻑을 먹으면 피 2장 (${s.players[1].cap})`);
}
{
  const s = scene(2, s => { s.players[0].hand = [2, 20]; s.floor = [8]; s.stock = [3, 22]; s.players[1].hand = [24]; s.players[1].cap = [6, 41]; });
  act(s, 0, { t: 'play', c: 2 });
  ok(has(s.players[0].cap, [2, 3]) && s.players[0].cap.includes(6) && s.events.some(e => e.t === 'jjok'), '쪽: 낸 패를 뒤집은 패로 먹고 피 1장 (보통 피부터)');
}
{
  const s = scene(2, s => { s.players[0].hand = [2, 20]; s.floor = [0, 1]; s.stock = [3, 22]; s.players[1].hand = [24]; s.players[1].cap = [6]; });
  act(s, 0, { t: 'play', c: 2 });
  ok(s.phase === 'choose' && s.ask.from === 'hand' && has(s.ask.ids, [0, 1]), '바닥에 같은 달 두 장(광 · 홍단) → 고르기');
  act(s, 0, { t: 'take', c: 0 });
  ok(has(s.players[0].cap, [0, 1, 2, 3]) && s.players[0].cap.includes(6) && s.events.some(e => e.t === 'ttadak'), '따닥: 뒤집은 패가 네 번째 → 네 장 다 + 피 1장');
}
{
  const s = scene(2, s => { s.players[0].hand = [2, 20]; s.floor = [0, 8]; s.stock = [10, 22]; s.players[1].hand = [24]; s.players[1].cap = [6]; });
  act(s, 0, { t: 'play', c: 2 });
  ok(!s.floor.length && s.players[0].cap.includes(6) && s.events.some(e => e.t === 'sweep'), '판쓸: 바닥을 다 쓸면 피 1장');
}
{
  const s = scene(2, s => { s.players[0].hand = [2]; s.floor = [8]; s.stock = [3, 22]; s.players[1].hand = [24]; s.players[1].cap = [6]; });
  act(s, 0, { t: 'play', c: 2 });
  ok(has(s.players[0].cap, [2, 3]) && !s.players[0].cap.includes(6), '손에 든 마지막 패로 한 쪽은 피를 안 뺏어요');
}
{
  const s = scene(2, s => { s.players[0].hand = [20, 0, 1, 2]; s.floor = [3, 24]; s.stock = [26, 22]; s.players[1].hand = [36, 38]; s.players[1].cap = [6, 7]; });
  ok(!!act(s, 0, { t: 'bomb', m: 2 }), '들고 있지 않은 달로는 폭탄 못 해요');
  act(s, 0, { t: 'bomb', m: 1 });
  const p = s.players[0];
  ok(has(p.cap, [0, 1, 2, 3]) && p.bomb === 1 && p.flipOnly === 2 && p.cap.includes(6) && p.cap.includes(24) && p.cap.includes(26), `폭탄: 4장 + 피 1장 + 뒤집은 패도 먹기 · 뒤집기만 2번 (${p.cap})`);
  act(s, 1, { t: 'play', c: 36 });
  ok(!act(s, 0, { t: 'flip' }) && p.flipOnly === 1, '폭탄 뒤: 패를 내지 않고 뒤집기만');
}
{
  const s = scene(2, s => { s.players[0].hand = [0, 1, 2, 20]; s.floor = [24]; s.stock = [26, 22]; s.players[1].hand = [36]; });
  ok(!!act(s, 0, { t: 'play', c: 20, shake: true }), '같은 달 3장이 아니면 흔들기 안 돼요');
  act(s, 0, { t: 'play', c: 0, shake: true });
  ok(s.players[0].shake === 1 && s.events.some(e => e.t === 'shake' && has(e.ids, [0, 1, 2])), '흔들기: 같은 달 3장을 보여 주고 내요 (×2)');
}
{
  const s = scene(2, s => { s.players[0].hand = [48, 20]; s.floor = [24]; s.stock = [36, 49, 26, 22]; s.players[1].hand = [38]; s.players[1].cap = [6, 7]; });
  act(s, 0, { t: 'play', c: 48 });
  ok(s.players[0].cap.includes(48) && s.players[0].hand.includes(36) && s.turn === 0 && s.phase === 'play' && s.players[0].cap.includes(6), '보너스피 내기: 먹고 피 뺏고 한 장 더 받아 계속');
  act(s, 0, { t: 'play', c: 20 });
  ok(s.players[0].cap.includes(49) && has(s.players[0].cap, [24, 26]) && s.players[0].cap.includes(7), '보너스피를 뒤집으면: 먹고 피 뺏고 한 장 더 뒤집어요');
}
{
  const s = scene(2, s => { s.players[0].hand = [20, 24]; s.floor = [0, 1]; s.stock = [2, 22]; s.players[1].hand = [36]; });
  act(s, 0, { t: 'play', c: 20 });
  ok(s.phase === 'choose' && s.ask.from === 'flip' && s.ask.card === 2, '뒤집은 패가 바닥 두 장과 맞으면 고르기');
  act(s, 0, { t: 'take', c: 1 });
  ok(has(s.players[0].cap, [1, 2]) && s.floor.includes(0) && s.floor.includes(20), '고른 패만 가져와요');
}
{
  const s = scene(2, s => { s.players[0].hand = [0, 20]; s.floor = [2, 3]; s.stock = [22, 23]; s.players[1].hand = [36]; });
  act(s, 0, { t: 'play', c: 0 });
  ok(s.phase !== 'choose' && s.players[0].cap.includes(0) && s.players[0].cap.length === 2, '바닥 두 장이 같은 값(피 · 피)이면 안 물어보고 가져와요');
}

console.log('▶ 고 · 스톱');
{
  const s = scene(2, s => {
    s.players[0].cap = [0, 8, 28, 1, 5, 9, 13];     // 3광 3 + 띠 4장(홍단 3) = 6점
    s.players[0].hand = [17, 20, 24]; s.floor = [18]; s.stock = [22, 26, 36, 38];
    s.players[1].hand = [38, 39, 34]; s.players[1].cap = [2, 3, 6];
  });
  act(s, 0, { t: 'play', c: 17 });                 // 띠 5장 → +1 = 7점
  ok(s.phase === 'gostop' && s.ask.score >= 7, `7점 → 고/스톱 (${s.ask && s.ask.score}점)`);
  act(s, 0, { t: 'go' });
  ok(s.players[0].go === 1 && s.phase === 'play' && s.turn === 1, '1고 → 상대 차례');
  act(s, 1, { t: 'play', c: 34 });
  act(s, 0, { t: 'play', c: 20 });
  ok(s.phase !== 'gostop' || s.ask.score > s.players[0].goScore, '고 한 뒤에는 점수가 더 올라야 다시 물어봐요');
}
console.log('▶ 정산');
{
  const s = scene(2, s => { s.players[0].cap = [0, 8, 28, 1, 5, 9, 13, 17]; s.players[1].cap = [2, 3, 6]; });
  let r = G._test.settle(s, 0, 'stop');
  ok(r.base === 7 && r.pays[0].amount === 14 && r.pays[0].flags.includes('광박'), `맞고 7점 · 상대 광 0장 → 광박 ×2 = 14 (${r.pays[0].amount})`);
  s.players[0].total = 0; s.players[1].total = 0; s.players[0].go = 3;
  r = G._test.settle(s, 0, 'stop');
  ok(r.base === 10 && r.pays[0].amount === 40, `3고: (7+3)×2 · 광박 ×2 = 40 (${r.pays[0].amount})`);
  s.players[0].go = 0; s.players[0].shake = 1; s.players[1].cap.push(40);
  r = G._test.settle(s, 0, 'stop');
  ok(r.pays[0].amount === 14 && !r.pays[0].flags.includes('광박'), `흔들기 ×2 · 상대가 광이 있으면 광박 아님 = 14 (${r.pays[0].amount})`);
}
{
  const pi10 = [2, 3, 6, 7, 10, 11, 14, 15, 18, 19];
  const s = scene(2, s => { s.players[0].cap = [...pi10, 22, 23, 26, 27, 30, 31]; s.players[1].cap = [34, 35, 38, 39, 42]; });   // 피 16장 = 7점
  let r = G._test.settle(s, 0, 'stop');
  ok(r.base === 7 && r.pays[0].flags.includes('피박') && r.pays[0].amount === 14, `피박: 상대 피 5장(맞고는 7장 이하) → ×2 = 14 (${r.pays[0].amount})`);
  s.players[1].cap = [];
  r = G._test.settle(s, 0, 'stop');
  ok(!r.pays[0].flags.includes('피박') && r.pays[0].amount === 7, '상대가 피를 한 장도 못 먹었으면 피박 면제');
  s.players[1].cap = [34, 35, 38, 39, 42, 43, 32];               // 피 6장 + 국진 → 쌍피로 쓰면 8장 → 피박을 면해요
  r = G._test.settle(s, 0, 'stop');
  ok(!r.pays[0].flags.includes('피박'), '진 사람의 국진은 피박을 면하는 쪽으로 (쌍피로)');
}
{
  const s = scene(2, s => { s.players[0].cap = [16, 20, 24, 36, 45, 4, 12, 0, 8, 28]; s.players[1].cap = [2, 40]; });   // 열끗 7장(3점) + 3광 3 = 6점 → ×2 멍따
  const r = G._test.settle(s, 0, 'stop');
  ok(r.mults.some(m => m.k === 'mung') && r.pays[0].amount === r.base * 2, `멍따(열끗 7장 이상) ×2 (${r.base} → ${r.pays[0].amount})`);
}
{
  const s = scene(2, s => { s.players[0].cap = [0, 8, 28, 1, 5, 9, 13, 17]; s.players[1].cap = [2, 3, 6, 40]; s.players[1].go = 1; });
  const r = G._test.settle(s, 0, 'stop');
  ok(r.pays[0].flags.includes('고박') && r.pays[0].amount === 14, `맞고 고박: 고를 했던 상대는 ×2 (${r.pays[0].amount})`);
}
{
  const s = scene(3, s => { s.players[0].cap = [0, 8, 28]; s.players[1].cap = [2, 40]; s.players[2].cap = [3, 44]; s.players[2].go = 1; });
  const r = G._test.settle(s, 0, 'stop');
  const p1 = r.pays.find(x => x.i === 1), p2 = r.pays.find(x => x.i === 2);
  ok(r.base === 3 && p1.amount === 0 && p2.amount === 6 && p2.flags.includes('고박(독박)'), `3인 독박: 고 한 사람이 둘 몫 3+3 = 6 (${p1.amount}, ${p2.amount})`);
  ok(s.players[0].total === 6 && s.players[2].total === -6 && s.players[1].total === 0, '점수 합은 0');
}
{
  const s = scene(2, s => { s.players[0].cap = [0, 8, 28, 1, 5, 9, 13, 17]; s.players[1].cap = [2, 40]; s.nagari = 2; });
  const r = G._test.settle(s, 0, 'stop');
  ok(r.pays[0].amount === 28, `나가리 두 번 뒤 판: ×4 = 28 (${r.pays[0].amount})`);
}

console.log('▶ 총통 · 3뻑 · 나가리 · 판 넘기기');
{
  let found = null;
  for (let seed = 1; seed < 5000 && !found; seed++) {
    let x = seed; const rnd = () => { x = (x * 48271) % 2147483647; return x / 2147483647; };
    const s = G.setup([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rnd, { rounds: 3 });
    if (s.phase === 'chongtong') found = s;
  }
  ok(!!found, '총통이 나오는 판 찾기');
  if (found) {
    const who = found.ask.who;
    G.act(found, found.players[who].id, { t: 'chongtong', end: true });
    ok(found.phase === 'summary' && found.last.kind === 'chongtong' && found.last.total === 7, `총통으로 끝내면 7점 (${found.last.total})`);
  }
}
{
  const s = scene(2, s => { s.players[0].hand = [2, 20, 24]; s.players[0].ppuk = 2; s.floor = [0]; s.stock = [3, 22]; s.players[1].hand = [36, 38]; });
  act(s, 0, { t: 'play', c: 2 });
  ok(s.phase === 'summary' && s.last.kind === 'ppuk3' && s.last.winner === 0 && s.last.total === 7, '한 판에 뻑 3번 → 바로 승리 (7점)');
}
{
  const s = scene(2, s => { s.players[0].hand = [20]; s.players[1].hand = [24]; s.floor = [36]; s.stock = [38, 39]; });
  act(s, 0, { t: 'play', c: 20 });
  act(s, 1, { t: 'play', c: 24 });
  ok(s.phase === 'summary' && s.last.kind === 'nagari' && s.nagari === 1, '아무도 못 나면 나가리 → 다음 판 2배');
  const round = s.round;
  G.act(s, 'p0', { t: 'next' }); G.act(s, 'p1', { t: 'next' });
  ok(s.round === round + 1 && s.phase !== 'summary', '모두 확인하면 다음 판');
}
{
  const s = scene(2, s => { s.players[0].hand = [20, 22]; s.players[0].cap = [0, 8, 28, 1, 5, 9, 13, 17]; s.players[0].go = 1; s.players[0].goScore = 7; s.players[1].hand = [24, 26]; s.floor = [36]; s.stock = [38, 39, 40, 41]; });
  act(s, 0, { t: 'play', c: 20 }); act(s, 1, { t: 'play', c: 24 });
  act(s, 0, { t: 'play', c: 22 }); act(s, 1, { t: 'play', c: 26 });
  ok(s.last && s.last.kind === 'nagari', "'고' 한 뒤 점수가 더 안 오르고 끝나면 나가리");
}

console.log('▶ 무작위 판 (규칙 · 카드 보존 · 점수 합)');
function invariant(s) {
  const ids = [...s.floor, ...s.stock];
  for (const p of s.players) ids.push(...p.hand, ...p.cap);
  if (s.phase === 'choose' && s.T) {
    if (s.ask.from === 'hand' && s.T.hand != null && !s.T.placed) ids.push(s.T.hand);
    if (s.ask.from === 'flip' && s.T.flip != null) { ids.push(s.T.flip); if (s.T.hand != null && !s.T.placed && !ids.includes(s.T.hand)) ids.push(s.T.hand); }
  }
  if (s.phase === 'play' && s.T) return 'T 가 남아 있음';
  const set = new Set(ids);
  if (ids.length !== 50 || set.size !== 50) return `카드 ${ids.length}장 / 서로 다른 ${set.size}장`;
  const sum = s.players.reduce((a, p) => a + p.total, 0);
  if (sum !== 0) return `점수 합 ${sum}`;
  if (s.phase === 'play' && !(s.players[s.turn].hand.length + s.players[s.turn].flipOnly)) return '칠 패가 없는 사람 차례';
  return null;
}
function randomAct(s, id, rnd) {
  const i = s.players.findIndex(p => p.id === id), p = s.players[i];
  if (s.phase === 'summary') return { t: 'next' };
  if (s.phase === 'chongtong') return { t: 'chongtong', end: rnd() < 0.5 };
  if (s.phase === 'gostop') return { t: rnd() < 0.5 ? 'go' : 'stop' };
  if (s.phase === 'choose') return { t: 'take', c: s.ask.ids[Math.floor(rnd() * s.ask.ids.length)] };
  const opts = [];
  if (p.flipOnly) opts.push({ t: 'flip' });
  for (let m = 1; m <= 12; m++) if (p.hand.filter(x => G.CARDS[x].m === m).length === 3 && s.floor.filter(x => G.CARDS[x].m === m).length === 1) opts.push({ t: 'bomb', m });
  for (const c of p.hand) {
    const m = G.CARDS[c].m, n = p.hand.filter(x => G.CARDS[x].m === m && m).length;
    opts.push({ t: 'play', c, shake: n >= 3 && !s.floor.some(x => G.CARDS[x].m === m) && rnd() < 0.6 ? true : undefined });
  }
  return opts[Math.floor(rnd() * opts.length)];
}
for (const [n, games, mixed] of [[2, 1500, false], [3, 1500, false], [2, 1500, true], [3, 1500, true]]) {
  let bad = null, ends = 0, rounds = 0, nag = 0, evs = {}, maxPay = 0, kinds = {};
  for (let g = 0; g < games && !bad; g++) {
    let x = 1000 + g * 7919; const rnd = () => { x = (x * 48271) % 2147483647; return x / 2147483647; };
    const players = Array.from({ length: n }, (_, k) => ({ id: 'q' + k, name: 'Q' + k, bot: !mixed || k > 0 }));
    const s = G.setup(players, rnd, { rounds: 3 });
    for (let step = 0; step < 3000 && !s.over; step++) {
      const e = invariant(s); if (e) { bad = `${g}판 ${step}: ${e} (phase ${s.phase})`; break; }
      if (s.phase === 'summary') { if (s.last.kind === 'nagari') nag++; else kinds[s.last.kind] = (kinds[s.last.kind] || 0) + 1; rounds++; maxPay = Math.max(maxPay, s.last.total || 0); }
      const pend = G.pending(s); if (!pend.length) { bad = `${g}판: 기다리는 사람이 없음 (${s.phase})`; break; }
      const id = pend[0], pl = s.players.find(p => p.id === id);
      const a = mixed && !pl.bot ? randomAct(s, id, rnd) : (G.ai(s, id) || randomAct(s, id, rnd));
      const err = G.act(s, id, a);
      if (err) { bad = `${g}판 ${step}: 행동 오류 "${err}" ${JSON.stringify(a)} (phase ${s.phase})`; break; }
      for (const ev of s.events) evs[ev.t] = (evs[ev.t] || 0) + 1;
    }
    if (!bad && !s.over) bad = `${g}판: 3000번 안에 안 끝남`;
    if (!bad) { ends++; const r = G.result(s); if (!r || r.ranking.length !== n) bad = '결과 이상'; }
  }
  ok(!bad, `${n}인 ${mixed ? '사람(무작위)+봇' : '봇끼리'} ${games}게임: 끝까지 ${ends} · ${rounds}판 · 나가리 ${nag} · ${JSON.stringify(kinds)} · 최고 ${maxPay}점`, bad);
  console.log('     일어난 일:', Object.entries(evs).map(([k, v]) => `${k} ${v}`).join(' · '));
}
{ // TableKit 으로 시간(봇 지연 · 다음 판 시간) 포함 한 게임
  let NOW = 1e12; const real = Date.now; Date.now = () => NOW;
  let Q = [], res = null, seq = 0;
  const TT = TableKit.createTable(G, [{ id: 'h', name: '사람' }, { id: 'b0', name: '봇', bot: true }, { id: 'b1', name: '봇2', bot: true }], {
    rnd: Math.random, opts: { rounds: 3 }, setTimer: (fn, ms) => { const x = { at: NOW + ms, fn, id: ++seq }; Q.push(x); return x; }, clearTimer: x => { Q = Q.filter(y => y !== x); },
    onUpdate() {}, onEnd: r => { res = r; },
  });
  for (let i = 0; i < 20000 && !res && Q.length; i++) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const x = Q.shift(); NOW = Math.max(NOW, x.at); x.fn(); }
  Date.now = real;
  ok(!!res && res.ranking.length === 3, `TableKit: 사람이 가만히 있어도(시간 초과 → 대신 침) 3판 끝까지 (${res && res.title})`);
  const v = TT.view('h');
  ok(v.players[0].hand !== null && v.players[1].hand === null, '화면 정보: 내 손패만 보여요');
}
console.log('▶ 화면 정보 (v10.1)');
{ // 스톱 미리 보기 = 실제로 받는 점수 · 계산만 해도 점수는 그대로
  const s = scene(2, s => { s.players[0].hand = [2, 20, 24]; s.floor = [0]; s.stock = [36, 16, 26]; s.players[1].hand = [28, 40];
    s.players[0].cap = [8, 44, 1, 5, 9, 3, 6, 7, 10, 11, 14, 15, 18, 19, 23]; s.players[1].cap = [27, 31]; });
  act(s, 0, { t: 'play', c: 2 });
  const v = G.view(s, 'p0');
  const before = s.players.map(p => p.total);
  const preview = v.ask && v.ask.value;
  ok(s.phase === 'gostop' && typeof preview === 'number' && preview > 0, '고/스톱: 스톱하면 받을 점수를 미리 보여줘요', JSON.stringify(v.ask));
  ok(s.players.map(p => p.total).join() === before.join(), '미리 보기 계산은 점수를 바꾸지 않아요');
  act(s, 0, { t: 'stop' });
  ok(s.last && s.last.total === preview && s.players[0].total === preview && preview === 28, '미리 본 점수 = 스톱해서 받은 점수 (7점 × 피박 × 광박 = 28)', `${preview} vs ${s.last && s.last.total}`);
  ok(G.view(s, 'p1').ask === null && G.view(s, 'p0').seat === 0 && G.view(s, 'p1').seat === 1 && G.view(s, 'x').seat === -1, '자리 번호(seat) · 관전은 -1');
}
{ // 고르는 중에는 낸 패를 따로 보여줘요 (pend) · 이벤트 번호
  const s = scene(2, s => { s.players[0].hand = [9, 20]; s.floor = [8, 10]; s.stock = [36, 22]; s.players[1].hand = [24]; });
  const e0 = s.evId;
  act(s, 0, { t: 'play', c: 9 });
  const v = G.view(s, 'p1');
  ok(s.phase === 'choose' && v.pend.length === 1 && v.pend[0].id === 9 && v.ask.waiting, '바닥 두 장 중 고르는 동안 낸 패(9) → pend · 상대는 기다림');
  ok(s.evId === e0 + 1 && v.mover === 0, '차례마다 효과 묶음 번호(evId)가 늘고 · 누가 쳤는지(mover)');
  act(s, 0, { t: 'take', c: 8 });
  ok(G.view(s, 'p0').pend.length === 0 && s.players[0].cap.includes(8) && s.players[0].cap.includes(9), '고른 뒤에는 pend 없음 · 고른 광을 먹음');
}
{ // 싱글은 판 결과 화면에서 기다려요 (멀티는 12초 뒤 자동)
  const mk = solo => { const s = G.setup([{ id: 'a', name: 'a' }, { id: 'b', name: 'b', bot: true }], Math.random, { rounds: 3, solo }); s.phase = 'summary'; s.summaryEnd = Date.now() + 5000; return s; };
  ok(G.deadline(mk(true)) === null && G.deadline(mk(false)) > 0, '판 결과: 싱글은 시간 제한 없음 · 멀티는 있음');
}
{ // 폭탄 차례 기록
  const s = scene(2, s => { s.players[0].hand = [0, 1, 2, 20]; s.floor = [3]; s.stock = [36, 22, 16]; s.players[1].hand = [24, 28]; s.players[1].cap = [6]; });
  act(s, 0, { t: 'bomb', m: 1 });
  const L = s.log.filter(e => e.t === 'turn').pop();
  ok(L && L.bomb === true && L.hand == null, '폭탄 차례는 기록에 bomb 표시');
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
