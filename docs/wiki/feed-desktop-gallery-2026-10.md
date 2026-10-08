# PC 피드 갤러리·옷장 기본 진입 — 2026-10-07

사용자가 PC 피드의 큰 단일 게시물·넓은 공백·추천 계정 레일을 전반적으로 개선하고, 서비스 방향에 맞는 첫 화면을 판단해 적용하도록 요청했다.

첫 화면은 옷장으로 정했다. “내 옷으로 나만의 취향을 만들기”의 출발점은 보유 옷이며, 피드는 영감 발견 → 내 옷으로 리스타일하는 보조 진입이다. 기본 URL은 옷장, 명시한 `screen`/`tab` 및 공유 링크는 해당 화면을 유지한다. 랜딩의 개발 전용 샘플 피드 직행도 기존 가입 경로로 바꾸고 CTA를 “내 옷장 시작하기”로 통일했다. 근거: `frontend/src/proto/09-app.jsx:929`, `frontend/src/proto/07-onboarding.jsx:265`. [[realcloset-style-studio-2026-10]]

PC 피드에서 추천 계정·자기 프로필·샘플 꾸미기 우측 레일을 제거하고 전체 폭 갤러리로 변경했다. 760px 이상 2열, 1380px 이상 3열, 1900px 이상 4열, 최대 콘텐츠 폭 1600px. 사진 → 작성자·팔로우 → 반응·저장·아이템·공유·리스타일 → 캡션 순서이며, 사진 자르기나 콜라주 변형은 없다. 키보드 포커스/마우스 hover로 크게 보기 버튼을 표시하고 기존 상세 창을 연다. 모바일은 작성자 → 사진 → 액션 → 캡션의 단일 스트림을 유지했다. 근거: `frontend/src/style/social.css:40`, `frontend/src/style/experience.jsx:103`.

전체·팔로잉 탐색은 기존 follows의 실제 작성자 식별자를 사용하고, 전환 시 스크롤을 맨 위로 복귀한다. 팔로잉에 게시물이 없으면 전체 탐색 CTA를 표시한다. 근거: `frontend/src/style/experience.jsx:60`, `frontend/src/style/experience.jsx:86`.

검증: 실제 Chrome 기본 URL 진입·새로고침 후 옷장 표시, PC 1512px 3열·1024px 2열, 팔로잉 필터 3개 게시물, 룩 상세 열기·닫기, 모바일 390×844 단일 스트림·clientWidth=scrollWidth=390 확인. Vite 빌드, 스타일 모듈 lint, 기존 프런트 5개 테스트 통과. 기존 model.js의 JSON import를 Node에서 읽도록 임시 테스트 loader를 사용했으며 제품 코드는 변경하지 않았다. 공통 proto 파일 lint는 기존 경고가 있으나 오류는 없다. 보호된 바로 보기 동작은 변경하지 않았다.

캡처: `docs/research/realcloset-positioning-2026-10/feed-gallery-desktop-2026-10-07.jpg`. 로컬 적용이며 라이브 배포는 하지 않았다.


## 상세 창·팔로잉 갱신 수정 — 2026-10-07

사용자가 큰 제목·출처 위치·콜라주와 중복 제목의 겹침을 지적했다. SharedContent의 제목은 PC 18px/모바일 17px, 이미지 아래 자동 signature는 숨기고 원본 장식은 유지한다. 400px 상한 이미지와 작은 아이템 목록으로 상세를 정리하고, 메모 없는 샘플의 기본 문구를 제거했다. 스티커/GIF 출처는 본문 하단 구분선 아래로 이동했다. `frontend/src/style/experience.jsx:49`, `frontend/src/style/experience.css`의 `.rc-shared-heading`, `.rc-shared-wardrobe`, `.rc-shared-credits`.

피드의 rc-social-update 처리에서 /state를 갱신하지 않아 다른 영역의 팔로우 변경이 필터에 반영되지 않았다. 이벤트·피드 복귀·필터 전환 시 최신 follows를 조회하도록 수정했다. 실제 UI에서 home.21 상세 팔로우 → 팔로잉 목록 4명 → 해당 카드 언팔로우 → 3명 복귀 확인. PC 제목 18px/signature none, 좁은 모바일 상세 단일 열·가로 넘침 없음 확인. 프런트 빌드·수정 모듈 lint·diff 공백 검사 통과. 캡처: `docs/research/realcloset-positioning-2026-10/feed-detail-2026-10-07.jpg`.

