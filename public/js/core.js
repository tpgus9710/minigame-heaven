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
  window.scrollTo({ top: 0 });
}
const isScreen = id => S.screen === id;

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
    rules: '문제마다 10초 안에 ⭕ 또는 ❌를 골라요. 맞히면 10점 + <b>빨리 고를수록 보너스</b>(최대 5점). 15문제가 끝나면 점수가 가장 높은 사람이 우승!' },
  word: { icon: '🔤', name: '끝말잇기', desc: '앞 사람 끝 글자로 단어 잇기', cat: '파티', players: '2~8명',
    rules: '앞 단어의 <b>끝 글자로 시작하는 단어</b>를 입력해요 (두음법칙 OK, 2글자 이상, 이미 나온 단어 X). 제한 시간은 점점 짧아져요. 이상한 단어는 다른 사람들이 👎로 거절할 수 있어요. 실패하면 ❤️를 하나 잃고, 다 잃으면 탈락!' },
  mole: { icon: '🔨', name: '두더지 잡기 대결', desc: '먼저 때리는 사람이 임자', cat: '파티', players: '1~8명',
    rules: '모두 <b>같은 두더지 판</b>을 봐요. 두더지가 올라오면 먼저 클릭한 사람이 점수! 🐹 +1 · 황금 두더지 +3 · 💣 폭탄 -3. 1분 동안 점수가 가장 높은 사람이 우승.' },
  gem: { icon: '💎', name: '보석 맞추기 대결', desc: '1분 동안 보석 점수 대결', cat: '퍼즐', players: '1~8명',
    rules: '모두 같은 판으로 시작해요. 이웃한 보석을 바꿔 <b>같은 보석 3개 이상</b>을 이어요. 4개를 맞추면 줄 폭탄, 5개면 무지개 보석! 연쇄가 터질수록 점수가 커져요. 1분 뒤 최고 점수가 우승.' },
  fruit: { icon: '🍉', name: '과일 합치기 대결', desc: '같은 과일을 합쳐 수박까지', cat: '퍼즐', players: '1~8명',
    rules: '과일을 떨어뜨려 <b>같은 과일끼리 닿으면 한 단계 큰 과일</b>로 합쳐져요. 모두 같은 순서로 과일이 나와요. 2분이 지나거나 선을 넘기면 끝! 점수가 가장 높은 사람이 우승.' },
  marble: { icon: '🌍', name: '세계여행 보드게임', desc: '도시를 사고 건물을 지어 통행료로 부자 되기', cat: '보드·카드', players: '2~4명 · 봇 가능',
    rules: '부루마블 방식! 주사위를 굴려 도시를 사고 <b>별장·빌딩·호텔·랜드마크</b>를 지어요. 남의 땅에 서면 통행료, 같은 색 도시를 다 모으면 통행료 2배! 황금열쇠 · 무인도(더블이면 탈출) · 사회복지기금 · 세계여행(원하는 칸으로 이동). 돈이 모자라면 건물과 땅을 팔고, 그래도 안 되면 파산. 정한 라운드가 끝나면 총자산 1등이 우승!' },
  life: { icon: '🎓', name: '인생 보드게임', desc: '룰렛으로 달리는 인생 역전 레이스', cat: '보드·카드', players: '2~6명 · 봇 가능',
    rules: '룰렛(1~10)을 돌려 인생길을 달려요. 첫 갈림길에서 <b>대학(학자금 대출, 고소득 직업)</b>과 <b>바로 취업</b> 중 선택! 월급날은 지나가기만 해도 월급을 받고, 결혼 · 출산이면 모두가 축하금을 줘요. 집을 사면 은퇴 때 더 비싸게 팔 수 있고, 보람 카드 점수는 은퇴 때 공개돼요. 두 번째 갈림길은 안정의 길과 모험의 길(투자 · 창업). 모두 은퇴하면 <b>현금+집+보람 카드+자녀-대출×1.25</b> 총재산 1등이 우승!' },
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
  ['life', '🎓', '인생 보드게임 vs AI', '대학? 취업? 룰렛 인생 레이스', false, '보드·카드'],
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
const UPDATED = new Set(['davinci', 'yacht']);   // 이번에 크게 바뀐 게임
function fillGrid(sel, list) {
  const grid = $(sel);
  list = list.slice().sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));   // 새 게임을 앞쪽에
  let row = grid.previousElementSibling;
  if (!row || !row.classList.contains('cat-row')) { row = document.createElement('div'); row.className = 'cat-row'; grid.before(row); }
  row.innerHTML = CATS.map(c => {
    const n = c === '전체' ? list.length : list.filter(g => g.cat === c).length;
    return `<button class="cat-chip ${c === '전체' ? 'on' : ''}" data-act="cat" data-cat="${c}">${c} <small>${n}</small></button>`;
  }).join('');
  grid.innerHTML = list.map(g => `<button class="game-card" data-act="${g.act}" data-game="${g.k}" data-cat="${g.cat}">${g.isNew ? '<span class="new-badge">NEW</span>' : UPDATED.has(g.k) ? '<span class="new-badge up">UP</span>' : ''}${gameIcon(g.k, g.cat)}<b>${g.n}</b><small>${g.d}</small>${g.pill ? `<span class="pill">${g.pill}</span>` : ''}</button>`).join('');
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
});
socket.on('connect_error', err => {
  $('#conn span').textContent = '연결 중…';
  const msg = err && err.message;
  if (msg === 'server-full') toast('지금 서버에 사람이 너무 많아요. 잠시 후 자동으로 다시 시도할게요.', 'error');
  if (msg === 'too-many') toast('같은 곳에서 너무 많이 접속했어요. 다른 탭을 닫아 주세요.', 'error');
  if (!socket.active) setTimeout(() => socket.connect(), 10000);   // 서버가 거절한 경우에도 잠시 뒤 다시 시도
});
socket.on('disconnect', () => {
  clearInterval(pingTimer);
  $('#conn').classList.remove('on'); delete $('#conn').dataset.q; $('#conn span').textContent = '연결 끊김 · 다시 연결 중…';
  if (S.code) {
    S.code = null; S.room = null; stopLocal(); hideOverlay(); show('multi'); renderInvite();
    toast('서버와 연결이 끊어졌어요. 인터넷 연결이나 서버 창이 켜져 있는지 확인해 주세요.', 'error');
  }
});
socket.on('serverInfo', d => { S.serverInfo = d; renderInvite(); });
socket.on('toast', d => toast(d.msg, d.type));

