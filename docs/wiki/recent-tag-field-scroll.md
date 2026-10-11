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

주의: `ItemDetailSheet`의 「저장」은 상세 입력 아래, `.lb-sheet-body` 안에 있다.
스크롤과 같이 움직인다. 칩 토글 스크롤 보정은 본문 `.lb-sheet-body`만 본다.

관련: [[large-display-layout]]

2026-10-11 라이브 후속 수정: 직접 입력 유지 판정에서 manualValue(원문)와 current(trim)를 비교하면 `무신사 ` 입력 시 공백 때문에 불일치해 입력창이 닫혔다. 입력 모드는 공백을 포함한 value 원문으로 비교하고, current는 기존 중복 태그 강조에만 사용한다. 목록에 없는 외부 draft는 자동으로 입력창을 표시한다. PC1440px/모바일390px에서 `무신사` 중복 태그 강조→스페이스바→`온라인/오프라인` 연속 입력·포커스 유지·blur 유지, 명시적 최근 태그 선택으로만 접힘 확인. 근거: `frontend/src/proto/02-shared.jsx` RecentTagField typing.

2026-10-11 후속: 직접 입력 중에는 최근 태그와 동일한 값이어도 칩 강조·앞자리 이동을 하지 않는다. 목록은 저장된 최근 구매처 순서를 유지하고, 칩을 명시적으로 선택했을 때만 강조한다. 새 구매처는 담기/상세 저장 시 `rememberStore`로 기록되어 다음 아이템의 앞단에 표시된다. 기존 구매처의 재저장은 순서를 바꾸지 않는다. 근거: `frontend/src/proto/02-shared.jsx` `RecentTagField`, `rememberRecent`; `frontend/src/proto/04-screens-ab.jsx` `advance`.
