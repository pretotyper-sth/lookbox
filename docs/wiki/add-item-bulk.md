# add-item-bulk

아이템 추가 → URL 탭은 한 줄 `input`을 쌓는다. `+ 주소 추가`로 칸을 늘리고, 여러 줄·여러 주소를 붙여넣으면 칸이 늘어난다. 입력·추가 버튼이 168px 박스를 넘으면 박스 안에서만 스크롤한다. 칸이 하나면 바로 추출하고, 둘 이상이면 구매내역과 같은 후보 목록으로 보낸다. (`frontend/src/proto/04-screens-ab.jsx` `urls`)

사진·URL 탭 스테이지는 168px. 구매내역 탭은 추출 힌트 칸(44px)까지 합쳐 212px이라 쇼핑몰 칩이 잘리지 않는다. 힌트 줄은 구매내역에서 렌더하지 않는다. 탭만 바꿔도 시트 높이는 같다.

구매내역 탭 안내: 「쇼핑몰을 고르고 가져오면, 담을 옷은 다음에 고르면 돼요.」 푸터: 「내역 확인 후 고른 옷만 옷장에 담아요.」

연결이 안 되어 있으면 시트 안에 설치 설명을 넣지 않는다. 별도 시트(`ConnectOrdersModal`)에서 허용 → 저장하기(zip) → 열었어요 순으로 버튼만 누른다. zip은 `GET /api/live/orders/extension.zip`. 웹페이지는 크롬 확장 설치 권한 창을 대신 띄울 수 없다. (`extensions/lookbox-orders`, `backend/app/main.py`)

URL·사진 추출 뒤 `register`의 「담고 완료」는 상세 입력(메모) 아래, 시트 본문 안에 둔다. 상세 시트의 「저장」과 같다. 스크롤 밖 고정·sticky를 쓰지 않는다. (`frontend/src/proto/04-screens-ab.jsx` `advance`)

구매내역 탭은 옷장 추가 시트에 있다(사진·URL 옆). 모바일은 잠금 안내만. PC는 쇼핑몰을 고르고 가져오기를 누르면, 확장이 있으면 그 크롬 세션에서 읽고, 이 컴퓨터(127.0.0.1)에서는 수집기 크롬도 띄운다. (`tools/order-collector/collect.mjs`, `/api/live/orders/collect`)
