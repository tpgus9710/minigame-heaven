/* =====================================================================
 *  🔍 틀린그림찾기
 *   싱글: 혼자 단계 도전(그림마다 시간 안에 다른 곳 모두 찾기 · 갈수록 많고 작게 · 점수 기록) · AI 1~3명과 먼저 찾기
 *   멀티: 모두 같은 그림에서 먼저 찾은 사람이 가져가요 (서버: games/spot.js) · 그림 · 정답: shared/spot-core.js
 *  왼쪽 · 오른쪽 어느 그림을 눌러도 돼요. 찾으면 두 그림에 동그라미, 틀리면 빨간 X (혼자: -3초 · 대결: 1.5초 쉬기).
 * ===================================================================== */
const DF = {
  COLORS: ['#22c55e', '#f97316', '#3b82f6', '#e11d8f', '#a855f7', '#eab308', '#14b8a6', '#ef4444'],
  BOT_NAMES: ['봇 돋보기', '봇 망원경', '봇 현미경'], BOT_MS: { easy: [10000, 20000], normal: [5500, 12000], hard: [2800, 6500] },
  LOCK: 1500, PENALTY: 3, HINTS: 3,
};
makeScreen('spot', {
  title: '🔍 틀린그림찾기', status: '두 그림에서 다른 곳을 찾아 눌러요. 왼쪽 · 오른쪽 어느 그림을 눌러도 돼요!',
  stats: [['score', '점수'], ['stage', '단계'], ['time', '남은 시간']],
  body: `<div class="mode-row df-modes" id="df-solo">
      <button class="seg-btn on" data-act="dfMode" data-m="stage">혼자 단계 도전</button><button class="seg-btn" data-act="dfMode" data-m="ai1">AI 1명</button><button class="seg-btn" data-act="dfMode" data-m="ai2">AI 2명</button><button class="seg-btn" data-act="dfMode" data-m="ai3">AI 3명</button>
      <span class="df-opt" id="df-aiopt"><span class="muted small">AI 실력</span><button class="seg-btn" data-act="dfLv" data-lv="easy">쉬움</button><button class="seg-btn on" data-act="dfLv" data-lv="normal">보통</button><button class="seg-btn" data-act="dfLv" data-lv="hard">고수</button></span></div>
    <div class="df-players" id="df-players"></div>
    <div class="df-bar"><div class="df-dots" id="df-dots"></div><div class="df-time"><i id="df-tbar"></i></div></div>
    <div class="df-wrap" id="df-wrap">
      <div class="df-pic" data-side="0"><svg class="df-art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-label="왼쪽 그림"></svg><svg class="df-mk" viewBox="0 0 400 300"></svg></div>
      <div class="df-pic" data-side="1"><svg class="df-art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-label="오른쪽 그림"></svg><svg class="df-mk" viewBox="0 0 400 300"></svg></div>
      <div class="df-msg" id="df-msg"></div></div>
    <div class="df-tools"><button class="btn ghost sm" data-act="dfHint" id="df-hint">💡 힌트 <small>-5초</small></button><span class="muted small" id="df-info"></span></div>`,
});
$('#scr-spot').dataset.fitSelf = '1';
LOBBY_OPTIONS.spot = [                                            // 대기실 옵션 (서버 games/spot.js 와 같아요)
  { key: 'bots', label: '🤖 봇', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] },
  { key: 'dfLv', label: '🤖 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '고수']] },
  { key: 'rounds', label: '🖼️ 그림 수', def: 5, values: [[3, '3장'], [5, '5장'], [7, '7장']] },
  { key: 'diffs', label: '🔍 그림마다 다른 곳', def: 5, values: [[3, '3곳'], [5, '5곳'], [7, '7곳']] },
  { key: 'dfSec', label: '⏱️ 그림마다 시간', def: 60, values: [[45, '45초'], [60, '60초'], [90, '90초']] },
];

