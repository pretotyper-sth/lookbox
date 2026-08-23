# url-import-fetch

상품 URL 등록은 페이지 HTML에서 상품컷을 고른 뒤 그 이미지를 받는다. 쿠팡·네이버쇼핑 같은 마켓은 봇이 막아 사진 업로드로 안내한다.

2026-07-17 차단 힌트에 `robot`을 넣어 `<meta name="robots">` 있는 브랜드몰까지 접근 불가로 오인했다. 2026-08-23에 봇 벽 문구만 남기고, 카페24 `web/product/big`을 케어가이드 JPG보다 앞에 두었다. (`backend/app/main.py` `_page_looks_blocked`, `_product_image_candidates`)

이미 옷장에 있는 주소를 다시 넣으면 빈 결과 대신 '이미 있는 상품'으로 말한다. (`frontend/src/proto/04-screens-ab.jsx` `runDetect`)
