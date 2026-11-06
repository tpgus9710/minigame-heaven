/* =====================================================================
 *  계정 (account.js) — 얼굴로 회원가입 · 로그인, 게임 기록 · 레벨, 친구 · 방 초대, 랭킹
 *  얼굴 인식은 js/face.js (영천GO 키오스크 방식), 판정 · 저장은 서버(lib/accounts.js)가 해요.
 *  사진은 어디에도 저장하거나 보내지 않아요. 얼굴 특징값(숫자 512개)만 서버로 보내요.
 * ===================================================================== */
'use strict';
const AV_EMOJI = ['😀', '😎', '🤓', '🥳', '😺', '🐶', '🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐧', '🐰', '🐨', '🐙', '🦄', '🐲', '👾', '🤖', '👻', '🍀', '⚽', '🎮'];   // 서버 AV_COUNT(24)와 같아야 해요
const ACC_WHY = {
  loading: '계정 서버를 준비하고 있어요. 잠시 후 다시 해 주세요.', down: '계정 저장소에 연결하지 못했어요. 잠시 후 다시 해 주세요.',
  login: '로그인이 필요해요.', limit: '너무 자주 시도했어요. 잠시 후 다시 해 주세요.', bad: '얼굴 정보를 읽지 못했어요. 다시 해 주세요.',
  nomatch: '등록된 얼굴을 찾지 못했어요.', unsure: '닮은 얼굴이 있어서 확실하지 않아요.', dup: '이미 가입된 얼굴이에요. 로그인해 주세요.',
  name: '닉네임을 입력해 주세요.', agree: '얼굴 특징값 저장에 동의해야 가입할 수 있어요.', full: '가입 인원이 가득 찼어요.',
  code: '코드가 맞지 않거나 시간이 지났어요.', nouser: '그 친구 코드를 찾을 수 없어요.', self: '내 친구 코드예요!',
  already: '이미 친구예요.', sent: '이미 친구 신청을 보냈어요.', max: '친구 · 신청이 너무 많아요.', noreq: '받은 신청이 없어요.',
  notfriend: '친구에게만 초대를 보낼 수 있어요.', noroom: '먼저 방을 만들거나 들어가 주세요.', offline: '친구가 지금 접속해 있지 않아요.',
  here: '이미 같은 방에 있어요.', timeout: '서버가 응답하지 않아요. 연결을 확인해 주세요.', sure: '탈퇴를 확인해 주세요.',
  unknown: '지금 접속 중이거나, 같은 방에 있거나, 같이 게임한 사람에게만 바로 신청할 수 있어요. 친구 코드로 신청해 주세요.',
  empty: '보낼 내용을 입력해 주세요.', locked: '아직 열리지 않았어요.',
};
const FACE_TIP = {
  none: '얼굴이 보이지 않아요. 화면 가운데를 봐 주세요', many: '한 사람만 화면에 나오게 해 주세요', small: '조금 더 가까이 와 주세요',
  edge: '얼굴을 화면 가운데로 옮겨 주세요', blur: '얼굴이 흐려요. 밝은 곳에서 잠깐 멈춰 주세요', side: '정면을 봐 주세요',
  tilt: '고개를 똑바로 해 주세요', dark: '너무 어두워요. 밝은 곳으로 가 주세요',
};
const SOLO_SUB = { 'dodge:bullet': '총알 모드', 'dodge:bamboo': '대나무 모드', 'mine:easy': '초급', 'mine:normal': '중급', 'mine:hard': '고급' };
const REC_FMT = {
  race: v => v.toFixed(2) + '초', dodge: v => v.toFixed(2) + '초', mine: v => v + '초', apple: v => v + '개', snake: v => '길이 ' + v,
  stack: v => v + '층', breakout: v => v + '단계', zombie: v => '스테이지 ' + v, plat: v => '스테이지 ' + v,
};
/** 랭킹에서 고를 수 있는 싱글 기록 */
const REC_GAMES = [['pinball', ''], ['g2048', ''], ['fruit', ''], ['gem', ''], ['apple', ''], ['race', ''], ['mine:easy', ''], ['mine:normal', ''], ['mine:hard', ''],
  ['dodge:bullet', ''], ['dodge:bamboo', ''], ['snake', ''], ['stack', ''], ['breakout', ''], ['shisen', ''], ['rain', ''], ['mole', ''],
  ['shooter', ''], ['tetris', ''], ['zombie', ''], ['plat', ''], ['yacht', '']];

const DM_WHY = { notfriend: '친구에게만 귓속말을 보낼 수 있어요.', offline: '친구가 지금 접속해 있지 않아요. 접속하면 보낼 수 있어요.',
  limit: '너무 빨리 보내고 있어요. 잠깐 쉬었다가 보내 주세요.', nouser: '그 친구를 찾을 수 없어요.' };
const MENU_SCREENS = new Set(['home', 'single', 'multi', 'lobby']);       // 이 화면들 말고는 게임 화면이에요
const hhmm = t => new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
const dmDot = n => (n ? `<i class="ac-dot wh" title="안 읽은 귓속말 ${n}개">${icon('message-circle')}${n > 99 ? '99+' : n}</i>` : '');
const ask = (ev, d) => new Promise(res => socket.timeout(10000).emit(ev, d, (err, r) => res(err ? { ok: false, why: 'timeout' } : (r || { ok: false, why: 'bad' }))));
const whyText = r => ACC_WHY[r && r.why] || '잠시 후 다시 해 주세요.';
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** 글자 단위로 n자 (이모지를 반으로 자르지 않게) */
const cutText = (s, n) => [...String(s ?? '').replace(/\p{Cs}/gu, '')].slice(0, n).join('');
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  if (s < 86400 * 7) return Math.floor(s / 86400) + '일 전';
  const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
/** 아바타 (이모지 또는 이름 첫 글자 + 색) + 레벨 테두리 (10레벨마다 · js/shared/titles.js · 모양은 css/flair.css)
 *  u.fr: 고른 테두리 (없으면 레벨에 맞춰) · o.p: 0~1 이면 테두리가 경험치 막대 (내 아바타)
 *  큰 아바타(xl · lobby) · 'anim' 클래스만 테두리가 움직여요 — 목록의 작은 아바타는 가만히 */
function avatarOf(u, cls = '', o = {}) {
  const bg = AV_COLORS[((u && u.color) ?? 0) % AV_COLORS.length];
  const face = u && u.av >= 0 && u.av < AV_EMOJI.length ? AV_EMOJI[u.av] : esc(((u && u.name) || '?')[0]);
  const lv = Math.max(1, Math.min(99, (u && +u.lv) || 1)), top = Titles.tierOf(lv);
  const t = u && Number.isInteger(u.fr) && u.fr >= 0 && u.fr <= top ? u.fr : top;
  let fx = '<i class="av-r"></i>';
  if (o.p != null) fx += '<i class="av-q"></i>';
  if (t >= 5) fx += '<i class="av-o"></i>';
  if (t >= 6) fx += `<i class="av-s n${Math.min(3, t - 5)}"></i>`;
  const bd = { 3: 'star', 7: 'diamond', 8: 'sparkles' }[t];
  if (bd) fx += `<i class="av-b">${icon(bd)}</i>`;
  if (t === 9) fx += `<i class="av-c">${icon('crown')}</i>`;
  if (lv % 10 >= 5 && t === top && !bd && t < 9) fx += `<i class="av-p">${icon('star')}</i>`;      // 5레벨마다 작은 별
  const p = o.p != null ? `;--p:${(Math.max(0, Math.min(1, +o.p || 0)) * 100).toFixed(1)}%` : '';
  return `<span class="ac-av ${cls} ft${t}${o.p != null ? ' prog' : ''}" style="background:${bg}${p}">${face}${fx}</span>`;
}
const lvTag = lv => `<span class="lv ft${Titles.tierOf(lv)}">Lv.${lv}</span>`;
/** 칭호 이름표 (r1 일반 · r2 희귀 · r3 영웅 · r4 전설) · attrs: 누를 수 있게 할 때 */
function titleTag(id, cls = '', attrs = '') {
  const t = id && Titles.byId[id];
  return t ? `<span class="hon r${t.r} ${cls}" title="${esc(t.d)}"${attrs}>${esc(t.n)}</span>` : '';
}
function gameLabel(key) {
  const [base] = String(key).split(':');
  const solo = SOLO_GAMES.find(g => g[0] === base);
  const name = GAME_INFO[base] && !solo ? GAME_INFO[base].name : solo ? solo[2] : (GAME_INFO[base] || {}).name || base;
  return stripEmoji(name) + (SOLO_SUB[key] ? ` (${SOLO_SUB[key]})` : '');
}
const multiLabel = g => stripEmoji((GAME_INFO[g] || {}).name || g);
function recText(key, v) {
  if (v == null) return '-';
  const f = REC_FMT[String(key).split(':')[0]];
  return f ? f(+v) : `${Number(v).toLocaleString()}점`;
}
const iconOf = key => { const base = String(key).split(':')[0]; return gameIcon(base, catOf(base), 'sm'); };

