/* =====================================================================
 *  ♞ 체스 화면 (규칙: shared/chess-core.js)
 *  말을 누르면 갈 수 있는 칸이 점으로 보여요 → 그 칸을 누르면 이동. 끌어다 놓아도 돼요.
 *  폰이 끝까지 가면 퀸 · 룩 · 비숍 · 나이트 중에서 골라요. 내 색이 항상 아래쪽이에요.
 *  말 그림: Cburnett (Wikimedia Commons, CC BY-SA 3.0) — public/vendor/chess-pieces-1/cburnett.svg
 * ===================================================================== */
makeScreen('chess', {
  title: '♞ 체스', status: '말을 누르면 갈 수 있는 칸이 보여요. 끌어서 옮겨도 돼요. 상대 킹을 체크메이트하면 승리!',
  stats: [],
  body: `<div class="mode-row" id="ch-solo"><span class="muted small">AI 실력</span>
      <button class="seg-btn" data-act="chSolo" data-level="easy">쉬움</button><button class="seg-btn on" data-act="chSolo" data-level="normal">보통</button><button class="seg-btn" data-act="chSolo" data-level="hard">어려움</button>
      <span class="muted small ch-gap">내 색</span><button class="seg-btn on" data-act="chColor" data-color="white">백<span class="ch-long"> (먼저)</span></button><button class="seg-btn" data-act="chColor" data-color="black">흑</button><button class="seg-btn" data-act="chColor" data-color="random">랜덤</button></div>
    <div class="ch-wrap">
      <div class="ch-main">
        <div class="ch-bar" id="ch-top"></div>
        <div class="ch-board" id="ch-board"></div>
        <div class="ch-bar me" id="ch-bot"></div>
      </div>
      <div class="ch-side">
        <div class="ch-msg" id="ch-msg"></div>
        <div class="ch-offer hidden" id="ch-offer"></div>
        <div class="ch-moves" id="ch-moves"></div>
        <div class="ch-btns" id="ch-btns"></div>
      </div>
    </div>`,
});

