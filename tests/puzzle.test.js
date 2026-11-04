// 스도쿠 · 노노그램 규칙 검사: 퍼즐마다 답이 하나뿐인지 · 찍지 않고 풀리는지 · 난이도 · 힌트가 맞는지 · 대결 진행률
const SU = require('../public/js/shared/sudoku-core.js');
const NG = require('../public/js/shared/nonogram-core.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

console.log('▶ 스도쿠');
for (const lv of ['easy', 'normal', 'hard']) {
  const L = SU.LEVELS[lv]; let bad = '', t0 = Date.now();
  for (let k = 0; k < 25 && !bad; k++) {
    const p = SU.make(lv, 1000 + k), g = SU.parse(p.givens), sol = SU.parse(p.solution);
    if (SU.count(g, 2) !== 1) bad = `답이 하나가 아님 (${k})`;
    else if (SU.conflicts(sol).size || sol.includes(0)) bad = '정답판이 규칙에 안 맞음';
    else if (g.some((v, i) => v && v !== sol[i])) bad = '처음 숫자가 정답과 다름';
    else { const r = SU.rate(g); if (!r.solved) bad = '찍지 않고는 안 풀림'; else if (r.max > L.tech[1]) bad = `${lv} 인데 너무 어려움 (${r.max})`; else if (p.clues < L.min - 1 || p.clues > L.max) bad = `숫자 ${p.clues}개`; }
  }
  ok(!bad, `${L.label}: 25개 모두 답 하나 · 찍지 않고 풀림 · 난이도 맞음 (평균 ${Math.round((Date.now() - t0) / 25)}ms)`, bad);
}
ok(SU.make('normal', 7).givens === SU.make('normal', 7).givens, '같은 시드 → 같은 퍼즐');
{ // 힌트: 항상 맞는 숫자 · 이유
  const p = SU.make('hard', 42), sol = SU.parse(p.solution); let cur = SU.parse(p.givens), bad = '', n = 0;
  while (cur.includes(0) && n++ < 81) { const h = SU.hint(cur, p.solution); if (!h || h.v !== sol[h.i] || cur[h.i]) { bad = JSON.stringify(h); break; } cur[h.i] = h.v; }
  ok(!bad && !cur.includes(0), `어려움 퍼즐을 힌트만으로 끝까지 (${n}번 · 이유 ${SU.hint(SU.parse(p.givens), p.solution).text.slice(0, 30)}…)`, bad);
  const wrong = SU.parse(p.givens); const i = wrong.indexOf(0); wrong[i] = sol[i] === 9 ? 1 : sol[i] + 1;
  const h = SU.hint(wrong, p.solution);
  ok(h.kind === 'wrong' && h.i === i && h.v === sol[i], '틀린 숫자가 있으면 그 칸부터 알려 줘요');
}
{ // 대결 진행률
  const p = SU.make('easy', 3);
  ok(SU.progress(p.givens, p.solution, p.solution).done, '정답이면 done');
  ok(SU.progress(p.givens, p.solution, p.givens).pct === 0, '안 채우면 0%');
  ok(SU.progress(p.givens, p.solution, '1'.repeat(81)) === null && SU.progress(p.givens, p.solution, 'abc') === null, '처음 숫자를 바꾸거나 이상한 판은 거부');
  ok(SU.conflicts(SU.parse('11' + '0'.repeat(79))).size === 2, '같은 줄에 같은 숫자 → 빨간 표시 2칸');
}

console.log('▶ 노노그램');
{ // 줄 풀이기 = 모든 경우를 다 따져 본 결과와 같아요 (짧은 줄 전부)
  let bad = '';
  for (let n = 1; n <= 9 && !bad; n++) {
    const lines = []; for (let m = 0; m < 1 << n; m++) lines.push(Array.from({ length: n }, (_, k) => (m >> k) & 1));
    for (let t = 0; t < 300 && !bad; t++) {
      const truth = lines[Math.floor(Math.random() * lines.length)], cl = NG.clue(truth);
      const known = truth.map(v => (Math.random() < 0.3 ? v : -1));
      const fit = lines.filter(L => String(NG.clue(L)) === String(cl) && L.every((v, k) => known[k] === -1 || known[k] === v));
      const want = known.map((v, k) => (fit.every(L => L[k] === 1) ? 1 : fit.every(L => L[k] === 0) ? 0 : -1));
      const got = NG.lineSolve(cl, known);
      if (!got || got.join() !== want.join()) bad = `n=${n} clue=${cl} known=${known} want=${want} got=${got}`;
    }
  }
  ok(!bad, '줄 풀이기: 길이 1~9 줄 2700개가 전부 따져 본 결과와 같아요', bad);
  ok(NG.lineSolve([3], [1, -1, -1, -1, 0]) && NG.lineSolve([3], [1, 0, -1, -1, -1]) === null, '모순이면 null');
}
for (const lv of ['s5', 's10', 's15']) {
  let bad = '', pics = 0;
  for (let k = 0; k < 30 && !bad; k++) {
    const p = NG.make(lv, { seed: 500 + k }), S = NG.solve(p.w, p.h, p.rows, p.cols);
    if (!S.solved || S.grid.join('') !== p.sol) bad = `${p.name} 안 풀림`;
    if (p.pic >= 0) pics++;
  }
  ok(!bad, `${NG.LEVELS[lv].label}: 30개 모두 단서만으로 풀려요 (그림 ${pics}개)`, bad);
}
ok(NG.PICTURES.length >= 15 && NG.PICTURES.every(p => NG.unique(p.w, p.h, p.g)), `그림 ${NG.PICTURES.length}개 모두 답이 하나 (${NG.PICTURES.map(p => p.name).join(' · ')})`);
{ // 힌트만으로 끝까지
  const p = NG.make('s15', { seed: 9, picture: true }); const cur = new Array(p.w * p.h).fill(0); let n = 0, bad = '';
  while (n++ < 400) {
    const done = p.rows.every((cl, r) => NG.lineDone(cl, cur.slice(r * p.w, r * p.w + p.w))) && p.cols.every((cl, c) => NG.lineDone(cl, Array.from({ length: p.h }, (_, r) => cur[r * p.w + c])));
    if (done) break;
    const h = NG.hint(p.w, p.h, p.rows, p.cols, p.sol, cur);
    if (!h) { bad = '힌트 없음'; break; }
    for (const i of h.cells) { if ((h.fill ? '1' : '0') !== p.sol[i]) bad = '틀린 힌트'; cur[i] = h.fill ? 1 : 2; }
  }
  ok(!bad && cur.map(v => (v === 1 ? 1 : 0)).join('') === p.sol, `15×15 그림(${p.name})을 힌트만으로 끝까지 (${n}번)`, bad);
  const pr = NG.progress(p.sol, cur.join(''));
  ok(pr.done && pr.pct === 100, '대결: 다 맞으면 done · 100%');
  ok(NG.progress(p.sol, '1'.repeat(p.sol.length)).done === false && NG.progress(p.sol, '1'.repeat(p.sol.length)).pct === 99, '전부 칠하면 99%에서 멈추고 완성은 아님');
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
