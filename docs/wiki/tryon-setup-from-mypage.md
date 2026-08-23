# 마이페이지 바로 보기는 원래 사진 팝업이다

설정 `바로 보기 이미지`는 상의·하의를 체크무늬로 지우는 시트를 열지 않는다.
`openTryOnTab()`으로 추가 시트의 바로 보기 탭을 연다. 미리보기는 비어 있고
「프로필 사진 올리기」다. 저장된 `prefs.tryOnBody`로 채우지 않는다. 나머지 탭·버튼은 그대로다.

바로 보기의 구멍은 편집 화면이 아니라 카메라에서 뚫린다. 전신 사진에서 옷 자리만
투명하게 비워 후면 카메라가 그 사이로 비친다. 매장에서 종이 옷 본을 대고 보는
느낌이다 (`10-tryon.jsx` `punchBody`, `TryOnCameraOverlay`).

근거: `frontend/src/proto/08-mypage.jsx` `tryOnRow`; `04-screens-ab.jsx` `tryOnPreview`;
`09-app.jsx` `startTryOn`.
