# 코디 상세(데스크탑)는 사진 왼쪽 / 코디 줄 + 품목 오른쪽

`DetailScreen`은 사진(`photoBlock`)과 품목 목록(`itemsBlock`)을 따로 만든다.

- 모바일, 그리고 데스크탑에서 코디가 하나뿐일 때: 한 카드에 사진 → 품목 순으로 쌓는다(`card`).
- 데스크탑에서 코디가 여럿일 때: 왼쪽에 사진 카드만, 오른쪽에
  `오늘의 다른 코디` 라벨 + `n / total` + 좌우 화살표 → **가로 한 줄** 레일 →
  그 아래 선택된 코디의 품목 카드.

이전에는 왼쪽 카드가 사진 + 품목을 다 갖고, 오른쪽 레일이
`repeat(auto-fill, minmax(148px, 1fr))` 격자로 여러 줄이었다. 크롬 100% 배율
1440x900에서 코디 목록이 접혀 스크롤을 내려야 보였다(2026-09-02 사용자 지적).
가로 한 줄로 바꾸면 코디가 늘어도 세로로 자라지 않는다.

레일은 `display:flex` + `overflowX:auto`이고 카드는 `flex:1 1 148px` + `minWidth:148` +
`maxWidth:188` + `overflow:hidden`이다. `1 0 148px`만 두면 이미지 intrinsic 폭 때문에
칸이 제각각이 된다(2026-09-03). 상한 188px은 `minmax(148px, 1fr)` 격자가 한 칸에
줄 수 있던 최대 폭이라, 코디가 둘뿐일 때 카드가 혼자 커지는 것도 막는다.
라벨은 두 줄로 고정(`line-clamp: 2`). `RailCard` 버튼은 `width:100%`.
화살표(`RailPageBtn`)는 `scrollBy(clientWidth * 0.8)`. `syncRail`이 스크롤·코디 수
변화마다 양 끝 도달 여부를 보고 끝에 닿은 쪽 화살표를 죽인다.

레일이 한 줄이 되면서 방향키는 좌우만 ±1로 옮긴다. 예전 위/아래 ±cols는
`gridTemplateColumns`를 읽어 열 수를 세던 코드였고, flex에서는 의미가 없어 지웠다.
활성 카드 `scrollIntoView`는 `inline: 'nearest'`를 같이 준다.

근거: `frontend/src/proto/05-screens-cde.jsx` `DetailScreen`, `RailCard`.
