/* =====================================================================
 *  🛡️ 탱크 대포 (싱글: AI 2대 / 멀티: 2~6명) — 계산은 shared/tank-core.js
 * ===================================================================== */
makeScreen('tank', {
  title: '🛡️ 탱크 대포', status: '←→ 이동 · ↑↓ 각도 · 스페이스를 꾹 눌렀다 떼면 발사 · 1/2/3 무기',
  stats: [['turn', '차례'], ['wind', '바람'], ['time', '남은 시간']],
  body: `<div class="center"><canvas id="tank-cv" class="game-cv" width="960" height="540"></canvas></div>
  <div class="tank-bar">
    <div class="tank-weapons" id="tank-weapons"></div>
    <div class="tank-read"><span>각도 <b id="tank-angle">-</b>°</span><span>힘 <b id="tank-power">-</b></span><span>연료 <b id="tank-fuel">-</b></span></div>
    <button class="btn good" id="tank-fire">🔥 꾹 눌러서 발사</button>
  </div>`,
});

const Tank = {
  startSolo() {
    stopLocal();
    S.solo = 'tank';
    const s = TankCore.newGame([{ id: 'me', name: nick() }, { id: 'ai1', name: 'AI 하나', bot: true }, { id: 'ai2', name: 'AI 둘', bot: true }], Math.random);
    Object.assign(this, { mode: 'solo', myId: 'me', s, over: false });
    this.mirror(s.h, s.tanks, TankCore.view(s));
    show('tank');
    after(800, () => this.turnStart());
    this.loop();
  },
  startMulti(d) {
    stopLocal();
    Object.assign(this, { mode: 'multi', myId: S.myId, s: null, over: false });
    this.mirror(d.h, d.tanks, d.view);
    show('tank'); renderScores();
    this.loop();
  },
  /** 화면에 그릴 상태 (싱글은 엔진 상태를 복사, 멀티는 서버가 보낸 값) */
  mirror(h, info, view) {
    this.v = { h: h.slice(), wind: 0, activeId: null, tanks: info.map(t => ({ id: t.id, name: t.name, color: t.color, ...view.find(x => x.id === t.id) })) };
    Object.assign(this, { anim: null, charging: false, power: 50, lastPower: null, weapon: 'normal', moveDir: 0, deadline: 0, aimSent: 0, fx: [] });
  },
  me() { return this.v.tanks.find(t => t.id === this.myId); },
  myTurn() { return this.v.activeId === this.myId && !this.anim && !this.over; },
  loop() { gameLoop((dt, now) => { this.update(dt, now); this.draw(dt, now); }); },

  turnStart() {
    const s = this.s, t = TankCore.active(s);
    this.v.activeId = t.id; this.v.wind = s.wind; this.deadline = performance.now() + 30000;
    this.sync(TankCore.view(s));
    if (t.bot) {
      after(900, () => {
        const plan = TankCore.aiPlan(s, t.id, 0.55);
        const vt = this.v.tanks.find(x => x.id === t.id), a0 = vt.angle, t0 = performance.now();
        this.aiAim = { id: t.id, from: a0, to: plan.angle, t0, done: () => this.fireSolo(t.id, plan.angle, plan.power, plan.weapon) };
      });
    } else { this.power = this.me().power; this.updateBar(); }
  },
  sync(view) { view.forEach(u => Object.assign(this.v.tanks.find(t => t.id === u.id), u)); this.updateBar(); },
  fireSolo(id, angle, power, weapon) {
    const r = TankCore.fire(this.s, id, angle, power, weapon);
    this.playShot(r, () => {
      if (this.s.over) return this.finishSolo();
      TankCore.nextTurn(this.s); this.turnStart();
    });
  },
  finishSolo() {
    this.over = true;
    const win = this.s.winner === 'me';
    showResult({ title: win ? '🏆 승리! 모든 AI 탱크를 물리쳤어요' : '💥 내 탱크가 파괴됐어요', subtitle: `남은 HP ${this.s.tanks[0].hp}`, solo: 'tank', win });
  },
  fire() {
    if (!this.myTurn()) return;
    const t = this.me();
    this.lastPower = this.power;
    if (this.mode === 'solo') this.fireSolo(t.id, t.angle, this.power, this.weapon);
    else { socket.emit('tank:fire', { angle: t.angle, power: Math.round(this.power), weapon: this.weapon }); this.v.activeId = null; }
    this.weapon = 'normal';
  },
  /** 포탄 궤적 → 폭발 → 지형·체력 반영 */
  playShot(r, done) {
    const vt = this.v.tanks.find(t => t.id === r.id);
    if (vt) { vt.angle = r.angle; }
    this.anim = { paths: r.shots, t: 0, r, done, booms: r.booms.map(b => ({ ...b, shown: false })) };
  },
  update(dt, now) {
    const t = this.me();
    if (this.aiAim) {
      const a = this.aiAim, k = Math.min(1, (now - a.t0) / 700), vt = this.v.tanks.find(x => x.id === a.id);
      vt.angle = Math.round(a.from + (a.to - a.from) * k);
      if (k >= 1) { this.aiAim = null; a.done(); }
    }
    if (this.anim) {
      const A = this.anim;
      A.t += dt * 60;                                              // 궤적 1점 = 2프레임
      const idx = A.t / 2, maxLen = Math.max(...A.paths.map(p => p.length));
      for (const p of A.paths) {
        if (idx < p.length - 1) continue;
        const end = p[p.length - 1];
        const b = A.booms.find(b => !b.shown && Math.hypot(b.x - end[0], b.y - end[1]) < 6);
        if (b) { b.shown = true; this.fx.push({ x: b.x, y: b.y, r: b.r, t: 0.5 }); b.hits.forEach(h => { const vt = this.v.tanks.find(x => x.id === h.id); if (vt) this.fx.push({ x: vt.x, y: vt.y - 40, txt: '-' + h.dmg, t: 1.2 }); }); }
      }
      if (idx >= maxLen + 25) {                                    // 다 날아가면 결과 반영
        this.v.h = A.r.h.slice(); this.sync(A.r.tanks);
        (A.r.falls || []).forEach(f => { const vt = this.v.tanks.find(x => x.id === f.id); if (vt) this.fx.push({ x: vt.x, y: vt.y - 40, txt: '-' + f.dmg, t: 1.2 }); });
        const done = A.done; this.anim = null;
        if (done) done();
      }
    }
    if (this.myTurn() && t) {
      const da = (held('ArrowUp', 'KeyW') ? 1 : 0) - (held('ArrowDown', 'KeyS') ? 1 : 0);
      if (da) { t.angle = clamp(t.angle + da * 45 * dt, 0, 180); this.sendAim(now); }
      const mv = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
      if (this.mode === 'solo') { if (mv && TankCore.move(this.s, 'me', mv, dt)) this.sync(TankCore.view(this.s)); }
      else if (mv !== this.moveDir) { this.moveDir = mv; socket.emit('tank:move', mv); }
      if (this.charging) { this.power = Math.min(100, this.power + 62 * dt); }
      if (now > this.deadline && this.mode === 'solo') { this.charging = false; this.fire(); }
      this.updateBar();
    }
    const left = Math.max(0, Math.ceil((this.deadline - now) / 1000));
    const act = this.v.tanks.find(x => x.id === this.v.activeId);
    setStat('tank', 'turn', act ? (act.id === this.myId ? '내 차례!' : act.name) : '…');
    setStat('tank', 'wind', this.v.wind === 0 ? '없음' : `${this.v.wind > 0 ? '→' : '←'} ${Math.abs(this.v.wind)}`);
    setStat('tank', 'time', act ? left + '초' : '-');
  },
  sendAim(now) {
    if (this.mode !== 'multi' || now - this.aimSent < 90) return;
    this.aimSent = now; const t = this.me();
    socket.emit('tank:aim', { angle: Math.round(t.angle), power: Math.round(this.power) });
  },
  updateBar() {
    const t = this.me();
    if (!t) return;
    $('#tank-angle').textContent = Math.round(t.angle); $('#tank-power').textContent = Math.round(this.power); $('#tank-fuel').textContent = Math.round(t.fuel || 0);
    const ammo = t.ammo || {};
    $('#tank-weapons').innerHTML = Object.entries(TankCore.WEAPONS).map(([k, w]) => {
      const n = k === 'normal' ? '∞' : ammo[k] || 0;
      return `<button class="btn sm ${this.weapon === k ? 'good' : 'ghost'}" data-act="tankWeapon" data-w="${k}" ${n === 0 ? 'disabled' : ''}>${w.icon} ${w.name} <small>${n}</small></button>`;
    }).join('');
    $('#tank-fire').disabled = !this.myTurn();
  },

  draw(dt, now) {
    const c = $('#tank-cv').getContext('2d'), W = 960, H = 540, v = this.v;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#203a6b'); g.addColorStop(1, '#f2a65a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(40,40,80,.35)'; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, 260 + Math.sin(x * 0.01) * 40 + Math.sin(x * 0.023) * 25);
    c.lineTo(W, H); c.fill();
    c.fillStyle = '#5a3d2b'; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x < W; x++) c.lineTo(x, v.h[x]);
    c.lineTo(W, H); c.fill();
    c.strokeStyle = '#7ac74f'; c.lineWidth = 5; c.beginPath();
    for (let x = 0; x < W; x++) x ? c.lineTo(x, v.h[x]) : c.moveTo(x, v.h[x]);
    c.stroke();
    c.textAlign = 'center';
    for (const t of v.tanks) {
      if (!t.alive) { c.fillStyle = '#333'; c.beginPath(); c.roundRect(t.x - 15, t.y - 8, 30, 8, 3); c.fill(); continue; }
      const a = (t.angle * Math.PI) / 180;
      c.strokeStyle = '#222'; c.lineWidth = 5; c.beginPath(); c.moveTo(t.x, t.y - 12); c.lineTo(t.x + Math.cos(a) * 22, t.y - 12 - Math.sin(a) * 22); c.stroke();
      c.fillStyle = t.color; c.beginPath(); c.arc(t.x, t.y - 11, 9, Math.PI, 0); c.fill();
      c.beginPath(); c.roundRect(t.x - 16, t.y - 12, 32, 10, 4); c.fill();
      c.fillStyle = '#2b2b2b'; c.beginPath(); c.roundRect(t.x - 17, t.y - 4, 34, 6, 3); c.fill();
      c.fillStyle = '#111'; c.fillRect(t.x - 18, t.y - 34, 36, 5); c.fillStyle = t.hp > 50 ? '#3fcf9b' : t.hp > 25 ? '#ffc24b' : '#ff5d73'; c.fillRect(t.x - 18, t.y - 34, 36 * t.hp / 100, 5);
      c.fillStyle = '#fff'; c.font = 'bold 12px "Noto Sans KR", sans-serif'; c.fillText(t.id === this.myId ? `나 (${t.name})` : t.name, t.x, t.y - 40);
      if (t.id === v.activeId && !this.anim) { const bob = Math.sin(now / 150) * 4; c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(t.x - 8, t.y - 62 + bob); c.lineTo(t.x + 8, t.y - 62 + bob); c.lineTo(t.x, t.y - 52 + bob); c.fill(); }
      if (t.id === this.myId && this.myTurn()) {
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([4, 5]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(t.x + Math.cos(a) * 24, t.y - 12 - Math.sin(a) * 24); c.lineTo(t.x + Math.cos(a) * 80, t.y - 12 - Math.sin(a) * 80); c.stroke(); c.setLineDash([]);
      }
    }
    if (this.anim) {
      const idx = this.anim.t / 2;
      for (const p of this.anim.paths) {
        const i = Math.min(p.length - 1, Math.floor(idx));
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath();
        for (let j = Math.max(0, i - 12); j <= i; j++) j === Math.max(0, i - 12) ? c.moveTo(p[j][0], p[j][1]) : c.lineTo(p[j][0], p[j][1]);
        c.stroke();
        if (idx < p.length - 1) { c.fillStyle = '#111'; c.beginPath(); c.arc(p[i][0], p[i][1], 5, 0, 7); c.fill(); }
      }
    }
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    for (const f of this.fx) {
      if (f.txt) { c.globalAlpha = Math.min(1, f.t); c.fillStyle = '#ff5d73'; c.font = 'bold 20px \"Black Han Sans\", sans-serif'; c.fillText(f.txt, f.x, f.y - (1.2 - f.t) * 25); c.globalAlpha = 1; }
      else { const k = 1 - f.t / 0.5; c.fillStyle = `rgba(255,${160 - k * 100},40,${1 - k})`; c.beginPath(); c.arc(f.x, f.y, f.r * (0.4 + k * 0.8), 0, 7); c.fill(); }
    }
    // 바람
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.roundRect(W / 2 - 90, 10, 180, 30, 8); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 14px "Noto Sans KR", sans-serif'; c.fillText(`바람 ${v.wind === 0 ? '없음' : (v.wind > 0 ? '→ ' : '← ') + Math.abs(v.wind)}`, W / 2, 30);
    if (v.wind) { c.fillStyle = '#7ef9ff'; const len = Math.abs(v.wind) * 6, x0 = W / 2 - (v.wind > 0 ? 0 : len); c.fillRect(x0, 36, len, 3); }
    // 힘 게이지
    if (this.myTurn()) {
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(20, H - 34, 240, 18);
      c.fillStyle = this.charging ? '#ff9f43' : '#ffd23f'; c.fillRect(20, H - 34, 2.4 * this.power, 18);
      if (this.lastPower != null) { c.fillStyle = '#fff'; c.fillRect(20 + 2.4 * this.lastPower - 1, H - 38, 2, 26); }
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(`힘 ${Math.round(this.power)}`, 268, H - 20);
    }
  },
};
(() => {
  const btn = $('#tank-fire');
  btn.addEventListener('pointerdown', e => { if (!Tank.myTurn()) return; e.preventDefault(); Tank.charging = true; Tank.power = 0; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, () => { if (Tank.charging) { Tank.charging = false; Tank.fire(); } }));
})();
ACT.tankWeapon = el => { Tank.weapon = el.dataset.w; Tank.updateBar(); };
register('tank', {
  solo: () => Tank.startSolo(),
  stop: () => { Tank.over = true; Tank.aiAim = null; },
  key: e => {
    if (e.code === 'Space' && !e.repeat && Tank.myTurn()) { Tank.charging = true; Tank.power = 0; }
    const w = { Digit1: 'normal', Digit2: 'big', Digit3: 'triple' }[e.code];
    if (w) { const t = Tank.me(); if (w === 'normal' || (t && t.ammo && t.ammo[w] > 0)) { Tank.weapon = w; Tank.updateBar(); } }
  },
  keyup: e => { if (e.code === 'Space' && Tank.charging) { Tank.charging = false; Tank.fire(); } },
  pad: ['ArrowLeft', 'ArrowRight', '|', 'ArrowUp', 'ArrowDown', 'Space'], padLabel: { Space: '발사' },
});
socket.on('tank:start', d => Tank.startMulti(d));
socket.on('tank:turn', d => {
  if (!isScreen('tank') || Tank.mode !== 'multi') return;
  Tank.v.activeId = d.id; Tank.v.wind = d.wind; Tank.deadline = performance.now() + d.seconds * 1000; Tank.moveDir = 0;
  Tank.sync(d.tanks);
  if (d.id === S.myId) { Tank.power = Tank.me().power; toast('🎯 내 차례예요!', 'info'); }
});
socket.on('tank:aim', d => { const t = Tank.v && Tank.v.tanks.find(x => x.id === d.id); if (t) { t.angle = d.angle; } });
socket.on('tank:pos', d => { const t = Tank.v && Tank.v.tanks.find(x => x.id === d.id); if (t) Object.assign(t, { x: d.x, y: d.y, fuel: d.fuel }); if (d.id === Tank.myId) Tank.updateBar(); });
socket.on('tank:shot', r => { if (isScreen('tank') && Tank.mode === 'multi') { Tank.v.activeId = null; Tank.playShot(r, null); } });
socket.on('tank:log', d => toast(d.msg, 'info'));
