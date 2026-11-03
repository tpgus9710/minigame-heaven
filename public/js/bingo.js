/* =====================================================================
 *  🎱 빙고 (멀티 전용) — 돌아가며 숫자를 부르고, 먼저 3줄 완성!
 * ===================================================================== */
const BINGO_LINES = [];
for (let i = 0; i < 5; i++) { BINGO_LINES.push([0, 1, 2, 3, 4].map(k => i * 5 + k)); BINGO_LINES.push([0, 1, 2, 3, 4].map(k => k * 5 + i)); }
BINGO_LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);

const Bingo = {
  start(d) {
    stopLocal();
    Object.assign(this, { board: d.board, target: d.target, called: [], phase: 'setup', turnId: null, endsAt: Date.now() + d.seconds * 1000, last: null });
    show('bingo'); renderScores(); this.render();
    every(250, () => { $('#bingo-time').textContent = this.endsAt ? secLeft(this.endsAt) : '-'; });
  },
  render() {
    const set = new Set(this.called);
    const done = BINGO_LINES.filter(l => l.every(i => set.has(this.board[i])));
    const inLine = new Set(done.flat());
    const myTurn = this.phase === 'play' && this.turnId === S.myId;
    $('#bingo-board').innerHTML = this.board.map((n, i) =>
      `<button class="bcell ${set.has(n) ? 'on' : ''} ${inLine.has(i) ? 'line' : ''} ${n === this.last ? 'last' : ''}" ${myTurn && !set.has(n) ? `data-act="bingoPick" data-n="${n}"` : 'disabled'}>${n}</button>`).join('');
    $('#bingo-board').classList.toggle('my-turn', myTurn);
    $('#bingo-lines').textContent = `${done.length} / ${this.target}`;
    $('#bingo-called').innerHTML = this.called.length
      ? this.called.map(n => `<span class="${n === this.last ? 'last' : ''}">${n}</span>`).join('')
      : '<span class="muted small">아직 부른 숫자가 없어요</span>';
    $('#bingo-shuffle').classList.toggle('hidden', this.phase !== 'setup');
  },
};
Object.assign(ACT, {
  bingoPick: el => socket.emit('bingo:pick', +el.dataset.n),
  bingoShuffle: () => socket.emit('bingo:shuffle'),
});
register('bingo', {});
socket.on('bingo:start', d => {
  Bingo.start(d);
  $('#bingo-status').textContent = '🔀 마음에 드는 판이 나올 때까지 섞어 보세요! 곧 시작합니다.';
});
socket.on('bingo:board', d => { Bingo.board = d.board; Bingo.render(); });
socket.on('bingo:turn', d => {
  Object.assign(Bingo, { phase: 'play', turnId: d.id, endsAt: Date.now() + d.seconds * 1000 });
  $('#bingo-status').textContent = d.id === S.myId ? '🟢 내 차례! 내 판에서 부를 숫자를 누르세요.' : `⏳ ${d.name} 님이 숫자를 고르는 중…`;
  Bingo.render();
});
socket.on('bingo:called', d => {
  Bingo.called.push(d.n); Bingo.last = d.n; Bingo.endsAt = 0;
  $('#bingo-status').textContent = `📣 ${d.by} 님${d.auto ? '(시간 초과·자동)' : ''}: ${d.n}!`;
  Bingo.render();
});
