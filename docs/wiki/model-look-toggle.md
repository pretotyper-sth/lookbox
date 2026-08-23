# AI 착장 토글은 지금 있는 코디에도 입힌다

마이페이지 `AI 캐릭터 착장 이미지로 보기`를 켜면 프로필 얼굴로 전신 착장 컷을 만든다.
무료에서도 열려 있고, 장당 5크레딧이다(`PLANS["free"]["model_look"]=True`,
`CREDIT_COSTS["model_look"]=5`, 2026-08-23). 예전에는 프로만 서버가 만들어 줘서
토글을 켜도 옷 플랫레이만 남았다.

이미 받아 둔 오늘의 코디는 `POST /api/live/coordinate/looks`로 lookImg만 채운다.
새 추천(`requestDailyOutfits`)과 옷장에서 고른 추천에도 `model_look`+`face_data_url`을 실어 보낸다.

근거: `frontend/src/proto/09-app.jsx` `setModelLook`, `applyModelLooks`;
`backend/app/main.py` `_apply_model_looks`, `live_coordinate_looks`.
