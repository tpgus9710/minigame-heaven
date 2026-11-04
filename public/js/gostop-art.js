/* =====================================================================
 *  🎴 화투 그림 48장 — 전통 화투 무늬(송학 · 매조 · 벚꽃 · 흑싸리 · 난초 · 모란 · 홍싸리 · 공산 · 국화 · 단풍 · 오동 · 비)를
 *  SVG 로 직접 그렸어요. 카드마다 그림 한 장(data: 주소)을 만들어 CSS 배경으로 붙여요 → 화면에 카드가 많아도 가벼워요.
 *   HwatuArt.svg(id) — 카드 한 장 SVG 글자 · HwatuArt.init() — 처음 그릴 때 <style> 한 번 넣기 (class="hwa" data-art="카드 번호")
 *   HwatuArt.seotda(c) — 섯다 카드({ m, k: gwang · yeol · pi }) → 그림 번호
 *   그림판 100 × 160. 광(光) · 쌍피 표시와 달 숫자는 gostop.js · cards.js 가 HTML 로 위에 얹어요.
 * ===================================================================== */
const HwatuArt = (() => {
  const K = '#1c1a1a', R = '#d3352b', RD = '#9b1d1a', PK = '#f3a2bd', PL = '#fde4ec', G = '#2e7d32', GD = '#1d4d21', GL = '#8bc34a', Y = '#f6b90c', YD = '#c98200',
    B = '#2050c8', BL = '#8fb0ff', V = '#6a3d9e', VL = '#b48be0', BR = '#7b4a25', BL2 = '#a8703a', W = '#ffffff', CR = '#fbf6e9', SK = '#f3e7cf';
  const n = v => Math.round(v * 10) / 10;
  const P = (cx, cy, r, a) => [n(cx + Math.cos(a) * r), n(cy + Math.sin(a) * r)];
  const deg = d => d * Math.PI / 180;

  /* ─── 꽃 · 잎 그리기 ─── */
  /** 꽃잎 다섯 장 (매화 · 벚꽃) */
  function bloom(cx, cy, r, petal, mid, edge) {
    let s = '';
    for (let i = 0; i < 5; i++) { const [x, y] = P(cx, cy, r * 0.56, deg(-90 + i * 72)); s += `<circle cx="${x}" cy="${y}" r="${n(r * 0.52)}" fill="${petal}"${edge ? ` stroke="${edge}" stroke-width="0.8"` : ''}/>`; }
    return s + `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.3)}" fill="${mid}"/>`;
  }
  /** 솔잎 뭉치 (반원 부채) */
  function pine(cx, cy, r, rot = 0) {
    let s = `<path d="M${n(cx - r)} ${cy} A${r} ${r} 0 0 1 ${n(cx + r)} ${cy} Z" fill="${GD}"/>`;
    for (let i = 1; i < 10; i++) { const [x, y] = P(cx, cy, r * 0.94, deg(180 + i * 18)); s += `<path d="M${cx} ${cy} L${x} ${y}" stroke="${GL}" stroke-width="1.1"/>`; }
    s += `<path d="M${n(cx - r)} ${cy} H${n(cx + r)}" stroke="${K}" stroke-width="1.6"/>`;
    return `<g transform="rotate(${rot} ${cx} ${cy})">${s}</g>`;
  }
  /** 단풍잎 */
  function maple(cx, cy, r, rot = 0, fill = R) {
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = deg(-90 + i * (360 / 14)), lobe = i % 2 === 0 ? (i === 0 ? 1 : i === 6 || i === 8 ? 0.62 : 0.9) : 0.42;
      pts.push(P(cx, cy, r * lobe, a).join(' '));
    }
    return `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${pts.join(' L')} Z" fill="${fill}" stroke="${RD}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M${cx} ${n(cy + r * 0.2)} L${cx} ${n(cy + r * 1.05)}" stroke="${RD}" stroke-width="1.4"/><path d="M${cx} ${cy} L${cx} ${n(cy - r * 0.8)} M${cx} ${cy} L${P(cx, cy, r * 0.75, deg(-30)).join(' ')} M${cx} ${cy} L${P(cx, cy, r * 0.75, deg(-150)).join(' ')}" stroke="${RD}" stroke-width="0.7"/></g>`;
  }
  /** 국화 (둥근 꽃잎 여럿) */
  function mum(cx, cy, r, petal = Y, mid = R) {
    let s = '';
    for (let i = 0; i < 16; i++) { const a = i * 22.5; s += `<ellipse cx="${cx}" cy="${n(cy - r * 0.55)}" rx="${n(r * 0.17)}" ry="${n(r * 0.5)}" fill="${petal}" stroke="${YD}" stroke-width="0.6" transform="rotate(${a} ${cx} ${cy})"/>`; }
    for (let i = 0; i < 12; i++) { const a = i * 30 + 15; s += `<ellipse cx="${cx}" cy="${n(cy - r * 0.32)}" rx="${n(r * 0.12)}" ry="${n(r * 0.3)}" fill="${mid}" transform="rotate(${a} ${cx} ${cy})"/>`; }
    return s + `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.18)}" fill="${Y}" stroke="${YD}" stroke-width="0.6"/>`;
  }
  /** 모란 (겹꽃) */
  function peony(cx, cy, r) {
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${R}"/>`;
    for (let i = 0; i < 7; i++) { const [x, y] = P(cx, cy, r * 0.62, deg(i * 51.4 - 90)); s += `<circle cx="${x}" cy="${y}" r="${n(r * 0.42)}" fill="${R}" stroke="${PL}" stroke-width="1"/>`; }
    s += `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.55)}" fill="${PK}" stroke="${RD}" stroke-width="0.8"/>`;
    for (let i = 0; i < 5; i++) { const [x, y] = P(cx, cy, r * 0.28, deg(i * 72 - 90)); s += `<circle cx="${x}" cy="${y}" r="${n(r * 0.2)}" fill="${R}"/>`; }
    return s + `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.14)}" fill="${Y}"/>`;
  }
  /** 모란 잎 (세 갈래) */
  function pLeaf(cx, cy, r, rot) {
    return `<g transform="rotate(${rot} ${cx} ${cy})" fill="${GD}"><path d="M${cx} ${cy} q ${n(-r * 0.7)} ${n(-r * 0.4)} ${n(-r * 0.9)} ${n(-r * 1.2)} q ${n(r * 0.6)} ${n(r * 0.1)} ${n(r * 0.9)} ${n(r * 1.2)} z"/>
      <path d="M${cx} ${cy} q 0 ${n(-r * 0.8)} ${n(r * 0.1)} ${n(-r * 1.5)} q ${n(r * 0.4)} ${n(r * 0.6)} ${n(-r * 0.1)} ${n(r * 1.5)} z"/><path d="M${cx} ${cy} q ${n(r * 0.7)} ${n(-r * 0.4)} ${n(r * 0.9)} ${n(-r * 1.2)} q ${n(-r * 0.6)} ${n(r * 0.1)} ${n(-r * 0.9)} ${n(r * 1.2)} z"/></g>`;
  }
  /** 붓꽃 (난초) */
  function iris(cx, cy, r) {
    return `<g><path d="M${cx} ${cy} c ${n(-r * 1.1)} ${n(r * 0.1)} ${n(-r * 1.2)} ${n(r * 0.9)} ${n(-r * 0.6)} ${n(r * 1.1)} c ${n(r * 0.3)} ${n(-r * 0.4)} ${n(r * 0.5)} ${n(-r * 0.7)} ${n(r * 0.6)} ${n(-r * 1.1)} z" fill="${V}"/>
      <path d="M${cx} ${cy} c ${n(r * 1.1)} ${n(r * 0.1)} ${n(r * 1.2)} ${n(r * 0.9)} ${n(r * 0.6)} ${n(r * 1.1)} c ${n(-r * 0.3)} ${n(-r * 0.4)} ${n(-r * 0.5)} ${n(-r * 0.7)} ${n(-r * 0.6)} ${n(-r * 1.1)} z" fill="${V}"/>
      <path d="M${cx} ${n(cy + r * 0.2)} c ${n(-r * 0.45)} ${n(-r * 0.7)} ${n(-r * 0.3)} ${n(-r * 1.4)} 0 ${n(-r * 1.6)} c ${n(r * 0.3)} ${n(r * 0.2)} ${n(r * 0.45)} ${n(r * 0.9)} 0 ${n(r * 1.6)} z" fill="${VL}" stroke="${V}" stroke-width="0.8"/>
      <circle cx="${cx}" cy="${n(cy + r * 0.25)}" r="${n(r * 0.18)}" fill="${Y}"/></g>`;
  }
  const blade = (x0, y0, x1, y1, c, w = 5) => `<path d="M${x0 - w / 2} ${y0} Q ${n((x0 + x1) / 2 - w)} ${n((y0 + y1) / 2)} ${x1} ${y1} Q ${n((x0 + x1) / 2 + w)} ${n((y0 + y1) / 2)} ${x0 + w / 2} ${y0} Z" fill="${c}"/>`;
  /** 오동잎 */
  function pauLeaf(cx, cy, r, rot = 0, fill = K) {
    return `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${cx} ${n(cy + r * 0.9)} C ${n(cx - r * 1.3)} ${n(cy + r * 0.3)} ${n(cx - r * 1.1)} ${n(cy - r * 1)} ${cx} ${n(cy - r * 0.55)} C ${n(cx + r * 1.1)} ${n(cy - r * 1)} ${n(cx + r * 1.3)} ${n(cy + r * 0.3)} ${cx} ${n(cy + r * 0.9)} Z" fill="${fill}"/>
      <path d="M${cx} ${n(cy + r * 0.9)} V${n(cy - r * 0.45)} M${cx} ${n(cy + r * 0.3)} L${n(cx - r * 0.6)} ${n(cy - r * 0.2)} M${cx} ${n(cy + r * 0.3)} L${n(cx + r * 0.6)} ${n(cy - r * 0.2)}" stroke="${GL}" stroke-width="1"/></g>`;
  }
  /** 오동꽃 (꽃대에 보라 꽃) */
  function pauFlower(x, y0, y1) {
    let s = `<path d="M${x} ${y1} V${y0}" stroke="${BR}" stroke-width="2.2"/>`;
    for (let y = y0 + 4, i = 0; y < y1 - 6; y += 7, i++) s += `<circle cx="${n(x + (i % 2 ? 4 : -4))}" cy="${y}" r="3.6" fill="${VL}" stroke="${V}" stroke-width="0.8"/>`;
    return s + `<circle cx="${x}" cy="${y0}" r="3.2" fill="${VL}" stroke="${V}" stroke-width="0.8"/>`;
  }
  /** 싸리 (늘어진 줄기에 작은 잎) */
  function frond(x0, y0, x1, y1, bend, leaf, dot) {
    const mx = n((x0 + x1) / 2 + bend), my = n((y0 + y1) / 2);
    let s = `<path d="M${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}" stroke="${K}" stroke-width="1.6" fill="none"/>`;
    for (let t = 0.12; t < 1; t += 0.13) {
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
      s += `<ellipse cx="${n(x - 3.8)}" cy="${n(y)}" rx="4.2" ry="2.3" fill="${leaf}" transform="rotate(-30 ${n(x - 3.8)} ${n(y)})"/><ellipse cx="${n(x + 3.8)}" cy="${n(y)}" rx="4.2" ry="2.3" fill="${leaf}" transform="rotate(30 ${n(x + 3.8)} ${n(y)})"/>`;
      if (dot && t > 0.5) s += `<circle cx="${n(x)}" cy="${n(y + 2.5)}" r="1.6" fill="${dot}"/>`;
    }
    return s;
  }
  /** 버들가지 */
  function willow(x0, y0, len, bend, c = G) {
    let s = `<path d="M${x0} ${y0} q ${bend} ${n(len * 0.5)} ${n(bend * 0.4)} ${len}" stroke="${c}" stroke-width="1.5" fill="none"/>`;
    for (let i = 1; i < 6; i++) { const y = y0 + len * i / 6, x = x0 + bend * Math.sin(i / 6 * Math.PI) * 0.9; s += `<ellipse cx="${n(x + 2)}" cy="${n(y)}" rx="1.4" ry="3.6" fill="${c}" transform="rotate(-20 ${n(x + 2)} ${n(y)})"/>`; }
    return s;
  }
  /** 띠 (홍단 · 청단 · 초단 · 비띠) — 가운데를 비스듬히 가로질러요 */
  function ribbon(color, text, rot = -16, cx = 52, cy = 86) {
    const t = text ? `<text x="${cx}" y="${cy - 14}" fill="${W}" font-family="Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif" font-weight="900" font-size="13" text-anchor="middle" writing-mode="tb" glyph-orientation-vertical="0" letter-spacing="2">${text}</text>` : '';
    return `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${cx - 12} ${cy - 46} H${cx + 12} V${cy + 40} L${cx} ${cy + 46} L${cx - 12} ${cy + 40} Z" fill="${color}" stroke="${K}" stroke-width="1.2"/>
      <path d="M${cx - 12} ${cy - 40} H${cx + 12}" stroke="${K}" stroke-width="1" opacity=".5"/>${t}</g>`;
  }
  const sky = (c, d) => `<path d="${d}" fill="${c}"/>`;

  /* ─── 동물 · 물건 ─── */
  const crane = () => `<g><path d="M44 112 q -12 6 -16 16 q 12 -3 20 -10 z" fill="${K}"/><ellipse cx="62" cy="108" rx="21" ry="13" fill="${W}" stroke="${K}" stroke-width="1.6" transform="rotate(-18 62 108)"/>
    <path d="M48 104 q 12 -10 26 -6" stroke="${K}" stroke-width="1" fill="none"/><path d="M75 100 C 84 88, 77 76, 84 64" stroke="${K}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="85" cy="62" r="5" fill="${W}" stroke="${K}" stroke-width="1.2"/><circle cx="86" cy="58.5" r="2.4" fill="${R}"/><circle cx="87.4" cy="62" r="0.9" fill="${K}"/>
    <path d="M89 62 l 9 3 l -9 1 z" fill="${YD}"/><path d="M60 120 L56 146 M67 120 L69 146" stroke="${K}" stroke-width="1.6"/><path d="M52 146 h8 M65 146 h8" stroke="${K}" stroke-width="1.4"/></g>`;
  const warbler = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-14 4 l -10 6 l 4 -9 z" fill="#5f7d23"/><ellipse cx="0" cy="0" rx="13" ry="8" fill="#9bbd3c" stroke="#4c6a12" stroke-width="1"/>
    <circle cx="11" cy="-6" r="6" fill="#9bbd3c" stroke="#4c6a12" stroke-width="1"/><circle cx="13" cy="-7" r="1.2" fill="${K}"/><path d="M16.5 -6 l 5 1.5 l -5 1.5 z" fill="${K}"/>
    <path d="M-6 -2 q 6 -6 14 -2" stroke="#4c6a12" stroke-width="1" fill="none"/><path d="M-2 8 l -1 5 M3 8 l 1 5" stroke="${K}" stroke-width="1.2"/></g>`;
  const cuckoo = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-4 0 C -18 -16, -30 -14, -38 -8 C -26 -6, -16 -2, -4 4 Z" fill="#4a4a52" stroke="${K}" stroke-width="1"/>
    <path d="M2 0 C 14 -18, 26 -18, 34 -12 C 22 -8, 14 -2, 4 4 Z" fill="#4a4a52" stroke="${K}" stroke-width="1"/><ellipse cx="0" cy="3" rx="12" ry="5.5" fill="#61616b" stroke="${K}" stroke-width="1"/>
    <circle cx="12" cy="0" r="4.2" fill="#61616b" stroke="${K}" stroke-width="1"/><circle cx="13.5" cy="-0.6" r="1" fill="${R}"/><path d="M16 0 l 5 1 l -5 1.5 z" fill="${Y}"/><path d="M-12 4 l -9 5 l 9 -1 z" fill="${K}"/></g>`;
  const moon = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff6d6" stroke="#e8d08a" stroke-width="1.2"/>`;
  const crescent = (x, y, r) => `<path d="M${x} ${y - r} A${r} ${r} 0 1 0 ${x} ${y + r} A${n(r * 0.72)} ${r} 0 1 1 ${x} ${y - r} Z" fill="${Y}"/>`;
  const bridge = () => `<g stroke="${K}" stroke-width="1.2"><path d="M4 120 L38 106 L44 116 L10 130 Z" fill="${BL2}"/><path d="M38 106 L76 118 L72 128 L44 116 Z" fill="#c8894b"/>
    <path d="M76 118 L98 108 L100 118 L72 128 Z" fill="${BL2}"/><path d="M14 128 v14 M40 116 v14 M70 127 v14 M94 116 v14" stroke-width="2"/></g>`;
  const butterfly = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C -8 -14, -22 -14, -20 -2 C -19 6, -8 6, 0 2 Z" fill="${c1}" stroke="${K}" stroke-width="1"/>
    <path d="M0 0 C 8 -14, 22 -14, 20 -2 C 19 6, 8 6, 0 2 Z" fill="${c1}" stroke="${K}" stroke-width="1"/><path d="M0 2 C -6 6, -14 14, -8 16 C -3 16, -1 10, 0 4 Z M0 2 C 6 6, 14 14, 8 16 C 3 16, 1 10, 0 4 Z" fill="${c2}" stroke="${K}" stroke-width="1"/>
    <circle cx="-11" cy="-5" r="2.4" fill="${K}"/><circle cx="11" cy="-5" r="2.4" fill="${K}"/><path d="M0 -4 V12" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/><path d="M0 -4 l -4 -7 M0 -4 l 4 -7" stroke="${K}" stroke-width="0.9"/></g>`;
  const boar = () => `<g><ellipse cx="50" cy="104" rx="30" ry="16" fill="${BR}" stroke="${K}" stroke-width="1.6"/><path d="M24 98 q -6 -6 -12 -2 q 4 4 10 8 z" fill="${BR}" stroke="${K}" stroke-width="1.2"/>
    <path d="M70 92 C 84 90, 94 98, 96 108 C 90 112, 80 112, 72 112 Z" fill="${BR}" stroke="${K}" stroke-width="1.6"/><circle cx="84" cy="98" r="1.6" fill="${K}"/><path d="M92 108 q 4 -2 2 -8" stroke="${W}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M70 92 l 4 -8 l 4 7" fill="${BR}" stroke="${K}" stroke-width="1.2"/><path d="M30 92 q 20 -10 40 0" stroke="${K}" stroke-width="1.2" fill="none"/>
    <path d="M32 116 l -8 16 M44 119 l -2 16 M60 119 l 6 15 M70 114 l 12 12" stroke="${K}" stroke-width="3.4" stroke-linecap="round"/></g>`;
  const goose = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${K}"><path d="M-16 -6 Q -6 -2 0 2 Q -8 4 -18 2 Z"/><path d="M16 -8 Q 6 -2 0 2 Q 8 4 18 0 Z"/><ellipse cx="0" cy="3" rx="9" ry="3"/><path d="M8 2 q 5 -3 8 -1 l -2 2 z"/></g>`;
  const cup = () => `<g><path d="M18 96 H82 C 80 112, 66 120, 50 120 C 34 120, 20 112, 18 96 Z" fill="${R}" stroke="${K}" stroke-width="1.6"/><path d="M18 96 H82" stroke="${Y}" stroke-width="3"/>
    <path d="M40 120 H60 L64 132 H36 Z" fill="${R}" stroke="${K}" stroke-width="1.4"/><path d="M30 132 H70" stroke="${K}" stroke-width="2"/>${bloom(50, 107, 7, Y, R)}</g>`;
  const deer = () => `<g stroke="${K}" stroke-width="1.4"><ellipse cx="50" cy="104" rx="24" ry="12" fill="${BL2}"/><circle cx="40" cy="100" r="2" fill="${W}" stroke="none"/><circle cx="52" cy="98" r="2" fill="${W}" stroke="none"/><circle cx="58" cy="106" r="2" fill="${W}" stroke="none"/>
    <path d="M70 98 C 76 88, 78 80, 74 72" stroke-width="7" stroke="${BL2}" fill="none"/><path d="M70 98 C 76 88, 78 80, 74 72" fill="none"/><ellipse cx="70" cy="70" rx="8" ry="5.5" fill="${BL2}" transform="rotate(25 70 70)"/>
    <circle cx="68" cy="68" r="1.2" fill="${K}"/><path d="M74 64 l 4 -10 l 4 2 M76 60 l -6 -6 M72 64 l -2 -12 l -4 -1" fill="none"/>
    <path d="M32 112 l -4 24 M42 115 l 0 22 M60 115 l 2 22 M68 110 l 6 24" stroke-width="3" stroke-linecap="round"/><path d="M26 100 l -6 -4" stroke-width="3" stroke-linecap="round"/></g>`;
  const swallow = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-2 0 C -14 -20, -30 -26, -40 -24 C -28 -14, -18 -4, -6 6 Z" fill="${K}"/><path d="M2 0 C 12 -16, 26 -22, 38 -22 C 26 -10, 16 -2, 6 6 Z" fill="${K}"/>
    <ellipse cx="0" cy="4" rx="11" ry="5" fill="${K}"/><circle cx="10" cy="1" r="4.4" fill="${K}"/><circle cx="11.5" cy="3.5" r="2.6" fill="${R}"/><circle cx="11" cy="0" r="0.9" fill="${W}"/>
    <path d="M-10 6 L -24 20 L -14 6 L -18 22 L -6 8 Z" fill="${K}"/><path d="M-6 6 q 6 2 12 0" stroke="${W}" stroke-width="1.2" fill="none"/></g>`;
  const phoenix = () => `<g stroke="${K}" stroke-width="1.2">
    <path d="M50 120 C 20 116, 6 92, 12 70 C 22 86, 34 96, 50 100 Z" fill="${G}"/><path d="M50 120 C 80 116, 94 92, 88 70 C 78 86, 66 96, 50 100 Z" fill="${B}"/>
    <path d="M50 118 C 30 110, 22 88, 30 70 C 36 86, 42 94, 50 98 Z" fill="${Y}"/><path d="M50 118 C 70 110, 78 88, 70 70 C 64 86, 58 94, 50 98 Z" fill="${R}"/>
    <path d="M50 122 C 44 108, 44 86, 50 70 C 56 86, 56 108, 50 122 Z" fill="${V}"/>
    <path d="M50 74 C 46 62, 48 50, 56 44" stroke-width="7" stroke="${R}" fill="none" stroke-linecap="round"/><path d="M50 74 C 46 62, 48 50, 56 44" fill="none"/>
    <circle cx="58" cy="42" r="7" fill="${R}"/><circle cx="60" cy="40" r="1.6" fill="${W}" stroke="none"/><path d="M64 44 l 9 2 l -8 3 z" fill="${Y}"/>
    <path d="M54 36 q -4 -10 4 -14 q 0 8 4 12 M58 35 q 2 -10 10 -10 q -3 7 -4 12" fill="${Y}"/><path d="M56 49 q 2 6 -2 10" fill="none" stroke="${Y}" stroke-width="2"/></g>`;
  const umbrellaMan = () => `<g stroke="${K}" stroke-width="1.3">
    <path d="M8 58 Q 30 30 56 40 L 50 46 Q 30 44 14 64 Z" fill="${V}"/><path d="M32 42 L 44 92" stroke-width="2"/>
    <path d="M34 104 C 30 86, 38 72, 48 70 C 58 72, 64 86, 62 104 C 64 118, 56 128, 48 128 C 38 128, 32 118, 34 104 Z" fill="${Y}"/>
    <path d="M38 88 C 44 92, 52 92, 58 88 L 60 100 C 52 104, 44 104, 36 100 Z" fill="${R}"/><circle cx="50" cy="64" r="7" fill="#f6d7b5"/><path d="M43 60 q 7 -8 14 0 z" fill="${K}"/>
    <path d="M42 128 l -4 10 M54 128 l 4 10" stroke-width="2.4"/>
    <g transform="translate(14 128)"><ellipse cx="0" cy="0" rx="8" ry="5" fill="#5fa83a"/><circle cx="4" cy="-4" r="2.2" fill="#5fa83a"/><circle cx="4.6" cy="-4.4" r="0.8" fill="${K}"/><path d="M-6 3 l -6 4 M5 4 l 4 5" stroke-width="1.6"/></g></g>`;
  const thunder = () => `<g><rect x="0" y="0" width="100" height="92" fill="${K}"/><path d="M0 92 Q 50 82 100 92 V100 H0 Z" fill="${K}"/>
    <path d="M58 6 L 40 40 L 54 42 L 34 82 L 70 34 L 56 32 L 72 6 Z" fill="${R}" stroke="${Y}" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="20" cy="26" r="9" fill="${V}" stroke="${VL}" stroke-width="1.5"/><circle cx="82" cy="58" r="9" fill="${V}" stroke="${VL}" stroke-width="1.5"/>
    <path d="M14 26 a6 6 0 0 1 12 0 M76 58 a6 6 0 0 1 12 0" stroke="${Y}" stroke-width="1.5" fill="none"/></g>`;
  const curtain = () => {
    let s = `<rect x="4" y="88" width="92" height="12" fill="${V}" stroke="${K}" stroke-width="1"/>`;
    for (let x = 12; x < 96; x += 16) s += `<circle cx="${x}" cy="94" r="3" fill="${W}"/>`;
    s += `<path d="M6 100 H94 V140 Q 82 150 72 140 Q 61 150 50 140 Q 39 150 28 140 Q 17 150 6 140 Z" fill="${W}" stroke="${K}" stroke-width="1.2"/>`;
    for (let x = 10; x < 92; x += 14) s += `<rect x="${x}" y="100" width="7" height="40" fill="${R}"/>`;
    return s + `<path d="M6 100 H94" stroke="${K}" stroke-width="1.2"/><path d="M4 88 Q 50 80 96 88" stroke="${K}" stroke-width="1.6" fill="none"/><circle cx="4" cy="88" r="2.4" fill="${Y}"/><circle cx="96" cy="88" r="2.4" fill="${Y}"/>`;
  };

  /* ─── 달마다 바탕 그림 (v: 0 · 1 · 2 · 3 = 같은 달 네 장, 피는 살짝 다르게) ─── */
  const PLANT = {
    1: (k, big) => `${sky(R, 'M0 132 Q 16 120 34 128 T 70 124 T 100 126 V160 H0 Z')}
      <path d="M6 160 C 18 126, 16 104, 36 90 S 66 62, 86 44" stroke="${K}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M34 92 C 48 98, 62 100, 80 96" stroke="${K}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      ${big ? pine(22, 122, 15, -10) + pine(46, 132, 12, 8) : pine(60, 46, 19, -12) + pine(84, 66, 14, 10) + pine(30, 70, 14, -18) + pine(74, 98, 15, 6) + pine(20, 108, 13, -8)}`,
    2: (k, big) => `${sky(R, k === 3 ? 'M0 0 H100 V22 Q 76 32 52 22 T 0 26 Z' : 'M0 134 Q 26 124 50 132 T 100 128 V160 H0 Z')}
      <path d="M12 156 L 30 116 L 22 86 L 46 56 L 42 30 M30 116 L 60 104 L 80 80 M46 56 L 72 50 L 90 32" stroke="${K}" stroke-width="4.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      ${[[42, 30], [72, 50], [90, 32], [60, 104], [80, 80], [22, 86], [34, 64], [56, 54], [26, 112]].filter((p, i) => !big || i < 5).map(([x, y], i) => bloom(x, y, i % 3 ? 7 : 8.5, R, i % 2 ? Y : W, RD)).join('')}`,
    3: (k, big) => `${sky(R, 'M0 0 H100 V48 Q 84 60 66 50 T 30 54 T 0 46 Z')}
      ${[[16, 22], [36, 14], [58, 20], [80, 14], [26, 42], [48, 38], [70, 40], [90, 36], [14, 62], [38, 60], [62, 64], [84, 60]].concat(big ? [] : [[24, 84], [50, 86], [76, 84], [36, 104], [64, 106]])
        .map(([x, y], i) => bloom(x, y, i % 2 ? 9 : 10.5, PL, R, PK)).join('')}`,
    4: (k, big) => `${sky(R, 'M0 138 Q 30 128 60 136 T 100 134 V160 H0 Z')}
      ${frond(18, 0, 10, big ? 80 : 120, 14, K, R)}${frond(40, 0, 36, big ? 70 : 110, -10, K, R)}${frond(64, 0, 62, big ? 64 : 100, 12, K, R)}${frond(88, 0, 92, big ? 76 : 118, -14, K, R)}`,
    5: (k, big) => `${big ? '' : sky(R, 'M0 146 Q 50 136 100 146 V160 H0 Z')}
      ${blade(20, 160, 6, 60, G)}${blade(30, 160, 34, 40, GD)}${blade(44, 160, 58, 54, G)}${blade(60, 160, 86, 64, GD)}${blade(74, 160, 94, 92, G)}${blade(14, 160, 2, 104, GD)}
      ${iris(24, 50, 12)}${iris(66, 40, 13)}${big ? '' : iris(46, 86, 12)}`,
    6: (k, big) => `${pLeaf(22, 120, 22, -30)}${pLeaf(78, 124, 22, 30)}${pLeaf(50, 132, 20, 0)}
      ${big ? peony(30, 74, 16) + peony(72, 82, 14) : peony(34, 66, 20) + peony(70, 92, 17) + peony(24, 110, 12)}`,
    7: (k, big) => `${sky(R, k === 3 ? 'M0 0 H100 V18 Q 50 30 0 18 Z' : 'M0 140 Q 40 128 100 140 V160 H0 Z')}
      ${frond(6, 160, 70, 8, -30, R)}${frond(30, 160, 96, 30, -18, RD)}${big ? '' : frond(60, 160, 100, 70, 6, R)}${frond(2, 120, 46, 2, -6, RD)}`,
    8: (k, big) => `<rect x="0" y="0" width="100" height="160" fill="${R}"/>
      <path d="M0 160 V100 C 18 76, 46 74, 64 90 C 76 80, 92 82, 100 92 V160 Z" fill="${K}"/>
      ${[[10, 160, 16, 98], [22, 160, 30, 90], [36, 160, 44, 86], [50, 160, 58, 90], [64, 160, 70, 92], [78, 160, 84, 90], [90, 160, 96, 96]].map(([a, b, c, d]) => `<path d="M${a} ${b} Q ${(a + c) / 2 - 6} ${(b + d) / 2} ${c} ${d}" stroke="${W}" stroke-width="1.3" fill="none" opacity=".85"/>`).join('')}`,
    9: (k, big) => `${sky(R, 'M0 140 Q 30 132 60 140 T 100 138 V160 H0 Z')}
      <path d="M30 160 C 32 130, 26 110, 30 80 M56 160 C 56 128, 62 104, 60 70 M78 160 C 78 136, 82 120, 80 100" stroke="${GD}" stroke-width="2.4" fill="none"/>
      ${pLeaf(30, 130, 12, -40)}${pLeaf(60, 124, 12, 30)}${big ? mum(30, 70, 14) + mum(64, 64, 15) : mum(28, 62, 17) + mum(62, 44, 18) + mum(78, 96, 13) + mum(36, 104, 12, R, Y)}`,
    10: (k, big) => `${sky(R, k === 3 ? 'M0 0 H100 V20 Q 50 32 0 20 Z' : 'M0 144 Q 50 132 100 144 V160 H0 Z')}
      <path d="M2 30 C 30 40, 60 30, 98 52 M40 36 C 46 60, 60 70, 80 76 M20 34 C 18 60, 24 80, 16 100" stroke="${K}" stroke-width="2.6" fill="none"/>
      ${[[14, 22, 13, -10], [44, 20, 12, 15], [72, 34, 14, -20], [92, 56, 11, 25], [30, 58, 12, 30], [60, 62, 13, -15], [84, 82, 12, 10], [16, 98, 12, -25]].concat(big ? [] : [[44, 96, 13, 20], [70, 112, 12, -10], [28, 128, 11, 15]])
        .map(([x, y, r, a]) => maple(x, y, r, a)).join('')}`,
    11: (k, big) => `${sky(k === 1 ? R : Y, 'M0 112 Q 50 100 100 112 V160 H0 Z')}
      ${big ? pauLeaf(20, 132, 18, -20) + pauLeaf(80, 134, 18, 20) : pauLeaf(24, 118, 22, -24) + pauLeaf(76, 120, 22, 24) + pauLeaf(50, 134, 20, 0) + pauFlower(30, 26, 92) + pauFlower(52, 16, 98) + pauFlower(72, 30, 94)}`,
    12: (k, big) => `${sky(B, 'M0 142 Q 25 134 50 142 T 100 140 V160 H0 Z')}<path d="M0 148 Q 25 142 50 148 T 100 146" stroke="${BL}" stroke-width="1.5" fill="none"/>
      ${willow(78, 0, 86, -10)}${willow(90, 0, 110, -8)}${willow(66, 0, 64, -12)}${big ? '' : willow(10, 0, 96, 10) + willow(24, 0, 74, 8)}`,
  };
  /** 카드 한 장의 그림 (광 · 열끗 · 띠는 그 위에 얹어요) */
  function body(c) {
    const m = c.m, k = c.k;
    const mirror = k === 3 && m !== 8 && m !== 12 && m !== 11;     // 같은 달 두 번째 피는 좌우를 뒤집어 살짝 다르게
    let plant = PLANT[m](k, false), top = '';
    if (m === 1 && c.kind === 'gw') { plant = PLANT[1](k, true); top = `<circle cx="34" cy="44" r="25" fill="${R}"/>${crane()}`; }
    if (m === 2 && c.kind === 'yl') top = warbler(58, 92);
    if (m === 3 && c.kind === 'gw') { plant = PLANT[3](k, true); top = curtain(); }
    if (m === 4 && c.kind === 'yl') { plant = PLANT[4](k, true); top = crescent(80, 24, 12) + cuckoo(52, 96); }
    if (m === 5 && c.kind === 'yl') { plant = PLANT[5](k, true); top = bridge(); }
    if (m === 6 && c.kind === 'yl') { plant = PLANT[6](k, true); top = butterfly(30, 34, 1.15, BL, Y) + butterfly(72, 50, 0.9, Y, BL); }
    if (m === 7 && c.kind === 'yl') { plant = PLANT[7](k, true); top = boar(); }
    if (m === 8 && c.kind === 'gw') top = moon(50, 46, 30);
    if (m === 8 && c.kind === 'yl') top = goose(28, 30, 1.1) + goose(58, 46, 1) + goose(82, 24, 0.9);
    if (m === 9 && c.kind === 'yl') { plant = PLANT[9](k, true); top = cup(); }
    if (m === 10 && c.kind === 'yl') { plant = PLANT[10](k, true); top = deer(); }
    if (m === 11 && c.kind === 'gw') { plant = PLANT[11](k, true); top = phoenix(); }
    if (m === 12 && c.kind === 'gw') { plant = PLANT[12](k, true); top = umbrellaMan(); }
    if (m === 12 && c.kind === 'yl') { plant = PLANT[12](k, true); top = swallow(46, 84); }
    if (m === 12 && c.kind === 'pi') { plant = PLANT[12](k, true); top = thunder(); }
    if (c.kind === 'tt') top = ribbon(c.dan === 'cheong' ? B : R, c.dan === 'hong' ? '홍단' : c.dan === 'cheong' ? '청단' : '');
    const art = `${plant}${top}`;
    return mirror ? `<g transform="translate(100 0) scale(-1 1)">${art}</g>` : art;
  }
  function svg(id) {
    const c = typeof GostopCore !== 'undefined' && GostopCore.CARDS[id];
    if (!c || !c.m) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160"><rect width="100" height="160" fill="${CR}"/>${body(c)}</svg>`;
  }
  let done = false;
  function init() {
    if (done || typeof GostopCore === 'undefined') return;
    done = true;
    let css = '';
    for (let id = 0; id < 48; id++) css += `.hwa.hwa[data-art="${id}"]{background-image:url("data:image/svg+xml,${encodeURIComponent(svg(id))}")}\n`;
    const st = document.createElement('style'); st.id = 'hw-art'; st.textContent = css; document.head.append(st);
  }
  /** 섯다 카드 → 그림 번호 (광 · 열끗은 그 달의 그림, 나머지는 그 달의 피) */
  const seotda = c => (c.k === 'gwang' ? { 1: 0, 3: 8, 8: 28 }[c.m] : c.k === 'yeol' ? { 4: 12, 7: 24, 9: 32 }[c.m] : undefined) ?? (c.m - 1) * 4 + 2;
  return { svg, init, seotda };
})();
if (typeof module === 'object' && module.exports) module.exports = HwatuArt;
