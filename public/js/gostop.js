/* =====================================================================
 *  🎴 고스톱 · 맞고 화면 (규칙: shared/gostop-core.js)
 *  내 차례: 손패를 누르면 바닥의 같은 달 패가 빛나요 → 한 번 더 누르면 내요 (마우스는 바로 내요).
 *  바닥 두 장 중 고르기 · 고/스톱 · 총통 · 흔들기/폭탄은 가운데 창에서 골라요.
 *  낸 패 → 바닥 → 먹은 패로 움직이는 모습을 짧게 보여줘요 (패마다 같은 data-id 로 전 · 후 위치를 비교).
 *  화투 그림: 한국 화투 그림 48장 (js/gostop-art.js · public/vendor/hwatu-1, CC BY-SA 4.0 — 光 표시 · 홍단 · 청단 글씨까지 그림 그대로)
 *    + 쌍피에만 작은 '쌍피' 표시.
 *  판 크기: 남은 높이(Fit.room)에 맞춰 먹은 패 · 바닥 · 손패 카드 크기를 계산해요
 *    (세로: 위에서부터 상대 · 바닥 · 나 · 손패 / 가로: 왼쪽은 사람마다 먹은 패를 크게, 오른쪽은 바닥 · 손패).
 *  먹은 패는 자리가 되면 두 줄(광 · 열끗 · 띠 / 피)로 크게 보여요. 기록은 안내 막대의 [기록] 버튼으로 열어요.
 * ===================================================================== */
