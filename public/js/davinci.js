/* =====================================================================
 *  🔐 암호 해독 화면 (규칙: shared/davinci-core.js) — 상대 타일을 누르고 숫자를 골라 맞혀요
 * ===================================================================== */
makeScreen('davinci', {
  title: '🔐 암호 해독', status: '타일은 작은 수부터 정렬돼요(같은 수면 검정이 왼쪽). 조커(−)는 아무 자리에나! 색과 순서로 상대 숫자를 추리하세요.',
  stats: [['pool', '남은 더미'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="dv-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn on" data-act="dvSolo" data-bots="1">1명</button><button class="seg-btn" data-act="dvSolo" data-bots="2">2명</button><button class="seg-btn" data-act="dvSolo" data-bots="3">3명</button></div>
    <div class="dv-table" id="dv-table">
      <div class="dv-opps" id="dv-opps"></div>
      <div class="dv-center"><div class="dv-msg" id="dv-msg"></div><div class="dv-picker" id="dv-picker"></div></div>
      <div class="dv-me"><div class="dv-label">내 암호</div><div class="dv-row" id="dv-mine"></div><div class="dv-drawn" id="dv-drawn"></div></div>
      <div class="dv-acts" id="dv-acts"></div>
    </div>`,
});

const DV = {
  sel: null,
  render(v, ctx, prev) {
    if (!prev || this.gen !== Table.cur) { this.gen = Table.cur; this.lastN = v.last ? v.last.n : 0; this.sel = null; }
    this.v = v; this.ctx = ctx;
    $('#dv-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    setStat('davinci', 'pool', `${v.pool}장`);
    const mine = v.turnId === ctx.me && !v.over, me = v.players.find(p => p.id === ctx.me);
    if (!mine) this.sel = null;
    const J = DavinciCore.JOKER;
    if (!(mine && v.phase === 'place')) this.placePos = null;
    const tile = (t, extra = '', attrs = '') => `<button class="dv-tile ${t.c} ${t.v == null ? 'hid' : ''} ${t.v === J ? 'jk' : ''} ${t.open ? 'open' : ''} ${t.isNew ? 'new' : ''} ${extra}" data-uid="${t.uid}" ${attrs}><b>${t.v == null ? '' : t.v === J ? '−' : t.v}</b>${t.v === J ? '<u>조커</u>' : ''}${t.open ? '<i>공개</i>' : ''}</button>`;
    const placing = mine && v.phase === 'place' && v.drawn, placed = placing && this.placePos != null;
    const canPick = mine && (!placing || placed);
    $('#dv-opps').innerHTML = v.players.filter(p => p.id !== ctx.me).map(p => `<div class="dv-opp ${p.id === v.turnId ? 'turn' : ''} ${p.out ? 'out' : ''} ${p.id === v.winner ? 'win' : ''}">
      <div class="dv-name"><i style="--c:${avColor(p.id)}"></i>${esc(p.name)}${p.out ? '<em>해독됨</em>' : ''}${p.id === v.winner ? '<em class="gold">승리</em>' : ''}</div>
      <div class="dv-row">${p.tiles.map((t, i) => tile(t, canPick && !t.open ? 'pick' + (this.sel && this.sel.target === p.id && this.sel.idx === i ? ' sel' : '') : '', `data-act="dvPick" data-target="${esc(p.id)}" data-idx="${i}"`)).join('')}</div></div>`).join('');
    const slot = i => `<button class="dv-slot ${placed && this.placePos === i ? 'on' : ''}" data-act="dvPlace" data-pos="${i}" title="여기에 놓기"><span>+</span></button>`;
    if (me && placing) {                             // 조커 놓을 자리 미리 보기 (첫 추리와 함께 보내요)
      const row = me.tiles.map(t => tile(t, t.open ? '' : 'secret'));
      if (placed) row.splice(this.placePos, 0, tile(Object.assign({}, v.drawn, { isNew: true }), 'preview'));
      $('#dv-mine').innerHTML = placed ? row.join('') + `<button class="btn ghost sm dv-move" data-act="dvUnplace">자리 바꾸기</button>` : slot(0) + row.map((h, i) => h + slot(i + 1)).join('');
    } else $('#dv-mine').innerHTML = me ? me.tiles.map(t => tile(t, t.open ? '' : 'secret')).join('') : '';
    $('#dv-mine').classList.toggle('placing', !!placing && !placed);
    $('#dv-drawn').innerHTML = placing && !placed ? `<small>조커를 뽑았어요! 내 줄에서 놓고 싶은 자리(+)를 누르세요</small>${tile(v.drawn, 'new')}` : '';
    $('#dv-msg').textContent = v.msg;
    // 맞히기 결과 효과
    if (v.last && v.last.n !== this.lastN) {
      this.lastN = v.last.n;
      const el = $(`.dv-tile[data-uid="${v.last.uid}"]`);
      if (el) { el.classList.add(v.last.ok ? 'hit' : 'miss'); }
    }
    this.picker(v, ctx, mine, me);
    $('#dv-acts').innerHTML = placing && !placed ? '<span class="dv-hint">조커는 색 · 숫자 순서와 상관없이 아무 자리에나 놓을 수 있어요</span>' : mine && v.phase === 'after' ? '<span class="dv-hint">정답! 다른 타일을 눌러 계속 맞히거나</span><button class="btn ghost" data-act="dvStop">멈추기 (뽑은 타일 숨기기)</button>'
      : mine ? `<span class="dv-hint">${this.sel ? '숫자를 고르세요' : '맞힐 상대 타일을 누르세요'}</span>` : v.over ? '' : `<span class="muted">${esc((v.players.find(p => p.id === v.turnId) || {}).name || '')} 님이 추리 중…</span>`;
  },
  /** 숫자 고르기: 내가 아는 정보로 불가능한 숫자는 흐리게 */
  picker(v, ctx, mine, me) {
    const box = $('#dv-picker');
    if (!mine || !this.sel) { box.innerHTML = ''; return; }
    const tp = v.players.find(p => p.id === this.sel.target), t = tp && tp.tiles[this.sel.idx];
    if (!t || t.v != null) { this.sel = null; box.innerHTML = ''; return; }
    const rows = v.players.map(p => p.tiles.map(x => ({ c: x.c, v: x.v })));
    const info = DavinciCore.knownInfo(rows, me.tiles, v.drawn);
    const cand = new Set(DavinciCore.candidates(tp.tiles.map(x => ({ c: x.c, v: x.v })), this.sel.idx, info));
    const J = DavinciCore.JOKER;
    box.innerHTML = `<p>${esc(tp.name)} 님의 <b>${t.c === 'b' ? '검정' : '흰색'}</b> 타일은 몇일까요?</p><div class="dv-nums">${Array.from({ length: 12 }, (_, n) =>
      `<button class="dv-num ${t.c} ${cand.has(n) ? '' : 'no'}" data-act="dvGuess" data-v="${n}">${n}</button>`).join('')}<button class="dv-num jk ${t.c} ${cand.has(J) ? '' : 'no'}" data-act="dvGuess" data-v="${J}">−<small>조커</small></button></div><small class="muted">흐린 숫자는 이미 보이거나 순서상 불가능한 숫자예요.</small>`;
  },
};
Object.assign(ACT, {
  dvPick: el => {
    const v = DV.v, c = DV.ctx;
    if (!v || !c || v.turnId !== c.me || !el.classList.contains('pick')) return;
    DV.sel = { target: el.dataset.target, idx: +el.dataset.idx };
    DV.render(v, c, v);
    if (window.innerWidth < 700) requestAnimationFrame(() => { const b = $('#dv-picker'); if (b) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  },
  dvGuess: el => {
    const s = DV.sel, c = DV.ctx;
    if (!s || !c) return;
    DV.sel = null;
    const a = { t: 'guess', target: s.target, idx: s.idx, v: +el.dataset.v };
    if (DV.v && DV.v.phase === 'place' && DV.placePos != null) a.pos = DV.placePos;
    c.send(a);
  },
  dvPlace: el => { DV.placePos = +el.dataset.pos; DV.render(DV.v, DV.ctx, DV.v); },
  dvUnplace: () => { DV.placePos = null; DV.sel = null; DV.render(DV.v, DV.ctx, DV.v); },
  dvStop: () => { const c = DV.ctx; DV.sel = null; if (c) c.send({ t: 'stop' }); },
  dvSolo: el => {
    DV.bots = +el.dataset.bots;
    Table.solo('davinci', { bots: DV.bots });
    $$('#dv-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === DV.bots));
  },
});
Table.def('davinci', { core: DavinciCore, render: (v, ctx, prev) => DV.render(v, ctx, prev), solo: { bots: 1 } });