2026-10-07 후속 사용자 요청: PC 작성자·팔로우 행을 이미지 위로 이동해 카드 경계를 표시한다. 현재 순서는 작성자 → 이미지 → 액션 → 캡션. `frontend/src/style/social.css:55`. 모바일 순서는 기존과 동일하다.

2026-10-07 — 탐색 옆 문구를 “저장하고, 내 옷으로 리스타일”로 축약. 모바일에서도 10px/nowrap으로 한 줄 표시. `frontend/src/style/experience.jsx:103`, `frontend/src/style/social.css:71`.


## 피드 끝·출처 위치 — 2026-10-07

마지막 게시물 아래 펼침형 출처 목록을 제거하고 얇은 구분선·“여기까지 둘러봤어요”·“맨 위로 ↑”로 마무리한다. 게시물이 있을 때만 표시하고 빈 상태에는 기존 CTA를 유지한다. 맨 위로는 피드 스크롤만 이동하며 동작 줄이기 설정을 존중한다. PC 끝 여백 32px, 모바일은 하단 메뉴/안전 영역 여백을 둔다.

출처 자체는 제거하지 않았다. OpenMoji를 사용한 게시물 캡션 아래에만 작은 /asset-credits.html 링크, GIF 게시물에만 Powered by GIPHY 링크를 표시한다. 기존 공식 GIPHY 임베드·상세·편집기 출처를 유지한다. 피드 전체의 끝 부분에 출처를 중복 표기할 필요가 없다고 해석하고 필요한 게시물 가까이에 이동했다. CC BY-SA 4.0 3(a)(2)는 필요한 정보를 포함한 페이지의 링크를 합리적인 표기 방식으로 허용한다. GIPHY의 제공자 표기는 유지해야 한다. 근거: https://creativecommons.org/licenses/by-sa/4.0/legalcode.en#s3a , https://support.giphy.com/hc/en-us/articles/360035158592-What-conditions-does-my-app-project-need-to-meet-in-order-to-get-a-production-API-Key .

실제 UI에서 PC/모바일 마지막 영역·기존 rc-feed-attribution 0개·해당 GIF 게시물의 제공자 링크 1개·맨 위로 클릭 후 scrollTop=0 확인. 빌드와 수정 JSX lint 통과. 캡처: `docs/research/realcloset-positioning-2026-10/feed-end-desktop-2026-10-07.jpg`, `feed-end-2026-10-07.jpg`. 구현: `frontend/src/style/experience.jsx`의 rc-post-sources/rc-feed-end, `frontend/src/style/social.css`의 대응 규칙.


## 공개 범위 기본값·항상 보이는 버튼 — 2026-10-07

사용자 요청으로 새 피드/리스타일의 newLook 기본 privacy를 public으로 변경했다. 임시 초안 safeDraft는 private/공유 링크 없음/사진 공개 해제를 유지하며, 편집기의 게시 동작에서 명시적으로 public을 보낸다. 기존 비공개 글의 범위를 자동 변경하지 않는다. `frontend/src/style/model.js:23`, `frontend/src/style/experience.jsx`의 Editor onSave.

공유창 공개 범위 details/summary를 일반 section/제목/3버튼으로 바꿔 PC와 모바일에서 항상 표시한다. 공통 save가 public으로 덮어쓰던 오류도 수정해 공유창에서 선택한 private/link/public을 그대로 저장한다. 본인 공개 피드의 공유창에도 선택 버튼을 연결하되, 저장할 때 내 원본 look을 사용해 공개 응답에서 생략된 필드를 보존한다. 타인 글은 범위를 편집할 수 없다. `frontend/src/style/share-sheet.jsx`, `frontend/src/style/experience.jsx`의 save/feedSharing.

검증: 프런트 6개 테스트(newLook public·사진 동의 별도·safeDraft 비공개 포함), 빌드·수정 JSX lint 통과. 로컬 본인 공개 글로 private → link → public 버튼 선택/저장, 닫고 다시 열었을 때 public 선택 유지·details 0개를 확인하고 원래 범위로 복원했다. 모바일 캡처 `docs/research/realcloset-positioning-2026-10/feed-visibility-2026-10-07.jpg`.


