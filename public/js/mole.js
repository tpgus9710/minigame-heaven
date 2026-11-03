/* =====================================================================
 *  🔨 두더지 잡기 (싱글: 1분 기록 / 멀티: 같은 두더지를 먼저 때리기)
 * ===================================================================== */
const MOLE_PTS = { mole: 1, gold: 3, bomb: -3 };
/* 두더지 그림 (SVG): 안전모 쓴 광부 두더지 · 왕관 쓴 황금 두더지 · 폭탄 */
const MOLE_SVG = (() => {
  const body = (f1, f2, f3, belly) => `<defs><radialGradient id="mf${f2.slice(1)}" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="${f1}"/><stop offset=".6" stop-color="${f2}"/><stop offset="1" stop-color="${f3}"/></radialGradient></defs>
    <path d="M16 104 V56 a34 34 0 0 1 68 0 V104 Z" fill="url(#mf${f2.slice(1)})"/><ellipse cx="50" cy="84" rx="21" ry="22" fill="${belly}" opacity=".55"/>
    <circle cx="37" cy="52" r="5.5" fill="#15100c"/><circle cx="63" cy="52" r="5.5" fill="#15100c"/><circle cx="38.8" cy="50.2" r="1.8" fill="#fff"/><circle cx="64.8" cy="50.2" r="1.8" fill="#fff"/>
    <ellipse cx="50" cy="64" rx="9.5" ry="7" fill="#ff8fa3"/><ellipse cx="47" cy="62" rx="3" ry="1.8" fill="#ffd0da"/>
    <path d="M31 66 h-15 M31 70 l-14 5 M69 66 h15 M69 70 l14 5" stroke="rgba(20,12,6,.75)" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="29" cy="97" rx="11" ry="6.5" fill="#e8b7a0"/><ellipse cx="71" cy="97" rx="11" ry="6.5" fill="#e8b7a0"/>
    <path d="M22 95 v4 M27 94 v5 M32 95 v4 M68 95 v4 M73 94 v5 M78 95 v4" stroke="#b07a62" stroke-width="1.4"/>`;
  return {
    mole: `<svg viewBox="0 0 100 104">${body('#a87850', '#6b4528', '#3a2412', '#d7b08a')}
      <path d="M19 44 a31 27 0 0 1 62 0 q0 4 -4 4 h-54 q-4 0 -4 -4 Z" fill="#f2c230" stroke="#9a7410" stroke-width="1.5"/><rect x="15" y="44" width="70" height="6" rx="3" fill="#d9a514"/>
      <circle cx="50" cy="30" r="7" fill="#fff6c9" stroke="#9a7410" stroke-width="1.5"/><circle cx="50" cy="30" r="3.5" fill="#ffe680"/></svg>`,
    gold: `<svg viewBox="0 0 100 104">${body('#fff1a8', '#e8b923', '#8a6200', '#fff4c9')}
      <path d="M26 30 l8 14 l16 -18 l16 18 l8 -14 l-4 20 h-40 Z" fill="#ffd84a" stroke="#a87b00" stroke-width="1.6" stroke-linejoin="round"/><circle cx="50" cy="24" r="3.5" fill="#ff4d6d"/><circle cx="27" cy="29" r="2.5" fill="#4dc3ff"/><circle cx="73" cy="29" r="2.5" fill="#4dc3ff"/>
      <path d="M86 18 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 Z M12 40 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="#fff"/></svg>`,
    bomb: `<svg viewBox="0 0 100 104"><defs><radialGradient id="mbG" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#6b7280"/><stop offset=".55" stop-color="#1f2430"/><stop offset="1" stop-color="#05070b"/></radialGradient></defs>
      <circle cx="50" cy="66" r="32" fill="url(#mbG)"/><ellipse cx="38" cy="54" rx="9" ry="5" fill="rgba(255,255,255,.28)" transform="rotate(-30 38 54)"/>
      <rect x="42" y="28" width="16" height="11" rx="2.5" fill="#4b5563" stroke="#1f2430" stroke-width="1.5"/>
      <path d="M50 28 q4 -14 18 -14" stroke="#c9a15a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="70" cy="13" r="6" fill="#ffcc33"/><circle cx="70" cy="13" r="3" fill="#fff6c9"/>
      <path d="M70 1 v5 M82 13 h-5 M79 4 l-3.5 3.5 M79 22 l-3.5 -3.5 M61 4 l3.5 3.5" stroke="#ffcc33" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M38 70 l8 8 M46 70 l-8 8 M54 70 l8 8 M62 70 l-8 8" stroke="#ff4d6d" stroke-width="3" stroke-linecap="round"/></svg>`,
  };
})();
makeScreen('mole', {
  title: '🔨 두더지 잡기', status: '두더지가 올라오면 클릭! 황금 두더지는 +3, 폭탄은 -3이에요.',
  stats: [['score', '점수'], ['time', '남은 시간'], ['best', '최고 점수']],
  body: `<div class="center"><div id="mole-board" class="mole-board"></div></div><p class="center small muted">키보드: 숫자 1~9 (숫자 패드 배치)</p>`,
});

