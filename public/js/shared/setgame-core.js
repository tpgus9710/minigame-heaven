/* =====================================================================
 *  🔺 세트 찾기 규칙 (보드게임 SET 방식) — 서버(games/setgame.js) · 화면(setgame.js) 이 함께 써요
 *  카드 81장 = 개수(1 · 2 · 3) × 모양(동그라미 · 세모 · 네모) × 색(빨강 · 초록 · 파랑) × 채우기(꽉 참 · 반만 · 빈)
 *  세 장이 네 가지 특징마다 '모두 같거나 모두 다르면' 세트! (두 장은 같고 한 장만 다르면 세트가 아니에요)
 *  바닥에 12장. 바닥에 세트가 없으면 3장씩 더 놓아요(20장이면 반드시 세트가 있어요). 더미가 비고 세트가 없으면 끝.
 *  카드 번호 id(0~80): 개수 = id % 3 · 모양 = ⌊id/3⌋ % 3 · 색 = ⌊id/9⌋ % 3 · 채우기 = ⌊id/27⌋
 *  세 값의 합이 3의 배수면 '모두 같음' 또는 '모두 다름' → 특징 네 개 모두 그러면 세트예요.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SetCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const M = [1, 3, 9, 27];
  const attr = id => M.map(m => Math.floor(id / m) % 3);
  const valid = id => Number.isInteger(id) && id >= 0 && id < 81;
  function isSet(a, b, c) {
    if (!valid(a) || !valid(b) || !valid(c) || a === b || b === c || a === c) return false;
    for (const m of M) if ((Math.floor(a / m) % 3 + Math.floor(b / m) % 3 + Math.floor(c / m) % 3) % 3) return false;
    return true;
  }
  /** 두 장과 세트가 되는 단 하나의 카드 */
  function third(a, b) { let id = 0; for (const m of M) id += ((6 - Math.floor(a / m) % 3 - Math.floor(b / m) % 3) % 3) * m; return id; }
  /** 바닥의 세트들 [[a, b, c], …] (limit 개까지) */
  function findSets(cards, limit = 1e9) {
    const L = cards.filter(x => x != null).sort((a, b) => a - b), on = new Set(L), out = [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const t = third(L[i], L[j]);
      if (t > L[j] && on.has(t)) { out.push([L[i], L[j], t]); if (out.length >= limit) return out; }
    }
    return out;
  }
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /** 새 판: { deck, table, over, added(방금 3장 더 놓은 횟수) } */
  function newGame(rnd) {
    const deck = shuffle(Array.from({ length: 81 }, (_, i) => i), rnd || Math.random);
    const s = { deck, table: deck.splice(0, 12), over: false, added: 0 };
    ensure(s);
    return s;
  }
  /** 바닥에 세트가 없으면 3장씩 더 · 더미도 비었으면 끝 */
  function ensure(s) {
    s.added = 0;
    while (!findSets(s.table, 1).length && s.deck.length) { s.table.push(...s.deck.splice(0, 3)); s.added++; }
    s.over = !findSets(s.table, 1).length;
    return s;
  }
  /**
   * 세트 가져가기 → 'ok' · 'bad'(세트가 아님) · 'late'(이미 없는 카드)
   * 바닥이 12장이면 빈 자리에 새 카드(자리 그대로) · 12장보다 많으면 새로 놓지 않고 뒤쪽 카드를 빈 자리로 옮겨 줄여요.
   */
  function claim(s, ids) {
    if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3 || !ids.every(valid)) return 'bad';
    const pos = ids.map(id => s.table.indexOf(id));
    if (pos.some(p => p < 0)) return 'late';
    if (!isSet(...ids)) return 'bad';
    const t = s.table.slice();
    if (t.length <= 12 && s.deck.length >= 3) pos.forEach(p => { t[p] = s.deck.shift(); });
    else {
      const L = t.length - 3, holes = pos.filter(p => p < L).sort((a, b) => a - b);
      const movers = [];
      for (let i = L; i < t.length; i++) if (!pos.includes(i)) movers.push(t[i]);
      holes.forEach((h, k) => { t[h] = movers[k]; });
      t.length = L;
    }
    s.table = t;
    ensure(s);
    return 'ok';
  }
  /** 봇이 세트 하나를 찾는 데 걸리는 시간(ms): 실력 · 바닥 카드 수(많을수록 조금 빨리 보여요) */
  const BOT_MS = { easy: [15000, 28000], normal: [8000, 16000], hard: [4000, 8500] };
  function botDelay(level, rnd, n) {
    const [a, b] = BOT_MS[level] || BOT_MS.normal, k = n > 12 ? 0.85 : 1;
    return Math.round((a + (b - a) * (rnd || Math.random)()) * k);
  }
  const NAMES = { n: ['1개', '2개', '3개'], shape: ['동그라미', '세모', '네모'], color: ['빨강', '초록', '파랑'], fill: ['꽉 참', '반만', '빈'] };
  /** 세트가 아닌 까닭 (틀렸을 때 알려 줘요): '색: 두 장만 같아요' */
  function why(a, b, c) {
    const label = ['개수가', '모양이', '색이', '채우기가'];
    for (let k = 0; k < 4; k++) {
      const v = [a, b, c].map(id => attr(id)[k]);
      if ((v[0] + v[1] + v[2]) % 3) return `${label[k]} 두 장만 같아요`;
    }
    return '';
  }
  return { attr, isSet, third, findSets, newGame, ensure, claim, botDelay, BOT_MS, NAMES, why, shuffle };
});
