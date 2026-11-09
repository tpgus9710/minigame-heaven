/* =====================================================================
 *  🕹️ 터치 조이스틱 패드 — 휴대폰 · 태블릿에서 작은 버튼 대신 엄지로 미는 조이스틱 (점프 어드벤처 · 총알피하기 · 점프 배구 · 폭탄 배틀)
 *   register('게임', { stick: { x, y, run, analog, full, hint, act: { code, label, icon, hint } } })
 *     x / y   좌우 · 위아래로 밀면 방향키(ArrowLeft·Right / ArrowUp·Down)를 누른 것과 같아요 → 게임은 그대로 held() 로 읽어요
 *             (값 대신 함수를 넣으면 그때그때 물어봐요: 총알피하기 대나무 모드는 좌우만)
 *     run     끝까지 밀면 이 키도 같이 (점프 어드벤처: 달리기)
 *     four    4방향만: 더 크게 민 쪽 하나만 눌러요 (폭탄 배틀처럼 칸을 따라 걷는 게임 · 대각선으로 밀어도 흔들리지 않게)
 *     analog  방향키 대신 Stick.vec() 로 방향 · 세기를 읽어요 (총알피하기: 살짝 밀면 천천히)
 *     full    오른쪽 버튼 없이 조이스틱만 (세로 화면: 아래 전체가 조이스틱 자리 · 가로 화면: 양옆 어느 쪽이든)
 *     act     오른쪽 버튼 — 오른쪽 자리 어디를 눌러도 그 버튼이에요 (점프 · 스파이크). 길게 누르면 계속 누른 것
 *   - 조이스틱은 엄지를 댄 자리에 생겨요(떠 있는 조이스틱). 멀리 밀면 받침이 따라와요.
 *   - 키보드는 그대로: 실제로 누른 키는 따로 기억해서, 조이스틱을 놓아도 그 키는 놓지 않아요 (태블릿 + 키보드)
 *     키보드로 조작하기 시작하면 조이스틱을 숨기고(게임판이 커져요), 화면을 다시 터치하면 나와요.
 *   - 자리: core.js 가상 패드(#vpad) 안에 그려요 → 화면 맞춤(Fit)이 세로는 아래 띠 · 가로는 양옆을 비워 줘요.
 *     세로 화면은 띠 위쪽 빈 곳(게임판 아래)까지 손이 닿는 곳은 모두 조작 자리예요.
 * ===================================================================== */