socket.on('joined', d => {
  S.myId = d.myId; S.code = d.code;
  $('#invite-banner').classList.add('hidden');
  if (location.search) history.replaceState(null, '', location.pathname);   // 초대 링크 흔적 지우기
  renderInvite();
  $('#chat-log').innerHTML = '';
  $('#chat-room').textContent = '방 ' + d.code;
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
socket.on('gameOver', d => after(900, () => showResult(d)));

function me() { return S.room ? S.room.players.find(p => p.id === S.myId) : null; }

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
$('#join-code').addEventListener('keydown', e => { if (e.key === 'Enter') ACT.join(); });
$('#liar-guess-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) ACT.liarGuess(); });

function leaveRoom() {
  if (S.code) socket.emit('leaveRoom');
  S.code = null; S.room = null;
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
  $('#lobby-rules').innerHTML = info.rules;

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
    ].join('');
    const av = (typeof Acct !== 'undefined' && Acct.lobbyAvatar(p)) || `<div class="avatar" style="background:${avColor(p.id)}">${esc(p.name[0] || '?')}</div>`;
    return `<div class="pcard ${p.id === S.myId ? 'me' : ''}">${av}
      <div class="pinfo"><div class="pname">${esc(p.name)}${p.id === S.myId ? ' (나)' : ''}</div>${tags}${typeof Acct !== 'undefined' ? Acct.lobbyTags(p) : ''}</div></div>`;
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
  div.innerHTML = d.system ? esc(d.msg) : `${d.tag ? `<em class="chat-tag">${esc(d.tag)}</em>` : ''}<b>${esc(d.name)}</b>${d.emoji ? `<span class="emo">${esc(d.msg)}</span>` : esc(d.msg)}`;
  box.append(div);
  while (box.children.length > 200) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
  if (d.emoji && !d.system) floatEmoji(d.msg, d.name);
}
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
const SCORE_UNIT = { mine: '%', snake: '칸', bingo: '줄', race: '/50', dodge: '초', plat: '%', halli: '장', word: '단어' };
function renderScores() {
  const unit = (S.room && SCORE_UNIT[S.room.gameType]) || '';
  const html = S.scores.slice().sort((a, b) => b.score - a.score).map((p, i) =>
    `<span class="chip ${p.id === S.myId ? 'me' : ''} ${outSet.has(p.id) ? 'out' : ''}">${['🥇', '🥈', '🥉'][i] || '🏃'} ${esc(p.name)} <b>${p.score}${unit}</b></span>`).join('');
  $$('[data-scores]').forEach(el => { el.innerHTML = S.solo ? '' : html; });
}

let ovTimer = null;
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
    const isHost = me() && me().isHost;
    const draw = () => { $('#ov-actions').innerHTML = `<span class="muted">${n}초 뒤 대기실로 이동합니다</span>${isHost ? '<button class="btn good" data-act="resultLobby">지금 대기실로</button>' : ''}`; };
    draw();
    clearInterval(ovTimer);
    ovTimer = setInterval(() => { n = Math.max(0, n - 1); draw(); if (!n) clearInterval(ovTimer); }, 1000);
  }
  $('#overlay').classList.add('show');
  if (typeof Acct !== 'undefined') Acct.onResult(d);                      // 로그인했으면 기록 저장 · 경험치 표시 (account.js)
}
function hideOverlay() { clearInterval(ovTimer); $('#overlay').classList.remove('show'); }

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
  if (!TOUCH || !g || !g.pad) { padEl.classList.add('hidden'); return; }
  const cut = g.pad.indexOf('|'), L = cut < 0 ? g.pad : g.pad.slice(0, cut), R = cut < 0 ? [] : g.pad.slice(cut + 1);
  const btn = c => `<button data-code="${c}">${(g.padLabel && g.padLabel[c]) || PAD_LABEL[c] || c}</button>`;
  padEl.innerHTML = `<div class="pad-l">${L.map(btn).join('')}</div><div class="pad-r">${R.map(btn).join('')}</div>`;
  padEl.classList.remove('hidden');
}
const fakeKey = code => ({ code, key: code === 'Space' ? ' ' : code, repeat: false, preventDefault() {} });
padEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-code]'); if (!b) return;
  e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on');
  Keys.add(b.dataset.code);
  const g = Games[S.screen]; if (g && g.key) g.key(fakeKey(b.dataset.code));
});
['pointerup', 'pointercancel'].forEach(t => padEl.addEventListener(t, e => {
  const b = e.target.closest('[data-code]'); if (!b) return;
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