const Acct = {
  me: null, persist: null, state: 'loading', fr: null, gain: null,
  ui: { view: null, tab: 'rec', rankK: 'xp', rankG: 'g2048', sess: 0, form: null, dm: null },
  cam: null,
  missed: new Map(),     // 게임하는 동안 온 귓속말: 보낸 친구 id → { from, n, x, during }
  invMissed: [],         // 게임하는 동안 온 방 초대
  wasBusy: false, busyG: undefined,

  get token() { return store.get('mgAuth', ''); },
  setToken(t) { store.set('mgAuth', t || ''); },

  /* ───────── 서버와 인사 (접속할 때마다) ───────── */
  async hello() {
    const r = await ask('acct:hello', this.token || '');
    this.persist = r.persist || this.persist;
    if (!r.ok) { this.state = r.why || 'loading'; this.renderAll(); return; }
    this.state = 'ready';
    if (r.me) this.setMe(r.me, true);
    else { if (this.token) this.setToken(''); this.setMe(null); }
  },
  setMe(me, fresh) {
    const was = this.me && this.me.id;
    this.me = me;
    if (!me) this.fr = null;
    else if (fresh || was !== me.id) this.loadFriends();
    this.renderAll();
    if (me) Flair.check(me);                                     // 새 테두리 · 새 칭호 축하 (js/flair.js)
  },
  onLogin(r) {
    this.setToken(r.token);
    this.setMe(r.me, true);
    toast(r.joined ? `🎉 가입 완료! 반가워요, ${r.me.name}님` : `👋 ${r.me.name}님 반가워요!`, 'good');
  },
  async logout() {
    await ask('acct:logout');
    this.setToken(''); this.setMe(null); this.close();
    toast('로그아웃했어요.');
  },
  async loadFriends() {
    if (!this.me) return;
    const r = await ask('fr:list');
    if (!r.ok || !this.me) return;
    this.fr = r;
    this.me.reqs = r.reqIn.length;
    this.me.dm = r.friends.reduce((a, f) => a + (f.unread || 0), 0);
    const d = this.ui.dm;
    if (this.ui.view === 'dm' && d && !d.loading) {
      const nf = r.friends.find(f => f.id === d.uid);
      if (nf) { d.friend = nf; this.dmStatus(); } else this.dmGone();
    }
    this.renderChip(); this.renderHome();
    if (this.ui.view === 'me') this.refreshHead();
    if (this.ui.view === 'me' && this.ui.tab === 'fr') this.renderFriends();
    if (S.room && isScreen('lobby')) renderLobby();
  },

  /* ───────── 상단 · 홈 · 대기실 표시 ───────── */
  renderAll() {
    this.renderChip(); this.renderHome();
    $('#nick').readOnly = !!this.me;
    if (this.me) $('#nick').value = this.me.name;
    if (S.room) renderLobby();
    renderInvite();
    if (this.ui.view === 'me' && this.me) this.refreshHead();
    if (this.ui.view === 'me' && !this.me) this.close();
  },
  renderChip() {
    const el = $('#acct-chip'); if (!el) return;
    const m = this.me;
    el.innerHTML = m
      ? `${avatarOf(m, 'sm', { p: Flair.prog(m) })}<span class="ac-chip-name">${esc(m.name)}</span>${lvTag(m.lv)}${m.reqs ? `<i class="ac-dot">${m.reqs}</i>` : ''}${dmDot(m.dm)}`
      : `${icon('face-id')}<span class="ac-chip-name">얼굴 로그인</span>`;
    el.classList.toggle('in', !!m);
    el.title = m ? '내 정보 · 기록 · 친구' : '얼굴로 로그인 / 회원가입';
  },
  renderHome() {
    const el = $('#acct-home'); if (!el) return;
    const m = this.me;
    $('.nick-row').classList.toggle('hidden', !!m);
    if (!m) {
      el.innerHTML = `<div class="ac-home out"><span class="ac-home-ic">${icon('face-id')}</span>
        <div class="ac-home-t"><b>카메라만 보면 1초 로그인</b><small>게임 기록 · 레벨 · 친구 초대를 쓸 수 있어요. 사진은 저장하지 않아요.</small></div>
        <button class="btn sm" data-act="acLogin">얼굴로 시작하기</button></div>`;
      return;
    }
    const pct = Math.round(100 * (m.xp - m.cur) / Math.max(1, m.next - m.cur));
    const on = this.fr ? this.fr.friends.filter(f => f.on).length : 0;
    el.innerHTML = `<div class="ac-home"><span class="ac-home-av" data-act="acOpen" data-tab="ttl" role="button" tabindex="0" title="테두리 · 칭호">${avatarOf(m, 'lg anim', { p: Flair.prog(m) })}</span>
      <div class="ac-home-t"><b>${esc(m.name)}님 반가워요!</b> ${lvTag(m.lv)} ${titleTag(m.tt, 'link', ' data-act="acOpen" data-tab="ttl" role="button" tabindex="0"')}
        <div class="xpbar"><i style="width:${pct}%"></i></div>
        <small>다음 레벨까지 ${(m.next - m.xp).toLocaleString()} XP · 멀티 ${m.plays}판 ${m.wins}승 · 싱글 ${m.sp}판</small>
        ${this.fr ? `<button class="ac-online-link" data-act="acOpen" data-tab="fr"><i></i>지금 접속 중인 회원 ${this.fr.onlineN || 0}명</button>` : ''}</div>
      <div class="ac-home-btns">
        <button class="btn sm ghost" data-act="acOpen" data-tab="rec">${icon('chart-bar')}기록</button>
        <button class="btn sm ghost" data-act="acOpen" data-tab="ttl">${icon('medal')}칭호${Flair.unseen(m) ? '<i class="ac-dot">N</i>' : ''}</button>
        <button class="btn sm ghost" data-act="acOpen" data-tab="fr">${icon('users')}친구${on ? `<i class="ac-on">${on}</i>` : ''}${m.reqs ? `<i class="ac-dot">${m.reqs}</i>` : ''}${dmDot(m.dm)}</button>
        <button class="btn sm ghost" data-act="acOpen" data-tab="rank">${icon('trophy')}랭킹</button></div></div>
      ${this.dailyHTML(m.daily, true)}`;
  },
  /** 대기실 참가자 카드: 계정 아바타 */
  lobbyAvatar(p) {
    if (!p.uid) return null;
    return avatarOf({ name: p.name, av: p.av, color: p.color, lv: p.lv, fr: p.fr }, 'lobby');
  },
  /** 대기실 참가자 카드: 레벨 · 친구 표시 · 친구 신청 버튼 */
  lobbyTags(p) {
    if (!p.uid) return '';
    let t = `<span class="tag lvtag ft${Titles.tierOf(p.lv || 1)}">Lv.${p.lv || 1}</span>${p.tt ? titleTag(p.tt, 'tag-h') : ''}`;
    const m = this.me;
    if (!m || p.uid === m.id) return t;
    const fr = this.fr;
    if (fr && fr.friends.some(f => f.id === p.uid)) t += '<span class="tag frtag">친구</span>';
    else if (fr && fr.reqOut.some(f => f.id === p.uid)) t += '<span class="tag wait">신청함</span>';
    else if (fr && fr.reqIn.some(f => f.id === p.uid)) t += `<button class="tag addtag" data-act="acAccept" data-uid="${esc(p.uid)}">수락</button>`;
    else t += `<button class="tag addtag" data-act="acAddUid" data-uid="${esc(p.uid)}">+ 친구</button>`;
    return t;
  },

  /* ───────── 창 열기 · 닫기 ───────── */
  open(view) {
    this.ui.view = view;
    $('#acct-ov').classList.add('show');
    $('#acct-modal').className = 'modal acct ' + (view === 'me' ? 'wide' : view === 'dm' ? 'whv' : view === 'card' ? 'cardv' : '');
  },
  close() {
    clearInterval(this.frPoll); this.frPoll = null;
    this.ui.sess++; this.ui.view = null; this.ui.dm = null;
    this.stopCam();
    $('#acct-ov').classList.remove('show');
    $('#acct-modal').innerHTML = '';
  },
  body(html) { $('#acct-modal').innerHTML = `<button class="ac-x" data-act="acClose" aria-label="닫기">${icon('x')}</button>${html}`; },

  /* ───────── 카메라 ───────── */
  camHTML(n) {
    return `<div class="cam" id="ac-cam"><video id="ac-video" autoplay muted playsinline></video><div class="cam-oval" id="ac-oval"><i class="cam-scan"></i></div>
      <div class="cam-msg" id="ac-msg">카메라를 켜는 중…</div></div>
      <div class="cam-dots" id="ac-dots">${'<i></i>'.repeat(n)}</div>`;
  },
  /** 이 주소 · 브라우저에서 카메라를 쓸 수 없으면 그 이유 (쓸 수 있으면 '') */
  camBlocked() {
    if (window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) return '';
    return location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(location.hostname)
      ? `이 주소(http://${location.host})에서는 브라우저가 카메라를 막아요. https 로 시작하는 인터넷 주소로 접속하거나, 서버 컴퓨터에서는 http://localhost:${location.port || 80} 으로 열어 주세요.`
      : '이 브라우저에서는 카메라를 쓸 수 없어요.';
  },
  async openCam(sess) {
    const why = this.camBlocked();
    if (why) throw new Error(why);
    this.stopCam();
    let st;
    try {
      st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) {
      const n = e && e.name;
      throw new Error(n === 'NotAllowedError' || n === 'SecurityError' ? '카메라 권한이 꺼져 있어요. 주소창 옆 자물쇠(사이트 설정)에서 카메라를 허용해 주세요.'
        : n === 'NotFoundError' || n === 'OverconstrainedError' ? '카메라를 찾을 수 없어요.'
          : n === 'NotReadableError' ? '다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 해 주세요.' : '카메라를 켜지 못했어요.');
    }
    if (sess !== undefined && this.ui.sess !== sess) { st.getTracks().forEach(t => t.stop()); return false; }   // 늦게 켜진 카메라
    this.stopCam();                                   // 혹시 먼저 켜진 카메라가 있으면 끄고
    this.cam = st;
    const v = $('#ac-video');
    if (!v) { this.stopCam(); return false; }
    v.srcObject = st;
    try { await v.play(); } catch { /* 자동 재생은 muted 라 괜찮아요 */ }
    for (let i = 0; i < 50 && !v.videoWidth; i++) await sleep(100);
    return true;
  },
  stopCam() {
    if (this.cam) this.cam.getTracks().forEach(t => t.stop());
    this.cam = null;
    const v = $('#ac-video'); if (v) v.srcObject = null;
  },
  msg(t, kind = '') { const el = $('#ac-msg'); if (el) { el.textContent = t; el.dataset.k = kind; } },
  guide(k) { const el = $('#ac-oval'); if (el) el.dataset.k = k; },
  dots(n, total) { const el = $('#ac-dots'); if (el) el.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); },
  /** 카메라 + 얼굴 인식 준비 (둘 다 되면 true) */
  async prepare(sess) {
    let pct = 0;
    const blocked = this.camBlocked();
    if (blocked) { this.fail(blocked, 'blocked'); return false; }    // 쓸 수 없으면 11MB 모델도 받지 않아요
    const cam = this.openCam(sess);
    const model = FaceAI.load(p => { pct = p; if (this.ui.sess === sess && !FaceAI.ready()) this.msg(`얼굴 인식 준비 중… ${Math.round(p * 100)}%${p < 0.95 ? ' (처음 한 번만 약 11MB)' : ''}`); });
    let camOk = false;
    try { camOk = await cam; } catch (e) { model.catch(() => {}); if (this.ui.sess === sess) this.fail(e.message, 'code'); return false; }
    if (!camOk || this.ui.sess !== sess) return false;
    if (!FaceAI.ready()) this.msg(`얼굴 인식 준비 중… ${Math.round(pct * 100)}%`);
    try { await model; } catch (e) {
      console.error(e);
      if (this.ui.sess === sess) this.fail(e.unsupported ? e.message : '얼굴 인식 파일을 받지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.', e.unsupported ? 'code' : null);
      return false;
    }
    return this.ui.sess === sess;
  },
  /** 좋은 장면(정면 · 충분히 큼) n장의 특징값 모으기 */
  async collect(n, sess) {
    const v = $('#ac-video'), out = [];
    let last = 0;
    this.dots(0, n);
    while (this.ui.sess === sess) {
      if (!v || v.readyState < 2 || !v.videoWidth) { await sleep(100); continue; }
      let r;
      try { r = await FaceAI.analyze(v); } catch (e) { console.error(e); await sleep(300); continue; }
      if (this.ui.sess !== sess) return null;
      this.guide(r.problem === null ? 'good' : r.problem === 'none' ? '' : 'warn');
      this.msg(r.problem === null ? '좋아요! 그대로 잠깐만 있어 주세요' : FACE_TIP[r.problem] || '');
      if (r.problem === null && performance.now() - last > 140) {
        out.push(r.emb); last = performance.now();
        this.dots(out.length, n);
        if (out.length >= n) return out;
      }
      await sleep(40);
    }
    return null;
  },
  /** 실패 화면: 카메라 끄고 안내 + 다음 행동 버튼 */
  fail(text, next) {
    this.stopCam();
    const cam = $('#ac-cam');
    if (cam) cam.classList.add('off');
    this.guide('bad'); this.msg(text, 'bad');
    const btns = $('#ac-btns');
    if (!btns) return;
    const again = `<button class="btn good" data-act="${this.ui.form ? 'acJoinGo' : 'acLogin'}">${icon('refresh')}다시 시도</button>`;
    btns.innerHTML = next === 'blocked' ? `<button class="btn" data-act="acCodeView">${icon('key')}코드로 로그인</button>`
      : next === 'code' ? `<button class="btn ghost" data-act="acCodeView">${icon('key')}코드로 로그인</button>${again}`
      : next === 'login' ? `<button class="btn good" data-act="acLogin">${icon('login')}로그인하기</button>`
        : next === 'join' ? `${again}<button class="btn" data-act="acJoin">${icon('user-plus')}처음이에요 · 회원가입</button>`
          : again;
  },

  /* ───────── 얼굴로 로그인 ───────── */
  async login() {
    if (this.state !== 'ready') { await this.hello(); if (this.state !== 'ready') return toast(whyText({ why: this.state }), 'error'); }
    const sess = ++this.ui.sess;
    this.ui.form = null;
    this.open('face');
    this.body(`<div class="ac-title">${icon('face-id')}<h2>얼굴로 로그인</h2></div>
      <p class="muted">카메라를 정면으로 보면 자동으로 알아봐요.</p>${this.camHTML(3)}
      <div class="ov-actions" id="ac-btns"><button class="btn ghost sm" data-act="acJoin">${icon('user-plus')}처음이에요 · 회원가입</button>
        <button class="btn ghost sm" data-act="acCodeView">${icon('key')}카메라 없이 코드로</button></div>
      <p class="ac-note">${icon('lock')}사진은 저장하지도 보내지도 않아요. 얼굴에서 뽑은 숫자 512개(특징값)만 서버와 비교해요.</p>`);
    if (!await this.prepare(sess)) return;
    let fails = 0;
    while (this.ui.sess === sess) {
      const embs = await this.collect(3, sess);
      if (!embs) return;
      const avg = FaceAI.average(embs, 0.5);
      if (!avg) { this.msg('얼굴이 흔들렸어요. 가만히 정면을 봐 주세요', 'warn'); await sleep(700); continue; }
      this.msg('누구인지 확인하는 중…', 'busy');
      const r = await ask('acct:login', { e: FaceAI.pack(avg.v) });
      if (this.ui.sess !== sess) { if (r.ok) this.onLogin(r); return; }     // 창을 닫았어도 서버는 이미 로그인시켰어요
      if (r.ok) {
        this.guide('ok'); this.msg(`${r.me.name}님 반가워요!`, 'ok');
        this.stopCam(); this.onLogin(r);
        await sleep(1000);
        if (this.ui.sess === sess) this.close();
        return;
      }
      if (['limit', 'loading', 'down', 'timeout', 'bad'].includes(r.why)) return this.fail(whyText(r));
      if (++fails >= 3) return this.fail(r.why === 'unsure' ? '닮은 얼굴이 있어서 확실하게 알아보지 못했어요. 밝은 곳에서 정면을 보고 다시 해 주세요.' : '등록된 얼굴을 찾지 못했어요. 처음이라면 회원가입을 해 주세요.', 'join');
      this.msg(r.why === 'unsure' ? '닮은 얼굴이 있어요. 정면을 보고 잠깐만…' : '한 번 더 확인해 볼게요…', 'warn');
      await sleep(800);
    }
  },

  /* ───────── 회원가입 ───────── */
  joinForm(mode = 'join') {
    if (mode === 'join' && this.state !== 'ready') return toast(whyText({ why: this.state }), 'error');
    this.ui.sess++; this.stopCam();
    const f = this.ui.form = { mode, av: this.me ? this.me.av : 0, color: this.me ? this.me.color : rand(AV_COLORS.length), name: this.me ? this.me.name : cutText($('#nick').value.trim(), 10) };
    this.open('join');
    if (mode === 'reface') {
      this.body(`<div class="ac-title">${icon('scan')}<h2>얼굴 다시 등록</h2></div>
        <p class="muted">로그인할 때 잘 못 알아보면 지금 모습으로 다시 등록해 주세요. 예전 특징값은 지워져요.</p>
        <div class="ov-actions" id="ac-btns"><button class="btn good lg" data-act="acJoinGo">${icon('camera')}카메라 켜기</button></div>`);
      return;
    }
    this.body(`<div class="ac-title">${icon('user-plus')}<h2>얼굴로 회원가입</h2></div>
      <div class="ac-form">
        <label>닉네임<input type="text" id="ac-name" maxlength="10" placeholder="최대 10자" value="${esc(f.name)}" autocomplete="off"></label>
        <div class="ac-lab">아바타</div>
        <div class="ac-avs" id="ac-avs">${this.avPicker(f)}</div>
        <div class="ac-cols" id="ac-cols">${this.colPicker(f)}</div>
        <label class="ac-agree"><input type="checkbox" id="ac-agree">
          <span><b>얼굴 특징값 저장에 동의해요</b>
          <small>· 사진은 저장하지 않고, 얼굴에서 뽑은 숫자 512개(특징값)만 이 게임 서버에 저장해요.<br>· 로그인할 때 비교하는 데만 써요. 탈퇴하면 바로 지워져요.</small></span></label>
      </div>
      ${this.camBlocked() ? `<div class="ac-warn">${icon('alert-triangle')}<span>${esc(this.camBlocked())}</span></div>` : ''}
      <div class="ov-actions" id="ac-btns"><button class="btn ghost" data-act="acLogin">이미 가입했어요</button>
        <button class="btn good" data-act="acJoinGo" ${this.camBlocked() ? 'disabled' : ''}>${icon('camera')}얼굴 등록 시작</button></div>`);
    setTimeout(() => { const i = $('#ac-name'); if (i && !i.value) i.focus(); }, 50);
  },
  avPicker(f) {
    return `<button class="ac-avb ${f.av === -1 ? 'on' : ''}" data-act="acPickAv" data-av="-1" title="이름 첫 글자">${esc((f.name || '가')[0])}</button>`
      + AV_EMOJI.map((e, i) => `<button class="ac-avb ${f.av === i ? 'on' : ''}" data-act="acPickAv" data-av="${i}">${e}</button>`).join('');
  },
  colPicker(f) { return AV_COLORS.map((c, i) => `<button class="ac-col ${f.color === i ? 'on' : ''}" style="background:${c}" data-act="acPickCol" data-col="${i}" aria-label="색 ${i + 1}"></button>`).join(''); },
  async joinGo() {
    const f = this.ui.form; if (!f) return;
    if (f.mode === 'join') {
      const nameEl = $('#ac-name');
      if (nameEl) f.name = cutText(nameEl.value.trim(), 10);
      if (!f.name) { toast('닉네임을 입력해 주세요.', 'error'); if (nameEl) nameEl.focus(); return; }
      const ag = $('#ac-agree');
      if (ag && !ag.checked) { toast('얼굴 특징값 저장에 동의해 주세요.', 'error'); return; }
      f.agree = true;
    }
    const sess = ++this.ui.sess;
    this.open('join');
    this.body(`<div class="ac-title">${icon('scan')}<h2>${f.mode === 'reface' ? '얼굴 다시 등록' : '얼굴 등록'}</h2></div>
      <p class="muted">정면을 보고 잠깐만 가만히 있어 주세요. 여러 장면을 모아 평균을 저장해요.</p>${this.camHTML(8)}
      <div class="ov-actions" id="ac-btns"></div>
      <p class="ac-note">${icon('lock')}사진은 저장하지 않아요. 숫자 512개(특징값)만 저장하고, 탈퇴하면 바로 지워요.</p>`);
    if (!await this.prepare(sess)) return;
    for (let attempt = 0; attempt < 3 && this.ui.sess === sess; attempt++) {
      const embs = await this.collect(8, sess);
      if (!embs) return;
      const avg = FaceAI.average(embs, 0.6);
      if (!avg) { this.msg('얼굴이 계속 바뀌었어요. 가만히 정면을 봐 주세요', 'warn'); await sleep(900); continue; }
      this.msg(f.mode === 'reface' ? '저장하는 중…' : '가입하는 중…', 'busy');
      const r = f.mode === 'reface'
        ? await ask('acct:reface', { e: FaceAI.pack(avg.v), n: avg.n })
        : await ask('acct:join', { e: FaceAI.pack(avg.v), n: avg.n, name: f.name, av: f.av, color: f.color, agree: true });
      if (this.ui.sess !== sess) { if (r.ok) { if (f.mode === 'reface') this.setMe(r.me); else this.onLogin(r); } return; }
      if (!r.ok) return this.fail(r.why === 'dup' && f.mode === 'reface' ? '다른 회원과 너무 닮아서 저장하지 않았어요.' : whyText(r), r.why === 'dup' && f.mode === 'join' ? 'login' : null);
      this.stopCam();
      if (f.mode === 'reface') { this.setMe(r.me); toast('얼굴을 다시 등록했어요.', 'good'); this.openMe('set'); return; }
      this.onLogin(r);
      this.ui.form = null;
      this.body(`<div class="ac-done">${avatarOf(r.me, 'xl')}<h2>가입 완료! 🎉</h2>
        <p><b>${esc(r.me.name)}</b>님, 환영해요. 다음부터는 카메라만 보면 로그인돼요.</p>
        <div class="ac-code-big"><small>내 친구 코드</small><b>${esc(r.me.code)}</b><button class="btn sm ghost" data-act="acCopyCode">${icon('copy')}복사</button></div>
        <p class="small muted">친구에게 이 코드를 알려 주면 친구 신청을 받을 수 있어요.</p></div>
        <div class="ov-actions"><button class="btn good lg" data-act="acClose">시작하기</button></div>`);
      return;
    }
    if (this.ui.sess === sess) this.fail('얼굴을 등록하지 못했어요. 밝은 곳에서 정면을 보고 다시 해 주세요.');
  },

  /* ───────── 코드로 로그인 (카메라 없는 기기) ───────── */
  codeView() {
    this.ui.sess++; this.stopCam();
    this.open('code');
    this.body(`<div class="ac-title">${icon('key')}<h2>코드로 로그인</h2></div>
      <p class="muted">이미 로그인한 기기(휴대폰 등)에서 <b>내 정보 → 설정 → 로그인 코드 만들기</b>를 누르면 8글자 코드가 나와요. 5분 안에 입력해 주세요.</p>
      <input type="text" id="ac-code" class="ac-code-in" maxlength="9" placeholder="ABCD 2345" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false">
      <div class="ov-actions"><button class="btn ghost" data-act="acLogin">${icon('face-id')}얼굴로</button><button class="btn good" data-act="acCodeGo">${icon('login')}로그인</button></div>`);
    setTimeout(() => { const i = $('#ac-code'); if (i) i.focus(); }, 50);
  },
  async codeGo() {
    const c = ($('#ac-code') ? $('#ac-code').value : '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 8) return toast('코드 8글자를 입력해 주세요.', 'error');
    const r = await ask('acct:code', { code: c });
    if (!r.ok) return toast(whyText(r), 'error');
    this.onLogin(r); this.close();
  },

  /* ───────── 내 정보 (기록 · 친구 · 랭킹 · 설정) ───────── */
  openMe(tab) {
    if (!this.me) return this.login();
    this.ui.sess++; this.stopCam(); this.ui.dm = null;
    if (tab) this.ui.tab = tab;
    this.open('me');
    this.renderProfile();
  },
  headHTML() {
    const m = this.me;
    const pct = Math.round(100 * (m.xp - m.cur) / Math.max(1, m.next - m.cur));
    const tab = (k, ic, label, extra = '') => `<button class="ac-tab ${this.ui.tab === k ? 'on' : ''}" data-act="acTab" data-tab="${k}">${icon(ic)}${label}${extra}</button>`;
    return `<div class="ac-head"><span class="ac-head-av" data-act="acTab" data-tab="ttl" role="button" tabindex="0" title="테두리 · 칭호">${avatarOf(m, 'xl')}</span>
        <div class="ac-head-t"><h2>${esc(m.name)} ${lvTag(m.lv)} ${typeof opBadge === 'function' ? opBadge(m.role) : ''} ${titleTag(m.tt)}</h2>
          <div class="xpbar"><i style="width:${pct}%"></i></div>
          <small>${m.xp.toLocaleString()} XP · 다음 레벨까지 ${(m.next - m.xp).toLocaleString()} XP</small></div>
        <div class="ac-code-chip" data-act="acCopyCode" title="눌러서 복사"><small>친구 코드</small><b>${esc(m.code)}</b></div></div>
      <div class="ac-tabs">${tab('rec', 'chart-bar', '기록')}${tab('ttl', 'medal', '칭호', Flair.unseen(m) ? '<i class="ac-dot">N</i>' : '')}${tab('fr', 'users', '친구', (m.reqs ? `<i class="ac-dot">${m.reqs}</i>` : '') + dmDot(m.dm))}${tab('rank', 'trophy', '랭킹')}${m.role ? tab('op', 'shield-check', '운영', typeof Report !== 'undefined' && Report.opNew ? `<i class="ac-dot">${Report.opNew}</i>` : '') : ''}${tab('set', 'settings', '설정')}</div>`;
  },
  /** 내 정보가 바뀌었을 때 위쪽(이름 · 레벨 · 탭)만 다시 그리기 — 입력 중인 내용은 그대로 */
  refreshHead() {
    const box = $('#acct-modal'), head = box && box.querySelector('.ac-head'), tabs = box && box.querySelector('.ac-tabs');
    if (!head || !tabs || !this.me) return;
    const t = document.createElement('div');
    t.innerHTML = this.headHTML();
    head.replaceWith(t.children[0]); tabs.replaceWith(t.children[0]);
  },
  renderProfile() {
    const m = this.me; if (!m) return;
    if (this.ui.tab === 'op' && !m.role) this.ui.tab = 'rec';             // 운영자에서 해제됐으면
    this.body(`${this.headHTML()}
      <div class="ac-body" id="ac-body"><div class="muted center ac-load">불러오는 중…</div></div>`);
    const t = this.ui.tab;
    if (t === 'rec') this.renderRecords();
    else if (t === 'fr') { this.renderFriends(); this.loadFriends(); }
    clearInterval(this.frPoll); this.frPoll = null;
    if (t === 'fr') this.frPoll = setInterval(() => { if (this.ui.view === 'me' && this.ui.tab === 'fr' && !document.hidden) this.loadFriends(); }, 15000);
    else if (t === 'rank') this.renderRank();
    else if (t === 'ttl') Flair.renderTab();
    else if (t === 'op') Admin.render();
    else this.renderSettings();
  },
  async renderRecords() {
    const r = await ask('acct:profile');
    const box = $('#ac-body');
    if (!box || this.ui.tab !== 'rec') return;
    if (!r.ok) { box.innerHTML = `<p class="muted">${esc(whyText(r))}</p>`; return; }
    const m = r.me, rate = m.plays ? Math.round(100 * m.wins / m.plays) : 0;
    const multi = r.multi.sort((a, b) => b.p - a.p), solo = r.solo.sort((a, b) => b.p - a.p);
    const tile = (n, l) => `<div class="ac-tile"><b>${n}</b><small>${l}</small></div>`;
    box.innerHTML = `<div id="ac-daily-rec">${this.dailyHTML(this.me && this.me.daily)}</div>
      <div class="ac-tiles">${tile(m.plays, '멀티 판')}${tile(m.wins, '승리')}${tile(rate + '%', '승률')}${tile(m.sp, '싱글 판')}</div>
      <div class="ac-2col">
        <div><h4>${icon('users-group')}멀티 게임</h4>${multi.length ? `<div class="ac-list">${multi.map(s => `<div class="ac-row">${iconOf(s.g)}<span class="grow">${esc(multiLabel(s.g))}</span><small>${s.p}판</small><b>${s.w}승</b></div>`).join('')}</div>` : '<p class="muted small">아직 없어요. 친구와 한 판 해 보세요!</p>'}</div>
        <div><h4>${icon('robot')}싱글 게임</h4>${solo.length ? `<div class="ac-list">${solo.map(s => `<div class="ac-row">${iconOf(s.g)}<span class="grow">${esc(gameLabel(s.g))}</span><small>${s.p}판${s.w ? ` · ${s.w}승` : ''}</small><b>${s.b != null ? esc(recText(s.g, s.b)) : ''}</b></div>`).join('')}</div>` : '<p class="muted small">아직 없어요.</p>'}</div>
      </div>
      <h4>${icon('history')}최근 경기</h4>
      ${r.recent.length ? `<div class="ac-list">${r.recent.map(x => {
        const res = x.m ? (x.w ? '<span class="res win">승리</span>' : x.r ? `<span class="res">${x.r}등</span>` : '<span class="res">참가</span>')
          : (x.w ? '<span class="res win">승리</span>' : x.b ? '<span class="res best">신기록</span>' : '<span class="res">기록</span>');
        const detail = x.m ? [x.n ? `${x.n}명` : '', x.v].filter(Boolean).join(' · ') : x.v != null ? recText(x.g, x.v) : '';
        const withWho = x.m && x.with && x.with.length ? `<small class="with">${icon('users')}${x.with.map(w => esc(w.name)).join(', ')}</small>` : '';
        return `<div class="ac-row">${iconOf(x.g)}<span class="grow"><b>${esc(x.m ? multiLabel(x.g) : gameLabel(x.g))}</b> ${res}<small class="det">${esc(detail)}</small>${withWho}</span><small>${ago(x.t)}</small></div>`;
      }).join('')}</div>` : '<p class="muted small">아직 경기 기록이 없어요.</p>'}`;
  },
  renderFriends() {
    const box = $('#ac-body');
    if (!box || this.ui.tab !== 'fr') return;
    const old = $('#ac-fcode'), typed = old ? old.value : '', focused = !!old && document.activeElement === old;
    const fr = this.fr;
    if (!fr) { box.innerHTML = '<div class="muted center ac-load">불러오는 중…</div>'; return; }
    const inRoom = !!S.code;
    const row = (u, right, sub = '') => `<div class="ac-row fr"><span class="ac-who" data-act="acCard" data-uid="${esc(u.id)}" role="button" tabindex="0" title="프로필 보기">${avatarOf(u)}<span class="grow"><b>${esc(u.name)}</b> ${lvTag(u.lv)}${sub}</span></span><span class="ac-btns">${right}</span></div>`;
    const where = f => {
      if (!f.on) return `<small class="st off">오프라인${f.seen ? ' · ' + ago(f.seen) : ''}</small>`;
      if (!f.room) return f.solo ? `<small class="st on">${esc(gameLabel(f.solo))} 게임 중 (싱글)</small>` : '<small class="st on">접속 중</small>';
      return `<small class="st on">${esc(stripEmoji(f.game))} ${f.playing ? '게임 중' : '대기실'} · ${f.n}/${f.max}명</small>`;
    };
    const here = u => `<small class="st on">${u.st === 'home' ? '메뉴에 있어요' : u.st === 'solo' ? `${esc(gameLabel(u.solo || ''))} 게임 중 (싱글)` : `${esc(stripEmoji(u.game))} ${u.st === 'game' ? '게임 중' : '대기실'}`}</small>`;
    const dmBtn = (f, label) => `<button class="btn sm ${f.unread ? 'good' : ''} ${label ? '' : 'icon-only'}" data-act="acDMOpen" data-uid="${esc(f.id)}" title="귓속말">${icon('message-circle')}${label ? '귓속말' : ''}${f.unread ? `<i class="ac-dot">${f.unread}</i>` : ''}</button>`;
    const onBtn = u => (u.rel === 'friend' ? `<span class="tag frtag">친구</span>${dmBtn(this.fr.friends.find(f => f.id === u.id) || u, false)}`
      : u.rel === 'sent' ? '<span class="tag wait">신청함</span>'
        : u.rel === 'got' ? `<button class="btn sm good" data-act="acAccept" data-uid="${esc(u.id)}">수락</button>`
          : `<button class="btn sm" data-act="acAddUid" data-uid="${esc(u.id)}">${icon('user-plus')}친구 신청</button>`);
    const fbtn = f => {
      const b = [];
      if (f.on || f.unread) b.push(dmBtn(f, f.on));
      if (f.on && inRoom && f.room !== S.code) b.push(`<button class="btn sm good" data-act="acInvite" data-uid="${esc(f.id)}">${icon('send')}초대</button>`);
      if (f.room && f.room !== S.code && !f.playing && f.n < f.max) b.push(`<button class="btn sm" data-act="acJoinCode" data-code="${esc(f.room)}">${icon('door-enter')}따라가기</button>`);
      b.push(`<button class="btn sm ghost icon-only" data-act="acRemove" data-uid="${esc(f.id)}" data-name="${esc(f.name)}" title="친구 끊기">${icon('user-x')}</button>`);
      return b.join('');
    };
    box.innerHTML = `<div class="ac-add"><input type="text" id="ac-fcode" maxlength="6" placeholder="친구 코드 6자리" autocomplete="off">
        <button class="btn sm good" data-act="acAddCode">${icon('user-plus')}친구 신청</button>
        <span class="small muted">내 코드 <b class="ac-mycode" data-act="acCopyCode">${esc(fr.code)}</b></span></div>
      ${fr.reqIn.length ? `<h4>${icon('bell')}받은 신청</h4><div class="ac-list">${fr.reqIn.map(u => row(u, `<button class="btn sm good" data-act="acAccept" data-uid="${esc(u.id)}">수락</button><button class="btn sm ghost" data-act="acDecline" data-uid="${esc(u.id)}">거절</button>`)).join('')}</div>` : ''}
      <h4><i class="ac-live"></i>지금 접속 중인 회원 ${fr.onlineN || 0}명 <small class="muted">· 눌러서 바로 친구 신청</small></h4>
      ${(fr.online || []).length ? `<div class="ac-list">${fr.online.map(u => row(u, onBtn(u), here(u))).join('')}</div>`
        : '<p class="muted small">지금 접속 중인 다른 회원이 없어요.</p>'}
      ${this.me && this.me.hide ? '<p class="small muted">🙈 나는 지금 이 목록에서 숨겨져 있어요. (설정에서 바꿀 수 있어요)</p>' : ''}
      <h4>${icon('users')}친구 ${fr.friends.length}명 <small class="muted">· 접속 중 ${fr.friends.filter(f => f.on).length}명</small></h4>
      ${fr.friends.length ? `<div class="ac-list">${fr.friends.map(f => row(f, fbtn(f), where(f))).join('')}</div>`
        : '<p class="muted small">아직 친구가 없어요. 친구 코드를 받거나, 같이 게임한 사람에게 신청해 보세요.</p>'}
      ${fr.friends.length ? '<p class="small muted ac-hint">💬 접속 중인 친구에게 <b>귓속말</b>을 보낼 수 있어요. 게임 중인 친구에게는 알림 없이 조용히 전달되고, 게임이 끝나면 알려 줘요.</p>' : ''}
      ${inRoom ? '' : '<p class="small muted ac-hint">💡 방에 들어가 있으면 접속 중인 친구에게 <b>초대</b>를 보낼 수 있어요.</p>'}
      ${fr.reqOut.length ? `<h4>${icon('clock')}보낸 신청</h4><div class="ac-list">${fr.reqOut.map(u => row(u, `<button class="btn sm ghost" data-act="acCancel" data-uid="${esc(u.id)}">취소</button>`)).join('')}</div>` : ''}
      ${fr.recent.length ? `<h4>${icon('history')}최근 같이 한 사람</h4><div class="ac-list">${fr.recent.map(u => row(u, `<button class="btn sm" data-act="acAddUid" data-uid="${esc(u.id)}">${icon('user-plus')}신청</button>`)).join('')}</div>` : ''}`;
    const inp = $('#ac-fcode');
    if (inp) {
      inp.value = typed;
      if (focused) inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') ACT.acAddCode(); });
    }
  },
  /* ───────── 귓속말 ───────── */
  /** 지금 게임을 하고 있는지 (싱글 · 멀티) — 게임 중에는 귓속말 · 초대 알림을 띄우지 않아요 */
  busy() {
    if ($('#overlay').classList.contains('show')) return false;           // 결과창이면 게임이 끝난 거예요
    if (S.solo) return true;
    return !!(S.room && S.room.isStarted && S.screen && !MENU_SCREENS.has(S.screen));
  },
  /** 1초마다: 싱글 게임 중인지 서버에 알려 주고(친구에게 '게임 중'으로 보여요), 게임이 끝나면 모아 둔 알림을 보여 줘요 */
  tickBusy() {
    const b = this.busy(), g = b && S.solo ? String(S.solo) : null;
    if (socket.connected && g !== this.busyG) { this.busyG = g; socket.emit('acct:busy', { g }); }
    if (b === this.wasBusy) return;
    this.wasBusy = b;
    if (b) { this.stashCards(); if (Flair.cur) Flair.close(); }           // 게임이 시작되면 축하 화면도 닫아요
    else this.flushMissed();
  },
  /** 게임을 시작하면 떠 있던 알림 카드는 접어 둬요 (안 읽은 귓속말은 게임이 끝나면 다시 알려 줘요) */
  stashCards() {
    const box = $('#ac-invites'); if (!box) return;
    for (const el of [...box.children]) {
      if (el._dm) { const x = this.missed.get(el._dm.from.id); this.missed.set(el._dm.from.id, { ...el._dm, n: Math.max(el._dm.n, x ? x.n : 0), during: !!(x && x.during) }); }
      clearTimeout(el._t); el.remove();
    }
  },
  flushMissed() {
    const list = [...this.missed.values()].slice(-3);
    this.missed.clear();
    for (const x of list) {
      const f = this.fr && this.fr.friends.find(y => y.id === x.from.id);
      if (f && !f.unread) continue;                                        // 그사이 다른 기기에서 읽었어요
      this.dmPopup(x.from, x.x, (f && f.unread) || x.n, x.during);
    }
    const inv = this.invMissed.filter(v => Date.now() - v.at < 300000).slice(-2);
    this.invMissed = [];
    for (const v of inv) this.invited(v, true);
  },
  /** 귓속말이 왔어요 (내가 다른 기기에서 보낸 것도 와요) */
  onDM(m) {
    if (!this.me || !m || !m.from) return;
    const mine = m.f === this.me.id, peer = mine ? m.to : m.f, d = this.ui.dm;
    if (this.ui.view === 'dm' && d && d.uid === peer) {                    // 이 친구와의 대화 창을 보고 있으면 바로 보여 줘요
      this.dmAppend(m);
      if (!mine) ask('dm:read', { uid: peer });
      return;
    }
    if (mine) return;
    this.me.dm = (this.me.dm || 0) + 1;
    const f = this.fr && this.fr.friends.find(x => x.id === peer);
    if (f) f.unread = (f.unread || 0) + 1;
    this.renderBadges();
    if (this.busy()) {                                                     // 게임 중: 알림 없이 배지만 · 게임이 끝나면 알려 줘요
      const x = this.missed.get(peer);
      this.missed.delete(peer);
      this.missed.set(peer, { from: m.from, n: (x ? x.n : 0) + 1, x: m.x, during: true });
      return;
    }
    this.dmPopup(m.from, m.x, f ? f.unread : 1, false);
  },
  /** 귓속말을 읽었어요 (이 기기나 다른 기기에서) */
  onRead(d) {
    if (!this.me || !d) return;
    this.me.dm = d.total || 0;
    const f = this.fr && this.fr.friends.find(x => x.id === d.from);
    if (f) f.unread = 0;
    this.missed.delete(d.from);
    for (const el of [...($('#ac-invites') || { children: [] }).children]) if (el.dataset.dm === d.from) el.remove();
    this.renderBadges();
  },
  renderBadges() {
    this.renderChip(); this.renderHome();
    if (this.ui.view === 'me') { this.refreshHead(); if (this.ui.tab === 'fr') this.renderFriends(); }
  },
  /** 오른쪽 위 알림 카드 (같은 친구 것은 한 장으로 모아요) */
  dmPopup(from, text, n, during) {
    const box = $('#ac-invites'); if (!box || !from) return;
    let el = [...box.children].find(c => c.dataset.dm === from.id);
    if (!el) { el = document.createElement('div'); el.className = 'ac-invite wh'; el.dataset.dm = from.id; }
    el._dm = { from, n, x: text, during };
    el.innerHTML = `${avatarOf(from)}<div class="ac-inv-t"><b>${esc(from.name)}</b>님의 귓속말${n > 1 ? ` ${n}개` : ''}
        ${during ? '<small class="wh-tag">🎮 게임하는 동안 왔어요</small>' : ''}<small class="wh-pv">${esc(text)}</small></div>
      <div class="ac-inv-b"><button class="btn sm good" data-act="acDMOpen" data-uid="${esc(from.id)}">답장</button><button class="btn sm ghost" data-act="acDismiss">닫기</button></div>`;
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    clearTimeout(el._t); el._t = setTimeout(() => el.remove(), 15000);
    Sound.play('dm');
  },
  /** 친구가 접속했어요 (게임 중이면 조용히 넘어가요 · 설정에서 끌 수 있어요) */
  friendOnline(u) {
    if (!this.me || !u || u.id === this.me.id || store.get('mgFrOn', '1') === '0' || this.busy()) return;
    const box = $('#ac-invites'); if (!box) return;
    [...box.children].forEach(c => { if (c.dataset.on === u.id) c.remove(); });
    const el = document.createElement('div');
    el.className = 'ac-invite on'; el.dataset.on = u.id;
    el.innerHTML = `${avatarOf(u)}<div class="ac-inv-t"><b>${esc(u.name)}</b>님이 접속했어요 ${lvTag(u.lv)}<small>같이 한 판 어때요?</small></div>
      <div class="ac-inv-b">${S.code ? `<button class="btn sm good" data-act="acInvite" data-uid="${esc(u.id)}">${icon('send')}초대</button>` : ''}<button class="btn sm ${S.code ? 'ghost' : 'good'}" data-act="acDMOpen" data-uid="${esc(u.id)}">${icon('message-circle')}귓속말</button><button class="btn sm ghost" data-act="acDismiss">닫기</button></div>`;
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    el._t = setTimeout(() => el.remove(), 10000);
    Sound.play('friend');
  },
  /** 친구와의 귓속말 창 */
  async openDM(uid) {
    if (!this.me) return this.login();
    if (typeof uid !== 'string' || !uid) return;
    this.ui.sess++; this.stopCam();
    clearInterval(this.frPoll); this.frPoll = null;
    const f0 = this.fr && this.fr.friends.find(x => x.id === uid);
    const d = this.ui.dm = { uid, list: [], friend: f0 || { id: uid, name: '…', lv: 1, av: -1, color: 0, on: true }, loading: true };
    this.open('dm');
    this.renderDM();
    this.frPoll = setInterval(() => { if (this.ui.view === 'dm' && !document.hidden) this.loadFriends(); }, 20000);   // 친구 상태 (게임 중 · 오프라인)
    const r = await ask('dm:history', { uid });
    if (this.ui.view !== 'dm' || this.ui.dm !== d) return;
    if (!r.ok) return this.dmGone(DM_WHY[r.why] || whyText(r));
    const got = new Set(r.list.map(m => m.id));
    d.list = [...r.list, ...d.list.filter(m => !got.has(m.id))].sort((a, b) => a.id - b.id).slice(-40);
    d.friend = r.friend; d.loading = false;
    const head = $('.wh-head');
    if (head) head.outerHTML = this.dmHeadHTML();
    this.dmStatus(); this.dmLog();
    ask('dm:read', { uid });
  },
  dmHeadHTML() {
    const f = this.ui.dm.friend;
    return `<div class="wh-head"><button class="btn sm ghost icon-only" data-act="acOpen" data-tab="fr" title="친구 목록" aria-label="친구 목록으로">${icon('arrow-left')}</button>
      ${avatarOf(f)}<div class="wh-who"><b>${esc(f.name)}</b> ${lvTag(f.lv || 1)}<small id="wh-st" class="st"></small></div></div>`;
  },
  renderDM() {
    const d = this.ui.dm; if (!d) return;
    this.body(`${this.dmHeadHTML()}
      <div class="wh-log" id="wh-log"></div>
      <div class="wh-send"><input type="text" id="wh-in" maxlength="200" autocomplete="off" enterkeyhint="send" aria-label="귓속말 내용">
        <button class="btn good" id="wh-go" data-act="acDMSend">${icon('send')}보내기</button></div>
      <p class="wh-note">${icon('bell-off')}<span>게임 중인 친구에게는 알림 없이 조용히 전달되고, 게임이 끝나면 알려 줘요. 대화는 저장하지 않아서 하루가 지나거나 서버가 다시 켜지면 사라져요.</span></p>`);
    this.dmStatus(); this.dmLog();
    const inp = $('#wh-in');
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter는 무시 (마지막 글자 중복 방지)
      e.preventDefault(); ACT.acDMSend();
    });
    if (!TOUCH) setTimeout(() => { if ($('#wh-in') === inp && !inp.disabled) inp.focus(); }, 30);
  },
  /** 친구 상태 줄 · 오프라인이면 보내기 막기 */
  dmStatus() {
    const d = this.ui.dm, el = $('#wh-st'); if (!d || !el) return;
    const f = d.friend, inp = $('#wh-in'), go = $('#wh-go');
    let t, cls = 'on';
    if (d.loading) t = '불러오는 중…';
    else if (!f.on) { t = '오프라인 · 접속하면 보낼 수 있어요'; cls = 'off'; }
    else if (f.solo || (f.room && f.playing)) { t = `${f.solo ? gameLabel(f.solo) : stripEmoji(f.game)} 게임 중 · 알림 없이 조용히 전달돼요`; cls = 'on game'; }
    else if (f.room) t = `${stripEmoji(f.game)} 대기실에 있어요`;
    else t = '접속 중';
    el.className = 'st ' + cls; el.textContent = t;
    const can = !d.loading ? !!f.on : true;
    if (inp) { inp.disabled = !can; inp.placeholder = can ? `${f.name}님에게 귓속말 (최대 200자)` : '친구가 접속하면 보낼 수 있어요'; }
    if (go) go.disabled = !can;
  },
  /** 친구가 아니게 됐거나 불러오지 못했을 때 */
  dmGone(why = '이제 친구가 아니라서 귓속말을 보낼 수 없어요.') {
    const d = this.ui.dm; if (!d) return;
    d.loading = false; d.friend = { ...d.friend, on: false };
    this.dmStatus();
    const el = $('#wh-st'); if (el) { el.className = 'st off'; el.textContent = why; }
  },
  dmLog() {
    const box = $('#wh-log'), d = this.ui.dm; if (!box || !d) return;
    box.innerHTML = d.list.length ? d.list.map(m => this.dmBubble(m)).join('')
      : `<p class="wh-empty">${d.loading ? '불러오는 중…' : '아직 나눈 귓속말이 없어요.<br>먼저 인사해 보세요! 👋'}</p>`;
    box.scrollTop = box.scrollHeight;
  },
  dmBubble(m) {
    const mine = !!this.me && m.f === this.me.id;
    return `<div class="wh-msg ${mine ? 'me' : ''}"><p>${esc(m.x)}</p><small>${hhmm(m.t)}${mine && m.q ? ` · ${icon('bell-off')}조용히 전달` : ''}</small></div>`;
  },
  dmAppend(m) {
    const d = this.ui.dm; if (!d || !m || d.list.some(x => x.id === m.id)) return;
    d.list.push(m);
    if (d.list.length > 40) d.list.shift();
    this.dmLog();
  },

  async renderRank() {
    const box = $('#ac-body');
    if (!box) return;
    const k = this.ui.rankK, g = this.ui.rankG;
    const seg = (key, label) => `<button class="cat-chip ${k === key ? 'on' : ''}" data-act="acRankK" data-k="${key}">${label}</button>`;
    const head = `<div class="ac-rank-head">${seg('xp', '레벨')}${seg('wins', '멀티 승리')}${seg('friends', '친구')}${seg('solo', '싱글 기록')}
      ${k === 'solo' ? `<select id="ac-rank-g">${REC_GAMES.map(([key]) => `<option value="${key}" ${key === g ? 'selected' : ''}>${esc(gameLabel(key))}</option>`).join('')}</select>` : ''}</div>`;
    box.innerHTML = head + '<div class="muted center ac-load">불러오는 중…</div>';
    const sel = $('#ac-rank-g');
    if (sel) sel.addEventListener('change', () => { this.ui.rankG = sel.value; this.renderRank(); });
    const r = await ask('acct:rank', { k, g: k === 'solo' ? g : undefined });
    if (!$('#ac-body') || this.ui.tab !== 'rank' || this.ui.rankK !== k) return;
    const val = x => (k === 'xp' || k === 'friends' ? `${x.v.toLocaleString()} XP` : k === 'wins' ? `${x.v}승` : recText(g, x.v));
    const list = r.ok ? r.list : [];
    const medal = i => ['🥇', '🥈', '🥉'][i] || i + 1;
    $('#ac-body').innerHTML = head + (list.length
      ? `<div class="ac-list rank">${list.map((x, i) => `<div class="ac-row ${this.me && x.id === this.me.id ? 'mine' : ''}"><span class="rk">${medal(i)}</span><span class="ac-who" data-act="acCard" data-uid="${esc(x.id)}" role="button" tabindex="0" title="프로필 보기">${avatarOf(x)}<span class="grow"><b>${esc(x.name)}</b> ${lvTag(x.lv)} ${titleTag(x.tt, 'sm')}</span></span><b>${esc(val(x))}</b></div>`).join('')}</div>
        ${r.me && r.me.rank > 50 ? `<p class="small muted center">내 순위 ${r.me.rank}등 · ${esc(val({ v: r.me.v }))}</p>` : ''}`
      : `<p class="muted center">${r.ok ? '아직 기록이 없어요.' : esc(whyText(r))}</p>`);
    const sel2 = $('#ac-rank-g');
    if (sel2) sel2.addEventListener('change', () => { this.ui.rankG = sel2.value; this.renderRank(); });
  },
  renderSettings() {
    const box = $('#ac-body'), m = this.me;
    if (!box || !m) return;
    const f = this.ui.form = { mode: 'edit', av: m.av, color: m.color, name: m.name };
    const p = this.persist || {};
    box.innerHTML = `${p.cloud && p.kind === 'file' ? `<div class="ac-warn">${icon('alert-triangle')}<span>이 서버는 계정 저장용 데이터베이스가 연결되지 않았어요. 서버가 다시 시작되면 계정과 기록이 지워질 수 있어요. (서버 주인: DEPLOY.md 의 <b>계정 저장소</b> 참고)</span></div>` : ''}
      <div class="ac-set"><h4>${icon('user-circle')}프로필</h4>
        <label>닉네임<input type="text" id="ac-name" maxlength="10" value="${esc(m.name)}" autocomplete="off"></label>
        <div class="ac-avs" id="ac-avs">${this.avPicker(f)}</div><div class="ac-cols" id="ac-cols">${this.colPicker(f)}</div>
        <button class="btn sm good" data-act="acSave">${icon('check')}저장</button></div>
      <div class="ac-set"><h4>${icon('bell')}알림 · 소리</h4>
        <label class="ac-check"><input type="checkbox" data-act="acSnd" ${Sound.on ? 'checked' : ''}><span><b>알림음</b> (귓속말 · 초대 · 친구 접속 · 멀티 게임에서 내 차례)</span></label>
        <label class="ac-vol">음량 <input type="range" id="ac-vol" min="0" max="100" step="5" value="${Math.round(Sound.vol * 100)}"><button class="btn sm ghost" data-act="acSndTest">${icon('volume')}들어 보기</button></label>
        <label class="ac-check"><input type="checkbox" data-act="acFrOn" ${store.get('mgFrOn', '1') !== '0' ? 'checked' : ''}><span><b>친구 접속 알림</b> (게임 중에는 안 떠요)</span></label>
        <p class="small muted">이 기기에만 저장돼요.</p></div>
      <div class="ac-set"><h4>${icon('eye')}접속 중 목록</h4>
        <label class="ac-check"><input type="checkbox" data-act="acHide" ${m.hide ? '' : 'checked'}><span>다른 회원의 <b>지금 접속 중인 회원</b> 목록에 나를 보여 주기</span></label>
        <p class="small muted">끄면 친구가 아닌 사람에게는 접속해 있어도 안 보여요. (친구 목록에는 그대로 보여요)</p></div>
      <div class="ac-set"><h4>${icon('device-mobile')}다른 기기에서 로그인</h4>
        <p class="small muted">카메라가 없는 컴퓨터 등에서 <b>코드로 로그인</b>을 누르고 이 코드를 넣으면 돼요. (5분 동안 한 번만 쓸 수 있어요)</p>
        <div id="ac-link"><button class="btn sm" data-act="acMkCode">${icon('key')}로그인 코드 만들기</button></div></div>
      <div class="ac-set"><h4>${icon('scan')}얼굴</h4>
        <p class="small muted">로그인할 때 잘 못 알아보면 지금 모습으로 다시 등록하세요.</p>
        <button class="btn sm" data-act="acReface">${icon('camera')}얼굴 다시 등록</button></div>
      ${m.role ? `<div class="ac-set"><h4>${icon('shield-check')}운영자</h4>
        <p class="small">지금 <b>${OP_NAME[m.role]}</b>예요. <b>운영</b> 탭에서 전체 공지를 보내고 ${m.role === 'owner' ? '운영자를 지정할' : '서버 현황을 볼'} 수 있어요.</p>
        <button class="btn sm ghost" data-act="opResign">${icon('user-minus')}운영자 그만두기</button></div>`
      : `<details class="ac-set op-claim"><summary>${icon('shield')}운영자 인증</summary>
        <p class="small muted">사이트를 운영하는 사람만 써요. 서버에 설정한 운영자 키(ADMIN_KEY)를 넣으면 최고 운영자가 돼요.</p>
        <div class="op-find"><input type="password" id="op-key" maxlength="200" autocomplete="off" placeholder="운영자 키"><button class="btn sm" data-act="opClaim">${icon('key')}인증</button></div></details>`}
      <div class="ac-set"><h4>${icon('logout')}계정</h4>
        <div class="ac-btnrow"><button class="btn sm ghost" data-act="acLogout">${icon('logout')}로그아웃</button>
        <button class="btn sm bad" data-act="acDelete">${icon('trash')}회원 탈퇴</button></div>
        <p class="small muted">탈퇴하면 얼굴 특징값 · 기록 · 친구 목록이 바로 지워지고 되돌릴 수 없어요.</p></div>`;
    const vol = $('#ac-vol');
    if (vol) { vol.addEventListener('input', () => { Sound.vol = vol.value / 100; }); vol.addEventListener('change', () => Sound.play('dm')); }
  },

  /* ───────── 오늘의 미션 · 출석 ───────── */
  dailyHTML(dv, compact) {
    if (!dv || !dv.list || !dv.list.length) return '';
    const n = dv.list.filter(x => x.n >= x.goal).length;
    const item = x => {
      const done = x.n >= x.goal, pct = Math.round(100 * Math.min(1, x.n / x.goal));
      return `<div class="dl-m ${done ? 'done' : ''}"><span class="dl-ic">${done ? icon('check') : icon('target')}</span>
        <span class="dl-t"><b>${esc(x.t)}</b><span class="dl-bar"><i style="width:${pct}%"></i></span></span><span class="dl-n">${done ? '완료' : `${x.n}/${x.goal}`}<small>+${x.xp} XP</small></span></div>`;
    };
    return `<div class="ac-daily ${compact ? 'compact' : ''}">
      <div class="dl-head">${icon('calendar-check')}<b>오늘의 미션</b> <small>${n}/${dv.list.length}</small>
        ${dv.streak > 1 ? `<span class="dl-streak">${icon('flame')}${dv.streak}일 연속 출석</span>` : '<span class="dl-streak plain">출석 완료</span>'}
        <span class="dl-bonus ${dv.all ? 'got' : ''}">${icon('gift')}${dv.all ? '보너스 받음' : `모두 하면 +${dv.bonus} XP`}</span></div>
      <div class="dl-list">${dv.list.map(item).join('')}</div></div>`;
  },
  onDaily(d) {
    if (!this.me || !d) return;
    if (d.view) this.me.daily = d.view;
    if (typeof d.lv === 'number') this.me.lv = d.lv;
    if (d.checkin) toast(`📅 출석 체크! +${d.checkin.xp} XP${d.checkin.streak > 1 ? ` · ${d.checkin.streak}일 연속 🔥` : ''}`, 'good');
    if (d.done && d.done.length) {
      d.done.forEach(x => toast(`🎯 미션 완료: ${x.t} +${x.xp} XP`, 'good'));
      if (d.bonus) toast(`🎁 오늘의 미션을 모두 끝냈어요! 보너스 +${d.bonus} XP`, 'good');
      if (d.up) toast(`🎉 레벨 업! Lv.${d.lv}`, 'good');
      Sound.play('mission');
    }
    this.renderHome();
    if (this.ui.view === 'me' && this.ui.tab === 'rec') { const el = $('#ac-daily-rec'); if (el) el.innerHTML = this.dailyHTML(this.me.daily); }
  },

  /* ───────── 프로필 카드 ───────── */
  async card(uid) {
    if (typeof uid !== 'string' || !uid) return;
    this.ui.sess++; this.stopCam();
    clearInterval(this.frPoll); this.frPoll = null;
    const back = this.ui.view === 'me' ? this.ui.tab : null;
    this.open('card'); this.ui.cardBack = back;
    this.body('<div class="muted center ac-load">불러오는 중…</div>');
    const sess = this.ui.sess;
    const r = await ask('acct:card', { uid });
    if (this.ui.sess !== sess || this.ui.view !== 'card') return;
    if (!r.ok) { this.body(`<p class="muted center ac-load">${esc(whyText(r))}</p>`); return; }
    const u = r.u, w = r.where || {}, rate = u.plays ? Math.round(100 * u.wins / u.plays) : 0;
    const pct = Math.round(100 * (u.xp - u.cur) / Math.max(1, u.next - u.cur));
    const st = !w.on ? '' : w.room ? `${stripEmoji(w.game)} ${w.playing ? '게임 중' : '대기실'}` : w.solo ? `${gameLabel(w.solo)} 게임 중` : '접속 중';
    const tile = (v, l) => `<div class="ac-tile"><b>${v}</b><small>${l}</small></div>`;
    const fav = u.fav.map(f => `<div class="cd-fav">${iconOf(f.g)}<span><b>${esc(f.m ? multiLabel(f.g) : gameLabel(f.g))}</b><small>${f.m ? '멀티' : '싱글'} ${f.p}판${f.w ? ` · ${f.w}승` : ''}</small></span></div>`).join('');
    const recent = u.recent.map(x => `<div class="ac-row">${iconOf(x.g)}<span class="grow"><b>${esc(x.m ? multiLabel(x.g) : gameLabel(x.g))}</b> ${x.w ? '<span class="res win">승리</span>' : x.m && x.r ? `<span class="res">${x.r}등</span>` : x.b ? '<span class="res best">신기록</span>' : '<span class="res">참가</span>'}</span><small>${ago(x.t)}</small></div>`).join('');
    const btns = [];
    if (r.rel === 'me') btns.push(`<button class="btn sm" data-act="acOpen" data-tab="rec">${icon('user-circle')}내 정보</button>`);
    else if (this.me) {
      if (r.rel === 'friend') {
        if (w.on) btns.push(`<button class="btn sm good" data-act="acDMOpen" data-uid="${esc(u.id)}">${icon('message-circle')}귓속말</button>`);
        if (w.on && S.code && w.room !== S.code) btns.push(`<button class="btn sm" data-act="acInvite" data-uid="${esc(u.id)}">${icon('send')}초대</button>`);
        if (w.room && w.room !== S.code && !w.playing && w.n < w.max) btns.push(`<button class="btn sm" data-act="acJoinCode" data-code="${esc(w.room)}">${icon('door-enter')}따라가기</button>`);
        btns.push('<span class="tag frtag">친구</span>');
      } else if (r.rel === 'got') btns.push(`<button class="btn sm good" data-act="acAccept" data-uid="${esc(u.id)}">친구 수락</button>`);
      else if (r.rel === 'sent') btns.push('<span class="tag wait">친구 신청함</span>');
      else if (r.canAdd) btns.push(`<button class="btn sm good" data-act="acAddUid" data-uid="${esc(u.id)}">${icon('user-plus')}친구 신청</button>`);
      else btns.push('<span class="small muted">친구 코드로 신청할 수 있어요</span>');
    } else btns.push(`<button class="btn sm" data-act="acLogin">${icon('face-id')}로그인하고 친구 신청</button>`);
    if (this.me && this.me.role === 'owner' && r.rel !== 'me' && u.op !== 'owner')
      btns.push(u.op ? `<button class="btn sm ghost" data-act="opRevoke" data-uid="${esc(u.id)}" data-name="${esc(u.name)}">${icon('user-minus')}운영자 해제</button>`
        : `<button class="btn sm ghost" data-act="opGrant" data-uid="${esc(u.id)}" data-name="${esc(u.name)}">${icon('user-shield')}운영자로 지정</button>`);
    const ttls = (u.ttl || []).slice(0, 12).map(id => titleTag(id)).join('');
    this.body(`<div class="cd-head">${avatarOf(u, 'xl')}<div class="cd-t"><h2>${esc(u.name)} ${lvTag(u.lv)} ${opBadge(u.op)}</h2>
        ${u.tt ? `<div class="cd-hon">${titleTag(u.tt)}<small>${esc(Titles.TIERS[Titles.tierOf(u.lv)].n)} 테두리</small></div>` : `<div class="cd-hon"><small>${esc(Titles.TIERS[Titles.tierOf(u.lv)].n)} 테두리</small></div>`}
        <div class="xpbar"><i style="width:${pct}%"></i></div>
        <small>${st ? `<span class="st on">${esc(st)}</span>` : ''}${u.streak > 1 ? `<span class="cd-streak">${icon('flame')}${u.streak}일 연속 출석</span>` : ''}</small></div></div>
      <div class="ac-tiles">${tile(u.plays, '멀티 판')}${tile(u.wins, '승리')}${tile(rate + '%', '승률')}${tile(u.sp, '싱글 판')}</div>
      ${ttls ? `<h4>${icon('medal')}칭호 <small class="muted">${(u.ttl || []).length} / ${u.nT || Titles.LIST.length}</small></h4><div class="cd-hons">${ttls}${(u.ttl || []).length > 12 ? `<small class="muted">외 ${(u.ttl || []).length - 12}개</small>` : ''}</div>` : ''}
      ${fav ? `<h4>${icon('heart')}자주 하는 게임</h4><div class="cd-favs">${fav}</div>` : ''}
      ${recent ? `<h4>${icon('history')}최근 경기</h4><div class="ac-list">${recent}</div>` : '<p class="muted small">아직 경기 기록이 없어요.</p>'}
      <p class="small muted cd-meta">친구 ${u.friends}명 · ${new Date(u.created).toLocaleDateString('ko-KR')} 가입</p>
      <div class="cd-btns">${back ? `<button class="btn sm ghost" data-act="acOpen" data-tab="${back}">${icon('arrow-left')}돌아가기</button>` : ''}${btns.join('')}</div>`);
  },

  /* ───────── 게임 결과 · 경험치 ───────── */
  /** 결과창이 뜰 때 (core.js showResult 가 불러요) */
  onResult(d) {
    const box = $('#ov-xp'); if (!box) return;
    box.innerHTML = ''; box.className = 'ov-xp';
    if (typeof Board !== 'undefined') Board.clearMini();
    if (d.solo) {
      if (d.tut) return;                                                    // 따라 하기 판은 기록하지 않아요
      const bk = typeof Board !== 'undefined' && d.rec ? Board.keyOf(d) : '';   // 기록 게임이면 결과창에 순위 TOP 5 (board.js)
      if (!this.me) { box.innerHTML = `<button class="ac-hint-btn" data-act="acLogin">${icon('face-id')}로그인하면 기록 · 레벨이 남아요</button>`; if (bk) Board.mini(bk); return; }
      ask('acct:solo', { g: d.solo, win: d.win === true, rec: d.rec }).then(r => { if (r.ok) { this.showGain(r); this.setMe(r.me); } if (bk) Board.mini(bk, r.ok && r.best); });
      return;
    }
    if (this.gain && Date.now() - this.gain.at < 8000) this.showGain(this.gain);
    else if (!this.me) box.innerHTML = `<button class="ac-hint-btn" data-act="acLogin">${icon('face-id')}로그인하면 전적 · 레벨이 남아요</button>`;
    this.gain = null;
  },
  showGain(g) {
    const box = $('#ov-xp'); if (!box) return;
    const bits = [];
    const ring = !!g.xp && g.x0 != null && g.x1 != null && !!this.me;           // v12.2: 아바타 테두리가 차오르는 경험치
    if (g.xp && !ring) bits.push(`<b class="xp">+${g.xp} XP</b>`);
    else if (!g.xp && g.short) bits.push('<span>짧은 판이라 경험치는 없어요</span>');
    if (g.best) bits.push('<span class="best">🏅 최고 기록 갱신!</span>');
    if (g.first) bits.push('<span>📌 첫 기록 저장!</span>');
    if (g.ws >= 2) bits.push(`<span class="ws">${icon('flame')}${g.ws}연승 중</span>`);
    if (g.up && !ring) bits.push(`<span class="up">🎉 레벨 업! Lv.${g.lv}</span>`);
    if (ring) return Flair.gain(box, g, bits.join(''));
    box.innerHTML = bits.join('');
    box.classList.toggle('show', bits.length > 0);
  },

  /* ───────── 친구 초대 받기 ───────── */
  invited(d, late) {
    const box = $('#ac-invites'); if (!box || !d || !d.from) return;
    if (!late && this.busy()) {                                            // 게임 중이면 게임이 끝난 뒤에 보여 줘요
      this.invMissed = this.invMissed.filter(v => v.from.id !== d.from.id).concat({ ...d, at: Date.now() }).slice(-3);
      return;
    }
    const el = document.createElement('div');
    el.className = 'ac-invite';
    el.innerHTML = `${avatarOf(d.from)}<div class="ac-inv-t"><b>${esc(d.from.name)}</b>님이 초대했어요
      ${late ? '<small class="wh-tag">🎮 게임하는 동안 왔어요</small>' : ''}<small>${esc(stripEmoji(d.game))} · 방 ${esc(d.code)} · ${d.n}/${d.max}명${d.playing ? ' · 지금 게임 중' : ''}</small></div>
      <div class="ac-inv-b"><button class="btn sm good" data-act="acJoinCode" data-code="${esc(d.code)}">참가</button><button class="btn sm ghost" data-act="acDismiss">닫기</button></div>`;
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => el.remove(), 30000);
    Sound.play('invite');
  },
  joinRoom(code) {
    if (!/^[A-Z2-9]{4}$/.test(code)) return;
    if (S.code === code) return this.close();
    if (S.code && !confirm('지금 있는 방에서 나가고 친구가 있는 방으로 갈까요?')) return;
    if (S.solo) { stopLocal(); hideOverlay(); }
    socket.emit('joinRoom', { roomCode: code, playerName: nick() });
    this.close();
  },
};

