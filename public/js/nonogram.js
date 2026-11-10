/* =====================================================================
 *  🖼️ 노노그램 (싱글: 5×5 · 10×10 · 15×15 그림 퍼즐 + 가르쳐 주는 힌트 / 멀티: 같은 퍼즐 먼저 풀기 대결)
 *  규칙 · 퍼즐: shared/nonogram-core.js · 멀티 서버: games/puzzle.js
 *  칸을 누르면 칠하고, 「X 표시」 모드(마우스 오른쪽 버튼)로는 빈칸 표시를 해요. 누른 채 끌면 한 줄을 한 번에.
 *  정답 확인(싱글 · 기본 켬): 틀린 칸은 바로 알려 주고 끌기는 거기서 멈춰요. 목숨 3개 — 3번 틀리면 실패
 *  (예전에는 틀린 칸을 고쳐 주기만 해서 아무 데나 쭉 칠하면 저절로 풀리는 문제가 있었어요)
 * ===================================================================== */
makeScreen('nonogram', {
  title: '🖼️ 노노그램', status: '줄 옆 숫자만큼 이어서 칠해요. 숫자가 여러 개면 덩어리 사이에 빈칸이 하나 이상 있어요.',
  stats: [['time', '시간'], ['miss', '목숨']],
  body: `<div class="mode-row" id="ng-solo"><span class="muted small">크기</span>
      <button class="seg-btn" data-act="ngLevel" data-l="s5">5×5</button><button class="seg-btn on" data-act="ngLevel" data-l="s10">10×10</button><button class="seg-btn" data-act="ngLevel" data-l="s15">15×15</button>
      <button class="seg-btn ng-gap" data-act="ngNew">새 퍼즐</button></div>
    <div class="ng-wrap" id="ng-wrap">
      <div class="ng-board" id="ng-board"></div>
      <div class="ng-side">
        <div class="ng-msg" id="ng-msg"></div>
        <div class="ng-modes" id="ng-modes"></div>
        <div class="ng-tools" id="ng-tools"></div>
      </div>
    </div>`,
});

