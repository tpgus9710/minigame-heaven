/* =====================================================================
 *  🀄 마작 솔리테어 (상하이) — 싱글: 판을 다 비우는 시간 기록 / 멀티: 같은 판 4분 점수 대결 (games/scorerace.js)
 *  쌓인 패 중에서 '풀린 패'(위에 아무것도 없고, 왼쪽이나 오른쪽 한쪽이 비어 있는 패) 같은 그림 두 장을 골라 없애요.
 *  판은 항상 풀 수 있게 만들어요: 빈 판에서 거꾸로, 그때그때 풀린 자리 두 곳에 같은 그림을 넣어 가며 채워요.
 *  자리 단위: 반 칸 (패 하나 = 가로 2 · 세로 2). z = 층. 패 그림은 사천성과 같은 24가지(春夏秋冬 · 東南西北 · 梅蘭菊竹 …).
 * ===================================================================== */
const MJ = {
  SECONDS: 240,
  shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  /* 판 모양: 층마다 { o: [x, y] 반 칸 단위 시작 자리, r: 줄 (x = 패) } — 세로 화면용(port) · 가로 화면용(land), 모두 96장 이하 · 4의 배수 */
  LAYOUTS: {
    port: [
      { name: '피라미드', L: [
        { o: [0, 0], r: ['.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.'] },
        { o: [4, 4], r: ['xxxx', 'xxxx', 'xxxx', 'xxxx', 'xxxx'] },
        { o: [6, 6], r: ['xx', 'xx', 'xx'] },
        { o: [6, 7], r: ['xx'] }] },
      { name: '쌍둥이 탑', L: [
        { o: [0, 0], r: ['.xx..xx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xx..xx.'] },
        { o: [2, 4], r: ['xx..xx', 'xx..xx', 'xx..xx', 'xx..xx', 'xx..xx'] },
        { o: [2, 6], r: ['xx..xx', 'xx..xx', 'xx..xx'] }] },
      { name: '다이아몬드', L: [
        { o: [0, 0], r: ['...xx...', '..xxxx..', '.xxxxxx.', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', '.xxxxxx.', '..xxxx..', '...xx...'] },
        { o: [2, 2], r: ['..xx..', '.xxxx.', 'xxxxxx', 'xxxxxx', '.xxxx.', '..xx..'] },
        { o: [4, 4], r: ['.xx.', 'xxxx', 'xxxx', '.xx.'] },
        { o: [6, 6], r: ['xx', 'xx'] }] },
    ],
    wide: [                                                                     // 노트북 · 휴대폰 가로처럼 아주 넓은 화면: 5줄짜리
      { name: '성벽', L: [
        { o: [0, 0], r: ['.xxxxxxxxxxxx.', 'xxxxxxxxxxxxxx', 'xxxxxxxxxxxxxx', 'xxxxxxxxxxxxxx', '.xxxxxxxxxxxx.'] },
        { o: [4, 2], r: ['xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx'] }] },
      { name: '쌍둥이 탑', L: [
        { o: [0, 0], r: ['xxxxxx..xxxxxx', 'xxxxxx..xxxxxx', 'xxxxxx..xxxxxx', 'xxxxxx..xxxxxx', 'xxxxxx..xxxxxx'] },
        { o: [2, 2], r: ['xxxx....xxxx', 'xxxx....xxxx', 'xxxx....xxxx'] },
        { o: [4, 3], r: ['xx......xx', 'xx......xx'] },
        { o: [5, 3], r: ['x.......x', 'x.......x'] }] },
    ],
    land: [
      { name: '피라미드', L: [
        { o: [0, 0], r: ['.xxxxxxxxxx.', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', '.xxxxxxxxxx.'] },
        { o: [8, 4], r: ['xxxx', 'xxxx', 'xxxx'] },
        { o: [10, 5], r: ['xx', 'xx'] }] },
      { name: '쌍둥이 탑', L: [
        { o: [0, 0], r: ['xxxxx..xxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxx..xxxxx'] },
        { o: [4, 4], r: ['xx....xx', 'xx....xx', 'xx....xx'] },
        { o: [4, 6], r: ['xx....xx'] }] },
      { name: '다이아몬드', L: [
        { o: [0, 0], r: ['....xxxx....', '..xxxxxxxx..', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', '..xxxxxxxx..', '....xxxx....'] },
        { o: [2, 3], r: ['...xxxx...', '.xxxxxxxx.', '.xxxxxxxx.', '...xxxx...'] },
        { o: [6, 5], r: ['xxxx', 'xxxx'] },
        { o: [8, 5], r: ['xx', 'xx'] }] },
    ],
  },
  /** 판 모양 → 자리 목록 [{ x, y, z }] */
  places(lay) {
    const out = [];
    lay.L.forEach((l, z) => l.r.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === 'x') out.push({ x: l.o[0] + rx * 2, y: l.o[1] + ry * 2, z }); })));
    return out;
  },
  /** 풀린 패인가: 위층에 겹치는 패가 없고, 같은 층 왼쪽 · 오른쪽 중 한쪽이 비어 있어야 해요 */
  free(t, live) {
    let L = false, R = false;
    for (const u of live) {
      if (u === t) continue;
      if (u.z > t.z && Math.abs(u.x - t.x) < 2 && Math.abs(u.y - t.y) < 2) return false;
      if (u.z === t.z && Math.abs(u.y - t.y) < 2) { if (u.x === t.x - 2) L = true; else if (u.x === t.x + 2) R = true; }
    }
    return !(L && R);
  },
  /**
   * 항상 풀 수 있는 판: 자리들에서 거꾸로 — 지금 풀린 자리 두 곳을 골라 같은 그림 짝을 넣고 빼기를 되풀이.
   * kinds: 넣을 그림 목록(짝 단위로 같은 그림 두 장씩, 길이 = 자리 수) → 자리마다 그림 (실패하면 null)
   */
  deal(spots, kinds, rnd) {
    const pairs = [];
    const cnt = new Map(); kinds.forEach(k => cnt.set(k, (cnt.get(k) || 0) + 1));
    for (const [k, n] of cnt) for (let i = 0; i < n / 2; i++) pairs.push(k);
    for (let tries = 0; tries < 300; tries++) {
      const live = spots.slice(), got = new Map(), pk = MJ.shuffle(pairs.slice(), rnd);
      let ok = true;
      for (const k of pk) {
        const fr = live.filter(t => this.free(t, live));
        if (fr.length < 2) { ok = false; break; }
        const a = fr[Math.floor(rnd() * fr.length)];
        let rest = fr.filter(t => t !== a);
        const far = rest.filter(t => t.z !== a.z || Math.abs(t.x - a.x) + Math.abs(t.y - a.y) > 4);   // 바로 옆끼리 짝이 되지 않게 조금 떨어뜨려요
        if (far.length && rnd() < 0.8) rest = far;
        const b = rest[Math.floor(rnd() * rest.length)];
        got.set(a, k); got.set(b, k);
        live.splice(live.indexOf(a), 1); live.splice(live.indexOf(b), 1);
      }
      if (ok) return spots.map(t => got.get(t));
    }
    return null;
  },
};
makeScreen('mahjong', {
  title: '🀄 마작 솔리테어', status: '풀린 패(위가 비고 왼쪽이나 오른쪽이 빈 패) 중 같은 그림 두 장을 눌러 없애요. 판을 다 비우면 클리어!',
  stats: [['left', '남은 패'], ['moves', '맞출 수 있는 짝'], ['time', '시간']],
  body: `<div class="mj-area" id="mj-area"><div class="mj-wrap" id="mj-wrap"><div class="mj-board" id="mj-board"></div><div class="ss-pop" id="mj-pop"></div></div>
    <div class="mj-tools"><button class="btn ghost sm" data-act="mjUndo" id="mj-undo">되돌리기</button><button class="btn ghost sm" data-act="mjHint">힌트 <small id="mj-hints"></small></button><button class="btn ghost sm" data-act="mjShuffle">섞기 <small id="mj-shuf"></small></button><span class="muted small" id="mj-name"></span></div></div>`,
});
$('#scr-mahjong').dataset.fitSelf = '1';

const Mahjong = {
  tiles: [], sel: null, over: true, hist: [],
  start(opt) {
    stopLocal();
    this.multi = !!opt.seed;
    S.solo = this.multi ? null : 'mahjong';
    this.rnd = this.multi ? seeded(opt.seed) : Math.random;
    show('mahjong'); if (this.multi) renderScores();
    const d = this.dims();
    this.orient = this.multi ? 'port' : d.W / d.H >= 2 ? 'wide' : d.W / d.H >= 1.05 ? 'land' : 'port';   // 멀티는 모두 같은 판(세로판)
    const fam = MJ.LAYOUTS[this.orient], lay = fam[Math.floor(this.rnd() * fam.length)];
    const spots = MJ.places(lay), nk = spots.length / 4;
    const kinds = MJ.shuffle([...Array(SS.KINDS.length).keys()], this.rnd).slice(0, nk);
    let faces = MJ.deal(spots, [].concat(...kinds.map(k => [k, k, k, k])), this.rnd);
    if (!faces) faces = MJ.shuffle([].concat(...kinds.map(k => [k, k, k, k])), this.rnd);
    this.tiles = spots.map((p, i) => ({ ...p, k: faces[i], id: i, on: true }));
    Object.assign(this, { lay, sel: null, over: false, hist: [], score: 0, combo: 0, lastHit: 0, hints: 3, shuffles: this.multi ? 2 : 3, lastSent: -1,
      t0: performance.now(), endAt: performance.now() + (opt.seconds || MJ.SECONDS) * 1000 });
    $('#mj-undo').classList.toggle('hidden', this.multi);
    $('#mahjong-time-label').textContent = this.multi ? '남은 시간' : '시간';
    $('#mahjong-moves-label').textContent = this.multi ? '점수' : '맞출 수 있는 짝';
    $('#mj-name').textContent = `판: ${lay.name} · ${this.tiles.length}장`;
    setStatus('mahjong', this.multi ? '🀄 모두 같은 판! 4분 동안 짝을 맞춰 점수를 올려요. 3초 안에 계속 맞히면 콤보!' : '풀린 패(위가 비고 왼쪽이나 오른쪽이 빈 패) 중 같은 그림 두 장을 눌러 없애요. 판을 다 비우면 클리어!');
    this.build(); this.fit(); this.refresh();
    const gen = S.gen;
    every(250, () => {
      if (gen !== S.gen || this.over) return;
      if (this.multi) { setStat('mahjong', 'time', leftSec(this.endAt) + '초'); if (performance.now() >= this.endAt) this.end(false); }
      else setStat('mahjong', 'time', this.clock());
    });
  },
  clock() { const s = Math.floor((performance.now() - this.t0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
  live() { return this.tiles.filter(t => t.on); },
  /** 패 그리기 (한 번 만들고, 없어지면 숨겨요) */
  build() {
    const order = this.tiles.slice().sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
    $('#mj-board').innerHTML = order.map(t => `<button class="mj-tile ${SS.KINDS[t.k][1]}" data-id="${t.id}" style="--x:${t.x};--y:${t.y};--z:${t.z};z-index:${t.z * 1000 + t.y * 30 + t.x}"><b>${SS.KINDS[t.k][0]}</b></button>`).join('');
  },
  el(t) { return $(`#mj-board .mj-tile[data-id="${t.id}"]`); },
  /** 판이 쓸 수 있는 자리 { side(도구를 옆에), W, H } — 넓고 낮은 화면(노트북 · 휴대폰 가로)은 도구를 오른쪽 세로줄로 */
  dims() {
    const sec = $('#scr-mahjong'), area = $('#mj-area');
    const z = +(sec.dataset.z || 1) || 1;
    const room = typeof Fit !== 'undefined' ? Fit.room(sec) : innerHeight - sec.getBoundingClientRect().top;
    const top = (area.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const AW = area.clientWidth || sec.clientWidth || innerWidth, AH = Math.max(160, room - top - 6);
    const side = AW / AH >= 1.6;
    area.classList.toggle('side', side);
    const tools = $('#scr-mahjong .mj-tools');
    return side ? { side, W: AW - (tools.offsetWidth || 120) - 18, H: AH } : { side, W: AW - 4, H: Math.max(160, AH - (tools.offsetHeight || 40) - 14) };
  },
  /** 판 크기: 남는 자리에서 가장 크게 */
  fit() {
    const sec = $('#scr-mahjong'), board = $('#mj-board');
    if (!sec.classList.contains('active') || !this.tiles.length) return;
    const { W, H } = this.dims();
    const cols = (Math.max(...this.tiles.map(t => t.x)) + 2) / 2, rows = (Math.max(...this.tiles.map(t => t.y)) + 2) / 2, Lz = Math.max(...this.tiles.map(t => t.z));
    const R = 1.3, D = 0.1;                                                    // 패 세로 ÷ 가로 · 층마다 위로 올라가 보이는 정도(패 너비 비율)
    const tw = Math.floor(Math.min(W / (cols + (Lz + 1) * D), H / (rows * R + (Lz + 1) * D), 96));
    board.style.setProperty('--tw', tw + 'px'); board.style.setProperty('--th', Math.round(tw * R) + 'px'); board.style.setProperty('--d', Math.max(2, Math.round(tw * D)) + 'px');
    board.style.width = Math.ceil(cols * tw + (Lz + 1) * tw * D) + 'px'; board.style.height = Math.ceil(rows * tw * R + (Lz + 1) * tw * D) + 'px';
    board.style.setProperty('--lz', Lz);
  },
  /** 풀린 패 표시 · 남은 패 · 맞출 수 있는 짝 */
  refresh() {
    const live = this.live(), byK = new Map();
    for (const t of this.tiles) {
      const el = this.el(t); if (!el) continue;
      if (!t.on) { el.classList.add('gone'); continue; }
      t.free = MJ.free(t, live);
      el.classList.remove('gone');
      el.classList.toggle('lock', !t.free);
      el.classList.toggle('sel', this.sel === t);
      if (t.free) byK.set(t.k, (byK.get(t.k) || 0) + 1);
    }
    let moves = 0;
    for (const n of byK.values()) moves += n * (n - 1) / 2;
    this.moves = moves;
    setStat('mahjong', 'left', `${live.length}장`);
    setStat('mahjong', 'moves', this.multi ? this.score.toLocaleString() : `${moves}`);
    $('#mj-hints').textContent = `${this.hints}회`; $('#mj-shuf').textContent = `${this.shuffles}회`;
    if (this.multi && this.score !== this.lastSent) { this.lastSent = this.score; socket.emit('sr:score', this.score); }
    if (!this.over && live.length && !moves) this.stuck();
  },
  stuck() {
    if (this.shuffles > 0) { this.pop('맞출 수 있는 짝이 없어요 — 자동으로 섞을게요'); setTimeout(() => { if (!this.over && !this.moves) this.shuffle(true); }, 900); }
    else this.end(false, '더 맞출 수 있는 짝이 없어요');
  },
  pop(t) { const el = $('#mj-pop'); el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
  tap(id) {
    if (this.over) return;
    const t = this.tiles[id];
    if (!t || !t.on) return;
    const el = this.el(t);
    if (!t.free) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); this.pop('막힌 패예요 — 위가 비고 옆 한쪽이 빈 패만 골라요'); return; }
    if (!this.sel || this.sel === t) { this.sel = this.sel === t ? null : t; if (typeof Sound !== 'undefined') Sound.blip(700, 0.03, 0.5); this.refresh(); return; }
    if (this.sel.k !== t.k) { this.sel = t; this.refresh(); return; }
    const a = this.sel; this.sel = null;
    this.match(a, t);
  },
  match(a, b) {
    const now = performance.now();
    this.combo = now - this.lastHit < 3000 ? this.combo + 1 : 0; this.lastHit = now;
    const pts = 10 + this.combo * 5;
    this.score += pts;
    a.on = b.on = false;
    this.hist.push([a.id, b.id]);
    if (typeof Sound !== 'undefined') Sound.play('pop');
    [a, b].forEach(t => { const el = this.el(t); if (el) { el.classList.add('out'); setTimeout(() => el.classList.remove('out'), 320); } });
    if (this.combo) this.pop(`${this.combo + 1} 콤보! +${pts}`);
    setTimeout(() => {
      this.refresh();
      if (!this.live().length) this.end(true);
    }, 250);
  },
  undo() {
    if (this.over || this.multi || !this.hist.length) return;
    const [a, b] = this.hist.pop();
    this.tiles[a].on = this.tiles[b].on = true;
    this.sel = null; this.score = Math.max(0, this.score - 10);
    this.refresh();
  },
  hint() {
    if (this.over || !this.hints) return;
    const fr = this.live().filter(t => t.free);
    for (let i = 0; i < fr.length; i++) for (let j = i + 1; j < fr.length; j++) if (fr[i].k === fr[j].k) {
      this.hints--; if (this.multi) this.score = Math.max(0, this.score - 30);
      [fr[i], fr[j]].forEach(t => { const el = this.el(t); el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); });
      this.refresh();
      return;
    }
  },
  /** 섞기: 남은 패를 다시 '풀 수 있게' 나눠요 (자리는 그대로, 그림만) */
  shuffle(auto) {
    if (this.over || this.shuffles <= 0) return;
    this.shuffles--; this.sel = null;
    const live = this.live(), faces = MJ.deal(live, live.map(t => t.k), this.rnd) || MJ.shuffle(live.map(t => t.k), this.rnd);
    live.forEach((t, i) => { t.k = faces[i]; const el = this.el(t); el.className = `mj-tile ${SS.KINDS[t.k][1]}`; el.querySelector('b').textContent = SS.KINDS[t.k][0]; });
    this.hist = [];                                                            // 섞은 뒤에는 되돌리기 없음
    this.pop(auto ? '섞었어요!' : '섞었어요!');
    this.refresh();
  },
  end(cleared, why) {
    if (this.over) return;
    this.over = true;
    const secs = Math.round((performance.now() - this.t0) / 1000);
    if (this.multi) {
      if (cleared) this.score += 300 + leftSec(this.endAt) * 5;
      socket.emit('sr:score', this.score); socket.emit('sr:over');
      setStatus('mahjong', `${cleared ? '🎉 클리어!' : '⏰ 끝!'} ${this.score.toLocaleString()}점 — 결과를 기다리는 중…`);
      return;
    }
    const best = +store.get('best-mahjong', 0);
    if (cleared && (!best || secs < best)) store.set('best-mahjong', secs);
    const nb = cleared && (!best || secs < best) ? secs : best;
    const fmt = s => `${Math.floor(s / 60)}분 ${s % 60}초`;
    showResult({ title: cleared ? '🀄 클리어!' : '🀄 더 이상 맞출 수 없어요', subtitle: cleared ? `${fmt(secs)} · ${this.lay.name}${nb ? ` · 최고 기록 ${fmt(nb)}` : ''}` : `${why || ''} · 남은 패 ${this.live().length}장${nb ? ` · 최고 기록 ${fmt(nb)}` : ''}`,
      solo: 'mahjong', win: cleared, rec: cleared ? { v: secs } : null });
  },
};
$('#mj-board').addEventListener('click', e => { const t = e.target.closest('.mj-tile'); if (t) Mahjong.tap(+t.dataset.id); });
Object.assign(ACT, { mjHint: () => Mahjong.hint(), mjShuffle: () => Mahjong.shuffle(false), mjUndo: () => Mahjong.undo() });
register('mahjong', { solo: () => Mahjong.start({}), multi: d => Mahjong.start({ seed: d.seed, seconds: d.seconds }), stop: () => { Mahjong.over = true; } });
window.addEventListener('resize', () => { if (isScreen('mahjong')) { clearTimeout(Mahjong.rt); Mahjong.rt = setTimeout(() => Mahjong.fit(), 120); } });
