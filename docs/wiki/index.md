# Lookbox Wiki — Index

Entry point for every agent session. One line per page. Load only what the task needs.

Conventions: one fact per page · cite `path:line` or commit · absolute dates ·
link with `[[page-name]]` · append every operation to [log.md](log.md).

## Architecture
- [large-display-layout](large-display-layout.md) — 로그인 전 화면은 flex spacer로 세로를 나눠 쓴다; 큰 화면은 `.lb-page-cap`으로 상한+가운데 정렬. 메인 앱은 760px 브레이크포인트 셸이 이미 있음

## Features
- [image-viewer-gestures](image-viewer-gestures.md) — 이미지 크게 보기는 핀치·더블탭·휠. 100%에서도 핀치가 먹게 touch-action none
- [plan-sheet-free-ads](plan-sheet-free-ads.md) — 요금제 시트는 무료 박스만. 항목에 광고 포함, 광고 미노출 설명은 화면에 안 씀
- [mypage-usage-in-account](mypage-usage-in-account.md) — 사용량은 계정 및 지원 안 짧은 블록. 버전 문자열은 페이지 맨 아래만
- [mood-groups](mood-groups.md) — 무드 카드는 `STYLE_GROUPS` 섹션. 지금은 공통만, 2열 마지막 행이 1개여도 됨

## Decisions
_(empty)_

## Operations
_(empty)_

## Gotchas
- [recent-tag-field-scroll](recent-tag-field-scroll.md) — 구매처 칩 토글이 입력칸을 붙였다 떼며 시트 높이를 바꾼다; scrollTop/gap을 잡아 `useLayoutEffect`에서 되돌림
- [chiprow-sheet-scroll](chiprow-sheet-scroll.md) — `.lb-chiprow`의 pan-x가 상세 시트 세로 스크롤을 가로챘다. pan-x pan-y + 시트 fixed
- [wardrobe-select-header](wardrobe-select-header.md) — 옷장 선택 모드에서도 + 슬롯을 남겨 검색 줄이 안 뛴다
