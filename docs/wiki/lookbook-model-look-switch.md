# 룩북·오늘 추천에서 AI 착장 전환

룩북의 정사각 썸네일은 2:3 AI 착장 이미지를 92% 크기의 `cover`로 표시해 전신이 덜 잘리게 한다. 4:5 상세와 오늘 추천 카드는 `contain`을 유지한다.

코디 상세와 오늘 추천 카드의 사진 오른쪽 아래 버튼은 돋보기와 같은 크기·높이로 정렬한다. AI 착장이 있으면 양방향 화살표 아이콘으로 상품컷과 착장을 바꾸고, 없으면 sparkle 아이콘으로 생성 확인 시트를 연다. 10크레딧을 안내한 뒤 `/api/live/coordinate/looks`를 요청한다. 사용자가 직접 생성할 때는 자동 생성의 하루 1장 제한을 우회한다. 성공 URL은 기존 착장 흐름이 캐시·상태·과금 갱신에 반영한다.

보기 모드는 `window.LOOK_IMAGE_MODES`에 코디 ID별로 보관한다. 상세 화면의 큰 사진과 우측 `RailCard`, 오늘 추천 카드가 같은 값을 읽으므로 탭 이동 뒤에도 마지막 선택을 유지한다.

근거: `frontend/src/proto/05-screens-cde.jsx` `LookComposite`, `DetailScreen`; `frontend/src/proto/06-today.jsx` `TodayCard`; `frontend/src/proto/09-app.jsx` `applyModelLooks`.
