/* =====================================================================
 *  🐍 스네이크 (싱글: 혼자 길게 / 멀티: 스네이크 배틀)
 * ===================================================================== */
const SNAKE_D = [[0, -1], [1, 0], [0, 1], [-1, 0]];       // 위, 오른쪽, 아래, 왼쪽
const Snake = {
  size(w, h, cell) {
    Object.assign(this, { w, h, cell });
    const cv = $('#snake-cv'); cv.width = w * cell; cv.height = h * cell;
  },
  /** 싱글 판 크기: 화면 모양에 맞춰요 (세로 휴대폰이면 세로로 긴 판 · 칸 수는 비슷하게 약 520칸) → 칸이 커져서 잘 보여요 */
  soloDims() {
    const W = Math.max(280, window.innerWidth - 24), H = Math.max(260, window.innerHeight - (window.innerWidth <= 760 ? 170 : 190));
    const ar = W / H, N = 520, h = Math.round(Math.sqrt(N / ar)), w = Math.round(N / Math.max(1, h));
    return [Math.max(14, Math.min(30, w)), Math.max(12, Math.min(32, h))];
  },
  startSolo() {
    stopLocal();
    this.solo = true; S.solo = 'snake';
    const [w, h] = this.soloDims(), y = Math.floor(h / 2), x = Math.max(4, Math.floor(w / 3));
    this.size(w, h, 24);
    this.me = { body: [[x, y], [x - 1, y], [x - 2, y], [x - 3, y]], dir: 1, queue: [], grow: 0 };
    this.food = []; this.addFood(); this.score = 0; this.speed = 130; this.dead = false;
    $('#snake-status').textContent = TOUCH ? '화면 아무 데나(빈 곳도) 밀어서 방향을 바꿔요. 사과를 먹으면 길어지고 빨라져요!' : '방향키(또는 WASD)로 움직여요. 사과를 먹으면 길어지고 빨라져요!';
    $('#snake-tlabel').textContent = '최고 기록';
    $('#snake-time').textContent = store.get('best-snake', 0);
    show('snake'); renderScores(); this.hud(4);
    this.drawSolo();
    after(900, () => this.stepSolo());
  },
  addFood() {
    const occ = new Set(this.me.body.map(c => c + ''));
    let f; do { f = [rand(this.w), rand(this.h)]; } while (occ.has(f + ''));
    this.food = [f];
  },
  stepSolo() {
    if (this.dead || !isScreen('snake')) return;
    const s = this.me;
    if (s.queue.length) s.dir = s.queue.shift();
    const h = s.body[0], nh = [h[0] + SNAKE_D[s.dir][0], h[1] + SNAKE_D[s.dir][1]];
    const hitSelf = s.body.slice(0, -1).some(c => c[0] === nh[0] && c[1] === nh[1]);
    if (nh[0] < 0 || nh[0] >= this.w || nh[1] < 0 || nh[1] >= this.h || hitSelf) return this.dieSolo();
    s.body.unshift(nh);
    if (nh[0] === this.food[0][0] && nh[1] === this.food[0][1]) {
      this.score += 10; s.grow += 2; this.speed = Math.max(60, this.speed - 3); this.addFood();
    }
    if (s.grow > 0) s.grow--; else s.body.pop();
    this.hud(s.body.length);
    this.drawSolo();
    after(this.speed, () => this.stepSolo());
  },
  dieSolo() {
    this.dead = true;
    const len = this.me.body.length;
    const best = Math.max(+store.get('best-snake', 0), len); store.set('best-snake', best);
    this.drawSolo(true);
    after(700, () => showResult({ title: '🐍 쾅! 부딪혔어요', subtitle: `길이 ${len} · 최고 기록 ${best}`, solo: 'snake', rec: { v: len } }));
  },
  drawSolo(dead) {
    this.draw([{ id: 'me', b: this.me.body, c: '#3fcf9b', a: !dead, n: '' }], this.food, 'me');
  },
  hud(len) { $('#snake-len').textContent = len; },

  startMulti(d) {
    stopLocal();
    this.solo = false;
    this.size(d.w, d.h, 18);
    $('#snake-status').textContent = (TOUCH ? '화면 아무 데나 밀어서 방향을 바꿔요. ' : '') + '벽이나 다른 뱀 몸에 부딪히면 탈락! 머리끼리 부딪히면 둘 다 탈락이에요.';
    $('#snake-tlabel').textContent = '남은 시간';
    show('snake'); renderScores();
    this.draw([], []);
  },
  onState(st) {
    if (!isScreen('snake') || this.solo) return;
    const mine = st.s.find(s => s.id === S.myId);
    this.hud(mine ? mine.b.length : '-');
    $('#snake-time').textContent = st.t;
    this.draw(st.s, st.f, S.myId, st.fz);
    if (mine && !mine.a) $('#snake-status').textContent = '💀 탈락! 남은 뱀들의 싸움을 지켜보세요.';
  },
  draw(snakes, food, myId, countdown) {
    const c = $('#snake-cv').getContext('2d'), { w, h, cell } = this;
    c.fillStyle = '#0d1424'; c.fillRect(0, 0, w * cell, h * cell);
    c.fillStyle = 'rgba(255,255,255,.025)';
    for (let y = 0; y < h; y++) for (let x = (y % 2); x < w; x += 2) c.fillRect(x * cell, y * cell, cell, cell);
    for (const [fx, fy] of food) {
      c.fillStyle = '#ff4d5e'; c.beginPath(); c.arc(fx * cell + cell / 2, fy * cell + cell / 2, cell * 0.36, 0, 7); c.fill();
      c.fillStyle = '#6bd36b'; c.fillRect(fx * cell + cell / 2 - 1, fy * cell + 2, 3, cell * 0.25);
    }
    for (const s of snakes) {
      c.globalAlpha = s.a ? 1 : 0.25;
      s.b.forEach(([x, y], i) => {
        c.fillStyle = s.c;
        const pad = i ? 2 : 1;
        c.beginPath(); c.roundRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.3); c.fill();
      });
      if (s.b.length) {   // 눈
        const [hx, hy] = s.b[0];
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(hx * cell + cell * 0.33, hy * cell + cell * 0.38, cell * 0.12, 0, 7); c.arc(hx * cell + cell * 0.67, hy * cell + cell * 0.38, cell * 0.12, 0, 7); c.fill();
        if (s.n) {
          c.font = `bold ${Math.max(11, cell * 0.65)}px "Noto Sans KR",sans-serif`; c.textAlign = 'center';
          c.fillStyle = s.id === myId ? '#ffe066' : '#fff';
          c.fillText(s.n + (s.id === myId ? ' (나)' : ''), hx * cell + cell / 2, hy * cell - 4);
        }
      }
      c.globalAlpha = 1;
    }
    if (countdown) {
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, w * cell, h * cell);
      c.fillStyle = '#fff'; c.font = '64px \"Black Han Sans\", sans-serif'; c.textAlign = 'center';
      c.fillText(countdown, w * cell / 2, h * cell / 2 + 20);
    }
  },
  turn(d) {
    if (this.solo) {
      const s = this.me, last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
      if (d !== last && (d + 2) % 4 !== last && s.queue.length < 2) s.queue.push(d);
    } else socket.emit('snake:dir', d);
  },
};
/* 화면 밀기(스와이프): 판 밖 빈 곳(양옆 검은 부분)을 밀어도 돼요. 손가락을 떼기 전에, 22px 움직이는 순간 바로 방향을 바꾸고
 * 손가락을 떼지 않고 이어서 다른 쪽으로 밀면 또 바꿔요 (예전: 판 안에서만 · 손을 뗄 때 바뀌어서 늦었어요) */
TouchArea.add('snake', {
  mouse: true, p: null,
  down(e) { this.p = { x: e.clientX, y: e.clientY }; },
  move(e) {
    const p = this.p; if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    Snake.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    this.p = { x: e.clientX, y: e.clientY };
  },
  up() { this.p = null; },
  cancel() { this.p = null; },
});
register('snake', {
  solo: () => Snake.startSolo(),
  stop: () => { Snake.dead = true; },
  key: e => { const d = DIR_KEYS[e.code]; if (d === undefined) return; e.preventDefault(); Snake.turn(d); },
});
socket.on('snake:start', d => Snake.startMulti(d));
socket.on('snake:state', st => Snake.onState(st));
