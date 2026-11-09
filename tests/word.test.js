// 끝말잇기 사전 판정 검사: 사전 범위(모든 낱말 · 명사만 · 표준어 명사만) · 원소 이름 · 한방 · 거절 이유 · 봇 · 빠르기
// games/word.js 를 가짜 방 도구(H)로 돌리고, 지금 단어를 직접 정해서 낱말을 내 봐요.
const Dict = require('../lib/kodict');
const makeWord = require('../games/word.js');
const U = require('../lib/util');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

console.log('▶ 사전');
const C = Dict.count();
ok(C.all > 900000 && C.wide > 800000 && C.std > 700000 && C.common > 30000, `낱말 수: 모든 낱말 ${C.all.toLocaleString()} · 명사 ${C.wide.toLocaleString()} · 표준어 명사 ${C.std.toLocaleString()}`);
const kinds = { 라듐: 'std', 이리듐: 'std', 산화나트륨: 'std', 수산화나트륨: 'std', 러더포듐: 'std', 오가네손: 'std', 스마트폰: 'std', 마라탕: 'std', 듬성: 'other', 듬성듬성: 'other', 깨끗: 'other', 먹다: 'other' };
const wrong = Object.entries(kinds).filter(([w, k]) => Dict.lookup(w) !== k).map(([w]) => `${w}=${Dict.lookup(w)}`);
ok(!wrong.length, '라듐 · 이리듐 · 산화나트륨 · 원소 · 새말은 명사, 듬성 · 듬성듬성 · 깨끗 · 먹다는 명사가 아닌 말', wrong.join(' '));
ok(Dict.lookup('유튜브') === null && Dict.lookup('금') === null && Dict.lookup('abc') === null, '사전에 없는 말 · 한 글자 · 한글 아님 → 없음');
const ELEMENTS = '수소 헬륨 리튬 베릴륨 붕소 탄소 질소 산소 플루오린 네온 소듐 마그네슘 알루미늄 규소 염소 아르곤 포타슘 칼슘 스칸듐 타이타늄 바나듐 크로뮴 망가니즈 코발트 니켈 구리 아연 갈륨 저마늄 비소 셀레늄 브로민 크립톤 루비듐 스트론튬 이트륨 지르코늄 나이오븀 몰리브데넘 테크네튬 루테늄 로듐 팔라듐 카드뮴 인듐 주석 안티모니 텔루륨 아이오딘 제논 세슘 바륨 란타넘 세륨 프라세오디뮴 네오디뮴 프로메튬 사마륨 유로퓸 가돌리늄 터븀 디스프로슘 홀뮴 어븀 툴륨 이터븀 루테튬 하프늄 탄탈럼 텅스텐 레늄 오스뮴 이리듐 백금 수은 탈륨 비스무트 폴로늄 아스타틴 라돈 프랑슘 라듐 악티늄 토륨 프로트악티늄 우라늄 넵투늄 플루토늄 아메리슘 퀴륨 버클륨 캘리포늄 아인슈타이늄 페르뮴 멘델레븀 노벨륨 로렌슘 러더포듐 더브늄 시보귬 보륨 하슘 마이트너륨 다름슈타튬 뢴트게늄 코페르니슘 니호늄 플레로븀 모스코븀 리버모륨 테네신 오가네손'.split(' ');
const noEl = ELEMENTS.filter(w => Dict.lookup(w) !== 'std');
ok(ELEMENTS.length === 112 && !noEl.length, '두 글자 이상인 원소 112개 모두 표준어 명사 (한 글자 원소 6개는 규칙상 안 돼요)', noEl.join(' '));
ok(Dict.allowed('other', 'all') && !Dict.allowed('other', 'wide') && Dict.allowed('ext', 'wide') && !Dict.allowed('ext', 'std') && Dict.allowed('std', 'std'), '사전 범위: 모든 낱말 ⊃ 명사만 ⊃ 표준어 명사만');
ok(!Dict.canStart(['듐'], new Set(), 'all'), "'듐'으로 시작하는 말은 사전 전체에 없어요 (라듐은 한방 단어)");

// ── 가짜 방 ──
function table(opts = {}) {
  let clock = 0;
  const timers = [], out = { ev: [], toasts: [] };
  const H = {
    ...U,
    participants: room => room.players,
    emit: (room, ev, d) => out.ev.push([ev, d]),
    sys: () => {}, pushScores: () => {}, finishGame: (room, d) => { out.finished = d; },
    later: (room, ms, fn) => { const t = { due: clock + ms, fn, done: false }; timers.push(t); return t; },
    cancel: (room, t) => { if (t) t.done = true; },
  };
  const mod = makeWord(H);
  const room = { code: 'W', gameType: 'word', options: { bots: 0, ...opts }, players: [{ id: 'a', name: '가' }, { id: 'b', name: '나' }], game: null };
  mod.start(room);
  return {
    room, mod, out, get g() { return room.game; },
    run(ms) { const end = clock + ms; for (;;) { const t = timers.filter(x => !x.done && x.due <= end).sort((p, q) => p.due - q.due)[0]; if (!t) break; t.done = true; clock = t.due; t.fn(); } clock = end; },
    /** 지금 단어를 정하고 차례인 사람이 낱말 내기 → { ok, why, kind, dead } */
    say(prev, w) {
      const g = room.game;
      g.phase = 'turn'; g.word = prev; g.used = new Set([prev]);
      const id = g.order[g.turn], me = room.players.find(p => p.id === id);
      g.tries = {};
      const n = out.ev.length;
      const r = mod.events['word:say'](room, me, w);
      const got = out.ev.slice(n);
      const acc = got.find(([e]) => e === 'word:accepted'), miss = got.find(([e]) => e === 'word:miss');
      return acc ? { ok: true, kind: acc[1].kind, dead: acc[1].dead } : { ok: false, why: miss ? miss[1].why : r };
    },
  };
}

