# 피드 라이브 활성화

2026-10-11 사용자 승인: 로컬 변경 메인 푸시뿐 아니라 피드 자체의 라이브 활성화까지 포함.

## 서버 설정

Render 백엔드 환경변수 `STYLE_STUDIO_DATABASE_URL`에 Supabase Connect → **Session pooler**의 PostgreSQL 연결 URL을 설정한다. DB 비밀번호를 URL에 넣을 때 특수문자는 URL 인코딩한다. SSL은 서버에서 require로 고정한다. 로컬 SQLite 모드인 `STYLE_STUDIO_LOCAL`은 라이브에서 설정하지 않는다(또는 0). 연결값·비밀번호는 코드/채팅에 남기지 않는다.

`backend/app/studio_database.py`는 최초 접속에 `backend/app/studio.sql`을 적용해 전용 `realcloset_studio` 스키마/테이블/인덱스를 만든다. 기존 public wardrobe/profiles 테이블과 분리하며 기존 옷장 데이터를 이관하거나 지우지 않는다. 스키마 생성 권한이 있는 DB 연결을 사용한다. 초기화는 advisory lock과 트랜잭션으로 보호한다. DB 연결 설정이 없으면 SQLite로 우회하지 않고 503을 반환한다. DB 설정 없는 상태에서 실제 라이브 게시/새로고침 지속성을 검증했다고 표현하지 않는다.

## 인증·이미지·프런트

`frontend/src/main.jsx`는 프로덕션에서도 피드를 로드한다. `live-bridge.js`는 프로덕션 `/api/studio` 요청을 기존 API 호스트로 보내며 Supabase 세션 토큰을 붙이고 401 갱신을 처리한다. 개발 환경은 기존 SQLite 저장을 유지한다. 백엔드 `owner`는 라이브에서 검증된 Supabase user.id의 해시를 소유자로 쓰며 브라우저가 보내는 owner 헤더를 계정 신원으로 신뢰하지 않는다. 공유 게시글/투표의 GET은 방문자 식별자로 읽을 수 있다. 게시·수정·저장·팔로우 등 쓰기는 검증된 서비스 세션을 사용한다.

Base64 이미지는 해시 파일명으로 기존 Supabase Storage `wardrobe`(또는 SUPABASE_BUCKET)에 저장하고 DB에는 URL을 넣는다. 로컬 체험은 기존 `.local/style-media`를 유지한다. 기존 로컬 SQLite 게시글은 라이브 계정 데이터로 자동 이관하지 않는다. 공개 옷 추가 시 실제 로그인한 계정의 owned 옷장 레코드를 확인한다. 충돌하는 다른 계정 게시글 ID는 수정할 수 없다.

보호된 바로 보기 코드는 변경하지 않는다. 주문/캐릭터 생성의 로컬 작업 서버는 기존 DEV 조건을 유지한다.

## 확인 상태

프로덕션 빌드에 피드·검색·편집기 번들 포함, 백엔드 문법 확인 완료. 실제 PostgreSQL 연결/라이브 저장·인증 전환은 서버 연결 설정 후 확인 필요.
