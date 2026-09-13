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

## [2026-08-31] fix | 착장 대기 중에도 옷 컷아웃을 가리지 않는다
그리는 중인 카드만 하단 뱃지. 사진 없는 wish 점선 칸은 빼서 옷장 실물만 먼저 보여 준다
([[model-look-toggle]]).

## [2026-08-31] fix | 착장 다리 늘림 제거·카드 4:5 패딩
「다리가 길어 보이게」를 빼고 Image 1 체형·키 비율을 유지. 2:3 생성본을 가장자리
스튜디오색으로 4:5에 맞춰 양옆 `--thumb-bg`가 안 섞이게 함. 캐시 `model-id8-`
([[model-look-toggle]] [[look-img-flex-min]]).

## [2026-08-31] fix | 착장 병렬 + 컷아웃 위 물결만
장당 OpenAI는 그대로고, 순차 대기를 병렬(최대 4)로 줄임. 전환 중 회색 뱃지/레이어
대신 스켈레톤과 같은 `.lb-look-wave` ([[model-look-toggle]]).

## [2026-08-31] fix | 착장 젊게 · 4번째 wish · 오늘 코디 리셋
댄디 옷이 얼굴을 나이 들게 하지 않게 20대 중반으로 읽는다. 첫 추천 마지막 칸에
옷장에 없는 아이템. hydrate가 제안 아이템을 ALL에 넣는다. 오늘 코디 다시 받기
(`daily/reset`). 캐시 `model-id9-` ([[model-look-toggle]]).

## [2026-08-31] fix | 오늘 코디 다시 받기에서 카드가 안 지워지던 것
리셋 전에 캐시가 코디를 되살리고, 저장한 코디·날짜 불일치면 서버 삭제가 0건이었다.
화면을 먼저 비우고 id로 지운다 ([[model-look-toggle]]).

## [2026-08-31] fix | 착장 한 장씩·대기 아이콘·wish 자리 교체
4장 병렬+high를 순차+medium으로 바꿔 첫 장을 앞당긴다. 대기 카드 가운데에
sparkle·인물 원, 좌상단에 작업 문구. 시드는 한 번 젊게 고정(`model-id-v8-`).
다리는 7.5등신, 패딩은 `#E5E3DE`. wish가 같은 자리면 옷장 아이템을 뺀다.
캐시 `model-id10-` ([[model-look-toggle]] [[look-img-flex-min]]).

## [2026-08-31] fix | 착장 카드는 패딩 대신 4:5로 자른다
양옆에 카드색을 덧대지 않는다. 2:3 생성본을 가운데 4:5로 자르고 카드는
cover로 채운다. 캐시 `model-id11-` ([[look-img-flex-min]] [[model-look-toggle]]).

## [2026-08-31] fix | 착장 크롭은 인물을 피하고 여백을 남긴다
프롬프트가 위아래 15% 빈 스튜디오를 요구한다. 자를 때는 인물 박스 기준이고,
창에 안 들어가면 축소해 넣는다. 캐시 `model-id-v9-` / `model-id12-`
([[look-img-flex-min]] [[model-look-toggle]]).

## [2026-08-31] config | 착장 품질 테스트는 1장만
`LOOK_TEST_LIMIT=1`(서버 env + 프론트). 오늘 코디 카드는 여러 개여도 착장
이미지는 한 장만 만든다. 0이면 제한 없음 ([[model-look-toggle]]).

## [2026-09-01] fix | 새로고침마다 네트워크 불안정 토스트
옷장 GET에 JSON 헤더를 붙여 OPTIONS가 Render 슬립에 죽었다. 헤더를 빼고
재시도·/health 깨우기를 넣는다 ([[live-fetch-wake]]).

## [2026-09-02] fix | 착장 대기 문구를 진짜 단계로
2.6초 타이머로 세 문구를 돌리던 걸 걷어냈다. 서버가 `prep/dress/finish/save`를
`_look` 이벤트로 흘리고 카드는 그 키만 그린다. 가운데 픽토그램 두 개는 빼고
sparkle 하나를 문구 앞에 붙였다 ([[model-look-toggle]]).

## [2026-09-02] fix | 신발 옆 깨짐은 프롬프트가 아니라 판 정리였다
`_flatten_look_plate`가 접지 그림자까지 판 색으로 못박아 계단 경계를 만들었다.
밝은 쪽만 못박고 어두운 쪽은 배경 보정량만큼 평행이동한다. 훼손 픽셀 1359→175
([[look-plate-shadow]]).

## [2026-09-02] change | 룩북 모델 키를 낮췄다
7~7.5등신 → 7등신(최대 7.25), "평균 키의 한국 성인, 런웨이 모델 아님".
캐시 `model-id-v10-` / `model-id13-` ([[model-look-toggle]]).

## [2026-09-02] change | 데스크탑 코디 상세 레이아웃
왼쪽 사진 / 오른쪽 가로 한 줄 코디 레일 + 그 아래 품목. 1440x900에서 코디
목록이 접혀 스크롤해야 보이던 걸 없앴다 ([[detail-wide-layout]]).

## [2026-09-02] perf | 착장 지연의 실제 출처를 쟀다
프롬프트(3.9KB)는 범인이 아니다. 입력 이미지 최대 7장 + 1024x1536이 대부분이다.
옷장 사진 다운로드를 병렬로 바꾸고, `[timing] model-look`에 단계별 시간을 붙였다.
`_flatten_look_plate`는 로컬 1.85s — 아직 안 고쳤다 ([[look-latency]]).

