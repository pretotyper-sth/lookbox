# AI 착장 토글은 룩북 모델을 입힌다

마이페이지 `AI 캐릭터 착장 이미지로 보기`를 켜면 성별만 맞춘 무신사 룩북 스타일
모델이 그 코디를 입은 전신 컷을 만든다. 프로필 사진·키·몸무게는 쓰지 않는다.
무료에서도 열려 있고, 장당 5크레딧이다(`PLANS["free"]["model_look"]=True`,
`CREDIT_COSTS["model_look"]=5`, 2026-08-23). 설정 행에는 비용 안내를 붙이지 않는다.
켤 때 사진 시트는 없다.

이미 받아 둔 오늘의 코디는 `POST /api/live/coordinate/looks`로 lookImg만 채운다.
새 추천과 옷장에서 고른 추천에는 `model_look`만 보낸다. 성별은 추천 프로필에 이미 있다.

배경은 상품 카드 `--thumb-bg`와 같은 `#E5E3DE`. 생성 후 가장자리와 이어진 밝은
판 픽셀을 그 색으로 칠하고, 인물에 막혀 끊긴 판 조각은 이웃 판까지 확장해 칠한다.
프롬프트는 머리·발 아래 약 12% 여백과 고정 포즈(왼손 주머니·정면)를 요구한다.

같은 사용자·성별의 첫 착장을 `model-ref-{m|f}`로 저장하고, 이후 코디는 왼쪽 참조
모델+오른쪽 옷 보드를 합쳐 `images.edit`에 넣어 얼굴·포즈를 맞춘다. 배치 내 생성은
순차 처리한다(2026-08-30).

근거: `backend/app/main.py` `_model_look_prompt`, `_flatten_look_plate`,
`_model_look_composite`, `generate_model_look_image`; `frontend/src/proto/09-app.jsx` `setModelLook`.
