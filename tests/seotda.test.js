// 섯다 규칙 검사: 족보 · 특수 패 · 3장 섯다 (보여줄 카드 고르기 · 3장 중 2장 직접 고르기 · 시간 초과 · 잘못된 입력 · 나가기)
// games/cards.js 를 가짜 방 도구(H)로 돌려요. 타이머는 가짜 시계, 화투 순서는 장면마다 직접 정해요.
const makeCards = require('../games/cards.js');
const { seotdaPair, seotdaResolve, bestPair, evalSeotda, OPEN_SECONDS, PICK_SECONDS } = makeCards;
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const C = (m, k = 'pi') => ({ m, k });

console.log('▶ 족보 · 특수 패');
ok(seotdaPair(C(3, 'gwang'), C(8, 'gwang')).name === '38광땡' && seotdaPair(C(1, 'pi'), C(8, 'gwang')).name === '갑오', '38광땡 · 광 한 장은 그냥 끗');
ok(seotdaPair(C(4, 'yeol'), C(9, 'yeol')).special === 'mgusa' && seotdaPair(C(4, 'pi'), C(9, 'yeol')).special === 'gusa', '멍텅구리구사 · 구사');
ok(seotdaPair(C(3, 'gwang'), C(7, 'yeol')).special === 'ddaeng' && seotdaPair(C(4, 'yeol'), C(7, 'yeol')).special === 'amhaeng', '땡잡이 · 암행어사');
{
  const h = [C(4, 'yeol'), C(9, 'yeol'), C(1, 'gwang')];
  const b = bestPair(h);
  ok(b.ev.name === '독사' && b.p.join() === '0,2' && evalSeotda(h).name === '독사', '가장 높은 조합 (시간 초과용): 4열 · 9열 · 1광 → 독사');
}
{
  const r = seotdaResolve([{ id: 'a', ev: seotdaPair(C(4, 'yeol'), C(9, 'yeol')) }, { id: 'b', ev: seotdaPair(C(5), C(5)) }]);
  ok(r.replay && r.name === '멍텅구리구사', '멍텅구리구사: 상대가 9땡 이하면 재경기');
}

// ── 가짜 방 ──
const ALL = [];
for (let m = 1; m <= 10; m++) { ALL.push({ m, k: [1, 3, 8].includes(m) ? 'gwang' : [4, 7, 9].includes(m) ? 'yeol' : 'pi' }); ALL.push({ m, k: 'pi' }); }
/** hands: 사람마다 받을 카드 [첫 장, 둘째 장, 셋째 장] → 그 순서대로 나오는 덱 */
function stack(hands) {
  const rest = ALL.map(c => ({ ...c }));
  const take = c => { const i = rest.findIndex(x => x.m === c.m && x.k === c.k); if (i < 0) throw new Error('없는 카드 ' + JSON.stringify(c)); return rest.splice(i, 1)[0]; };
  const n = hands.length, order = [];
  for (const k of [0, 1, 2]) for (let p = 0; p < n; p++) if (hands[p][k]) order.push(take(hands[p][k]));   // 1라운드 2장(한 장씩 돌아가며) → 2라운드 1장
  return [...rest, ...order.reverse()];                                                          // pop() 이 뒤에서부터 꺼내요
}
function table(n, mode, hands) {
  let clock = 0;
  const timers = [];
  const out = { states: {}, logs: [], sys: [], results: [], lobby: null, finished: null };
  const H = {
    emit: (room, ev, d) => { if (ev === 'card:log') out.logs.push(d); if (ev === 'card:result') out.results.push(d); },
    sys: (room, msg) => out.sys.push(msg),
    later: (room, ms, fn) => { const t = { due: clock + ms, fn, done: false }; timers.push(t); return t; },
    cancel: (room, t) => { if (t) t.done = true; },
    getPlayer: (room, id) => room.players.find(p => p.id === id),
    finishGame: (room, d) => { out.finished = d; },
    endToLobby: (room, msg) => { out.lobby = msg; },
    toPlayer: (id, ev, d) => { if (ev === 'card:state') out.states[id] = d; },
    shuffle: a => (hands ? stack(hands) : [...a]),
    won: v => `${v}원`,
  };
  const mod = makeCards(H);
  const room = { code: 'T', gameType: 'seotda', options: { seotdaType: mode }, carry: 0, game: null,
    players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, chips: 1000000, isHost: i === 0 })) };
  const T = {
    room, mod, out,
    get g() { return room.game; },
    view: id => out.states[id],
    /** 가짜 시계를 ms 만큼 흘려요 (그 사이 타이머를 시간 순서대로 실행) */
    run(ms) {
      const end = clock + ms;
      for (;;) {
        const t = timers.filter(x => !x.done && x.due <= end).sort((a, b) => a.due - b.due)[0];
        if (!t) break;
        t.done = true; clock = t.due; t.fn();
      }
      clock = end;
    },
    p: i => room.players.find(x => x.id === 'p' + i),
    ev(i, name, d) { return mod.events[name](room, T.p(i), d); },
    /** 지금 베팅 라운드를 모두 같은 행동으로 끝내요 */
    betAll(action = 'call') {
      let guard = 20;
      while (room.game.phase === 'betting' && room.game.turnId && guard--) {
        const p = room.players.find(x => x.id === room.game.turnId);
        mod.events['card:bet'](room, p, action);
      }
    },
    chips: () => room.players.reduce((a, p) => a + p.chips, 0) + (room.game ? room.game.pot : 0),
  };
  mod.start(room);
  T.run(1000);                                          // 첫 카드 나눠 주기
  return T;
}

