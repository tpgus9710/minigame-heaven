/* =====================================================================
 *  🔔 알림음 — 귓속말 · 초대 · 친구 접속 · 내 차례 · 미션 · 새 테두리 · 칭호 · 체스 · 고스톱 효과음 (소리 파일 없이 짧게 만들어요)
 *  설정: 메뉴 → 소리(켜기 · 끄기), 내 정보 → 설정(음량 · 친구 접속 알림)
 * ===================================================================== */
const Sound = {
  ctx: null,
  turns: {},
  get on() { return store.get('mgSnd', '1') !== '0'; },
  set on(v) { store.set('mgSnd', v ? '1' : '0'); this.paint(); },
  get vol() { const v = +store.get('mgVol', '0.7'); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7; },
  set vol(v) { store.set('mgVol', String(Math.max(0, Math.min(1, +v || 0)))); },
  /** 브라우저는 화면을 한 번 누른 뒤에야 소리를 내게 해 줘요 */
  unlock() {
    try {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* 소리를 못 내는 브라우저 */ }
  },
  // [높이(Hz), 시작(초), 길이(초)]
  NOTES: {
    dm: [[880, 0, 0.08], [1319, 0.1, 0.14]],
    invite: [[659, 0, 0.09], [880, 0.1, 0.09], [1175, 0.2, 0.18]],
    friend: [[740, 0, 0.07], [988, 0.09, 0.12]],
    turn: [[988, 0, 0.06], [988, 0.12, 0.1]],
    mission: [[784, 0, 0.07], [988, 0.08, 0.07], [1175, 0.16, 0.07], [1568, 0.24, 0.22]],
    tap: [[523, 0, 0.025]],                                   // 말 · 패를 놓을 때 (짧게)
    pop: [[392, 0, 0.05], [784, 0.06, 0.11]],                  // 잡기 · 체크 · 쪽 · 뻑 같은 특별한 일
    tier: [[523, 0, 0.1], [659, 0.11, 0.1], [784, 0.22, 0.1], [1047, 0.34, 0.34], [1319, 0.34, 0.34], [1568, 0.5, 0.42]],   // 새 테두리 (빰빰빰 빠~)
    title: [[1175, 0, 0.06], [1568, 0.07, 0.06], [2093, 0.14, 0.2], [1760, 0.3, 0.16]],                                      // 새 칭호 · 축하 (반짝)
    bad: [[330, 0, 0.08], [247, 0.1, 0.2]],                    // 틀렸어요 (낮게 두 번: 노노그램 목숨)
  },
  play(kind) {
    if (!this.on || !this.vol || !this.NOTES[kind]) return;
    this.unlock();
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    try {
      const t0 = c.currentTime + 0.01, out = c.createGain();
      out.gain.value = this.vol * 0.3; out.connect(c.destination);
      for (const [f, at, len] of this.NOTES[kind]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(1, t0 + at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len + 0.16);
        o.connect(g); g.connect(out);
        o.start(t0 + at); o.stop(t0 + at + len + 0.2);
      }
    } catch { /* 무시 */ }
  },
  /** 짧은 '톡' 소리 (핑퐁: 공이 빠를수록 높게) · f: 높이(Hz) · len: 길이(초) · k: 크기 */
  blip(f, len = 0.04, k = 1) {
    if (!this.on || !this.vol) return;
    this.unlock();
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    try {
      const t0 = c.currentTime + 0.005, o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.vol * 0.22 * k), t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + 0.06);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + len + 0.08);
    } catch { /* 무시 */ }
  },
  /** 게임에서 내 차례가 새로 왔을 때 (멀티에서만 불러요) */
  turn(key, mine) {
    const was = this.turns[key];
    this.turns[key] = !!mine;
    if (mine && !was) this.play('turn');
  },
  /** 위쪽 🔊 버튼 모양 */
  paint() {
    const b = document.getElementById('snd-btn');
    if (b) { b.innerHTML = icon(this.on ? 'volume' : 'volume-3'); b.title = this.on ? '알림음 끄기' : '알림음 켜기'; b.classList.toggle('off', !this.on); }
  },
};
['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, () => Sound.unlock(), { passive: true }));
(() => {
  const b = document.createElement('button');
  b.id = 'snd-btn'; b.className = 'btn ghost sm icon-only snd-btn'; b.dataset.act = 'sndToggle'; b.setAttribute('aria-label', '알림음');
  const theme = document.getElementById('theme-btn');
  theme.parentNode.insertBefore(b, theme);
  Sound.paint();
  ACT.sndToggle = () => { Sound.on = !Sound.on; if (Sound.on) Sound.play('dm'); toast(Sound.on ? '🔊 알림음을 켰어요.' : '🔇 알림음을 껐어요.'); };
})();
