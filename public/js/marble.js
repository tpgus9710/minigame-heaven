/* =====================================================================
 *  🌍 세계여행 보드게임 화면 (규칙: shared/marble-core.js)
 * ===================================================================== */
makeScreen('marble', {
  title: '🌍 세계여행 보드게임', status: '주사위를 굴려 도시를 사고 건물을 지어요. 상대가 내 땅에 오면 통행료!',
  stats: [['round', '라운드'], ['fund', '복지기금'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="mb-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="mbSolo" data-bots="1">1명</button><button class="seg-btn" data-act="mbSolo" data-bots="2">2명</button><button class="seg-btn" data-act="mbSolo" data-bots="3">3명</button>
      <span class="muted small" style="margin-left:10px">라운드</span>
      <button class="seg-btn" data-act="mbSolo" data-rounds="10">10</button><button class="seg-btn" data-act="mbSolo" data-rounds="20">20</button><button class="seg-btn" data-act="mbSolo" data-rounds="30">30</button></div>
    <div class="mb-wrap"><div class="mb-board" id="mb-board"></div><div class="mb-side" id="mb-side"></div></div>`,
});

const Marble = {
  /** 칸 번호 → 9×9 판의 (행, 열) */
  cellRC(i) {
    if (i <= 8) return [8, 8 - i];
    if (i <= 16) return [16 - i, 0];
    if (i <= 24) return [0, i - 16];
    return [i - 24, 8];
  },
  build() {
    const B = MarbleCore.BOARD, board = $('#mb-board');
    board.innerHTML = B.map((b, i) => {
      const [r, c] = this.cellRC(i), corner = i % 8 === 0;
      const side = i < 8 ? 'b' : i < 16 ? 'l' : i < 24 ? 't' : 'r';
      let inner = '';
      if (b.type === 'city') inner = `<span class="band" style="background:${MarbleCore.GROUPS[b.group]}"></span><span class="flag">${b.code}</span><b class="nm ${b.name.length > 5 ? 'long' : ''}">${b.name}</b><span class="pr" id="mb-pr-${i}">${b.price}만</span><span class="bld" id="mb-bld-${i}"></span>`;
      else if (b.type === 'spot') inner = `<span class="band spot"></span><span class="flag">관광지</span><b class="nm">${b.name}</b><span class="pr" id="mb-pr-${i}">${b.price}만</span><span class="bld" id="mb-bld-${i}"></span>`;
      else if (b.type === 'key') inner = `<span class="key-ic">KEY</span><b class="nm">황금열쇠</b>`;
      else if (b.type === 'tax') inner = `<span class="key-ic tax">TAX</span><b class="nm">국세청</b><span class="pr">현금의 10%</span>`;
      else inner = `<b class="corner-t">${{ start: '출발', island: '무인도', fund: '복지기금', travel: '세계여행' }[b.type]}</b><small>${{ start: `지나가면 +${MarbleCore.SALARY}만`, island: '3턴 쉬기 · 더블 탈출', fund: '<span id="mb-fund">0</span>만원 적립', travel: '다음 턴 원하는 곳으로' }[b.type]}</small>`;
      return `<div class="mb-cell ${b.type} ${corner ? 'corner' : ''} side-${side}" data-i="${i}" style="grid-row:${r + 1};grid-column:${c + 1}">${inner}</div>`;
    }).join('') + `<div class="mb-center"><div class="mb-logo">WORLD<span>TOUR</span></div>
        <div class="mb-dice" id="mb-dice"></div><div class="mb-msg" id="mb-msg"></div><div class="mb-acts" id="mb-acts"></div>
        <div class="mb-info" id="mb-info">칸을 누르면 정보를 볼 수 있어요.</div><div class="mb-card hidden" id="mb-card"></div></div>`;
    this.disp = {}; this.lastRolls = null; this.lastCard = null; this.money = {};
  },
  render(v, ctx, prev) {
    if (!prev || !$('#mb-board .mb-center')) this.build();
    this.v = v; this.ctx = ctx;
    $('#mb-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const B = MarbleCore.BOARD, byId = Object.fromEntries(v.players.map(p => [p.id, p]));
    setStat('marble', 'round', `${v.round} / ${v.maxRounds}`);
    setStat('marble', 'fund', Pieces.money(v.fund) + '만');
    $('#mb-fund').textContent = Pieces.money(v.fund);
    // 칸: 주인 색 · 건물 · 통행료
    B.forEach((b, i) => {
      if (b.type !== 'city' && b.type !== 'spot') return;
      const cell = $(`#mb-board [data-i="${i}"]`), o = v.owner[i] && byId[v.owner[i]];
      cell.classList.toggle('owned', !!o);
      cell.style.setProperty('--own', o ? o.color : 'transparent');
      $(`#mb-pr-${i}`).textContent = o ? `통행 ${Pieces.money(v.tolls[i])}` : `${b.price}만`;
      $(`#mb-bld-${i}`).innerHTML = o ? Array.from({ length: v.level[i] }, (_, k) => `<i class="lv${k + 1}"></i>`).join('') : '';
    });
    // 주사위
    if (v.rolls !== this.lastRolls) {
      const first = this.lastRolls == null; this.lastRolls = v.rolls;
      const dice = $('#mb-dice');
      if (first) dice.innerHTML = Pieces.die(v.dice[0]) + Pieces.die(v.dice[1]);
      else {
        dice.classList.add('rolling');
        let n = 0;
        const spin = () => { dice.innerHTML = Pieces.die(1 + rand(6)) + Pieces.die(1 + rand(6)); if (++n < 6) after(70, spin); else { dice.classList.remove('rolling'); dice.innerHTML = Pieces.die(v.dice[0]) + Pieces.die(v.dice[1]); } };
        spin();
      }
    }
    // 황금열쇠 카드
    if (v.card && v.card.n !== this.lastCard) {
      const show1 = this.lastCard != null; this.lastCard = v.card.n;
      if (show1) { const el = $('#mb-card'); el.innerHTML = `<small>GOLDEN KEY</small><b>황금열쇠</b><p>${esc(v.card.txt)}</p>`; el.classList.remove('hidden', 'flip'); void el.offsetWidth; el.classList.add('flip'); clearTimeout(this.cardT); this.cardT = setTimeout(() => el.classList.add('hidden'), 2600); }
    }
    $('#mb-msg').textContent = v.msg;
    this.actions(v, ctx);
    this.side(v);
    this.tokens(v);
  },
  actions(v, ctx) {
    const mine = v.turnId === ctx.me && !v.over, me = v.players.find(p => p.id === ctx.me), acts = $('#mb-acts');
    $$('#mb-board .mb-cell').forEach(c => c.classList.toggle('pick', mine && v.phase === 'travel' && +c.dataset.i !== 24));
    if (!mine) { const t = v.players.find(p => p.id === v.turnId); acts.innerHTML = v.over ? '' : `<span class="muted">${esc(t ? t.name : '')} 님 차례…</span>`; return; }
    const L = MarbleCore.LEVELS;
    if (v.phase === 'roll') {
      acts.innerHTML = me.island
        ? `<button class="btn good" data-act="mbDo" data-t="roll">주사위 (더블이면 탈출)</button><button class="btn ghost" data-act="mbDo" data-t="escape" ${!me.items.escape && me.money < 100 ? 'disabled' : ''}>${me.items.escape ? '탈출권 사용' : '탈출 (100만)'}</button>`
        : `<button class="btn good lg" data-act="mbDo" data-t="roll">주사위 굴리기</button>`;
    } else if (v.phase === 'buy' || v.phase === 'build') {
      const d = v.decision, label = o => (v.phase === 'buy' ? (o.lvl ? `땅+${L.slice(1, o.lvl + 1).join('+')}` : '땅만 사기') : `${L[o.lvl]}까지 짓기`);
      acts.innerHTML = d.options.map(o => `<button class="btn good" data-act="mbDo" data-t="${v.phase}" data-lvl="${o.lvl}">${label(o)} <small>${Pieces.money(o.cost)}만</small></button>`).join('')
        + `<button class="btn ghost" data-act="mbDo" data-t="pass">${v.phase === 'buy' ? '안 살래요' : '안 지을래요'}</button>`;
      this.info(d.pos);
    } else if (v.phase === 'travel') acts.innerHTML = '<span class="mb-hint">✈️ 판에서 가고 싶은 칸을 누르세요</span>';
    else acts.innerHTML = '';
  },
  info(i) {
    const B = MarbleCore.BOARD, b = B[i], v = this.v;
    if (!v || !b) return;
    let html = `<b>${b.name}</b>`;
    if (b.type === 'city') {
      const o = v.owner[i] && v.players.find(p => p.id === v.owner[i]);
      html += ` <small>${b.price}만원 · ${o ? `주인 ${esc(o.name)} (${MarbleCore.LEVELS[v.level[i]]})` : '주인 없음'}</small><div class="mb-tolls">${MarbleCore.TOLL.map((m, k) =>
        `<span class="${o && v.level[i] === k ? 'on' : ''}">${MarbleCore.LEVELS[k]} ${Pieces.money(b.price * m)}</span>`).join('')}</div><small class="muted">같은 색 도시를 모두 가지면 통행료 2배</small>`;
    } else if (b.type === 'spot') html += ` <small>관광지 · ${b.price}만원 · 통행료 ${Math.round(b.price * 0.6)}만 (건물 못 지음)</small>`;
    else html += ` <small>${{ key: '카드를 한 장 뽑아요', tax: '현금의 10%를 사회복지기금에 내요', start: '지나갈 때마다 월급', island: '3턴 쉬기, 더블이 나오면 탈출', fund: '쌓인 기금을 모두 받아요', travel: '다음 턴에 원하는 칸으로 이동' }[b.type] || ''}</small>`;
    $('#mb-info').innerHTML = html;
  },
  side(v) {
    $('#mb-side').innerHTML = v.players.map(p => {
      const changed = this.money[p.id] != null && this.money[p.id] !== p.money ? (p.money > this.money[p.id] ? 'up' : 'down') : '';
      const props = v.owner.filter(o => o === p.id).length;
      return `<div class="mb-p ${p.id === v.turnId ? 'turn' : ''} ${p.out ? 'out' : ''}" style="--pc:${p.color}">
        <div class="mb-p-top"><i class="pawn"></i><b>${esc(p.name)}${p.id === this.ctx.me ? ' (나)' : ''}</b>${p.island ? '<em>무인도</em>' : ''}${p.travel ? '<em>여행</em>' : ''}${p.out ? '<em>파산</em>' : ''}</div>
        <div class="mb-money ${changed}">${Pieces.money(p.money)}<small>만원</small></div>
        <div class="mb-p-sub">땅 ${props}곳 · 총자산 ${Pieces.money(p.worth)}만${p.items.waiver ? ' · 우대권' : ''}${p.items.half ? ' · 반값쿠폰' : ''}${p.items.escape ? ' · 탈출권' : ''}</div></div>`;
    }).join('');
    v.players.forEach(p => { this.money[p.id] = p.money; });
  },
  /** 말: 실제 위치까지 한 칸씩 걸어감 (먼 이동은 순간이동) */
  tokens(v) {
    const board = $('#mb-board');
    v.players.forEach((p, k) => {
      let tk = board.querySelector(`.mb-token[data-id="${p.id}"]`);
      if (!tk) { tk = document.createElement('div'); tk.className = 'mb-token'; tk.dataset.id = p.id; tk.style.setProperty('--pc', p.color); board.append(tk); this.disp[p.id] = p.pos; this.place(tk, p.pos, k); }
      tk.classList.toggle('out', p.out);
      if (this.disp[p.id] === p.pos || tk.dataset.walking) return;
      const N = MarbleCore.BOARD.length, fwd = (p.pos - this.disp[p.id] + N) % N;
      if (fwd > 12 && N - fwd > 3) { this.disp[p.id] = p.pos; this.place(tk, p.pos, k); return; }
      const dir = fwd <= 12 ? 1 : -1;
      tk.dataset.walking = '1';
      const step = () => {
        this.disp[p.id] = (this.disp[p.id] + dir + N) % N; this.place(tk, this.disp[p.id], k);
        const target = this.v.players.find(q => q.id === p.id).pos;
        if (this.disp[p.id] !== target) after(120, step); else { delete tk.dataset.walking; }
      };
      step();
    });
  },
  place(tk, i, k) {
    const cell = $(`#mb-board [data-i="${i}"]`);
    if (!cell) return;
    const ox = (k % 2) * 16 - 8, oy = Math.floor(k / 2) * 16 - 8;
    tk.style.left = (cell.offsetLeft + cell.offsetWidth / 2 + ox - 11) + 'px';
    tk.style.top = (cell.offsetTop + cell.offsetHeight / 2 + oy - 11) + 'px';
  },
};
$('#mb-board').addEventListener('click', e => {
  const cell = e.target.closest('.mb-cell'); if (!cell || !Marble.v) return;
  const i = +cell.dataset.i, v = Marble.v;
  if (v.phase === 'travel' && v.turnId === Marble.ctx.me && i !== 24) return Marble.ctx.send({ t: 'travel', to: i });
  Marble.info(i);
});
window.addEventListener('resize', () => { if (isScreen('marble') && Marble.v) Marble.v.players.forEach((p, k) => { const tk = $(`.mb-token[data-id="${p.id}"]`); if (tk) Marble.place(tk, Marble.disp[p.id], k); }); });
Object.assign(ACT, {
  mbDo: el => Marble.ctx && Marble.ctx.send({ t: el.dataset.t, lvl: el.dataset.lvl != null ? +el.dataset.lvl : undefined }),
  mbSolo: el => {
    const so = Marble.soloOpts = Object.assign({ bots: 2, rounds: 20 }, Marble.soloOpts, el.dataset.bots ? { bots: +el.dataset.bots } : {}, el.dataset.rounds ? { rounds: +el.dataset.rounds } : {});
    Table.solo('marble', { bots: so.bots, opts: { rounds: so.rounds } });
    $$('#mb-solo .seg-btn').forEach(b => b.classList.toggle('on', +(b.dataset.bots || -1) === so.bots || +(b.dataset.rounds || -1) === so.rounds));
  },
});
Table.def('marble', {
  core: MarbleCore, render: (v, ctx, prev) => Marble.render(v, ctx, prev), solo: { bots: 2, opts: { rounds: 20 } },
  key: (e, ctx) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && ctx.view.turnId === ctx.me && ctx.view.phase === 'roll') ctx.send({ t: 'roll' }); },
});
