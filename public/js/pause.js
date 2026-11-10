/* =====================================================================
 *  ⏸ 일시정지 · 🙈 위장 화면 · 📚 수업 모드 (v13.2)
 *
 *  ⏸ 일시정지 (싱글 게임): 제목 줄 ⏸ 버튼 · Esc · 다른 앱/탭으로 가면 자동
 *     - 게임 화면을 통째로 가려요(블라인드: 판 · 카드 · 문양이 안 보여요) → 멈춘 동안 판을 보고 생각할 수 없어요
 *     - 시간도 멈춰요: performance.now · requestAnimationFrame 시각 · after/every 타이머를 멈춰 두었다가 이어서
 *       (싱글 게임의 시간 · 기록은 모두 이 시계로 재요 — 사과 · 1 to 50 · 지뢰찾기 · 스도쿠 · 노노그램은 v13.2 에서 바꿨어요)
 *     - 다시 시작: 「계속하기」(액션 게임은 3 · 2 · 1 뒤에)
 *  🙈 위장 화면: ` 키(숫자 1 왼쪽) · 🙈 버튼 · 일시정지 창 → 강의 노트(또는 코드 편집기)처럼 보이는 화면
 *     - 탭 제목 · 아이콘도 바뀌고 소리는 꺼져요. 싱글 게임이면 일시정지도 같이.
 *     - 돌아오기: ` 또는 Esc · 화면을 1초 꾹 누르기 (그냥 누르기는 아무 일도 없어요)
 *     - 🙈 버튼을 꾹 누르면(또는 Shift + `) 🚨 방 친구 모두 숨기기
 *  📚 수업 모드 (☰ 메뉴): 소리 · 진동 끄기 + 🙈 버튼 · 평일 9~18시 자동으로 켜기 · 위장 화면 고르기
 * ===================================================================== */
