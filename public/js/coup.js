/* =====================================================================
 *  👑 궁정 음모 화면 (규칙: shared/coup-core.js)
 *  내 차례엔 아래 행동 버튼, 누가 인물을 주장하면 가운데에 "도전 / 허용 / 막기" 질문이 떠요.
 * ===================================================================== */
makeScreen('coup', {
  title: '👑 궁정 음모', status: '인물 카드를 가진 척해도 돼요. 의심되면 도전! 거짓말이 들키면 카드를 잃어요.',
  stats: [['deck', '궁정 덱'], ['coins', '내 코인'], ['time', '남은 시간']],
  body: `<div class="cp-top"><div class="mode-row" id="cp-solo"><span class="muted small">AI 상대</span>
      ${[1, 2, 3, 4, 5].map(n => `<button class="seg-btn ${n === 3 ? 'on' : ''}" data-act="cpSolo" data-bots="${n}">${n}명</button>`).join('')}</div>
    <details class="cp-guide" id="cp-guide"><summary>${icon('cards')}<span class="cp-gt">인물 카드<span class="cp-gl"> 한눈에 보기</span></span></summary>
      <div class="cp-guide-pop" data-act="cpGuide"><div class="cp-guide-row" id="cp-guide-row"></div>
      <p>기본 행동: <b>소득</b> +1 · <b>해외 원조</b> +2(공작이 막음) · <b>쿠데타</b> 7코인(못 막음, 10코인 이상이면 필수). 각 인물은 3장씩, 모두 15장이에요.</p><small class="cp-gx">누르면 닫혀요</small></div></details></div>
    <div class="cp-table" id="cp-table">
      <div class="cp-opps" id="cp-opps"></div>
      <div class="cp-mid">
        <div class="cp-stage" id="cp-stage"></div>
        <div class="cp-logbox"><div class="cp-logt">궁정 기록</div><ol class="cp-log" id="cp-log"></ol></div>
      </div>
      <div class="cp-me" id="cp-me"></div>
      <div class="cp-acts" id="cp-acts"></div>
      <div class="cp-flash" id="cp-flash"></div>
      <div class="cp-fx" id="cp-fx"></div>
    </div>`,
});

const CP_CARD = {
  duke: { n: '공작', ic: 'crown', a: '세금 +3코인', b: '해외 원조를 막아요' },
  assassin: { n: '암살자', ic: 'sword', a: '3코인 내고 암살', b: '' },
  captain: { n: '사령관', ic: 'anchor', a: '코인 2개 갈취', b: '갈취를 막아요' },
  ambassador: { n: '대사', ic: 'arrows-exchange', a: '궁정 카드 2장과 교환', b: '갈취를 막아요' },
  contessa: { n: '백작부인', ic: 'flower', a: '', b: '암살을 막아요' },
};
const CP_ACT = [
  ['income', '소득', '+1코인', null], ['aid', '해외 원조', '+2코인', null], ['coup', '쿠데타', '7코인', null],
  ['tax', '세금', '+3코인', 'duke'], ['assassin', '암살', '3코인', 'assassin'], ['steal', '갈취', '최대 2코인', 'captain'], ['exchange', '교환', '카드 바꾸기', 'ambassador'],
];
/** 받침에 따라 조사 고르기 (공작이라고 / 대사라고, 공작으로 / 대사로) */
const cpJong = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; };
const cpJ = (w, a, b) => w + (cpJong(w) ? a : b);
const cpRo = w => w + (cpJong(w) && cpJong(w) !== 8 ? '으로' : '로');
const CP_LOG_IC = { start: 'chess-queen', claim: 'sparkles', act: 'coins', coin: 'coin', block: 'hand-stop', chal: 'swords', proof: 'shield-check',
  caught: 'mask', lose: 'heart', out: 'skull', fail: 'hand-stop', coup: 'bolt', hit: 'sword', win: 'crown', info: 'arrows-exchange' };

