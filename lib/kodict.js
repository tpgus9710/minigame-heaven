'use strict';
/**
 * 📖 우리말 사전 (끝말잇기 판정용) — data/kodict/words.txt.gz
 *  국립국어원 《표준국어대사전》 · 《우리말샘》의 표제어 전부(품사 상관없이, 두 글자 이상) + 원소 이름.
 *  자료 출처와 이용 조건(CC BY-SA)은 data/kodict/NOTICE.md 에 있어요.
 *
 *  줄 형식: [!|^][*]낱말
 *    (표시 없음) 표준어 명사 · ! 명사지만 표준어 뜻이 없는 말(방언 · 옛말 · 북한어)
 *    ^ 명사가 아닌 말(부사 · 동사 · 형용사 · 감탄사 · 관형사 · 어근 …) · * 흔한 말(봇 · 힌트가 먼저 써요)
 *  사전 범위(mode): 'all' 모든 낱말 · 'wide' 명사만 · 'std' 표준어 명사만
 *
 *  낱말이 가나다순이라 첫 글자가 같은 줄은 붙어 있어요. 처음 쓸 때 한 번만 풀어서(0.5초쯤)
 *  첫 글자별로 글자열 조각만 잘라 들고 있어요 (낱말마다 객체를 만들지 않아 메모리가 적어요).
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const FILE = path.join(__dirname, '..', 'data', 'kodict', 'words.txt.gz');
const MODES = ['all', 'wide', 'std'];
let G = null;                       // 첫 글자 → { s: "\n낱말\n!낱말\n^낱말\n*낱말\n", n: { std, ext, other }, common[] }
const COUNT = { std: 0, ext: 0, other: 0, common: 0 };

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
    const kind = text[i] === '!' ? 'ext' : text[i] === '^' ? 'other' : 'std';
    if (kind !== 'std') i++;
    const star = text[i] === '*';
    if (star) i++;
    if (next - i >= 2) {
      const c = text[i];
      if (c !== gc) { close(pos); gc = c; gs = pos; g = { s: '', n: { std: 0, ext: 0, other: 0 }, common: [] }; }
      g.n[kind]++; COUNT[kind]++;
      if (star && kind === 'std') { g.common.push(text.slice(i, next)); COUNT.common++; }
    }
    pos = next;
  }
  close(pos);
  console.log(`📖 사전 준비: ${(COUNT.std + COUNT.ext + COUNT.other).toLocaleString()}낱말 (명사 ${(COUNT.std + COUNT.ext).toLocaleString()}) · ${Date.now() - t0}ms`);
  return G;
}

/** 사전에 있으면 'std'(표준어 명사) · 'ext'(방언 · 옛말 · 북한어 명사) · 'other'(명사가 아닌 말), 없으면 null */
function lookup(word) {
  const w = String(word || '');
  if (w.length < 2 || !/^[가-힣]+$/.test(w)) return null;
  const g = load().get(w[0]);
  if (!g) return null;
  const s = g.s;
  if (s.includes('\n' + w + '\n') || s.includes('\n*' + w + '\n')) return 'std';
  if (s.includes('\n!' + w + '\n')) return 'ext';
  if (s.includes('\n^' + w + '\n')) return 'other';
  return null;
}
/** 그 사전 범위에서 받는 말인가요? (예전처럼 true/false 를 주면 true = 표준어 명사만 · false = 명사만) */
const modeOf = m => (m === true ? 'std' : m === false || m == null ? 'wide' : MODES.includes(m) ? m : 'all');
function allowed(kind, mode) {
  if (!kind) return false;
  const m = modeOf(mode);
  return m === 'all' || kind === 'std' || (kind === 'ext' && m === 'wide');
}
const total = (n, m) => n.std + (m !== 'std' ? n.ext : 0) + (m === 'all' ? n.other : 0);

/** 그 글자로 시작하는, 아직 안 쓴 낱말이 있나요? (없으면 한방 단어) */
function canStart(chars, used, mode) {
  const map = load(), m = modeOf(mode);
  for (const c of chars) {
    const g = map.get(c);
    if (!g) continue;
    const n = total(g.n, m);
    if (!n) continue;
    let usedHere = 0;
    for (const u of used || []) if (u[0] === c && allowed(lookup(u), m)) usedHere++;
    if (n > usedHere) return true;
  }
  return false;
}

/** 조각 s 의 아무 곳 → 그다음 줄 낱말 { w, kind } */
function parseLine(line) {
  const kind = line[0] === '!' ? 'ext' : line[0] === '^' ? 'other' : 'std';
  let w = kind === 'std' ? line : line.slice(1);
  if (w[0] === '*') w = w.slice(1);
  return { w, kind };
}
function randomLine(s, rnd) {
  if (s.length < 4) return null;
  let a = s.indexOf('\n', Math.floor(rnd() * (s.length - 1)));
  if (a < 0 || a >= s.length - 1) a = 0;
  const b = s.indexOf('\n', a + 1);
  if (b <= a + 1) return null;
  return parseLine(s.slice(a + 1, b));
}

/**
 * chars 로 시작하는 낱말 하나 고르기 (봇 · 힌트용) — '모든 낱말'이어도 명사를 먼저 골라요
 *  opt.mode 사전 범위 · opt.used 이미 나온 말(Set) · opt.common 흔한 말 먼저(기본) · opt.alive(w) 조건 (한방 피하기 등)
 *  (예전 opt.stdOnly 도 받아요)
 */
function pick(chars, opt = {}) {
  const map = load(), rnd = opt.rnd || Math.random, used = opt.used || new Set();
  const m = opt.mode ? modeOf(opt.mode) : opt.stdOnly ? 'std' : 'wide';
  const basic = w => w && w.length >= 2 && w.length <= (opt.maxLen || 20) && !used.has(w);
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
  const nounOk = x => x && x.kind !== 'other' && allowed(x.kind, m) && ok(x.w);
  const anyOk = x => x && allowed(x.kind, m) && ok(x.w);
  const scan = want => {                             // 차례대로 훑기
    for (const g of groups) {
      let a = 0;
      while (a < g.s.length - 1) {
        const b = g.s.indexOf('\n', a + 1); if (b < 0) break;
        const x = parseLine(g.s.slice(a + 1, b));
        if (want(x)) return x.w;
        a = b;
      }
    }
    return null;
  };
  for (let t = 0; t < 80; t++) {                    // 명사 먼저 (무작위 → 훑기)
    const x = randomLine(groups[Math.floor(rnd() * groups.length)].s, rnd);
    if (nounOk(x)) return x.w;
  }
  const noun = scan(nounOk);
  if (noun || m !== 'all') return noun;
  for (let t = 0; t < 40; t++) {                    // 명사가 정말 없으면 다른 품사 ('모든 낱말'일 때만)
    const x = randomLine(groups[Math.floor(rnd() * groups.length)].s, rnd);
    if (anyOk(x)) return x.w;
  }
  return scan(anyOk);
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

/** 사전 범위마다 낱말 수 */
function count() {
  load();
  return { ...COUNT, all: COUNT.std + COUNT.ext + COUNT.other, wide: COUNT.std + COUNT.ext, std: COUNT.std };
}

module.exports = { load, lookup, allowed, canStart, pick, examples, count, MODES };
