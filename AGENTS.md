# AGENTS.md — ContextForge (frontend repo)

Compact guidance for OpenCode sessions. Every line is something an agent would likely miss.

## Workflow conventions

- **Always load the `ponytail` skill at the start of every iteration.** Prefer the simplest working solution: std-lib/native over new dependencies, smallest change that satisfies the task. Avoid over-engineering.
- **Commit and push to the `frontend` branch** (the team dev branch). The remote default is `main`; do not target `main`/`master` for feature work.
- **Frontend UI must follow `context/design.md`** — the Linear-style dark design system (canvas `#010102`, primary `#5e6ad2`, 4-step surface ladder, hairline borders, aggressively negative display tracking). Use it as the reference for colors, typography, and spacing. Do not introduce off-system palettes or gradients.

## Stack & layout (verified from existing files)

- **Backend** (`backend/`): FastAPI + Pydantic. Dev entry `uvicorn main:app --reload` on port **8000**.
- **Frontend** (`frontend/`): React + Vite. Dev `npm run dev` on port **3000**. Shared Axios client at `frontend/src/api/client.js` (base URL from `VITE_API_BASE_URL`, default `http://localhost:8000`). Add endpoint wrappers in feature hooks, not in `client.js`.
- **Infra** (`docker-compose.yml`): Neo4j (`bolt://neo4j:7687`, auth `neo4j`/`contextforge_neo4j`, with APOC), PostgreSQL (`5432`, `contextforge`/`contextforge_pg`), Redis (`6379`).

## Shared / contract files — coordinate before editing

- `backend/config.py` — marked **SHARED**. Single source of settings via `pydantic_settings` reading `.env`. Add new config here only and notify the team before merging.
- `backend/api/schemas.py` — marked **SHARED**, described as *THE API CONTRACT*. Frontend calls depend on its exact shape. Any field/type/default change breaks backend and frontend together; get sign-off from all three members first.
- `context/spec.md` §6 is the authoritative API contract; §5.2 defines the Neo4j relationship vocabulary (`CONTRADICTS`, `EXTENDS`, `REPLICATES`, `CHALLENGES`, `CITES`, `IMPLEMENTS`, …). Match these exactly.

## Environment

- Copy `.env.example` → `.env` and fill real keys (GROQ/OpenRouter, GitHub, NewsAPI, Semantic Scholar optional). Backend reads `.env` automatically; frontend only needs `VITE_API_BASE_URL` if not defaulting to localhost:8000.
- Backend CORS allows only `http://localhost:3000`. Keep the frontend there or update `BACKEND_CORS_ORIGINS`.

## Gotchas

- **`context/` is gitignored.** `design.md`, `plan.md`, `spec.md` are local-only references — never committed, never assume they exist in the remote or on another machine.
- **No build tooling yet.** No `package.json`, `requirements.txt`, `Dockerfile`, `tsconfig`, or `README` present. Do not assume `npm install`, `pip install`, or `docker compose up` works until scaffolding exists. Note: `docker-compose.yml` references Dockerfiles that are not in the repo yet.
- Keep frontend/backend contract changes in lockstep via `schemas.py`; mismatches surface only at runtime.
