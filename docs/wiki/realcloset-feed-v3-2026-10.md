# Feed v3 — 2026-10-02

사용자 요청: 메뉴/필터/댓글을 줄이고 Instagram식 단일 피드, 중앙 피드 탭, 더 많은 GIF와 새 예시.

- `frontend/src/style/experience.jsx:62`: 예시 6개 + 실제 공개 게시물. 보관함/기록/프로필 진입, 댓글 UI, 무드/팔로잉 필터, 제목 보라색 기호 제거. 좋아요·저장은 왼쪽, 리믹스는 오른쪽 아이콘. 저장한 룩은 내 스타일의 북마크 아이콘으로 접근. 예시 좋아요는 비활성, 실제 게시물 반응은 기존 API.
- `frontend/src/proto/04-screens-ab.jsx:72`와 `09-app.jsx` 사이드바: 옷장 → 오늘 코디 → 피드 → 룩북 → 마이. 보호된 바로 보기 변경 없음.
- `frontend/src/style/model.js:22`: 기존 로컬 스타일 사진/옷 조각/타이포로 새 예시 6개. 스타일 예시라고 표시하며 가상 반응 수 없음.
- `frontend/src/style/story-editor.jsx` 및 `giphy-catalog.js`: 밈 도구 제거. 공식 GIPHY categories 공개 링크/상세 페이지의 원본 og:image를 확인한 중복 없는 GIF 530개. 카테고리, 목록 내부 검색, 60개 단위 더 보기, 원터치 삽입. 미디어 재호스팅 없이 원본 미리보기/공식 iframe 사용. 전체 GIPHY 실시간 검색은 여전히 API 키 필요.
- `backend/app/style_studio.py:99`: 예시 사진 파일명 Y2k처럼 숫자가 포함된 로컬 이미지 저장 허용. 디렉터리/확장자 제한 유지.
- `frontend/src/style/experience.css`: 모바일 전체 폭, PC 520px 중앙 스트림. 게시물 간 간격 축소. 피드에서만 개발용 데이터 버튼 숨김.

검증: frontend lint·5 tests·build 성공, backend 6 tests 성공. 브라우저에서 모바일/PC 메뉴 순서, 리믹스 편집, GIF 60→120 더 보기, 한글 고양이 검색, 동물 카테고리, 원터치 GIF 삽입 확인. 예시 변경에 종속되던 리믹스 테스트를 중복 상의가 있는 명시적 fixture로 바꿔 실제 옷 재사용 방지 검증을 유지.

스크린샷: `docs/research/realcloset-positioning-2026-10/feed-v3-phone.jpg`, `editor-v3-gif-phone.jpg`, `feed-v3-desktop.png`.

## 편집 도구 후속 개선

- `frontend/src/style/story-editor.jsx`: 되돌리기/다시 하기 문자 대신 일반적인 꺾인 화살표 SVG, 접근성 이름과 툴팁. 이미지 탭의 기본 무드 사진 11개 제거. 직접 업로드/붙여넣기/드롭/주소 추가한 이미지 기록만 표시. 새 편집기를 열어도 원터치로 다시 삽입.
- `frontend/src/style/image-history.js`: IndexedDB에 최근 60개 사용자 추가 이미지 보관, 원본 주소/데이터 중복 제거. 브라우저 로컬 기록이며 계정/기기간 동기화 아님. 예시/리믹스/스티커를 자동으로 개인 이미지 기록에 넣지 않음.
- 스티커/GIF/옷/이미지 기록/텍스트 프리셋 검색. 공통 돋보기 입력, 스크롤 시 검색 위치 고정, 모바일 16px 입력. 스티커는 하트·별·꽃 등 한글 키워드를 영문 태그에도 매칭.
- 모바일 브라우저에서 이미지 주소 추가→되돌리기→다시 하기, 편집기 닫고 재진입→이미지 기록 재사용, 옷 데님 검색, GIF 고양이 검색, 스티커 하트 36개, 텍스트 mood 3개 확인. 기본 이미지 목록 없음 확인. frontend lint/5 tests/build 성공. 스크린샷 `docs/research/realcloset-positioning-2026-10/editor-search-v4.jpg`.

## Feed v5 — 문장·아이콘 메뉴·예시

`frontend/src/style/experience.jsx`: 피드는 기본 발견 화면. 둘러보기/내 스타일 탭을 제거하고 헤더에 ＋(스타일 만들기)/레이어(내 스타일) 아이콘 배치. 개인 영역은 뒤로 버튼으로 피드 복귀. 게시물 더보기와 리믹스의 중복 진입을 제거해 리믹스만 유지. 캡션은 author + title 한 문단만 표시하고 note 두 번째 줄 제거.

`frontend/src/style/model.js`: 예시 8개에 짧은/중간/긴 문장, 전체 사진/겹친 사진/3장 콜라주/타이포/다른 옷 배치 적용. 예시의 OpenMoji 장식 및 반복 CAMERA ROLL 문구 제거. `collage-canvas.jsx`의 showCredits prop으로 피드 캔버스 내 크레딧 숨기고, 실제 OpenMoji/GIPHY 사용 게시물 출처는 피드 끝 접힌 정보에서 명시. 편집/공유 페이지의 출처는 유지.

검증: 모바일 아이콘→내 스타일→뒤로 복귀, 리믹스 진입, 게시물 ···/두 번째 캡션/탭 부재 확인. lint/5 tests/build 성공. 캡처 `docs/research/realcloset-positioning-2026-10/feed-v5-phone.jpg`, `feed-v5-collage.jpg`.

## Feed v6 — 공개 프로필/옷장

본문 폰트 13→12px. 작성자 아바타/이름 버튼으로 CreatorProfile 표시. 게시글/공개 옷 탭, 공개 개수, 아이템 영감 저장. 예시 프로필은 예시라는 표시와 해당 예시 아이템만 사용. 내 스타일의 사용자 아이콘에서 내 공개 프로필과 옷별 공개/공개 취소 설정.

