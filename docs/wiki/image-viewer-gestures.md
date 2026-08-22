# ImageViewer 제스처

`02-shared.jsx` ImageViewer. 예전에는 확대가 버튼·휠·더블클릭뿐이었고,
`touch-action: pan-y`(100%일 때) + `onPointerDown`이 `zoom<=1`이면 return이라
모바일 핀치가 100%에서 아예 먹지 않았다. 휠도 React `onWheel`이라 `preventDefault`가
막히는 환경이 있었다.

2026-08-22: 미디어 스테이지에 `touch-action: none` + non-passive `touchstart/move/wheel`.
핀치는 두 손가락 거리 비율로 1~4배. 더블탭(280ms)과 휠(1.08배씩)도 같은 `commitZoom`.
힌트 문구: `핀치 · 더블탭 · 휠로 확대할 수 있어요`.

관련: [[chiprow-sheet-scroll]]
