// 따라 하기 각본 검사: 화면 없이 실제 규칙(TableKit + 게임 규칙)으로 각본을 처음부터 끝까지 돌려 봐요
//  - 단계 모양(말 · 넘어가는 방법) · 정해 둔 판이 규칙에 맞는지
//  - demo(각 단계에서 보낼 행동)를 보내면 allow 가 받아 주고 규칙도 받아 주는지
//  - 봇은 bots 단계에서만 움직이고, 모든 until 이 차례대로 맞는지 → 끝난 뒤 진짜 AI로 이어서 쳐도 오류가 없는지
global.self = global;
const TableKit = require('../public/js/shared/table.js');
const CORES = { gostop: 'gostop-core', bang: 'bang-core', coup: 'coup-core', dalmuti: 'dalmuti-core', rummi: 'rummi-core' };
const defs = {};
global.Tutorial = { add: (k, d) => { defs[k] = d; }, rng: s => rng(s) };       // 각본이 쓰는 엔진 기능 (tutorial.js 와 같게)
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
/** tutorial.js 와 같은 난수 */
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function replay(key, Base, d) {
  const players = [{ id: 'me', name: '나' }];
  for (let i = 0; i < (d.bots ?? 1); i++) players.push({ id: 'bot' + i, name: '봇' + i, bot: true });
  const run = { i: 0, hold: false, live: true };
  const step = () => d.steps[run.i];
  // tutorial.js 의 start() 와 같은 바꿔 끼우기
  const core = Object.create(Base);
  core.meta = Object.assign({}, Base.meta, { botDelay: [10, 10] });
  core.setup = (pl, rnd, opts) => { const st = Base.setup(pl, rng(d.seed || 7), opts); if (d.prepare) d.prepare(st, pl); return st; };
  const botAct = (st, id) => {
    const s = step();
    if (!s || !s.bots || run.hold) return null;
    const a = d.bot ? d.bot(st, id, Base, run.i) : undefined;
    return a !== undefined ? a : Base.ai(st, id);
  };
  core.ai = (st, id) => (run.live ? botAct(st, id) : Base.ai(st, id));
  core.auto = (st, id) => (run.live ? botAct(st, id) : (Base.auto || Base.ai)(st, id));
  let denied = null;
  core.act = (st, id, a) => {
    if (run.live && id === 'me' && !(d.always && d.always(a, st) === true)) {
      const s = step(), r = s && s.allow && !run.hold ? s.allow(a, st) : false;
      if (r !== true) { denied = typeof r === 'string' ? r : 'allow 가 막음'; return denied; }
    }
    return Base.act(st, id, a);
  };
  core.deadline = st => { if (run.live && !(step() || {}).timed) return null; return Base.deadline ? Base.deadline(st) : null; };
  // 가짜 시계 (봇 타이머 · 시간 진행)
  let now = Date.now(), ended = null;
  const timers = [];
  const realNow = Date.now;
  Date.now = () => now;
  try {
    const T = TableKit.createTable(core, players, {
      rnd: rng(99), opts: d.opts || {}, timeouts: false,
      setTimer: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; },
      clearTimer: t => { const j = timers.indexOf(t); if (j >= 0) timers.splice(j, 1); },
      onUpdate: () => {}, onEnd: res => { ended = res; }, log: () => {},
    });
    const tick = () => { timers.sort((a, b) => a.at - b.at); const t = timers.shift(); if (!t) return false; now = Math.max(now, t.at); t.fn(); return true; };
    const until = s => { try { return !!s.until(T.view('me'), T.state); } catch (e) { return false; } };
    let problem = '', screenOnly = 0;
    for (run.i = 0; run.i < d.steps.length && !problem; run.i++) {
      const s = step();
      run.hold = false;
      if (s.enter) s.enter(T.state);
      if (s.bots || s.timed) T.poke();
      if (s.next && !s.until) continue;
      if (s.allow && s.demo === null) { screenOnly++; continue; }               // 화면 안에서만 하는 단계 (타일 고르기 등) → 다음 단계의 행동이 한꺼번에 보내요
      if (s.allow) {
        const list = s.demo === undefined ? [] : [].concat(typeof s.demo === 'function' ? s.demo(T.state) : s.demo);
        if (!list.length) { problem = `단계 ${run.i}: demo 가 없어요`; break; }
        for (const a of list) {
          denied = null;
          const err = T.act('me', a);
          if (err) { problem = `단계 ${run.i}: ${JSON.stringify(a)} → ${err}${denied ? ' (따라 하기가 막음)' : ''}`; break; }
          for (let k = 0; k < 5 && timers.some(t => t.at <= now); k++) tick();   // 바로 이어지는 처리
        }
        if (problem) break;
      }
      let guard = 0;
      while (!until(s) && guard++ < 400) { if (!tick()) break; }
      if (!until(s)) { problem = `단계 ${run.i}: until 이 맞지 않아요 (${String(s.say).replace(/<[^>]+>/g, '').slice(0, 40)}…)`; break; }
      run.hold = true;                                                         // 다음 단계 전 잠깐 멈춤 (화면과 같게)
    }
    if (problem) return { problem };
    // 끝 → 이 판 이어서 하기: 진짜 AI 로 계속
    if (d.release) d.release(T.state);
    run.live = false;
    T.poke();
    let n = 0, err = '';
    for (; n < 3000 && !ended; n++) {
      if (!tick()) {
        const p = Base.pending(T.state);
        if (!p.includes('me')) break;
        const a = (Base.auto || Base.ai)(T.state, 'me') || Base.ai(T.state, 'me');
        const e = T.act('me', a);
        if (e) { err = `이어서 하기: 내 행동 ${JSON.stringify(a)} → ${e}`; break; }
      }
    }
    return { steps: d.steps.length, after: n, ended: !!ended, err, screenOnly };
  } catch (e) {
    return { problem: '오류: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) };
  } finally { Date.now = realNow; }
}

