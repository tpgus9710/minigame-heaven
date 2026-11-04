/* 🀫 러미 타일 따라 하기 — 정해 둔 타일로 AI 1명과 한 판 (차례 시간 없음, AI가 먼저)
 *  타일 번호 = 색(빨강 0 · 파랑 1 · 주황 2 · 검정 3) × 26 + 벌(0 · 1) × 13 + 숫자 - 1, 조커 104 · 105  (public/js/shared/rummi-core.js)
 *   내 패: 파랑 4-5-6 · 빨강/주황/검정 3 (런 15 + 그룹 9 = 24점 → 첫 등록 못 함) · 검정 5 · 빨강 9 · 주황 9
 *          + 검정 2 · 주황 13 (끝난 뒤 바로 붙일 곳이 생겨요) · 빨강 12 · 파랑 11 · 주황 1
 *   AI 패: 검정 6-7-8-9 · 빨강/파랑/주황 2 · 파랑 3 · 주황 10-11-12 · 빨강 13 · 파랑 12 · 검정 11
 *   더미(뽑는 순서): 조커(나) → 빨강 7(AI) → 파랑 1(AI) → 나머지는 섞인 그대로
 *   흐름: AI 첫 등록(검정 6-9 런 + 2 그룹 = 36) → 나 24점이라 뽑기(조커) → AI 뽑기
 *        → 나 첫 등록 파랑 4-5-6-조커 + 3 그룹 = 31 → AI가 내 3 그룹에 파랑 3 → 나 검정 5를 런에 붙이기
 *        → AI 주황 10-11-12 → 나 검정 9를 떼어 9 그룹(바닥 다시 짜기) → AI 뽑기 → 팁 (남은 타일 수 · 아껴 두기)
 *  타일 고르기 · 옮기기는 화면(rummi.js 의 RM.work)에서만 바뀌어요 → 빛나는 고리(guide)가 지금 작업판을 보고 다음에 누를 곳을 짚어 줘요.
 *  demo: 그 단계에서 사람이 보낼 행동 (머리 없는 재생 시험용 · null = 화면 안에서만 하는 단계) */
