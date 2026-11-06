/* =====================================================================
 *  미니게임 천국 — 공통 기능 (core.js)
 *  화면 전환 · 소켓 연결 · 대기실 · 채팅 · 결과창 · 게임 등록소
 *  게임마다 js/게임이름.js 파일이 따로 있고, register() 로 여기에 등록됩니다.
 * ===================================================================== */
'use strict';
/* =====================================================================
 *  공통 도구
 * ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
const rand = n => Math.floor(Math.random() * n);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const secLeft = end => Math.max(0, Math.ceil((end - Date.now()) / 1000));
/** performance.now() 기준 마감 시각까지 남은 초 (새 게임들이 사용) */
const leftSec = end => Math.max(0, Math.ceil((end - performance.now()) / 1000));
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

/** 같은 시드면 같은 순서로 나오는 난수 (멀티에서 모두 같은 판을 만들 때) */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** 매 프레임 fn(dt초, now) 실행 — 화면을 나가거나 다른 게임을 시작하면(stopLocal) 자동으로 멈춤 */
function gameLoop(fn) {
  const gen = S.gen;
  let last = performance.now();
  const f = now => {
    if (gen !== S.gen) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    fn(dt, now);
    if (gen === S.gen) S.raf = requestAnimationFrame(f);
  };
  S.raf = requestAnimationFrame(f);
}
/** 화면에 늘어난 캔버스에서 마우스 위치를 캔버스 좌표로 */
function cvPoint(cv, e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }

// 화면이 바뀌면 한꺼번에 정리되는 타이머
const S = { myId: null, code: null, room: null, scores: [], solo: null, serverInfo: null, timers: new Set(), raf: null, gen: 0 };

/* 게임 등록소: 각 게임 파일(js/*.js)이 register('화면이름', { solo, stop, key }) 로 자신을 등록합니다. */
const Games = {};
function register(key, def) { Games[key] = def; }
function every(ms, fn) { const t = setInterval(fn, ms); S.timers.add(t); return t; }
function after(ms, fn) { const t = setTimeout(() => { S.timers.delete(t); fn(); }, ms); S.timers.add(t); return t; }
function stopLocal() {
  S.timers.forEach(t => { clearInterval(t); clearTimeout(t); }); S.timers.clear();
  if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
  S.gen++; S.solo = null;
  Object.values(Games).forEach(g => g.stop && g.stop());
}

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
  S.screen = id;
  if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();   // 스페이스가 버튼을 다시 누르지 않게
  if (typeof updatePad === 'function') updatePad();
  document.body.classList.toggle('in-room', !!S.code);
  document.body.classList.toggle('in-solo', !!S.solo);                         // 싱글로 하는 중 (순위 버튼 · board.js)
  document.body.classList.toggle('tarea', typeof TouchArea !== 'undefined' && !!TouchArea.on[id]);   // 화면을 끌어도 페이지가 움직이지 않게
  window.scrollTo({ top: 0 });
  if (typeof RoomList !== 'undefined') { if (id === 'multi') RoomList.start(); else RoomList.stop(); }
  if (typeof Manual !== 'undefined') Manual.seen(id);                 // 처음 하는 게임이면 설명서 안내
  if (typeof Fit !== 'undefined') {
    const gaming = !MENU_IDS.has(id);                // 게임 화면 스타일은 바로 걸어요 (게임이 처음 그릴 때부터 맞는 크기로)
    document.body.classList.toggle('gaming', gaming);
    if (!gaming) document.body.classList.remove('chat-open', 'pad-side');
    Fit.schedule(); setTimeout(() => Fit.schedule(), 160); setTimeout(() => Fit.schedule(), 700);   // 게임이 화면을 그린 다음에 맞춰요
  }
}
const isScreen = id => S.screen === id;

/* ─── 게임 화면을 한 화면에 맞추기 (휴대폰 · 갤럭시 폴드 · 태블릿 · 노트북) ───
 *  1) 게임 화면에서는 위쪽 막대 · 제목 줄을 작게 (style.css 의 body.gaming)
 *  2) 그림판(캔버스)이 있으면 남는 높이에 맞게 줄이고
 *  3) 그래도 넘치면 화면 전체를 비율대로 줄여요 (너비는 넓혀서 다시 배치하니 글자가 덜 작아져요)
 *  4) 반대로 자리가 남으면 게임 캔버스를 키워요 (폴드 펼친 화면 · 태블릿 · 큰 모니터에서 판이 작게 남지 않게: grow)
 *  5) 캔버스가 없는 화면(카드 · 보드게임)은 화면 전체를 비율대로 키워요 (zoomUp: 터치 화면 최대 1.5배 · 마우스 1.3배)
 *  게임 내용이 바뀌어 넘치게 되면 0.4초 안에 다시 맞춰요. */
const MENU_IDS = new Set(['home', 'single', 'multi', 'lobby']);
var Fit = {
  ZMIN: 0.5, cur: null, raf: 0, last: null, timer: null,
  now() { cancelAnimationFrame(this.raf); this.raf = 0; this.fit(); },
  schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.fit(); }); },
  reset(sec) { sec.style.zoom = ''; sec.style.width = ''; sec.style.margin = ''; sec.style.removeProperty('--cv-h'); sec.style.removeProperty('--avail-h'); sec.style.removeProperty('--pad-side'); sec.style.removeProperty('--cv-grow'); sec.classList.remove('cv-grow'); delete sec.dataset.z; },
  /** 키워도 되는 게임 캔버스 (그림판 · 카트 · 작은 캔버스는 빼고) */
  GROW: '.game-cv, #tetris-cv, #snake-cv, #pong-cv, #omok-cv',
  /** 자리가 남으면 캔버스를 키워요: 캔버스 높이(--cv-grow)를 이분 탐색 — 화면을 넘지 않는 가장 큰 값 (6% 넘게 커질 때만) */
  grow(sec, H, fits) {
    const cvs = [...sec.querySelectorAll(this.GROW)].filter(c => c.offsetHeight >= 120 && c.offsetParent && !c.closest('.no-fit, .no-grow'));
    if (!cvs.length) return false;
    const h0 = Math.max(...cvs.map(c => c.getBoundingClientRect().height));
    for (const c of cvs) c.style.setProperty('--ar', (c.width / Math.max(1, c.height)).toFixed(4));
    const set = v => sec.style.setProperty('--cv-grow', Math.floor(v) + 'px');
    sec.classList.add('cv-grow');
    let lo = h0, hi = Math.max(h0, H);
    set(hi);
    if (!fits()) {
      set(lo);
      if (!fits()) lo = 0;
      else for (let i = 0; i < 9 && hi - lo > 2; i++) { const m = (lo + hi) / 2; set(m); if (fits()) lo = m; else hi = m; }
      if (lo < h0 * 1.06) { sec.classList.remove('cv-grow'); sec.style.removeProperty('--cv-grow'); return true; }
      set(lo);
    }
    return true;
  },
  /** 화면 전체 키우기: 내용이 남는 높이의 86%도 안 차면, 너비를 줄여(W/z) 다시 배치하면서 z배로 — 남는 높이의 93% 안에서 가장 크게 (조금 늘어나도 바로 다시 맞추지 않게) */
  zoomUp(sec, H, W) {
    if (sec.dataset.fitOverflow === 'ok' || sec.dataset.fitSelf || this.visH(sec) > H * 0.86) return;   // fitSelf: 판 크기를 스스로 재는 화면 (체스 · 스도쿠 · 노노그램 · 세계여행)
    // 다시 배치되는 너비(W/z)가 640px 아래로 내려가지 않게 (휴대폰 · 접은 화면은 키우지 않아요: 이미 맞춰 둔 배치가 깨지지 않게)
    const ZMAX = Math.min(matchMedia('(pointer:coarse)').matches ? 1.5 : 1.3, W / 640);
    if (ZMAX < 1.06) return;
    // 제목 줄의 「나가기」 버튼이 아랫줄로 떨어지지 않는 만큼만 (버튼 하나만 아래로 떨어지면 지저분해요)
    const head = sec.querySelector('.game-head'), leave = head && head.querySelector('[data-act=leaveGame]'), title = head && head.querySelector('.gh-title');
    const sameRow = () => leave.getBoundingClientRect().top < title.getBoundingClientRect().bottom - 4;
    const row0 = !!(leave && title) && sameRow();
    const headOk = () => !row0 || sameRow();
    const ok = () => this.visH(sec) <= H * 0.93 && sec.scrollWidth <= sec.clientWidth + 1 && headOk();
    let lo = 1, hi = ZMAX;
    this.zoom(sec, hi, W / hi);
    if (ok()) lo = hi;
    else for (let i = 0; i < 7; i++) { const z = (lo + hi) / 2; this.zoom(sec, z, W / z); if (ok()) lo = z; else hi = z; }
    lo = Math.floor(lo * 0.96 * 100) / 100;                       // 4% 여유: 시간 · 점수 글자가 바뀌어 조금 넓어져도 버튼이 아랫줄로 떨어지지 않게
    if (lo < 1.06) { sec.style.zoom = ''; sec.style.width = ''; delete sec.dataset.z; return; }
    this.zoom(sec, lo, W / lo); sec.style.margin = '0 auto';
  },
  fit() {
    const sec = document.querySelector('.screen.active');
    const gaming = !!sec && !MENU_IDS.has(sec.id.replace(/^scr-/, ''));
    document.body.classList.toggle('gaming', gaming);
    if (!gaming) document.body.classList.remove('chat-open', 'pad-side');
    if (this.cur && this.cur !== sec) { this.reset(this.cur); this.cur = null; }
    if (!gaming) { clearInterval(this.timer); this.timer = null; this.watch(null); return; }
    this.cur = sec;
    this.apply(sec);
    this.watch(sec);
    if (!this.timer) this.timer = setInterval(() => this.check(), 400);
  },
  /** 게임 화면의 글 · 요소가 바뀌면 다음 프레임에 바로 확인 (0.4초 간격 확인을 기다리지 않게) */
  watch(sec) {
    if (typeof MutationObserver === 'undefined') return;
    if (!this.mo) this.mo = new MutationObserver(() => {      // 다음 프레임 · 0.15초 · 0.35초 뒤에 (나타나는 효과가 끝난 뒤까지)
      if (!this.mraf) this.mraf = requestAnimationFrame(() => { this.mraf = 0; this.check(); });
      clearTimeout(this.mt1); clearTimeout(this.mt2);
      this.mt1 = setTimeout(() => this.check(), 150); this.mt2 = setTimeout(() => this.check(), 350);
    });
    if (this.moSec === sec) return;
    this.mo.disconnect(); this.moSec = sec;
    if (sec) this.mo.observe(sec, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  },
  /** 남는 높이 (위쪽 막대 · 여백 · 휴대폰 가상 패드 빼고) */
  room(sec) {
    const top = sec.getBoundingClientRect().top + window.scrollY - (sec.dataset.z ? 0 : 0);
    const pad = document.getElementById('vpad');
    const padH = pad && !pad.classList.contains('hidden') && !document.body.classList.contains('pad-side') ? pad.getBoundingClientRect().height + 18 : 0;
    const shellB = parseFloat(getComputedStyle(sec.parentElement.parentElement).paddingBottom) || 0;
    return Math.max(200, Math.floor(window.innerHeight - top - shellB - padH) - 1);   // 1px 여유 (소수점 반올림으로 1px 넘치지 않게)
  },
  /** 가로로 긴 터치 화면 (휴대폰 가로 · 태블릿 가로): 가상 패드는 양옆 아래에 두고, 게임은 그 사이에서 세로를 다 써요 → 양옆 여백(px) */
  side() {
    const pad = document.getElementById('vpad'), g = Games[S.screen];
    const on = !!pad && !pad.classList.contains('hidden') && !(g && g.padSide === false) && window.innerWidth >= window.innerHeight * 1.25;
    document.body.classList.toggle('pad-side', on);
    if (!on) return 0;
    return Math.ceil([...pad.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().width), 0)) + 22;
  },
  apply(sec) {
    this.reset(sec);
    const side = this.side();
    if (side) sec.style.setProperty('--pad-side', side + 'px');
    const W = sec.parentElement.clientWidth, H = this.room(sec);
    sec.style.setProperty('--avail-h', Math.floor(H) + 'px');
    // 화면 높이 · 너비 안에 들어오는지 (높이를 정해 둔 화면은 안에서 넘친 내용까지: visH)
    const fits = () => this.visH(sec) <= H + 1 && sec.scrollWidth <= sec.clientWidth + 1;
    let ok = fits();
    const roomy = ok;
    if (!ok) {                                                   // 1) 그림판은 높이에 맞게
      const cvs = [...sec.querySelectorAll('canvas')].filter(c => c.offsetHeight >= 120 && c.offsetParent && !c.closest('.no-fit'));
      if (cvs.length) {
        const span = this.span(cvs), total = sec.getBoundingClientRect().height;
        const cvH = Math.max(H * 0.42, H - (total - span) - 2);
        if (cvH < span) sec.style.setProperty('--cv-h', Math.floor(cvH) + 'px');
        ok = fits();
      }
    }
    if (!ok) {
      // 2-가) 배치는 그대로 두고 비율만 줄이기 — 한 번만 재면 돼서 빨라요 (조금만 넘칠 때는 이걸로)
      sec.style.zoom = ''; sec.style.width = W + 'px';
      const zb = Math.max(this.ZMIN, Math.floor(Math.min(1, H / Math.max(1, sec.offsetHeight, sec.scrollHeight), W / Math.max(1, sec.scrollWidth)) * 100) / 100);
      // 2-나) 많이 줄여야 하면 너비를 넓혀 다시 배치하는 쪽도 재 봐요 (글 · 버튼이 많은 화면은 덜 작아져요)
      let za = 0;
      if (zb < 0.9) {
        let lo = this.ZMIN, hi = 1;
        for (let i = 0; i < 7; i++) { const z = (lo + hi) / 2; this.zoom(sec, z, W / z); if (fits()) lo = z; else hi = z; }
        lo = Math.floor(lo * 100) / 100;
        this.zoom(sec, lo, W / lo);
        za = fits() ? lo : 0;
      }
      if (za && za >= zb) this.zoom(sec, za, W / za);
      else { this.zoom(sec, zb, W); sec.style.margin = '0 auto'; }
    }
    if (roomy && !this.grow(sec, H, fits)) this.zoomUp(sec, H, W); // 4) 자리가 남으면 캔버스를 · 5) 없으면 화면 전체를 키워요
    this.last = { sec, h: sec.offsetHeight, w: sec.scrollWidth, vis: this.visH(sec), H, W, iw: window.innerWidth, ih: window.innerHeight };
    if (typeof Stick !== 'undefined' && Stick.g) Stick.layout();               // 조이스틱 자리도 바뀐 화면에 맞게 (stick.js)
  },
  /** 화면에 보이는 높이 — 화면 상자보다 내용이 넘쳤으면 내용까지 (zoom 비율 반영) */
  visH(sec) {
    const r = sec.getBoundingClientRect(), k = r.height / Math.max(1, sec.offsetHeight);
    if (sec.dataset.fitOverflow === 'ok') return r.height;                 // 일부러 넘치게 둔 화면 (카트)
    return Math.max(r.height, sec.scrollHeight * k);
  },
  zoom(sec, z, w) { sec.style.zoom = z; sec.style.width = w + 'px'; sec.dataset.z = z; },
  /** 캔버스들이 차지하는 세로 길이 (나란히 있으면 한 번만) */
  span(cvs) {
    const iv = cvs.map(c => { const r = c.getBoundingClientRect(); return [r.top, r.bottom]; }).sort((a, b) => a[0] - b[0]);
    let sum = 0, [a, b] = iv[0];
    for (const [x, y] of iv.slice(1)) { if (x > b) { sum += b - a; a = x; b = y; } else b = Math.max(b, y); }
    return sum + (b - a);
  },
  /** 게임 내용이 바뀌어서 넘치거나 · 많이 줄었으면 다시 맞추기 */
  check() {
    const L = this.last, sec = this.cur;
    if (!sec || !L || L.sec !== sec || document.hidden) return;
    if (window.innerWidth !== L.iw || window.innerHeight !== L.ih) return this.kbd() ? undefined : this.schedule();
    const vis = this.visH(sec);
    if (vis > L.H + 2 || sec.scrollWidth > sec.clientWidth + 1) return this.schedule();
    // 줄여 둔 상태에서 내용이 줄었으면 (글꼴 로드 · 안내 문구 변화 등) 다시 맞춰서 크게 — 맞춘 뒤 높이와 비교하니 같은 결과로 되풀이되지 않아요
    if ((sec.dataset.z || sec.style.getPropertyValue('--cv-h')) && L.vis - vis > Math.max(6, L.H * 0.015)) this.schedule();
  },
  /** 휴대폰에서 글자 칸을 눌러 키보드가 올라온 것 (높이만 줄었음) → 화면을 다시 줄이지 않아요 */
  kbd() {
    const L = this.last, a = document.activeElement;
    if (!L || !a || !matchMedia('(pointer:coarse)').matches) return false;
    const typing = a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|color|file)$/i.test(a.type || ''));
    return typing && window.innerWidth === L.iw && window.innerHeight < L.ih - 100;
  },
};
window.addEventListener('resize', () => { if (!Fit.kbd()) Fit.schedule(); });
/** 정사각형 판(체스 · 스도쿠)을 남은 높이 · 너비에 딱 맞게: 판 크기(name, px)를 이분 탐색으로 정해요.
 *  (CSS 에서 min(100%, …) 로 정하면 글자 크기 · 그림자처럼 %가 다르게 풀리는 곳에서 틀어져서, 숫자로 넣어요) */
