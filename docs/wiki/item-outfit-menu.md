# 아이템 메뉴 안 코디 추천

옷장 아이템 더보기의 `이 옷으로 코디 추천받기`는 sparkle 아이콘이다. 기존 `이미지만 변경`은 imageEdit 아이콘으로 분리한다. 보관한 옷은 추천 메뉴를 숨긴다. 메뉴는 520px/70dvh의 같은 프레임을 유지하고 내부만 추천 로딩·카드·저장 상태로 전환한다.

추천 API는 기존 /api/live/coordinate를 그대로 사용하며 include_item_ids로 선택한 옷을 필수로 지정한다. 무드·날씨·성별·얼굴/키/몸무게·AI 착장 설정·새 아이템 설정은 공통 추천과 같다. _outfit SSE를 받으면 상품컷을 먼저 표시하고 최종 결과 뒤 설정에 따라 AI 착장을 생성한다. AI 생성 실패 시 상품컷은 남긴다. 계정+선택 아이템별 작업을 유지하며 모달 닫기는 요청을 취소하거나 완료 시 창을 다시 열지 않는다. 다시 추천 메뉴를 열면 진행/완료 결과를 복원하고 중복 요청하지 않는다. 브라우저 전체 종료 후 복귀를 위한 별도 클라이언트 작업 저장은 추가하지 않았다.

카드는 기존 TodayCard와 공통 룩북 저장 동작을 사용한다. AI 이미지는 생성 전 확인 모달, 생성 후 sparkle↔product 아이콘으로 상품컷/AI 착장을 자유롭게 바꾼다. 태그/AI/확대는 우측 아래 동일한 크기, 2px 간격으로 배치한다. 작은 모달 카드의 생성 표시는 아이콘만 보인다. 새 아이템 상품컷/개별 썸네일에도 좌측 아래 AI 생성 표시를 적용한다. 모바일 제품 정보 라벨만 축소하며 PC 크기는 유지한다.

근거: frontend/src/proto/09-app.jsx requestPickedOutfits, frontend/src/proto/02-shared.jsx ItemRemoveSheet/Thumb, frontend/src/proto/05-screens-cde.jsx PickedOutfitsModal/LookComposite, frontend/src/proto/06-today.jsx TodayCard. 회귀: frontend/tests/item-outfit-menu.test.mjs. Chrome에서 메뉴 전환 전후 420×540 유지·닫기 후 결과 복귀·중복 요청 없음·저장·스위칭·모바일 라벨 경계 확인.
