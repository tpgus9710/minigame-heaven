/* ⭐ 황야의 총잡이 따라 하기 — 4명(나 + 봇 3) 정해 둔 한 바퀴: 역할 · 생명력 · 거리와 사정거리 · 총 · 뱅!과 빗나감! · 맥주 · 앞에 놓는 카드 · 버리기 · 누가 적인지 읽기
 *  자리: 나(보안관 · 오뚝이 버크 · 생명력 5) → 알파(무법자 · 장의사 모트) → 브라보(무법자 · 바쁜 손 루시) → 찰리(배신자 · 속사 키드)
 *   내 손패 7장(처음 5장 + 차례 시작 2장): 뱅! ×3 · 빗나감! · 맥주 · 감옥 · 리볼버
 *   더미(가져오는 순서): 알파 뱅! · 주점 → 브라보 뱅! · 결투 → 나(버크 능력) 빗나감! → 찰리 뱅! · 맥주 → 나 야생마 · 맥주 → 나머지는 섞어 둬요
 *   흐름: 나 리볼버(사정거리 2) → 차례 끝 · 뱅! 1장 버리기 → 알파가 나를 뱅! → 빗나감!으로 피하기
 *        → 브라보가 레버 소총(3)을 들고 맞은편에서 나를 뱅! → 빗나감!이 없어 생명력 -1 (버크: 카드 1장)
 *        → 찰리가 야생마를 놓고 무법자 브라보를 뱅! (배신자는 처음엔 보안관 편인 척) → 나 맥주 · 브라보에게 뱅!
 *   봇은 bot() 각본대로만 쏘고(대응 · 버리기는 원래 AI), 끝나면 이 판 그대로 진짜 AI와 이어서 칠 수 있어요. */
