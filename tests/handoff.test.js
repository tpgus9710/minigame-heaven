// 새 버전 갈아타기 검사 (lib/handoff.js · lib/accounts.js)
//  - 이사 표: 서명 · 위조 · 만료 · 한 번만
//  - 새 서버가 옛 서버를 '새 서버'로 착각하지 않기 (부팅 번호의 시각 비교)
//  - 새로 켜진 서버: 로그인할 때 옛 서버가 그사이 저장한 계정을 DB에서 다시 읽기 · 이미 바꾼 계정은 그대로 · 모르는 토큰은 DB에서 찾기
//  - 갈아타는 중인 옛 서버는 '마지막 접속 시각'만 바뀐 계정을 저장하지 않기
const crypto = require('crypto');
const path = require('path');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

/* ── 가짜 DB 저장소 (lib/store.js 대신) ── */
const DB = new Map();                   // id → 문서 (JSON 복사본)
const writes = [];
const fake = {
  kind: 'db', where: 'fake',
  async load() { return [...DB.values()].map(d => JSON.parse(JSON.stringify(d))); },
  put(doc) { writes.push(doc.id); DB.set(doc.id, JSON.parse(JSON.stringify(doc))); },
  del(id) { DB.delete(id); },
  async flush() {}, flushSync() {},
  async getOne(id) { const d = DB.get(id); return d ? JSON.parse(JSON.stringify(d)) : null; },
  async findByToken(h) { for (const d of DB.values()) if ((d.tokens || []).some(t => t.h === h)) return JSON.parse(JSON.stringify(d)); return null; },
};
require.cache[path.resolve(__dirname, '../lib/store.js')] = { id: 'store', filename: 'store', loaded: true, exports: { openStore: () => fake } };

const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const doc = (id, name, xp, token) => ({ id, name, xp, code: 'C' + id.toUpperCase().padEnd(5, 'X'), created: 1, seen: 1, tokens: [{ h: sha(token), at: 1, last: Date.now() }], friends: [], reqIn: [], reqOut: [], multi: {}, solo: {}, recent: [] });
DB.set('u1', doc('u1', '하나', 100, 'tok-1'));
DB.set('u2', doc('u2', '둘', 200, 'tok-2'));