const Pause = (() => {
  /* ── 1) 멈출 수 있는 시계 ── */
  const realNow = performance.now.bind(performance);
  const C = { on: false, at: 0, off: 0 };                          // off: 이번 게임에서 멈춰 있던 시간 합
  const lag = () => C.off + (C.on ? realNow() - C.at : 0);
  performance.now = () => realNow() - lag();
  const rRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => rRAF(t => cb(t - lag()));

  /* ── 2) 멈출 수 있는 after / every (core.js 것을 바꿔 끼워요) ── */
  const rST = window.setTimeout.bind(window), rSI = window.setInterval.bind(window), rCT = window.clearTimeout.bind(window), rCI = window.clearInterval.bind(window);
  const T = new Map();                                             // 처음 받은 번호 → { fn, ms, rep, due, real, left, held }
  const kill = id => { const t = T.get(id); if (!t) return false; rCT(t.real); rCI(t.real); T.delete(id); return true; };
  window.clearTimeout = id => { if (!kill(id)) rCT(id); };
  window.clearInterval = id => { if (!kill(id)) rCI(id); };
  const hold = t => { if (t.held) return; rCT(t.real); rCI(t.real); t.left = Math.max(0, t.due - realNow()); t.held = true; };
  const wake = t => {
    if (!t.held) return;
    t.held = false; t.due = realNow() + t.left;
    if (!t.rep) t.real = rST(t.fn, t.left);
    else t.real = rST(() => { if (!T.has(t.id)) return; t.fn(); if (T.has(t.id) && !t.held) t.real = rSI(t.fn, t.ms); }, t.left);
  };
  after = (ms, fn) => {
    const t = { ms, rep: false, due: realNow() + ms };
    t.fn = () => { T.delete(t.id); S.timers.delete(t.id); fn(); };
    t.id = t.real = rST(t.fn, ms);
    T.set(t.id, t); S.timers.add(t.id);
    if (C.on) hold(t);                                              // 멈춘 동안 만든 타이머도 멈춰 둬요
    return t.id;
  };
  every = (ms, fn) => {
    const t = { ms, rep: true, due: realNow() + ms };
    t.fn = () => { t.due = realNow() + ms; fn(); };
    t.id = t.real = rSI(t.fn, ms);
    T.set(t.id, t); S.timers.add(t.id);
    if (C.on) hold(t);
    return t.id;
  };

  /* ── 3) 화면 ── */
  const ov = document.createElement('div');
  ov.id = 'pz-ov'; ov.className = 'pz-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '일시정지');
  document.body.append(ov);
  ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => ov.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  const gameName = () => { const k = S.solo; const s = typeof SOLO_GAMES !== 'undefined' && SOLO_GAMES.find(g => g[0] === k); return s ? stripEmoji(s[2]) : '게임'; };
  const action = () => typeof catOf === 'function' && catOf(S.solo) === '액션';

  const P = {
    on: false, why: '', cdT: 0,
    /** 지금 멈출 수 있나요? (싱글 게임 화면) */
    can() { return !!S.solo && document.body.classList.contains('gaming') && !!document.querySelector('#main .screen.active'); },
    start(why = 'btn') {
      if (this.on || !this.can()) return false;
      this.on = true; this.why = why;
      C.on = true; C.at = realNow();
      for (const t of T.values()) hold(t);
      Keys.clear();
      document.body.classList.add('pz-on');
      this.draw();
      Hush.set('pause', true);
      return true;
    },
    draw(count) {
      const auto = this.why === 'auto';
      ov.innerHTML = `<div class="pz-card">
        <div class="pz-ic">${icon('player-pause')}</div>
        <b class="pz-t">${count ? `<span class="pz-cd">${count}</span>` : '일시정지'}</b>
        <p class="pz-s">${esc(gameName())} · ${auto ? '다른 화면으로 가서 멈췄어요' : '게임 화면을 가렸어요'}<br><small>멈춘 동안 시간도 멈춰요</small></p>
        <button class="btn good lg pz-go" data-act="pzResume" ${count ? 'disabled' : ''}>${icon('player-play')}계속하기</button>
        <div class="pz-row"><button class="btn ghost" data-act="dgShow">${icon('eye-off')}위장 화면</button><button class="btn ghost" data-act="pzQuit">${icon('door-exit')}그만하기</button></div>
        <p class="pz-k"><kbd>Esc</kbd> 계속하기 · <kbd>\`</kbd> 위장 화면</p></div>`;
      ov.classList.add('show');
    },
    /** 다시 시작 (액션 게임은 3 · 2 · 1) */
    resume() {
      if (!this.on || this.cdT) return;
      if (Disguise.on) return;
      const go = () => {
        this.cdT = 0;
        C.off += realNow() - C.at; C.on = false;
        for (const t of T.values()) wake(t);
        this.on = false; this.why = '';
        document.body.classList.remove('pz-on');
        ov.classList.remove('show'); ov.innerHTML = '';
        Keys.clear();
        Hush.set('pause', false);
      };
      if (!action()) return go();
      let n = 3;
      const tick = () => { if (!this.on) { this.cdT = 0; return; } if (n === 0) return go(); this.draw(n--); this.cdT = rST(tick, 520); };
      tick();
    },
    toggle() { if (this.on) this.resume(); else this.start('btn'); },
    /** 게임이 끝나거나 다른 화면으로 가면 깨끗이 */
    reset() {
      if (this.cdT) { rCT(this.cdT); this.cdT = 0; }
      for (const t of T.values()) wake(t);
      C.on = false; C.off = 0;
      this.on = false; this.why = '';
      document.body.classList.remove('pz-on');
      ov.classList.remove('show'); ov.innerHTML = '';
      Hush.set('pause', false);
    },
    _test: { C, T, realNow },
  };
  return P;
})();

/* ── 소리 끄기 (일시정지 · 위장 · 수업 모드) — 사용자의 소리 설정은 그대로 두고 잠깐만 ── */
const Hush = {
  why: new Set(),
  set(k, on) {
    if (on) this.why.add(k); else this.why.delete(k);
    Sound.hush = this.why.size > 0;
    try { if (Sound.ctx) { if (Sound.hush) Sound.ctx.suspend(); else if (Sound.on) Sound.ctx.resume(); } } catch { /* 무시 */ }
  },
};
(() => {                                                             // 수업 모드면 진동도 끄기
  const v0 = navigator.vibrate ? navigator.vibrate.bind(navigator) : null;
  if (v0) try { navigator.vibrate = p => (Hush.why.has('class') || Hush.why.has('hide') ? false : v0(p)); } catch { /* 바꿀 수 없는 브라우저 */ }
})();