const Spot = {
  mode: 'stage', lv: 'normal', me: 'me', players: [], score: {}, puz: null, found: {}, phase: 'idle', round: 0, rounds: 0, lockUntil: 0, st: null, gen: 0,
  color(id) { const k = Math.max(0, this.players.findIndex(p => p.id === id)); return id === this.me ? DF.COLORS[0] : DF.COLORS[1 + ((k + DF.COLORS.length - 2) % (DF.COLORS.length - 1))]; },

  /* ─── 그림 · 표시 ─── */
  draw(puz) {
    this.puz = puz; this.found = {};
    const arts = $$('#df-wrap .df-art');
    arts[0].innerHTML = SpotCore.render(puz.bg, puz.left);
    arts[1].innerHTML = SpotCore.render(puz.bg, puz.right);
    $$('#df-wrap .df-mk').forEach(m => { m.innerHTML = ''; });
    $('#df-wrap').classList.remove('locked', 'done');
    this.dots();
    this.fit();
  },
  /** 찾은 곳: 두 그림에 같은 색 동그라미 */
  mark(i, color, cls = '') {
    const d = this.puz.diffs[i]; if (!d) return;
    const r = Math.max(13, d.r + 3);
    $$('#df-wrap .df-mk').forEach(m => m.insertAdjacentHTML('beforeend', `<g class="df-ring ${cls}" style="--c:${color}"><circle cx="${d.x}" cy="${d.y}" r="${n1x(r)}" /><circle class="df-glow" cx="${d.x}" cy="${d.y}" r="${n1x(r)}" /></g>`));
  },
  cross(side, x, y) {
    const m = $$('#df-wrap .df-mk')[side]; if (!m) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'df-x'); g.innerHTML = `<path d="M${x - 9},${y - 9} L${x + 9},${y + 9} M${x + 9},${y - 9} L${x - 9},${y + 9}"/>`;
    m.append(g); setTimeout(() => g.remove(), 700);
  },
  hintRing(i) {
    const d = this.puz.diffs[i];
    $$('#df-wrap .df-mk').forEach(m => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); g.setAttribute('class', 'df-hintc'); g.setAttribute('cx', d.x); g.setAttribute('cy', d.y); g.setAttribute('r', Math.max(16, d.r + 8)); m.append(g); setTimeout(() => g.remove(), 2400); });
  },
  dots() {
    const n = this.puz ? this.puz.diffs.length : 0;
    $('#df-dots').innerHTML = Array.from({ length: n }, (_, i) => { const f = this.found[i]; return `<i class="${f != null ? 'on' : ''}" style="${f != null ? `--c:${this.color(f)}` : ''}"></i>`; }).join('')
      + `<b>${Object.keys(this.found).length} / ${n}</b>`;
  },
  msg(html, cls = '', ms = 1300) {
    const m = $('#df-msg'); m.innerHTML = html; m.className = 'df-msg show ' + cls;
    clearTimeout(this.mt); this.mt = setTimeout(() => m.classList.remove('show'), ms);
  },
  timeBar(left, total) {
    const k = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
    const b = $('#df-tbar'); b.style.width = (k * 100) + '%'; b.classList.toggle('low', left < 10000);
  },
  players1() {
    const el = $('#df-players');
    el.classList.toggle('hidden', this.players.length < 2);
    el.innerHTML = this.players.map(p => `<div class="df-p${p.id === this.me ? ' me' : ''}${p.bot ? ' bot' : ''}" data-id="${esc(p.id)}" style="--c:${this.color(p.id)}"><i></i><b>${p.bot ? '🤖 ' : ''}${esc(p.id === this.me ? `${p.name} (나)` : p.name)}</b><span>${this.score[p.id] || 0}</span></div>`).join('');
  },
  scores() {
    $$('#df-players .df-p').forEach(el => { const s = el.querySelector('span'); if (s) s.textContent = this.score[el.dataset.id] || 0; });
  },
  /** 그림 크기: 옆으로 두 장 · 위아래 두 장 중 더 크게 보이는 쪽 */
  fit() {
    const sec = $('#scr-spot'), wrap = $('#df-wrap');
    if (!sec.classList.contains('active') || !wrap.clientWidth) return;
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' ? Fit.room(sec) : innerHeight - sec.getBoundingClientRect().top;
    const top = (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const below = ($('#scr-spot .df-tools').offsetHeight || 36) + 10;
    const H = Math.max(180, room - top - below - 4), W = wrap.clientWidth, gap = 10;
    const side = Math.min((W - gap) / 2, H * 4 / 3), stack = Math.min(W, ((H - gap) / 2) * 4 / 3);
    const useSide = side >= stack * 0.96;
    wrap.classList.toggle('side', useSide); wrap.classList.toggle('stack', !useSide);
    wrap.style.setProperty('--pw', Math.floor(Math.max(150, useSide ? side : stack)) + 'px');
  },
  modeUI(multi) {
    $('#scr-spot').classList.toggle('mp', multi);                 // 멀티: 위쪽 점수판이 있어서 낮은 화면에서는 이름 줄을 접어요 (spot.css)
    $('#df-solo').classList.toggle('hidden', multi);
    $('#df-aiopt').classList.toggle('hidden', this.mode === 'stage');
    $('#df-hint').classList.toggle('hidden', multi || this.mode !== 'stage');
    $$('#df-solo [data-act=dfMode]').forEach(b => b.classList.toggle('on', b.dataset.m === this.mode));
    $$('#df-solo [data-act=dfLv]').forEach(b => b.classList.toggle('on', b.dataset.lv === this.lv));
  },
  labels(a, b, c) { $('#spot-score-label').textContent = a; $('#spot-stage-label').textContent = b; $('#spot-time-label').textContent = c; },

  /* ─── 누르기 ─── */
  tap(e) {
    const pic = e.target.closest('.df-pic'); if (!pic || !this.puz) return;
    const r = pic.querySelector('.df-art').getBoundingClientRect();
    const k = Math.min(r.width / 400, r.height / 300), ox = r.left + (r.width - 400 * k) / 2, oy = r.top + (r.height - 300 * k) / 2;
    const x = (e.clientX - ox) / k, y = (e.clientY - oy) / k, side = +pic.dataset.side;
    if (x < 0 || x > 400 || y < 0 || y > 300) return;
    if (this.phase !== 'play') return;
    if (performance.now() < this.lockUntil) { this.msg('잠깐! 틀려서 쉬는 중이에요', 'bad', 700); return; }
    const tol = Math.max(9, 14 / k);                                // 작은 화면은 손가락 여유를 조금 더
    if (this.mode === 'multi') { socket.emit('df:tap', { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: this.round }); this.lastTap = { side, x, y }; return; }
    const i = SpotCore.hit(this.puz.diffs, x, y, this.found, tol);
    if (i >= 0) return this.got(this.me, i);
    if (SpotCore.near(this.puz.diffs, x, y, this.found, tol)) return;
    this.miss(side, x, y);
  },
  got(id, i, sc) {
    if (this.found[i] != null) return;
    this.found[i] = id;
    if (sc) Object.assign(this.score, sc); else this.score[id] = (this.score[id] || 0) + 1;
    const mine = id === this.me;
    this.mark(i, this.color(id), mine ? 'mine' : 'other');
    if (typeof Sound !== 'undefined') Sound.play(mine ? 'pop' : 'tap');
    if (!mine) { const p = this.players.find(x => x.id === id); this.msg(`${esc(p ? p.name : '')} 님이 찾았어요`, '', 800); }
    if (this.st) { this.st.score += 100; this.paintStage(); }
    this.dots(); this.scores(); this.statsVs();
    if (Object.keys(this.found).length >= this.puz.diffs.length && this.mode !== 'multi') this.roundDone();
  },
  miss(side, x, y) {
    this.cross(side, x, y);
    if (typeof Sound !== 'undefined') Sound.play('bad');
    if (this.st) { this.st.endAt -= DF.PENALTY * 1000; this.msg(`틀렸어요 <b>-${DF.PENALTY}초</b>`, 'bad', 700); return; }
    this.lockUntil = performance.now() + DF.LOCK;
    $('#df-wrap').classList.add('locked'); setTimeout(() => $('#df-wrap').classList.remove('locked'), DF.LOCK);
    this.msg('틀렸어요 — 1.5초 쉬기', 'bad', DF.LOCK);
  },
  /** 못 찾은 곳 보여 주기 */
  reveal(list) { list.forEach(i => this.mark(i, '#9aa3b5', 'missed')); $('#df-wrap').classList.add('done'); },

  /* ─── 혼자 단계 도전 ─── */
  startSolo() { if (this.mode === 'stage') this.startStage(); else this.startVs(+this.mode.slice(2) || 1); },
  startStage() {
    stopLocal();
    S.solo = 'spot';
    show('spot');
    this.mode = 'stage'; this.me = 'me'; this.players = [{ id: 'me', name: nick() }]; this.score = { me: 0 };
    this.st = { stage: 0, score: 0, hints: DF.HINTS, over: false };
    this.modeUI(false); this.players1();
    this.labels('점수', '단계', '남은 시간');
    setStatus('spot', '그림마다 시간 안에 다른 곳을 모두 찾아요. 틀리면 -3초 · 힌트는 -5초. 단계가 오를수록 다른 곳이 많고 작아져요.');
    this.stage(0);
    every(150, () => this.tickStage());
  },
  stage(k) {
    const st = this.st, n = Math.min(7, 3 + Math.floor(k / 2)), lv = k < 2 ? 1 : k < 5 ? 2 : 3;
    Object.assign(st, { stage: k, n, sec: 40 + n * 8 });
    this.phase = 'ready';
    this.draw(SpotCore.make(1 + Math.floor(Math.random() * 2147480000), n, lv));
    this.msg(`<b>${k + 1}단계</b> 다른 곳 ${n}곳 · ${st.sec}초`, 'info', 900);
    $('#df-info').textContent = `${SpotCore.THEME_NAMES[this.puz.theme]} · 힌트 ${st.hints}번 남음`;
    st.endAt = performance.now() + 900 + st.sec * 1000; st.total = st.sec * 1000;
    const id = st.token = (st.token || 0) + 1;
    after(900, () => { if (st.token === id && !st.over) this.phase = 'play'; });
    this.paintStage();
  },
  paintStage() {
    const st = this.st;
    setStat('spot', 'score', st.score.toLocaleString('ko-KR') + '점');
    setStat('spot', 'stage', `${st.stage + 1}단계`);
    $('#df-hint').disabled = !st.hints || this.phase !== 'play';
    $('#df-hint').innerHTML = `💡 힌트 <small>${st.hints}번 · -5초</small>`;
  },
  tickStage() {
    const st = this.st;
    if (!st || st.over || this.mode !== 'stage') return;
    const left = st.endAt - performance.now();
    if (this.phase === 'play' || this.phase === 'ready') {
      setStat('spot', 'time', Math.max(0, Math.ceil(left / 1000)) + '초');
      this.timeBar(left, st.total);
      $('#df-hint').disabled = !st.hints || this.phase !== 'play';
      if (left <= 0 && this.phase === 'play') this.endStage();
    }
  },
  hint() {
    const st = this.st;
    if (!st || this.phase !== 'play' || !st.hints) return;
    const left = this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null);
    if (!left.length) return;
    st.hints--; st.endAt -= 5000;
    this.hintRing(left[Math.floor(Math.random() * left.length)]);
    $('#df-info').textContent = `${SpotCore.THEME_NAMES[this.puz.theme]} · 힌트 ${st.hints}번 남음`;
    this.paintStage();
  },
  roundDone() {
    if (this.mode === 'stage') {
      const st = this.st;
      this.phase = 'gap';
      const left = Math.max(0, Math.ceil((st.endAt - performance.now()) / 1000)), bonus = left * 5;
      st.score += bonus; this.paintStage();
      $('#df-wrap').classList.add('done');
      this.msg(`<b>${st.stage + 1}단계 성공!</b><br>남은 시간 ${left}초 × 5 = +${bonus}`, 'good', 1700);
      if (typeof Sound !== 'undefined') Sound.play('mission');
      after(1900, () => { if (this.st === st && !st.over) this.stage(st.stage + 1); });
      return;
    }
    this.endVsRound();
  },
  endStage() {
    const st = this.st;
    if (st.over) return;
    st.over = true; this.phase = 'over';
    this.reveal(this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null));
    const best = Math.max(+store.get('best-spot', 0), st.score); store.set('best-spot', best);
    this.msg('⏰ 시간 끝! 못 찾은 곳은 회색 동그라미', 'bad', 2000);
    after(2200, () => showResult({
      title: `⏰ ${st.stage + 1}단계에서 시간 끝!`, subtitle: `${st.stage}단계 성공 · ${st.score.toLocaleString('ko-KR')}점 · 최고 ${best.toLocaleString('ko-KR')}점`,
      solo: 'spot', win: st.stage >= 5, rec: { v: st.score },
    }));
  },

  /* ─── AI 대결 (화면 안에서) ─── */
  startVs(nb) {
    stopLocal();
    S.solo = 'spot';
    show('spot');
    this.st = null; this.me = 'me';
    this.players = [{ id: 'me', name: nick() }].concat(Array.from({ length: nb }, (_, i) => ({ id: 'bot' + i, name: DF.BOT_NAMES[i], bot: true })));
    this.score = Object.fromEntries(this.players.map(p => [p.id, 0]));
    this.round = 0; this.rounds = 5; this.vsN = 5; this.vsSec = 60;
    this.modeUI(false); this.players1();
    this.labels('내 점수', '그림', '남은 시간');
    setStatus('spot', `AI ${nb}명과 같은 그림에서 먼저 찾기! 다른 곳 1곳 = 1점 · 틀리면 1.5초 쉬기.`);
    $('#df-info').textContent = '';
    this.vsNext();
    every(200, () => {
      if (this.mode === 'stage' || this.mode === 'multi' || this.phase !== 'play') return;
      const left = this.vsEnd - performance.now();
      setStat('spot', 'time', Math.max(0, Math.ceil(left / 1000)) + '초'); this.timeBar(left, this.vsSec * 1000);
      if (left <= 0) this.endVsRound();
    });
  },
  vsNext() {
    if (this.round >= this.rounds) return this.endVs();
    this.round++;
    this.draw(SpotCore.make(1 + Math.floor(Math.random() * 2147480000), this.vsN, 2));
    this.phase = 'ready';
    this.statsVs();
    this.msg(`<b>그림 ${this.round} / ${this.rounds}</b>`, 'info', 800);
    $('#df-info').textContent = SpotCore.THEME_NAMES[this.puz.theme];
    const gen = ++this.gen;
    this.vsEnd = performance.now() + 900 + this.vsSec * 1000;
    after(900, () => {
      if (gen !== this.gen) return;
      this.phase = 'play';
      for (const p of this.players.filter(x => x.bot)) this.planBot(p.id, gen);
    });
  },
  planBot(id, gen) {
    const [lo, hi] = DF.BOT_MS[this.lv] || DF.BOT_MS.normal;
    after(lo + Math.random() * (hi - lo), () => {
      if (gen !== this.gen || this.phase !== 'play') return;
      const left = this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null);
      if (!left.length) return;
      this.got(id, left[Math.floor(Math.random() * left.length)]);
      this.planBot(id, gen);
    });
  },
  endVsRound() {
    if (this.phase !== 'play') return;
    this.phase = 'gap'; this.gen++;
    const missed = this.puz.diffs.map((_, i) => i).filter(i => this.found[i] == null);
    this.reveal(missed);
    this.msg(missed.length ? `시간 끝! 못 찾은 곳 ${missed.length}곳` : '모두 찾았어요!', missed.length ? '' : 'good', 1500);
    after(2600, () => this.vsNext());
  },
  endVs() {
    this.phase = 'over';
    const ranked = this.players.slice().sort((a, b) => (this.score[b.id] || 0) - (this.score[a.id] || 0));
    const me = this.score.me || 0, top = this.score[ranked[0].id] || 0, win = me === top && ranked.filter(p => (this.score[p.id] || 0) === top).length === 1;
    showResult({ title: win ? '🏆 AI를 이겼어요!' : me === top ? '🤝 공동 1등!' : '🔍 아쉽게 졌어요', subtitle: ranked.map(p => `${p.id === 'me' ? '나' : p.name} ${this.score[p.id] || 0}곳`).join(' · '), solo: 'spot', win });
  },
  statsVs() {
    if (this.st) return;
    setStat('spot', 'score', `${this.score[this.me] || 0}곳`);
    setStat('spot', 'stage', `${this.round}/${this.rounds}`);
  },

  /* ─── 멀티 ─── */
  startMulti(d) {
    if (!d.resync || !isScreen('spot')) { stopLocal(); show('spot'); }
    this.mode = 'multi'; this.st = null; this.me = S.myId; this.gen++;
    this.players = d.players; this.score = Object.assign(Object.fromEntries(d.players.map(p => [p.id, 0])), d.score || {});
    this.rounds = d.rounds; this.round = 0; this.vsSec = d.sec; this.phase = 'ready';
    this.modeUI(true); this.players1();
    this.labels('내 점수', '그림', '남은 시간');
    setStatus('spot', '모두 같은 그림! 다른 곳을 먼저 찾아 누르면 내 점수예요. 틀리면 1.5초 쉬기.');
    $('#df-dots').innerHTML = ''; $('#df-info').textContent = '곧 첫 그림이 나와요';
    this.statsVs(); renderScores();
    every(200, () => {
      if (this.mode !== 'multi' || this.phase !== 'play') return;
      const left = this.vsEnd - performance.now();
      setStat('spot', 'time', Math.max(0, Math.ceil(left / 1000)) + '초'); this.timeBar(left, this.vsSec * 1000);
    });
  },
  roundMulti(d) {
    if (this.mode !== 'multi') return;
    this.round = d.round; this.rounds = d.rounds; this.vsSec = d.sec;
    this.draw(SpotCore.make(d.seed, d.n, d.lv));
    if (d.score) Object.assign(this.score, d.score);
    (d.found || []).forEach(([i, id]) => { this.found[i] = id; this.mark(i, this.color(id), id === this.me ? 'mine' : 'other'); });
    this.dots(); this.scores(); this.statsVs();
    this.vsEnd = performance.now() + d.left;                       // left 는 준비 시간까지 들어 있어요
    $('#df-info').textContent = SpotCore.THEME_NAMES[this.puz.theme];
    if (d.gap) { this.phase = 'gap'; return; }
    this.phase = 'ready';
    if (!d.resync) this.msg(`<b>그림 ${d.round} / ${d.rounds}</b>`, 'info', 800);
    const gen = ++this.gen;
    after(d.at || 0, () => { if (gen === this.gen) this.phase = 'play'; });
  },
};
const n1x = v => Math.round(v * 10) / 10;
$('#df-wrap').addEventListener('pointerdown', e => { if (e.button === 0 || e.pointerType !== 'mouse') Spot.tap(e); });
Object.assign(ACT, {
  dfMode: el => { Spot.mode = el.dataset.m; Spot.startSolo(); },
  dfLv: el => { Spot.lv = el.dataset.lv; if (Spot.mode !== 'stage') Spot.startSolo(); else Spot.modeUI(false); },
  dfHint: () => Spot.hint(),
});
register('spot', {
  solo: () => { if (Spot.mode === 'multi') Spot.mode = 'stage'; Spot.startSolo(); },
  stop: () => { if (Spot.st) Spot.st.over = true; Spot.gen++; Spot.phase = 'idle'; },
});
socket.on('df:start', d => Spot.startMulti(d));
socket.on('df:round', d => { if (isScreen('spot')) Spot.roundMulti(d); });
socket.on('df:found', d => { if (isScreen('spot') && Spot.mode === 'multi' && d.round === Spot.round) Spot.got(d.id, d.i, d.score); });
socket.on('df:miss', d => { if (isScreen('spot') && Spot.mode === 'multi') { const t = Spot.lastTap; Spot.miss(t ? t.side : 1, d.x, d.y); } });
socket.on('df:end', d => {
  if (!isScreen('spot') || Spot.mode !== 'multi' || d.round !== Spot.round) return;
  Spot.phase = 'gap';
  if (d.score) Object.assign(Spot.score, d.score);
  Spot.reveal(d.missed || []); Spot.scores(); Spot.statsVs();
  Spot.msg(d.why === 'all' ? '모두 찾았어요!' : `시간 끝! 못 찾은 곳 ${(d.missed || []).length}곳`, d.why === 'all' ? 'good' : '', 1500);
});
window.addEventListener('resize', () => { if (isScreen('spot')) { clearTimeout(Spot.rt); Spot.rt = setTimeout(() => Spot.fit(), 120); } });
