# Log

Append-only. Newest at the bottom. Format: `## [YYYY-MM-DD] ingest|query|lint | title`

## [2026-08-17] lint | wiki bootstrapped
Empty scaffold created. No pages yet. Next: `ingest` the wardrobe and combo-recommendation
subsystems so sessions can start from the index instead of reading `frontend/src/proto/`.

## [2026-08-17] ingest | 큰 화면 레이아웃 + 구매처 칩 스크롤
[[large-display-layout]], [[recent-tag-field-scroll]] 작성. 두 건 모두 브라우저 실측으로
확인(1280x1600 랜딩, 390x844 등록 시트). `AI_TEST_MODE=1`로 잠시 바꿔 등록 플로우를
무과금으로 통과한 뒤 `0`으로 복구.

## [2026-08-22] ingest | 모바일 UX 묶음
이미지 뷰어 핀치([[image-viewer-gestures]]), 상세 시트 칩 행 세로 스크롤([[chiprow-sheet-scroll]]),
요금제 무료+광고 카피([[plan-sheet-free-ads]]). 같은 패스에서 홈 FAB·검색 헤더, PTR,
스타일 WebP, 바로보기 문구, 설정 시트 헤더 통일.

## [2026-08-22] query | 요금제 광고 카피
화면에 「광고는 아직 거의 없고…」를 쓰지 않는다. 무료 카드 항목 `광고 포함`만.
[[plan-sheet-free-ads]]

## [2026-08-22] ingest | 마이페이지 사용량 + 옷장 헤더 + 바로 보기
사용량을 계정 카드에 합침([[mypage-usage-in-account]]). 선택 모드 GNB 폭 고정
([[wardrobe-select-header]]). 추가 시트 CTA `옷 대보기` → `바로 보기`.

## [2026-08-23] ingest | 사용량 반응형 + 크레딧 50 + 키/몸무게
사용량 PC 인라인/모바일 카드 분리, 무료 50크레딧([[mypage-usage-in-account]]).
버전은 날짜만. 키·몸무게 행 분리, 착장 프롬프트에서 체형 문구 제거
([[profile-height-weight]]). 같은 사실을 `.cursor/skills/lookbox-mypage`와
`.cursor/rules/mypage-billing.mdc`에 심음(로컬 에이전트용).

## [2026-08-23] ingest | 추천 프롬프트에서도 체형 제거
`_profile_block`의 키·몸무게 문장을 뺀다. 그림뿐 아니라 코디 설명에도 체형을
넣지 않는다. [[profile-height-weight]]

## [2026-08-23] ingest | 무드 6종 추가
블록코어·바디핏·비즈니스 캐주얼 + 여성 전용 걸리시·글램·페미닌.
카드 WebP와 `_STYLE_IDS`를 맞춤([[mood-groups]]).

## [2026-08-23] ingest | Vercel 푸시 메일
푸시 메일은 vercel[bot] GitHub 댓글. `frontend/vercel.json` `github.silent`
([[vercel-github-silent]]).

## [2026-08-23] ingest | 아이템 추가 여러 URL
URL은 한 줄에 하나. 호스트 중복 표시를 없앰. 주문내역 크롬 UX는 앱 밖
`tools/order-collector` ([[add-item-bulk]]).

## [2026-08-23] ingest | URL 상품컷 조회
`robot`이 robots 메타에 걸려 브랜드몰을 차단으로 오인. 카페24 big 컷을
케어가이드보다 앞에 ([[url-import-fetch]]).

## [2026-08-23] ingest | 구매내역 탭
구매내역은 시트에 보인다. 모바일은 PC 안내만, PC는 수집기 명령 + JSON 붙여넣기
([[add-item-bulk]]).

## [2026-08-23] query | Lookbox 리네임 30후보
bin·bag·실사이트·알려진 상표/앱 제외 후 shortlist 30. KIPRIS 공식 전수 아님.
[[rename-candidates-2026-08]].

## [2026-08-23] query | 리네임 2라운드(warm)
cube/rack이 안 와닿아 pocket·drawer·daily·feel 계열 30 추가. 동일 페이지.
[[rename-candidates-2026-08]].

