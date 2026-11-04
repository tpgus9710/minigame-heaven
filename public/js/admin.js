/* =====================================================================
 *  📢 전체 공지 (모두) · 🛡️ 운영자 화면 (내 정보 → 운영 탭)
 *   - 공지: 메뉴 화면에서는 가운데 창으로, 게임 중에는 화면을 가리지 않게 위쪽 띠로만 보여요.
 *     게임이 끝나면 아직 안 본 공지를 창으로 보여 줘요. 한 번 본 공지는 이 기기에서 다시 띄우지 않아요.
 *   - 업데이트 예고: 위쪽 띠에 남은 시간 (카운트다운)
 *   - 새 버전: 서버의 화면 파일이 바뀌었으면(패치) '새로 고침' 안내
 *   서버: lib/admin.js
 * ===================================================================== */
const NT_KIND = { info: ['공지', 'speakerphone'], patch: ['업데이트 예고', 'tool'], urgent: ['긴급 공지', 'alert-triangle'] };
const OP_NAME = { owner: '최고 운영자', admin: '운영자' };
const opBadge = (op, sm) => (op ? `<em class="op-badge ${op}${sm ? ' sm' : ''}" title="${OP_NAME[op] || '운영자'}">${icon('shield-check')}${sm ? '' : OP_NAME[op] || '운영자'}</em>` : '');
Object.assign(ACC_WHY, {
  reserved: "'운영자 · 관리자' 같은 이름은 쓸 수 없어요.", noperm: '운영자만 할 수 있어요.', nokey: '이 서버에는 운영자 키(ADMIN_KEY)가 설정되어 있지 않아요.',
  key: '운영자 키가 맞지 않아요.', title: '공지 제목을 입력해 주세요.', min: '1~120분 사이로 정해 주세요.', dur: '보여 줄 시간을 골라 주세요.',
  nonotice: '지금 걸린 공지가 없어요.', opmax: '운영자는 30명까지 지정할 수 있어요.', owner: '최고 운영자는 스스로 그만둘 수만 있어요.', notop: '운영자가 아니에요.',
});
const agoText = ms => (ms < 60000 ? '방금' : ms < 3600000 ? `${Math.floor(ms / 60000)}분 전` : ms < 86400000 ? `${Math.floor(ms / 3600000)}시간 전` : `${Math.floor(ms / 86400000)}일 전`);
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const Notice = {
  n: null, upd: false, shut: null, tick: null, build0: null, preview: null,
  seen() { try { return new Set(JSON.parse(localStorage.getItem('mgNoticeSeen') || '[]')); } catch { return new Set(); } },
  markSeen(id) {
    try { const s = [...this.seen()].filter(x => x !== id); s.push(id); localStorage.setItem('mgNoticeSeen', JSON.stringify(s.slice(-30))); } catch { /* 저장 못 해도 괜찮아요 */ }
  },
  gaming: () => document.body.classList.contains('gaming'),
  /** 서버가 보낸 공지 (시각은 '지금부터 몇 ms' → 내 기기 시각으로) */
  set(v) {
    if (!v) return this.clear();
    const now = Date.now(), fresh = !this.n || this.n.id !== v.id;
    this.n = { ...v, at: now - (v.ago || 0), end: v.left ? now + v.left : 0, eta: v.eta ? now + v.eta : 0 };
    if (fresh) { this.shut = null; if (v.kind !== 'info') Sound.play('invite'); }
    this.render();
    this.maybePop();
  },
  clear(id) {
    if (id && this.n && this.n.id !== id) return;
    const was = this.n; this.n = null;
    if (was && $('#notice-ov').classList.contains('show') && !this.preview) this.closePop();
    this.render();
  },
  /** 아직 안 본 공지 → 메뉴 화면이면 창으로 (게임 중 · 다른 창이 열려 있으면 띠만) */
  maybePop() {
    const n = this.n;
    if (!n || this.seen().has(n.id)) return;
    if (this.gaming() || $('#overlay').classList.contains('show') || $('#acct-ov').classList.contains('show') || $('#notice-ov').classList.contains('show')) return;
    this.openPop(n);
  },
  openPop(n, preview) {
    this.preview = preview || null;
    $('#notice-modal').innerHTML = this.popHTML(n, !!preview);
    $('#notice-ov').classList.add('show');
    if (!preview) this.markSeen(n.id);
    this.render();
  },
  closePop() { $('#notice-ov').classList.remove('show'); this.preview = null; this.render(); setTimeout(() => this.maybePop(), 50); },
  popHTML(n, preview) {
    const [label, ic] = NT_KIND[n.kind] || NT_KIND.info;
    return `<div class="nt-top"><span class="nt-kind ${n.kind}">${icon(ic)}${label}</span>${preview ? '<span class="nt-prev">미리 보기 · 아직 안 보냈어요</span>' : `<small class="muted">${agoText(Date.now() - n.at)}</small>`}</div>
      <h2 class="nt-title">${esc(n.title)}</h2>
      ${n.body ? `<p class="nt-body">${esc(n.body)}</p>` : ''}
      ${n.kind === 'patch' ? `<div class="nt-eta" id="nt-eta">${this.etaHTML(n)}</div>` : ''}
      <div class="nt-by">${icon('shield-check')}${esc(n.by || '운영자')}</div>
      <div class="ov-actions"><button class="btn good" data-act="ntClose">확인</button></div>`;
  },
  etaHTML(n) {
    const left = n.eta - Date.now();
    return left > 0
      ? `${icon('clock')}<span><b>${mmss(left)}</b> 뒤 서버 업데이트 — 잠깐 연결이 끊겼다가 다시 이어져요. 게임 중이면 판이 끝날 수 있어요.</span>`
      : `${icon('clock')}<span><b>곧 업데이트돼요.</b> 잠깐 연결이 끊길 수 있어요.</span>`;
  },
  /** 위쪽 띠 · 홈 카드 · 남은 시간 다시 그리기 */
  render() {
    const n = this.n, bar = $('#notice-bar'), home = $('#home-notice');
    if (n && n.end && Date.now() > n.end) { this.n = null; return this.render(); }
    const lines = [];
    if (this.upd) lines.push(`<div class="nb-line upd">${icon('refresh')}<span class="nb-t"><b>새 버전이 나왔어요</b> · 새로 고침하면 바뀐 내용이 적용돼요</span><button class="btn sm good" data-act="ntReload">새로 고침</button></div>`);
    const popOpen = $('#notice-ov').classList.contains('show');
    if (n && this.shut !== n.id && !popOpen && (n.kind === 'patch' || !this.seen().has(n.id))) {
      const [label, ic] = NT_KIND[n.kind] || NT_KIND.info;
      const eta = n.kind === 'patch' ? (n.eta > Date.now() ? ` · <b class="nb-cd">${mmss(n.eta - Date.now())}</b> 뒤` : ' · <b>곧</b>') : '';
      lines.push(`<div class="nb-line ${n.kind}">${icon(ic)}<span class="nb-t"><b>${label}</b>${eta} · ${esc(n.title)}</span>
        <button class="btn sm ghost" data-act="ntOpen">보기</button><button class="nb-x" data-act="ntShut" aria-label="닫기">${icon('x')}</button></div>`);
    }
    const html = lines.join('');
    if (bar.innerHTML !== html) {
      bar.innerHTML = html; bar.classList.toggle('hidden', !html);
      if (typeof Fit !== 'undefined') Fit.schedule();
    }
    if (home) {
      home.classList.toggle('hidden', !n);
      if (n) {
        const [label, ic] = NT_KIND[n.kind] || NT_KIND.info;
        home.className = 'home-notice ' + n.kind;
        home.innerHTML = `<span class="hn-ic">${icon(ic)}</span><span class="hn-t"><small>${label}${n.kind === 'patch' ? ` · ${n.eta > Date.now() ? mmss(n.eta - Date.now()) + ' 뒤' : '곧'}` : ''}</small><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body.split('\n')[0])}</span>` : ''}</span><button class="btn sm ghost" data-act="ntOpen">자세히</button>`;
      }
    }
    const eta = $('#nt-eta');
    if (eta && n && n.kind === 'patch' && !this.preview) eta.innerHTML = this.etaHTML(n);
    // 업데이트 예고 · 보여 줄 시간이 있는 공지는 1초마다 다시 그려요
    const need = !!n && (n.kind === 'patch' || n.end);
    if (need && !this.tick) this.tick = setInterval(() => this.render(), 1000);
    if (!need && this.tick) { clearInterval(this.tick); this.tick = null; }
  },
};
// 화면에 붙이기: 위쪽 띠(게임 화면 위) · 공지 창 · 홈 카드
$('#main').insertAdjacentHTML('afterbegin', '<div id="notice-bar" class="hidden" role="status" aria-live="polite"></div>');
document.body.insertAdjacentHTML('beforeend', '<div class="overlay" id="notice-ov"><div class="modal notice-modal" id="notice-modal" role="dialog" aria-modal="true"></div></div>');
(() => { const hero = $('#scr-home .hero'), grid = hero && hero.querySelector('.mode-grid'); if (grid) grid.insertAdjacentHTML('beforebegin', '<div class="home-notice hidden" id="home-notice"></div>'); })();
// 게임이 끝나 메뉴로 돌아오면 (body.gaming 이 빠지면) 아직 안 본 공지를 보여 줘요
new MutationObserver(() => { if (!Notice.gaming()) setTimeout(() => Notice.maybePop(), 300); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
socket.on('notice', v => Notice.set(v));
socket.on('notice:end', d => Notice.clear(d && d.id));
const noticeGet = () => socket.timeout(8000).emit('notice:get', null, (err, r) => { if (!err && r && r.ok) { if (r.n) Notice.set(r.n); else Notice.clear(); } });
socket.on('connect', noticeGet);                       // 다시 연결될 때마다 (그동안 내려간 공지도 맞춰요)
if (socket.connected) noticeGet();                     // 이 파일을 읽기 전에 이미 연결됐으면 (그때 온 공지를 놓쳤을 수 있어요)
if (S.serverInfo && S.serverInfo.build) Notice.build0 = S.serverInfo.build;   // 이 파일보다 먼저 받은 서버 정보
socket.on('serverInfo', d => {
  if (!d || !d.build) return;
  if (!Notice.build0) Notice.build0 = d.build;
  else if (d.build !== Notice.build0 && !Notice.upd) { Notice.upd = true; Notice.render(); Sound.play('mission'); }
});

/* ───────── 운영자 화면 (내 정보 → 운영 탭) ───────── */
const Admin = {
  st: null, f: { kind: 'info', dur: 0, min: 10, title: '', body: '' }, found: null, sub: null,
  /** 운영 탭 안의 칸: 신고함 (public/js/report.js) · 공지 · 관리 */
  subsHTML() {
    const nNew = typeof Report !== 'undefined' ? Report.opNew : 0;
    const b = (k, ic, t, n) => `<button class="seg-btn ${this.sub === k ? 'on' : ''}" data-act="opSub" data-k="${k}">${icon(ic)}${t}${n ? `<i class="ac-dot">${n}</i>` : ''}</button>`;
    return `<div class="op-subs">${b('rep', 'inbox', '신고 · 요청', nNew)}${b('main', 'speakerphone', '공지 · 관리', 0)}</div>`;
  },
  async render() {
    const box = $('#ac-body');
    if (!box) return;
    if (!this.sub) this.sub = typeof Report !== 'undefined' && Report.opNew ? 'rep' : 'main';
    if (this.sub === 'rep' && typeof Report !== 'undefined') {
      box.innerHTML = `<div class="op-panel">${this.subsHTML()}<div id="rp-op"><div class="muted center ac-load">불러오는 중…</div></div></div>`;
      return Report.opRender();
    }
    const r = await ask('admin:state');
    if (!$('#ac-body') || Acct.ui.tab !== 'op' || this.sub === 'rep') return;
    if (!r.ok) { box.innerHTML = `<p class="muted">${esc(whyText(r))}</p>`; return; }
    this.st = r;
    box.innerHTML = `<div class="op-panel">${this.subsHTML()}${this.formHTML()}<div id="op-live">${this.liveHTML()}</div>${this.statsHTML()}${this.opsHTML()}${this.histHTML()}${this.logsHTML()}</div>`;
    this.bindForm();
  },
  seg(name, items, cur) {
    return `<div class="op-seg">${items.map(([v, t]) => `<button class="seg-btn ${String(cur) === String(v) ? 'on' : ''}" data-act="opSeg" data-k="${name}" data-v="${v}">${t}</button>`).join('')}</div>`;
  },
  formHTML() {
    const f = this.f;
    return `<div class="ac-set op-form"><h4>${icon('speakerphone')}전체 공지 보내기</h4>
      ${this.seg('kind', [['info', '일반 공지'], ['patch', '업데이트 예고'], ['urgent', '긴급']], f.kind)}
      <label>제목<input type="text" id="op-title" maxlength="40" autocomplete="off" placeholder="${f.kind === 'patch' ? '예: 오늘 밤 10시 업데이트' : '예: 새 게임이 들어왔어요!'}" value="${esc(f.title)}"></label>
      <label>내용 <small class="muted">(줄바꿈 가능 · 400자까지)</small><textarea id="op-body" maxlength="400" rows="4" placeholder="${f.kind === 'patch' ? '예: 새 게임이 추가돼요. 업데이트하는 동안 1~2분 정도 연결이 끊길 수 있어요.' : '내용을 적어 주세요'}">${esc(f.body)}</textarea></label>
      ${f.kind === 'patch'
        ? `<div class="op-row"><span class="op-l">몇 분 뒤에</span>${this.seg('min', [[3, '3분'], [5, '5분'], [10, '10분'], [15, '15분'], [30, '30분'], [60, '1시간']], f.min)}</div>
           <p class="small muted">모든 화면 위쪽에 남은 시간이 보여요. 업데이트를 마치고 서버가 다시 켜지면 예고는 저절로 내려가고, 열려 있던 화면에는 '새로 고침' 안내가 떠요.</p>`
        : `<div class="op-row"><span class="op-l">보여 줄 시간</span>${this.seg('dur', [[0, '내릴 때까지'], [10, '10분'], [60, '1시간'], [1440, '하루']], f.dur)}</div>`}
      <div class="ac-btnrow"><button class="btn sm ghost" data-act="opPreview">${icon('eye')}미리 보기</button><button class="btn sm good" data-act="opSend">${icon('send')}모두에게 보내기</button></div>
      <p class="small muted">메뉴 화면에서는 가운데 창으로, 게임 중인 사람에게는 화면을 가리지 않게 위쪽 띠로 보여요. 나중에 들어온 사람에게도 보여요.</p></div>`;
  },
  liveHTML() {
    const n = this.st && this.st.notice;
    if (!n) return `<div class="ac-set"><h4>${icon('broadcast')}지금 걸린 공지</h4><p class="muted small">지금 걸린 공지가 없어요.</p></div>`;
    const [label, ic] = NT_KIND[n.kind] || NT_KIND.info;
    const left = n.kind === 'patch' ? `업데이트까지 ${mmss(n.eta)}` : n.left ? `${mmss(n.left)} 뒤 저절로 내려가요` : '내릴 때까지 보여요';
    return `<div class="ac-set"><h4>${icon('broadcast')}지금 걸린 공지</h4>
      <div class="op-live ${n.kind}"><span class="nt-kind ${n.kind}">${icon(ic)}${label}</span><b>${esc(n.title)}</b><small class="muted">${esc(n.by || '')} · ${agoText(n.ago)} · ${left}</small>
      <button class="btn sm bad" data-act="opEnd">${icon('x')}내리기</button></div></div>`;
  },
  statsHTML() {
    const s = this.st.stats, up = s.up >= 3600 ? `${Math.floor(s.up / 3600)}시간 ${Math.floor(s.up % 3600 / 60)}분` : `${Math.floor(s.up / 60)}분`;
    const tile = (n, l) => `<div class="ac-tile"><b>${n}</b><small>${l}</small></div>`;
    return `<div class="ac-set"><h4>${icon('server')}서버 현황 <button class="btn sm ghost op-refresh" data-act="opRefresh" title="새로 고침">${icon('refresh')}</button></h4>
      <div class="ac-tiles op-tiles">${tile(s.sockets, '접속한 화면')}${tile(s.online, '로그인 회원')}${tile(`${s.rooms}<small> / ${s.playing}</small>`, '열린 방 / 게임 중')}${tile(s.users, '가입 회원')}${tile(up, '서버 켜진 지')}</div></div>`;
  },
  opsHTML() {
    const owner = this.st.role === 'owner';
    const row = o => `<div class="ac-row op-u">${avatarOf(o, 'sm')}<span class="grow ac-who op-nm" data-act="acCard" data-uid="${esc(o.id)}" role="button" tabindex="0"><b>${esc(o.name)}${o.me ? ' <small class="muted">(나)</small>' : ''}</b>${opBadge(o.role)}</span>
      <small class="${o.on ? 'op-on' : 'muted'}">${o.on ? '● 접속 중' : agoText(Date.now() - o.seen)}</small>
      ${owner && o.role === 'admin' ? `<button class="btn sm ghost" data-act="opRevoke" data-uid="${esc(o.id)}" data-name="${esc(o.name)}">${icon('user-minus')}해제</button>` : ''}</div>`;
    const res = this.found;
    return `<div class="ac-set"><h4>${icon('user-shield')}운영자 ${this.st.ops.length}명</h4><div class="ac-list">${this.st.ops.map(row).join('')}</div>
      ${owner ? `<div class="op-find"><input type="text" id="op-q" maxlength="10" placeholder="운영자로 지정할 회원 이름" autocomplete="off"><button class="btn sm" data-act="opFind">${icon('search')}찾기</button></div>
        <div id="op-found">${res ? (res.length ? `<div class="ac-list">${res.map(u => `<div class="ac-row">${avatarOf(u, 'sm')}<span class="grow ac-who" data-act="acCard" data-uid="${esc(u.id)}" role="button" tabindex="0"><b>${esc(u.name)}</b> ${lvTag(u.lv)} ${opBadge(u.role)}</span>
          <small class="muted">${u.on ? '● 접속 중' : agoText(Date.now() - u.seen)} · ${u.plays}판</small>${u.role ? '' : `<button class="btn sm good" data-act="opGrant" data-uid="${esc(u.id)}" data-name="${esc(u.name)}">${icon('user-plus')}지정</button>`}</div>`).join('')}</div>` : '<p class="muted small">찾는 이름의 회원이 없어요.</p>') : ''}</div>
        <p class="small muted">운영자는 전체 공지 · 서버 현황 · 활동 기록을 쓸 수 있어요. 운영자 지정 · 해제는 최고 운영자만 할 수 있어요. 프로필 카드에서도 지정할 수 있어요.</p>` : '<p class="small muted">운영자 지정 · 해제는 최고 운영자만 할 수 있어요.</p>'}</div>`;
  },
  histHTML() {
    const h = this.st.hist;
    if (!h.length) return '';
    return `<div class="ac-set"><h4>${icon('history')}지난 공지</h4><div class="ac-list op-hist">${h.map(x => `<div class="ac-row"><span class="nt-kind sm ${x.kind}">${(NT_KIND[x.kind] || NT_KIND.info)[0]}</span><span class="grow">${esc(x.title)}</span>
      <small class="muted">${esc(x.by || '')} · ${hhmm(x.at)}${x.live ? ' · <b class="op-on">지금 걸림</b>' : x.ended ? ' · 내림' : ''}</small></div>`).join('')}</div></div>`;
  },
  logsHTML() {
    const A = { claim: '인증', 'claim-fail': '인증 실패', resign: '그만둠', grant: '지정', revoke: '해제', notice: '공지', end: '내림' };
    const when = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    return `<div class="ac-set"><h4>${icon('list-details')}활동 기록</h4>${this.st.logs.length ? `<div class="ac-list op-logs">${this.st.logs.map(l => `<div class="ac-row"><small class="muted op-t">${when(l.t)}</small>
      <span class="op-a ${l.a}">${A[l.a] || l.a}</span><span class="grow"><b>${esc(l.by)}</b> ${esc(l.x)}</span></div>`).join('')}</div>` : '<p class="muted small">아직 기록이 없어요.</p>'}</div>`;
  },
  bindForm() {
    const t = $('#op-title'), b = $('#op-body'), q = $('#op-q');
    if (t) t.addEventListener('input', () => { this.f.title = t.value; });
    if (b) b.addEventListener('input', () => { this.f.body = b.value; });
    if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); ACT.opFind(); } });
  },
  draft() {
    const f = this.f;
    return { id: 'preview', kind: f.kind, title: f.title.trim(), body: f.body.trim(), by: Acct.me ? Acct.me.name : '운영자', at: Date.now(), eta: f.kind === 'patch' ? Date.now() + f.min * 60000 : 0 };
  },
  /** 운영 탭이 열려 있으면 다시 그리기 (입력 중인 글은 this.f 에 남아요) */
  refresh() { if (Acct.ui.view === 'me' && Acct.ui.tab === 'op') this.render(); },
};

Object.assign(ACT, {
  ntClose: () => Notice.closePop(),
  ntOpen: () => { if (Notice.n) Notice.openPop(Notice.n); },
  ntShut: () => { if (Notice.n) { Notice.shut = Notice.n.id; if (Notice.n.kind !== 'patch') Notice.markSeen(Notice.n.id); Notice.render(); } },
  ntReload: () => {
    if (S.code && !confirm('새로 고침하면 지금 있는 방에서 나가게 돼요. 새로 고칠까요?')) return;
    location.reload();
  },
  opSeg: el => {
    const k = el.dataset.k, v = el.dataset.v;
    Admin.f[k] = k === 'kind' ? v : +v;
    const t = $('#op-title'), b = $('#op-body');
    if (t) Admin.f.title = t.value; if (b) Admin.f.body = b.value;
    const box = $('.op-form');
    if (box) { box.outerHTML = Admin.formHTML(); Admin.bindForm(); }
  },
  opPreview: () => {
    const d = Admin.draft();
    if (!d.title) return toast(ACC_WHY.title, 'error');
    Notice.openPop(d, true);
  },
  opSend: async () => {
    const d = Admin.draft();
    if (!d.title) return toast(ACC_WHY.title, 'error');
    const what = d.kind === 'patch' ? `${Admin.f.min}분 뒤 업데이트 예고` : (NT_KIND[d.kind] || NT_KIND.info)[0];
    if (!confirm(`접속한 모든 사람에게 [${what}] '${d.title}' 을(를) 보낼까요?`)) return;
    const r = await ask('admin:notice', { kind: d.kind, title: d.title, body: d.body, min: Admin.f.min, dur: Admin.f.dur });
    if (!r.ok) return toast(r.why === 'limit' ? '공지를 너무 빨리 연달아 보내고 있어요. 잠깐 뒤에 보내 주세요.' : whyText(r), 'error');
    Admin.f.title = ''; Admin.f.body = '';
    toast('📢 전체 공지를 보냈어요.', 'good');
    Admin.refresh();
  },
  opEnd: async () => {
    if (!confirm('지금 걸린 공지를 모두의 화면에서 내릴까요?')) return;
    const r = await ask('admin:end');
    if (!r.ok) return toast(whyText(r), 'error');
    toast('공지를 내렸어요.', 'good');
    Admin.refresh();
  },
  opRefresh: () => Admin.refresh(),
  opSub: el => { Admin.sub = el.dataset.k; Admin.render(); },
  opFind: async () => {
    const q = $('#op-q'); if (!q) return;
    const r = await ask('admin:find', { q: q.value });
    if (!r.ok) return toast(whyText(r), 'error');
    Admin.found = r.list;
    const box = $('#op-found');
    if (box) { const v = q.value; Admin.render().then(() => { const q2 = $('#op-q'); if (q2) q2.value = v; }); }
  },
  opGrant: async el => {
    if (!confirm(`${el.dataset.name} 님을 운영자로 지정할까요?\n운영자는 전체 공지를 보내고 서버 현황 · 활동 기록을 볼 수 있어요.`)) return;
    const r = await ask('admin:grant', { uid: el.dataset.uid });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(`🛡️ ${el.dataset.name} 님을 운영자로 지정했어요.`, 'good');
    Admin.found = null;
    if (Acct.ui.view === 'card') Acct.card(el.dataset.uid); else Admin.refresh();
  },
  opRevoke: async el => {
    if (!confirm(`${el.dataset.name} 님을 운영자에서 해제할까요?`)) return;
    const r = await ask('admin:revoke', { uid: el.dataset.uid });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(`${el.dataset.name} 님을 운영자에서 해제했어요.`, 'good');
    if (Acct.ui.view === 'card') Acct.card(el.dataset.uid); else Admin.refresh();
  },
  opClaim: async () => {
    const k = $('#op-key'); if (!k) return;
    const r = await ask('admin:claim', { key: k.value });
    if (!r.ok) return toast(whyText(r), 'error');
    toast('🛡️ 최고 운영자가 됐어요! 내 정보 → 운영 탭에서 전체 공지를 보낼 수 있어요.', 'good');
  },
  opResign: async () => {
    if (!confirm('운영자를 그만둘까요? 다시 하려면 최고 운영자가 지정하거나 운영자 키로 인증해야 해요.')) return;
    const r = await ask('admin:resign');
    if (!r.ok) return toast(whyText(r), 'error');
  },
});
$('#notice-ov').addEventListener('click', e => { if (e.target.id === 'notice-ov') Notice.closePop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#notice-ov').classList.contains('show')) Notice.closePop(); });
// 내 역할이 바뀌었을 때 (지정 · 해제 · 인증)
socket.on('admin:role', d => {
  if (d && d.msg) toast((d.role ? '🛡️ ' : '') + d.msg, d.role ? 'good' : '');
  setTimeout(() => {
    if (Acct.ui.view !== 'me') return;
    if (!d.role && Acct.ui.tab === 'op') Acct.ui.tab = 'rec';
    Acct.renderProfile();
  }, 200);
});
