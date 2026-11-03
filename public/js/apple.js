/* =====================================================================
 *  🍎 사과 게임
 * ===================================================================== */
const randomBoard = () => Array.from({ length: 10 }, () => Array.from({ length: 17 }, () => 1 + rand(9)));
const Apple = {
  score: 0, solo: false, end: 0,
  start(board, duration, solo) {
    stopLocal();
    this.solo = solo; S.solo = solo ? 'apple' : null; this.score = 0;
    const el = $('#apple-board');
    el.innerHTML = '<div id="apple-sel"></div><div id="apple-sum"></div>' +
      board.flat().map(v => `<div class="apple" data-v="${v}">${v}</div>`).join('');
    $('#apple-score').textContent = '0';
    $('#apple-mode').textContent = solo ? '혼자 하기 — 2분 동안 최고 점수에 도전!' : '모두 같은 판으로 대결 중! 합이 10이 되게 드래그하세요.';
    this.end = Date.now() + duration * 1000;
    show('apple'); renderScores();
    every(250, () => {
      const left = secLeft(this.end);
      $('#apple-time').textContent = left;
      if (this.solo && left <= 0) {
        const best = Math.max(+store.get('best-apple', 0), this.score); store.set('best-apple', best);
        showResult({ title: '🍎 시간 종료!', subtitle: `이번 점수 ${this.score}개 · 최고 기록 ${best}개`, solo: 'apple' });
      }
    });
  },
};
(() => {
  const board = $('#apple-board');
  let start = null;
  const local = e => { const r = board.getBoundingClientRect(); return { x: e.clientX - r.left - board.clientLeft, y: e.clientY - r.top - board.clientTop }; };
  function update(e) {
    const p = local(e);
    const x1 = Math.min(start.x, p.x), x2 = Math.max(start.x, p.x), y1 = Math.min(start.y, p.y), y2 = Math.max(start.y, p.y);
    const sel = $('#apple-sel');
    Object.assign(sel.style, { display: 'block', left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
    let sum = 0;
    $$('.apple', board).forEach(a => {
      if (a.classList.contains('eaten')) return;
      const cx = a.offsetLeft + a.offsetWidth / 2, cy = a.offsetTop + a.offsetHeight / 2;
      const inside = cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
      a.classList.toggle('sel', inside);
      if (inside) sum += +a.dataset.v;
    });
    const tip = $('#apple-sum');
    Object.assign(tip.style, { display: sum ? 'block' : 'none', left: x2 + 6 + 'px', top: y2 + 6 + 'px' });
    tip.textContent = sum; tip.classList.toggle('ten', sum === 10);
  }
  board.addEventListener('pointerdown', e => {
    if (!isScreen('apple') || (Apple.end && Date.now() > Apple.end)) return;
    board.setPointerCapture(e.pointerId); start = local(e); update(e);
  });
  board.addEventListener('pointermove', e => { if (start) update(e); });
  const finish = () => {
    if (!start) return; start = null;
    $('#apple-sel').style.display = 'none'; $('#apple-sum').style.display = 'none';
    const chosen = $$('.apple.sel', board);
    const sum = chosen.reduce((a, b) => a + +b.dataset.v, 0);
    chosen.forEach(a => a.classList.remove('sel'));
    if (sum === 10) {
      chosen.forEach(a => a.classList.add('eaten'));
      Apple.score += chosen.length;
      $('#apple-score').textContent = Apple.score;
      if (!Apple.solo) socket.emit('apple:score', Apple.score);
    }
  };
  board.addEventListener('pointerup', finish);
  board.addEventListener('pointercancel', finish);
})();
socket.on('apple:start', d => Apple.start(d.board, d.duration, false));
register('apple', { solo: () => Apple.start(randomBoard(), 120, true) });
