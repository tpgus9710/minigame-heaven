/* =====================================================================
 *  🀄 사천성 (싱글: 3분 기록 / 멀티: 같은 판 점수 대결)
 *  같은 그림 두 장을 '두 번 이하로 꺾인 선'으로 이을 수 있으면 사라져요. 판 바깥으로 돌아가는 선도 OK!
 * ===================================================================== */
const SS = {
  C: 12, R: 8, SECONDS: 180,
  KINDS: [['春', 'r'], ['夏', 'r'], ['秋', 'r'], ['冬', 'r'], ['東', 'r'], ['南', 'r'], ['西', 'r'], ['北', 'r'],
    ['梅', 'g'], ['蘭', 'g'], ['菊', 'g'], ['竹', 'g'], ['松', 'g'], ['柏', 'g'], ['蓮', 'g'], ['桃', 'g'],
    ['龍', 'b'], ['鳳', 'b'], ['虎', 'b'], ['龜', 'b'], ['鶴', 'b'], ['鹿', 'b'], ['魚', 'b'], ['馬', 'b']],
};
makeScreen('shisen', {
  title: '🀄 사천성', status: '같은 그림 두 장을 두 번 이하로 꺾인 선으로 이어 없애요. 모두 없애면 클리어!',
  stats: [['score', '점수'], ['left', '남은 패'], ['time', '남은 시간'], ['best', '최고 점수']],
  body: `<div class="ss-wrap"><div class="ss-board" id="ss-board"></div><svg class="ss-line" id="ss-line"></svg><div class="ss-pop" id="ss-pop"></div></div>
    <div class="ss-tools"><button class="btn ghost" data-act="ssHint">힌트 <small id="ss-hints"></small></button><button class="btn ghost" data-act="ssShuffle">섞기 <small id="ss-shuf"></small></button>
      <span class="muted small">콤보: 3초 안에 계속 맞히면 점수가 올라가요</span></div>`,
});

