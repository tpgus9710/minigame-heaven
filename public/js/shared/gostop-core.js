/* =====================================================================
 *  🎴 고스톱 · 맞고 규칙 — 화면(싱글: AI와 대전)과 서버(멀티)가 같은 코드를 써요.
 *   2명 = 맞고 (피망 뉴맞고 규칙: 손패 10장 · 바닥 8장 · 7점 나기 · 피박 피 7장 이하)
 *   3명 = 고스톱 (일반 규칙: 손패 7장 · 바닥 6장 · 3점 나기 · 피박 피 5장 이하)
 *  화투 48장 + 보너스피 2장(쌍피 · 삼피) = 50장.
 *
 *  점수(족보): 광 3장 3점(비광 끼면 2점) · 4장 4점 · 5장 15점 / 열끗 5장 1점(+1장마다 1점) · 고도리 5점
 *             띠 5장 1점(+1) · 홍단 · 청단 · 초단 3점 / 피 10장 1점(+1) — 쌍피 2장 · 삼피 3장, 9월 열끗(국진)은 열끗 또는 쌍피
 *  고: 1고 +1점 · 2고 +2점 · 3고 +3점 ×2 · 4고 +4점 ×4 …   스톱하면 이긴 사람이 점수를 받아요.
 *  두 배: 흔들기 · 폭탄(번마다) · 멍따(열끗 7장 이상) · 나가리 다음 판(최대 8배) / 진 사람마다: 피박 · 광박 · 고박
 *    피박 = 이긴 사람이 피로 점수가 났고 진 사람의 피가 7장(3인 5장) 이하 (한 장도 없으면 면제)
 *    광박 = 이긴 사람이 광으로 점수가 났고 진 사람의 광이 0장
 *    고박 = '고'를 했는데 다른 사람이 먼저 나서 스톱 → 맞고는 두 배, 3인은 혼자 진 사람 몫까지 모두 내요(독박)
 *  피 뺏기(상대마다 1장): 쪽 · 따닥 · 뻑 먹기(내가 싼 뻑은 2장) · 판쓸 · 폭탄 · 보너스피
 *    (손에 든 마지막 패로 한 쪽 · 따닥 · 뻑 먹기 · 판쓸은 빼요)
 *  뻑: 낸 패로 바닥 한 장을 맞혔는데 뒤집은 패도 같은 달 → 세 장이 바닥에 남아요. 한 판에 뻑 3번이면 바로 승리.
 *  흔들기: 같은 달 3장을 들고 바닥에 그 달이 없을 때 보여 주고 내요(×2). 폭탄: 같은 달 3장 + 바닥 1장 → 한꺼번에 4장(×2, 다음 2번은 뒤집기만).
 *  총통: 처음 받은 패에 같은 달 4장 → 바로 이기거나(맞고 7점 · 3인 5점) 계속하기. 바닥에 같은 달 4장이 깔리면 다시 돌려요.
 *  나가리: 아무도 못 났거나 '고'를 한 뒤 점수가 더 오르지 않고 끝나면 → 다음 판 두 배.
 *  출처: 피망 뉴맞고 게임 가이드(점수 계산 · 피 뺏어오기 · 족보), pagat.com Go-Stop, 위키백과 Go-Stop
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.GostopCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { log, shuffle } = TableKit.util;

  /* ─────────────── 화투 ─────────────── */
  const MONTHS = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비'];
  const KIND = [
    ['gw', 'tt', 'pi', 'pi'], ['yl', 'tt', 'pi', 'pi'], ['gw', 'tt', 'pi', 'pi'], ['yl', 'tt', 'pi', 'pi'],
    ['yl', 'tt', 'pi', 'pi'], ['yl', 'tt', 'pi', 'pi'], ['yl', 'tt', 'pi', 'pi'], ['gw', 'yl', 'pi', 'pi'],
    ['yl', 'tt', 'pi', 'pi'], ['yl', 'tt', 'pi', 'pi'], ['gw', 'pi', 'pi', 'pi'], ['gw', 'yl', 'tt', 'pi'],
  ];
  const YL_NAME = { 2: '꾀꼬리', 4: '두견새', 5: '다리', 6: '나비', 7: '멧돼지', 8: '기러기', 9: '술잔(국진)', 10: '사슴', 12: '제비' };
  const CARDS = [];
  for (let m = 1; m <= 12; m++) {
    for (let k = 0; k < 4; k++) {
      const kind = KIND[m - 1][k];
      const c = { id: (m - 1) * 4 + k, m, k, kind, pi: kind === 'pi' ? 1 : 0, dan: null, bird: false, rain: false, gukjin: false, bonus: 0 };
      if ((m === 11 && k === 1) || (m === 12 && k === 3)) c.pi = 2;                  // 오동 · 비 쌍피
      if (kind === 'tt') c.dan = m <= 3 ? 'hong' : [6, 9, 10].includes(m) ? 'cheong' : [4, 5, 7].includes(m) ? 'cho' : null;   // 12월 비띠는 단에 안 들어가요
      if (kind === 'yl' && [2, 4, 8].includes(m)) c.bird = true;                     // 고도리 새
      if (m === 12 && kind === 'gw') c.rain = true;                                  // 비광
      if (m === 9 && kind === 'yl') c.gukjin = true;                                 // 국진: 열끗 또는 쌍피
      c.name = kind === 'gw' ? (c.rain ? '비광' : `${MONTHS[m]} 광`) : kind === 'yl' ? `${MONTHS[m]} ${YL_NAME[m]}` : kind === 'tt' ? (c.dan ? { hong: '홍단', cheong: '청단', cho: '초단' }[c.dan] + ` (${m}월)` : '비 띠') : c.pi === 2 ? `${MONTHS[m]} 쌍피` : `${MONTHS[m]} 피`;
      CARDS.push(c);
    }
  }
  CARDS.push({ id: 48, m: 0, kind: 'pi', pi: 2, bonus: 2, name: '보너스 쌍피' }, { id: 49, m: 0, kind: 'pi', pi: 3, bonus: 3, name: '보너스 삼피' });
  const C = id => CARDS[id];
  const isBonus = id => id >= 48;
  /** 같은 값의 카드인가요? (둘 중 고를 필요가 없음) */
  const same = (a, b) => { const x = C(a), y = C(b); return x.kind === y.kind && x.pi === y.pi && x.dan === y.dan && x.bird === y.bird && x.gukjin === y.gukjin && x.rain === y.rain; };

  /* ─────────────── 점수 ─────────────── */
  /** 먹은 패 점수. gukPi = 국진을 쌍피로 쓰기 */
  function tally(cap, gukPi) {
    let gw = 0, rain = false, yl = 0, birds = 0, tt = 0, hong = 0, cheong = 0, cho = 0, pi = 0;
    for (const id of cap) {
      const c = C(id);
      if (c.kind === 'gw') { gw++; if (c.rain) rain = true; }
      else if (c.kind === 'yl') { if (c.gukjin && gukPi) pi += 2; else { yl++; if (c.bird) birds++; } }
      else if (c.kind === 'tt') { tt++; if (c.dan === 'hong') hong++; else if (c.dan === 'cheong') cheong++; else if (c.dan === 'cho') cho++; }
      else pi += c.pi;
    }
    const s = {
      gw: gw >= 5 ? 15 : gw === 4 ? 4 : gw === 3 ? (rain ? 2 : 3) : 0,
      yl: yl >= 5 ? yl - 4 : 0, godori: birds === 3 ? 5 : 0,
      tt: tt >= 5 ? tt - 4 : 0, hong: hong === 3 ? 3 : 0, cheong: cheong === 3 ? 3 : 0, cho: cho === 3 ? 3 : 0,
      pi: pi >= 10 ? pi - 9 : 0,
    };
    s.total = s.gw + s.yl + s.godori + s.tt + s.hong + s.cheong + s.cho + s.pi;
    return { n: { gw, yl, tt, pi, birds, hong, cheong, cho, rain }, s, gukPi: !!gukPi };
  }
  const hasGuk = cap => cap.includes(32);                       // 9월 열끗 = id 32
  /** 이 사람에게 가장 좋은 점수 (국진을 열끗 · 쌍피 중 좋은 쪽으로) */
  function best(cap) {
    const a = tally(cap, false);
    if (!hasGuk(cap)) return a;
    const b = tally(cap, true);
    return b.s.total > a.s.total ? b : a;
  }

  /* ─────────────── 판 준비 ─────────────── */
  const P = (s, i) => s.players[i];
  const cur = s => s.players[s.turn];
  const monthOf = id => C(id).m;
  const floorOf = (s, m) => s.floor.filter(id => monthOf(id) === m);
  const turnsLeft = p => p.hand.length + p.flipOnly;

  function setup(players, rnd, opts = {}) {
    const list = players.slice(0, 3);
    const n = list.length;
    const s = {
      rnd, n, mode: n === 2 ? 'matgo' : 'gostop', need: n === 2 ? 7 : 3, piBak: n === 2 ? 7 : 5, fixWin: n === 2 ? 7 : 5,
      rounds: [3, 5, 10].includes(+opts.rounds) ? +opts.rounds : 5, round: 0, nagari: 0, solo: !!opts.solo, evId: 0,
      players: list.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, hand: [], cap: [], go: 0, goScore: 0, shake: 0, bomb: 0, ppuk: 0, flipOnly: 0, total: 0, shown: [] })),
      dealer: Math.floor(rnd() * n), turn: 0, floor: [], stuck: {}, stock: [], phase: 'play', ask: null, T: null,
      last: null, ready: [], summaryEnd: 0, over: false, log: [], seq: 0, msg: '', events: [], flipped: null, played: null, turnNo: 0,
    };
    startRound(s);
    return s;
  }
  function startRound(s) {
    s.round++;
    s.ready = []; s.last = null; s.ask = null; s.T = null; newEvents(s); s.flipped = null; s.played = null; s.turnNo = 0; s.lastTake = []; s.mover = null;
    for (let tries = 0; tries < 50; tries++) {
      for (const p of s.players) Object.assign(p, { hand: [], cap: [], go: 0, goScore: 0, shake: 0, bomb: 0, ppuk: 0, flipOnly: 0, shown: [] });
      const deck = shuffle(Array.from({ length: 50 }, (_, i) => i), s.rnd);
      const hand = s.n === 2 ? 10 : 7, fl = s.n === 2 ? 8 : 6;
      // 돌리기: 선부터 손패 → 바닥 (실제로는 몇 장씩 나눠 돌리지만 결과는 같아요)
      for (let r = 0; r < hand; r++) for (let k = 0; k < s.n; k++) P(s, (s.dealer + k) % s.n).hand.push(deck.pop());
      s.floor = []; for (let i = 0; i < fl; i++) s.floor.push(deck.pop());
      s.stock = deck; s.stuck = {};
      // 바닥에 깔린 보너스피는 선이 가져가고, 더미에서 한 장 채워요
      for (let i = 0; i < s.floor.length; i++) {
        while (isBonus(s.floor[i])) { P(s, s.dealer).cap.push(s.floor[i]); s.floor[i] = s.stock.shift(); }
      }
      // 바닥에 같은 달 4장 → 다시 돌려요
      const cnt = {}; for (const id of s.floor) cnt[monthOf(id)] = (cnt[monthOf(id)] || 0) + 1;
      if (Object.values(cnt).some(x => x === 4)) { log(s, { t: 'redeal' }); continue; }
      for (const [m, x] of Object.entries(cnt)) if (x === 3) s.stuck[m] = -1;      // 처음부터 깔린 같은 달 3장: 4번째로 먹으면 피 한 장씩
      break;
    }
    s.turn = s.dealer;
    s.phase = 'play';
    const mult = s.nagari ? ` · 나가리 ${2 ** s.nagari}배 판` : '';
    s.msg = `${s.round}판 시작! ${cur(s).name} 님이 선이에요${mult}.`;
    log(s, { t: 'round', round: s.round, dealer: s.dealer, nagari: s.nagari });
    // 총통: 같은 달 4장을 받았으면 바로 이길지 정해요 (선부터)
    for (let k = 0; k < s.n; k++) {
      const i = (s.dealer + k) % s.n, m = quad(P(s, i).hand);
      if (m) { s.phase = 'chongtong'; s.ask = { who: i, m }; s.turn = i; s.msg = `${P(s, i).name} 님 총통! (${m}월 4장)`; return; }
    }
  }
  /** 새 효과 묶음 (차례마다 · 고 할 때) */
  function newEvents(s) { s.events = []; s.evId = (s.evId || 0) + 1; }
  const quad = hand => { const c = {}; for (const id of hand) { const m = monthOf(id); if (!m) continue; c[m] = (c[m] || 0) + 1; if (c[m] === 4) return m; } return 0; };

  /* ─────────────── 피 뺏기 ─────────────── */
  /** to 가 상대마다 피를 n장 가져와요 (보통 피부터, 없으면 쌍피 · 삼피 한 장) */
  function steal(s, to, n, why) {
    const got = [];
    for (let i = 0; i < s.n; i++) {
      if (i === to) continue;
      const p = P(s, i);
      for (let k = 0; k < n; k++) {
        let j = p.cap.findIndex(id => C(id).kind === 'pi' && C(id).pi === 1);
        if (j < 0) {
          j = p.cap.findIndex(id => C(id).kind === 'pi');
          if (j < 0) break;
          got.push(p.cap[j]); P(s, to).cap.push(p.cap.splice(j, 1)[0]); break;       // 쌍피 · 삼피는 한 장만
        }
        got.push(p.cap[j]); P(s, to).cap.push(p.cap.splice(j, 1)[0]);
      }
    }
    if (got.length) s.events.push({ t: 'steal', who: to, ids: got, why });
    return got;
  }

  /* ─────────────── 한 차례 ─────────────── */
  function act(s, id, a) {
    if (!a || typeof a !== 'object') return '잘못된 행동이에요.';
    if (s.over) return '게임이 끝났어요.';
    const i = s.players.findIndex(p => p.id === id);
    if (i < 0) return '이 게임에 참가하지 않았어요.';
    if (s.phase === 'summary') {
      if (a.t !== 'next') return '다음 판을 기다리는 중이에요.';
      if (!s.ready.includes(id)) s.ready.push(id);
      if (s.players.every(p => p.bot || s.ready.includes(p.id))) nextRound(s);
      return;
    }
    if (i !== s.turn) return '지금은 내 차례가 아니에요.';
    const p = P(s, i);
    if (s.phase === 'chongtong') {
      if (a.t !== 'chongtong') return '총통으로 끝낼지 정해 주세요.';
      if (a.end) return fixedWin(s, i, 'chongtong');
      s.phase = 'play'; s.ask = null; s.turn = s.dealer;
      s.msg = `${p.name} 님이 총통을 들고 계속해요. ${cur(s).name} 님 차례`;
      log(s, { t: 'chongtong-go', who: i });
      return;
    }
    if (s.phase === 'gostop') {
      if (a.t === 'go') {
        p.go++; p.goScore = best(p.cap).s.total;
        s.msg = `${p.name} 님 ${p.go}고!`;
        newEvents(s); s.events.push({ t: 'go', who: i, n: p.go });
        log(s, { t: 'go', who: i, n: p.go });
        s.ask = null;
        return nextTurn(s);
      }
      if (a.t === 'stop') { log(s, { t: 'stop', who: i }); return winRound(s, i, 'stop'); }
      return '고 또는 스톱을 골라 주세요.';
    }
    if (s.phase === 'choose') {
      if (a.t !== 'take' || !s.ask || !s.ask.ids.includes(+a.c)) return '가져올 패를 골라 주세요.';
      return chosen(s, +a.c);
    }
    if (s.phase !== 'play') return '지금은 할 수 없어요.';
    newEvents(s); s.played = null; s.flipped = null; s.lastTake = []; s.mover = i;
    if (a.t === 'flip') {
      if (p.flipOnly <= 0) return '폭탄을 한 뒤에만 뒤집기만 할 수 있어요.';
      p.flipOnly--;
      s.played = null;
      s.T = { who: i, hand: null, last: turnsLeft(p) === 0 };
      log(s, { t: 'flipOnly', who: i });
      return flip(s);
    }
    if (a.t === 'bomb') {
      const m = +a.m, mine = p.hand.filter(x => monthOf(x) === m), fl = floorOf(s, m);
      if (!m || mine.length !== 3 || fl.length !== 1) return '폭탄은 같은 달 3장을 들고 바닥에 그 달이 1장 있을 때만 돼요.';
      p.hand = p.hand.filter(x => monthOf(x) !== m);
      s.floor = s.floor.filter(x => x !== fl[0]);
      p.cap.push(...mine, fl[0]);
      p.bomb++; p.flipOnly += 2;
      s.played = mine.slice(); s.lastTake = [...mine, fl[0]];
      s.events.push({ t: 'bomb', who: i, ids: [...mine, fl[0]] });
      steal(s, i, 1, '폭탄');
      log(s, { t: 'bomb', who: i, m });
      s.T = { who: i, hand: null, last: false, bomb: true };
      return flip(s);
    }
    if (a.t !== 'play') return '알 수 없는 행동이에요.';
    const c = +a.c;
    if (!p.hand.includes(c)) return '손에 없는 패예요.';
    if (isBonus(c)) {                                          // 보너스피: 바로 먹고 피를 뺏고, 더미에서 한 장 받아 계속해요
      p.hand.splice(p.hand.indexOf(c), 1); p.cap.push(c);
      s.played = [c]; s.lastTake = [c];
      s.events.push({ t: 'bonus', who: i, id: c });
      steal(s, i, 1, '보너스피');
      if (s.stock.length) p.hand.push(s.stock.shift());
      log(s, { t: 'bonus', who: i, id: c });
      s.msg = `${p.name} 님 보너스피! 한 장 더 받아서 계속 쳐요.`;
      return;                                                   // 점수 확인은 이번 차례가 끝날 때
    }
    const m = monthOf(c), fl = floorOf(s, m), mine = p.hand.filter(x => monthOf(x) === m);
    if (a.shake) {
      if (mine.length < 3 || fl.length) return '흔들기는 같은 달 3장을 들고 바닥에 그 달이 없을 때만 돼요.';
      p.shake++; p.shown = mine.slice();
      s.events.push({ t: 'shake', who: i, ids: mine.slice() });
      log(s, { t: 'shake', who: i, m, ids: mine.slice() });
    }
    p.hand.splice(p.hand.indexOf(c), 1);
    s.played = [c];
    s.T = { who: i, hand: c, m, last: turnsLeft(p) === 0, placed: false, pair: null, pair2: null, pile: null };
    if (!fl.length) { s.floor.push(c); s.T.placed = true; }
    else if (fl.length === 1) s.T.pair = fl[0];
    else if (fl.length === 2) {
      if (same(fl[0], fl[1])) s.T.pair2 = fl[0];
      else { s.phase = 'choose'; s.ask = { from: 'hand', card: c, ids: fl.slice() }; s.msg = `${p.name} 님: 바닥의 ${m}월 두 장 중 가져올 패를 골라요.`; return; }
    } else s.T.pile = fl.slice();
    return flip(s);
  }
  function chosen(s, id) {
    const T = s.T, ask = s.ask;
    s.phase = 'play'; s.ask = null;
    if (ask.from === 'hand') { T.pair2 = id; return flip(s); }
    T.flipPick = id;
    return resolveFlip(s, T.flip);
  }
  /** 더미에서 한 장 뒤집기 */
  function flip(s) {
    const T = s.T, p = P(s, T.who);
    for (;;) {
      if (!s.stock.length) { T.flip = null; return finishTurn(s); }
      const f = s.stock.shift();
      if (isBonus(f)) {                                         // 보너스피를 뒤집으면 바로 먹고 한 장 더 뒤집어요
        p.cap.push(f); s.lastTake.push(f); s.events.push({ t: 'bonus', who: T.who, id: f, flip: true });
        steal(s, T.who, 1, '보너스피');
        continue;
      }
      T.flip = f; s.flipped = f;
      const fm = monthOf(f);
      if (T.hand != null && fm === T.m) {
        if (T.placed) { T.jjok = true; return finishTurn(s); }                 // 쪽
        if (T.pair != null) { T.ppuk = true; return finishTurn(s); }           // 뻑
        if (T.pair2 != null) { T.ttadak = true; return finishTurn(s); }        // 따닥
      }
      const ff = floorOf(s, fm).filter(x => x !== T.hand || !T.placed);
      if (ff.length === 2 && !same(ff[0], ff[1])) {
        s.phase = 'choose'; s.ask = { from: 'flip', card: f, ids: ff.slice() };
        s.msg = `${p.name} 님: 뒤집은 ${fm}월 패로 가져올 바닥 패를 골라요.`;
        return;
      }
      return resolveFlip(s, f);
    }
  }
  function resolveFlip(s, f) {
    const T = s.T, fm = monthOf(f), ff = floorOf(s, fm);
    if (!ff.length) T.flipPlace = true;
    else if (ff.length === 1) T.flipPair = ff[0];
    else if (ff.length === 2) T.flipPair = T.flipPick != null ? T.flipPick : ff[0];
    else T.flipPile = ff.slice();
    return finishTurn(s);
  }
  /** 차례 정리: 먹은 패 · 뻑 · 쪽 · 따닥 · 판쓸 · 피 뺏기 */
  function finishTurn(s) {
    const T = s.T, i = T.who, p = P(s, i), take = [], ev = s.events;
    let stealN = 0;
    const why = [];
    const pileSteal = m => { const o = s.stuck[m]; delete s.stuck[m]; if (T.last) return; if (o === i) { stealN += 2; why.push('자뻑'); } else { stealN += 1; why.push(o === -1 ? '세 장 먹기' : '뻑 먹기'); } };
    if (T.hand != null) {
      if (T.jjok) { take.push(T.hand, T.flip); ev.push({ t: 'jjok', who: i }); if (!T.last) { stealN++; why.push('쪽'); } }
      else if (T.ppuk) {
        s.floor.push(T.hand, T.flip); s.stuck[T.m] = i; p.ppuk++;
        ev.push({ t: 'ppuk', who: i, n: p.ppuk });
        log(s, { t: 'ppuk', who: i, n: p.ppuk });
      } else if (T.ttadak) { take.push(T.hand, T.flip, ...floorOf(s, T.m)); ev.push({ t: 'ttadak', who: i }); if (!T.last) { stealN++; why.push('따닥'); } }
      else {
        if (T.pair != null) take.push(T.hand, T.pair);
        if (T.pair2 != null) take.push(T.hand, T.pair2);
        if (T.pile) { take.push(T.hand, ...T.pile); pileSteal(T.m); }
      }
    }
    if (T.flip != null && !T.jjok && !T.ppuk && !T.ttadak) {
      if (T.flipPlace) s.floor.push(T.flip);
      else if (T.flipPair != null) take.push(T.flip, T.flipPair);
      else if (T.flipPile) { take.push(T.flip, ...T.flipPile); pileSteal(monthOf(T.flip)); }
    }
    if (take.length) {
      const set = new Set(take);
      s.floor = s.floor.filter(x => !set.has(x));
      p.cap.push(...set);
    }
    for (const m of Object.keys(s.stuck)) if (!floorOf(s, +m).length) delete s.stuck[m];
    if (take.length && !s.floor.length && !T.last) { stealN++; why.push('판쓸'); ev.push({ t: 'sweep', who: i }); }
    if (stealN) steal(s, i, stealN, why.join(' · '));
    s.lastTake = (s.lastTake || []).concat(take.filter((x, k) => take.indexOf(x) === k));
    log(s, { t: 'turn', who: i, hand: T.hand, flip: T.flip, take: take.length, ppuk: !!T.ppuk, jjok: !!T.jjok, ttadak: !!T.ttadak, bomb: !!T.bomb });
    s.T = null;
    if (T.ppuk && p.ppuk >= 3) return fixedWin(s, i, 'ppuk3');
    return afterScoreCheck(s, i);
  }
  /** 점수가 났는지 확인 → 고/스톱 묻기 · 다음 차례 · 판 끝 */
  function afterScoreCheck(s, i) {
    const p = P(s, i), sc = best(p.cap).s.total;
    const allDone = s.players.every(x => !turnsLeft(x));
    const ready = sc >= s.need && (p.go === 0 || sc > p.goScore);
    if (ready) {
      if (allDone || !turnsLeft(p)) return winRound(s, i, 'stop');      // 더 칠 패가 없으면 바로 스톱
      s.phase = 'gostop'; s.ask = { score: sc, go: p.go };
      s.msg = `${p.name} 님 ${sc}점! 고? 스톱?`;
      return;
    }
    if (allDone) return nagari(s);
    return nextTurn(s);
  }
  function nextTurn(s) {
    s.phase = 'play';
    for (let k = 1; k <= s.n; k++) {
      const j = (s.turn + k) % s.n;
      if (turnsLeft(P(s, j))) { s.turn = j; s.turnNo++; s.msg = `${cur(s).name} 님 차례`; return; }
    }
    return nagari(s);
  }

  /* ─────────────── 판 끝 · 정산 ─────────────── */
  function settle(s, w, how) {
    const r = calc(s, w, how);
    for (const x of r.pays) P(s, x.i).total -= x.amount;
    P(s, w).total += r.total;
    return r;
  }
  /** 정산 계산만 (점수는 안 바꿔요) */
  function calc(s, w, how) {
    const W = P(s, w), mults = [], pays = [];
    const nag = Math.min(3, s.nagari);
    let base, breakdown = null, winT = null;
    if (how === 'chongtong' || how === 'ppuk3') {
      base = s.fixWin;
      if (nag) mults.push({ k: 'nagari', label: `나가리 ×${2 ** nag}`, x: 2 ** nag });
    } else {
      // 이긴 사람: 국진을 어디에 둘지 가장 많이 받는 쪽으로
      const options = hasGuk(W.cap) ? [false, true] : [false];
      let bestOpt = null;
      for (const g of options) {
        const t = tally(W.cap, g);
        const opt = winnerCalc(s, W, t, nag);
        const total = s.players.reduce((a, L, li) => (li === w ? a : a + loserPay(s, opt, t, L).amount), 0);
        if (!bestOpt || total > bestOpt.total) bestOpt = { ...opt, t, total };
      }
      winT = bestOpt.t; base = bestOpt.base; mults.push(...bestOpt.mults);
      breakdown = { ...winT.s, go: W.go, gukPi: winT.gukPi };
    }
    const mul = mults.reduce((a, m) => a * m.x, 1);
    for (let li = 0; li < s.n; li++) {
      if (li === w) continue;
      const L = P(s, li);
      if (winT) { const r = loserPay(s, { base, mul }, winT, L); pays.push({ i: li, amount: r.amount, flags: r.flags }); }
      else pays.push({ i: li, amount: base * mul, flags: [] });
    }
    // 고박: 맞고는 두 배(위에서) · 3인은 '고'를 한 사람이 진 사람 몫을 혼자 내요(독박)
    if (s.n === 3 && winT) {
      const goer = pays.filter(x => P(s, x.i).go > 0).sort((a, b) => P(s, b.i).go - P(s, a.i).go)[0];
      if (goer) {
        const sum = pays.reduce((a, x) => a + x.amount, 0);
        for (const x of pays) { if (x === goer) { x.amount = sum; x.flags.push('고박(독박)'); } else { x.amount = 0; x.flags.push('면제'); } }
      }
    }
    const total = pays.reduce((a, x) => a + x.amount, 0);
    return { kind: how, winner: w, base, breakdown, mults, pays, total };
  }
  function winnerCalc(s, W, t, nag) {
    const mults = [];
    let base = t.s.total;
    if (W.go) base += W.go;                                        // N고 +N점
    if (W.go >= 3) mults.push({ k: 'go', label: `${W.go}고 ×${2 ** (W.go - 2)}`, x: 2 ** (W.go - 2) });
    if (W.shake) mults.push({ k: 'shake', label: `흔들기${W.shake > 1 ? ' ' + W.shake + '번' : ''} ×${2 ** W.shake}`, x: 2 ** W.shake });
    if (W.bomb) mults.push({ k: 'bomb', label: `폭탄${W.bomb > 1 ? ' ' + W.bomb + '번' : ''} ×${2 ** W.bomb}`, x: 2 ** W.bomb });
    if (t.n.yl >= 7) mults.push({ k: 'mung', label: '멍따 ×2', x: 2 });
    if (nag) mults.push({ k: 'nagari', label: `나가리 ×${2 ** nag}`, x: 2 ** nag });
    return { base, mults, mul: mults.reduce((a, m) => a * m.x, 1) };
  }
  /** 진 사람 한 명이 낼 점수 (피박 · 광박 · 고박). 국진은 진 사람에게 유리한 쪽으로 */
  function loserPay(s, opt, winT, L) {
    let bestR = null;
    for (const g of hasGuk(L.cap) ? [false, true] : [false]) {
      const lt = tally(L.cap, g), flags = [];
      let x = 1;
      if (winT.s.pi > 0 && lt.n.pi > 0 && lt.n.pi <= s.piBak) { x *= 2; flags.push('피박'); }
      if (winT.s.gw > 0 && lt.n.gw === 0) { x *= 2; flags.push('광박'); }
      if (s.n === 2 && L.go > 0) { x *= 2; flags.push('고박'); }
      const amount = opt.base * opt.mul * x;
      if (!bestR || amount < bestR.amount) bestR = { amount, flags };
    }
    return bestR;
  }
  function winRound(s, w, how) {
    const r = settle(s, w, how);
    s.nagari = 0;
    s.dealer = w;
    endRound(s, r);
    const W = P(s, w);
    s.msg = how === 'stop' ? `${W.name} 님 스톱! ${r.total}점을 받아요.` : `${W.name} 님 ${how === 'chongtong' ? '총통' : '3뻑'}! ${r.total}점을 받아요.`;
  }
  function fixedWin(s, w, how) { log(s, { t: how, who: w }); return winRound(s, w, how); }
  function nagari(s) {
    s.nagari = Math.min(3, s.nagari + 1);
    endRound(s, { kind: 'nagari', winner: null, next: 2 ** s.nagari });
    s.msg = `나가리! 다음 판은 ${2 ** s.nagari}배예요.`;
    log(s, { t: 'nagari' });
  }
  function endRound(s, r) {
    s.last = Object.assign(r, { round: s.round, caps: s.players.map(p => p.cap.slice()), scores: s.players.map(p => best(p.cap).s.total) });
    s.phase = 'summary'; s.ask = null; s.T = null; s.ready = [];
    s.summaryEnd = Date.now() + (s.round >= s.rounds ? 9000 : 12000);
  }
  function nextRound(s) {
    if (s.round >= s.rounds && (!s.last || s.last.kind !== 'nagari' || s.round >= s.rounds + 2)) { s.over = true; s.phase = 'over'; s.msg = '게임 끝!'; return; }
    startRound(s);
  }

  /* ─────────────── AI ─────────────── */
  /** 패 한 장의 가치 (이 사람이 가져갈 때 · 상대가 가져가면 막는 가치까지) */
  function cardValue(s, i, id) {
    const c = C(id);
    const own = p => tally(p.cap, false).n;
    const v = (p, c) => {
      const n = own(p);
      if (c.kind === 'gw') return 5 + (n.gw >= 2 ? 6 : n.gw === 1 ? 2 : 0) - (c.rain && n.gw === 2 ? 3 : 0);
      if (c.kind === 'yl') {
        let x = 2.2 + (n.yl >= 4 ? 2 : 0) + (n.yl >= 6 ? 2 : 0);
        if (c.bird) x += n.birds === 2 ? 9 : n.birds === 1 ? 3 : 1;
        if (c.gukjin) x = Math.max(x, 2.5 + (n.pi >= 8 ? 2.5 : 1));
        return x;
      }
      if (c.kind === 'tt') { const have = c.dan ? n[c.dan] : 0; return 1.8 + (n.tt >= 4 ? 2 : 0) + (have === 2 ? 8 : have === 1 ? 2.5 : 0); }
      return c.pi * (1 + (n.pi >= 8 ? 1.2 : n.pi >= 5 ? 0.6 : 0.3));
    };
    let val = v(P(s, i), c);
    let deny = 0;
    for (let j = 0; j < s.n; j++) if (j !== i) deny = Math.max(deny, v(P(s, j), c) - 1.5);
    return val + Math.max(0, deny) * 0.6;
  }
  /** 이 사람이 모르는 패 (상대 손패 + 더미) */
  function unknown(s, i) {
    const seen = new Set([...P(s, i).hand, ...s.floor]);
    for (const p of s.players) for (const id of p.cap) seen.add(id);
    for (const p of s.players) for (const id of p.shown || []) if (P(s, s.players.indexOf(p)).hand.includes(id)) seen.add(id);
    return Array.from({ length: 50 }, (_, k) => k).filter(k => !seen.has(k));
  }
  function gainOf(s, i, ids) { return ids.reduce((a, id) => a + cardValue(s, i, id), 0); }
  /** 손패 한 장을 냈을 때의 기댓값 (뒤집을 패는 모르는 패 중 하나라고 보고 평균) */
  function evalPlay(s, i, c, unk) {
    const m = monthOf(c), fl = floorOf(s, m), opps = s.players.filter((_, j) => j !== i);
    const unkM = unk.filter(x => monthOf(x) === m).length, U = Math.max(1, unk.length);
    const oppHand = opps.reduce((a, p) => a + p.hand.length, 0);
    let v = 0;
    let floorAfter = s.floor.slice();
    if (!fl.length) {
      floorAfter.push(c);
      v -= cardValue(s, i, c) * Math.min(1, unkM * oppHand / U) * 0.8;         // 상대가 가져갈 위험
      v += (unkM / U) * (cardValue(s, i, c) * 2 + 2);                          // 쪽 기대
    } else if (fl.length === 1) {
      const g = cardValue(s, i, c) + cardValue(s, i, fl[0]);
      const pp = unkM / U;                                                     // 뻑 위험
      v += g * (1 - pp) - pp * 2;
      floorAfter = floorAfter.filter(x => x !== fl[0]);
    } else if (fl.length === 2) {
      const pick = cardValue(s, i, fl[0]) >= cardValue(s, i, fl[1]) ? fl[0] : fl[1];
      v += cardValue(s, i, c) + cardValue(s, i, pick) + (unkM / U) * (cardValue(s, i, fl[0] === pick ? fl[1] : fl[0]) + 3);
      floorAfter = floorAfter.filter(x => x !== pick);
    } else {
      v += gainOf(s, i, [c, ...fl]) + (s.stuck[m] === i ? 6 : 3);
      floorAfter = floorAfter.filter(x => monthOf(x) !== m);
    }
    // 뒤집을 패 기댓값
    let ev = 0;
    for (const f of unk) {
      if (isBonus(f)) { ev += 3.5; continue; }
      const fm = monthOf(f); if (fm === m) continue;
      const ff = floorAfter.filter(x => monthOf(x) === fm);
      if (ff.length === 1) ev += cardValue(s, i, f) + cardValue(s, i, ff[0]);
      else if (ff.length === 2) ev += cardValue(s, i, f) + Math.max(cardValue(s, i, ff[0]), cardValue(s, i, ff[1]));
      else if (ff.length === 3) ev += gainOf(s, i, [f, ...ff]) + 2;
    }
    return v + ev / U * 0.9;
  }
  function ai(s, id) {
    const i = s.players.findIndex(p => p.id === id), p = P(s, i);
    if (s.phase === 'summary') return s.ready.includes(id) ? null : { t: 'next' };
    if (i !== s.turn) return null;
    if (s.phase === 'chongtong') return { t: 'chongtong', end: true };
    if (s.phase === 'gostop') return { t: goOrStop(s, i) ? 'go' : 'stop' };
    if (s.phase === 'choose') {
      const ids = s.ask.ids.slice().sort((a, b) => cardValue(s, i, b) - cardValue(s, i, a));
      return { t: 'take', c: ids[0] };
    }
    if (s.phase !== 'play') return null;
    const bonus = p.hand.find(isBonus);
    if (bonus != null) return { t: 'play', c: bonus };
    for (let m = 1; m <= 12; m++) if (p.hand.filter(x => monthOf(x) === m).length === 3 && floorOf(s, m).length === 1) return { t: 'bomb', m };
    const unk = unknown(s, i);
    let bestA = null, bv = -1e9;
    for (const c of p.hand) {
      const v = evalPlay(s, i, c, unk) + s.rnd() * 0.3;
      if (v > bv) { bv = v; bestA = c; }
    }
    if (p.flipOnly > 0 && (bestA == null || bv < 1.5)) return { t: 'flip' };
    if (bestA == null) return p.flipOnly > 0 ? { t: 'flip' } : null;
    const m = monthOf(bestA);
    const shake = p.hand.filter(x => monthOf(x) === m).length >= 3 && !floorOf(s, m).length;
    return { t: 'play', c: bestA, shake: shake || undefined };
  }
  /** 고 할까? 상대가 곧 날 것 같거나 남은 패가 적으면 스톱 */
  function goOrStop(s, i) {
    const p = P(s, i), left = turnsLeft(p);
    if (left < 2) return false;
    let threat = 0;
    for (let j = 0; j < s.n; j++) {
      if (j === i) continue;
      const t = best(P(s, j).cap), n = t.n;
      let th = t.s.total;
      if (n.gw === 2) th += 2; if (n.birds === 2) th += 3;
      if (n.hong === 2 || n.cheong === 2 || n.cho === 2) th += 2;
      if (n.pi >= 8) th += 1.5; if (n.yl >= 4 || n.tt >= 4) th += 1;
      threat = Math.max(threat, th);
    }
    const limit = s.n === 2 ? 4.5 : 1.5;
    if (p.go >= 3 && threat > limit - 2) return false;
    return threat <= limit && left >= (s.n === 2 ? 3 : 2) && s.rnd() > 0.15;
  }
  /** 시간 초과: 고/스톱은 스톱, 나머지는 AI가 대신 */
  function auto(s, id) {
    if (s.phase === 'gostop') return { t: 'stop' };
    return ai(s, id);
  }

  /* ─────────────── 화면 정보 ─────────────── */
  function view(s, viewer) {
    const vi = s.players.findIndex(p => p.id === viewer), me = vi >= 0 ? P(s, vi) : null;
    const groups = [];
    for (let m = 1; m <= 12; m++) { const ids = floorOf(s, m); if (ids.length) groups.push({ m, ids, stuck: m in s.stuck ? s.stuck[m] : null }); }
    const myTurn = !s.over && vi === s.turn && ['play', 'choose', 'gostop', 'chongtong'].includes(s.phase);
    // 고르는 중(바닥 두 장 중 하나)에는 낸 패 · 뒤집은 패가 아직 바닥에 없어요 → 따로 보여줘요
    const pend = [];
    if (s.phase === 'choose' && s.T) {
      if (s.T.hand != null && !s.T.placed) pend.push({ id: s.T.hand, from: 'hand', who: s.T.who });
      if (s.ask && s.ask.from === 'flip') pend.push({ id: s.ask.card, from: 'flip', who: s.T.who });
    }
    let opts = null;
    if (myTurn && s.phase === 'play') {
      opts = { flipOnly: me.flipOnly, cards: me.hand.map(c => {
        if (isBonus(c)) return { c, bonus: true, match: [] };
        const m = monthOf(c), fl = floorOf(s, m), mine = me.hand.filter(x => monthOf(x) === m).length;
        return { c, match: fl, shake: mine >= 3 && !fl.length, bomb: mine === 3 && fl.length === 1 };
      }) };
    }
    return {
      mode: s.mode, need: s.need, round: s.round, rounds: s.rounds, nagari: s.nagari, dealer: s.dealer, phase: s.phase, over: s.over,
      turn: s.turn, turnId: s.over || s.phase === 'summary' ? null : cur(s).id, seat: vi, stock: s.stock.length,
      floor: groups, flipped: s.flipped, played: s.played, events: s.events.slice(), evId: s.evId, lastTake: s.lastTake || [], pend, mover: s.mover == null ? null : s.mover,
      players: s.players.map((p, j) => {
        const t = best(p.cap);
        return { id: p.id, name: p.name, bot: p.bot, hand: j === vi ? p.hand.slice() : null, handN: p.hand.length, cap: p.cap.slice(), score: t.s.total, sc: t.s, n: t.n, gukPi: t.gukPi,
          go: p.go, goScore: p.goScore, shake: p.shake, bomb: p.bomb, ppuk: p.ppuk, flipOnly: p.flipOnly, total: p.total, shown: p.shown.filter(x => p.hand.includes(x)) };
      }),
      ask: myTurn ? (s.phase === 'gostop' ? Object.assign({}, s.ask, { value: calc(s, vi, 'stop').total }) : s.ask) : s.phase === 'choose' || s.phase === 'gostop' || s.phase === 'chongtong' ? { waiting: true, phase: s.phase } : null,
      opts, last: s.last, ready: s.ready.slice(), summaryEnd: s.solo ? null : s.summaryEnd, solo: s.solo, msg: s.msg, log: s.log.slice(-10), seq: s.seq, turnNo: s.turnNo,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const rk = s.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.total - a.p.total);
    const top = rk[0].p.total, winners = rk.filter(x => x.p.total === top).map(x => x.p.id);
    return {
      title: winners.length > 1 ? '🎴 공동 1등!' : `🎴 ${rk[0].p.name} 님 우승!`,
      subtitle: `${s.mode === 'matgo' ? '맞고' : '3인 고스톱'} ${s.round}판`,
      ranking: rk.map(x => ({ id: x.p.id, value: `${x.p.total > 0 ? '+' : ''}${x.p.total}점`, score: x.p.total })),
      winners,
    };
  }
  function pending(s) {
    if (s.over) return [];
    if (s.phase === 'summary') return s.players.filter(p => !s.ready.includes(p.id)).map(p => p.id);
    return [cur(s).id];
  }
  /** 사람이 나가면 봇이 대신해요 (TableKit 기본) */

  return {
    meta: {
      name: '고스톱', min: 2, max: 3, bots: true, turnSec: 25, botDelay: [1000, 1500],
      options: [
        { key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명']] },
        { key: 'rounds', label: '🔁 판 수', def: 5, values: [[3, '3판'], [5, '5판'], [10, '10판']] },
      ],
    },
    CARDS, MONTHS, tally, best, cardValue,
    setup, act, ai, auto, view, result, pending,
    deadline: s => (s.phase === 'summary' && !s.over && !s.solo ? s.summaryEnd : null),
    timeup: s => { if (s.phase === 'summary' && !s.over && Date.now() >= s.summaryEnd - 50) nextRound(s); },
    _test: { startRound, steal, settle, calc, floorOf, nextRound },
  };
});
