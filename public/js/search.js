/* =====================================================================
 *  🔍 게임 검색 (v13.2)
 *   - 처음 화면: 검색 칸에 치면 바로 결과 (혼자 · 같이 버튼) · Enter 는 첫 결과 · 「/」 키로 검색 칸
 *   - 싱글 · 멀티 · 게임 바꾸기 목록: 분류 줄 옆 검색 칸으로 목록 거르기
 *   한글은 자모로 풀어서 비교해요 → 치는 중인 글자(고슽 → 고스톱)도 · 초성(ㄱㅅㅌ)도 · 별명(부루마블 → 세계여행)도 찾아요
 * ===================================================================== */
const Find = (() => {
  const CHO = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
  const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const SPLIT = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ', ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ' };
  const norm = s => String(s || '').toLowerCase().replace(/[\s·\-_.,:;!?()[\]'"~/+&]+/g, '');
  const syl = ch => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 ? c : -1; };
  const jamo = s => { let o = ''; for (const ch of s) { const c = syl(ch); o += c < 0 ? SPLIT[ch] || ch : CHO[(c / 588) | 0] + JUNG[((c % 588) / 28) | 0] + JONG[c % 28]; } return o; };
  const cho = s => { let o = ''; for (const ch of s) { const c = syl(ch); o += c < 0 ? ch : CHO[(c / 588) | 0]; } return o; };
  const onlyCho = q => /^[ㄱ-ㅎ]+$/.test(q);

  /** 별명 · 영어 이름 · 원작 이름 (찾기만 해요) */
  const ALIAS = {
    seotda: '화투 땡 광땡 seotda 섰다', poker: '카드 포커 poker 스터드 홀덤', apple: '사과 apple 합10', race: '1to50 원투피프티 숫자', catch: '그림퀴즈 그림맞히기 캐치 catchmind',
    liar: '라이어 liar', tetris: '테트리스 tetris 블록', omok: '오목 바둑 gomoku 5목', pong: '탁구 핑퐁 pong', snake: '뱀 지렁이 snake',
    rain: '타자 타자연습 한컴 산성비', mine: '지뢰 minesweeper', g2048: '2048 숫자합치기', bingo: '빙고 bingo', dodge: '총피 피하기 탄막',
    plat: '점프 마리오 런 플랫포머', volley: '배구 피카츄배구 volley', bomb: '폭탄 봄버맨 크레이지아케이드 물풍선 bomb', tank: '포트리스 탱크 대포 포탄',
    onecard: '원카드 우노 uno', halli: '할리갈리 종치기 과일', ox: 'ox 퀴즈 상식', word: '끝말 단어 국어사전', mole: '두더지 망치',
    gem: '애니팡 비주얼드 보석 3매치 match3', fruit: '수박게임 수박 합치기', marble: '부루마블 모두의마블 마블 세계여행', life: '인생게임 인생',
    mafia: '마피아 mafia 추리', thief: '도둑 조커 카드뽑기', yut: '윷 윷놀이 명절', yacht: '요트 야추 yacht yahtzee 주사위', blackjack: '블랙잭 21 카지노',
    liardice: '주사위 허세 라이어', davinci: '다빈치코드 다빈치 암호 추리', reversi: '오델로 othello 리버시', shisen: '사천성 짝맞추기',
    mahjong: '마작 상하이 솔리테어 짝맞추기', tilematch: '타일 양 3개모으기 모으기', setgame: '세트 set 카드찾기', pinball: '핀볼 pinball',
    memory: '카드 짝맞추기 짝 맞추기 기억력 메모리 memory 같은그림 뒤집기 신경쇠약',
    spot: '틀린그림찾기 틀린그림 틀린 그림 다른그림 다른 그림 찾기 숨은그림 spot difference 사진 실사 과일가게 항구 요트 운하 베네치아 꽃 양 호박 버거',
    sudoku: '스도쿠 sudoku 숫자퍼즐', nonogram: '네모로직 노노그램 picross 그림퍼즐', chess: '체스 chess', gostop: '맞고 고스톱 화투 고도리',
    rummi: '루미큐브 러미 rummikub 숫자타일', bang: '뱅 bang 총잡이 서부', coup: '쿠 coup 블러핑', dalmuti: '달무티 계급 신분',
    relay: '텔레스트레이션 그림릴레이 그림', kart: '카트라이더 카트 레이싱 드리프트 자동차 마리오카트', breakout: '벽돌깨기 공', zombie: '좀비 부대 웨이브 슈팅 무기 레이저 로켓 화염방사기 보스 생존',
    shooter: '슈팅 비행기 갤러그 우주', stack: '탑쌓기 쌓기 블록',
  };

  /** 싱글 · 멀티를 합친 게임 목록 (key 하나에 한 줄) */
  let LIST = null;
  function list() {
    if (LIST) return LIST;
    const m = new Map();
    for (const [k, , n, d, , cat] of SOLO_GAMES) m.set(k, { k, cat, solo: n, soloD: d, multi: null, multiD: '' });
    for (const [k, g] of Object.entries(GAME_INFO)) {
      const x = m.get(k) || { k, cat: g.cat, solo: null, soloD: '' };
      x.multi = g.name; x.multiD = g.desc; m.set(k, x);
    }
    LIST = [...m.values()].map(x => {
      const names = [x.solo, x.multi].filter(Boolean).map(stripEmoji);
      return { ...x, name: Home.name(x.k, x.solo ? 's' : 'm'), keys: names.map(norm), jam: names.map(n => jamo(norm(n))), chos: names.map(n => cho(norm(n))),
        al: String(ALIAS[x.k] || '').split(/\s+/).filter(Boolean).map(norm), desc: norm(`${x.soloD} ${x.multiD}`) };
    });
    return LIST;
  }
  /** 점수: 0 이면 안 맞아요 */
  function score(x, q) {
    if (!q) return 0;
    const qj = jamo(q), c = onlyCho(q);
    let best = 0;
    const up = v => { if (v > best) best = v; };
    x.keys.forEach((n, i) => {
      if (n.startsWith(q)) up(100); else if (n.includes(q)) up(88);
      else if (x.jam[i].startsWith(qj)) up(84); else if (x.jam[i].includes(qj)) up(72);   // 치는 중인 글자
      if (c) { if (x.chos[i].startsWith(q)) up(92); else if (x.chos[i].includes(q)) up(76); }
    });
    for (const a of x.al) {
      if (a.startsWith(q)) up(66); else if (a.includes(q) || jamo(a).includes(qj)) up(58);
      else if (c && cho(a).startsWith(q)) up(56);
    }
    if (!best && q.length >= 2 && (x.desc.includes(q) || jamo(x.desc).includes(qj))) up(34);
    if (!best && norm(x.cat).startsWith(q)) up(30);
    return best;
  }
  function search(text) {
    const q = norm(text);
    if (!q) return [];
    return list().map(x => ({ x, s: score(x, q) })).filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s || a.x.name.localeCompare(b.x.name, 'ko')).map(r => r.x);
  }
  return { norm, jamo, cho, search, score: (k, text) => { const x = list().find(y => y.k === k); return x ? score(x, norm(text)) : 0; }, list };
})();

