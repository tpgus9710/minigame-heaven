/* =====================================================================
 *  🎓 인생 게임 화면 (규칙: shared/life-core.js)
 *  판은 SVG 한 장. 화면 모양에 맞춰 가로판 / 세로판(가로판의 x↔y)을 고르고,
 *  판이 너무 작아지는 화면(휴대폰 · 폴드 커버)에서는 카메라가 차를 따라가요.
 *  🗺️ 버튼: 전체 보기 · 판을 끌어서 둘러보기 · 칸을 누르면 설명
 * ===================================================================== */
makeScreen('life', {
  title: '🎓 인생 게임', status: '룰렛을 돌려 인생길을 달려요 · 은퇴했을 때 가장 풍요로운 사람이 승리!',
  stats: [['turn', '차례'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="lf-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="lfSolo" data-bots="1">1명</button><button class="seg-btn on" data-act="lfSolo" data-bots="2">2명</button>
      <button class="seg-btn" data-act="lfSolo" data-bots="3">3명</button><button class="seg-btn" data-act="lfSolo" data-bots="5">5명</button></div>
    <div class="lf-wrap bottom" id="lf-wrap">
      <div class="lf-stage" id="lf-stage">
        <svg class="lf-board" id="lf-board" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"></svg>
        <button class="lf-cam hidden" id="lf-cam" data-act="lfCam" type="button"></button>
        <div class="lf-msg" id="lf-msg"></div>
      </div>
      <div class="lf-panel" id="lf-panel">
        <div class="lf-spin"><div class="lf-wheel-wrap"><svg class="lf-wheel" id="lf-wheel" viewBox="-100 -100 200 200"></svg><i class="lf-pointer"></i>
          <button class="lf-hub" id="lf-hub" data-act="lfSpin" type="button">SPIN</button><span class="lf-why" id="lf-why"></span></div>
          <div class="lf-acts" id="lf-acts"></div></div>
        <div class="lf-players" id="lf-players"></div>
      </div>
      <div class="lf-dec hidden" id="lf-dec"></div>
      <div class="lf-sheet hidden" id="lf-sheet"></div>
    </div>`,
});

const Life = {
  /* 칸 모양: [그림, 글자] */
  TILE: {
    pay: ['💰', '월급'], life: ['🌟', '보람'], kids: ['🧒', '자녀'], baby: ['👶', '아기'], pet: ['🐶', '반려'], promo: ['🎖️', '승진'], cut: ['✂️', '감봉'],
    tax: ['💸', '세금'], stock: ['📈', '주식'], boom: ['🚀', '폭등'], crash: ['📉', '폭락'], lucky: ['🎰', '행운'], sue: ['⚖️', '소송'], change: ['🔄', '이직'],
    disaster: ['🌀', '재해'], house2: ['🏖️', '별장'], start: ['🚩', '출발'], marry: ['💍', '결혼'], house: ['🏠', '내 집'], retire: ['🏁', '은퇴'],
  },
  CAREER_STOP: { college: ['🎓', '졸업'], basic: ['💼', '취업'], grad: ['🎓', '대학원'] },
  BIG: ['start', 'career', 'marry', 'house', 'retire'],
  LANES: { college: '#2f6fd6', job: '#c58a2a', family: '#d9577f', grad: '#7b5cd6', safe: '#2e9b62', risk: '#d05a32' },
  /* 갈림길 이름표 (가로판 좌표: 두 길 사이 빈자리) */
  LANE_TAG: [['college', 250, 81], ['job', 500, 95], ['family', 470, 226], ['grad', 250, 240], ['safe', 820, 516], ['risk', 600, 530]],
  WHEEL: ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2e86de', '#8e44ad', '#d81b60', '#34495e', '#1abc9c'],
  WHY: { sell: '🏠 집 매각', lucky: '🎰 행운의 룰렛', youtube: '🎬 조회수' },
  money: n => Pieces.money(n),

  desc(n) {
    const m = v => `${v > 0 ? '+' : ''}${Pieces.money(v)}만`, C = LifeCore.CAREERS;
    const to = n.tag && C[n.tag] ? ` (${C[n.tag].icon} ${C[n.tag].name}에게)` : '';
    switch (n.type) {
      case 'pay': return '💰 월급날 — 지나가면 월급, 딱 멈추면 월급 + 보너스 50%';
      case 'life': return '🌟 보람 카드 — 값(1,000~5,000만)은 끝날 때 공개돼요';
      case 'money': return `${n.txt} ${m(n.v)}${n.v < 0 ? to : n.tag === 'athlete' ? ' (운동선수는 2배)' : ''}`;
      case 'kids': return `🧒 ${n.txt} — 자녀 1명당 ${m(n.v)}${n.v < 0 ? to : ''}`;
      case 'baby': return `👶 ${n.txt} — 모두에게 축하금 ${300 * (n.v || 1)}만씩`;
      case 'pet': return '🐶 반려동물 입양 — 가족 +1 · 진료비 300만 (🐾 수의사에게)';
      case 'promo': return '🎖️ 승진 — 월급 15% 인상';
      case 'cut': return '✂️ 구조조정 — 월급 15% 삭감';
      case 'tax': return '💸 세금 — 월급의 절반 (🧮 회계사에게)';
      case 'stock': return '📈 주식 — 숫자 하나를 5,000만에 사면 그 숫자가 나올 때마다 1,000만';
      case 'boom': return '🚀 주가 폭등 — 공짜 주식, 이미 있으면 특별 배당 2,000만';
      case 'crash': return '📉 주가 폭락 — 가진 주식을 잃어요';
      case 'lucky': return '🎰 행운의 룰렛 — 숫자를 맞히면 +5,000만 · 틀리면 -500만';
      case 'sue': return '⚖️ 소송 — 한 명에게서 1,500만 (변호사는 소송을 안 당해요)';
      case 'change': return '🔄 이직 기회 — 다른 직업으로 바꿀 수 있어요';
      case 'disaster': return `🌀 ${n.txt} — 보험 없는 집은 집값의 ${n.v}% 수리비`;
      case 'house2': return '🏖️ 별장 · 이사 — 집을 하나 더 살 수 있어요';
      case 'start': return '🚩 출발 — 첫 갈림길에서 대학 / 취업';
      case 'career': return n.v === 'college' ? '🎓 멈춤: 졸업 — 전문직 카드 3장 중 고르기' : n.v === 'grad' ? '🎓 멈춤: 대학원 졸업 — 전문직으로 바꾸기' : '💼 멈춤: 취업 — 직업 카드 2장 중 고르기';
      case 'marry': return '💍 멈춤: 결혼 — 룰렛 6 이상이면 축의금 1,000만씩, 아니면 500만씩 + 보람 카드';
      case 'house': return '🏠 멈춤: 내 집 마련 — 집 3채 중 하나를 살 수 있어요 (보험 선택)';
      case 'retire': return '🏁 도착: 은퇴 — 🏰 억만장자 저택 / 🌾 전원 마을';
      default: return '';
    }
  },
  /* ── 판 좌표: 세로판이면 x↔y ── */
  pos(i) { const n = LifeCore.NODES[i]; return this.port ? [n.y, n.x] : [n.x, n.y]; },
  dims() { return this.port ? [LifeCore.H, LifeCore.W] : [LifeCore.W, LifeCore.H]; },
  laneOf(a, b) { const L = this.LANES; return L[b.seg] ? b.seg : L[a.seg] ? a.seg : ''; },

  build() {
    const N = LifeCore.NODES, [BW, BH] = this.dims();
    let road = '', lane = '';
    for (const a of N) for (const t of a.next) {
      const b = N[t], [x1, y1] = this.pos(a.id), [x2, y2] = this.pos(b.id), ln = this.laneOf(a, b);
      const l = `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
      road += `<line ${l}${ln ? ` style="stroke:${this.LANES[ln]}"` : ''}/>`; lane += `<line ${l}/>`;
    }
    const tags = this.LANE_TAG.map(([seg, x, y]) => {
      const [px, py] = this.port ? [y, x] : [x, y];
      return `<g class="lf-lane-tag" transform="translate(${px},${py})${this.port ? ' rotate(-90)' : ''}"><rect x="-44" y="-11" width="88" height="22" rx="11" style="fill:${this.LANES[seg]}"/><text y="1">${LifeCore.FORK[seg].label}</text></g>`;
    }).join('');
    const tiles = N.map(n => {
      const B = this.BIG.includes(n.type), r = B ? 28 : 22, [x, y] = this.pos(n.id);
      let ic, label, cls = n.type;
      if (n.type === 'money') { ic = ''; label = (n.v > 0 ? '+' : '') + Pieces.money(n.v); cls += n.v > 0 ? ' gain' : ' loss'; }
      else if (n.type === 'career') [ic, label] = this.CAREER_STOP[n.v];
      else if (n.type === 'disaster') { ic = /지진/.test(n.txt) ? '🏚️' : '🌀'; label = '재해'; }
      else if (n.type === 'baby' && n.v === 2) { ic = '👶'; label = '쌍둥이'; }
      else [ic, label] = this.TILE[n.type] || ['', ''];
      const badge = n.tag && LifeCore.CAREERS[n.tag] ? `<text class="tg" x="${r - 6}" y="${-r + 7}">${LifeCore.CAREERS[n.tag].icon}</text>` : '';
      const body = ic
        ? `<text class="ic" y="${B ? -7 : -6}">${ic}</text><text class="lb ${label.length > 3 ? 'sm' : ''}" y="${B ? 15 : 12}">${label}</text>`
        : `<text class="amt ${label.length > 5 ? 'sm' : ''}" y="1">${label}</text>`;
      return `<g class="lf-tile t-${cls} ${B ? 'big' : ''}" transform="translate(${x},${y})" data-i="${n.id}">
        <rect class="b" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" rx="${B ? 15 : 11}"/>${B ? `<rect class="ring" x="${-r + 4}" y="${-r + 4}" width="${r * 2 - 8}" height="${r * 2 - 8}" rx="11"/>` : ''}
        <rect class="hl" x="${-r + 3}" y="${-r + 3}" width="${r * 2 - 6}" height="${r - 4}" rx="${B ? 12 : 8}"/>${body}${badge}</g>`;
    }).join('');
    const svg = $('#lf-board');
    svg.innerHTML = `<defs><linearGradient id="lf-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d5a45"/><stop offset=".55" stop-color="#174a52"/><stop offset="1" stop-color="#14304f"/></linearGradient>
        <radialGradient id="lf-glow" cx=".3" cy=".2" r=".8"><stop offset="0" stop-color="rgba(255,255,255,.10)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
      <rect class="lf-bgr" x="-400" y="-400" width="${BW + 800}" height="${BH + 800}"/>
      <rect x="0" y="0" width="${BW}" height="${BH}" rx="26" fill="url(#lf-bg)"/><rect x="0" y="0" width="${BW}" height="${BH}" rx="26" fill="url(#lf-glow)"/>
      <g class="lf-road">${road}</g><g class="lf-lane">${lane}</g>${tags}<g id="lf-tiles">${tiles}</g><g id="lf-cars"></g><g id="lf-fx"></g>`;
    this.builtPort = this.port;
    this.vb = null;
  },
  wheelBuild() {
    const R = 92, seg = i => { const a0 = (i * 36 - 18 - 90) * Math.PI / 180, a1 = a0 + Math.PI / 5; return `M0,0 L${(R * Math.cos(a0)).toFixed(2)},${(R * Math.sin(a0)).toFixed(2)} A${R},${R} 0 0 1 ${(R * Math.cos(a1)).toFixed(2)},${(R * Math.sin(a1)).toFixed(2)}Z`; };
    $('#lf-wheel').innerHTML = `<circle r="98" fill="#d4a017"/><circle r="94" fill="#1a1f2b"/>`
      + this.WHEEL.map((c, i) => `<path d="${seg(i)}" fill="${c}"/>`).join('')
      + Array.from({ length: 10 }, (_, i) => `<g transform="rotate(${i * 36})"><text y="-66">${i + 1}</text><circle cy="-${R}" r="3" fill="#f8e7a1" transform="rotate(18)"/></g>`).join('')
      + `<circle r="40" fill="rgba(0,0,0,.25)"/>`;
  },
  reset() {
    this.gen = (this.gen || 0) + 1; this.q = []; this.busy = false; this.disp = {}; this.ang = {}; this.wheelRot = 0; this.lastN = null; this.cash = {};
    this.ins = false; this.manual = false; this.full = false; this.sheetId = null;
    this.wheelBuild(); this.wheel(0, true);
  },

  /* ── 화면 맞춤: 남는 높이를 다 쓰고 · 가로(판 | 패널) / 세로(판 / 패널) 고르기 ── */
  fit() {
    const sec = $('#scr-life'), wrap = $('#lf-wrap');
    if (!sec || !sec.classList.contains('active') || !wrap) return;
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' ? Fit.room(sec) : innerHeight - sec.getBoundingClientRect().top;
    const top = (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const H = Math.max(320, Math.floor(room - top - 6)), W = sec.clientWidth;
    const side = W >= 820 && W / H >= 1.2;
    wrap.classList.toggle('side', side); wrap.classList.toggle('bottom', !side);
    wrap.style.height = H + 'px';
    this.orient();
    this.camera(false);
  },
  fitSoon() { cancelAnimationFrame(this.fitRaf); this.fitRaf = requestAnimationFrame(() => { this.fit(); setTimeout(() => this.fit(), 280); }); },
  /** 판 방향: 가로판 / 세로판 중 더 크게 보이는 쪽 */
  orient() {
    const st = $('#lf-stage'), w = st.clientWidth, h = st.clientHeight;
    if (!w || !h) return;
    const sL = Math.min(w / LifeCore.W, h / LifeCore.H), sP = Math.min(w / LifeCore.H, h / LifeCore.W);
    const port = sP > sL * 1.04;
    this.fitS = Math.max(sL, sP);
    this.follow = this.fitS < 0.6;                       // 전체를 보면 칸이 너무 작아지는 화면: 카메라가 따라가요
    if (port !== this.port || this.builtPort !== port || !$('#lf-tiles')) {
      this.port = port;
      this.build();
      if (this.v) { this.cars(this.v); this.layout(); }
    }
    const cam = $('#lf-cam');
    cam.classList.toggle('hidden', !this.follow);
    cam.textContent = this.full ? '🎯' : '🗺️';
    cam.title = this.full ? '내 차 따라가기' : '판 전체 보기';
  },
  /* ── 카메라 (SVG viewBox) ── */
  box(cx, cy) {
    const st = $('#lf-stage'), w = st.clientWidth || 1, h = st.clientHeight || 1, [BW, BH] = this.dims();
    if (!this.follow || this.full || cx == null) {
      const s = Math.min(w / (BW + 24), h / (BH + 24)), vw = w / s, vh = h / s;
      return [(BW - vw) / 2, (BH - vh) / 2, vw, vh];
    }
    const s = Math.max(this.fitS, matchMedia('(pointer:coarse)').matches ? 0.9 : 0.8), vw = w / s, vh = h / s;
    const cl = (v, size, full) => (size >= full + 40 ? (full - size) / 2 : Math.max(-20, Math.min(full - size + 20, v)));
    return [cl(cx - vw / 2, vw, BW), cl(cy - vh / 2, vh, BH), vw, vh];
  },
  setVB(b, ms) {
    const svg = $('#lf-board');
    cancelAnimationFrame(this.vbRaf);
    const put = v => { this.vb = v; svg.setAttribute('viewBox', v.map(x => x.toFixed(1)).join(' ')); };
    if (!ms || !this.vb) return put(b);
    const a = this.vb.slice(), t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      put(a.map((x, i) => x + (b[i] - x) * e));
      if (k < 1) this.vbRaf = requestAnimationFrame(step);
    };
    this.vbRaf = requestAnimationFrame(step);
  },
  /** 카메라를 지금 차(또는 node)로 */
  camera(anim, node) {
    if (!$('#lf-tiles')) return;
    let c = [null, null];
    const v = this.v;
    if (node == null && v) { const t = v.players.find(p => p.id === v.turnId); if (t) node = this.disp[t.id] ?? t.node; }
    if (node != null) c = this.pos(node);
    if (this.manual && anim) return;
    this.setVB(this.box(c[0], c[1]), anim ? 420 : 0);
  },

  render(v, ctx, prev) {
    const fresh = !prev || !$('#lf-tiles') || this.builtPort == null;
    if (fresh) { this.reset(); this.v = v; this.ctx = ctx; this.build(); this.fitSoon(); }
    const turnChanged = !this.v || this.v.turnId !== v.turnId;
    this.v = v; this.ctx = ctx;
    $('#lf-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const t = v.players.find(p => p.id === v.turnId);
    setStat('life', 'turn', v.over ? '끝' : t ? t.name : '-');
    if (turnChanged) this.manual = false;
    this.cars(v);
    if (this.lastN == null) {           // 처음: 지난 기록은 건너뛰고 지금 상태로
      this.lastN = v.seq;
      v.players.forEach(p => { this.disp[p.id] = p.node; });
      this.layout();
      this.camera(false);
      return this.idle();
    }
    const C = LifeCore.CAREERS, fl = (id, txt, cls) => this.q.push({ k: 'float', id, txt, cls });
    for (const e of v.log) {
      if (e.n <= this.lastN) continue;
      this.lastN = e.n;
      switch (e.t) {
        case 'spin': this.q.push({ k: 'spin', v: e.v, why: e.why, id: e.id }); break;
        case 'walk': this.q.push({ k: 'walk', id: e.id, nodes: e.nodes }); break;
        case 'money': fl(e.id, (e.amt > 0 ? '+' : '') + Pieces.money(e.amt), e.amt > 0 ? 'gain' : 'loss'); break;
        case 'loan': fl(e.id, `대출 ${Pieces.money(e.amt)}`, 'loan'); break;
        case 'life': fl(e.id, '🌟 보람 카드', 'life'); break;
        case 'steal': fl(e.id, '🃏 카드 가져오기', 'life'); fl(e.from, '🃏 카드 뺏김', 'loss'); break;
        case 'dividend': fl(e.id, `📈 주식 ${e.v}번 배당`, 'gold'); break;
        case 'police': fl(e.id, '🚨 과속 단속!', 'loss'); break;
        case 'baby': fl(e.id, '👶'.repeat(e.k || 1), 'gold'); break;
        case 'pet': fl(e.id, '🐶 새 가족', 'gold'); break;
        case 'marry': fl(e.id, '💍 결혼!', 'gold'); break;
        case 'house': fl(e.id, '🏠 내 집!', 'gold'); break;
        case 'stock': fl(e.id, e.v ? `📈 주식 ${e.v}번` : '📉 휴지 조각', e.v ? 'gold' : 'loss'); break;
        case 'career': if (C[e.key]) fl(e.id, `${C[e.key].icon} ${C[e.key].name}`, 'gold'); break;
        case 'sell': fl(e.id, `🏠 매각 +${Pieces.money(e.price)}`, 'gain'); break;
        case 'retire': fl(e.id, e.estate === 'rich' ? '🏰 은퇴!' : '🌾 은퇴!', 'gold'); break;
        case 'reserve': (e.ids || []).forEach(id => fl(id, '🏰 보람 카드 4장!', 'gold')); break;
        case 'sue': fl(e.id, '⚖️ 승소!', 'gold'); break;
        case 'salary': { const p = v.players.find(x => x.id === e.id); if (p) fl(e.id, `월급 ${Pieces.money(p.salary)}`, 'gold'); break; }
        default: break;
      }
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
    const gen = this.gen, fast = this.q.length > 10 ? 0.35 : this.q.length > 5 ? 0.65 : 1;
    const done = ms => after(Math.round(ms * fast), () => { if (gen !== this.gen) return; this.busy = false; this.run(); });
    if (it.k === 'spin') { this.wheel(it.v, false, it.why); done(it.why && it.why !== 'move' ? 1400 : 1250); }
    else if (it.k === 'float') { this.float(it); done(110); }
    else if (it.k === 'walk') {
      const nodes = it.nodes.slice();
      const step = () => {
        if (gen !== this.gen) return;
        this.moveCar(it.id, nodes.shift());
        if (nodes.length) after(Math.round(170 * fast), step); else done(240);
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
    this.camera(true);
    this.msg(v.msg);
    this.side(v);
    const mine = v.turnId === ctx.me && !v.over, me = v.players.find(p => p.id === ctx.me), t = v.players.find(p => p.id === v.turnId);
    const hub = $('#lf-hub'), acts = $('#lf-acts');
    hub.classList.toggle('ready', mine && v.phase === 'spin');
    hub.disabled = !(mine && v.phase === 'spin');
    $('#lf-why').textContent = '';
    if (v.over) acts.innerHTML = '<span class="muted">게임 끝! 결과를 확인하세요</span>';
    else if (!mine) acts.innerHTML = `<span class="lf-wait"><i style="background:${t ? t.color : '#888'}"></i>${esc(t ? t.name : '')} 님 ${v.phase === 'spin' ? '차례' : '고르는 중'}…</span>`;
    else if (v.phase === 'spin') acts.innerHTML = `<button class="btn good lf-go" data-act="lfSpin">룰렛 돌리기<small>Space</small></button>`
      + (me.debt ? `<button class="btn ghost sm" data-act="lfDo" data-t="repay" ${me.money < 2500 ? 'disabled' : ''}>대출 갚기</button>` : '');
    else acts.innerHTML = '<span class="muted">위에서 골라 주세요</span>';
    this.decision(v, mine, me);
    if (this.sheetId) this.sheet(this.sheetId);
  },
  msg(text) { const m = $('#lf-msg'); m.textContent = text || ''; m.classList.remove('tip'); clearTimeout(this.tipT); },
  tip(text) {
    const m = $('#lf-msg'); m.textContent = text; m.classList.add('tip');
    clearTimeout(this.tipT); this.tipT = setTimeout(() => { if (this.v) this.msg(this.v.msg); }, 2800);
  },

  /* ── 고르기 창 ── */
  decision(v, mine, me) {
    const box = $('#lf-dec'), d = v.decision, m = this.money, C = LifeCore.CAREERS;
    if (!mine || !d || v.phase === 'spin') { box.classList.add('hidden'); return; }
    let title = '', body = '', foot = '';
    const k = d.kind;
    if (v.phase === 'fork') {
      title = '갈림길 — 어느 길로 갈까요?';
      body = `<div class="lf-cards">${d.options.map(o => `<button class="lf-card fork" style="--lc:${this.LANES[o.seg]}" data-act="lfDo" data-t="fork" data-to="${o.to}"><i class="stripe"></i><b>${esc(o.label)}</b><span>${esc(o.desc)}</span></button>`).join('')}</div>`;
    } else if (v.phase === 'career') {
      title = k === 'college' ? '🎓 졸업! 직업 카드를 고르세요' : k === 'grad' ? '🎓 대학원 졸업! 직업을 바꿀까요?' : k === 'change' ? '🔄 이직 기회! 옮길까요?' : '💼 첫 직장을 고르세요';
      body = `<div class="lf-cards">${d.options.map((o, i) => `<button class="lf-card job" data-act="lfDo" data-t="career" data-i="${i}"><i class="stripe"></i><em class="ic">${o.icon}</em><b>${esc(o.name)}</b>
        <span class="sal">${o.sal ? `월급 ${m(o.sal)}만` : '월급 = 룰렛 × 150만'}</span><span class="skill">${esc(o.skill)}</span></button>`).join('')}</div>`;
      if (d.keep && me.career) foot = `<button class="btn ghost" data-act="lfDo" data-t="keep">그대로 ${C[me.career].icon} ${C[me.career].name} (월급 ${me.career === 'youtuber' ? '룰렛' : m(me.salary) + '만'})</button>`;
    } else if (v.phase === 'house') {
      title = k === 'house2' ? '🏖️ 별장 · 이사 — 집을 하나 더 살까요?' : '🏠 내 집 마련 — 어떤 집을 살까요?';
      body = `<div class="lf-cards">${d.options.map((o, i) => `<button class="lf-card home" data-act="lfDo" data-t="house" data-i="${i}"><i class="stripe"></i><b>${esc(o.name)}</b>
        <span class="price">${m(o.price)}만</span><span>은퇴 때 룰렛으로 팔아요</span><span class="sell">1~5 → ${m(o.lo)}만<br>6~10 → ${m(o.hi)}만</span></button>`).join('')}</div>
        <button class="lf-ins ${this.ins ? 'on' : ''}" data-act="lfIns" type="button"><i></i>주택 보험 함께 들기 <small>(집값의 10% · 태풍 · 지진 수리비 0원)</small></button>`;
      foot = `<p class="lf-sub">내 현금 ${m(me.money)}만 · 모자라면 2,000만씩 자동 대출 (갚을 때 2,500만)${d.arch ? ` · 📐 건축가 ${esc(d.arch)} 님에게 설계비 10%` : ''}</p><button class="btn ghost" data-act="lfDo" data-t="skip">사지 않을래요</button>`;
    } else if (v.phase === 'stock') {
      title = '📈 주식 투자 — 숫자를 고르세요';
      const owner = n => v.players.find(p => p.stock === n);
      body = `<p class="lf-sub">${m(d.price)}만에 사면, 누가 그 숫자를 돌릴 때마다 <b>${m(d.pay)}만</b>씩 받아요 (은퇴한 뒤에도!)</p>
        <div class="lf-nums">${Array.from({ length: 10 }, (_, i) => { const n = i + 1, o = owner(n); return `<button class="lf-num" ${o ? `disabled style="--oc:${o.color}"` : ''} data-act="lfDo" data-t="stock" data-v="${n}">${n}${o ? `<small>${esc(o.name)}</small>` : ''}</button>`; }).join('')}</div>`;
      foot = `<p class="lf-sub">내 현금 ${m(me.money)}만</p><button class="btn ghost" data-act="lfDo" data-t="skip">안 살래요</button>`;
    } else if (v.phase === 'lucky') {
      title = '🎰 행운의 룰렛 — 숫자 하나를 고르세요';
      body = `<p class="lf-sub">룰렛이 그 숫자에 멈추면 <b>+${m(d.win)}만</b> · 아니면 -${m(d.lose)}만</p>
        <div class="lf-nums">${Array.from({ length: 10 }, (_, i) => `<button class="lf-num" data-act="lfDo" data-t="lucky" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>`;
      foot = '<button class="btn ghost" data-act="lfDo" data-t="skip">도전하지 않을래요</button>';
    } else if (v.phase === 'sue') {
      title = '⚖️ 소송 — 누구에게 걸까요?';
      body = `<p class="lf-sub">고른 사람에게서 ${m(d.amt)}만을 받아요${d.fee ? ` · 변호사 ${esc(d.lawyer)} 님 수임료 ${m(d.fee)}만` : ''}</p>
        <div class="lf-who">${d.options.map(o => { const p = v.players.find(x => x.id === o.id); return `<button class="lf-whobtn" style="--pc:${p ? p.color : '#888'}" data-act="lfDo" data-t="sue" data-id="${esc(o.id)}"><i></i><b>${esc(o.name)}</b><span>현금 ${m(p ? p.money : o.money)}만</span></button>`; }).join('')}</div>`;
    } else if (v.phase === 'retire') {
      title = '🏁 은퇴! 어디서 노후를 보낼까요?';
      const rich = d.rich && d.rich.length ? `<span class="rv">먼저 간 사람: ${d.rich.map(esc).join(', ')}</span>` : '';
      body = `<div class="lf-cards"><button class="lf-card estate rich" data-act="lfDo" data-t="retire" data-v="rich"><i class="stripe"></i><em class="ic">🏰</em><b>억만장자 저택</b>
          <span>끝날 때 여기서 <b>현금이 가장 많으면</b> 보람 카드 ${d.reserve || 4}장!</span><span>아니면 아무것도 없어요 · 카드를 뺏길 수 있어요</span>${rich}</button>
        <button class="lf-card estate farm" data-act="lfDo" data-t="retire" data-v="farm"><i class="stripe"></i><em class="ic">🌾</em><b>전원 마을</b>
          <span>보람 카드 1장을 바로 받아요</span><span>내 보람 카드를 아무도 못 가져가요</span></button></div>`;
      foot = `<p class="lf-sub">은퇴하면 집은 룰렛으로 팔고, 대출은 이자 25%를 붙여 갚아요 · 내 현금 ${m(me.money)}만${me.debt ? ` · 대출 ${m(me.debt)}만` : ''}</p>`;
    } else { box.classList.add('hidden'); return; }
    box.innerHTML = `<div class="lf-dec-in"><div class="lf-dec-t">${title}</div>${body}${foot}</div>`;
    box.classList.remove('hidden');
  },

  /* ── 참가자 패널 · 자세히 ── */
  tags(p, full) {
    const m = this.money, out = [];
    if (p.married) out.push('<span title="결혼">💍</span>');
    if (p.kids) out.push(`<span title="자녀">👶${p.kids}</span>`);
    if (p.pets) out.push(`<span title="반려동물">🐶${p.pets}</span>`);
    if (p.houses.length) out.push(`<span title="집">🏠${p.houses.length > 1 ? p.houses.length : ''}</span>`);
    if (p.stock) out.push(`<span title="주식">📈${p.stock}</span>`);
    out.push(`<span title="보람 카드">🌟${p.lifeN}${p.life ? ` · ${m(p.life.reduce((a, c) => a + c.v, 0))}` : ''}</span>`);
    if (p.debt) out.push(`<span class="debt" title="대출">빚 ${m(p.debt)}</span>`);
    return out.join(full ? ' ' : '');
  },
  side(v) {
    const m = this.money, C = LifeCore.CAREERS;
    $('#lf-players').innerHTML = v.players.map(p => {
      const changed = this.cash[p.id] != null && this.cash[p.id] !== p.money ? (p.money > this.cash[p.id] ? 'up' : 'down') : '';
      const c = p.career ? C[p.career] : null;
      const job = c ? `${c.icon} ${c.name} · ${p.career === 'youtuber' ? '룰렛×150' : m(p.salary) + '만'}` : '직업 없음';
      const badge = p.retired ? `<em>${p.estate === 'rich' ? '🏰' : '🌾'} ${p.rank}등 은퇴</em>` : '';
      return `<div class="lf-p ${p.id === v.turnId && !v.over ? 'turn' : ''} ${p.retired ? 'retired' : ''}" style="--pc:${p.color}" data-act="lfWho" data-id="${esc(p.id)}" role="button" tabindex="0">
        <div class="lf-p-top"><i class="dot"></i><b>${esc(p.name)}${p.id === this.ctx.me ? ' (나)' : ''}</b>${badge}</div>
        <div class="lf-p-money ${changed}">${v.over && p.total != null ? m(p.total) : m(p.money)}<small>${v.over ? '만 총점' : '만'}</small></div>
        <div class="lf-p-job">${job}</div><div class="lf-p-tags">${this.tags(p)}</div></div>`;
    }).join('');
    v.players.forEach(p => { this.cash[p.id] = p.money; });
  },
  sheet(id) {
    const v = this.v, p = v && v.players.find(x => x.id === id), box = $('#lf-sheet');
    if (!p) { box.classList.add('hidden'); this.sheetId = null; return; }
    this.sheetId = id;
    const m = this.money, C = LifeCore.CAREERS, c = p.career ? C[p.career] : null;
    const houses = p.houses.length ? p.houses.map(h => `<li>🏠 <b>${esc(h.name)}</b> ${m(h.price)}만 → 은퇴 때 ${m(h.lo)} / ${m(h.hi)}만 ${h.insured ? '<span class="ok">보험 ✓</span>' : '<span class="no">보험 없음</span>'}</li>`).join('') : '<li class="muted">아직 집이 없어요</li>';
    const cards = p.lifeN ? (p.life ? p.life.map(x => `<li>🌟 ${esc(x.t)} <b>${m(x.v)}만</b></li>`).join('') : p.lifeT.map(t => `<li>🌟 ${esc(t)} <span class="muted">— 값은 끝날 때 공개</span></li>`).join('')) : '<li class="muted">아직 없어요</li>';
    box.innerHTML = `<div class="lf-sheet-in" style="--pc:${p.color}">
      <div class="lf-sheet-h"><i class="dot"></i><b>${esc(p.name)}</b>${p.retired ? `<em>${p.estate === 'rich' ? '🏰 억만장자 저택' : '🌾 전원 마을'}</em>` : ''}<button class="lf-x" data-act="lfSheet" aria-label="닫기">✕</button></div>
      <div class="lf-sheet-money">현금 <b>${m(p.money)}만</b>${p.debt ? ` · 대출 <b class="bad">${m(p.debt)}만</b> (갚을 때 ${m(p.debt * 1.25)}만)` : ''}</div>
      <div class="lf-sheet-job">${c ? `<em>${c.icon}</em><div><b>${c.name}</b> · ${p.career === 'youtuber' ? '월급 = 룰렛 × 150만' : `월급 ${m(p.salary)}만`}${p.degree ? ' · 🎓 학위' : ''}<small>${esc(c.skill)}</small></div>` : '<div class="muted">아직 직업이 없어요</div>'}</div>
      <ul class="lf-sheet-l"><li>👪 가족: ${p.married ? '배우자 1' : '미혼'} · 자녀 ${p.kids} · 반려동물 ${p.pets} <span class="muted">(끝날 때 1명당 1,000만)</span></li>
        <li>📈 주식: ${p.stock ? `<b>${p.stock}번</b> — 누가 ${p.stock}을(를) 돌리면 +1,000만` : '없음'}</li>${houses}</ul>
      <div class="lf-sheet-c"><b>보람 카드 ${p.lifeN}장</b>${p.safe ? ' <span class="ok">🔒 지킴</span>' : ''}<ul>${cards}</ul></div></div>`;
    box.classList.remove('hidden');
  },

  /** 룰렛을 n 칸이 위(바늘)로 오게 돌리기 */
  wheel(n, instant, why) {
    const el = $('#lf-wheel'), hub = $('#lf-hub'), w = $('#lf-why');
    const target = n ? -(n - 1) * 36 : 0;
    if (instant) { this.wheelRot = target; el.style.transition = 'none'; el.style.transform = `rotate(${target}deg)`; void el.getBoundingClientRect(); el.style.transition = ''; hub.textContent = 'SPIN'; hub.classList.remove('big'); return; }
    const delta = (((target - this.wheelRot) % 360) + 360) % 360;
    this.wheelRot += 360 * 4 + delta;
    el.style.transform = `rotate(${this.wheelRot}deg)`;
    hub.textContent = '…'; hub.classList.remove('big');
    if (w) w.textContent = this.WHY[why] || '';
    const gen = this.gen;
    after(1150, () => { if (gen === this.gen) { hub.textContent = n; hub.classList.add('big'); } });
  },
  /** 자동차(사람 핀) 만들기 · 갱신 */
  cars(v) {
    const layer = $('#lf-cars'); if (!layer) return;
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
      const filled = [p.retired ? '#ffd700' : '#ffffff', p.married ? '#ff8fb1' : null,
        ...Array.from({ length: Math.min(4, p.kids) }, () => '#7fd3ff'), ...Array.from({ length: Math.min(4, p.pets) }, () => '#c8a165')];
      car.querySelector('.pegs').innerHTML = SEATS.map(([x, y], i) => filled[i] ? `<circle cx="${x}" cy="${y}" r="2.7" fill="${filled[i]}" stroke="rgba(0,0,0,.5)" stroke-width=".9"/>` : `<circle cx="${x}" cy="${y}" r="1.5" fill="rgba(0,0,0,.35)"/>`).join('');
      car.classList.toggle('turn', p.id === v.turnId && !v.over);
    });
  },
  moveCar(id, to) {
    const from = this.disp[id];
    if (from != null && from !== to) {
      const [ax, ay] = this.pos(from), [bx, by] = this.pos(to);
      let a = Math.atan2(by - ay, bx - ax) * 180 / Math.PI, c = this.ang[id] || 0;
      while (a - c > 180) a -= 360;
      while (a - c < -180) a += 360;
      this.ang[id] = a;
    }
    this.disp[id] = to;
    this.layout();
    if (!this.manual) this.camera(true, to);
    const tile = $(`#lf-tiles [data-i="${to}"]`);
    if (tile) { tile.classList.remove('hit'); void tile.getBoundingClientRect(); tile.classList.add('hit'); }
  },
  /** 같은 칸에 여러 대면 옆으로 비켜서 세워요 */
  layout() {
    const N = LifeCore.NODES, v = this.v; if (!v) return;
    const groups = {};
    v.players.forEach(p => { (groups[this.disp[p.id]] = groups[this.disp[p.id]] || []).push(p.id); });
    v.players.forEach(p => {
      const car = $(`#lf-cars [data-id="${CSS.escape(p.id)}"]`), i = this.disp[p.id], n = N[i];
      if (!car || !n) return;
      const [x, y] = this.pos(i);
      if (this.ang[p.id] == null) { const nx = n.next[0]; if (nx != null) { const [bx, by] = this.pos(nx); this.ang[p.id] = Math.atan2(by - y, bx - x) * 180 / Math.PI; } else this.ang[p.id] = 0; }
      const g = groups[i], k = g.indexOf(p.id), off = (k - (g.length - 1) / 2) * Math.min(17, 66 / g.length);
      car.style.transform = `translate(${x}px,${y}px) rotate(${this.ang[p.id]}deg) translate(${-k * 3}px,${off}px) scale(1.12)`;
    });
  },
  float(it) {
    const i = this.disp[it.id]; if (i == null) return;
    const [x, y] = this.pos(i);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('class', 'lf-float ' + it.cls); el.setAttribute('x', x); el.setAttribute('y', y - 30);
    el.textContent = it.txt;
    $('#lf-fx').append(el);
    setTimeout(() => el.remove(), 1600);
  },
};

/* ── 판 끌어서 둘러보기 · 칸 누르면 설명 ── */
(() => {
  const svg = $('#lf-board');
  let drag = null;
  svg.addEventListener('pointerdown', e => {
    if (!Life.vb) return;
    drag = { x: e.clientX, y: e.clientY, vb: Life.vb.slice(), moved: false, id: e.pointerId };
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    if (!Life.follow || Life.full) return;            // 전체가 보이면 끌 필요 없어요
    if (!drag.moved) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch { /* 무시 */ } }
    const st = $('#lf-stage'), k = drag.vb[2] / Math.max(1, st.clientWidth), [BW, BH] = Life.dims();
    const nx = Math.max(-60, Math.min(BW - drag.vb[2] + 60, drag.vb[0] - dx * k)), ny = Math.max(-60, Math.min(BH - drag.vb[3] + 60, drag.vb[1] - dy * k));
    Life.manual = true;
    Life.setVB([nx, ny, drag.vb[2], drag.vb[3]], 0);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const was = drag; drag = null;
    if (was.moved) return;
    const t = e.target.closest && e.target.closest('.lf-tile');
    if (t) { const n = LifeCore.NODES[+t.dataset.i]; if (n) Life.tip(Life.desc(n)); }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', () => { drag = null; });
})();
window.addEventListener('resize', () => { if (isScreen('life') && Life.v) Life.fitSoon(); });
window.addEventListener('orientationchange', () => setTimeout(() => { if (isScreen('life')) Life.fitSoon(); }, 250));
Object.assign(ACT, {
  lfSpin: () => { const v = Life.v, c = Life.ctx; if (!v || !c || Life.busy || v.turnId !== c.me || v.phase !== 'spin') return; c.send({ t: 'spin' }); },
  lfDo: el => {
    const c = Life.ctx; if (!c || Life.busy) return;
    const d = el.dataset, a = { t: d.t };
    if (d.to != null) a.to = +d.to;
    if (d.i != null) a.i = +d.i;
    if (d.v != null) a.v = /^\d+$/.test(d.v) ? +d.v : d.v;
    if (d.id != null) a.id = d.id;
    if (d.t === 'house') a.ins = !!Life.ins;
    if (d.t !== 'repay') $('#lf-dec').classList.add('hidden');
    c.send(a);
  },
  lfIns: el => { Life.ins = !Life.ins; el.classList.toggle('on', Life.ins); },
  lfCam: () => { Life.full = !Life.full; Life.manual = false; Life.orient(); Life.camera(true); },
  lfWho: el => { if (Life.sheetId === el.dataset.id) { Life.sheetId = null; $('#lf-sheet').classList.add('hidden'); } else Life.sheet(el.dataset.id); },
  lfSheet: () => { Life.sheetId = null; $('#lf-sheet').classList.add('hidden'); },
  lfSolo: el => {
    Life.soloBots = +el.dataset.bots;
    Table.solo('life', { bots: Life.soloBots });
    $$('#lf-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === Life.soloBots));
  },
});
Table.def('life', {
  core: LifeCore, render: (v, ctx, prev) => Life.render(v, ctx, prev), solo: { bots: 2 },
  key: (e, ctx) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && !$('#lf-dec').matches(':not(.hidden)')) { e.preventDefault(); ACT.lfSpin(); } },
});
$('#scr-life').dataset.fitSelf = '1';   // 판 크기를 스스로 재요 → 화면 맞춤(Fit)이 전체를 키우지 않게
