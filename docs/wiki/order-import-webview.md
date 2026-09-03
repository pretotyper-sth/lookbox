# order-import-webview

구매내역은 설치 파일이 아니라 쇼핑몰 로그인 화면이다. 몰을 **고른 뒤** 시트 CTA로 세션을 연다. 세션에는 이름·안내·**불러오기**만 둔다. 불러오기는 로그인 창을 먼저 열고, 로그인이 끝난 뒤에야 옷을 찾는다. zip·가짜 로고·동작 없는 뒤로/새로고침은 없다. (2026-09-02)

흐름: 몰 칩 선택 → 「주문 내역 가져오기」 → 이름+두 줄 안내 → **불러오기**(크롬 로그인) → `STEP collect` 이후 그리드 → 「N개 추가하기」.

읽기 순서: 네이티브 `window.LookboxNative.collectOrders` → 크롬 확장 `COLLECT` → localhost Playwright(`tools/order-collector/collect.mjs`). `STEP need_login`은 세션을 로그인 안내에 두고, `STEP collect`가 와야 찾기 화면으로 간다. 몰 비밀번호는 서버가 받지 않는다.

구현: `frontend/src/proto/order-import-session.jsx`, `04-screens-ab.jsx` `collectOrderItems`, `backend/app/main.py` `live_orders_collect`.
