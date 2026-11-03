/* =====================================================================
 *  ⚫ 오목
 * ===================================================================== */
const Omok = {
  N: 15, G: 36, M: 28,
  start({ solo, black, white, blackId, whiteId }) {
    stopLocal();
    this.solo = solo; S.solo = solo ? 'omok' : null;
    this.board = Array.from({ length: 15 }, () => Array(15).fill(0));
    this.turn = 'black'; this.last = null; this.hover = null; this.over = false; this.thinking = false;
    this.myColor = solo ? 'black' : S.myId === blackId ? 'black' : S.myId === whiteId ? 'white' : null;
    $('#omok-nb').textContent = solo ? `${nick()} (나)` : black + (blackId === S.myId ? ' (나)' : '');
    $('#omok-nw').textContent = solo ? '🤖 컴퓨터' : white + (whiteId === S.myId ? ' (나)' : '');
    show('omok'); this.status(); this.draw();
  },
  status(text) {
    $('#omok-pb').classList.toggle('turn', !this.over && this.turn === 'black');
    $('#omok-pw').classList.toggle('turn', !this.over && this.turn === 'white');
    if (text) return ($('#omok-status').textContent = text);
    if (!this.myColor) return ($('#omok-status').textContent = `👀 관전 중 — ${this.turn === 'black' ? '흑돌' : '백돌'} 차례`);
    $('#omok-status').textContent = this.turn === this.myColor ? '🟢 내 차례예요! 돌을 놓으세요.' : (this.solo ? '🤖 컴퓨터가 생각 중…' : '⏳ 상대 차례예요.');
  },
  draw() {
    const cv = $('#omok-cv'), c = cv.getContext('2d'), { N, G, M } = this;
    const grd = c.createLinearGradient(0, 0, 560, 560); grd.addColorStop(0, '#e9c47a'); grd.addColorStop(1, '#d4a24f');
    c.fillStyle = grd; c.fillRect(0, 0, 560, 560);
    c.strokeStyle = 'rgba(60,35,10,.75)'; c.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      c.beginPath(); c.moveTo(M, M + i * G); c.lineTo(M + 14 * G, M + i * G); c.stroke();
      c.beginPath(); c.moveTo(M + i * G, M); c.lineTo(M + i * G, M + 14 * G); c.stroke();
    }
    c.fillStyle = 'rgba(60,35,10,.85)';
    for (const [r, cc] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) { c.beginPath(); c.arc(M + cc * G, M + r * G, 4, 0, 7); c.fill(); }
    const stone = (r, cc, v, alpha = 1) => {
      const x = M + cc * G, y = M + r * G;
      c.globalAlpha = alpha;
      const g = c.createRadialGradient(x - 5, y - 6, 2, x, y, 16);
      if (v === 1) { g.addColorStop(0, '#666'); g.addColorStop(1, '#050505'); } else { g.addColorStop(0, '#fff'); g.addColorStop(1, '#c9cdd6'); }
      c.fillStyle = g; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 4; c.shadowOffsetY = 2;
      c.beginPath(); c.arc(x, y, 15.5, 0, 7); c.fill();
      c.shadowBlur = 0; c.shadowOffsetY = 0; c.globalAlpha = 1;
    };
    for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) if (this.board[r][cc]) stone(r, cc, this.board[r][cc]);
    if (this.hover && !this.over && this.turn === this.myColor && !this.board[this.hover.r][this.hover.c]) stone(this.hover.r, this.hover.c, this.myColor === 'black' ? 1 : 2, .45);
    if (this.last) { c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(M + this.last.c * G, M + this.last.r * G, 4, 0, 7); c.fill(); }
  },
  cell(e) {
    const cv = $('#omok-cv'), r = cv.getBoundingClientRect(), k = cv.width / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    const c = Math.round((x - this.M) / this.G), rr = Math.round((y - this.M) / this.G);
    return rr >= 0 && rr < 15 && c >= 0 && c < 15 ? { r: rr, c } : null;
  },
  place(r, c, color) { this.board[r][c] = color === 'black' ? 1 : 2; this.last = { r, c }; this.draw(); },
  click(e) {
    const p = this.cell(e);
    if (!p || this.over || this.board[p.r][p.c] || this.turn !== this.myColor) return;
    if (!this.solo) return socket.emit('omok:place', p);
    if (this.thinking) return;
    this.place(p.r, p.c, 'black');
    if (omokWin(this.board, p.r, p.c, 1)) return this.endSolo(true);
    this.turn = 'white'; this.thinking = true; this.status();
    after(400, () => {
      const m = this.aiMove();
      this.place(m.r, m.c, 'white'); this.thinking = false;
      if (omokWin(this.board, m.r, m.c, 2)) return this.endSolo(false);
      this.turn = 'black'; this.status();
    });
  },
  endSolo(win) {
    this.over = true; this.status(win ? '🏆 승리!' : '💀 패배…'); this.draw();
    after(1000, () => showResult({ title: win ? '🏆 인간의 승리!' : '🤖 컴퓨터 승리', subtitle: win ? '컴퓨터를 이겼어요!' : '다시 도전해 보세요.', solo: 'omok', win }));
  },
  aiMove() {
    let best = -1, move = { r: 7, c: 7 };
    for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
      if (this.board[r][c]) continue;
      const s = this.evalCell(r, c, 2) * 1.1 + this.evalCell(r, c, 1) + (7 - Math.max(Math.abs(r - 7), Math.abs(c - 7))) * 0.1 + Math.random() * 0.5;
      if (s > best) { best = s; move = { r, c }; }
    }
    return move;
  },
  evalCell(r, c, v) {
    let total = 0;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let n = 1, open = 0;
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < 15 && cc >= 0 && cc < 15 && this.board[rr][cc] === v) { n++; rr += dr * s; cc += dc * s; }
        if (rr >= 0 && rr < 15 && cc >= 0 && cc < 15 && !this.board[rr][cc]) open++;
      }
      if (n >= 5) total += 100000;
      else if (n === 4) total += open === 2 ? 20000 : open === 1 ? 2500 : 0;
      else if (n === 3) total += open === 2 ? 1500 : open === 1 ? 150 : 0;
      else if (n === 2) total += open === 2 ? 100 : open === 1 ? 15 : 0;
      else total += open;
    }
    return total;
  },
};
function omokWin(b, r, c, v) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (rr >= 0 && rr < 15 && cc >= 0 && cc < 15 && b[rr][cc] === v) { n++; rr += dr * s; cc += dc * s; } }
    if (n >= 5) return true;
  }
  return false;
}
$('#omok-cv').addEventListener('click', e => Omok.click(e));
$('#omok-cv').addEventListener('mousemove', e => { const p = Omok.cell(e); if (JSON.stringify(p) !== JSON.stringify(Omok.hover)) { Omok.hover = p; Omok.draw(); } });
$('#omok-cv').addEventListener('mouseleave', () => { Omok.hover = null; Omok.draw(); });
socket.on('omok:start', d => Omok.start({ solo: false, ...d }));
socket.on('omok:move', d => {
  Omok.place(d.r, d.c, d.color);
  if (d.next) { Omok.turn = d.next; Omok.status(); } else { Omok.over = true; Omok.status('🏁 게임 끝!'); }
});
register('omok', { solo: () => Omok.start({ solo: true }) });