/* ─── 처음 화면 검색 ─── */
const HomeFind = {
  max: 8, more: false,
  html() {
    return `<div class="hfind" id="hfind">
      <label class="hf-box">${icon('search')}<input type="search" id="hf-q" placeholder="게임 찾기 · 초성도 돼요 (ㅅㄷ)" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="게임 찾기">
        <button type="button" class="hf-x" data-act="hfClear" aria-label="지우기">${icon('x')}</button><kbd class="hf-key" aria-hidden="true">/</kbd></label>
      <div class="hf-res" id="hf-res" role="list"></div></div>`;
  },
  row(x) {
    const sub = `${x.cat} · ${x.solo ? x.soloD : x.multiD}`;
    const b = [];
    if (x.solo) b.push(`<button class="hf-go s" data-act="homeGo" data-game="${x.k}" data-mode="s" title="혼자 하기 (AI · 기록)" aria-label="${esc(x.name)} 혼자 하기">${icon('user')}혼자</button>`);
    if (x.multi) b.push(`<button class="hf-go m" data-act="homeGo" data-game="${x.k}" data-mode="m" title="친구와 같이 (방 만들기)" aria-label="${esc(x.name)} 친구와 같이 하기">${icon('users')}같이</button>`);
    return `<div class="hf-row" role="listitem"><button class="hf-main" data-act="homeGo" data-game="${x.k}" data-mode="${x.solo ? 's' : 'm'}">${gameIcon(x.k, x.cat, 'sm')}<span><b>${esc(x.name)}</b><small>${esc(sub)}</small></span></button><div class="hf-btns">${b.join('')}</div></div>`;
  },
  render() {
    const q = $('#hf-q').value, box = $('#hfind'), res = $('#hf-res');
    const on = !!Find.norm(q);
    box.classList.toggle('on', on);
    document.getElementById('scr-home').classList.toggle('finding', on);
    if (!on) { res.innerHTML = ''; return; }
    const all = Find.search(q), show = this.more ? all : all.slice(0, this.max);
    res.innerHTML = all.length
      ? show.map(x => this.row(x)).join('') + (all.length > show.length ? `<button class="hf-more" data-act="hfMore">${all.length - show.length}개 더 보기</button>` : '')
      : `<p class="hf-none">「${esc(q.trim())}」 게임이 없어요 · 다른 말로 찾아보세요</p>`;
  },
};
(() => {
  const anchor = document.querySelector('#scr-home .mode-grid');      // 얼굴 로그인 카드 아래 · 싱글/멀티 버튼 위 (휴대폰 첫 화면에 보여요)
  if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin', HomeFind.html());
  const q = $('#hf-q');
  q.addEventListener('focus', () => {                               // 휴대폰: 자판이 올라와도 결과가 보이게 검색 칸을 위로
    if (!matchMedia('(pointer:coarse)').matches) return;
    setTimeout(() => { const y = $('#hfind').getBoundingClientRect().top + scrollY - 66; if (Math.abs(scrollY - y) > 8) scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); }, 250);
  });
  q.addEventListener('input', () => { HomeFind.more = false; HomeFind.render(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { const b = $('#hf-res .hf-main'); if (b) { e.preventDefault(); b.click(); } }
    if (e.key === 'Escape') { q.value = ''; HomeFind.render(); q.blur(); }
  });
  document.addEventListener('keydown', e => {                      // 컴퓨터: 「/」 를 누르면 검색 칸으로
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || typing() || !isHomeNow()) return;
    e.preventDefault(); q.focus();
  });
})();
function isHomeNow() { const h = document.getElementById('scr-home'); return !!h && h.classList.contains('active'); }

