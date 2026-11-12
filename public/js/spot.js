/* =====================================================================
 *  🔍 틀린그림찾기 (v13.6 리뉴얼: 진짜 사진 · 사람이 고친 자연스러운 차이 · 확대해서 보기)
 *   사진 + 고친 곳: shared/spot-photos.js (그림 파일 /img/spot/<id>.jpg · 고친 조각 <id>-d.webp) · 판 만들기: shared/spot-core.js
 *   싱글: 혼자 도전(시간 저금통: 찾으면 시간 +, 틀리면 -5초 · 단계마다 더 많고 · 더 작고 헷갈리게)
 *         · AI 1~3명과 먼저 찾기 (AI 실력 = 사진 난이도도 같이)
 *   멀티: 모두 같은 사진에서 먼저 찾은 사람이 가져가요 (서버: games/spot.js)
 *   왼쪽 · 오른쪽 어느 사진을 눌러도 돼요. 두 손가락(또는 마우스 휠)으로 두 사진을 같이 확대 · 끌어서 옮기기.
 * ===================================================================== */
const DF = {
  COLORS: ['#22c55e', '#f97316', '#3b82f6', '#e11d8f', '#a855f7', '#eab308', '#14b8a6', '#ef4444'],
  BOT_NAMES: ['봇 돋보기', '봇 망원경', '봇 현미경'], BOT_MS: { easy: [11000, 22000], normal: [6500, 14000], hard: [3500, 8000] },
  AI_PIC: { easy: 1.8, normal: 2.6, hard: 3.4 },                  // AI 실력 = 사진 난이도
  LOCK: 1500, PENALTY: 5, HINT_COST: 5, START: 60, MAX: 99, ZMAX: 4,
};
makeScreen('spot', {
  title: '🔍 틀린그림찾기', status: '두 사진에서 다른 곳을 찾아 눌러요. 두 손가락으로 확대할 수 있어요!',
  stats: [['score', '점수'], ['stage', '단계'], ['time', '남은 시간']],
  body: `<div class="mode-row df-modes" id="df-solo">
      <button class="seg-btn on" data-act="dfMode" data-m="stage">혼자 도전</button><button class="seg-btn" data-act="dfMode" data-m="ai1">AI 1명</button><button class="seg-btn" data-act="dfMode" data-m="ai2">AI 2명</button><button class="seg-btn" data-act="dfMode" data-m="ai3">AI 3명</button>
      <span class="df-opt" id="df-aiopt"><span class="muted small">AI 실력</span><button class="seg-btn" data-act="dfLv" data-lv="easy">쉬움</button><button class="seg-btn on" data-act="dfLv" data-lv="normal">보통</button><button class="seg-btn" data-act="dfLv" data-lv="hard">고수</button></span></div>
    <div class="df-players" id="df-players"></div>
    <div class="df-bar"><div class="df-dots" id="df-dots"></div><div class="df-time"><i id="df-tbar"></i></div></div>
    <div class="df-wrap" id="df-wrap">
      <div class="df-pic" data-side="0"><div class="df-z"><canvas class="df-art" width="1200" height="900" aria-label="왼쪽 사진"></canvas><svg class="df-mk" viewBox="0 0 400 300"></svg></div></div>
      <div class="df-pic" data-side="1"><div class="df-z"><canvas class="df-art" width="1200" height="900" aria-label="오른쪽 사진"></canvas><svg class="df-mk" viewBox="0 0 400 300"></svg></div></div>
      <div class="df-load" id="df-load"><i></i>사진 불러오는 중…</div>
      <div class="df-msg" id="df-msg"></div><div class="df-plus" id="df-plus"></div></div>
    <div class="df-tools"><button class="btn ghost sm" data-act="dfHint" id="df-hint">💡 힌트</button>
      <span class="df-zoom"><button class="btn ghost sm" data-act="dfZoom" data-z="-1" aria-label="작게">－</button><button class="btn ghost sm df-zv" data-act="dfZoom" data-z="0" id="df-zv" aria-label="원래 크기">1×</button><button class="btn ghost sm" data-act="dfZoom" data-z="1" aria-label="크게">＋</button></span>
      <span class="muted small" id="df-info"></span></div>`,
});
$('#scr-spot').dataset.fitSelf = '1';
LOBBY_OPTIONS.spot = [                                            // 대기실 옵션 (서버 games/spot.js 와 같아요)
  { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
  { key: 'dfLv', label: '🤖 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '고수']] },
  { key: 'dfPic', label: '🖼️ 사진 난이도', def: 2.5, values: [[1.5, '쉬움'], [2.5, '보통'], [3.5, '어려움'], [4.5, '지옥']] },
  { key: 'rounds', label: '🖼️ 사진 수', def: 5, values: [[3, '3장'], [5, '5장'], [7, '7장']] },
  { key: 'diffs', label: '🔍 사진마다 다른 곳', def: 5, values: [[3, '3곳'], [5, '5곳'], [7, '7곳']] },
  { key: 'dfSec', label: '⏱️ 사진마다 시간', def: 90, values: [[60, '60초'], [90, '90초'], [120, '120초']] },
];

/* ─── 사진 불러오기 (사진 + 고친 조각 · 최근 것 몇 장은 기억) ─── */
const DfImg = {
  cache: new Map(),
  load(i) {
    const ph = SpotCore.photo(i);
    if (this.cache.has(ph.id)) { const c = this.cache.get(ph.id); this.cache.delete(ph.id); this.cache.set(ph.id, c); return c.p; }
    const one = src => new Promise((ok, bad) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = () => bad(new Error(src)); im.src = src; });
    const c = { p: Promise.all([one(`${SpotCore.IMG}${ph.id}.jpg`), one(`${SpotCore.IMG}${ph.id}-d.webp`)]).then(([base, atlas]) => (c.v = { base, atlas })) };
    c.p.catch(() => this.cache.delete(ph.id));
    this.cache.set(ph.id, c);
    while (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value);
    return c.p;
  },
  ready(i) { const c = this.cache.get(SpotCore.photo(i).id); return c && c.v; },
};

const Spot = {
  mode: 'stage', lv: 'normal', me: 'me', players: [], score: {}, puz: null, found: {}, phase: 'idle', round: 0, rounds: 0, lockUntil: 0, st: null, gen: 0,
  zm: { z: 1, cx: 200, cy: 150 }, ptr: new Map(), seen: [],
  color(id) { const k = Math.max(0, this.players.findIndex(p => p.id === id)); return id === this.me ? DF.COLORS[0] : DF.COLORS[1 + ((k + DF.COLORS.length - 2) % (DF.COLORS.length - 1))]; },

  /* ─── 사진 · 표시 ─── */
  /** 판을 화면에: 사진을 불러온 뒤 두 캔버스에 그려요 (고친 조각은 정해진 쪽에만) */
  draw(puz, then) {
    this.puz = puz; this.found = {}; this.drawn = null;
    $$('#df-wrap .df-mk').forEach(m => { m.innerHTML = ''; });
    $('#df-wrap').classList.remove('locked', 'done');
    this.zoom(1, 200, 150);
    this.fit(); this.dots();
    const tok = this.drawTok = (this.drawTok || 0) + 1;
    const show = () => { if (tok !== this.drawTok) return; $('#df-load').classList.remove('show'); this.fit(); this.paint(); if (then) then(true); };
    if (DfImg.ready(puz.photo)) return show();
    $('#df-load').classList.add('show');
    DfImg.load(puz.photo).then(show, () => {
      if (tok !== this.drawTok) return;
      $('#df-load').classList.remove('show');
      this.msg('사진을 못 불러왔어요 — 인터넷을 확인해 주세요', 'bad', 2200);
      if (then) then(false);
    });
  },
  paint() {
    const puz = this.puz, img = puz && DfImg.ready(puz.photo);
    if (!img) return;
    const ph = SpotCore.photo(puz.photo);
    $$('#df-wrap .df-art').forEach((cv, side) => {
      const c = cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (puz.mirror) c.setTransform(-1, 0, 0, 1, cv.width, 0);
      c.drawImage(img.base, 0, 0, cv.width, cv.height);
      const k = cv.width / 1200;
      for (const d of puz.diffs) {
        if (d.side !== side) continue;
        const [ax, ay, aw, ah, px, py] = SpotCore.diffOf(ph.d[d.j], d.j).p;
        c.drawImage(img.atlas, ax, ay, aw, ah, px * k, py * k, aw * k, ah * k);
      }
    });
    this.drawn = puz;
  },
  /** 찾은 곳: 두 사진에 같은 색 동그라미 */
  mark(i, color, cls = '') {
    const d = this.puz.diffs[i]; if (!d) return;
    const r = Math.max(10, d.r + 2.5);
    $$('#df-wrap .df-mk').forEach(m => m.insertAdjacentHTML('beforeend', `<g class="df-ring ${cls}" style="--c:${color}"><circle cx="${d.x}" cy="${d.y}" r="${n1x(r)}" /><circle class="df-glow" cx="${d.x}" cy="${d.y}" r="${n1x(r)}" /></g>`));
  },
  cross(side, x, y) {
    const m = $$('#df-wrap .df-mk')[side]; if (!m) return;
    const s = 8 / Math.max(1, this.zm.z);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'df-x'); g.innerHTML = `<path d="M${x - s},${y - s} L${x + s},${y + s} M${x + s},${y - s} L${x - s},${y + s}"/>`;
    m.append(g); setTimeout(() => g.remove(), 700);
  },
  hintRing(i) {
    const d = this.puz.diffs[i];
    $$('#df-wrap .df-mk').forEach(m => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); g.setAttribute('class', 'df-hintc'); g.setAttribute('cx', d.x); g.setAttribute('cy', d.y); g.setAttribute('r', Math.max(16, d.r + 9)); m.append(g); setTimeout(() => g.remove(), 2400); });
  },
  dots() {
    const n = this.puz ? this.puz.diffs.length : 0;
    $('#df-dots').innerHTML = Array.from({ length: n }, (_, i) => { const f = this.found[i]; return `<i class="${f != null ? 'on' : ''}" style="${f != null ? `--c:${this.color(f)}` : ''}"></i>`; }).join('')
      + `<b>${Object.keys(this.found).length} / ${n}</b>`;
  },
  msg(html, cls = '', ms = 1300) {
    const m = $('#df-msg'); m.innerHTML = html; m.className = 'df-msg show ' + cls;
    clearTimeout(this.mt); this.mt = setTimeout(() => m.classList.remove('show'), ms);
  },
  /** 시간 +/- 를 사진 위에 잠깐 */
  plus(txt, good) {
    const el = $('#df-plus'); el.textContent = txt; el.className = 'df-plus show ' + (good ? 'good' : 'bad');
    clearTimeout(this.pt); this.pt = setTimeout(() => { el.className = 'df-plus'; }, 900);
  },
  timeBar(left, total) {
    const k = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
    const b = $('#df-tbar'); b.style.width = (k * 100) + '%'; b.classList.toggle('low', left < 10000);
  },
  players1() {
    const el = $('#df-players');
    el.classList.toggle('hidden', this.players.length < 2);
    el.innerHTML = this.players.map(p => `<div class="df-p${p.id === this.me ? ' me' : ''}${p.bot ? ' bot' : ''}" data-id="${esc(p.id)}" style="--c:${this.color(p.id)}"><i></i><b>${p.bot ? '🤖 ' : ''}${esc(p.id === this.me ? `${p.name} (나)` : p.name)}</b><span>${this.score[p.id] || 0}</span></div>`).join('');
  },
  scores() {
    $$('#df-players .df-p').forEach(el => { const s = el.querySelector('span'); if (s) s.textContent = this.score[el.dataset.id] || 0; });
  },
  /** 사진 크기: 옆으로 두 장 · 위아래 두 장 중 더 크게 보이는 쪽 */
  fit() {
    const sec = $('#scr-spot'), wrap = $('#df-wrap');
    if (!sec.classList.contains('active') || !wrap.clientWidth) return;
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' ? Fit.room(sec) : innerHeight - sec.getBoundingClientRect().top;
    const top = (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const below = ($('#scr-spot .df-tools').offsetHeight || 36) + 10;
    const H = Math.max(180, room - top - below - 7), W = wrap.clientWidth, gap = 10;
    const side = Math.min((W - gap) / 2, H * 4 / 3), stack = Math.min(W, ((H - gap) / 2) * 4 / 3);
    const useSide = side >= stack * 0.96;
    wrap.classList.toggle('side', useSide); wrap.classList.toggle('stack', !useSide);
    wrap.style.setProperty('--pw', Math.floor(Math.max(150, useSide ? side : stack)) + 'px');
    this.zoom(this.zm.z, this.zm.cx, this.zm.cy);
  },
  modeUI(multi) {
    $('#scr-spot').classList.toggle('mp', multi);                 // 멀티: 위쪽 점수판이 있어서 낮은 화면에서는 이름 줄을 접어요 (spot.css)
    $('#df-solo').classList.toggle('hidden', multi);
    $('#df-aiopt').classList.toggle('hidden', this.mode === 'stage');
    $('#df-hint').classList.toggle('hidden', multi || this.mode !== 'stage');
    $$('#df-solo [data-act=dfMode]').forEach(b => b.classList.toggle('on', b.dataset.m === this.mode));
    $$('#df-solo [data-act=dfLv]').forEach(b => b.classList.toggle('on', b.dataset.lv === this.lv));
  },
  labels(a, b, c) { $('#spot-score-label').textContent = a; $('#spot-stage-label').textContent = b; $('#spot-time-label').textContent = c; },
  info() {
    if (!this.puz) { $('#df-info').textContent = ''; return; }
    const ph = SpotCore.photo(this.puz.photo), lv = this.puz.lv;
    const lvName = lv < 2 ? '쉬움' : lv < 3 ? '보통' : lv < 4 ? '어려움' : '지옥';
    $('#df-info').innerHTML = `${esc(ph.t)} · ${lvName}${this.st ? ` · 힌트 ${this.st.hints}번` : ''}<span class="df-credit"> · 📷 ${esc(ph.by)} (CC0)</span>`;
  },

  /* ─── 확대 · 옮기기 (두 사진이 같이 움직여요) ─── */
  /** z 배 확대, 사진 좌표 (cx, cy) 가 가운데 오게 — 사진 밖이 보이지 않게 맞춰요 */
  zoom(z, cx, cy) {
    z = Math.max(1, Math.min(DF.ZMAX, z));
    const hw = 200 / z, hh = 150 / z;
    cx = Math.max(hw, Math.min(400 - hw, cx)); cy = Math.max(hh, Math.min(300 - hh, cy));
    this.zm = { z, cx, cy };
    const pic = $('#df-wrap .df-pic'), w = pic ? pic.clientWidth : 0, k = w / 400;
    const tx = w / 2 - cx * k * z, ty = (w * 0.75) / 2 - cy * k * z;
    $$('#df-wrap .df-z').forEach(el => { el.style.transform = z === 1 ? '' : `translate(${tx}px,${ty}px) scale(${z})`; });
    $('#df-wrap').classList.toggle('zoomed', z > 1.01);
    const zv = $('#df-zv'); if (zv) zv.textContent = (Math.round(z * 10) / 10) + '×';
  },
  /** 화면 좌표 → 사진 좌표 (확대 반영) */
  toPic(pic, clientX, clientY) {
    const r = pic.getBoundingClientRect(), k = r.width / 400, { z, cx, cy } = this.zm;
    const sx = clientX - r.left - r.width / 2, sy = clientY - r.top - r.height / 2;
    return { x: cx + sx / (k * z), y: cy + sy / (k * z), k: k * z };
  },
  zoomAt(pic, clientX, clientY, z2) {
    const p = this.toPic(pic, clientX, clientY), r = pic.getBoundingClientRect(), k = r.width / 400;
    z2 = Math.max(1, Math.min(DF.ZMAX, z2));
    const sx = clientX - r.left - r.width / 2, sy = clientY - r.top - r.height / 2;
    this.zoom(z2, p.x - sx / (k * z2), p.y - sy / (k * z2));
  },
  pdown(e) {
    const pic = e.target.closest('.df-pic'); if (!pic) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { pic.setPointerCapture(e.pointerId); } catch (_) { /* 괜찮아요 */ }
    this.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), pic });
    if (this.ptr.size === 2) {                                     // 두 손가락: 확대 시작
      const [a, b] = [...this.ptr.values()];
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.zm.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, p0: this.toPic(pic, (a.x + b.x) / 2, (a.y + b.y) / 2), pic };
      this.gesture = true;
    } else if (this.ptr.size === 1) this.gesture = false;
  },
  pmove(e) {
    const p = this.ptr.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (this.ptr.size >= 2 && this.pinch) {
      const [a, b] = [...this.ptr.values()], pc = this.pinch;
      const z = Math.max(1, Math.min(DF.ZMAX, pc.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pc.d0));
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = pc.pic.getBoundingClientRect(), k = r.width / 400;
      this.zoom(z, pc.p0.x - (mx - r.left - r.width / 2) / (k * z), pc.p0.y - (my - r.top - r.height / 2) / (k * z));
      return;
    }
    if (this.ptr.size === 1 && (Math.abs(p.x - p.x0) > 8 || Math.abs(p.y - p.y0) > 8)) {
      this.gesture = true;
      if (this.zm.z > 1.01) {                                       // 확대했을 때 끌면 옮기기
        const r = p.pic.getBoundingClientRect(), k = r.width / 400 * this.zm.z;
        const dx = e.clientX - (p.lx != null ? p.lx : p.x0), dy = e.clientY - (p.ly != null ? p.ly : p.y0);
        p.lx = e.clientX; p.ly = e.clientY;
        this.zoom(this.zm.z, this.zm.cx - dx / k, this.zm.cy - dy / k);
      }
    }
  },
  pup(e, cancel) {
    const p = this.ptr.get(e.pointerId); if (!p) return;
    this.ptr.delete(e.pointerId);
    if (this.ptr.size < 2) this.pinch = null;
    if (cancel || this.gesture || this.ptr.size) { if (!this.ptr.size) this.gesture = false; return; }
    if (performance.now() - p.t > 900) return;                     // 오래 누르기는 누르기가 아니에요
    this.tap(p.pic, e.clientX, e.clientY, e.pointerType);
  },
  wheel(e) {
    const pic = e.target.closest('.df-pic'); if (!pic) return;
    e.preventDefault();
    const dz = Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * (e.ctrlKey ? 0.012 : 0.0022));
    this.zoomAt(pic, e.clientX, e.clientY, this.zm.z * dz);
  },
  zoomBtn(dir) {
    if (!dir) return this.zoom(1, 200, 150);
    this.zoom(this.zm.z * (dir > 0 ? 1.5 : 1 / 1.5), this.zm.cx, this.zm.cy);
  },

  /* ─── 누르기 ─── */
  tap(pic, clientX, clientY, ptype) {
    if (!this.puz || this.drawn !== this.puz) return;
    const { x, y, k } = this.toPic(pic, clientX, clientY), side = +pic.dataset.side;
    if (x < 0 || x > 400 || y < 0 || y > 300) return;
    if (this.phase !== 'play') return;
    if (performance.now() < this.lockUntil) { if (!this.st) this.msg('잠깐! 틀려서 쉬는 중이에요', 'bad', 700); return; }
    const tol = Math.max(5, Math.min(22, (ptype === 'mouse' ? 7 : 15) / k));   // 손가락 여유: 화면에서 약 15px (확대하면 더 정확하게)
    if (this.mode === 'multi') { socket.emit('df:tap', { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: this.round, tol: Math.round(tol * 10) / 10 }); this.lastTap = { side, x, y }; return; }
    const i = SpotCore.hit(this.puz.diffs, x, y, this.found, tol);
    if (i >= 0) return this.got(this.me, i);
    if (SpotCore.near(this.puz.diffs, x, y, this.found, tol)) return;
    this.miss(side, x, y);
  },
  got(id, i, sc) {
    if (this.found[i] != null) return;
    this.found[i] = id;
    if (sc) Object.assign(this.score, sc); else this.score[id] = (this.score[id] || 0) + 1;
    const mine = id === this.me;
    this.mark(i, this.color(id), mine ? 'mine' : 'other');
    if (typeof Sound !== 'undefined') Sound.play(mine ? 'pop' : 'tap');
    if (!mine) { const p = this.players.find(x => x.id === id); this.msg(`${esc(p ? p.name : '')} 님이 찾았어요`, '', 800); }
    if (this.st) this.foundStage();
    this.dots(); this.scores(); this.statsVs();
    if (Object.keys(this.found).length >= this.puz.diffs.length && this.mode !== 'multi') this.roundDone();
  },
  miss(side, x, y) {
    this.cross(side, x, y);
    if (typeof Sound !== 'undefined') Sound.play('bad');
    if (this.st) {
      const st = this.st;
      st.endAt -= DF.PENALTY * 1000; st.streak = 0; st.miss++;
      this.lockUntil = performance.now() + 350;                     // 마구 누르기 방지
      this.plus(`-${DF.PENALTY}초`, false);
      return;
    }
    this.lockUntil = performance.now() + DF.LOCK;
    $('#df-wrap').classList.add('locked'); setTimeout(() => $('#df-wrap').classList.remove('locked'), DF.LOCK);
    this.msg('틀렸어요 — 1.5초 쉬기', 'bad', DF.LOCK);
  },
  /** 못 찾은 곳 보여 주기 */
  reveal(list) { list.forEach(i => this.mark(i, '#9aa3b5', 'missed')); $('#df-wrap').classList.add('done'); },
  /** 같은 사진이 자꾸 나오지 않게: 최근 본 사진 (이 기기에 기억) */
  remember(pi) {
    this.seen = [pi].concat(this.seen.filter(x => x !== pi)).slice(0, Math.max(0, Math.min(24, SpotCore.count - 6)));
    store.set('spot-seen', this.seen.join(','));
  },
  /** 다음 판을 미리 정하고 사진을 미리 받아 둬요 */
  nextPuz(n, lv) {
    const puz = SpotCore.make(1 + Math.floor(Math.random() * 2147480000), n, lv, { avoid: this.seen });
    this.remember(puz.photo);
    DfImg.load(puz.photo).catch(() => {});
    return puz;
  },

  /* ─── 혼자 도전 (시간 저금통) ─── */
  startSolo() { if (this.mode === 'stage') this.startStage(); else this.startVs(+this.mode.slice(2) || 1); },
  startStage() {
    stopLocal();
    S.solo = 'spot';
    show('spot');
    this.mode = 'stage'; this.me = 'me'; this.players = [{ id: 'me', name: nick() }]; this.score = { me: 0 };
    this.st = { stage: 0, score: 0, hints: 2, over: false, bank: DF.START * 1000, endAt: 0, streak: 0, miss: 0, best: +store.get('best-spot3', 0) || 0, rec: false };
    this.modeUI(false); this.players1();
    this.labels('점수', '단계', '남은 시간');
    setStatus('spot', '찾을 때마다 시간 +, 틀리면 -5초. 단계가 오를수록 다른 곳이 많아지고 더 작아져요 — 시간이 바닥나면 끝!');
    this.stage(0);
    every(150, () => this.tickStage());
  },
  /** k단계 (0부터): 다른 곳 3 → 7곳, 사진 난이도 1.5 → 4.5 (작고 헷갈리는 곳이 많아져요), 찾을 때 늘어나는 시간 9초 → 3초 */
  stageCfg(k) { return { n: Math.min(7, 3 + Math.floor(k / 2)), lv: Math.min(4.5, 1.5 + k * 0.32), gain: Math.max(3, 9 - 0.45 * k) }; },
  stage(k) {
    const st = this.st, cfg = this.stageCfg(k);
    Object.assign(st, { stage: k, n: cfg.n, lv: cfg.lv, gain: cfg.gain, t0: 0 });
    this.pauseClock();
    this.phase = 'ready';
    const puz = st.next && st.next.k === k ? st.next.puz : this.nextPuz(cfg.n, cfg.lv);
    const id = st.token = (st.token || 0) + 1;
    this.info();
    this.draw(puz, ok => {
      if (st.token !== id || st.over) return;
      this.info();
      if (!ok) { after(1500, () => { if (st.token === id && !st.over) this.stage(k); }); return; }
      this.msg(`<b>${k + 1}단계</b> 다른 곳 ${puz.diffs.length}곳 · 찾으면 +${Math.round(st.gain * 10) / 10}초`, 'info', 1000);
      after(1000, () => { if (st.token === id && !st.over) { this.phase = 'play'; this.runClock(); st.t0 = performance.now(); } });
      const nc = this.stageCfg(k + 1); st.next = { k: k + 1, puz: this.nextPuz(nc.n, nc.lv) };   // 다음 사진 미리 받기
    });
    this.paintStage();
  },
  runClock() { const st = this.st; st.endAt = performance.now() + st.bank; },
  pauseClock() { const st = this.st; if (st.endAt) st.bank = Math.max(0, st.endAt - performance.now()); st.endAt = 0; },
  left() { const st = this.st; return st.endAt ? st.endAt - performance.now() : st.bank; },
  foundStage() {
    const st = this.st, k = st.stage;
    st.streak++;
    const pts = Math.round(100 * (1 + 0.15 * k) * (1 + Math.min(10, st.streak - 1) * 0.1));
    st.score += pts;
    if (st.endAt) st.endAt = Math.min(performance.now() + DF.MAX * 1000, st.endAt + st.gain * 1000);
    this.plus(`+${Math.round(st.gain * 10) / 10}초`, true);
    this.paintStage();
  },
  paintStage() {
    const st = this.st;
    setStat('spot', 'score', st.score.toLocaleString('ko-KR') + '점');
    setStat('spot', 'stage', `${st.stage + 1}단계`);
    const h = $('#df-hint');
    h.disabled = !st.hints || this.phase !== 'play';
    h.innerHTML = `💡 힌트 <small>${st.hints}번 · -${DF.HINT_COST}초</small>`;
    if (!st.rec && st.best > 0 && st.score > st.best) { st.rec = true; this.msg('🎉 <b>신기록!</b>', 'good', 1100); if (typeof Sound !== 'undefined') Sound.play('title'); }
  },
  tickStage() {
    const st = this.st;
    if (!st || st.over || this.mode !== 'stage') return;
    const left = this.left();
    setStat('spot', 'time', Math.max(0, Math.ceil(left / 1000)) + '초');
    this.timeBar(left, DF.MAX * 1000);
    $('#df-hint').disabled = !st.hints || this.phase !== 'play';
    if (left <= 0 && this.phase === 'play') this.endStage();
  },
  hint() {
    const st = this.st;
    if (!st || this.phase !== 'play' || !st.hints) return;
    const left = this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null);
    if (!left.length) return;
    st.hints--; st.endAt -= DF.HINT_COST * 1000; st.streak = 0;
    this.hintRing(left[Math.floor(Math.random() * left.length)]);
    this.plus(`-${DF.HINT_COST}초`, false);
    this.info(); this.paintStage();
  },
  roundDone() {
    if (this.mode === 'stage') {
      const st = this.st, k = st.stage;
      this.phase = 'gap';
      if (st.endAt) st.endAt += 4000;                                   // 다 찾으면 +4초
      this.pauseClock();
      const fast = st.t0 ? (performance.now() - st.t0) / 1000 : 99, bonus = 300 * (k + 1) + Math.max(0, Math.round((st.n * 8 - fast) * 20)) * (k + 1);
      st.score += bonus;
      if ((k + 1) % 3 === 0 && st.hints < 3) st.hints++;                  // 3단계마다 힌트 +1 (최대 3)
      this.paintStage(); this.info();
      $('#df-wrap').classList.add('done');
      this.msg(`<b>${k + 1}단계 성공!</b><br>+4초 · 보너스 +${bonus.toLocaleString('ko-KR')}점`, 'good', 1700);
      if (typeof Sound !== 'undefined') Sound.play('mission');
      after(1900, () => { if (this.st === st && !st.over) this.stage(k + 1); });
      return;
    }
    this.endVsRound();
  },
  endStage() {
    const st = this.st;
    if (st.over) return;
    st.over = true; this.phase = 'over';
    this.zoom(1, 200, 150);
    this.reveal(this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null));
    const best = Math.max(st.best, st.score); store.set('best-spot3', best);
    this.msg('⏰ 시간 끝! 못 찾은 곳은 회색 동그라미', 'bad', 2200);
    after(2600, () => showResult({
      title: `⏰ ${st.stage + 1}단계에서 시간 끝!`, subtitle: `${st.stage}단계 성공 · ${st.score.toLocaleString('ko-KR')}점${st.score > st.best ? ' · 🎉 신기록!' : ` · 최고 ${best.toLocaleString('ko-KR')}점`}`,
      solo: 'spot', win: st.stage >= 6, rec: { v: st.score },
    }));
  },

  /* ─── AI 대결 (화면 안에서) ─── */
  startVs(nb) {
    stopLocal();
    S.solo = 'spot';
    show('spot');
    this.st = null; this.me = 'me';
    this.players = [{ id: 'me', name: nick() }].concat(Array.from({ length: nb }, (_, i) => ({ id: 'bot' + i, name: DF.BOT_NAMES[i], bot: true })));
    this.score = Object.fromEntries(this.players.map(p => [p.id, 0]));
    this.round = 0; this.rounds = 5; this.vsN = 5; this.vsSec = 90;
    this.modeUI(false); this.players1();
    this.labels('내 점수', '사진', '남은 시간');
    setStatus('spot', `AI ${nb}명과 같은 사진에서 먼저 찾기! 다른 곳 1곳 = 1점 · 틀리면 1.5초 쉬기.`);
    $('#df-info').textContent = '';
    this.vsNext();
    every(200, () => {
      if (this.mode === 'stage' || this.mode === 'multi' || this.phase !== 'play') return;
      const left = this.vsEnd - performance.now();
      setStat('spot', 'time', Math.max(0, Math.ceil(left / 1000)) + '초'); this.timeBar(left, this.vsSec * 1000);
      if (left <= 0) this.endVsRound();
    });
  },
  vsNext() {
    if (this.round >= this.rounds) return this.endVs();
    this.round++;
    const gen = ++this.gen;
    this.phase = 'ready';
    const puz = this.vsPre || this.nextPuz(this.vsN, DF.AI_PIC[this.lv] || 2.6);
    this.vsPre = null;
    this.statsVs();
    this.draw(puz, ok => {
      if (gen !== this.gen) return;
      this.info();
      if (!ok) { after(1500, () => { if (gen === this.gen) { this.round--; this.vsNext(); } }); return; }
      this.msg(`<b>사진 ${this.round} / ${this.rounds}</b>`, 'info', 800);
      this.vsEnd = performance.now() + 900 + this.vsSec * 1000;
      if (this.round < this.rounds) this.vsPre = this.nextPuz(this.vsN, DF.AI_PIC[this.lv] || 2.6);
      after(900, () => {
        if (gen !== this.gen) return;
        this.phase = 'play';
        for (const p of this.players.filter(x => x.bot)) this.planBot(p.id, gen);
      });
    });
  },
  planBot(id, gen) {
    const [lo, hi] = DF.BOT_MS[this.lv] || DF.BOT_MS.normal;
    after(lo + Math.random() * (hi - lo), () => {
      if (gen !== this.gen || this.phase !== 'play') return;
      const left = this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null);
      if (!left.length) return;
      this.got(id, left[Math.floor(Math.random() * left.length)]);
      this.planBot(id, gen);
    });
  },
  endVsRound() {
    if (this.phase !== 'play') return;
    this.phase = 'gap'; this.gen++;
    const missed = this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null);
    this.zoom(1, 200, 150);
    this.reveal(missed);
    this.msg(missed.length ? `시간 끝! 못 찾은 곳 ${missed.length}곳` : '모두 찾았어요!', missed.length ? '' : 'good', 1500);
    after(2600, () => this.vsNext());
  },
  endVs() {
    this.phase = 'over';
    const ranked = this.players.slice().sort((a, b) => (this.score[b.id] || 0) - (this.score[a.id] || 0));
    const me = this.score.me || 0, top = this.score[ranked[0].id] || 0, win = me === top && ranked.filter(p => (this.score[p.id] || 0) === top).length === 1;
    showResult({ title: win ? '🏆 AI를 이겼어요!' : me === top ? '🤝 공동 1등!' : '🔍 아쉽게 졌어요', subtitle: ranked.map(p => `${p.id === 'me' ? '나' : p.name} ${this.score[p.id] || 0}곳`).join(' · '), solo: 'spot', win });
  },
  statsVs() {
    if (this.st) return;
    setStat('spot', 'score', `${this.score[this.me] || 0}곳`);
    setStat('spot', 'stage', `${this.round}/${this.rounds}`);
  },

  /* ─── 멀티 ─── */
  startMulti(d) {
    if (!d.resync || !isScreen('spot')) { stopLocal(); show('spot'); }
    this.mode = 'multi'; this.st = null; this.me = S.myId; this.gen++;
    this.players = d.players; this.score = Object.assign(Object.fromEntries(d.players.map(p => [p.id, 0])), d.score || {});
    this.rounds = d.rounds; this.round = 0; this.vsSec = d.sec; this.phase = 'ready';
    this.modeUI(true); this.players1();
    this.labels('내 점수', '사진', '남은 시간');
    setStatus('spot', '모두 같은 사진! 다른 곳을 먼저 찾아 누르면 내 점수예요. 틀리면 1.5초 쉬기.');
    $('#df-dots').innerHTML = ''; $('#df-info').textContent = '곧 첫 사진이 나와요';
    if (d.next != null) DfImg.load(d.next).catch(() => {});
    this.statsVs(); renderScores();
    requestAnimationFrame(() => this.fit());                        // 점수판이 생긴 뒤 크기 다시
    every(200, () => {
      if (this.mode !== 'multi' || this.phase !== 'play') return;
      const left = this.vsEnd - performance.now();
      setStat('spot', 'time', Math.max(0, Math.ceil(left / 1000)) + '초'); this.timeBar(left, this.vsSec * 1000);
    });
  },
  roundMulti(d) {
    if (this.mode !== 'multi') return;
    this.round = d.round; this.rounds = d.rounds; this.vsSec = d.sec;
    const puz = SpotCore.make(d.seed, d.n, d.lv, { photo: d.photo });
    if (d.score) Object.assign(this.score, d.score);
    this.vsEnd = performance.now() + d.left;                       // left 는 준비 시간까지 들어 있어요
    const gen = ++this.gen, found = d.found || [];
    this.phase = d.gap ? 'gap' : 'ready';
    this.draw(puz, () => {
      if (gen !== this.gen) return;
      found.forEach(([i, id]) => this.mark(i, this.color(id), id === this.me ? 'mine' : 'other'));
      this.dots(); this.info();
    });
    found.forEach(([i, id]) => { this.found[i] = id; });
    this.dots(); this.scores(); this.statsVs(); this.info();
    if (d.gap) return;
    if (!d.resync) this.msg(`<b>사진 ${d.round} / ${d.rounds}</b>`, 'info', 800);
    after(d.at || 0, () => { if (gen === this.gen) this.phase = 'play'; });
  },
};
const n1x = v => Math.round(v * 10) / 10;
{
  const wrap = $('#df-wrap');
  wrap.addEventListener('pointerdown', e => Spot.pdown(e));
  wrap.addEventListener('pointermove', e => Spot.pmove(e));
  wrap.addEventListener('pointerup', e => Spot.pup(e, false));
  wrap.addEventListener('pointercancel', e => Spot.pup(e, true));
  wrap.addEventListener('wheel', e => Spot.wheel(e), { passive: false });
  wrap.addEventListener('contextmenu', e => { if (e.target.closest('.df-pic')) e.preventDefault(); });
  ['gesturestart', 'gesturechange'].forEach(t => wrap.addEventListener(t, e => e.preventDefault()));   // iOS 사파리: 페이지 확대 대신 사진 확대
}
Spot.seen = String(store.get('spot-seen', '') || '').split(',').filter(Boolean).map(Number).filter(n => n >= 0 && n < SpotCore.count);
Object.assign(ACT, {
  dfMode: el => { Spot.mode = el.dataset.m; Spot.startSolo(); },
  dfLv: el => { Spot.lv = el.dataset.lv; if (Spot.mode !== 'stage') Spot.startSolo(); else Spot.modeUI(false); },
  dfHint: () => Spot.hint(),
  dfZoom: el => Spot.zoomBtn(+el.dataset.z),
});
register('spot', {
  solo: () => { if (Spot.mode === 'multi') Spot.mode = 'stage'; Spot.startSolo(); },
  stop: () => { if (Spot.st) Spot.st.over = true; Spot.gen++; Spot.phase = 'idle'; Spot.ptr.clear(); },
  key: e => {
    if (e.key === '+' || e.key === '=') { Spot.zoomBtn(1); return true; }
    if (e.key === '-' || e.key === '_') { Spot.zoomBtn(-1); return true; }
    if (e.key === '0') { Spot.zoomBtn(0); return true; }
    return false;
  },
});
socket.on('df:start', d => Spot.startMulti(d));
socket.on('df:round', d => { if (isScreen('spot')) Spot.roundMulti(d); });
socket.on('df:found', d => { if (isScreen('spot') && Spot.mode === 'multi' && d.round === Spot.round) Spot.got(d.id, d.i, d.score); });
socket.on('df:miss', d => { if (isScreen('spot') && Spot.mode === 'multi') { const t = Spot.lastTap; Spot.miss(t ? t.side : 1, d.x, d.y); } });
socket.on('df:end', d => {
  if (!isScreen('spot') || Spot.mode !== 'multi' || d.round !== Spot.round) return;
  Spot.phase = 'gap';
  if (d.score) Object.assign(Spot.score, d.score);
  Spot.zoom(1, 200, 150);
  Spot.reveal(d.missed || []); Spot.scores(); Spot.statsVs();
  Spot.msg(d.why === 'all' ? '모두 찾았어요!' : `시간 끝! 못 찾은 곳 ${(d.missed || []).length}곳`, d.why === 'all' ? 'good' : '', 1500);
  if (d.next != null) DfImg.load(d.next).catch(() => {});
});
window.addEventListener('resize', () => { if (isScreen('spot')) { clearTimeout(Spot.rt); Spot.rt = setTimeout(() => Spot.fit(), 120); } });
