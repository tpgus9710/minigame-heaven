/* =====================================================================
 *  ⭐ 황야의 총잡이 규칙 (뱅! 기본판 방식) — 4~7명, 카드 80장, 인물 16명, 역할 4종
 *  역할: 보안관(공개) · 부관 · 무법자 · 배신자 — 보안관 팀은 무법자와 배신자를 모두, 무법자는 보안관을,
 *        배신자는 혼자 끝까지 살아남아야 이겨요.
 *  차례: (다이너마이트 · 감옥 판정) → 카드 2장 가져오기 → 카드 내기(뱅!은 한 번) → 생명력보다 많은 카드 버리기
 *  거리: 살아 있는 사람끼리 둘러앉은 자리로 가까운 쪽. 야생마 +1, 조준경 -1. 뱅!은 무기 사정거리 안에만.
 *  "카드 펼치기!": 더미 맨 위 카드를 펼쳐 무늬 확인 (술통 · 감옥은 하트면 성공, 다이너마이트는 ♠2~9면 펑)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.BangCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;

  /* ── 카드 ── kind: brown(바로 쓰고 버림) · blue(앞에 내려놓음) · gun(무기, 하나만) */
  const CARDS = {
    bang: { name: '뱅!', type: 'brown', icon: 'target', text: '사정거리 안의 한 명을 쏴요. 빗나감!이 없으면 생명력 -1. (차례에 한 번)' },
    missed: { name: '빗나감!', type: 'brown', icon: 'shield', text: '나를 노린 뱅! · 기관총을 한 발 피해요.' },
    beer: { name: '맥주', type: 'brown', icon: 'beer', text: '생명력 +1. 쓰러지기 직전에도 쓸 수 있어요. (둘만 남으면 효과 없음)' },
    panic: { name: '강탈!', type: 'brown', icon: 'hand-grab', text: '거리 1인 사람의 카드 한 장을 빼앗아요.' },
    catbalou: { name: '훼방!', type: 'brown', icon: 'trash', text: '거리와 상관없이 아무나 카드 한 장을 버리게 해요.' },
    stagecoach: { name: '역마차', type: 'brown', icon: 'road', text: '카드 2장을 가져와요.' },
    wells: { name: '금고 마차', type: 'brown', icon: 'building-bank', text: '카드 3장을 가져와요.' },
    gatling: { name: '기관총', type: 'brown', icon: 'bolt', text: '나를 뺀 모두에게 뱅! (빗나감!으로 피할 수 있어요)' },
    duel: { name: '결투', type: 'brown', icon: 'swords', text: '아무나 지목! 상대부터 번갈아 뱅!을 버리고, 못 버린 쪽이 생명력 -1.' },
    indians: { name: '습격!', type: 'brown', icon: 'flame', text: '나를 뺀 모두가 뱅!을 한 장 버리지 못하면 생명력 -1.' },
    store: { name: '잡화점', type: 'brown', icon: 'building-store', text: '살아 있는 사람 수만큼 카드를 펼치고, 나부터 한 장씩 골라 가져요.' },
    saloon: { name: '주점', type: 'brown', icon: 'glass-full', text: '살아 있는 모두 생명력 +1.' },
    barrel: { name: '술통', type: 'blue', icon: 'barrel', text: '뱅!을 맞을 때 카드 펼치기! 하트면 빗나가요.' },
    scope: { name: '조준경', type: 'blue', icon: 'focus-2', text: '내가 남을 볼 때 거리 -1.' },
    mustang: { name: '야생마', type: 'blue', icon: 'horse', text: '남이 나를 볼 때 거리 +1.' },
    jail: { name: '감옥', type: 'blue', icon: 'lock', text: '보안관이 아닌 사람 앞에 놓아요. 차례 시작 때 하트가 아니면 차례를 건너뛰어요.' },
    dynamite: { name: '다이너마이트', type: 'blue', icon: 'bomb', text: '내 앞에 놓아요. 차례 시작 때 ♠2~9면 펑! 생명력 -3, 아니면 다음 사람에게.' },
    volcanic: { name: '연발 권총', type: 'gun', range: 1, icon: 'crosshair', text: '사정거리 1 · 뱅!을 원하는 만큼 쓸 수 있어요.' },
    schofield: { name: '리볼버', type: 'gun', range: 2, icon: 'crosshair', text: '사정거리 2' },
    remington: { name: '레버 소총', type: 'gun', range: 3, icon: 'crosshair', text: '사정거리 3' },
    carabine: { name: '카빈', type: 'gun', range: 4, icon: 'crosshair', text: '사정거리 4' },
    winchester: { name: '저격 소총', type: 'gun', range: 5, icon: 'crosshair', text: '사정거리 5' },
  };
  // 무늬(S♠ H♥ D♦ C♣)와 숫자(1=A … 11=J, 12=Q, 13=K) — 기본판 구성 80장
  const DECK = {
    bang: 'H12 H13 H1 D2 D3 D4 D5 D6 D7 D8 D9 D10 D11 D12 D13 D1 C2 C3 C4 C5 C6 C7 C8 C9 S1',
    missed: 'S2 S3 S4 S5 S6 S7 S8 C10 C11 C12 C13 C1',
    beer: 'H6 H7 H8 H9 H10 H11', panic: 'D8 H11 H12 H1', catbalou: 'D9 D10 D11 H13',
    stagecoach: 'S9 S9', wells: 'H3', gatling: 'H10', duel: 'D12 C8 S11', indians: 'D13 D1', store: 'C9 S12', saloon: 'H5',
    barrel: 'S12 S13', scope: 'S1', mustang: 'H8 H9', jail: 'H4 S10 S11', dynamite: 'H2',
    volcanic: 'C10 S10', schofield: 'C11 C12 S13', remington: 'C13', carabine: 'C1', winchester: 'S8',
  };
  /* ── 인물 16명 (이름은 이 게임에서 새로 지었어요) ── */
  const CHARS = {
    kid: { name: '속사 키드', hp: 4, text: '뱅!을 원하는 만큼 쓸 수 있어요.' },
    may: { name: '변칙의 메이', hp: 4, text: '뱅!을 빗나감!으로, 빗나감!을 뱅!으로 쓸 수 있어요.' },
    kyle: { name: '눈썰미 카일', hp: 4, text: '카드를 가져올 때 맨 위 3장을 보고 2장을 골라요.' },
    burke: { name: '오뚝이 버크', hp: 4, text: '생명력을 1 잃을 때마다 카드를 한 장 가져와요.' },
    doc: { name: '약초꾼 닥', hp: 4, text: '카드 2장을 버리고 생명력을 1 회복할 수 있어요.' },
    lou: { name: '네잎클로버 루', hp: 4, text: '카드 펼치기!를 할 때 2장을 펼쳐 좋은 쪽을 골라요.' },
    joe: { name: '방탄조끼 조', hp: 4, text: '언제나 술통이 있는 것처럼 뱅!을 피할 수 있어요.' },
    lenny: { name: '도박사 레니', hp: 4, text: '두 번째로 가져온 카드가 하트나 다이아면 한 장 더 가져와요.' },
    lucy: { name: '바쁜 손 루시', hp: 4, text: '손에 카드가 하나도 없으면 바로 한 장 가져와요.' },
    finn: { name: '소매치기 핀', hp: 4, text: '첫 번째 카드를 다른 사람 손에서 몰래 가져올 수 있어요.' },
    mort: { name: '장의사 모트', hp: 4, text: '누군가 쓰러지면 그 사람의 카드를 모두 가져가요.' },
    pepe: { name: '고물상 페페', hp: 4, text: '첫 번째 카드를 버린 카드 더미 맨 위에서 가져올 수 있어요.' },
    bruno: { name: '무쇠주먹 브루노', hp: 4, text: '내 뱅!을 피하려면 빗나감!이 2장 필요해요.' },
    laura: { name: '매의 눈 로라', hp: 4, text: '언제나 조준경이 있는 것처럼 남을 볼 때 거리 -1.' },
    ray: { name: '바람처럼 레이', hp: 3, text: '언제나 야생마가 있는 것처럼 남이 나를 볼 때 거리 +1.' },
    carlo: { name: '앙갚음 카를로', hp: 3, text: '다른 사람 카드 때문에 생명력을 잃으면 그 사람 손에서 카드를 한 장 빼앗아요.' },
  };
  const ROLES = {
    sheriff: { name: '보안관', goal: '무법자와 배신자를 모두 쓰러뜨리세요.' },
    deputy: { name: '부관', goal: '보안관을 지키고 무법자와 배신자를 쓰러뜨리세요.' },
    outlaw: { name: '무법자', goal: '보안관을 쓰러뜨리세요!' },
    renegade: { name: '배신자', goal: '다른 사람을 모두 쓰러뜨리고 마지막에 보안관과 1:1로 이기세요.' },
  };
  const ROLE_SETS = { 4: ['sheriff', 'renegade', 'outlaw', 'outlaw'], 5: ['sheriff', 'renegade', 'outlaw', 'outlaw', 'deputy'],
    6: ['sheriff', 'renegade', 'outlaw', 'outlaw', 'outlaw', 'deputy'], 7: ['sheriff', 'renegade', 'outlaw', 'outlaw', 'outlaw', 'deputy', 'deputy'] };
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANK = r => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
  const cardLabel = c => `${CARDS[c.k].name}(${SUIT[c.s]}${RANK(c.r)})`;

  const P = (s, id) => s.players.find(p => p.id === id);
  const cur = s => s.players[s.turn];
  const alive = s => s.players.filter(p => p.alive);
  const has = (p, k) => p.inPlay.some(c => c.k === k);
  const gun = p => p.inPlay.find(c => CARDS[c.k].type === 'gun');
  const range = p => (gun(p) ? CARDS[gun(p).k].range : 1);
  const unlimited = p => p.char === 'kid' || (gun(p) && gun(p).k === 'volcanic');

  /** 거리: players 는 자리 순서, p.alive · p.inPlay · p.char 만 써요 (화면에서도 같이 씀) */
  function distance(players, aId, bId) {
    const live = players.filter(p => p.alive), n = live.length;
    const i = live.findIndex(p => p.id === aId), j = live.findIndex(p => p.id === bId);
    if (i < 0 || j < 0 || i === j) return 0;
    const a = live[i], b = live[j];
    let d = Math.min(Math.abs(i - j), n - Math.abs(i - j));
    if (b.inPlay.some(c => c.k === 'mustang')) d++;
    if (b.char === 'ray') d++;
    if (a.inPlay.some(c => c.k === 'scope')) d--;
    if (a.char === 'laura') d--;
    return Math.max(1, d);
  }

  /* ── 더미 ── */
  function draw(s) {
    if (!s.deck.length) {
      if (!s.discard.length) return null;
      s.deck = shuffle(s.discard, s.rnd); s.discard = [];
      note(s, '카드 더미를 다 써서 버린 카드를 섞어 새 더미를 만들었어요.', 'info');
    }
    return s.deck.pop();
  }
  const gain = (p, c) => { if (c) p.hand.push(c); };
  const drawN = (s, p, n) => { for (let i = 0; i < n; i++) gain(p, draw(s)); };
  const toDiscard = (s, c) => { if (c) s.discard.push(c); };
  const fromHand = (p, id) => { const i = p.hand.findIndex(c => c.id === id); return i < 0 ? null : p.hand.splice(i, 1)[0]; };
  const takeRandom = (s, p) => (p.hand.length ? p.hand.splice(Math.floor(s.rnd() * p.hand.length), 1)[0] : null);
  function note(s, text, kind = '', extra = {}) { log(s, Object.assign({ text, kind }, extra)); s.msg = text; }
  const nm = p => p.name;
  function hostile(s, a, b, w = 1) { if (!a || !b || a === b) return; const h = s.host[a.id] || (s.host[a.id] = {}); h[b.id] = (h[b.id] || 0) + w; }

  /** 카드 펼치기! good(카드)가 참이면 성공. 루는 2장을 펼쳐 좋은 쪽을 골라요 */
  function check(s, p, good, why) {
    const flips = [];
    for (let i = 0; i < (p.char === 'lou' ? 2 : 1); i++) { const c = draw(s); if (c) { flips.push(c); s.discard.push(c); } }
    const pick = flips.find(good) || flips[0];
    const ok = !!(pick && good(pick));
    note(s, `${nm(p)} 님 ${why} 카드 펼치기! ${flips.map(c => SUIT[c.s] + RANK(c.r)).join(' · ')} → ${ok ? '성공' : '실패'}`, ok ? 'good' : 'bad', { fx: 'check', id: p.id, cards: flips.map(c => ({ s: c.s, r: c.r })), ok });
    return ok;
  }

  /* ── 피해 · 쓰러짐 · 승리 ── */
  function damage(s, t, n, by, why) {
    if (!t.alive || s.over) return;
    t.hp -= n;
    note(s, `${nm(t)} 님 생명력 -${n}${why ? ` (${why})` : ''}`, 'bad', { fx: 'hit', id: t.id, n });
    if (t.hp <= 0) rescue(s, t);
    if (t.hp <= 0) return kill(s, t, by);
    if (t.char === 'burke') { drawN(s, t, n); note(s, `${nm(t)} 님 능력: 카드 ${n}장을 가져와요.`, 'info'); }
    if (t.char === 'carlo' && by && by !== t && by.alive) {
      let got = 0;
      for (let i = 0; i < n; i++) { const c = takeRandom(s, by); if (c) { t.hand.push(c); got++; } }
      if (got) note(s, `${nm(t)} 님 능력: ${nm(by)} 님 손에서 카드 ${got}장을 빼앗아요!`, 'info');
    }
  }
  function rescue(s, t) {
    if (alive(s).length > 2) {
      while (t.hp <= 0) {
        const b = t.hand.find(c => c.k === 'beer');
        if (!b) break;
        toDiscard(s, fromHand(t, b.id)); t.hp++;
        note(s, `${nm(t)} 님이 쓰러지기 직전 맥주를 마셨어요! (생명력 ${t.hp})`, 'good', { fx: 'heal', id: t.id });
      }
    }
    if (t.char === 'doc') {
      while (t.hp <= 0 && t.hand.length >= 2) {
        const two = t.hand.slice().sort((a, b) => worth(t, a) - worth(t, b)).slice(0, 2);
        two.forEach(c => toDiscard(s, fromHand(t, c.id))); t.hp++;
        note(s, `${nm(t)} 님 능력: 카드 2장을 버리고 버텨요! (생명력 ${t.hp})`, 'good', { fx: 'heal', id: t.id });
      }
    }
  }
  function kill(s, t, by) {
    t.alive = false; t.hp = 0;
    note(s, `${nm(t)} 님이 쓰러졌어요… 정체는 ${ROLES[t.role].name}!`, 'dead', { fx: 'dead', id: t.id });
    const cards = t.hand.splice(0).concat(t.inPlay.splice(0));
    const mort = alive(s).find(p => p.char === 'mort');
    if (mort && cards.length) { mort.hand.push(...cards); note(s, `${nm(mort)} 님 능력: ${nm(t)} 님의 카드 ${cards.length}장을 모두 가져가요.`, 'info'); }
    else cards.forEach(c => toDiscard(s, c));
    s.deaths.push(t.id);
    if (checkWin(s)) return;
    if (by && by.alive && t.role === 'outlaw') { drawN(s, by, 3); note(s, `${nm(by)} 님이 무법자를 쓰러뜨려 현상금으로 카드 3장을 받아요!`, 'good'); }
    if (by && by.alive && by.role === 'sheriff' && t.role === 'deputy') {
      const lost = by.hand.splice(0).concat(by.inPlay.splice(0));
      lost.forEach(c => toDiscard(s, c));
      note(s, `보안관이 부관을 쏘다니! 벌로 보안관은 카드를 모두 버려요.`, 'bad');
    }
  }
  function checkWin(s) {
    if (s.over) return true;
    const live = alive(s), sheriff = s.players.find(p => p.role === 'sheriff');
    let win = null;
    if (!sheriff.alive) win = live.length === 1 && live[0].role === 'renegade' ? 'renegade' : 'outlaw';
    else if (!live.some(p => p.role === 'outlaw' || p.role === 'renegade')) win = 'sheriff';
    if (!win) return false;
    s.over = true; s.winRole = win; s.wait = null; s.queue = []; s.duel = null; s.store = null;
    s.winners = s.players.filter(p => (win === 'sheriff' ? p.role === 'sheriff' || p.role === 'deputy' : win === 'outlaw' ? p.role === 'outlaw' : p.role === 'renegade' && p.alive)).map(p => p.id);
    note(s, win === 'sheriff' ? '보안관 팀 승리! 마을에 평화가 찾아왔어요.' : win === 'outlaw' ? '무법자 승리! 보안관이 쓰러졌어요.' : '배신자 승리! 모두를 속이고 홀로 살아남았어요.', 'win');
    return true;
  }

  /* ── 차례 진행 ── */
  function arm(s, sec) { s.dlAt = Date.now() + sec * 1000; }
  function wait(s, kind, who, extra = {}, sec = 15) { s.wait = Object.assign({ kind, who }, extra); arm(s, s.afk && s.afk[who] ? Math.min(sec, 5) : sec); }
  function beginTurn(s) {
    if (s.over) return;
    const p = cur(s);
    s.turnNo++; s.bangs = 0; s.queue = []; s.duel = null; s.store = null; s.attack = null;
    note(s, `${nm(p)} 님 차례예요.`, 'turn', { fx: 'turn', id: p.id });
    const dyn = p.inPlay.find(c => c.k === 'dynamite');
    if (dyn) {
      const safe = check(s, p, c => !(c.s === 'S' && c.r >= 2 && c.r <= 9), '다이너마이트');
      p.inPlay.splice(p.inPlay.indexOf(dyn), 1);
      if (!safe) {
        toDiscard(s, dyn);
        note(s, `펑!! 다이너마이트가 ${nm(p)} 님 앞에서 터졌어요!`, 'bad', { fx: 'boom', id: p.id });
        damage(s, p, 3, null, '다이너마이트');
        if (s.over) return;
        if (!p.alive) return endTurn(s);
      } else {
        const live = alive(s), nx = live[(live.indexOf(p) + 1) % live.length];
        nx.inPlay.push(dyn);
        note(s, `다이너마이트가 ${nm(nx)} 님에게 넘어갔어요.`, 'info');
      }
    }
    const jail = p.inPlay.find(c => c.k === 'jail');
    if (jail) {
      const free = check(s, p, c => c.s === 'H', '감옥');
      p.inPlay.splice(p.inPlay.indexOf(jail), 1); toDiscard(s, jail);
      if (!free) { note(s, `${nm(p)} 님은 감옥에서 나오지 못해 이번 차례를 건너뛰어요.`, 'bad'); return endTurn(s); }
      note(s, `${nm(p)} 님이 감옥을 탈출했어요!`, 'good');
    }
    if (p.char === 'kyle') {
      const three = [draw(s), draw(s), draw(s)].filter(Boolean);
      if (three.length <= 2) { three.forEach(c => gain(p, c)); return toPlay(s); }
      return wait(s, 'kyle', p.id, { cards: three }, 20);
    }
    if ((p.char === 'finn' && alive(s).some(q => q !== p && q.hand.length)) || (p.char === 'pepe' && s.discard.length)) return wait(s, 'draw', p.id, {}, 20);
    drawPhase(s, p, 'deck');
  }
  function drawPhase(s, p, from) {
    let first = null;
    if (from === 'discard' && p.char === 'pepe' && s.discard.length) { first = s.discard.pop(); note(s, `${nm(p)} 님이 버린 카드 더미에서 ${cardLabel(first)}을(를) 가져왔어요.`, 'info'); }
    else if (p.char === 'finn' && from && from !== 'deck') {
      const t = P(s, from);
      if (t && t.alive && t !== p && t.hand.length) { first = takeRandom(s, t); hostile(s, p, t, 0.5); note(s, `${nm(p)} 님이 ${nm(t)} 님 손에서 카드 한 장을 슬쩍했어요!`, 'info'); }
    }
    gain(p, first || draw(s));
    const second = draw(s);
    gain(p, second);
    if (p.char === 'lenny' && second) {
      const red = second.s === 'H' || second.s === 'D';
      note(s, `${nm(p)} 님 능력: 두 번째 카드 ${SUIT[second.s]}${RANK(second.r)} 공개${red ? ' → 한 장 더!' : ''}`, 'info');
      if (red) gain(p, draw(s));
    }
    toPlay(s);
  }
  function toPlay(s) {
    if (s.over) return;
    const p = cur(s);
    if (!p.alive) return endTurn(s);
    wait(s, 'play', p.id, {}, 50);
  }
  function endTurn(s) {
    if (s.over) return;
    const live = alive(s);
    let i = s.turn;
    do { i = (i + 1) % s.players.length; } while (!s.players[i].alive);
    if (!live.length) return;
    s.turn = i;
    beginTurn(s);
  }

  /* ── 공격과 반응 ── */
  const missLike = p => p.hand.filter(c => c.k === 'missed' || (p.char === 'may' && c.k === 'bang'));
  const bangLike = p => p.hand.filter(c => c.k === 'bang' || (p.char === 'may' && c.k === 'missed'));
  function attack(s, from, targets, src) { s.attack = { from: from.id, src }; s.queue = targets.map(t => t.id); nextReaction(s); }
  function nextReaction(s) {
    while (!s.over && s.queue.length) {
      const t = P(s, s.queue.shift());
      if (!t.alive) continue;
      if (react(s, t)) return;
    }
    if (s.over) return;
    s.attack = null;
    toPlay(s);
  }
  /** 반응 준비 — 사람이 골라야 하면 true (기다림) */
  function react(s, t) {
    const a = s.attack, from = P(s, a.from);
    if (a.src === 'bang' || a.src === 'gatling') {
      let need = a.src === 'bang' && from.char === 'bruno' ? 2 : 1;
      if (has(t, 'barrel') && check(s, t, c => c.s === 'H', '술통')) need--;
      if (need > 0 && t.char === 'joe' && check(s, t, c => c.s === 'H', '방탄조끼')) need--;
      if (need <= 0) { note(s, `${nm(t)} 님이 총알을 피했어요!`, 'good', { fx: 'dodge', id: t.id }); return false; }
      const can = missLike(t).length >= need;
      if (!can && s.solo && !t.bot) { damage(s, t, 1, from, a.src === 'bang' ? '뱅!' : '기관총'); return false; }
      wait(s, 'respond', t.id, { src: a.src, from: from.id, need }, can ? 15 : 3);
      return true;
    }
    if (a.src === 'indians') {
      const can = bangLike(t).length > 0;
      if (!can && s.solo && !t.bot) { damage(s, t, 1, from, '습격!'); return false; }
      wait(s, 'respond', t.id, { src: 'indians', from: from.id, need: 1 }, can ? 15 : 3);
      return true;
    }
    return false;
  }
  function duelStep(s) {
    const d = s.duel, who = P(s, d.turn), other = P(s, d.turn === d.a ? d.b : d.a);
    if (s.over || !who.alive || !other.alive) { s.duel = null; return nextReaction(s); }
    const can = bangLike(who).length > 0;
    if (!can && s.solo && !who.bot) {
      note(s, `${nm(who)} 님이 더 낼 뱅!이 없어요. 결투 패배!`, 'bad');
      s.duel = null;
      damage(s, who, 1, who.id === d.a ? null : P(s, d.a), '결투');
      return nextReaction(s);
    }
    wait(s, 'respond', who.id, { src: 'duel', from: other.id, need: 1 }, can ? 15 : 3);
  }
  function actRespond(s, p, a) {
    const w = s.wait, from = P(s, w.from);
    if (a.t === 'take') {
      if (w.src === 'duel') {
        const d = s.duel;
        note(s, bangLike(p).length ? `${nm(p)} 님이 결투를 포기했어요.` : `${nm(p)} 님이 더 낼 뱅!이 없어요. 결투 패배!`, 'bad');
        s.duel = null; damage(s, p, 1, d && p.id === d.a ? null : P(s, d ? d.a : w.from), '결투');
        return void nextReaction(s);
      }
      damage(s, p, 1, from, w.src === 'bang' ? '뱅!' : w.src === 'gatling' ? '기관총' : '습격!');
      return void nextReaction(s);
    }
    if (a.t !== 'cards' || !Array.isArray(a.ids)) return '낼 카드를 고르거나 맞기를 골라 주세요.';
    const ids = [...new Set(a.ids)];
    const ok = w.src === 'bang' || w.src === 'gatling' ? missLike(p) : bangLike(p);
    if (ids.length !== w.need) return `카드 ${w.need}장을 골라 주세요.`;
    if (!ids.every(id => ok.some(c => c.id === id))) return w.src === 'bang' || w.src === 'gatling' ? '빗나감!으로만 피할 수 있어요.' : '뱅!을 버려야 해요.';
    ids.forEach(id => toDiscard(s, fromHand(p, id)));
    if (w.src === 'duel') {
      note(s, `${nm(p)} 님이 결투에서 뱅!을 쐈어요!`, 'info', { fx: 'shot', from: p.id, to: w.from });
      s.duel.turn = w.from;
      return void duelStep(s);
    }
    note(s, w.src === 'indians' ? `${nm(p)} 님이 뱅!으로 습격을 막았어요.` : `${nm(p)} 님 빗나감!${ids.length > 1 ? ` ×${ids.length}` : ''}`, 'good', { fx: 'dodge', id: p.id });
    nextReaction(s);
  }

  /* ── 카드 내기 ── */
  /** 낼 수 있는지 확인만 (바꾸지 않음) → 오류 문자열 또는 null */
  function canPlay(s, p, a) {
    const c = p.hand.find(x => x.id === a.card);
    if (!c) return '손에 없는 카드예요.';
    const k = c.k === 'missed' && p.char === 'may' ? 'bang' : c.k;
    const t = a.target != null ? P(s, a.target) : null;
    const needT = ['bang', 'panic', 'catbalou', 'duel', 'jail'].includes(k);
    if (needT && (!t || !t.alive)) return '대상을 골라 주세요.';
    if (needT && t === p && !(k === 'jail' || (k === 'panic' && a.pick != null && a.pick !== 'hand'))) return '대상을 골라 주세요.';
    switch (k) {
      case 'bang':
        if (s.bangs >= 1 && !unlimited(p)) return '뱅!은 차례에 한 번만 쓸 수 있어요.';
        if (distance(s.players, p.id, t.id) > range(p)) return `사정거리(${range(p)}) 밖이에요. (거리 ${distance(s.players, p.id, t.id)})`;
        return null;
      case 'missed': return '빗나감!은 총을 맞을 때만 써요.';
      case 'beer': return null;                       // 효과가 없을 때도 낼 수는 있어요 (손을 비우는 용도 등)
      case 'panic': case 'catbalou':
        if (k === 'panic' && distance(s.players, p.id, t.id) > 1) return '강탈!은 거리 1인 사람에게만 쓸 수 있어요.';
        if (!t.hand.length && !t.inPlay.length) return '그 사람은 카드가 없어요.';
        if (a.pick != null && a.pick !== 'hand' && !t.inPlay.some(x => x.id === a.pick)) return '그 카드는 없어요.';
        if (a.pick === 'hand' && !t.hand.length) return '그 사람은 손에 카드가 없어요.';
        return null;
      case 'jail':
        if (t.role === 'sheriff') return '보안관은 감옥에 넣을 수 없어요.';
        if (has(t, 'jail')) return '이미 감옥에 있어요.';
        return null;
      case 'dynamite': return has(p, 'dynamite') ? '이미 다이너마이트가 있어요.' : null;
      case 'barrel': case 'scope': case 'mustang': return has(p, k) ? '같은 카드는 앞에 한 장만 놓을 수 있어요.' : null;
      default: return null;
    }
  }
  function actPlay(s, p, a) {
    if (a.t === 'end') {
      const over = p.hand.length - Math.max(0, p.hp);
      if (over > 0) { wait(s, 'discard', p.id, { n: over }, 25); return; }
      note(s, `${nm(p)} 님이 차례를 마쳤어요.`, 'info');
      return void endTurn(s);
    }
    if (a.t === 'heal') {
      if (p.char !== 'doc') return '이 능력은 약초꾼 닥만 쓸 수 있어요.';
      if (p.hp >= p.max) return '생명력이 가득 찼어요.';
      const ids = Array.isArray(a.ids) ? [...new Set(a.ids)] : [];
      if (ids.length !== 2 || !ids.every(id => p.hand.some(c => c.id === id))) return '버릴 카드 2장을 골라 주세요.';
      ids.forEach(id => toDiscard(s, fromHand(p, id))); p.hp++;
      note(s, `${nm(p)} 님 능력: 카드 2장을 버리고 생명력 +1`, 'good', { fx: 'heal', id: p.id });
      return;
    }
    if (a.t !== 'play') return '카드를 내거나 차례 끝내기를 눌러 주세요.';
    const err = canPlay(s, p, a);
    if (err) return err;
    const c = fromHand(p, a.card), k = c.k === 'missed' && p.char === 'may' ? 'bang' : c.k;
    const t = a.target != null ? P(s, a.target) : null, info = CARDS[c.k];
    if (info.type !== 'brown' && k !== 'bang') {                 // 앞에 내려놓는 카드
      if (info.type === 'gun') {
        const old = gun(p);
        if (old) { p.inPlay.splice(p.inPlay.indexOf(old), 1); toDiscard(s, old); }
        p.inPlay.push(c);
        note(s, `${nm(p)} 님이 ${info.name}을(를) 들었어요. (사정거리 ${info.range})`, 'info', { fx: 'equip', id: p.id });
      } else if (k === 'jail') {
        t.inPlay.push(c); hostile(s, p, t, 1.5);
        note(s, t === p ? `${nm(p)} 님이 스스로 감옥에 들어갔어요!` : `${nm(p)} 님이 ${nm(t)} 님을 감옥에 넣었어요!`, 'bad', { fx: 'jail', from: p.id, to: t.id });
      } else {
        p.inPlay.push(c);
        note(s, `${nm(p)} 님이 ${info.name}을(를) 내려놓았어요.`, 'info', { fx: 'equip', id: p.id });
      }
      return;
    }
    toDiscard(s, c);
    switch (k) {
      case 'bang':
        s.bangs++; hostile(s, p, t, 2);
        note(s, `${nm(p)} 님이 ${nm(t)} 님에게 뱅!`, 'shot', { fx: 'shot', from: p.id, to: t.id });
        return void attack(s, p, [t], 'bang');
      case 'beer':
        if (alive(s).length <= 2 || p.hp >= p.max) { note(s, `${nm(p)} 님이 맥주를 마셨지만 효과가 없어요.${alive(s).length <= 2 ? ' (둘만 남으면 효과 없음)' : ''}`, 'info'); return; }
        p.hp++; note(s, `${nm(p)} 님이 맥주를 마셨어요. (생명력 ${p.hp})`, 'good', { fx: 'heal', id: p.id }); return;
      case 'saloon':
        alive(s).forEach(q => { q.hp = Math.min(q.max, q.hp + 1); });
        note(s, `${nm(p)} 님이 주점에서 한턱! 모두 생명력 +1`, 'good', { fx: 'saloon' }); return;
      case 'stagecoach': drawN(s, p, 2); note(s, `${nm(p)} 님 역마차: 카드 2장!`, 'info'); return;
      case 'wells': drawN(s, p, 3); note(s, `${nm(p)} 님 금고 마차: 카드 3장!`, 'info'); return;
      case 'panic': case 'catbalou': {
        let got;
        if (a.pick != null && a.pick !== 'hand') { const i = t.inPlay.findIndex(x => x.id === a.pick); got = t.inPlay.splice(i, 1)[0]; }
        else got = t.hand.length ? takeRandom(s, t) : t.inPlay.splice(Math.floor(s.rnd() * t.inPlay.length), 1)[0];
        const bad = got && (got.k === 'jail' || got.k === 'dynamite');
        if (!bad) hostile(s, p, t, 1);
        const what = a.pick != null && a.pick !== 'hand' ? CARDS[got.k].name : '손에 든 카드';
        if (k === 'panic') { p.hand.push(got); note(s, t === p ? `${nm(p)} 님이 앞에 놓인 ${what}을(를) 손으로 다시 가져왔어요.` : `${nm(p)} 님이 ${nm(t)} 님의 ${what}을(를) 빼앗았어요!`, 'info', { fx: 'steal', from: t.id, to: p.id }); }
        else { toDiscard(s, got); note(s, `${nm(p)} 님 훼방! ${nm(t)} 님의 ${what === '손에 든 카드' ? cardLabel(got) : what}이(가) 버려졌어요.`, 'info', { fx: 'trash', id: t.id }); }
        return;
      }
      case 'duel':
        hostile(s, p, t, 2);
        note(s, `${nm(p)} 님이 ${nm(t)} 님에게 결투를 신청했어요!`, 'shot', { fx: 'duel', from: p.id, to: t.id });
        s.attack = { from: p.id, src: 'duel' }; s.queue = []; s.duel = { a: p.id, b: t.id, turn: t.id };
        return void duelStep(s);
      case 'gatling': {
        const others = order(s, p).slice(1);
        others.forEach(q => hostile(s, p, q, 0.5));
        note(s, `${nm(p)} 님이 기관총을 난사해요! 두두두두!`, 'shot', { fx: 'gatling', from: p.id });
        return void attack(s, p, others, 'gatling');
      }
      case 'indians': {
        const others = order(s, p).slice(1);
        others.forEach(q => hostile(s, p, q, 0.5));
        note(s, `${nm(p)} 님의 습격! 모두 뱅!을 한 장씩 버려야 해요.`, 'shot', { fx: 'indians', from: p.id });
        return void attack(s, p, others, 'indians');
      }
      case 'store': {
        const live = order(s, p);
        s.store = { cards: [], order: live.map(q => q.id) };
        for (let i = 0; i < live.length; i++) { const x = draw(s); if (x) s.store.cards.push(x); }
        note(s, `${nm(p)} 님이 잡화점을 열었어요! 차례로 한 장씩 골라요.`, 'info', { fx: 'store' });
        return void storeNext(s);
      }
      default: return;
    }
  }
  /** p 부터 자리 순서대로 살아 있는 사람 */
  function order(s, p) { const live = alive(s), i = live.indexOf(p); return live.slice(i).concat(live.slice(0, i)); }
  function storeNext(s) {
    const st = s.store;
    while (st.order.length && st.cards.length) {
      const q = P(s, st.order[0]);
      if (!q.alive) { st.order.shift(); continue; }
      if (st.cards.length === 1) { q.hand.push(st.cards.pop()); st.order.shift(); continue; }
      return wait(s, 'store', q.id, {}, 15);
    }
    st.cards.forEach(c => toDiscard(s, c));
    s.store = null;
    toPlay(s);
  }

  /* ── 행동 받기 ── */
  function act(s, id, a) {
    if (s.over) return '게임이 끝났어요.';
    if (!s.timing && s.afk) delete s.afk[id];          // 직접 움직이면 다시 넉넉한 시간
    const w = s.wait;
    if (!w || w.who !== id) return '지금은 내 차례가 아니에요.';
    const p = P(s, id);
    let err;
    if (w.kind === 'play') err = actPlay(s, p, a);
    else if (w.kind === 'respond') err = actRespond(s, p, a);
    else if (w.kind === 'draw') {
      if (a.t !== 'draw') return '카드를 어디서 가져올지 골라 주세요.';
      drawPhase(s, p, a.from || 'deck');
    } else if (w.kind === 'kyle') {
      if (a.t !== 'kyle' || !w.cards.some(c => c.id === a.back)) return '더미 위로 돌려놓을 카드 한 장을 골라 주세요.';
      w.cards.forEach(c => (c.id === a.back ? s.deck.push(c) : p.hand.push(c)));
      note(s, `${nm(p)} 님이 3장 중 2장을 골라 가져갔어요.`, 'info');
      toPlay(s);
    } else if (w.kind === 'store') {
      const i = a.t === 'pick' ? s.store.cards.findIndex(c => c.id === a.card) : -1;
      if (i < 0) return '가져갈 카드를 골라 주세요.';
      const c = s.store.cards.splice(i, 1)[0];
      p.hand.push(c); s.store.order.shift();
      note(s, `${nm(p)} 님이 잡화점에서 ${CARDS[c.k].name}을(를) 골랐어요.`, 'info');
      storeNext(s);
    } else if (w.kind === 'discard') {
      const ids = Array.isArray(a.ids) ? [...new Set(a.ids)] : [];
      if (a.t !== 'discard' || ids.length !== w.n || !ids.every(x => p.hand.some(c => c.id === x))) return `버릴 카드 ${w.n}장을 골라 주세요.`;
      ids.forEach(x => toDiscard(s, fromHand(p, x)));
      note(s, `${nm(p)} 님이 카드 ${w.n}장을 버리고 차례를 마쳤어요.`, 'info');
      endTurn(s);
    }
    if (err) return err;
    lucy(s);
  }
  function lucy(s) {
    if (s.over || (s.wait && s.wait.kind !== 'play' && s.wait.kind !== 'discard')) return;
    for (const p of alive(s)) if (p.char === 'lucy' && !p.hand.length && !(s.duel && (s.duel.a === p.id || s.duel.b === p.id))) { gain(p, draw(s)); note(s, `${nm(p)} 님 능력: 손이 비어서 카드 한 장!`, 'info'); }
  }

  /* ── 시작 ── */
  function setup(players, rnd, opts) {
    const deck = [];
    let uid = 0;
    for (const [k, list] of Object.entries(DECK)) for (const code of list.split(' ')) deck.push({ id: ++uid, k, s: code[0], r: +code.slice(1) });
    const n = players.length;
    const roles = shuffle(ROLE_SETS[Math.min(7, Math.max(4, n))].slice(0, n), rnd);
    const chars = shuffle(Object.keys(CHARS), rnd);
    const s = {
      rnd, deck: shuffle(deck, rnd), discard: [], turn: 0, turnNo: 0, bangs: 0, wait: null, queue: [], duel: null, store: null, attack: null,
      over: false, winRole: null, winners: [], deaths: [], log: [], seq: 0, msg: '', host: {}, solo: !!(opts && opts.solo), dlAt: null,
      players: players.map((p, i) => {
        const role = roles[i], ch = chars[i], max = CHARS[ch].hp + (role === 'sheriff' ? 1 : 0);
        return { id: p.id, name: p.name, bot: !!p.bot, role, char: ch, hp: max, max, hand: [], inPlay: [], alive: true };
      }),
    };
    s.players.forEach(p => drawN(s, p, p.hp));
    s.turn = s.players.findIndex(p => p.role === 'sheriff');
    note(s, `${nm(cur(s))} 님이 보안관이에요! 보안관부터 시작해요.`, 'info');
    beginTurn(s);
    return s;
  }

  /* ── 봇 ── */
  function worth(p, c) {
    const k = c.k, hurt = p.hp < p.max;
    const base = { wells: 10, stagecoach: 9, missed: 7, beer: hurt ? 9 : 6, barrel: has(p, 'barrel') ? 1 : 8, mustang: has(p, 'mustang') ? 1 : 7, scope: has(p, 'scope') ? 1 : 4,
      bang: 6, panic: 6, catbalou: 6, gatling: 7, indians: 6, duel: 5, store: 4, saloon: hurt ? 6 : 3, jail: 5, dynamite: 2 }[k];
    if (base != null) return base;
    const r = CARDS[k].range || 1;
    return r > range(p) ? 3 + r : 1;
  }
  /** 봇이 보기에 t가 얼마나 적인가 (클수록 적) */
  function enemy(s, me, t) {
    if (t === me || !t.alive) return -999;
    const sh = s.players.find(p => p.role === 'sheriff'), live = alive(s).length;
    const H = (a, b) => ((s.host[a.id] || {})[b.id] || 0);
    const late = s.turnNo > live * 3;
    const r = s.rnd() * 0.5;
    if (me.role === 'outlaw') {
      if (t.role === 'sheriff') return 100;
      return H(t, me) * 2 + H(t, sh) * -3 + H(sh, t) * 2 + (late ? 1 : 0) + r;
    }
    if (me.role === 'sheriff' || me.role === 'deputy') {
      if (t.role === 'sheriff') return -100;
      return H(t, sh) * 3 + H(t, me) * 2 - H(sh, t) * (me.role === 'deputy' ? 0 : 0) + (late ? 1.2 : 0) + r;
    }
    // 배신자: 처음엔 보안관 편, 끝에는 모두의 적
    if (t.role === 'sheriff') return live <= 2 ? 100 : -40;
    return live <= 3 ? 50 + r : H(t, sh) * 3 + H(t, me) * 2 + (late ? 1 : 0) + r;
  }
  function aiPlay(s, p) {
    const others = alive(s).filter(q => q !== p).map(q => ({ q, e: enemy(s, p, q) })).sort((a, b) => b.e - a.e);
    const foes = others.filter(x => x.e > 0.6);
    const tryA = a => (canPlay(s, p, a) ? null : a);
    const cards = k => p.hand.filter(c => c.k === k);
    const first = k => cards(k)[0];
    // 약초꾼 닥: 카드가 많고 다쳤으면 회복
    if (p.char === 'doc' && p.hp < p.max && p.hand.length >= p.hp + 2) {
      const two = p.hand.slice().sort((a, b) => worth(p, a) - worth(p, b)).slice(0, 2);
      return { t: 'heal', ids: two.map(c => c.id) };
    }
    for (const k of ['wells', 'stagecoach']) if (first(k)) return { t: 'play', card: first(k).id };
    // 장비
    for (const c of p.hand) {
      const info = CARDS[c.k];
      if (info.type === 'gun') {
        const better = c.k === 'volcanic' ? (!gun(p) && cards('bang').length >= 2) : info.range > range(p);
        if (better) return { t: 'play', card: c.id };
      } else if (['barrel', 'mustang', 'scope'].includes(c.k) && !has(p, c.k)) return { t: 'play', card: c.id };
    }
    if (first('beer') && p.hp < p.max && alive(s).length > 2 && (p.hp <= 2 || p.hand.length > p.hp)) return { t: 'play', card: first('beer').id };
    if (first('saloon') && p.hp < p.max) return { t: 'play', card: first('saloon').id };
    if (first('jail')) { const f = foes.find(x => x.q.role !== 'sheriff' && !has(x.q, 'jail')); if (f) return { t: 'play', card: first('jail').id, target: f.q.id }; }
    if (first('dynamite') && p.hp >= 3 && s.rnd() < 0.6) return { t: 'play', card: first('dynamite').id };
    if (first('panic')) {
      for (const f of foes) {
        const a = tryA({ t: 'play', card: first('panic').id, target: f.q.id, pick: pickFrom(f.q) });
        if (a) return a;
      }
    }
    if (first('catbalou') && foes.length) {
      const a = tryA({ t: 'play', card: first('catbalou').id, target: foes[0].q.id, pick: pickFrom(foes[0].q) });
      if (a) return a;
    }
    if (first('duel') && foes.length && cards('bang').length >= 1) return { t: 'play', card: first('duel').id, target: foes[0].q.id };
    const foeSum = others.reduce((a, x) => a + Math.sign(x.e - 0.6), 0);
    if (first('gatling') && (foeSum > 0 || (p.role === 'outlaw' && others.length <= 3))) return { t: 'play', card: first('gatling').id };
    if (first('indians') && (foeSum > 0 || (p.role === 'outlaw' && others.length <= 3))) return { t: 'play', card: first('indians').id };
    if (first('store') && s.rnd() < 0.7) return { t: 'play', card: first('store').id };
    // 뱅!
    const shots = p.hand.filter(c => c.k === 'bang' || (p.char === 'may' && c.k === 'missed' && missLike(p).length > 2));
    for (const c of shots) for (const f of foes) { const a = tryA({ t: 'play', card: c.id, target: f.q.id }); if (a) return a; }
    // 아무도 수상하지 않으면: 보안관 · 배신자는 가끔 가까운 사람을 떠봐요 (게임이 멈추지 않게)
    if (shots.length && (s.turnNo > alive(s).length * 2) && p.role !== 'deputy') {
      for (const x of others) if (x.e > -10) { const a = tryA({ t: 'play', card: shots[0].id, target: x.q.id }); if (a && s.rnd() < 0.5) return a; }
    }
    return { t: 'end' };
  }
  function pickFrom(t) {
    const good = t.inPlay.find(c => ['barrel', 'mustang', 'scope', 'volcanic', 'winchester', 'carabine', 'remington'].includes(c.k));
    if (good) return good.id;
    return t.hand.length ? 'hand' : (t.inPlay[0] || {}).id;
  }
  function ai(s, id) {
    const w = s.wait, p = P(s, id);
    if (!w) return null;
    switch (w.kind) {
      case 'play': return aiPlay(s, p);
      case 'respond': {
        const pool = (w.src === 'bang' || w.src === 'gatling' ? missLike(p) : bangLike(p)).sort((a, b) => (a.k === 'missed' ? 0 : 1) - (b.k === 'missed' ? 0 : 1));
        if (pool.length >= w.need) return { t: 'cards', ids: pool.slice(0, w.need).map(c => c.id) };
        return { t: 'take' };
      }
      case 'draw': {
        if (p.char === 'pepe') { const top = s.discard[s.discard.length - 1]; return { t: 'draw', from: top && worth(p, top) >= 6 ? 'discard' : 'deck' }; }
        const rich = alive(s).filter(q => q !== p && q.hand.length).sort((a, b) => enemy(s, p, b) - enemy(s, p, a) || b.hand.length - a.hand.length)[0];
        return { t: 'draw', from: rich && enemy(s, p, rich) > -5 ? rich.id : 'deck' };
      }
      case 'kyle': return { t: 'kyle', back: w.cards.slice().sort((a, b) => worth(p, a) - worth(p, b))[0].id };
      case 'store': return { t: 'pick', card: s.store.cards.slice().sort((a, b) => worth(p, b) - worth(p, a))[0].id };
      case 'discard': return { t: 'discard', ids: p.hand.slice().sort((a, b) => worth(p, a) - worth(p, b)).slice(0, w.n).map(c => c.id) };
      default: return null;
    }
  }
  function auto(s, id) {
    const w = s.wait;
    if (w && w.kind === 'play') return { t: 'end' };
    return ai(s, id);
  }

  /* ── 보여주기 ── */
  const pubCard = c => ({ id: c.id, k: c.k, s: c.s, r: c.r });
  function view(s, viewer) {
    const me = P(s, viewer), w = s.wait;
    const seeRole = p => p.role === 'sheriff' || !p.alive || p.id === viewer || s.over;
    return {
      players: s.players.map(p => ({ id: p.id, name: p.name, char: p.char, hp: p.hp, max: p.max, alive: p.alive,
        role: seeRole(p) ? p.role : null, hand: p.hand.length, inPlay: p.inPlay.map(pubCard),
        handCards: s.over ? p.hand.map(pubCard) : null })),
      hand: me ? me.hand.map(pubCard) : [],
      turnId: s.over ? null : cur(s).id, turnNo: s.turnNo, bangs: s.bangs,
      wait: w ? { kind: w.kind, who: w.who, src: w.src, from: w.from, need: w.n || w.need, cards: w.kind === 'kyle' && w.who === viewer ? w.cards.map(pubCard) : undefined } : null,
      store: s.store ? { cards: s.store.cards.map(pubCard), order: s.store.order } : null,
      duel: s.duel, deck: s.deck.length, discardTop: s.discard.length ? pubCard(s.discard[s.discard.length - 1]) : null,
      over: s.over, winRole: s.winRole, winners: s.winners, msg: s.msg, log: s.log.slice(-14), seq: s.seq,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const title = { sheriff: '⭐ 보안관 팀 승리!', outlaw: '💀 무법자 승리!', renegade: '🃏 배신자 승리!' }[s.winRole];
    const ranked = s.players.slice().sort((a, b) => (s.winners.includes(b.id) - s.winners.includes(a.id)) || (b.alive - a.alive) || (s.deaths.indexOf(b.id) - s.deaths.indexOf(a.id)));
    return {
      title, subtitle: { sheriff: '보안관과 부관이 무법자와 배신자를 모두 잡았어요', outlaw: '무법자들이 보안관을 쓰러뜨렸어요', renegade: '배신자가 끝까지 홀로 살아남았어요' }[s.winRole],
      lines: s.players.map(p => `${p.name}: ${ROLES[p.role].name} · ${CHARS[p.char].name}${p.alive ? '' : ' (쓰러짐)'}`),
      ranking: ranked.map(p => ({ id: p.id, value: `${s.winners.includes(p.id) ? '승리' : '패배'} · ${ROLES[p.role].name}` })),
    };
  }
  return {
    meta: {
      name: '황야의 총잡이', min: 4, max: 7, bots: true, turnSec: 0, botDelay: [900, 1600],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 3, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명'], [4, '4명'], [5, '5명'], [6, '6명']] }],
    },
    CARDS, CHARS, ROLES, SUIT, RANK, distance, range, unlimited, canPlay,
    setup, act, ai, auto, view, result,
    pending: s => (s.over || !s.wait ? [] : [s.wait.who]),
    deadline: s => (s.over || s.solo || !s.wait ? null : s.dlAt),
    timeup: s => {
      const w = s.wait;
      if (!w || s.over) return;
      (s.afk = s.afk || {})[w.who] = true;               // 자리를 비운 것 같아요 → 다음 결정은 짧게
      s.timing = true;
      let err = act(s, w.who, auto(s, w.who));
      if (err) err = act(s, w.who, ai(s, w.who));
      if (err && w.kind !== 'play') act(s, w.who, { t: 'take' });
      s.timing = false;
    },
  };
});
