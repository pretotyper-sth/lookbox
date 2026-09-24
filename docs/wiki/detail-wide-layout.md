# 코디 상세(데스크탑)는 사진 왼쪽 / 코디 줄 + 품목 오른쪽

`DetailScreen`은 사진(`photoBlock`)과 품목 목록(`itemsBlock`)을 따로 만든다.

- 모바일: 한 카드에 사진 → 품목 순으로 쌓는다(`card`).
- 데스크탑: 코디 수와 관계없이 왼쪽 사진, 오른쪽 레일 + 품목.
  룩북에서 열어도 오늘과 같다. `openDetail`이 목록을 넘긴다.

이전에는 왼쪽 카드가 사진 + 품목을 다 갖고, 오른쪽 레일이
`repeat(auto-fill, minmax(148px, 1fr))` 격자로 여러 줄이었다. 크롬 100% 배율
1440x900에서 코디 목록이 접혀 스크롤을 내려야 보였다(2026-09-02 사용자 지적).
가로 한 줄로 바꾸면 코디가 늘어도 세로로 자라지 않는다.

레일은 `display:flex` + `overflowX:auto`이고 카드는 레일 너비의 4분의 1에서 간격을 뺀
폭을 쓴다(`flex:0 0 calc((100% - 36px) / 4)`, `minWidth:148`). 따라서 넓은 화면에
한 번에 다섯 장이 작게 들어가는 일을 막고, 좁은 화면은 최소 폭을 유지해 스크롤한다.
`1 0 148px`만 두면 이미지 intrinsic 폭 때문에 칸이 제각각이 된다(2026-09-03).
라벨은 두 줄로 고정(`line-clamp: 2`). `RailCard` 버튼은 `width:100%`.
화살표(`RailPageBtn`)는 `scrollBy(clientWidth * 0.8)`. `syncRail`이 스크롤·코디 수
변화마다 양 끝 도달 여부를 보고 끝에 닿은 쪽 화살표를 죽인다.

선택 테두리는 `2px solid`이고 비활성은 투명 2px라 칸 크기가 안 바뀐다. 호버로
카드를 올리지 않는다 — `translateY(-2px)` + 레일 `overflow-y:auto`면 위 테두리가
잘리고, `scrollIntoView({block:'nearest'})`가 조상을 밀어 누른 뒤에야 테두리가
보였다(2026-09-03). 레일은 `overflowY:hidden` + 위 2px 패딩. 활성 카드는
가로 `scrollLeft`만 맞춘다.

레일이 한 줄이 되면서 방향키는 좌우만 ±1로 옮긴다. 예전 위/아래 ±cols는
`gridTemplateColumns`를 읽어 열 수를 세던 코드였고, flex에서는 의미가 없어 지웠다.
활성 카드 `scrollIntoView`는 `inline: 'nearest'`를 같이 준다.

품목 목록(`itemsBlock`) 한 줄은 썸네일 44px + 이름 한 줄 + 카테고리 한 줄 + 뱃지.
`minHeight: 62`. 제안(wish) 이유도 같은 두 줄만 쓰고, 긴 설명은 `title`에만 둔다.
이름·카테고리가 길어도 ellipsis라 줄 높이가 안 늘어난다(2026-09-03).

근거: `frontend/src/proto/05-screens-cde.jsx` `DetailScreen`, `RailCard`.
