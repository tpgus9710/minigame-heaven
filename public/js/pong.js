/* =====================================================================
 *  🏓 핑퐁 (싱글: vs AI 쉬움 · 보통 · 어려움 / 멀티: 4인 핑퐁) — 물리는 shared/pong-core.js (서버와 같은 코드)
 *  조작: 마우스 · 손가락 — 판 위든 판 아래든 그 위치로 패들이 따라와요 (휴대폰은 판 아래를 끌면 공이 안 가려요)
 *        키보드 — ← → (A D) · 왼쪽 · 오른쪽 자리는 ↑ ↓ (W S). 꾹 누르면 점점 빨라져요.
 *  공은 패들에 맞을 때마다 빨라져요 (판 가운데에 랠리 숫자 · ⚡ 속도). 빠를수록 공 색이 노랑 → 주황 → 빨강.
 *  멀티: 서버가 1초에 60번 보내는 상태를 조금(50ms) 늦춰서 부드럽게 이어 그려요. 내 패들은 내 손 위치 그대로.
 * ===================================================================== */
const PC = PongCore.C;
const SIDE_LIST = PongCore.SIDES;
const PONG_ORDER = ['bottom', 'top', 'right', 'left'];                 // 서버가 보내는 배열 순서
const SIDE_COLOR = { bottom: '#4aa8ff', top: '#ff7a59', left: '#3fcf9b', right: '#a77cff' };
const SIDE_NAME = { bottom: '⬇️ 아래', top: '⬆️ 위', left: '⬅️ 왼쪽', right: '➡️ 오른쪽' };
const PONG_LV = { easy: '쉬움', normal: '보통', hard: '어려움' };
const Pong = {
  solo: false, role: null, mouse: 300, lastSent: -1, sentAt: 0, lv: 'normal', kv: 0,
  g: null, mem: {}, names: {}, buf: [], offs: [], trail: [], fx: [], shake: 0, flash: {}, panelKey: '', best: { rally: 0, sp: 0 }, over: false,
  DELAY: 50,
  axis() { return this.role === 'left' || this.role === 'right' ? 'y' : 'x'; },
  playing() { return this.role && this.role !== 'spectator'; },
  reset() {
    Object.assign(this, { mouse: 300, lastSent: -1, sentAt: 0, kv: 0, buf: [], offs: [], trail: [], fx: [], shake: 0, flash: {}, panelKey: '', best: { rally: 0, sp: 0 }, over: false });
  },
  startSolo(lv) {
    stopLocal();
    if (lv && PONG_LV[lv]) { this.lv = lv; store.set('pong-lv', lv); }
    else this.lv = PONG_LV[store.get('pong-lv', 'normal')] ? store.get('pong-lv', 'normal') : 'normal';
    this.solo = true; S.solo = 'pong'; this.role = 'bottom';
    this.reset();
    this.g = PongCore.newGame({ bottom: true, top: true });
    this.names = { bottom: nick(), top: '🤖 AI' }; this.mem = {};
    PongCore.serve(this.g, null, 1.3);
    $('#pong-title .tt').textContent = '핑퐁 vs AI';
    $('#pong-levels').classList.remove('hidden');
    $$('#pong-levels .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.lv === this.lv));
    $('#pong-status').textContent = TOUCH ? '손가락을 좌우로 끌면 아래 패들이 따라와요 (판 아래를 끌어도 돼요). 칠수록 공이 빨라져요!'
      : '마우스(또는 ← →)로 아래 패들을 움직여요. 칠수록 공이 빨라지고, 패들 끝으로 치면 크게 꺾여요!';
    show('pong');
    gameLoop((dt, now) => this.frameSolo(dt, now));
  },
  frameSolo(dt) {
    const g = this.g; if (!g) return;
    this.keys(dt);
    g.sides.bottom.p = this.mouse;
    if (g.sides.top.a) g.sides.top.p = PongCore.ai(g, 'top', this.lv, this.mem, dt);
    const ev = this.over ? [] : PongCore.step(g, dt);
    this.events(ev, g.ball);
    const miss = ev.find(e => e[0] === 'miss');
    if (miss && !this.over) {
      if (!g.sides.bottom.a || !g.sides.top.a) {
        this.over = true;
        const win = g.sides.bottom.a;
        after(800, () => showResult({ title: win ? '🏆 AI를 이겼어요!' : '💀 AI 승리',
          subtitle: `남은 목숨 ${g.sides.bottom.hp} : ${g.sides.top.hp} · ${PONG_LV[this.lv]} · 최고 랠리 ${this.best.rally} · 최고 속도 ×${(this.best.sp / PC.V0).toFixed(1)}`, solo: 'pong', win: !!win }));
      } else PongCore.serve(g, miss[1]);                       // 놓친 쪽으로 다시 출발
    }
    const v = { b: g.ball, sp: g.ball ? g.ball.sp : 0, f: g.freeze, r: g.rally, s: {} };
    for (const n of PONG_ORDER) v.s[n] = { a: g.sides[n].a, hp: g.sides[n].hp, p: g.sides[n].p };
    this.draw(v, dt);
    this.panel(v);
  },
  /* ─── 멀티 ─── */
  startMulti(d = {}) {
    stopLocal();
    this.solo = false; const m = me();
    this.role = m && PONG_ORDER.includes(m.role) ? m.role : 'spectator';
    this.reset(); this.g = null;
    this.names = d.names || {};
    $('#pong-title .tt').textContent = '4인 핑퐁';
    $('#pong-levels').classList.add('hidden');
    $('#pong-status').textContent = this.role === 'spectator' ? '👀 관전 중' : `내 자리: ${SIDE_NAME[this.role]} — ${TOUCH ? '손가락으로 끌어서' : '마우스 · 방향키로'} 패들을 움직여요. ${this.axis() === 'y' ? '(위아래로)' : ''}`;
    show('pong');
    gameLoop((dt, now) => this.frameMulti(dt, now));
  },
  onState(st) {
    if (!isScreen('pong') || this.solo) return;
    const now = performance.now();
    if (st.n) this.names = st.n;
    this.offs.push(now - st.t); if (this.offs.length > 120) this.offs.shift();
    const off = Math.min(...this.offs);                       // 가장 빨리 온 것 기준으로 서버 시각 → 내 시각
    this.buf.push({ lt: st.t + off, st }); if (this.buf.length > 30) this.buf.shift();
    if (st.e) this.events(st.e, st.b ? { x: st.b[0], y: st.b[1], sp: st.sp } : null);
  },
  frameMulti(dt, now) {
    this.keys(dt);
    if (this.playing() && this.mouse !== this.lastSent && now - this.sentAt >= 15) { socket.emit('pong:move', Math.round(this.mouse)); this.lastSent = this.mouse; this.sentAt = now; }
    const B = this.buf; if (!B.length) return this.draw(null, dt);
    const T = now - this.DELAY;
    let i = B.length - 1; while (i > 0 && B[i - 1].lt > T) i--;
    const b1 = B[i], b0 = i > 0 ? B[i - 1] : b1, s0 = b0.st, s1 = b1.st;
    const k = b1 === b0 || b1.lt <= b0.lt ? 1 : clamp((T - b0.lt) / (b1.lt - b0.lt), 0, 1);
    const lerp = (a, b) => a + (b - a) * k;
    let ball = null;                                           // 다시 출발(가운데로 순간 이동)할 때는 이어 그리지 않아요
    if (s1.b) ball = s0.b && Math.hypot(s1.b[0] - s0.b[0], s1.b[1] - s0.b[1]) < 60 ? { x: lerp(s0.b[0], s1.b[0]), y: lerp(s0.b[1], s1.b[1]) } : { x: s1.b[0], y: s1.b[1] };
    const v = { b: ball, sp: s1.sp, f: s1.f / 1000, r: s1.r, s: {} };
    PONG_ORDER.forEach((n, j) => { v.s[n] = { a: !!s1.a[j], hp: s1.h[j], p: lerp(s0.p[j], s1.p[j]) }; });
    if (this.playing() && v.s[this.role].a) v.s[this.role].p = this.mouse;   // 내 패들은 내 손 그대로
    this.draw(v, dt);
    this.panel(v);
  },
  /* ─── 입력: 키보드 (마우스 · 손가락은 아래 pointer 처리) ─── */
  keys(dt) {
    if (!this.playing()) return;
    const d = this.axis() === 'y' ? held('ArrowDown', 'KeyS') - held('ArrowUp', 'KeyW') : held('ArrowRight', 'KeyD') - held('ArrowLeft', 'KeyA');
    if (!d) { this.kv = 0; return; }
    this.kv = Math.min(1, this.kv + dt * 6);                  // 누르기 시작하면 0.17초 동안 빨라져요 (톡 누르면 조금만)
    this.mouse = clamp(this.mouse + d * (520 + 760 * this.kv) * dt, PC.HALF, PC.F - PC.HALF);
  },
  /** 맞음 · 벽 · 실점 → 효과 · 소리 */
  events(ev, b) {
    for (const e of ev) {
      if (e[0] === 'hit') {
        this.flash[e[1]] = 0.16;
        if (b) this.fx.push({ x: b.x, y: b.y, t: 0, d: 0.35, c: SIDE_COLOR[e[1]], r: 10 });
        const sp = b ? b.sp : PC.V0;
        if (typeof Sound !== 'undefined') Sound.blip(420 + Math.min(1, (sp - PC.V0) / (PC.VMAX - PC.V0)) * 520, 0.035);
      } else if (e[0] === 'miss') {
        this.flash['x' + e[1]] = 0.45; this.shake = 0.25; this.trail = [];
        if (typeof Sound !== 'undefined') Sound.blip(170, 0.16, 1.3);
      } else if (e[0] === 'wall' && typeof Sound !== 'undefined') Sound.blip(300, 0.02, 0.5);
    }
  },
  /* ─── 그리기 ─── */
  ballColor(t) {
    const a = [[255, 210, 63], [255, 138, 61], [255, 59, 107]], u = clamp(t, 0, 1) * 2, i = Math.min(1, Math.floor(u)), f = u - i;
    return `rgb(${a[i].map((v, j) => Math.round(v + (a[i + 1][j] - v) * f)).join(',')})`;
  },
  draw(v, dt) {
    const c = $('#pong-cv').getContext('2d'), F = PC.F, H = PC.HALF;
    for (const k in this.flash) this.flash[k] = Math.max(0, this.flash[k] - dt);
    this.shake = Math.max(0, this.shake - dt);
    c.save();
    c.fillStyle = '#0b0e1a'; c.fillRect(0, 0, F, F);
    if (this.shake) c.translate((Math.random() - 0.5) * 12 * this.shake / 0.25, (Math.random() - 0.5) * 12 * this.shake / 0.25);
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2;
    c.beginPath(); c.arc(300, 300, 70, 0, 7); c.stroke();
    c.setLineDash([8, 10]); c.beginPath(); c.moveTo(0, 300); c.lineTo(600, 300); c.moveTo(300, 0); c.lineTo(300, 600); c.stroke(); c.setLineDash([]);
    if (!v) { c.restore(); return; }
    const t = v.sp ? (v.sp - PC.V0) / (PC.VMAX - PC.V0) : 0, col = this.ballColor(t);
    // 가운데: 랠리 숫자 · 속도
    if (v.r >= 2) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(255,255,255,.07)'; c.font = '120px "Black Han Sans", sans-serif'; c.fillText(v.r, 300, 292);
      c.fillStyle = col; c.globalAlpha = 0.55; c.font = 'bold 17px "Noto Sans KR", sans-serif'; c.fillText(`⚡ ×${(v.sp / PC.V0).toFixed(1)}`, 300, 368); c.globalAlpha = 1;
    }
    if (v.r > this.best.rally) this.best.rally = v.r;
    if (v.sp > this.best.sp) this.best.sp = v.sp;
    for (const [name, axis, dir] of SIDE_LIST) {
      const s = v.s[name]; if (!s) continue;
      const lost = this.flash['x' + name];
      if (!s.a) {
        c.fillStyle = lost ? `rgba(255,93,115,${0.4 + lost})` : '#2a3150';
        if (axis === 'y') c.fillRect(0, dir > 0 ? F - 6 : 0, F, 6); else c.fillRect(dir > 0 ? F - 6 : 0, 0, 6, F);
        continue;
      }
      if (lost) {                                              // 실점한 쪽 끝이 빨갛게
        const gr = axis === 'y' ? c.createLinearGradient(0, dir > 0 ? F : 0, 0, dir > 0 ? F - 70 : 70) : c.createLinearGradient(dir > 0 ? F : 0, 0, dir > 0 ? F - 70 : 70, 0);
        gr.addColorStop(0, `rgba(255,59,92,${lost * 1.2})`); gr.addColorStop(1, 'rgba(255,59,92,0)');
        c.fillStyle = gr; if (axis === 'y') c.fillRect(0, dir > 0 ? F - 70 : 0, F, 70); else c.fillRect(dir > 0 ? F - 70 : 0, 0, 70, F);
      }
      const mine = name === this.role, fl = this.flash[name] || 0, L = H * 2, T = PC.T, line = dir > 0 ? F - PC.OFF : PC.OFF;
      c.fillStyle = fl ? '#ffffff' : SIDE_COLOR[name]; c.shadowColor = SIDE_COLOR[name]; c.shadowBlur = (mine ? 18 : 6) + fl * 80;
      const x = axis === 'y' ? s.p - L / 2 : dir > 0 ? line : line - T, y = axis === 'y' ? (dir > 0 ? line : line - T) : s.p - L / 2;
      const w = axis === 'y' ? L : T, h = axis === 'y' ? T : L;
      c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, 5); else c.rect(x, y, w, h); c.fill();
      c.shadowBlur = 0;
    }
    // 공 · 꼬리 (빠를수록 길게)
    if (v.b) {
      const last = this.trail[this.trail.length - 1];
      if (v.f || (last && Math.hypot(last.x - v.b.x, last.y - v.b.y) > 80)) this.trail = [];   // 다시 출발하면 꼬리 없이
      if (!v.f) { this.trail.push({ x: v.b.x, y: v.b.y }); const keep = 4 + Math.round(10 * t); while (this.trail.length > keep) this.trail.shift(); }
      this.trail.forEach((p, i) => {
        const a = (i + 1) / this.trail.length;
        c.globalAlpha = a * 0.35; c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, PC.R * (0.45 + 0.5 * a), 0, 7); c.fill();
      });
      c.globalAlpha = 1;
      if (v.f) {                                               // 다시 출발 전: 공 둘레 원이 줄어들어요
        const k = clamp(v.f / PC.FREEZE, 0, 1.5);
        c.strokeStyle = 'rgba(255,210,63,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(v.b.x, v.b.y, PC.R + 6 + 34 * k, 0, 7); c.stroke();
      }
      c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 14 + 22 * t;
      c.beginPath(); c.arc(v.b.x, v.b.y, PC.R, 0, 7); c.fill(); c.shadowBlur = 0;
    }
    // 맞은 자리 동그라미
    this.fx = this.fx.filter(f => (f.t += dt) < f.d);
    for (const f of this.fx) { const k = f.t / f.d; c.globalAlpha = 1 - k; c.strokeStyle = f.c; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, f.r + 26 * k, 0, 7); c.stroke(); }
    c.globalAlpha = 1;
    c.restore();
  },
  /** 옆 칸: 자리마다 이름 · 남은 목숨 (바뀔 때만 다시 그려요) */
  panel(v) {
    const key = JSON.stringify([this.role, this.names, PONG_ORDER.map(n => [v.s[n].a, v.s[n].hp])]);
    if (key === this.panelKey) return;
    this.panelKey = key;
    $('#pong-side').innerHTML = SIDE_LIST.map(([n]) => {
      const s = v.s[n], name = this.names[n];
      if (!name && !s.a) return '';
      return `<div class="pside ${s.a ? '' : 'dead'} ${n === this.role ? 'me' : ''}" style="border-left-color:${SIDE_COLOR[n]}">
        <div class="small muted">${SIDE_NAME[n]}</div><b>${esc(name || '빈 자리')}${n === this.role ? ' (나)' : ''}</b>
        <div class="hearts">${s.a ? '❤️'.repeat(s.hp) : '💀 탈락'}</div></div>`;
    }).join('');
  },
};
/* 마우스 · 손가락: 판 위든 판 밖(아래쪽 빈 곳)이든 그 위치로 — 버튼 위에서는 무시 */
(() => {
  const sec = $('#scr-pong'), cv = $('#pong-cv');
  const aim = e => {
    if (!isScreen('pong') || !Pong.playing() || e.target.closest('button, a, input, .seg-btn, .chat')) return;
    if (e.pointerType !== 'mouse' && e.type === 'pointermove' && !e.buttons && !e.pressure) return;
    const r = cv.getBoundingClientRect(), k = PC.F / Math.max(1, r.width);
    const val = Pong.axis() === 'y' ? (e.clientY - r.top) * k : (e.clientX - r.left) * k;
    Pong.mouse = Math.round(clamp(val, PC.HALF, PC.F - PC.HALF));
  };
  sec.addEventListener('pointermove', aim);
  sec.addEventListener('pointerdown', aim);
})();
ACT.pongLv = el => Pong.startSolo(el.dataset.lv);
socket.on('pong:start', d => Pong.startMulti(d));
socket.on('pong:state', st => Pong.onState(st));
register('pong', { solo: () => Pong.startSolo(), stop: () => { Pong.solo = false; Pong.g = null; } });
