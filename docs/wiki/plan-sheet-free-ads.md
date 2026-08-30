# 요금제 시트 — 무료 + 광고 포함 + 작업별 크레딧

결제가 아직 없어서 프로 카드·하단 닫기·「기능은 같아요」카피는 빼기로 했다(2026-08-22).

`08-mypage.jsx` PlanSheet는 `plans` 중 `id==='free'`만 그린다. 항목에 `광고 포함`만 두고,
광고가 아직 없다는 설명은 화면에 쓰지 않는다(`plan_perks()`, `backend/app/main.py`).

박스 아래에 **작업별 크레딧**을 접어 둔다. 접힌 상태는 아래 화살표(`chevD`), 열린 상태는
위로 뒤집는다(2026-08-30). 값은 `GET /api/live/billing`의 `costs`
(`CREDIT_COSTS` + `CREDIT_LABELS`, 2026-08-23). 사용량 카드에는 이 목록을 그리지 않는다
([[mypage-usage-in-account]]). 바로 보기 이미지가 공짜라는 안내 문구는 넣지 않는다
(`08-mypage.jsx` PlanSheet, 2026-08-23).

관련: [[chiprow-sheet-scroll]]
