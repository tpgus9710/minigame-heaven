/* =====================================================================
 *  🎲 요트 다이스 화면 (규칙: shared/yacht-core.js · 소리: yacht-audio.js · 디자인: css/yacht.css)
 *  v12.7 리마스터
 *   · 컵을(또는 버튼을) 꾹 누르면 컵이 흔들리며 달그락, 손을 떼면 컵을 테이블에 탁! 엎었다 들어 올리면 주사위가 흩어져 있어요
 *   · 남길 주사위는 눌러서 위쪽 KEEP 줄로 (다시 누르면 테이블로) · 점수 칸은 한 번 눌러 고르고 한 번 더(또는 「기록하기」) 눌러 기록
 *   · 다른 사람(봇) 차례도 같은 장면으로 보여 줘요 — 장면 시간은 YachtCore.PACE, 봇도 장면이 끝날 때까지 기다려요
 *   · 요트 · 스트레이트 · 풀 하우스 · 포 다이스가 나오면 축하 · 새로 지은 재즈 카페풍 배경음악 (🎵 로 켜고 끄기)
 * ===================================================================== */
makeScreen('yacht', {
  title: '🎲 요트 다이스', status: '컵을 꾹 눌러 흔들고 손을 떼면 탁! 남길 주사위는 눌러서 KEEP 줄로 옮겨요.',
  stats: [['round', '라운드'], ['rolls', '남은 굴림'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="yc-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="ycSolo" data-bots="0">혼자 (점수 도전)</button><button class="seg-btn on" data-act="ycSolo" data-bots="1">1명</button>
      <button class="seg-btn" data-act="ycSolo" data-bots="2">2명</button><button class="seg-btn" data-act="ycSolo" data-bots="3">3명</button></div>
    <div class="yc-wrap">
      <div class="yc-left">
        <div class="yc-tray" id="yc-tray">
          <div class="yc-top"><div class="yc-who" id="yc-who"></div><button class="yc-bgm" id="yc-bgm" data-act="ycBgm" aria-label="배경음악 켜기 · 끄기" title="배경음악">♪</button></div>
          <div class="yc-keep" id="yc-keep"><b>KEEP</b><i></i><i></i><i></i><i></i><i></i></div>
          <div class="yc-felt" id="yc-felt"></div>
          <div class="yc-cup" id="yc-cup"><div class="yc-cupi"></div></div>
          ${[0, 1, 2, 3, 4].map(i => `<button class="yc-die" data-i="${i}" aria-label="주사위 ${i + 1}"></button>`).join('')}
          <div class="yc-pop hidden" id="yc-pop"></div>
        </div>
        <div class="yc-bar" id="yc-bar"></div>
        <div class="yc-msg" id="yc-msg"></div>
      </div>
      <div class="yc-card"><table class="yc-table" id="yc-table"></table></div>
    </div>`,
});

const YC = YachtCore, YA = YachtAudio;
const YC_CUP_SVG = `<svg viewBox="0 0 100 112" aria-hidden="true"><defs>
  <linearGradient id="ycCupG" x1="0" x2="1"><stop offset="0" stop-color="#4a230e"/><stop offset=".38" stop-color="#9a5a2c"/><stop offset=".62" stop-color="#7c4421"/><stop offset="1" stop-color="#3f1d0b"/></linearGradient>
  <radialGradient id="ycCupIn" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#1c0d05"/><stop offset="1" stop-color="#3b1d0c"/></radialGradient></defs>
  <path d="M13 20 L24 101 Q50 111 76 101 L87 20 Z" fill="url(#ycCupG)"/>
  <path d="M19 44 Q50 53 81 44" stroke="#d9a066" stroke-width="1.7" stroke-dasharray="3.5 3" fill="none" opacity=".75"/>
  <path d="M23 86 Q50 95 77 86" stroke="#d9a066" stroke-width="1.7" stroke-dasharray="3.5 3" fill="none" opacity=".75"/>
  <path d="M28 30 L34 96" stroke="rgba(255,255,255,.17)" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="50" cy="20" rx="37" ry="10.5" fill="url(#ycCupIn)" stroke="#d9a066" stroke-width="3.2"/></svg>`;
const YC_COMBO = { yacht: '요트!!', ls: '라지 스트레이트!', ss: '스몰 스트레이트!', full: '풀 하우스!', four: '포 다이스!' };

const Yacht = {
  q: [], busy: false, lastN: 0, gen: 0, d: null, sel: null, shaking: false,
  /** 이 화면에서만 쓰는 기다리기 (새 판이 되면 멈춰요) */
  wait(ms) { const g = this.gen; return new Promise(res => setTimeout(() => res(g === this.gen && isScreen('yacht')), ms)); },
  pl(id) { return (this.v && this.v.players.find(p => p.id === id)) || { name: '?' }; },
  mine() { const v = this.v; return !!v && !!this.ctx && v.turnId === this.ctx.me && !v.over; },

  /* ─────────── 자리 계산 (트레이 크기가 바뀌면 다시) ─────────── */
  layout() {
    const tray = $('#yc-tray'); if (!tray || !tray.offsetWidth) return false;
    const W = tray.clientWidth;
    // 트레이 폭과 화면 높이로 정해요 (트레이 높이로 정하면 그 높이가 다시 주사위 크기를 바꿔 계속 작아져요) — 낮은 화면(폴드 커버 · 노트북)은 조금 작게
    const ds = Math.round(Math.max(32, Math.min(72, W * 0.118, window.innerHeight * 0.066)));
    if (ds !== this.ds) { tray.style.setProperty('--ds', ds + 'px'); this.ds = ds; }
    const felt = $('#yc-felt');
    const rel = el => { let x = 0, y = 0, n = el; while (n && n !== tray) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y }; };   // 트레이 기준 위치
    this.K = [...$$('#yc-keep i')].map(el => { const p = rel(el); return { x: p.x + el.offsetWidth / 2, y: p.y + el.offsetHeight / 2 }; });
    const fp = rel(felt);
    this.F = { x: fp.x, y: fp.y, w: felt.offsetWidth, h: felt.offsetHeight };
    this.cw = Math.round(Math.min(ds * 1.8, this.F.h * 0.82)); this.ch = Math.round(this.cw * 1.12);
    const cupEl = $('#yc-cup'); cupEl.style.width = this.cw + 'px'; cupEl.style.height = this.ch + 'px';
    this.zoneW = this.F.w - this.cw - 14;                                      // 주사위가 흩어지는 곳 (컵 자리 빼고)
    this.home = { x: this.F.x + this.F.w - this.cw / 2 - 6, y: this.F.y + this.F.h / 2 + 2 };
    this.center = { x: this.F.x + this.zoneW / 2 + 4, y: this.F.y + this.F.h / 2 };
    return true;
  },
  /** 굴림마다 정해진(같은 굴림이면 늘 같은) 흩어진 자리 — 칸 크기에 대한 비율이라 화면이 바뀌어도 그대로 */
  scatter(seed) {
    let a = (seed * 2654435761) >>> 0;
    const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ds = this.ds, zw = Math.max(ds * 3, this.zoneW), fh = this.F.h, out = [];
    const mx = ds * 0.72, my = ds * 0.68;
    for (let i = 0; i < 5; i++) {
      let best = null;
      for (let k = 0; k < 160; k++) {
        const x = mx + rnd() * Math.max(1, zw - 2 * mx), y = my + rnd() * Math.max(1, fh - 2 * my);
        const dmin = Math.min(Infinity, ...out.map(p => Math.hypot(p.x - x, p.y - y)));
        if (!best || dmin > best.d) best = { x, y, d: dmin };
        if (dmin > ds * 1.32) break;
      }
      out.push({ x: best.x, y: best.y });
    }
    return out.map(p => ({ fx: p.x / this.F.w, fy: p.y / fh, r: Math.round((rnd() - 0.5) * 44) }));
  },
  /** 주사위 하나를 자리로: keep(위 칸) · felt(테이블) · cup(컵 안 = 안 보임) · under(컵 아래 가운데) */
  placeDie(i, where, anim, delay = 0) {
    const el = this.dice[i], ds = this.ds; if (!el) return;
    let x, y, r = 0, s = 1, op = 1;
    if (where === 'keep') ({ x, y } = this.K[i]);
    else if (where === 'felt') { const p = this.d.pos[i] || { fx: 0.3, fy: 0.5, r: 0 }; x = this.F.x + p.fx * this.F.w; y = this.F.y + p.fy * this.F.h; r = p.r; }
    else if (where === 'under') { x = this.center.x + (i - 2) * ds * 0.18; y = this.center.y + ((i % 2) - 0.5) * ds * 0.2; s = 0.78; r = (i - 2) * 25; }
    else { const c = this.cupAt || this.home; x = c.x; y = c.y - this.ch * 0.3; s = 0.3; op = 0; }
    el.style.transition = anim ? `transform ${anim}ms cubic-bezier(.2,.9,.3,1.12) ${delay}ms, opacity ${Math.min(anim, 220)}ms ${delay}ms` : 'none';
    el.style.transform = `translate(${x - ds / 2}px, ${y - ds / 2}px) rotate(${r}deg) scale(${s})`;
    el.style.opacity = op;
    el.classList.toggle('kept', where === 'keep');
    this.d.where[i] = where;
  },
  face(i, n) { const el = this.dice[i]; if (el) el.innerHTML = Pieces.die(n); },
  /** 컵: home(제자리 · 입구 위) · down(가운데에 엎음) · lift(엎은 채 들어 올림) */
  placeCup(state, anim) {
    const el = $('#yc-cup'); if (!el) return;
    const p = state === 'home' ? this.home : this.center, lift = state === 'lift' ? this.ch * 0.85 : 0;
    this.cupAt = p;
    el.style.transition = anim ? `transform ${anim}ms ${state === 'down' ? 'cubic-bezier(.55,0,.9,.45)' : 'cubic-bezier(.25,.8,.35,1)'}` : 'none';
    el.style.transform = `translate(${p.x - this.cw / 2}px, ${p.y - this.ch / 2 - lift}px) rotate(${state === 'home' ? 0 : 180}deg) scale(${state === 'down' ? 1.06 : 1})`;
    el.classList.toggle('flip', state !== 'home');
  },
  /** 화면 상태(d)대로 모두 다시 놓기 (애니메이션 없이) */
  placeAll() {
    if (!this.d || !this.layout()) return;
    for (let i = 0; i < 5; i++) this.placeDie(i, this.d.where[i] === 'under' ? 'felt' : this.d.where[i]);
    this.placeCup('home');
  },

  /* ─────────── 그리기 ─────────── */
  build() {
    $('#yc-cup .yc-cupi').innerHTML = YC_CUP_SVG;
    this.dice = [...$$('#yc-tray .yc-die')];
    this.dice.forEach((el, i) => { el.onclick = () => ACT.ycHold(el); el.innerHTML = Pieces.die(i + 1); });
    this.paintBgm();
  },
  reset(v) {
    this.gen++; this.q = []; this.busy = false; this.sel = null; this.endPlayed = false; this.myRoll = false; this.needPlace = false; this.stopShake(true);
    this.lastN = v.seq || 0;
    const d = this.d = { dice: v.dice.slice(), held: v.held.slice(), where: [], pos: [], score: {}, rollN: v.rollN };
    v.players.forEach(p => { d.score[p.id] = { ...p.score }; });
    this.layout();
    d.pos = this.scatter(v.rollN + 7);
    for (let i = 0; i < 5; i++) { this.face(i, d.dice[i]); this.placeDie(i, !v.rolls && !v.rollN ? 'cup' : d.held[i] ? 'keep' : 'felt'); }
    this.placeCup('home');
    this.turnShown = null;
  },
  render(v, ctx, prev) {
    const fresh = !prev || this.tableRef !== Table.cur || !this.d;
    this.v = v; this.ctx = ctx;
    if (fresh) { this.tableRef = Table.cur; if (!this.dice) this.build(); this.reset(v); YA.music.start(); this.paintBgm(); }
    $('#yc-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    setStat('yacht', 'round', `${v.round} / 12`);
    const evs = (v.log || []).filter(e => e.n > this.lastN);
    if (evs.length) { this.q.push(...evs); this.lastN = evs[evs.length - 1].n; }
    if (!this.busy) this.next(); else this.paintBar();
  },
  /** 기록을 하나씩: 굴림 = 컵 장면 · 기록 = 점수 칸 반짝 */
  async next() {
    if (this.busy) return;
    const e = this.q.shift();
    if (!e) return this.sync();
    this.busy = true; this.paintBar();
    const g = this.gen;
    try {
      if (e.t === 'roll') await this.playRoll(e);
      else if (e.t === 'score') await this.playScore(e);
    } catch (err) { console.error(err); }
    if (g !== this.gen) return;
    this.busy = false;
    this.next();
  },
  /** 다 보여 줬어요 → 최신 상태로 */
  sync() {
    const v = this.v, d = this.d; if (!v || !d) return;
    v.players.forEach(p => { d.score[p.id] = { ...p.score }; });
    if (this.needPlace) { this.needPlace = false; this.placeAll(); }
    if (v.rolls && !this.shaking) {                                           // 고정 상태를 화면에 맞춰요 (KEEP ↔ 테이블 · 멀티에서 남이 고른 것도)
      this.layout();
      for (let i = 0; i < 5; i++) {
        const want = v.held[i] ? 'keep' : 'felt';
        if (d.where[i] !== want && (d.where[i] === 'keep' || d.where[i] === 'felt')) this.placeDie(i, want, 260);
        d.held[i] = v.held[i];
      }
    }
    const turnNow = v.turnId;
    if (turnNow !== this.turnShown) {
      this.turnShown = turnNow;
      if (this.mine() && this.ctx.mode === 'solo') YA.sfx.turn();
      if (this.sel) this.sel = null;
    }
    this.paintWho(); this.paintBar(); this.table();
    setStat('yacht', 'rolls', this.mine() || v.rolls ? `${3 - v.rolls}번` : '-');
    $('#yc-msg').textContent = v.msg || '';
    if (v.over && !this.endPlayed) { this.endPlayed = true; YA.sfx.end(); setTimeout(() => YA.music.stop(1.6), 400); }
  },
  paintWho(id) {
    const v = this.v, who = id || v.turnId, me = who === this.ctx.me;
    $('#yc-who').innerHTML = v.over ? '🏁 게임 끝!' : `<i style="--c:${avColor(who)}"></i><b>${me ? '내 차례' : esc(this.pl(who).name) + ' 님 차례'}</b>`;
    $('#yc-who').classList.toggle('me', me && !v.over);
  },
  /** 트레이 아래: 굴리기(꾹 눌러 흔들기) · 고른 칸 기록하기 · 다른 사람 차례 */
  paintBar() {
    const v = this.v, bar = $('#yc-bar'); if (!v || !bar) return;
    const mine = this.mine();
    $('#yc-tray').classList.toggle('ready', mine && !this.busy && v.rolls < 3 && !this.sel);
    if (v.over) { bar.innerHTML = ''; return; }
    if (!mine) { bar.innerHTML = `<div class="yc-wait">${this.busy ? '🎲' : '🤔'} ${esc(this.pl(v.turnId).name)} 님 차례<span class="dots"><i></i><i></i><i></i></span></div>`; return; }
    if (this.sel && v.preview && v.preview[this.sel] != null) {
      const name = YC.CATS.find(c => c[0] === this.sel)[1], pts = v.preview[this.sel];
      bar.innerHTML = `<div class="yc-confirm"><span>「<b>${name}</b>」에 <b class="pts">${pts}점</b></span>
        <button class="btn good" data-act="ycConfirm">기록하기</button><button class="btn ghost" data-act="ycCancel">취소</button></div>`;
      return;
    }
    const left = 3 - v.rolls;
    if (left <= 0) { bar.innerHTML = '<div class="yc-hint">마지막 굴림이에요. 점수표에서 칸을 골라 주세요 👉</div>'; return; }
    bar.innerHTML = `<button class="btn good lg yc-roll${this.shaking ? ' on' : ''}" id="yc-roll" ${this.busy && !this.shaking ? 'disabled' : ''}>
        <b>${this.shaking ? '손을 떼면 탁!' : v.rolls ? '🎲 다시 굴리기' : '🎲 굴리기'}</b><small>${this.shaking ? '흔드는 중…' : `꾹 눌러 흔들기 · ${left}번 남음`}</small></button>
      <div class="yc-hint">${v.rolls ? '남길 주사위는 눌러서 KEEP으로 · 점수 칸을 눌러 기록해도 돼요' : '컵이나 버튼을 꾹 누르고 있다가 손을 떼요'}</div>`;
    const b = $('#yc-roll'); if (b) b.addEventListener('pointerdown', ev => { ev.preventDefault(); this.startShake(); });
  },

  /* ─────────── 내 굴림: 꾹 누르면 흔들고 · 떼면 탁 ─────────── */
  canRoll() { const v = this.v; return this.mine() && !this.busy && !this.shaking && v.rolls < 3 && !v.held.every(Boolean); },
  startShake() {
    if (!this.canRoll()) { if (this.mine() && this.v.held.every(Boolean) && this.v.rolls < 3) toast('굴릴 주사위가 없어요. KEEP에서 하나 이상 빼 주세요.'); return; }
    this.layout();
    this.sel = null;
    this.shaking = true; this.shakeT0 = performance.now();
    const v = this.v, d = this.d, toCup = [0, 1, 2, 3, 4].filter(i => !(v.rolls && v.held[i]));
    const moving = toCup.filter(i => d.where[i] !== 'cup');
    moving.forEach((i, k) => this.placeDie(i, 'cup', 300, k * 40));
    if (!v.rolls) for (let i = 0; i < 5; i++) d.held[i] = false;
    YA.sfx.collect(moving.length);
    if (YA.music.on && !YA.music.playing) YA.music.start();
    setTimeout(() => { if (this.shaking) { $('#yc-cup').classList.add('shake'); YA.sfx.shakeStart(); } }, 160);
    this.vibT = setInterval(() => { if (navigator.vibrate) navigator.vibrate(12); }, 160);
    this.paintBar(); this.table();
  },
  endShake() {
    if (!this.shaking || this.throwing) return;
    const held = performance.now() - this.shakeT0, minMs = 650;                // 살짝 눌렀다 떼도 조금은 흔들어요
    this.throwing = true;
    setTimeout(() => {
      this.throwing = false;
      if (!this.shaking) return;
      this.myRoll = true;
      this.ctx.send({ t: 'roll' });
      // 멀티: 서버 답이 올 때까지 살살 흔들어요 (답이 오면 playRoll 이 이어받아요) · 굴릴 수 없었으면(싱글은 바로 알아요) 원래대로
      const undo = () => { if (this.shaking && this.myRoll) { this.myRoll = false; this.stopShake(); this.paintBar(); this.placeAll(); } };
      this.rollWatch = setTimeout(undo, this.ctx.mode === 'solo' ? 60 : 4000);
    }, Math.max(0, minMs - held));
  },
  stopShake(silent) {
    clearInterval(this.vibT); clearTimeout(this.rollWatch);
    this.shaking = false; this.throwing = false;
    const cup = $('#yc-cup'); if (cup) cup.classList.remove('shake');
    YA.sfx.shakeStop();
    if (!silent && navigator.vibrate) navigator.vibrate(0);
  },

  /* ─────────── 장면: 굴림 ─────────── */
  async playRoll(e) {
    const P = YC.PACE, d = this.d, me = e.id === this.ctx.me, own = me && this.myRoll;
    this.layout();
    this.paintWho(e.id);
    const rolled = [0, 1, 2, 3, 4].filter(i => !e.held[i]);
    this.table();                                                              // 장면 동안엔 미리 보기 숫자를 숨겨요 (지난 굴림 숫자가 남지 않게)
    if (!own) {
      // ① 남길 주사위는 KEEP 으로, 나머지는 컵으로
      this.stopShake(true);
      for (let i = 0; i < 5; i++) if (e.held[i] && d.where[i] !== 'keep') this.placeDie(i, 'keep', 320);
      const into = rolled.filter(i => d.where[i] !== 'cup');
      into.forEach((i, k) => this.placeDie(i, 'cup', 300, k * 45));
      if (into.length) YA.sfx.collect(into.length);
      if (!await this.wait(P.collect)) return;
      // ② 흔들기
      $('#yc-cup').classList.add('shake'); YA.sfx.shakeStart();
      if (!await this.wait(P.shake)) return YA.sfx.shakeStop();
    }
    this.myRoll = false;
    this.stopShake(true);
    // ③ 탁! 가운데에 엎어요
    this.placeCup('down', 260);
    if (!await this.wait(250)) return;
    YA.sfx.slam(); if (navigator.vibrate && me) navigator.vibrate(35);
    const tray = $('#yc-tray'); tray.classList.remove('bump'); void tray.offsetWidth; tray.classList.add('bump');
    d.dice = e.dice.slice(); d.held = e.held.slice(); d.rollN = (d.rollN || 0) + 1;
    d.pos = this.scatter((e.n || d.rollN) * 7 + 3);
    rolled.forEach(i => { this.face(i, 1 + Math.floor(Math.random() * 6)); this.placeDie(i, 'under'); this.dice[i].style.opacity = 0; });
    if (!await this.wait(P.slam - 250)) return;
    // ④ 들어 올리면 주사위가 굴러 나와요
    this.placeCup('lift', 240);
    rolled.forEach((i, k) => {
      this.dice[i].style.opacity = 1;
      this.placeDie(i, 'felt', 520, 60 + k * 50);
      this.dice[i].classList.add('tumble');
      let n = 0;
      const flick = () => { if (++n < 5) { this.face(i, 1 + Math.floor(Math.random() * 6)); setTimeout(flick, 85); } else { this.face(i, d.dice[i]); this.dice[i].classList.remove('tumble'); } };
      setTimeout(flick, 60 + k * 50);
    });
    YA.sfx.reveal(rolled.length);
    setTimeout(() => this.placeCup('home', 420), 300);
    if (!await this.wait(P.reveal)) return;
    rolled.forEach(i => this.face(i, d.dice[i]));
    if (!await this.wait(P.settle)) return;
    // ⑤ 족보가 나오면 축하 (요트는 언제나, 나머지는 아직 빈칸일 때만)
    const cb = YC.combo(d.dice), open = cb && (cb === 'yacht' || (d.score[e.id] || {})[cb] == null);
    if (open) { this.banner(YC_COMBO[cb], cb); YA.sfx.combo(cb); }
    if (me) this.paintBar();
  },
  /* ─────────── 장면: 점수 기록 ─────────── */
  async playScore(e) {
    const P = YC.PACE, d = this.d;
    (d.score[e.id] = d.score[e.id] || {})[e.cat] = e.pts;
    this.sel = null;
    this.table(e);
    const cell = $(`#yc-table td[data-p="${CSS.escape(String(e.id))}"][data-cat="${e.cat}"]`);
    if (cell) this.float(cell, e.pts ? `+${e.pts}` : '0', e.pts ? 'up' : 'zero');
    YA.sfx.score(e.pts);
    let ms = P.score;
    if (e.cat === 'yacht' && e.pts) { this.banner('YACHT! +50', 'yacht', true); YA.sfx.combo('yacht'); ms += P.yacht; }
    if (e.bonus) { setTimeout(() => { this.banner('보너스 +35!', 'bonus'); YA.sfx.bonus(); }, e.cat === 'yacht' && e.pts ? P.yacht : 350); ms += P.bonus; }
    await this.wait(ms);
  },
  banner(text, kind, confetti) {
    const pop = $('#yc-pop');
    pop.className = `yc-pop ${kind || ''}`;
    pop.innerHTML = `<div class="yc-ban">${text}</div>${confetti || kind === 'yacht' ? `<div class="yc-confetti">${Array.from({ length: 26 }, (_, k) => `<i style="--x:${Math.round(Math.random() * 100)}%;--d:${(Math.random() * 0.5).toFixed(2)}s;--h:${Math.round(Math.random() * 360)};--r:${Math.round(Math.random() * 720 - 360)}deg"></i>`).join('')}</div>` : ''}`;
    clearTimeout(this.popT);
    this.popT = setTimeout(() => { pop.classList.add('hidden'); pop.innerHTML = ''; }, kind === 'yacht' ? 1900 : 1200);
  },
  float(el, text, cls) {
    const r = el.getBoundingClientRect(); if (!r.width || document.hidden) return;
    const f = document.createElement('div');
    f.className = `yc-float ${cls}`; f.textContent = text;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
    document.body.append(f); setTimeout(() => f.remove(), 1300);
  },

  /* ─────────── 점수표 ─────────── */
  table(flash) {
    const v = this.v, ctx = this.ctx, d = this.d, C = YC.CATS;
    const mine = this.mine(), live = !this.busy && !this.shaking;
    const pv = mine && live && v.preview ? v.preview : null;
    let best = null;
    if (pv) for (const k in pv) if (best == null || pv[k] > pv[best]) best = k;
    const sc = id => (d && d.score[id]) || {};
    const up = s => YC.UPPER.reduce((a, k) => a + (s[k] || 0), 0);
    const head = `<tr><th>족보</th>${v.players.map(p => `<th class="${p.id === v.turnId && !v.over ? 'turn' : ''}">${esc(p.name)}${p.id === ctx.me ? '<small>나</small>' : ''}</th>`).join('')}</tr>`;
    const row = ([k, name, desc]) => `<tr class="${k === 'n6' ? 'sep' : ''}"><td title="${desc}"><b>${name}</b><small>${desc}</small></td>${v.players.map(p => {
      const val = sc(p.id)[k], fl = flash && flash.id === p.id && flash.cat === k ? ' flash' : '';
      const attr = `data-p="${esc(p.id)}" data-cat="${k}"`;
      if (val != null) return `<td class="done ${val === 0 ? 'zero' : ''}${fl}" ${attr}>${val}</td>`;
      if (pv && p.id === ctx.me) return `<td class="pick ${k === best ? 'best' : ''} ${pv[k] === 0 ? 'zero' : ''} ${this.sel === k ? 'sel' : ''}" data-act="ycScore" ${attr}>${pv[k]}</td>`;
      if (p.id === v.turnId && v.preview && live && p.id !== ctx.me) return `<td class="peek" ${attr}>${v.preview[k]}</td>`;
      return `<td ${attr}></td>`;
    }).join('')}</tr>`;
    const upper = C.slice(0, 6).map(row).join(''), lower = C.slice(6).map(row).join('');
    const bonus = `<tr class="sub"><td><b>보너스</b><small>위쪽 합 63점 이상이면 +35</small></td>${v.players.map(p => { const u = up(sc(p.id)); return `<td class="${u >= 63 ? 'ok' : ''}">${u >= 63 ? '+35' : `${u}<small>/63</small>`}</td>`; }).join('')}</tr>`;
    const total = `<tr class="total"><td><b>총점</b></td>${v.players.map(p => `<td>${YC.total(sc(p.id))}</td>`).join('')}</tr>`;
    // 위쪽 · 아래쪽 두 묶음: 큰 화면에선 한 표, 낮은 화면에선 나란히 두 칸 (두 번째 머리줄은 그때만 보여요 — yacht.css)
    $('#yc-table').innerHTML = `<tbody class="yc-up">${head}${upper}${bonus}</tbody><tbody class="yc-lo">${head.replace('<tr>', '<tr class="yc-head2">')}${lower}${total}</tbody>`;
  },
  paintBgm() { const b = $('#yc-bgm'); if (b) { const on = YA.music.on; b.classList.toggle('off', !on); b.title = on ? '배경음악 끄기' : '배경음악 켜기'; } },
};

/* 꾹 누르기: 컵을 눌러도 흔들어요 · 손을 떼는 곳은 어디든 */
$('#yc-cup').addEventListener('pointerdown', e => { if (Yacht.canRoll()) { e.preventDefault(); Yacht.startShake(); } });
window.addEventListener('pointerup', () => { if (Yacht.shaking) Yacht.endShake(); });
window.addEventListener('pointercancel', () => { if (Yacht.shaking) Yacht.endShake(); });
window.addEventListener('blur', () => { if (Yacht.shaking) Yacht.endShake(); });
window.addEventListener('keyup', e => { if ((e.code === 'Space' || e.code === 'Enter') && Yacht.shaking && isScreen('yacht')) Yacht.endShake(); });
const ycRelayout = () => { if (!isScreen('yacht') || !Yacht.d) return; if (Yacht.busy || Yacht.shaking) Yacht.needPlace = true; else Yacht.placeAll(); };
window.addEventListener('resize', () => requestAnimationFrame(ycRelayout));
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(ycRelayout).observe($('#yc-tray'));
// 멀티는 화면을 누르기 전엔 소리를 못 내요 → 처음 누를 때 배경음악 시작
document.addEventListener('pointerdown', () => { if (isScreen('yacht') && YA.music.on && !YA.music.playing) setTimeout(() => YA.music.start(), 60); }, true);

Object.assign(ACT, {
  ycHold: el => {
    const v = Yacht.v, c = Yacht.ctx, i = +el.dataset.i;
    if (!v || !c || !Yacht.mine() || Yacht.busy || Yacht.shaking || !v.rolls || v.rolls >= 3) return;
    const d = Yacht.d; if (d.where[i] !== 'keep' && d.where[i] !== 'felt') return;
    const keep = d.where[i] !== 'keep';
    Yacht.layout(); Yacht.placeDie(i, keep ? 'keep' : 'felt', 260); d.held[i] = keep;
    if (keep) YA.sfx.keep(); else YA.sfx.unkeep();
    Yacht.sel = null;
    c.send({ t: 'hold', i });
  },
  ycScore: el => {
    const v = Yacht.v, c = Yacht.ctx; if (!c || !Yacht.mine() || Yacht.busy || Yacht.shaking) return;
    const cat = el.dataset.cat;
    if (Yacht.sel === cat) return ACT.ycConfirm();
    Yacht.sel = cat; YA.sfx.select(); Yacht.table(); Yacht.paintBar();
  },
  ycConfirm: () => { const c = Yacht.ctx, cat = Yacht.sel; if (!c || !cat || !Yacht.mine() || Yacht.busy) return; Yacht.sel = null; c.send({ t: 'score', cat }); },
  ycCancel: () => { Yacht.sel = null; Yacht.table(); Yacht.paintBar(); },
  ycBgm: () => { YA.music.on = !YA.music.on; Yacht.paintBgm(); toast(YA.music.on ? '🎵 배경음악을 켰어요.' : '🔇 배경음악을 껐어요.'); },
  ycSolo: el => {
    Yacht.bots = +el.dataset.bots;
    Table.solo('yacht', { bots: Yacht.bots });
    $$('#yc-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === Yacht.bots));
  },
});
Table.def('yacht', {
  core: YachtCore, render: (v, ctx, prev) => Yacht.render(v, ctx, prev), solo: { bots: 1 },
  key: (e, ctx) => {
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
      e.preventDefault();
      if (Yacht.sel) return ACT.ycConfirm();
      return Yacht.startShake();
    }
    if (e.code === 'Escape' && Yacht.sel) return ACT.ycCancel();
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code];
    if (n != null && !e.repeat) ACT.ycHold(Yacht.dice[n]);
  },
});
