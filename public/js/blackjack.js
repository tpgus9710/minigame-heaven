/* =====================================================================
 *  🂡 블랙잭 화면 (규칙: shared/blackjack-core.js) — 카지노 테이블 · 칩 · 딜링 애니메이션
 * ===================================================================== */
makeScreen('blackjack', {
  title: '🂡 블랙잭', status: '딜러보다 21에 가깝게! 21을 넘으면 버스트. 블랙잭은 1.5배!',
  stats: [['round', '라운드'], ['chips', '내 칩'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="bj-solo"><span class="muted small">함께할 AI</span>
      <button class="seg-btn" data-act="bjSolo" data-bots="0">없음</button><button class="seg-btn on" data-act="bjSolo" data-bots="2">2명</button><button class="seg-btn" data-act="bjSolo" data-bots="4">4명</button></div>
    <div class="bj-table felt" id="bj-table">
      <div class="bj-arc">BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17</div>
      <div class="bj-dealer"><small>DEALER</small><div class="bj-cards" id="bj-dealer"></div><b class="bj-total" id="bj-dtotal"></b></div>
      <div class="bj-msg" id="bj-msg"></div>
      <div class="bj-seats" id="bj-seats"></div>
    </div>
    <div class="bj-controls" id="bj-controls"></div>`,
});

const BJ = {
  RES: { bj: ['블랙잭!', 'gold'], win: ['승리', 'win'], push: ['무승부', 'push'], lose: ['패배', 'lose'], bust: ['버스트', 'lose'] },
  seen: {},
  render(v, ctx, prev) {
    if (!prev || this.gen !== Table.cur) { this.gen = Table.cur; this.seen = {}; }
    this.v = v; this.ctx = ctx;
    $('#bj-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const me = v.players.find(p => p.id === ctx.me), m = n => n.toLocaleString('ko-KR');
    setStat('blackjack', 'round', `${v.round} / ${v.maxRounds}`);
    setStat('blackjack', 'chips', me ? m(me.chips) : '-');
    // 딜러
    $('#bj-dealer').innerHTML = v.dealer.cards.map((c, i) => this.card(c, `${v.round}-d${i}${c || 'x'}`)).join('');
    $('#bj-dtotal').textContent = !v.dealer.cards.length ? '' : v.dealer.total != null ? v.dealer.total : v.dealer.up != null ? `${v.dealer.up} + ?` : '';
    $('#bj-dtotal').className = 'bj-total' + (v.dealer.total > 21 ? ' bust' : '');
    $('#bj-msg').textContent = v.msg;
    // 자리
    $('#bj-seats').innerHTML = v.players.map(p => {
      const turn = p.id === v.turnId, out = p.chips < 50 && !p.hands.length && !p.bet;
      const hands = p.hands.map((h, hi) => {
        const r = h.result && this.RES[h.result];
        return `<div class="bj-hand ${turn && hi === p.cur ? 'active' : ''}"><div class="bj-cards">${h.cards.map((c, ci) => this.card(c, `${v.round}-${p.id}-${hi}-${ci}`)).join('')}</div>
          <div class="bj-hinfo"><b class="${h.total > 21 ? 'bust' : ''}">${h.bj ? 'BJ' : h.total}${h.soft && h.total < 21 ? '<small>소프트</small>' : ''}</b>${this.chip(h.bet)}${h.doubled ? '<em>×2</em>' : ''}</div>
          ${r ? `<div class="bj-res ${r[1]}">${r[0]}${h.win ? ` +${m(h.win)}` : ''}</div>` : ''}</div>`;
      }).join('');
      return `<div class="bj-seat ${turn ? 'turn' : ''} ${p.id === ctx.me ? 'me' : ''} ${out ? 'out' : ''}">
        <div class="bj-hands">${hands || (p.bet ? `<div class="bj-betchip">${this.chip(p.bet)}<small>베팅 완료</small></div>` : v.phase === 'bet' && !out ? '<div class="bj-wait">베팅 중…</div>' : '')}</div>
        <div class="bj-name"><i style="--c:${avColor(p.id)}"></i><b>${esc(p.name)}${p.id === ctx.me ? ' (나)' : ''}</b><span>${m(p.chips)}칩</span></div></div>`;
    }).join('');
    // 내 조작
    const ctl = $('#bj-controls');
    if (!me || v.over) { ctl.innerHTML = ''; return; }
    if (v.phase === 'bet') {
      ctl.innerHTML = me.bet ? `<p class="bj-note">${m(me.bet)}칩 베팅 완료! 다른 사람을 기다려요…</p>` : me.chips < 50 ? '<p class="bj-note">칩이 모자라 이번 판은 구경해요.</p>'
        : `<p class="bj-note">얼마를 걸까요? (내 칩 ${m(me.chips)})</p><div class="bj-chips">${v.bets.filter(b => b <= me.chips).map((b, i) => `<button class="bj-chipbtn c${b}" data-act="bjBet" data-amt="${b}"><span>${b}</span><small>${i + 1}</small></button>`).join('')}
          ${me.chips > 500 ? `<button class="bj-chipbtn call" data-act="bjBet" data-amt="${me.chips}"><span>올인</span></button>` : ''}</div>`;
    } else if (v.phase === 'play' && v.turnId === ctx.me) {
      const h = me.hands[me.cur], two = h && h.cards.length === 2;
      const pair = two && Math.min(10, +h.cards[0].slice(1)) === Math.min(10, +h.cards[1].slice(1)) && me.hands.length === 1;
      ctl.innerHTML = `<div class="bj-acts"><button class="btn good lg" data-act="bjDo" data-t="hit">히트 <small>H</small></button><button class="btn lg" data-act="bjDo" data-t="stand">스탠드 <small>S</small></button>
        <button class="btn ghost" data-act="bjDo" data-t="double" ${two && me.chips >= h.bet ? '' : 'disabled'}>더블 <small>D</small></button><button class="btn ghost" data-act="bjDo" data-t="split" ${pair && me.chips >= h.bet ? '' : 'disabled'}>스플릿 <small>P</small></button></div>`;
    } else ctl.innerHTML = `<p class="bj-note">${v.phase === 'play' ? `${esc((v.players.find(p => p.id === v.turnId) || {}).name || '')} 님이 고르는 중…` : v.phase === 'result' ? '곧 다음 라운드!' : '딜러 차례…'}</p>`;
  },
  /** 카드: 처음 보는 카드만 날아오는 애니메이션 */
  card(c, key) {
    const isNew = !this.seen[key]; this.seen[key] = 1;
    return Pieces.card(c, isNew ? 'deal' : '');
  },
  chip(n) { const c = n >= 500 ? 'c500' : n >= 200 ? 'c200' : n >= 100 ? 'c100' : 'c50'; return `<span class="bj-chip ${c}">${n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : n}</span>`; },
};
Object.assign(ACT, {
  bjBet: el => { const c = BJ.ctx; if (c) c.send({ t: 'bet', amt: +el.dataset.amt }); },
  bjDo: el => { const c = BJ.ctx; if (c) c.send({ t: el.dataset.t }); },
  bjSolo: el => {
    BJ.bots = +el.dataset.bots;
    Table.solo('blackjack', { bots: BJ.bots });
    $$('#bj-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === BJ.bots));
  },
});
Table.def('blackjack', {
  core: BlackjackCore, render: (v, ctx, prev) => BJ.render(v, ctx, prev), solo: { bots: 2 },
  key: (e, ctx) => {
    if (e.repeat) return;
    const t = { KeyH: 'hit', KeyS: 'stand', KeyD: 'double', KeyP: 'split' }[e.code];
    if (t) { const b = $(`#bj-controls [data-t="${t}"]:not([disabled])`); if (b) ACT.bjDo(b); }
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
    if (n != null) { const b = $$('#bj-controls .bj-chipbtn:not(.call)')[n]; if (b) ACT.bjBet(b); }
  },
});
