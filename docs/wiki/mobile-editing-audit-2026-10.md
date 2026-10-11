# 모바일 수정·라이브 누락 점검 — 2026-10-11

2026-10-11 사용자가 「다 푸시해」로 준비된 모바일 수정과 마이 설정 복구의 main 푸시를 승인했다. 직접 입혀보기 서버 영구 저장소 연결과 라이브 활성화는 이번 구현에 포함하지 않았다. 확인한 원격 main은 9d632437이며 로컬 HEAD와 동일하다. 로컬 기능이 라이브에서 안 보이는 주요 이유는 미푸시 커밋보다 DEV/STYLE_STUDIO_LOCAL 조건이다. 실제 배포 SHA와 계정 로그인 피드 요청은 이번 확인에 포함하지 않았다.

## 수정

옷장 선택 안내를 「옷 선택 후 보관·삭제·코디 추천」으로 축약했다. 등록/상세는 계절 → 옷 공개 → 가격 → 재질 → 구매처 → 메모 순서로 공개 옵션을 태그 행처럼 통일했다. 생성/수정 날짜는 상세 입력 마지막이다. 근거: frontend/src/proto/04-screens-ab.jsx, 02-shared.jsx, frontend/src/style/social.jsx/css.

오늘 추천 카드 AI 표시도 PC/모바일 모두 우측 액션과 같은 24px 원형/7px inset으로 표시한다. 코디 상세 내 스타일 CTA는 PC 왼쪽 이미지 아래, 모바일 전체 아이템 아래의 전체 너비 버튼이다. 근거: frontend/src/proto/06-today.jsx, 05-screens-cde.jsx, frontend/src/style/experience.jsx.

피드 오류/재시도를 같은 카드와 모바일 16px 좌우 여백 안에 배치했다. 401 시 로그인 계정 토큰을 refreshSession으로 갱신한 뒤 한 번 재요청하며 동시 갱신을 합친다. 원래 코드는 현재 토큰 조회/익명 갱신만 했다. 실제 피드 오류 원인이 이것으로 확정된 것은 아니다. 근거: frontend/src/live-bridge.js, frontend/tests/live-session-refresh.test.mjs.

편집기 옵션은 기본40dvh에서 최소96px까지 축소 가능하다. 펜 stroke 추가 후 펜 메뉴와 속성을 유지하고 새 stroke 선택 테두리를 표시하지 않는다. 텍스트 기본 옵션150px, 컬러 좌측 정렬, GIF 제목/제공자를 같은 행에 둔다. 근거: frontend/src/style/story-editor.jsx/css.

## 라이브 차이

- 개별 아이템 요청 AI 생성 토글/비용 확인/요청 적용: DEV 조건을 제거한 로컬 수정 준비. 기본 off, 계정 ID별 기기 저장은 유지.
- 직접 입혀보기: frontend/src/main.jsx:57의 DEV import, backend/app/main.py:10011의 STYLE_STUDIO_LOCAL 서버 등록 때문에 라이브에 없음. backend/app/closet_jobs.py:89는 .local SQLite 작업 저장소이므로 조건만 제거해 배포하지 않는다. 영구 작업 저장소/백그라운드 작업 재시작 검증 필요. 이번 변경에서 미활성화.
- 구매내역 로컬 확장 연동도 같은 작업 서버 사용. 등록 시 데모 구매내역은 DEV/orderPreview 조건. 라이브 누락 후보로 별도 승인 검토.
- 선택 추천 설정 전체 캐시 키와 추가 추천 개수는 여전히 DEV/PROD 차이가 있다(09-app.jsx requestPickedOutfits). 샘플 옷장 DEV 시드는 개발용이므로 배포 대상으로 보지 않는다.
- untracked mood/reference/research/preview 파일은 이번 요청에 포함하지 않았다.

## 검증

프로덕션 빌드 성공. 세션 갱신/상품컷/보호 바로 보기 오류 테스트13개 통과. 기존 AI 표시 테스트는 HEAD부터 「AI로 생성」을 기대하지만 원문은 「AI 생성」으로 변경돼 있어2개 실패한다. 테스트를 완화하지 않았다. lint는 오류 없이 기존 경고를 반환한다.

390×844 모바일 브라우저에서 stroke 후 펜 탭 선택/메뉴 유지와 패널 축소(209px)를 확인했다. 텍스트/GIF 화면도 확인 후 GIF flex-direction 보완과 텍스트 시작 시 패널 높이 초기화를 적용했다. 모든 등록/상세/실기기와 라이브 인증의 종합 확인은 미완료다.
