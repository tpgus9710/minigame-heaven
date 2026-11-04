/* =====================================================================
 *  🖌️ 그림판 (캐치마인드 · 라이어 공용)
 * ===================================================================== */
const COLORS = ['#222222', '#e8343f', '#2f6fe0', '#22a861', '#ff9a1f', '#8a4bdb', '#8b5a2b'];
class Sketch {
  constructor(name, canvas, toolsEl, extraTools) {
    this.name = name; this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.enabled = false; this.color = COLORS[0]; this.size = 6; this.tools = toolsEl;
    toolsEl.innerHTML = COLORS.map((c, i) => `<button class="sw ${i ? '' : 'on'}" style="background:${c}" data-act="pen" data-color="${c}"></button>`).join('') +
      `<button class="sw" title="지우개" style="background:#fff;border-color:#ccc" data-act="pen" data-color="#ffffff"></button>` +
      [3, 6, 14].map(s => `<button class="szb ${s === 6 ? 'on' : ''}" data-act="size" data-size="${s}"><i style="width:${s + 2}px;height:${s + 2}px"></i></button>`).join('') +
      extraTools;
    let last = null;
    const pt = e => { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    canvas.addEventListener('pointerdown', e => { if (!this.enabled) return; canvas.setPointerCapture(e.pointerId); last = pt(e); this.seg(last, last); });
    canvas.addEventListener('pointermove', e => { if (!last || !this.enabled) return; const p = pt(e); this.seg(last, p); last = p; });
    const stop = () => { last = null; };
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
    this.clear();
  }
  static of(el) { return Sketches[el.closest('[data-sketch]').dataset.sketch]; }
  setColor(c, el) { this.color = c; $$('.sw', this.tools).forEach(b => b.classList.toggle('on', b === el)); if (c === '#ffffff' && this.size < 14) this.setSize(14, $(`.szb[data-size="14"]`, this.tools)); }
  setSize(s, el) { this.size = s; $$('.szb', this.tools).forEach(b => b.classList.toggle('on', b === el)); }
  seg(a, b) {
    const s = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, color: this.color, size: this.size };
    this.line(s); socket.emit('draw', s);
  }
  line(s) {
    const c = this.ctx, W = this.cv.width, H = this.cv.height;
    c.strokeStyle = s.color; c.lineWidth = s.size * (W / 760); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(s.x0 * W, s.y0 * H); c.lineTo(s.x1 * W, s.y1 * H); c.stroke();
  }
  clear() { this.ctx.fillStyle = '#fff'; this.ctx.fillRect(0, 0, this.cv.width, this.cv.height); }
  enable(on) { this.enabled = on; this.tools.classList.toggle('hidden', !on); this.cv.style.cursor = on ? 'crosshair' : 'default'; }
}
const Sketches = {
  catch: new Sketch('catch', $('#catch-cv'), $('#catch-tools'),
    '<button class="btn ghost sm" data-act="clearCanvas">🗑️ 전체 지우기</button><button class="btn bad sm" data-act="catchSkip">⏩ 패스</button>'),
  liar: new Sketch('liar', $('#liar-cv'), $('#liar-tools'), '<button class="btn good sm" data-act="liarPass">✅ 다 그렸어요</button>'),
};
socket.on('draw', s => (isScreen('liar') ? Sketches.liar : Sketches.catch).line(s));
socket.on('draw:clear', () => Sketches.catch.clear());

/* =====================================================================
 *  🎨 캐치마인드
 * ===================================================================== */
const Catch = { endsAt: 0, drawerId: null };
// 채팅창이 접히는 좁은 화면(휴대폰 · 폴드 · 태블릿)에서는 그림 바로 아래에 정답 칸 — 채팅을 열지 않고 그림을 보면서 맞혀요 (보내면 채팅으로 가요)
$('#scr-catch .canvas-box').insertAdjacentHTML('afterend', `<div class="guess-bar hidden" id="catch-guess"><div class="gb-log" id="catch-glog"></div>
  <div class="gb-row"><input type="text" id="catch-guess-input" maxlength="40" autocomplete="off" enterkeyhint="send" placeholder="정답을 입력하세요!"><button class="btn good" data-act="catchGuess">보내기</button></div></div>`);
