# 모바일에서 페이지가 확대된 채로 열리던 점

iOS Safari는 16px 미만 input에 포커스하면 페이지를 확대하고, 그 배율을
도메인에 기억한다. 옷장 검색이 13px이라 한 번 검색하면 다음 방문도
확대된 채 시작했다. 축소하면 레이아웃 자체는 맞았다(2026-08-30).

모바일 input은 16px, `touch-action: pan-x pan-y`로 페이지 핀치·더블탭 줌을
막고, 로드/`pageshow` 때 viewport `initial-scale`을 다시 심는다.

근거: `frontend/index.html` viewport, `frontend/src/main.jsx` `resetMobilePageZoom`,
`frontend/src/proto/proto.css` `.lb-input`.