## [2026-08-23] query | 리네임 3라운드(concept)
Look 고정 해제. Softcloset·Moodpocket·Wardhabit 등 페르소나형 30.
[[rename-candidates-2026-08]].

## [2026-08-23] ingest | 상품컷 흰 테두리
어두운 폴로 실루엣에 JPEG 링잉이 불투명 판색으로 남음. 고대비만 혼합대 흡수,
상품컷은 side여도 누끼 ([[studio-cutout-fringe]]).

## [2026-08-23] ingest | 구매내역 원클릭
명령 복사 대신 쇼핑몰 칩 + 버튼. 확장은 로그인될 때까지 기다리고, 로컬 API는
수집기 크롬을 띄운다 ([[add-item-bulk]]).

## [2026-08-23] ingest | URL 탭 단건 + 카페24 중복
URL 탭은 다시 주소 한 칸. `product_no`가 빠지면 포터리 상품이 전부 같은 주소로 보인다.
pending 초안은 옷장 GET에 안 나와도 중복 색인에 남아 재등록을 막았다 ([[url-import-fetch]], [[add-item-bulk]]).

## [2026-08-23] ingest | 추가 시트 탭 높이
사진·URL·구매내역은 168px 스테이지를 공유한다. 구매내역 안내는 한 줄, 푸터는
「내역 확인 후 고른 옷만 옷장에 담아요」 ([[add-item-bulk]]).

## [2026-08-23] ingest | 세로 상세컷 정면 칸
카페24식 앞·뒤·디테일 이어붙인 사진은 정면 전신만 잘라 등록한다 ([[stacked-product-hero]]).

## [2026-08-23] ingest | URL 여러 칸 + 구매내역 연결 시트
URL 탭은 +로 입력칸을 늘리고 박스가 커지면 안에서 스크롤한다. 구매내역 박스는 추출 힌트 자리까지 키운다. 연결 안내는 시트 본문이 아니라 별도 모달에서 허용·저장·확인 버튼만 누른다 ([[add-item-bulk]]).

## [2026-08-23] ingest | URL 탭을 한 줄 입력칸으로
배포본 URL 탭은 여러 줄 textarea였다. 로컬에서 한 줄 `input`(높이 48)으로 되돌리고,
168px 스테이지의 나머지는 테두리 없는 빈 칸으로 둬 탭 전환 때 시트 높이가 안 변하게 했다 ([[add-item-bulk]]).

## [2026-08-23] ingest | 요금제 크레딧 · 착장 · 바로 보기
요금제 시트에 작업별 크레딧을 다시 넣었다([[plan-sheet-free-ads]]). 착장 토글은 무료에서도
장당 5크레딧으로 열리고, 이미 받은 코디에도 lookImg를 채운다([[model-look-toggle]]).
마이페이지 바로 보기는 토스트만 반복하지 않고 설정 시트를 연 채 이미지를 보여 준다([[tryon-setup-from-mypage]]).

## [2026-08-23] ingest | 담기 버튼 복구
URL로 상품이 떠도 `register`에 「담고 완료」가 없었다. `ConnectOrdersModal`을 AddSheet 안에 넣으며 버튼을 지운 탓이다. 바닥에 다시 붙였다 ([[add-item-bulk]]).

## [2026-08-23] ingest | 담기 CTA 독 + 가격·재질
sticky는 시트 안에서 묻혔다. 「담고 완료」·상세 「저장」을 `.lb-sheet-dock`으로 스크롤 밖에 고정했다 ([[add-item-bulk]]). 선택 입력에 가격·재질을 계절과 구매처 사이에 넣었다 ([[item-optional-fields]]).

## [2026-08-23] ingest | CTA 고정을 되돌림
상세 「저장」과 추가 「담고 완료」를 다시 상세 정보 아래(본문 스크롤 안)로 되돌렸다. 독·sticky 없음 ([[add-item-bulk]]).