makeScreen('gostop', {
  title: '🎴 고스톱', status: '손패를 내서 바닥의 같은 달 패를 먹어요. 맞고는 7점, 3인은 3점이 나면 고 또는 스톱!',
  stats: [['round', '판'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="gs-solo"><span class="muted small">상대</span>
      <button class="seg-btn on" data-act="gsSolo" data-bots="1">맞고 · AI 1명</button><button class="seg-btn" data-act="gsSolo" data-bots="2">3인 · AI 2명</button>
      <span class="muted small">판 수</span><button class="seg-btn gs-gap" data-act="gsRounds" data-r="3">3판</button><button class="seg-btn on" data-act="gsRounds" data-r="5">5판</button><button class="seg-btn" data-act="gsRounds" data-r="10">10판</button></div>
    <div class="gs-wrap" id="gs-wrap">
      <div class="gs-left"><div class="gs-opps" id="gs-opps"></div><div class="gs-mine" id="gs-mine"></div></div>
      <div class="gs-right"><div class="gs-table" id="gs-table"><div class="gs-floor" id="gs-floor"></div><div class="gs-fx" id="gs-fx"></div></div>
        <div class="gs-bar" id="gs-bar"></div><div class="gs-hand" id="gs-hand"></div></div>
      <div class="gs-log hidden" id="gs-log" role="dialog" aria-label="기록"></div>
      <div class="gs-dlg hidden" id="gs-dlg"></div>
    </div>`,
});

const GS = {
  bots: 1, rounds: 5, sel: null, confirm: null, peek: false, busyUntil: 0, slots: new Map(), round: -1, gen: null,
  evId: null, evShown: 0, dims: null, v: null, ctx: null,
  COL: ['#777', '#1f7a3a', '#c2185b', '#d94f86', '#4a2d6b', '#3949ab', '#c62828', '#8e24aa', '#37474f', '#b07d00', '#e64a19', '#6d4c41', '#00838f'],
  KORD: { gw: 0, yl: 1, tt: 2, pi: 3 },

  /** 화투 한 장. o: { cls, z(자리: h 손 · f 바닥 · c 먹은 패 · s 보여준 패 · p 고르는 중), st(추가 style), act } */
  card(id, o = {}) {
    const c = GostopCore.CARDS[id];
    if (!c) return '';
    const at = `data-id="${id}"${o.z ? ` data-z="${o.z}"` : ''}${o.act ? ` data-act="${o.act}" data-c="${id}" role="button" tabindex="0"` : ''}${o.extra || ''}`;
    const st = o.st ? `;${o.st}` : '';
    if (c.bonus) return `<div class="hw bonus ${o.cls || ''}" ${at} style="--mc:#bf360c${st}" title="${c.name}"><b class="bx">${c.bonus}</b><s class="t bl">보너스</s></div>`;
    if (typeof HwatuArt !== 'undefined') HwatuArt.preload();
    const mark = c.pi === 2 ? '<s class="t p2">쌍피</s>' : '';                       // 光은 그림에 그려져 있어요
    return `<div class="hw hwa art k-${c.kind}${c.pi === 2 ? ' ssang' : ''} ${o.cls || ''}" ${at} data-art="${id}" style="--mc:${this.COL[c.m]}${st}" title="${c.m}월 ${c.name}">${mark}</div>`;
  },
  back(cls = '') { return `<div class="hw back ${cls}"></div>`; },
  fmt: n => (n > 0 ? '+' : '') + n,
  name(j) { const v = this.v, p = v && v.players[j]; return p ? esc(p.name) + (j === v.seat ? ' (나)' : '') : '?'; },
  /** 손패 정렬: 달 → 광 · 열끗 · 띠 · 피 → 보너스는 끝 */
  sorted(ids) {
    const C = GostopCore.CARDS;
    return ids.slice().sort((a, b) => (C[a].m || 99) - (C[b].m || 99) || this.KORD[C[a].kind] - this.KORD[C[b].kind] || a - b);
  },
  myPlay() { const v = this.v; return !!v && !v.over && v.phase === 'play' && v.seat >= 0 && v.turn === v.seat && !!v.opts && Date.now() >= this.busyUntil; },
  still: () => matchMedia('(prefers-reduced-motion: reduce)').matches,

  /* ─────────────── 그리기 ─────────────── */
  render(v, ctx, prev) {
    const fresh = !prev || this.gen !== Table.cur;
    if (fresh) { this.gen = Table.cur; this.round = -1; this.evId = null; this.evShown = 0; this.peek = false; this.logOpen = false; this.watch(); }
    const newRound = v.round !== this.round;
    const before = !fresh && !newRound ? this.snap() : null;
    if (newRound) { this.slots = new Map(); this.sel = null; this.confirm = null; this.peek = false; this.round = v.round; }
    this.v = v; this.ctx = ctx; this.busyUntil = 0;
    if (!this.myPlay()) this.confirm = null;
    if (this.sel != null && !(v.seat >= 0 && v.players[v.seat].hand && v.players[v.seat].hand.includes(this.sel))) this.sel = null;
    if (v.phase !== 'summary' && !v.over) this.peek = false;
    $('#gs-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    setStat('gostop', 'round', `${v.round}/${v.rounds}`);
    const kind = this.dlgKind(v);
    if (kind !== this.kind) {
      this.kind = kind;
      const wait = fresh || this.still() ? 0 : { summary: 1200, gostop: 850, chongtong: newRound ? 900 : 300, choose: 380 }[kind] || 0;
      this.dlgAt = Date.now() + wait;
      if (wait) after(wait + 20, () => { if (this.kind === kind) this.paintDlg(); });
    }
    this.measure();
    this.paint();
    this.size();
    if (newRound && v.turnNo === 0 && v.played == null && !v.over) this.deal(); else if (before) this.animate(before, v);
    this.fx(v, fresh || newRound);
  },
  paint() {
    const v = this.v; if (!v) return;
    const n = v.players.length, seat = v.seat >= 0 ? v.seat : 0;
    const order = [];
    for (let k = 1; k < n; k++) order.push((seat + k) % n);
    $('#gs-opps').innerHTML = order.map(j => this.panel(j, false)).join('');
    $('#gs-mine').innerHTML = this.panel(seat, true);
    this.paintFloor();
    this.paintHand();
    this.paintBar();
    this.paintLog();
    this.paintDlg();
  },
  panel(j, bottom) {
    const v = this.v, p = v.players[j], turn = !v.over && v.phase !== 'summary' && v.turn === j;
    const tags = [];
    if (v.dealer === j) tags.push('<em class="tg dl" title="선 (먼저 치는 사람)">선</em>');
    if (p.go) tags.push(`<em class="tg go" title="${p.goScore}점에서 ${p.go}고">${p.go}고</em>`);
    if (p.shake) tags.push(`<em class="tg sh" title="흔들기 (점수 두 배)">흔들${p.shake > 1 ? '×' + p.shake : ''}</em>`);
    if (p.bomb) tags.push(`<em class="tg bm" title="폭탄 (점수 두 배)">폭탄${p.bomb > 1 ? '×' + p.bomb : ''}</em>`);
    if (p.ppuk) tags.push(`<em class="tg pp" title="이번 판 뻑 ${p.ppuk}번 (3번이면 승리)">뻑 ${p.ppuk}</em>`);
    const combo = [];
    const n = p.n, sc = p.sc;
    if (n.birds >= 2) combo.push(sc.godori ? '고도리' : `고도리 ${n.birds}/3`);
    for (const [k, label] of [['hong', '홍단'], ['cheong', '청단'], ['cho', '초단']]) if (n[k] >= 2) combo.push(sc[k] ? label : `${label} ${n[k]}/3`);
    const isMe = j === v.seat;
    const hand = !isMe ? `<span class="gs-hn" data-hand="${j}" title="손패 ${p.handN}장"><i></i>${p.handN}</span>` : '';
    const shown = !isMe && p.shown.length ? `<span class="gs-shown" title="흔들기로 보여 준 패">${p.shown.map(id => this.card(id, { cls: 'mini', z: 's' })).join('')}</span>` : '';
    const think = turn && p.bot ? '<i class="gs-think"></i>' : '';
    return `<div class="gs-pl${bottom ? ' me' : ''}${turn ? ' turn' : ''}" data-j="${j}">
      <div class="gs-ph"><span class="gs-nm"><b>${this.name(j)}</b>${p.bot ? '<small>AI</small>' : ''}</span>${think}${hand}${tags.join('')}${shown}
        ${combo.length ? `<span class="gs-combo">${combo.map(c => `<em>${c}</em>`).join('')}</span>` : ''}
        <span class="gs-sc"><b>${p.score}</b>점</span><span class="gs-tot ${p.total > 0 ? 'gs-pos' : p.total < 0 ? 'gs-neg' : ''}" title="누적 점수">${this.fmt(p.total)}</span></div>
      ${this.caps(p)}
    </div>`;
  },
  /** 먹은 패: 광 · 열끗 · 띠 · 피 묶음. 두 줄이면 윗줄 광 · 열끗 · 띠 / 아랫줄 피. 칸이 모자라면 겹치는 간격을 줄여요 (많은 묶음부터) */
  caps(p) {
    const C = GostopCore.CARDS, d = this.dims || { mw: 20, panelW: 360, rows: 1 };
    const g = { gw: [], yl: [], tt: [], pi: [] };
    for (const id of p.cap) { const c = C[id]; g[c.gukjin && p.gukPi ? 'pi' : c.kind].push(id); }
    for (const k in g) g[k].sort((a, b) => (C[a].m || 99) - (C[b].m || 99) || a - b);
    const mw = d.mw, gapG = Math.max(7, Math.round(mw * 0.22));
    const avail = Math.max(120, d.panelW - 18);
    const sp = {}, nat = mw * 0.6, min = mw * 0.13;                          // 자리가 넉넉하면 덜 겹쳐서 그림이 더 보여요
    const width = k => (g[k].length ? mw + (g[k].length - 1) * sp[k] : mw * 0.86);
    const fit = keys => {                                                     // 한 줄 안에 들어가게 겹치는 간격 줄이기
      for (const k of keys) sp[k] = nat;
      let over = keys.reduce((a, k) => a + width(k), 0) + gapG * (keys.length - 1) + 8 - avail;
      for (const k of keys.slice().sort((a, b) => g[b].length - g[a].length)) {
        if (over <= 0) break;
        const n = g[k].length - 1; if (n <= 0) continue;
        const cut = Math.min(over, n * (sp[k] - min));
        sp[k] -= cut / n; over -= cut;
      }
    };
    const lines = d.rows === 2 ? [['gw', 'yl', 'tt'], ['pi']] : [['gw', 'yl', 'tt', 'pi']];
    lines.forEach(fit);
    const n = p.n, sc = p.sc;
    const label = { gw: `광 ${n.gw}`, yl: `열 ${n.yl}`, tt: `띠 ${n.tt}`, pi: `피 ${n.pi}` };
    const done = { gw: sc.gw > 0, yl: sc.yl > 0 || sc.godori > 0, tt: sc.tt > 0 || sc.hong + sc.cheong + sc.cho > 0, pi: sc.pi > 0 };
    const group = k => {
      const ids = g[k];
      return `<div class="cg ${k}${ids.length ? '' : ' empty'}${done[k] ? ' done' : ''}" style="width:${Math.ceil(width(k))}px">${ids.map((id, i) => this.card(id, { cls: 'mini', z: 'c', st: `left:${(i * sp[k]).toFixed(1)}px` })).join('')}<i class="cgl">${label[k]}</i></div>`;
    };
    return `<div class="gs-caps${d.rows === 2 ? ' r2' : ''}" style="--cgap:${gapG}px">${lines.map(ks => `<div class="cr">${ks.map(group).join('')}</div>`).join('')}</div>`;
  },
  /** 바닥: 달마다 묶어서 자리를 지켜요 (먹혀서 빈 자리는 다음 새 달이 써요) */
  slotsFor(v) {
    const C = GostopCore.CARDS, months = new Set(v.floor.map(f => f.m));
    for (const x of v.pend || []) months.add(C[x.id].m);
    for (const m of [...this.slots.keys()]) if (!months.has(m)) this.slots.delete(m);
    const used = new Set(this.slots.values());
    for (const m of [...months].sort((a, b) => a - b)) {
      if (this.slots.has(m)) continue;
      let k = 0; while (used.has(k)) k++;
      this.slots.set(m, k); used.add(k);
    }
    return months;
  },
  paintFloor() {
    const v = this.v, C = GostopCore.CARDS;
    const months = this.slotsFor(v);
    const ask = v.ask && !v.ask.waiting && v.phase === 'choose' ? v.ask : null;
    const pick = new Set(ask ? ask.ids : []);
    const selM = this.sel != null ? C[this.sel].m : null;
    const groups = [...months].map(m => {
      const fg = v.floor.find(f => f.m === m) || { m, ids: [], stuck: null };
      const pend = (v.pend || []).filter(x => C[x.id].m === m);
      const ids = fg.ids;
      const cards = ids.map(id => this.card(id, { z: 'f', cls: pick.has(id) ? 'pick' : '', act: pick.has(id) ? 'gsTake' : '' })).join('')
        + pend.map(x => this.card(x.id, { z: 'p', cls: 'pend' })).join('');
      const stuck = fg.stuck != null ? `<em class="ppk" title="${fg.stuck === -1 ? '처음부터 깔린 같은 달 3장 (먹으면 피 1장씩)' : `${esc(v.players[fg.stuck].name)} 님이 싼 뻑`}">${fg.stuck === -1 ? '3장' : '뻑'}</em>` : '';
      return `<div class="fg n${ids.length}${selM === m && ids.length ? ' hl' : ''}" data-m="${m}" data-slot="${this.slots.get(m)}">${cards}${stuck}</div>`;
    });
    const stock = `<div class="gs-stock" id="gs-stock" title="더미 ${v.stock}장">${v.stock ? this.back('s1') + this.back('s2') + this.back('s3') : '<div class="hw empty"></div>'}<b>${v.stock}</b></div>`;
    $('#gs-floor').innerHTML = stock + groups.join('');
    this.cellsNeed = Math.max(-1, ...this.slots.values()) + 2;
  },
  paintHand() {
    const v = this.v, el = $('#gs-hand');
    if (v.seat < 0) { el.innerHTML = '<div class="gs-spec muted small">관전 중이에요</div>'; return; }
    const me = v.players[v.seat], C = GostopCore.CARDS;
    const mine = this.myPlay();
    const info = new Map(mine ? v.opts.cards.map(o => [o.c, o]) : []);
    const floorM = new Set(v.floor.map(f => f.m));
    const html = this.sorted(me.hand).map(id => {
      const o = info.get(id), c = C[id];
      const can = c.bonus || floorM.has(c.m);
      const cls = [can ? 'can' : 'no', this.sel === id ? 'sel' : '', mine ? 'live' : 'wait'];
      let badge = '';
      if (o && o.bomb) badge = '<em class="hb bm">폭탄</em>';
      else if (o && o.shake) badge = '<em class="hb sh">흔들기</em>';
      return this.card(id, { z: 'h', cls: cls.join(' '), act: 'gsCard' }).replace(/<\/div>$/, badge + '</div>');
    });
    if (me.flipOnly > 0) html.push(`<div class="hw flipc${mine ? ' live' : ''}" data-act="gsFlip" role="button" tabindex="0" title="폭탄을 해서 받은 차례: 손패를 내지 않고 더미만 뒤집어요"><b>뒤집기</b><small>${me.flipOnly}번</small></div>`);
    el.innerHTML = html.join('') || '<div class="gs-spec muted small">손패를 다 냈어요</div>';
  },
  paintBar() {
    const v = this.v, me = v.seat >= 0 ? v.players[v.seat] : null, C = GostopCore.CARDS;
    let msg = esc(v.msg), extra = '';
    const myTurn = me && !v.over && v.phase !== 'summary' && v.turn === v.seat;
    if (myTurn && v.phase === 'play') {
      if (this.sel != null) {
        const c = C[this.sel], m = v.floor.find(f => f.m === c.m);
        msg = c.bonus ? '보너스피: 바로 먹고 상대 피를 1장 가져와요. 한 번 더 누르면 내요.'
          : m ? `<b>${c.m}월</b> ${c.name} → 바닥 ${m.ids.length}장과 맞아요. 한 번 더 누르면 내요.` : `<b>${c.m}월</b> ${c.name}: 맞는 패가 없어서 바닥에 놓여요. 한 번 더 누르면 내요.`;
        extra = `<button class="btn sm good" data-act="gsCard" data-c="${this.sel}">내기</button>`;
      } else msg = '낼 패를 고르세요. <span class="muted">빛나는 패는 바닥에 같은 달이 있어요.</span>';
      msg = `<b class="gs-me-turn">내 차례</b> ${msg}`;
    } else if (myTurn && v.phase === 'choose') msg = '<b class="gs-me-turn">내 차례</b> 바닥의 두 장 중 가져올 패를 골라요.';
    else if (myTurn && v.phase === 'gostop') msg = `<b class="gs-me-turn">내 차례</b> ${v.ask ? v.ask.score : me.score}점! 고 또는 스톱을 골라요.`;
    else if (!v.over && v.phase !== 'summary' && v.players[v.turn]) {
      const who = esc(v.players[v.turn].name);
      msg = v.phase === 'gostop' ? `${who} 님이 고/스톱을 고르는 중…` : v.phase === 'choose' ? `${who} 님이 가져올 패를 고르는 중…` : v.phase === 'chongtong' ? `${who} 님 총통! 바로 끝낼지 고르는 중…` : msg;
    }
    if ((v.phase === 'summary' || v.over) && v.last && this.peek) extra = '<button class="btn sm good" data-act="gsPeek">결과 다시 보기</button>';
    const mult = v.nagari ? `<span class="gs-mult" title="나가리 다음 판은 점수가 두 배씩">×${2 ** Math.min(3, v.nagari)}</span>` : '';
    const logBtn = `<button class="gs-logbtn${this.logOpen ? ' on' : ''}" data-act="gsLog" title="지금까지 낸 패 · 먹은 패 기록" aria-label="기록" aria-expanded="${this.logOpen ? 'true' : 'false'}">${icon('list-details')}<span>기록</span></button>`;
    $('#gs-bar').innerHTML = `${mult}<span class="gs-msg">${msg}</span>${extra}${logBtn}`;
  },
  /** 기록: 안내 막대의 [기록] 버튼을 누르면 위에 작은 창으로 (판 위를 가리지 않게 평소엔 숨겨요) */
  paintLog() {
    const v = this.v, el = $('#gs-log');
    el.classList.toggle('hidden', !this.logOpen);
    if (!this.logOpen) { el.innerHTML = ''; return; }
    const C = GostopCore.CARDS, nm = j => (v.players[j] ? esc(v.players[j].name) : '?');
    const line = e => {
      switch (e.t) {
        case 'round': return `<b>${e.round}판 시작</b> · 선 ${nm(e.dealer)}${e.nagari ? ` · 나가리 ×${2 ** Math.min(3, e.nagari)}` : ''}`;
        case 'turn': {
          const a = e.hand != null ? `${C[e.hand].name} 냄` : e.bomb ? '폭탄' : '뒤집기만';
          const f = e.flip != null ? ` · ${C[e.flip].name} 뒤집음` : '';
          const sp = e.jjok ? ' · <b>쪽</b>' : e.ttadak ? ' · <b>따닥</b>' : e.ppuk ? ' · <b>뻑</b>' : '';
          return `${nm(e.who)}: ${a}${f}${e.take ? ` → ${e.take}장 먹음` : ''}${sp}`;
        }
        case 'go': return `${nm(e.who)} <b>${e.n}고</b>`;
        case 'stop': return `${nm(e.who)} <b>스톱</b>`;
        case 'shake': return `${nm(e.who)} ${e.m}월 <b>흔들기</b>`;
        case 'bomb': return `${nm(e.who)} ${e.m}월 <b>폭탄</b>`;
        case 'bonus': return `${nm(e.who)} 보너스피`;
        case 'ppuk': return `${nm(e.who)} 뻑 (${e.n}번째)`;
        case 'chongtong': return `${nm(e.who)} <b>총통</b> 승리`;
        case 'chongtong-go': return `${nm(e.who)} 총통을 들고 계속`;
        case 'ppuk3': return `${nm(e.who)} <b>3뻑</b> 승리`;
        case 'nagari': return '<b>나가리</b>';
        case 'redeal': return '바닥에 같은 달 4장 → 다시 돌림';
        default: return '';
      }
    };
    const rows = v.log.filter(e => e.t !== 'flipOnly').slice(-40).map(line).filter(Boolean);
    el.innerHTML = `<div class="gl-h"><b>기록</b><small class="muted">최근 ${rows.length}개</small><button class="gl-x" data-act="gsLog" aria-label="닫기">${icon('x')}</button></div>
      <div class="gl-b">${rows.map(h => `<div>${h}</div>`).join('') || '<div class="muted">아직 없어요</div>'}</div>`;
    // [기록] 버튼 바로 위에 띄워요 (버튼을 가리지 않게 · 위쪽 빈 곳만큼 높이)
    const btn = $('#gs-bar .gs-logbtn'), wrap = $('#gs-wrap');
    if (btn && wrap && wrap.offsetWidth) {
      const W = wrap.getBoundingClientRect(), B = btn.getBoundingClientRect(), k = W.width / wrap.offsetWidth || 1;
      el.style.top = 'auto';
      el.style.bottom = Math.round((W.bottom - B.top) / k + 6) + 'px';
      el.style.right = Math.round(Math.max(4, (W.right - B.right) / k)) + 'px';
      el.style.maxHeight = Math.round(Math.max(150, Math.min(420, (B.top - W.top) / k - 12))) + 'px';
    }
    const b = el.querySelector('.gl-b'); if (b) b.scrollTop = b.scrollHeight;               // 맨 아래가 최근
  },
  /** 지금 보여야 할 창 종류 */
  dlgKind(v) {
    if (v.phase === 'summary' || (v.over && v.last)) return 'summary';
    const ask = v.ask && !v.ask.waiting ? v.ask : null;
    return ask && ['choose', 'gostop', 'chongtong'].includes(v.phase) ? v.phase : '';
  },
  /** 가운데 창: 고르기 · 고/스톱 · 총통 · 흔들기/폭탄 확인 · 판 결과 */
  paintDlg() {
    const v = this.v, el = $('#gs-dlg'); if (!v) return;
    let html = '';
    if (Date.now() < (this.dlgAt || 0) && this.kind) { el.innerHTML = ''; el.classList.add('hidden'); return; }
    const ask = v.ask && !v.ask.waiting ? v.ask : null;
    if (v.phase === 'summary' || (v.over && v.last)) html = this.peek ? '' : this.summary();
    else if (ask && v.phase === 'choose') {
      html = `<div class="gs-box"><h3>가져올 패를 골라요</h3><p class="muted small">${ask.from === 'hand' ? '낸 패' : '뒤집은 패'}: ${GostopCore.CARDS[ask.card].name}</p>
        <div class="gs-pick">${ask.ids.map(id => `<button class="gs-pk" data-act="gsTake" data-c="${id}">${this.card(id, { cls: 'big' })}<small>${GostopCore.CARDS[id].name}</small></button>`).join('')}</div></div>`;
    } else if (ask && v.phase === 'gostop') {
      const me = v.players[v.seat], go = me.go + 1;
      const goTxt = go >= 3 ? `${go}고: +${go}점 · 점수 ×${2 ** (go - 2)}` : `${go}고: +${go}점`;
      html = `<div class="gs-box"><h3>${ask.score}점 났어요! 고? 스톱?</h3>
        <p class="small">스톱하면 지금 <b>+${ask.value}점</b>을 받고 이 판이 끝나요.</p>
        <p class="small muted">고 하면 ${goTxt} — 다음에 점수가 더 나야 해요. 그 전에 상대가 먼저 나면 <b>고박</b>!</p>
        <div class="gs-btns"><button class="btn good" data-act="gsGo">${go}고!</button><button class="btn" data-act="gsStop">스톱 (+${ask.value})</button></div></div>`;
    } else if (ask && v.phase === 'chongtong') {
      html = `<div class="gs-box"><h3>총통! (${ask.m}월 4장)</h3><p class="small">처음 받은 패에 같은 달 4장이 있어요. 바로 이기면 <b>${v.mode === 'matgo' ? 7 : 5}점</b>${v.nagari ? ` × ${2 ** Math.min(3, v.nagari)}` : ''}을 받아요.</p>
        <div class="gs-btns"><button class="btn good" data-act="gsCt" data-end="1">바로 이기기</button><button class="btn" data-act="gsCt" data-end="0">계속 치기</button></div></div>`;
    } else if (this.confirm && this.myPlay()) {
      const c = this.confirm, m = GostopCore.CARDS[c.c].m;
      html = c.t === 'bomb'
        ? `<div class="gs-box"><h3>폭탄!</h3><p class="small">${m}월 3장을 한꺼번에 내서 바닥의 ${m}월까지 4장을 먹어요. 상대 피 1장을 가져오고 점수가 <b>두 배</b>, 다음 두 번은 뒤집기만 해도 돼요.</p>
            <div class="gs-btns"><button class="btn good" data-act="gsOk" data-k="bomb">폭탄 (3장)</button><button class="btn" data-act="gsOk" data-k="one">한 장만 내기</button><button class="btn ghost" data-act="gsNo">취소</button></div></div>`
        : `<div class="gs-box"><h3>흔들까요?</h3><p class="small">${m}월 3장을 상대에게 보여 주고 내요. 이 판에 내가 나면 점수가 <b>두 배</b>예요.</p>
            <div class="gs-btns"><button class="btn good" data-act="gsOk" data-k="shake">흔들고 내기</button><button class="btn" data-act="gsOk" data-k="one">그냥 내기</button><button class="btn ghost" data-act="gsNo">취소</button></div></div>`;
    }
    el.innerHTML = html;
    el.classList.toggle('hidden', !html);
    this.tickCd();
  },
  summary() {
    const v = this.v, L = v.last; if (!L) return '';
    const rows = [];
    let head;
    if (L.kind === 'nagari') head = `<h3>나가리!</h3><p class="small">아무도 점수를 내지 못했어요. 다음 판은 <b>${L.next}배</b>예요.</p>`;
    else {
      const how = { stop: '스톱', chongtong: '총통', ppuk3: '3뻑' }[L.kind] || '';
      const win = L.winner === v.seat;
      head = `<h3 class="${win ? 'gs-pos' : ''}">${this.name(L.winner)} ${how}! ${win ? '🎉' : ''}</h3>`;
      if (L.breakdown) {
        const b = L.breakdown, it = [];
        for (const [k, lb] of [['gw', '광'], ['yl', '열끗'], ['godori', '고도리'], ['tt', '띠'], ['hong', '홍단'], ['cheong', '청단'], ['cho', '초단'], ['pi', '피']]) if (b[k]) it.push(`<span>${lb} <b>${b[k]}</b></span>`);
        if (b.go) it.push(`<span>${b.go}고 <b>+${b.go}</b></span>`);
        rows.push(['점수', `${it.join('')}<span class="eq">= <b>${L.base}점</b></span>`]);
      } else rows.push(['점수', `<span>${how} <b>${L.base}점</b></span>`]);
      if (L.mults.length) rows.push(['배수', L.mults.map(m => `<span>${esc(m.label)}</span>`).join('')]);
      rows.push(['낸 점수', L.pays.map(x => `<span>${this.name(x.i)} <b class="gs-neg">${x.amount ? '−' + x.amount : '0'}</b>${x.flags.length ? ` <em>${x.flags.join(' · ')}</em>` : ''}</span>`).join('')]);
      head += `<div class="gs-sum-total">${this.name(L.winner)} <b>+${L.total}점</b></div>`;
    }
    const tot = v.players.map((p, i) => `<span>${this.name(i)} <b class="${p.total > 0 ? 'gs-pos' : p.total < 0 ? 'gs-neg' : ''}">${this.fmt(p.total)}</b></span>`).join('');
    rows.push(['누적', tot]);
    const last = v.over || (v.round >= v.rounds && (L.kind !== 'nagari' || v.round >= v.rounds + 2));
    const me = v.seat >= 0 ? v.players[v.seat] : null;
    const ready = me && v.ready.includes(me.id);
    const waiting = v.players.filter(p => !p.bot && !v.ready.includes(p.id) && (!me || p.id !== me.id)).map(p => esc(p.name));
    let foot = '';
    if (v.over) foot = '<p class="small muted">게임이 끝났어요. 잠시 뒤 결과가 나와요.</p>';
    else if (me && !ready) foot = `<div class="gs-btns"><button class="btn good" data-act="gsNext">${last ? '결과 보기' : '다음 판'}</button><button class="btn ghost" data-act="gsPeek">판 보기</button></div>`;
    else foot = `<p class="small muted">${me ? '준비 완료! ' : ''}${waiting.length ? `${waiting.join(', ')} 님을 기다려요.` : ''}</p><div class="gs-btns"><button class="btn ghost" data-act="gsPeek">판 보기</button></div>`;
    if (v.summaryEnd && !v.over) foot += '<p class="small muted gs-cd" id="gs-cd"></p>';
    return `<div class="gs-box gs-sum"><small class="muted">${v.round}판 결과${v.mode === 'matgo' ? ' · 맞고' : ' · 3인 고스톱'}</small>${head}
      <div class="gs-sum-rows">${rows.map(([k, h]) => `<div class="gs-sum-row"><small>${k}</small><div>${h}</div></div>`).join('')}</div>${foot}</div>`;
  },
  tickCd() {
    const el = $('#gs-cd'), v = this.v;
    if (!el || !v || !v.summaryEnd) return;
    const s = Math.max(0, Math.ceil((v.summaryEnd - serverNow()) / 1000));
    el.textContent = `${s}초 뒤 ${v.round >= v.rounds ? '결과로' : '다음 판으로'} 넘어가요`;
  },

  /* ─────────────── 크기 맞추기 ─────────────── */
  /** 화면 크기만 보고 정해요: 세로/가로 배치 · 먹은 패 크기 */
  measure() {
    const sec = $('#scr-gostop'), wrap = $('#gs-wrap');
    if (!sec || !wrap || !sec.classList.contains('active')) return false;
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' && Fit.room ? Fit.room(sec) : window.innerHeight - sec.getBoundingClientRect().top;
    const top = (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const H = Math.max(300, Math.floor(room - top - 3));
    const PW = (wrap.parentElement && wrap.parentElement.clientWidth) || sec.clientWidth;   // 판이 쓸 수 있는 너비 (판 최대 너비와 상관없이)
    const side = PW >= 600 && Math.min(PW, 1320) / H >= 1.3;
    const W = Math.min(PW, side ? 1320 : 860);
    const gap = W < 420 ? 5 : 7;
    const nP = this.v ? this.v.players.length : 2;
    const head = W < 420 ? 21 : 23, pad = 24;                                 // 사람 칸의 이름 줄 · 위아래 여백 · 테두리 · 줄 사이 (넉넉히)
    let lw = 0, panelW, mw, rows;
    if (side) {
      // 가로 화면: 왼쪽 칸 전체를 사람마다 똑같이 나눠 먹은 패를 크게 (기록 칸은 없어요)
      lw = Math.round(Math.min(600, Math.max(300, W * 0.42)));
      panelW = lw;
      const capH = (H - (nP - 1) * gap) / nP - head - pad;
      [rows, mw] = this.pickRows(capH, panelW, 7, 12, 84);                    // 칸 높이를 채우게 (넓이가 모자라면 겹쳐서 맞춰요)
    } else {
      // 세로 화면: 먹은 패 칸이 판 높이의 44% 안에서 되도록 크게 (자리가 되면 두 줄)
      panelW = Math.min(W, 860);
      const capH = (H * 0.44) / nP - head - pad;
      [rows, mw] = this.pickRows(capH, panelW, 10.5, 16.5, 60);
    }
    mw = Math.round(Math.max(13, mw));
    this.dims = { W, H, side, gap, lw, panelW, mw, rows };
    wrap.style.height = H + 'px';
    wrap.classList.toggle('side', side);
    wrap.style.setProperty('--lw', lw + 'px');
    wrap.style.setProperty('--mw', mw + 'px');
    wrap.style.setProperty('--gap', gap + 'px');
    return true;
  },
  /** 먹은 패: 두 줄(광 · 열끗 · 띠 / 피)과 한 줄 중 카드가 더 크게 보이는 쪽 (비슷하면 두 줄 — 피가 많아져도 덜 겹쳐요)
   *  capH = 카드 칸 높이 · W = 사람 칸 너비 · n2 · n1 = 한 줄에 필요한 카드 너비 수 · max = 가장 큰 카드 너비 */
  pickRows(capH, W, n2, n1, max) {
    const two = Math.min((capH - 5) / 2 / 1.6, (W - 20) / n2, max);
    const one = Math.min(capH / 1.6, (W - 20) / n1, max);
    return two >= 14 && two >= one * 0.85 ? [2, two] : [1, one];
  },
  /** 남은 칸에 바닥 · 손패 카드 크기를 맞춰요 (손패는 한 줄 또는 두 줄) */
  size() {
    const d = this.dims, v = this.v; if (!d || !v) return;
    const wrap = $('#gs-wrap');
    const bar = $('#gs-bar').offsetHeight;
    let R, FW;
    if (d.side) { R = d.H - bar - d.gap * 2; FW = d.W - d.lw - 12; }
    else { R = d.H - $('#gs-opps').offsetHeight - $('#gs-mine').offsetHeight - bar - d.gap * 4; FW = Math.min(d.W, 860); }
    const me = v.seat >= 0 ? v.players[v.seat] : null;
    const nHand = me ? Math.max(v.mode === 'matgo' ? 10 : 7, me.hand.length + (me.flipOnly > 0 ? 1 : 0)) : 0;
    const cells = Math.min(13, Math.max(this.cellsNeed || 1, v.mode === 'matgo' ? 9 : 7));
    let best = null;
    if (!nHand) {
      const f = this.floorFit(FW, R - 30, cells);
      if (f) best = { hw: 0, rows: 0, per: 1, hh: 30, ...f };
    }
    for (let rows = 1; rows <= 2 && nHand; rows++) {
      const per = Math.ceil(nHand / rows);
      const maxW = Math.floor((FW - 8 - (per - 1) * 6) / per);
      for (let hw = Math.min(92, maxW); hw >= 22; hw--) {
        const hh = rows * hw * 1.6 + (rows - 1) * 6 + Math.round(hw * 0.22) + 2;
        const f = this.floorFit(FW, R - hh, cells);
        if (!f) continue;
        const score = Math.min(hw, f.fw / 0.84);
        if (!best || score > best.score + 0.01) best = { score, hw, rows, per, hh, ...f };
      }
    }
    if (!best) best = { hw: 24, rows: 1, per: Math.max(1, nHand), hh: 50, fw: 20, C: Math.min(cells, 7), R: Math.ceil(cells / Math.min(cells, 7)) };
    wrap.style.setProperty('--hw', best.hw + 'px');
    wrap.style.setProperty('--fw', best.fw + 'px');
    const hand = $('#gs-hand');
    hand.style.height = Math.floor(best.hh) + 'px';
    const have = me ? me.hand.length + (me.flipOnly > 0 ? 1 : 0) : 0;      // 남은 패가 적으면 가운데로 모아요
    const used = Math.max(1, Math.ceil(have / best.per));                    // 두 줄이면 줄마다 고르게 (6장 → 3 · 3)
    hand.style.setProperty('--hc', Math.max(1, Math.ceil(have / used)));
    // 바닥 칸 배치: 더미는 가운데, 달 묶음은 자리 번호 순서대로 (더미 칸은 건너뛰어요)
    const fl = $('#gs-floor');
    fl.style.setProperty('--fc', best.C); fl.style.setProperty('--fr', best.R);
    const st = (Math.floor((best.R - 1) / 2)) * best.C + Math.floor((best.C - 1) / 2);
    const place = (el, idx) => { el.style.gridRow = String(Math.floor(idx / best.C) + 1); el.style.gridColumn = String((idx % best.C) + 1); };
    place($('#gs-stock'), st);
    for (const g of $$('#gs-floor .fg')) { const k = +g.dataset.slot; place(g, k < st ? k : k + 1); }
  },
  floorFit(W, H, cells) {
    if (H < 46) return null;
    let b = null;
    for (let C = 1; C <= cells; C++) {
      const R = Math.ceil(cells / C);
      if (R > 4) continue;
      const fw = Math.floor(Math.min(80, (W - 12 - (C - 1) * 6) / C / 1.76, (H - 14 - (R - 1) * 10) / R / 1.6));
      if (!b || fw > b.fw) b = { fw, C, R };
    }
    return b && b.fw >= 18 ? b : null;
  },
  /** 화면 크기가 바뀌면 다시 맞춰요 (휴대폰 회전 · 채팅 열기 · 창 크기) */
  watch() {
    if (this.watching) return;
    this.watching = true;
    const again = () => { if (S.screen !== 'gostop' || !this.v) return; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => { if (this.measure()) { this.paint(); this.size(); } }); };
    window.addEventListener('resize', again);
    window.addEventListener('orientationchange', () => setTimeout(again, 250));
    if (typeof ResizeObserver !== 'undefined') {
      let lastW = 0;
      const ro = new ResizeObserver(() => { const w = $('#gs-wrap').clientWidth; if (Math.abs(w - lastW) > 1) { lastW = w; again(); } });
      ro.observe($('#gs-wrap'));
      const head = $('#scr-gostop .game-head');
      let lastH = 0;
      const ro2 = new ResizeObserver(() => { const h = head.offsetHeight; if (Math.abs(h - lastH) > 1) { lastH = h; again(); } });
      if (head) ro2.observe(head);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  },

  /* ─────────────── 움직임 ─────────────── */
  snap() {
    const cards = new Map();
    for (const el of $$('#gs-wrap [data-id]')) {
      if (el.closest('#gs-dlg')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0) cards.set(el.dataset.id, { r, z: el.dataset.z });
    }
    const hands = {};
    for (const el of $$('#gs-wrap [data-hand]')) hands[el.dataset.hand] = el.getBoundingClientRect();
    const st = $('#gs-stock .hw');
    return { cards, stock: st ? st.getBoundingClientRect() : null, hands };
  },
  /** 전 · 후 위치를 비교해서 패가 날아가게 해요: 낸 패(0~0.3초) → 뒤집은 패(0.3~0.6초) → 먹은 패가 내 쪽으로(0.65~1초) → 뺏은 피(1~1.4초) */
  animate(B, v) {
    if (this.still() || !B) return;
    const C = GostopCore.CARDS, S2 = x => String(x);
    const played = new Set((v.played || []).map(S2));
    const flips = new Set([v.flipped, ...v.events.filter(e => e.t === 'bonus' && e.flip).map(e => e.id)].filter(x => x != null).map(S2));
    const stolen = new Set(v.events.filter(e => e.t === 'steal').flatMap(e => e.ids).map(S2));
    const meet = new Map();
    for (const [id, o] of B.cards) if (o.z === 'f' || o.z === 'p') meet.set(C[+id].m, o.r);
    const T = 1100, ease = 'cubic-bezier(.25,.75,.3,1)';
    let moved = 0, captured = 0;
    for (const el of $$('#gs-wrap [data-id]')) {
      if (el.closest('#gs-dlg')) continue;
      const id = el.dataset.id, now = el.getBoundingClientRect(), z = el.dataset.z;
      if (!now.width) continue;
      const old = B.cards.get(id);
      const isPlay = played.has(id), isFlip = flips.has(id);
      let from = old && old.r, reveal = false;
      if (!from) {
        if (isFlip && B.stock) { from = B.stock; reveal = true; }
        else if (isPlay && v.mover != null && B.hands[v.mover]) { const h = B.hands[v.mover]; from = { left: h.left, top: h.top - now.height * 0.3, width: now.width * 0.6, height: now.height * 0.6 }; reveal = true; }
        else continue;
      }
      if (Math.abs(from.left - now.left) < 1 && Math.abs(from.top - now.top) < 1 && Math.abs(from.width - now.width) < 1) continue;
      const tf = (r, k = 1) => `translate(${(r.left - now.left).toFixed(1)}px, ${(r.top - now.top).toFixed(1)}px) scale(${(r.width / now.width * k).toFixed(3)}, ${(r.height / now.height).toFixed(3)})`;
      const toCaps = z === 'c', mp = meet.get(C[+id].m);
      let frames, dur = T;
      if (isPlay || isFlip) {
        const t0 = isFlip ? 0.27 : 0, t1 = isFlip ? 0.53 : 0.27;
        const start = reveal ? tf(from, 0.08) : tf(from);
        if (toCaps && mp && !(old && (old.z === 'f' || old.z === 'p'))) {
          const at = { left: mp.left + mp.width * 0.22, top: mp.top - mp.height * 0.06, width: mp.width, height: mp.height };
          frames = [{ transform: start, offset: 0 }, { transform: start, offset: t0, easing: ease }, { transform: tf(at), offset: t1 }, { transform: tf(at), offset: 0.6, easing: ease }, { transform: 'none', offset: 0.93 }, { transform: 'none', offset: 1 }];
        } else if (toCaps) {
          frames = [{ transform: start, offset: 0 }, { transform: tf(from), offset: Math.max(t0, 0.6), easing: ease }, { transform: 'none', offset: 0.93 }, { transform: 'none', offset: 1 }];
        } else frames = [{ transform: start, offset: 0 }, { transform: start, offset: t0, easing: ease }, { transform: 'none', offset: Math.min(1, t1 + 0.03) }, { transform: 'none', offset: 1 }];
      } else if (stolen.has(id)) {
        frames = [{ transform: tf(from), offset: 0 }, { transform: tf(from), offset: 0.7, easing: ease }, { transform: 'none', offset: 1 }];
        dur = 1450;
      } else if (toCaps && old && (old.z === 'f' || old.z === 'p')) {
        frames = [{ transform: tf(from), offset: 0 }, { transform: tf(from), offset: 0.6, easing: ease }, { transform: 'none', offset: 0.93 }, { transform: 'none', offset: 1 }];
        captured++;
      } else { frames = [{ transform: tf(from), easing: ease }, { transform: 'none' }]; dur = 260; }
      el.style.zIndex = isPlay || isFlip ? '60' : stolen.has(id) ? '55' : '40';
      for (const f of frames) f.transformOrigin = '0 0';              // 왼쪽 위 기준으로 재서 옮겨요 (크기가 다른 자리 사이에서도 정확히)
      try {
        const a = el.animate(frames, { duration: dur, easing: 'linear', fill: 'backwards' });
        a.onfinish = a.oncancel = () => { el.style.zIndex = ''; };
      } catch { el.style.zIndex = ''; }
      moved++;
    }
    if (moved && played.size) Sound.play('tap');
    if (captured || (v.lastTake && v.lastTake.length)) after(640, () => Sound.play('tap'));
  },
  /** 새 판: 더미에서 손패 · 바닥으로 돌리는 모습 */
  deal() {
    if (this.still()) return;
    const st = $('#gs-stock .hw'); if (!st) return;
    const s = st.getBoundingClientRect();
    let k = 0;
    for (const el of $$('#gs-wrap [data-z=f], #gs-wrap [data-z=h]')) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const tf = `translate(${(s.left - r.left).toFixed(1)}px, ${(s.top - r.top).toFixed(1)}px) scale(${(s.width / r.width).toFixed(3)})`;
      try { el.animate([{ transform: tf, opacity: 0.6, transformOrigin: '0 0' }, { transform: 'none', opacity: 1, transformOrigin: '0 0' }], { duration: 300, delay: k * 32, easing: 'cubic-bezier(.25,.75,.3,1)', fill: 'backwards' }); } catch { /* 무시 */ }
      k++;
    }
  },
  /** 쪽 · 뻑 · 따닥 · 판쓸 · 폭탄 · 흔들기 · 고 같은 일을 큰 글씨로 */
  fx(v, quiet) {
    if (v.evId !== this.evId) { this.evId = v.evId; this.evShown = 0; }
    const list = v.events.slice(this.evShown);
    this.evShown = v.events.length;
    if (quiet) return;
    let t = Math.max(0, (this.fxFree || 0) - Date.now());          // 앞 차례 글씨가 아직 떠 있으면 그다음에 (겹치지 않게)
    for (const e of list) {
      const who = e.who === v.seat ? '' : (v.players[e.who] || {}).name || '';
      let txt = '', sub = who, at = 0, cls = e.who === v.seat ? 'me' : '';
      switch (e.t) {
        case 'jjok': txt = '쪽!'; at = 620; break;
        case 'ttadak': txt = '따닥!'; at = 620; break;
        case 'ppuk': txt = e.n >= 2 ? `뻑! (${e.n}번째)` : '뻑!'; at = 620; cls += ' bad'; break;
        case 'sweep': txt = '판쓸!'; at = 900; break;
        case 'bomb': txt = '폭탄!'; at = 120; break;
        case 'shake': txt = '흔들기!'; break;
        case 'bonus': txt = '보너스피!'; at = e.flip ? 520 : 80; break;
        case 'steal': txt = `피 ${e.ids.length}장 가져오기`; sub = [who, e.why].filter(Boolean).join(' · '); at = 1000; cls += ' small'; break;
        case 'go': txt = `${e.n}고!`; cls += ' go'; break;
      }
      if (!txt) continue;
      const when = Math.max(at, t); t = when + 430;
      this.fxFree = Date.now() + t;
      after(when, () => this.flash(txt, sub, cls));
    }
  },
  flash(txt, sub, cls) {
    const box = $('#gs-fx'); if (!box || S.screen !== 'gostop') return;
    for (const o of box.children) o.classList.add('gone');            // 앞 글씨는 얼른 비켜요
    const el = document.createElement('div');
    el.className = 'fxt ' + (cls || '');
    el.innerHTML = `${esc(txt)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    box.append(el);
    setTimeout(() => el.remove(), 1300);
    Sound.play('pop');
  },

  /* ─────────────── 누르기 ─────────────── */
  send(a) {
    if (!this.ctx) return;
    this.busyUntil = Date.now() + 1200;
    this.sel = null;
    this.ctx.send(a);
  },
  tapCard(c) {
    const v = this.v; if (!v || v.seat < 0) return;
    if (!this.myPlay()) {                                   // 내 차례가 아니면 맞는 바닥 패만 보여줘요
      this.sel = this.sel === c ? null : c;
      this.paintFloor(); this.paintHand(); this.paintBar(); this.size();
      return;
    }
    const o = v.opts.cards.find(x => x.c === c); if (!o) return;
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!mouse && this.sel !== c) { this.sel = c; this.paintFloor(); this.paintHand(); this.paintBar(); this.size(); return; }
    this.sel = null;
    if (o.bomb) { this.confirm = { t: 'bomb', c }; return this.paintDlg(); }
    if (o.shake) { this.confirm = { t: 'shake', c }; return this.paintDlg(); }
    this.send({ t: 'play', c });
  },
  /** 마우스를 올리면 맞는 바닥 패가 빛나요 */
  hover(c) {
    const m = c == null ? null : GostopCore.CARDS[c].m;
    for (const g of $$('#gs-floor .fg')) g.classList.toggle('hv', m != null && +g.dataset.m === m);
  },
  soloStart() {
    $$('#gs-solo [data-act=gsSolo]').forEach(b => b.classList.toggle('on', +b.dataset.bots === this.bots));
    $$('#gs-solo [data-act=gsRounds]').forEach(b => b.classList.toggle('on', +b.dataset.r === this.rounds));
    Table.defs.gostop.solo = { bots: this.bots, opts: { rounds: this.rounds, solo: true } };
    Table.solo('gostop');
  },
};
Object.assign(ACT, {
  gsSolo: el => { GS.bots = +el.dataset.bots; GS.soloStart(); },
  gsLog: () => { GS.logOpen = !GS.logOpen; GS.paintLog(); GS.paintBar(); },
  gsRounds: el => { GS.rounds = +el.dataset.r; GS.soloStart(); },
  gsCard: el => GS.tapCard(+el.dataset.c),
  gsFlip: () => { if (GS.myPlay()) GS.send({ t: 'flip' }); },
  gsTake: el => { const v = GS.v; if (v && v.phase === 'choose' && v.ask && !v.ask.waiting) GS.send({ t: 'take', c: +el.dataset.c }); },
  gsGo: () => GS.send({ t: 'go' }),
  gsStop: () => GS.send({ t: 'stop' }),
  gsCt: el => GS.send({ t: 'chongtong', end: el.dataset.end === '1' }),
  gsOk: el => {
    const c = GS.confirm; GS.confirm = null;
    if (!c || !GS.myPlay()) return GS.paintDlg();
    if (el.dataset.k === 'bomb') GS.send({ t: 'bomb', m: GostopCore.CARDS[c.c].m });
    else GS.send({ t: 'play', c: c.c, shake: el.dataset.k === 'shake' || undefined });
  },
  gsNo: () => { GS.confirm = null; GS.paintDlg(); },
  gsNext: () => GS.send({ t: 'next' }),
  gsPeek: () => { GS.peek = !GS.peek; GS.paintBar(); GS.paintDlg(); GS.size(); },
});
document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('#gs-hand .hw[data-c]'); if (el) GS.hover(+el.dataset.c); });
document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('#gs-hand .hw[data-c]'); if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) GS.hover(null); });
setInterval(() => { if (S.screen === 'gostop') GS.tickCd(); }, 250);
// 기록 창: 바깥을 누르면 닫혀요 (누른 패는 그대로 낼 수 있어요) · Esc 로도 닫아요 · 새 게임은 닫힌 채로 시작
document.addEventListener('pointerdown', e => {
  if (!GS.logOpen || (e.target.closest && e.target.closest('#gs-log, .gs-logbtn'))) return;
  GS.logOpen = false; GS.paintLog(); GS.paintBar();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && GS.logOpen) { GS.logOpen = false; GS.paintLog(); GS.paintBar(); } });
Table.def('gostop', { core: GostopCore, render: (v, ctx, prev) => GS.render(v, ctx, prev), solo: { bots: 1, opts: { rounds: 5, solo: true } } });
