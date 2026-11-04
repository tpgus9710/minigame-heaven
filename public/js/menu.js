/* =====================================================================
 *  ☰ 메뉴 — 위쪽 오른쪽 버튼 하나에 iOS 설정처럼 모았어요
 *    소리 · 다크 모드 (스위치) / 신고 · 요청 · 패치 노트 · 게임 설명서 / 버전
 *  - 컴퓨터: 버튼 아래 작은 창 · 휴대폰: 아래에서 올라오는 시트
 *  - 패치 노트는 메뉴 안에서 넘어가요(‹ 메뉴). 새 버전을 아직 안 봤거나 신고 답장이 오면 메뉴 버튼에 빨간 점
 *  - 처음 화면 왼쪽 아래 버전 표시(v12.0)를 누르면 바로 패치 노트
 *  예전 위쪽 버튼(🔊 · 신고 · 라이트 모드)은 숨기기만 했어요 (다른 코드가 그대로 써요)
 * ===================================================================== */
const APP_VER = (typeof PATCH_NOTES !== 'undefined' && PATCH_NOTES[0] && PATCH_NOTES[0].v) || '';
const Menu = {
  page: 'main', open1: 0,
  isOpen: () => $('#ms-ov').classList.contains('show'),
  open(page = 'main') {
    this.page = page; this.open1 = 0;
    this.render();
    $('#ms-ov').classList.add('show');
    $('#menu-btn').setAttribute('aria-expanded', 'true');
    if (page === 'notes') this.seen();
  },
  close() {
    $('#ms-ov').classList.remove('show');
    $('#menu-btn').setAttribute('aria-expanded', 'false');
  },
  /** 아직 안 본 새 버전 */
  fresh() { return !!APP_VER && store.get('mgNotesSeen', '') !== APP_VER; },
  seen() { if (this.fresh()) { store.set('mgNotesSeen', APP_VER); this.badge(); } },
  /** 빨간 점: 신고 답장 · (운영자) 새 신고 · 새 버전 */
  badge() {
    const rp = typeof Report !== 'undefined' ? (Report.unread || 0) + (Report.opNew || 0) : 0, b = $('#menu-btn');
    if (b) { b.classList.toggle('has', !!rp || this.fresh()); b.querySelector('.mb-dot').textContent = rp > 99 ? '99+' : rp || ''; }
    const t = $('#ver-tag'); if (t) t.classList.toggle('new', this.fresh());
    if (this.isOpen()) this.render();
  },
  render() {
    const s = $('#ms-sheet');
    s.innerHTML = this.page === 'notes' ? this.notesHTML() : this.mainHTML();
    s.dataset.page = this.page;
  },
  mainHTML() {
    const dark = document.documentElement.dataset.theme !== 'light', snd = typeof Sound !== 'undefined' && Sound.on;
    const rp = typeof Report !== 'undefined' ? (Report.unread || 0) + (Report.opNew || 0) : 0;
    const tile = (ic, c) => `<i class="ms-ic" style="--c:${c}">${icon(ic)}</i>`;
    const sw = (act, on, ic, c, t) => `<label class="ms-row">${tile(ic, c)}<span class="ms-t">${t}</span><input type="checkbox" class="ms-sw" data-act="${act}" ${on ? 'checked' : ''} aria-label="${t}"></label>`;
    const go = (act, ic, c, t, sub, right = '') => `<button class="ms-row" data-act="${act}">${tile(ic, c)}<span class="ms-t">${t}${sub ? `<small>${sub}</small>` : ''}</span>${right}<i class="ms-chev">${icon('chevron-right')}</i></button>`;
    const n = PATCH_NOTES[0] || {};
    return `<div class="ms-grab"></div>
      <div class="ms-head"><b>메뉴</b><button class="ms-x" data-act="msClose" aria-label="닫기">${icon('x')}</button></div>
      <div class="ms-group">
        ${sw('msSound', snd, 'volume', '#ff9f0a', '소리')}
        ${sw('msDark', dark, 'moon-stars', '#5e5ce6', '다크 모드')}
      </div>
      <div class="ms-group">
        ${go('msReport', 'message-report', '#ff453a', '신고 · 요청', '버그 · 불편한 점 · 희망 게임 · 요청 사항', rp ? `<b class="ms-badge">${rp > 99 ? '99+' : rp}</b>` : '')}
        ${go('msNotes', 'notes', '#30b158', '패치 노트', `v${esc(n.v || '')} · ${esc(n.title || '')}`, this.fresh() ? '<em class="ms-new">NEW</em>' : '')}
        ${go('msManual', 'book-2', '#0a84ff', '게임 설명서', '규칙 · 조작 · 따라 하기')}
      </div>
      <p class="ms-foot">미니게임 천국 v${esc(APP_VER)}</p>`;
  },
  notesHTML() {
    const day = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${y}년 ${+m}월 ${+dd}일`; };
    return `<div class="ms-grab"></div>
      <div class="ms-head nav"><button class="ms-back" data-act="msBack">${icon('chevron-left')}메뉴</button><b>패치 노트</b><button class="ms-x" data-act="msClose" aria-label="닫기">${icon('x')}</button></div>
      <div class="pn-list">${PATCH_NOTES.map((p, i) => `<div class="ms-group pn ${i === this.open1 ? 'open' : ''}">
        <button class="ms-row pn-h" data-act="pnToggle" data-i="${i}"><span class="pn-v${i ? '' : ' now'}">v${esc(p.v)}</span><span class="ms-t">${esc(p.title)}${p.date || !i ? `<small>${i ? '' : '지금 버전 · '}${day(p.date)}</small>` : ''}</span><i class="ms-chev">${icon('chevron-down')}</i></button>
        <ul class="pn-b">${p.items.map(([e, t]) => `<li><i>${e}</i><span>${t}</span></li>`).join('')}</ul></div>`).join('')}</div>`;
  },
};
/* ─── 화면에 붙이기: 위쪽 메뉴 버튼 · 시트 · 처음 화면 버전 표시 ─── */
(() => {
  const b = document.createElement('button');
  b.id = 'menu-btn'; b.className = 'btn ghost sm icon-only menu-btn'; b.dataset.act = 'msOpen';
  b.setAttribute('aria-label', '메뉴'); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false'); b.title = '메뉴';
  b.innerHTML = `${icon('menu-2')}<b class="mb-dot"></b>`;
  $('.top-right').append(b);
  document.body.insertAdjacentHTML('beforeend', '<div class="ms-ov" id="ms-ov"><div class="ms-sheet" id="ms-sheet" role="dialog" aria-modal="true" aria-label="메뉴"></div></div>');
  $('#ms-ov').addEventListener('mousedown', e => { if (e.target.id === 'ms-ov') Menu.close(); });
  $('#ms-ov').addEventListener('touchstart', e => { if (e.target.id === 'ms-ov') { e.preventDefault(); Menu.close(); } }, { passive: false });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Menu.isOpen()) Menu.close(); });
  if (APP_VER) document.body.insertAdjacentHTML('beforeend', `<button class="ver-tag" id="ver-tag" data-act="notesOpen" title="패치 노트">v${esc(APP_VER)}<i></i></button>`);
  Menu.badge();
})();
Object.assign(ACT, {
  msOpen: () => (Menu.isOpen() ? Menu.close() : Menu.open()),
  msClose: () => Menu.close(),
  msBack: () => { Menu.page = 'main'; Menu.render(); },
  msNotes: () => { Menu.page = 'notes'; Menu.open1 = 0; Menu.render(); Menu.seen(); },
  notesOpen: () => Menu.open('notes'),
  pnToggle: el => { const i = +el.dataset.i; Menu.open1 = Menu.open1 === i ? -1 : i; for (const g of document.querySelectorAll('.pn')) g.classList.toggle('open', g.querySelector('.pn-h').dataset.i == Menu.open1); },
  msSound: el => { if (typeof Sound === 'undefined') return; Sound.on = el.checked; if (el.checked) Sound.play('dm'); },
  msDark: el => applyTheme(el.checked ? 'dark' : 'light'),
  msReport: () => { Menu.close(); if (typeof Report !== 'undefined') ACT.rpOpen(); },
  msManual: () => { Menu.close(); if (ACT.manHub) ACT.manHub(); },
});
