/* 🎴 고스톱(맞고) 따라 하기 — 정해 둔 패로 한 판: 같은 달 맞추기 · 뒤집기 · 둘 중 고르기 · 고도리 · 뻑 · 뻑 먹기 · 쪽 · 피 뺏기 · 고/스톱 · 광박
 *  카드 번호 = (달-1)×4 + k  (public/js/shared/gostop-core.js 의 CARDS)
 *   내 손패: 2월 꾀꼬리(4) · 8월 공산 광(28) · 5월 초단(17) · 3월 벚꽃 광(8) + 다른 달 6장
 *   바닥: 2월 피(7) · 4월 두견새(12) · 8월 기러기(29) · 8월 피(30) · 1월 피(2) · 9월 피(35) · 5월 다리(16) · 10월 피(39)
 *   더미(뒤집는 순서): 4월 피 → 11월 피 → 1월 송학 광 → 5월 피 → 비 띠 → 10월 피 → 3월 피 …
 *   흐름: 나 2월(+뒤집은 4월) → AI 9월 → 나 8월 고르기(기러기 = 고도리 5점, 뒤집은 송학 광) → AI 5월 뻑
 *        → 나 5월로 뻑 먹기(피 뺏기) → AI 7월(뒤집은 10월) → 나 3월 쪽(피 뺏기 · 광 3장) = 8점 → 스톱 → 광박 ×2 */
