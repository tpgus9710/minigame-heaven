/* =====================================================================
 *  🔪 마피아 화면 (규칙: shared/mafia-core.js) — 멀티 전용, 채팅은 오른쪽 채팅창을 그대로 써요
 *  (밤에는 마피아끼리만, 죽은 사람은 유령끼리만 대화가 전달돼요)
 * ===================================================================== */
makeScreen('mafia', {
  title: '🔪 마피아', status: '밤에는 마피아가 움직이고, 낮에는 토론과 투표로 마피아를 찾아요.',
  stats: [['round', '날짜'], ['alive', '생존'], ['time', '남은 시간']],
  body: `<div class="mf-wrap intro" id="mf-wrap">
      <div class="mf-sky"><i class="mf-orb"></i><div class="mf-phase"><small id="mf-phase-k">MAFIA</small><b id="mf-phase-t">직업 확인</b><p id="mf-msg"></p></div></div>
      <div class="mf-main"><div class="mf-grid" id="mf-grid"></div>
        <aside class="mf-side"><div class="mf-role" id="mf-role"></div><div class="mf-acts" id="mf-acts"></div><div class="mf-log" id="mf-log"></div></aside></div>
    </div>`,
});

const Mafia = {
  ROLE_CLS: { mafia: 'mafia', doctor: 'doctor', police: 'police', soldier: 'soldier', citizen: 'citizen' },
  PHASE: { intro: ['MAFIA', '직업 확인'], night: ['NIGHT', '밤'], morning: ['MORNING', '아침'], day: ['DAY', '낮 토론'], vote: ['VOTE', '투표'], defense: ['DEFENSE', '최후 변론'], final: ['VERDICT', '찬반 투표'], result: ['RESULT', '결과'], over: ['GAME OVER', '게임 끝'] },
  render(v, ctx) {
    this.v = v; this.ctx = ctx;
    const me = v.my, R = MafiaCore.ROLE, meP = v.players.find(p => p.id === ctx.me);
    const wrap = $('#mf-wrap');
    wrap.className = 'mf-wrap ' + v.phase + (me && !me.alive ? ' ghost' : '');
    const [k, t] = this.PHASE[v.phase] || ['', ''];
    $('#mf-phase-k').textContent = k;
    $('#mf-phase-t').textContent = v.over ? (v.winner === 'mafia' ? '마피아 승리' : v.winner === 'town' ? '시민 승리' : '게임 끝') : ['night', 'morning', 'day'].includes(v.phase) ? `${v.round}일째 ${t}` : t;
    $('#mf-msg').textContent = v.msg;
    setStat('mafia', 'round', v.round ? `${v.round}일째` : '-');
    setStat('mafia', 'alive', `${v.players.filter(p => p.alive).length} / ${v.players.length}`);

    // 고를 수 있는 사람
    const canPick = id => {
      const p = v.players.find(q => q.id === id);
      if (!me || !me.alive || !p || !p.alive || v.over) return false;
      if (v.phase === 'night') return me.role === 'mafia' ? p.role !== 'mafia' : me.role === 'doctor' ? true : me.role === 'police' ? id !== ctx.me && !me.target : false;
      if (v.phase === 'vote') return id !== ctx.me;
      return false;
    };
    const picks = {};
    if (me && me.mafiaPicks) Object.values(me.mafiaPicks).forEach(id => { picks[id] = (picks[id] || 0) + 1; });
    $('#mf-grid').innerHTML = v.players.map(p => {
      const cls = [p.alive ? '' : 'dead', p.id === ctx.me ? 'me' : '', canPick(p.id) ? 'pickable' : '', me && (me.target === p.id || me.vote === p.id) ? 'picked' : '', v.accused === p.id ? 'accused' : '', picks[p.id] ? 'marked' : ''].join(' ');
      const role = p.role ? `<span class="rl ${p.role}">${R[p.role].name}</span>` : `<span class="rl unknown">${p.alive ? '???' : '사망'}</span>`;
      const check = me && me.checks && p.id in me.checks ? `<span class="chk ${me.checks[p.id] ? 'bad' : 'ok'}">${me.checks[p.id] ? '조사: 마피아!' : '조사: 시민'}</span>` : '';
      return `<button class="mf-p ${cls}" data-act="mfPick" data-id="${esc(p.id)}">
        ${p.votes ? `<em class="vt">${p.votes}</em>` : ''}${p.ready ? '<i class="rdy">준비</i>' : ''}${p.voted ? '<i class="rdy voted">투표함</i>' : ''}${picks[p.id] ? `<i class="knife">표적 ${picks[p.id]}</i>` : ''}
        <span class="av" style="--c:${avColor(p.id)}">${esc((p.name || '?')[0])}</span>
        <b class="nm">${esc(p.name)}${p.id === ctx.me ? ' (나)' : ''}</b>${role}${check}${p.left ? '<small class="left">나감</small>' : ''}</button>`;
    }).join('');

    // 내 직업 카드
    if (me) {
      const mates = me.role === 'mafia' ? v.players.filter(p => p.role === 'mafia' && p.id !== ctx.me).map(p => esc(p.name)).join(', ') : '';
      $('#mf-role').innerHTML = `<div class="mf-card ${me.role}"><small>MY ROLE</small><b>${R[me.role].name}</b><p>${R[me.role].desc}</p>
        ${mates ? `<p class="mates">동료 마피아: ${mates}</p>` : me.role === 'mafia' ? '<p class="mates">동료 없이 혼자예요.</p>' : ''}
        ${!me.alive ? '<p class="dead-note">탈락했어요. 이제 모든 직업이 보이고, 유령끼리만 대화할 수 있어요.</p>' : ''}</div>`;
    } else $('#mf-role').innerHTML = '<div class="mf-card citizen"><small>SPECTATOR</small><b>관전 중</b><p>이번 판은 구경만 할 수 있어요.</p></div>';

    // 할 일 버튼
    let acts = '';
    if (v.over) acts = '<p class="mf-hint">곧 결과가 나와요.</p>';
    else if (!me || !me.alive) acts = '<p class="mf-hint">유령은 지켜볼 수만 있어요.</p>';
    else if (v.phase === 'intro') acts = '<p class="mf-hint">직업을 확인하세요. 곧 첫 번째 밤이 와요…</p>';
    else if (v.phase === 'night') acts = `<p class="mf-hint">${{ mafia: '처치할 사람을 누르세요. 동료와 같은 사람을 고르는 게 좋아요. (마피아 채팅 가능)', doctor: '오늘 밤 지켜 줄 사람을 누르세요.', police: me.target ? '조사를 마쳤어요. 결과는 카드에 표시돼요.' : '조사할 사람을 누르세요.', soldier: '군인은 밤에 할 일이 없어요. 아침을 기다려요…', citizen: '밤이 깊었어요. 조용히 아침을 기다려요…' }[me.role]}</p>`;
    else if (v.phase === 'day') acts = `<button class="btn ${meP && meP.ready ? 'ghost' : 'good'}" data-act="mfDo" data-t="ready" ${meP && meP.ready ? 'disabled' : ''}>${meP && meP.ready ? '다른 사람을 기다리는 중' : '토론 끝내고 투표하기'} <small>${v.readyN}/${v.humansN}</small></button>`;
    else if (v.phase === 'vote') acts = `<p class="mf-hint">마피아로 의심되는 사람을 누르세요. (바꿀 수 있어요)</p><button class="btn ghost ${me.vote === 'skip' ? 'on' : ''}" data-act="mfDo" data-t="vote" data-target="skip">기권</button>`;
    else if (v.phase === 'defense') acts = v.accused === ctx.me ? '<p class="mf-hint">지금은 나만 말할 수 있어요! 채팅으로 변론하세요.</p><button class="btn" data-act="mfDo" data-t="endDefense">변론 끝내기</button>' : '<p class="mf-hint">최후 변론을 들어 보세요. (지금은 채팅을 할 수 없어요)</p>';
    else if (v.phase === 'final') acts = v.accused === ctx.me ? '<p class="mf-hint">다른 사람들이 찬반 투표 중이에요…</p>'
      : `<div class="mf-yn"><button class="btn bad ${me.final === true ? 'on' : ''}" data-act="mfDo" data-t="final" data-yes="1">찬성 (처형)</button><button class="btn good ${me.final === false ? 'on' : ''}" data-act="mfDo" data-t="final" data-yes="0">반대 (살려 주기)</button></div>`;
    else acts = '<p class="mf-hint">잠시만요…</p>';
    $('#mf-acts').innerHTML = acts;

    // 기록
    const icon = { night: '☾', morning: '☀', day: '☀', vote: '⚖', defense: '⚖', final: '⚖', result: '⚖', intro: '★' };
    $('#mf-log').innerHTML = '<h4>마을 기록</h4>' + v.log.filter(e => e.t === 'phase' && e.phase !== 'day' && e.phase !== 'vote' && e.phase !== 'final').slice(-7).reverse()
      .map(e => `<p class="${e.phase}"><i>${icon[e.phase] || '•'}</i>${esc(e.msg)}</p>`).join('');
  },
};
Object.assign(ACT, {
  mfPick: el => {
    const v = Mafia.v, c = Mafia.ctx; if (!v || !c || !el.classList.contains('pickable')) return;
    if (v.phase === 'night') c.send({ t: 'night', target: el.dataset.id });
    else if (v.phase === 'vote') c.send({ t: 'vote', target: el.dataset.id });
  },
  mfDo: el => {
    const c = Mafia.ctx; if (!c) return;
    const d = el.dataset, a = { t: d.t };
    if (d.target) a.target = d.target;
    if (d.yes != null) a.yes = d.yes === '1';
    c.send(a);
  },
});
Table.def('mafia', { core: MafiaCore, render: (v, ctx) => Mafia.render(v, ctx) });
