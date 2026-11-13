/* =====================================================================
 *  🧱 테트리스
 *  싱글 (v13.7): 들어올 때 고르는 카드(#tet-pick) — 👿 보스전 · 🧱 일반전 · 하는 중에는 옆 칸 [보스전 | 일반전]으로 바꿔요 (새 판)
 *   · 보스전: 2줄 이상 지워 보스 체력 20을 깎아요 · 보스는 12초마다 방해 줄 (기록 'tetris')
 *   · 일반전: 10줄마다 레벨 업 · 떨어지는 속도는 가이드라인 공식(레벨 1 = 1초 → 레벨 10 = 0.06초 → 13부터 거의 바로)
 *            빠를 때도 놓을 수 있게 바닥에 닿은 뒤 굳기까지 0.5초 (옮기거나 돌리면 다시 0.5초, 한 블록에 15번까지) (기록 'tetris:normal')
 *  터치 화면 조작 (TetTouch, 아래):
 *   · 손가락(기본): 화면 어디든 끌면 이동 · 톡 누르면 회전 · 아래로 끌면 천천히 · 아래로 휙 쓸면 바로 내리기 · 위로 쓸면 회전
 *   · 버튼: 왼손 ◀ ▶ (아래 ▼) · 오른손 큰 ⟳ (위에 따로 ⤓) — 자주 누르는 회전과 바로 내리기를 떨어뜨려 잘못 누르지 않게
 * ===================================================================== */
