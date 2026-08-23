# studio-cutout-fringe

스튜디오 상품컷은 AI로 다시 그리지 않고 배경만 지운다. 어두운 옷은 JPEG 링잉이 판색 혼합대로 남아 흰 톱니 테두리가 됐다.

2026-08-23 수정: 고대비 옷은 침식을 약하게 하고(`MinFilter(3)`), 실루엣의 판색 혼합대를 배경으로 흡수하며, 소매 틈 같은 판 섬을 구멍으로 채운다. 안쪽 라벨은 판보다 밝아서 남긴다. (`backend/app/main.py` `_absorb_plate_fringe`, `_fill_enclosed_bg`, `_studio_cutout_from_image`)

상품컷(`shot=product`)은 분류가 side로 나와도 누끼만 탄다. 착장·디테일만 정면 재구성. (`generate_product_image`)

이미 옷장에 있는 뭉개진 컷은 다시 추출해야 한다.
