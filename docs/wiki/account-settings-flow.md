# Account settings flow

개인 정보와 비밀번호 변경은 하나의 계정 시트 안에서 별도 화면으로 전환한다. 비밀번호 변경 화면은 뒤로 가기로 돌아오며, 프로필 입력값은 유지한다. 변경 성공 시 기존 성공 토스트를 보여주고 프로필 화면으로 복귀한다. 시트를 닫았다 다시 열면 개인 정보 화면부터 시작한다.

관련 코드: `frontend/src/proto/08-mypage.jsx`, `frontend/src/proto/09-app.jsx`.
