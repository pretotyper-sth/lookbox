# 코디는 입을 법한 조합만 낸다

규칙 페어링(`fallback_combos`)이 상의×하의 점수만 보고 신발을 붙이면
셔츠+카고+첼시처럼 격식이 어긋난 조합이 나온다. 2026-09-06부터 이름·종류
키워드로 감점한다.

- 첼시·로퍼·구두 × 카고·조거·추리닝 → 강한 감점. 스니커가 이긴다
- 셔츠·옥스퍼드 × 카고·조거 → 감점. 슬랙스·데님이 이긴다
- 신발은 점수 1등만 고르지 않는다. 맞는 켤레 안에서 이미 쓴 것을 뒤로 민다
  (`_pick_rotating_shoe`, 2026-09-06). 카고에 첼시를 넣기 위해 돌리지는 않는다
- 지금 계절(KST)이 여름이 아니면 쪼리·슬리퍼·샌들·슬라이드는 강한 감점.
  9월은 가을. GPT가 골라도 `_replace_offseason_shoes`가 다른 켤레로 바꾼다
  (2026-09-10). 옷장에 그거밖에 없으면 그대로 둔다
- GPT 경로(`_COORD_RULES`)에도 같은 금지와 신발 순환을 적는다

근거: `backend/app/main.py` `_pair_clash`, `_COORD_RULES`, `_replace_offseason_shoes`;
`backend/tests/test_coord_sense.py` `test_flipflop_loses_to_loafer_in_september`.
