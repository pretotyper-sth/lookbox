# 무드 목록은 공통 + 여성 전용

온보딩 선호 스타일은 `03-data.jsx` `STYLES` 한 배열이다. 성별 필드가 없는 항목은
모두에게 보이고, `gender: '여성'`인 걸리시·글램·페미닌은 여성이 골랐을 때만 나온다
(`07-onboarding.jsx` `STYLES.filter`). 카드 이미지는 `manifest.json` WebP.

분류·추천이 아는 id는 `backend/app/main.py` `_STYLE_IDS`와 같아야 한다
(blockcore, bodyfit, bizcasual, girlish, glam, feminine). 2026-08-23.

현재 착장 생성은 `assets/mood/남자 코디 레퍼런스.png`, `여자 코디 레퍼런스.png`를 직접 읽는다. 없으면 `backend/assets/look-identity/{m,f}.{jpg,jpeg,png,webp}`로 대체한다. 이 파일들은 무드 카드와 별개로 사용 중이므로 카드 교체 때문에 삭제하지 않는다. 근거: `backend/app/main.py:4808` `_mood_identity_seed` (2026-10-07 확인).

근거: `frontend/src/proto/03-data.jsx` `STYLES`, `_STYLE_IDS`, [[model-look-toggle]].

## 전체 무드 시안 — 2026-10-07

현재 AI 착장의 웜 그레이지 스튜디오·전신 구도를 유지하면서 헤어·포즈·레이어링·실루엣을 더 힙하게 잡은 18개 개별 생성 이미지다. 공통 15개는 남녀, 여성 전용 3개는 여성 모델이며 카테고리 id는 유지했다.

`frontend/public/mood-preview.html:1`에서 전체 보기·기존 이미지 비교·확대·원본 ZIP 다운로드를 제공한다. 원본과 생성 프롬프트는 `docs/research/mood-refresh-2026-10/`, 미리보기는 `frontend/public/mood-preview-2026-10/`에 있다.

사용자 승인 후 `frontend/public/prototype-assets/style*.webp` 18장을 교체하고 `frontend/src/proto/manifest.json:21`에 파일 해시 쿼리를 붙여 이전 브라우저 캐시와 분리했다. 온보딩·설정이 공유하는 기존 연결과 로딩 로직, 카테고리·테마는 유지했다. 이전 카드는 `frontend/public/mood-preview-2026-10/previous/`에 보존하여 비교가 계속 가능하다. 여성 전용 마지막 3장은 무드 카드이며 생성 레퍼런스가 아니다. 빌드와 18개 서비스 이미지 HTTP 응답·해시 일치를 확인했다.

프리뷰 18장은 480×600 WebP, 총 256,906바이트, 장당 7,370~20,382바이트다. 첫 4장만 우선 로딩하고 나머지는 지연 로딩한다. 18개 파일·기존 비교 경로·ZIP 개수·로컬 응답과 브라우저 비교/확대를 확인했다. 근거: `docs/research/mood-refresh-2026-10/manifest.json:1`, `prompts.json:1`.

스포티의 최종 요청은 원래 서비스 카드의 의상을 유지하고 새 시리즈 톤만 맞추는 것이다. 남성 회색 후드 재킷·화이트 티·검정 반바지·흰 양말, 여성 화이트 후드 재킷·화이트 크롭 탑·검정 트랙 팬츠·검정 숄더백을 재현했다. 모델·웜 그레이지 스튜디오·조명·전신 구도는 새 시리즈 기준이다. 이전 외출복 해석은 폐기하고 원본을 `revisions/sporty-v2-city.png`에 보존했다. 서비스·갤러리·ZIP·캐시 해시를 갱신했다. 480×600 WebP 15,840바이트, 로컬 응답 일치 확인. 근거: `docs/research/mood-refresh-2026-10/prompts.json` `sporty_original_outfit_revision`.

클래식도 사용자 피드백으로 전통적인 소재와 조합을 강화했다. 남성은 헤링본 트위드·니트 베스트·타이·울 팬츠·로퍼, 여성은 네이비 트위드·타이 블라우스·카멜 울 스커트·로퍼·구조적인 가방이다. 인물·배경·구도 유지, 기존 원본은 `revisions/classic-v1.png`로 보존했다. 서비스·갤러리·ZIP·해시 갱신, 480×600 WebP 15,574바이트·로컬 응답 확인. 근거: `docs/research/mood-refresh-2026-10/prompts.json` `classic_heritage_revision`.

## 라이브 배포 — 2026-10-07

`efd5831`로 카드 WebP 18장과 이미지 manifest만 커밋·푸시했다. 다른 미완료 로컬 작업은 제외했다. Vercel 프로덕션 `dpl_26Ft562KMu3oPZ7KDNVRNYeRXHG2` Ready 및 `https://realcloset.vercel.app` 연결을 확인했다. 분리한 HEAD 기반 프런트 빌드 통과, 라이브 18개 이미지 바이트와 로컬 승인본 일치·라이브 앱 번들의 해시 URL 18개 참조를 확인했다. 갤러리/원본 ZIP은 로컬 검토 자료로 남겼다.
