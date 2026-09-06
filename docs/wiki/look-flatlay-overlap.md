# 플랫레이 소품은 가방 한가운데에 같은 색으로 올리지 않는다

우하단 악세서리를 같은 좌표에 비슷한 크기로 포개면, 검정 선글라스가 검정
가방에 묻힌다. 가방이 자리를 잡고(`lookAccRank`), 소품은 더 작게 모서리
후보(`LOOK_ACC_CANDIDATES`)로 간다. 같은 톤이 겹치면 흰·검 테두리
(`lookNeedsEdge`)를 그린다. 겹침 자체는 허용한다.

근거: `frontend/src/proto/05-screens-cde.jsx` `lookPlacement` `drawLookCutout`
(2026-09-06).