function fitSquare(sec, wrap, name, lo = 220, hi = 720) {
  if (!sec || !wrap || !sec.classList.contains('active')) return 0;
  const z = +(sec.dataset.z || 1) || 1;
  const room = typeof Fit !== 'undefined' && Fit.room ? Fit.room(sec) : window.innerHeight - sec.getBoundingClientRect().top;
  const H = Math.floor(room - (wrap.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z - 3);
  const fits = v => { sec.style.setProperty(name, v + 'px'); return wrap.offsetHeight <= H && wrap.scrollWidth <= wrap.clientWidth + 1; };
  if (fits(hi)) return hi;
  if (!fits(lo)) return lo;                                  // 아주 작은 화면: 가장 작게 (나머지는 Fit 이 줄여요)
  let a = lo, b = hi;
  while (b - a > 1) { const m = (a + b) >> 1; if (fits(m)) a = m; else b = m; }
  sec.style.setProperty(name, a + 'px');
  return a;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => Fit.schedule());
window.addEventListener('orientationchange', () => setTimeout(() => Fit.schedule(), 200));

/** 게임 화면 만들기: 새 게임 파일은 index.html 대신 이 함수로 자기 화면을 만듭니다.
 *  stats: [['score', '점수'], ...] → #게임-score 에 값 표시 (setStat) */
/** 제목 맨 앞의 이모지 떼기 ('🎓 인생 보드게임' → '인생 보드게임') */
const stripEmoji = t => { const m = String(t).match(/^(\S+)\s+(.+)$/); return m && !/[\p{L}\p{N}]/u.test(m[1]) ? m[2] : String(t); };
const catOf = id => (GAME_INFO[id] && GAME_INFO[id].cat) || (SOLO_GAMES.find(g => g[0] === id) || [])[5] || '';
function makeScreen(id, { title, status = '', stats = [], body = '' }) {
  title = `${gameIcon(id, catOf(id), 'sm')}<span class="tt">${stripEmoji(title)}</span>`;
  const sec = document.createElement('section');
  sec.className = 'screen'; sec.id = 'scr-' + id;
  sec.innerHTML = `<div class="game-head"><div class="gh-title"><h2 id="${id}-title">${title}</h2><div class="status" id="${id}-status">${status}</div></div>
    <div class="stats">${stats.map(([k, label]) => `<div class="stat" id="${id}-${k}-box"><small id="${id}-${k}-label">${label}</small><b id="${id}-${k}">-</b></div>`).join('')}</div>
    <button class="btn ghost" data-act="leaveGame">나가기</button></div>
    <div class="scorebar" data-scores></div>${body}`;
  $('#main').append(sec);
  return sec;
}
const setStat = (id, k, v) => { const el = document.getElementById(`${id}-${k}`); if (el) el.textContent = v; };
const setStatus = (id, msg) => { const el = document.getElementById(`${id}-status`); if (el) el.textContent = msg; };

/* ─── 키보드 상태: e.code 로 기억해서 한글 입력 상태에서도 WASD가 동작 ─── */
const Keys = new Set();
const held = (...codes) => codes.some(c => Keys.has(c));
const typing = () => { const t = document.activeElement && document.activeElement.tagName; return t === 'INPUT' || t === 'TEXTAREA'; };
window.addEventListener('blur', () => Keys.clear());

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 2800);
}

/* ─── 테마 (기본 다크) ─── */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#theme-btn').innerHTML = t === 'dark' ? '☀️<span class="tb-t"> 라이트 모드</span>' : '🌙<span class="tb-t"> 다크 모드</span>';
  store.set('theme', t);
}
applyTheme(store.get('theme', 'dark'));