`backend/app/style_studio.py`: public_items 테이블과 /profile(본인), /profiles/{creatorId}(공개), /closet/{itemId}(본인 설정). 공개 옷은 코디 게시와 독립된 명시적 선택. 프로필 게시글은 privacy=public만; link/private 제외. 개별 옷의 가격/비공개 메모 등 허용되지 않은 필드 제외. 다른 소유자에 대한 공개 취소는 불가. 공개 취소 후 타인 조회에서 즉시 제외. 비공개 전체 옷장은 타인에게 제공하지 않음.

`frontend/src/style/creator-profile.jsx`, `experience.jsx`, `experience.css`에서 모바일/PC 프로필/공개 옷 목록 구현. 기존 연구 `gamut-benchmark-2026-10.md`의 작성자 탐색→타인 옷→영감 획득 연결 참조. 개멋 영상에서 개별 옷 공개 토글까지 검증된 것으로 주장하지 않음.

검증: backend 7 tests(프로필 private/link 제외, 공개 옷 명시적 게시/철회, 타인 철회 방지, 허용 필드 포함), frontend lint/5 tests/build 성공. 모바일 샘플 프로필/실제 작성자의 공개 게시글/내 공개 프로필·PC UI 확인. 캡처 `docs/research/realcloset-positioning-2026-10/profile-closet-v6.jpg`.

## Feed v7 — 작성자 팔로우

작성자 헤더 우측에 팔로우/팔로잉 원버튼 토글. 실제 creatorId와 예시 sample:author 식별자 구분. 기존 /state follows에 저장; 반복 게시물에서도 동일 작성자 상태 공유. 접근성 pressed 상태 및 언팔로우 label, 선택 상태별 색 변경. 모바일 팔로우→새로고침 유지→언팔로우와 PC 표시, lint/build 성공. 캡처 `docs/research/realcloset-positioning-2026-10/feed-follow-v7.jpg`.

## Feed v8 — 내 스타일 카드/팔로잉

`experience.jsx` MyStyleCard: 이미지 터치=편집. 제목+공개 상태와 공유/관리 아이콘만 유지. 별도 수정·새 버전·삭제 행 및 작성자/무드/출처 문장/통계 제거. 복제·삭제는 관리 메뉴로 이동. 중복 캔버스 제목/크레딧 숨기고 재료 출처는 관리 메뉴에서 확인.

상단 ＋ 옆 users 아이콘=팔로잉 피드. 기존 follows 식별자로 게시글 필터링, 작성자별 프로필 목록 함께 표시, 같은 아이콘/뒤로 버튼으로 기본 피드 복귀. 팔로잉 없음/공개 글 없음 구분. 언팔로우하면 현재 목록 즉시 갱신.

검증: 모바일 카드/관리 메뉴와 팔로잉 빈 상태→팔로우한 한 사람만 표시→언팔로우 후 0개 확인. PC 카드 4개, 중복 수정 버튼 0개, 팔로잉 아이콘 확인. lint/5 tests/build 성공. 캡처 `docs/research/realcloset-positioning-2026-10/my-style-v8.jpg`, `following-v8.jpg`.

## Feed v9 — PC 구성/상단 접근/간격

`experience.jsx` + `experience.css`: PC 1050px 이상에서 max980px의 메인 피드(최대580px) + 오른쪽 사람 탐색/팔로우·스타일 예시(280px), gap48px 구성. 라이브러리는 별도 단일 영역 유지. 오른쪽 사람/스타일은 이미 있는 공개 피드·예시 데이터이며 추천 알고리즘이나 활동 순위는 아님. 팔로잉 빈 상태는 메인 피드 가운데 아이콘/문장/피드 둘러보기 CTA로 배치.

모바일 상단을 sticky top0 + 안전 영역으로 고정, 화면 section 전환 시 rc-feed의 scrollTop=0. 게시물 구분선 제거, 모바일 간격26px/PC30px. `story-editor.jsx` desktop BottomSheet dismissOnScrim=true로 외곽 클릭 닫힘 복원. 임시 저장 동작 유지, 모바일은 전체 화면 편집기.

검증: PC 실제 모달 외곽 클릭 후 dialog0 확인. 모바일 scrollTop100에서도 headerY0, 팔로잉 전환 시 scrollTop0/headerY0, stream gap26/border0 확인. PC 피드·빈 상태 및 모바일 캡처. lint/5 tests/build 성공. `docs/research/realcloset-positioning-2026-10/feed-v9-desktop.png`, `following-empty-v9-desktop.png`, `feed-v9-phone.jpg`.

## Feed v10 — 작성자 한 줄

피드 작성자 = 사진 + ID + 상대 작성일(분/시간/일/주/개월/년). createdAt 없는 글은 날짜를 만들지 않음. time datetime/정확한 KST 작성시각 툴팁. ID 밑 스타일 예시·무드 문구와 PC 사람 목록 보조 문구 제거. 예시 작성일은 2026-10-01부터 하루 간격의 예시값. 모바일 ID/1일 한 줄 및 small0, lint/build 확인.


## v11 — PC 정렬과 간단한 공유·친구 투표 (2026-10-02)

PC 피드 제목/게시물은 옷장과 같은 좌측 32px, 상단 28px에서 시작한다. 1512px 검증 좌표는 x=280, y=28. 피드 580px + 우측 추천 280px 사이 간격은 80px. 공개 옷장 안내는 “공개할 옷만 골라 주세요.”로 줄였고 모바일 390px에서 19.8px 한 줄을 확인했다.

공유창은 공개 범위 3개와 저장/링크 복사 단일 주동작으로 줄였다. 리믹스/사진 포함과 이미지 다운로드는 접었다. 기존 A/B 드롭다운 대신 “친구에게 코디 투표” 진입점을 두었다. 내 스타일 2~4개를 이미지로 선택 → 질문 입력 → 별도 투표 링크 생성 → 복사. 기존 투표는 같은 창에서 다시 열어 결과를 확인하거나 종료한다.

투표는 `/api/studio/polls`에 별도 스냅샷으로 저장하고 `/?vote=TOKEN`에서 로그인 없이 후보를 선택한다. 원본 스타일의 privacy/share, 피드, 공개 옷장에 영향을 주지 않는다. 사진은 기존 includePhoto 동의 범위를 따른다. 브라우저 세션당 한 표이며 선택 변경은 기존 표를 덮어쓴다. 결과는 표수/비율, 수동 새로고침. 로컬 개발 전용이며 다른 기기 공유에는 배포가 필요하다.

