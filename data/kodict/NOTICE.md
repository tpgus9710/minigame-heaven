# 📖 끝말잇기 사전 자료 (words.txt.gz)

끝말잇기 판정에 쓰는 명사(대명사·수사 포함, 두 글자 이상) 493,710개 목록이에요.
이 폴더의 자료는 미니게임 천국의 코드와 따로이며, 아래 원 자료와 **같은 조건(CC BY-SA)** 으로만 쓸 수 있어요.

## 출처

- 국립국어원 《표준국어대사전》 — [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/)
  ([spellcheck-ko/korean-dict-nikl-stdict](https://github.com/spellcheck-ko/korean-dict-nikl-stdict) 의 XML)
- 국립국어원 《우리말샘》 — [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/)
- [hunspell-dict-ko](https://github.com/spellcheck-ko/hunspell-dict-ko) 낱말 자료 — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- 위 자료를 끝말잇기용으로 모은 목록: [41ways/kkeutmal](https://github.com/41ways/kkeutmal) 의 `dict/words.txt` (CC BY-SA)

## 바꾼 점

- 원 목록에서 사전 밖 낱말(`+` 표시, 게임·캐릭터 이름 등 329개)을 뺐어요.
- 외래어 표시(`~`)를 지우고, 가나다순으로 다시 정렬해 gzip 으로 묶었어요.
- 줄 형식: `[!|*]낱말`
  - `!` 표준어가 아닌 말 (방언 · 옛말 · 북한어 · 띄어 쓰는 구) — 대기실에서 「표준어만」을 고르면 받지 않아요.
  - `*` 흔한 말 (hunspell-dict-ko 명사) — 봇과 힌트가 먼저 써요.

## 이용 조건

이 자료(`words.txt.gz`)는 CC BY-SA 를 따릅니다. 다시 나눠 줄 때는 위 출처를 함께 밝히고, 고친 자료도 같은 조건으로 나눠 주세요.
