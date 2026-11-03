/* =====================================================================
 *  🔪 마피아 규칙 — 밤에는 마피아가 한 명을 노리고, 낮에는 토론과 투표로 마피아를 찾아요.
 *  직업: 마피아 · 의사 · 경찰 · 군인(7명 이상) · 시민
 *  단계: 직업 확인 → 밤 → 아침 → 낮 토론 → 투표 → 최후 변론 → 찬반 투표 → 결과 → 밤 …
 *  마피아가 모두 죽으면 시민 승리, 마피아 수가 나머지 수 이상이 되면 마피아 승리
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.MafiaCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { shuffle, log } = TableKit.util;
  const ROLE = {
    mafia: { name: '마피아', team: 'mafia', desc: '밤마다 동료와 함께 한 명을 제거해요. 마피아 수가 시민 수와 같아지면 승리!' },
    doctor: { name: '의사', team: 'town', desc: '밤마다 한 명을 골라 마피아의 공격에서 지켜요. 자기 자신도 고를 수 있어요.' },
    police: { name: '경찰', team: 'town', desc: '밤마다 한 명을 조사해 마피아인지 알아내요. 결과는 나만 볼 수 있어요.' },
    soldier: { name: '군인', team: 'town', desc: '마피아의 공격을 한 번 버텨요. 버티면 정체가 드러나요.' },
    citizen: { name: '시민', team: 'town', desc: '특별한 능력은 없지만, 토론과 투표로 마피아를 찾아내요!' },
  };
  const MS = { intro: 9000, night: 30000, morning: 7000, vote: 25000, defense: 20000, final: 12000, result: 6000 };
  const dayMs = n => Math.min(120000, 30000 + n * 10000);
  const GUT = 0.3;   // 시민 봇이 마피아를 눈치채는 정도

  const P = (s, id) => s.players.find(p => p.id === id);
  const alive = s => s.players.filter(p => p.alive);
  const aliveMafia = s => alive(s).filter(p => p.role === 'mafia');
  const humans = s => alive(s).filter(p => !p.bot);

  function setup(players, rnd) {
    const n = players.length, mafiaN = n <= 6 ? 1 : n <= 10 ? 2 : 3;
    const roles = ['doctor', 'police'].concat(n >= 7 ? ['soldier'] : [], Array(mafiaN).fill('mafia'));
    while (roles.length < n) roles.push('citizen');
    const deck = shuffle(roles.slice(0, n), rnd);
    const s = {
      rnd, phase: 'intro', round: 0, deadline: Date.now() + MS.intro, accused: null, lastTally: null, finalCount: null,
      players: players.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, role: deck[i], alive: true, left: false, armor: deck[i] === 'soldier' ? 1 : 0 })),
      night: { kills: {}, heal: null, check: null }, votes: {}, ready: {}, final: {}, checks: {}, log: [], seq: 0, over: false, winner: null,
      msg: `${n}명 중 마피아는 ${mafiaN}명! 자신의 직업을 확인하세요. 곧 첫 번째 밤이 찾아와요.`,
    };
    return s;
  }
  const setPhase = (s, phase, ms, msg) => { s.phase = phase; s.deadline = Date.now() + ms; s.msg = msg; log(s, { t: 'phase', phase, round: s.round, msg }); };

  function startNight(s) {
    s.round++; s.night = { kills: {}, heal: null, check: null }; s.accused = null; s.finalCount = null;
    setPhase(s, 'night', MS.night, `${s.round}일째 밤이 찾아왔어요. 마피아 · 의사 · 경찰은 대상을 골라요.`);
  }
  /** 마피아 여러 명이 고른 대상 중 가장 많이 고른 사람 (같으면 무작위) */
  function majority(list, rnd) {
    const c = {}; for (const x of list) if (x) c[x] = (c[x] || 0) + 1;
    const max = Math.max(0, ...Object.values(c));
    if (!max) return null;
    const top = Object.keys(c).filter(k => c[k] === max);
    return top[Math.floor(rnd() * top.length)];
  }
  function resolveNight(s) {
    const target = majority(aliveMafia(s).map(m => s.night.kills[m.id]).filter(t => t && P(s, t).alive), s.rnd);
    let text;
    if (!target) text = '조용한 밤이었어요. 아무 일도 일어나지 않았어요.';
    else if (s.night.heal === target) { text = '마피아가 누군가를 노렸지만, 의사가 살려냈어요!'; log(s, { t: 'saved' }); }
    else {
      const t = P(s, target);
      if (t.armor > 0) { t.armor--; t.shown = true; text = `마피아가 ${t.name} 님을 공격했지만, 군인이라 버텨냈어요!`; log(s, { t: 'armor', id: t.id }); }
      else { t.alive = false; text = `밤사이 ${t.name} 님이 마피아에게 당했어요… (직업: ${ROLE[t.role].name})`; log(s, { t: 'kill', id: t.id, role: t.role }); }
    }
    setPhase(s, 'morning', MS.morning, text);
  }
  function startDay(s) {
    s.ready = {};
    setPhase(s, 'day', humans(s).length ? dayMs(alive(s).length) : 5000, `${s.round}일째 낮 — 토론 시간! 누가 마피아일까요?`);
  }
  function startVote(s) {
    s.votes = {};
    setPhase(s, 'vote', MS.vote, '투표 시간! 마피아로 의심되는 사람을 누르세요.');
  }
  function resolveVote(s) {
    const tally = {};
    for (const [id, t] of Object.entries(s.votes)) if (t && t !== 'skip' && P(s, id).alive && P(s, t) && P(s, t).alive) tally[t] = (tally[t] || 0) + 1;
    s.lastTally = tally;
    const max = Math.max(0, ...Object.values(tally)), top = Object.keys(tally).filter(k => tally[k] === max);
    log(s, { t: 'tally', tally });
    if (!max || top.length > 1) { s.next = 'night'; return setPhase(s, 'result', 4500, max ? '표가 똑같이 갈려서 아무도 처형되지 않았어요.' : '아무도 투표하지 않아 그냥 밤이 돼요.'); }
    s.accused = top[0];
    setPhase(s, 'defense', MS.defense, `${P(s, top[0]).name} 님이 ${max}표로 최다 득표! 최후 변론을 들어 보세요.`);
  }
  function startFinal(s) {
    s.final = {};
    setPhase(s, 'final', MS.final, `${P(s, s.accused).name} 님을 처형할까요? 찬성 또는 반대를 골라요.`);
  }
  function resolveFinal(s) {
    const a = P(s, s.accused);
    const yes = Object.values(s.final).filter(v => v).length, no = Object.values(s.final).filter(v => !v).length;
    s.finalCount = { yes, no, id: a.id };
    s.next = 'night';
    if (yes > no) { a.alive = false; log(s, { t: 'exec', id: a.id, role: a.role }); setPhase(s, 'result', MS.result, `찬성 ${yes} · 반대 ${no} — ${a.name} 님이 처형됐어요. 정체는… ${ROLE[a.role].name}!`); }
    else { log(s, { t: 'spared', id: a.id }); setPhase(s, 'result', MS.result, `찬성 ${yes} · 반대 ${no} — ${a.name} 님은 살아남았어요.`); }
    s.accused = null;
  }
  function checkWin(s) {
    const m = aliveMafia(s).length, t = alive(s).length - m;
    if (m && m < t) return false;
    s.over = true; s.phase = 'over'; s.deadline = null; s.winner = m ? 'mafia' : 'town';
    s.msg = m ? '마피아가 마을을 차지했어요! 마피아 승리!' : '마피아를 모두 찾아냈어요! 시민 승리!';
    log(s, { t: 'over', winner: s.winner });
    return true;
  }
  function advance(s) {
    switch (s.phase) {
      case 'intro': return startNight(s);
      case 'night': return resolveNight(s);
      case 'morning': return checkWin(s) || startDay(s);
      case 'day': return startVote(s);
      case 'vote': return resolveVote(s);
      case 'defense': return startFinal(s);
      case 'final': return resolveFinal(s);
      case 'result': return checkWin(s) || startNight(s);
      default: return null;
    }
  }

  /** 아직 행동하지 않은 사람 (봇은 이 목록을 보고 움직여요) */
  function pending(s) {
    if (s.over) return [];
    const al = alive(s);
    switch (s.phase) {
      case 'night': return al.filter(p => (p.role === 'mafia' && !s.night.kills[p.id]) || (p.role === 'doctor' && !s.night.heal) || (p.role === 'police' && !s.night.check)).map(p => p.id);
      case 'day': return al.filter(p => !p.bot && !s.ready[p.id]).map(p => p.id);
      case 'vote': return al.filter(p => !(p.id in s.votes)).map(p => p.id);
      case 'defense': return s.accused ? [s.accused] : [];
      case 'final': return al.filter(p => p.id !== s.accused && !(p.id in s.final)).map(p => p.id);
      default: return [];
    }
  }
  const phaseDone = s => ['night', 'day', 'vote', 'final'].includes(s.phase) && !pending(s).length;

  function act(s, id, a) {
    const p = P(s, id);
    if (!p) return '게임 참가자가 아니에요.';
    if (s.over) return '게임이 끝났어요.';
    if (!p.alive) return '탈락했어요. 유령끼리 채팅할 수 있어요.';
    const t = a.target != null ? P(s, a.target) : null;
    switch (s.phase) {
      case 'night':
        if (a.t !== 'night' || !t || !t.alive) return '살아 있는 사람을 골라 주세요.';
        if (p.role === 'mafia') { if (t.role === 'mafia') return '동료 마피아는 고를 수 없어요.'; s.night.kills[id] = t.id; }
        else if (p.role === 'doctor') s.night.heal = t.id;
        else if (p.role === 'police') {
          if (s.night.check) return '오늘 밤은 이미 조사했어요.';
          if (t.id === id) return '자기 자신은 조사할 수 없어요.';
          s.night.check = t.id; s.checks[t.id] = t.role === 'mafia';
        } else return '시민은 밤에 할 일이 없어요. 아침을 기다려요.';
        break;
      case 'day':
        if (a.t !== 'ready') return '토론 중이에요.';
        s.ready[id] = true;
        break;
      case 'vote':
        if (a.t !== 'vote') return '투표 시간이에요.';
        if (a.target !== 'skip' && (!t || !t.alive)) return '살아 있는 사람에게만 투표할 수 있어요.';
        if (a.target === id) return '자기 자신에게는 투표할 수 없어요.';
        s.votes[id] = a.target;
        break;
      case 'defense':
        if (a.t !== 'endDefense' || id !== s.accused) return '최후 변론 중이에요.';
        return void advance(s);
      case 'final':
        if (id === s.accused) return '본인은 투표할 수 없어요.';
        if (a.t !== 'final') return '찬성 또는 반대를 골라 주세요.';
        s.final[id] = !!a.yes;
        break;
      default: return '잠시만 기다려 주세요.';
    }
    if (phaseDone(s)) advance(s);
  }
  /** 이미 고른 사람이 대상을 바꾸는 건 언제든 가능 (단계를 끝내지는 않음) */
  function free(s, id, a) {
    const p = P(s, id);
    if (!p || !p.alive || s.over) return false;
    if (s.phase === 'night' && a.t === 'night') return (p.role === 'mafia' && !!s.night.kills[id]) || (p.role === 'doctor' && !!s.night.heal);
    if (s.phase === 'vote' && a.t === 'vote') return id in s.votes;
    if (s.phase === 'final' && a.t === 'final') return id in s.final;
    if (s.phase === 'day' && a.t === 'ready') return !!s.ready[id];
    return false;
  }

  function ai(s, id) {
    const p = P(s, id), rnd = s.rnd, pick = arr => arr[Math.floor(rnd() * arr.length)];
    const others = alive(s).filter(q => q.id !== id);
    switch (s.phase) {
      case 'night': {
        if (p.role === 'mafia') {
          const mate = aliveMafia(s).map(m => s.night.kills[m.id]).find(t => t && P(s, t).alive);
          return { t: 'night', target: mate || pick(others.filter(q => q.role !== 'mafia')).id };
        }
        if (p.role === 'doctor') return { t: 'night', target: rnd() < 0.35 || !others.length ? id : pick(others).id };
        if (p.role === 'police') { const un = others.filter(q => !(q.id in s.checks)); return { t: 'night', target: pick(un.length ? un : others).id }; }
        return null;
      }
      case 'vote': {
        const known = p.role === 'police' && others.find(q => s.checks[q.id]);
        if (known) return { t: 'vote', target: known.id };
        const tally = {}; Object.values(s.votes).forEach(v => { if (v && v !== 'skip' && P(s, v) && P(s, v).alive) tally[v] = (tally[v] || 0) + 1; });
        const lead = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
        if (p.role === 'mafia') {
          const town = others.filter(q => q.role !== 'mafia');
          return { t: 'vote', target: lead && P(s, lead).role !== 'mafia' && lead !== id ? lead : pick(town).id };
        }
        // 시민 봇: 대화를 들은 척 '감'을 조금 줘요 (가끔 진짜 마피아를 의심)
        const gut = others.filter(q => q.role === 'mafia');
        if (gut.length && rnd() < GUT) return { t: 'vote', target: pick(gut).id };
        const pool = others.filter(q => !(p.role === 'police' && s.checks[q.id] === false) && !q.shown);
        return { t: 'vote', target: lead && lead !== id && rnd() < 0.5 ? lead : pick(pool.length ? pool : others).id };
      }
      case 'defense': return { t: 'endDefense' };
      case 'final': {
        const acc = P(s, s.accused);
        if (p.role === 'mafia') return { t: 'final', yes: acc.role !== 'mafia' };
        if (p.role === 'police' && acc.id in s.checks) return { t: 'final', yes: s.checks[acc.id] };
        return { t: 'final', yes: rnd() < (acc.role === 'mafia' ? 0.5 + GUT : 0.55) };
      }
      case 'day': return { t: 'ready' };
      default: return null;
    }
  }
  function drop(s, id) {
    const p = P(s, id);
    if (!p || !p.alive || s.over) return;
    p.alive = false; p.left = true;
    log(s, { t: 'left', id, role: p.role });
    if (checkWin(s)) return;
    if (s.accused === id) { s.accused = null; s.next = 'night'; return setPhase(s, 'result', 4000, `${p.name} 님이 나가서 투표가 취소됐어요.`); }
    if (phaseDone(s)) advance(s);
  }

  function view(s, viewer) {
    const me = P(s, viewer), seeAll = s.over || !me || !me.alive;
    const mafiaView = me && me.role === 'mafia';
    const votes = {};
    if (s.phase === 'vote') Object.values(s.votes).forEach(v => { if (v && v !== 'skip') votes[v] = (votes[v] || 0) + 1; });
    return {
      phase: s.phase, round: s.round, accused: s.accused, msg: s.msg, over: s.over, winner: s.winner, seq: s.seq,
      lastTally: s.lastTally, finalCount: s.finalCount,
      players: s.players.map(p => ({
        id: p.id, name: p.name, alive: p.alive, left: p.left, bot: p.bot,
        role: seeAll || p.id === viewer || !p.alive || (mafiaView && p.role === 'mafia') || (p.shown && p.role === 'soldier') ? p.role : null,
        ready: s.phase === 'day' && !!s.ready[p.id],
        votes: s.phase === 'vote' ? votes[p.id] || 0 : null,
        voted: s.phase === 'vote' ? p.id in s.votes : s.phase === 'final' ? p.id in s.final : false,
      })),
      my: me ? {
        role: me.role, alive: me.alive,
        target: s.phase === 'night' ? (me.role === 'mafia' ? s.night.kills[viewer] : me.role === 'doctor' ? s.night.heal : me.role === 'police' ? s.night.check : null) || null : null,
        vote: s.phase === 'vote' ? s.votes[viewer] || null : null, final: s.phase === 'final' && viewer in s.final ? s.final[viewer] : null,
        checks: me.role === 'police' ? s.checks : null,
        mafiaPicks: mafiaView && s.phase === 'night' ? s.night.kills : null,
      } : null,
      readyN: Object.keys(s.ready).length, humansN: humans(s).length,
      log: s.log.slice(-16),
    };
  }
  function result(s) {
    if (!s.over) return null;
    const win = p => ROLE[p.role].team === s.winner;
    return {
      title: s.winner === 'mafia' ? '🔪 마피아 승리!' : '🕊️ 시민 승리!',
      subtitle: s.winner === 'mafia' ? '마피아가 끝까지 정체를 숨겼어요.' : '마을의 평화를 지켜냈어요.',
      lines: s.players.map(p => `${p.name} — ${ROLE[p.role].name}${p.alive ? '' : ' (사망)'}`),
      ranking: s.players.slice().sort((a, b) => win(b) - win(a)).map(p => ({ id: p.id, value: `${ROLE[p.role].name} · ${win(p) ? '승리' : '패배'}` })),
      winners: s.players.filter(win).map(p => p.id),
    };
  }
  function chatRoute(s, id) {
    const p = P(s, id);
    if (s.over) return 'all';
    if (!p) return 'none';
    if (!p.alive) return { ids: s.players.filter(q => !q.alive).map(q => q.id), tag: '유령' };
    if (s.phase === 'night') return p.role === 'mafia' ? { ids: s.players.filter(q => q.role === 'mafia' || !q.alive).map(q => q.id), tag: '마피아' } : 'none';
    if (s.phase === 'defense' && id !== s.accused) return 'none';
    return 'all';
  }
  return {
    meta: {
      name: '마피아', min: 4, max: 12, bots: true, turnSec: 0, botDelay: [1500, 4500],
      options: [{ key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명'], [2, '2명'], [3, '3명'], [4, '4명'], [5, '5명']] }],
    },
    ROLE, MS,
    setup, act, free, ai, view, result, pending, drop, chatRoute,
    deadline: s => (s.over ? null : s.deadline),
    timeup: s => { if (!s.over) advance(s); },
  };
});