## [2026-08-23] ingest | URL 가격·재질 프리필
URL 담기는 브랜드처럼 상품 HTML에서 가격·재질을 읽어 등록 칸에 넣는다. JSON-LD·메타·카페24 표. 없으면 빈 칸 ([[item-optional-fields]] [[url-import-fetch]]).

## [2026-08-23] ingest | 바로 보기 공짜 안내 삭제
요금제 시트 작업별 크레딧 아래 「바로 보기 이미지는 크레딧을 쓰지 않아요」를 뺐다 ([[plan-sheet-free-ads]]).

## [2026-08-23] ingest | 바로 보기 설정 팝업 원복
설정 바로 보기는 상의·하의 지우기 시트가 아니라 원래 사진 올리기 탭이다. 프사가 있으면 미리보기만 전신으로 바꾼다. 옷 구멍은 카메라가 뚫어 매장에서 옷을 대 보는 느낌이 나게 한다 ([[tryon-setup-from-mypage]]).

## [2026-08-23] ingest | 바로 보기 빈 칸 + 조합 CTA 여백
바로 보기 탭은 저장된 전신을 미리 넣지 않는다. 조합 추천받기·바로 보기 CTA 아래 빈 힌트 칸을 빼고 입력 단계 하단 패딩을 줄였다 ([[tryon-setup-from-mypage]] [[add-item-bulk]]).

## [2026-08-23] ingest | 착장은 룩북 모델, 배경은 상품 카드 회색
추천 코디 AI 착장은 프로필 얼굴·체형을 쓰지 않고 성별만 맞춘 무신사 룩북 모델로 그린다. 머리·발 여백. 배경은 `--thumb-bg` `#E5E3DE`로 통일하고 두 톤 판을 평탄화한다 ([[model-look-toggle]]).

## [2026-08-24] ingest | 바로 보기 박스 높이 + 설정 정리
바로 보기 업로드 칸을 추출 힌트 줄까지 키워 조합 추천받기 탭 높이를 맞춘다 ([[add-item-bulk]]). 설정에서 룩북 비용 문구와 바로 보기 행을 뺀다. 착장은 프로필이 아니라 룩북 모델이다 ([[tryon-setup-from-mypage]] [[model-look-toggle]]).

## [2026-08-26] ingest | 사용량 캐시 + 어드민 재지급
사용량은 계정 캐시를 먼저 보여 주고 서버 값으로 덮는다. `jsharrykim@gmail.com`만 잔액 0이면 50을 다시 넣는다 ([[mypage-usage-in-account]]).

## [2026-08-26] ingest | 키·몸무게 라벨 굵기
계정 수정 시트에서 키·몸무게만 700이었다. `NumberSlider`를 성별·연령대와 같은 12/600으로 맞춘다 (`02-shared.jsx`). ([[profile-height-weight]])

## [2026-08-26] ingest | 바로 보기는 계정 프사
조합 추천받기 바로 보기 탭은 `prefs.avatar` 원형. PC는 모바일 전용 안내만, 모바일은 프사 있으면 카메라를 연다. 없으면 올리기. 시트 높이는 탭과 같다 ([[tryon-setup-from-mypage]] [[add-item-bulk]]).

## [2026-08-30] ingest | URL 중복은 주소·코드·사진만
이름/브랜드 유사(`same_name` 등)로 등록을 막던 분기를 제거. '이름이 거의 같아요'로 색 변형·별개 상품이 막히던 케이스. 중복은 주소·상품코드·동일 사진만 ([[url-import-fetch]]).

## [2026-08-30] ingest | URL 재질은 숨은 상세·혼용률도
표/JSON에 없어도 본문·상세 팝업 HTML·스크립트에 `Outshell: Cotton 100%` / `면 60%`가 있으면 채운다. AJAX-only 상세는 한계 ([[item-optional-fields]] [[url-import-fetch]]).

## [2026-08-30] ingest | URL 여러 개 후보 목록 복구
URL 2개 이상 제출 시 `bulk`만 세우고 입력칸을 비워 빈 URL 탭+비활성 「N개 담기」로 멈춘 것처럼 보였다. 후보 UI를 URL 탭에도 그리고, 담기 버튼이 `runBulk`를 치게 했다 ([[add-item-bulk]]).

