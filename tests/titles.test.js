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

(async () => {
  console.log('▶ 「골목대장」은 로그인한 사람 6명부터 (AI·봇 · 손님은 안 세요)');
  // 진짜 계정 파일은 건드리지 않게 임시 폴더에서 계정 모듈을 새로 만들어요
  const fs = require('fs'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-ttl-'));
  const keep = { DATA_DIR: process.env.DATA_DIR, DATABASE_URL: process.env.DATABASE_URL, ACCT_MIN_GAME_MS: process.env.ACCT_MIN_GAME_MS };
  Object.assign(process.env, { DATA_DIR: dir, ACCT_MIN_GAME_MS: '0' }); delete process.env.DATABASE_URL;
  delete require.cache[require.resolve('../lib/accounts')];
  const make2 = require('../lib/accounts');
  const doc = (id, extra) => ({ id, name: '사람' + id, code: 'C0DE' + id.padStart(4, '0'), created: Date.now(), ...extra });
  const users0 = Array.from({ length: 8 }, (_, i) => doc(String(i + 1)));
  users0[0] = doc('1', { st: { big: 12 }, ttl: { big10: 1 }, tt: 'big10', solo: { zombie: { p: 3, w: 0, b: 42 }, spot: { p: 1, w: 1, b: 900 }, g2048: { p: 2, w: 0, b: 2048 } } });   // 예전에 AI랑 해서 받은 사람
  users0[1] = doc('2', { st: { big: 3 }, mig: 1 });                                   // 이미 고친 계정은 그대로
  fs.writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify({ v: 1, users: users0 }));
  const H2 = { endToLobby() {}, finishGame() {}, participants: room => room.players.filter(p => p.role !== 'spectator') };
  const A = make2({ io: { emit() {}, to: () => ({ emit() {} }) }, rooms: new Map(), H: H2, registry: () => ({}), ipOf: () => '', cloud: false });
  await A.init();
  const U = A._test.users;
  ok(U.get('1').st.big === 0 && !U.get('1').ttl.big10 && U.get('1').tt === '' && U.get('1').mig >= 1, '예전 숫자(AI 포함)는 지우고, 받았던 「골목대장」도 거둬요 (달고 있었으면 내려요)');
  ok(U.get('2').st.big === 3, '이미 새 규칙으로 센 계정은 그대로');
  const so = U.get('1').solo;
  ok(so.zombie.b === undefined && so.zombie.p === 3 && so.spot.b === undefined && so.g2048.b === 2048, '좀비 웨이브 · 틀린그림찾기는 기록 방식이 바뀌어 예전 최고 기록만 지워요 (판 수 · 다른 게임 기록은 그대로)');
  const play = (players, ranking) => {
    const room = { code: 'T', gameType: 'spot', players, game: { over: false } };
    A.onStart(room);
    H2.finishGame(room, { ranking });
  };
  const P = (uid, i) => ({ id: 's' + i, name: uid ? '사람' + uid : '손님' + i, uid });
  const bots = k => Array.from({ length: k }, (_, i) => ({ name: '🤖 봇' + i, value: '0점' }));
  // ① 로그인 2명 + 봇 5 = 7명 판 → 안 세요
  play([P('3', 1), P('4', 2)], [{ id: 's1', name: '사람3', value: '9점' }, { id: 's2', name: '사람4', value: '1점' }, ...bots(5)]);
  ok(U.get('3').st.big === 0 && U.get('3').wins === 1, 'AI 5 + 사람 2 (7명 판) 1등 → 승리는 기록, 골목대장 숫자는 그대로');
  // ② 로그인 4명 + 손님 2명 → 안 세요
  const six = [P('3', 1), P('4', 2), P('5', 3), P('6', 4), P(null, 5), P(null, 6)];
  play(six, six.map((p, i) => ({ id: p.id, name: p.name, value: (9 - i) + '점' })));
  ok(U.get('3').st.big === 0, '로그인 4명 + 손님 2명 → 안 세요');
  // ③ 로그인 6명 → 1등만 하나 올라가요
  const real = ['3', '4', '5', '6', '7', '8'].map((u, i) => P(u, i + 1));
  play(real, real.map((p, i) => ({ id: p.id, name: p.name, value: (9 - i) + '점' })));
  ok(U.get('3').st.big === 1 && U.get('4').st.big === 0, '로그인한 사람 6명 판 1등 → +1 (2등은 그대로)');
  // ④ 10번 채우면 칭호
  for (let k = 0; k < 9; k++) play(real, real.map((p, i) => ({ id: p.id, name: p.name, value: (9 - i) + '점' })));
  ok(U.get('3').st.big === 10 && !!U.get('3').ttl.big10, '10번 → 「골목대장」');
  // ⑤ 같은 계정이 두 자리 (탭 두 개) → 한 명으로 세요
  const dup = [P('4', 1), P('4', 2), P('5', 3), P('6', 4), P('7', 5), P('8', 6)];
  play(dup, dup.map((p, i) => ({ id: p.id, name: p.name, value: (9 - i) + '점' })));
  ok(U.get('4').st.big === 0, '같은 계정 두 자리는 한 명 → 5명이라 안 세요');
  A.flushSync();
  for (const [k, v] of Object.entries(keep)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(fails ? `\n❌ ${fails}개 실패` : '\n✅ 모두 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
