# url-import-fetch

상품 URL 등록은 페이지 HTML에서 상품컷을 고른 뒤 그 이미지를 받는다. 같은 HTML에서 브랜드·가격·재질도 읽어 등록 칸에 넣는다. 쿠팡·네이버쇼핑 같은 마켓은 봇이 막아 사진 업로드로 안내한다.

재질은 JSON-LD·표뿐 아니라 숨은 상세 팝업·스크립트 문자열의 혼용률(`Outshell: Cotton 100%` 등)도 본다. 클릭 후 따로 받아 오는 상세는 못 본다. (`backend/app/main.py` `_material_from_body`, 2026-08-30)

2026-07-17 차단 힌트에 `robot`을 넣어 `<meta name="robots">` 있는 브랜드몰까지 접근 불가로 오인했다. 2026-08-23에 봇 벽 문구만 남기고, 카페24 `web/product/big`을 케어가이드 JPG보다 앞에 두었다. 같은 날 카페24 `product_no`를 URL 키에 넣고, 등록 확인 전 `pending` 초안은 중복 비교에서 빼 두었다. 빈 옷장처럼 보이는데 같은 주소로 막히던 이유다. (`backend/app/main.py` `_page_looks_blocked`, `_product_image_candidates`, `_query_key`, `_wardrobe_dupe_index`)

이미 옷장에 **확정된** 주소를 다시 넣으면 빈 결과 대신 '이미 있는 상품'으로 말한다. (`frontend/src/proto/04-screens-ab.jsx` `runDetect`)

중복 판정은 주소·상품코드·같은 사진만 쓴다. 이름·브랜드 유사도로 막지 않는다 — 같은 이름에 색만 다른 별개 상품이 흔하고, 애매한 중복은 사용자가 정리한다. (`backend/app/main.py` `_match_duplicate`, 2026-08-30)

앞·뒤·디테일이 한 장에 쌓인 상세컷은 정면 전신만 잘라 등록한다. ([[stacked-product-hero]])
