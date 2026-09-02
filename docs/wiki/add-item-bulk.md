# add-item-bulk

아이템 추가 → URL 탭은 한 줄 `input`을 쌓는다. `+ 주소 추가`로 칸을 늘리고, 여러 줄·여러 주소를 붙여넣으면 칸이 늘어난다. URL 탭이 열려 있으면 입력칸 포커스 없이도 ⌘/Ctrl+V로 주소가 칸에 들어간다. 입력·추가 버튼이 168px 박스를 넘으면 박스 안에서만 스크롤한다. 칸이 하나면 바로 추출하고, 둘 이상이면 후보 목록을 보여 고른 뒤 **기본은 사진과 같이 하나씩 확인·담기**. 「확인 없이 바로 담기」를 켜야 예전처럼 일괄 자동 등록. (`frontend/src/proto/04-screens-ab.jsx` `urls`, `runBulkReview`, `bulkAuto`)

사진·URL 탭 스테이지는 168px, 그 아래 추출 힌트 줄 44px. 바로 보기·구매내역 박스는 힌트 줄 높이까지 합쳐 212px라 탭을 바꿔도 시트 높이가 같다. 바로 보기 칸 안에는 계정 프사 원형만 두고, 오류 문구도 이 칸 안에 넣는다. 힌트 줄은 바로 보기·구매내역에서 렌더하지 않는다. 조합 추천받기(고민 중)는 CTA 아래 빈 힌트 칸을 넣지 않는다. 입력 단계는 본문 아래 패딩 12px, BottomSheet는 safe-area만 (`tightBottom`).

구매내역 탭 안내: 「먼저 원하는 쇼핑몰을 골라주세요.」 (2026-09-02). 푸터: 「내역 확인 후 고른 옷만 옷장에 담아요.」

연결이 안 되어 있으면 시트 안에 설치 설명을 넣지 않는다. 별도 시트(`ConnectOrdersModal`)에서 허용 → 저장하기(zip) → 열었어요 순으로 버튼만 누른다. zip은 `GET /api/live/orders/extension.zip`. 웹페이지는 크롬 확장 설치 권한 창을 대신 띄울 수 없다. (`extensions/lookbox-orders`, `backend/app/main.py`)

URL·사진 추출 뒤 `register`의 「담고 완료」는 상세 입력(메모) 아래, 시트 본문 안에 둔다. 상세 시트의 「저장」과 같다. 스크롤 밖 고정·sticky를 쓰지 않는다. (`frontend/src/proto/04-screens-ab.jsx` `advance`)

구매내역 탭은 옷장 추가 시트에 있다(사진·URL 옆). 모바일은 잠금 안내만. PC는 쇼핑몰을 고르고 가져오기를 누르면, 확장이 있으면 그 크롬 세션에서 읽고, 이 컴퓨터(127.0.0.1)에서는 수집기 크롬도 띄운다. (`tools/order-collector/collect.mjs`, `/api/live/orders/collect`)
