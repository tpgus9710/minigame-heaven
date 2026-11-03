/* =====================================================================
 *  🎲 차례형 보드·카드 게임 화면 공통 — 싱글(내 브라우저에서 봇과) · 멀티(서버가 보내준 정보) 둘 다 처리
 *  게임 파일은 Table.def('키', { core, render(view, ctx, prev), key?(e, ctx), solo: { bots, opts } }) 로 등록해요.
 *  render 에서 사람이 행동하면 ctx.send({ t: '행동', ... }) 를 부르면 됩니다.
 * ===================================================================== */
const LOBBY_OPTIONS = {};            // 대기실에 보여줄 게임 옵션 (봇 수 · 라운드 등)
const BOT_NAMES = ['봇 알파', '봇 브라보', '봇 찰리', '봇 델타', '봇 에코', '봇 폭스', '봇 골프', '봇 호텔'];

/** 서버 시계 기준 지금 시각 (휴대폰 시계가 틀려도 남은 시간이 맞게) */
const serverNow = () => Date.now() + (Table.skew || 0);
const Table = {
  defs: {}, cur: null, skew: 0,
  def(key, d) {
    this.defs[key] = d;
    if (d.core.meta.options) LOBBY_OPTIONS[key] = d.core.meta.options;
    register(key, {
      solo: () => this.solo(key),
      stop: () => this.stop(key),
      key: e => { const c = this.cur; if (c && c.key === key && d.key && c.view) d.key(e, this.ctx()); },
      pad: d.pad,
    });
  },
  ctx() {
    const c = this.cur;
    return { me: c.me, mode: c.mode, key: c.key, send: a => this.send(a), view: c.view, players: c.players };
  },
  /** 싱글: 봇과 대전 (soloOpts 로 봇 수 등 바꾸기) */
  solo(key, soloOpts) {
    stopLocal();
    const d = this.defs[key], so = Object.assign({}, d.solo || {}, soloOpts || {});
    const players = [{ id: 'me', name: nick() }];
    for (let i = 0; i < (so.bots ?? 1); i++) players.push({ id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], bot: true });
    const c = this.cur = { key, mode: 'solo', me: 'me', view: null, prev: null, so, players };
    S.solo = key;
    c.T = TableKit.createTable(d.core, players, {
      rnd: Math.random, opts: so.opts || {}, timeouts: false,
      setTimer: (fn, ms) => after(ms, fn), clearTimer: t => clearTimeout(t),
      onUpdate: () => { if (this.cur === c) this.refresh(); },
      onEnd: res => { if (this.cur === c) this.endSolo(c, res); },
      log: m => console.warn(m),
    });
    show(key);
    this.refresh();
    this.tick();
  },
  refresh() { const c = this.cur; if (!c) return; if (c.mode === 'solo') { c.view = c.T.view('me'); this.skew = 0; } this.paint(); },
  paint() {
    const c = this.cur; if (!c || !c.view) return;
    const d = this.defs[c.key];
    try { d.render(c.view, this.ctx(), c.prev); } catch (e) { console.error(e); }
    c.prev = c.view;
  },
  send(a) {
    const c = this.cur; if (!c) return;
    if (c.mode === 'solo') { const err = c.T.act('me', a); if (err) toast(err); }
    else socket.emit('tb:act', a);
  },
  /** 남은 시간 표시 (화면에 '-time' 칸이 있으면) */
  tick() {
    every(250, () => {
      const c = this.cur; if (!c || !c.view) return;
      const end = c.view.turnEnd;
      setStat(c.key, 'time', end ? Math.max(0, Math.ceil((end - serverNow()) / 1000)) + '초' : '-');
    });
  },
  endSolo(c, res) {
    const name = id => (c.players.find(p => p.id === id) || {}).name || '?';
    const rk = res.ranking || [], mine = rk.find(r => r.id === 'me');
    const top = rk.filter(r => rk.length && r.value === rk[0].value);
    const win = c.players.length > 1 && (Array.isArray(res.winners) ? res.winners.includes('me') : !/무승부/.test(res.title || '') && top.some(r => r.id === 'me'));
    const rec = mine && typeof mine.score === 'number' ? { v: mine.score } : undefined;
    after(1500, () => showResult({ title: res.title, subtitle: res.subtitle || '', lines: res.lines || [], ranking: rk.map(r => ({ name: name(r.id), value: r.value })), solo: c.key, win, rec }));
  },
  stop(key) { const c = this.cur; if (c && (!key || c.key === key)) { if (c.T) c.T.stop(); this.cur = null; } },
  startMulti(key) {
    stopLocal();
    this.cur = { key, mode: 'multi', me: S.myId, view: null, prev: null, players: [] };
    show(key); renderScores();
    this.tick();
  },
};
socket.on('tb:start', d => Table.startMulti(d.game));
socket.on('tb:view', d => {
  if (!Table.cur || Table.cur.mode !== 'multi' || Table.cur.key !== d.game) Table.startMulti(d.game);
  if (d.v && d.v.now) Table.skew = d.v.now - Date.now();
  Table.cur.view = d.v;
  if (d.v.players) Table.cur.players = d.v.players;
  Table.paint();
});

/* ─── 보드게임 화면에서 자주 쓰는 그림 도구 ─── */
const Pieces = {
  /** 주사위 눈 HTML (3D 느낌) */
  die(n, cls = '') {
    const pips = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n] || [];
    return `<div class="die ${cls}">${Array.from({ length: 9 }, (_, i) => `<i class="${pips.includes(i + 1) ? 'on' : ''}"></i>`).join('')}</div>`;
  },
  /** 트럼프 카드 HTML. code: 'S1'~'C13', 'JK'(조커), null(뒷면) */
  card(code, cls = '') {
    if (!code) return `<div class="pc back ${cls}"></div>`;
    if (code === 'JK' || code === 'JB' || code === 'JC') return `<div class="pc joker ${cls}"><b>JOKER</b><span>★</span></div>`;
    const s = code[0], r = +code.slice(1), sym = { S: '♠', H: '♥', D: '♦', C: '♣' }[s];
    const label = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || r;
    return `<div class="pc ${s === 'H' || s === 'D' ? 'red' : ''} ${cls}" data-card="${code}"><i>${label}<br>${sym}</i><span>${r > 10 ? label : sym}</span><i class="br">${label}<br>${sym}</i></div>`;
  },
  money: n => (Math.round(n) || 0).toLocaleString('ko-KR'),
};
