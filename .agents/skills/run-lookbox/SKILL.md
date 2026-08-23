---
name: run-lookbox
description: Use when launching, restarting, or smoke-testing the Lookbox local stack — the FastAPI backend (port 8123) and the Vite React frontend (port 5173). Covers the venv setup, the correct uvicorn module path, AI_TEST_MODE zero-cost mode, and browser verification. Triggers on "로컬 서버 띄워", "run the app", "start the backend", "restart dev server", "띄워봐".
allowed-tools:
  - Bash
  - Read
---

# Run Lookbox locally

Two processes. The React app (`frontend/`) talks to the FastAPI app
(`backend/app/main.py`). The root `server.py` is a **separate legacy Flask
prototype** for `Prototype.html` — not part of this stack, do not start it
unless the task is explicitly about the old prototype.

## 0. Preflight

```bash
lsof -nP -iTCP:8123 -iTCP:5173 -sTCP:LISTEN
```

Already listening → don't start a second copy. If a previous uvicorn is stuck
holding 8123 (its `--reload` supervisor keeps the socket even after the app
fails to import), kill it before retrying or you get `[Errno 48] Address
already in use`.

## 1. Backend — FastAPI on 8123

The venv is gitignored and is often missing on a fresh clone. Create it once:

```bash
cd backend
uv venv .venv
uv pip install -r requirements.txt --python .venv/bin/python
```

Then launch:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8123 --reload
```

**Gotchas:**
- The module path is `app.main:app`, **not** `main:app`. There is no
  `backend/main.py`; the app lives in `backend/app/main.py`.
- `uv run uvicorn ...` fails with `Failed to spawn: uvicorn` — there is no
  uv project manifest in `backend/`. Use the venv's python with `-m uvicorn`.
- Env comes from `backend/.env` (gitignored). Required keys are listed in
  `backend/.env.example`.

Healthy startup prints the AI_TEST_MODE banner (when enabled) and then
`Application startup complete.`

## 2. Frontend — Vite on 5173

```bash
cd frontend && npm run dev
```

`frontend/.env` must point `VITE_API_BASE_URL` at `http://127.0.0.1:8123`
for local work. The committed default targets the deployed backend.

## 3. Verify — don't stop at "it started"

```bash
curl -s http://127.0.0.1:8123/health
# {"ok":true,"openai":true,"supabase":true,"rev":"dev","credits_gated":false}

B=$(.Codex/skills/browse/bin/find-browse)
"$B" goto http://localhost:5173/
"$B" text body      # must contain the LOOKBOX landing copy, not empty
"$B" console        # check for module/render errors
```

A 200 from Vite proves nothing — the SPA shell serves even when React fails
to mount. Always read the rendered body text.

Known-benign console noise: the outdated-JSX-transform warning (the project
pins the classic runtime in `vite.config.js` on purpose, to stop
`@vitejs/plugin-react` injecting `require()` into browser code) and a
`fetchpriority` casing warning.

## 4. AI cost modes (`backend/.env` → `AI_TEST_MODE`)

Toggle by editing `AI_TEST_MODE`, then restart uvicorn (or let `--reload`
pick up `.env` only if the process is restarted — dotenv loads at import).

| Mode | `AI_TEST_MODE` | When to use |
|------|----------------|-------------|
| **Zero-cost UX** | `1` | Layout, sheets, nav, copy — local PIL fallbacks, no `images.edit` |
| **Extraction quality** | `0` | Real product-cut quality — classify + OpenAI extract (billed) |

**Current session default for extraction QA:** `AI_TEST_MODE=0`.

`/health` reporting `"openai": true` only means a key is configured. For
zero-cost mode the authoritative signal is the startup banner
`[AI_TEST_MODE] ON` in the backend log. With `0`, that banner must be absent
and uploads should hit `[extract] start … quality=…`.