구현: `frontend/src/style/friend-vote.jsx`, `friend-vote.css`, `experience.jsx:53`, `experience.css:35`, `frontend/src/main.jsx:60`, `backend/app/style_studio.py`의 `create_poll`/`vote_poll`/`close_poll`. QA 래퍼 `frontend/public/responsive.html`은 vote 파라미터를 지원한다.

검증: oxlint, frontend 5 tests, backend 9 tests, production build. UI에서 일반 링크 복사, 두 후보 투표 생성/복사, A→B 변경 후 총 1표, 모바일 가로 넘침 390=390, 짧은 안내 한 줄을 확인. 자동 검증은 비공개 원본 유지/외부 소유 스타일 거절/중복 후보 거절/사진 동의/스냅샷 유지/소유자 종료/중복 투표 방지를 포함한다. 스크린샷: `docs/research/realcloset-positioning-2026-10/feed-v11-desktop.png`, `share-v11-mobile.png`, `vote-picker-v11-mobile.png`, `vote-v11-mobile.png`.


## v12 — 꾸미기에서 바로 저장 (2026-10-02)

`frontend/src/style/story-editor.jsx:64`의 save를 PC 하단과 모바일 상단 “저장”에 바로 연결했다. 이름/메모/무드/입고 싶은 날/사진 설정의 두 번째 저장 화면과 단계 상태를 제거했다. 이름·기존 메타데이터·공개 범위는 기존값을 유지하고 추가 입력 없이 저장한다. 새 스타일은 기본 나만 보기. 실패하면 꾸미기 화면과 임시 저장을 유지하며 오류를 표시하고, 저장 중에는 버튼을 잠근다.

`experience.jsx`의 저장 후 공유/나만 보기 선택 배너도 제거했다. 꾸미기 → 저장 → 내 스타일 목록 + 완료 알림으로 끝난다. 공유·친구 투표는 카드 공유 버튼에서 필요할 때 실행한다. 모바일 UI에서 배경 변경 → 저장 한 번으로 5번째 스타일이 생기고 나만 보기로 보관되며, 꾸민 배경이 유지되는 것을 확인했다. PC 저장 버튼도 같은 동작에 연결했다. oxlint와 production build 통과. 스크린샷 `docs/research/realcloset-positioning-2026-10/save-v12-mobile.png`.

2026-10-02 후속 조정: PC 피드/우측 목록 간격을 104px로 늘려 우측 영역을 24px 오른쪽으로 이동.

## 옷 공개 선택 위치와 프로필 빈 상태 (2026-10-03)

옷 추가의 시작 메뉴에서는 공개 범위를 묻지 않는다. 이미지 추출 후 등록 단계에서 각 옷별로 공개 여부를 고르고, 이미 등록한 옷은 상세 수정에서 바꾼다. 내 공개 프로필의 공개 옷 탭에는 안내 문장을 두지 않고, 옷이 없을 때 “옷장에 옷을 추가하면 이 프로필에 표시돼요.”라고 안내한다. 구현: `frontend/src/proto/04-screens-ab.jsx`, `02-shared.jsx`, `style/creator-profile.jsx`.

## v14 — 리스타일·알림·공개 옷장과 내 활동 (2026-10-03)

PC 추천 영역을 남는 공간 끝으로 정렬하고 상단에 내 사진/ID/활동 수를 표시했다. 1512px 화면에서 피드는 x=280/580px, 우측은 x=1200/280px로 분리된다. 1050~1200px는 두 열, 모바일은 기존 단일 피드를 유지한다. 구현: `frontend/src/style/social.css:2`, `frontend/src/style/experience.jsx`.

예시 좋아요가 비활성화됐던 이유는 샘플을 반응 저장 대상에서 제외했기 때문이다. 예시 8개도 서버에 방문자별 좋아요를 저장하고 새로고침 후 선택을 유지한다. 꾸며 재공유하는 기능을 **리스타일**로 명명하고 순환 화살표/별 아이콘으로 변경했다. 공개 피드에 원작을 리스타일한 결과를 게시하면 원작자에게 알림을 저장한다. 나만 보기 저장은 알리지 않는다. 좋아요/팔로우도 피드 상단 종 아이콘에서 확인하며, 목록을 열면 읽음 처리한다. 동일 행동은 중복 알림을 만들지 않는다. `frontend/src/style/social.jsx`와 `backend/app/style_studio.py`의 profile/social/notifications/sample-reactions API.

옷 등록은 공개를 기본값으로 하고 나만 보기를 선택할 수 있다. 단일 등록/다중 등록/주문 가져오기와 기존 옷 상세 수정에 반영했다. 기존 옷은 자동 공개하지 않는다. live item metadata의 public 값과 로컬 프로필 공개 옷 목록을 동기화하며, 비공개 전환/삭제 시 공개 목록에서 제외한다. 다른 방문자에게는 공개 옷의 허용된 정보만 반환한다. `backend/app/main.py:6036`, `backend/app/main.py:7261`, `frontend/src/proto/09-app.jsx:2942`.

마이페이지 게시글/팔로잉/팔로워는 실제 로컬 저장값을 보여주며 각각 목록이 열린다. 게시글 수는 공개 피드 게시글 수이다. PC는 메일 오른쪽, 모바일은 메일 아래 한 줄로 배치했다. 기존 50 크레딧/키·몸무게/바로 보기 설정을 보존했다. `frontend/src/proto/08-mypage.jsx`, `frontend/src/style/social.jsx`.

DEV 채우기/비우기는 현재 옷장 표시 개수로 판단한다. DEV 동작 이후 URL의 `devWardrobe=1`은 실제 서버 옷장을 초기값으로 사용해 `ws=empty`가 채운 데이터를 숨기던 문제를 해결한다. `frontend/src/dev/wardrobe-seed.js:145`, `frontend/src/dev/wardrobe-seed.js:165`.

