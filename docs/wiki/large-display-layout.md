# 큰 화면 레이아웃 — 로그인 전 화면

로그인 전 화면(Landing·Login·Onboarding)은 남은 세로를 flex spacer로 나눠 쓴다:
`07-onboarding.jsx:220` `flex: '5 1 16px'`, `07-onboarding.jsx:260` `flex: '3 1 8px'`.
폰에서는 맞지만 세로가 남는 디스플레이에서는 spacer가 남는 높이를 전부 먹어
로고-문구-그리드-CTA 사이가 300px씩 벌어진다. 1280x1600에서 실측 확인(2026-08-17).

메인 앱에는 이미 데스크탑 셸이 있다(`09-app.jsx:1562`, `wide = innerWidth >= 760`,
사이드바 + `.lb-wide-inner` max-width 1080). 문제는 그 셸을 쓰지 않는 로그인 전 화면뿐이다.

해결: `proto.css`의 `.lb-page-cap` — 폭 480 / 높이 920 상한 + `margin: auto`로 가운데 정렬.
`min-width:900px and min-height:1040px`에서만 560/1040으로 한 단계 키운다. 폭이 커지면
히어로 그리드(정사각 2x2)도 같이 커져 콘텐츠 높이가 늘어나므로, 560/1040은 폰(390x844)과
거의 같은 여백 비율이 된다.

세로가 상한보다 짧으면(예: 1440x900) 아무 것도 달라지지 않는다 — 폰 동작이 기본이다.

관련: [[recent-tag-field-scroll]]