## 코디 투표 목록·만료 표시 — 2026-10-07

“내가 만든 투표”의 펼침형 질문 목록을 항상 보이는 “진행 중인 투표” 카드로 교체했다. 각 카드에 후보 미리보기 2장·후보 수·투표 수·남은 일수(24시간 이내 별도 문구)·한국 시간 기준 종료 날짜/시각을 표시한다. 결과 창과 외부 투표 페이지에도 종료 정보를 표시한다. `frontend/src/style/friend-vote.jsx`의 VoteExpiry/FriendVote, `frontend/src/style/friend-vote.css`의 rc-vote-history-card.

기존 서버는 created_at+7일 expiresAt을 반환하고, 만료 투표를 내 목록에서 제외하며 조회/투표를 404로 거절한다(`backend/app/style_studio.py:355`, `backend/app/style_studio.py:387`). 이번 변경은 그 기간을 유지하고 UI도 매분 만료 여부를 갱신해 목록에서 제외한다. 새 테스트 `test_friend_poll_expires_after_seven_days_and_disappears_from_history`는 기간 7일·만료 목록 제외·조회와 투표 거절을 확인했다.

빌드·수정 JSX lint, 새 만료 테스트 통과. 실제 모바일에서 2개 카드·미리보기·3일 남음/10.10.13:11 종료·결과 열기·가로 넘침 없음 확인. 함께 실행한 기존 `test_friend_poll_snapshots_private_styles_and_unique_votes`는 가격 필드 제거 기대와 현재 반환의 불일치로 실패했으며 이번 UI/표시 변경 범위에서 수정하지 않았다. 캡처: `docs/research/realcloset-positioning-2026-10/vote-history-expiry-2026-10-07.jpg`.


## 기존 게시글 수정·변경 취소 — 2026-10-07

내 게시글을 눌러 편집할 때 새 피드 작성과 구분한다. 기존 글은 헤더 “수정하기”/버튼 “수정 완료”, 새 글은 “만들기”/“게시”. 변경이 없으면 수정 완료 비활성화. 변경 후 완료·닫기 시 “게시글을 수정할까요?” 확인창에서 변경 취소(원본 유지 후 닫기)/수정 완료(원본 id에 저장)를 선택한다. 확인창 바깥이나 닫기 버튼은 편집으로 돌아간다. `frontend/src/style/story-editor.jsx`의 editingExisting/requestClose/confirmEdit.

기존 글 편집은 별도 작성 초안을 덮어쓰지 않으며, 취소 시 원본이나 공개 범위를 바꾸지 않는다. 수정 저장은 기존 privacy를 유지하고 새 글 게시만 public으로 지정한다. 저장 알림도 기존 글은 “수정했어요”로 구분한다. `frontend/src/style/experience.jsx`의 save/Editor onSave.

검증: 빌드·변경 JSX lint 통과. 실제 PC에서 변경 없음 버튼 비활성, 핑크 배경 변경→확인창→변경 취소→아이보리 원본 유지, 변경→수정 완료→다시 열면 핑크 유지 후 원래 아이보리로 복원 확인. 캡처 `docs/research/realcloset-positioning-2026-10/feed-edit-confirm-2026-10-07.jpg`.


## 모바일 서식 메뉴·재료 닫기 화살표 — 2026-10-07

텍스트 서식 도구를 상단에서 하단 도구 탭 위로 이동했다. 서식 도구를 선택하면 캔버스 아래 여유 공간과 화면 높이에 맞춘 크기를 적용해 상단 텍스트 및 캔버스와 겹치지 않는다. `frontend/src/style/story-editor.css:39` 및 마지막 모바일 규칙.

옷장 등 모든 재료 서랍의 닫기 기호를 동일 SVG chevron으로 통일하고 36px 버튼 안에 중앙 정렬했다. 제목과 버튼에 별도 공간을 확보한다. `frontend/src/style/story-editor.jsx`의 rc-material-close.