검증: 서버 14개 테스트(스타일 12/옷 공개 2), 프런트 5개 테스트 및 빌드 통과. PC와 390×844 모바일에서 샘플 좋아요/활동 목록을 확인했다. 별도 로컬 방문자의 좋아요·팔로우·공개 리스타일 3개 알림, 팔로워 목록을 확인했다. 실제 벨트 한 개만 공개해 다른 방문자에게 보임을 확인한 뒤 비공개로 복원했다. 스크린샷: `feed-v14-desktop.png`, `mypage-v14-desktop.png`, `mypage-v14-phone.png`, `notifications-v14-desktop.png` (위 research 폴더).

범위: 개발 환경의 로컬 스타일 스튜디오 구현이다. 알림은 앱 내 목록이며 30초 갱신/포커스 갱신을 사용한다. OS 푸시나 운영 계정 간 실시간 알림은 포함하지 않는다. 스타일 작성자 식별은 기존 로컬 브라우저 소유자 방식을 유지한다.

## v15 — 알림 정렬·편집 아이콘·팔로잉 계정 목록 (2026-10-03)

모바일 알림/활동 시트의 0px 가로 여백을 제거하고 20px 안쪽 여백, 제목과 44px 닫기 버튼을 같은 행으로 맞췄다. PC는 24px 여백을 유지한다. `frontend/src/style/social.css`의 알림/활동 전용 헤더 규칙.

리스타일 아이콘은 순환 화살표와 별 대신 사각형/연필의 편집 형태로 변경했다. 서비스와 같은 currentColor/1.7px 선을 사용한다. `frontend/src/style/social.jsx:9`.

피드 상단 팔로잉 버튼과 우측 팔로잉 보기는 계정 목록 시트를 연다. 가로 아바타 스트립과 팔로잉 필터 피드 경로를 제거했다. 목록은 사진/ID/팔로잉 해제 버튼으로 구성되며 계정을 누르면 해당 프로필의 게시글/공개 옷 탭을 볼 수 있다. 게시글이 없는 계정도 social API 목록을 통해 표시한다. `frontend/src/style/experience.jsx`의 followingOpen/followingPeople.

검증: 빌드와 프런트 5개 테스트 통과. PC/390px 모바일 계정 목록, 계정 선택 후 프로필 게시글/공개 옷 탭, 모바일 알림 제목 x=36px 정렬 확인. 스크린샷 `following-v15-desktop.png`, `following-v15-phone.png`, `notifications-v15-phone.png`.

## v16 — 기존 시트 구조 통일·빈 옷장 상단 제거 (2026-10-03)

새 활동/알림/프로필/공유/스타일 관리/상세/친구 투표 모달을 `StudioSheet`로 통일했다. 기존 `BottomSheet`와 `lb-sheet-body`를 그대로 사용하며 모바일은 하단 손잡이 시트, PC는 중앙 모달이다. 기존 계정 수정 시트의 24px 본문 여백, 19px 제목, 36px 닫기 버튼 배치를 적용했다. 게시글/계정 목록을 내용 영역 안에 배치하고 긴 내용은 내부에서 스크롤한다. `frontend/src/style/social.jsx:8`, `frontend/src/style/social.css`, `frontend/src/style/experience.jsx`, `frontend/src/style/friend-vote.jsx`.

공통 시트를 body portal에 렌더링해 화면별 stacking context 때문에 DEV 버튼이 시트 위에 겹치던 문제도 해결했다. 마이페이지에서 열리는 활동 목록도 피드 클래스에 의존하지 않는다.

`frontend/src/proto/04-screens-ab.jsx`의 WardrobeScreen 빈 화면 분기에서 모바일 TopBar/+를 제거했다. 중앙 아이템 추가 CTA만 남고 빈 화면이 콘텐츠 영역 중앙을 사용한다. 하단 이동 메뉴는 유지한다. 기존 아이템/보관 아이템이 있는 화면의 헤더·필터·추가 동작은 변경하지 않았다.

검증: 빌드/프런트 5개 테스트 통과. PC 팔로잉 모달, 모바일 마이 게시글 하단 시트/안쪽 여백/DEV 겹침 제거, 빈 옷장에서 아이템 추가 버튼 한 개를 확인했다. 스크린샷 `posts-v16-phone.png`, `empty-v16-phone.png`.

## v17 — 프로필 높이·꾸미기 재료 저장·게시글 보기·터치 스크롤 (2026-10-03)

프로필 시트는 `min(76dvh,720px)` 높이를 유지하고 게시글/공개 옷 콘텐츠 영역만 스크롤한다. 제목/소개/탭은 고정되어 탭별 아이템 수가 시트 크기에 영향을 주지 않는다. `frontend/src/style/social.css`의 rc-creator-content와 프로필 시트 높이 규칙, `frontend/src/style/creator-profile.jsx`.

공개 옷의 ‘영감에 담기’를 ‘꾸미기에 저장’으로 변경했다. 비동기 저장/저장됨/실패 상태를 버튼과 오류에 반영한다. 저장한 item collection은 만들기 → 옷 → 저장한 옷에서 검색하고 원터치 삽입한다. 보유 옷 데이터와 추천에는 포함하지 않는다. 프로필은 기존 저장값을 읽어 중복 저장을 막는다. `creator-profile.jsx`, `experience.jsx`의 saveItem, `story-editor.jsx`의 allSourceItems. 샘플 프로필 공개 옷은 서로 다른 예시 재료 10개로 확장했다. 실제 사용자 공개 범위는 유지한다.

프로필 게시글은 샘플도 먼저 상세를 연다. 상세에서 리스타일하기를 눌러야 편집기로 넘어간다. 피드 프로필에서 연 상세를 닫으면 프로필로 돌아온다. 마이 활동 목록의 샘플 게시글도 post query로 상세를 연다. `experience.jsx`의 initialLook/openLook/closeDetail, `social.jsx`의 프로필 onOpen.

내 스타일 카드의 옷/장식 레이어에 편집용 touch-action:none이 적용되어 터치 스크롤을 막았다. 읽기 전용 rc-canvas는 pan-y를 허용하며 편집기의 이동/펜/변형 제스처는 유지한다. `social.css`의 rc-canvas:not(.rc-editable) 규칙.

