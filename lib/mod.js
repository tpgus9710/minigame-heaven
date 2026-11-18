'use strict';
/**
 * 🛡️ 회원 관리 (v14.1) — 운영자(최고 운영자 · 운영자) 모두 쓸 수 있어요
 *
 *  - 기록 삭제: 회원의 싱글 게임 최고 기록 하나 또는 전부 (판 수 · 승리 수 · 경험치는 그대로).
 *    순위표에서 바로 지울 수도 있어요 (화면: public/js/board.js · public/js/mod.js)
 *  - 패널티
 *      경고        알림만 보내요
 *      기록 정지    그동안 새 최고 기록이 남지 않고, 그 사람은 순위표에서 빠져요
 *      이용 정지    로그인할 수 없어요 (접속 중이면 바로 로그아웃) · 순위표에서도 빠져요
 *    기간은 1 · 3 · 7 · 30일 또는 영구, 사유는 꼭 적어요. 기간 전에 풀 수도 있어요.
 *  - 운영자에게는 패널티를 줄 수 없어요 (운영자끼리 다투지 않게).
 *  - 하는 일은 모두 운영자 활동 기록에 남아요 (lib/admin.js note).
 *  - 당사자에게는 '운영자 알림'으로 보여 줘요 — 지금 접속 중이면 바로, 아니면 다음에 로그인할 때.
 *  - 저장은 계정 문서의 pen 칸 (lib/accounts.js normPen)
 */
