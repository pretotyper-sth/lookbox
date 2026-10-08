# RealCloset — 스토리형 스타일 만들기 (2026-10-02)

사용자는 구매 검토 사이드 메뉴 제거, 구매 전 도움받기 CTA 유지, 더 힙하고 날것의 스타일 만들기와 펜·스티커·이미지·GIPHY·밈 재료를 요청했다. 기존 룩북/피드 셸은 유지하고 편집기만 라임·차콜·종이 격자 톤으로 변경했다.

## 구현

- `frontend/src/proto/09-app.jsx:3045`: 사이드 구매 검토 항목 제거, 구매 전 도움받기 CTA 유지. 바로 보기 체크포인트 변경 없음.
- `frontend/src/style/story-editor.jsx:26`: 8개 도구(스티커/펜/텍스트/이미지/GIF/밈/옷/배경), 꾸미기 → 이름 붙이기 → 저장 → 선택 공유. 새 스타일 비공개 기본값. 30회 되돌리기/다시 하기, 임시 저장, 레이어 이동·크기·회전·투명도·순서·복제·삭제, 3개 움직임.
- `frontend/src/style/collage-canvas.jsx:16`: 드래그/터치, 4개 펜 브러시, 8색, 정규화 SVG 선. 키보드 선택과 방향 이동 대안. 편집기는 body 포털로 띄워 모바일 하단 메뉴/개발 버튼보다 위에 표시한다.
- `frontend/src/style/sticker-catalog.js`: 직접 제작한 콜라주 SVG 84종(14계열 × 6색).
- `frontend/src/style/collage.js`: 기본 이모지 144종, 한 줄 문구 36종, 편집 가능한 밈 시작 템플릿 12종, 글꼴 5종. 밈은 직접 작성한 문구와 원본 콜라주 그래픽이며 외부 유명 밈을 복제하지 않았다. 외부 밈 이미지는 업로드/주소로 가져올 수 있다.
- `frontend/src/style/openmoji-catalog.js`: OpenMoji 17.0.0 원본 컬러 SVG 120개. 공식 배포에서 변경 없이 가져왔다. 팔레트/결과/PNG에 출처와 CC BY-SA 4.0 표시. 원본 라이선스·출처는 `frontend/public/studio-assets/OPENMOJI-LICENSE.txt`, `ATTRIBUTION.md`.
- `frontend/src/style/model.js:66`: PNG 내보내기에 옷/콜라주/펜/텍스트/회전/투명도/레이어 순서 포함. GIPHY 임베드는 PNG 지원 불가를 명시하며 직접 파일 GIF는 정지 프레임으로 출력한다. 다른 서버가 CORS를 금지하면 파일 업로드 대안을 안내한다.
- `backend/app/style_studio.py:71`: 레이어 종류/이미지 주소/좌표/크기/선 길이 검증. 최대 80개 장식, GIPHY ID 저장, 공개/비공개/공유 비교 데이터에서 콜라주 유지. 업로드 임의 SVG/실행 URL은 거부한다.

PNG/JPEG/WebP/AVIF 파일, 투명 이미지, 파일 GIF, 다중 업로드(8개), 드롭/복사 붙여넣기, HTTPS 이미지 원본 주소를 지원한다. 파일 GIF는 변환하지 않아 움직임을 보존한다. 직접 넣은 콜라주 이미지와 GIF는 공유하는 코디의 일부임을 저장/공유 설정에 표시한다.

## 외부 연동과 범위

노출된 플러그인/도구 목록에는 GIPHY·밈 전용 연결 도구가 없어 공식 GIPHY API/임베드와 공개 OpenMoji 원본을 이용했다. 별도 플러그인 설치는 없었다.

GIPHY 링크 삽입은 키 없이 공식 embed 플레이어로 동작한다. 앱 내 GIF/스티커 검색 및 더 보기는 `VITE_GIPHY_API_KEY` 또는 개발 편집기에서 세션 한정 검색 키를 연결하면 사용한다. 현재 유효 검색 키는 없으므로 실제 API 검색은 미검증이다. 검색 결과는 GIPHY 전용 그리드로 표시하며 URL 변경/미디어 캐시/서버 프록시 없이 클라이언트에서 직접 요청한다. 저장은 GIF ID/출처이며 결과 화면에도 GIPHY 출처를 표시한다.

