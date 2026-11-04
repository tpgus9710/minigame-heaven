/* =====================================================================
 *  📮 신고 · 요청 (누구나: 버그 · 불편해요 · 희망 게임 · 요청 사항 · 기타) · 신고함 (운영자)
 *   - 메뉴 → 신고 · 요청 · 홈 화면 아래 링크 → 종류 · 내용 · 지금 화면 정보(게임 · 기기 · 화면 크기)를
 *     운영자에게 비공개로 보내요. 다른 사람에게는 보이지 않아요.
 *   - 운영자가 답장하면 [내 신고]에 빨간 점 → 처리 상태 · 답장 확인
 *     (로그인했으면 어디서든, 손님이면 이 기기에 보관한 영수증으로)
 *   - 운영자: 내 정보 → 운영 → 신고함 (새 신고 알림 · 확인함 · 처리 완료 · 답장 · 지우기)
 *   서버: lib/report.js
 * ===================================================================== */
const RP_KIND = { bug: ['버그', 'bug'], ux: ['불편해요', 'alert-triangle'], game: ['희망 게임', 'device-gamepad-2'], idea: ['요청 사항', 'sparkles'], etc: ['기타', 'message-circle'] };
const RP_ST = { new: '접수됨', seen: '확인 중', done: '처리 완료' };          // 신고한 사람에게
const RP_OPST = { new: '새 신고', seen: '확인함', done: '완료' };             // 운영자에게
const RP_PH = {
  bug: '어떤 게임 · 화면에서 무엇을 하다가 어떤 일이 생겼는지 적어 주세요.&#10;예) 루미큐브에서 타일을 누르자마자 시간 초과가 떠요.',
  ux: '불편했던 점을 적어 주세요.&#10;예) 휴대폰에서 버튼이 작아서 누르기 힘들어요.',
  game: '하고 싶은 게임을 알려 주세요. 어떻게 하는 게임인지도 적어 주면 더 좋아요.&#10;예) 젠가 · 할리갈리 4인 · 테트리스 대결 …',
  idea: '바라는 점 · 생겼으면 하는 기능을 적어 주세요.&#10;예) 친구랑 같은 팀으로 하는 모드가 있으면 좋겠어요.',
  etc: '운영자에게 전하고 싶은 말을 적어 주세요.',
};
// (계정 화면의 dup · empty · none 같은 이름과 겹치지 않게 rp 를 붙여요)
Object.assign(ACC_WHY, { rpshort: '내용을 5글자 이상 적어 주세요.', rpsame: '같은 내용을 방금 보냈어요.', rpgone: '이미 지워진 신고예요.', rpempty: '답장 내용을 적어 주세요.' });
const rpWhen = t => { const d = new Date(t), now = new Date(); const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; return d.toDateString() === now.toDateString() ? `오늘 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`; };
/** 기기 · 브라우저 이름 (운영자가 어떤 기기에서 생긴 문제인지 알 수 있게) */
const rpDev = (ua, touch) => {
  ua = String(ua || ''); if (!ua) return '';
  const os = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android 폰' : 'Android 태블릿')
    : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /Whale/.test(ua) ? '웨일' : /Edg(A|iOS)?\//.test(ua) ? 'Edge' : /KAKAOTALK/i.test(ua) ? '카카오톡' : /NAVER\(/.test(ua) ? '네이버 앱'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, br].filter(Boolean).join(' ');
};
const SCR_NAME = { home: '처음 화면', single: '싱글 메뉴', multi: '멀티 메뉴', lobby: '대기실' };