(() => {
  const P = (s, id) => s.players.find(p => p.id === id);
  const me = s => P(s, 'me');
  const W = (s, kind, who) => !!(s.wait && s.wait.kind === kind && s.wait.who === who);
  const kind = (s, id) => (me(s).hand.find(c => c.id === id) || {}).k;
  const cid = (s, k) => (me(s).hand.find(c => c.k === k) || {}).id;      // 내 손패에서 그 종류 카드 하나 (demo 용)
  /** 안 되는 행동 → 안내 문구. 고르던 카드 표시가 남지 않게 화면을 한 번 새로 그려요 */
  const no = msg => { if (typeof Table !== 'undefined' && Table.refresh) setTimeout(() => Table.refresh(), 0); return msg; };
  const seat = id => `#bg-seats [data-pid="${id}"]`;
  const DEAL = {
    me: { role: 'sheriff', char: 'burke', hand: ['bang', 'bang', 'bang', 'missed', 'beer', 'jail', 'schofield'] },
    bot0: { role: 'outlaw', char: 'mort', hand: ['bang', 'missed', 'beer', 'stagecoach'] },
    bot1: { role: 'outlaw', char: 'lucy', hand: ['bang', 'remington', 'beer', 'panic'] },
    bot2: { role: 'renegade', char: 'kid', hand: ['bang', 'mustang', 'missed', 'catbalou'] },
  };
  const DRAWS = ['bang', 'saloon', 'bang', 'duel', 'missed', 'bang', 'beer', 'mustang', 'beer'];
  /** 봇 각본: 브라보는 레버 소총, 찰리는 야생마를 먼저 놓고 → 뱅! 한 번 → 차례 끝 */
  const GEAR = { bot1: 'remington', bot2: 'mustang' };
  const AIM = { bot0: 'me', bot1: 'me', bot2: 'bot1' };

  Tutorial.add('bang', {
    title: '황야의 총잡이',
    bots: 3, opts: { solo: true }, seed: 5, botDelay: [1300, 1800],
    prepare(s) {
      const pool = s.deck.concat(s.discard, ...s.players.map(p => p.hand.concat(p.inPlay)));
      const take = k => pool.splice(pool.findIndex(c => c.k === k), 1)[0];
      for (const p of s.players) {
        const d = DEAL[p.id];
        Object.assign(p, { role: d.role, char: d.char, inPlay: [], alive: true });
        p.max = p.hp = BangCore.CHARS[d.char].hp + (d.role === 'sheriff' ? 1 : 0);
        p.hand = d.hand.map(take);
      }
      const top = DRAWS.map(take), r = Tutorial.rng(31);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      s.deck = pool.concat(top.reverse());                        // 맨 뒤부터 가져가요 → DRAWS 순서대로
      Object.assign(s, { discard: [], turn: 0, turnNo: 1, bangs: 0, queue: [], duel: null, store: null, attack: null, over: false, winRole: null,
        winners: [], deaths: [], host: {}, dlAt: null, log: [], seq: 0, wait: { kind: 'play', who: 'me' } });
      const name = me(s).name;
      for (const e of [{ text: `${name} 님이 보안관이에요! 보안관부터 시작해요.`, kind: 'info' }, { text: `${name} 님 차례예요.`, kind: 'turn', fx: 'turn', id: 'me' }]) {
        s.seq++; s.log.push(Object.assign({ n: s.seq }, e)); s.msg = e.text;
      }
    },
    bot(s, id) {
      const w = s.wait;
      if (!w || w.who !== id || w.kind !== 'play') return undefined;           // 대응 · 버리기는 원래 AI
      const p = P(s, id), card = k => p.hand.find(c => c.k === k);
      const g = GEAR[id];
      if (g && card(g) && !p.inPlay.some(c => c.k === g)) return { t: 'play', card: card(g).id };
      if (!s.bangs && card('bang')) return { t: 'play', card: card('bang').id, target: AIM[id] };
      return { t: 'end' };
    },
    steps: [
      { say: '<b>황야의 총잡이</b>를 4명이서 해 봐요! 처음에 모두 몰래 <b>역할</b>을 받아요. 보안관 1 · 무법자 2 · 배신자 1 — 그중 <b>보안관</b>만 모두에게 공개돼요.', next: true },
      { say: '역할마다 이기는 법이 달라요.<br><b>보안관</b>: 무법자 · 배신자를 모두 쓰러뜨리기<br><b>무법자</b>: 보안관만 쓰러뜨리면 승리<br><b>배신자</b>: 혼자 끝까지 살아남기 (마지막에 보안관과 1:1)', next: true },
      { at: '#bg-me', say: '나는 <b>보안관</b>이에요! 모두 알고 있어서 무법자들이 나를 노려요. 대신 생명력이 1 많고 내가 먼저 시작해요. 이기는 법은 내 자리에 늘 적혀 있어요.', next: true },
      { at: '#bg-me .bg-char', say: '내 인물은 <b>오뚝이 버크</b>: 생명력을 1 잃을 때마다 카드를 1장 가져와요. 인물마다 능력이 달라요. 남의 능력은 그 사람 자리를 누르면 보여요.', next: true },
      { at: '#bg-me .bg-hp', say: '금색 칸이 <b>생명력</b>(5)이에요. 맞으면 1씩 줄고, 0이 되면 쓰러지며 역할이 공개돼요. 차례를 마칠 때 손에 남길 수 있는 카드도 <b>생명력만큼</b>이에요.', next: true },
      { at: '#bg-seats', say: '다른 세 사람의 역할은 <b>?</b> — 비밀이에요. 누가 무법자인지는 <b>누구를 공격하는지</b> 보고 알아내야 해요. 생명력 · 손에 든 카드 수 · 앞에 놓은 카드는 다 보여요.', next: true },
      { at: '#bg-hand', say: '내 차례엔 ① 카드 <b>2장</b>을 저절로 가져오고 ② 카드를 원하는 만큼 내고 ③ 넘치는 카드를 버려요. 갈색 테두리는 쓰고 버리는 카드, 파랑 · 회색은 앞에 내려놓아 계속 효과가 있는 카드예요.', next: true },
      { at: '#bg-seats', say: '자리마다 <b>거리</b>가 있어요. 양옆 알파 · 찰리는 1, 맞은편 브라보는 2. 총이 없으면 <b>사정거리 1</b>이라 거리 1인 사람만 쏠 수 있어요. 빨간 거리 = 지금 쏠 수 있는 사람!', next: true },
      { at: '#bg-hand .k-schofield', say: '<b>리볼버</b>를 눌러 앞에 내려놓아요. 총을 들면 사정거리가 총에 적힌 숫자가 돼요 (리볼버 = 2). 총은 하나만 들 수 있어요.',
        allow: (a, s) => (a.t === 'play' && kind(s, a.card) === 'schofield') || no('먼저 리볼버를 눌러 앞에 내려놓아 봐요!'),
        demo: s => ({ t: 'play', card: cid(s, 'schofield') }),
        until: (v, s) => me(s).inPlay.some(c => c.k === 'schofield') },
      { at: seat('bot1'), say: '브라보의 거리도 빨개졌어요 = 사정거리 안! 그럼 바로 쏠까요? 아직 누가 무법자인지 몰라요. 보안관은 첫 차례엔 <b>누가 나를 쏘는지</b> 먼저 지켜보는 게 좋아요.', next: true },
      { at: '#bg-bar [data-act=bgEnd]', say: '이번 차례는 여기까지! <b>차례 끝내기</b>를 눌러요.',
        allow: a => a.t === 'end' || no('이번엔 「차례 끝내기」를 눌러요. 첫 차례엔 지켜보기로 해요!'),
        demo: { t: 'end' },
        until: (v, s) => W(s, 'discard', 'me') },
      { at: () => ($('#bg-hand .bg-card.pick') ? $('#bg-bar [data-act=bgDiscard]') : $('#bg-hand .bg-card.k-bang')),
        click: '#bg-hand:not(:has(.pick)) .bg-card.k-bang.live, #bg-bar [data-act=bgDiscard]:not([disabled])',
        say: '카드 6장 > 생명력 5라서 <b>1장</b>을 버려야 해요. 빗나감! · 맥주는 나를 지켜 주니 남기고, 3장이나 있는 <b>뱅!</b>(차례에 1번만 써요)을 골라 → 「버리고 차례 끝내기」.',
        allow: (a, s) => (a.t === 'discard' && Array.isArray(a.ids) && a.ids.length === 1 && kind(s, a.ids[0]) === 'bang') || no('빗나감! · 맥주 · 감옥은 남기고, 뱅! 한 장을 골라 버려 봐요.'),
        demo: s => ({ t: 'discard', ids: [cid(s, 'bang')] }),         // (화면에서는 카드를 눌러 고른 뒤 버튼 — 고르기는 화면 안에서만, 보내는 행동은 이것 하나)
        until: (v, s) => s.turn === 1 },
      { at: seat('bot0'), dim: 0.12, say: '이제 <b>알파</b> 차례예요. 알파가 무엇을 하는지 지켜보세요.', bots: true,
        until: (v, s) => W(s, 'respond', 'me'), wait: 900 },
      { at: '#bg-bar [data-act=bgRespond]', say: '알파가 나에게 <b>뱅!</b>을 쐈어요! <b>빗나감!</b>을 내면 피하고, 「맞기」는 생명력 -1이에요. 빗나감!으로 피해요!',
        allow: a => a.t === 'cards' || no('이번엔 「빗나감! 내기」로 피해 봐요!'),
        demo: s => ({ t: 'cards', ids: [cid(s, 'missed')] }),
        until: (v, s) => !W(s, 'respond', 'me'), wait: 1200 },
      { at: seat('bot0'), say: '피했어요! 빗나감!은 이렇게 <b>공격받을 때</b> 쓰는 카드라 내 차례엔 못 내요. 그리고 알파는 <b>보안관을 쐈어요</b> → 무법자일 가능성이 커요!', next: true },
      { at: seat('bot1'), dim: 0.12, say: '알파가 차례를 마치면 맞은편 <b>브라보</b> 차례예요. 거리 2인데 나를 쏠 수 있을까요?', bots: true,
        until: (v, s) => me(s).hp < 5, wait: 1800 },
      { at: '#bg-me', say: '브라보가 <b>레버 소총</b>(사정거리 3)을 들고 쐈어요. 빗나감!이 없어서 생명력 -1… 대신 버크 능력으로 카드 1장! 빗나감!은 여러 장 모아 두면 든든해요.', next: true },
      { at: seat('bot2'), dim: 0.12, say: '이번엔 <b>찰리</b> 차례예요. 찰리는 누구를 노릴까요?', bots: true,
        until: (v, s) => W(s, 'play', 'me'), wait: 1300 },
      { at: seat('bot2'), say: '찰리는 <b>야생마</b>를 놓았어요: 남이 찰리를 볼 때 거리 +1 → 이제 거리 2 (리볼버라 아직 닿아요). 반대로 <b>조준경</b>은 내가 볼 때 -1. 그리고 찰리는 나를 쏜 <b>브라보</b>를 쐈어요!', next: true },
      { at: '#bg-seats', say: '정리해 봐요. 나를 쏜 알파 · 브라보 = <b>무법자</b> 둘! 4명 판엔 부관이 없으니, 무법자를 쏜 찰리는 <b>배신자</b>예요. 배신자는 처음엔 보안관 편인 척해요 → 무법자부터!', next: true },
      { at: '#bg-hand .k-beer', say: '다시 내 차례 — 카드 2장을 가져왔어요. 먼저 <b>맥주</b>로 생명력을 채워요. 맥주를 남겨 두면 쓰러지기 직전에 저절로 마셔서 버텨요 (셋 이상 살아 있을 때).',
        allow: (a, s) => (a.t === 'play' && kind(s, a.card) === 'beer') || no('먼저 맥주를 마셔 생명력을 채워요!'),
        demo: s => ({ t: 'play', card: cid(s, 'beer') }),
        until: (v, s) => me(s).hp >= me(s).max, wait: 1000 },
      { at: () => ($('#bg-hand .bg-card.sel') || $('#bg-me .bg-tag.used') ? $(seat('bot1')) : $('#bg-hand .bg-card.k-bang')),   // 고르면 · 쏜 뒤(뱅! 사용함)엔 브라보 자리
        click: `${seat('bot1')}.target, #scr-bang:not(:has(#bg-me .bg-tag.used)) #bg-hand:not(:has(.sel)) .bg-card.k-bang.live`,
        say: '<b>뱅!</b>을 누르고 → 빛나는 <b>브라보</b> 자리를 눌러 쏘세요. 생명력이 줄어든 무법자부터 노려요. 리볼버 덕분에 맞은편에도 닿아요!',
        allow: (a, s) => {
          if (a.t === 'play' && kind(s, a.card) === 'bang') return a.target === 'bot1' || no(a.target === 'bot0' ? '알파도 무법자지만, 생명력이 줄어든 브라보부터 노려요!' : '찰리는 무법자를 쏜 배신자예요. 지금은 무법자 브라보를 노려요!');
          return no('뱅!을 누르고 브라보를 노려 봐요!');
        },
        demo: s => ({ t: 'play', card: cid(s, 'bang'), target: 'bot1' }),
        bots: true, until: (v, s) => P(s, 'bot1').hp <= 2 && W(s, 'play', 'me'), wait: 1600 },
      { at: '#bg-me .bg-tag', say: '명중! 브라보는 생명력 2. 뱅!은 <b>차례에 한 번</b>뿐이라 「사용함」이 됐어요. 무법자를 쓰러뜨리면 현상금으로 카드 3장! 다음 차례에 또 노려요.', next: true },
      { say: '다른 역할일 땐? <b>무법자</b>: 보안관만 집중해서 쏴요. <b>배신자</b>: 처음엔 보안관을 도와 무법자를 줄이고 마지막에 1:1. <b>부관</b>(5명부터): 보안관을 지켜요. 보안관은 부관이 누군지 몰라요!', next: true },
    ],
    done: '역할과 목표 · 거리와 사정거리 · 뱅!과 빗나감! · 맥주 · 앞에 놓는 카드 · 카드 버리기 · 누가 적인지 읽기까지 해 봤어요. 이어서 하면 남은 카드로 계속해요 — <b>야생마</b>는 바로 내려놓고, <b>감옥</b>은 무법자에게!',
  });
})();