const Stick = {
  g: null, key: null, cfg: null, st: null, added: new Set(), phys: new Set(), act: new Set(), R: 46, homes: [], raf: 0, tick: null,
  usedKeys: new Set(), kbd: false, kbdTold: false,
  TH: 0.32, TH_OFF: 0.24, THY: 0.5, THY_OFF: 0.4, DEAD: 0.12,
  /** 설정 값 (함수면 지금 값) */
  opt(k) { const v = this.cfg && this.cfg[k]; return typeof v === 'function' ? v() : v; },
  /** 이 게임 화면에서 조이스틱 패드 켜기 (core.js updatePad · 화면에 들어올 때마다) */
  on(g, key) {
    this.reset();
    this.g = g; this.key = key; this.cfg = g.stick;
    const c = this.cfg, a = Array.isArray(c.act) ? c.act[0] : c.act, ys = !!this.opt('y');
    const zone = cls => `<div class="${cls} stk-zone"><div class="stk-joy idle"><i class="stk-base"><s class="l"></s><s class="r"></s>${ys ? '<s class="u"></s><s class="d"></s>' : ''}</i>
      <i class="stk-knob"></i><span class="stk-hint">${this.hintHTML(this.opt('hint') || '엄지로 밀어서 이동')}</span></div></div>`;
    const right = a
      ? `<div class="pad-r stk-act" data-stk="${a.code}" aria-label="${esc(a.label)}"><b class="stk-btn">${a.icon ? icon(a.icon) : ''}<small>${esc(a.label)}</small><span class="stk-hint">${this.hintHTML(a.hint || `오른쪽 어디든 ${a.label}`)}</span></b></div>`
      : c.full ? zone('pad-r') : '<div class="pad-r"></div>';
    padEl.innerHTML = zone('pad-l') + right;
    padEl.className = 'stick' + (c.full && !a ? ' full' : '') + (this.usedKeys.has(key) ? ' stk-used' : '') + (this.kbd ? ' hidden' : '');
    padEl.querySelectorAll('.stk-zone').forEach(z => {
      z.addEventListener('pointerdown', e => this.down(e, z));
      z.addEventListener('pointermove', e => this.move(e));
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) z.addEventListener(t, e => this.up(e));
    });
    const act = padEl.querySelector('.stk-act');
    if (act) {
      act.addEventListener('pointerdown', e => this.actDown(e, act));
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) act.addEventListener(t, e => this.actUp(e, act));
    }
    this.layout();
    clearInterval(this.tick); this.tick = setInterval(() => this.layout(), 500);   // 화면 맞춤이 끝난 뒤 게임판 아래 빈 곳까지 자리를 넓혀요
  },
  off() {
    if (!this.g) return;
    this.reset();
    clearInterval(this.tick); this.tick = null;
    this.g = null; this.key = null; this.cfg = null;
    padEl.classList.remove('stick', 'full', 'stk-used');
  },
  /** 화면 크기 · 방향에 맞게: 세로 = 아래 띠(+ 게임판 아래 빈 곳) · 가로 = 양옆 */
  layout() {
    if (!this.g || !padEl.classList.contains('stick') || padEl.classList.contains('hidden')) return;
    const W = innerWidth, H = innerHeight, side = document.body.classList.contains('pad-side');
    const s = clamp(Math.min(W, H) / 390, 1, 1.3), strip = Math.round(clamp(H * 0.17, 124, 176));
    this.R = Math.round(46 * s);
    const set = (k, v) => { if (padEl.style.getPropertyValue(k) !== v) padEl.style.setProperty(k, v); };
    set('--stk-s', s.toFixed(3)); set('--stk-r', this.R + 'px');
    set('--stk-h', strip + 'px');
    set('--stk-w', Math.round(clamp(this.R * 2 + 30, 128, 180)) + 'px');      // 가로 화면 양옆 폭: 조이스틱 받침이 들어갈 만큼만 (게임판을 넓게)
    const sec = document.querySelector('.screen.active');
    if (side) {
      const head = sec && sec.querySelector('.game-head');
      set('--stk-top', Math.round(head ? Math.max(0, head.getBoundingClientRect().bottom + 6) : 56) + 'px');
    } else {
      // 게임판(가장 큰 캔버스) 아래 빈 곳까지 엄지 자리로 넓혀요 (게임판은 가리지 않아요)
      const cv = sec && [...sec.querySelectorAll('canvas')].filter(c => c.offsetParent && c.offsetHeight > 80).sort((a, b) => b.offsetHeight - a.offsetHeight)[0];
      const top = H - strip, below = cv ? cv.getBoundingClientRect().bottom + 10 : top;
      set('--stk-up', Math.round(clamp(top - below, 0, H * 0.45)) + 'px');
    }
    // 엄지를 아직 안 댔을 때 조이스틱 · 버튼이 보이는 자리 (세로: 아래 띠 가운데 · 가로: 양옆 아래쪽)
    const safe = Math.max(0, padEl.getBoundingClientRect().height - strip);
    const home = z => {
      const r = z.getBoundingClientRect(), right = z.classList.contains('pad-r'), m = this.R + 14;
      if (side) return { x: r.width / 2, y: r.height * 0.62 };
      const f = padEl.classList.contains('full') ? 0.5 : right ? 0.6 : 0.4;
      return { x: clamp(r.width * f, m, Math.max(m, r.width - m)), y: r.height - safe - strip / 2 };
    };
    this.homes = [...padEl.querySelectorAll('.stk-zone')].map(home);
    const act = padEl.querySelector('.stk-act');
    if (act) { const h = home(act), b = act.querySelector('.stk-btn'); b.style.transform = `translate(${Math.round(h.x)}px, ${Math.round(h.y)}px)`; }
    if (!this.st) { this.draw(); this.fitHints(); }
  },
  used() { this.usedKeys.add(this.key); padEl.classList.add('stk-used'); },
  hintHTML(t) { const [a, ...b] = String(t).split(' · '); return esc(a) + (b.length ? `<small>${esc(b.join(' · '))}</small>` : ''); },
  /** 안내 글이 화면 밖으로 나가지 않게 옆으로 밀어요 */
  fitHints() {
    if (padEl.classList.contains('stk-used')) return;
    padEl.querySelectorAll('.stk-hint').forEach(h => {
      h.style.setProperty('--hx', '0px');
      const r = h.getBoundingClientRect(); if (!r.width) return;
      const dx = Math.max(0, 6 - r.left) + Math.min(0, innerWidth - 6 - r.right);
      if (dx) h.style.setProperty('--hx', Math.round(dx) + 'px');
    });
  },
  /** 누르는 동안: 실제 키를 떼도(태블릿 + 키보드) 조이스틱 · 버튼으로 누른 건 그대로 */
  keep() {
    if (this.raf) return;
    const loop = () => {
      if (!this.st && !this.act.size) { this.raf = 0; return; }
      for (const c of this.added) Keys.add(c);
      const el = this.act.size && padEl.querySelector('.stk-act'); if (el) Keys.add(el.dataset.stk);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  /* ─── 조이스틱 ─── */
  down(e, z) {
    if (this.st) return;
    e.preventDefault();
    const r = z.getBoundingClientRect(), m = this.R * 0.6;
    const x = clamp(e.clientX - r.left, m, r.width - m), y = clamp(e.clientY - r.top, m, r.height - m);
    this.st = { id: e.pointerId, z, r, bx: x, by: y, x: e.clientX - r.left, y: e.clientY - r.top };
    try { z.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    this.used();
    this.update(); this.draw(); this.keep();
  },
  move(e) {
    const s = this.st; if (!s || e.pointerId !== s.id) return;
    e.preventDefault();
    s.x = e.clientX - s.r.left; s.y = e.clientY - s.r.top;
    const dx = s.x - s.bx, dy = s.y - s.by, R = this.R;
    if (this.opt('y')) { const d = Math.hypot(dx, dy); if (d > R) { const k = (d - R) / d; s.bx += dx * k; s.by += dy * k; } }   // 손가락이 받침 밖으로 나가면 받침이 따라와요
    else if (Math.abs(dx) > R) s.bx += dx - Math.sign(dx) * R;                    // 좌우만 쓰는 게임: 위아래로 미끄러져도 상관없어요
    this.update(); this.draw();
  },
  up(e) {
    const s = this.st; if (!s || e.pointerId !== s.id) return;
    this.st = null;
    this.update(); this.draw();
  },
  /** 방향 · 세기 (-1 ~ 1, 가운데 조금은 0) · 안 잡았으면 null */
  vec() {
    const s = this.st; if (!s) return null;
    let x = (s.x - s.bx) / this.R, y = this.opt('y') ? (s.y - s.by) / this.R : 0;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    const mm = Math.min(1, m);
    if (mm < this.DEAD) return { x: 0, y: 0, m: 0 };
    const k = (mm - this.DEAD) / (1 - this.DEAD) / mm;                      // 가운데 조금은 멈춤, 끝까지 밀면 최대
    return { x: x * k, y: y * k, m: (mm - this.DEAD) / (1 - this.DEAD) };
  },
  /** 조이스틱 → 방향키 (게임 코드는 키보드와 똑같이 held() 로 읽어요) */
  update() {
    const c = this.cfg; if (!c) return;
    const want = new Set(), v = this.vec();
    if (v && !this.opt('analog')) {
      const on = code => this.added.has(code);
      if (this.opt('four')) {                                                  // 4방향: 더 크게 민 쪽 하나 (지금 가는 쪽은 1.3배 더 밀어야 바뀌어요)
        const ax = Math.abs(v.x), ay = Math.abs(v.y);
        const curH = on('ArrowLeft') || on('ArrowRight'), curV = on('ArrowUp') || on('ArrowDown');
        const horiz = curH ? ay <= ax * 1.3 : curV ? ax > ay * 1.3 : ax >= ay;
        if (Math.max(ax, ay) > (curH || curV ? this.TH_OFF : this.TH)) want.add(horiz ? (v.x < 0 ? 'ArrowLeft' : 'ArrowRight') : (v.y < 0 ? 'ArrowUp' : 'ArrowDown'));
      } else if (this.opt('x') !== false) {
        if (v.x < -(on('ArrowLeft') ? this.TH_OFF : this.TH)) want.add('ArrowLeft');
        else if (v.x > (on('ArrowRight') ? this.TH_OFF : this.TH)) want.add('ArrowRight');
      }
      if (this.opt('y') && !this.opt('four')) {
        if (v.y < -(on('ArrowUp') ? this.THY_OFF : this.THY)) want.add('ArrowUp');
        else if (v.y > (on('ArrowDown') ? this.THY_OFF : this.THY)) want.add('ArrowDown');
      }
      const run = this.opt('run');
      if (run && (this.opt('y') ? v.m : Math.abs(v.x)) > (on(run) ? 0.8 : 0.9)) want.add(run);   // 끝까지 밀면 달리기
    }
    for (const code of [...this.added]) if (!want.has(code)) this.vk(code, false);
    for (const code of want) if (!this.added.has(code)) this.vk(code, true);
    const joy = this.st && this.st.z.querySelector('.stk-joy'), run = this.opt('run');
    if (joy) joy.classList.toggle('run', !!(run && this.added.has(run)));
  },
  vk(code, down) {
    const g = this.g;
    if (down) { this.added.add(code); Keys.add(code); if (g && g.key) g.key(fakeKey(code)); }
    else { this.added.delete(code); if (!this.phys.has(code)) Keys.delete(code); if (g && g.keyup) g.keyup(fakeKey(code)); }
  },
  draw() {
    const ys = !!this.opt('y');
    padEl.querySelectorAll('.stk-zone').forEach((z, i) => {
      const joy = z.querySelector('.stk-joy'), knob = z.querySelector('.stk-knob'); if (!joy) return;
      const s = this.st && this.st.z === z ? this.st : null, h = this.homes[i] || { x: 60, y: 60 };
      joy.style.transform = `translate(${Math.round(s ? s.bx : h.x)}px, ${Math.round(s ? s.by : h.y)}px)`;
      let kx = 0, ky = 0;
      if (s) {
        const dx = s.x - s.bx, dy = ys ? s.y - s.by : 0, d = Math.hypot(dx, dy), f = d > this.R ? this.R / d : 1;
        kx = dx * f; ky = dy * f;
      }
      knob.style.transform = `translate(${Math.round(kx)}px, ${Math.round(ky)}px)`;
      joy.classList.toggle('idle', !s);
      joy.classList.toggle('dim', !!this.st && !s);                         // 다른 쪽 조이스틱을 쓰는 중이면 흐리게 (가로 화면 full)
      if (!s) joy.classList.remove('run');
    });
  },
  /* ─── 오른쪽 버튼 자리 (점프 · 스파이크): 손가락 여러 개여도 마지막 손가락을 뗄 때 놓아요 ─── */
  actDown(e, el) {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const code = el.dataset.stk, first = !this.act.size;
    this.act.add(e.pointerId);
    el.classList.add('on'); this.used();
    if (first) Keys.add(code);
    const g = this.g; if (g && g.key) g.key(fakeKey(code));                    // 누를 때마다 새로 누른 것 (점프 미리 누르기 · 스파이크)
    this.keep();
  },
  actUp(e, el) {
    if (!this.act.delete(e.pointerId) || this.act.size) return;
    this.actRelease(el);
  },
  actRelease(el) {
    el = el || padEl.querySelector('.stk-act'); if (!el) return;
    el.classList.remove('on');
    const code = el.dataset.stk;
    if (!this.phys.has(code)) Keys.delete(code);
    const g = this.g; if (g && g.keyup) g.keyup(fakeKey(code));
  },
  /** 누르던 것 모두 놓기 (화면을 나가거나 앱을 내렸을 때) */
  reset() {
    this.st = null; cancelAnimationFrame(this.raf); this.raf = 0;
    for (const code of [...this.added]) this.vk(code, false);
    if (this.act.size) { this.act.clear(); this.actRelease(); }
    if (this.g) this.draw();
  },
  /* ─── 키보드를 연결해서 쓰면 조이스틱은 숨겨요 (화면을 터치하면 다시) ─── */
  kbdOn() {
    if (this.kbd || !this.g) return;
    this.kbd = true;
    this.reset(); padEl.classList.add('hidden');
    if (typeof Fit !== 'undefined') Fit.schedule();
    if (!this.kbdTold) { this.kbdTold = true; toast('⌨️ 키보드로 조작해요 — 화면을 터치하면 조이스틱이 다시 나와요', 'info'); }
  },
  kbdOff() {
    if (!this.kbd) return;
    this.kbd = false;
    if (!this.g) return;
    padEl.classList.remove('hidden'); this.layout();
    if (typeof Fit !== 'undefined') Fit.schedule();
  },
};
/* 실제 키보드로 누른 키 (조이스틱을 놓을 때 이 키는 놓지 않아요) · 게임 키를 누르면 키보드 모드 */
const STK_KEYS = /^(Arrow(Left|Right|Up|Down)|Key[WASDXZ]|Space|Shift(Left|Right)|Enter)$/;
document.addEventListener('keydown', e => {
  Stick.phys.add(e.code);
  if (Stick.g && STK_KEYS.test(e.code) && !typing()) Stick.kbdOn();
}, true);
document.addEventListener('keyup', e => Stick.phys.delete(e.code), true);
document.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && Stick.kbd) Stick.kbdOff(); }, true);
padEl.addEventListener('contextmenu', e => { if (padEl.classList.contains('stick')) e.preventDefault(); });
addEventListener('blur', () => { Stick.phys.clear(); Stick.reset(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) Stick.reset(); });
addEventListener('resize', () => { if (Stick.g) { Stick.layout(); setTimeout(() => Stick.layout(), 300); } });
