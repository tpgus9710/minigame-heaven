/* =====================================================================
 *  🃏 카드 게임 (섯다 · 포커)
 * ===================================================================== */
/* 화투 달마다 상징 한자와 색: 송학 · 매조 · 벚꽃 · 흑싸리 · 난초 · 모란 · 홍싸리 · 공산 · 국화 · 단풍 */
const MONTH_SIGN = { 1: ['松', '#1f7a3a'], 2: ['梅', '#d81b60'], 3: ['櫻', '#ff6f91'], 4: ['藤', '#4a2d6b'], 5: ['蘭', '#1565c0'], 6: ['牡', '#b71c1c'], 7: ['萩', '#7b1fa2'], 8: ['月', '#e0a800'], 9: ['菊', '#f9a825'], 10: ['楓', '#d84315'] };
const RN = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));
const Cards = {
  prev: {}, v: null, turnEnd: 0, logs: [],
  cardHtml(kind, c, isNew, secret) {
    const cls = (isNew ? ' deal' : '') + (secret ? ' secret' : '');
    if (!c) return `<div class="card back ${kind === 'seotda' ? 'hw' : ''}${cls}"></div>`;
    if (kind === 'seotda') {
      const tag = c.k === 'gwang' ? '<span class="ht gw">光</span>' : c.k === 'yeol' ? '<span class="ht yl">열</span>' : '';
      if (typeof HwatuArt !== 'undefined') {                                    // v12: 전통 화투 그림 (js/gostop-art.js) + 작은 달 숫자
        HwatuArt.init();
        return `<div class="card hwatu hwa${cls}" data-art="${HwatuArt.seotda(c)}" title="${c.m}월">${tag}<span class="hn">${c.m}</span></div>`;
      }
      return `<div class="card hwatu${cls}">${tag}<span class="he" style="--mc:${MONTH_SIGN[c.m][1]}">${MONTH_SIGN[c.m][0]}</span><span class="hm">${c.m}</span><span class="hw">월</span></div>`;
    }
    const red = c.s === '♥' || c.s === '♦';
    return `<div class="card poker ${red ? 'red' : ''}${cls}"><span class="cr">${RN(c.r)}<br>${c.s}</span><span class="cp">${c.s}</span></div>`;
  },
  seat(s, mine) {
    const v = this.v, prev = this.prev[s.id] || 0, turn = v.turnId === s.id;
    const badges = [
      v.firstId === s.id ? '<span class="badge first">선</span>' : '',
      s.left ? '<span class="badge out">나감</span>' : s.folded ? '<span class="badge die">DIE</span>' : '',
      s.allIn && !s.folded ? '<span class="badge allin">ALL-IN</span>' : '',
    ].join('');
    const cards = s.cards.map((c, i) => this.cardHtml(v.kind, c, i >= prev, mine && s.hid[i] && v.kind === 'poker')).join('');
    return `<div class="seat ${mine ? 'mine' : ''} ${turn ? 'turn' : ''} ${s.folded ? 'folded' : ''}">
      <div class="seat-head"><span class="seat-name">${esc(s.name)}${mine ? ' (나)' : ''}</span>${badges}</div>
      <div class="seat-money"><span>보유 <b>${won(s.chips)}</b></span><span>베팅 ${won(s.total)}</span></div>
      <div class="cards">${cards}</div>
      <div class="seat-hand">${esc(s.handName)}</div>
      <div class="seat-act">${esc(s.lastAction)}</div>
      ${turn ? '<div class="turnbar"><i data-turnbar></i></div>' : ''}
    </div>`;
  },
  render(v) {
    this.v = v;
    const m = v.seats.find(s => s.id === S.myId);
    const host = me() && me().isHost;
    $('#card-title .tt').textContent = v.kind === 'seotda' ? `${v.mode === '3card' ? '3장' : '2장'} 섯다` : `${v.mode === '7card' ? '7장' : '5장'} 포커`;
    $('#card-sub').textContent = `${v.handNo}번째 판 · ${Math.max(1, v.round)}/${v.maxRounds} 라운드 · 판돈 ${won(v.ante)}`;
    $('#card-stop').classList.toggle('hidden', !host);
    $('#card-pot').textContent = won(v.pot);
    $('#card-bet').textContent = (v.carry ? `이월 ${won(v.carry)} 포함 · ` : '') + (v.currentBet ? `이번 라운드 최고 베팅 ${won(v.currentBet)}` : '이번 라운드 아직 베팅 없음');
    $('#card-opps').innerHTML = v.seats.filter(s => s.id !== S.myId).map(s => this.seat(s, false)).join('');
    $('#card-me').innerHTML = m ? this.seat(m, true) : '';
    v.seats.forEach(s => { this.prev[s.id] = s.cards.length; });
    this.turnEnd = Date.now() + v.turnLeft;

    const act = $('#card-actions'), wait = $('#card-waiting');
    Sound.turn('card', !!m && v.phase === 'betting' && v.turnId === S.myId);
    if (m && v.phase === 'betting' && v.turnId === S.myId) {
      const call = Math.max(0, v.currentBet - m.roundBet), chips = m.chips;
      const q = call + Math.max(v.ante, Math.floor((v.pot + call) / 4));
      const h = call + Math.max(v.ante, Math.floor((v.pot + call) / 2));
      const b = (bet, cls, label, amt, dis) => `<button class="btn ${cls}" data-act="bet" data-bet="${bet}" ${dis ? 'disabled' : ''}>${label}${amt != null ? `<small>${won(Math.min(amt, chips))}</small>` : ''}</button>`;
      act.innerHTML = `<div class="ttl">⚡ 내 차례! <span id="my-turn-left"></span></div>` +
        b('die', 'dark', '다이', null) +
        b('call', 'good', call ? '콜' : '체크', call || null) +
        b('bbing', 'info', '삥', v.ante, v.currentBet > 0 || chips <= call) +
        b('quarter', '', '쿼터', q, chips <= call) +
        b('half', 'bad', '하프', h, chips <= call) +
        b('allin', 'warn', '🔥 올인', chips);
      act.classList.remove('hidden'); wait.textContent = '';
    } else {
      act.classList.add('hidden');
      const t = v.seats.find(s => s.id === v.turnId);
      wait.textContent = v.phase === 'showdown' ? '' : t ? `⏳ ${t.name} 님이 베팅하는 중…` : m && m.folded ? '이번 판은 다이했어요. 다음 판을 기다리는 중…' : '🎴 카드를 나눠주는 중…';
    }
  },
  tick() {
    if (!this.v || !this.v.turnId) return;
    const left = Math.max(0, this.turnEnd - Date.now());
    $$('[data-turnbar]').forEach(i => { i.style.width = (left / ((this.v.turnSeconds || 25) * 1000) * 100) + '%'; });
    const el = $('#my-turn-left'); if (el) el.textContent = `(${Math.ceil(left / 1000)}초)`;
  },
};
socket.on('card:start', d => {
  if (!isScreen('card')) { stopLocal(); Cards.logs = []; show('card'); every(200, () => Cards.tick()); }
  Cards.prev = {};
  $('#card-result').classList.add('hidden');
});
socket.on('card:state', v => { if (!isScreen('card')) { stopLocal(); show('card'); every(200, () => Cards.tick()); } Cards.render(v); });
socket.on('card:log', msg => {
  Cards.logs.push(msg); Cards.logs = Cards.logs.slice(-3);
  $('#card-log').innerHTML = Cards.logs.map(l => `<div>${esc(l)}</div>`).join('');
});
socket.on('card:result', d => {
  const el = $('#card-result');
  let n = d.nextIn;
  const draw = () => {
    el.innerHTML = `<div class="rb-title">${d.winners.length ? '🏆 승부 결과' : '🔁 재경기'}</div>
      ${d.winners.length ? d.winners.map(w => `<div><b>${esc(w.name)}</b> ${esc(w.hand)} · <span style="color:#ffd978">+${won(w.amount)}</span></div>`).join('') : `<div>${esc(d.message)}</div>`}
      <div class="small" style="opacity:.7;margin-top:6px">${n}초 뒤 다음 판이 시작됩니다</div>`;
  };
  draw(); el.classList.remove('hidden');
  const t = every(1000, () => { n = Math.max(0, n - 1); draw(); if (!n) clearInterval(t); });
});
register('card', {});