/* ── 🙈 위장 화면 ── */
const Disguise = {
  on: false, pressT: 0, title: '', icon: '',
  kind() { return store.get('mgDisguise', 'note') === 'code' ? 'code' : 'note'; },
  NOTE_ICON: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a73e8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 3v4a1 1 0 0 0 1 1h4'/%3E%3Cpath d='M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z'/%3E%3Cpath d='M9 9h1M9 13h6M9 17h6'/%3E%3C/svg%3E",
  CODE_ICON: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 8l-4 4l4 4M17 8l4 4l-4 4M14 4l-4 16'/%3E%3C/svg%3E",
  noteHTML() {
    return `<div class="dg-doc">
      <div class="dg-bar"><span class="dg-file">${icon('file-text')}5주차_로봇기구학_정리</span><span class="dg-tools"><b>B</b><i>I</i><u>U</u><span>≡</span><span>⋮</span></span><span class="dg-saved">모든 변경사항 저장됨</span></div>
      <div class="dg-page">
        <h1>5주차. 로봇 기구학 (Kinematics)</h1>
        <p class="dg-meta">로봇공학개론 · 수업 정리 노트</p>
        <h2>1. 좌표계와 동차 변환</h2>
        <p>로봇의 각 링크에 좌표계를 붙이고, 이웃한 좌표계 사이의 관계를 <b>동차 변환 행렬</b>로 나타낸다.</p>
        <div class="dg-eq">T = [ R  p ; 0  1 ] &nbsp;&nbsp; (R: 3×3 회전 행렬, p: 3×1 위치 벡터)</div>
        <ul><li>회전 행렬은 직교 행렬 → R<sup>-1</sup> = R<sup>T</sup></li><li>변환을 이어서 곱하면 기준 좌표계에서 본 끝점 위치가 나온다: <sup>0</sup>T<sub>n</sub> = <sup>0</sup>T<sub>1</sub> · <sup>1</sup>T<sub>2</sub> ⋯ <sup>n-1</sup>T<sub>n</sub></li></ul>
        <h2>2. DH 파라미터 (Denavit–Hartenberg)</h2>
        <table class="dg-tb"><tr><th>링크 i</th><th>θ<sub>i</sub></th><th>d<sub>i</sub></th><th>a<sub>i</sub></th><th>α<sub>i</sub></th></tr>
          <tr><td>1</td><td>θ<sub>1</sub></td><td>0</td><td>L<sub>1</sub></td><td>0°</td></tr><tr><td>2</td><td>θ<sub>2</sub></td><td>0</td><td>L<sub>2</sub></td><td>0°</td></tr></table>
        <p>θ: z축 기준 회전 · d: z축 방향 이동 · a: x축 방향 길이 · α: x축 기준 비틀림</p>
        <h2>3. 2링크 평면 로봇 — 순기구학</h2>
        <svg class="dg-arm" viewBox="0 0 220 120" aria-hidden="true"><line x1="20" y1="105" x2="200" y2="105" stroke="#bbb"/><line x1="30" y1="100" x2="100" y2="50" stroke="#1a73e8" stroke-width="5" stroke-linecap="round"/><line x1="100" y1="50" x2="175" y2="62" stroke="#34a853" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="100" r="6" fill="#444"/><circle cx="100" cy="50" r="5" fill="#444"/><circle cx="175" cy="62" r="4" fill="#ea4335"/><text x="52" y="66" font-size="11" fill="#1a73e8">L1</text><text x="132" y="48" font-size="11" fill="#34a853">L2</text><text x="40" y="96" font-size="10" fill="#555">θ1</text><text x="108" y="70" font-size="10" fill="#555">θ2</text></svg>
        <div class="dg-eq">x = L<sub>1</sub>cos θ<sub>1</sub> + L<sub>2</sub>cos(θ<sub>1</sub> + θ<sub>2</sub>)<br>y = L<sub>1</sub>sin θ<sub>1</sub> + L<sub>2</sub>sin(θ<sub>1</sub> + θ<sub>2</sub>)</div>
        <h2>4. 역기구학</h2>
        <div class="dg-eq">cos θ<sub>2</sub> = (x² + y² − L<sub>1</sub>² − L<sub>2</sub>²) / (2 L<sub>1</sub> L<sub>2</sub>)</div>
        <ul><li>해가 두 개(팔꿈치 위 / 아래) → 관절 한계와 장애물로 하나를 고른다</li><li>x² + y² &gt; (L<sub>1</sub> + L<sub>2</sub>)² 이면 닿을 수 없는 위치</li></ul>
        <h2>5. 다음 시간 · 과제</h2>
        <ul><li>야코비안(Jacobian)과 특이점</li><li>과제: L<sub>1</sub> = 0.3 m, L<sub>2</sub> = 0.2 m 일 때 (0.35, 0.15) 의 관절각 구하기 (두 해 모두)</li></ul>
      </div></div>`;
  },
  codeHTML() {
    const L = [
      ['c', '# PID 위치 제어 — 3주차 실습'], ['', ''], ['k', 'import</span> time'], ['', ''], ['k', 'class</span> <span class="f">PID</span>:'],
      ['', '    <span class="k">def</span> <span class="f">__init__</span>(self, kp, ki, kd, limit=<span class="n">255</span>):'],
      ['', '        self.kp, self.ki, self.kd = kp, ki, kd'], ['', '        self.limit = limit'], ['', '        self.i_sum = <span class="n">0.0</span>'], ['', '        self.prev = <span class="n">0.0</span>'], ['', ''],
      ['', '    <span class="k">def</span> <span class="f">step</span>(self, target, now, dt):'], ['', '        err = target - now'], ['', '        self.i_sum += err * dt'],
      ['', '        d = (err - self.prev) / dt <span class="k">if</span> dt &gt; <span class="n">0</span> <span class="k">else</span> <span class="n">0.0</span>'], ['', '        self.prev = err'],
      ['', '        out = self.kp * err + self.ki * self.i_sum + self.kd * d'], ['', '        <span class="k">return</span> <span class="f">max</span>(-self.limit, <span class="f">min</span>(self.limit, out))'], ['', ''],
      ['', 'pid = PID(kp=<span class="n">2.4</span>, ki=<span class="n">0.08</span>, kd=<span class="n">0.6</span>)'], ['', 'pos, target = <span class="n">0.0</span>, <span class="n">90.0</span>   <span class="c"># 목표 각도 (도)</span>'],
      ['', '<span class="k">for</span> step <span class="k">in</span> <span class="f">range</span>(<span class="n">200</span>):'], ['', '    u = pid.step(target, pos, <span class="n">0.01</span>)'], ['', '    pos += u * <span class="n">0.01</span>      <span class="c"># 간단한 모터 모델</span>'],
      ['', '    <span class="k">if</span> step % <span class="n">20</span> == <span class="n">0</span>:'], ['', '        <span class="f">print</span>(<span class="s">f"{step:3d}  pos={pos:6.2f}  u={u:7.2f}"</span>)'], ['', '    time.sleep(<span class="n">0.01</span>)'],
    ];
    const line = ([k, h], i) => `<div class="dg-ln"><i>${i + 1}</i><span>${k === 'c' ? `<span class="c">${h}</span>` : k === 'k' ? `<span class="k">${h}` : h}</span></div>`;
    return `<div class="dg-code">
      <div class="dg-tabs"><span class="on">${icon('code')}pid_controller.py</span><span>motor_test.py</span><span>README.md</span></div>
      <div class="dg-src">${L.map(line).join('')}</div>
      <div class="dg-term"><b>터미널</b><pre>$ python pid_controller.py
  0  pos=  2.16  u= 216.00
 20  pos= 31.84  u= 141.37
 40  pos= 55.20  u=  98.66
 60  pos= 70.91  u=  63.12</pre></div>
      <div class="dg-status"><span>Python 3.11</span><span>UTF-8</span><span>줄 18, 열 9</span></div></div>`;
  },
  show(by = 'key') {
    if (this.on) return;
    this.on = true;
    if (Pause.can() && !Pause.on) Pause.start('hide');            // 싱글 게임이면 멈추고 가려요
    Hush.set('hide', true);
    const k = this.kind();
    let el = $('#dg-ov');
    if (!el) { el = document.createElement('div'); el.id = 'dg-ov'; document.body.append(el); this.bind(el); }
    el.className = 'dg-ov ' + k;
    el.innerHTML = k === 'code' ? this.codeHTML() : this.noteHTML();
    el.scrollTop = 0;
    this.title = document.title;
    const fav = document.querySelector('link[rel="icon"]');
    this.icon = fav ? fav.getAttribute('href') : '';
    document.title = k === 'code' ? 'pid_controller.py — 편집기' : '5주차_로봇기구학_정리 - 문서';
    if (fav) fav.setAttribute('href', k === 'code' ? this.CODE_ICON : this.NOTE_ICON);
    el.classList.add('show');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (Menu && Menu.isOpen && Menu.isOpen()) Menu.close();
  },
  hide() {
    if (!this.on) return;
    this.on = false;
    const el = $('#dg-ov'); if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    document.title = this.title || '미니게임 천국';
    const fav = document.querySelector('link[rel="icon"]'); if (fav && this.icon) fav.setAttribute('href', this.icon);
    Hush.set('hide', false);
    if (this.room) { toast(`🚨 ${this.room} 님이 「모두 숨기기」를 눌렀어요.`); this.room = ''; }
  },
  /** 돌아오기: 화면을 1초 꾹 (그냥 누르기 · 스크롤은 아무 일도 없어요) */
  bind(el) {
    const cancel = () => { clearTimeout(this.pressT); this.pressT = 0; };
    el.addEventListener('pointerdown', e => { cancel(); const x = e.clientX, y = e.clientY; this.px = [x, y]; this.pressT = setTimeout(() => { this.pressT = 0; this.hide(); }, 1000); });
    el.addEventListener('pointermove', e => { if (this.pressT && this.px && Math.hypot(e.clientX - this.px[0], e.clientY - this.px[1]) > 12) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, cancel));
    el.addEventListener('contextmenu', e => e.preventDefault());
  },
  /** 🚨 방 친구 모두 숨기기 (방 안에서만) */
  all() {
    if (!S.code) { this.show('btn'); return; }
    socket.emit('room:hide');
    this.show('btn');
  },
};