console.log('▶ 3장 섯다: 보여줄 카드 고르기');
{
  const T = table(2, '3card', [[C(4, 'yeol'), C(9, 'yeol'), C(1, 'gwang')], [C(2), C(5), C(6)]]);
  ok(T.g.phase === 'open' && T.g.seats.p0.hand.length === 2, '2장 받으면 보여줄 카드 고르기부터 (베팅 전)');
  let v1 = T.view('p1'), o = v1.seats.find(s => s.id === 'p0');
  ok(o.cards.every(c => c === null) && o.hid.every(Boolean) && o.openIdx === -1, '고르기 전: 남의 카드는 모두 뒷면');
  ok(T.view('p0').phaseLeft > 0 && T.view('p0').phaseSeconds === OPEN_SECONDS, '고르기 시간 표시');
  ok(T.ev(0, 'card:open', 1) === undefined && T.g.phase === 'open', '한 사람이 골라도 모두 고를 때까지 기다려요');
  v1 = T.view('p1'); o = v1.seats.find(s => s.id === 'p0');
  ok(o.ready === true && o.openIdx === -1 && o.cards.every(c => c === null), '다른 사람에게는 「골랐어요」만 (무엇을 골랐는지 비밀)');
  ok(T.view('p0').seats.find(s => s.id === 'p0').openIdx === 1, '나는 내가 고른 카드를 알아요');
  ok(typeof T.ev(1, 'card:open', 5) === 'string' && T.g.phase === 'open', '없는 카드 번호는 거절');
  T.ev(1, 'card:open', 0);
  ok(T.g.phase === 'betting' && T.g.opened, '모두 고르면 공개하고 베팅 시작');
  v1 = T.view('p1'); o = v1.seats.find(s => s.id === 'p0');
  ok(o.cards[0] === null && o.cards[1] && o.cards[1].m === 9 && o.hid.join() === 'true,false' && o.openIdx === 1, '상대가 고른 카드(9월)만 보여요');
  ok(T.ev(0, 'card:open', 0) === '지금은 보여줄 카드를 고를 때가 아니에요.', '고르기가 끝나면 다시 못 바꿔요');

  console.log('▶ 3장 섯다: 3장 중 2장 직접 고르기 (자동 선택 없음)');
  const total = T.chips();
  T.betAll('call');
  T.run(1000);
  ok(T.g.phase === 'pick' && T.g.seats.p0.hand.length === 3 && T.g.seats.p0.ev === null, '3번째 카드를 받으면 족보 고르기 (마지막 베팅 전) · 자동으로 정하지 않아요');
  const me = T.view('p0').seats.find(s => s.id === 'p0');
  ok(me.combos && me.combos.length === 3 && me.combos.map(c => c.name).join('|') === '멍텅구리구사(3끗)|독사|구삥', '세 가지 조합과 이름: ' + (me.combos || []).map(c => c.name).join(' · '));
  const seen = T.view('p1').seats.find(s => s.id === 'p0');
  ok(!seen.combos && seen.pick === null && seen.cards.filter(Boolean).length === 1, '남에게는 조합이 안 보이고 공개한 1장만 보여요');
  ok(typeof T.ev(0, 'card:pick', [0, 0]) === 'string' && typeof T.ev(0, 'card:pick', [0, 3]) === 'string' && typeof T.ev(0, 'card:pick', 'x') === 'string', '잘못된 조합은 거절');
  ok(typeof T.ev(0, 'card:bet', 'call') === 'string', '고르는 동안에는 베팅 못 해요');
  T.ev(0, 'card:pick', [1, 0]);                           // 순서가 바뀌어도 괜찮아요 → [0, 1] 멍텅구리구사
  ok(T.g.seats.p0.pick.join() === '0,1' && T.g.seats.p0.ev.name === '멍텅구리구사(3끗)' && T.g.phase === 'pick', '멍텅구리구사를 직접 골랐어요 (가장 높은 독사 대신)');
  T.ev(1, 'card:pick', [0, 2]);                           // 2 + 6 = 8끗
  ok(T.g.phase === 'betting', '모두 고르면 마지막 베팅');
  ok(T.view('p1').seats.find(s => s.id === 'p0').pick === null, '마지막 베팅 중에도 남이 고른 족보는 비밀');
  ok(T.view('p0').seats.find(s => s.id === 'p0').handName === '멍텅구리구사(3끗)', '내 자리에는 고른 족보 이름');
  T.betAll('call');
  T.run(1000);
  ok(T.g.phase === 'showdown' && T.out.results.length === 1 && T.out.results[0].winners.length === 0 && /멍텅구리구사/.test(T.out.results[0].message), '고른 멍텅구리구사로 재경기: ' + (T.out.results[0] || {}).message);
  ok(T.room.carry === T.g.pot && T.chips() === total, '판돈 이월 · 돈 합계 그대로');
  const sd = T.view('p1').seats.find(s => s.id === 'p0');
  ok(sd.pick && sd.pick.join() === '0,1' && sd.cards.every(Boolean) && sd.handName === '멍텅구리구사(3끗)', '공개할 때 고른 2장과 족보가 보여요');
}
{
  const T = table(2, '3card', [[C(3, 'gwang'), C(7, 'yeol'), C(9)], [C(5), C(5), C(2)]]);
  T.ev(0, 'card:open', 0); T.ev(1, 'card:open', 1);
  T.betAll('call'); T.run(1000);
  T.ev(0, 'card:pick', [0, 1]);                           // 땡잡이 (3광 + 7열)
  T.ev(1, 'card:pick', [0, 1]);                           // 5땡
  T.betAll('call'); T.run(1000);
  const r = T.out.results[0];
  ok(r && r.winners.length === 1 && r.winners[0].id === 'p0' && r.winners[0].hand === '땡잡이(망통)', '땡잡이를 직접 골라 5땡을 잡아요');
}
{
  const T = table(2, '3card', [[C(4, 'yeol'), C(7, 'yeol'), C(1)], [C(1, 'gwang'), C(8, 'gwang'), C(2)]]);
  T.ev(0, 'card:open', 1); T.ev(1, 'card:open', 0);
  T.betAll('call'); T.run(1000);
  T.ev(0, 'card:pick', [0, 1]);                           // 암행어사
  T.ev(1, 'card:pick', [0, 1]);                           // 18광땡
  T.betAll('call'); T.run(1000);
  const r = T.out.results[0];
  ok(r && r.winners[0].id === 'p0' && r.winners[0].hand === '암행어사(1끗)', '암행어사를 직접 골라 18광땡을 잡아요');
}

