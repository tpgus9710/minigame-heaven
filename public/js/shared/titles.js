/* =====================================================================
 *  🏅 레벨 테두리 · 칭호 — 화면(js/account.js · js/flair.js)과 서버(lib/accounts.js)가 같이 써요
 *  테두리: 10레벨마다 새 테두리 (새싹 → 브론즈 → 실버 → 골드 → 에메랄드 → 사파이어 → 루비 → 자수정 → 다이아 → 레전드)
 *          + 5레벨마다(15 · 25 …) 테두리에 작은 별
 *  칭호: 판수 · 승리 · 연승 · 싱글 · 출석 · 미션 · 친구 · 게임별 · 레벨 · 특별. 조건을 채우면 받고, 한 번 받으면 계속 내 것이에요.
 *        r: 1 일반 · 2 희귀 · 3 영웅 · 4 전설   hid: 받기 전에는 ??? 로 보여요   lim: 지금만 받을 수 있어요
 *  s(통계): 서버가 계산해요 (lib/accounts.js 의 statsOf). 새 칭호를 넣을 때 v(s) 가 쓰는 값이 거기에 있는지 확인해요.
 * ===================================================================== */
const Titles = (() => {
  const lvOf = xp => Math.min(99, Math.floor(Math.sqrt(Math.max(0, +xp || 0) / 25)) + 1);
  const xpAt = lv => 25 * (lv - 1) * (lv - 1);
  const TIERS = [
    { k: 'sprout', n: '새싹' }, { k: 'bronze', n: '브론즈' }, { k: 'silver', n: '실버' }, { k: 'gold', n: '골드' }, { k: 'emerald', n: '에메랄드' },
    { k: 'sapphire', n: '사파이어' }, { k: 'ruby', n: '루비' }, { k: 'amethyst', n: '자수정' }, { k: 'diamond', n: '다이아' }, { k: 'legend', n: '레전드' },
  ];
  const tierOf = lv => Math.max(0, Math.min(9, Math.floor((+lv || 1) / 10)));
  const tierLv = t => (t > 0 ? t * 10 : 1);                    // 그 테두리를 받는 레벨
  const RARITY = ['', '일반', '희귀', '영웅', '전설'];
  const OG_END = Date.UTC(2026, 11, 31, 15);                    // 2027년 1월 1일 0시 (한국 시간)
  const n = x => Math.max(0, +x || 0);
  const g = (s, k) => n(s.g && s.g[k]);
  const LIST = [
    // 판수 (멀티 + 싱글)
    { id: 'p50', n: '단골', r: 1, cat: '판수', d: '게임 50판 하기', v: s => n(s.games), goal: 50 },
    { id: 'p300', n: '게임 중독', r: 2, cat: '판수', d: '게임 300판 하기', v: s => n(s.games), goal: 300 },
    { id: 'p1000', n: '폐인', r: 3, cat: '판수', d: '게임 1,000판 하기', v: s => n(s.games), goal: 1000 },
    { id: 'p3000', n: '전설의 폐인', r: 4, cat: '판수', d: '게임 3,000판 하기', v: s => n(s.games), goal: 3000 },
    // 멀티 승리
    { id: 'w1', n: '첫 승리', r: 1, cat: '승리', d: '멀티 게임에서 처음 이기기', v: s => n(s.mw), goal: 1 },
    { id: 'w30', n: '승부사', r: 2, cat: '승리', d: '멀티 게임 30번 이기기', v: s => n(s.mw), goal: 30 },
    { id: 'w150', n: '백전노장', r: 3, cat: '승리', d: '멀티 게임 150번 이기기', v: s => n(s.mw), goal: 150 },
    { id: 'w500', n: '승리의 신', r: 4, cat: '승리', d: '멀티 게임 500번 이기기', v: s => n(s.mw), goal: 500 },
    // 연승 (멀티)
    { id: 'ws3', n: '불붙었다', r: 2, cat: '연승', d: '멀티 게임 3연승', v: s => n(s.wsMax), goal: 3 },
    { id: 'ws5', n: '무적', r: 3, cat: '연승', d: '멀티 게임 5연승', v: s => n(s.wsMax), goal: 5 },
    { id: 'ws10', n: '천하무적', r: 4, cat: '연승', d: '멀티 게임 10연승', v: s => n(s.wsMax), goal: 10 },
    // 싱글
    { id: 'sw50', n: 'AI 사냥꾼', r: 2, cat: '싱글', d: '싱글 게임에서 AI 50번 이기기', v: s => n(s.sw), goal: 50 },
    { id: 'sw300', n: 'AI 정복자', r: 3, cat: '싱글', d: '싱글 게임에서 AI 300번 이기기', v: s => n(s.sw), goal: 300 },
    { id: 'b30', n: '기록 제조기', r: 2, cat: '싱글', d: '싱글 최고 기록 30번 깨기', v: s => n(s.best), goal: 30 },
    { id: 'b150', n: '신기록 머신', r: 3, cat: '싱글', d: '싱글 최고 기록 150번 깨기', v: s => n(s.best), goal: 150 },
    // 출석 · 미션
    { id: 'st7', n: '개근 학생', r: 1, cat: '출석', d: '7일 연속 출석', v: s => n(s.stMax), goal: 7 },
    { id: 'st30', n: '개근상', r: 3, cat: '출석', d: '30일 연속 출석', v: s => n(s.stMax), goal: 30 },
    { id: 'st100', n: '출석의 신', r: 4, cat: '출석', d: '100일 연속 출석', v: s => n(s.stMax), goal: 100 },
    { id: 'ac10', n: '성실한 플레이어', r: 1, cat: '출석', d: '오늘의 미션 모두 끝내기 10번', v: s => n(s.ac), goal: 10 },
    { id: 'ac50', n: '성실왕', r: 3, cat: '출석', d: '오늘의 미션 모두 끝내기 50번', v: s => n(s.ac), goal: 50 },
    // 여러 게임
    { id: 'k15', n: '탐험가', r: 2, cat: '게임', d: '서로 다른 게임 15가지 해 보기', v: s => n(s.kinds), goal: 15 },
    { id: 'k30', n: '만능 플레이어', r: 3, cat: '게임', d: '서로 다른 게임 30가지 해 보기', v: s => n(s.kinds), goal: 30 },
    { id: 'k45', n: '게임 박사', r: 4, cat: '게임', d: '서로 다른 게임 45가지 해 보기', v: s => n(s.kinds), goal: 45 },
    { id: 'gs30', n: '타짜', r: 3, cat: '게임', d: '고스톱 30번 이기기 (멀티 · 싱글)', v: s => g(s, 'gostop'), goal: 30 },
    { id: 'ch20', n: '체스 고수', r: 3, cat: '게임', d: '체스 20번 이기기 (멀티 · 싱글)', v: s => g(s, 'chess'), goal: 20 },
    { id: 'om20', n: '오목 달인', r: 2, cat: '게임', d: '오목 20번 이기기 (멀티 · 싱글)', v: s => g(s, 'omok'), goal: 20 },
    // 친구
    { id: 'f5', n: '친구 부자', r: 1, cat: '친구', d: '친구 5명 사귀기', v: s => n(s.friends), goal: 5 },
    { id: 'f15', n: '인싸', r: 2, cat: '친구', d: '친구 15명 사귀기', v: s => n(s.friends), goal: 15 },
    { id: 'f30', n: '핵인싸', r: 3, cat: '친구', d: '친구 30명 사귀기', v: s => n(s.friends), goal: 30 },
    { id: 'fg100', n: '찐친', r: 2, cat: '친구', d: '친구와 같이 100판 하기', v: s => n(s.fg), goal: 100 },
    { id: 'dm100', n: '수다쟁이', r: 1, cat: '친구', d: '귓속말 100번 보내기', v: s => n(s.dm), goal: 100 },
    // 레벨
    { id: 'lv30', n: '베테랑', r: 2, cat: '레벨', d: 'Lv.30 되기', v: s => n(s.lv), goal: 30 },
    { id: 'lv60', n: '고인물', r: 3, cat: '레벨', d: 'Lv.60 되기', v: s => n(s.lv), goal: 60 },
    { id: 'lv99', n: '만렙', r: 4, cat: '레벨', d: 'Lv.99 되기', v: s => n(s.lv), goal: 99 },
    // 특별
    { id: 'og', n: '원년 멤버', r: 3, cat: '특별', lim: true, d: '2026년 안에 가입 (지금만 받을 수 있어요)', v: s => (n(s.created) && n(s.created) < OG_END ? 1 : 0), goal: 1 },
    { id: 'big10', n: '골목대장', r: 3, cat: '특별', hid: true, h: '사람이 많은 판에서 …', d: '로그인한 6명 이상 판에서 1등 10번 (AI 제외)', v: s => n(s.big), goal: 10 },
    { id: 'acr7', n: '완벽주의자', r: 4, cat: '특별', hid: true, h: '매일매일 빠짐없이 …', d: '7일 연속 오늘의 미션 모두 끝내기', v: s => n(s.acRow), goal: 7 },
  ];
  const CATS = [...new Set(LIST.map(t => t.cat))];
  const byId = Object.fromEntries(LIST.map(t => [t.id, t]));
  /** 진행 상황 { v: 지금(목표까지만), goal, done } */
  const prog = (t, s) => { const v = n(t.v(s || {})); return { v: Math.min(v, t.goal), goal: t.goal, done: v >= t.goal }; };
  /** 지금 통계로 받을 수 있는 칭호 id 목록 */
  const earned = s => LIST.filter(t => n(t.v(s || {})) >= t.goal).map(t => t.id);
  return { lvOf, xpAt, TIERS, tierOf, tierLv, RARITY, LIST, CATS, byId, prog, earned, OG_END };
})();
if (typeof module === 'object' && module.exports) module.exports = Titles;
