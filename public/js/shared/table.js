/* =====================================================================
 *  🎲 차례형 보드·카드 게임 공통 진행기 — 화면(싱글: 봇과 대전)과 서버(멀티)가 같은 코드를 씁니다.
 *
 *  게임 규칙(Core)은 아래 모양을 지켜요 (public/js/shared/*-core.js):
 *    meta      { name, min, max, bots(봇 가능?), turnSec(사람 제한 시간), botDelay:[최소,최대]ms, options:[로비 옵션] }
 *    setup(players, rnd, opts) → state        players: [{ id, name, bot }]
 *    view(state, viewerId)     → 그 사람에게 보여줄 정보 (남의 패처럼 숨길 건 숨김)
 *    act(state, id, action)    → 잘못된 행동이면 오류 문자열, 아니면 undefined (state를 바꿈)
 *    pending(state)            → 지금 행동해야 하는 사람 id 목록
 *    ai(state, id)             → 봇이 할 행동 (auto 가 없으면 시간 초과 때도 사용)
 *    result(state)             → 끝났으면 { title, subtitle, ranking:[{ id, value }] }, 아니면 null
 *  선택:
 *    auto(state, id)           → 시간 초과 때 대신 할 행동
 *    free(state, id, action)   → 차례가 아니어도 할 수 있는 행동인지 (예: 패 섞기)
 *    deadline(state) / timeup(state) → 시간으로 넘어가는 단계 (예: 마피아 낮·밤)
 *    drop(state, id)           → 나간 사람 처리 (없으면 봇이 대신함)
 *    chatRoute(state, id)      → 채팅을 누구에게 보낼지 (마피아 밤 채팅 등)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TableKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createTable(Core, players, o) {
    const meta = Core.meta || {};
    const state = Core.setup(players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot })), o.rnd || Math.random, o.opts || {});
    const bots = new Set(players.filter(p => p.bot).map(p => p.id));
    let timers = [], ended = false;
    const afk = new Set();               // 시간 초과로 대신 둔 사람 → 다시 직접 할 때까지 짧게 기다려요
    const clearAll = () => { timers.forEach(t => o.clearTimer(t)); timers = []; };

    function checkEnd() {
      if (ended) return true;
      const res = Core.result(state);
      if (!res) return false;
      ended = true; clearAll();
      o.onEnd(res);
      return true;
    }
    function schedule() {
      clearAll();
      if (checkEnd()) return;
      const waiting = Core.pending(state);
      const dl = Core.deadline ? Core.deadline(state) : null;
      if (dl) timers.push(o.setTimer(() => { if (ended) return; Core.timeup(state); schedule(); o.onUpdate(); }, Math.max(0, dl - Date.now())));
      const [lo, hi] = meta.botDelay || [700, 1400];
      for (const id of waiting) if (bots.has(id)) timers.push(o.setTimer(() => botMove(id), lo + Math.random() * (hi - lo)));
      const humans = waiting.filter(id => !bots.has(id));
      if (!dl && humans.length && meta.turnSec && o.timeouts !== false) {
        const sec = humans.every(id => afk.has(id)) ? Math.min(meta.turnSec, 5) : meta.turnSec;
        state.turnEnd = Date.now() + sec * 1000;
        timers.push(o.setTimer(() => humans.forEach(id => { if (!ended && Core.pending(state).includes(id)) force(id); }), sec * 1000));
      } else state.turnEnd = dl || null;
    }
    function tryAct(id, a) { return a == null ? 'no-move' : Core.act(state, id, a); }
    function force(id) {
      afk.add(id);
      let err = tryAct(id, Core.auto ? Core.auto(state, id) : Core.ai(state, id));
      if (err && Core.auto) err = tryAct(id, Core.ai(state, id));
      if (err) { if (o.log) o.log(`시간 초과 처리 실패 (${id}): ${err}`); return; }
      schedule(); o.onUpdate();
    }
    function botMove(id) {
      if (ended || !Core.pending(state).includes(id)) return;
      let err = tryAct(id, Core.ai(state, id));
      if (err && Core.auto) err = tryAct(id, Core.auto(state, id));
      if (err) { if (o.log) o.log(`봇 행동 오류 (${id}): ${err}`); return; }
      schedule(); o.onUpdate();
    }

    const api = {
      state,
      /** 사람의 행동 → 오류 문자열 또는 undefined */
      act(id, a) {
        if (ended) return '게임이 끝났어요.';
        if (bots.has(id) || !a || typeof a !== 'object') return;
        const free = !!(Core.free && Core.free(state, id, a));
        if (!free && !Core.pending(state).includes(id)) return '지금은 내 차례가 아니에요.';
        const err = Core.act(state, id, a);
        if (err) return err;
        afk.delete(id);
        if (!free) schedule(); else checkEnd();
        o.onUpdate();   // 다음 차례 시간(turnEnd)까지 정한 뒤 화면에 알려요
      },
      view(id) { return Object.assign(Core.view(state, id), { me: id, turnEnd: state.turnEnd || null, now: Date.now() }); },
      /** 나간 사람: 게임이 처리하거나 봇이 대신 */
      drop(id) {
        if (ended) return;
        if (Core.drop) Core.drop(state, id); else bots.add(id);
        schedule(); o.onUpdate();
      },
      isBot: id => bots.has(id),
      stop() { ended = true; clearAll(); },
    };
    schedule();
    return api;
  }

  /** 여러 게임이 같이 쓰는 작은 도구 */
  const util = {
    shuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    log(state, entry) { state.seq = (state.seq || 0) + 1; (state.log = state.log || []).push(Object.assign({ n: state.seq }, entry)); if (state.log.length > 40) state.log.shift(); },
  };
  return { createTable, util };
});
