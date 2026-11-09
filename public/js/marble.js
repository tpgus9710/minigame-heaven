/* =====================================================================
 *  🌍 세계여행 보드게임 화면 (규칙: shared/marble-core.js)
 *  v12.6 리마스터
 *   · 일어난 일을 한 장면씩: 주사위 → 말이 한 칸씩 → 통행료 · 황금열쇠 · 구입 … (규칙이 남긴 기록 log 를 차례로 연출,
 *     장면마다 시간은 MarbleCore.PACE — 봇도 연출이 끝날 때까지 기다려요). 다 보여 준 뒤에 내 차례 버튼이 나와요.
 *   · 내 황금열쇠는 큰 카드로 (눌러서 설명) · 통행료 낼 때 우대권 · 반값 쿠폰을 쓸지 직접 골라요
 *   · 인수(모두의 마블 규칙): 남의 도시에 통행료를 낸 뒤 돈이 넉넉하면 (땅값 + 건물값) × 2 에 사요
 * ===================================================================== */
makeScreen('marble', {
  title: '🌍 세계여행 보드게임', status: '도시를 사고 건물을 지어 통행료를 받아요. 돈이 넉넉하면 남의 도시도 인수!',
  stats: [['round', '라운드'], ['fund', '복지기금'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="mb-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="mbSolo" data-bots="1">1명</button><button class="seg-btn on" data-act="mbSolo" data-bots="2">2명</button><button class="seg-btn" data-act="mbSolo" data-bots="3">3명</button>
      <span class="muted small" style="margin-left:10px">라운드</span>
      <button class="seg-btn" data-act="mbSolo" data-rounds="10">10</button><button class="seg-btn on" data-act="mbSolo" data-rounds="20">20</button><button class="seg-btn" data-act="mbSolo" data-rounds="30">30</button></div>
    <div class="mb-wrap"><div class="mb-board" id="mb-board"></div>
      <div class="mb-side" id="mb-side"><div class="mb-players" id="mb-players"></div><div class="mb-keys" id="mb-keys"></div>
        <div class="mb-log" id="mb-log"><h4>📜 지난 일</h4><ol id="mb-log-list"></ol></div></div></div>`,
});

const MB = MarbleCore;
const MB_CORNER = { start: ['출발', `월급 +${MB.SALARY}만`], island: ['무인도', '3턴 쉬기'], fund: ['복지기금', '<span id="mb-fund">0</span>만'], travel: ['세계여행', '원하는 곳으로'] };
const MB_SHORT = { waiver: '통행료 1번 면제', half: '통행료 1번 반값', escape: '무인도 바로 탈출', shield: '인수 1번 막기' };
const MB_LV_IC = ['', '🏠', '🏢', '🏨', '🏰'];
const MB_PAWN = '<svg viewBox="0 0 24 32" aria-hidden="true"><ellipse cx="12" cy="29.6" rx="8.6" ry="2.2" fill="rgba(0,0,0,.32)"/>'
  + '<path d="M5 28h14l-1.6-3.2C16 22 15 18.5 14.6 14.5h1.4a1.3 1.3 0 0 0 0-2.6h-.9A5.2 5.2 0 1 0 8.9 11.9H8a1.3 1.3 0 0 0 0 2.6h1.4C9 18.5 8 22 6.6 24.8z" fill="var(--pc)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>'
  + '<circle cx="10.1" cy="6.1" r="1.5" fill="#fff" opacity=".55"/></svg>';
const mbWon = n => Pieces.money(n) + '만';
if (typeof Sound !== 'undefined') Object.assign(Sound.NOTES, {
  mbCoin: [[1319, 0, 0.05], [1760, 0.06, 0.12]],
  mbKey: [[784, 0, 0.07], [988, 0.08, 0.07], [1319, 0.16, 0.26]],
  mbBuy: [[523, 0, 0.06], [784, 0.07, 0.12]],
  mbTko: [[392, 0, 0.08], [523, 0.09, 0.08], [784, 0.18, 0.22]],
});

const Marble = {
  q: [], busy: false, lastN: 0, d: null, feed: [], tm: [], turnShown: null,
  /** 칸 번호 → 9×9 판의 (행, 열) */
  cellRC(i) {
    if (i <= 8) return [8, 8 - i];
    if (i <= 16) return [16 - i, 0];
    if (i <= 24) return [0, i - 16];
    return [i - 24, 8];
  },
  /** 이 화면에서만 쓰는 타이머 (다른 화면으로 가면 저절로 멈춰요) */
  later(fn, ms) { const t = setTimeout(() => { this.tm = this.tm.filter(x => x !== t); if (isScreen('marble')) fn(); }, ms); this.tm.push(t); return t; },
  clearTimers() { this.tm.forEach(t => clearTimeout(t)); this.tm = []; clearTimeout(this.tq); },
  pl(id) { return (this.v && this.v.players.find(p => p.id === id)) || { name: '?', color: '#94a3b8', id }; },
  isMe(id) { return !!this.ctx && id === this.ctx.me; },

  build() {
    const B = MB.BOARD, board = $('#mb-board');
    board.innerHTML = B.map((b, i) => {
      const [r, c] = this.cellRC(i), corner = i % 8 === 0;
      const side = i < 8 ? 'b' : i < 16 ? 'l' : i < 24 ? 't' : 'r';
      let inner;
      if (b.type === 'city' || b.type === 'spot') {
        const nm = b.name === '부에노스아이레스' ? '부에노스<br>아이레스' : b.name;
        inner = `<span class="band${b.type === 'spot' ? ' spot' : ''}"></span><span class="bld" id="mb-bld-${i}"></span><span class="ic">${b.ic}</span><b class="nm${b.name.length > 5 ? ' long' : ''}">${nm}</b><span class="pr" id="mb-pr-${i}">${b.price}만</span>`;
      } else if (b.type === 'key') inner = `<span class="ic big">🔑</span><b class="nm">황금열쇠</b>`;
      else if (b.type === 'tax') inner = `<span class="ic big">🧾</span><b class="nm">국세청</b><span class="pr">현금 10%</span>`;
      else inner = `<span class="ic big">${b.ic}</span><b class="corner-t">${MB_CORNER[b.type][0]}</b><small>${MB_CORNER[b.type][1]}</small>`;
      return `<div class="mb-cell ${b.type}${corner ? ' corner' : ''} side-${side}" data-i="${i}" style="grid-row:${r + 1};grid-column:${c + 1}${b.group ? `;--g:${MB.GROUPS[b.group]}` : ''}">${inner}</div>`;
    }).join('') + `<div class="mb-center" id="mb-center" data-mode="wait">
        <div class="mb-turn" id="mb-turn"></div>
        <div class="mb-dice" id="mb-dice"></div>
        <div class="mb-msg" id="mb-msg"></div>
        <div class="mb-panel" id="mb-panel"></div>
        <div class="mb-feed" id="mb-feed"></div>
        <div class="mb-info hidden" id="mb-info"></div>
        <div class="mb-pop hidden" id="mb-pop"></div></div>`;
    this.cells = B.map((b, i) => board.querySelector(`[data-i="${i}"]`));
    this.prs = B.map((b, i) => $(`#mb-pr-${i}`));
    this.blds = B.map((b, i) => $(`#mb-bld-${i}`));
    this.tokens = {};
  },
  /** 새 판: 화면에 보이는 상태(d)를 지금 상태로 · 지난 기록은 연출하지 않고 '지난 일'에만 */
  reset(v) {
    this.clearTimers();
    this.q = []; this.busy = false; this.turnShown = null; this.infoAt = null;
    this.lastN = v.seq || 0;
    this.d = { owner: v.owner.slice(), level: v.level.slice(), fund: v.fund, money: {}, items: {}, pos: {}, out: {}, dice: v.dice.slice() };
    v.players.forEach(p => { this.d.money[p.id] = p.money; this.d.items[p.id] = { ...p.items }; this.d.pos[p.id] = p.pos; this.d.out[p.id] = p.out; });
    this.feed = [];
    for (const e of v.log || []) this.addFeed(e, true);
    this.buildPlayers(v);
    $('#mb-dice').innerHTML = Pieces.die(v.dice[0]) + Pieces.die(v.dice[1]);
  },
  render(v, ctx, prev) {
    const fresh = !prev || !$('#mb-board .mb-center') || !this.d;
    this.v = v; this.ctx = ctx;
    if (fresh) { this.build(); this.reset(v); }
    $('#mb-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    setStat('marble', 'round', `${v.round} / ${v.maxRounds}`);
    const evs = (v.log || []).filter(e => e.n > this.lastN);
    if (evs.length) {
      if (evs[0].n > this.lastN + 1 && !fresh) { this.q = []; this.lastN = evs[evs.length - 1].n; evs.forEach(e => this.addFeed(e, true)); this.busy = false; this.sync(); return; }
      this.q.push(...evs); this.lastN = evs[evs.length - 1].n;
    }
    if (fresh) { this.sync(); this.fitSoon(); }
    if (!this.busy) this.next();
  },

  /* ─────────── 한 장면씩 보여 주기 ─────────── */
  next() {
    clearTimeout(this.tq);
    if (!isScreen('marble') || !this.v) { this.q = []; this.busy = false; return; }
    if (document.hidden || this.q.length > 14) while (this.q.length > 1) this.apply(this.q.shift(), false);   // 안 보이는 동안 쌓인 건 바로
    const e = this.q.shift();
    if (!e) { this.busy = false; this.sync(); return; }
    this.busy = true;
    let ms = 0;
    try { ms = this.apply(e, !document.hidden); } catch (err) { console.error(err); }
    const k = this.q.length >= 7 ? 0.45 : this.q.length >= 4 ? 0.7 : 1;                         // 많이 밀렸으면 조금 빠르게
    this.tq = setTimeout(() => this.next(), Math.round(ms * k));
  },
  /** 기록 하나를 화면 상태에 반영하고 (anim 이면) 연출 → 걸리는 시간(ms) */
  apply(e, anim) {
    const d = this.d, v = this.v;
    if (e.m) v.players.forEach((p, k) => { if (e.m[k] != null) d.money[p.id] = e.m[k]; });
    if (e.f != null) d.fund = e.f;
    if (e.o) for (const [i, o, l] of e.o) { d.owner[i] = o; d.level[i] = l; }
    if (e.it) d.items[e.t === 'shield' ? e.owner : e.id] = { ...e.it };
    if (e.t === 'bankrupt') { d.out[e.id] = true; d.items[e.id] = {}; }
    if (e.t === 'roll') d.dice = e.dice.slice();
    this.addFeed(e);
    if (!anim) { if (e.t === 'move') d.pos[e.id] = e.to; return 0; }
    this.setTurn(e.id);
    const t = this.txt(e);
    if (t) $('#mb-msg').innerHTML = t;
    this.panelBusy();
    const P = MB.PACE, me = this.isMe(e.id), card = id => $(`#mb-players [data-id="${CSS.escape(String(id))}"]`);
    switch (e.t) {
      case 'roll': this.rollDice(e.dice); return P.roll;
      case 'move': this.animMove(e); return MB.evMs(e);
      case 'salary': this.paintPlayers(); this.float(card(e.id), `+${mbWon(e.amt)}`, 'up'); this.float(this.cells[0], '월급', 'info'); return P.salary;
      case 'toll': {
        this.hit(e.pos);
        if (e.amt) { this.float(card(e.id), `-${mbWon(e.amt)}`, 'down'); this.float(card(e.to), `+${mbWon(e.amt)}`, 'up'); Sound.play('mbCoin'); }
        this.paintPlayers(); return P.toll;
      }
      case 'use': this.banner(`${MB.ITEMS[e.item].ic} ${MB.ITEMS[e.item].name} 사용!`, this.pl(e.id).color, P.use - 250); this.paintPlayers(); this.paintKeys(); return P.use;
      case 'key': this.showKey(e); return P.key;
      case 'cash': case 'gift': this.paintPlayers(); if (e.amt) this.float(card(e.id), `${e.amt > 0 ? '+' : '-'}${mbWon(Math.abs(e.amt))}`, e.amt > 0 ? 'up' : 'down'); if (e.amt < 0) this.paintFund(true); return P[e.t];
      case 'got': this.flyItem(e.item, me ? $('#mb-keys') : card(e.id)); this.later(() => { this.paintPlayers(); this.paintKeys(e.item); }, 520); return P.got;
      case 'buy': case 'build':
        this.paintCell(e.pos, 'pop'); this.paintPlayers(); this.float(card(e.id), `-${mbWon(e.cost)}`, 'down'); Sound.play('mbBuy');
        return P[e.t];
      case 'takeover':
        this.cells[e.pos].classList.remove('flip'); void this.cells[e.pos].offsetWidth; this.cells[e.pos].classList.add('flip');
        this.later(() => this.paintCell(e.pos), 300);
        this.banner('🤝 인수!', this.pl(e.id).color, P.takeover - 300);
        this.float(card(e.id), `-${mbWon(e.cost)}`, 'down'); this.float(card(e.from), `+${mbWon(e.cost)}`, 'up');
        this.paintPlayers(); Sound.play('mbTko'); return P.takeover;
      case 'shield':
        this.cells[e.pos].classList.remove('guard'); void this.cells[e.pos].offsetWidth; this.cells[e.pos].classList.add('guard');
        this.banner('🛡️ 인수 방어!', this.pl(e.owner).color, P.shield - 300); this.paintPlayers(); this.paintKeys(); Sound.play('pop'); return P.shield;
      case 'pass': return P.pass;
      case 'sell': this.paintCells(); this.paintPlayers(); if (e.amt) this.float(card(e.id), `+${mbWon(e.amt)}`, 'up'); Sound.play('bad'); return P.sell;
      case 'bankrupt':
        this.paintCells(); this.paintPlayers(); this.paintKeys(); this.layoutTokens();
        this.banner(`💸 ${esc(this.pl(e.id).name)} 파산`, this.pl(e.id).color, P.bankrupt - 300); Sound.play('bad'); return P.bankrupt;
      case 'fund': this.paintPlayers(); this.paintFund(); if (e.amt) { this.float(card(e.id), `+${mbWon(e.amt)}`, 'up'); Sound.play('mbCoin'); } this.hit(16); return P.fund;
      case 'tax': this.paintPlayers(); this.paintFund(true); this.float(card(e.id), `-${mbWon(e.amt)}`, 'down'); this.hit(30); return P.tax;
      case 'island': this.hit(MB.ISLAND); return P.island;
      case 'stay': return P.stay;
      case 'escape': this.paintPlayers(); if (e.how === 'pay') this.paintFund(true); return P.escape;
    }
    return 0;
  },
  /** 다 보여 줬어요 → 최신 상태로 맞추고 내 차례면 버튼 */
  sync() {
    const v = this.v, d = this.d;
    if (!v || !d) return;
    d.owner = v.owner.slice(); d.level = v.level.slice(); d.fund = v.fund; d.dice = v.dice.slice();
    v.players.forEach(p => { d.money[p.id] = p.money; d.items[p.id] = { ...p.items }; d.out[p.id] = p.out; d.pos[p.id] = p.pos; });
    this.paintCells(); this.paintPlayers(); this.paintKeys(); this.paintFund();
    this.layoutTokens();
    const myTurnNow = this.turnShown !== v.turnId && this.isMe(v.turnId);
    this.setTurn(v.turnId, true);
    // 남의 차례엔 '○○ 님이 고민 중' 줄이 대신 알려 줘요 (더블 · 무인도 같은 소식만 남겨요)
    const showMsg = this.isMe(v.turnId) || v.over || (v.phase === 'roll' && /더블|무인도|탈출/.test(v.msg || ''));
    $('#mb-msg').innerHTML = showMsg ? esc(v.msg || '') : '';
    this.panel();
    this.paintFeed();
    // 칸 정보를 보던 중: 내 차례가 새로 오면 닫고(버튼이 가려지지 않게), 아니면 내용만 새로
    if (this.infoAt != null) { if (myTurnNow || (this.isMe(v.turnId) && /^(buy|build|toll|takeover)$/.test(v.phase))) this.hideInfo(); else this.info(this.infoAt, this.canGo(this.infoAt)); }
  },
  /** 세계여행: 내가 지금 이 칸으로 날아갈 수 있나요? */
  canGo(i) { const v = this.v; return !this.busy && !!v && v.phase === 'travel' && v.turnId === this.ctx.me && i !== MB.TRAVEL; },

  /* ─────────── 판 · 참가자 · 황금열쇠 그리기 ─────────── */
  /** 지금 화면 상태로 본 통행료 (규칙과 같은 계산) */
  tollAt(i) {
    const b = MB.BOARD[i], d = this.d;
    if (b.type === 'spot') return Math.round(b.price * 0.6);
    const all = MB.BOARD.every((c, j) => c.group !== b.group || d.owner[j] === d.owner[i]);
    return Math.round(b.price * MB.TOLL[d.level[i]] * (all ? 2 : 1));
  },
  assetAt(i) { const b = MB.BOARD[i]; let v = b.price; for (let l = 1; l <= this.d.level[i]; l++) v += MB.buildCost(i, l); return v; },
  paintCell(i, fx) {
    const b = MB.BOARD[i];
    if (b.type !== 'city' && b.type !== 'spot') return;
    const d = this.d, cell = this.cells[i], o = d.owner[i] ? this.pl(d.owner[i]) : null, lv = o ? d.level[i] : 0;
    cell.classList.toggle('owned', !!o);
    cell.style.setProperty('--own', o ? o.color : 'transparent');
    this.prs[i].textContent = o ? mbWon(this.tollAt(i)) : `${b.price}만`;
    this.blds[i].textContent = MB_LV_IC[lv] || '';
    if (fx) { cell.classList.remove(fx); void cell.offsetWidth; cell.classList.add(fx); }
  },
  paintCells() { MB.BOARD.forEach((b, i) => this.paintCell(i)); },
  hit(i) { const c = this.cells[i]; if (!c) return; c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); },
  paintFund(pulse) {
    const f = $('#mb-fund'); if (f) f.textContent = Pieces.money(this.d.fund);
    setStat('marble', 'fund', mbWon(this.d.fund));
    if (pulse) this.hit(16);
  },
  buildPlayers(v) {
    const box = $('#mb-players');
    box.style.setProperty('--np', v.players.length);
    box.innerHTML = v.players.map(p => `<div class="mb-p${this.isMe(p.id) ? ' me' : ''}" data-id="${esc(p.id)}" style="--pc:${p.color}">
        <div class="mb-p-top"><span class="pawn">${MB_PAWN}</span><b>${esc(p.name)}</b>${this.isMe(p.id) ? '<em class="me">나</em>' : ''}<em class="mb-st"></em></div>
        <div class="mb-money"><span>${Pieces.money(p.money)}</span><small>만원</small></div>
        <div class="mb-p-sub"></div><div class="mb-p-items"></div></div>`).join('');
    this.shown = {};
    v.players.forEach(p => { this.shown[p.id] = p.money; });
  },
  paintPlayers() {
    const v = this.v, d = this.d;
    v.players.forEach(p => {
      const el = $(`#mb-players [data-id="${CSS.escape(p.id)}"]`); if (!el) return;
      el.classList.toggle('turn', p.id === (this.busy ? this.turnShown : v.turnId) && !v.over);
      el.classList.toggle('out', !!d.out[p.id]);
      const lands = d.owner.filter(o => o === p.id).length;
      const worth = (d.money[p.id] || 0) + d.owner.reduce((a, o, i) => a + (o === p.id ? this.assetAt(i) : 0), 0);
      el.querySelector('.mb-p-sub').textContent = d.out[p.id] ? '파산했어요' : `땅 ${lands}곳 · 자산 ${mbWon(worth)}`;
      const st = d.out[p.id] ? '파산' : p.island && !this.busy ? '무인도' : p.travel && !this.busy ? '여행' : '';
      const em = el.querySelector('.mb-st'); em.textContent = st; em.classList.toggle('hidden', !st);
      const it = d.items[p.id] || {};
      el.querySelector('.mb-p-items').innerHTML = MB.ITEM_KEYS.filter(k => it[k] > 0).map(k => `<span title="${MB.ITEMS[k].name}">${MB.ITEMS[k].ic}${it[k] > 1 ? `<sub>${it[k]}</sub>` : ''}</span>`).join('');
      this.tweenMoney(el, p.id, d.money[p.id] || 0);
    });
  },
  /** 돈 숫자가 바뀌면 0.6초 동안 세어 올라가거나 내려가요 */
  tweenMoney(el, id, to) {
    const span = el.querySelector('.mb-money span'), box = el.querySelector('.mb-money'), from = this.shown[id];
    if (from === to) return;
    this.shown[id] = to;
    box.classList.remove('up', 'down'); void box.offsetWidth; box.classList.add(to > from ? 'up' : 'down');
    const t0 = performance.now(), dur = 600;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      span.textContent = Pieces.money(from + (to - from) * e);
      if (k < 1 && this.shown[id] === to) requestAnimationFrame(step); else if (this.shown[id] === to) span.textContent = Pieces.money(to);
    };
    requestAnimationFrame(step);
  },
  /** 내 황금열쇠: 큰 카드 (누르면 설명) */
  paintKeys(fresh) {
    const box = $('#mb-keys'), it = this.d.items[this.ctx.me];
    if (!it || !this.v.players.some(p => p.id === this.ctx.me)) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const have = MB.ITEM_KEYS.filter(k => it[k] > 0);
    box.innerHTML = `<div class="mb-keys-h">🔑 내 황금열쇠${have.length ? ' <small>카드를 누르면 설명</small>' : ''}</div>` + (have.length
      ? `<div class="mb-kgrid">${have.map(k => `<button class="mb-kc${k === fresh ? ' new' : ''}" data-act="mbKey" data-item="${k}"><span class="ic">${MB.ITEMS[k].ic}</span><b>${MB.ITEMS[k].name}</b><small>${MB_SHORT[k]}</small>${it[k] > 1 ? `<em>×${it[k]}</em>` : ''}</button>`).join('')}</div>`
      : `<div class="mb-kempty">아직 없어요 · 🔑 황금열쇠 칸에서 우대권 · 반값 쿠폰 · 탈출권${this.v.takeover ? ' · 인수 방어권' : ''}을 뽑을 수 있어요</div>`);
  },

  /* ─────────── 말 ─────────── */
  token(id) {
    let tk = this.tokens[id];
    if (!tk) {
      tk = document.createElement('div'); tk.className = 'mb-token'; tk.dataset.id = id;
      tk.style.setProperty('--pc', this.pl(id).color); tk.innerHTML = MB_PAWN;
      $('#mb-board').append(tk); this.tokens[id] = tk;
    }
    return tk;
  },
  /** 말 크기: 칸 너비의 절반쯤 */
  tkSize() {
    const c = this.cells && this.cells[1]; if (!c) return 20;
    const s = Math.round(Math.max(15, Math.min(34, c.offsetWidth * 0.5)));
    $('#mb-board').style.setProperty('--tk', s + 'px');
    return s;
  },
  placeAt(tk, i, ox, oy) {
    const cell = this.cells[i]; if (!cell) return;
    const s = this.tkSize(), h = s * 1.33;
    tk.style.left = Math.round(cell.offsetLeft + cell.offsetWidth / 2 + ox * cell.offsetWidth - s / 2) + 'px';
    tk.style.top = Math.round(cell.offsetTop + cell.offsetHeight / 2 + oy * cell.offsetHeight - h * 0.62) + 'px';
  },
  /** 모든 말을 화면 상태 자리에 (한 칸에 여럿이면 나눠 서요) */
  layoutTokens() {
    if (!this.v || !this.d) return;
    const OFF = { 1: [[0, 0]], 2: [[-0.22, 0], [0.22, 0]], 3: [[-0.22, -0.14], [0.22, -0.14], [0, 0.16]], 4: [[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.15], [0.22, 0.15]] };
    const at = {};
    this.v.players.forEach(p => { if (!this.d.out[p.id]) (at[this.d.pos[p.id]] = at[this.d.pos[p.id]] || []).push(p.id); });
    this.v.players.forEach(p => {
      const tk = this.token(p.id);
      tk.classList.toggle('out', !!this.d.out[p.id]);
      tk.classList.toggle('cur', p.id === (this.busy ? this.turnShown : this.v.turnId) && !this.v.over);
      if (this.d.out[p.id] || tk.classList.contains('walk') || tk.classList.contains('fly')) return;
      const list = at[this.d.pos[p.id]] || [p.id], [ox, oy] = OFF[Math.min(4, list.length)][list.indexOf(p.id)] || [0, 0];
      this.placeAt(tk, this.d.pos[p.id], ox, oy);
    });
  },
  animMove(e) {
    const tk = this.token(e.id), k = MB.walkSteps(e), N = MB.BOARD.length, P = MB.PACE;
    tk.classList.add('cur');
    if (!k) {                                                            // 날아가기 · 순간이동
      const cls = e.how === 'warp' ? 'warp' : 'fly';
      tk.classList.remove('walk', 'hop'); tk.classList.add(cls);
      this.d.pos[e.id] = e.to;
      if (cls === 'fly') Sound.blip(440, 0.3, 0.25);
      requestAnimationFrame(() => this.placeAt(tk, e.to, 0, 0));
      this.later(() => { tk.classList.remove(cls); this.layoutTokens(); }, P.fly - 80);
      return;
    }
    const dir = e.steps > 0 ? 1 : -1;
    let at = e.from, left = k;
    tk.classList.add('walk');
    const step = () => {
      at = (at + dir + N) % N; this.d.pos[e.id] = at;
      this.placeAt(tk, at, 0, 0);
      tk.classList.remove('hop'); void tk.offsetWidth; tk.classList.add('hop');
      Sound.blip(at === 0 ? 880 : 600 + (k - left) * 12, 0.03, 0.28);
      if (--left > 0) this.later(step, P.step);
      else this.later(() => { tk.classList.remove('walk', 'hop'); this.layoutTokens(); }, P.walkEnd - 40);
    };
    step();
  },

  /* ─────────── 가운데: 차례 · 주사위 · 메시지 · 버튼 ─────────── */
  setTurn(id, settled) {
    const p = this.pl(id), el = $('#mb-turn'), me = this.isMe(id), changed = this.turnShown !== id;
    this.turnShown = id;
    el.style.setProperty('--pc', p.color);
    el.classList.toggle('me', me);
    el.innerHTML = `<i></i><b>${me ? '내 차례' : esc(p.name)}</b>${me ? '' : '<span>차례</span>'}`;
    if (changed) {
      el.classList.remove('new'); void el.offsetWidth; el.classList.add('new');
      this.paintPlayers(); this.layoutTokens();
      if (settled && me && this.ctx.mode === 'solo' && !this.v.over) Sound.play('turn');
    }
  },
  rollDice(dice) {
    const el = $('#mb-dice');
    el.classList.remove('land'); el.classList.add('tumble');
    let n = 0;
    const spin = () => {
      el.innerHTML = Pieces.die(1 + rand(6)) + Pieces.die(1 + rand(6));
      Sound.blip(200 + Math.random() * 170, 0.02, 0.4);
      if (++n < 9) this.later(spin, 85);
      else { el.classList.remove('tumble'); el.innerHTML = Pieces.die(dice[0]) + Pieces.die(dice[1]); el.classList.add('land'); }
    };
    spin();
  },
  /** 연출 중: 버튼 대신 조용히 */
  panelBusy() {
    const c = $('#mb-center');
    if (c.dataset.mode !== 'busy') { c.dataset.mode = 'busy'; $('#mb-panel').innerHTML = ''; }
    $$('#mb-board .mb-cell.pick').forEach(x => x.classList.remove('pick'));
  },
  /** 내 차례면 고를 것 · 아니면 '○○ 님이 고민 중' */
  panel() {
    const v = this.v, me = v.players.find(p => p.id === this.ctx.me), el = $('#mb-panel'), center = $('#mb-center');
    const mine = !!me && v.turnId === me.id && !v.over && !me.out;
    center.dataset.mode = v.over ? 'over' : mine ? v.phase : 'wait';
    $$('#mb-board .mb-cell').forEach(c => c.classList.toggle('pick', mine && v.phase === 'travel' && +c.dataset.i !== MB.TRAVEL));
    if (v.over) { el.innerHTML = ''; return; }
    const B = MB.BOARD, dc = v.decision;
    if (!mine) {
      const t = this.pl(v.turnId), nm = esc(t.name), city = dc ? B[dc.pos].name : '';
      const what = { roll: '주사위를 굴리려고 해요', buy: `<b>${city}</b>${MB.josa(city, '을', '를').slice(city.length)} 살지 고민 중`, build: `<b>${city}</b>에 건물을 지을지 고민 중`,
        toll: '황금열쇠를 쓸지 고민 중', takeover: `<b>${city}</b>${MB.josa(city, '을', '를').slice(city.length)} 인수할지 고민 중`, travel: '어디로 날아갈지 고르는 중' }[v.phase] || '생각 중';
      const scary = v.phase === 'takeover' && dc && this.isMe(dc.owner) ? ' scary' : '';
      el.innerHTML = `<div class="mb-wait${scary}"><span>${scary ? '😱 ' : '🤔 '}${nm} 님이 ${what}</span><span class="dots"><i></i><i></i><i></i></span></div>`;
      return;
    }
    const L = MB.LEVELS;
    if (v.phase === 'roll') {
      el.innerHTML = me.island
        ? `<div class="mb-row"><button class="btn good" data-act="mbDo" data-t="roll">🎲 주사위 <small>더블이면 탈출</small></button>
           <button class="btn ghost" data-act="mbDo" data-t="escape" ${!me.items.escape && me.money < 100 ? 'disabled' : ''}>${me.items.escape ? '🚤 탈출권 쓰기' : '💵 100만 내고 탈출'}</button></div>`
        : `<button class="btn good mb-roll" data-act="mbDo" data-t="roll">🎲 주사위 굴리기</button>`;
      return;
    }
    if (v.phase === 'travel') { el.innerHTML = '<div class="mb-hint">✈️ 판에서 가고 싶은 칸을 누르세요</div>'; return; }
    if (!dc) { el.innerHTML = ''; return; }
    const b = B[dc.pos], head = (title, right) => `<div class="mb-deal-h"><span class="ic">${b.ic}</span><b>${title}</b>${right ? `<small>${right}</small>` : ''}</div>`;
    if (v.phase === 'buy' || v.phase === 'build') {
      const base = v.phase === 'build' ? v.level[dc.pos] : -1;
      const label = o => (v.phase === 'buy' ? (o.lvl ? `땅+${L.slice(1, o.lvl + 1).join('+')}` : '땅만') : `${MB_LV_IC[o.lvl]} ${L[o.lvl]}까지`);
      const tollIf = o => (b.type === 'spot' ? Math.round(b.price * 0.6) : Math.round(b.price * MB.TOLL[o.lvl] * (this.groupAfter(dc.pos, me.id) ? 2 : 1)));
      el.innerHTML = `<div class="mb-deal" style="--g:${b.group ? MB.GROUPS[b.group] : '#14b8a6'}">
        ${head(v.phase === 'buy' ? `${b.name} 살까요?` : `${b.name}에 지을까요?`, v.phase === 'buy' ? `땅값 ${b.price}만` : `지금 ${L[v.level[dc.pos]]}`)}
        ${this.ladder(dc.pos, base)}
        <div class="mb-deal-x">${this.groupLine(dc.pos, me.id)}${dc.after === 'takeover' ? ' · 인수한 도시예요' : ''}</div>
        <div class="mb-opts">${dc.options.map(o => `<button class="btn good" data-act="mbDo" data-t="${v.phase}" data-lvl="${o.lvl}"><b>${label(o)} ${mbWon(o.cost)}</b><small>통행료 ${mbWon(tollIf(o))} · 남는 돈 ${Pieces.money(me.money - o.cost)}</small></button>`).join('')}
          <button class="btn ghost" data-act="mbDo" data-t="pass"><b>${v.phase === 'buy' ? '안 살래요' : '안 지을래요'}</b><small>내 돈 ${mbWon(me.money)}</small></button></div></div>`;
      return;
    }
    if (v.phase === 'toll') {
      const o = this.pl(dc.owner), half = Math.round(dc.toll / 2);
      el.innerHTML = `<div class="mb-deal toll" style="--g:${b.group ? MB.GROUPS[b.group] : '#14b8a6'}">
        ${head(`${b.name} 통행료`, `<span class="big">${mbWon(dc.toll)}</span>`)}
        <div class="mb-deal-x">${esc(o.name)} 님의 ${L[v.level[dc.pos]]} · 내 돈 ${mbWon(me.money)}</div>
        <div class="mb-opts">${me.items.waiver ? `<button class="btn key" data-act="mbDo" data-t="pay" data-use="waiver"><b>🎫 우대권 쓰기</b><small>0원 · ${mbWon(dc.toll)} 아껴요</small></button>` : ''}
          ${me.items.half ? `<button class="btn key" data-act="mbDo" data-t="pay" data-use="half"><b>🏷️ 반값 쿠폰 쓰기</b><small>${mbWon(half)} 내요</small></button>` : ''}
          <button class="btn ghost" data-act="mbDo" data-t="pay" data-use=""><b>그냥 내기 ${mbWon(dc.toll)}</b><small>황금열쇠는 아껴 둬요</small></button></div></div>`;
      return;
    }
    if (v.phase === 'takeover') {
      const o = this.pl(dc.owner), asset = Math.round(dc.cost / MB.TAKEOVER), lv = v.level[dc.pos];
      const after = Math.round(b.price * MB.TOLL[lv] * (this.groupAfter(dc.pos, me.id) ? 2 : 1));
      el.innerHTML = `<div class="mb-deal tko" style="--g:${MB.GROUPS[b.group]}">
        ${head(`${b.name} 인수할까요?`, `${esc(o.name)} 님의 ${L[lv]}`)}
        <div class="mb-deal-x">인수 값 <b>${mbWon(dc.cost)}</b> <span class="muted2">(땅+건물 ${mbWon(asset)} × ${MB.TAKEOVER} → ${esc(o.name)} 님에게)</span></div>
        <div class="mb-deal-x">이제 통행료 <b>${mbWon(after)}</b>을 내가 받아요 · 남는 돈 ${mbWon(me.money - dc.cost)}${this.groupAfter(dc.pos, me.id) ? ' · 같은 색 독점!' : ''}</div>
        ${dc.shield ? `<div class="mb-warn">🛡️ ${esc(o.name)} 님에게 인수 방어권이 있어요. 인수하려 하면 방어권만 없어지고 인수는 막혀요 (돈은 안 나가요).</div>` : ''}
        <div class="mb-opts"><button class="btn good" data-act="mbDo" data-t="takeover"><b>🤝 ${dc.shield ? '방어권 깨기' : `인수하기 ${mbWon(dc.cost)}`}</b><small>${dc.shield ? '다음엔 인수할 수 있어요' : '건물까지 그대로 내 것'}</small></button>
          <button class="btn ghost" data-act="mbDo" data-t="pass"><b>안 할래요</b><small>돈을 아껴 둬요</small></button></div></div>`;
    }
  },
  /** 단계별 통행료 줄 (지금 단계 강조) */
  ladder(i, cur) {
    const b = MB.BOARD[i];
    if (b.type === 'spot') return `<div class="mb-ladder"><span class="on">관광지 · 통행료 ${mbWon(b.price * 0.6)}</span><span>건물은 못 지어요</span></div>`;
    return `<div class="mb-ladder">${MB.TOLL.map((m, k) => `<span class="${k === cur ? 'on' : ''}">${MB_LV_IC[k] || '🟫'} ${Pieces.money(b.price * m)}</span>`).join('')}</div>`;
  },
  /** 이 도시까지 가지면 같은 색을 다 모으나요? */
  groupAfter(i, id) { const g = MB.BOARD[i].group; return !!g && MB.BOARD.every((b, j) => b.group !== g || j === i || this.d.owner[j] === id); },
  groupLine(i, id) {
    const b = MB.BOARD[i];
    if (!b.group) return '관광지는 같은 색이 없어요';
    const others = MB.BOARD.map((c, j) => (c.group === b.group && j !== i ? j : -1)).filter(j => j >= 0);
    const txt = others.map(j => { const o = this.d.owner[j]; return `${MB.BOARD[j].name} ${o ? (o === id ? '(내 땅)' : `(${esc(this.pl(o).name)})`) : '(빈 땅)'}`; }).join(' · ');
    return `같은 색: ${txt}${this.groupAfter(i, id) ? ' → <b>모두 모으면 통행료 2배!</b>' : ''}`;
  },
  /** '지난 일' 기록 문구 (말이 걷는 건 빼요) */
  txt(e) {
    const B = MB.BOARD, n = esc(this.pl(e.id).name), c = e.pos != null ? B[e.pos].name : '';
    switch (e.t) {
      case 'roll': return `🎲 ${n} 님 <b>${e.dice[0]} + ${e.dice[1]} = ${e.dice[0] + e.dice[1]}</b>${e.dice[0] === e.dice[1] ? ' · 더블!' : ''}`;
      case 'move': return e.how === 'fly' ? `✈️ ${n} 님 ${MB.josa(B[e.to].name, '으로')} 날아가요` : e.how === 'warp' ? `🌀 ${n} 님 ${MB.josa(B[e.to].name, '으로')}` : null;
      case 'salary': return `💵 ${n} 님 출발을 지나 월급 <b>+${mbWon(e.amt)}</b>`;
      case 'toll': return e.amt ? `💸 ${n} → ${esc(this.pl(e.to).name)} · ${c} 통행료 <b>${mbWon(e.amt)}</b>${e.item === 'half' ? ' (반값)' : ''}` : `🎫 ${n} 님 우대권으로 ${c} 통행료 면제`;
      case 'use': return `${MB.ITEMS[e.item].ic} ${n} 님 ${MB.ITEMS[e.item].name} 사용`;
      case 'key': return `🔑 ${n} 님 황금열쇠 「${MB.KEYS[e.k].name}」`;
      case 'cash': return `${e.amt >= 0 ? '💰' : '💸'} ${n} 님 ${e.amt >= 0 ? '+' : '-'}${mbWon(Math.abs(e.amt))}`;
      case 'gift': return `🎂 ${n} 님 생일 축하금 <b>+${mbWon(e.amt)}</b>`;
      case 'got': return `${MB.ITEMS[e.item].ic} ${n} 님 ${MB.ITEMS[e.item].name} 보관`;
      case 'buy': return `🏠 ${n} 님 ${c} 구입${e.lvl ? ` + ${MB.LEVELS.slice(1, e.lvl + 1).join('·')}` : ''} <b>${mbWon(e.cost)}</b>`;
      case 'build': return `🏗️ ${n} 님 ${c}에 ${MB.LEVELS[e.lvl]} <b>${mbWon(e.cost)}</b>`;
      case 'takeover': return `🤝 ${n} 님 ${c} 인수 <b>${mbWon(e.cost)}</b> → ${esc(this.pl(e.from).name)}`;
      case 'shield': return `🛡️ ${esc(this.pl(e.owner).name)} 님 인수 방어권으로 ${MB.josa(c, '을', '를')} 지켰어요`;
      case 'pass': return `🙅 ${n} 님 ${c} ${{ buy: '안 삼', build: '안 지음', takeover: '인수 안 함' }[e.what] || ''}`;
      case 'sell': return `🏚️ ${n} 님 돈이 모자라 땅 · 건물을 팔았어요 <b>+${mbWon(e.amt)}</b>`;
      case 'bankrupt': return `💥 ${n} 님 파산 (${esc(e.why || '')})`;
      case 'fund': return e.amt ? `💰 ${n} 님 사회복지기금 <b>+${mbWon(e.amt)}</b>` : `💰 ${n} 님 사회복지기금 (비어 있어요)`;
      case 'tax': return `🧾 ${n} 님 세금 <b>${mbWon(e.amt)}</b>`;
      case 'island': return `🏝️ ${n} 님 무인도에 갇혔어요`;
      case 'stay': return `🏝️ ${n} 님 탈출 실패 (남은 ${e.left}턴)`;
      case 'escape': return `🚤 ${n} 님 무인도 탈출${e.how === 'dice' ? ' (더블)' : e.how === 'time' ? ' (3턴 지남)' : ''}`;
    }
    return null;
  },
  addFeed(e, quiet) {
    const t = this.txt(e);
    if (!t) return;
    this.feed.push({ n: e.n, t, pc: this.pl(e.id).color, fresh: !quiet });
    if (this.feed.length > 40) this.feed.shift();
    if (!quiet) this.paintFeed();
  },
  paintFeed() {
    const list = $('#mb-log-list'); if (!list) return;
    const rows = this.feed.slice(-30).reverse();
    list.innerHTML = rows.map(f => `<li class="${f.fresh ? 'fresh' : ''}" style="--pc:${f.pc}"><i></i><span>${f.t}</span></li>`).join('') || '<li class="muted">아직 아무 일도 없어요</li>';
    this.feed.forEach(f => { f.fresh = false; });
    const mini = $('#mb-feed');
    if (mini) mini.innerHTML = this.feed.slice(-3, this.busy ? -1 : undefined).slice(-2).reverse().map(f => `<div>${f.t}</div>`).join('');
  },

  /* ─────────── 효과: 떠오르는 숫자 · 황금열쇠 카드 · 알림 ─────────── */
  float(el, text, cls) {
    if (!el || document.hidden) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const f = document.createElement('div');
    f.className = `mb-float ${cls}`; f.textContent = text;
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height * 0.45) + 'px';
    document.body.append(f);
    setTimeout(() => f.remove(), 1500);
  },
  showKey(e) {
    const k = MB.KEYS[e.k], p = this.pl(e.id), pop = $('#mb-pop');
    pop.className = 'mb-pop key';
    pop.innerHTML = `<div class="mb-kcard"><small>GOLDEN KEY</small><span class="kic">${k.ic}</span><b>${k.name}</b><p>${k.txt}</p><em><i style="background:${p.color}"></i>${this.isMe(e.id) ? '내가 뽑았어요' : `${esc(p.name)} 님이 뽑았어요`}</em></div>`;
    Sound.play('mbKey');
    clearTimeout(this.popT);
    this.popT = this.later(() => this.hidePop(), MB.PACE.key - 180);
  },
  banner(html, color, ms) {
    const pop = $('#mb-pop');
    pop.className = 'mb-pop ban';
    pop.innerHTML = `<div class="mb-banner" style="--pc:${color}">${html}</div>`;
    clearTimeout(this.popT);
    this.popT = this.later(() => this.hidePop(), Math.max(500, ms));
  },
  hidePop() { const pop = $('#mb-pop'); if (pop) { pop.classList.add('hidden'); pop.innerHTML = ''; } },
  /** 뽑은 황금열쇠가 보관함(내 황금열쇠 · 그 사람 카드)으로 날아가요 */
  flyItem(item, toEl) {
    const from = $('#mb-center'), ic = MB.ITEMS[item].ic;
    if (!from || !toEl || document.hidden) return;
    const a = from.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    if (!b.width) return;
    const f = document.createElement('div');
    f.className = 'mb-fly'; f.textContent = ic;
    f.style.left = (a.left + a.width / 2 - 20) + 'px'; f.style.top = (a.top + a.height / 2 - 20) + 'px';
    document.body.append(f);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      f.style.transform = `translate(${b.left + Math.min(b.width / 2, 60) - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(.7)`;
      f.style.opacity = '0.2';
    }));
    setTimeout(() => f.remove(), 800);
  },

  /* ─────────── 칸 정보 · 황금열쇠 설명 ─────────── */
  info(i, go) {
    const B = MB.BOARD, b = B[i], v = this.v, d = this.d, box = $('#mb-info');
    if (!b || !v) return;
    this.infoAt = i;
    $$('#mb-board .mb-cell.sel').forEach(c => c.classList.remove('sel'));
    this.cells[i].classList.add('sel');
    let body = '';
    if (b.type === 'city' || b.type === 'spot') {
      const o = d.owner[i] ? this.pl(d.owner[i]) : null, lv = o ? d.level[i] : -1;
      body += `<div class="row">${o ? `주인 <b style="color:${o.color}">${esc(o.name)}</b> · ${MB.LEVELS[lv]} · 통행료 <b>${mbWon(this.tollAt(i))}</b>` : `땅값 <b>${b.price}만</b> · 주인 없음`}</div>`;
      body += this.ladder(i, lv);
      if (b.type === 'city') {
        body += `<div class="row small">${this.groupLine(i, this.ctx.me)}</div>`;
        if (v.takeover) body += `<div class="row small">${!o ? '인수: 누가 사면 (땅값 + 건물값) × 2 에 인수할 수 있어요' : lv >= 4 ? '🏰 랜드마크는 인수할 수 없어요' : `🤝 인수 값 <b>${mbWon(this.assetAt(i) * MB.TAKEOVER)}</b>${(d.items[o.id] || {}).shield ? ' · 🛡️ 방어권 있음' : ''}`}</div>`;
      } else body += `<div class="row small">관광지는 건물을 못 짓고${v.takeover ? ' 인수도 할 수 없어요' : ''}.</div>`;
    } else {
      body += `<div class="row">${{ key: '카드를 한 장 뽑아요. 돈 · 이동 · 보관하는 카드(우대권 · 반값 쿠폰 · 탈출권' + (v.takeover ? ' · 인수 방어권' : '') + ')가 있어요.', tax: '들고 있는 현금의 10%(최소 50만)를 사회복지기금에 내요.',
        start: `지나가거나 멈추면 월급 ${MB.SALARY}만원.`, island: '3턴 동안 쉬어요. 더블이 나오거나, 100만원 · 탈출권으로 나와요.',
        fund: `벌금 · 세금이 쌓여요. 멈추면 모두 가져가요. 지금 <b>${mbWon(d.fund)}</b>`, travel: '다음 차례에 판의 원하는 칸으로 날아가요.' }[b.type] || ''}</div>`;
    }
    const goBtn = go ? `<button class="btn good" data-act="mbGo" data-to="${i}">✈️ ${MB.josa(b.name, '으로')} 가기</button>` : '';
    const was = !box.classList.contains('hidden');
    box.innerHTML = `<div class="mb-info-card${was ? ' still' : ''}" style="--g:${b.group ? MB.GROUPS[b.group] : b.type === 'spot' ? '#14b8a6' : '#94a3b8'}">
      <button class="x" data-act="mbInfoClose" aria-label="닫기">✕</button>
      <div class="h"><span class="ic">${b.ic}</span><b>${b.name}</b>${b.code ? `<small>${b.code}</small>` : ''}</div>${body}${goBtn}</div>`;
    box.classList.remove('hidden');
  },
  hideInfo() {
    this.infoAt = null;
    const box = $('#mb-info'); if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
    $$('#mb-board .mb-cell.sel').forEach(c => c.classList.remove('sel'));
  },
  keyInfo(item) {
    const it = MB.ITEMS[item], box = $('#mb-info'); if (!it || !box) return;
    this.infoAt = null;
    box.innerHTML = `<div class="mb-info-card key"><button class="x" data-act="mbInfoClose" aria-label="닫기">✕</button>
      <div class="h"><span class="ic">${it.ic}</span><b>${it.name}</b><small>×${(this.d.items[this.ctx.me] || {})[item] || 0}</small></div>
      <div class="row">${it.txt}</div><div class="row small">${it.how}</div></div>`;
    box.classList.remove('hidden');
  },

  /* ─────────── 판 크기 ─────────── */
  /** 남는 높이 · 너비 안에서 판을 가장 크게. 세로 화면 = [판 / 참가자 · 황금열쇠 (자리가 남으면 지난 일)] · 가로 화면 = [판 | 옵션 · 참가자 · 황금열쇠 · 지난 일] */
  fit() {
    const sec = $('#scr-marble'), board = $('#mb-board');
    if (!sec || !sec.classList.contains('active') || typeof Fit === 'undefined' || !board) return;
    const land = matchMedia('(min-aspect-ratio:1/1)').matches, wrap = land ? board : $('#scr-marble .mb-wrap'), log = $('#mb-log'), side = $('#mb-side');
    log.classList.toggle('show', land); log.style.maxHeight = ''; side.style.height = '';
    const z = +(sec.dataset.z || 1) || 1;
    const H = Math.floor(Fit.room(sec) - (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z - 6);
    const maxW = land ? sec.clientWidth - 300 - 14 : wrap.clientWidth;
    const ok = v => { sec.style.setProperty('--mb-bw', v + 'px'); return wrap.offsetHeight <= H; };
    let lo = 280, hi = Math.max(lo, Math.min(1150, maxW));
    if (!ok(hi) && ok(lo)) { while (hi - lo > 2) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; } ok(lo); }
    if (!land) { const spare = H - wrap.offsetHeight; if (spare >= 100) { log.classList.add('show'); log.style.maxHeight = (spare - 10) + 'px'; } }
    else {                                                                // 가로 화면: 옆 칸은 판 아래 끝까지만 (지난 일이 길어져도 넘치지 않게 · CSS 의 height:0 + min-height:100% 를 브라우저마다 똑같이)
      const sb = side.getBoundingClientRect(), bb = board.getBoundingClientRect();
      side.style.height = Math.max(100, Math.floor((bb.bottom - sb.top) / z)) + 'px';
    }
    this.layoutTokens();
  },
  fitSoon() { cancelAnimationFrame(this.fitRaf); this.fitRaf = requestAnimationFrame(() => { this.fit(); setTimeout(() => this.fit(), 260); }); },
};

