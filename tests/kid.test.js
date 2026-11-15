// ⏳ 키즈 모드 검사 (v13.8) — 계산 public/js/shared/kid-core.js · 서버 lib/kid.js
//  - 한국 날짜 · 주말 · 시간대(자정 넘김) · 잠김 이유 · 다시 열리는 때 · 날짜가 바뀌면 기록으로
//  - 서버: 최고 운영자만 설정 · 게임하는 동안만 세기(화면이 안 보이면 · 메뉴는 빼요) · 다 쓰면 막기 · 기기 키(손님도) · 멀티는 이번 판만 · 끄면 기기도 잊어요
const fs = require('fs');
const path = require('path');
process.env.KID_TICK_MS = '999999999';           // 저절로 돌지 않게 (검사가 직접 tick)
process.env.KID_GRACE_MS = '60000';
process.env.KID_OVER_MS = '0';
const T = s => Date.parse(s + ':00+09:00');      // 한국 시각 → ms
let NOW = T('2026-11-16T10:00');                 // 2026-11-16 은 월요일
const realNow = Date.now;
Date.now = () => NOW;
const K = require('../public/js/shared/kid-core');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const H = 3600000, M = 60000;

console.log('▶ 한국 날짜 · 주말 · 시간대');
{
  ok(K.dayKey(T('2026-11-15T23:59')) === '2026-11-15' && K.dayKey(T('2026-11-16T00:00')) === '2026-11-16', '하루는 한국 시간 0시에 바뀌어요');
  ok(K.isWeekend(T('2026-11-14T10:00')) && K.isWeekend(T('2026-11-15T23:59')) && !K.isWeekend(T('2026-11-16T00:00')) && !K.isWeekend(T('2026-11-13T23:59')), '토 · 일만 주말 (한국 날짜 기준)');
  const w = { from: '18:00', to: '21:00' };
  const a = K.windowAt(w, T('2026-11-16T17:59')), b = K.windowAt(w, T('2026-11-16T18:00')), c = K.windowAt(w, T('2026-11-16T21:00'));
  ok(!a.inWin && a.opens === M && b.inWin && b.closes === 3 * H && !c.inWin && c.opens === 21 * H, '18:00 ~ 21:00: 17:59 는 1분 뒤 열림 · 18:00 부터 3시간 · 21:00 은 닫힘');
  const n = { from: '20:00', to: '01:00' };
  const d = K.windowAt(n, T('2026-11-16T23:00')), e = K.windowAt(n, T('2026-11-17T00:30')), f = K.windowAt(n, T('2026-11-17T01:00')), g = K.windowAt(n, T('2026-11-17T19:59'));
  ok(d.inWin && d.closes === 2 * H && e.inWin && e.closes === 30 * M && !f.inWin && f.opens === 19 * H && !g.inWin && g.opens === M, '자정을 넘기는 20:00 ~ 01:00 도 맞아요');
  ok(K.windowAt({ from: '', to: '' }).inWin && K.windowAt({ from: '', to: '' }).closes === -1, '시간대가 없으면 언제든');
}

