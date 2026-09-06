# 룩북 카드는 하트 없이 더보기·선택 빼기

룩북 그리드 우상단 하트는 쓰지 않는다(2026-09-06). 빼기는 헤더 「선택」으로
고른 뒤 하단 「룩북에서 빼기」만. 오늘 코디 카드·오늘에서 연 상세의 하트는
그대로 담기용이다. 룩북에서 연 상세에도 하트를 두지 않는다.

카드 우상단은 옷장과 같은 점 3개. 시트에서 「이름 수정하기」→ 입력 후 저장.
`renameSavedLook`이 `savedLooks`·`OUTFIT_BY_ID.label`을 바꾸고
`POST /api/live/outfits/{id}/state`에 `{label}`을 보낸다. 40자.

근거: `frontend/src/proto/05-screens-cde.jsx` `SavedCard` `LookbookScreen`;
`frontend/src/proto/09-app.jsx` `renameSavedLook`;
`backend/app/main.py` `LiveOutfitState.label`.
