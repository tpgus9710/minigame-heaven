// 🔍 틀린그림찾기 검사 (public/js/shared/spot-core.js): 같은 씨앗 → 같은 문제 · 다른 곳 개수 · 겹치지 않기 · 누른 자리 판정
const S = require('../public/js/shared/spot-core.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

console.log('▶ 같은 씨앗이면 서버 · 화면이 똑같은 문제');
{
  const a = JSON.stringify(S.make(424242, 5, 2)), b = JSON.stringify(S.make(424242, 5, 2));
  ok(a === b, '같은 씨앗 · 같은 설정 → 똑같은 그림 · 다른 곳');
  const real = Math.random; Math.random = () => { throw new Error('Math.random 을 쓰면 안 돼요'); };
  let threw = false; try { for (let k = 0; k < 30; k++) S.make(1000 + k, 6, 1 + (k % 3)); } catch (e) { threw = e.message; }
  Math.random = real;
  ok(!threw, '문제를 만들 때 Math.random 을 쓰지 않아요 (씨앗만)', threw);
  ok(JSON.stringify(S.make(7, 5, 2)) !== JSON.stringify(S.make(8, 5, 2)), '씨앗이 다르면 다른 문제');
}

console.log('▶ 장면 · 다른 곳 (900문제)');
{
  const themes = {}, kinds = {};
  let short = 0, overlap = 0, out = 0, small = 0, bad = 0;
  for (let k = 0; k < 900; k++) {
    const lv = 1 + (k % 3), n = 3 + (k % 5), p = S.make(5000 + k * 37, n, lv, k % 4 === 3 ? undefined : S.THEMES[k % 3]);
    themes[p.theme] = (themes[p.theme] || 0) + 1;
    if (p.diffs.length !== n) short++;
    p.diffs.forEach((d, i) => {
      kinds[d.kind] = (kinds[d.kind] || 0) + 1;
      if (d.x < 4 || d.x > S.W - 4 || d.y < 4 || d.y > S.H - 4) out++;
      if (d.r < 9) small++;
      p.diffs.forEach((e, j) => { if (j > i && Math.hypot(d.x - e.x, d.y - e.y) <= d.r + e.r + 6) overlap++; });
    });
    if (!p.left.every(o => S.T[o.t]) || !p.right.every(o => S.T[o.t])) bad++;
    if (k < 60) { const L = S.render(p.bg, p.left), R = S.render(p.bg, p.right); if (L === R || !/^<(defs|rect)/.test(L)) bad++; }
  }
  ok(S.THEMES.every(t => themes[t] > 250), `장면 3가지 모두 나와요 (${S.THEMES.map(t => `${S.THEME_NAMES[t]} ${themes[t]}`).join(' · ')})`);
  ok(short === 0, '늘 정해진 개수(3~7개)만큼 다른 곳을 만들어요', `모자람 ${short}`);
  ok(overlap === 0 && out === 0 && small === 0, '정답 원은 서로 겹치지 않고 · 가운데가 그림 안에 · 너무 작지 않게 (반지름 9 이상)', `겹침 ${overlap} · 밖 ${out} · 작음 ${small}`);
  ok(bad === 0, '왼쪽 · 오른쪽 그림이 그려지고 서로 달라요');
  const kk = Object.keys(kinds);
  ok(kk.length >= 20 && kinds.add > 300 && kinds.remove > 300 && kinds.color > 300, `바뀌는 종류 ${kk.length}가지 (색 ${kinds.color} · 없어짐 ${kinds.remove} · 생김 ${kinds.add} · 크기 ${kinds.size || 0} · 방향 ${kinds.flip || 0} …)`);
}

console.log('▶ 누른 자리 판정');
{
  const p = S.make(31337, 5, 2);
  const d = p.diffs;
  ok(d.every((x, i) => S.hit(d, x.x, x.y, {}) === i), '가운데를 누르면 그 다른 곳');
  ok(S.hit(d, d[0].x + d[0].r + 6, d[0].y, {}) === 0, '가장자리 조금 밖(손가락 여유 9)도 맞아요');
  ok(S.hit(d, d[0].x, d[0].y, { 0: true }) === -1 && S.near(d, d[0].x, d[0].y, { 0: true }), '이미 찾은 곳은 다시 안 쳐요 (틀린 것도 아님)');
  let far = null;
  for (let y = 5; y < S.H && !far; y += 7) for (let x = 5; x < S.W && !far; x += 7) if (d.every(q => Math.hypot(q.x - x, q.y - y) > q.r + 30)) far = [x, y];
  ok(far && S.hit(d, far[0], far[1], {}) === -1, '아무것도 없는 곳은 -1 (틀림)');
}

console.log('▶ 어려움 (level)');
{
  const avg = lv => { let s = 0, n = 0; for (let k = 0; k < 200; k++) { const p = S.make(900 + k, 5, lv); p.diffs.forEach(d => { s += d.r; n++; }); } return s / n; };
  const a1 = avg(1), a3 = avg(3);
  ok(a1 > a3, `쉬움일수록 큰 곳이 바뀌어요 (평균 반지름: 쉬움 ${a1.toFixed(1)} · 어려움 ${a3.toFixed(1)})`);
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
