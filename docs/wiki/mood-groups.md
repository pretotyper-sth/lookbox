# 무드 목록은 공통 + 여성 전용

온보딩 선호 스타일은 `03-data.jsx` `STYLES` 한 배열이다. 성별 필드가 없는 항목은
모두에게 보이고, `gender: '여성'`인 걸리시·글램·페미닌은 여성이 골랐을 때만 나온다
(`07-onboarding.jsx` `STYLES.filter`). 카드 이미지는 `manifest.json` WebP.

분류·추천이 아는 id는 `backend/app/main.py` `_STYLE_IDS`와 같아야 한다
(blockcore, bodyfit, bizcasual, girlish, glam, feminine). 2026-08-23.

착장 룩북의 인물·스튜디오 기준은 `assets/mood/남자 코디 예시.png`,
`여자 코디 예시.png`다. 서버는 이를 `backend/assets/look-identity/{m,f}.jpg`로 쓴다.
같은 폴더의 `댄디코디.png` 등은 무드별 톤 예시(남녀가 한 장에 있으면 인물 입력 금지).
2026-08-31.

근거: `frontend/src/proto/03-data.jsx` `STYLES`, `_STYLE_IDS`, [[model-look-toggle]].
