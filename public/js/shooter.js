/* =====================================================================
 *  🚀 우주 슈팅 (v14.0 리뉴얼) — 화면 · 조작 · 효과. 규칙은 js/shared/shooter-core.js (SCore), 그림 js/shooter-art.js, 소리 js/shooter-audio.js
 *  조작: 휴대폰 = 화면 어디든 끌기(손가락이 움직인 만큼 비행기가 움직여요 · 손가락이 비행기를 가리지 않아요)
 *        PC = 마우스(판 위) · 방향키 / W A S D, Shift 를 누르면 천천히 · 폭탄 = X · B · 스페이스 · 💣 버튼 · 두 번째 손가락 탭
 *  타격감: 맞은 적이 하얗게 번쩍 · 불똥 · 파편 · 연기 · 크기별 폭발 · 화면 흔들림 · 큰 적은 잠깐 멈칫(히트 스톱) · 보스는 느린 화면으로 터져요
 * ===================================================================== */
const SHW = 240;
let SHH = 320;                                                       // 판 세로: 판마다 화면 비율에 맞춰 320 ~ 440 (Shooter.pickH)
makeScreen('shooter', {
  title: '🚀 우주 슈팅',
  status: TOUCH ? '화면 어디든 끌어서 움직여요 · 총은 자동 · 위급할 땐 💣 (두 번째 손가락 탭도 돼요)' : '마우스 · 방향키로 움직여요 (Shift 천천히) · 총은 자동 · 폭탄 X · B · 스페이스',
  stats: [['score', '점수'], ['stage', '스테이지'], ['best', '최고 점수']],
  body: `<div class="sh-wrap center col"><canvas id="sh-cv" class="game-cv" width="${SHW * 3}" height="${SHH * 3}" aria-label="우주 슈팅 화면"></canvas>
    <div class="sh-bar">
      <button class="btn ghost sh-bgm" id="sh-bgm" data-act="shBgm" aria-label="배경 음악 켜기 · 끄기">🎵</button>
      <span class="sh-hint" id="sh-hint">${TOUCH ? '손가락은 비행기 아래 어디든 · 끄는 만큼 움직여요' : 'Shift: 천천히 · 드론이 앞으로 모여요'}</span>
      <button class="btn sh-bomb" id="sh-bomb" aria-label="폭탄 쓰기">💣 폭탄 <b id="sh-bombs">3</b></button>
    </div></div>`,
});

const SH_THEME = [
  { base: '#070a1c', layer: 'nebula', layer2: 'nebula2', sp: 12, tint: 'rgba(40,20,90,.10)' },
  { base: '#0c0907', layer: 'dust', sp: 16, rocks: true, tint: 'rgba(60,30,10,.08)' },
  { base: '#05070f', layer: 'station', sp: 30, tint: 'rgba(0,0,0,.18)' },
  { base: '#14060a', layer: 'planet', sp: 24, tint: 'rgba(0,0,0,.28)' },
  { base: '#0a0612', layer: 'mother', layer2: 'motherGlow', sp: 26, tint: 'rgba(0,0,0,.2)' },
];
const SH_BOSS_GFX = { '스팅어': 'stinger', '오브 십': 'orb', '강철 게': 'crab', '바위 요새': 'fortress', '방어 코어': 'guard', '붉은 포격함': 'bomber', '모선 코어': 'mother' };
const SH_PART_GFX = { clawL: 'clawL', clawR: 'clawR', emL: 'emitter', emR: 'emitter', gunL: 'wingGun', gunR: 'wingGun', podL: 'pod', podR: 'pod', pod0: 'pod', pod1: 'pod', pod2: 'pod', pod3: 'pod', gun0: 'turret', gun1: 'turret', gun2: 'turret', gun3: 'turret' };
const shFmt = n => Math.round(n).toLocaleString('ko-KR');