/* ── 📚 수업 모드 ── */
const Class = {
  get on() { return store.get('mgClass', '') === '1' || (this.auto && this.hours()); },
  get manual() { return store.get('mgClass', '') === '1'; },
  get auto() { return store.get('mgClassAuto', '') === '1'; },
  get autoPause() { return store.get('mgAutoPause', '1') !== '0'; },
  get follow() { return store.get('mgFollowHide', '1') !== '0'; },
  /** 평일 9시 ~ 18시 (이 기기 시각) */
  hours(d = new Date()) { const h = d.getHours() + d.getMinutes() / 60; return d.getDay() >= 1 && d.getDay() <= 5 && h >= 9 && h < 18; },
  apply() {
    const on = this.on;
    document.body.classList.toggle('class-mode', on);
    Hush.set('class', on);
    if (Menu.isOpen()) Menu.render();
  },
  sub() {
    const on = this.on;
    return on ? `켜짐${!this.manual ? ' (수업 시간 자동)' : ''} · 소리 · 진동 끔 · 🙈 버튼` : this.auto ? '꺼짐 · 평일 9~18시엔 자동으로 켜져요' : '소리 끄기 · 🙈 위장 화면 · 일시정지';
  },
  pageHTML() {
    const sw = (act, on, ic, c, t, sub) => `<label class="ms-row">${`<i class="ms-ic" style="--c:${c}">${icon(ic)}</i>`}<span class="ms-t">${t}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="ms-sw" data-act="${act}" ${on ? 'checked' : ''} aria-label="${t}"></label>`;
    const k = Disguise.kind();
    return `<div class="ms-grab"></div>
      <div class="ms-head nav"><button class="ms-back" data-act="msBack">${icon('chevron-left')}메뉴</button><b>수업 모드</b><button class="ms-x" data-act="msClose" aria-label="닫기">${icon('x')}</button></div>
      <div class="ms-group">
        ${sw('clsOn', this.manual, 'school', '#30b158', '수업 모드', '소리 · 진동을 끄고 🙈 위장 버튼을 보여 줘요')}
        ${sw('clsAuto', this.auto, 'clock', '#0a84ff', '평일 9시~18시엔 자동으로', '이 기기 시계 기준 · 그 밖엔 평소대로')}
      </div>
      <h4 class="cm-h">위장 화면 <small>🙈 · <kbd>\`</kbd> 키</small></h4>
      <div class="cm-pick">
        <button class="cm-opt ${k === 'note' ? 'on' : ''}" data-act="clsKind" data-k="note"><span class="cm-prev note"><i></i><i></i><i></i><i></i></span><b>강의 노트</b><small>로봇 기구학 정리</small></button>
        <button class="cm-opt ${k === 'code' ? 'on' : ''}" data-act="clsKind" data-k="code"><span class="cm-prev code"><i></i><i></i><i></i><i></i></span><b>코드 편집기</b><small>PID 제어 실습</small></button>
      </div>
      <div class="ms-group"><button class="ms-row" data-act="dgShow"><i class="ms-ic" style="--c:#8e8e93">${icon('eye-off')}</i><span class="ms-t">지금 위장 화면 보기<small>돌아오기: 화면 1초 꾹 · <kbd>\`</kbd> · <kbd>Esc</kbd></small></span><i class="ms-chev">${icon('chevron-right')}</i></button></div>
      <div class="ms-group">
        ${sw('clsAutoPause', this.autoPause, 'player-pause', '#ff9f0a', '다른 앱 · 탭으로 가면 자동 일시정지', '싱글 게임 · 화면을 가리고 시간도 멈춰요')}
        ${sw('clsFollow', this.follow, 'users', '#ff453a', '친구가 🚨 모두 숨기기를 누르면 나도', '같은 방에서 🙈 버튼을 꾹 누르면 모두 숨겨요')}
      </div>
      <p class="ms-foot cm-help"><kbd>Esc</kbd> 일시정지 · <kbd>\`</kbd> 위장 화면 · <kbd>Shift</kbd>+<kbd>\`</kbd> 방 친구 모두 숨기기<br>휴대폰 · 태블릿: 제목 줄 ⏸ · 🙈 버튼 (🙈 꾹 = 모두 숨기기)</p>`;
  },
};