const Report = {
  ui: { tab: 'write', kind: 'bug', text: '', ctx: true, busy: false, sent: null },
  mine: null, unread: 0, syncK: '', syncT: 0, syncTimer: null,
  op: { f: 'new', list: null, counts: { new: 0, seen: 0, done: 0, all: 0 }, more: false, n: 30, draft: {} },
  get opNew() { return this.isOp() ? this.op.counts.new || 0 : 0; },
  isOp: () => !!(typeof Acct !== 'undefined' && Acct.me && Acct.me.role),
  /** 손님 영수증 (이 기기에 보관) */
  tks() { try { const a = JSON.parse(localStorage.getItem('mgReports') || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.id === 'string' && typeof x.tk === 'string').slice(-30) : []; } catch { return []; } },
  addTk(id, tk) { try { const a = this.tks().filter(x => x.id !== id); a.push({ id, tk }); localStorage.setItem('mgReports', JSON.stringify(a.slice(-30))); } catch { /* 저장 못 해도 신고는 됐어요 */ } },
  /** 지금 화면 정보 */
  ctxNow() {
    const scr = S.screen || ((document.querySelector('.screen.active') || {}).id || '').replace(/^scr-/, '');
    const key = S.solo || (S.room && S.room.gameType) || (GAME_INFO[scr] ? scr : '');
    const lag = parseInt(((($('#conn span') || {}).textContent || '').match(/(\d+)ms/) || [])[1], 10) || 0;
    return { scr, game: key, name: key && GAME_INFO[key] ? GAME_INFO[key].name : '', solo: !!S.solo || (!S.code && !!key),
      w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, touch: navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches,
      ver: [typeof APP_VER !== 'undefined' && APP_VER ? 'v' + APP_VER : '', (S.serverInfo && S.serverInfo.build) || ''].filter(Boolean).join(' · '), lag };
  },
  ctxText(c) {
    if (!c) return '';
    if (c.off) { const d = rpDev(c.ua); return `화면 정보 안 보냄${d ? ' · ' + d : ''}`; }
    const nm = c.name || (GAME_INFO[c.game] && GAME_INFO[c.game].name) || '';
    const where = nm ? `${nm}${c.solo ? ' (싱글)' : c.room ? ` (멀티 · 방 ${c.room}${c.playing ? ' · 게임 중' : ' · 대기실'}${c.n ? ` · ${c.n}명` : ''})` : ''}` : SCR_NAME[c.scr] || c.scr || '';
    return [where, rpDev(c.ua, c.touch), c.w ? `화면 ${c.w}×${c.h}${c.touch ? ' 터치' : ''}` : '', c.lag ? `지연 ${c.lag}ms` : '', c.ver ? `버전 ${c.ver}` : ''].filter(Boolean).join(' · ');
  },

  /* ───── 신고 창 ───── */
  isOpen: () => $('#rp-ov').classList.contains('show'),
  open(tab) {
    if (tab) this.ui.tab = tab;
    if (this.ui.tab === 'write') this.ui.sent = null;
    $('#rp-ov').classList.add('show');
    this.render();
    if (this.ui.tab === 'mine') this.loadMine();
    else if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => { const t = $('#rp-text'); if (t) t.focus(); }, 60);
  },
  close() { $('#rp-ov').classList.remove('show'); },
  render() { const m = $('#rp-modal'); if (!m) return; m.innerHTML = this.html(); this.bind(); },
  html() {
    const u = this.ui;
    const tab = (k, ic, label, extra = '') => `<button class="ac-tab ${u.tab === k ? 'on' : ''}" data-act="rpTab" data-tab="${k}">${icon(ic)}${label}${extra}</button>`;
    const opBar = this.isOp() ? `<button class="rp-opbar" data-act="rpGoOp">${icon('inbox')}<span>운영자 신고 · 요청함${this.opNew ? ` · 새 글 <b>${this.opNew}</b>개` : ''}</span></button>` : '';
    return `<div class="rp-head"><span class="rp-ic">${icon('message-report')}</span><div><h2>신고 · 요청</h2><p class="muted">버그 · 불편한 점 · 하고 싶은 게임 · 바라는 점을 운영자에게 보내요. 운영자만 볼 수 있어요.</p></div>
        <button class="nb-x" data-act="rpClose" aria-label="닫기">${icon('x')}</button></div>${opBar}
      <div class="ac-tabs rp-tabs">${tab('write', 'send', '보내기')}${tab('mine', 'inbox', '보낸 글', this.unread ? `<i class="ac-dot">${this.unread}</i>` : '')}</div>
      ${u.tab === 'mine' ? this.mineHTML() : this.writeHTML()}`;
  },
  writeHTML() {
    const u = this.ui;
    if (u.sent) return `<div class="rp-done">${icon('circle-check')}<h3>보냈어요! 고마워요</h3>
      <p class="muted">운영자가 확인하면 [보낸 글]에서 처리 상태와 답장을 볼 수 있어요.${Acct.me ? '' : '<br>손님으로 보낸 글은 이 기기에서만 다시 볼 수 있어요.'}</p>
      <div class="ov-actions"><button class="btn ghost" data-act="rpTab" data-tab="mine">${icon('inbox')}보낸 글 보기</button><button class="btn good" data-act="rpClose">닫기</button></div></div>`;
    const kinds = Object.entries(RP_KIND).map(([k, [t, ic]]) => `<button class="seg-btn rp-k ${k} ${u.kind === k ? 'on' : ''}" data-act="rpKind" data-k="${k}">${icon(ic)}${t}</button>`).join('');
    return `<div class="rp-form">
      <div class="rp-kinds">${kinds}</div>
      <textarea id="rp-text" maxlength="1000" rows="6" placeholder="${RP_PH[u.kind] || RP_PH.etc}">${esc(u.text)}</textarea>
      <div class="rp-meta"><label class="rp-ctx"><input type="checkbox" id="rp-ctx" ${u.ctx ? 'checked' : ''}>지금 화면 정보도 함께 보내기</label><small class="muted" id="rp-cnt">${[...u.text].length} / 1000</small></div>
      <small class="muted rp-ctxv ${u.ctx ? '' : 'off'}">${icon('devices')}${esc(this.ctxText({ ...this.ctxNow(), ua: navigator.userAgent }))}</small>
      ${Acct.me ? '' : '<p class="small muted rp-guest">손님으로 보내도 돼요. 로그인하면 운영자 답장이 오면 바로 알려 드려요.</p>'}
      <div class="ov-actions"><button class="btn ghost" data-act="rpClose">닫기</button><button class="btn good" data-act="rpSend" ${u.busy ? 'disabled' : ''}>${icon('send')}${u.busy ? '보내는 중…' : '운영자에게 보내기'}</button></div></div>`;
  },
  itemHTML(r) {
    const [t, ic] = RP_KIND[r.kind] || RP_KIND.etc;
    return `<div class="rp-item ${r.st}${r.reply && !r.read ? ' unread' : ''}">
      <div class="rp-top"><span class="rp-kind ${r.kind}">${icon(ic)}${t}</span><span class="rp-st ${r.st}">${RP_ST[r.st] || ''}</span><small class="muted">${rpWhen(r.at)}</small></div>
      <p class="rp-text">${esc(r.text)}</p>
      ${r.reply ? `<div class="rp-reply">${icon('arrow-back-up')}<div><b>운영자 답장</b> <small class="muted">${rpWhen(r.reply.at)}</small><p>${esc(r.reply.text)}</p></div></div>` : ''}</div>`;
  },
  mineHTML() {
    const L = this.mine;
    if (!L) return '<div class="muted center ac-load">불러오는 중…</div>';
    const guest = Acct.me ? '' : '<p class="small muted rp-guest">손님으로 보낸 글은 보낸 기기에서만 볼 수 있어요. 로그인하면 어디서든 볼 수 있어요.</p>';
    if (!L.length) return `<p class="muted center rp-empty">아직 보낸 글이 없어요.</p>${guest}`;
    return `<div class="rp-list">${L.map(r => this.itemHTML(r)).join('')}</div>${guest}`;
  },
  bind() {
    const t = $('#rp-text'), c = $('#rp-ctx');
    if (t) t.addEventListener('input', () => { this.ui.text = t.value; const n = $('#rp-cnt'); if (n) n.textContent = `${[...t.value].length} / 1000`; });
    if (c) c.addEventListener('change', () => { this.ui.ctx = c.checked; const v = $('.rp-ctxv'); if (v) v.classList.toggle('off', !c.checked); });
  },
  async send() {
    const u = this.ui, t = $('#rp-text');
    if (t) u.text = t.value;
    if ([...u.text.replace(/\s/g, '')].length < 5) { toast(ACC_WHY.rpshort, 'error'); if (t) t.focus(); return; }
    if (u.busy) return;
    u.busy = true; this.render();
    const r = await ask('report:send', { kind: u.kind, text: u.text, name: Acct.me ? '' : nick(), ctx: u.ctx ? this.ctxNow() : { off: 1 } });
    u.busy = false;
    if (!r.ok) { this.render(); return toast(r.why === 'limit' ? '신고를 너무 자주 보냈어요. 잠시 뒤에 다시 보내 주세요.' : whyText(r), 'error'); }
    this.addTk(r.id, r.tk);
    u.text = ''; u.sent = r.id; this.mine = null;
    if (this.isOpen()) this.render();
    toast(u.kind === 'game' || u.kind === 'idea' ? '📮 요청을 보냈어요. 고마워요!' : '📮 신고를 보냈어요. 고마워요!', 'good');
  },
  async loadMine() {
    if (!Acct.me && !this.tks().length) { this.mine = []; this.unread = 0; this.renderBtn(); if (this.isOpen() && this.ui.tab === 'mine') this.render(); return; }
    const r = await ask('report:mine', { tks: this.tks() });
    if (!r.ok) { if (!this.mine) this.mine = []; if (this.isOpen() && this.ui.tab === 'mine') this.render(); return; }
    this.mine = r.list;
    this.unread = r.list.filter(x => x.reply && !x.read).length;
    this.renderBtn();
    if (this.isOpen() && this.ui.tab === 'mine') { this.render(); this.markRead(); }
  },
  /** 답장을 봤어요 → 빨간 점 지우기 (화면의 강조 표시는 다음에 열 때까지 남아요) */
  markRead() {
    const ids = (this.mine || []).filter(x => x.reply && !x.read).map(x => x.id);
    if (!ids.length) return;
    ask('report:read', { ids, tks: this.tks() });
    for (const x of this.mine) if (ids.includes(x.id)) x.read = Date.now();
    this.unread = 0; this.renderBtn();
    const tb = $('.rp-tabs .ac-dot'); if (tb) tb.remove();
  },
  /** 위쪽 버튼의 빨간 점: 내 신고에 온 답장 + (운영자) 새 신고 */
  renderBtn() {
    const b = $('#rp-top'); if (!b) return;
    const n = this.unread + this.opNew;
    b.querySelector('.rp-dot').textContent = n > 99 ? '99+' : n || '';
    b.classList.toggle('has', !!n);
    b.title = this.opNew ? `신고 · 요청 (새 글 ${this.opNew}개)` : this.unread ? '신고 · 요청 (운영자 답장이 왔어요)' : '신고 · 요청';
    if (typeof Menu !== 'undefined') Menu.badge();                          // 메뉴 버튼의 빨간 점 (menu.js)
  },
  /** 접속 · 로그인 · 역할이 바뀌면 답장 · 새 신고 수를 다시 받아요 */
  sync(force) {
    clearTimeout(this.syncTimer);
    this.syncForce = this.syncForce || !!force;          // 다시 연결됐을 때는 꼭 (그사이 온 답장 · 새 신고)
    this.syncTimer = setTimeout(() => {
      const k = Acct.me ? `${Acct.me.id}:${Acct.me.role || ''}` : 'guest', f = this.syncForce;
      this.syncForce = false;
      if (!f && k === this.syncK && Date.now() - this.syncT < 60000) return;
      this.syncK = k; this.syncT = Date.now();
      if (Acct.me || this.tks().length) this.loadMine(); else { this.unread = 0; this.mine = null; }
      if (this.isOp()) this.opCounts(); else { this.op.counts = { new: 0, seen: 0, done: 0, all: 0 }; this.op.list = null; }
      this.renderBtn();
    }, 700);
  },

  /* ───── 운영자: 신고함 (내 정보 → 운영 → 신고함) ───── */
  async opCounts() {
    const r = await ask('admin:reports', { f: 'new', n: 0 });
    if (r.ok) { this.op.counts = r.counts; this.opBadges(); }
  },
  /** 새 신고 수 표시: 위쪽 버튼 · 운영 탭 · 신고함 칸 */
  opBadges() {
    this.renderBtn();
    if (typeof Acct !== 'undefined' && Acct.ui.view === 'me') Acct.refreshHead();
    const s = $('.op-subs [data-k="rep"]');
    if (s) { const d = s.querySelector('.ac-dot'); if (d) d.remove(); if (this.opNew) s.insertAdjacentHTML('beforeend', `<i class="ac-dot">${this.opNew}</i>`); }
    if (this.isOpen()) { const ob = $('.rp-opbar span'); if (ob) ob.innerHTML = `운영자 신고 · 요청함${this.opNew ? ` · 새 글 <b>${this.opNew}</b>개` : ''}`; }
  },
  opOpen: () => !!$('#rp-op'),
  async opRender() {
    const box = $('#rp-op'); if (!box) return;
    const o = this.op;
    const r = await ask('admin:reports', { f: o.f, n: o.n });
    const b = $('#rp-op'); if (!b) return;
    if (!r.ok) { b.innerHTML = `<p class="muted">${esc(whyText(r))}</p>`; return; }
    o.list = r.list; o.counts = r.counts; o.more = r.more;
    b.innerHTML = this.opHTML();
    this.opBind();
    this.opBadges();
  },
  opHTML() {
    const o = this.op, c = o.counts;
    const chip = (k, t, n) => `<button class="seg-btn ${o.f === k ? 'on' : ''}" data-act="rpOpF" data-f="${k}">${t} <b>${n}</b></button>`;
    const empty = { new: '새 글이 없어요. 👍', seen: '확인 중인 글이 없어요.', done: '처리 완료한 글이 없어요.', all: '아직 들어온 글이 없어요.' }[o.f];
    return `<div class="ac-set rp-op"><h4>${icon('inbox')}신고 · 요청함 <button class="btn sm ghost op-refresh" data-act="rpOpRefresh" title="새로 고침">${icon('refresh')}</button></h4>
      <div class="op-seg rp-fs">${chip('new', '새 글', c.new)}${chip('seen', '확인함', c.seen)}${chip('done', '완료', c.done)}${chip('all', '전체', c.all)}</div>
      <div class="rp-list">${o.list && o.list.length ? o.list.map(r => this.opItem(r)).join('') : `<p class="muted small rp-empty">${empty}</p>`}</div>
      ${o.more ? '<button class="btn sm ghost rp-more" data-act="rpOpMore">더 보기</button>' : ''}
      <p class="small muted">신고는 운영자만 볼 수 있어요. 답장하면 신고한 사람의 [내 신고]에 보이고, 로그인한 사람에게는 바로 알림이 가요.</p></div>`;
  },
  opItem(r) {
    const [t, ic] = RP_KIND[r.kind] || RP_KIND.etc, id = esc(r.id);
    const who = r.from.guest ? `<b>${esc(r.from.name)}</b> <small class="muted">손님</small>`
      : `<span class="ac-who" data-act="acCard" data-uid="${esc(r.from.uid)}" role="button" tabindex="0"><b>${esc(r.from.name)}</b></span>${lvTag(r.from.lv)}`;
    const d = this.op.draft[r.id];
    const readTxt = r.from.uid ? (r.read ? ' · 읽음' : ' · 아직 안 읽음') : ' · 손님 (보낸 기기에서 볼 수 있어요)';
    return `<div class="rp-item op ${r.st}">
      <div class="rp-top"><span class="rp-kind ${r.kind}">${icon(ic)}${t}</span><span class="rp-st ${r.st}">${RP_OPST[r.st] || ''}</span><span class="rp-who">${who}</span><small class="muted">${rpWhen(r.at)}</small></div>
      <p class="rp-text">${esc(r.text)}</p>
      ${r.ctx ? `<div class="rp-ctx-v">${icon('devices')}<span>${esc(this.ctxText(r.ctx))}</span></div>` : ''}
      ${r.reply ? `<div class="rp-reply">${icon('arrow-back-up')}<div><b>${esc(r.reply.by || '운영자')}</b> <small class="muted">${rpWhen(r.reply.at)}${readTxt}</small><p>${esc(r.reply.text)}</p></div></div>` : ''}
      ${r.by && r.st !== 'new' ? `<small class="muted rp-by">${esc(r.by.name)} 님이 ${RP_OPST[r.st]} · ${rpWhen(r.by.at)}</small>` : ''}
      ${d != null ? `<div class="rp-rbox"><textarea id="rp-r-${id}" data-id="${id}" maxlength="500" rows="3" placeholder="신고한 사람에게 보낼 답장 (500자까지)">${esc(d)}</textarea>
        <div class="ac-btnrow"><button class="btn sm ghost" data-act="rpOpReplyX" data-id="${id}">취소</button><button class="btn sm good" data-act="rpOpReplySend" data-id="${id}">${icon('send')}답장 보내기</button></div></div>` : ''}
      <div class="ac-btnrow rp-acts">
        ${r.st === 'new' ? `<button class="btn sm ghost" data-act="rpOpSet" data-id="${id}" data-st="seen">${icon('eye')}확인함</button>` : ''}
        ${r.st !== 'done' ? `<button class="btn sm good" data-act="rpOpSet" data-id="${id}" data-st="done">${icon('checks')}처리 완료</button>` : `<button class="btn sm ghost" data-act="rpOpSet" data-id="${id}" data-st="seen">${icon('arrow-back-up')}다시 열기</button>`}
        ${d != null ? '' : `<button class="btn sm ghost" data-act="rpOpReply" data-id="${id}">${icon('message-circle')}${r.reply ? '답장 고치기' : '답장'}</button>`}
        <button class="btn sm ghost rp-del" data-act="rpOpDel" data-id="${id}" title="지우기" aria-label="지우기">${icon('trash')}</button></div></div>`;
  },
  opBind() {
    for (const t of document.querySelectorAll('.rp-rbox textarea')) t.addEventListener('input', () => { this.op.draft[t.dataset.id] = t.value; });
  },
  opPaint() { const box = $('#rp-op'); if (box && this.op.list) { box.innerHTML = this.opHTML(); this.opBind(); } },
  /** 바뀐 신고 하나를 목록에서 그 자리에 바꿔요 (칸이 안 맞아도 새로 고칠 때까지 보여 줘요 → 방금 한 일이 바로 보여요) */
  opPatch(r) { const L = this.op.list; if (!L || !r) return; const i = L.findIndex(x => x.id === r.id); if (i >= 0) L[i] = r; },
  /** 새 신고 · 다른 운영자가 처리함 → 목록을 그 자리에서 고쳐요 (답장을 쓰는 중이면 숫자만) */
  opLive(d) {
    const o = this.op;
    if (d && d.counts) o.counts = d.counts;
    if (o.list && d) {
      if (d.del) o.list = o.list.filter(x => x.id !== d.del);
      else if (d.r) { const i = o.list.findIndex(x => x.id === d.r.id); if (i >= 0) o.list[i] = d.r; else if (d.isNew && (o.f === 'new' || o.f === 'all')) o.list.unshift(d.r); }
    }
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('.rp-rbox');
    if (this.opOpen() && !typing) this.opPaint();
    this.opBadges();
  },
};

