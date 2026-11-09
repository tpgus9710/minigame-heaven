/* =====================================================================
 *  🃏 카드 게임 (섯다 · 포커)
 *   3장 섯다 (v12.8): 2장 받기 → 보여줄 카드 1장 고르기 → 베팅 → 1장 더 → 족보로 쓸 2장 고르기 → 마지막 베팅
 *   고르기: 아래 칸의 보기나 내 카드를 눌러 고르고 「결정」 (같은 보기를 한 번 더 눌러도 결정). 모두 동시에 골라요.
 * ===================================================================== */
/* 화투 달마다 상징 한자와 색: 송학 · 매조 · 벚꽃 · 흑싸리 · 난초 · 모란 · 홍싸리 · 공산 · 국화 · 단풍 */
const MONTH_SIGN = { 1: ['松', '#1f7a3a'], 2: ['梅', '#d81b60'], 3: ['櫻', '#ff6f91'], 4: ['藤', '#4a2d6b'], 5: ['蘭', '#1565c0'], 6: ['牡', '#b71c1c'], 7: ['萩', '#7b1fa2'], 8: ['月', '#e0a800'], 9: ['菊', '#f9a825'], 10: ['楓', '#d84315'] };
const RN = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));
const hwLabel = c => `${c.m}월${c.k === 'gwang' ? ' 광' : c.k === 'yeol' ? ' 열끗' : ''}`;
/** 족보 이름 나누기: '구사(3끗)' → ['구사', '평소 3끗'] (특수 패는 평소 끗을 아래 작은 글씨로) */
const comboName = n => { const m = /^(.+)\((.+)\)$/.exec(n || ''); return m ? [m[1], `평소 ${m[2]}`] : [n || '', '']; };
const Cards = {
  prev: {}, vis: {}, v: null, turnEnd: 0, phaseEnd: 0, logs: [],
  sel: null, picks: [], selKey: '', autoSent: false,  // 3장 섯다: 보여줄 카드(번호) · 족보로 쓸 카드(누른 순서, 최대 2장)
  /** o: { isNew, flip, secret, cls, attrs } */
  cardHtml(kind, c, o = {}) {
    const cls = (o.isNew ? ' deal' : '') + (o.flip ? ' flip' : '') + (o.secret ? ' secret' : '') + (o.cls || '');
    const at = o.attrs || '';
    if (!c) return `<div class="card back ${kind === 'seotda' ? 'hw' : ''}${cls}"${at}></div>`;
    if (kind === 'seotda') {
      const tag = c.k === 'gwang' ? '<span class="ht gw">光</span>' : c.k === 'yeol' ? '<span class="ht yl">열</span>' : '';
      if (typeof HwatuArt !== 'undefined') {                                    // v12.1: 한국 화투 그림 (光은 그림에 있어요) + 작은 달 숫자 · 열끗 표시
        HwatuArt.preload();
        return `<div class="card hwatu hwa${cls}" data-art="${HwatuArt.seotda(c)}" title="${hwLabel(c)}"${at}>${c.k === 'yeol' ? tag : ''}<span class="hn">${c.m}</span></div>`;
      }
      return `<div class="card hwatu${cls}"${at}>${tag}<span class="he" style="--mc:${MONTH_SIGN[c.m][1]}">${MONTH_SIGN[c.m][0]}</span><span class="hm">${c.m}</span><span class="hw">월</span></div>`;
    }
    const red = c.s === '♥' || c.s === '♦';
    return `<div class="card poker ${red ? 'red' : ''}${cls}"${at}><span class="cr">${RN(c.r)}<br>${c.s}</span><span class="cp">${c.s}</span></div>`;
  },
  choosing() { const v = this.v; return !!v && (v.phase === 'open' || v.phase === 'pick'); },
  /** 족보로 쓸 2장 (작은 번호부터) — 2장을 다 골랐을 때만 */
  pickSel() { return this.picks.length === 2 ? [...this.picks].sort((a, b) => a - b) : null; },
  seat(s, mine) {
    const v = this.v, prev = this.prev[s.id] || 0, vis = this.vis[s.id] || [], turn = v.turnId === s.id;
    const choosing = this.choosing(), deciding = choosing && !s.folded && !s.ready;   // 아직 고르는 중 → 시간 막대
    const tap = mine && deciding && v.three;                                           // 내 카드를 눌러서 고르기
    const pick = s.pick || (tap && v.phase === 'pick' ? this.pickSel() : null);
    const badges = [
      v.firstId === s.id ? '<span class="badge first">선</span>' : '',
      s.left ? '<span class="badge out">나감</span>' : s.folded ? '<span class="badge die">DIE</span>' : '',
      s.allIn && !s.folded ? '<span class="badge allin">ALL-IN</span>' : '',
    ].join('');
    const cards = s.cards.map((c, i) => {
      let cls = '';
      if (v.three) {
        if (mine && s.openIdx === i) cls += ' pub';                                                    // 내가 보여준 카드
        if (tap && (v.phase === 'open' ? this.sel === i : this.picks.includes(i))) cls += ' sel';      // 지금 고른 카드
        if (pick && s.cards.length === 3 && !pick.includes(i)) cls += ' off';                          // 족보에 안 쓰는 카드
        if (tap) cls += ' tap';
      }
      return this.cardHtml(v.kind, c, {
        isNew: i >= prev, flip: i < prev && !!c && !vis[i], secret: mine && s.hid[i] && v.kind === 'poker',
        cls, attrs: tap ? ` data-act="cdCard" data-i="${i}"` : '',
      });
    }).join('');
    let hand = s.handName;
    if (tap && v.phase === 'pick' && pick && s.combos) { const cb = s.combos.find(x => x.i[0] === pick[0] && x.i[1] === pick[1]); if (cb) hand = cb.name; }
    const act = choosing && !s.folded && v.three ? (s.ready ? '✔ 골랐어요' : '고르는 중…') : s.lastAction;
    return `<div class="seat ${mine ? 'mine' : ''} ${turn ? 'turn' : ''} ${deciding ? 'deciding' : ''} ${s.folded ? 'folded' : ''}">
      <div class="seat-head"><span class="seat-name">${esc(s.name)}${mine ? ' (나)' : ''}</span>${badges}</div>
      <div class="seat-money"><span>보유 <b>${won(s.chips)}</b></span><span>베팅 ${won(s.total)}</span></div>
      <div class="cards">${cards}</div>
      <div class="seat-hand">${esc(hand)}</div>
      <div class="seat-act">${esc(act)}</div>
      ${turn || deciding ? '<div class="turnbar"><i data-turnbar></i></div>' : ''}
    </div>`;
  },
  /** 3장 섯다 고르기 칸 — open: [카드 1 | 카드 2 | 보여주기] · pick: [조합 3개 | 결정] */
  chooser(v, m) {
    const sec = '<span id="my-turn-left"></span>';
    if (v.phase === 'open') {
      const opts = [0, 1].map(i => `<button class="btn cd-opt${this.sel === i ? ' on' : ''}" data-act="cdOpen" data-i="${i}">
        <span class="cd-mini one">${this.cardHtml('seotda', m.cards[i])}</span><b>${esc(hwLabel(m.cards[i]))}</b></button>`).join('');
      return `<div class="ttl">👀 모두에게 보여줄 카드 1장 ${sec}</div>${opts}
        <button class="btn good cd-ok" data-act="cdOk" ${this.sel == null ? 'disabled' : ''}>보여주기<small>${this.sel == null ? '카드를 고르세요' : '이 카드 공개'}</small></button>`;
    }
    const sel = this.pickSel();
    const opts = (m.combos || []).map(cb => {
      const [nm, sub] = comboName(cb.name), on = !!sel && sel[0] === cb.i[0] && sel[1] === cb.i[1];
      return `<button class="btn cd-opt${on ? ' on' : ''}" data-act="cdCombo" data-a="${cb.i[0]}" data-b="${cb.i[1]}">
        <span class="cd-mini">${this.cardHtml('seotda', m.cards[cb.i[0]])}${this.cardHtml('seotda', m.cards[cb.i[1]])}</span><b>${esc(nm)}</b><small>${sub ? esc(sub) : '&nbsp;'}</small></button>`;
    }).join('');
    return `<div class="ttl">🃏 족보로 쓸 2장 고르기 ${sec}</div>${opts}
      <button class="btn good cd-ok" data-act="cdOk" ${sel ? '' : 'disabled'}>결정<small>${sel ? '이 패로 승부' : '조합을 고르세요'}</small></button>`;
  },
  render(v) {
    this.v = v;
    const key = `${v.handNo}:${v.phase}`;
    if (key !== this.selKey) { this.selKey = key; this.sel = null; this.picks = []; this.autoSent = false; }
    this.turnEnd = Date.now() + v.turnLeft;
    this.phaseEnd = Date.now() + (v.phaseLeft || 0);
    this.draw();
  },
  /** 화면 다시 그리기 (내가 카드를 고를 때도 — 남은 시간은 그대로) */
  draw() {
    const v = this.v;
    if (!v) return;
    const m = v.seats.find(s => s.id === S.myId);
    const host = me() && me().isHost;
    $('#card-title .tt').textContent = v.kind === 'seotda' ? `${v.mode === '3card' ? '3장' : '2장'} 섯다` : `${v.mode === '7card' ? '7장' : '5장'} 포커`;
    $('#card-sub').textContent = `${v.handNo}번째 판 · ${Math.max(1, v.round)}/${v.maxRounds} 라운드 · 판돈 ${won(v.ante)}`;
    $('#card-stop').classList.toggle('hidden', !host);
    $('#card-pot').textContent = won(v.pot);
    $('#card-bet').textContent = (v.carry ? `이월 ${won(v.carry)} 포함 · ` : '') + (v.currentBet ? `이번 라운드 최고 베팅 ${won(v.currentBet)}` : '이번 라운드 아직 베팅 없음');
    $('#card-opps').innerHTML = v.seats.filter(s => s.id !== S.myId).map(s => this.seat(s, false)).join('');
    $('#card-me').innerHTML = m ? this.seat(m, true) : '';
    v.seats.forEach(s => { this.prev[s.id] = s.cards.length; this.vis[s.id] = s.cards.map(c => !!c); });

    const act = $('#card-actions'), wait = $('#card-waiting');
    const choosing = this.choosing();
    const need = !!m && v.three && choosing && !m.folded && !m.ready;       // 내가 고를 차례
    const myBet = !!m && v.phase === 'betting' && v.turnId === S.myId;
    Sound.turn('card', need || myBet);
    act.classList.toggle('choose', need);
    act.classList.toggle('c3', need && v.phase === 'pick');
    if (need) {
      act.innerHTML = this.chooser(v, m);
      act.classList.remove('hidden'); wait.textContent = '';
    } else if (myBet) {
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
      const left = v.seats.filter(s => !s.folded && !s.ready).length;
      wait.textContent = v.phase === 'showdown' ? ''
        : choosing ? (m && !m.folded ? `✔ 골랐어요! 다른 사람을 기다리는 중… (${left}명 남음)` : v.phase === 'open' ? '👀 모두 보여줄 카드를 고르는 중…' : '🃏 모두 족보로 쓸 2장을 고르는 중…')
        : t ? `⏳ ${t.name} 님이 베팅하는 중…` : m && m.folded ? '이번 판은 다이했어요. 다음 판을 기다리는 중…' : '🎴 카드를 나눠주는 중…';
    }
    this.tick();
  },
  tick() {
    const v = this.v;
    if (!v) return;
    const choosing = this.choosing();
    if (!v.turnId && !choosing) return;
    const left = Math.max(0, (choosing ? this.phaseEnd : this.turnEnd) - Date.now());
    const total = ((choosing ? v.phaseSeconds : v.turnSeconds) || 25) * 1000;
    $$('[data-turnbar]').forEach(i => { i.style.width = (left / total * 100) + '%'; });
    const el = $('#my-turn-left'); if (el) el.textContent = `(${Math.ceil(left / 1000)}초)`;
    // 골라 놓고 「결정」을 못 눌렀으면 시간이 끝나기 직전에 고른 대로 보내요 (자동 선택보다 내 선택이 먼저)
    if (choosing && left < 800 && !this.autoSent) {
      const m = v.seats.find(s => s.id === S.myId);
      if (m && !m.folded && !m.ready && (v.phase === 'open' ? this.sel != null : !!this.pickSel())) { this.autoSent = true; ACT.cdOk(); }
    }
  },
};
Object.assign(ACT, {
  /** 보여줄 카드 보기 — 같은 걸 한 번 더 누르면 결정 */
  cdOpen: el => {
    const i = +el.dataset.i;
    if (Cards.sel === i) return ACT.cdOk();
    Cards.sel = i; Cards.draw();
  },
  /** 족보 조합 보기 — 같은 걸 한 번 더 누르면 결정 */
  cdCombo: el => {
    const p = [+el.dataset.a, +el.dataset.b], s = Cards.pickSel();
    if (s && s[0] === p[0] && s[1] === p[1]) return ACT.cdOk();
    Cards.picks = p; Cards.draw();
  },
  /** 내 카드 누르기: 보여줄 카드는 하나만, 족보는 2장까지 (3번째를 누르면 처음 고른 걸 빼요) */
  cdCard: el => {
    const v = Cards.v, i = +el.dataset.i;
    if (!v) return;
    if (v.phase === 'open') Cards.sel = Cards.sel === i ? null : i;
    else if (v.phase === 'pick') {
      const k = Cards.picks.indexOf(i);
      if (k >= 0) Cards.picks.splice(k, 1);
      else { Cards.picks.push(i); if (Cards.picks.length > 2) Cards.picks.shift(); }
    } else return;
    Cards.draw();
  },
  cdOk: () => {
    const v = Cards.v;
    if (!v) return;
    if (v.phase === 'open' && Cards.sel != null) socket.emit('card:open', Cards.sel);
    else if (v.phase === 'pick' && Cards.pickSel()) socket.emit('card:pick', Cards.pickSel());
    else return;
    $('#card-actions').classList.add('hidden');            // 서버가 다음 상태를 보낼 때까지
  },
});
socket.on('card:start', d => {
  if (!isScreen('card')) { stopLocal(); Cards.logs = []; show('card'); every(200, () => Cards.tick()); }
  Cards.prev = {}; Cards.vis = {}; Cards.sel = null; Cards.picks = [];
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