/* ─── 게임 정보 (cat = 메뉴 분류) ─── */
const CATS = ['전체', '액션', '퍼즐', '보드·카드', '파티'];
const GAME_INFO = {
  seotda: { icon: '🎴', name: '섯다', desc: '화투로 한 장씩 받으며 베팅', cat: '보드·카드', players: '2~6명',
    rules: '<b>진행</b> 한 장씩 받으며 다이·콜·삥·쿼터·하프·올인으로 베팅해요. 이긴 사람이 다음 판 선!<br><b>족보</b> 38광땡 > 18·13광땡 > 장땡~1땡 > 알리 > 독사 > 구삥 > 장삥 > 장사 > 세륙 > 갑오(9끗) … 망통(0끗)<br><b>특수</b> 땡잡이(3광+7열끗)는 1~9땡을, 암행어사(4·7열끗)는 13·18광땡을 잡아요. 구사(4+9)는 상대가 알리 이하면 재경기!<br><b>자금</b> 기본 100만원 · 판돈 5천원 · 누군가 0원이 되면 대기실로' },
  poker: { icon: '🃏', name: '포커', desc: '5장 · 7장 스터드 포커', cat: '보드·카드', players: '2~6명',
    rules: '<b>5장 포커</b> 히든 1장+오픈 1장으로 시작해 한 장씩 오픈, 총 4번 베팅.<br><b>7장 포커</b> 히든 2장+오픈 1장 → 오픈 3장 → 마지막 히든 1장, 7장 중 가장 좋은 5장으로 승부.<br><b>족보</b> 로티플 > 스티플 > 포카드 > 풀하우스 > 플러시 > 스트레이트 > 트리플 > 투페어 > 원페어 > 탑<br><b>자금</b> 기본 100만원 · 판돈 5천원 · 누군가 0원이 되면 대기실로' },
  apple: { icon: '🍎', name: '사과 게임', desc: '합이 10이 되게 드래그', cat: '퍼즐', players: '1~8명',
    rules: '모두 같은 판으로 2분 동안 대결! 드래그로 사각형을 그려 <b>숫자 합이 정확히 10</b>이면 사과를 딸 수 있어요. 딴 사과 개수가 점수.' },
  race: { icon: '⏱️', name: '1 to 50', desc: '1부터 50까지 가장 빨리', cat: '퍼즐', players: '1~8명',
    rules: '1부터 순서대로 누르면 그 자리에 26~50이 나타나요. <b>50까지 가장 먼저</b> 누른 사람이 우승!' },
  catch: { icon: '🎨', name: '캐치마인드', desc: '그림 그리고 맞히기', cat: '파티', players: '2~8명',
    rules: '한 명씩 돌아가며(각자 2번) 제시어를 그려요. 나머지는 <b>채팅창에 정답</b>을 입력! 맞힌 사람 +10점, 그린 사람 +5점.' },
  liar: { icon: '🤫', name: '라이어 게임', desc: '한 붓씩 그리며 라이어 찾기', cat: '파티', players: '3~8명',
    rules: '라이어만 제시어를 몰라요(주제는 앎). 돌아가며 한 붓씩 그린 뒤 투표! 라이어가 1등으로 지목되면 마지막 기회로 제시어를 맞혀야 해요.' },
  tetris: { icon: '🧱', name: '테트리스 배틀', desc: '줄을 지워 상대 공격', cat: '액션', players: '2~8명',
    rules: '2줄 이상 지우면 상대에게 방해 줄을 보내요(테트리스=4줄). <b>마지막까지 살아남은 사람</b>이 우승!' },
  omok: { icon: '⚫', name: '오목', desc: '1:1 대결 · 관전 가능', cat: '보드·카드', players: '2명 + 관전',
    rules: '흑·백 자리에 한 명씩 앉아야 시작할 수 있어요. 나머지는 관전석에서 구경!' },
  pong: { icon: '🏓', name: '4인 핑퐁', desc: '사방에서 공을 막아라', cat: '액션', players: '2~4명 + 관전',
    rules: '위·아래·왼쪽·오른쪽 자리를 골라 앉아요. 목숨 5개, 공을 놓치면 하나씩 깎여요. <b>마지막 생존자</b> 우승! 빈 자리는 벽이 됩니다.' },
  snake: { icon: '🐍', name: '스네이크 배틀', desc: '부딪히면 탈락! 마지막 뱀이 승리', cat: '액션', players: '2~8명',
    rules: '방향키(WASD)로 내 뱀을 조종해요. <b>벽·다른 뱀 몸</b>에 부딪히면 탈락, 머리끼리 부딪히면 둘 다 탈락! 쓰러진 뱀은 먹이가 돼요. 마지막 생존자 또는 3분 뒤 가장 긴 뱀이 우승.' },
  rain: { icon: '☔', name: '산성비 타자 대결', desc: '떨어지는 단어를 먼저 치기', cat: '파티', players: '1~8명',
    rules: '모두에게 <b>같은 단어</b>가 내려요. 단어를 입력하고 Enter! 먼저 친 사람이 글자 수×10점을 가져가요. 2분 동안 점수가 가장 높은 사람이 우승.' },
  mine: { icon: '💣', name: '지뢰찾기 대결', desc: '같은 판을 누가 먼저 다 열까', cat: '퍼즐', players: '1~8명',
    rules: '모두 <b>같은 16×16 판</b>(지뢰 40개)으로 시작해요. 지뢰를 밟으면 탈락! 먼저 모든 칸을 연 사람이 우승, 아무도 못 하면 가장 많이 연 사람이 이겨요. 오른쪽 클릭 = 깃발.' },
  g2048: { icon: '🔢', name: '2048 대결', desc: '3분 동안 점수 대결', cat: '퍼즐', players: '1~8명',
    rules: '방향키로 타일을 밀어 같은 숫자를 합쳐요. <b>3분 동안 점수</b>가 가장 높은 사람이 우승! 판이 꽉 막히면 그 점수로 끝나요.' },
  bingo: { icon: '🎱', name: '빙고', desc: '돌아가며 숫자 부르기', cat: '보드·카드', players: '2~6명',
    rules: '시작하면 12초 동안 내 판을 섞을 수 있어요. 그다음 돌아가며 <b>내 판에서 숫자를 골라 부르면</b> 모두에게 표시돼요. 먼저 <b>3줄</b>을 완성하면 승리! (20초 안에 못 고르면 자동)' },
  dodge: { icon: '🎯', name: '총알피하기 배틀', desc: '사방에서 날아오는 총알, 끝까지 버텨라', cat: '액션', players: '2~8명',
    rules: '모두 한 경기장에서 총알을 피해요. 방향키(WASD)나 마우스 드래그로 움직이고, <b>총알에 맞으면 탈락</b>! 시간이 지날수록 총알이 많아져요. 마지막까지 살아남은 사람이 우승.' },
  plat: { icon: '🏃', name: '점프 레이스', desc: '같은 스테이지를 누가 먼저 통과할까', cat: '액션', players: '1~8명',
    rules: '모두 <b>같은 횡스크롤 스테이지</b>를 달려요. ←→ 이동, ↑·스페이스 점프, 적은 밟아서 처치! 떨어지면 체크포인트에서 다시 시작해요. 가장 먼저 🏁 골에 도착한 사람이 우승 (제한 3분).' },
  volley: { icon: '🏐', name: '점프 배구', desc: '1:1 점프 배구 · 관전 가능', cat: '액션', players: '2명 + 관전',
    rules: '왼쪽·오른쪽 자리에 한 명씩 앉아요. ←→ 이동, ↑ 점프, <b>공중에서 스페이스(Enter) = 스파이크</b> (방향키로 방향 조절), 땅에서 누르면 슬라이딩! 공이 상대 코트 바닥에 닿으면 1점, <b>15점</b>을 먼저 내면 승리.' },
  bomb: { icon: '💥', name: '폭탄 배틀', desc: '폭탄으로 길을 뚫고 상대를 잡아라', cat: '액션', players: '2~6명',
    rules: '방향키로 움직이고 <b>스페이스로 폭탄</b>을 놓아요. 폭탄은 십자 모양으로 터지며 상자를 부숴요. 상자에서 나오는 아이템: 💣 폭탄 개수 · 🔥 화력 · 👟 속도. 폭발에 맞으면 탈락! 마지막 생존자가 우승.' },
  tank: { icon: '🛡️', name: '탱크 대포', desc: '각도와 힘을 맞춰 포탄 발사!', cat: '액션', players: '2~6명',
    rules: '내 차례에 ←→ 이동(연료 제한), ↑↓ 각도, <b>스페이스를 꾹 눌렀다 떼면 발사</b> (오래 누를수록 세게). 바람을 꼭 보세요! 포탄은 땅을 파고 근처 탱크에 피해를 줘요. 마지막까지 남은 탱크가 우승.' },
  onecard: { icon: '🃏', name: '원카드', desc: '같은 무늬·숫자를 내고 먼저 털기', cat: '보드·카드', players: '2~6명',
    rules: '맨 위 카드와 <b>무늬나 숫자가 같은 카드</b>를 내요. 못 내면 한 장 먹기.<br><b>공격</b> 2(+2) · A(+3) · ♠A(+5) · 흑백조커(+5) · 컬러조커(+7) — 같거나 더 센 공격 카드로 받아칠 수 있어요.<br><b>특수</b> J 건너뛰기 · Q 방향 바꾸기 · K 한 번 더 · 7 무늬 바꾸기.<br><b>같은 숫자는 여러 장을 한 번에</b> 낼 수 있어요 (공격 카드는 합산, J는 장수만큼 건너뛰기).<br>한 장 남으면 <b>원카드!</b> 버튼을 먼저 누르세요. 20장이 넘으면 파산!' },
  halli: { icon: '🔔', name: '과일 종치기', desc: '같은 과일이 5개면 종을 땡!', cat: '파티', players: '2~6명',
    rules: '할리갈리 방식! 차례대로 카드를 한 장씩 펼쳐요(스페이스). 펼쳐진 카드에서 <b>같은 과일이 딱 5개</b>가 되면 가장 먼저 🔔 종(Enter)을 친 사람이 펼쳐진 카드를 모두 가져가요. 잘못 치면 모두에게 한 장씩! 카드가 다 떨어지면 탈락.' },
  ox: { icon: '⭕', name: 'OX 퀴즈', desc: '상식 퀴즈, O일까 X일까', cat: '파티', players: '2~8명',
    rules: '문제마다 10초 안에 ⭕ 또는 ❌를 고르고 <b>확정</b>해요(확정 전에는 바꿀 수 있어요). 누가 뭘 골랐는지는 정답 공개 때까지 비밀! 맞히면 10점 + <b>빨리 확정할수록 보너스</b>(최대 5점). 모두 확정하면 바로 정답 공개. 15문제가 끝나면 점수가 가장 높은 사람이 우승!' },
  word: { icon: '🔤', name: '끝말잇기', desc: '국어사전으로 판정하는 단어 잇기', cat: '파티', players: '1~8명 · 봇 가능',
    rules: '앞 단어의 <b>끝 글자로 시작하는 단어</b>를 입력해요 (두음법칙 OK, 2글자 이상, 이미 나온 단어 X). 맞는 말인지는 <b>국어사전</b>(표준국어대사전 · 우리말샘 49만 단어)이 판정해요. 사전에 없는 말은 모두에게 ✗로 보이고, 시간 안에 다시 내면 돼요. 시간이 다 되면 ❤️를 하나 잃고 새 단어로 다시 시작, 다 잃으면 탈락! 혼자면 🤖 봇과 할 수 있어요.' },
  mole: { icon: '🔨', name: '두더지 잡기 대결', desc: '먼저 때리는 사람이 임자', cat: '파티', players: '1~8명',
    rules: '모두 <b>같은 두더지 판</b>을 봐요. 두더지가 올라오면 먼저 클릭한 사람이 점수! 🐹 +1 · 황금 두더지 +3 · 💣 폭탄 -3. 1분 동안 점수가 가장 높은 사람이 우승.' },
  gem: { icon: '💎', name: '보석 맞추기 대결', desc: '1분 동안 보석 점수 대결', cat: '퍼즐', players: '1~8명',
    rules: '모두 같은 판으로 시작해요. 이웃한 보석을 바꿔 <b>같은 보석 3개 이상</b>을 이어요. 4개를 맞추면 줄 폭탄, 5개면 무지개 보석! 연쇄가 터질수록 점수가 커져요. 1분 뒤 최고 점수가 우승.' },
  fruit: { icon: '🍉', name: '과일 합치기 대결', desc: '같은 과일을 합쳐 수박까지', cat: '퍼즐', players: '1~8명',
    rules: '과일을 떨어뜨려 <b>같은 과일끼리 닿으면 한 단계 큰 과일</b>로 합쳐져요. 모두 같은 순서로 과일이 나와요. 2분이 지나거나 선을 넘기면 끝! 점수가 가장 높은 사람이 우승.' },
  marble: { icon: '🌍', name: '세계여행 보드게임', desc: '도시를 사고 건물을 지어 통행료로 부자 되기', cat: '보드·카드', players: '2~4명 · 봇 가능',
    rules: '부루마블 방식! 주사위를 굴려 도시를 사고 <b>별장·빌딩·호텔·랜드마크</b>를 지어요. 남의 땅에 서면 통행료, 같은 색 도시를 다 모으면 통행료 2배! 황금열쇠 · 무인도(더블이면 탈출) · 사회복지기금 · 세계여행(원하는 칸으로 이동). 돈이 모자라면 건물과 땅을 팔고, 그래도 안 되면 파산. 정한 라운드가 끝나면 총자산 1등이 우승!' },
  life: { icon: '🎓', name: '인생 게임', desc: '원작 규칙: 직업 · 결혼 · 집 · 주식 · 은퇴', cat: '보드·카드', players: '2~6명 · 봇 가능',
    rules: '룰렛(1~10)을 돌려 인생길을 달려요. <b>대학(학자금 대출 → 전문직)</b>이냐 <b>바로 취업</b>이냐! 직업마다 월급과 <b>특기</b>가 있어요 (의사는 병원비, 회계사는 세금, 경찰관은 룰렛 10 과속 벌금을 받아요). 월급날은 지나가면 월급, 딱 멈추면 보너스 50%. 결혼 · 아기 · 반려동물 · 집(보험) · 주식(그 숫자가 나올 때마다 배당) · 소송 · 행운의 룰렛! 은퇴할 때 <b>🏰 억만장자 저택</b>(가장 부자면 보람 카드 4장)과 <b>🌾 전원 마을</b> 중 선택. <b>현금 + 보람 카드 + 가족</b>이 가장 많은 사람이 우승!' },
  mafia: { icon: '🔪', name: '마피아', desc: '밤에는 암살, 낮에는 토론과 투표', cat: '파티', players: '4~12명 · 봇 가능',
    rules: '직업을 몰래 받아요: <b>마피아 · 의사 · 경찰 · 군인(7명 이상) · 시민</b>. 밤에는 마피아가 한 명을 노리고(마피아끼리만 채팅), 의사는 한 명을 지키고, 경찰은 한 명을 조사해요. 낮에는 채팅으로 토론한 뒤 투표! 최다 득표자는 최후 변론을 하고, 찬반 투표로 처형이 결정돼요. 죽은 사람은 유령끼리만 대화할 수 있어요. 마피아를 모두 찾으면 시민 승리, 마피아 수가 시민 수와 같아지면 마피아 승리!' },
  thief: { icon: '🃏', name: '도둑잡기', desc: '조커를 떠넘겨라! 카드 뽑기 눈치 싸움', cat: '보드·카드', players: '2~6명 · 봇 가능',
    rules: '트럼프 52장과 조커 1장을 모두 나눠 갖고, <b>같은 숫자 두 장</b>은 바로 버려요. 내 차례가 되면 옆 사람의 패에서 한 장을 몰래 뽑아요. 짝이 맞으면 버리고, 패를 모두 버리면 탈출! 상대가 어떤 카드를 고민하는지 보이니 <b>패 섞기</b>로 헷갈리게 하세요. 마지막까지 <b>조커</b>를 든 사람이 도둑이에요.' },
  yut: { icon: '🥢', name: '윷놀이', desc: '윷 · 모 한 번 더! 잡고 업고 지름길로', cat: '보드·카드', players: '2~4명 · 봇 가능',
    rules: '윷을 던져 <b>도(1) · 개(2) · 걸(3) · 윷(4) · 모(5) · 빽도(-1)</b>만큼 말을 움직여요. 윷이나 모가 나오면 한 번 더! 모서리(모 · 뒷모)와 가운데(방)에 <b>멈추면</b> 지름길로 갈 수 있어요. 상대 말이 있는 칸에 멈추면 잡아서 처음으로 보내고 한 번 더 던져요. 내 말끼리 만나면 업혀서 같이 움직여요. 말이 모두 먼저 출발점을 지나 들어오면 승리!' },
  yacht: { icon: '🎲', name: '요트 다이스', desc: '주사위 족보 채우기 두뇌 싸움', cat: '보드·카드', players: '1~4명 · 봇 가능',
    rules: '주사위 5개를 한 턴에 <b>최대 3번</b> 굴려요. 남기고 싶은 주사위는 눌러서 고정! 그런 다음 점수표의 12칸 중 하나를 골라 채워요: 1~6 · 초이스 · 포 다이스 · 풀 하우스 · 스몰/라지 스트레이트 · <b>요트(50점)</b>. 위쪽(1~6) 합이 63점 이상이면 보너스 +35점. 12라운드 뒤 총점이 높은 사람이 승리!' },
  blackjack: { icon: '🂡', name: '블랙잭', desc: '딜러를 이겨라! 카지노 카드 게임', cat: '보드·카드', players: '1~6명 · 봇 가능',
    rules: '모두 칩 1,000개로 시작해요. 베팅한 뒤 카드 2장을 받고, 차례대로 <b>히트(한 장 더) · 스탠드(멈춤) · 더블(베팅 2배, 한 장만) · 스플릿(같은 숫자 나누기)</b>를 골라요. A는 1 또는 11, J·Q·K는 10. 21을 넘으면 버스트! 딜러는 17 이상이 될 때까지 뽑아요. 이기면 2배, <b>블랙잭(처음 두 장 21)</b>은 2.5배를 돌려받아요. 정한 라운드가 끝나면 칩이 가장 많은 사람이 승리!' },
  liardice: { icon: '🎲', name: '라이어 다이스', desc: '허세와 확률! 컵 속 주사위 눈치 싸움', cat: '보드·카드', players: '2~6명 · 봇 가능',
    rules: '모두 주사위 5개를 컵 속에 몰래 굴려요. 차례대로 <b>판 전체에 어떤 눈이 몇 개 이상 있는지</b> 불러요. (예: 4개의 5) 다음 사람은 더 높게 부르거나 <b>거짓말!</b>을 외쳐요. <b>1은 와일드</b>라 어떤 눈으로도 쳐요. 공개해서 부른 만큼 없으면 부른 사람이, 있으면 외친 사람이 주사위 하나를 잃어요. <b>딱 맞아!</b>가 정확하면 주사위를 하나 되찾아요. 주사위를 다 잃으면 탈락, 마지막 생존자가 승리!' },
  davinci: { icon: '🔐', name: '암호 해독', desc: '숫자 타일 추리 대결 (다빈치 코드 방식)', cat: '보드·카드', players: '2~4명 · 봇 가능',
    rules: '0~11 숫자가 적힌 검정 · 흰색 타일을 받아 <b>작은 수부터 정렬</b>해 둬요(같은 숫자면 검정이 왼쪽). 색마다 <b>조커(−)</b>가 하나씩 있는데, 시작 패엔 없고 뽑으면 <b>원하는 자리</b>에 놓을 수 있어요. 내 차례엔 더미에서 한 장 뽑고, 상대의 숨긴 타일을 골라 숫자(또는 조커)를 맞혀요. 맞히면 그 타일이 공개되고 <b>계속 맞힐지 멈출지</b> 선택! 틀리면 내가 뽑은 타일을 공개해서 놓아요. 타일이 모두 공개되면 탈락, 마지막까지 암호를 지킨 사람이 승리!' },
  reversi: { icon: '⚫', name: '리버시', desc: '뒤집고 뒤집히는 흑백 전략 보드게임', cat: '보드·카드', players: '2명 · 봇 가능',
    rules: '흑과 백이 번갈아 돌을 놓아요. 놓을 때 <b>상대 돌을 내 돌 사이에 끼우면</b>(가로 · 세로 · 대각선) 그 돌들이 모두 내 색으로 뒤집혀요. 하나라도 뒤집을 수 있는 칸에만 둘 수 있고, 둘 곳이 없으면 자동으로 넘어가요. 둘 다 더 이상 둘 곳이 없으면 돌이 많은 쪽이 승리! 모서리는 절대 뒤집히지 않아요.' },
  shisen: { icon: '🀄', name: '사천성 대결', desc: '같은 판으로 3분 점수 대결', cat: '퍼즐', players: '1~8명',
    rules: '모두 똑같은 판으로 시작해요. 같은 그림 두 장을 <b>두 번 이하로 꺾인 선</b>으로 이을 수 있으면 사라져요. 선은 빈칸이나 판 바깥으로만 지나갈 수 있어요. 3초 안에 계속 맞히면 콤보 점수! 힌트(-30점)와 섞기도 있어요. 3분 뒤 점수가 가장 높은 사람이 우승!' },
  pinball: { icon: '🎯', name: '핀볼 점수 대결', desc: '같은 핀볼 판으로 4분 점수 대결', cat: '액션', players: '1~8명', isNew: true,
    rules: '모두 같은 핀볼 판에서 공 3개로 점수를 겨뤄요. 화면 <b>왼쪽 · 오른쪽</b>을 누르면 플리퍼(키보드 ← →), 공이 발사대에 있으면 <b>길게 눌렀다 떼서 발사</b>! 범퍼 · 드롭 타깃 · 궤도 · 스피너로 점수를 쌓고, 드롭 타깃을 다 쓰러뜨려 구멍에 2번 넣으면 <b>멀티볼</b> — 궤도 · 스피너로 <b>잭팟</b>! 4분이 지나거나 모두 공을 다 쓰면 점수가 가장 높은 사람이 우승.' },
  sudoku: { icon: '🔢', name: '스도쿠 대결', desc: '같은 퍼즐을 누가 먼저 푸나', cat: '퍼즐', players: '1~8명', isNew: true,
    rules: '모두 같은 스도쿠를 받아요. 가로줄 · 세로줄 · 3×3 칸마다 1~9가 한 번씩 들어가게 채워서 <b>가장 먼저 다 맞게 채운 사람이 우승</b>! 위쪽 점수는 채운 칸 %예요(맞았는지는 끝날 때까지 비밀). 시간이 다 되면 맞은 칸이 많은 순서로 순위가 정해져요. 메모 · 되돌리기 가능, 힌트는 없어요.' },
  nonogram: { icon: '🖼️', name: '노노그램 대결', desc: '같은 그림 퍼즐 먼저 칠하기', cat: '퍼즐', players: '1~8명', isNew: true,
    rules: '모두 같은 노노그램을 받아요. 줄 옆 숫자만큼 이어서 칸을 칠해서(숫자가 여러 개면 덩어리 사이에 빈칸) <b>가장 먼저 모든 줄을 맞힌 사람이 우승</b>! 위쪽 점수는 칠한 칸 %예요. 시간이 다 되면 맞은 칸이 많은 순서. X 표시 · 끌어서 칠하기 · 되돌리기 가능, 힌트는 없어요.' },
  chess: { icon: '♞', name: '체스', desc: '세계 공통 규칙 체스 · 체스 시계', cat: '보드·카드', players: '2명 · 봇 가능', isNew: true,
    rules: '백이 먼저 두고 번갈아 말을 한 번씩 움직여요. 상대 <b>킹을 잡을 수밖에 없게(체크메이트)</b> 만들면 승리! 말을 누르면 갈 수 있는 칸이 점으로 보여요(끌어서 옮겨도 돼요). <b>캐슬링</b>(킹 · 룩이 안 움직였고 사이가 비었을 때) · <b>앙파상</b>(바로 전에 두 칸 온 폰을 옆에서 잡기) · <b>프로모션</b>(끝줄에 간 폰은 퀸 · 룩 · 비숍 · 나이트로)도 다 돼요. 스테일메이트 · 같은 국면 3번 · 50수 동안 폰 이동과 잡기 없음 · 서로 체크메이트할 말이 없으면 무승부. 멀티는 <b>체스 시계</b>(정한 시간 + 한 수마다 추가 시간)가 있어서 시간이 다 되면 져요. 무승부 제안 · 기권도 할 수 있어요.' },
  gostop: { icon: '🎴', name: '고스톱', desc: '2명은 맞고 · 3명은 고스톱 (피망 규칙)', cat: '보드·카드', players: '2~3명 · 봇 가능', isNew: true,
    rules: '화투 48장 + 보너스피 2장. <b>2명은 맞고</b>(손패 10장 · 7점 나기), <b>3명은 고스톱</b>(손패 7장 · 3점 나기). 내 차례엔 손패 한 장을 내서 바닥의 같은 달 패를 먹고, 더미에서 한 장 뒤집어 또 맞춰요. 점수: <b>광</b> 3장 3점(비광 끼면 2점) · 4장 4점 · 5장 15점 / <b>열끗</b> 5장 1점 · 고도리 5점 / <b>띠</b> 5장 1점 · 홍단 · 청단 · 초단 3점 / <b>피</b> 10장 1점(쌍피 2장). 점수가 나면 <b>고</b>(계속, 1고 +1 · 2고 +2 · 3고부터 두 배씩) 또는 <b>스톱</b>! 흔들기 · 폭탄 · 멍따(열끗 7장)는 두 배, 진 사람은 피박 · 광박 · 고박이면 두 배. 쪽 · 따닥 · 뻑 먹기 · 판쓸 · 폭탄이면 상대 피를 한 장씩 뺏어요. 뻑 3번 · 총통은 바로 승리, 아무도 못 나면 나가리(다음 판 두 배).' },
  rummi: { icon: '🀫', name: '러미 타일', desc: '숫자 타일로 런 · 그룹 만들기 (루미큐브 방식)', cat: '보드·카드', players: '2~4명 · 봇 가능', isNew: true,
    rules: '1~13 숫자 타일 4색 × 2벌과 조커 2개(106개) 중 14개씩 받아요. 같은 색 연속 숫자 3개 이상(<b>런</b>)이나 같은 숫자 다른 색 3~4개(<b>그룹</b>)를 내려놓아요. 첫 등록은 <b>내 타일만으로 합 30 이상</b>! 등록한 뒤에는 바닥의 세트를 떼고 붙여 마음대로 다시 짤 수 있어요(차례가 끝날 때 모든 세트가 맞아야 해요). 낼 게 없으면 타일을 한 장 가져와요. 가장 먼저 타일을 다 내면 승리! 남은 타일 합(조커 30점)이 벌점이에요.' },
  bang: { icon: '⭐', name: '황야의 총잡이', desc: '정체를 숨긴 서부 총격전 (뱅! 방식)', cat: '보드·카드', players: '4~7명 · 봇 가능', isNew: true,
    rules: '몰래 받은 역할로 싸워요. <b>보안관</b>(공개)과 부관은 무법자와 배신자를 모두 쓰러뜨리면, <b>무법자</b>는 보안관을 쓰러뜨리면, <b>배신자</b>는 혼자 끝까지 살아남으면 승리! 내 차례엔 카드 2장을 가져오고 사정거리 안의 상대에게 <b>뱅!</b>(차례에 한 번), 맞으면 <b>빗나감!</b>으로 피해요. 맥주 · 술통 · 감옥 · 다이너마이트 · 기관총 · 결투 · 강탈 · 무기(사정거리)와 인물 16명의 능력까지! 생명력보다 많은 카드는 차례 끝에 버려요.' },
  coup: { icon: '👑', name: '궁정 음모', desc: '거짓말과 도전! 블러핑 카드 게임 (쿠 방식)', cat: '보드·카드', players: '2~6명 · 봇 가능', isNew: true,
    rules: '인물 카드 2장(공작 · 암살자 · 사령관 · 대사 · 백작부인)과 코인 2개로 시작해요. 차례엔 소득(+1) · 해외 원조(+2) · 쿠데타(7코인) 또는 <b>인물 능력</b>을 써요: 공작 세금 +3 · 암살자 3코인으로 암살 · 사령관 2코인 갈취 · 대사 카드 교환. 그 인물이 없어도 <b>있는 척</b>할 수 있어요! 의심되면 <b>도전!</b> 거짓말이면 거짓말한 쪽이, 진짜면 도전한 쪽이 카드를 잃어요. 해외 원조는 공작이, 암살은 백작부인이, 갈취는 사령관 · 대사가 막아요. 코인 10개 이상이면 반드시 쿠데타! 카드 2장을 모두 잃으면 탈락, 마지막 생존자가 승리.' },
  dalmuti: { icon: '🤴', name: '계급 전쟁', desc: '인생은 불공평해! 신분 카드 게임 (달무티 방식)', cat: '보드·카드', players: '4~8명 · 봇 가능', isNew: true,
    rules: '1(달무티)부터 12(농노)까지 숫자만큼 카드가 있고 어릿광대 2장까지 80장, <b>숫자가 낮을수록 강해요</b>. 선은 같은 숫자 카드를 원하는 만큼 내고, 다음 사람은 <b>같은 장수로 더 낮은 숫자</b>를 내거나 패스해요. 모두 패스하면 마지막에 낸 사람이 새로 시작! 어릿광대는 다른 카드와 함께 내면 그 숫자, 혼자면 13. 먼저 다 낸 순서로 다음 판 계급이 정해지고, <b>농노는 가장 좋은 카드 2장을 달무티에게, 소작농은 1장을 총리대신에게</b> 바쳐요(받은 쪽은 아무 카드나 돌려줘요). 어릿광대 2장을 받으면 혁명! 정한 판 수 동안 점수를 겨뤄요.' },
  relay: { icon: '🖍️', name: '그림 릴레이', desc: '그리고 맞히고 또 그리고! (텔레스트레이션 방식)', cat: '파티', players: '3~10명', isNew: true,
    rules: '모두 단어 카드(6개)와 주사위로 비밀 단어를 정해요. 스케치북을 옆 사람에게 넘기며 <b>단어를 그림으로 그리기 → 그림을 보고 단어 맞히기</b>를 번갈아 해요(한 장에 60초, 대기실에서 바꿀 수 있어요). 스케치북이 주인에게 돌아오면 한 권씩 펼쳐 보며 단어가 어떻게 바뀌었는지 함께 구경해요! 원래 단어를 그대로 맞히면 맞힌 사람과 그린 사람 모두 +1점, 마음에 드는 장에 하트를 받으면 +1점.' },
  kart: { icon: '🏎️', name: '드리프트 카트', desc: '드리프트로 부스터 모아 1등! 카트 레이싱', cat: '액션', players: '1~8명', isNew: true,
    rules: '방향키(또는 WASD)로 달리고 <b>Shift를 누른 채 꺾으면 드리프트</b>! 드리프트를 길게 하고 놓으면 순간 대시, 스피드전에서는 드리프트로 <b>부스터 게이지</b>가 차서 부스터를 얻어요(Ctrl 또는 E로 사용). 아이템전에서는 아이템 상자를 지나 바나나 · 물풍선 · 미사일 · 실드 · 부스터를 얻어요. 출발 신호 직전에 가속하면 출발 부스터! 벽에 끼면 R 키로 트랙 복귀. 정한 바퀴 수를 가장 먼저 도는 사람이 우승!' },
};
const SOLO_GAMES = [   // [키, 아이콘, 이름, 설명, NEW 표시, 분류]
  ['pinball', '🎯', '핀볼', '플리퍼로 튕겨 미션 · 멀티볼 · 잭팟!', true, '액션'],
  ['sudoku', '🔢', '스도쿠', '쉬움 · 보통 · 어려움 · 이유를 알려 주는 힌트', true, '퍼즐'],
  ['nonogram', '🖼️', '노노그램', '숫자만큼 칠해서 그림 완성 · 5×5~15×15', true, '퍼즐'],
  ['gostop', '🎴', '고스톱 vs AI', '맞고(AI 1명) · 3인 고스톱(AI 2명)', true, '보드·카드'],
  ['chess', '♞', '체스 vs AI', '쉬움/보통/어려움 · 무르기 가능', true, '보드·카드'],
  ['kart', '🏎️', '드리프트 카트', '카트 레이싱 · AI와 3바퀴', true, '액션'],
  ['dalmuti', '🤴', '계급 전쟁 vs AI', '달무티 방식 · AI 3~7명', true, '보드·카드'],
  ['coup', '👑', '궁정 음모 vs AI', '쿠 방식 블러핑 · AI 1~5명', true, '보드·카드'],
  ['bang', '⭐', '황야의 총잡이 vs AI', '뱅! 방식 · 봇 3~6명', true, '보드·카드'],
  ['rummi', '🀫', '러미 타일 vs AI', '루미큐브 방식 · AI 1~3명', true, '보드·카드'],
  ['shisen', '🀄', '사천성', '3분 안에 패를 모두 없애라', false, '퍼즐'],
  ['reversi', '⚫', '리버시 vs AI', '오델로 방식 · 쉬움/보통/어려움', false, '보드·카드'],
  ['davinci', '🔐', '암호 해독 vs AI', '다빈치 코드 방식 추리 게임', false, '보드·카드'],
  ['liardice', '🎲', '라이어 다이스', '허세와 확률의 주사위 게임', false, '보드·카드'],
  ['blackjack', '🂡', '블랙잭', '카지노 딜러와 승부', false, '보드·카드'],
  ['yacht', '🎲', '요트 다이스', '혼자 점수 도전 · AI 대결', false, '보드·카드'],
  ['yut', '🥢', '윷놀이 vs AI', '잡고 업고 지름길로!', false, '보드·카드'],
  ['thief', '🃏', '도둑잡기 vs AI', '조커를 떠넘기는 카드 게임', false, '보드·카드'],
  ['life', '🎓', '인생 게임 vs AI', '원작 규칙: 직업 · 결혼 · 집 · 주식 · 은퇴', false, '보드·카드'],
  ['marble', '🌍', '세계여행 vs AI', '부루마블 방식 · AI 1~3명', false, '보드·카드'],
  ['breakout', '🧱', '벽돌깨기', '공을 모아 쏘는 스와이프 벽돌깨기', false, '액션'],
  ['dodge', '🎯', '총알피하기', '총알 모드 · 대나무 모드', false, '액션'],
  ['plat', '🏃', '점프 어드벤처', '스테이지를 달려 골인!', false, '액션'],
  ['zombie', '🧟', '좀비 웨이브', '게이트로 부대를 불려 좀비 격퇴', false, '액션'],
  ['volley', '🏐', '점프 배구 vs AI', '15점을 먼저 내면 승리', false, '액션'],
  ['bomb', '💥', '폭탄 배틀 vs 봇', '봇 3마리와 서바이벌', false, '액션'],
  ['tank', '🛡️', '탱크 대포 vs AI', '바람을 읽고 명중!', false, '액션'],
  ['shooter', '🚀', '우주 슈팅', '적을 쓸고 보스를 쓰러뜨려라', false, '액션'],
  ['gem', '💎', '보석 맞추기', '1분 동안 최고 점수', false, '퍼즐'],
  ['fruit', '🍉', '과일 합치기', '같은 과일끼리 합쳐 수박까지', false, '퍼즐'],
  ['stack', '🏗️', '탑 쌓기', '딱 맞게 쌓아 올리기', false, '퍼즐'],
  ['mole', '🔨', '두더지 잡기', '1분 동안 최대한 많이!', false, '파티'],
  ['mine', '💣', '지뢰찾기', '초급·중급·고급 기록 도전', false, '퍼즐'],
  ['g2048', '🔢', '2048', '숫자를 합쳐 2048 만들기', false, '퍼즐'],
  ['snake', '🐍', '스네이크', '사과를 먹고 길게 길게', false, '액션'],
  ['rain', '☔', '산성비 타자', '떨어지는 단어를 타자로 막기', false, '파티'],
  ['tetris', '🟪', '테트리스 보스전', '줄을 지워 보스를 쓰러뜨려라', false, '액션'],
  ['apple', '🍎', '사과 게임', '2분 동안 최고 점수 도전', false, '퍼즐'],
  ['omok', '⚫', '오목 vs AI', '컴퓨터와 한 판 승부', false, '보드·카드'],
  ['pong', '🏓', '핑퐁 vs AI', '먼저 목숨 5개를 잃으면 패배', false, '액션'],
  ['race', '⏱️', '1 to 50 기록 도전', '최고 기록을 갱신해 보세요', false, '퍼즐'],
];
const ROLE_INFO = {
  omok: [['black', '⚫ 흑돌 (선공)'], ['white', '⚪ 백돌']],
  pong: [['bottom', '⬇️ 아래'], ['top', '⬆️ 위'], ['left', '⬅️ 왼쪽'], ['right', '➡️ 오른쪽']],
  volley: [['left', '🔵 왼쪽 코트'], ['right', '🔴 오른쪽 코트']],
};
const AV_COLORS = ['#7c6cff', '#3fcf9b', '#ff7a59', '#4aa8ff', '#e85d9c', '#ffb02e', '#26b5c4', '#9b6bff'];
const avColor = id => AV_COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
const EMOJIS = ['👍', '😂', '😱', '🔥', '👏', '💰', '😭', '🤔', '😎', '🙏'];

