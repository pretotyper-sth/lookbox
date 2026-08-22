# 옷장 상세 시트 — 칩 행이 세로 스크롤을 가로챔

증상(2026-08-22): 아이템 상세를 맨 아래까지 내린 뒤 위로 올리면, 오른쪽·가운데는
한번 튀고 멈추고 왼쪽 끝만 스무스하다.

원인: `.lb-chiprow`(`proto.css`)가 `touch-action: pan-x`라 구매처 칩 위에서는
세로 제스처를 브라우저가 버린다. 왼쪽 패딩·라벨은 칩 행이 아니라 시트가 받는다.

해결: `touch-action: pan-x pan-y` + `overscroll-behavior: contain`.
시트 자체는 `BottomSheet`를 `position: fixed`로 바꿔 탭 스크롤·하단 탭에 잘리지 않게 했다.

관련: [[recent-tag-field-scroll]] [[image-viewer-gestures]]