console.log('▶ 3장 섯다: 시간 초과');
{
  const T = table(2, '3card', [[C(4, 'yeol'), C(9, 'yeol'), C(1, 'gwang')], [C(2), C(5), C(6)]]);
  T.run(OPEN_SECONDS * 1000 - 300);                       // 고르기는 900ms 에 시작했어요
  ok(T.g.phase === 'open', '시간 안에는 기다려요');
  T.run(400);
  ok(T.g.phase === 'betting' && T.g.seats.p0.open === 0 && T.g.seats.p1.open === 0 && T.out.sys.some(m => m.includes('시간 초과')), '시간이 지나면 첫 번째 카드를 보여줘요');
  T.betAll('call'); T.run(1000);
  T.ev(1, 'card:pick', [1, 2]);
  T.run(PICK_SECONDS * 1000 + 100);
  ok(T.g.phase === 'betting' && T.g.seats.p0.pick.join() === '0,2' && T.g.seats.p0.ev.name === '독사' && T.g.seats.p1.pick.join() === '1,2', '안 고른 사람만 가장 높은 조합으로 (고른 사람은 그대로)');
  ok(!T.out.sys.some(m => m.includes('독사')), '시간 초과 안내에 족보 이름은 안 나와요 (비밀)');
}

console.log('▶ 3장 섯다: 다이 · 나가기');
{
  const T = table(3, '3card', [[C(1, 'gwang'), C(2), C(3)], [C(4), C(5), C(6)], [C(7), C(8), C(9)]]);
  T.ev(0, 'card:open', 0); T.ev(1, 'card:open', 0); T.ev(2, 'card:open', 0);
  T.betAll('call'); T.run(1000);
  T.ev(0, 'card:pick', [0, 1]); T.ev(1, 'card:pick', [0, 1]);
  const [p2] = T.room.players.splice(2, 1);               // 고르는 중에 나감 (server.js dropPlayer 처럼)
  T.mod.leave(T.room, p2);
  ok(T.g.phase === 'betting', '고르는 중에 나가면 남은 사람끼리 바로 진행');
  // 마지막 베팅에서 p1 다이 → p0 기권승: 족보 비공개
  const g = T.g;
  T.ev(0, 'card:bet', 'call');
  T.ev(1, 'card:bet', 'die');
  ok(g.phase === 'showdown' && !g.revealAll, '한 명만 남으면 기권승');
  const v = T.view('p1').seats.find(s => s.id === 'p0');
  ok(v.pick === null && v.cards.filter(Boolean).length === 1, '기권승이면 고른 족보는 공개 안 해요');
}
{
  const T = table(2, '3card', [[C(1, 'gwang'), C(2), C(3)], [C(4), C(5), C(6)]]);
  T.ev(0, 'card:open', 0);
  const [p1] = T.room.players.splice(1, 1);
  T.mod.leave(T.room, p1);
  ok(T.out.lobby, '두 명일 때 고르는 중에 나가면 대기실로');
}

