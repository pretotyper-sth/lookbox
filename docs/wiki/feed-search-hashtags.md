# 피드 해시태그·검색과 저장 용량

2026-10-08 로컬 적용. 실서비스 배포 및 신규 유료 서비스 가입은 하지 않았다.

## 사용자 동선

- 게시 화면에 해시태그 입력·추천·삭제 칩을 추가했다. 한글/영문/숫자/밑줄, 태그당 24자·피드당 10개. 별도 해시태그 칸에 추가한 태그만 NFKC/소문자로 중복을 제거한다. 본문의 #태그는 일반 텍스트로 표시하고 검색 태그로 추출하지 않는다. 리스타일은 원문의 캡션과 태그를 복사하지 않는다.
- 알림 왼쪽 검색 버튼 → 전체/계정/해시태그 → 프로필 또는 태그별 최신 피드 그리드 → 기존 공개 프로필/상세 보기. 별도 태그를 누르면 태그 검색으로 연결한다.
- 입력 후 250ms에 요청하며 20초·최대 30개 검색 결과 캐시를 사용한다. 게시/수정/소셜 변경 시 캐시를 비운다. 최근 검색 최대 10개는 기기에만 저장하고 삭제할 수 있다. 검색 기록을 DB에 쓰지 않는다.
- 계정은 완전 일치·앞부분 일치가 먼저이며 추가 후보가 필요하면 이름이 포함되는 계정을 찾는다. 해시태그는 앞부분 자동완성·완전 일치 우선·공개 피드 수로 정렬한다. 원 서비스의 비공개 개인화 순위 알고리즘을 복제했다고 주장하지 않는다.
- 샘플 8개에 데일리룩/셔츠코디/남자코디/올블랙 등 태그를 넣어 기존 생성 이미지 기반으로 체험할 수 있다. 샘플은 서버 DB에 복제하지 않고 클라이언트에서 병합한다.

근거: `frontend/src/style/feed-search.jsx`, `model.js`, `story-editor.jsx`, `experience.jsx`, `social.jsx`.

## 무료 유지 목적의 실제 저장 구조

기존 로컬 SQLite를 사용한다. 검색·태그 기능에 AI/Algolia/Elasticsearch/벡터 DB를 사용하지 않으며 별도 검색 API 요금이 없다.

- `look_tags(look_id,tag)` 복합 PK로 중복 없는 N:M 연결. `(tag,look_id)` 인덱스가 자동완성과 태그 조회를 지원한다.
- `search_posts(look_id,owner,public,published_at)`에는 작은 메타데이터만 저장한다. 공개/날짜/ID 인덱스와 키셋 커서로 공개 태그 피드를 24개씩 읽는다. 검색 제안은 최대 태그 12개/계정 12개이며 캔버스 JSON/사진을 읽지 않는다.
- `profile_search(owner,name,name_key)`는 이름만 저장하며 사진·개인 신체 설정을 복제하지 않는다. 이름 변경 시 인덱스를 갱신한다.
- 게시/수정/비공개 전환 시 태그 연결과 공개 플래그를 같은 트랜잭션에서 갱신한다. 삭제 시 FK CASCADE로 검색/태그 연결도 지운다. 링크 공개·나만 보기 피드는 태그 검색과 개수에서 제외한다.
- Base64 이미지·프로필 사진은 SHA-256 파일명으로 `backend/.local/style-media/`에 한 번 저장한다. DB에는 `/api/studio/media/<hash>.<ext>` 경로만 저장하므로 공유·저장·리스타일마다 이미지 바이트를 복제하지 않는다. 기존 looks/profiles/state/public_items도 최초 한 번 같은 방식으로 이관하며 기존 내용을 유지한다.
- 이미지 응답은 immutable 캐시 1년. DB의 검색 인덱스는 한 번 백필하며 다음 접속 때 전체 재인덱싱하지 않는다. DB 및 이미지 파일은 기존 `.local` 제외 규칙으로 Git에 포함되지 않는다.

근거: `backend/app/style_studio.py` db/compact_media/index_look/index_profile/search/save_look/update_profile.

## 실서비스 무료 운영의 범위

