/* =====================================================================
 *  🧩 타일 매치 (같은 그림 3개 모으기) — 싱글: 레벨을 하나씩 깨기 / 멀티: 같은 판 4분 점수 대결 (games/scorerace.js)
 *  쌓인 타일 중 위가 트인(밝은) 타일을 누르면 아래 칸(7칸)으로 내려가요. 같은 그림 3개가 모이면 사라져요.
 *  7칸이 꽉 차면 실패! 판을 다 비우면 다음 레벨. 아이템(레벨마다 1번씩): 되돌리기 · 꺼내기(3개를 위 칸으로) · 섞기
 *  판은 항상 풀 수 있게 만들어요: 빈 판에서 거꾸로, 그때그때 트인 자리 세 곳에 같은 그림을 넣어 가며 채워요.
 *  자리 단위: 반 칸 (타일 하나 = 2 × 2) · 홀수 층은 반 칸씩 어긋나게 쌓아 겹쳐 보여요.
 * ===================================================================== */
const TM = {
  COLS: 7, ROWS: 8, SLOTS: 7, SECONDS: 240,
  FACES: ['🍎', '🍋', '🍇', '🥝', '🍊', '🍓', '🍄', '🌸', '🐟', '🍩', '🌻', '🥕', '🍉', '🥑', '🐥', '🦋', '🍪', '🎈'],
  shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  /** 레벨 → { kinds(그림 수), per(그림마다 세 장 묶음 수), layers } — 1: 18개 · 2~7: 42~72개(그림이 하나씩 늘어요) · 8~14: 81~117개 · 15~: 126개 */
  spec(n) {
    const T = [null, [6, 1, 2], [7, 2, 3], [8, 2, 3], [9, 2, 4], [10, 2, 4], [11, 2, 5], [12, 2, 5], [9, 3, 5], [10, 3, 5], [11, 3, 6], [12, 3, 6], [12, 3, 6], [13, 3, 6], [13, 3, 6]];
    const [kinds, per, layers] = T[n] || [14, 3, 6];
    return { kinds, per, layers, total: kinds * 3 * per, spread: Math.min(0.5, 0.12 + n * 0.04) };
  },
  covered(t, live) { for (const u of live) if (u !== t && u.z > t.z && Math.abs(u.x - t.x) < 2 && Math.abs(u.y - t.y) < 2) return true; return false; },
  /**
   * 자리 만들기: 층마다 개수를 정하고(아래층이 넓은 피라미드) 위층은 가운데로 모아 쌓아요 → 가장자리 타일이 보여요.
   * 좌우 대칭 · 위층은 아래층에 받쳐진 자리만 · 레벨이 오를수록 위층이 넓게 퍼져 더 많이 가려요(spread).
   */
  places(sp, rnd) {
    const W = this.COLS * 2, H = this.ROWS * 2, L = sp.layers, cx = (W - 2) / 2, cy = (H - 2) / 2;
    const w = Array.from({ length: L }, (_, z) => Math.pow(L - z, 1.8)), ws = w.reduce((a, b) => a + b, 0);
    const want = w.map(v => Math.round(sp.total * v / ws));
    want[0] += sp.total - want.reduce((a, b) => a + b, 0);
    const all = [];
    for (let z = 0; z < L; z++) {
      const o = z % 2, cands = [];
      for (let y = o; y + 2 <= H; y += 2) for (let x = o; x + 2 <= W; x += 2) {
        if (z && !all.some(u => u.z === z - 1 && Math.abs(u.x - x) < 2 && Math.abs(u.y - y) < 2)) continue;   // 받침 없는 자리는 빼요
        cands.push({ x, y, z });
      }
      const groups = new Map();                                              // 좌우 거울 짝끼리 묶어요
      for (const c of cands) { const k = Math.min(c.x, W - 2 - c.x) + ',' + c.y; (groups.get(k) || groups.set(k, []).get(k)).push(c); }
      const score = g => Math.hypot((g[0].x - cx) / W * (z ? 1 : 0.6), (g[0].y - cy) / H) + rnd() * sp.spread;
      const list = [...groups.values()].map(g => [score(g), g]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
      let need = want[z];
      for (const g of list) {
        if (need <= 0) break;
        if (g.length <= need) { all.push(...g); need -= g.length; }
        else if (need === 1) { all.push(g[Math.floor(rnd() * g.length)]); need = 0; }
      }
      if (need > 0 && z + 1 < L) want[z + 1] += need;                       // 못 채운 만큼은 위층으로
      else if (need > 0) want[0] += 0;
    }
    // 그래도 모자라면 아래층 빈 자리부터 채워요
    for (let z = 0; all.length < sp.total && z < 8; z++) {
      const o = z % 2;
      for (let y = o; y + 2 <= H && all.length < sp.total; y += 2) for (let x = o; x + 2 <= W && all.length < sp.total; x += 2) {
        if (all.some(u => u.z === z && Math.abs(u.x - x) < 2 && Math.abs(u.y - y) < 2)) continue;
        if (z && !all.some(u => u.z === z - 1 && Math.abs(u.x - x) < 2 && Math.abs(u.y - y) < 2)) continue;
        all.push({ x, y, z });
      }
    }
    return all;
  },
  /** 그림 넣기: 거꾸로 — 트인 자리 세 곳에 같은 그림을 넣고 빼기를 되풀이 (항상 풀 수 있어요) */
  deal(spots, kinds, rnd) {
    for (let tries = 0; tries < 200; tries++) {
      const live = spots.slice(), got = new Map(), ks = this.shuffle(kinds.slice(), rnd);
      let ok = true;
      for (const k of ks) {
        const fr = live.filter(t => !this.covered(t, live));
        if (fr.length < 3) { ok = false; break; }
        this.shuffle(fr, rnd);
        const three = fr.slice(0, 3);
        three.forEach(t => { got.set(t, k); live.splice(live.indexOf(t), 1); });
      }
      if (ok) return spots.map(t => got.get(t));
    }
    return null;
  },
  level(n, rnd) {
    const sp = this.spec(n), spots = this.places(sp, rnd);
    const faces = this.shuffle([...this.FACES.keys()], rnd).slice(0, sp.kinds);
    const kinds = [].concat(...faces.map(f => Array(sp.per).fill(f)));                   // 그림마다 '세 장 묶음' 수
    const got = this.deal(spots, kinds, rnd) || this.shuffle([].concat(...kinds.map(k => [k, k, k])), rnd);
    return spots.map((p, i) => ({ ...p, k: got[i], id: i, on: true }));
  },
};
makeScreen('tilematch', {
  title: '🧩 타일 매치', status: '위가 트인 타일을 눌러 아래 7칸으로 보내요. 같은 그림 3개가 모이면 사라져요. 7칸이 꽉 차면 실패!',
  stats: [['level', '레벨'], ['left', '남은 타일'], ['time', '시간']],
  body: `<div class="tm-area" id="tm-area"><div class="tm-wrap" id="tm-wrap"><div class="tm-board" id="tm-board"></div><div class="ss-pop" id="tm-pop"></div></div>
    <div class="tm-side"><div class="tm-hold" id="tm-hold"></div>
    <div class="tm-tray" id="tm-tray"></div>
    <div class="tm-tools"><button class="btn ghost sm" data-act="tmUndo" id="tm-undo">되돌리기</button><button class="btn ghost sm" data-act="tmOut" id="tm-out">꺼내기 <small>3개</small></button><button class="btn ghost sm" data-act="tmShuffle" id="tm-shuf">섞기</button></div></div></div>`,
});
$('#scr-tilematch').dataset.fitSelf = '1';

const TileMatch = {
  tiles: [], tray: [], hold: [], over: true, hist: [],
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'tilematch';
    Object.assign(this, { seed: opt.seed || 0, score: 0, lastSent: -1, over: false, tries: 0, t0: performance.now(), endAt: performance.now() + (opt.seconds || TM.SECONDS) * 1000 });
    this.lv = this.multi ? 1 : Math.max(1, +store.get('tm-level', 1) || 1);
    show('tilematch'); if (this.multi) renderScores();
    $('#tilematch-time-label').textContent = this.multi ? '남은 시간' : '시간';
    setStatus('tilematch', this.multi ? '🧩 모두 같은 판! 4분 동안 레벨을 깨며 점수를 올려요. 7칸이 꽉 차면 그 레벨을 다시 해요.' : '위가 트인 타일을 눌러 아래 7칸으로 보내요. 같은 그림 3개가 모이면 사라져요. 7칸이 꽉 차면 실패!');
    this.load();
    const gen = S.gen;
    every(250, () => {
      if (gen !== S.gen || this.over) return;
      if (this.multi) { setStat('tilematch', 'time', leftSec(this.endAt) + '초'); if (performance.now() >= this.endAt) this.end(); }
      else { const s = Math.floor((performance.now() - this.lt0) / 1000); setStat('tilematch', 'time', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); }
    });
  },
  /** 지금 레벨 판 깔기 */
  load() {
    const rnd = this.multi ? seeded(this.seed * 31 + this.lv * 1009 + this.tries * 7) : Math.random;
    this.tiles = TM.level(this.lv, rnd);
    Object.assign(this, { tray: [], hold: [], hist: [], items: { undo: 1, out: 1, shuffle: 1 }, lt0: performance.now(), busy: false });
    setStat('tilematch', 'level', `${this.lv}`);
    this.build(); this.fit(); this.refresh();
    this.pop(`레벨 ${this.lv}`);
  },
  build() {
    const order = this.tiles.slice().sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
    $('#tm-board').innerHTML = order.map(t => `<button class="tm-tile" data-id="${t.id}" style="--x:${t.x};--y:${t.y};z-index:${t.z * 1000 + t.y * 30 + t.x}"><span>${TM.FACES[t.k]}</span></button>`).join('');
  },
  el(t) { return $(`#tm-board .tm-tile[data-id="${t.id}"]`); },
  /** 넓고 낮은 화면(노트북 · 휴대폰 가로 · 폴드 펼침 가로)은 판 오른쪽에 칸(세로 7칸) · 도구를 세워요 */
  fit() {
    const sec = $('#scr-tilematch'), area = $('#tm-area'), board = $('#tm-board');
    if (!sec.classList.contains('active') || !area.clientWidth) return;
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' ? Fit.room(sec) : innerHeight - sec.getBoundingClientRect().top;
    const top = (area.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const AW = area.clientWidth - 4, AH = Math.max(200, room - top - 8);
    const side = AW / AH >= 1.45;
    area.classList.toggle('side', side);
    let ts;
    if (side) ts = Math.min((AW - 150) / (TM.COLS + 2.4 + (this.hold.length ? 1.1 : 0)), AH / (TM.ROWS + 0.3), (AH - 20) / (TM.SLOTS * 1.08), 92);
    else {
      const tools = ($('#scr-tilematch .tm-tools').offsetHeight || 40) + 12, H = AH - tools;
      // 판(8줄) + 위 칸(꺼내기) + 아래 7칸 이 높이에 들어가게
      ts = Math.min(AW / (TM.COLS + 0.15), (AW - 16) / (TM.SLOTS * 1.08), H / (TM.ROWS + 0.2 + 1.25 + (this.hold.length ? 1 : 0.15)), 92);
    }
    ts = Math.floor(ts);
    board.style.setProperty('--ts', ts + 'px'); board.style.width = ts * TM.COLS + 'px'; board.style.height = ts * TM.ROWS + 'px';
    sec.style.setProperty('--ts', ts + 'px');
  },
  refresh() {
    const live = this.tiles.filter(t => t.on);
    for (const t of this.tiles) {
      const el = this.el(t); if (!el) continue;
      if (!t.on) { el.classList.add('gone'); continue; }
      el.classList.remove('gone');
      t.free = !TM.covered(t, live);
      el.classList.toggle('lock', !t.free);
      el.querySelector('span').textContent = TM.FACES[t.k];
    }
    this.renderTray();
    setStat('tilematch', 'left', `${live.length + this.tray.length + this.hold.length}개`);
    $('#tm-undo').disabled = !this.items.undo || !this.hist.length; $('#tm-out').disabled = !this.items.out || !this.tray.length || this.hold.length;
    $('#tm-shuf').disabled = !this.items.shuffle || live.length < 3;
    $('#tm-undo').innerHTML = `되돌리기 <small>${this.items.undo}</small>`; $('#tm-out').innerHTML = `꺼내기 <small>${this.items.out}</small>`; $('#tm-shuf').innerHTML = `섞기 <small>${this.items.shuffle}</small>`;
    if (this.multi && this.score !== this.lastSent) { this.lastSent = this.score; socket.emit('sr:score', this.score); }
  },
  renderTray() {
    const slot = (k, cls = '', id = '') => `<div class="tm-slot">${k == null ? '' : `<button class="tm-tile in ${cls}" ${id}><span>${TM.FACES[k]}</span></button>`}</div>`;
    $('#tm-tray').innerHTML = Array.from({ length: TM.SLOTS }, (_, i) => slot(this.tray[i] ? this.tray[i].k : null, this.tray[i] && this.tray[i].fresh ? 'fresh' : '')).join('');
    this.tray.forEach(x => { delete x.fresh; });
    $('#tm-tray').classList.toggle('warn', this.tray.length >= TM.SLOTS - 1);
    const h = $('#tm-hold');
    h.classList.toggle('on', this.hold.length > 0);
    h.innerHTML = this.hold.map((x, i) => `<div class="tm-slot"><button class="tm-tile in" data-hold="${i}"><span>${TM.FACES[x.k]}</span></button></div>`).join('');
  },
  pop(t) { const el = $('#tm-pop'); el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  /** 판의 타일 → 아래 칸 */
  tap(id) {
    if (this.over || this.busy) return;
    const t = this.tiles[id]; if (!t || !t.on) return;
    const el = this.el(t);
    if (!t.free) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); return; }
    t.on = false;
    this.fly(el, t.k);
    this.hist.push({ id: t.id });
    this.put({ k: t.k, from: t.id });
  },
  /** 위 칸(꺼낸 타일) → 아래 칸 */
  tapHold(i) {
    if (this.over || this.busy) return;
    const x = this.hold.splice(i, 1)[0]; if (!x) return;
    this.hist = [];
    this.put({ k: x.k, from: null });
    this.fit();
  },
  /** 아래 칸에 넣기: 같은 그림 옆에 · 3개면 사라져요 · 7칸이 꽉 차면 실패 */
  put(x) {
    let at = -1;
    for (let i = this.tray.length - 1; i >= 0; i--) if (this.tray[i].k === x.k) { at = i; break; }
    x.fresh = true;
    if (at >= 0) this.tray.splice(at + 1, 0, x); else this.tray.push(x);
    if (typeof Sound !== 'undefined') Sound.blip(620 + this.tray.length * 30, 0.03, 0.55);
    const same = this.tray.filter(y => y.k === x.k);
    if (same.length >= 3) {
      const idx = this.tray.indexOf(same[0]);
      this.refresh();
      this.busy = true;                                                   // 사라지는 동안 0.2초만 기다려요
      $$('#tm-tray .tm-slot').slice(idx, idx + 3).forEach(s => s.classList.add('match'));
      if (typeof Sound !== 'undefined') Sound.play('pop');
      setTimeout(() => {
        this.tray = this.tray.filter(y => !same.slice(0, 3).includes(y));
        this.hist = this.hist.filter(h => !same.slice(0, 3).some(y => y.from === h.id));
        this.score += 30 * this.lv;
        this.busy = false;
        this.refresh();
        this.check();
      }, 210);
      return;
    }
    this.refresh();
    if (this.tray.length >= TM.SLOTS) this.fail();
  },
  check() {
    if (this.tiles.some(t => t.on) || this.tray.length || this.hold.length) return;
    this.clear();
  },
  fly(el, k) {
    const r = el.getBoundingClientRect(), slots = $$('#tm-tray .tm-slot');
    let at = this.tray.length;
    for (let i = this.tray.length - 1; i >= 0; i--) if (this.tray[i].k === k) { at = i + 1; break; }
    const to = (slots[Math.min(at, slots.length - 1)] || slots[0]).getBoundingClientRect();
    const c = document.createElement('div');
    c.className = 'tm-fly'; c.innerHTML = `<span>${TM.FACES[k]}</span>`;
    Object.assign(c.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', fontSize: getComputedStyle(el).fontSize });
    document.body.append(c);
    requestAnimationFrame(() => { c.style.transform = `translate(${to.left + (to.width - r.width) / 2 - r.left}px, ${to.top + (to.height - r.height) / 2 - r.top}px)`; c.style.opacity = '0.2'; });
    setTimeout(() => c.remove(), 230);
  },
  undo() {
    if (this.over || this.busy || !this.items.undo || !this.hist.length) return;
    const h = this.hist.pop(), i = this.tray.findIndex(y => y.from === h.id);
    if (i < 0) return;
    this.tray.splice(i, 1); this.tiles[h.id].on = true; this.items.undo--;
    this.refresh();
  },
  out() {
    if (this.over || this.busy || !this.items.out || !this.tray.length || this.hold.length) return;
    this.hold = this.tray.splice(0, 3); this.items.out--; this.hist = [];
    this.fit(); this.refresh();
  },
  shuffle() {
    if (this.over || this.busy || !this.items.shuffle) return;
    const live = this.tiles.filter(t => t.on), ks = TM.shuffle(live.map(t => t.k), this.multi ? seeded(this.seed + this.lv * 77 + live.length) : Math.random);
    live.forEach((t, i) => { t.k = ks[i]; });
    this.items.shuffle--; this.hist = [];
    this.refresh();
  },
  /** 레벨 클리어 */
  clear() {
    const secs = Math.round((performance.now() - this.lt0) / 1000);
    if (this.multi) {
      this.score += 100 * this.lv;
      this.lv++; this.tries = 0;
      this.pop(`레벨 클리어! +${100 * (this.lv - 1)}`);
      setTimeout(() => { if (!this.over) this.load(); }, 700);
      this.refresh();
      return;
    }
    this.over = true;
    const done = this.lv, best = Math.max(+store.get('best-tilematch', 0), done);
    store.set('best-tilematch', best); store.set('tm-level', done + 1);
    showResult({ title: `🧩 레벨 ${done} 클리어!`, subtitle: `${Math.floor(secs / 60) ? Math.floor(secs / 60) + '분 ' : ''}${secs % 60}초 · 다음은 레벨 ${done + 1} (그림 ${TM.spec(done + 1).kinds}가지 · ${TM.spec(done + 1).total}개)`, solo: 'tilematch', win: true, rec: { v: done }, again: `레벨 ${done + 1} 시작` });
  },
  fail() {
    if (this.multi) {
      this.over = false; this.busy = true; this.tries++;
      this.pop('7칸이 꽉 찼어요 — 이 레벨을 다시!');
      setTimeout(() => { this.busy = false; if (!this.over) this.load(); }, 900);
      return;
    }
    this.over = true;
    setTimeout(() => showResult({ title: '🧩 7칸이 꽉 찼어요', subtitle: `레벨 ${this.lv} · 남은 타일 ${this.tiles.filter(t => t.on).length + this.tray.length + this.hold.length}개 — 같은 레벨을 새 판으로 다시 해요`, solo: 'tilematch', win: false, again: `레벨 ${this.lv} 다시` }), 500);
  },
  end() {
    if (this.over) return;
    this.over = true;
    socket.emit('sr:score', this.score); socket.emit('sr:over');
    setStatus('tilematch', `⏰ 끝! 레벨 ${this.lv} · ${this.score.toLocaleString()}점 — 결과를 기다리는 중…`);
  },
};
$('#tm-board').addEventListener('click', e => { const t = e.target.closest('.tm-tile'); if (t) TileMatch.tap(+t.dataset.id); });
$('#tm-hold').addEventListener('click', e => { const t = e.target.closest('[data-hold]'); if (t) TileMatch.tapHold(+t.dataset.hold); });
Object.assign(ACT, { tmUndo: () => TileMatch.undo(), tmOut: () => TileMatch.out(), tmShuffle: () => TileMatch.shuffle() });
register('tilematch', { solo: () => TileMatch.start({}), multi: d => TileMatch.start({ seed: d.seed, seconds: d.seconds }), stop: () => { TileMatch.over = true; } });
window.addEventListener('resize', () => { if (isScreen('tilematch')) { clearTimeout(TileMatch.rt); TileMatch.rt = setTimeout(() => TileMatch.fit(), 120); } });