## [2026-08-30] ingest | URL 여러 개는 확인 담기가 기본
후보에서 고른 뒤 기본은 pending 추출 → 사진과 같은 하나씩 확인. 「확인 없이 바로 담기」체크(기본 off)일 때만 일괄 owned. URL 탭 전역 붙여넣기 ([[add-item-bulk]]).

## [2026-08-30] fix | 오늘 코디 4칸·착장 일관성
`06-today.jsx`가 `wish-*` 코디를 옷장 미보유로 걸러 3칸만 보이던 버그 → `filterDailyOutfitsByOwned` 공유. 첫 추천 후 4칸 미만이면 같은 날 top-up. 착장은 참조 모델 캐시·판 평탄화 확장 ([[model-look-toggle]]).

## [2026-08-30] fix | 지난 날짜 코디 히스토리 계정 동기화
히스토리 정본을 서버 `outfits.metadata.for_date`(없으면 `created_at` 보정)로 두고, 로그인 시 `/api/live/outfits`로 날짜별 기록을 채운다. localStorage는 캐시·`wornIds`용. `06-today`는 `dailyTick`으로 서버 동기화 후 캘린더가 갱신된다.

## [2026-08-30] fix | 착장 high 품질·조합 먼저·격자 잔상
착장은 추출 착용컷과 같은 high. 조합 API는 목록만 반환하고 looks를 이어서 병렬 생성. 옷 참고는 상단 스트립, 끊긴 판 조각 평탄화, `[timing] recommend`/`model-look` 로그 ([[model-look-toggle]]).

## [2026-08-30] fix | 착장 카드가 줌에 안 줄어들던 점
`lookImg`를 flex 자식으로 두면 1024px `min-width: auto`가 카드·뷰어 줌을 무시한다. 절대배치 + max 100% ([[look-img-flex-min]]).

## [2026-08-30] fix | 서버에 오늘 코디가 없으면 로컬 캐시를 비운다
`hydrateOutfits`가 오늘 목록이 있을 때만 캐시를 써서, 서버에서 오늘 코디를 지워도 `lb_daily_outfits_v3`와 history merge가 착장을 다시 그렸다. 없으면 DAILY·캐시·그날 히스토리를 덮어쓴다.

## [2026-08-30] fix | AI 착장 토글 켜도 옷 컷아웃만 보이던 점
`refreshLive` 후 `dailyAllowed`가 true면 오늘 탭이 `applyModelLooks`를 스킵했다. `dailyTick` effect로 looks API를 탄다 ([[model-look-toggle]]). 마이페이지 추천 코디 하위 설정은 ㄴ 들여쓰기로 묶음.

## [2026-08-30] fix | 착장 동일 인물·설정 그룹·제안 코디
착장은 기준 모델 한 장을 만든 뒤 옷만 입힌다. 크레딧 잔액으로 장 수를 자르지 않아 4장 중 2장만 나오던 걸 막는다. 설정 하위는 iOS식 안쪽 그룹. 제안 아이템은 필터 전에 ALL에 넣고 모자라면 한 장 더 받는다 ([[model-look-toggle]]).

## [2026-08-30] fix | 추천 코디 하위 설정은 ㄴ 들여쓰기만
박스·세로선 없이 부모 아래 `ㄴ` + 왼쪽 여백 24px. 켜져 있을 때만 보임 (`08-mypage.jsx`).

## [2026-08-30] fix | 착장은 한 장씩 스트림, 점선 박스는 옷 위에 안 겹침
Render가 착장 JSON을 ~100초에 끊어서 서버엔 이미지가 있는데 화면은 컷아웃만 남았다. keepalive SSE로 한 장씩 그린다. 제안 아이템 점선은 우하 칸 ([[model-look-toggle]]).

## [2026-08-30] fix | 착장 URL이 화면 객체에 안 붙던 점
서버 `look_image_url`은 생겼는데 hydrate가 DAILY를 새 객체로 바꿔 컷아웃만 남았다. id로 붙이고, 만드는 중 오버레이 ([[model-look-toggle]]).

