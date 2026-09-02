# 착장 생성이 느린 건 프롬프트 때문이 아니다

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
