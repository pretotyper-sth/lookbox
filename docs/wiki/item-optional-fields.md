# item-optional-fields

아이템 추가 `register`와 옷장 상세 시트의 선택 입력 순서는 같다: 브랜드·사이즈 → 컬러 → 계절 → **가격** → **재질** → 구매처 → 메모. (`frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/02-shared.jsx` `ItemDetailSheet`)

가격·재질은 문자열이고 비워도 된다. 스키마 없이 `wardrobe_items.metadata.price` / `metadata.material`에 둔다. 추천용 `metadata.style.material`(cotton|denim|…)과는 다른 칸이다. (`backend/app/main.py` `live_item_payload`, `LiveItemUpdate`)

URL로 담을 때는 브랜드와 같이 상품 HTML에서 미리 채운다. JSON-LD `offers.price`·`material`, `product:price:amount` 메타, 카페24 판매가/소재 표. 페이지에 없으면 빈 칸으로 둔다. (`backend/app/main.py` `_extract_price`, `_extract_material`)
