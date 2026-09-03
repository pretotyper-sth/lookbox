# 상품컷 조합도 10초가 아니고, 착장은 그보다 길다

화면에 「최대 10초」를 쓰지 않는다. 2026-09-03에 오늘 코디·룩북 카피에서 뺐다
(`06-today.jsx`, `05-screens-cde.jsx`).

## 상품컷 기준 코디 (`POST /api/live/coordinate`)

카드가 한 장씩 나오지 않는다. 프론트는 조합 JSON 전체를 기다린 뒤에 컷아웃
4장을 한 번에 그린다(`09-app.jsx` `requestDailyOutfits`). 서버도 코디를
스트리밍하지 않고 `gpt-4o` 추천 1회 + 옷장 persist 뒤에 응답한다.

`recommendation_timings.duration_ms`는 `_ensure_style_attrs` + `recommend_text`
까지이고, 그 다음 코디 행 insert는 포함하지 않는다
(`backend/app/main.py` `live_coordinate`).

2026-09-03 08:19:56 KST 실측 (옷장 47, 4콤보): **14.7초**. `recommend_text`
토큰 `text_in=5547`. 같은 풀 크기 누적: 평균 10.9초, p95 15.7초, 최대 24.3초
(`GET /api/live/recommend-stats`, n=12 at pool=47). 전날 08:44는 9.8초.

첫 추천이 더 느려질 수 있는 이유: 스타일 속성 없는 옷 최대 25개를 이름 기반
추론한다(`_ensure_style_attrs`, timeout 45초). 이번 08:20 요청에는
`style_attrs` 로그가 없었다.

## 착장 (`POST /api/live/coordinate/looks`)

같은 08:20 요청에서 추천이 끝난 뒤 착장 4장이 크레딧에 남았다.

| 단계 | 시각 (KST) | 간격 |
|---|---|---|
| 상품컷 4장 응답 | 08:19:56 | 추천 14.7초 |
| 착장 1 | 08:20:55 | +59초 |
| 착장 2 | 08:21:02 | +7초 |
| 착장 3·4 | 08:21:10 | +8초 |

첫 착장 ~1분이 `images.edit` 본론이다. `LOOK_TEST_LIMIT=1`인데 4장이 나온 건
요청마다 have=0으로 다시 채운 구멍이다(2026-09-03 08:20, [[model-look-toggle]]).

---

## 착장 생성이 느린 건 프롬프트 때문이 아니다

「AI 착장 한 장」이 ChatGPT에서 이미지 하나 뽑는 것보다 오래 걸리는 이유는
프롬프트 길이가 아니라 **입력 이미지 개수와 출력 크기**다.

| 요인 | 우리 | ChatGPT 이미지 1장 |
|---|---|---|
| 입력 이미지 | canonical 1 + 옷장 실물 최대 6 = **최대 7장** | 0장 |
| 출력 크기 | 1024x1536 (2:3) | 보통 1024x1024 |
| 모델·품질 | `gpt-image-2` / `medium` | 동급 |

`images.edit`는 입력 이미지마다 비전 인코딩이 붙는다. 코디 아이템이 늘수록
선형으로 느려진다. 프롬프트는 3.9KB / 80줄인데(`_model_look_prompt_with_reference`,
`backend/app/main.py:3683`), 텍스트 토큰은 이미지 토큰 대비 무시할 수준이라
프롬프트를 줄여도 지연은 사실상 안 준다. 프롬프트를 손대는 건 품질 문제일 때다.

우리 서버 쪽 몫(2026-09-02 측정, M-series 맥):

- `_flatten_look_plate` **1.85s** — 1024x1536 픽셀을 파이썬 루프로 BFS한다.
  Render 공유 CPU면 몇 배. 아직 벡터화하지 않았다.
- `_crop_look_to_card` 0.08s — 무시 가능.
- `_garment_edit_images` — 옷장 사진 Supabase 다운로드. 순차였던 걸
  `ThreadPoolExecutor`로 동시에 받게 바꿨다(2026-09-02). 장수만큼 쌓이던
  왕복이 한 번으로 줄어 OpenAI 호출이 그만큼 빨리 시작한다.

실측을 남기려고 `[timing] model-look` 로그에 단계별 시간을 붙였다
(`prep=… dress=… finish=… save=…`, `inputs=N`). `dress`가 전체의 대부분이면
남은 레버는 OpenAI 쪽 파라미터뿐이다:

- `quality`를 `low`로 → 빨라지지만 얼굴이 무너진다. 안 쓴다.
- 옷장 입력 썸네일 768→512 → 입력 토큰 감소. 원단 디테일 손실 위험.
- 입력 장수 6→4(코어 슬롯만) → 소품 반영이 약해진다.
- 출력 1024x1536→1024x1024 → 전신 컷 비율이 깨진다.

넷 다 품질을 깎는 거래라 적용하지 않았다. 2026-09-02 결정: 아무것도 바꾸지 않고
`[timing]` 실측부터 보고 판단한다. [[model-look-toggle]] 참고.

근거: `backend/app/main.py` `generate_model_look_image`, `_garment_edit_images`,
`_flatten_look_plate`, `_model_look_prompt_with_reference`.