/* ─── 화면에 붙이기: 위쪽 버튼 · 신고 창 · 홈 화면 링크 ─── */
(() => {
  const b = document.createElement('button');
  b.id = 'rp-top'; b.className = 'btn ghost sm rp-top'; b.dataset.act = 'rpOpen'; b.title = '신고 · 요청';
  b.innerHTML = `${icon('message-report')}<span class="tb-t">신고</span><b class="rp-dot"></b>`;
  $('#theme-btn').before(b);
  document.body.insertAdjacentHTML('beforeend', '<div class="overlay" id="rp-ov"><div class="modal rp-modal" id="rp-modal" role="dialog" aria-modal="true" aria-label="신고 · 요청"></div></div>');
  $('#rp-ov').addEventListener('mousedown', e => { if (e.target.id === 'rp-ov') Report.close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Report.isOpen()) Report.close(); });
  const hero = $('#scr-home .hero');
  if (hero) hero.insertAdjacentHTML('beforeend', `<button class="rp-home" data-act="rpOpen">${icon('message-report')}불편한 점이나 하고 싶은 게임이 있나요? <b>신고 · 요청</b></button>`);
})();
// 로그인 · 로그아웃 · 역할이 바뀌면 다시 받아요 (account.js 의 setMe 뒤에)
{
  const setMe0 = Acct.setMe;
  Acct.setMe = function (...a) { const r = setMe0.apply(this, a); Report.sync(); return r; };
}
socket.on('connect', () => Report.sync(true));
if (socket.connected) Report.sync(true);
// 운영자: 새 신고 · 다른 운영자가 처리함
socket.on('admin:report', d => {
  if (!d || !Report.isOp()) return;
  const r = d.r, [t] = RP_KIND[r && r.kind] || RP_KIND.etc;
  if (r) toast(`📮 새 글 [${t}] ${String(r.text).slice(0, 40)}${[...String(r.text)].length > 40 ? '…' : ''}`, 'good');
  if (typeof Sound !== 'undefined') Sound.play('invite');
  Report.opLive({ ...d, isNew: true });
});
socket.on('admin:report:upd', d => { if (d && Report.isOp()) Report.opLive(d); });
// 신고한 사람: 운영자 답장
socket.on('report:reply', d => {
  toast('📮 운영자가 답장했어요. 메뉴 → 신고 · 요청 → 보낸 글에서 볼 수 있어요.', 'good');
  if (typeof Sound !== 'undefined') Sound.play('invite');
  Report.unread++; Report.renderBtn();
  if (Report.isOpen() && Report.ui.tab === 'mine') Report.loadMine();
  else Report.mine = null;
});

