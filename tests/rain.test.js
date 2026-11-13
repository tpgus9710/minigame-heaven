// ☔ 산성비 타자 v13.7 검사 — 영어(영타) 단어 · 한글 자판 → 영어 키 바꾸기 · 서버 대결(한글 · 영어) · 기록 키
const fs = require('fs');
const path = require('path');
const EN = require('../public/js/shared/rain-en.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

console.log('▶ 영어 단어');
{
  const bad = EN.WORDS.filter(w => !/^[a-z]{3,10}$/.test(w));
  ok(EN.WORDS.length >= 250, `영어 단어 ${EN.WORDS.length}개 (250개 이상)`);
  ok(!bad.length, '모두 소문자 3 ~ 10글자', bad.join(', '));
  ok(new Set(EN.WORDS).size === EN.WORDS.length, '겹치는 단어 없음');
  ok(EN.upTo(1).every(w => w.length <= 5) && EN.upTo(1).length >= 60, `1단계는 5글자까지 (${EN.upTo(1).length}개)`);
  ok(EN.upTo(6).length === EN.WORDS.length, '6단계부터 모든 단어');
}

console.log('▶ 한/영 키를 깜빡하고 한글 자판으로 쳐도 (두벌식 → 누른 키)');
{
  // 한글 입력기 그대로 영어 단어를 치면 나오는 글자 (손으로 확인한 것)
  const cases = [['메ㅔㅣㄷ', 'apple'], ['개ㅠㅐㅅ', 'robot'], ['ㅎ믇', 'game'], ['ㅗ디ㅣㅐ', 'hello'], ['ㅇ개ㅜㄷ', 'drone'], ['앻', 'dog'],
    ['개찯ㅅ', 'rocket'], ['나ㅛ', 'sky'], ['ㅔㅙㅜㄷ', 'phone'], ['ㅣㅑ홋', 'light'], ['ㄴㅅㅁㄳ', 'start'], ['ㄴ쵀ㅐㅣ', 'school']];
  const wrong = cases.filter(([a, b]) => EN.norm(a) !== b).map(([a, b]) => `${a}→${EN.norm(a)}(≠${b})`);
  ok(!wrong.length, `${cases.length}가지 모두 영어로 (메ㅔㅣㄷ → apple · ㅔㅙㅜㄷ → phone · ㄴㅅㅁㄳ → start)`, wrong.join(' '));
  ok(EN.norm('Apple') === 'apple' && EN.norm(' ap ple ') === 'apple' && EN.norm('APPLE') === 'apple', '대문자 · 띄어쓰기는 상관없어요');
  ok(EN.norm('ㅃ') === 'q' && EN.keys('ㅃ') === 'Q', 'Shift 자모(ㅃ ㅉ ㄸ ㄲ ㅆ)는 대문자 키 → 소문자');
  // 모든 영어 단어: 한글 자판으로 친 결과를 만들어도 다시 그 단어로 (자모 → 키를 거꾸로 해서 낱자로 만들어 봐요)
  const JAMO = 'ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const single = {};
  for (const ch of JAMO) { const k = EN.keys(ch); if (k.length === 1) single[k] = ch; }
  const miss = EN.WORDS.filter(w => EN.norm([...w].map(c => single[c] || c).join('')) !== w);
  ok(!miss.length, `영어 단어 ${EN.WORDS.length}개 모두 낱자로 친 것도 맞아요`, miss.slice(0, 5).join(', '));
}

console.log('▶ 서버 대결 (한글 · 영어)');
{
  const G = require('../games/rain.js');
  ok(G.OPTIONS.length === 1 && G.OPTIONS[0].key === 'rainLang' && G.OPTIONS[0].def === 'ko' && G.OPTIONS[0].values.map(v => v[0]).join() === 'ko,en', '대기실 옵션 「⌨️ 타자」 한글(기본) · 영어');
  const client = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'rain.js'), 'utf8');
  ok(/LOBBY_OPTIONS\.rain = \[\{ key: 'rainLang', label: '⌨️ 타자', def: 'ko', values: \[\['ko', '한글'\], \['en', '영어 \(영타\)'\]\] \}\]/.test(client), '화면 대기실 옵션도 서버와 같아요');
  const run = lang => {
    const ev = [], timers = [], me = [];
    const H = {
      emit: (room, e, d) => ev.push([e, d]), later: (room, ms, fn) => timers.push(fn), pick: a => a[Math.floor(Math.random() * a.length)],
      pushScores: () => {}, participants: room => room.players, finishGame: () => {}, rankScores: () => [], toPlayer: (id, e, d) => me.push([id, e, d]),
      normWord: w => String(w ?? '').replace(/\s/g, ''),
    };
    const mod = G(H), room = { players: [{ id: 'a', name: '가', score: 0 }, { id: 'b', name: '나', score: 0 }], options: lang ? { rainLang: lang } : {} };
    mod.start(room);
    timers.splice(0, 1)[0]();                                     // 첫 단어
    const st = ev.find(([e]) => e === 'rain:start')[1], w = ev.find(([e]) => e === 'rain:word')[1];
    return { mod, room, ev, me, st, w };
  };
  const ko = run();
  ok(ko.st.lang === 'ko' && /^[가-힣]+$/.test(ko.w.text), `옵션이 없으면 한글 (${ko.w.text})`);
  ko.mod.events['rain:type'](ko.room, ko.room.players[0], ko.w.text);
  ok(ko.ev.some(([e, d]) => e === 'rain:hit' && d.by === 'a' && d.pts === ko.w.text.length * 10), '한글: 친 사람이 글자 수 × 10점');
  const en = run('en');
  ok(en.st.lang === 'en' && EN.WORDS.includes(en.w.text), `영어: 영어 단어가 떨어져요 (${en.w.text})`);
  const JA = { a: 'ㅁ', b: 'ㅠ', c: 'ㅊ', d: 'ㅇ', e: 'ㄷ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', i: 'ㅑ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ', m: 'ㅡ', n: 'ㅜ', o: 'ㅐ', p: 'ㅔ', q: 'ㅂ', r: 'ㄱ', s: 'ㄴ', t: 'ㅅ', u: 'ㅕ', v: 'ㅍ', w: 'ㅈ', x: 'ㅌ', y: 'ㅛ', z: 'ㅋ' };
  en.mod.events['rain:type'](en.room, en.room.players[1], [...en.w.text].map(c => JA[c]).join(''));
  ok(en.ev.some(([e, d]) => e === 'rain:hit' && d.by === 'b' && d.pts === en.w.text.length * 10), '영어: 한글 자판으로 쳐도 맞아요 (서버도 같은 방법으로 확인)');
  en.mod.events['rain:type'](en.room, en.room.players[0], 'zzzz');
  ok(en.me.some(([id, e]) => id === 'a' && e === 'rain:miss'), '없는 단어는 친 사람에게만 miss');
  const en2 = run('en');
  en2.mod.events['rain:type'](en2.room, en2.room.players[0], en2.w.text.toUpperCase());
  ok(en2.ev.some(([e, d]) => e === 'rain:hit' && d.by === 'a'), '영어: 대문자로 쳐도 맞아요');
  const bad = run('xx');
  ok(bad.st.lang === 'ko', '이상한 옵션 값은 한글');
}

