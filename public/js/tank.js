/* =====================================================================
 *  🛡️ 탱크 대포 (싱글: AI 2대 / 멀티: 2~6명) — 계산은 shared/tank-core.js
 *  v13.3: 무기 칸을 바뀔 때만 다시 그려요(내 차례에도 눌려요) · 🚁 보급 헬기 · ❤️ 회복 키트 · 🔆 광역 레이저 · ☄️ 유성우
 * ===================================================================== */
makeScreen('tank', {
  title: '🛡️ 탱크 대포', status: '←→ 이동 · ↑↓ 각도 · 스페이스를 꾹 눌렀다 떼면 발사 · 1~5 무기 · 🚁 보급 상자는 닿거나 쏴서 가져가요',
  stats: [['turn', '차례'], ['wind', '바람'], ['time', '남은 시간']],
  body: `<div class="center"><canvas id="tank-cv" class="game-cv" width="960" height="540"></canvas><div class="tank-note" id="tank-note" aria-live="polite"></div></div>
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
    this.mirror(s.h, s.tanks, TankCore.view(s), TankCore.items(s));
    show('tank');
    after(800, () => this.turnStart());
    this.loop();
  },
  startMulti(d) {
    stopLocal();
    Object.assign(this, { mode: 'multi', myId: S.myId, s: null, over: false });
    this.mirror(d.h, d.tanks, d.view, d.items);
    show('tank'); renderScores();
    this.loop();
  },
  /** 화면에 그릴 상태 (싱글은 엔진 상태를 복사, 멀티는 서버가 보낸 값) */
  mirror(h, info, view, items) {
    this.v = { h: h.slice(), wind: 0, activeId: null, items: (items || []).slice(), tanks: info.map(t => ({ id: t.id, name: t.name, color: t.color, ...view.find(x => x.id === t.id) })) };
    Object.assign(this, { anim: null, charging: false, power: 50, lastPower: null, weapon: 'normal', moveDir: 0, deadline: 0, aimSent: 0, fx: [],
      heli: null, pending: new Set(), falling: new Map(), barSig: '' });
    this.h0 = h.slice(); this.carved = [];
    $('#tank-note').innerHTML = '';
    this.paintTerrain();
  },
  /** 판 위쪽에 잠깐 뜨는 알림 (아래쪽 알림은 무기 칸 · 발사 버튼을 가려서 판 안에 띄워요) */
  note(txt, cls = '') {
    const box = $('#tank-note'); if (!box) return;
    const el = document.createElement('div');
    el.className = cls; el.textContent = txt; box.append(el);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => el.remove(), 2600);
  },
  /** 땅 그림 (따로 그려 두고 포탄이 터지면 그 자리만 둥글게 지워요) */
  paintTerrain() {
    const tc = this.terr || (this.terr = document.createElement('canvas'));
    tc.width = 960; tc.height = 540;
    const c = tc.getContext('2d'), h = this.h0;
    const g = c.createLinearGradient(0, 160, 0, 540); g.addColorStop(0, '#6b4931'); g.addColorStop(1, '#3e291c');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 540);
    for (let x = 0; x < 960; x++) c.lineTo(x, h[x]);
    c.lineTo(960, 540); c.fill();
    c.strokeStyle = '#7ac74f'; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath();
    for (let x = 0; x < 960; x++) x ? c.lineTo(x, h[x]) : c.moveTo(x, h[x]);
    c.stroke();
    for (const k of this.carved) this.carveDraw(k);
  },
  carveDraw([x, y, r]) {
    const c = this.terr.getContext('2d');
    c.save();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'source-atop'; c.strokeStyle = 'rgba(28,14,6,.6)'; c.lineWidth = 6; c.beginPath(); c.arc(x, y, r + 2, 0, Math.PI * 2); c.stroke();
    c.restore();
  },
  carve(k) { this.carved.push(k); this.carveDraw(k); },
  me() { return this.v.tanks.find(t => t.id === this.myId); },
  myTurn() { return this.v.activeId === this.myId && !this.anim && !this.over; },
  loop() { gameLoop((dt, now) => { this.update(dt, now); this.draw(dt, now); }); },

  turnStart() {
    const s = this.s, t = TankCore.active(s);
    this.v.activeId = t.id; this.v.wind = s.wind; this.deadline = performance.now() + 30000;
    this.sync(TankCore.view(s));
    this.v.items = TankCore.items(s);
    if (s.drop) { this.startHeli(s.drop); s.drop = null; }
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
    if (this.anim) this.endAnim();                                 // 앞 발사가 아직 그려지는 중이면 (창을 내려 뒀다가 등) 마저 반영
    const vt = this.v.tanks.find(t => t.id === r.id);
    if (vt) { vt.angle = r.angle; }
    const carves = r.carves || r.booms.map(b => [b.x, b.y, b.r]), base = carves.length - r.booms.length;
    if (r.carves && this.carved.length !== base) { this.carved = carves.slice(0, base); this.paintTerrain(); }   // 놓친 폭발이 있으면 다시 그리기
    this.anim = { paths: r.shots, t: 0, r, done, booms: r.booms.map((b, i) => ({ ...b, k: carves[base + i], shown: false })) };
  },
  /** 발사 그리기를 끝내고 결과 반영 (터지지 않은 폭발도 땅에 반영) */
  endAnim() {
    const A = this.anim; if (!A) return;
    A.booms.forEach(b => { if (!b.shown) { b.shown = true; this.carve(b.k); } });
    this.v.h = A.r.h.slice(); this.sync(A.r.tanks);
    if (A.r.items) this.v.items = A.r.items;
    this.handleGot(A.r.got);
    (A.r.falls || []).forEach(f => { const vt = this.v.tanks.find(x => x.id === f.id); if (vt) this.fx.push({ x: vt.x, y: vt.y - 40, txt: '-' + f.dmg, t: 1.2 }); });
    const done = A.done; this.anim = null;
    if (done) done();
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
        if (b) {
          b.shown = true; this.carve(b.k); this.fx.push({ x: b.x, y: b.y, r: b.r, t: 0.5 });
          if (b.beam) this.fx.push({ beam: true, x: b.x, y: b.y, r: b.r, t: 0.9 });           // 🔆 하늘에서 빛기둥
          b.hits.forEach(h => { const vt = this.v.tanks.find(x => x.id === h.id); if (vt) this.fx.push({ x: vt.x, y: vt.y - 40, txt: '-' + h.dmg, t: 1.2 }); });
        }
      }
      if (idx >= maxLen + 25) this.endAnim();                     // 다 날아가면 결과 반영
    }
    if (this.myTurn() && t) {
      const da = (held('ArrowUp', 'KeyW') ? 1 : 0) - (held('ArrowDown', 'KeyS') ? 1 : 0);
      if (da) { t.angle = clamp(t.angle + da * 45 * dt, 0, 180); this.sendAim(now); }
      const mv = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
      if (this.mode === 'solo') {
        if (mv && TankCore.move(this.s, 'me', mv, dt)) this.sync(TankCore.view(this.s));
        if (this.s.got.length) { this.handleGot(this.s.got.splice(0)); this.v.items = TankCore.items(this.s); this.sync(TankCore.view(this.s)); }   // 상자에 닿았어요
      }
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
  /** 무기 칸 · 숫자: 무기 칸은 바뀔 때만 다시 그려요 (매 프레임 다시 그리면 내 차례에 버튼을 누르는 사이 버튼이 바뀌어 안 눌렸어요) */
  updateBar() {
    const t = this.me();
    if (!t) return;
    $('#tank-angle').textContent = Math.round(t.angle); $('#tank-power').textContent = Math.round(this.power); $('#tank-fuel').textContent = Math.round(t.fuel || 0);
    const ammo = t.ammo || {}, keys = Object.keys(TankCore.WEAPONS);
    const sig = `${this.weapon}|${keys.map(k => ammo[k] || 0).join(',')}`;
    if (sig !== this.barSig) {
      this.barSig = sig;
      $('#tank-weapons').innerHTML = Object.entries(TankCore.WEAPONS).map(([k, w], i) => {
        const n = k === 'normal' ? '∞' : ammo[k] || 0;
        if (w.drop && !n) return '';                                         // 보급 특별탄은 얻었을 때만
        return `<button class="btn sm ${this.weapon === k ? 'good' : 'ghost'}${w.drop ? ' sp' : ''}" data-act="tankWeapon" data-w="${k}" ${n === 0 ? 'disabled' : ''} title="${w.name} (숫자 ${i + 1})">${w.icon} ${w.name} <small>${n}</small></button>`;
      }).join('');
    }
    $('#tank-fire').disabled = !this.myTurn();
  },
  /* ── 🚁 보급 ── */
  startHeli(drop) {
    if (!drop) return;
    this.pending.add(drop.id);
    this.heli = { drop, dir: drop.dir || 1, t0: performance.now(), dur: 3400, dropped: false };
    const it = TankCore.ITEMS[drop.kind];
    this.note(`🚁 보급 헬기! ${it.icon} ${it.name} 상자 — 닿거나 쏴서 가져가요`);
  },
  /** 상자를 누가 가져갔어요 (이동 · 포탄) */
  handleGot(list) {
    for (const g of list || []) {
      this.pending.delete(g.item); this.falling.delete(g.item);
      if (g.lost) { this.fx.push({ x: g.x, y: g.y - 24, txt: '💨', t: 1, col: '#ddd' }); continue; }
      const it = TankCore.ITEMS[g.kind], vt = this.v.tanks.find(x => x.id === g.id);
      this.fx.push({ x: vt ? vt.x : g.x, y: (vt ? vt.y : g.y) - 58, txt: g.kind === 'heal' ? (g.hp ? `+${g.hp} HP` : 'HP 가득') : `${it.icon} ${it.name}!`, t: 1.8, col: g.kind === 'heal' ? '#3fcf9b' : '#ffd23f' });
      if (g.id === this.myId) this.note(g.kind === 'heal' ? (g.hp ? `❤️ 회복 키트! HP +${g.hp}` : '❤️ 회복 키트 — HP가 이미 가득해요') : `${it.icon} ${it.name}를 얻었어요! 무기 칸에서 골라 쏘세요 (숫자 ${g.kind === 'laser' ? 4 : 5})`, g.kind === 'heal' ? 'good' : 'gold');
      else this.note(`${g.name} 님이 ${it.icon} ${it.name}를 가져갔어요`);
      Sound.play('pop');
    }
    if (list && list.length) { this.barSig = ''; this.updateBar(); }
  },
  /** 상자 (내려오는 중이면 낙하산) */
  drawItems(c, now) {
    for (const it of this.v.items || []) {
      if (this.pending.has(it.id)) continue;
      let y = it.y;
      const f = this.falling.get(it.id);
      if (f) {
        const k = Math.min(1, (now - f.t0) / f.dur);
        y = f.y0 + (it.y - f.y0) * k;
        if (k >= 1) this.falling.delete(it.id);
        else {                                                               // 낙하산
          c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(it.x - 9, y - 16); c.lineTo(it.x - 16, y - 40); c.moveTo(it.x + 9, y - 16); c.lineTo(it.x + 16, y - 40); c.stroke();
          c.fillStyle = it.kind === 'heal' ? '#ff5d73' : it.kind === 'laser' ? '#ffd23f' : '#a77cff'; c.beginPath(); c.arc(it.x, y - 40, 18, Math.PI, 0); c.fill();
        }
      }
      const glow = 0.5 + Math.sin(now / 260 + it.id) * 0.25;
      c.fillStyle = `rgba(255,255,200,${glow * 0.35})`; c.beginPath(); c.arc(it.x, y - 8, 17, 0, 7); c.fill();
      c.fillStyle = it.kind === 'heal' ? '#f4f4f4' : it.kind === 'laser' ? '#3b3f8f' : '#3a2b55';
      c.strokeStyle = '#2b2b2b'; c.lineWidth = 2; c.beginPath(); c.roundRect(it.x - 11, y - 17, 22, 17, 3); c.fill(); c.stroke();
      if (it.kind === 'heal') { c.fillStyle = '#e2453c'; c.fillRect(it.x - 2.5, y - 14, 5, 11); c.fillRect(it.x - 6.5, y - 11, 13, 5); }
      else { c.font = '13px sans-serif'; c.textAlign = 'center'; c.fillText(TankCore.ITEMS[it.kind].icon, it.x, y - 4); }
    }
  },
  drawHeli(c, now) {
    const h = this.heli; if (!h) return;
    const k = (now - h.t0) / h.dur, W = 960;
    if (k >= 1) { if (!h.dropped) { this.pending.delete(h.drop.id); } this.heli = null; return; }
    const x = h.dir > 0 ? -90 + (W + 180) * k : W + 90 - (W + 180) * k, y = 66 + Math.sin(now / 300) * 4;
    if (!h.dropped && (h.dir > 0 ? x >= h.drop.x : x <= h.drop.x)) { h.dropped = true; this.pending.delete(h.drop.id); this.falling.set(h.drop.id, { y0: y + 30, t0: now, dur: 1400 }); }
    c.save(); c.translate(x, y); c.scale(h.dir > 0 ? 1 : -1, 1);
    c.strokeStyle = '#26323a'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(-46, -4); c.stroke();                          // 꼬리
    c.lineWidth = 3; c.beginPath(); c.moveTo(-46, -12); c.lineTo(-46, 4); c.stroke();          // 꼬리 날개
    c.fillStyle = '#3f6b3f'; c.beginPath(); c.ellipse(0, 0, 24, 13, 0, 0, 7); c.fill();       // 몸통
    c.fillStyle = '#a8e0ff'; c.beginPath(); c.ellipse(11, -3, 9, 7, 0, 0, 7); c.fill();       // 창
    c.strokeStyle = '#26323a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-14, 16); c.lineTo(16, 16); c.moveTo(-8, 12); c.lineTo(-8, 16); c.moveTo(10, 12); c.lineTo(10, 16); c.stroke();
    c.beginPath(); c.moveTo(0, -13); c.lineTo(0, -18); c.stroke();
    const sp = Math.abs(Math.sin(now / 35)) * 34 + 6;                                           // 프로펠러
    c.strokeStyle = 'rgba(30,30,30,.85)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-sp, -19); c.lineTo(sp, -19); c.stroke();
    if (!h.dropped) { c.fillStyle = '#e8d6a8'; c.strokeStyle = '#2b2b2b'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-8, 20, 16, 12, 2); c.fill(); c.stroke(); }
    c.restore();
  },

  draw(dt, now) {
    const c = $('#tank-cv').getContext('2d'), W = 960, H = 540, v = this.v;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#203a6b'); g.addColorStop(1, '#f2a65a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(40,40,80,.35)'; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, 260 + Math.sin(x * 0.01) * 40 + Math.sin(x * 0.023) * 25);
    c.lineTo(W, H); c.fill();
    if (this.terr) c.drawImage(this.terr, 0, 0);
    this.drawItems(c, now);
    c.textAlign = 'center';
    const ease = Math.min(1, dt * 14);
    for (const t of v.tanks) {
      // 보이는 자리는 실제 자리를 부드럽게 따라가요 (멀티는 1초에 15번 오는 위치 사이를, 떨어질 때는 툭 떨어지지 않게)
      if (t.dx == null || Math.abs(t.x - t.dx) > 120) { t.dx = t.x; t.dy = t.y; t.dr = t.tilt || 0; }
      t.dx += (t.x - t.dx) * ease; t.dy += (t.y - t.dy) * ease; t.dr += ((t.tilt || 0) - t.dr) * ease;
      const x = t.dx, y = t.dy, r = Math.max(-1.35, Math.min(1.35, t.dr));
      c.save(); c.translate(x, y); c.rotate(r);                    // ⛰️ 몸체는 바퀴 밑 땅 경사만큼 기울어요
      if (!t.alive) { c.fillStyle = '#333'; c.beginPath(); c.roundRect(-15, -8, 30, 8, 3); c.fill(); c.restore(); continue; }
      c.fillStyle = t.color; c.beginPath(); c.arc(0, -11, 9, Math.PI, 0); c.fill();
      c.beginPath(); c.roundRect(-16, -12, 32, 10, 4); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-14, -11, 28, 2);
      c.fillStyle = '#2b2b2b'; c.beginPath(); c.roundRect(-17, -4, 34, 6, 3); c.fill();
      c.fillStyle = '#555'; for (const wx of [-12, -4, 4, 12]) { c.beginPath(); c.arc(wx, -1, 2, 0, 7); c.fill(); }
      c.restore();
      const a = (t.angle * Math.PI) / 180, px = x + Math.sin(r) * 12, py = y - Math.cos(r) * 12;   // 포신 뿌리도 같이 기울고, 각도는 땅 기준
      c.strokeStyle = '#222'; c.lineWidth = 5; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * 22, py - Math.sin(a) * 22); c.stroke();
      c.fillStyle = t.color; c.beginPath(); c.arc(px, py, 4, 0, 7); c.fill();
      c.fillStyle = '#111'; c.fillRect(x - 18, y - 38, 36, 5); c.fillStyle = t.hp > 50 ? '#3fcf9b' : t.hp > 25 ? '#ffc24b' : '#ff5d73'; c.fillRect(x - 18, y - 38, 36 * t.hp / 100, 5);
      c.fillStyle = '#fff'; c.font = 'bold 12px "Noto Sans KR", sans-serif'; c.fillText(t.id === this.myId ? `나 (${t.name})` : t.name, x, y - 44);
      if (t.id === v.activeId && !this.anim) { const bob = Math.sin(now / 150) * 4; c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(x - 8, y - 66 + bob); c.lineTo(x + 8, y - 66 + bob); c.lineTo(x, y - 56 + bob); c.fill(); }
      if (t.id === this.myId && this.myTurn()) {
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([4, 5]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(px + Math.cos(a) * 24, py - Math.sin(a) * 24); c.lineTo(px + Math.cos(a) * 80, py - Math.sin(a) * 80); c.stroke(); c.setLineDash([]);
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
    this.drawHeli(c, now);
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    for (const f of this.fx) {
      if (f.beam) {                                                                             // 🔆 광역 레이저 빛기둥
        const k = f.t / 0.9, w = f.r * 2 * (0.55 + 0.45 * k);
        const gr = c.createLinearGradient(f.x - w / 2, 0, f.x + w / 2, 0);
        gr.addColorStop(0, 'rgba(255,240,120,0)'); gr.addColorStop(0.5, `rgba(255,255,230,${0.85 * k})`); gr.addColorStop(1, 'rgba(255,240,120,0)');
        c.fillStyle = gr; c.fillRect(f.x - w / 2, 0, w, f.y + 12);
        c.fillStyle = `rgba(255,255,255,${0.9 * k})`; c.fillRect(f.x - 4, 0, 8, f.y + 8);
        continue;
      }
      if (f.txt) { c.globalAlpha = Math.min(1, f.t); c.fillStyle = f.col || '#ff5d73'; c.font = 'bold 20px \"Black Han Sans\", sans-serif'; c.fillText(f.txt, f.x, f.y - (1.2 - f.t) * 25); c.globalAlpha = 1; }
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
    const w = { Digit1: 'normal', Digit2: 'big', Digit3: 'triple', Digit4: 'laser', Digit5: 'meteor' }[e.code];
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
  if (d.items) Tank.v.items = d.items;
  if (d.drop) Tank.startHeli(d.drop);
  if (d.id === S.myId) { Tank.power = Tank.me().power; Tank.note('🎯 내 차례예요!', 'good'); }
  Sound.turn('tank', d.id === S.myId);
});
socket.on('tank:aim', d => { const t = Tank.v && Tank.v.tanks.find(x => x.id === d.id); if (t) { t.angle = d.angle; } });
socket.on('tank:pos', d => { const t = Tank.v && Tank.v.tanks.find(x => x.id === d.id); if (t) Object.assign(t, { x: d.x, y: d.y, fuel: d.fuel, tilt: d.tilt || 0 }); if (d.id === Tank.myId) Tank.updateBar(); });
socket.on('tank:shot', r => { if (isScreen('tank') && Tank.mode === 'multi') { Tank.v.activeId = null; Tank.playShot(r, null); } });
socket.on('tank:log', d => { if (isScreen('tank')) Tank.note(d.msg); else toast(d.msg, 'info'); });
socket.on('tank:item', d => {                                              // 이동하다 상자에 닿았어요
  if (!isScreen('tank') || Tank.mode !== 'multi' || !d) return;
  Tank.sync(d.tanks); Tank.v.items = d.items || []; Tank.handleGot(d.got);
});