/* 메뉴 카드 + 분류 칩 */
const UPDATED = new Set(['life', 'word']);   // 이번에 크게 바뀐 게임
function fillGrid(sel, list) {
  const grid = $(sel);
  list = list.slice().sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));   // 새 게임을 앞쪽에
  let row = grid.previousElementSibling;
  if (!row || !row.classList.contains('cat-row')) { row = document.createElement('div'); row.className = 'cat-row'; grid.before(row); }
  row.innerHTML = CATS.map(c => {
    const n = c === '전체' ? list.length : list.filter(g => g.cat === c).length;
    return `<button class="cat-chip ${c === '전체' ? 'on' : ''}" data-act="cat" data-cat="${c}">${c} <small>${n}</small></button>`;
  }).join('');
  grid.innerHTML = list.map(g => `<button class="game-card${g.act !== 'pickGame' ? ' hq' : ''}" data-act="${g.act}" data-game="${g.k}" data-cat="${g.cat}">${g.isNew ? '<span class="new-badge">NEW</span>' : UPDATED.has(g.k) ? '<span class="new-badge up">UP</span>' : ''}${gameIcon(g.k, g.cat)}<b>${g.n}</b><small>${g.d}</small>${g.pill ? `<span class="pill">${g.pill}</span>` : ''}${g.act !== 'pickGame' ? `<i class="gc-help" data-act="manual" data-game="${g.k}" title="설명서" role="button" tabindex="0">?</i>` : ''}</button>`).join('');
}
fillGrid('#single-grid', SOLO_GAMES.map(([k, i, n, d, isNew, cat]) => ({ k, i, n, d, isNew, cat, act: 'solo' })));
fillGrid('#create-grid', Object.entries(GAME_INFO).map(([k, g]) => ({ k, i: g.icon, n: g.name, d: g.desc, isNew: g.isNew, cat: g.cat, act: 'create', pill: g.players })));
fillGrid('#picker-grid', Object.entries(GAME_INFO).map(([k, g]) => ({ k, i: g.icon, n: g.name, d: g.desc, isNew: g.isNew, cat: g.cat, act: 'pickGame', pill: g.players })));
$('[data-act=goSingle] small').textContent = `AI 대전 · 기록 도전 ${SOLO_GAMES.length}종`;
$('[data-act=goMulti] small').textContent = `방 만들고 친구 초대 · ${Object.keys(GAME_INFO).length}종`;
$('#emoji-row').innerHTML = EMOJIS.map(e => `<button class="emo-btn" data-act="emoji" data-e="${e}">${e}</button>`).join('');

