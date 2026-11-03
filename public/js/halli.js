/* =====================================================================
 *  🔔 과일 종치기 (멀티) — 펼쳐진 카드에 같은 과일이 딱 5개면 종!
 * ===================================================================== */
/* 카드 과일 그림: 과일 합치기의 과일 그리기(paintFruit)로 한 번만 만들어 둬요 — 딸기 · 귤 · 레몬 · 포도 */
const HG_FRUIT = [1, 3, 4, 2].map(lv => { const cv = document.createElement('canvas'); cv.width = cv.height = 72; paintFruit(cv.getContext('2d'), lv, 36, 40, 24); return cv.toDataURL(); });
makeScreen('halli', {
  title: '🔔 과일 종치기', status: '내 차례에 카드를 펼치고(스페이스), 같은 과일이 딱 5개면 종(Enter)!',
  stats: [['mine', '내 카드'], ['turn', '차례']],
  body: `<div class="hg-table"><div class="hg-seats" id="hg-seats"></div>
    <div class="hg-mid"><button class="hg-bell" data-act="hgRing" id="hg-bell" data-icon="bell-ringing"></button><div class="hg-msg" id="hg-msg"></div></div>
    <div class="center"><button class="btn good lg" data-act="hgFlip" id="hg-flip">카드 펼치기 (스페이스)</button></div></div>`,
});

$$('#scr-halli [data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const Halli = {
  cardHTML(card) {
    if (!card) return '<div class="hg-card empty"></div>';
    const n = card.n, f = HG_FRUIT[card.f];
    return `<div class="hg-card n${n}">${Array.from({ length: n }, () => `<span><img src="${f}" alt=""></span>`).join('')}</div>`;
  },
  render(v) {
    this.v = v;
    $('#hg-seats').innerHTML = v.seats.map(s => `<div class="hg-seat ${s.id === v.turnId ? 'turn' : ''} ${s.out ? 'out' : ''} ${s.id === S.myId ? 'me' : ''}" data-id="${s.id}">
      <div class="hg-name">${esc(s.name)}${s.id === S.myId ? ' (나)' : ''}</div>${this.cardHTML(s.top)}
      <div class="hg-count">카드 ${s.deck}장 · 펼친 ${s.pile}장${s.out ? ' · 탈락' : ''}</div></div>`).join('');
    const me = v.seats.find(s => s.id === S.myId), turn = v.seats.find(s => s.id === v.turnId);
    setStat('halli', 'mine', me ? `${me.deck}장` : '-');
    setStat('halli', 'turn', turn ? (turn.id === S.myId ? '내 차례!' : turn.name) : '-');
    $('#hg-flip').disabled = !(turn && turn.id === S.myId) || v.lock;
  },
  msg(txt, cls) { const m = $('#hg-msg'); m.textContent = txt; m.className = 'hg-msg show ' + (cls || ''); clearTimeout(this.mt); this.mt = setTimeout(() => m.classList.remove('show'), 1500); },
};
Object.assign(ACT, { hgRing: () => socket.emit('halli:ring'), hgFlip: () => socket.emit('halli:flip') });
register('halli', {
  key: e => { if (e.repeat) return; if (e.code === 'Space') ACT.hgFlip(); if (['Enter', 'KeyB', 'NumpadEnter'].includes(e.code)) ACT.hgRing(); },
});
socket.on('halli:start', () => { stopLocal(); show('halli'); renderScores(); $('#hg-msg').textContent = ''; });
socket.on('halli:state', v => { if (isScreen('halli')) Halli.render(v); });
socket.on('halli:flip', d => { const el = $(`.hg-seat[data-id="${d.id}"] .hg-card`); if (el) { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); } });
socket.on('halli:ring', d => {
  const bell = $('#hg-bell'); bell.classList.remove('ring'); void bell.offsetWidth; bell.classList.add('ring');
  Halli.msg(d.ok ? `🎉 ${d.name} 님 성공! 카드 ${d.got}장 획득` : `❌ ${d.name} 님 땡! 모두에게 1장씩`, d.ok ? 'ok' : 'bad');
});
