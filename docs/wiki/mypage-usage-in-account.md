# 사용량은 계정 및 지원 안에, 버전은 페이지 맨 아래만

마이페이지에서 사용량을 독립 카드로 두면 PC 2열에서 한 칸을 통째로 먹는다
(`08-mypage.jsx` 예전 `UsageCard`). 크레딧 숫자·막대·초기화만 `UsageBlock`으로
줄여 **계정 및 지원** 카드 상단에 넣는다. 동작별 차감 목록은 안 그린다.
요금제는 같은 블록의 `요금제 보기` → `PlanSheet`.

빌드 문자열(`v1.0.0 · {BUILD_ID}`)은 계정 카드에 두지 않는다. 페이지 맨 아래
`LOOKBOX v1.0.0 · {BUILD_ID}` 한 곳만. PC는 설정 | 계정 2열.

근거: `frontend/src/proto/08-mypage.jsx` `UsageBlock`, `accountCard`.
