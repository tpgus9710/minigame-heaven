/* 🤴 계급 전쟁 따라 하기 — 정해 둔 패로 1판(연습이라 카드를 조금만)을 끝까지 + 2판 시작(혁명 · 세금)
 *  자리(내는 순서): 나(달무티) → 알파(총리대신) → 브라보(소작농) → 찰리(농노)   ※ 봇 id: 알파 bot0 · 브라보 bot1 · 찰리 bot2
 *   내 패: 7 7 7 · 8 · 11 11 11 · 12 · ★     알파: 9 9 9 · 10 10 10     브라보: 6 · 8 8 8 · 11 · 12 12     찰리: 1 · 4 4 · 12 12
 *   ① 나 11×3(선) → 알파 9×3 → 브라보 8×3 → 찰리 패스 → 나 7×3 → 모두 패스 → 내가 다시 선
 *   ② 나 12 → 알파 10 → 브라보 6 → 찰리 1 → 나 패스(1은 못 이겨요) → 알파 · 브라보 패스 → 찰리가 새로 선
 *   ③ 찰리 12×2 → 나 8+★(= 8 두 장) → 내가 1등! → 알파 · 브라보 패스 → 찰리 4×2(2등) → 둘 다 패스 → 알파 10×2(3등) → 브라보 꼴찌
 *   2판(80장): 결과표에서 「다음 판 시작」을 누르기 직전에 섞는 순서를 정해 둬요(rig) → 내 손에 어릿광대 2장 → 「조용히 넘어가기」
 *        → 세금: 농노 브라보 → 나 1 · 2, 소작농 알파 → 찰리 2 → 나는 낱장 11 · 12를 돌려줘요 (찰리는 원래 AI로 1장) → 내가 선으로 2판 시작 */
