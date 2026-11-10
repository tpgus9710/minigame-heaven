'use strict';
/**
 * 🍱 학식 메뉴 — 한국폴리텍대학 로봇캠퍼스 식단 (https://www.kopo.ac.kr/robot/content.do?menu=9104)
 *
 *  학교 홈페이지 식단표를 서버가 읽어 두고(누가 볼 때만, 30분에 한 번까지), 지금 한국 시각에 맞는 끼니를 골라 줘요.
 *   - 평일 13시 전: 오늘 중식 · 18시 전: 오늘 석식 · 18시 뒤: 다음 날 중식 (금요일 저녁 · 주말 → 월요일 중식)
 *  홈페이지 표에는 날짜 없이 요일만 있어요 → 읽은 날이 속한 주(월~일)의 식단으로 쳐요. 다만
 *   - 평일에 읽은 표는 그 주의 '본 표'로 기억해요(계정 저장소의 '__meal' 문서 → 서버를 다시 켜도 그대로).
 *   - 표가 지난주에 본 것과 똑같으면 아직 이번 주 식단이 안 올라온 거예요 (월요일 아침 등).
 *   - 주말에 읽은 표가 이번 주에 본 것과 다르면 다음 주 식단이에요. 이번 주 것을 본 적이 없으면 어느 주인지 모른다고 해요.
 *  홈페이지를 못 읽으면 마지막으로 읽은 표를 쓰고, 그것도 없으면 화면에 홈페이지 링크만 보여 줘요.
 *  주소는 환경 변수 MEAL_URL 로 바꿀 수 있어요 (다른 캠퍼스 · 홈페이지 주소가 바뀌었을 때). MEAL_OFF=1 이면 꺼요.
 */
const https = require('https'), http = require('http'), tls = require('tls'), net = require('net'), crypto = require('crypto');

const URL_MEAL = process.env.MEAL_URL || 'https://www.kopo.ac.kr/robot/content.do?menu=9104';
const OFF = process.env.MEAL_OFF === '1';
const TTL = 30 * 60000, RETRY = 5 * 60000;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ───────── 한국 시각 (서머타임 없음) ───────── */
function kst(ms = Date.now()) {
  const d = new Date(ms + 9 * 3600e3);
  return { ms, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
}
const pad = n => String(n).padStart(2, '0');
const ymd = k => `${k.y}-${pad(k.m)}-${pad(k.d)}`;
const plus = (k, days) => kst(k.ms + days * 86400e3);
const mondayOf = k => plus(k, -((k.dow + 6) % 7));
const weekKey = k => ymd(mondayOf(k));

/* ───────── 홈페이지 읽기 ───────── */
// 학교 서버가 중간 인증서를 빼먹고 보내는 경우(국내 기관 사이트에서 흔해요): 브라우저처럼 인증서에 적힌 주소(AIA)에서
// 중간 인증서를 받아 와 다시 연결해요. 믿는 뿌리 인증서는 그대로라 검사는 끝까지 해요(검사를 끄지 않아요).
let ROOTS = tls.rootCertificates;
const EXTRA = [];                                                  // AIA 로 받아 둔 중간 인증서 (PEM)
const CHAIN_ERR = /UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT|unable to verify the first certificate|unable to get (local )?issuer/i;
function fetchRaw(url, { hops = 0, max = 4e6 } = {}) {
  return new Promise((resolve, reject) => {
    let req;
    try {
      const sec = url.startsWith('https:');
      req = (sec ? https : http).get(url, {
        timeout: 10000, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'ko-KR,ko;q=0.9' },
        ...(sec && EXTRA.length ? { ca: [...ROOTS, ...EXTRA] } : {}),
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 4) {
          res.resume();
          return resolve(fetchRaw(new URL(res.headers.location, url).href, { hops: hops + 1, max }));
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        const chunks = [];
        let n = 0;
        res.on('data', c => { n += c.length; if (n > max) req.destroy(new Error('너무 큰 파일')); else chunks.push(c); });
        res.on('end', () => resolve({ buf: Buffer.concat(chunks), type: String(res.headers['content-type'] || '') }));
      });
    } catch (e) { return reject(e); }
    req.on('timeout', () => req.destroy(new Error('시간 초과')));
    req.on('error', reject);
  });
}
async function get(url) {
  const { buf, type } = await fetchRaw(url);
  let cs = (/charset=["']?([\w-]+)/i.exec(type) || [])[1];
  if (!cs) cs = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 5000).toString('latin1')) || [])[1] || 'utf-8';
  try { return new TextDecoder(cs.toLowerCase()).decode(buf); } catch { return buf.toString('utf8'); }
}
/** 서버가 보낸 인증서만 읽어요 (요청은 보내지 않고 바로 끊어요) */
function peerCert(u) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host: u.hostname, port: +u.port || 443, ...(net.isIP(u.hostname) ? {} : { servername: u.hostname }), rejectUnauthorized: false }, () => {
      const c = s.getPeerCertificate(false); s.destroy(); resolve(c && c.raw ? c : null);
    });
    s.setTimeout(8000, () => s.destroy(new Error('시간 초과')));
    s.on('error', reject);
  });
}
const toPem = buf => (buf.toString('latin1').includes('-----BEGIN CERTIFICATE-----') ? buf.toString('latin1')
  : `-----BEGIN CERTIFICATE-----\n${buf.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`);