(() => {
  const T = (c, n, k = 0) => 'rbok'.indexOf(c) * 26 + k * 13 + n - 1, JK = 104;
  const B4 = T('b', 4), B5 = T('b', 5), B6 = T('b', 6), R3 = T('r', 3), O3 = T('o', 3), K3 = T('k', 3, 1);
  const K5 = T('k', 5), R9 = T('r', 9), O9 = T('o', 9);
  const ME = [B4, B5, B6, R3, O3, K3, K5, R9, O9, T('k', 2), T('o', 13), T('r', 12), T('b', 11), T('o', 1)];
  const K6 = T('k', 6), K7 = T('k', 7), K8 = T('k', 8), K9 = T('k', 9), R2 = T('r', 2), B2 = T('b', 2), O2 = T('o', 2), B3 = T('b', 3);
  const O10 = T('o', 10), O11 = T('o', 11), O12 = T('o', 12);
  const AI = [K6, K7, K8, K9, R2, B2, O2, B3, O10, O11, O12, T('r', 13), T('b', 12), T('k', 11)];
  const DRAW = [JK, T('r', 7), T('b', 1)];                       // 뽑는 순서 (더미 맨 뒤부터)
  /* 차례마다 만들 세트 (같은 차례 안에서는 앞 단계 것까지 함께) */
  const G_RUN = [B4, B5, B6, JK], G_MELD = [G_RUN, [R3, O3, K3]];
  const G_ADD = [[K5, K6, K7, K8, K9]], G_STEAL = [[R9, O9, K9]];

  const key = s => s.slice().sort((a, b) => a - b).join(',');
  const bag = sets => sets.map(key).sort().join('|');
  /** 이 차례를 마친 바닥: 지금 바닥에서 goal 타일을 빼고 goal 세트를 넣어요 (통째로 들어간 세트 자리는 그대로) */
  function goalTable(table, goal) {
    const used = new Set([].concat(...goal)), put = new Set(), out = [];
    for (const s of table) {
      const rest = s.filter(id => !used.has(id));
      if (rest.length) { out.push(rest); continue; }
      const gi = goal.findIndex(g => s.every(id => g.includes(id)));
      if (gi >= 0 && !put.has(gi)) { out.push(goal[gi].slice()); put.add(gi); }
    }
    goal.forEach((g, gi) => { if (!put.has(gi)) out.push(g.slice()); });
    return out;
  }
  const play = goal => s => ({ t: 'play', sets: goalTable(s.table, goal) });
  const plays = (goal, no) => (a, s) => (a.t === 'play' && bag(a.sets) === bag(goalTable(s.table, goal))) || no;

  /* ── 화면 쪽 (rummi.js 의 RM: work = 이번 차례 작업판, sel = 고른 타일) ── */
  const W = () => (typeof RM !== 'undefined' && RM.work && RM.v ? RM.work : null);
  const has = g => { const w = W(); return !!w && w.table.some(s => key(s) === key(g)); };
  const tileEl = id => $(`#scr-rummi .rt[data-id="${id}"]`);
  const setOf = id => { const t = $(`#rm-board .rt[data-id="${id}"]`); return t && t.closest('.rm-set'); };
  /** 빛나는 고리: 고를 타일 → 놓을 곳(화살표 · 새 세트) → 완료. 잘못 고른 타일은 다시 눌러 풀고, 꼬이면 내 패로 · 되돌리기 */
  function guide(goal, done) {
    const w = W(); if (!w) return null;
    const v = RM.v, todo = goal.find(g => !has(g));
    if (!todo) {
      const want = new Set(v.rack.filter(id => !goal.some(g => g.includes(id))));      // 패에 남아야 할 내 타일
      if (bag(w.table) === bag(goalTable(v.table, goal)) && key(w.rack) === key([...want])) return done ? $('#rm-bar [data-act=rmDone]') : null;
      const stray = [].concat(...w.table).find(id => want.has(id));
      if (stray != null) return RM.sel.has(stray) ? $('#rm-bar [data-act=rmToRack]') : tileEl(stray);
      return $('#rm-bar [data-act=rmReset]');
    }
    const need = new Set(todo);
    const extra = [...RM.sel].find(id => !need.has(id));
    if (extra != null) return tileEl(extra);
    let bi = -1;                                                   // 이미 모여 있는 부분 → 거기에 붙여요
    w.table.forEach((s, i) => { if (s.every(id => need.has(id)) && (bi < 0 || s.length > w.table[bi].length)) bi = i; });
    const base = new Set(bi >= 0 ? w.table[bi] : []);
    const pick = todo.find(id => !base.has(id) && !RM.sel.has(id));
    if (pick != null) return tileEl(pick);
    return bi >= 0 ? $(`#rm-board .rm-set[data-i="${bi}"] .rm-drop`) : $('#rm-board .rm-set.new');
  }
  /** 타일 고르기 · 옮기기는 화면 안에서만 다시 그려서, 이 단계 동안은 0.25초마다 다 됐는지 봐요 */
  function watch() {
    const run = Tutorial.run, i = run && run.i;
    if (!run || typeof RM === 'undefined' || typeof document === 'undefined') return;          // 화면이 있을 때만
    const t = setInterval(() => {
      if (Tutorial.run !== run || run.i !== i || !Tutorial.on) return clearInterval(t);
      try { Tutorial.painted(run.c); } catch (e) { clearInterval(t); }
    }, 250);
  }

  Tutorial.add('rummi', {
    title: '러미 타일',
    bots: 1, opts: { time: 0 }, seed: 21, botDelay: [1300, 1800],
    prepare(s) {
      const [me, ai] = s.players;
      const all = s.pool.concat(me.rack, ai.rack), used = new Set(ME.concat(AI, DRAW));
      me.rack = ME.slice(); ai.rack = AI.slice();
      s.pool = all.filter(id => !used.has(id)).concat(DRAW.slice().reverse());
      for (const p of s.players) Object.assign(p, { melded: false, score: 0, left: null });
      Object.assign(s, { table: [], turn: 1, turnNo: 1, turnStart: Date.now(), lastIds: [], lastBy: null, lastDraw: null, idle: 0, msg: `${ai.name} 님부터 시작해요.` });
    },
    /** AI 각본: 첫 등록 → 뽑기 → 내 3 그룹에 파랑 3 → 주황 10-11-12 → 뽑기 */
    bot(s) {
      if (s.turn !== 1) return undefined;
      const tb = () => s.table.map(x => x.slice());
      switch (s.turnNo) {
        case 1: return { t: 'play', sets: [[K6, K7, K8, K9], [R2, B2, O2]] };
        case 3: case 9: return { t: 'draw' };
        case 5: return { t: 'play', sets: tb().map(x => (x.includes(R3) ? x.concat(B3) : x)) };
        case 7: return { t: 'play', sets: tb().concat([[O10, O11, O12]]) };
      }
      return undefined;
    },
    steps: [
      { at: '#rm-rack', next: true,
        say: '러미 타일을 같이 해 봐요! 아래가 <b>내 타일 14개</b>예요. 3개 이상을 <b>세트</b>로 모아 바닥에 내려놓고, <b>먼저 다 내려놓으면</b> 이겨요.<br><small class="muted">타일은 1~13 숫자 · 4색 · 2벌씩 + 조커 2개 = 106개</small>' },
      { say: 'AI가 먼저 해요. 첫 수를 지켜보세요.', bots: true, until: (v, s) => s.players[1].melded && s.turn === 0, wait: 1500 },
      { at: () => setOf(K9), next: true,
        say: 'AI가 낸 <b>검정 6-7-8-9</b>는 <b>런</b>이에요. 같은 색 숫자가 빈틈없이 이어진 세트예요. 3개 이상이면 되고, 13 다음 1로는 못 이어져요.' },
      { at: () => setOf(R2), next: true,
        say: '<b>2 · 2 · 2</b>는 <b>그룹</b>이에요. 숫자는 같고 색은 모두 달라요. 같은 색이 두 장이면 안 되니까 4색 4개까지예요.' },
      { at: '#rm-rack', next: true,
        say: 'AI는 런 30점(6+7+8+9) + 그룹 6점 = <b>36점</b>으로 <b>첫 등록</b>을 했어요. 첫 등록은 <b>내 타일로만 30점 이상!</b> 내 패엔 파랑 4-5-6(15점)과 3 그룹(9점)뿐이라 24점… 모자라요.' },
      { at: '#rm-bar [data-act=rmDraw]', say: '낼 수 없을 땐(아끼고 싶을 때도) <b>뽑기</b>로 한 장 가져오고 차례를 넘겨요. 눌러 보세요!',
        allow: a => a.t === 'draw' || '이번엔 「뽑기」를 눌러 한 장 가져와 볼게요!', demo: { t: 'draw' },
        until: (v, s) => s.turn === 1 && s.players[0].rack.length === 15, wait: 900 },
      { say: 'AI 차례예요.', bots: true, until: (v, s) => s.turn === 0 && s.turnNo === 4, wait: 1200 },
      { at: '#rm-rack .rt.jk', next: true,
        say: '아까 가져온 타일은 <b>조커</b>예요! 어떤 숫자 · 색이든 대신할 수 있어요. 단, 끝날 때 손에 남으면 <b>30점 벌점</b>이에요.' },
      { at: () => guide([G_RUN]), enter: watch,
        say: '조커로 <b>파랑 4-5-6-7</b> 런을 만들어요. 빛나는 타일을 차례로 눌러 고르고 → <b>새 세트</b> 칸을 눌러요.',
        allow: () => '먼저 빛나는 타일을 골라 새 세트를 만들어 봐요!', demo: null, until: () => has(G_RUN), wait: 500 },
      { at: () => guide(G_MELD, true),
        say: '조커가 7 노릇을 해서 22점! 이번엔 <b>3 · 3 · 3</b>을 골라 새 세트로 → 22 + 9 = <b>31점</b>이 되면 <b>완료</b>!',
        allow: plays(G_MELD, '안내대로 파랑 런과 3 그룹만 내려놓아 볼까요? 꼬였으면 「되돌리기」!'), demo: play(G_MELD),
        until: (v, s) => s.players[0].melded && s.turn === 1, wait: 1200 },
      { say: '첫 등록 성공! 이제 AI 차례예요.', bots: true, until: (v, s) => s.turn === 0 && s.turnNo === 6, wait: 1400 },
      { at: () => setOf(R3), next: true,
        say: 'AI가 <b>내 3 그룹</b>에 파랑 3을 붙였어요! 바닥 세트는 누구 것도 아니라서, 등록한 다음엔 <b>아무 세트에나</b> 붙이고 고칠 수 있어요.' },
      { at: () => guide(G_ADD, true),
        say: '나도 붙여 볼까요? <b>검정 5</b>를 고르면 세트마다 끝에 <b>화살표</b>가 생겨요. 검정 런의 화살표를 눌러 5-6-7-8-9로 → <b>완료</b>!',
        allow: plays(G_ADD, '검정 5만 검정 런에 붙여 볼까요? 꼬였으면 「되돌리기」!'), demo: play(G_ADD),
        until: (v, s) => s.turnNo === 7, wait: 1000 },
      { say: 'AI 차례예요.', bots: true, until: (v, s) => s.turn === 0 && s.turnNo === 8, wait: 1400 },
      { at: () => setOf(K9), next: true,
        say: '핵심 기술 <b>바닥 다시 짜기</b>! 바닥 세트도 떼고 붙여 새로 짤 수 있어요. 차례 끝에 <b>모든 세트가 맞으면</b> OK. 4개 이상인 런은 끝을 떼어 가도 남고, 긴 런은 가운데에 같은 숫자를 끼워 둘로 나눠도 돼요.' },
      { at: () => guide(G_STEAL, true),
        say: '내 <b>빨강 9 · 주황 9</b>를 고르고, 바닥의 <b>검정 9</b>도 눌러 고른 뒤 <b>새 세트</b>! 9 그룹이 생기고 검정 5-6-7-8도 런으로 남아요 → <b>완료</b>!',
        allow: plays(G_STEAL, '빨강 9 · 주황 9와 바닥의 검정 9로 그룹을 만들어 볼까요? 꼬였으면 「되돌리기」!'), demo: play(G_STEAL),
        until: (v, s) => s.turnNo === 9, wait: 1200 },
      { say: '멋져요! AI 차례예요.', bots: true, until: (v, s) => s.turn === 0 && s.turnNo === 10, wait: 1200 },
      { at: '#rm-opps .rm-opp:not(.me)', next: true,
        say: v => `이름 옆 숫자는 <b>남은 타일 수</b>예요(AI ${v.players[1].count}개). 누가 1~2개만 남으면 곧 끝나요! 그럴 땐 <b>큰 숫자 · 조커</b>부터 털어서 벌점(남은 숫자 합)을 줄여요.` },
      { at: '#rm-rack', next: true,
        say: '꼭 다 낼 필요는 없어요. <b>바닥에 낸 타일은 상대도 써요</b>(AI가 내 3 그룹에 붙였죠?). 여러 세트에 쓰일 타일 · 런이 될 짝은 섣불리 깨지 말고, 다 된 세트도 낼 게 없을 때를 위해 아껴 둬도 좋아요.' },
    ],
    done: '런 · 그룹 · 30점 첫 등록 · 뽑기 · 조커 · 붙이기 · 바닥 다시 짜기까지 해 봤어요! 지금 내 패의 <b>검정 2</b>와 <b>주황 13</b>도 붙일 곳이 있어요. 이어서 쳐 볼까요?',
  });
})();
