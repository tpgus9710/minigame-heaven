// 🍱 학식 메뉴 검사 (lib/meal.js): 홈페이지 표 읽기 · 어느 주의 표인지 · 시각에 맞는 끼니 · 서버 흐름(가짜 홈페이지)
const http = require('http'), path = require('path');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

// 실제 페이지(2026-11 둘째 주)와 같은 모양으로 만든 표 — 칸 안에 span · &nbsp; · 쉼표
const W1 = {
  월: ['백미밥 , 감자고추장찌개 , 순살안동찜닭 , 진미채야채무침 , 목이버섯볶음 , 배추김치', '백미밥 , 맑은콩나물국 , 매콤돈육찜 , 환어묵미트볼조림 , 얼갈이된장나물 , 배추김치'],
  화: ['참치김치덮밥 , 팽이미소장국 , 파채가라아게 , 톳두부무침 , 양상추샐러드&amp;키위d , 깍두기', '백미밥 , 근대된장국 , 훈제오리야채볶음 , 베이컨볶음우동 , 오이부추무침 , 배추김치'],
  수: ['백미밥 , 조랭이떡국 , 제육볶음&amp;상추쌈 , 미니츄러스 , 콩나물김가루무침 , 배추김치', '후리가케밥 , 옥수수스프&amp;크루통 , 뉴욕핫도그 , 감자튀김&amp;어니언시즈닝 , 양배추샐러드&amp;딸기d , 배추김치'],
  목: ['바지락칼국수 , 추가밥 , 교자만두찜 , 도토리묵양념무침 , 양상추샐러드&amp;오리엔탈d , 배추김치', '백미밥 , 맑은소고기뭇국 , 순대닭갈비 , 수제꽃팽이튀김 , 단배추겉절이 , 배추김치'],
  금: ['백미밥 , 두부새우젓국 , 통오리야채볶음 , 김치피자탕수육 , 청경채된장나물 , 배추김치', '백미밥 , 청양홍합탕 , 바싹돈불고기 , 감자고추장조림 , 새송이허브솔트볶음 , 배추김치'],
};
const page = (week, { br = false, dates = null } = {}) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>식단정보</title>
<script>var x = "<table><tr><td>월요일</td></tr></table>";</script></head><body>
<div id="contents"><p class="txt">메뉴는 식자재 수급 상황에 따라 변경될 수 있습니다.!!</p>
<h4>식사시간표</h4><table class="tbl_table"><thead><tr><th scope="col">아침</th><th scope="col">점심</th><th scope="col">저녁</th></tr></thead>
<tbody><tr><td>운영안함</td><td>(평일) 12:00 ~ 12:45</td><td>(평일) 17:50 ~ 18:35</td></tr></tbody></table>
<h4>식단정보</h4><p>지난주 ~ 다음주</p>
<table class="tbl_table menu"><caption>식단정보</caption><thead><tr><th>구분</th><th>조식</th><th>중식</th><th>석식</th></tr></thead><tbody>
${['월', '화', '수', '목', '금', '토', '일'].map((d, i) => {
    const [l, n] = week[d] || ['', ''];
    const cell = s => (br ? s.split(' , ').join('<br />') : s);
    return `<tr><th scope="row">${d}요일${dates ? `<br>(${dates[i]})` : ''}</th><td>&nbsp;</td><td><span>${cell(l)}</span></td><td><span>${cell(n)}</span></td></tr>`;
  }).join('\n')}