const Shisen = {
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'shisen';
    this.rnd = this.multi ? seeded(opt.seed) : Math.random;
    Object.assign(this, { score: 0, combo: 0, lastHit: 0, over: false, sel: null, hints: 3, shuffles: 2, endAt: performance.now() + (opt.seconds || SS.SECONDS) * 1000, lastSent: -1 });
    // 패: 24종 × 4장 = 96장
    const tiles = [];
    for (let k = 0; k < 24; k++) for (let n = 0; n < 4; n++) tiles.push(k);
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    this.g = Array.from({ length: SS.R + 2 }, () => Array(SS.C + 2).fill(-1));      // 바깥 한 줄은 늘 빈칸
    tiles.forEach((k, i) => { this.g[1 + Math.floor(i / SS.C)][1 + (i % SS.C)] = k; });
    this.left = 96;
    if (!this.anyPair()) this.reshuffle(false);
    this.draw();
    setStat('shisen', 'best', this.multi ? '-' : store.get('best-shisen', 0));
    setStatus('shisen', this.multi ? '🀄 모두 같은 판! 3분 동안 점수를 최대한 높이세요.' : '같은 그림 두 장을 두 번 이하로 꺾인 선으로 이어 없애요. 모두 없애면 클리어!');
    show('shisen'); renderScores(); this.hud();
    const gen = S.gen;
    every(250, () => { if (gen !== S.gen || this.over) return; setStat('shisen', 'time', leftSec(this.endAt)); if (performance.now() >= this.endAt) this.end(false); });
  },
  draw() {
    let html = '';
    for (let r = 1; r <= SS.R; r++) for (let c = 1; c <= SS.C; c++) {
      const k = this.g[r][c];
      html += k < 0 ? `<i class="ss-empty"></i>` : `<button class="ss-tile ${SS.KINDS[k][1]}" data-r="${r}" data-c="${c}"><b>${SS.KINDS[k][0]}</b></button>`;
    }
    $('#ss-board').innerHTML = html;
  },
  hud() {
    setStat('shisen', 'score', this.score.toLocaleString());
    setStat('shisen', 'left', this.left);
    $('#ss-hints').textContent = `${this.hints}회 · -30점`;
    $('#ss-shuf').textContent = `${this.shuffles}회`;
    if (this.multi && this.score !== this.lastSent) { this.lastSent = this.score; socket.emit('sr:score', this.score); }
  },
  tileEl(r, c) { return $(`#ss-board .ss-tile[data-r="${r}"][data-c="${c}"]`); },
  /* ── 길 찾기: 꺾임 0 · 1 · 2번 ── */
  clear(r1, c1, r2, c2) {          // 두 점 사이(양 끝 제외)가 모두 비었나 (같은 줄/칸일 때만)
    if (r1 === r2) { for (let c = Math.min(c1, c2) + 1; c < Math.max(c1, c2); c++) if (this.g[r1][c] >= 0) return false; return true; }
    if (c1 === c2) { for (let r = Math.min(r1, r2) + 1; r < Math.max(r1, r2); r++) if (this.g[r][c1] >= 0) return false; return true; }
    return false;
  },
  empty(r, c) { return this.g[r][c] < 0; },
  path(a, b) {
    const [r1, c1] = a, [r2, c2] = b;
    if ((r1 === r2 || c1 === c2) && this.clear(r1, c1, r2, c2)) return [a, b];
    for (const [r, c] of [[r1, c2], [r2, c1]]) if (this.empty(r, c) && this.clear(r1, c1, r, c) && this.clear(r, c, r2, c2)) return [a, [r, c], b];
    let best = null;
    for (let r = 0; r < SS.R + 2; r++) {
      if (r === r1 && r === r2) continue;
      if (this.empty(r, c1) && this.empty(r, c2) && this.clear(r1, c1, r, c1) && this.clear(r, c1, r, c2) && this.clear(r, c2, r2, c2)) {
        const len = Math.abs(r - r1) + Math.abs(c2 - c1) + Math.abs(r2 - r);
        if (!best || len < best.len) best = { len, p: [a, [r, c1], [r, c2], b] };
      }
    }
    for (let c = 0; c < SS.C + 2; c++) {
      if (this.empty(r1, c) && this.empty(r2, c) && this.clear(r1, c1, r1, c) && this.clear(r1, c, r2, c) && this.clear(r2, c, r2, c2)) {
        const len = Math.abs(c - c1) + Math.abs(r2 - r1) + Math.abs(c2 - c);
        if (!best || len < best.len) best = { len, p: [a, [r1, c], [r2, c], b] };
      }
    }
    return best ? best.p : null;
  },
  anyPair() {
    const pos = {};
    for (let r = 1; r <= SS.R; r++) for (let c = 1; c <= SS.C; c++) { const k = this.g[r][c]; if (k >= 0) (pos[k] = pos[k] || []).push([r, c]); }
    for (const list of Object.values(pos)) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (this.path(list[i], list[j])) return [list[i], list[j]];
    return null;
  },
  reshuffle(byUser) {
    const cells = [], ks = [];
    for (let r = 1; r <= SS.R; r++) for (let c = 1; c <= SS.C; c++) if (this.g[r][c] >= 0) { cells.push([r, c]); ks.push(this.g[r][c]); }
    let tries = 0;
    do {
      for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [ks[i], ks[j]] = [ks[j], ks[i]]; }
      cells.forEach(([r, c], i) => { this.g[r][c] = ks[i]; });
    } while (!this.anyPair() && ++tries < 50);
    if (byUser != null) { this.draw(); this.toast(byUser ? '섞었어요!' : '이을 수 있는 패가 없어서 자동으로 섞었어요'); }
  },
  click(r, c) {
    if (this.over) return;
    const el = this.tileEl(r, c); if (!el) return;
    if (!this.sel) { this.sel = [r, c]; el.classList.add('sel'); return; }
    const [sr, sc] = this.sel, sel = this.tileEl(sr, sc);
    if (sr === r && sc === c) { sel && sel.classList.remove('sel'); this.sel = null; return; }
    if (this.g[sr][sc] !== this.g[r][c]) { sel && sel.classList.remove('sel'); this.sel = [r, c]; el.classList.add('sel'); return; }
    const p = this.path(this.sel, [r, c]);
    if (!p) { sel && sel.classList.add('nope'); el.classList.add('nope'); setTimeout(() => { sel && sel.classList.remove('nope'); el.classList.remove('nope'); }, 350); return; }
    this.sel = null;
    this.match(p, [sr, sc], [r, c]);
  },
  match(p, a, b) {
    const now = performance.now();
    this.combo = now - this.lastHit < 3000 ? this.combo + 1 : 0; this.lastHit = now;
    const pts = 10 + this.combo * 5;
    this.score += pts;
    this.g[a[0]][a[1]] = -1; this.g[b[0]][b[1]] = -1; this.left -= 2;
    this.line(p);
    [a, b].forEach(([r, c]) => { const el = this.tileEl(r, c); if (el) { el.classList.add('gone'); setTimeout(() => { if (el.parentNode) el.outerHTML = '<i class="ss-empty"></i>'; }, 260); } });
    if (this.combo) this.toast(`${this.combo + 1} 콤보! +${pts}`);
    this.hud();
    if (!this.left) return setTimeout(() => this.end(true), 400);
    if (!this.anyPair()) setTimeout(() => { if (!this.over) this.reshuffle(false); }, 320);
  },
  line(p) {
    const board = $('#ss-board'), svg = $('#ss-line'), w = board.clientWidth / SS.C, h = board.clientHeight / SS.R;
    const pts = p.map(([r, c]) => `${(c - 0.5) * w + board.offsetLeft},${(r - 0.5) * h + board.offsetTop}`).join(' ');
    svg.innerHTML = `<polyline points="${pts}"/>`;
    clearTimeout(this.lineT); this.lineT = setTimeout(() => { svg.innerHTML = ''; }, 380);
  },
  toast(t) { const el = $('#ss-pop'); el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  hint() {
    if (this.over || !this.hints) return;
    const pr = this.anyPair(); if (!pr) return;
    this.hints--; this.score = Math.max(0, this.score - 30); this.hud();
    pr.forEach(([r, c]) => { const el = this.tileEl(r, c); if (el) { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); } });
  },
  shuffle() { if (this.over || !this.shuffles) return; this.shuffles--; this.sel = null; this.reshuffle(true); this.hud(); },
  end(cleared) {
    if (this.over) return;
    this.over = true;
    const bonus = cleared ? 300 + leftSec(this.endAt) * 5 : 0;
    this.score += bonus; this.hud();
    if (this.multi) { socket.emit('sr:score', this.score); socket.emit('sr:over'); setStatus('shisen', `${cleared ? '🎉 클리어!' : '⏰ 끝!'} ${this.score.toLocaleString()}점 — 결과를 기다리는 중…`); return; }
    const best = Math.max(+store.get('best-shisen', 0), this.score); store.set('best-shisen', best);
    showResult({ title: cleared ? '🀄 클리어!' : '🀄 시간 종료!', subtitle: `점수 ${this.score.toLocaleString()}${cleared ? ` (클리어 보너스 +${bonus})` : ` · 남은 패 ${this.left}장`} · 최고 점수 ${best.toLocaleString()}`, solo: 'shisen', win: !!cleared, rec: { v: this.score } });
  },
};
$('#ss-board').addEventListener('click', e => { const t = e.target.closest('.ss-tile'); if (t) Shisen.click(+t.dataset.r, +t.dataset.c); });
Object.assign(ACT, { ssHint: () => Shisen.hint(), ssShuffle: () => Shisen.shuffle() });
register('shisen', { solo: () => Shisen.start({ seconds: SS.SECONDS }), multi: d => Shisen.start({ seed: d.seed, seconds: d.seconds }), stop: () => { Shisen.over = true; } });