검증: 빌드/프런트 5개 테스트 통과. 모바일 탭별 프로필 높이 641.4375px 동일, 공개 옷 10개/목록 868px를 391px 내부 영역에서 스크롤 확인. 블루 셔츠 저장 → 저장한 옷 표시 → 와이드 데님 캔버스 삽입 확인. 게시글 상세/프로필 복귀 확인. 내 스타일 PageDown 후 scrollTop=685.5px, 읽기 전용 옷 touch-action=pan-y 확인. 스크린샷 `public-closet-v17-phone.png`.

## v18 — 프로필 이미지 확대·재료 저장 토글 아이콘 (2026-10-03)

사용자 후속 요청으로 프로필 사진/공개 옷 이미지/게시글 콜라주 클릭은 확대만 수행한다. 프로필 위의 이미지 뷰어를 닫으면 기존 프로필과 선택 탭이 유지된다. 게시글의 상세/편집 이동을 프로필 클릭에서 제거했고 저장한 재료 활용 기능은 유지한다. 확대는 backdrop/닫기 버튼/Escape로 종료한다. `frontend/src/style/creator-profile.jsx`의 preview portal.

타인의 옷 재료 저장을 이미지 우측 하단 32px 북마크 아이콘으로 이동했다. 미저장은 테두리 아이콘/밝은 배경, 저장은 채워진 아이콘/어두운 배경으로 구분한다. 다시 누르면 서버 collection에서도 제거하며 편집기 state를 갱신한다. 저장 중 중복 클릭을 잠그고 오류를 표시한다. 내 옷 공개 설정 버튼은 유지한다. `creator-profile.jsx`의 saveItem, `experience.jsx`의 rc-style-material-update, `social.css`의 rc-material-save.

검증: 모바일 사진/게시글/옷 이미지 각각 확대 확인, 블루 셔츠 저장 해제(false)/재저장(true) 확인. PC 게시글 확대 확인. 빌드/lint 및 프런트 5개 테스트 통과. 스크린샷 `public-closet-v18-phone.png`.

2026-10-03 v19: 1201px 이상 PC에서 피드 레이아웃 우측에 clamp(32px,4vw,80px) 여백을 추가했다. 추천 영역을 왼쪽으로 옮기면서 피드 위치/추천 폭은 유지한다. 1512px 화면에서 추천 x=1139.5px(기존 1200px), 오른쪽 여백 92.5px(기존 32px) 확인. `frontend/src/style/social.css`, 스크린샷 `feed-v19-desktop.png`.

2026-10-03 v22: PC 편집기 헤더를 STYLE LAB/만들기 왼쪽, undo/redo/닫기 오른쪽으로 정리했다. 브랜드/제목 간격 14px, 헤더 아래 20px 여백. 44px 버튼 안의 22px SVG를 가운데 정렬하고 같은 행/8px 간격으로 표시한다. 모바일 기존 헤더 구조는 유지한다. `frontend/src/style/story-editor.jsx`, `story-editor.css`. PC 버튼/SVG 좌표 확인과 빌드 통과. 스크린샷 `editor-v22-desktop.png`.

2026-10-03 v23: 만들기 이미지 주소 입력/URL 붙여넣기·드롭 가져오기 제거. 파일 업로드/파일 붙여넣기·드롭/개인 이미지 기록은 유지한다. ‘이미지 추가’, ‘추천 문구’(QUICK TYPE 대체), ‘옷장’, ‘샘플/내 아이템/저장한 아이템’으로 문구 정리. 저장 재료 도움말 경로도 일치시켰다. `story-editor.jsx`, `experience.jsx`. PC 도구 UI/빌드 확인. 스크린샷 `editor-v23-desktop.png`.

2026-10-03 v24: 편집기의 ‘원작에서 시작한 나의 버전’ 서브 타이틀 제거. PC BottomSheet 배경을 편집기와 동일한 rgb(243,240,230)으로 지정해 상단 흰 여백을 제거했다. 캔버스의 OpenMoji 링크를 제거하고 편집기/상세의 ‘스티커 출처’에서 `frontend/public/asset-credits.html`로 안내한다. 제작자/원본/CC BY-SA 4.0/변경 사항과 그래픽 라이선스 적용 범위를 명시한다. OpenMoji 공식 README Attribution Requirements가 앱 소개/푸터를 표기 위치로 예시하고, CC BY-SA 4.0은 합리적인 방식의 출처 표기를 허용하므로 화면 표기를 재배치했다. https://github.com/hfg-gmuend/openmoji#attribution-requirements / https://creativecommons.org/licenses/by-sa/4.0/ . 독립 PNG의 기존 출처 표기와 GIPHY 표기는 유지한다. UI에서 서브 타이틀 0개/캔버스 OpenMoji 링크 0개/푸터 출처 링크 1개, 배경 일치, 빌드/lint 확인. 스크린샷 `editor-v24-desktop.png`.

2026-10-03 v25: PC ‘레이어’ 버튼을 ‘꾸미기 요소’로 변경하고 캔버스 격자 영역 상단 우측에 배치했다. 캔버스 아래 history 행은 제거하고 요소 목록 열기/닫기는 유지했다. 선택 요소 접근성 문구도 통일했다. `story-editor.jsx`, `story-editor.css`. 버튼 y=154.8/캔버스 y=194.8, 목록 토글/빌드/lint 확인. 스크린샷 `editor-v25-desktop.png`.

2026-10-03 v26: 사용자 정정으로 꾸미기 요소 버튼을 격자 영역 우측 하단으로 이동하고 캔버스 이미지를 중앙에서 16px 왼쪽으로 옮겼다. 하단 여백 48px 안에 버튼이 위치하며 별도 아래 행은 없다. PC에서 이미지 아래 버튼/좌우 여백 약 106px·138px 확인. `story-editor.css`, 스크린샷 `editor-v26-desktop.png`.

