---
name: lookbox-mypage
description: Lookbox 마이페이지 사용량·요금제·버전·키/몸무게 규칙을 적용한다. Use when editing 마이페이지, 계정 및 지원, 크레딧, 요금제, 설정 하단 버전, 키, 몸무게, AI 착장 프롬프트, or billing grant.
---

# Lookbox 마이페이지

작업 전 `docs/wiki/index.md`에서 [[mypage-usage-in-account]] [[profile-height-weight]]만 연다.

## 사용량

| 화면 | 위치 | 구현 |
|---|---|---|
| PC (`wide`) | 계정 및 지원 카드 상단 | `UsageBlock variant="inline"` |
| 모바일 | 스타일 카드와 설정 사이 제 카드 | `UsageBlock variant="card"` |

요금제는 `요금제 보기` → `PlanSheet`. 동작별 차감 목록은 그리지 않는다. 여백은 `--s*` / `--gap-header` 토큰.

## 크레딧

무료 월 **50**. 근거: `backend/app/main.py` `PLANS["free"]["credits"]`, `docs/pricing.md`.
계정(user_id)마다 grant가 있다. 새 계정은 첫 `billing_state`에서 50이 들어간다. 예전에 60을 받은 계정은 같은 함수가 grant 행을 50으로 맞춘다. 화면은 `lb_billing_v1` 캐시를 먼저 그린 뒤 서버 값으로 덮는다. `jsharrykim@gmail.com`만 잔액 0이면 50을 다시 넣는다.

## 버전

`VersionLine`: `LOOKBOX v1.0.0 · {__BUILD_DATE__}`. `vite.config.js`가 날짜만 심는다. 해시 금지.

## 키 · 몸무게

- 보여주기: `InfoRow` 키 / 몸무게 각 한 줄 (`personalBody`)
- 작성: `AccountEditSheet`·온보딩 `NumberSlider` 두 개
- 이미지: 착장은 성별만 맞춘 룩북 모델(`_model_look_prompt`). 프로필 얼굴·체형 넣지 않음. 설정에 바로 보기 행·룩북 비용 문구 없음. 바로 보기 POST는 추가 시트에서만, face만.
- 추천 `_profile_block`에도 키·몸무게를 넣지 않는다.

## 파일

`frontend/src/proto/08-mypage.jsx`, `02-shared.jsx` `NumberSlider`, `07-onboarding.jsx`, `09-app.jsx` tryon body, `backend/app/main.py` billing + image prompts, `frontend/vite.config.js`.
