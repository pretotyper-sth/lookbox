# 착장 이미지는 flex 자식이면 줌에 안 줄어든다

옷 컷아웃(`LookComposite` % 배치)은 카드 너비에 비례하는데, AI 착장(`lookImg`)은
1024×1536 원본이라 flex 자식의 `min-width: auto`가 그 픽셀로 잡힌다. 칸·브라우저
줌이 줄어들어도 비트맵은 그대로고 `overflow: hidden`만 잘린다.

2026-08-30: 카드는 `position: absolute; inset: 0` + `min-width/height: 0`.
뷰어는 `max-width/height: 100%` + `width/height: auto`.

2026-08-31: 생성본은 1024×1536(2:3)이라 4:5 카드 contain 시 양옆 회색이 달랐다.
색을 덧대지 않는다. `_crop_look_to_card`는 인물 박스를 보고 스튜디오 여백만 잘라
4:5로 맞춘다. 인물이 창보다 크면 **머리를 남기고** 아래를 자른다. 발을 맞추려고
창을 내리면 얼굴이 잘렸다(2026-09-10). 프롬프트는 머리 위 20% 빈 스튜디오.
카드·뷰어는 `objectFit: cover` + `objectPosition: center top`.
크롭 여백 `_LOOK_CROP_PAD`는 0.12(2026-09-06). 뷰어는 4:5 스테이지에 cover로 채워
`--thumb-bg` 레터박스가 스튜디오와 붙지 않게 한다.

2026-09-02: 배경이 단색 판이 아니라 레퍼런스 스튜디오 그라데이션이 됐다
([[look-plate-shadow]]). 그래서 인물 검출은 고정색 비교가 아니라 **그 줄의 좌우
끝 색**을 기준으로 한다(`_look_row_backdrop`) — 고정색으로 재면 어두운 바닥이
통째로 인물로 잡혀 크롭이 망가진다.

2026-09-06: `_fit_look_to_card`는 원본에서 4:5 창을 잡는다. 인물이 더 크면
`ty0`(머리)를 창 위에 둔다. 카드는 `inset: 0` + `object-fit: cover` +
`object-position: center top`. 좌우를 키워 자르면(`-9%` / `118%`) 위아래
스튜디오가 사라지고 확대 때 왼쪽으로 밀린다.

얼굴이 잘리기 시작한 직접 원인은 양옆 늘림 띠를 없앤 같은 커밋(`a7f8ddb`,
2026-09-06)이다. 가장자리를 늘리지 않으려고 원본에서 4:5 창을 골랐고, 창보다
인물이 크면 발을 맞추려고 `ny0`를 내렸다. 모델이 머리~발 타이트 크롭을 주면
그 창이 얼굴을 자른다. 2026-09-10부터는 같은 비상 경로에서 머리를 남긴다.
모델이 머리 위 여백을 지키면 위아래 스튜디오만 잘려 얼굴·다리·신발은 그대로다.

근거: `frontend/src/proto/05-screens-cde.jsx` `LookComposite`;
`backend/app/main.py` `_crop_look_to_card`. 관련 [[image-viewer-gestures]]
