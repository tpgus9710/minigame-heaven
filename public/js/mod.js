/* =====================================================================
 *  🛡️ 회원 관리 (v14.1) — 운영자 화면(내 정보 → 운영 → 회원 관리) · 운영자 모두 (최고 운영자 · 운영자)
 *   - 회원 찾기 (이름 일부 · 빈칸이면 지금 정지 중인 회원)
 *   - 회원의 싱글 기록 (지금 몇 등인지 · 언제 세운 기록인지) → 하나씩 또는 전부 지우기
 *   - 패널티: 경고 · 기록 정지 · 이용 정지 (1 · 3 · 7 · 30일 · 영구 + 사유) · 일찍 풀기
 *   - 프로필 카드의 「회원 관리」 · 순위표의 🗑 로도 들어와요
 *   서버: lib/mod.js · 당사자 알림: js/account.js (penShow · banShow)
 * ===================================================================== */
const ModAdmin = {
  q: '', list: null, pen: false, u: null, f: { kind: 'warn', days: 1, why: '' },
  async render() {
    const box = $('#mod-op'); if (!box) return;
    box.innerHTML = this.findHTML() + (this.u ? this.userHTML(this.u) : '');
    const q = $('#mod-q');
    if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); ACT.modFind(); } });
    const w = $('#mod-why');
    if (w) w.addEventListener('input', () => { this.f.why = w.value; });
    if (this.list == null) this.find('');                         // 처음 열면 지금 정지 중인 회원부터
  },
  findHTML() {
    const L = this.list;
    const row = x => `<div class="ac-row ${this.u && this.u.id === x.id ? 'mine' : ''}">${avatarOf(x, 'sm')}<span class="grow ac-who" data-act="modPick" data-uid="${esc(x.id)}" role="button" tabindex="0"><b>${esc(x.name)}</b> ${lvTag(x.lv)} ${opBadge(x.role, true)}
      ${x.ban ? '<em class="mod-tag ban">이용 정지</em>' : ''}${x.rec ? '<em class="mod-tag rec">기록 정지</em>' : ''}</span>
      <small class="muted">${x.on ? '● 접속 중' : agoText(Date.now() - x.seen)} · ${x.plays}판</small></div>`;
    return `<div class="ac-set"><h4>${icon('user-shield')}회원 관리</h4>
      <div class="op-find"><input type="text" id="mod-q" maxlength="10" placeholder="회원 이름 (빈칸 = 정지 중인 회원)" autocomplete="off" value="${esc(this.q)}"><button class="btn sm" data-act="modFind">${icon('search')}찾기</button></div>
      ${L == null ? '<p class="muted small">불러오는 중…</p>' : L.length ? `<div class="ac-list">${L.map(row).join('')}</div>` : `<p class="muted small">${this.pen ? '지금 정지 중인 회원이 없어요.' : '찾는 이름의 회원이 없어요.'}</p>`}
      <p class="small muted">비정상 기록은 순위표에서 🗑 로 바로 지울 수도 있어요. 하는 일은 모두 활동 기록에 남고, 당사자에게는 알림이 가요.</p></div>`;
  },
  userHTML(u) {
    const isOp = !!u.role, f = this.f;
    const when = t => (t ? new Date(t).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }) : '-');
    const penRow = (k, p) => (p ? `<div class="mod-pen ${k}"><span>${icon(PEN_KIND[k][1])}<b>${PEN_KIND[k][0]}</b> ${esc(penUntil(p.until))}</span><small class="muted">${esc(p.why)} · ${esc(p.by || '')}</small>
      <button class="btn sm ghost" data-act="modLift" data-k="${k}">${icon('lock-open')}풀기</button></div>` : '');
    const recs = u.recs.map(r => `<div class="ac-row">${iconOf(r.k)}<span class="grow"><b>${esc(gameLabel(r.k))}</b> <small class="muted">${r.rank ? `${r.rank}등 · ` : ''}${when(r.at)} · ${r.p}판</small></span>
      <b>${esc(recText(r.k, r.b))}</b><button class="bd-del" data-act="modDel" data-k="${esc(r.k)}" data-v="${esc(recText(r.k, r.b))}" title="이 기록 지우기" aria-label="기록 지우기">${icon('trash')}</button></div>`).join('');
    const msgs = u.pen.msgs.map(m => `<div class="ac-row"><small class="muted op-t">${new Date(m.at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</small><span class="op-a">${(PEN_KIND[m.kind] || PEN_KIND.warn)[0]}</span><span class="grow">${esc(m.x || '')}${m.why ? ` · ${esc(m.why)}` : ''}</span></div>`).join('');
    const seg = (k, items) => `<div class="op-seg">${items.map(([v, t]) => `<button class="seg-btn ${String(f[k]) === String(v) ? 'on' : ''}" data-act="modSeg" data-k="${k}" data-v="${v}">${t}</button>`).join('')}</div>`;
    return `<div class="ac-set mod-user"><h4>${avatarOf(u, 'sm')}<span class="grow"><b>${esc(u.name)}</b> ${lvTag(u.lv)} ${opBadge(u.role, true)}</span>
        <small class="muted">${u.on ? '● 접속 중' : agoText(Date.now() - u.seen)} · ${u.plays}판 · ${when(u.created)} 가입</small></h4>
      ${penRow('ban', u.pen.ban)}${penRow('rec', u.pen.rec)}
      <h5>싱글 기록 ${u.recs.length}개 ${u.recs.length ? `<button class="btn sm ghost bad-t" data-act="modDelAll">${icon('trash')}전부 지우기</button>` : ''}</h5>
      ${u.recs.length ? `<div class="ac-list mod-recs">${recs}</div>` : '<p class="muted small">남은 기록이 없어요.</p>'}
      <h5>패널티</h5>
      ${isOp ? '<p class="muted small">운영자에게는 패널티를 줄 수 없어요.</p>' : `
        ${seg('kind', [['warn', '경고'], ['rec', '기록 정지'], ['ban', '이용 정지']])}
        ${f.kind === 'warn' ? '<p class="small muted">알림만 보내요. 다음에 접속하면 창으로 보여요.</p>'
          : `${seg('days', [[1, '1일'], [3, '3일'], [7, '7일'], [30, '30일'], [0, '영구']])}<p class="small muted">${f.kind === 'rec' ? '그동안 새 기록이 남지 않고, 순위표에서 빠져요. 게임은 할 수 있어요.' : '그동안 로그인할 수 없어요. 지금 접속 중이면 바로 로그아웃돼요.'}</p>`}
        <label class="mod-why">사유 <small class="muted">(당사자에게 보여요)</small><input type="text" id="mod-why" maxlength="100" placeholder="예: 화면을 찍어서 푼 기록" value="${esc(f.why)}" autocomplete="off"></label>
        <div class="ac-btnrow"><button class="btn sm ${f.kind === 'warn' ? 'good' : 'bad'}" data-act="modPen">${icon(PEN_KIND[f.kind][1])}${PEN_KIND[f.kind][0]} 주기</button></div>`}
      ${msgs ? `<h5>보낸 알림</h5><div class="ac-list op-logs">${msgs}</div>` : ''}</div>`;
  },
  async find(q) {
    this.q = q;
    const r = await ask('mod:find', { q });
    if (!r.ok) return toast(whyText(r), 'error');
    this.list = r.list; this.pen = r.pen;
    this.render();
  },
  async pick(uid) {
    const r = await ask('mod:user', { uid });
    if (!r.ok) return toast(whyText(r), 'error');
    if (!this.u || this.u.id !== uid) this.f = { kind: 'warn', days: 1, why: '' };
    this.u = r.u;
    this.render();
  },
  /** 서버가 돌려준 새 회원 정보로 다시 그리기 (목록의 표시도 맞춰요) */
  update(u) {
    this.u = u;
    if (this.list) { const x = this.list.find(y => y.id === u.id); if (x) { x.ban = !!u.pen.ban; x.rec = !!u.pen.rec; } }
    this.render();
  },
};
Object.assign(ACT, {
  modFind: () => { const q = $('#mod-q'); ModAdmin.find(q ? q.value.trim() : ''); },
  modPick: el => ModAdmin.pick(el.dataset.uid),
  modSeg: el => {
    const w = $('#mod-why'); if (w) ModAdmin.f.why = w.value;
    ModAdmin.f[el.dataset.k] = el.dataset.k === 'days' ? +el.dataset.v : el.dataset.v;
    ModAdmin.render();
  },
  modDel: async el => {
    const u = ModAdmin.u; if (!u) return;
    const label = gameLabel(el.dataset.k);
    const why = prompt(`${u.name} 님의 ${label} 기록(${el.dataset.v})을 지울까요?\n지우는 까닭을 적어 주세요. (당사자에게 보여요)`, '비정상적인 기록');
    if (why == null) return;
    if (!why.trim()) return toast(ACC_WHY.why, 'error');
    const r = await ask('mod:recDel', { uid: u.id, k: el.dataset.k, why: why.trim(), label });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(`🗑 ${label} 기록을 지웠어요.`, 'good');
    ModAdmin.update(r.u);
  },
  modDelAll: async () => {
    const u = ModAdmin.u; if (!u) return;
    const why = prompt(`${u.name} 님의 싱글 기록 ${u.recs.length}개를 모두 지울까요?\n지우는 까닭을 적어 주세요. (당사자에게 보여요)`, '비정상적인 기록');
    if (why == null) return;
    if (!why.trim()) return toast(ACC_WHY.why, 'error');
    const r = await ask('mod:recDel', { uid: u.id, all: true, why: why.trim() });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(`🗑 기록 ${r.n}개를 지웠어요.`, 'good');
    ModAdmin.update(r.u);
  },
  modPen: async () => {
    const u = ModAdmin.u, f = ModAdmin.f; if (!u) return;
    const w = $('#mod-why'); if (w) f.why = w.value;
    if (!f.why.trim()) return toast(ACC_WHY.why, 'error');
    const what = f.kind === 'warn' ? '경고' : `${PEN_KIND[f.kind][0]} (${f.days ? f.days + '일' : '영구'})`;
    if (!confirm(`${u.name} 님에게 ${what}를 줄까요?\n사유: ${f.why.trim()}`)) return;
    const r = await ask('mod:pen', { uid: u.id, kind: f.kind, days: f.days, why: f.why.trim() });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(`🛡️ ${u.name} 님에게 ${what}를 줬어요.`, 'good');
    f.why = '';
    ModAdmin.update(r.u);
  },
  modLift: async el => {
    const u = ModAdmin.u; if (!u) return;
    const k = el.dataset.k;
    if (!confirm(`${u.name} 님의 ${PEN_KIND[k][0]}를 지금 풀까요?`)) return;
    const r = await ask('mod:lift', { uid: u.id, kind: k });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(`${PEN_KIND[k][0]}를 풀었어요.`, 'good');
    ModAdmin.update(r.u);
  },
  /** 프로필 카드의 「회원 관리」 → 운영 탭의 회원 관리로 */
  modOpen: el => {
    const uid = el.dataset.uid;
    Admin.sub = 'mod';
    Acct.openMe('op');
    setTimeout(() => ModAdmin.pick(uid), 80);
  },
});
