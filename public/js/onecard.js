/* =====================================================================
 *  🃏 원카드 (멀티) — 규칙 계산은 서버(games/onecard.js)가 하고, 화면은 받은 상태를 그려요.
 * ===================================================================== */
const OC_SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
makeScreen('onecard', {
  title: '🃏 원카드', status: '맨 위 카드와 무늬나 숫자가 같은 카드를 내요!',
  stats: [['turn', '차례'], ['deck', '남은 카드'], ['time', '남은 시간']],
  body: `<div class="oc-table">
    <div class="oc-players" id="oc-players"></div>
    <div class="oc-center">
      <div class="oc-pile"><div class="ocard back" data-act="ocDraw" id="oc-deck"></div><small>카드 먹기</small></div>
      <div class="oc-pile"><div id="oc-top"></div><small id="oc-suit"></small></div>
      <div class="oc-info"><div id="oc-attack" class="oc-attack hidden"></div><div id="oc-dir" class="muted small"></div><div id="oc-log" class="oc-log"></div></div>
    </div>
    <div class="oc-actions"><button class="btn ghost" data-act="ocDraw" id="oc-draw-btn">카드 먹기</button><button class="btn warn hidden" data-act="ocShout" id="oc-shout">☝️ 원카드!</button></div>
    <div class="oc-multi hidden" id="oc-multi"></div>
    <div class="oc-hand" id="oc-hand"></div>
    <div class="oc-suits hidden" id="oc-suits"><b>바꿀 무늬를 고르세요</b><div>${Object.entries(OC_SUIT).map(([k, v]) => `<button class="btn ${k === 'H' || k === 'D' ? 'red' : ''}" data-act="ocSuit" data-s="${k}">${v}</button>`).join('')}</div></div>
  </div>`,
});

