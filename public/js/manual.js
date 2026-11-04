/* =====================================================================
 *  📖 게임 설명서 — 모든 게임: 핵심만 짧게 → 「자세한 설명」을 누르면 긴 설명(진행 · 표 · 머리 쓰는 법 · 자주 하는 실수)
 *   - 내용은 게임마다 public/js/manual/<키>.js 에 있어요 (처음 열 때 불러와요): Manual.add('키', { level, time, goal, core, controls, detail, tips, mistakes })
 *   - 여는 곳: 메뉴 게임 카드의 ? · 게임 화면 위쪽 「설명서」 · 대기실 · 처음 화면 「게임 설명서」 · 처음 하는 게임 안내
 *   - 어려운 게임은 「따라 하기」(tutorial.js)로 실제 판에서 한 단계씩 연습해요
 * ===================================================================== */
const Manual = {
  data: {}, loading: {}, cur: null, from: null,
  LEVEL: { 1: ['쉬움', 'lv1'], 2: ['보통', 'lv2'], 3: ['어려움', 'lv3'] },
  add(key, d) { this.data[key] = d; },
  /** 게임 설명서 파일 불러오기 */
  load(key) {
    if (this.data[key]) return Promise.resolve(this.data[key]);
    if (!this.loading[key]) {
      this.loading[key] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = `/js/manual/${key}.js`; s.async = true;
        s.onload = () => (this.data[key] ? res(this.data[key]) : rej(new Error('empty')));
        s.onerror = () => { delete this.loading[key]; rej(new Error('load')); };
        document.head.append(s);
      });
    }
    return this.loading[key];
  },
  /** 모든 게임 (싱글 · 멀티 합쳐서) */
  games() {
    const out = new Map();
    for (const [k, i, n, d, isNew, cat] of SOLO_GAMES) out.set(k, { k, solo: n, cat, isNew, icon: i });
    for (const [k, g] of Object.entries(GAME_INFO)) { const o = out.get(k) || { k, cat: g.cat, isNew: g.isNew, icon: g.icon }; o.multi = g.name; o.players = g.players; o.isNew = o.isNew || g.isNew; out.set(k, o); }
    for (const o of out.values()) o.name = this.title(o);
    return [...out.values()];
  },
  /** 설명서 제목: 「체스 vs AI」 → 체스, 「지뢰찾기 대결」 → 지뢰찾기 */
  title(o) {
    const clean = n => String(n || '').replace(/\s*(vs AI|vs 봇|기록 도전)$/, '').replace(/\s*대결$/, '').trim();
    const a = clean(o.solo), b = clean(o.multi);
    return a && b && a !== b ? (b.length <= a.length ? b : a) : a || b || o.k;
  },
  info(key) { return this.games().find(g => g.k === key) || { k: key, name: key, cat: '' }; },
  hasTut: key => typeof Tutorial !== 'undefined' && Tutorial.has(key),
  canSolo: key => SOLO_GAMES.some(g => g[0] === key),

  /* ─────────────── 설명서 창 ─────────────── */
  ensure() {
    if ($('#man-ov')) return;
    document.body.insertAdjacentHTML('beforeend', '<div class="overlay" id="man-ov"><div class="modal man-modal" id="man-modal" role="dialog" aria-modal="true" aria-label="게임 설명서"></div></div>');
    $('#man-ov').addEventListener('click', e => { if (e.target.id === 'man-ov') this.close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#man-ov').classList.contains('show')) this.close(); });
  },
  async open(key, from) {
    this.ensure();
    key = this.keyOf(key);
    this.cur = key; this.from = from || null;
    const m = $('#man-modal'), info = this.info(key);
    $('#man-ov').classList.add('show');
    m.scrollTop = 0;
    m.innerHTML = `${this.headHtml(info, null)}<p class="muted center man-wait">설명서를 불러오는 중…</p>`;
    try { const d = await this.load(key); if (this.cur === key) m.innerHTML = this.html(info, d); }
    catch { if (this.cur === key) m.innerHTML = `${this.headHtml(info, null)}<p class="muted center">설명서를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.</p><div class="man-acts"><button class="btn" data-act="manClose">닫기</button></div>`; }
    this.mark(key);
  },
  keyOf(key) { return key === 'card' ? ((S.room && S.room.gameType) || 'seotda') : key; },
  close() { const o = $('#man-ov'); if (o) o.classList.remove('show'); this.cur = null; },
  headHtml(info, d) {
    const lv = d && this.LEVEL[d.level];
    const modes = [info.solo ? `싱글 <b>${esc(info.solo)}</b>` : '', info.multi ? `멀티 <b>${esc(info.multi)}</b>${info.players ? ` (${esc(info.players)})` : ''}` : ''].filter(Boolean).join(' · ');
    return `<button class="man-x" data-act="manClose" aria-label="닫기">${icon('x')}</button>
      <div class="man-head">${gameIcon(info.k, info.cat)}<div><h2>${esc(info.name)}</h2>
        <div class="man-sub">${lv ? `<span class="man-lv ${lv[1]}">${lv[0]}</span>` : ''}${d && d.time ? `<span>${esc(d.time)}</span>` : ''}</div></div></div>
      ${modes ? `<p class="man-modes">${modes}</p>` : ''}`;
  },
  list: (a, cls = '') => `<ul class="${cls}">${(a || []).map(x => `<li>${x}</li>`).join('')}</ul>`,
  html(info, d) {
    const inRoom = !!S.code;
    const acts = [
      this.hasTut(info.k) && !inRoom ? `<button class="btn good" data-act="tutStart" data-game="${info.k}">${icon('school')}따라 하기 (튜토리얼)${this.done('tut', info.k) ? ' ✓' : ''}</button>` : '',
      this.canSolo(info.k) && !inRoom && S.screen !== info.k ? `<button class="btn" data-act="manPlay" data-game="${info.k}">${icon('player-play')}${/vs/.test(info.solo || '') ? 'AI와 연습하기' : '혼자 해 보기'}</button>` : '',
      this.hasTut(info.k) && inRoom ? `<p class="man-room-tut">${icon('school')}방에서 나가면 싱글 플레이에서 <b>따라 하기</b>로 실제 판을 연습할 수 있어요.</p>` : '',
    ].join('');
    const detail = d.detail.map(sec => `<section><h3>${sec.h}</h3>${(sec.p || []).map(p => `<p>${p}</p>`).join('')}${sec.ul ? this.list(sec.ul) : ''}${sec.table ? this.table(sec.table) : ''}</section>`).join('');
    return `${this.headHtml(info, d)}
      <p class="man-goal">${icon('target')}<span>${d.goal}</span></p>
      <h4>핵심만 쏙</h4>${this.list(d.core, 'man-core')}
      <h4>조작</h4>${this.list(d.controls, 'man-ctl')}
      ${acts ? `<div class="man-acts">${acts}</div>` : ''}
      <button class="man-more" data-act="manMore" aria-expanded="false">${icon('book')}<span>자세한 설명 보기</span>${icon('chevron-down', 'man-chev')}</button>
      <div class="man-detail hidden" id="man-detail">${detail}
        <section class="man-tips"><h3>${icon('bulb')}머리 쓰는 법</h3>${this.list(d.tips)}</section>
        <section class="man-miss"><h3>${icon('alert-triangle')}자주 하는 실수</h3>${this.list(d.mistakes)}</section>
        <button class="man-more up" data-act="manMore" aria-expanded="true">${icon('chevron-up')}<span>접기</span></button>
      </div>`;
  },
  table(t) {
    return `<div class="man-tbl"><table><thead><tr>${t[0].map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${t.slice(1).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },
  toggleMore() {
    const d = $('#man-detail'); if (!d) return;
    const open = d.classList.toggle('hidden') === false;
    $$('#man-modal .man-more:not(.up)').forEach(b => { b.setAttribute('aria-expanded', open); b.querySelector('span').textContent = open ? '자세한 설명 접기' : '자세한 설명 보기'; b.classList.toggle('open', open); });
    if (open) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else $('#man-modal').scrollTo({ top: 0, behavior: 'smooth' });
  },

  /* ─────────────── 설명서 모음 (처음 화면) ─────────────── */
  async hub(cat = '전체') {
    this.ensure();
    const m = $('#man-modal');
    $('#man-ov').classList.add('show');
    this.cur = '__hub';
    const list = this.games();
    m.innerHTML = `<button class="man-x" data-act="manClose" aria-label="닫기">${icon('x')}</button>
      <div class="man-head"><span class="gi" style="--g1:#f6a623;--g2:#e8590c">${icon('book-2')}</span><div><h2>게임 설명서</h2><div class="man-sub"><span>규칙 · 조작 · 머리 쓰는 법</span></div></div></div>
      <p class="man-modes">처음 하는 게임은 <b>핵심만 쏙</b>부터 보세요. ${icon('school')}표시가 있는 게임은 실제 판에서 <b>따라 하기</b>로 연습할 수 있어요.</p>
      <div class="cat-row man-cats">${CATS.map(c => `<button class="cat-chip ${c === cat ? 'on' : ''}" data-act="manHub" data-cat="${c}">${c}</button>`).join('')}</div>
      <div class="man-grid" id="man-grid">${list.filter(g => cat === '전체' || g.cat === cat).sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(g => `
        <button class="man-item" data-act="manual" data-game="${g.k}">${gameIcon(g.k, g.cat, 'sm')}<span><b>${esc(g.name)}</b><small data-lv="${g.k}"></small></span>
          ${this.hasTut(g.k) ? `<i class="man-tut" title="따라 하기 있음">${icon('school')}</i>` : ''}${this.done('read', g.k) ? '<i class="man-read" title="읽음">✓</i>' : ''}</button>`).join('')}</div>`;
    // 난이도 표시 (설명서 파일을 불러오면서 채워요)
    for (const g of list) this.load(g.k).then(d => { const el = $(`#man-grid [data-lv="${g.k}"]`); if (el && d) { const lv = this.LEVEL[d.level]; el.innerHTML = `<span class="man-lv ${lv[1]}">${lv[0]}</span>${esc(d.time || '')}`; } }).catch(() => {});
  },

  /* ─────────────── 읽음 · 처음 하는 게임 안내 ─────────────── */
  store() { try { const o = JSON.parse(localStorage.getItem('mgManual') || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } },
  save(o) { try { localStorage.setItem('mgManual', JSON.stringify(o)); } catch { /* 무시 */ } },
  done(kind, key) { const o = this.store(); return !!(o[kind] && o[kind].includes(key)); },
  mark(key, kind = 'read') { const o = this.store(); o[kind] = Array.isArray(o[kind]) ? o[kind] : []; if (!o[kind].includes(key)) { o[kind].push(key); this.save(o); } },
  /** 게임 화면이 처음 열리면 (이 기기에서) 작은 안내를 띄워요 */
  seen(screen) {
    if (MENU_IDS.has(screen) || (typeof Tutorial !== 'undefined' && Tutorial.on)) return;
    const key = this.keyOf(screen);
    if (!this.info(key).name) return;
    if (this.done('read', key) || this.done('hint', key)) return;
    this.mark(key, 'hint');
    const tut = this.hasTut(key) && !S.code;
    const el = document.createElement('div');
    el.className = 'man-hint';
    el.innerHTML = `${icon('book')}<span>처음 하는 게임이에요. ${tut ? '<b>따라 하기</b>로 연습하거나 ' : ''}<b>설명서</b>로 핵심만 보고 시작해 보세요.</span>
      <button class="btn sm good" data-act="manual" data-game="${key}">설명서</button>${tut ? `<button class="btn sm" data-act="tutStart" data-game="${key}">따라 하기</button>` : ''}<button class="man-hx" data-act="manHintX" aria-label="닫기">${icon('x')}</button>`;
    $$('.man-hint').forEach(x => x.remove());
    document.body.append(el);
    setTimeout(() => el.classList.add('out'), 9000);
    setTimeout(() => el.remove(), 9600);
  },
};
Object.assign(ACT, {
  manual: el => { $$('.man-hint').forEach(x => x.remove()); Manual.open(el.dataset.game || S.screen); },
  manClose: () => Manual.close(),
  manMore: () => Manual.toggleMore(),
  manHub: el => Manual.hub(el.dataset.cat || '전체'),
  manPlay: el => { Manual.close(); startSolo(el.dataset.game); },
  manHintX: el => { const h = el.closest('.man-hint'); if (h) h.remove(); },
});
/* 게임 화면 위쪽 막대에 「설명서」 버튼 (index.html 에 있는 화면 · makeScreen 으로 만든 화면 모두) */
(function addManualButtons() {
  for (const sec of $$('#main > .screen')) {
    const id = sec.id.replace(/^scr-/, '');
    if (MENU_IDS.has(id)) continue;
    const head = $('.game-head', sec), leave = head && $('[data-act=leaveGame]', head);
    if (!leave || $('.gh-man', head)) continue;
    leave.insertAdjacentHTML('beforebegin', `<button class="btn ghost gh-man" data-act="manual" data-game="${id}" title="게임 설명서">${icon('book')}<span class="gh-mt">설명서</span></button>`);
  }
})();
