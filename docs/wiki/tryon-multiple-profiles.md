# 바로 보기 다중 대상 프로필

바로 보기 탭에서 `본인`과 `본인 외` 프로필을 나란히 고른다. 본인은 계정 프사와
동기화하고, 본인 외는 사진·성별·연령대·키·몸무게만 그때 저장한다. 관계명·이름은
받지 않으며 목록·카메라에는 항상 `본인 외`로 표시한다.
저장한 마지막 대상은 `prefs.tryOnActive`와 `prefs.tryOnOther`에 남아 다음 방문에도
선택 상태와 전신 이미지 캐시를 유지한다.

본인 외 프로필은 계정 metadata에 사진 data URL을 넣지 않고 기존 프로필 이미지 업로드
경로의 `slot=tryon_other`로 스토리지 URL을 만든다. 전신 생성 요청은 선택 대상의 성별·연령대·키·몸무게를
서버에 보내며, 이 값과 얼굴이 바뀌면 대상별 전신 캐시를 비운다. 두 대상의 전신 프레임이 모두
준비된 경우 카메라 우상단 `전환` 버튼으로 카메라를 닫지 않고 즉시 교체한다.

본인 외 입력 바텀시트는 모바일에서 열릴 때 내부 스크롤을 상단으로 초기화하고, 다른 바로보기 탭과 같은 높이로 고정한다. 긴 상세 입력값은 시트 안에서 스크롤해 확인한 뒤 저장한다.

전신 생성 중인 대상은 `tryOnMakingSubject`로만 진행 화면을 표시한다. 진행률 숫자는 `tryOnMaking` 작업에 붙어 있어서, 본인 외나 사진·URL 탭을 다녀와도 보간 %가 되감기지 않는다. 다른 대상에 이미 전신 캐시가 있으면 즉시 그 결과를 사용할 수 있고, 대상을 되돌리면 같은 작업의 현재 %가 다시 보인다. 생성 요청은 대상 전환이나 시트 닫힘으로 취소하지 않는다. 본인 외 편집 아이콘은 모바일에서 타이틀 행 상단에 고정한다.

근거: `frontend/src/proto/04-screens-ab.jsx` `TryOnPersonSheet`·`AddSheet`,
`frontend/src/proto/09-app.jsx` `saveTryOnOther`·`makeTryOnBody`,
`frontend/src/proto/10-tryon.jsx` `TryOnCameraOverlay`, `backend/app/main.py` `TryOnBody`·`live_tryon_body`.
