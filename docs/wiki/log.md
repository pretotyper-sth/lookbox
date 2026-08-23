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

