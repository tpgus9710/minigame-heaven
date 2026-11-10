/* =====================================================================
 *  ⏱️ 1 to 50
 * ===================================================================== */
const Race = {
  next: 1, t0: 0, solo: false,
  start(solo) {
    stopLocal();
    this.solo = solo; S.solo = solo ? 'race' : null; this.next = 1; this.t0 = performance.now();   // 일시정지하면 멈추는 시계 (pause.js)
    $('#race-grid').innerHTML = shuffle([...Array(25)].map((_, i) => i + 1))
      .map(n => `<button class="rbtn" data-act="race" data-n="${n}">${n}</button>`).join('');
    $('#race-next').textContent = '1';
    show('race'); renderScores();
    every(100, () => { $('#race-time').textContent = ((performance.now() - this.t0) / 1000).toFixed(1); });
  },
  press(btn) {
    const n = +btn.dataset.n;
    if (this.next > 50) return;
    if (n !== this.next) { btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong'); return; }
    if (n <= 25) { btn.dataset.n = n + 25; btn.textContent = n + 25; btn.classList.add('second'); }
    else btn.classList.add('done');
    this.next++;
    $('#race-next').textContent = this.next > 50 ? '🏁' : this.next;
    if (!this.solo) socket.emit('race:progress', this.next - 1);
    else if (this.next > 50) {
      const t = (performance.now() - this.t0) / 1000;
      const prev = +store.get('best-race', 0);
      const best = prev ? Math.min(prev, t) : t; store.set('best-race', best);
      showResult({ title: '🏁 완료!', subtitle: `기록 ${t.toFixed(2)}초 · 최고 기록 ${best.toFixed(2)}초${t <= best && prev ? ' 🎉 신기록!' : ''}`, solo: 'race', rec: { v: +t.toFixed(2) } });
    }
  },
};
socket.on('race:start', () => Race.start(false));
register('race', { solo: () => Race.start(true) });
