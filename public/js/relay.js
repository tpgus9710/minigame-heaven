/* =====================================================================
 *  🖍️ 그림 릴레이 화면 (규칙: shared/relay-core.js) — 멀티 전용
 *  받은 단어는 스케치북에 그리고, 받은 그림은 무엇인지 적어요. 다 돌면 한 권씩 펼쳐 봐요.
 *  그림은 획을 정수 좌표(480×360 기준)로 줄여서 보내고, 어느 화면 크기에서도 똑같이 그려요.
 *  지우개 · 되돌리기 · 보내기 · 공책 · 체크 아이콘: Tabler Icons (MIT, 라이선스 전문은 icons.js)
 * ===================================================================== */
makeScreen('relay', {
  title: '그림 릴레이', status: '그리고 맞히고 또 그리고! 스케치북이 한 바퀴 돌면 다 같이 펼쳐 봐요.',
  stats: [['round', '라운드'], ['step', '진행'], ['clock', '남은 시간']],
  body: `<div class="rly" id="rly">
      <div class="rly-track" id="rly-track"></div>
      <div class="rly-timer"><i id="rly-bar"></i></div>
      <div class="rly-stage" id="rly-stage"></div>
    </div>`,
});

const RLY_SVG = {
  eraser: '<path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3"/><path d="M18 13.3l-6.3 -6.3"/>',
  undo: '<path d="M9 14l-4 -4l4 -4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/>',
  send: '<path d="M10 14l11 -11"/><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"/>',
  book: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v18"/><path d="M13 8l2 0"/><path d="M13 12l2 0"/>',
  check: '<path d="M5 12l5 5l10 -10"/>',
};
const rlyIc = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RLY_SVG[n]}</svg>`;
const rlyInitial = name => esc([...String(name || '?')][0] || '?');

/* ─── 그림 그리기 (보여 주기 · 그리기 공용) ─── */
const RelayArt = {
  S: 2,   // 백버퍼 배율: 논리 480×360 → 960×720 (작게 보여도 또렷하게)
  prep(cv) {
    const C = RelayCore;
    if (cv.width !== C.W * this.S) { cv.width = C.W * this.S; cv.height = C.H * this.S; }
    const g = cv.getContext('2d');
    g.setTransform(this.S, 0, 0, this.S, 0, 0);
    g.fillStyle = C.COLORS[C.ERASER]; g.fillRect(0, 0, C.W, C.H);
    return g;
  },
  style(g, st) {
    const c = RelayCore.COLORS[st[0]] || '#1f2328', w = RelayCore.SIZES[st[1]] || 7;
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    return w;
  },
  points(st) {
    const p = [[st[2], st[3]]];
    let x = st[2], y = st[3];
    for (let i = 4; i + 1 < st.length; i += 2) { x += st[i]; y += st[i + 1]; p.push([x, y]); }
    return p;
  },
  /** 점 사이를 중간점 곡선으로 부드럽게 (그리는 중 화면과 똑같은 모양) */
  stroke(g, st) {
    const w = this.style(g, st), p = this.points(st);
    if (p.length === 1) { g.beginPath(); g.arc(p[0][0], p[0][1], w / 2, 0, Math.PI * 2); g.fill(); return; }
    g.beginPath(); g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) g.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    g.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    g.stroke();
  },
  paint(cv, d) { if (!cv) return; const g = this.prep(cv); for (const st of d || []) this.stroke(g, st); },
};

class RelayPad {
  constructor(host, extra = '') {
    const C = RelayCore;
    this.host = host;
    host.innerHTML = `<div class="rly-book"><span class="rly-rings"></span><div class="rly-sheet"><canvas class="rly-cv draw"></canvas></div></div>
      <div class="rly-tools">
        <div class="rly-colors">${C.COLORS.slice(0, -1).map((c, i) => `<button class="rly-sw ${i ? '' : 'on'}" style="--c:${c}" data-act="rlyColor" data-i="${i}" aria-label="색 ${i + 1}"></button>`).join('')}
          <button class="rly-tool" data-act="rlyColor" data-i="${C.ERASER}" title="지우개" aria-label="지우개">${rlyIc('eraser')}</button></div>
        <div class="rly-sizes">${C.SIZES.map((z, i) => `<button class="rly-size ${i === 1 ? 'on' : ''}" data-act="rlySize" data-i="${i}" title="굵기 ${i + 1}" aria-label="굵기 ${i + 1}"><i style="--z:${[5, 10, 18][i]}px"></i></button>`).join('')}
          <span class="rly-sep"></span>
          <button class="rly-tool" data-act="rlyUndo" title="되돌리기 (Ctrl+Z)" aria-label="되돌리기">${rlyIc('undo')}</button>
          <button class="rly-tool" data-act="rlyClear" title="모두 지우기" aria-label="모두 지우기">${icon('trash')}</button></div>
        ${extra}
      </div>`;
    this.cv = host.querySelector('canvas');
    this.g = RelayArt.prep(this.cv);
    this.strokes = []; this.color = 0; this.size = 1; this.n = 0; this.bytes = 2; this.cur = null; this.locked = false; this.warned = false;
    const cv = this.cv, end = e => this.up(e);
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('lostpointercapture', end);
  }
  pos(e) {
    const r = this.cv.getBoundingClientRect(), C = RelayCore;
    return [Math.max(0, Math.min(C.W, Math.round((e.clientX - r.left) / r.width * C.W))), Math.max(0, Math.min(C.H, Math.round((e.clientY - r.top) / r.height * C.H)))];
  }
  down(e) {
    if (this.locked || this.cur || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (this.n >= RelayCore.MAX_POINTS - 2 || this.strokes.length >= RelayCore.MAX_STROKES || this.bytes > Relay.BUDGET) return this.full();
    e.preventDefault();
    try { this.cv.setPointerCapture(e.pointerId); } catch (_) { /* 이미 끝난 터치 */ }
    const [x, y] = this.pos(e), st = [this.color, this.size, x, y];
    this.strokes.push(st); this.n++; this.bytes += JSON.stringify(st).length + 1;
    this.cur = { id: e.pointerId, st, pts: [[x, y]], x, y };
    const w = RelayArt.style(this.g, st);
    this.g.beginPath(); this.g.arc(x, y, w / 2, 0, Math.PI * 2); this.g.fill();
  }
  move(e) {
    const c = this.cur;
    if (!c || e.pointerId !== c.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e]) this.add(this.pos(ev));
  }
  add([x, y]) {
    const c = this.cur, dx = x - c.x, dy = y - c.y;
    if (dx * dx + dy * dy < 6) return;               // 2.5px 남짓 움직였을 때만 점을 찍어요 (그림 크기 줄이기)
    if (this.n >= RelayCore.MAX_POINTS - 1 || this.bytes > Relay.BUDGET) return this.full();
    c.st.push(dx, dy); c.x = x; c.y = y; c.pts.push([x, y]); this.n++; this.bytes += String(dx).length + String(dy).length + 2;
    const p = c.pts, k = p.length - 2;               // 새 점 p[k+1] 이 오면 p[k] 를 조절점으로 한 구간을 그려요
    if (k < 1) return;
    const s0 = k === 1 ? p[0] : [(p[k - 1][0] + p[k][0]) / 2, (p[k - 1][1] + p[k][1]) / 2];
    RelayArt.style(this.g, c.st);
    this.g.beginPath(); this.g.moveTo(s0[0], s0[1]);
    this.g.quadraticCurveTo(p[k][0], p[k][1], (p[k][0] + p[k + 1][0]) / 2, (p[k][1] + p[k + 1][1]) / 2);
    this.g.stroke();
  }
  up(e) {
    const c = this.cur;
    if (!c || (e && e.pointerId !== c.id)) return;
    const p = c.pts, n = p.length;
    if (n >= 2) {
      const s0 = n === 2 ? p[0] : [(p[n - 2][0] + p[n - 1][0]) / 2, (p[n - 2][1] + p[n - 1][1]) / 2];
      RelayArt.style(this.g, c.st);
      this.g.beginPath(); this.g.moveTo(s0[0], s0[1]); this.g.lineTo(p[n - 1][0], p[n - 1][1]); this.g.stroke();
    }
    this.cur = null;
  }
  full() { if (!this.warned) { this.warned = true; toast('그림이 너무 복잡해요! 이대로 제출해 주세요.', 'error'); } }
  redraw() { this.g = RelayArt.prep(this.cv); for (const st of this.strokes) RelayArt.stroke(this.g, st); }
  undo() { if (this.locked) return; this.up(); const st = this.strokes.pop(); if (st) { this.n -= (st.length - 2) / 2; this.bytes -= JSON.stringify(st).length + 1; this.warned = false; this.redraw(); } }
  clear() { if (this.locked || !this.strokes.length) return; this.up(); this.strokes = []; this.n = 0; this.bytes = 2; this.warned = false; this.redraw(); }
  setColor(i, el) {
    this.color = i;
    $$('[data-act="rlyColor"]', this.host).forEach(b => b.classList.toggle('on', b === el));
    if (i === RelayCore.ERASER && this.size < 2) this.setSize(2, $('[data-act="rlySize"][data-i="2"]', this.host));
  }
  setSize(i, el) { this.size = i; $$('.rly-size', this.host).forEach(b => b.classList.toggle('on', b === el)); }
  get inked() { return this.strokes.some(st => st[0] !== RelayCore.ERASER); }
  lock(on = true) { this.locked = on; if (on) this.up(); this.cv.classList.toggle('locked', on); this.host.classList.toggle('locked', on); }
}

/* ─── 화면 ─── */
const Relay = {
  BUDGET: 40000,   // 서버가 받는 메시지 한도(64KB) 안에 들어가게 그림 크기를 제한
  v: null, ctx: null, key: null, pad: null, sent: null, deadlineAt: 0, durMs: 0,
  render(v, ctx) {
    if (this.gen !== Table.cur) { this.gen = Table.cur; this.key = null; this.pad = null; this.sent = null; every(200, () => this.tick()); }
    if (v !== this.v) { this.deadlineAt = v.leftMs != null ? Date.now() + v.leftMs : 0; this.durMs = v.durMs || 0; }
    this.v = v; this.ctx = ctx;
    setStatus('relay', v.msg);
    setStat('relay', 'round', `${v.round} / ${v.rounds}`);
    setStat('relay', 'step', v.phase === 'intro' ? '단어 정하기' : v.phase === 'play' ? `${v.step + 1} / ${v.steps}장` : v.phase === 'reveal' && v.book ? `책 ${v.book.idx + 1} / ${v.book.total}` : '끝');
    this.track(v, ctx);
    const key = this.stageKey(v);
    if (key !== this.key) { this.key = key; this.sent = null; this.build(v, ctx); }
    this.update(v, ctx);
    this.tick();
  },
  stageKey(v) {
    if (v.phase === 'intro') return `intro:${v.round}:${v.my ? 'p' : 's'}`;
    if (v.phase === 'play') return `play:${v.round}:${v.step}:${!v.my ? 'spec' : v.my.done ? 'done' : v.my.type}`;
    if (v.phase === 'reveal') return `rev:${v.round}:${v.book ? v.book.idx : -1}`;
    return 'over';
  },
  track(v, ctx) {
    const mark = v.phase === 'intro' || v.phase === 'play' || v.phase === 'reveal';
    $('#rly-track').innerHTML = v.players.map(p => `<span class="rly-chip ${p.id === ctx.me ? 'me' : ''} ${p.left ? 'left' : ''} ${mark && p.done && !p.left ? 'done' : ''}" title="${esc(p.name)}">
      <i class="rly-av" style="--c:${avColor(p.id)}">${rlyInitial(p.name)}</i><span class="nm">${esc(p.name)}</span><b>${p.score}</b>${p.left ? '<small>나감</small>' : mark && p.done ? `<em>${rlyIc('check')}</em>` : ''}</span>`).join('');
  },

  build(v, ctx) {
    const stage = $('#rly-stage');
    this.pad = null;
    if (v.phase === 'intro') { stage.innerHTML = this.introHtml(v); this.rollDie(v); return; }
    if (v.phase === 'play') {
      const m = v.my;
      if (!m) { stage.innerHTML = `<div class="rly-wait"><div class="rly-hg">${icon('eye')}</div><b>관전 중</b><p>모두 스케치북을 이어 가는 중이에요. 다 돌면 같이 펼쳐 봐요!</p></div>`; return; }
      if (m.done) {
        stage.innerHTML = this.doneHtml(v);
        if (m.mine && m.mine.type === 'draw') RelayArt.paint($('#rly-mine'), m.mine.d);
        return;
      }
      if (m.type === 'draw') {
        stage.innerHTML = this.drawHtml(v);
        this.pad = new RelayPad($('#rly-pad'), `<button class="btn good rly-send" data-act="rlySubmit" id="rly-send">${rlyIc('send')} 다 그렸어요</button>`);
        return;
      }
      stage.innerHTML = this.guessHtml(v);
      RelayArt.paint($('#rly-view'), m.d);
      const inp = $('#rly-in');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); this.submit(false); } });
      if (!TOUCH) inp.focus();
      return;
    }
    if (v.phase === 'reveal' && v.book) {
      stage.innerHTML = this.revealHtml(v, ctx);
      $$('[data-cv]', stage).forEach(cv => { const pg = v.book.pages.find(p => p.i === +cv.dataset.cv); RelayArt.paint(cv, pg && pg.d); });
      return;
    }
    stage.innerHTML = this.overHtml(v);
  },
  update(v) {
    const act = v.players.filter(p => !p.left), cnt = `${act.filter(p => p.done).length}/${act.length}`;
    const rn = $('#rly-ready-n'); if (rn) rn.textContent = cnt;
    const dn = $('#rly-done-n'); if (dn) dn.textContent = cnt;
    if (v.phase === 'intro' && v.my && v.my.ready) {
      const b = $('#rly-ready');
      if (b && !b.disabled) { b.disabled = true; b.classList.add('ghost'); b.innerHTML = `준비 완료! 다른 사람 기다리는 중 <small id="rly-ready-n">${cnt}</small>`; }
    }
    if (v.phase === 'reveal' && v.book) {
      const b = v.book;
      $$('.rly-like').forEach(el => {
        const pg = b.pages.find(p => p.i === +el.dataset.page);
        if (!pg) return;
        el.classList.toggle('on', b.myLike === pg.i);
        el.querySelector('b').textContent = pg.likes;
      });
      const nn = $('#rly-next-n'); if (nn) nn.textContent = `${b.nextN}/${b.needN}`;
      const nb = $('#rly-next'); if (nb) { nb.disabled = b.voted || v.spectator; nb.classList.toggle('ghost', b.voted); }
    }
  },
  tick() {
    const v = this.v;
    if (!v || !Table.cur || Table.cur.key !== 'relay') return;
    const left = this.deadlineAt ? Math.max(0, this.deadlineAt - Date.now()) : 0;
    setStat('relay', 'clock', this.deadlineAt && !v.over ? Math.ceil(left / 1000) + '초' : '-');
    const bar = $('#rly-bar');
    if (bar) { bar.style.width = (this.durMs && !v.over ? Math.min(100, left / this.durMs * 100) : 0).toFixed(1) + '%'; bar.classList.toggle('low', v.phase === 'play' && left < 10000); }
    // 마감 직전: 지금까지 그린 그림 · 적은 답을 자동으로 제출
    if (v.phase === 'play' && v.my && !v.my.done && this.sent !== this.key && this.deadlineAt && left < 700) this.submit(true);
  },
  submit(auto) {
    const v = this.v, m = v && v.my;
    if (!m || m.done || v.phase !== 'play' || this.sent === this.key) return;
    let a;
    if (m.type === 'draw') {
      if (!this.pad) return;
      if (!auto && !this.pad.inked) return toast('먼저 그림을 그려 주세요!', 'error');
      this.pad.lock();
      a = { t: 'submit', round: v.round, step: v.step, d: this.pad.strokes };
    } else {
      const inp = $('#rly-in'), text = inp ? inp.value.trim() : '';
      if (!auto && !text) { if (inp) inp.focus(); return toast('정답을 적어 주세요!', 'error'); }
      if (inp) inp.disabled = true;
      a = { t: 'submit', round: v.round, step: v.step, text };
    }
    const key = this.sent = this.key, btn = $('#rly-send'), label = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = auto ? '시간 끝! 보내는 중…' : '보내는 중…'; }
    this.ctx.send(a);
    // 서버가 받아 주지 않았으면(연결 끊김 등) 다시 낼 수 있게
    after(5000, () => {
      if (this.key !== key || this.sent !== key) return;
      this.sent = null;
      if (this.pad) this.pad.lock(false);
      const inp = $('#rly-in'); if (inp) inp.disabled = false;
      const b = $('#rly-send'); if (b) { b.disabled = false; b.innerHTML = label; }
    });
  },

  /* ── 단계별 화면 ── */
  introHtml(v) {
    const m = v.my;
    if (!m) return `<div class="rly-wait"><div class="rly-hg">${icon('eye')}</div><b>관전 중</b><p>모두 주사위를 굴려 비밀 단어를 정하고 있어요.</p></div>`;
    return `<div class="rly-intro">
      <div class="rly-wordcard">
        <div class="rly-wc-h">${rlyIc('book')}<b>내 스케치북 단어 카드</b>${v.rounds > 1 ? `<small>${v.round}라운드</small>` : ''}</div>
        <ol>${m.card.map((w, i) => `<li data-n="${i + 1}"><i>${i + 1}</i><span>${esc(w)}</span></li>`).join('')}</ol>
        <p class="rly-wc-foot">주사위 눈에 해당하는 단어가 내 비밀 단어!</p>
      </div>
      <div class="rly-roll">
        <div class="rly-die rolling" id="rly-die">${Pieces.die(1 + Math.floor(Math.random() * 6))}</div>
        <p class="rly-pick" id="rly-pick">주사위를 굴리는 중…</p>
        <p class="rly-tip">${m.ownerFirst ? '첫 장은 <b>내가 직접</b> 이 단어를 그려요.' : '이 단어는 <b>옆 사람이 먼저</b> 그려요.<br>나는 앞사람의 스케치북을 받아 이어 가요.'}</p>
        <button class="btn good" data-act="rlyReady" id="rly-ready" ${m.ready ? 'disabled' : ''}>준비 완료 <small id="rly-ready-n"></small></button>
      </div>
    </div>`;
  },
  rollDie(v) {
    const m = v.my, box = $('#rly-die');
    if (!m || !box) return;
    const spin = every(90, () => { if (box.isConnected) box.innerHTML = Pieces.die(1 + Math.floor(Math.random() * 6)); });
    after(1400, () => {
      clearInterval(spin);
      if (!box.isConnected) return;
      box.classList.remove('rolling'); box.classList.add('land'); box.innerHTML = Pieces.die(m.die);
      const li = $(`.rly-wordcard li[data-n="${m.die}"]`); if (li) li.classList.add('pick');
      const pick = $('#rly-pick'); if (pick) pick.innerHTML = `<small>내 비밀 단어</small><b>${esc(m.word)}</b>`;
    });
  },
  meta(m) { return `<span class="rly-meta" title="${esc(m.ownerName)} 님의 스케치북 ${m.page}번째 장">${rlyIc('book')}${esc(m.ownerName)} · ${m.page}장</span>`; },
  drawHtml(v) {
    const m = v.my;
    const from = m.fallback ? '앞사람이 비워 둬서 그 전 단어를 이어 그려요' : m.fromName ? `${esc(m.fromName)} 님이 적은 답을 그려요`
      : m.owner === this.ctx.me ? '내 스케치북의 비밀 단어를 그려요' : `${esc(m.ownerName)} 님의 비밀 단어를 그려요`;
    return `<div class="rly-task">
      <div class="rly-prompt draw">${this.meta(m)}<small>${from}</small><b>${esc(m.word)}</b><span class="rly-hint">글자나 숫자는 쓰지 말고 그림으로만!</span></div>
      <div class="rly-pad" id="rly-pad"></div>
    </div>`;
  },
  guessHtml(v) {
    const m = v.my;
    return `<div class="rly-task">
      <div class="rly-prompt guess">${this.meta(m)}<small>${m.fromName ? `${esc(m.fromName)} 님의 그림` : '앞사람의 그림'}</small><b>이 그림은 무엇일까요?</b></div>
      <div class="rly-book"><span class="rly-rings"></span><div class="rly-sheet"><canvas class="rly-cv" id="rly-view"></canvas>${m.empty ? '<p class="rly-blank">빈 그림이에요… 상상력을 발휘해 보세요!</p>' : ''}</div></div>
      <div class="rly-answer-row"><input type="text" id="rly-in" maxlength="${RelayCore.MAX_TEXT}" placeholder="정답을 적어 주세요" autocomplete="off" enterkeyhint="send">
        <button class="btn good" data-act="rlySubmit" id="rly-send">${rlyIc('send')} 제출</button></div>
    </div>`;
  },
  doneHtml(v) {
    const mine = v.my.mine || {};
    return `<div class="rly-wait">
      <div class="rly-hg">${icon('hourglass')}</div><b>제출 완료!</b>
      <p>다른 사람을 기다리는 중 <span class="rly-cnt" id="rly-done-n"></span></p>
      <div class="rly-mine">${mine.type === 'draw' ? '<div class="rly-book mini"><div class="rly-sheet"><canvas class="rly-cv" id="rly-mine"></canvas></div></div>' : `<q>${esc(mine.text || '(빈 칸)')}</q>`}
        <small>내가 ${mine.type === 'draw' ? '그린 그림' : '적은 답'} · 다음 사람에게 넘어가요</small></div>
    </div>`;
  },
  revealHtml(v, ctx) {
    const b = v.book, last = b.pages[b.pages.length - 1];
    const ending = !last ? '<span>아무도 이어 가지 못했어요.</span>'
      : last.type === 'guess' && last.exact ? '<b class="ok">원래 단어 그대로 도착!</b>'
      : `<span>처음 <b>${esc(b.word)}</b><i>→</i>마지막 <b>${last.type === 'guess' ? esc(last.text || '(빈 칸)') : '그림'}</b></span>`;
    const nextLabel = b.idx + 1 < b.total ? '다음 책' : v.round < v.rounds ? '다음 라운드' : '결과 보기';
    return `<div class="rly-reveal">
      <div class="rly-rv-head"><i class="rly-av lg" style="--c:${avColor(b.owner)}">${rlyInitial(b.ownerName)}</i>
        <div class="rly-rv-t"><small>스케치북 ${b.idx + 1} / ${b.total}</small><b>${esc(b.ownerName)} 님의 스케치북</b></div>
        <button class="btn" data-act="rlyNext" id="rly-next">${icon('player-skip-forward')} ${nextLabel} <small id="rly-next-n"></small></button>
      </div>
      <p class="rly-rv-tip">마음에 드는 장에 <b>하트</b>를 눌러 주세요 (한 권에 한 장, 받은 하트 하나에 +1점).</p>
      <div class="rly-pages">
        <div class="rly-page origin" style="--d:0s"><span class="rly-no">0</span><small>처음 단어 · 주사위 ${b.die}</small><b class="rly-big">${esc(b.word)}</b></div>
        ${b.pages.map((pg, k) => this.pageHtml(pg, k, ctx.me, v.spectator)).join('')}
        <div class="rly-page ending" style="--d:${((b.pages.length + 1) * 0.8).toFixed(1)}s">${ending}</div>
      </div>
    </div>`;
  },
  pageHtml(pg, k, me, spectator) {
    const can = pg.by !== me && !pg.empty && !spectator;
    const body = pg.type === 'draw'
      ? `<div class="rly-book mini"><div class="rly-sheet"><canvas class="rly-cv" data-cv="${pg.i}"></canvas>${pg.empty ? `<p class="rly-blank">${pg.late ? '시간 안에 못 그렸어요' : '빈 그림'}</p>` : ''}</div></div>`
      : `<div class="rly-ans ${pg.empty ? 'empty' : ''}">${pg.empty ? (pg.late ? '(시간 초과)' : '(빈 칸)') : esc(pg.text)}</div>`;
    return `<div class="rly-page ${pg.type} ${pg.exact ? 'exact' : ''}" style="--d:${((k + 1) * 0.8).toFixed(1)}s">
      <span class="rly-no">${k + 1}</span>
      <div class="rly-by"><i class="rly-av" style="--c:${avColor(pg.by)}">${rlyInitial(pg.name)}</i><span>${esc(pg.name)}</span><small>${pg.type === 'draw' ? '그림' : '맞히기'}</small></div>
      ${body}
      <div class="rly-pg-foot">${pg.exact ? '<span class="rly-badge">정답 그대로 +1</span>' : ''}${pg.helped ? '<span class="rly-badge blue">맞히게 한 그림 +1</span>' : ''}
        <button class="rly-like" data-act="rlyLike" data-page="${pg.i}" ${can ? '' : 'disabled'} title="${can ? '좋아요' : pg.by === me ? '내 장' : ''}">${icon('heart')}<b>${pg.likes}</b></button></div>
    </div>`;
  },
  overHtml(v) {
    const f = v.final || {}, rank = v.players.slice().sort((a, b) => b.score - a.score);
    return `<div class="rly-wait over"><div class="rly-hg">${icon('trophy')}</div><b>모든 스케치북을 다 봤어요!</b>
      <p>스케치북 ${f.books || 0}권 중 ${f.arrived || 0}권이 원래 단어 그대로 돌아왔어요.</p>
      <ol class="rly-final">${rank.map(p => `<li><i class="rly-av" style="--c:${avColor(p.id)}">${rlyInitial(p.name)}</i><span>${esc(p.name)}</span><b>${p.score}점</b></li>`).join('')}</ol></div>`;
  },
};

Object.assign(ACT, {
  rlyReady: () => { if (Relay.ctx) Relay.ctx.send({ t: 'ready' }); },
  rlySubmit: () => Relay.submit(false),
  rlyColor: el => { if (Relay.pad && !Relay.pad.locked) Relay.pad.setColor(+el.dataset.i, el); },
  rlySize: el => { if (Relay.pad && !Relay.pad.locked) Relay.pad.setSize(+el.dataset.i, el); },
  rlyUndo: () => { if (Relay.pad) Relay.pad.undo(); },
  rlyClear: () => { if (Relay.pad) Relay.pad.clear(); },
  rlyLike: el => { if (Relay.ctx) Relay.ctx.send({ t: 'like', page: +el.dataset.page }); },
  rlyNext: el => { if (Relay.ctx) { Relay.ctx.send({ t: 'next', book: Relay.v && Relay.v.book ? Relay.v.book.idx : undefined }); el.disabled = true; } },
});
Table.def('relay', {
  core: RelayCore,
  render: (v, ctx) => Relay.render(v, ctx),
  key: e => { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && Relay.pad) { e.preventDefault(); Relay.pad.undo(); } },
});