/* ─── 닉네임 ─── */
$('#nick').value = store.get('nick', '');
const nick = () => {
  if (typeof Acct !== 'undefined' && Acct.me) return Acct.me.name;                 // 로그인했으면 계정 이름 (account.js)
  const v = $('#nick').value.trim().slice(0, 12) || '게이머'; store.set('nick', v); return v;
};

/* =====================================================================
 *  소켓 연결
 * ===================================================================== */
// 인터넷으로 접속할 때 반응이 빠르도록 WebSocket을 먼저 쓰고, 막혀 있으면 다른 방식으로 자동 전환
const socket = io({ transports: ['websocket', 'polling'], tryAllTransports: true });
/* 연결 복구: 잠깐 끊겨도 (다른 앱으로 넘어감 · 와이파이) 서버가 3분 동안 자리를 맡아 둬요.
 * 화면이 새로 고쳐져도(휴대폰이 탭을 다시 불러옴) 이 탭에 보관한 복구 정보로 같은 자리로 돌아가요. */
let RC = null;                // 다시 연결할 때 쓸 복구 정보 { pid, off } — 끊긴 순간의 것 (새로 고친 화면은 이 탭의 보관함에서)
let rcWait = null, rcRetry = false;   // 복구가 안 된 연결: 서버 답을 기다리는 중 · 한 번 더 연결하는 중
try {
  const r = JSON.parse(sessionStorage.getItem('mgRecover') || 'null');
  if (r && r.pid && r.off && Date.now() - r.t < 170000) { RC = { pid: r.pid, off: r.off }; socket._pid = r.pid; socket._lastOffset = r.off; }
} catch { /* 보관함을 못 쓰면 그냥 새로 연결 */ }
const saveRecover = () => {
  try {
    if (rcWait || rcRetry) return;                   // 서버 답을 기다리는 동안에는 새 연결 정보로 덮어쓰지 않아요
    if (S.code && socket.connected && socket._pid && socket._lastOffset) sessionStorage.setItem('mgRecover', JSON.stringify({ pid: socket._pid, off: socket._lastOffset, t: Date.now() }));
    else if (!S.code && !RC) sessionStorage.removeItem('mgRecover');
  } catch { /* 무시 */ }
};
setInterval(saveRecover, 2000);
window.addEventListener('pagehide', saveRecover);
// 다른 앱에 갔다가 돌아오면: 연결이 살아 있는지 바로 확인하고, 대답이 없으면 기다리지 않고 바로 다시 연결해요
document.addEventListener('visibilitychange', () => {
  saveRecover();
  if (document.visibilityState !== 'visible') return;
  if (!socket.connected) { if (!socket.active) socket.connect(); return; }
  socket.timeout(2500).emit('ping:t', 0, err => { if (err && socket.connected && socket.io.engine) socket.io.engine.close(); });
});
/** 자리를 되찾지 못했어요 (너무 오래 끊김 · 서버가 다시 켜짐) → 방에서 나와요 */
function lostSeat() {
  const had = !!(S.code || RC);
  RC = null; rcRetry = false; clearTimeout(rcWait); rcWait = null;
  try { sessionStorage.removeItem('mgRecover'); } catch { /* 무시 */ }
  Reconn.hide();
  if (S.code) { S.code = null; S.room = null; stopLocal(); hideOverlay(); show('multi'); renderInvite(); }
  if (had) toast('연결이 오래 끊겨서 방에서 나왔어요. 방 코드로 다시 들어가 주세요.', 'error');
}
const Reconn = {
  show() { let el = document.getElementById('reconn'); if (!el) { el = document.createElement('div'); el.id = 'reconn'; el.setAttribute('role', 'status'); document.body.append(el); } el.innerHTML = '<i></i>연결이 끊겼어요 · 다시 연결하는 중… <small>(3분 안에 돌아오면 그대로 이어서 해요)</small>'; el.classList.add('show'); },
  hide() { const el = document.getElementById('reconn'); if (el) el.classList.remove('show'); },
};
let pingTimer = null;
function measurePing() {
  const t = performance.now();
  socket.timeout(4000).emit('ping:t', 0, err => {
    if (err || !socket.connected) return;
    const ms = Math.round(performance.now() - t);
    $('#conn span').textContent = `서버 연결됨 · ${ms}ms`;
    $('#conn').dataset.q = ms < 90 ? 'good' : ms < 200 ? 'ok' : 'bad';
  });
}
socket.on('connect', () => {
  $('#conn').classList.add('on'); $('#conn span').textContent = '서버 연결됨';
  clearInterval(pingTimer); pingTimer = setInterval(measurePing, 5000); measurePing();
  rcRetry = false; clearTimeout(rcWait); rcWait = null;
  if (!S.code && !RC) { Reconn.hide(); return; }    // 방에 있지 않았어요
  // 방에 있었어요 → 서버 답을 기다려요: 'resumed'(맡아 둔 자리로) · 'resumeRetry'(한 번 더 연결) · 'resumeFail'(자리 없음).
  // 답이 없으면(예전 서버) 잠시 뒤 정리해요
  rcWait = setTimeout(() => { rcWait = null; lostSeat(); }, 6000);
});
/* 서버: "예전 연결을 정리했으니 같은 복구 정보로 한 번 더 연결해 주세요" (한 번만) */
socket.on('resumeRetry', () => {
  clearTimeout(rcWait); rcWait = null;
  if (!RC || RC.tried) return lostSeat();
  RC.tried = true; rcRetry = true;
  socket._pid = RC.pid; socket._lastOffset = RC.off;
  socket.disconnect(); socket.connect();
});
socket.on('connect_error', err => {
  $('#conn span').textContent = '연결 중…';
  const msg = err && err.message;
  if (msg === 'server-full') toast('지금 서버에 사람이 너무 많아요. 잠시 후 자동으로 다시 시도할게요.', 'error');
  if (msg === 'too-many') toast('같은 곳에서 너무 많이 접속했어요. 다른 탭을 닫아 주세요.', 'error');
  if (!socket.active) setTimeout(() => socket.connect(), 10000);   // 서버가 거절한 경우에도 잠시 뒤 다시 시도
});
socket.on('disconnect', reason => {
  clearInterval(pingTimer);
  $('#conn').classList.remove('on'); delete $('#conn').dataset.q; $('#conn span').textContent = '연결 끊김 · 다시 연결 중…';
  if (rcRetry && reason === 'io client disconnect') return;        // 복구를 한 번 더 시도하는 중
  const quit = reason === 'io client disconnect' || reason === 'io server disconnect';
  if ((rcWait || rcRetry) && !quit) {                               // 서버 답을 기다리다 또 끊김 → 처음 복구 정보로 다시
    if (RC) { socket._pid = RC.pid; socket._lastOffset = RC.off; }
    clearTimeout(rcWait); rcWait = null; rcRetry = false;
    return;
  }
  if (!S.code) { if (quit && RC) lostSeat(); return; }
  if (quit) {                                       // 일부러 끊음 → 방에서 나와요
    RC = null; clearTimeout(rcWait); rcWait = null; rcRetry = false; Reconn.hide();
    S.code = null; S.room = null; stopLocal(); hideOverlay(); show('multi'); renderInvite();
    toast('서버와 연결이 끊어졌어요. 인터넷 연결이나 서버 창이 켜져 있는지 확인해 주세요.', 'error');
  } else {                                          // 잠깐 끊김 → 화면은 그대로 두고 다시 연결되면 이어서
    if (socket._pid && socket._lastOffset) {
      RC = { pid: socket._pid, off: socket._lastOffset };
      try { sessionStorage.setItem('mgRecover', JSON.stringify({ pid: RC.pid, off: RC.off, t: Date.now() })); } catch { /* 무시 */ }
    }
    Reconn.show();
  }
});
/* 다시 연결됐어요 (서버가 맡아 둔 자리로) */
socket.on('resumed', d => {
  RC = null; rcRetry = false; clearTimeout(rcWait); rcWait = null;
  Reconn.hide();
  if (S.code === d.code) { toast('📶 다시 연결됐어요!', 'good'); return; }      // 화면이 그대로 있으면 놓친 내용은 서버가 다시 보내 줘요
  // 화면이 새로 고쳐진 뒤: 방 정보부터 다시 → 차례형 게임은 화면을 다시 받아요
  S.myId = d.myId; S.code = d.code; S.room = d.room;
  $('#chat-room').textContent = '방 ' + d.code;
  if (location.search) history.replaceState(null, '', location.pathname);
  renderInvite();
  if (!d.playing) { show('lobby'); renderLobby(); toast('📶 다시 연결됐어요! 대기실로 돌아왔어요.', 'good'); return; }
  if (!S.screen || MENU_IDS.has(S.screen)) { show('lobby'); renderLobby(); }
  socket.emit('resync');
  toast('📶 다시 연결됐어요! 진행 중인 게임으로 돌아가요. (게임에 따라 이번 판이 끝난 뒤 대기실에서 이어져요)', 'good');
});
socket.on('resumeFail', () => { clearTimeout(rcWait); rcWait = null; if (S.code || RC) lostSeat(); });
socket.on('serverInfo', d => { S.serverInfo = d; renderInvite(); });
socket.on('toast', d => toast(d.msg, d.type));

