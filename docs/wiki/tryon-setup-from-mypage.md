# 바로 보기 이미지는 설정 시트를 연 채로 보여 준다

마이페이지 `바로 보기 이미지`는 프로필로 전신을 만든 뒤 토스트만 반복하지 않는다.
`openTryOnSetup(null, { settings: true })`로 `TryOnSetupOverlay`를 연다. 이미 만든
전신/프레임이 있으면 비우기 화면이 채워진 채 뜬다. 없으면 프사로 만든 다음 그 시트를
유지한다(`09-app.jsx` `openTryOnSetup`, `tryOnSetupAsSettings`).

PC에서 설정으로 연 시트의 저장은 카메라를 열지 않고 시트를 닫지 않는다.
조합 흐름에서 연 저장만 모바일 카메라 / PC 안내 토스트를 탄다.

근거: `frontend/src/proto/08-mypage.jsx` `tryOnRow`; `10-tryon.jsx` `making`.
