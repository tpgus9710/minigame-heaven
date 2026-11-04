// 버전 검사: package.json 의 version 과 패치 노트 맨 위(지금 버전)가 같은지 · 패치 노트 모양
const pkg = require('../package.json');
const NOTES = require('../public/js/patchnotes.js');
let fails = 0;
const ok = (c, m, x = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + m, c ? '' : x); if (!c) fails++; };
const short = v => String(v).replace(/^(\d+\.\d+)\.0$/, '$1');          // 12.0.0 → 12.0 (화면에는 짧게)
console.log('▶ 버전 · 패치 노트');
ok(Array.isArray(NOTES) && NOTES.length > 0, `패치 노트 ${NOTES.length}개`);
ok(short(pkg.version) === NOTES[0].v, `package.json ${pkg.version} = 패치 노트 맨 위 v${NOTES[0].v}`, `(${short(pkg.version)} ≠ ${NOTES[0].v})`);
ok(/^\d{4}-\d{2}-\d{2}$/.test(NOTES[0].date || ''), `지금 버전 날짜 ${NOTES[0].date}`);
ok(NOTES.every(n => n.v && n.title && Array.isArray(n.items) && n.items.length && n.items.every(i => Array.isArray(i) && i.length === 2 && i[1].length > 4)), '버전마다 제목 · 내용');
ok(new Set(NOTES.map(n => n.v)).size === NOTES.length, '버전이 겹치지 않아요');
console.log(fails ? `\n❌ 실패 ${fails}개` : '\n✅ 모두 통과');
process.exit(fails ? 1 : 0);
