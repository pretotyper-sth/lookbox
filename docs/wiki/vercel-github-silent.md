# vercel-github-silent

푸시마다 `pretotyper.kr@gmail.com`으로 오던 메일은 GitHub 워크플로가 아니라 **vercel[bot] 댓글**이다. 배포 자체는 그대로 두고 댓글만 끈다.

근거: `frontend/vercel.json` (`github.silent: true`, 2026-08-23 `e60a8db`). Vercel 루트는 `frontend`(`docs/deploy-free-tier.md`). 레포에 `.github/workflows`는 없다.

이 커밋이 프로덕션에 반영된 뒤부터는 커밋·PR에 vercel[bot] 댓글이 안 달린다. 메일이 `notifications@github.com`이 아니라 `vercel.com`이면 대시보드 Git 설정도 꺼야 한다.
