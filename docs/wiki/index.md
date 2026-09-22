# Lookbox Wiki — Index

Entry point for every agent session. One line per page. Load only what the task needs.

Conventions: one fact per page · cite `path:line` or commit · absolute dates ·
link with `[[page-name]]` · append every operation to [log.md](log.md).

## Architecture
- [large-display-layout](large-display-layout.md) — 로그인 전 화면은 flex spacer로 세로를 나눠 쓴다; 큰 화면은 `.lb-page-cap`으로 상한+가운데 정렬. 메인 앱은 760px 브레이크포인트 셸이 이미 있음

## Features
- [tryon-mask-boundaries](tryon-mask-boundaries.md) — 사용자 라이브 승인·변경 보호 체크포인트 `3d5eef0` / `checkpoint/tryon-approved-2026-09-22`. 다른 작업 중 수정 금지. 영상 cover·PNG contain·tryon21 유지
- [image-viewer-gestures](image-viewer-gestures.md) — 이미지 크게 보기는 핀치·더블탭·휠. lookImg는 4:5 스테이지에 cover
- [look-img-flex-min](look-img-flex-min.md) — 착장 img는 절대배치. 4:5 cover, 머리 쪽(center top). 좌우를 키워 자르지 않는다
- [lookbook-card](lookbook-card.md) — 룩북은 캐시 먼저. `saved=1`은 착장 URL만 있으면 옷장 join 없음. 목록은 GPT 아님
- [look-flatlay-overlap](look-flatlay-overlap.md) — 추천 상품컷은 의류 코어 슬롯만 배치하고, 제안 가방·소품은 작게 한 자리만 둔다
- [plan-sheet-free-ads](plan-sheet-free-ads.md) — 요금제 시트는 무료 박스만. 항목에 광고 포함. 아래에 작업별 크레딧
- [mypage-usage-in-account](mypage-usage-in-account.md) — 사용량: PC는 계정 카드 안, 모바일은 제 카드. 무료 50크레딧. 캐시 먼저 그림. 어드민 메일만 0이면 50 재지급. 버전은 날짜만
- [model-look-toggle](model-look-toggle.md) — AI 캐릭터 착장은 첫 일반 상품컷부터 왼쪽 첫 카드 한 장만 실제 단계와 함께 병렬 생성한다
- [look-latency](look-latency.md) — 상품컷을 먼저 보내고, 오른쪽 제안 아이템과 왼쪽 AI 착장을 병렬 생성한다
- [location-weather](location-weather.md) — 브라우저 현재 위치의 기온·체감·최고/최저·강수를 데일리 추천 점수에 반영하며 좌표는 저장하지 않는다
- [coord-clash](coord-clash.md) — 추천 상품컷은 상의·하의·신발 코어 슬롯을 각 한 개만 쓴다
- [look-plate-shadow](look-plate-shadow.md) — 신발 옆 깨짐은 판 평탄화가 원인. 맞추기 창은 원본 4:5. 가장자리 늘림 없음
- [detail-wide-layout](detail-wide-layout.md) — PC 코디 상세는 항상 왼쪽 사진·오른쪽 레일. 룩북도 오늘과 같다
- [tryon-setup-from-mypage](tryon-setup-from-mypage.md) — 바로 보기: 대상 선택 행만큼 프사 스테이지를 144px로 줄여 사진·URL과 전체 높이 통일. 마스크는 tryon21에서 옷 밖 확장을 제거했다([[tryon-mask-boundaries]]). 실패는 일 3회
- [tryon-multiple-profiles](tryon-multiple-profiles.md) — 바로보기에서 본인·본인 외 프로필을 저장하고 카메라 우상단에서 즉시 전환; 생성 %는 작업에 붙어 탭을 다녀도 되감지 않음. 본인 외 입력 시트 위치까지 보존
- [empty-state-center](empty-state-center.md) — 빈 화면 문구는 콘텐츠 칸 세로 가운데. 가짜 상단바 패딩을 넣으면 아래로 내려감
- [mobile-page-zoom](mobile-page-zoom.md) — iOS는 13px 검색창 포커스로 페이지를 확대하고 기억한다. 모바일 input 16px, 검색 힌트만 13.5px
- [profile-avatar](profile-avatar.md) — 프사는 스토리지 URL을 계정 prefs에 붙인다. data URL은 기기에만 남아 모바일에 안 보였다
- [profile-height-weight](profile-height-weight.md) — 키·몸무게는 표시/입력 행을 나눔. 추천에는 안 넣고 바로 보기 전신만 자연스럽게 반영
- [personal-model-look](personal-model-look.md) — AI 착장 개인화 토글은 기본 off. 얼굴·키·몸무게를 계정 단위로 저장하고 모달 재표시도 계정 단위로 기억
- [mood-groups](mood-groups.md) — 무드는 공통 + 여성 전용. 착장 인물은 `assets/mood` 남·여 예시. 분류 id는 `_STYLE_IDS`와 같음
- [order-import-webview](order-import-webview.md) — 구매내역: 실제 확장은 Chrome 팝업, 샘플은 추가 시트 2열 가상 Chrome. 썸네일 직접 등록·탭 이동 후 유지·선택 후 공용 상세입력. 모바일은 PC 안내
- [store-request-survey](store-request-survey.md) — 지원하지 않는 쇼핑몰은 추가 요청 칩 → 이름·주소 입력 → 단일 CTA로 저장하고, 사용자별 중복을 막아 관리자 API가 집계한다
- [add-item-bulk](add-item-bulk.md) — URL은 +로 칸을 늘림(박스 안 스크롤). 바로 보기·구매내역 박스는 힌트 칸까지(212px)라 탭 높이가 같다. 「담고 완료」는 상세 입력 아래. 구매내역은 칩 선택 후 CTA([[order-import-webview]])
- [item-optional-fields](item-optional-fields.md) — 추가·상세 선택 입력 순서: 계절 → 가격 → 재질 → 구매처 → 메모. URL이면 가격·재질도 HTML에서 채움
- [url-import-fetch](url-import-fetch.md) — URL 등록은 상품컷·브랜드·가격·재질을 페이지에서 읽는다. robots 메타를 차단으로 오인하지 않음
- [studio-cutout-fringe](studio-cutout-fringe.md) — 어두운 상품컷 JPEG 링잉은 흰 테두리가 된다. 고대비만 혼합대를 흡수. 상품컷은 side여도 누끼
- [stacked-product-hero](stacked-product-hero.md) — 세로로 붙은 상세컷은 정면 전신 한 칸만 잘라 등록한다