const CH = {
  level: 'normal', color: 'white', sel: null, press: null, drag: null, promo: null, flip: false, gen: null, lastSeq: -1, clockT: null,
  VALUE: { q: 9, r: 5, b: 3, n: 3, p: 1 },
  /** 말 그림 묶음을 한 번만 받아서 페이지에 넣어요 (<use href="#cp-wk">) */
  sprite() {
    if (this.spriteP) return this.spriteP;
    this.spriteP = fetch('/vendor/chess-pieces-1/cburnett.svg').then(r => r.text()).then(t => {
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = t.slice(t.indexOf('<svg'));
      document.body.append(box);
      if (this.v) this.paint();
    }).catch(() => { this.spriteP = null; });
    return this.spriteP;
  },
  pc(code, cls = '') {
    if (!code) return '';
    const id = (code === code.toUpperCase() ? 'w' : 'b') + code.toLowerCase();
    return `<svg class="chp ${cls}" viewBox="0 0 40 40" aria-label="${id}"><use href="#cp-${id}"/></svg>`;
  },
  idx(d) { return this.flip ? 63 - d : d; },       // 화면 칸 → 판 칸
  build() {
    const b = $('#ch-board');
    b.innerHTML = Array.from({ length: 64 }, (_, d) => `<div class="sq ${((d >> 3) + (d & 7)) % 2 ? 'dk' : 'lt'}" data-d="${d}"></div>`).join('') + '<div class="ch-promo hidden" id="ch-promo"></div>';
    b.addEventListener('pointerdown', e => this.down(e));
    b.addEventListener('pointermove', e => this.move(e));
    b.addEventListener('pointerup', e => this.up(e));
    b.addEventListener('pointercancel', () => this.cancel());
    b.addEventListener('contextmenu', e => e.preventDefault());
    this.built = true;
  },

  render(v, ctx, prev) {
    if (!this.built) this.build();
    this.sprite();
    if (!prev || this.gen !== Table.cur) { this.gen = Table.cur; this.sel = null; this.promo = null; this.lastSeq = -1; this.lastMoves = 0; this.startClock(); }
    this.v = v; this.ctx = ctx;
    $('#ch-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    this.flip = v.myColor === 'b';
    this.legal = new Map();
    for (const [f, t, pr] of v.legal) { const l = this.legal.get(f) || []; if (!l.some(x => x.to === t)) l.push({ to: t, promo: !!pr }); this.legal.set(f, l); }
    if (this.sel != null && !this.legal.has(this.sel)) this.sel = null;
    if (v.moves.length !== this.lastMoves) {                       // 새 수: 소리 · 움직임
      const san = v.moves[v.moves.length - 1] || '';
      if (this.lastMoves && v.moves.length > this.lastMoves) Sound.play(/[x+#]/.test(san) ? 'pop' : 'tap');
      this.animate = v.moves.length > this.lastMoves && this.lastMoves > 0 ? v.last : null;
      this.lastMoves = v.moves.length; this.sel = null; this.promo = null;
    }
    this.paint();
    this.fit();
    if (!this.watching) this.watch();
  },
  /** 판 크기를 남은 높이 · 너비에 맞춰요 (core.js fitSquare) */
  fit() { fitSquare($('#scr-chess'), $('#scr-chess .ch-wrap'), '--sz', 232, 1000); },
  watch() {
    this.watching = true;
    const again = () => { if (S.screen !== 'chess' || !this.v) return; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this.fit()); };
    window.addEventListener('resize', again);
    window.addEventListener('orientationchange', () => setTimeout(again, 250));
    if (typeof ResizeObserver !== 'undefined') { let w = 0; new ResizeObserver(() => { const x = $('#scr-chess .ch-wrap').clientWidth; if (Math.abs(x - w) > 1) { w = x; again(); } }).observe($('#scr-chess .ch-wrap')); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  },
  paint() {
    const v = this.v, ctx = this.ctx; if (!v) return;
    const mine = !!v.turnId && v.turnId === ctx.me;
    const targets = new Map();
    if (this.sel != null) for (const m of this.legal.get(this.sel) || []) targets.set(m.to, m);
    const sqs = $$('#ch-board .sq');
    const files = 'abcdefgh';
    sqs.forEach((el, d) => {
      const i = this.idx(d), code = v.board[i];
      const cls = [((d >> 3) + (d & 7)) % 2 ? 'dk' : 'lt'];
      if (v.last && (v.last.f === i || v.last.t === i)) cls.push('last');
      if (v.check === i) cls.push('check');
      if (this.sel === i) cls.push('sel');
      if (targets.has(i)) cls.push(code ? 'cap' : 'dot');
      if (mine && this.legal.has(i)) cls.push('mov');
      el.className = 'sq ' + cls.join(' ');
      const coord = ((d & 7) === 0 ? `<i class="rk">${8 - (i >> 3)}</i>` : '') + ((d >> 3) === 7 ? `<i class="fl">${files[i & 7]}</i>` : '');
      el.innerHTML = coord + this.pc(code, this.drag && this.drag.from === i ? 'lift' : '');
    });
    if (this.animate) {                                             // 방금 둔 말이 미끄러지듯 움직여요
      const { f, t } = this.animate; this.animate = null;
      const df = this.flip ? 63 - f : f, dt = this.flip ? 63 - t : t;
      const el = sqs[dt] && sqs[dt].querySelector('.chp');
      if (el) {
        el.style.transition = 'none';
        el.style.transform = `translate(${((df & 7) - (dt & 7)) * 100}%, ${((df >> 3) - (dt >> 3)) * 100}%)`;
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = 'transform .18s ease'; el.style.transform = ''; }));
      }
    }
    // 위 · 아래 막대: 상대가 위, 내가 아래 (관전 · 싱글 AI끼리는 백이 아래)
    const meP = v.players.find(p => p.id === ctx.me);
    const bottom = meP || v.players.find(p => p.color === 'w'), top = v.players.find(p => p !== bottom);
    $('#ch-top').innerHTML = this.bar(top, v, false);
    $('#ch-bot').innerHTML = this.bar(bottom, v, true);
    this.tickClock();
    // 안내 · 무승부 제안
    $('#ch-msg').innerHTML = `${v.over ? '' : mine ? '<b class="ch-turn">내 차례</b> ' : ''}${esc(v.msg)}`;
    const off = $('#ch-offer');
    const offered = v.drawOffer && !v.over;
    off.classList.toggle('hidden', !offered);
    if (offered) {
      off.innerHTML = v.drawOffer === ctx.me ? `${icon('flag')}무승부를 제안했어요. 상대의 답을 기다려요.`
        : `${icon('flag')}<span>${esc((v.players.find(p => p.id === v.drawOffer) || {}).name || '상대')} 님이 무승부를 제안했어요.</span><button class="btn sm good" data-act="chDrawYes">받기</button><button class="btn sm ghost" data-act="chDrawNo">거절</button>`;
    }
    // 기보
    const pairs = [];
    for (let k = 0; k < v.moves.length; k += 2) pairs.push(`<span class="mn">${k / 2 + 1}.</span><span class="mv${k === v.moves.length - 1 ? ' now' : ''}">${esc(v.moves[k])}</span><span class="mv${k + 1 === v.moves.length - 1 ? ' now' : ''}">${esc(v.moves[k + 1] || '')}</span>`);
    const mv = $('#ch-moves');
    mv.innerHTML = pairs.length ? pairs.join('') : '<span class="muted small ch-empty">아직 둔 수가 없어요</span>';
    mv.scrollTop = mv.scrollHeight;
    // 버튼
    const playing = !!meP && !v.over;
    $('#ch-btns').innerHTML = [
      playing && ctx.mode === 'solo' && v.undo ? `<button class="btn sm ghost" data-act="chUndo" title="무르기 (내 마지막 수를 되돌려요)">${icon('arrow-back-up')}<span class="ch-bt">무르기</span></button>` : '',
      playing && v.drawOffer !== ctx.me && !(v.drawOffer && v.drawOffer !== ctx.me) ? `<button class="btn sm ghost" data-act="chDraw" title="무승부 제안">${icon('flag')}<span class="ch-bt">무승부<span class="ch-long"> 제안</span></span></button>` : '',
      playing ? `<button class="btn sm ghost bad-t" data-act="chResign">${icon('flag-3')}기권</button>` : '',
    ].join('');
    // 프로모션 고르기
    const pr = $('#ch-promo');
    if (this.promo) {
      const col = v.myColor === 'b' ? 'b' : 'w', d = this.flip ? 63 - this.promo.to : this.promo.to;
      pr.style.setProperty('--x', d & 7);
      pr.innerHTML = '<b>어떤 말로 바꿀까요?</b>' + ['q', 'r', 'b', 'n'].map(p => `<button data-act="chPromo" data-p="${p}" aria-label="${{ q: '퀸', r: '룩', b: '비숍', n: '나이트' }[p]}">${this.pc(col === 'w' ? p.toUpperCase() : p)}<small>${{ q: '퀸', r: '룩', b: '비숍', n: '나이트' }[p]}</small></button>`).join('') + '<button class="ch-px" data-act="chPromoX">취소</button>';
      pr.classList.remove('hidden');
    } else pr.classList.add('hidden');
  },
  bar(p, v, me) {
    if (!p) return '';
    const col = p.color, opp = col === 'w' ? 'b' : 'w';
    const caps = p.captured.slice().sort((a, b) => this.VALUE[b] - this.VALUE[a]).map(c => this.pc(opp === 'w' ? c.toUpperCase() : c, 'cap')).join('');
    const adv = col === 'w' ? v.material : -v.material;
    const turn = v.turnId === p.id;
    const clock = v.clock ? `<span class="ch-clock" data-ci="${col === 'w' ? 0 : 1}"></span>` : '';
    return `<span class="ch-dot ${col}"></span><span class="ch-name"><b>${esc(p.name)}${me && p.id === this.ctx.me ? ' (나)' : ''}</b><small>${col === 'w' ? '백' : '흑'}${p.bot ? ' · AI' : ''}</small></span>
      <span class="ch-caps">${caps}${adv > 0 ? `<em>+${adv}</em>` : ''}</span>${turn && !v.over ? '<i class="ch-think"></i>' : ''}${clock}`;
  },
  /** 체스 시계: 지금 차례인 쪽만 줄어들어요 (서버 시계 기준) */
  startClock() {
    every(200, () => { if (this.v && this.v.clock && S.screen === 'chess') this.tickClock(); });
  },
  tickClock() {
    const v = this.v; if (!v || !v.clock) return;
    const c = v.clock;
    for (const el of $$('#scr-chess .ch-clock')) {
      const i = +el.dataset.ci;
      let ms = c.left[i];
      if (c.run === i) ms -= serverNow() - c.since;
      ms = Math.max(0, ms);
      const s = ms / 1000;
      el.textContent = s < 10 ? s.toFixed(1) : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
      el.classList.toggle('run', c.run === i);
      el.classList.toggle('low', s < 20);
    }
  },

  /* ── 누르기 · 끌기 ── */
  sqAt(x, y) { const el = document.elementFromPoint(x, y); const sq = el && el.closest && el.closest('#ch-board .sq'); return sq ? this.idx(+sq.dataset.d) : null; },
  down(e) {
    if (this.promo || !this.v || e.button > 0) return;
    const i = this.sqAt(e.clientX, e.clientY); if (i == null) return;
    const mine = this.v.turnId === this.ctx.me;
    if (mine && this.legal.has(i)) {
      this.press = { from: i, x: e.clientX, y: e.clientY, id: e.pointerId };
      try { $('#ch-board').setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      e.preventDefault();
    } else this.press = { from: null, at: i, x: e.clientX, y: e.clientY, id: e.pointerId };
  },
  move(e) {
    const p = this.press; if (!p || p.from == null || p.id !== e.pointerId) return;
    if (!this.drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) {
      this.sel = p.from; this.drag = { from: p.from };
      const sz = $('#ch-board .sq').getBoundingClientRect().width;
      const g = document.createElement('div');
      g.className = 'ch-ghost'; g.style.width = g.style.height = sz + 'px';
      g.innerHTML = this.pc(this.v.board[p.from]);
      document.body.append(g); this.drag.g = g; this.drag.sz = sz;
      this.paint();
    }
    if (this.drag) { this.drag.g.style.left = (e.clientX - this.drag.sz / 2) + 'px'; this.drag.g.style.top = (e.clientY - this.drag.sz / 2) + 'px'; }
  },
  up(e) {
    const p = this.press; this.press = null;
    if (!p || p.id !== e.pointerId) return;
    const to = this.sqAt(e.clientX, e.clientY);
    if (this.drag) {
      const from = this.drag.from; this.cancel();
      if (to != null && to !== from) this.tryMove(from, to); else { this.sel = from; this.paint(); }
      return;
    }
    this.tap(to);
  },
  cancel() { if (this.drag) { this.drag.g.remove(); this.drag = null; this.paint(); } this.press = null; },
  tap(i) {
    if (i == null || !this.v) return;
    const mine = this.v.turnId === this.ctx.me;
    if (this.sel != null && (this.legal.get(this.sel) || []).some(m => m.to === i)) return this.tryMove(this.sel, i);
    this.sel = mine && this.legal.has(i) && this.sel !== i ? i : null;
    this.paint();
  },
  /** 싱글 다시 시작 ('다시 하기' 버튼도 고른 실력 · 색으로 해요) */
  soloStart() {
    Table.defs.chess.solo = { bots: 1, opts: { level: this.level, color: this.color, undo: true } };
    Table.solo('chess');
  },
  tryMove(f, t) {
    const m = (this.legal.get(f) || []).find(x => x.to === t);
    if (!m) { this.sel = this.legal.has(t) ? t : null; return this.paint(); }
    if (m.promo) { this.promo = { f, to: t, at: Date.now() }; this.sel = f; return this.paint(); }
    this.sel = null;
    this.ctx.send({ t: 'move', f, to: t });
  },
};
Object.assign(ACT, {
  chSolo: el => {
    CH.level = el.dataset.level;
    $$('#ch-solo [data-act=chSolo]').forEach(b => b.classList.toggle('on', b === el));
    CH.soloStart();
  },
  chColor: el => {
    CH.color = el.dataset.color;
    $$('#ch-solo [data-act=chColor]').forEach(b => b.classList.toggle('on', b === el));
    CH.soloStart();
  },
  chPromo: el => { const p = CH.promo; if (!p || Date.now() - p.at < 400) return; CH.promo = null;   // 손을 뗀 자리에 바로 생긴 버튼이 눌리지 않게 (터치 뒤 click)
    CH.sel = null; CH.ctx.send({ t: 'move', f: p.f, to: p.to, p: el.dataset.p }); CH.paint(); },
  chPromoX: () => { if (!CH.promo || Date.now() - CH.promo.at < 400) return; CH.promo = null; CH.paint(); },
  chUndo: () => CH.ctx && CH.ctx.send({ t: 'undo' }),
  chDraw: () => { if (CH.ctx && confirm('상대에게 무승부를 제안할까요?')) CH.ctx.send({ t: 'draw' }); },
  chDrawYes: () => CH.ctx && CH.ctx.send({ t: 'drawYes' }),
  chDrawNo: () => CH.ctx && CH.ctx.send({ t: 'drawNo' }),
  chResign: () => { if (CH.ctx && confirm('정말 기권할까요? 상대가 이겨요.')) CH.ctx.send({ t: 'resign' }); },
});
Table.def('chess', { core: ChessCore, render: (v, ctx, prev) => CH.render(v, ctx, prev), solo: { bots: 1, opts: { level: 'normal', color: 'white', undo: true } } });
$('#scr-chess').dataset.fitSelf = '1';   // 판 크기를 스스로 재요 → 화면 맞춤(Fit)이 전체를 키우지 않게
