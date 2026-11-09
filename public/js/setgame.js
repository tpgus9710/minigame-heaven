/* =====================================================================
 *  🔺 세트 찾기 (보드게임 SET 방식)
 *   싱글: 혼자 3분 도전(찾은 세트 수 기록) · AI 1~3명과 대결(쉬움 · 보통 · 고수)
 *   멀티: 모두 같은 바닥에서 먼저 찾기 (서버: games/setgame.js) · 규칙: shared/setgame-core.js
 *  카드 그림은 이 게임만의 디자인: 동그라미 · 세모 · 네모 / 빨강 · 초록 · 파랑 / 꽉 참 · 반만 · 빈
 *  카드 3장을 누르면 바로 확인해요. 틀리면 멀티 · AI 대결은 -1점 + 2초 쉬기, 3분 도전은 -5초.
 * ===================================================================== */
const SG = { COLORS: ['#e5383b', '#1f9d55', '#2f6fe4'], LOCK: 2000, SECONDS: 180, BOT_NAMES: ['봇 세모', '봇 네모', '봇 동그라미'] };
makeScreen('setgame', {
  title: '🔺 세트 찾기', status: '개수 · 모양 · 색 · 채우기가 각각 「모두 같거나 모두 다른」 카드 3장을 찾아 눌러요!',
  stats: [['score', '내 세트'], ['deck', '남은 카드'], ['time', '남은 시간']],
  body: `<div class="mode-row sg-modes" id="sg-solo">
      <button class="seg-btn on" data-act="sgMode" data-m="time">혼자 3분</button><button class="seg-btn" data-act="sgMode" data-m="ai1">AI 1명</button><button class="seg-btn" data-act="sgMode" data-m="ai2">AI 2명</button><button class="seg-btn" data-act="sgMode" data-m="ai3">AI 3명</button>
      <span class="sg-lv"><span class="muted small">AI 실력</span><button class="seg-btn" data-act="sgLv" data-lv="easy">쉬움</button><button class="seg-btn on" data-act="sgLv" data-lv="normal">보통</button><button class="seg-btn" data-act="sgLv" data-lv="hard">고수</button></span></div>
    <div class="sg-players" id="sg-players"></div>
    <div class="sg-wrap" id="sg-wrap"><div class="sg-board" id="sg-board"></div><div class="sg-msg" id="sg-msg"></div></div>
    <div class="sg-tools"><button class="btn ghost sm" data-act="sgHint" id="sg-hint">힌트 <small>-10초</small></button><span class="muted small" id="sg-info"></span></div>
    <svg width="0" height="0" class="sg-defs" aria-hidden="true"><defs><clipPath id="sg-half" clipPathUnits="objectBoundingBox"><rect x="-0.1" y="0.5" width="1.2" height="0.6"/></clipPath></defs></svg>`,
});
$('#scr-setgame').dataset.fitSelf = '1';                        // 카드 크기는 이 화면이 스스로 맞춰요 (fit)
LOBBY_OPTIONS.setgame = [                                          // 대기실 옵션 (서버 games/setgame.js 와 같아요)
  { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
  { key: 'sgLv', label: '🤖 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '고수']] },
];

const SetG = {
  mode: 'time', lv: 'normal', table: [], deck: 0, sel: [], score: {}, players: [], me: 'me', lockUntil: 0, over: true, port: true, ver: 0,
  /* ─── 카드 그림 (SVG) ─── */
  shape(k, x, y, col, fill) {
    const sw = 4.2, half = fill === 1, solid = fill === 0;
    const geo = [
      a => `<circle cx="${x}" cy="${y}" r="18" ${a}/>`,
      a => `<path d="M${x} ${y - 19}L${x + 18.5} ${y + 15.5}H${x - 18.5}Z" stroke-linejoin="round" ${a}/>`,
      a => `<rect x="${x - 17}" y="${y - 17}" width="34" height="34" rx="4" ${a}/>`,
    ][k];
    return (half ? geo(`fill="${col}" clip-path="url(#sg-half)"`) : '') + geo(`fill="${solid ? col : 'none'}" stroke="${col}" stroke-width="${sw}"`);
  },
  cardSVG(id) {
    const [n, sh, co, fi] = SetCore.attr(id), col = SG.COLORS[co], port = this.port, c = n + 1;
    let out = '';
    for (let k = 0; k < c; k++) {
      const off = (k - (c - 1) / 2) * 44;
      out += this.shape(sh, port ? 50 : 67.5 + off, port ? 67.5 + off : 50, col, fi);
    }
    return `<svg viewBox="0 0 ${port ? '100 135' : '135 100'}" aria-hidden="true">${out}</svg>`;
  },
  label(id) { const [n, sh, co, fi] = SetCore.attr(id), N = SetCore.NAMES; return `${N.color[co]} ${N.shape[sh]} ${N.n[n]} · ${N.fill[fi]}`; },

  /* ─── 화면 ─── */
  show() { stopLocal(); show('setgame'); },
  begin(players, me) {
    Object.assign(this, { players, me, sel: [], lockUntil: 0, over: false, ver: 0, hintId: null, score: Object.fromEntries(players.map(p => [p.id, 0])) });
    $('#sg-board').innerHTML = ''; $('#sg-msg').className = 'sg-msg';
    $('#sg-solo').classList.toggle('hidden', this.mode === 'multi');
    $('#scr-setgame .sg-lv').classList.toggle('hidden', !/^ai/.test(this.mode));
    $('#sg-hint').classList.toggle('hidden', this.mode !== 'time');
    $('#setgame-time-label').textContent = this.mode === 'time' ? '남은 시간' : '시간';
    this.players1();
  },
  players1() {
    const el = $('#sg-players');
    el.classList.toggle('hidden', this.players.length < 2);
    el.innerHTML = this.players.map(p => `<div class="sg-p${p.id === this.me ? ' me' : ''}${p.bot ? ' bot' : ''}" data-id="${esc(p.id)}"><b>${p.bot ? '🤖 ' : ''}${esc(p.id === this.me ? `${p.name} (나)` : p.name)}</b><span>${this.score[p.id] || 0}</span></div>`).join('');
  },
  scores() {
    $$('#sg-players .sg-p').forEach(el => { const s = el.querySelector('span'); if (s) s.textContent = this.score[el.dataset.id] || 0; });
    setStat('setgame', 'score', `${this.score[this.me] || 0}개`);
  },
  /** 바닥 그리기 (자리마다 카드 하나 · 바뀐 자리만 새로) */
  render(force) {
    const board = $('#sg-board');
    board.classList.toggle('port', this.port); board.classList.toggle('land', !this.port);
    const kids = [...board.children];
    this.table.forEach((id, i) => {
      let el = kids[i];
      if (el && !force && +el.dataset.id === id) { el.classList.toggle('sel', this.sel.includes(id)); return; }
      const fresh = !el;
      if (!el) { el = document.createElement('button'); el.className = 'sg-card'; board.append(el); }
      const changed = +el.dataset.id !== id;
      el.dataset.id = id; el.setAttribute('aria-label', this.label(id)); el.innerHTML = this.cardSVG(id);
      el.className = 'sg-card' + (this.sel.includes(id) ? ' sel' : '') + ((changed || fresh) && this.ver > 1 && !force ? ' new' : '');
    });
    kids.slice(this.table.length).forEach(el => el.remove());
    setStat('setgame', 'deck', `${this.deck}장`);
    $('#sg-info').textContent = `바닥 ${this.table.length}장 · 더미 ${this.deck}장`;
    if (board.dataset.n !== String(this.table.length)) { board.dataset.n = this.table.length; this.fit(); }
  },
  /** 카드 크기: 남는 자리에서 가장 크게 (세로 카드 · 가로 카드 중 큰 쪽) */
  fit() {
    const sec = $('#scr-setgame'), wrap = $('#sg-wrap'), board = $('#sg-board');
    if (!sec.classList.contains('active') || !wrap.clientWidth) return;
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' ? Fit.room(sec) : innerHeight - sec.getBoundingClientRect().top;
    const top = (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const below = ($('#scr-setgame .sg-tools').offsetHeight || 40) + 14;
    const H = Math.max(220, room - top - below - 4), W = wrap.clientWidth, N = Math.max(12, this.table.length), gap = W < 560 ? 8 : 12;
    let best = null;
    for (const port of [true, false]) for (let cols = 2; cols <= 8; cols++) {   // 비슷하면(3% 안) 열이 적고 세로 카드인 쪽 (손가락으로 누르기 좋게 높이를 채워요)
      const rows = Math.ceil(N / cols), ar = port ? 1.35 : 1 / 1.35;            // 높이 ÷ 너비
      let w = (W - gap * (cols - 1)) / cols, h = w * ar;
      if (h * rows + gap * (rows - 1) > H) { h = (H - gap * (rows - 1)) / rows; w = h / ar; }
      w = Math.min(w, port ? 150 : 200);
      const area = w * w * ar * (cols * rows - N > 2 ? 0.94 : 1);                // 빈 칸이 많이 남는 배치는 조금 덜
      if (!best || area > best.area * 1.03) best = { port, cols, w: Math.floor(w), area };
    }
    board.style.setProperty('--cols', best.cols); board.style.setProperty('--cw', best.w + 'px'); board.style.setProperty('--gap', gap + 'px');
    if (best.port !== this.port) { this.port = best.port; this.render(true); }
  },
  msg(html, cls, ms = 1500) {
    const m = $('#sg-msg'); m.innerHTML = html; m.className = 'sg-msg show ' + (cls || '');
    clearTimeout(this.mt); this.mt = setTimeout(() => m.classList.remove('show'), ms);
  },
  flash(ids, cls, ms) { ids.forEach(id => { const el = $(`#sg-board .sg-card[data-id="${id}"]`); if (el) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); } }); },

  /* ─── 고르기 ─── */
  tap(id) {
    if (this.over || !this.table.includes(id)) return;
    if (performance.now() < this.lockUntil) { this.msg('잠깐! 틀려서 2초 쉬는 중이에요', 'bad', 900); return; }
    if (this.pend) return;
    const i = this.sel.indexOf(id);
    if (i >= 0) this.sel.splice(i, 1); else this.sel.push(id);
    if (typeof Sound !== 'undefined') Sound.blip(i >= 0 ? 520 : 760, 0.03, 0.6);
    this.render();
    if (this.sel.length === 3) this.submit(this.sel.slice());
  },
  submit(ids) {
    if (this.mode === 'multi') { this.pend = true; socket.emit('sg:claim', ids); setTimeout(() => { this.pend = false; }, 800); return; }
    const r = SetCore.claim(this.s, ids);
    if (r === 'ok') this.got(this.me, ids);
    else if (r === 'late') { this.sel = []; this.render(); this.msg('한발 늦었어요!', '', 900); }   // AI가 방금 가져간 카드
    else this.bad(this.me, ids, SetCore.why(...ids));
  },
  /** 누군가 세트를 가져갔어요 → 반짝 → 새 바닥 */
  got(id, ids, v) {
    const p = this.players.find(x => x.id === id), mine = id === this.me;
    this.pend = false;
    this.score[id] = (v && v.score ? v.score[id] : (this.score[id] || 0) + 1);
    if (v && v.score) Object.assign(this.score, v.score);
    this.sel = this.sel.filter(x => !ids.includes(x));
    this.hintId = null;
    this.flash(ids, mine ? 'got' : 'took', 520);
    if (typeof Sound !== 'undefined') Sound.play(mine ? 'pop' : 'tap');
    this.msg(mine ? `세트! <b>+1</b>` : `${esc(p ? p.name : '')} 님이 찾았어요`, mine ? 'good' : '', 1100);
    const chip = $(`#sg-players .sg-p[data-id="${CSS.escape(id)}"]`); if (chip) { chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse'); }
    this.scores();
    const ver = ++this.ver;
    setTimeout(() => {
      if (ver !== this.ver && !v) return;
      if (v) { this.table = v.table.slice(); this.deck = v.deck; }
      else { this.table = this.s.table.slice(); this.deck = this.s.deck.length; }
      this.render();
      const added = v ? v.added : this.s.added;
      if (added) this.msg(`세트가 없어서 카드 ${added * 3}장을 더 놓았어요`, '', 1600);
      if (this.mode !== 'multi') this.afterChange();
    }, 430);
  },
  bad(id, ids, why, lock = SG.LOCK) {
    const mine = id === this.me;
    if (mine) {
      this.sel = [];
      this.flash(ids, 'bad', 500);
      if (typeof Sound !== 'undefined') Sound.play('bad');
      if (this.mode === 'time') { this.endAt -= 5000; this.msg(`세트가 아니에요 — ${esc(why)} <b>-5초</b>`, 'bad', 1600); }
      else { this.lockUntil = performance.now() + lock; this.msg(`세트가 아니에요 — ${esc(why)} <b>-1점 · 2초 쉬기</b>`, 'bad', lock); $('#sg-board').classList.add('locked'); setTimeout(() => $('#sg-board').classList.remove('locked'), lock); }
      setTimeout(() => this.render(), 480);
    } else {
      const p = this.players.find(x => x.id === id);
      this.msg(`${esc(p ? p.name : '')} 님 땡! (-1점)`, '', 1000);
    }
    if (this.mode !== 'time' && this.mode !== 'multi') this.score[id] = Math.max(0, (this.score[id] || 0) - 1);
    this.scores();
  },

  /* ─── 싱글 ─── */
  startSolo() {
    this.show();
    S.solo = 'setgame';
    const ai = /^ai(\d)$/.exec(this.mode), nb = ai ? +ai[1] : 0;
    const players = [{ id: 'me', name: nick() }].concat(Array.from({ length: nb }, (_, i) => ({ id: 'bot' + i, name: SG.BOT_NAMES[i], bot: true })));
    this.begin(players, 'me');
    this.s = SetCore.newGame(Math.random);
    this.table = this.s.table.slice(); this.deck = this.s.deck.length; this.ver = 1;
    this.hints = 3;
    this.render(true); this.scores(); this.fit();
    $('#sg-hint').innerHTML = `힌트 <small>${this.hints}회 · -10초</small>`;
    setStatus('setgame', nb ? `AI ${nb}명과 같은 바닥에서 먼저 찾기! 틀리면 -1점 · 2초 쉬기.` : '3분 동안 세트를 최대한 많이 찾아요. 틀리면 -5초 · 힌트는 -10초.');
    const t0 = performance.now();
    this.endAt = t0 + SG.SECONDS * 1000; this.t0 = t0;
    every(250, () => {
      if (this.over) return;
      if (this.mode === 'time') { setStat('setgame', 'time', leftSec(this.endAt) + '초'); if (performance.now() >= this.endAt) this.endSolo('time'); }
      else setStat('setgame', 'time', Math.floor((performance.now() - t0) / 1000) + '초');
    });
    this.planBots();
  },
  afterChange() {
    if (this.s.over) { this.over = true; setTimeout(() => this.endSolo('done'), 900); return; }
    this.planBots();
  },
  planBots() {
    const ver = this.ver;
    for (const p of this.players.filter(x => x.bot)) {
      after(SetCore.botDelay(this.lv, Math.random, this.s.table.length), () => {
        if (this.over || ver !== this.ver) return;
        const sets = SetCore.findSets(this.s.table);
        if (!sets.length) return;
        const ids = sets[Math.floor(Math.random() * sets.length)];
        if (SetCore.claim(this.s, ids) === 'ok') this.got(p.id, ids);
      });
    }
  },
  hint() {
    if (this.over || this.mode !== 'time' || !this.hints) return;
    const sets = SetCore.findSets(this.table);
    if (!sets.length) return;
    const set = sets.find(x => x.includes(this.hintId)) || sets[0];
    const show = set.find(id => id !== this.hintId && !this.sel.includes(id)) || set[0];
    this.hints--; this.endAt -= 10000; this.hintId = show;
    $('#sg-hint').innerHTML = `힌트 <small>${this.hints}회 · -10초</small>`;
    this.flash([show], 'hint', 2600);
  },
  endSolo(why) {
    if (this.mode === 'multi') return;
    this.over = true;
    const me = this.score.me || 0, timeMode = this.mode === 'time';
    if (timeMode) {
      const best = Math.max(+store.get('best-setgame', 0), me); store.set('best-setgame', best);
      showResult({ title: why === 'done' ? '🔺 카드를 모두 썼어요!' : '🔺 3분 끝!', subtitle: `찾은 세트 ${me}개 · 최고 기록 ${best}개`, solo: 'setgame', win: me >= 10, rec: { v: me } });
      return;
    }
    const ranked = this.players.slice().sort((a, b) => (this.score[b.id] || 0) - (this.score[a.id] || 0));
    const top = this.score[ranked[0].id] || 0, win = me === top && ranked.filter(p => (this.score[p.id] || 0) === top).length === 1;
    showResult({ title: win ? '🏆 AI를 이겼어요!' : me === top ? '🤝 공동 1등!' : '🔺 아쉽게 졌어요', subtitle: ranked.map(p => `${p.id === 'me' ? '나' : p.name} ${this.score[p.id] || 0}개`).join(' · '), solo: 'setgame', win });
  },

  /* ─── 멀티 ─── */
  startMulti(d) {
    if (!d.resync || !isScreen('setgame')) this.show();
    this.mode = 'multi';
    this.begin(d.players, S.myId);
    Object.assign(this.score, d.score || {});
    this.table = d.table.slice(); this.deck = d.deck; this.ver = d.ver || 1;
    this.render(true); this.scores(); this.fit(); renderScores();
    setStatus('setgame', '모두 같은 바닥! 세트를 먼저 찾아 3장을 누르면 내 거예요. 틀리면 -1점 · 2초 쉬기.');
    const t0 = performance.now() - (d.resync ? 0 : -(d.at || 0));
    every(500, () => { if (!this.over) setStat('setgame', 'time', Math.max(0, Math.floor((performance.now() - t0) / 1000)) + '초'); });
    if (d.at) { this.lockUntil = performance.now() + d.at; this.msg('준비… 시작!', 'good', d.at); }
  },
};
$('#sg-board').addEventListener('click', e => { const c = e.target.closest('.sg-card'); if (c) SetG.tap(+c.dataset.id); });
Object.assign(ACT, {
  sgMode: el => { SetG.mode = el.dataset.m; $$('#sg-solo [data-act=sgMode]').forEach(b => b.classList.toggle('on', b === el)); SetG.startSolo(); },
  sgLv: el => { SetG.lv = el.dataset.lv; $$('#sg-solo [data-act=sgLv]').forEach(b => b.classList.toggle('on', b === el)); if (/^ai/.test(SetG.mode)) SetG.startSolo(); },
  sgHint: () => SetG.hint(),
});
register('setgame', {
  solo: () => { if (SetG.mode === 'multi') SetG.mode = 'time'; SetG.startSolo(); },
  stop: () => { SetG.over = true; },
});
socket.on('sg:start', d => SetG.startMulti(d));
socket.on('sg:got', d => { if (isScreen('setgame') && SetG.mode === 'multi') SetG.got(d.id, d.ids, d); });
socket.on('sg:bad', d => {
  if (!isScreen('setgame') || SetG.mode !== 'multi') return;
  SetG.pend = false;
  Object.assign(SetG.score, d.score || {});
  SetG.bad(d.id, d.ids, d.why, d.lock);
});
socket.on('sg:late', () => { SetG.pend = false; SetG.sel = []; SetG.render(); SetG.msg('한발 늦었어요!', '', 900); });
window.addEventListener('resize', () => { if (isScreen('setgame')) { clearTimeout(SetG.rt); SetG.rt = setTimeout(() => SetG.fit(), 120); } });
