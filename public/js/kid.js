/* =====================================================================
 *  ⏳ 키즈 모드 (v13.8) — 화면 쪽 (서버: lib/kid.js · 계산: js/shared/kid-core.js)
 *   · 키즈 모드인 사람: 위쪽에 남은 시간 칩 · 10 · 5 · 1분 남으면 알림 · 잠기면 잠금 창 (새 게임을 시작할 수 없어요)
 *     싱글 게임은 잠기면 바로 끝나요. 멀티 게임은 하던 판만 마무리하고, 판이 끝나면 서버가 방에서 내보내요.
 *   · 이 기기에서 키즈 모드 계정으로 로그인하면 서버가 기기 키를 줘요 → 로그아웃해도 손님으로 똑같이 세고 막아요.
 *   · 최고 운영자: 내 정보 → 운영 → 「키즈 모드」 칸 · 프로필 카드의 「키즈 모드」 버튼
 *     (회원 찾기 · 평일 / 주말 하루 시간 · 할 수 있는 시간대 · 오늘만 더 주기 · 오늘은 그만)
 * ===================================================================== */
Object.assign(ACC_WHY, {
  kidowner: '최고 운영자에게는 키즈 모드를 걸 수 없어요.', kidoff: '키즈 모드가 꺼져 있어요. 먼저 켜 주세요.',
});
const KID_WHY = {
  time: { ic: '🌙', t: '오늘 게임 시간을 다 썼어요', s: '푹 쉬고 내일 또 만나요!' },
  win: { ic: '⏰', t: '지금은 게임 시간이 아니에요', s: '정해진 시간이 되면 다시 할 수 있어요.' },
  stop: { ic: '🔒', t: '오늘은 게임을 쉬어요', s: '최고 운영자가 오늘 게임을 잠갔어요.' },
};

