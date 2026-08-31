# Lookbox Wiki — Index

Entry point for every agent session. One line per page. Load only what the task needs.

Conventions: one fact per page · cite `path:line` or commit · absolute dates ·
link with `[[page-name]]` · append every operation to [log.md](log.md).

## Architecture
- [large-display-layout](large-display-layout.md) — 로그인 전 화면은 flex spacer로 세로를 나눠 쓴다; 큰 화면은 `.lb-page-cap`으로 상한+가운데 정렬. 메인 앱은 760px 브레이크포인트 셸이 이미 있음

## Features
- [image-viewer-gestures](image-viewer-gestures.md) — 이미지 크게 보기는 핀치·더블탭·휠. 100%에서도 핀치가 먹게 touch-action none
- [look-img-flex-min](look-img-flex-min.md) — 착장 img는 절대배치. 2:3은 인물 여백을 두고 4:5로 자른다. 안 들어가면 축소해 넣는다
- [plan-sheet-free-ads](plan-sheet-free-ads.md) — 요금제 시트는 무료 박스만. 항목에 광고 포함. 아래에 작업별 크레딧
- [mypage-usage-in-account](mypage-usage-in-account.md) — 사용량: PC는 계정 카드 안, 모바일은 제 카드. 무료 50크레딧. 캐시 먼저 그림. 어드민 메일만 0이면 50 재지급. 버전은 날짜만
- [model-look-toggle](model-look-toggle.md) — 착장은 20대 초중반·7.5등신. 품질 테스트 중 착장 1장(`LOOK_TEST_LIMIT`)
- [tryon-setup-from-mypage](tryon-setup-from-mypage.md) — 바로 보기는 계정 프사. 구멍은 옷 픽셀, 양옆은 막음. 후면 카메라만
- [empty-state-center](empty-state-center.md) — 빈 화면 문구는 콘텐츠 칸 세로 가운데. 가짜 상단바 패딩을 넣으면 아래로 내려감
- [mobile-page-zoom](mobile-page-zoom.md) — iOS는 13px 검색창 포커스로 페이지를 확대하고 기억한다. 모바일 input 16px + viewport 리셋
- [profile-avatar](profile-avatar.md) — 프사는 스토리지 URL을 계정 prefs에 붙인다. data URL은 기기에만 남아 모바일에 안 보였다
- [profile-height-weight](profile-height-weight.md) — 키·몸무게는 표시/입력 행을 나눔. 추천·착장 프롬프트에는 안 넣음
- [mood-groups](mood-groups.md) — 무드는 공통 + 여성 전용. 착장 인물은 `assets/mood` 남·여 예시. 분류 id는 `_STYLE_IDS`와 같음
- [add-item-bulk](add-item-bulk.md) — URL은 +로 칸을 늘림(박스 안 스크롤). 바로 보기·구매내역 박스는 힌트 칸까지(212px)라 탭 높이가 같다. 「담고 완료」는 상세 입력 아래
- [item-optional-fields](item-optional-fields.md) — 추가·상세 선택 입력 순서: 계절 → 가격 → 재질 → 구매처 → 메모. URL이면 가격·재질도 HTML에서 채움
- [url-import-fetch](url-import-fetch.md) — URL 등록은 상품컷·브랜드·가격·재질을 페이지에서 읽는다. robots 메타를 차단으로 오인하지 않음
- [studio-cutout-fringe](studio-cutout-fringe.md) — 어두운 상품컷 JPEG 링잉은 흰 테두리가 된다. 고대비만 혼합대를 흡수. 상품컷은 side여도 누끼
- [stacked-product-hero](stacked-product-hero.md) — 세로로 붙은 상세컷은 정면 전신 한 칸만 잘라 등록한다

## Decisions
- [rename-candidates-2026-08](rename-candidates-2026-08.md) — Lookbox 대체 후보. R3는 Look 고정 해제·컨셉/페르소나형. KIPRIS 미클리어


## Operations
- [ai-usage-cost](ai-usage-cost.md) — 원가는 `ai_usage_logs.metadata.cost_usd`. 착장·기준인물은 usage 미기록. 관리자 `/api/live/admin/ai-cost`
- [vercel-github-silent](vercel-github-silent.md) — 푸시 메일은 vercel[bot] 댓글. `github.silent`로 댓글만 끈다

## Gotchas
- [recent-tag-field-scroll](recent-tag-field-scroll.md) — 구매처 칩 토글이 입력칸을 붙였다 떼며 시트 높이를 바꾼다; scrollTop/gap을 잡아 `useLayoutEffect`에서 되돌림
- [chiprow-sheet-scroll](chiprow-sheet-scroll.md) — `.lb-chiprow`의 pan-x가 상세 시트 세로 스크롤을 가로챘다. pan-x pan-y + 시트 fixed
- [live-fetch-wake](live-fetch-wake.md) — 새로고침 토스트 '네트워크가 불안정해요'는 Render 첫 OPTIONS 실패. GET에 JSON 헤더를 붙이지 않고 재시도한다
