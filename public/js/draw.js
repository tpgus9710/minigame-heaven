/* =====================================================================
 *  🖌️ 그림판 (캐치마인드 · 라이어 공용)
 *  선은 '획'(누르고 떼기까지) 단위로 기억해요 → 캐치마인드는 한 획씩 되돌리기 (모두의 화면에서 같이 지워져요)
 *  지우개는 펜과 굵기를 따로 기억해요 (지우개는 크게: 16 · 32 · 56)
 * ===================================================================== */
const COLORS = ['#222222', '#e8343f', '#2f6fe0', '#22a861', '#ff9a1f', '#8a4bdb', '#8b5a2b'];
const ERASER = '#ffffff', PEN_SIZES = [3, 6, 12], ERASER_SIZES = [16, 32, 56];
class Sketch {
  constructor(name, canvas, toolsEl, extraTools, opt = {}) {
    this.name = name; this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.enabled = false; this.color = COLORS[0]; this.pen = 6; this.era = 32; this.tools = toolsEl;
    this.strokes = []; this.cur = null; this.kn = Math.floor(Math.random() * 1e5) * 1000;   // 획 번호 (다시 접속해도 겹치지 않게)
    this.undoable = !!opt.undo;
    toolsEl.innerHTML = COLORS.map((c, i) => `<button class="sw ${i ? '' : 'on'}" style="background:${c}" data-act="pen" data-color="${c}" aria-label="색"></button>`).join('') +
      `<button class="sw era" title="지우개" aria-label="지우개" data-act="pen" data-color="${ERASER}">${icon('eraser')}</button>` +
      '<span class="szs"></span>' +
      (this.undoable ? `<button class="btn ghost sm sk-undo" data-act="sketchUndo" disabled title="한 획 되돌리기 (Ctrl+Z)">${icon('arrow-back-up')}되돌리기</button>` : '') +
      extraTools;
    this.paintSizes();
    let last = null;
    const pt = e => { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    canvas.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* 이미 끝난 손가락 */ }
      last = pt(e);
      this.cur = { k: ++this.kn, segs: [] }; this.strokes.push(this.cur);
      this.seg(last, last);
    });
    canvas.addEventListener('pointermove', e => { if (!last || !this.enabled) return; const p = pt(e); this.seg(last, p); last = p; });
    const stop = () => { if (last) { last = null; this.cur = null; this.paintUndo(); } };
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
    this.clear();
  }
  static of(el) { return Sketches[el.closest('[data-sketch]').dataset.sketch]; }
  get erasing() { return this.color === ERASER; }
  get size() { return this.erasing ? this.era : this.pen; }
  setColor(c, el) { this.color = c; $$('.sw', this.tools).forEach(b => b.classList.toggle('on', b === el)); this.paintSizes(); }
  setSize(s) { if (this.erasing) this.era = s; else this.pen = s; this.paintSizes(); }
  /** 굵기 단추: 펜이면 펜 굵기, 지우개면 지우개 크기 (동그라미 크기로 보여 줘요) */
  paintSizes() {
    const box = $('.szs', this.tools); if (!box) return;
    const list = this.erasing ? ERASER_SIZES : PEN_SIZES, cur = this.size;
    box.innerHTML = list.map(s => { const d = this.erasing ? Math.round(8 + s / 3.2) : s + 2;
      return `<button class="szb ${s === cur ? 'on' : ''} ${this.erasing ? 'e' : ''}" data-act="size" data-size="${s}" aria-label="${this.erasing ? '지우개 크기' : '펜 굵기'} ${s}"><i style="width:${d}px;height:${d}px"></i></button>`; }).join('');
  }
  paintUndo() { const b = $('.sk-undo', this.tools); if (b) b.disabled = !this.strokes.length; }
  seg(a, b) {
    const s = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, color: this.color, size: this.size, k: this.cur ? this.cur.k : 0 };
    if (this.cur) this.cur.segs.push(s);
    this.line(s); socket.emit('draw', s);
  }
  /** 다른 사람이 그린 선: 같은 획끼리 모아 둬요 (되돌리기 때 다시 그리려고) */
  add(s) {
    let st = this.strokes[this.strokes.length - 1];
    if (!st || st.k !== s.k) { st = this.strokes.find(x => x.k === s.k) || null; if (!st) { st = { k: s.k, segs: [] }; this.strokes.push(st); } }
    st.segs.push(s);
    this.line(s);
  }
  line(s) {
    const c = this.ctx, W = this.cv.width, H = this.cv.height;
    c.strokeStyle = s.color; c.lineWidth = s.size * (W / 760); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(s.x0 * W, s.y0 * H); c.lineTo(s.x1 * W, s.y1 * H); c.stroke();
  }
  /** 마지막 획 하나 지우기 (그리는 사람) → 모두에게 */
  undo() {
    if (!this.enabled || !this.strokes.length || this.cur) return;
    const st = this.strokes.pop();
    this.redraw(); this.paintUndo();
    socket.emit('draw:undo', st.k);
  }
  /** 다른 사람이 되돌린 획 지우기 */
  drop(k) { const i = this.strokes.map(x => x.k).lastIndexOf(k); if (i < 0) return; this.strokes.splice(i, 1); this.redraw(); }
  redraw() { this.wipe(); for (const st of this.strokes) for (const s of st.segs) this.line(s); }
  wipe() { this.ctx.fillStyle = '#fff'; this.ctx.fillRect(0, 0, this.cv.width, this.cv.height); }
  clear() { this.strokes = []; this.cur = null; this.wipe(); this.paintUndo(); }
  enable(on) { this.enabled = on; this.tools.classList.toggle('hidden', !on); this.cv.style.cursor = on ? 'crosshair' : 'default'; this.paintUndo(); }
}
const Sketches = {
  catch: new Sketch('catch', $('#catch-cv'), $('#catch-tools'),
    `<button class="btn ghost sm" data-act="clearCanvas">${icon('trash')}전체 지우기</button><button class="btn bad sm" data-act="catchSkip">⏩ 패스</button>`, { undo: true }),
  liar: new Sketch('liar', $('#liar-cv'), $('#liar-tools'), '<button class="btn good sm" data-act="liarPass">✅ 다 그렸어요</button>'),
};
ACT.sketchUndo = el => Sketch.of(el).undo();
socket.on('draw', s => (isScreen('liar') ? Sketches.liar : Sketches.catch).add(s));
socket.on('draw:undo', d => { if (d && isScreen('catch')) Sketches.catch.drop(d.k); });
socket.on('draw:clear', () => Sketches.catch.clear());

