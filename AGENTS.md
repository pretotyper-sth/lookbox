# AGENTS.md

For any coding agent working in this repo (Codex, Copilot, Gemini CLI, Cursor, Claude Code).

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
