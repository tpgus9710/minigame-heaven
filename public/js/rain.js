/* =====================================================================
 *  ☔ 산성비 타자 (싱글: 산성도 100% 되면 끝 / 멀티: 먼저 친 사람이 점수)
 * ===================================================================== */
const RAIN_WORDS = ('사과 바나나 포도 딸기 수박 참외 복숭아 자두 레몬 키위 망고 하늘 바다 구름 바람 무지개 햇살 노을 별빛 달빛 눈사람 ' +
  '우산 장화 학교 교실 칠판 연필 지우개 공책 가방 친구 선생님 운동장 도서관 컴퓨터 키보드 마우스 모니터 스피커 로봇 드론 ' +
  '자동차 기차 비행기 자전거 지하철 버스 택시 강아지 고양이 토끼 거북이 호랑이 사자 코끼리 기린 펭귄 다람쥐 ' +
  '햄버거 피자 치킨 떡볶이 김밥 라면 짜장면 비빔밥 냉면 만두 초콜릿 아이스크림 케이크 쿠키 사탕 우유 커피 녹차 ' +
  '축구 야구 농구 배구 수영 태권도 줄넘기 달리기 등산 낚시 피아노 기타 바이올린 드럼 노래 그림 사진 영화 만화 소설 ' +
  '행복 사랑 우정 희망 용기 기쁨 감사 열정 미래 서울 부산 대구 영천 제주도 한강 남산 설악산 경주 독도 대한민국 무궁화 ' +
  '태극기 한글 세종대왕 이순신 거북선 첨성대 불국사 석굴암 프로그래밍 알고리즘 인공지능 자율주행 센서 모터 회로 전압 전류 저항').split(' ');

const Rain = {
  start(solo, seconds) {
    stopLocal();
    this.solo = solo; S.solo = solo ? 'rain' : null;
    this.words = new Map(); this.seq = 0; this.score = 0; this.acid = 0; this.over = false; this.t0 = Date.now();
    $$('#rain-field .rain-word').forEach(el => el.remove());
    $('#rain-input').value = '';
    $('#rain-acid-box').classList.toggle('hidden', !solo);
    $('#rain-time-box').classList.toggle('hidden', solo);
    $('#rain-status').textContent = solo
      ? '단어가 바닥에 닿으면 산성도가 올라가요. 100%가 되면 끝!'
      : '모두에게 같은 단어가 내려요. 먼저 친 사람이 점수를 가져갑니다!';
    show('rain'); renderScores(); this.hud();
    setTimeout(() => $('#rain-input').focus(), 50);
    if (solo) after(800, () => this.spawnSolo());
    else { this.endAt = Date.now() + 2000 + seconds * 1000; every(250, () => { $('#rain-time').textContent = secLeft(this.endAt); }); }
  },
  level() { return 1 + Math.floor(this.score / 400); },
  spawnSolo() {
    if (this.over || !isScreen('rain')) return;
    const lv = this.level();
    const active = new Set([...this.words.values()].map(w => w.text));
    let text = RAIN_WORDS[rand(RAIN_WORDS.length)];
    for (let i = 0; i < 6 && active.has(text); i++) text = RAIN_WORDS[rand(RAIN_WORDS.length)];
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
  submit() {
    const inp = $('#rain-input'), v = inp.value.replace(/\s/g, '');
    inp.value = '';
    if (!v || this.over) return;
    if (!this.solo) return socket.emit('rain:type', v);
    let found = null;
    for (const [id, w] of this.words) if (w.text === v && (found === null || id < found)) found = id;
    if (found === null) return this.wrong();
    this.score += v.length * 10;
    this.hit(found, `+${v.length * 10}`, true);
    this.acid = Math.max(0, this.acid - 2);
    this.hud();
  },
  wrong() { const inp = $('#rain-input'); inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); },
  miss() {
    this.acid = Math.min(100, this.acid + 10); this.hud();
    $('#rain-field').classList.remove('acid-hit'); void $('#rain-field').offsetWidth; $('#rain-field').classList.add('acid-hit');
    if (this.acid >= 100) {
      this.over = true;
      const best = Math.max(+store.get('best-rain', 0), this.score); store.set('best-rain', best);
      after(400, () => showResult({ title: '☔ 산성도 100%!', subtitle: `${this.level()}단계 · 점수 ${this.score.toLocaleString()} · 최고 점수 ${best.toLocaleString()}`, solo: 'rain', rec: { v: this.score } }));
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
register('rain', { solo: () => Rain.start(true), stop: () => { Rain.over = true; } });
socket.on('rain:start', d => Rain.start(false, d.seconds));
socket.on('rain:word', d => { if (isScreen('rain') && !Rain.solo) Rain.add(d.id, d.text, d.x, d.dur); });
socket.on('rain:hit', d => {
  const mine = d.by === S.myId;
  if (mine) { Rain.score += d.pts; Rain.hud(); }
  Rain.hit(d.id, mine ? `+${d.pts}` : `${d.name} +${d.pts}`, mine);
});
socket.on('rain:miss', () => Rain.wrong());
