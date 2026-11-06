'use strict';
/**
 * 📖 우리말 사전 (끝말잇기 판정용) — data/kodict/words.txt.gz
 *  국립국어원 《표준국어대사전》 · 《우리말샘》 명사(대명사·수사 포함) 49만 낱말.
 *  자료 출처와 이용 조건(CC BY-SA)은 data/kodict/NOTICE.md 에 있어요.
 *
 *  줄 형식: [!|*]낱말   ! = 표준어가 아닌 말(방언·옛말·북한어·띄어 쓰는 구)   * = 흔한 말
 *  낱말이 가나다순이라 첫 글자가 같은 줄은 붙어 있어요. 처음 쓸 때 한 번만 풀어서(0.3초쯤)
 *  첫 글자별로 글자열 조각만 잘라 들고 있어요 (낱말마다 객체를 만들지 않아 메모리가 적어요).
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const FILE = path.join(__dirname, '..', 'data', 'kodict', 'words.txt.gz');
let G = null;                       // 첫 글자 → { s: "\n낱말\n!낱말\n*낱말\n", nStd, nExt, common[] }
const COUNT = { std: 0, ext: 0, common: 0 };

function load() {
  if (G) return G;
  const t0 = Date.now();
  G = new Map();
  let text;
  try { text = '\n' + zlib.gunzipSync(fs.readFileSync(FILE)).toString('utf8'); }
  catch (e) { console.error('⚠️  사전 파일을 못 읽었어요:', e.message); return G; }
  if (!text.endsWith('\n')) text += '\n';
  let pos = 0, gc = '', gs = 0, g = null;
  const close = end => { if (g) { g.s = text.slice(gs, end + 1); G.set(gc, g); } };
  while (pos < text.length - 1) {
    const next = text.indexOf('\n', pos + 1);
    if (next < 0) break;
    let i = pos + 1;
    const flag = text[i] === '!' ? '!' : text[i] === '*' ? '*' : '';
    if (flag) i++;
    if (next - i >= 2) {
      const c = text[i];
      if (c !== gc) { close(pos); gc = c; gs = pos; g = { s: '', nStd: 0, nExt: 0, common: [] }; }
      if (flag === '!') { g.nExt++; COUNT.ext++; }
      else { g.nStd++; COUNT.std++; if (flag === '*') { g.common.push(text.slice(i, next)); COUNT.common++; } }
    }
    pos = next;
  }
  close(pos);
  console.log(`📖 사전 준비: ${(COUNT.std + COUNT.ext).toLocaleString()}낱말 (${Date.now() - t0}ms)`);
  return G;
}

/** 사전에 있으면 'std'(표준어) 또는 'ext'(방언·옛말·북한어·띄어 쓰는 구), 없으면 null */
function lookup(word) {
  const w = String(word || '');
  if (w.length < 2 || !/^[가-힣]+$/.test(w)) return null;
  const g = load().get(w[0]);
  if (!g) return null;
  if (g.s.includes('\n' + w + '\n') || g.s.includes('\n*' + w + '\n')) return 'std';
  if (g.s.includes('\n!' + w + '\n')) return 'ext';
  return null;
}
const allowed = (kind, stdOnly) => kind === 'std' || (kind === 'ext' && !stdOnly);

/** 그 글자로 시작하는, 아직 안 쓴 낱말이 있나요? (없으면 한방 단어) */
function canStart(chars, used, stdOnly) {
  const map = load();
  for (const c of chars) {
    const g = map.get(c);
    if (!g) continue;
    const total = g.nStd + (stdOnly ? 0 : g.nExt);
    if (!total) continue;
    let usedHere = 0;
    for (const u of used || []) if (u[0] === c && allowed(lookup(u), stdOnly)) usedHere++;
    if (total > usedHere) return true;
  }
  return false;
}

/** 조각 s 의 아무 곳 → 그다음 줄 낱말 { w, ext } */
function randomLine(s, rnd) {
  if (s.length < 4) return null;
  let a = s.indexOf('\n', Math.floor(rnd() * (s.length - 1)));
  if (a < 0 || a >= s.length - 1) a = 0;
  const b = s.indexOf('\n', a + 1);
  if (b <= a + 1) return null;
  const line = s.slice(a + 1, b);
  return line[0] === '!' ? { w: line.slice(1), ext: true } : { w: line[0] === '*' ? line.slice(1) : line, ext: false };
}

/**
 * chars 로 시작하는 낱말 하나 고르기 (봇 · 힌트용)
 *  opt.stdOnly 표준어만 · opt.used 이미 나온 말(Set) · opt.common 흔한 말 먼저(기본) · opt.alive(w) 조건 (한방 피하기 등)
 */
function pick(chars, opt = {}) {
  const map = load(), rnd = opt.rnd || Math.random, used = opt.used || new Set();
  const basic = w => w && w.length >= 2 && w.length <= (opt.maxLen || 15) && !used.has(w);
  const ok = w => basic(w) && (!opt.alive || opt.alive(w));
  const groups = chars.map(c => map.get(c)).filter(Boolean);
  if (!groups.length) return null;
  if (opt.common !== false) {
    const pool = [];
    for (const g of groups) for (const w of g.common) if (basic(w)) pool.push(w);
    for (let t = 0; t < 40 && pool.length; t++) {     // 무작위로 몇 개 뽑아 보고 (alive 검사는 비싸서 전부 하지 않아요)
      const k = Math.floor(rnd() * pool.length), w = pool[k];
      if (!opt.alive || opt.alive(w)) return w;
      pool[k] = pool[pool.length - 1]; pool.pop();
    }
  }
  for (let t = 0; t < 80; t++) {
    const x = randomLine(groups[Math.floor(rnd() * groups.length)].s, rnd);
    if (x && !(x.ext && opt.stdOnly) && ok(x.w)) return x.w;
  }
  for (const g of groups) {                         // 마지막: 차례대로 훑기
    let a = 0;
    while (a < g.s.length - 1) {
      const b = g.s.indexOf('\n', a + 1); if (b < 0) break;
      const line = g.s.slice(a + 1, b), ext = line[0] === '!', w = /^[!*]/.test(line) ? line.slice(1) : line;
      if (!(ext && opt.stdOnly) && ok(w)) return w;
      a = b;
    }
  }
  return null;
}

/** 이럴 때 쓸 수 있었던 말 (흔한 말 먼저, 서로 다른 것 n개까지) */
function examples(chars, opt = {}, n = 3) {
  const out = [], used = new Set(opt.used || []);
  for (let i = 0; i < n; i++) {
    const w = pick(chars, { ...opt, used, maxLen: 6 }) || pick(chars, { ...opt, used, common: false, maxLen: 8 });
    if (!w) break;
    out.push(w); used.add(w);
  }
  return out;
}

module.exports = { load, lookup, allowed, canStart, pick, examples, count: () => (load(), { ...COUNT }) };