const DAYS = new Set([1, 3, 7, 30, 0]);                      // 0 = 영구
const KIND_NAME = { warn: '경고', rec: '기록 정지', ban: '이용 정지' };
const DAY = 86400000;
const own = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
/** 글자 정리 (한 줄 · 제어 문자 · 반쪽 이모지 빼기) */
const clean = (s, n) => [...String(s ?? '').replace(/\p{Cs}/gu, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, n).join('').trim();

module.exports = function makeMod({ acc, adm }) {
  const A = acc._int;
  const lim = { act: A.limiter(40, 10000) };
  const isOp = u => !!u && (u.role === 'owner' || u.role === 'admin');

  /** 그 기록이 지금 몇 등인지 (정지 중인 사람은 빼고) */
  function rankOf(t, key) {
    const st = own(t.solo, key);
    if (!st || st.b == null) return 0;
    const low = A.LOW_BETTER.has(key.split(':')[0]), now = Date.now();
    let n = 1;
    for (const u of A.users.values()) {
      if (u === t || A.activePen(u.pen.ban, now) || A.activePen(u.pen.rec, now)) continue;
      const o = own(u.solo, key);
      if (o && o.b != null && (low ? o.b < st.b : o.b > st.b)) n++;
    }
    return n;
  }
  /** 운영자 화면에 보여 줄 회원 정보 */
  function view(t) {
    const recs = Object.entries(t.solo).filter(([, st]) => st && st.b != null)
      .map(([k, st]) => ({ k, b: st.b, p: st.p || 0, at: st.at || 0, rank: rankOf(t, k) }))
      .sort((a, b) => (a.rank - b.rank) || (b.at - a.at));
    const pv = p => { const a = A.activePen(p); return a ? { until: a.until, why: a.why, by: a.by, at: a.at } : null; };
    return { ...A.pub(t), role: t.role || '', on: A.online.has(t.id), seen: t.seen, created: t.created, plays: t.plays + t.sp,
      recs, pen: { ban: pv(t.pen.ban), rec: pv(t.pen.rec), msgs: t.pen.msgs.slice(0, 10) } };
  }
  /** 당사자에게 보여 줄 알림 (최근 10개) */
  function notify(t, kind, why, x) {
    t.pen.msgs.unshift({ at: Date.now(), kind, why: clean(why, 100), x: clean(x, 60) });
    if (t.pen.msgs.length > 10) t.pen.msgs.length = 10;
  }
  const until = days => (days ? Date.now() + days * DAY : 0);
  const span = days => (days ? `${days}일` : '영구');

  function attach(socket, on) {
    const reply = (cb, d) => { if (typeof cb === 'function') cb(d); };
    const who = cb => {
      if (!A.ready()) { reply(cb, { ok: false, why: 'loading' }); return null; }
      const u = socket.data.uid && A.users.get(socket.data.uid);
      if (!u) { reply(cb, { ok: false, why: 'login' }); return null; }
      if (!isOp(u)) { reply(cb, { ok: false, why: 'noperm' }); return null; }
      if (!lim.act(socket.id)) { reply(cb, { ok: false, why: 'limit' }); return null; }
      return u;
    };
    const target = (d, cb) => {
      const t = d && typeof d.uid === 'string' && A.users.get(d.uid);
      if (!t) reply(cb, { ok: false, why: 'nouser' });
      return t || null;
    };

    /** 회원 찾기 (이름 일부) — 빈칸이면 지금 패널티를 받고 있는 회원 */
    on('mod:find', (d, cb) => {
      const u = who(cb); if (!u) return;
      const q = clean(d && d.q, 10).toLowerCase(), now = Date.now();
      const all = [...A.users.values()];
      const hit = q ? all.filter(x => x.name.toLowerCase().includes(q))
        : all.filter(x => A.activePen(x.pen.ban, now) || A.activePen(x.pen.rec, now));
      const list = hit.sort((a, b) => (A.online.has(b.id) - A.online.has(a.id)) || b.seen - a.seen).slice(0, 20)
        .map(x => ({ ...A.pub(x), role: x.role || '', on: A.online.has(x.id), seen: x.seen, plays: x.plays + x.sp,
          ban: !!A.activePen(x.pen.ban, now), rec: !!A.activePen(x.pen.rec, now) }));
      reply(cb, { ok: true, list, pen: !q });
    });
    on('mod:user', (d, cb) => {
      const u = who(cb); if (!u) return;
      const t = target(d, cb); if (!t) return;
      reply(cb, { ok: true, u: view(t) });
    });

    /** 기록 삭제: { uid, k: 기록 키 | all: true, why?, label? (화면이 보낸 게임 이름 — 활동 기록용) } */
    on('mod:recDel', (d, cb) => {
      const u = who(cb); if (!u) return;
      const t = target(d, cb); if (!t) return;
      const why = clean(d.why, 100), label = clean(d.label, 30);
      const keys = d.all === true ? Object.keys(t.solo) : [String(d.k || '')];
      const done = [];
      for (const k of keys) {
        const st = own(t.solo, k);
        if (!st || typeof st !== 'object' || st.b == null) continue;
        done.push({ k, b: st.b });
        delete st.b; delete st.at;
      }
      if (!done.length) return reply(cb, { ok: false, why: 'norec' });
      const what = d.all === true ? `기록 ${done.length}개 전부` : `${label || done[0].k} 기록(${done[0].b})`;
      notify(t, 'recdel', why, d.all === true ? '모든 게임 기록' : `${label || done[0].k} 기록`);
      A.save(t);
      A.emitUser(t.id, 'acct:me', A.meView(t));
      adm.note(u, 'recdel', `${t.name} 님 ${what} 삭제${why ? ` · ${why}` : ''}`);
      reply(cb, { ok: true, n: done.length, u: view(t) });
    });

    /** 패널티: { uid, kind: warn | rec | ban, days: 1 · 3 · 7 · 30 · 0(영구), why } */
    on('mod:pen', (d, cb) => {
      const u = who(cb); if (!u) return;
      const t = target(d, cb); if (!t) return;
      if (isOp(t)) return reply(cb, { ok: false, why: 'opuser' });
      const kind = d && KIND_NAME[d.kind] ? d.kind : '';
      if (!kind) return reply(cb, { ok: false, why: 'bad' });
      const why = clean(d.why, 100);
      if (!why) return reply(cb, { ok: false, why: 'why' });
      const days = Number(d.days);
      if (kind !== 'warn' && !DAYS.has(days)) return reply(cb, { ok: false, why: 'days' });
      if (kind !== 'warn') t.pen[kind] = { until: until(days), why, by: u.name, at: Date.now() };
      notify(t, kind, why, kind === 'warn' ? '' : span(days));
      A.save(t);
      if (kind === 'ban') A.kick(t.id, { why: 'banned', ban: A.banView(t.pen.ban) });
      else A.emitUser(t.id, 'acct:me', A.meView(t));
      adm.note(u, 'pen', `${t.name} 님 ${KIND_NAME[kind]}${kind === 'warn' ? '' : ` (${span(days)})`} · ${why}`);
      reply(cb, { ok: true, u: view(t) });
    });
    /** 정지 풀기: { uid, kind: rec | ban } */
    on('mod:lift', (d, cb) => {
      const u = who(cb); if (!u) return;
      const t = target(d, cb); if (!t) return;
      const kind = d && (d.kind === 'rec' || d.kind === 'ban') ? d.kind : '';
      if (!kind || !A.activePen(t.pen[kind])) return reply(cb, { ok: false, why: 'nopen' });
      t.pen[kind] = null;
      notify(t, 'lift', '', `${KIND_NAME[kind]} 풀림`);
      A.save(t);
      A.emitUser(t.id, 'acct:me', A.meView(t));
      adm.note(u, 'lift', `${t.name} 님 ${KIND_NAME[kind]} 풀어 줌`);
      reply(cb, { ok: true, u: view(t) });
    });
  }
  return { attach, _test: { view, rankOf } };
};
