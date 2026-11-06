/* =====================================================================
 *  🎓 인생 게임 규칙 — 해즈브로 「The Game of Life」 원작 규칙을 바탕으로 (돈 단위: 만원)
 *   · 룰렛 1~10 · 시작 갈림길: 대학(학자금 대출 → 졸업하면 고소득 전문직) / 바로 취업
 *   · 직업 카드마다 월급 + 특기 (의사는 병원비, 회계사는 세금, 경찰관은 룰렛 10 과속 벌금을 받아요)
 *   · 월급날: 지나가면 월급, 딱 멈추면 월급 + 보너스 50%
 *   · 멈춤 칸: 취업 · 졸업 · 결혼 · 내 집 마련 · 대학원 졸업 · 은퇴
 *   · 결혼 축의금 · 아기 · 반려동물 · 집(보험 · 은퇴 때 룰렛으로 매각) · 주식(그 숫자가 나올 때마다 배당)
 *   · 보람 카드(LIFE 타일): 값은 끝날 때 공개 · 카드가 떨어지면 남의 카드를 가져와요
 *   · 은퇴: 🏰 억만장자 저택(가장 부자면 보람 카드 4장) / 🌾 전원 마을(보람 카드 1장 · 카드 지킴)
 *   · 끝: 현금 + 보람 카드 + 가족(배우자 · 자녀 · 반려동물 1명당 1,000만)이 가장 많은 사람이 승리
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.LifeCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const W = 1100, H = 724;                 // 가로 판 크기 (세로 화면은 x↔y 를 바꿔 그려요)

  /* ── 판 만들기: 꺾은선 위에 칸을 고르게 놓아요 ── */
  function lay(points, n) {
    if (n === 1 || points.length === 1) return [points[0].slice()].concat(Array.from({ length: n - 1 }, () => points[0].slice()));
    const seg = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); seg.push(d); total += d; }
    return Array.from({ length: n }, (_, k) => {
      let t = (k / (n - 1)) * total, i = 0;
      while (i < seg.length - 1 && t > seg[i]) { t -= seg[i]; i++; }
      const r = seg[i] ? t / seg[i] : 0;
      return [Math.round(points[i][0] + (points[i + 1][0] - points[i][0]) * r), Math.round(points[i][1] + (points[i + 1][1] - points[i][1]) * r)];
    });
  }
  const NODES = [], SEG_END = {};
  function segment(seg, points, list, prev) {
    const pos = lay(points, list.length), ids = [];
    list.forEach((t, k) => {
      const id = NODES.length;
      NODES.push({ id, seg, type: t[0], v: t[1] == null ? null : t[1], txt: t[2] || '', tag: t[3] || '', x: pos[k][0], y: pos[k][1], next: [] });
      if (k === 0 && prev != null) [].concat(prev).forEach(p => NODES[SEG_END[p]].next.push(id));
      if (k > 0) NODES[id - 1].next.push(id);
      ids.push(id);
    });
    SEG_END[seg] = ids[ids.length - 1];
    return ids;
  }
  const M = (v, txt, tag) => ['money', v, txt, tag], K = (v, txt, tag) => ['kids', v, txt, tag], L = ['life'], PAY = ['pay'];
  segment('start', [[50, 88]], [['start']]);
  segment('college', [[118, 50], [650, 50]], [
    M(-500, '전공 서적 · 노트북', 'teacher'), L, M(600, '성적 장학금'), M(-800, '자취방 보증금'), ['lucky'],
    M(400, '과외 아르바이트'), L, M(-300, '동아리 회식', 'chef'), M(1000, '공모전 대상'), ['career', 'college']], 'start');
  segment('job', [[118, 126], [650, 126]], [['career', 'basic'], PAY, M(-600, '첫 출근 정장 구입'), L, M(500, '신입 우수사원 상')], 'start');
  segment('youth', [[720, 88], [1025, 88], [1050, 113], [1050, 208], [1025, 233], [700, 233]], [
    PAY, M(-700, '첫 차 할부금'), ['pet'], M(-400, '친구들과 회식', 'chef'), ['marry'], M(-1200, '신혼여행'), PAY,
    ['stock'], M(-800, '접촉 사고 수리비', 'mechanic'), L, ['change'], ['sue'], PAY, M(800, '사내 체육대회 우승', 'athlete')], ['college', 'job']);
  segment('family', [[630, 195], [120, 195]], [
    ['baby', 1, '첫아이 탄생'], M(-500, '아이 돌잔치', 'chef'), L, PAY, ['baby', 2, '쌍둥이 탄생'], K(-300, '아이 학원비', 'teacher'),
    ['baby', 1, '입양으로 가족이 늘었어요'], L], 'youth');
  segment('grad', [[630, 271], [120, 271]], [
    M(-300, '논문 자료 구입', 'teacher'), L, PAY, M(800, '연구 장학금'), ['lucky'], L, ['career', 'grad']], 'youth');
  segment('adult', [[50, 233], [50, 378], [1050, 378]], [
    PAY, ['house'], M(-1500, '이사 비용'), ['baby', 1, '아기 탄생'], ['promo'], ['tax'], ['disaster', 25, '태풍 피해'], PAY,
    ['stock'], M(-1000, '건강검진 · 치료비', 'doctor'), L, ['sue'], K(-500, '자녀 학원비', 'teacher'), ['pet'], M(1000, '마라톤 완주 상금', 'athlete'), PAY], ['family', 'grad']);
  segment('safe', [[985, 485], [420, 485]], [PAY, M(1500, '적금 만기'), L, ['promo'], M(-600, '자동차 정기 점검', 'mechanic'), PAY, L, M(1000, '배당금')], 'adult');
  segment('risk', [[985, 561], [420, 561]], [['boom'], M(-3000, '창업 실패'), ['lucky'], M(12000, '스타트업 대박'), ['cut'], PAY, ['crash'], M(6000, '회사 매각')], 'adult');
  segment('golden', [[350, 523], [50, 523], [50, 668], [950, 668]], [
    PAY, ['house2'], L, K(-1000, '자녀 대학 등록금', 'teacher'), ['sue'], PAY, M(3000, '베스트셀러 출간'), ['disaster', 30, '지진 피해'],
    ['lucky'], M(-1500, '부모님 병원비', 'doctor'), L, PAY, K(500, '손주 탄생 축하금'), M(-800, '자동차 교체 수리', 'mechanic'),
    M(2000, '특허 로열티'), L, ['tax'], M(1500, '퇴직금')], ['safe', 'risk']);
  segment('retire', [[1040, 668]], [['retire']], 'golden');

  const STOPS = ['career', 'marry', 'house', 'retire'];
  const FORK = {
    college: { label: '대학 진학', desc: '학자금 대출 4,000만 · 졸업하면 월급 높은 전문직 (3장 중 고르기)' },
    job: { label: '바로 취업', desc: '지금 바로 직업을 골라 월급 받기 (길도 짧아요)' },
    family: { label: '가족의 길', desc: '아기 · 돌잔치 · 가족 여행 — 가족이 늘어요' },
    grad: { label: '야간 대학원', desc: '등록금 3,000만 → 졸업하면 전문직으로 바꿀 수 있어요' },
    safe: { label: '안정의 길', desc: '월급날 · 적금 · 승진이 많은 길' },
    risk: { label: '모험의 길', desc: '창업 · 주식으로 크게 벌거나 크게 잃는 길' },
  };
  const LOAN = 2000, INTEREST = 1.25, TUITION = 4000, GRAD_FEE = 3000, STOCK_PRICE = 5000, STOCK_PAY = 1000, FAMILY = 1000;
  const CAREERS = {
    doctor: { name: '의사', deg: true, sal: 1100, icon: '🩺', skill: '누가 병원비를 내면 내가 받아요' },
    lawyer: { name: '변호사', deg: true, sal: 1100, icon: '⚖️', skill: '누가 소송을 걸면 수임료 300만 · 나는 소송을 안 당해요' },
    accountant: { name: '회계사', deg: true, sal: 1150, icon: '🧮', skill: '누가 세금을 내면 내가 받아요' },
    architect: { name: '건축가', deg: true, sal: 1000, icon: '📐', skill: '누가 집을 사면 설계비 10%를 받아요' },
    vet: { name: '수의사', deg: true, sal: 900, icon: '🐾', skill: '누가 반려동물을 들이면 진료비를 받아요' },
    teacher: { name: '교사', deg: true, sal: 850, icon: '📚', skill: '누가 학원비 · 교육비를 내면 내가 받아요' },
    police: { name: '경찰관', deg: false, sal: 650, icon: '🚓', skill: '누가 룰렛 10을 돌리면 과속 벌금 300만을 받아요' },
    athlete: { name: '운동선수', deg: false, sal: 750, icon: '🏆', skill: '운동 · 대회 상금을 2배로 받아요' },
    chef: { name: '요리사', deg: false, sal: 750, icon: '🍳', skill: '누가 회식 · 잔치 비용을 내면 내가 받아요' },
    mechanic: { name: '정비사', deg: false, sal: 700, icon: '🔧', skill: '누가 자동차 수리비를 내면 내가 받아요' },
    stylist: { name: '미용사', deg: false, sal: 600, icon: '💇', skill: '누가 결혼하면 웨딩 꾸밈비 300만을 받아요' },
    youtuber: { name: '유튜버', deg: false, sal: 0, icon: '🎬', skill: '월급날마다 룰렛 × 150만 (150~1,500만)' },
  };
  const YT = 150;                          // 유튜버: 월급날마다 룰렛 × 150만
  const HOUSES = [
    ['원룸 오피스텔', 3000, 2500, 4500], ['신축 빌라', 5000, 4000, 7500], ['한옥', 7000, 5000, 11000], ['전원주택', 8000, 6500, 12000],
    ['도심 아파트', 10000, 9000, 16000], ['타운하우스', 12000, 9500, 18000], ['바닷가 별장', 14000, 10000, 22000], ['펜트하우스', 18000, 14000, 28000],
  ];
  const LIFE_CARDS = [['봉사활동 100시간', 1000], ['반려견 구조', 1000], ['은사님 찾아뵙기', 1000], ['동창회 회장', 1000], ['헌혈 50회', 1000], ['나무 1,000그루 심기', 1000],
    ['마라톤 완주', 2000], ['자격증 합격', 2000], ['가족 여행', 2000], ['악기 연주회', 2000], ['부모님 효도 여행', 2000], ['요리 대회 입상', 2000], ['동네 도서관 기부', 2000], ['외국어 3개 정복', 2000],
    ['세계 일주', 3000], ['책 출간', 3000], ['전국 대회 우승', 3000], ['자원봉사 표창', 3000], ['환경 운동 참여', 3000], ['다큐멘터리 출연', 3000], ['무료 급식소 운영', 3000], ['꿈의 집 직접 짓기', 3000],
    ['장학 재단 설립', 4000], ['봉사 단체 설립', 4000], ['발명 특허', 4000], ['올림픽 성화 봉송', 4000], ['오지 학교 세우기', 4000], ['국가 대표 출전', 4000],
    ['노벨 평화상 후보', 5000], ['신약 개발 참여', 5000], ['우주 여행', 5000], ['유네스코 표창', 5000]];
  const RETIRE_BONUS = [3000, 2000, 1000, 500];
  const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];

  const cur = s => s.players[s.turn];
  const P = (s, id) => s.players.find(p => p.id === id);
  const won = n => `${Math.round(n).toLocaleString('ko-KR')}만`;
  const holder = (s, key) => (key ? s.players.find(p => p.career === key) : null);
  const salaryOf = p => (p.career === 'youtuber' ? 825 : p.salary);

  function setup(players, rnd) {
    const deck = shuffle(LIFE_CARDS.map(([t, v]) => ({ t, v })), rnd);
    const s = {
      rnd, turn: 0, phase: 'spin', spin: 0, decision: null, retired: 0, over: false, log: [], seq: 0, msg: '',
      players: players.map((p, i) => ({
        id: p.id, name: p.name, color: COLORS[i % COLORS.length], node: 0, left: 0, fork: null, money: 1000, debt: 0, salary: 0, career: null, degree: false,
        married: false, kids: 0, pets: 0, houses: [], stock: 0, life: [], retired: false, estate: null, rank: 0, bonus: 0, sold: 0, safe: false, paid: 0,
      })),
      deck: deck.slice(4), reserve: deck.slice(0, 4),
    };
    s.msg = `${cur(s).name} 님부터 룰렛을 돌려요. 첫 갈림길에서 대학과 취업 중 하나를 골라요.`;
    return s;
  }
  /** 돈이 모자라면 자동으로 2,000만씩 대출 (갚을 때 2,500만) */
  function fixDebt(s, p) {
    let n = 0;
    while (p.money < 0) { p.money += LOAN; p.debt += LOAN; n++; }
    if (n) log(s, { t: 'loan', id: p.id, amt: n * LOAN });
  }
  function earn(s, p, amt, why) { if (!amt) return; p.money += amt; log(s, { t: 'money', id: p.id, amt, why }); fixDebt(s, p); }
  /** from 이 to 에게 amt (모자라면 대출해서라도 내요) */
  function pay(s, from, to, amt, why) {
    if (!amt || from === to) return 0;
    earn(s, from, -amt, why);
    if (to) earn(s, to, amt, why);
    return amt;
  }
  /** 축하금처럼 있는 만큼만 주는 돈 */
  function gift(s, from, to, amt) { const a = Math.min(amt, Math.max(0, from.money)); if (a <= 0) return 0; from.money -= a; to.money += a; log(s, { t: 'money', id: from.id, amt: -a }); log(s, { t: 'money', id: to.id, amt: a }); return a; }
  /** 직업 특기로 받는 돈: 낼 사람 p 가 그 직업이면 공짜 · 아니면 그 직업인 사람에게 */
  function payTagged(s, p, amt, tag, why) {
    const h = holder(s, tag);
    if (h === p) return `${CAREERS[tag].name}인 내 일이라 공짜!`;
    pay(s, p, h || null, amt, why);
    return h ? ` → ${CAREERS[tag].icon} ${h.name} 님에게` : '';
  }
  const lifeSum = p => p.life.reduce((a, c) => a + c.v, 0);
  const family = p => (p.married ? 1 : 0) + p.kids + p.pets;
  const houseValue = p => p.houses.reduce((a, h) => a + Math.round((h.lo + h.hi) / 2), 0);
  /** 끝났을 때 점수 (은퇴 전이면 집 · 대출을 어림해서) */
  const total = p => p.money + lifeSum(p) + family(p) * FAMILY + (p.retired ? 0 : houseValue(p) - Math.round(p.debt * INTEREST));

  function spinWheel(s, p, why) {
    s.spin = 1 + Math.floor(s.rnd() * 10);
    log(s, { t: 'spin', id: p.id, v: s.spin, why: why || 'move' });
    return s.spin;
  }
  /** 이동 룰렛이 나오면: 그 숫자 주식 배당 · 10이면 과속 벌금 */
  function spinEffects(s, p, v) {
    let out = '';
    const owner = s.players.find(q => q.stock === v);
    if (owner) { earn(s, owner, STOCK_PAY, 'stock'); log(s, { t: 'dividend', id: owner.id, v }); out += `📈 ${owner.name} 님 주식 ${v}번 배당 +${won(STOCK_PAY)}. `; }
    const cop = holder(s, 'police');
    if (v === 10 && cop && cop !== p) { pay(s, p, cop, 300, 'police'); log(s, { t: 'police', id: p.id, to: cop.id }); out += `🚨 과속 단속! ${cop.name} 님에게 벌금 300만. `; }
    return out;
  }
  function drawLife(s, p) {
    let c = s.deck.pop();
    if (!c) {                                      // 카드가 떨어지면: 카드가 가장 많은 사람(전원 마을 제외)에게서 한 장
      const victims = s.players.filter(q => q !== p && q.life.length && !q.safe).sort((a, b) => b.life.length - a.life.length || b.money - a.money);
      if (!victims.length) return null;
      const q = victims[0];
      c = q.life.splice(Math.floor(s.rnd() * q.life.length), 1)[0];
      log(s, { t: 'steal', id: p.id, from: q.id });
      p.life.push(c);
      return { c, from: q };
    }
    p.life.push(c); log(s, { t: 'life', id: p.id });
    return { c };
  }
  const lifeMsg = (r, p) => (!r ? '보람 카드가 다 떨어졌어요.' : r.from ? `보람 카드가 떨어져서 ${r.from.name} 님의 「${r.c.t}」 카드를 가져왔어요!` : `보람 카드 「${r.c.t}」를 얻었어요! (값은 끝날 때 공개)`);

  /** 월급 받기 (land: 딱 멈추면 보너스 50%) */
  function payday(s, p, land) {
    if (!p.career) return land ? '월급날이지만 아직 직업이 없어요.' : '';
    let base = p.salary, extra = '';
    if (p.career === 'youtuber') { const v = spinWheel(s, p, 'youtube'); base = v * YT; extra = ` (조회수 룰렛 ${v})`; }
    const amt = land ? Math.round(base * 1.5 / 10) * 10 : base;
    earn(s, p, amt, 'pay');
    return land ? `월급날 딱 멈춤! 월급 + 보너스 ${won(amt)}${extra}` : '';
  }

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
          s.decision = { kind: 'fork', options: node.next.map(n => ({ to: n, seg: NODES[n].seg, label: FORK[NODES[n].seg].label, desc: FORK[NODES[n].seg].desc })) };
          s.msg = `${p.name} 님, 갈림길이에요! 남은 ${p.left}칸을 어느 길로 갈까요?`;
          return;
        }
        to = p.fork; p.fork = null;
      }
      p.node = to; p.left--; path.push(to);
      const n = NODES[to];
      if (n.type === 'pay' && p.left > 0) { log(s, { t: 'walk', id: p.id, nodes: path.splice(0) }); payday(s, p, false); }
      if (STOPS.includes(n.type)) p.left = 0;
    }
    if (path.length) log(s, { t: 'walk', id: p.id, nodes: path });
    land(s, p);
  }
  const careerOpts = (s, p, deg, n) => {
    const taken = new Set(s.players.filter(q => q !== p && q.career).map(q => q.career));
    const pool = Object.keys(CAREERS).filter(k => !taken.has(k) && k !== p.career && (deg ? CAREERS[k].deg : !CAREERS[k].deg));
    return shuffle(pool, s.rnd).slice(0, n).map(k => ({ key: k, name: CAREERS[k].name, sal: CAREERS[k].sal, icon: CAREERS[k].icon, skill: CAREERS[k].skill }));
  };
  const houseOpts = (s, p, n) => {
    const own = new Set(p.houses.map(h => h.name));
    return shuffle(HOUSES.filter(h => !own.has(h[0])), s.rnd).slice(0, n).map(([name, price, lo, hi]) => ({ name, price, lo, hi, ins: Math.round(price / 10) }));
  };
  function land(s, p) {
    const n = NODES[p.node], others = s.players.filter(q => q !== p);
    s.decision = null;
    let msg = '';
    const decide = (phase, decision, m) => { s.phase = phase; s.decision = decision; s.msg = msg + m; };
    switch (n.type) {
      case 'pay': msg += payday(s, p, true); break;
      case 'money': {
        let amt = n.v, extra = '';
        if (n.tag === 'athlete' && amt > 0 && p.career === 'athlete') { amt *= 2; extra = ' (운동선수 2배!)'; }
        if (amt < 0 && n.tag) { const r = payTagged(s, p, -amt, n.tag, n.txt); msg += `${n.txt} -${won(-amt)}${r}`; break; }
        earn(s, p, amt, n.txt);
        msg += `${n.txt} ${amt > 0 ? '+' : ''}${won(amt)}${extra}`;
        break;
      }
      case 'kids': {
        if (!p.kids) { msg += n.v < 0 ? `${n.txt} — 아이가 없어서 괜찮아요.` : `${n.txt} — 아직 아이가 없어요.`; break; }
        const amt = n.v * p.kids;
        if (amt < 0 && n.tag) { const r = payTagged(s, p, -amt, n.tag, n.txt); msg += `${n.txt} (자녀 ${p.kids}명) -${won(-amt)}${r}`; break; }
        earn(s, p, amt, n.txt);
        msg += `${n.txt} (자녀 ${p.kids}명) ${amt > 0 ? '+' : ''}${won(amt)}`;
        break;
      }
      case 'life': msg += lifeMsg(drawLife(s, p), p); break;
      case 'promo':
        if (p.career === 'youtuber') { earn(s, p, 1000, 'promo'); msg += '구독자 100만 달성! 실버 버튼 +1,000만'; }
        else if (p.salary) { p.salary = Math.round(p.salary * 1.15 / 10) * 10; log(s, { t: 'salary', id: p.id }); msg += `승진! 월급이 ${won(p.salary)}으로 올랐어요.`; }
        else { earn(s, p, 500); msg += '아르바이트 수당 +500만'; }
        break;
      case 'cut':
        if (p.career === 'youtuber') { earn(s, p, -800, 'cut'); msg += '채널 정지… 수익 -800만'; }
        else if (p.salary) { p.salary = Math.round(p.salary * 0.85 / 10) * 10; log(s, { t: 'salary', id: p.id }); msg += `구조조정… 월급이 ${won(p.salary)}으로 줄었어요.`; }
        else msg += '구조조정 칸이지만 직업이 없어서 괜찮아요.';
        break;
      case 'tax': {
        if (!p.career) { msg += '아직 소득이 없어 세금이 없어요.'; break; }
        const t = Math.round(salaryOf(p) * 0.5 / 10) * 10;
        const r = payTagged(s, p, t, 'accountant', '세금');
        msg += `세금 납부 -${won(t)} (월급의 절반)${r}`;
        break;
      }
      case 'baby': {
        const k = n.v || 1;
        p.kids += k; log(s, { t: 'baby', id: p.id, k });
        let got = 0; for (const q of others) got += gift(s, q, p, 300 * k);
        msg += `${n.txt}! ${k === 2 ? '쌍둥이 ' : ''}축하금 +${won(got)}`;
        break;
      }
      case 'pet': {
        p.pets++; log(s, { t: 'pet', id: p.id });
        const r = payTagged(s, p, 300, 'vet', '반려동물 진료비');
        msg += `반려동물을 가족으로 맞았어요! 진료비 -300만${r}`;
        break;
      }
      case 'disaster': {
        const bad = p.houses.filter(h => !h.insured);
        if (!p.houses.length) { msg += `${n.txt} — 집이 없어서 피해가 없어요.`; break; }
        if (!bad.length) { msg += `${n.txt} — 주택 보험 덕분에 수리비 0원!`; break; }
        const cost = bad.reduce((a, h) => a + Math.round(h.price * n.v / 100 / 10) * 10, 0);
        earn(s, p, -cost, n.txt);
        msg += `${n.txt}! 보험 없는 집 수리비 -${won(cost)}`;
        break;
      }
      case 'marry': {
        p.married = true; log(s, { t: 'marry', id: p.id });
        const g = s.moveSpin >= 6 ? 1000 : 500;
        let got = 0; for (const q of others) got += gift(s, q, p, g);
        const sty = holder(s, 'stylist');
        let extra = '';
        if (sty && sty !== p) { pay(s, p, sty, 300, 'stylist'); extra = ` · 💇 ${sty.name} 님에게 꾸밈비 300만`; }
        const r = drawLife(s, p);
        msg += `💍 ${p.name} 님 결혼! 룰렛 ${s.moveSpin} → 축의금 ${won(g)}씩 (+${won(got)})${extra} · ${r ? `보람 카드 「${r.c.t}」` : ''}`;
        break;
      }
      case 'career': {
        const deg = n.v !== 'basic';
        if (n.v === 'college') p.degree = true;
        if (n.v === 'grad') p.degree = true;
        const opts = careerOpts(s, p, deg, deg ? 3 : 2);
        if (!opts.length) { msg += '고를 수 있는 직업 카드가 없어요.'; break; }
        return decide('career', { kind: n.v, options: opts, keep: n.v === 'grad' && !!p.career },
          n.v === 'college' ? `🎓 졸업 축하해요! ${p.name} 님, 직업 카드를 고르세요.` : n.v === 'grad' ? `🎓 대학원 졸업! 전문직으로 바꿀까요?` : `💼 ${p.name} 님, 첫 직장을 고르세요.`);
      }
      case 'change': {
        const opts = careerOpts(s, p, p.degree, 2);
        if (!opts.length) { msg += '지금은 옮길 자리가 없어요.'; break; }
        return decide('career', { kind: 'change', options: opts, keep: true }, `💼 이직 기회! ${p.name} 님, 다른 회사로 옮길까요?`);
      }
      case 'house': case 'house2': {
        const opts = houseOpts(s, p, n.type === 'house' ? 3 : 2);
        if (!opts.length) { msg += '살 수 있는 집이 없어요.'; break; }
        return decide('house', { kind: n.type, options: opts, money: p.money, arch: (holder(s, 'architect') || {}).name || null },
          n.type === 'house' ? `🏠 내 집 마련! ${p.name} 님, 집을 살까요? (모자라면 자동 대출)` : `🏖️ 별장 · 이사 기회! 집을 하나 더 살까요?`);
      }
      case 'stock': {
        if (p.stock) { msg += `📈 주식은 한 종목만 가질 수 있어요. (지금 ${p.stock}번)`; break; }
        const taken = s.players.filter(q => q.stock).map(q => q.stock);
        return decide('stock', { kind: 'stock', price: STOCK_PRICE, pay: STOCK_PAY, taken },
          `📈 주식 투자! 숫자 하나를 ${won(STOCK_PRICE)}에 사면, 누가 그 숫자를 돌릴 때마다 ${won(STOCK_PAY)}씩 받아요.`);
      }
      case 'boom': {
        if (p.stock) { earn(s, p, 2000, 'boom'); msg += `📈 주가 폭등! 주식 ${p.stock}번 특별 배당 +2,000만`; break; }
        const free = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(v => !s.players.some(q => q.stock === v));
        if (!free.length) { earn(s, p, 1000, 'boom'); msg += '📈 주가 폭등! 보너스 +1,000만'; break; }
        p.stock = free[Math.floor(s.rnd() * free.length)]; log(s, { t: 'stock', id: p.id, v: p.stock });
        msg += `📈 주가 폭등! 공짜 주식 ${p.stock}번을 받았어요.`;
        break;
      }
      case 'crash':
        if (p.stock) { const v = p.stock; p.stock = 0; log(s, { t: 'stock', id: p.id, v: 0 }); msg += `📉 주가 폭락… 주식 ${v}번이 휴지 조각이 됐어요.`; }
        else msg += '📉 주가 폭락! 주식이 없어서 다행이에요.';
        break;
      case 'lucky':
        return decide('lucky', { kind: 'lucky', win: 5000, lose: 500 }, `🎰 행운의 룰렛! 숫자 하나를 골라 맞히면 +5,000만, 틀리면 -500만. 도전할까요?`);
      case 'sue': {
        const lawyer = holder(s, 'lawyer');
        const targets = others.filter(q => q.career !== 'lawyer');
        if (!targets.length) { msg += '⚖️ 소송할 상대가 없어요.'; break; }
        return decide('sue', { kind: 'sue', amt: 1500, fee: lawyer && lawyer !== p ? 300 : 0, lawyer: lawyer ? lawyer.name : null, options: targets.map(q => ({ id: q.id, name: q.name, money: q.money })) },
          `⚖️ 소송! 한 명을 골라 1,500만을 받아요.${lawyer && lawyer !== p ? ` (변호사 ${lawyer.name} 님 수임료 300만)` : ''}`);
      }
      case 'retire':
        return decide('retire', { kind: 'retire', reserve: s.reserve.length, rich: s.players.filter(q => q.estate === 'rich').map(q => q.name) },
          `🏁 ${p.name} 님 은퇴! 어디서 노후를 보낼까요?`);
      default: break;
    }
    s.msg = msg || s.msg;
    endTurn(s);
  }
  /** 은퇴 처리: 집 팔기(룰렛) · 대출 갚기 · 은퇴 순서 보너스 · 전원 마을 보람 카드 */
  function retire(s, p, estate) {
    p.estate = estate; p.retired = true; p.rank = ++s.retired;
    const parts = [];
    for (const h of p.houses) {
      const v = spinWheel(s, p, 'sell');
      const price = v >= 6 ? h.hi : h.lo;
      p.sold += price; earn(s, p, price, 'sell');
      log(s, { t: 'sell', id: p.id, name: h.name, v, price });
      parts.push(`${h.name} ${won(price)}(룰렛 ${v})`);
    }
    p.houses = [];
    if (p.debt) { const r = Math.round(p.debt * INTEREST); p.paid = r; p.money -= r; log(s, { t: 'money', id: p.id, amt: -r, why: 'repay' }); parts.push(`대출 상환 -${won(r)}`); p.debt = 0; }
    p.bonus = RETIRE_BONUS[p.rank - 1] || 0;
    if (p.bonus) { earn(s, p, p.bonus, 'bonus'); parts.push(`${p.rank}등 은퇴 보너스 +${won(p.bonus)}`); }
    if (estate === 'farm') { p.safe = true; const r = drawLife(s, p); if (r) parts.push(`보람 카드 「${r.c.t}」`); }
    log(s, { t: 'retire', id: p.id, estate });
    s.msg = `${p.name} 님 ${estate === 'rich' ? '🏰 억만장자 저택' : '🌾 전원 마을'}로 은퇴! ${parts.join(' · ')}`;
  }
  /** 모두 은퇴: 억만장자 저택에서 가장 부자인 사람에게 남겨 둔 보람 카드 4장 */
  function finale(s) {
    const rich = s.players.filter(p => p.estate === 'rich');
    if (rich.length && s.reserve.length) {
      const top = Math.max(...rich.map(p => p.money));
      const winners = rich.filter(p => p.money === top);
      let i = 0;
      const each = Math.floor(s.reserve.length / winners.length);
      for (const w of winners) for (let k = 0; k < each; k++) w.life.push(s.reserve[i++]);
      s.richWin = winners.map(w => w.id);
      s.reserve = [];
      log(s, { t: 'reserve', ids: s.richWin });
    }
    s.over = true; s.phase = 'over';
  }
  function endTurn(s) {
    s.decision = null;
    if (s.players.every(p => p.retired)) return finale(s);
    do { s.turn = (s.turn + 1) % s.players.length; } while (cur(s).retired);
    s.phase = 'spin';
  }

  function act(s, id, a) {
    const p = cur(s), d = s.decision;
    if (s.over || p.id !== id) return '지금은 내 차례가 아니에요.';
    switch (s.phase) {
      case 'spin': {
        if (a.t === 'repay') {
          const units = Math.min(p.debt / LOAN, Math.floor(p.money / (LOAN * INTEREST)));
          if (units < 1) return p.debt ? `갚을 돈이 모자라요 (2,000만 갚는 데 ${won(LOAN * INTEREST)}).` : '갚을 대출이 없어요.';
          const cost = units * LOAN * INTEREST;
          p.money -= cost; p.debt -= units * LOAN; log(s, { t: 'money', id, amt: -cost, why: 'repay' });
          s.msg = `${p.name} 님이 대출 ${won(units * LOAN)}을 갚았어요 (이자 포함 ${won(cost)}).`;
          return;
        }
        if (a.t !== 'spin') return '룰렛을 돌려 주세요.';
        const v = spinWheel(s, p);
        s.moveSpin = v;
        const pre = spinEffects(s, p, v);
        p.left = v;
        move(s, p);
        if (pre && s.msg) s.msg = pre + s.msg;
        return;
      }
      case 'fork': {
        const o = d.options.find(x => x.to === +a.to);
        if (a.t !== 'fork' || !o) return '갈 길을 골라 주세요.';
        p.fork = o.to; s.phase = 'move';
        log(s, { t: 'fork', id, seg: o.seg });
        if (o.seg === 'college') { p.debt += TUITION; log(s, { t: 'loan', id, amt: TUITION }); }
        if (o.seg === 'grad') earn(s, p, -GRAD_FEE, 'tuition');
        return void move(s, p);
      }
      case 'career': {
        if (a.t === 'keep' && d.keep) { s.msg = `${p.name} 님은 지금 직업(${CAREERS[p.career].name})을 그대로 해요.`; return void endTurn(s); }
        const o = d.options[+a.i];
        if (a.t !== 'career' || !o) return '직업 카드를 골라 주세요.';
        const before = p.career;
        p.career = o.key; p.salary = o.sal;
        log(s, { t: 'career', id, key: o.key });
        s.msg = `${p.name} 님은 이제 ${o.icon} ${o.name}!${o.sal ? ` 월급 ${won(o.sal)}` : ' 월급은 룰렛으로'}${before ? ` (전 직업: ${CAREERS[before].name})` : ''}`;
        return void endTurn(s);
      }
      case 'house': {
        if (a.t === 'skip') { s.msg = `${p.name} 님은 집을 사지 않았어요.`; return void endTurn(s); }
        const o = d.options[+a.i];
        if (a.t !== 'house' || !o) return '집을 고르거나 건너뛰세요.';
        const ins = !!a.ins;
        p.houses.push({ name: o.name, price: o.price, lo: o.lo, hi: o.hi, insured: ins });
        earn(s, p, -o.price, 'house');
        let extra = '';
        if (ins) { earn(s, p, -o.ins, 'insure'); extra += ` · 주택 보험 -${won(o.ins)}`; }
        const arch = holder(s, 'architect');
        if (arch && arch !== p) { const fee = Math.round(o.price / 10); pay(s, p, arch, fee, 'architect'); extra += ` · 📐 ${arch.name} 님 설계비 ${won(fee)}`; }
        log(s, { t: 'house', id, name: o.name });
        s.msg = `🏠 ${p.name} 님이 ${o.name}을(를) ${won(o.price)}에 샀어요!${extra}`;
        return void endTurn(s);
      }
      case 'stock': {
        if (a.t === 'skip') { s.msg = `${p.name} 님은 주식을 사지 않았어요.`; return void endTurn(s); }
        const v = Math.floor(+a.v);
        if (a.t !== 'stock' || !(v >= 1 && v <= 10)) return '숫자를 골라 주세요.';
        if (s.players.some(q => q.stock === v)) return '다른 사람이 가진 숫자예요.';
        p.stock = v; earn(s, p, -STOCK_PRICE, 'stock'); log(s, { t: 'stock', id, v });
        s.msg = `📈 ${p.name} 님이 주식 ${v}번을 샀어요! 누가 ${v}을(를) 돌릴 때마다 +${won(STOCK_PAY)}`;
        return void endTurn(s);
      }
      case 'lucky': {
        if (a.t === 'skip') { s.msg = `${p.name} 님은 행운의 룰렛을 건너뛰었어요.`; return void endTurn(s); }
        const pick = Math.floor(+a.v);
        if (a.t !== 'lucky' || !(pick >= 1 && pick <= 10)) return '숫자를 골라 주세요.';
        const v = spinWheel(s, p, 'lucky');
        log(s, { t: 'lucky', id, pick, v });
        if (v === pick) { earn(s, p, d.win, 'lucky'); s.msg = `🎰 ${pick}번 → 룰렛 ${v}! 대박 +${won(d.win)}`; }
        else { earn(s, p, -d.lose, 'lucky'); s.msg = `🎰 ${pick}번 → 룰렛 ${v}… 아쉽게 -${won(d.lose)}`; }
        return void endTurn(s);
      }
      case 'sue': {
        const q = d.options.some(o => o.id === a.id) ? P(s, a.id) : null;
        if (a.t !== 'sue' || !q) return '소송할 사람을 골라 주세요.';
        pay(s, q, p, d.amt, 'sue');
        const lawyer = holder(s, 'lawyer');
        let extra = '';
        if (lawyer && lawyer !== p) { pay(s, p, lawyer, d.fee || 300, 'lawyer'); extra = ` · ⚖️ ${lawyer.name} 님 수임료 ${won(d.fee || 300)}`; }
        log(s, { t: 'sue', id, to: q.id });
        s.msg = `⚖️ ${p.name} 님이 ${q.name} 님에게 소송에서 이겨 +${won(d.amt)}!${extra}`;
        return void endTurn(s);
      }
      case 'retire': {
        if (a.t !== 'retire' || !['rich', 'farm'].includes(a.v)) return '은퇴할 곳을 골라 주세요.';
        retire(s, p, a.v);
        return void endTurn(s);
      }
      default: return '잠시만 기다려 주세요.';
    }
  }

  /* ── 봇 ── */
  function ai(s, id) {
    const p = P(s, id), d = s.decision, r = s.rnd;
    const others = s.players.filter(q => q !== p);
    const richest = Math.max(0, ...others.map(q => q.money + houseValue(q) - q.debt));
    switch (s.phase) {
      case 'spin': return { t: 'spin' };          // 대출 이자는 언제 갚아도 25%라서 봇은 은퇴할 때 한꺼번에 갚아요
      case 'fork': {
        const by = seg => d.options.find(o => o.seg === seg);
        if (by('college')) return { t: 'fork', to: (r() < 0.55 ? by('college') : by('job')).to };
        if (by('grad')) return { t: 'fork', to: (!p.degree && r() < 0.6 ? by('grad') : by('family')).to };
        const behind = p.money + houseValue(p) - p.debt < richest;
        return { t: 'fork', to: ((behind ? r() < 0.6 : r() < 0.3) ? by('risk') : by('safe')).to };
      }
      case 'career': {
        const val = o => (o.key === 'youtuber' ? 825 : o.sal);
        let b = 0; d.options.forEach((o, i) => { if (val(o) > val(d.options[b])) b = i; });
        if (d.keep && p.career && salaryOf(p) >= val(d.options[b]) - 50) return { t: 'keep' };
        return { t: 'career', i: b };
      }
      case 'house': {
        let b = -1, best = d.kind === 'house2' ? 1500 : 0;
        d.options.forEach((o, i) => {
          const loan = Math.max(0, o.price - p.money);
          const gain = (o.lo + o.hi) / 2 - o.price - loan * 0.3;
          if (gain > best && loan <= (d.kind === 'house2' ? 0 : 8000)) { best = gain; b = i; }
        });
        if (b < 0) return { t: 'skip' };
        return { t: 'house', i: b, ins: d.options[b].price >= 7000 && p.money >= d.options[b].price + d.options[b].ins };
      }
      case 'stock': {
        const late = NODES[p.node].seg === 'golden';
        if (late || p.money < STOCK_PRICE + 1500) return { t: 'skip' };
        const free = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(v => !d.taken.includes(v));
        return free.length ? { t: 'stock', v: free[Math.floor(r() * free.length)] } : { t: 'skip' };
      }
      case 'lucky': return p.money >= 1500 && r() < 0.75 ? { t: 'lucky', v: 1 + Math.floor(r() * 10) } : { t: 'skip' };
      case 'sue': { const q = d.options.slice().sort((a, b) => b.money - a.money)[0]; return { t: 'sue', id: q.id }; }
      case 'retire': {
        const mine = p.money + houseValue(p) - Math.round(p.debt * INTEREST) + (RETIRE_BONUS[s.retired] || 0);
        const best = Math.max(0, ...others.map(q => (q.retired ? q.money : q.money + houseValue(q) - Math.round(q.debt * INTEREST))));
        return { t: 'retire', v: mine >= best * 1.05 ? 'rich' : 'farm' };
      }
      default: return null;
    }
  }

  function view(s, viewer) {
    return {
      players: s.players.map(p => ({
        id: p.id, name: p.name, color: p.color, node: p.node, money: p.money, debt: p.debt, salary: p.salary, career: p.career, degree: p.degree,
        married: p.married, kids: p.kids, pets: p.pets, houses: p.houses.map(h => ({ ...h })), stock: p.stock,
        lifeN: p.life.length, lifeT: p.life.map(c => c.t), life: s.over ? p.life.map(c => ({ ...c })) : null,
        retired: p.retired, estate: p.estate, rank: p.rank, bonus: p.bonus, safe: p.safe, total: s.over ? total(p) : null,
      })),
      turnId: cur(s).id, phase: s.phase, spin: s.spin, decision: s.decision, msg: s.msg, log: s.log.slice(-24), seq: s.seq, over: s.over,
      deck: s.deck.length, reserve: s.reserve.length, richWin: s.richWin || null,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const ranked = s.players.slice().sort((a, b) => total(b) - total(a));
    return {
      title: `${ranked[0].name} 님의 인생이 가장 풍요로웠어요!`,
      subtitle: '총점 = 현금 + 보람 카드 + 가족(1명당 1,000만) · 집은 은퇴할 때 팔고 대출은 갚았어요',
      lines: ranked.map(p => `${p.name}: 현금 ${won(p.money)} · 보람 ${p.life.length}장 ${won(lifeSum(p))}${(s.richWin || []).includes(p.id) ? ' (🏰 저택 보너스 포함)' : ''} · 가족 ${family(p)}명 ${won(family(p) * FAMILY)} · ${p.estate === 'rich' ? '🏰 저택' : '🌾 전원'}`),
      ranking: ranked.map(p => ({ id: p.id, value: won(total(p)) + '원' })),
    };
  }
  return {
    meta: {
      name: '인생 게임', min: 2, max: 6, bots: true, turnSec: 40, botDelay: [1200, 1800],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] }],
    },
    W, H, NODES, CAREERS, HOUSES, LIFE_CARDS, FORK, STOPS, YT,
    setup, act, ai, view, result, total, family, lifeSum,
    pending: s => (s.over ? [] : [cur(s).id]),
  };
});
