'use strict';
/* =====================================================================
 *  📅 출석 체크 · 오늘의 미션 (lib/accounts.js 가 써요)
 *  - 하루는 한국 시간 0시에 바뀌어요.
 *  - 그날 처음 접속하면 출석 경험치 (연속 출석이면 조금 더)
 *  - 미션 3개: 멀티 · 싱글 · 이것저것 하나씩, 사람마다 · 날마다 달라요. 다 하면 보너스
 * ===================================================================== */
const DAY = 86400000, KST = 9 * 3600000;
const dayKey = (t = Date.now()) => new Date(t + KST).toISOString().slice(0, 10);          // '2026-11-03'
const prevDay = k => new Date(Date.parse(k + 'T00:00:00Z') - DAY).toISOString().slice(0, 10);

const BOARD = new Set(['seotda', 'poker', 'omok', 'bingo', 'onecard', 'marble', 'life', 'thief', 'yut', 'yacht', 'blackjack', 'liardice', 'davinci', 'reversi', 'rummi', 'bang', 'coup', 'dalmuti']);
const ACTION = new Set(['tetris', 'pong', 'snake', 'dodge', 'plat', 'volley', 'bomb', 'tank', 'kart', 'breakout', 'zombie', 'shooter']);

/** 미션 종류 · 목표 · 경험치. on(이벤트) 이 숫자를 돌려주면 그만큼 올라가요 */
const MISSIONS = {
  multi2: { t: '멀티 게임 2판 하기', goal: 2, xp: 30, on: e => (e.type === 'multi' ? 1 : 0) },
  win1: { t: '멀티 게임에서 1번 이기기', goal: 1, xp: 40, on: e => (e.type === 'multi' && e.win ? 1 : 0) },
  friend1: { t: '친구와 같이 1판 하기', goal: 1, xp: 40, on: e => (e.type === 'multi' && e.friend ? 1 : 0) },
  solo3: { t: '싱글 게임 3판 하기', goal: 3, xp: 30, on: e => (e.type === 'solo' ? 1 : 0) },
  best1: { t: '싱글 게임 최고 기록 깨기', goal: 1, xp: 40, on: e => (e.type === 'solo' && e.best ? 1 : 0) },
  solowin1: { t: '싱글 게임에서 AI 이기기', goal: 1, xp: 35, on: e => (e.type === 'solo' && e.win ? 1 : 0) },
  kinds3: { t: '서로 다른 게임 3가지 하기', goal: 3, xp: 30, on: (e, d) => (e.g && !d.kinds.includes(e.g) ? (d.kinds.push(e.g), 1) : 0) },
  board2: { t: '보드 · 카드 게임 2판 하기', goal: 2, xp: 30, on: e => (BOARD.has(e.g) && (e.type === 'multi' || e.type === 'solo') ? 1 : 0) },
  action2: { t: '액션 게임 2판 하기', goal: 2, xp: 30, on: e => (ACTION.has(e.g) && (e.type === 'multi' || e.type === 'solo') ? 1 : 0) },
  dm1: { t: '친구에게 귓속말 보내기', goal: 1, xp: 20, on: e => (e.type === 'dm' ? 1 : 0) },
};
const GROUPS = [['multi2', 'win1', 'friend1'], ['solo3', 'best1', 'solowin1'], ['kinds3', 'board2', 'action2', 'dm1']];
const ALL_BONUS = 50;

/** 사람 · 날짜마다 달라지는 고르기 (같은 날엔 몇 번을 계산해도 같아요) */
function pick(seed, n) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % n;
}
function roll(uid, day) { return GROUPS.map((g, i) => g[pick(`${uid}|${day}|${i}`, g.length)]); }

/** 저장된 값 다듬기 (모르는 값 · 이상한 값은 버려요) */
function normalize(d) {
  if (!d || typeof d !== 'object') return { d: '', streak: 0, m: [], kinds: [], all: false };
  const m = Array.isArray(d.m) ? d.m.filter(x => x && MISSIONS[x.k]).slice(0, 3).map(x => ({ k: x.k, n: Math.max(0, Math.min(MISSIONS[x.k].goal, +x.n || 0)) })) : [];
  return { d: typeof d.d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d.d) ? d.d : '', streak: Math.max(0, Math.min(9999, +d.streak || 0)), m,
    kinds: Array.isArray(d.kinds) ? d.kinds.filter(x => typeof x === 'string').slice(0, 10) : [], all: !!d.all };
}

/** 오늘이 처음이면 새 미션 · 출석 경험치. 돌려주는 값: 출석 정보 (이미 오늘 했으면 null) */
function ensure(u, now = Date.now()) {
  const today = dayKey(now), d = u.daily;
  if (d.d === today && d.m.length === 3) return null;
  const streak = d.d === prevDay(today) ? d.streak + 1 : 1;
  u.daily = { d: today, streak, m: roll(u.id, today).map(k => ({ k, n: 0 })), kinds: [], all: false };
  const xp = 20 + Math.min(25, (streak - 1) * 5);                   // 연속 출석 하루마다 +5 (최대 +25)
  return { xp, streak };
}

/** 미션 진행: 이번에 끝낸 미션 목록과 얻은 경험치 */
function track(u, e) {
  const d = u.daily, done = [];
  for (const x of d.m) {
    const M = MISSIONS[x.k];
    if (x.n >= M.goal) continue;
    const inc = M.on(e, d);
    if (!inc) continue;
    x.n = Math.min(M.goal, x.n + inc);
    if (x.n >= M.goal) done.push({ k: x.k, t: M.t, xp: M.xp });
  }
  let bonus = 0;
  if (!d.all && d.m.length === 3 && d.m.every(x => x.n >= MISSIONS[x.k].goal)) { d.all = true; bonus = ALL_BONUS; }
  return { done, bonus, xp: done.reduce((a, x) => a + x.xp, 0) + bonus };
}

/** 화면에 보여 줄 오늘의 미션 */
function view(u) {
  const d = u.daily;
  return { d: d.d, streak: d.streak, all: d.all, bonus: ALL_BONUS,
    list: d.m.map(x => ({ k: x.k, t: MISSIONS[x.k].t, n: x.n, goal: MISSIONS[x.k].goal, xp: MISSIONS[x.k].xp })) };
}

module.exports = { dayKey, prevDay, MISSIONS, GROUPS, normalize, ensure, track, view, roll };
