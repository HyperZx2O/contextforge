# AGENTS.md — ContextForge Backend API (Member 2 scope)

## Status

Pre-implementation. Only `spec.md` (full system spec) and `plan.md` (your phased work plan) exist. No code yet.

## What you own

Everything under `backend/`: routes, schemas, config, dependencies. You consume Member 1's agent functions via imports. You do **not** own agent logic, NLP, DB schema, or frontend.

## Critical files

- **`backend/api/schemas.py`** — the single contract. Frozen after Phase 0. All three members depend on it. Changing a field name/type requires group sign-off.
- **`backend/config.py`** — Pydantic `BaseSettings`, exports `settings` singleton. All modules import from here, never `os.environ` directly.

## Key conventions

- Python 3.11+, FastAPI, Pydantic v2
- **Testing**: `pytest` + `httpx.AsyncClient` (not a real HTTP server). Run with `pytest backend/tests/unit/` or `pytest backend/tests/integration/test_api_routes.py`.
- **Pipeline runs async**: `BackgroundTasks` (not Celery). `POST /pipeline/run` returns `202` immediately; client polls `GET /pipeline/status/{job_id}`.
- **Rate limiting**: `slowapi` on `POST /pipeline/run` — 5 requests/min/IP.
- **Cypher safety**: Before executing any LLM-generated Cypher in `/query/natural-language`, scan for write keywords (`CREATE`, `MERGE`, `DELETE`, `SET`, `REMOVE`, `DROP`). Return `400` if found. Also use a read-only Neo4j user.
- **Error shape**: `{ "detail": { "code": "ERROR_CODE", "message": "..." } }` for all 4xx/5xx.
- **Timestamps**: ISO 8601 UTC strings everywhere.
- **Agent function signatures** you import from Member 1:
  ```python
  from agents.ingestion import run_ingestion
  from agents.extractor import run_extraction
  from agents.synthesis import run_synthesis
  from agents.gap_finder import run_gap_finder
  ```
- **Mock during dev**: `backend/tests/mocks/mock_agents.py` — hardcoded returns matching schemas. Swap for real imports on integration day.
- **Docker Compose**: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`. Frontend on `:3000`, Neo4j on `:7687`/`:7474`, Postgres on `:5432`, Redis on `:6379`.

## Phase order

Phases 0 → 1 → 2 → 3 → 4 → 5 → 9 → 10 → 11 → 14. See `plan.md` for full details and acceptance criteria. **Do not skip ahead** — each phase depends on the prior one.

## Gotchas

- `NodeProperties` and `EdgeProperties` use `model_config = ConfigDict(extra="allow")` for flexible graph properties.
- `GET /graph/gaps` returns `200 { "gaps": [] }` (not 404) when empty.
- `GET /graph/nodes?node_type=InvalidType` returns `400`, not 422.
- Demo graphs live in `data/demo/*.json` — `POST /demo/load/{topic_id}` replaces the entire current graph.
- Never log secrets: `GROQ_API_KEY`, `NEO4J_PASSWORD`, or anything in `DATABASE_URL`.
- Spec is the source of truth. If docs conflict with spec, trust `spec.md` (Section 6 = API contract, Section 9 = Cypher library).
