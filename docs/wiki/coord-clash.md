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

2026-09-15: 모자는 후디·카고·트랙·러닝처럼 스트리트/스포티 근거가 명백할 때만
허용한다. 데님·스니커만으로는 세미 비즈니스 캐주얼에도 섞이므로 근거가 아니다.

2026-09-13: 추천 프롬프트는 소품을 개수로 강제하지 않고, 상의 베이스를 가능한 한
서로 다르게 고르도록 한다. fallback도 `_accent_fit_score`로 가방·아우터·모자의
적합성을 판단하며, 모자는 캐주얼 근거가 없으면 넣지 않는다. AI 응답은
`_diversify_combo_bases`에서 같은 상의 반복을 뒤로 미룬다.

2026-09-16: 같은 카테고리(top·bottom·outer·dress·shoes·bag 등)는 레이어 여부와
무관하게 한 코디에 한 개만 허용한다. AI 응답·fallback·저장 직전에
`_combo_has_unique_garment_slots`로 다시 검증한다. 서울의 실제 현재·최고·최저 기온도
추천 프롬프트와 fallback 점수에 전달해 더운 날의 기모·패딩·두꺼운 코트를 감점한다.

2026-09-16: 데일리 외부 아이템은 최근 7일 제안 이력과 현재 응답 안의 중복을 함께 제외해
반복을 줄인다. 코디 4개는 색만 바꾼 같은 상의 반복을 다양화 대상으로 보지 않고,
상의 종류·핏·패턴·소재와 아이템 자체가 다른 조합을 우선한다. 근거:
`backend/app/main.py` `_recent_daily_wishes`, `_diversify_combo_bases`.

2026-09-18: 속성 추출이 비어 있어도 이름에서 셔츠·폴로·니트·티·후디 등 실루엣을
읽어 같은 형태의 상의를 후순위로 둔다. 추가 추천은 이미 오늘·최근 7일에 쓴 상의
실루엣을 먼저 피한다. 실제 체감·최저 기온이 12°C 이하이면 여름 전용, 낮 기온이
24°C 이상이면 겨울 전용 태그에도 강한 감점을 적용해 다양성 때문에 계절을 거스르지
않는다. 근거: `backend/app/main.py` `_visual_garment_family`, `fallback_combos`,
`_weather_item_penalty`.

2026-09-20: 데일리 추천은 상의뿐 아니라 하의의 동일 아이템도 한 번에 절반을 넘겨
반복하지 않는다. 코트·트렌치·블레이저 같은 테일러드 아우터와 카고·조거·추리닝은
점수와 무관하게 후보에서 제외한다. 퍼스널 컬러 외에 저장한 선호 핏·팔레트·무드도
실제 페어링 순서에 반영한다. 근거: `backend/app/main.py` `fallback_combos`,
`_diversify_combo_bases`, `_pair_is_forbidden`, `_pair_style_preference`.

2026-09-20: 데일리 카드는 상의·하의뿐 아니라 신발을 포함한 카테고리별 반복을 줄인다.
신발은 가장 잘 어울리면 두 코디까지 허용하고, 세 번째부터만 비슷하게 어울리는 다른
켤레로 바꾼다. 카고와 첼시 부츠처럼 강하게 충돌하는 후보는 다양성 때문에 선택하지
않는다. GPT가 같은 신발을 여러 장에 넣어도 `_rebalance_combo_shoes`가 같은 규칙으로
교체한다. 근거: `backend/app/main.py` `_pick_rotating_shoe`,
`_rebalance_combo_shoes`, `_diversify_combo_bases`; `backend/tests/test_coord_sense.py`
`ShoeRotateTest`.
