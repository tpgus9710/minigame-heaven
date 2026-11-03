/* =====================================================================
 *  🔢 2048 (싱글: 최고 점수 / 멀티: 3분 점수 대결)
 * ===================================================================== */
const G2048 = {
  start(solo, seconds) {
    stopLocal();
    this.solo = solo; S.solo = solo ? 'g2048' : null;
    this.grid = Array(16).fill(0); this.score = 0; this.over = false; this.fresh = new Set(); this.merged = new Set();
    this.add(); this.add();
    this.endAt = solo ? 0 : Date.now() + seconds * 1000;
    $('#g2048-status').textContent = solo ? '같은 숫자를 합쳐 2048을 만들어 보세요!' : '3분 동안 가장 높은 점수를 낸 사람이 우승!';
    $('#g2048-tlabel').textContent = solo ? '최고 점수' : '남은 시간';
    show('g2048'); renderScores(); this.render();
    if (!solo) every(250, () => { $('#g2048-time').textContent = secLeft(this.endAt); });
    else $('#g2048-time').textContent = store.get('best-2048', 0);
  },
  add() {
    const empty = this.grid.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    if (!empty.length) return;
    const i = empty[rand(empty.length)];
    this.grid[i] = Math.random() < 0.9 ? 2 : 4;
    this.fresh.add(i);
  },
  lines(dir) {      // 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽 — 각 줄을 "미는 방향 쪽부터" 나열
    const L = [];
    for (let k = 0; k < 4; k++) {
      const idx = [0, 1, 2, 3].map(j => (dir === 0 ? j * 4 + k : dir === 2 ? (3 - j) * 4 + k : dir === 3 ? k * 4 + j : k * 4 + (3 - j)));
      L.push(idx);
    }
    return L;
  },
  move(dir) {
    if (this.over) return;
    let moved = false;
    this.fresh = new Set(); this.merged = new Set();
    for (const idx of this.lines(dir)) {
      const vals = idx.map(i => this.grid[i]).filter(Boolean);
      const out = [], mergedAt = [];
      for (const v of vals) {
        if (out.length && out[out.length - 1] === v && !mergedAt[out.length - 1]) {
          out[out.length - 1] = v * 2; mergedAt[out.length - 1] = true; this.score += v * 2;
        } else out.push(v);
      }
      idx.forEach((i, j) => {
        const nv = out[j] || 0;
        if (this.grid[i] !== nv) moved = true;
        this.grid[i] = nv;
        if (mergedAt[j]) this.merged.add(i);
      });
    }
    if (!moved) return;
    this.add();
    this.render();
    if (!this.solo) socket.emit('g2048:score', this.score);
    if (this.isStuck()) this.end();
  },
  isStuck() {
    if (this.grid.includes(0)) return false;
    for (let i = 0; i < 16; i++) {
      if (i % 4 < 3 && this.grid[i] === this.grid[i + 1]) return false;
      if (i < 12 && this.grid[i] === this.grid[i + 4]) return false;
    }
    return true;
  },
  end() {
    this.over = true;
    if (this.solo) {
      const best = Math.max(+store.get('best-2048', 0), this.score); store.set('best-2048', best);
      after(700, () => showResult({ title: '🔢 더 이상 움직일 수 없어요!', subtitle: `점수 ${this.score.toLocaleString()} · 최고 블록 ${Math.max(...this.grid)} · 최고 점수 ${best.toLocaleString()}`, solo: 'g2048', rec: { v: this.score } }));
    } else {
      socket.emit('g2048:over');
      $('#g2048-status').textContent = '🧱 더 이상 움직일 수 없어요! 다른 사람들을 기다리는 중…';
    }
  },
  render() {
    $('#g2048-score').textContent = this.score.toLocaleString();
    $('#b2048').innerHTML = this.grid.map((v, i) =>
      `<div class="t2048 v${Math.min(v, 4096)} ${this.fresh.has(i) ? 'new' : ''} ${this.merged.has(i) ? 'merge' : ''}">${v || ''}</div>`).join('');
  },
};
(() => {   // 화면 밀기(스와이프)
  let p0 = null;
  const b = $('#b2048');
  b.addEventListener('pointerdown', e => { p0 = { x: e.clientX, y: e.clientY }; });
  b.addEventListener('pointerup', e => {
    if (!p0) return;
    const dx = e.clientX - p0.x, dy = e.clientY - p0.y; p0 = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
    G2048.move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  });
})();
const DIR_KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };   // e.code 기준 (한글 입력 상태에서도 WASD 동작)
register('g2048', {
  solo: () => G2048.start(true),
  key: e => { const d = DIR_KEYS[e.code]; if (d === undefined) return; e.preventDefault(); G2048.move(d); },
});
socket.on('g2048:start', d => G2048.start(false, d.seconds));
