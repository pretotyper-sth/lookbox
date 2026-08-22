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

## [2026-08-22] ingest | 공통 무드 3개
공통 섹션에 블록코어·바디핏·비즈니스 캐주얼. 카드 이미지 480px WebP
(기존 스타일과 동일). [[mood-groups]]

