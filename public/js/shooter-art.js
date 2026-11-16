/* =====================================================================
 *  🎨 우주 슈팅 그림 (v14.0) — 그림 파일 없이 코드로 그린 도트 그림
 *   · 작은 그림(내 비행기 · 졸개 · 탄 · 아이템)은 글자 지도 → 도트, 큰 그림(중순양함 · 보스)은 도형을 1배로 그린 뒤 도트로 다듬어요
 *   · 모든 그림은 테두리(어두운 1칸)를 둘러서 배경에서 잘 보여요 · 맞으면 하얗게 번쩍이는 그림도 같이 만들어요
 *   · 배경: 스테이지마다 새로 만든 무늬(성운 · 소행성 먼지 · 정거장 철판 · 붉은 땅 · 모선 내부)를 이어 붙여 흘려요
 *   · 폭발: 크기 3가지 × 8장, 불꽃 → 연기로 (디더링)
 *   · 도트 글꼴: 숫자 · 영어 (점수 · STAGE · WARNING …)
 * ===================================================================== */
const ShArt = (() => {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

  /* ───── 색 (글자 → 색) ───── */
  const PAL = {
    k: '#0a0c18', W: '#ffffff', L: '#d6deef', M: '#97a6c7', D: '#56617f', E: '#2e3550',
    C: '#9df4ff', c: '#2aa8e0', b: '#1b4f9c', B: '#123069',
    R: '#ff6b78', r: '#d8263f', q: '#7d1430',
    O: '#ffb347', o: '#e5732a', u: '#9c4416',
    Y: '#fff6b0', y: '#ffd23f', z: '#c99a1c',
    G: '#a8ff8f', g: '#3fbf5a', h: '#1f6b3a',
    P: '#ecc6ff', p: '#a46cff', v: '#5a2fa8', V: '#34186b',
    T: '#f3cfa0', n: '#9a6a44', N: '#5c3a26', s: '#3a2618',
    a: '#7a8090', A: '#4a4f5c',
  };

  /* ───── 기본 도구 ───── */
  /** 글자 지도 → 도트 그림 */
  function pix(rows, pal = {}) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length)), c = mk(w, h), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i]; if (ch === '.' || ch === ' ') continue;
      x.fillStyle = pal[ch] || PAL[ch] || '#f0f'; x.fillRect(i, j, 1, 1);
    }
    return c;
  }
  /** 왼쪽 절반(가운데 줄 포함) → 좌우 대칭 */
  const sym = half => half.map(r => r + [...r.slice(0, -1)].reverse().join(''));
  /** 어두운 테두리 1칸 (그림이 2칸 커져요) */
  function outline(src, col = PAL.k) {
    const w = src.width + 2, h = src.height + 2, c = mk(w, h), x = c.getContext('2d');
    x.drawImage(src, 1, 1);
    const d = x.getImageData(0, 0, w, h), a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = d.data[i * 4 + 3] > 0 ? 1 : 0;
    const [R, G, B] = hex(col);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i; if (a[k]) continue;
      if ((i > 0 && a[k - 1]) || (i < w - 1 && a[k + 1]) || (j > 0 && a[k - w]) || (j < h - 1 && a[k + w])) { d.data[k * 4] = R; d.data[k * 4 + 1] = G; d.data[k * 4 + 2] = B; d.data[k * 4 + 3] = 255; }
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  /** 하얀 그림자 (맞았을 때 번쩍) */
  function whiten(src, col = '#ffffff') {
    const c = mk(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  /** 도트 그대로 돌리기 (가장 가까운 칸) */
  function rotate(src, ang) {
    const s = Math.ceil(Math.hypot(src.width, src.height)) | 1, c = mk(s, s), x = c.getContext('2d');
    const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, out = x.createImageData(s, s);
    const ca = Math.cos(-ang), sa = Math.sin(-ang), cx = s / 2, cy = s / 2, hx = src.width / 2, hy = src.height / 2;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const dx = i + 0.5 - cx, dy = j + 0.5 - cy, u = Math.floor(dx * ca - dy * sa + hx), v = Math.floor(dx * sa + dy * ca + hy);
      if (u < 0 || v < 0 || u >= src.width || v >= src.height) continue;
      const k = (v * src.width + u) * 4, o = (j * s + i) * 4;
      out.data[o] = sd[k]; out.data[o + 1] = sd[k + 1]; out.data[o + 2] = sd[k + 2]; out.data[o + 3] = sd[k + 3];
    }
    x.putImageData(out, 0, 0);
    return c;
  }
  /** 도형으로 그린 뒤 도트로: 반투명 가장자리를 잘라 내고 가까운 색으로 맞춰요 */
  function vec(w, h, draw, opt = {}) {
    const c = mk(w, h), x = c.getContext('2d');
    draw(x, w, h);
    const d = x.getImageData(0, 0, w, h), pal = opt.pal ? opt.pal.map(hex) : null;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4, al = d.data[o + 3];
      if (al < 110) { d.data[o + 3] = 0; continue; }
      let r = d.data[o] * 255 / al, g = d.data[o + 1] * 255 / al, b = d.data[o + 2] * 255 / al;
      if (pal) { let best = 0, bd = 1e9; for (let k = 0; k < pal.length; k++) { const q = pal[k], dd = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2; if (dd < bd) { bd = dd; best = k; } } [r, g, b] = pal[best]; }
      d.data[o] = r; d.data[o + 1] = g; d.data[o + 2] = b; d.data[o + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return opt.noOutline ? c : outline(c, opt.outline);
  }
  /** 그림 하나: 테두리 + 하얀 번쩍 */
  const sprite = (c, o = {}) => ({ c, w: c.width, h: c.height, wh: whiten(c), ...o });
  /** 16방향 (아래가 기준) */
  function dirs(c, n = 16) { const out = []; for (let i = 0; i < n; i++) { const r = rotate(c, (i / n) * Math.PI * 2); out.push({ c: r, w: r.width, h: r.height, wh: whiten(r) }); } return out; }

  // 도형 그리기 도우미
  const poly = (x, pts, fill) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fillStyle = fill; x.fill(); };
  const ell = (x, cx, cy, rx, ry, fill) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); };
  const rect = (x, a, b, w, h, fill) => { x.fillStyle = fill; x.fillRect(a, b, w, h); };
  const lin = (x, x0, y0, x1, y1, stops) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  /** 좌우 대칭 도형 (오른쪽 반만 적어요: x 는 가운데에서 떨어진 거리) */
  const mpoly = (x, cx, pts, fill) => { poly(x, pts.map(([a, b]) => [cx + a, b]).concat(pts.slice().reverse().map(([a, b]) => [cx - a, b])), fill); };

  /* ═════════ 내 비행기 ═════════ */
  const SHIP = sym([
    '.........W',
    '........LW',
    '........LW',
    '........LC',
    '.......DLC',
    '.......DMc',
    '.......DMc',
    '......EDML',
    '......DMLL',
    '.....rDMLW',
    '....rRDMML',
    '...rRDDMML',
    '..rRDMDMML',
    '.rRDMMDMLL',
    'rRDDMMDDML',
    'qrEDDDEEDM',
    '...EE.E.ED',
  ]);
  /** 기울어진 모습: 기우는 쪽 날개 끝을 지우고 반대쪽은 그늘지게 (k: 지울 칸 수) */
  function bank(rows, k) {
    const w = rows[0].length, h = w >> 1;
    return rows.map(r => [...r].map((ch, i) => (i < k ? '.' : i > h && ch !== '.' ? ({ L: 'M', M: 'D', W: 'L', R: 'r', D: 'E' }[ch] || ch) : ch)).join(''));
  }
  // 엔진 불꽃 (3장)
  const FLAME = [['YyY', 'yOy', '.O.', '.o.'], ['YYY', 'yOy', 'yOy', '.O.', '.o.'], ['Yy.', 'yOY', '.Oy', '.o.']];
  const DRONE = sym(['...W', '..LC', '.DMc', 'DMLM', 'EDMD', '.EDE', '..o.']);

  /* ═════════ 적 (아래를 보는 모습) ═════════ */
  const ZAKO = sym([
    '.q.....',
    'qrq....',
    'qRrq...',
    'qRRrq.q',
    '.qRRrqr',
    '.qrRRDD',
    '..qrDMY',
    '..qrDMW',
    '...qrDM',
    '..qr.qD',
    '..q...q',
  ]);
  const SWOOP = sym([
    'B.......',
    'bB......',
    'cbB.....',
    'Ccb..EE.',
    '.CcbEDM.',
    '.CccbDMM',
    '..CccbML',
    '...CcbLW',
    '....CbDC',
    '.....bDc',
    '......Bc',
    '.......b',
  ]);
  const KAMI = sym([
    '......p',
    '.....pP',
    'p...vpP',
    'Pp.vpPP',
    '.PpvvpR',
    '..vvqRW',
    '.pvqRrR',
    'pPvvqRr',
    '..vvvqq',
    '...vpv.',
    '....p..',
  ]);
  const POP = [
    sym(['..oO', '.oOY', 'oOYW', 'uoOY', 'uuoO']).concat(sym(['.uuo', '..uu'])),
    sym(['..oO', '.oOO', 'oOOY', 'uoOO', 'uuoO']).concat(sym(['.uuo', '..uu'])),
  ];
  const MINE = sym([
    '.....A',
    '..A.Aa',
    '...AaD',
    '.AAaDD',
    'AaaDDr',
    '..aDrR',
  ]).concat(sym(['.AAaDD', '...AaD', '..A.Aa', '.....A']));
  const MEDAL = [
    sym(['..zy', '.zyY', 'zyYW', 'zyYY', 'zyyY', '.zyy', '..zz']),
    sym(['...y', '..zY', '..yW', '..yY', '..yY', '..zy', '...z']),
    sym(['....', '...Y', '...W', '...Y', '...y', '...z', '....']),
  ];

  /* ═════════ 아이템 ═════════ */
  // 캡슐 바탕 (16 × 16): 모양마다 테두리 색
  function capsule(shape, col, icon) {
    return vec(17, 17, x => {
      x.translate(8.5, 8.5);
      const path = () => {
        x.beginPath();
        if (shape === 'hex') for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 8.2, Math.sin(a) * 8.2); }
        else if (shape === 'shield') { x.moveTo(0, -8.2); x.lineTo(7, -5.4); x.lineTo(6.6, 1.6); x.quadraticCurveTo(4.8, 6, 0, 8.4); x.quadraticCurveTo(-4.8, 6, -6.6, 1.6); x.lineTo(-7, -5.4); }
        else if (shape === 'diamond') { x.moveTo(0, -8.4); x.lineTo(8.4, 0); x.lineTo(0, 8.4); x.lineTo(-8.4, 0); }
        else x.arc(0, 0, 7.8, 0, Math.PI * 2);
        x.closePath();
      };
      path(); x.fillStyle = col; x.fill();
      x.save(); x.scale(0.78, 0.78); path(); x.fillStyle = '#0d1226'; x.fill(); x.restore();
      icon(x);
    }, { pal: [PAL.k, '#0d1226', PAL.W, col, PAL.Y, PAL.y, PAL.O, PAL.R, PAL.r, PAL.C, PAL.c, PAL.G, PAL.g, PAL.P, PAL.p, PAL.L, PAL.M, PAL.D] });
  }
  const ICONS = {
    P: x => { x.fillStyle = '#ffb347'; for (const oy of [-2.5, 2]) { x.beginPath(); x.moveTo(-4, oy + 2.4); x.lineTo(0, oy - 2.2); x.lineTo(4, oy + 2.4); x.lineTo(2.4, oy + 2.4); x.lineTo(0, oy); x.lineTo(-2.4, oy + 2.4); x.closePath(); x.fill(); } },
    V: x => { for (const a of [-0.66, 0, 0.66]) { x.save(); x.translate(0, 4.6); x.rotate(a); x.fillStyle = '#ffd23f'; x.fillRect(-1, -10, 2, 5.6); x.fillStyle = '#fff6b0'; x.fillRect(-1, -10, 2, 1.8); x.restore(); } x.fillStyle = '#ffb347'; x.fillRect(-1.2, 3, 2.4, 2.4); },
    L: x => { x.fillStyle = '#2aa8e0'; x.fillRect(-2.5, -6, 5, 12); x.fillStyle = '#9df4ff'; x.fillRect(-1, -6, 2, 12); },
    M: x => { x.rotate(Math.PI / 4); x.fillStyle = '#ffd9d0'; x.fillRect(-1.5, -4, 3, 7); x.fillStyle = '#ff5d6c'; x.beginPath(); x.moveTo(-1.5, -4); x.lineTo(0, -6.5); x.lineTo(1.5, -4); x.fill(); x.fillRect(-3, 2, 6, 1.5); x.fillStyle = '#ffb347'; x.fillRect(-1, 3.5, 2, 2.5); },
    B: x => { x.fillStyle = '#56617f'; x.beginPath(); x.arc(-0.5, 1.2, 4.2, 0, 7); x.fill(); x.fillStyle = '#97a6c7'; x.fillRect(-2.6, -1.4, 1.6, 1.6); x.fillStyle = '#ff6b78'; x.fillRect(2, -4.8, 2, 2); x.fillStyle = '#fff6b0'; x.fillRect(3, -5.8, 1.4, 1.4); },
    S: x => { x.fillStyle = '#3fbf5a'; x.beginPath(); x.moveTo(0, -5); x.lineTo(4.2, -3); x.lineTo(3.8, 1); x.quadraticCurveTo(2.6, 4, 0, 5.4); x.quadraticCurveTo(-2.6, 4, -3.8, 1); x.lineTo(-4.2, -3); x.closePath(); x.fill(); x.fillStyle = '#a8ff8f'; x.fillRect(-0.8, -3.5, 1.6, 6); x.fillRect(-2.6, -1.2, 5.2, 1.6); },
    D: x => { x.fillStyle = '#a46cff'; x.beginPath(); x.moveTo(0, -5); x.lineTo(-4, 4); x.lineTo(4, 4); x.closePath(); x.fill(); x.fillStyle = '#ecc6ff'; x.fillRect(-1, -1, 2, 2); x.fillStyle = '#97a6c7'; x.fillRect(-6, -2, 2.4, 1.2); x.fillRect(3.6, -2, 2.4, 1.2); },
  };

  /* ═════════ 탄 ═════════ */
  const BUL = {
    o: pix(['.RR.', 'RWWR', 'RWWR', '.RR.'], { R: '#ff4fa3', W: '#fff0f8' }),
    O: pix(['..OO..', '.OYYO.', 'OYWWYO', 'OYWWYO', '.OYYO.', '..OO..'], { O: '#ff8a2a', Y: '#ffd27a', W: '#ffffff' }),
    n: pix(['.C.', 'CWC', 'CWC', 'CWC', 'CWC', '.C.'], { C: '#29c6ff', W: '#e8fbff' }),
    s: pix(['..P..', '.PWP.', 'PWWWP', '.PWP.', '..P..'], { P: '#b77bff', W: '#f6eaff' }),
    B: pix(['...RR...', '..RYYR..', '.RYWWYR.', 'RYWWWWYR', 'RYWWWWYR', '.RYWWYR.', '..RYYR..', '...RR...'], { R: '#ff3a52', Y: '#ff9aa6', W: '#ffffff' }),
  };
  const SHOT_V = pix(['.W.', 'YWY', 'YWY', 'YWY', 'yYy', 'yYy', 'oyo', '.o.', '.u.'], {});
  const SHOT_D = pix(['P', 'W', 'P', 'p'], {});
  const MISSILE = pix(['.W.', 'RWR', 'LWL', 'LWL', 'LML', 'rLr', 'r.r'], {});

  /* ═════════ 큰 적 · 보스 (도형 → 도트) ═════════ */
  const STEEL = ['#0a0c18', '#ffffff', '#d6deef', '#b7c3dc', '#97a6c7', '#76839f', '#56617f', '#3d4663', '#2e3550', '#1d2238'];
  const GUNPAL = STEEL.concat(['#a8ff8f', '#6fd86a', '#3fbf5a', '#2a8c45', '#1f6b3a', '#ff6b78', '#d8263f', '#ffd23f', '#fff6b0', '#9df4ff']);
  function gunship() {
    return vec(26, 22, x => {
      const cx = 13;
      mpoly(x, cx, [[0, 21], [4, 19], [9, 12], [12, 4], [10, 1], [5, 3], [3, 0], [0, 0]], lin(x, 0, 0, 0, 22, [[0, '#2a8c45'], [1, '#1f6b3a']]));
      mpoly(x, cx, [[0, 19], [3, 17], [6, 10], [6, 3], [3, 2], [0, 2]], lin(x, 0, 0, 0, 22, [[0, '#6fd86a'], [1, '#3fbf5a']]));
      mpoly(x, cx, [[9, 12], [12, 4], [11, 9]], '#a8ff8f');
      ell(x, cx, 9, 3.4, 3.4, '#3d4663'); ell(x, cx, 9, 2.2, 2.2, '#76839f');
      rect(x, cx - 1, 11, 2, 7, '#56617f'); rect(x, cx - 0.5, 12, 1, 6, '#97a6c7');
      rect(x, cx - 9, 4, 2, 3, '#ff6b78'); rect(x, cx + 7, 4, 2, 3, '#ff6b78');
      rect(x, cx - 5, 1, 2, 2, '#fff6b0'); rect(x, cx + 3, 1, 2, 2, '#fff6b0');
    }, { pal: GUNPAL });
  }
  function carrier() {
    return vec(34, 18, x => {
      const cx = 17;
      mpoly(x, cx, [[0, 1], [7, 1], [13, 4], [16, 9], [13, 14], [7, 17], [0, 17]], lin(x, 0, 0, 0, 18, [[0, '#ffe68a'], [0.5, '#e0a92a'], [1, '#8a5a12']]));
      mpoly(x, cx, [[0, 3], [6, 3], [10, 6], [10, 12], [6, 15], [0, 15]], '#c98d1c');
      ell(x, cx, 7, 4, 3, '#9df4ff'); ell(x, cx - 1, 6, 1.6, 1, '#ffffff');
      for (let i = -2; i <= 2; i++) rect(x, cx + i * 5 - 1, 12, 2, 2, i % 2 ? '#ff6b78' : '#fff6b0');
    }, { pal: ['#0a0c18', '#ffffff', '#fff6b0', '#ffe68a', '#ffd23f', '#e0a92a', '#c98d1c', '#8a5a12', '#5c3a12', '#9df4ff', '#ff6b78'] });
  }
  function heavy() {
    return vec(46, 42, x => {
      const cx = 23;
      mpoly(x, cx, [[0, 41], [6, 38], [12, 30], [20, 22], [22, 12], [17, 4], [10, 2], [6, 0], [0, 0]], lin(x, 0, 0, 0, 42, [[0, '#56617f'], [1, '#2e3550']]));
      mpoly(x, cx, [[0, 38], [5, 35], [9, 26], [10, 10], [6, 3], [0, 3]], lin(x, 0, 0, 0, 42, [[0, '#b7c3dc'], [0.6, '#76839f'], [1, '#56617f']]));
      mpoly(x, cx, [[20, 22], [22, 12], [17, 4], [19, 14]], '#97a6c7');
      for (const s of [-1, 1]) { ell(x, cx + s * 14, 20, 5, 5, '#2e3550'); ell(x, cx + s * 14, 20, 3.4, 3.4, '#d8263f'); ell(x, cx + s * 14 - 1, 19, 1.2, 1.2, '#ff9aa6'); rect(x, cx + s * 14 - 1, 23, 2, 6, '#3d4663'); }
      ell(x, cx, 16, 4, 6, '#1d2238'); ell(x, cx, 15, 2.6, 4, '#9df4ff'); rect(x, cx - 1, 12, 1, 3, '#ffffff');
      for (let i = 0; i < 4; i++) rect(x, cx - 3, 26 + i * 3, 6, 1, '#3d4663');
      rect(x, cx - 9, 2, 3, 2, '#ffd23f'); rect(x, cx + 6, 2, 3, 2, '#ffd23f');
    }, { pal: STEEL.concat(['#d8263f', '#ff9aa6', '#9df4ff', '#ffd23f']) });
  }
  function turretBase() {
    return vec(16, 16, x => { ell(x, 8, 8, 7.4, 7.4, '#3d4663'); ell(x, 8, 8, 5.6, 5.6, '#76839f'); ell(x, 7, 7, 3.4, 3.4, '#b7c3dc'); ell(x, 8, 8, 2.2, 2.2, '#d8263f'); }, { pal: STEEL.concat(['#d8263f']) });
  }
  function rockGfx(r, seed) {
    const R = rng(seed), n = 11, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (0.78 + R() * 0.26); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    const s = Math.ceil(r * 2 + 2);
    return vec(s, s, x => {
      x.translate(s / 2, s / 2);
      poly(x, pts, '#5c3a26');
      x.save(); x.translate(-r * 0.12, -r * 0.14); x.scale(0.82, 0.82); poly(x, pts, '#8a5a3a'); x.restore();
      x.save(); x.translate(-r * 0.26, -r * 0.3); x.scale(0.5, 0.5); poly(x, pts, '#b98a5e'); x.restore();
      for (let i = 0; i < 3; i++) { const a = R() * 6.28, d = R() * r * 0.5; ell(x, Math.cos(a) * d, Math.sin(a) * d, r * 0.16, r * 0.13, '#4a2e1e'); }
    }, { pal: ['#0a0c18', '#2e1c12', '#4a2e1e', '#5c3a26', '#8a5a3a', '#b98a5e', '#d8b080'] });
  }

  /* 중간 보스 · 보스 몸 */
  const BPAL = STEEL.concat(['#ff6b78', '#d8263f', '#7d1430', '#ffb347', '#e5732a', '#ffd23f', '#fff6b0', '#9df4ff', '#2aa8e0', '#1b4f9c', '#a46cff', '#5a2fa8', '#a8ff8f', '#3fbf5a', '#9a6a44', '#5c3a26', '#3a2618', '#b98a5e']);
  const BODY = {
    stinger(x, w, h) {
      const cx = w / 2;
      mpoly(x, cx, [[0, 45], [3, 40], [8, 30], [22, 26], [29, 16], [26, 8], [16, 10], [10, 2], [0, 0]], lin(x, 0, 0, 0, h, [[0, '#5a2fa8'], [1, '#34186b']]));
      mpoly(x, cx, [[0, 40], [5, 30], [16, 24], [22, 16], [16, 13], [8, 6], [0, 4]], lin(x, 0, 0, 0, h, [[0, '#a46cff'], [1, '#5a2fa8']]));
      mpoly(x, cx, [[22, 16], [26, 8], [29, 16]], '#ecc6ff');
      ell(x, cx, 20, 9, 9, '#1d2238');
      mpoly(x, cx, [[0, 46], [2, 40], [0, 36]], '#ffd23f');
    },
    orb(x, w, h) {
      const cx = w / 2, cy = h / 2;
      ell(x, cx, cy, 22, 22, '#1d2238'); ell(x, cx, cy, 20, 20, lin(x, 0, 0, 0, h, [[0, '#76839f'], [1, '#2e3550']]));
      ell(x, cx - 5, cy - 6, 12, 10, '#97a6c7'); ell(x, cx - 8, cy - 9, 5, 4, '#d6deef');
      rect(x, cx - 20, cy - 1, 40, 3, '#3d4663');
      ell(x, cx, cy, 10, 10, '#1d2238');
    },
    crab(x, w, h) {
      const cx = w / 2;
      mpoly(x, cx, [[0, 70], [10, 66], [20, 56], [34, 50], [40, 38], [36, 22], [26, 12], [14, 6], [0, 4]], lin(x, 0, 0, 0, h, [[0, '#3d4663'], [1, '#1d2238']]));
      mpoly(x, cx, [[0, 64], [9, 60], [16, 50], [28, 44], [32, 32], [28, 20], [18, 12], [8, 9], [0, 8]], lin(x, 0, 0, 0, h, [[0, '#97a6c7'], [0.6, '#56617f'], [1, '#3d4663']]));
      for (const s of [-1, 1]) { poly(x, [[cx + s * 30, 30], [cx + s * 58, 18], [cx + s * 62, 28], [cx + s * 36, 42]], '#3d4663'); poly(x, [[cx + s * 34, 32], [cx + s * 56, 22], [cx + s * 58, 26], [cx + s * 36, 38]], '#76839f'); }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) poly(x, [[cx + s * (12 + i * 7), 58 - i * 3], [cx + s * (16 + i * 8), 72 - i * 2], [cx + s * (19 + i * 8), 70 - i * 2], [cx + s * (17 + i * 7), 56 - i * 3]], '#2e3550');
      mpoly(x, cx, [[0, 14], [8, 16], [12, 22], [0, 20]], '#d6deef');
      for (const s of [-1, 1]) { rect(x, cx + s * 22 - 2, 26, 4, 2, '#ffb347'); rect(x, cx + s * 18 - 1, 52, 2, 3, '#ff6b78'); }
      ell(x, cx, 34, 13, 13, '#1d2238');
    },
    fortress(x, w, h) {
      const cx = w / 2, cy = h / 2, R = rng(17), pts = [];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 40 + R() * 8; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92]); }
      poly(x, pts, '#3a2618');
      x.save(); x.translate(cx - 4, cy - 5); x.scale(0.86, 0.86); x.translate(-cx, -cy); poly(x, pts, '#5c3a26'); x.restore();
      x.save(); x.translate(cx - 10, cy - 12); x.scale(0.6, 0.6); x.translate(-cx, -cy); poly(x, pts, '#9a6a44'); x.restore();
      for (let i = 0; i < 6; i++) { const a = R() * 6.28, d = 14 + R() * 22; ell(x, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 5, 4, '#3a2618'); ell(x, cx + Math.cos(a) * d - 1, cy + Math.sin(a) * d - 1, 3, 2, '#5c3a26'); }
      x.fillStyle = '#56617f'; x.fillRect(cx - 44, cy - 4, 88, 7); x.fillStyle = '#97a6c7'; x.fillRect(cx - 44, cy - 4, 88, 2);
      for (let i = -4; i <= 4; i++) rect(x, cx + i * 10 - 1, cy - 2, 2, 3, '#ffd23f');
      ell(x, cx, cy, 15, 15, '#1d2238');
    },
    guard(x, w, h) {
      const cx = w / 2;
      mpoly(x, cx, [[0, 56], [16, 52], [44, 48], [66, 44], [74, 34], [74, 16], [66, 8], [44, 10], [20, 4], [0, 2]], lin(x, 0, 0, 0, h, [[0, '#56617f'], [1, '#1d2238']]));
      mpoly(x, cx, [[0, 50], [14, 46], [40, 42], [58, 38], [64, 30], [64, 18], [56, 13], [40, 15], [18, 9], [0, 7]], lin(x, 0, 0, 0, h, [[0, '#b7c3dc'], [0.5, '#76839f'], [1, '#3d4663']]));
      for (let i = 1; i <= 5; i++) { rect(x, cx + i * 9, 20, 1, 22, '#3d4663'); rect(x, cx - i * 9 - 1, 20, 1, 22, '#3d4663'); }
      mpoly(x, cx, [[0, 9], [16, 11], [30, 16], [0, 14]], '#d6deef');
      for (const s of [-1, 1]) { rect(x, cx + s * 36 - 3, 44, 6, 3, '#ffd23f'); rect(x, cx + s * 22 - 2, 12, 4, 2, '#9df4ff'); }
      ell(x, cx, 30, 13, 13, '#1d2238');
    },
    bomber(x, w, h) {
      const cx = w / 2;
      mpoly(x, cx, [[0, 80], [6, 74], [12, 50], [30, 44], [66, 30], [68, 22], [40, 18], [16, 10], [10, 0], [0, 0]], lin(x, 0, 0, 0, h, [[0, '#7d1430'], [1, '#3a0e18']]));
      mpoly(x, cx, [[0, 74], [5, 68], [9, 48], [26, 40], [56, 28], [40, 24], [14, 16], [8, 4], [0, 4]], lin(x, 0, 0, 0, h, [[0, '#ff6b78'], [0.5, '#d8263f'], [1, '#7d1430']]));
      mpoly(x, cx, [[40, 24], [56, 28], [66, 30], [68, 22]], '#ffb347');
      mpoly(x, cx, [[0, 30], [5, 28], [6, 14], [0, 10]], '#1d2238');
      ell(x, cx, 18, 3, 6, '#9df4ff'); rect(x, cx - 1, 14, 1, 4, '#ffffff');
      for (const s of [-1, 1]) { rect(x, cx + s * 24 - 3, 34, 6, 3, '#1d2238'); rect(x, cx + s * 44 - 2, 30, 4, 2, '#fff6b0'); }
      ell(x, cx, 50, 13, 13, '#1d2238');
    },
    mother(x, w, h) {
      const cx = w / 2, cy = h / 2 + 2;
      mpoly(x, cx, [[0, 110], [30, 100], [62, 78], [76, 56], [70, 26], [48, 8], [20, 2], [0, 0]], lin(x, 0, 0, 0, h, [[0, '#5a2fa8'], [0.5, '#34186b'], [1, '#1d1035']]));
      mpoly(x, cx, [[0, 102], [26, 94], [54, 74], [66, 54], [60, 28], [42, 12], [18, 7], [0, 6]], lin(x, 0, 0, 0, h, [[0, '#76839f'], [1, '#2e3550']]));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; poly(x, [[cx + Math.cos(a) * 24, cy + Math.sin(a) * 24], [cx + Math.cos(a + 0.35) * 44, cy + Math.sin(a + 0.35) * 40], [cx + Math.cos(a + 0.7) * 24, cy + Math.sin(a + 0.7) * 24]], '#a46cff'); }
      ell(x, cx, cy, 26, 26, '#34186b');
      mpoly(x, cx, [[0, 10], [16, 12], [30, 20], [0, 18]], '#b7c3dc');
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rect(x, cx + s * (30 + i * 8) - 1, 86 - i * 8, 2, 2, '#ffd23f');
      ell(x, cx, cy, 19, 19, '#1d2238');
    },
  };
  // 부위 그림 (16 ~ 30 칸)
  const PART = {
    core(open, col = '#ff3a52', glow = '#ffd0d6') {
      return vec(30, 30, x => {
        ell(x, 15, 15, 14, 14, '#2e3550'); ell(x, 15, 15, 12, 12, '#56617f');
        if (open) { ell(x, 15, 15, 9.5, 9.5, col); ell(x, 15, 15, 6, 6, glow); ell(x, 13, 13, 2.4, 2.4, '#ffffff'); }
        else { for (let i = 0; i < 4; i++) { x.save(); x.translate(15, 15); x.rotate(i * Math.PI / 2 + Math.PI / 4); poly(x, [[0, 0], [11, -4], [11, 4]], i % 2 ? '#97a6c7' : '#76839f'); x.restore(); } ell(x, 15, 15, 3, 3, '#3d4663'); }
      }, { pal: BPAL.concat([col, glow]) });
    },
    claw(s) {
      return vec(28, 28, x => {
        x.translate(14, 14); x.scale(s, 1);
        poly(x, [[-10, -10], [6, -8], [11, 2], [8, 13], [3, 7], [-2, 12], [-6, 4]], '#3d4663');
        poly(x, [[-8, -8], [5, -6], [8, 2], [6, 9], [2, 4], [-3, 8], [-5, 2]], '#97a6c7');
        poly(x, [[-6, -6], [3, -5], [4, -1], [-4, 0]], '#d6deef');
        ell(x, 0, -2, 3.2, 3.2, '#d8263f'); ell(x, -0.6, -2.6, 1, 1, '#ffd0d6');
      }, { pal: BPAL });
    },
    turret() { return vec(20, 20, x => { ell(x, 10, 10, 9, 9, '#3a2618'); ell(x, 10, 10, 7.4, 7.4, '#76839f'); ell(x, 9, 9, 4.6, 4.6, '#b7c3dc'); ell(x, 10, 10, 3, 3, '#ffb347'); rect(x, 9, 12, 2, 7, '#3d4663'); }, { pal: BPAL }); },
    emitter() {
      return vec(26, 24, x => {
        mpoly(x, 13, [[0, 23], [6, 20], [11, 10], [11, 3], [6, 0], [0, 0]], '#3d4663'); mpoly(x, 13, [[0, 20], [5, 17], [8, 9], [8, 4], [4, 2], [0, 2]], '#97a6c7');
        ell(x, 13, 12, 5, 5, '#1b4f9c'); ell(x, 13, 12, 3.2, 3.2, '#9df4ff'); ell(x, 12, 11, 1.2, 1.2, '#ffffff');
      }, { pal: BPAL });
    },
    wingGun() { return vec(22, 22, x => { ell(x, 11, 10, 9, 8, '#3a0e18'); ell(x, 11, 9, 7, 6, '#d8263f'); ell(x, 9, 7, 3, 2, '#ff9aa6'); rect(x, 9, 13, 4, 8, '#2e3550'); rect(x, 10, 14, 2, 7, '#76839f'); }, { pal: BPAL.concat(['#3a0e18', '#ff9aa6']) }); },
    pod() { return vec(22, 22, x => { ell(x, 11, 11, 10, 10, '#34186b'); ell(x, 11, 11, 8, 8, '#a46cff'); ell(x, 9, 9, 4, 3.4, '#ecc6ff'); ell(x, 11, 12, 3.4, 3.4, '#ffd23f'); ell(x, 11, 12, 1.6, 1.6, '#ffffff'); }, { pal: BPAL.concat(['#ecc6ff']) }); },
  };

  /* ═════════ 폭발 · 연기 · 파편 ═════════ */
  const FIRE = ['#ffffff', '#fff6b0', '#ffd23f', '#ffb347', '#e5732a', '#c43a1e', '#7a1e18', '#4a3a40', '#2c2630'];
  function explosion(size, seed, frames = 8) {
    const R = rng(seed), h = size / 2;
    const puffs = [{ x: 0, y: 0, r: size * 0.3, t: 0 }];
    const n = size < 22 ? 4 : size < 40 ? 7 : 11;
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + R() * 0.8, d = size * (0.12 + R() * 0.16); puffs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: size * (0.13 + R() * 0.12), t: R() * 0.3 }); }
    const out = [];
    for (let f = 0; f < frames; f++) {
      const q = f / (frames - 1), c = mk(size, size), x = c.getContext('2d'), img = x.createImageData(size, size);
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
        let v = 0;
        for (const p of puffs) {
          if (q < p.t) continue;
          const pq = Math.min(1, (q - p.t) / (1 - p.t)), rr = p.r * (0.4 + 1.0 * Math.sqrt(pq)), sp = 1 + pq * 0.6;
          const d = Math.hypot(i + 0.5 - h - p.x * sp, j + 0.5 - h - p.y * sp + pq * size * 0.05);
          if (d < rr) v = Math.max(v, 1 - d / rr);
        }
        if (v <= 0) continue;
        if (v < q * q * 0.75 + bay(i, j) * 0.22 * q) continue;               // 끝으로 갈수록 구멍이 숭숭
        const heat = v * (1.15 - q * 0.75) + (1 - q) * 0.45 - q * 0.35 + (bay(i, j) - 0.5) * 0.16;
        const idx = heat > 1.05 ? 0 : heat > 0.86 ? 1 : heat > 0.68 ? 2 : heat > 0.52 ? 3 : heat > 0.38 ? 4 : heat > 0.24 ? 5 : heat > 0.1 ? 6 : heat > -0.08 ? 7 : 8;
        const [r, g, b] = hex(FIRE[idx]), o = (j * size + i) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      out.push(c);
    }
    return out;
  }
  function puff(size, shade) {
    const c = mk(size, size), x = c.getContext('2d'), h = size / 2;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const d = Math.hypot(i + 0.5 - h, j + 0.5 - h) / h; if (d > 1) continue;
      if (d > 0.55 && bay(i, j) < (d - 0.55) * 2.2) continue;
      x.fillStyle = d < 0.4 - (j - h) / size * 0.4 ? shade[0] : shade[1]; x.fillRect(i, j, 1, 1);
    }
    return c;
  }
  const DEBRIS = [pix(['MD', 'DE']), pix(['LMD', 'MDE']), pix(['oO', 'uo']), pix(['ML.', 'DMD', '.DE']), pix(['rR', 'qr'])];

  /* ═════════ 빛 (부드러운 번짐 — 더하기로 그려요) ═════════ */
  function glow(r, col, a = 1) {
    const s = r * 2, c = mk(s * 4, s * 4), x = c.getContext('2d'), g = x.createRadialGradient(s * 2, s * 2, 0, s * 2, s * 2, s * 2);
    const [R, G, B] = hex(col);
    g.addColorStop(0, `rgba(${R},${G},${B},${a})`); g.addColorStop(0.35, `rgba(${R},${G},${B},${a * 0.4})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
    x.fillStyle = g; x.fillRect(0, 0, s * 4, s * 4);
    return { c, r };   // 그릴 때: r*2 크기 (4배로 만들어서 부드러워요)
  }

  /* ═════════ 도트 글꼴 (5 × 7) ═════════ */
  const GLYPH = {
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'], J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'], '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'], ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
    ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'], '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'], 'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'], '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'], '*': ['..#..', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '..#..'],
  };
  const fontCache = {};
  /** 글자 하나 (테두리 포함 7 × 9) */
  function glyph(ch, col) {
    const key = ch + col;
    if (fontCache[key]) return fontCache[key];
    const g = GLYPH[ch] || GLYPH['?'], c = mk(5, 7), x = c.getContext('2d');
    // 위는 밝게 · 아래는 조금 어둡게 (오락실 글자 느낌)
    const [R, G, B] = hex(col), dark = `rgb(${R * 0.72 | 0},${G * 0.72 | 0},${B * 0.72 | 0})`;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j][i] === '#') { x.fillStyle = j >= 4 ? dark : col; x.fillRect(i, j, 1, 1); }
    return (fontCache[key] = outline(c));
  }
  /** 도트 글자 쓰기 — align: 0 왼쪽 · 0.5 가운데 · 1 오른쪽 · s: 크기(정수 배) */
  function text(ctx, str, x, y, col = '#ffffff', s = 1, align = 0) {
    str = String(str).toUpperCase();
    const w = (str.length * 6 - 1) * s;
    let cx = Math.round(x - w * align);
    for (const ch of str) { const g = glyph(ch, col); ctx.drawImage(g, cx - s, Math.round(y) - s, g.width * s, g.height * s); cx += 6 * s; }
    return w;
  }

  /* ═════════ 배경 ═════════ */
  /** 이어 붙여도 이음매가 없는 잡음 (가로 · 세로 둘 다 감겨요) */
  function tnoise(seed, W, H, cell) {
    const R = rng(seed), gw = Math.max(1, Math.round(W / cell)), gh = Math.max(1, Math.round(H / cell)), v = new Float32Array(gw * gh);
    for (let i = 0; i < v.length; i++) v[i] = R();
    const sm = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = (x / W) * gw, fy = (y / H) * gh, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const at = (i, j) => v[((j % gh + gh) % gh) * gw + ((i % gw + gw) % gw)];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return a + (b - a) * ty;
    };
  }
  function fbm(seed, W, H, cells) { const ns = cells.map((c, i) => tnoise(seed + i * 101, W, H, c)); const wsum = cells.reduce((a, _, i) => a + 1 / (i + 1), 0); return (x, y) => ns.reduce((a, n, i) => a + n(x, y) / (i + 1), 0) / wsum; }
  /** 점점이 별 (가로 240 × 세로 h, 위아래 이어 붙여요) */
  function starTile(h, n, seed, cols, big) {
    const c = mk(240, h), x = c.getContext('2d'), R = rng(seed);
    for (let i = 0; i < n; i++) {
      const sx = Math.floor(R() * 240), sy = Math.floor(R() * h), col = cols[Math.floor(R() * cols.length)];
      x.fillStyle = col; x.fillRect(sx, sy, 1, 1);
      if (big && R() < 0.35) { x.globalAlpha = 0.55; x.fillRect(sx - 1, sy, 1, 1); x.fillRect(sx + 1, sy, 1, 1); x.fillRect(sx, sy - 1, 1, 1); x.fillRect(sx, sy + 1, 1, 1); x.globalAlpha = 1; }
    }
    return c;
  }
  /** 잡음 → 색 단계 (디더링) */
  function cloudTile(h, seed, cells, ramp, thr, opt = {}) {
    const c = mk(240, h), x = c.getContext('2d'), img = x.createImageData(240, h), f = fbm(seed, 240, h, cells);
    const cols = ramp.map(hex);
    for (let j = 0; j < h; j++) for (let i = 0; i < 240; i++) {
      let v = f(i, j);
      if (opt.warp) v = f(i + (f(j, i) - 0.5) * opt.warp, j);
      v = (v - thr) / (1 - thr);
      if (v <= 0) continue;
      const lv = v * (cols.length) + (bay(i, j) - 0.5) * 0.9, k = Math.floor(lv);
      if (k < 0) continue;
      const [r, g, b] = cols[Math.min(cols.length - 1, k)], o = (j * 240 + i) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  /** 정거장 철판 (가운데 큰 몸통 + 양옆 뼈대) */
  function stationTile(seed) {
    const h = 320, c = mk(240, h), x = c.getContext('2d'), R = rng(seed);
    const panel = (px, py, pw, ph) => {
      x.fillStyle = '#1f2436'; x.fillRect(px, py, pw, ph);
      x.fillStyle = '#2a3048'; x.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      x.fillStyle = '#343b58'; x.fillRect(px + 1, py + 1, pw - 2, 1); x.fillRect(px + 1, py + 1, 1, ph - 2);
      x.fillStyle = '#171b29'; x.fillRect(px + 1, py + ph - 2, pw - 2, 1);
      if (R() < 0.35) { x.fillStyle = '#4a5578'; x.fillRect(px + 3, py + 3, 1, 1); x.fillRect(px + pw - 4, py + 3, 1, 1); x.fillRect(px + 3, py + ph - 4, 1, 1); x.fillRect(px + pw - 4, py + ph - 4, 1, 1); }
      if (R() < 0.18) { x.fillStyle = '#121624'; for (let k = 0; k < 3; k++) x.fillRect(px + 4, py + 4 + k * 3, pw - 8, 1); }
      if (R() < 0.12) { x.fillStyle = R() < 0.5 ? '#ff6b78' : '#59d8ff'; x.fillRect(px + (pw >> 1), py + (ph >> 1), 2, 2); }
    };
    // 양옆 뼈대
    for (let y = 0; y < h; y += 16) for (const sx of [0, 212]) {
      x.fillStyle = '#151a28'; x.fillRect(sx + 4, y, 3, 16); x.fillRect(sx + 21, y, 3, 16);
      x.strokeStyle = '#1c2233'; x.beginPath(); x.moveTo(sx + 5, y); x.lineTo(sx + 22, y + 16); x.moveTo(sx + 22, y); x.lineTo(sx + 5, y + 16); x.stroke();
    }
    // 가운데 몸통 판
    for (let y = 0; y < h; y += 20) { let px = 34; while (px < 206) { const pw = Math.min(206 - px, 16 + Math.floor(R() * 4) * 8); panel(px, y, pw, 20); px += pw; } }
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(34, 0, 6, h); x.fillRect(200, 0, 6, h);
    // 빛줄
    for (let y = 8; y < h; y += 40) { x.fillStyle = '#ffd23f'; x.fillRect(36, y, 2, 2); x.fillRect(202, y + 20, 2, 2); }
    return c;
  }
  /** 붉은 땅 (구덩이 · 협곡) */
  function planetTile(seed) {
    const h = 480, base = cloudTile(h, seed, [96, 48, 24, 12], ['#2a0d12', '#3d1418', '#561c1c', '#6e2a1e', '#8a3a22'], 0.0);
    const x = base.getContext('2d'), R = rng(seed + 9);
    for (let i = 0; i < 18; i++) {
      const cx = R() * 240, cy = R() * h, r = 4 + R() * 14;
      for (const dy of [0, -h, h]) { x.fillStyle = '#1e080c'; x.beginPath(); x.ellipse(cx, cy + dy, r, r * 0.8, 0, 0, 7); x.fill(); x.fillStyle = '#4a1818'; x.beginPath(); x.ellipse(cx + r * 0.2, cy + dy + r * 0.15, r * 0.7, r * 0.55, 0, 0, 7); x.fill(); x.fillStyle = '#9a4a2a'; x.fillRect(cx - r * 0.7, cy + dy - r * 0.6, Math.max(1, r * 0.3), 1); }
    }
    return base;
  }
  /** 모선 내부 (관 · 빛나는 줄) */
  function motherTile(seed) {
    const h = 320, c = mk(240, h), x = c.getContext('2d'), R = rng(seed);
    x.fillStyle = '#120a1c'; x.fillRect(0, 0, 240, h);
    for (let i = 0; i < 10; i++) { const px = Math.floor(R() * 220), pw = 6 + Math.floor(R() * 10); x.fillStyle = '#1e1230'; x.fillRect(px, 0, pw, h); x.fillStyle = '#2a1a44'; x.fillRect(px, 0, 1, h); x.fillStyle = '#0c0614'; x.fillRect(px + pw - 1, 0, 1, h); }
    for (let y = 0; y < h; y += 32) { x.fillStyle = '#25163a'; x.fillRect(0, y, 240, 5); x.fillStyle = '#34205a'; x.fillRect(0, y, 240, 1); for (let k = 0; k < 240; k += 24) { x.fillStyle = '#4a2a7a'; x.fillRect(k + ((y / 32) % 2) * 12, y + 2, 3, 1); } }
    for (let i = 0; i < 4; i++) { const px = 20 + Math.floor(R() * 200); x.fillStyle = '#3a0e2a'; x.fillRect(px, 0, 3, h); x.fillStyle = '#ff3a8a'; for (let y = Math.floor(R() * 20); y < h; y += 20) x.fillRect(px + 1, y, 1, 6); }
    return c;
  }

  /* ═════════ 만들기 (한 번만) ═════════ */
  let S = null;
  function build() {
    if (S) return S;
    S = {};
    const o = c => outline(c);
    S.ship = sprite(o(pix(SHIP)));
    const flip = rows => rows.map(r => [...r].reverse().join(''));
    S.shipL = [sprite(o(pix(bank(SHIP, 2)))), sprite(o(pix(bank(SHIP, 4))))];
    S.shipR = [sprite(o(pix(flip(bank(SHIP, 2))))), sprite(o(pix(flip(bank(SHIP, 4)))))];
    S.flame = FLAME.map(f => pix(f));
    S.drone = sprite(o(pix(DRONE)));
    S.zako = dirs(o(pix(ZAKO))); S.swoop = dirs(o(pix(SWOOP))); S.kami = dirs(o(pix(KAMI)));
    S.pop = POP.map(f => sprite(o(pix(f))));
    S.mine = [sprite(o(pix(MINE))), sprite(o(pix(MINE.map(r => r.replace(/[rR]/g, 'W')))))];
    S.medal = MEDAL.map(f => o(pix(f))).concat(MEDAL.slice(0, 2).reverse().map(f => o(pix(f.map(r => [...r].reverse().join(''))))));
    S.gun = sprite(gunship()); S.carrier = sprite(carrier()); S.heavy = sprite(heavy());
    S.turretBase = sprite(turretBase());
    S.rock = [0, 1, 2].map(i => sprite(rockGfx(13, 30 + i))); S.pebble = [0, 1, 2].map(i => sprite(rockGfx(6.5, 60 + i)));
    S.bul = {}; for (const k in BUL) S.bul[k] = o(BUL[k]);
    S.needle = dirs(o(BUL.n), 16);
    S.shotV = SHOT_V; S.shotD = SHOT_D; S.missile = dirs(o(MISSILE), 16);
    S.items = {
      P: capsule('circle', '#ff8a3d', ICONS.P), B: capsule('circle', '#ff5d73', ICONS.B), S: capsule('shield', '#3fe0a0', ICONS.S), D: capsule('diamond', '#c39bff', ICONS.D),
      V: capsule('hex', '#ffd23f', ICONS.V), L: capsule('hex', '#59d8ff', ICONS.L), M: capsule('hex', '#ff6b5b', ICONS.M),
    };
    S.boss = {
      stinger: sprite(vec(62, 48, BODY.stinger, { pal: BPAL })), orb: sprite(vec(48, 48, BODY.orb, { pal: BPAL })),
      crab: sprite(vec(124, 76, BODY.crab, { pal: BPAL })), fortress: sprite(vec(104, 100, BODY.fortress, { pal: BPAL })),
      guard: sprite(vec(152, 60, BODY.guard, { pal: BPAL })), bomber: sprite(vec(136, 84, BODY.bomber, { pal: BPAL })),
      mother: sprite(vec(156, 114, BODY.mother, { pal: BPAL })),
    };
    S.part = {
      coreC: sprite(PART.core(false)), coreO: sprite(PART.core(true)), coreP: sprite(PART.core(true, '#a46cff', '#ecc6ff')),
      clawL: sprite(PART.claw(1)), clawR: sprite(PART.claw(-1)), turret: sprite(PART.turret()), emitter: sprite(PART.emitter()), wingGun: sprite(PART.wingGun()), pod: sprite(PART.pod()),
    };
    S.boom = { s: explosion(18, 3), m: explosion(34, 5), l: explosion(58, 7), b: explosion(26, 11) };
    S.smoke = [puff(6, ['#5a5466', '#3a3646']), puff(9, ['#5a5466', '#3a3646']), puff(12, ['#4a4456', '#2c2838'])];
    S.debris = DEBRIS.map(c => c);
    S.glow = { y: glow(6, '#ffd23f', 0.9), o: glow(6, '#ff4fa3', 0.8), c: glow(6, '#29c6ff', 0.8), w: glow(8, '#ffffff', 0.9), r: glow(10, '#ff6b2a', 0.85), p: glow(6, '#b77bff', 0.8), g: glow(8, '#7dffb0', 0.8), big: glow(16, '#ffb347', 0.9) };
    // 배경
    S.bg = {
      starsFar: starTile(320, 140, 1, ['#2b3358', '#3a4470', '#252c4a']), starsMid: starTile(320, 60, 2, ['#8b96c8', '#c8d0f0', '#6f7bb0']),
      starsNear: starTile(320, 22, 3, ['#ffffff', '#cfe8ff', '#fff2c8'], true),
      nebula: cloudTile(480, 11, [120, 60, 30, 15], ['#140d2e', '#1f1446', '#2d1a5e', '#3d2270', '#4f2a7a'], 0.38, { warp: 40 }),
      nebula2: cloudTile(480, 12, [80, 40, 20], ['#0b1c2e', '#103048', '#17435e'], 0.5),
      dust: cloudTile(480, 21, [96, 48, 24, 12], ['#1a120c', '#2a1c12', '#3a2818', '#4a3420'], 0.42, { warp: 30 }),
      station: stationTile(31), planet: planetTile(41), mother: motherTile(51),
      motherGlow: cloudTile(480, 52, [120, 60, 30], ['#2a0a24', '#3e1034', '#561a46'], 0.55),
    };
    S.bgRocks = [0, 1, 2, 3].map(i => rockGfx(5 + i * 3, 90 + i));
    return S;
  }

  return { build, text, glyph, rotate, outline, whiten, pix, vec, PAL, get S() { return build(); } };
})();
