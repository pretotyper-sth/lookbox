# 착장 이미지는 flex 자식이면 줌에 안 줄어든다

옷 컷아웃(`LookComposite` % 배치)은 카드 너비에 비례하는데, AI 착장(`lookImg`)은
1024×1536 원본이라 flex 자식의 `min-width: auto`가 그 픽셀로 잡힌다. 칸·브라우저
줌이 줄어들어도 비트맵은 그대로고 `overflow: hidden`만 잘린다.

2026-08-30: 카드는 `position: absolute; inset: 0` + `min-width/height: 0`.
뷰어는 `max-width/height: 100%` + `width/height: auto`.

2026-08-31: 생성본은 1024×1536(2:3)이라 4:5 카드 contain 시 양옆 회색이 달랐다.
색을 덧대지 않는다. `_crop_look_to_card`는 인물 박스를 보고 스튜디오 여백만 잘라
4:5로 맞춘다. 인물이 창보다 크면 자르지 않고 판 안에 축소해 넣는다. 프롬프트는
위아래 15% 빈 스튜디오를 요구해서 보통은 여백만 잘린다. 카드는 `objectFit: cover`.

근거: `frontend/src/proto/05-screens-cde.jsx` `LookComposite`;
`backend/app/main.py` `_crop_look_to_card`. 관련 [[image-viewer-gestures]]