console.log('▶ 상태 (잠김 · 남은 시간 · 다시 열리는 때)');
{
  const base = K.normalize({ on: true, wd: 60, we: 120 });
  const at = (k, t, s, extra) => K.state({ ...k, d: K.dayKey(t), s, b: 0, stop: false, ...extra }, t);
  const mon = T('2026-11-16T10:00'), sat = T('2026-11-14T10:00');
  let st = at(base, mon, 0);
  ok(st.on && st.why === '' && st.lim === 3600 && st.left === 3600 && !st.wk, '평일 1시간: 처음엔 1시간 남음');
  st = at(base, mon, 3599);
  ok(st.why === '' && st.left === 1, '1초 남으면 아직 할 수 있어요');
  st = at(base, mon, 3600);
  ok(st.why === 'time' && st.left === 0 && st.next === 14 * H && K.whenText(st.next, mon) === '내일 00:00', '다 쓰면 잠김 → 내일 00:00 에 다시 열려요');
  st = at(base, mon, 3600, { b: 30 });
  ok(st.why === '' && st.lim === 5400 && st.left === 1800 && st.bonus === 30, '오늘만 +30분이면 30분 더');
  st = at(base, sat, 3600);
  ok(st.wk && st.lim === 7200 && st.left === 3600, '주말은 주말 시간 (2시간)');
  st = at(base, mon, 0, { stop: true });
  ok(st.why === 'stop' && st.next === 14 * H, '오늘은 그만 → 시간이 남아도 잠기고 내일 열려요');
  const win = { ...base, from: '18:00', to: '21:00' };
  st = at(win, T('2026-11-16T17:00'), 0);
  ok(st.why === 'win' && st.next === H && K.whenText(st.next, T('2026-11-16T17:00')) === '오늘 18:00', '시간대 전이면 잠김 → 오늘 18:00');
  st = at(win, T('2026-11-16T20:30'), 0);
  ok(st.why === '' && st.left === 1800 && st.closes === 30 * M, '시간대가 30분 남으면 남은 시간도 30분 (1시간이 남았어도)');
  st = at(win, T('2026-11-16T19:00'), 3600);
  ok(st.why === 'time' && st.next === 5 * H + 18 * H && K.whenText(st.next, T('2026-11-16T19:00')) === '내일 18:00', '시간을 다 쓰면 다음 날 시간대 시작(내일 18:00)에 열려요');
  st = at({ ...base, wd: 0, we: 0, from: '18:00', to: '21:00' }, T('2026-11-16T19:00'), 99999);
  ok(st.why === '' && st.lim === 0 && st.left === 2 * 3600 && st.tleft === -1, '하루 시간 제한이 없으면 시간대가 끝날 때까지');
  st = at({ ...base, wd: 0, we: 0 }, mon, 50000);
  ok(st.why === '' && st.left === -1, '시간 · 시간대 모두 제한 없음 → 남은 시간 -1 (「오늘은 그만」만 쓸 때)');
  ok(K.state(K.normalize({ on: false, wd: 60 }), mon).on === false && K.state(null).on === false, '꺼져 있으면 { on: false }');
  st = K.state({ ...base, d: '2026-11-15', s: 99999, b: 0, stop: true }, mon);
  ok(st.why === '' && st.used === 0, '어제 쓴 시간 · 어제 잠금은 오늘에 안 넘어와요 (roll 전이어도)');
}

console.log('▶ 날짜가 바뀌면 · 저장된 값 다듬기 · 글자');
{
  const k = K.normalize({ on: true, wd: 60, we: 60, d: '2026-11-15', s: 1800, b: 15, stop: true, h: [['2026-11-14', 600]] });
  ok(K.roll(k, T('2026-11-16T00:00')) && k.d === '2026-11-16' && k.s === 0 && k.b === 0 && !k.stop && k.h[0][0] === '2026-11-15' && k.h[0][1] === 1800 && k.h[1][0] === '2026-11-14', '0시에 어제 쓴 시간은 기록으로 · 오늘은 새로 (더 준 시간 · 잠금도 풀려요)');
  ok(!K.roll(k, T('2026-11-16T23:59')), '같은 날엔 그대로');
  const big = K.normalize({ on: true, h: Array.from({ length: 20 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, 60]) });
  ok(big.h.length === 14, '기록은 14일까지');
  const j = K.normalize({ on: 'yes', wd: '90', we: 99999, from: '25:00', to: '21:00', s: 50, b: -3, devs: [{ h: 'x' }, { h: 'a'.repeat(64), at: 5 }], h: [['bad', 3], ['2026-11-01', 'x']] });
  ok(j.on === false && j.wd === 90 && j.we === 720 && j.from === '' && j.to === '' && j.s === 0 && j.devs.length === 1 && j.h.length === 0, '이상한 값은 버리거나 고쳐요 (켜기는 true 만 · 하루 12시간까지 · 틀린 시각 · 기기 키 · 기록)');
  ok(K.normalize({ from: '18:00', to: '18:00' }).from === '' && K.normalize({ from: '18:00' }).from === '', '시간대 시작 · 끝이 같거나 하나만 있으면 「언제든」');
  ok(K.fmtMin(90) === '1시간 30분' && K.fmtMin(60) === '1시간' && K.fmtMin(45) === '45분' && K.fmtMin(0) === '제한 없음', '분 글자 (1시간 30분 · 45분 · 제한 없음)');
  ok(K.fmtLeft(3725) === '1시간 2분' && K.fmtLeft(600) === '10분' && K.fmtLeft(301) === '6분' && K.fmtLeft(299) === '4:59' && K.fmtLeft(0) === '0:00', '남은 시간 글자 (5분 아래는 4:59 처럼)');
  ok(K.limText({ wd: 60, we: 60 }) === '하루 1시간' && K.limText({ wd: 60, we: 120 }) === '평일 1시간 · 주말 2시간' && K.limText({ wd: 0, we: 0 }) === '시간 제한 없음', '하루 시간 설명');
  ok(K.winText({ from: '18:00', to: '21:00' }) === '18:00 ~ 21:00' && K.winText({ from: '', to: '' }) === '언제든', '시간대 설명');
}