socket.on('joined', d => {
  S.myId = d.myId; S.code = d.code;
  $('#invite-banner').classList.add('hidden');
  if (location.search) history.replaceState(null, '', location.pathname);   // 초대 링크 흔적 지우기
  renderInvite();
  $('#chat-log').innerHTML = '';
  $('#chat-room').textContent = '방 ' + d.code;
  outSet.clear(); S.scores = []; renderScores();   // 전에 있던 방의 점수가 남지 않게
  stopLocal(); hideOverlay(); show('lobby');
});
socket.on('room', r => { S.room = r; renderLobby(); });
socket.on('toLobby', d => {
  stopLocal(); outSet.clear(); S.scores = []; hideOverlay(); show('lobby'); renderLobby();
  if (d && d.msg) toast(d.msg);
});
socket.on('scores', list => { S.scores = list; renderScores(); });
socket.on('game:out', d => { outSet.add(d.id); renderScores(); });
/* 같은 시드로 각자 플레이하는 점수 대결 (보석 맞추기 · 과일 합치기) */
socket.on('sr:start', d => { const g = Games[d.game]; if (g && g.multi) g.multi(d); });
socket.on('chat', addChat);
socket.on('gameOver', d => { S.rematch = null; after(900, () => showResult(d)); });
socket.on('rematch', d => { S.rematch = d; if (ovDraw) ovDraw(); });
socket.on('rematch:go', () => { if (typeof Sound !== 'undefined') Sound.play('invite'); });
/** 방장이 나를 내보냈어요 */
socket.on('kicked', () => {
  RC = null; rcRetry = false; clearTimeout(rcWait); rcWait = null; Reconn.hide();
  try { sessionStorage.removeItem('mgRecover'); } catch { /* 무시 */ }
  S.code = null; S.room = null; stopLocal(); hideOverlay(); show('multi'); renderInvite();
  toast('방장이 방에서 내보냈어요.', 'error');
});

function me() { return S.room ? S.room.players.find(p => p.id === S.myId) : null; }

/* ─── 열린 방 목록 · 빠른 참가 (멀티 메뉴) ─── */
const emitAck = (ev, d, ms = 6000) => new Promise(res => socket.timeout(ms).emit(ev, d, (err, r) => res(err ? null : r)));
var RoomList = {         // var: 화면 전환(show)이 이 파일을 다 읽기 전에 불려도 괜찮게
  timer: null, last: null,
  start() { this.load(); clearInterval(this.timer); this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 5000); },
  stop() { clearInterval(this.timer); this.timer = null; },
  async load(manual) {
    const r = await emitAck('rooms:list', null);
    if (!isScreen('multi')) return;
    this.last = r; this.render(r);
    if (manual) toast('방 목록을 새로 고쳤어요.');
  },
  render(r) {
    const box = $('#open-rooms'); if (!box) return;
    const head = `<div class="or-head"><h3>${icon('door-enter')}열린 방 <small>${r ? `${r.open.length}개${r.playing ? ` · 게임 중 ${r.playing}개` : ''}` : ''}</small></h3>
      <button class="btn sm good" data-act="quickJoin">${icon('bolt')}빠른 참가</button>
      <button class="btn sm ghost icon-only" data-act="roomsRefresh" title="새로 고침" aria-label="새로 고침">${icon('refresh')}</button></div>`;
    if (!r) { box.innerHTML = head + '<p class="muted small or-empty">방 목록을 불러오지 못했어요.</p>'; return; }
    const rows = r.open.map(x => {
      const info = GAME_INFO[x.game] || {}, ready = x.n >= x.min;
      return `<button class="or-room ${x.mine ? 'mine' : ''}" data-act="joinOpen" data-code="${esc(x.code)}" ${x.mine ? 'disabled' : ''}>${gameIcon(x.game, info.cat, 'sm')}
        <span class="or-t"><b>${esc(stripEmoji(info.name || x.game))}</b><small>${esc(x.host)}님의 방${x.lv ? ` · Lv.${x.lv}` : ''}</small></span>
        <span class="or-n ${ready ? 'ok' : ''}">${x.n}/${x.max}</span><span class="or-go">${x.mine ? '내 방' : '참가'}</span></button>`;
    }).join('');
    box.innerHTML = head + (rows ? `<div class="or-list">${rows}</div>` : '<p class="muted small or-empty">지금 사람을 기다리는 방이 없어요. 아래에서 방을 만들고 친구를 불러 보세요!</p>');
  },
  async quick() {
    const r = await emitAck('rooms:quick', { playerName: nick() });
    if (!r || !r.ok) toast('지금 바로 들어갈 수 있는 방이 없어요. 방을 만들어 보세요!');
  },
};

/* ─── 친구 초대: 인터넷 주소 · 같은 와이파이 주소 · 방 바로가기 링크 ─── */
const isPrivateHost = h => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(h) || h.endsWith('.local');
/** 친구에게 보낼 주소 { url, net: 인터넷 주소인지 } */
function inviteBase() {
  const i = S.serverInfo || {};
  if (i.publicUrl) return { url: i.publicUrl, net: true };
  const h = location.hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(h)) return { url: location.origin, net: !isPrivateHost(h) };
  if (i.lan && i.lan.length) return { url: `http://${i.lan[0]}:${i.port}`, net: false };
  return null;
}
const inviteLink = () => { const b = inviteBase(); return S.code && b ? `${b.url}/?room=${S.code}` : ''; };
function renderInvite() {
  const i = S.serverInfo || {}, b = inviteBase();
  let html;
  if (b && b.net) html = `🌍 <b>인터넷 주소</b> — 어디서나 접속할 수 있어요<br><code>${esc(b.url)}</code>`;
  else {
    html = i.lan && i.lan.length ? '🏠 <b>같은 와이파이</b> 친구 접속 주소<br>' + i.lan.map(ip => `<code>http://${esc(ip)}:${i.port}</code>`).join('<br>')
      : b ? `<code>${esc(b.url)}</code>` : '친구는 이 서버 주소로 접속한 뒤 방 코드를 입력하면 돼요.';
    if (!i.online) html += '<br><small>💡 다른 동네 친구와 하려면 서버를 <b>start-online.bat</b>으로 켜면 인터넷 주소가 생겨요.</small>';
  }
  $('#invite-multi').innerHTML = html;
  const link = inviteLink();
  const friendBtn = typeof Acct !== 'undefined' && Acct.me ? ' <button class="btn sm" data-act="acInviteFriends">👥 친구 초대</button>' : '';
  $('#invite-lobby').innerHTML = link
    ? `🔗 <b>초대 링크</b> — 받은 친구는 누르기만 하면 이 방으로 와요<br><code>${esc(link)}</code><br><button class="btn sm good" data-act="copyInvite">📋 초대 링크 복사</button>${friendBtn}`
    : html + '<br>접속 후 <b>방 코드</b>를 입력하면 들어올 수 있어요.' + friendBtn;
}
/** 클립보드 복사 (http 주소에서도 동작하도록 예전 방식으로도 시도) */
function copyText(text, okMsg) {
  const done = () => toast(okMsg, 'good'), fail = () => toast(text);
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, fail);
  const t = document.createElement('textarea');
  t.value = text; t.style.cssText = 'position:fixed;opacity:0;top:0';
  document.body.append(t); t.select();
  try { if (document.execCommand('copy')) done(); else fail(); } catch { fail(); }
  t.remove();
}

/* ─── 초대 링크로 들어왔을 때 (?room=ABCD) ─── */
const INVITE_CODE = (new URLSearchParams(location.search).get('room') || '').toUpperCase().trim();
if (/^[A-Z2-9]{4}$/.test(INVITE_CODE)) {
  $('#join-code').value = INVITE_CODE;
  socket.emit('peekRoom', INVITE_CODE, info => {
    const el = $('#invite-banner');
    el.classList.remove('hidden');
    if (!info) { el.innerHTML = `😢 초대받은 방(<b>${esc(INVITE_CODE)}</b>)을 찾을 수 없어요. 방이 닫혔거나 서버 주소가 바뀌었을 수 있어요.`; return; }
    el.innerHTML = `🎟️ <b>${esc(info.host)}</b> 님의 <b>${esc(info.game)}</b> 방(${esc(info.code)})에 초대받았어요! <span class="muted">(${info.players}/${info.max}명)</span>
      ${info.started ? '<br><small>지금은 게임 중이에요. 판이 끝나면 들어갈 수 있어요.</small>' : ''}
      <div><button class="btn good lg" data-act="joinInvite">닉네임 확인하고 바로 입장 🚀</button></div>`;
    $('#nick').focus();
  });
}

