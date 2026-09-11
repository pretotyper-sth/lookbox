# order-import-webview

쇼핑몰 로그인은 모달 안 화면에서 한다. 무신사 통합 로그인은 `X-Frame-Options: DENY`라 일반 웹의 iframe으로 넣을 수 없다 (`member.one.musinsa.com/login`, 2026-09-06). 데스크톱 앱은 `desktop/` Electron 래퍼의 실제 `<webview>`를 쓰며 세션은 `persist:lookbox-orders` 파티션에 유지한다. 일반 브라우저의 로컬 개발판은 Playwright 화면 스트림을 대체 경로로 쓴다. 아이디·비밀번호는 Lookbox가 읽거나 저장하지 않는다.

흐름: 몰 칩 선택 → 「주문 내역 가져오기」 → 쇼핑몰 로그인 → 로그인되면 주문내역으로 자동 이동 → 「불러오기」로 상품 링크·이름·이미지·가격·구매일을 순서대로 추출 → 선택한 옷을 「N개 담기」 또는 「취소」 → URL 여러 개 추가와 같은 상세입력 화면에서 「담고 다음 옷 / 담고 완료」. Electron은 실제 로그인이 필요해 가운데 420px WebView와 PC 2열을 유지한다. 일반 웹의 Chrome 확장은 로그인 창을 별도 팝업에 띄우므로 두 번째 모달을 열지 않는다. 기존 아이템 추가 시트 안에서 「쇼핑몰 로그인 / 주문내역 열기 / 옷 가져오기」 3단계와 다음 CTA를 보여주고, 수집이 끝나면 같은 자리에서 상품 썸네일·구매처·가격·구매일 후보 목록으로 전환한다.

읽기 순서: Electron 네이티브 `<webview>` → 기존 네이티브 `window.LookboxNative.collectOrders` → Chrome 확장 `COLLECT` → localhost Playwright(`tools/order-collector/collect.mjs --embed`). 일반 웹은 확장이 520×760 로그인 팝업을 열고, 로그인 후 주문내역으로 재이동해 상품을 하나씩 Lookbox 모달로 보낸다. 수집 성공하거나 Lookbox 모달을 닫으면 팝업도 닫힌다. 확장이 없으면 설치·새로고침 안내를 표시한다. 기본 뷰포트는 모달 칸 크기·아이폰 UA다. 쿠팡 확장은 주문내역을 반환 주소로 직접 넣으면 Akamai `Access Denied`가 발생하므로, 쿠팡이 허용하는 홈 반환 로그인 주소로 인증한 뒤 주문내역으로 이동한다. Electron 경로는 쿠팡 홈 로그인 링크를 사용한다. 차단 문서는 주문내역 준비 완료로 처리하지 않는다.

확장으로 수집한 상품은 서버가 상품 페이지를 다시 긁지 않는다. 확장이 로그인된 Chrome에서 주문내역 썸네일을 받고 사진 등록 API로 보내며, 상품명·구매처·가격·원본 상품 URL도 함께 저장한다. 따라서 무신사 등 서버의 상품 페이지 요청을 제한하는 쇼핑몰도 주문내역에서 이미 보인 이미지로 등록할 수 있다. 구매내역 후보·결과는 사진/URL 탭을 다녀와도 메모리에 유지한다. 상세 확인에서 입력 화면으로 뒤로 돌아오거나 「다른 쇼핑몰」을 누르면 완료된 수집 상태를 비우고 쇼핑몰 선택 화면을 복원한다. 모바일 웹은 구매내역 탭에 픽토그램 없는 PC 전용 안내와 비활성 CTA를 표시한다.

웹스토어 공개 전 UX 검수는 개발 서버 또는 `?orderDemo=1`에서 가짜 확장 모드를 쓴다. 몰 선택부터 단일 시트 3단계 진행, 순차 수집, 「취소 / N개 담기」, 한 벌씩 상세입력, 완료 토스트까지 실제 흐름과 같지만 서버를 호출하거나 옷장에 저장하지 않는다. 실제 확장을 로컬에서 확인할 때는 `?orderReal=1`로 가짜 모드를 끈다.

구현: `frontend/src/proto/order-import-session.jsx`, `04-screens-ab.jsx` `collectOrderItems`, `backend/app/main.py` `live_orders_collect`, `frontend/src/proto/09-app.jsx` `_order`·`_view` 스트림.

주문내역 URL은 사용자가 찾지 않는다. UI는 `frontend/src/proto/order-platforms.js` `ordersUrl`, 수집기는 `tools/order-collector/platforms.mjs`와 `extensions/lookbox-orders/platforms.js`의 `urls` 첫 주소. 몰이 경로를 바꾸면 세 파일을 같이 고친다. 수집 로직은 DOM 상품 링크를 줍지만, 첫 goto가 404면 빈 목록이 된다.

창을 못 열면 문구는 두 줄(`white-space: pre-line`). 휴대폰은 「이 기기에서는… / 컴퓨터에서 다시…」. PC(`wide`)는 「쇼핑몰 창을 열지 못했어요. / 이 컴퓨터에서 다시 열어 주세요.」 로컬 판정은 localhost뿐 아니라 `::1`·사설 IP도 수집기를 탄다.

2026-09-06 확인: 무신사 [`/order/order-list`](https://www.musinsa.com/order/order-list)(사용자). 29CM `/order/my-order`. 지그재그 `/order-list`. W컨셉 `/MyPage/MyOrderList`. SSG `pay.ssg.com/myssg/orderList.ssg`. 머스트잇 `/m/mypage/order_list`. 더현대 GNB `selectOrdDlvCrst.thd`는 비로그인 404라 로그인 후 이동에 의존. 2026-09-11 브랜디는 로그인·주문 화면이 빈 페이지여서 지원 목록에서 제거했다.
