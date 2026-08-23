# 사용량은 PC만 계정 카드 안, 모바일은 제 카드

마이페이지에서 사용량을 독립 카드로 두면 PC 2열에서 한 칸을 통째로 먹는다
(`08-mypage.jsx` 예전 `UsageCard`). **PC(wide)** 는 크레딧 숫자·막대·초기화만
`UsageBlock variant=inline`으로 **계정 및 지원** 카드 상단에 넣되, 여백을 넉넉히
둔다(`padding 18/16/22`, 숫자 28px, 막대 8px). **모바일** 은 계정 카드에서 빼
`variant=card`로 스타일 카드와 설정 사이에 둔다. 동작별 차감 목록은 안 그린다
(그건 [[plan-sheet-free-ads]] 요금제 시트).
요금제는 같은 블록의 `요금제 보기` → `PlanSheet`.

무료 월 크레딧은 50 (`backend/app/main.py` `PLANS["free"]["credits"]`). 이미 그 달
지급분이 다른 숫자면 `billing_state`가 grant 행을 맞춘다.

버전은 페이지 맨 아래 `RealCloset v1.0.0 · {날짜}`만. 커밋 해시는 안 넣는다
(`frontend/vite.config.js` `__BUILD_DATE__`). PC는 설정 | 계정 2열.

근거: `frontend/src/proto/08-mypage.jsx` `UsageBlock`, `accountCard`, `VersionLine`.
