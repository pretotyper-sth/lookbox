# 바로 보기는 계정 프사를 쓰고, 카메라는 모바일만

마이페이지 설정에는 `바로 보기 이미지` 행이 없다. AI 착장은 프로필이 아니라
성별만 맞춘 룩북 모델이다. 바로 보기는 조합 추천받기 시트의 탭에서 연다.

탭 미리보기는 계정 `prefs.avatar`다. 별도 업로드 칸(`tryOnLocal`)은 없다.
원형 `ProfileAvatar`를 누르면 마이페이지 프사와 같이 바뀐다. 얼굴을 바꾸면
`tryOnBody`/`tryOnFrame`을 비워 다음 바로 보기에서 전신을 다시 만든다.
프사는 기기 localStorage data URL이 아니라 스토리지 URL을 `prefs.avatar`에
붙여 계정에 따라다닌다([[profile-avatar]], 2026-08-30).

- **PC (`wide`)**: 원형 프사 + 「이 사진으로 옷을 바로 비춰 볼 수 있어요 · 모바일 전용」.
  카메라는 열지 않는다.
- **모바일, 프사 있음**: 바로 보기 탭을 누르면 `getUserMedia`로 후면 카메라를 연다.
  시트는 닫지 않아 카메라를 끄면 같은 탭으로 돌아온다.
- **모바일, 프사 없음**: 사진·PC와 같은 212px 칸에 「프로필 사진 올리기」.

구멍은 카메라에서 뚫린다 (`10-tryon.jsx` `punchBody`). 패널 높이는 사진 탭과
같다(168 + 힌트 칸 44). 탭을 바꿔도 시트 높이가 뛰지 않게 오류도 칸 안에 둔다.

근거: `04-screens-ab.jsx` `launchTryOnFromSheet`; `09-app.jsx` `setAvatar`·`startTryOn`;
`08-mypage.jsx` `ProfileAvatar`.