## [2026-09-02] fix | 가로 레일 카드가 예전 격자보다 작았다
`width:148px` 고정 → `flex:1 0 148px` + `maxWidth:188px`. 격자의 `1fr`이 칸을
늘려 코디 4개일 때 한 칸이 약 187px였다 ([[detail-wide-layout]]).

## [2026-09-02] fix | 신발 깨짐의 진짜 원인은 판 평탄화 자체였다
앞선 두 번(칠하기 → 평행이동)은 임계값만 옮긴 수정이라 띠 위치만 바뀌었다.
`_flatten_look_plate`를 삭제하고 배경은 레퍼런스 스튜디오를 그대로 둔다.
같은 신발 영역 얼룩 비율 13.6% → 1.9% ([[look-plate-shadow]]).

## [2026-09-02] change | 남성 canonical 레퍼런스를 실제 룩북 컷으로 갈았다
`assets/mood/남자 코디 레퍼런스.png` → `backend/assets/look-identity/m.jpg`.
시드를 한 번 더 젊게 edit하던 단계를 없앴다 — 유료 호출 한 번과 첫 착장 지연이
사라진다. 20대 초중반·7등신 강요 문구도 뺐다. 캐시 `model-id-v11-` / `model-id14-`
([[model-look-toggle]]).

## [2026-09-02] change | 설정·구매내역 안내 문구
새 아이템 포함 코디 힌트는 칸 수와 무관하게 「옷장에 없는 아이템을 넣어요」.
구매내역 유휴 안내는 「먼저 원하는 쇼핑몰을 골라주세요.」 (`08-mypage.jsx`, `04-screens-ab.jsx`).

## [2026-09-02] change | 구매내역 zip 제거, 몰 탭이 곧 세션
`ConnectOrdersModal` zip 설치와 모바일 「컴퓨터에서만」 잠금을 없앴다. 몰을 누르면
`OrderImportSession`이 바로 뜨고, 불러오기가 주문내역을 읽어 그리드에 쌓는다
([[order-import-webview]], `order-import-session.jsx`).

## [2026-09-02] change | 구매내역은 선택 후 CTA, 불러오기는 로그인부터
몰 칩은 고르기만 하고 「주문 내역 가져오기」로 세션을 연다. 세션은 이름+두 줄
안내+불러오기만. 가짜 로고와 동작 없는 뒤로/새로고침은 뺐다. 불러오기는
크롬 로그인 창을 연 뒤에야 옷을 찾는다 ([[order-import-webview]]).

## [2026-09-03] query | 오늘 코디 「최대 10초」는 거짓, 08:20 실측 14.7s+59s
오늘 코디·룩북에서 「최대 10초」 카피를 뺐다. 2026-09-03 08:19 KST 요청은
상품컷 조합 14.7초(옷장 47, 4콤보) 뒤 카드가 한 번에 뜨고, 첫 착장은 +59초.
카드 1개씩 상품컷 스트리밍은 없다. [[look-latency]]

## [2026-09-03] change | 레일 카드 동일 폭, 착장 1장 제한 구멍, 다리 아주 조금
상세 레일은 flex intrinsic 때문에 칸이 제각각이었다. `1 1 148px`+overflow hidden.
`LOOK_TEST_LIMIT`는 오늘 daily 착장 수를 센다(요청마다 have=0이던 구멍).
다리는 패션 일러스트처럼 늘어나면 조금만 짧게. 캐시 `model-id15`. 품질·스튜디오는 그대로.
[[detail-wide-layout]] [[model-look-toggle]]

## [2026-09-03] note | 착장 1장은 품질 테스트용, 실유저는 4장 순차 전환
`LOOK_TEST_LIMIT=1`은 「테스트 종료」 전까지만. 끄면(0) 상품컷 카드마다 대기,
SSE로 끝나는 장부터 착장. 실유저 기본은 4장. [[model-look-toggle]]

## [2026-09-03] change | 바로 보기 구멍·얼굴·배경 단색
양옆은 `#F2F1EE` 고정이 아니라 생성본 모서리 색. 하의 밑단까지 뚫고 마스크 블러.
전신 프롬프트는 얼굴 고정·배경 한 색·비율만 조금. 캐시 `tryon3-`.
[[tryon-setup-from-mypage]]

## [2026-09-11] fix | AI 착장 전신 보존·데일리 코디 다양화
AI 착장은 `model-id18`로 캐시를 갱신했다. 생성본의 정수리·발끝이 경계에 닿으면 한 번 재생성하고, 4:5 카드가 세로로 긴 전신을 만났을 때는 머리 우선 크롭 대신 전체를 축소해 발끝까지 남긴다. 프롬프트는 무드 레퍼런스의 균형 잡힌 전신·매끈한 스튜디오를 강제하며, 장다리·거친 좌우 배경을 금지한다. 데일리 추천은 최근 7일의 상·하의(또는 원피스) 골격을 제외해 신발·가방만 바꾼 반복 코디를 새 추천으로 보지 않는다.
근거: `backend/app/main.py` `_look_needs_reshoot`, `_fit_look_to_card`, `_recent_daily_exclusions`, `fallback_combos`.
[[model-look-toggle]]

## [2026-09-11] fix | AI 픽셀 후처리·레일 크롭 회수
정사각 레일 `cover`는 전신의 머리·발을 잘라서 제거했다. 레일 자체를 4:5로 맞추고
원본을 contain으로 보인다. 배경선을 없애려던 픽셀 단위 평탄화도 결과 질감을 깨뜨릴 수
있어 제거했다. 새 생성은 프롬프트의 매끈한 스튜디오 규칙만 따르고 원본 AI 픽셀을
보존한다. 캐시 `model-id22`.
근거: `frontend/src/proto/05-screens-cde.jsx` `RailCard`·`LookComposite`,
`backend/app/main.py` `_crop_look_to_card`.
[[model-look-toggle]]

