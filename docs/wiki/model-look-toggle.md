# AI 착장 토글은 룩북 모델을 입힌다

마이페이지 `AI 캐릭터 착장 이미지로 보기`를 켜면 성별만 맞춘 무신사 룩북 스타일
모델이 그 코디를 입은 전신 컷을 만든다. 프로필 사진·키·몸무게는 쓰지 않는다.
무료에서도 열려 있고, 장당 5크레딧이다(`PLANS["free"]["model_look"]=True`,
`CREDIT_COSTS["model_look"]=5`, 2026-08-23). 설정 행에는 비용 안내를 붙이지 않는다.
켤 때 사진 시트는 없다. 토스트는 「다음 추천부터 AI 착장으로 보여드려요」 /
끌 때는 「AI 착장 이미지를 껐어요」(모바일 22자 한 줄, 2026-08-30).

조합 추천(`POST /api/live/coordinate`)은 코디 목록만 먼저 돌린다. 착장은
`POST /api/live/coordinate/looks`가 이어서 채운다(2026-08-30). 품질은 추출의
착용컷·재시도와 같은 `OPENAI_IMAGE_QUALITY_LOOK`(기본 high).

2026-08-30: `refreshLive`가 오늘 코디를 채우면 `dailyAllowed=true`라 오늘 탭이
`requestDailyOutfits`를 건너뛰고 `applyModelLooks`가 안 탔다. `dailyTick` 감시
effect로 `lookImg` 없는 코디를 looks API로 채운다(`09-app.jsx`).

착장 API는 keepalive SSE다. Render는 응답이 안 오면 ~100초에 끊어서, 서버에
`look_image_url`이 있어도 화면은 옷 컷아웃만 남았다. 한 장이 끝나는 즉시
`_look` 이벤트로 카드를 바꾸고, 동시에 최대 2장만 돌린다(2026-08-30).

배경은 상품 카드 `--thumb-bg`와 같은 `#E5E3DE`. 옷 참고는 별도 이미지로 넘긴다.
기준 인물 `model-id-v2-{m|f}`를 `images.generate`로 한 장 만든 뒤, 착장은
그 사진+옷 보드 두 장으로 `images.edit`(identity lock). 캐시 키 `model-id2-`.
크레딧 잔액으로 장 수를 자르지 않는다(2026-08-30).

근거: `backend/app/main.py` `_ensure_model_identity_png`, `_model_look_prompt_with_reference`,
`generate_model_look_image`; `frontend/src/proto/09-app.jsx` `applyModelLooks`.
