/* =====================================================================
 *  ✨ 레벨 테두리 · 칭호 화면 (목록 · 조건: js/shared/titles.js · 저장: 서버 lib/accounts.js · 모양: css/flair.css)
 *  - 축하 화면: 새 테두리(10레벨마다) · 영웅 이상 칭호 · 처음 한 번 소개. 게임 중 · 결과창에서는 기다렸다가
 *    결과창이 닫히면 (대기실 · 메뉴에서) 보여요 — 한 판 더 · 대기실 이동 버튼을 가리지 않게
 *  - 일반 · 희귀 칭호: 오른쪽 위 알림 카드로 가볍게 (결과창 위에도 떠요)
 *  - 결과창 경험치: 아바타 테두리가 경험치 막대가 되어 차올라요 (레벨 업이면 한 바퀴 채우고 다시 · 새 테두리면 반짝)
 *  - 내 정보 → 칭호 탭: 지금 내 모습 · 테두리 고르기 · 칭호 달기 · 칭호마다 진행 상황
 *  - 친구가 새 테두리 · 영웅 이상 칭호를 받으면 알림 카드 → 👏 축하 보내기
 * ===================================================================== */
const Flair = {
  q: [], cur: null, done: new Set(), timer: null, autoT: null,
  tierName: t => Titles.TIERS[Math.max(0, Math.min(9, t))].n,
  /** 다음 레벨까지 얼마나 찼는지 (0 ~ 1) */
  prog(m) { return m && m.next > m.cur ? Math.max(0, Math.min(1, (m.xp - m.cur) / (m.next - m.cur))) : 0; },
  /** 아직 축하 화면을 못 본 칭호 수 */
  unseen(m) { return m && m.ttl ? Object.values(m.ttl).filter(t => t > (m.ttlSeen || 0)).length : 0; },
  /** 받침이 있으면 '을', 없으면 '를' */
  eul(w) { const c = String(w).slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 ? ((c - 0xac00) % 28 ? '을' : '를') : '을(를)'; },

  /* ───────── 축하 화면 ───────── */
  /** 내 정보가 올 때마다 (Acct.setMe): 레벨이 올라 새 테두리가 됐는지 · 새 칭호가 있는지 */
  check(me) {
    if (!me || !me.id) return;
    const kL = 'mgLvSeen:' + me.id, seen = +store.get(kL, 0);
    if (!seen) store.set(kL, me.lv);                                     // 이 기기에서 처음: 지금 레벨부터 세요
    else if (me.lv > seen) {
      store.set(kL, me.lv);
      if (Titles.tierOf(me.lv) > Titles.tierOf(seen)) this.push({ k: 'tier', lv: me.lv, t: Titles.tierOf(me.lv), wait: 1600 });
    }
    const fresh = Object.entries(me.ttl || {}).filter(([id, t]) => t > (me.ttlSeen || 0) && !this.done.has(id) && Titles.byId[id]).sort((a, b) => a[1] - b[1]);
    if (!store.get('mgFlairIntro:' + me.id, '') && !me.ttlSeen) {           // v12.2 처음: 테두리 · 칭호 소개 (받은 칭호도 같이)
      store.set('mgFlairIntro:' + me.id, '1');
      fresh.forEach(([id]) => this.done.add(id));
      this.push({ k: 'intro', ids: fresh.map(x => x[0]), at: fresh.length ? fresh[fresh.length - 1][1] : Date.now(), wait: 1200 });
      return;
    }
    if (fresh.length) {
      fresh.forEach(([id]) => this.done.add(id));
      this.push({ k: 'title', ids: fresh.map(x => x[0]), at: fresh[fresh.length - 1][1], wait: 1600 });
    }
  },
  push(it) { it.due = Date.now() + (it.wait || 0); this.q.push(it); this.pump(); },
  /** 알림 카드로 가볍게 보여 줄지 (일반 · 희귀 칭호만) */
  isBanner(it) { return it.k === 'title' && it.ids.every(id => !Titles.byId[id] || Titles.byId[id].r < 3); },
  /** 게임 중 · 결과창 · 얼굴 로그인 창이면 기다렸다가 하나씩 */
  pump() {
    clearTimeout(this.timer);
    if (this.cur || !this.q.length || typeof Acct === 'undefined') return;
    const it = this.q[0], wait = it.due - Date.now();
    const res = !this.isBanner(it) && $('#overlay').classList.contains('show');   // 화면 가득 축하는 결과창이 닫힌 뒤에
    const blocked = !Acct.me || Acct.busy() || res || ['face', 'code'].includes(Acct.ui.view) || document.hidden;
    if (wait > 0 || blocked) { this.timer = setTimeout(() => this.pump(), Math.max(500, wait)); return; }
    this.show(this.q.shift());
  },
  /** 반짝이 조각 */
  confetti(n = 30) {
    const cols = ['#ffd54f', '#ff7a59', '#7c6cff', '#3fcf9b', '#4aa8ff', '#e85d9c', '#ffffff'];
    let h = '';
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 100).toFixed(1), d = (2.6 + Math.random() * 2.2).toFixed(2), dl = (Math.random() * 0.9).toFixed(2), r = Math.round(Math.random() * 360);
      h += `<i style="--x:${x}%;--d:${d}s;--dl:${dl}s;--r:${r}deg;--c:${cols[i % cols.length]}${i % 3 ? '' : ';--w:7px;--h:7px;--br:50%'}"></i>`;
    }
    return h;
  },
  /** 귀한 칭호부터 */
  byRare(ids) { return ids.filter(id => Titles.byId[id]).sort((a, b) => Titles.byId[b].r - Titles.byId[a].r); },
  hon(id) {
    const t = Titles.byId[id]; if (!t) return '';
    return `<div class="fl-tt r${t.r}">${titleTag(id, 'big')}<small>${esc(t.d)} · ${Titles.RARITY[t.r]}${t.lim ? ' · 한정' : ''}</small></div>`;
  },
  /** 일반 · 희귀 칭호는 가볍게: 오른쪽 위 알림 카드 (결과창 버튼을 가리지 않아요) */
  banner(it) {
    const box = $('#ac-invites'), me = Acct.me;
    if (!box || !me) return;
    const ids = this.byRare(it.ids), t = Titles.byId[ids[0]];
    const el = document.createElement('div');
    el.className = 'ac-invite fl-ach';
    el.innerHTML = `<span class="fl-ach-ic">${icon('medal')}</span><div class="ac-inv-t"><b>새 칭호${ids.length > 1 ? ` ${ids.length}개` : ''}!</b> ${ids.slice(0, 3).map(id => titleTag(id)).join(' ')}<small>${esc(t.d)}</small></div>
      <div class="ac-inv-b">${me.tt === t.id ? '' : `<button class="btn sm good" data-act="flWear" data-id="${esc(t.id)}">달기</button>`}<button class="btn sm ghost" data-act="acDismiss">닫기</button></div>`;
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    el._t = setTimeout(() => el.remove(), 9000);
    Sound.play('title');
    if (it.at) ask('acct:ttlseen', { t: it.at }).then(r => { if (r.ok && Acct.me) { Acct.me.ttlSeen = Math.max(Acct.me.ttlSeen || 0, it.at); Acct.renderBadges(); } });
    setTimeout(() => this.pump(), 700);
  },
  show(it) {
    const me = Acct.me; if (!me) return;
    if (this.isBanner(it)) return this.banner(it);                       // 영웅 · 전설만 화면 가득
    this.cur = it;
    const top = Titles.tierOf(me.lv), t = it.k === 'tier' ? it.t : (me.frSel >= 0 && me.frSel <= top ? me.frSel : top);
    let body, btns;
    if (it.k === 'tier') {
      const nx = it.t < 9 ? `다음 테두리는 <b>Lv.${Titles.tierLv(it.t + 1)} ${this.tierName(it.t + 1)}</b>!` : '가장 높은 테두리예요. 전설이 됐어요!';
      body = `<div class="fl-kick">${icon('sparkles')}새 테두리를 얻었어요</div>
        <div class="fl-av"><span class="fl-pop">${avatarOf({ ...me, lv: it.lv, fr: -1 }, 'cele')}</span></div>
        <h2 class="fl-h">Lv.${it.lv} <b class="fl-tn ft${it.t}">${esc(this.tierName(it.t))}</b></h2>
        <p class="fl-p">${nx}<br><small>프로필 · 대기실 · 랭킹 어디서나 이 테두리로 보여요.</small></p>`;
      btns = `<button class="btn good" data-act="flClose">좋아요!</button><button class="btn ghost" data-act="flGo">${icon('medal')}꾸미기</button>`;
    } else if (it.k === 'title') {
      const ids = this.byRare(it.ids), first = ids[0];
      body = `<div class="fl-kick">${icon('medal')}새 칭호${ids.length > 1 ? ` ${ids.length}개` : ''}!</div>
        <div class="fl-av sm"><span class="fl-pop">${avatarOf(me, 'xl')}</span></div>
        ${ids.length <= 3 ? `<div class="fl-ttls">${ids.map(id => this.hon(id)).join('')}</div>`
          : `<div class="fl-ttls row">${ids.slice(0, 12).map(id => titleTag(id)).join('')}${ids.length > 12 ? `<small class="muted">외 ${ids.length - 12}개</small>` : ''}</div>
             <p class="fl-p"><small>${esc(Titles.byId[first].n)} — ${esc(Titles.byId[first].d)}</small></p>`}`;
      btns = me.tt === first ? `<button class="btn good" data-act="flClose">좋아요!</button>`
        : `<button class="btn good" data-act="flWear" data-id="${esc(first)}">${icon('check')}「${esc(Titles.byId[first].n)}」 달기</button><button class="btn ghost" data-act="flClose">닫기</button>`;
    } else {
      const newbie = !(me.plays || me.sp) && Date.now() - (+me.created || 0) < 864e5;   // 막 가입했으면 '새 기능' 대신 인사
      body = `<div class="fl-kick">${icon('sparkles')}${newbie ? '환영해요!' : '새 기능'}</div>
        <div class="fl-av"><span class="fl-pop">${avatarOf(me, 'cele')}</span></div>
        <h2 class="fl-h">레벨 테두리 · 칭호</h2>
        <p class="fl-p">10레벨마다 <b>테두리</b>가 바뀌고, 5레벨마다 작은 별이 붙어요.<br>지금 테두리는 <b class="fl-tn ft${top}">${esc(this.tierName(top))}</b> (Lv.${me.lv})예요.</p>
        ${it.ids.length ? `<p class="fl-p"><small>이미 받은 칭호 ${it.ids.length}개</small></p><div class="fl-ttls row">${this.byRare(it.ids).slice(0, 8).map(id => titleTag(id)).join('')}${it.ids.length > 8 ? `<small class="muted">외 ${it.ids.length - 8}개</small>` : ''}</div>` : '<p class="fl-p"><small>판수 · 승리 · 연승 · 출석 … 칭호를 모아 보세요!</small></p>'}`;
      btns = `<button class="btn good" data-act="flGo">${icon('medal')}칭호 보러 가기</button><button class="btn ghost" data-act="flClose">닫기</button>`;
    }
    const el = document.createElement('div');
    el.id = 'fl-cele'; el.className = `fl-cele k-${it.k} ft${t}`; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="fl-rays"></div><div class="fl-conf">${this.confetti(it.k === 'tier' ? 36 : 24)}</div>
      <div class="fl-box">${body}<div class="fl-btns">${btns}</div></div>`;
    el.addEventListener('pointerdown', e => { if (e.target === el || e.target.classList.contains('fl-rays')) this.close(); });
    document.body.append(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    Sound.play(it.k === 'tier' ? 'tier' : 'title');
    clearTimeout(this.autoT);
    this.autoT = setTimeout(() => this.close(), it.k === 'intro' ? 20000 : 10000);
  },
  /** go: 내 정보 → 칭호 탭으로 */
  close(go) {
    const it = this.cur; if (!it) return;
    clearTimeout(this.autoT);
    this.cur = null;
    const el = $('#fl-cele');
    if (el) { el.classList.remove('on'); el.classList.add('off'); setTimeout(() => el.remove(), 280); }
    if (it.at && Acct.me) ask('acct:ttlseen', { t: it.at }).then(r => { if (r.ok && Acct.me) { Acct.me.ttlSeen = Math.max(Acct.me.ttlSeen || 0, it.at); Acct.renderBadges(); } });
    if (go) Acct.openMe('ttl');
    setTimeout(() => this.pump(), 450);
  },

  /* ───────── 결과창: 테두리가 차오르는 경험치 ───────── */
  gain(box, g, bits) {
    const me = Acct.me, x0 = Math.max(0, +g.x0 || 0), x1 = Math.max(x0, +g.x1 || 0);
    const at = x => { const l = Titles.lvOf(x), a = Titles.xpAt(l), b = Titles.xpAt(l + 1); return [l, Math.max(0, Math.min(1, (x - a) / Math.max(1, b - a)))]; };
    let [lv] = at(x0), tierUp = -1;
    const av = l => avatarOf({ ...me, lv: l }, 'lg anim', { p: at(x0)[1] });
    box.innerHTML = `<div class="xg"><span class="xg-av">${av(lv)}</span><div class="xg-t"><b class="xg-n">+0 XP</b><small class="xg-l">Lv.${lv}</small></div></div>${bits}`;
    box.className = 'ov-xp show';
    const T = Math.min(1800, 700 + (x1 - x0) * 8), t0 = performance.now() + 350, gx = box.querySelector('.xg');
    const step = now => {
      if (!gx.isConnected) return;
      const k = Math.max(0, Math.min(1, (now - t0) / T)), e = 1 - Math.pow(1 - k, 3), x = x0 + (x1 - x0) * e;
      const [l, pr] = at(x);
      if (l !== lv) {                                                       // 레벨 업! 한 바퀴 채우고 새 레벨로
        const nt = Titles.tierOf(l), up = nt > Titles.tierOf(lv);
        lv = l;
        const holder = gx.querySelector('.xg-av');
        holder.innerHTML = avatarOf({ ...me, lv: l, fr: up ? -1 : me.fr }, 'lg anim', { p: 0 });
        gx.classList.remove('pop'); void gx.offsetWidth; gx.classList.add('pop');
        if (up) { tierUp = nt; gx.classList.add('tier', 'ft' + nt); }       // 새 테두리: 테두리 색으로 반짝
        Sound.play(up ? 'tier' : 'mission');
      }
      const a = gx.querySelector('.ac-av');
      if (a) a.style.setProperty('--p', (pr * 100).toFixed(1) + '%');
      gx.querySelector('.xg-n').textContent = `+${Math.round((x1 - x0) * e).toLocaleString()} XP`;
      gx.querySelector('.xg-l').textContent = `Lv.${l} · 다음 레벨까지 ${Math.max(0, Titles.xpAt(l + 1) - Math.round(x)).toLocaleString()} XP`;
      if (k < 1) requestAnimationFrame(step);
      else if (g.up) gx.querySelector('.xg-l').innerHTML = tierUp >= 0
        ? `<b class="xg-up">새 테두리! <span class="fl-tn ft${tierUp}">${esc(this.tierName(tierUp))}</span> · Lv.${l}</b>` : `<b class="xg-up">레벨 업! Lv.${l}</b>`;
    };
    requestAnimationFrame(step);
  },

  /* ───────── 친구 소식 ───────── */
  feat(d) {
    if (!Acct.me || !d || !d.u || d.u.id === Acct.me.id || Acct.busy()) return;
    const box = $('#ac-invites'); if (!box) return;
    const u = d.u, t = d.kind === 'title' && Titles.byId[d.id];
    if (d.kind === 'title' && !t) return;
    const what = d.kind === 'tier' ? `<b>Lv.${d.lv} ${esc(this.tierName(d.tier))}</b> 테두리를 얻었어요!` : `칭호 ${titleTag(d.id)}${this.eul(t.n)} 얻었어요!`;
    [...box.children].forEach(c => { if (c.dataset.feat === u.id) c.remove(); });
    const el = document.createElement('div');
    el.className = 'ac-invite fl-feat'; el.dataset.feat = u.id;
    el.innerHTML = `${avatarOf(u, 'anim')}<div class="ac-inv-t"><b>${esc(u.name)}</b>님이 ${what}<small>축하를 보내 볼까요?</small></div>
      <div class="ac-inv-b"><button class="btn sm good" data-act="flCheer" data-uid="${esc(u.id)}">${icon('confetti')}축하</button><button class="btn sm ghost" data-act="acDismiss">닫기</button></div>`;
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    el._t = setTimeout(() => el.remove(), 15000);
    Sound.play('friend');
  },
  cheered(d) {
    if (!d || !d.from) return;
    toast(`👏 ${d.from.name}님이 축하해 줬어요!`, 'good');
    Sound.play('title');
  },

  /* ───────── 내 정보 → 칭호 탭 ───────── */
  renderTab() {
    const box = $('#ac-body'), m = Acct.me;
    if (!box || !m || Acct.ui.tab !== 'ttl') return;
    const top = Titles.tierOf(m.lv), sel = m.frSel >= 0 && m.frSel <= top ? m.frSel : -1, cur = sel >= 0 ? sel : top;
    const got = m.ttl || {}, nGot = Object.keys(got).length, s = m.st || {};
    const fresh = id => got[id] > (m.ttlSeen || 0);
    const frame = t => {
      const lock = t > top, on = sel === t;
      return `<button class="fl-fr${lock ? ' lock' : ''}${on ? ' on' : ''}" data-act="flFrame" data-fr="${t}" aria-pressed="${on}" title="${esc(this.tierName(t))} (Lv.${Titles.tierLv(t)}~)">
        ${avatarOf({ ...m, lv: lock ? Titles.tierLv(t) : m.lv, fr: t }, '')}${lock ? `<i class="fl-lock">${icon('lock')}</i>` : ''}
        <b>${esc(this.tierName(t))}</b><small>${lock ? `Lv.${Titles.tierLv(t)}` : t === top ? '지금' : `Lv.${Titles.tierLv(t)}~`}</small></button>`;
    };
    const card = t => {
      const own = !!got[t.id], p = Titles.prog(t, s), on = m.tt === t.id, hide = t.hid && !own;
      return `<button class="fl-t r${t.r}${own ? ' got' : ' lock'}${on ? ' on' : ''}" data-act="flTitle" data-id="${t.id}" aria-pressed="${on}">
        <span class="fl-t-top">${own || !hide ? titleTag(t.id) : '<span class="hon r0">???</span>'}${on ? `<em class="fl-on">${icon('check')}단 칭호</em>` : own && fresh(t.id) ? '<em class="fl-new">NEW</em>' : ''}</span>
        <small>${esc(hide ? t.h : t.d)}</small>
        ${own ? `<small class="fl-when">${new Date(got[t.id]).toLocaleDateString('ko-KR')} 받음</small>`
          : hide ? '<span class="fl-bar"><i style="width:0"></i></span>' : `<span class="fl-bar"><i style="width:${Math.round(100 * p.v / p.goal)}%"></i></span><small class="fl-pv">${p.v.toLocaleString()} / ${p.goal.toLocaleString()}</small>`}</button>`;
    };
    const next = top < 9 ? `다음 테두리 <b>${esc(this.tierName(top + 1))}</b>까지 Lv.${Titles.tierLv(top + 1)} (약 ${Math.max(1, Math.round((Titles.xpAt(Titles.tierLv(top + 1)) - m.xp) / 30)).toLocaleString()}판)` : '가장 높은 테두리예요';
    box.innerHTML = `<div class="fl-me ft${cur}">${avatarOf(m, 'xl anim')}
        <div class="fl-me-t"><div class="fl-me-l"><b>${esc(m.name)}</b> ${lvTag(m.lv)} ${m.tt ? titleTag(m.tt) : '<span class="small muted">칭호 없음</span>'}</div>
          <small><b class="fl-tn ft${cur}">${esc(this.tierName(cur))}</b> 테두리${sel >= 0 ? ' (직접 고름)' : ''} · 칭호 ${nGot} / ${Titles.LIST.length}개</small>
          <small class="muted">${next}</small></div></div>
      <h4>${icon('sparkles')}테두리 <small class="muted">10레벨마다 새 테두리 · 5레벨마다 작은 별</small></h4>
      <div class="fl-frames">
        <button class="fl-fr auto${sel < 0 ? ' on' : ''}" data-act="flFrame" data-fr="-1" aria-pressed="${sel < 0}"><span class="fl-auto">${icon('refresh')}</span><b>자동</b><small>레벨에 맞춰</small></button>
        ${Titles.TIERS.map((_, t) => frame(t)).join('')}</div>
      <h4>${icon('medal')}칭호 <small class="muted">받은 칭호를 누르면 달아요 · 다시 누르면 떼요</small></h4>
      ${Titles.CATS.map(c => `<div class="fl-cat"><h5>${esc(c)}</h5><div class="fl-ts">${Titles.LIST.filter(t => t.cat === c).map(card).join('')}</div></div>`).join('')}
      <p class="small muted">칭호는 한 번 받으면 계속 내 거예요. 단 칭호는 프로필 카드 · 대기실 · 랭킹에 보여요. <b>???</b> 칭호는 조건을 채우면 나타나요.</p>`;
    if (this.unseen(m) && !this.cur) {                                  // 탭을 봤으면 NEW 표시는 다음부터 빼요
      const at = Math.max(...Object.values(got));
      ask('acct:ttlseen', { t: at }).then(r => { if (r.ok && Acct.me) { Acct.me.ttlSeen = Math.max(Acct.me.ttlSeen || 0, at); Acct.renderChip(); Acct.renderHome(); } });
    }
  },
  async look(d, msg) {
    const r = await ask('acct:look', d);
    if (!r.ok) { toast(whyText(r), 'error'); return false; }
    Acct.setMe({ ...r.me, reqs: Acct.fr ? Acct.fr.reqIn.length : r.me.reqs });
    if (Acct.ui.view === 'me') { Acct.refreshHead(); this.renderTab(); }
    if (msg) toast(msg, 'good');
    return true;
  },
};

Object.assign(ACT, {
  flClose: () => Flair.close(),
  flGo: () => Flair.close(true),
  flWear: async el => {
    const id = el.dataset.id, t = Titles.byId[id], card = el.closest('.ac-invite');
    if (!await Flair.look({ tt: id }, `칭호를 달았어요: ${t ? t.n : ''}`)) return;
    if (card) card.remove(); else Flair.close();
  },
  flFrame: el => {
    const fr = +el.dataset.fr;
    if (el.classList.contains('lock')) return toast(`Lv.${Titles.tierLv(fr)}가 되면 ${Flair.tierName(fr)} 테두리가 열려요.`);
    if (Acct.me && Acct.me.frSel === fr) return;
    Flair.look({ fr }, fr < 0 ? '테두리가 레벨에 맞춰 자동으로 바뀌어요.' : `${Flair.tierName(fr)} 테두리로 바꿨어요.`);
  },
  flTitle: el => {
    const id = el.dataset.id, t = Titles.byId[id], m = Acct.me; if (!t || !m) return;
    if (!(m.ttl || {})[id]) { const p = Titles.prog(t, m.st); return toast(t.hid ? `숨겨진 칭호예요. ${t.h}` : `${t.d} (${p.v.toLocaleString()} / ${p.goal.toLocaleString()})`); }
    if (m.tt === id) Flair.look({ tt: '' }, '칭호를 뗐어요.');
    else Flair.look({ tt: id }, `칭호를 달았어요: ${t.n}`);
  },
  flCheer: async el => {
    const r = await ask('fr:cheer', { uid: el.dataset.uid });
    if (!r.ok) return toast(r.why === 'limit' ? '조금 있다가 다시 보내 주세요.' : whyText(r), 'error');
    el.disabled = true; el.innerHTML = `${icon('check')}보냄`;
    toast('축하를 보냈어요! 👏', 'good');
  },
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Flair.cur) Flair.close(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) Flair.pump(); });
