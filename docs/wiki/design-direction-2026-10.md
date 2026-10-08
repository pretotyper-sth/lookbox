# 타겟·시나리오·디자인 시스템 제안 — 2026-10-07

상태: 2026-10-07 사용자 요청으로 색상 적용을 철회했다. 서비스는 요청 전 아이보리·차콜로 복원했고, 공개 비교 페이지와 이미지 시안 경로는 제거했다. 아래 내용은 검토 이력이다.

사용자는 피드에 테마가 적용되지 않은 이유를 묻고, 전체 서비스를 검토해 예상 페르소나와 가상 의견 교환·사용 시나리오를 바탕으로 색상/톤앤매너/디자인 시스템을 제안하라고 요청했다.

피드/상단 배경이 `var(--surface)`로 덮어쓰여 흰 카드 면으로 남았다. `.rc-feed`와 `.rc-feed .rc-page-head`를 공통 `var(--ivory)` 페이지 토큰으로 연결하고 `.rc-post-follow`의 고정 베이지/차콜을 토큰으로 바꿨다. 실제 로컬 UI에서 두 면 모두 rgb(242,247,252)를 확인했다. 사용자 게시물의 배경/사진/장식은 원작대로 유지했다. 근거: frontend/src/style/experience.css의 해당 선택자, docs/research/design-direction-2026-10/feed-fixed-mobile.png.

권장 타겟 가설은 성별보다 ‘스타일 저장→보유 옷 재조합→선택 공유/친구 의견’ 행동자다. 4개 가상 페르소나의 반론을 검토하고 20개 주요 시나리오를 UI/테스트/코드·위키로 구분했다. 실제 사용자 인터뷰·신규 계정 가입·유료 AI 생성·운영 결제·외부 공유/카메라까지 완료했다는 주장이 아니다.

디자인 제안: #F7F9FC 바탕·#FFFFFF 정보 면·#EDF1F5 중성 상품판·#4F5FC7 라벤더 블루 주동작·#E9EDFF 선택 면. Pretendard/본문15px/캡션13px/44px 터치 영역. 브랜드 색과 의미 상태, 앱 표면과 사용자 작품을 분리한다. 주요 글자 조합의 대비 계산은 tokens.json에 기록했다. 제안 팔레트 전체를 서비스에 일괄 적용하지 않았다.

상세 분석: [report](../research/design-direction-2026-10/report.md). 인터랙티브 비교: frontend/public/design-direction.html (3팔레트×오늘·피드·옷장·만들기). 제안 토큰: docs/research/design-direction-2026-10/tokens.json. 실제 서비스의 피드/창작은 frontend/src/main.jsx:56에서 DEV로 로드된다.

검증: frontend build·모델/콜라주5 tests 통과(JSON loader 필요). backend 스타일 스튜디오13 tests 중10 통과·3 실패: 기존 공개 가격 제거 기대값과 현행 가격 포함 응답 불일치. 정책/테스트 정합은 남은 발견사항이며 API/테스트를 이번에 수정하지 않았다. 첫 사진 샘플의 피드 아이템 목록 0개도 UI에서 확인했다. 옷장/AI 이미지 로딩·캐시·바로 보기 보호 코드는 이번 수정에서 변경하지 않았다.

## 승인 후 로컬 적용 — 2026-10-07

사용자가 “화이트 + 라벤더 블루로 가자. 수정해서 로컬에 반영”을 요청했다. 공통 페이지 #F7F9FC·카드 #FFFFFF·중성 상품판 #EDF1F5·주동작 #4F5FC7·선택 면 #E9EDFF를 실제 서비스 기본값으로 적용했다. root 토큰과 TWEAK_DEFAULTS/TONES를 함께 수정했고 피드·프로필·편집기·친구 투표의 고정 베이지/블루 면을 역할별 토큰으로 연결했다. 작품 색과 기존 사진, 카카오 공유 버튼의 브랜드색은 유지했다. 근거: frontend/src/proto/proto.css:81, frontend/src/proto/09-app.jsx:14, frontend/src/style/{experience,story-editor,social,friend-vote}.css.

프로덕션 빌드 성공. 실제 로컬 옷장/오늘/룩북/마이/피드 전환에서 페이지/포인트 색과 가로 넘침 없음 확인. 피드/상단 rgb(247,249,252), 편집기 게시 버튼 rgb(79,95,199) 확인. 캡처: docs/research/design-direction-2026-10/lavender-{wardrobe,feed,editor}-applied.png. 이미지 로딩/캐시·보호된 바로 보기 프레임 및 backend 생성은 변경하지 않았다.