const Kid = {
  st: null,             // 서버가 보낸 상태 (키즈 모드일 때만)
  spent: 0,             // 받은 뒤 이 화면에서 게임한 ms (다음 소식까지 남은 시간을 줄여 보여요)
  warnAt: Infinity,     // 이미 띄운 알림 (600 · 300 · 60초) — 가장 작은 것
  graceSaid: false,     // 멀티 「이번 판까지만」 알림
  get key() { return store.get('mgKidKey', ''); },
  setKey(k) { store.set('mgKidKey', k || ''); },

  /** 서버에 인사: 지금 걸린 키즈 모드 (화면을 켤 때 · 로그인 · 로그아웃) */
  async hello() {
    const r = await ask('kid:hello', { k: this.key || null });
    if (!r || !r.ok) return;
    if (r.drop) this.setKey('');
    if (r.key) this.setKey(r.key);
    this.set(r.on ? r.st : null);
  },
  set(st) {
    const was = this.st;
    this.st = st && st.on ? st : null;
    this.spent = 0;
    if (!this.st) { this.warnAt = Infinity; this.graceSaid = false; }
    else {
      const left = this.left();
      if (left < 0 || left > 600 || (was && was.why && !this.st.why)) this.warnAt = Infinity;   // 시간이 늘었으면 알림을 다시
      if (!this.st.why) this.graceSaid = false;
    }
    this.render();
    if (this.st && this.st.why) this.enforce();
  },
  locked() { return !!(this.st && this.st.why); },
  /** 지금 남은 초 (-1 = 제한 없음) — 서버 값에서 그사이 게임한 만큼 빼요 */
  left() {
    const st = this.st;
    if (!st || st.why) return 0;
    if (st.left < 0) return -1;
    return Math.max(0, st.left - Math.floor(this.spent / 1000));
  },
  /** 1초마다: 게임하는 동안 남은 시간 줄이기 · 알림 · 잠겼으면 막기 */
  tick() {
    if (!this.st) return;
    const playing = typeof Acct !== 'undefined' && Acct.busy() && !document.hidden;
    if (playing && !this.st.why) this.spent += 1000;
    if (!this.st.why) {
      const left = this.left();
      if (left >= 0 && playing) {
        const lv = [60, 300, 600].find(w => left <= w);
        if (lv && lv < this.warnAt) {
          this.warnAt = lv;
          const m = Math.ceil(left / 60);
          toast(lv === 60 ? '⏳ 1분 남았어요! 곧 게임이 끝나요.' : `⏳ 게임 시간이 ${m}분 남았어요.${lv === 300 ? ' 슬슬 마무리해요.' : ''}`, lv === 60 ? 'error' : 'info');
          if (lv === 60 && typeof Sound !== 'undefined') Sound.play('invite');
        }
      }
    } else this.enforce();
    this.renderChip();
  },
  /** 잠겼을 때: 싱글 게임은 끝내고 잠금 창 · 멀티 게임은 이번 판만 */
  enforce() {
    if (!this.locked()) return;
    if (S.solo) { stopLocal(); hideOverlay(); show('single'); this.open(); return; }
    if (S.code && S.room && S.room.isStarted && S.screen && !MENU_IDS.has(S.screen)) {
      if (!this.graceSaid) { this.graceSaid = true; toast('⏳ 게임 시간이 끝났어요. 이번 판만 마무리하면 방에서 나가요.', 'info'); }
    }
  },

  /* ── 화면 ── */
  /** 칩 글자는 짧게: '42분' · '90분' · '4:59'(5분 아래) · '키즈'(제한 없음) · '잠김' · '마무리'(멀티 이번 판) */
  chipText() {
    const st = this.st;
    if (st.why) return `${icon('lock')}<b>${S.code && S.room && S.room.isStarted ? '마무리' : '잠김'}</b>`;
    const left = this.left();
    return `${icon('hourglass')}<b>${left < 0 ? '키즈' : left >= 300 ? `${Math.ceil(left / 60)}분` : KidCore.fmtLeft(left)}</b>`;
  },
  renderChip() {
    const el = $('#kid-chip'); if (!el) return;
    document.body.classList.toggle('kid-on', !!this.st);
    if (!this.st) { el.classList.add('hidden'); return; }
    const left = this.left(), html = this.chipText();
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.remove('hidden');
    el.classList.toggle('lock', !!this.st.why);
    el.classList.toggle('warn', !this.st.why && left >= 0 && left <= 600);
    el.title = this.st.why ? (S.code && S.room && S.room.isStarted ? '키즈 모드 · 이번 판만 마무리해요' : '키즈 모드 · 잠김') : left < 0 ? '키즈 모드' : `키즈 모드 · 오늘 ${KidCore.fmtLeft(left)} 남았어요`;
  },
  render() {
    this.renderChip();
    if ($('#kid-ov').classList.contains('show')) this.fill();
  },
  /** 잠금 창 · 내 키즈 모드 보기 (같은 창) */
  open() {
    if (!this.st) return;
    this.fill();
    $('#kid-ov').classList.add('show');
  },
  close() { $('#kid-ov').classList.remove('show'); },
  fill() {
    const st = this.st, box = $('#kid-modal');
    if (!st) { this.close(); return; }
    const w = KID_WHY[st.why], left = this.left();
    const used = st.used + (st.why ? 0 : Math.floor(this.spent / 1000));
    const meter = st.lim ? `<div class="kid-meter"><div class="kid-bar${st.why ? ' full' : left <= 600 ? ' warn' : ''}"><i style="width:${Math.min(100, Math.round(100 * used / st.lim))}%"></i></div>
      <small>오늘 <b>${KidCore.fmtUsed(used)}</b> / ${KidCore.fmtMin(st.lim / 60)}${st.bonus ? ` <span class="kid-bonus">(오늘만 +${KidCore.fmtMin(st.bonus)})</span>` : ''}</small></div>` : `<p class="small muted">오늘 게임한 시간 <b>${KidCore.fmtUsed(used)}</b></p>`;
    const rules = `<div class="kid-rules"><span>${icon('hourglass')}${esc(KidCore.limText(st))}</span>${st.from ? `<span>${icon('clock')}${esc(KidCore.winText(st))}</span>` : ''}</div>`;
    const who = st.guest ? `<p class="small muted">이 기기는 <b>${esc(st.name)}</b> 님이 키즈 모드로 쓰던 기기예요.</p>` : '';
    box.innerHTML = w
      ? `<div class="kid-ic">${w.ic}</div><h2>${w.t}</h2>
        <p class="kid-next">${icon('clock')}<span><b>${esc(KidCore.whenText(st.next))}</b>부터 다시 할 수 있어요</span></p>
        <p class="muted">${w.s}</p>${meter}${rules}${who}
        <p class="small muted">${S.code && S.room && S.room.isStarted ? '하던 멀티 게임은 이번 판만 마무리할 수 있어요. ' : ''}게임 설명서 · 패치 노트 · 학식은 그대로 볼 수 있어요.</p>
        <div class="ov-actions"><button class="btn good" data-act="kidClose">확인</button></div>`
      : `<div class="kid-ic">⏳</div><h2>${left < 0 ? '키즈 모드' : `오늘 <span class="kid-left">${KidCore.fmtLeft(left)}</span> 남았어요`}</h2>
        ${meter}${rules}${who}
        <p class="small muted">시간은 게임하는 동안만 줄어요 (메뉴 · 대기실 · 다른 화면은 빼요). 한국 시간 0시에 새로 시작해요.${st.closes >= 0 ? ` 오늘은 ${esc(st.to)}까지 할 수 있어요.` : ''}</p>
        <p class="small muted">최고 운영자가 정한 키즈 모드예요.</p>
        <div class="ov-actions"><button class="btn good" data-act="kidClose">확인</button></div>`;
  },
};

