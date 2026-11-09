# 📖 끝말잇기 사전 자료 (words.txt.gz)

끝말잇기 판정에 쓰는 낱말 목록이에요. 국립국어원 《표준국어대사전》과 《우리말샘》의 표제어를 **품사 상관없이 모두**
(명사 · 대명사 · 수사 · 의존 명사 · 동사 · 형용사 · 부사 · 감탄사 · 관형사 · 조사 · 어근 · 띄어 쓰는 구) 담고,
원소 이름 118개(예전 이름 포함)를 더했어요. 두 글자 이상, 한글로만 된 말이에요.
이 폴더의 자료는 미니게임 천국의 코드와 따로이며, 아래 원 자료와 **같은 조건(CC BY-SA)** 으로만 쓸 수 있어요.

## 출처

- 국립국어원 《표준국어대사전》 · 《우리말샘》 — [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/)
  ([spellcheck-ko/korean-dict-nikl](https://github.com/spellcheck-ko/korean-dict-nikl) 의 XML, 2026년 6월 자료)
- [hunspell-dict-ko](https://github.com/spellcheck-ko/hunspell-dict-ko) 낱말 자료 — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- 예전 판(v12.4~v12.8)의 명사 목록: [41ways/kkeutmal](https://github.com/41ways/kkeutmal) 의 `dict/words.txt` (CC BY-SA) — 모두 그대로 들어 있어요.

## 만든 방법

- 표제어의 `-`(붙임표) · `^`(붙여 쓸 수 있는 띄어쓰기) · 빈칸을 지워서 붙여 썼어요 (산화^나트륨 → 산화나트륨).
- 빼 것: 어미 · 접사(-습니다, -개 같은 조각), 관용구 · 속담(문장), 옛한글처럼 지금 한글이 아닌 글자가 든 말, 한 글자 말.
- 줄 형식: `[!|^][*]낱말`
  - (표시 없음) 표준어 명사 — 대기실 「표준어 명사만」에서도 받아요.
  - `!` 명사지만 표준어 뜻이 없는 말 (방언 · 옛말 · 북한어) — 「명사만」 · 「모든 낱말」에서 받아요.
  - `^` 명사가 아닌 말 (부사 · 동사 · 형용사 · 감탄사 · 어근 …) — 「모든 낱말」(기본)에서만 받아요.
  - `*` 흔한 말 (hunspell-dict-ko 명사) — 봇과 힌트가 먼저 써요.

## 이용 조건

이 자료(`words.txt.gz`)는 CC BY-SA 를 따릅니다. 다시 나눠 줄 때는 위 출처를 함께 밝히고, 고친 자료도 같은 조건으로 나눠 주세요.
