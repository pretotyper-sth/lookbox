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
품질 테스트 동안만 `LOOK_TEST_LIMIT=1`로 착장 이미지를 1장만 만든다.
실유저는 4장이다. 「테스트 종료」라고 하기 전까지 1을 유지한다. 끄면(`0`)
상품컷 카드가 먼저 뜨고, 착장 대기는 **나온 카드 전부**에 뜨며, 서버가 한 장씩
만들어 SSE `_look`으로 끝나는 카드부터 바꾼다(2026-09-03).
프론트 `LOOK_TEST_LIMIT`와 서버 env가 같다. 제한이 켜져 있으면 **오늘 데일리
코디 전체**에서 센다. 예전엔 요청 payload의 lookImg만 세서 빈 카드를 다시 보내면
요청마다 1장씩 더 나왔다. 서버는 오늘(`for_date`, KST) 착장 URL이 있는 daily 행을
세고 같은 사용자 동시 생성을 막는다(`_filled_daily_looks_today`, `_LOOK_FILLING`).

2026-08-31: 첫 추천 응답이 오면 컷아웃 카드를 바로 그리고 착장을 시작한다.
개수가 모자라도 coordinate를 추가로 돌리지 않는다. wish는 첫 요청의
`wish_combos` + 서버 `_fill_wish_quota`. 전신은 한 장씩 만들고 SSE `_look`으로
카드에 붙인다(`09-app.jsx` `requestDailyOutfits`).

2026-08-30: `refreshLive`가 오늘 코디를 채우면 `dailyAllowed=true`라 오늘 탭이
`requestDailyOutfits`를 건너뛰고 `applyModelLooks`가 안 탔다. `dailyTick` 감시
effect로 `lookImg` 없는 코디를 looks API로 채운다(`09-app.jsx`).

착장 API는 keepalive SSE다. Render는 응답이 안 오면 ~100초에 끊어서, 서버에
`look_image_url`이 있어도 화면은 옷 컷아웃만 남았다. 한 장이 끝나는 즉시
`_look` 이벤트로 카드를 바꾼다. wish는 생성 상품컷이 있으면 카드에 같이 올린다
(2026-09-03).

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
Image 2+로 붙인다. 캐시 `model-id-v11-` / `model-id21-`(2026-09-11). 프롬프트는
outfit replacement: 인물·스튜디오는 고정, 옷과 스탠스만 교체.
시드의 정면 마네킹 포즈·옷 실루엣을 복사하지 않는다 — 그러면 새 옷이 몸에
붙지 않는다. 3/4 스탠스, 무게중심, 주머니 손, 원단이 중력으로 드리운 착용감.
얼굴은 같은 사람이되 룩북 실사(모공·캐치라이트). CGI 매끈함·브랜드 문구·UI는
금지. `✦ AI로 생성`은 생성 픽셀이 아니라 카드·뷰어 오버레이다(한글을 모델에
그리면 깨진다). 색은 `--ink` 76% — `--ink-3`는 스튜디오와 붙는다(2026-09-06).
wish 카드는 상품컷을 기다리며 빈 스켈레톤만 두지 않는다. 옷장 아이템으로
먼저 뜨고, **그리는 중에만** 왼쪽 위에 `제안 아이템을 그리는 중`(`WISH_STAGE`)을
붙인다. 오늘 카드 부제는 `N개 조합` 또는 `N개 조합 · 새 아이템 포함`만. 무드 칩은 안 쓴다.
지난 날짜도 레이아웃은 같다. 「오늘 코디 다시 받기」·「오늘 입기」는 흐리게 두고
누르면 `날짜가 지나서 할 수 없어요`. 그날 입은 코디는 같은 잠금에
`당일 입었음`·초록 톤(2026-09-06).
오늘 카드·상세 레일 제목은 자리 번호 `추천 코디 N`(GPT 카피 쓰지 않음).
`✦ AI로 생성`은 오늘 4:5 카드에만 全文. PC 우측 「오늘의 다른 코디」 레일
(`RailCard`, 1:1)은 `✦`만 — 글자가 잘렸다(2026-09-10). 모바일 카드 배지는 10px.
추가로 받아도 이어서 5, 6이다. 서버 배치 idx가 0으로 돌아가도 화면은
`shown` 순번이 정본이다.
「추가로 코디 추천받기」 스켈레톤 2칸은 그 버튼을 눌러 생긴 `appending` 상태일 때만.
첫 4칸 생성 중이거나 탭을 나갔다 와도 빈 2칸을 붙이지 않는다(2026-09-10).
새로고침에서 캐시 `items`를 다시 심고, wish id는 `wish-{outfitId[:8]}`로 고정한다.
이미지가 있으면 오버레이를 켜지 않는다
(`06-today.jsx` `todayWishDrawing`, `dailyCacheItemsFromOwned`, 2026-09-06).
플랫레이는 잘리지 않게 안쪽 여백을 두고 한 장 PNG로 합쳐 우클릭 복사가 된다.
나이는 레퍼런스대로 둔다. 20대 초중반으로 만들라거나 7등신으로 맞추라는
규칙은 없다. 다리가 패션 일러스트처럼 늘어나면 아주 조금만 짧게 보정한다
(얼굴·옷·스튜디오는 그대로, 2026-09-03).
위아래 빈 스튜디오(머리 위·발끝 아래 18%, `_LOOK_CROP_PAD` 0.12). 하의는 긴 기장이 기본.
생성본에서 정수리·발끝이 여백 없이 닿으면 한 번 재생성한다. 4:5 변환에서 인물이
창보다 크면 머리나 신발을 자르지 않고 전신을 축소하고, 좌우 스튜디오는 부드럽게
메운다. 저장 전에는 인물 밖 회색 스튜디오만 부드러운 세로 그라데이션으로 정리해
바닥 수평선·자글자글한 노이즈를 지운다. 정사각 레일은 이 여백을 이용해 cover로
전신을 채우므로 양옆에 다른 카드 바탕색이 나오지 않는다(`_crop_look_to_card`, 2026-09-11).

첫 추천의 마지막 칸은 옷장에 없는 아이템(`wish_combos` 최소 1). wish는 앞 카드에
넣지 않고 `_pin_wishes_to_tail`이 맨 뒤로 옮긴다. 상의·하의·신발은 옷장에서
채우고, wish가 그 자리와 겹치면 옷장을 지키며 가방 등 빈 자리로 돌린다
(`_apply_wish_slot`, 2026-09-03). wish는 픽토그램이 아니라 `images.generate`로
상품컷을 그려 `img`에 붙인다. 착장 토글이 켜져 있으면 그 컷도 입력으로 입힌다.
hydrate가 제안 아이템을 ALL에 넣지 않으면 상세에 옷장만 보였다. 오늘 코디는
`POST /api/live/outfits/daily/reset`에 화면 id를 실어 저장 여부와 관계없이 지운다.
카드를 먼저 비우고, hydrate가 옛 id를 다시 그리지 않게 한다.
크레딧 잔액으로 장 수를 자르지 않는다.
`wish_combos`는 추천 시점에 서버가 쿼타를 채운다. 모델이 빼먹어도 빈 자리
(신발·가방 등)를 제안으로 넣는다(`_fill_wish_quota`, 2026-08-30).

근거: `backend/app/main.py` `_model_look_outfit_block`, `_model_look_prompt_with_reference`,
`_apply_wish_slot`, `generate_model_look_image`; `frontend/src/proto/05-screens-cde.jsx`
`LookPendingMarks`; `frontend/src/proto/proto.css` `--thumb-bg`.
