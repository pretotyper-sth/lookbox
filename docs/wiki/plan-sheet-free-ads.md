# 요금제 시트 — 무료 + 광고 모델만

결제가 아직 없어서 프로 카드·하단 닫기·「기능은 같아요」카피는 빼기로 했다(2026-08-22).

`08-mypage.jsx` PlanSheet는 `plans` 중 `id==='free'`만 그린다. 카피:
「광고 요금제예요. 광고는 아직 거의 없고, 나중에 붙일 수 있어요.」
`plan_perks()`(`backend/app/main.py`)는 무료에 `광고 포함`을 붙인다.

관련: [[chiprow-sheet-scroll]]