$('#mb-board').addEventListener('click', e => {
  if (e.target.closest('.mb-info, .mb-panel, .mb-pop')) return;
  const cell = e.target.closest('.mb-cell'); if (!cell || !Marble.v) return;
  const i = +cell.dataset.i, v = Marble.v;
  const go = Marble.canGo(i);
  if (Marble.infoAt === i && !go) return Marble.hideInfo();
  Marble.info(i, go);
});
$('#mb-board').addEventListener('click', e => { if (e.target.closest('.mb-pop')) Marble.hidePop(); });
window.addEventListener('resize', () => { if (isScreen('marble') && Marble.v) { Marble.fitSoon(); Marble.layoutTokens(); } });
window.addEventListener('orientationchange', () => setTimeout(() => { if (isScreen('marble')) Marble.fitSoon(); }, 250));
document.addEventListener('visibilitychange', () => { if (!document.hidden && isScreen('marble') && Marble.busy && Marble.q.length > 3) Marble.next(); });
// 판 크기가 바뀌면(화면 맞춤 · 제목 줄 크기 변화 등) 말도 다시 놓고, 화면 폭이 바뀌면(채팅 접기 · 펴기 등) 판 크기를 다시 재요
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => { if (isScreen('marble') && Marble.v) Marble.layoutTokens(); }).observe($('#mb-board'));
  let secW = 0;
  new ResizeObserver(es => { const w = Math.round(es[0].contentRect.width); if (w && w !== secW) { secW = w; if (isScreen('marble') && Marble.v) Marble.fitSoon(); } }).observe($('#scr-marble'));
}
Object.assign(ACT, {
  mbDo: el => {
    if (!Marble.ctx || Marble.busy) return;
    $$('#mb-panel button').forEach(b => { b.disabled = true; });
    Marble.hideInfo();
    Marble.ctx.send({ t: el.dataset.t, lvl: el.dataset.lvl != null ? +el.dataset.lvl : undefined, use: el.dataset.use != null ? el.dataset.use : undefined });
  },
  mbGo: el => { if (!Marble.ctx || Marble.busy) return; Marble.hideInfo(); Marble.ctx.send({ t: 'travel', to: +el.dataset.to }); },
  mbKey: el => Marble.keyInfo(el.dataset.item),
  mbInfoClose: () => Marble.hideInfo(),
  mbSolo: el => {
    const so = Marble.soloOpts = Object.assign({ bots: 2, rounds: 20 }, Marble.soloOpts, el.dataset.bots ? { bots: +el.dataset.bots } : {}, el.dataset.rounds ? { rounds: +el.dataset.rounds } : {});
    Table.solo('marble', { bots: so.bots, opts: { rounds: so.rounds, takeover: 1 } });
    $$('#mb-solo .seg-btn').forEach(b => b.classList.toggle('on', +(b.dataset.bots || -1) === so.bots || +(b.dataset.rounds || -1) === so.rounds));
  },
});
Table.def('marble', {
  core: MarbleCore, render: (v, ctx, prev) => Marble.render(v, ctx, prev), solo: { bots: 2, opts: { rounds: 20, takeover: 1 } },
  key: (e, ctx) => {
    if (e.code === 'Escape') return Marble.hideInfo();
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && !Marble.busy && ctx.view.turnId === ctx.me && ctx.view.phase === 'roll') { e.preventDefault(); ctx.send({ t: 'roll' }); }
  },
});
$('#scr-marble').dataset.fitSelf = '1';   // 판 크기를 스스로 재요 → 화면 맞춤(Fit)이 전체를 키우지 않게
