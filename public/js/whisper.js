/* =====================================================================
 *  💬 게임 중 귓속말 (v13.3)
 *   - 게임 중에 친구 귓속말이 오면 게임 밖(위쪽 막대의 로고 자리)에 한 줄로 보여 줘요
 *     · 닫거나 답장할 때까지 그대로 · 새로 오면 살짝 반짝 + 알림음(수업 모드면 소리 없이)
 *     · 가로 휴대폰처럼 게임 중 위쪽 막대가 숨는 화면에선 맨 위 가운데 작은 알약으로 → 5초 뒤엔 얼굴 동그라미로 작게 접혀요
 *   - 누르면(「답장」) 바로 아래 작은 대화 칸: 최근 대화 + 입력 (Enter 보내기 · Esc/바깥 누르기 닫기)
 *   - 닫은 것(안 읽은 귓속말)은 예전처럼 게임이 끝나면 알림 카드로 한 번 더 알려 줘요
 *   계정 쪽 연결: account.js 의 onDM(게임 중) · onRead · stashCards · tickBusy
 * ===================================================================== */
const WhBar = {
  list: new Map(),                                                    // 친구 id → { from, x, n }
  uid: null,                                                          // 지금 위에 보여 주는 친구
  mini: null,                                                         // 답장 칸 { uid, friend, log, sending }
  el() {
    let el = document.getElementById('wh-bar');
    if (!el) { el = document.createElement('div'); el.id = 'wh-bar'; el.className = 'wh-bar'; el.setAttribute('role', 'status'); document.body.append(el); }
    return el;
  },
  /** 게임 중에 온 귓속말 */
  push(from, x, n, quiet = false) {
    if (!from || !from.id || !Acct.me) return;
    if (this.mini && this.mini.uid === from.id) {                    // 그 친구와 답장 칸이 열려 있으면 거기에 바로
      this.miniAdd({ id: Date.now(), f: from.id, x, t: Date.now() });
      ask('dm:read', { uid: from.id });
      return;
    }
    const o = this.list.get(from.id);
    this.list.delete(from.id);
    this.list.set(from.id, { from, x, n: Math.max(1, n || 0, o ? o.n + 1 : 1) });
    this.uid = from.id;
    this.render(!quiet);
    if (!quiet) Sound.play('dm');
  },
  /** 읽었어요 (답장 칸을 열었거나 다른 기기에서) */
  read(uid) {
    if (!this.list.has(uid)) return;
    this.list.delete(uid);
    if (this.uid === uid) this.uid = [...this.list.keys()].pop() || null;
    this.render();
  },
  /** 게임이 끝났어요 → 위 막대는 접고 (안 읽은 건 알림 카드가 이어받아요) */
  clear() { this.list.clear(); this.uid = null; this.closeMini(); this.render(); },
  render(fresh) {
    const el = this.el(), it = this.uid && this.list.get(this.uid);
    if (!it) { el.classList.remove('show', 'pulse'); el.innerHTML = ''; document.body.classList.remove('wh-on'); return; }
    const more = this.list.size - 1;
    el.innerHTML = `<button class="whb-main" data-act="whOpen" data-uid="${esc(it.from.id)}" aria-label="${esc(it.from.name)}님의 귓속말 — 답장하기">
        ${avatarOf(it.from, 'sm')}<span class="whb-t"><b>${esc(it.from.name)}${it.n > 1 ? ` <i class="whb-n">${it.n}</i>` : ''}${more > 0 ? ` <small class="whb-more">외 ${more}명</small>` : ''}</b><span class="whb-x">${esc(it.x)}</span></span></button>
      <button class="btn sm good whb-re" data-act="whOpen" data-uid="${esc(it.from.id)}">${icon('message-circle')}답장</button>
      <button class="whb-close" data-act="whClose" aria-label="닫기" title="닫기 (게임이 끝나면 다시 알려 줘요)">${icon('x')}</button>`;
    el.classList.add('show');
    document.body.classList.add('wh-on');
    if (fresh) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    el.classList.remove('fold');                                       // 가로 휴대폰 알약: 새로 오면 펼쳤다가 5초 뒤 접기
    clearTimeout(this.foldT); this.foldT = setTimeout(() => { if (el.classList.contains('pill')) el.classList.add('fold'); }, 5000);
    this.place();
  },
  /** 자리: 위쪽 막대가 보이면 로고 옆 빈자리(게임 밖) · 숨었으면(가로 휴대폰) 맨 위 가운데 알약 */
  place() {
    const el = document.getElementById('wh-bar');
    if (!el || !el.classList.contains('show')) return;
    const tb = document.querySelector('.topbar'), r = tb && tb.getBoundingClientRect();
    const on = r && r.height > 0 && getComputedStyle(tb).display !== 'none' && r.bottom > 0;
    if (on) {
      const ic = tb.querySelector('.brand-ic'), tr = tb.querySelector('.top-right');
      const left = (ic ? ic.getBoundingClientRect().right : r.left + 10) + 8, right = tr ? innerWidth - tr.getBoundingClientRect().left + 8 : 10;
      el.classList.remove('pill');
      el.style.top = `${Math.max(2, r.top + r.height / 2)}px`; el.style.left = `${left}px`; el.style.right = `${right}px`;
    } else {
      el.classList.add('pill');
      el.style.top = '6px'; el.style.left = ''; el.style.right = '';
    }
    this.placeMini();
  },
  /* ── 답장 칸 ── */
  async openMini(uid) {
    const it = this.list.get(uid);
    const friend = it ? it.from : (this.mini && this.mini.uid === uid ? this.mini.friend : null);
    if (!friend) return;
    const m = this.mini = { uid, friend, log: it ? [{ id: 0, f: uid, x: it.x, t: Date.now() }] : [], sending: false };
    let el = document.getElementById('wh-mini');
    if (!el) { el = document.createElement('div'); el.id = 'wh-mini'; el.className = 'wh-mini'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '귓속말 답장'); document.body.append(el); }
    el.innerHTML = `<div class="whm-head">${avatarOf(friend, 'sm')}<b>${esc(friend.name)}</b><small>귓속말</small>
        <button class="whm-full" data-act="whFull" title="큰 창으로 (게임 화면을 가려요)">${icon('arrows-maximize')}</button><button class="whm-x" data-act="whMiniClose" aria-label="닫기">${icon('x')}</button></div>
      <div class="whm-log" id="whm-log"></div>
      <div class="whm-send"><input type="text" id="whm-in" maxlength="200" autocomplete="off" enterkeyhint="send" placeholder="답장 쓰기 · Enter 로 보내기" aria-label="답장 내용">
        <button class="btn good" data-act="whSend" aria-label="보내기">${icon('send')}</button></div>`;
    el.classList.add('show');
    this.drawLog();
    this.placeMini();
    const inp = $('#whm-in');
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.send(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.closeMini(); }
    });
    setTimeout(() => { if (this.mini === m) inp.focus(); }, 30);
    this.read(uid);
    const r = await ask('dm:history', { uid });
    if (this.mini !== m) return;
    if (r.ok) {
      const have = new Set(r.list.map(x => x.id));
      m.log = [...r.list, ...m.log.filter(x => x.id && !have.has(x.id))].sort((a, b) => a.id - b.id).slice(-6);
      if (r.friend) m.friend = { ...m.friend, ...r.friend };
      this.drawLog();
    } else if (r.why === 'notfriend') { toast(DM_WHY.notfriend, 'error'); this.closeMini(); return; }
    ask('dm:read', { uid });
  },
  miniAdd(msg) {
    const m = this.mini; if (!m) return;
    m.log.push(msg); m.log = m.log.slice(-6);
    this.drawLog();
  },
  drawLog() {
    const m = this.mini, box = document.getElementById('whm-log');
    if (!m || !box) return;
    const me = Acct.me && Acct.me.id;
    box.innerHTML = m.log.length ? m.log.map(x => `<div class="whm-msg ${x.f === me ? 'me' : ''}"><span>${esc(x.x)}</span></div>`).join('')
      : '<p class="whm-empty">아직 나눈 귓속말이 없어요.</p>';
    box.scrollTop = box.scrollHeight;
  },
  placeMini() {
    const el = document.getElementById('wh-mini');
    if (!el || !el.classList.contains('show')) return;
    const bar = document.getElementById('wh-bar'), tb = document.querySelector('.topbar');
    let top = 8;
    const br = bar && bar.classList.contains('show') ? bar.getBoundingClientRect() : null;
    if (br) top = br.bottom + 6;
    else if (tb && getComputedStyle(tb).display !== 'none') top = tb.getBoundingClientRect().bottom + 6;
    el.style.top = `${Math.max(6, top)}px`;
    // 넓은 화면: 귓속말 줄 바로 아래(왼쪽 맞춤) · 휴대폰은 CSS 대로 양옆 꽉
    if (innerWidth > 560 && br && !bar.classList.contains('pill')) { el.style.left = `${Math.round(br.left)}px`; el.style.right = 'auto'; }
    else if (innerWidth > 560 && br) { el.style.left = `${Math.round(Math.max(12, Math.min(innerWidth - 392, br.left + br.width / 2 - 190)))}px`; el.style.right = 'auto'; }
    else { el.style.left = ''; el.style.right = ''; }
  },
  closeMini() {
    this.mini = null;
    const el = document.getElementById('wh-mini');
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    if (document.activeElement && document.activeElement.id === 'whm-in') document.activeElement.blur();
  },
  async send() {
    const m = this.mini, inp = $('#whm-in');
    if (!m || !inp || m.sending) return;
    const text = inp.value.replace(/\s+/g, ' ').trim();
    if (!text) { inp.focus(); return; }
    m.sending = true;
    const r = await ask('dm:send', { uid: m.uid, text });
    m.sending = false;
    if (this.mini !== m) return;
    if (!r.ok) { toast(DM_WHY[r.why] || whyText(r), 'error'); return; }
    inp.value = '';
    this.miniAdd(r.msg);
  },
};
/* 바깥(게임 화면)을 누르면 답장 칸은 닫혀요 — 누른 것은 게임에도 그대로 전해져요 */
document.addEventListener('pointerdown', e => {
  if (!WhBar.mini || !e.target.closest) return;
  if (e.target.closest('#wh-mini, #wh-bar')) return;
  WhBar.closeMini();
}, true);
addEventListener('resize', () => WhBar.place());
setInterval(() => { if (document.body.classList.contains('wh-on') || WhBar.mini) WhBar.place(); }, 1000);   // 화면이 바뀌면(게임 시작 · 끝) 자리 다시

Object.assign(ACT, {
  whOpen: el => WhBar.openMini(el.dataset.uid),
  whClose: () => { if (WhBar.uid) { WhBar.list.delete(WhBar.uid); WhBar.uid = [...WhBar.list.keys()].pop() || null; WhBar.render(); } },
  whMiniClose: () => WhBar.closeMini(),
  whSend: () => WhBar.send(),
  whFull: () => { const uid = WhBar.mini && WhBar.mini.uid; WhBar.closeMini(); if (uid) Acct.openDM(uid); },
});
