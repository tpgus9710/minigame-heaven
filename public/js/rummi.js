/* =====================================================================
 *  🀫 러미 타일 화면 (규칙: shared/rummi-core.js)
 *  내 차례: 타일을 눌러 고르고(여러 개 가능) → 세트 끝의 + 나 '새 세트' 칸을 누르면 옮겨져요.
 *  컴퓨터에서는 타일을 끌어다 놓아도 돼요. 바닥 세트도 마음대로 떼고 붙일 수 있어요(등록 뒤).
 *  '완료'를 누르면 서버(싱글은 내 브라우저)가 규칙을 확인해요. 시간이 끝날 때 배치가 맞으면 자동으로 내려놓아요.
 * ===================================================================== */
makeScreen('rummi', {
  title: '🀫 러미 타일', status: '같은 색 연속 숫자(런)나 같은 숫자 다른 색(그룹)을 3개 이상 모아 내려놓아요. 첫 등록은 내 타일로만 30점 이상!',
  stats: [['pool', '남은 타일'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="rm-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="rmSolo" data-bots="1">1명</button><button class="seg-btn on" data-act="rmSolo" data-bots="2">2명</button><button class="seg-btn" data-act="rmSolo" data-bots="3">3명</button>
      <span class="muted small rm-gap">차례 시간</span><button class="seg-btn on" data-act="rmTime" data-time="0">없음</button><button class="seg-btn" data-act="rmTime" data-time="60">60초</button></div>
    <div class="rm-wrap">
      <div class="rm-opps" id="rm-opps"></div>
      <div class="rm-board" id="rm-board"></div>
      <div class="rm-status" id="rm-status"></div>
      <div class="rm-bar" id="rm-bar"></div>
      <div class="rm-rackwrap"><div class="rm-rackhead"><span id="rm-mycount"></span>
        <span class="rm-sort"><button class="chip-btn" data-act="rmSort" data-by="color">색 순</button><button class="chip-btn" data-act="rmSort" data-by="num">숫자 순</button></span></div>
        <div class="rm-rack" id="rm-rack" data-drop="rack"></div></div>
    </div>`,
});

const RM = {
  sel: new Set(), work: null, token: null, bots: 2, time: 0,
  sortBy: (() => { try { return localStorage.getItem('rmSort') || 'color'; } catch { return 'color'; } })(),

  tile(id, cls = '', mine = false) {
    const t = RummiCore.tile(id);
    const attrs = mine ? `data-act="rmTile" data-id="${id}" draggable="true"` : `data-id="${id}"`;
    const sel = this.sel.has(id) ? ' sel' : '';
    if (t.j) return `<div class="rt jk${sel} ${cls}" ${attrs}>${icon('mood-smile')}<i>조커</i></div>`;
    return `<div class="rt c-${t.c}${sel} ${cls}" ${attrs}><b>${t.n}</b><i></i></div>`;
  },
  sorted(ids) {
    const C = RummiCore.COLORS, T = RummiCore.tile;
    return ids.slice().sort((a, b) => {
      const x = T(a), y = T(b);
      if (x.j !== y.j) return x.j ? 1 : -1;
      return this.sortBy === 'num' ? (x.n - y.n) || (C.indexOf(x.c) - C.indexOf(y.c)) || a - b : (C.indexOf(x.c) - C.indexOf(y.c)) || (x.n - y.n) || a - b;
    });
  },

  render(v, ctx, prev) {
    if (!prev || this.gen !== Table.cur) { this.gen = Table.cur; this.work = null; this.token = null; this.sel.clear(); this.lastDrawN = v.lastDraw ? v.lastDraw.n : 0; }
    this.v = v; this.ctx = ctx;
    $('#rm-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    setStat('rummi', 'pool', `${v.pool}개`);
    const mine = v.turnId === ctx.me && !v.over;
    const tok = mine ? `${v.turnNo}` : null;
    if (tok !== this.token) {                       // 새 차례: 지금 바닥과 내 패로 작업판을 만들어요
      this.token = tok; this.sel.clear();
      this.work = mine ? { table: v.table.map(s => s.slice()), rack: v.rack.slice() } : null;
      if (this.autoT) { clearTimeout(this.autoT); this.autoT = null; }
      if (mine && v.turnEnd) {                      // 시간이 끝나기 직전, 맞는 배치면 자동으로 내려놓기
        this.autoT = after(Math.max(0, v.turnEnd - serverNow() - 900), () => {
          this.autoT = null;
          if (this.token !== tok || !this.work) return;
          const r = RummiCore.validatePlay(this.v.table, this.work.table, this.v.rack, this.v.melded);
          if (r.ok) { toast('시간이 다 돼서 지금 배치로 내려놓았어요.'); this.ctx.send({ t: 'play', sets: this.work.table }); }
        });
      }
      if (mine && ctx.mode === 'multi') toast('내 차례예요!');
    }
    this.fresh = new Set(v.lastIds || []);
    if (v.lastDraw && v.lastDraw.n !== this.lastDrawN) { this.lastDrawN = v.lastDraw.n; this.drawn = v.lastDraw.tile != null ? v.lastDraw.tile : null; }
    this.paint();
  },

  paint() {
    const v = this.v, ctx = this.ctx, w = this.work, mine = !!w;
    // 사람들
    $('#rm-opps').innerHTML = v.players.map(p => `<div class="rm-opp ${p.id === v.turnId ? 'turn' : ''} ${p.id === v.winner ? 'win' : ''} ${p.id === ctx.me ? 'me' : ''}">
      <i style="--c:${avColor(p.id)}"></i><b>${esc(p.name)}${p.id === ctx.me ? ' (나)' : ''}</b>
      <span class="rm-cnt">${icon('stack-2')}${p.count}</span>${p.melded ? '<em>등록</em>' : ''}
      ${v.over ? `<span class="rm-score ${p.score >= 0 ? 'plus' : ''}">${p.score > 0 ? '+' : ''}${p.score}</span>` : ''}
      ${v.over && p.rack && p.rack.length ? `<div class="rm-left">${this.sorted(p.rack).map(id => this.tile(id, 'mini')).join('')}</div>` : ''}</div>`).join('');
    // 바닥
    const table = w ? w.table : v.table, orig = new Set(v.rack);
    const sets = table.map((set, i) => {
      const r = RummiCore.check(set), order = r.ok ? r.order : RummiCore.arrange(set);
      const tiles = order.map(id => this.tile(id, (!w && this.fresh.has(id) ? 'fresh' : '') + (w && orig.has(id) ? ' placed' : ''), mine)).join('');
      const drop = mine && this.sel.size ? `<button class="rm-drop" data-act="rmToSet" data-i="${i}" title="여기에 놓기">${icon('arrow-left')}</button>` : '';
      return `<div class="rm-set ${w ? (r.ok ? 'ok' : 'bad') : ''}" data-drop="set" data-i="${i}" ${w && !r.ok ? `title="${esc(r.why)}"` : ''}>${tiles}${drop}${w && !r.ok ? `<span class="rm-why">${esc(r.why)}</span>` : ''}</div>`;
    }).join('');
    const newSet = mine ? `<div class="rm-set new ${this.sel.size ? 'armed' : ''}" data-drop="new" data-act="rmNewSet">${icon('sparkles')}<span>${this.sel.size ? `고른 ${this.sel.size}개로 새 세트` : '새 세트 자리'}</span></div>` : '';
    $('#rm-board').innerHTML = (sets || '<div class="rm-empty">아직 바닥이 비어 있어요. 첫 등록은 내 타일로만 30점 이상!</div>') + newSet;
    // 내 패
    const rack = w ? w.rack : v.rack;
    $('#rm-rack').innerHTML = this.sorted(rack).map(id => this.tile(id, id === this.drawn ? 'drawn' : '', mine)).join('') || '<span class="rm-empty small">패가 비었어요!</span>';
    $('#rm-mycount').innerHTML = `${icon('stack-2')} 내 타일 <b>${rack.length}</b>개 · 남은 합 ${RummiCore.rackValue(rack)}점`;
    $$('.rm-sort .chip-btn').forEach(b => b.classList.toggle('on', b.dataset.by === this.sortBy));
    // 상태 · 버튼
    const st = $('#rm-status');
    st.className = 'rm-status';
    if (v.over) { st.textContent = v.msg; st.classList.add('ok'); }
    else if (!mine) st.textContent = v.msg;
    else {
      const placed = rack.length !== v.rack.length || JSON.stringify(table) !== JSON.stringify(v.table);
      const r = RummiCore.validatePlay(v.table, table, v.rack, v.melded);
      if (!placed) st.textContent = v.melded ? '타일을 골라 세트를 만들거나 바닥 세트에 붙여요. 낼 게 없으면 뽑기!' : '첫 등록: 내 타일로만 만든 세트 합이 30점 이상이어야 해요. 없으면 뽑기!';
      else if (r.ok) { st.textContent = `좋아요! 완료를 누르면 타일 ${r.played.length}개를 내려놓아요${r.value ? ` (등록 ${r.value}점)` : ''}.`; st.classList.add('ok'); }
      else { st.textContent = r.err; st.classList.add('err'); }
      this.canDone = !!r.ok;
    }
    const bar = $('#rm-bar');
    if (!mine) { bar.innerHTML = v.over ? '' : `<span class="rm-wait"><i></i><i></i><i></i>${esc((v.players.find(p => p.id === v.turnId) || {}).name || '')} 님이 생각 중</span>`; return; }
    const n = this.sel.size;
    bar.innerHTML = `<button class="btn ghost sm" data-act="rmNewSet" ${n ? '' : 'disabled'}>${icon('sparkles')} 새 세트</button>
      <button class="btn ghost sm" data-act="rmToRack" ${n ? '' : 'disabled'}>${icon('arrow-left')} 내 패로</button>
      <button class="btn ghost sm" data-act="rmReset">${icon('refresh')} 되돌리기</button>
      <button class="btn sm info" data-act="rmDraw">${icon('stack-2')} ${v.pool ? '뽑기' : '넘기기'}</button>
      <button class="btn sm good" data-act="rmDone" ${this.canDone ? '' : 'disabled'}>${icon('circle-check')} 완료</button>`;
  },

  /** 고른 타일을 옮기기 — dest: { set: i } · { newSet: true } · { rack: true } */
  move(dest) {
    const w = this.work, v = this.v;
    if (!w) return;
    let ids = [...this.sel];
    if (!ids.length) return;
    if (dest.rack) {
      const orig = new Set(v.rack), back = ids.filter(id => orig.has(id));
      if (back.length < ids.length) toast('바닥에 있던 타일은 내 패로 가져올 수 없어요.', 'error');
      ids = back;
      if (!ids.length) return;
    }
    const S = new Set(ids);
    w.rack = w.rack.filter(id => !S.has(id));
    w.table = w.table.map(set => set.filter(id => !S.has(id)));
    if (dest.set != null && w.table[dest.set]) w.table[dest.set] = w.table[dest.set].concat(ids);
    else if (dest.rack) w.rack = w.rack.concat(ids);
    else w.table.push(ids);
    w.table = w.table.filter(set => set.length);
    this.sel.clear();
    this.paint();
  },
};

Object.assign(ACT, {
  rmTile: el => {
    if (!RM.work) return;
    const id = +el.dataset.id;
    if (RM.sel.has(id)) RM.sel.delete(id); else RM.sel.add(id);
    RM.paint();
  },
  rmToSet: el => RM.move({ set: +el.dataset.i }),
  rmNewSet: () => RM.move({ newSet: true }),
  rmToRack: () => RM.move({ rack: true }),
  rmReset: () => { const v = RM.v; if (!RM.work) return; RM.work = { table: v.table.map(s => s.slice()), rack: v.rack.slice() }; RM.sel.clear(); RM.paint(); },
  rmDraw: () => { if (!RM.work) return; RM.sel.clear(); RM.ctx.send({ t: 'draw' }); },
  rmDone: () => {
    const v = RM.v, w = RM.work;
    if (!w) return;
    const r = RummiCore.validatePlay(v.table, w.table, v.rack, v.melded);
    if (!r.ok) return toast(r.err, 'error');
    RM.sel.clear();
    RM.ctx.send({ t: 'play', sets: w.table });
  },
  rmSort: el => { RM.sortBy = el.dataset.by; try { localStorage.setItem('rmSort', RM.sortBy); } catch { /* 저장 못 해도 괜찮아요 */ } if (RM.v) RM.paint(); },
  rmSolo: el => {
    RM.bots = +el.dataset.bots;
    $$('#rm-solo [data-act=rmSolo]').forEach(b => b.classList.toggle('on', +b.dataset.bots === RM.bots));
    Table.solo('rummi', { bots: RM.bots, opts: { time: RM.time } });
  },
  rmTime: el => {
    RM.time = +el.dataset.time;
    $$('#rm-solo [data-act=rmTime]').forEach(b => b.classList.toggle('on', +b.dataset.time === RM.time));
    Table.solo('rummi', { bots: RM.bots, opts: { time: RM.time } });
  },
});

/* 끌어다 놓기 (컴퓨터) — 고른 타일이 있으면 함께 옮겨요 */
(() => {
  const scr = document.getElementById('scr-rummi');
  let dragging = false;
  scr.addEventListener('dragstart', e => {
    const t = e.target.closest && e.target.closest('.rt[data-act=rmTile]');
    if (!t || !RM.work) { e.preventDefault(); return; }
    const id = +t.dataset.id;
    if (!RM.sel.has(id)) { RM.sel.clear(); RM.sel.add(id); }
    dragging = true;
    try { e.dataTransfer.setData('text/plain', String(id)); e.dataTransfer.effectAllowed = 'move'; } catch { /* 일부 브라우저 */ }
    requestAnimationFrame(() => RM.paint());
  });
  scr.addEventListener('dragend', () => { dragging = false; $$('#scr-rummi .drop-on').forEach(x => x.classList.remove('drop-on')); });
  scr.addEventListener('dragover', e => {
    if (!dragging) return;
    const z = e.target.closest('[data-drop]');
    if (!z) return;
    e.preventDefault();
    $$('#scr-rummi .drop-on').forEach(x => x !== z && x.classList.remove('drop-on'));
    z.classList.add('drop-on');
  });
  scr.addEventListener('drop', e => {
    const z = e.target.closest('[data-drop]');
    if (!z || !dragging) return;
    e.preventDefault(); dragging = false;
    const k = z.dataset.drop;
    RM.move(k === 'set' ? { set: +z.dataset.i } : k === 'rack' ? { rack: true } : { newSet: true });
  });
})();

Table.def('rummi', { core: RummiCore, render: (v, ctx, prev) => RM.render(v, ctx, prev), solo: { bots: 2, opts: { time: 0 } } });
