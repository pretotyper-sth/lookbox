# add-item-bulk

아이템 추가 → URL은 **한 줄에 주소 하나**다. 두 줄 이상이면 후보 목록이 되고, 고른 것만 순서대로 등록한다.

주소가 없으면 호스트만 한 줄로 보여 준다. 이름·가격·구매일은 수집기 JSON을 붙였을 때만 둘째 줄에 나온다. (`frontend/src/proto/04-screens-ab.jsx` `parseBulkPaste`, `bulkRowMeta`)

구매내역 탭은 옷장 추가 시트에 있다. 모바일은 잠금 안내만 보이고, PC는 `tools/order-collector`를 실행한 뒤 JSON을 붙여 넣는다. 웹이 사용자 크롬에 들어갈 수 없어 수집 자체는 로컬 크롬에서 한다. (`tools/order-collector/README.md`)