/* =====================================================================
 *  버튼 동작 (data-act)
 * ===================================================================== */
const ACT = {
  theme: () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
  home: () => { if (S.code) return toast('먼저 방에서 나가 주세요.'); stopLocal(); hideOverlay(); show('home'); },
  goSingle: () => { nick(); show('single'); },
  goMulti: () => { nick(); show('multi'); },
  create: el => socket.emit('createRoom', { playerName: nick(), gameType: el.dataset.game }),
  join: () => {
    const code = $('#join-code').value.trim().toUpperCase();
    if (code.length !== 4) return toast('방 코드 4자리를 입력해 주세요.', 'error');
    socket.emit('joinRoom', { roomCode: code, playerName: nick() });
  },
  leave: () => leaveRoom(),
  leaveGame: () => {
    if (S.solo) { stopLocal(); hideOverlay(); return show('single'); }
    if (S.code && !confirm('게임에서 나가면 방에서도 나가게 돼요. 나갈까요?')) return;
    leaveRoom();
  },
  copyCode: () => {
    const c = S.code; if (!c) return;
    const link = inviteLink();
    copyText(link || c, link ? '초대 링크를 복사했어요! 친구에게 보내 주세요.' : '방 코드를 복사했어요: ' + c);
  },
  openPicker: () => {
    $$('#picker-grid .game-card').forEach(c => c.classList.toggle('current', !!S.room && c.dataset.game === S.room.gameType));
    $('#game-picker').classList.add('show');
  },
  closePicker: () => $('#game-picker').classList.toggle('show', false),
  pickGame: el => {
    $('#game-picker').classList.toggle('show', false);
    if (S.room && el.dataset.game !== S.room.gameType) socket.emit('setGame', el.dataset.game);
  },
  copyInvite: () => { const link = inviteLink(); if (link) copyText(link, '초대 링크를 복사했어요! 카톡·디스코드에 붙여넣으세요.'); },
  joinInvite: () => socket.emit('joinRoom', { roomCode: INVITE_CODE, playerName: nick() }),
  setOption: el => socket.emit('setOption', { key: el.dataset.key, value: el.dataset.value }),
  setRole: el => socket.emit('setRole', el.dataset.role),
  ready: () => socket.emit('toggleReady'),
  rematch: () => { const rm = S.rematch, mine = !!rm && rm.ids.includes(S.myId); socket.emit('rematch', !mine); },
  togglePrivate: () => { if (S.room) socket.emit('setPrivate', !S.room.private); },
  kick: el => { if (confirm(`${el.dataset.name} 님을 방에서 내보낼까요? (이 방에는 다시 못 들어와요)`)) socket.emit('kick', el.dataset.id); },
  quickJoin: () => RoomList.quick(),
  joinOpen: el => socket.emit('joinRoom', { roomCode: el.dataset.code, playerName: nick() }),
  roomsRefresh: () => RoomList.load(true),
  start: () => socket.emit('startGame'),
  stopGame: () => { if (confirm('게임을 그만하고 모두 대기실로 돌아갈까요?')) socket.emit('returnToLobby'); },
  resultLobby: () => socket.emit('returnToLobby'),
  solo: el => startSolo(el.dataset.game),
  retrySolo: el => { hideOverlay(); startSolo(el.dataset.game); },
  soloMenu: () => { hideOverlay(); stopLocal(); show('single'); },
  emoji: el => socket.emit('chat', { msg: el.dataset.e, emoji: true }),
  bet: el => { socket.emit('card:bet', el.dataset.bet); $('#card-actions').classList.add('hidden'); },
  race: el => Race.press(el),
  pen: el => Sketch.of(el).setColor(el.dataset.color, el),
  size: el => Sketch.of(el).setSize(+el.dataset.size, el),
  clearCanvas: () => { Sketches.catch.clear(); socket.emit('draw:clear'); },
  catchSkip: () => socket.emit('catch:skip'),
  liarPass: () => socket.emit('liar:pass'),
  liarVote: el => { socket.emit('liar:voteFor', el.dataset.id); $('#liar-vote-list').innerHTML = '<div class="muted">투표 완료! 다른 사람을 기다리는 중…</div>'; },
  liarGuess: () => { const v = $('#liar-guess-input').value.trim(); if (v) socket.emit('liar:guess', v); },
};
ACT.cat = el => {
  const row = el.parentElement, grid = row.nextElementSibling;
  $$('.cat-chip', row).forEach(b => b.classList.toggle('on', b === el));
  $$('.game-card', grid).forEach(c => c.classList.toggle('hidden', el.dataset.cat !== '전체' && c.dataset.cat !== el.dataset.cat));
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el);
});
// 버튼이 아닌 곳(프로필 보기 등 role="button")도 키보드 Enter · 스페이스로 누를 수 있게
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (!el || el.tagName === 'BUTTON' || el.getAttribute('role') !== 'button' || !el.dataset.act) return;
  e.preventDefault(); const fn = ACT[el.dataset.act]; if (fn) fn(el);
});
$('#join-code').addEventListener('keydown', e => { if (e.key === 'Enter') ACT.join(); });
$('#liar-guess-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) ACT.liarGuess(); });

function leaveRoom() {
  if (S.code) socket.emit('leaveRoom');
  S.code = null; S.room = null; saveRecover();
  stopLocal(); hideOverlay(); show('multi');
}

/* =====================================================================
 *  대기실
 * ===================================================================== */
function renderLobby() {
  const r = S.room; if (!r) return;
  const m = me(); if (!m) return;
  const info = GAME_INFO[r.gameType];
  const card = r.gameType === 'seotda' || r.gameType === 'poker';
  $('#lobby-title').innerHTML = `${gameIcon(r.gameType, info.cat, 'sm')}<span class="tt">${esc(info.name)} 대기실</span>`;
  $('#lobby-code').textContent = r.code;
  $('#lobby-count').textContent = `${r.players.length}명`;
  $('#lobby-privacy').innerHTML = m.isHost && !r.isStarted
    ? `<button class="btn sm ghost privacy-btn ${r.private ? 'on' : ''}" data-act="togglePrivate" title="${r.private ? '열린 방 목록에 보이게 하기' : '열린 방 목록에서 숨기기 (방 코드로만 입장)'}">${icon(r.private ? 'lock' : 'world')}${r.private ? '비공개 방' : '공개 방'}</button>`
    : `<span class="privacy-tag">${icon(r.private ? 'lock' : 'world')}${r.private ? '비공개' : '공개'}</span>`;
  $('#lobby-rules').innerHTML = `${info.rules}<button class="btn sm ghost lobby-man" data-act="manual" data-game="${r.gameType}">${icon('book')}자세한 설명서 · 머리 쓰는 법</button>`;

  // 게임 방식 선택 (섯다 2장/3장, 포커 5장/7장)
  let opt = '';
  if (card) {
    const key = r.gameType === 'seotda' ? 'seotdaType' : 'pokerType';
    const opts = r.gameType === 'seotda'
      ? [['2card', '2장 섯다', '한 장씩 2번 받으며 베팅'], ['3card', '3장 섯다', '2장 받고 1장 더! 좋은 2장 자동 선택']]
      : [['5card', '5장 포커', '히든 1 + 오픈 4 · 베팅 4번'], ['7card', '7장 포커', '히든 3 + 오픈 4 · 베팅 5번']];
    opt = `<h3>🎛️ 게임 방식</h3><div class="seg">${opts.map(([v, l, d]) =>
      `<button class="seg-btn ${r.options[key] === v ? 'on' : ''}" ${m.isHost ? `data-act="setOption" data-key="${key}" data-value="${v}"` : 'disabled'}><b>${l}</b><small>${d}</small></button>`).join('')}</div>
      ${m.isHost ? '' : '<p class="small muted">방장만 바꿀 수 있어요.</p>'}`;
  }
  const extra = typeof LOBBY_OPTIONS !== 'undefined' && LOBBY_OPTIONS[r.gameType];      // 보드게임 옵션 (봇 수 · 라운드 등)
  if (extra) opt += extra.map(o => `<h3>${o.label}</h3><div class="seg-wrap">${o.values.map(([v, l]) =>
    `<button class="seg-btn ${String(r.options[o.key] ?? o.def) === String(v) ? 'on' : ''}" ${m.isHost ? `data-act="setOption" data-key="${o.key}" data-value="${v}"` : 'disabled'}><b>${l}</b></button>`).join('')}</div>`).join('')
    + (m.isHost ? '' : '<p class="small muted">방장만 바꿀 수 있어요.</p>');
  $('#lobby-options').innerHTML = opt;

  // 자리 선택 (오목, 핑퐁)
  const roles = ROLE_INFO[r.gameType];
  if (roles) {
    const specs = r.players.filter(p => p.role === 'spectator').map(p => esc(p.name));
    $('#lobby-roles').innerHTML = `<h3>🪑 자리 선택</h3><div class="role-grid">${roles.map(([k, l]) => {
      const p = r.players.find(x => x.role === k);
      return `<button class="role-seat ${p ? 'taken' : ''} ${p && p.id === S.myId ? 'mine' : ''}" data-act="setRole" data-role="${k}"><small>${l}</small><b>${p ? esc(p.name) : '비어 있음 · 클릭해서 앉기'}</b></button>`;
    }).join('')}<button class="role-seat ${m.role === 'spectator' ? 'mine' : ''}" data-act="setRole" data-role="spectator"><small>👀 관전석</small><b>${specs.join(', ') || '없음'}</b></button></div>`;
  } else $('#lobby-roles').innerHTML = '';

  // 참가자
  $('#lobby-players').innerHTML = r.players.map(p => {
    const tags = [
      p.isHost ? '<span class="tag host">👑 방장</span>' : p.role === 'spectator' ? '<span class="tag wait">👀 관전</span>'
        : p.isReady ? '<span class="tag ready">✅ 준비 완료</span>' : '<span class="tag wait">💤 대기 중</span>',
      card ? `<span class="tag chips">💰 ${won(p.chips)}</span>` : '',
      p.away ? '<span class="tag away">📶 연결 끊김</span>' : '',
    ].join('');
    const av = (typeof Acct !== 'undefined' && Acct.lobbyAvatar(p)) || `<div class="avatar" style="background:${avColor(p.id)}">${esc(p.name[0] || '?')}</div>`;
    const kick = m.isHost && !r.isStarted && p.id !== S.myId ? `<button class="pc-kick" data-act="kick" data-id="${esc(p.id)}" data-name="${esc(p.name)}" title="내보내기" aria-label="${esc(p.name)} 내보내기">${icon('x')}</button>` : '';
    const prof = p.uid ? ` data-act="acCard" data-uid="${esc(p.uid)}" role="button" tabindex="0" title="프로필 보기"` : '';
    return `<div class="pcard ${p.id === S.myId ? 'me' : ''}">${p.uid ? `<span class="pc-who"${prof}>${av}</span>` : av}
      <div class="pinfo"><div class="pname ${p.uid ? 'link' : ''}"${prof}>${esc(p.name)}${p.id === S.myId ? ' (나)' : ''}${p.op && typeof opBadge === 'function' ? ' ' + opBadge(p.op, true) : ''}</div>${tags}${typeof Acct !== 'undefined' ? Acct.lobbyTags(p) : ''}</div>${kick}</div>`;
  }).join('');

  // 버튼
  let act = '';
  if (r.isStarted) act = '<div class="muted center">게임 진행 중…</div>';
  else if (m.isHost) act = `<button class="btn good lg" data-act="start">게임 시작</button><button class="btn ghost" data-act="openPicker">🎮 다른 게임으로 바꾸기</button><div class="small muted center">모두 준비 완료를 누르면 시작할 수 있어요.</div>`;
  else if (m.role === 'spectator') act = '<div class="muted center">관전석에서 대기 중이에요.</div>';
  else act = `<button class="btn ${m.isReady ? 'ghost' : 'good'} lg" data-act="ready">${m.isReady ? '준비 취소' : '✅ 준비 완료'}</button>`;
  $('#lobby-actions').innerHTML = act;
}

/* =====================================================================
 *  채팅 · 이모티콘 · 점수판 · 결과창
 * ===================================================================== */
function addChat(d) {
  const box = $('#chat-log');
  const div = document.createElement('div');
  div.className = 'msg' + (d.system ? ' sys' : '') + (d.id === S.myId ? ' mine' : '');
  if (d.tag) div.classList.add('tagged');
  div.innerHTML = d.system ? esc(d.msg) : `${d.tag ? `<em class="chat-tag">${esc(d.tag)}</em>` : ''}${d.op && typeof opBadge === 'function' ? opBadge(d.op, true) : ''}<b>${esc(d.name)}</b>${d.emoji ? `<span class="emo">${esc(d.msg)}</span>` : esc(d.msg)}`;
  box.append(div);
  while (box.children.length > 200) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
  // 게임 중 좁은 화면에서는 채팅창이 접혀 있어요 → 💬 버튼에 새 메시지 표시
  if (!d.system && d.id !== S.myId && document.body.classList.contains('gaming') && !document.body.classList.contains('chat-open') && CHAT_FLOAT.matches) {
    chatUnread++;
    $$('.chat-tgl').forEach(b => { b.classList.add('unread'); const i = b.querySelector('.dot'); if (i) i.textContent = chatUnread > 9 ? '9+' : chatUnread; });
  }
  if (d.emoji && !d.system) floatEmoji(d.msg, d.name);
}
let chatUnread = 0;
/** 게임 중 채팅이 💬 버튼으로 접히는 화면 (style.css 와 같은 기준: 1100px 이하 · 1400px 이하 터치 화면) */
const CHAT_FLOAT = matchMedia('(max-width:1100px), (pointer:coarse) and (max-width:1400px)');
ACT.chatToggle = () => {
  const open = document.body.classList.toggle('chat-open');
  if (open) { chatUnread = 0; $$('.chat-tgl').forEach(b => b.classList.remove('unread')); const i = $('#chat-input'); if (i && !TOUCH) i.focus(); $('#chat-log').scrollTop = 1e9; }
};
// 모든 게임 화면 제목 줄에 💬 버튼 (방에서 게임할 때 · 좁은 화면에서만 보여요)
document.addEventListener('DOMContentLoaded', () => {
  $$('.game-head [data-act=leaveGame]').forEach(b => b.insertAdjacentHTML('beforebegin', `<button class="btn ghost chat-tgl" data-act="chatToggle" aria-label="채팅" title="채팅">${icon('message-circle')}<i class="dot"></i></button>`));
});
function floatEmoji(e, name) {
  const el = document.createElement('div');
  el.className = 'float-emo';
  el.innerHTML = `${esc(e)}<small>${esc(name)}</small>`;
  el.style.left = (25 + Math.random() * 45) + 'vw';
  el.style.top = (45 + Math.random() * 25) + 'vh';
  document.body.append(el);
  setTimeout(() => el.remove(), 2300);
}
function sendChat() {
  const i = $('#chat-input'), v = i.value.trim();
  if (!v || !S.code) return;
  socket.emit('chat', { msg: v }); i.value = '';
}
ACT.sendChat = sendChat;
$('#chat-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter는 무시 (마지막 글자 중복 방지)
  e.preventDefault(); sendChat();
});

