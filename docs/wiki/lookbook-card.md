# 룩북 카드는 옷장과 같은 뼈대다

그리드는 옷장과 같다. 맨 앞 `lb-addtile`은 「직접 만들기」. 카드는 정사각
썸네일 + 아래 두 줄(이름 / `N개 품목 · 며칠 전`). 점 3개는 썸네일 우상단
`right: 4; top: 4`. 흰 카드 패딩은 쓰지 않는다. 상세는 모바일만 세로 카드,
PC는 오늘 코디와 같은 왼쪽 사진·오른쪽 레일.

하트는 없다. 빼기는 「선택」또는 더보기 「룩북에서 빼기」. 고른 게 없으면
선택 모드를 끄고 +타일을 다시 보여 준다. 확인 시트는
「룩북에서 뺄까요?」/ 「추천에서 저장한 코디는 나중에 다시 담을 수 있어요.」
더보기는 옷장 `ItemRemoveSheet`와 같다. 왼쪽 썸네일+이름, 테두리 버튼
「이름 수정하기」, 테라코타 「룩북에서 빼기」, 취소. 이름 수정 시트는
제목·입력·취소/저장.
`renameSavedLook` → `POST /api/live/outfits/{id}/state` `{label}`, 40자.

탭을 다시 열 때 카드 `lb-anim-in`(밑에서 올라옴)은 쓰지 않는다. 숨긴 탭을
`display:flex`로 켜면 애니가 다시 돈다. 옷장처럼 그대로 보이게 한다(2026-09-06).

목록은 옷장과 같이 계정 캐시(`lb_lookbook_v1`)를 먼저 그린다. 서버는
`GET /api/live/outfits?saved=1`로 저장된 코디만 먼저 받는다. 착장 사진이 있으면
옷장 join을 생략한다. 전체 `/outfits`(오늘 기록)는 룩북을 그린 뒤에 받는다.
목록 fetch는 GPT가 아니다. 첫 방문이 느린 이유는 캐시 없음 + Render 기상 +
예전엔 무거운 전체 목록을 같이 친 것(2026-09-06).

근거: `frontend/src/proto/05-screens-cde.jsx` `SavedCard` `LookbookScreen`;
`frontend/src/proto/04-screens-ab.jsx` 옷장 그리드;
`frontend/src/proto/09-app.jsx` `renameSavedLook` `refreshLive`;
`backend/app/main.py` `live_list_outfits`.
