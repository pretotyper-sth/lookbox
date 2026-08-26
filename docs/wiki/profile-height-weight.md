# 키·몸무게는 행을 나누고, 착장 그림에는 쓰지 않는다

개인 정보 **표시**는 `InfoRow`로 키 / 몸무게 각 한 줄 (`08-mypage.jsx` `personalBody`).
**입력**은 계정 수정 시트와 온보딩에서 `NumberSlider` 두 개. 한 줄에 cm·kg를 나란히
두지 않는다. 라벨은 `LabeledField`와 같다: 12px / weight 600 / `--ink-2`. 값도 700이 아니라 600.

키·몸무게는 프로필에만 둔다. 추천 `_profile_block`과 착장/바로 보기 이미지
프롬프트에 체형 문장을 넣지 않는다. 착장 모델은 성별만 보고 룩북 얼굴을 새로 그린다.
`_body_note`는 2026-08-23에 제거.

근거: `08-mypage.jsx` `personalBody`·`AccountEditSheet`, `generate_model_look_image`,
`live_tryon_body`.