/* ─── 화면에 자리 만들기 (상단 버튼 · 홈 카드 · 창 · 초대 알림 · 결과창 경험치) ─── */
(() => {
  const chip = document.createElement('button');
  chip.id = 'acct-chip'; chip.className = 'acct-chip'; chip.dataset.act = 'acChip';
  $('.top-right').prepend(chip);
  const home = document.createElement('div');
  home.id = 'acct-home';
  $('.nick-row').after(home);
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'acct-ov';
  ov.innerHTML = '<div class="modal acct" id="acct-modal"></div>';
  ov.addEventListener('mousedown', e => { if (e.target === ov) Acct.close(); });
  document.body.append(ov);
  const inv = document.createElement('div');
  inv.id = 'ac-invites';
  document.body.append(inv);
  const xp = document.createElement('div');
  xp.id = 'ov-xp'; xp.className = 'ov-xp';
  $('#ov-actions').before(xp);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Acct.ui.view) Acct.close(); });
  Acct.renderChip(); Acct.renderHome();
})();

/* ─── 버튼 동작 ─── */
Object.assign(ACT, {
  acChip: () => (Acct.me ? Acct.openMe() : Acct.login()),
  acOpen: el => Acct.openMe(el.dataset.tab),
  acClose: () => Acct.close(),
  acLogin: () => Acct.login(),
  acJoin: () => Acct.joinForm('join'),
  acJoinGo: () => Acct.joinGo(),
  acReface: () => Acct.joinForm('reface'),
  acCodeView: () => Acct.codeView(),
  acCodeGo: () => Acct.codeGo(),
  acTab: el => { Acct.ui.tab = el.dataset.tab; Acct.renderProfile(); },
  acRankK: el => { Acct.ui.rankK = el.dataset.k; Acct.renderRank(); },
  acPickAv: el => {
    const f = Acct.ui.form; if (!f) return;
    f.av = +el.dataset.av;
    const n = $('#ac-name'); if (n) f.name = n.value.trim();
    $('#ac-avs').innerHTML = Acct.avPicker(f);
  },
  acPickCol: el => { const f = Acct.ui.form; if (!f) return; f.color = +el.dataset.col; $('#ac-cols').innerHTML = Acct.colPicker(f); },
  acCopyCode: () => { if (Acct.me) copyText(Acct.me.code, `친구 코드를 복사했어요: ${Acct.me.code}`); },
  acSave: async () => {
    const f = Acct.ui.form, n = $('#ac-name');
    const r = await ask('acct:edit', { name: n ? n.value : undefined, av: f.av, color: f.color });
    if (!r.ok) return toast(whyText(r), 'error');
    Acct.setMe(r.me); toast('저장했어요.', 'good');
  },
  acMkCode: async () => {
    const r = await ask('acct:mkcode');
    if (!r.ok) return toast(whyText(r), 'error');
    const box = $('#ac-link'); if (!box) return;
    box.innerHTML = `<div class="ac-code-big"><small>로그인 코드</small><b>${esc(r.code.slice(0, 4))} ${esc(r.code.slice(4))}</b><small id="ac-left"></small></div>`;
    const tick = () => { const el = $('#ac-left'); if (!el) return clearInterval(t); const s = Math.max(0, Math.round((r.exp - Date.now()) / 1000)); el.textContent = s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} 남음` : '시간이 지났어요'; if (!s) clearInterval(t); };
    const t = setInterval(tick, 1000); tick();
  },
  acLogout: () => Acct.logout(),
  acDelete: async () => {
    if (!confirm('정말 탈퇴할까요?\n얼굴 특징값 · 기록 · 친구 목록이 바로 지워지고 되돌릴 수 없어요.')) return;
    const r = await ask('acct:delete', { sure: true });
    if (!r.ok) return toast(whyText(r), 'error');
    Acct.setToken(''); Acct.setMe(null); Acct.close();
    toast('탈퇴했어요. 얼굴 특징값과 기록을 모두 지웠어요.');
  },
  acAddCode: async () => {
    const i = $('#ac-fcode'), code = i ? i.value.trim().toUpperCase() : '';
    if (code.length !== 6) return toast('친구 코드 6자리를 입력해 주세요.', 'error');
    const r = await ask('fr:add', { code });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(r.friend ? `${r.friend.name}님과 친구가 됐어요!` : `${r.sent.name}님에게 친구 신청을 보냈어요.`, 'good');
    Acct.loadFriends();
  },
  acAddUid: async el => {
    const r = await ask('fr:add', { uid: el.dataset.uid });
    if (!r.ok) return toast(whyText(r), 'error');
    toast(r.friend ? `${r.friend.name}님과 친구가 됐어요!` : `${r.sent.name}님에게 친구 신청을 보냈어요.`, 'good');
    Acct.loadFriends();
  },
  acAccept: async el => { const r = await ask('fr:accept', { uid: el.dataset.uid }); if (!r.ok) return toast(whyText(r), 'error'); toast(`${r.friend.name}님과 친구가 됐어요!`, 'good'); Acct.loadFriends(); },
  acDecline: async el => { await ask('fr:decline', { uid: el.dataset.uid }); Acct.loadFriends(); },
  acCancel: async el => { await ask('fr:cancel', { uid: el.dataset.uid }); Acct.loadFriends(); },
  acRemove: async el => {
    if (!confirm(`${el.dataset.name}님과 친구를 끊을까요?`)) return;
    await ask('fr:remove', { uid: el.dataset.uid }); Acct.loadFriends();
  },
  acInvite: async el => {
    const r = await ask('fr:invite', { uid: el.dataset.uid });
    if (!r.ok) return toast(whyText(r), 'error');
    toast('초대를 보냈어요!', 'good');
    el.disabled = true; el.innerHTML = `${icon('check')}보냄`;
  },
  acInviteFriends: () => Acct.openMe('fr'),
  acHide: async el => {
    const r = await ask('acct:edit', { hide: !el.checked });
    if (!r.ok) { el.checked = !el.checked; return toast(whyText(r), 'error'); }
    Acct.setMe({ ...r.me, reqs: Acct.fr ? Acct.fr.reqIn.length : r.me.reqs });
    toast(el.checked ? '접속 중 목록에 나를 보여 줘요.' : '접속 중 목록에서 나를 숨겼어요.', 'good');
  },
  acJoinCode: el => { const c = el.closest('.ac-invite'); if (c) c.remove(); Acct.joinRoom(el.dataset.code); },
  acDismiss: el => { const c = el.closest('.ac-invite'); if (c) c.remove(); },
  acCard: el => Acct.card(el.dataset.uid),
  acSnd: el => { Sound.on = el.checked; if (el.checked) Sound.play('dm'); },
  acSndTest: () => { if (!Sound.on) { Sound.on = true; const c = $('[data-act=acSnd]'); if (c) c.checked = true; } Sound.play('invite'); },
  acFrOn: el => { store.set('mgFrOn', el.checked ? '1' : '0'); toast(el.checked ? '친구가 접속하면 알려 줄게요.' : '친구 접속 알림을 껐어요.'); },
  acDMOpen: el => { const c = el.closest('.ac-invite'); if (c) c.remove(); Acct.openDM(el.dataset.uid); },
  acDMSend: async () => {
    const d = Acct.ui.dm, inp = $('#wh-in');
    if (!d || !inp || d.sending || d.loading) return;
    const text = inp.value.replace(/\s+/g, ' ').trim();
    if (!text) { inp.focus(); return; }
    d.sending = true;
    const r = await ask('dm:send', { uid: d.uid, text });
    d.sending = false;
    if (Acct.ui.dm !== d) return;
    if (!r.ok) {
      toast(DM_WHY[r.why] || whyText(r), 'error');
      if (r.why === 'offline') { d.friend = { ...d.friend, on: false }; Acct.dmStatus(); }
      if (r.why === 'notfriend') Acct.dmGone();
      return;
    }
    const { id, name, av, color, lv } = d.friend;
    if (r.to) { d.friend = { id, name, av, color, lv, ...r.to }; Acct.dmStatus(); }
    const cur = $('#wh-in');
    if (cur) { cur.value = ''; cur.focus(); }
    Acct.dmAppend(r.msg);
  },
});

/* ─── 서버 이벤트 ─── */
socket.on('connect', () => { Acct.busyG = undefined; Acct.hello(); });
if (socket.connected) Acct.hello();                     // 이 파일이 읽히기 전에 이미 연결됐으면 바로 인사
socket.on('acct:ready', () => Acct.hello());
socket.on('acct:me', me => { if (Acct.me && me && me.id === Acct.me.id) Acct.setMe({ ...me, reqs: Acct.fr ? Acct.fr.reqIn.length : me.reqs }); });
socket.on('acct:out', d => {
  Acct.setToken(''); Acct.setMe(null);
  if (Acct.ui.view === 'me') Acct.close();
  toast(d && d.why === 'deleted' ? '계정이 삭제되어 로그아웃했어요.' : '로그아웃됐어요.');
});
socket.on('acct:gain', g => {
  Acct.gain = { ...g, at: Date.now() };
  if ($('#overlay').classList.contains('show')) { Acct.showGain(Acct.gain); Acct.gain = null; }   // 결과창이 먼저 떴으면 바로 표시
});
let frTimer = null;
socket.on('fr:ping', d => {
  if (d && d.req) toast(`👋 ${d.req.name}님이 친구 신청을 보냈어요!`, 'info');
  if (d && d.accepted) toast(`🤝 ${d.accepted.name}님과 친구가 됐어요!`, 'good');
  clearTimeout(frTimer);
  frTimer = setTimeout(() => Acct.loadFriends(), 500);
});
socket.on('fr:invited', d => Acct.invited(d));
socket.on('fr:feat', d => Flair.feat(d));                 // 친구가 새 테두리 · 칭호를 받았어요
socket.on('fr:cheered', d => Flair.cheered(d));
socket.on('dm:msg', m => Acct.onDM(m));
socket.on('acct:daily', d => Acct.onDaily(d));
socket.on('fr:online', u => Acct.friendOnline(u));
socket.on('dm:unread', d => Acct.onRead(d));
setInterval(() => Acct.tickBusy(), 1000);
setInterval(() => { if (Acct.me && $('#scr-home').classList.contains('active') && !Acct.ui.view && !document.hidden) Acct.loadFriends(); }, 30000);   // 홈 카드의 '지금 접속 중' 숫자
