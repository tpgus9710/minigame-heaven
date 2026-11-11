/* =====================================================================
 *  🧠 카드 짝 맞추기 (기억력 게임)
 *   싱글: 혼자 단계 도전(8단계 · 처음에 잠깐 보여 주고 엎어요 · 시간 안에 모두 맞히기 · 점수 기록)
 *         AI 1~3명과 대결(차례대로 · 실력 = 기억력) — 규칙: shared/memory-core.js (TableKit)
 *   멀티: 차례대로 2장씩 (서버: games/table.js 가 memory-core 를 돌려요) · 봇 0~3명
 *  카드는 3D 로 뒤집혀요. 틀린 두 장은 잠깐 보여 준 뒤 다시 엎어요.
 * ===================================================================== */
const MMC = {
  STAGES: [6, 8, 10, 12, 15, 18, 21, 24],                  // 단계마다 짝 수 (카드는 2배)
  THEME_CYCLE: ['animal', 'food', 'thing', 'mix'],
  OWN: ['#7c6cff', '#22b07d', '#ff7a59', '#3a8dde', '#e0559a', '#e09b16', '#1fa5b4', '#9b6bff'],
};
makeScreen('memory', {
  title: '🧠 카드 짝 맞추기', status: '카드 2장을 뒤집어 같은 그림을 찾아요. 한 번 본 자리를 잘 외워 두세요!',
  stats: [['score', '점수'], ['stage', '단계'], ['time', '남은 시간']],
  body: `<div class="mode-row mm-modes" id="mm-solo">
      <button class="seg-btn on" data-act="mmMode" data-m="stage">혼자 단계 도전</button><button class="seg-btn" data-act="mmMode" data-m="ai1">AI 1명</button><button class="seg-btn" data-act="mmMode" data-m="ai2">AI 2명</button><button class="seg-btn" data-act="mmMode" data-m="ai3">AI 3명</button>
      <span class="mm-opt" id="mm-aiopt"><span class="muted small">AI 실력</span><button class="seg-btn" data-act="mmLv" data-lv="easy">쉬움</button><button class="seg-btn on" data-act="mmLv" data-lv="normal">보통</button><button class="seg-btn" data-act="mmLv" data-lv="hard">고수</button>
        <span class="muted small">카드</span><button class="seg-btn" data-act="mmPairs" data-n="8">16장</button><button class="seg-btn on" data-act="mmPairs" data-n="12">24장</button><button class="seg-btn" data-act="mmPairs" data-n="18">36장</button></span></div>
    <div class="mm-players" id="mm-players"></div>
    <div class="mm-wrap" id="mm-wrap"><div class="mm-board" id="mm-board"></div><div class="mm-msg" id="mm-msg"></div></div>
    <div class="mm-tools"><button class="btn ghost sm" data-act="mmPeek" id="mm-peek">👀 다시 보기 <small>1번 · -5초</small></button><span class="muted small" id="mm-info"></span></div>`,
});
$('#scr-memory').dataset.fitSelf = '1';                        // 카드 크기는 이 화면이 스스로 맞춰요 (fit)

