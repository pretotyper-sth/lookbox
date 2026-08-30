# AI 원가는 `ai_usage_logs.metadata.cost_usd`

호출마다 `log_ai_usage`가 토큰을 `_AI_PRICES`에 곱해 `metadata.cost_usd`에 넣는다
(`backend/app/main.py` `log_ai_usage`, `_ai_cost_usd`). 관리자 집계는
`GET /api/live/admin/ai-cost` (ADMIN_TOKEN).

착장(`model_look`)·기준 인물(`model_identity`)은 usage를 넘기지 않아 비용이 0으로
집계된다 (`main.py` 3555, 3757). 분류·추천·바로 보기·상품 추출은 usage가 있다.
`today` 필드는 UTC 날짜라 KST 자정 전후는 하루가 어긋날 수 있다.

2026-08-30 KST 조회: 35회, 실측 $0.26, 착장 24회는 과거 gpt-image-1 실측으로
추정해 합계 약 $6.32.
