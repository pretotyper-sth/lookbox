# AI 착장 개인화 토글

마이페이지 설정의 `내 얼굴·체형에 맞춰 보기`는 기본 off다. on 전환 시 프로필 사진·키·몸무게를 입력하는 시트를 열고, `다시 열지 않기`를 선택하면 `user_metadata.prefs.personalModelLookDontAsk`에 계정 단위로 저장한다. 사진·신체 정보가 없으면 저장할 수 없다(`frontend/src/proto/08-mypage.jsx`, `09-app.jsx`).

개인화 착장 생성은 프로필 사진과 키·몸무게를 `/api/live/coordinate/looks`에 전달한다. 생성 프롬프트는 사진의 얼굴·체형을 유지하고 수치는 자연스러운 비율 가이드로만 사용한다. 사진 해시와 수치를 캐시 키에 넣어 사진·수치 변경 시 이전 개인화 결과를 재사용하지 않는다(`backend/app/main.py`).