const MM = {
  mode: 'stage', lv: 'normal', pairs: 12, st: null, v: null, ctx: null, gen: null, lastN: 0, missShow: null, pend: -1,
  /* ─── 판 그리기 (단계 도전 · 대결 공통) ─── */
  build(n) {
    const board = $('#mm-board');
    if (board.children.length !== n) {
      board.innerHTML = Array.from({ length: n }, (_, i) => `<button class="mm-card" data-i="${i}" aria-label="카드 ${i + 1}"><span class="mm-in"><span class="mm-b"></span><span class="mm-f"><i></i></span></span></button>`).join('');
      board.dataset.n = n;
    }
    $$('#mm-board .mm-card').forEach(el => { el.className = 'mm-card'; el.style.removeProperty('--own'); });
    this.fit();
  },
  /** 카드 하나 모양: up(앞면) · face(그림) · got(가져감, own 색) · miss(틀림) */
  card(i, o) {
    const el = $('#mm-board').children[i]; if (!el) return;
    const f = el.querySelector('.mm-f i');
    if (o.face != null && f.textContent !== o.face) f.textContent = o.face;
    el.classList.toggle('up', !!o.up);
    el.classList.toggle('got', !!o.got);
    el.classList.toggle('miss', !!o.miss);
    if (o.own) el.style.setProperty('--own', o.own); else el.style.removeProperty('--own');
    el.setAttribute('aria-label', o.up && o.face ? `카드 ${i + 1}: ${o.face}` : `카드 ${i + 1}`);
  },
  pop(ids, cls, ms = 600) {
    ids.forEach(i => { const el = $('#mm-board').children[i]; if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); });
  },
  /** 카드 크기: 남는 자리에서 가장 크게 (가로 4 : 세로 5) */
  fit() {
    const sec = $('#scr-memory'), wrap = $('#mm-wrap'), board = $('#mm-board');
    if (!sec.classList.contains('active') || !wrap.clientWidth) return;
    const n = board.children.length || 12, z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' ? Fit.room(sec) : innerHeight - sec.getBoundingClientRect().top;
    const top = (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const below = ($('#scr-memory .mm-tools').offsetHeight || 36) + 12;
    const H = Math.max(200, room - top - below - 4), W = wrap.clientWidth, gap = W < 560 ? 6 : 10;
    let best = null;
    for (let cols = 2; cols <= 12; cols++) {
      const rows = Math.ceil(n / cols);
      let w = (W - gap * (cols - 1)) / cols;
      if (w * 1.25 * rows + gap * (rows - 1) > H) w = ((H - gap * (rows - 1)) / rows) / 1.25;
      w = Math.min(w, 132);
      const score = w * (cols * rows - n > cols - 1 ? 0.9 : 1);                  // 빈칸이 한 줄 넘게 남는 배치는 덜
      if (!best || score > best.score + 0.5) best = { cols, w: Math.floor(w), score };
    }
    board.style.setProperty('--cols', best.cols); board.style.setProperty('--cw', Math.max(30, best.w) + 'px'); board.style.setProperty('--gap', gap + 'px');
  },
  msg(html, cls = '', ms = 1300) {
    const m = $('#mm-msg'); m.innerHTML = html; m.className = 'mm-msg show ' + cls;
    clearTimeout(this.mt); this.mt = setTimeout(() => m.classList.remove('show'), ms);
  },
  labels(a, b, c) { $('#memory-score-label').textContent = a; $('#memory-stage-label').textContent = b; $('#memory-time-label').textContent = c; },
  modeUI(multi) {
    $('#mm-solo').classList.toggle('hidden', multi);
    $('#mm-aiopt').classList.toggle('hidden', this.mode === 'stage');
    $('#mm-peek').classList.toggle('hidden', multi || this.mode !== 'stage');
    $$('#mm-solo [data-act=mmMode]').forEach(b => b.classList.toggle('on', b.dataset.m === this.mode));
    $$('#mm-solo [data-act=mmLv]').forEach(b => b.classList.toggle('on', b.dataset.lv === this.lv));
    $$('#mm-solo [data-act=mmPairs]').forEach(b => b.classList.toggle('on', +b.dataset.n === this.pairs));
  },

  /* ─── 싱글: 고른 방식으로 시작 ─── */
  startSolo() {
    if (this.mode === 'stage') return this.startStage();
    const n = +this.mode.slice(2) || 1;
    Table.solo('memory', { bots: n, opts: { mmLv: this.lv, pairs: this.pairs, peek: 3, theme: 'mix' } });
    this.modeUI(false);
  },

  /* ─── 혼자 단계 도전 ─── */
  startStage() {
    stopLocal();
    S.solo = 'memory';
    show('memory');
    this.gen = null; this.v = null;
    this.st = { stage: 0, score: 0, over: false };
    this.modeUI(false);
    $('#mm-players').classList.add('hidden');
    this.labels('점수', '단계', '남은 시간');
    setStatus('memory', '처음에 잠깐 보여 주는 카드 자리를 외운 뒤, 2장씩 뒤집어 같은 그림을 찾아요. 시간 안에 모두 맞히면 다음 단계!');
    this.stage(0);
    every(200, () => this.tickStage());
  },
  stage(k) {
    const st = this.st, pairs = MMC.STAGES[k], theme = MMC.THEME_CYCLE[k % MMC.THEME_CYCLE.length];
    Object.assign(st, { stage: k, pairs, faces: MemoryCore.deal(pairs, theme, Math.random), sel: [], combo: 0, miss: 0, peekUsed: false, phase: 'ready', endAt: 0, limit: pairs * 5 + 8 });
    st.got = st.faces.map(() => false);
    this.build(st.faces.length);
    st.faces.forEach((f, i) => this.card(i, { up: false, face: f }));
    const peekMs = 1700 + pairs * 130;
    st.peekMs = peekMs;
    this.msg(`<b>${k + 1}단계</b> 카드 ${pairs * 2}장<br>${Math.round(peekMs / 1000)}초 동안 보여 줄게요 — 외워요!`, 'info', 850);   // 카드를 가리지 않게, 보여 주기 전에만
    this.paintStage();
    const id = st.token = (st.token || 0) + 1;
    after(950, () => {
      if (st.token !== id || st.over) return;
      st.faces.forEach((f, i) => this.card(i, { up: true, face: f }));
      st.phase = 'peek'; st.peekEnd = performance.now() + peekMs;
      this.paintStage();
      after(peekMs, () => {
        if (st.token !== id || st.over) return;
        st.faces.forEach((f, i) => this.card(i, { up: false, face: f }));
        st.phase = 'play'; st.endAt = performance.now() + st.limit * 1000;
        if (typeof Sound !== 'undefined') Sound.blip(440, 0.05, 0.7);
        this.paintStage();
      });
    });
  },
  paintStage() {
    const st = this.st;
    setStat('memory', 'score', st.score.toLocaleString('ko-KR') + '점');
    setStat('memory', 'stage', `${st.stage + 1}/${MMC.STAGES.length}`);
    const left = st.got.filter(x => !x).length / 2;
    $('#mm-info').innerHTML = st.phase === 'peek' ? `<b class="mm-hl">👀 외우는 중 · ${Math.max(1, Math.ceil((st.peekEnd - performance.now()) / 1000))}초</b>` : st.phase === 'ready' ? '곧 카드를 보여 줘요' : `남은 짝 ${left} · 틀린 횟수 ${st.miss}${st.combo > 1 ? ` · ${st.combo}연속!` : ''}`;
    $('#mm-peek').disabled = st.peekUsed || st.phase !== 'play';
  },
  tickStage() {
    const st = this.st;
    if (!st || st.over) return;
    if (st.phase !== 'play') { setStat('memory', 'time', st.phase === 'peek' || st.phase === 'ready' ? `${st.limit}초` : '-'); if (st.phase === 'peek') this.paintStage(); return; }
    const left = (st.endAt - performance.now()) / 1000;
    setStat('memory', 'time', Math.max(0, Math.ceil(left)) + '초');
    $('#memory-time-box').classList.toggle('warn', left < 10);
    if (left <= 0) this.endStage(false);
  },
  tapStage(i) {
    const st = this.st;
    if (!st || st.phase !== 'play' || st.got[i] || st.sel.includes(i) && st.sel.length < 2) return;
    if (st.sel.length === 2) {                                   // 틀린 두 장을 보는 중에 다른 카드를 누르면 바로 엎고 새로
      clearTimeout(st.missT);
      st.sel.forEach(j => this.card(j, { up: false }));
      st.sel = [];
      if (this.st.got[i]) return;
    }
    st.sel.push(i);
    this.card(i, { up: true, face: st.faces[i] });
    if (typeof Sound !== 'undefined') Sound.blip(st.sel.length === 1 ? 660 : 760, 0.03, 0.6);
    if (st.sel.length < 2) return;
    const [a, b] = st.sel;
    if (st.faces[a] === st.faces[b]) {
      st.got[a] = st.got[b] = true; st.sel = []; st.combo++;
      const gain = 100 + 25 * (st.combo - 1);
      st.score += gain;
      const own = MMC.OWN[(st.stage + st.combo) % MMC.OWN.length];
      [a, b].forEach(j => this.card(j, { up: true, face: st.faces[j], got: true, own }));
      this.pop([a, b], 'hit');
      if (typeof Sound !== 'undefined') Sound.play('pop');
      if (st.combo > 1) this.msg(`${st.combo}연속! <b>+${gain}</b>`, 'good', 800);
      if (st.got.every(Boolean)) return this.clearStage();
    } else {
      st.combo = 0; st.miss++;
      [a, b].forEach(j => this.card(j, { up: true, face: st.faces[j], miss: true }));
      if (typeof Sound !== 'undefined') Sound.play('bad');
      st.missT = setTimeout(() => {
        if (this.st !== st || st.sel.length !== 2 || st.sel[0] !== a) return;
        [a, b].forEach(j => this.card(j, { up: false }));
        st.sel = [];
      }, 800);
    }
    this.paintStage();
  },
  clearStage() {
    const st = this.st;
    st.phase = 'clear';
    const left = Math.max(0, Math.ceil((st.endAt - performance.now()) / 1000));
    const bonus = left * 10 + (st.miss === 0 ? 300 : 0);
    st.score += bonus;
    this.paintStage();
    const last = st.stage + 1 >= MMC.STAGES.length;
    this.msg(`<b>${st.stage + 1}단계 성공!</b><br>남은 시간 ${left}초 × 10${st.miss === 0 ? ' · 한 번도 안 틀림 +300' : ''} = +${bonus}`, 'good', 2000);
    if (typeof Sound !== 'undefined') Sound.play('mission');
    after(2100, () => { if (this.st !== st || st.over) return; if (last) this.endStage(true); else this.stage(st.stage + 1); });
  },
  peekStage() {
    const st = this.st;
    if (!st || st.phase !== 'play' || st.peekUsed) return;
    st.peekUsed = true; st.endAt -= 5000;
    clearTimeout(st.missT);
    st.sel.forEach(j => this.card(j, { up: false })); st.sel = [];
    st.phase = 'peek2';
    st.faces.forEach((f, i) => { if (!st.got[i]) this.card(i, { up: true, face: f }); });
    this.msg('1초 동안 다시 보여 줄게요 (-5초)', 'info', 900);
    const t0 = performance.now();
    after(1000, () => {
      if (this.st !== st || st.over) return;
      st.faces.forEach((f, i) => { if (!st.got[i]) this.card(i, { up: false }); });
      st.phase = 'play'; st.endAt += performance.now() - t0;   // 보여 주는 1초는 시간에서 빼지 않아요
      this.paintStage();
    });
    this.paintStage();
  },
  endStage(all) {
    const st = this.st;
    if (st.over) return;
    st.over = true; st.phase = 'over';
    clearTimeout(st.missT);
    if (!all) st.faces.forEach((f, i) => { if (!st.got[i]) this.card(i, { up: true, face: f }); });
    const reached = all ? MMC.STAGES.length : st.stage;
    const best = Math.max(+store.get('best-memory', 0), st.score); store.set('best-memory', best);
    this.msg(all ? '🏆 8단계 모두 성공!' : '⏰ 시간 끝!', all ? 'good' : 'bad', 1500);
    after(1300, () => showResult({
      title: all ? '🏆 모든 단계를 깼어요!' : `⏰ ${st.stage + 1}단계에서 시간 끝!`,
      subtitle: `${reached}단계 성공 · ${st.score.toLocaleString('ko-KR')}점 · 최고 ${best.toLocaleString('ko-KR')}점`,
      solo: 'memory', win: reached >= 5, rec: { v: st.score },
    }));
  },

  /* ─── AI 대결 · 멀티 (TableKit 이 보내는 view) ─── */
  render(v, ctx, prev) {
    const fresh = !prev || this.gen !== Table.cur;
    if (fresh) {
      this.gen = Table.cur; this.lastN = v.last ? v.last.n : 0; this.missShow = null; this.st = null;
      this.build(v.cards.length);
      if (ctx.mode === 'solo') { const m = /^ai\d$/.test(this.mode) ? this.mode : 'ai1'; this.mode = m; }
    }
    this.v = v; this.ctx = ctx; this.pend = -1;
    this.modeUI(ctx.mode !== 'solo');
    $('#mm-players').classList.remove('hidden');
    this.labels('내 짝', '남은 짝', v.phase === 'peek' ? '외우는 시간' : '차례 시간');
    const me = v.players.find(p => p.id === ctx.me), mine = v.turnId === ctx.me;
    const color = k => MMC.OWN[k % MMC.OWN.length];
    if (v.last && v.last.n !== this.lastN) {                      // 방금 두 장째를 뒤집었어요
      this.lastN = v.last.n;
      if (v.last.ok) {
        this.pop([v.last.i, v.last.j], 'hit');
        if (typeof Sound !== 'undefined') Sound.play(v.last.by === ctx.me ? 'pop' : 'tap');
        if (v.last.by === ctx.me) this.msg('짝! 한 번 더', 'good', 800);
      } else {
        this.missShow = { ...v.last };
        clearTimeout(this.missT);
        this.missT = setTimeout(() => { this.missShow = null; if (this.v === v) this.paintCards(this.v); }, 1050);
        if (typeof Sound !== 'undefined') Sound.play(v.last.by === ctx.me ? 'bad' : 'tap');
      }
    }
    if (v.sel.length && this.missShow) this.missShow = null;     // 다음 사람이 뒤집기 시작하면 바로 엎어요
    this.paintCards(v);
    const board = $('#mm-board');
    board.classList.toggle('myturn', mine && !v.over);
    board.classList.toggle('wait', !mine && !v.over && v.phase === 'play');
    $('#mm-players').innerHTML = v.players.map(p => `<div class="mm-p${p.id === ctx.me ? ' me' : ''}${p.id === v.turnId ? ' turn' : ''}${p.bot ? ' bot' : ''}${v.over && v.winners.includes(p.id) ? ' win' : ''}" style="--own:${color(p.k)}">
      <i></i><b>${p.bot ? '🤖 ' : ''}${esc(p.id === ctx.me ? `${p.name} (나)` : p.name)}</b><span>${p.n}</span></div>`).join('');
    setStat('memory', 'score', `${me ? me.n : 0}쌍`);
    setStat('memory', 'stage', `${v.left}쌍`);
    setStatus('memory', v.msg + (mine && !v.over ? (v.sel.length ? ' · 한 장 더 뒤집어요' : ' · 카드 2장을 뒤집어요') : ''));
    $('#mm-info').innerHTML = v.phase === 'peek' ? '<b class="mm-hl">👀 모든 카드를 잠깐 보여 줘요 — 자리를 외워요!</b>' : mine ? '내 차례!' : v.turnId ? `${esc((v.players.find(p => p.id === v.turnId) || {}).name || '')} 님 차례` : '';
    if (prev && prev.phase === 'peek' && v.phase === 'play' && typeof Sound !== 'undefined') Sound.blip(440, 0.05, 0.7);   // 엎었어요 (글은 위 설명 줄에 — 카드를 가리지 않게)
  },
  paintCards(v) {
    const color = k => MMC.OWN[k % MMC.OWN.length], ms = this.missShow;
    v.cards.forEach((c, i) => {
      if (ms && (i === ms.i || i === ms.j)) return this.card(i, { up: true, face: i === ms.i ? ms.fi : ms.fj, miss: true });
      this.card(i, { up: c.f != null, face: c.f, got: c.o >= 0, own: c.o >= 0 ? color(c.o) : null });
    });
  },
  tapVs(i) {
    const v = this.v, ctx = this.ctx;
    if (!v || !ctx || v.over || v.phase !== 'play' || v.turnId !== ctx.me || this.pend >= 0) return;
    const c = v.cards[i];
    if (!c || c.o >= 0 || v.sel.includes(i)) return;
    if (this.missShow) { this.missShow = null; this.paintCards(v); }
    this.pend = i;
    this.card(i, { up: true, face: null });                       // 바로 뒤집는 느낌 (그림은 곧 와요)
    if (typeof Sound !== 'undefined') Sound.blip(v.sel.length ? 760 : 660, 0.03, 0.6);
    ctx.send({ t: 'flip', i });
    setTimeout(() => { if (this.pend === i) { this.pend = -1; if (this.v === v) this.paintCards(v); } }, 1500);
  },
};
$('#mm-board').addEventListener('click', e => {
  const c = e.target.closest('.mm-card'); if (!c) return;
  const i = +c.dataset.i;
  if (MM.st && !MM.gen) MM.tapStage(i); else MM.tapVs(i);
});
Object.assign(ACT, {
  mmMode: el => { MM.mode = el.dataset.m; MM.startSolo(); },
  mmLv: el => { MM.lv = el.dataset.lv; if (MM.mode !== 'stage') MM.startSolo(); else MM.modeUI(false); },
  mmPairs: el => { MM.pairs = +el.dataset.n; if (MM.mode !== 'stage') MM.startSolo(); else MM.modeUI(false); },
  mmPeek: () => MM.peekStage(),
});
Table.def('memory', { core: MemoryCore, render: (v, ctx, prev) => MM.render(v, ctx, prev), solo: { bots: 1, opts: { mmLv: 'normal', pairs: 12, peek: 3 } } });
register('memory', {                                              // 싱글 기본은 「혼자 단계 도전」 (AI 대결은 위쪽 버튼)
  solo: () => { if (MM.mode === 'multi') MM.mode = 'stage'; MM.startSolo(); },
  stop: () => { if (MM.st) { MM.st.over = true; clearTimeout(MM.st.missT); } MM.st = null; Table.stop('memory'); },
});
socket.on('tb:start', d => { if (d.game === 'memory') { MM.gen = null; MM.st = null; } });
window.addEventListener('resize', () => { if (isScreen('memory')) { clearTimeout(MM.rt); MM.rt = setTimeout(() => MM.fit(), 120); } });
