# 키·몸무게는 행을 나누고, 착장 그림에는 쓰지 않는다

개인 정보 **표시**는 `InfoRow`로 키 / 몸무게 각 한 줄 (`08-mypage.jsx` `personalBody`).
**입력**은 계정 수정 시트와 온보딩에서 `NumberSlider` 두 개. 한 줄에 cm·kg를 나란히
두지 않는다.

값은 코디 설명의 기장·핏 힌트에만 쓴다 (`backend/app/main.py` `_profile_block` 체형
줄). AI 착장·바로 보기 이미지 프롬프트에는 넣지 않는다 — 실제 체형을 그대로 그리면
사용자가 원하는 컷과 멀어진다. `_body_note`는 제거됨(2026-08-23).

근거: `08-mypage.jsx` `personalBody`·`AccountEditSheet`, `generate_model_look_image`,
`live_tryon_body`.