## [2026-09-11] fix | AI 착장 배경선·정사각 레일 여백
AI 착장 배경은 원래 연회색 톤을 유지하되, 인물 밖 픽셀만 부드러운 세로 그라데이션으로
정리해 바닥 실선과 자글자글한 노이즈를 없앤다. 생성 인물은 4:5에서 위아래 18% 여백을
두고 다리·전체 키를 아주 조금 줄인다. 이 여백 덕분에 정사각 「오늘의 다른 코디」 레일도
cover로 전신을 채워 좌우 다른 바탕색 띠가 보이지 않는다. 캐시 `model-id21`.
근거: `backend/app/main.py` `_smooth_look_backdrop`, `_model_look_prompt_with_reference`;
`frontend/src/proto/05-screens-cde.jsx` `LookComposite`.
[[model-look-toggle]]

## [2026-09-11] change | 코디 판·AI 착장 원래 색감 복원
흰색 상품판과 AI 착장 배경은 과하게 쨍해 모두 이전의 아이보리 상품판·연회색 스튜디오
색감으로 되돌렸다. 흰 배경 캐시는 다시 쓰지 않도록 `model-id20`으로 분리했다. 전신
보존, 우측 레일 contain, 추가 추천 스켈레톤 분리는 유지한다.
근거: `frontend/src/proto/proto.css`, `05-screens-cde.jsx`, `09-app.jsx`,
`backend/app/main.py` `_model_identity_prompt`·`_model_look_prompt_with_reference`.
[[model-look-toggle]]

## [2026-09-03] change | 바로 보기 구멍은 블러가 아니라 옷 실루엣
블러·4px 팽창을 뺀다. 구멍은 옷 픽셀 그대로, 안쪽 핀홀만 1px closing.
하의는 잡힌 폭 그대로 발 아래까지. [[tryon-setup-from-mypage]]

## [2026-09-03] change | 옷장 상품컷은 GPT 없이 바로
앞 칸은 `recommend_closet`(텍스트 페어링). `_ensure_style_attrs`·gpt-4o는
마지막 wish 카드 뒤에. [[look-latency]]

## [2026-09-03] change | 상세 품목 줄 높이 통일
wish 이유 문장을 줄에서 빼 이름·카테고리 두 줄만. `minHeight: 62`. [[detail-wide-layout]]

## [2026-09-03] change | 레일 선택 테두리는 누르자마자 위까지
호버 리프트와 `scrollIntoView`를 빼 위 테두리가 잘렸다 내려오지 않게. [[detail-wide-layout]]

## [2026-09-04] change | 바로 보기 품질·진행·비교 UX
전신은 `gpt-image-2` high, 흰 티·중청·흰 스니커즈, 캐시 `tryon4-`.
서버가 `body/top/bottom/full` 구멍을 만들고 SSE로 단계를 흘린다.
같은 얼굴 캐시는 한도보다 먼저, 신규 성공만 KST 월 2회.
카메라 2:3, 버튼 재클릭은 기본 착장, 하단 CTA 제거, 우상단 리셋 확인.
근거: `backend/app/main.py` `live_tryon_body` `_tryon_make_assets`;
`frontend/src/proto/10-tryon.jsx` `TryOnCameraOverlay`.
[[tryon-setup-from-mypage]] [[profile-avatar]]

## [2026-09-06] change | 착장 포즈·착용감·AI 생성 표기
시드 정면 포즈와 옷 실루엣을 고정하던 규칙을 뺐다. 3/4 스탠스, 몸에 걸친
원단, 같은 사람의 실사 얼굴. MUSINSA 문구는 생성하지 않고 카드에
`✦ AI로 생성`. 캐시 `model-id16`.
근거: `backend/app/main.py` `_model_look_prompt_with_reference`;
`frontend/src/proto/05-screens-cde.jsx` `LookComposite`. [[model-look-toggle]]

## [2026-09-06] change | 추천 속도·wish 안내·복붙·비상식 코디
스트림을 열기 전에 옷장을 읽던 TTFB를 없앤다. wish 카드는 먼저 붙이고
`제안 아이템을 그리는 중`을 띄운다. 플랫레이는 한 장 이미지라 우클릭 복사.
셔츠+카고+첼시는 감점. [[look-latency]] [[coord-clash]]

## [2026-09-06] change | 바로 보기 얼굴·기본옷·카메라 초회
전신은 프사 본인 실사, 차콜 반팔·중청·흰 스니커, 4% 여백. 캐시 `tryon5-`.
흰 티는 판과 붙어 톱니가 나서 마스크를 차콜 기준으로 바꿨다.
착장 칩은 옷만(카메라 없음). 상의·하의·전체에서만 카메라를 켠다.
근거: `backend/app/main.py` `_TRYON_BODY_PROMPT` `_tryon_seed_component`;
`frontend/src/proto/10-tryon.jsx` `TryOnCameraOverlay`. [[tryon-setup-from-mypage]]

## [2026-09-06] fix | wish 안내 문구는 그리는 중에만
새로고침마다 `제안 아이템을 그리는 중`이 다시 뜨던 건, 이미지 없는 wish를
생성하는 중으로 본 탓이다. 스테이지가 있을 때만 띄우고 `wish-*`는 ALL에서
지우지 않는다. [[model-look-toggle]]

## [2026-09-06] change | 플랫레이 소품은 가방에 묻히지 않게
검정 선글라스가 검정 가방 한가운데에 같은 크기로 앉지 않게. 소품은 작게
모서리로, 같은 톤이 겹치면 테두리. [[look-flatlay-overlap]]

