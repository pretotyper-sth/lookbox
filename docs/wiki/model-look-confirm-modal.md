# AI 착장 확인 모달

AI 착장 이미지 생성 확인창은 `BottomSheet`의 `centered` 옵션으로 모바일에서도 화면 중앙에 표시한다. 작은 화면에서는 화면 높이를 넘지 않도록 모달 내부를 스크롤한다. 코디 카드 확인창 두 곳에서만 사용한다: `frontend/src/proto/05-screens-cde.jsx`, `frontend/src/proto/06-today.jsx`.

2026-10-07: DEV 마이페이지의 AI 착장 ON 하위에 ‘선택 코디도 자동 생성’ 스위치를 추가했다. 기본 OFF이며 설명 ‘새 착장마다 크레딧 차감’은 nowrap 한 줄이다. 첫 활성화 시 centered BottomSheet로 비용/상품컷 OFF 동작을 안내하고 켜기에서만 enabled/confirmed를 저장한다. 취소는 활성화/확인 기록을 남기지 않는다. 확인 후 재활성화는 모달 없이 진행한다. 상태는 lb_picked_model_look_{authUid} 로컬스토리지에만 저장하며 계정 prefs로 업로드하지 않는다. DEV에서 선택 옷 기반 requestPickedOutfits만 이 옵션과 기존 modelLook이 모두 ON일 때 coordinateLookSettings를 적용한다. 기존 얼굴 맞춤 설정도 그대로 전달한다. 선택 작업 캐시 키에 AI/맞춤 ON 상태를 구분해 다른 모드의 결과를 잘못 재사용하지 않는다. 오늘 추천·프로덕션 및 바로 보기에는 적용하지 않는다. 옵션을 켜는 것만으로 이미지 생성은 호출하지 않는다.

근거: frontend/src/proto/08-mypage.jsx pickedModelLookRow/pickedLookConfirm, 09-app.jsx readPickedLookSettings/setPickedModelLook/requestPickedOutfits. lint 오류 없음(기존 경고). 로컬 브라우저가 동적 모듈을 불러오지 못해 화면 확인은 미완료; 서버 파일 응답은 200. 실제 비용 발생 생성은 실행하지 않았다.

2026-10-08: 선택 코디 자동 생성 설정명을 “고른 옷으로 AI 착장 자동 생성”으로 변경. 기존 singleLine/nowrap 유지. 근거: `frontend/src/proto/08-mypage.jsx` pickedModelLookRow.

2026-10-08 문구 보정: 오늘 코디의 AI 착장 설정을 기본으로 개별 아이템 코디 요청에도 적용하는 하위 토글이라는 뜻을 담아 “아이템 코디도 AI 착장 자동 생성”으로 변경. singleLine 유지. 근거: `frontend/src/proto/08-mypage.jsx` pickedModelLookRow.

2026-10-08 최종 축약: “개별 아이템 직접 코디 요청 시에도 AI 착장 자동 생성”의 모바일 표시명을 “아이템 코디 요청도 AI 착장 생성”으로 축약. 자동 생성 토글 동작·크레딧 안내·singleLine 유지. 근거: `frontend/src/proto/08-mypage.jsx` pickedModelLookRow.

2026-10-08: 개별 아이템 AI 착장 토글 하단 설명을 “고른 옷의 코디도 AI 착장으로 보여줘요”로 변경. 기존 한 줄 표시 및 최초 활성화 비용 안내 모달 유지. 근거: `frontend/src/proto/08-mypage.jsx` pickedModelLookRow.

2026-10-08 설명 보정: “옷장에서 직접 고른 옷도 AI 착장으로 보여줘요”로 변경해 옷장에서 직접 선택한 코디 요청에 적용됨을 명시. singleLine 유지. 근거: `frontend/src/proto/08-mypage.jsx` pickedModelLookRow.