검증: 빌드·수정 JSX lint 통과. 모바일 FRIDAY 선택 시 캔버스 끝 650.7px/서식 도구 시작 762.7px로 겹침 없음, 옷장 버튼 SVG 중심 오차 0px 및 메뉴 닫힘 확인. 원본 게시글 수정 없음. 캡처 `docs/research/realcloset-positioning-2026-10/editor-text-bottom-2026-10-07.jpg`, `editor-closet-arrow-2026-10-07.jpg`.


## 모바일 선택 패널 축소 — 2026-10-07

옷·이미지·스티커 선택 패널을 48px 높이의 한 줄 바(이름/삭제/선택 해제, 장식은 복제 포함)로 축소했다. 반복되는 두 손가락 크기·회전 안내는 모바일에서 숨기며 캔버스 조절 핸들과 제스처는 유지한다. PC 패널은 유지. `frontend/src/style/story-editor.css`의 마지막 모바일 rc-lab-selection 규칙.

빌드·diff 공백 검사 통과. 실제 모바일 선글라스 선택 시 패널 높이48px, 안내 미노출, 선택 해제 시 바 제거 확인. 원본 게시글 변경 없음. 캡처: `docs/research/realcloset-positioning-2026-10/editor-selection-compact-2026-10-07.jpg`.


## 재료 검색창 상단 스크롤 가림 — 2026-10-07

모바일 재료 패널은 상단 padding20px 내부에서 검색창 sticky top0이 고정되어 그 위로 목록 이미지가 보였다. 검색창 sticky 위치를 top -20px로 맞추고 같은 높이의 불투명 상단 여백을 검색창에 포함해 패널 상단까지 가린다. GIF·스티커·옷 검색창 공통 적용, PC 유지. `frontend/src/style/story-editor.css` 마지막 rc-material-search 규칙.

빌드·diff 공백 검사 통과. 실제 모바일 GIF 목록 scrollTop1042px에서 패널과 검색창 상단476.7px 일치 및 상단 이미지 미노출 확인. 캡처 `docs/research/realcloset-positioning-2026-10/editor-gif-scroll-mask-2026-10-07.jpg`.


## 피드 끝 안내 중앙 배치 — 2026-10-07

좌측 끝 안내/우측 맨 위로 배치가 마지막 카드의 캡션처럼 보이던 문제를 개선했다. 끝 안내와 작은 테두리 버튼을 중앙 세로 배치하고 마지막 행과48px(모바일40px) 간격·분리선을 확보한다. `frontend/src/style/social.css:75`.

빌드·diff 공백 검사 통과. 실제 PC 마지막3열 아래 독립된 중앙 안내 및 맨 위로 버튼 동작 확인. 캡처 `docs/research/realcloset-positioning-2026-10/feed-end-centered-2026-10-07.jpg`.

## 목록 출처를 공통 하단으로 이동 — 2026-10-07

사용자 요청에 따라 발견 목록의 카드 캡션에 있던 리스타일 원본 안내와 카드별 GIPHY/OpenMoji 링크를 제거했다. rc-stream 뒤 독립된 rc-feed-end 안에 중앙 정렬로 배치한다. 제공자 링크는 현재 표시 중인 피드에서 사용된 경우만 한 번 표시한다. 리스타일 원본 안내에는 게시물 작성자를 함께 표시하고 누르면 해당 게시물 상세를 열어 어느 게시물의 원본인지 보존한다. 상세·편집기 출처는 유지한다. 이전 “게시물 가까이 표시” 결정은 이 변경으로 대체한다. 근거: frontend/src/style/experience.jsx 발견 footer, frontend/src/style/social.css rc-feed-origins/rc-feed-credits.

## 이미지와 게시글 작성 분리 · 2026-10-08

리스타일은 원본 title/note를 새 글에 복사하지 않고 origin에만 남긴다. StyleCanvas의 자동 제목 signature와 PNG 내보내기의 자동 title을 제거했다. 사용자가 텍스트 도구로 올린 이미지 장식은 유지한다. StoryEditor는 꾸미기 다음에 이미지 미리보기·600자 글·전체 공개/링크 공개/나만 보기 화면을 제공한다. 이전으로 돌아가도 작업과 글을 보존하고 게시 버튼만 저장한다. 수정 중인 기존 글도 다음 화면에서 글과 공개 범위를 바꿀 수 있고 기존 수정 확인을 유지한다. note를 캡션으로 저장하고 title은 앞 80자 검색/접근성 이름용으로 사용한다. 게시 콜백이 새 글을 강제로 public으로 바꾸던 동작을 제거했다.

