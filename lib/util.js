'use strict';
/** 어디서나 쓰는 작은 도구들 */
const rand = n => Math.floor(Math.random() * n);
const pick = arr => arr[rand(arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const int = (v, d = 0) => Math.floor(num(v, d));
const won = n => Number(n).toLocaleString('ko-KR') + '원';
const cleanName = n => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 12) || '게이머';
const normWord = w => String(w ?? '').replace(/\s/g, '');
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

module.exports = { rand, pick, clamp, num, int, won, cleanName, normWord, shuffle };
