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
  unknown: '같은 방에 있거나 같이 게임한 사람에게만 바로 신청할 수 있어요. 친구 코드로 신청해 주세요.',
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
const REC_GAMES = [['g2048', ''], ['fruit', ''], ['gem', ''], ['apple', ''], ['race', ''], ['mine:easy', ''], ['mine:normal', ''], ['mine:hard', ''],
  ['dodge:bullet', ''], ['dodge:bamboo', ''], ['snake', ''], ['stack', ''], ['breakout', ''], ['shisen', ''], ['rain', ''], ['mole', ''],
  ['shooter', ''], ['tetris', ''], ['zombie', ''], ['plat', ''], ['yacht', '']];

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
/** 아바타 (이모지 또는 이름 첫 글자 + 색) */
function avatarOf(u, cls = '') {
  const bg = AV_COLORS[((u && u.color) ?? 0) % AV_COLORS.length];
  const face = u && u.av >= 0 && u.av < AV_EMOJI.length ? AV_EMOJI[u.av] : esc(((u && u.name) || '?')[0]);
  return `<span class="ac-av ${cls}" style="background:${bg}">${face}</span>`;
}
const lvTag = lv => `<span class="lv">Lv.${lv}</span>`;
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
  ui: { view: null, tab: 'rec', rankK: 'xp', rankG: 'g2048', sess: 0, form: null },
  cam: null,

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
      ? `${avatarOf(m, 'sm')}<span class="ac-chip-name">${esc(m.name)}</span>${lvTag(m.lv)}${m.reqs ? `<i class="ac-dot">${m.reqs}</i>` : ''}`
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
    el.innerHTML = `<div class="ac-home">${avatarOf(m, 'lg')}
      <div class="ac-home-t"><b>${esc(m.name)}님 반가워요!</b> ${lvTag(m.lv)}
        <div class="xpbar"><i style="width:${pct}%"></i></div>
        <small>다음 레벨까지 ${(m.next - m.xp).toLocaleString()} XP · 멀티 ${m.plays}판 ${m.wins}승 · 싱글 ${m.sp}판</small></div>
      <div class="ac-home-btns">
        <button class="btn sm ghost" data-act="acOpen" data-tab="rec">${icon('chart-bar')}기록</button>
        <button class="btn sm ghost" data-act="acOpen" data-tab="fr">${icon('users')}친구${on ? `<i class="ac-on">${on}</i>` : ''}${m.reqs ? `<i class="ac-dot">${m.reqs}</i>` : ''}</button>
        <button class="btn sm ghost" data-act="acOpen" data-tab="rank">${icon('trophy')}랭킹</button></div></div>`;
  },
  /** 대기실 참가자 카드: 계정 아바타 */
  lobbyAvatar(p) {
    if (!p.uid) return null;
    return avatarOf({ name: p.name, av: p.av, color: p.color }, 'lobby');
  },
  /** 대기실 참가자 카드: 레벨 · 친구 표시 · 친구 신청 버튼 */
  lobbyTags(p) {
    if (!p.uid) return '';
    let t = `<span class="tag lvtag">Lv.${p.lv || 1}</span>`;
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
    $('#acct-modal').className = 'modal acct ' + (view === 'me' ? 'wide' : '');
  },
  close() {
    this.ui.sess++; this.ui.view = null;
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
    this.ui.sess++; this.stopCam();
    if (tab) this.ui.tab = tab;
    this.open('me');
    this.renderProfile();
  },
  headHTML() {
    const m = this.me;
    const pct = Math.round(100 * (m.xp - m.cur) / Math.max(1, m.next - m.cur));
    const tab = (k, ic, label, extra = '') => `<button class="ac-tab ${this.ui.tab === k ? 'on' : ''}" data-act="acTab" data-tab="${k}">${icon(ic)}${label}${extra}</button>`;
    return `<div class="ac-head">${avatarOf(m, 'xl')}
        <div class="ac-head-t"><h2>${esc(m.name)} ${lvTag(m.lv)}</h2>
          <div class="xpbar"><i style="width:${pct}%"></i></div>
          <small>${m.xp.toLocaleString()} XP · 다음 레벨까지 ${(m.next - m.xp).toLocaleString()} XP</small></div>
        <div class="ac-code-chip" data-act="acCopyCode" title="눌러서 복사"><small>친구 코드</small><b>${esc(m.code)}</b></div></div>
      <div class="ac-tabs">${tab('rec', 'chart-bar', '기록')}${tab('fr', 'users', '친구', m.reqs ? `<i class="ac-dot">${m.reqs}</i>` : '')}${tab('rank', 'trophy', '랭킹')}${tab('set', 'settings', '설정')}</div>`;
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
    this.body(`${this.headHTML()}
      <div class="ac-body" id="ac-body"><div class="muted center ac-load">불러오는 중…</div></div>`);
    const t = this.ui.tab;
    if (t === 'rec') this.renderRecords();
    else if (t === 'fr') { this.renderFriends(); this.loadFriends(); }
    else if (t === 'rank') this.renderRank();
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
    box.innerHTML = `<div class="ac-tiles">${tile(m.plays, '멀티 판')}${tile(m.wins, '승리')}${tile(rate + '%', '승률')}${tile(m.sp, '싱글 판')}</div>
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
    const row = (u, right, sub = '') => `<div class="ac-row fr">${avatarOf(u)}<span class="grow"><b>${esc(u.name)}</b> ${lvTag(u.lv)}${sub}</span><span class="ac-btns">${right}</span></div>`;
    const where = f => {
      if (!f.on) return `<small class="st off">오프라인${f.seen ? ' · ' + ago(f.seen) : ''}</small>`;
      if (!f.room) return '<small class="st on">접속 중</small>';
      return `<small class="st on">${esc(stripEmoji(f.game))} ${f.playing ? '게임 중' : '대기실'} · ${f.n}/${f.max}명</small>`;
    };
    const fbtn = f => {
      const b = [];
      if (f.on && inRoom && f.room !== S.code) b.push(`<button class="btn sm good" data-act="acInvite" data-uid="${esc(f.id)}">${icon('send')}초대</button>`);
      if (f.room && f.room !== S.code && !f.playing && f.n < f.max) b.push(`<button class="btn sm" data-act="acJoinCode" data-code="${esc(f.room)}">${icon('door-enter')}따라가기</button>`);
      b.push(`<button class="btn sm ghost icon-only" data-act="acRemove" data-uid="${esc(f.id)}" data-name="${esc(f.name)}" title="친구 끊기">${icon('user-x')}</button>`);
      return b.join('');
    };
    box.innerHTML = `<div class="ac-add"><input type="text" id="ac-fcode" maxlength="6" placeholder="친구 코드 6자리" autocomplete="off">
        <button class="btn sm good" data-act="acAddCode">${icon('user-plus')}친구 신청</button>
        <span class="small muted">내 코드 <b class="ac-mycode" data-act="acCopyCode">${esc(fr.code)}</b></span></div>
      ${fr.reqIn.length ? `<h4>${icon('bell')}받은 신청</h4><div class="ac-list">${fr.reqIn.map(u => row(u, `<button class="btn sm good" data-act="acAccept" data-uid="${esc(u.id)}">수락</button><button class="btn sm ghost" data-act="acDecline" data-uid="${esc(u.id)}">거절</button>`)).join('')}</div>` : ''}
      <h4>${icon('users')}친구 ${fr.friends.length}명 <small class="muted">· 접속 중 ${fr.friends.filter(f => f.on).length}명</small></h4>
      ${fr.friends.length ? `<div class="ac-list">${fr.friends.map(f => row(f, fbtn(f), where(f))).join('')}</div>`
        : '<p class="muted small">아직 친구가 없어요. 친구 코드를 받거나, 같이 게임한 사람에게 신청해 보세요.</p>'}
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
      ? `<div class="ac-list rank">${list.map((x, i) => `<div class="ac-row ${this.me && x.id === this.me.id ? 'mine' : ''}"><span class="rk">${medal(i)}</span>${avatarOf(x)}<span class="grow"><b>${esc(x.name)}</b> ${lvTag(x.lv)}</span><b>${esc(val(x))}</b></div>`).join('')}</div>
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
      <div class="ac-set"><h4>${icon('device-mobile')}다른 기기에서 로그인</h4>
        <p class="small muted">카메라가 없는 컴퓨터 등에서 <b>코드로 로그인</b>을 누르고 이 코드를 넣으면 돼요. (5분 동안 한 번만 쓸 수 있어요)</p>
        <div id="ac-link"><button class="btn sm" data-act="acMkCode">${icon('key')}로그인 코드 만들기</button></div></div>
      <div class="ac-set"><h4>${icon('scan')}얼굴</h4>
        <p class="small muted">로그인할 때 잘 못 알아보면 지금 모습으로 다시 등록하세요.</p>
        <button class="btn sm" data-act="acReface">${icon('camera')}얼굴 다시 등록</button></div>
      <div class="ac-set"><h4>${icon('logout')}계정</h4>
        <div class="ac-btnrow"><button class="btn sm ghost" data-act="acLogout">${icon('logout')}로그아웃</button>
        <button class="btn sm bad" data-act="acDelete">${icon('trash')}회원 탈퇴</button></div>
        <p class="small muted">탈퇴하면 얼굴 특징값 · 기록 · 친구 목록이 바로 지워지고 되돌릴 수 없어요.</p></div>`;
  },

  /* ───────── 게임 결과 · 경험치 ───────── */
  /** 결과창이 뜰 때 (core.js showResult 가 불러요) */
  onResult(d) {
    const box = $('#ov-xp'); if (!box) return;
    box.innerHTML = ''; box.className = 'ov-xp';
    if (d.solo) {
      if (!this.me) { box.innerHTML = `<button class="ac-hint-btn" data-act="acLogin">${icon('face-id')}로그인하면 기록 · 레벨이 남아요</button>`; return; }
      ask('acct:solo', { g: d.solo, win: d.win === true, rec: d.rec }).then(r => { if (r.ok) { this.showGain(r); this.setMe(r.me); } });
      return;
    }
    if (this.gain && Date.now() - this.gain.at < 8000) this.showGain(this.gain);
    else if (!this.me) box.innerHTML = `<button class="ac-hint-btn" data-act="acLogin">${icon('face-id')}로그인하면 전적 · 레벨이 남아요</button>`;
    this.gain = null;
  },
  showGain(g) {
    const box = $('#ov-xp'); if (!box) return;
    const bits = [];
    if (g.xp) bits.push(`<b class="xp">+${g.xp} XP</b>`);
    else if (g.short) bits.push('<span>짧은 판이라 경험치는 없어요</span>');
    if (g.best) bits.push('<span class="best">🏅 최고 기록 갱신!</span>');
    if (g.first) bits.push('<span>📌 첫 기록 저장!</span>');
    if (g.up) bits.push(`<span class="up">🎉 레벨 업! Lv.${g.lv}</span>`);
    box.innerHTML = bits.join('');
    box.classList.toggle('show', bits.length > 0);
  },

  /* ───────── 친구 초대 받기 ───────── */
  invited(d) {
    const box = $('#ac-invites'); if (!box || !d || !d.from) return;
    const el = document.createElement('div');
    el.className = 'ac-invite';
    el.innerHTML = `${avatarOf(d.from)}<div class="ac-inv-t"><b>${esc(d.from.name)}</b>님이 초대했어요
      <small>${esc(stripEmoji(d.game))} · 방 ${esc(d.code)} · ${d.n}/${d.max}명${d.playing ? ' · 지금 게임 중' : ''}</small></div>
      <div class="ac-inv-b"><button class="btn sm good" data-act="acJoinCode" data-code="${esc(d.code)}">참가</button><button class="btn sm ghost" data-act="acDismiss">닫기</button></div>`;
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => el.remove(), 30000);
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
  acJoinCode: el => { const c = el.closest('.ac-invite'); if (c) c.remove(); Acct.joinRoom(el.dataset.code); },
  acDismiss: el => { const c = el.closest('.ac-invite'); if (c) c.remove(); },
});

/* ─── 서버 이벤트 ─── */
socket.on('connect', () => Acct.hello());
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
