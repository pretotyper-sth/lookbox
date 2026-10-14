# AI 원가는 `ai_usage_logs.metadata.cost_usd`

호출마다 `log_ai_usage`가 토큰을 `_AI_PRICES`에 곱해 `metadata.cost_usd`에 넣는다
(`backend/app/main.py` `log_ai_usage`, `_ai_cost_usd`). 관리자 집계는
`GET /api/live/admin/ai-cost` (ADMIN_TOKEN).

착장(`model_look`)·기준 인물(`model_identity`)은 usage를 넘기지 않아 비용이 0으로
집계된다 (`main.py` 3555, 3757). 분류·추천·바로 보기·상품 추출은 usage가 있다.
`today` 필드는 UTC 날짜라 KST 자정 전후는 하루가 어긋날 수 있다.

2026-08-30 KST 조회: 35회, 실측 $0.26, 착장 24회는 과거 gpt-image-1 실측으로
추정해 합계 약 $6.32.

## 2026-10-14 감사 — 청구액 미확정

Supabase ai_usage_logs 전체를 1,000건 단위로 조회: 417건, 2026-07-05 23:30 KST~2026-10-14 15:26 KST. 토큰/비용 기록 210건, 미기록 207건. 저장 cost_usd 합계 $16.906021은 청구 총액이나 검증된 하한이 아니다. gpt-image-2 단가표가 현재 공식 요금과 불일치하고 cached token 상세도 저장하지 않아 재검산/청구 대조가 필요하다.

| 기능 | 모델 | 기록 수 | 비용 기록 수 | 저장 비용 USD |
|---|---|---:|---:|---:|
| product_image | gpt-image-1 | 79 | 13 | 3.745835 |
| recommend_text | gpt-4o | 65 | 39 | 0.636164 |
| classify | gpt-4o | 52 | 52 | 0.395215 |
| product_image_error | gpt-image-2 | 2 | 0 | 0.000000 |
| style_attrs_image | gpt-4o | 50 | 50 | 0.173182 |
| product_image | gpt-image-2 | 2 | 2 | 0.085220 |
| tryon_body | gpt-image-1 | 13 | 13 | 2.406455 |
| model_look | gpt-image-1 | 27 | 0 | 0.000000 |
| model_identity | gpt-image-1 | 2 | 0 | 0.000000 |
| model_look | gpt-image-2 | 33 | 0 | 0.000000 |
| model_identity | gpt-image-2 | 1 | 0 | 0.000000 |
| wish_product_image | gpt-image-1 | 33 | 0 | 0.000000 |
| tryon_body | gpt-image-2 | 41 | 41 | 9.463950 |
| model_look | gpt-image-2.5-flare | 16 | 0 | 0.000000 |
| model_identity | gpt-image-2.5-flare | 1 | 0 | 0.000000 |

실측 표본: 상품 추출 gpt-image-1 high 12건 평균 $0.301252/최대 $0.317340; medium 1건 $0.130810. 분류 52건 평균 $0.007600; 추천 텍스트 39건 평균 $0.016312; 이미지 속성 50건 평균 $0.003464. 표본당 API 호출 비용이며 사용자 작업 전체 단가가 아니다.

누락: product_image gpt-image-1 66건, recommend_text 26건, model_look 76건, model_identity 4건, wish_product_image 33건, product_image_error 2건(실패 진단 이벤트, 과금 여부 미확정).

현재 상품컷 조합은 recommend_closet에서 AI 호출 없음(main.py:4504,9517). 구형 generate_look_image AI 플랫레이는 존재하지만 사용 로그 없음(main.py:4567,5875). model_look/identity/wish 이미지 응답 usage 미전달(main.py:5052,5571,9270). 바로 보기 몸 생성은 최대 3회(main.py:8599); tryon_validation은 로컬 검증 로그이므로 독립 API 호출로 세면 안 됨. 별도 무드 이미지 생성 스크립트는 이 로그에 기록하지 않음(backend/scripts/gen_mood_images.py:64).

공식 가격 확인 2026-10-14: GPT Image 1 입력 텍스트/이미지/출력 이미지 100만 토큰당 $5/$10/$40; Flare $5/$8/$30. Flare 공식 출력 계산기 high 1024x1280=1510토큰=$0.04530, high 1024x1536=1372토큰=$0.04116. 입력 토큰 별도, 직접 Images API는 Image 2/2.5 캐시 할인 미적용. 출처: https://developers.openai.com/api/docs/models/gpt-image-1 ; https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency

청구 조회: 기존 OpenAI API 키로 organization/costs 읽기 요청 403. Chrome usage 대시보드 로그인 필요. 실제 청구 누적액·Flare 실제 평균 단가는 현재 증거로 확정 불가. 운영 동작/가격표/로그 코드 변경 없음.

## 2026-10-14 누락 로깅 보완

`backend/app/ai_usage.py` 공통 래퍼가 서버·로컬 구형 서버·무드 생성 스크립트의 OpenAI/Gemini 호출마다 UUID와 시작 기록을 먼저 저장한다. 응답 즉시 raw_usage, 입력/출력/캐시 토큰, 모델·품질·크기, 요청 ID, 소요시간, 공개 단가 버전과 추정 원가를 기록한다. 공급사 사용량/지원 단가가 없으면 금액은 null(미확정). Enterprise 계약 청구액과 공개 단가 추정액은 별개다.

SQLite outbox에 먼저 기록하고 Supabase에 동일 ID로 upsert한다. 클라우드 시작 기록 실패 시 유료 요청은 보내지 않는다. 완료 저장 실패는 outbox에서 30초마다 재전송한다. 운영에서 `AI_USAGE_OUTBOX_PATH`를 영구 디스크에 지정하면 서버 교체 시에도 미전송 완료 기록을 복구할 수 있다. 미지정 기본은 `backend/.local/ai-usage.sqlite3`; 임시 디스크가 사라지면 시작 기록은 Supabase에 남지만 완료 토큰은 미확정으로 남을 수 있다.

관리자 비용 API는 전체 페이지 조회·KST 기준 날짜·진단 이벤트 제외·비용 미확정 건수·동기화 대기 건수를 반환한다. 과거 누락 사용량은 새 로깅으로 복구되지 않는다. 관련 테스트 47개 통과; 전체 테스트 실패 18/오류 8은 수정 전 기준에서도 동일 목록으로 재현.
