# AI 착장 토글은 룩북 모델을 입힌다

마이페이지 `AI 캐릭터 착장 이미지로 보기`를 켜면 성별만 맞춘 무신사 룩북 스타일
모델이 그 코디를 입은 전신 컷을 만든다. 프로필 사진·키·몸무게는 쓰지 않는다.
무료에서도 열려 있고, 장당 10크레딧이다(`PLANS["free"]["model_look"]=True`,
`CREDIT_COSTS["model_look"]=10`, 2026-08-30). 설정 행에는 비용 안내를 붙이지 않는다.
켤 때 사진 시트는 없다. 토스트는 「다음 추천부터 AI 착장으로 보여드려요」 /
끌 때는 「AI 착장 이미지를 껐어요」(모바일 22자 한 줄, 2026-08-30).

조합 추천(`POST /api/live/coordinate`)은 코디 목록만 먼저 돌린다. 착장은
`POST /api/live/coordinate/looks`가 이어서 채운다(2026-08-30). 품질은
`OPENAI_IMAGE_MODEL_LOOK`(기본 `gpt-image-2`) + `OPENAI_IMAGE_QUALITY_LOOK`(기본 high).

2026-08-30: `refreshLive`가 오늘 코디를 채우면 `dailyAllowed=true`라 오늘 탭이
`requestDailyOutfits`를 건너뛰고 `applyModelLooks`가 안 탔다. `dailyTick` 감시
effect로 `lookImg` 없는 코디를 looks API로 채운다(`09-app.jsx`).

착장 API는 keepalive SSE다. Render는 응답이 안 오면 ~100초에 끊어서, 서버에
`look_image_url`이 있어도 화면은 옷 컷아웃만 남았다. 한 장이 끝나는 즉시
`_look` 이벤트로 카드를 바꾼다. 인물 일관성을 위해 순차 생성(2026-08-30).

`hydrateOutfits`가 DAILY를 새 객체로 갈아끼우면 착장 URL이 옛 객체에만 붙는다.
`paintLook`은 `LB_DATA.DAILY`를 id로 찾아 쓰고, hydrate는 로컬 lookImg를 보존한다
(2026-08-30). 설정 `modelLook`은 계정 prefs에 있고 리셋은 코디 행만 지운다.

배경은 옷장·코디 카드와 같은 `--thumb-bg` `#E5E3DE` 한 장이다. 카드 안 패딩으로
더 작은 회색 사각형이 생기면 안 된다(2026-08-30). ChatGPT 무드 룩북과 같이
**무드 인물 사진 1장**(`backend/assets/look-identity/{m,f}.jpg`)을 `images.edit`에
넣고, 옷은 텍스트로 기술한다. 기준 인물 `model-id-v4-{m|f}`는 그 사진을 순한 인상·
전면 스튜디오로 고정. 착장 캐시 `model-id4-`. 출력은 plate flatten으로 판을 맞춘다.
크레딧 잔액으로 장 수를 자르지 않는다.

근거: `backend/app/main.py` `_model_look_garment_lines`, `_model_look_prompt_with_reference`,
`generate_model_look_image`; `frontend/src/proto/proto.css` `--thumb-bg`.
