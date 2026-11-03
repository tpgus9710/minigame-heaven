/* =====================================================================
 *  🧱 테트리스
 * ===================================================================== */
const Tetris = {
  SHAPES: { I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]], S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  COLORS: { I: '#3fd6f0', J: '#4d7cff', L: '#ff9f43', O: '#ffd23f', S: '#3fcf9b', T: '#a77cff', Z: '#ff5d73', G: '#59627e' },
  running: false,
  start(solo) {
    stopLocal();
    this.solo = solo; S.solo = solo ? 'tetris' : null;
    this.grid = Array.from({ length: 20 }, () => Array(10).fill(null));
    this.bag = []; this.score = 0; this.lines = 0; this.level = 1; this.dropMs = 800; this.acc = 0; this.pending = 0; this.dead = false;
    this.next = this.take(); this.spawn();
    this.bossHp = 20;
    $('#boss-box').classList.toggle('hidden', !solo);
    $('#tetris-title .tt').textContent = solo ? '테트리스 보스전' : '테트리스 배틀';
    $('#tetris-status').textContent = solo ? '2줄 이상 지우면 보스에게 데미지! 보스는 12초마다 방해 줄을 보내요.' : '2줄 이상 지우면 상대에게 공격! 마지막까지 살아남으세요.';
    outSet.clear();
    show('tetris'); renderScores(); this.hud();
    this.running = true; this.last = performance.now();
    const loop = t => {
      if (!this.running) return;
      this.acc += t - this.last; this.last = t;
      if (this.acc >= this.dropMs) { this.acc = 0; this.step(); }
      this.render();
      S.raf = requestAnimationFrame(loop);
    };
    S.raf = requestAnimationFrame(loop);
    if (solo) every(12000, () => { this.pending += this.bossHp < 10 ? 2 : 1; this.flash('👿 보스의 공격! 방해 줄이 올라와요'); });
  },
  take() { if (!this.bag.length) this.bag = shuffle(Object.keys(this.SHAPES)); return this.bag.pop(); },
  spawn() {
    const t = this.next; this.next = this.take();
    const m = this.SHAPES[t].map(r => [...r]);
    this.p = { t, m, x: Math.floor((10 - m[0].length) / 2), y: t === 'I' ? -1 : 0 };
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
  move(dx, dy) { if (this.hit(this.p.m, this.p.x + dx, this.p.y + dy)) return false; this.p.x += dx; this.p.y += dy; return true; },
  rotate() {
    const m = this.p.m, n = m.length, rot = m.map((row, r) => row.map((_, c) => m[n - 1 - c][r]));
    for (const k of [0, 1, -1, 2, -2]) if (!this.hit(rot, this.p.x + k, this.p.y)) { this.p.m = rot; this.p.x += k; return; }
  },
  step() { if (!this.move(0, 1)) this.lock(); },
  hardDrop() { while (this.move(0, 1)) this.score += 2; this.lock(); },
  lock() {
    const { m, x, y, t } = this.p;
    let top = false;
    m.forEach((row, r) => row.forEach((v, c) => { if (!v) return; if (y + r < 0) top = true; else this.grid[y + r][x + c] = t; }));
    if (top) return this.die();
    let cleared = 0;
    for (let r = 19; r >= 0; r--) if (this.grid[r].every(Boolean)) { this.grid.splice(r, 1); this.grid.unshift(Array(10).fill(null)); cleared++; r++; }
    if (cleared) {
      this.lines += cleared;
      this.score += [0, 100, 300, 500, 800][cleared] * this.level;
      this.level = 1 + Math.floor(this.lines / 10);
      this.dropMs = Math.max(90, 800 - (this.level - 1) * 70);
      const atk = cleared === 4 ? 4 : cleared - 1;
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
  die() {
    if (this.dead) return;
    this.dead = true; this.running = false; this.render(true);
    if (this.solo) after(600, () => showResult({ title: '💀 게임 오버', subtitle: `점수 ${this.score} · 남은 보스 체력 ${this.bossHp}`, solo: 'tetris' }));
    else { socket.emit('tetris:dead'); $('#tetris-status').textContent = '💀 탈락! 다른 사람들의 경기를 기다리는 중…'; }
  },
  win() {
    this.running = false; this.render();
    after(500, () => showResult({ title: '🏆 보스 처치!', subtitle: `점수 ${this.score} · ${this.lines}줄`, solo: 'tetris' }));
  },
  flash(msg) { $('#tetris-status').textContent = msg; },
  hud() {
    $('#t-score').textContent = this.score.toLocaleString();
    $('#t-lines').textContent = `${this.lines} / ${this.level}`;
    $('#boss-hp-text').textContent = this.bossHp; $('#boss-hp-bar').style.width = this.bossHp / 20 * 100 + '%';
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
    const m = this.SHAPES[this.next], ox = (110 - m[0].length * 22) / 2 / 22, oy = (80 - m.length * 22) / 2 / 22;
    m.forEach((row, r) => row.forEach((v, cc) => { if (v) this.cell(n, cc + ox, r + oy, this.COLORS[this.next], 22); }));
  },
};
register('tetris', { solo: () => Tetris.start(true), stop: () => { Tetris.running = false; }, key: e => {
  if (!Tetris.running) return;
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