const CP = {
  pick: null, keep: [],
  /** 인물 카드: c=null 이면 뒷면 */
  card(c, cls = '', attrs = '') {
    if (!c) return `<div class="cp-card back ${cls}" ${attrs}><span class="cp-crest">${icon('chess-queen')}</span></div>`;
    const d = CP_CARD[c];
    return `<div class="cp-card ${c} ${cls}" ${attrs}><span class="cp-ic">${icon(d.ic)}</span><b>${d.n}</b>
      <small>${d.a}</small>${d.b ? `<small class="blk">${d.b}</small>` : ''}</div>`;
  },
  mini(c, dead, cls = '') {
    if (!c) return `<i class="cp-mini back ${cls}">${icon('chess-queen')}</i>`;
    return `<i class="cp-mini ${c} ${dead ? 'dead' : ''} ${cls}" title="${CP_CARD[c].n}">${icon(CP_CARD[c].ic)}</i>`;
  },
  name(v, id) { return esc((v.players.find(p => p.id === id) || {}).name || '?'); },

  render(v, ctx, prev) {
    const fresh = !prev || this.gen !== Table.cur;
    if (fresh) { this.gen = Table.cur; this.pick = null; this.keep = []; this.lastProof = v.proof ? v.proof.n : 0; this.exKey = null; }
    this.v = v; this.ctx = ctx;
    $('#cp-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    $$('#cp-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === (CP.bots || 3)));
    const me = v.players.find(p => p.id === ctx.me), ask = v.ask;
    if (!ask || ask.k !== 'act') this.pick = null;
    setStat('coup', 'deck', `${v.deck}장`);
    setStat('coup', 'coins', me ? `${me.coins}개` : '-');
    if (!$('#cp-guide-row').innerHTML) $('#cp-guide-row').innerHTML = Object.keys(CP_CARD).map(c => this.card(c, 'sm')).join('');

    this.seats(v, ctx);
    this.stage(v, ctx, me, ask);
    this.mine(v, ctx, me, ask);
    this.actions(v, ctx, me, ask);
    $('#cp-log').innerHTML = v.log.slice().reverse().map((e, i) => `<li class="t-${e.t} ${i === 0 ? 'new' : ''}">${icon(CP_LOG_IC[e.t] || 'info-circle')}<span>${esc(e.text)}</span></li>`).join('');
    if (prev && !fresh) this.effects(v, prev);
  },

  seats(v, ctx) {
    const meIdx = Math.max(0, v.players.findIndex(p => p.id === ctx.me));
    const others = v.players.slice(meIdx + 1).concat(v.players.slice(0, meIdx)).filter(p => p.id !== ctx.me);
    const d = v.pend, w = v.win;
    const picking = this.pick && v.ask && v.ask.k === 'act';
    $('#cp-opps').innerHTML = others.map(p => {
      const tags = [];
      if (p.out) tags.push('<em class="out">탈락</em>');
      else if (v.winner === p.id) tags.push('<em class="win">승리</em>');
      if (!p.out && v.turnId === p.id) tags.push('<em class="turn">차례</em>');
      if (d && d.target === p.id && !v.over) tags.push('<em class="tgt">대상</em>');
      if (w && w.responders.includes(p.id)) tags.push(w.passed.includes(p.id) ? '<em class="ok">허용</em>' : v.wait.includes(p.id) ? '<em class="think">고민 중</em>' : '');
      if (v.losing === p.id) tags.push('<em class="bad">카드 잃는 중</em>');
      let can = false, why = '';
      if (picking && !p.out) {
        can = true;
        if (this.pick === 'steal' && p.coins <= 0) { can = false; why = '코인 없음'; }
      }
      return `<div class="cp-seat ${v.turnId === p.id ? 'turn' : ''} ${p.out ? 'out' : ''} ${d && d.target === p.id ? 'tgt' : ''} ${can ? 'pick' : ''} ${picking && !can && !p.out ? 'nopick' : ''}"
          data-id="${esc(p.id)}" ${can ? `data-act="cpTarget" data-target="${esc(p.id)}"` : ''}>
        <div class="cp-who"><span class="cp-av" style="--c:${avColor(p.id)}">${esc((p.name || '?')[0])}</span><b>${esc(p.name)}</b></div>
        <div class="cp-inf">${p.cards.map(c => this.mini(c.c, c.dead)).join('')}</div>
        <div class="cp-coin">${icon('coin')}<b>${p.coins}</b></div>
        <div class="cp-tags">${tags.join('')}${why ? `<em class="out">${why}</em>` : ''}</div></div>`;
    }).join('');
  },

  stage(v, ctx, me, ask) {
    const d = v.pend, w = v.win, N = id => this.name(v, id);
    let head = '', body = '', btns = '', art = '';
    const kindName = { income: '소득', aid: '해외 원조', coup: '쿠데타', tax: '세금', assassin: '암살', steal: '갈취', exchange: '교환' };
    if (v.over) {
      head = v.winner ? `<h3 class="cp-big">${N(v.winner)} 님이 궁정을 차지했어요!</h3>` : `<h3 class="cp-big">${esc(v.msg || '게임이 끝났어요.')}</h3>`;
      body = '<p>모든 카드가 공개됐어요. 결과 화면이 곧 열려요.</p>';
    } else if (d) {
      const tgt = d.target ? ` → <b>${N(d.target)}</b>` : '';
      art = d.claim && !(ask && ask.k === 'exchange') ? this.card(d.claim, 'md claim') : '';
      head = `<div class="cp-claimline"><b>${N(d.actor)}</b> 님의 <span class="cp-kind">${kindName[d.kind]}</span>${tgt}</div>`;
      if (d.claim && !(ask && ask.k === 'chal')) body += `<p class="cp-sub">${cpJ(CP_CARD[d.claim].n, '이라고', '라고')} 주장했어요</p>`;
      if (d.block) body += `<p class="cp-blockline">${icon('hand-stop')}<b>${N(d.block.by)}</b> 님이 <b class="c-${d.block.card}">${cpRo(CP_CARD[d.block.card].n)}</b> 막았어요</p>`;
    } else if (v.turnId === ctx.me) {
      head = `<h3 class="cp-big">내 차례예요!</h3>`;
      body = ask && ask.must ? '<p class="cp-warn">코인이 10개 이상이에요. 반드시 쿠데타를 해야 해요!</p>' : '<p>아래에서 행동을 고르세요. 가진 카드가 아니어도 주장할 수 있어요(블러핑).</p>';
    } else {
      head = `<h3 class="cp-big dim">${N(v.turnId)} 님이 고민 중…</h3>`;
      body = '<p>어떤 인물을 주장할지 지켜보세요.</p>';
    }
    // 질문 / 기다림
    if (ask && ask.k === 'chal' || ask && ask.k === 'bchal') {
      const c = w.card, claimer = N(w.claimant);
      const what = ask.k === 'chal' ? `${claimer} 님이 <b class="c-${c}">${cpJ(CP_CARD[c].n, '이라고', '라고')}</b> 주장해요.` : `${claimer} 님이 <b class="c-${c}">${cpRo(CP_CARD[c].n)}</b> 막겠대요.`;
      const vsMe = (ask.k === 'chal' && d && d.target === ctx.me) || (ask.k === 'bchal' && d && d.actor === ctx.me);
      btns = `<p class="cp-q">${what} ${vsMe ? '<b class="cp-warn">나를 노리고 있어요!</b>' : ''} 도전할까요?</p>
        <div class="cp-btns"><button class="btn bad" data-act="cpResp" data-t="chal">${icon('swords')} 도전!</button><button class="btn ghost" data-act="cpResp" data-t="allow">허용</button></div>
        <small class="muted">도전했는데 진짜면 내가 카드를 잃고, 거짓말이면 상대가 잃어요.</small>`;
    } else if (ask && ask.k === 'block') {
      const mineHas = c => me && me.cards.some(x => !x.dead && x.c === c);
      const q = d.kind === 'aid' ? `${N(d.actor)} 님이 해외 원조(+2)를 받으려 해요. 공작이라며 막을까요?`
        : d.kind === 'assassin' ? `<b class="cp-warn">${N(d.actor)} 님이 나를 암살하려 해요!</b> 백작부인이라며 막을까요?`
          : `${N(d.actor)} 님이 내 코인을 빼앗으려 해요! 막을까요?`;
      btns = `<p class="cp-q">${q}</p><div class="cp-btns">${ask.opts.map(c => `<button class="btn cp-bk c-${c}" data-act="cpResp" data-t="block" data-card="${c}">${icon(CP_CARD[c].ic)} ${cpRo(CP_CARD[c].n)} 막기${mineHas(c) ? '' : '<i class="bluff">블러핑</i>'}</button>`).join('')}
        <button class="btn ghost" data-act="cpResp" data-t="allow">${d.kind === 'assassin' ? '허용 (카드 잃기)' : '허용'}</button></div>`;
    } else if (ask && ask.k === 'lose') {
      btns = `<p class="cp-q cp-warn">${esc(ask.why)}! 잃을 카드 1장을 아래에서 고르세요.</p>`;
    } else if (ask && ask.k === 'exchange') {
      const key = ask.cards.join(',') + ask.need;
      if (this.exKey !== key) { this.exKey = key; this.keep = []; }
      btns = `<p class="cp-q">남길 카드 <b>${ask.need}장</b>을 고르세요. 나머지는 궁정 덱으로 돌아가요.</p>
        <div class="cp-exrow">${ask.cards.map((c, i) => this.card(c, `md pickable ${this.keep.includes(i) ? 'sel' : ''}`, `data-act="cpKeep" data-i="${i}"`)).join('')}</div>
        <div class="cp-btns"><button class="btn good" data-act="cpKeepGo" ${this.keep.length === ask.need ? '' : 'disabled'}>이 카드로 결정</button></div>`;
    } else if (!v.over && w) {
      const waiting = v.wait.map(N).join(', ');
      btns = `<p class="cp-wait">${icon('hourglass')} ${w.type === 'block' ? '막을지 고민 중' : '도전할지 고민 중'}: ${waiting || '…'}</p>`;
    } else if (!v.over && v.losing && v.losing !== ctx.me) {
      btns = `<p class="cp-wait">${icon('hourglass')} ${N(v.losing)} 님이 잃을 카드를 고르는 중…</p>`;
    } else if (!v.over && v.phase === 'exchange' && d && d.actor !== ctx.me) {
      btns = `<p class="cp-wait">${icon('hourglass')} ${N(d.actor)} 님이 카드를 고르는 중…</p>`;
    }
    if (ask && v.turnEnd && ask.k !== 'act') {
      const left = Math.max(0, v.turnEnd - serverNow()), total = v.phase === 'window' ? 10000 : 40000;
      btns += `<div class="cp-timer"><i style="--from:${Math.min(1, left / total).toFixed(3)};animation-duration:${left}ms"></i></div>`;
    }
    if (this.pick && ask && ask.k === 'act') {
      btns = `<p class="cp-q">${icon('target')} <b>${kindName[this.pick]}</b>할 상대를 위에서 고르세요.</p><div class="cp-btns"><button class="btn ghost" data-act="cpCancel">취소</button></div>`;
    }
    $('#cp-stage').innerHTML = `<div class="cp-stage-in ${ask && ask.k !== 'act' ? 'ask' : ''}">${art}<div class="cp-stage-txt">${head}${body}${btns}</div></div>`;
  },

  mine(v, ctx, me, ask) {
    const box = $('#cp-me');
    if (!me) { box.innerHTML = '<p class="muted">구경 중이에요.</p>'; return; }
    const losing = ask && ask.k === 'lose';
    box.innerHTML = `<div class="cp-mycards">${me.cards.map((c, i) => {
      const cls = ['lg', c.dead ? 'dead' : '', c.fresh ? 'fresh' : '', losing && !c.dead ? 'pickable lose' : ''].join(' ');
      return this.card(c.c, cls, losing && !c.dead ? `data-act="cpLose" data-i="${i}"` : '');
    }).join('')}</div>
      <div class="cp-mybar ${v.turnId === ctx.me ? 'turn' : ''} ${me.out ? 'out' : ''}">
        <span class="cp-av" style="--c:${avColor(me.id)}">${esc((me.name || '?')[0])}</span><b>${esc(me.name)}</b>
        <span class="cp-coin big">${icon('coin')}<b>${me.coins}</b></span>
        ${me.out ? '<em class="out">탈락 — 구경 중</em>' : v.winner === me.id ? '<em class="win">승리!</em>' : v.turnId === ctx.me ? '<em class="turn">내 차례</em>' : ''}
      </div>`;
  },

  actions(v, ctx, me, ask) {
    const box = $('#cp-acts');
    if (!me || me.out || v.over) { box.innerHTML = ''; return; }
    const my = ask && ask.k === 'act', must = my && ask.must;
    const hasC = c => me.cards.some(x => !x.dead && x.c === c);
    box.innerHTML = CP_ACT.map(([k, n, sub, claim]) => {
      let dis = !my, why = sub;
      if (my && must && k !== 'coup') { dis = true; why = '쿠데타 필수'; }
      if (my && k === 'coup' && me.coins < 7) { dis = true; why = '7코인 필요'; }
      if (my && k === 'assassin' && me.coins < 3) { dis = true; why = '3코인 필요'; }
      if (my && k === 'steal' && !v.players.some(p => p.id !== ctx.me && !p.out && p.coins > 0)) { dis = true; why = '빼앗을 코인 없음'; }
      const bluff = claim && !hasC(claim);
      return `<button class="cp-act ${claim ? 'c-' + claim : 'basic'} ${this.pick === k ? 'on' : ''}" data-act="cpAct" data-k="${k}" ${dis ? 'disabled' : ''}>
        ${claim ? `<span class="cp-ic">${icon(CP_CARD[claim].ic)}</span>` : `<span class="cp-ic">${icon(k === 'coup' ? 'bolt' : 'coins')}</span>`}
        <b>${n}</b><small>${claim ? CP_CARD[claim].n + ' · ' : ''}${why}</small>${bluff && my && !dis ? '<i class="bluff">블러핑</i>' : ''}</button>`;
    }).join('');
  },

  /** 코인 변화 · 카드 공개 · 도전 결과 효과 */
  effects(v, prev) {
    const fx = $('#cp-fx'), table = $('#cp-table');
    if (!fx || !table) return;
    const tb = table.getBoundingClientRect();
    for (const p of v.players) {
      const q = prev.players && prev.players.find(x => x.id === p.id);
      if (!q) continue;
      const dc = p.coins - q.coins;
      const el = p.id === this.ctx.me ? $('#cp-me .cp-mybar') : $(`#cp-opps .cp-seat[data-id="${CSS.escape(p.id)}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (dc && !(p.out && !q.out)) {
        const f = document.createElement('span');
        f.className = 'cp-float ' + (dc > 0 ? 'up' : 'down');
        f.textContent = (dc > 0 ? '+' : '') + dc;
        f.style.left = (r.left - tb.left + r.width / 2) + 'px'; f.style.top = (r.top - tb.top + r.height * 0.42) + 'px';
        fx.append(f); setTimeout(() => f.remove(), 1300);
      }
      p.cards.forEach((c, i) => {
        if (c.dead && q.cards[i] && !q.cards[i].dead) {
          const m = p.id === this.ctx.me ? $$('#cp-me .cp-card')[i] : $$(`#cp-opps .cp-seat[data-id="${CSS.escape(p.id)}"] .cp-mini`)[i];
          if (m) m.classList.add('flip');
        }
      });
    }
    const pf = v.proof;
    if (pf && pf.n !== this.lastProof) {
      this.lastProof = pf.n;
      const box = $('#cp-flash');
      box.innerHTML = `<div class="cp-flash-in ${pf.lie ? 'lie' : 'true'}">${this.card(pf.card, 'md')}<b>${pf.lie ? '거짓말!' : '진짜!'}</b><small>${this.name(v, pf.id)} 님의 ${CP_CARD[pf.card].n}</small></div>`;
      clearTimeout(this.flashT); this.flashT = setTimeout(() => { box.innerHTML = ''; }, 1900);
    }
  },
};
Object.assign(ACT, {
  cpAct: el => {
    const v = CP.v, c = CP.ctx, k = el.dataset.k;
    if (!v || !c || !v.ask || v.ask.k !== 'act') return;
    if (['coup', 'assassin', 'steal'].includes(k)) {
      const targets = v.players.filter(p => p.id !== c.me && !p.out && (k !== 'steal' || p.coins > 0));
      if (targets.length === 1) { CP.pick = null; c.send({ t: 'act', kind: k, target: targets[0].id }); return; }
      CP.pick = CP.pick === k ? null : k; CP.render(v, c, v); return;
    }
    CP.pick = null; c.send({ t: 'act', kind: k });
  },
  cpTarget: el => { const c = CP.ctx, k = CP.pick; if (!c || !k) return; CP.pick = null; c.send({ t: 'act', kind: k, target: el.dataset.target }); },
  cpCancel: () => { CP.pick = null; if (CP.v) CP.render(CP.v, CP.ctx, CP.v); },
  cpResp: el => { const c = CP.ctx; if (!c) return; c.send(el.dataset.t === 'block' ? { t: 'block', card: el.dataset.card } : { t: el.dataset.t }); },
  cpLose: el => { const c = CP.ctx; if (c) c.send({ t: 'lose', idx: +el.dataset.i }); },
  cpKeep: el => {
    const v = CP.v, i = +el.dataset.i; if (!v || !v.ask || v.ask.k !== 'exchange') return;
    if (CP.keep.includes(i)) CP.keep = CP.keep.filter(x => x !== i);
    else { CP.keep.push(i); if (CP.keep.length > v.ask.need) CP.keep.shift(); }
    CP.render(v, CP.ctx, v);
  },
  cpKeepGo: () => { const c = CP.ctx, v = CP.v; if (c && v && v.ask && CP.keep.length === v.ask.need) c.send({ t: 'keep', idx: CP.keep.slice() }); },
  cpGuide: () => { $('#cp-guide').open = false; },
  cpSolo: el => {
    CP.bots = +el.dataset.bots;
    Table.solo('coup', { bots: CP.bots });
    $$('#cp-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === CP.bots));
  },
});
Table.def('coup', { core: CoupCore, render: (v, ctx, prev) => CP.render(v, ctx, prev), solo: { get bots() { return CP.bots || 3; }, opts: { solo: true } } });
