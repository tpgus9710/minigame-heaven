/* =====================================================================
 *  🖍️ 그림 릴레이 규칙 (텔레스트레이션 방식) — 멀티 전용 3~10명, 봇 없음
 *  · 라운드마다 각자 스케치북 한 권을 받아요. 단어 카드(6개) + 주사위로 비밀 단어가 정해져요.
 *  · 모두 동시에 한 장씩 이어 가고, 한 장이 끝나면 스케치북이 옆 사람에게 넘어가요.
 *    단어를 받으면 그림으로 그리고, 그림을 받으면 무엇인지 맞혀 적어요.
 *    사람 수가 짝수면 주인이 먼저 자기 단어를 그리고, 홀수면 주인은 단어만 보고 다음 사람이 그림부터 시작해요.
 *    → 스케치북은 모든 사람을 한 번씩 거치고, 마지막 장은 늘 '맞히기'가 돼요.
 *  · 다 돌면 한 권씩 펼쳐 봐요. 원래 단어를 그대로 맞히면 맞힌 사람과 그 그림을 그린 사람이 +1점,
 *    좋아요(한 권에 한 장, 내 장은 못 눌러요) 하나에 +1점.
 *  그림은 논리 좌표 480×360 의 획 목록 [색, 굵기, x0, y0, dx1, dy1, …] (정수) 으로 주고받아요.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.RelayCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;

  /* ── 그림 규격 ── */
  const W = 480, H = 360;
  const COLORS = ['#1f2328', '#e5484d', '#f76b15', '#f5b800', '#2fa36b', '#1e7cf2', '#8b4fd0', '#9a5b34', '#fffdf6'];
  const ERASER = COLORS.length - 1;          // 지우개 = 종이색
  const SIZES = [3, 7, 16];
  const MAX_POINTS = 7000, MAX_STROKES = 800, MAX_TEXT = 20;   // 화면은 약 40KB 안에서 그리게 막아요 (서버 메시지 한도 64KB)
  const INTRO_MS = 9000;
  const revealMs = pages => Math.min(45000, 9000 + pages * 3000);

  /* ── 제시어 (그리기 재미있는 것 위주) ── */
  const WORDS = [...new Set(`
    강아지 고양이 기린 호랑이 사자 코끼리 원숭이 펭귄 토끼 거북이 오징어 문어 독수리 개구리 악어 하마 판다 캥거루 고래
    다람쥐 상어 해파리 공룡 낙타 부엉이 앵무새 돼지 젖소 얼룩말 고슴도치 달팽이 나비 꿀벌 거미 플라밍고 박쥐 불가사리
    코알라 공작새 물개 닭 병아리 지렁이 사슴 늑대 여우 뱀 게 새우
    피자 햄버거 떡볶이 김밥 라면 치킨 짜장면 초밥 아이스크림 케이크 바나나 수박 붕어빵 삼겹살 도넛 팝콘 비빔밥 핫도그
    계란프라이 솜사탕 파인애플 옥수수 당근 샌드위치 와플 만두 감자튀김 탕후루 군고구마 포도 딸기 사탕 생일케이크
    자전거 비행기 기차 자동차 오토바이 헬리콥터 로켓 지하철 버스 택시 경찰차 소방차 잠수함 열기구 트랙터 구급차
    스케이트보드 유모차 해적선 굴착기 우주선 돛단배
    학교 병원 도서관 영화관 놀이공원 동물원 수족관 바닷가 편의점 공항 수영장 경찰서 찜질방 사막 무인도 화산
    피라미드 등대 성 정글 남극 시골집
    노트북 스마트폰 우산 시계 안경 모자 가방 냉장고 선풍기 피아노 기타 의자 침대 칫솔 거울 카메라 로봇 풍선 선물상자
    왕관 열쇠 전구 촛불 망원경 돋보기 나침반 텐트 우체통 신호등 눈사람 허수아비 팽이 트로피 마이크 헤드폰 리모컨
    지구본 빗자루 세탁기 화분 자석 시소 그네 미끄럼틀 축구공 농구공 장갑 양말 넥타이 운동화 가위 연필 지우개
    의사 소방관 요리사 선생님 가수 화가 우주비행사 축구선수 마술사 농부 해적 닌자 마녀 산타 인어 외계인 좀비 미라
    유령 천사 공주 임금님 기사 광대 경호원 발레리나
    줄다리기 눈싸움 낚시 번지점프 줄넘기 서핑 스키 볼링 양치질 샤워 낮잠 생일파티 결혼식 소풍 이사 등산 숨바꼭질
    가위바위보 비눗방울 불꽃놀이 롤러코스터 회전목마 대관람차 팔씨름 물구나무 요가 셀카 노래방 캠프파이어 연날리기
    줄서기 고백 달리기 시합 다이어트 야근 지각
    무지개 번개 태풍 눈꽃 해바라기 선인장 단풍잎 폭포 빙산 오로라 보름달 별똥별 지진 토네이도 일출 소나기 눈보라 구름
    콧물 재채기 방귀 딸꾹질 하품 윙크 코골이 대머리 콧수염 근육맨 이빨 배꼽
    블랙홀 UFO 타임머신 보물지도 보물상자 마법지팡이 드래곤 유니콘 로봇청소기 자판기 크리스마스트리 호박등 거대괴물
    투명인간 도깨비 오아시스 미로 시간여행 백만장자
  `.trim().split(/\s+/))];

  const P = (s, id) => s.players.find(p => p.id === id);
  const present = s => s.players.filter(p => !p.left);
  const mod = (a, n) => ((a % n) + n) % n;
  /** 정답 비교용: 띄어쓰기 · 문장부호 · 대소문자 무시 */
  const norm = t => String(t == null ? '' : t).toLowerCase().replace(/[\s.,!?~'"`·\-_()[\]]+/g, '');
  const cleanText = t => String(t == null ? '' : t).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  const int = (v, lo, hi) => { v = Math.round(+v); return v >= lo && v <= hi ? v : v > hi ? hi : lo; };

  /** 받은 그림 정리: 범위를 벗어나거나 너무 큰 그림은 잘라내요 */
  function cleanDrawing(d) {
    const out = [];
    if (!Array.isArray(d)) return out;
    let pts = 0;
    for (const st of d) {
      if (out.length >= MAX_STROKES || pts >= MAX_POINTS) break;
      if (!Array.isArray(st) || st.length < 4) continue;
      let x = int(st[2], 0, W), y = int(st[3], 0, H);
      const o = [int(st[0], 0, COLORS.length - 1), int(st[1], 0, SIZES.length - 1), x, y];
      pts++;
      for (let i = 4; i + 1 < st.length && pts < MAX_POINTS; i += 2) {
        const nx = int(x + int(st[i], -W, W), 0, W), ny = int(y + int(st[i + 1], -H, H), 0, H);
        o.push(nx - x, ny - y); x = nx; y = ny; pts++;
      }
      out.push(o);
    }
    return out;
  }
  /** 지우개만 쓴 그림은 빈 그림 */
  const hasInk = d => d.some(st => st[0] !== ERASER);

  function setup(players, rnd, opts) {
    opts = opts || {};
    const N = players.length;
    const s = {
      rnd, sec: [45, 60, 90].includes(+opts.relaySec) ? +opts.relaySec : 60, rounds: [1, 2].includes(+opts.relayRounds) ? +opts.relayRounds : 1,
      N, offset: N % 2 === 0 ? 0 : 1, steps: N % 2 === 0 ? N : N - 1,
      order: players.map(p => p.id),
      players: players.map(p => ({ id: p.id, name: p.name, score: 0, likes: 0, exact: 0, left: false })),
      pool: shuffle(WORDS, rnd), round: 0, phase: 'intro', step: 0, deadline: 0, dur: 0,
      books: [], ready: {}, rev: null, stats: { books: 0, arrived: 0, best: null },
      log: [], seq: 0, msg: '', over: false,
    };
    startRound(s);
    return s;
  }
  const setDeadline = (s, ms) => { s.dur = ms; s.deadline = Date.now() + ms; };

  function startRound(s) {
    s.round++;
    if (s.pool.length < s.N * 6) s.pool = shuffle(WORDS, s.rnd);
    s.books = s.order.map(id => {
      const card = s.pool.splice(0, 6), die = 1 + Math.floor(s.rnd() * 6);
      return { owner: id, card, die, word: card[die - 1], pages: [], likes: {}, scored: false };
    });
    s.phase = 'intro'; s.ready = {}; s.step = 0; s.rev = null;
    setDeadline(s, INTRO_MS);
    s.msg = s.rounds > 1 ? `${s.round}라운드 — 주사위를 굴려 내 스케치북의 비밀 단어를 정해요!` : '주사위를 굴려 내 스케치북의 비밀 단어를 정해요!';
    log(s, { t: 'round', round: s.round });
  }
  function startPlay(s) { s.step = 0; startStep(s); }
  function startStep(s) {
    s.phase = 'play';
    setDeadline(s, s.sec * 1000);
    s.msg = s.step === 0 ? '받은 스케치북을 이어 가요! 단어는 그림으로, 그림은 단어로.' : `${s.step + 1}번째 장 — 스케치북이 옆으로 넘어왔어요!`;
    log(s, { t: 'step', step: s.step });
    if (!pendingPlay(s).length) endStep(s);
  }

  /* ── 이번 장에 누가 어느 스케치북을 맡는지 ── */
  const bookIdxOf = (s, id) => { const j = s.order.indexOf(id); return j < 0 ? -1 : mod(j - s.step - s.offset, s.N); };
  const pageAt = (b, step) => b.pages.find(p => p.step === step);
  /** 스케치북의 다음 장이 받는 내용 (앞사람이 비워 두면 그 전 단어를 이어서) */
  function inputOf(b) {
    const last = b.pages[b.pages.length - 1];
    if (!last) return { type: 'draw', word: b.word };
    if (last.type === 'draw') return { type: 'guess', d: last.d, empty: last.empty, from: last.by };
    if (last.text) return { type: 'draw', word: last.text, from: last.by };
    for (let i = b.pages.length - 2; i >= 0; i--) if (b.pages[i].type === 'guess' && b.pages[i].text) return { type: 'draw', word: b.pages[i].text, fallback: true, from: last.by };
    return { type: 'draw', word: b.word, fallback: true, from: last.by };
  }
  function taskOf(s, id) {
    if (s.phase !== 'play') return null;
    const p = P(s, id);
    if (!p || p.left) return null;
    const bi = bookIdxOf(s, id);
    if (bi < 0) return null;
    const b = s.books[bi];
    return { bi, b, done: !!pageAt(b, s.step), input: inputOf(b) };
  }
  const pendingPlay = s => present(s).filter(p => { const t = taskOf(s, p.id); return t && !t.done; }).map(p => p.id);

  /** 시간이 다 되면 아직 안 낸 사람은 빈 장으로 */
  function endStep(s) {
    for (const p of present(s)) {
      const t = taskOf(s, p.id);
      if (t && !t.done) t.b.pages.push(t.input.type === 'draw'
        ? { type: 'draw', by: p.id, step: s.step, d: [], empty: true, late: true }
        : { type: 'guess', by: p.id, step: s.step, text: '', empty: true, late: true });
    }
    s.step++;
    if (s.step >= s.steps) startReveal(s); else startStep(s);
  }

  /* ── 펼쳐 보기 ── */
  const needNext = s => Math.floor(present(s).length / 2) + 1;
  const nextVotes = s => Object.keys(s.rev.next).filter(id => { const p = P(s, id); return p && !p.left; }).length;
  function startReveal(s) { s.phase = 'reveal'; s.rev = { book: 0, next: {} }; openBook(s); }
  function openBook(s) {
    const b = s.books[s.rev.book];
    s.rev.next = {};
    setDeadline(s, revealMs(b.pages.length));
    if (!b.scored) {
      b.scored = true;
      b.pages.forEach((pg, i) => {
        if (pg.type !== 'guess' || !pg.text || norm(pg.text) !== norm(b.word)) return;
        pg.exact = true;
        const g = P(s, pg.by); if (g) { g.score++; g.exact++; }
        const prev = b.pages[i - 1];
        if (prev && prev.type === 'draw' && !prev.empty) { prev.helped = true; const d = P(s, prev.by); if (d) { d.score++; d.exact++; } }
      });
      const last = b.pages[b.pages.length - 1];
      s.stats.books++;
      if (last && last.exact) s.stats.arrived++;
    }
    const owner = P(s, b.owner);
    s.msg = `${owner.name} 님의 스케치북을 펼쳐요! 처음 단어는 무엇이었을까요?`;
    log(s, { t: 'book', book: s.rev.book });
  }
  function closeBook(s) {
    const b = s.books[s.rev.book], cnt = {};
    Object.values(b.likes).forEach(i => { cnt[i] = (cnt[i] || 0) + 1; });
    for (const [i, n] of Object.entries(cnt)) {
      const pg = b.pages[i];
      if (pg && (!s.stats.best || n > s.stats.best.likes)) s.stats.best = { likes: n, by: pg.by, type: pg.type, word: b.word, text: pg.text || '' };
    }
  }
  function nextBook(s) {
    closeBook(s);
    s.rev.book++;
    if (s.rev.book < s.books.length) return openBook(s);
    if (s.round < s.rounds) return startRound(s);
    finish(s);
  }
  function finish(s) { s.phase = 'over'; s.over = true; s.deadline = 0; s.dur = 0; s.msg = '모든 스케치북을 다 펼쳐 봤어요!'; log(s, { t: 'over' }); }

  function like(s, id, a) {
    // 누를 때마다 스케치북 전체를 모두에게 다시 보내니까, 연타는 1초에 2번 정도로 제한 (몇 번은 바로 눌러도 괜찮아요)
    const now = Date.now(), bk = (s.likeBucket = s.likeBucket || {}), cur0 = bk[id] || { n: 4, t: now };
    cur0.n = Math.min(4, cur0.n + (now - cur0.t) / 500); cur0.t = now;
    if (cur0.n < 1) { bk[id] = cur0; return '조금 천천히 눌러 주세요.'; }
    cur0.n -= 1; bk[id] = cur0;
    const b = s.books[s.rev.book], idx = int(a.page, -1, 99), pg = b.pages[idx];
    if (!pg) return '좋아요를 누를 장을 골라 주세요.';
    if (pg.by === id) return '내가 그리거나 쓴 장에는 좋아요를 누를 수 없어요.';
    if (pg.empty) return '빈 장에는 좋아요를 누를 수 없어요.';
    const prev = b.likes[id];
    if (prev != null) { const pp = b.pages[prev], a0 = pp && P(s, pp.by); if (a0) { a0.score--; a0.likes--; } delete b.likes[id]; }
    if (prev !== idx) { b.likes[id] = idx; const a1 = P(s, pg.by); if (a1) { a1.score++; a1.likes++; } }
  }

  function act(s, id, a) {
    const p = P(s, id);
    if (!p) return '이번 판 참가자가 아니에요. 구경만 할 수 있어요.';
    if (s.over) return '게임이 끝났어요.';
    if (p.left) return '이미 나간 사람이에요.';
    switch (a.t) {
      case 'ready':
        if (s.phase !== 'intro') return '지금은 준비 단계가 아니에요.';
        s.ready[id] = true;
        if (!pending(s).length) startPlay(s);
        return;
      case 'submit': {
        const t = taskOf(s, id);
        if (!t) return '지금은 제출할 차례가 아니에요.';
        if (+a.round !== s.round || +a.step !== s.step) return '이미 다음 장으로 넘어갔어요.';
        if (t.done) return '이미 제출했어요.';
        if (t.input.type === 'draw') {
          if (!Array.isArray(a.d)) return '그림을 그려서 제출해 주세요.';
          const d = cleanDrawing(a.d);
          t.b.pages.push({ type: 'draw', by: id, step: s.step, d, empty: !hasInk(d) });
        } else {
          if (typeof a.text !== 'string') return '정답을 적어서 제출해 주세요.';
          const text = cleanText(a.text);
          t.b.pages.push({ type: 'guess', by: id, step: s.step, text, empty: !text });
        }
        log(s, { t: 'submit', id });
        if (!pendingPlay(s).length) endStep(s);
        return;
      }
      case 'like':
        if (s.phase !== 'reveal') return '스케치북을 펼쳐 볼 때만 누를 수 있어요.';
        return like(s, id, a);
      case 'next':
        if (s.phase !== 'reveal') return '지금은 넘길 수 없어요.';
        if (a.book != null && +a.book !== s.rev.book) return;      // 앞 책에 늦게 도착한 표는 무시
        s.rev.next[id] = true;
        if (nextVotes(s) >= needNext(s)) nextBook(s);
        return;
      default: return '할 수 없는 행동이에요.';
    }
  }
  /** 좋아요는 차례와 상관없이 언제든 (단계를 넘기지 않아요) */
  function free(s, id, a) {
    const p = P(s, id);
    return !!(a && a.t === 'like' && s.phase === 'reveal' && p && !p.left && !s.over);
  }
  function pending(s) {
    if (s.over) return [];
    if (s.phase === 'intro') return present(s).filter(p => !s.ready[p.id]).map(p => p.id);
    if (s.phase === 'play') return pendingPlay(s);
    if (s.phase === 'reveal') return present(s).filter(p => !s.rev.next[p.id]).map(p => p.id);
    return [];
  }
  function timeup(s) {
    if (s.over || Date.now() < s.deadline - 250) return;   // 이미 넘어간 단계의 늦은 타이머는 무시
    if (s.phase === 'intro') startPlay(s);
    else if (s.phase === 'play') endStep(s);
    else if (s.phase === 'reveal') nextBook(s);
  }
  /** 나간 사람: 앞으로 그 사람 차례의 장은 건너뛰고, 다음 사람이 앞 장을 이어받아요 */
  function drop(s, id) {
    const p = P(s, id);
    if (!p || p.left || s.over) return;
    p.left = true;
    log(s, { t: 'left', id });
    if (present(s).length < 2) return finish(s);
    if (s.phase === 'intro' && !pending(s).length) startPlay(s);
    else if (s.phase === 'play' && !pendingPlay(s).length) endStep(s);
    else if (s.phase === 'reveal' && nextVotes(s) >= needNext(s)) nextBook(s);
  }

  function view(s, viewer) {
    const me = P(s, viewer), name = id => (P(s, id) || {}).name || '?';
    const v = {
      phase: s.phase, round: s.round, rounds: s.rounds, step: s.step, steps: s.steps, n: s.N, sec: s.sec, seq: s.seq, msg: s.msg, over: s.over,
      leftMs: s.deadline ? Math.max(0, s.deadline - Date.now()) : null, durMs: s.dur || null,
      players: s.players.map(p => {
        let done = false;
        if (s.phase === 'intro') done = !!s.ready[p.id];
        else if (s.phase === 'play') { const t = taskOf(s, p.id); done = !t || t.done; }
        else if (s.phase === 'reveal') done = !!s.rev.next[p.id];
        return { id: p.id, name: p.name, score: p.score, left: p.left, done };
      }),
      my: null, book: null, spectator: !me,
    };
    if (me && !me.left && s.phase === 'intro') {
      const b = s.books[s.order.indexOf(viewer)];
      v.my = { card: b.card, die: b.die, word: b.word, ownerFirst: s.offset === 0, ready: !!s.ready[viewer] };
    }
    if (me && s.phase === 'play') {
      const t = taskOf(s, viewer);
      if (t) {
        v.my = { done: t.done, owner: t.b.owner, ownerName: name(t.b.owner), page: t.b.pages.filter(pg => pg.step < s.step).length + 1 };
        if (!t.done) Object.assign(v.my, { type: t.input.type, word: t.input.type === 'draw' ? t.input.word : null, d: t.input.type === 'guess' ? t.input.d : null,
          empty: !!t.input.empty, fallback: !!t.input.fallback, fromName: t.input.from ? name(t.input.from) : null });
        else { const pg = pageAt(t.b, s.step); v.my.mine = pg.type === 'draw' ? { type: 'draw', d: pg.d, empty: pg.empty } : { type: 'guess', text: pg.text }; }
      }
    }
    if (s.phase === 'reveal' && s.rev) {
      const b = s.books[s.rev.book], cnt = {};
      Object.values(b.likes).forEach(i => { cnt[i] = (cnt[i] || 0) + 1; });
      v.book = {
        idx: s.rev.book, total: s.books.length, owner: b.owner, ownerName: name(b.owner), word: b.word, die: b.die,
        pages: b.pages.map((pg, i) => ({ i, type: pg.type, by: pg.by, name: name(pg.by), d: pg.type === 'draw' ? pg.d : null, text: pg.type === 'guess' ? pg.text : null,
          empty: !!pg.empty, late: !!pg.late, exact: !!pg.exact, helped: !!pg.helped, likes: cnt[i] || 0 })),
        myLike: me && b.likes[viewer] != null ? b.likes[viewer] : null,
        nextN: nextVotes(s), needN: needNext(s), voted: !!s.rev.next[viewer],
      };
    }
    if (s.over) v.final = { books: s.stats.books, arrived: s.stats.arrived };
    return v;
  }

  function result(s) {
    if (!s.over) return null;
    const rank = s.players.slice().sort((a, b) => b.score - a.score || b.likes - a.likes || b.exact - a.exact);
    const top = rank[0], best = s.stats.best, name = id => (P(s, id) || {}).name || '?';
    const lines = [`스케치북 ${s.stats.books}권 중 ${s.stats.arrived}권이 원래 단어 그대로 돌아왔어요.`];
    if (best) lines.push(`좋아요를 가장 많이 받은 장: ${name(best.by)} 님의 ${best.type === 'draw' ? '그림' : `답 "${best.text}"`} (제시어 ${best.word}, ♥ ${best.likes})`);
    return {
      title: top && top.score > 0 ? `🖍️ ${top.name} 님이 최고의 릴레이 주자!` : '🖍️ 그림 릴레이 끝!',
      subtitle: '정답 그대로 +1 · 맞히게 한 그림 +1 · 좋아요 +1',
      lines,
      ranking: rank.map(p => ({ id: p.id, value: `${p.score}점 (좋아요 ${p.likes} · 정답 ${p.exact})`, score: p.score })),
    };
  }

  return {
    meta: {
      name: '그림 릴레이', min: 3, max: 10, bots: false, turnSec: 0,
      options: [
        { key: 'relaySec', label: '⏱️ 한 장 시간', def: 60, values: [[45, '45초'], [60, '60초'], [90, '90초']] },
        { key: 'relayRounds', label: '🔁 라운드', def: 1, values: [[1, '1라운드'], [2, '2라운드']] },
      ],
    },
    W, H, COLORS, ERASER, SIZES, MAX_POINTS, MAX_STROKES, MAX_TEXT, WORDS, norm, cleanDrawing,
    setup, act, free, view, result, pending, drop, timeup,
    deadline: s => (s.over ? null : s.deadline),
    ai: () => null,
    /** 그리고 맞히는 동안은 채팅을 막아요 (정답을 말해 버리지 않게) */
    chatRoute: s => (s.phase === 'play' ? 'none' : 'all'),
  };
});
