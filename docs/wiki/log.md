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

