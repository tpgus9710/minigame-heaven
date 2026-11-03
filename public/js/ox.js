/* =====================================================================
 *  ⭕ OX 퀴즈 (멀티) — 문제마다 10초 안에 O 또는 X
 * ===================================================================== */
makeScreen('ox', {
  title: '⭕ OX 퀴즈', status: '빨리 고를수록 보너스 점수! (키보드: O·← / X·→)',
  stats: [['n', '문제'], ['time', '남은 시간']],
  body: `<div class="ox-wrap">
    <div class="ox-q" id="ox-q">곧 시작합니다…</div>
    <div class="ox-bar"><div id="ox-bar"></div></div>
    <div class="ox-btns"><button class="ox-btn o" data-act="oxPick" data-v="1">⭕</button><button class="ox-btn x" data-act="oxPick" data-v="0">❌</button></div>
    <div class="ox-count" id="ox-count"></div>
    <div class="ox-reveal hidden" id="ox-reveal"></div>
  </div>`,
});
const OX = {
  pick(v) {
    if (this.phase !== 'ask' || this.mine != null) return;
    this.mine = v; socket.emit('ox:pick', v);
    $$('.ox-btn').forEach(b => b.classList.toggle('chosen', +b.dataset.v === +v));
  },
};
ACT.oxPick = el => OX.pick(!!+el.dataset.v);
register('ox', { key: e => { if (['KeyO', 'ArrowLeft', 'Digit1'].includes(e.code)) OX.pick(true); if (['KeyX', 'ArrowRight', 'Digit2'].includes(e.code)) OX.pick(false); } });
socket.on('ox:start', d => { stopLocal(); show('ox'); renderScores(); $('#ox-q').textContent = `OX 퀴즈 ${d.total}문제! 곧 시작합니다…`; $('#ox-reveal').classList.add('hidden'); });
socket.on('ox:q', d => {
  if (!isScreen('ox')) return;
  Object.assign(OX, { phase: 'ask', mine: null, endAt: performance.now() + d.seconds * 1000, total: d.seconds });
  $('#ox-q').textContent = `Q${d.n}. ${d.q}`; setStat('ox', 'n', `${d.n} / ${d.total}`);
  $('#ox-reveal').classList.add('hidden'); $('#ox-count').textContent = '';
  $$('.ox-btn').forEach(b => { b.classList.remove('chosen', 'right', 'wrong'); b.disabled = false; });
  clearInterval(OX.timer);
  OX.timer = every(100, () => {
    const left = Math.max(0, OX.endAt - performance.now());
    $('#ox-bar').style.width = (left / (OX.total * 10)) + '%';
    setStat('ox', 'time', Math.ceil(left / 1000) + '초');
  });
});
socket.on('ox:count', d => { $('#ox-count').textContent = `⭕ ${d.o}명 · ❌ ${d.x}명 골랐어요`; });
socket.on('ox:reveal', d => {
  OX.phase = 'reveal';
  clearInterval(OX.timer);
  $$('.ox-btn').forEach(b => { b.disabled = true; b.classList.add(!!+b.dataset.v === d.answer ? 'right' : 'wrong'); });
  const names = id => { const p = S.room && S.room.players.find(x => x.id === id); return p ? p.name : '?'; };
  const winners = Object.entries(d.gained).map(([id, pts]) => `${esc(names(id))} +${pts}`).join(', ') || '아무도 못 맞혔어요 😅';
  const r = $('#ox-reveal');
  r.innerHTML = `<b>정답은 ${d.answer ? '⭕' : '❌'}</b><p>${esc(d.explain)}</p><small>${winners}</small>`;
  r.className = 'ox-reveal ' + (OX.mine == null ? '' : OX.mine === d.answer ? 'good' : 'bad');
});
