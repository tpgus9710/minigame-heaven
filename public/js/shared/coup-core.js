/* =====================================================================
 *  👑 궁정 음모 규칙 (쿠 방식) — 인물 카드 15장(공작 · 암살자 · 사령관 · 대사 · 백작부인 3장씩)
 *  각자 카드 2장 + 코인 2개. 차례엔 소득 · 해외 원조 · 쿠데타 또는 인물 능력(가진 척해도 됨!)
 *  인물을 주장하면 누구나 "도전!" — 거짓말이면 주장한 쪽이, 진짜면 도전한 쪽이 카드 1장을 잃어요.
 *  해외 원조는 공작이, 암살은 백작부인이, 갈취는 사령관 · 대사가 막아요(막기도 도전할 수 있어요).
 *  카드 2장을 모두 잃으면 탈락, 마지막까지 살아남은 사람이 승리!
 *
 *  진행: act(내 차례 행동) → window(도전/막기 응답: 여러 명이 동시에) → lose(잃을 카드 고르기) → exchange(대사 교환)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.CoupCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const CARDS = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];
  const NAME = { duke: '공작', assassin: '암살자', captain: '사령관', ambassador: '대사', contessa: '백작부인' };
  const ACTIONS = {
    income: { name: '소득', claim: null, cost: 0, target: false },
    aid: { name: '해외 원조', claim: null, cost: 0, target: false, block: ['duke'], blockAny: true },
    coup: { name: '쿠데타', claim: null, cost: 7, target: true },
    tax: { name: '세금', claim: 'duke', cost: 0, target: false },
    assassin: { name: '암살', claim: 'assassin', cost: 3, target: true, block: ['contessa'] },
    steal: { name: '갈취', claim: 'captain', cost: 0, target: true, block: ['captain', 'ambassador'] },
    exchange: { name: '교환', claim: 'ambassador', cost: 0, target: false },
  };
  const WINDOW_MS = 10000;      // 멀티: 도전/막기 응답 시간
  const VALUE = { duke: 5, assassin: 4, captain: 3.6, contessa: 3.3, ambassador: 2.6 };

  /* ── 한국어 조사 ── */
  const jong = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; };
  const ira = w => w + (jong(w) ? '이라며' : '라며');
  const iga = w => w + (jong(w) ? '이' : '가');

  const P = (s, id) => s.players.find(p => p.id === id);
  const cur = s => s.players[s.turn];
  const live = p => p.cards.filter(c => !c.dead);
  const alive = p => p.cards.some(c => !c.dead);
  const has = (p, c) => p.cards.some(x => !x.dead && x.c === c);
  const alivePlayers = s => s.players.filter(alive);
  function say(s, text, t, extra) { s.msg = text; log(s, Object.assign({ t: t || 'info', text }, extra || {})); }
  function noteClaim(s, id, card) { const m = s.claims[id] = s.claims[id] || {}; m[card] = (m[card] || 0) + 1; }

  function setup(players, rnd, opts) {
    const s = { rnd, solo: !!(opts && opts.solo), deck: [], turn: 0, phase: 'act', pend: null, win: null, winN: 0, losses: [],
      over: false, winner: null, out: [], claims: {}, log: [], seq: 0, msg: '', turnN: 1, proof: null };
    for (const c of CARDS) for (let i = 0; i < 3; i++) s.deck.push(c);
    s.deck = shuffle(s.deck, rnd);
    s.players = players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, coins: 2, cards: [{ c: s.deck.pop(), dead: false }, { c: s.deck.pop(), dead: false }] }));
    s.turn = Math.floor(rnd() * s.players.length);
    if (s.players.length === 2) s.players[s.turn].coins = 1;     // 2인 규칙: 먼저 하는 사람은 코인 1개
    say(s, `${cur(s).name} 님부터 시작해요. 카드를 가진 척해도 돼요 — 들키지만 않으면!`, 'start');
    return s;
  }

  /* ── 차례 진행 ── */
  function endTurn(s) {
    s.pend = null; s.win = null;
    if (checkEnd(s)) return;
    for (const p of s.players) for (const c of p.cards) c.fresh = false;
    do { s.turn = (s.turn + 1) % s.players.length; } while (!alive(cur(s)));
    s.turnN++; s.phase = 'act';
  }
  function checkEnd(s) {
    const al = alivePlayers(s);
    if (al.length > 1) return false;
    s.over = true; s.phase = 'over'; s.win = null; s.pend = null; s.losses = [];
    s.winner = (al[0] || cur(s)).id;
    say(s, `${P(s, s.winner).name} 님이 궁정을 차지했어요!`, 'win', { id: s.winner });
    return true;
  }
  function reveal(s, p, i, why) {
    const c = p.cards[i];
    c.dead = true; c.fresh = false;
    say(s, `${p.name} 님이 ${NAME[c.c]} 카드를 잃었어요${why ? ` (${why})` : ''}.`, 'lose', { id: p.id, card: c.c });
    if (!alive(p)) { p.coins = 0; s.out.push(p.id); say(s, `${p.name} 님 탈락!`, 'out', { id: p.id }); }
  }
  const pendingIds = s => (s.win ? s.win.responders.filter(id => !s.win.passed.includes(id)) : []);

  /** 입력이 필요할 때까지 진행해요 (잃을 카드 → 응답 창 → 대사 교환 → 행동 단계 순) */
  function advance(s) {
    for (let guard = 0; guard < 60 && !s.over; guard++) {
      if (s.losses.length) {
        const L = s.losses[0], p = P(s, L.id), lv = live(p);
        if (!lv.length) { s.losses.shift(); continue; }
        if (lv.length === 1) { reveal(s, p, p.cards.indexOf(lv[0]), L.why); s.losses.shift(); if (checkEnd(s)) return; continue; }
        s.phase = 'lose'; return;
      }
      if (s.win) { if (pendingIds(s).length) { s.phase = 'window'; return; } s.win = null; continue; }
      if (!s.pend) { s.phase = 'act'; return; }
      if (s.pend.stage === 'exchange') { s.phase = 'exchange'; return; }
      step(s);
    }
  }
  function step(s) {
    const d = s.pend, A = ACTIONS[d.kind], actor = P(s, d.actor), tgt = d.target ? P(s, d.target) : null;
    switch (d.stage) {
      case 'declared':
        if (A.claim) { openWindow(s, 'chal', d.actor, A.claim); d.stage = 'afterChal'; } else d.stage = 'blockable';
        return;
      case 'afterChal':
        if (d.chal && d.chal.caught) {
          let t = `${iga(A.name)} 무산됐어요.`;
          if (d.paid && alive(actor)) { actor.coins += d.paid; t += ` (코인 ${d.paid}개는 돌려받아요)`; }
          say(s, t, 'fail'); d.stage = 'finish'; return;
        }
        d.stage = alive(actor) ? 'blockable' : 'finish';
        return;
      case 'blockable':
        if (A.block && (A.blockAny || (tgt && alive(tgt)))) { openWindow(s, 'block', d.actor, null); d.stage = 'afterBlock'; } else d.stage = 'effect';
        return;
      case 'afterBlock':
        if (!d.block) { d.stage = 'effect'; return; }
        openWindow(s, 'bchal', d.block.by, d.block.card); d.stage = 'afterBlockChal';
        return;
      case 'afterBlockChal':
        if (d.bchal && d.bchal.caught) { d.stage = 'effect'; return; }
        say(s, `${P(s, d.block.by).name} 님이 막아서 ${iga(A.name)} 무산됐어요.`, 'fail'); d.stage = 'finish';
        return;
      case 'effect': effect(s); return;
      default: endTurn(s);      // 'finish'
    }
  }
  function effect(s) {
    const d = s.pend, p = P(s, d.actor), t = d.target ? P(s, d.target) : null;
    d.stage = 'finish';
    if (!alive(p)) return;
    if (d.kind === 'aid') { p.coins += 2; say(s, `${p.name} 님 해외 원조 +2코인`, 'coin', { id: p.id, d: 2 }); }
    else if (d.kind === 'tax') { p.coins += 3; say(s, `${p.name} 님 세금 +3코인`, 'coin', { id: p.id, d: 3 }); }
    else if (d.kind === 'steal' && t) {
      const n = Math.min(2, t.coins); t.coins -= n; p.coins += n;
      say(s, `${p.name} 님이 ${t.name} 님의 코인 ${n}개를 빼앗았어요.`, 'coin', { id: p.id, d: n, from: t.id });
    } else if (d.kind === 'assassin' && t && alive(t)) { say(s, `암살 성공! ${t.name} 님이 카드 1장을 잃어요.`, 'hit', { id: t.id }); s.losses.push({ id: t.id, why: '암살' }); }
    else if (d.kind === 'exchange') {
      d.ex = live(p).map(c => c.c).concat([s.deck.pop(), s.deck.pop()].filter(Boolean));
      d.stage = 'exchange';
      say(s, `${p.name} 님이 궁정 덱에서 카드 2장을 보고 있어요…`, 'info');
    }
  }

  /** 응답 창 열기: chal(행동 주장 도전) · block(막기) · bchal(막기 주장 도전). 봇은 미리 정해 두고, 허용할 봇은 바로 넘겨요 */
  function openWindow(s, type, claimant, card) {
    const d = s.pend, A = ACTIONS[d.kind];
    const responders = type === 'block'
      ? (A.blockAny ? alivePlayers(s).filter(p => p.id !== d.actor).map(p => p.id) : [d.target])
      : alivePlayers(s).filter(p => p.id !== claimant).map(p => p.id);
    const w = s.win = { type, claimant, card, kind: d.kind, responders, passed: [], plan: {}, end: null, n: ++s.winN };
    for (const id of responders) {
      if (!P(s, id).bot) continue;
      const r = botRespond(s, id, w);
      if (!r || r.t === 'allow') w.passed.push(id); else w.plan[id] = r;
    }
    const humanWaiting = responders.some(id => !P(s, id).bot && !w.passed.includes(id));
    w.end = humanWaiting && !s.solo ? Date.now() + WINDOW_MS : null;     // 혼자 할 때는 사람을 재촉하지 않아요
  }
  function challenge(s, w, by) {
    const cl = P(s, w.claimant), ch = P(s, by), card = w.card;
    say(s, `${ch.name} 님이 ${cl.name} 님에게 도전!`, 'chal', { id: by, target: cl.id });
    const i = cl.cards.findIndex(c => !c.dead && c.c === card);
    const res = { by, caught: i < 0 };
    if (i >= 0) {
      s.deck.push(card); s.deck = shuffle(s.deck, s.rnd);
      cl.cards[i] = { c: s.deck.pop(), dead: false, fresh: true };
      s.proof = { id: cl.id, card, by, n: s.seq + 1 };
      say(s, `진짜 ${NAME[card]}${jong(NAME[card]) ? '이었어요' : '였어요'}! ${cl.name} 님은 카드를 섞어 넣고 새로 받아요. ${ch.name} 님이 카드 1장을 잃어요.`, 'proof', { id: cl.id, card });
      s.losses.push({ id: by, why: '도전 실패' });
    } else {
      s.proof = { id: cl.id, card, by, lie: true, n: s.seq + 1 };
      say(s, `거짓말 들통! ${cl.name} 님은 ${iga(NAME[card])} 아니었어요.`, 'caught', { id: cl.id, card });
      s.losses.push({ id: cl.id, why: '거짓말' });
    }
    if (w.type === 'chal') s.pend.chal = res; else s.pend.bchal = res;
  }

  /* ── 행동 ── */
  function declare(s, id, kind, target) {
    const A = Object.prototype.hasOwnProperty.call(ACTIONS, kind) ? ACTIONS[kind] : null, p = P(s, id);   // constructor 같은 이름은 거절
    if (!A) return '할 행동을 골라 주세요.';
    if (p.coins >= 10 && kind !== 'coup') return '코인이 10개 이상이면 반드시 쿠데타를 해야 해요.';
    if (p.coins < A.cost) return `코인이 ${A.cost}개 있어야 해요.`;
    let t = null;
    if (A.target) {
      t = P(s, target);
      if (!t || t === p || !alive(t)) return '대상을 골라 주세요.';
      if (kind === 'steal' && t.coins <= 0) return '코인이 없는 사람은 갈취할 수 없어요.';
    }
    p.coins -= A.cost;
    s.proof = null;
    s.pend = { kind, actor: id, target: t ? t.id : null, claim: A.claim, stage: 'declared', paid: A.cost, n: s.turnN };
    if (A.claim) noteClaim(s, id, A.claim);
    const ex = { id, kind, target: t ? t.id : null, card: A.claim };
    if (kind === 'income') { p.coins += 1; say(s, `${p.name} 님 소득 +1코인`, 'coin', { id, d: 1 }); s.pend.stage = 'finish'; }
    else if (kind === 'coup') { say(s, `${p.name} 님의 쿠데타! ${t.name} 님이 카드 1장을 잃어요.`, 'coup', ex); s.losses.push({ id: t.id, why: '쿠데타' }); s.pend.stage = 'finish'; }
    else if (kind === 'aid') say(s, `${p.name} 님이 해외 원조(+2)를 받으려 해요.`, 'act', ex);
    else if (kind === 'tax') say(s, `${p.name} 님이 ${ira('공작')} 세금 +3을 걷으려 해요.`, 'claim', ex);
    else if (kind === 'assassin') say(s, `${p.name} 님이 ${ira('암살자')} ${t.name} 님을 노려요! (3코인)`, 'claim', ex);
    else if (kind === 'steal') say(s, `${p.name} 님이 ${ira('사령관')} ${t.name} 님의 코인을 빼앗으려 해요.`, 'claim', ex);
    else if (kind === 'exchange') say(s, `${p.name} 님이 ${ira('대사')} 카드를 바꾸려 해요.`, 'claim', ex);
    advance(s);
  }
  function respond(s, id, a) {
    const w = s.win;
    if (!w || !pendingIds(s).includes(id)) return '지금은 응답할 차례가 아니에요.';
    if (a.t === 'allow') { w.passed.push(id); advance(s); return; }
    if (w.type === 'block') {
      if (a.t !== 'block') return '막을지 허용할지 골라 주세요.';
      const opts = ACTIONS[w.kind].block;
      if (!opts.includes(a.card)) return `${opts.map(c => NAME[c]).join(' 또는 ')}(으)로만 막을 수 있어요.`;
      s.pend.block = { by: id, card: a.card }; noteClaim(s, id, a.card);
      s.win = null;
      say(s, `${P(s, id).name} 님이 ${ira(NAME[a.card])} 막아요!`, 'block', { id, card: a.card });
      advance(s); return;
    }
    if (a.t !== 'chal') return '도전할지 허용할지 골라 주세요.';
    s.win = null;
    challenge(s, w, id);
    advance(s);
  }

  function act(s, id, a) {
    if (s.over) return '게임이 끝났어요.';
    if (s.phase === 'act') {
      if (cur(s).id !== id) return '지금은 내 차례가 아니에요.';
      if (a.t !== 'act') return '할 행동을 골라 주세요.';
      return declare(s, id, a.kind, a.target);
    }
    if (s.phase === 'window') return respond(s, id, a);
    if (s.phase === 'lose') {
      const L = s.losses[0];
      if (!L || L.id !== id) return '지금은 카드를 고를 때가 아니에요.';
      if (a.t !== 'lose') return '잃을 카드를 골라 주세요.';
      const p = P(s, id), i = +a.idx;
      if (!p.cards[i] || p.cards[i].dead) return '아직 살아 있는 카드를 골라 주세요.';
      reveal(s, p, i, L.why); s.losses.shift();
      if (!checkEnd(s)) advance(s);
      return;
    }
    if (s.phase === 'exchange') {
      const d = s.pend, p = P(s, id);
      if (!d || d.actor !== id) return '지금은 카드를 고를 때가 아니에요.';
      if (a.t !== 'keep') return '남길 카드를 골라 주세요.';
      const need = live(p).length, idx = [...new Set((Array.isArray(a.idx) ? a.idx : []).map(Number))];
      if (idx.length !== need || idx.some(i => !Number.isInteger(i) || i < 0 || i >= d.ex.length)) return `남길 카드 ${need}장을 골라 주세요.`;
      const keep = idx.map(i => d.ex[i]), back = d.ex.filter((_, i) => !idx.includes(i));
      let k = 0;
      p.cards = p.cards.map(c => (c.dead ? c : { c: keep[k++], dead: false, fresh: true }));
      s.deck = shuffle(s.deck.concat(back), s.rnd);
      d.ex = null; d.stage = 'finish';
      say(s, `${p.name} 님이 카드 교환을 마쳤어요.`, 'info', { id });
      advance(s);
      return;
    }
    return '지금은 할 수 없어요.';
  }

  /* ── 봇: 자기 카드와 공개된 카드, 주장 기록만 보고 판단해요 ── */
  function unseen(s, id, card) {     // 내 눈에 안 보이는 곳(남의 숨긴 카드 + 덱)에 있을 수 있는 장 수
    let n = 3;
    for (const p of s.players) for (const c of p.cards) if (c.c === card && (c.dead || p.id === id)) n--;
    return n;
  }
  const claimed = (s, id, card) => ((s.claims[id] || {})[card] || 0);
  function threat(s, p) { return live(p).length * 10 + p.coins + (p.coins >= 7 ? 6 : 0) + (p.bot ? 0 : 1); }
  function botAction(s, id) {
    const me = P(s, id), R = s.rnd, others = alivePlayers(s).filter(p => p.id !== id);
    const top = others.slice().sort((a, b) => threat(s, b) - threat(s, a))[0];
    if (me.coins >= 10 || (me.coins >= 7 && R() < 0.92)) return { t: 'act', kind: 'coup', target: top.id };
    const can = c => unseen(s, id, c) > 0;
    const hasC = c => has(me, c);
    if (me.coins >= 3 && (hasC('assassin') || (can('assassin') && R() < (claimed(s, id, 'assassin') ? 0.45 : 0.07)))) {
      const tg = others.slice().sort((a, b) => (threat(s, b) - claimed(s, b.id, 'contessa') * 9 + (live(b).length === 1 ? 5 : 0))
        - (threat(s, a) - claimed(s, a.id, 'contessa') * 9 + (live(a).length === 1 ? 5 : 0)))[0];
      if (!(claimed(s, tg.id, 'contessa') >= 2 && R() < 0.7)) return { t: 'act', kind: 'assassin', target: tg.id };
    }
    if (hasC('duke')) return { t: 'act', kind: 'tax' };
    const rich = others.filter(p => p.coins >= 2 && !claimed(s, p.id, 'captain') && !claimed(s, p.id, 'ambassador')).sort((a, b) => b.coins - a.coins)[0]
      || others.filter(p => p.coins >= 2).sort((a, b) => b.coins - a.coins)[0];
    if (hasC('captain') && rich && R() < 0.85) return { t: 'act', kind: 'steal', target: rich.id };
    if (can('duke') && R() < (claimed(s, id, 'duke') ? 0.7 : 0.26)) return { t: 'act', kind: 'tax' };
    if (rich && can('captain') && R() < (claimed(s, id, 'captain') ? 0.5 : 0.1)) return { t: 'act', kind: 'steal', target: rich.id };
    if (hasC('ambassador') && (R() < 0.45 || live(me).every(c => VALUE[c.c] < 3.4))) return { t: 'act', kind: 'exchange' };
    const dukes = others.filter(p => claimed(s, p.id, 'duke')).length;
    if (R() < (dukes ? 0.22 : 0.62)) return { t: 'act', kind: 'aid' };
    return { t: 'act', kind: 'income' };
  }
  function botRespond(s, id, w) {
    const me = P(s, id), d = s.pend, R = s.rnd, mine = live(me).length;
    if (w.type === 'block') {
      const opts = ACTIONS[w.kind].block, own = opts.find(c => has(me, c));
      if (w.kind === 'aid') {
        if (own) return R() < 0.85 ? { t: 'block', card: 'duke' } : { t: 'allow' };
        return unseen(s, id, 'duke') > 0 && R() < 0.06 ? { t: 'block', card: 'duke' } : { t: 'allow' };
      }
      if (own) return { t: 'block', card: own };
      if (w.kind === 'assassin') return unseen(s, id, 'contessa') > 0 && R() < (mine === 1 ? 0.72 : 0.3) ? { t: 'block', card: 'contessa' } : { t: 'allow' };
      if (w.kind === 'steal') {
        const c = unseen(s, id, 'captain') >= unseen(s, id, 'ambassador') ? 'captain' : 'ambassador';
        return unseen(s, id, c) > 0 && R() < 0.2 ? { t: 'block', card: c } : { t: 'allow' };
      }
      return { t: 'allow' };
    }
    const u = unseen(s, id, w.card);
    if (u <= 0) return { t: 'chal' };                         // 남아 있을 수 없는 카드 → 확실한 거짓말
    let p = u === 1 ? 0.24 : 0.05;
    const vsMe = (w.type === 'chal' && d.target === id) || (w.type === 'bchal' && d.actor === id);
    if (vsMe) p += 0.12;
    if (w.type === 'chal' && w.kind === 'assassin' && d.target === id && !has(me, 'contessa') && mine === 1) p = 0.3;   // 이대로면 죽어요
    if (w.type === 'chal' && w.kind === 'tax' && P(s, w.claimant).coins >= 4) p += 0.05;                                // 쿠데타 직전이면 견제
    if (claimed(s, w.claimant, w.card) >= 2) p *= 0.55;
    if (mine === 1 && !(w.kind === 'assassin' && d.target === id)) p *= 0.45;
    return R() < p ? { t: 'chal' } : { t: 'allow' };
  }
  function botLose(s, id) {
    const p = P(s, id);
    let best = -1, bv = Infinity;
    p.cards.forEach((c, i) => { if (!c.dead) { const v = VALUE[c.c] + (c.c === 'assassin' && p.coins >= 3 ? 0.6 : 0); if (v < bv) { bv = v; best = i; } } });
    return best;
  }
  function botKeep(s, id) {
    const p = P(s, id), ex = s.pend.ex, need = live(p).length;
    let best = null;
    const score = idx => { const seen = {}; return idx.reduce((a, i) => { const c = ex[i], v = VALUE[c] * (seen[c] ? 0.45 : 1); seen[c] = 1; return a + v; }, 0) + s.rnd() * 0.3; };
    if (need === 1) ex.forEach((_, i) => { const sc = score([i]); if (!best || sc > best.sc) best = { idx: [i], sc }; });
    else for (let i = 0; i < ex.length; i++) for (let j = i + 1; j < ex.length; j++) { const sc = score([i, j]); if (!best || sc > best.sc) best = { idx: [i, j], sc }; }
    return best ? best.idx : ex.slice(0, need).map((_, i) => i);
  }
  function ai(s, id) {
    if (s.phase === 'act') return botAction(s, id);
    if (s.phase === 'window') return (s.win && s.win.plan[id]) || botRespond(s, id, s.win);
    if (s.phase === 'lose') return { t: 'lose', idx: botLose(s, id) };
    if (s.phase === 'exchange') return { t: 'keep', idx: botKeep(s, id) };
    return null;
  }
  function auto(s, id) {       // 시간 초과: 소득(10코인이면 쿠데타) · 허용 · 덜 중요한 카드
    if (s.phase === 'act') return P(s, id).coins >= 10 ? botAction(s, id) : { t: 'act', kind: 'income' };
    if (s.phase === 'window') return { t: 'allow' };
    return ai(s, id);
  }

  function pending(s) {
    if (s.over) return [];
    if (s.phase === 'act') return [cur(s).id];
    if (s.phase === 'window') return pendingIds(s);
    if (s.phase === 'lose') return s.losses.length ? [s.losses[0].id] : [];
    if (s.phase === 'exchange') return s.pend ? [s.pend.actor] : [];
    return [];
  }
  function view(s, viewer) {
    const d = s.pend, w = s.win, me = P(s, viewer), wait = pending(s);
    let ask = null;
    if (me && !s.over && wait.includes(viewer)) {
      if (s.phase === 'act') ask = { k: 'act', must: me.coins >= 10 };
      else if (s.phase === 'window') ask = { k: w.type, opts: w.type === 'block' ? ACTIONS[w.kind].block : null };
      else if (s.phase === 'lose') ask = { k: 'lose', why: s.losses[0].why };
      else if (s.phase === 'exchange') ask = { k: 'exchange', cards: d.ex.slice(), need: live(me).length };
    }
    return {
      players: s.players.map(p => ({ id: p.id, name: p.name, coins: p.coins, out: !alive(p),
        cards: p.cards.map(c => ({ c: c.dead || p.id === viewer || s.over ? c.c : null, dead: c.dead, fresh: !!c.fresh && p.id === viewer })) })),
      deck: s.deck.length, turnId: s.over ? null : cur(s).id, phase: s.phase, turnN: s.turnN,
      pend: d ? { kind: d.kind, actor: d.actor, target: d.target, claim: d.claim, block: d.block || null } : null,
      win: w ? { type: w.type, claimant: w.claimant, card: w.card, kind: w.kind, n: w.n, responders: w.responders.slice(), passed: w.passed.slice() } : null,
      losing: s.phase === 'lose' && s.losses.length ? s.losses[0].id : null, wait,
      ask, proof: s.proof, over: s.over, winner: s.winner, msg: s.msg, log: s.log.slice(-16), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const order = [...new Set([s.winner].concat(s.out.slice().reverse(), s.players.map(p => p.id)))];
    const w = P(s, s.winner);
    return {
      title: `${w.name} 님이 궁정을 차지했어요!`, subtitle: '마지막까지 카드를 지킨 사람이 승리',
      ranking: order.map((id, i) => ({ id, value: i === 0 ? `남은 카드 ${live(P(s, id)).length}장 · 코인 ${P(s, id).coins}개` : `탈락 · ${P(s, id).cards.map(c => NAME[c.c]).join(' · ')}` })),
    };
  }
  return {
    meta: { name: '궁정 음모', min: 2, max: 6, bots: true, turnSec: 40, botDelay: [900, 1600],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명'], [4, '4명'], [5, '5명']] }] },
    CARDS, NAME, ACTIONS, unseen,
    setup, act, ai, auto, pending, view, result,
    deadline: s => (s.phase === 'window' && s.win && s.win.end ? s.win.end : null),
    timeup: s => { if (s.phase === 'window' && s.win) { s.win.passed = s.win.responders.slice(); advance(s); } },
  };
});
