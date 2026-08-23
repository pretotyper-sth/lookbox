# RecentTagField — 칩 토글 시 스크롤 유지

`02-shared.jsx:599` `RecentTagField`는 최근 칩을 고르면 입력칸을 접고, '직접 입력'을 누르면
다시 펼친다. 입력칸 높이는 약 52px. 아이템 등록 시트의 스크롤 컨테이너는
`.lb-sheet-body`(`proto.css:250`, `max-height: min(76vh, 640px)`)다.

증상: 스크롤을 끝까지 내려 CTA를 보는 상태에서 직접입력 ↔ 최근칩을 오가면 입력칸이
붙었다 떨어지며 콘텐츠 높이가 52px씩 바뀌고, `scrollTop`은 그대로라 CTA가 화면 밖으로
밀린다. 스크롤 컨테이너를 리마운트하는 코드는 없다 — 순수 레이아웃 높이 변화다.

해결: 클릭 직전 `scrollTop`과 바닥까지 남은 거리(gap)를 잡아 두고, 의존성 배열 없는
`useLayoutEffect`에서 되돌린다. gap ≤ 2px이면 바닥에 다시 붙이고, 아니면 같은 `scrollTop`.
`focus({ preventScroll: true })`도 필요하다 — 브라우저가 입력칸을 보이게 하려고 스크롤을
또 움직이면 방금 되돌린 위치가 깨진다.

실측(390x844, 2026-08-17): 바닥에서 지그재그 ↔ 직접입력 4회 왕복 — gap 0 유지
(scrollTop 297↔245, max도 같이 움직임). 중간 위치(120)에서 왕복 — 120 유지.

주의: `ItemDetailSheet`도 `.lb-sheet-stack` + `.lb-sheet-body` + `.lb-sheet-dock`이다.
저장 버튼은 스크롤 밖에 고정한다. 칩 토글 스크롤 보정은 본문 `.lb-sheet-body`만 본다.

관련: [[large-display-layout]]