## [2026-09-06] fix | 착장 확대 위아래가 thumb-bg와 붙던 것
뷰어 lookImg는 4:5 스테이지+cover. 생성은 위아래 18% 스튜디오, 크롭 패드 0.12.
`✦ AI로 생성`은 `--ink` 76%라 스튜디오에서도 읽힌다.
근거: `frontend/src/proto/02-shared.jsx` ImageViewer; `backend/app/main.py` `_LOOK_CROP_PAD`.
[[look-img-flex-min]] [[image-viewer-gestures]]

## [2026-09-06] fix | wish 카드 새로고침마다 다시 그리던 것
캐시 복원이 ALL만 봐서 제안 아이템이 빠지고, 서버가 wish id를 바꿔 플랫레이가
다시 조립됐다. 캐시 items를 같이 심고 id를 코디 id에 고정. 오늘 카드는
`추천 코디 N`, 제목 2줄 칸을 없애 부제와 바로 붙인다.
근거: `frontend/src/proto/09-app.jsx` `dailyCacheItemsFromOwned`;
`backend/app/main.py` `persist_combo`. [[model-look-toggle]]

## [2026-09-06] change | 신발은 코디마다 같은 켤레를 반복하지 않는다
댄디·시크에서 첼시만 이기던 건 `max(shoe_score)` 탓이다. 맞는 신발 안에서
이미 쓴 켤레를 감점하고, 격식 충돌이 큰 후보는 돌리지 않는다.
근거: `backend/app/main.py` `_pick_rotating_shoe` `_rebalance_combo_shoes`.
[[coord-clash]]

## [2026-09-06] ops | 오늘 카드 UI는 main에 있어야 실서비스에 보인다
Vercel·Render는 `main`. 피처 브랜치 푸시만으로는 강력 새로고침이 안 먹는다.
[[vercel-github-silent]]

## [2026-09-06] fix | 착장 양끝 띠·추천 번호·룩북 하트
맞추기는 원본 4:5 창. 이미 늘린 이미지는 좌우 9%를 잘라 가린다.
추가 추천은 `추천 코디 5, 6`처럼 이어진다. 룩북 카드는 하트 대신 점 3개로
이름을 고치고, 빼기는 선택 모드만.
근거: `backend/app/main.py` `_fit_look_to_card`;
`frontend/src/proto/06-today.jsx` `dailyLooks`;
`frontend/src/proto/05-screens-cde.jsx` `SavedCard`.
[[look-img-flex-min]] [[lookbook-card]] [[model-look-toggle]]

## [2026-09-06] fix | 착장 여백·확대 가운데·플랫레이 테두리·룩북=옷장
좌우 9% 크롭을 걷어 위아래 스튜디오와 확대 가운데를 되돌렸다. 플랫레이는
자리로만 구분하고 흰 발광을 뺀다. 룩북 그리드는 옷장과 같은 +타일·두 줄 카드.
근거: `frontend/src/proto/02-shared.jsx` ImageViewer;
`frontend/src/proto/05-screens-cde.jsx` `SavedCard` `drawLookCutout`.
[[look-img-flex-min]] [[look-flatlay-overlap]] [[lookbook-card]]

## [2026-09-06] fix | 룩북 더보기 시트를 다른 팝업과 맞춤
썸네일+얇은 테두리 버튼이 옷장 더보기 반쪽처럼 보였다. 오늘 다시 받기와
같이 가운데 제목·채운 버튼·취소.
근거: `frontend/src/proto/05-screens-cde.jsx` `LookbookScreen`. [[lookbook-card]]

## [2026-09-06] fix | 시트 빈 상자·PC 룩북 상세
닫을 때 children을 비우면 손잡이만 남은 상자가 깜빡인다. BottomSheet가
닫히는 동안 마지막 내용을 유지한다. PC 룩북 상세는 오늘과 같이 두 칼럼.
근거: `frontend/src/proto/02-shared.jsx` BottomSheet;
`frontend/src/proto/05-screens-cde.jsx` `DetailScreen`.
[[detail-wide-layout]] [[lookbook-card]]

## [2026-09-06] fix | 룩북 선택 해제 시 기본 화면·더보기 빼기
고른 코디가 없으면 선택 모드를 끄고 +직접 만들기를 다시 보여 준다. 더보기에
「룩북에서 빼기」와 같은 확인 시트.
근거: `frontend/src/proto/05-screens-cde.jsx` `LookbookScreen`. [[lookbook-card]]

## [2026-09-06] fix | 룩북 더보기를 옷장 시트와 맞춤
가운데 제목+채운 버튼 대신 옷장처럼 썸네일 헤더와 테두리/테라코타 버튼.
근거: `frontend/src/proto/05-screens-cde.jsx` `LookbookScreen`;
`frontend/src/proto/02-shared.jsx` `ItemRemoveSheet`. [[lookbook-card]]

## [2026-09-06] fix | 모바일 AI 표기·오늘 카드 부제
모바일 `✦ AI로 생성`은 10px. 오늘 카드 부제는 무드 없이 `N개 조합`.
근거: `frontend/src/proto/proto.css` `.lb-look-ai-mark`;
`frontend/src/proto/06-today.jsx` `TodayCard`. [[model-look-toggle]]

## [2026-09-06] fix | 바로 보기 스켈레톤 원형·실패 문구 두 줄
생성 중 스켈레톤을 불상형(64×96, 윗원 아래각)에서 프사와 같은 80px 원형으로 바꿨다.
실패 문구는 지정한 두 줄. PC `wide`는 생성을 안 돌리고, Chrome 검사 모바일은 `innerWidth`가
줄어 전신 생성이 나간다.
근거: `frontend/src/proto/proto.css` `.lb-tryon-skel`;
`frontend/src/proto/04-screens-ab.jsx` `launchTryOnFromSheet`. [[tryon-setup-from-mypage]]

