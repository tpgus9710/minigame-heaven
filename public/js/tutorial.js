/* =====================================================================
 *  🎓 따라 하기 (튜토리얼) — 규칙이 어려운 게임을 실제 판에서 한 단계씩 따라 하며 익혀요
 *   게임마다 public/js/tutorial/<키>.js 에서 Tutorial.add('키', { … }) (시작할 때 불러와요)
 *   {
 *     title, bots(봇 수), opts(게임 옵션), seed(정해진 섞기), botDelay:[ms,ms],
 *     prepare(st)          판을 처음에 원하는 대로 깔기 (패 · 덱 순서 등)
 *     bot(st, id, base, i) 봇이 할 행동 (undefined → 원래 AI, null → 기다리기)
 *     steps: [{
 *       say      말풍선 글 (HTML · 함수 (v, st) 도 돼요)
 *       at       밝게 비출 곳 (CSS 선택자 · 함수 (v) → 요소)
 *       next     true → 「다음」 버튼으로 넘어가요 (설명하는 단계)
 *       until    (v, st) => true 가 되면 저절로 다음 단계로 (직접 해 보는 · 지켜보는 단계)
 *       allow    (a, st) => true | '안내 문구' — 이 단계에서 내가 할 수 있는 행동
 *       bots     true → 이 단계에서는 봇이 움직여요 (아니면 봇은 기다려요)
 *       timed    true → 이 단계에서는 게임의 시간 진행(라운드 넘김 등)을 그대로
 *       wait     until 이 맞은 뒤 다음 단계까지 기다릴 시간 (ms · 그림이 다 움직이게)
 *       enter    (st) => 단계가 시작될 때 판을 살짝 바꾸기
 *       dim      주변을 어둡게 하는 정도 (0~1)
 *       click    (검사용) 화면 검사가 누를 곳 — 비춘 곳(at)과 누를 곳이 다를 때
 *       demo     (검사용) 이 단계에서 보낼 행동 · 행동 목록 · (st) => 행동 — tests/tutorial.test.js 가 판을 끝까지 다시 돌려 봐요
 *     }],
 *     done   다 끝냈을 때 하는 말
 *     always (a, st) => true 이면 어느 단계에서나 할 수 있는 행동 (예: 패 정렬처럼 판에 영향이 없는 것)
 *     release(st)  따라 하기가 끝나 진짜 AI와 이어서 칠 때 (중간에 그만둬도) prepare 가 바꿔 둔 것을 되돌려요
 *   }
 *   진행: Table.solo 에 바꿔 낀 규칙(core)을 넘겨요 → 사람 행동은 allow 로 거르고, 봇은 bots 단계에서만 움직여요.
 *   끝까지 하면 설명서 모음에 ✓ · 바로 AI 대전 · 이 판을 이어서 칠 수도 있어요.
 * ===================================================================== */
