# 착장 이미지는 flex 자식이면 줌에 안 줄어든다

옷 컷아웃(`LookComposite` % 배치)은 카드 너비에 비례하는데, AI 착장(`lookImg`)은
1024×1536 원본이라 flex 자식의 `min-width: auto`가 그 픽셀로 잡힌다. 칸·브라우저
줌이 줄어들어도 비트맵은 그대로고 `overflow: hidden`만 잘린다.

2026-08-30: 카드는 `position: absolute; inset: 0` + `min-width/height: 0`.
뷰어는 `max-width/height: 100%` + `width/height: auto`.

근거: `frontend/src/proto/05-screens-cde.jsx` `LookComposite`;
`frontend/src/proto/02-shared.jsx` ImageViewer. 관련 [[image-viewer-gestures]]
