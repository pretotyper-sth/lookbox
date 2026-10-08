# Lookbox Wiki — Index

Entry point for every agent session. One line per page. Load only what the task needs.

Conventions: one fact per page · cite `path:line` or commit · absolute dates ·
link with `[[page-name]]` · append every operation to [log.md](log.md).

## Architecture
- [large-display-layout](large-display-layout.md) — 로그인 전 화면은 flex spacer로 세로를 나눠 쓴다; 큰 화면은 `.lb-page-cap`으로 상한+가운데 정렬. 메인 앱은 760px 브레이크포인트 셸이 이미 있음
- [mobile-bottom-nav](mobile-bottom-nav.md) — 모바일 하단 메뉴에는 옷장·오늘 코디·룩북·마이만 표시하고 구매 검토는 두지 않는다
- [mobile-ai-mark](mobile-ai-mark.md) — AI 착장 좌측 하단 표시. 작은 카드·모바일 확대 화면은 ✦만, 데스크톱 상세는 생성 문구 유지

## Features
- [closet-background-studio](closet-background-studio.md) — 로컬 구매내역 자동 추출·옷장 저장/앱 종료 후 지속·재시작 복귀, 오늘 코디의 캐릭터 착장 탐색·룩북 저장·피드 편집 연결·공통 앱 레이아웃/버튼·묶음 드롭 생성/남녀 기본 캐릭터·선택 개인화·4:5 단일 배경·공통 닫기 버튼·기본 캐릭터 유지 피드백·PC 묶음 이미지 끌기·모바일 선택 드래그/스크롤 분리·만들기 재료/옷장 혼합 착장·캐릭터 공통 확대 보기·추천 화면 하단 pill 플로팅 진입
- [item-outfit-menu](item-outfit-menu.md) — 아이템 메뉴 자연 높이·서버 실제 수량에 맞는 스켈레톤·착장 우선 생성·성별 고정·직접 코디 버튼·불가능한 선택 안내·결과 재개·룩북 저장·DEV 추천 개수 통일/프로필별 선택 캐시/다시 보지 않기 생성 안내
- [model-look-realism-2026-10](model-look-realism-2026-10.md) — 무신사 AI 코디 35장·남녀별 순환·남성 목록 오분류 제거, GPT Image 2.5 Flare high, 전신 80%·위아래 여백, 실제 서비스 생성 확인·승인한 웜 그레이지 A 배경·고른 확산광·직접 4:5 생성
- [tryon-mask-boundaries](tryon-mask-boundaries.md) — 승인 체크포인트 보호. 9/24 명시 요청으로 tryon22·캐시 PNG 재검증·부분 투명화 거부·정면 자세 강화; 영상 cover·PNG contain 유지
- [image-viewer-gestures](image-viewer-gestures.md) — 이미지 크게 보기는 핀치·더블탭·휠. lookImg는 4:5 스테이지에 cover
- [look-img-flex-min](look-img-flex-min.md) — 착장 img는 절대배치. 4:5 cover, 머리 쪽(center top). 좌우를 키워 자르지 않는다
- [lookbook-card](lookbook-card.md) — 룩북은 캐시 먼저. `saved=1`은 착장 URL만 있으면 옷장 join 없음. 목록은 GPT 아님
- [lookbook-model-look-switch](lookbook-model-look-switch.md) — 정사각 썸네일은 AI 원본을 배경으로 펼치고 전신 원본을 contain으로 표시. 보기 모드 기억, 이미지 카드 진입은 transform 없이 opacity만 변경
- [look-flatlay-overlap](look-flatlay-overlap.md) — 겹침 상품컷과 태그 버튼으로 등록된 브랜드·이름·가격 표시
- [plan-sheet-free-ads](plan-sheet-free-ads.md) — 요금제 시트는 무료 박스만. 항목에 광고 포함. 아래에 작업별 크레딧
- [mypage-usage-in-account](mypage-usage-in-account.md) — 사용량: PC는 계정 카드 안, 모바일은 제 카드. 무료 50크레딧. 캐시 먼저 그림. 어드민 메일만 0이면 50 재지급. 버전은 날짜만
- [account-settings-flow](account-settings-flow.md) — 개인정보와 비밀번호는 하나의 시트 안에서 화면 전환; 중첩 시트 없이 뒤로 복귀
- [outfit-feedback](outfit-feedback.md) — 코디 상세의 엄지 평가를 계정에 저장하고 다음 조합의 아이템·스타일 점수에 반영
- [model-look-toggle](model-look-toggle.md) — AI 착장은 왼쪽 첫 카드 요청부터 작업 표시. model-id33은 목록 밖 액세서리 금지·레퍼런스 대비 다리 길이 소폭 축소
- [model-look-confirm-modal](model-look-confirm-modal.md) — AI 착장 생성 확인은 모바일에서도 가운데 표시하고 작은 화면에서 내부 스크롤·DEV 마이 선택 코디 자동 생성 옵션/첫 활성화 비용 안내
- [look-latency](look-latency.md) — 상품컷을 먼저 보내고, 오른쪽 제안 아이템과 왼쪽 AI 착장을 병렬 생성한다
- [location-weather](location-weather.md) — 날씨 조회 3/10초 제한·병렬 복구·30분 캐시·재시도, 실패 시 임의 기온 없음
- [coord-clash](coord-clash.md) — 추천 상품컷 코어 슬롯 중복 방지·AI/보충/최종 결과 스타일 충돌 검사·니트/운동용 하의 제외·수량보다 적합성 우선
- [look-plate-shadow](look-plate-shadow.md) — 신발 옆 깨짐은 판 평탄화가 원인. 맞추기 창은 원본 4:5. 가장자리 늘림 없음
- [detail-wide-layout](detail-wide-layout.md) — PC 코디 상세는 항상 왼쪽 사진·오른쪽 레일. 룩북도 오늘과 같다
- [tryon-setup-from-mypage](tryon-setup-from-mypage.md) — PC·모바일 모두 본인·본인 외 안내를 같은 패널 구조로 표시하고 CTA만 생성 상태에 따라 바꾼다([[tryon-mask-boundaries]])
- [tryon-multiple-profiles](tryon-multiple-profiles.md) — 본인·본인 외 전환. 서버 백그라운드 생성·계정별 작업 복귀, 최대 세 번 검증 재시도, 이미지 적용 방식 유지
- [empty-state-center](empty-state-center.md) — 빈 화면 콘텐츠 세로 중앙·편집기 재료 빈 안내/검색 없음 표시 복구·옷장 4단계 미션 복원/모바일 한 줄·중복 상단 + 제외·오늘 코디 잠금 배너 여백/추가 버튼 통일
- [first-entry-flow](first-entry-flow.md) — 첫 진입 3단계 가이드를 제거하고 옷장으로 바로 연결; 회원가입 선호 설정은 유지
- [mobile-page-zoom](mobile-page-zoom.md) — iOS는 13px 검색창 포커스로 페이지를 확대하고 기억한다. 모바일 input 16px, 검색 힌트만 13.5px
- [profile-avatar](profile-avatar.md) — 프사는 스토리지 URL을 계정 prefs에 붙인다. data URL은 기기에만 남아 모바일에 안 보였다·피드 공개 사진은 별도 feedAvatar/기본 빈 이미지/공개 프로필에서 선택
- [profile-height-weight](profile-height-weight.md) — 키·몸무게는 표시/입력 행을 나눔. 조합 추천은 미사용·개인화 착장은 수치 기반 체형 반영
- [personal-model-look](personal-model-look.md) — 개인화 기본 off·계정별 사진/수치 저장. 얼굴 정체성 유지·수치 기반 몸 재구성·전신 참조의 체형 복사 방지·설정별 복원·personal-body2 캐시
- [mood-groups](mood-groups.md) — 승인한 무드 18개 로컬·라이브 적용(`efd5831`)·최적화 유지, 스포티 기존 의상에 새 톤·클래식 트위드 조합. 생성 레퍼런스 별도 사용
- [order-import-webview](order-import-webview.md) — 구매내역: 실제 확장은 Chrome 팝업, 샘플은 추가 시트 2열 가상 Chrome. 썸네일 직접 등록·탭 이동 후 유지·선택 후 공용 상세입력. 모바일은 PC 안내
- [store-request-survey](store-request-survey.md) — 지원하지 않는 쇼핑몰은 추가 요청 칩 → 이름·주소 입력 → 단일 CTA로 저장하고, 사용자별 중복을 막아 관리자 API가 집계한다
- [add-item-bulk](add-item-bulk.md) — URL은 +로 칸을 늘림(박스 안 스크롤). 바로 보기·구매내역 박스는 힌트 칸까지(212px)라 탭 높이가 같다. 「담고 완료」는 상세 입력 아래. 구매내역은 칩 선택 후 CTA([[order-import-webview]])
- [item-optional-fields](item-optional-fields.md) — 추가·상세 선택 입력 순서: 계절 → 가격 → 재질 → 구매처 → 메모. URL이면 가격·재질도 HTML에서 채움
- [url-import-fetch](url-import-fetch.md) — URL 등록은 상품컷·브랜드·가격·재질을 페이지에서 읽는다. robots 메타를 차단으로 오인하지 않음
- [studio-cutout-fringe](studio-cutout-fringe.md) — 어두운 상품컷 JPEG 링잉은 흰 테두리가 된다. 고대비만 혼합대를 흡수. 상품컷은 side여도 누끼
- [stacked-product-hero](stacked-product-hero.md) — 세로로 붙은 상세컷은 정면 전신 한 칸만 잘라 등록한다

