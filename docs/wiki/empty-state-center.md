# 빈 화면·팝업은 콘텐츠 칸의 세로 가운데

예전 EmptyState는 옷장 TopBar 높이(safe-area + 73px) + `min(18vh, 168px)`를
오늘·룩북에도 더했다. 상단바가 없는 탭에서는 문구가 아래로 내려갔다(2026-08-30).

지금은 하단 탭·상단바를 뺀 flex 칸에서 `justify-content: center`다.
`02-shared.jsx` `EmptyState`.

근거: `frontend/src/proto/02-shared.jsx` `EmptyState`.

2026-10-03: 사용자 요청으로 빈 옷장 상단에 WardrobeMilestoneBanner(상의 2/하의 2, 최대 4단계)를 복원했다. EmptyState는 이 미션 영역 아래 남은 공간의 가운데를 사용한다. 중앙 추가 CTA와 하단 메뉴는 유지하고 빈 옷장의 중복 TopBar/+는 표시하지 않는다. 일부 옷이 있는 잠금 상태도 같은 배너를 사용한다. 모바일 문구는 ‘상의 2 · 하의 2 필요’로 축약/nowrap. `04-screens-ab.jsx` WardrobeScreen. 모바일 한 줄(14.5px)/0/4 UI와 빌드 확인. 스크린샷 `docs/research/realcloset-positioning-2026-10/wardrobe-mission-v21-phone.png`.

스타일 편집기 옷장 재료 선택은 실제 원본 아이템 배열이 비어 있을 때 안내를 탭 바로 아래 표시한다. 검색 결과가 없을 때만 검색 빈 상태 문구를 쓴다. `frontend/src/style/story-editor.jsx`.

2026-10-03: 알림 빈 화면도 같은 `EmptyState`를 사용한다. 피드 헤더 아래 남은 flex 공간을 사용하고 알림 전용 테두리 패널/아이콘/폰트 규칙을 제거했다. `social.jsx` NotificationPage, `social.css` rc-notifications.is-empty.

2026-10-03: 편집기 재료의 빈 안내가 rc-lab-help에 섞여 PC의 panel 직속 help 숨김과 모바일 help 숨김 규칙에 모두 가려지고 있었다. 빈 상태는 별도 MaterialEmpty/rc-material-empty로 분리해 검색 아래 표시한다. 내 아이템/저장한 아이템/이미지 없음과 옷·이미지·스티커·GIF·추천 문구 검색 결과 없음을 동일한 제목+설명 구조로 통일했다. GIPHY API 결과가 빈 배열일 때도 표시한다. PC·390px 모바일 내 아이템 0개 및 저장한 옷 검색 결과 0개 안내 확인. story-editor.jsx/css.

2026-10-03: 사용자 요청으로 편집기 이미지/내 아이템 빈 안내의 “이미지를 추가하면 여기에 모여요.”와 “옷장에 아이템을 추가하면 여기서 사용할 수 있어요.” 설명을 제거했다. 없음 제목은 유지한다. story-editor.jsx MaterialEmpty.

2026-10-06: 오늘 코디 잠금 상태의 WardrobeMilestoneBanner도 옷장 빈 화면과 같은 PC/모바일 상단 여백(28px/18px), 폭 100%·최대 1080·가운데 정렬 및 기본 하단 여백을 사용한다. onAdd를 제거해 미션 배너에 중복 추가 버튼을 표시하지 않는다. 중앙 옷장 채우기 CTA 유지. 근거: frontend/src/proto/06-today.jsx !ready 분기. 로컬 빈 상태에서 0/4 배너와 상단 추가 버튼 미표시 확인.
