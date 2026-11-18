// 🛡️ 회원 관리 검사 (v14.1) — 서버 lib/mod.js + 계정 쪽 패널티(lib/accounts.js normPen · 순위에서 빼기)
//  - 운영자만 · 기록 지우기(하나 · 전부 · 판 수는 그대로) · 경고 · 기록 정지 · 이용 정지(접속 중이면 로그아웃) · 풀기 · 운영자에게는 못 줘요
//  - 순위표: 이용 정지는 모든 순위에서, 기록 정지는 싱글 기록 순위에서 빠져요 · 카트는 시간이 짧을수록 위
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const DAY = 86400000;

const acc0 = require('../lib/accounts')({
  io: { emit() {}, to: () => ({ emit() {} }) }, rooms: new Map(), registry: () => ({}), ipOf: () => '10.0.0.1', cloud: false,
  H: { finishGame() {}, endToLobby() {}, participants: () => [], pushRoom() {} },
});
const N = acc0._test.normalize, AI = acc0._int;

console.log('▶ 저장된 패널티 다듬기 (normPen)');
{
  const u = N({ id: 'x', name: '가', pen: { ban: { until: 'abc' }, rec: { until: 5, why: 'w'.repeat(300), by: '운영' }, msgs: [null, { at: 3, kind: 'warn', why: '경고' }], seen: 2 } });
  ok(u.pen.ban === null && u.pen.rec.until === 5 && u.pen.rec.why.length === 100 && u.pen.msgs.length === 1 && u.pen.seen === 2, '이상한 값은 버리고 · 사유는 100자까지');
  ok(N({ id: 'y', name: '나' }).pen.ban === null && N({ id: 'y', name: '나' }).pen.msgs.length === 0, '예전 계정에는 빈 패널티');
  ok(AI.activePen({ until: 0 }) && AI.activePen({ until: Date.now() + 1000 }) && !AI.activePen({ until: Date.now() - 1 }) && !AI.activePen(null), '0 = 영구 · 기간이 지나면 풀려요');
}

console.log('▶ 순위표에서 빼기 (lib/accounts.js ranking)');
{
  const users = acc0._test.users, now = Date.now();
  const mk = (id, name, solo, pen) => { const u = N({ id, name, solo, pen, xp: 100 }); users.set(id, u); return u; };
  mk('u1', '철수', { shisen: { p: 1, b: 9999 }, 'kart:sunny-speed': { p: 1, b: 69.5 } });
  mk('u2', '영희', { shisen: { p: 1, b: 5000 }, 'kart:sunny-speed': { p: 1, b: 71.2 } });
  mk('u3', '민수', { shisen: { p: 1, b: 7000 }, 'kart:sunny-speed': { p: 1, b: 80 } }, { rec: { until: now + DAY, why: '조작' } });
  mk('u4', '지수', { shisen: { p: 1, b: 8000 } }, { ban: { until: 0, why: '반복' } });
  const R = (k, g) => acc0._test.ranking(k, g, null).list.map(x => x.name).join();
  ok(R('solo', 'shisen') === '철수,영희', `사천성: 기록 정지 · 이용 정지는 빠져요 (${R('solo', 'shisen')})`);
  ok(R('solo', 'kart:sunny-speed') === '철수,영희', `카트: 빠른 순 (${R('solo', 'kart:sunny-speed')})`);
  ok(acc0._test.ranking('solo', 'kart:sunny-speed', null).low === true, '카트는 낮을수록 좋은 기록');
  ok(R('xp') === '철수,영희,민수', `레벨 순위: 이용 정지만 빠져요 (${R('xp')})`);
  users.clear();
}

