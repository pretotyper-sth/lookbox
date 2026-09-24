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


## 2026-09-24 생성 작업 복귀 및 재시도

최근 서버 이력 확인: 한국 시각 2026-09-24 00:51 본인 생성 성공, 00:58 본인 외 생성은
두 번의 이미지 생성 이후 `credit_ledger.reason=tryon_body_fail`, `metadata.why=mask`로 실패했다.
당시 상세 검증 항목은 기록되지 않아 특정 옷 경계나 자세가 원인이라고 단정할 수 없다.

`request_id`가 있는 생성은 서버 백그라운드 스레드로 실행하며 작업 상태를 기존 `generated_images`의
`kind=tryon_job`으로 저장한다. 같은 계정·요청 번호의 중복 시작은 기존 상태를 반환한다.
`GET /api/live/tryon/jobs/{job_id}`는 인증 계정의 작업만 읽는다. 화면 연결을 닫아도 스레드는 계속 실행한다.
기기는 계정별 작업 번호와 대상 입력을 저장하고 재방문 때 같은 작업을 조회한다. 통신 오류는
실패 완료로 바꾸지 않고 재연결하며, 다른 계정으로 바뀌면 조회를 중단한다. 생성 중 입력이 바뀐 대상에는
이전 결과를 덮어쓰지 않는다. 화면 밖에서 발생한 실패도 앱 상태에 보존해 다시 열 때 표시한다.

생성은 최대 세 번 시도하고, 일시적인 API 오류는 지연 후 재시도한다. SDK 내부 중복 재시도는 끈다.
자산 업로드는 같은 생성본으로 각각 최대 세 번 재시도한다. 마스크 탈락 항목은 `tryon_validation`
사용 기록과 최종 실패 metadata에 남긴다. 이미지 프롬프트·분리·마스크 검증 기준·카메라 적용 방식·tryon22는 그대로다.

근거: `backend/app/main.py` `_tryon_job_read`, `_tryon_job_write`, `_tryon_job_start`, `live_tryon_body`;
`frontend/src/proto/09-app.jsx` `waitTryOnJob`, `makeTryOnBody`; `frontend/src/proto/04-screens-ab.jsx` `tryOnErrors`.
검증: 백엔드 21개·프론트 15개 테스트와 프로덕션 빌드 통과. 실제 유료 생성은 수행하지 않았다.
서버 프로세스 재시작까지 생성 자체가 이어지는 영속 실행 큐는 아니다. 상태 갱신이 30분간 없으면
중단으로 표시하며, 검증에 세 번 모두 실패한 결과는 계속 실패로 처리한다.
