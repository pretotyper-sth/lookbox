# 로그인 복구·비밀번호 재설정·DB 유지

2026-10-24: 라이브 번들의 인증 주소 `xxaghgxyppkceobvtcyl.supabase.co`가 DNS NXDOMAIN을 반환했다. Supabase 대시보드에서 `pretotyper-sth` 계정의 `pretotyper` 조직 `realcloset` 프로젝트가 paused임을 확인하고 사용자 요청으로 Resume을 실행했다. Render `/health`의 기존 `supabase: true`는 환경변수가 있다는 뜻일 뿐 DB 접속 성공이 아니다.

- `frontend/src/live-bridge.js`: 네트워크 인증 오류 한국어 안내, `resetPasswordForEmail`, `PASSWORD_RECOVERY` 이벤트 감지, 검증된 복구 세션과 재로드 상태 유지. `?reset=1`만으로 기존 일반 세션을 복구 세션으로 인정하지 않는다.
- `frontend/src/proto/07-onboarding.jsx`: 로그인 → 비밀번호 찾기 → 60초 재발송 제한 → 새 비밀번호/확인 → 로그아웃·로그인 복귀. 만료 링크 안내. 로그인 설명에서 룩북 제거.
- `frontend/src/proto/09-app.jsx`: 복구 화면은 기존 로그인 세션 자동 진입보다 우선한다.
- 랜딩 상품컷은 미리 디코딩하고 레이어를 유지하며 1초 opacity 전환한다. 레이아웃 재생성·translateY 진입을 없애고 reduced-motion을 존중한다.
- `backend/app/main.py` `health(db=True)`: 실제 profiles id 1행 조회. 데이터는 응답에 포함하지 않고 실패는 HTTP 503. 기존 기본 health는 가벼운 상태 확인 유지.
- `.github/workflows/supabase-keepalive.yml`: Honsulbar의 6시간 간격 운영 방식 참고. UTC 01:23/07:23/13:23/19:23 (KST 10:23/16:23/22:23/04:23), 수동 실행 지원. API를 깨우고 `health?db=true` DB 성공 플래그 확인. 서비스 키를 GitHub에 복사하지 않는다. GitHub 스케줄은 지연되거나 장기 비활성 공개 저장소에서 중단될 수 있어 가용성을 보장하지는 않는다.

## 운영 설정

Supabase Authentication → URL Configuration에 `https://realcloset.vercel.app/?reset=1`을 Redirect URL로 허용해야 한다. 이메일의 링크는 SDK 기본 implicit 복구 세션으로 처리한다. Supabase 기본 SMTP는 프로젝트 팀 외 수신자가 제한되므로 일반 사용자 비밀번호 재설정에는 Brevo 등의 Custom SMTP가 필요하다. API 키·SMTP 비밀번호는 소스/브라우저 번들에 넣지 않는다.

공식 문서: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail · https://supabase.com/docs/guides/auth/auth-smtp

## 검증

새 인증 테스트 5개, DB probe 테스트 3개 통과. 프런트 전체 45개 중 39개 통과, 6개 실패는 변경 전 40개 중 동일 6개 실패와 일치(아이템 추천 4·AI 표시 2). 실제 메일 수신/비밀번호 변경은 SMTP 설정 후 별도 확인이 필요하다.
