'use strict';
/* 🔢🖼️ 퍼즐 대결 — 스도쿠 · 노노그램. 모두 같은 퍼즐을 받아 먼저 다 맞게 채우는 사람이 우승.
 *  정답은 서버만 알아요. 화면이 보내 온 판으로 진행률(채운 칸 %)을 보여 주고, 다 맞았는지도 서버가 확인해요.
 *  (진행률은 「맞은 칸」이 아니라 「채운 칸」이라서 이것으로 정답을 알아낼 수는 없어요. 순위는 시간이 끝날 때 맞은 칸으로) */
const Sudoku = require('../public/js/shared/sudoku-core');
const Nono = require('../public/js/shared/nonogram-core');

const OPT = {
  sudoku: [{ key: 'suLevel', label: '🔢 난이도', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']] }],
  nonogram: [{ key: 'ngLevel', label: '🖼️ 크기', def: 's10', values: [['s5', '5×5'], ['s10', '10×10'], ['s15', '15×15']] }],
};
const SECONDS = { sudoku: { easy: 600, normal: 900, hard: 1200 }, nonogram: { s5: 180, s10: 480, s15: 900 } };
const NAME = { sudoku: '스도쿠 대결', nonogram: '노노그램 대결' };

module.exports = H => {
  const { participants, pushScores } = H;
  const opt = (room, key, game) => { const o = OPT[game].find(x => x.key === key), v = room.options[key]; return o.values.some(([x]) => x === v) ? v : o.def; };
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function finish(room, why) {
    const g = room.game; if (!g || g.over) return;
    const ranked = participants(room).slice().sort((a, b) => {
      const A = g.st[a.id] || {}, B = g.st[b.id] || {};
      return (B.done ? 1 : 0) - (A.done ? 1 : 0) || (A.doneAt || 9e15) - (B.doneAt || 9e15) || (B.acc || 0) - (A.acc || 0);
    });
    const first = ranked[0], fs = first && g.st[first.id];
    H.finishGame(room, {
      title: fs && fs.done ? `🏆 ${first.name} 님이 먼저 풀었어요!` : '⏰ 시간 종료!',
      subtitle: `${NAME[g.type]} · ${why}`,
      ranking: ranked.map(p => { const s = g.st[p.id] || {}; return { id: p.id, name: p.name, value: s.done ? `✅ ${fmt(Math.round((s.doneAt - g.startAt) / 1000))}` : `정답 ${s.acc || 0}%` }; }),
    });
  }
  const checkEnd = room => { const g = room.game; if (g && !g.over && participants(room).every(p => (g.st[p.id] || {}).done)) finish(room, '모두 풀었어요'); };

  function payload(room, p) {
    const g = room.game, left = Math.max(0, Math.round((g.endAt - Date.now()) / 1000)), grid = (g.st[p.id] || {}).grid || null;
    return g.type === 'sudoku'
      ? { game: 'sudoku', level: g.level, givens: g.P.givens, left, grid }
      : { game: 'nonogram', level: g.level, w: g.P.w, h: g.P.h, rows: g.P.rows, cols: g.P.cols, left, grid };
  }

  return {
    games: {
      sudoku: { name: NAME.sudoku, min: 1, max: 8, options: OPT.sudoku },
      nonogram: { name: NAME.nonogram, min: 1, max: 8, options: OPT.nonogram },
    },
    start(room) {
      const type = room.gameType;
      const level = type === 'sudoku' ? opt(room, 'suLevel', type) : opt(room, 'ngLevel', type);
      const P = type === 'sudoku' ? Sudoku.make(level) : Nono.make(level);
      const sec = SECONDS[type][level];
      room.game = { type, level, P, st: {}, startAt: Date.now(), endAt: Date.now() + sec * 1000 };
      participants(room).forEach(p => { p.score = 0; room.game.st[p.id] = { grid: null, done: false, acc: 0 }; });
      for (const p of participants(room)) H.toPlayer(p.id, 'pz:start', payload(room, p));
      for (const p of room.players.filter(x => !participants(room).includes(x))) H.toPlayer(p.id, 'pz:start', payload(room, p));   // 관전
      pushScores(room);
      H.later(room, sec * 1000 + 800, () => finish(room, '시간 종료 — 맞은 칸이 많은 순'));
    },
    events: {
      /** 내 판 (스도쿠: 81자 0~9 · 노노그램: 칸마다 0 빈칸 · 1 칠함 · 2 X) */
      'pz:grid'(room, me, str) {
        const g = room.game, st = g.st[me.id];
        if (!st || st.done || typeof str !== 'string' || str.length > 400) return;
        const r = g.type === 'sudoku' ? Sudoku.progress(g.P.givens, g.P.solution, str) : Nono.progress(g.P.sol, str);
        if (!r) return;
        st.grid = str;
        if (g.type === 'sudoku') {                       // 스도쿠는 채운 칸 % (정답 여부는 끝까지 비밀)
          let empty = 0, filled = 0;
          for (let i = 0; i < 81; i++) if (g.P.givens[i] === '0') { empty++; if (str[i] !== '0') filled++; }
          me.score = r.done ? 100 : Math.min(99, Math.floor(filled / Math.max(1, empty) * 100));
          st.acc = r.pct;
        } else { me.score = r.pct; st.acc = r.acc; }
        if (r.done) {
          st.done = true; st.doneAt = Date.now(); me.score = 100; st.acc = 100;
          H.sys(room, `🏁 ${me.name} 님 완성! (${fmt(Math.round((st.doneAt - g.startAt) / 1000))})`);
          pushScores(room);
          return finish(room, `${me.name} 님이 가장 먼저 풀었어요`);
        }
        pushScores(room);
      },
    },
    leave(room) { checkEnd(room); },
    /** 새로 고침하고 돌아오면 퍼즐 · 내 판 · 남은 시간을 다시 */
    resync(room, p, socket) { if (room.game && !room.game.over) socket.emit('pz:start', payload(room, p)); },
  };
};