공식 근거: [GIPHY API](https://developers.giphy.com/docs/api/), [공식 embed 안내](https://support.giphy.com/hc/en-us/articles/360020330711-How-to-Embed-a-GIF), [OpenMoji 17.0.0](https://github.com/hfg-gmuend/openmoji/releases/tag/17.0.0), [OpenMoji 라이선스](https://github.com/hfg-gmuend/openmoji/blob/17.0.0/LICENSE.txt).

## 확인 결과

데스크톱: 사이드 메뉴/CTA, 스티커·텍스트 삽입, 실제 펜 드래그, 되돌리기/다시 하기, 실제 GIPHY 고양이 GIF 렌더링, 비공개 저장 후 링크 공유, 별도 공유 화면의 GIF/낙서 유지 확인. OpenMoji 삽입·방향 이동·PNG 다운로드를 실행했고 1000×1250 PNG에서 의류/펜/텍스트/스티커/출처 유지 확인.

모바일 390×844: 스티커 삽입 → 이름 변경 → 비공개 저장 성공. 문서 clientWidth/scrollWidth 모두 390px. 편집기 헤더와 하단 다음/저장 버튼을 유지하면서 내부만 스크롤한다. 데스크톱 두 패널 스크롤 시 도구가 잘리던 문제도 해결했다.

2026-10-03: 모바일 선택 패널의 헤더/삭제 버튼을 겹치지 않게 배치하고, 두 손가락 조작 안내 아이콘을 표시한다. 캔버스 빈 곳 터치로 선택 해제. 캔버스 제목 “텍스트”는 직접 선택·수정·삭제할 수 있다.

파일 업로드 자동화는 Chrome 확장의 파일 URL 접근 권한 때문에 검증이 막혔다. 권한을 임의로 확대하지 않았다. 파일 선택/다중 업로드/드롭/붙여넣기의 실제 브라우저 실행은 미검증이며 구현과 오류 안내만 확인했다. GIPHY 검색 키 미연결, PNG의 임베드 제외, 로컬 공유 범위는 남은 제약이다.

프런트엔드 5개 테스트, 백엔드 6개 테스트, 변경 모듈 lint, 프로덕션 빌드와 diff whitespace 검사 통과. 스타일 경험은 DEV 전용으로 실제 변경 UI는 로컬 브라우저에서 확인했다. 라이브 배포 없음.

화면: `docs/research/realcloset-positioning-2026-10/style-lab-desktop.jpg`, `style-lab-mobile.jpg`, `style-lab-shared.jpg`, `style-lab-export.png`.

## 캔버스 직접 텍스트 입력 (2026-10-03)

텍스트 도구는 큰 textarea/글꼴 select/스타일 옵션/텍스트 넣기 단계 대신 캔버스에 빈 text 레이어를 만들고 바로 포커스한다. 입력이 실시간 렌더링되며 선택한 레이어에는 작은 굵게/기울임/글꼴/배경/색상/수정/삭제/완료 도구가 표시된다. PC는 캔버스 아래, 모바일은 상단 헤더 아래에 배치한다. 완료 후 텍스트를 누르면 도구가 다시 나오며 수정 버튼 또는 더블 클릭으로 다시 입력한다. 입력 중에는 드래그를 막고 완료 후에는 이동/변형을 유지한다. 빈 텍스트는 입력 종료·닫기·게시 때 제거한다. 텍스트 입력 시작을 한 번의 undo 단계로 묶고 기존 초안은 유지한다. `story-editor.jsx` startText/typeText/finishText 및 rc-text-tools, `collage-canvas.jsx` inline textarea/LayerArt, `story-editor.css` rc-inline-text/rc-text-tools.

굵게/기울임은 `backend/app/style_studio.py` clean_layer에서 저장하고 `frontend/src/style/model.js` exportImage에서도 적용한다. 기존 font=bold 레이어는 굵게 상태를 이어받는다. PC·390×844 모바일 직접 입력/서식/완료/재선택 흐름을 확인했고 확인용 레이어는 삭제해 기존 초안 내용으로 복원했다. 프런트 build와 변경 파일 lint 통과.

## 만들기 컬러 통일 (2026-10-06)

사용자 정정에 따라 편집기의 라임 UI 선택색을 서비스 오렌지 #BF603D로, 배지/업로드/격자/패널 배경을 서비스 웜 뉴트럴 변수로 맞췄다. 모바일 게시/활성 도구도 같은 색이다. 창작 배경과 재료 팔레트는 유지한다. 옷장 도구의 브랜드·가격 표시를 추가하고 상품 정보의 저장/PNG 출력, 실제 AI 착장의 만들기 진입을 연결했다. 상세: [[realcloset-feed-2026-10]].
