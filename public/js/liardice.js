/* =====================================================================
 *  🎲 라이어 다이스 화면 (규칙: shared/liardice-core.js) — 컵 속 주사위, 부르기 · 거짓말 · 딱 맞아
 * ===================================================================== */
makeScreen('liardice', {
  title: '🎲 라이어 다이스', status: '판 전체에 어떤 눈이 몇 개 있을지 불러요. 1은 와일드! 의심되면 "거짓말!"',
  stats: [['total', '판 전체 주사위'], ['mine', '내 주사위'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="ld-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="ldSolo" data-bots="1">1명</button><button class="seg-btn on" data-act="ldSolo" data-bots="3">3명</button><button class="seg-btn" data-act="ldSolo" data-bots="5">5명</button></div>
    <div class="ld-table" id="ld-table">
      <div class="ld-opps" id="ld-opps"></div>
      <div class="ld-center"><div class="ld-bid" id="ld-bid"></div><div class="ld-msg" id="ld-msg"></div><div class="ld-hist" id="ld-hist"></div></div>
      <div class="ld-mine" id="ld-mine"></div>
    </div>
    <div class="ld-controls" id="ld-controls"></div>`,
});

const LD = {
  q: 1, f: 2,
  render(v, ctx, prev) {
    this.v = v; this.ctx = ctx;
    $('#ld-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const me = v.players.find(p => p.id === ctx.me), R = v.reveal, bidF = R ? R.bid.f : v.bid ? v.bid.f : null;
    const nameOf = id => esc((v.players.find(p => p.id === id) || {}).name || '');
    setStat('liardice', 'total', `${v.total}개`);
    setStat('liardice', 'mine', me ? `${me.n}개` : '-');
    const dieHtml = (d, cls = '') => `<span class="ld-die ${d === 1 ? 'wild' : ''} ${bidF && (d === bidF || d === 1) && (R || cls.includes('mine')) ? 'match' : ''} ${cls}">${Pieces.die(d)}</span>`;
    // 상대들
    $('#ld-opps').innerHTML = v.players.filter(p => p.id !== ctx.me).map(p => {
      const rv = R && R.dice.find(x => x.id === p.id);
      const body = rv ? `<div class="ld-dice">${rv.dice.map(d => dieHtml(d)).join('') || '<small>주사위 없음</small>'}</div>`
        : p.n ? `<div class="ld-cup"><i></i><span>${p.n}</span></div>` : '<div class="ld-out">탈락</div>';
      const tags = [R && R.loser === p.id ? '<em class="lose">-1</em>' : '', R && R.gainer === p.id ? '<em class="gain">+1</em>' : '', p.id === v.winner ? '<em class="gain">승리</em>' : ''].join('');
      return `<div class="ld-opp ${p.id === v.turnId ? 'turn' : ''} ${!p.n ? 'dead' : ''}"><div class="ld-pname"><i style="--c:${avColor(p.id)}"></i>${esc(p.name)}${tags}</div>${body}<small>주사위 ${p.n}개</small></div>`;
    }).join('');
    // 가운데: 현재 부른 것
    const b = R ? R.bid : v.bid;
    $('#ld-bid').innerHTML = b ? `<small>${nameOf(b.id)} 님의 부르기</small><div class="ld-bidv"><b>${b.q}</b><span>개의</span>${Pieces.die(b.f)}</div>${R ? `<div class="ld-count ${R.count >= b.q ? 'ok' : 'no'}">실제 ${R.count}개</div>` : ''}`
      : '<small>아직 아무도 부르지 않았어요</small><div class="ld-bidv empty">?</div>';
    $('#ld-msg').textContent = v.msg;
    $('#ld-hist').innerHTML = v.history.map(h => `<span><b>${nameOf(h.id)}</b> ${h.q}×${h.f}</span>`).join('<i>›</i>');
    // 내 주사위
    const myR = R && R.dice.find(x => x.id === ctx.me);
    const myDice = myR ? myR.dice : me && me.dice ? me.dice : [];
    $('#ld-mine').innerHTML = me ? `<div class="ld-mylabel">내 주사위 ${R && R.loser === ctx.me ? '<em class="lose">-1</em>' : ''}${R && R.gainer === ctx.me ? '<em class="gain">+1</em>' : ''}</div>
      <div class="ld-dice mine">${myDice.map(d => dieHtml(d, 'mine big')).join('') || '<p class="ld-out">탈락했어요. 구경해요!</p>'}</div>` : '';
    this.controls(v, ctx, me);
  },
  controls(v, ctx, me) {
    const box = $('#ld-controls'), mine = v.turnId === ctx.me && v.phase === 'bid';
    if (!mine) { box.innerHTML = v.over ? '' : `<p class="ld-note">${v.phase === 'reveal' ? '공개 중… 곧 새 판이 시작돼요.' : `${esc((v.players.find(p => p.id === v.turnId) || {}).name || '')} 님이 고민 중…`}</p>`; return; }
    const b = v.bid;
    if (this.turnKey !== v.seq) {     // 내 차례가 새로 오면 가장 작은 올리기로 맞춰 둬요
      this.turnKey = v.seq;
      if (b) { if (b.f < 6) { this.q = b.q; this.f = b.f + 1; } else { this.q = b.q + 1; this.f = 2; } }
      else { let f = 2; for (let x = 2; x <= 6; x++) if (YLD(me.dice, x) > YLD(me.dice, f)) f = x; this.f = f; this.q = Math.max(1, YLD(me.dice, f)); }
    }
    const ok = !b || this.q > b.q || (this.q === b.q && this.f > b.f);
    const unknown = v.total - me.dice.length, have = YLD(me.dice, this.f);
    box.innerHTML = `<div class="ld-pick">
        <div class="ld-step"><button class="btn ghost" data-act="ldQ" data-d="-1">−</button><b>${this.q}<small>개</small></b><button class="btn ghost" data-act="ldQ" data-d="1">+</button></div>
        <div class="ld-faces">${[2, 3, 4, 5, 6].map(f => `<button class="ld-face ${f === this.f ? 'on' : ''}" data-act="ldF" data-f="${f}">${Pieces.die(f)}</button>`).join('')}</div>
        <button class="btn good lg" data-act="ldBid" ${ok ? '' : 'disabled'}>"${this.q}개의 ${this.f}" 부르기</button></div>
      <div class="ld-calls"><button class="btn bad lg" data-act="ldCall" data-t="liar" ${b ? '' : 'disabled'}>거짓말!</button><button class="btn ghost" data-act="ldCall" data-t="exact" ${b ? '' : 'disabled'}>딱 맞아!</button></div>
      <p class="ld-hint">판 전체 ${v.total}개 · 내 ${this.f}(또는 1) ${have}개 · 모르는 주사위 ${unknown}개 → 기대값 약 ${(have + unknown / 3).toFixed(1)}개</p>`;
  },
};
const YLD = (dice, f) => (dice || []).filter(d => d === f || d === 1).length;
Object.assign(ACT, {
  ldQ: el => { LD.q = Math.max(1, Math.min(LD.v.total, LD.q + +el.dataset.d)); LD.controls(LD.v, LD.ctx, LD.v.players.find(p => p.id === LD.ctx.me)); },
  ldF: el => { LD.f = +el.dataset.f; LD.controls(LD.v, LD.ctx, LD.v.players.find(p => p.id === LD.ctx.me)); },
  ldBid: () => { if (LD.ctx) LD.ctx.send({ t: 'bid', q: LD.q, f: LD.f }); },
  ldCall: el => { if (LD.ctx) LD.ctx.send({ t: el.dataset.t }); },
  ldSolo: el => {
    LD.bots = +el.dataset.bots;
    Table.solo('liardice', { bots: LD.bots });
    $$('#ld-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === LD.bots));
  },
});
Table.def('liardice', { core: LiarDiceCore, render: (v, ctx, prev) => LD.render(v, ctx, prev), solo: { bots: 3 } });
