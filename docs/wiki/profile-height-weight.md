# 키·몸무게 표시와 개인화 체형 적용

개인 정보 **표시**는 `InfoRow`로 키 / 몸무게 각 한 줄 (`08-mypage.jsx` `personalBody`).
**입력**은 계정 수정 시트와 온보딩에서 `NumberSlider` 두 개. 한 줄에 cm·kg를 나란히
두지 않는다. 라벨은 `LabeledField`와 같다: 12px / weight 600 / `--ink-2`. 값도 700이 아니라 600.

키·몸무게는 추천 `_profile_block`과 룩북 착장 이미지에는 넣지 않는다. 다만 바로 보기 전신 생성은
계정 `prefs`의 수치를 느슨한 체형 기준으로만 써서, 자연스러운 성인 비율 안에서 다리선이 조금 더 길어
보이게 한다. 키·몸무게로 얼굴·나이·체형을 과장하거나 비현실적으로 바꾸지 않는다. 착장은 성별 canonical
원본을 쓰고 얼굴을 다시 그리지 않는다. `live_tryon_body`는 입력 프사에서 정면 얼굴만 유지하며 셀피 각도는
따라 하지 않는다. `_body_note`는 2026-08-23에 제거.

근거: `08-mypage.jsx` `personalBody`·`AccountEditSheet`, `generate_model_look_image`,
`live_tryon_body`.

2026-10-08 변경: 위의 착장 수치 미사용 기록은 이전 정책이다. 현재 개인화 착장은 [[personal-model-look]]에 따라 키·몸무게를 시각적 체형에 반영한다. 조합 추천의 `_profile_block`에는 여전히 수치를 넣지 않는다. 보호된 바로 보기 전신 생성 비율은 이번 작업에서 변경하지 않았다.