const Shooter = {
  g: null, over: true, R: 3,
  start() {
    stopLocal();
    S.solo = 'shooter';
    this.A = ShArt.build();
    show('shooter');
    SHH = this.pickH();
    this.g = SCore.create((Math.random() * 4294967296) >>> 0, { H: SHH });
    Object.assign(this, {
      over: false, ended: false, acc: 0, T: 0, stopT: 0, slowT: 0, slowK: 1, shake: 0, flash: 0, flashCol: '#fff', red: 0,
      boomL: [], parts: [], rings: [], texts: [], lights: [], banner: null, tally: null, muzzle: 0,
      drag: null, target: null, mouse: null, bombQ: false, lastShotSnd: 0, lastHitSnd: 0, lastEshot: 0, lastBoomSnd: 0,
      bgY: [0, 0, 0, 0, 0], theme: (this.g.stage - 1) % SH_THEME.length, themeOld: -1, themeFade: 0,
      contT: 0, best: +store.get('best-shooter', 0) || 0, rec: false, hudKey: '', hudT: 0, chainShow: 0, extendT: 0, warnT: 0, bossName: '',
      bgRocks: this.makeRocks(), dirty: true,
    });
    this.setupCanvas();
    this.hud(true);
    setTimeout(() => { if (!this.over) this.layout(); }, 250);
    if (typeof ShAudio !== 'undefined') ShAudio.music.play('stage');
    this.paintBgm();
    gameLoop((dt, now) => this.frame(dt, now));
  },
  /** 길쭉한 휴대폰 화면이면 판을 세로로 길게 (가로 240 은 그대로 · 노트북 · 태블릿 · 펼친 폴드는 320) */
  pickH() {
    const sec = $('#scr-shooter'), head = sec && sec.querySelector('.game-head'), bar = sec && sec.querySelector('.sh-bar');
    if (!sec || !head) return 320;
    const top = head.getBoundingClientRect().bottom, w = Math.min(sec.clientWidth, window.innerWidth - 16);
    const h = window.innerHeight - top - (bar ? bar.offsetHeight : 50) - 30;
    return Math.round(Math.max(320, Math.min(440, (240 * h) / Math.max(1, w))));
  },
  setupCanvas() {
    const cv = $('#sh-cv');
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.fitR(true);
  },
  /** 화면에 보이는 크기 × 화소 밀도에 맞춰 캔버스 해상도(R배)를 골라요 (폴드를 펼치거나 접어도 다시 맞춰요) */
  fitR(force) {
    const cv = this.cv, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const want = Math.max(2, Math.min(4, Math.ceil(((r.height || 640) * dpr) / SHH - 0.2)));
    if (force || want !== this.R) {
      this.R = want;
      cv.width = SHW * want; cv.height = SHH * want;
      this.ctx = cv.getContext('2d');
      this.vig = null; this.scan = null;
    }
  },
  /** 아래 줄(🎵 · 안내 · 💣): 판 옆에 자리가 넉넉하면(폴드 펼친 화면 · 태블릿 · 노트북 · 가로 화면) 판 오른쪽에 세로로 → 판이 더 커져요.
   *  아니면 판 아래에 판 너비만큼. (왔다 갔다 하지 않게 넓어질 때 190px · 좁아질 때 110px 기준) */
  layout() {
    const wrap = $('#scr-shooter .sh-wrap'), bar = wrap && wrap.querySelector('.sh-bar');
    if (!wrap || !bar) return;
    const w = Math.round(this.cv.getBoundingClientRect().width), free = wrap.clientWidth - w, side = wrap.classList.contains('sh-side');
    if (!side && free > 190) wrap.classList.add('sh-side');
    else if (side && free < 110) wrap.classList.remove('sh-side');
    const want = wrap.classList.contains('sh-side') ? '' : w > 100 ? w + 'px' : '';
    if (bar.style.width !== want) bar.style.width = want;
  },
  makeRocks() { const R = SCore.rng(9), out = []; for (let i = 0; i < 9; i++) out.push({ x: R() * SHW, y: R() * 480, k: Math.floor(R() * 4), sp: 6 + R() * 10 }); return out; },

  /* ───── 매 화면 ───── */
  frame(dt) {
    dt = Math.max(0, Math.min(0.05, dt || 0));                       // 첫 화면은 시각이 살짝 거꾸로일 수 있어요
    this.T += dt;
    if ((this.fitT = (this.fitT || 0) + dt) > 0.6) {
      this.fitT = 0; this.fitR(false);
      this.layout();
      const M = typeof ShAudio !== 'undefined' && ShAudio.music;   // 소리를 늦게 켰거나 다시 돌아왔을 때 음악 이어 틀기
      if (M && M.want && !M.playing && M.on && !this.over) M.play(M.want);
    }
    const g = this.g;
    // 시간: 히트 스톱(잠깐 멈춤) · 느린 화면
    let sim = dt;
    if (this.stopT > 0) { this.stopT -= dt; sim = 0; }
    else if (this.slowT > 0) { this.slowT -= dt; sim = dt * this.slowK; }
    const freeze = g.phase === 'over' && g.phaseT > 1.7;
    if (!freeze && !this.ended) {
      this.acc = Math.min(this.acc + sim, SCore.STEP * 4);
      while (this.acc >= SCore.STEP) {
        this.acc -= SCore.STEP;
        SCore.step(g, this.input());
        this.bombQ = false;
        this.events();
      }
    }
    if (g.phase === 'over') this.overTick(dt);
    this.fx(dt);
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
  bomb() { if (!this.over && this.g && this.g.p.bombs > 0) this.bombQ = true; },

  /* ───── 사건 → 효과 · 소리 ───── */
  events() {
    const g = this.g, A = typeof ShAudio !== 'undefined' ? ShAudio.sfx : null, now = this.T;
    for (const e of g.ev) {
      switch (e.k) {
        case 'shot': this.muzzle = 2; if (A && now - this.lastShotSnd > 0.085) { this.lastShotSnd = now; A.shot(e.w); } break;
        case 'hit': this.sparks(e.x, e.y, e.big ? 4 : 3, '#fff6b0'); if (A && now - this.lastHitSnd > 0.05) { this.lastHitSnd = now; A.hit(e.big); } break;
        case 'clink': this.sparks(e.x, e.y, 3, '#cfd8ea'); if (A && now - this.lastHitSnd > 0.08) { this.lastHitSnd = now; A.clink(); } break;
        case 'mhit': this.boom(e.x, e.y, 's', 0.6); break;
        case 'kill': this.killFx(e); if (A && now - this.lastBoomSnd > 0.04) { this.lastBoomSnd = now; A.kill(e.sz); } break;
        case 'partKill':
          this.boom(e.x, e.y, 'l'); this.boom(e.x + 8, e.y - 6, 'm', 1, 0.12); this.debris(e.x, e.y, 10); this.ring(e.x, e.y, 34, '#ffd9a0');
          this.shake = Math.max(this.shake, 4); this.stopT = Math.max(this.stopT, 0.07); this.popup(e.x, e.y - 10, '+' + shFmt(e.pts), '#ffd23f');
          if (A) A.boom(true);
          break;
        case 'bossDie':
          this.flash = 0.55; this.flashCol = '#ffffff'; this.shake = 7; this.slowT = e.mid ? 0.6 : 1.4; this.slowK = 0.3;
          this.popup(e.x, e.y + 20, '+' + shFmt(e.pts), '#ffd23f', 2);
          if (A) A.bossDie(); if (!e.mid && typeof ShAudio !== 'undefined') ShAudio.music.stop(1.2);
          break;
        case 'bossBoom': this.boom(e.x, e.y, Math.random() < 0.4 ? 'l' : 'm'); this.debris(e.x, e.y, 3); this.shake = Math.max(this.shake, 3); if (A && now - this.lastBoomSnd > 0.09) { this.lastBoomSnd = now; A.kill(3); } break;
        case 'bossEnd': case 'midEnd': {
          const big = e.k === 'bossEnd';
          for (let i = 0; i < (big ? 7 : 4); i++) this.boom(e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 30, 'l', 1, i * 0.06);
          this.ring(e.x, e.y, big ? 120 : 70, '#ffffff'); this.ring(e.x, e.y, big ? 80 : 50, '#ffd23f', 0.15);
          this.debris(e.x, e.y, big ? 26 : 14); this.flash = big ? 0.8 : 0.4; this.shake = big ? 9 : 6;
          if (A) A.bossEnd(big);
          if (big) this.banner = null;
          break;
        }
        case 'escape': this.say('ESCAPED', '보스가 도망쳤어요', '#9aa6c7', 2); if (!e.mid && typeof ShAudio !== 'undefined') ShAudio.music.stop(1); break;
        case 'warn':
          this.warnT = 3.2; this.bossName = e.name; this.banner = { kind: 'warn', t: 0, life: 3.2, en: e.en, name: e.name };
          if (A) A.warn(); if (typeof ShAudio !== 'undefined') ShAudio.music.stop(0.6);
          break;
        case 'bossIn': if (typeof ShAudio !== 'undefined') ShAudio.music.play('boss'); break;
        case 'midIn': this.say('', `중간 보스 「${e.name}」`, '#ff9aa6', 1.8); if (A) A.mid(); break;
        case 'stage':
          this.banner = { kind: 'stage', t: 0, life: 2.8, n: e.n, loop: e.loop, name: e.name, en: e.en };
          if (this.theme !== (e.n - 1) % SH_THEME.length) { this.themeOld = this.theme; this.theme = (e.n - 1) % SH_THEME.length; this.themeFade = 1; }
          this.tally = null;
          if (typeof ShAudio !== 'undefined' && g.t > 1) ShAudio.music.play('stage');
          if (A && g.t > 1) A.stage();
          this.dirty = true;
          break;
        case 'clear': this.tally = { t: 0, rows: e.bonus, total: e.total, all: e.all, stage: e.stage }; if (A) A.clear(e.all); break;
        case 'pick': this.popup(e.x, e.y - 10, e.txt, SCore.ITEMS[e.k] ? (e.k === 'W' ? SCore.WEAPONS[e.w].color : SCore.ITEMS[e.k].color) : '#fff'); this.ring(g.p.x, g.p.y, 22, '#fff6b0'); if (A) A.pick(e.k); break;
        case 'medal': this.popup(e.x, e.y - 6, shFmt(e.v), e.v >= 3000 ? '#fff6b0' : '#ffd23f', 1, true); if (A) A.medal(e.mi); break;
        case 'medalLost': this.say('', '메달을 놓쳐서 값이 처음부터예요', '#9aa6c7', 1.2, true); break;
        case 'formation': this.popup(e.x, e.y - 12, 'BONUS +' + shFmt(e.pts), '#7dffb0', 1, false, true); this.ring(e.x, e.y, 26, '#7dffb0'); if (A) A.formation(); break;
        case 'bomb': this.bombFx(e.x, e.y); if (A) A.bomb(); break;
        case 'stars': if (A) A.stars(); break;
        case 'die':
          this.boom(e.x, e.y, 'l'); this.boom(e.x, e.y, 'm', 1, 0.15); this.debris(e.x, e.y, 14, true); this.ring(e.x, e.y, 46, '#9df4ff');
          this.shake = 7; this.red = 0.8; this.slowT = 0.5; this.slowK = 0.35;
          if (A) A.die();
          if (navigator.vibrate) try { navigator.vibrate(120); } catch { /* 무시 */ }
          break;
        case 'shield': this.ring(e.x, e.y, 36, '#3fe0a0'); this.sparks(e.x, e.y, 10, '#a8ff8f'); if (A) A.shield(); break;
        case 'respawn': if (A) A.respawn(); break;
        case 'extend': this.extendT = 2.2; if (A) A.extend(); break;
        case 'eshot': if (A && now - this.lastEshot > 0.12) { this.lastEshot = now; A.eshot(); } break;
        case 'laserWarn': if (A) A.laserWarn(); break;
        case 'laserOn': this.shake = Math.max(this.shake, 2); if (A) A.laserOn(); break;
        case 'split': this.sparks(e.x, e.y, 5, '#ff9aa6'); if (A) A.split(); break;
        case 'dash': if (A) A.dash(); break;
        case 'phase': this.flash = Math.max(this.flash, 0.25); this.flashCol = '#ffd9a0'; this.shake = Math.max(this.shake, 3); if (A) A.phase(); break;
        case 'over': this.contT = 0; if (typeof ShAudio !== 'undefined') ShAudio.music.stop(1.5); if (A) A.over(); break;
        case 'cont': this.contT = 0; this.say('GO!', '이어서 해요 · 점수는 0부터', '#7dffb0', 1.6); if (typeof ShAudio !== 'undefined') ShAudio.music.play(g.boss && !g.boss.mid ? 'boss' : 'stage'); break;
      }
    }
    g.ev.length = 0;
  },
  killFx(e) {
    const { x, y } = e;
    if (e.sz === 1) { this.boom(x, y, 's'); this.sparks(x, y, 6, '#ffd9a0'); this.debris(x, y, 3); }
    else if (e.sz === 2) { this.boom(x, y, 'm'); this.sparks(x, y, 10, '#fff6b0'); this.debris(x, y, 7); this.ring(x, y, 26, '#ffd9a0'); this.shake = Math.max(this.shake, 2); this.smoke(x, y, 4); }
    else { this.boom(x, y, 'l'); this.boom(x - 10, y + 6, 'm', 1, 0.08); this.boom(x + 10, y - 6, 'm', 1, 0.16); this.debris(x, y, 14); this.ring(x, y, 44, '#ffd9a0'); this.smoke(x, y, 8); this.shake = Math.max(this.shake, 4); this.stopT = Math.max(this.stopT, 0.05); }
    if (e.pts && (e.sz >= 2 || e.chain >= 8)) this.popup(x, y - 8, shFmt(e.pts), e.sz >= 3 ? '#ffd23f' : '#ffffff', 1, true);
    if (e.chain >= 3) this.chainShow = 1.4;
    if (e.type === 'mine' && e.self) this.ring(x, y, 22, '#ff6b78');
  },
  bombFx(x, y) {
    this.flash = 0.7; this.flashCol = '#ffffff'; this.shake = 6;
    this.ring(x, y, 260, '#ffffff', 0, 0.9); this.ring(x, y, 200, '#ffd23f', 0.1, 0.9); this.ring(x, y, 140, '#ff9aa6', 0.2, 0.8);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, d = 30 + (i % 3) * 30; this.boom(x + Math.cos(a) * d, y + Math.sin(a) * d - 40, i % 2 ? 'l' : 'm', 1, 0.05 + i * 0.045); }
  },

  /* ───── 효과 만들기 ───── */
  boom(x, y, size, scale = 1, delay = 0) { if (this.boomL.length < 90) this.boomL.push({ x, y, size, t: -delay, k: scale }); this.lights.push({ x, y, r: size === 'l' ? 40 : size === 'm' ? 26 : 14, t: 0, life: size === 'l' ? 0.35 : 0.22, d: delay }); },
  sparks(x, y, n, col) { for (let i = 0; i < n; i++) { if (this.parts.length > 420) return; const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 140; this.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.18 + Math.random() * 0.2, col }); } },
  debris(x, y, n, blue) { for (let i = 0; i < n; i++) { if (this.parts.length > 420) return; const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120; this.parts.push({ k: 'deb', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0, life: 0.6 + Math.random() * 0.6, i: blue ? 1 : Math.floor(Math.random() * 5), rot: Math.random() * 6 }); } },
  smoke(x, y, n) { for (let i = 0; i < n; i++) { if (this.parts.length > 420) return; this.parts.push({ k: 'smoke', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 14, vy: 10 + Math.random() * 16, t: -Math.random() * 0.2, life: 0.9 + Math.random() * 0.6, s: Math.floor(Math.random() * 3) }); } },
  ring(x, y, r, col, delay = 0, life = 0.35) { this.rings.push({ x, y, r, col, t: -delay, life }); },
  popup(x, y, txt, col, s = 1, small, wide) { if (this.texts.length < 40) this.texts.push({ x, y, txt: String(txt), col, s, t: 0, life: small ? 0.7 : 1.1, small, kr: /[가-힣]/.test(txt) }); },
  say(en, kr, col, life = 2, small) { this.banner = { kind: 'say', t: 0, life, en, kr, col, small }; },

  fx(dt) {
    this.shake = Math.max(0, this.shake - dt * 22); this.flash = Math.max(0, this.flash - dt * 1.6); this.red = Math.max(0, this.red - dt * 1.3);
    this.muzzle = Math.max(0, this.muzzle - 1); this.chainShow = Math.max(0, this.chainShow - dt); this.extendT = Math.max(0, this.extendT - dt);
    this.themeFade = Math.max(0, this.themeFade - dt * 0.5);
    const sd = this.stopT > 0 ? 0 : this.slowT > 0 ? dt * this.slowK : dt;
    for (const b of this.boomL) b.t += sd;
    this.boomL = this.boomL.filter(b => b.t < 0.48);
    for (const q of this.parts) {
      q.t += sd;
      if (q.t < 0) continue;
      q.x += q.vx * sd; q.y += q.vy * sd;
      if (q.k === 'deb') { q.vy += 160 * sd; q.vx *= 0.985; q.rot += sd * 9; }
      else if (q.k === 'spark') { q.vx *= 0.9; q.vy *= 0.9; }
      else if (q.k === 'smoke') { q.vx *= 0.97; }
    }
    this.parts = this.parts.filter(q => q.t < q.life);
    for (const r of this.rings) r.t += sd;
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const l of this.lights) { if (l.d > 0) l.d -= sd; else l.t += sd; }
    this.lights = this.lights.filter(l => l.t < l.life).slice(-60);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < t.life);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }
    if (this.tally) this.tally.t += dt;
    if (this.warnT > 0) this.warnT -= dt;
    // 배경 흐르기
    const th = SH_THEME[this.theme], sp = this.g.phase === 'clear' ? 2.2 : 1;
    this.bgY[0] += 5 * dt * sp; this.bgY[1] += 13 * dt * sp; this.bgY[2] += 34 * dt * sp; this.bgY[3] += th.sp * dt * sp; this.bgY[4] += th.sp * 0.55 * dt * sp;
    for (const r of this.bgRocks) { r.y += r.sp * dt * sp; if (r.y > 500) { r.y = -30; r.x = Math.random() * SHW; } }
    // 비행기 엔진 · 보스 연기
    const g = this.g;
    if (g.boss && !g.boss.dying && Math.random() < 0.25) for (const p of g.boss.parts) if (!p.dead && p.hp < p.max * 0.35 && Math.random() < 0.3) this.smoke(p.x, p.y, 1);
    if (g.boss && g.boss.parts) for (const p of g.boss.parts) if (p.dead && !p.core && Math.random() < 0.08 && !g.boss.dying) this.smoke(p.x, p.y, 1);
    for (const e of g.en) if (e.type === 'heavy' && e.hp < e.max * 0.4 && Math.random() < 0.12) this.smoke(e.x, e.y, 1);
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
    if (this.over || g.phase !== 'over' || this.contT < 0.35) return false;   // CONTINUE? 가 보이고 나서
    this.saveBest();
    SCore.cont(g); this.events();
    this.hud(true);
    return true;
  },
  saveBest() {
    const g = this.g;
    if (g.best > this.best) { this.best = g.best; store.set('best-shooter', this.best); }
  },
  finish() {
    if (this.ended) return;
    this.ended = true; this.over = true;
    const g = this.g;
    this.saveBest();
    const reach = `${g.loop ? (g.loop + 1) + '주차 ' : ''}${g.stage}스테이지`;
    after(300, () => showResult({
      title: g.allClear || g.loop ? '🚀 대단해요! 우주를 지켰어요' : '🚀 격추됐어요!',
      subtitle: `점수 ${shFmt(g.best)}${g.credits > 1 ? ` (이어하기 ${g.credits - 1}번 · 한 번에 낸 최고 점수)` : ''} · ${reach}까지 · 최고 연속 ${g.maxChain} · 최고 점수 ${shFmt(this.best)}`,
      solo: 'shooter', rec: { v: g.best },
    }));
    if (typeof ShAudio !== 'undefined') ShAudio.music.stop(1);
  },

  /* ───── 위쪽 점수 칸 (바뀔 때만) ───── */
  hud(force) {
    const g = this.g; if (!g) return;
    const key = `${g.score}|${g.stage}|${g.loop}|${Math.max(this.best, g.best)}|${g.p.bombs}`;
    if (!force && key === this.hudKey) return;
    if (!force && (this.hudT = (this.hudT || 0) + 1) % 4) return;
    this.hudKey = key;
    setStat('shooter', 'score', shFmt(g.score));
    setStat('shooter', 'stage', (g.loop ? `${g.loop + 1}-` : '') + g.stage);
    setStat('shooter', 'best', shFmt(Math.max(this.best, g.best)));
    const b = $('#sh-bombs'); if (b) b.textContent = g.p.bombs;
    const bb = $('#sh-bomb'); if (bb) bb.classList.toggle('empty', !g.p.bombs);
  },
  paintBgm() { const b = $('#sh-bgm'); if (b && typeof ShAudio !== 'undefined') { b.classList.toggle('off', !ShAudio.music.on); b.title = ShAudio.music.on ? '배경 음악 끄기' : '배경 음악 켜기'; } },

  /* ═════════ 그리기 ═════════ */
  draw() {
    const c = this.ctx, R = this.R, g = this.g, A = this.A;
    c.imageSmoothingEnabled = false;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    c.setTransform(R, 0, 0, R, Math.round(sx * R), Math.round(sy * R));
    this.drawBg(c);
    for (const d of g.decks) this.drawDeck(c, d);
    // 적
    if (g.boss) this.drawBoss(c, g.boss);
    for (const e of g.en) if (e.type !== 'part') this.drawEnemy(c, e);
    // 내 탄
    this.drawShots(c);
    // 나
    this.drawPlayer(c);
    // 폭발 · 불똥
    this.drawFx(c);
    // 아이템
    for (const it of g.items) this.drawItem(c, it);
    // 적 탄 (맨 위)
    this.drawBullets(c);
    this.drawHazards(c);
    this.drawTexts(c);
    c.setTransform(R, 0, 0, R, 0, 0);
    this.drawHud(c);
    this.drawBanner(c);
    this.drawOverlay(c);
  },
  sp(c, s, x, y, white) {   // 그림 하나 (가운데 기준 · 캔버스 화소에 맞춰) · white: true 하얗게 · 'soft' 반쯤 하얗게 번쩍
    const R = this.R, w = s.c.width, h = s.c.height, X = Math.round((x - w / 2) * R) / R, Y = Math.round((y - h / 2) * R) / R;
    if (white === 'soft') { c.drawImage(s.c, X, Y); if (Math.floor(this.T * 30) % 2) { c.globalAlpha = 0.55; c.drawImage(s.wh, X, Y); c.globalAlpha = 1; } return; }
    c.drawImage(white ? s.wh : s.c, X, Y, w, h);
  },
  img(c, img, x, y) { const R = this.R; c.drawImage(img, Math.round((x - img.width / 2) * R) / R, Math.round((y - img.height / 2) * R) / R); },
  glow(c, gl, x, y, k = 1) { const s = gl.r * 2 * k; c.drawImage(gl.c, x - s, y - s, s * 2, s * 2); },

  drawBg(c) {
    const A = this.A, th = SH_THEME[this.theme];
    c.fillStyle = th.base; c.fillRect(-4, -4, SHW + 8, SHH + 8);
    const tile = (img, y) => { const h = img.height, oy = ((y % h) + h) % h; c.drawImage(img, 0, oy - h); c.drawImage(img, 0, oy); if (oy + h < SHH) c.drawImage(img, 0, oy + h); };
    const layer = (t, a) => {
      const T = SH_THEME[t];
      c.globalAlpha = a;
      if (T.layer2) tile(A.bg[T.layer2], this.bgY[4]);
      if (T.layer === 'station' || T.layer === 'planet' || T.layer === 'mother') { tile(A.bg.starsFar, this.bgY[0]); if (T.layer === 'station') tile(A.bg.starsMid, this.bgY[1]); }
      tile(A.bg[T.layer], this.bgY[3]);
      if (T.rocks) for (const r of this.bgRocks) { c.globalAlpha = a * 0.55; c.drawImage(A.bgRocks[r.k], Math.round(r.x), Math.round(r.y - 30)); }
      c.globalAlpha = 1;
    };
    if (this.themeFade > 0 && this.themeOld >= 0) { layer(this.themeOld, 1); layer(this.theme, 1 - this.themeFade); }
    else layer(this.theme, 1);
    if (th.layer !== 'station' && th.layer !== 'planet' && th.layer !== 'mother') { tile(A.bg.starsFar, this.bgY[0]); tile(A.bg.starsMid, this.bgY[1]); }
    // 가까운 별 (빠르게 · 반짝)
    c.globalAlpha = 0.7 + Math.sin(this.T * 7) * 0.2; tile(A.bg.starsNear, this.bgY[2]); c.globalAlpha = 1;
    c.fillStyle = th.tint; c.fillRect(0, 0, SHW, SHH);
  },
  drawDeck(c, d) {
    const x0 = Math.round(d.x - d.w / 2), y0 = Math.round(d.y - d.h / 2);
    c.fillStyle = '#0a0c18'; c.fillRect(x0 - 1, y0 - 1, d.w + 2, d.h + 2);
    c.fillStyle = '#2a3048'; c.fillRect(x0, y0, d.w, d.h);
    c.fillStyle = '#3a4362'; c.fillRect(x0, y0, d.w, 2); c.fillStyle = '#1a1f30'; c.fillRect(x0, y0 + d.h - 3, d.w, 3);
    for (let i = 8; i < d.w - 4; i += 16) { c.fillStyle = '#20263a'; c.fillRect(x0 + i, y0 + 3, 1, d.h - 6); }
    c.fillStyle = Math.floor(this.T * 3) % 2 ? '#ffd23f' : '#ff6b78'; c.fillRect(x0 + 2, y0 + 3, 2, 2); c.fillRect(x0 + d.w - 4, y0 + 3, 2, 2);
  },
  drawEnemy(c, e) {
    const A = this.A, big = e.type === 'gun' || e.type === 'heavy' || e.type === 'carrier' || e.type === 'rock' || e.type === 'turret', w = e.hit > 0 ? (big ? 'soft' : true) : false;
    const dir = (arr, ang) => arr[((Math.round(((ang - Math.PI / 2) / (Math.PI * 2)) * 16) % 16) + 16) % 16];
    switch (e.type) {
      case 'pop': this.sp(c, A.pop[Math.floor(this.T * 8 + e.id) % 2], e.x, e.y, w); break;
      case 'zako': this.sp(c, dir(A.zako, e.ang), e.x, e.y, w); break;
      case 'swoop': this.sp(c, dir(A.swoop, e.ang), e.x, e.y, w); break;
      case 'kami': {
        const s = dir(A.kami, e.dash ? Math.atan2(e.vy, e.vx) : Math.PI / 2 + Math.sin(this.T * 20) * (e.warn ? 0.4 : 0));
        if (e.warn) { c.globalCompositeOperation = 'lighter'; this.glow(c, A.glow.r, e.x, e.y, 0.8 + Math.sin(this.T * 30) * 0.3); c.globalCompositeOperation = 'source-over'; }
        this.sp(c, s, e.x, e.y, w || (e.warn && Math.floor(this.T * 16) % 2));
        break;
      }
      case 'mine': this.sp(c, A.mine[e.age > 6 ? Math.floor(this.T * 14) % 2 : Math.floor(this.T * 3) % 2], e.x, e.y, w); break;
      case 'rock': { const s = A.rock[e.id % 3]; this.rot(c, s, e.x, e.y, e.ang, w); break; }
      case 'pebble': { const s = A.pebble[e.id % 3]; this.rot(c, s, e.x, e.y, e.ang, w); break; }
      case 'gun': this.sp(c, A.gun, e.x, e.y, w); break;
      case 'carrier': this.sp(c, A.carrier, e.x, e.y, w); break;
      case 'heavy': this.sp(c, A.heavy, e.x, e.y, w); break;
      case 'turret': {
        this.sp(c, A.turretBase, e.x, e.y, w);
        const p = this.g.p, a = Math.atan2(p.y - e.y, p.x - e.x);
        c.fillStyle = '#0a0c18'; for (let k = 2; k <= 9; k++) c.fillRect(Math.round(e.x + Math.cos(a) * k) - 1, Math.round(e.y + Math.sin(a) * k) - 1, 3, 3);
        c.fillStyle = w ? '#fff' : '#97a6c7'; for (let k = 2; k <= 8; k++) c.fillRect(Math.round(e.x + Math.cos(a) * k), Math.round(e.y + Math.sin(a) * k), 1, 1);
        break;
      }
    }
  },
  rot(c, s, x, y, a, w) {   // 돌: 도트 그대로 살짝 돌려요 (8방향)
    const k = ((Math.round((a || 0) / (Math.PI / 4)) % 8) + 8) % 8;
    if (!s.rots) s.rots = [...Array(8)].map((_, i) => { const r = ShArt.rotate(s.c, (i * Math.PI) / 4); return { c: r, wh: ShArt.whiten(r) }; });
    const r = s.rots[k]; this.sp(c, r, x, y, w);
  },
  drawBoss(c, b) {
    const A = this.A, key = SH_BOSS_GFX[b.def.name], body = A.boss[key];
    const shakeX = b.dying > 0 ? (Math.random() - 0.5) * 3 : 0;
    if (body) this.sp(c, body, b.x + shakeX, b.y, b.flash > 0.2 && b.dying > 0);
    for (const p of b.parts) {
      if (p.core) {
        const open = !p.armor;
        const s = open ? (key === 'mother' || key === 'stinger' ? A.part.coreP : A.part.coreO) : A.part.coreC;
        if (open && !p.dead) { c.globalCompositeOperation = 'lighter'; this.glow(c, key === 'mother' || key === 'stinger' ? A.glow.p : A.glow.r, p.x, p.y, 0.9 + Math.sin(this.T * 6) * 0.15); c.globalCompositeOperation = 'source-over'; }
        if (!p.dead) this.sp(c, s, p.x + shakeX, p.y, p.hit > 0 ? 'soft' : false);
        continue;
      }
      if (p.dead) { c.fillStyle = 'rgba(10,8,14,.75)'; c.beginPath(); c.arc(p.x, p.y, p.r * 0.8, 0, 7); c.fill(); continue; }
      const s = A.part[SH_PART_GFX[p.pid]];
      if (s) this.sp(c, s, p.x + shakeX, p.y, p.hit > 0 ? 'soft' : false);
    }
  },
  drawShots(c) {
    const g = this.g, A = this.A;
    c.globalCompositeOperation = 'lighter';
    for (const s of g.shots) if (s.k === 'V') this.glow(c, A.glow.y, s.x, s.y, 0.6);
    c.globalCompositeOperation = 'source-over';
    for (const s of g.shots) if (s.k === 'V') this.img(c, s.src ? A.shotD : A.shotV, s.x, s.y);
    // 레이저: 같은 곳에서 나온 광선 조각을 이어서 굵은 빛줄기로
    const beams = {};
    for (const s of g.shots) if (s.k === 'L') (beams[s.src] || (beams[s.src] = [])).push(s);
    for (const k in beams) {
      const L = beams[k].sort((a, b) => b.y - a.y);
      for (let i = 0; i < L.length; i++) {
        const a = L[i], b = L[i + 1], top = b && a.y - b.y < 18 ? b : null, y0 = top ? top.y : a.y - 12, w = a.r;
        const fl = 0.75 + Math.sin(this.T * 50 + i) * 0.25;
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(41,170,255,${0.35 * fl})`; c.fillRect(a.x - w - 1.5, y0, (w + 1.5) * 2, a.y - y0 + 1);
        c.fillStyle = `rgba(120,220,255,${0.75 * fl})`; c.fillRect(a.x - w * 0.7, y0, w * 1.4, a.y - y0 + 1);
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#eaffff'; c.fillRect(a.x - Math.max(0.5, w * 0.3), y0, Math.max(1, w * 0.6), a.y - y0 + 1);
      }
    }
    for (const m of g.msl) {
      const d = A.missile[((Math.round(((m.a - Math.PI / 2) / (Math.PI * 2)) * 16) % 16) + 16) % 16];
      if (Math.random() < 0.7 && this.parts.length < 420) this.parts.push({ k: 'smoke', x: m.x - Math.cos(m.a) * 4, y: m.y - Math.sin(m.a) * 4, vx: 0, vy: 4, t: 0, life: 0.35, s: 0 });
      c.globalCompositeOperation = 'lighter'; this.glow(c, A.glow.r, m.x - Math.cos(m.a) * 3, m.y - Math.sin(m.a) * 3, 0.35); c.globalCompositeOperation = 'source-over';
      this.sp(c, d, m.x, m.y);
    }
  },
  drawPlayer(c) {
    const g = this.g, p = g.p, A = this.A;
    if (!p.alive) return;
    const blink = p.inv > 0 && Math.floor(this.T * 15) % 2 && g.bombT <= 0;
    // 드론
    for (const d of SCore.dronePos(g)) {
      this.img(c, A.flame[Math.floor(this.T * 20) % 3], d.x, d.y + 6);
      if (!blink) this.sp(c, A.drone, d.x, d.y);
    }
    // 엔진 불꽃
    const fl = A.flame[Math.floor(this.T * 24) % 3];
    c.globalCompositeOperation = 'lighter'; this.glow(c, A.glow.r, p.x, p.y + 10, 0.45 + Math.random() * 0.1); c.globalCompositeOperation = 'source-over';
    this.img(c, fl, p.x - 2.5, p.y + 11); this.img(c, fl, p.x + 2.5, p.y + 11);
    if (!blink) {
      const s = p.bank < -0.6 ? A.shipL[1] : p.bank < -0.22 ? A.shipL[0] : p.bank > 0.6 ? A.shipR[1] : p.bank > 0.22 ? A.shipR[0] : A.ship;
      this.sp(c, s, p.x, p.y);
      if (this.muzzle > 0 && p.weapon !== 'L') { c.globalCompositeOperation = 'lighter'; this.glow(c, A.glow.y, p.x, p.y - 11, 0.7); c.globalCompositeOperation = 'source-over'; }
    }
    // 맞는 곳 (가운데 작은 점)
    const near = p.focus || g.eb.some(b => Math.abs(b.x - p.x) < 26 && Math.abs(b.y - p.y) < 26);
    if (near) { c.fillStyle = '#ff4fa3'; c.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 1, 4, 3); c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 2, 3, 5); c.fillStyle = '#ffffff'; c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2); }
    if (p.shield) {
      c.globalCompositeOperation = 'lighter'; this.glow(c, A.glow.g, p.x, p.y, 1.2 + Math.sin(this.T * 6) * 0.08); c.globalCompositeOperation = 'source-over';
      c.strokeStyle = `rgba(125,255,176,${0.55 + Math.sin(this.T * 8) * 0.25})`; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, 14, 0, 7); c.stroke();
    }
  },
  drawFx(c) {
    const A = this.A;
    // 빛 번짐 (폭발 아래)
    c.globalCompositeOperation = 'lighter';
    for (const l of this.lights) { if (l.d > 0) continue; const k = 1 - l.t / l.life; c.globalAlpha = k * 0.8; const s = l.r * (1 + l.t * 2); c.drawImage(A.glow.big.c, l.x - s, l.y - s, s * 2, s * 2); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    for (const q of this.parts) {
      if (q.t < 0) continue;
      if (q.k === 'smoke') { c.globalAlpha = Math.max(0, 0.75 * (1 - q.t / q.life)); this.img(c, A.smoke[q.s], q.x, q.y); }
      else if (q.k === 'deb') { c.globalAlpha = 1; const d = A.debris[q.i]; this.img(c, d, q.x, q.y); }
    }
    c.globalAlpha = 1;
    for (const b of this.boomL) {
      if (b.t < 0) continue;
      const fr = A.boom[b.size], i = Math.min(fr.length - 1, Math.floor((b.t / 0.48) * fr.length));
      this.img(c, fr[i], b.x, b.y);
    }
    c.globalCompositeOperation = 'lighter';
    for (const q of this.parts) if (q.k === 'spark' && q.t >= 0) { c.fillStyle = q.col; c.globalAlpha = 1 - q.t / q.life; c.fillRect(Math.round(q.x * 2) / 2, Math.round(q.y * 2) / 2, 1.5, 1.5); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    for (const r of this.rings) {
      if (r.t < 0) continue;
      const k = r.t / r.life, rad = r.r * (0.2 + 0.8 * Math.sqrt(k));
      c.globalAlpha = 1 - k; c.strokeStyle = r.col; c.lineWidth = Math.max(0.5, 3 * (1 - k)); c.beginPath(); c.arc(r.x, r.y, rad, 0, 7); c.stroke();
    }
    c.globalAlpha = 1;
  },
  drawItem(c, it) {
    const A = this.A, g = this.g;
    if (it.k === 'star') { c.fillStyle = Math.floor(this.T * 20 + it.x) % 2 ? '#fff6b0' : '#ffd23f'; c.fillRect(Math.round(it.x) - 1, Math.round(it.y), 3, 1); c.fillRect(Math.round(it.x), Math.round(it.y) - 1, 1, 3); return; }
    if (it.k === 'm') {
      c.globalCompositeOperation = 'lighter'; this.glow(c, A.glow.y, it.x, it.y, 0.45); c.globalCompositeOperation = 'source-over';
      this.img(c, A.medal[Math.floor(this.T * 10 + it.ph * 3) % A.medal.length], it.x, it.y);
      return;
    }
    const k = it.k === 'W' ? SCore.WCYCLE[SCore.weaponAt(g, it)] : it.k;
    const img = A.items[k], bob = Math.sin(this.T * 5 + it.ph) * 1;
    const col = it.k === 'W' ? SCore.WEAPONS[k].color : SCore.ITEMS[it.k].color;
    c.globalCompositeOperation = 'lighter'; this.glow(c, k === 'L' ? A.glow.c : k === 'S' ? A.glow.g : k === 'D' ? A.glow.p : A.glow.y, it.x, it.y + bob, 0.7 + Math.sin(this.T * 8) * 0.1); c.globalCompositeOperation = 'source-over';
    this.img(c, img, it.x, it.y + bob);
    // 이름표 (한글)
    const name = it.k === 'W' ? SCore.WEAPONS[k].name : SCore.ITEMS[it.k].name;
    c.font = '7px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tw = c.measureText(name).width + 6, ty = it.y + bob + 13;
    c.fillStyle = 'rgba(6,8,20,.85)'; c.fillRect(Math.round(it.x - tw / 2), Math.round(ty - 4.5), Math.round(tw), 9);
    c.fillStyle = col; c.fillText(name, it.x, ty + 0.5);
    if (it.k === 'W') {   // 바뀌는 무기: 다음 색까지 남은 시간 막대
      const q = ((it.t + it.ph) / 1.5) % 1;
      c.fillStyle = col; c.fillRect(Math.round(it.x - 8), Math.round(ty + 5), Math.round(16 * (1 - q)), 1);
    }
  },
  drawBullets(c) {
    const g = this.g, A = this.A;
    c.globalCompositeOperation = 'lighter';
    for (const b of g.eb) { const gl = b.kind === 'n' ? A.glow.c : b.kind === 'O' ? A.glow.r : b.kind === 's' ? A.glow.p : A.glow.o; this.glow(c, gl, b.x, b.y, b.kind === 'B' ? 1.1 : b.kind === 'O' ? 0.6 : 0.42); }
    c.globalCompositeOperation = 'source-over';
    for (const b of g.eb) {
      if (b.kind === 'n') { const d = A.needle[((Math.round(((Math.atan2(b.vy, b.vx) - Math.PI / 2) / (Math.PI * 2)) * 16) % 16) + 16) % 16]; this.sp(c, d, b.x, b.y); }
      else this.img(c, A.bul[b.kind] || A.bul.o, b.x, b.y);
    }
  },
  drawHazards(c) {
    const g = this.g;
    for (const h of g.hz) {
      if (h.warn > 0) {
        const on = Math.floor(this.T * 14) % 2;
        c.fillStyle = on ? 'rgba(255,80,110,.85)' : 'rgba(255,80,110,.35)'; c.fillRect(Math.round(h.x) - 0.5, h.y0, 1, SHH - h.y0);
        c.fillStyle = 'rgba(255,80,110,.12)'; c.fillRect(h.x - h.w / 2, h.y0, h.w, SHH - h.y0);
        c.fillStyle = on ? '#ff6b78' : '#ffd23f'; c.fillRect(Math.round(h.x - h.w / 2), h.y0, 1, SHH); c.fillRect(Math.round(h.x + h.w / 2), h.y0, 1, SHH);
      } else {
        const fl = 0.8 + Math.random() * 0.2, w = h.w * (h.on > 0.6 ? (0.75 - h.on) * 6 + 0.3 : 1);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(80,180,255,${0.4 * fl})`; c.fillRect(h.x - w / 2 - 3, h.y0, w + 6, SHH);
        c.fillStyle = `rgba(160,230,255,${0.85 * fl})`; c.fillRect(h.x - w / 2, h.y0, w, SHH);
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#ffffff'; c.fillRect(h.x - w / 4, h.y0, w / 2, SHH);
      }
    }
  },
  drawTexts(c) {
    for (const t of this.texts) {
      const k = t.t / t.life, y = t.y - t.t * 18;
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      if (t.kr) c.font = `${8 * t.s}px "Black Han Sans", sans-serif`;
      if (t.w == null) t.w = t.kr ? c.measureText(t.txt).width + 3 : (t.txt.length * 6 - 1) * t.s;
      const x = Math.max(t.w / 2 + 2, Math.min(SHW - t.w / 2 - 2, t.x));   // 판 가장자리에서도 글자가 잘리지 않게
      if (t.kr) { c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 2.5; c.strokeStyle = '#0a0c18'; c.strokeText(t.txt, x, y); c.fillStyle = t.col; c.fillText(t.txt, x, y); }
      else ShArt.text(c, t.txt, x, y - 3 * t.s, t.col, t.s, 0.5);
    }
    c.globalAlpha = 1;
  },
  drawHud(c) {
    const g = this.g, p = g.p, A = this.A;
    // 왼쪽 아래: 목숨 · 폭탄
    for (let i = 0; i < Math.min(5, p.lives - 1); i++) c.drawImage(A.ship.c, 4 + i * 11, SHH - 26, 10, 10);   // 남은 비행기 (지금 타는 것 빼고)
    for (let i = 0; i < p.bombs; i++) c.drawImage(A.items.B, 4 + i * 10, SHH - 14, 10, 10);
    // 오른쪽 아래: 무기 · 파워
    const W = SCore.WEAPONS[p.weapon];
    c.drawImage(A.items[p.weapon], SHW - 64, SHH - 22, 12, 12);
    c.font = '8px "Black Han Sans", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.lineWidth = 2.5; c.strokeStyle = '#0a0c18'; c.strokeText(W.name, SHW - 50, SHH - 19); c.fillStyle = W.color; c.fillText(W.name, SHW - 50, SHH - 19);
    for (let i = 0; i < 5; i++) { c.fillStyle = '#0a0c18'; c.fillRect(SHW - 51 + i * 9, SHH - 12, 8, 5); c.fillStyle = i < p.power ? W.color : '#2a3048'; c.fillRect(SHW - 50 + i * 9, SHH - 11, 6, 3); }
    if (p.power >= 5) ShArt.text(c, 'MAX', SHW - 6, SHH - 22, '#fff6b0', 1, 1);
    for (let i = 0; i < p.drones; i++) c.drawImage(A.drone.c, SHW - 76 - i * 9, SHH - 13, 8, 8);
    // 아래 가운데: 다음 메달 값
    const mv = SCore.MEDAL_V[g.mi], ms = shFmt(mv).replace(/,/g, ''), mw = ms.length * 6 + 10;
    c.drawImage(A.medal[0], Math.round(SHW / 2 - mw / 2), SHH - 13, 8, 9);
    ShArt.text(c, ms, SHW / 2 - mw / 2 + 11, SHH - 11, g.mi >= SCore.MEDAL_V.length - 1 ? '#fff6b0' : '#ffd23f');
    // 오른쪽 위: 연속 격추 (보스 막대가 있으면 그 아래)
    if (this.chainShow > 0 && g.chain >= 3) {
      c.globalAlpha = Math.min(1, this.chainShow * 2);
      ShArt.text(c, `${g.chain} CHAIN`, SHW - 4, g.boss ? 26 : 5, g.chain >= 30 ? '#ff6b78' : g.chain >= 15 ? '#ffb347' : '#ffffff', 1, 1);
      c.globalAlpha = 1;
    }
    if (this.extendT > 0 && Math.floor(this.T * 8) % 2) ShArt.text(c, '1UP!', 4, SHH - 38, '#7dffb0');
    // 보스 체력
    const b = g.boss;
    if (b && !b.leaving) {
      const tot = b.parts.reduce((a, q) => a + Math.max(0, q.dead ? 0 : q.hp), 0), max = b.parts.reduce((a, q) => a + q.max, 0);
      const k = b.enter > 0 ? 1 - b.enter / 2.6 : 1;
      const bx = 46, bw = SHW - 92, kk = Math.min(k, tot / max);
      c.fillStyle = '#0a0c18'; c.fillRect(bx - 1, 5, bw + 2, 7);
      c.fillStyle = '#3a1020'; c.fillRect(bx, 6, bw, 5);
      c.fillStyle = b.dying > 0 ? '#ffffff' : '#ff4f6e'; c.fillRect(bx, 6, Math.round(bw * kk), 5);
      c.fillStyle = '#ffb3c0'; c.fillRect(bx, 6, Math.round(bw * kk), 1);
      c.font = '7px "Black Han Sans", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.lineWidth = 2; c.strokeStyle = '#0a0c18';
      c.strokeText(b.def.name, bx - 4, 9); c.fillStyle = '#ffd9df'; c.fillText(b.def.name, bx - 4, 9);
      if (!b.mid) { const left = Math.max(0, Math.ceil(b.timer)); ShArt.text(c, String(left), SHW - 4, 6, left < 20 ? '#ff6b78' : '#9aa6c7', 1, 1); }
    }
  },
  drawBanner(c) {
    const B = this.banner, g = this.g;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (B && B.kind === 'stage') {
      const t = B.t, a = t < 0.25 ? t / 0.25 : t > B.life - 0.4 ? (B.life - t) / 0.4 : 1, slide = t < 0.3 ? (0.3 - t) * 200 : 0;
      c.globalAlpha = a * 0.55; c.fillStyle = '#05060f'; c.fillRect(0, 96, SHW, 58); c.globalAlpha = a;
      c.fillStyle = '#ffd23f'; c.fillRect(0, 96, SHW, 1); c.fillRect(0, 153, SHW, 1);
      if (B.loop) ShArt.text(c, `LOOP ${B.loop + 1}`, SHW / 2 + slide, 101, '#ff6b78', 1, 0.5);
      ShArt.text(c, `STAGE ${B.n}`, SHW / 2 - slide, 110, '#ffffff', 3, 0.5);
      c.font = '11px "Black Han Sans", sans-serif'; c.lineWidth = 3; c.strokeStyle = '#05060f'; c.strokeText(B.name, SHW / 2 + slide, 142); c.fillStyle = '#ffd9a0'; c.fillText(B.name, SHW / 2 + slide, 142);
      c.globalAlpha = 1;
      if (t > 1.2 && t < 2.6 && Math.floor(t * 4) % 2) ShArt.text(c, 'READY', SHW / 2, 170, '#7dffb0', 1, 0.5);
    }
    if (B && B.kind === 'warn') {
      const t = B.t, on = Math.floor(t * 4) % 2 === 0;
      c.globalAlpha = Math.min(1, t * 3, (B.life - t) * 3);
      c.fillStyle = 'rgba(120,0,20,.45)'; c.fillRect(0, 104, SHW, 50);
      for (const y of [100, 154]) { c.fillStyle = '#ff2a4a'; c.fillRect(0, y, SHW, 4); c.fillStyle = '#0a0c18'; for (let x = -16 + ((t * 60) % 16); x < SHW; x += 16) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y); c.lineTo(x + 10, y + 4); c.lineTo(x + 4, y + 4); c.fill(); } }
      if (on) ShArt.text(c, 'WARNING!!', SHW / 2, 112, '#ff3a5a', 3, 0.5);
      c.font = '9px "Black Han Sans", sans-serif'; c.lineWidth = 3; c.strokeStyle = '#1a0008'; c.strokeText(`거대 적 「${B.name}」 접근 중`, SHW / 2, 144); c.fillStyle = '#ffd9df'; c.fillText(`거대 적 「${B.name}」 접근 중`, SHW / 2, 144);
      c.globalAlpha = 1;
    }
    if (B && B.kind === 'say') {
      const a = Math.min(1, B.t * 4, (B.life - B.t) * 3), y = B.small ? 190 : 128;
      c.globalAlpha = a;
      if (B.en) ShArt.text(c, B.en, SHW / 2, y - 14, B.col, 2, 0.5);
      if (B.kr) { c.font = `${B.small ? 8 : 10}px "Black Han Sans", sans-serif`; c.lineWidth = 3; c.strokeStyle = '#05060f'; c.strokeText(B.kr, SHW / 2, y + 6); c.fillStyle = '#ffffff'; c.fillText(B.kr, SHW / 2, y + 6); }
      c.globalAlpha = 1;
    }
    // 스테이지 끝 점수표
    const T = this.tally;
    if (T && g.phase === 'clear') {
      const t = T.t;
      c.globalAlpha = Math.min(1, t * 3) * 0.7; c.fillStyle = '#05060f'; c.fillRect(20, 70, SHW - 40, 150); c.globalAlpha = Math.min(1, t * 3);
      c.strokeStyle = '#ffd23f'; c.lineWidth = 1; c.strokeRect(20.5, 70.5, SHW - 41, 149);
      ShArt.text(c, T.all ? 'ALL CLEAR!!' : 'STAGE CLEAR', SHW / 2, 80, T.all ? '#7dffb0' : '#ffd23f', 2, 0.5);
      c.font = '9px "Black Han Sans", sans-serif'; c.textBaseline = 'middle';
      T.rows.forEach(([label, v], i) => {
        if (t < 0.5 + i * 0.35) return;
        const y = 112 + i * 18;
        c.textAlign = 'left'; c.fillStyle = '#d6deef'; c.fillText(label, 34, y);
        ShArt.text(c, '+' + shFmt(v), SHW - 34, y - 3, v ? '#ffffff' : '#56617f', 1, 1);
      });
      if (t > 0.6 + T.rows.length * 0.35) {
        const y = 112 + T.rows.length * 18 + 6;
        c.fillStyle = '#ffd23f'; c.fillRect(34, y - 7, SHW - 68, 1);
        c.textAlign = 'left'; c.fillStyle = '#ffd23f'; c.fillText('보너스 합계', 34, y + 4);
        ShArt.text(c, '+' + shFmt(T.total), SHW - 34, y + 1, '#ffd23f', 1, 1);
      }
      c.globalAlpha = 1;
    }
    // 이어하기
    if (g.phase === 'over') {
      const t = g.phaseT;
      if (t > 0.8) { c.globalAlpha = Math.min(1, (t - 0.8) * 2); ShArt.text(c, 'GAME OVER', SHW / 2, 100, '#ff6b78', 3, 0.5); c.globalAlpha = 1; }
      if (t > 1.7 && !this.ended) {
        const n = Math.max(0, 9 - Math.floor(this.contT));
        c.fillStyle = 'rgba(5,6,15,.6)'; c.fillRect(30, 136, SHW - 60, 92);
        ShArt.text(c, 'CONTINUE?', SHW / 2, 144, '#ffffff', 2, 0.5);
        ShArt.text(c, String(n), SHW / 2, 164, n <= 3 ? '#ff6b78' : '#ffd23f', 4, 0.5);
        c.font = '8px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#d6deef';
        c.fillText(TOUCH ? '화면을 누르면 이어서 해요' : '클릭 · 스페이스 · 엔터로 이어서 해요', SHW / 2, 204);
        c.fillStyle = '#9aa6c7'; c.fillText(`점수는 0부터 · 지금까지 최고 ${shFmt(g.best)}`, SHW / 2, 217);
      }
    }
  },
  drawOverlay(c) {
    const R = this.R;
    if (this.flash > 0) { c.globalAlpha = Math.min(0.85, this.flash); c.fillStyle = this.flashCol; c.fillRect(0, 0, SHW, SHH); c.globalAlpha = 1; }
    if (this.red > 0) { c.globalAlpha = this.red * 0.45; c.fillStyle = '#ff2040'; c.fillRect(0, 0, SHW, SHH); c.globalAlpha = 1; }
    if (this.warnT > 0 && Math.floor(this.warnT * 4) % 2) { c.globalAlpha = 0.12; c.fillStyle = '#ff0030'; c.fillRect(0, 0, SHW, SHH); c.globalAlpha = 1; }
    // 화면 가장자리 어둡게 + 주사선 (오락실 화면 느낌 · 아주 살짝)
    if (!this.vig) {
      const v = document.createElement('canvas'); v.width = SHW; v.height = SHH; const x = v.getContext('2d');
      const gr = x.createRadialGradient(SHW / 2, SHH / 2, SHH * 0.35, SHW / 2, SHH / 2, SHH * 0.78); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.42)');
      x.fillStyle = gr; x.fillRect(0, 0, SHW, SHH); this.vig = v;
      const s = document.createElement('canvas'); s.width = 4; s.height = R; const sx = s.getContext('2d'); sx.fillStyle = 'rgba(0,0,0,.16)'; sx.fillRect(0, R - 1, 4, 1); this.scan = s;
    }
    c.drawImage(this.vig, 0, 0);
    if (R >= 3) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = c.createPattern(this.scan, 'repeat'); c.fillRect(0, 0, SHW * R, SHH * R); c.setTransform(R, 0, 0, R, 0, 0); }
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
      if (!g) return;
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
    if (e.target instanceof Element && e.target.closest('button, .game-head, .topbar, .overlay, .modal')) return;
    Shooter.bomb();
  }, true);
  // 마우스: 판 위에서 움직이면 따라와요
  cv.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const q = toGame(e.clientX, e.clientY); Shooter.mouse = { x: q.x, y: q.y }; });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') Shooter.mouse = null; });
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && Shooter.g && Shooter.g.phase === 'over') Shooter.cont(); });
  // 폭탄 버튼: 누르는 순간 (다른 손가락으로 끄는 중이어도)
  const bb = $('#sh-bomb');
  bb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Shooter.bomb(); bb.classList.add('hit'); setTimeout(() => bb.classList.remove('hit'), 160); });
  bb.addEventListener('click', e => e.preventDefault());
})();
ACT.shBgm = () => { if (typeof ShAudio === 'undefined') return; ShAudio.music.on = !ShAudio.music.on; if (ShAudio.music.on && Shooter.g && !Shooter.over) ShAudio.music.play(Shooter.g.boss && !Shooter.g.boss.mid ? 'boss' : 'stage'); Shooter.paintBgm(); };
register('shooter', {
  solo: () => Shooter.start(),
  stop: () => { Shooter.over = true; Shooter.drag = null; if (typeof ShAudio !== 'undefined') ShAudio.music.stop(0.3); },
  key: e => {
    const g = Shooter.g; if (!g) return;
    if (g.phase === 'over' && ['Space', 'Enter', 'KeyX', 'KeyZ', 'KeyB'].includes(e.code) && !e.repeat) { if (e.preventDefault) e.preventDefault(); Shooter.cont(); return; }
    if (['KeyX', 'KeyB', 'Space'].includes(e.code) && !e.repeat) { if (e.preventDefault) e.preventDefault(); Shooter.bomb(); }
  },
});
