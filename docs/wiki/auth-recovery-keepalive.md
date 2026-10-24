# 로그인 복구·비밀번호 재설정·DB 유지

2026-10-24: 라이브 번들의 인증 주소 `xxaghgxyppkceobvtcyl.supabase.co`가 DNS NXDOMAIN을 반환했다. Supabase 대시보드에서 `pretotyper-sth` 계정의 `pretotyper` 조직 `realcloset` 프로젝트가 paused임을 확인하고 사용자 요청으로 Resume을 실행했다. Render `/health`의 기존 `supabase: true`는 환경변수가 있다는 뜻일 뿐 DB 접속 성공이 아니다.

- `frontend/src/live-bridge.js`: 네트워크 인증 오류 한국어 안내, `resetPasswordForEmail`, `PASSWORD_RECOVERY` 이벤트 감지, 검증된 복구 세션과 재로드 상태 유지. `?reset=1`만으로 기존 일반 세션을 복구 세션으로 인정하지 않는다.
- `frontend/src/proto/07-onboarding.jsx`: 로그인 → 비밀번호 찾기 → 60초 재발송 제한 → 새 비밀번호/확인 → 로그아웃·로그인 복귀. 만료 링크 안내. 로그인 설명에서 룩북 제거.
- `frontend/src/proto/09-app.jsx`: 복구 화면은 기존 로그인 세션 자동 진입보다 우선한다.
- 랜딩 상품컷은 미리 디코딩하고 레이어를 유지하며 1초 opacity 전환한다. 레이아웃 재생성·translateY 진입을 없애고 reduced-motion을 존중한다.
- `backend/app/main.py` `health(db=True)`: 실제 profiles id 1행 조회. 데이터는 응답에 포함하지 않고 실패는 HTTP 503. 기존 기본 health는 가벼운 상태 확인 유지.
- `.github/workflows/supabase-keepalive.yml`: Honsulbar의 6시간 간격 운영 방식 참고. UTC 01:23/07:23/13:23/19:23 (KST 10:23/16:23/22:23/04:23), 수동 실행 지원. API를 깨우고 `health?db=true` DB 성공 플래그 확인. 서비스 키를 GitHub에 복사하지 않는다. GitHub 스케줄은 지연되거나 장기 비활성 공개 저장소에서 중단될 수 있어 가용성을 보장하지는 않는다.

## 운영 설정

Supabase Authentication → URL Configuration에서 Site URL `https://realcloset.vercel.app`과 기존 Redirect URL `https://realcloset.vercel.app/**`를 확인했다. 이 허용 범위가 재설정 반환 주소 `https://realcloset.vercel.app/?reset=1`을 포함한다. 이메일의 링크는 SDK 기본 implicit 복구 세션으로 처리한다. Supabase 기본 SMTP는 프로젝트 팀 외 수신자가 제한되므로 일반 사용자 비밀번호 재설정에는 Brevo 등의 Custom SMTP가 필요하다. API 키·SMTP 비밀번호는 소스/브라우저 번들에 넣지 않는다.

공식 문서: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail · https://supabase.com/docs/guides/auth/auth-smtp

## 검증

새 인증 테스트 5개, DB probe 테스트 3개 통과. 프런트 전체 45개 중 39개 통과, 6개 실패는 변경 전 40개 중 동일 6개 실패와 일치(아이템 추천 4·AI 표시 2). 실제 메일 수신/비밀번호 변경은 SMTP 설정 후 별도 확인이 필요하다.

## 라이브 확인 결과 (2026-10-24)

- Supabase 복구 완료·Healthy 확인, 공개 anon 키를 이용한 `/auth/v1/health` HTTP 200.
- 프런트 Vercel 배포 성공. 라이브 로그인 문구·비밀번호 찾기 화면 확인. 샘플 이미지 10개 디코딩 완료와 유지되는 9개 레이어 확인.
- Render 자동 배포 완료: `/health?db=true`의 rev `01095a0c0926`, `database: true`.
- GitHub 정기 작업 active, 수동 실행 성공: https://github.com/pretotyper-sth/lookbox/actions/runs/40068627271
- Supabase Custom SMTP 꺼짐 확인. Brevo는 로그인 화면으로 이동하며 현재 계정 접근/발신자 설정이 없어 실제 메일 발송은 미검증. SMTP 비밀번호를 대화에 붙여넣지 않고 대시보드에서 연결해야 한다.
- Render는 GitHub 계정이 배포용으로만 연결돼 있었고, 기존 `pretotyper.sth@gmail.com` Google 로그인으로 workspace 접근 성공. 별도 서버 설정 변경은 하지 않았다.
- 프로젝트 package-lock 기준 Vite 8.1.3 빌드 통과. lint 오류 없음(기존 경고와 프로토타입 전역 컴포넌트 패턴 경고 있음).

## SMTP 연결 완료 (2026-10-24 15:19 KST)

사용자가 Brevo 전용 SMTP 키를 직접 생성하고 Supabase에 저장했다. 저장된 Custom SMTP 활성화, RealCloset 발신자명, smtp-relay.brevo.com:587, 암호 저장 상태 확인. 라이브 비밀번호 찾기에서 사용자가 지정한 기존 가입 이메일로 1회 요청했고 Brevo Transactional → Email → Logs에서 `Reset your password`의 Sent → Delivered → First opening 기록을 확인했다. 실제 비밀번호는 변경하지 않았다. 가입되지 않은 이메일은 계정 열거 방지를 위해 같은 완료 안내를 보이지만 메일을 보내지 않는다.

Render 서비스는 pretotyper workspace의 Ungrouped Services → lookbox이며 https://dashboard.render.com/web/srv-d94vrk7lk1mc73c061h0 에서 확인한다. My project 안에 속하지 않아 프로젝트 목록만 보면 놓칠 수 있다.


## 한국어 메일 및 인증 DS (2026-10-24)

Supabase realcloset의 Authentication → Emails → Reset password에서 제목을 `[RealCloset] 비밀번호를 재설정해 주세요`로, 본문을 한국어로 저장했다. 새 대시보드 탭에서 제목·미리보기 및 저장 버튼 비활성 상태를 재확인했다. 원본은 `supabase/templates/recovery.html`이며 `{{ .ConfirmationURL }}`를 유지한다. 이 파일을 배포하는 것만으로 Supabase 설정이 자동 변경되지는 않는다. 로그인/찾기/재설정 화면은 `AuthPage`와 공통 필드/버튼으로 통일했다. 실제 계정 비밀번호를 바꾸는 검증은 하지 않는다.
