# 현재 위치 날씨 기반 데일리 추천

로그인한 브라우저는 Geolocation 권한을 요청하고, 좌표가 허용되면 `GET
/api/live/weather?lat=…&lon=…`로 현재 기온·체감온도·오늘 최고/최저·날씨 상태를
받는다. 좌표는 날씨 조회 요청에만 쓰며 계정이나 DB에 저장하지 않는다.

날씨 조회는 좌표를 소수점 둘째 자리 단위로 30분 캐시한다. 권한 거부·브라우저 미지원·조회
실패 시에만 서울 기본값으로 돌아간다. 추천 요청은 받은 날씨를 함께 보내며, 더운 날의
두꺼운 외투, 추운 날의 얇은 여름옷, 비·눈 날의 스웨이드·캔버스류 신발에 감점을 준다.

근거: `frontend/src/proto/09-app.jsx` `refreshDeviceWeather`, `coordProfile`;
`backend/app/main.py` `_weather_for_location`, `_weather_item_penalty`.