## [2026-08-30] fix | 착장 품질 — gpt-image-2 단일 edit, mood 배경
옷 보드 2장 입력이 격자·깨짐을 유발했다. ChatGPT 무드 룩북처럼 기준 인물 1장만 edit하고
옷은 텍스트로 기술. `OPENAI_IMAGE_MODEL_LOOK` 기본 gpt-image-2, 배경 `#ACA7A4`(mood 평균),
캐시 `model-id3-`/`model-id-v3-`, 장당 10크레딧 ([[model-look-toggle]]).

## [2026-08-30] fix | 프사는 계정 스토리지로 동기화
data URL을 metadata에서 빼서 올린 기기에만 보였다. 스토리지에 올리고 `prefs.avatar`에
URL만 붙인다. 기기에 남은 data URL은 로그인 시 한 번 올린다 ([[profile-avatar]]).

## [2026-08-30] query | 바로 보기 원가 구간
비용은 `POST /api/live/tryon/body` `images.edit` 한 번뿐. 오늘 실측 $0.108
(gpt-image-1 medium). 카메라·punchBody $0. 캐시 `tryon2-`·월 5회 ([[tryon-setup-from-mypage]]).

## [2026-08-30] query | 오늘 OpenAI 원가
`ai_usage_logs` 35회(jsharrykim, KST). 실측 $0.26(분류 3·추천 7·바로보기 1).
착장 22+기준인물 2는 usage 없음 → 과거 gpt-image-1 실측으로 추정 $6.07.
합계 약 $6.32. 사진 AI 추출 0건 ([[ai-usage-cost]]).

## [2026-08-30] fix | 모바일 확대·빈 화면 가운데·바로 보기 구멍
iOS가 13px 검색창으로 페이지를 확대하고 기억했다 ([[mobile-page-zoom]]). EmptyState는
가짜 상단바 패딩을 빼 콘텐츠 칸 가운데 ([[empty-state-center]]). 바로 보기 구멍은
옷 픽셀에 맞추고 양옆은 막으며 카메라 전환은 뺀다 ([[tryon-setup-from-mypage]]).

## [2026-08-30] fix | 착장 배경 한 장·무드 인물
옷장·코디 `--thumb-bg`를 `#E5E3DE`로 되돌리고 착장 카드 패딩을 빼 상자 안 상자를
없앤다. 기준 인물은 무드 사진(`backend/assets/look-identity`) edit, 순한 인상·흰 옷
과노출 금지, 캐시 `model-id4-`/`model-id-v4-` ([[model-look-toggle]]).

## [2026-08-30] fix | 무드 원본·옷 실물·wish 쿼타
착장은 무드 JPG를 다시 그리지 않고 옷장 컷을 별도 입력으로 붙인다. 하의 긴 기장.
`wish_combos`는 `_fill_wish_quota`가 추천 시점에 채운다. 캐시 `model-id5-`
([[model-look-toggle]]).

## [2026-08-31] fix | 착장은 outfit replacement — canonical 고정, 옷만 교체
남성 기준 인물을 룩북 전신으로 교체(`look-identity/m.jpg`). 프롬프트는 캐릭터 생성이
아니라 옷 교체. Image 1=인물, Image 2+=옷장 실물. 무드·라벨을 looks API로 넘김.
캐시 `model-id6-` / `model-id-v6-` ([[model-look-toggle]]).

## [2026-08-31] fix | 남·여 canonical을 mood 폴더 예시로 맞춤
`assets/mood/남자 코디 예시.png`·`여자 코디 예시.png`를 look-identity로 쓴다.
댄디·미니멀처럼 남녀 투샷은 인물 입력에서 뺀다. 캐시 `model-id7-` ([[model-look-toggle]] [[mood-groups]]).

## [2026-08-31] fix | 데일리 첫 추천 즉시 카드·착장, 추가 coordinate 제거
첫 coordinate 응답으로 컷아웃을 그리고 looks를 바로 시작한다. 부족분·wish 보충용
추가 추천 호출은 뺀다. 전신은 장당 SSE ([[model-look-toggle]]).

