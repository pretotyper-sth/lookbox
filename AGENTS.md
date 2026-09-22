# AGENTS.md

For any coding agent working in this repo (Codex, Copilot, Gemini CLI, Cursor, Claude Code).

## Protected checkpoint: 바로 보기 (user approved)

The user confirmed the live result on 2026-09-22: “이게 내가 원한대로”.
Approved implementation: `3d5eef0` (includes `5ee257e`), tag
`checkpoint/tryon-approved-2026-09-22`. Details: [tryon-mask-boundaries](docs/wiki/tryon-mask-boundaries.md).

Do not change this behavior while working on unrelated features, cleanup, styling,
refactoring, or dependency updates. Only change it when the user explicitly requests
changes to 바로 보기; a broad improvement/fix request is not authorization to redesign it.

Preserve camera video `cover` + centered positioning, person/mask PNG `contain`,
the 2:3 frame, `tryon21` assets/cache, garment-only transparency, body-generation
proportions, and mask validation. Do not restore geometric/column/browser cutout
fallbacks or post-validation product-cutout polishing. Do not bump the cache or
force regeneration as an incidental change. Do not weaken its tests to pass another task.

Protected scope: try-on code in `backend/app/main.py`, `backend/tests/test_tryon_body.py`,
`frontend/src/proto/10-tryon.jsx`, `TRYON_BODY_REV` in `03-data.jsx`, try-on entry/readiness
logic in `04-screens-ab.jsx` and `09-app.jsx`, and `.lb-tryon-frame` in `proto.css`.
Other features in these shared files remain editable; keep diffs outside this scope.
If a requested change necessarily affects the checkpoint, explain that dependency
and obtain explicit authorization before changing the protected behavior.

## Read order

1. `docs/wiki/index.md` — one line per page. Load only the pages it marks relevant.
2. Raw source (`app/`, `frontend/`, `backend/`) only when the wiki is silent, stale, or you're editing code.
3. Read the named symbol or range, not the whole file. Grep before Read.

Do not bulk-read directories to get oriented. Do not re-read a file you just wrote.

## Write back

Nontrivial findings become wiki pages, not just chat answers. Update `docs/wiki/index.md`
and append to `docs/wiki/log.md` in the same pass. Cite `path:line` or a commit.

## Project skills

- `.agents/skills/run-lookbox` / `.cursor/skills` — 로컬 8123+5173 기동
- `.agents/skills/lookbox-mypage` / `.cursor/skills/lookbox-mypage` — 사용량·크레딧 50·버전·키/몸무게

## Behavior rules

`CLAUDE.md` in this directory applies to all agents, not just Claude: state assumptions,
simplest solution that works, surgical diffs, verify against a stated success criterion.