이번 저장소는 로컬 전용이다. 로컬 SQLite/파일 저장은 외부 DB 할당량을 쓰지 않지만, 이를 무료 호스팅의 임시 파일 시스템에 그대로 올리면 재시작 시 데이터가 사라질 수 있으므로 실서비스 영속 저장소로 취급하면 안 된다.

실서비스로 전환할 때는 기존 Supabase 계정을 활용해 같은 메타데이터/태그 테이블과 인덱스를 Postgres에 이식하고, 이미지는 Storage에 최적화 파일 한 벌만 저장한다. private/link 공개 이미지에는 해당 권한과 일치하는 버킷/RLS·서명 URL을 적용해야 한다. 서버 기능은 아직 로컬 접근 제한을 유지한다.

2026-10-08 확인한 공식 무료 요금 안내는 DB 500MB/프로젝트이며 Storage와 전송량도 각각 한도가 있다. 무제한 무료를 보장할 수는 없고 초기 게시글 수보다 이미지 평균 크기와 조회 전송량이 먼저 한계가 될 수 있다. 따라서 DB에 Base64·피드 이미지 합성본·검색 결과 스냅샷을 반복 저장하지 않고, 원본 및 작은 썸네일만 보관하는 구조를 유지한다. AI 착장 생성 요금은 DB/검색 비용과 별개다.

출처: [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Storage pricing](https://supabase.com/docs/guides/storage/pricing), [Storage bandwidth](https://supabase.com/docs/guides/storage/serving/bandwidth).

## 참고·확인

검색 UX는 [Instagram 공식 검색/해시태그 도움말](https://www.facebook.com/help/instagram/search/?query=hashtags)의 계정/해시태그 검색과 태그별 게시글 진입, [무신사 스냅](https://www.musinsa.com/snap/main/recommend)의 패션 콘텐츠 탐색을 참고했다. 로그인한 원 서비스의 모든 인터랙션이나 내부 랭킹을 직접 검증한 것은 아니다.

로컬 UI에서 ‘데’ 자동완성 → #데일리룩 4개, 게시 화면에서 본문 #데일리룩 인식 및 ‘셔츠’→#셔츠코디 추천 선택, 실제 저장 후 #데일리룩 5개와 새 피드의 그리드 표시를 확인했다. 서버 태그 조회에도 저장한 피드의 두 태그가 반환됐다. 프런트 빌드 성공. 새 테스트 스위트는 추가/실행하지 않았다. 화면 증거: `/tmp/lookbox-feed-hashtag-search.png`.

## 검색 영역 간격

`frontend/src/style/feed-search.css:1`: 제목 마진에 의존하지 않고 검색 결과 영역 자체에 간격을 적용한다. 최근 검색 → 둘러볼 해시태그 32px, 계정 → 해시태그 24px. 제목 아래 12px, 최근 검색 헤더 아래 8px로 PC/모바일 모두 적용한다.

## 반응형 간격 점검 — 2026-10-08

`feed-search.css`: 모바일 검색 전체 좌우16px/상단12px/하단32px, 태그 제목을 페이지 범위 선택자로 고정해 공통 h2 스타일 덮임 방지(19px/제목 아래6px). 검색 결과 그리드6px, 태그 헤더20px, 최근 검색 터치 영역44px. `social.css`: 공통 시트 닫기44px/음수 바깥 마진 제거. `experience.css`: 공개 프로필 긴 이름/통계 줄 대응 및 검색 상세 본문/액션 좌우 정렬. PC 만들기·게시 화면의 실제 요소 너비와 스크롤 넘침 확인.

확인: 브라우저 PC/375px 모바일에서 만들기·게시·검색→태그→상세→프로필 이동 점검. 모바일 검색 여백16px, 태그 제목19px/마진0 확인; 상세/프로필/게시 입력·공개 범위에서 scrollWidth가 clientWidth를 넘지 않음. 임시 뷰포트 복원. 실제 게시/착장 생성은 실행하지 않음.

2026-10-11: 본문 태그 자동 인식/클릭 동작 제거, 태그 삭제 시 본문은 보존. 글 또는 명시적 해시태그 중 하나가 있어야 게시·수정 완료 버튼 활성화; save와 서버 payload에도 빈 입력 차단. 근거: `frontend/src/style/story-editor.jsx`, `feed-search.jsx`, `model.js`, `backend/app/style_studio.py` normalize_tags/payload.
