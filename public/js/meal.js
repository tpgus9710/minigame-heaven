/* =====================================================================
 *  🍱 학식 메뉴 (폴리텍 로봇캠퍼스) — 서버: lib/meal.js (/api/meal)
 *   - 들어올 때 끼니마다 한 번 공지처럼 보여 줘요 (평일 13시 전 오늘 중식 · 18시 전 오늘 석식 · 그 뒤 다음 날 중식)
 *     처음 화면에서만 · 다른 창이 떠 있으면 닫힌 뒤에 · 「들어올 때 보기」를 끄면 안 떠요
 *   - ☰ 메뉴 → 학식 메뉴: 지금 끼니 + 이번 주 식단표 (오늘 줄 강조) · 학교 홈페이지 링크
 * ===================================================================== */
const Meal = {
  j: null, at: 0, busy: null,
  off: () => store.get('mgMealOff', '') === '1',
  load(force) {
    if (!force && this.j && Date.now() - this.at < 60000) return Promise.resolve(this.j);
    if (this.busy) return this.busy;
    this.busy = fetch('/api/meal', { cache: 'no-store' }).then(r => r.json())
      .then(j => { this.j = j; this.at = Date.now(); return j; })
      .catch(() => this.j).finally(() => { this.busy = null; });
    return this.busy;
  },
  md(date) { if (!date) return ''; const [, m, d] = date.split('-'); return `${+m}월 ${+d}일`; },
  time(p) { return p && p.time ? p.time.replace(/^\(평일\)\s*/, '') : ''; },
  /** 메뉴 줄 아래 작은 글씨: 지금 끼니 */
  sub() {
    const j = this.j, p = j && j.pick;
    if (!j) return '오늘 학식 보기';
    if (!p || !p.items.length) return p ? `${p.label} · ${p.why || '식단 없음'}` : '식단 보기';
    const main = p.items.find((x, i) => i >= 2) || p.items[0];      // 보통 밥 · 국 다음이 주메뉴
    return `${p.label} · ${main}${p.items.length > 1 ? ` 외 ${p.items.length - 1}가지` : ''}`;
  },
  chips(items) { return `<div class="ml-chips">${items.map((x, i) => `<span class="ml-chip${i === 2 ? ' main' : ''}">${esc(x)}</span>`).join('')}</div>`; },
  /** 지금 끼니 카드 */
  card(j) {
    const p = j && j.pick;
    if (!j || !p) return `<div class="ml-card empty">${icon('tools-kitchen-2')}<b>식단을 불러오는 중…</b></div>`;
    const tag = `<span class="ml-kind ${p.kind}">${icon(p.kind === 'lunch' ? 'sun' : 'moon-stars')}${esc(p.label)}</span>`;
    const head = `<div class="ml-top">${tag}${this.time(p) ? `<span class="ml-time">${icon('clock')}${esc(this.time(p))}</span>` : ''}</div>
      <div class="ml-date">${this.md(p.date)} ${esc(p.dow)}요일</div>`;
    if (!p.items.length) return `<div class="ml-card none">${head}<p class="ml-why">${esc(p.why || '식단이 없어요')}</p></div>`;
    return `<div class="ml-card">${head}${this.chips(p.items)}</div>`;
  },
  /** 이번 주 식단표 (월~금) */
  week(j) {
    if (!j || !j.week || !j.week.length) return '';
    const today = j.today;
    const line = (k, items) => `<div class="ml-l"><em class="${k}">${k === 'lunch' ? '중식' : '석식'}</em><span>${items.length ? items.map(esc).join(' · ') : '<i>없음</i>'}</span></div>`;
    return `<div class="ml-week">${j.week.map(d => {
      const now = d.date === today, past = d.date && d.date < today;
      return `<div class="ml-day${now ? ' now' : ''}${past ? ' past' : ''}"><div class="ml-dl"><b>${esc(d.dow)}</b>${d.date ? `<small>${+d.date.split('-')[1]}/${+d.date.split('-')[2]}</small>` : ''}${now ? '<small class="ml-today">오늘</small>' : ''}</div>
        <div class="ml-dr">${line('lunch', d.lunch)}${line('dinner', d.dinner)}</div></div>`;
    }).join('')}</div>`;
  },
  foot(j) {
    const at = j && j.at ? new Date(j.at) : null;
    const when = at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}에 불러옴` : '';
    return `<p class="ml-foot">폴리텍 로봇캠퍼스 홈페이지 식단${when ? ` · ${when}` : ''} · 메뉴는 바뀔 수 있어요<br>
      <a href="${esc((j && j.url) || 'https://www.kopo.ac.kr/robot/content.do?menu=9104')}" target="_blank" rel="noopener">${icon('external-link')}학교 홈페이지에서 보기</a></p>`;
  },
  /** ☰ 메뉴 안 페이지 */
  pageHTML() {
    const j = this.j;
    const weekTitle = j && j.weekOf ? `이번 주 식단${j.week[0] && j.week[0].date ? ` <small>${+j.week[0].date.split('-')[1]}/${+j.week[0].date.split('-')[2]} ~ ${+j.week[4].date.split('-')[1]}/${+j.week[4].date.split('-')[2]}</small>` : ''}` : '학교 홈페이지 식단';
    return `<div class="ms-grab"></div>
      <div class="ms-head nav"><button class="ms-back" data-act="msBack">${icon('chevron-left')}메뉴</button><b>학식 메뉴</b><button class="ms-x" data-act="msClose" aria-label="닫기">${icon('x')}</button></div>
      <div class="ml-page">
        ${this.card(j)}
        ${j && !j.ok ? `<p class="ml-why">${esc(j.err || '식단을 못 불러왔어요')} — 아래 학교 홈페이지에서 볼 수 있어요.</p>` : ''}
        ${j && j.week && j.week.length ? `<h4 class="ml-h">${weekTitle}</h4>${this.week(j)}` : ''}
        <div class="ms-group"><label class="ms-row"><i class="ms-ic" style="--c:#ff9f0a">${icon('bell')}</i><span class="ms-t">들어올 때 식단 알려 주기<small>끼니마다 한 번 (13시 · 18시에 바뀌어요)</small></span><input type="checkbox" class="ms-sw" data-act="mlNotify" ${this.off() ? '' : 'checked'} aria-label="들어올 때 식단 알려 주기"></label></div>
        ${this.foot(j)}
      </div>`;
  },
  /** 들어올 때 한 번: 공지 창처럼 */
  popHTML(j) {
    return `<div class="ml-pop">${this.card(j)}
      <div class="ov-actions"><button class="btn ghost" data-act="mlWeek">${icon('calendar-check')}이번 주 식단</button><button class="btn good" data-act="mlClose">확인</button></div>
      <label class="ml-mute"><input type="checkbox" data-act="mlMute"> 들어올 때 그만 보기 <small>(☰ 메뉴 → 학식 메뉴에서 볼 수 있어요)</small></label></div>`;
  },
  busyNow() {
    const home = document.getElementById('scr-home');                   // 처음엔 S.screen 이 비어 있어요 → 화면 표시로 봐요
    return !(home && home.classList.contains('active')) || document.body.classList.contains('gaming') || Menu.isOpen()
      || ['overlay', 'acct-ov', 'notice-ov', 'man-ov', 'rp-ov', 'meal-ov', 'game-picker', 'dg-ov'].some(id => { const el = document.getElementById(id); return el && el.classList.contains('show'); });
  },
  async auto() {
    if (this.off()) return;
    const j = await this.load(true);
    if (!j || !j.ok || !j.pick || !j.pick.items.length || store.get('mgMealSeen', '') === j.slot) return;
    let tries = 0;
    const go = () => {
      if (this.off() || store.get('mgMealSeen', '') === j.slot) return;
      if (this.busyNow()) { if (++tries < 40) setTimeout(go, 1500); return; }   // 처음 화면이 한가해질 때 (최대 1분)
      $('#meal-modal').innerHTML = this.popHTML(j);
      $('#meal-ov').classList.add('show');
      store.set('mgMealSeen', j.slot);
    };
    setTimeout(go, 900);
  },
  close() { $('#meal-ov').classList.remove('show'); },
};
document.body.insertAdjacentHTML('beforeend', '<div class="overlay" id="meal-ov"><div class="modal notice-modal meal-modal" id="meal-modal" role="dialog" aria-modal="true" aria-label="학식 메뉴"></div></div>');
$('#meal-ov').addEventListener('mousedown', e => { if (e.target.id === 'meal-ov') Meal.close(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#meal-ov').classList.contains('show')) Meal.close(); });
Object.assign(ACT, {
  msMeal: () => { Menu.page = 'meal'; Menu.render(); Meal.load(true).then(() => { if (Menu.isOpen() && Menu.page === 'meal') Menu.render(); }); },
  mlClose: () => Meal.close(),
  mlWeek: () => { Meal.close(); Menu.open('meal'); },
  mlMute: el => { store.set('mgMealOff', el.checked ? '1' : ''); },
  mlNotify: el => { store.set('mgMealOff', el.checked ? '' : '1'); },
});
Meal.load().then(() => { if (Menu.isOpen() && Menu.page === 'main') Menu.render(); });
setTimeout(() => Meal.auto(), 700);                                   // 글꼴 · 그림을 다 받을 때(load)까지 기다리지 않아요
