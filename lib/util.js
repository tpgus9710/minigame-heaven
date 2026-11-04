'use strict';
/** 어디서나 쓰는 작은 도구들 */
const rand = n => Math.floor(Math.random() * n);
const pick = arr => arr[rand(arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const int = (v, d = 0) => Math.floor(num(v, d));
const won = n => Number(n).toLocaleString('ko-KR') + '원';
/** 손님 이름: 운영자를 흉내 내는 말(운영자 · 관리자 · admin …)은 빼요 (진짜 운영자는 계정에 표시가 붙어요) */
const RESERVED = /운\s*영\s*(자|진|팀)|관\s*리\s*자|어\s*드\s*민|admin|\bgm\b|staff/gi;
const cleanName = n => String(n ?? '').replace(RESERVED, '').replace(/\s+/g, ' ').trim().slice(0, 12) || '게이머';
const normWord = w => String(w ?? '').replace(/\s/g, '');
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

module.exports = { rand, pick, clamp, num, int, won, cleanName, normWord, shuffle };
