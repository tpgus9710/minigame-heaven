'use strict';
/* 🏎️ 드리프트 카트 — 각자 자기 카트를 화면에서 몰고, 서버는 위치 · 아이템 사용 · 맞음 · 골인 순서를 전달하고 기록해요.
 *  (맞았는지는 맞은 사람 화면이 판정 → 다른 사람에게 알려줌) */
const DELAY = 4500, HURRY = 20, LAP_MIN = 14000;   // 한 바퀴를 14초보다 빨리 도는 건 불가능 (AI 22~26초)
const TRACKS = ['햇살 서킷', '얼음 계곡', '사막 하이웨이'];
const OPTIONS = [
  { key: 'ktMode', label: '모드', def: 'speed', values: [['speed', '스피드전'], ['item', '아이템전']] },
  { key: 'ktTrack', label: '트랙', def: 0, values: [[0, '햇살 서킷'], [1, '얼음 계곡'], [2, '사막 하이웨이'], [-1, '랜덤']] },
  { key: 'ktLaps', label: '바퀴 수', def: 3, values: [[1, '1바퀴'], [2, '2바퀴'], [3, '3바퀴'], [5, '5바퀴']] },
];
const USE = new Set(['banana', 'balloon', 'missile']);
const HIT = new Set(['spin', 'trap', 'boom', 'block']);
const fmt = ms => { const t = ms / 1000, m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };

