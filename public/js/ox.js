/* =====================================================================
 *  ⭕ OX 퀴즈 (멀티) — 문제마다 10초 안에 O 또는 X를 고르고 「확정」
 *  고른 답은 정답 공개 때까지 비밀 (몇 명이 무엇을 골랐는지도 안 보여요) · 확정 전에는 바꿀 수 있어요
 *  모두 확정하면 바로 정답 공개 · 시간이 다 되면 마지막으로 고른 답으로 (보너스 없음)
 * ===================================================================== */
makeScreen('ox', {
  title: '⭕ OX 퀴즈', status: '고른 뒤 확정! 빨리 확정할수록 보너스 (키보드: O·← / X·→ 고르기 · Enter 확정)',
  stats: [['n', '문제'], ['time', '남은 시간']],
  body: `<div class="ox-wrap">
    <div class="ox-q" id="ox-q">곧 시작합니다…</div>
    <div class="ox-bar"><div id="ox-bar"></div></div>
    <div class="ox-btns"><button class="ox-btn o" data-act="oxPick" data-v="1">⭕</button><button class="ox-btn x" data-act="oxPick" data-v="0">❌</button></div>
    <button class="btn good ox-lock" id="ox-lock" data-act="oxLock" disabled>⭕ 또는 ❌를 골라요</button>
    <div class="ox-count" id="ox-count"></div>
    <div class="ox-reveal hidden" id="ox-reveal"></div>
  </div>`,
});
const OX = {
  /** 고르기 (확정 전에는 몇 번이든 바꿀 수 있어요) */
  pick(v) {
    if (this.phase !== 'ask' || this.locked) return;
    this.mine = v; socket.emit('ox:pick', v);
    $$('.ox-btn').forEach(b => b.classList.toggle('chosen', +b.dataset.v === +v));
    this.paintLock();
  },
  /** 확정: 이제 못 바꿔요. 모두 확정하면 바로 정답 공개 */
  lock() {
    if (this.phase !== 'ask' || this.locked || this.mine == null) return;
    this.locked = true; socket.emit('ox:lock');
    $$('.ox-btn').forEach(b => { b.disabled = true; });
    this.paintLock();
  },
  paintLock() {
    const b = $('#ox-lock'); if (!b) return;
    b.disabled = this.phase !== 'ask' || this.locked || this.mine == null;
    b.classList.toggle('done', !!this.locked);
    b.textContent = this.phase !== 'ask' ? (this.phase === 'reveal' ? '정답 공개!' : '곧 시작해요') : this.locked ? `✓ ${this.mine ? '⭕' : '❌'} 확정했어요` : this.mine == null ? '⭕ 또는 ❌를 골라요' : `${this.mine ? '⭕' : '❌'} 확정하기`;
  },
};
ACT.oxPick = el => OX.pick(!!+el.dataset.v);
ACT.oxLock = () => OX.lock();
register('ox', { key: e => {
  if (['KeyO', 'ArrowLeft', 'Digit1'].includes(e.code)) OX.pick(true);
  if (['KeyX', 'ArrowRight', 'Digit2'].includes(e.code)) OX.pick(false);
  if (['Enter', 'Space', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); OX.lock(); }
} });
socket.on('ox:start', d => { stopLocal(); Object.assign(OX, { phase: 'wait', mine: null, locked: false }); show('ox'); renderScores(); $('#ox-q').textContent = `OX 퀴즈 ${d.total}문제! 곧 시작합니다…`; $('#ox-reveal').classList.add('hidden'); OX.paintLock(); });
socket.on('ox:q', d => {
  if (!isScreen('ox')) return;
  Object.assign(OX, { phase: 'ask', mine: null, locked: false, endAt: performance.now() + d.seconds * 1000, total: d.seconds });
  $('#ox-q').textContent = `Q${d.n}. ${d.q}`; setStat('ox', 'n', `${d.n} / ${d.total}`);
  $('#ox-reveal').classList.add('hidden'); $('#ox-count').textContent = '고른 답은 정답 공개 때까지 아무도 몰라요 🤫';
  $$('.ox-btn').forEach(b => { b.classList.remove('chosen', 'right', 'wrong'); b.disabled = false; });
  OX.paintLock();
  clearInterval(OX.timer);
  OX.timer = every(100, () => {
    const left = Math.max(0, OX.endAt - performance.now());
    $('#ox-bar').style.width = (left / (OX.total * 10)) + '%';
    setStat('ox', 'time', Math.ceil(left / 1000) + '초');
  });
});
socket.on('ox:locked', d => { if (OX.phase === 'ask') $('#ox-count').textContent = d.n ? `확정 ${d.n} / ${d.total}명 · 모두 확정하면 바로 정답 공개` : '고른 답은 정답 공개 때까지 아무도 몰라요 🤫'; });
socket.on('ox:reveal', d => {
  OX.phase = 'reveal';
  clearInterval(OX.timer);
  $$('.ox-btn').forEach(b => { b.disabled = true; b.classList.add(!!+b.dataset.v === d.answer ? 'right' : 'wrong'); });
  const names = id => { const p = S.room && S.room.players.find(x => x.id === id); return p ? p.name : '?'; };
  const winners = Object.entries(d.gained).map(([id, pts]) => `${esc(names(id))} +${pts}`).join(', ') || '아무도 못 맞혔어요 😅';
  const side = v => Object.entries(d.picks || {}).filter(([, x]) => x === v).map(([id]) => esc(names(id))).join(' · ') || '없음';
  const r = $('#ox-reveal');
  r.innerHTML = `<b>정답은 ${d.answer ? '⭕' : '❌'}</b><p>${esc(d.explain)}</p><small class="ox-picks">⭕ ${side(true)}　❌ ${side(false)}</small><small>${winners}</small>`;
  r.className = 'ox-reveal ' + (OX.mine == null ? '' : OX.mine === d.answer ? 'good' : 'bad');
  OX.paintLock(); $('#ox-count').textContent = '';
});
