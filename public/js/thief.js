/* =====================================================================
 *  🃏 도둑잡기 화면 (규칙: shared/thief-core.js)
 *  내 차례: 가운데 펼쳐진 상대 카드 중 한 장을 뽑기 · 상대가 어떤 카드를 고민하는지 실시간으로 보여요
 * ===================================================================== */
makeScreen('thief', {
  title: '🃏 도둑잡기', status: '같은 숫자 두 장은 버리고, 옆 사람 카드를 뽑아 짝을 맞춰요. 마지막에 조커를 든 사람이 도둑!',
  stats: [['left', '내 카드'], ['out', '탈출'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="th-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="thSolo" data-bots="1">1명</button><button class="seg-btn" data-act="thSolo" data-bots="2">2명</button>
      <button class="seg-btn on" data-act="thSolo" data-bots="3">3명</button><button class="seg-btn" data-act="thSolo" data-bots="5">5명</button></div>
    <div class="th-table felt" id="th-table">
      <div id="th-seats"></div>
      <div class="th-center"><div class="th-pile" id="th-pile"></div><div class="th-msg" id="th-msg"></div><div class="th-pick" id="th-pick"></div></div>
      <div class="th-me" id="th-me"><div class="th-hand" id="th-hand"></div>
        <div class="th-me-bar"><span id="th-me-info"></span><button class="btn ghost" data-act="thShuffle">내 패 섞기</button></div></div>
      <div class="th-fly hidden" id="th-fly"></div>
    </div>`,
});

const Thief = {
  render(v, ctx, prev) {
    const first = !prev || !this.v || this.gen !== Table.cur;
    if (first) { this.pickKey = null; this.handKey = null; }
    this.gen = Table.cur; this.v = v; this.ctx = ctx;
    $('#th-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const me = v.players.find(p => p.id === ctx.me), byId = Object.fromEntries(v.players.map(p => [p.id, p]));
    const meIdx = Math.max(0, v.players.findIndex(p => p.id === ctx.me));
    const others = v.players.slice(meIdx + 1).concat(v.players.slice(0, meIdx)).filter(p => p.id !== ctx.me);
    setStat('thief', 'left', me ? `${me.n}장` : '-');
    setStat('thief', 'out', `${v.players.filter(p => p.out).length} / ${v.players.length}`);

    // 상대 자리 (위쪽 반원)
    $('#th-seats').innerHTML = others.map((p, k) => {
      const x = others.length === 1 ? 50 : 16 + (68 * k) / (others.length - 1), y = 5 + 12 * ((x - 50) / 34) ** 2;
      const backs = Array.from({ length: Math.min(p.n, 14) }, () => '<i></i>').join('');
      return `<div class="th-seat ${p.id === v.turnId ? 'turn' : ''} ${p.id === v.targetId ? 'target' : ''} ${p.out ? 'out' : ''} ${p.id === v.loser ? 'loser' : ''}" data-id="${esc(p.id)}" style="left:${x}%;top:${y}%">
        <span class="th-av" style="--c:${avColor(p.id)}">${esc(p.name[0] || '?')}</span><b>${esc(p.name)}</b>
        <div class="th-mini">${backs}</div><small>${p.n}장 · 짝 ${p.pairs}</small>${p.out ? `<em>${p.out}등 탈출</em>` : p.id === v.loser ? '<em class="bad">도둑!</em>' : ''}</div>`;
    }).join('');

    // 버린 짝
    $('#th-pile').innerHTML = v.discard.map((pr, i) => `<div class="th-pair" style="--r:${(i * 37) % 24 - 12}deg">${Pieces.card(pr[0], 'sm')}${Pieces.card(pr[1], 'sm')}</div>`).join('');
    $('#th-msg').textContent = v.msg;

    // 가운데: 지금 뽑히는 사람의 카드 (내 차례면 고를 수 있음)
    const mine = v.turnId === ctx.me, target = byId[v.targetId], drawer = byId[v.turnId];
    let pickKey = '', pickHtml = '';
    if (!v.over && target && drawer && target.id !== ctx.me) {
      pickKey = `${mine}|${target.id}|${drawer.id}|${target.n}`;
      pickHtml = `<p>${mine ? `<b>${esc(target.name)}</b> 님의 카드 중 한 장을 뽑으세요!` : `${esc(drawer.name)} 님이 ${esc(target.name)} 님의 카드를 고르는 중…`}</p>
        <div class="th-fan ${mine ? 'mine' : 'small'}">${Array.from({ length: target.n }, (_, i) => `<button class="th-back" data-act="thDraw" data-i="${i}" ${mine ? '' : 'disabled'}>${Pieces.card(null)}</button>`).join('')}</div>`;
    } else if (!v.over && target && target.id === ctx.me) {
      pickKey = `warn|${drawer.id}`;
      pickHtml = `<p class="warn"><b>${esc(drawer.name)}</b> 님이 내 카드를 뽑으려고 해요! (패를 섞어서 헷갈리게 할 수 있어요)</p>`;
    }
    if (pickKey !== this.pickKey) { this.pickKey = pickKey; $('#th-pick').innerHTML = pickHtml; }   // 같은 상황이면 다시 그리지 않아요 (마우스 올림 유지)
    $$('#th-pick .th-back').forEach((b, i) => b.classList.toggle('eyed', v.hover === i));

    // 내 패
    const hand = me && me.hand ? me.hand : [], mid = (hand.length - 1) / 2;
    const eyed = target && target.id === ctx.me ? v.hover : null, handKey = hand.join(',') + '|' + (me ? me.out : '');
    if (handKey !== this.handKey) {
      this.handKey = handKey;
      $('#th-hand').innerHTML = hand.map((c, i) => `<div class="th-card ${c === 'JK' ? 'jk' : ''}" style="--a:${((i - mid) * Math.min(5, 40 / Math.max(1, hand.length))).toFixed(1)}deg;--y:${(Math.abs(i - mid) * 1.6).toFixed(1)}px">${Pieces.card(c)}</div>`).join('')
        || (me && me.out ? `<p class="th-done">${me.out}등으로 탈출했어요!</p>` : '');
    }
    $$('#th-hand .th-card').forEach((el, i) => el.classList.toggle('eyed', eyed === i));
    $('#th-me-info').innerHTML = me ? `<b>${esc(me.name)}</b> · ${me.n}장 · 짝 ${me.pairs}${v.turnId === ctx.me ? ' · <em>내 차례!</em>' : ''}` : '관전 중';
    $('#th-me').classList.toggle('turn', v.turnId === ctx.me);

    // 카드 이동 · 섞기 효과
    if (!first && v.last && (!this.lastN || v.last.n !== this.lastN)) this.fly(v.last, ctx);
    if (v.last) this.lastN = v.last.n;
    if (!first && v.shuffled && this.shufN != null && v.shuffled.n !== this.shufN) this.shake(v.shuffled.id);
    this.shufN = v.shuffled ? v.shuffled.n : 0;
  },
  /** 뽑힌 카드가 날아가는 효과 */
  fly(L, ctx) {
    const table = $('#th-table'), fly = $('#th-fly');
    const spot = id => id === ctx.me ? $('#th-hand') : $(`.th-seat[data-id="${CSS.escape(id)}"]`);
    const a = spot(L.from), b = spot(L.to); if (!a || !b) return;
    const tr = table.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    fly.innerHTML = Pieces.card(L.card || null);
    fly.classList.remove('hidden');
    fly.style.transition = 'none';
    fly.style.transform = `translate(${ra.left - tr.left + ra.width / 2 - 32}px,${ra.top - tr.top + ra.height / 2 - 46}px) rotate(-8deg)`;
    void fly.offsetWidth;
    fly.style.transition = '';
    fly.style.transform = `translate(${rb.left - tr.left + rb.width / 2 - 32}px,${rb.top - tr.top + rb.height / 2 - 46}px) rotate(6deg)`;
    clearTimeout(this.flyT); this.flyT = setTimeout(() => fly.classList.add('hidden'), 650);
    if (L.to === ctx.me && L.card === 'JK') toast('😱 조커를 뽑았어요! 다른 사람에게 넘겨야 해요.', 'error');
    else if (L.from === ctx.me && L.card === 'JK') toast('😎 조커를 넘겼어요!');
  },
  shake(id) {
    const el = id === this.ctx.me ? $('#th-hand') : $(`.th-seat[data-id="${CSS.escape(id)}"] .th-mini`);
    const pick = this.v && this.v.targetId === id ? $('#th-pick .th-fan') : null;
    [el, pick].forEach(e => { if (!e) return; e.classList.remove('shuffling'); void e.offsetWidth; e.classList.add('shuffling'); });
  },
};
let thHoverT = 0, thHoverI = null;
$('#th-table').addEventListener('mouseover', e => {
  const b = e.target.closest('.th-fan.mine .th-back'); if (!b || !Thief.ctx) return;
  const i = +b.dataset.i, now = Date.now();
  if (i === thHoverI && now - thHoverT < 3000) return;       // 같은 카드면 다시 보내지 않아요
  if (now - thHoverT < 120) return;
  thHoverT = now; thHoverI = i;
  Thief.ctx.send({ t: 'hover', i });
});
Object.assign(ACT, {
  thDraw: el => { const c = Thief.ctx, v = Thief.v; if (c && v && v.turnId === c.me) c.send({ t: 'draw', i: +el.dataset.i }); },
  thShuffle: () => { const c = Thief.ctx; if (c) c.send({ t: 'shuffle' }); },
  thSolo: el => {
    Thief.bots = +el.dataset.bots;
    Table.solo('thief', { bots: Thief.bots });
    $$('#th-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === Thief.bots));
  },
});
Table.def('thief', { core: ThiefCore, render: (v, ctx, prev) => Thief.render(v, ctx, prev), solo: { bots: 3 } });
