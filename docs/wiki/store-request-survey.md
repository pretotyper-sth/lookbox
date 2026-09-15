# 쇼핑몰 추가 요청 서베이

구매내역 쇼핑몰 선택 화면의 「추가 요청하기」는 쇼핑몰 이름·주소·사용 목적을 받아 `store_requests`에 저장한다. 사용자당 같은 쇼핑몰은 한 건으로 갱신해 중복 투표를 막고, `POST /api/live/store-requests` 성공 시 접수 상태를 화면에 표시한다 (`frontend/src/proto/04-screens-ab.jsx`, `backend/app/main.py`).

관리자는 `X-Admin-Token`으로 `GET /api/live/admin/store-requests`를 호출해 사이트별 요청 수(`sites`)와 최근 요청(`recent`)을 확인한다. 테이블 생성 및 RLS 정책은 `supabase/schema.sql`에 있다.
