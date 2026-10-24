# RealCloset 디자인 시스템

UI 수정은 이 문서를 먼저 읽고 기존 공통 컴포넌트를 사용한다. 새로운 디자인 라이브러리 대신 현재 서비스의 아이보리·차콜·Pretendard와 기존 편집기 강조색을 유지한다.

## 원본과 재사용

- `frontend/src/proto/proto.css`의 `:root`: 색상(`--ivory`, `--surface`, `--ink*`, `--line*`, `--accent`, `--danger`), 타입(`--font`, `--fs-*`), 간격(`--s1`~`--s9`, `--gap-header`), 반경(`--r-*`), 모션(`--dur`, `--ease`).
- `frontend/src/proto/02-shared.jsx` `Btn`: primary/secondary/ghost/soft, sm/md/lg, disabled, form/type. 폼 밖 하단 CTA는 form ID에 연결한 submit 버튼으로 엔터 제출과 같은 경로를 쓴다.
- `LabeledField`: 이름 있는 label, 둥근 토큰 입력창, placeholder, 자동완성, required/minLength/disabled, hint/error와 aria-describedby/aria-invalid. 화면에 기본 input을 직접 복제하지 않는다. 기존 숫자 가격 포매팅·커서 유지도 보존한다.
- `AuthPage`: 로그인·비밀번호 찾기·재설정 공통 로고/닫기/제목/설명/스크롤 본문/하단 CTA. `.lb-page-cap`의 반응형 폭·높이 상한을 재사용한다.
- `RangeField`: 크기·회전·투명도 등 수치 조절. 네이티브 키보드 조작과 접근성 이름을 유지하고 테두리 없는 트랙·현재 값·채워진 비율을 표시한다. 편집기는 `--range-accent`만 지정한다.
- `CheckField`: 라벨로 클릭 가능한 네이티브 체크박스. 상태는 호출부가 명시적으로 관리한다.
- 기존 `BottomSheet`, `Icon`, `Chip`, `EmptyState`도 먼저 재사용한다. 로고·섹션 라벨은 `04-screens-ab.jsx`의 `Wordmark`와 `Eyebrow`.

수치/색상은 화면마다 새로 만들지 않는다. 공통 컴포넌트가 없을 때만 가장 작은 것을 공통 파일에 추가하고 여기와 사용 화면을 함께 갱신한다. 제품 화면에 디자인 시스템이나 구현 설명을 노출하지 않는다.

## 인증 화면 확인

`07-onboarding.jsx`의 Login/PasswordReset은 같은 필드와 AuthPage를 쓴다. 입력창 48px·둥근 모서리·중립 배경·작은 label과 보조문구·확인 가능한 키보드 포커스를 유지한다. 모바일 입력 글자는 16px로 iOS 확대를 막는다. 비밀번호 확인 불일치는 해당 필드 아래에 연결하고 서버 오류는 폼 아래에 표시한다. 메일 링크 검증 전/만료/성공은 입력 폼을 보여주지 않는다.

실제 계정 비밀번호를 바꾸지 않는 로컬 UI 검증에서는 격리된 미리보기와 테스트용 인증 응답을 사용한다. 프로덕션에 테스트 URL이나 복구 인증 우회를 추가하지 않는다.

## 만들기 편집기

`style/layer-order.js`가 옷과 장식을 하나의 쌓임 순서로 관리한다. 새 옷은 전체 요소 맨 위에 추가한다. 선택한 요소는 속성 패널/텍스트 도구에서 한 단계씩 앞으로·뒤로 이동하며 되돌리기·저장·공유 이미지에도 같은 순서가 반영된다. 속성 패널 외곽선과 슬라이더 트랙 외곽선은 없애되 캔버스의 선택/크기조절 핸들과 키보드 포커스는 유지한다.

관련 코드: `style/story-editor.jsx`, `style/story-editor.css`, `style/model.js` `styleImageBlob`.

## 편집기 입력·스크롤 회귀 확인 (2026-10-24)

- `style/collage-canvas.jsx`: 텍스트 탭은 pointer-up 한 번에서 편집을 열고 click/double-click 경쟁을 없앤다. 4px 이하 움직임은 위치 변경으로 기록하지 않는다. 빈 textarea는 드래그 가능하고, 입력한 텍스트는 커서 편집을 유지하며 별도 이동 핸들로 옮긴다. 키보드 방향키도 지원한다.
- `style/story-editor.jsx`/`.css`: 모바일은 재료 패널, 데스크톱은 우측 controls가 수직 스크롤을 소유한다. 내부 스티커/GIF/옷/이미지 목록의 중첩 스크롤을 제거하고 도구 전환/높이 핸들 capture 해제 때 drag 상태를 비운다.
- 옷이 없을 때에도 브랜드·가격 체크 상태를 유지하고 다음 아이템에 적용한다. 체크는 재료 소스 버튼 오른쪽에 배치하며 좁으면 자연스럽게 줄바꿈한다.
- `proto.css` `.lb-fab`: 56px에서 42px로 축소(75%), 아이콘 20px. 보이지 않는 클릭 영역은 48px를 유지한다.
- `style/feed-empty.js`: 팔로잉 0명과 팔로잉한 계정의 공개 피드 0건을 구분. `feed-empty.test.mjs`에서 두 문구를 검증한다.

검증: 로컬 격리 화면에서 기존 두 텍스트 첫 클릭 유지, 빈 텍스트 드래그(x50→62.76%, y40→47.87%), 빈 옷장 체크 유지·새 옷 반영, 레이어 앞/뒤, 모바일 탭 전환 후 스크롤(667px), 데스크톱 스크롤(1000px), 인증 폼 불일치/엔터 제출/성공을 확인했다. 빌드 성공, 관련 테스트 14개 통과. 전체 57개 중 51개 통과, 기존과 같은 아이템 추천 4개·AI 마크 2개 실패는 이번 범위에서 변경하지 않았다. 반복적인 터치 기기별 간헐 오류의 모든 조합을 재현한 것은 아니다.