console.log('▶ 2장 섯다는 그대로');
{
  const T = table(2, '2card', [[C(1, 'gwang'), C(3, 'gwang')], [C(4), C(6)]]);
  ok(T.g.phase === 'betting' && T.g.seats.p0.hand.length === 1, '1장 받고 바로 베팅 (고르기 없음)');
  ok(T.view('p0').three === false && T.view('p0').seats[0].openIdx === undefined, '3장 섯다 표시 없음');
  T.betAll('call'); T.run(1000);
  ok(T.g.phase === 'betting' && T.g.seats.p0.hand.length === 2, '2장째도 바로 베팅');
  T.betAll('call'); T.run(1000);
  ok(T.out.results[0] && T.out.results[0].winners[0].hand === '13광땡', '2장으로 승부: 13광땡');
}

console.log('▶ 무작위 3장 섯다 300판 (돈 합계 · 단계 순서)');
{
  let bad = 0, hands = 0, replays = 0;
  for (let n = 0; n < 300; n++) {
    const T = table(2 + (n % 4), '3card');
    T.g.deck = [...ALL].sort(() => Math.random() - 0.5).map(c => ({ ...c }));
    const total = T.chips();
    const seen = [];
    for (let step = 0; step < 600 && T.g.phase !== 'showdown'; step++) {
      const g = T.g;
      if (seen[seen.length - 1] !== g.phase) seen.push(g.phase);
      if (g.phase === 'open') for (const p of T.room.players) if (Math.random() < 0.8) T.ev(+p.id.slice(1), 'card:open', Math.random() < 0.5 ? 0 : 1);
      if (g.phase === 'pick') for (const p of T.room.players) if (Math.random() < 0.8) { const pr = [[0, 1], [0, 2], [1, 2]][Math.floor(Math.random() * 3)]; T.ev(+p.id.slice(1), 'card:pick', pr); }
      if (g.phase === 'betting' && g.turnId) { const r = Math.random(); T.mod.events['card:bet'](T.room, T.room.players.find(x => x.id === g.turnId), r < 0.12 ? 'die' : r < 0.7 ? 'call' : r < 0.85 ? 'quarter' : r < 0.95 ? 'half' : 'allin'); }
      else T.run(500);                                    // 조금씩 (승부가 난 뒤 다음 판까지 지나가지 않게)
    }
    if (T.g.phase !== 'showdown') { bad++; continue; }
    hands++;
    if (T.out.results[0] && !T.out.results[0].winners.length) replays++;
    if (T.chips() !== total && T.room.players.reduce((a, p) => a + p.chips, 0) + T.room.carry !== total) bad++;
    const order = seen.filter(x => x !== 'dealing').join('>');
    if (!/^open(>betting)?(>pick(>betting)?)?$/.test(order)) { bad++; if (bad < 4) console.log('    단계:', order); }
  }
  ok(bad === 0 && hands === 300, `300판 모두 끝까지 · 돈 합계 보존 · 단계 순서 open → 베팅 → pick → 베팅 (재경기 ${replays}판)`);
}

console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