2026-10-03 v27: 꾸미기 요소 버튼과 실제 캔버스 아래 끝선을 맞추고 남던 하단 여백을 줄였다. 스티커/GIF ‘더 보기’를 제거하고 스크롤 목록 안 sentinel/IntersectionObserver로 다음 100개/60개 묶음을 추가한다. 처음에는 100개/60개만 렌더링하며 필터 변경 시 기존 초기화 동작을 유지한다. 개인 이미지 기록이 없으면 ‘아직 추가한 이미지가 없어요.’를 검색바 아래 표시한다. `story-editor.jsx`, `story-editor.css`. PC 아래 끝선 y=482.8 일치, 스티커 100→200/GIF 60→120 UI 확인. 빌드/lint 통과. 스크린샷 `editor-v27-desktop.png`.

2026-10-03: 편집기 배경 바깥 여백을 누르면 선택과 옷 교체 모드를 해제한다. 요소/꾸미기 요소 버튼 클릭은 유지한다. `frontend/src/style/story-editor.jsx:74`. PC에서 선택 테두리/선택 패널 1→0 확인.

2026-10-03: 피드 헤더를 본문 열 밖으로 분리해 PC 전체 콘텐츠 폭에 배치했다. 상단 아이콘 오른쪽 끝과 추천 영역 오른쪽 끝을 맞추고 프로필/추천은 헤더 다음 행에 둔다. 모바일 단일 열 유지. `frontend/src/style/experience.jsx:89`, `frontend/src/style/social.css`. PC 아이콘/추천 우측 x=1419.5, 본문/추천 상단 y=77 확인, lint 통과.

## PC 헤더·활동 페이지·게시/공유 간소화 (2026-10-03)

피드와 내 스타일은 PC 제목 높이와 오른쪽 네 버튼 좌표를 공통으로 사용하며, 피드 오른쪽 추천 영역도 콘텐츠 오른쪽 끝에 맞춘다. 헤더 팔로잉은 검색/더 보기/언팔로우가 있는 별도 화면, 알림도 30개씩 더 불러오는 별도 화면이다. 모바일에서도 동일한 화면 전환이다. 알림 서버는 페이지 밖 미확인 알림까지 합산하고 기존 100개 제한을 페이지 단위 조회로 바꾼다.

작성 중인 작업은 편집기와 내 스타일 이어 만들기 안내에서 폐기할 수 있다. 편집기 게시 시 privacy=public으로 저장해 피드에 올라간다. 공유창은 기기 공유/링크 복사/친구 코디 투표만 제공하며 공개 범위·추가 설정·이미지로 저장을 제거했다. 코디 투표는 후보 2~4개를 고르는 화면으로 축소, 질문 입력 없이 서버 PollBody의 “어떤 코디가 더 좋아?” 기본값을 저장한다. 후보 목록만 내부 스크롤하여 생성 버튼을 볼 수 있게 한다.

구현: `frontend/src/style/experience.jsx`, `social.jsx`, `social.css`, `story-editor.jsx`, `friend-vote.jsx`, `friend-vote.css`; `backend/app/style_studio.py` notifications. 검증: 프런트 빌드/5개 테스트, 서버 13개 테스트(105개 알림 페이지 중복·소유자 격리·전체 미확인 수 포함). 변경 JSX lint는 오류 없고 기존 Fast Refresh 경고 3개. PC 실제 헤더 좌표/팔로잉·알림 페이지/공유·투표 입력 제거 확인.

## 저장한 룩의 피드 액션 통일 (2026-10-03)

`frontend/src/style/experience.jsx`의 `PostActions`를 피드와 저장한 룩 카드가 공유한다. 이미지 아래 왼쪽 좋아요·저장, 오른쪽 편집 아이콘을 동일하게 표시하며 기존 텍스트 시작 버튼과 샘플/무드 설명을 제거했다. 저장한 스냅샷보다 현재 피드/샘플 반응 데이터를 먼저 사용해 좋아요 상태와 수를 동기화한다. 편집은 기존 `beginRemix`를 통해 새 id의 스타일을 열며 게시하면 원작과 별도 피드 게시물이 된다. PC 저장한 룩 화면에서 아이콘 배치를 확인했다.

## 마이페이지 팔로워·팔로잉 전용 페이지 (2026-10-03)

피드 헤더의 팔로잉 아이콘과 추천 계정의 팔로잉 보기 링크를 제거했다. 마이페이지 `SocialStats`의 팔로워/팔로잉 수를 누르면 `MyPageScreen`이 `ConnectionsPage`로 전환한다. 팔로워 | 팔로잉 탭, 실제 social API 인원과 수, 탭별 검색, 50명 단위 더 보기, 프로필 열기와 팔로잉 해제를 제공한다. 뒤로 버튼은 마이페이지로 돌아간다. 빈 안내는 팔로워에서 “아직 나를 팔로우한 사람이 없어요.”, 팔로잉에서 “아직 팔로우한 사람이 없어요.”이다. 게시글 목록은 기존 시트를 유지한다. 구현: `frontend/src/style/social.jsx` ConnectionsPage/SocialStats, `frontend/src/proto/08-mypage.jsx` peopleTab, `experience.jsx` 헤더/우측 링크 제거, `social.css` 페이지 배치. PC에서 팔로워 0명과 팔로잉 3명 탭 전환을 확인했다.

## 알림 페이지 반응형 배치 (2026-10-03)

`frontend/src/style/social.jsx` NotificationPage는 빈 목록을 벨 아이콘/제목/설명으로 표시한다. 실제 알림은 최근 알림 제목과 의미 있는 ul 목록, 프로필 사진/줄바꿈 가능한 내용/날짜와 목적/스타일 썸네일로 구성한다. `social.css`는 PC 720px 중앙 패널과 모바일 16px 가로 여백을 사용한다. PC 행은 44px 아바타/48px 썸네일, 모바일은 40px/42px로 제한하며 텍스트가 남은 폭에서 줄바꿈한다. 빈 안내 카드는 PC 360px/모바일 320px 높이로 정리한다. 알림 30개 페이지네이션과 열람 시 읽음 처리는 유지한다. PC 및 390×844 모바일 빈 상태를 확인했다.

## 빈 안내·스타일 관리 공통 구조 통일 (2026-10-03)

