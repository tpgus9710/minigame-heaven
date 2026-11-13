/* =====================================================================
 *  ☔ 산성비 타자 (싱글: 산성도 100% 되면 끝 / 멀티: 먼저 친 사람이 점수)
 *  v13.7: 한글 · 영어(영타) — 싱글은 들어올 때 고르는 카드(#rain-pick) · 하는 중에는 위쪽 [한글 | 영어]로 바꿔요 (새 판)
 *         멀티는 대기실 옵션 「⌨️ 타자」(서버 games/rain.js) · 영어 단어 · 비교: shared/rain-en.js
 *         기록: 한글 'rain' · 영어 'rain:en' (순위표도 따로)
 * ===================================================================== */
const RAIN_WORDS = ('사과 바나나 포도 딸기 수박 참외 복숭아 자두 레몬 키위 망고 하늘 바다 구름 바람 무지개 햇살 노을 별빛 달빛 눈사람 ' +
  '우산 장화 학교 교실 칠판 연필 지우개 공책 가방 친구 선생님 운동장 도서관 컴퓨터 키보드 마우스 모니터 스피커 로봇 드론 ' +
  '자동차 기차 비행기 자전거 지하철 버스 택시 강아지 고양이 토끼 거북이 호랑이 사자 코끼리 기린 펭귄 다람쥐 ' +
  '햄버거 피자 치킨 떡볶이 김밥 라면 짜장면 비빔밥 냉면 만두 초콜릿 아이스크림 케이크 쿠키 사탕 우유 커피 녹차 ' +
  '축구 야구 농구 배구 수영 태권도 줄넘기 달리기 등산 낚시 피아노 기타 바이올린 드럼 노래 그림 사진 영화 만화 소설 ' +
  '행복 사랑 우정 희망 용기 기쁨 감사 열정 미래 서울 부산 대구 영천 제주도 한강 남산 설악산 경주 독도 대한민국 무궁화 ' +
  '태극기 한글 세종대왕 이순신 거북선 첨성대 불국사 석굴암 프로그래밍 알고리즘 인공지능 자율주행 센서 모터 회로 전압 전류 저항').split(' ');
const RAIN_LANG = { ko: '한글', en: '영어' };

