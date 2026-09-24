# 룩북·오늘 추천에서 AI 착장 전환

룩북의 정사각 썸네일은 AI 착장 원본을 `contain`으로 표시해 머리와 신발까지 보인다. 빈 공간에는 같은 원본을 크게 블러 처리한 배경 레이어로 써서 전신이나 바닥 그림자가 겹쳐 보이지 않게 한다. 상세와 오늘 추천 카드는 전체 이미지를 보존한다.

코디 상세와 오늘 추천 카드의 사진 오른쪽 아래 버튼은 돋보기와 같은 크기·높이로 정렬한다. AI 착장이 있으면 양방향 화살표 아이콘으로 상품컷과 착장을 바꾸고, 없으면 sparkle 아이콘으로 생성 확인 시트를 연다. 10크레딧을 안내한 뒤 `/api/live/coordinate/looks`를 요청한다. 직접 생성 요청은 `explicit: true`로 전달해 자동 생성의 테스트 장수 제한을 우회하며, 서버 생성 실패는 SSE 오류로 사용자에게 전달한다. 성공 URL은 기존 착장 흐름이 캐시·상태·과금 갱신에 반영한다.

보기 모드는 `window.LOOK_IMAGE_MODES`에 코디 ID별로 보관한다. 룩북 목록 카드, 상세 화면의 큰 사진과 우측 `RailCard`, 오늘 추천 카드가 같은 값을 읽으므로 탭 이동 뒤에도 마지막 선택을 유지한다. 목록 카드는 AI 상태일 때 메타포 아이콘만 표시하고, `AI로 생성` 문구는 상세 큰 사진에서만 표시한다.

근거: `frontend/src/proto/05-screens-cde.jsx` `LookComposite`, `DetailScreen`; `frontend/src/proto/06-today.jsx` `TodayCard`; `frontend/src/proto/09-app.jsx` `applyModelLooks`.
