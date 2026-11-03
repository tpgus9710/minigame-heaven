/* =====================================================================
 *  🏓 핑퐁
 * ===================================================================== */
const PONG = { F: 600, R: 8, OFF: 18, HALF: 55, MAXV: 11 };
const SIDE_LIST = [['bottom', 'y', 1, 'x'], ['top', 'y', -1, 'x'], ['right', 'x', 1, 'y'], ['left', 'x', -1, 'y']];
const SIDE_COLOR = { bottom: '#4aa8ff', top: '#ff7a59', left: '#3fcf9b', right: '#a77cff' };
const SIDE_NAME = { bottom: '⬇️ 아래', top: '⬆️ 위', left: '⬅️ 왼쪽', right: '➡️ 오른쪽' };
const Pong = {
  solo: false, role: null, mouse: 300, lastSent: -1, state: null,
  startMulti() {
    stopLocal();
    this.solo = false; const m = me(); this.role = m ? m.role : 'spectator'; this.state = null; this.lastSent = -1;
    $('#pong-title .tt').textContent = '4인 핑퐁';
    $('#pong-status').textContent = this.role === 'spectator' ? '👀 관전 중' : `내 자리: ${SIDE_NAME[this.role]} — 판 위에서 마우스를 움직이세요.`;
    show('pong');
    every(33, () => { if (this.role !== 'spectator' && this.mouse !== this.lastSent) { socket.emit('pong:move', this.mouse); this.lastSent = this.mouse; } });
  },
  startSolo() {
    stopLocal();
    this.solo = true; S.solo = 'pong'; this.role = 'bottom';
    this.g = { sides: { bottom: { a: true, hp: 5, p: 300, n: nick() }, top: { a: true, hp: 5, p: 300, n: '🤖 AI' }, left: { a: false, hp: 0, p: 300 }, right: { a: false, hp: 0, p: 300 } }, ball: null, freeze: 0, hits: 0 };
    this.resetBall();
    $('#pong-title .tt').textContent = '핑퐁 vs AI';
    $('#pong-status').textContent = '마우스로 아래 패들을 움직이세요. 랠리가 길어질수록 공이 빨라져요!';
    show('pong');
    every(33, () => this.soloStep());
  },
  resetBall() {
    const ang = (Math.random() < .5 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - .5) * 1.1;
    this.g.ball = { x: 300, y: 300, vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5 }; this.g.freeze = Date.now() + 900;
  },
  soloStep() {
    const g = this.g, b = g.ball, { F, R, OFF, HALF, MAXV } = PONG;
    g.sides.bottom.p = this.mouse;
    const ai = g.sides.top, target = b.vy < 0 ? b.x + (Math.random() - .5) * 30 : 300;
    ai.p = clamp(ai.p + clamp(target - ai.p, -5.2, 5.2), HALF, F - HALF);
    if (Date.now() >= g.freeze) {
      const px = b.x, py = b.y; b.x += b.vx; b.y += b.vy;
      for (const [name, axis, dir, along] of SIDE_LIST) {
        const s = g.sides[name], vk = axis === 'x' ? 'vx' : 'vy', ok = axis === 'x' ? 'vy' : 'vx';
        if (Math.sign(b[vk]) !== dir) continue;
        const pos = b[axis], prev = axis === 'x' ? px : py;
        if (!s.a) { const wall = dir > 0 ? F : 0; if ((pos + dir * R - wall) * dir >= 0) { b[axis] = wall - dir * R; b[vk] = -b[vk]; } continue; }
        const line = dir > 0 ? F - OFF : OFF;
        const crossed = (prev + dir * R - line) * dir < 0 && (pos + dir * R - line) * dir >= 0;
        if (crossed && Math.abs(b[along] - s.p) <= HALF + R) {
          b[axis] = line - dir * R; b[vk] = -dir * Math.min(Math.abs(b[vk]) * 1.06 + .1, MAXV);
          b[ok] = clamp(b[ok] + (b[along] - s.p) * .07, -MAXV, MAXV);
        } else if ((pos - dir * R - (dir > 0 ? F : 0)) * dir > 0) {
          s.hp--; if (s.hp <= 0) s.a = false;
          this.resetBall();
          if (!g.sides.bottom.a || !g.sides.top.a) {
            const win = g.sides.bottom.a;
            this.draw(this.toState());
            return after(300, () => showResult({ title: win ? '🏆 AI를 이겼어요!' : '💀 AI 승리', subtitle: `남은 목숨 ${g.sides.bottom.hp} : ${g.sides.top.hp}`, solo: 'pong', win: !!win }));
          }
          break;
        }
      }
      for (const k of ['vx', 'vy']) if (Math.abs(g.ball[k]) < 1.5) g.ball[k] = (g.ball[k] >= 0 ? 1 : -1) * 1.5;
    }
    const st = this.toState(); this.draw(st); this.panel(st);
  },
  toState() { return { b: { x: this.g.ball.x, y: this.g.ball.y }, s: this.g.sides }; },
  draw(st) {
    const c = $('#pong-cv').getContext('2d'), F = PONG.F;
    c.fillStyle = '#0b0e1a'; c.fillRect(0, 0, F, F);
    c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2;
    c.beginPath(); c.arc(300, 300, 70, 0, 7); c.stroke();
    c.setLineDash([8, 10]); c.beginPath(); c.moveTo(0, 300); c.lineTo(600, 300); c.moveTo(300, 0); c.lineTo(300, 600); c.stroke(); c.setLineDash([]);
    for (const [name, axis, dir] of SIDE_LIST) {
      const s = st.s[name];
      const mine = name === this.role;
      if (!s.a) {
        c.fillStyle = '#2a3150';
        if (axis === 'y') c.fillRect(0, dir > 0 ? F - 6 : 0, F, 6); else c.fillRect(dir > 0 ? F - 6 : 0, 0, 6, F);
        continue;
      }
      c.fillStyle = SIDE_COLOR[name]; c.shadowColor = SIDE_COLOR[name]; c.shadowBlur = mine ? 18 : 6;
      const L = PONG.HALF * 2, T = 12, line = dir > 0 ? F - PONG.OFF : PONG.OFF;
      if (axis === 'y') c.fillRect(s.p - L / 2, dir > 0 ? line : line - T, L, T);
      else c.fillRect(dir > 0 ? line : line - T, s.p - L / 2, T, L);
      c.shadowBlur = 0;
    }
    c.fillStyle = '#ffd23f'; c.shadowColor = '#ffd23f'; c.shadowBlur = 14;
    c.beginPath(); c.arc(st.b.x, st.b.y, PONG.R, 0, 7); c.fill(); c.shadowBlur = 0;
  },
  panel(st) {
    $('#pong-side').innerHTML = SIDE_LIST.map(([n]) => {
      const s = st.s[n]; const name = this.solo ? s.n : s.n;
      if (!name && !s.a) return '';
      return `<div class="pside ${s.a ? '' : 'dead'} ${n === this.role ? 'me' : ''}" style="border-left-color:${SIDE_COLOR[n]}">
        <div class="small muted">${SIDE_NAME[n]}</div><b>${esc(name || '빈 자리')}${n === this.role ? ' (나)' : ''}</b>
        <div class="hearts">${s.a ? '❤️'.repeat(s.hp) : '💀 탈락'}</div></div>`;
    }).join('');
  },
};
$('#pong-cv').addEventListener('pointermove', e => {
  const cv = $('#pong-cv'), r = cv.getBoundingClientRect(), k = cv.width / r.width;
  const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
  Pong.mouse = Math.round(clamp(Pong.role === 'left' || Pong.role === 'right' ? y : x, PONG.HALF, PONG.F - PONG.HALF));
});
socket.on('pong:start', () => Pong.startMulti());
socket.on('pong:state', st => { if (!isScreen('pong') || Pong.solo) return; Pong.draw(st); Pong.panel(st); });
register('pong', { solo: () => Pong.startSolo(), stop: () => { Pong.solo = false; } });