/* ── 버튼 붙이기: 제목 줄 ⏸ · 🙈 (게임 화면) · 위쪽 막대 🙈 (그 밖의 화면) ── */
(() => {
  const addHead = head => {
    if (!head || head.querySelector('.pz-btn')) return;
    const leave = head.querySelector('[data-act=leaveGame]');
    const html = `<button class="btn ghost pz-btn" data-act="pzToggle" aria-label="일시정지" title="일시정지 (Esc)">${icon('player-pause')}</button><button class="btn ghost dg-btn" data-act="dgShow" aria-label="위장 화면" title="위장 화면 (\` 키) · 꾹 누르면 방 친구 모두 숨기기">${icon('eye-off')}</button>`;
    if (leave) leave.insertAdjacentHTML('beforebegin', html); else head.insertAdjacentHTML('beforeend', html);
  };
  $$('.game-head').forEach(addHead);
  new MutationObserver(ms => ms.forEach(m => {                       // 나중에 만들어지는 게임 화면에도
    if (m.target.nodeType === 1 && m.target.closest && m.target.closest('.game-head')) addHead(m.target.closest('.game-head'));
    m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.tagName === 'SECTION') n.querySelectorAll('.game-head').forEach(addHead); });
  })).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  const mb = $('#menu-btn');
  if (mb) mb.insertAdjacentHTML('beforebegin', `<button class="btn ghost sm icon-only dg-top" data-act="dgShow" aria-label="위장 화면" title="위장 화면 (\` 키)">${icon('eye-off')}</button>`);
  // 🙈 꾹 누르기 = 방 친구 모두 숨기기
  let lp = 0, lpEl = null;
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('.dg-btn, .dg-top');
    if (!b) return;
    delete b.dataset.lp;
    lpEl = b; clearTimeout(lp);
    lp = setTimeout(() => { lp = 0; lpEl = null; b.dataset.lp = '1'; Disguise.all(); }, 550);
  }, true);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, () => { clearTimeout(lp); lp = 0; }, true));
})();