알림 빈 상태의 별도 카드와 폰트/아이콘 규칙을 제거하고 옷장·오늘 코디와 같은 `window.EmptyState`를 사용한다. 피드 헤더 아래 남은 공간에서 중앙 배치하며 96px 아이콘 원/21px 제목/14.5px 설명을 공유한다. `StudioSheet`는 선택적 title을 받아 기존 공통 헤더를 제공한다. 스타일 관리는 이 헤더와 lb-navitem 메뉴 구조를 사용하고 experience.css에 남아 있던 전용 헤더/버튼 여백 규칙을 제거했다. 메뉴는 14px/19px 아이콘/48px 이상 행과 공통 삭제 색을 사용한다. PC·390px 모바일 알림 빈 상태 및 스타일 관리 화면을 확인했다. 구현: social.jsx StudioSheet/NotificationPage, experience.jsx managing, experience.css/social.css.

## 코디 투표 공통 모달 헤더와 여백 (2026-10-03)

FriendVote의 전용 제목/닫기 버튼/중복 padding을 제거하고 StudioSheet의 title/description을 사용한다. 공통 헤더는 제목 19px와 36px 닫기 버튼, 설명 13px/제목 아래 8px/본문 아래 16px 간격이다. 투표 후보 목록 위 20~24px 중복 margin과 본문 12px 상단 padding을 제거했다. 후보 목록만 스크롤하고 게시 버튼 앞 16px 간격을 유지한다. `frontend/src/style/social.jsx` StudioSheet, `social.css` rc-sheet-heading/description, `friend-vote.jsx` FriendVote, `friend-vote.css`. PC와 390×844 모바일에서 확인했다.

2026-10-03: 만들기 헤더의 폐기 버튼과 onDiscard 연결/전용 CSS를 제거했다. 기존 내 스타일 초안 안내의 폐기는 유지한다. 리스타일 진입 시 카테고리 기반 내 옷 교체 안내 토스트를 제거했다. 매칭 로직은 기존 remix를 유지한다. experience.jsx beginRemix/Editor, story-editor.jsx 헤더.

## 코디 투표 7일 만료 (2026-10-03)

투표 생성 시 서버 UTC 생성 시각을 저장하고 정확히 7일 후 내 투표 목록에서 제외한다. 만료된 링크 조회와 투표 제출은 404와 종료 안내를 반환한다. 생성 모달에 “투표는 만든 날부터 7일 후 사라져요.”를 표시한다. 기존 투표는 생성 시각이 저장되어 있지 않아 최초 마이그레이션 시각부터 7일을 적용한다. 만료 데이터는 서버에 남지만 사용자에게 노출되지 않는다. `backend/app/style_studio.py` db/create_poll/poll_result/my_polls, `frontend/src/style/friend-vote.jsx` FriendVote.

## DEV 옷장 채우기 응답 오류 수정 (2026-10-03)

DEV 옷장 복제 후 호출하는 `/api/live/coordinate`는 SSE 응답이다. 기존 `res.json()`이 첫 패딩 코멘트 `:`에서 실패해 복제된 옷도 `ws=empty` 화면에 숨겨진 채 남았다. `frontend/src/dev/wardrobe-seed.js` api는 JSON/SSE를 구분하고 진행 이벤트를 제외한 마지막 결과를 사용하며 본문의 error도 처리한다. 룩북 추천 실패는 경고로 남기고 옷장 채우기 후 `devWardrobe=1` 화면 전환은 계속한다. 부팅 시 추천 실패도 옷장 초기값과 분리한다. 프런트 빌드 통과.

실제 Chrome의 `?screen=wardrobe&ws=empty&saved=empty&devWardrobe=1`에서 뉴발란스/울 코트/벨트/셔츠 등 복제 아이템 표시와 DEV 파싱 오류가 없는 것을 확인했다. 이미 복제된 데이터를 사용해 재복제로 다른 DEV 세션 데이터를 삭제하지 않았다. 화면: `docs/research/icon-candidates/dev-wardrobe-fixed.jpg`.

## 피드 상품 목록·만들기 재료 (2026-10-06)

피드/저장한 룩 카드의 북마크 바로 옆 목록 아이콘이 `ProductSheet`를 연다. 게시물 items에 담긴 상품컷·작성자 브랜드/기록 가격/색상/사이즈/소재/구매처/메모/상품 링크만 표시한다. 중복 상품 ID는 한 번만 보여주고, 등록 상품이 없는 게시물에는 빈 안내를 표시한다. 행을 누르면 같은 모달 안에서 상세/목록 복귀와 만들기 재료로 담기를 제공한다. 기존 `StudioSheet`/`BottomSheet`에 dismissOnScrim을 적용해 목록/상세 모두 바깥 클릭으로 닫는다.

담기는 기존 로컬 collections의 type=item, kind=inspiration으로 저장한다. 저장한 룩 type=look 및 실제 ctx 옷장 데이터와 분리되고 중복 저장은 막는다. 새 담기 화면에는 담김 상태를 표시한다. 만들기 → 옷장 도구의 기존 저장한 아이템 이름을 만들기 재료로 통일했다. 새 게시물 상품 정보가 저장 때 빠지지 않도록 두 thumb와 backend clean_item에서 브랜드/가격 외 입력 필드를 유지한다. 과거 게시물에서 저장되지 않은 값은 복원하거나 추측하지 않는다.

근거: frontend/src/style/product-sheet.jsx:1, experience.jsx PostActions/saveItem, story-editor.jsx thumb/옷장, backend/app/style_studio.py clean_item. 모바일에서 목록→상세 표시와 상품 이미지 contain 및 바깥 클릭 닫힘을 확인했다. 변경 JSX lint 통과. 사용자 저장 데이터에 확인용 아이템을 추가하지 않았다. 로컬 전용.

## 피드 공유 (2026-10-06)

피드와 저장한 룩 카드에서 상품 목록 옆 종이비행기 아이콘으로 ShareSheet를 연다. 카카오톡·다른 앱·링크 복사·이미지 저장을 제공하고 기존 StudioSheet의 바깥 클릭 닫기를 적용한다. 공유 PNG는 model.js styleImageBlob에서 기존 exportImage와 같은 상품컷/브랜드/가격/AI 착장/장식 레이아웃으로 생성한다. 사용자 클릭 전에 File을 준비해 navigator.canShare({files}) 지원 시 native 공유창으로 보낸다. 카카오톡 직접 SDK 전송은 연결되지 않았고, 공유창에서 사용자가 카톡의 나와의 채팅 또는 지인 대화를 선택한다. 파일 공유 미지원 브라우저는 PNG를 내려받고 대화에 첨부하도록 안내한다. GIF iframe은 공유 PNG에서 제외하고 안내한다.