console.log('▶ 모든 낱말 (기본)');
{
  const T = table();
  ok(T.g.mode === 'all' && T.g.kill === true, '기본: 모든 낱말 · 한방 허용');
  let r = T.say('으듬', '듬성'); ok(r.ok && r.kind === 'other', '듬성 (어근) 통과', JSON.stringify(r));
  r = T.say('부산', '산화나트륨'); ok(r.ok && r.kind === 'std', '산화나트륨 통과', JSON.stringify(r));
  r = T.say('바라', '라듐'); ok(r.ok && r.dead === true, '라듐 통과 → 💥 한방', JSON.stringify(r));
  r = T.say('고리', '이리듐'); ok(r.ok && r.dead === true, '이리듐 통과 (두음법칙 리 → 이) → 💥 한방', JSON.stringify(r));
  r = T.say('테러', '러더포듐'); ok(r.ok, '러더포듐 통과', JSON.stringify(r));
  r = T.say('가다', '다듬다'); ok(r.ok && r.kind === 'other', '동사도 통과 (다듬다)', JSON.stringify(r));
  r = T.say('부유', '유튜브'); ok(!r.ok && /사전에 없는/.test(r.why), '사전에 없는 말은 거절: ' + r.why);
  r = T.say('지금', '금'); ok(!r.ok && /2~20글자/.test(r.why), '한 글자는 거절: ' + r.why);
}
console.log('▶ 명사만 · 표준어 명사만 · 한방 금지');
{
  const T = table({ wdDict: 'wide' });
  let r = T.say('으듬', '듬성'); ok(!r.ok && /명사가 아니에요/.test(r.why), '명사만: 듬성 거절 이유 — ' + r.why);
  r = T.say('부산', '산화나트륨'); ok(r.ok, '명사만: 산화나트륨 통과');
  const S = table({ wdDict: 'std' });
  r = S.say('부산', '산화나트륨'); ok(r.ok, '표준어 명사만: 산화나트륨 통과 (표준국어대사전 표제어)');
  const ext = Dict.pick(['가'], { mode: 'wide', common: false, alive: w => Dict.lookup(w) === 'ext' });
  r = S.say('나가', ext); ok(!r.ok && /표준어 명사가 아니에요/.test(r.why), `표준어 명사만: 방언 · 옛말 거절 (${ext}) — ${r.why}`);
  const K = table({ wdKill: 'off' });
  r = K.say('바라', '라듐'); ok(!r.ok && /한방 단어/.test(r.why) && /듐/.test(r.why), '한방 금지: 라듐 거절 이유 — ' + r.why);
}
console.log('▶ 봇 · 빠르기');
{
  const used = new Set();
  let nouns = 0, n = 0, t0 = Date.now();
  for (const c of ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하', '기', '리', '이']) {
    for (let k = 0; k < 10; k++) {
      const w = Dict.pick([c], { used, mode: 'all', maxLen: 6, alive: x => Dict.canStart(makeWord.startsFor(x), used, 'all') });
      if (!w) continue;
      used.add(w); n++; if (Dict.lookup(w) !== 'other') nouns++;
    }
  }
  ok(n === 170 && nouns === n, `봇은 '모든 낱말'에서도 명사를 골라요 (${nouns}/${n})`);
  ok(Date.now() - t0 < 3000, `봇 낱말 고르기 ${n}번 ${Date.now() - t0}ms`);
  const rare = [];                                     // '름'으로 시작하는 명사는 6개뿐 → 다 쓰면 다른 품사로
  for (let k = 0; k < 9; k++) { const w = Dict.pick(['름'], { used, mode: 'all' }); if (w) { used.add(w); rare.push(Dict.lookup(w)); } }
  ok(rare.length === 9 && rare.slice(0, 6).every(k => k !== 'other') && rare.slice(6).every(k => k === 'other'), '명사가 다 떨어진 글자는 그때 다른 품사로: ' + rare.join(','));
  ok(Dict.pick(['름'], { used, mode: 'wide' }) === null, "'명사만'이면 명사가 없을 때 아무것도 안 골라요");
  t0 = Date.now();
  for (let i = 0; i < 3000; i++) Dict.lookup(['사과', '산화나트륨', '듬성', '유튜브', '라듐', '바나나'][i % 6]);
  ok(Date.now() - t0 < 1500, `낱말 찾기 3000번 ${Date.now() - t0}ms`);
}
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