/* ───────── 최고 운영자: 내 정보 → 운영 → 키즈 모드 ───────── */
const KID_MINS = [[0, '제한 없음'], [30, '30분'], [60, '1시간'], [90, '1시간 30분'], [120, '2시간'], [180, '3시간']];
const KidAdmin = {
  list: null, sel: null, cur: null, f: null, found: null,
  async render() {
    const box = $('#kid-op'); if (!box) return;
    if (this.sel) return this.renderEd();
    const r = await ask('kid:list');
    if (!$('#kid-op') || this.sel) return;
    if (!r.ok) { $('#kid-op').innerHTML = `<p class="muted">${esc(whyText(r))}</p>`; return; }
    this.list = r.list;
    $('#kid-op').innerHTML = this.listHTML();
    const q = $('#kid-q');
    if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); ACT.kidFind(); } });
  },
  /** 한 줄 상태: '● 게임 중 · 오늘 23분 / 1시간' · '🔒 시간을 다 썼어요' */
  stLine(x) {
    const st = x.st, on = x.play ? '<b class="op-on">● 게임 중</b>' : x.on ? '<span class="op-on">● 접속 중</span>' : agoText(Date.now() - x.seen);
    const use = st.lim ? `오늘 ${KidCore.fmtUsed(st.used)} / ${KidCore.fmtMin(st.lim / 60)}` : `오늘 ${KidCore.fmtUsed(st.used)}`;
    const lock = st.why ? ` · <b class="kid-lk">${{ time: '🌙 시간 다 씀', win: '⏰ 시간대 아님', stop: '🔒 오늘은 그만' }[st.why]}</b>` : '';
    return `${on} · ${use}${lock}`;
  },
  bar(st) { return st.lim ? `<div class="kid-bar sm${st.why ? ' full' : ''}"><i style="width:${Math.min(100, Math.round(100 * st.used / st.lim))}%"></i></div>` : ''; },
  listHTML() {
    const rows = this.list.map(x => `<div class="ac-row kid-row">${avatarOf(x, 'sm')}<span class="grow"><b>${esc(x.name)}</b> ${lvTag(x.lv)}
        <small>${this.stLine(x)}</small><small>${esc(KidCore.ruleText(x.k))}</small>${this.bar(x.st)}</span>
        <button class="btn sm" data-act="kidEdit" data-uid="${esc(x.id)}">${icon('settings')}설정</button></div>`).join('');
    const res = this.found;
    return `<div class="ac-set"><h4>${icon('hourglass')}키즈 모드 <button class="btn sm ghost op-refresh" data-act="kidRefresh" title="새로 고침">${icon('refresh')}</button></h4>
        <p class="small muted">고른 회원은 하루에 게임할 수 있는 시간 · 시간대가 정해져요. 시간은 <b>게임하는 동안만</b> 세고(메뉴 · 대기실은 빼요) 한국 시간 0시에 새로 시작해요. 다 쓰면 새 게임을 시작할 수 없고, 멀티 게임은 하던 판만 마무리해요. 로그인했던 기기는 로그아웃해도 똑같이 막아요.</p></div>
      <div class="ac-set"><h4>${icon('users')}키즈 모드 회원 ${this.list.length}명</h4>${rows ? `<div class="ac-list">${rows}</div>` : '<p class="muted small">아직 키즈 모드인 회원이 없어요. 아래에서 회원을 찾아 켜 보세요.</p>'}</div>
      <div class="ac-set"><h4>${icon('user-plus')}회원 찾기</h4>
        <div class="op-find"><input type="text" id="kid-q" maxlength="10" placeholder="키즈 모드를 걸 회원 이름" autocomplete="off"><button class="btn sm" data-act="kidFind">${icon('search')}찾기</button></div>
        ${res ? (res.length ? `<div class="ac-list">${res.map(u => `<div class="ac-row">${avatarOf(u, 'sm')}<span class="grow"><b>${esc(u.name)}</b> ${lvTag(u.lv)} ${opBadge(u.role)}<small>${u.on ? '● 접속 중' : agoText(Date.now() - u.seen)} · ${u.plays}판</small></span>
          ${u.role === 'owner' ? '<small class="muted">최고 운영자</small>' : `<button class="btn sm good" data-act="kidEdit" data-uid="${esc(u.id)}">${icon('hourglass')}키즈 모드</button>`}</div>`).join('')}</div>` : '<p class="muted small">찾는 이름의 회원이 없어요.</p>') : ''}
        <p class="small muted">프로필 카드의 「키즈 모드」 버튼으로도 바로 설정할 수 있어요.</p></div>`;
  },
  async renderEd() {
    const r = await ask('kid:get', { uid: this.sel });
    if (!$('#kid-op') || !this.sel) return;
    if (!r.ok) { this.sel = null; toast(whyText(r), 'error'); return this.render(); }
    this.cur = r;
    const k = r.u.k;
    if (!this.f || this.f.uid !== r.u.id) {
      this.f = k.on ? { uid: r.u.id, wd: k.wd, we: k.we, win: !!k.from, from: k.from || '18:00', to: k.to || '21:00' }
        : { uid: r.u.id, wd: 60, we: 120, win: false, from: '18:00', to: '21:00' };      // 처음 켤 때 기본값: 평일 1시간 · 주말 2시간
    }
    $('#kid-op').innerHTML = this.edHTML();
  },
  minSeg(name, v) {
    const custom = !KID_MINS.some(([m]) => m === v);
    return `<div class="op-seg">${KID_MINS.map(([m, t]) => `<button class="seg-btn ${!custom && v === m ? 'on' : ''}" data-act="kidMin" data-k="${name}" data-v="${m}">${t}</button>`).join('')}
      <button class="seg-btn ${custom ? 'on' : ''}" data-act="kidMinOwn" data-k="${name}">직접</button></div>
      ${custom ? `<label class="kid-own"><input type="number" id="kid-${name}" min="5" max="720" step="5" value="${v}" inputmode="numeric"> 분</label>` : ''}`;
  },
  edHTML() {
    const r = this.cur, u = r.u, k = u.k, st = u.st, f = this.f;
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const max = Math.max(60, ...r.hist.map(h => h[1] / 60));
    const week = r.hist.map(([d, s]) => { const wd = new Date(d + 'T00:00:00Z').getUTCDay(), m = Math.round(s / 60);
      return `<div class="kid-day${d === KidCore.dayKey() ? ' today' : ''}${wd === 0 || wd === 6 ? ' we' : ''}"><i style="height:${Math.max(2, Math.round(100 * m / max))}%"></i><b>${m ? KidCore.fmtShort(m) : '-'}</b><small>${days[wd]}</small></div>`; }).join('');
    const any = r.hist.some(h => h[1] > 0);
    const today = k.on ? `<div class="kid-today">${this.bar(st)}<span>${this.stLine(u)}${st.bonus ? ` · 오늘만 +${KidCore.fmtMin(st.bonus)}` : ''}</span>
        ${!st.why && st.left >= 0 ? `<span class="small muted">남은 시간 ${KidCore.fmtLeft(st.left)}</span>` : st.why ? `<span class="small muted">${esc(KidCore.whenText(st.next))}에 다시 열려요</span>` : ''}</div>` : '';
    return `<div class="ac-set kid-ed">
        <div class="kid-ed-head"><button class="btn sm ghost" data-act="kidBack">${icon('arrow-left')}목록</button>${avatarOf(u, 'sm')}<b>${esc(u.name)}</b> ${lvTag(u.lv)}
          <span class="kid-tag ${k.on ? 'on' : ''}">${k.on ? '키즈 모드 켜짐' : '꺼짐'}</span></div>
        ${today}
        ${k.on || any ? `<div class="kid-week" title="최근 7일 게임한 시간">${week}</div>` : ''}
        <h5>${icon('hourglass')}하루 게임 시간</h5>
        <div class="op-row"><span class="op-l">평일 (월 ~ 금)</span>${this.minSeg('wd', f.wd)}</div>
        <div class="op-row"><span class="op-l">주말 (토 · 일)</span>${this.minSeg('we', f.we)}</div>
        <h5>${icon('clock')}할 수 있는 시간대</h5>
        <div class="op-seg"><button class="seg-btn ${f.win ? '' : 'on'}" data-act="kidWin" data-v="0">언제든</button><button class="seg-btn ${f.win ? 'on' : ''}" data-act="kidWin" data-v="1">시간 정하기</button></div>
        ${f.win ? `<div class="kid-win"><input type="time" id="kid-from" value="${esc(f.from)}" step="300"><span>~</span><input type="time" id="kid-to" value="${esc(f.to)}" step="300"></div>
          <p class="small muted">이 시간에만 게임할 수 있어요. 자정을 넘겨도 돼요 (예: 20:00 ~ 01:00).</p>` : ''}
        <div class="ac-btnrow"><button class="btn sm good" data-act="kidSave">${icon('check')}${k.on ? '저장' : '키즈 모드 켜기'}</button>
          ${k.on ? `<button class="btn sm ghost" data-act="kidOff">${icon('lock-open')}키즈 모드 끄기</button>` : ''}</div>
        ${k.on ? `<h5>${icon('calendar-check')}오늘만</h5>
        <div class="ac-btnrow"><button class="btn sm" data-act="kidBonus" data-min="15">+15분</button><button class="btn sm" data-act="kidBonus" data-min="30">+30분</button><button class="btn sm" data-act="kidBonus" data-min="60">+1시간</button>
          ${st.why === 'stop' ? `<button class="btn sm good" data-act="kidStop" data-v="0">${icon('lock-open')}잠금 풀기</button>` : `<button class="btn sm bad" data-act="kidStop" data-v="1">${icon('lock')}오늘은 그만</button>`}</div>
        <p class="small muted">「오늘은 그만」은 지금 바로 잠가요(내일 0시에 다시 열려요). 하던 멀티 게임은 이번 판만 마무리해요.</p>` : ''}
        <p class="small muted kid-meta">${k.on ? `기억한 기기 ${u.devs}대 · ` : ''}${k.by ? `마지막 설정: ${esc(k.by)} · ${new Date(k.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : '본인 화면 위쪽에 남은 시간이 보이고, 10 · 5 · 1분 남으면 알려 줘요.'}</p></div>`;
  },
  /** 입력 칸 값 읽어 두기 (다시 그리기 전에) */
  grab() {
    const f = this.f; if (!f) return;
    for (const n of ['wd', 'we']) { const el = $('#kid-' + n); if (el) { const v = Math.round(+el.value); if (v >= 5 && v <= 720) f[n] = v; } }
    const a = $('#kid-from'), b = $('#kid-to');
    if (a && a.value) f.from = a.value;
    if (b && b.value) f.to = b.value;
  },
  redraw() { this.grab(); const box = $('#kid-op'); if (box && this.cur) box.innerHTML = this.edHTML(); },
  done(r, msg) {
    if (!r.ok) return toast(whyText(r), 'error');
    if (msg) toast(msg, 'good');
    if (this.sel) this.renderEd();                                   // 오늘 · 최근 7일도 새로
  },
};

Object.assign(ACT, {
  kidChip: () => Kid.open(),
  kidClose: () => Kid.close(),
  kidRefresh: () => KidAdmin.render(),
  kidFind: async () => {
    const q = $('#kid-q'); if (!q) return;
    const v = q.value.trim(); if (!v) return;
    const r = await ask('admin:find', { q: v });
    if (!r.ok) return toast(whyText(r), 'error');
    KidAdmin.found = r.list;
    if ($('#kid-op') && !KidAdmin.sel) { $('#kid-op').innerHTML = KidAdmin.listHTML(); const q2 = $('#kid-q'); if (q2) q2.value = v; }
  },
  kidEdit: el => { KidAdmin.sel = el.dataset.uid; KidAdmin.f = null; KidAdmin.render(); },
  kidBack: () => { KidAdmin.sel = null; KidAdmin.cur = null; KidAdmin.f = null; KidAdmin.render(); },
  kidMin: el => { KidAdmin.grab(); KidAdmin.f[el.dataset.k] = +el.dataset.v; KidAdmin.redraw(); },
  kidMinOwn: el => {
    const f = KidAdmin.f, k = el.dataset.k;
    KidAdmin.grab();
    if (KID_MINS.some(([m]) => m === f[k])) f[k] = f[k] ? f[k] + 15 : 45;                   // 고른 값 근처에서 시작 (목록에 없는 값이라야 「직접」 칸이 보여요)
    KidAdmin.redraw();
    const inp = $('#kid-' + k); if (inp) { inp.focus(); inp.select(); }
  },
  kidWin: el => { KidAdmin.grab(); KidAdmin.f.win = el.dataset.v === '1'; KidAdmin.redraw(); },
  kidSave: async () => {
    const K = KidAdmin; K.grab();
    const f = K.f, u = K.cur && K.cur.u; if (!f || !u) return;
    for (const n of ['wd', 'we']) { const el = $('#kid-' + n); if (el && !(+el.value >= 5 && +el.value <= 720)) return toast('직접 정하는 시간은 5 ~ 720분 사이로 적어 주세요.', 'error'); }
    if (f.win && (!f.from || !f.to || f.from === f.to)) return toast('시간대의 시작과 끝을 다르게 정해 주세요.', 'error');
    const d = { uid: u.id, on: true, wd: f.wd, we: f.we, from: f.win ? f.from : '', to: f.win ? f.to : '' };
    if (!u.k.on && !confirm(`${u.name} 님에게 키즈 모드를 켤까요?\n${KidCore.limText(d)} · 시간대 ${KidCore.winText(d)}\n본인 화면에 남은 시간이 보이고, 다 쓰면 게임을 시작할 수 없어요.`)) return;
    K.done(await ask('kid:set', d), u.k.on ? '⏳ 키즈 모드 설정을 바꿨어요.' : `⏳ ${u.name} 님 키즈 모드를 켰어요.`);
  },
  kidOff: async () => {
    const u = KidAdmin.cur && KidAdmin.cur.u; if (!u) return;
    if (!confirm(`${u.name} 님 키즈 모드를 끌까요?\n시간 제한이 없어지고, 기억한 기기도 모두 잊어요.`)) return;
    KidAdmin.done(await ask('kid:set', { uid: u.id, on: false }), `${u.name} 님 키즈 모드를 껐어요.`);
  },
  kidBonus: async el => {
    const u = KidAdmin.cur && KidAdmin.cur.u; if (!u) return;
    const m = +el.dataset.min;
    KidAdmin.done(await ask('kid:bonus', { uid: u.id, min: m }), `🎁 ${u.name} 님에게 오늘만 ${KidCore.fmtMin(m)} 더 줬어요.`);
  },
  kidStop: async el => {
    const u = KidAdmin.cur && KidAdmin.cur.u; if (!u) return;
    const v = el.dataset.v === '1';
    if (v && !confirm(`${u.name} 님 게임을 오늘은 그만하게 잠글까요?\n내일 0시에 다시 열려요. 하던 멀티 게임은 이번 판만 마무리해요.`)) return;
    KidAdmin.done(await ask('kid:stop', { uid: u.id, v }), v ? `🔒 ${u.name} 님 게임을 오늘은 잠갔어요.` : `🔓 ${u.name} 님 잠금을 풀었어요.`);
  },
  /** 프로필 카드 → 키즈 모드 설정 (최고 운영자) */
  kidCard: el => { Admin.sub = 'kid'; KidAdmin.sel = el.dataset.uid; KidAdmin.f = null; Acct.openMe('op'); },
});

/* ─── 화면에 자리 만들기: 위쪽 칩 · 창 ─── */
(() => {
  const chip = document.createElement('button');
  chip.id = 'kid-chip'; chip.className = 'kid-chip hidden'; chip.dataset.act = 'kidChip'; chip.type = 'button';
  const acct = $('#acct-chip');
  if (acct) acct.before(chip); else $('.top-right').prepend(chip);
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'kid-ov';
  ov.innerHTML = '<div class="modal kid-modal" id="kid-modal" role="dialog" aria-modal="true"></div>';
  ov.addEventListener('mousedown', e => { if (e.target === ov) Kid.close(); });
  document.body.append(ov);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('show')) Kid.close(); });
})();

/* ─── 잠겼으면 싱글 게임 시작을 막아요 (멀티는 서버가 막아요) ─── */
{
  const start0 = startSolo;
  startSolo = function (game) {
    if (Kid.locked()) { Kid.open(); return; }
    return start0(game);
  };
}

/* ─── 서버 소식 ─── */
socket.on('kid:state', st => {
  const was = Kid.st;
  if (st && st.drop) Kid.setKey('');
  Kid.set(st);
  if (st && st.msg) toast(st.msg, st.on ? 'info' : 'good');
  if (st && st.on && !st.guest && !was) Kid.hello();               // 방금 켜졌어요 → 이 기기도 기억해 달라고 (기기 키)
  if (st && st.on && st.why && (!was || !was.why) && !(S.code && S.room && S.room.isStarted)) Kid.open();   // 방금 잠겼어요 (멀티 게임 중이면 이번 판은 가리지 않아요)
});
socket.on('kid:block', st => { Kid.set(st); Kid.open(); });
socket.on('kid:out', d => {                                        // 시간이 끝나서 서버가 방에서 내보냈어요
  outOfRoom(d && d.why === 'mid' ? '⏳ 마무리 시간(10분)이 지나서 방에서 나왔어요.' : '', 'info', 'single');
  Kid.set(d); Kid.open();
});
setInterval(() => Kid.tick(), 1000);
if (typeof Acct !== 'undefined' && Acct.state === 'ready') Kid.hello();   // 이 파일을 읽기 전에 계정 인사가 이미 끝났으면 (그때는 Kid 가 없어서 못 불렀어요)
