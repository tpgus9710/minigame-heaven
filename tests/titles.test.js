'use strict';
/* 🏅 레벨 테두리 · 칭호 검사 (public/js/shared/titles.js + 서버 lib/accounts.js 의 통계) — node tests/titles.test.js */
const Titles = require('../public/js/shared/titles');
const makeAccounts = require('../lib/accounts');
let fails = 0;
const ok = (c, m) => { console.log(`  ${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };

console.log('▶ 테두리 (10레벨마다)');
ok(Titles.TIERS.length === 10, `테두리 ${Titles.TIERS.length}가지`);
const tiers = [[1, 0], [9, 0], [10, 1], [19, 1], [20, 2], [35, 3], [49, 4], [50, 5], [89, 8], [90, 9], [99, 9]];
ok(tiers.every(([lv, t]) => Titles.tierOf(lv) === t), `레벨 → 테두리 (${tiers.map(([lv, t]) => `${lv}→${t}`).join(' ')})`);
ok(Titles.tierLv(0) === 1 && Titles.tierLv(3) === 30 && Titles.tierLv(9) === 90, '테두리를 받는 레벨');

console.log('▶ 레벨 계산이 서버와 같아요');
const srvLv = xp => Math.min(99, Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1);
let same = true;
for (let xp = 0; xp < 300000; xp += 37) if (Titles.lvOf(xp) !== srvLv(xp)) { same = false; break; }
ok(same, '경험치 → 레벨 (0 ~ 30만 XP)');
ok([2, 10, 50, 99].every(l => Titles.lvOf(Titles.xpAt(l)) === l && Titles.lvOf(Titles.xpAt(l) - 1) === l - 1), '레벨이 바뀌는 경험치 (xpAt)');

console.log('▶ 칭호 목록');
const ids = Titles.LIST.map(t => t.id);
ok(new Set(ids).size === ids.length, `칭호 ${ids.length}개 · id 가 겹치지 않아요`);
ok(Titles.LIST.every(t => t.n && t.d && t.r >= 1 && t.r <= 4 && t.goal > 0 && typeof t.v === 'function' && Titles.CATS.includes(t.cat)), '이름 · 설명 · 등급(1~4) · 목표 · 분류');
ok(Titles.LIST.filter(t => t.hid).every(t => t.h), '숨겨진 칭호는 힌트가 있어요');
ok(new Set(Titles.LIST.map(t => t.n)).size === ids.length, '이름도 겹치지 않아요');
const byR = [1, 2, 3, 4].map(r => Titles.LIST.filter(t => t.r === r).length);
ok(byR.every(n => n >= 4), `등급마다 4개 이상 (일반 ${byR[0]} · 희귀 ${byR[1]} · 영웅 ${byR[2]} · 전설 ${byR[3]})`);
ok(Titles.earned({}).length === 0 && Titles.earned(undefined).length === 0, '빈 통계로는 아무것도 안 받아요 (오류 없이)');
const p = Titles.prog(Titles.byId.p1000, { games: 5000 });
ok(p.v === 1000 && p.done && Titles.prog(Titles.byId.p1000, { games: 720 }).v === 720, '진행 상황은 목표까지만');
ok(Titles.earned({ created: Date.UTC(2026, 10, 5) }).includes('og') && !Titles.earned({ created: Date.UTC(2027, 0, 2) }).includes('og'), '「원년 멤버」는 2026년 가입만');

console.log('▶ 서버 통계로 모든 칭호를 받을 수 있어요');
const H = { endToLobby() {}, finishGame() {}, participants: () => [] };
const acc = makeAccounts({ io: { emit() {}, to: () => ({ emit() {} }) }, rooms: new Map(), H, registry: () => ({}), ipOf: () => '', cloud: false });
const big = 1e6, multi = {}, solo = {};
for (let i = 0; i < 30; i++) multi['g' + i] = { p: 10, w: 1 };
for (let i = 0; i < 30; i++) solo['s' + i + ':k'] = { p: 30, w: 20 };
Object.assign(multi, { gostop: { p: big, w: big }, chess: { p: big, w: big }, omok: { p: big, w: big } });
const u = { id: 'u1', plays: big, wins: big, sp: big, multi, solo, xp: Titles.xpAt(99), created: Date.UTC(2026, 5, 1), friends: Array.from({ length: 50 }, (_, i) => 'f' + i),
  daily: { streak: 3 }, st: { best: big, ws: big, wsMax: big, stMax: big, ac: big, acRow: big, fg: big, dm: big, big } };
const s = acc._test.statsOf(u);
const all = Titles.earned(s);
ok(all.length === Titles.LIST.length, `모든 칭호 조건을 서버 통계로 채울 수 있어요 (${all.length} / ${Titles.LIST.length})${all.length < Titles.LIST.length ? ' 빠짐: ' + ids.filter(id => !all.includes(id)) : ''}`);
ok(s.kinds === 63 && s.g.gostop === big && s.lv === 99, `해 본 게임 수 · 게임별 승리 · 레벨 (${s.kinds} · ${s.lv})`);
const u2 = { ...u, ttl: {}, friends: [] };
const got = acc._test.award(u2, true);
ok(got.length === Titles.LIST.length - 3 && Object.keys(u2.ttl).length === got.length, `칭호 주기 (친구 칭호 3개 빼고 ${got.length}개)`);
ok(acc._test.award(u2, true).length === 0, '이미 받은 칭호는 다시 안 줘요');

console.log(fails ? `\n❌ ${fails}개 실패` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
