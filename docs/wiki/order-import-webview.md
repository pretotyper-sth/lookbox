# order-import-webview

구매내역은 설치 파일이 아니라 쇼핑몰 로그인 화면이다. 몰을 **고른 뒤** 시트 CTA로 세션을 연다. 세션은 가운데 모달 안에 웹뷰 크롬(주소창 + 안내)을 두고, 로그인은 쇼핑몰 창에서만 한다. 아이디·비밀번호는 Lookbox에 저장하지 않는다고 웹뷰 하단에 적는다. (2026-09-06)

흐름: 몰 칩 선택 → 「주문 내역 가져오기」 → 웹뷰에서 로그인 대기 → 로그인되면 주문내역으로 이동(`STEP orders_ready`) → 웹뷰 CTA 「주문내역 가져오기」 → 옷이 한 줄씩 쌓임(`_order`) → 카드에서 「담기」 또는 「N개 확인」.

PC(`wide`, 760px+): 로그인까지는 가운데 420px 모달. 불러오기 단계에서는 그 모달이 왼쪽에 남고, 같은 높이의 560px 카드가 오른쪽에 생긴다. 모바일은 같은 카드 안에서 웹뷰 → 목록으로 바뀐다.

읽기 순서: 네이티브 `window.LookboxNative.collectOrders` → 크롬 확장 `COLLECT` → localhost Playwright(`tools/order-collector/collect.mjs`). 수집기는 로그인 뒤 주문내역 URL로 다시 연 다음 `ITEM` 줄을 한 개씩 흘린다. `STEP need_login`은 웹뷰를 로그인 안내에 두고, `orders_ready`가 와야 CTA가 생긴다.

구현: `frontend/src/proto/order-import-session.jsx`, `04-screens-ab.jsx` `collectOrderItems`, `backend/app/main.py` `live_orders_collect`, `frontend/src/proto/09-app.jsx` `_order` 스트림.
