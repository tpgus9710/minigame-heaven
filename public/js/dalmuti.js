/* =====================================================================
 *  🤴 계급 전쟁 화면 (규칙: shared/dalmuti-core.js)
 *  위: 계급 사다리(달무티 → 농노, 이 순서로 내요) · 가운데: 이번에 낸 카드 · 아래: 내 패(숫자별 묶음)
 *  내 패: 묶음을 누르면 필요한 만큼 자동으로 골라져요. 몇 번째 카드를 누르냐로 장 수를 바꿀 수 있어요.
 * ===================================================================== */
/* 계급 카드 그림용 아이콘 몇 개 더 (Tabler Icons, MIT — 라이선스 전문은 icons.js 맨 위) */
Object.assign(ICONS, {
  'chess-bishop': '<path d="M8 16l-1.447 .724a1 1 0 0 0 -.553 .894v2.382h12v-2.382a1 1 0 0 0 -.553 -.894l-1.447 -.724h-8z"/> <path d="M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/> <path d="M9.5 16c-1.667 0 -2.5 -1.669 -2.5 -3c0 -3.667 1.667 -6 5 -7c3.333 1 5 3.427 5 7c0 1.284 -.775 2.881 -2.325 3l-.175 0h-5z"/> <path d="M15 8l-3 3"/> <path d="M12 5v1"/>',
  'building-castle': '<path d="M15 19v-2a3 3 0 0 0 -6 0v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14h4v3h3v-3h4v3h3v-3h4v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/> <path d="M3 11l18 0"/>',
  'pray': '<path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/> <path d="M7 20h8l-4 -4v-7l4 3l2 -2"/>',
  'chess-knight': '<path d="M8 16l-1.447 .724a1 1 0 0 0 -.553 .894v2.382h12v-2.382a1 1 0 0 0 -.553 -.894l-1.447 -.724h-8z"/> <path d="M9 3l1 3l-3.491 2.148a1 1 0 0 0 .524 1.852h2.967l-2.073 6h7.961l.112 -5c0 -3 -1.09 -5.983 -4 -7c-1.94 -.678 -2.94 -1.011 -3 -1z"/>',
  'needle-thread': '<path d="M3 21c-.667 -.667 3.262 -6.236 11.785 -16.709a3.5 3.5 0 1 1 5.078 4.791c-10.575 8.612 -16.196 12.585 -16.863 11.918z"/> <path d="M17.5 6.5l-1 1"/> <path d="M17 7c-2.333 -2.667 -3.5 -4 -5 -4s-2 1 -2 2c0 4 8.161 8.406 6 11c-1.056 1.268 -3.363 1.285 -5.75 .808"/> <path d="M5.739 15.425c-1.393 -.565 -3.739 -1.925 -3.739 -3.425"/> <path d="M19.5 9.5l1.5 1.5"/>',
  'chef-hat': '<path d="M12 3c1.918 0 3.52 1.35 3.91 3.151a4 4 0 0 1 2.09 7.723l0 7.126h-12v-7.126a4 4 0 1 1 2.092 -7.723a4 4 0 0 1 3.908 -3.151z"/> <path d="M6.161 17.009l11.839 -.009"/>',
  'paw': '<path d="M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538z"/> <path d="M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052z"/> <path d="M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267z"/> <path d="M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267z"/> <path d="M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082z"/>',
  'shovel': '<path d="M17 4l3 3"/> <path d="M18.5 5.5l-8 8"/> <path d="M8.276 11.284l4.44 4.44a.968 .968 0 0 1 0 1.369l-2.704 2.704a4.108 4.108 0 0 1 -5.809 -5.81l2.704 -2.703a.968 .968 0 0 1 1.37 0z"/>',
  'masks-theater': '<path d="M13.192 9h6.616a2 2 0 0 1 1.992 2.183l-.567 6.182a4 4 0 0 1 -3.983 3.635h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183z"/> <path d="M15 13h.01"/> <path d="M18 13h.01"/> <path d="M15 16.5c1 .667 2 .667 3 0"/> <path d="M8.632 15.982a4.037 4.037 0 0 1 -.382 .018h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183h6.616a2 2 0 0 1 2 2"/> <path d="M6 8h.01"/> <path d="M9 8h.01"/> <path d="M6 12c.764 -.51 1.528 -.63 2.291 -.36"/>',
  'tower': '<path d="M5 3h1a1 1 0 0 1 1 1v2h3v-2a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2h3v-2a1 1 0 0 1 1 -1h1a1 1 0 0 1 1 1v4.394a2 2 0 0 1 -.336 1.11l-1.328 1.992a2 2 0 0 0 -.336 1.11v7.394a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-7.394a2 2 0 0 0 -.336 -1.11l-1.328 -1.992a2 2 0 0 1 -.336 -1.11v-4.394a1 1 0 0 1 1 -1z"/> <path d="M10 21v-5a2 2 0 1 1 4 0v5"/>',
});

