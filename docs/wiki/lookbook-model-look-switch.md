# 룩북·오늘 추천에서 AI 착장 전환

룩북의 정사각 썸네일은 2:3 AI 착장 이미지를 `cover`로 표시해 이미지 좌우에 카드 배경이 섞여 보이지 않게 한다. 4:5 상세와 오늘 추천 카드는 `contain`을 유지한다.

코디 상세와 오늘 추천 카드의 사진 왼쪽 아래 버튼은 상품컷과 AI 착장을 전환한다. AI 착장이 없으면 생성 확인 시트를 먼저 띄우고 10크레딧을 안내한 뒤 `/api/live/coordinate/looks`를 요청한다. 사용자가 직접 생성할 때는 자동 생성의 하루 1장 제한을 우회한다. 성공 URL은 기존 착장 흐름이 캐시·상태·과금 갱신에 반영한다.

근거: `frontend/src/proto/05-screens-cde.jsx` `LookComposite`, `DetailScreen`; `frontend/src/proto/06-today.jsx` `TodayCard`; `frontend/src/proto/09-app.jsx` `applyModelLooks`.