/* =====================================================================
 *  🎨 캐치마인드
 * ===================================================================== */
const Catch = { endsAt: 0, drawerId: null };
// 채팅창이 접히는 좁은 화면(휴대폰 · 폴드 · 태블릿)에서는 그림 바로 아래에 정답 칸 — 채팅을 열지 않고 그림을 보면서 맞혀요 (보내면 채팅으로 가요)
$('#scr-catch .canvas-box').insertAdjacentHTML('afterend', `<div class="guess-bar hidden" id="catch-guess">
  <div class="gb-row"><input type="text" id="catch-guess-input" maxlength="40" autocomplete="off" enterkeyhint="send" placeholder="정답을 입력하세요!"><button class="btn good" data-act="catchGuess">보내기</button></div></div>`);
ACT.catchGuess = () => { const i = $('#catch-guess-input'), v = i.value.trim(); if (!v || !S.code) return; socket.emit('chat', { msg: v }); i.value = ''; i.focus(); };
$('#catch-guess-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); ACT.catchGuess(); } });
/** 그림 위 말풍선: 누가 뭐라고 맞혔는지 그리는 사람 · 맞히는 사람 모두 바로 봐요 (웃긴 오답 구경하는 재미!)
 *  왼쪽 위에 쌓이고 5초 뒤 사라져요 · 그림은 그대로 그릴 수 있어요 (말풍선은 터치를 막지 않아요) */
const CatchFeed = {
  HUES: [12, 200, 140, 280, 40, 330, 90, 240],
  hue(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return this.HUES[h % this.HUES.length]; },
  max() { const cv = $('#catch-cv'); return cv && cv.getBoundingClientRect().height < 300 ? 3 : 4; },
  push(d) {
    const box = $('#catch-feed'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'cm-bub' + (d.system ? ' sys' : '') + (d.id === S.myId ? ' mine' : '');
    if (d.system) el.textContent = d.msg;
    else { el.style.setProperty('--h', this.hue(d.id)); el.innerHTML = `<b>${esc(d.name)}</b>${esc(d.msg)}`; }
    box.append(el);
    while (box.children.length > this.max()) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, d.system ? 3800 : 5200);
  },
  clear() { const box = $('#catch-feed'); if (box) box.innerHTML = ''; },
};
socket.on('chat', d => { if (isScreen('catch') && !d.emoji && d.msg) CatchFeed.push(d); });
socket.on('catch:start', () => {
  stopLocal(); Sketches.catch.clear(); Sketches.catch.enable(false);
  $('#catch-guess').classList.add('hidden'); CatchFeed.clear();
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
  $('#catch-status').textContent = mine ? '✏️ 내가 그릴 차례! 글자나 숫자는 쓰면 안 돼요.' : `✏️ ${d.drawerName} 님이 그리는 중 — ${CHAT_FLOAT.matches ? '정답 칸' : '채팅창'}에 정답을 입력하세요!`;
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
register('catch', { key: e => { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); Sketches.catch.undo(); } } });
register('liar', {});
