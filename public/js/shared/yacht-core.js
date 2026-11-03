/* =====================================================================
 *  🎲 요트 다이스 규칙 — 주사위 5개를 한 턴에 최대 3번 굴려 12가지 족보 중 하나를 채워요.
 *  위쪽(1~6) 합이 63점 이상이면 보너스 +35. 12라운드 뒤 총점이 가장 높은 사람이 승리!
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.YachtCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { log } = TableKit.util;
  const CATS = [
    ['n1', '1 (에이스)', '1이 나온 눈의 합'], ['n2', '2 (듀스)', '2가 나온 눈의 합'], ['n3', '3 (트레이)', '3이 나온 눈의 합'],
    ['n4', '4 (포)', '4가 나온 눈의 합'], ['n5', '5 (파이브)', '5가 나온 눈의 합'], ['n6', '6 (식스)', '6이 나온 눈의 합'],
    ['choice', '초이스', '주사위 5개의 합'], ['four', '포 다이스', '같은 눈 4개 이상이면 5개의 합'], ['full', '풀 하우스', '같은 눈 3개 + 2개면 5개의 합 (요트도 인정)'],
    ['ss', '스몰 스트레이트', '연속된 숫자 4개면 15점'], ['ls', '라지 스트레이트', '연속된 숫자 5개면 30점'], ['yacht', '요트', '5개가 모두 같으면 50점'],
  ];
  const UPPER = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
  function calc(cat, d) {
    const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach(x => c[x]++);
    const sum = d.reduce((a, b) => a + b, 0), has = (...xs) => xs.every(x => c[x]);
    if (cat[0] === 'n') { const f = +cat[1]; return f * c[f]; }
    switch (cat) {
      case 'choice': return sum;
      case 'four': return c.some(x => x >= 4) ? sum : 0;
      case 'full': return (c.includes(3) && c.includes(2)) || c.includes(5) ? sum : 0;   // 요트(5개 같음)도 3+2로 묶을 수 있어요
      case 'ss': return has(1, 2, 3, 4) || has(2, 3, 4, 5) || has(3, 4, 5, 6) ? 15 : 0;
      case 'ls': return has(1, 2, 3, 4, 5) || has(2, 3, 4, 5, 6) ? 30 : 0;
      case 'yacht': return c.includes(5) ? 50 : 0;
      default: return 0;
    }
  }
  const upperSum = sc => UPPER.reduce((a, k) => a + (sc[k] || 0), 0);
  const total = sc => CATS.reduce((a, [k]) => a + (sc[k] || 0), 0) + (upperSum(sc) >= 63 ? 35 : 0);
  const cur = s => s.players[s.turn];

  function setup(players, rnd) {
    return {
      rnd, turn: 0, round: 1, dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rolls: 0, rollN: 0, over: false, log: [], seq: 0,
      players: players.map(p => ({ id: p.id, name: p.name, score: {} })),
      msg: `${players[0].name} 님부터! 주사위를 굴리세요. (한 턴에 3번까지)`,
    };
  }
  function act(s, id, a) {
    const p = cur(s);
    if (s.over) return '게임이 끝났어요.';
    if (p.id !== id) return '지금은 내 차례가 아니에요.';
    if (a.t === 'hold') {
      const i = +a.i;
      if (!s.rolls || s.rolls >= 3) return s.rolls ? '마지막 굴림이에요. 점수를 고르세요.' : '먼저 굴려 주세요.';
      if (!(i >= 0 && i < 5)) return;
      s.held[i] = !s.held[i];
      return;
    }
    if (a.t === 'roll') {
      if (s.rolls >= 3) return '3번 다 굴렸어요. 점수 칸을 고르세요.';
      let held = s.held;
      if (Array.isArray(a.hold) && s.rolls) held = [0, 1, 2, 3, 4].map(i => !!a.hold[i]);
      if (!s.rolls) held = [false, false, false, false, false];
      if (held.every(Boolean)) return '굴릴 주사위가 없어요. 고정을 풀어 주세요.';
      s.held = held;
      s.dice = s.dice.map((d, i) => (s.held[i] ? d : 1 + Math.floor(s.rnd() * 6)));
      s.rolls++; s.rollN++;
      log(s, { t: 'roll', id, dice: s.dice.slice(), held: s.held.slice() });
      s.msg = s.rolls < 3 ? `${p.name} 님 ${s.rolls}번째 굴림 — 남길 주사위를 누르고 다시 굴리거나 점수를 고르세요.` : `${p.name} 님 마지막 굴림! 점수 칸을 고르세요.`;
      return;
    }
    if (a.t === 'score') {
      if (!s.rolls) return '먼저 주사위를 굴려 주세요.';
      if (!CATS.some(([k]) => k === a.cat)) return '점수 칸을 골라 주세요.';
      if (p.score[a.cat] != null) return '이미 채운 칸이에요.';
      const pts = calc(a.cat, s.dice), name = CATS.find(([k]) => k === a.cat)[1];
      const before = upperSum(p.score);
      p.score[a.cat] = pts;
      log(s, { t: 'score', id, cat: a.cat, pts });
      s.msg = `${p.name} 님 ${name}에 ${pts}점!` + (before < 63 && upperSum(p.score) >= 63 ? ' 보너스 +35 달성!' : '');
      s.rolls = 0; s.held = [false, false, false, false, false];
      s.turn = (s.turn + 1) % s.players.length;
      if (s.turn === 0) s.round++;
      if (s.round > 12) { s.over = true; s.msg = '12라운드 끝! 최종 점수를 확인하세요.'; }
      return;
    }
    return '굴리거나 점수 칸을 골라 주세요.';
  }

  /* ── AI: 지금 칸을 채울 가치 vs 몇 개를 남기고 다시 굴렸을 때의 기대값 ── */
  function worth(cat, pts, sc) {
    if (cat[0] === 'n') {
      const f = +cat[1], par = f * 3, need = 63 - upperSum(sc);
      if (need <= 0) return pts - par * 0.6;
      return pts - par + (pts >= par ? 7 + (pts - par) * 0.4 : (pts - par) * 0.6);
    }
    switch (cat) {
      case 'choice': return pts - 22;
      case 'four': return pts ? pts - 8 : -9;
      case 'full': return pts ? pts - 6 : -12;
      case 'ss': return pts ? 13 : -11;
      case 'ls': return pts ? 26 : -14;
      case 'yacht': return pts ? 60 : -16;
      default: return 0;
    }
  }
  function bestNow(d, sc) {
    let best = null;
    for (const [k] of CATS) if (sc[k] == null) { const pts = calc(k, d), w = worth(k, pts, sc); if (!best || w > best.w) best = { k, w, pts }; }
    return best;
  }
  function evHold(d, hold, sc, rnd, rollsLeft) {
    const N = rollsLeft > 1 ? 28 : 40;
    let tot = 0;
    for (let n = 0; n < N; n++) {
      let dd = d.map((x, i) => (hold[i] ? x : 1 + Math.floor(rnd() * 6)));
      if (rollsLeft > 1) {   // 한 번 더 굴릴 수 있으면 간단히: 같은 눈을 모으는 방향으로 한 번 더
        const c = [0, 0, 0, 0, 0, 0, 0]; dd.forEach(x => c[x]++);
        const f = c.indexOf(Math.max(...c.slice(1)));
        const h2 = dd.map(x => x === f);
        const alt = dd.map((x, i) => (h2[i] ? x : 1 + Math.floor(rnd() * 6)));
        if (bestNow(alt, sc).w > bestNow(dd, sc).w) dd = alt;
      }
      tot += bestNow(dd, sc).w;
    }
    return tot / N;
  }
  function ai(s, id) {
    const p = cur(s);
    if (!s.rolls) return { t: 'roll' };
    const now = bestNow(s.dice, p.score);
    if (s.rolls >= 3) return { t: 'score', cat: now.k };
    let best = null;
    for (let m = 0; m < 31; m++) {           // 31 = 모두 고정은 제외
      const hold = [0, 1, 2, 3, 4].map(i => !!(m & (1 << i)));
      const ev = evHold(s.dice, hold, p.score, s.rnd, 3 - s.rolls);
      if (!best || ev > best.ev) best = { ev, hold };
    }
    if (best.ev > now.w + 1.5) return { t: 'roll', hold: best.hold };
    return { t: 'score', cat: now.k };
  }

  function view(s) {
    const p = cur(s);
    return {
      players: s.players.map(q => ({ id: q.id, name: q.name, score: q.score, upper: upperSum(q.score), bonus: upperSum(q.score) >= 63 ? 35 : 0, total: total(q.score) })),
      turnId: p.id, dice: s.dice, held: s.held, rolls: s.rolls, rollN: s.rollN, round: Math.min(12, s.round),
      preview: s.rolls ? Object.fromEntries(CATS.filter(([k]) => p.score[k] == null).map(([k]) => [k, calc(k, s.dice)])) : null,
      over: s.over, msg: s.msg, log: s.log.slice(-10), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => total(b.score) - total(a.score));
    return {
      title: ranked.length === 1 ? `🎲 최종 ${total(ranked[0].score)}점!` : total(ranked[0].score) === total(ranked[1].score)
        ? `🎲 ${ranked.filter(p => total(p.score) === total(ranked[0].score)).map(p => p.name).join(' · ')} 님 공동 우승!` : `🎲 ${ranked[0].name} 님 우승!`,
      subtitle: '위쪽(1~6) 합 63점 이상이면 보너스 +35점',
      ranking: ranked.map(p => ({ id: p.id, value: `${total(p.score)}점`, score: total(p.score) })),
    };
  }
  return {
    meta: {
      name: '요트 다이스', min: 1, max: 4, bots: true, turnSec: 45, botDelay: [900, 1500],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] }],
    },
    CATS, UPPER, calc, total,
    setup, act, ai, view, result,
    free: (s, id, a) => a.t === 'hold',
    pending: s => (s.over ? [] : [cur(s).id]),
  };
});