Object.assign(ACT, {
  rpOpen: () => Report.open(Report.unread ? 'mine' : 'write'),
  rpClose: () => Report.close(),
  rpTab: el => { Report.ui.tab = el.dataset.tab; if (Report.ui.tab === 'write') Report.ui.sent = null; Report.render(); if (Report.ui.tab === 'mine') Report.loadMine(); },
  rpKind: el => {
    const t = $('#rp-text'); if (t) Report.ui.text = t.value;
    Report.ui.kind = el.dataset.k;
    for (const b of document.querySelectorAll('.rp-k')) b.classList.toggle('on', b === el);
    if (t) t.placeholder = (RP_PH[Report.ui.kind] || '').replace(/&#10;/g, '\n');
  },
  rpSend: () => Report.send(),
  rpGoOp: () => { Report.close(); if (typeof Admin !== 'undefined') Admin.sub = 'rep'; Acct.openMe('op'); },
  rpOpF: el => { Report.op.f = el.dataset.f; Report.op.n = 30; Report.op.draft = {}; Report.opRender(); },
  rpOpRefresh: () => Report.opRender(),
  rpOpMore: () => { Report.op.n += 30; Report.opRender(); },
  rpOpSet: async el => {
    const r = await ask('admin:report:set', { id: el.dataset.id, st: el.dataset.st });
    if (!r.ok) { toast(whyText(r), 'error'); return Report.opRender(); }
    if (el.dataset.st === 'done') toast('✅ 처리 완료로 옮겼어요.', 'good');
    Report.opPatch(r.r); Report.opPaint();
  },
  rpOpReply: el => {
    const r = (Report.op.list || []).find(x => x.id === el.dataset.id);
    Report.op.draft[el.dataset.id] = r && r.reply ? r.reply.text : '';
    Report.opPaint();
    const t = document.getElementById('rp-r-' + el.dataset.id); if (t) t.focus();
  },
  rpOpReplyX: el => { delete Report.op.draft[el.dataset.id]; Report.opPaint(); },
  rpOpReplySend: async el => {
    const id = el.dataset.id, t = document.getElementById('rp-r-' + id), text = t ? t.value.trim() : '';
    if (!text) return toast(ACC_WHY.rpempty, 'error');
    el.disabled = true;
    const r = await ask('admin:report:reply', { id, text });
    el.disabled = false;
    if (!r.ok) return toast(whyText(r), 'error');
    delete Report.op.draft[id];
    toast('📮 답장을 보냈어요.', 'good');
    Report.opPatch(r.r); Report.opPaint();
  },
  rpOpDel: async el => {
    if (!confirm('이 신고를 지울까요? 지우면 되돌릴 수 없고, 신고한 사람의 [내 신고]에서도 사라져요.')) return;
    const r = await ask('admin:report:del', { id: el.dataset.id });
    delete Report.op.draft[el.dataset.id];
    if (!r.ok) { toast(whyText(r), 'error'); return Report.opRender(); }
    Report.op.list = (Report.op.list || []).filter(x => x.id !== el.dataset.id); Report.opPaint();
  },
});
