// 체스 규칙 검사: 표준 perft 수 (chessprogramming.org "Perft Results") + 특수 규칙 · 기보 · 무승부 · 시계 · AI
const C = require('../public/js/shared/chess-core.js');
const TableKit = require('../public/js/shared/table.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

function perft(pos, d) {
  if (d === 0) return 1;
  const ms = C.legalMoves(pos);
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) { const u = C.make(pos, m); n += perft(pos, d - 1); C.unmake(pos, m, u); }
  return n;
}
const DEEP = process.argv.includes('--deep');
const CASES = [
  ['시작 국면', C.START, [20, 400, 8902, 197281, ...(DEEP ? [4865609] : [])]],
  ['Kiwipete (캐슬링 · 앙파상 · 핀)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, ...(DEEP ? [4085603] : [])]],
  ['국면 3 (앙파상 핀 · 끝내기)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['국면 4 (프로모션 · 체크)', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['국면 4 뒤집음', 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1', [6, 264, 9467, 422333]],
  ['국면 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, ...(DEEP ? [2103487] : [])]],
  ['국면 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, ...(DEEP ? [3894594] : [])]],
];
console.log('▶ 움직임 생성 (perft)');
for (const [name, fen, want] of CASES) {
  const pos = C.fromFen(fen), got = [];
  const t0 = Date.now();
  for (let d = 1; d <= want.length; d++) got.push(perft(pos, d));
  ok(got.every((n, i) => n === want[i]) && C.toFen(pos, true) === C.toFen(C.fromFen(fen), true), `${name}: ${got.join(' / ')} (${Date.now() - t0}ms)`, `기대 ${want.join(' / ')}`);
}
{ // 해시가 되돌린 뒤에도 같아요 · 다시 계산한 값과 같아요
  const pos = C.fromFen(CASES[1][1]); let bad = 0;
  (function walk(d) {
    if (!d) return;
    for (const m of C.legalMoves(pos)) {
      const h = [pos.h1, pos.h2], u = C.make(pos, m);
      const fresh = C.fromFen(C.toFen(pos, true));
      if (fresh.h1 !== pos.h1 || fresh.h2 !== pos.h2) bad++;
      walk(d - 1);
      C.unmake(pos, m, u);
      if (pos.h1 !== h[0] || pos.h2 !== h[1]) bad++;
    }
  })(2);
  ok(bad === 0, `국면 해시가 항상 맞아요 (어긋남 ${bad})`);
}

console.log('▶ 기보 (SAN)');
function play(fen, sans) {
  const pos = C.fromFen(fen), out = [];
  for (const want of sans) {
    const legal = C.legalMoves(pos);
    const m = legal.find(x => C.san(pos, x, legal) === want);
    if (!m) return { err: `${want} 을(를) 찾지 못함 (가능: ${legal.map(x => C.san(pos, x, legal)).join(' ')})`, pos };
    out.push(C.san(pos, m, legal)); C.make(pos, m);
  }
  return { out, pos };
}
let r = play(C.START, ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);
ok(!r.err && C.legalMoves(r.pos).length === 0 && C.inCheck(r.pos), '스콜라 메이트: Qxf7# (체크메이트)', r.err);
r = play('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1', ['Nbd2']);
ok(!r.err, '같은 칸으로 가는 나이트 두 개: 파일로 구분 (Nbd2)', r.err);
r = play('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1', ['R1a3']);
ok(!r.err, '같은 줄의 룩 두 개: 랭크로 구분 (R1a3)', r.err);
r = play('8/8/1k6/8/4Q2Q/8/8/K6Q w - - 0 1', ['Qh4e1']);
ok(!r.err, '파일 · 랭크 둘 다 필요한 퀸 (Qh4e1)', r.err);
r = play('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['O-O', 'O-O-O']);
ok(!r.err && C.toFen(r.pos).startsWith('2kr3r/8/8/8/8/8/8/R4RK1 w - -'), '캐슬링 O-O · O-O-O (킹 · 룩 자리)', r.err || C.toFen(r.pos));
r = play('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', ['exd6']);
ok(!r.err && C.toFen(r.pos).startsWith('4k3/8/3P4/8/8/8/8/4K3'), '앙파상 (exd6 · 잡힌 폰이 사라져요)', r.err || C.toFen(r.pos));
r = play('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', ['e8=Q']);
ok(!r.err, '프로모션 e8=Q', r.err);
r = play('3k4/4P3/8/8/8/8/8/4K3 w - - 0 1', ['e8=N']);
ok(!r.err && C.toFen(r.pos).startsWith('3kN3'), '나이트로 프로모션 e8=N', r.err);
r = play('k7/4P3/8/8/8/8/8/4K3 w - - 0 1', ['e8=Q+']);
ok(!r.err, '프로모션하면서 체크 e8=Q+', r.err);
{
  const pos = C.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const names = C.legalMoves(pos).map(m => C.san(pos, m, C.legalMoves(pos)));
  ok(names.includes('O-O') && names.includes('O-O-O'), '캐슬링할 수 있어요');
  const p2 = C.fromFen('r3k2r/8/8/4r3/8/8/8/R3K2R w KQkq - 0 1');      // e5 룩이 e1 체크 → 캐슬링 불가
  const n2 = C.legalMoves(p2).map(m => C.san(p2, m, C.legalMoves(p2)));
  ok(!n2.includes('O-O') && !n2.includes('O-O-O'), '체크 중에는 캐슬링 못 해요');
  const p3 = C.fromFen('r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1');      // g2 룩이 g1 공격 → 킹 쪽 캐슬링 불가
  const n3 = C.legalMoves(p3).map(m => C.san(p3, m, C.legalMoves(p3)));
  ok(!n3.includes('O-O') && n3.includes('O-O-O'), '지나가거나 도착할 칸이 공격받으면 그쪽 캐슬링 못 해요');
  const p4 = C.fromFen('r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1');      // b2 룩이 b1 공격 (b1 은 킹이 지나가지 않음) → 퀸 쪽 캐슬링 가능
  const n4 = C.legalMoves(p4).map(m => C.san(p4, m, C.legalMoves(p4)));
  ok(n4.includes('O-O-O'), 'b1 칸만 공격받으면 퀸 쪽 캐슬링은 돼요 (킹이 지나가지 않는 칸)');
  const p5 = C.fromFen('4k3/8/8/K2pP2r/8/8/8/8 w - d6 0 1');          // 앙파상하면 킹이 룩에게 노출 → 불가
  const n5 = C.legalMoves(p5).map(m => C.san(p5, m, C.legalMoves(p5)));
  ok(!n5.includes('exd6'), '앙파상으로 킹이 노출되면 못 해요 (가로 핀)');
}

console.log('▶ 게임 진행 · 무승부 규칙');
function game(opts = {}, players = [{ id: 'w', name: '백돌이' }, { id: 'b', name: '흑돌이' }]) {
  let NOW = 1e12; const real = Date.now; Date.now = () => NOW;
  const s = C.setup(players, () => 0.9, opts);   // 0.9 → 순서 그대로 (w 가 백)
  Date.now = real;
  return s;
}
const byNames = (s, sans) => {
  for (const want of sans) {
    const pos = s.pos, legal = C.legalMoves(pos), m = legal.find(x => C.san(pos, x, legal) === want);
    if (!m) return `${want} 없음`;
    const id = s.players[pos.turn === 0 ? 0 : 1].id;
    const err = C.act(s, id, { t: 'move', f: C.sq64(m.from), to: C.sq64(m.to), p: m.flags & C.F_PRO ? 'q' : undefined });
    if (err) return err;
  }
  return null;
};
{
  const s = game();
  ok(s.players[0].color === 0 && s.players[0].id === 'w', '첫 사람이 백 (주사위 값에 따라)');
  ok(C.act(s, 'b', { t: 'move', f: 52, to: 36 }) === '지금은 내 차례가 아니에요.', '내 차례가 아니면 못 둬요');
  ok(!!C.act(s, 'w', { t: 'move', f: 52, to: 28 }), '규칙에 맞지 않는 수는 거절 (e2-e5)');
  ok(!!C.act(s, 'w', { t: 'move', f: 99, to: 28 }) && !!C.act(s, 'w', { t: 'move', f: 'x', to: 28 }), '이상한 값도 거절');
  const e = byNames(s, ['f3', 'e5', 'g4', 'Qh4#']);
  ok(!e && s.over && s.winner === 'b' && s.reason === 'mate', `바보 메이트 → 흑 승 (${s.msg})`, e);
  const res = C.result(s);
  ok(res && /흑돌이/.test(res.title) && res.winners[0] === 'b', `결과: ${res && res.title}`);
}
{
  const s = game();
  const e = byNames(s, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']);
  ok(!e && !s.over, '같은 국면 2번까지는 계속');
  byNames(s, ['Ng8']);
  ok(s.over && s.reason === 'repetition' && s.winner === null, `3회 반복 → 무승부 (${s.msg})`);
}
{
  const s = game({ fen: '7k/5Q2/8/6K1/8/8/8/8 w - - 0 1' });
  const e = byNames(s, ['Kg6']);
  ok(!e && s.over && s.reason === 'stalemate', `스테일메이트 → 무승부 (${s.msg})`, e);
}
{
  const s = game({ fen: '4k3/8/8/8/8/8/3r4/4K3 w - - 0 1' });
  byNames(s, ['Kxd2']);
  ok(s.over && s.reason === 'material', `킹 대 킹 → 기물 부족 무승부 (${s.msg})`);
  ok(C.insufficient(C.fromFen('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1')) && C.insufficient(C.fromFen('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1')), '킹+비숍 / 킹+나이트 대 킹 → 기물 부족');
  ok(C.insufficient(C.fromFen('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1')), '같은 색 칸 비숍끼리 → 기물 부족');
  ok(!C.insufficient(C.fromFen('4k1b1/8/8/8/8/8/8/2B1K3 w - - 0 1')) && !C.insufficient(C.fromFen('4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1')) && !C.insufficient(C.fromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')), '다른 색 비숍 · 나이트 둘 · 폰이 있으면 계속');
}
{
  const s = game({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 99 60' });
  byNames(s, ['Ra2']);
  ok(s.over && s.reason === 'fifty', `50수 규칙 → 무승부 (${s.msg})`);
}
{
  const s = game();
  ok(!C.act(s, 'b', { t: 'draw' }) && s.drawOffer === 'b', '무승부 제안 (차례가 아니어도)');
  byNames(s, ['e4']);
  ok(s.drawOffer === null, '제안받은 사람이 수를 두면 거절한 셈');
  C.act(s, 'b', { t: 'draw' });
  ok(!!C.act(s, 'b', { t: 'drawYes' }), '내 제안을 내가 받을 수는 없어요');
  ok(!C.act(s, 'w', { t: 'drawYes' }) && s.over && s.reason === 'agreement', '상대가 받으면 합의 무승부');
  const s2 = game();
  C.act(s2, 'w', { t: 'resign' });
  ok(s2.over && s2.winner === 'b' && s2.reason === 'resign', '기권 → 상대 승');
  const s3 = game();
  C.drop(s3, 'b');
  ok(s3.over && s3.winner === 'w' && s3.reason === 'left', '게임 중에 나가면 기권');
}
{ // 무르기 (싱글)
  const s = game({ undo: true }, [{ id: 'me', name: '나' }, { id: 'bot0', name: '봇', bot: true }]);
  byNames(s, ['e4', 'e5', 'Nf3']);
  const before = C.toFen(s.pos);
  byNames(s, ['Nc6']);
  ok(!C.act(s, 'me', { t: 'undo' }) && C.toFen(s.pos).startsWith('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w'), `무르기: 내 마지막 수(Nf3) 전으로 (${C.toFen(s.pos).split(' ')[0]})`);
  ok(s.moves.length === 2 && s.moves.join(' ') === 'e4 e5', '기보도 되돌아가요');
  void before;
  const s2 = game({}, [{ id: 'me', name: '나' }, { id: 'bot0', name: '봇', bot: true }]);
  ok(!!C.act(s2, 'me', { t: 'undo' }), '멀티에서는 무르기 없음');
}

console.log('▶ 체스 시계');
{
  let NOW = 1e12; const real = Date.now; Date.now = () => NOW;
  const s = C.setup([{ id: 'w', name: '백' }, { id: 'b', name: '흑' }], () => 0.9, { clock: 3 });   // 3분 + 2초
  ok(s.clock.on && s.clock.left[0] === 180000 && C.deadline(s) === NOW + 180000, '3분 시계로 시작');
  NOW += 10000; C.act(s, 'w', { t: 'move', f: 52, to: 36 });
  ok(s.clock.left[0] === 172000, `10초 쓰고 두면 2초 추가 → 2:52 (${s.clock.left[0]})`);
  NOW += 5000; C.act(s, 'b', { t: 'move', f: 12, to: 28 });
  ok(s.clock.left[1] === 177000 && C.deadline(s) === NOW + 172000, '흑도 같은 방식');
  NOW = C.deadline(s) + 10; C.timeup(s);
  ok(s.over && s.winner === 'b' && s.reason === 'time', `시간이 끝나면 패배 (${s.msg})`);
  const s2 = C.setup([{ id: 'w', name: '백' }, { id: 'b', name: '흑' }], () => 0.9, { clock: 5, fen: '4k3/8/8/8/8/8/4P3/4K1N1 b - - 0 1' });
  NOW = C.deadline(s2) + 10; C.timeup(s2);
  ok(s2.over && s2.winner === 'w', '흑 시간 끝 · 백에게 기물이 있으면 백 승');
  const s3 = C.setup([{ id: 'w', name: '백' }, { id: 'b', name: '흑' }], () => 0.9, { clock: 5, fen: '4k3/8/8/8/8/8/8/4K1N1 b - - 0 1' });
  NOW = C.deadline(s3) + 10; C.timeup(s3);
  ok(s3.over && s3.winner === null && s3.reason === 'time', `시간이 끝나도 상대가 체크메이트할 수 없으면 무승부 (${s3.msg})`);
  Date.now = real;
}

console.log('▶ AI');
{
  const t = (fen, want, lv = 'normal') => { const pos = C.fromFen(fen); const m = C.search(pos, C.LEVELS[lv], [pos.h1], () => 0.5); const legal = C.legalMoves(pos); return [C.san(pos, legal.find(x => x.from === m.from && x.to === m.to && x.promo === m.promo), legal), want]; };
  let [g, w] = t('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'Rd8#'); ok(g === w, `한 수 메이트 찾기 (${g})`);
  [g, w] = t('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'Qxf7#'); ok(g === w, `스콜라 메이트 찾기 (${g})`);
  [g, w] = t('4k3/8/8/8/3q4/8/3Q4/7K b - - 0 1', 'Qxd2'); ok(g === w, `지켜지지 않은 퀸 잡기 (${g})`);
  [g, w] = t('6k1/8/8/8/8/8/1q6/K7 w - - 0 1', 'Kxb2'); ok(g === w, `킹으로 잡기 (${g})`);
  [g] = t('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', '?', 'hard');
  ok(['Bb5', 'Bc4', 'd4', 'Nc3', 'c3', 'Be2', 'd3'].includes(g), `어려움: 평범한 수를 둬요 (${g})`);
  // 봇끼리 한 판: 규칙대로 끝까지 (TableKit 으로)
  let NOW = 1e12; const real = Date.now; Date.now = () => NOW;
  let Qt = [], res = null, seq = 0;
  const T = TableKit.createTable(C, [{ id: 'a', name: 'A', bot: true }, { id: 'z', name: 'Z', bot: true }], {
    rnd: Math.random, opts: { level: 'easy' }, setTimer: (fn, ms) => { const x = { at: NOW + ms, fn, id: ++seq }; Qt.push(x); return x; }, clearTimer: x => { Qt = Qt.filter(y => y !== x); },
    onUpdate() {}, onEnd: r => { res = r; },
  });
  for (let i = 0; i < 4000 && !res && Qt.length; i++) { Qt.sort((a, b) => a.at - b.at || a.id - b.id); const x = Qt.shift(); NOW = Math.max(NOW, x.at); x.fn(); }
  Date.now = real;
  ok(!!res && T.state.moves.length > 4, `봇끼리 끝까지: ${res && res.title} (${T.state.moves.length}수 · ${T.state.reason})`);
  const v = T.view('a');
  ok(v.board.length === 64 && Array.isArray(v.moves) && v.over, '화면 정보 (판 64칸 · 기보)');
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
