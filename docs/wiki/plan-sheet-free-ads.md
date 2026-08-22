# 요금제 시트 — 무료 + 광고 포함만

결제가 아직 없어서 프로 카드·하단 닫기·「기능은 같아요」카피는 빼기로 했다(2026-08-22).

`08-mypage.jsx` PlanSheet는 `plans` 중 `id==='free'`만 그린다. 항목에 `광고 포함`만 두고,
광고가 아직 없다는 설명은 화면에 쓰지 않는다(`plan_perks()`, `backend/app/main.py`).

관련: [[chiprow-sheet-scroll]]
