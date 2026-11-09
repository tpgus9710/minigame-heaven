/* =====================================================================
 *  🔤 끝말잇기 (멀티 · 봇 가능) — 끝 글자로 시작하는 단어 잇기.
 *  맞는 말인지는 국어사전(표준국어대사전 · 우리말샘 표제어 약 95만)이 판정해요 (서버: games/word.js · lib/kodict.js)
 * ===================================================================== */
makeScreen('word', {
  title: '🔤 끝말잇기', status: '끝 글자로 시작하는 단어 잇기 · 국어사전이 판정',
  stats: [['turn', '차례'], ['time', '남은 시간']],
  body: `<div class="wd-wrap">
    <div class="wd-players" id="wd-players"></div>
    <div class="wd-card" id="wd-card">
      <div class="wd-word" id="wd-word">-</div>
      <div class="wd-next" id="wd-next"></div>
      <div class="wd-stamp" id="wd-stamp"></div>
    </div>
    <div class="ox-bar wd-bar"><div id="wd-bar"></div></div>
    <div class="wd-feed" id="wd-feed" aria-live="polite"></div>
    <div class="wd-input"><input id="wd-input" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="단어 입력 후 Enter"><button class="btn good" data-act="wdSay">보내기</button></div>
    <div class="wd-chain" id="wd-chain"></div>
    <div class="wd-src" id="wd-src"></div>
  </div>`,
});
LOBBY_OPTIONS.word = [
  { key: 'wdDict', label: '📖 사전', def: 'all', values: [['all', '모든 낱말 (95만)'], ['wide', '명사만 (84만)'], ['std', '표준어 명사만 (73만)']] },
  { key: 'wdKill', label: '💥 한방 단어', def: 'on', values: [['on', '허용'], ['off', '금지']] },
  { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
];
const Word = {
  order: [], hearts: {}, score: {}, turnId: null, mine: false,
  dictUrl: w => 'https://ko.dict.naver.com/#/search?query=' + encodeURIComponent(w),
  players(hearts, turnId) {
    if (hearts) this.hearts = hearts;
    if (turnId !== undefined) this.turnId = turnId;
    $('#wd-players').innerHTML = this.order.map(p => {
      const h = this.hearts[p.id] || 0;
      return `<div class="wd-p ${p.id === this.turnId ? 'turn' : ''} ${h <= 0 ? 'out' : ''} ${p.bot ? 'bot' : ''}"><b>${p.bot ? '🤖 ' : ''}${esc(p.name)}${p.id === S.myId ? ' (나)' : ''}</b><span>${h > 0 ? '❤️'.repeat(h) : '💔'}<i>${this.score[p.id] || 0}</i></span></div>`;
    }).join('');
  },
  /** 큰 단어: 끝 글자에 밑줄 */
  word(w) { $('#wd-word').innerHTML = esc(w.slice(0, -1)) + `<em>${esc(w.slice(-1))}</em>`; },
  chain(w, by, start) {
    const el = $('#wd-chain');
    const a = `<a class="${start ? 'start' : ''}" href="${this.dictUrl(w)}" target="_blank" rel="noopener" title="${esc(by || '')} · 사전에서 뜻 보기">${esc(w)}</a>`;
    el.insertAdjacentHTML('afterbegin', a);
    while (el.children.length > 40) el.lastElementChild.remove();
  },
  /** 판정 한 줄 (+ 작은 둘째 줄: 쓸 수 있었던 말) */
  feed(html, kind = '', sub = '') {
    const f = $('#wd-feed');
    f.className = 'wd-feed ' + kind; f.innerHTML = `<span>${html}</span>${sub ? `<small>${sub}</small>` : ''}`;
    if (kind === 'bad') { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
  },
  stamp(text, kind) {                               // 도장이 찍힌 동안 밑의 단어는 흐리게 → 1초 뒤 새 단어가 또렷하게
    const s = $('#wd-stamp'), card = $('#wd-card');
    s.textContent = text; s.className = 'wd-stamp' + (kind ? ' ' + kind : ''); void s.offsetWidth; s.classList.add('show');
    card.classList.add('stamping'); clearTimeout(this.stampT);
    this.stampT = setTimeout(() => card.classList.remove('stamping'), 1050);
  },
  input(mine) {
    const i = $('#wd-input'), out = !(this.hearts[S.myId] > 0) || !this.order.some(p => p.id === S.myId);
    i.disabled = out;
    i.classList.toggle('mine', !!mine);
    i.placeholder = out ? '관전 중이에요' : mine ? '내 차례! 단어를 입력해요' : '다음 단어를 미리 생각해 두세요';
  },
  say() {
    const i = $('#wd-input'), v = i.value.trim();
    if (!v) return;
    if (!this.mine) { toast('아직 내 차례가 아니에요.', 'info'); return; }
    socket.emit('word:say', v);
  },
  clearTimer() { clearInterval(this.timer); $('#wd-bar').style.width = '0%'; },
};
$('#wd-input').addEventListener('keydown', e => { if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return; e.preventDefault(); Word.say(); });
Object.assign(ACT, { wdSay: () => Word.say() });
register('word', {});
socket.on('word:start', d => {
  if (!d.resync) stopLocal();
  show('word'); renderScores();
  Object.assign(Word, { order: d.order, hearts: d.hearts, score: d.score || {}, turnId: null, mine: false });
  Word.word(d.word);
  $('#wd-chain').innerHTML = '';
  if (d.chain) d.chain.forEach(x => Word.chain(x.w, x.name)); else Word.chain(d.word, '시작 단어', true);
  $('#wd-next').innerHTML = '';
  const range = { all: '모든 낱말', wide: '명사만', std: '표준어 명사만' }[d.mode || (d.std ? 'std' : 'wide')] || '모든 낱말';
  $('#wd-src').innerHTML = `📖 판정: 표준국어대사전 · 우리말샘 (${range})${d.kill === false ? ' · 한방 금지' : ''} · 단어를 누르면 뜻을 볼 수 있어요`;
  Word.feed(d.resync ? '다시 연결됐어요.' : '곧 시작합니다… 다른 사람 차례에도 미리 입력해 둘 수 있어요.');
  Word.players(); Word.input(false);
  $('#wd-input').value = '';
});
socket.on('word:turn', d => {
  if (!isScreen('word')) return;
  const mine = d.id === S.myId;
  Word.mine = mine;
  Sound.turn('word', mine);
  Word.players(d.hearts, d.id);
  Word.word(d.word);
  const chips = d.starts.map(c => `<b>${esc(c)}</b>`).join('<span>또는</span>');
  $('#wd-next').innerHTML = `${chips}<small>${d.dead ? '이을 말이 없어요…' : mine ? '(으)로 시작하는 말 · 내 차례!' : `(으)로 시작하는 말 · ${esc(d.name)} 님 차례`}</small>`;
  $('#wd-card').classList.toggle('mine', mine);
  if (d.dead) Word.feed(`💥 <b>한방 단어!</b> 「${esc(d.word)}」 뒤에 이을 말이 사전에 없어요`, 'bad');
  Word.input(mine);
  const inp = $('#wd-input');
  if (mine && !d.dead) setTimeout(() => { inp.focus(); inp.select(); }, 30);
  setStat('word', 'turn', mine ? '내 차례!' : d.name);
  const end = performance.now() + d.seconds * 1000;
  clearInterval(Word.timer);
  Word.timer = every(100, () => { const left = Math.max(0, end - performance.now()); $('#wd-bar').style.width = (left / (d.seconds * 10)) + '%'; setStat('word', 'time', Math.ceil(left / 1000) + '초'); });
});
socket.on('word:miss', d => {
  Word.feed(`✗ ${d.id === S.myId ? '나' : esc(d.name)}: <b>${esc(d.word)}</b> — ${esc(d.why)}`, 'bad');
  if (d.id === S.myId) { Sound.play('bad'); const i = $('#wd-input'); i.classList.remove('shake'); void i.offsetWidth; i.classList.add('shake'); i.select(); }
});
socket.on('word:accepted', d => {
  Word.score = d.score || Word.score;
  Word.chain(d.word, d.name);
  Word.word(d.word);
  Word.players();
  Word.feed(`✓ ${d.by === S.myId ? '나' : esc(d.name)}: <b>${esc(d.word)}</b>${d.kind === 'ext' ? ' <small>📜 방언·옛말·북한어</small>' : d.kind === 'other' ? ' <small>📗 부사·동사 등</small>' : ''}`, 'good');
  if (d.by === S.myId) { $('#wd-input').value = ''; Word.mine = false; }
  if (d.dead) { Word.stamp('💥 한방!'); Sound.play('pop'); } else Sound.play('tap');
  Word.clearTimer();
});
socket.on('word:fail', d => {
  Word.mine = false;
  Word.players(d.hearts);
  Word.clearTimer();
  const ex = d.examples && d.examples.length ? `이런 말이 있었어요: ${d.examples.map(w => `<a href="${Word.dictUrl(w)}" target="_blank" rel="noopener">${esc(w)}</a>`).join(' · ')}` : '';
  Word.feed(`${esc(d.why)} — ${d.id === S.myId ? '나' : esc(d.name) + ' 님'} ❤️ -1`, 'bad', ex);
  if (d.id === S.myId) { Sound.play('bad'); $('#wd-input').value = ''; }
  Word.input(false);
});
socket.on('word:round', d => {
  Word.word(d.word);
  Word.chain(d.word, '새 시작 단어', true);
  $('#wd-next').innerHTML = '<small>🔄 새 단어로 다시 시작!</small>';
  Word.stamp('🔄 새 단어', 'info');
});
