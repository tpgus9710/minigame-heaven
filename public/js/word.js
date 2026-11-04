/* =====================================================================
 *  🔤 끝말잇기 (멀티) — 끝 글자로 시작하는 단어 잇기, 이상한 단어는 👎로 거절!
 * ===================================================================== */
makeScreen('word', {
  title: '🔤 끝말잇기', status: '앞 단어의 끝 글자로 시작하는 단어를 입력하세요 (두음법칙 OK)',
  stats: [['turn', '차례'], ['time', '남은 시간']],
  body: `<div class="wd-wrap">
    <div class="wd-players" id="wd-players"></div>
    <div class="wd-word" id="wd-word">-</div>
    <div class="wd-hint" id="wd-hint"></div>
    <div class="ox-bar"><div id="wd-bar"></div></div>
    <div class="wd-vote hidden" id="wd-vote"></div>
    <div class="wd-input"><input id="wd-input" maxlength="12" autocomplete="off" placeholder="단어 입력 후 Enter"><button class="btn good" data-act="wdSay">보내기</button></div>
    <div class="wd-chain" id="wd-chain"></div>
  </div>`,
});
const Word = {
  players(hearts, turnId) {
    this.hearts = hearts || this.hearts; this.turnId = turnId || this.turnId;
    $('#wd-players').innerHTML = (this.order || []).map(p => {
      const h = this.hearts[p.id] || 0;
      return `<div class="wd-p ${p.id === this.turnId ? 'turn' : ''} ${h <= 0 ? 'out' : ''}"><b>${esc(p.name)}${p.id === S.myId ? ' (나)' : ''}</b><span>${h > 0 ? '❤️'.repeat(h) : '💔'}</span></div>`;
    }).join('');
  },
  chain(w, by) { const el = $('#wd-chain'); el.innerHTML = `<span title="${esc(by || '')}">${esc(w)}</span>` + el.innerHTML; },
  say() { const i = $('#wd-input'), v = i.value.trim(); if (!v) return; socket.emit('word:say', v); i.value = ''; },
};
$('#wd-input').addEventListener('keydown', e => { if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return; e.preventDefault(); Word.say(); });
Object.assign(ACT, { wdSay: () => Word.say(), wdVeto: el => { socket.emit('word:veto'); el.disabled = true; } });
register('word', {});
socket.on('word:start', d => {
  stopLocal(); show('word'); renderScores();
  Object.assign(Word, { order: d.order, hearts: d.hearts, turnId: null });
  $('#wd-word').textContent = d.word; $('#wd-chain').innerHTML = ''; Word.chain(d.word, '시작 단어'); Word.players();
  $('#wd-hint').textContent = '곧 시작합니다…';
});
socket.on('word:turn', d => {
  if (!isScreen('word')) return;
  const mine = d.id === S.myId;
  Sound.turn('word', mine);
  Word.players(d.hearts, d.id);
  $('#wd-word').innerHTML = esc(d.word.slice(0, -1)) + `<em>${esc(d.word.slice(-1))}</em>`;
  $('#wd-hint').textContent = `${mine ? '🟢 내 차례! ' : `⏳ ${d.name} 님 차례 · `}'${d.starts.join("' 또는 '")}'(으)로 시작하는 단어`;
  $('#wd-vote').classList.add('hidden');
  $('#wd-input').disabled = !mine; if (mine) setTimeout(() => $('#wd-input').focus(), 30);
  setStat('word', 'turn', mine ? '내 차례!' : d.name);
  const end = performance.now() + d.seconds * 1000;
  clearInterval(Word.timer);
  Word.timer = every(100, () => { const left = Math.max(0, end - performance.now()); $('#wd-bar').style.width = (left / (d.seconds * 10)) + '%'; setStat('word', 'time', Math.ceil(left / 1000) + '초'); });
});
socket.on('word:vote', d => {
  clearInterval(Word.timer);
  $('#wd-input').disabled = true;
  const v = $('#wd-vote');
  v.classList.remove('hidden');
  v.innerHTML = `<b>${esc(d.name)}</b>: “${esc(d.word)}” ${d.by === S.myId ? '<span class="muted">— 다른 사람들이 확인 중…</span>' : `<button class="btn sm bad" data-act="wdVeto">👎 이상해요</button>`} <small id="wd-veto-n">👎 0 / ${d.need}</small>`;
});
socket.on('word:vetoCount', d => { const n = $('#wd-veto-n'); if (n) n.textContent = `👎 ${d.n} / ${d.need}`; });
socket.on('word:accepted', d => { Word.chain(d.word, d.name); });
socket.on('word:rejected', d => { toast(`👎 '${d.word}' 거절!`, 'info'); });
socket.on('word:fail', d => {
  Word.players(d.hearts);
  $('#wd-vote').classList.add('hidden');
  $('#wd-hint').textContent = `${d.why} — ${d.name} 님 ❤️ -1`;
  clearInterval(Word.timer);
});
