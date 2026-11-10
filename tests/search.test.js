// 🔍 게임 검색 검사 (public/js/search.js 의 Find): 초성 · 치는 중인 글자 · 별명 · 영어 · 설명 · 없는 말
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };

const core = fs.readFileSync(path.join(__dirname, '../public/js/core.js'), 'utf8');
const cut = (src, start, end) => { const a = src.indexOf(start); const b = src.indexOf(end, a); if (a < 0 || b < 0) throw new Error('못 찾음: ' + start); return src.slice(a, b + end.length); };
const ctx = vm.createContext({});
vm.runInContext(`${cut(core, 'const stripEmoji =', ';\n')}
${cut(core, 'const GAME_INFO = {', '\n};')}
${cut(core, 'const SOLO_GAMES = [', '\n];')}
const Home = { solo: k => SOLO_GAMES.find(g => g[0] === k),
  name(k, mode) { const s = this.solo(k), g = GAME_INFO[k]; return stripEmoji((mode === 'm' && g) || !s ? g.name : s[2]).replace(/\\s+vs\\s+(AI|봇)$/, '').replace(/\\s+기록 도전$/, ''); } };
${cut(fs.readFileSync(path.join(__dirname, '../public/js/search.js'), 'utf8'), 'const Find = (() => {', '\n})();')}
this.Find = Find; this.ALL = Find.list();`, ctx);
const { Find } = ctx;
const first = q => (Find.search(q)[0] || {}).k;
const has = (q, k, n = 5) => Find.search(q).slice(0, n).some(x => x.k === k);

console.log('▶ 목록');
ok(ctx.ALL.length >= 55 && ctx.ALL.every(x => x.name && x.cat), `싱글 + 멀티를 합쳐 ${ctx.ALL.length}개 (키 하나에 한 줄)`);
const tet = ctx.ALL.find(x => x.k === 'tetris');
ok(tet && tet.solo && tet.multi, '테트리스: 혼자(보스전) · 같이(배틀) 둘 다');
ok(ctx.ALL.find(x => x.k === 'seotda').solo && ctx.ALL.find(x => x.k === 'seotda').multi, '섯다: 혼자(vs AI) · 같이 둘 다');

console.log('▶ 이름 · 치는 중 · 초성');
ok(first('섯다') === 'seotda', '섯다');
ok(has('섯', 'seotda', 3), '섯 (한 글자)');
ok(has('서', 'seotda', 6), '서 (섯을 치는 중)');
ok(first('고슽') === 'gostop', '고슽 → 고스톱 (치는 중인 글자)', Find.search('고슽').map(x => x.k).join());
ok(first('ㅅㄷ') === 'seotda', 'ㅅㄷ → 섯다 (초성)', Find.search('ㅅㄷ').map(x => x.k).join());
ok(first('ㄱㅅㅌ') === 'gostop', 'ㄱㅅㅌ → 고스톱');
ok(first('ㅈㄹㅊㄱ') === 'mine', 'ㅈㄹㅊㄱ → 지뢰찾기');
ok(first('테트') === 'tetris', '테트 → 테트리스');
ok(first('스도쿠') === 'sudoku' && first('스 도 쿠') === 'sudoku', '스도쿠 · 띄어 써도');
ok(first('2048') === 'g2048', '2048');
ok(first('1to50') === 'race' || first('1 to 50') === 'race', '1 to 50');

console.log('▶ 별명 · 영어 · 원작 이름');
ok(first('부루마블') === 'marble', '부루마블 → 세계여행');
ok(first('tetris') === 'tetris' && first('TETRIS') === 'tetris', 'tetris (영어 · 대문자)');
ok(first('오델로') === 'reversi', '오델로 → 리버시');
ok(first('루미큐브') === 'rummi', '루미큐브 → 러미 타일');
ok(first('맞고') === 'gostop', '맞고 → 고스톱');
ok(first('수박') === 'fruit', '수박 → 과일 합치기');
ok(first('카트라이더') === 'kart', '카트라이더 → 드리프트 카트');
ok(first('네모로직') === 'nonogram', '네모로직 → 노노그램');
ok(first('할리갈리') === 'halli', '할리갈리 → 과일 종치기');
ok(first('야추') === 'yacht', '야추 → 요트 다이스');

console.log('▶ 분류 · 설명 · 없는 말');
ok(Find.search('퍼즐').length >= 10, `퍼즐 → ${Find.search('퍼즐').length}개`);
ok(has('주사위', 'yacht') && has('주사위', 'liardice'), '주사위 → 요트 · 라이어 다이스');
ok(Find.search('qwzx').length === 0 && Find.search('   ').length === 0, '없는 말 · 빈칸 → 없음');
ok(Find.score('seotda', 'ㅅㄷ') > Find.score('seotda', '화투'), '이름이 별명보다 위');

console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
