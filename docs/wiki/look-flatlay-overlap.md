# 플랫레이 소품은 가방 한가운데에 같은 색으로 올리지 않는다

우하단 악세서리를 같은 좌표에 비슷한 크기로 포개면, 검정 선글라스가 검정
가방에 묻힌다. 가방이 자리를 잡고(`lookAccRank`), 소품은 더 작게 모서리
후보(`LOOK_ACC_CANDIDATES`)로 간다. 구분은 자리로만 한다. 흰 발광·테두리는
선글라스처럼 이질감이 나서 그리지 않는다(2026-09-06).

근거: `frontend/src/proto/05-screens-cde.jsx` `lookPlacement` `drawLookCutout`.
