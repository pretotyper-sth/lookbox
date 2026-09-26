# Outfit recommendation feedback

오늘 추천 코디 상세 화면에서만 좋아요/별로예요를 표시한다. 선택 평가는 outfit metadata에 저장해 상세에서 선택 상태를 복원하고, 계정 user metadata의 최근 40개 `style_feedback`에도 item IDs와 스타일을 기록한다.

다음 `/api/live/coordinate` 추천은 저장된 피드백에 따라 후보 조합을 넓게 만든 뒤, 좋아한 코디와 겹치는 아이템/페어/스타일을 우선하고 싫어한 조합을 뒤로 보낸다. 이 기록은 날짜별 코디를 지워도 계정에 남는다.

관련 코드: `frontend/src/proto/05-screens-cde.jsx` `frontend/src/proto/09-app.jsx` `backend/app/main.py`.