const Tutorial = {
  LIST: ['gostop', 'bang', 'coup', 'dalmuti', 'rummi'],
  defs: {}, loading: {}, on: false, run: null,
  add(key, d) { this.defs[key] = d; },
  has(key) { return this.LIST.includes(key); },
  load(key) {
    if (this.defs[key]) return Promise.resolve(this.defs[key]);
    if (!this.loading[key]) {
      this.loading[key] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = `/js/tutorial/${key}.js`; s.async = true;
        s.onload = () => (this.defs[key] ? res(this.defs[key]) : rej(new Error('empty')));
        s.onerror = () => { delete this.loading[key]; rej(new Error('load')); };
        document.head.append(s);
      });
    }
    return this.loading[key];
  },
  /** 늘 같은 순서로 나오는 난수 (판이 매번 똑같이 깔리게) */
  rng(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  },

  /* ─────────────── 시작 · 끝 ─────────────── */
  async start(key) {
    if (!this.has(key)) return;
    if (S.code) return toast('방에서는 따라 하기를 할 수 없어요. 방에서 나간 뒤 해 보세요.');
    let def;
    try { def = await this.load(key); } catch { return toast('따라 하기를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.', 'error'); }
    if (typeof Manual !== 'undefined') { Manual.close(); Manual.mark(key, 'hint'); }
    $$('.man-hint').forEach(x => x.remove());
    hideOverlay();
    const d = Table.defs[key]; if (!d) return;
    const base = d.core, run = { key, def, i: -1, c: null, adv: null, hold: false, fin: false, quit: false, min: false, tick: null, seen: -1 };
    const live = () => this.on && this.run === run;
    const core = Object.create(base);
    core.meta = Object.assign({}, base.meta, { botDelay: def.botDelay || [1200, 1700] });
    core.setup = (players, rnd, opts) => { const st = base.setup(players, this.rng(def.seed || 7), opts); if (def.prepare) def.prepare(st, players); return st; };
    core.ai = (st, id) => (live() ? this.botAct(run, st, id, base) : base.ai(st, id));
    core.auto = (st, id) => (live() ? this.botAct(run, st, id, base) : (base.auto || base.ai)(st, id));
    core.act = (st, id, a) => { if (live() && id === 'me') { const no = this.check(run, a, st); if (no) return no; } return base.act(st, id, a); };
    core.deadline = st => { if (live() && !(this.step(run) || {}).timed) return null; return base.deadline ? base.deadline(st) : null; };
    run.core = core;
    Table.solo(key, { bots: def.bots ?? 1, opts: def.opts || {}, core, tut: true });     // (먼저 지난 게임 · 따라 하기를 모두 정리해요)
    run.c = Table.cur;
    if (!run.c || run.c.key !== key) return;
    this.run = run; this.on = true;
    document.body.classList.add('tut-on');
    this.ensure();
    run.tick = setInterval(() => { this.test(run); this.place(run); }, 200);   // 화면 안에서만 바뀌는 것(카드 고르기 등)도 until 로 볼 수 있게
    this.go(run, 0);
  },
  /** 따라 하기 끝내기 (화면에서 나가거나 다른 게임을 시작해도 불러요) */
  stop() {
    const run = this.run;
    if (run) { clearTimeout(run.adv); clearInterval(run.tick); }
    this.on = false; this.run = null;
    document.body.classList.remove('tut-on', 'tut-cont');
    const el = $('#tut'); if (el) el.remove();
  },
  step(run) { return run && run.def.steps[run.i]; },

  /* ─────────────── 단계 ─────────────── */
  go(run, i) {
    if (this.run !== run || !this.on) return;
    clearTimeout(run.adv); run.adv = null; run.hold = false;
    run.i = i; run.min = false;                               // 새 단계는 말풍선을 펴서 보여 줘요
    const step = this.step(run);
    if (!step) return this.finish(run);
    if (step.enter) { try { step.enter(run.c.T.state); } catch (e) { console.error(e); } Table.refresh(); }
    this.draw(run);
    if (step.bots || step.timed) run.c.T.poke();              // 봇 · 시간 진행을 다시 깨워요
    this.test(run);
  },
  next() { const run = this.run; if (run && !run.fin && !run.quit) { const st = this.step(run); if (st && st.next) this.go(run, run.i + 1); } },
  /** 화면을 다시 그릴 때마다 (table.js) → 다음 단계로 갈 때인지 */
  painted(c) { const run = this.run; if (this.on && run && run.c === c) { this.test(run); this.place(run); } },
  test(run) {
    const step = this.step(run);
    if (!step || !step.until || run.adv || run.fin) return;
    let ok = false;
    try { ok = !!step.until(run.c.view, run.c.T.state); } catch (e) { console.error(e); }
    if (!ok) return;
    run.hold = true;                                           // 다음 단계까지 봇 · 나 모두 잠깐 멈춰요
    run.adv = setTimeout(() => { run.adv = null; this.go(run, run.i + 1); }, step.wait ?? 700);
  },
  /** 봇이 둘 차례: 이 단계에서 움직여도 되면 각본 → 원래 AI */
  botAct(run, st, id, base) {
    const step = this.step(run);
    if (!step || !step.bots || run.hold || run.fin || run.quit) return null;
    const a = run.def.bot ? run.def.bot(st, id, base, run.i) : undefined;
    return a !== undefined ? a : base.ai(st, id);
  },
  /** 내 행동 거르기 → 안 되면 안내 문구 (toast) */
  check(run, a, st) {
    const step = this.step(run);
    let msg = null;
    try { if (run.def.always && run.def.always(a, st) === true) return null; } catch (e) { /* 무시 */ }
    if (run.fin || run.quit) msg = '말풍선에서 골라 주세요.';
    else if (!step || run.hold) msg = '잠깐만요! 안내를 먼저 볼게요.';
    else if (!step.allow) msg = step.next ? '먼저 말풍선의 「다음」을 눌러 주세요.' : '지금은 지켜봐 주세요.';
    else {
      let r; try { r = step.allow(a, st); } catch (e) { r = false; }
      if (r === true) return null;
      msg = typeof r === 'string' ? r : step.nope || '안내에 나온 대로 해 볼까요?';
    }
    const box = $('#tut-box');
    if (box) { box.classList.remove('nudge'); void box.offsetWidth; box.classList.add('nudge'); if (run.min) this.toggleMin(false); }
    setTimeout(() => { if (this.run === run && Table.cur === run.c) Table.refresh(); }, 0);   // 막은 뒤 고르던 표시가 남지 않게 다시 그려요
    return String(msg).replace(/<[^>]+>/g, '');
  },

  /* ─────────────── 말풍선 · 비추기 ─────────────── */
  ensure() {
    if ($('#tut')) return;
    document.body.insertAdjacentHTML('beforeend', '<div id="tut"><div class="tut-ring hidden" id="tut-ring"></div><div class="tut-box" id="tut-box" role="dialog" aria-live="polite" aria-label="따라 하기"></div></div>');
  },
  head(run) {
    const n = run.def.steps.length, k = Math.min(n, run.i + 1);
    return `<div class="tut-hd" data-act="tutMin"><span class="tut-ic">${icon('school')}</span><b>따라 하기</b><span class="tut-nm">${esc(run.def.title || '')}</span>
      <span class="tut-n">${run.fin ? '완료' : `${k} / ${n}`}</span>
      ${run.fin || run.quit ? '' : `<button class="tut-b" data-act="tutMin" aria-label="말풍선 접기 · 펴기">${icon(run.min ? 'chevron-up' : 'chevron-down')}</button>
      <button class="tut-b" data-act="tutQuit" aria-label="그만하기" title="그만하기">${icon('x')}</button>`}</div>`;
  },
  draw(run) {
    const box = $('#tut-box'); if (!box) return;
    const step = this.step(run), n = run.def.steps.length;
    let body;
    if (run.quit) {
      body = `<div class="tut-say">따라 하기를 그만할까요?</div>
        <div class="tut-ft"><button class="btn sm good" data-act="tutCont">이 판은 AI와 계속 치기</button><button class="btn sm" data-act="tutLeave">나가기</button><button class="btn sm ghost" data-act="tutBack">계속 배우기</button></div>`;
    } else if (run.fin) {
      body = `<div class="tut-say"><b class="tut-done">🎉 따라 하기 완료!</b><br>${run.def.done || '이제 혼자서도 칠 수 있어요!'}</div>
        <div class="tut-ft"><button class="btn sm good" data-act="tutReal">${icon('player-play')}AI와 진짜 한 판</button><button class="btn sm" data-act="tutCont">이 판 이어서 하기</button>
          <button class="btn sm ghost" data-act="manual" data-game="${run.key}">${icon('book')}설명서</button><button class="btn sm ghost" data-act="tutLeave">나가기</button></div>`;
    } else {
      let say = step.say;
      if (typeof say === 'function') { try { say = say(run.c.view, run.c.T.state); } catch (e) { say = ''; } }
      const ft = step.next ? `<button class="btn sm good tut-next" data-act="tutNext">다음 ${icon('arrow-right')}</button>`
        : step.allow ? `<span class="tut-do">${icon('hand-click')}직접 해 보세요</span>`
          : `<span class="tut-wait"><i></i><i></i><i></i>${step.bots ? '상대 차례 · 지켜보세요' : '잠깐만요…'}</span>`;
      body = `<div class="tut-say">${say}</div><div class="tut-ft">${ft}</div>`;
    }
    box.innerHTML = `${this.head(run)}${body}<div class="tut-pg"><i style="width:${run.fin ? 100 : Math.round(Math.max(0, run.i) / n * 100)}%"></i></div>`;
    box.classList.toggle('min', run.min && !run.fin && !run.quit);
    box.classList.toggle('mid', run.fin || run.quit);
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    run.seen = -1;
    this.place(run);
    const nb = $('.tut-next', box); if (nb && matchMedia('(hover: hover)').matches) nb.focus({ preventScroll: true });
  },
  target(run) {
    const step = this.step(run);
    if (!step || !step.at || run.fin || run.quit) return null;
    let el = null;
    try { el = typeof step.at === 'function' ? step.at(run.c.view) : $(step.at); } catch { el = null; }
    if (!el || !el.getClientRects().length) return null;
    return el;
  },
  place(run) {
    if (this.run !== run) return;
    const box = $('#tut-box'), ring = $('#tut-ring'); if (!box || !ring) return;
    const step = this.step(run), el = this.target(run);
    const vw = document.documentElement.clientWidth, vh = innerHeight, m = 8, pad = 6;
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let left, top;
    if (!el) {
      ring.classList.add('hidden');
      left = (vw - bw) / 2;
      top = run.fin || run.quit ? Math.max(m, (vh - bh) / 2) : vh - bh - 14;
    } else {
      let r = el.getBoundingClientRect();
      if (run.seen !== run.i && (r.bottom < 0 || r.top > vh)) { el.scrollIntoView({ block: 'center' }); r = el.getBoundingClientRect(); }
      run.seen = run.i;
      ring.classList.remove('hidden');
      const dim = step.dim ?? (step.next ? 0.5 : 0.28);
      const css = `left:${Math.round(r.left - pad)}px;top:${Math.round(r.top - pad)}px;width:${Math.round(r.width + pad * 2)}px;height:${Math.round(r.height + pad * 2)}px;--tut-dim:${dim}`;
      if (ring.style.cssText !== css) ring.style.cssText = css;
      left = r.left + r.width / 2 - bw / 2;
      if (r.bottom + pad + 10 + bh <= vh - m) top = r.bottom + pad + 10;                     // 아래
      else if (r.top - pad - 10 - bh >= m) top = r.top - pad - 10 - bh;                      // 위
      else {
        top = r.top + r.height / 2 - bh / 2;                                                   // 위아래가 좁으면 옆에 (가로 휴대폰)
        if (r.right + pad + 10 + bw <= vw - m) left = r.right + pad + 10;
        else if (r.left - pad - 10 - bw >= m) left = r.left - pad - 10 - bw;
        else top = (r.top + r.bottom) / 2 > vh / 2 ? m : vh - bh - m;                         // 옆도 없으면 화면 끝에
      }
    }
    left = Math.round(Math.min(vw - bw - m, Math.max(m, left)));
    top = Math.round(Math.min(vh - bh - m, Math.max(m, top)));
    if (box.style.left !== left + 'px') box.style.left = left + 'px';
    if (box.style.top !== top + 'px') box.style.top = top + 'px';
  },
  toggleMin(v) { const run = this.run; if (!run || run.fin || run.quit) return; run.min = v ?? !run.min; this.draw(run); },
  finish(run) {
    run.fin = true; run.hold = false; run.i = run.def.steps.length;
    if (typeof Manual !== 'undefined') Manual.mark(run.key, 'tut');
    this.draw(run);
    this.badges();
  },
  /** 싱글 메뉴 카드에 「따라 하기」 표시 (다 해 봤으면 ✓) */
  badges() {
    for (const k of this.LIST) {
      const card = $(`#single-grid .game-card[data-game="${k}"]`); if (!card) continue;
      const done = typeof Manual !== 'undefined' && Manual.done('tut', k);
      const html = `${icon('school')}따라 하기${done ? ' ✓' : ''}`;
      let el = card.querySelector('.gc-tut');
      if (!el) { card.insertAdjacentHTML('beforeend', `<span class="gc-tut" data-act="tutStart" data-game="${k}" role="button" tabindex="0" title="실제 판에서 한 단계씩 배워요"></span>`); el = card.querySelector('.gc-tut'); }
      if (el.innerHTML !== html) el.innerHTML = html;
      el.classList.toggle('done', done);
    }
  },
  /** 따라 하기를 끝내고 이 판은 진짜 AI와 계속 */
  cont() {
    const run = this.run; if (!run) return;
    const T = run.c && run.c.T;
    if (T && run.def.release) { try { run.def.release(T.state); } catch (e) { console.error(e); } }
    this.stop();
    document.body.classList.add('tut-cont');                 // 이 판이 끝날 때까지 위쪽 싱글 설정 줄은 숨겨요 (stopLocal 에서 다시 보여요)
    if (T) T.poke();
    toast('이제 AI가 진짜로 쳐요. 끝까지 해 보세요!', 'info');
  },
};
register('__tut', { stop: () => Tutorial.stop() });
Tutorial.badges();          // 화면을 나가거나 다른 게임을 시작하면 (stopLocal) 정리
Object.assign(ACT, {
  tutStart: el => Tutorial.start(el.dataset.game),
  tutNext: () => Tutorial.next(),
  tutMin: (el, e) => { if (e && e.target.closest('[data-act=tutQuit]')) return; Tutorial.toggleMin(); },
  tutQuit: () => { const run = Tutorial.run; if (run && !run.fin) { run.quit = true; run.min = false; Tutorial.draw(run); } },
  tutBack: () => { const run = Tutorial.run; if (run) { run.quit = false; Tutorial.draw(run); const st = Tutorial.step(run); if (st && (st.bots || st.timed)) run.c.T.poke(); } },   // 그만하기를 고르는 동안 멈췄던 봇을 다시
  tutCont: () => Tutorial.cont(),
  tutReal: () => { const key = Tutorial.run && Tutorial.run.key; Tutorial.stop(); if (key) startSolo(key); },
  tutLeave: () => { Tutorial.stop(); ACT.leaveGame(); },
});
addEventListener('resize', () => { if (Tutorial.run) Tutorial.place(Tutorial.run); });
document.addEventListener('keydown', e => {
  const run = Tutorial.run; if (!Tutorial.on || !run || typing()) return;
  if (e.key === 'Enter' && !e.repeat) { const st = Tutorial.step(run); if (st && st.next && !run.fin && !run.quit && document.activeElement?.dataset?.act !== 'tutNext') { e.preventDefault(); Tutorial.next(); } }
}, true);
