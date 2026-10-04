# 현재 위치 날씨 기반 데일리 추천

2026-10-04: 운영 `/api/live/weather`가 관측 실패 후 고정 기온 24/27/18과 `날씨 정보`를 반환했다. 화면은 이 응답을 버린 뒤 위치 확인 문구에 머물렀다. Geolocation 권한 응답이 없는 경우에도 자체 3초 제한으로 종료하며, 실제 좌표 또는 권한 미확인 시 서울 좌표로 날씨를 조회한다.

브라우저는 운영 API와 같은 Open-Meteo 제공처의 직접 요청을 병렬 실행하고 유효한 관측이 먼저 온 결과를 사용한다. 두 경로 모두 10초 제한이 있으며 실패하면 재시도 버튼을 표시한다. 실패 시 최대 2회 자동 재시도(15/30초), 온라인 복귀·포커스 복귀·30분 간격으로 갱신한다. 날씨 공개 API는 로그인 토큰 갱신을 기다리지 않는다.

기기 캐시 `lb_device_weather_v7`은 같은 날짜·30분 이내의 실제 기온/최고/최저/날씨 결과만 재사용한다. 좌표는 캐시·계정·DB에 저장하지 않는다. 역지오코딩 없이 직접 관측이 먼저 도착하면 `현재 위치`를 표시한다. 위치 권한이 없으면 `서울`을 명시한다. 서버 실패 값은 null이며 임의 기온을 만들거나 실패 결과를 캐시하지 않는다. 실제 체감온도 0도는 보존한다.

코디 생성은 날씨를 기다리지 않는다. 관측 전에는 계절 기준을 사용하고 관측 후에는 현재 날씨를 추천 점수에 반영한다. 더운 날의 두꺼운 외투, 추운 날의 얇은 여름옷, 비·눈 날의 스웨이드·캔버스 신발에 감점한다.

근거: `frontend/src/weather.js` `loadCurrentWeather`; `frontend/src/proto/09-app.jsx` `refreshDeviceWeather`; `frontend/src/proto/06-today.jsx` `ContextStrip`; `frontend/src/live-bridge.js` `installFetchBridge`; `backend/app/main.py` `_weather_for_location`. 단위 테스트: `frontend/tests/weather-resolution.test.mjs`, `backend/tests/test_weather_location.py`. 실제 Chrome 직접 요청에서 서울 기온/최고/최저 표시 확인. 제공처 계약: https://open-meteo.com/en/docs.