console.log('▶ 서버 (lib/mod.js)');
(async () => {
  const users = new Map(), online = new Map(), emitted = [], kicked = [], notes = [], saves = [];
  const mk = (id, name, role, solo) => { const u = N({ id, name, role, solo, created: 1, seen: 1 }); users.set(id, u); return u; };
  mk('o', '세현', 'owner'); mk('a', '민수', 'admin'); mk('p', '철수', '', { shisen: { p: 3, b: 99999, at: 5 }, tetris: { p: 2, b: 1200 } }); mk('q', '영희', '', { shisen: { p: 1, b: 5200 } });
  const A = { users, online, pub: u => ({ id: u.id, name: u.name }), meView: u => ({ id: u.id, pen: u.pen }), save: u => saves.push(u.id),
    emitUser: (id, ev, d) => emitted.push([id, ev, d]), ready: () => true, limiter: () => () => true,
    activePen: AI.activePen, banView: AI.banView, LOW_BETTER: AI.LOW_BETTER, kick: (id, d) => kicked.push([id, d]) };
  const MOD = require('../lib/mod')({ acc: { _int: A }, adm: { note: (u, a, x) => notes.push([u.name, a, x]) } });
  const sock = uid => { const s = { id: 's' + uid, data: { uid }, h: {} }; MOD.attach(s, (e, fn) => { s.h[e] = fn; }); return s; };
  const call = (s, ev, d) => new Promise(res => s.h[ev](d, res));
  const so = sock('o'), sa = sock('a'), sq = sock('q'), sg = sock(null);

  for (const ev of ['mod:find', 'mod:user', 'mod:recDel', 'mod:pen', 'mod:lift']) {
    const r1 = await call(sq, ev, { uid: 'p', k: 'shisen', kind: 'warn', why: 'x' }), r2 = await call(sg, ev, {});
    ok(r1.why === 'noperm' && r2.why === 'login', `${ev}: 회원 → noperm · 손님 → login`);
  }
  let r = await call(sa, 'mod:find', { q: '철' });
  ok(r.ok && r.list.length === 1 && r.list[0].id === 'p', '운영자(민수)도 회원을 찾을 수 있어요');
  r = await call(sa, 'mod:user', { uid: 'p' });
  ok(r.ok && r.u.recs.length === 2 && r.u.recs[0].k === 'shisen' && r.u.recs[0].rank === 1, '기록 목록 (1등 기록이 위)');
  r = await call(sa, 'mod:recDel', { uid: 'p', k: 'shisen', why: '사진으로 푼 기록', label: '사천성' });
  ok(r.ok && r.n === 1 && users.get('p').solo.shisen.b === undefined && users.get('p').solo.shisen.p === 3, '기록 하나 지우기 (판 수는 그대로)');
  ok(users.get('p').pen.msgs[0].kind === 'recdel' && users.get('p').pen.msgs[0].x === '사천성 기록' && emitted.some(e => e[0] === 'p' && e[1] === 'acct:me'), '당사자에게 알림');
  ok(notes.some(n => n[1] === 'recdel' && /철수 님 사천성 기록\(99999\) 삭제 · 사진으로 푼 기록/.test(n[2])), '활동 기록: ' + (notes.find(n => n[1] === 'recdel') || [])[2]);
  ok((await call(sa, 'mod:recDel', { uid: 'p', k: 'shisen' })).why === 'norec', '없는 기록 → norec');
  ok((await call(sa, 'mod:recDel', { uid: 'p', k: '__proto__' })).why === 'norec', '이상한 키도 안전하게 → norec');

  ok((await call(sa, 'mod:pen', { uid: 'p', kind: 'ban', days: 1, why: '  ' })).why === 'why', '사유가 없으면 안 돼요');
  ok((await call(sa, 'mod:pen', { uid: 'p', kind: 'rec', days: 2, why: 'x' })).why === 'days', '기간은 1 · 3 · 7 · 30 · 영구(0)만');
  ok((await call(sa, 'mod:pen', { uid: 'p', kind: 'jail', days: 1, why: 'x' })).why === 'bad', '모르는 패널티 → bad');
  ok((await call(sa, 'mod:pen', { uid: 'o', kind: 'warn', why: 'x' })).why === 'opuser' && (await call(so, 'mod:pen', { uid: 'a', kind: 'ban', days: 1, why: 'x' })).why === 'opuser', '운영자에게는 줄 수 없어요 (최고 운영자도 못 줘요)');
  r = await call(sa, 'mod:pen', { uid: 'p', kind: 'rec', days: 7, why: '기록 조작' });
  const rec = users.get('p').pen.rec;
  ok(r.ok && rec && Math.abs(rec.until - (Date.now() + 7 * DAY)) < 5000 && rec.by === '민수' && r.u.pen.rec, '기록 정지 7일 (누가 줬는지도)');
  r = await call(so, 'mod:pen', { uid: 'p', kind: 'ban', days: 0, why: '반복' });
  ok(r.ok && users.get('p').pen.ban.until === 0 && kicked.length === 1 && kicked[0][0] === 'p' && kicked[0][1].why === 'banned' && kicked[0][1].ban.until === 0, '영구 이용 정지 → 접속 중이면 바로 로그아웃');
  r = await call(sa, 'mod:find', { q: '' });
  ok(r.ok && r.pen && r.list.length === 1 && r.list[0].ban && r.list[0].rec, '빈칸으로 찾으면 정지 중인 회원');
  ok((await call(sa, 'mod:lift', { uid: 'p', kind: 'ban' })).ok && users.get('p').pen.ban === null && users.get('p').pen.msgs[0].kind === 'lift', '이용 정지 풀기 (알림)');
  ok((await call(sa, 'mod:lift', { uid: 'p', kind: 'ban' })).why === 'nopen', '이미 풀렸으면 nopen');
  r = await call(so, 'mod:recDel', { uid: 'q', all: true, why: '정리' });
  ok(r.ok && r.n === 1 && r.u.recs.length === 0, '기록 전부 지우기');
  ok(users.get('p').pen.msgs.length <= 10 && ['recdel', 'pen', 'lift'].every(k => notes.some(n => n[1] === k)), '알림은 10개까지 · 활동 기록 종류');

  console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
