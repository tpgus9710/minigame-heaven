/* =====================================================================
 *  🏐 점프 배구 (싱글: vs AI / 멀티: 1:1) — 물리는 shared/volley-core.js
 * ===================================================================== */
const VB_KEYS = { l: ['ArrowLeft', 'KeyA'], r: ['ArrowRight', 'KeyD'], u: ['ArrowUp', 'KeyW'], d: ['ArrowDown', 'KeyS'], p: ['Space', 'Enter', 'KeyZ'] };
makeScreen('volley', {
  title: '🏐 점프 배구', status: '←→ 이동 · ↑ 점프 · 공중에서 스페이스 = 스파이크 (↑↓로 방향) · 땅에서 방향키+스페이스 = 슬라이딩',
  stats: [['score', '점수'], ['target', '목표']],
  body: `<div class="mode-row" id="volley-levels"><button class="seg-btn" data-act="volleyLv" data-lv="0.35">쉬움</button><button class="seg-btn" data-act="volleyLv" data-lv="0.65">보통</button><button class="seg-btn" data-act="volleyLv" data-lv="0.95">어려움</button></div>
  <div class="center"><canvas id="volley-cv" class="game-cv" width="800" height="500"></canvas></div>`,
});

const Volley = {
  lv: 0.65,
  startSolo(lv) {
    stopLocal();
    if (lv) this.lv = lv;
    S.solo = 'volley';
    Object.assign(this, { mode: 'solo', side: 0, names: [nick(), '컴퓨터'], press: false, acc: 0, over: false, disp: null, msg: null });
    this.s = VolleyCore.newGame(15, 0);
    $('#volley-levels').classList.remove('hidden');
    $$('#volley-levels .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.lv === this.lv));
    setStat('volley', 'target', '15점'); setStat('volley', 'score', '0 : 0');
    show('volley');
    gameLoop(dt => {
      this.acc = Math.min(0.1, this.acc + dt);
      while (this.acc >= 1 / 60) {
        this.acc -= 1 / 60;
        const me = this.input(); this.press = false;
        VolleyCore.step(this.s, [me, VolleyCore.ai(this.s, 1, this.lv)]);
        if (this.s.events.includes('point')) this.onPoint(this.s.lastPoint);
        if (this.s.phase === 'over' && !this.over) { this.over = true; after(1200, () => this.finishSolo()); }
      }
      this.render(VolleyCore.snap(this.s), dt);
    });
  },
  input() { const i = {}; for (const k of ['l', 'r', 'u', 'd']) i[k] = held(...VB_KEYS[k]); i.p = this.press; return i; },
  onPoint(side) { this.msg = { txt: `${this.names[side]} 득점!`, t: 1.2 }; setStat('volley', 'score', `${this.s.score[0]} : ${this.s.score[1]}`); },
  finishSolo() {
    const win = this.s.winner === 0;
    showResult({ title: win ? '🏆 승리!' : '😢 아쉽게 졌어요', subtitle: `${this.s.score[0]} : ${this.s.score[1]} · 난이도 ${{ 0.35: '쉬움', 0.65: '보통', 0.95: '어려움' }[this.lv]}`, solo: 'volley', win });
  },
  startMulti(d) {
    stopLocal();
    Object.assign(this, { mode: 'multi', names: d.names, side: d.ids.indexOf(S.myId), mask: 0, disp: null, latest: null, msg: null, over: false });
    $('#volley-levels').classList.add('hidden');
    setStat('volley', 'target', d.target + '점'); setStat('volley', 'score', '0 : 0');
    setStatus('volley', this.side < 0 ? '👀 관전 중이에요' : `나는 ${this.side ? '🔴 오른쪽' : '🔵 왼쪽'} 코트! ←→ 이동 · ↑ 점프 · 스페이스 스파이크`);
    show('volley'); renderScores();
    gameLoop(dt => { if (this.latest) this.render(this.latest, dt); });
  },
  sendInput() {
    if (this.mode !== 'multi' || this.side < 0) return;
    const bits = { l: 1, r: 2, u: 4, d: 8, p: 16 };
    let m = 0;
    for (const k in bits) if (held(...VB_KEYS[k])) m |= bits[k];
    if (m !== this.mask) { this.mask = m; socket.emit('volley:in', m); }
  },
  onState(st) {
    if (!isScreen('volley') || this.mode !== 'multi') return;
    if (this.latest && st.sc[0] + st.sc[1] > this.latest.sc[0] + this.latest.sc[1]) {
      const side = st.sc[0] > this.latest.sc[0] ? 0 : 1;
      this.msg = { txt: `${this.names[side]} 득점!`, t: 1.2 };
      setStat('volley', 'score', `${st.sc[0]} : ${st.sc[1]}`);
    }
    this.latest = st;
  },

  render(st, dt) {
    const V = VolleyCore, c = $('#volley-cv').getContext('2d'), { W, H, GROUND, NET_X, NET_HALF, NET_TOP, PR, BR } = V;
    if (!this.disp) this.disp = JSON.parse(JSON.stringify(st));
    const k = this.mode === 'multi' ? Math.min(1, dt * 20) : 1, d = this.disp;   // 멀티는 부드럽게 따라가기
    d.b[0] += (st.b[0] - d.b[0]) * k; d.b[1] += (st.b[1] - d.b[1]) * k;
    st.p.forEach((p, i) => { d.p[i][0] += (p[0] - d.p[i][0]) * k; d.p[i][1] += (p[1] - d.p[i][1]) * k; d.p[i][2] = p[2]; d.p[i][3] = p[3]; });
    const sky = c.createLinearGradient(0, 0, 0, GROUND); sky.addColorStop(0, '#16233f'); sky.addColorStop(0.55, '#4a3a6b'); sky.addColorStop(1, '#f08a4b');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(W * 0.72, GROUND - 40, 10, W * 0.72, GROUND - 40, 120); sun.addColorStop(0, 'rgba(255,214,140,.95)'); sun.addColorStop(0.35, 'rgba(255,170,90,.55)'); sun.addColorStop(1, 'rgba(255,140,80,0)');
    c.fillStyle = sun; c.fillRect(0, 0, W, GROUND);
    c.fillStyle = 'rgba(12,16,32,.75)';                                                     // 관중석 실루엣
    for (let x = 0, k = 0; x < W; x += 46, k++) { const h = 38 + ((k * 37) % 5) * 7; c.fillRect(x, GROUND - h, 44, h); }
    c.fillStyle = 'rgba(255,230,170,.55)'; for (let x = 23, k = 0; x < W; x += 46, k++) if (k % 3 === 0) { c.beginPath(); c.arc(x, GROUND - 52 - ((k * 37) % 5) * 7, 2.2, 0, 7); c.fill(); }
    const sand = c.createLinearGradient(0, GROUND, 0, H); sand.addColorStop(0, '#d9a75f'); sand.addColorStop(1, '#a8743a');
    c.fillStyle = sand; c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = 'rgba(90,50,20,.25)'; for (let x = 10; x < W; x += 37) c.fillRect(x, GROUND + 12 + (x % 3) * 8, 14, 3);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, GROUND, W, 3);
    c.fillStyle = 'rgba(0,0,0,.18)';
    const sh = (x, y, r) => { const s = Math.max(0.3, 1 - (GROUND - y) / 400); c.beginPath(); c.ellipse(x, GROUND + 4, r * s, 6 * s, 0, 0, 7); c.fill(); };
    sh(d.b[0], d.b[1], BR); d.p.forEach(p => sh(p[0], p[1], PR));
    // 네트
    c.fillStyle = '#ddd'; c.fillRect(NET_X - 3, NET_TOP - 10, 6, GROUND - NET_TOP + 10);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(NET_X - NET_HALF, NET_TOP, NET_HALF * 2, 90);
    c.strokeStyle = 'rgba(80,80,80,.35)'; c.lineWidth = 1;
    for (let y = NET_TOP; y < NET_TOP + 90; y += 9) { c.beginPath(); c.moveTo(NET_X - NET_HALF, y); c.lineTo(NET_X + NET_HALF, y); c.stroke(); }
    c.fillStyle = '#fff'; c.fillRect(NET_X - NET_HALF - 2, NET_TOP - 4, NET_HALF * 2 + 4, 6);
    d.p.forEach((p, i) => this.drawPlayer(c, p, i));
    // 공
    const [bx, by] = d.b, rot = performance.now() / 120;
    if (st.hit > 0) { c.fillStyle = 'rgba(255,120,60,.35)'; c.beginPath(); c.arc(bx, by, BR + 8, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.strokeStyle = '#3a6ea5'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(bx, by, BR, 0, 7); c.fill(); c.stroke();
    c.save(); c.translate(bx, by); c.rotate(rot); c.strokeStyle = '#f2b631'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, BR * 0.62, -1.2, 1.2); c.stroke(); c.beginPath(); c.arc(0, 0, BR * 0.62, 1.9, 4.4); c.stroke(); c.restore();
    // 점수
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 6; c.font = '54px \"Black Han Sans\", sans-serif';
    c.strokeText(st.sc[0], W / 2 - 80, 62); c.fillText(st.sc[0], W / 2 - 80, 62); c.strokeText(st.sc[1], W / 2 + 80, 62); c.fillText(st.sc[1], W / 2 + 80, 62);
    c.font = 'bold 15px "Noto Sans KR", sans-serif'; c.lineWidth = 4;
    c.strokeText(this.names[0], W / 2 - 80, 86); c.fillText(this.names[0], W / 2 - 80, 86); c.strokeText(this.names[1], W / 2 + 80, 86); c.fillText(this.names[1], W / 2 + 80, 86);
    if (st.ph === 'ready') { c.font = '36px \"Black Han Sans\", sans-serif'; c.lineWidth = 6; c.strokeText('준비!', W / 2, 160); c.fillText('준비!', W / 2, 160); }
    if (this.msg && (this.msg.t -= dt) > 0) { c.font = '40px \"Black Han Sans\", sans-serif'; c.lineWidth = 6; c.strokeText(this.msg.txt, W / 2, 200); c.fillText(this.msg.txt, W / 2, 200); }
  },
  /** 선수: 팀 색 몸통 · 헤어밴드 · 등번호 · 눈썹 (보는 방향으로 눈이 움직여요) */
  drawPlayer(c, p, i) {
    const [x, y, st, dir] = p, R = VolleyCore.PR, body = i ? '#ff6b5b' : '#3fa7ff', dark = i ? '#b3261e' : '#1f5fbf', light = i ? '#ffc2b8' : '#bfe3ff';
    c.save(); c.translate(x, y);
    let sx = 1, sy = 1;
    if (st === 'dive') { sx = 1.35; sy = 0.7; } else if (st === 'jump' || st === 'spike') { sx = 0.92; sy = 1.08; } else if (st === 'recover') { sx = 1.15; sy = 0.85; }
    c.scale(sx, sy);
    c.fillStyle = '#151a26'; c.beginPath(); c.ellipse(-14, R - 3, 12, 6, 0, 0, 7); c.ellipse(14, R - 3, 12, 6, 0, 0, 7); c.fill();
    const g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R); g.addColorStop(0, light); g.addColorStop(0.55, body); g.addColorStop(1, dark);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, R, 0, 7); c.clip();
    c.fillStyle = '#f4f6fb'; c.fillRect(-R, -R * 0.72, R * 2, 8);                             // 헤어밴드
    c.fillStyle = dark; c.fillRect(-R, -R * 0.72 + 3, R * 2, 2);
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(-R, R * 0.25, R * 2, R);                  // 유니폼 아랫부분
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.92)'; c.font = '15px "Black Han Sans", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(i ? '2' : '1', dir * 3, R * 0.52);
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(dir * 8 - 7, -6, 5, 4, 0, 0, 7); c.ellipse(dir * 8 + 7, -6, 5, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#111522'; c.beginPath(); c.arc(dir * 8 - 7 + dir * 1.5, -6, 2.6, 0, 7); c.arc(dir * 8 + 7 + dir * 1.5, -6, 2.6, 0, 7); c.fill();
    c.strokeStyle = '#111522'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(dir * 8 - 12, -13); c.lineTo(dir * 8 - 3, -11); c.moveTo(dir * 8 + 12, -13); c.lineTo(dir * 8 + 3, -11); c.stroke();
    c.beginPath(); c.moveTo(dir * 8 - 4, 4); c.lineTo(dir * 8 + 4, 4); c.stroke();
    if (st === 'spike') {
      c.fillStyle = body; c.beginPath(); c.ellipse(dir * (R - 2), -R + 6, 9, 16, dir * 0.6, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(dir * (R + 10), -R); c.lineTo(dir * (R + 22), -R - 8); c.moveTo(dir * (R + 12), -R + 10); c.lineTo(dir * (R + 26), -R + 6); c.stroke();
    }
    c.restore();
    if (this.mode === 'multi' && i === this.side) { c.fillStyle = '#fff'; c.font = 'bold 13px "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.fillText('나', x, y - R - 22); }
  },
};
ACT.volleyLv = el => Volley.startSolo(+el.dataset.lv);
register('volley', {
  solo: () => Volley.startSolo(),
  stop: () => { Volley.over = true; },
  key: e => { if (VB_KEYS.p.includes(e.code) && !e.repeat) Volley.press = true; Volley.sendInput(); },
  keyup: () => Volley.sendInput(),
  pad: ['ArrowLeft', 'ArrowRight', '|', 'ArrowUp', 'Space'], padLabel: { ArrowUp: '점프', Space: '스파이크' },
});
socket.on('volley:start', d => Volley.startMulti(d));
socket.on('volley:s', st => Volley.onState(st));
