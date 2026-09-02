# order-import-webview

구매내역은 설치 파일이 아니라 쇼핑몰 화면이다. 몰을 누르면 바로 세션이 열린다. 아래 **불러오기**가 주문내역을 읽고, 찾은 옷이 그리드에 쌓인다. 고른 것만 담는다. zip·확장 설치 시트·「컴퓨터에서만」 잠금은 없다. (2026-09-02)

흐름: 몰 탭 → `OrderImportSession`(주소창·가이드·불러오기) → 분석 카드 + 2열 그리드 → 「아이템 N개 추가하기」. 참고: `reference/Acloset_screen/` 2026-08-30 15:47–15:48 스크린샷.

읽기 순서: 네이티브 `window.LookboxNative.collectOrders` → 크롬 확장이 있으면 `COLLECT` → 이 컴퓨터(localhost)면 Playwright 크롬(`tools/order-collector/collect.mjs`, `POST /api/live/orders/collect`). 웹은 몰이 iframe을 막는 경우가 많아(`X-Frame-Options`), 그때는 안내 카드만 보이고 불러오기가 크롬/네이티브를 연다. 몰 비밀번호는 Lookbox 서버가 받지 않는다.

구현: `frontend/src/proto/order-import-session.jsx`, `04-screens-ab.jsx` `collectOrderItems`, `order-platforms.js` `ordersUrl`.
