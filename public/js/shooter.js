/* =====================================================================
 *  🚀 우주 슈팅 (v14.1 다시 만듦) — 화면 · 조작 · 효과. 규칙은 js/shared/shooter-core.js (SCore), 그림 js/shooter-art.js (매끈한 그림), 소리 js/shooter-audio.js
 *  · 시작 화면: 난이도(쉬움 · 보통 · 어려움 — 순위도 따로) · 출발 스테이지(가 본 곳까지 · 2스테이지부터는 연습) · 스테이지마다 별 3개
 *  · 조작: 휴대폰 = 화면 어디든 끌기(손가락이 움직인 만큼 비행기가 움직여요 · 손가락이 비행기를 가리지 않아요)
 *          PC = 마우스(판 위) · 방향키 / W A S D, Shift 를 누르면 천천히 · 폭탄 = X · B · 스페이스 · 💣 버튼 · 두 번째 손가락 탭
 *  · 효과는 차분하게: 작은 폭발 · 맞으면 살짝 하얗게 · 큰 폭발만 화면이 조금 흔들려요 (느린 화면 · 멈칫 · 번쩍임 · 점수 숫자 날림은 없어요)
 *  · 가볍게: 그림은 처음에 한 번 그려 두고 붙이기만 · 캔버스는 화소 밀도 2배까지 · 효과 개수에 상한
 * ===================================================================== */
const SHW = 240;
let SHH = 320;                                                       // 판 세로: 판마다 화면 비율에 맞춰 320 ~ 440 (Shooter.pickH)
makeScreen('shooter', {
  title: '🚀 우주 슈팅',
  status: TOUCH ? '화면 어디든 끌어서 움직여요 · 총은 자동 · 위급할 땐 💣 (두 번째 손가락 탭도 돼요)' : '마우스 · 방향키로 움직여요 (Shift 천천히) · 총은 자동 · 폭탄 X · B · 스페이스',
  stats: [['score', '점수'], ['stage', '스테이지'], ['best', '최고 점수']],
  body: `<div class="sh-wrap center col"><canvas id="sh-cv" class="game-cv" width="480" height="640" aria-label="우주 슈팅 화면"></canvas>
    <div class="sh-bar">
      <button class="btn ghost sh-bgm" id="sh-bgm" data-act="shBgm" aria-label="배경 음악 켜기 · 끄기">🎵</button>
      <span class="sh-hint" id="sh-hint">${TOUCH ? '손가락은 비행기 아래 어디든 · 끄는 만큼 움직여요' : 'Shift: 천천히 · 좁은 틈을 빠져나가요'}</span>
      <button class="btn sh-bomb" id="sh-bomb" aria-label="폭탄 쓰기">💣 폭탄 <b id="sh-bombs">3</b></button>
    </div>
    <div class="sh-menu hidden" id="sh-menu" role="dialog" aria-label="우주 슈팅 시작"></div></div>`,
});

const SH_DIFF_DESC = ['탄이 느리고 목숨 4개 · 처음이라면', '오락실 그대로 · 보통 실력', '탄이 빠르고 많아요 · 실력자'];
const SH_BOSS_GFX = { '스팅어': 'stinger', '오브 십': 'orb', '강철 게': 'crab', '바위 요새': 'fortress', '방어 코어': 'guard', '붉은 포격함': 'bomber', '모선 코어': 'mother' };
const SH_PART_GFX = { clawL: 'clawL', clawR: 'clawR', emL: 'emitter', emR: 'emitter', gunL: 'wingGun', gunR: 'wingGun', podL: 'pod', podR: 'pod', pod0: 'pod', pod1: 'pod', pod2: 'pod', pod3: 'pod', gun0: 'turret', gun1: 'turret', gun2: 'turret', gun3: 'turret' };
const SH_PURPLE = { mother: 1, stinger: 1 };
const shFmt = n => Math.round(n).toLocaleString('ko-KR');
const SH_FONT = '"Noto Sans KR", system-ui, sans-serif';