(() => {
  const H1 = { me: [7, 7, 7, 8, 11, 11, 11, 12, 13], bot0: [9, 9, 9, 10, 10, 10], bot1: [6, 8, 8, 8, 11, 12, 12], bot2: [1, 4, 4, 12, 12] };
  const POS = { me: 0, bot0: 1, bot1: 2, bot2: 3 };
  /** 봇 각본: 앞에 놓인 카드('숫자x장수', 선이면 'lead') → 낼 카드 · 'pass' (없으면 원래 AI) */
  const PLAN = {
    bot0: { '11x3': [9, 9, 9], '7x3': 'pass', '12x1': [10], '1x1': 'pass', '8x2': 'pass', '4x2': 'pass', lead: [10, 10] },
    bot1: { '9x3': [8, 8, 8], '7x3': 'pass', '10x1': [6], '1x1': 'pass', '8x2': 'pass', '4x2': 'pass' },
    bot2: { '8x3': 'pass', '7x3': 'pass', '6x1': [1], lead: [12, 12], '8x2': [4, 4] },
  };
  /** 2판 패 (세금 전 · 20장씩): 나는 어릿광대 2장 · 낱장 11 · 12, 농노 브라보는 1 · 2, 소작농 알파는 2 */
  const H2 = {
    me: [3, 5, 5, 6, 6, 6, 8, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 12, 13, 13],
    bot0: [2, 4, 5, 5, 6, 7, 8, 8, 9, 9, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12],
    bot1: [1, 2, 3, 5, 7, 7, 7, 7, 8, 9, 9, 10, 11, 11, 11, 12, 12, 12, 12, 12],
    bot2: [3, 4, 4, 4, 6, 6, 7, 7, 8, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12],
  };
  const P = (s, id) => s.players.find(p => p.id === id);
  const same = (a, b) => Array.isArray(a) && a.length === b.length && a.map(Number).sort((x, y) => x - y).every((x, i) => x === b[i]);
  const has = (hand, cards) => { const h = hand.slice(); return cards.every(x => { const i = h.indexOf(x); if (i < 0) return false; h.splice(i, 1); return true; }); };
  const note = (s, t, text) => { s.seq = (s.seq || 0) + 1; s.log.push({ n: s.seq, t, text }); s.msg = text; };
  /** 다음 판을 섞을 때(startRound → shuffle) 카드가 H2 대로 나뉘게 난수를 맞춰 둬요. 다 쓰면 원래 난수로 돌아가요. */
  function rig(s) {
    if (s.rnd.rig || s.seat[0] !== 'me') return;
    const want = [].concat(...s.seat.map(id => H2[id] || []));
    const a = [];
    for (let v = 1; v <= 12; v++) for (let k = 0; k < v; k++) a.push(v);
    a.push(13, 13);
    if (!same(want, a)) return;                                           // 80장이 꼭 맞을 때만
    const vals = [];
    for (let i = a.length - 1; i > 0; i--) {                             // TableKit.util.shuffle 과 같은 순서 (뒤에서부터 한 장씩)
      const j = a.lastIndexOf(want[i], i);
      vals.push((j + 0.5) / (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const old = s.rnd; let k = 0;
    s.rnd = () => (k < vals.length ? vals[k++] : old());
    s.rnd.rig = true;
  }
  /* 화면 도우미 (브라우저에서만): 숫자 묶음 → 다 고르면 「내기」 버튼을 비춰요 */
  const grp = x => { const c = document.querySelector(`#dm-hand .dm-card[data-x="${x}"]`); return c && c.closest('.dm-group'); };
  const picked = (x, k, j) => typeof DM !== 'undefined' && DM.sel && DM.sel.v === x && DM.sel.k === k && (DM.sel.j || 0) === (j || 0);
  const pick = (x, k, j) => () => (picked(x, k, j) ? document.querySelector('#dm-bar [data-act=dmPlay]') : grp(x));
  const tap = x => `#dm-hand .dm-card[data-x="${x}"]:not(.sel)`;
  const PLAY = '#dm-bar [data-act=dmPlay]:not([disabled])';
  const giveAt = () => document.querySelector(`${tap(11)}, ${tap(12)}`) || document.querySelector('#dm-bar [data-act=dmGive]');

  Tutorial.add('dalmuti', {
    title: '계급 전쟁',
    bots: 3, opts: { rounds: 3, solo: true }, seed: 23, botDelay: [1100, 1500],
    prepare(s) {
      for (const p of s.players) Object.assign(p, { pos: POS[p.id], hand: (H1[p.id] || []).slice(), score: 0, place: null, last: null });
      s.seat = ['me', 'bot0', 'bot1', 'bot2'];
      Object.assign(s, { phase: 'play', turn: 'me', trick: null, pile: [], passes: 0, passedIds: [], finished: [], revolution: null, owe: {}, taxNotes: {}, taxPublic: [],
        ready: [], summaryEnd: null, revoltBy: null, revoltPick: null, sortEnd: null, gone: new Array(14).fill(0), log: [] });
      note(s, 'start', '따라 하기 연습 판이에요. 카드를 조금만 나눴어요.');
      note(s, 'round', '1판 시작! 이번 판은 세금 없이 바로 쳐요.');
      note(s, 'lead', `${P(s, 'me').name} 님(달무티)이 먼저 내요.`);
    },
    bot(s, id) {
      if (s.round !== 1 || s.phase !== 'play' || !PLAN[id]) return undefined;      // 2판(세금 돌려주기)은 원래 AI
      const t = s.trick, m = PLAN[id][t ? `${t.num}x${t.count}` : 'lead'];
      if (m === 'pass') return t ? { t: 'pass' } : undefined;
      return m && has(P(s, id).hand, m) ? { t: 'play', cards: m.slice() } : undefined;
    },
    steps: [
      { say: '<b>계급 전쟁</b>을 같이 한 판 쳐 봐요! 손에 든 카드를 <b>먼저 다 내는 사람</b>이 이겨요. 다 낸 순서대로 다음 판 <b>계급</b>이 정해져요.', next: true },
      { at: '#dm-ladder', say: '위는 <b>계급 사다리</b>예요. 왼쪽부터 달무티 → 총리대신 → 소작농 → 농노 순서로 내요. 숫자는 남은 카드 수예요. 지금 나는 <b>달무티</b>라 먼저 내요.', next: true },
      { at: '#dm-hand', say: '아래는 <b>내 패</b>예요. <b>숫자가 낮을수록 세요!</b> 1이 가장 세고 12가 가장 약해요. 카드는 숫자만큼 있어요(1은 1장 … 12는 12장, ★ 광대 2장). 연습이라 조금만 나눴어요.', next: true },
      { at: pick(11, 3), click: `${tap(11)}[data-i="2"], ${PLAY}`,
        say: '내가 <b>선</b>이에요. 선은 <b>같은 숫자</b>를 원하는 만큼 낼 수 있어요. 약한 카드부터 털어요! <b>11 묶음</b>을 누르고 「광부(11) 3장 내기」를 누르세요.',
        allow: a => (a.t === 'play' && same(a.cards, [11, 11, 11])) || '11 묶음을 눌러 세 장을 모두 고른 뒤 「광부(11) 3장 내기」를 눌러요.', demo: { t: 'play', cards: [11, 11, 11] },
        until: (v, s) => !!s.trick && s.trick.by === 'me' && s.trick.num === 11, wait: 900 },
      { at: '#dm-center', say: '다음 사람은 <b>같은 장수(3장)</b>로 <b>더 낮은 숫자</b>를 내거나 패스해요. 지켜보세요.', bots: true,
        until: (v, s) => s.turn === 'me' && !!s.trick && s.trick.num === 8, wait: 1100 },
      { at: pick(7, 3), click: `${tap(7)}[data-i="2"], ${PLAY}`,
        say: '알파 9 세 장 → 브라보 <b>8 세 장</b>! 내 차례예요. 나도 <b>3장</b>으로 8보다 낮게, <b>7 세 장</b>을 내 보세요. 낼 수 있는 묶음만 밝게 보여요.',
        allow: a => (a.t === 'play' && same(a.cards, [7, 7, 7])) || '7 묶음을 눌러 7 세 장을 고르고 「재봉사(7) 3장 내기」를 눌러요.', demo: { t: 'play', cards: [7, 7, 7] },
        until: (v, s) => !!s.trick && s.trick.by === 'me' && s.trick.num === 7, wait: 900 },
      { at: '#dm-center', say: '3장으로 7보다 낮게 낼 수 없으면 <b>패스</b>해요. 위 사다리에 「패스」가 떠요. 지켜보세요.', bots: true,
        until: (v, s) => s.turn === 'me' && !s.trick, wait: 1000 },
      { at: pick(12, 1), click: `${tap(12)}, ${PLAY}`,
        say: '<b>모두 패스!</b> 마지막에 낸 내가 판을 비우고 <b>새로 선</b>을 잡았어요. 이번엔 몇 장이든 새로 낼 수 있어요. 약한 <b>12 한 장</b>을 내 볼게요.',
        allow: a => (a.t === 'play' && same(a.cards, [12])) || '12 한 장을 고르고 「농노(12) 1장 내기」를 눌러요.', demo: { t: 'play', cards: [12] },
        until: (v, s) => !!s.trick && s.trick.by === 'me' && s.trick.num === 12, wait: 900 },
      { at: '#dm-center', say: '한 장이 나왔으니 다음 사람도 <b>한 장</b>씩, 더 낮은 숫자로 이어 내요.', bots: true,
        until: (v, s) => s.turn === 'me' && !!s.trick && s.trick.num === 1, wait: 1100 },
      { at: '#dm-bar [data-act=dmPass]', say: '찰리가 <b>1</b>을 냈어요! 1은 한 장뿐이라 <b>아무도 못 이겨요</b>. 낼 수 없을 땐 <b>패스</b>! 패스해도 다음 차례엔 또 낼 수 있어요.',
        allow: a => a.t === 'pass' || '지금은 1을 이길 카드가 없어요. 「패스」를 눌러요.', demo: { t: 'pass' },
        until: (v, s) => s.passedIds.includes('me'), wait: 600 },
      { at: '#dm-center', say: '알파 · 브라보도 패스하면 마지막에 낸 <b>찰리</b>가 새로 선을 잡아요. 센 1을 아껴 뒀다가 선을 되찾은 거예요.', bots: true,
        until: (v, s) => s.turn === 'me' && !!s.trick && s.trick.by === 'bot2' && s.trick.count === 2, wait: 1100 },
      { at: pick(8, 1, 1), click: `${tap(8)}, ${PLAY}`,
        say: '찰리가 <b>12 두 장</b>! 나는 8 한 장과 ★뿐… <b>어릿광대</b>는 다른 카드와 함께 내면 그 숫자가 돼요. 8을 누르면 ★이 채워져요. 「석공(8) 2장 내기」!',
        allow: a => (a.t === 'play' && same(a.cards, [8, 13])) || '8을 누르면 어릿광대가 함께 골라져요. 「석공(8) 2장 내기」를 눌러요.', demo: { t: 'play', cards: [8, 13] },
        until: (v, s) => P(s, 'me').place === 1, wait: 1300 },
      { at: '#dm-ladder .dm-seat.me', say: '카드를 <b>다 냈어요! 1등</b>이에요. 1등은 다음 판에도 <b>달무티</b>예요. 남은 사람들은 카드가 한 사람에게만 남을 때까지 계속 쳐요.', next: true },
      { at: '#dm-center', say: '누가 2등 · 3등을 할까요? 끝까지 지켜보세요.', bots: true,
        until: (v, s) => s.phase === 'summary', wait: 1300 },
      { at: '#dm-center .dm-summary', click: '#dm-center [data-act=dmNext]',
        say: '<b>1판 결과</b>예요. 1등 3점 · 2등 2점 · 3등 1점 · 꼴찌 0점. 이 순서가 다음 판 계급이에요. 농노였던 찰리는 총리대신으로! 「다음 판 시작」을 누르세요.',
        enter: rig,
        allow: a => a.t === 'next' || '「다음 판 시작」을 눌러요.', demo: { t: 'next' },
        until: (v, s) => s.round === 2, wait: 900 },
      { at: '#dm-center .dm-revolt', say: '2판은 진짜처럼 80장을 다 나눴어요. 그런데 <b>어릿광대 2장</b>이 다 내 손에! 광대 2장을 받으면 <b>혁명</b>을 일으켜 이번 판 세금을 없앨 수 있어요.', next: true },
      { at: '#dm-center [data-act=dmRevolt][data-yes="0"]',
        say: '<b>농노</b>가 일으키면 <b>대혁명</b> — 계급이 통째로 뒤집혀요! 나는 세금을 <b>받는</b> 달무티라 혁명은 손해예요. 「조용히 넘어가기」를 누르세요.',
        allow: a => (a.t === 'revolt' && !a.yes) || '이번엔 「조용히 넘어가기」를 눌러요. 달무티는 세금을 받는 쪽이에요.', demo: { t: 'revolt', yes: false },
        until: (v, s) => s.phase === 'tax', wait: 900 },
      { at: '#dm-center .dm-taxbox', say: '<b>세금 시간!</b> 판마다 농노는 달무티에게 <b>가장 좋은 카드 2장</b>, 소작농은 총리대신에게 1장을 바쳐요. 농노 브라보가 나에게 <b>1 · 2</b>를 줬어요.', next: true },
      { at: giveAt, click: `${tap(11)}, ${tap(12)}, #dm-bar [data-act=dmGive]:not([disabled])`, bots: true,
        say: '받은 만큼 <b>아무 카드나</b> 돌려줘요. 쓸모없는 <b>낱장 11 · 12</b>를 눌러 고르고 「카드 2장 돌려주기」를 누르세요.',
        allow: a => (a.t === 'give' && same(a.cards, [11, 12])) || '낱장 11과 12를 골라 「카드 2장 돌려주기」를 눌러요.', demo: { t: 'give', cards: [11, 12] },
        until: (v, s) => s.phase === 'play', wait: 1100 },
      { at: '#dm-hand', say: '2판 시작! 달무티인 내가 먼저 내요. 기억해요: <b>약하고 많은 묶음</b>부터 털고, 1 · 2 · 광대는 <b>선을 되찾을 때</b> 쓰고, 이미 나온 센 카드를 세어 두세요.', next: true },
    ],
    done: '선 잡기 · 같은 장수로 더 낮게 · 어릿광대 · 패스와 새 선 · 계급 · 혁명 · 세금까지 다 해 봤어요. 이길 수 있어도 센 카드를 아끼려고 <b>일부러 패스</b>하는 것도 작전이에요!',
  });
})();
