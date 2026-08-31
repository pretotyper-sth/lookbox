# AI 착장 토글은 canonical 캐릭터에 옷만 입힌다

마이페이지 `AI 캐릭터 착장 이미지로 보기`를 켜면 성별 canonical 캐릭터에
그 코디를 입힌 전신 컷을 만든다. 프로필 사진·키·몸무게는 쓰지 않는다.
무료에서도 열려 있고, 장당 10크레딧이다(`PLANS["free"]["model_look"]=True`,
`CREDIT_COSTS["model_look"]=10`, 2026-08-30). 설정 행에는 비용 안내를 붙이지 않는다.
켤 때 사진 시트는 없다. 토스트는 「다음 추천부터 AI 착장으로 보여드려요」 /
끌 때는 「AI 착장 이미지를 껐어요」(모바일 22자 한 줄, 2026-08-30).

조합 추천(`POST /api/live/coordinate`)은 코디 목록만 먼저 돌린다. 착장은
`POST /api/live/coordinate/looks`가 이어서 채운다(2026-08-30). 품질은
`OPENAI_IMAGE_MODEL_LOOK`(기본 `gpt-image-2`) + `OPENAI_IMAGE_QUALITY_LOOK`(기본 high).

2026-08-31: 첫 추천 응답이 오면 컷아웃 카드를 바로 그리고 착장을 시작한다.
개수가 모자라도 coordinate를 추가로 돌리지 않는다. wish는 첫 요청의
`wish_combos` + 서버 `_fill_wish_quota`. 전신은 SSE로 장당 카드에 붙는다
(`09-app.jsx` `requestDailyOutfits`).

2026-08-30: `refreshLive`가 오늘 코디를 채우면 `dailyAllowed=true`라 오늘 탭이
`requestDailyOutfits`를 건너뛰고 `applyModelLooks`가 안 탔다. `dailyTick` 감시
effect로 `lookImg` 없는 코디를 looks API로 채운다(`09-app.jsx`).

착장 API는 keepalive SSE다. Render는 응답이 안 오면 ~100초에 끊어서, 서버에
`look_image_url`이 있어도 화면은 옷 컷아웃만 남았다. 한 장이 끝나는 즉시
`_look` 이벤트로 카드를 바꾼다. 인물 일관성을 위해 순차 생성(2026-08-30).
대기 중인 카드는 컷아웃을 그대로 두고, 지금 그리는 장만 하단 뱃지
「AI 착장 만드는 중」을 붙인다. 사진 없는 wish는 점선 칸으로 그리지 않는다
(2026-08-31).

`hydrateOutfits`가 DAILY를 새 객체로 갈아끼우면 착장 URL이 옛 객체에만 붙는다.
`paintLook`은 `LB_DATA.DAILY`를 id로 찾아 쓰고, hydrate는 로컬 lookImg를 보존한다
(2026-08-30). 설정 `modelLook`은 계정 prefs에 있고 리셋은 코디 행만 지운다.

배경은 옷장·코디 카드와 같은 `--thumb-bg` `#E5E3DE` 한 장이다. 카드 안 패딩으로
더 작은 회색 사각형이 생기면 안 된다(2026-08-30). 기준 인물은 성별 canonical
원본(`backend/assets/look-identity/{m,f}.jpg`, `assets/mood/남자·여자 코디 예시.png`)을
다시 그리지 않고 `images.edit` 첫 장(Image 1)으로 쓴다. 댄디·미니멀처럼 남녀가
한 장에 있는 무드 컷은 인물 입력이 아니다. 이전 착장 결과는 다음 생성의
reference로 쓰지 않는다. 옷장 실물 컷은 격자 보드가 아니라 Image 2+로 붙인다. 캐시
`model-id-v7-` / `model-id7-`(2026-08-31). 프롬프트는 outfit replacement:
인물·스튜디오·포즈 고정, 옷만 교체. 하의는 긴 기장이 기본. 출력은 plate flatten.
크레딧 잔액으로 장 수를 자르지 않는다.
`wish_combos`는 추천 시점에 서버가 쿼타를 채운다. 모델이 빼먹어도 빈 자리
(신발·가방 등)를 제안으로 넣는다(`_fill_wish_quota`, 2026-08-30).

근거: `backend/app/main.py` `_model_look_outfit_block`, `_model_look_prompt_with_reference`,
`generate_model_look_image`; `frontend/src/proto/proto.css` `--thumb-bg`.