## Decisions
- [rename-candidates-2026-08](rename-candidates-2026-08.md) — Lookbox 대체 후보. R3는 Look 고정 해제·컨셉/페르소나형. KIPRIS 미클리어
- [acloset-positioning-2026-09](acloset-positioning-2026-09.md) — Acloset 대비 Lookbox는 범용 AI 옷장이 아니라 구매 전 적합성 검증·구매결정 도구를 차지한다


## Operations
- [ai-usage-cost](ai-usage-cost.md) — 원가는 `ai_usage_logs.metadata.cost_usd`. 착장·기준인물은 usage 미기록. 관리자 `/api/live/admin/ai-cost`
- [chrome-extension-publish](chrome-extension-publish.md) — 웹스토어 게시자명·연락처는 공개. RealCloset 전용 Google 계정, 등록비·2FA·Privacy practices 필요
- [vercel-github-silent](vercel-github-silent.md) — 푸시 메일은 vercel[bot] 댓글. `github.silent`로 댓글만 끈다

## Gotchas
- [recent-tag-field-scroll](recent-tag-field-scroll.md) — 구매처 칩 토글이 입력칸을 붙였다 떼며 시트 높이를 바꾼다; scrollTop/gap을 잡아 `useLayoutEffect`에서 되돌림
- [chiprow-sheet-scroll](chiprow-sheet-scroll.md) — `.lb-chiprow`의 pan-x가 상세 시트 세로 스크롤을 가로챘다. pan-x pan-y + 시트 fixed
- [live-fetch-wake](live-fetch-wake.md) — 새로고침 토스트 '네트워크가 불안정해요'는 Render 첫 OPTIONS 실패. GET에 JSON 헤더를 붙이지 않고 재시도한다