const Rain = {
  lang: store.get('rain-lang', 'ko') === 'en' ? 'en' : 'ko',
  /** 싱글로 들어오기: 메뉴에서 오면 고르는 카드 · 「다시 하기」면 같은 타자로 바로 */
  enter() {
    if (isScreen('rain') && this.solo && this.picked) return this.start(true);
    this.choose();
  },
  bestOf(lang) { return +store.get(lang === 'en' ? 'best-rain-en' : 'best-rain', 0) || 0; },
  /** 한글 · 영어 고르는 카드 (판은 아직 시작 안 해요) */
  choose() {
    stopLocal();
    this.solo = true; this.picked = false; this.over = true; S.solo = 'rain';
    this.words = new Map(); this.score = 0; this.acid = 0;
    $$('#rain-field .rain-word').forEach(el => el.remove());
    const inp = $('#rain-input');
    inp.value = ''; inp.disabled = true; inp.placeholder = '위에서 한글 · 영어를 골라요';
    $('#rain-acid-box').classList.remove('hidden');
    $('#rain-time-box').classList.add('hidden');
    $('#rain-modes').classList.add('hidden');
    for (const l of ['ko', 'en']) { const b = this.bestOf(l); $('#rain-pb-' + l).textContent = b ? `최고 ${b.toLocaleString()}점` : '첫 기록 도전!'; }
    const had = store.get('rain-lang', null) !== null;   // 한 번이라도 골랐을 때만 「지난번」 표시
    $$('#rain-pick .pick-opt').forEach(b => b.classList.toggle('last', had && b.dataset.l === this.lang));
    $('#rain-pick').classList.remove('hidden');
    $('#rain-status').textContent = '한글 · 영어(영타) 중에서 골라요. 단어가 바닥에 닿기 전에 쳐서 없애요!';
    show('rain'); renderScores(); this.hud();
    setTimeout(() => { const b = $(`#rain-pick .pick-opt[data-l="${this.lang}"]`); if (b && !TOUCH) b.focus(); }, 60);
  },
  start(solo, seconds, lang) {
    stopLocal();
    if (lang) this.lang = lang === 'en' ? 'en' : 'ko';
    if (solo) store.set('rain-lang', this.lang);
    this.solo = solo; this.picked = solo; S.solo = solo ? 'rain' : null;
    this.words = new Map(); this.seq = 0; this.score = 0; this.acid = 0; this.over = false; this.t0 = Date.now();
    this.best = solo ? this.bestOf(this.lang) : 0; this.rec = false;
    $$('#rain-field .rain-word').forEach(el => el.remove());
    $('#rain-pick').classList.add('hidden');
    const en = this.lang === 'en', inp = $('#rain-input');
    inp.value = ''; inp.disabled = false;
    inp.lang = en ? 'en' : 'ko';
    inp.placeholder = en ? '영어 단어를 입력하고 Enter!' : '단어를 입력하고 Enter!';
    $('#scr-rain').classList.toggle('rain-en', en);
    $('#rain-acid-box').classList.toggle('hidden', !solo);
    $('#rain-time-box').classList.toggle('hidden', solo);
    $('#rain-modes').classList.toggle('hidden', !solo);
    $$('#rain-modes .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.l === this.lang));
    $('#rain-status').textContent = solo
      ? `${en ? '⌨️ 영어 — ' : ''}단어가 바닥에 닿으면 산성도가 올라가요. 100%가 되면 끝!${this.best ? ` (최고 ${this.best.toLocaleString()}점)` : ''}`
      : `${en ? '⌨️ 영어 — ' : ''}모두에게 같은 단어가 내려요. 먼저 친 사람이 점수를 가져갑니다!`;
    show('rain'); renderScores(); this.hud();
    try { inp.focus({ preventScroll: true }); } catch { /* 무시 */ }   // 고르는 카드를 누른 그 순간에 (아이폰 키보드)
    setTimeout(() => inp.focus(), 50);
    if (solo) after(800, () => this.spawnSolo());
    else { this.endAt = Date.now() + 2000 + seconds * 1000; every(250, () => { $('#rain-time').textContent = secLeft(this.endAt); }); }
  },
  level() { return 1 + Math.floor(this.score / 400); },
  /** 이번에 떨어뜨릴 단어 목록 (영어는 단계가 낮을 때 짧은 단어부터) */
  list() { return this.lang === 'en' ? RainEN.upTo(this.level()) : RAIN_WORDS; },
  spawnSolo() {
    if (this.over || !isScreen('rain')) return;
    const lv = this.level(), list = this.list();
    const active = new Set([...this.words.values()].map(w => w.text));
    let text = list[rand(list.length)];
    for (let i = 0; i < 6 && active.has(text); i++) text = list[rand(list.length)];
    this.add(++this.seq, text, 0.03 + Math.random() * 0.8, Math.max(3800, 10000 - lv * 550));
    after(Math.max(650, 2100 - lv * 140), () => this.spawnSolo());
  },
  add(id, text, x, dur) {
    const field = $('#rain-field');
    const el = document.createElement('div');
    el.className = 'rain-word'; el.textContent = text; el.style.left = (x * 100) + '%';
    field.append(el);
    const fall = field.clientHeight - 34;
    const anim = el.animate([{ transform: 'translateY(-36px)' }, { transform: `translateY(${fall}px)` }], { duration: dur, easing: 'linear', fill: 'forwards' });
    const gen = S.gen;
    anim.onfinish = () => {
      if (gen !== S.gen || !this.words.has(id)) return;
      this.words.delete(id);
      el.classList.add('splash');
      setTimeout(() => el.remove(), 500);
      if (this.solo) this.miss();
    };
    this.words.set(id, { text, el, anim });
  },
  hit(id, label, mine) {
    const w = this.words.get(id);
    if (!w) return;
    this.words.delete(id);
    const tf = getComputedStyle(w.el).transform;
    w.anim.cancel(); w.el.style.transform = tf;
    w.el.dataset.by = label;
    w.el.classList.add('pop', mine ? 'mine' : 'other');
    setTimeout(() => w.el.remove(), 650);
  },
  /** 친 글자 → 비교할 글자 (영어: 한글 자판으로 쳤어도 누른 키로 · 소문자) */
  typed(v) { return this.lang === 'en' ? RainEN.norm(v) : String(v).replace(/\s/g, ''); },
  submit() {
    const inp = $('#rain-input'), raw = inp.value;
    inp.value = '';
    if (this.over) return;
    const v = this.typed(raw);
    if (!v) return;
    if (!this.solo) return socket.emit('rain:type', v);
    let found = null;
    for (const [id, w] of this.words) if (w.text === v && (found === null || id < found)) found = id;
    if (found === null) return this.wrong();
    this.score += v.length * 10;
    this.hit(found, `+${v.length * 10}`, true);
    this.acid = Math.max(0, this.acid - 2);
    this.hud();
    if (!this.rec && this.best && this.score > this.best) { this.rec = true; $('#rain-status').textContent = '🎉 신기록 갱신 중!'; }
  },
  wrong() { const inp = $('#rain-input'); inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); },
  miss() {
    this.acid = Math.min(100, this.acid + 10); this.hud();
    $('#rain-field').classList.remove('acid-hit'); void $('#rain-field').offsetWidth; $('#rain-field').classList.add('acid-hit');
    if (this.acid >= 100) {
      this.over = true;
      const en = this.lang === 'en', key = en ? 'best-rain-en' : 'best-rain';
      const prev = this.bestOf(this.lang), best = Math.max(prev, this.score); store.set(key, best);
      after(400, () => showResult({ title: '☔ 산성도 100%!', subtitle: `${RAIN_LANG[this.lang]} · ${this.level()}단계 · 점수 ${this.score.toLocaleString()}${this.score > prev && prev ? ' · 🎉 신기록!' : ` · 최고 점수 ${best.toLocaleString()}`}`, solo: 'rain', rec: en ? { k: 'en', v: this.score } : { v: this.score } }));
    }
  },
  hud() {
    $('#rain-score').textContent = this.score.toLocaleString();
    $('#rain-acid').textContent = this.acid + '%';
    $('#rain-acid-bar').style.width = this.acid + '%';
    $('#rain-level').textContent = this.solo ? this.level() + '단계' : '대결';
  },
};
$('#rain-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter는 무시
  e.preventDefault(); Rain.submit();
});
Object.assign(ACT, {
  rainPick: el => Rain.start(true, 0, el.dataset.l),                       // 고르는 카드
  rainLang: el => { if (Rain.solo) Rain.start(true, 0, el.dataset.l); },  // 하는 중에 바꾸기 (새 판)
});
register('rain', {
  solo: () => Rain.enter(), stop: () => { Rain.over = true; },
  // 고르는 카드: 1 한글 · 2 영어 (입력 칸이 꺼져 있을 때만)
  key: e => { if (!$('#rain-pick').classList.contains('hidden') && (e.key === '1' || e.key === '2')) { e.preventDefault(); Rain.start(true, 0, e.key === '1' ? 'ko' : 'en'); } },
});
// 판 높이가 바뀌면(화면 맞춤 · 키보드) 떨어지고 있는 단어의 거리도 다시 맞춰요 — 바닥에 닿는 시간은 그대로
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => {
  if (!Rain.words) return;
  const fall = $('#rain-field').clientHeight - 34;
  for (const w of Rain.words.values()) if (w.anim && w.anim.effect && w.anim.effect.setKeyframes) w.anim.effect.setKeyframes([{ transform: 'translateY(-36px)' }, { transform: `translateY(${fall}px)` }]);
}).observe($('#rain-field'));
// 휴대폰 키보드가 판을 가리면 가린 높이(--kb)만큼 판을 줄여 바닥까지 보이게 (fit-d.css) · 키보드가 올라오면 [한글 | 영어] 줄은 접어요
if (window.visualViewport) {
  const kb = () => {
    const vv = window.visualViewport, inp = $('#rain-input');
    let v = 0;
    if (isScreen('rain') && document.activeElement === inp && Math.abs((vv.scale || 1) - 1) < 0.01) {
      const base = (typeof Fit !== 'undefined' && Fit.last && Fit.last.ih) || window.innerHeight;
      v = Math.round(base - vv.height - vv.offsetTop);
      if (v < 80) v = 0;                                       // 주소창이 줄어드는 정도는 무시
    }
    $('#scr-rain').style.setProperty('--kb', v + 'px');
    $('#scr-rain').classList.toggle('kb-open', v > 0);
  };
  visualViewport.addEventListener('resize', kb);
  visualViewport.addEventListener('scroll', kb);
  $('#rain-input').addEventListener('focus', () => setTimeout(kb, 350));
  $('#rain-input').addEventListener('blur', () => setTimeout(kb, 100));
}
socket.on('rain:start', d => Rain.start(false, d.seconds, d.lang));
socket.on('rain:word', d => { if (isScreen('rain') && !Rain.solo) Rain.add(d.id, d.text, d.x, d.dur); });
socket.on('rain:hit', d => {
  const mine = d.by === S.myId;
  if (mine) { Rain.score += d.pts; Rain.hud(); }
  Rain.hit(d.id, mine ? `+${d.pts}` : `${d.name} +${d.pts}`, mine);
});
socket.on('rain:miss', () => Rain.wrong());
// 대기실 옵션 (서버 games/rain.js 의 OPTIONS 와 같아요) — LOBBY_OPTIONS 는 뒤에 읽는 table.js 에 있어서 다 읽은 뒤에 넣어요
document.addEventListener('DOMContentLoaded', () => {
  LOBBY_OPTIONS.rain = [{ key: 'rainLang', label: '⌨️ 타자', def: 'ko', values: [['ko', '한글'], ['en', '영어 (영타)']] }];
});
