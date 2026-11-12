/* =====================================================================
 *  🔍 틀린그림찾기 v3 (v13.6) — 진짜 사진으로 만든 틀린그림
 *   사진: CC0(누구나 자유롭게 쓸 수 있는) 실제 사진 → 물건 지우기 · 하나 더 넣기 · 색 바꾸기 · 크기 · 방향 · 바꿔치기를
 *         사람이 하나하나 골라서 고쳤어요 (사진 목록과 고친 곳: shared/spot-photos.js · 그림 파일: /img/spot/)
 *   한 판 = 사진 한 장 + 그 사진에서 고친 곳 몇 개 (씨앗으로 골라요) · 고친 곳은 왼쪽 · 오른쪽 아무 쪽에나 붙여요.
 *   화면(싱글 · AI 대결)과 서버(멀티: games/spot.js)가 같은 코드로 같은 판을 만들어요. 서버는 누른 자리만 확인해요.
 *   좌표는 400 × 300 (사진은 1200 × 900 = 3배) · 정답 자리는 원(x, y, r).
 *   그림 난이도 level 1.5(쉬움) ~ 4.5(지옥): 높을수록 작고 헷갈리는 곳(어려움 3)을 많이 골라요.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./spot-photos.js'));
  else root.SpotCore = factory(root.SpotPhotos);
})(typeof self !== 'undefined' ? self : this, function (LIB) {
  'use strict';
  const W = 400, H = 300, PX = 3;                      // 사진 1200 × 900 = 좌표 × 3
  const PHOTOS = LIB.PHOTOS;
  const KINDS = ['gone', 'add', 'color', 'flip', 'size', 'swap', 'move', 'turn'];
  const KIND_NAMES = { gone: '없어짐', add: '생김', color: '색', flip: '방향', size: '크기', swap: '바뀜', move: '자리', turn: '기울기' };

  /** 씨앗 → 0 ~ 1 난수 (Park–Miller · 씨앗을 한 번 잘 섞어요) — 정답을 고를 때는 사칙연산만 써요 */
  function rng(seed) {
    let h = Math.abs(Math.floor(seed)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
    let s = h % 2147483646 + 1;
    const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
    next(); next();
    return next;
  }
  /** 고친 곳 하나: [x, y, r, 어려움 1~3, 종류, 조각 x, y, w, h, 붙일 x, y, 같이 못 나오는 곳들] → 객체 */
  const diffOf = (a, j) => ({ j, x: a[0], y: a[1], r: a[2], d: a[3], kind: KINDS[a[4]] || 'gone', p: a.slice(5, 11) });
  const idx = i => ((i % PHOTOS.length) + PHOTOS.length) % PHOTOS.length;
  const photo = i => PHOTOS[idx(i)];
  /** 난이도 level 에 따라 어려움 1 · 2 · 3 을 고르는 비율 */
  function weights(lv) {
    const t = Math.max(0, Math.min(1, (lv - 1.5) / 3));            // 쉬움 0 → 지옥 1
    return [0.8 - 0.79 * t, 0.25, 0.01 + 0.79 * t];
  }
  /** 다른 곳을 n개 이상 같이 낼 수 있는 사진들 (없으면 가장 많이 낼 수 있는 사진들) */
  function eligible(n) {
    const ok = PHOTOS.map((p, i) => i).filter(i => PHOTOS[i].n >= n);
    if (ok.length) return ok;
    const top = Math.max(...PHOTOS.map(p => p.n));
    return PHOTOS.map((p, i) => i).filter(i => PHOTOS[i].n === top);
  }
  /** 사진 고르기: n곳을 낼 수 있는 사진 중에서 avoid(최근에 본 사진 번호)는 빼고 · 어려울수록 헷갈리는 곳이 많은 사진을 더 자주 */
  function pickPhoto(rnd, avoid, n, lv) {
    const all = eligible(n), a = (avoid || []).slice();             // avoid: 최근 것이 앞
    let pool = all.filter(i => !a.includes(i));
    while (!pool.length && a.length) { a.pop(); pool = all.filter(i => !a.includes(i)); }   // 다 봤으면 오래전에 본 것부터 다시
    const w = weights(lv), ws = pool.map(i => { const d = PHOTOS[i].d; let s = 0; for (const r of d) s += w[r[3] - 1]; s /= d.length; return 0.02 + s * s; });
    let sum = 0; for (const v of ws) sum += v;
    let t = rnd() * sum, k = 0;
    while (k < pool.length - 1 && t >= ws[k]) { t -= ws[k]; k++; }
    return pool[k];
  }
  /** 고친 곳 고르기: 어려움 비율대로 뽑되, 서로 겹치는 곳(같이 못 나오는 곳)은 빼요 · 모자라면 다시 뽑아요 (씨앗이 같으면 결과도 같아요) */
  function choose(rnd, rows, want, w) {
    let best = [];
    for (let tryN = 0; tryN < 24 && best.length < want; tryN++) {
      const pool = rows.map((a, j) => j), out = [], ban = new Set();
      while (out.length < want) {
        const cand = pool.filter(j => !ban.has(j) && !out.includes(j));
        if (!cand.length) break;
        let sum = 0;
        const ws = cand.map(j => { const v = w[rows[j][3] - 1] + 0.02; sum += v; return v; });
        let t = rnd() * sum, k = 0;
        while (k < cand.length - 1 && t >= ws[k]) { t -= ws[k]; k++; }
        const j = cand[k];
        out.push(j);
        for (const c of rows[j][11] || []) ban.add(c);
      }
      if (out.length > best.length) best = out;
    }
    return best.sort((a, b) => a - b);
  }
  /**
   * 한 판 만들기. seed → { seed, photo(번호), id, mirror(좌우 뒤집기), lv, diffs:[{x,y,r,d,kind,side,j}] }
   *  n: 다른 곳 개수 (사진이 낼 수 있는 만큼까지) · opt.photo: 사진 번호를 정해서 · opt.avoid: 빼고 고를 사진들
   */
  function make(seed, n, lv, opt) {
    opt = opt || {};
    const rnd = rng(seed);
    n = Math.max(1, n | 0); lv = lv == null ? 2.5 : lv;
    const pi = opt.photo != null ? idx(opt.photo) : pickPhoto(rnd, opt.avoid, n, lv);
    const ph = PHOTOS[pi];
    const mirror = !!ph.m && rnd() < 0.5;
    const js = choose(rnd, ph.d, Math.min(n, ph.n || ph.d.length), weights(lv));
    const diffs = js.map(j => { const d = diffOf(ph.d[j], j); return { x: mirror ? Math.round((W - d.x) * 10) / 10 : d.x, y: d.y, r: d.r, d: d.d, kind: d.kind, side: rnd() < 0.5 ? 0 : 1, j }; });
    return { seed, photo: pi, id: ph.id, mirror, lv, diffs };
  }
  /** 누른 자리(x, y) → 아직 못 찾은 다른 곳 번호 (없으면 -1) · tol: 손가락 여유 */
  function hit(diffs, x, y, found, tol = 9) {
    let best = -1, bd = 1e9;
    diffs.forEach((d, i) => {
      if (found && found[i] != null && found[i] !== false) return;
      const dist = Math.sqrt((d.x - x) * (d.x - x) + (d.y - y) * (d.y - y));
      if (dist <= d.r + tol && dist - d.r < bd) { bd = dist - d.r; best = i; }
    });
    return best;
  }
  /** 이미 찾은 곳을 또 눌렀나요 (틀린 걸로 치지 않아요) */
  const near = (diffs, x, y, found, tol = 9) => diffs.some((d, i) => found && found[i] != null && found[i] !== false && (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y) <= (d.r + tol) * (d.r + tol));
  /** 사진 한 장에서 같이 낼 수 있는 다른 곳 수 */
  const maxDiffs = i => photo(i).n || photo(i).d.length;

  return { W, H, PX, PHOTOS, KINDS, KIND_NAMES, rng, make, hit, near, photo, maxDiffs, weights, diffOf, eligible, choose, count: PHOTOS.length, IMG: LIB.IMG || '/img/spot/' };
});
