// 🔍 틀린그림찾기 v3 검사 (진짜 사진: public/js/shared/spot-photos.js + spot-core.js · 그림 파일 public/img/spot/)
//  사진 목록이 맞는지 · 같은 씨앗 → 같은 판 · 겹치는 곳은 같이 안 나오기 · 난이도 · 누른 자리 판정 · 멀티 서버 흐름
//  (사진에서 정답 원 밖이 한 점도 안 달라지는지는 브라우저로 그려서 비교해요: 개발용 spot_check.py)
const fs = require('fs');
const path = require('path');
const S = require('../public/js/shared/spot-core.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const IMG = path.join(__dirname, '..', 'public', 'img', 'spot');

/** 그림 파일 크기 읽기 (JPEG · WebP 머리만 봐요) */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const t = buf.toString('ascii', 12, 16);
  if (t === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (t === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (t === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  return null;
}

console.log('▶ 사진 목록 · 그림 파일');
{
  const P = S.PHOTOS;
  ok(P.length >= 25, `사진 ${P.length}장 (25장 이상)`);
  const total = P.reduce((a, p) => a + p.d.length, 0);
  ok(total >= 180, `고친 곳 모두 ${total}곳 (180곳 이상)`);
  ok(new Set(P.map(p => p.id)).size === P.length, '사진 id 가 겹치지 않아요');
  let missing = [], badSize = [], badAtlas = [], bytes = 0;
  for (const p of P) {
    const jp = path.join(IMG, p.id + '.jpg'), wp = path.join(IMG, p.id + '-d.webp');
    if (!fs.existsSync(jp) || !fs.existsSync(wp)) { missing.push(p.id); continue; }
    const jb = fs.readFileSync(jp), wb = fs.readFileSync(wp);
    bytes += jb.length + wb.length;
    const js = jpegSize(jb), ws = webpSize(wb);
    if (!js || js[0] !== 1200 || js[1] !== 900) badSize.push(`${p.id} ${js}`);
    if (!ws) { badAtlas.push(p.id + ' (webp?)'); continue; }
    for (const a of p.d) {
      const [, , , , , ax, ay, aw, ah, px, py] = a;
      if (ax < 0 || ay < 0 || ax + aw > ws[0] || ay + ah > ws[1] || aw < 1 || ah < 1) badAtlas.push(`${p.id} 조각이 그림 밖`);
      if (px < 0 || py < 0 || px + aw > 1200 || py + ah > 900) badAtlas.push(`${p.id} 붙일 곳이 사진 밖`);
    }
  }
  ok(!missing.length, '사진마다 사진 파일(.jpg)과 고친 조각(-d.webp)이 있어요', missing.join(', '));
  ok(!badSize.length, '사진은 모두 1200 × 900', badSize.join(', '));
  ok(!badAtlas.length, '고친 조각 위치가 모두 그림 안에 있어요', badAtlas.slice(0, 5).join(', '));
  ok(bytes < 12 * 1024 * 1024, `사진 파일 전체 ${(bytes / 1048576).toFixed(1)}MB (12MB 아래)`);
  const credits = P.every(p => p.by && p.src && p.t);
  ok(credits, '사진마다 제목 · 찍은 사람 · 출처(CC0)가 있어요');
}

console.log('▶ 고친 곳 (정답 원 · 어려움 · 종류 · 같이 못 나오는 곳)');
{
  const kinds = {};
  let bad = [], asym = [], nBad = [], few = [];
  for (const p of S.PHOTOS) {
    p.d.forEach((a, j) => {
      const [x, y, r, d, k] = a;
      kinds[S.KINDS[k]] = (kinds[S.KINDS[k]] || 0) + 1;
      if (!(x > 0 && x < S.W && y > 0 && y < S.H && r >= 6 && r <= 60 && [1, 2, 3].includes(d) && S.KINDS[k])) bad.push(`${p.id}#${j}`);
      for (const c of a[11] || []) if (!(p.d[c] && (p.d[c][11] || []).includes(j))) asym.push(`${p.id}#${j}-${c}`);
      // 같이 못 나오는 곳이 아니면 정답 원이 서로 떨어져 있어야 해요
      p.d.forEach((b, i) => {
        if (i <= j || (a[11] || []).includes(i)) return;
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < a[2] + b[2] + 4) bad.push(`${p.id}#${j}~${i} 겹침`);
      });
    });
    // n: 같이 낼 수 있는 가장 많은 수 (직접 세어서 확인)
    let best = 0;
    for (let m = 0; m < (1 << p.d.length); m++) {
      const pick = p.d.map((_, i) => i).filter(i => m >> i & 1);
      if (pick.length <= best) continue;
      if (pick.every(i => !(p.d[i][11] || []).some(c => pick.includes(c)))) best = pick.length;
    }
    if (best !== p.n) nBad.push(`${p.id} ${p.n}≠${best}`);
    if (p.n < 3) few.push(p.id);
  }
  ok(!bad.length, '정답 원은 사진 안 · 반지름 6~60 · 어려움 1~3 · 겹치는 곳은 「같이 못 나오는 곳」으로 묶여 있어요', bad.slice(0, 6).join(', '));
  ok(!asym.length, '「같이 못 나오는 곳」은 서로 짝이 맞아요', asym.slice(0, 5).join(', '));
  ok(!nBad.length && !few.length, '사진마다 같이 낼 수 있는 다른 곳 수(n)가 맞고 3곳 이상', nBad.concat(few).join(', '));
  const kk = Object.keys(kinds);
  ok(kk.length >= 4 && kinds.gone > 0 && kinds.color > 0 && kinds.add > 0 && kinds.flip > 0, `바뀌는 종류 ${kk.length}가지 (${kk.map(k => `${S.KIND_NAMES[k]} ${kinds[k]}`).join(' · ')})`);
  const lv = [1, 2, 3].map(d => S.PHOTOS.reduce((a, p) => a + p.d.filter(x => x[3] === d).length, 0));
  ok(lv.every(v => v >= 30), `쉬움 · 보통 · 어려움 곳이 골고루 (${lv.join(' · ')})`);
}

console.log('▶ 같은 씨앗이면 서버 · 화면이 똑같은 판');
{
  const a = JSON.stringify(S.make(424242, 5, 2.5)), b = JSON.stringify(S.make(424242, 5, 2.5));
  ok(a === b, '같은 씨앗 · 같은 설정 → 똑같은 사진 · 고친 곳 · 쪽');
  const real = Math.random; Math.random = () => { throw new Error('Math.random 을 쓰면 안 돼요'); };
  let threw = false; try { for (let k = 0; k < 300; k++) S.make(1000 + k, 3 + (k % 5), 1.5 + (k % 4)); } catch (e) { threw = e.message; }
  Math.random = real;
  ok(!threw, '판을 만들 때 Math.random 을 쓰지 않아요 (씨앗만)', threw);
  ok(JSON.stringify(S.make(7, 5, 2)) !== JSON.stringify(S.make(8, 5, 2)), '씨앗이 다르면 다른 판');
  const m1 = S.make(99, 5, 2.5, { photo: 3 }), m2 = S.make(99, 5, 2.5, { photo: 3 });
  ok(JSON.stringify(m1) === JSON.stringify(m2) && m1.photo === 3, '사진 번호를 정해 줘도 같은 씨앗이면 같은 판 (멀티: 서버가 사진 번호를 보내요)');
}

console.log('▶ 판 만들기 (3000판)');
{
  let short = 0, conflict = 0, wrongSide = 0, mirrorBad = 0, notEligible = 0, mirrored = 0, avoidHit = 0;
  const seen = new Set();
  for (let k = 0; k < 3000; k++) {
    const n = [3, 4, 5, 6, 7][k % 5], lv = 1.5 + (k % 4);
    const avoid = k % 3 === 0 ? [0, 1, 2, 3, 4] : undefined;
    const p = S.make(5000 + k * 37, n, lv, { avoid }), ph = S.PHOTOS[p.photo];
    seen.add(p.photo);
    if (ph.n < n) notEligible++;
    if (avoid && avoid.includes(p.photo) && S.eligible(n).some(i => !avoid.includes(i))) avoidHit++;
    if (p.diffs.length !== Math.min(n, ph.n)) short++;
    if (p.mirror) { mirrored++; if (!ph.m) mirrorBad++; }
    for (const d of p.diffs) {
      if (d.side !== 0 && d.side !== 1) wrongSide++;
      const raw = ph.d[d.j];
      if (Math.abs((p.mirror ? S.W - raw[0] : raw[0]) - d.x) > 0.06 || raw[1] !== d.y) mirrorBad++;
      if (p.diffs.some(e => e !== d && (raw[11] || []).includes(e.j))) conflict++;
    }
  }
  ok(!short, '늘 정한 개수만큼 다른 곳을 내요 (3 ~ 7곳)', short);
  ok(!notEligible, 'n곳을 낼 수 있는 사진만 골라요', notEligible);
  ok(!conflict, '겹치는 곳은 한 판에 같이 안 나와요', conflict);
  ok(!wrongSide && !mirrorBad, '고친 곳은 왼쪽 · 오른쪽 중 한 쪽에 · 좌우 뒤집기는 글자 없는 사진만 (정답 자리도 같이 뒤집혀요)', `${wrongSide} · ${mirrorBad}`);
  ok(mirrored > 300, `좌우 뒤집은 판도 나와요 (${mirrored}판)`);
  ok(!avoidHit, '최근에 본 사진은 피해서 골라요');
  ok(seen.size === S.PHOTOS.length, `사진 ${seen.size}장이 모두 나와요`);
  const avg = lv => { let d = 0, c = 0; for (let k = 0; k < 600; k++) S.make(77 + k, 5, lv).diffs.forEach(x => { d += x.d; c++; }); return d / c; };
  const e = avg(1.5), h = avg(4.5);
  ok(e + 0.5 < h, `사진 난이도가 높을수록 작고 헷갈리는 곳이 많아요 (평균 어려움 ${e.toFixed(2)} → ${h.toFixed(2)})`);
}

console.log('▶ 누른 자리 판정');
{
  const p = S.make(31337, 5, 2.5);
  const d = p.diffs;
  ok(d.every((x, i) => S.hit(d, x.x, x.y, {}) === i), '가운데를 누르면 그 다른 곳');
  ok(S.hit(d, d[0].x + d[0].r + 6, d[0].y, {}) === 0, '가장자리 조금 밖(손가락 여유)도 맞아요');
  ok(S.hit(d, d[0].x, d[0].y, { 0: 'me' }) === -1 && S.near(d, d[0].x, d[0].y, { 0: 'me' }), '이미 찾은 곳은 다시 안 쳐요 (틀린 것도 아님)');
  let far = null;
  for (let y = 5; y < S.H && !far; y += 7) for (let x = 5; x < S.W && !far; x += 7) if (d.every(q => Math.hypot(q.x - x, q.y - y) > q.r + 30)) far = [x, y];
  ok(far && S.hit(d, far[0], far[1], {}) === -1, '아무것도 없는 곳은 -1 (틀림)');
}

console.log('▶ 멀티 (서버 흐름)');
{
  const G = require('../games/spot.js');
  const o = Object.fromEntries(G.OPTIONS.map(x => [x.key, x]));
  ok(o.dfPic && o.dfPic.values.length === 4 && o.diffs.values.map(v => v[0]).join() === '3,5,7', '사진 난이도(쉬움 ~ 지옥) · 다른 곳 3 · 5 · 7곳');
  const ev = [], timers = [], toMe = [];
  let result = null;
  const H = {
    participants: room => room.players, emit: (room, e, d) => ev.push([e, d]), later: (room, ms, fn) => { timers.push(fn); return timers.length; }, cancel: () => {},
    int: v => v | 0, num: v => Number(v), toPlayer: (id, e, d) => toMe.push([e, d]), pushScores: () => {}, finishGame: (room, r) => { result = r; room.game.over = true; },
  };
  const mod = G(H), room = { players: [{ id: 'a', name: '가' }, { id: 'b', name: '나' }], options: { rounds: 3, diffs: 5, dfPic: 3.5, bots: 0 } };
  mod.start(room);
  const run = () => { const t = timers.splice(0); t.forEach(f => f()); };
  run();                                                                  // 첫 사진
  const r1 = ev.filter(([e]) => e === 'df:round').pop();
  ok(r1 && r1[1].photo >= 0 && S.photo(r1[1].photo).n >= 5, '서버가 5곳을 낼 수 있는 사진 번호 · 씨앗을 보내요');
  const puz = S.make(r1[1].seed, r1[1].n, r1[1].lv, { photo: r1[1].photo });
  room.game.startAt = 0;
  mod.events['df:tap'](room, { id: 'a' }, { x: puz.diffs[0].x, y: puz.diffs[0].y, r: 1, tol: 15 });
  const f = ev.filter(([e]) => e === 'df:found').pop();
  ok(f && f[1].i === 0 && f[1].id === 'a', '화면과 같은 판: 가운데를 누르면 서버도 맞았다고 해요');
  mod.events['df:tap'](room, { id: 'b' }, { x: 1, y: 1, r: 1, tol: 15 });
  ok(toMe.some(([e]) => e === 'df:miss'), '빈 곳을 누르면 틀림 (1.5초 쉬기)');
  puz.diffs.slice(1).forEach(d => mod.events['df:tap'](room, { id: 'a' }, { x: d.x, y: d.y, r: 1, tol: 15 }));
  const end = ev.filter(([e]) => e === 'df:end').pop();
  ok(end && end[1].why === 'all' && end[1].next != null, '다 찾으면 사진이 끝나고 다음 사진 번호를 미리 알려 줘요');
  const used = [r1[1].photo];
  for (let i = 0; i < 4 && !result; i++) { run(); const r = ev.filter(([e]) => e === 'df:round').pop(); if (r && !used.includes(r[1].photo) && r[1].round > used.length) used.push(r[1].photo); room.game.phase === 'play' && (room.game.endAt = 0); run(); }
  ok(new Set(used).size === used.length && used.length >= 2, `한 게임 안에서는 같은 사진이 다시 안 나와요 (${used.join(', ')})`);
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
