# item-optional-fields

아이템 추가 `register`와 옷장 상세 시트의 선택 입력 순서는 같다: 브랜드·사이즈 → 컬러 → 계절 → **가격** → **재질** → 구매처 → 메모. (`frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/02-shared.jsx` `ItemDetailSheet`)

가격·재질은 문자열이고 비워도 된다. 스키마 없이 `wardrobe_items.metadata.price` / `metadata.material`에 둔다. 추천용 `metadata.style.material`(cotton|denim|…)과는 다른 칸이다. (`backend/app/main.py` `live_item_payload`, `LiveItemUpdate`)

옷 공개 범위는 등록 입력과 기존 아이템 상세에서 모두 수정할 수 있다. 선택지는 공개/나만 보기이며, 짧은 안내는 제목 오른쪽에 나란히 둔다. 등록·상세 양쪽 모두 상세 입력 맨 아래에 배치한다. (`frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/02-shared.jsx`, `frontend/src/style/social.jsx` `ClosetVisibility`)

URL로 담을 때는 브랜드와 같이 상품 HTML에서 미리 채운다. JSON-LD `offers.price`·`material`, `product:price:amount` 메타, 카페24 판매가/소재 표, 그리고 본문·숨은 상세 팝업·스크립트에 있는 `Outshell: Cotton 100%` / `면 60%` 같은 혼용률. 페이지(또는 초기 JS 페이로드)에 없으면 빈 칸. 클릭 뒤 AJAX로만 오는 상세는 서버에서 못 본다. (`backend/app/main.py` `_extract_price`, `_extract_material`, `_material_from_body`)

가격은 등록·상세 입력 중 천 단위 쉼표를 자동 표시한다(`75890` → `75,890`). 기존 숫자 가격도 화면에서 자동 정리하므로 데이터 이관이 필요 없다. 숫자 사이를 수정할 때 커서 위치를 유지하며, 구매내역·일괄 등록 목록에도 같은 형식을 적용한다. (`frontend/src/look-layout.js` `formatPriceInput`, `frontend/src/proto/02-shared.jsx` `LabeledField`, `frontend/src/proto/04-screens-ab.jsx`, `frontend/src/proto/order-import-session.jsx`)

가격 입력창은 등록·기존 상세 모두 숫자(0–9)만 허용한다. 문자·기호를 입력하거나 붙여넣으면 제거하고 천 단위 쉼표를 유지한다. 모바일은 숫자 키패드를 표시하며 입력 중 커서 위치도 숫자 기준으로 복원한다. 목록 표시용 formatter는 그대로 유지한다. (`formatNumericPriceInput`, `LabeledField` inputMode=numeric, 2026-10-11)