## Decisions
- [feed-desktop-gallery-2026-10](feed-desktop-gallery-2026-10.md) — PC 피드 2·3·4열 갤러리/추천 레일 제거·전체/팔로잉·룩 확대, 기본 첫 화면 옷장·랜딩 가입 경로 통일·상세 제목/겹침/출처/아이템 목록 정리·팔로잉 최신 상태 반영·PC 작성자 이미지 위 배치·중앙 끝 안내/맨 위로·목록 출처 공통 하단 중앙/사용된 제공자만 표시·이미지 꾸미기→글/공개 범위→게시·리스타일 원문 미복사·아이템 목록/상세 고정 높이·GIF 정지 프레임 공유 이미지 포함·텍스트 탭 재편집 유지/드래그 분리·모바일 옵션 기본40dvh/손잡이 확장/전체 캔버스 표시·밝은 게시 화면/우상단 주황 게시 버튼·투표 카드 목록/7일 만료 시각·기존 글 수정 완료/변경 취소 확인·모바일 서식 하단/재료 화살표 정렬·선택 패널 48px 축소·재료 검색 상단 스크롤 가림
- [design-direction-2026-10](design-direction-2026-10.md) — 페르소나·시나리오·색상 검토 이력. 사용자 요청으로 테마 적용 철회, 기존 아이보리·차콜 복원
- [ice-blue-theme-2026-10](ice-blue-theme-2026-10.md) — 아이스 블루 시안 검토 이력. 사용자 요청으로 서비스 테마 적용 철회
- [realcloset-feed-v3-2026-10](realcloset-feed-v3-2026-10.md) — GIF 530개·스티커/GIF 스크롤 로딩·캔버스 밖 선택 해제·간소화 피드/꾸미기·저장한 옷 활용/북마크 토글·공개 프로필/옷 공개 개별 설정·PC 공통 헤더/우측 정렬·마이페이지 팔로워·팔로잉 2탭 페이지/알림 반응형 페이지/공통 빈 안내와 페이지네이션·내 스타일 초안 폐기/만들기 헤더 간소화·기본 피드 게시/공유 메뉴 간소화·친구 코디 투표/기본 질문/생성 후 7일 만료·저장한 룩 피드 공통 액션·원터치 저장·리스타일·마이 활동 목록·공통 모달/스타일 관리·피드 상품 목록/상세·만들기 재료 분리·투표 헤더/하단 시트·빈 옷장 상단 제거·터치 스크롤·DEV 데이터 상태/SSE 채우기 오류 수정 · 목록 옆 공유 3개/기본 앱·외부 PNG 공유/복사 시 로컬 제한 안내·빈 저장한 룩/내 스타일/팔로워·팔로잉 공통 UI·본인 공개 게시글 편집 버튼·공개 옷 만들기 재료 용도 안내
- [realcloset-feed-mobile-2026-10](realcloset-feed-mobile-2026-10.md) — 세로 단일 피드·모바일 전체 화면 캔버스/재료 서랍·PC 두 패널·직접 변형·원터치 GIPHY/OpenMoji 1,032개
- [realcloset-style-lab-2026-10](realcloset-style-lab-2026-10.md) — 스토리형 편집기·캔버스 직접 텍스트 입력/선택 서식·펜/스티커/이미지/GIF·공유/PNG·모바일 캔버스 선택·수정 패널·빈 캔버스 선택 해제
- [realcloset-feed-2026-10](realcloset-feed-2026-10.md) — 기존 룩북 복원·별도 피드, 서비스 생성 착장·상품컷·기록 가격 8개 샘플, 만들기 컬러 통일·실제 코디 재료 유지
- [realcloset-style-studio-2026-10](realcloset-style-studio-2026-10.md) — 정성적 포지셔닝맵·시장 진입 전략, 기존 레이아웃 유지한 창작/영감/선택 공유/A·B 투표/착용 기록 로컬 체험과 검증
- [gamut-benchmark-2026-10](gamut-benchmark-2026-10.md) — 개멋 실사용 영상 39개 UX 상태·실제 스토어 리뷰·창작/선택적 공유/리믹스 벤치마킹과 Lookbox 검증 순서
- [rename-candidates-2026-08](rename-candidates-2026-08.md) — Lookbox 대체 후보. R3는 Look 고정 해제·컨셉/페르소나형. KIPRIS 미클리어
- [acloset-positioning-2026-09](acloset-positioning-2026-09.md) — Acloset 대비 Lookbox는 범용 AI 옷장이 아니라 구매 전 적합성 검증·구매결정 도구를 차지한다


