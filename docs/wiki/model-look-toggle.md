# AI 착장 토글은 canonical 캐릭터에 옷만 입힌다

마이페이지 `AI 캐릭터 착장 이미지로 보기`를 켜면 성별 canonical 캐릭터에
그 코디를 입힌 전신 컷을 만든다. 프로필 사진·키·몸무게는 쓰지 않는다.
무료에서도 열려 있고, 장당 10크레딧이다(`PLANS["free"]["model_look"]=True`,
`CREDIT_COSTS["model_look"]=10`, 2026-08-30). 설정 행에는 비용 안내를 붙이지 않는다.
켤 때 사진 시트는 없다. 토스트는 「다음 추천부터 AI 착장으로 보여드려요」 /
끌 때는 「AI 착장 이미지를 껐어요」(모바일 22자 한 줄, 2026-08-30).

조합 추천(`POST /api/live/coordinate`)은 코디 목록만 먼저 돌린다. 착장은
`POST /api/live/coordinate/looks`가 이어서 채운다(2026-08-30). 품질은
`OPENAI_IMAGE_MODEL_LOOK`(기본 `gpt-image-2`) + `OPENAI_IMAGE_QUALITY_LOOK`(기본 medium,
2026-08-31). high 4장 병렬은 첫 장이 더 늦었다.
품질 테스트 동안 `LOOK_TEST_LIMIT`(기본 1)로 착장 이미지를 1장만 만든다. 0이면
제한 없음. 프론트 `LOOK_TEST_LIMIT`와 서버 env가 같다(2026-08-31).

2026-08-31: 첫 추천 응답이 오면 컷아웃 카드를 바로 그리고 착장을 시작한다.
개수가 모자라도 coordinate를 추가로 돌리지 않는다. wish는 첫 요청의
`wish_combos` + 서버 `_fill_wish_quota`. 전신은 한 장씩 만들고 SSE `_look`으로
카드에 붙인다(`09-app.jsx` `requestDailyOutfits`).

2026-08-30: `refreshLive`가 오늘 코디를 채우면 `dailyAllowed=true`라 오늘 탭이
`requestDailyOutfits`를 건너뛰고 `applyModelLooks`가 안 탔다. `dailyTick` 감시
effect로 `lookImg` 없는 코디를 looks API로 채운다(`09-app.jsx`).

착장 API는 keepalive SSE다. Render는 응답이 안 오면 ~100초에 끊어서, 서버에
`look_image_url`이 있어도 화면은 옷 컷아웃만 남았다. 한 장이 끝나는 즉시
`_look` 이벤트로 카드를 바꾼다. 사진 없는 wish는 점선 칸으로 그리지 않는다
(2026-08-31).

대기 카드 문구는 서버가 보내는 실제 단계다. `generate_model_look_image(stage=…)`가
`prep`(기준 인물·옷장 사진 준비) → `dress`(images.edit 호출) → `finish`(4:5 크롭)
→ `save`(업로드)를 `{"_look":{"id","stage"}}`로 흘리고,
`09-app.jsx` `markStage`가 `LB_DATA.LOOK_STAGE[id]`에 넣는다. `LookPendingMarks`는
그 키만 보고 그린다. 타이머로 문구를 돌리지 않는다 — 진짜 단계와 안 맞았다.
픽토그램은 가운데 원이 아니라 문구 앞 sparkle 하나다. 경과 초는 붙이지 않는다
(2026-09-02).

`hydrateOutfits`가 DAILY를 새 객체로 갈아끼우면 착장 URL이 옛 객체에만 붙는다.
`paintLook`은 `LB_DATA.DAILY`를 id로 찾아 쓰고, hydrate는 로컬 lookImg를 보존한다
(2026-08-30). 설정 `modelLook`은 계정 prefs에 있고 리셋은 코디 행만 지운다.

배경은 레퍼런스 스튜디오 그대로다. 카드 색(`#E5E3DE`)으로 맞추라고 시키지 않는다 —
단색을 강요하면 그라데이션이 얼룩진다([[look-plate-shadow]], 2026-09-02).
카드 안에 더 작은 회색 사각형이 생기면 안 된다는 규칙은 그대로다(2026-08-30).

시드 JPG(`backend/assets/look-identity/{m,f}.jpg`)가 곧 캐논이고 그대로 Image 1이다.
예전에는 시드가 실제 룩북 모델이 아니라 한 번 더 젊게 edit해서 썼는데, 그
과정이 얼굴과 비율을 흔들었다. 남성 시드를 제대로 된 컷으로 갈면서
(`assets/mood/남자 코디 레퍼런스.png`) 그 단계를 없앴다 — 유료 호출 한 번과
첫 착장 지연이 같이 사라졌다(2026-09-02). 성별 미지정만 생성으로 내려간다.

댄디·미니멀처럼 남녀가 한 장에 있는 무드 컷은 인물 입력이 아니다. 이전 착장
결과는 다음 생성의 reference로 쓰지 않는다. 옷장 실물 컷은 격자 보드가 아니라
Image 2+로 붙인다. 캐시 `model-id-v11-` / `model-id14-`(2026-09-02). 프롬프트는
outfit replacement: 인물·스튜디오·포즈 고정, 옷만 교체.
나이·키·비율은 레퍼런스대로 둔다. 20대 초중반으로 만들라거나 7등신으로 맞추라는
규칙은 뺐다 — 레퍼런스가 이미 맞는 모델이라 그 지시가 얼굴만 흔들었다(2026-09-02).
위아래 15%는 빈 스튜디오(4:5 크롭용). 하의는 긴 기장이 기본.
후처리는 4:5 자르기뿐이다(`_crop_look_to_card`). 인물이 창보다 크면 축소해 넣고,
남는 자리는 단색이 아니라 이미지 가장자리 줄을 늘려 메운다. 카드는 cover로 채운다.

첫 추천의 마지막 칸은 옷장에 없는 아이템(`wish_combos` 최소 1). wish가 이미
있는 자리(신발 위 신발)면 `_apply_wish_slot`이 옷장 쪽을 빼거나 빈 자리로
돌린다. 착장 프롬프트는 제안 아이템을 반드시 입힌다. hydrate가 제안 아이템을
ALL에 넣지 않으면 상세에 옷장만 보였다. 오늘 코디는
`POST /api/live/outfits/daily/reset`에 화면 id를 실어 저장 여부와 관계없이 지운다.
카드를 먼저 비우고, hydrate가 옛 id를 다시 그리지 않게 한다.
크레딧 잔액으로 장 수를 자르지 않는다.
`wish_combos`는 추천 시점에 서버가 쿼타를 채운다. 모델이 빼먹어도 빈 자리
(신발·가방 등)를 제안으로 넣는다(`_fill_wish_quota`, 2026-08-30).

근거: `backend/app/main.py` `_model_look_outfit_block`, `_model_look_prompt_with_reference`,
`_apply_wish_slot`, `generate_model_look_image`; `frontend/src/proto/05-screens-cde.jsx`
`LookPendingMarks`; `frontend/src/proto/proto.css` `--thumb-bg`.
