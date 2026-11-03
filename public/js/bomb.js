/* =====================================================================
 *  💥 폭탄 배틀 (싱글: 봇 3마리 / 멀티: 2~6명) — 규칙은 shared/bomb-core.js
 * ===================================================================== */
const BB = { CELL: 40 };
const BB_DIR = { ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2, ArrowDown: 3, KeyS: 3, ArrowLeft: 4, KeyA: 4 };
makeScreen('bomb', {
  title: '💥 폭탄 배틀', status: '방향키로 이동 · 스페이스로 폭탄! 상자를 부수면 아이템이 나와요.',
  stats: [['me', '내 능력'], ['time', '남은 시간']],
  body: `<div class="center"><canvas id="bomb-cv" class="game-cv" width="${15 * 40}" height="${13 * 40}"></canvas></div>`,
});

const Bomb = {
  startSolo() {
    stopLocal();
    S.solo = 'bomb';
    const bots = ['봇 토리', '봇 루루', '봇 짱구'];
    this.s = BombCore.newGame([{ id: 'me', name: nick() }, ...bots.map((n, i) => ({ id: 'bot' + i, name: n, bot: true }))], Math.random);
    Object.assign(this, { mode: 'solo', myId: 'me', dirs: [], press: false, acc: 0, over: false, fx: [] });
    this.info = this.s.players.map(p => ({ id: p.id, name: p.name, color: p.color }));
    this.snap = BombCore.snap(this.s);
    show('bomb');
    this.t0 = performance.now() + 1500;
    gameLoop((dt, now) => {
      if (now >= this.t0 && !this.s.over) {
        this.acc = Math.min(0.2, this.acc + dt);
        while (this.acc >= BombCore.TICK) {
          this.acc -= BombCore.TICK;
          BombCore.step(this.s, { me: { dir: this.dir(), bomb: this.press } });
          this.press = false;
          this.events(this.s.events);
        }
        this.snap = BombCore.snap(this.s);
        if (this.s.over && !this.over) { this.over = true; after(1200, () => this.finishSolo()); }
      }
      this.draw(dt, now < this.t0 ? Math.ceil((this.t0 - now) / 1000) : 0);
    });
  },
  finishSolo() {
    const s = this.s, me = s.players[0], win = s.winner === 'me';
    showResult({ title: win ? '🏆 최후의 생존자!' : s.winner ? '💥 패배…' : '🤝 무승부', subtitle: `${me.kills}킬 · ${win ? '봇들을 모두 이겼어요!' : '다시 도전해 보세요'}`, solo: 'bomb' });
  },
  startMulti(d) {
    stopLocal();
    Object.assign(this, { mode: 'multi', myId: S.myId, dirs: [], info: d.players, snap: d.snap, fx: [], lastDir: 0 });
    show('bomb'); renderScores();
    this.t0 = performance.now() + d.delay;
    gameLoop((dt, now) => this.draw(dt, now < this.t0 ? Math.ceil((this.t0 - now) / 1000) : 0));
  },
  dir() { for (let i = this.dirs.length - 1; i >= 0; i--) if (Keys.has(this.dirs[i])) return BB_DIR[this.dirs[i]]; return 0; },
  sendInput(bomb) {
    if (this.mode !== 'multi') return;
    const d = this.dir();
    if (d !== this.lastDir || bomb) { this.lastDir = d; socket.emit('bomb:in', { dir: d, bomb: !!bomb }); }
  },
  events(evs) {
    for (const e of evs) {
      if (e.e === 'boom') this.fx.push({ x: e.x, y: e.y, t: 0.25 });
      if (e.e === 'item' && e.id === this.myId) this.fx.push({ x: null, txt: { b: '💣 폭탄 +1', f: '🔥 화력 +1', s: '👟 속도 업' }[e.it], t: 1 });
    }
  },
  onState(st) { if (!isScreen('bomb') || this.mode !== 'multi') return; this.snap = st; this.events(st.ev || []); },

  draw(dt, countdown) {
    const c = $('#bomb-cv').getContext('2d'), C = BB.CELL, sn = this.snap;
    if (!sn) return;
    for (let y = 0; y < 13; y++) for (let x = 0; x < 15; x++) {
      const ch = sn.g[y * 15 + x], px = x * C, py = y * C;
      c.fillStyle = (x + y) % 2 ? '#2d3b33' : '#334238'; c.fillRect(px, py, C, C);
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.strokeRect(px + .5, py + .5, C - 1, C - 1);
      if (ch === '#') {          // 쇠기둥
        const g = c.createLinearGradient(px, py, px, py + C); g.addColorStop(0, '#7b8496'); g.addColorStop(1, '#3e4555');
        c.fillStyle = '#262b36'; c.fillRect(px, py, C, C);
        c.fillStyle = g; c.beginPath(); c.roundRect(px + 2, py + 1, C - 4, C - 6, 5); c.fill();
        c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(px + 5, py + 4, C - 10, 3);
        c.fillStyle = '#1b1f28'; [[8, 9], [C - 8, 9], [8, C - 13], [C - 8, C - 13]].forEach(([dx, dy]) => { c.beginPath(); c.arc(px + dx, py + dy, 1.8, 0, 7); c.fill(); });
      } else if (ch === 'x') {   // 나무 상자
        c.fillStyle = '#8a5a2b'; c.beginPath(); c.roundRect(px + 2, py + 2, C - 4, C - 4, 4); c.fill();
        c.fillStyle = '#a8713a'; for (let k = 0; k < 3; k++) c.fillRect(px + 4, py + 5 + k * ((C - 10) / 3), C - 8, (C - 10) / 3 - 2);
        c.strokeStyle = '#5a3a1a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(px + 6, py + 6); c.lineTo(px + C - 6, py + C - 6); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(px + 3, py + 3, C - 6, C - 6);
      }
    }
    for (const it of sn.i) {   // 아이템: 폭탄 +1 / 화력 / 속도
      const [k, v] = it.split(':'), [x, y] = k.split(',').map(Number), cx = x * C + C / 2, cy = y * C + C / 2;
      const col = { b: '#4aa8ff', f: '#ff6b3d', s: '#3fe08f' }[v];
      c.save(); c.shadowColor = col; c.shadowBlur = 10;
      c.fillStyle = '#141821'; c.beginPath(); c.roundRect(cx - 14, cy - 14, 28, 28, 8); c.fill();
      c.strokeStyle = col; c.lineWidth = 2; c.stroke(); c.restore();
      c.fillStyle = col; c.strokeStyle = col;
      if (v === 'b') { c.beginPath(); c.arc(cx - 2, cy + 2, 7, 0, 7); c.fill(); c.lineWidth = 2; c.beginPath(); c.moveTo(cx + 3, cy - 3); c.lineTo(cx + 7, cy - 8); c.stroke(); c.fillStyle = '#fff'; c.fillRect(cx + 5, cy + 3, 6, 2); c.fillRect(cx + 7, cy + 1, 2, 6); }
      else if (v === 'f') { c.beginPath(); c.moveTo(cx, cy - 10); c.quadraticCurveTo(cx + 9, cy - 1, cx + 6, cy + 6); c.quadraticCurveTo(cx, cy + 11, cx - 6, cy + 6); c.quadraticCurveTo(cx - 9, cy - 1, cx, cy - 10); c.fill(); c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(cx, cy - 2); c.quadraticCurveTo(cx + 4, cy + 3, cx + 2, cy + 6); c.quadraticCurveTo(cx, cy + 8, cx - 2, cy + 6); c.quadraticCurveTo(cx - 4, cy + 3, cx, cy - 2); c.fill(); }
      else { c.beginPath(); c.moveTo(cx + 3, cy - 10); c.lineTo(cx - 6, cy + 2); c.lineTo(cx, cy + 2); c.lineTo(cx - 3, cy + 10); c.lineTo(cx + 6, cy - 2); c.lineTo(cx, cy - 2); c.closePath(); c.fill(); }
    }
    for (const k of sn.f) {    // 불길
      const [x, y] = k.split(',').map(Number), px = x * C, py = y * C;
      const g = c.createRadialGradient(px + C / 2, py + C / 2, 2, px + C / 2, py + C / 2, C * 0.7);
      g.addColorStop(0, '#fff7c2'); g.addColorStop(0.35, '#ffd23f'); g.addColorStop(0.75, '#ff6b1a'); g.addColorStop(1, 'rgba(255,60,0,.15)');
      c.fillStyle = g; c.beginPath(); c.roundRect(px + 1, py + 1, C - 2, C - 2, 9); c.fill();
    }
    const now = performance.now();
    for (const [x, y, t] of sn.b) {
      const s = 1 + Math.sin(now / (60 + t * 60)) * 0.08, cx = x * C + C / 2, cy = y * C + C / 2 + 2;
      c.fillStyle = '#20232f'; c.beginPath(); c.arc(cx, cy, 14 * s, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx - 5, cy - 5, 4, 0, 7); c.fill();
      c.strokeStyle = '#8a6b3c'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + 6, cy - 10); c.lineTo(cx + 10, cy - 17); c.stroke();
      c.fillStyle = Math.floor(now / 90) % 2 ? '#ffde59' : '#ff5d2b'; c.beginPath(); c.arc(cx + 11, cy - 18, 4, 0, 7); c.fill();
    }
    sn.p.forEach((p, i) => {
      const [x, y, dir, alive, moving] = p, inf = this.info[i];
      if (!alive || !inf) return;
      const px = x * C, py = y * C + (moving ? Math.sin(now / 70) * 1.5 : 0);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, py + 14, 13, 4, 0, 0, 7); c.fill();
      // 헬멧 전사: 색 헬멧 + 어두운 바이저(보는 방향으로 움직임)
      const g = c.createRadialGradient(px - 5, py - 6, 2, px, py, 16); g.addColorStop(0, '#fff'); g.addColorStop(0.25, inf.color); g.addColorStop(1, 'rgba(0,0,0,.55)');
      c.fillStyle = inf.color; c.beginPath(); c.arc(px, py, 14, 0, 7); c.fill();
      c.fillStyle = g; c.globalAlpha = 0.55; c.beginPath(); c.arc(px, py, 14, 0, 7); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 14, 0, 7); c.stroke();
      const ex = [0, 0, 4, 0, -4][dir], ey = [0, -4, 0, 3, 0][dir];
      c.fillStyle = '#10131c'; c.beginPath(); c.roundRect(px - 9 + ex, py - 5 + ey, 18, 8, 4); c.fill();
      c.fillStyle = 'rgba(120,220,255,.85)'; c.fillRect(px - 6 + ex * 1.2, py - 3 + ey, 5, 2);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(px - 6, py - 8, 3, 0, 7); c.fill();
      c.font = 'bold 11px "Noto Sans KR", sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
      const label = inf.id === this.myId ? '나' : inf.name;
      c.strokeText(label, px, py - 22); c.fillText(label, px, py - 22);
    });
    this.fx = this.fx.filter(f => (f.t -= dt) > 0);
    for (const f of this.fx) {
      if (f.txt) { c.globalAlpha = Math.min(1, f.t * 2); c.font = 'bold 22px \"Black Han Sans\", sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#333'; c.lineWidth = 4; c.strokeText(f.txt, 300, 260 - (1 - f.t) * 30); c.fillText(f.txt, 300, 260 - (1 - f.t) * 30); c.globalAlpha = 1; }
      else { c.fillStyle = `rgba(255,240,180,${f.t * 3})`; c.beginPath(); c.arc(f.x * C + C / 2, f.y * C + C / 2, 30 * (1 - f.t * 2) + 10, 0, 7); c.fill(); }
    }
    const mi = this.info.findIndex(p => p.id === this.myId), me = sn.p[mi];
    setStat('bomb', 'me', me ? `폭탄${me[5]} 화력${me[6]} 속도${me[7].toFixed(1)}` : '관전');
    setStat('bomb', 'time', sn.t + '초');
    if (me && !me[3]) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 230, 600, 60); c.fillStyle = '#fff'; c.font = '30px \"Black Han Sans\", sans-serif'; c.fillText('탈락! 남은 사람들을 지켜봐요', 300, 262); }
    if (countdown) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, 600, 520); c.fillStyle = '#fff'; c.font = '72px \"Black Han Sans\", sans-serif'; c.fillText(countdown, 300, 262); }
  },
};
register('bomb', {
  solo: () => Bomb.startSolo(),
  stop: () => { Bomb.over = true; },
  key: e => {
    if (BB_DIR[e.code]) { Bomb.dirs = Bomb.dirs.filter(k => k !== e.code).concat(e.code); Bomb.sendInput(false); }
    if (['Space', 'Enter', 'KeyX'].includes(e.code) && !e.repeat) { Bomb.press = true; Bomb.sendInput(true); }
  },
  keyup: e => { if (BB_DIR[e.code]) { Bomb.dirs = Bomb.dirs.filter(k => k !== e.code); Bomb.sendInput(false); } },
  pad: ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight', '|', 'Space'], padLabel: { Space: '💣' },
});
socket.on('bomb:start', d => Bomb.startMulti(d));
socket.on('bomb:s', st => Bomb.onState(st));