const NG = {
  level: 's10', solo: true, mode: 'fill',
  check: (() => { try { return localStorage.getItem('ngCheck') !== '0'; } catch { return true; } })(),
  autoX: (() => { try { return localStorage.getItem('ngAutoX') !== '0'; } catch { return true; } })(),
  LEVEL_NAME: { s5: '입문 5×5', s10: '보통 10×10', s15: '어려움 15×15' },
  LIVES: 3,                                                            // 정답 확인을 켰을 때 실수할 수 있는 횟수
  hearts() { const n = Math.max(0, this.LIVES - this.miss); return '❤️'.repeat(n) + '🤍'.repeat(this.LIVES - n); },
  startSolo(level) {
    stopLocal();
    if (level) this.level = level;
    this.solo = true; S.solo = 'nonogram';
    $('#ng-solo').classList.remove('hidden');
    $$('#ng-solo [data-act=ngLevel]').forEach(b => b.classList.toggle('on', b.dataset.l === this.level));
    let done = []; try { done = JSON.parse(localStorage.getItem('ngPics') || '[]'); } catch { /* 무시 */ }
    const P = NonogramCore.make(this.level, { skip: Array.isArray(done) ? done : [] });     // 안 풀어 본 그림부터
    setStatus('nonogram', `${this.LEVEL_NAME[this.level]} — 줄 옆 숫자만큼 이어서 칠해요. 다 풀면 그림이 나와요.`);
    show('nonogram'); renderScores();
    this.load(P);
    this.msg('숫자가 큰 줄부터 보세요. 막히면 <b>힌트</b>가 어느 줄에서 무엇을 알 수 있는지 알려 줘요.');
  },
  startMulti(d) {
    stopLocal();
    this.solo = false; this.level = d.level;
    $('#ng-solo').classList.add('hidden');
    setStatus('nonogram', `${this.LEVEL_NAME[d.level] || ''} 대결 — 모두 같은 퍼즐! 먼저 다 맞게 칠하는 사람이 우승해요.`);
    show('nonogram'); renderScores();
    this.load({ w: d.w, h: d.h, rows: d.rows, cols: d.cols, sol: null, name: '' }, d.grid);
    this.endAt = Date.now() + d.left * 1000;
    this.msg('모두 같은 퍼즐이에요. 모든 줄이 맞으면 서버가 정답인지 확인해요.');
  },
  load(P, grid) {
    Object.assign(this, { w: P.w, h: P.h, rows: P.rows, cols: P.cols, sol: P.sol, name: P.name, done: false, doneAt: 0, miss: 0, hints: 0, hist: [], hintCells: null, lastSent: '' });
    this.grid = new Uint8Array(P.w * P.h);
    if (grid && grid.length === P.w * P.h) for (let i = 0; i < grid.length; i++) this.grid[i] = +grid[i] || 0;
    this.t0 = performance.now();                                 // 일시정지하면 멈추는 시계 (pause.js)
    this.build();
    this.paint();
    every(250, () => this.hud());
    this.fit();
  },
  build() {
    const { w, h, rows, cols } = this, b = $('#ng-board');
    const rc = Math.max(1, ...rows.map(r => r.length)), cc = Math.max(1, ...cols.map(c => c.length));
    Object.assign(this, { rc, cc });
    b.style.setProperty('--w', w); b.style.setProperty('--h', h); b.style.setProperty('--rc', rc); b.style.setProperty('--cc', cc);
    const nums = a => (a.length ? a : [0]).map(n => `<i>${n}</i>`).join('');
    b.innerHTML = `<div class="ng-corner"></div>
      <div class="ng-cols">${cols.map((c, k) => `<div class="cl" data-c="${k}">${nums(c)}</div>`).join('')}</div>
      <div class="ng-rows">${rows.map((r, k) => `<div class="rl" data-r="${k}">${nums(r)}</div>`).join('')}</div>
      <div class="ng-grid" id="ng-grid">${Array.from({ length: w * h }, (_, i) => `<div class="nc" data-i="${i}"></div>`).join('')}</div>`;
    b.classList.remove('win');
    this.cells = $$('#ng-grid .nc');
    const G = $('#ng-grid');
    G.addEventListener('pointerdown', e => this.down(e));
    G.addEventListener('pointermove', e => this.moveTo(e));
    G.addEventListener('pointerup', e => this.up(e));
    G.addEventListener('pointercancel', () => this.up());
    G.addEventListener('contextmenu', e => e.preventDefault());
    G.addEventListener('pointerleave', () => this.hover(-1));
    if (!this.watching) this.watch();
  },
  /* ── 그리기 ── */
  paint() {
    const { w, h } = this, g = this.grid;
    for (let i = 0; i < w * h; i++) {
      const v = g[i], el = this.cells[i];
      const r = Math.floor(i / w), c = i % w;
      el.className = `nc${v === 1 ? ' f' : v === 2 ? ' x' : ''}${c % 5 === 4 && c < w - 1 ? ' br' : ''}${r % 5 === 4 && r < h - 1 ? ' bb' : ''}${this.hintCells && this.hintCells.has(i) ? ' hint' : ''}`;
    }
    for (let r = 0; r < h; r++) $(`#ng-board .rl[data-r="${r}"]`).classList.toggle('done', NonogramCore.lineDone(this.rows[r], Array.from({ length: w }, (_, c) => g[r * w + c])));
    for (let c = 0; c < w; c++) $(`#ng-board .cl[data-c="${c}"]`).classList.toggle('done', NonogramCore.lineDone(this.cols[c], Array.from({ length: h }, (_, r) => g[r * w + c])));
    $('#ng-modes').innerHTML = `<button class="ng-m ${this.mode === 'fill' ? 'on' : ''}" data-act="ngMode" data-m="fill"><i class="sw f"></i>칠하기</button>
      <button class="ng-m ${this.mode === 'x' ? 'on' : ''}" data-act="ngMode" data-m="x"><i class="sw x"></i>X 표시</button>`;
    $('#ng-tools').innerHTML = [
      `<button class="btn sm ghost" data-act="ngUndo"${this.hist.length ? '' : ' disabled'}>${icon('arrow-back-up')}되돌리기</button>`,
      this.solo ? `<button class="btn sm ghost" data-act="ngHint">${icon('bulb')}힌트</button>` : '',
      `<button class="btn sm ghost" data-act="ngAutoX" aria-pressed="${this.autoX}">${icon('square-x')}다 맞은 줄 자동 X ${this.autoX ? '켬' : '끔'}</button>`,
      this.solo ? `<button class="btn sm ghost" data-act="ngCheck" aria-pressed="${this.check}">${icon(this.check ? 'eye' : 'eye-off')}정답 확인 ${this.check ? '켬' : '끔'}</button>` : '',
    ].join('');
    this.hud();
  },
  hud() {
    if (!this.grid) return;
    const sec = this.solo ? Math.floor(((this.doneAt || performance.now()) - this.t0) / 1000) + this.hints * 30 : secLeft(this.endAt);
    setStat('nonogram', 'time', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    const lab = $('#nonogram-time-label'); if (lab) lab.textContent = this.solo ? '시간' : '남은 시간';
    const ml = $('#nonogram-miss-label'); if (ml) ml.textContent = this.solo && this.check ? '목숨' : '실수';
    setStat('nonogram', 'miss', this.solo && this.check ? this.hearts() : '-');
  },
  msg(html) { $('#ng-msg').innerHTML = html; },
  hover(i) {
    const r = i < 0 ? -1 : Math.floor(i / this.w), c = i < 0 ? -1 : i % this.w;
    $$('#ng-board .rl').forEach((el, k) => el.classList.toggle('hv', k === r));
    $$('#ng-board .cl').forEach((el, k) => el.classList.toggle('hv', k === c));
  },
  /* ── 누르기 · 끌기 ── */
  cellAt(x, y) { const el = document.elementFromPoint(x, y); const c = el && el.closest && el.closest('#ng-grid .nc'); return c ? +c.dataset.i : -1; },
  down(e) {
    if (this.done || e.button > 2) return;
    const i = this.cellAt(e.clientX, e.clientY); if (i < 0) return;
    e.preventDefault();
    try { $('#ng-grid').setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const mode = e.button === 2 ? 'x' : this.mode, from = this.grid[i];
    let to;
    if (mode === 'fill') to = from === 1 ? 0 : from === 2 ? 0 : 1;
    else { if (from === 1) return; to = from === 2 ? 0 : 2; }
    this.drag = { id: e.pointerId, start: i, from, to, dir: null, batch: [], last: i };
    this.hintCells = null;
    this.apply(i);
    this.paint();
  },
  moveTo(e) {
    const i = this.cellAt(e.clientX, e.clientY);
    if (!this.drag) { if (e.pointerType === 'mouse') this.hover(i); return; }
    if (e.pointerId !== this.drag.id || i < 0 || i === this.drag.last) return;
    const d = this.drag, w = this.w, sr = Math.floor(d.start / w), sc = d.start % w, r = Math.floor(i / w), c = i % w;
    if (!d.dir) d.dir = r === sr ? 'row' : c === sc ? 'col' : Math.abs(c - sc) >= Math.abs(r - sr) ? 'row' : 'col';
    // 처음 끈 방향의 한 줄로만 (손이 조금 비뚤어져도)
    const tr = d.dir === 'row' ? sr : r, tc = d.dir === 'row' ? c : sc;
    const a = d.dir === 'row' ? sc : sr, b = d.dir === 'row' ? tc : tr, st = b >= a ? 1 : -1;
    for (let k = a; ; k += st) {                                        // 시작 칸 → 손가락 쪽으로 차례대로 (틀린 칸에서 멈춰요)
      this.apply(d.dir === 'row' ? sr * w + k : k * w + sc);
      if (k === b || d.stop) break;
    }
    d.last = i;
    this.hover(tr * w + tc);
    this.paint();
  },
  up(e) {
    const d = this.drag; if (!d || (e && e.pointerId !== d.id)) return;
    this.drag = null;
    if (d.batch.length) { this.hist.push(d.batch); if (this.hist.length > 200) this.hist.shift(); }
    this.autoMark();
    this.paint();
    if (!this.solo) this.send();
    if (this.solo && this.check && this.miss >= this.LIVES) return this.fail();
    this.checkWin();
  },
  /** 한 칸 바꾸기 (끌기를 시작한 칸과 같은 상태인 칸만).
   *  정답 확인을 켰으면 틀린 칸은 정답으로 보여 주고 목숨 하나를 잃어요. 끌기는 거기서 멈춰요 — 아무 데나 쭉 칠해서 풀 수 없게 */
  apply(i) {
    const d = this.drag; if (!d || d.stop || this.grid[i] !== d.from) return;
    let to = d.to;
    if (this.solo && this.check && this.sol) {
      const s = this.sol[i];
      if ((to === 1 && s === '0') || (to === 2 && s === '1')) {
        to = s === '1' ? 1 : 2;
        d.stop = true; this.miss++; this.flash(i); Sound.play('bad');
        const left = this.LIVES - this.miss;
        this.msg(`${s === '1' ? '이 칸은 칠해야 하는 칸이에요.' : '이 칸은 빈칸이에요.'} ${left > 0 ? `목숨 ${this.hearts()} — 다음엔 숫자를 한 번 더 세어 보세요.` : '목숨을 다 썼어요…'}`);
      }
    }
    d.batch.push([i, this.grid[i]]);
    this.grid[i] = to;
  },
  /** 정답 확인을 켜고 3번 틀리면 실패 (기록 없음) */
  fail() {
    if (this.done) return;
    this.done = true; this.doneAt = performance.now();
    this.paint();
    $('#ng-board').classList.add('lost');
    this.msg('💔 3번 틀렸어요. 이번 퍼즐은 실패! <b>새 퍼즐</b>로 다시 도전해요.');
    after(1300, () => showResult({ title: '💔 3번 틀렸어요!', subtitle: `${this.LEVEL_NAME[this.level]} · 정답 확인을 켜면 실수는 3번까지예요. 끄면 목숨 없이 풀 수 있어요 (틀린 칸도 직접 찾아야 해요).`, solo: 'nonogram', win: false }));
  },
  flash(i) { const el = this.cells[i]; if (!el) return; el.classList.remove('oops'); void el.offsetWidth; el.classList.add('oops'); setTimeout(() => el.classList.remove('oops'), 700); },
  /** 단서와 딱 맞은 줄의 나머지 빈칸은 X (켜 두었을 때) */
  autoMark() {
    if (!this.autoX) return;
    const { w, h } = this, g = this.grid, batch = [];
    const mark = (cells, cl) => { if (NonogramCore.lineDone(cl, cells.map(i => g[i]))) for (const i of cells) if (g[i] === 0) { batch.push([i, 0]); g[i] = 2; } };
    for (let r = 0; r < h; r++) mark(Array.from({ length: w }, (_, c) => r * w + c), this.rows[r]);
    for (let c = 0; c < w; c++) mark(Array.from({ length: h }, (_, r) => r * w + c), this.cols[c]);
    if (batch.length && this.hist.length) this.hist[this.hist.length - 1].push(...batch);
  },
  undo() {
    const b = this.hist.pop(); if (!b || this.done) return;
    for (let k = b.length - 1; k >= 0; k--) this.grid[b[k][0]] = b[k][1];
    this.paint();
    if (!this.solo) this.send();
  },
  hint() {
    if (!this.solo || this.done) return;
    const H = NonogramCore.hint(this.w, this.h, this.rows, this.cols, this.sol, Array.from(this.grid));
    if (!H) return;
    this.hints++;
    const batch = [];
    for (const i of H.cells) { batch.push([i, this.grid[i]]); this.grid[i] = H.kind === 'wrong' ? 2 : H.fill ? 1 : 2; }
    this.hist.push(batch);
    this.hintCells = new Set(H.cells);
    this.msg(`💡 ${H.text} <span class="muted">(힌트 +30초)</span>`);
    this.autoMark();
    this.paint();
    setTimeout(() => { this.hintCells = null; if (!this.done) this.paint(); }, 2600);
    this.checkWin();
  },
  checkWin() {
    if (this.done) return;
    const { w, h } = this, g = this.grid;
    const allRows = this.rows.every((cl, r) => NonogramCore.lineDone(cl, Array.from({ length: w }, (_, c) => g[r * w + c])));
    const allCols = this.cols.every((cl, c) => NonogramCore.lineDone(cl, Array.from({ length: h }, (_, r) => g[r * w + c])));
    if (!allRows || !allCols) return;
    if (!this.solo) { this.msg('🎉 모든 줄이 맞아요! 서버가 정답을 확인하는 중…'); this.send(true); return; }
    this.done = true; this.doneAt = performance.now();
    for (let i = 0; i < g.length; i++) if (g[i] === 2) g[i] = 0;
    this.paint();
    $('#ng-board').classList.add('win');
    const sec = Math.floor((this.doneAt - this.t0) / 1000) + this.hints * 30;
    const key = 'best-nonogram-' + this.level, prev = +store.get(key, 0);
    const best = prev ? Math.min(prev, sec) : sec; store.set(key, best);
    if (this.name && this.name !== '무작위 무늬') {
      try { const a = JSON.parse(localStorage.getItem('ngPics') || '[]'); const all = NonogramCore.PICTURES.filter(p => p.w === this.w).map(p => p.name); let n = Array.isArray(a) ? a.filter(x => x !== this.name) : []; n.push(this.name); if (all.every(x => n.includes(x))) n = n.filter(x => !all.includes(x)); localStorage.setItem('ngPics', JSON.stringify(n.slice(-40))); } catch { /* 무시 */ }
    }
    const t = s => `${Math.floor(s / 60)}분 ${s % 60}초`;
    this.msg(`🎉 완성! ${this.name && this.name !== '무작위 무늬' ? `그림: <b>${esc(this.name)}</b>` : '무작위 무늬를 다 풀었어요.'}`);
    after(1500, () => showResult({ title: `🖼️ 노노그램 완성!${this.name && this.name !== '무작위 무늬' ? ` — ${this.name}` : ''}`, subtitle: `${this.LEVEL_NAME[this.level]} · ${t(sec)}${this.hints ? ` (힌트 ${this.hints}번 포함)` : ''}${this.check ? ` · 실수 ${this.miss}번` : ''} · 최고 기록 ${t(best)}${!prev || sec < prev ? ' 🏅 신기록!' : ''}`, solo: 'nonogram', win: true, rec: { k: this.level, v: sec } }));
  },
  send(now) {
    const s = Array.from(this.grid).join('');
    if (s === this.lastSent && !now) return;
    this.lastSent = s;
    clearTimeout(this.sendT);
    this.sendT = setTimeout(() => socket.emit('pz:grid', s), now ? 0 : 250);
  },
  /* ── 판 크기: 단서까지 넣어서 남은 높이 · 너비에 맞춰요 ── */
  fit() {
    const sec = $('#scr-nonogram'), wrap = $('#ng-wrap'), board = $('#ng-board');
    if (!sec || !sec.classList.contains('active') || !this.w) return;
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' && Fit.room ? Fit.room(sec) : window.innerHeight - sec.getBoundingClientRect().top;
    const H = Math.floor(room - (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z - 4);
    const narrow = window.innerWidth <= 760 && !(window.innerHeight <= 520 && window.innerWidth > window.innerHeight);
    const W = wrap.clientWidth - (narrow ? 0 : $('.ng-side').offsetWidth + 18);
    const k = 0.62, sideH = narrow ? $('.ng-side').offsetHeight + 10 : 0;
    let cs = Math.floor(Math.min(68, (W - 8) / (this.w + this.rc * k), (H - sideH - 8) / (this.h + this.cc * k)));
    cs = Math.max(16, cs);
    board.style.setProperty('--cs', cs + 'px');
    for (let t = 0; t < 3; t++) {                                    // 글자 폭 때문에 조금 넘치면 한 칸씩 줄여요
      const over = wrap.offsetHeight - H, wOver = board.offsetWidth - (narrow ? wrap.clientWidth : W);
      if ((over <= 0 && wOver <= 0) || cs <= 16) break;
      cs--; board.style.setProperty('--cs', cs + 'px');
    }
  },
  watch() {
    this.watching = true;
    const again = () => { if (S.screen === 'nonogram') { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this.fit()); } };
    window.addEventListener('resize', again);
    window.addEventListener('orientationchange', () => setTimeout(again, 250));
    if (typeof ResizeObserver !== 'undefined') { let w = 0; new ResizeObserver(() => { const x = $('#ng-wrap').clientWidth; if (Math.abs(x - w) > 1) { w = x; again(); } }).observe($('#ng-wrap')); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  },
};
Object.assign(ACT, {
  ngLevel: el => NG.startSolo(el.dataset.l),
  ngNew: () => NG.startSolo(),
  ngMode: el => { NG.mode = el.dataset.m; NG.paint(); },
  ngUndo: () => NG.undo(),
  ngHint: () => NG.hint(),
  ngCheck: () => { NG.check = !NG.check; try { localStorage.setItem('ngCheck', NG.check ? '1' : '0'); } catch { /* 무시 */ } NG.paint(); },
  ngAutoX: () => { NG.autoX = !NG.autoX; try { localStorage.setItem('ngAutoX', NG.autoX ? '1' : '0'); } catch { /* 무시 */ } NG.autoMark(); NG.paint(); },
});
register('nonogram', {
  solo: () => NG.startSolo(),
  key: e => {
    if (!NG.grid) return;
    if (e.code === 'KeyX' || e.code === 'KeyF') { NG.mode = e.code === 'KeyX' ? 'x' : 'fill'; NG.paint(); }
    else if (e.code === 'KeyZ') { e.preventDefault(); NG.undo(); }
    else if (e.code === 'KeyH') NG.hint();
  },
});
socket.on('pz:start', d => { if (d.game === 'nonogram') NG.startMulti(d); });
LOBBY_OPTIONS.nonogram = [{ key: 'ngLevel', label: '🖼️ 크기', def: 's10', values: [['s5', '5×5'], ['s10', '10×10'], ['s15', '15×15']] }];
$('#scr-nonogram').dataset.fitSelf = '1';   // 판 크기를 스스로 재요 → 화면 맞춤(Fit)이 전체를 키우지 않게
