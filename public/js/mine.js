/* =====================================================================
 *  💣 지뢰찾기 (싱글: 초급·중급·고급 / 멀티: 같은 판 속도 대결)
 * ===================================================================== */
const MINE_LEVELS = {
  easy: { w: 9, h: 9, n: 10, label: '초급' },
  normal: { w: 16, h: 16, n: 40, label: '중급' },
  hard: { w: 30, h: 16, n: 99, label: '고급' },
};
const Mine = {
  level: 'normal', flagMode: false,

  setup(w, h, n) {
    Object.assign(this, { w, h, n, opened: 0, over: false, started: false, t0: 0, flags: 0, lastPct: -1, finalSec: 0 });
    const sz = w * h;
    this.mine = new Uint8Array(sz); this.open = new Uint8Array(sz); this.flag = new Uint8Array(sz); this.adj = new Uint8Array(sz);
    const grid = $('#mine-grid');
    grid.style.gridTemplateColumns = `repeat(${w}, 28px)`;
    grid.innerHTML = Array.from({ length: sz }, (_, i) => `<div class="mc" data-i="${i}"></div>`).join('');
    this.cells = $$('.mc', grid);
    this.hud();
  },
  nb(i) {
    const { w, h } = this, r = Math.floor(i / w), c = i % w, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(rr * w + cc);
    }
    return out;
  },
  place(mines) {
    mines.forEach(i => { this.mine[i] = 1; });
    for (let i = 0; i < this.mine.length; i++) this.adj[i] = this.nb(i).filter(j => this.mine[j]).length;
    this.started = true; this.t0 = Date.now();
  },
  startSolo(level) {
    stopLocal();
    this.solo = true; S.solo = 'mine';
    if (level) this.level = level;
    const L = MINE_LEVELS[this.level];
    this.setup(L.w, L.h, L.n);
    $('#mine-levels').classList.remove('hidden');
    $$('#mine-levels .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.level === this.level));
    $('#mine-status').textContent = `${L.label} — 아무 칸이나 눌러 시작하세요. 첫 칸은 항상 안전해요!`;
    show('mine'); renderScores();
    every(250, () => this.hud());
  },
  startMulti(d) {
    stopLocal();
    this.solo = false;
    this.setup(d.w, d.h, d.mines.length);
    this.place(d.mines);
    this.endAt = Date.now() + d.seconds * 1000;
    $('#mine-levels').classList.add('hidden');
    $('#mine-status').textContent = '모두 같은 판이에요! 지뢰를 밟으면 탈락, 먼저 다 열면 우승!';
    show('mine'); renderScores();
    this.reveal(d.start[0] * d.w + d.start[1]);
    every(250, () => this.hud());
  },
  hud() {
    $('#mine-left').textContent = this.n - this.flags;
    const sec = this.solo ? (this.started && !this.over ? Math.floor((Date.now() - this.t0) / 1000) : this.finalSec || 0) : secLeft(this.endAt);
    $('#mine-time').textContent = sec;
    $('#mine-time-label').textContent = this.solo ? '시간' : '남은 시간';
    $('#mine-flag').textContent = this.flagMode ? '🚩 깃발 모드 켬' : '⛏️ 열기 모드';
  },
  draw(i) {
    const el = this.cells[i];
    el.className = 'mc';
    el.textContent = '';
    if (this.open[i]) {
      el.classList.add('o');
      if (this.mine[i]) { el.textContent = '💣'; }
      else if (this.adj[i]) { el.textContent = this.adj[i]; el.classList.add('n' + this.adj[i]); }
    } else if (this.flag[i]) el.textContent = '🚩';
  },
  act(i, flagClick) {
    if (this.over || !isScreen('mine')) return;
    if ((flagClick || this.flagMode) && !this.open[i]) {
      this.flag[i] ^= 1; this.flags += this.flag[i] ? 1 : -1;
      this.draw(i); this.hud(); return;
    }
    if (this.open[i]) {                           // 숫자 칸: 깃발 수가 맞으면 주변 한꺼번에 열기
      const ns = this.nb(i);
      if (this.adj[i] && ns.filter(j => this.flag[j]).length === this.adj[i]) ns.forEach(j => { if (!this.flag[j] && !this.open[j]) this.reveal(j); });
      return;
    }
    if (this.flag[i]) return;
    if (this.solo && !this.started) {             // 첫 클릭 주변 3x3은 안전하게
      const safe = new Set([i, ...this.nb(i)]);
      const cand = shuffle([...Array(this.w * this.h).keys()].filter(j => !safe.has(j)));
      this.place(cand.slice(0, this.n));
    }
    this.reveal(i);
  },
  reveal(i) {
    if (this.over || this.open[i] || this.flag[i]) return;
    if (this.mine[i]) return this.boom(i);
    const stack = [i];
    while (stack.length) {
      const k = stack.pop();
      if (this.open[k] || this.flag[k]) continue;
      this.open[k] = 1; this.opened++; this.draw(k);
      if (!this.adj[k]) this.nb(k).forEach(j => { if (!this.open[j] && !this.mine[j]) stack.push(j); });
    }
    const total = this.w * this.h - this.n;
    if (!this.solo) {
      const pct = Math.floor(this.opened / total * 100);
      if (pct !== this.lastPct && this.opened < total) { this.lastPct = pct; socket.emit('mine:progress', pct); }
    }
    if (this.opened >= total) this.win();
  },
  boom(i) {
    this.over = true; this.finalSec = Math.floor((Date.now() - this.t0) / 1000);
    for (let k = 0; k < this.mine.length; k++) if (this.mine[k]) { this.open[k] = 1; this.draw(k); }
    this.cells[i].classList.add('boom');
    $('#mine-status').textContent = '💥 펑! 지뢰를 밟았어요.';
    if (this.solo) after(900, () => showResult({ title: '💥 지뢰를 밟았어요!', subtitle: `${MINE_LEVELS[this.level].label} · ${Math.floor(this.opened / (this.w * this.h - this.n) * 100)}% 진행`, solo: 'mine' }));
    else { socket.emit('mine:boom'); $('#mine-status').textContent = '💥 탈락! 다른 사람들을 기다리는 중…'; }
  },
  win() {
    this.over = true; this.finalSec = Math.floor((Date.now() - this.t0) / 1000);
    for (let k = 0; k < this.mine.length; k++) if (this.mine[k] && !this.flag[k]) { this.flag[k] = 1; this.draw(k); }
    this.flags = this.n; this.hud();
    $('#mine-status').textContent = '🎉 모든 칸을 열었어요!';
    if (!this.solo) return socket.emit('mine:clear');
    const key = 'best-mine-' + this.level, prev = +store.get(key, 0);
    const best = prev ? Math.min(prev, this.finalSec) : this.finalSec; store.set(key, best);
    after(600, () => showResult({ title: '🎉 지뢰 제거 성공!', subtitle: `${MINE_LEVELS[this.level].label} · ${this.finalSec}초 (최고 기록 ${best}초)${!prev || this.finalSec < prev ? ' 🏅 신기록!' : ''}`, solo: 'mine' }));
  },
};
$('#mine-grid').addEventListener('click', e => { const c = e.target.closest('.mc'); if (c) Mine.act(+c.dataset.i, false); });
$('#mine-grid').addEventListener('contextmenu', e => { e.preventDefault(); const c = e.target.closest('.mc'); if (c) Mine.act(+c.dataset.i, true); });
Object.assign(ACT, {
  mineLevel: el => Mine.startSolo(el.dataset.level),
  mineFlag: () => { Mine.flagMode = !Mine.flagMode; Mine.hud(); },
});
register('mine', { solo: () => Mine.startSolo() });
socket.on('mine:start', d => Mine.startMulti(d));
