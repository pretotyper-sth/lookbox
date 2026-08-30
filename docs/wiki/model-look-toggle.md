# AI 착장 토글은 룩북 모델을 입힌다

마이페이지 `AI 캐릭터 착장 이미지로 보기`를 켜면 성별만 맞춘 무신사 룩북 스타일
모델이 그 코디를 입은 전신 컷을 만든다. 프로필 사진·키·몸무게는 쓰지 않는다.
무료에서도 열려 있고, 장당 5크레딧이다(`PLANS["free"]["model_look"]=True`,
`CREDIT_COSTS["model_look"]=5`, 2026-08-23). 설정 행에는 비용 안내를 붙이지 않는다.
켤 때 사진 시트는 없다.

조합 추천(`POST /api/live/coordinate`)은 코디 목록만 먼저 돌린다. 착장은
`POST /api/live/coordinate/looks`가 이어서 채운다(2026-08-30). 품질은 추출의
착용컷·재시도와 같은 `OPENAI_IMAGE_QUALITY_LOOK`(기본 high).

배경은 상품 카드 `--thumb-bg`와 같은 `#E5E3DE`. 옷 참고는 상단 작은 스트립만
두고, 생성 후 테두리 flood·끊긴 판 조각을 평탄화한다. 첫 착장을
`model-ref-h-{m|f}`로 저장한 뒤 나머지는 그 참조로 병렬 생성한다.

근거: `backend/app/main.py` `_model_look_prompt`, `_flatten_look_plate`,
`_model_look_board`, `generate_model_look_image`; `frontend/src/proto/09-app.jsx`
`applyModelLooks`.
