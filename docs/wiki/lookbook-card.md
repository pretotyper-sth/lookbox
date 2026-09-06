# 룩북 카드는 옷장과 같은 뼈대다

그리드는 옷장과 같다. 맨 앞 `lb-addtile`은 「직접 만들기」. 카드는 정사각
썸네일 + 아래 두 줄(이름 / `N개 품목 · 며칠 전`). 점 3개는 썸네일 우상단
`right: 4; top: 4`. 흰 카드 패딩은 쓰지 않는다. 상세는 모바일만 세로 카드,
PC는 오늘 코디와 같은 왼쪽 사진·오른쪽 레일.

하트는 없다. 빼기는 「선택」→「룩북에서 빼기」. 더보기는 오늘 다시 받기처럼
가운데 제목 + 채운 버튼 + 취소. 이름 수정 시트는 제목·입력·취소/저장.
`renameSavedLook` → `POST /api/live/outfits/{id}/state` `{label}`, 40자.

근거: `frontend/src/proto/05-screens-cde.jsx` `SavedCard` `LookbookScreen`;
`frontend/src/proto/04-screens-ab.jsx` 옷장 그리드;
`frontend/src/proto/09-app.jsx` `renameSavedLook`.
