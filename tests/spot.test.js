// 🔍 틀린그림찾기 v2 검사 (public/js/shared/spot-core.js + shared/spot/*.js)
//  같은 씨앗 → 같은 문제 · 장면 8가지 · 다른 곳 개수 · 겹치지 않기 · 난이도 · 누른 자리 판정
//  (그림이 정답 원 밖에서 한 점도 달라지지 않는지는 브라우저로 그려서 비교해요: 개발용 spot_check.py)
const S = require('../public/js/shared/spot-core.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

console.log('▶ 같은 씨앗이면 서버 · 화면이 똑같은 문제');
{
  const a = JSON.stringify(S.make(424242, 5, 2.5)), b = JSON.stringify(S.make(424242, 5, 2.5));
  ok(a === b, '같은 씨앗 · 같은 설정 → 똑같은 그림 · 다른 곳');
  const real = Math.random; Math.random = () => { throw new Error('Math.random 을 쓰면 안 돼요'); };
  let threw = false; try { for (let k = 0; k < 80; k++) S.make(1000 + k, 3 + (k % 7), 1 + (k % 8) * 0.5, S.THEMES[k % S.THEMES.length]); } catch (e) { threw = e.message; }
  Math.random = real;
  ok(!threw, '문제를 만들 때 Math.random 을 쓰지 않아요 (씨앗만)', threw);
  ok(JSON.stringify(S.make(7, 5, 2)) !== JSON.stringify(S.make(8, 5, 2)), '씨앗이 다르면 다른 문제');
  const real2 = { sin: Math.sin, cos: Math.cos, atan2: Math.atan2, pow: Math.pow, exp: Math.exp, log: Math.log };
  let used = '';
  for (const k of Object.keys(real2)) Math[k] = (...a) => { used = k; return real2[k](...a); };
  for (let k = 0; k < 40; k++) S.make(5000 + k, 7, 1 + (k % 8) * 0.5, S.THEMES[k % S.THEMES.length]);
  Object.assign(Math, real2);
  ok(!used, '정답을 정할 때 sin · cos 같은 함수를 안 써요 (기기마다 끝자리가 달라도 정답이 같게)', used);
}

console.log(`▶ 장면 ${S.THEMES.length}가지 · 다른 곳 (1600문제)`);
{
  const themes = {}, kinds = {}, perTheme = {};
  let short = 0, overlap = 0, out = 0, small = 0, big = 0, bad = 0;
  for (let k = 0; k < 1600; k++) {
    const lv = 1 + (k % 8) * 0.5, n = 3 + (k % 7), p = S.make(5000 + k * 37, n, lv, k % 5 === 4 ? undefined : S.THEMES[k % S.THEMES.length]);
    themes[p.theme] = (themes[p.theme] || 0) + 1;
    perTheme[p.theme] = perTheme[p.theme] || new Set();
    if (p.diffs.length !== n) short++;
    p.diffs.forEach((d, i) => {
      kinds[d.kind] = (kinds[d.kind] || 0) + 1; perTheme[p.theme].add(d.kind);
      if (d.x < 3 || d.x > S.W - 3 || d.y < 3 || d.y > S.H - 3) out++;
      if (d.r < 9) small++;
      if (d.r > 48) big++;
      p.diffs.forEach((e, j) => { if (j > i && Math.hypot(d.x - e.x, d.y - e.y) <= d.r + e.r + 6) overlap++; });
    });
    if (!p.left.every(o => S.T[o.t]) || !p.right.every(o => S.T[o.t])) bad++;
    if (JSON.stringify(p.left) === JSON.stringify(p.right)) bad++;
  }
  ok(S.THEMES.length >= 8 && S.THEMES.every(t => themes[t] > 150), `장면 ${S.THEMES.length}가지 모두 나와요 (${S.THEMES.map(t => `${S.THEME_NAMES[t]} ${themes[t]}`).join(' · ')})`);
  ok(short === 0, '늘 정해진 개수(3~9개)만큼 다른 곳을 만들어요', `모자람 ${short}`);
  ok(overlap === 0 && out === 0 && small === 0 && big === 0, '정답 원은 서로 겹치지 않고 · 가운데가 그림 안에 · 반지름 9 ~ 48', `겹침 ${overlap} · 밖 ${out} · 작음 ${small} · 큼 ${big}`);
  ok(bad === 0, '왼쪽 · 오른쪽 물건이 모두 그릴 수 있는 것이고 서로 달라요');
  const kk = Object.keys(kinds);
  ok(kk.length >= 14, `바뀌는 종류 ${kk.length}가지 (${kk.map(k => `${k} ${kinds[k]}`).join(' · ')})`);
  ok(S.THEMES.every(t => perTheme[t].size >= 4), `장면마다 차이 종류 4가지 이상 (${S.THEMES.map(t => perTheme[t].size).join(' · ')})`);
}

console.log('▶ 어려움 (level 1 ~ 4.5)');
{
  const stat = lv => { let d = 0, r = 0, c = 0; for (let k = 0; k < 240; k++) { const p = S.make(900 + k, 6, lv, S.THEMES[k % S.THEMES.length]); p.diffs.forEach(x => { d += x.d; r += x.r; c++; }); } return { d: d / c, r: r / c }; };
  const e = stat(1), m = stat(2.5), h = stat(4.5);
  ok(e.d < m.d && m.d < h.d, `어려울수록 헷갈리는 차이가 많아요 (평균 어려움 ${e.d.toFixed(2)} → ${m.d.toFixed(2)} → ${h.d.toFixed(2)})`);
  ok(e.r > h.r, `쉬울수록 큰 곳이 바뀌어요 (평균 반지름 ${e.r.toFixed(1)} → ${h.r.toFixed(1)})`);
  const U = S.U;
  let near = 0, far = 0;
  for (let k = 0; k < 200; k++) { const R = S.rng(k + 1), c = U.rgbHex([40 + R() * 200, 40 + R() * 200, 40 + R() * 200]); near += U.cdist(c, U.shift(R, c, 4.5)); far += U.cdist(c, U.shift(R, c, 1)); }
  ok(near / 200 < far / 200 && near / 200 >= 70, `바뀐 색: 쉬움은 확 다르게, 지옥은 비슷하게 (RGB 차이 평균 ${Math.round(far / 200)} → ${Math.round(near / 200)})`);
}

console.log('▶ 누른 자리 판정');
{
  const p = S.make(31337, 5, 2.5);
  const d = p.diffs;
  ok(d.every((x, i) => S.hit(d, x.x, x.y, {}) === i), '가운데를 누르면 그 다른 곳');
  ok(S.hit(d, d[0].x + d[0].r + 6, d[0].y, {}) === 0, '가장자리 조금 밖(손가락 여유 9)도 맞아요');
  ok(S.hit(d, d[0].x, d[0].y, { 0: true }) === -1 && S.near(d, d[0].x, d[0].y, { 0: true }), '이미 찾은 곳은 다시 안 쳐요 (틀린 것도 아님)');
  let far = null;
  for (let y = 5; y < S.H && !far; y += 7) for (let x = 5; x < S.W && !far; x += 7) if (d.every(q => Math.hypot(q.x - x, q.y - y) > q.r + 30)) far = [x, y];
  ok(far && S.hit(d, far[0], far[1], {}) === -1, '아무것도 없는 곳은 -1 (틀림)');
}

console.log('▶ 글자 칸 (글꼴이 달라도 정답 원이 글자 위에)');
{
  const U = S.U;
  ok(Math.abs(U.charX('3,500', 0, 10, 100) - (100 - U.textW('3,500', 10) / 2 + 3)) < 1e-9, '첫 글자 가운데');
  const [s, i] = U.digitSwap(S.rng(5), '7,800');
  ok(s !== '7,800' && s.length === 5 && /[1-9]/.test(s[i]) && s[i] !== '7,800'[i], `숫자 하나만 바꿔요 (7,800 → ${s})`);
}

console.log('▶ 멀티 옵션');
{
  const G = require('../games/spot.js');
  const o = Object.fromEntries(G.OPTIONS.map(x => [x.key, x]));
  ok(o.dfPic && o.dfPic.values.length === 4 && o.diffs.values.some(([v]) => v === 9), '그림 난이도(쉬움 ~ 지옥) · 다른 곳 9곳까지');
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