const Shooter = {
  g: null, over: true, K: 2, mode: 'menu', diff: 1, from: 1,
  start() {
    stopLocal();
    S.solo = 'shooter';
    show('shooter');
    SHH = this.pickH();
    this.cv = $('#sh-cv'); this.ctx = this.cv.getContext('2d');
    this.cv.width = 480; this.cv.height = Math.round(480 * SHH / SHW);   // 화면 맞춤이 비율을 먼저 알게
    this.prog = this.loadProg();
    this.diff = clamp(+store.get('sh-diff', 1) || 0, 0, 2);
    this.from = 1;
    Object.assign(this, {
      over: false, ended: false, g: null, mode: 'menu', acc: 0, T: 0, sx: 0, sy: 0, shake: 0, white: 0,
      fx: { boom: [], deb: [], spark: [], ring: [], ghost: [] }, toasts: [], banner: null, tally: null,
      drag: null, mouse: null, bombQ: false, snd: {}, contT: 0, fitT: 0,
      theme: 0, themeOld: -1, themeFade: 0, stars: this.makeStars(), bgY: 0,
    });
    this.fitK(true);
    this.menu(true);
    setTimeout(() => { if (!this.over) { this.layout(); this.fitK(false); } }, 250);
    this.paintBgm();
    this.hud(true);
    gameLoop(dt => this.frame(dt));
  },
  /** 시작 화면에서 「시작」 */
  begin() {
    if (this.over || this.mode !== 'menu') return;
    store.set('sh-diff', this.diff);
    this.g = SCore.create((Math.random() * 4294967296) >>> 0, { H: SHH, diff: this.diff, stage: this.from });
    Object.assign(this, { mode: 'play', acc: 0, contT: 0, ended: false, toasts: [], banner: null, tally: null, shake: 0, white: 0,
      fx: { boom: [], deb: [], spark: [], ring: [], ghost: [] }, best: +store.get(this.bestKey(), 0) || 0, drag: null, bombQ: false });
    this.theme = (this.g.stage - 1) % 5; this.themeOld = -1;
    this.menu(false);
    this.events();
    this.hud(true);
    if (typeof ShAudio !== 'undefined') ShAudio.music.play('stage');
  },
  /** 길쭉한 휴대폰 화면이면 판을 세로로 길게 (가로 240 은 그대로 · 노트북 · 태블릿 · 펼친 폴드는 320) */
  pickH() {
    const sec = $('#scr-shooter'), head = sec && sec.querySelector('.game-head'), bar = sec && sec.querySelector('.sh-bar');
    if (!sec || !head) return 320;
    const top = head.getBoundingClientRect().bottom, w = Math.min(sec.clientWidth, window.innerWidth - 16);
    const h = window.innerHeight - top - (bar ? bar.offsetHeight : 50) - 30;
    return Math.round(Math.max(320, Math.min(440, (240 * h) / Math.max(1, w))));
  },
  /** 캔버스 해상도: 보이는 크기 × 화소 밀도(2배까지) — 바뀌면 그림을 그 크기로 다시 그려 둬요 */
  fitK(force) {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.max(1, ((r.width || 360) * dpr) / SHW);
    if (!force && this.A && Math.abs(k - this.K) / this.K < 0.06) return;
    this.K = k;
    this.cv.width = Math.round(SHW * k); this.cv.height = Math.round(SHH * k);
    this.ctx = this.cv.getContext('2d');
    this.A = ShArt.build(k);
  },
  /** 아래 줄(🎵 · 안내 · 💣): 판 옆에 자리가 넉넉하면 판 오른쪽에 세로로 → 판이 더 커져요 */
  layout() {
    const wrap = $('#scr-shooter .sh-wrap'), bar = wrap && wrap.querySelector('.sh-bar');
    if (!wrap || !bar) return;
    const w = Math.round(this.cv.getBoundingClientRect().width), free = wrap.clientWidth - w, side = wrap.classList.contains('sh-side');
    if (!side && free > 190) wrap.classList.add('sh-side');
    else if (side && free < 110) wrap.classList.remove('sh-side');
    const want = wrap.classList.contains('sh-side') ? '' : w > 100 ? w + 'px' : '';
    if (bar.style.width !== want) bar.style.width = want;
  },
  makeStars() {
    const R = SCore.rng(7), L = [];
    for (const [n, sp, sz, a] of [[26, 7, 0.65, 0.35], [20, 16, 0.9, 0.55], [12, 34, 1.15, 0.8]]) for (let i = 0; i < n; i++) L.push({ x: R() * SHW, y: R() * 460, sp, sz, a: a * (0.7 + R() * 0.3) });
    return L;
  },

  /* ───── 기록 · 별 · 가 본 스테이지 (이 기기) ───── */
  dkey(d = this.diff) { return SCore.DIFF[d].key; },
  bestKey(d = this.diff) { return d === 1 ? 'best-shooter' : `best-shooter-${this.dkey(d)}`; },
  loadProg() {
    let p = null;
    try { p = JSON.parse(store.get('sh-prog', '') || 'null'); } catch { p = null; }
    const out = {};
    for (const d of SCore.DIFF) { const o = p && p[d.key]; out[d.key] = { reach: clamp(+(o && o.reach) || 1, 1, 5), stars: [0, 1, 2, 3, 4].map(i => (o && Array.isArray(o.stars) ? (+o.stars[i] || 0) & 7 : 0)) }; }
    return out;
  },
  saveProg() { try { store.set('sh-prog', JSON.stringify(this.prog)); } catch { /* 무시 */ } },
  starCount(bits) { return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1); },

  /* ───── 시작 화면 ───── */
  menu(on) {
    const m = $('#sh-menu'), sec = $('#scr-shooter'); if (!m || !sec) return;
    if (m.parentElement !== sec) sec.append(m);                      // 판 너비가 아니라 게임 화면 너비 전체를 쓰게 (가로 화면에서 두 줄로)
    m.classList.toggle('hidden', !on);
    if (!on) return;
    this.menuTop();
    const P = this.prog[this.dkey()], best = +store.get(this.bestKey(), 0) || 0;
    if (this.from > P.reach) this.from = 1;
    let total = 0;
    for (const k in this.prog) for (const b of this.prog[k].stars) total += this.starCount(b);
    const star = on => `<i class="${on ? 'on' : ''}">★</i>`;
    m.innerHTML = `<div class="shm-card">
      <div class="shm-title">🚀 우주 슈팅</div>
      <div class="shm-sec d"><small>난이도</small><div class="shm-seg">${SCore.DIFF.map((d, i) => `<button class="shm-opt ${i === this.diff ? 'on' : ''}" data-act="shDiff" data-v="${i}">${d.name}</button>`).join('')}</div>
        <p class="shm-note">${SH_DIFF_DESC[this.diff]} · 최고 ${best ? shFmt(best) + '점' : '기록 없음'}</p></div>
      <div class="shm-sec s"><small>출발 스테이지</small><div class="shm-stages">${[1, 2, 3, 4, 5].map(n => {
        const open = n <= P.reach, b = P.stars[n - 1];
        return `<button class="shm-st ${n === this.from ? 'on' : ''} ${open ? '' : 'lock'}" data-act="shFrom" data-v="${n}" ${open ? '' : 'disabled aria-disabled="true"'} aria-label="${n}스테이지${open ? '' : ' (잠김)'}"><b>${open ? n : '🔒'}</b><span class="shm-stars">${star(b & 1)}${star(b & 2)}${star(b & 4)}</span></button>`;
      }).join('')}</div>
        <p class="shm-note">${this.from > 1 ? `연습: 파워를 채워서 ${this.from}스테이지부터 · 순위에는 안 올라가요` : '1스테이지부터 하면 순위에 올라가요 · 가 본 스테이지는 연습할 수 있어요'}</p></div>
      <button class="btn good shm-go" data-act="shGo">▶ 시작</button>
      <p class="shm-total">★ ${total} / 45 &nbsp;·&nbsp; 별: 클리어 · 노 미스 · 격추율 85%</p></div>`;
  },

  /** 시작 화면은 판이 있는 줄부터 아래를 덮어요 (위쪽 제목 · 나가기 버튼은 그대로) */
  menuTop() {
    const m = $('#sh-menu'), wrap = $('#scr-shooter .sh-wrap');
    if (m && wrap) m.style.setProperty('--shm-top', wrap.offsetTop + 'px');
  },
  /* ───── 매 화면 ───── */
  frame(dt) {
    dt = Math.max(0, Math.min(0.05, dt || 0));                       // 첫 화면은 시각이 살짝 거꾸로일 수 있어요
    this.T += dt;
    if ((this.fitT += dt) > 0.6) {
      this.fitT = 0; this.fitK(false); this.layout(); if (this.mode === 'menu') this.menuTop();
      const M = typeof ShAudio !== 'undefined' && ShAudio.music;   // 소리를 늦게 켰거나 다시 돌아왔을 때 음악 이어 틀기
      if (this.mode === 'play' && M && M.want && !M.playing && M.on && !this.over) M.play(M.want);
    }
    const g = this.g;
    if (this.mode === 'play' && g) {
      const freeze = g.phase === 'over' && g.phaseT > 1.7;
      if (!freeze && !this.ended) {
        this.acc = Math.min(this.acc + dt, SCore.STEP * 4);
        while (this.acc >= SCore.STEP) {
          this.acc -= SCore.STEP;
          SCore.step(g, this.input());
          this.bombQ = false;
          this.events();
        }
      }
      if (g.phase === 'over') this.overTick(dt);
    }
    this.tick(dt);
    this.hud();
    this.draw();
  },
  input() {
    const g = this.g, p = g.p, inp = { focus: held('ShiftLeft', 'ShiftRight'), bomb: this.bombQ };
    const kx = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0), ky = (held('ArrowDown', 'KeyS') ? 1 : 0) - (held('ArrowUp', 'KeyW') ? 1 : 0);
    if (kx || ky) { inp.kx = kx; inp.ky = ky; this.mouse = null; return inp; }
    if (this.drag) { inp.tx = this.drag.tx; inp.ty = this.drag.ty; inp.fast = true; }
    else if (this.mouse) { inp.tx = this.mouse.x; inp.ty = this.mouse.y - 6; }
    if (this.drag && (!p.alive || p.enter > 0)) { const d = this.drag; d.sx = d.tx = p.x; d.sy = d.ty = p.y; d.fx = d.cx; d.fy = d.cy; }   // 다시 나오는 동안은 기준점을 지금 손가락 · 비행기 자리로
    return inp;
  },
  bomb() { if (!this.over && this.mode === 'play' && this.g && this.g.p.bombs > 0) this.bombQ = true; },
  /** 소리: 같은 소리가 너무 촘촘하면 건너뛰어요 */
  sfx(name, gap, ...a) {
    const A = typeof ShAudio !== 'undefined' ? ShAudio.sfx : null;
    if (!A || !A[name]) return;
    if (gap && this.T - (this.snd[name] || -9) < gap) return;
    this.snd[name] = this.T; A[name](...a);
  },

  /* ───── 사건 → 효과 · 소리 (차분하게) ───── */
  events() {
    const g = this.g, M = typeof ShAudio !== 'undefined' ? ShAudio.music : null;
    for (const e of g.ev) {
      switch (e.k) {
        case 'shot': this.sfx('shot', 0.085, e.w); break;
        case 'hit': this.spark(e.x, e.y); this.sfx('hit', 0.06, e.big); break;
        case 'clink': this.spark(e.x, e.y, true); this.sfx('clink', 0.1); break;
        case 'mhit': this.boom(e.x, e.y, 5, 0.2); break;
        case 'kill': this.killFx(e); this.sfx('kill', 0.04, e.sz); break;
        case 'partKill': this.boom(e.x, e.y, 18, 0.45); this.debris(e.x, e.y, 6); this.ring(e.x, e.y, 30, '#ffd9a0', 0.4); this.shake = Math.max(this.shake, 1.5); this.say(`부위 파괴 +${shFmt(e.pts)}`, '#ffd23f'); this.sfx('boom', 0, true); break;
        case 'bossDie': this.boom(e.x, e.y, 22, 0.5); this.shake = Math.max(this.shake, 2); this.sfx('bossDie'); if (!e.mid && M) M.stop(1.2); break;
        case 'bossBoom': this.boom(e.x, e.y, 13 + (e.n % 3) * 4, 0.45); if (e.n % 2) this.debris(e.x, e.y, 2); this.sfx('kill', 0.12, 2); break;
        case 'bossEnd': case 'midEnd': {
          const big = e.k === 'bossEnd';
          this.boom(e.x, e.y, big ? 44 : 32, 0.65); this.boom(e.x - 14, e.y + 8, big ? 22 : 16, 0.5, 0.12); this.boom(e.x + 16, e.y - 6, big ? 22 : 16, 0.5, 0.2);
          this.ring(e.x, e.y, big ? 90 : 60, '#ffffff', 0.55); this.debris(e.x, e.y, big ? 12 : 8);
          this.shake = Math.max(this.shake, big ? 3 : 2);
          this.sfx('bossEnd', 0, big);
          if (big) this.banner = null;
          break;
        }
        case 'escape': this.say('보스가 도망쳤어요 (보스 점수 없음)', '#9aa6c7', 2.2); if (!e.mid && M) M.stop(1); break;
        case 'warn': this.banner = { kind: 'warn', t: 0, life: 3.2, name: e.name }; this.sfx('warn'); if (M) M.stop(0.6); break;
        case 'bossIn': if (M) M.play('boss'); break;
        case 'midIn': this.say(`중간 보스 「${e.name}」`, '#ff9aa6', 1.8); this.sfx('mid'); break;
        case 'stage':
          this.banner = { kind: 'stage', t: 0, life: 2.6, n: e.n, loop: e.loop, name: e.name };
          if (this.theme !== (e.n - 1) % 5) { this.themeOld = this.theme; this.theme = (e.n - 1) % 5; this.themeFade = 1; }
          this.tally = null;
          this.reached(e.n, e.loop);
          if (g.t > 1) { if (M) M.play('stage'); this.sfx('stage'); }
          break;
        case 'clear': this.tally = { t: 0, rows: e.bonus, total: e.total, all: e.all, stars: e.stars, rate: e.rate, sound: 0 }; this.gotStars(e.stage, e.stars); this.sfx('clear', 0, e.all); break;
        case 'pick': this.say(e.txt, (SCore.ITEMS[e.item] || {}).color || '#fff', 1.1); this.ring(g.p.x, g.p.y, 14, '#ffffff', 0.25); this.sfx('pick', 0, e.item); break;
        case 'formation': this.say(`편대 보너스 +${shFmt(e.pts)}`, '#7dffb0'); this.sfx('formation', 0.2); break;
        case 'bomb': this.bombFx(e.x, e.y); this.sfx('bomb'); break;
        case 'cancel': for (const b of e.list) if (this.fx.ghost.length < 200) this.fx.ghost.push({ x: b[0], y: b[1], k: b[2], t: 0 }); break;
        case 'die':
          this.boom(e.x, e.y, 22, 0.55); this.ring(e.x, e.y, 36, '#9df4ff', 0.45); this.debris(e.x, e.y, 8);
          this.shake = Math.max(this.shake, 2.5);
          this.sfx('die');
          if (navigator.vibrate) try { navigator.vibrate(90); } catch { /* 무시 */ }
          break;
        case 'respawn': this.sfx('respawn'); break;
        case 'extend': this.say('1UP! 목숨 +1', '#7dffb0', 1.8); this.sfx('extend'); break;
        case 'eshot': this.sfx('eshot', 0.12); break;
        case 'laserWarn': this.sfx('laserWarn'); break;
        case 'laserOn': this.sfx('laserOn'); break;
        case 'split': this.spark(e.x, e.y); this.sfx('split', 0.1); break;
        case 'dash': this.sfx('dash', 0.15); break;
        case 'phase': this.ring(e.x, e.y, 40, '#ffd9a0', 0.4); this.shake = Math.max(this.shake, 1); this.sfx('phase'); break;
        case 'over': this.contT = 0; if (M) M.stop(1.5); this.sfx('over'); break;
        case 'cont': this.contT = 0; this.say('이어서 해요 · 점수는 0부터', '#7dffb0', 1.8); if (M) M.play(g.boss && !g.boss.mid ? 'boss' : 'stage'); break;
      }
    }
    g.ev.length = 0;
  },
  killFx(e) {
    const { x, y } = e;
    if (e.sz === 1) this.boom(x, y, 8, 0.3);
    else if (e.sz === 2) { this.boom(x, y, 14, 0.42); this.debris(x, y, 4); }
    else { this.boom(x, y, 22, 0.5); this.boom(x - 9, y + 6, 11, 0.4, 0.1); this.boom(x + 9, y - 5, 11, 0.4, 0.18); this.debris(x, y, 7); this.ring(x, y, 34, '#ffd9a0', 0.4); this.shake = Math.max(this.shake, 1.2); }
  },
  bombFx(x, y) {
    this.white = 0.22; this.shake = Math.max(this.shake, 2);
    this.ring(x, y, 230, '#ffffff', 0.8); this.ring(x, y, 160, '#9fd3ff', 0.7);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; this.boom(x + Math.cos(a) * 60, y - 50 + Math.sin(a) * 40, 16, 0.45, 0.06 + i * 0.07); }
  },
  /* 효과 만들기 (개수에 상한 — 많이 터져도 가볍게) */
  boom(x, y, r, life, delay = 0) { const L = this.fx.boom; if (L.length >= 40) L.shift(); L.push({ x, y, r, life, t: -delay }); },
  debris(x, y, n) { const L = this.fx.deb; for (let i = 0; i < n; i++) { if (L.length >= 70) L.shift(); const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 90; L.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, a: Math.random() * 6, va: (Math.random() - 0.5) * 12, t: 0, life: 0.5 + Math.random() * 0.35, i: i % 3 }); } },
  spark(x, y, grey) { const L = this.fx.spark; if (L.length >= 24) L.shift(); L.push({ x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4, t: 0, grey }); },
  ring(x, y, r, col, life) { const L = this.fx.ring; if (L.length >= 8) L.shift(); L.push({ x, y, r, col, life, t: 0 }); },
  say(txt, col, life = 1.3) { const L = this.toasts; if (L.length >= 3) L.shift(); L.push({ txt: String(txt), col, t: 0, life }); },

  tick(dt) {
    const F = this.fx;
    this.shake = Math.max(0, this.shake - dt * 10); this.white = Math.max(0, this.white - dt * 0.6);
    this.themeFade = Math.max(0, this.themeFade - dt * 0.6);
    for (const b of F.boom) b.t += dt;
    for (const q of F.deb) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 90 * dt; q.vx *= 0.98; q.a += q.va * dt; }
    for (const s of F.spark) s.t += dt;
    for (const r of F.ring) r.t += dt;
    for (const q of F.ghost) q.t += dt;
    for (const t of this.toasts) t.t += dt;
    const keep = (L, f) => { let j = 0; for (let i = 0; i < L.length; i++) if (f(L[i])) L[j++] = L[i]; L.length = j; };
    keep(F.boom, b => b.t < b.life); keep(F.deb, q => q.t < q.life); keep(F.spark, s => s.t < 0.14); keep(F.ring, r => r.t < r.life); keep(F.ghost, q => q.t < 0.25);
    keep(this.toasts, t => t.t < t.life);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.tally) {
      const T = this.tally; T.t += dt;
      const shown = T.stars.filter((s, i) => s && T.t > 1.6 + i * 0.35).length;
      while (T.sound < shown) { this.sfx('star', 0, T.sound); T.sound++; }
    }
    const sp = this.g && this.g.phase === 'clear' ? 2.4 : 1;
    for (const s of this.stars) { s.y += s.sp * dt * sp; if (s.y > SHH + 4) { s.y -= SHH + 8; s.x = Math.random() * SHW; } }
  },

  /* ───── 가 본 스테이지 · 별 ───── */
  reached(n, loop) {
    if (!this.g) return;
    const P = this.prog[this.dkey()], r = loop ? 5 : n;
    if (r > P.reach) { P.reach = r; this.saveProg(); }
  },
  gotStars(stage, stars) {
    const P = this.prog[this.dkey()], i = stage - 1, b = (stars[0] ? 1 : 0) | (stars[1] ? 2 : 0) | (stars[2] ? 4 : 0);
    if ((P.stars[i] | b) !== P.stars[i]) { P.stars[i] |= b; this.saveProg(); }
  },

  /* ───── 이어하기 · 끝 ───── */
  overTick(dt) {
    const g = this.g;
    if (g.phaseT < 1.7) return;
    this.contT += dt;
    if (this.contT > 10.5) this.finish();
  },
  cont() {
    const g = this.g;
    if (this.over || this.mode !== 'play' || g.phase !== 'over' || this.contT < 0.35) return false;   // CONTINUE? 가 보이고 나서
    this.saveBest();
    SCore.cont(g); this.events();
    this.hud(true);
    return true;
  },
  saveBest() {
    const g = this.g;
    if (g.start === 1 && g.best > this.best) { this.best = g.best; store.set(this.bestKey(), this.best); }
  },
  finish() {
    if (this.ended) return;
    this.ended = true; this.over = true;
    const g = this.g;
    this.saveBest();
    const reach = `${g.loop ? (g.loop + 1) + '주차 ' : ''}${g.stage}스테이지`, d = SCore.DIFF[g.diff];
    let stars = 0;
    for (const b of this.prog[this.dkey(g.diff)].stars) stars += this.starCount(b);
    const practice = g.start > 1;
    after(300, () => showResult({
      title: g.allClear || g.loop ? '🚀 대단해요! 우주를 지켰어요' : '🚀 격추됐어요!',
      subtitle: `${d.name} · 점수 ${shFmt(g.best)}${g.credits > 1 ? ` (이어하기 ${g.credits - 1}번 · 한 번에 낸 최고 점수)` : ''} · ${reach}까지${practice ? ` · ${g.start}스테이지부터 연습 (기록 없음)` : ` · 최고 ${shFmt(this.best)}점`} · ★ ${stars}/15`,
      solo: 'shooter', rec: practice ? null : (g.diff === 1 ? { v: g.best } : { k: d.key, v: g.best }),
    }));
    if (typeof ShAudio !== 'undefined') ShAudio.music.stop(1);
  },

  /* ───── 위쪽 점수 칸 (바뀔 때만) ───── */
  hud(force) {
    const g = this.g;
    const key = g ? `${g.score}|${g.stage}|${g.loop}|${Math.max(this.best || 0, g.best)}|${g.p.bombs}` : `menu|${this.diff}`;
    if (!force && key === this.hudKey) return;
    if (!force && (this.hudT = (this.hudT || 0) + 1) % 4) return;
    this.hudKey = key;
    if (!g) {
      setStat('shooter', 'score', '0'); setStat('shooter', 'stage', '-');
      setStat('shooter', 'best', shFmt(+store.get(this.bestKey(), 0) || 0));
      const b = $('#sh-bombs'); if (b) b.textContent = '3';
      const bb = $('#sh-bomb'); if (bb) bb.classList.remove('empty');
      return;
    }
    setStat('shooter', 'score', shFmt(g.score));
    setStat('shooter', 'stage', (g.loop ? `${g.loop + 1}-` : '') + g.stage);
    setStat('shooter', 'best', shFmt(Math.max(this.best || 0, g.start === 1 ? g.best : 0)));
    const b = $('#sh-bombs'); if (b) b.textContent = g.p.bombs;
    const bb = $('#sh-bomb'); if (bb) bb.classList.toggle('empty', !g.p.bombs);
  },
  paintBgm() { const b = $('#sh-bgm'); if (b && typeof ShAudio !== 'undefined') { b.classList.toggle('off', !ShAudio.music.on); b.title = ShAudio.music.on ? '배경 음악 끄기' : '배경 음악 켜기'; } },

  /* ═════════ 그리기 ═════════ */
  draw() {
    const c = this.ctx, A = this.A, K = this.K;
    this.sx = this.shake ? (Math.random() - 0.5) * this.shake : 0; this.sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    c.setTransform(K, 0, 0, K, this.sx * K, this.sy * K);
    c.imageSmoothingEnabled = true;
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    this.drawBg(c, A);
    const g = this.g;
    if (this.mode === 'play' && g) {
      for (const d of g.decks) this.put(A.deck(d.w), d.x, d.y);
      if (g.boss) this.drawBoss(c, A, g.boss);
      for (const e of g.en) if (e.type !== 'part') this.drawEnemy(c, A, e);
      for (const it of g.items) this.put(A.items[it.k] || A.items.P, it.x, it.y + Math.sin(this.T * 4 + it.ph) * 1.2);
      this.drawShots(c, A, g);
      this.drawPlayer(c, A, g);
      this.drawFx(c, A);
      this.drawBullets(c, A, g);
      this.drawHazards(c, g);
      c.setTransform(K, 0, 0, K, 0, 0);
      this.drawHud(c, A, g);
      this.drawBanner(c, g);
    } else {
      // 시작 화면 뒤: 별만 흐르고 비행기가 기다려요
      this.put(A.flame, SHW / 2 - 2.6, SHH - 50 + 10.5, 1 + Math.sin(this.T * 30) * 0.1);
      this.put(A.flame, SHW / 2 + 2.6, SHH - 50 + 10.5, 1 + Math.sin(this.T * 31) * 0.1);
      this.put(A.ship, SHW / 2, SHH - 50 + Math.sin(this.T * 2) * 1.5);
      c.setTransform(K, 0, 0, K, 0, 0);
    }
    if (this.white > 0) { c.globalAlpha = this.white; c.fillStyle = '#ffffff'; c.fillRect(0, 0, SHW, SHH); c.globalAlpha = 1; }
  },
  /** 그림 붙이기 (가운데 기준) · img: 다른 그림(번쩍 · 어두운) */
  put(s, x, y, sc = 1, img) { this.ctx.drawImage(img || s.c, x - (s.w * sc) / 2, y - (s.h * sc) / 2, s.w * sc, s.h * sc); },
  /** 돌려서 붙이기 (a: 라디안) */
  rot(s, x, y, a, sc = 1, img) {
    const c = this.ctx, K = this.K, co = Math.cos(a) * K, si = Math.sin(a) * K;
    c.setTransform(co, si, -si, co, (x + this.sx) * K, (y + this.sy) * K);
    c.drawImage(img || s.c, (-s.w * sc) / 2, (-s.h * sc) / 2, s.w * sc, s.h * sc);
    c.setTransform(K, 0, 0, K, this.sx * K, this.sy * K);
  },
  /** 맞은 적: 살짝 하얗게 (큰 적은 더 옅게) */
  hitFx(s, x, y, a, big) {
    const c = this.ctx;
    c.globalAlpha = big ? 0.32 : 0.55;
    if (a) this.rot(s, x, y, a, 1, ShArt.flash(s)); else this.put(s, x, y, 1, ShArt.flash(s));
    c.globalAlpha = 1;
  },

  drawBg(c, A) {
    const bgN = A.bg(this.theme, SHH);
    if (this.themeFade > 0 && this.themeOld >= 0) {
      c.drawImage(A.bg(this.themeOld, SHH), 0, 0, SHW, SHH);
      c.globalAlpha = 1 - this.themeFade; c.drawImage(bgN, 0, 0, SHW, SHH); c.globalAlpha = 1;
    } else c.drawImage(bgN, 0, 0, SHW, SHH);
    const st = A.star;
    for (const s of this.stars) { c.globalAlpha = s.a; c.drawImage(st.c, s.x - st.w * s.sz / 2, s.y - st.h * s.sz / 2, st.w * s.sz, st.h * s.sz); }
    c.globalAlpha = 1;
  },
  drawEnemy(c, A, e) {
    const E = A.en, hit = e.hit > 0;
    switch (e.type) {
      case 'pop': this.put(E.pop, e.x, e.y); if (hit) this.hitFx(E.pop, e.x, e.y); break;
      case 'zako': case 'swoop': { const s = E[e.type], a = (e.ang || Math.PI / 2) - Math.PI / 2; this.rot(s, e.x, e.y, a); if (hit) this.hitFx(s, e.x, e.y, a || 1e-6); break; }
      case 'kami': {
        const a = e.dash ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0;
        if (e.warn) {                                             // 돌진 예고: 줄어드는 빨간 고리
          const k = ((this.T * 2.5) % 1);
          c.globalAlpha = 0.75 * (1 - k); c.strokeStyle = '#ff4d6d'; c.lineWidth = 1.2; c.beginPath(); c.arc(e.x, e.y, 16 - k * 8, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
        }
        if (a) this.rot(E.kami, e.x, e.y, a); else this.put(E.kami, e.x, e.y);
        if (hit) this.hitFx(E.kami, e.x, e.y, a);
        break;
      }
      case 'mine': { const s = E.mine[(e.age > 6 ? Math.floor(this.T * 10) : Math.floor(this.T * 2.5)) % 2]; this.put(s, e.x, e.y); if (hit) this.hitFx(s, e.x, e.y); break; }
      case 'rock': case 'pebble': { const s = (e.type === 'rock' ? E.rock : E.pebble)[e.id % 3]; this.rot(s, e.x, e.y, e.ang || 0); if (hit) this.hitFx(s, e.x, e.y, e.ang || 1e-6, e.type === 'rock'); break; }
      case 'gun': case 'carrier': case 'heavy': { const s = E[e.type]; this.put(s, e.x, e.y); if (hit) this.hitFx(s, e.x, e.y, 0, true); break; }
      case 'turret': {
        this.put(E.turretBase, e.x, e.y);
        const p = this.g.p, a = Math.atan2(p.y - e.y, p.x - e.x);
        c.save(); c.translate(e.x, e.y); c.rotate(a);
        c.fillStyle = '#1b2034'; c.beginPath(); c.roundRect ? c.roundRect(1.5, -1.6, 8.5, 3.2, 1.2) : c.rect(1.5, -1.6, 8.5, 3.2); c.fill();
        c.fillStyle = hit ? '#ffffff' : '#8f9bbb'; c.fillRect(2.5, -0.6, 7, 1.2);
        c.restore();
        c.beginPath(); c.arc(e.x, e.y, 2.2, 0, Math.PI * 2); c.fillStyle = hit ? '#ffffff' : '#ff6b78'; c.fill();
        break;
      }
    }
  },
  drawBoss(c, A, b) {
    const key = SH_BOSS_GFX[b.def.name], body = A.boss[key];
    const jx = b.dying > 0 ? (Math.random() - 0.5) * 2 : 0;
    if (body) this.put(body, b.x + jx, b.y);
    for (const p of b.parts) {
      if (p.core) {
        if (p.dead) continue;
        const open = !p.armor, s = open ? (SH_PURPLE[key] ? A.part.coreP : A.part.coreO) : A.part.coreC, sc = p.r / 15;
        if (open) { c.globalAlpha = 0.18 + Math.sin(this.T * 5) * 0.06; c.fillStyle = SH_PURPLE[key] ? '#c58bff' : '#ffb347'; c.beginPath(); c.arc(p.x + jx, p.y, p.r * 1.35, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
        this.put(s, p.x + jx, p.y, sc);
        if (p.hit > 0) { c.globalAlpha = 0.3; this.put(s, p.x + jx, p.y, sc, ShArt.flash(s)); c.globalAlpha = 1; }
        continue;
      }
      const s = A.part[SH_PART_GFX[p.pid]];
      if (!s) continue;
      if (p.dead) { this.put(s, p.x + jx, p.y, 1, ShArt.dark(s)); continue; }
      this.put(s, p.x + jx, p.y);
      if (p.hit > 0) { c.globalAlpha = 0.32; this.put(s, p.x + jx, p.y, 1, ShArt.flash(s)); c.globalAlpha = 1; }
    }
  },
  drawShots(c, A, g) {
    // 레이저: 같은 줄기의 조각을 이어서 빛줄기로 (적에게 막히면 거기서 끝)
    const L = [];
    for (const s of g.shots) if (s.k === 'L') L.push(s);
    if (L.length && g.p.alive) {
      L.sort((a, b) => b.y - a.y);
      let top = g.p.y - 10;
      for (const s of L) { if (top - s.y > 22) break; top = s.y; }
      const w = L[0].r, x = g.p.x, h = g.p.y - 10 - top, fl = 0.85 + Math.sin(this.T * 40) * 0.15;
      if (h > 0) {
        c.globalAlpha = 0.22 * fl; c.fillStyle = '#35d98a'; c.fillRect(x - w - 1.5, top, (w + 1.5) * 2, h);
        c.globalAlpha = 0.7; c.fillStyle = '#9dffc9'; c.fillRect(x - w * 0.6, top, w * 1.2, h);
        c.globalAlpha = 0.9; c.fillStyle = '#ffffff'; c.fillRect(x - w * 0.22, top, w * 0.44, h); c.globalAlpha = 1;
        if (top > 4) { c.globalAlpha = 0.6 * fl; c.drawImage(A.fx.spark.c, x - 4, top - 4, 8, 8); c.globalAlpha = 1; }   // 막힌 곳
      }
    }
    c.globalAlpha = 0.72;                                        // 내 탄은 살짝 옅게 (적 탄이 먼저 눈에 띄게)
    for (const s of g.shots) {
      if (s.k === 'L') continue;
      const sp = s.k === 'M' ? A.shotM : A.shotV;
      if (s.vx) this.rot(sp, s.x, s.y, Math.atan2(s.vx, -s.vy)); else this.put(sp, s.x, s.y);
    }
    c.globalAlpha = 1;
    for (const m of g.msl) {
      const bx = Math.cos(m.a), by = Math.sin(m.a);
      c.globalAlpha = 0.45; c.drawImage(A.fx.spark.c, m.x - bx * 6 - 2, m.y - by * 6 - 2, 4, 4);
      c.globalAlpha = 0.22; c.drawImage(A.fx.spark.c, m.x - bx * 10 - 1.6, m.y - by * 10 - 1.6, 3.2, 3.2); c.globalAlpha = 1;
      this.rot(A.missile, m.x, m.y, m.a + Math.PI / 2);
    }
  },
  drawPlayer(c, A, g) {
    const p = g.p;
    if (!p.alive) return;
    const blink = p.inv > 0 && g.bombT <= 0 && Math.floor(this.T * 12) % 2;
    const fl = 0.9 + Math.sin(this.T * 37) * 0.12;
    this.put(A.flame, p.x - 1.6 * (1 - Math.abs(p.bank) * 0.2), p.y + 11, fl);
    this.put(A.flame, p.x + 1.6 * (1 - Math.abs(p.bank) * 0.2), p.y + 11, fl);
    if (blink) c.globalAlpha = 0.35;
    const s = A.ship, kx = 1 - Math.abs(p.bank) * 0.16;
    c.drawImage(s.c, p.x - (s.w * kx) / 2, p.y - s.h / 2, s.w * kx, s.h);
    c.globalAlpha = 1;
    // 맞는 곳: 가운데 작은 점 (언제나)
    c.beginPath(); c.arc(p.x, p.y, 1.9, 0, Math.PI * 2); c.fillStyle = '#0b0f1e'; c.fill();
    c.beginPath(); c.arc(p.x, p.y, 1.2, 0, Math.PI * 2); c.fillStyle = p.focus ? '#ff7ab8' : '#ffffff'; c.fill();
  },
  drawFx(c, A) {
    const F = this.fx, fire = A.fx.fire, smoke = A.fx.smoke;
    for (const q of F.deb) { c.globalAlpha = Math.max(0, 1 - q.t / q.life); this.rot(A.fx.shard[q.i], q.x, q.y, q.a); }
    for (const b of F.boom) {
      if (b.t < 0) continue;
      const k = b.t / b.life, e = 1 - (1 - k) * (1 - k);
      if (b.r >= 12) { const sr = b.r * (0.8 + e * 0.9); c.globalAlpha = 0.45 * (1 - k); c.drawImage(smoke.c, b.x - sr, b.y - sr * 0.9 - k * 6, sr * 2, sr * 2); }
      const r = b.r * (0.45 + e * 0.75); c.globalAlpha = Math.max(0, 1 - k * k); c.drawImage(fire.c, b.x - r, b.y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    for (const s of F.spark) { const k = s.t / 0.14, r = 2.2 + k * 2; c.globalAlpha = 1 - k; c.drawImage(A.fx.spark.c, s.x - r, s.y - r, r * 2, r * 2); }
    c.globalAlpha = 1;
    for (const r of F.ring) {
      const k = r.t / r.life, rad = r.r * (0.25 + 0.75 * Math.sqrt(k));
      c.globalAlpha = 0.7 * (1 - k); c.strokeStyle = r.col; c.lineWidth = Math.max(0.6, 2.2 * (1 - k)); c.beginPath(); c.arc(r.x, r.y, rad, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  },
  drawBullets(c, A, g) {
    const B = A.eb;
    for (const q of this.fx.ghost) { const s = B[q.k] || B.o, k = q.t / 0.25; c.globalAlpha = 0.6 * (1 - k); this.put(s, q.x, q.y, 1 - k * 0.5); }   // 지워지는 탄
    c.globalAlpha = 1;
    for (const b of g.eb) {
      if (b.kind === 'n') this.rot(B.n, b.x, b.y, Math.atan2(b.vy, b.vx) - Math.PI / 2);
      else this.put(B[b.kind] || B.o, b.x, b.y);
    }
  },
  drawHazards(c, g) {
    for (const h of g.hz) {
      if (h.warn > 0) {
        const a = 0.5 + Math.sin(this.T * 10) * 0.2;
        c.globalAlpha = 0.12; c.fillStyle = '#ff4d6d'; c.fillRect(h.x - h.w / 2, h.y0, h.w, SHH - h.y0);
        c.globalAlpha = a; c.fillStyle = '#ff6b84'; c.fillRect(h.x - 0.5, h.y0, 1, SHH - h.y0);
        c.fillRect(h.x - h.w / 2, h.y0, 0.6, SHH - h.y0); c.fillRect(h.x + h.w / 2 - 0.6, h.y0, 0.6, SHH - h.y0);
        c.globalAlpha = 1;
      } else {
        const w = h.w * (h.on > 0.55 ? Math.min(1, (0.65 - h.on) * 8 + 0.3) : 1);
        c.globalAlpha = 0.35; c.fillStyle = '#ff4d6d'; c.fillRect(h.x - w / 2 - 2, h.y0, w + 4, SHH - h.y0);
        c.globalAlpha = 0.9; c.fillStyle = '#ffa3b6'; c.fillRect(h.x - w / 2, h.y0, w, SHH - h.y0);
        c.globalAlpha = 1; c.fillStyle = '#ffffff'; c.fillRect(h.x - w / 5, h.y0, (w * 2) / 5, SHH - h.y0);
      }
    }
  },
  txt(c, s, x, y, size, col, align = 'center', weight = 700) {
    c.font = `${weight} ${size}px ${SH_FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    c.lineWidth = Math.max(1.5, size * 0.28); c.strokeStyle = 'rgba(5,7,16,.85)'; c.strokeText(s, x, y);
    c.fillStyle = col; c.fillText(s, x, y);
  },
  drawHud(c, A, g) {
    const p = g.p;
    // 왼쪽 아래: 남은 목숨 · 폭탄
    for (let i = 0; i < Math.min(5, p.lives - 1); i++) this.put(A.ship, 9 + i * 11, SHH - 22, 0.46);
    for (let i = 0; i < p.bombs; i++) this.put(A.items.B, 9 + i * 11, SHH - 10, 0.72);
    // 오른쪽 아래: 무기 · 파워 (6칸)
    const W = SCore.WEAPONS[p.weapon];
    this.put(A.items[p.weapon], SHW - 60, SHH - 15, 0.92);
    this.txt(c, W.name, SHW - 51, SHH - 19.5, 6.6, W.color, 'left');
    for (let i = 0; i < SCore.PMAX; i++) {
      c.fillStyle = i < p.power ? W.color : 'rgba(150,160,200,.25)';
      c.beginPath(); c.roundRect ? c.roundRect(SHW - 51 + i * 7.4, SHH - 12.2, 6, 3.4, 1.2) : c.rect(SHW - 51 + i * 7.4, SHH - 12.2, 6, 3.4); c.fill();
    }
    // 위: 보스 체력
    const b = g.boss;
    let ty = 10;
    if (b && !b.leaving) {
      let tot = 0, max = 0;
      for (const q of b.parts) { max += q.max; if (!q.dead) tot += Math.max(0, q.hp); }
      const k = Math.min(b.enter > 0 ? 1 - b.enter / 2.6 : 1, tot / max), bx = 8, bw = SHW - 16;
      this.txt(c, b.def.name, bx, 6, 6.2, '#ffd9df', 'left');
      if (!b.mid) { const left = Math.max(0, Math.ceil(b.timer)); this.txt(c, `${left}`, SHW - 8, 6, 6.2, left < 20 ? '#ff6b78' : '#9aa6c7', 'right'); }
      c.fillStyle = 'rgba(10,12,24,.75)'; c.fillRect(bx - 0.5, 10.5, bw + 1, 4);
      c.fillStyle = 'rgba(255,79,110,.22)'; c.fillRect(bx, 11, bw, 3);
      c.fillStyle = b.dying > 0 ? '#ffffff' : '#ff5a78'; c.fillRect(bx, 11, bw * k, 3);
      ty = 22;
    }
    // 알림 (아이템 · 보너스 · 1UP) — 판 위쪽 가운데에 잠깐
    for (const t of this.toasts) {
      const a = Math.min(1, t.t * 6, (t.life - t.t) * 3);
      c.globalAlpha = a; this.txt(c, t.txt, SHW / 2, ty, 7, t.col); ty += 10;
    }
    c.globalAlpha = 1;
  },
  drawBanner(c, g) {
    const B = this.banner, cy = SHH * 0.4;
    if (B && B.kind === 'stage') {
      const t = B.t, a = Math.min(1, t * 4, (B.life - t) * 2.5);
      c.globalAlpha = a * 0.4; c.fillStyle = '#05070f'; c.fillRect(0, cy - 26, SHW, 52); c.globalAlpha = a;
      if (B.loop) this.txt(c, `${B.loop + 1}주차`, SHW / 2, cy - 19, 6.5, '#ff9aa6');
      this.txt(c, `STAGE ${B.n}`, SHW / 2, cy - 6, 15, '#ffffff', 'center', 900);
      this.txt(c, B.name, SHW / 2, cy + 12, 8, '#ffd9a0');
      c.globalAlpha = 1;
    }
    if (B && B.kind === 'warn') {
      const t = B.t, a = Math.min(1, t * 3, (B.life - t) * 3), pulse = 0.75 + Math.sin(t * 7) * 0.25;
      c.globalAlpha = a * 0.5; c.fillStyle = '#3a0612'; c.fillRect(0, cy - 22, SHW, 44);
      c.globalAlpha = a; c.fillStyle = '#ff3a5a'; c.fillRect(0, cy - 22, SHW, 1.2); c.fillRect(0, cy + 21, SHW, 1.2);
      c.globalAlpha = a * pulse; this.txt(c, 'WARNING', SHW / 2, cy - 6, 15, '#ff5a6e', 'center', 900);
      c.globalAlpha = a; this.txt(c, `보스 「${B.name}」 접근 중`, SHW / 2, cy + 11, 7.5, '#ffd9df');
      c.globalAlpha = 1;
    }
    // 스테이지 끝: 보너스 · 별 3개
    const T = this.tally;
    if (T && g.phase === 'clear') {
      const t = T.t, x0 = 22, w = SHW - 44, y0 = SHH * 0.22, h = 150;
      c.globalAlpha = Math.min(1, t * 4) * 0.82; c.fillStyle = '#080b1a';
      c.beginPath(); c.roundRect ? c.roundRect(x0, y0, w, h, 10) : c.rect(x0, y0, w, h); c.fill();
      c.globalAlpha = Math.min(1, t * 4); c.strokeStyle = 'rgba(255,210,63,.6)'; c.lineWidth = 0.8; c.stroke();
      this.txt(c, T.all ? 'ALL CLEAR!' : 'STAGE CLEAR', SHW / 2, y0 + 13, 11, T.all ? '#7dffb0' : '#ffd23f', 'center', 900);
      T.rows.forEach(([label, v], i) => {
        if (t < 0.3 + i * 0.25) return;
        const y = y0 + 33 + i * 13;
        this.txt(c, label, x0 + 12, y, 7, '#d6deef', 'left', 500);
        this.txt(c, '+' + shFmt(v), x0 + w - 12, y, 7, v ? '#ffffff' : '#56617f', 'right');
      });
      const ys = y0 + 33 + T.rows.length * 13 + 8;
      if (t > 0.4 + T.rows.length * 0.25) { this.txt(c, '보너스', x0 + 12, ys, 7.5, '#ffd23f', 'left'); this.txt(c, '+' + shFmt(T.total), x0 + w - 12, ys, 7.5, '#ffd23f', 'right'); }
      const names = ['클리어', '노 미스', '격추율 85%'];
      for (let i = 0; i < 3; i++) {
        const sx = SHW / 2 + (i - 1) * 50, sy = y0 + h - 22, on = T.stars[i] && t > 1.6 + i * 0.35;
        const pop = on ? Math.min(1, (t - 1.6 - i * 0.35) * 6) : 1;
        this.txt(c, '★', sx, sy, 14 * (on ? 0.7 + 0.3 * pop : 1), on ? '#ffd23f' : 'rgba(150,160,200,.35)', 'center', 900);
        this.txt(c, names[i], sx, sy + 12, 5.6, on ? '#ffe9a6' : '#6b7596', 'center', 500);
      }
      c.globalAlpha = 1;
    }
    // 게임 오버 · 이어하기
    if (g.phase === 'over') {
      const t = g.phaseT;
      if (t > 0.8) { c.globalAlpha = Math.min(1, (t - 0.8) * 2); this.txt(c, 'GAME OVER', SHW / 2, SHH * 0.3, 16, '#ff6b78', 'center', 900); c.globalAlpha = 1; }
      if (t > 1.7 && !this.ended) {
        const n = Math.max(0, 9 - Math.floor(this.contT)), y = SHH * 0.42;
        c.fillStyle = 'rgba(5,6,15,.7)'; c.beginPath(); c.roundRect ? c.roundRect(30, y, SHW - 60, 82, 10) : c.rect(30, y, SHW - 60, 82); c.fill();
        this.txt(c, '이어하기?', SHW / 2, y + 13, 9, '#ffffff');
        this.txt(c, String(n), SHW / 2, y + 36, 20, n <= 3 ? '#ff6b78' : '#ffd23f', 'center', 900);
        this.txt(c, TOUCH ? '화면을 누르면 이어서 해요' : '클릭 · 스페이스 · 엔터로 이어서 해요', SHW / 2, y + 58, 6.6, '#d6deef', 'center', 500);
        this.txt(c, `점수는 0부터 · 지금까지 최고 ${shFmt(g.best)}`, SHW / 2, y + 70, 6, '#9aa6c7', 'center', 500);
      }
    }
  },
};

/* ───── 조작 ───── */
(() => {
  const cv = $('#sh-cv');
  const toGame = (cx, cy) => { const r = cv.getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * SHW, y: ((cy - r.top) / r.height) * SHH, k: SHW / r.width }; };
  // 손가락: 화면 어디든 · 움직인 만큼 비행기가 움직여요 (조금 더 빠르게 1.25배)
  TouchArea.add('shooter', {
    down(e) {
      const sh = Shooter, g = sh.g;
      if (!g || sh.mode !== 'play') return;
      if (g.phase === 'over') { sh.cont(); return; }
      const q = toGame(e.clientX, e.clientY);
      sh.drag = { fx: e.clientX, fy: e.clientY, cx: e.clientX, cy: e.clientY, sx: g.p.x, sy: g.p.y, tx: g.p.x, ty: g.p.y, k: q.k };
    },
    move(e) {
      const d = Shooter.drag; if (!d) return;
      d.cx = e.clientX; d.cy = e.clientY;
      const k = d.k * 1.25;
      d.tx = Math.max(7, Math.min(SHW - 7, d.sx + (e.clientX - d.fx) * k));
      d.ty = Math.max(16, Math.min(SHH - 10, d.sy + (e.clientY - d.fy) * k));
      // 벽에 닿으면 기준점을 옮겨서 반대로 움직일 때 바로 따라와요
      if (d.tx <= 7 || d.tx >= SHW - 7) { d.sx = d.tx; d.fx = e.clientX; }
      if (d.ty <= 16 || d.ty >= SHH - 10) { d.sy = d.ty; d.fy = e.clientY; }
    },
    up() { Shooter.drag = null; },
    cancel() { Shooter.drag = null; },
  });
  // 두 번째 손가락으로 톡 = 폭탄
  document.addEventListener('pointerdown', e => {
    if (S.screen !== 'shooter' || e.pointerType === 'mouse' || !TouchArea.cur || TouchArea.cur.id === e.pointerId) return;
    if (e.target instanceof Element && e.target.closest('button, .game-head, .topbar, .overlay, .modal, .sh-menu')) return;
    Shooter.bomb();
  }, true);
  // 마우스: 판 위에서 움직이면 따라와요
  cv.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const q = toGame(e.clientX, e.clientY); Shooter.mouse = { x: q.x, y: q.y }; });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') Shooter.mouse = null; });
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && Shooter.g && Shooter.mode === 'play' && Shooter.g.phase === 'over') Shooter.cont(); });
  // 폭탄 버튼: 누르는 순간 (다른 손가락으로 끄는 중이어도)
  const bb = $('#sh-bomb');
  bb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Shooter.bomb(); bb.classList.add('hit'); setTimeout(() => bb.classList.remove('hit'), 160); });
  bb.addEventListener('click', e => e.preventDefault());
})();
Object.assign(ACT, {
  shBgm: () => { if (typeof ShAudio === 'undefined') return; ShAudio.music.on = !ShAudio.music.on; if (ShAudio.music.on && Shooter.g && !Shooter.over && Shooter.mode === 'play') ShAudio.music.play(Shooter.g.boss && !Shooter.g.boss.mid ? 'boss' : 'stage'); Shooter.paintBgm(); },
  shDiff: el => { Shooter.diff = clamp(+el.dataset.v || 0, 0, 2); store.set('sh-diff', Shooter.diff); Shooter.menu(true); Shooter.hud(true); },
  shFrom: el => { const n = clamp(+el.dataset.v || 1, 1, 5); if (n <= Shooter.prog[Shooter.dkey()].reach) { Shooter.from = n; Shooter.menu(true); } },
  shGo: () => Shooter.begin(),
});
register('shooter', {
  solo: () => Shooter.start(),
  stop: () => { Shooter.over = true; Shooter.drag = null; if (typeof ShAudio !== 'undefined') ShAudio.music.stop(0.3); },
  key: e => {
    const sh = Shooter, g = sh.g;
    if (sh.mode === 'menu') { if (['Enter', 'Space'].includes(e.code) && !e.repeat) { if (e.preventDefault) e.preventDefault(); sh.begin(); } return; }
    if (!g) return;
    if (g.phase === 'over' && ['Space', 'Enter', 'KeyX', 'KeyZ', 'KeyB'].includes(e.code) && !e.repeat) { if (e.preventDefault) e.preventDefault(); sh.cont(); return; }
    if (['KeyX', 'KeyB', 'Space'].includes(e.code) && !e.repeat) { if (e.preventDefault) e.preventDefault(); sh.bomb(); }
  },
});