(async () => {
  console.log('▶ 이사 표');
  {
    process.env.MOVE_SECRET = 'unit-test-secret';
    const io = { sockets: { sockets: new Map() }, emit() {} };
    const H = { stopTimers() {}, sys() {}, pushRoom() {} };
    const mk = () => require('../lib/handoff')({ io, rooms: new Map(), H, ACC: { flush: async () => {} }, REGISTRY: { word: { name: 'w', max: 8, options: [] } },
      cloud: false, boot: `${Date.now().toString(36)}.aaaa`, publicUrl: () => '', makeRoom() {}, addPlayer() {}, leaveRoom() {}, genCode: () => 'ZZZZ', log() {} });
    const HO = mk();
    const t = HO._test.sign({ rid: 'r1', c: 'ABCD', g: 'word', o: {}, pv: false, h: true, ch: 12345, u: null, n: '가' });
    const v = HO._test.verify(t);
    ok(v && v.c === 'ABCD' && v.ch === 12345 && v.h === true, '서명한 표는 그대로 읽혀요');
    const [body, mac] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), ch: 999999999 })).toString('base64url') + '.' + mac;
    ok(HO._test.verify(forged) === null, '칩을 고친 표는 거절');
    ok(HO._test.verify('abc') === null && HO._test.verify(null) === null && HO._test.verify(t + 'x') === null, '망가진 표는 거절');
    process.env.MOVE_SECRET = 'other-secret';
    const HO2 = mk();
    ok(HO2._test.verify(t) === null, '다른 열쇠로 만든 표는 거절');
    process.env.MOVE_SECRET = 'unit-test-secret';
    const old = HO._test.sign({ rid: 'r', c: 'ABCD', g: 'word', e: Date.now() - 1000 });
    ok(HO._test.verify(old) === null, '10분이 지난 표는 거절');
  }
  console.log('▶ 부팅 번호 (나보다 나중에 켜진 서버만 새 버전)');
  {
    const io = { sockets: { sockets: new Map() }, emit() {} };
    const mine = `${(Date.now() - 60000).toString(36)}.abcd`, newer = `${Date.now().toString(36)}.ef01`, older = `${(Date.now() - 120000).toString(36)}.9999`;
    const HO = require('../lib/handoff')({ io, rooms: new Map(), H: {}, ACC: {}, REGISTRY: {}, cloud: false, boot: mine, publicUrl: () => '',
      makeRoom() {}, addPlayer() {}, leaveRoom() {}, genCode: () => 'ZZZZ', log() {} });
    ok(HO._test.newer(newer) && !HO._test.newer(older) && !HO._test.newer(mine), '나중에 켜진 번호만 새 버전으로 쳐요 (새 서버가 옛 서버를 보고 갈아타지 않게)');
    ok(!HO._test.newer('x') && !HO._test.newer(undefined) && !HO._test.newer(''), '이상한 번호는 무시');
  }

  console.log('▶ 계정: 새로 켜진 서버는 로그인할 때 DB에서 한 번 더 읽어요');
  const sockets = [];
  const io = { emit() {}, to: () => ({ emit() {} }), sockets: { sockets: new Map() } };
  const H = { participants: r => r.players, pushRoom() {}, sys() {} };
  const ACC = require('../lib/accounts')({ io, rooms: new Map(), H, registry: () => ({}), ipOf: () => '1.1.1.1', cloud: true });
  await ACC.init();
  const users = ACC._int.users;
  ok(users.get('u1').xp === 100, '켜질 때 읽은 xp 100');
  // 옛 서버가 그사이 판을 끝내 저장 (xp 100 → 160) + 그사이 옛 서버에서 새로 로그인한 사람(u3)
  DB.set('u1', { ...DB.get('u1'), xp: 160, plays: 3 });
  DB.set('u3', doc('u3', '셋', 50, 'tok-3'));
  function sock() {
    const h = {}, s = { id: 's' + sockets.length, data: {}, emitted: [], emit(ev, d) { this.emitted.push([ev, d]); }, connected: true, on(ev, fn) { h['sock:' + ev] = fn; } };
    ACC.attach(s, (ev, fn) => { h[ev] = fn; });
    s.call = (ev, d) => new Promise(res => { const r = h[ev](d, res); if (r && r.then) r.catch(e => res({ err: e.message })); });
    sockets.push(s);
    return s;
  }
  const s1 = sock();
  let r = await s1.call('acct:hello', 'tok-1');
  const x1 = users.get('u1').xp;                 // 160 + 오늘 출석 보상
  ok(r.ok && r.me && x1 >= 160 && x1 < 300 && users.get('u1').plays === 3, `로그인하면 옛 서버의 최신 기록으로 (xp 100 → ${x1} · 판수 3)`);
  // 이제 새 서버가 바꿨으니(접속 시각 저장) 그 뒤 DB 값으로 덮지 않아요
  DB.set('u1', { ...DB.get('u1'), xp: 999 });
  const s1b = sock();
  r = await s1b.call('acct:hello', 'tok-1');
  ok(r.ok && r.me.xp === x1, `새 서버가 이미 바꾼 계정은 메모리 것 그대로 (${r.me && r.me.xp} · DB 999로 덮지 않음)`);
  const s3 = sock();
  r = await s3.call('acct:hello', 'tok-3');
  ok(r.ok && r.me && r.me.id === 'u3' && users.get('u3').name === '셋', '옛 서버에서 그사이 로그인한 토큰도 DB에서 찾아 로그인');
  const s2 = sock();
  r = await s2.call('acct:hello', 'tok-x');
  ok(r.ok && r.me === null, '모르는 토큰은 그냥 손님');

  console.log('▶ 갈아타는 중인 옛 서버: 접속 시각만 바뀐 계정은 저장 안 함');
  const n0 = writes.length;
  ACC.setDraining(true);
  const s2b = sock();
  await s2b.call('acct:hello', 'tok-2');        // 로그인 (bind → 저장 1번은 괜찮아요)
  const n1 = writes.length;
  await s2b.call('acct:logout');                 // 로그아웃 → unbind → 접속 시각 (저장 안 함)
  const after = writes.slice(n1).filter(id => id === 'u2').length;
  ok(n1 > n0 && after <= 1, `연결이 끊길 때 접속 시각만 저장하지 않아요 (그 뒤 u2 저장 ${after}번 — 로그아웃 자체 저장만)`);
  ACC.setDraining(false);

  console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
