# order-import-webview

쇼핑몰 로그인은 모달 안 화면에서 한다. 무신사 통합 로그인은 `X-Frame-Options: DENY`라 iframe으로 넣을 수 없다 (`member.one.musinsa.com/login`, 2026-09-06). 그래서 별도 크롬 창을 띄우지 않고, 이 컴퓨터 Playwright를 헤드리스로 켠 뒤 JPEG 화면을 모달에 그린다. 클릭·입력은 그 엔진으로만 전달하고, 아이디·비밀번호는 파일에 저장하지 않는다.

흐름: 몰 칩 선택 → 「주문 내역 가져오기」 → 모달 웹뷰에 로그인 화면 → 로그인되면 주문내역으로 이동(`STEP orders_ready`) → CTA로 한 줄씩 담기(`_order`). PC(`wide`, 760px+): 로그인까지는 가운데 420px 모달. 불러오기 단계에서는 그 모달이 왼쪽에 남고, 같은 높이의 560px 카드가 오른쪽에 생긴다.

읽기 순서: 네이티브 `window.LookboxNative.collectOrders` → 크롬 확장 `COLLECT` → localhost Playwright(`tools/order-collector/collect.mjs --embed`). 화면은 로컬 MJPEG(`EMBED http://127.0.0.1:port/stream`), 클릭은 그 포트 `/input`. 뷰포트는 모달 칸 크기·아이폰 UA.

구현: `frontend/src/proto/order-import-session.jsx`, `04-screens-ab.jsx` `collectOrderItems`, `backend/app/main.py` `live_orders_collect`, `frontend/src/proto/09-app.jsx` `_order`·`_view` 스트림.

주문내역 URL은 사용자가 찾지 않는다. UI는 `frontend/src/proto/order-platforms.js` `ordersUrl`, 수집기는 `tools/order-collector/platforms.mjs`와 `extensions/lookbox-orders/platforms.js`의 `urls` 첫 주소. 몰이 경로를 바꾸면 세 파일을 같이 고친다. 수집 로직은 DOM 상품 링크를 줍지만, 첫 goto가 404면 빈 목록이 된다.

창을 못 열면 문구는 두 줄(`white-space: pre-line`). 휴대폰은 「이 기기에서는… / 컴퓨터에서 다시…」. PC(`wide`)는 「쇼핑몰 창을 열지 못했어요. / 이 컴퓨터에서 다시 열어 주세요.」 로컬 판정은 localhost뿐 아니라 `::1`·사설 IP도 수집기를 탄다.

2026-09-06 확인: 무신사 [`/order/order-list`](https://www.musinsa.com/order/order-list)(사용자). 29CM `/order/my-order`. 지그재그 `/order-list`. W컨셉 `/MyPage/MyOrderList`. SSG `pay.ssg.com/myssg/orderList.ssg`. 머스트잇 `/m/mypage/order_list`. 더현대 GNB `selectOrdDlvCrst.thd`는 비로그인 404라 로그인 후 이동에 의존.

