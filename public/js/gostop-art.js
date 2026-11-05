/* =====================================================================
 *  🎴 화투 그림 48장 (고스톱 · 섯다) — 한국 화투 그대로 (빨간 테두리 · 光 표시 · 홍단 · 청단 글씨)
 *   그림: Wikimedia Commons «SVG Hwatu» (Spenĉjo · 디자인 Marcus Richert · 일부 Louie Mantia, Jr.), CC BY-SA 4.0
 *         → public/vendor/hwatu-1/NOTICE.txt. 파일 이름 = 카드 번호((달 - 1) × 4 + 순서). 그림을 바꾸면 폴더를 hwatu-2 로 (1년 캐시).
 *   HwatuArt.init()      — 처음 그릴 때 <style> 한 번 넣기 (class="hwa" data-art="카드 번호" → 그 그림이 배경)
 *   HwatuArt.preload()   — 판을 시작할 때 48장을 미리 받아 둬요 (나눠 줄 때 빈 카드가 안 보이게)
 *   HwatuArt.seotda(c)   — 섯다 카드({ m, k: gwang · yeol · pi }) → 그림 번호
 * ===================================================================== */
const HwatuArt = (() => {
  const BASE = '/vendor/hwatu-1/';
  let done = false, loaded = false;
  const url = id => `${BASE}${id}.svg`;
  function init() {
    if (done) return;
    done = true;
    let css = '';
    for (let id = 0; id < 48; id++) css += `.hwa.hwa[data-art="${id}"]{background-image:url("${url(id)}")}\n`;
    const st = document.createElement('style'); st.id = 'hw-art'; st.textContent = css; document.head.append(st);
  }
  function preload() {
    init();
    if (loaded) return;
    loaded = true;
    for (let id = 0; id < 48; id++) { const im = new Image(); im.decoding = 'async'; im.src = url(id); }
  }
  /** 섯다 카드 → 그림 번호 (광 · 열끗은 그 달의 그림, 나머지는 그 달의 피) */
  const seotda = c => (c.k === 'gwang' ? { 1: 0, 3: 8, 8: 28 }[c.m] : c.k === 'yeol' ? { 4: 12, 7: 24, 9: 32 }[c.m] : undefined) ?? (c.m - 1) * 4 + 2;
  return { init, preload, seotda, url };
})();
if (typeof module === 'object' && module.exports) module.exports = HwatuArt;
