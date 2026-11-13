/* =====================================================================
 *  ☔ 산성비 영타 (v13.7) — 영어 단어 목록 + 두벌식 바꾸기 (화면 js/rain.js · 서버 games/rain.js 가 같이 써요)
 *   · WORDS: 소문자 영어 단어 (3 ~ 10글자) — 과일 · 자연 · 학교 · 물건 · 탈것 · 동물 · 운동 · 마음 · 로봇 · 게임
 *   · keys(s): 한/영 키를 깜빡하고 한글 자판으로 친 글자를 「누른 영어 키」로 되돌려요 (메ㅔㅣㄷ → apple)
 *     두벌식은 글쇠 하나가 자모 하나라서, 완성된 글자를 자모로 풀면 누른 순서 그대로 나와요.
 *   · norm(s): 띄어쓰기 빼고 · 한글 자판 → 영어 키 · 소문자 (휴대폰이 첫 글자를 대문자로 바꿔도 괜찮아요)
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RainEN = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const WORDS = [...new Set((
    'apple banana grape melon lemon mango peach cherry orange kiwi berry plum pear lime pizza burger noodle bread butter cheese ' +
    'cookie candy sugar honey juice milk coffee water rice soup salad pasta sandwich chicken potato tomato carrot onion pepper donut waffle popcorn ' +
    'sky sea cloud wind rain snow storm river ocean forest flower tree leaf grass stone rock sand beach island mountain valley desert ' +
    'sunset sunrise rainbow thunder moon star planet earth space galaxy comet volcano jungle meadow ' +
    'school class teacher student pencil eraser notebook book desk chair board paper ruler crayon marker library lesson homework ' +
    'science math music history english korean art friend campus recess lunch locker ' +
    'phone camera laptop computer keyboard mouse monitor screen speaker robot drone battery cable charger window door table sofa lamp clock ' +
    'mirror bottle cup plate spoon fork knife umbrella backpack wallet ticket pocket blanket pillow candle basket bucket ladder ' +
    'car bus taxi train subway bicycle airplane rocket ship boat truck helmet engine wheel scooter ' +
    'dog cat rabbit turtle tiger lion elephant giraffe penguin monkey panda koala zebra horse sheep goat duck eagle owl dolphin whale ' +
    'shark octopus snake frog bee ant butterfly spider squirrel hamster parrot fox wolf bear deer camel hippo ' +
    'soccer baseball basketball volleyball tennis golf swim dance skate ski bowling boxing marathon hockey badminton racket trophy ' +
    'happy smile laugh love family dream hope brave kind calm cool funny lucky magic power energy future peace sunny joy wonder gentle ' +
    'sensor servo circuit voltage current switch signal coding program algorithm network server data pixel vector matrix gear spring bolt ' +
    'laser motor arduino python button display memory wireless antenna module ' +
    'open close start stop move turn push pull drop catch throw build create design paint write read sing play game win level score ' +
    'bonus combo jump shoot quick speed boost'
  ).split(/\s+/).filter(Boolean))];

  /* 두벌식: 초성 19 · 중성 21 · 종성 28(0 = 없음) → 누른 키 */
  const CHO = ['r', 'R', 's', 'e', 'E', 'f', 'a', 'q', 'Q', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g'];
  const JUNG = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l'];
  const JONG = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g'];
  /* 낱자(호환 자모 ㄱ ~ ㅣ: U+3131 ~ U+3163) */
  const JAMO = ['r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'E', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'Q', 'qt', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g',
    'k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l'];

  /** 한글 자판으로 친 글자 → 누른 영어 키 (한글이 아닌 글자는 그대로) */
  function keys(s) {
    let out = '';
    for (const ch of String(s == null ? '' : s)) {
      const c = ch.codePointAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) { const k = c - 0xac00; out += CHO[Math.floor(k / 588)] + JUNG[Math.floor((k % 588) / 28)] + JONG[k % 28]; }
      else if (c >= 0x3131 && c <= 0x3163) out += JAMO[c - 0x3131];
      else out += ch;
    }
    return out;
  }
  /** 비교용: 띄어쓰기 빼고 · 한글 자판 → 영어 키 · 소문자 */
  const norm = s => keys(String(s == null ? '' : s).replace(/\s/g, '')).toLowerCase();
  /** 산성비 혼자 하기: 단계가 낮을 때는 짧은 단어부터 (1단계 5글자까지 → 5단계부터 모든 단어) */
  const upTo = lv => WORDS.filter(w => w.length <= 4 + lv);

  return { WORDS, keys, norm, upTo };
});