const Mole = {
  setup(holes) {
    this.holes = holes;
    const n = Math.sqrt(holes), b = $('#mole-board');
    b.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    b.innerHTML = Array.from({ length: holes }, (_, i) => `<div class="hole" data-h="${i}"><div class="mole"></div></div>`).join('');
    this.up = new Map();
  },
  startSolo() {
    stopLocal();
    S.solo = 'mole';
    Object.assign(this, { multi: false, score: 0, seq: 0, over: false });
    this.setup(9);
    this.t0 = performance.now() + 1000; this.endAt = this.t0 + 60000;
    $('#mole-best-label').textContent = '최고 점수'; setStat('mole', 'best', store.get('best-mole', 0));
    show('mole'); this.hud();
    every(150, () => this.tickSolo());
  },
  tickSolo() {
    const now = performance.now();
    setStat('mole', 'time', leftSec(this.endAt));
    if (now >= this.endAt) return this.endSolo();
    if (now < this.t0) return;
    const t = (now - this.t0) / 1000, maxUp = Math.min(4, 1 + Math.floor(t / 15));
    if (this.up.size >= maxUp || Math.random() > 0.4 + t * 0.006) return;
    const used = new Set([...this.up.values()].map(m => m.h)), free = [...Array(this.holes).keys()].filter(h => !used.has(h));
    if (!free.length) return;
    const r = Math.random(), k = r < 0.1 ? 'gold' : r < 0.2 ? 'bomb' : 'mole';
    this.show({ id: ++this.seq, h: free[rand(free.length)], k, d: k === 'gold' ? 650 : k === 'bomb' ? 1400 : Math.max(600, 1100 - t * 7) });
  },
  show(m) {
    this.up.set(m.id, m);
    const el = $(`#mole-board [data-h="${m.h}"] .mole`);
    el.innerHTML = MOLE_SVG[m.k]; el.className = 'mole up ' + m.k; el.dataset.id = m.id;
    if (!this.multi) after(m.d, () => this.hide(m.id));
  },
  hide(id, hit) {
    const m = this.up.get(id);
    if (!m) return;
    this.up.delete(id);
    const el = $(`#mole-board [data-h="${m.h}"] .mole`);
    if (el.dataset.id == id) { el.className = 'mole' + (hit ? ' hit' : ''); }
  },
  whack(h) {
    const m = [...this.up.values()].find(x => x.h === h);
    const hole = $(`#mole-board [data-h="${h}"]`);
    hole.classList.remove('bonk'); void hole.offsetWidth; hole.classList.add('bonk');
    if (!m) return;
    if (this.multi) return socket.emit('mole:hit', m.id);
    this.score += MOLE_PTS[m.k]; this.hud();
    this.float(h, MOLE_PTS[m.k]);
    this.hide(m.id, true);
  },
  float(h, pts, who) {
    const hole = $(`#mole-board [data-h="${h}"]`), f = document.createElement('div');
    f.className = 'mole-float ' + (pts < 0 ? 'neg' : ''); f.textContent = `${who ? who + ' ' : ''}${pts > 0 ? '+' : ''}${pts}`;
    hole.append(f); setTimeout(() => f.remove(), 700);
  },
  hud() { setStat('mole', 'score', this.score); },
  endSolo() {
    if (this.over) return;
    this.over = true;
    const best = Math.max(+store.get('best-mole', 0), this.score); store.set('best-mole', best);
    showResult({ title: '🔨 시간 종료!', subtitle: `점수 ${this.score} · 최고 점수 ${best}`, solo: 'mole', rec: { v: this.score } });
  },
  startMulti(d) {
    stopLocal();
    Object.assign(this, { multi: true, score: 0, over: false });
    this.setup(d.holes);
    this.endAt = performance.now() + d.delay + d.seconds * 1000;
    $('#mole-best-label').textContent = ''; setStat('mole', 'best', '');
    setStatus('mole', '🔨 모두 같은 두더지! 먼저 때리는 사람이 점수를 가져가요.');
    show('mole'); renderScores(); this.hud();
    every(250, () => setStat('mole', 'time', leftSec(this.endAt)));
  },
};
$('#mole-board').addEventListener('pointerdown', e => { const h = e.target.closest('.hole'); if (h) Mole.whack(+h.dataset.h); });
register('mole', {
  solo: () => Mole.startSolo(), stop: () => { Mole.over = true; },
  key: e => {
    const n = { Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8, Digit7: 0, Digit8: 1, Digit9: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit1: 6, Digit2: 7, Digit3: 8 }[e.code];
    if (n != null && Mole.holes === 9) Mole.whack(n);
  },
});
socket.on('mole:start', d => Mole.startMulti(d));
socket.on('mole:up', m => { if (isScreen('mole') && Mole.multi) Mole.show(m); });
socket.on('mole:down', d => Mole.hide(d.id));
socket.on('mole:hit', d => {
  const m = Mole.up.get(d.id);
  if (m) Mole.float(m.h, d.pts, d.by === S.myId ? '' : d.name);
  if (d.by === S.myId) { Mole.score += d.pts; Mole.hud(); }
  Mole.hide(d.id, true);
});
