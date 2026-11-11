// 🧠 카드 짝 맞추기 검사 (public/js/shared/memory-core.js): 카드 나누기 · 처음 보여 주기 · 짝/땡 · 차례 · 봇 기억력 · 끝까지 (TableKit)
const TableKit = require('../public/js/shared/table.js');
const MC = require('../public/js/shared/memory-core.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const P = (n, bots = 0) => Array.from({ length: n }, (_, i) => ({ id: (i < n - bots ? 'p' : 'bot') + i, name: 'N' + i, bot: i >= n - bots }));

console.log('▶ 카드 나누기 · 옵션');
{
  for (const pairs of [8, 12, 18, 24]) {
    const s = MC.setup(P(2), seeded(pairs), { pairs, peek: 0, theme: 'mix' });
    const cnt = {}; s.faces.forEach(f => { cnt[f] = (cnt[f] || 0) + 1; });
    ok(s.faces.length === pairs * 2 && Object.values(cnt).every(c => c === 2) && Object.keys(cnt).length === pairs, `${pairs}쌍 → 카드 ${pairs * 2}장 · 그림마다 딱 2장`);
  }
  for (const th of ['animal', 'food', 'thing']) {
    const s = MC.setup(P(2), seeded(3), { pairs: 24, theme: th });
    ok(s.faces.every(f => MC.THEMES[th].includes(f)), `그림 「${MC.THEME_NAMES[th]}」만 나와요`);
  }
  const all = [].concat(MC.THEMES.animal, MC.THEMES.food, MC.THEMES.thing);
  ok(new Set(all).size === all.length && Object.values(MC.THEMES).every(t => t.length >= 24), `그림 ${all.length}개 모두 달라요 · 주제마다 24개 넘게 (48장 판도 가능)`);
  const d = MC.setup(P(2), seeded(9), { pairs: 99, peek: 7, theme: 'zzz', mmLv: 'god' });
  ok(d.pairs === 12 && d.peek === 3 && d.theme === 'mix' && d.level === 'normal', '없는 옵션 값은 기본값 (24장 · 3초 · 섞어서 · 보통)');
}

console.log('▶ 처음에 모두 보여 주기 → 엎고 시작');
{
  const s = MC.setup(P(2), seeded(5), { pairs: 8, peek: 3 });
  ok(s.phase === 'peek' && MC.pending(s).length === 0 && MC.deadline(s) > Date.now() + 2500, '보여 주는 동안은 아무도 못 뒤집어요 (3초 + 여유)');
  ok(MC.view(s, 'p0').cards.every(c => c.f), '그동안 모든 카드 그림이 보여요');
  ok(typeof MC.act(s, s.players[0].id, { t: 'flip', i: 0 }) === 'string', '보여 주는 중에 뒤집기 → 거절');
  MC.timeup(s);
  ok(s.phase === 'play' && MC.view(s, 'p0').cards.every(c => c.f === null) && MC.pending(s)[0] === s.players[0].id, '시간이 되면 모두 엎고 첫 사람 차례');
  const s0 = MC.setup(P(2), seeded(5), { pairs: 8, peek: 0 });
  ok(s0.phase === 'play' && MC.deadline(s0) === null, '「안 보여 줌」이면 바로 시작');
}

console.log('▶ 짝 · 땡 · 차례');
{
  const s = MC.setup(P(3), seeded(11), { pairs: 8, peek: 0 });
  const [a, b, c] = s.players;
  const pairOf = i => s.faces.findIndex((f, j) => j !== i && f === s.faces[i]);
  const other = i => s.faces.findIndex((f, j) => j !== i && f !== s.faces[i] && s.owner[j] < 0);
  ok(MC.act(s, b.id, { t: 'flip', i: 0 }) === '지금은 내 차례가 아니에요.', '내 차례가 아니면 못 뒤집어요');
  ok(MC.act(s, a.id, { t: 'flip', i: 0 }) === undefined && MC.view(s, b.id).cards[0].f === s.faces[0], '첫 장을 뒤집으면 모두에게 그림이 보여요');
  ok(typeof MC.act(s, a.id, { t: 'flip', i: 0 }) === 'string', '같은 카드를 또 누르면 거절');
  MC.act(s, a.id, { t: 'flip', i: pairOf(0) });
  ok(a.n === 1 && s.owner[0] === 0 && MC.pending(s)[0] === a.id && s.last.ok, '짝 맞춤 → 가져가고 한 번 더 (같은 사람 차례)');
  ok(typeof MC.act(s, a.id, { t: 'flip', i: 0 }) === 'string', '가져간 카드는 못 뒤집어요');
  const x = s.faces.findIndex((f, j) => s.owner[j] < 0), y = other(x);
  MC.act(s, a.id, { t: 'flip', i: x }); MC.act(s, a.id, { t: 'flip', i: y });
  const v = MC.view(s, c.id);
  ok(MC.pending(s)[0] === b.id && !s.last.ok && v.cards[x].f === null && v.last.fi === s.faces[x] && v.last.fj === s.faces[y], '땡 → 다시 엎고 다음 사람 · 틀린 두 장 그림은 모두에게 잠깐 보여 줄 수 있게 (last)');
  ok(MC.lag(s) > 800, '틀린 두 장을 보여 주는 동안(약 1초)은 봇 · 시간 제한이 기다려요');
  ok(MC.auto(s) && s.owner[MC.auto(s).i] < 0, '시간 초과: 남은 카드 중 하나를 대신 뒤집어요');
}

console.log('▶ 끝까지 (TableKit · 봇 3명 · 가짜 시계)');
{
  let clock = 0; const timers = [];
  const realNow = Date.now; Date.now = () => 1e12 + clock;
  const T = TableKit.createTable(MC, P(4, 3), { rnd: seeded(77), opts: { pairs: 12, peek: 3, mmLv: 'normal' }, timeouts: true,
    setTimer: (fn, ms) => { const t = { due: clock + ms, fn, done: false }; timers.push(t); return t; }, clearTimer: t => { if (t) t.done = true; },
    onUpdate: () => {}, onEnd: r => { T.res = r; } });
  let guard = 0;
  while (!T.res && guard++ < 20000) {
    const t = timers.filter(x => !x.done).sort((p, q) => p.due - q.due)[0];
    if (!t) break;
    t.done = true; clock = t.due; t.fn();
  }
  Date.now = realNow;
  const s = T.state;
  ok(T.res && s.over && s.players.reduce((a, p) => a + p.n, 0) === 12, `끝까지 가요: 12쌍 모두 주인 (${s.players.map(p => p.n).join(' · ')})`);
  ok(T.res.ranking.length === 4 && /우승|공동|무승부/.test(T.res.title), `결과: ${T.res.title} · ${T.res.ranking.map(r => r.value).join(' ')}`);
  ok(s.flips >= 24, `카드를 ${s.flips}번 뒤집었어요 (사람은 시간 초과로 대신)`);
}

console.log('▶ 봇 기억력: 고수 > 보통 > 쉬움');
{
  const duel = (lvA, lvB, n) => {
    let winA = 0, flipsA = 0;
    for (let g = 0; g < n; g++) {
      const rnd = seeded(1000 + g);
      const s = MC.setup([{ id: 'A', name: 'A', bot: true }, { id: 'B', name: 'B', bot: true }], rnd, { pairs: 12, peek: 0 });
      s.lv = { A: lvA, B: lvB };                                // 봇마다 실력을 다르게
      for (let k = 0; k < 600 && !s.over; k++) { const id = MC.pending(s)[0]; MC.act(s, id, MC.ai(s, id)); }
      const A = s.players.find(p => p.id === 'A'), B = s.players.find(p => p.id === 'B');
      if (A.n > B.n) winA++; else if (A.n === B.n) winA += 0.5;
      flipsA += s.flips;
    }
    return { rate: winA / n, flips: flipsA / n };
  };
  const hn = duel('hard', 'normal', 400), ne = duel('normal', 'easy', 400);
  ok(hn.rate > 0.55, `고수 vs 보통: 고수 승률 ${(hn.rate * 100).toFixed(0)}%`);
  ok(ne.rate > 0.55, `보통 vs 쉬움: 보통 승률 ${(ne.rate * 100).toFixed(0)}%`);
  const solo = lv => { let f = 0; for (let g = 0; g < 100; g++) { const s = MC.setup([{ id: 'A', name: 'A', bot: true }], seeded(500 + g), { pairs: 12, peek: 0, mmLv: lv }); for (let k = 0; k < 800 && !s.over; k++) MC.act(s, 'A', MC.ai(s, 'A')); f += s.flips; } return f / 100; };
  const fh = solo('hard'), fe = solo('easy');
  ok(fh < fe && fh < 50, `혼자 다 맞히는 데 뒤집은 횟수: 고수 ${fh.toFixed(1)}번 · 쉬움 ${fe.toFixed(1)}번 (24장)`);
  // 봇은 기억한 것만 써요 (모르는 카드 그림은 몰라요)
  const s = MC.setup([{ id: 'A', name: 'A', bot: true }, { id: 'p', name: 'p' }], seeded(42), { pairs: 8, peek: 0, mmLv: 'hard' });
  s.mem.A = [];
  const first = MC.ai(s, 'A');
  ok(first && first.t === 'flip' && s.owner[first.i] < 0, '아무것도 모르면 아무 카드나 (아직 안 본 카드)');
}

console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
