/* =====================================================================
 *  🎓 인생 보드게임 화면 (규칙: shared/life-core.js)
 *  판은 SVG 한 장: 길 → 칸 → 자동차(사람 핀) 순서로 그려요. 룰렛 · 이동 · 돈 변화는 순서대로 애니메이션
 * ===================================================================== */
makeScreen('life', {
  title: '🎓 인생 보드게임', status: '룰렛을 돌려 인생길을 달려요. 은퇴할 때 재산이 가장 많은 사람이 승리!',
  stats: [['turn', '차례'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="lf-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="lfSolo" data-bots="1">1명</button><button class="seg-btn on" data-act="lfSolo" data-bots="2">2명</button>
      <button class="seg-btn" data-act="lfSolo" data-bots="3">3명</button><button class="seg-btn" data-act="lfSolo" data-bots="5">5명</button></div>
    <div class="lf-wrap">
      <div class="lf-stage"><div class="lf-scroll" id="lf-scroll"><svg class="lf-board" id="lf-board" viewBox="0 0 ${LifeCore.W} ${LifeCore.H}"></svg></div>
        <div class="lf-msg" id="lf-msg"></div><div class="lf-dec hidden" id="lf-dec"></div></div>
      <div class="lf-side">
        <div class="lf-spin"><div class="lf-wheel-wrap"><svg class="lf-wheel" id="lf-wheel" viewBox="-100 -100 200 200"></svg><i class="lf-pointer"></i>
          <button class="lf-hub" id="lf-hub" data-act="lfSpin">SPIN</button></div><div class="lf-acts" id="lf-acts"></div></div>
        <div class="lf-players" id="lf-players"></div>
      </div>
    </div>`,
});

const Life = {
  TILE: { pay: '월급', life: '보람', promo: '승진', cut: '감봉', tax: '세금', baby: '출산', gift: '선물', invest: '투자', career: '직업', marry: '결혼', house: '내 집', retire: '은퇴', start: '출발' },
  DESC: { pay: '월급날 — 지나가기만 해도 월급을 받아요', life: '보람 카드 — 은퇴할 때 점수가 공개돼요', promo: '승진 — 월급 20% 인상', cut: '구조조정 — 월급 15% 삭감', tax: '세금 — 월급의 80%를 내요',
    baby: '출산 — 모두에게 축하금 300만씩', gift: '선물 — 친구 한 명에게서 1,000만', invest: '투자 — 룰렛 6 이상 +5,000 / 5 이하 -3,000',
    career: '멈춤: 직업 카드 고르기', marry: '멈춤: 결혼 — 모두에게 축의금', house: '멈춤: 집 사기 (있으면 시세 상승)', retire: '도착: 은퇴! 먼저 올수록 보너스', start: '출발' },
  ICON: {
    career: '<rect x="-10" y="-14" width="20" height="14" rx="2.5"/><path d="M-4,-14 v-3 h8 v3 M-10,-8 h20"/>',
    marry: '<circle cx="-4.5" cy="-8" r="6"/><circle cx="4.5" cy="-8" r="6"/>',
    house: '<path d="M-11,-6 L0,-16 L11,-6 M-7.5,-9 v10 h15 v-10"/><path d="M-2,1 v-5 h4 v5"/>',
    retire: '<circle cx="0" cy="-8" r="5"/><path d="M-12,0 h24 M-9,-15 l2.5,2.5 M9,-15 l-2.5,2.5 M0,-19 v3.5 M-13,-8 h3 M10,-8 h3"/>',
    start: '<path d="M-7,1 v-19 M-7,-18 h13 l-3.5,4.5 l3.5,4.5 h-13"/>',
  },
  WHEEL: ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2e86de', '#8e44ad', '#d81b60', '#34495e', '#1abc9c'],
  roadSeg(a, b) { const br = ['college', 'job', 'safe', 'risk']; return br.includes(b.seg) ? b.seg : br.includes(a.seg) ? a.seg : 'main'; },

  build() {
    const N = LifeCore.NODES, big = t => ['career', 'marry', 'house', 'retire', 'start'].includes(t);
    let road = '', lane = '';
    for (const a of N) for (const t of a.next) { const b = N[t], l = `x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`; road += `<line class="${this.roadSeg(a, b)}" ${l}/>`; lane += `<line ${l}/>`; }
    const tiles = N.map(n => {
      const money = n.type === 'money', B = big(n.type), r = B ? 29 : 23;
      const label = money ? (n.v > 0 ? '+' : '') + n.v.toLocaleString('ko-KR') : this.TILE[n.type];
      const cls = money ? (n.v > 0 ? 'gain' : 'loss') : n.type;
      const tip = money ? `${n.txt} ${n.v > 0 ? '+' : ''}${n.v.toLocaleString('ko-KR')}만` : this.DESC[n.type];
      return `<g class="lf-tile ${cls} ${B ? 'big' : ''}" transform="translate(${n.x},${n.y})" data-i="${n.id}"><title>${esc(tip)}</title>
        <rect class="b" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" rx="${B ? 15 : 11}"/>${B ? `<rect class="ring" x="${-r + 4}" y="${-r + 4}" width="${r * 2 - 8}" height="${r * 2 - 8}" rx="11"/>` : ''}
        <rect class="hl" x="${-r + 3}" y="${-r + 3}" width="${r * 2 - 6}" height="${r - 4}" rx="${B ? 12 : 8}"/>
        ${B ? `<g class="ic">${this.ICON[n.type]}</g><text y="16">${label}</text>` : `<text class="${label.length > 4 ? 'sm' : ''}" y="1">${label}</text>`}</g>`;
    }).join('');
    $('#lf-board').innerHTML = `
      <text class="zone" x="390" y="138">청춘</text><text class="zone" x="925" y="228">가정</text><text class="zone" x="390" y="462">갈림길</text><text class="zone" x="905" y="548">황금기</text>
      <text class="zone sm" x="390" y="24">대학 진학</text><text class="zone sm" x="390" y="222">바로 취업</text><text class="zone sm" x="390" y="350">안정의 길</text><text class="zone sm" x="390" y="540">모험의 길</text>
      <g class="lf-road">${road}</g><g class="lf-lane">${lane}</g><g id="lf-tiles">${tiles}</g><g id="lf-cars"></g><g id="lf-fx"></g>`;
    // 룰렛
    const R = 92, seg = (i, r) => { const a0 = (i * 36 - 18 - 90) * Math.PI / 180, a1 = a0 + Math.PI / 5; return `M0,0 L${(r * Math.cos(a0)).toFixed(2)},${(r * Math.sin(a0)).toFixed(2)} A${r},${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)},${(r * Math.sin(a1)).toFixed(2)}Z`; };
    $('#lf-wheel').innerHTML = `<circle r="98" fill="#d4a017"/><circle r="94" fill="#1a1f2b"/>`
      + this.WHEEL.map((c, i) => `<path d="${seg(i, R)}" fill="${c}"/>`).join('')
      + Array.from({ length: 10 }, (_, i) => `<g transform="rotate(${i * 36})"><text y="-66">${i + 1}</text><circle cy="-${R}" r="3" fill="#f8e7a1" transform="rotate(18)"/></g>`).join('')
      + `<circle r="40" fill="rgba(0,0,0,.25)"/>`;
    this.gen = (this.gen || 0) + 1; this.q = []; this.busy = false; this.disp = {}; this.ang = {}; this.wheelRot = 0; this.lastN = null; this.money = {};
    this.wheel(0, true);
  },

  render(v, ctx, prev) {
    if (!prev || !$('#lf-tiles')) this.build();
    this.v = v; this.ctx = ctx;
    $('#lf-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const t = v.players.find(p => p.id === v.turnId);
    setStat('life', 'turn', v.over ? '끝' : t ? t.name : '-');
    this.cars(v);
    if (this.lastN == null) {           // 처음: 지난 기록은 건너뛰고 지금 상태로
      this.lastN = v.seq;
      v.players.forEach(p => { this.disp[p.id] = p.node; });
      this.layout();
      return this.idle();
    }
    for (const e of v.log) {
      if (e.n <= this.lastN) continue;
      this.lastN = e.n;
      if (e.t === 'spin') this.q.push({ k: 'spin', v: e.v });
      else if (e.t === 'walk') this.q.push({ k: 'walk', id: e.id, nodes: e.nodes });
      else if (e.t === 'money') this.q.push({ k: 'float', id: e.id, txt: (e.amt > 0 ? '+' : '') + e.amt.toLocaleString('ko-KR'), cls: e.amt > 0 ? 'gain' : 'loss' });
      else if (e.t === 'loan') this.q.push({ k: 'float', id: e.id, txt: `대출 ${e.amt.toLocaleString('ko-KR')}`, cls: 'loan' });
      else if (e.t === 'life') this.q.push({ k: 'float', id: e.id, txt: '보람 카드!', cls: 'life' });
      else if (e.t === 'retire') this.q.push({ k: 'float', id: e.id, txt: '은퇴!', cls: 'gold' });
    }
    if (!this.busy) this.lock();
    this.run();
  },
  /** 애니메이션이 도는 동안은 버튼을 잠가요 */
  lock() { $('#lf-dec').classList.add('hidden'); $('#lf-hub').classList.remove('ready'); $('#lf-acts').innerHTML = ''; },
  run() {
    if (this.busy) return;
    const it = this.q.shift();
    if (!it) return this.idle();
    this.busy = true;
    const gen = this.gen, fast = this.q.length > 8 ? 0.3 : this.q.length > 4 ? 0.6 : 1;
    const done = ms => after(Math.round(ms * fast), () => { if (gen !== this.gen) return; this.busy = false; this.run(); });
    if (it.k === 'spin') { this.wheel(it.v); done(1250); }
    else if (it.k === 'float') { this.float(it); done(120); }
    else if (it.k === 'walk') {
      const nodes = it.nodes.slice();
      const step = () => {
        if (gen !== this.gen) return;
        this.moveCar(it.id, nodes.shift());
        if (nodes.length) after(Math.round(150 * fast), step); else done(260);
      };
      step();
    } else done(0);
  },
  /** 애니메이션이 다 끝나면: 메시지 · 결정 창 · 버튼 · 패널을 최신 상태로 */
  idle() {
    const v = this.v, ctx = this.ctx; if (!v) return;
    let moved = false;
    v.players.forEach(p => { if (this.disp[p.id] !== p.node) { this.disp[p.id] = p.node; moved = true; } });
    if (moved) this.layout();
    const tp = v.players.find(p => p.id === v.turnId); if (tp) this.follow(this.disp[tp.id]);
    $('#lf-msg').textContent = v.msg;
    this.side(v);
    const mine = v.turnId === ctx.me && !v.over, me = v.players.find(p => p.id === ctx.me), t = v.players.find(p => p.id === v.turnId);
    const hub = $('#lf-hub'), acts = $('#lf-acts');
    hub.classList.toggle('ready', mine && v.phase === 'spin');
    hub.disabled = !(mine && (v.phase === 'spin' || v.phase === 'invest'));
    if (!mine) acts.innerHTML = v.over ? '<span class="muted">게임 끝!</span>' : `<span class="muted">${esc(t ? t.name : '')} 님 차례${v.phase === 'spin' ? '' : ' · 고르는 중'}…</span>`;
    else if (v.phase === 'spin') acts.innerHTML = `<button class="btn good" data-act="lfSpin">룰렛 돌리기 <small>Space</small></button>`
      + (me.debt ? `<button class="btn ghost" data-act="lfDo" data-t="repay" ${me.money < 1000 ? 'disabled' : ''}>대출 갚기</button>` : '');
    else acts.innerHTML = '<span class="muted">선택하세요 ↖</span>';
    this.decision(v, mine, me);
  },
  decision(v, mine, me) {
    const box = $('#lf-dec'), d = v.decision, m = Pieces.money;
    if (!mine || !d || v.phase === 'spin') { box.classList.add('hidden'); return; }
    let title = '', cards = '', extra = '';
    if (v.phase === 'fork') {
      title = '갈림길 — 어느 길로 갈까요?';
      cards = d.options.map(o => `<button class="lf-card ${o.seg}" data-act="lfDo" data-t="fork" data-to="${o.to}"><i class="stripe"></i><small>ROUTE</small><b>${o.label}</b><span>${o.desc}</span></button>`).join('');
    } else if (v.phase === 'career') {
      title = d.kind === 'college' ? '졸업 축하해요! 직업 카드를 고르세요' : '직업 카드를 고르세요';
      cards = d.options.map((o, i) => `<button class="lf-card career" data-act="lfDo" data-t="career" data-i="${i}"><i class="stripe"></i><small>${d.kind === 'college' ? 'PROFESSIONAL' : 'CAREER'}</small><b>${o.name}</b><span>월급 ${m(o.salary)}만</span></button>`).join('');
    } else if (v.phase === 'house') {
      title = '내 집 마련 — 어떤 집을 살까요?';
      cards = d.options.map((o, i) => `<button class="lf-card house" data-act="lfDo" data-t="house" data-i="${i}"><i class="stripe"></i><small>HOUSE</small><b>${o.name}</b><span>매입 ${m(o.price)}만</span><span>은퇴 때 ${m(o.sell)}만에 판매</span><em>+${m(o.sell - o.price)}만</em></button>`).join('');
      extra = `<p class="lf-dec-sub">내 현금 ${m(me.money)}만 · 모자라면 2,000만씩 자동 대출 (끝날 때 25% 이자)</p><button class="btn ghost" data-act="lfDo" data-t="skip">다음에 살게요</button>`;
    } else if (v.phase === 'gift') {
      title = '선물 — 누구에게서 1,000만을 받을까요?';
      cards = d.options.map(o => `<button class="lf-card gift sm" data-act="lfDo" data-t="gift" data-id="${esc(o.id)}"><i class="stripe"></i><small>FRIEND</small><b>${esc(o.name)}</b><span>현금 ${m(o.money)}만</span></button>`).join('');
    } else if (v.phase === 'invest') {
      title = '투자 기회!';
      cards = `<button class="lf-card invest" data-act="lfDo" data-t="invest"><i class="stripe"></i><small>INVEST</small><b>투자하기</b><span>룰렛 6~10 → +${m(d.win)}만</span><span>룰렛 1~5 → -${m(d.lose)}만</span></button>`;
      extra = '<button class="btn ghost" data-act="lfDo" data-t="skip">안 할래요</button>';
    } else { box.classList.add('hidden'); return; }
    box.innerHTML = `<div class="lf-dec-t">${title}</div><div class="lf-dec-cards">${cards}</div>${extra}`;
    box.classList.remove('hidden');
  },
  side(v) {
    const m = Pieces.money;
    $('#lf-players').innerHTML = v.players.map(p => {
      const changed = this.money[p.id] != null && this.money[p.id] !== p.money ? (p.money > this.money[p.id] ? 'up' : 'down') : '';
      const tags = [p.married ? '<span>기혼</span>' : '', p.kids ? `<span>자녀 ${p.kids}</span>` : '', p.house ? `<span>${esc(p.house.name)}</span>` : '', `<span>보람 ${p.lifeN}장</span>`, p.debt ? `<span class="debt">대출 ${m(p.debt)}</span>` : ''].join('');
      return `<div class="lf-p ${p.id === v.turnId && !v.over ? 'turn' : ''} ${p.retired ? 'retired' : ''}" style="--pc:${p.color}">
        <div class="lf-p-top"><i class="dot"></i><b>${esc(p.name)}${p.id === this.ctx.me ? ' (나)' : ''}</b>${p.retired ? `<em>${p.rank}등 은퇴</em>` : ''}</div>
        <div class="lf-p-money ${changed}">${m(p.money)}<small>만원</small></div>
        <div class="lf-p-job">${p.career ? `${esc(p.career)} · 월급 ${m(p.salary)}만` : '아직 직업 없음'}</div><div class="lf-p-tags">${tags}</div>
        ${p.life && p.life.length ? `<div class="lf-p-cards">${p.life.map(c => `${esc(c.t)} ${m(c.v)}`).join(' · ')}</div>` : ''}</div>`;
    }).join('');
    v.players.forEach(p => { this.money[p.id] = p.money; });
  },
  /** 룰렛을 v 칸이 위(바늘)로 오게 돌리기 */
  wheel(n, instant) {
    const el = $('#lf-wheel'), hub = $('#lf-hub');
    const target = n ? -(n - 1) * 36 : 0;
    if (instant) { this.wheelRot = target; el.style.transition = 'none'; el.style.transform = `rotate(${target}deg)`; void el.getBoundingClientRect(); el.style.transition = ''; hub.textContent = 'SPIN'; hub.classList.remove('big'); return; }
    const delta = (((target - this.wheelRot) % 360) + 360) % 360;
    this.wheelRot += 360 * 4 + delta;
    el.style.transform = `rotate(${this.wheelRot}deg)`;
    hub.textContent = '…'; hub.classList.remove('big');
    const gen = this.gen;
    after(1150, () => { if (gen === this.gen) { hub.textContent = n; hub.classList.add('big'); } });
  },
  /** 자동차(사람 핀) 만들기 · 갱신 */
  cars(v) {
    const layer = $('#lf-cars');
    const SEATS = [[-1.5, -4], [-1.5, 4], [-6.5, -4], [-6.5, 4], [-11.5, -4], [-11.5, 4]];
    v.players.forEach(p => {
      let car = layer.querySelector(`[data-id="${CSS.escape(p.id)}"]`);
      if (!car) {
        car = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        car.setAttribute('class', 'lf-car'); car.dataset.id = p.id;
        car.innerHTML = `<circle class="ring" r="25"/><g fill="#0b0d12"><rect x="-14" y="-14.5" width="9" height="5" rx="1.5"/><rect x="6" y="-14.5" width="9" height="5" rx="1.5"/><rect x="-14" y="9.5" width="9" height="5" rx="1.5"/><rect x="6" y="9.5" width="9" height="5" rx="1.5"/></g>
          <path class="body" d="M-19,-8 Q-19,-12 -15,-12 H11 Q20,-12 20,0 Q20,12 11,12 H-15 Q-19,12 -19,8 Z" fill="${p.color}"/>
          <path d="M-15,-10.5 H10 Q15,-10.5 17,-6.5 H-15.5 Z" fill="rgba(255,255,255,.3)"/><path d="M7,-9 Q11.5,0 7,9 L3.5,8 Q5.5,0 3.5,-8 Z" fill="rgba(8,16,26,.88)"/>
          <rect x="-14.5" y="-8.5" width="16.5" height="17" rx="3" fill="rgba(0,0,0,.24)"/><circle cx="18.6" cy="-7" r="1.7" fill="#fff6c2"/><circle cx="18.6" cy="7" r="1.7" fill="#fff6c2"/><g class="pegs"></g>`;
        layer.append(car);
        if (this.disp[p.id] == null) this.disp[p.id] = p.node;
      }
      const filled = [p.retired ? '#ffd700' : '#ffffff', p.married ? '#ff8fb1' : null, ...Array.from({ length: Math.min(4, p.kids) }, () => '#7fd3ff')];
      car.querySelector('.pegs').innerHTML = SEATS.map(([x, y], i) => filled[i] ? `<circle cx="${x}" cy="${y}" r="2.7" fill="${filled[i]}" stroke="rgba(0,0,0,.5)" stroke-width=".9"/>` : `<circle cx="${x}" cy="${y}" r="1.5" fill="rgba(0,0,0,.35)"/>`).join('');
      car.classList.toggle('turn', p.id === v.turnId && !v.over);
    });
  },
  moveCar(id, to) {
    const N = LifeCore.NODES, from = N[this.disp[id]], b = N[to];
    if (from && b && from !== b) {
      let a = Math.atan2(b.y - from.y, b.x - from.x) * 180 / Math.PI, cur = this.ang[id] || 0;
      while (a - cur > 180) a -= 360;
      while (a - cur < -180) a += 360;
      this.ang[id] = a;
    }
    this.disp[id] = to;
    this.layout();
    this.follow(to);
    const tile = $(`#lf-tiles [data-i="${to}"]`);
    if (tile) { tile.classList.remove('hit'); void tile.getBoundingClientRect(); tile.classList.add('hit'); }
  },
  /** 판이 화면보다 넓으면(휴대폰) 움직이는 차를 따라 가로로 스크롤 */
  follow(node) {
    const sc = $('#lf-scroll'), n = LifeCore.NODES[node];
    if (!sc || !n || sc.scrollWidth <= sc.clientWidth + 4) return;
    sc.scrollTo({ left: n.x * (sc.scrollWidth / LifeCore.W) - sc.clientWidth / 2, behavior: 'smooth' });
  },
  /** 같은 칸에 여러 대면 옆으로 비켜서 세워요 */
  layout() {
    const N = LifeCore.NODES, v = this.v; if (!v) return;
    const groups = {};
    v.players.forEach(p => { (groups[this.disp[p.id]] = groups[this.disp[p.id]] || []).push(p.id); });
    v.players.forEach(p => {
      const car = $(`#lf-cars [data-id="${CSS.escape(p.id)}"]`), n = N[this.disp[p.id]];
      if (!car || !n) return;
      if (this.ang[p.id] == null) { const nx = N[n.next[0]] || n; this.ang[p.id] = nx === n ? 0 : Math.atan2(nx.y - n.y, nx.x - n.x) * 180 / Math.PI; }
      const g = groups[this.disp[p.id]], k = g.indexOf(p.id), off = (k - (g.length - 1) / 2) * Math.min(17, 66 / g.length);
      car.style.transform = `translate(${n.x}px,${n.y}px) rotate(${this.ang[p.id]}deg) translate(${-k * 3}px,${off}px) scale(1.15)`;
    });
  },
  float(it) {
    const N = LifeCore.NODES, n = N[this.disp[it.id]]; if (!n) return;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('class', 'lf-float ' + it.cls); el.setAttribute('x', n.x); el.setAttribute('y', n.y - 30);
    el.textContent = it.txt;
    $('#lf-fx').append(el);
    setTimeout(() => el.remove(), 1500);
  },
};
window.addEventListener('resize', () => { if (isScreen('life') && Life.v) Life.layout(); });
Object.assign(ACT, {
  lfSpin: () => { const v = Life.v, c = Life.ctx; if (!v || !c || Life.busy || v.turnId !== c.me) return; if (v.phase === 'spin') c.send({ t: 'spin' }); else if (v.phase === 'invest') c.send({ t: 'invest' }); },
  lfDo: el => {
    const c = Life.ctx; if (!c || Life.busy) return;
    const d = el.dataset, a = { t: d.t };
    if (d.to != null) a.to = +d.to;
    if (d.i != null) a.i = +d.i;
    if (d.id != null) a.id = d.id;
    $('#lf-dec').classList.add('hidden');
    c.send(a);
  },
  lfSolo: el => {
    Life.soloBots = +el.dataset.bots;
    Table.solo('life', { bots: Life.soloBots });
    $$('#lf-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === Life.soloBots));
  },
});
Table.def('life', {
  core: LifeCore, render: (v, ctx, prev) => Life.render(v, ctx, prev), solo: { bots: 2 },
  key: (e, ctx) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) ACT.lfSpin(); },
});
