/* =====================================================================
 *  🎲 요트 다이스 화면 (규칙: shared/yacht-core.js)
 * ===================================================================== */
makeScreen('yacht', {
  title: '🎲 요트 다이스', status: '주사위 5개를 3번까지 굴려 족보를 채워요. 남길 주사위는 눌러서 고정!',
  stats: [['round', '라운드'], ['rolls', '남은 굴림'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="yc-solo"><span class="muted small">AI 상대</span>
      <button class="seg-btn" data-act="ycSolo" data-bots="0">혼자 (점수 도전)</button><button class="seg-btn on" data-act="ycSolo" data-bots="1">1명</button>
      <button class="seg-btn" data-act="ycSolo" data-bots="2">2명</button><button class="seg-btn" data-act="ycSolo" data-bots="3">3명</button></div>
    <div class="yc-wrap">
      <div class="yc-left">
        <div class="yc-tray felt"><div class="yc-who" id="yc-who"></div><div class="yc-dice" id="yc-dice"></div><div class="yc-hint" id="yc-hint"></div>
          <div class="yc-acts" id="yc-acts"></div></div>
        <div class="yc-msg" id="yc-msg"></div>
      </div>
      <div class="yc-card"><table class="yc-table" id="yc-table"></table></div>
    </div>`,
});

const Yacht = {
  render(v, ctx, prev) {
    const fresh = !prev || this.gen !== Table.cur;
    if (fresh) { this.gen = Table.cur; this.rollN = null; }
    this.v = v; this.ctx = ctx;
    $('#yc-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const mine = v.turnId === ctx.me && !v.over, cur = v.players.find(p => p.id === v.turnId);
    setStat('yacht', 'round', `${v.round} / 12`);
    setStat('yacht', 'rolls', mine || v.rolls ? `${3 - v.rolls}번` : '-');
    $('#yc-who').innerHTML = v.over ? '게임 끝!' : `<i style="--c:${avColor(cur.id)}"></i>${esc(cur.name)} 님 차례${mine ? ' (나)' : ''}`;
    // 주사위
    clearTimeout(this.rollT);
    const rolled = this.rollN != null && v.rollN !== this.rollN;
    this.rollN = v.rollN;
    const box = $('#yc-dice');
    const draw = () => { box.innerHTML = v.dice.map((d, i) => `<button class="yc-die ${v.held[i] ? 'held' : ''} ${!v.rolls ? 'idle' : ''}" data-act="ycHold" data-i="${i}" ${mine && v.rolls && v.rolls < 3 ? '' : 'disabled'}>${Pieces.die(d)}<em>고정</em></button>`).join(''); };
    if (rolled) {
      let n = 0;
      const spin = () => {
        box.innerHTML = v.dice.map((d, i) => `<button class="yc-die ${v.held[i] ? 'held' : 'tumble'}" disabled>${Pieces.die(v.held[i] ? d : 1 + rand(6))}<em>고정</em></button>`).join('');
        if (++n < 7) this.rollT = setTimeout(spin, 70); else draw();
      };
      spin();
    } else draw();
    $('#yc-hint').textContent = !v.rolls ? (mine ? '주사위를 굴려 주세요!' : '') : v.rolls < 3 ? (mine ? '남길 주사위를 누르고 다시 굴리거나, 점수표에서 칸을 고르세요.' : '') : (mine ? '마지막 굴림! 점수 칸을 골라요.' : '');
    $('#yc-acts').innerHTML = mine ? `<button class="btn good lg" data-act="ycRoll" ${v.rolls >= 3 ? 'disabled' : ''}>${v.rolls ? '다시 굴리기' : '굴리기'} <small>${3 - v.rolls}번 남음 · Space</small></button>` : '';
    $('#yc-msg').textContent = v.msg;
    this.table(v, ctx, mine);
  },
  table(v, ctx, mine) {
    const C = YachtCore.CATS, pv = mine && v.preview ? v.preview : null;
    let best = null;
    if (pv) for (const k in pv) if (best == null || pv[k] > pv[best]) best = k;
    const head = `<tr><th>족보</th>${v.players.map(p => `<th class="${p.id === v.turnId && !v.over ? 'turn' : ''}">${esc(p.name)}${p.id === ctx.me ? '<small>나</small>' : ''}</th>`).join('')}</tr>`;
    const row = ([k, name, desc]) => `<tr class="${k === 'n6' ? 'sep' : ''}"><td title="${desc}"><b>${name}</b><small>${desc}</small></td>${v.players.map(p => {
      const val = p.score[k];
      if (val != null) return `<td class="done ${val === 0 ? 'zero' : ''}">${val}</td>`;
      if (pv && p.id === ctx.me) return `<td class="pick ${k === best ? 'best' : ''} ${pv[k] === 0 ? 'zero' : ''}" data-act="ycScore" data-cat="${k}">${pv[k]}</td>`;
      if (p.id === v.turnId && v.preview && p.id !== ctx.me) return `<td class="peek">${v.preview[k]}</td>`;
      return '<td></td>';
    }).join('')}</tr>`;
    const upper = C.slice(0, 6).map(row).join(''), lower = C.slice(6).map(row).join('');
    const bonus = `<tr class="sub"><td><b>보너스</b><small>위쪽 합 63점 이상이면 +35</small></td>${v.players.map(p => `<td class="${p.bonus ? 'ok' : ''}">${p.bonus ? '+35' : `${p.upper}<small>/63</small>`}</td>`).join('')}</tr>`;
    const total = `<tr class="total"><td><b>총점</b></td>${v.players.map(p => `<td>${p.total}</td>`).join('')}</tr>`;
    // 위쪽 · 아래쪽 두 묶음: 큰 화면에선 한 표, 낮은 화면에선 나란히 두 칸 (두 번째 머리줄은 그때만 보여요 — fit-a.css)
    $('#yc-table').innerHTML = `<tbody class="yc-up">${head}${upper}${bonus}</tbody><tbody class="yc-lo">${head.replace('<tr>', '<tr class="yc-head2">')}${lower}${total}</tbody>`;
  },
};
Object.assign(ACT, {
  ycRoll: () => { const v = Yacht.v, c = Yacht.ctx; if (v && c && v.turnId === c.me && v.rolls < 3) c.send({ t: 'roll' }); },
  ycHold: el => { const c = Yacht.ctx; if (!c) return; el.classList.toggle('held'); c.send({ t: 'hold', i: +el.dataset.i }); },
  ycScore: el => { const c = Yacht.ctx; if (c) c.send({ t: 'score', cat: el.dataset.cat }); },
  ycSolo: el => {
    Yacht.bots = +el.dataset.bots;
    Table.solo('yacht', { bots: Yacht.bots });
    $$('#yc-solo .seg-btn').forEach(b => b.classList.toggle('on', +b.dataset.bots === Yacht.bots));
  },
});
Table.def('yacht', {
  core: YachtCore, render: (v, ctx, prev) => Yacht.render(v, ctx, prev), solo: { bots: 1 },
  key: (e, ctx) => {
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) ACT.ycRoll();
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 }[e.code];
    if (n != null && !e.repeat) { const b = $$('#yc-dice .yc-die')[n]; if (b && !b.disabled) ACT.ycHold(b); }
  },
});
