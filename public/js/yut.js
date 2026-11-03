/* =====================================================================
 *  🥢 윷놀이 화면 (규칙: shared/yut-core.js) — 한지 느낌의 윷판 + 던지는 윷가락 + 말 이동 애니메이션
 * ===================================================================== */
makeScreen('yut', {
  title: '🥢 윷놀이', status: '윷을 던져 말을 움직여요. 모서리와 가운데에 멈추면 지름길! 상대 말을 잡으면 한 번 더.',
  stats: [['turn', '차례'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="yt-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn on" data-act="ytSolo" data-bots="1">1명</button><button class="seg-btn" data-act="ytSolo" data-bots="2">2명</button><button class="seg-btn" data-act="ytSolo" data-bots="3">3명</button>
      <span class="muted small" style="margin-left:10px">말</span>
      <button class="seg-btn" data-act="ytSolo" data-pieces="2">2개</button><button class="seg-btn" data-act="ytSolo" data-pieces="3">3개</button><button class="seg-btn on" data-act="ytSolo" data-pieces="4">4개</button></div>
    <div class="yt-wrap">
      <div class="yt-board-wrap"><svg class="yt-board" id="yt-board" viewBox="0 0 600 600"></svg></div>
      <div class="yt-side">
        <div class="yt-throw"><div class="yt-mat"><div class="yt-sticks" id="yt-sticks"></div><div class="yt-call" id="yt-call"></div></div>
          <div class="yt-chips" id="yt-chips"></div><div class="yt-acts" id="yt-acts"></div></div>
        <div class="yt-msg" id="yt-msg"></div>
        <div class="yt-players" id="yt-players"></div>
      </div>
    </div>`,
});

const Yut = {
  build() {
    const C = YutCore, P = C.POS;
    const lines = C.LINES.map(([a, b]) => `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}"/>`).join('');
    const spots = Object.keys(P).map(Number).map(n => {
      const [x, y] = P[n], big = C.BIG.includes(n);
      return `<g class="yt-spot ${big ? 'big' : ''}" data-n="${n}" transform="translate(${x},${y})">${big ? '<circle class="o" r="27"/><circle class="i" r="17"/>' : '<circle class="o" r="17"/><circle class="i" r="9"/>'}</g>`;
    }).join('');
    const TAG = { 0: [540, 489, '출발 ↑'], 5: [540, 111, '모'], 10: [60, 111, '뒷모'], 15: [60, 489, '찌모'], 22: [300, 352, '방'] };
    const labels = Object.values(TAG).map(([x, y, t]) => `<g class="yt-tag" transform="translate(${x},${y})"><rect x="${-t.length * 8 - 8}" y="-11" width="${t.length * 16 + 16}" height="22" rx="11"/><text y="1">${t}</text></g>`).join('');
    $('#yt-board').innerHTML = `<defs><radialGradient id="ytPaper" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#f7ecd2"/><stop offset="1" stop-color="#e2cfa4"/></radialGradient>
        <filter id="ytShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity=".45"/></filter></defs>
      <rect x="6" y="6" width="588" height="588" rx="22" fill="url(#ytPaper)" stroke="#6b4a2b" stroke-width="5"/>
      <rect x="22" y="22" width="556" height="556" rx="14" fill="none" stroke="rgba(107,74,43,.35)" stroke-width="1.5"/>
      <g class="yt-lines">${lines}</g>${labels}
      <g id="yt-spots">${spots}</g><g id="yt-ghost"></g><g id="yt-tokens"></g><g id="yt-fx"></g>`;
    this.gen = (this.gen || 0) + 1; this.q = []; this.busy = false; this.disp = {}; this.lastN = null; this.sel = 0;
    $('#yt-sticks').innerHTML = Array.from({ length: 4 }, (_, i) => `<i class="yt-stick ${i === 0 ? 'mark' : ''}"><b></b></i>`).join('');
    $('#yt-call').textContent = '';
  },
  render(v, ctx, prev) {
    if (!prev || !$('#yt-tokens')) this.build();
    this.v = v; this.ctx = ctx;
    $('#yt-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const t = v.players.find(p => p.id === v.turnId);
    setStat('yut', 'turn', v.over ? '끝' : t ? t.name : '-');
    if (this.lastN == null) {
      this.lastN = v.seq; this.syncDisp(v); this.tokens();
      return this.idle();
    }
    for (const e of v.log) {
      if (e.n <= this.lastN) continue;
      this.lastN = e.n;
      if (e.t === 'throw') this.q.push({ k: 'throw', v: e.v, id: e.id });
      else if (e.t === 'move') this.q.push({ k: 'move', e });
    }
    if (!this.busy) this.lock();
    this.run();
  },
  /** 화면에 보이는 말 위치 (애니메이션 중에는 실제 상태보다 늦어요) */
  syncDisp(v) { this.disp = {}; v.players.forEach(p => { this.disp[p.id] = p.pieces.map(q => q.pos); }); },
  lock() { $('#yt-acts').innerHTML = ''; $('#yt-ghost').innerHTML = ''; $$('#yt-tokens .yt-tok').forEach(t => t.classList.remove('can')); },
  run() {
    if (this.busy) return;
    const it = this.q.shift();
    if (!it) return this.idle();
    this.busy = true;
    const gen = this.gen, fast = this.q.length > 4 ? 0.45 : 1;
    const done = ms => after(Math.round(ms * fast), () => { if (gen !== this.gen) return; this.busy = false; this.run(); });
    if (it.k === 'throw') { this.sticks(it.v, fast); done(1050); return; }
    const e = it.e, pl = this.v.players.find(p => p.id === e.id), arr = this.disp[e.id];
    if (!pl || !arr) return done(0);
    const idx = arr.map((pos, i) => (pos === e.from ? i : -1)).filter(i => i >= 0).slice(0, e.from === -1 ? 1 : 99);
    const path = e.path.slice();
    const step = () => {
      if (gen !== this.gen) return;
      const n = path.shift();
      idx.forEach(i => { arr[i] = n; });
      this.tokens();
      if (n !== 'done') this.pop(n);
      if (path.length) after(Math.round(190 * fast), step);
      else {
        if (e.captured.length) {
          e.captured.forEach(c => { if (this.disp[c.id]) this.disp[c.id][c.i] = -1; });
          this.boom(e.to); after(260, () => { if (gen === this.gen) this.tokens(); });
        }
        done(e.captured.length ? 700 : 280);
      }
    };
    step();
  },
  idle() {
    const v = this.v, ctx = this.ctx; if (!v) return;
    this.syncDisp(v); this.tokens();
    $('#yt-msg').textContent = v.msg;
    this.side(v);
    const mine = v.turnId === ctx.me && !v.over, acts = $('#yt-acts');
    const N = YutCore.NAME;
    $('#yt-chips').innerHTML = v.throws.map((x, i) => `<button class="yt-chip ${x === -1 ? 'back' : ''} ${mine && v.phase === 'move' && i === this.sel ? 'on' : ''}" data-act="ytSel" data-i="${i}" ${mine && v.phase === 'move' ? '' : 'disabled'}>${N[x]}<small>${x === -1 ? '-1' : x}</small></button>`).join('');
    if (this.sel >= v.throws.length) this.sel = 0;
    if (!mine) acts.innerHTML = v.over ? '' : `<span class="muted">${esc((v.players.find(p => p.id === v.turnId) || {}).name || '')} 님 차례…</span>`;
    else if (v.phase === 'throw') acts.innerHTML = '<button class="btn good lg yt-go" data-act="ytThrow">윷 던지기 <small>Space</small></button>';
    else acts.innerHTML = '<span class="yt-hint">반짝이는 말을 누르세요 (위 윷을 눌러 바꾸기)</span>';
    this.markMovable();
  },
  /** 고른 윷으로 움직일 수 있는 말을 반짝이게 */
  markMovable() {
    const v = this.v, ctx = this.ctx;
    $$('#yt-tokens .yt-tok').forEach(t => t.classList.remove('can'));
    $$('.yt-home i').forEach(t => t.classList.remove('can'));
    $('#yt-ghost').innerHTML = '';
    if (!v || v.turnId !== ctx.me || v.phase !== 'move' || this.busy) return;
    const me = v.players.find(p => p.id === ctx.me);
    for (const m of v.moves.filter(m => m.r === this.sel)) {
      const pos = me.pieces[m.piece].pos;
      if (pos === -1) $$(`.yt-home[data-id="${CSS.escape(ctx.me)}"] i.wait`).forEach(t => t.classList.add('can'));
      else { const tok = $(`#yt-tokens .yt-tok[data-id="${CSS.escape(ctx.me)}"][data-pos="${pos}"]`); if (tok) tok.classList.add('can'); }
    }
  },
  moveFor(pos) { const v = this.v, me = v.players.find(p => p.id === this.ctx.me); return v.moves.find(m => m.r === this.sel && me.pieces[m.piece].pos === pos); },
  ghost(pos) {
    const g = $('#yt-ghost'); g.innerHTML = '';
    const m = pos == null ? null : this.moveFor(pos); if (!m) return;
    const P = YutCore.POS;
    const pts = [pos === -1 ? [570, 590] : P[pos]].concat(m.path.filter(n => n !== 'done').map(n => P[n]));
    if (m.to === 'done') pts.push([575, 575]);
    g.innerHTML = `<polyline points="${pts.map(p => p.join(',')).join(' ')}" class="yt-route"/>` + (m.to === 'done' ? `<text class="yt-goal" x="545" y="505">골인!</text>` : `<circle class="yt-dest" cx="${P[m.to][0]}" cy="${P[m.to][1]}" r="22"/>`);
  },
  /** 판 위 말 그리기 (같은 사람의 같은 칸 말은 업힌 하나로) */
  tokens() {
    const v = this.v; if (!v) return;
    const P = YutCore.POS;
    let html = '';
    v.players.forEach((p, k) => {
      const arr = this.disp[p.id] || [], groups = {};
      arr.forEach(pos => { if (pos !== -1 && pos !== 'done') groups[pos] = (groups[pos] || 0) + 1; });
      for (const [pos, n] of Object.entries(groups)) {
        const [x, y] = P[pos];
        html += `<g class="yt-tok" data-id="${esc(p.id)}" data-pos="${pos}" transform="translate(${x},${y})" style="--pc:${p.color}">
          <circle class="sh" r="19" cy="3"/><circle class="b" r="18"/><circle class="t" r="12"/><text y="6">${n > 1 ? '×' + n : esc(p.name[0] || '')}</text></g>`;
      }
    });
    $('#yt-tokens').innerHTML = html;
    this.homes();
  },
  homes() {
    const v = this.v; if (!v) return;
    v.players.forEach(p => {
      const el = $(`.yt-home[data-id="${CSS.escape(p.id)}"]`); if (!el) return;
      const arr = this.disp[p.id] || [];
      el.innerHTML = arr.map(pos => `<i class="${pos === -1 ? 'wait' : pos === 'done' ? 'goal' : 'out'}" style="--pc:${p.color}"></i>`).join('');
    });
  },
  side(v) {
    $('#yt-players').innerHTML = v.players.map(p => `<div class="yt-p ${p.id === v.turnId && !v.over ? 'turn' : ''} ${p.id === v.winner ? 'win' : ''}" style="--pc:${p.color}">
      <div class="yt-p-top"><i class="dot"></i><b>${esc(p.name)}${p.id === this.ctx.me ? ' (나)' : ''}</b><em>골인 ${p.done}/${v.N}</em></div>
      <div class="yt-home" data-id="${esc(p.id)}" data-act="ytHome"></div></div>`).join('');
    this.homes();
  },
  /** 윷가락 던지기: v 에 맞게 배(평평한 면)/등 */
  sticks(v, fast) {
    const box = $('#yt-sticks'), call = $('#yt-call');
    const shuffled = [0, 1, 2, 3].sort(() => Math.random() - 0.5);      // 0번 윷가락에 빽도 표시
    const flat = v === -1 ? [0] : v === 5 ? [] : v === 4 ? [0, 1, 2, 3] : v === 1 ? [1 + rand(3)] : shuffled.slice(0, v);
    $$('#yt-sticks .yt-stick').forEach((s, i) => {
      s.classList.remove('flat', 'toss'); void s.offsetWidth;
      s.style.setProperty('--d', `${(i * 0.06) * fast}s`); s.style.setProperty('--r', `${(Math.random() * 30 - 15).toFixed(0)}deg`);
      s.classList.add('toss');
      after(Math.round(560 * fast), () => s.classList.toggle('flat', flat.includes(i)));
    });
    call.className = 'yt-call'; call.textContent = '';
    after(Math.round(700 * fast), () => { call.textContent = YutCore.NAME[v] + (v === 4 || v === 5 ? '!' : ''); call.className = 'yt-call show v' + v; });
  },
  pop(n) { const s = $(`#yt-spots [data-n="${n}"]`); if (s) { s.classList.remove('pop'); void s.getBoundingClientRect(); s.classList.add('pop'); } },
  boom(n) {
    const P = YutCore.POS[n]; if (!P) return;
    const fx = $('#yt-fx');
    fx.innerHTML = `<g transform="translate(${P[0]},${P[1]})"><circle class="yt-boom" r="20"/><text class="yt-catch" y="-34">잡았다!</text></g>`;
    setTimeout(() => { if (fx.firstChild) fx.innerHTML = ''; }, 1100);
  },
};
$('#yt-board').addEventListener('mouseover', e => { const t = e.target.closest('.yt-tok.can'); Yut.ghost(t ? Number(t.dataset.pos) : null); });
$('#yt-board').addEventListener('click', e => {
  const t = e.target.closest('.yt-tok.can'); if (!t || Yut.busy) return;
  const m = Yut.moveFor(Number(t.dataset.pos)); if (m) Yut.ctx.send({ t: 'move', r: m.r, piece: m.piece });
});
$('#scr-yut').addEventListener('mouseover', e => { if (e.target.closest('.yt-home i.can')) Yut.ghost(-1); });
Object.assign(ACT, {
  ytThrow: () => { const v = Yut.v, c = Yut.ctx; if (v && c && !Yut.busy && v.turnId === c.me && v.phase === 'throw') c.send({ t: 'throw' }); },
  ytSel: el => { Yut.sel = +el.dataset.i; $$('#yt-chips .yt-chip').forEach((b, i) => b.classList.toggle('on', i === Yut.sel)); Yut.markMovable(); },
  ytHome: el => {
    const v = Yut.v, c = Yut.ctx; if (!v || Yut.busy || el.dataset.id !== c.me) return;
    const m = Yut.moveFor(-1); if (m) c.send({ t: 'move', r: m.r, piece: m.piece });
  },
  ytSolo: el => {
    const so = Yut.so = Object.assign({ bots: 1, pieces: 4 }, Yut.so, el.dataset.bots ? { bots: +el.dataset.bots } : {}, el.dataset.pieces ? { pieces: +el.dataset.pieces } : {});
    Table.solo('yut', { bots: so.bots, opts: { pieces: so.pieces } });
    $$('#yt-solo .seg-btn').forEach(b => b.classList.toggle('on', +(b.dataset.bots || -1) === so.bots || +(b.dataset.pieces || -1) === so.pieces));
  },
});
Table.def('yut', {
  core: YutCore, render: (v, ctx, prev) => Yut.render(v, ctx, prev), solo: { bots: 1, opts: { pieces: 4 } },
  key: (e, ctx) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) ACT.ytThrow(); },
});