for (const [key, file] of Object.entries(CORES)) {
  console.log(`▶ ${key}`);
  let d;
  try { require(`../public/js/tutorial/${key}.js`); d = defs[key]; } catch (e) { ok(false, `${key}: 각본 파일을 불러오지 못했어요`, e.message); continue; }
  if (!d) { ok(false, `${key}: Tutorial.add('${key}', …) 가 없어요`); continue; }
  const Base = require(`../public/js/shared/${file}.js`);
  const glob = (require('fs').readFileSync(require.resolve(`../public/js/shared/${file}.js`), 'utf8').match(/root\.([A-Za-z]+Core) = factory/) || [])[1];
  if (glob) global[glob] = Base;                                        // 화면에서처럼 각본이 BangCore 같은 이름으로 규칙을 쓸 수 있게
  const shape = d.steps.map((s, i) => (!s.say ? `${i}:말 없음` : !s.next && !s.until ? `${i}:넘어갈 방법 없음` : s.allow && !s.until ? `${i}:until 없음` : null)).filter(Boolean);
  ok(Array.isArray(d.steps) && d.steps.length >= 8 && !shape.length, `단계 ${d.steps.length}개 · 모양이 맞아요`, shape.join(', '));
  ok(typeof d.done === 'string' && d.done.length > 10 && typeof d.title === 'string', '제목 · 마치는 말');
  const r = replay(key, Base, d);
  if (r.problem) ok(false, '각본을 끝까지', r.problem);
  else {
    ok(true, `각본을 끝까지 (demo 행동 · 봇 각본 · until ${r.steps}단계${r.screenOnly ? ` · 화면에서만 하는 ${r.screenOnly}단계는 화면 검사로` : ''})`);
    ok(!r.err, `이어서 하기: 진짜 AI로 ${r.after}번 더 진행${r.ended ? ' · 게임 끝까지' : ''}`, r.err);
  }
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
