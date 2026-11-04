'use strict';
/**
 * 버그 · 불편 신고함
 *
 *  - 누구나(손님도) 화면 위쪽 [신고] 버튼으로 운영자에게 비공개 글을 보낼 수 있어요.
 *    글은 운영자만 볼 수 있고, 다른 사람에게는 절대 보내지 않아요.
 *  - 신고한 사람은 [내 신고]에서 처리 상태와 운영자 답장을 볼 수 있어요
 *    (로그인했으면 계정으로 어디서든, 손님이면 신고한 기기에 보관한 영수증으로).
 *  - 운영자: 내 정보 → 운영 → 신고함에서 확인 · 처리 완료 · 답장 · 삭제.
 *    새 신고가 오면 접속 중인 운영자에게 바로 알려요.
 *  - 계정 저장소의 '__rep' 문서에 최근 300개까지 저장돼요 (서버를 다시 켜도 그대로).
 */
const crypto = require('crypto');

const KINDS = { bug: '버그', ux: '불편해요', idea: '제안', etc: '기타' };
const STS = new Set(['new', 'seen', 'done']);
const KEEP = 300, MIN_LEN = 5, MAX_LEN = 1000, REPLY_LEN = 500, DUP_MS = 10 * 60000;
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const SALT = crypto.randomBytes(16);                  // 손님 구별용 (같은 글 도배 막기) — 서버를 다시 켜면 바뀌어요, IP 는 저장하지 않아요
const tag = ip => crypto.createHmac('sha256', SALT).update(String(ip)).digest('hex').slice(0, 12);
/** 글자 정리: 줄바꿈(lines)만 남기고 제어 문자 · 반쪽 이모지는 빼요 */
const clean = (s, n, lines) => {
  let t = String(s ?? '').replace(/\p{Cs}/gu, '').replace(/\r\n?/g, '\n');
  t = lines ? t.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n') : t.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ');
  return [...t.trim()].slice(0, n).join('').trim();
};
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };

