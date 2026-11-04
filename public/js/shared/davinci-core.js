/* =====================================================================
 *  🔐 암호 해독 규칙 (다빈치 코드 방식) — 0~11 숫자 타일 + 조커(−), 검정 · 흰색 13장씩 26장
 *  각자 타일을 작은 수부터 늘어놓아요(같은 숫자면 검정이 왼쪽). 시작 패에는 조커가 없어요.
 *  내 차례엔 한 장 뽑아 규칙대로 끼워 넣고(조커는 원하는 자리에), 상대 타일의 숫자를 맞혀요.
 *  맞히면 그 타일이 공개되고 계속 맞힐지 멈출지 골라요. 틀리면 이번에 뽑은 타일을 공개해요.
 *  타일이 모두 공개되면 탈락, 마지막까지 숨긴 타일이 남은 사람이 승리!
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.DavinciCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const JOKER = 12;
  const isJ = t => t.v === JOKER;
  const key = t => t.v * 2 + (t.c === 'w' ? 1 : 0);
  const colorOk = (k, c) => k % 2 === (c === 'w' ? 1 : 0);
  const P = (s, id) => s.players.find(p => p.id === id);
  const cur = s => s.players[s.turn];
  const hiddenLeft = p => p.tiles.some(t => !t.open);
  const label = v => (v === JOKER ? '조커' : String(v));
  const bat = v => [0, 1, 3, 6, 7, 8, 10, 11].includes(v);          // 받침이 있는 숫자 (영 · 일 · 삼 …)
  /** 숫자 타일은 순서대로 끼워 넣어요 (조커는 놓인 자리 그대로) */
  function insert(row, t) {
    let i = row.findIndex(x => !isJ(x) && key(x) > key(t));
    if (i < 0) i = row.length;
    row.splice(i, 0, t);
  }

  function setup(players, rnd) {
    let pool = [];
    for (let v = 0; v <= JOKER; v++) for (const c of ['b', 'w']) pool.push({ v, c });
    pool = shuffle(pool, rnd);
    const s = { rnd, pool, turn: Math.floor(rnd() * players.length), phase: 'guess', drawn: null, drawnUid: null, shown: true, over: false, winner: null, out: [], last: null, log: [], seq: 0, msg: '', uid: 0 };
    const n = players.length >= 4 ? 3 : 4;
    s.players = players.map(p => {
      const row = [];
      for (let i = 0; i < n; i++) {
        const at = s.pool.findIndex(t => !isJ(t));      // 시작 패에 조커가 나오면 돌려놓고 다른 타일을 받아요
        insert(row, Object.assign(s.pool.splice(at, 1)[0], { open: false, uid: ++s.uid }));
      }
      return { id: p.id, name: p.name, tiles: row };
    });
    s.pool = shuffle(s.pool, rnd);                        // 조커를 섞어 넣기
    beginTurn(s);
    return s;
  }
  function beginTurn(s) {
    const p = cur(s);
    s.streak = 0; s.drawn = null; s.drawnUid = null; s.phase = 'guess'; s.shown = true;
    if (!s.pool.length) { s.msg = `${p.name} 님 차례 — 더미가 비었어요. 상대 타일의 숫자를 맞혀 보세요!`; return; }
    const t = Object.assign(s.pool.pop(), { open: false, uid: ++s.uid });
    s.drawnUid = t.uid; s.shown = false;          // 새 타일은 첫 추리를 할 때 남에게 보여요 (조커인지 티 나지 않게)
    s.msg = `${p.name} 님 차례 — 타일을 한 장 뽑았어요. 상대 타일의 숫자를 맞혀 보세요!`;
    if (isJ(t)) { s.drawn = t; s.phase = 'place'; }     // 조커는 놓을 자리를 직접 골라요
    else insert(p.tiles, t);
  }
  function nextTurn(s) {
    const alive = s.players.filter(hiddenLeft);
    if (alive.length <= 1) { s.over = true; s.phase = 'over'; s.drawnUid = null; s.winner = alive[0] ? alive[0].id : cur(s).id; s.msg = `${P(s, s.winner).name} 님이 마지막까지 암호를 지켰어요!`; return; }
    do { s.turn = (s.turn + 1) % s.players.length; } while (!hiddenLeft(cur(s)));
    beginTurn(s);
  }
  function checkOut(s, p) { if (!hiddenLeft(p) && !s.out.includes(p.id)) { s.out.push(p.id); log(s, { t: 'out', id: p.id }); return true; } return false; }

  function act(s, id, a) {
    const p = cur(s);
    if (s.over) return '게임이 끝났어요.';
    if (p.id !== id) return '지금은 내 차례가 아니에요.';
    if (s.phase === 'place') {                       // 조커는 놓을 자리(pos)를 첫 추리와 함께 보내요
      if (a.t !== 'guess') return '뽑은 조커를 놓을 자리를 고르고 상대 타일을 맞혀 보세요.';
      const pos = Math.floor(+a.pos);
      if (!(pos >= 0 && pos <= p.tiles.length)) return '먼저 조커를 놓을 자리(+)를 골라 주세요.';
      const tp0 = P(s, a.target), t0 = tp0 && tp0 !== p ? tp0.tiles[+a.idx] : null, v0 = +a.v;
      if (!t0 || t0.open || !(Number.isInteger(v0) && v0 >= 0 && v0 <= JOKER)) return '상대의 숨긴 타일과 숫자를 골라 주세요.';
      p.tiles.splice(pos, 0, s.drawn); s.drawn = null; s.phase = 'guess';
    }
    if (a.t === 'stop') {
      if (s.phase !== 'after') return '먼저 한 번은 맞혀야 해요.';
      log(s, { t: 'stop', id });
      s.msg = `${p.name} 님이 멈췄어요. 뽑은 타일은 숨긴 채로 둬요.`;
      return void nextTurn(s);
    }
    if (a.t !== 'guess') return '상대 타일을 골라 숫자를 맞혀 보세요.';
    const tp = P(s, a.target), idx = +a.idx, v = +a.v;
    if (tp && tp !== p && tp.tiles[idx] && !tp.tiles[idx].open && Number.isInteger(v) && v >= 0 && v <= JOKER) s.shown = true;
    if (!tp || tp === p) return '상대 타일을 골라 주세요.';
    const tile = tp.tiles[idx];
    if (!tile || tile.open) return '숨겨진 타일을 골라 주세요.';
    if (!(Number.isInteger(v) && v >= 0 && v <= JOKER)) return '0~11 숫자나 조커를 골라 주세요.';
    s.last = { by: id, target: tp.id, uid: tile.uid, v, ok: tile.v === v, n: (s.last ? s.last.n : 0) + 1 };
    const col = tile.c === 'b' ? '검정' : '흰색';
    if (tile.v === v) {
      tile.open = true; s.streak++;
      log(s, { t: 'hit', id, target: tp.id, v });
      s.msg = `정답! ${tp.name} 님의 ${col} 타일은 ${label(v)}${bat(v) ? '이었어요' : '였어요'}.`;
      if (checkOut(s, tp)) s.msg += ` ${tp.name} 님 탈락!`;
      if (s.players.filter(hiddenLeft).length <= 1) return void nextTurn(s);
      s.phase = 'after';
      s.msg += ' 계속 맞힐까요, 멈출까요?';
      return;
    }
    log(s, { t: 'miss', id, target: tp.id, v });
    s.msg = `땡! ${tp.name} 님의 ${col} 타일은 ${label(v)}${bat(v) ? '이' : '가'} 아니에요.`;
    const mine = s.drawnUid && p.tiles.find(t => t.uid === s.drawnUid);
    if (mine && !mine.open) { mine.open = true; s.msg += ` ${p.name} 님이 뽑은 타일(${label(mine.v)})이 공개돼요.`; }
    else {
      const hid = p.tiles.filter(t => !t.open), t = hid[Math.floor(s.rnd() * hid.length)];
      if (t) { t.open = true; s.msg += ` 벌칙으로 ${p.name} 님의 타일 하나(${label(t.v)})가 공개돼요.`; }
    }
    if (checkOut(s, p)) s.msg += ` ${p.name} 님 탈락!`;
    nextTurn(s);
  }

  /* ── 추리: 내가 아는 정보(내 타일 · 공개 타일 · 색 · 순서)로 가능한 숫자 ── */
  /** rows: 모든 줄 [{c, v(보이면, 조커=12)}] · 내가 아는 숫자(키)와 이미 본 조커 색 */
  function knownInfo(rows, myTiles, drawn) {
    const keys = new Set(), jk = { b: false, w: false };
    const see = t => { if (t.v == null) return; if (t.v === JOKER) jk[t.c] = true; else keys.add(key(t)); };
    rows.forEach(r => r.forEach(see)); myTiles.forEach(see); if (drawn) see(drawn);
    return { keys, jk };
  }
  /** 그 줄을 규칙대로 채울 수 있는지 (숨긴 타일 몇 개는 조커일 수도 있어요) */
  function feasible(row, fi, fv, info) {
    const hidden = [];
    row.forEach((t, i) => { if (t.v == null && i !== fi) hidden.push(i); });
    const used = { b: info.jk.b, w: info.jk.w };
    if (fv === JOKER) used[row[fi].c] = true;
    const opts = c => [-1].concat(used[c] ? [] : hidden.filter(i => row[i].c === c));
    for (const jb of opts('b')) for (const jw of opts('w')) {
      let prev = -1, ok = true;
      for (let i = 0; i < row.length && ok; i++) {
        const t = row[i], v = i === fi ? fv : t.v;
        if (i === jb || i === jw || v === JOKER) continue;
        if (v != null) { const k = v * 2 + (t.c === 'w' ? 1 : 0); if (k <= prev) ok = false; else prev = k; continue; }
        let k = prev + 1;
        while (k < 24 && (!colorOk(k, t.c) || info.keys.has(k))) k++;
        if (k >= 24) ok = false; else prev = k;
      }
      if (ok) return true;
    }
    return false;
  }
  /** row 의 idx 번째 숨긴 타일이 될 수 있는 값들 (0~11, 조커=12) */
  function candidates(row, idx, info) {
    const c = row[idx].c, out = [];
    for (let v = 0; v <= 11; v++) { const k = v * 2 + (c === 'w' ? 1 : 0); if (!info.keys.has(k) && feasible(row, idx, v, info)) out.push(v); }
    if (!info.jk[c] && feasible(row, idx, JOKER, info)) out.push(JOKER);
    return out;
  }
  function aiView(s, id) {
    const me = P(s, id);
    const rows = s.players.map(p => p.tiles.map(t => ({ c: t.c, v: t.open || p.id === id ? t.v : null })));
    return { rows, info: knownInfo(rows, me.tiles, cur(s).id === id ? s.drawn : null) };
  }
  function bestGuess(s, id) {
    const { rows, info } = aiView(s, id);
    let best = null;
    s.players.forEach((p, pi) => {
      if (p.id === id || !hiddenLeft(p)) return;
      p.tiles.forEach((t, i) => {
        if (t.open) return;
        const c = candidates(rows[pi], i, info);
        if (!c.length) return;
        const nums = c.filter(v => v !== JOKER), pool = nums.length ? nums : c;   // 조커는 드물어서 마지막에
        const pr = 1 / c.length + s.rnd() * 0.01;
        if (!best || pr > best.pr) best = { pr, target: p.id, idx: i, v: pool[Math.floor(s.rnd() * pool.length)] };
      });
    });
    return best;
  }
  function ai(s, id) {
    const g = bestGuess(s, id);
    if (s.phase === 'place') return g ? { t: 'guess', target: g.target, idx: g.idx, v: g.v, pos: Math.floor(s.rnd() * (cur(s).tiles.length + 1)) } : null;
    const risky = !!(s.drawnUid && cur(s).tiles.some(t => t.uid === s.drawnUid && !t.open));
    if (s.phase === 'after' && (!g || g.pr < (risky ? 0.5 : 0.34) || s.streak >= 4)) return { t: 'stop' };
    if (!g) return { t: 'stop' };
    return { t: 'guess', target: g.target, idx: g.idx, v: g.v };
  }

  function view(s, viewer) {
    const p = cur(s), mineTurn = p.id === viewer;
    return {
      players: s.players.map(q => ({ id: q.id, name: q.name, out: s.out.includes(q.id),
        tiles: q.tiles.filter(t => s.shown || q.id === viewer || t.uid !== s.drawnUid)       // 첫 추리 전에는 새 타일을 남에게 숨겨요
          .map(t => ({ c: t.c, v: t.open || q.id === viewer || s.over ? t.v : null, open: t.open, uid: t.uid, isNew: t.uid === s.drawnUid && !s.over })) })),
      turnId: s.over ? null : p.id,
      phase: s.phase === 'place' && !mineTurn ? 'guess' : s.phase,      // 조커를 뽑은 걸 남은 몰라요
      pool: s.pool.length,
      drawn: s.drawn && mineTurn ? { c: s.drawn.c, v: s.drawn.v, uid: s.drawn.uid } : null,
      last: s.last, over: s.over, winner: s.winner, msg: s.msg, log: s.log.slice(-12), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const order = [s.winner].concat(s.players.map(p => p.id).filter(id => id !== s.winner && !s.out.includes(id)), s.out.slice().reverse());
    return {
      title: `🔐 ${P(s, s.winner).name} 님의 암호는 끝내 풀리지 않았어요!`, subtitle: '마지막까지 숨긴 타일이 남은 사람이 승리',
      ranking: [...new Set(order)].map((id, i) => ({ id, value: i === 0 ? `숨긴 타일 ${P(s, id).tiles.filter(t => !t.open).length}장` : '해독됨' })),
    };
  }
  return {
    meta: { name: '암호 해독', min: 2, max: 4, bots: true, turnSec: 40, botDelay: [1200, 2000],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명']] }] },
    JOKER, key, candidates, knownInfo,
    setup, act, ai, view, result,
    /** 사람이 모두 탈락하면 봇끼리 이어 하지 않고 끝내요 (TableKit: out · endNow) */
    out: (s, id) => s.out.includes(id),
    endNow(s) {
      s.over = true; s.phase = 'over'; s.drawnUid = null; s.winner = null;
      s.msg = '사람의 암호가 모두 풀려서 게임을 마쳤어요.';
      const order = s.players.map(p => p.id).filter(id => !s.out.includes(id)).concat(s.out.slice().reverse());
      return { title: '🏁 게임 끝!', subtitle: '사람의 암호가 모두 풀려서 봇끼리는 더 하지 않아요',
        ranking: [...new Set(order)].map(id => ({ id, value: s.out.includes(id) ? '해독됨' : `숨긴 타일 ${P(s, id).tiles.filter(t => !t.open).length}장` })), winners: [] };
    },
    auto: (s, id) => (s.phase === 'after' ? { t: 'stop' } : ai(s, id)),
    pending: s => (s.over ? [] : [cur(s).id]),
  };
});
