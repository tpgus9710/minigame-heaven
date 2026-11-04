/* 👑 궁정 음모 따라 하기 — 정해 둔 카드로 3명(나 · 봇 알파 · 봇 브라보)이 한 판:
 *   기본 행동 · 막기 · 막기에 도전(거짓말 들통) · 인물 주장 · 도전 실패(보여 준 카드 교체) · 암살 · 블러핑 막기 · 쿠데타 · 생각하는 법
 *  카드: 나 공작 · 공작 / 알파 대사 · 암살자 / 브라보 사령관 · 백작부인 / 궁정 덱 9장 (공작 1 · 암살자 2 · 사령관 2 · 대사 2 · 백작부인 2)
 *  흐름 (s.turnN = 몇 번째 차례):
 *   1 나: 해외 원조 → 브라보가 공작이라며 막아요(거짓말) → 내가 도전 → 브라보가 사령관을 잃고, 원조 +2 (나 4코인)
 *   2 알파: 소득 (3) · 3 브라보: 소득 (3)
 *   4 나: 세금(진짜 공작) → 알파가 도전 → 진짜! 내 공작은 덱에 섞고 새 카드(암살자 · seed 7) · 알파가 대사를 잃고, 세금 +3 (나 7코인)
 *   5 알파: 3코인 내고 나를 암살 → 나는 허용 → 백작부인이라며 막기(블러핑) → 아무도 도전하지 않아 무산 (알파 0코인)
 *   6 브라보: 소득 (4)
 *   7 나: 쿠데타 7코인 → 코인이 많은 브라보 탈락 → 8 알파 차례부터는 원래 AI (이 판 이어서 하기)
 *  봇 응답: 규칙은 응답 창이 열릴 때 봇의 도전 · 막기를 미리 정해서 「허용」할 봇은 바로 넘겨요.
 *   그래서 prepare 에서 봇 표시(bot)를 잠깐 꺼 두면 봇도 차례가 올 때 bot() 각본대로 답해요 (난수도 쓰지 않아 새 카드가 늘 같아요).
 *   각본이 끝나는 쿠데타 설명 단계(enter)와 진짜 AI로 이어서 칠 때(release · 중간에 그만둬도) 다시 켜요. */
