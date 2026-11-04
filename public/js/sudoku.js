/* =====================================================================
 *  🔢 스도쿠 (싱글: 쉬움 · 보통 · 어려움 + 가르쳐 주는 힌트 / 멀티: 같은 퍼즐 먼저 풀기 대결)
 *  규칙 · 퍼즐 만들기: shared/sudoku-core.js · 멀티 서버: games/puzzle.js
 *  칸을 누르고 → 숫자를 눌러요. 「메모」를 켜면 작은 후보 숫자를 적어요. 키보드: 숫자 · 방향키 · Backspace · N(메모) · Z(되돌리기) · H(힌트)
 * ===================================================================== */
makeScreen('sudoku', {
  title: '🔢 스도쿠', status: '가로줄 · 세로줄 · 3×3 칸마다 1~9가 한 번씩만 들어가요.',
  stats: [['time', '시간'], ['miss', '실수'], ['left', '남은 칸']],
  body: `<div class="mode-row" id="su-solo"><span class="muted small">난이도</span>
      <button class="seg-btn" data-act="suLevel" data-l="easy">쉬움</button><button class="seg-btn on" data-act="suLevel" data-l="normal">보통</button><button class="seg-btn" data-act="suLevel" data-l="hard">어려움</button>
      <button class="seg-btn su-gap" data-act="suNew">새 퍼즐</button></div>
    <div class="su-wrap" id="su-wrap">
      <div class="su-board" id="su-board"></div>
      <div class="su-side">
        <div class="su-msg" id="su-msg"></div>
        <div class="su-pad" id="su-pad"></div>
        <div class="su-tools" id="su-tools"></div>
      </div>
    </div>`,
});