ACT.catchGuess = () => { const i = $('#catch-guess-input'), v = i.value.trim(); if (!v || !S.code) return; socket.emit('chat', { msg: v }); i.value = ''; i.focus(); };
$('#catch-guess-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); ACT.catchGuess(); } });
socket.on('chat', d => {                                     // 정답 칸 위에 최근 채팅 3줄 (다른 사람이 뭘 쳤는지)
  if (!isScreen('catch') || d.emoji) return;
  const log = $('#catch-glog'), div = document.createElement('div');
  div.className = d.system ? 'sys' : '';
  div.innerHTML = d.system ? esc(d.msg) : `<b>${esc(d.name)}</b>${esc(d.msg)}`;
  log.append(div);
  while (log.children.length > 3) log.firstChild.remove();
});
socket.on('catch:start', () => {
  stopLocal(); Sketches.catch.clear(); Sketches.catch.enable(false);
  $('#catch-guess').classList.add('hidden'); $('#catch-glog').innerHTML = '';
  $('#catch-word').textContent = '곧 시작합니다…';
  show('catch'); renderScores();
  every(250, () => { $('#catch-time').textContent = Catch.endsAt ? secLeft(Catch.endsAt) : '-'; });
});
socket.on('catch:turn', d => {
  Catch.endsAt = Date.now() + d.seconds * 1000; Catch.drawerId = d.drawerId;
  const mine = d.drawerId === S.myId;
  Sketches.catch.clear(); Sketches.catch.enable(mine);
  $('#catch-guess').classList.toggle('hidden', mine);
  $('#catch-turn').textContent = `${d.turn}/${d.total}`;
  $('#catch-status').textContent = mine ? '✏️ 내가 그릴 차례! 글자나 숫자는 쓰면 안 돼요.' : `✏️ ${d.drawerName} 님이 그리는 중 — ${window.innerWidth <= 1100 ? '정답 칸' : '채팅창'}에 정답을 입력하세요!`;
  $('#catch-word').innerHTML = mine ? '제시어를 받는 중…' : `${'○'.repeat(d.length)} <span class="muted small">(${d.length}글자)</span>`;
  $('#chat-input').placeholder = mine ? '메시지 입력…' : '정답을 입력하세요!';
});
socket.on('catch:word', d => { $('#catch-word').innerHTML = `제시어: <span style="color:var(--warn)">${esc(d.word)}</span>`; });
socket.on('catch:solved', d => {
  Catch.endsAt = 0; Sketches.catch.enable(false); $('#catch-guess').classList.add('hidden');
  $('#catch-word').innerHTML = `🎉 ${esc(d.by)} 님 정답! <span style="color:var(--good)">${esc(d.word)}</span>`;
});

/* =====================================================================
 *  🤫 라이어 게임
 * ===================================================================== */
const Liar = { endsAt: 0, isLiar: false };
socket.on('liar:start', d => {
  stopLocal(); Liar.isLiar = d.isLiar; Liar.endsAt = 0;
  Sketches.liar.clear(); Sketches.liar.enable(false);
  $('#liar-vote').classList.add('hidden'); $('#liar-guess').classList.add('hidden'); $('#liar-guess-input').value = '';
  $('#liar-role').innerHTML = d.isLiar
    ? `<div class="muted">당신은</div><div class="rc-big" style="color:var(--bad)">🤫 라이어</div><div>주제: <b>${esc(d.category)}</b><br><span class="small muted">제시어를 모르는 티를 내지 마세요!</span></div>`
    : `<div class="muted">당신은 시민 · 주제 <b>${esc(d.category)}</b></div><div class="rc-big" style="color:var(--good)">${esc(d.word)}</div><div class="small muted">라이어가 눈치채지 못하게 애매하게!</div>`;
  show('liar');
  every(250, () => { $('#liar-time').textContent = Liar.endsAt ? secLeft(Liar.endsAt) : '-'; });
});
socket.on('liar:turn', d => {
  Liar.endsAt = Date.now() + d.seconds * 1000;
  const mine = d.drawerId === S.myId;
  Sound.turn('liar', mine);
  Sketches.liar.enable(mine);
  $('#liar-turn').textContent = `${d.turn}/${d.total}`;
  $('#liar-status').textContent = mine ? '✏️ 내 차례! 한 붓 그리고 "다 그렸어요"를 누르세요.' : `✏️ ${d.drawerName} 님이 그리는 중…`;
});
socket.on('liar:vote', d => {
  Liar.endsAt = Date.now() + d.seconds * 1000;
  Sketches.liar.enable(false);
  $('#liar-turn').textContent = '투표';
  $('#liar-status').textContent = '🗳️ 라이어라고 생각하는 사람에게 투표하세요!';
  $('#liar-vote').classList.remove('hidden');
  $('#liar-vote-list').innerHTML = d.candidates.filter(c => c.id !== S.myId)
    .map(c => `<button class="btn bad" data-act="liarVote" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join('');
});
socket.on('liar:caught', d => {
  Liar.endsAt = Date.now() + d.seconds * 1000;
  $('#liar-vote').classList.add('hidden');
  const mine = d.liarId === S.myId;
  $('#liar-status').textContent = mine ? '🚨 들켰어요! 제시어를 맞히면 역전승!' : `🚨 라이어는 ${d.liarName} 님! 제시어를 맞히는지 지켜보세요…`;
  $('#liar-guess').classList.toggle('hidden', !mine);
  if (mine) $('#liar-guess-input').focus();
});
register('catch', {});
register('liar', {});