</tbody></table><!-- <table><tr><td>중식 월요일</td></tr></table> --></div></body></html>`;

const M = require('../lib/meal.js');
const at = s => Date.parse(s + '+09:00');                       // 한국 시각 → ms

console.log('▶ 표 읽기');
{
  const p = M.parse(page(W1));
  ok(p && Object.keys(p.days).length === 7, '요일 7줄');
  ok(p && p.days['화'].lunch.join('|') === '참치김치덮밥|팽이미소장국|파채가라아게|톳두부무침|양상추샐러드&키위d|깍두기', '화요일 중식 6가지 (&amp; 풀기)', p && p.days['화'].lunch.join('|'));
  ok(p && p.days['수'].dinner[2] === '뉴욕핫도그' && p.days['토'].lunch.length === 0, '석식 · 빈 토요일');
  ok(p && p.sched && p.sched.lunch === '(평일) 12:00 ~ 12:45' && p.sched.dinner === '(평일) 17:50 ~ 18:35', '식사 시간: ' + JSON.stringify(p && p.sched));
  const pb = M.parse(page(W1, { br: true }));
  ok(pb && pb.days['월'].lunch.length === 6 && pb.days['월'].lunch[2] === '순살안동찜닭', '줄바꿈(<br>)으로 나눈 칸도');
  ok(M.parse('<html><body><table><tr><td>안녕</td></tr></table></body></html>') === null, '식단 표가 없으면 null');
  const blank = M.parse('<table><tr><th>구분</th><th>조식</th><th>중식</th><th>석식</th></tr><tr><td colspan="4">등록된 식단이 없습니다.</td></tr></table>');
  ok(blank && M.emptyWeek(blank.days), '식단 표 틀만 있고 요일 줄이 없으면 = 빈 주 (아직 안 올림)');
  const emptyCells = M.parse(page({}));
  ok(emptyCells && Object.keys(emptyCells.days).length === 7 && M.emptyWeek(emptyCells.days), '요일 줄은 있는데 칸이 모두 비었으면 = 빈 주');
}

console.log('▶ 어느 주의 표인가요?');
{
  const p = M.parse(page(W1)), h = M.hashOf(p.days);
  const tue = M.kst(at('2026-11-10T09:00:00')), sat = M.kst(at('2026-11-14T10:00:00')), nextMon = M.kst(at('2026-11-16T08:00:00'));
  ok(M.weekOf(p, h, tue, {}).week === '2026-11-09', '평일에 읽으면 이번 주');
  ok(M.weekOf(p, h, nextMon, { '2026-11-09': h }).week === '2026-11-09', '다음 주 월요일 아침에도 지난주 표 그대로면 = 아직 안 올라옴 (지난주 표)');
  const p2 = M.parse(page({ ...W1, 월: ['짜장밥 , 계란국', '백미밥 , 미역국'] })), h2 = M.hashOf(p2.days);
  ok(M.weekOf(p2, h2, sat, { '2026-11-09': h }).week === '2026-11-16', '주말에 표가 바뀌어 있으면 다음 주');
  ok(M.weekOf(p, h, sat, { '2026-11-09': h }).week === '2026-11-09', '주말에 그대로면 이번 주');
  ok(M.weekOf(p, h, sat, {}).week === null, '주말에 처음 읽으면 어느 주인지 모름');
  const pd = M.parse(page(W1, { dates: ['11.16', '11.17', '11.18', '11.19', '11.20', '11.21', '11.22'] }));
  ok(M.weekOf(pd, M.hashOf(pd.days), sat, {}).week === '2026-11-16', '요일 칸에 날짜가 있으면 그 날짜로');
  const py = M.parse(page(W1, { dates: ['12.28', '12.29', '12.30', '12.31', '1.1', '1.2', '1.3'] }));
  ok(M.weekOf(py, M.hashOf(py.days), M.kst(at('2027-01-02T10:00:00')), {}).week === '2026-12-28', '해가 바뀌는 주도');
}

console.log('▶ 시각에 맞는 끼니 (13시 전 중식 · 18시 전 석식 · 그 뒤 다음 날 중식)');
{
  const p = M.parse(page(W1));
  const data = { ...p, week: '2026-11-09' };
  const t = (s, d = data) => M.pick(M.kst(at(s)), d);
  let r = t('2026-11-10T09:00:00');
  ok(r.label === '오늘 중식' && r.dow === '화' && r.items[0] === '참치김치덮밥' && r.time === '(평일) 12:00 ~ 12:45', `화 9:00 → ${r.label} ${r.items[0]}`);
  r = t('2026-11-10T12:59:00'); ok(r.kind === 'lunch', '12:59 → 아직 중식');
  r = t('2026-11-10T13:00:00'); ok(r.label === '오늘 석식' && r.items[2] === '훈제오리야채볶음', `13:00 → ${r.label} ${r.items[2]}`);
  r = t('2026-11-10T17:59:00'); ok(r.kind === 'dinner', '17:59 → 아직 석식');
  r = t('2026-11-10T18:00:00'); ok(r.label === '내일 중식' && r.dow === '수' && r.items[1] === '조랭이떡국', `18:00 → ${r.label}(${r.dow}) ${r.items[1]}`);
  r = t('2026-11-11T00:30:00'); ok(r.label === '오늘 중식' && r.dow === '수', '자정 넘으면 그날 중식');
  r = t('2026-11-13T19:00:00'); ok(r.label === '월요일 중식' && r.date === '2026-11-16' && !r.items.length && /다음 주 식단이 아직/.test(r.why), `금 19:00 → ${r.label}: ${r.why}`);
  r = t('2026-11-15T10:00:00', { ...p, week: '2026-11-16' }); ok(r.label === '내일 중식' && r.items.length === 6, '일요일 · 다음 주 표가 올라와 있으면 → 내일(월) 중식');
  r = t('2026-11-14T10:00:00', { ...p, week: null }); ok(!r.items.length && /어느 주/.test(r.why), '주말 · 어느 주인지 모르면 안 보여 줘요');
  r = t('2026-11-16T08:00:00'); ok(!r.items.length && /이번 주 식단이 아직/.test(r.why), `월 8:00 · 지난주 표만 있으면: ${r.why}`);
  const hol = { ...data, days: { ...data.days, 수: { lunch: [], dinner: [] } } };
  r = t('2026-11-11T09:00:00', hol); ok(!r.items.length && /식단이 없어요/.test(r.why), '휴일(빈 칸)');
  r = t('2026-11-16T09:00:00', { ...M.parse(page({})), week: '2026-11-16' }); ok(!r.items.length && /아직 학교 홈페이지에 안 올라왔어요/.test(r.why), `표가 통째로 비었으면: ${r.why}`);
}

// 학교 서버가 중간 인증서를 빼먹고 보낼 때: 인증서의 AIA 주소에서 받아 와 다시 연결 (검사는 그대로)
async function tlsChain() {
  console.log('▶ 중간 인증서를 빼먹은 https 홈페이지');
  const { execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), https = require('https');
  try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch { console.log('  (openssl 이 없어 건너뛰어요)'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-tls-')), f = n => path.join(dir, n);
  const ssl = (...a) => execFileSync('openssl', a, { stdio: 'pipe' });
  const ec = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes'];
  let interHits = 0, interDer = null;
  const aia = http.createServer((req, res) => { interHits++; res.writeHead(200, { 'Content-Type': 'application/pkix-cert' }); res.end(interDer); });
  await new Promise(r => aia.listen(0, '127.0.0.1', r));
  const mkCA = (name, signer) => {
    fs.writeFileSync(f('ca.ext'), 'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n');
    if (!signer) return ssl('req', '-x509', ...ec, '-keyout', f(name + '.key'), '-out', f(name + '.pem'), '-days', '3650', '-subj', '/CN=Meal Test ' + name, '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
    ssl('req', ...ec, '-keyout', f(name + '.key'), '-out', f(name + '.csr'), '-subj', '/CN=Meal Test ' + name);
    ssl('x509', '-req', '-in', f(name + '.csr'), '-CA', f(signer + '.pem'), '-CAkey', f(signer + '.key'), '-CAcreateserial', '-out', f(name + '.pem'), '-days', '3650', '-extfile', f('ca.ext'));
  };
  mkCA('root'); mkCA('inter', 'root'); mkCA('other');
  fs.writeFileSync(f('leaf.ext'), `subjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nauthorityInfoAccess=caIssuers;URI:http://127.0.0.1:${aia.address().port}/inter.crt\n`);
  ssl('req', ...ec, '-keyout', f('leaf.key'), '-out', f('leaf.csr'), '-subj', '/CN=127.0.0.1');
  ssl('x509', '-req', '-in', f('leaf.csr'), '-CA', f('inter.pem'), '-CAkey', f('inter.key'), '-CAcreateserial', '-out', f('leaf.pem'), '-days', '800', '-extfile', f('leaf.ext'));
  interDer = ssl('x509', '-in', f('inter.pem'), '-outform', 'der');
  const site = https.createServer({ key: fs.readFileSync(f('leaf.key')), cert: fs.readFileSync(f('leaf.pem')) },   // 중간 인증서 없이 leaf 만
    (req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' }); res.end(page(W1)); });
  await new Promise(r => site.listen(0, '127.0.0.1', r));
  const root = fs.readFileSync(f('root.pem'), 'utf8'), other = fs.readFileSync(f('other.pem'), 'utf8');
  const plain = await new Promise(r => https.get(`https://127.0.0.1:${site.address().port}/`, { ca: [root] }, () => r('ok')).on('error', e => r(e.code)));
  ok(plain === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', '그냥 연결하면 실패 (중간 인증서가 없어서): ' + plain);
  const fresh = roots => {
    process.env.MEAL_URL = `https://127.0.0.1:${site.address().port}/robot/content.do?menu=9104`;
    delete require.cache[require.resolve('../lib/meal.js')];
    const m = require('../lib/meal.js'); m._tls.setRoots(roots); return m;
  };
  let m = fresh([root]);
  const html = await m._tls.fetchHtml().catch(e => 'ERR ' + e.message);
  ok(/식단정보/.test(html) && m._tls.EXTRA.length === 1 && interHits === 1, `AIA 주소에서 중간 인증서를 받아 다시 연결 (${String(html).slice(0, 30)}… · 받은 횟수 ${interHits})`);
  const again = await m._tls.fetchHtml().catch(e => 'ERR ' + e.message);
  ok(/식단정보/.test(again) && interHits === 1, '한 번 받은 중간 인증서는 기억해요');
  m = fresh([other]);                                                   // 믿지 않는 뿌리 → 끝까지 거절
  const bad = await m._tls.fetchHtml().then(() => 'ok', e => 'ERR ' + (e.code || e.message));
  ok(bad.startsWith('ERR'), '뿌리 인증서가 다르면 그대로 거절 (검사를 끄지 않아요): ' + bad);
  site.close(); aia.close();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.MEAL_URL;
}

console.log('▶ 서버 흐름 (가짜 학교 홈페이지)');
(async () => {
  let hits = 0, html = page(W1);
  const srv = http.createServer((req, res) => {
    hits++;
    if (req.url.startsWith('/old')) { res.writeHead(301, { Location: '/robot/content.do?menu=9104' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' }); res.end(html);
  });
  await new Promise(r => srv.listen(0, r));
  process.env.MEAL_URL = `http://127.0.0.1:${srv.address().port}/old`;   // 옮겨진 주소도 따라가요
  delete require.cache[require.resolve('../lib/meal.js')];
  const makeMeal = require('../lib/meal.js');
  const sys = new Map();
  const ACC = { _int: { onReady: f => f(), sysGet: id => sys.get(id) || null, sysPut: d => sys.set(d.id, JSON.parse(JSON.stringify(d))) } };
  const meal = makeMeal({ ACC, log: () => {} });
  let v = await meal.view(at('2026-11-10T09:00:00'));
  ok(v.ok && v.pick.label === '오늘 중식' && v.pick.items.length === 6 && v.week.length === 5 && v.week[0].date === '2026-11-09', `처음 볼 때 읽어 와요: ${v.pick.label} ${v.pick.items.slice(0, 3).join(' · ')}`);
  ok(v.slot === '2026-11-10:lunch' && v.sched.dinner.includes('17:50'), '알림 칸 · 식사 시간');
  const h1 = hits;
  v = await meal.view(at('2026-11-10T14:00:00'));
  ok(hits === h1 && v.pick.label === '오늘 석식', '30분 안에는 홈페이지를 다시 읽지 않아요');
  ok(sys.get('__meal') && sys.get('__meal').base['2026-11-09'], '본 표를 저장소에 기억 (서버를 다시 켜도)');
  const meal2 = makeMeal({ ACC, log: () => {} });                     // 서버를 다시 켠 셈
  ok(meal2._test.S.data && meal2._test.S.data.week === '2026-11-09', '다시 켜도 마지막 표를 바로 써요');
  srv.close();
  await tlsChain();
  console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
  process.exit(fails ? 1 : 0);
})();