console.log('▶ 기록 · 순위표 키 (산성비 한글 · 영어 / 테트리스 보스전 · 일반전)');
{
  const acc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'account.js'), 'utf8');
  ok(["['rain', '']", "['rain:en', '']", "['tetris', '']", "['tetris:normal', '']"].every(k => acc.includes(k)), '순위표 목록에 rain · rain:en · tetris · tetris:normal');
  ok(/rain: '한글', 'rain:en': '영어', tetris: '보스전', 'tetris:normal': '일반전'/.test(acc), '순위표 버튼 이름 (한글 · 영어 · 보스전 · 일반전)');
  const rain = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'rain.js'), 'utf8'), tet = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tetris.js'), 'utf8');
  ok(rain.includes("rec: en ? { k: 'en', v: this.score } : { v: this.score }"), '산성비 영어 기록은 rain:en · 한글은 예전 그대로 rain');
  ok(tet.includes("rec: { k: 'normal', v: this.score }") && tet.includes("solo: 'tetris', win: true, rec: { v: this.score }"), '테트리스 일반전 기록은 tetris:normal · 보스전은 예전 그대로 tetris');
  const board = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'board.js'), 'utf8');
  ok(board.includes("base === 'rain' && typeof Rain !== 'undefined' ? Rain.lang") && board.includes("base === 'tetris' && typeof Tetris !== 'undefined' ? Tetris.mode"), '게임 화면 「순위」 버튼은 지금 고른 종류의 순위표');
}

console.log('▶ 테트리스 일반전 속도');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tetris.js'), 'utf8');
  const m = src.match(/speed\(lv\) \{ (return [^}]+) \}/);
  const speed = m && new Function('lv', m[1]);
  const v = speed ? [1, 5, 10, 13, 20].map(speed) : [];
  ok(speed && v[0] === 1000 && v[1] > 300 && v[1] < 400 && v[2] < 80 && v[3] < 25 && v[4] === 16 && v.every((x, i) => !i || x <= v[i - 1]), `레벨 1 · 5 · 10 · 13 · 20 → ${v.join(' · ')}ms (점점 빨라져요)`);
  ok(src.includes('this.lockMs = normal ? Math.max(this.dropMs, 500) : 0') && src.includes('this.resets < 15'), '일반전만 바닥에 닿은 뒤 0.5초 여유 (옮기면 다시 · 15번까지) · 보스전 · 배틀은 그대로');
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
