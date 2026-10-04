# 모바일 AI 메타포

AI 착장 이미지 표시는 모바일에서 ✦ 메타포만 노출한다. 넓은 화면은 `AI로 생성` 설명 문구를 유지한다. `frontend/src/proto/05-screens-cde.jsx`와 `frontend/src/proto/proto.css`.

이미지 확대 화면(`ImageViewer`)도 문구를 `lb-look-ai-mark-label`로 분리해 모바일 759px 이하에서 ✦만 남긴다. 목록·레일의 `aiMark="icon"`과 데스크톱 상세의 문구·좌측 하단 위치를 유지한다. `frontend/tests/look-ai-mark.test.mjs` 3개 규칙 검사와 운영 빌드가 통과했다.