피드 아이템은 하나 이상이면 StudioSheet bodyStyle 높이80dvh를 목록/상세에 공통 적용한다. N개 여부와 관계없이 같은 위치에서 내부 스크롤하며, 0개는 기존 내용 높이를 사용한다. 근거: frontend/src/style/story-editor.jsx next/step, model.js remix/styleImageBlob, collage-canvas.jsx, experience.jsx save, product-sheet.jsx, social.jsx StudioSheet. JSX lint 및 프로덕션 빌드 성공.

## GIF 공유 이미지 포함 · 2026-10-08

공유 메뉴의 omitEmbeds와 PNG 내보내기 GIPHY 차단을 제거했다. iframe을 제외하는 대신 동일 GIF ID의 giphy_s.gif 정지 프레임을 CORS 이미지로 읽어 캔버스에 합성한다. 원래 위치·크기·비율·회전·투명도·레이어 순서를 보존하고 Powered by GIPHY를 PNG에 표기한다. 읽기 실패 시 불완전한 이미지를 전달하지 않고 재시도를 안내한다. 피드 링크의 GIF 애니메이션은 유지하며 PNG 공유/저장은 GIF 정지 프레임을 포함한다. media.giphy.com의 샘플 giphy_s.gif HTTP200/CORS * 확인. 근거: frontend/src/style/model.js styleImageBlob, share-sheet.jsx.

## 텍스트 재편집 종료 수정 · 2026-10-08

텍스트 선택 이벤트가 selected 상태를 기준으로 finishText를 호출해 같은 텍스트의 편집도 끝날 수 있던 처리를 editingText 키 기준으로 바꿨다. 같은 편집 키 재호출은 상태/포커스를 초기화하지 않는다. 기존 텍스트는 한 번 눌러 바로 인라인 재편집하며 4px 이상 드래그/회전/핀치는 위치 변경으로 유지하고 클릭 편집을 시작하지 않는다. 근거: frontend/src/style/story-editor.jsx editText/selectElement, collage-canvas.jsx dragged/레이어 onClick.

## 모바일 옵션 시트와 전체 캔버스 · 2026-10-08

기존 옵션은 최대40dvh에 캔버스를 scale .76/translate -16vh로 이동해 윗부분과 아래 요소가 가려졌다. 이미지 편집 단계에서 헤더·하단 도구·옵션 높이를 CSS 변수로 함께 계산한다. 펜/스티커/이미지/GIF/옷장/배경/텍스트 옵션 시트를 clamp(150px,28dvh,220px)로 통일하고 내부에서 스크롤한다. 옵션이 열리면 해당 높이를 캔버스 아래 확보하고 남은 높이의4:5로 이미지 전체를 맞춘다. 텍스트 편집과48px 선택 바에도 공간을 확보한다. scale/translate 방식 제거, 게시글 작성 단계에는 적용하지 않는다. 근거: frontend/src/style/story-editor.css 마지막 모바일 rc-step-1 규칙.

2026-10-08 게시 화면 톤/액션: rc-publish는 모바일 편집기의 어두운 배경을 상속하지 않고 기존 ivory/ink/surface를 사용한다. 게시/수정 완료 액션을 헤더 우측으로 옮기고 꾸미기 다음과 같은 #BF603D 버튼으로 표시한다. 하단 중복 게시 버튼을 제거했다. 근거: frontend/src/style/story-editor.jsx 게시 헤더, story-editor.css rc-publish.

2026-10-08 옵션 높이 재조정: 기본 높이를 이전 펜 시트의40dvh로 복원하고 텍스트/전체 도구 시트에 공통 손잡이를 추가했다. 손잡이를 위로 끌거나 방향키를 누르면 최대56dvh까지 늘리며, 캔버스 표시용 높이를148px 이상 남기는 제한을 함께 적용한다. 메뉴 높이는 도구를 바꿔도 유지하고 실제 높이를 캔버스 공간 계산에 전달하므로 이미지 전체가 함께 작아진다. 변경된 높이보다 콘텐츠가 길면 내부 스크롤한다. 근거: story-editor.jsx panelHandle/resizePanel, story-editor.css rc-requested-panel-height.
