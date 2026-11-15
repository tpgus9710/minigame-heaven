/* =====================================================================
 *  ⏳ 키즈 모드 계산 (v13.8) — 서버 lib/kid.js · 화면 js/kid.js 가 같이 써요
 *   · 하루는 한국 시간 0시에 바뀌어요. 토 · 일은 주말이에요.
 *   · 설정 k: { on, wd: 평일 하루 분, we: 주말 하루 분 (0 = 제한 없음), from · to: 'HH:MM' 할 수 있는 시간대 ('' = 언제든) }
 *     시간대는 자정을 넘겨도 돼요 (예: 20:00 ~ 01:00).
 *   · 오늘 쓴 것: { d: 날짜, s: 게임한 초, b: 오늘만 더 준 분, stop: 오늘은 그만(잠금) } — 날짜가 바뀌면 h(지난 14일)로 옮겨요
 *   · state(k, now): 지금 잠겼는지(why: '' · 'stop' 오늘은 그만 · 'time' 시간을 다 씀 · 'win' 시간대가 아님) · 남은 시간 · 다시 열리기까지
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KidCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KST = 9 * 3600000, DAY = 86400000;
  const MAX_MIN = 720, MAX_BONUS = 720, KEEP_DAYS = 14, MAX_DEVS = 5;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DAY_RE = /^\d{4}-\d\d-\d\d$/;

  /** 한국 날짜 '2026-11-15' */
  const dayKey = (t = Date.now()) => new Date(t + KST).toISOString().slice(0, 10);
  /** 한국 시간 0시부터 지난 ms */
  const msOfDay = t => (((t + KST) % DAY) + DAY) % DAY;
  /** 토 · 일 (한국 날짜 기준) */
  const isWeekend = t => { const w = new Date(t + KST).getUTCDay(); return w === 0 || w === 6; };
  /** 'HH:MM' → 0시부터 몇 분 (틀린 값은 -1) */
  const parseHM = s => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s ?? '')); return m ? +m[1] * 60 + +m[2] : -1; };

  /** 저장된 값 다듬기 (모르는 값 · 이상한 값은 버려요) */
  function normalize(v) {
    const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    const mins = x => { const n = Math.round(+x); return Number.isFinite(n) && n > 0 ? Math.min(MAX_MIN, n) : 0; };
    let from = parseHM(o.from) >= 0 ? String(o.from) : '', to = parseHM(o.to) >= 0 ? String(o.to) : '';
    if (!from || !to || from === to) { from = ''; to = ''; }
    const d = typeof o.d === 'string' && DAY_RE.test(o.d) ? o.d : '';
    return {
      on: o.on === true, wd: mins(o.wd), we: mins(o.we), from, to,
      by: typeof o.by === 'string' ? o.by.slice(0, 20) : '', at: Math.max(0, +o.at || 0),
      d, s: d ? clamp(Math.floor(+o.s || 0), 0, 86400) : 0, b: d ? clamp(Math.round(+o.b || 0), 0, MAX_BONUS) : 0, stop: !!d && o.stop === true,
      h: (Array.isArray(o.h) ? o.h : []).filter(x => Array.isArray(x) && typeof x[0] === 'string' && DAY_RE.test(x[0]) && Number.isFinite(+x[1]))
        .slice(0, KEEP_DAYS).map(x => [x[0], clamp(Math.floor(+x[1]), 0, 86400)]),
      devs: (Array.isArray(o.devs) ? o.devs : []).filter(x => x && typeof x.h === 'string' && /^[0-9a-f]{64}$/.test(x.h))
        .slice(-MAX_DEVS).map(x => ({ h: x.h, at: Math.max(0, +x.at || 0), last: Math.max(0, +x.last || 0) })),
    };
  }

  /** 날짜가 바뀌었으면 지난날 게임한 시간을 기록(h)으로 옮기고 오늘을 새로 시작해요 (바뀌었으면 true) */
  function roll(k, now = Date.now()) {
    const today = dayKey(now);
    if (k.d === today) return false;
    if (k.d && k.s > 0) { k.h = [[k.d, k.s], ...k.h.filter(x => x[0] !== k.d)].slice(0, KEEP_DAYS); }
    k.d = today; k.s = 0; k.b = 0; k.stop = false;
    return true;
  }

  /** 오늘(평일 · 주말)의 하루 시간 (분, 0 = 제한 없음) */
  const limitMin = (k, now = Date.now()) => (isWeekend(now) ? k.we : k.wd);

  /** 할 수 있는 시간대: { inWin, closes: 끝나기까지 ms (-1 = 끝 없음), opens: 열리기까지 ms } */
  function windowAt(k, now = Date.now()) {
    if (!k.from || !k.to) return { inWin: true, closes: -1, opens: 0 };
    const f = parseHM(k.from) * 60000, t = parseHM(k.to) * 60000, m = msOfDay(now);
    if (f < t) {
      if (m >= f && m < t) return { inWin: true, closes: t - m, opens: 0 };
      return { inWin: false, closes: -1, opens: m < f ? f - m : DAY - m + f };
    }
    if (m >= f) return { inWin: true, closes: DAY - m + t, opens: 0 };      // 자정을 넘기는 시간대 (예: 20:00 ~ 01:00)
    if (m < t) return { inWin: true, closes: t - m, opens: 0 };
    return { inWin: false, closes: -1, opens: f - m };
  }

  /** 오늘이 끝난 뒤(내일 0시) 처음 할 수 있게 되기까지 ms */
  function nextDay(k, now = Date.now()) {
    const mid = DAY - msOfDay(now);
    const w = windowAt(k, now + mid);
    return mid + (w.inWin ? 0 : w.opens);
  }

  /** 지금 상태 — 날짜가 바뀌었는데 roll 을 안 했어도 오늘 기준으로 계산해요
   *  { on, why, lim: 오늘 할 수 있는 초(0 = 제한 없음), used, bonus(분), left: 남은 초(-1 = 제한 없음 · 잠기면 0),
   *    tleft: 하루 시간만 본 남은 초(-1 = 제한 없음), closes: 시간대가 끝나기까지 ms(-1 = 없음), next: 다시 열리기까지 ms(0 = 열려 있음),
   *    wk: 주말인지, wd · we · from · to: 설정 } */
  function state(k, now = Date.now()) {
    if (!k || !k.on) return { on: false };
    const same = k.d === dayKey(now);
    const used = same ? k.s : 0, bonus = same ? k.b : 0, stop = same && k.stop;
    const lm = limitMin(k, now), lim = lm ? (lm + bonus) * 60 : 0;
    const w = windowAt(k, now);
    const tleft = lim ? Math.max(0, lim - used) : -1;
    const why = stop ? 'stop' : lim && used >= lim ? 'time' : !w.inWin ? 'win' : '';
    let left = tleft;
    if (!why && w.closes >= 0) { const c = Math.ceil(w.closes / 1000); left = left < 0 ? c : Math.min(left, c); }
    return {
      on: true, why, lim, used, bonus, left: why ? 0 : left, tleft, closes: w.inWin ? w.closes : -1,
      next: why === 'win' ? w.opens : why ? nextDay(k, now) : 0,
      wk: isWeekend(now), wd: k.wd, we: k.we, from: k.from, to: k.to,
    };
  }

  /* ── 글자로 ── */
  /** 분 → '1시간 30분' · '45분' (0 = '제한 없음') */
  const fmtMin = m => (!m ? '제한 없음' : m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`);
  /** 초 → '1시간 5분' · '42분' · '4:59'(5분 아래) */
  function fmtLeft(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec >= 3600) return `${Math.floor(sec / 3600)}시간${Math.floor(sec % 3600 / 60) ? ` ${Math.floor(sec % 3600 / 60)}분` : ''}`;
    if (sec >= 300) return `${Math.ceil(sec / 60)}분`;
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  /** 쓴 시간 (초 → '1시간 5분' · '12분' · '0분') */
  const fmtUsed = sec => fmtMin(Math.floor(Math.max(0, sec) / 60)).replace('제한 없음', '0분');
  /** 하루 시간 설명: '하루 1시간' · '평일 1시간 · 주말 2시간' · '시간 제한 없음' */
  const limText = k => (k.wd === k.we ? (k.wd ? `하루 ${fmtMin(k.wd)}` : '시간 제한 없음') : `평일 ${fmtMin(k.wd)} · 주말 ${fmtMin(k.we)}`);
  /** 시간대 설명: '18:00 ~ 21:00' · '언제든' */
  const winText = k => (k.from && k.to ? `${k.from} ~ ${k.to}` : '언제든');
  /** 규칙 한 줄: '하루 1시간' · '평일 1시간 · 주말 2시간 · 18:00 ~ 21:00' (시간대가 없으면 빼요) */
  const ruleText = k => (k.from && k.to ? `${limText(k)} · ${winText(k)}` : limText(k));
  /** 그래프용 짧은 글자: '45분' · '1.5시간' · '2시간' */
  const fmtShort = m => (m < 60 ? `${m}분` : `${+(m / 60).toFixed(1)}시간`);
  /** 지금부터 ms 뒤가 언제인지: '오늘 18:00' · '내일 00:00' · '11/18 18:00' (한국 시간) */
  function whenText(ms, now = Date.now()) {
    const t = now + Math.max(0, ms), d = new Date(t + KST);
    const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const days = Math.round((Date.parse(dayKey(t) + 'T00:00:00Z') - Date.parse(dayKey(now) + 'T00:00:00Z')) / DAY);
    return days === 0 ? `오늘 ${hm}` : days === 1 ? `내일 ${hm}` : `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hm}`;
  }

  return { KST, DAY, MAX_MIN, MAX_BONUS, MAX_DEVS, dayKey, msOfDay, isWeekend, parseHM, normalize, roll, limitMin, windowAt, nextDay, state,
    fmtMin, fmtLeft, fmtUsed, fmtShort, limText, winText, ruleText, whenText };
});
