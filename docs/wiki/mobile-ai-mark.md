# 모바일 AI 메타포

AI 착장 이미지 표시는 모바일에서 ✦ 메타포만 노출한다. 넓은 화면은 `AI로 생성` 설명 문구를 유지한다. `frontend/src/proto/05-screens-cde.jsx`와 `frontend/src/proto/proto.css`.

이미지 확대 화면(`ImageViewer`)도 문구를 `lb-look-ai-mark-label`로 분리해 모바일 759px 이하에서 ✦만 남긴다. 목록·레일의 `aiMark="icon"`과 데스크톱 상세의 문구·좌측 하단 위치를 유지한다. `frontend/tests/look-ai-mark.test.mjs` 3개 규칙 검사와 운영 빌드가 통과했다.

2026-10-11: TodayCard의 아이콘형 AI 배지는 우측 버튼과 같은 24px 원형, 아래 7px 간격으로 정렬한다. AI 착장에도 상품컷과 같은 옷 정보 버튼을 제공하며 브랜드·상품명·가격을 이미지 양쪽에 나눠 표시한다. 저장·AI/상품컷 전환·확대 버튼에 짧은 hover 설명을 추가했다. 근거: `frontend/src/proto/05-screens-cde.jsx` LookComposite, `frontend/src/proto/06-today.jsx` TodayCard.
