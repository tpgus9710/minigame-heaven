/* =====================================================================
 *  ⚫ 리버시 화면 (규칙: shared/reversi-core.js) — 뒤집히는 돌 애니메이션 · 둘 수 있는 곳 표시
 * ===================================================================== */
makeScreen('reversi', {
  title: '⚫ 리버시', status: '상대 돌을 내 돌 사이에 끼워 뒤집어요. 모서리를 차지하면 유리해요!',
  stats: [['black', '흑'], ['white', '백'], ['time', '남은 시간']],
  body: `<div class="mode-row" id="rv-solo"><span class="muted small">AI 실력</span>
      <button class="seg-btn" data-act="rvSolo" data-level="easy">쉬움</button><button class="seg-btn on" data-act="rvSolo" data-level="normal">보통</button><button class="seg-btn" data-act="rvSolo" data-level="hard">어려움</button></div>
    <div class="rv-wrap"><div class="rv-board" id="rv-board"></div>
      <div class="rv-side"><div class="rv-players" id="rv-players"></div><div class="rv-msg" id="rv-msg"></div></div></div>`,
});
$('#rv-board').innerHTML = Array.from({ length: 64 }, (_, i) => `<button class="rv-cell" data-act="rvMove" data-i="${i}"><i class="rv-disc"></i></button>`).join('');

const RV = {
  render(v, ctx, prev) {
    if (!prev || this.gen !== Table.cur) { this.gen = Table.cur; this.board = null; }
    this.v = v; this.ctx = ctx;
    $('#rv-solo').classList.toggle('hidden', ctx.mode !== 'solo');
    const mine = v.turnId === ctx.me, me = v.players.find(p => p.id === ctx.me), legal = new Set(mine ? v.legal : []);
    const cells = $$('#rv-board .rv-cell'), old = this.board;
    v.board.forEach((c, i) => {
      const el = cells[i], d = el.firstChild;
      el.classList.toggle('can', legal.has(i));
      el.classList.toggle('last', v.last === i);
      d.className = 'rv-disc' + (c === 1 ? ' black' : c === 2 ? ' white' : '');
      if (old && old[i] && c && old[i] !== c) { d.classList.add('flip'); d.style.animationDelay = `${(v.flipped.indexOf(i) % 8) * 35}ms`; }
      else if (old && !old[i] && c) d.classList.add('place');
      el.style.setProperty('--hint', me && me.color === 2 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)');
    });
    this.board = v.board.slice();
    const b = v.players.find(p => p.color === 1), w = v.players.find(p => p.color === 2);
    setStat('reversi', 'black', b ? b.n : 0); setStat('reversi', 'white', w ? w.n : 0);
    $('#rv-players').innerHTML = v.players.map(p => `<div class="rv-p ${p.id === v.turnId ? 'turn' : ''} ${p.id === v.winner ? 'win' : ''}">
      <i class="rv-disc ${p.color === 1 ? 'black' : 'white'}"></i><div><b>${esc(p.name)}${p.id === ctx.me ? ' (나)' : ''}</b><small>${p.color === 1 ? '흑 · 먼저' : '백'}</small></div><em>${p.n}</em></div>`).join('')
      + `<div class="rv-bar"><span style="width:${(b ? b.n : 0) / Math.max(1, (b ? b.n : 0) + (w ? w.n : 0)) * 100}%"></span></div>`;
    $('#rv-msg').textContent = v.msg + (mine ? ' · 점이 찍힌 칸에 둘 수 있어요.' : '');
  },
};
Object.assign(ACT, {
  rvMove: el => { const v = RV.v, c = RV.ctx; if (v && c && v.turnId === c.me && el.classList.contains('can')) c.send({ t: 'move', i: +el.dataset.i }); },
  rvSolo: el => {
    RV.level = el.dataset.level;
    Table.solo('reversi', { bots: 1, opts: { level: RV.level } });
    $$('#rv-solo .seg-btn').forEach(b => b.classList.toggle('on', b.dataset.level === RV.level));
  },
});
Table.def('reversi', { core: ReversiCore, render: (v, ctx, prev) => RV.render(v, ctx, prev), solo: { bots: 1, opts: { level: 'normal' } } });
