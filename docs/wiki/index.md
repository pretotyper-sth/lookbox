# Lookbox Wiki — Index

Entry point for every agent session. One line per page. Load only what the task needs.

Conventions: one fact per page · cite `path:line` or commit · absolute dates ·
link with `[[page-name]]` · append every operation to [log.md](log.md).

## Architecture
- [large-display-layout](large-display-layout.md) — 로그인 전 화면은 flex spacer로 세로를 나눠 쓴다; 큰 화면은 `.lb-page-cap`으로 상한+가운데 정렬. 메인 앱은 760px 브레이크포인트 셸이 이미 있음

## Features
_(empty)_

## Decisions
_(empty)_

## Operations
_(empty)_

## Gotchas
- [recent-tag-field-scroll](recent-tag-field-scroll.md) — 구매처 칩 토글이 입력칸을 붙였다 떼며 시트 높이를 바꾼다; scrollTop/gap을 잡아 `useLayoutEffect`에서 되돌림