/* ─── 싱글 · 멀티 · 게임 바꾸기 목록: 분류 줄 옆 검색 칸 ─── */
const GridFind = {
  apply(row) {
    const grid = row.nextElementSibling, input = row.querySelector('.cf-q');
    const q = input ? input.value : '';
    const cat = (row.querySelector('.cat-chip.on') || {}).dataset ? row.querySelector('.cat-chip.on').dataset.cat : '전체';
    let n = 0;
    $$('.game-card', grid).forEach(c => {
      const ok = (cat === '전체' || c.dataset.cat === cat) && (!Find.norm(q) || Find.score(c.dataset.game, q) > 0);
      c.classList.toggle('hidden', !ok); if (ok) n++;
    });
    row.classList.toggle('finding', !!Find.norm(q));
    let none = grid.nextElementSibling;
    if (!none || !none.classList.contains('cf-none')) { none = document.createElement('p'); none.className = 'cf-none'; grid.after(none); }
    none.textContent = n ? '' : Find.norm(q) ? `「${q.trim()}」 게임이 없어요` : '';
    none.hidden = !!n;
    if (Find.norm(q)) {                                             // 잘 맞는 게임부터
      const cards = $$('.game-card', grid).filter(c => !c.classList.contains('hidden'));
      cards.sort((a, b) => Find.score(b.dataset.game, q) - Find.score(a.dataset.game, q)).forEach(c => grid.appendChild(c));
    } else if (grid.dataset.order) {
      const order = grid.dataset.order.split(',');
      $$('.game-card', grid).sort((a, b) => order.indexOf(a.dataset.game) - order.indexOf(b.dataset.game)).forEach(c => grid.appendChild(c));
    }
  },
  attach(row) {
    if (!row || row.querySelector('.cf-box')) return;
    const grid = row.nextElementSibling;
    grid.dataset.order = $$('.game-card', grid).map(c => c.dataset.game).join(',');
    row.insertAdjacentHTML('beforeend', `<label class="cf-box">${icon('search')}<input type="search" class="cf-q" placeholder="게임 찾기" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="게임 찾기"></label>`);
    const q = row.querySelector('.cf-q');
    q.addEventListener('input', () => this.apply(row));
    q.addEventListener('keydown', e => {
      if (e.key === 'Escape') { q.value = ''; this.apply(row); q.blur(); }
      if (e.key === 'Enter' && !e.isComposing) { const c = $$('.game-card', grid).find(x => !x.classList.contains('hidden')); if (c) { e.preventDefault(); q.blur(); c.click(); } }
    });
  },
};
$$('.cat-row').forEach(r => GridFind.attach(r));
ACT.cat = el => {                                                   // 분류 칩: 검색어와 함께 걸러요
  const row = el.parentElement;
  $$('.cat-chip', row).forEach(b => b.classList.toggle('on', b === el));
  GridFind.apply(row);
};
const homeGo0 = ACT.homeGo;
ACT.homeGo = el => {                                                // 검색 결과에서 고르면 검색 칸은 비워요 (돌아왔을 때 처음 화면 그대로)
  homeGo0(el);
  if (el.closest('#hfind')) { $('#hf-q').value = ''; HomeFind.render(); }
};
Object.assign(ACT, {
  hfClear: () => { const q = $('#hf-q'); q.value = ''; HomeFind.render(); q.focus(); },
  hfMore: () => { HomeFind.more = true; HomeFind.render(); },
});