/* ── 키보드: Esc 일시정지 · ` 위장 화면 · Shift+` 모두 숨기기 (먼저 받아서 게임으로 안 가게) ── */
document.addEventListener('keydown', e => {
  if (e.code === 'Backquote' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (Disguise.on) Disguise.hide(); else if (e.shiftKey) Disguise.all(); else Disguise.show('key');
    return;
  }
  if (Disguise.on) {                                                // 위장 중: Esc 로 돌아오기, 나머지 키는 무시
    if (e.key === 'Escape') Disguise.hide();
    e.preventDefault(); e.stopImmediatePropagation();
    return;
  }
  if (e.key === 'Escape') {
    const busy = Menu.isOpen() || $$('.overlay.show, .ms-ov.show').length > 0                     // 창 · 메뉴가 열려 있으면 그걸 먼저 닫아요
      || (typeof Flair !== 'undefined' && Flair.cur) || (typeof GS !== 'undefined' && GS.logOpen && isScreen('gostop'))
      || (typeof Yacht !== 'undefined' && Yacht.sel && isScreen('yacht')) || (typeof Marble !== 'undefined' && Marble.infoAt && isScreen('marble'));
    if (busy) return;
    if (Pause.on) { e.preventDefault(); e.stopImmediatePropagation(); Pause.resume(); return; }
    const a = document.activeElement, chat = a && a.closest && a.closest('.chat, #chat-input');      // 채팅 칸에서는 그대로 (게임 입력칸 · 산성비는 멈춰요)
    if (Pause.can() && !chat) { e.preventDefault(); e.stopImmediatePropagation(); if (a && a.blur && typing()) a.blur(); Pause.start('key'); return; }
  }
  if (Pause.on) {                                                   // 멈춘 동안 게임 조작 막기 (메뉴 · 창 · 채팅의 입력은 그대로)
    const t = e.target;
    if (t && t.closest && t.closest('.overlay, .ms-ov, .modal, .chat')) return;
    e.stopImmediatePropagation(); if (e.key !== 'Tab') e.preventDefault();
  }
}, true);
document.addEventListener('keyup', e => { if (Disguise.on || (Pause.on && !(e.target && e.target.closest && e.target.closest('.overlay, .ms-ov, .modal, .chat')))) e.stopImmediatePropagation(); }, true);

