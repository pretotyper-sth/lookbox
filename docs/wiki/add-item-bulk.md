# add-item-bulk

아이템 추가 → URL은 **한 줄에 주소 하나**다. 두 줄 이상이면 후보 목록이 되고, 고른 것만 순서대로 등록한다.

주소가 없으면 호스트만 한 줄로 보여 준다. 이름·가격·구매일은 주문내역에서 가져왔을 때만 둘째 줄에 나온다. (`frontend/src/proto/04-screens-ab.jsx` `parseBulkPaste`, `bulkRowMeta`)

구매내역 탭은 옷장 추가 시트에 있다(사진·URL 옆). 모바일은 잠금 안내만. PC는 쇼핑몰을 고르고 버튼 한 번이면 크롬이 열려 주문 목록을 읽는다. 로그인되어 있으면 바로 후보가 뜨고, 아니면 그 창에서 로그인하면 최대 3분 기다린다. 평소 쓰는 크롬 세션은 `extensions/lookbox-orders` 확장이 쓰고, 이 컴퓨터(127.0.0.1)에서는 수집기 크롬도 띄운다. (`tools/order-collector/collect.mjs`, `backend/app/main.py` `/api/live/orders/collect`)