module.exports = H => {
  const { participants, clamp, num, int } = H;
  const opt = (room, key) => {
    const o = OPTIONS.find(x => x.key === key), v = room.options[key];
    return o.values.some(([x]) => String(x) === String(v)) ? v : o.def;
  };
  const prog = (g, id) => { const s = g.st[id]; return s ? (s[5] - 1) * 1e5 + s[6] : -1e9; };

  function finish(room, why) {
    const g = room.game;
    if (!g || g.over) return;
    const order = new Map(g.finished.map((f, i) => [f.id, i]));
    const ranked = participants(room).slice().sort((a, b) =>
      (order.has(a.id) ? order.get(a.id) : 99) - (order.has(b.id) ? order.get(b.id) : 99) || prog(g, b.id) - prog(g, a.id));
    const win = g.finished[0];
    H.finishGame(room, {
      title: win ? `🏁 ${g.names[win.id] || '?'} 우승!` : '⏰ 아무도 골인하지 못했어요',
      subtitle: `${TRACKS[g.track]} · ${g.mode === 'item' ? '아이템전' : '스피드전'} · ${g.laps}바퀴 · ${why}`,
      ranking: ranked.map(p => {
        const f = g.finished.find(x => x.id === p.id), s = g.st[p.id];
        return { id: p.id, name: p.name, value: f ? fmt(f.t) : s ? `${clamp(s[5], 0, g.laps)}/${g.laps}바퀴 · 완주 못 함` : '완주 못 함' };
      }),
      winners: win ? [win.id] : [],
    });
  }
  function checkEnd(room) {
    const g = room.game;
    if (!g || g.over || !g.ids.length) return;
    if (g.ids.every(id => g.finished.some(f => f.id === id))) H.later(room, 1500, () => finish(room, '모두 골인!'));
  }

  return {
    games: { kart: { name: '드리프트 카트', min: 1, max: 8, options: OPTIONS } },
    start(room) {
      const parts = participants(room).slice(0, 8);
      let track = +opt(room, 'ktTrack');
      if (!(track >= 0 && track < TRACKS.length)) track = H.rand(TRACKS.length);
      const g = room.game = {
        type: 'kart', ids: parts.map(p => p.id), names: Object.fromEntries(parts.map(p => [p.id, p.name])), st: {}, finished: [],
        t0: Date.now() + DELAY, laps: +opt(room, 'ktLaps'), mode: opt(room, 'ktMode'), track, hurry: false,
        credit: {}, lastUse: {},          // 아이템 상자를 먹은 만큼만 공격 아이템을 쓸 수 있어요 (최대 2개)
      };
      H.emit(room, 'kt:start', { track, mode: g.mode, laps: g.laps, delay: DELAY, grid: parts.map(p => [p.id, p.name]) });
      H.loop(room, 50, () => { if (g.ids.length) H.emit(room, 'kt:sts', g.st); });
      H.later(room, DELAY + (g.laps * 100 + 60) * 1000, () => finish(room, '⏰ 시간 종료'));
    },
    events: {
      'kt:st'(room, me, d) {
        const g = room.game;
        if (!Array.isArray(d) || !g.ids.includes(me.id)) return;
        g.st[me.id] = [clamp(Math.round(num(d[0])), -3e4, 3e4), clamp(Math.round(num(d[1])), -3e4, 3e4), +clamp(num(d[2]), -100, 100).toFixed(3),
          clamp(int(d[3]), 0, 3000), int(d[4]) & 127, clamp(int(d[5]), 0, 20), clamp(int(d[6]), 0, 99999), clamp(int(d[7]), -1, 1), d[8] ? 1 : 0];
      },
      'kt:use'(room, me, d) {
        const g = room.game;
        if (!d || !USE.has(d.k) || g.mode !== 'item' || !g.ids.includes(me.id) || g.finished.some(f => f.id === me.id)) return;
        const now = Date.now();
        if (!(g.credit[me.id] > 0) || now - (g.lastUse[me.id] || 0) < 300) return;
        g.credit[me.id]--; g.lastUse[me.id] = now;
        H.emit(room, 'kt:use', {
          from: me.id, k: d.k, id: String(d.id || '').slice(0, 48), x: clamp(num(d.x), -3e4, 3e4), y: clamp(num(d.y), -3e4, 3e4),
          a: clamp(num(d.a), -100, 100), v: clamp(num(d.v), 0, 2500), t: g.ids.includes(d.t) ? d.t : '',
        });
      },
      'kt:hit'(room, me, d) {
        if (!d || !room.game.ids.includes(me.id)) return;
        H.emit(room, 'kt:hit', { from: me.id, id: String(d.id || '').slice(0, 48), k: HIT.has(d.k) ? d.k : 'spin' });
      },
      'kt:box'(room, me, d) {
        const g = room.game;
        if (!d || !g.ids.includes(me.id) || g.mode !== 'item') return;
        const now = Date.now(), last = (g.lastBox = g.lastBox || {});
        if (now - (last[me.id] || 0) < 250) return;
        last[me.id] = now;
        g.credit[me.id] = Math.min(2, (g.credit[me.id] || 0) + 1);
        H.emit(room, 'kt:box', { from: me.id, i: clamp(int(d.i), 0, 63) });
      },
      'kt:finish'(room, me) {
        const g = room.game, t = Date.now() - g.t0;
        if (!g.ids.includes(me.id) || g.finished.some(f => f.id === me.id) || t < g.laps * LAP_MIN) return;
        g.finished.push({ id: me.id, t });
        H.emit(room, 'kt:goal', { id: me.id, name: me.name, rank: g.finished.length, t });
        H.sys(room, `🏁 ${me.name} 님 ${g.finished.length}위로 골인! (${fmt(t)})`);
        if (g.ids.every(id => g.finished.some(f => f.id === id))) return void H.later(room, 1500, () => finish(room, '모두 골인!'));
        if (!g.hurry && g.ids.length > 1) {
          g.hurry = true;
          H.emit(room, 'kt:hurry', { seconds: HURRY });
          H.later(room, HURRY * 1000, () => finish(room, '1위 골인 뒤 제한 시간 끝'));
        }
      },
    },
    leave(room, p) {
      const g = room.game;
      g.ids = g.ids.filter(id => id !== p.id);
      delete g.st[p.id];
      H.emit(room, 'kt:left', { id: p.id });
      checkEnd(room);
    },
  };
};
