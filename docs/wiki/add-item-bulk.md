# add-item-bulk

아이템 추가 → URL 탭은 **한 줄 `input`**이다(여러 줄 textarea가 아니다). 여러 개를 한 번에 담는 건 구매내역 탭에서만 한다.

사진·URL·구매내역 탭은 168px 스테이지를 같이 쓴다. URL 칸은 예전처럼 높이 48px 입력창이고, 나머지 높이는 빈 슬롯이라 탭만 바꿔도 시트 높이는 그대로다. (`frontend/src/proto/04-screens-ab.jsx` `panelH`)

구매내역 탭 안내: 「쇼핑몰을 고르고 가져오면, 담을 옷은 다음에 고르면 돼요.」 푸터: 「내역 확인 후 고른 옷만 옷장에 담아요.」

구매내역 탭은 옷장 추가 시트에 있다(사진·URL 옆). 모바일은 잠금 안내만. PC는 쇼핑몰을 고르고 버튼 한 번이면 크롬이 열려 주문 목록을 읽는다. 로그인되어 있으면 바로 후보가 뜨고, 아니면 그 창에서 로그인하면 최대 3분 기다린다. 평소 쓰는 크롬 세션은 `extensions/lookbox-orders` 확장이 쓰고, 이 컴퓨터(127.0.0.1)에서는 수집기 크롬도 띄운다. (`tools/order-collector/collect.mjs`, `backend/app/main.py` `/api/live/orders/collect`, `frontend/src/proto/04-screens-ab.jsx`)
