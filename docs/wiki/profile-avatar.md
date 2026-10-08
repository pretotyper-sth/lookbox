# 프로필 사진은 계정 스토리지 URL이다

마이페이지 프사는 이 기기 `lb_prefs` data URL이 아니다. JPEG를
`{user_id}/profile/avatar-{hash}.webp`로 올리고 `user_metadata.prefs.avatar`에
그 URL만 넣는다. data URL은 metadata 한도를 넘겨서, 예전에는 올린 기기에만
보이고 모바일에는 빈 원형이었다(2026-08-30).

로그인 기기에 예전 data URL이 남아 있으면 한 번 올려 계정에 붙인다.
바로 보기(`tryon/body`)는 data URL과 http URL 둘 다 받는다.
업로드는 긴 변 최대 1024px WebP다(2026-09-04). 예전 512px 계정 사진은 그대로 둔다.

근거: `backend/app/main.py` `live_profile_avatar`, `_face_image_bytes`;
`frontend/src/proto/09-app.jsx` `persistPrefs`·`uploadAvatarToAccount`.

2026-10-06: 피드 공개 사진은 별도 로컬 studio profiles payload의 feedAvatar를 사용한다. 서비스 prefs.avatar를 동기화하지 않으며 과거 자동 복사된 avatar도 공개 사진으로 읽지 않는다. 공개 프로필에서 선택/삭제한 이미지에만 feedAvatar를 기록한다. 이름 동기화 PUT은 avatar를 생략해 공개 사진을 보존한다. CreatorProfile의 본인 사진 버튼은 마이의 ProfileAvatar를 재사용하되 requireFace=false로 얼굴 없는 이미지도 허용하고, 기본 requireFace=true는 유지한다. 본인 미등록 사진/피드/관계/알림 기본 이미지는 user 아이콘이다. rc-social-update로 게시물/프로필 사진 표시를 갱신한다. 저장은 DEV studio 한정이며 서비스 계정 사진 저장/바로 보기는 변경하지 않는다. 근거: backend/app/style_studio.py person/ProfileBody/update_profile, frontend/src/style/social.jsx identity/useSocialProfile, creator-profile.jsx changeAvatar, proto/08-mypage.jsx ProfileAvatar. 공개 프로필의 빈 사진·사진 선택 버튼을 로컬 화면에서 확인. 실제 사진 변경은 사용자에게 남겼다.
