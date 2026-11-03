/* =====================================================================
 *  🎓 인생 보드게임 규칙 — 룰렛(1~10)을 돌려 인생길을 달리고, 은퇴했을 때 재산이 가장 많은 사람이 승리
 *  돈 단위: 만원.  갈림길 2곳(대학/취업 · 안정/모험), 멈춤 칸(직업 · 결혼 · 집 · 은퇴)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.LifeCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const W = 1100, H = 670;

  /* ── 판 만들기: 꺾은선 위에 칸을 고르게 놓아요 ── */
  function lay(points, n) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); seg.push(d); total += d; }
    return Array.from({ length: n }, (_, k) => {
      let t = n === 1 ? 0 : (k / (n - 1)) * total, i = 0;
      while (i < seg.length - 1 && t > seg[i]) { t -= seg[i]; i++; }
      const r = seg[i] ? t / seg[i] : 0;
      return [Math.round(points[i][0] + (points[i + 1][0] - points[i][0]) * r), Math.round(points[i][1] + (points[i + 1][1] - points[i][1]) * r)];
    });
  }
  const NODES = [];
  function segment(seg, points, list, prev) {
    const pos = lay(points, list.length), ids = [];
    list.forEach((t, k) => {
      const id = NODES.length;
      NODES.push({ id, seg, type: t[0], v: t[1] == null ? null : t[1], txt: t[2] || '', x: pos[k][0], y: pos[k][1], next: [] });
      if (k === 0 && prev != null) [].concat(prev).forEach(p => NODES[p].next.push(id));
      if (k > 0) NODES[id - 1].next.push(id);
      ids.push(id);
    });
    return ids;
  }
  const M = (v, txt) => ['money', v, txt], L = ['life'], PAY = ['pay'];
  const start = segment('start', [[55, 115], [55, 115]], [['start']]);
  const college = segment('college', [[140, 52], [640, 52]], [M(-300, '전공 서적 구입'), L, M(500, '성적 장학금'), M(-500, '자취방 보증금'), L, M(300, '과외 아르바이트'), M(-200, 'MT 회비'), M(800, '공모전 대상'), ['career', 'college']], start);
  const job = segment('job', [[140, 178], [640, 178]], [['career', 'basic'], PAY, M(-300, '첫 출근 정장 구입'), L, M(400, '사내 아이디어 공모 1등'), PAY, M(-400, '자동차 할부금'), L, M(600, '연말 성과급')], start);
  const m1 = segment('m1', [[725, 115], [725, 115]], [PAY], [college[college.length - 1], job[job.length - 1]]);
  const family = segment('family', [[810, 115], [1045, 115], [1045, 292], [55, 292]], [
    M(-500, '첫 차 구입'), ['marry'], M(-1000, '신혼여행'), PAY, L, ['baby'], M(1500, '부업 대박'), ['house'], PAY, M(-800, '집 수리비'),
    ['promo'], ['gift'], ['baby'], PAY, M(-1200, '자동차 사고 수리비'), L, M(2000, '주식 수익'), ['tax'], PAY, ['baby'], M(-600, '아이 학원비'), L, PAY, M(700, '창립 기념 보너스')], m1);
  const safe = segment('safe', [[140, 385], [640, 385]], [PAY, M(800, '적금 만기'), L, M(-400, '건강검진'), ['promo'], PAY, L, M(600, '배당금'), ['baby']], family[family.length - 1]);
  const risk = segment('risk', [[140, 495], [640, 495]], [['invest'], M(-2000, '창업 실패'), PAY, M(6000, '스타트업 투자 성공'), ['cut'], ['invest'], M(-1500, '코인 폭락'), L, M(4000, '회사 매각')], family[family.length - 1]);
  const m2 = segment('m2', [[725, 440], [725, 440]], [PAY], [safe[safe.length - 1], risk[risk.length - 1]]);
  const gold = segment('gold', [[810, 440], [1045, 440], [1045, 612], [140, 612]], [
    M(1500, '해외 지사 수당'), ['house'], L, PAY, M(-1500, '부모님 병원비'), ['gift'], ['tax'], ['baby'], PAY, M(2500, '특허 로열티'), L, ['cut'],
    M(-900, '자녀 대학 등록금'), PAY, ['promo'], M(1800, '베스트셀러 출간'), L, ['invest'], PAY, M(-700, '건강 관리'), L, M(1000, '퇴직금')], m2);
  segment('retire', [[55, 612], [55, 612]], [['retire']], gold[gold.length - 1]);
  const STOPS = ['career', 'marry', 'house', 'retire'];
  const FORK_LABEL = { college: '대학 진학', job: '바로 취업', safe: '안정의 길', risk: '모험의 길' };
  const FORK_DESC = { college: '학자금 대출 5,000만 · 졸업하면 고소득 직업', job: '지금 바로 직업을 골라 월급 받기', safe: '월급날 · 적금 · 승진이 많은 길', risk: '투자 · 창업으로 크게 벌거나 크게 잃는 길' };
  const LOAN = 5000;

  const LIFE_CARDS = [['봉사활동 100시간', 2000], ['마라톤 완주', 1500], ['자격증 합격', 1500], ['세계 일주', 3000], ['가족 여행', 1000], ['책 출간', 2500], ['부모님 효도 여행', 2000], ['반려동물 입양', 1000],
    ['동창회 회장', 1000], ['전국 대회 우승', 3000], ['장학 재단 설립', 5000], ['자원봉사 표창', 2500], ['악기 연주회', 1500], ['봉사 단체 설립', 4000], ['환경 운동 참여', 2000], ['은사님 찾아뵙기', 1000]];
  const CAREERS = {
    college: [['의사', 1200], ['변호사', 1100], ['개발자', 1000], ['약사', 950], ['회계사', 950], ['연구원', 900], ['건축가', 900], ['디자이너', 800], ['기자', 800], ['교사', 750]],
    basic: [['공무원', 650], ['유튜버', 650], ['카페 사장', 600], ['요리사', 600], ['자동차 정비사', 600], ['미용사', 550], ['택배 기사', 550], ['배달 라이더', 500], ['헬스 트레이너', 500], ['편의점 점장', 450]],
  };
  const HOUSES = [['신축 빌라', 4000, 5800], ['원룸 오피스텔', 2500, 3600], ['도심 아파트', 8000, 12000], ['전원주택', 6000, 9000], ['한옥', 7000, 10500], ['타운하우스', 9000, 13000], ['바닷가 별장', 11000, 16500], ['펜트하우스', 14000, 21000]];
  const RETIRE_BONUS = [4000, 2000, 1000];
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];

  const cur = s => s.players[s.turn];
  const P = (s, id) => s.players.find(p => p.id === id);
  const won = n => `${Math.round(n).toLocaleString('ko-KR')}만`;

  function setup(players, rnd) {
    const s = {
      rnd, turn: 0, phase: 'spin', spin: 0, decision: null, retired: 0, over: false, log: [], seq: 0, msg: '',
      players: players.map((p, i) => ({ id: p.id, name: p.name, color: COLORS[i % COLORS.length], node: 0, left: 0, fork: null, money: 1000, debt: 0, salary: 0, career: null,
        married: false, kids: 0, house: null, life: [], retired: false, bonus: 0, rank: 0 })),
      lifeDeck: [],
    };
    s.msg = `${cur(s).name} 님부터 룰렛을 돌려요. 첫 갈림길에서 대학과 취업 중 하나를 골라요.`;
    return s;
  }
  function fixDebt(s, p) {           // 돈이 모자라면 자동으로 2,000만씩 대출
    let n = 0;
    while (p.money < 0) { p.money += 2000; p.debt += 2000; n++; }
    if (n) log(s, { t: 'loan', id: p.id, amt: n * 2000 });
  }
  function earn(s, p, amt) { if (!amt) return; p.money += amt; log(s, { t: 'money', id: p.id, amt }); fixDebt(s, p); }
  function transfer(s, from, to, amt) { const a = Math.min(amt, Math.max(0, from.money)); if (a <= 0) return 0; from.money -= a; to.money += a; log(s, { t: 'money', id: from.id, amt: -a }); log(s, { t: 'money', id: to.id, amt: a }); return a; }
  const lifeSum = p => p.life.reduce((a, c) => a + c.v, 0);
  const total = p => p.money + (p.house ? p.house.sell : 0) + lifeSum(p) + p.kids * 1000 + p.bonus - Math.round(p.debt * 1.25);

  /** 남은 칸만큼 이동 (지나가는 월급날도 받음, 멈춤 칸 · 갈림길에서 멈춤) */
  function move(s, p) {
    const path = [];
    while (p.left > 0) {
      const node = NODES[p.node];
      let to = node.next[0];
      if (node.next.length > 1) {
        if (p.fork == null) {
          if (path.length) log(s, { t: 'walk', id: p.id, nodes: path });
          s.phase = 'fork';
          s.decision = { options: node.next.map(n => ({ to: n, seg: NODES[n].seg, label: FORK_LABEL[NODES[n].seg], desc: FORK_DESC[NODES[n].seg] })) };
          s.msg = `${p.name} 님, 갈림길이에요! 남은 ${p.left}칸을 어느 길로 갈까요?`;
          return;
        }
        to = p.fork; p.fork = null;
      }
      p.node = to; p.left--; path.push(to);
      const n = NODES[to];
      if (n.type === 'pay' && p.left > 0 && p.salary) earn(s, p, p.salary);
      if (STOPS.includes(n.type)) p.left = 0;
    }
    if (path.length) log(s, { t: 'walk', id: p.id, nodes: path });
    land(s, p);
  }
  function drawLife(s) {
    if (!s.lifeDeck.length) s.lifeDeck = shuffle(LIFE_CARDS.map(([t, v]) => ({ t, v })), s.rnd);
    return s.lifeDeck.pop();
  }
  function land(s, p) {
    const n = NODES[p.node], others = s.players.filter(q => q !== p && !q.retired);
    s.decision = null;
    switch (n.type) {
      case 'pay':
        if (p.salary) { earn(s, p, p.salary); s.msg = `월급날! ${p.name} 님 +${won(p.salary)}`; } else s.msg = '월급날이지만 아직 직업이 없어요.';
        break;
      case 'money': earn(s, p, n.v); s.msg = `${n.txt} ${n.v > 0 ? '+' : ''}${won(n.v)}`; break;
      case 'life': { const c = drawLife(s); p.life.push(c); log(s, { t: 'life', id: p.id }); s.msg = `보람 카드 「${c.t}」를 얻었어요! (점수는 은퇴 때 공개)`; break; }
      case 'promo':
        if (p.salary) { p.salary = Math.round(p.salary * 1.2 / 10) * 10; log(s, { t: 'salary', id: p.id }); s.msg = `승진! ${p.name} 님 월급이 ${won(p.salary)}으로 올랐어요.`; }
        else { earn(s, p, 500); s.msg = '아르바이트 수당 +500만'; }
        break;
      case 'cut':
        if (p.salary) { p.salary = Math.round(p.salary * 0.85 / 10) * 10; log(s, { t: 'salary', id: p.id }); s.msg = `구조조정… 월급이 ${won(p.salary)}으로 줄었어요.`; }
        else s.msg = '구조조정 칸이지만 직업이 없어서 괜찮아요.';
        break;
      case 'tax':
        if (p.salary) { const t = Math.round(p.salary * 0.8 / 10) * 10; earn(s, p, -t); s.msg = `세금 납부 -${won(t)} (월급의 80%)`; } else s.msg = '아직 소득이 없어 세금이 없어요.';
        break;
      case 'baby': {
        const twins = s.rnd() < 0.15, k = twins ? 2 : 1;
        p.kids += k; log(s, { t: 'baby', id: p.id, k });
        let got = 0; for (const q of others) got += transfer(s, q, p, 300 * k);
        s.msg = `${twins ? '쌍둥이가' : '아기가'} 태어났어요! 축하금 +${won(got)}`;
        break;
      }
      case 'marry': {
        p.married = true; log(s, { t: 'marry', id: p.id });
        const g = s.spin >= 6 ? 1000 : 500;
        let got = 0; for (const q of others) got += transfer(s, q, p, g);
        s.msg = `${p.name} 님 결혼! 룰렛 ${s.spin} → 모두에게 축의금 ${won(g)}씩 (+${won(got)})`;
        break;
      }
      case 'career': {
        const pool = shuffle(CAREERS[n.v], s.rnd).slice(0, 3);
        s.phase = 'career'; s.decision = { kind: n.v, options: pool.map(([name, salary]) => ({ name, salary })) };
        s.msg = n.v === 'college' ? `졸업! ${p.name} 님, 직업 카드를 고르세요.` : `${p.name} 님, 직업 카드를 고르세요.`;
        return;
      }
      case 'house': {
        if (p.house) { p.house.sell += 1500; s.msg = `집값이 올랐어요! ${p.house.name} 시세 +1,500만`; break; }
        const opts = shuffle(HOUSES, s.rnd).slice(0, 2).map(([name, price, sell]) => ({ name, price, sell }));
        s.phase = 'house'; s.decision = { options: opts };
        s.msg = `${p.name} 님, 집을 살 수 있어요. 돈이 모자라면 자동으로 대출돼요.`;
        return;
      }
      case 'gift':
        if (others.length) { s.phase = 'gift'; s.decision = { options: others.map(q => ({ id: q.id, name: q.name, money: q.money })) }; s.msg = `${p.name} 님, 친구 한 명을 골라 축하 선물 1,000만을 받아요!`; return; }
        s.msg = '선물을 줄 친구가 없어요.';
        break;
      case 'invest':
        s.phase = 'invest'; s.decision = { win: 5000, lose: 3000 };
        s.msg = `투자 기회! 룰렛을 돌려 6 이상이면 +5,000만, 5 이하면 -3,000만. 투자할까요?`;
        return;
      case 'retire': {
        p.retired = true; p.rank = ++s.retired; p.bonus = RETIRE_BONUS[p.rank - 1] || 0;
        log(s, { t: 'retire', id: p.id });
        s.msg = `${p.name} 님 ${p.rank}등으로 은퇴!${p.bonus ? ` 은퇴 보너스 +${won(p.bonus)}` : ''}`;
        break;
      }
      default: break;
    }
    endTurn(s);
  }
  function endTurn(s) {
    s.decision = null;
    if (s.players.every(p => p.retired)) { s.over = true; s.phase = 'over'; return; }
    do { s.turn = (s.turn + 1) % s.players.length; } while (cur(s).retired);
    s.phase = 'spin';
  }
  function spinWheel(s, p) { s.spin = 1 + Math.floor(s.rnd() * 10); log(s, { t: 'spin', id: p.id, v: s.spin }); return s.spin; }

  function act(s, id, a) {
    const p = cur(s), d = s.decision;
    if (s.over || p.id !== id) return '지금은 내 차례가 아니에요.';
    switch (s.phase) {
      case 'spin':
        if (a.t === 'repay') {
          const amt = Math.min(p.debt, Math.floor(p.money / 1000) * 1000);
          if (amt < 1000) return p.debt ? '갚을 돈이 모자라요 (1,000만 단위).' : '갚을 대출이 없어요.';
          p.money -= amt; p.debt -= amt; log(s, { t: 'money', id, amt: -amt });
          s.msg = `${p.name} 님이 대출 ${won(amt)}을 갚았어요.`;
          return;
        }
        if (a.t !== 'spin') return '룰렛을 돌려 주세요.';
        p.left = spinWheel(s, p);
        return void move(s, p);
      case 'fork': {
        const o = d.options.find(x => x.to === +a.to);
        if (a.t !== 'fork' || !o) return '갈 길을 골라 주세요.';
        p.fork = o.to; s.phase = 'move';
        log(s, { t: 'fork', id, seg: o.seg });
        if (o.seg === 'college') { p.debt += LOAN; log(s, { t: 'loan', id, amt: LOAN }); }
        return void move(s, p);
      }
      case 'career': {
        const o = d.options[+a.i];
        if (a.t !== 'career' || !o) return '직업 카드를 골라 주세요.';
        p.career = o.name; p.salary = o.salary;
        log(s, { t: 'career', id, name: o.name });
        s.msg = `${p.name} 님은 이제 ${o.name}! 월급 ${won(o.salary)}`;
        return void endTurn(s);
      }
      case 'house': {
        if (a.t === 'skip') { s.msg = `${p.name} 님은 집을 다음에 사기로 했어요.`; return void endTurn(s); }
        const o = d.options[+a.i];
        if (a.t !== 'house' || !o) return '집을 고르거나 건너뛰세요.';
        p.house = { name: o.name, price: o.price, sell: o.sell };
        earn(s, p, -o.price); log(s, { t: 'house', id });
        s.msg = `${p.name} 님이 ${o.name}을(를) 샀어요! 은퇴하면 ${won(o.sell)}에 팔아요.`;
        return void endTurn(s);
      }
      case 'gift': {
        const q = d.options.some(o => o.id === a.id) ? P(s, a.id) : null;
        if (a.t !== 'gift' || !q) return '선물을 받을 친구를 골라 주세요.';
        const g = transfer(s, q, p, 1000);
        s.msg = `${q.name} 님이 ${p.name} 님에게 선물 ${won(g)}!`;
        return void endTurn(s);
      }
      case 'invest': {
        if (a.t === 'skip') { s.msg = `${p.name} 님은 투자하지 않았어요.`; return void endTurn(s); }
        if (a.t !== 'invest') return '투자할지 골라 주세요.';
        const v = spinWheel(s, p);
        earn(s, p, v >= 6 ? d.win : -d.lose);
        s.msg = v >= 6 ? `룰렛 ${v}! 투자 대성공 +${won(d.win)}` : `룰렛 ${v}… 투자 실패 -${won(d.lose)}`;
        return void endTurn(s);
      }
      default: return '잠시만 기다려 주세요.';
    }
  }

  function ai(s, id) {
    const p = P(s, id), d = s.decision;
    switch (s.phase) {
      case 'spin': return p.debt >= 1000 && p.money >= 3000 ? { t: 'repay' } : { t: 'spin' };
      case 'fork': return { t: 'fork', to: d.options[s.rnd() < 0.5 ? 0 : 1].to };
      case 'career': { let b = 0; d.options.forEach((o, i) => { if (o.salary > d.options[b].salary) b = i; }); return { t: 'career', i: b }; }
      case 'house': { let b = -1, best = 0; d.options.forEach((o, i) => { const gain = o.sell - o.price - Math.max(0, o.price - p.money) * 0.25; if (gain > best) { best = gain; b = i; } }); return b < 0 ? { t: 'skip' } : { t: 'house', i: b }; }
      case 'gift': { const q = d.options.map(o => P(s, o.id)).sort((a, b) => b.money - a.money)[0]; return { t: 'gift', id: q.id }; }
      case 'invest': return { t: p.money >= 2000 || s.rnd() < 0.5 ? 'invest' : 'skip' };
      default: return null;
    }
  }

  function view(s, viewer) {
    return {
      players: s.players.map(p => ({
        id: p.id, name: p.name, color: p.color, node: p.node, money: p.money, debt: p.debt, salary: p.salary, career: p.career, married: p.married, kids: p.kids,
        house: p.house ? { name: p.house.name, sell: p.house.sell } : null, lifeN: p.life.length, life: s.over || p.id === viewer ? p.life : null,
        retired: p.retired, rank: p.rank, bonus: p.bonus, total: s.over ? total(p) : null,
      })),
      turnId: cur(s).id, phase: s.phase, spin: s.spin, decision: s.decision, msg: s.msg, log: s.log.slice(-14), seq: s.seq, over: s.over,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => total(b) - total(a));
    return {
      title: `${ranked[0].name} 님의 인생이 가장 풍요로웠어요!`,
      subtitle: '총재산 = 현금 + 집 시세 + 보람 카드 + 자녀(1명당 1,000만) + 은퇴 보너스 - 남은 대출×1.25',
      lines: ranked.map(p => `${p.name}: 현금 ${won(p.money)} · 집 ${p.house ? won(p.house.sell) : '없음'} · 보람 ${p.life.length}장 ${won(lifeSum(p))} · 자녀 ${p.kids}명 · 보너스 ${won(p.bonus)} · 대출 -${won(Math.round(p.debt * 1.25))}`),
      ranking: ranked.map(p => ({ id: p.id, value: won(total(p)) + '원' })),
    };
  }
  return {
    meta: {
      name: '인생 보드게임', min: 2, max: 6, bots: true, turnSec: 40, botDelay: [1300, 1900],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] }],
    },
    W, H, NODES, CAREERS, HOUSES, LIFE_CARDS, FORK_LABEL,
    setup, act, ai, view, result, total,
    pending: s => (s.over ? [] : [cur(s).id]),
  };
});
