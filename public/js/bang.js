/* =====================================================================
 *  ⭐ 황야의 총잡이 화면 (규칙: shared/bang-core.js)
 *  카드를 누르면 → 대상이 필요한 카드는 쏠 수 있는 사람이 빛나요 → 그 사람을 눌러요.
 *  공격을 받으면 아래에 대응 창이 떠요 (빗나감! / 맞기). 잡화점 · 카일 · 버리기도 같은 자리에서 골라요.
 * ===================================================================== */
makeScreen('bang', {
  title: '⭐ 황야의 총잡이', status: '역할을 숨긴 채 싸우는 서부 총격전! 보안관 팀 · 무법자 · 배신자 중 누가 살아남을까요?',
  stats: [['deck', '카드 더미'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="bg-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn on" data-act="bgSolo" data-bots="3">3명</button><button class="seg-btn" data-act="bgSolo" data-bots="4">4명</button>
      <button class="seg-btn" data-act="bgSolo" data-bots="5">5명</button><button class="seg-btn" data-act="bgSolo" data-bots="6">6명</button></div>
    <div class="bg-wrap">
      <div class="bg-seats" id="bg-seats"></div>
      <div class="bg-mid">
        <div class="bg-piles"><div class="bg-pile" id="bg-deck"></div><div class="bg-pile" id="bg-disc"></div></div>
        <div class="bg-center"><div class="bg-msg" id="bg-msg"></div><div class="bg-prompt" id="bg-prompt"></div></div>
        <div class="bg-log" id="bg-log"></div>
      </div>
      <div class="bg-me" id="bg-me"></div>
      <div class="bg-hand" id="bg-hand"></div>
      <div class="bg-bar" id="bg-bar"></div>
    </div>`,
});

const BG = {
  bots: 3, sel: null, picks: new Set(), seenN: 0,
  C: () => BangCore.CARDS,
  roleBadge(r) {
    if (!r) return `<span class="bg-role unk">?</span>`;
    const R = { sheriff: ['star', '보안관'], deputy: ['badge', '부관'], outlaw: ['skull', '무법자'], renegade: ['mask', '배신자'] }[r];
    return `<span class="bg-role ${r}">${icon(R[0])}${R[1]}</span>`;
  },
  hp(p) { let h = ''; for (let i = 0; i < p.max; i++) h += `<i class="${i < p.hp ? 'on' : ''}"></i>`; return `<span class="bg-hp" title="생명력 ${p.hp}/${p.max}">${h}</span>`; },
  chip(c, attrs = '') {
    const I = BangCore.CARDS[c.k];
    return `<span class="bg-chip t-${I.type} k-${c.k}" title="${esc(I.name + ' — ' + I.text)}" ${attrs}>${icon(I.icon)}${esc(I.name)}${I.range ? `<b>${I.range}</b>` : ''}</span>`;
  },
  card(c, cls = '', attrs = '') {
    const I = BangCore.CARDS[c.k], red = c.s === 'H' || c.s === 'D';
    return `<div class="bg-card t-${I.type} k-${c.k} ${cls}" title="${esc(I.text)}" ${attrs}>
      <span class="bg-corner ${red ? 'red' : ''}">${BangCore.RANK(c.r)}<br>${BangCore.SUIT[c.s]}</span>
      <span class="bg-ic">${icon(I.icon)}</span><b>${esc(I.name)}</b><small>${esc(I.range ? `사정거리 ${I.range}${c.k === 'volcanic' ? ' · 뱅! 무제한' : ''}` : I.text)}</small></div>`;
  },
  name(id) { const p = this.v.players.find(x => x.id === id); return p ? p.name : '?'; },

  render(v, ctx, prev) {
    if (!prev || this.gen !== Table.cur) { this.gen = Table.cur; this.sel = null; this.picks.clear(); this.seenN = v.log.length ? v.log[v.log.length - 1].n : 0; this.mode = null; }
    this.v = v; this.ctx = ctx;
    $('#bg-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    setStat('bang', 'deck', `${v.deck}장`);
    const w = v.wait, myWait = w && w.who === ctx.me;
    const waitKey = w ? `${w.kind}:${w.who}:${v.seq}` : '';
    if (waitKey !== this.waitKey) {                 // 상황이 바뀌면 고르던 것은 초기화
      this.sel = null; this.stealFor = null; this.picks.clear(); this.mode = null;
      if (myWait && ctx.mode === 'multi' && w.kind !== 'play' && w.kind !== this.lastKind) toast(w.kind === 'respond' ? '공격받았어요! 대응을 골라요.' : '고를 차례예요!');
    }
    if (myWait && w.kind === 'play' && this.lastTurn !== v.turnNo) { this.lastTurn = v.turnNo; if (ctx.mode === 'multi') toast('내 차례예요!'); }
    this.lastKind = myWait ? w.kind : null;
    this.waitKey = waitKey;
    this.paint();
    this.effects();
  },

  /** 지금 고른 카드로 누구를 노릴 수 있는지 */
  targets() {
    const v = this.v, me = v.players.find(p => p.id === this.ctx.me), c = this.sel && v.hand.find(x => x.id === this.sel);
    if (!c || !me) return new Set();
    const k = c.k === 'missed' && me.char === 'may' ? 'bang' : c.k, out = new Set();
    for (const p of v.players) {
      if (!p.alive) continue;
      if (p.id === me.id) {                       // 내 앞 카드 회수(강탈!) · 스스로 감옥도 규칙상 가능
        if (k === 'panic' && p.inPlay.length) out.add(p.id);
        if (k === 'jail' && p.role !== 'sheriff' && !p.inPlay.some(x => x.k === 'jail')) out.add(p.id);
        continue;
      }
      const d = BangCore.distance(v.players, me.id, p.id);
      if (k === 'bang' && d <= BangCore.range(me)) out.add(p.id);
      if (k === 'panic' && d <= 1 && (p.hand || p.inPlay.length)) out.add(p.id);
      if (k === 'catbalou' && (p.hand || p.inPlay.length)) out.add(p.id);
      if (k === 'duel') out.add(p.id);
      if (k === 'jail' && p.role !== 'sheriff' && !p.inPlay.some(x => x.k === 'jail')) out.add(p.id);
    }
    return out;
  },
  needsTarget(c) { const me = this.v.players.find(p => p.id === this.ctx.me); return ['bang', 'panic', 'catbalou', 'duel', 'jail'].includes(c.k) || (c.k === 'missed' && me && me.char === 'may'); },

  paint() {
    const v = this.v, ctx = this.ctx, w = v.wait, me = v.players.find(p => p.id === ctx.me);
    const tg = this.targets(), C = BangCore.CHARS;
    // 다른 사람 자리 (내 다음 사람부터 자리 순서대로)
    const i0 = v.players.findIndex(p => p.id === ctx.me);
    const seats = i0 < 0 ? v.players : v.players.slice(i0 + 1).concat(v.players.slice(0, i0));
    $('#bg-seats').innerHTML = seats.map(p => {
      const d = me && me.alive && p.alive ? BangCore.distance(v.players, me.id, p.id) : null;
      const inRange = me && d != null && d <= BangCore.range(me);
      const cls = [p.id === v.turnId ? 'turn' : '', p.alive ? '' : 'dead', tg.has(p.id) ? 'target' : '', this.sel && !tg.has(p.id) ? 'dim' : '',
        w && w.who === p.id && w.kind !== 'play' ? 'deciding' : '', v.winners.includes(p.id) ? 'win' : ''].join(' ');
      return `<div class="bg-seat ${cls}" data-pid="${esc(p.id)}" ${tg.has(p.id) ? `data-act="bgTarget" data-id="${esc(p.id)}"` : `data-act="bgInfo" data-id="${esc(p.id)}"`}>
        <div class="bg-top"><i class="bg-dot" style="--c:${avColor(p.id)}"></i><b>${esc(p.name)}</b>${this.roleBadge(p.role)}</div>
        <div class="bg-char" title="${esc(C[p.char].text)}">${esc(C[p.char].name)}</div>
        <div class="bg-row">${p.alive ? this.hp(p) : `<span class="bg-rip">${icon('ghost')} 쓰러짐</span>`}<span class="bg-cnt" title="손에 든 카드">${icon('stack-2')}${p.hand}</span>${d != null ? `<span class="bg-dist ${inRange ? 'in' : ''}" title="${inRange ? '내 사정거리 안' : '내 사정거리 밖'}">거리 ${d}</span>` : ''}</div>
        <div class="bg-eq">${p.inPlay.map(c => this.chip(c)).join('')}</div>
        ${v.over && p.handCards && p.handCards.length ? `<div class="bg-left">${p.handCards.map(c => this.chip(c)).join('')}</div>` : ''}
      </div>`;
    }).join('');
    // 더미
    $('#bg-deck').innerHTML = `<div class="bg-back">${icon('star')}</div><small>더미 ${v.deck}</small>`;
    $('#bg-disc').innerHTML = v.discardTop ? this.card(v.discardTop, 'mini') + '<small>버린 카드</small>' : '<div class="bg-empty"></div><small>버린 카드</small>';
    $('#bg-msg').textContent = v.msg;
    $('#bg-log').innerHTML = v.log.slice(-9).reverse().map(e => `<div class="bg-l ${e.kind || ''}">${esc(e.text || '')}</div>`).join('');
    // 내 자리
    if (me) {
      const R = BangCore.ROLES[me.role];
      $('#bg-me').innerHTML = `<div class="bg-mycard ${me.id === v.turnId ? 'turn' : ''} ${me.alive ? '' : 'dead'}" data-pid="${esc(me.id)}">
        <div class="bg-top"><i class="bg-dot" style="--c:${avColor(me.id)}"></i><b>${esc(me.name)} (나)</b>${this.roleBadge(me.role)}</div>
        <div class="bg-goal">${esc(R.goal)}</div>
        <div class="bg-char big"><b>${esc(C[me.char].name)}</b> ${esc(C[me.char].text)}</div>
        <div class="bg-row">${me.alive ? this.hp(me) : `<span class="bg-rip">${icon('ghost')} 쓰러졌어요 — 구경 중</span>`}<span class="bg-range">${icon('crosshair')} 사정거리 ${BangCore.range(me)}</span>
          ${BangCore.unlimited(me) ? '<span class="bg-tag">뱅! 무제한</span>' : `<span class="bg-tag ${v.bangs && me.id === v.turnId ? 'used' : ''}">뱅! ${me.id === v.turnId && v.bangs ? '사용함' : '1번'}</span>`}</div>
        <div class="bg-eq">${me.inPlay.map(c => this.chip(c)).join('') || '<span class="muted small">앞에 놓인 카드 없음</span>'}</div></div>`;
    } else $('#bg-me').innerHTML = '';
    // 내 손패
    const picking = w && w.who === ctx.me && (w.kind === 'discard' || this.mode === 'heal');
    const playing = w && w.who === ctx.me && w.kind === 'play' && !this.mode;
    $('#bg-hand').innerHTML = v.hand.map(c => {
      const cls = (this.sel === c.id ? 'sel' : '') + (this.picks.has(c.id) ? ' pick' : '') + (playing || picking ? ' live' : '');
      return this.card(c, cls, playing || picking ? `data-act="bgCard" data-id="${c.id}"` : '');
    }).join('') || '<span class="muted">손에 카드가 없어요</span>';
    this.prompt();
  },

  prompt() {
    const v = this.v, ctx = this.ctx, w = v.wait, box = $('#bg-prompt'), bar = $('#bg-bar');
    const me = v.players.find(p => p.id === ctx.me), mine = w && w.who === ctx.me;
    let html = '', btns = '';
    if (v.over) {
      html = `<div class="bg-big win">${esc(v.msg)}</div>`;
    } else if (!w) html = '';
    else if (w.kind === 'store') {
      const st = v.store;
      html = `<div class="bg-ask"><b>잡화점</b> ${mine ? '가져갈 카드를 한 장 고르세요!' : `${esc(this.name(w.who))} 님이 고르는 중…`}</div>
        <div class="bg-pick">${(st ? st.cards : []).map(c => this.card(c, mine ? 'live' : '', mine ? `data-act="bgStore" data-id="${c.id}"` : '')).join('')}</div>`;
    } else if (!mine) {
      const who = esc(this.name(w.who));
      html = w.kind === 'respond' ? `<div class="bg-ask">${who} 님이 대응을 고르는 중…</div>` : '';
    } else if (w.kind === 'respond') {
      const from = esc(this.name(w.from));
      const what = { bang: `${from} 님이 나에게 <b>뱅!</b>`, gatling: `${from} 님의 <b>기관총</b>!`, indians: `${from} 님의 <b>습격!</b>`, duel: `<b>결투</b> 중! ${from} 님이 뱅!을 냈어요` }[w.src];
      const isShot = w.src === 'bang' || w.src === 'gatling';
      const pool = v.hand.filter(c => (isShot ? c.k === 'missed' || (me.char === 'may' && c.k === 'bang') : c.k === 'bang' || (me.char === 'may' && c.k === 'missed')));
      html = `<div class="bg-ask alert">${what} ${isShot ? `빗나감! ${w.need}장이 필요해요.` : '뱅! 한 장을 버려야 해요.'}</div>`;
      btns = `<button class="btn good" data-act="bgRespond" ${pool.length >= w.need ? '' : 'disabled'}>${icon(isShot ? 'shield' : 'target')} ${isShot ? `빗나감! 내기${w.need > 1 ? ` (${w.need}장)` : ''}` : '뱅! 버리기'}</button>
        <button class="btn bad" data-act="bgTake">${icon('heart-broken')} ${w.src === 'duel' ? '결투 포기 (생명력 -1)' : '맞기 (생명력 -1)'}</button>`;
    } else if (w.kind === 'draw') {
      const top = v.discardTop;
      html = `<div class="bg-ask">첫 번째 카드를 어디서 가져올까요?</div>`;
      btns = `<button class="btn" data-act="bgDraw" data-from="deck">${icon('stack-2')} 카드 더미</button>`;
      if (me.char === 'pepe' && top) btns += `<button class="btn info" data-act="bgDraw" data-from="discard">${icon('trash')} 버린 카드: ${esc(BangCore.CARDS[top.k].name)}</button>`;
      if (me.char === 'finn') btns += v.players.filter(p => p.alive && p.id !== me.id && p.hand).map(p => `<button class="btn ghost" data-act="bgDraw" data-from="${esc(p.id)}">${icon('hand-grab')} ${esc(p.name)} (${p.hand}장)</button>`).join('');
    } else if (w.kind === 'kyle') {
      html = `<div class="bg-ask">3장 중 <b>더미로 돌려놓을</b> 카드 한 장을 고르세요. 나머지 2장을 가져가요.</div>
        <div class="bg-pick">${(w.cards || []).map(c => this.card(c, 'live', `data-act="bgKyle" data-id="${c.id}"`)).join('')}</div>`;
    } else if (w.kind === 'discard') {
      html = `<div class="bg-ask">손에 카드가 생명력보다 많아요. <b>${w.need}장</b>을 골라 버리세요. (${this.picks.size}/${w.need})</div>`;
      btns = `<button class="btn bad" data-act="bgDiscard" ${this.picks.size === w.need ? '' : 'disabled'}>${icon('trash')} 버리고 차례 끝내기</button>`;
    } else if (w.kind === 'play') {
      if (this.mode === 'heal') {
        html = `<div class="bg-ask">버릴 카드 <b>2장</b>을 고르면 생명력 +1 (${this.picks.size}/2)</div>`;
        btns = `<button class="btn good" data-act="bgHealGo" ${this.picks.size === 2 ? '' : 'disabled'}>${icon('heart')} 회복</button><button class="btn ghost" data-act="bgCancel">취소</button>`;
      } else if (this.sel) {
        const c = v.hand.find(x => x.id === this.sel), k = c ? c.k : '';
        html = this.stealFor
          ? `<div class="bg-ask">${esc(this.name(this.stealFor))} 님의 어떤 카드를 ${k === 'panic' ? '빼앗을까요' : '버리게 할까요'}?</div><div class="bg-steal">${this.stealOpts()}</div>`
          : `<div class="bg-ask">${c ? `<b>${esc(BangCore.CARDS[c.k].name)}</b> — 누구에게 쓸까요?` : ''}${this.targets().size ? '' : ' <span class="bg-warn">지금은 노릴 수 있는 사람이 없어요.</span>'}</div>
            <div class="bg-steal">${[...this.targets()].sort((x, y) => (x === me.id) - (y === me.id)).map(id => { const t = v.players.find(p => p.id === id); return `<button class="btn ghost sm" data-act="bgTarget" data-id="${esc(id)}"><i class="bg-dot" style="--c:${avColor(id)}"></i>${id === me.id ? (k === 'jail' ? '나 (스스로 감옥)' : '나 (내 앞 카드 회수)') : `${esc(t.name)} <small>거리 ${BangCore.distance(v.players, me.id, id)}</small>`}</button>`; }).join('')}</div>`;
        btns = `<button class="btn ghost" data-act="bgCancel">취소</button>`;
      } else {
        html = `<div class="bg-ask">내 차례! 카드를 눌러 쓰세요. ${v.hand.length > me.hp ? `<span class="bg-warn">차례가 끝나면 ${v.hand.length - me.hp}장을 버려야 해요.</span>` : ''}</div>`;
        btns = (me.char === 'doc' && me.hp < me.max && v.hand.length >= 2 ? `<button class="btn info" data-act="bgHeal">${icon('heart')} 능력: 2장 버리고 회복</button>` : '')
          + `<button class="btn warn" data-act="bgEnd">${icon('player-skip-forward')} 차례 끝내기</button>`;
      }
    }
    box.innerHTML = html;
    bar.innerHTML = btns;
  },
  stealOpts() {
    const t = this.v.players.find(p => p.id === this.stealFor);
    if (!t) return '';
    return (t.hand && t.id !== this.ctx.me ? `<button class="btn" data-act="bgSteal" data-pick="hand">${icon('cards')} 손에 든 카드 (무작위, ${t.hand}장)</button>` : '')
      + t.inPlay.map(c => `<button class="btn ghost" data-act="bgSteal" data-pick="${c.id}">${icon(BangCore.CARDS[c.k].icon)} ${esc(BangCore.CARDS[c.k].name)}</button>`).join('');
  },
  send(a) { this.sel = null; this.stealFor = null; this.mode = null; this.picks.clear(); this.ctx.send(a); },

  /** 새 기록에 맞춰 자리 위에 효과 */
  effects() {
    const v = this.v;
    const fresh = v.log.filter(e => e.n > this.seenN);
    if (!fresh.length) return;
    this.seenN = v.log[v.log.length - 1].n;
    if (fresh.length > 8) return;              // 화면을 처음 열었을 때는 생략
    const seat = id => document.querySelector(`#scr-bang [data-pid="${CSS.escape(id)}"]`);
    const pop = (id, text, cls) => {
      const el = seat(id); if (!el) return;
      const f = document.createElement('span'); f.className = `bg-pop ${cls}`; f.textContent = text;
      el.appendChild(f); setTimeout(() => f.remove(), 1300);
      el.classList.remove('fx-' + cls); void el.offsetWidth; el.classList.add('fx-' + cls); setTimeout(() => el.classList.remove('fx-' + cls), 800);
    };
    fresh.forEach((e, i) => setTimeout(() => {
      if (e.fx === 'shot' && e.to) pop(e.to, '탕!', 'shot');
      else if (e.fx === 'hit') pop(e.id, `-${e.n}`, 'hit');
      else if (e.fx === 'dodge') pop(e.id, '빗나감!', 'dodge');
      else if (e.fx === 'heal') pop(e.id, '+1', 'heal');
      else if (e.fx === 'boom') pop(e.id, '펑!!', 'boom');
      else if (e.fx === 'dead') pop(e.id, '쓰러짐', 'dead');
      else if (e.fx === 'jail') pop(e.to, '감옥!', 'hit');
      else if (e.fx === 'check') pop(e.id, e.cards.map(c => BangCore.SUIT[c.s] + BangCore.RANK(c.r)).join(' ') + (e.ok ? ' 성공' : ' 실패'), e.ok ? 'dodge' : 'hit');
      else if (e.fx === 'gatling' || e.fx === 'indians') v.players.filter(p => p.alive && p.id !== e.from).forEach(p => pop(p.id, e.fx === 'gatling' ? '두두두!' : '습격!', 'shot'));
    }, i * 260));
  },
};

Object.assign(ACT, {
  bgCard: el => {
    const v = BG.v, w = v.wait, id = +el.dataset.id;
    if (!w || w.who !== BG.ctx.me) return;
    if (w.kind === 'discard' || BG.mode === 'heal') {
      const max = w.kind === 'discard' ? w.need : 2;
      if (BG.picks.has(id)) BG.picks.delete(id); else if (BG.picks.size < max) BG.picks.add(id);
      return BG.paint();
    }
    if (w.kind !== 'play') return;
    const c = v.hand.find(x => x.id === id);
    if (!c) return;
    if (BG.sel === id) { BG.sel = null; BG.stealFor = null; return BG.paint(); }
    if (BG.needsTarget(c)) { BG.sel = id; BG.stealFor = null; return BG.paint(); }
    if (c.k === 'missed') return toast('빗나감!은 총을 맞을 때만 써요.', 'error');
    BG.send({ t: 'play', card: id });
  },
  bgTarget: el => {
    const v = BG.v, c = BG.sel && v.hand.find(x => x.id === BG.sel);
    if (!c) return;
    const t = v.players.find(p => p.id === el.dataset.id);
    if ((c.k === 'panic' || c.k === 'catbalou') && (t.inPlay.length || t.id === BG.ctx.me)) { BG.stealFor = t.id; return BG.paint(); }
    BG.send({ t: 'play', card: c.id, target: t.id, pick: c.k === 'panic' || c.k === 'catbalou' ? 'hand' : undefined });
  },
  bgSteal: el => { const pick = el.dataset.pick; BG.send({ t: 'play', card: BG.sel, target: BG.stealFor, pick: pick === 'hand' ? 'hand' : +pick }); },
  bgInfo: el => {
    const p = BG.v && BG.v.players.find(x => x.id === el.dataset.id);
    if (!p) return;
    const ch = BangCore.CHARS[p.char], eq = p.inPlay.map(c => BangCore.CARDS[c.k].name).join(', ');
    toast(`${p.name} · ${ch.name}: ${ch.text}${eq ? ` (앞에 놓인 카드: ${eq})` : ''}`);
  },
  bgCancel: () => { BG.sel = null; BG.stealFor = null; BG.mode = null; BG.picks.clear(); BG.paint(); },
  bgEnd: () => BG.send({ t: 'end' }),
  bgHeal: () => { BG.mode = 'heal'; BG.picks.clear(); BG.sel = null; BG.paint(); },
  bgHealGo: () => BG.send({ t: 'heal', ids: [...BG.picks] }),
  bgRespond: () => {
    const v = BG.v, w = v.wait, me = v.players.find(p => p.id === BG.ctx.me);
    const shot = w.src === 'bang' || w.src === 'gatling';
    const pool = v.hand.filter(c => (shot ? c.k === 'missed' || (me.char === 'may' && c.k === 'bang') : c.k === 'bang' || (me.char === 'may' && c.k === 'missed')))
      .sort((a, b) => (a.k === (shot ? 'missed' : 'bang') ? 0 : 1) - (b.k === (shot ? 'missed' : 'bang') ? 0 : 1));
    BG.send({ t: 'cards', ids: pool.slice(0, w.need).map(c => c.id) });
  },
  bgTake: () => BG.send({ t: 'take' }),
  bgDraw: el => BG.send({ t: 'draw', from: el.dataset.from }),
  bgKyle: el => BG.send({ t: 'kyle', back: +el.dataset.id }),
  bgStore: el => BG.send({ t: 'pick', card: +el.dataset.id }),
  bgDiscard: () => BG.send({ t: 'discard', ids: [...BG.picks] }),
  bgSolo: el => {
    BG.bots = +el.dataset.bots;
    $$('#bg-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === BG.bots));
    Table.solo('bang', { bots: BG.bots, opts: { solo: true } });
  },
});
Table.def('bang', { core: BangCore, render: (v, ctx, prev) => BG.render(v, ctx, prev), solo: { bots: 3, opts: { solo: true } } });