const issuersOf = x => [...String(x.infoAccess || '').matchAll(/CA Issuers - URI:(\S+)/g)].map(m => m[1]).filter(u => /^https?:\/\//.test(u));
/** 빠진 중간 인증서를 AIA 주소에서 받아 EXTRA 에 넣어요 (최대 2단계). 받은 게 있으면 true */
async function chase(url) {
  const c = await peerCert(new URL(url));
  if (!c) return false;
  let x = new crypto.X509Certificate(c.raw), got = false;
  for (let depth = 0; depth < 2; depth++) {
    const uri = issuersOf(x)[0];
    if (!uri || x.issuer === x.subject) break;
    const pem = toPem((await fetchRaw(uri, { max: 65536 })).buf);
    const y = new crypto.X509Certificate(pem);
    if (!y.ca || y.subject !== x.issuer) break;                    // 엉뚱한 파일이면 그만
    if (!EXTRA.includes(pem)) { EXTRA.push(pem); got = true; }
    x = y;
  }
  return got;
}
async function fetchHtml() {
  try { return await get(URL_MEAL); }
  catch (e) {
    const why = String(e.code || '') + ' ' + e.message;
    if (!URL_MEAL.startsWith('https:') || !/CERT|certificate|SSL|TLS|issuer/i.test(why)) throw e;
    if (CHAIN_ERR.test(why)) {
      try { if (await chase(URL_MEAL)) return await get(URL_MEAL); } catch { /* 아래 http 로 */ }
    }
    return get(URL_MEAL.replace(/^https:/, 'http:'));               // 그래도 안 되면 http 주소로 한 번 더
  }
}

/* ───────── 표 읽기 (칸 이름 · 클래스가 바뀌어도 '중식' · '월요일' 글자로 찾아요) ───────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', '#39': "'" };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; }
  return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m;
});
const cellText = h => decode(h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t\r\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n+/g, '\n').trim();
const rowsOf = t => (t.match(/<tr[\s>][\s\S]*?<\/tr>/gi) || [])
  .map(r => (r.match(/<t[hd][\s>][\s\S]*?<\/t[hd]>/gi) || []).map(c => cellText(c.replace(/^<t[hd][^>]*>/i, '').replace(/<\/t[hd]>$/i, ''))));
const itemsOf = s => String(s || '').split(/[,\n·ㆍ・/]+|\s{2,}/).map(x => x.trim()).filter(x => x && !/^[-–—*]+$/.test(x) && !/^(없음|미운영|운영\s*안\s*함)$/.test(x));
const flat = s => s.replace(/\s/g, '');

function parse(html) {
  const body = String(html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  let days = null, sched = null, bare = false;
  for (const t of body.match(/<table[\s>][\s\S]*?<\/table>/gi) || []) {
    const rs = rowsOf(t), txt = flat(rs.flat().join(' '));
    if (!days && txt.includes('중식') && txt.includes('월요일')) {
      const head = rs.find(r => r.some(c => flat(c).includes('중식'))) || [];
      const col = name => head.findIndex(c => flat(c).includes(name));
      const cL = col('중식'), cD = col('석식');
      const out = {};
      for (const r of rs) {
        const m = /^([월화수목금토일])요일/.exec(flat(r[0] || ''));
        if (!m) continue;
        const dm = /(\d{1,2})\s*[./월-]\s*(\d{1,2})/.exec(r[0]);          // 요일 칸에 날짜가 있으면 (예: 월요일 11.10)
        out[m[1]] = { lunch: cL > 0 ? itemsOf(r[cL]) : [], dinner: cD > 0 ? itemsOf(r[cD]) : [], md: dm ? [+dm[1], +dm[2]] : null };
      }
      if (Object.keys(out).length >= 5) days = out;
    } else if (!days && txt.includes('중식') && txt.includes('석식')) {
      bare = true;                                                   // 식단 표 틀만 있고 요일 줄이 없어요 (아직 안 올림)
    } else if (!sched && txt.includes('점심') && txt.includes('저녁')) {
      const hi = rs.findIndex(r => r.some(c => flat(c).includes('점심')));
      const h = rs[hi] || [], v = rs[hi + 1] || [];
      const at = name => { const i = h.findIndex(c => flat(c).includes(name)); return i >= 0 && v[i] ? v[i].replace(/\s+/g, ' ').trim() : ''; };
      sched = { lunch: at('점심'), dinner: at('저녁') };
    }
  }
  if (!days && bare) days = {};
  return days ? { days, sched } : null;
}
/** 표가 있어도 칸이 모두 비었으면 아직 안 올라온 거예요 */
function emptyWeek(days) {
  return !days || ['월', '화', '수', '목', '금'].every(d => !days[d] || (!days[d].lunch.length && !days[d].dinner.length));
}
const hashOf = days => crypto.createHash('sha1').update(JSON.stringify(['월', '화', '수', '목', '금', '토', '일'].map(d => days[d] ? [days[d].lunch, days[d].dinner] : null))).digest('hex').slice(0, 16);

/* ───────── 어느 주의 표인가요? ───────── */
/** 요일 칸의 날짜(있으면) → 그 주 월요일 */
function weekFromDates(days, now) {
  for (const [i, d] of ['월', '화', '수', '목', '금', '토', '일'].entries()) {
    const md = days[d] && days[d].md;
    if (!md || md[0] < 1 || md[0] > 12 || md[1] < 1 || md[1] > 31) continue;
    let best = null;
    for (const y of [now.y - 1, now.y, now.y + 1]) {                 // 해가 바뀌는 때를 생각해 가장 가까운 해
      const ms = Date.UTC(y, md[0] - 1, md[1]) - 9 * 3600e3 + 12 * 3600e3;
      if (!best || Math.abs(ms - now.ms) < Math.abs(best - now.ms)) best = ms;
    }
    return ymd(plus(kst(best), -i));
  }
  return null;
}
/** base: { 월요일날짜: 그 주 평일에 본 표 해시 } */
function weekOf(p, hash, now, base) {
  const byDate = weekFromDates(p.days, now);
  if (byDate) return { week: byDate, how: 'date' };
  const thisW = weekKey(now);
  for (const [w, h] of Object.entries(base)) if (h === hash && w !== thisW) return { week: w, how: 'same-as-' + w };   // 예전 주에 본 표 그대로
  if (now.dow >= 1 && now.dow <= 5) return { week: thisW, how: 'weekday' };
  if (base[thisW] && base[thisW] !== hash) return { week: ymd(plus(mondayOf(now), 7)), how: 'weekend-new' };
  if (base[thisW] === hash) return { week: thisW, how: 'weekend-same' };
  return { week: null, how: 'weekend-unknown' };
}

/* ───────── 지금 보여 줄 끼니 ───────── */
function pick(now, data) {
  const hm = now.h * 60 + now.min, wd = now.dow >= 1 && now.dow <= 5;
  let t = now, kind = 'lunch';
  if (wd && hm < 13 * 60) kind = 'lunch';
  else if (wd && hm < 18 * 60) kind = 'dinner';
  else { t = plus(now, 1); while (t.dow === 0 || t.dow === 6) t = plus(t, 1); }   // 다음 날 중식 (주말은 건너뛰고 월요일)
  const same = ymd(t) === ymd(now), tomorrow = ymd(t) === ymd(plus(now, 1));
  const label = `${same ? '오늘' : tomorrow ? '내일' : DOW[t.dow] + '요일'} ${kind === 'lunch' ? '중식' : '석식'}`;
  const base = { kind, label, date: ymd(t), dow: DOW[t.dow], time: data && data.sched ? data.sched[kind] || '' : '' };
  if (!data) return { ...base, items: [], why: '식단을 아직 못 불러왔어요' };
  if (emptyWeek(data.days)) return { ...base, items: [], why: '식단이 아직 학교 홈페이지에 안 올라왔어요' };
  if (!data.week) return { ...base, items: [], why: '학교 홈페이지 식단이 어느 주 것인지 아직 몰라요 (월요일에 다시 확인해요)' };
  const tw = weekKey(t);
  if (data.week < tw) return { ...base, items: [], why: tw === weekKey(now) ? '이번 주 식단이 아직 학교 홈페이지에 안 올라왔어요' : '다음 주 식단이 아직 학교 홈페이지에 안 올라왔어요' };
  if (data.week > tw) return { ...base, items: [], why: '홈페이지에는 벌써 다음 주 식단이 올라와 있어요' };
  const d = data.days[DOW[t.dow]];
  const items = d ? d[kind] : [];
  return { ...base, items, why: items.length ? '' : '이날은 식단이 없어요 (휴일이거나 운영하지 않는 날이에요)' };
}

module.exports = function makeMeal({ ACC = null, log = console.log } = {}) {
  const S = { data: null, at: 0, tryAt: 0, err: '', busy: null, base: {} };
  const SYS = '__meal';
  const loadSys = () => {                                          // 서버를 다시 켜도: 주마다 본 표 · 마지막으로 읽은 표
    const A = ACC && ACC._int;
    const d = A && A.sysGet ? A.sysGet(SYS) : null;
    if (!d) return;
    if (d.base && typeof d.base === 'object') S.base = { ...d.base, ...S.base };
    if (!S.data && d.last && d.last.data && d.last.data.days) { S.data = d.last.data; S.at = +d.last.at || 0; }
  };
  const saveSys = () => {
    const A = ACC && ACC._int;
    if (!A || !A.sysPut) return;
    const keep = Object.keys(S.base).sort().slice(-8);              // 최근 8주만
    S.base = Object.fromEntries(keep.map(k => [k, S.base[k]]));
    A.sysPut({ id: SYS, sys: 1, base: S.base, last: S.data ? { data: S.data, at: S.at } : null });
  };
  if (ACC && ACC._int && ACC._int.onReady) ACC._int.onReady(() => { try { loadSys(); } catch (e) { log('🍱 저장해 둔 식단을 못 읽었어요:', e.message); } });

  function refresh(nowMs = Date.now()) {
    if (S.busy) return S.busy;
    S.tryAt = Date.now();
    S.busy = (async () => {
      try {
        const p = parse(await fetchHtml());
        if (!p) throw new Error('식단 표를 찾지 못했어요 (홈페이지 모양이 바뀌었을 수 있어요)');
        const now = kst(nowMs), hash = hashOf(p.days);
        const w = weekOf(p, hash, now, S.base);
        if ((w.how === 'weekday' || w.how === 'date') && !emptyWeek(p.days)) { if (w.week === weekKey(now)) S.base[w.week] = hash; }
        S.data = { ...p, week: w.week, how: w.how, hash };
        S.at = Date.now(); S.err = '';
        saveSys();
      } catch (e) {
        S.err = e.message || String(e);
        log('🍱 학식을 못 읽었어요:', S.err);
      } finally { S.busy = null; }
    })();
    return S.busy;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

  /** 화면에 줄 것: 지금 끼니 + 이번 주 표 */
  async function view(nowMs = Date.now()) {
    if (OFF) return { ok: false, off: true };
    const now = kst(nowMs);
    const age = Date.now() - S.at, stale = !S.data || age > TTL;
    const canTry = Date.now() - S.tryAt > (S.err ? RETRY : 15000);
    const oldWeek = S.data && S.data.week && S.data.week < weekKey(now) && age > 5 * 60000;
    if ((!S.data || oldWeek) && canTry) await withTimeout(refresh(nowMs), 9000);   // 처음이거나 주가 바뀌었으면 기다려요
    else if (stale && canTry) refresh(nowMs);                                       // 아니면 있던 것을 주고 뒤에서 새로
    const data = S.data;
    const p = pick(now, data);
    const week = data && !emptyWeek(data.days) ? ['월', '화', '수', '목', '금'].map((dw, i) => ({
      dow: dw, date: data.week ? ymd(plus(kst(Date.parse(data.week + 'T12:00:00+09:00')), i)) : null,
      lunch: (data.days[dw] || {}).lunch || [], dinner: (data.days[dw] || {}).dinner || [],
    })) : [];
    return {
      ok: !!data, url: URL_MEAL, today: ymd(now), now: `${pad(now.h)}:${pad(now.min)}`,
      pick: p, slot: `${p.date}:${p.kind}`, week, weekOf: data ? data.week : null,
      sched: data ? data.sched : null, at: S.at || 0, err: data ? '' : S.err || '불러오는 중',
    };
  }
  setTimeout(() => { if (!OFF) refresh(); }, 8000).unref();       // 켜고 조금 뒤 한 번 미리 읽어 둬요

  return { view, refresh, _test: { parse, pick, weekOf, kst, hashOf, S } };
};
Object.assign(module.exports, { parse, pick, weekOf, kst, hashOf, ymd, emptyWeek, _tls: { setRoots: r => { ROOTS = r; }, EXTRA, chase, fetchHtml: () => fetchHtml() } });