console.log('▶ 서버 (lib/kid.js)');
(async () => {
  const users = new Map(), online = new Map(), saves = [], notes = [], left = [];
  const mk = (id, name, role) => ({ id, name, role: role || '', seen: NOW, kid: K.normalize({}) });
  for (const u of [mk('o', '운영자', 'owner'), mk('k1', '아이'), mk('k2', '동생'), mk('a', '도우미', 'admin')]) users.set(u.id, u);
  const A = { users, online, pub: u => ({ id: u.id, name: u.name }), save: u => saves.push(u.id), ready: () => true, onReady: f => f(null), limiter: () => () => true };
  let flushed = 0;
  const acc = { _int: A, flush: async () => { flushed++; }, flushSync: () => { flushed++; } };
  const rooms = new Map();
  const KID = require('../lib/kid')({ io: {}, rooms, acc, adm: { note: (u, a, x) => notes.push([u.name, a, x]) },
    leaveRoom: s => { left.push(s.id); const r = rooms.get(s.data.code); if (r) r.players = r.players.filter(p => p.id !== s.id); s.data.code = null; } });
  let sid = 0;
  const sock = uid => {
    const s = { id: 's' + (++sid), data: { uid: uid || null }, connected: true, ev: [], h: {}, emit(e, d) { this.ev.push([e, d]); }, on(e, fn) { this.h[e] = fn; } };
    KID.attach(s, (e, fn) => { s.h[e] = fn; });
    if (uid) { if (!online.has(uid)) online.set(uid, new Set()); online.get(uid).add(s); }
    return s;
  };
  const call = (s, ev, d) => new Promise(res => s.h[ev](d, res));
  const last = (s, ev) => { for (let i = s.ev.length - 1; i >= 0; i--) if (s.ev[i][0] === ev) return s.ev[i][1]; return null; };
  const tick = (ms = 5000) => { NOW += ms; KID._test.tick(); };
  KID._test.tick();                                                   // 시각 맞추기

  const so = sock('o'), sa = sock('a'), sk = sock('k1');
  let r = await call(sa, 'kid:set', { uid: 'k1', on: true, wd: 1, we: 1 });
  ok(!r.ok && r.why === 'noperm', '운영자(최고 운영자 아님)는 키즈 모드를 정할 수 없어요');
  r = await call(so, 'kid:set', { uid: 'o', on: true, wd: 1, we: 1 });
  ok(!r.ok && r.why === 'kidowner', '최고 운영자에게는 걸 수 없어요');
  r = await call(so, 'kid:set', { uid: 'k1', on: true, wd: 1, we: 1, from: '', to: '' });
  const pushed = last(sk, 'kid:state');
  ok(r.ok && r.u.k.on && r.u.k.wd === 1 && pushed && pushed.on && /키즈 모드를 켰어요/.test(pushed.msg) && pushed.left === 60, '켜면 본인 화면에 바로 알려요 (하루 1분 · 남은 1분)');
  ok(notes.some(n => n[1] === 'kid' && /아이 님 키즈 모드 켬: 하루 1분/.test(n[2])), '운영자 활동 기록에 남아요');
  const h = await call(sk, 'kid:hello', { k: null });
  ok(h.ok && h.on && typeof h.key === 'string' && h.key.length >= 20 && h.st.left === 60 && !h.st.guest, '로그인한 키즈 기기: 기기 키를 받아요');
  const h2 = await call(sk, 'kid:hello', { k: h.key });
  ok(h2.ok && h2.on && !h2.key, '같은 기기 키로 다시 인사하면 새 키는 안 줘요');

  sk.data.solo = null; tick(); tick();
  ok(users.get('k1').kid.s === 0, '메뉴 화면에 있는 동안은 안 세요');
  sk.data.solo = 'tetris'; sk.data.vis = false; tick(); tick();
  ok(users.get('k1').kid.s === 0, '게임 화면이어도 안 보이면(다른 탭 · 화면 꺼짐) 안 세요');
  sk.data.vis = true; for (let i = 0; i < 6; i++) tick();
  ok(users.get('k1').kid.s === 30, `싱글 게임 30초 → 30초 (${users.get('k1').kid.s})`);
  ok(!KID.block(sk), '아직은 막지 않아요');
  for (let i = 0; i < 6; i++) tick();
  const lk = last(sk, 'kid:state');
  ok(users.get('k1').kid.s === 60 && lk.why === 'time' && lk.left === 0, '1분을 다 쓰면 잠김 → 화면에 바로 알려요');
  ok(KID.block(sk) && last(sk, 'kid:block').why === 'time', '잠기면 방 만들기 · 들어가기 · 시작을 막아요 (kid:block)');
  ok(saves.filter(x => x === 'k1').length >= 2, '잠길 때 저장해요');

  const sg = sock(null);
  const g = await call(sg, 'kid:hello', { k: h.key });
  ok(g.ok && g.on && g.st.guest && g.st.name === '아이' && g.st.why === 'time', '로그아웃하고 손님으로 들어와도 기억한 기기면 똑같이 잠겨요');
  ok(KID.block(sg), '손님 화면도 막아요');
  const bad = await call(sock(null), 'kid:hello', { k: 'not-a-key' });
  ok(bad.ok && !bad.on && bad.drop, '모르는 기기 키는 지우라고 해요');
  KID._test.devs.clear();
  const g2 = await call(sock(null), 'kid:hello', { k: h.key });
  ok(g2.ok && g2.on && g2.st.guest && KID._test.devs.size === 1, '기기 표에 없어도(새 버전으로 갈아탄 사이) 계정에 저장된 키면 알아봐요');

  const s2 = sock('k2');
  const other = await call(s2, 'kid:hello', { k: h.key });
  ok(other.ok && !other.on && !other.drop, '다른(키즈 모드 아닌) 계정으로 로그인하면 그 계정 기준 · 이 기기의 키즈 키는 남겨 둬요');

  r = await call(so, 'kid:bonus', { uid: 'k1', min: 5 });
  ok(r.ok && r.u.st.why === '' && r.u.st.left === 300 && /오늘만 5분 더/.test(last(sk, 'kid:state').msg), '오늘만 +5분 → 바로 풀려요');
  ok(!KID.block(sk) && !KID.block(sg), '풀리면 다시 시작할 수 있어요');
  r = await call(so, 'kid:bonus', { uid: 'k1', min: 999 });
  ok(!r.ok, '한 번에 4시간 넘게는 못 줘요');

  // 멀티: 대기실 → 바로 나가기 · 게임 중 → 이번 판만 (최대 1분: 검사 설정) · 판이 끝나면 나가기
  const room = { code: 'ABCD', isStarted: false, game: null, players: [{ id: sk.id }, { id: 'x' }] };
  rooms.set('ABCD', room); sk.data.code = 'ABCD'; sk.data.solo = null;
  r = await call(so, 'kid:stop', { uid: 'k1', v: true });
  ok(r.ok && r.u.st.why === 'stop' && left.includes(sk.id) && last(sk, 'kid:out').why === 'lobby', '오늘은 그만 → 대기실에 있으면 바로 방에서 나가요');
  room.players.push({ id: sk.id }); sk.data.code = 'ABCD'; room.isStarted = true; room.game = { over: false }; left.length = 0;
  tick();
  ok(!left.length, '게임 중이면 이번 판은 마무리해요');
  const used0 = users.get('k1').kid.s; tick();
  ok(users.get('k1').kid.s > used0, '마무리하는 동안도 시간은 세요');
  NOW += 61000; KID._test.tick();
  ok(left.includes(sk.id) && last(sk, 'kid:out').why === 'mid', '마무리 시간이 지나면(검사: 1분 · 보통 10분) 방에서 나가요');
  room.players.push({ id: sk.id }); sk.data.code = 'ABCD'; sk.data.kidGrace = 0; room.game = { over: true }; left.length = 0;
  tick();
  ok(left.includes(sk.id) && last(sk, 'kid:out').why === 'over', '판이 끝나면 결과를 보고 방에서 나가요');
  r = await call(so, 'kid:stop', { uid: 'k1', v: false });
  ok(r.ok && r.u.st.why === '' && /잠금이 풀렸어요/.test(last(sk, 'kid:state').msg), '잠금 풀기');

  // 시간대 · 날짜 바뀜
  r = await call(so, 'kid:set', { uid: 'k1', on: true, wd: 60, we: 60, from: '18:00', to: '21:00' });
  ok(r.ok && r.u.st.why === 'win' && K.whenText(r.u.st.next) === '오늘 18:00' && /바뀌었어요/.test(last(sk, 'kid:state').msg), '시간대를 정하면 그 밖에서는 잠기고 언제 열리는지 알려요');
  const s0 = users.get('k1').kid.s;
  NOW = T('2026-11-16T18:00') + 1000; sk.data.solo = null; KID._test.tick();
  sk.data.solo = 'snake'; sk.data.vis = undefined; tick();
  ok(last(sk, 'kid:state').why === '' && users.get('k1').kid.s === s0 + 5, '시간대가 되면 저절로 풀리고 다시 세요 (예전 화면처럼 보임 정보가 없어도 세요)');
  NOW += H; KID._test.tick();
  ok(users.get('k1').kid.s === s0 + 35, '서버가 오래 멈췄다 돌아와도 한 번에 30초까지만 세요');
  NOW = T('2026-11-16T20:00'); sk.data.solo = null; KID._test.tick();
  const before = users.get('k1').kid.s;
  NOW = T('2026-11-17T00:00') + 1000; KID._test.tick();
  const k1 = users.get('k1').kid;
  ok(k1.d === '2026-11-17' && k1.s === 0 && k1.h[0][0] === '2026-11-16' && k1.h[0][1] >= before, '0시가 지나면 어제 것은 기록으로 · 오늘은 0초부터');
  const gl = await call(so, 'kid:get', { uid: 'k1' });
  ok(gl.ok && gl.hist.length === 7 && gl.hist[5][0] === '2026-11-16' && gl.hist[6][0] === '2026-11-17', '최근 7일 기록 (오늘이 맨 끝)');
  const list = await call(so, 'kid:list');
  ok(list.ok && list.list.length === 1 && list.list[0].id === 'k1' && list.list[0].devs === 1, '키즈 모드 회원 목록 (기억한 기기 1대)');

  // 저장 · 끄기
  sk.data.solo = 'tetris'; NOW = T('2026-11-17T18:30'); KID._test.tick(); tick(3000);
  flushed = 0; const n0 = saves.length; acc.flushSync();
  ok(flushed === 1 && saves.length > n0, '서버를 끄기 전 계정 저장(flush) 때 오늘 게임한 시간도 같이 저장해요');
  r = await call(so, 'kid:set', { uid: 'k1', on: false });
  ok(r.ok && !r.u.k.on && last(sk, 'kid:state').on === false && last(sk, 'kid:state').drop && last(sg, 'kid:state').drop, '끄면 본인 · 기억한 기기 모두에게 알리고 기기 키를 지우라고 해요');
  const after = await call(sock(null), 'kid:hello', { k: h.key });
  ok(after.ok && !after.on && after.drop && !KID.block(sk) && users.get('k1').kid.devs.length === 0, '끈 뒤에는 기기 키도 잊어요');
  ok(notes.filter(n => n[1] === 'kid').length >= 6, `바꿀 때마다 활동 기록 (${notes.filter(n => n[1] === 'kid').length}개)`);

  console.log('▶ 연결 (서버 · 화면)');
  {
    const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const srv = read('server.js'), html = read('public/index.html'), accj = read('lib/accounts.js'), kidj = read('public/js/kid.js');
    ok((srv.match(/KID\.block\(socket\)/g) || []).length === 5, '서버: 방 만들기 · 들어가기 · 빠른 참가 · 시작 · 한 판 더를 막아요');
    ok(srv.includes("const KID = require('./lib/kid')") && srv.includes('KID.attach(socket, on)'), '서버에 붙였어요');
    ok(accj.includes('kid: KidCore.normalize(u.kid)') && accj.includes('socket.data.vis = !(d && d.v === false)'), '계정 문서에 kid 칸 · 화면이 보이는지 받아요');
    ok(html.indexOf('/js/shared/kid-core.js') > 0 && html.indexOf('/js/shared/kid-core.js') < html.indexOf('/js/kid.js') && html.indexOf('/js/admin.js') < html.indexOf('/js/kid.js') && html.includes('/css/kid.css'), '화면: kid-core → kid.js (admin.js 뒤) · kid.css');
    ok(kidj.includes("startSolo = function (game)") && kidj.includes("socket.on('kid:out'") && kidj.includes("ask('kid:hello'"), '화면: 싱글 시작 막기 · 방에서 내보냄 · 인사');
  }
  Date.now = realNow;
  console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
  process.exit(fails ? 1 : 0);
})();
