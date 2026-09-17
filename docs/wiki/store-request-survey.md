# 쇼핑몰 추가 요청 서베이

구매내역 쇼핑몰 선택 화면의 「+ 추가 요청하기」는 기존 몰과 같은 칩 규격·색·테두리이며, 아이콘과 문구를 한 줄로 고정한다. 요청 화면 제목은 선택 화면의 13.5px 제목과 맞추고, 주소 아래에는 「요청이 모이면 우선순위에 맞춰 검토 후 반영해요」를 둔다. 같은 박스 안에서 스크롤되는 큰 쇼핑몰 이름·주소 입력만 보이고, 하단의 단일 CTA가 「주문 내역 가져오기」 자리를 「추가 요청하기」로 바꾼다. 사용자당 같은 쇼핑몰은 한 건으로 갱신해 중복 투표를 막고, `POST /api/live/store-requests` 성공 시 접수 상태를 화면에 표시한다 (`frontend/src/proto/04-screens-ab.jsx`, `backend/app/main.py`).

관리자는 `X-Admin-Token`으로 `GET /api/live/admin/store-requests`를 호출해 사이트별 요청 수(`sites`)와 최근 요청(`recent`)을 확인한다. 테이블 생성 및 RLS 정책은 `supabase/schema.sql`에 있다.