Tutorial.add('gostop', {
  title: '고스톱 (맞고)',
  bots: 1, opts: { rounds: 3, solo: true }, seed: 11, botDelay: [1300, 1800],
  prepare(s) {
    const [me, ai] = s.players;
    me.hand = [4, 28, 17, 8, 20, 24, 41, 45, 36, 13];
    ai.hand = [34, 18, 26, 1, 5, 21, 22, 31, 33, 43];
    s.floor = [7, 12, 29, 30, 2, 35, 16, 39];
    s.stock = [14, 42, 0, 19, 46, 38, 10, 3, 6, 9, 11, 15, 23, 25, 27, 32, 37, 40, 44, 47, 48, 49];
    for (const p of s.players) Object.assign(p, { cap: [], go: 0, goScore: 0, shake: 0, bomb: 0, ppuk: 0, flipOnly: 0, shown: [] });
    Object.assign(s, { stuck: {}, dealer: 0, turn: 0, phase: 'play', ask: null, T: null, msg: '1판 시작! 내가 선이에요.' });
    for (const e of s.log || []) if (e.t === 'round') e.dealer = 0;               // 기록 첫 줄도 「선: 나」
  },
  /** AI는 정해 둔 패를 차례로 내요: 9월 피 → 5월 피(뻑) → 7월 피 */
  bot(s, id) {
    const p = s.players[1];
    if (s.phase !== 'play' || s.turn !== 1) return undefined;
    const c = [34, 18, 26].find(x => p.hand.includes(x));
    return c != null ? { t: 'play', c } : undefined;
  },
  steps: [
    { say: '<b>맞고</b>(둘이 치는 고스톱)를 한 판 같이 쳐 봐요! 같은 <b>달</b>끼리 맞춰서 패를 먹고, 먼저 <b>7점</b>을 내면 이겨요.', next: true },
    { at: '#gs-hand', say: '아래가 <b>내 손패</b>예요. 그려진 꽃이 같으면 <b>같은 달</b>이에요 (1월 송학 · 2월 매조 · 3월 벚꽃 …). 또렷하게 빛나는 패는 바닥에 같은 달이 있어서 먹을 수 있어요.', next: true },
    { at: '#gs-floor', say: '가운데가 <b>바닥</b>이에요. 같은 달끼리 모여 있어요. 맨 왼쪽 뒤집힌 더미는 차례마다 한 장씩 뒤집는 패예요.', next: true },
    { at: '#gs-hand [data-c="4"]', say: '<b>2월 꾀꼬리</b>를 내 보세요. 바닥의 2월 피와 맞아요.<br><small class="muted">휴대폰: 한 번 눌러 고르고 → 한 번 더 누르면 내요</small>',
      demo: { t: 'play', c: 4 }, allow: a => (a.t === 'play' && +a.c === 4) || '빛나는 2월 꾀꼬리를 내 보세요!', until: v => v.players[0].cap.includes(4), wait: 1700 },
    { at: '#gs-mine .gs-pl', say: '패를 낸 다음엔 <b>더미에서 한 장</b>을 뒤집어요. 뒤집은 <b>4월 피</b>도 바닥의 4월 두견새와 맞아서 <b>같이 먹었어요!</b> 먹은 패는 여기에 종류별로 모여요.', next: true },
    { say: 'AI 차례예요. AI도 똑같이 한 장 내고 한 장 뒤집어요. 지켜보세요.', bots: true,
      until: (v, s) => s.turn === 0 && s.phase === 'play' && s.players[1].cap.length > 0, wait: 1500 },
    { at: '#gs-hand [data-c="28"]', say: '이번엔 <b>8월 공산 광</b>을 내 보세요. 바닥에 8월이 <b>두 장</b>이라서 하나를 고르게 돼요.',
      demo: { t: 'play', c: 28 }, allow: a => (a.t === 'play' && +a.c === 28) || '8월 공산 광을 내 보세요!', until: v => v.phase === 'choose', wait: 600 },
    { at: '#gs-dlg .gs-pk[data-c="29"]', say: '<b>기러기</b>(열끗)를 고르세요. 피보다 광 · 열끗 · 띠가 점수에 더 도움 돼요. 게다가 꾀꼬리 · 두견새 · 기러기가 모이면…',
      demo: { t: 'take', c: 29 }, allow: a => (a.t === 'take' && +a.c === 29) || '이번엔 기러기를 골라 보세요!', until: v => v.players[0].cap.includes(29), wait: 1900 },
    { at: '#gs-mine .gs-pl', say: '<b>고도리 완성! 5점</b>이에요. (2 · 4 · 8월 새 세 마리) 뒤집은 <b>송학 광</b>도 1월 피와 맞아서 광이 2장이 됐어요. 광은 3장부터 3점!', next: true },
    { say: 'AI 차례예요. 이번엔 잘 보세요…', bots: true,
      until: (v, s) => s.turn === 0 && s.phase === 'play' && s.stuck[5] === 1, wait: 2000 },
    { at: '#gs-floor .fg[data-m="5"]', say: '<b>뻑!</b> AI가 낸 5월 패와 뒤집은 패가 <b>같은 달</b>이라 세 장이 다 바닥에 남았어요. 이 세 장을 먹으면 상대 피를 <b>1장 뺏어</b> 와요.', next: true },
    { at: '#gs-hand [data-c="17"]', say: '<b>5월 초단</b>으로 뻑을 먹어 보세요! 네 장을 한꺼번에 가져와요.',
      demo: { t: 'play', c: 17 }, allow: a => (a.t === 'play' && +a.c === 17) || '5월 초단으로 뻑을 먹어 보세요!', until: v => v.players[0].cap.includes(16), wait: 2300 },
    { at: '#gs-mine .gs-pl', say: '네 장을 먹고 <b>AI의 피를 1장</b> 가져왔어요. 피를 뺏으면 나는 늘고 상대는 줄어서 두 배로 이득이에요. 피는 <b>10장</b>부터 1점(쌍피는 2장 몫)!', next: true },
    { say: 'AI 차례예요.', bots: true, until: (v, s) => s.turn === 0 && s.phase === 'play' && s.players[1].cap.includes(38), wait: 1600 },
    { at: '#gs-hand [data-c="8"]', say: '<b>3월 벚꽃 광</b>을 내 보세요. 바닥에 3월이 없어서 그냥 놓이는데… 뒤집은 패가 <b>3월</b>이면 <b>쪽</b>이에요!',
      demo: { t: 'play', c: 8 }, allow: a => (a.t === 'play' && +a.c === 8) || '3월 벚꽃 광을 내 보세요!', until: v => v.phase === 'gostop', wait: 2400 },
    { at: '#gs-mine .gs-pl', say: '<b>쪽!</b> 피를 또 1장 뺏었어요. 그리고 <b>광 3장 = 3점</b> + 고도리 5점 = <b>8점</b>! 맞고는 7점부터 날 수 있어요.', next: true },
    { at: '#gs-dlg .gs-box', click: '#gs-dlg [data-act=gsStop]', say: '점수가 나면 <b>고</b> 또는 <b>스톱</b>! 고는 +1점을 받고 계속 치지만, AI가 먼저 나면 <b>고박</b>(두 배)을 물어요. 상대 점수가 높거나 남은 패가 적으면 스톱이 안전해요. 이번엔 <b>스톱</b>!',
      demo: { t: 'stop' }, allow: a => a.t === 'stop' || '이번엔 스톱을 눌러서 점수를 받아 볼게요!', until: v => v.phase === 'summary', wait: 1500 },
    { at: '#gs-dlg .gs-sum', say: '정산이에요. 8점인데 AI가 <b>광이 하나도 없어서 광박 ×2</b> → 16점! 피로 점수가 났을 때 상대 피가 7장 이하면 <b>피박</b>, 흔들기 · 폭탄도 두 배예요.', next: true },
    { say: '<b>머리 쓰는 법</b>: 먹을 패가 여럿이면 광 · 열끗 · 띠부터 챙기고, 상대가 모으는 고도리 · 단은 먼저 끊어요. 짝이 없는 패는 상대가 못 먹을 패부터 바닥에 내요.', next: true },
  ],
  done: '같은 달 맞추기 · 뒤집기 · 둘 중 고르기 · 고도리 · 뻑 · 뻑 먹기 · 쪽 · 피 뺏기 · 고/스톱 · 광박까지 다 해 봤어요. 이제 AI와 진짜로 한 판 쳐 볼까요?',
});