## [2026-09-06] change | 바로 보기 실패를 이유별 두 줄로
시트는 서버·네트워크·한도·사진 이유를 덮지 않고 그대로 보여 준다. 각 문구는
한 줄이 아니라 `\n` 두 줄. 상품 추출 카피는 쓰지 않는다.
근거: `backend/app/main.py` `_TRYON_FAIL_MSG`;
`frontend/src/proto/09-app.jsx` `formatTryOnErr`. [[tryon-setup-from-mypage]]

## [2026-09-06] fix | 모바일 검색 힌트를 PC 크기로
옷장 검색 placeholder만 13.5px. 입력 글자는 iOS 확대 때문에 16px.
근거: `frontend/src/proto/proto.css` `.lb-search-input`;
`frontend/src/proto/04-screens-ab.jsx` `searchField`. [[mobile-page-zoom]]

## [2026-09-06] fix | 룩북을 옷장처럼 캐시·saved=1로 먼저 그린다
전체 `/outfits`를 기다리다가 실패하면 빈 화면이 남았다. 계정 캐시를 먼저 그리고
저장된 코디만 따로 받는다. IN 목록은 80개씩.
근거: `frontend/src/proto/09-app.jsx` `refreshLive`;
`backend/app/main.py` `live_list_outfits`. [[lookbook-card]]

## [2026-09-06] fix | 오늘·룩북 카드 재입장 애니 제거
사이드 메뉴로 다시 들어가면 `display:none→flex` 때문에 rise 애니가 반복됐다.
TodayCard·SavedCard·OutfitCard에서 `lb-anim-in`을 뺀다.
근거: `frontend/src/proto/06-today.jsx` `TodayCard`;
`frontend/src/proto/05-screens-cde.jsx` `SavedCard`. [[lookbook-card]]

## [2026-09-06] fix | 룩북 첫 페인트에서 전체 outfits를 빼다
저장분(`saved=1`)은 착장 URL만 있으면 옷장 join을 안 한다. 전체 목록은
룩북을 그린 뒤에 받는다. 목록은 무료 모델이 아니다.
근거: `backend/app/main.py` `_lookbook_list_payload`;
`frontend/src/proto/09-app.jsx` `refreshLive`. [[lookbook-card]]

## [2026-09-06] fix | 상품컷 플랫레이 크기를 한 덩어리로 맞춤
3장은 작고 4장은 커 보였다. 그린 뒤 bbox를 카드의 78%로 맞춰 여백을 통일한다.
근거: `frontend/src/proto/05-screens-cde.jsx` `packLookRects`. [[look-flatlay-overlap]]

## [2026-09-06] fix | 지난 추천도 오늘과 같은 버튼 자리
다시 받기·오늘 입기를 빼지 않고 흐리게 둔다. 누르면 같은 토스트.
근거: `frontend/src/proto/06-today.jsx` `TodayScreen`. [[model-look-toggle]]

## [2026-09-06] change | 지난 날 입은 코디는 당일 입었음
잠금·토스트는 같다. 입은 카드만 초록 톤으로 `당일 입었음`.
근거: `frontend/src/proto/06-today.jsx` `TodayCard`. [[model-look-toggle]]

## [2026-09-06] change | 상품컷 덩어리를 옛 2번 카드의 95%로
LOOK_PACK 0.78은 작았다. 0.86으로 올려 통일 전 4개짜리 2번 카드에 가깝게.
캐시 `|flat5`.
근거: `frontend/src/proto/05-screens-cde.jsx` `LOOK_PACK`. [[look-flatlay-overlap]]

## [2026-09-06] change | 룩북 상품컷은 LOOK_PACK을 쓰지 않는다
오늘 코디만 0.86으로 맞춘다. 룩북 `SavedCard`는 패킹 전 크기로 그린다.
근거: `frontend/src/proto/05-screens-cde.jsx` `LookComposite` `pack`. [[look-flatlay-overlap]]

## [2026-09-06] change | 오늘 코디 상품컷을 1.03으로 키움
룩북은 그대로. 오늘만 0.86×1.2. 패킹 전 2번 카드의 약 95%. 캐시 `|flat6`.
근거: `frontend/src/proto/05-screens-cde.jsx` `LOOK_PACK`. [[look-flatlay-overlap]]

## [2026-09-06] change | 상품컷 덩어리를 아주 조금만 내린다
기하 가운데가 위로 보였다. 카드 높이의 2.4%만 내려 위아래 여백을 맞춘다.
캐시 `|flat7` `|flat1`.
근거: `frontend/src/proto/05-screens-cde.jsx` `LOOK_NUDGE_Y`. [[look-flatlay-overlap]]

## [2026-09-06] change | 바로 보기 캐시 tryon6, 어드민은 한도 리셋
캐시를 한 번 올린다. `jsharrykim@gmail.com`은 월 2회에 걸려도 횟수를 지우고 다시 만든다.
근거: `backend/app/main.py` `ensure_within_limit` `_reset_free_action_usage`.
[[tryon-setup-from-mypage]] [[mypage-usage-in-account]]

## [2026-09-06] change | 구매내역 웹뷰 로그인 + PC  Dual-pane 담기
세션을 풀스크린에서 가운데 모달 웹뷰로 바꿨다. 로그인 후 주문내역으로 이동하고, CTA를 누르면 옷이 한 줄씩 쌓인다. PC는 왼쪽 웹뷰·오른쪽 카드. 「담기」는 목록이 끝나기 전에 가능하다.
근거: `frontend/src/proto/order-import-session.jsx`, `backend/app/main.py` `ITEM`/`_order`.
[[order-import-webview]]

