# studio-cutout-fringe

스튜디오 상품컷은 AI로 다시 그리지 않고 배경만 지운다. 어두운 옷은 JPEG 링잉이 판색 혼합대로 남아 흰 톱니 테두리가 됐다.

2026-08-23 수정: 고대비 옷은 침식을 약하게 하고(`MinFilter(3)`), 실루엣의 판색 혼합대를 배경으로 흡수하며, 소매 틈 같은 판 섬을 구멍으로 채운다. 안쪽 라벨은 판보다 밝아서 남긴다. (`backend/app/main.py` `_absorb_plate_fringe`, `_fill_enclosed_bg`, `_studio_cutout_from_image`)

상품컷(`shot=product`)은 분류가 side로 나와도 누끼만 탄다. 착장·디테일만 정면 재구성. (`generate_product_image`)

이미 옷장에 있는 뭉개진 컷은 다시 추출해야 한다.

2026-10-11: 저해상도 상세 페이지에서 선택한 스튜디오 상품컷은 기존 국소 알파 정리 뒤 캔버스로 확대하면서 계단이 커졌다. `resolve_product_image`에서 스튜디오 의류(top/outer/dress/bottom/skirt)에만 `_polish_cutout_alpha`를 확대 전·후 적용한다. 원단 내부 RGB는 유지하고 경계 알파와 반투명 경계색만 다듬는다. 얇은 장식이 있는 신발/가방/소품 및 바로 보기 경로는 이 보정을 타지 않는다. 첨부 원본(960×4491)에서 앞면 컷 390×565→누끼368×411→정규화1024px로 비교: 목·어깨 계단 감소, 알파 면적 -0.039%, 128 기준 bbox 동일. 근거: `backend/app/main.py` resolve_product_image.
