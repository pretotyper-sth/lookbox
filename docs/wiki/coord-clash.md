# 코디는 입을 법한 조합만 낸다

규칙 페어링(`fallback_combos`)이 상의×하의 점수만 보고 신발을 붙이면
셔츠+카고+첼시처럼 격식이 어긋난 조합이 나온다. 2026-09-06부터 이름·종류
키워드로 감점한다.

- 첼시·로퍼·구두 × 카고·조거·추리닝 → 강한 감점. 스니커가 이긴다
- 셔츠·옥스퍼드 × 카고·조거 → 감점. 슬랙스·데님이 이긴다
- GPT 경로(`_COORD_RULES`)에도 같은 금지를 적는다

근거: `backend/app/main.py` `_pair_clash`, `_COORD_RULES`;
`backend/tests/test_coord_sense.py` `test_chelsea_loses_to_sneaker_on_cargo`.