makeScreen('dalmuti', {
  title: '🤴 계급 전쟁', status: '숫자가 낮을수록 강해요. 앞사람과 같은 장수로, 더 낮은 숫자를 내세요. 인생은 불공평합니다!',
  stats: [['round', '판'], ['cards', '내 카드'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="dm-solo"><span class="muted small">AI 상대</span>
      ${[3, 4, 5, 6, 7].map(n => `<button class="seg-btn ${n === 5 ? 'on' : ''}" data-act="dmSolo" data-bots="${n}">${n}명</button>`).join('')}</div>
    <div class="dm-table" id="dm-table">
      <div class="dm-ladder" id="dm-ladder"></div>
      <div class="dm-mid">
        <div class="dm-center" id="dm-center"></div>
        <div class="dm-logbox"><div class="dm-logt">왕국 기록</div><ol class="dm-log" id="dm-log"></ol></div>
      </div>
      <div class="dm-me" id="dm-me">
        <div class="dm-note" id="dm-note"></div>
        <div class="dm-hand" id="dm-hand"></div>
        <div class="dm-bar" id="dm-bar"></div>
      </div>
    </div>`,
});

const DM_ICON = ['', 'crown', 'chess-bishop', 'building-castle', 'flower', 'pray', 'chess-knight', 'needle-thread', 'hammer', 'chef-hat', 'paw', 'pick', 'shovel', 'masks-theater'];
const DM_COLOR = ['', '#c9971f', '#7b4fc4', '#7b4fc4', '#3b78c4', '#3b78c4', '#2f8f5b', '#2f8f5b', '#2f8f5b', '#a06a35', '#a06a35', '#a06a35', '#6e6a64', '#d6336c'];
const DM_TITLE_IC = { '달무티': 'crown', '총리대신': 'chess-queen', '상인': 'coins', '소작농': 'pick', '농노': 'shovel' };
const DM_TITLE_CLS = { '달무티': 't0', '총리대신': 't1', '상인': 't2', '소작농': 't3', '농노': 't4' };

const DM = {
  sel: { v: null, k: 0, j: 0 }, give: [],
  /** 계급 카드 한 장 */
  card(v, cls = '', attrs = '', style = '') {
    const nm = DalmutiCore.NAMES[v];
    return `<div class="dm-card ${v === 13 ? 'jester' : ''} ${cls}" style="--tc:${DM_COLOR[v]};${style}" ${attrs}>
      <i class="dm-num">${v === 13 ? '★' : v}</i><span class="dm-ic">${icon(DM_ICON[v])}</span><b>${nm}</b></div>`;
  },
  name(v, id) { return esc((v.players.find(p => p.id === id) || {}).name || '?'); },
  titleChip(t) { return `<span class="dm-title ${DM_TITLE_CLS[t] || ''}">${icon(DM_TITLE_IC[t] || 'users')}${t}</span>`; },

  render(v, ctx, prev) {
    const fresh = !prev || this.gen !== Table.cur;
    if (fresh) { this.gen = Table.cur; this.sel = { v: null, k: 0, j: 0 }; this.give = []; this.pileKey = ''; this.selKey = ''; }
    this.v = v; this.ctx = ctx;
    $('#dm-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    $$('#dm-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === (DM.bots || 5)));
    setStat('dalmuti', 'round', `${v.round} / ${v.rounds}`);
    setStat('dalmuti', 'cards', v.my ? `${v.my.hand.length}장` : '-');
    // 내 차례/단계가 바뀌면 고른 카드 초기화
    const key = `${v.phase}|${v.round}|${v.ask ? v.ask.k + (v.ask.need || '') + (v.ask.below || '') : ''}|${v.my ? v.my.hand.join(',') : ''}`;
    if (key !== this.selKey) { this.selKey = key; this.sel = { v: null, k: 0, j: 0 }; this.give = []; }
    this.ladder(v, ctx);
    this.center(v, ctx);
    this.hand(v, ctx);
    $('#dm-log').innerHTML = v.log.slice().reverse().map((e, i) => `<li class="t-${e.t} ${i === 0 ? 'new' : ''}">${esc(e.text)}</li>`).join('');
  },

  ladder(v, ctx) {
    $('#dm-ladder').innerHTML = v.seat.map((id, i) => {
      const p = v.players.find(x => x.id === id);
      const backs = Array.from({ length: Math.min(p.n, 12) }, () => '<i></i>').join('');
      const tags = [];
      if (p.place) tags.push(`<em class="done">${p.place}등</em>`);
      else if (p.passed) tags.push('<em class="pass">패스</em>');
      if (v.turnId === id) tags.push('<em class="turn">차례</em>');
      if (v.trick && v.trick.by === id && !p.place) tags.push('<em class="top">최고</em>');
      if (v.wait.includes(id) && v.phase !== 'play' && v.phase !== 'summary') tags.push('<em class="think">고민 중</em>');
      return `${i ? `<span class="dm-arrow">${icon('arrow-left')}</span>` : ''}<div class="dm-seat ${id === ctx.me ? 'me' : ''} ${v.turnId === id ? 'turn' : ''} ${p.place ? 'out' : ''} ${p.passed ? 'passed' : ''}">
        ${this.titleChip(p.title)}
        <div class="dm-who"><span class="dm-av" style="--c:${avColor(id)}">${esc((p.name || '?')[0])}</span><b>${esc(p.name)}${id === ctx.me ? ' (나)' : ''}</b></div>
        <div class="dm-backs">${backs}<span>${p.n}</span></div>
        <div class="dm-meta"><small>${p.score}점</small>${tags.join('')}</div></div>`;
    }).join('');
  },

  center(v, ctx) {
    const box = $('#dm-center'), N = id => this.name(v, id), ask = v.ask;
    let html = '';
    if (v.phase === 'summary' || v.over) {
      const S = v.summary;
      html = `<div class="dm-summary"><h3>${S ? S.round : v.round}판 결과${v.over ? ' — 최종' : ''}</h3>
        <table><tr><th>순위</th><th>이름</th><th>다음 계급</th><th>점수</th></tr>
        ${(S ? S.rows : []).map(r => `<tr class="${r.id === ctx.me ? 'me' : ''}"><td>${r.place}</td><td>${N(r.id)}</td><td>${this.titleChip(r.title)}</td><td>+${r.pts} <small>(${r.total})</small></td></tr>`).join('')}</table>
        ${v.over ? `<p class="dm-final">${N(v.winner)} 님이 최고의 달무티!</p>`
          : ask && ask.k === 'next' ? `<button class="btn good" data-act="dmNext">다음 판 시작</button><small class="muted">곧 자동으로 시작해요</small>`
            : `<p class="muted">다른 사람을 기다리는 중… ${v.players.filter(p => p.ready).length ? '' : ''}</p>`}</div>`;
    } else if (v.phase === 'deal') {
      html = `<div class="dm-emptypile">${icon('cards')}<span>카드 정리 중…</span></div><p class="dm-rule">곧 세금을 걷어요.</p>`;
    } else if (v.phase === 'revolt') {
      const mine = ask && ask.k === 'revolt';
      html = `<div class="dm-revolt">${this.card(13, 'md')}${this.card(13, 'md tilt')}
        <div><h3>${mine ? '어릿광대 2장이 내 손에!' : `${N(v.revoltBy)} 님이 고민 중…`}</h3>
        ${mine ? `<p>${ask.great ? '<b>대혁명</b>을 일으키면 이번 판 계급이 완전히 뒤집히고 세금도 없어요!' : '<b>혁명</b>을 일으키면 이번 판은 세금이 없어요. 대신 광대 2장이 있다는 게 알려져요.'}</p>
          <div class="dm-btns"><button class="btn warn" data-act="dmRevolt" data-yes="1">${ask.great ? '대혁명!' : '혁명!'}</button><button class="btn ghost" data-act="dmRevolt" data-yes="0">조용히 넘어가기</button></div>`
          : '<p>누군가 어릿광대 2장을 받았어요. 혁명이 일어날까요?</p>'}</div></div>`;
    } else if (v.phase === 'tax') {
      const lines = v.taxPublic.map(t => `<li>${N(t.from)} <span class="dm-arr">${icon('arrow-left')}</span> ${N(t.to)} <small>가장 좋은 카드 ${t.n}장</small></li>`).join('');
      const waiting = v.wait.map(N).join(', ');
      html = `<div class="dm-taxbox"><h3>${icon('coins')} 세금 시간</h3><ul>${lines}</ul>
        <p>${ask && ask.k === 'give' ? `<b>${N(ask.to)}</b> 님에게 돌려줄 카드 <b>${ask.n}장</b>을 아래 내 패에서 고르세요.` : `돌려줄 카드를 고르는 중: ${waiting}`}</p></div>`;
    } else {
      const t = v.trick;
      const pileKey = v.pile.map(x => x.by + x.cards.join('')).join('|');
      const animate = pileKey !== this.pileKey; this.pileKey = pileKey;
      const plays = v.pile.slice(-4);
      const pileHtml = plays.length ? plays.map((x, i) => {
        const lastOne = i === plays.length - 1;
        return `<div class="dm-play ${lastOne ? 'top' : 'old'} ${lastOne && animate ? 'in' : ''}" style="--i:${plays.length - 1 - i}">
          <div class="dm-fan">${x.cards.map(c => this.card(c, lastOne ? 'md' : 'sm')).join('')}</div>${lastOne ? `<small>${N(x.by)}</small>` : ''}</div>`;
      }).join('') : '';
      const lead = !t ? (v.turnId === ctx.me ? '<b>내가 선이에요!</b> 같은 숫자 카드를 원하는 만큼 내세요.' : `<b>${N(v.turnId)}</b> 님이 새로 시작해요…`)
        : `다음 사람: <b>${t.count}장</b>, <b>${t.num === 13 ? '아무 숫자' : t.num + '보다 낮은 숫자'}</b>${t.num === 13 ? '' : ''}`;
      html = `<div class="dm-pile ${t ? '' : 'empty'}">${pileHtml || `<div class="dm-emptypile">${icon('crown')}<span>새로운 판</span></div>`}</div>
        <p class="dm-rule">${lead}</p>`;
    }
    box.innerHTML = html;
  },

  /** 내 패: 숫자별 묶음 (1~12, 어릿광대) */
  hand(v, ctx) {
    const hb = $('#dm-hand'), bar = $('#dm-bar'), note = $('#dm-note');
    if (!v.my) { hb.innerHTML = ''; bar.innerHTML = '<p class="muted">구경 중이에요.</p>'; note.innerHTML = ''; return; }
    const ask = v.ask, hand = v.my.hand, c = DalmutiCore.counts(hand), jn = c[13];
    const play = ask && ask.k === 'play', give = ask && ask.k === 'give';
    const sel = this.sel;
    // 세금 안내
    const tx = v.tax;
    note.innerHTML = tx && v.round ? `<span class="dm-taxnote">${icon('coins')}${tx.gave ? `이번 판 세금으로 ${tx.gave.join(', ')}을(를) ${this.name(v, tx.to)} 님에게 바쳤어요${tx.back ? ` · 돌려받은 카드 ${tx.back.join(', ')}` : ''}`
      : tx.got ? `${this.name(v, tx.from)} 님에게 받은 카드: ${tx.got.join(', ')}${tx.back ? ` · 돌려준 카드 ${tx.back.join(', ')}` : ''}` : ''}</span>` : '';
    if (v.revolution && v.phase === 'play') note.innerHTML += `<span class="dm-taxnote rev">${icon('masks-theater')}${v.revolution.great ? '대혁명! 계급이 뒤집혔어요' : '혁명! 이번 판은 세금 없음'}</span>`;
    const groups = [];
    for (let x = 1; x <= 13; x++) if (c[x]) groups.push(x);
    let giveIdx = 0;
    hb.innerHTML = groups.map(x => {
      const n = c[x];
      let ok = true;
      if (play && ask.canPass && x !== 13) ok = x < ask.below && n + jn >= ask.need;
      if (play && ask.canPass && x === 13) ok = jn > 0;
      const cards = Array.from({ length: n }, (_, i) => {
        let on = false;
        if (give) { on = this.give.includes(giveIdx); }
        else on = x === 13 ? i < sel.j : sel.v === x && i < sel.k;
        const html = this.card(x, `hand ${on ? 'sel' : ''}`, `data-act="dmPick" data-x="${x}" data-i="${i}" data-g="${giveIdx}"`, `--k:${i}`);
        giveIdx++;
        return html;
      }).join('');
      return `<div class="dm-group ${play && !ok ? 'no' : ''} ${play || give ? 'live' : ''}" style="--n:${n}">${cards}<span class="dm-cnt">×${n}</span></div>`;
    }).join('') || '<p class="dm-empty">카드를 모두 냈어요!</p>';
    $('#dm-me').classList.toggle('turn', !!(play || give));
    // 버튼
    if (play) {
      const picked = (sel.v ? Array(sel.k).fill(sel.v) : []).concat(Array(sel.j).fill(13));
      const num = sel.v && sel.k ? sel.v : picked.length ? 13 : null;
      let okPlay = picked.length > 0, why = '';
      if (!picked.length) why = ask.lead ? '낼 카드를 고르세요' : `${ask.need}장을 고르세요`;
      else if (ask.canPass && picked.length !== ask.need) { okPlay = false; why = `${ask.need}장을 골라야 해요 (지금 ${picked.length}장)`; }
      else if (ask.canPass && !(num < ask.below)) { okPlay = false; why = `${ask.below}보다 낮아야 해요`; }
      const label = okPlay ? `${num === 13 ? '어릿광대' : DalmutiCore.NAMES[num] + '(' + num + ')'} ${picked.length}장 내기` : why;
      bar.innerHTML = `<button class="btn good" data-act="dmPlay" ${okPlay ? '' : 'disabled'}>${label}</button>
        ${ask.canPass ? '<button class="btn ghost" data-act="dmPass">패스</button>' : ''}
        ${picked.length ? '<button class="btn ghost sm" data-act="dmClear">다시 고르기</button>' : ''}
        <small class="muted">${ask.lead ? '묶음을 누르면 전부, 몇 번째 카드를 누르면 그 장 수만큼 골라져요.' : '낼 수 있는 묶음만 밝게 보여요. 누르면 필요한 장 수만큼 골라져요.'}</small>`;
    } else if (give) {
      bar.innerHTML = `<button class="btn good" data-act="dmGive" ${this.give.length === ask.n ? '' : 'disabled'}>${this.give.length === ask.n ? `카드 ${ask.n}장 돌려주기` : `돌려줄 카드 ${ask.n}장을 고르세요 (${this.give.length}/${ask.n})`}</button>
        <small class="muted">아무 카드나 돌려줄 수 있어요. 보통은 쓸모없는 카드를 줘요!</small>`;
    } else {
      bar.innerHTML = `<span class="dm-mytitle">${this.titleChip(v.my.title)}</span><small class="muted">${v.phase === 'play' && v.turnId ? `${this.name(v, v.turnId)} 님 차례예요.` : ''}</small>`;
    }
  },
};
Object.assign(ACT, {
  dmPick: el => {
    const v = DM.v; if (!v || !v.ask || !v.my) return;
    const x = +el.dataset.x, i = +el.dataset.i, ask = v.ask, c = DalmutiCore.counts(v.my.hand), jn = c[13];
    if (ask.k === 'give') {
      const g = +el.dataset.g;
      if (DM.give.includes(g)) DM.give = DM.give.filter(q => q !== g);
      else { DM.give.push(g); if (DM.give.length > ask.n) DM.give.shift(); }
      DM.hand(v, DM.ctx); return;
    }
    if (ask.k !== 'play') return;
    const s = DM.sel;
    if (x === 13) { s.j = s.j > i ? i : i + 1; if (s.j > jn) s.j = jn; }
    else if (ask.canPass) {                                  // 따라 내기: 필요한 만큼 자동으로
      if (!(x < ask.below && c[x] + jn >= ask.need)) { toast(`${ask.need}장, ${ask.below}보다 낮은 숫자만 낼 수 있어요.`); return; }
      if (s.v === x && s.k + s.j === ask.need) { DM.sel = { v: null, k: 0, j: 0 }; }
      else { const k = Math.min(c[x], ask.need); DM.sel = { v: x, k, j: ask.need - k }; }
    } else {                                                 // 선: 처음엔 묶음 전부, 그다음엔 누른 위치까지
      if (s.v !== x) DM.sel = { v: x, k: c[x], j: 0 };
      else if (s.k === i + 1) DM.sel = { v: null, k: 0, j: s.j };
      else s.k = i + 1;
    }
    DM.hand(v, DM.ctx);
  },
  dmClear: () => { DM.sel = { v: null, k: 0, j: 0 }; if (DM.v) DM.hand(DM.v, DM.ctx); },
  dmPlay: () => {
    const c = DM.ctx, s = DM.sel; if (!c) return;
    const cards = (s.v ? Array(s.k).fill(s.v) : []).concat(Array(s.j).fill(13));
    if (cards.length) c.send({ t: 'play', cards });
  },
  dmPass: () => { if (DM.ctx) DM.ctx.send({ t: 'pass' }); },
  dmGive: () => {
    const v = DM.v, c = DM.ctx; if (!v || !c || !v.ask || v.ask.k !== 'give') return;
    const cards = DM.give.map(g => v.my.hand[g]);
    if (cards.length === v.ask.n) c.send({ t: 'give', cards });
  },
  dmRevolt: el => { if (DM.ctx) DM.ctx.send({ t: 'revolt', yes: el.dataset.yes === '1' }); },
  dmNext: () => { if (DM.ctx) DM.ctx.send({ t: 'next' }); },
  dmSolo: el => {
    DM.bots = +el.dataset.bots;
    Table.solo('dalmuti', { bots: DM.bots, opts: { rounds: 3, solo: true } });
  },
});
Table.def('dalmuti', { core: DalmutiCore, render: (v, ctx, prev) => DM.render(v, ctx, prev), solo: { get bots() { return DM.bots || 5; }, opts: { rounds: 3, solo: true } } });