## [2026-09-06] change | 몰 주문내역 URL 갱신
무신사 첫 주소가 404(`/mypage/orders`)라 아이템 0개였다. [`/order/order-list`](https://www.musinsa.com/order/order-list)로 바꿨다. 29CM·지그재그·W컨셉·SSG·머스트잇도 로그인 리다이렉트가 있는 현재 경로로 맞춤. 더현대 GNB는 비로그인 404.
근거: `frontend/src/proto/order-platforms.js`, `tools/order-collector/platforms.mjs`.
[[order-import-webview]]

## [2026-09-06] fix | 구매내역 창 실패 문구 두 줄·PC 오안내
수집기가 안 열리면 휴대폰용 「컴퓨터에서 다시」가 PC에도 나왔다. 실패는 `\n` 두 줄. PC는 「쇼핑몰 창을 열지 못했어요」. localhost만이 아니라 LAN 주소도 로컬 수집기를 탄다.
근거: `frontend/src/proto/order-import-session.jsx` `formatOrderErr`, `04-screens-ab.jsx` `onThisComputer`.
[[order-import-webview]]

## [2026-09-06] change | 구매내역 로그인을 모달 안에 그림
무신사 로그인은 iframe이 막혀 별도 크롬이 뜨고 있었다. 수집기를 `--embed` 헤드리스로 바꾸고 화면을 모달에 그린다. 클릭·키는 localhost 입력 API로만 전달하고 비밀번호는 저장하지 않는다.
근거: `tools/order-collector/collect.mjs` `--embed`, `backend/app/main.py` `live_orders_input`.
[[order-import-webview]]

## [2026-09-06] fix | 모달 웹뷰 비율·렉
390×720 스크린샷을 contain으로 그려 옆이 비고 잘렸다. 칸 크기로 뷰포트를 맞추고 아이폰 UA, 화면은 로컬 MJPEG로 바로 붙인다. 클릭은 그 포트로 보낸다.
근거: `tools/order-collector/collect.mjs` `startEmbedServer`, `order-import-session.jsx` `/stream`.
[[order-import-webview]]

## [2026-09-06] fix | 모달 웹뷰 스크롤·확대·안내
휠은 커서 위치에서 페이지가 스크롤되게 했다. 핀치/ctrl+휠로 확대. 기본 1.2배. 안내는 「위 화면에서 로그인해 주세요」.
근거: `collect.mjs` `Input.dispatchMouseEvent` mouseWheel, `order-import-session.jsx` footer.
[[order-import-webview]]

## [2026-09-10] change | 바로 보기 확인 단계 + 백그라운드 생성
탭만 누르면 전신을 만들지 않는다. 「프로필 사진으로 전신 바로보기 이미지 만들기」를 본 뒤 칸/CTA를 눌러야 시작한다. 만들던 중 탭·시트를 나가도 요청은 앱에 남고, 다시 들어오면 진행/완료가 보인다. 진행 바 아래 「처음 한 번만 만들면 돼요」. 스켈레톤 원형은 위로 10px.
근거: `04-screens-ab.jsx` `tryOnBodyReady`·`tryOnStayRef`, `09-app.jsx` `tryOnMakingRef`.
[[tryon-setup-from-mypage]]

## [2026-09-10] query | 바로 보기 「다듬지 못했어요」는 타임아웃 아님
실측 화면(2026-09-10 15:49) 「이미지를 다듬지 못했어요」는 OpenAI 생성 후 구멍 마스크 검증 실패. 타임아웃 문구는 「시간이 너무 오래 걸렸어요」. 실패는 캐시되지 않아 구버전은 탭 재진입마다 `images.edit`를 다시 불렀다.
근거: `backend/app/main.py` `_tryon_assets_valid`, 프론트 `timeoutMs: 180000`.
[[tryon-setup-from-mypage]]

## [2026-09-10] change | 바로 보기 92% 실패를 저장으로 바꾸고 시도도 한도에 넣음
구멍 검증이 약해도 전신을 버린다. OpenAI를 부른 요청은 실패여도 월 2회. 같은 계정 동시 요청은 막는다.
근거: `backend/app/main.py` `live_tryon_body` `_TRYON_BUSY`, `note_usage`를 `images.edit` 앞.
[[tryon-setup-from-mypage]]

## [2026-09-10] fix | 바로 보기 품질·일일 실패 + 오늘 코디 버그
구멍 약하면 약 마스크를 저장하지 않고 생성을 한 번 더 한다. 월 2회는 성공만.
실패는 그날 3회. 「추가로 코디」 스켈레톤 2칸은 버튼을 눌렀을 때만. 9월 쪼리 감점.
PC 레일 AI 배지는 ✦만. 착장 4:5는 머리를 남기고, 캐시 `model-id17` / `tryon7`.
근거: `backend/app/main.py` `live_tryon_body`·`_fit_look_to_card`·`_replace_offseason_shoes`;
`06-today.jsx` `fillingMore`.
[[tryon-setup-from-mypage]] [[coord-clash]] [[model-look-toggle]] [[look-img-flex-min]]

## [2026-09-10] query | 착장 얼굴 잘림은 양옆 늘림 제거의 부작용
2026-09-06 `a7f8ddb`가 가장자리 늘림 대신 원본 4:5 창을 쓰면서, 창보다 인물이 크면 발을 맞추러 창을 내렸다. 타이트 생성본에서 얼굴이 잘렸다. 머리 우선으로 바꿨고, 여백이 있으면 다리도 안 자른다.
근거: `backend/app/main.py` `_fit_look_to_card`; 커밋 `a7f8ddb`.
[[look-img-flex-min]] [[look-plate-shadow]]

## [2026-09-11] change | 바로 보기 전신 생성·카메라 화면 정리
바로 보기 생성 캐시를 `tryon8`로 올려 기존 결과를 재사용하지 않게 했다. 생성 프롬프트는 셀카의 기울기를 따르지 않는 정면 포즈와 위아래 6% 여백을 사용한다. 상·하의 투명화 범위를 넓히고 하의 구멍은 신발 윗선 직전에서 멈춘다. 진행 안내를 왼쪽 정렬하고, 카메라 화면의 리셋 아이콘과 하단 설명을 제거했다. 카메라 스트림은 화면을 다시 열 때 재사용해 브라우저 설정 안내가 반복되지 않게 했다.
근거: `frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/10-tryon.jsx`, `backend/app/main.py`.
[[tryon-setup-from-mypage]]

## [2026-09-11] fix | 추천 로딩 카드·AI 착장 배경 통일
추가 추천 스켈레톤은 「추가로 코디 추천받기」를 눌러 생긴 상태에서만 보인다. 모든
스켈레톤과 AI 착장 대기 물결은 페이지 공용 시계로 같은 위상을 쓴다. 상품컷·AI 착장은
흰 바탕으로 통일했고, AI 출력은 행 배경을 흰색으로 정리해 벽·바닥 경계선을 없앤다.
우측 정사각 레일은 AI 착장을 contain으로 그려 전신을 자르지 않는다. 캐시 `model-id19`.
근거: `frontend/src/proto/06-today.jsx` `appending`, `proto.css` shimmer clock,
`05-screens-cde.jsx` `LookComposite`, `backend/app/main.py` `_white_look_backdrop`.
[[model-look-toggle]]

## [2026-09-11] fix | 구매내역 네이티브 WebView·선택 후 상세입력
Electron 데스크톱 래퍼가 쇼핑몰 로그인을 실제 WebView에 띄우고 로그인 뒤 주문내역으로 자동 이동한다. 수집한 옷은 직접 저장하지 않고 선택 후 URL 다건 추가와 같은 상세입력 단계로 넘어간다. 쿠팡은 홈의 로그인 링크를 경유하고 데스크톱 Chrome 요청 헤더를 사용하며, 빈 화면인 브랜디는 지원 목록에서 제거했다.
근거: `desktop/main.cjs`, `frontend/src/proto/order-import-session.jsx`, `frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/order-platforms.js`, `tools/order-collector/platforms.mjs`.
[[order-import-webview]] [[add-item-bulk]]

## [2026-09-11] fix | 모바일 구매내역 아이콘을 기능 의미로 통일
모바일 구매내역은 선택 가능한 탭인데 잠금 아이콘이 탭·안내 카드에 반복돼 별도 잠금 기능처럼 보였다. 탭, 안내 카드, PC 전용 CTA를 모두 구매내역 의미의 `bag` 아이콘으로 통일했다.
근거: `frontend/src/proto/04-screens-ab.jsx`.
[[add-item-bulk]]

## [2026-09-11] change | 웹 구매내역 Chrome 확장 팝업
일반 웹은 확장 프로그램이 520×760 쇼핑몰 로그인 팝업을 연다. 로그인 뒤 주문내역으로 다시 이동하고 상품을 한 개씩 기존 구매내역 모달에 전달하며, 성공하면 팝업을 자동으로 닫는다. 웹과 확장 사이 이벤트는 요청 ID로 묶고 Lookbox 출처에서 온 요청만 처리한다. 확장이 없으면 설치 후 새로고침 안내를 보여준다.
근거: `extensions/lookbox-orders/background.js`, `lookbox-bridge.js`, `frontend/src/proto/04-screens-ab.jsx`, `order-import-session.jsx`.
[[order-import-webview]]

## [2026-09-11] fix | 쿠팡 확장 로그인 반환 주소
쿠팡 확장은 주문내역 URL을 로그인 반환 주소로 넣지 않고, 실제 Chrome에서 확인한 홈 반환 로그인 주소를 연 뒤 인증 완료 시 주문내역으로 이동한다. Akamai `Access Denied` 화면은 주문내역 준비 완료로 오인하지 않고 즉시 안내한다. Lookbox 모달을 닫으면 열어 둔 로그인 팝업도 함께 닫는다.
근거: `extensions/lookbox-orders/platforms.js`, `extensions/lookbox-orders/background.js`, `extensions/lookbox-orders/extract.js`, `frontend/src/proto/04-screens-ab.jsx`.
[[order-import-webview]]

## [2026-09-11] change | 구매내역 확장 등록 준비·직접 이미지 등록·UX 정리
Chrome 확장 v0.3.0은 로그인된 브라우저에서 주문내역 썸네일을 받아 사진 등록 경로로 전달한다. 상품 페이지 서버 요청이 막혀도 이미지·상품명·가격·구매처·출처 URL을 보존하고, 중복은 저장 전에 검사한다. Chrome 안내 모달은 360×310px로 줄이고 목록 CTA를 「취소 / N개 담기」로 바꿨다. 구매내역은 다른 소스 탭을 다녀와도 유지하며 「다른 쇼핑몰」에서만 비운다. 모바일 웹은 PC 전용 안내를 표시한다. 웹스토어용 아이콘·화면·설명·개인정보 처리방침도 준비했다.
근거: `extensions/lookbox-orders/`, `frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/order-import-session.jsx`, `frontend/src/proto/09-app.jsx`, `backend/app/main.py`, `frontend/public/extension-privacy.html`.
[[order-import-webview]] [[add-item-bulk]] [[url-import-fetch]] [[chrome-extension-publish]]

## [2026-09-11] change | 웹스토어 공개 전 구매내역 UX 미리보기
개발 서버와 `?orderDemo=1`은 실제 확장 설치 없이 가짜 로그인·주문내역 6건·선택·순차 상세입력·완료까지 재현한다. 미리보기 데이터는 서버를 호출하거나 옷장에 저장하지 않는다. 로컬 실제 확장 검수는 `?orderReal=1`로 전환한다.
근거: `frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/order-import-session.jsx`.
[[order-import-webview]] [[add-item-bulk]]

## [2026-09-11] change | 웹 구매내역 중첩 모달 제거
Chrome 확장은 로그인 창을 브라우저 팝업으로 따로 열기 때문에 Lookbox 안에 URL 바·로그인 상태를 흉내 낸 두 번째 모달을 띄우지 않는다. 기존 아이템 추가 시트가 「쇼핑몰 로그인 / 주문내역 열기 / 옷 가져오기」 3단계로 바뀌고, 수집 뒤 같은 시트에서 상품 썸네일·구매처·가격·구매일 후보 목록을 보여준다. Electron WebView만 실제 로그인 화면이 필요해 기존 세션 UI를 유지한다.
근거: `frontend/src/proto/04-screens-ab.jsx` `startInlineOrder`·`collectInlineOrders`.
[[order-import-webview]] [[add-item-bulk]]

## [2026-09-12] fix | 구매내역 뒤로가기 초기화·모바일 안내 정리
구매내역 후보의 상세 확인에서 입력 화면으로 뒤로 돌아오면 남아 있던 `done` 단계를 초기화해 쇼핑몰 선택 화면을 다시 보여준다. 모바일 PC 전용 안내에서는 단독 가방 픽토그램을 빼고 문구만 남겼다.
근거: `frontend/src/proto/04-screens-ab.jsx` `goBack`·모바일 구매내역 안내.
[[order-import-webview]] [[add-item-bulk]]

## [2026-09-12] change | 샘플 구매내역을 실제 확장 순서로 수동 진행
샘플 구매내역은 첫 CTA 뒤 결과까지 자동 재생하지 않는다. 사용자가 「로그인 완료 → 주문내역 열기 → 옷 가져오기」를 각각 눌러 확장이 로그인 팝업을 열고 주문내역으로 이동한 뒤 상품을 순차 수집하는 전 과정을 확인한다.
근거: `frontend/src/proto/04-screens-ab.jsx` `startInlineOrder`·`onOrderPrimary`.
[[order-import-webview]] [[add-item-bulk]]

## [2026-09-12] change | 샘플 구매내역에 가상 Chrome 로그인 창 추가
단계 문구만 보이던 샘플을 PC 단일 2열 시트로 확장했다. 왼쪽은 Lookbox 연결 단계, 오른쪽은 주소 표시줄·샘플 계정 입력칸·로그인 CTA가 있는 가상 Chrome이며, 로그인 완료 뒤 주문내역 와이어프레임과 상품별 읽기 완료 상태까지 같은 자리에서 보여준다. 실제 계정 입력과 서버 호출은 하지 않는다.
근거: `frontend/src/proto/02-shared.jsx` `BottomSheet.desktopMaxW`, `frontend/src/proto/04-screens-ab.jsx` `OrderDemoBrowser`, `frontend/src/proto/proto.css` `.lb-order-demo-*`.
[[order-import-webview]] [[add-item-bulk]]

## [2026-09-13] fix | 모바일 구매내역 안내·CTA 단순화
모바일 구매내역 안내에서 보조 Chrome 문구와 별도 가방 안내를 제거하고 「구매내역은 PC에서 불러올 수 있어요」만 남겼다. CTA는 PC와 같은 문구·형태를 낮은 대비로 보이게 하되 클릭은 막지 않아, 탭하면 PC 전용 토스트를 띄운다.
근거: `frontend/src/proto/04-screens-ab.jsx` 모바일 `orders` 패널·CTA.
[[order-import-webview]] [[add-item-bulk]]

## [2026-09-13] fix | 소스 탭 전환 시 추가 시트 리듬 고정
사진·URL은 168px 스테이지와 CTA 위·아래 44px 보조 슬롯을 사용하고, 구매내역·바로 보기는 CTA 위 슬롯을 포함한 212px 박스와 CTA 아래 슬롯을 사용하도록 합계를 고정했다. 모바일 구매내역 문구는 바로 보기와 같은 글꼴로 맞췄고, 바로 보기의 전신 이미지 안내는 두 줄로 바꾸며 프사와 텍스트 간격을 넓혔다. 데모 CTA는 실제 서비스와 같은 「주문 내역 가져오기」로 보이게 했고, 전역 토스트는 바텀시트 CTA와 겹치지 않도록 40px 위로 옮겼다.

## [2026-09-13] fix | 바로 보기 대기·생성 중 좌표 동기화
전신 이미지를 만들기 전 프사 원형은 생성 스켈레톤과, 두 줄 안내는 생성 진행 제목과 각각 같은 카드 좌표를 공유한다. 클릭 전·생성 중 상태가 전환되어도 원형과 텍스트의 시작점이 움직이지 않는다.
근거: `frontend/src/proto/04-screens-ab.jsx` 바로 보기 정적·생성 중 패널, `frontend/src/proto/proto.css` `.lb-tryon-*`.
[[tryon-setup-from-mypage]]
근거: `frontend/src/proto/04-screens-ab.jsx` `mobileOrderTab`·스테이지·힌트 슬롯.
[[add-item-bulk]]
