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
