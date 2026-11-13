/* =====================================================================
 *  🏆 순위표 — 기록이 중요한 싱글 게임 (탑 쌓기 · 스네이크 · 2048 · 1 to 50 · 지뢰찾기 …)
 *  · 게임 화면 위쪽 막대의 「순위」 버튼 → 이 게임의 모두의 최고 기록 (TOP 50 · 내 순위)
 *  · 결과창: 판이 끝나면 TOP 5 와 내 순위를 바로 보여 줘요 (방금 세운 신기록도 바로 반영)
 *  기록은 로그인한 사람만 남아요 (서버: lib/accounts.js ranking('solo') · 기록 목록: account.js REC_GAMES)
 * ===================================================================== */
const Board = {
  cur: null,
  keys() { return REC_GAMES.map(([k]) => k); },
  subs(base) { return this.keys().filter(k => k.split(':')[0] === base); },
  has(base) { return this.subs(base).length > 0; },
  /** 결과의 기록 키 (지뢰찾기 난이도 · 총알피하기 모드처럼 나뉜 게임은 '게임:종류') */
  keyOf(d) { return d && d.solo ? d.solo + (d.rec && d.rec.k ? ':' + d.rec.k : '') : ''; },
  /** 지금 하고 있는 게임의 기록 키 (나뉜 게임은 지금 고른 난이도 · 모드) */
  curKey(base) {
    const subs = this.subs(base);
    if (subs.length <= 1) return subs[0] || base;
    const pick = base === 'mine' && typeof Mine !== 'undefined' ? Mine.level : base === 'dodge' && typeof Dodge !== 'undefined' ? Dodge.mode
      : base === 'rain' && typeof Rain !== 'undefined' ? Rain.lang : base === 'tetris' && typeof Tetris !== 'undefined' ? Tetris.mode : '';   // 산성비 한글 · 테트리스 보스전은 키 그대로 (subs[0])
    return subs.find(k => k === `${base}:${pick}`) || subs[0];
  },
  ensure() {
    if ($('#bd-ov')) return;
    document.body.insertAdjacentHTML('beforeend', '<div class="overlay" id="bd-ov"><div class="modal bd-modal" id="bd-modal" role="dialog" aria-modal="true" aria-label="순위표"></div></div>');
    $('#bd-ov').addEventListener('click', e => { if (e.target.id === 'bd-ov') this.close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#bd-ov').classList.contains('show')) this.close(); });
  },
  close() { const o = $('#bd-ov'); if (o) o.classList.remove('show'); this.cur = null; },
  row(x, i, mine) {
    return `<div class="ac-row ${mine ? 'mine' : ''}"><span class="rk">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
      <span class="ac-who" ${typeof Acct !== 'undefined' && Acct.me ? `data-act="bdCard" data-uid="${esc(x.id)}" role="button" tabindex="0"` : ''}>${avatarOf(x, 'sm')}<span class="grow"><b>${esc(x.name)}</b> ${lvTag(x.lv)} ${titleTag(x.tt, 'sm')}</span></span><b>${esc(recText(this.cur || '', x.v))}</b></div>`;
  },
  /** 순위표 창 (게임 화면의 「순위」 버튼) */
  async open(key) {
    this.ensure();
    this.cur = key;
    const base = key.split(':')[0], subs = this.subs(base), m = $('#bd-modal');
    $('#bd-ov').classList.add('show');
    const head = `<button class="man-x" data-act="bdClose" aria-label="닫기">${icon('x')}</button>
      <div class="bd-head">${gameIcon(base, catOf(base))}<div><h2>${esc(gameLabel(base, true))} 순위표</h2><p class="muted small">모두의 최고 기록 · 로그인한 사람만 올라가요</p></div></div>
      ${subs.length > 1 ? `<div class="bd-subs">${subs.map(k => `<button class="seg-btn ${k === key ? 'on' : ''}" data-act="bdOpen" data-key="${k}">${esc(SOLO_SUB[k] || k)}</button>`).join('')}</div>` : ''}`;
    m.innerHTML = head + '<p class="muted center">불러오는 중…</p>';
    const r = await ask('acct:rank', { k: 'solo', g: key });
    if (this.cur !== key) return;
    const meId = typeof Acct !== 'undefined' && Acct.me ? Acct.me.id : null, list = r.ok ? r.list : [];
    m.innerHTML = head + (list.length ? `<div class="ac-list bdr bd-list">${list.map((x, i) => this.row(x, i, x.id === meId)).join('')}</div>` : `<p class="muted center">${r.ok ? '아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!' : esc(whyText(r))}</p>`)
      + (r.me && r.me.rank > list.length ? `<p class="bd-me">내 순위 <b>${r.me.rank}등</b> · ${esc(recText(key, r.me.v))}</p>` : '')
      + (!meId ? `<p class="bd-me muted">${icon('face-id')}로그인하면 내 기록도 순위표에 올라가요</p>` : '');
  },
  /** 결과창: TOP 5 · 내 순위 (신기록이면 축하 한 줄) */
  async mini(key, best) {
    const box = $('#ov-board'); if (!box || !this.keys().includes(key)) return;
    const token = (this.tok = (this.tok || 0) + 1);
    box.className = 'ov-board'; box.innerHTML = '';
    const r = await ask('acct:rank', { k: 'solo', g: key });
    if (token !== this.tok || !r.ok || !r.list.length || !$('#overlay').classList.contains('show')) return;
    this.cur = key;
    const meId = typeof Acct !== 'undefined' && Acct.me ? Acct.me.id : null;
    const top = r.list.slice(0, 5);
    box.innerHTML = `<div class="ob-h">${icon('trophy')}<b>${esc(gameLabel(key))} 순위</b>${r.me ? `<span class="ob-me">${best ? '🎉 신기록! ' : ''}내 순위 <b>${r.me.rank}등</b></span>` : ''}</div>
      <div class="ac-list bdr">${top.map((x, i) => this.row(x, i, x.id === meId)).join('')}
      ${r.me && r.me.rank > 5 ? `<div class="ac-row mine ob-gap"><span class="rk">${r.me.rank}</span><span class="grow"><b>나</b></span><b>${esc(recText(key, r.me.v))}</b></div>` : ''}</div>
      <button class="btn sm ghost ob-all" data-act="bdOpen" data-key="${key}">${icon('list-details')}전체 순위</button>`;
    box.classList.add('show');
  },
  clearMini() { this.tok = (this.tok || 0) + 1; const box = $('#ov-board'); if (box) { box.innerHTML = ''; box.className = 'ov-board'; } },
};
Object.assign(ACT, {
  board: el => Board.open(Board.curKey(el.dataset.game)),
  bdOpen: el => Board.open(el.dataset.key),
  bdClose: () => Board.close(),
  bdCard: el => { Board.close(); Acct.card(el.dataset.uid); },           // 결과창은 그대로 두고 그 위에 프로필
});
/* 결과창에 순위 자리 · 기록 게임 화면 위쪽 막대에 「순위」 버튼 (싱글로 할 때만 보여요) */
(() => {
  const ob = document.createElement('div');
  ob.id = 'ov-board'; ob.className = 'ov-board';
  $('#ov-actions').before(ob);
  const bases = new Set(Board.keys().map(k => k.split(':')[0]));
  for (const base of bases) {
    const sec = $('#scr-' + base), head = sec && $('.game-head', sec), anchor = head && ($('.gh-man', head) || $('[data-act=leaveGame]', head));
    if (!anchor || $('.gh-rank', head)) continue;
    anchor.insertAdjacentHTML('beforebegin', `<button class="btn ghost gh-rank" data-act="board" data-game="${base}" title="순위표">${icon('trophy')}<span class="gh-mt">순위</span></button>`);
  }
})();
