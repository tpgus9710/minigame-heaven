/* =====================================================================
 *  💎 보석 맞추기 (싱글: 1분 기록 / 멀티: 같은 판 점수 대결) — 보석 6종은 색과 모양이 모두 달라요
 *  이웃한 보석을 바꿔 3개 이상 잇기. 4개 = 줄 폭탄, 5개 = 무지개 보석.
 * ===================================================================== */
const GEM = { N: 8, SIZE: 54, TYPES: ['루비', '토파즈', '시트린', '에메랄드', '사파이어', '자수정'] };
/* 보석 그림 (모양이 다 달라서 색을 구분하기 어려워도 알아볼 수 있어요) */
const GEM_SVG = (() => {
  const g = (id, a, b, c) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>`;
  const svg = (inner) => `<svg viewBox="0 0 40 40" class="gem-svg">${inner}</svg>`;
  return [
    // 루비: 육각형
    svg(g('gR', '#ff8a8a', '#e0182d', '#7a0614') + '<polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="url(#gR)" stroke="#5c0410" stroke-width="1.2"/><polygon points="20,9 29,14 29,26 20,31 11,26 11,14" fill="rgba(255,255,255,.18)"/><path d="M20 2v7M36 11l-7 3M36 29l-7-3M20 38v-7M4 29l7-3M4 11l7 3" stroke="rgba(255,255,255,.35)" stroke-width="1"/><polygon points="11,14 20,9 18,15" fill="rgba(255,255,255,.7)"/>'),
    // 토파즈: 동그란 브릴리언트
    svg(g('gO', '#ffd29a', '#ff8a1f', '#a2420a') + '<circle cx="20" cy="20" r="17" fill="url(#gO)" stroke="#7a3108" stroke-width="1.2"/><polygon points="20,8 28.5,11.5 32,20 28.5,28.5 20,32 11.5,28.5 8,20 11.5,11.5" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.35)" stroke-width=".9"/><polygon points="11.5,11.5 20,8 16,15" fill="rgba(255,255,255,.75)"/>'),
    // 시트린: 쿠션 사각
    svg(g('gY', '#fff6a8', '#f5c400', '#8a6a00') + '<rect x="4" y="4" width="32" height="32" rx="9" fill="url(#gY)" stroke="#6b5200" stroke-width="1.2"/><rect x="11" y="11" width="18" height="18" rx="4" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.4)" stroke-width=".9"/><path d="M4 4l7 7M36 4l-7 7M36 36l-7-7M4 36l7-7" stroke="rgba(255,255,255,.35)" stroke-width="1"/><polygon points="11,11 20,11 13,16" fill="rgba(255,255,255,.75)"/>'),
    // 에메랄드: 팔각 에메랄드 컷
    svg(g('gG', '#9dffcf', '#16b86a', '#0a5a33') + '<polygon points="12,3 28,3 36,11 36,29 28,37 12,37 4,29 4,11" fill="url(#gG)" stroke="#06402a" stroke-width="1.2"/><polygon points="14,10 26,10 30,14 30,26 26,30 14,30 10,26 10,14" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.38)" stroke-width=".9"/><polygon points="14,10 22,10 13,17" fill="rgba(255,255,255,.7)"/>'),
    // 사파이어: 마름모
    svg(g('gB', '#9fd0ff', '#1f6fff', '#0a2a7a') + '<polygon points="20,2 37,20 20,38 3,20" fill="url(#gB)" stroke="#061d5c" stroke-width="1.2"/><polygon points="20,10 28,20 20,30 12,20" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.4)" stroke-width=".9"/><path d="M20 2v8M37 20h-9M20 38v-8M3 20h9" stroke="rgba(255,255,255,.3)" stroke-width="1"/><polygon points="12,20 20,10 18,18" fill="rgba(255,255,255,.75)"/>'),
    // 자수정: 삼각 트릴리언
    svg(g('gP', '#e3b5ff', '#9b3cf0', '#4a1580') + '<polygon points="20,3 38,35 2,35" fill="url(#gP)" stroke="#36105e" stroke-width="1.2" stroke-linejoin="round"/><polygon points="20,13 30,30 10,30" fill="rgba(255,255,255,.17)" stroke="rgba(255,255,255,.4)" stroke-width=".9"/><polygon points="20,13 16,21 14,26 20,13" fill="rgba(255,255,255,.8)" stroke="rgba(255,255,255,.8)" stroke-width="1.5"/>'),
  ];
})();
const GEM_RAINBOW_SVG = `<svg viewBox="0 0 40 40" class="gem-svg"><defs><linearGradient id="gW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d73"/><stop offset=".25" stop-color="#ffd23f"/><stop offset=".5" stop-color="#3fcf9b"/><stop offset=".75" stop-color="#4aa8ff"/><stop offset="1" stop-color="#b06cff"/></linearGradient></defs><polygon points="20,2 24.7,13.5 37,14.2 27.5,22.2 30.6,34.5 20,27.8 9.4,34.5 12.5,22.2 3,14.2 15.3,13.5" fill="url(#gW)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><circle cx="20" cy="20" r="4.5" fill="#fff" opacity=".85"/></svg>`;

makeScreen('gem', {
  title: '💎 보석 맞추기', status: '보석을 끌거나, 두 개를 차례로 눌러 자리를 바꿔요.',
  stats: [['score', '점수'], ['time', '남은 시간'], ['best', '최고 점수']],
  body: `<div class="center"><div id="gem-board" class="gem-board"></div></div>`,
});

const Gem = {
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'gem';
    this.rnd = this.multi ? seeded(opt.seed) : Math.random;
    Object.assign(this, { score: 0, busy: false, over: false, sel: null, seq: 0, endAt: performance.now() + opt.seconds * 1000, lastSent: -1 });
    const el = $('#gem-board');
    el.innerHTML = ''; el.style.width = el.style.height = GEM.N * GEM.SIZE + 'px';
    this.cells = [];
    for (let i = 0; i < GEM.N * GEM.N; i++) {
      let t;
      do { t = Math.floor(this.rnd() * GEM.TYPES.length); } while (this.makesRun(i, t));
      this.cells[i] = this.make(t, i, 0);
    }
    setStat('gem', 'best', this.multi ? '-' : store.get('best-gem', 0)); $('#gem-best-label').textContent = this.multi ? '' : '최고 점수';
    setStatus('gem', this.multi ? '💎 모두 같은 판! 1분 동안 점수를 최대한 높이세요.' : '보석을 끌거나, 두 개를 차례로 눌러 자리를 바꿔요.');
    show('gem'); renderScores(); this.hud();
    const gen = S.gen;
    every(200, () => { if (gen !== S.gen) return; setStat('gem', 'time', leftSec(this.endAt)); if (performance.now() >= this.endAt && !this.busy) this.end(); });
  },
  makesRun(i, t) {
    const r = Math.floor(i / GEM.N), c = i % GEM.N, at = (rr, cc) => this.cells[rr * GEM.N + cc] && this.cells[rr * GEM.N + cc].t;
    return (c >= 2 && at(r, c - 1) === t && at(r, c - 2) === t) || (r >= 2 && at(r - 1, c) === t && at(r - 2, c) === t);
  },
  make(t, i, fromRow) {
    const g = { t, sp: null, id: ++this.seq, el: document.createElement('div') };
    g.el.className = 'gem'; g.el.dataset.id = g.id; g.el.innerHTML = GEM_SVG[t];
    $('#gem-board').append(g.el);
    this.place(g, i, fromRow);
    return g;
  },
  place(g, i, fromRow) {
    const r = Math.floor(i / GEM.N), c = i % GEM.N;
    if (fromRow != null && fromRow !== 0) { g.el.style.transition = 'none'; g.el.style.transform = `translate(${c * GEM.SIZE}px, ${fromRow * GEM.SIZE}px)`; void g.el.offsetWidth; g.el.style.transition = ''; }
    g.el.style.transform = `translate(${c * GEM.SIZE}px, ${r * GEM.SIZE}px)`;
  },
  hud() {
    setStat('gem', 'score', this.score.toLocaleString());
    if (this.multi && this.score !== this.lastSent) { this.lastSent = this.score; socket.emit('sr:score', this.score); }
  },
  idx(id) { return this.cells.findIndex(g => g && g.id === id); },
  click(i) {
    if (this.busy || this.over) return;
    if (this.sel == null) { this.sel = i; this.cells[i].el.classList.add('sel'); return; }
    const a = this.sel; this.cells[a] && this.cells[a].el.classList.remove('sel'); this.sel = null;
    if (a === i) return;
    const adj = Math.abs(a - i) === GEM.N || (Math.abs(a - i) === 1 && Math.floor(a / GEM.N) === Math.floor(i / GEM.N));
    if (!adj) { this.sel = i; this.cells[i].el.classList.add('sel'); return; }
    this.trySwap(a, i);
  },
  async trySwap(a, b) {
    this.busy = true;
    const gen = S.gen, wait = ms => new Promise(r => setTimeout(r, ms));
    this.swap(a, b); await wait(180); if (gen !== S.gen) return;
    const A = this.cells[a], B = this.cells[b];
    if (A.sp === 'rainbow' || B.sp === 'rainbow') {                   // 무지개 + 아무 보석 = 그 색 전부 제거
      const rb = A.sp === 'rainbow' ? a : b, other = rb === a ? B : A;
      const set = new Set([rb]);
      this.cells.forEach((g, i) => { if (g.t === other.t || (other.sp === 'rainbow')) set.add(i); });
      await this.resolve(set, gen);
    } else if (!this.findMatches().size) { this.swap(a, b); await wait(180); }
    else await this.resolve(null, gen, [a, b]);
    if (gen !== S.gen) return;
    this.busy = false;
    if (!this.hasMove()) await this.shuffleBoard(gen);
    if (performance.now() >= this.endAt) this.end();
  },
  swap(a, b) { [this.cells[a], this.cells[b]] = [this.cells[b], this.cells[a]]; this.place(this.cells[a], a); this.place(this.cells[b], b); },
  /** 3개 이상 이어진 칸들 (+ 만들어질 특수 보석) */
  findMatches(specials) {
    const N = GEM.N, set = new Set(), T = i => (this.cells[i] && this.cells[i].sp !== 'rainbow' ? this.cells[i].t : -1);
    for (const horiz of [true, false]) for (let a = 0; a < N; a++) {
      let run = [];
      for (let b = 0; b <= N; b++) {
        const i = horiz ? a * N + b : b * N + a, t = b < N ? T(i) : -2;
        if (run.length && t === T(run[0])) run.push(i);
        else {
          if (run.length >= 3) { run.forEach(x => set.add(x)); if (specials && run.length >= 4) specials.push({ cells: run.slice(), kind: run.length >= 5 ? 'rainbow' : horiz ? 'h' : 'v', t: T(run[0]) }); }
          run = t >= 0 ? [i] : [];
        }
      }
    }
    return set;
  },
  async resolve(forced, gen, swapped) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let combo = 1;
    while (true) {
      const specials = [];
      const set = forced || this.findMatches(specials);
      forced = null;
      if (!set.size) break;
      let grew = true;                                                  // 줄 폭탄은 가로/세로 한 줄 전체
      while (grew) {
        grew = false;
        for (const i of [...set]) {
          const g = this.cells[i];
          if (!g || !g.sp || g.sp === 'rainbow' || g.used) continue;
          g.used = true;
          const r = Math.floor(i / GEM.N), c = i % GEM.N;
          for (let k = 0; k < GEM.N; k++) { const j = g.sp === 'h' ? r * GEM.N + k : k * GEM.N + c; if (!set.has(j)) { set.add(j); grew = true; } }
        }
      }
      const keep = new Map();                                           // 특수 보석이 남을 자리
      for (const sp of specials) {
        const at = (swapped && sp.cells.find(x => swapped.includes(x))) ?? sp.cells[Math.floor(sp.cells.length / 2)];
        keep.set(at, sp);
      }
      this.score += set.size * 10 * combo + specials.length * 40 * combo;
      this.hud();
      if (combo > 1) this.pop(`${combo} 콤보!`);
      for (const i of set) { if (!keep.has(i) && this.cells[i]) { this.cells[i].el.classList.add('gone'); } }
      await wait(170); if (gen !== S.gen) return;
      for (const i of set) {
        const g = this.cells[i];
        if (keep.has(i)) { const sp = keep.get(i); g.sp = sp.kind; g.used = false; g.el.classList.add('sp-' + sp.kind); if (sp.kind === 'rainbow') g.el.innerHTML = GEM_RAINBOW_SVG; continue; }
        if (g) g.el.remove();
        this.cells[i] = null;
      }
      for (let c = 0; c < GEM.N; c++) {                                  // 아래로 떨어뜨리고 위에서 채우기
        let w = GEM.N - 1;
        for (let r = GEM.N - 1; r >= 0; r--) { const i = r * GEM.N + c; if (this.cells[i]) { const g = this.cells[i]; this.cells[i] = null; this.cells[w * GEM.N + c] = g; this.place(g, w * GEM.N + c); w--; } }
        for (let r = w, k = 1; r >= 0; r--, k++) this.cells[r * GEM.N + c] = this.make(Math.floor(this.rnd() * GEM.TYPES.length), r * GEM.N + c, -k);
      }
      await wait(230); if (gen !== S.gen) return;
      combo++; swapped = null;
    }
  },
  hasMove() {
    for (let i = 0; i < GEM.N * GEM.N; i++) for (const j of [i + 1, i + GEM.N]) {
      if (j >= GEM.N * GEM.N || (j === i + 1 && j % GEM.N === 0)) continue;
      if (this.cells[i].sp === 'rainbow' || this.cells[j].sp === 'rainbow') return true;
      [this.cells[i], this.cells[j]] = [this.cells[j], this.cells[i]];
      const ok = this.findMatches().size > 0;
      [this.cells[i], this.cells[j]] = [this.cells[j], this.cells[i]];
      if (ok) return true;
    }
    return false;
  },
  async shuffleBoard(gen) {
    this.pop('섞는 중…');
    do { for (let i = this.cells.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [this.cells[i], this.cells[j]] = [this.cells[j], this.cells[i]]; } } while (this.findMatches().size || !this.hasMove());
    this.cells.forEach((g, i) => this.place(g, i));
    await new Promise(r => setTimeout(r, 250));
  },
  pop(txt) { const p = document.createElement('div'); p.className = 'gem-pop'; p.textContent = txt; $('#gem-board').append(p); setTimeout(() => p.remove(), 900); },
  end() {
    if (this.over) return;
    this.over = true;
    if (this.multi) { socket.emit('sr:score', this.score); socket.emit('sr:over'); setStatus('gem', `⏰ 끝! ${this.score.toLocaleString()}점 — 결과를 기다리는 중…`); return; }
    const best = Math.max(+store.get('best-gem', 0), this.score); store.set('best-gem', best);
    showResult({ title: '💎 시간 종료!', subtitle: `점수 ${this.score.toLocaleString()} · 최고 점수 ${best.toLocaleString()}`, solo: 'gem' });
  },
};
(() => {
  const board = $('#gem-board');
  let down = null;
  board.addEventListener('pointerdown', e => { const el = e.target.closest('.gem'); if (!el) return; down = { i: Gem.idx(+el.dataset.id), x: e.clientX, y: e.clientY }; });
  board.addEventListener('pointerup', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y, i = down.i; down = null;
    if (i < 0) return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return Gem.click(i);
    const r = Math.floor(i / GEM.N), c = i % GEM.N;
    const j = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (c < GEM.N - 1 ? i + 1 : -1) : (c > 0 ? i - 1 : -1)) : (dy > 0 ? (r < GEM.N - 1 ? i + GEM.N : -1) : (r > 0 ? i - GEM.N : -1));
    if (j < 0 || Gem.busy || Gem.over) return;
    if (Gem.sel != null && Gem.cells[Gem.sel]) Gem.cells[Gem.sel].el.classList.remove('sel');
    Gem.sel = null; Gem.trySwap(i, j);
  });
})();
register('gem', { solo: () => Gem.start({ seconds: 60 }), multi: d => Gem.start({ seed: d.seed, seconds: d.seconds }), stop: () => { Gem.over = true; } });