## Operations
- [ai-usage-cost](ai-usage-cost.md) — 원가는 `ai_usage_logs.metadata.cost_usd`. 착장·기준인물은 usage 미기록. 관리자 `/api/live/admin/ai-cost`
- [chrome-extension-publish](chrome-extension-publish.md) — 웹스토어 게시자명·연락처는 공개. RealCloset 전용 Google 계정, 등록비·2FA·Privacy practices 필요
- [vercel-github-silent](vercel-github-silent.md) — 푸시 메일은 vercel[bot] 댓글. `github.silent`로 댓글만 끈다
- [stale-vite-chunk](stale-vite-chunk.md) — 배포 후 열린 탭의 이전 해시 청크가 404면 Vite preload 오류에서 탭당 한 번 새로고침

## Gotchas
- [recent-tag-field-scroll](recent-tag-field-scroll.md) — 구매처 칩 토글이 입력칸을 붙였다 떼며 시트 높이를 바꾼다; scrollTop/gap을 잡아 `useLayoutEffect`에서 되돌림
- [chiprow-sheet-scroll](chiprow-sheet-scroll.md) — `.lb-chiprow`의 pan-x가 상세 시트 세로 스크롤을 가로챘다. pan-x pan-y + 시트 fixed
- [live-fetch-wake](live-fetch-wake.md) — 새로고침 토스트 '네트워크가 불안정해요'는 Render 첫 OPTIONS 실패. GET에 JSON 헤더를 붙이지 않고 재시도한다
