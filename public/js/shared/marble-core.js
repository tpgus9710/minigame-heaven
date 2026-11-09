/* =====================================================================
 *  🌍 세계여행 보드게임 규칙 (부루마블 방식 + 모두의 마블 '인수') — 화면(싱글)과 서버(멀티)가 같이 씀
 *  돈 단위: 만원. 32칸 (모서리: 출발 · 무인도 · 사회복지기금 · 세계여행)
 *
 *  한 장면씩 보여 주기: 일어난 일은 모두 기록(log)에 남기고, 기록마다 그 순간의 돈(m) · 기금(f) · 땅 변화(o) ·
 *  황금열쇠 보관함(it)을 같이 담아요 → 화면은 기록을 차례로 연출해요 (주사위 → 말 이동 → 통행료 …).
 *  연출에 걸리는 시간(lag)만큼 봇은 기다렸다 움직이고, 사람 제한 시간도 늦게 시작해요 (TableKit: Core.lag).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.MarbleCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const GROUPS = { 1: '#a0673f', 2: '#38bdf8', 3: '#f472b6', 4: '#fb923c', 5: '#ef4444', 6: '#eab308', 7: '#22c55e', 8: '#3b82f6' };
  const C = (name, price, group, code, ic) => ({ type: 'city', name, price, group, code, ic });
  const BOARD = [
    { type: 'start', name: '출발', ic: '🏁' }, C('타이베이', 50, 1, 'TW', '🏮'), { type: 'key', name: '황금열쇠', ic: '🔑' }, C('베이징', 60, 1, 'CN', '🐼'), C('마닐라', 60, 1, 'PH', '🥭'),
    { type: 'spot', name: '제주도', price: 200, ic: '🍊' }, C('싱가포르', 80, 2, 'SG', '🦁'), C('이스탄불', 90, 2, 'TR', '🕌'),
    { type: 'island', name: '무인도', ic: '🏝️' }, C('아테네', 100, 3, 'GR', '🏛️'), { type: 'key', name: '황금열쇠', ic: '🔑' }, C('코펜하겐', 110, 3, 'DK', '🧜'), C('스톡홀름', 110, 3, 'SE', '👑'),
    C('베른', 130, 4, 'CH', '🏔️'), C('베를린', 140, 4, 'DE', '🥨'), C('오타와', 140, 4, 'CA', '🍁'),
    { type: 'fund', name: '사회복지기금', ic: '💰' }, C('부에노스아이레스', 160, 5, 'AR', '💃'), { type: 'key', name: '황금열쇠', ic: '🔑' }, C('상파울루', 170, 5, 'BR', '⚽'), C('시드니', 170, 5, 'AU', '🦘'),
    { type: 'spot', name: '부산', price: 250, ic: '🌊' }, C('하와이', 190, 6, 'US', '🌺'), C('리스본', 200, 6, 'PT', '🚋'),
    { type: 'travel', name: '세계여행', ic: '✈️' }, C('마드리드', 220, 7, 'ES', '🥘'), { type: 'key', name: '황금열쇠', ic: '🔑' }, C('도쿄', 240, 7, 'JP', '🗻'), C('런던', 240, 7, 'GB', '💂'),
    C('파리', 280, 8, 'FR', '🗼'), { type: 'tax', name: '국세청', ic: '🧾' }, C('뉴욕', 320, 8, 'US', '🗽'),
  ];
  const N = BOARD.length, START_MONEY = 2000, SALARY = 200, ISLAND = 8, TRAVEL = 24;
  const LEVELS = ['땅', '별장', '빌딩', '호텔', '랜드마크'];
  const TOLL = [0.3, 1.0, 2.4, 4.2, 6.5];               // 단계별 통행료 = 가격 × 배수
  const BUILD = [0.5, 0.8, 1.1, 1.5];                   // 별장·빌딩·호텔·랜드마크 짓는 값 = 가격 × 배수
  const TAKEOVER = 2;                                   // 인수 값 = (땅값 + 지은 건물값) × 2 → 모두 원래 주인에게
  const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
  /** 보관하는 황금열쇠 */
  const ITEMS = {
    waiver: { name: '우대권', ic: '🎫', txt: '남의 땅 통행료를 한 번 면제받아요.', how: '통행료를 낼 때 「우대권 쓰기」를 누르면 돼요.' },
    half: { name: '반값 쿠폰', ic: '🏷️', txt: '남의 땅 통행료를 한 번 반만 내요.', how: '통행료를 낼 때 「반값 쿠폰 쓰기」를 누르면 돼요.' },
    escape: { name: '무인도 탈출권', ic: '🚤', txt: '무인도에서 바로 나와요.', how: '무인도에 갇혔을 때 「탈출권 쓰기」를 누르면 돼요.' },
    shield: { name: '인수 방어권', ic: '🛡️', txt: '내 땅이 인수당할 때 한 번 막아 줘요.', how: '누가 내 땅을 인수하려 하면 저절로 써져요.' },
  };
  const ITEM_KEYS = Object.keys(ITEMS);
  const KEYS = [
    { t: 'money', v: 200, ic: '🎰', name: '복권 당첨', txt: '복권 당첨! 200만원을 받아요.' },
    { t: 'money', v: 100, ic: '🎓', name: '장학금', txt: '장학금 100만원을 받아요.' },
    { t: 'money', v: 300, ic: '📈', name: '주식 대박', txt: '주식이 대박 났어요! 300만원을 받아요.' },
    { t: 'birthday', v: 30, ic: '🎂', name: '생일 축하', txt: '생일 축하해요! 모두에게 30만원씩 받아요.' },
    { t: 'fine', v: 50, ic: '🚓', name: '과속 벌금', txt: '과속 벌금 50만원을 사회복지기금에 내요.' },
    { t: 'fine', v: 100, ic: '🏥', name: '병원비', txt: '병원비 100만원을 사회복지기금에 내요.' },
    { t: 'repair', v: 20, ic: '🔧', name: '건물 수리비', txt: '내 건물 한 단계마다 20만원씩 수리비를 내요.' },
    { t: 'fine', v: 150, ic: '💝', name: '정기 기부', txt: '사회복지기금에 150만원을 기부해요.' },
    { t: 'go', to: 0, ic: '🏁', name: '출발점으로', txt: '출발점으로 이동! 월급을 받아요.' },
    { t: 'go', to: ISLAND, ic: '🌀', name: '태풍', txt: '태풍을 만나 무인도로 떠내려가요…', jail: true },
    { t: 'go', to: TRAVEL, ic: '✈️', name: '세계여행 초대권', txt: '세계여행 칸으로 가요. 다음 차례에 원하는 곳으로!' },
    { t: 'back', v: 3, ic: '🧭', name: '길을 잃었어요', txt: '길을 잃었어요. 뒤로 3칸 가요.' },
    { t: 'go', to: 31, ic: '🗽', name: '뉴욕 출장', txt: '뉴욕 출장! 뉴욕으로 가요.' },
    { t: 'item', item: 'waiver', ic: '🎫', name: '우대권', txt: '통행료를 한 번 면제받아요. 보관했다가 쓸 때를 골라요.' },
    { t: 'item', item: 'escape', ic: '🚤', name: '무인도 탈출권', txt: '무인도에서 바로 나와요. 보관해 두세요.' },
    { t: 'item', item: 'half', ic: '🏷️', name: '반값 쿠폰', txt: '통행료를 한 번 반만 내요. 보관했다가 쓸 때를 골라요.' },
    { t: 'item', item: 'shield', ic: '🛡️', name: '인수 방어권', txt: '내 땅이 인수당할 때 한 번 막아 줘요. 보관해 두세요.', takeover: true },
  ];
  /** 화면 연출 시간(ms) — 화면(marble.js)도 이 값대로 보여 줘요 */
  const PACE = { roll: 1150, step: 240, walkEnd: 320, fly: 1150, salary: 550, toll: 1250, use: 1150, key: 3000, cash: 850, got: 950, gift: 1000,
    buy: 1050, build: 1050, takeover: 1700, shield: 1600, pass: 600, sell: 1000, bankrupt: 2100, fund: 1150, tax: 1150, island: 1100, stay: 1000, escape: 950 };
  /** 이동 기록: 12칸 이하는 한 칸씩 걷고, 그보다 멀거나 순간이동이면 날아가요 */
  const walkSteps = e => (e.how ? 0 : (e.steps && Math.abs(e.steps) <= 12 ? Math.abs(e.steps) : 0));
  const evMs = e => (e.t === 'move' ? (walkSteps(e) ? walkSteps(e) * PACE.step + PACE.walkEnd : PACE.fly) : PACE[e.t] || 0);

  const isCity = i => BOARD[i].type === 'city';
  const ownable = i => BOARD[i].type === 'city' || BOARD[i].type === 'spot';
  const cur = s => s.players[s.turn];
  const P = (s, id) => s.players.find(p => p.id === id);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  /** 받침에 맞는 조사: josa('파리', '을', '를') → 파리를 · josa('베를린', '으로') → 베를린으로 */
  function josa(w, a, b) {
    w = String(w); const c = w.charCodeAt(w.length - 1), jong = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : 0;
    if (a === '으로') return w + (jong && jong !== 8 ? '으로' : '로');
    return w + (jong ? a : b);
  }
  const noItems = () => ({ waiver: 0, half: 0, escape: 0, shield: 0 });
  const deckOf = s => shuffle(KEYS.map((k, i) => i).filter(i => s.takeover || !KEYS[i].takeover), s.rnd);
  /** 기록 남기기 (그 순간의 돈 · 기금을 같이) */
  function ev(s, e) { e.m = s.players.map(p => p.money); e.f = s.fund; log(s, e); }

  function setup(players, rnd, opts) {
    const s = {
      rnd, takeover: opts.takeover == null ? true : Number(opts.takeover) !== 0,
      players: players.map((p, i) => ({ ...p, color: COLORS[i % 4], money: START_MONEY, pos: 0, out: false, island: 0, items: noItems(), travel: false })),
      owner: Array(N).fill(null), level: Array(N).fill(0), turn: 0, phase: 'roll', dice: [1, 1], rolls: 0, doubles: 0, fund: 0,
      round: 1, maxRounds: Number(opts.rounds) || 20, deck: [], card: null, decision: null, over: false, log: [], seq: 0, msg: '', lag: 0, lagAt: 0,
    };
    s.deck = deckOf(s);
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
  /** 인수: 도시만 · 랜드마크는 못 함 · 값은 (땅값 + 건물값) × 2 */
  const takeoverCost = (s, i) => assetValue(s, i) * TAKEOVER;
  const canTakeover = (s, p, i) => !!(s.takeover && isCity(i) && s.level[i] < 4 && s.owner[i] && s.owner[i] !== p.id && !p.out && p.money >= takeoverCost(s, i));

  /** 돈 내기 (모자라면 땅·건물을 팔고, 그래도 모자라면 파산) */
  function pay(s, p, amt, toId, why) {
    if (amt <= 0) return true;
    if (p.money < amt) liquidate(s, p, amt);
    const to = toId ? P(s, toId) : null;
    if (p.money < amt) {                                                                 // 파산
      const left = p.money;
      if (to) to.money += left; else s.fund += left;
      p.money = 0; p.out = true; p.items = noItems(); p.island = 0; p.travel = false;
      const o = [];
      s.owner.forEach((ow, i) => { if (ow === p.id) { s.owner[i] = null; s.level[i] = 0; o.push([i, null, 0]); } });
      ev(s, { t: 'bankrupt', id: p.id, to: toId || null, amt: left, why, o });
      s.msg = `💸 ${p.name} 님 파산! (${why})`;
      return false;
    }
    p.money -= amt;
    if (to) to.money += amt; else if (toId === null) s.fund += amt;
    return true;
  }
  /** 건물부터 반값에, 그다음 땅을 땅값의 70%에 팔아요 (싼 곳부터) → 기록은 한 번에 */
  function liquidate(s, p, need) {
    const mine = () => s.owner.map((o, i) => (o === p.id ? i : -1)).filter(i => i >= 0);
    const o = [], m0 = p.money;
    while (p.money < need) {
      const withB = mine().filter(i => s.level[i] > 0).sort((a, b) => BOARD[a].price - BOARD[b].price)[0];
      if (withB == null) break;
      p.money += Math.round(buildCost(withB, s.level[withB]) * 0.5); s.level[withB]--;
      o.push([withB, p.id, s.level[withB]]);
    }
    while (p.money < need) {
      const land = mine().sort((a, b) => BOARD[a].price - BOARD[b].price)[0];
      if (land == null) break;
      p.money += Math.round(BOARD[land].price * 0.7); s.owner[land] = null; s.level[land] = 0;
      o.push([land, null, 0]);
    }
    if (o.length) ev(s, { t: 'sell', id: p.id, amt: p.money - m0, o });
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
    if (alive.length <= 1 || s.round > s.maxRounds) { s.over = true; s.phase = 'over'; s.decision = null; return true; }
    return false;
  }
  function moveTo(s, p, to, steps, how) {
    const from = p.pos;
    let passed = false;
    if (steps != null) { if (steps > 0 && from + steps >= N) passed = true; p.pos = ((from + steps) % N + N) % N; }
    else { if (to < from && to !== ISLAND) passed = true; p.pos = to; }
    ev(s, { t: 'move', id: p.id, from, to: p.pos, steps: steps != null ? steps : ((to - from + N) % N), how: how || '' });
    if (passed && p.pos !== ISLAND) { p.money += SALARY; ev(s, { t: 'salary', id: p.id, amt: SALARY }); }
  }
  function goIsland(s, p) {
    const from = p.pos;
    p.pos = ISLAND; p.island = 3; s.doubles = 0;
    ev(s, { t: 'move', id: p.id, from, to: ISLAND, steps: 0, how: 'warp' });
    ev(s, { t: 'island', id: p.id });
    s.msg = `🏝️ ${p.name} 님 무인도에 갇혔어요!`;
  }
  /** 도착한 칸 처리. 고를 게 있으면 decision 을 남기고, 없으면 차례를 넘김 */
  function land(s, p, depth = 0) {
    const i = p.pos, b = BOARD[i];
    if (ownable(i)) {
      const o = s.owner[i];
      if (o == null) {
        const opts = buyOptions(s, p, i);
        if (opts.length) { s.phase = 'buy'; s.decision = { pos: i, options: opts }; s.msg = `${b.name}에 도착! 살까요?`; return; }
        s.msg = `${josa(b.name, '을', '를')} 살 돈이 부족해요.`;
      } else if (o === p.id) {
        const opts = buildOptions(s, p, i);
        if (opts.length) { s.phase = 'build'; s.decision = { pos: i, options: opts }; s.msg = `내 땅 ${b.name}! 건물을 지을까요?`; return; }
        s.msg = `내 땅 ${b.name}에 도착했어요.`;
      } else return arriveToll(s, p, i);
    } else if (b.type === 'key') {
      if (!s.deck.length) s.deck = deckOf(s);
      const ki = s.deck.pop(), k = KEYS[ki];
      s.card = { k: ki, n: s.seq + 1, id: p.id };
      ev(s, { t: 'key', id: p.id, k: ki });
      s.msg = `🔑 황금열쇠 「${k.name}」 ${k.txt}`;
      if (k.t === 'money') { p.money += k.v; ev(s, { t: 'cash', id: p.id, amt: k.v }); }
      if (k.t === 'birthday') {
        let got = 0;
        for (const q of s.players) if (q !== p && !q.out) { const g = Math.min(k.v, q.money); q.money -= g; p.money += g; got += g; }
        if (got) ev(s, { t: 'gift', id: p.id, amt: got });
      }
      if (k.t === 'fine' && pay(s, p, k.v, null, k.name)) ev(s, { t: 'cash', id: p.id, amt: -k.v });
      if (k.t === 'repair') {
        const amt = k.v * s.owner.reduce((a, o, j) => a + (o === p.id ? s.level[j] : 0), 0);
        if (pay(s, p, amt, null, '수리비') && amt) ev(s, { t: 'cash', id: p.id, amt: -amt });
      }
      if (k.t === 'item') { p.items[k.item]++; ev(s, { t: 'got', id: p.id, item: k.item, it: { ...p.items } }); }
      if (k.t === 'go' && !p.out) {
        if (k.jail) return void (goIsland(s, p), endTurn(s));
        moveTo(s, p, k.to, null, (k.to - p.pos + N) % N > 12 ? 'fly' : '');
        if (depth < 2) return land(s, p, depth + 1);
      }
      if (k.t === 'back' && !p.out) { moveTo(s, p, null, -k.v); if (depth < 2) return land(s, p, depth + 1); }
    } else if (b.type === 'island') {
      p.island = 3; s.doubles = 0;
      ev(s, { t: 'island', id: p.id });
      s.msg = `🏝️ ${p.name} 님 무인도 도착! 3턴 동안 쉬어요 (더블이면 탈출).`;
    } else if (b.type === 'fund') {
      const g = s.fund; p.money += g; s.fund = 0;
      ev(s, { t: 'fund', id: p.id, amt: g });
      s.msg = g ? `💰 사회복지기금 ${fmt(g)}만원을 받았어요!` : '사회복지기금이 비어 있어요.';
    } else if (b.type === 'tax') {
      const t = Math.max(50, Math.round(p.money * 0.1));
      if (pay(s, p, t, null, '세금')) { ev(s, { t: 'tax', id: p.id, amt: t }); s.msg = `🧾 국세청: 세금 ${fmt(t)}만원 (사회복지기금으로)`; }
    } else if (b.type === 'travel') {
      p.travel = true; s.msg = `✈️ 세계여행! 다음 차례에 원하는 곳으로 날아가요.`;
    }
    endTurn(s);
  }
  /** 남의 땅: 우대권 · 반값 쿠폰이 있으면 쓸지 고르고, 없으면 바로 내요 */
  function arriveToll(s, p, i) {
    const t = toll(s, i);
    if (p.items.waiver || p.items.half) {
      s.phase = 'toll'; s.decision = { pos: i, toll: t, owner: s.owner[i] };
      s.msg = `${BOARD[i].name} 통행료 ${fmt(t)}만원 — 황금열쇠를 쓸까요?`;
      return;
    }
    payToll(s, p, i, t, '');
  }
  function payToll(s, p, i, t, item) {
    const b = BOARD[i], oid = s.owner[i], owner = P(s, oid);
    if (item) { p.items[item]--; ev(s, { t: 'use', id: p.id, item, pos: i, it: { ...p.items } }); }
    const amt = item === 'waiver' ? 0 : item === 'half' ? Math.round(t / 2) : t;
    if (!pay(s, p, amt, oid, `${b.name} 통행료`)) return endTurn(s);
    ev(s, { t: 'toll', id: p.id, to: oid, pos: i, amt, full: t, item });
    s.msg = amt ? `${b.name} 통행료 ${fmt(amt)}만원을 ${owner.name} 님에게 냈어요.` : `🎫 우대권으로 ${b.name} 통행료 면제!`;
    if (canTakeover(s, p, i)) {
      s.phase = 'takeover'; s.decision = { pos: i, cost: takeoverCost(s, i), owner: oid, shield: owner.items.shield > 0 };
      s.msg += ' 인수할까요?';
      return;
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
    ev(s, { t: 'roll', id: p.id, dice: d });
    return d;
  }

  function act0(s, id, a) {
    const p = cur(s);
    if (s.over || p.id !== id) return '지금은 내 차례가 아니에요.';
    if (s.phase === 'roll') {
      if (a.t === 'escape') {
        if (!p.island) return '무인도에 있지 않아요.';
        if (p.items.escape) { p.items.escape--; ev(s, { t: 'use', id: p.id, item: 'escape', it: { ...p.items } }); }
        else { if (p.money < 100) return '돈이 부족해요.'; pay(s, p, 100, null, '탈출 비용'); }
        p.island = 0;
        ev(s, { t: 'escape', id: p.id, how: 'pay' });
        s.msg = `🚤 ${p.name} 님 무인도 탈출! 주사위를 굴리세요.`;
        return;
      }
      if (a.t !== 'roll') return '주사위를 굴려 주세요.';
      const [d1, d2] = roll(s, p), dbl = d1 === d2;
      if (p.island) {
        if (dbl) { p.island = 0; ev(s, { t: 'escape', id: p.id, how: 'dice' }); s.msg = `🎉 더블! 무인도 탈출!`; }
        else {
          p.island--;
          if (p.island > 0) { ev(s, { t: 'stay', id: p.id, left: p.island }); s.msg = `${d1}·${d2} — 탈출 실패 (남은 ${p.island}턴)`; return void endTurnNoDouble(s); }
          ev(s, { t: 'escape', id: p.id, how: 'time' });
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
      moveTo(s, p, to, null, 'fly');
      s.msg = `✈️ ${p.name} 님 ${josa(BOARD[to].name, '으로')} 날아갔어요!`;
      return land(s, p);
    }
    if (s.phase === 'toll') {
      if (a.t !== 'pay') return '통행료를 어떻게 낼지 골라 주세요.';
      const use = a.use === 'waiver' || a.use === 'half' ? a.use : '';
      if (use && !p.items[use]) return '그 황금열쇠가 없어요.';
      const d = s.decision;
      s.decision = null;
      if (s.owner[d.pos] !== d.owner) { s.msg = '땅 주인이 게임을 나가서 통행료를 내지 않아요.'; return void endTurn(s); }
      return payToll(s, p, d.pos, d.toll, use);
    }
    if (s.phase === 'takeover') {
      const d = s.decision, b = BOARD[d.pos], owner = P(s, d.owner);
      if (a.t === 'pass') { ev(s, { t: 'pass', id: p.id, what: 'takeover', pos: d.pos }); s.msg = `${josa(b.name, '을', '를')} 인수하지 않았어요.`; return void endTurn(s); }
      if (a.t !== 'takeover') return '인수할지 골라 주세요.';
      if (!owner || owner.out || s.owner[d.pos] !== d.owner) { s.msg = '땅 주인이 게임을 나가서 인수할 수 없어요.'; return void endTurn(s); }
      if (owner.items.shield > 0) {
        owner.items.shield--;
        ev(s, { t: 'shield', id: p.id, owner: owner.id, pos: d.pos, it: { ...owner.items } });
        s.msg = `🛡️ ${owner.name} 님의 인수 방어권! ${b.name} 인수를 막았어요.`;
        return void endTurn(s);
      }
      const cost = takeoverCost(s, d.pos);
      if (p.money < cost) return '돈이 부족해요.';
      p.money -= cost; owner.money += cost;
      s.owner[d.pos] = p.id;
      ev(s, { t: 'takeover', id: p.id, from: owner.id, pos: d.pos, cost, lvl: s.level[d.pos], o: [[d.pos, p.id, s.level[d.pos]]] });
      s.msg = `🤝 ${p.name} 님이 ${josa(b.name, '을', '를')} ${fmt(cost)}만원에 인수했어요!`;
      const opts = buildOptions(s, p, d.pos);
      if (opts.length) { s.phase = 'build'; s.decision = { pos: d.pos, options: opts, after: 'takeover' }; s.msg += ' 건물을 더 지을까요?'; return; }
      return void endTurn(s);
    }
    if (s.phase === 'buy' || s.phase === 'build') {
      const dcs = s.decision;
      if (a.t === 'pass') {
        ev(s, { t: 'pass', id: p.id, what: s.phase, pos: dcs.pos });
        s.msg = s.phase === 'buy' ? `${josa(BOARD[dcs.pos].name, '을', '를')} 사지 않았어요.` : '건물을 짓지 않았어요.';
        return void endTurn(s);
      }
      const opt = dcs.options.find(o => o.lvl === +a.lvl);
      if ((s.phase === 'buy' ? a.t !== 'buy' : a.t !== 'build') || !opt) return '고를 수 없는 선택이에요.';
      if (p.money < opt.cost) return '돈이 부족해요.';
      p.money -= opt.cost;
      if (s.phase === 'buy') s.owner[dcs.pos] = p.id;
      s.level[dcs.pos] = opt.lvl;
      ev(s, { t: s.phase, id: p.id, pos: dcs.pos, lvl: opt.lvl, cost: opt.cost, o: [[dcs.pos, p.id, opt.lvl]] });
      s.msg = s.phase === 'buy' ? `🏠 ${p.name} 님이 ${josa(BOARD[dcs.pos].name, '을', '를')} 샀어요${opt.lvl ? ` (+${LEVELS[opt.lvl]})` : ''}!` : `🏗️ ${BOARD[dcs.pos].name}에 ${josa(LEVELS[opt.lvl], '을', '를')} 지었어요!`;
      return void endTurn(s);
    }
    return '지금은 할 수 없는 행동이에요.';
  }
  function endTurnNoDouble(s) { s.doubles = 0; endTurn(s); }
  /** 행동 + 이번에 생긴 기록을 화면이 다 보여 주는 데 걸리는 시간 */
  function act(s, id, a) {
    const n0 = s.seq || 0;
    const err = act0(s, id, a || {});
    if (!err) { s.lag = s.log.filter(e => e.n > n0).reduce((t, e) => t + evMs(e), 0); s.lagAt = Date.now(); }
    return err;
  }

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
    if (s.phase === 'toll') {                                                            // 큰 통행료일 때 아껴 둔 황금열쇠를 써요
      const t = s.decision.toll, danger = t >= p.money * 0.5;
      if (p.items.waiver && (t >= 150 || danger)) return { t: 'pay', use: 'waiver' };
      if (p.items.half && (t >= 100 || danger)) return { t: 'pay', use: 'half' };
      return { t: 'pay', use: '' };
    }
    const reserve = 150 + s.round * 8;
    if (s.phase === 'takeover') {                                                        // 같은 색을 다 모으게 되거나 건물이 많은 도시만, 돈을 넉넉히 남길 때
      const d = s.decision, g = BOARD[d.pos].group;
      if (p.money - d.cost < Math.max(500, reserve * 2.5)) return { t: 'pass' };
      const same = BOARD.map((b, j) => (b.group === g ? j : -1)).filter(j => j >= 0);
      const completes = same.every(j => j === d.pos || s.owner[j] === id);
      if (completes) return { t: 'takeover' };
      if (d.shield) return { t: 'pass' };
      const r = s.rnd();
      return (s.level[d.pos] >= 2 && r < 0.5) || (BOARD[d.pos].price >= 160 && r < 0.25) ? { t: 'takeover' } : { t: 'pass' };
    }
    if (s.phase === 'buy' || s.phase === 'build') {
      const ok = s.decision.options.filter(o => p.money - o.cost >= (s.phase === 'buy' && o.lvl === 0 ? reserve * 0.5 : reserve));
      if (!ok.length) return { t: 'pass' };
      return { t: s.phase, lvl: ok[ok.length - 1].lvl };
    }
    return null;
  }

  function view(s) {
    return {
      players: s.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, color: p.color, money: p.money, pos: p.pos, out: p.out, island: p.island, items: { ...p.items }, travel: p.travel, worth: worth(s, p) })),
      owner: s.owner, level: s.level, turnId: cur(s).id, phase: s.phase, dice: s.dice, rolls: s.rolls, fund: s.fund, round: Math.min(s.round, s.maxRounds), maxRounds: s.maxRounds,
      takeover: s.takeover, card: s.card, decision: s.decision, msg: s.msg, log: s.log.slice(-24), seq: s.seq, over: s.over,
      tolls: BOARD.map((b, i) => (ownable(i) ? toll(s, i) : 0)),
      tko: BOARD.map((b, i) => (s.takeover && isCity(i) && s.owner[i] && s.level[i] < 4 ? takeoverCost(s, i) : 0)),
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => (a.out - b.out) || worth(s, b) - worth(s, a));
    const w = ranked[0];
    return {
      title: `🌍 ${w.name} 승리!`, subtitle: s.players.filter(p => !p.out).length <= 1 ? '모두 파산하고 혼자 남았어요!' : `${s.maxRounds}라운드 끝 · 총자산이 가장 많아요`,
      ranking: ranked.map(p => ({ id: p.id, value: p.out ? '파산' : `${fmt(worth(s, p))}만원` })),
    };
  }

  return {
    meta: {
      name: '세계여행 보드게임', min: 2, max: 4, bots: true, turnSec: 60,
      /** 봇이 '생각하는' 시간 (연출 시간 lag 은 TableKit 이 따로 더해요): 주사위는 짧게, 사고 · 짓고 · 인수할 땐 조금 길게 */
      botDelay: s => (s.phase === 'roll' ? [800, 1300] : s.phase === 'toll' ? [1100, 1700] : [1400, 2300]),
      options: [
        { key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
        { key: 'rounds', label: '🔁 라운드 수', def: 20, values: [[10, '10라운드 (짧게)'], [20, '20라운드'], [30, '30라운드 (길게)']] },
        { key: 'takeover', label: '🤝 땅 인수', def: 1, values: [[1, '켜기 (모두의 마블 규칙)'], [0, '끄기 (원작 부루마블)']] },
      ],
    },
    BOARD, GROUPS, LEVELS, TOLL, BUILD, TAKEOVER, START_MONEY, SALARY, KEYS, ITEMS, ITEM_KEYS, PACE, ISLAND, TRAVEL,
    buildCost, walkSteps, evMs, josa,
    setup, act, ai, view, result,
    /** 시간 초과: 인수는 하지 않고, 나머지는 봇처럼 */
    auto: (s, id) => (s.phase === 'takeover' ? { t: 'pass' } : ai(s, id)),
    /** 화면 연출이 아직 남은 시간(ms) */
    lag: s => Math.max(0, (s.lag || 0) - (Date.now() - (s.lagAt || 0))),
    /** 사람이 모두 탈락하면 봇끼리 이어 하지 않고 끝내요 (TableKit: out · endNow) */
    out: (s, id) => { const p = P(s, id); return !p || !!p.out; },
    endNow(s) {
      s.over = true; s.phase = 'over'; s.decision = null;
      s.msg = '사람이 모두 파산해서 게임을 마쳤어요.';
      const ranked = s.players.slice().sort((a, b) => (a.out - b.out) || worth(s, b) - worth(s, a));
      return { title: '🏁 게임 끝!', subtitle: '사람이 모두 파산해서 봇끼리는 더 하지 않아요',
        ranking: ranked.map(p => ({ id: p.id, value: p.out ? '파산' : `${fmt(worth(s, p))}만원` })), winners: [] };
    },
    pending: s => (s.over ? [] : [cur(s).id]),
    drop(s, id) {
      const p = P(s, id); if (!p || p.out) return;
      p.out = true; p.items = noItems();
      s.owner.forEach((o, i) => { if (o === id) { s.owner[i] = null; s.level[i] = 0; } });
      s.msg = `${p.name} 님이 나갔어요.`; s.lag = 0;
      if (cur(s).id === id) endTurn(s); else checkOver(s);
    },
  };
});