const SU = {
  level: 'normal', solo: true, sel: -1, noteMode: false, check: (() => { try { return localStorage.getItem('suCheck') !== '0'; } catch { return true; } })(),
  LEVEL_NAME: { easy: '쉬움', normal: '보통', hard: '어려움' },
  build() {
    if (this.built) return;
    $('#su-board').innerHTML = Array.from({ length: 81 }, (_, i) => `<div class="sc" data-i="${i}" role="button" tabindex="-1"></div>`).join('');
    this.cells = $$('#su-board .sc');
    $('#su-board').addEventListener('pointerdown', e => { const c = e.target.closest('.sc'); if (c) { e.preventDefault(); this.pick(+c.dataset.i); } });
    $('#su-pad').innerHTML = Array.from({ length: 9 }, (_, k) => `<button class="su-n" data-act="suNum" data-n="${k + 1}"><b>${k + 1}</b><small></small></button>`).join('');
    this.built = true;
    this.watch();
  },
  /** 새 퍼즐 (싱글) — 어려움은 만드는 데 잠깐 걸릴 수 있어서 한 박자 뒤에 */
  startSolo(level) {
    stopLocal();
    this.build();
    if (level) this.level = level;
    this.solo = true; S.solo = 'sudoku';
    $('#su-solo').classList.remove('hidden');
    $$('#su-solo [data-act=suLevel]').forEach(b => b.classList.toggle('on', b.dataset.l === this.level));
    setStatus('sudoku', `${this.LEVEL_NAME[this.level]} — 가로줄 · 세로줄 · 3×3 칸마다 1~9가 한 번씩만 들어가요.`);
    show('sudoku'); renderScores();
    this.msg('퍼즐을 만드는 중…');
    after(30, () => {
      const P = SudokuCore.make(this.level);
      this.load(P.givens, P.solution);
      this.msg('빈칸을 누르고 숫자를 골라요. 막히면 <b>힌트</b>가 이유까지 알려 줘요.');
    });
  },
  startMulti(d) {
    stopLocal();
    this.build();
    this.solo = false; this.level = d.level;
    $('#su-solo').classList.add('hidden');
    setStatus('sudoku', `${this.LEVEL_NAME[d.level] || ''} 대결 — 모두 같은 퍼즐! 먼저 다 맞게 채우는 사람이 우승해요.`);
    show('sudoku'); renderScores();
    this.load(d.givens, null, d.grid);
    this.endAt = Date.now() + d.left * 1000;
    this.msg('모두 같은 퍼즐이에요. 다 채우면 서버가 정답인지 확인해요.');
  },
  load(givens, solution, grid) {
    this.givens = SudokuCore.parse(givens);
    this.sol = solution ? SudokuCore.parse(solution) : null;
    this.grid = grid ? SudokuCore.parse(grid).map((v, i) => this.givens[i] || v) : this.givens.slice();
    this.notes = new Uint16Array(81);
    this.hist = []; this.sel = this.grid.findIndex(v => !v); this.miss = 0; this.hints = 0; this.done = false; this.hintAt = -1; this.lastSent = '';
    this.t0 = Date.now();
    this.paint();
    every(250, () => this.hud());
    this.fit();
  },
  /* ── 그리기 ── */
  paint() {
    if (!this.grid) return;
    const g = this.grid, sel = this.sel, sv = sel >= 0 ? g[sel] : 0;
    const bad = SudokuCore.conflicts(g);
    const peer = new Set(sel >= 0 ? SudokuCore.PEERS[sel] : []);
    for (let i = 0; i < 81; i++) {
      const el = this.cells[i], v = g[i], given = !!this.givens[i];
      const cls = ['sc'];
      if (given) cls.push('g'); else if (v) cls.push('u');
      if (i === sel) cls.push('sel'); else if (peer.has(i)) cls.push('peer');
      if (sv && v === sv && i !== sel) cls.push('same');
      if (bad.has(i) && !given) cls.push('bad');
      if (this.solo && this.check && v && !given && this.sol && v !== this.sol[i]) cls.push('wrong');
      if (i === this.hintAt) cls.push('hint');
      el.className = cls.join(' ');
      if (v) el.innerHTML = `<b>${v}</b>`;
      else if (this.notes[i]) el.innerHTML = `<i class="nt">${Array.from({ length: 9 }, (_, k) => `<s>${this.notes[i] & (1 << (k + 1)) ? k + 1 : ''}</s>`).join('')}</i>`;
      else el.innerHTML = '';
    }
    // 숫자판: 남은 개수 (9개 다 쓰면 흐리게)
    const used = Array(10).fill(0); for (const v of g) used[v]++;
    $$('#su-pad .su-n').forEach((b, k) => {
      const d = k + 1, left = 9 - used[d];
      b.querySelector('small').textContent = left > 0 ? left : '';
      b.classList.toggle('full', left <= 0);
      b.classList.toggle('cur', !!sv && d === sv);
    });
    $('#su-tools').innerHTML = [
      `<button class="btn sm ghost" data-act="suErase">${icon('eraser')}지우기</button>`,
      `<button class="btn sm ${this.noteMode ? 'good' : 'ghost'}" data-act="suNote" aria-pressed="${this.noteMode}">${icon('pencil')}메모 ${this.noteMode ? '켬' : '끔'}</button>`,
      `<button class="btn sm ghost" data-act="suUndo"${this.hist.length ? '' : ' disabled'}>${icon('arrow-back-up')}되돌리기</button>`,
      this.solo ? `<button class="btn sm ghost" data-act="suHint">${icon('bulb')}힌트</button>` : '',
      this.solo ? `<button class="btn sm ghost su-chk" data-act="suCheck" aria-pressed="${this.check}">${icon(this.check ? 'eye' : 'eye-off')}정답 확인 ${this.check ? '켬' : '끔'}</button>` : '',
    ].join('');
    this.hud();
  },
  hud() {
    if (!this.grid) return;
    const sec = this.solo ? Math.floor(((this.doneAt || Date.now()) - this.t0) / 1000) + this.hints * 30 : secLeft(this.endAt);
    setStat('sudoku', 'time', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    const lab = $('#sudoku-time-label'); if (lab) lab.textContent = this.solo ? '시간' : '남은 시간';
    setStat('sudoku', 'miss', this.solo && this.check ? this.miss : '-');
    setStat('sudoku', 'left', this.grid.filter(v => !v).length);
  },
  msg(html) { $('#su-msg').innerHTML = html; },
  /* ── 누르기 ── */
  pick(i) { if (this.done) return; this.sel = i; this.hintAt = -1; this.paint(); },
  editable(i) { return i >= 0 && !this.givens[i] && !this.done; },
  num(d) {
    const i = this.sel;
    if (!this.editable(i)) { if (i >= 0 && this.givens[i]) this.msg('처음부터 있던 숫자는 바꿀 수 없어요.'); return; }
    if (this.noteMode && !this.grid[i]) {
      this.push(i);
      this.notes[i] ^= 1 << d;
      return this.after();
    }
    this.push(i, true);
    if (this.grid[i] === d) { this.grid[i] = 0; return this.after(); }
    this.grid[i] = d; this.notes[i] = 0;
    for (const j of SudokuCore.PEERS[i]) this.notes[j] &= ~(1 << d);          // 같은 줄 · 칸의 메모에서 그 숫자를 지워요
    if (this.solo && this.check && this.sol && d !== this.sol[i]) { this.miss++; this.msg(`${d}은(는) 이 칸의 답이 아니에요. (실수 ${this.miss})`); }   // 정답 확인을 끄면 실수도 세지 않아요
    else this.msg(this.noteMode ? '메모 모드예요. 빈칸에서만 메모를 적어요.' : '');
    this.after();
  },
  erase() {
    const i = this.sel;
    if (!this.editable(i) || (!this.grid[i] && !this.notes[i])) return;
    this.push(i); this.grid[i] = 0; this.notes[i] = 0; this.after();
  },
  /** 되돌리기 기록 (칸 하나 + 숫자를 넣으면서 지워진 이웃 메모) */
  push(i, withPeers) {
    const peers = withPeers ? SudokuCore.PEERS[i].map(j => [j, this.notes[j]]) : [];
    this.hist.push({ i, v: this.grid[i], n: this.notes[i], peers });
    if (this.hist.length > 300) this.hist.shift();
  },
  undo() {
    const h = this.hist.pop(); if (!h || this.done) return;
    this.grid[h.i] = h.v; this.notes[h.i] = h.n;
    for (const [j, n] of h.peers) this.notes[j] = n;
    this.sel = h.i; this.after(true);
  },
  after() {
    this.paint();
    if (!this.solo) this.send();
    if (this.grid.every(v => v) && !SudokuCore.conflicts(this.grid).size) this.finish();
  },
  hint() {
    if (!this.solo || this.done || !this.sol) return;
    const h = SudokuCore.hint(this.grid, this.sol.join(''));
    if (!h) return;
    this.hints++;
    this.push(h.i, true);
    this.grid[h.i] = h.v; this.notes[h.i] = 0;
    for (const j of SudokuCore.PEERS[h.i]) this.notes[j] &= ~(1 << h.v);
    this.sel = h.i; this.hintAt = h.i;
    this.msg(`💡 ${h.text} <span class="muted">(힌트 +30초)</span>`);
    this.after();
  },
  move(dr, dc) {
    if (this.sel < 0) this.sel = 40;
    const r = (Math.floor(this.sel / 9) + dr + 9) % 9, c = (this.sel % 9 + dc + 9) % 9;
    this.pick(r * 9 + c);
  },
  /* ── 멀티: 판을 서버로 (진행률 · 정답 확인은 서버가) ── */
  send() {
    const s = this.grid.join('');
    if (s === this.lastSent) return;
    this.lastSent = s;
    clearTimeout(this.sendT);
    const full = !s.includes('0');
    this.sendT = setTimeout(() => socket.emit('pz:grid', s), full ? 0 : 250);
  },
  finish() {
    if (this.done) return;
    if (!this.solo) { this.msg('🎉 다 채웠어요! 서버가 정답을 확인하는 중…'); this.send(); return; }
    if (this.sol && this.grid.some((v, i) => v !== this.sol[i])) return;     // 싱글: 정답과 같을 때만
    this.done = true; this.doneAt = Date.now(); this.sel = -1; this.paint();
    const sec = Math.floor((this.doneAt - this.t0) / 1000) + this.hints * 30;
    const key = 'best-sudoku-' + this.level, prev = +store.get(key, 0);
    const best = prev ? Math.min(prev, sec) : sec; store.set(key, best);
    const t = s => `${Math.floor(s / 60)}분 ${s % 60}초`;
    $('#su-board').classList.add('win');
    after(1200, () => showResult({ title: '🎉 스도쿠 완성!', subtitle: `${this.LEVEL_NAME[this.level]} · ${t(sec)}${this.hints ? ` (힌트 ${this.hints}번 포함)` : ''} · 실수 ${this.miss}번 · 최고 기록 ${t(best)}${!prev || sec < prev ? ' 🏅 신기록!' : ''}`, solo: 'sudoku', win: true, rec: { k: this.level, v: sec } }));
  },
  /* ── 판 크기: 남은 높이 · 너비에 맞춰요 (core.js fitSquare) ── */
  fit() { fitSquare($('#scr-sudoku'), $('#su-wrap'), '--sz', 240, 640); },
  watch() {
    const again = () => { if (S.screen === 'sudoku') { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this.fit()); } };
    window.addEventListener('resize', again);
    window.addEventListener('orientationchange', () => setTimeout(again, 250));
    if (typeof ResizeObserver !== 'undefined') { let w = 0; new ResizeObserver(() => { const x = $('#su-wrap').clientWidth; if (Math.abs(x - w) > 1) { w = x; again(); } }).observe($('#su-wrap')); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  },
};
Object.assign(ACT, {
  suLevel: el => SU.startSolo(el.dataset.l),
  suNew: () => SU.startSolo(),
  suNum: el => SU.num(+el.dataset.n),
  suErase: () => SU.erase(),
  suNote: () => { SU.noteMode = !SU.noteMode; SU.paint(); SU.msg(SU.noteMode ? '메모 모드: 빈칸에 작은 후보 숫자를 적어요. 다시 누르면 지워져요.' : ''); },
  suUndo: () => SU.undo(),
  suHint: () => SU.hint(),
  suCheck: () => { SU.check = !SU.check; try { localStorage.setItem('suCheck', SU.check ? '1' : '0'); } catch { /* 무시 */ } SU.paint(); },
});
register('sudoku', {
  solo: () => SU.startSolo(),
  key: e => {
    if (!SU.grid || e.ctrlKey && e.code !== 'KeyZ' || e.metaKey || e.altKey) return;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    if (m) { e.preventDefault(); return +m[1] ? SU.num(+m[1]) : SU.erase(); }
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] }[e.code];
    if (mv) { e.preventDefault(); return SU.move(mv[0], mv[1]); }
    if (e.code === 'Backspace' || e.code === 'Delete') { e.preventDefault(); return SU.erase(); }
    if (e.code === 'KeyN') return ACT.suNote();
    if (e.code === 'KeyZ') { e.preventDefault(); return SU.undo(); }
    if (e.code === 'KeyH') return SU.hint();
  },
});
socket.on('pz:start', d => { if (d.game === 'sudoku') SU.startMulti(d); });
LOBBY_OPTIONS.sudoku = [{ key: 'suLevel', label: '🔢 난이도', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']] }];
