# 무드 그룹

온보딩·내 스타일 카드는 `STYLE_GROUPS` 순으로 섹션을 그린다.
지금은 `공통`만 있다. `STYLES[].group`이 없으면 공통으로 본다
(`frontend/src/proto/03-data.jsx` `STYLE_GROUPS`, `STYLES`;
`07-onboarding.jsx` STYLES step).

카드는 2열 그리드. 마지막 행이 1개여도 맞춘다. 2026-08-22.