(function () {
  /** 봇 차례에 할 행동 (s.turnN 기준) */
  const TURN = { 2: { t: 'act', kind: 'income' }, 3: { t: 'act', kind: 'income' }, 5: { t: 'act', kind: 'assassin', target: 'me' }, 6: { t: 'act', kind: 'income' } };
  /** 카드를 잃을 때 내놓을 카드 */
  const LOSE = { 1: 'captain', 4: 'ambassador' };
  const isOut = (s, id) => s.players.find(p => p.id === id).cards.every(c => c.dead);
  const card = c => ({ c, dead: false });
  const btn = sel => `#cp-stage [data-act="cpResp"]${sel}`;

  Tutorial.add('coup', {
    title: '궁정 음모',
    bots: 2, opts: { solo: true }, seed: 7, botDelay: [1100, 1600],
    prepare(s) {
      const [me, A, B] = s.players;
      me.cards = [card('duke'), card('duke')];
      A.cards = [card('ambassador'), card('assassin')];
      B.cards = [card('captain'), card('contessa')];
      s.deck = ['contessa', 'captain', 'ambassador', 'assassin', 'duke', 'contessa', 'ambassador', 'captain', 'assassin'];
      for (const p of s.players) { p.coins = 2; if (p.id !== 'me') p.bot = false; }     // 봇 응답은 각본대로 (위 설명)
      Object.assign(s, { turn: 0, turnN: 1, phase: 'act', pend: null, win: null, losses: [], claims: {}, proof: null });
      s.msg = `${me.name} 님부터 시작해요. 카드를 가진 척해도 돼요 — 들키지만 않으면!`;
      if (s.log[0]) s.log[0].text = s.msg;                                                  // 기록 첫 줄도 「나부터」
    },
    /** 진짜 AI와 이어서 칠 때 (끝까지 했든 중간에 그만뒀든): 봇 표시를 되돌려 원래 규칙대로 */
    release(s) { for (const p of s.players) if (p.id !== 'me') p.bot = true; },
    /** 봇: 정해 둔 행동 · 응답 (null = 내가 먼저 고를 때까지 기다리기, undefined = 원래 AI) */
    bot(s, id) {
      const n = s.turnN, w = s.win;
      if (s.phase === 'act') return TURN[n] ? Object.assign({}, TURN[n]) : undefined;
      if (s.phase === 'lose') {
        const p = s.players.find(q => q.id === id), i = LOSE[n] ? p.cards.findIndex(c => !c.dead && c.c === LOSE[n]) : -1;
        return i >= 0 ? { t: 'lose', idx: i } : undefined;
      }
      if (s.phase === 'window' && w) {
        if (n === 1) return w.type === 'block' ? (id === 'bot1' ? { t: 'block', card: 'duke' } : { t: 'allow' }) : null;   // 막기에 도전하는 건 나
        if (n === 4) return id === 'bot0' ? { t: 'chal' } : { t: 'allow' };
        if (n === 5) return { t: 'allow' };
      }
      return undefined;
    },
    steps: [
      { at: '#cp-opps', say: '<b>궁정 음모</b>를 같이 한 판 해 봐요! 위는 상대 <b>봇 알파 · 봇 브라보</b>예요. 모두 숨긴 카드 2장 · 코인 2개로 시작해요. 마지막까지 살아남으면 승리!', next: true },
      { at: '#cp-me .cp-mycards', say: '여기가 내 <b>인물 카드 2장</b>이에요(나만 봐요). 카드 1장 = 목숨 1개! 잃은 카드는 앞면으로 공개되고, 2장 다 잃으면 <b>탈락</b>. 지금 내 손엔 <b>공작이 2장</b>!', next: true },
      { at: '#cp-acts', say: '내 차례엔 행동 하나! <b>소득 · 해외 원조 · 쿠데타</b>는 누구나 해요. 나머지 넷은 <b>인물 능력</b> — 그 인물이 있다고 <b>주장</b>만 하면 돼요. 없어도요! (「블러핑」 표시)', next: true },
      { at: '#cp-acts [data-k="aid"]', say: '먼저 <b>해외 원조</b>(+2코인)를 눌러 보세요. 단, 누구든 <b>공작</b>이라며 막을 수 있어요.',
        allow: a => (a.t === 'act' && a.kind === 'aid') || '해외 원조를 눌러 보세요!', demo: { t: 'act', kind: 'aid' },
        until: (v, s) => s.phase === 'window' && !!s.win && s.win.type === 'block', wait: 500 },
      { say: '상대들이 막을지 고민 중이에요…', bots: true, until: v => !!v.ask && v.ask.k === 'bchal', wait: 900 },
      { at: btn('[data-t="chal"]'), say: '브라보가 <b>공작</b>이라며 막았어요. 그런데 공작은 3장뿐이고 <b>2장이 내 손</b>에 있어요. 거짓말일 가능성이 커요 → <b>도전!</b>',
        allow: a => a.t === 'chal' || '「도전!」을 눌러 보세요!', demo: { t: 'chal' },
        until: (v, s) => s.phase === 'lose' && !!s.losses[0] && s.losses[0].id === 'bot1', wait: 1500 },
      { say: '들킨 브라보가 잃을 카드를 골라요…', bots: true, until: (v, s) => s.turn === 1 && s.phase === 'act', wait: 1100 },
      { at: '#cp-opps .cp-seat[data-id="bot1"]', say: '<b>거짓말 들통!</b> 브라보가 카드 1장을 잃었어요(앞면 공개). 막기가 무산돼서 내 해외 원조 <b>+2</b>는 그대로 받았어요. 브라보는 이제 목숨 1개!', next: true },
      { say: '이번엔 알파 · 브라보 차례예요. 지켜보세요.', bots: true, until: (v, s) => s.turn === 0 && s.phase === 'act', wait: 800 },
      { at: '#cp-acts [data-k="tax"]', say: '이번엔 <b>세금</b>(+3코인)! 공작이 있다고 <b>주장</b>하는 인물 능력이에요. 내 손엔 진짜 공작이 있으니 걱정 없어요.',
        allow: a => (a.t === 'act' && a.kind === 'tax') || '세금을 눌러 보세요!', demo: { t: 'act', kind: 'tax' },
        until: (v, s) => s.phase === 'window' && !!s.win && s.win.type === 'chal', wait: 500 },
      { say: '인물을 주장하면 누구나 <b>도전</b>할 수 있어요…', bots: true,
        until: (v, s) => s.phase === 'lose' && !!s.losses[0] && s.losses[0].id === 'bot0', wait: 1700 },
      { at: '#cp-me .cp-mycards', say: v => `알파가 도전했지만 <b>진짜 공작</b>이었어요! 틀린 알파가 카드 1장을 잃어요. 보여 준 공작은 덱에 섞고 <b>새 카드</b>${newCard(v)}를 받았어요 — 정체가 다시 숨겨져요.`, next: true },
      { say: '알파가 잃을 카드를 골라요. 이어서 알파 차례 — 코인 3개면 암살도 할 수 있는데…', bots: true,          // 브라보의 「허용」까지 이 단계에서 (내가 누를 때 버튼이 다시 그려지지 않게)
        until: (v, s) => !!v.ask && v.ask.k === 'chal' && !!s.win && s.win.passed.includes('bot1'), wait: 900 },
      { at: btn('[data-t="allow"]'), say: '알파가 <b>암살자</b>라며 3코인을 내고 나를 노려요! 도전했다 틀리면 1장 잃고 암살로 1장 더 잃을 수 있어요. 일단 <b>허용</b>!',
        allow: a => a.t === 'allow' || '이번엔 「허용」을 눌러 보세요.', demo: { t: 'allow' },
        until: v => !!v.ask && v.ask.k === 'block', wait: 500 },
      { at: btn('[data-t="block"][data-card="contessa"]'), say: v => (hasCard(v, 'contessa')
        ? '암살은 <b>백작부인</b>으로 막아요. 마침 새 카드가 백작부인이에요! <b>백작부인으로 막기</b>를 눌러요.'
        : '암살은 <b>백작부인</b>으로 막아요. 내겐 없지만 상대 둘 다 <b>카드가 1장</b>이라 함부로 도전 못 해요(틀리면 탈락). <b>블러핑</b>으로 막아요!'),
        allow: a => (a.t === 'block' && a.card === 'contessa') || '「백작부인으로 막기」를 눌러 보세요!', demo: { t: 'block', card: 'contessa' },
        until: (v, s) => !!(s.pend && s.pend.block), wait: 500 },
      { say: '막기도 주장이라 도전받을 수 있어요. 두근두근…', bots: true, until: (v, s) => s.turn === 0 && s.phase === 'act', wait: 900 },
      { at: '#cp-me .cp-mybar', say: '막기 성공! 알파가 낸 <b>3코인은 돌려받지 못해요</b>. 내 코인은 <b>7개</b> → <b>쿠데타</b>를 할 수 있어요. 막을 수도 도전할 수도 없는 공격! <b>10개 이상</b>이면 쿠데타만 할 수 있어요.',
        enter: s => s.players.forEach(p => { if (p.id !== 'me') p.bot = true; }), next: true },        // 각본 끝: 봇 응답은 다시 원래 규칙대로
      { at: () => (typeof CP !== 'undefined' && CP.pick === 'coup' ? $('#cp-opps .cp-seat[data-id="bot1"]') : $('#cp-acts [data-k="coup"]')),
        click: '#cp-opps .cp-seat.pick[data-id="bot1"], #cp-acts [data-k="coup"]',
        say: '누구를 노릴까요? 둘 다 목숨 1개지만 <b>브라보는 코인 4개</b> — 다음 차례에 암살도 할 수 있어요. <b>쿠데타</b> → <b>브라보</b>를 눌러요.',
        allow: a => (a.t === 'act' && a.kind === 'coup' && a.target === 'bot1') || (a.t === 'act' && a.kind === 'coup' ? '이번엔 코인이 많은 브라보를 골라 보세요!' : '쿠데타를 눌러 보세요!'),
        demo: { t: 'act', kind: 'coup', target: 'bot1' },                 // 화면에선 쿠데타 → 브라보 자리 두 번 눌러요 (보내는 행동은 하나)
        until: (v, s) => isOut(s, 'bot1'), wait: 1800 },
      { at: '#cp-opps', say: '브라보 <b>탈락!</b> 이제 알파와 일대일, 카드 2장인 내가 유리해요. 그래도 알파가 코인 3개를 모으면 <b>암살</b>, 내 코인이 쌓이면 <b>갈취</b>(공짜로 2개 뺏기 · 사령관 · 대사로 막아요)를 조심!', next: true },
      { at: '#cp-guide summary', say: '<b>생각하는 법</b><br>· 공개된 카드 + 내 카드로 3장이 보이면 거짓말<br>· 블러핑은 한 인물로 꾸준히<br>· 카드 1장일 땐 도전은 확실할 때만<br>· 코인 많은 사람이 가장 위험해요<br>능력표는 이 「인물 카드」 버튼!', next: true },
    ],
    done: '해외 원조 · 막기 · 도전(거짓말 들통 · 도전 실패) · 세금 · 암살 · 블러핑 막기 · 쿠데타까지 다 해 봤어요. 이 판을 이어서 알파와 끝을 보거나, AI와 진짜 한 판 해 보세요!',
  });

  /** 내 카드 (화면 정보 v 기준) */
  function hasCard(v, c) { const me = v.players.find(p => p.id === v.me); return !!me && me.cards.some(x => !x.dead && x.c === c); }
  function newCard(v) {
    const me = v.players.find(p => p.id === v.me), f = me && me.cards.find(x => x.fresh && x.c);
    const N = { duke: '공작', assassin: '암살자', captain: '사령관', ambassador: '대사', contessa: '백작부인' };
    return f ? `(<b>${N[f.c]}</b>)` : '';
  }
})();
