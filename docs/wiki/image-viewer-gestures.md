# ImageViewer 제스처

`02-shared.jsx` ImageViewer. 예전에는 확대가 버튼·휠·더블클릭뿐이었고,
`touch-action: pan-y`(100%일 때) + `onPointerDown`이 `zoom<=1`이면 return이라
모바일 핀치가 100%에서 아예 먹지 않았다. 휠도 React `onWheel`이라 `preventDefault`가
막히는 환경이 있었다.

2026-08-22: 미디어 스테이지에 `touch-action: none` + non-passive `touchstart/move/wheel`.
핀치는 두 손가락 거리 비율로 1~4배. 더블탭(280ms)과 휠(1.08배씩)도 같은 `commitZoom`.
힌트 문구: `핀치 · 더블탭 · 휠로 확대할 수 있어요`.

2026-08-30: 착장 `lookImg`는 원본이 커서 flex `min-width: auto`에 막혔다.
뷰어 미디어는 `max-width/height: 100%`로 스테이지에 맞춘다. [[look-img-flex-min]]

2026-09-06: `lookImg` 스테이지는 `aspect-ratio: 4/5` + `object-fit: cover` +
가운데. 이미지를 118%로 키우면 확대 때 왼쪽로 밀리고 오른쪽이 `--thumb-bg`다.

2026-09-14: 상품컷은 저장 효율을 위해 WebP지만, 크게 보기에서는 브라우저에서 PNG로
변환해 보인다. Chrome 우클릭 「이미지 복사」가 PNG를 클립보드에 넣어 WebP를 받지
않는 붙여넣기 대상에도 그대로 붙는다. (`CopyReadyProductImg`)

관련: [[chiprow-sheet-scroll]] [[look-img-flex-min]]
