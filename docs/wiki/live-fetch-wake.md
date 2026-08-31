# 새로고침마다 '네트워크가 불안정해요'가 뜨던 이유

토스트 문구는 `liveJSON`이 `fetch` 자체에서 예외를 받았을 때다
(`frontend/src/proto/09-app.jsx`). HTTP 4xx가 아니라 연결이 안 된 것이다.

접속 직후 `GET /api/live/wardrobe`에 `Content-Type: application/json`을 붙여
CORS preflight(OPTIONS)가 나갔다. Render가 잠든 뒤 그 OPTIONS가 실패하면
옷장 로드가 바로 그 토스트로 끝났다(2026-09-01).

고침: 본문 없는 요청에는 JSON 헤더를 안 붙인다. `Failed to fetch`는 두 번
더 재시도한다. 앱 시작 때 `/health`로 API를 깨운다. CORS 기본 origin에
`https://realcloset.vercel.app`을 넣는다.

근거: `frontend/src/proto/09-app.jsx` `liveJSON`;
`frontend/src/live-bridge.js` `initLiveBridge`;
`backend/app/main.py` `FRONTEND_ORIGINS`.