/* ── 자동 일시정지: 다른 앱 · 탭 · 창으로 가면 ── */
document.addEventListener('visibilitychange', () => { if (document.hidden && Class.autoPause) Pause.start('auto'); });
window.addEventListener('blur', () => { if (Class.autoPause && !Disguise.on) setTimeout(() => { if (!document.hasFocus()) Pause.start('auto'); }, 120); });

/* ── ⏸ 버튼은 싱글 게임에서만 (S.solo 를 화면을 띄운 뒤에 정하는 게임도 있어서 자주 살펴요) ── */
const pzSync = () => document.body.classList.toggle('pz-solo', !!S.solo);
setInterval(pzSync, 400);

/* ── 게임이 끝나거나(stopLocal) 다른 화면으로 가면 일시정지 풀기 ── */
(() => {
  const stop0 = stopLocal;
  stopLocal = function () { stop0(); Pause.reset(); pzSync(); };
  const show0 = show;
  show = function (id) { show0(id); if (Pause.on && !Pause.can()) Pause.reset(); pzSync(); setTimeout(pzSync, 0); };
})();

/* ── 🚨 방 친구가 모두 숨기기 ── */
socket.on('room:hide', d => {
  if (!Class.follow) return;
  Disguise.room = (d && d.by) || '친구';
  Disguise.show('room');
});

Object.assign(ACT, {
  pzToggle: () => Pause.toggle(),
  pzResume: () => Pause.resume(),
  pzQuit: () => { Pause.reset(); ACT.leaveGame(); },
  dgShow: el => { if (el && el.dataset.lp) { delete el.dataset.lp; return; } Disguise.show('btn'); },
  msClass: () => { Menu.page = 'class'; Menu.render(); },
  clsOn: el => { store.set('mgClass', el.checked ? '1' : ''); Class.apply(); toast(el.checked ? '📚 수업 모드: 소리 · 진동을 껐어요. 🙈 버튼으로 숨길 수 있어요.' : '수업 모드를 껐어요.'); },
  clsQuick: el => { store.set('mgClass', el.checked ? '1' : ''); Class.apply(); },
  clsAuto: el => { store.set('mgClassAuto', el.checked ? '1' : ''); Class.apply(); },
  clsAutoPause: el => store.set('mgAutoPause', el.checked ? '1' : '0'),
  clsFollow: el => store.set('mgFollowHide', el.checked ? '1' : '0'),
  clsKind: el => { store.set('mgDisguise', el.dataset.k); Menu.render(); },
});
Class.apply();
setInterval(() => { if (Class.auto) Class.apply(); }, 60000);    // 수업 시간이 시작 · 끝나면 저절로