const outSet = new Set();
const SCORE_UNIT = { sudoku: '%', nonogram: '%', mine: '%', snake: '칸', bingo: '줄', race: '/50', dodge: '초', plat: '%', halli: '장', word: '단어' };
function renderScores() {
  const unit = (S.room && SCORE_UNIT[S.room.gameType]) || '';
  const html = S.scores.slice().sort((a, b) => b.score - a.score).map((p, i) =>
    `<span class="chip ${p.id === S.myId ? 'me' : ''} ${outSet.has(p.id) ? 'out' : ''}">${['🥇', '🥈', '🥉'][i] || '🏃'} ${esc(p.name)} <b>${p.score}${unit}</b></span>`).join('');
  $$('[data-scores]').forEach(el => { el.innerHTML = S.solo ? '' : html; });
}

let ovTimer = null, ovDraw = null;
function showResult(d) {
  stopLocal();
  $('#ov-title').textContent = d.title;
  $('#ov-sub').textContent = d.subtitle || '';
  $('#ov-lines').innerHTML = (d.lines || []).map(l => `<p>${esc(l)}</p>`).join('');
  $('#ov-rank').innerHTML = (d.ranking || []).map((r, i) => `<li><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${esc(r.name)}</span><b>${esc(r.value)}</b></li>`).join('');
  $('#ov-rank').style.display = d.ranking && d.ranking.length ? '' : 'none';
  if (d.solo) {
    $('#ov-actions').innerHTML = `<button class="btn good" data-act="retrySolo" data-game="${d.solo}">다시 하기</button><button class="btn ghost" data-act="soloMenu">메뉴로</button>`;
  } else {
    let n = d.returnIn || 10;
    const isHost = me() && me().isHost, watch = me() && me().role === 'spectator';
    const draw = () => {
      const rm = S.rematch || { ids: [], have: 0, need: 0 }, mine = rm.ids.includes(S.myId);
      $('#ov-actions').innerHTML = `<span class="muted ov-left">${n}초 뒤 대기실로 이동합니다</span>
        ${watch ? '' : `<button class="btn ${mine ? 'ghost' : 'good'}" data-act="rematch">${icon('repeat')}${mine ? '한 판 더 취소' : '한 판 더'}${rm.have ? ` <small class="rm-n">${rm.have}/${rm.need}</small>` : ''}</button>`}
        ${isHost ? '<button class="btn ghost" data-act="resultLobby">지금 대기실로</button>' : ''}`;
    };
    ovDraw = draw;
    draw();
    clearInterval(ovTimer);
    ovTimer = setInterval(() => { n = Math.max(0, n - 1); draw(); if (!n) clearInterval(ovTimer); }, 1000);
  }
  $('#overlay').classList.add('show');
  if (typeof Acct !== 'undefined') Acct.onResult(d);                      // 로그인했으면 기록 저장 · 경험치 표시 (account.js)
}
function hideOverlay() { clearInterval(ovTimer); ovDraw = null; $('#overlay').classList.remove('show'); }

function startSolo(game) {
  stopLocal(); hideOverlay();
  Games[game].solo();
}

/* 키보드: 지금 보고 있는 게임으로 전달 (입력창에 글을 쓰는 중이면 무시) */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
document.addEventListener('keydown', e => {
  const g = Games[S.screen];
  if (!g || typing()) return;
  Keys.add(e.code);
  if (SCROLL_KEYS.has(e.code)) e.preventDefault();   // 게임 중 방향키·스페이스로 화면이 움직이지 않게
  if (g.key) g.key(e);
});
document.addEventListener('keyup', e => {
  Keys.delete(e.code);
  const g = Games[S.screen];
  if (g && g.keyup) g.keyup(e);
});

/* ─── 터치 화면용 가상 패드: register(키, { pad: ['ArrowLeft', 'ArrowRight', '|', 'Space'] }) ─── */
const PAD_LABEL = { ArrowLeft: '◀', ArrowRight: '▶', ArrowUp: '▲', ArrowDown: '▼', Space: 'A', Enter: 'B', KeyZ: 'B' };
const TOUCH = matchMedia('(pointer: coarse)').matches;
const padEl = document.createElement('div');
padEl.id = 'vpad'; padEl.className = 'hidden';
document.body.append(padEl);
function updatePad() {
  const g = Games[S.screen];
  const stick = TOUCH && g && g.stick && typeof Stick !== 'undefined';           // 조이스틱 패드를 쓰는 게임 (stick.js)
  if (typeof Stick !== 'undefined') { if (stick) return Stick.on(g, S.screen); Stick.off(); }
  padEl.dataset.game = S.screen || '';                                          // 게임마다 패드 배치를 따로 (테트리스: 왼손 · 오른손 묶음)
  if (!TOUCH || !g || !g.pad) { padEl.classList.add('hidden'); return; }
  const cut = g.pad.indexOf('|'), L = cut < 0 ? g.pad : g.pad.slice(0, cut), R = cut < 0 ? [] : g.pad.slice(cut + 1);
  const btn = c => `<button data-code="${c}">${(g.padLabel && g.padLabel[c]) || PAD_LABEL[c] || c}</button>`;
  const cross = l => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].every(c => l.includes(c)) ? ' cross'   // 4방향 → 가로 화면에서 십자 모양
    : l.length === 3 && ['ArrowLeft', 'ArrowRight', 'ArrowDown'].every(c => l.includes(c)) ? ' tee' : '';               // ◀ ▶ 위 · ▼ 아래 (테트리스)
  padEl.innerHTML = `<div class="pad-l${cross(L)}">${L.map(btn).join('')}</div><div class="pad-r${cross(R)}">${R.map(btn).join('')}</div>`;
  padEl.classList.remove('hidden');
}
/** 터치 판: 이 게임 화면이 보이는 동안 화면 어디를 눌러도 — 게임 판 바깥 빈 곳(양옆 검은 부분 · 아래 여백)까지 — 게임 조작으로 받아요.
 *  손가락이 판 밖으로 나가도 조작이 끊기지 않아요. 버튼 · 입력칸 · 제목 줄 · 점수 막대 · 채팅 · 창 · 패드는 원래대로 눌려요.
 *  게임 파일에서 TouchArea.add('화면', { down, move, up, cancel, mouse }) — mouse: true 면 마우스도 받아요 */
const TouchArea = {
  on: {}, cur: null,
  add(screen, h) { this.on[screen] = h; },
  SKIP: 'button, a, input, select, textarea, label, .game-head, .scorebar, .topbar, #vpad, .chat, .overlay, .modal, #ac-invites, .man-hint, .toast, .ac-modal, #fl-cele',
  pick(e) {
    const h = this.on[S.screen], t = e.target;
    if (!h || (e.pointerType === 'mouse' && !h.mouse) || !(t instanceof Element) || t.closest(this.SKIP)) return null;
    if ($('#overlay') && $('#overlay').classList.contains('show')) return null;
    const sec = document.getElementById('scr-' + S.screen);
    return sec && (sec.contains(t) || t === document.body || t === document.documentElement || t.matches('.shell, #main')) ? h : null;
  },
};
document.addEventListener('pointerdown', e => {
  const c0 = TouchArea.cur;
  if (c0 && c0.screen === S.screen && performance.now() - c0.t < 4000) return;     // 손가락 하나만 (4초 넘게 남은 건 놓친 것으로 보고 새로)
  const h = TouchArea.pick(e); if (!h) { TouchArea.cur = null; return; }
  TouchArea.cur = { h, id: e.pointerId, t: performance.now(), screen: S.screen };
  if (e.pointerType !== 'mouse') e.preventDefault();
  h.down(e);
}, { passive: false });
document.addEventListener('pointermove', e => { const c = TouchArea.cur; if (c && c.id === e.pointerId) { c.t = performance.now(); if (c.h.move) c.h.move(e); } }, { passive: false });
window.addEventListener('blur', () => { const c = TouchArea.cur; TouchArea.cur = null; if (c && c.h.cancel) c.h.cancel(); });
document.addEventListener('pointerup', e => { const c = TouchArea.cur; if (c && c.id === e.pointerId) { TouchArea.cur = null; if (c.h.up) c.h.up(e); } });
document.addEventListener('pointercancel', e => { const c = TouchArea.cur; if (c && c.id === e.pointerId) { TouchArea.cur = null; if (c.h.cancel) c.h.cancel(e); } });
const fakeKey = (code, repeat = false) => ({ code, key: code === 'Space' ? ' ' : code, repeat, preventDefault() {} });
let padRep = null, padRepCode = null;               // 누르고 있으면 되풀이 (register 의 padRepeat: 테트리스 옆으로 · 아래로)
const padRepStop = () => { clearTimeout(padRep); clearInterval(padRep); padRep = null; padRepCode = null; };
padEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-code]'); if (!b) return;
  e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
  const code = b.dataset.code; Keys.add(code);
  const g = Games[S.screen]; if (g && g.key) g.key(fakeKey(code));
  if (g && g.key && g.padRepeat && g.padRepeat.includes(code)) {
    padRepStop(); padRepCode = code;
    padRep = setTimeout(() => { padRep = setInterval(() => { if (Games[S.screen] === g && Keys.has(code)) g.key(fakeKey(code, true)); else padRepStop(); }, 60); }, 190);
  }
});
['pointerup', 'pointercancel'].forEach(t => padEl.addEventListener(t, e => {
  const b = e.target.closest('[data-code]'); if (!b) return;
  if (padRepCode === b.dataset.code) padRepStop();
  b.classList.remove('on'); Keys.delete(b.dataset.code);
  const g = Games[S.screen]; if (g && g.keyup) g.keyup(fakeKey(b.dataset.code));
}));

/* 홈: 새로 나온 게임 진열대 (누르면 바로 싱글, 멀티 전용이면 멀티 메뉴로) */
$('#home-new').innerHTML = Object.entries(GAME_INFO).filter(([, g]) => g.isNew).map(([k, g]) =>
  `<button class="home-chip" data-act="homeNew" data-game="${k}">${gameIcon(k, g.cat, 'sm')}<span><b>${esc(stripEmoji(g.name))}</b><small>${esc(g.desc)}</small></span></button>`).join('');
ACT.homeNew = el => { const k = el.dataset.game; if (SOLO_GAMES.some(g => g[0] === k)) { nick(); startSolo(k); } else { ACT.goMulti(); toast(`${GAME_INFO[k].name}은(는) 친구들과 하는 게임이에요. 방을 만들어 보세요!`); } };
/* 정적 HTML의 아이콘 자리 채우기 + 예전 화면 제목의 이모지도 아이콘 타일로 */
$$('.gh-title h2').forEach(h => { if (h.querySelector('.gi')) return; const sec = h.closest('section'), id = sec ? sec.id.replace(/^scr-/, '') : ''; h.innerHTML = `${gameIcon(id, catOf(id), 'sm')}<span class="tt">${esc(stripEmoji(h.textContent))}</span>`; });
$$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
