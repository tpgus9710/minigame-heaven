/* =====================================================================
 *  🌍 세계여행 보드게임 규칙 (부루마블 방식) — 화면(싱글)과 서버(멀티)가 같이 씀
 *  돈 단위: 만원. 32칸 (모서리: 출발 · 무인도 · 사회복지기금 · 세계여행)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.MarbleCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const GROUPS = { 1: '#8d5a3b', 2: '#5cc8ff', 3: '#ff7eb6', 4: '#ff9f43', 5: '#e74c3c', 6: '#f1c40f', 7: '#2ecc71', 8: '#3867d6' };
  const C = (name, price, group, code) => ({ type: 'city', name, price, group, code });
  const BOARD = [
    { type: 'start', name: '출발' }, C('타이베이', 50, 1, 'TW'), { type: 'key', name: '황금열쇠' }, C('베이징', 60, 1, 'CN'), C('마닐라', 60, 1, 'PH'),
    { type: 'spot', name: '제주도', price: 200 }, C('싱가포르', 80, 2, 'SG'), C('이스탄불', 90, 2, 'TR'),
    { type: 'island', name: '무인도' }, C('아테네', 100, 3, 'GR'), { type: 'key', name: '황금열쇠' }, C('코펜하겐', 110, 3, 'DK'), C('스톡홀름', 110, 3, 'SE'),
    C('베른', 130, 4, 'CH'), C('베를린', 140, 4, 'DE'), C('오타와', 140, 4, 'CA'),
    { type: 'fund', name: '사회복지기금' }, C('부에노스아이레스', 160, 5, 'AR'), { type: 'key', name: '황금열쇠' }, C('상파울루', 170, 5, 'BR'), C('시드니', 170, 5, 'AU'),
    { type: 'spot', name: '부산', price: 250 }, C('하와이', 190, 6, 'US'), C('리스본', 200, 6, 'PT'),
    { type: 'travel', name: '세계여행' }, C('마드리드', 220, 7, 'ES'), { type: 'key', name: '황금열쇠' }, C('도쿄', 240, 7, 'JP'), C('런던', 240, 7, 'GB'),
    C('파리', 280, 8, 'FR'), { type: 'tax', name: '국세청' }, C('뉴욕', 320, 8, 'US'),
  ];
  const N = BOARD.length, START_MONEY = 2000, SALARY = 200, ISLAND = 8, TRAVEL = 24;
  const LEVELS = ['땅', '별장', '빌딩', '호텔', '랜드마크'];
  const TOLL = [0.3, 1.0, 2.4, 4.2, 6.5];               // 단계별 통행료 = 가격 × 배수
  const BUILD = [0.5, 0.8, 1.1, 1.5];                   // 별장·빌딩·호텔·랜드마크 짓는 값 = 가격 × 배수
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
  const KEYS = [
    { t: 'money', v: 200, txt: '복권 당첨! 200만원을 받아요.' },
    { t: 'money', v: 100, txt: '장학금 100만원을 받아요.' },
    { t: 'money', v: 300, txt: '주식이 대박 났어요! 300만원을 받아요.' },
    { t: 'birthday', v: 30, txt: '생일 축하해요! 모두에게 30만원씩 받아요.' },
    { t: 'fine', v: 50, txt: '과속 벌금 50만원 (사회복지기금으로)' },
    { t: 'fine', v: 100, txt: '병원비 100만원 (사회복지기금으로)' },
    { t: 'repair', v: 20, txt: '건물 수리비: 내 건물 한 단계마다 20만원' },
    { t: 'fine', v: 150, txt: '정기 기부: 사회복지기금에 150만원' },
    { t: 'go', to: 0, txt: '출발점으로 이동! 월급을 받아요.' },
    { t: 'go', to: ISLAND, txt: '태풍을 만나 무인도로…', jail: true },
    { t: 'go', to: TRAVEL, txt: '세계여행 초대권! 세계여행 칸으로 이동' },
    { t: 'back', v: 3, txt: '길을 잃었어요. 뒤로 3칸' },
    { t: 'go', to: 31, txt: '뉴욕 출장! 뉴욕으로 이동' },
    { t: 'item', item: 'waiver', txt: '우대권: 다음 통행료 한 번 면제 (보관)' },
    { t: 'item', item: 'escape', txt: '무인도 탈출권 (보관)' },
    { t: 'item', item: 'half', txt: '반값 쿠폰: 다음 통행료 반값 (보관)' },
  ];

  const isCity = i => BOARD[i].type === 'city';
  const ownable = i => BOARD[i].type === 'city' || BOARD[i].type === 'spot';
  const cur = s => s.players[s.turn];
  const P = (s, id) => s.players.find(p => p.id === id);

  function setup(players, rnd, opts) {
    const s = {
      rnd, players: players.map((p, i) => ({ ...p, color: COLORS[i % 4], money: START_MONEY, pos: 0, out: false, island: 0, items: { waiver: 0, escape: 0, half: 0 }, travel: false })),
      owner: Array(N).fill(null), level: Array(N).fill(0), turn: 0, phase: 'roll', dice: [1, 1], rolls: 0, doubles: 0, fund: 0,
      round: 1, maxRounds: Number(opts.rounds) || 20, deck: shuffle([...KEYS.keys()], rnd), card: null, decision: null, over: false, log: [], seq: 0, msg: '',
    };
    s.msg = `${cur(s).name} 님부터 시작해요. 주사위를 굴리세요!`;
    return s;
  }

  /* ── 돈 계산 ── */
  const buildCost = (i, lvl) => Math.round(BOARD[i].price * BUILD[lvl - 1]);        // lvl: 1~4 로 올릴 때 드는 값
  const groupOwned = (s, i) => { const g = BOARD[i].group; return BOARD.every((b, j) => b.group !== g || s.owner[j] === s.owner[i]); };
  function toll(s, i) {
    const b = BOARD[i];
    if (b.type === 'spot') return Math.round(b.price * 0.6);
    let t = b.price * TOLL[s.level[i]];
    if (groupOwned(s, i)) t *= 2;                                                      // 같은 색 도시를 모두 가지면 통행료 2배
    return Math.round(t);
  }
  const assetValue = (s, i) => (ownable(i) ? BOARD[i].price + Array.from({ length: s.level[i] }, (_, k) => buildCost(i, k + 1)).reduce((a, b) => a + b, 0) : 0);
  const worth = (s, p) => p.money + BOARD.reduce((a, b, i) => a + (s.owner[i] === p.id ? assetValue(s, i) : 0), 0);

  /** 돈 내기 (모자라면 땅·건물을 팔고, 그래도 모자라면 파산) */
  function pay(s, p, amt, toId, why) {
    if (amt <= 0) return true;
    if (p.money < amt) liquidate(s, p, amt);
    const to = toId ? P(s, toId) : null;
    if (p.money < amt) {                                                                 // 파산
      const left = p.money;
      if (to) to.money += left; else s.fund += left;
      p.money = 0; p.out = true;
      s.owner.forEach((o, i) => { if (o === p.id) { s.owner[i] = null; s.level[i] = 0; } });
      log(s, { t: 'bankrupt', id: p.id });
      s.msg = `💸 ${p.name} 님 파산! (${why})`;
      return false;
    }
    p.money -= amt;
    if (to) to.money += amt; else if (toId === null) s.fund += amt;
    return true;
  }
  function liquidate(s, p, need) {
    const mine = () => s.owner.map((o, i) => (o === p.id ? i : -1)).filter(i => i >= 0);
    while (p.money < need) {                                                             // 건물부터 반값에 팔기
      const withB = mine().filter(i => s.level[i] > 0).sort((a, b) => BOARD[a].price - BOARD[b].price)[0];
      if (withB == null) break;
      p.money += Math.round(buildCost(withB, s.level[withB]) * 0.5); s.level[withB]--;
      log(s, { t: 'sell', id: p.id, pos: withB });
    }
    while (p.money < need) {                                                             // 그다음 땅 (70%)
      const land = mine().sort((a, b) => BOARD[a].price - BOARD[b].price)[0];
      if (land == null) break;
      p.money += Math.round(BOARD[land].price * 0.7); s.owner[land] = null; s.level[land] = 0;
      log(s, { t: 'sell', id: p.id, pos: land });
    }
  }

  /* ── 차례 진행 ── */
  function endTurn(s) {
    s.decision = null;
    if (checkOver(s)) return;
    const p = cur(s);
    if (s.doubles > 0 && !p.out && !p.island && !p.travel) { s.phase = 'roll'; s.msg = `🎲 더블! ${p.name} 님 한 번 더!`; return; }
    s.doubles = 0;
    let k = 0;
    do {
      s.turn = (s.turn + 1) % s.players.length;
      if (s.turn === 0) s.round++;
      k++;
    } while (cur(s).out && k <= s.players.length);
    if (checkOver(s)) return;
    const np = cur(s);
    s.phase = np.travel ? 'travel' : 'roll';
    s.msg = np.travel ? `✈️ ${np.name} 님, 세계여행! 가고 싶은 칸을 고르세요.` : np.island ? `🏝️ ${np.name} 님은 무인도에 있어요. 더블이 나오면 탈출!` : `${np.name} 님 차례예요.`;
  }
  function checkOver(s) {
    const alive = s.players.filter(p => !p.out);
    if (alive.length <= 1 || s.round > s.maxRounds) { s.over = true; s.phase = 'over'; return true; }
    return false;
  }
  function moveTo(s, p, to, steps) {
    const from = p.pos;
    let passed = false;
    if (steps != null) { if (steps > 0 && from + steps >= N) passed = true; p.pos = ((from + steps) % N + N) % N; }
    else { if (to < from && to !== ISLAND) passed = true; p.pos = to; }
    log(s, { t: 'move', id: p.id, from, to: p.pos, steps: steps != null ? steps : ((to - from + N) % N) });
    if (passed && p.pos !== ISLAND) { p.money += SALARY; log(s, { t: 'salary', id: p.id, amt: SALARY }); }
  }
  function goIsland(s, p) {
    p.pos = ISLAND; p.island = 3; s.doubles = 0;
    log(s, { t: 'move', id: p.id, to: ISLAND, warp: true });
    s.msg = `🏝️ ${p.name} 님 무인도에 갇혔어요!`;
  }
  /** 도착한 칸 처리. 고를 게 있으면 decision 을 남기고, 없으면 차례를 넘김 */
  function land(s, p, depth = 0) {
    const i = p.pos, b = BOARD[i];
    if (b.type === 'city' || b.type === 'spot') {
      const o = s.owner[i];
      if (o == null) {
        const opts = buyOptions(s, p, i);
        if (opts.length) { s.phase = 'buy'; s.decision = { pos: i, options: opts }; s.msg = `${b.name}에 도착! 살까요?`; return; }
        s.msg = `${b.name}을(를) 살 돈이 부족해요.`;
      } else if (o === p.id) {
        const opts = buildOptions(s, p, i);
        if (opts.length) { s.phase = 'build'; s.decision = { pos: i, options: opts }; s.msg = `내 땅 ${b.name}! 건물을 지을까요?`; return; }
        s.msg = `내 땅 ${b.name}에 도착했어요.`;
      } else {
        let t = toll(s, i);
        const owner = P(s, o);
        if (p.items.waiver) { p.items.waiver--; t = 0; s.msg = `🎫 우대권으로 ${b.name} 통행료 면제!`; }
        else if (p.items.half) { p.items.half--; t = Math.round(t / 2); }
        if (t) {
          const ok = pay(s, p, t, o, `${b.name} 통행료`);
          log(s, { t: 'toll', id: p.id, to: o, amt: t, pos: i });
          if (ok) s.msg = `${b.name} 통행료 ${t.toLocaleString()}만원을 ${owner.name} 님에게 냈어요.`;
        }
      }
    } else if (b.type === 'key') {
      if (!s.deck.length) s.deck = shuffle([...KEYS.keys()], s.rnd);
      const k = KEYS[s.deck.pop()];
      s.card = { ...k, n: s.seq + 1 };
      log(s, { t: 'key', id: p.id, txt: k.txt });
      s.msg = `🔑 황금열쇠: ${k.txt}`;
      if (k.t === 'money') p.money += k.v;
      if (k.t === 'birthday') for (const q of s.players) if (q !== p && !q.out) { const g = Math.min(k.v, q.money); q.money -= g; p.money += g; }
      if (k.t === 'fine') pay(s, p, k.v, null, '벌금');
      if (k.t === 'repair') pay(s, p, k.v * s.owner.reduce((a, o, j) => a + (o === p.id ? s.level[j] : 0), 0), null, '수리비');
      if (k.t === 'item') p.items[k.item]++;
      if (k.t === 'go' && !p.out) {
        if (k.jail) return void (goIsland(s, p), endTurn(s));
        moveTo(s, p, k.to);
        if (depth < 2) return land(s, p, depth + 1);
      }
      if (k.t === 'back' && !p.out) { moveTo(s, p, null, -k.v); if (depth < 2) return land(s, p, depth + 1); }
    } else if (b.type === 'island') {
      p.island = 3; s.doubles = 0; s.msg = `🏝️ ${p.name} 님 무인도 도착! 3턴 동안 쉬어요 (더블이면 탈출).`;
    } else if (b.type === 'fund') {
      const g = s.fund; p.money += g; s.fund = 0;
      log(s, { t: 'fund', id: p.id, amt: g });
      s.msg = g ? `💰 사회복지기금 ${g.toLocaleString()}만원을 받았어요!` : '사회복지기금이 비어 있어요.';
    } else if (b.type === 'tax') {
      const t = Math.max(50, Math.round(p.money * 0.1));
      pay(s, p, t, null, '세금');
      log(s, { t: 'tax', id: p.id, amt: t });
      s.msg = `🏛️ 국세청: 세금 ${t.toLocaleString()}만원 (사회복지기금으로)`;
    } else if (b.type === 'travel') {
      p.travel = true; s.msg = `✈️ 세계여행! 다음 차례에 원하는 곳으로 날아가요.`;
    }
    endTurn(s);
  }
  function buyOptions(s, p, i) {
    const b = BOARD[i], out = [];
    if (p.money < b.price) return out;
    out.push({ lvl: 0, cost: b.price });
    if (b.type === 'city') for (let l = 1; l <= 2; l++) { const c = out[out.length - 1].cost + buildCost(i, l); if (c <= p.money) out.push({ lvl: l, cost: c }); }
    return out;
  }
  function buildOptions(s, p, i) {
    if (!isCity(i) || s.level[i] >= 4) return [];
    const out = [];
    let c = 0;
    for (let l = s.level[i] + 1; l <= 4; l++) {
      if (l === 4 && s.level[i] < 3) break;                                              // 랜드마크는 호텔이 있어야
      c += buildCost(i, l);
      if (c > p.money) break;
      out.push({ lvl: l, cost: c });
    }
    return out;
  }

  function roll(s, p) {
    const d = [1 + Math.floor(s.rnd() * 6), 1 + Math.floor(s.rnd() * 6)];
    s.dice = d; s.rolls++;
    log(s, { t: 'roll', id: p.id, dice: d });
    return d;
  }

  function act(s, id, a) {
    const p = cur(s);
    if (s.over || p.id !== id) return '지금은 내 차례가 아니에요.';
    if (s.phase === 'roll') {
      if (a.t === 'escape') {
        if (!p.island) return '무인도에 있지 않아요.';
        if (p.items.escape) p.items.escape--; else { if (p.money < 100) return '돈이 부족해요.'; pay(s, p, 100, null, '탈출 비용'); }
        p.island = 0; s.msg = `🚤 ${p.name} 님 무인도 탈출! 주사위를 굴리세요.`;
        return;
      }
      if (a.t !== 'roll') return '주사위를 굴려 주세요.';
      const [d1, d2] = roll(s, p), dbl = d1 === d2;
      if (p.island) {
        if (dbl) { p.island = 0; s.msg = `🎉 더블! 무인도 탈출!`; }
        else {
          p.island--;
          if (p.island > 0) { s.msg = `${d1}·${d2} — 탈출 실패 (남은 ${p.island}턴)`; return void endTurnNoDouble(s); }
          s.msg = '3턴이 지나 무인도에서 나왔어요.';
        }
        moveTo(s, p, null, d1 + d2);
        return land(s, p);
      }
      if (dbl) { s.doubles++; if (s.doubles >= 3) { goIsland(s, p); return void endTurnNoDouble(s); } } else s.doubles = 0;
      moveTo(s, p, null, d1 + d2);
      return land(s, p);
    }
    if (s.phase === 'travel') {
      if (a.t !== 'travel') return '갈 곳을 골라 주세요.';
      const to = Math.floor(+a.to);
      if (!(to >= 0 && to < N) || to === TRAVEL) return '그곳으로는 갈 수 없어요.';
      p.travel = false; s.doubles = 0;
      log(s, { t: 'travel', id: p.id, to });
      moveTo(s, p, to);
      s.msg = `✈️ ${p.name} 님 ${BOARD[to].name}(으)로 날아갔어요!`;
      return land(s, p);
    }
    if (s.phase === 'buy' || s.phase === 'build') {
      const dcs = s.decision;
      if (a.t === 'pass') { s.msg = s.phase === 'buy' ? `${BOARD[dcs.pos].name}을(를) 사지 않았어요.` : '건물을 짓지 않았어요.'; return void endTurn(s); }
      const opt = dcs.options.find(o => o.lvl === +a.lvl);
      if ((s.phase === 'buy' ? a.t !== 'buy' : a.t !== 'build') || !opt) return '고를 수 없는 선택이에요.';
      p.money -= opt.cost;
      if (s.phase === 'buy') s.owner[dcs.pos] = p.id;
      s.level[dcs.pos] = opt.lvl;
      log(s, { t: s.phase, id: p.id, pos: dcs.pos, lvl: opt.lvl });
      s.msg = s.phase === 'buy' ? `🏠 ${p.name} 님이 ${BOARD[dcs.pos].name}을(를) 샀어요${opt.lvl ? ` (+${LEVELS[opt.lvl]})` : ''}!` : `🏗️ ${BOARD[dcs.pos].name}에 ${LEVELS[opt.lvl]}을(를) 지었어요!`;
      return void endTurn(s);
    }
    return '지금은 할 수 없는 행동이에요.';
  }
  function endTurnNoDouble(s) { s.doubles = 0; endTurn(s); }

  /* ── 봇 ── */
  function ai(s, id) {
    const p = P(s, id);
    if (s.phase === 'roll') {
      if (p.island && (p.items.escape || (p.money > 900 && p.island < 3 && s.rnd() < 0.6))) return { t: 'escape' };
      return { t: 'roll' };
    }
    if (s.phase === 'travel') {
      const mine = s.owner.map((o, i) => (o === id && buildOptions(s, p, i).length ? i : -1)).filter(i => i >= 0).sort((a, b) => BOARD[b].price - BOARD[a].price);
      if (mine.length) return { t: 'travel', to: mine[0] };
      const free = BOARD.map((b, i) => (ownable(i) && s.owner[i] == null && b.price <= p.money - 200 ? i : -1)).filter(i => i >= 0).sort((a, b) => BOARD[b].price - BOARD[a].price);
      return { t: 'travel', to: free.length ? free[0] : 0 };
    }
    const reserve = 150 + s.round * 8;
    if (s.phase === 'buy' || s.phase === 'build') {
      const ok = s.decision.options.filter(o => p.money - o.cost >= (s.phase === 'buy' && o.lvl === 0 ? reserve * 0.5 : reserve));
      if (!ok.length) return { t: 'pass' };
      return { t: s.phase, lvl: ok[ok.length - 1].lvl };
    }
    return null;
  }

  function view(s) {
    return {
      players: s.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, color: p.color, money: p.money, pos: p.pos, out: p.out, island: p.island, items: p.items, travel: p.travel, worth: worth(s, p) })),
      owner: s.owner, level: s.level, turnId: cur(s).id, phase: s.phase, dice: s.dice, rolls: s.rolls, fund: s.fund, round: Math.min(s.round, s.maxRounds), maxRounds: s.maxRounds,
      card: s.card, decision: s.decision, msg: s.msg, log: s.log.slice(-12), seq: s.seq, over: s.over, tolls: BOARD.map((b, i) => (ownable(i) ? toll(s, i) : 0)),
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => (a.out - b.out) || worth(s, b) - worth(s, a));
    const w = ranked[0];
    return {
      title: `🌍 ${w.name} 승리!`, subtitle: s.players.filter(p => !p.out).length <= 1 ? '모두 파산하고 혼자 남았어요!' : `${s.maxRounds}라운드 끝 · 총자산이 가장 많아요`,
      ranking: ranked.map(p => ({ id: p.id, value: p.out ? '파산' : `${worth(s, p).toLocaleString()}만원` })),
    };
  }

  return {
    meta: {
      name: '세계여행 보드게임', min: 2, max: 4, bots: true, turnSec: 40, botDelay: [900, 1500],
      options: [
        { key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
        { key: 'rounds', label: '🔁 라운드 수', def: 20, values: [[10, '10라운드 (짧게)'], [20, '20라운드'], [30, '30라운드 (길게)']] },
      ],
    },
    BOARD, GROUPS, LEVELS, TOLL, BUILD, START_MONEY, SALARY, KEYS, buildCost,
    setup, act, ai, view, result,
    pending: s => (s.over ? [] : [cur(s).id]),
    drop(s, id) { const p = P(s, id); if (!p || p.out) return; p.out = true; s.owner.forEach((o, i) => { if (o === id) { s.owner[i] = null; s.level[i] = 0; } }); s.msg = `${p.name} 님이 나갔어요.`; if (cur(s).id === id) endTurn(s); else checkOver(s); },
  };
});
