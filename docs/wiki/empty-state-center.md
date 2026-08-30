# 빈 화면·팝업은 콘텐츠 칸의 세로 가운데

예전 EmptyState는 옷장 TopBar 높이(safe-area + 73px) + `min(18vh, 168px)`를
오늘·룩북에도 더했다. 상단바가 없는 탭에서는 문구가 아래로 내려갔다(2026-08-30).

지금은 하단 탭·상단바를 뺀 flex 칸에서 `justify-content: center`다.
`02-shared.jsx` `EmptyState`.

근거: `frontend/src/proto/02-shared.jsx` `EmptyState`.
