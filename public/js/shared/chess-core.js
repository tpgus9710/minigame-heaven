/* =====================================================================
 *  ♞ 체스 규칙 (FIDE 체스 규칙) — 화면(싱글: AI와 대전)과 서버(멀티)가 같은 코드를 써요.
 *   - 말 움직임 · 체크 · 체크메이트 · 스테일메이트 · 캐슬링 · 앙파상 · 프로모션(퀸/룩/비숍/나이트)
 *   - 무승부: 스테일메이트 · 같은 국면 3번(3회 반복) · 50수 규칙 · 기물 부족(킹 대 킹 등) · 합의
 *   - 시간 제한(체스 시계 + 한 수마다 추가 시간). 시간이 다 되면 패배 (상대가 체크메이트할 기물이 없으면 무승부)
 *   - 기보: 표준 대수 기보법(SAN, 예: Nf3 · exd5 · O-O · e8=Q+ · Qxf7#)
 *   - AI: 알파-베타 탐색 + 정지 탐색(잡기 수) + 말 위치 점수표 (쉬움 · 보통 · 어려움)
 *  판 표현은 0x88 (a8 = 0, h8 = 7, a1 = 112, h1 = 119). 화면에는 0~63 (a8 = 0 … h1 = 63) 으로 보내요.
 *  움직임 생성은 표준 perft 수(국면별 가능한 수의 개수)로 검사했어요 (tests/chess.test.js · npm test).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./table'));
  else root.ChessCore = factory(root.TableKit);
})(typeof self !== 'undefined' ? self : this, function (TableKit) {
  'use strict';
  const { log } = TableKit.util;

  /* ─────────────── 판 · 말 ─────────────── */
  const WHITE = 0, BLACK = 8;
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const CH = ' PNBRQK';                                  // 말 글자 (흰색 대문자 · 검은색 소문자)
  const F_CAP = 1, F_EP = 2, F_KS = 4, F_QS = 8, F_DBL = 16, F_PRO = 32;
  const N_OFF = [-33, -31, -18, -14, 14, 18, 31, 33], K_OFF = [-17, -16, -15, -1, 1, 15, 16, 17];
  const R_DIR = [-16, 16, -1, 1], B_DIR = [-17, -15, 15, 17];
  const WK = 1, WQ = 2, BK = 4, BQ = 8;
  const CASTLE_MASK = new Uint8Array(128).fill(15);   // 이 칸에서 움직이거나 이 칸이 잡히면 남는 캐슬링 권리
  CASTLE_MASK[116] = 15 & ~(WK | WQ); CASTLE_MASK[119] = 15 & ~WK; CASTLE_MASK[112] = 15 & ~WQ;
  CASTLE_MASK[4] = 15 & ~(BK | BQ); CASTLE_MASK[7] = 15 & ~BK; CASTLE_MASK[0] = 15 & ~BQ;
  const sq64 = s => (s >> 4) * 8 + (s & 7), sq88 = i => (i >> 3) * 16 + (i & 7);
  const name88 = s => 'abcdefgh'[s & 7] + (8 - (s >> 4));
  const color = p => p & 8, type = p => p & 7;

  /* 해시 (같은 국면 찾기 · 탐색 표): 32비트 두 개 */
  let seed = 0x9e3779b9;
  const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const ZP1 = [], ZP2 = [];
  for (let p = 0; p < 16; p++) { ZP1.push(new Uint32Array(128)); ZP2.push(new Uint32Array(128)); for (let s = 0; s < 128; s++) { ZP1[p][s] = rnd32(); ZP2[p][s] = rnd32(); } }
  const ZC1 = Array.from({ length: 16 }, rnd32), ZC2 = Array.from({ length: 16 }, rnd32);
  const ZE1 = Array.from({ length: 8 }, rnd32), ZE2 = Array.from({ length: 8 }, rnd32);
  const ZT1 = rnd32(), ZT2 = rnd32();

  function rehash(pos) {
    let h1 = 0, h2 = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.b[s]; if (p) { h1 ^= ZP1[p][s]; h2 ^= ZP2[p][s]; } }
    h1 ^= ZC1[pos.castle]; h2 ^= ZC2[pos.castle];
    if (pos.ep >= 0) { h1 ^= ZE1[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
    if (pos.turn === BLACK) { h1 ^= ZT1; h2 ^= ZT2; }
    pos.h1 = h1 >>> 0; pos.h2 = h2 >>> 0;
  }

  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  function fromFen(fen) {
    const [place, side, cas, ep, half, full] = String(fen).trim().split(/\s+/);
    const pos = { b: new Uint8Array(128), turn: side === 'b' ? BLACK : WHITE, castle: 0, ep: -1, half: +half || 0, full: +full || 1, kings: [-1, -1], h1: 0, h2: 0 };
    let s = 0;
    for (const c of place) {
      if (c === '/') { s = (s & ~15) + 16; continue; }
      if (/\d/.test(c)) { s += +c; continue; }
      const t = CH.indexOf(c.toUpperCase()); if (t < 1) throw new Error('FEN 오류: ' + c);
      const p = t | (c === c.toUpperCase() ? WHITE : BLACK);
      pos.b[s] = p; if (t === K) pos.kings[color(p) >> 3] = s;
      s++;
    }
    for (const c of cas || '-') pos.castle |= { K: WK, Q: WQ, k: BK, q: BQ }[c] || 0;
    if (ep && ep !== '-') pos.ep = (8 - +ep[1]) * 16 + 'abcdefgh'.indexOf(ep[0]);
    rehash(pos);
    return pos;
  }
  function toFen(pos, epAlways) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = pos.b[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { out += e; e = 0; }
        const c = CH[type(p)]; out += color(p) === WHITE ? c : c.toLowerCase();
      }
      if (e) out += e;
      if (r < 7) out += '/';
    }
    const cas = (pos.castle & WK ? 'K' : '') + (pos.castle & WQ ? 'Q' : '') + (pos.castle & BK ? 'k' : '') + (pos.castle & BQ ? 'q' : '') || '-';
    const ep = pos.ep >= 0 && (epAlways || epCapturable(pos)) ? name88(pos.ep) : '-';
    return `${out} ${pos.turn === WHITE ? 'w' : 'b'} ${cas} ${ep} ${pos.half} ${pos.full}`;
  }

  /** sq 칸을 by 색이 공격하나요? */
  function attacked(pos, sq, by) {
    const b = pos.b;
    if (by === WHITE) { for (const d of [15, 17]) { const s = sq + d; if (!(s & 0x88) && b[s] === (P | WHITE)) return true; } }
    else { for (const d of [-15, -17]) { const s = sq + d; if (!(s & 0x88) && b[s] === (P | BLACK)) return true; } }
    for (const d of N_OFF) { const s = sq + d; if (!(s & 0x88) && b[s] === (N | by)) return true; }
    for (const d of K_OFF) { const s = sq + d; if (!(s & 0x88) && b[s] === (K | by)) return true; }
    for (const d of R_DIR) {
      for (let s = sq + d; !(s & 0x88); s += d) { const p = b[s]; if (!p) continue; if (color(p) === by && (type(p) === R || type(p) === Q)) return true; break; }
    }
    for (const d of B_DIR) {
      for (let s = sq + d; !(s & 0x88); s += d) { const p = b[s]; if (!p) continue; if (color(p) === by && (type(p) === B || type(p) === Q)) return true; break; }
    }
    return false;
  }
  const inCheck = (pos, c = pos.turn) => attacked(pos, pos.kings[c >> 3], c ^ 8);

  /** 규칙상 가능한 수(자기 킹이 공격받는 수 포함) */
  function pseudo(pos, capsOnly) {
    const out = [], b = pos.b, us = pos.turn, them = us ^ 8;
    const add = (from, to, piece, flags, promo = 0) => out.push({ from, to, piece, cap: flags & F_EP ? (P | them) : b[to], flags, promo });
    const pawnTo = (from, to, flags) => {
      const last = us === WHITE ? to < 8 : to >= 112;
      if (last) for (const pr of [Q, R, B, N]) add(from, to, P | us, flags | F_PRO, pr | us);
      else add(from, to, P | us, flags);
    };
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p || color(p) !== us) continue;
      const t = type(p);
      if (t === P) {
        const fw = us === WHITE ? -16 : 16, one = s + fw;
        if (!capsOnly || (us === WHITE ? one < 8 : one >= 112)) {
          if (!(one & 0x88) && !b[one]) {
            pawnTo(s, one, 0);
            const startRank = us === WHITE ? (s >> 4) === 6 : (s >> 4) === 1;
            if (!capsOnly && startRank && !b[one + fw]) add(s, one + fw, p, F_DBL);
          }
        }
        for (const d of us === WHITE ? [-17, -15] : [15, 17]) {
          const to = s + d; if (to & 0x88) continue;
          if (b[to] && color(b[to]) === them) pawnTo(s, to, F_CAP);
          else if (to === pos.ep) add(s, to, p, F_CAP | F_EP);
        }
      } else if (t === N || t === K) {
        for (const d of t === N ? N_OFF : K_OFF) {
          const to = s + d; if (to & 0x88) continue;
          const q = b[to];
          if (!q) { if (!capsOnly) add(s, to, p, 0); } else if (color(q) === them) add(s, to, p, F_CAP);
        }
      } else {
        const dirs = t === B ? B_DIR : t === R ? R_DIR : K_OFF;
        for (const d of dirs) {
          for (let to = s + d; !(to & 0x88); to += d) {
            const q = b[to];
            if (!q) { if (!capsOnly) add(s, to, p, 0); continue; }
            if (color(q) === them) add(s, to, p, F_CAP);
            break;
          }
        }
      }
    }
    // 캐슬링: 킹 · 룩이 움직인 적 없고 · 사이가 비었고 · 킹이 체크 중이 아니고 · 지나가거나 도착하는 칸이 공격받지 않을 때
    if (!capsOnly) {
      const k = pos.kings[us >> 3];
      if (us === WHITE && k === 116) {
        if (pos.castle & WK && !b[117] && !b[118] && b[119] === (R | WHITE) && !attacked(pos, 116, BLACK) && !attacked(pos, 117, BLACK) && !attacked(pos, 118, BLACK)) add(116, 118, K | WHITE, F_KS);
        if (pos.castle & WQ && !b[115] && !b[114] && !b[113] && b[112] === (R | WHITE) && !attacked(pos, 116, BLACK) && !attacked(pos, 115, BLACK) && !attacked(pos, 114, BLACK)) add(116, 114, K | WHITE, F_QS);
      } else if (us === BLACK && k === 4) {
        if (pos.castle & BK && !b[5] && !b[6] && b[7] === (R | BLACK) && !attacked(pos, 4, WHITE) && !attacked(pos, 5, WHITE) && !attacked(pos, 6, WHITE)) add(4, 6, K | BLACK, F_KS);
        if (pos.castle & BQ && !b[3] && !b[2] && !b[1] && b[0] === (R | BLACK) && !attacked(pos, 4, WHITE) && !attacked(pos, 3, WHITE) && !attacked(pos, 2, WHITE)) add(4, 2, K | BLACK, F_QS);
      }
    }
    return out;
  }

  /** 수 두기 (되돌릴 정보를 돌려줘요) */
  function make(pos, m) {
    const b = pos.b, us = pos.turn, them = us ^ 8;
    const u = { castle: pos.castle, ep: pos.ep, half: pos.half, h1: pos.h1, h2: pos.h2, k: pos.kings[us >> 3] };
    let h1 = pos.h1 ^ ZC1[pos.castle], h2 = pos.h2 ^ ZC2[pos.castle];
    if (pos.ep >= 0) { h1 ^= ZE1[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
    const mv = (p, from, to) => { b[from] = 0; b[to] = p; h1 ^= ZP1[p][from] ^ ZP1[p][to]; h2 ^= ZP2[p][from] ^ ZP2[p][to]; };
    if (m.flags & F_EP) { const cs = m.to + (us === WHITE ? 16 : -16); h1 ^= ZP1[b[cs]][cs]; h2 ^= ZP2[b[cs]][cs]; b[cs] = 0; }
    else if (m.cap) { h1 ^= ZP1[m.cap][m.to]; h2 ^= ZP2[m.cap][m.to]; }
    mv(m.piece, m.from, m.to);
    if (m.flags & F_PRO) { h1 ^= ZP1[m.piece][m.to] ^ ZP1[m.promo][m.to]; h2 ^= ZP2[m.piece][m.to] ^ ZP2[m.promo][m.to]; b[m.to] = m.promo; }
    if (m.flags & F_KS) mv(R | us, m.to + 1, m.to - 1);
    if (m.flags & F_QS) mv(R | us, m.to - 2, m.to + 1);
    if (type(m.piece) === K) pos.kings[us >> 3] = m.to;
    pos.castle &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
    pos.ep = m.flags & F_DBL ? (m.from + m.to) >> 1 : -1;
    pos.half = type(m.piece) === P || m.cap ? 0 : pos.half + 1;
    if (us === BLACK) pos.full++;
    pos.turn = them;
    h1 ^= ZC1[pos.castle] ^ ZT1; h2 ^= ZC2[pos.castle] ^ ZT2;
    if (pos.ep >= 0) { h1 ^= ZE1[pos.ep & 7]; h2 ^= ZE2[pos.ep & 7]; }
    pos.h1 = h1 >>> 0; pos.h2 = h2 >>> 0;
    return u;
  }
  function unmake(pos, m, u) {
    const b = pos.b, us = pos.turn ^ 8;
    pos.turn = us;
    if (us === BLACK) pos.full--;
    b[m.from] = m.piece;
    b[m.to] = m.flags & F_EP ? 0 : m.cap;
    if (m.flags & F_EP) b[m.to + (us === WHITE ? 16 : -16)] = m.cap;
    if (m.flags & F_KS) { b[m.to - 1] = 0; b[m.to + 1] = R | us; }
    if (m.flags & F_QS) { b[m.to + 1] = 0; b[m.to - 2] = R | us; }
    pos.kings[us >> 3] = u.k;
    pos.castle = u.castle; pos.ep = u.ep; pos.half = u.half; pos.h1 = u.h1; pos.h2 = u.h2;
  }
  /** 실제로 둘 수 있는 수 (내 킹이 공격받게 되는 수는 빼요) */
  function legalMoves(pos, capsOnly) {
    const out = [], us = pos.turn;
    for (const m of pseudo(pos, capsOnly)) { const u = make(pos, m); if (!attacked(pos, pos.kings[us >> 3], us ^ 8)) out.push(m); unmake(pos, m, u); }
    return out;
  }
  /** 앙파상을 실제로 할 수 있나요? (같은 국면 비교용 — 할 수 없으면 앙파상 칸은 국면에 넣지 않아요) */
  function epCapturable(pos) {
    if (pos.ep < 0) return false;
    return legalMoves(pos).some(m => m.flags & F_EP);
  }
  /** 같은 국면 비교용 열쇠: 말 배치 · 차례 · 캐슬링 권리 · (할 수 있을 때만) 앙파상 */
  const posKey = pos => toFen(pos).split(' ').slice(0, 4).join(' ');

  /** 기물 부족: 어느 쪽도 체크메이트할 수 없는 국면 (킹 대 킹 · 킹+비숍/나이트 대 킹 · 같은 색 칸 비숍들만) */
  function insufficient(pos) {
    let minors = 0, knights = 0; const bishopColors = new Set();
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const t = type(pos.b[s]);
      if (!t || t === K) continue;
      if (t === P || t === R || t === Q) return false;
      minors++;
      if (t === N) knights++; else bishopColors.add(((s >> 4) + (s & 7)) & 1);
    }
    if (minors <= 1) return true;
    return knights === 0 && bishopColors.size === 1;
  }
  /** 한쪽(by)이 남은 말로 체크메이트를 만들 수 있나요? (시간 패배 판정: 못 하면 무승부) */
  function canMate(pos, by) {
    let mine = 0, minor = 0, theirs = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = pos.b[s]; if (!p || type(p) === K) continue;
      if (color(p) === by) { mine++; if (type(p) === N || type(p) === B) minor++; } else theirs++;
    }
    if (!mine) return false;                                    // 킹만 남았어요
    if (mine === 1 && minor === 1 && !theirs) return false;     // 킹+비숍 / 킹+나이트 대 킹
    return true;
  }

  /** 표준 대수 기보 (SAN). legal = 지금 국면의 둘 수 있는 수 목록 */
  function san(pos, m, legal) {
    let s;
    if (m.flags & F_KS) s = 'O-O';
    else if (m.flags & F_QS) s = 'O-O-O';
    else {
      const t = type(m.piece), to = name88(m.to);
      if (t === P) s = (m.cap ? 'abcdefgh'[m.from & 7] + 'x' : '') + to + (m.flags & F_PRO ? '=' + CH[type(m.promo)] : '');
      else {
        const rivals = legal.filter(x => x !== m && x.piece === m.piece && x.to === m.to && x.from !== m.from);
        let dis = '';
        if (rivals.length) {
          const sameFile = rivals.some(x => (x.from & 7) === (m.from & 7)), sameRank = rivals.some(x => (x.from >> 4) === (m.from >> 4));
          if (!sameFile) dis = 'abcdefgh'[m.from & 7];
          else if (!sameRank) dis = String(8 - (m.from >> 4));
          else dis = name88(m.from);
        }
        s = CH[t] + dis + (m.cap ? 'x' : '') + to;
      }
    }
    const u = make(pos, m);
    if (inCheck(pos)) s += legalMoves(pos).length ? '+' : '#';
    unmake(pos, m, u);
    return s;
  }

  /* ─────────────── AI (알파-베타) ─────────────── */
  const VAL = [0, 100, 320, 330, 500, 900, 20000];
  // 말 위치 점수표 (흰색 기준, 첫 줄이 8랭크) — Tomasz Michniewski 의 Simplified Evaluation Function
  const PST = {
    [P]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [N]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [B]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [R]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [Q]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [K]: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };
  /** 평가 (차례인 쪽 기준 점수) */
  function evaluate(pos) {
    let sc = 0, wNP = 0, bNP = 0, wq = 0, bq = 0;
    const b = pos.b;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const t = type(p);
      if (t !== P && t !== K) { if (color(p) === WHITE) { wNP += VAL[t]; if (t === Q) wq++; } else { bNP += VAL[t]; if (t === Q) bq++; } }
    }
    const endgame = (wq === 0 && bq === 0) || (wNP <= 1300 && bNP <= 1300);
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const t = type(p), i = sq64(s), w = color(p) === WHITE;
      const tbl = t === K && endgame ? PST.KE : PST[t];
      const v = VAL[t] + tbl[w ? i : (7 - (i >> 3)) * 8 + (i & 7)];
      sc += w ? v : -v;
    }
    return pos.turn === WHITE ? sc : -sc;
  }
  const MATE = 100000;
  function order(moves, ttMove, killers) {
    for (const m of moves) {
      let o = 0;
      if (ttMove && m.from === ttMove.from && m.to === ttMove.to && m.promo === ttMove.promo) o = 1e7;
      else if (m.cap) o = 1e6 + VAL[type(m.cap)] * 10 - VAL[type(m.piece)];
      else if (m.flags & F_PRO) o = 9e5 + VAL[type(m.promo)];
      else if (killers && killers.some(k => k && k.from === m.from && k.to === m.to)) o = 8e5;
      m.o = o;
    }
    return moves.sort((a, b) => b.o - a.o);
  }
  /**
   * 가장 좋은 수 찾기. hist = 이 판에서 지나온 국면 해시(반복 무승부 피하기)
   * level: { depth(최대 깊이), ms(시간 제한), noise(실수 정도) }
   */
  function search(pos0, level, hist, rnd = Math.random) {
    const pos = { ...pos0, b: pos0.b.slice(), kings: pos0.kings.slice() };
    const deadline = Date.now() + level.ms;
    const tt = new Map(), killers = [];
    const path = hist ? hist.slice() : [];
    let nodes = 0, stop = false;
    // 같은 국면 반복: 지금 국면(path 끝)과 같은 쪽 차례였던 국면(2수 전, 4수 전 …)을 마지막 폰 이동 · 잡기 이후에서만 비교
    const repeated = () => { const k = pos.h1; for (let i = path.length - 3; i >= 0 && i >= path.length - 1 - pos.half; i -= 2) if (path[i] === k) return true; return false; };
    function qs(alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      const stand = evaluate(pos);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (ply > 24) return stand;
      const us = pos.turn;
      for (const m of order(pseudo(pos, true))) {
        if (m.cap && stand + VAL[type(m.cap)] + 200 < alpha && !(m.flags & F_PRO)) continue;   // 잡아도 모자라면 건너뛰기
        const u = make(pos, m);
        if (attacked(pos, pos.kings[us >> 3], us ^ 8)) { unmake(pos, m, u); continue; }
        const sc = -qs(-beta, -alpha, ply + 1);
        unmake(pos, m, u);
        if (stop) return 0;
        if (sc >= beta) return sc;
        if (sc > alpha) alpha = sc;
      }
      return alpha;
    }
    function ab(depth, alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      if (ply && (pos.half >= 100 || repeated())) return 0;
      const check = inCheck(pos);
      if (check && ply < 12) depth++;                         // 체크면 한 수 더 봐요
      if (depth <= 0) return qs(alpha, beta, ply);
      const e = tt.get(pos.h1);
      let ttMove = null;
      if (e && e.h2 === pos.h2) {
        ttMove = e.m;
        if (ply && e.d >= depth) {
          if (e.f === 0) return e.s;
          if (e.f === 1 && e.s >= beta) return e.s;
          if (e.f === 2 && e.s <= alpha) return e.s;
        }
      }
      const us = pos.turn, a0 = alpha;
      let best = -MATE, bestM = null, any = false;
      for (const m of order(pseudo(pos), ttMove, killers[ply])) {
        const u = make(pos, m);
        if (attacked(pos, pos.kings[us >> 3], us ^ 8)) { unmake(pos, m, u); continue; }
        any = true;
        path.push(pos.h1);
        const sc = -ab(depth - 1, -beta, -alpha, ply + 1);
        path.pop();
        unmake(pos, m, u);
        if (stop) return 0;
        if (sc > best) { best = sc; bestM = m; }
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) { if (!m.cap) { const k = killers[ply] || (killers[ply] = []); k.unshift(m); k.length = 2; } break; }
      }
      if (!any) return check ? -MATE + ply : 0;                 // 체크메이트 · 스테일메이트
      if (tt.size > 300000) tt.clear();
      tt.set(pos.h1, { h2: pos.h2, d: depth, s: best, f: best <= a0 ? 2 : best >= beta ? 1 : 0, m: bestM });
      return best;
    }
    const root = legalMoves(pos);
    if (!root.length) return null;
    if (root.length === 1) return root[0];
    let best = root[0], bestScore = -MATE;
    for (let d = 1; d <= level.depth; d++) {
      let alpha = -MATE - 1, dBest = null, dScore = -MATE - 1;
      const scored = [];
      for (const m of order(root, best)) {
        const u = make(pos, m);
        path.push(pos.h1);
        // 실수(noise)를 섞는 단계는 수마다 정확한 점수가 필요해서 창을 넓게 (좁히면 '이 수보다 나쁘다'는 값만 나와 엉뚱한 수를 골라요)
        let sc = -ab(d - 1, -MATE - 1, level.noise ? MATE + 1 : -alpha, 1);
        path.pop();
        unmake(pos, m, u);
        if (stop) break;
        if (level.noise) sc += Math.floor((rnd() - 0.5) * level.noise);
        scored.push([m, sc]);
        if (sc > dScore) { dScore = sc; dBest = m; }
        if (sc > alpha) alpha = sc;
      }
      if (stop && !dBest) break;
      if (dBest) { best = dBest; bestScore = dScore; }
      if (stop || Math.abs(bestScore) > MATE - 100) break;
      if (Date.now() > deadline - level.ms * 0.45) break;      // 다음 깊이를 끝낼 시간이 없어요
    }
    best.score = bestScore; best.nodes = nodes;
    return best;
  }
  const LEVELS = {
    easy: { depth: 1, ms: 150, noise: 260 },
    normal: { depth: 4, ms: 600, noise: 24 },
    hard: { depth: 8, ms: 1300, noise: 0 },
  };
  const SERVER = typeof window === 'undefined';                // 서버에서는 짧게만 생각해요 (다른 방이 느려지지 않게)

  /* ─────────────── 게임 진행 (TableKit) ─────────────── */
  const CLOCKS = { 0: null, 3: [180, 2], 5: [300, 0], 10: [600, 0], 15: [900, 10], 30: [1800, 0] };   // 분 → [초, 한 수마다 추가 초]
  const cur = s => s.players[s.pos.turn === WHITE ? 0 : 1];
  const other = (s, id) => s.players.find(p => p.id !== id);
  const colorName = c => (c === WHITE ? '백' : '흑');

  function setup(players, rnd, opts = {}) {
    let order = players.slice(0, 2);
    const want = opts.color;                                   // 싱글: 내가 고른 색 (white · black · random)
    if (want === 'white' || want === 'black') {
      const human = order.find(p => !p.bot) || order[0];
      order = want === 'white' ? [human, order.find(p => p !== human)] : [order.find(p => p !== human), human];
    } else if (rnd() < 0.5) order = order.reverse();
    const pos = fromFen(opts.fen || START);
    const ck = CLOCKS[+opts.clock] || null;
    const s = {
      rnd, pos, over: false, winner: null, reason: '', msg: '', moves: [], last: null, seq: 0, log: [],
      players: order.map((p, i) => ({ id: p.id, name: p.name, bot: !!p.bot, color: i ? BLACK : WHITE })),
      level: LEVELS[opts.level] ? opts.level : 'normal', undo: !!opts.undo,
      keys: [posKey(pos)], hashes: [pos.h1], snaps: [],
      clock: ck ? { on: true, left: [ck[0] * 1000, ck[0] * 1000], inc: ck[1] * 1000, turnStart: Date.now(), base: +opts.clock } : { on: false },
      drawOffer: null, captured: [[], []],
    };
    s.msg = `${order[0].name} 님(백)부터 시작해요!`;
    return s;
  }
  function end(s, winner, reason, msg) {
    s.over = true; s.winner = winner; s.reason = reason; s.msg = msg; s.drawOffer = null;
    if (s.clock.on) { const i = s.pos.turn === WHITE ? 0 : 1; s.clock.left[i] = Math.max(0, s.clock.left[i] - (Date.now() - s.clock.turnStart)); s.clock.stopped = true; }
    log(s, { t: 'end', reason, winner });
  }
  /** 수를 둔 뒤: 체크메이트 · 스테일메이트 · 무승부 규칙 */
  function afterMove(s) {
    const pos = s.pos, legal = legalMoves(pos);
    const key = posKey(pos);
    s.keys.push(key); s.hashes.push(pos.h1);
    if (!legal.length) {
      if (inCheck(pos)) { const w = s.players.find(p => p.color !== pos.turn); return end(s, w.id, 'mate', `체크메이트! ${w.name} 님(${colorName(w.color)}) 승리!`); }
      return end(s, null, 'stalemate', `스테일메이트 — 둘 수 있는 수가 없지만 체크가 아니라서 무승부예요.`);
    }
    if (insufficient(pos)) return end(s, null, 'material', '양쪽 모두 체크메이트할 기물이 없어서 무승부예요.');
    if (s.keys.filter(k => k === key).length >= 3) return end(s, null, 'repetition', '같은 국면이 세 번 나와서 무승부예요 (3회 반복).');
    if (pos.half >= 100) return end(s, null, 'fifty', '50수 동안 폰 이동 · 잡기가 없어서 무승부예요 (50수 규칙).');
    s.msg = inCheck(pos) ? `체크! ${cur(s).name} 님(${colorName(pos.turn)})이 킹을 지켜야 해요.` : `${cur(s).name} 님(${colorName(pos.turn)}) 차례`;
  }
  function doMove(s, m, legal) {
    const pos = s.pos, by = cur(s);
    s.snaps.push({ fen: toFen(pos, true), keys: s.keys.length, hashes: s.hashes.length, moves: s.moves.length, last: s.last, cap: s.captured.map(c => c.length), clock: s.clock.on ? s.clock.left.slice() : null });
    if (s.snaps.length > 400) s.snaps.shift();
    const notation = san(pos, m, legal);
    if (s.clock.on) {
      const i = pos.turn === WHITE ? 0 : 1, now = Date.now();
      s.clock.left[i] = Math.max(0, s.clock.left[i] - (now - s.clock.turnStart)) + s.clock.inc;   // 한 수 둘 때마다 추가 시간
      s.clock.turnStart = now;
    }
    if (m.cap) s.captured[by.color === WHITE ? 0 : 1].push(CH[type(m.cap)].toLowerCase());
    make(pos, m);
    s.moves.push(notation);
    s.last = { f: sq64(m.from), t: sq64(m.to) };
    s.drawOffer = s.drawOffer === by.id ? s.drawOffer : null;   // 내가 수를 두면 내 제안은 그대로 · 상대 제안은 거절한 셈
    log(s, { t: 'move', id: by.id, san: notation, cap: !!m.cap, check: /[+#]$/.test(notation), castle: !!(m.flags & (F_KS | F_QS)) });
    afterMove(s);
  }
  function findMove(pos, a) {
    const f = sq88(+a.f), t = sq88(+a.to);
    if (!Number.isInteger(+a.f) || !Number.isInteger(+a.to) || +a.f < 0 || +a.f > 63 || +a.to < 0 || +a.to > 63) return { legal: [], m: null };
    const legal = legalMoves(pos), pr = { q: Q, r: R, b: B, n: N }[a.p] || Q;
    const m = legal.find(x => x.from === f && x.to === t && (!(x.flags & F_PRO) || type(x.promo) === pr));
    return { legal, m };
  }
  function act(s, id, a) {
    if (!a || typeof a !== 'object') return '잘못된 행동이에요.';
    if (s.over) return '게임이 끝났어요.';
    const me = s.players.find(p => p.id === id);
    if (!me) return '이 게임에 참가하지 않았어요.';
    if (a.t === 'resign') return end(s, other(s, id).id, 'resign', `${me.name} 님이 기권해서 ${other(s, id).name} 님이 이겼어요.`);
    if (a.t === 'draw') {
      if (s.drawOffer === id) return '이미 무승부를 제안했어요.';
      if (s.drawOffer) return act(s, id, { t: 'drawYes' });
      s.drawOffer = id; s.msg = `${me.name} 님이 무승부를 제안했어요.`;
      log(s, { t: 'offer', id }); return;
    }
    if (a.t === 'drawYes') {
      if (!s.drawOffer || s.drawOffer === id) return '받을 무승부 제안이 없어요.';
      return end(s, null, 'agreement', '두 사람이 합의해서 무승부예요.');
    }
    if (a.t === 'drawNo') {
      if (!s.drawOffer || s.drawOffer === id) return '거절할 제안이 없어요.';
      s.drawOffer = null; s.msg = `${me.name} 님이 무승부 제안을 거절했어요.`; log(s, { t: 'decline', id }); return;
    }
    if (a.t === 'undo') return undo(s, id);
    if (cur(s).id !== id) return '지금은 내 차례가 아니에요.';
    if (a.t !== 'move') return '알 수 없는 행동이에요.';
    const { legal, m } = findMove(s.pos, a);
    if (!m) return '그 수는 둘 수 없어요.';
    doMove(s, m, legal);
  }
  /** 무르기 (싱글에서만): 내 마지막 수까지 되돌려요 */
  function undo(s, id) {
    if (!s.undo) return '무르기는 싱글에서만 할 수 있어요.';
    const me = s.players.find(p => p.id === id);
    let back = 0;
    for (let i = s.snaps.length - 1; i >= 0; i--) { back++; const turnBefore = fromFen(s.snaps[i].fen).turn; if (turnBefore === me.color) break; }
    if (!back || back > s.snaps.length) return '무를 수가 없어요.';
    const snap = s.snaps[s.snaps.length - back];
    if (fromFen(snap.fen).turn !== me.color) return '무를 수가 없어요.';
    s.snaps.length -= back;
    s.pos = fromFen(snap.fen);
    s.keys.length = snap.keys; s.hashes.length = snap.hashes; s.moves.length = snap.moves; s.last = snap.last;
    s.captured.forEach((c, i) => { c.length = snap.cap[i]; });
    s.drawOffer = null; s.msg = '한 수 물렀어요.';
    log(s, { t: 'undo', id });
  }
  function free(s, id, a) { return !!a && ['resign', 'draw', 'drawYes', 'drawNo', 'undo'].includes(a.t); }
  function ai(s, id) {
    const me = s.players.find(p => p.id === id);
    if (s.drawOffer && s.drawOffer !== id) {                  // 무승부 제안 받기: 지고 있을 때만 받아요
      const e = evaluate(s.pos) * (s.pos.turn === me.color ? 1 : -1);
      return { t: e < -150 ? 'drawYes' : 'drawNo' };
    }
    if (cur(s).id !== id) return null;
    const lv = Object.assign({}, LEVELS[s.level] || LEVELS.normal);
    if (SERVER) lv.ms = Math.min(lv.ms, 250);
    if (s.clock.on) { const left = s.clock.left[me.color === WHITE ? 0 : 1]; lv.ms = Math.max(60, Math.min(lv.ms, left / 30)); }
    const m = search(s.pos, lv, s.hashes, s.rnd);
    return m ? { t: 'move', f: sq64(m.from), to: sq64(m.to), p: m.flags & F_PRO ? CH[type(m.promo)].toLowerCase() : undefined } : null;
  }
  function view(s, viewer) {
    const pos = s.pos, me = s.players.find(p => p.id === viewer), turn = cur(s);
    const board = [];
    for (let i = 0; i < 64; i++) { const p = pos.b[sq88(i)]; board.push(p ? (color(p) === WHITE ? CH[type(p)] : CH[type(p)].toLowerCase()) : ''); }
    const mine = !s.over && me && turn.id === viewer;
    const legal = mine ? legalMoves(pos).map(m => (m.flags & F_PRO ? [sq64(m.from), sq64(m.to), 1] : [sq64(m.from), sq64(m.to)])) : [];
    const ck = inCheck(pos) && !s.over ? sq64(pos.kings[pos.turn >> 3]) : s.over && s.reason === 'mate' ? sq64(pos.kings[pos.turn >> 3]) : null;
    let mat = 0;
    for (let i = 0; i < 64; i++) { const p = pos.b[sq88(i)]; if (p && type(p) !== K) mat += (color(p) === WHITE ? 1 : -1) * [0, 1, 3, 3, 5, 9][type(p)]; }
    return {
      board, turn: pos.turn === WHITE ? 'w' : 'b', turnId: s.over ? null : turn.id, myColor: me ? (me.color === WHITE ? 'w' : 'b') : null,
      legal, last: s.last, check: ck, moves: s.moves.slice(), fen: toFen(pos),
      players: s.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, color: p.color === WHITE ? 'w' : 'b', captured: s.captured[p.color === WHITE ? 0 : 1].slice() })),
      material: mat, over: s.over, winner: s.winner, reason: s.reason, msg: s.msg, drawOffer: s.drawOffer, undo: s.undo && s.snaps.length > 0,
      clock: s.clock.on ? { left: s.clock.left.slice(), run: s.over || s.clock.stopped ? null : (pos.turn === WHITE ? 0 : 1), since: s.clock.turnStart, inc: s.clock.inc, base: s.clock.base } : null,
      log: s.log.slice(-6), seq: s.seq, level: s.level,
    };
  }
  function result(s) {
    if (!s.over) return null;
    const w = s.players.find(p => p.id === s.winner);
    const reasons = { mate: '체크메이트', resign: '기권', time: '시간 초과', stalemate: '스테일메이트', repetition: '3회 반복', fifty: '50수 규칙', material: '기물 부족', agreement: '합의', left: '상대가 나감' };
    return {
      title: w ? `♞ ${w.name} 님 승리! (${reasons[s.reason] || ''})` : `🤝 무승부 (${reasons[s.reason] || ''})`,
      subtitle: `${s.msg} · ${Math.ceil(s.moves.length / 2)}수`,
      ranking: s.players.slice().sort((a, b) => (b.id === s.winner) - (a.id === s.winner)).map(p => ({ id: p.id, value: `${colorName(p.color)} · ${p.id === s.winner ? '승' : s.winner ? '패' : '무'}` })),
      winners: w ? [w.id] : [],
    };
  }
  /** 체스 시계: 지금 차례인 사람의 시간이 끝나는 때 */
  function deadline(s) { return s.over || !s.clock.on ? null : s.clock.turnStart + s.clock.left[s.pos.turn === WHITE ? 0 : 1]; }
  function timeup(s) {
    if (s.over || !s.clock.on) return;
    const loser = cur(s), win = other(s, loser.id);
    if (Date.now() < deadline(s) - 50) return;                   // 아직이에요 (타이머가 일찍 울린 경우)
    s.clock.left[s.pos.turn === WHITE ? 0 : 1] = 0;
    s.clock.stopped = true;
    if (!canMate(s.pos, win.color)) return end(s, null, 'time', `${loser.name} 님의 시간이 끝났지만 ${win.name} 님에게 체크메이트할 기물이 없어서 무승부예요.`);
    end(s, win.id, 'time', `${loser.name} 님의 시간이 끝나서 ${win.name} 님이 이겼어요.`);
  }
  /** 게임 중에 나가면 기권으로 처리해요 */
  function drop(s, id) {
    if (s.over) return;
    const p = s.players.find(x => x.id === id); if (!p) return;
    end(s, other(s, id).id, 'left', `${p.name} 님이 나가서 ${other(s, id).name} 님이 이겼어요.`);
  }

  return {
    meta: {
      name: '체스', min: 2, max: 2, bots: true, botDelay: [350, 700],
      options: [
        { key: 'bots', label: '🤖 봇 추가', def: 0, values: [[0, '없음'], [1, '1명']] },
        { key: 'level', label: '🧠 봇 실력', def: 'normal', values: [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']] },
        { key: 'clock', label: '⏱️ 시간', def: 10, values: [[3, '3분+2초'], [5, '5분'], [10, '10분'], [15, '15분+10초'], [30, '30분']] },
      ],
    },
    // 검사 · 화면용
    fromFen, toFen, legalMoves, make, unmake, san, inCheck, insufficient, canMate, search, evaluate, posKey, sq64, sq88, START, LEVELS, F_PRO,
    setup, act, ai, view, result, free, deadline, timeup, drop,
    pending: s => (s.over ? [] : s.drawOffer && cur(s).id === s.drawOffer ? [cur(s).id, other(s, s.drawOffer).id] : [cur(s).id]),
  };
});
