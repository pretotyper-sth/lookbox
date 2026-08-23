# Lookbox Wiki — Index

Entry point for every agent session. One line per page. Load only what the task needs.

Conventions: one fact per page · cite `path:line` or commit · absolute dates ·
link with `[[page-name]]` · append every operation to [log.md](log.md).

## Architecture
- [large-display-layout](large-display-layout.md) — 로그인 전 화면은 flex spacer로 세로를 나눠 쓴다; 큰 화면은 `.lb-page-cap`으로 상한+가운데 정렬. 메인 앱은 760px 브레이크포인트 셸이 이미 있음

## Features
- [image-viewer-gestures](image-viewer-gestures.md) — 이미지 크게 보기는 핀치·더블탭·휠. 100%에서도 핀치가 먹게 touch-action none
- [plan-sheet-free-ads](plan-sheet-free-ads.md) — 요금제 시트는 무료 박스만. 항목에 광고 포함. 아래에 작업별 크레딧
- [mypage-usage-in-account](mypage-usage-in-account.md) — 사용량: PC는 계정 카드 안, 모바일은 제 카드. 무료 50크레딧. 버전은 날짜만. 차감 목록은 요금제 시트
- [model-look-toggle](model-look-toggle.md) — 착장 토글은 무료에서도 열림(장당 5크레딧). 이미 받은 코디에도 lookImg를 채움
- [tryon-setup-from-mypage](tryon-setup-from-mypage.md) — 마이페이지 바로 보기는 설정 시트를 연 채 이미지를 보여 줌
- [profile-height-weight](profile-height-weight.md) — 키·몸무게는 표시/입력 행을 나눔. 추천·착장 프롬프트에는 안 넣음
- [mood-groups](mood-groups.md) — 무드는 공통 + 여성 전용(걸리시·글램·페미닌). 분류 id는 `_STYLE_IDS`와 같음
- [add-item-bulk](add-item-bulk.md) — URL은 +로 칸을 늘림(박스 안 스크롤). 구매내역 박스는 힌트 칸까지. 연결은 별도 시트
- [url-import-fetch](url-import-fetch.md) — URL 등록은 상품컷을 고른다. robots 메타를 차단으로 오인하지 않음
- [studio-cutout-fringe](studio-cutout-fringe.md) — 어두운 상품컷 JPEG 링잉은 흰 테두리가 된다. 고대비만 혼합대를 흡수. 상품컷은 side여도 누끼
- [stacked-product-hero](stacked-product-hero.md) — 세로로 붙은 상세컷은 정면 전신 한 칸만 잘라 등록한다

## Decisions
- [rename-candidates-2026-08](rename-candidates-2026-08.md) — Lookbox 대체 후보. R3는 Look 고정 해제·컨셉/페르소나형. KIPRIS 미클리어


## Operations
- [vercel-github-silent](vercel-github-silent.md) — 푸시 메일은 vercel[bot] 댓글. `github.silent`로 댓글만 끈다

## Gotchas
- [recent-tag-field-scroll](recent-tag-field-scroll.md) — 구매처 칩 토글이 입력칸을 붙였다 떼며 시트 높이를 바꾼다; scrollTop/gap을 잡아 `useLayoutEffect`에서 되돌림
- [chiprow-sheet-scroll](chiprow-sheet-scroll.md) — `.lb-chiprow`의 pan-x가 상세 시트 세로 스크롤을 가로챘다. pan-x pan-y + 시트 fixed
- [wardrobe-select-header](wardrobe-select-header.md) — 옷장 선택 모드에서도 + 슬롯을 남겨 검색 줄이 안 뛴다
