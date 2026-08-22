# 옷장 선택 모드에서도 검색 줄 폭은 같다

모바일 옷장 헤더는 `검색 + 선택/완료 + +`. 선택 모드에서 `+`를 언마운트하면
검색칸이 넓어져 GNB가 한 칸 뛴다. `+`는 항상 두고 `visibility: hidden` +
`pointer-events: none`으로만 끈다. `선택`/`완료`는 `minWidth: 36`.

근거: `frontend/src/proto/04-screens-ab.jsx` 옷장 모바일 헤더.