로컬 피드 링크는 외부에서 접근할 수 없어 현재 기기 전용 안내를 표시하고 외부 공유에는 PNG를 사용한다. 샘플 링크는 기존 post 파라미터 상세 진입을 사용한다. 타인 게시물은 수정하지 않고 기존 공유 토큰만 사용한다. 본인 비공개 게시물의 링크 복사는 privacy=link로 저장하며 public으로 강제 공개하지 않는다. 본인 공개 범위 선택과 친구 투표 기능은 유지한다.

근거: frontend/src/style/share-sheet.jsx:1, experience.jsx PostActions/LookCard, model.js styleImageBlob/exportImage. 변경 JSX/JS lint 통과. 로컬 모바일 화면에서 목록 옆 버튼, 공유 모달, 실제 생성 PNG 미리보기, 활성 공유 버튼을 확인했다. 실제 메시지 전송은 수행하지 않았다.

## 상품 입력량별 샘플 (2026-10-06)

model.js sampleProductNotes에서 게시물별 입력 예시를 적용한다. pocket.mp3는 기존 기록 가격과 색상/사이즈/소재/구매처/메모가 있는 예시, 가격과 메모만 있는 로퍼를 제공한다. noir.zip 하의와 three.fits 상품은 브랜드·가격 없이 종류만 기록한다. denim.00/late.archive/home.21에는 가격 없는 브랜드/사이즈, 일부 필드만 있는 예시를 섞는다. 추가 필드는 가상 작성자 입력 예시이며 실제 상품 사양이나 현재 판매 가격으로 검증한 값이 아니다. 실제 생성 착장과 상품컷은 유지한다. 게시물별 아이템 ID로 같은 컷의 다른 입력 예시가 만들기 재료 저장 시 충돌하지 않도록 한다.

근거: frontend/src/style/model.js sampleProductNotes/itemAt. lint 통과. 로컬 상품 상세에서 블루종의 389,000원·색상·사이즈·소재·구매처·메모, noir.zip 하의의 종류만 표시되는 것을 확인했다.

## 빈 저장한 룩·공개 옷 담기·공유 간소화 (2026-10-06)

저장한 룩이 없으면 기존 공통 EmptyState를 남은 공간 중앙에 표시하고 피드 둘러보기로 연결한다. 공개 옷 탭은 ‘담은 옷은 만들기 → 옷장 → 만들기 재료에서 꾸밀 때 써요.’ 한 줄을 표시한다. 저장 버튼의 접근성/툴팁 이름은 만들기 재료로 담기/빼기로 통일하고 담긴 카드에 재료에 담김을 표시한다. 실제 옷장 아이템 및 저장한 룩과는 계속 분리한다.

공유창의 카카오톡 전용 버튼과 상시 장문 안내를 제거했다. 다른 앱으로·링크 복사·이미지 저장 3개만 유지한다. 다른 앱으로는 기존 native 파일 공유를 사용하며 카톡을 선택할 수 있는지는 기기의 앱/공유창 지원에 따른다. 카카오 SDK, 개발자 계정, API 호출은 추가하지 않았다. 로컬 링크 제한은 버튼 부제 로컬 링크와 복사 후 짧은 상태 메시지로만 표시한다. 이전 카카오톡 버튼 4개 구성은 이 변경으로 대체된다. 근거: experience.jsx savedLooks/rc-saved-empty, creator-profile.jsx, share-sheet.jsx. 변경 JSX lint 통과, 로컬 저장한 룩 빈 화면·공유 3개 버튼·공개 옷 담김 표시 확인. 실제 외부 전송은 수행하지 않았다.

2026-10-06: 공개 옷 탭의 상시 만들기 재료 경로 안내를 제거했다. 담기 성공 때만 CreatorProfile의 portal 토스트로 “만들기 재료에 담았어요”를 2.6초 표시한다. 모바일 한 줄(12px/nowrap). Feed 부모 알림은 quiet 옵션으로 중복 표시하지 않으며 관계 목록 경유 프로필에서도 동일하게 표시한다. 근거: creator-profile.jsx notice/saveItem, experience.jsx saveItem, social.css rc-material-toast.

## 공개 게시글 편집·단독 빈 화면 통일 (2026-10-06)

CreatorProfile 본인 게시글 썸네일의 기본 클릭은 확대를 유지한다. 본인 카드/확대 화면 우측 하단의 별도 연필 버튼은 onEdit로 연결해 프로필을 닫고 기존 본인 looks의 같은 ID 원본을 만들기에 넘긴다. 타인 게시글에는 편집 버튼을 표시하지 않는다. 중첩 버튼 없이 article 안 확대/편집 버튼을 분리한다.

내가 만든 스타일 없음은 저장한 룩과 같은 공통 EmptyState(아이콘·제목·짧은 설명·스타일 만들기 CTA)로 교체하고 남은 공간 중앙에 배치한다. 공개 피드 없음도 같은 컴포넌트를 사용하고 추천 사이드바를 숨긴다. 팔로워·팔로잉 목록 없음/검색 결과 없음 단독 페이지도 공통 EmptyState로 통일한다. 프로필 모달 탭 안 빈 안내/재료 서랍/오류·로딩 문구는 이 단독 페이지 변경 범위에서 제외한다. 근거: creator-profile.jsx onEdit/rc-profile-post-edit, experience.jsx rc-saved-empty, social.jsx rc-connections-empty 및 대응 CSS. JSX lint 오류 없음(기존 export 경고). 로컬 실제 계정 스타일 0개 상태에서 공통 빈 화면 표시 확인. 현재 공개 게시글 0개라 실제 게시글의 편집 진입 클릭은 미확인; 확인용 사용자 게시글을 생성하지 않았다.