const Tetris = {
  SHAPES: { I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]], S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  COLORS: { I: '#3fd6f0', J: '#4d7cff', L: '#ff9f43', O: '#ffd23f', S: '#3fcf9b', T: '#a77cff', Z: '#ff5d73', G: '#59627e' },
  running: false,
  mode: store.get('tet-mode', 'boss') === 'normal' ? 'normal' : 'boss',
  MODE_NAME: { boss: '보스전', normal: '일반전' },
  /** 일반전 속도 (한 칸 떨어지는 ms) — 가이드라인 공식 (0.8 - (레벨-1)×0.007)^(레벨-1) 초 */
  speed(lv) { return Math.max(16, Math.round(1000 * Math.pow(0.8 - (lv - 1) * 0.007, lv - 1))); },
  normal() { return this.solo && this.mode === 'normal'; },
  bestOf(m) { return +store.get(m === 'normal' ? 'best-tetris-normal' : 'best-tetris', 0) || 0; },
  /** 싱글로 들어오기: 메뉴에서 오면 고르는 카드 · 「다시 하기」면 같은 게임으로 바로 */
  enter() {
    if (isScreen('tetris') && this.solo && this.picked) return this.start(true);
    this.choose();
  },
  /** 보스전 · 일반전 고르는 카드 (판은 아직 시작 안 해요) */
  choose() {
    stopLocal();
    this.solo = true; this.picked = false; this.running = false; this.dead = false; S.solo = 'tetris';
    this.grid = Array.from({ length: 20 }, () => Array(10).fill(null));
    this.p = null; this.next = null; this.pending = 0; this.score = 0; this.lines = 0; this.level = 1; this.bossHp = 20;
    $('#tetris-title .tt').textContent = '테트리스';
    $('#tetris-status').textContent = '보스전 · 일반전 중에서 골라요';
    $('#boss-box').classList.add('hidden'); $('#t-best-line').classList.add('hidden'); $('#tet-mode-box').classList.add('hidden');
    for (const m of ['boss', 'normal']) { const b = this.bestOf(m); $('#tet-pb-' + m).textContent = b ? `최고 ${b.toLocaleString()}점` : '첫 기록 도전!'; }
    const had = store.get('tet-mode', null) !== null;    // 한 번이라도 골랐을 때만 「지난번」 표시
    $$('#tet-pick .pick-opt').forEach(b => b.classList.toggle('last', had && b.dataset.m === this.mode));
    $('#tet-pick').classList.remove('hidden');
    TetTouch.paint();
    show('tetris'); renderScores(); this.hud(); this.render();
    if (typeof Fit !== 'undefined') Fit.schedule();
    setTimeout(() => { const b = $(`#tet-pick .pick-opt[data-m="${this.mode}"]`); if (b && !TOUCH) b.focus(); }, 60);
  },
  start(solo, mode) {
    stopLocal();
    this.solo = solo; S.solo = solo ? 'tetris' : null; this.picked = solo;
    if (solo && mode) { this.mode = mode === 'normal' ? 'normal' : 'boss'; store.set('tet-mode', this.mode); }
    const normal = this.normal();
    this.grid = Array.from({ length: 20 }, () => Array(10).fill(null));
    this.bag = []; this.score = 0; this.lines = 0; this.level = 1; this.acc = 0; this.pending = 0; this.dead = false;
    this.dropMs = normal ? this.speed(1) : 800;
    this.lockMs = normal ? Math.max(this.dropMs, 500) : 0;          // 일반전만: 바닥에 닿은 뒤 굳기까지 (0 = 다음 칸 차례에 바로)
    this.best = solo ? this.bestOf(this.mode) : 0; this.rec = false;
    this.next = this.take(); this.spawn();
    this.bossHp = 20;
    $('#tet-pick').classList.add('hidden');
    $('#boss-box').classList.toggle('hidden', !solo || normal);
    $('#t-best-line').classList.toggle('hidden', !solo);
    $('#tet-mode-box').classList.toggle('hidden', !solo);
    $$('#tet-mode-box .t-seg button').forEach(b => b.classList.toggle('on', b.dataset.m === this.mode));
    $('#tetris-title .tt').textContent = solo ? `테트리스 ${this.MODE_NAME[this.mode]}` : '테트리스 배틀';
    $('#tetris-status').textContent = TOUCH && TetTouch.mode === 'swipe' ? '끌면 이동 · 톡 누르면 회전 · 아래로 휙 쓸면 바로 내려요'
      : normal ? '10줄마다 레벨 업! 레벨이 오를수록 블록이 빨라져요.' : solo ? '2줄 이상 지우면 보스에게 데미지! 보스는 12초마다 방해 줄을 보내요.' : '2줄 이상 지우면 상대에게 공격! 마지막까지 살아남으세요.';
    TetTouch.paint();
    outSet.clear();
    show('tetris'); renderScores(); this.hud();
    if (typeof Fit !== 'undefined') Fit.schedule();
    this.running = true; this.last = performance.now();
    const loop = t => {
      if (!this.running) return;
      const dt = Math.min(250, Math.max(0, t - this.last)); this.last = t;
      this.acc += dt;
      if (this.acc >= this.dropMs) { this.acc = 0; this.step(); }
      if (this.lockMs && this.running && this.p) {                  // 일반전: 바닥에 닿아 있는 시간을 재서 굳혀요
        if (this.hit(this.p.m, this.p.x, this.p.y + 1)) { if ((this.landT += dt) >= this.lockMs) this.lock(); }
        else this.landT = 0;
      }
      this.render();
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
    if (solo && !normal) every(12000, () => { this.pending += this.bossHp < 10 ? 2 : 1; this.flash('👿 보스의 공격! 방해 줄이 올라와요'); });
  },
  take() { if (!this.bag.length) this.bag = shuffle(Object.keys(this.SHAPES)); return this.bag.pop(); },
  spawn() {
    const t = this.next; this.next = this.take();
    const m = this.SHAPES[t].map(r => [...r]);
    this.p = { t, m, x: Math.floor((10 - m[0].length) / 2), y: t === 'I' ? -1 : 0 };
    this.landT = 0; this.resets = 0;
    if (this.hit(this.p.m, this.p.x, this.p.y)) this.die();
  },
  hit(m, x, y) {
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const gx = x + c, gy = y + r;
      if (gx < 0 || gx >= 10 || gy >= 20) return true;
      if (gy >= 0 && this.grid[gy][gx]) return true;
    }
    return false;
  },
  move(dx, dy) { if (this.hit(this.p.m, this.p.x + dx, this.p.y + dy)) return false; this.p.x += dx; this.p.y += dy; if (dx) this.nudge(); return true; },
  rotate() {
    const m = this.p.m, n = m.length, rot = m.map((row, r) => row.map((_, c) => m[n - 1 - c][r]));
    for (const k of [0, 1, -1, 2, -2]) if (!this.hit(rot, this.p.x + k, this.p.y)) { this.p.m = rot; this.p.x += k; this.nudge(); return; }
  },
  /** 일반전: 바닥에 닿은 채 옮기거나 돌리면 굳는 시간을 처음부터 (한 블록에 15번까지) */
  nudge() { if (this.lockMs && this.landT > 0 && this.resets < 15) { this.landT = 0; this.resets++; } },
  step() { if (!this.move(0, 1) && !this.lockMs) this.lock(); },
  hardDrop() { while (this.move(0, 1)) this.score += 2; this.lock(); },
  lock() {
    if (!this.p || this.dead) return;
    const { m, x, y, t } = this.p;
    let top = false;
    m.forEach((row, r) => row.forEach((v, c) => { if (!v) return; if (y + r < 0) top = true; else this.grid[y + r][x + c] = t; }));
    if (top) return this.die();
    let cleared = 0;
    for (let r = 19; r >= 0; r--) if (this.grid[r].every(Boolean)) { this.grid.splice(r, 1); this.grid.unshift(Array(10).fill(null)); cleared++; r++; }
    if (cleared) {
      this.lines += cleared;
      this.score += [0, 100, 300, 500, 800][cleared] * this.level;
      const lv0 = this.level;
      this.level = 1 + Math.floor(this.lines / 10);
      if (this.normal()) {
        this.dropMs = this.speed(this.level); this.lockMs = Math.max(this.dropMs, 500);
        this.flash(this.level > lv0 ? `⬆️ 레벨 ${this.level}! 더 빨라져요` : cleared === 4 ? '🎉 테트리스! 4줄' : `${cleared}줄 지웠어요`);
      } else this.dropMs = Math.max(90, 800 - (this.level - 1) * 70);
      const atk = this.normal() ? 0 : cleared === 4 ? 4 : cleared - 1;
      if (atk > 0) {
        const cancel = Math.min(this.pending, atk); this.pending -= cancel;   // 받을 공격을 먼저 상쇄
        const send = atk - cancel;
        if (this.solo) { this.bossHp = Math.max(0, this.bossHp - atk); this.flash(`💥 보스에게 ${atk} 데미지!`); if (!this.bossHp) return this.win(); }
        else if (send > 0) { socket.emit('tetris:attack', send); this.flash(`⚔️ 상대에게 ${send}줄 공격!`); }
      }
    }
    if (this.pending > 0) this.addGarbage(Math.min(this.pending, 8));
    if (!this.solo) socket.emit('tetris:score', this.score);
    this.hud();
    this.spawn();
  },
  addGarbage(n) {
    this.pending = 0;
    for (let i = 0; i < n; i++) {
      if (this.grid[0].some(Boolean)) return this.die();
      this.grid.shift();
      const row = Array(10).fill('G'); row[rand(10)] = null; this.grid.push(row);
    }
    $('#tetris-cv').classList.remove('flash'); void $('#tetris-cv').offsetWidth; $('#tetris-cv').classList.add('flash');
  },
  /** 이 기기 최고 점수 저장 → [이전 최고, 신기록인지] */
  keepBest() {
    const key = this.mode === 'normal' ? 'best-tetris-normal' : 'best-tetris', prev = this.bestOf(this.mode);
    if (this.score > prev) store.set(key, this.score);
    return [prev, this.score > prev && prev > 0];
  },
  die() {
    if (this.dead) return;
    this.dead = true; this.running = false; this.render(true);
    if (this.solo) {
      const [prev, rec] = this.keepBest(), sc = this.score.toLocaleString();
      if (this.normal()) after(600, () => showResult({ title: '🧱 게임 오버', subtitle: `일반전 · 레벨 ${this.level} · ${this.lines}줄 · 점수 ${sc}${rec ? ' · 🎉 신기록!' : prev ? ` · 최고 ${Math.max(prev, this.score).toLocaleString()}점` : ''}`, solo: 'tetris', rec: { k: 'normal', v: this.score } }));
      else after(600, () => showResult({ title: '💀 게임 오버', subtitle: `보스전 · 점수 ${sc} · 남은 보스 체력 ${this.bossHp}${rec ? ' · 🎉 신기록!' : ''}`, solo: 'tetris', rec: { v: this.score } }));
    } else { socket.emit('tetris:dead'); $('#tetris-status').textContent = '💀 탈락! 다른 사람들의 경기를 기다리는 중…'; }
  },
  win() {
    this.running = false; this.render();
    const [, rec] = this.keepBest();
    after(500, () => showResult({ title: '🏆 보스 처치!', subtitle: `보스전 · 점수 ${this.score.toLocaleString()} · ${this.lines}줄${rec ? ' · 🎉 신기록!' : ''}`, solo: 'tetris', win: true, rec: { v: this.score } }));
  },
  flash(msg) { $('#tetris-status').textContent = msg; },
  hud() {
    $('#t-score').textContent = this.score.toLocaleString();
    $('#t-lines').textContent = `${this.lines} / ${this.level}`;
    $('#boss-hp-text').textContent = this.bossHp; $('#boss-hp-bar').style.width = this.bossHp / 20 * 100 + '%';
    if (this.solo) {
      $('#t-best').textContent = Math.max(this.best || 0, this.running || this.dead ? this.score : 0).toLocaleString();
      if (!this.rec && this.best > 0 && this.score > this.best && this.running) { this.rec = true; this.flash('🎉 신기록 갱신 중!'); $('#t-score-box').classList.add('rec'); }
      else if (!this.rec) $('#t-score-box').classList.remove('rec');
    }
  },
  cell(c, x, y, color, sz = 30, alpha = 1) {
    c.globalAlpha = alpha; c.fillStyle = color; c.fillRect(x * sz + 1, y * sz + 1, sz - 2, sz - 2);
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x * sz + 1, y * sz + 1, sz - 2, 4); c.globalAlpha = 1;
  },
  render(gray) {
    const c = $('#tetris-cv').getContext('2d');
    c.fillStyle = '#0b0e1a'; c.fillRect(0, 0, 300, 600);
    c.strokeStyle = 'rgba(255,255,255,.04)';
    for (let i = 1; i < 10; i++) { c.beginPath(); c.moveTo(i * 30, 0); c.lineTo(i * 30, 600); c.stroke(); }
    for (let i = 1; i < 20; i++) { c.beginPath(); c.moveTo(0, i * 30); c.lineTo(300, i * 30); c.stroke(); }
    this.grid.forEach((row, y) => row.forEach((t, x) => { if (t) this.cell(c, x, y, gray ? '#444' : this.COLORS[t]); }));
    if (this.p && !this.dead) {
      let gy = this.p.y; while (!this.hit(this.p.m, this.p.x, gy + 1)) gy++;
      this.p.m.forEach((row, r) => row.forEach((v, cc) => { if (v && gy + r >= 0) this.cell(c, this.p.x + cc, gy + r, this.COLORS[this.p.t], 30, .22); }));
      this.p.m.forEach((row, r) => row.forEach((v, cc) => { if (v && this.p.y + r >= 0) this.cell(c, this.p.x + cc, this.p.y + r, this.COLORS[this.p.t]); }));
    }
    if (this.pending) { c.fillStyle = '#ff5d73'; c.fillRect(0, 600 - this.pending * 30, 4, this.pending * 30); }
    if (gray) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, 0, 300, 600); c.fillStyle = '#fff'; c.font = '32px \"Black Han Sans\", sans-serif'; c.textAlign = 'center'; c.fillText('GAME OVER', 150, 300); }
    const n = $('#tetris-next').getContext('2d'); n.fillStyle = '#0b0e1a'; n.fillRect(0, 0, 110, 80);
    if (!this.next) return;
    const m = this.SHAPES[this.next], ox = (110 - m[0].length * 22) / 2 / 22, oy = (80 - m.length * 22) / 2 / 22;
    m.forEach((row, r) => row.forEach((v, cc) => { if (v) this.cell(n, cc + ox, r + oy, this.COLORS[this.next], 22); }));
  },
};
/* ── 터치 조작 ── */
const TetTouch = {
  g: null,
  get mode() { return store.get('tetCtl', 'swipe') === 'btn' ? 'btn' : 'swipe'; },
  set mode(v) { store.set('tetCtl', v === 'btn' ? 'btn' : 'swipe'); },
  /** 화면에서 한 칸의 크기 (px) — 손가락이 한 칸만큼 움직이면 블록도 한 칸 */
  cell() { const r = $('#tetris-cv').getBoundingClientRect(); return Math.max(14, r.width / 10 || 24); },
  down(e) {
    if (!Tetris.running) return;
    const t = performance.now();
    this.g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: t, cx: e.clientX, cy: e.clientY, axis: null, moved: false, done: false, rot: false, hist: [[e.clientX, e.clientY, t]] };
  },
  move(e) {
    const g = this.g; if (!g || e.pointerId !== g.id || g.done || !Tetris.running) return;
    const x = e.clientX, y = e.clientY, t = performance.now(), cs = this.cell();
    g.hist.push([x, y, t]); if (g.hist.length > 6) g.hist.shift();
    const dx = x - g.x0, dy = y - g.y0;
    if (!g.axis && Math.hypot(dx, dy) > 10) g.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : dy > 0 ? 'v' : 'u';   // 처음 움직인 방향으로만
    if (g.axis === 'h') {
      const step = cs * 0.85;
      while (x - g.cx >= step) { g.cx += step; if (Tetris.move(1, 0)) { g.moved = true; this.buzz(); } }
      while (g.cx - x >= step) { g.cx -= step; if (Tetris.move(-1, 0)) { g.moved = true; this.buzz(); } }
    } else if (g.axis === 'v') {
      if (dy > cs * 1.6 && this.speed(g) > 1.0) return this.drop(g);               // 휙! → 바로 내리기
      while (y - g.cy >= cs) {                                                        // 천천히 끌면 한 칸씩
        g.cy += cs; g.moved = true;
        if (Tetris.move(0, 1)) Tetris.score += 1; else { Tetris.lock(); g.done = true; break; }
        Tetris.acc = 0;
      }
    } else if (g.axis === 'u' && !g.rot && dy < -cs * 1.2) { g.rot = true; g.moved = true; Tetris.rotate(); this.buzz(); }
    Tetris.render();
  },
  cancel() { this.g = null; },
  up(e) {
    const g = this.g; if (!g || e.pointerId !== g.id) return;
    this.g = null;
    if (!Tetris.running || g.done) return;
    const dt = performance.now() - g.t0, d = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
    if (g.axis === 'v' && e.clientY - g.y0 > this.cell() && this.speed(g) > 0.8) return this.drop(g);   // 짧게 휙 쓸고 뗐을 때
    if (!g.moved && d < 14 && dt < 400) { Tetris.rotate(); this.buzz(); Tetris.render(); }               // 톡 → 회전
  },
  /** 최근 손가락 속도 (아래 방향, px/ms) */
  speed(g) { const a = g.hist[0], b = g.hist[g.hist.length - 1]; return (b[1] - a[1]) / Math.max(8, b[2] - a[2]); },
  drop(g) { g.done = true; g.moved = true; Tetris.hardDrop(); this.buzz(16); Tetris.render(); },
  buzz(ms = 7) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* 무시 */ } },
  /** 옆 칸의 [손가락 | 버튼] 표시 */
  paint() { $$('#scr-tetris .t-ctl .t-seg button').forEach(b => b.classList.toggle('on', b.dataset.m === this.mode)); },
};
TouchArea.add('tetris', TetTouch);                                // 화면 어디든 (판 바깥 빈 곳까지)
ACT.tetCtl = el => {
  TetTouch.mode = el.dataset.m; TetTouch.paint(); updatePad(); Fit.schedule();
  toast(TetTouch.mode === 'btn' ? '버튼으로 조작해요. ◀ ▶ 이동 · ⟳ 회전 · ⤓ 바로 내리기' : '손가락으로 조작해요. 끌면 이동 · 톡 회전 · 아래로 휙 바로 내리기');
};
Object.assign(ACT, {
  tetPick: el => Tetris.start(true, el.dataset.m),                                  // 고르는 카드
  tetMode: el => { if (Tetris.solo && el.dataset.m !== Tetris.mode) Tetris.start(true, el.dataset.m); },   // 하는 중에 바꾸기 (새 판)
});
register('tetris', { solo: () => Tetris.enter(), stop: () => { Tetris.running = false; TetTouch.g = null; },
  // 버튼 조작일 때만 패드 (왼손 ◀ ▶ / ▼ · 오른손 ⤓ / ⟳) — 손가락 조작이면 패드 없이 판을 크게
  get pad() { return TetTouch.mode === 'btn' ? ['ArrowLeft', 'ArrowRight', 'ArrowDown', '|', 'Space', 'ArrowUp'] : null; },
  padLabel: { ArrowUp: '⟳', Space: '⤓' }, padRepeat: ['ArrowLeft', 'ArrowRight', 'ArrowDown'],
  key: e => {
  if (!Tetris.running) {                                                          // 고르는 카드: 1 보스전 · 2 일반전
    if (!$('#tet-pick').classList.contains('hidden') && (e.key === '1' || e.key === '2')) { e.preventDefault(); Tetris.start(true, e.key === '1' ? 'boss' : 'normal'); }
    return;
  }
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(k)) e.preventDefault(); else return;
  if (k === 'ArrowLeft') Tetris.move(-1, 0);
  else if (k === 'ArrowRight') Tetris.move(1, 0);
  else if (k === 'ArrowDown') { if (Tetris.move(0, 1)) Tetris.score += 1; else Tetris.lock(); Tetris.acc = 0; }
  else if (k === 'ArrowUp') Tetris.rotate();
  else if (k === ' ') Tetris.hardDrop();
  Tetris.render();
} });
socket.on('tetris:start', () => Tetris.start(false));
socket.on('tetris:garbage', d => { if (!Tetris.running) return; Tetris.pending += d.lines; Tetris.flash(`⚠️ ${d.from} 님의 공격! 방해 줄 ${d.lines}개`); });