const ocRank = c => (c === 'JB' || c === 'JC' ? 'J' : c.slice(1));
const OneCard = {
  sel: [],                                     // 같이 낼 카드 (첫 장은 지금 낼 수 있는 카드)
  card(code, extra = '') {
    if (code === 'JB' || code === 'JC') return `<div class="ocard joker ${code === 'JC' ? 'color' : ''} ${extra}" data-card="${code}"><b class="jk">JOKER</b><span>★</span><small>${code === 'JC' ? '컬러' : '흑백'}</small></div>`;
    const s = code[0], r = +code.slice(1), label = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || r;
    return `<div class="ocard ${s === 'H' || s === 'D' ? 'red' : ''} ${extra}" data-card="${code}"><i>${label}<br>${OC_SUIT[s]}</i><span>${OC_SUIT[s]}</span></div>`;
  },
  sortKey(c) { if (c[0] === 'J' && c.length === 2) return 999; return 'SHDC'.indexOf(c[0]) * 20 + (+c.slice(1) === 1 ? 14 : +c.slice(1)); },
  render(v) {
    this.v = v;
    const myTurn = v.turnId === S.myId;
    Sound.turn('onecard', myTurn);
    $('#oc-players').innerHTML = v.players.map(p => `<div class="oc-p ${p.id === v.turnId ? 'turn' : ''} ${p.out ? 'out' : ''}">
      <b>${esc(p.name)}${p.id === S.myId ? ' (나)' : ''}</b><span>${p.out ? '파산' : '카드 ' + p.n + '장'}</span>${p.id === v.one ? '<em>☝️ 1장!</em>' : ''}</div>`).join('');
    $('#oc-top').innerHTML = this.card(v.top, 'big');
    $('#oc-suit').textContent = v.suit ? `무늬 변경: ${OC_SUIT[v.suit]}` : '';
    $('#oc-attack').classList.toggle('hidden', !v.attack); $('#oc-attack').textContent = `⚔️ 공격 +${v.attack}장`;
    $('#oc-dir').textContent = v.dir > 0 ? '🔃 시계 방향' : '🔄 반시계 방향';
    const playable = new Set(v.playable);
    this.sel = myTurn && v.phase === 'play' ? this.sel.filter(c => v.hand.includes(c)) : [];
    const sel = this.sel, first = sel[0];
    $('#oc-hand').innerHTML = v.hand.slice().sort((a, b) => this.sortKey(a) - this.sortKey(b)).map(c => {
      let cls = playable.has(c) ? 'can' : myTurn && v.phase === 'play' ? 'dim' : '';
      if (first) cls = sel.includes(c) ? 'sel' : ocRank(c) === ocRank(first) ? 'can' : 'dim';
      return this.card(c, cls);
    }).join('');
    const multi = $('#oc-multi');
    multi.classList.toggle('hidden', !first);
    if (first) multi.innerHTML = `같은 숫자 카드를 더 눌러서 함께 낼 수 있어요 · <b>${sel.length}장 선택</b>
      <button class="btn sm good" data-act="ocPlaySel">${sel.length}장 내기</button><button class="btn sm ghost" data-act="ocCancelSel">취소</button>`;
    $('#oc-draw-btn').disabled = !myTurn || v.phase !== 'play';
    $('#oc-draw-btn').textContent = v.attack ? `공격 맞기 (${v.attack}장 먹기)` : '카드 1장 먹기';
    $('#oc-shout').classList.toggle('hidden', !v.one);
    $('#oc-suits').classList.toggle('hidden', !(myTurn && v.phase === 'suit'));
    const turnP = v.players.find(p => p.id === v.turnId);
    setStat('onecard', 'turn', myTurn ? '내 차례!' : turnP ? turnP.name : '-');
    setStat('onecard', 'deck', v.deckN + '장');
    setStatus('onecard', myTurn ? (v.phase === 'suit' ? '7을 냈어요! 바꿀 무늬를 고르세요.' : v.attack ? `⚔️ 공격받는 중! 같거나 센 공격 카드로 받아치거나 ${v.attack}장을 먹으세요.` : '🟢 내 차례! 빛나는 카드를 낼 수 있어요.') : `⏳ ${turnP ? turnP.name : ''} 님 차례`);
    this.deadline = performance.now() + v.left;
  },
  log(msg) { const el = $('#oc-log'); el.innerHTML = `<div>${esc(msg)}</div>` + el.innerHTML; while (el.children.length > 4) el.lastChild.remove(); },
  start(d) {
    stopLocal();
    $('#oc-log').innerHTML = '';
    show('onecard'); renderScores();
    every(250, () => setStat('onecard', 'time', this.deadline ? leftSec(this.deadline) + '초' : '-'));
  },
};
$('#oc-hand').addEventListener('click', e => {
  const el = e.target.closest('.ocard'); if (!el || !OneCard.v) return;
  const code = el.dataset.card || (el.classList.contains('joker') ? (el.classList.contains('color') ? 'JC' : 'JB') : null);
  const v = OneCard.v;
  if (!code || v.turnId !== S.myId || v.phase !== 'play') return;
  const sel = OneCard.sel;
  if (!sel.length) {
    if (!v.playable.includes(code)) return toast(v.attack ? '공격을 받는 중이에요! 같거나 센 공격 카드만 낼 수 있어요.' : '무늬나 숫자가 맞는 카드만 낼 수 있어요.');
    const more = v.hand.filter(c => c !== code && ocRank(c) === ocRank(code));
    if (!more.length) return socket.emit('oc:play', { cards: [code] });
    OneCard.sel = [code];                                        // 같은 숫자가 더 있으면 골라서 같이 내기
  } else if (code === sel[0]) OneCard.sel = [];
  else if (sel.includes(code)) OneCard.sel = sel.filter(c => c !== code);
  else if (ocRank(code) === ocRank(sel[0])) OneCard.sel = sel.concat(code);
  else return toast('같은 숫자 카드만 함께 낼 수 있어요.');
  OneCard.render(v);
});
Object.assign(ACT, {
  ocDraw: () => { OneCard.sel = []; socket.emit('oc:draw'); },
  ocPlaySel: () => { const cards = OneCard.sel; OneCard.sel = []; if (cards.length) socket.emit('oc:play', { cards }); },
  ocCancelSel: () => { OneCard.sel = []; OneCard.render(OneCard.v); },
  ocShout: () => socket.emit('oc:shout'),
  ocSuit: el => socket.emit('oc:suit', el.dataset.s),
});
register('onecard', { key: e => { if (e.code === 'Space' && !e.repeat && OneCard.v && OneCard.v.one) ACT.ocShout(); } });
socket.on('oc:start', d => OneCard.start(d));
socket.on('oc:state', v => { if (isScreen('onecard')) OneCard.render(v); });
const ocName = c => (c === 'JB' ? '흑백 조커' : c === 'JC' ? '컬러 조커' : OC_SUIT[c[0]] + ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[+c.slice(1)] || c.slice(1)));
socket.on('oc:play', d => OneCard.log(`${d.name}: ${(d.cards || [d.card]).map(ocName).join(' ')}${(d.cards || []).length > 1 ? ` (${d.cards.length}장!)` : ''}${d.attack ? ` · 공격 +${d.attack}` : ''}`));
socket.on('oc:log', d => OneCard.log(d.msg));
socket.on('oc:one', d => { OneCard.log(`☝️ ${d.name} 님 1장 남음! 원카드 버튼을 먼저 누르세요`); });
socket.on('oc:shout', d => { const m = d.safe ? `☝️ ${d.name} 님 원카드 성공!` : `🚨 ${d.name} 님이 먼저 외쳤어요! ${d.targetName} 님 1장 추가`; OneCard.log(m); toast(m, 'info'); });