module.exports = function makeReports({ io, rooms, acc, limiter }) {
  const A = acc._int;                                // 계정 쪽 도구 (users · online · pub · emitUser · sysGet · sysPut)
  const rep = { id: '__rep', sys: 1, list: [] };     // 새 신고가 앞
  let seq = 0;
  const lim = {
    sock: limiter(3, 600000), user: limiter(6, 3600000), ip: limiter(8, 3600000), all: limiter(150, 3600000),   // 도배 방지
    mine: limiter(20, 60000), act: limiter(40, 10000),
  };
  A.onReady(() => {
    const d = A.sysGet('__rep');
    if (d && Array.isArray(d.list)) rep.list = d.list.filter(r => r && typeof r.id === 'string' && typeof r.text === 'string' && STS.has(r.st)).slice(0, KEEP);
  });
  const save = () => A.sysPut(rep);
  const isOp = u => !!u && (u.role === 'owner' || u.role === 'admin');
  const counts = () => { const c = { new: 0, seen: 0, done: 0, all: rep.list.length }; for (const r of rep.list) c[r.st]++; return c; };
  /** 접속 중인 운영자 모두에게 */
  function toOps(ev, d) {
    for (const [uid, set] of A.online) if (isOp(A.users.get(uid))) for (const s of set) s.emit(ev, d);
  }
  /** 운영자에게 보여 줄 신고 (전부) · 신고한 사람에게 보여 줄 신고 (운영자 이름 · 기기 정보는 빼요) */
  const opView = r => ({ id: r.id, at: r.at, kind: r.kind, text: r.text, st: r.st, from: { uid: r.from.uid, name: r.from.name, lv: r.from.lv || 0, guest: !!r.from.guest }, ctx: r.ctx, by: r.by || null, reply: r.reply || null, read: !!r.read });
  const myView = r => ({ id: r.id, at: r.at, kind: r.kind, text: r.text, st: r.st, reply: r.reply ? { text: r.reply.text, at: r.reply.at } : null, read: !!r.read });
  /** 너무 많으면: 처리 끝난 오래된 것부터, 그래도 많으면 가장 오래된 것부터 */
  function trim() {
    while (rep.list.length > KEEP) {
      let i = -1;
      for (let k = rep.list.length - 1; k >= 0; k--) if (rep.list[k].st === 'done') { i = k; break; }
      rep.list.splice(i >= 0 ? i : rep.list.length - 1, 1);
    }
  }
  /** 신고할 때 같이 보낸 화면 정보 (게임 · 기기 · 화면 크기). 방 정보는 서버가 알고 있는 것으로 */
  function ctxOf(c, socket) {
    c = c && typeof c === 'object' ? c : {};
    const room = rooms.get(socket.data.code);
    if (c.off) return { off: 1, ua: clean(socket.handshake.headers['user-agent'], 160) };   // 화면 정보 안 보내기를 골랐어요 (기기 종류만)
    return {
      scr: clean(c.scr, 24), game: clean(room ? room.gameType : c.game, 24), name: clean(c.name, 24), solo: !!c.solo,
      room: room ? room.code : '', playing: !!(room && room.isStarted), n: room ? room.players.length : 0,
      w: int(c.w, 0, 10000), h: int(c.h, 0, 10000), dpr: Math.round(Number(c.dpr) * 10) / 10 || 0, touch: !!c.touch,
      ver: clean(c.ver, 16), lag: int(c.lag, 0, 99999), ua: clean(socket.handshake.headers['user-agent'], 160),
    };
  }

  function attach(socket, on) {
    const reply = (cb, d) => { if (typeof cb === 'function') cb(d); };
    const ip = () => A.ipOf(socket);
    const me = () => socket.data.uid && A.users.get(socket.data.uid);
    /** 운영자 확인 */
    const op = cb => {
      if (!A.ready()) { reply(cb, { ok: false, why: 'loading' }); return null; }
      const u = me();
      if (!u) { reply(cb, { ok: false, why: 'login' }); return null; }
      if (!isOp(u)) { reply(cb, { ok: false, why: 'noperm' }); return null; }
      if (!lim.act(socket.id)) { reply(cb, { ok: false, why: 'limit' }); return null; }
      return u;
    };
    const find = d => d && typeof d.id === 'string' && rep.list.find(r => r.id === d.id);

    /** 신고 보내기 (손님도 돼요) */
    on('report:send', (d, cb) => {
      if (!A.ready()) return reply(cb, { ok: false, why: 'loading' });
      if (!d || typeof d !== 'object') return reply(cb, { ok: false, why: 'bad' });
      const kind = KINDS[d.kind] ? d.kind : 'etc';
      const text = clean(d.text, MAX_LEN, true);
      if ([...text.replace(/\s/g, '')].length < MIN_LEN) return reply(cb, { ok: false, why: 'rpshort' });
      const u = me(), now = Date.now();
      const who = u ? { uid: u.id } : { ip: tag(ip()) };
      if (rep.list.some(r => now - r.at < DUP_MS && r.text === text && (u ? r.from.uid === u.id : r.from.ip === who.ip))) return reply(cb, { ok: false, why: 'rpsame' });
      if (!lim.sock(socket.id) || !lim.ip(ip()) || (u && !lim.user(u.id)) || !lim.all('all')) return reply(cb, { ok: false, why: 'limit' });
      const tk = crypto.randomBytes(9).toString('hex');            // 손님이 나중에 '내 신고'를 볼 때 쓰는 영수증
      const p = u ? A.pub(u) : null;
      const r = {
        id: 'r' + now.toString(36) + (++seq % 1296).toString(36), at: now, kind, text, st: 'new',
        from: u ? { uid: u.id, name: u.name, lv: p.lv || 0 } : { uid: null, name: clean(d.name, 12) || '손님', guest: 1, ip: who.ip },
        ctx: ctxOf(d.ctx, socket), th: sha(tk),
      };
      rep.list.unshift(r);
      trim();
      save();
      toOps('admin:report', { r: opView(r), counts: counts() });
      reply(cb, { ok: true, id: r.id, tk, at: now });
    });
    /** 내 신고 (로그인: 내 계정으로 보낸 것 · 손님: 이 기기에 보관한 영수증) */
    on('report:mine', (d, cb) => {
      if (!A.ready()) return reply(cb, { ok: false, why: 'loading' });
      if (!lim.mine(socket.id)) return reply(cb, { ok: false, why: 'limit' });
      const u = me();
      const want = new Map((Array.isArray(d && d.tks) ? d.tks.slice(0, 30) : [])
        .filter(t => t && typeof t.id === 'string' && typeof t.tk === 'string' && t.tk.length < 64).map(t => [t.id, sha(t.tk)]));
      const list = rep.list.filter(r => (u && r.from.uid === u.id) || (want.has(r.id) && want.get(r.id) === r.th)).slice(0, 30).map(myView);
      reply(cb, { ok: true, list });
    });
    /** 답장을 읽었어요 (빨간 점 지우기) */
    on('report:read', (d, cb) => {
      const u = me();
      const ids = new Set(Array.isArray(d && d.ids) ? d.ids.slice(0, 30).filter(x => typeof x === 'string') : []);
      const tks = new Map((Array.isArray(d && d.tks) ? d.tks.slice(0, 30) : []).filter(t => t && typeof t.id === 'string' && typeof t.tk === 'string' && t.tk.length < 64).map(t => [t.id, sha(t.tk)]));
      let n = 0;
      for (const r of rep.list) {
        if (!ids.has(r.id) || !r.reply || r.read) continue;
        if ((u && r.from.uid === u.id) || tks.get(r.id) === r.th) { r.read = Date.now(); n++; }
      }
      if (n) save();
      reply(cb, { ok: true, n });
    });

    /* ───── 운영자: 신고함 ───── */
    on('admin:reports', (d, cb) => {
      const u = op(cb); if (!u) return;
      const f = d && STS.has(d.f) ? d.f : d && d.f === 'all' ? 'all' : 'new';
      const n = d && Number(d.n) === 0 ? 0 : int((d && d.n) || 40, 1, 200);     // 0 = 숫자만
      const all = f === 'all' ? rep.list : rep.list.filter(r => r.st === f);
      reply(cb, { ok: true, f, list: all.slice(0, n).map(opView), more: all.length > n, counts: counts() });
    });
    on('admin:report:set', (d, cb) => {
      const u = op(cb); if (!u) return;
      const r = find(d);
      if (!r) return reply(cb, { ok: false, why: 'rpgone' });
      if (!STS.has(d.st)) return reply(cb, { ok: false, why: 'bad' });
      r.st = d.st; r.by = { name: u.name, at: Date.now() };
      save();
      toOps('admin:report:upd', { r: opView(r), counts: counts() });
      reply(cb, { ok: true, r: opView(r) });
    });
    on('admin:report:reply', (d, cb) => {
      const u = op(cb); if (!u) return;
      const r = find(d);
      if (!r) return reply(cb, { ok: false, why: 'rpgone' });
      const text = clean(d.text, REPLY_LEN, true);
      if (!text) return reply(cb, { ok: false, why: 'rpempty' });
      const now = Date.now();
      r.reply = { text, by: u.name, uid: u.id, at: now }; r.read = 0;
      if (r.st === 'new') r.st = 'seen';
      r.by = { name: u.name, at: now };
      save();
      if (r.from.uid) A.emitUser(r.from.uid, 'report:reply', { id: r.id, kind: r.kind, text });   // 접속 중이면 바로 알려요
      toOps('admin:report:upd', { r: opView(r), counts: counts() });
      reply(cb, { ok: true, r: opView(r) });
    });
    on('admin:report:del', (d, cb) => {
      const u = op(cb); if (!u) return;
      const i = d && typeof d.id === 'string' ? rep.list.findIndex(r => r.id === d.id) : -1;
      if (i < 0) return reply(cb, { ok: false, why: 'rpgone' });
      rep.list.splice(i, 1);
      save();
      toOps('admin:report:upd', { del: d.id, counts: counts() });
      reply(cb, { ok: true });
    });
  }

  return { attach, counts, _test: { rep } };
};
