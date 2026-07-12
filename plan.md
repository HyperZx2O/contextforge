# Implementation Plan for ContextForge — Member 2: Backend API (FastAPI Routes + Schemas)

> **Role:** Backend API Engineer — you own everything that exposes the backend to the outside: all FastAPI routes (`/pipeline`, `/graph`, `/query`, `/demo`), all Pydantic schemas, `dependencies.py`, and `config.py`. You consume what Member 1 builds via function imports, but you can mock those agent calls to develop independently.
>
> **Merge order:** You merge **second**, after Member 1. Your routes call Member 1's agent functions; they must exist before your final integration.
>
> **Critical shared file:** `backend/api/schemas.py` is the most important file in the codebase. All three members depend on it. Finalize every schema in Phase 0 before anyone writes logic. Any change mid-project requires sign-off from all three members.

---

## Project Overview

| Field | Value |
|---|---|
| Project Name | ContextForge — Backend API Layer |
| Project Type | Backend Service (REST API) |
| Primary Language(s) | Python 3.11+ |
| Framework(s) | FastAPI, Pydantic v2 |
| Target Platform | Server (Docker container) |
| Deployment Target | Docker Compose, port 8000 |
| Team / Owner | Member 2 |
| Status | Planning |

---

## Global Rules

1. **Never implement a future phase early.** If Phase 3 needs a feature, wait until Phase 3.
2. **Never invent APIs, interfaces, or contracts** that aren't defined in the spec or explicitly agreed upon.
3. **Keep every change scoped to the current phase.** One phase, one concern.
4. **Never introduce a new dependency without justification.**
5. **Prefer the simplest correct implementation.** Optimize only in the designated performance phase.
6. **Preserve backward compatibility** unless a phase explicitly breaks it.
7. **Update documentation whenever public-facing behavior changes.**
8. **All acceptance criteria must pass before moving to the next phase.**
9. **Never leave a phase half-done.**
10. **Distinguish implemented features from planned ones** at all times.
11. **`schemas.py` is frozen after Phase 0.** Do not change a field name, type, or optionality without a group sign-off meeting. Every change cascades to Member 1 (function return types) and Member 3 (frontend response parsing).
12. **Mock Member 1's agents during development.** Create `backend/tests/mocks/mock_agents.py` that returns hardcoded data matching the schemas. Swap for real imports on integration day.

---

## Architecture Decision Records (ADR)

### ADR-1: BackgroundTasks for Pipeline Execution
- **Date:** 2026-07-11
- **Status:** Accepted
- **Context:** Pipeline runs (ingestion → extraction → synthesis → gap finding) take 2–5 minutes. The `POST /pipeline/run` endpoint must return immediately with a `job_id`.
- **Decision:** Use FastAPI's `BackgroundTasks` to run the pipeline asynchronously. The endpoint creates a `PipelineJobs` row with `status='pending'`, adds the pipeline coroutine as a background task, and returns `202 Accepted` with the `job_id`.
- **Alternatives considered:** Celery (over-engineered for MVP); threading (not async-safe with SQLAlchemy async).
- **Consequences:** Pipeline runs in the same process as the API. Fine for MVP. Move to Celery in Phase 2 post-hackathon.

### ADR-2: Schemas.py as the Single Contract File
- **Date:** 2026-07-11
- **Status:** Accepted
- **Context:** Member 1 returns Python dicts from agent functions; Member 3 parses JSON from fetch calls. Both must match exactly.
- **Decision:** All request/response shapes live in `backend/api/schemas.py`. Member 1 imports these to type-check agent return values. Member 3 uses the API contract table in the spec as their source of truth.
- **Consequences:** `schemas.py` is the most change-sensitive file in the project. Freeze it before coding begins.

### ADR-3: NL-to-Cypher Safety via Allowlist
- **Date:** 2026-07-11
- **Status:** Accepted
- **Context:** Spec Section 15 notes that NL-to-Cypher has no injection protection at MVP stage.
- **Decision:** Before executing any LLM-generated Cypher, scan the query string for write keywords: `CREATE`, `MERGE`, `DELETE`, `SET`, `REMOVE`, `DROP`. If any are found, return `400` with `"reason": "unsafe_query"`. Use a read-only Neo4j user at the connection level as the second layer of defense.
- **Consequences:** Prevents accidental graph mutation from the query interface. Does not prevent all injection; documented as a known limitation.

### ADR-4: Demo Endpoint Uses Local JSON Files
- **Date:** 2026-07-11
- **Status:** Accepted
- **Context:** Demo graphs must load in < 500ms (spec Section 12). Live pipeline is too slow for a demo.
- **Decision:** Pre-built graphs are stored as JSON in `data/demo/`. The `POST /demo/load/{topic_id}` endpoint reads the JSON and bulk-writes to Neo4j using `UNWIND` Cypher. Member 1 provides the Neo4j write functions; you call them.
- **Consequences:** Demo graph quality depends on pre-build step (done on Day 12 per roadmap). If JSON files don't exist, endpoint returns `404`.

---

## Technology Stack

| Layer | Choice | Justification |
|---|---|---|
| Language | Python 3.11+ | Team standard |
| API Framework | FastAPI | Spec requirement; async, Pydantic-native |
| Validation | Pydantic v2 | Built into FastAPI; used for all schemas |
| HTTP Server | uvicorn | Standard FastAPI server |
| Rate Limiting (inbound) | `slowapi` | Spec Section 15 requirement for `/pipeline/run` |
| Background Tasks | FastAPI `BackgroundTasks` | MVP async pipeline execution |
| Testing | pytest + httpx `AsyncClient` | Standard FastAPI testing pattern |

---

## Dependency Management

- **Package manager:** pip
- **Lock file committed:** Yes
- **Rule for adding dependencies:** Must be justified inline. `slowapi` is the only non-core addition in your scope.
- **Security audit cadence:** `pip-audit` before demo day.
- **Known constraints:** No GPL. Must work inside the Docker container defined in `docker-compose.yml`.

---

## Configuration & Environment

- You own `backend/config.py`. It loads and validates all env vars at startup using Pydantic `BaseSettings`.
- The app must fail fast with a clear error message if any required variable is missing.
- Every module imports `from config import settings`. No one accesses `os.environ` directly.

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | Yes | — | Loaded by config; passed to Member 1's LLM module |
| `NEO4J_URI` | Yes | `bolt://neo4j:7687` | Loaded by config; passed to Member 1's Neo4j client |
| `NEO4J_USER` | Yes | `neo4j` | — |
| `NEO4J_PASSWORD` | Yes | — | — |
| `DATABASE_URL` | Yes | — | PostgreSQL URL |
| `REDIS_URL` | Yes | `redis://redis:6379/0` | Redis URL |
| `BACKEND_CORS_ORIGINS` | Yes | `http://localhost:3000` | Comma-separated allowed origins |
| `LOG_LEVEL` | No | `INFO` | Logging verbosity |
| `CONFIDENCE_THRESHOLD` | Yes | `0.7` | Passed through to agent calls |
| `MAX_PAPERS_PER_QUERY` | Yes | `200` | Used in `/pipeline/run` request validation |

---

## Phases Skipped

Phase 6 (Real-Time) — polling pattern used instead; Member 3 polls `/pipeline/status/{job_id}` every 2 seconds.
Phase 7 (Persistence) — Member 1 owns DB. You consume DB via `dependencies.py` session injection.

---

## Phase Checklist

- [x] Phase 0: Requirements & Architecture
- [x] Phase 1: Repository Scaffold & Project Skeleton
- [x] Phase 2: Schemas — the Contract Layer
- [x] Phase 3: Pipeline Routes
- [x] Phase 4: Graph Routes
- [x] Phase 5: Query and Demo Routes
- [x] Phase 9: Validation, Error Handling & Observability
- [x] Phase 10: Security (CORS, rate limiting, Cypher allowlist)
- [x] Phase 11: Testing
- [x] Phase 14: Documentation

---

## Phase 0 – Requirements & Architecture

### Goals
Finalize every schema and the API contract before anyone writes logic. This is the handshake between all three members.

### Tasks

1. Read spec Section 6 (API Contract) end-to-end. Every request body, response body, query parameter, and HTTP status code is defined there. Your job is to implement it exactly.
2. Read spec Section 2 (Repository Structure). Confirm your files:
   ```
   backend/main.py
   backend/config.py
   backend/dependencies.py
   backend/api/schemas.py
   backend/api/routes/pipeline.py
   backend/api/routes/graph.py
   backend/api/routes/query.py
   backend/api/routes/demo.py
   ```
3. Draft every Pydantic model in `schemas.py` (see Phase 2). Share with all members and get sign-off before Phase 2 ends.
4. Confirm the function signatures you will import from Member 1 (they must provide these):
   ```python
   from agents.ingestion import run_ingestion
   from agents.extractor import run_extraction
   from agents.synthesis import run_synthesis
   from agents.gap_finder import run_gap_finder
   ```
5. Write `backend/tests/mocks/mock_agents.py` with stub versions of all 4 functions that return hardcoded data matching the schemas. You will use these until Member 1's real implementations are ready.
6. Define the error response shape used for all `4xx` and `5xx` responses:
   ```json
   { "detail": { "code": "ERROR_CODE", "message": "human readable" } }
   ```

### Acceptance Criteria

- [ ] Every schema in `schemas.py` is drafted and reviewed by all members.
- [ ] No schema field will need to change after this phase (if it does, hold a group sign-off meeting first).
- [ ] Mock agents exist and return data that matches schemas.
- [ ] You can name every HTTP status code each endpoint returns and why.

---

## Phase 1 – Repository Scaffold & Project Skeleton

### Goals
Create a booting FastAPI app with health check. Member 3 can point their mock API client at `localhost:8000/health` immediately.

### Tasks

1. In `backend/main.py`:
   - Create FastAPI app instance
   - Add CORS middleware: `origins = settings.BACKEND_CORS_ORIGINS.split(",")`
   - Register all 4 route routers (with prefixes `/pipeline`, `/graph`, `/query`, `/demo`)
   - Add `GET /health` returning `200 { "status": "ok", "version": "1.0.0" }`
   - On startup: call Member 1's `initialize_neo4j_schema()` and validate DB connections
2. In `backend/config.py`:
   - Use Pydantic `BaseSettings` to load all env vars listed in the Configuration section
   - Raise `ValueError` on startup if any required var is missing
   - Export a single `settings` singleton
3. In `backend/dependencies.py`:
   - `async def get_db()` — yields SQLAlchemy async session
   - `async def get_neo4j()` — yields Neo4j driver session
   - Both must close sessions cleanly on exit (use `try/finally`)
4. Create stub route files — each returns `501 Not Implemented` for now:
   - `backend/api/routes/pipeline.py`
   - `backend/api/routes/graph.py`
   - `backend/api/routes/query.py`
   - `backend/api/routes/demo.py`
5. Configure uvicorn with `--reload` for development (already in `docker-compose.yml`).

### Acceptance Criteria

- [ ] `docker compose up backend` starts without errors.
- [ ] `GET http://localhost:8000/health` returns `200 { "status": "ok" }`.
- [ ] `GET http://localhost:8000/pipeline/run` returns `405 Method Not Allowed` (not 404 — the route exists, wrong method).
- [ ] App fails with a clear error message if `DATABASE_URL` is missing from `.env`.
- [ ] CORS headers are present on responses to requests from `http://localhost:3000`.

---

## Phase 2 – Schemas — The Contract Layer

### Goals
Implement all Pydantic models in `schemas.py`. These are the most important artifacts you produce. Every downstream phase depends on them.

### Tasks

Implement all of the following in `backend/api/schemas.py`, exactly matching spec Section 6:

1. **Pipeline schemas:**
   ```python
   class PipelineRunRequest(BaseModel):
       query: str          # 3-200 chars
       year_from: int | None = None
       year_to: int | None = None
       max_papers: int = 100  # 10-200
       sources: list[str] = ["arxiv", "github", "news"]

   class PipelineRunResponse(BaseModel):
       job_id: str
       status: str
       message: str

   class PipelineStatusResponse(BaseModel):
       job_id: str
       status: str
       progress: int
       papers_found: int
       papers_processed: int
       relationships_created: int
       started_at: str
       completed_at: str | None
       error_message: str | None
   ```

2. **Graph schemas:**
   ```python
   class NodeProperties(BaseModel):
       model_config = ConfigDict(extra="allow")  # flexible properties

   class GraphNode(BaseModel):
       id: str
       label: str
       properties: NodeProperties

   class GraphNodesResponse(BaseModel):
       nodes: list[GraphNode]
       total: int
       limit: int
       offset: int

   class EdgeProperties(BaseModel):
       model_config = ConfigDict(extra="allow")

   class GraphEdge(BaseModel):
       source: str
       target: str
       type: str
       properties: EdgeProperties

   class GraphEdgesResponse(BaseModel):
       edges: list[GraphEdge]
       total: int
       limit: int
       offset: int

   class GapItem(BaseModel):
       id: str
       gap_type: str
       description: str
       affected_nodes: list[str]
       severity: float
       detected_at: str

   class GraphGapsResponse(BaseModel):
       gaps: list[GapItem]

   class NeighborItem(BaseModel):
       node: GraphNode
       relationship: dict

   class NodeDetailResponse(BaseModel):
       node: GraphNode
       neighbors: list[NeighborItem]
   ```

3. **Query schemas:**
   ```python
   class NLQueryRequest(BaseModel):
       question: str       # 5-500 chars
       context_node_id: str | None = None

   class NLQueryResponse(BaseModel):
       question: str
       answer: str
       supporting_edges: list[GraphEdge]
       cypher_used: str
       response_time_ms: int
   ```

4. **Demo schemas:**
   ```python
   class DemoTopic(BaseModel):
       id: str
       label: str
       paper_count: int
       edge_count: int

   class DemoTopicsResponse(BaseModel):
       topics: list[DemoTopic]

   class DemoLoadResponse(BaseModel):
       topic_id: str
       loaded: bool
       papers_loaded: int
       edges_loaded: int
       gaps_loaded: int
   ```

5. **LLM output schema (used by Member 1 but defined here so everyone reads the same contract):**
   ```python
   class LLMRelationshipResponse(BaseModel):
       relationship_type: Literal["CONTRADICTS","EXTENDS","REPLICATES","REPLICATES_FAILED","CHALLENGES","CITES","IMPLEMENTS","DISAGREES_ON_SCOPE","NONE"]
       confidence: float   # 0.0-1.0
       evidence_quote: str
       dimension: str
       direction: Literal["a_to_b", "b_to_a"]

       @field_validator("confidence")
       def confidence_in_range(cls, v):
           if not 0.0 <= v <= 1.0:
               raise ValueError("confidence must be 0.0-1.0")
           return v

       @field_validator("evidence_quote")
       def quote_not_empty_unless_none(cls, v, info):
           if info.data.get("relationship_type") != "NONE" and not v:
               raise ValueError("evidence_quote required for non-NONE relationships")
           return v
   ```

6. Add `@field_validator` for all constrained fields:
   - `PipelineRunRequest.query`: min length 3, max 200
   - `PipelineRunRequest.max_papers`: 10 ≤ value ≤ 200
   - `NLQueryRequest.question`: min length 5, max 500

### Acceptance Criteria

- [ ] `from api.schemas import PipelineRunRequest` works without error.
- [ ] `PipelineRunRequest(query="a")` raises `ValidationError` (too short).
- [ ] `PipelineRunRequest(query="test", max_papers=500)` raises `ValidationError` (too large).
- [ ] `LLMRelationshipResponse(relationship_type="CONTRADICTS", confidence=1.5, ...)` raises `ValidationError`.
- [ ] `LLMRelationshipResponse(relationship_type="CONTRADICTS", confidence=0.9, evidence_quote="", ...)` raises `ValidationError`.
- [ ] All three members have reviewed and signed off on `schemas.py`.

---

## Phase 3 – Pipeline Routes

### Goals
Implement `POST /pipeline/run` and `GET /pipeline/status/{job_id}`.

### Tasks

1. In `backend/api/routes/pipeline.py`:

   **`POST /pipeline/run`:**
   - Accept `PipelineRunRequest` body
   - Validate: if `year_from` or `year_to` is missing, default to current year - 1 and current year
   - Create a `PipelineJobs` row with `status='pending'` via DB session
   - Add pipeline coroutine to `BackgroundTasks`:
     ```python
     async def run_pipeline_background(job_id: str, req: PipelineRunRequest, db):
         try:
             paper_ids = await run_ingestion(job_id, req.query, ...)
             entity_ids = await run_extraction(job_id, paper_ids)
             rel_count = await run_synthesis(job_id, paper_ids)
             gap_count = await run_gap_finder(job_id)
         except PipelineAgentError as e:
             await update_job_status(db, job_id, "failed", error_message=str(e))
     ```
   - Return `202 Accepted` with `PipelineRunResponse`
   - During development (before Member 1 merges): import from `mock_agents.py` instead

   **`GET /pipeline/status/{job_id}`:**
   - Query `PipelineJobs` table by `job_id`
   - Return `404` if not found
   - Return `200` with `PipelineStatusResponse`
   - All timestamps serialized as ISO 8601 UTC strings

2. Apply `slowapi` rate limiting to `POST /pipeline/run`: max 5 requests/minute per IP.

### Acceptance Criteria

- [ ] `POST /pipeline/run` with valid body returns `202` with a UUID `job_id`.
- [ ] `POST /pipeline/run` with `query: "ab"` (too short) returns `422` with validation error detail.
- [ ] `GET /pipeline/status/{valid_job_id}` returns `200` with correct schema.
- [ ] `GET /pipeline/status/nonexistent-id` returns `404`.
- [ ] Posting 6 times in a minute returns `429` on the 6th request.
- [ ] `pipeline_jobs.status` changes from `pending` to `ingesting` within 5 seconds of a real pipeline start (integration test with Member 1).

---

## Phase 4 – Graph Routes

### Goals
Implement `GET /graph/nodes`, `GET /graph/edges`, `GET /graph/gaps`, and `GET /graph/node/{node_id}`.

### Tasks

1. In `backend/api/routes/graph.py`, implement all 4 graph endpoints by calling Member 1's Neo4j client functions (Cypher queries from spec Section 9.3):

   **`GET /graph/nodes`:**
   - Query params: `node_type?: str`, `limit: int = 500` (max 2000), `offset: int = 0`
   - Run `GET all nodes for D3 visualization` Cypher from spec 9.3, with optional `WHERE n:{node_type}` filter
   - Return `GraphNodesResponse`
   - Validate `node_type` is one of: `Paper`, `Author`, `Method`, `Dataset`, `Claim`, `Gap`. Return `400` if not.

   **`GET /graph/edges`:**
   - Query params: `relationship_type?: str`, `min_confidence: float = 0.0`, `limit: int = 1000` (max 5000), `offset: int = 0`
   - Run `GET all edges for D3 visualization` Cypher, with optional `WHERE type(r) = $type AND r.confidence >= $min_confidence` filter
   - Return `GraphEdgesResponse`
   - Validate `relationship_type` against the 8-type allowlist. Return `400` if not.

   **`GET /graph/gaps`:**
   - No query params
   - Return all `Gap` nodes from Neo4j as `GraphGapsResponse`
   - If no gaps exist, return `200` with `gaps: []` (not `404`)

   **`GET /graph/node/{node_id}`:**
   - Run `GET 1-hop neighborhood` Cypher from spec Section 9.3
   - Return `NodeDetailResponse`
   - Return `404` if `node_id` not found in Neo4j

2. Wrap all Neo4j calls in try/except. On `Neo4jError`: return `503` with `"code": "GRAPH_UNAVAILABLE"`.

### Acceptance Criteria

- [ ] `GET /graph/nodes` with no params returns nodes in `GraphNodesResponse` shape.
- [ ] `GET /graph/nodes?node_type=InvalidType` returns `400`.
- [ ] `GET /graph/edges?min_confidence=0.8` returns only edges with confidence ≥ 0.8.
- [ ] `GET /graph/gaps` returns `200 { "gaps": [] }` when no gaps exist.
- [ ] `GET /graph/node/2401.12345` returns `NodeDetailResponse` with `neighbors` list.
- [ ] `GET /graph/node/nonexistent` returns `404`.
- [ ] Mocked Neo4j raising an error: endpoint returns `503` (not `500`).

---

## Phase 5 – Query and Demo Routes

### Goals
Implement `POST /query/natural-language`, `GET /demo/topics`, and `POST /demo/load/{topic_id}`.

### Tasks

1. In `backend/api/routes/query.py`:

   **`POST /query/natural-language`:**
   - Accept `NLQueryRequest`
   - If `context_node_id` is provided: verify it exists in Neo4j; return `404` if not
   - Build LLM prompt using spec Section 8.3 templates
   - Call `call_llm()` from Member 1's `llm/router.py`
   - Parse LLM response: extract `cypher` and `explanation`
   - **Safety check:** scan generated Cypher for write keywords (`CREATE`, `MERGE`, `DELETE`, `SET`, `REMOVE`, `DROP`). If found, return `400 { "code": "UNSAFE_QUERY", "message": "..." }`.
   - Execute safe Cypher against Neo4j (read-only driver session)
   - Build answer: call LLM again with query results + question to generate a human-readable answer
   - Return `NLQueryResponse` with `response_time_ms` computed from wall time
   - On LLM failure: return `503`

2. In `backend/api/routes/demo.py`:

   **`GET /demo/topics`:**
   - Read directory listing of `data/demo/` (the 3 JSON files)
   - For each JSON file, read `paper_count` and `edge_count` from the file header
   - Return `DemoTopicsResponse`
   - If `data/demo/` directory is empty: return `200 { "topics": [] }`

   **`POST /demo/load/{topic_id}`:**
   - Validate `topic_id` maps to a file in `data/demo/`. Return `404` if not.
   - Read the JSON file from `data/demo/{topic_id}.json`
   - Call Neo4j write functions (from Member 1's `neo4j_client.py`) to bulk-load nodes and edges using `UNWIND`
   - The JSON format for demo graphs must be agreed with Member 1 (they build the pre-built graphs)
   - Return `DemoLoadResponse` with counts of loaded items
   - This endpoint replaces the current graph — delete existing nodes before loading

### Acceptance Criteria

- [ ] `POST /query/natural-language` with a valid question returns `NLQueryResponse` with non-empty `answer`.
- [ ] A LLM-generated Cypher containing `DELETE` triggers `400 { "code": "UNSAFE_QUERY" }`.
- [ ] `GET /demo/topics` returns 3 topics when all 3 demo JSON files exist.
- [ ] `POST /demo/load/rag_2024` returns `200` with `loaded: true` and correct counts.
- [ ] `POST /demo/load/nonexistent_topic` returns `404`.
- [ ] `response_time_ms` in NL query response is a positive integer.

---

## Phase 9 – Validation, Error Handling & Observability

### Goals
Every endpoint returns consistent error shapes. No unhandled exception ever leaks a stack trace to the client.

### Tasks

1. Add a global exception handler in `main.py`:
   ```python
   @app.exception_handler(Exception)
   async def global_exception_handler(request, exc):
       logger.error("Unhandled exception", exc_info=exc, extra={"path": request.url.path})
       return JSONResponse(status_code=500, content={"detail": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})
   ```
2. Add specific exception handlers for:
   - `RequestValidationError` → `422` with Pydantic error details
   - `PipelineAgentError` (from Member 1) → `503` with agent-specific message
   - `LLMUnavailableError` → `503 { "code": "LLM_UNAVAILABLE" }`
   - `DatabaseError` → `503 { "code": "DATABASE_UNAVAILABLE" }`
3. Add structured logging via Python's `logging` module:
   - Every request: log `INFO` with method, path, status code, duration
   - Every `4xx`: log `WARNING` with request body (sanitized — no keys)
   - Every `5xx`: log `ERROR` with full stack trace
4. Never log any value from: `GROQ_API_KEY`, `NEO4J_PASSWORD`, `DATABASE_URL` (passwords embedded).
5. Add middleware that times every request and attaches a `X-Request-ID` header to every response.

### Acceptance Criteria

- [x] `POST /pipeline/run` with invalid JSON body returns `422` (not `500`).
- [x] Crashing Member 1's agent (simulated by mock raising `Exception`) returns `503` from the API, not `500` with stack trace.
- [x] Every response has an `X-Request-ID` header.
- [x] `GET /health` log entry appears in uvicorn output within 1 second of the request.
- [x] No log line contains the string `password` or `api_key` as a value.

---

## Phase 10 – Security

### Goals
CORS, rate limiting, Cypher allowlist, and no secrets in code.

### Tasks

1. **CORS:** Allow only origins in `settings.BACKEND_CORS_ORIGINS`. In production (when not running locally), never allow `*`.
2. **Rate limiting:** `slowapi` on `POST /pipeline/run` — 5 requests/minute per IP. Log rate-limit hits at `WARNING`.
3. **Cypher injection guard:** Already implemented in Phase 5 for the NL query route. Additionally, ensure the Neo4j connection used by the query route is a read-only Neo4j user (configured via Docker Compose `NEO4J_AUTH`; flag this for Member 1 to set up).
4. **No hardcoded secrets:** Audit all files you own. Zero string literals that look like keys.
5. **Input sanitization:** Pydantic validators are your first line. Never pass unsanitized user input directly to a Cypher query string — always use parameterized queries.

### Acceptance Criteria

- [x] `OPTIONS` preflight from `http://evil.com` returns `403` (not in CORS origins).
- [x] 6th request to `/pipeline/run` in a minute returns `429`.
- [x] `grep -r "sk-" backend/api/` returns no results.
- [x] All Cypher in graph routes uses `$param` substitution, not f-strings.

---

## Phase 11 – Testing

### Goals
Prove every endpoint returns the correct schema and HTTP status for all documented cases.

### Tasks

1. **Unit tests** (`backend/tests/unit/`):
   - `test_schemas.py`: Test every `@field_validator`. Cover: valid input, each invalid case.
   - `test_cypher_safety.py`: Assert that Cypher strings containing `DELETE`, `CREATE`, `MERGE`, `SET`, `REMOVE`, `DROP` trigger the safety check.
   - `test_config.py`: Assert that missing `DATABASE_URL` causes startup to raise `ValueError`.

2. **Integration tests** (`backend/tests/integration/`):
   - `test_api_routes.py`: Use FastAPI's `AsyncClient` to test all endpoints against a live stack. For each endpoint, test: success case, all documented error cases.
     - `POST /pipeline/run`: valid body → 202; short query → 422; rate limit → 429
     - `GET /pipeline/status/{id}`: valid → 200; not found → 404
     - `GET /graph/nodes`: no params → 200; invalid `node_type` → 400
     - `GET /graph/edges`: `min_confidence=0.8` → 200 with only high-confidence edges
     - `GET /graph/node/{id}`: valid → 200; not found → 404
     - `POST /query/natural-language`: valid → 200; write Cypher in LLM response → 400
     - `GET /demo/topics`: → 200 with expected count
     - `POST /demo/load/rag_2024`: → 200; invalid topic → 404

3. All integration tests use mock agents until Member 1 merges. After merge, run with real agents.
4. Add a `Makefile` target: `make test-api` runs all tests in this file.

### Acceptance Criteria

- [x] `pytest backend/tests/unit/` passes with 0 failures.
- [x] `pytest backend/tests/integration/test_api_routes.py` passes against a live Docker Compose stack.
- [x] All documented error codes (`422`, `404`, `400`, `503`, `429`) are tested.
- [x] Tests use `AsyncClient` from `httpx`, not a real HTTP server.

---

## Phase 14 – Documentation

### Tasks

1. Document every endpoint in `docs/api.md`: method, URL, request/response schema, all possible HTTP status codes with explanation.
2. Add inline comments to `dependencies.py` explaining session lifecycle.
3. Write `docs/schemas.md`: one section per Pydantic model explaining every field, its constraints, and which endpoint uses it.
4. Update `README.md` with: how to run the API server, base URL, how to test endpoints with `curl` examples.

### Acceptance Criteria

- [x] Every endpoint has a `curl` example in `docs/api.md`.
- [x] Every Pydantic model is documented in `docs/schemas.md`.
- [x] `README.md` has curl examples for at least `/health`, `/pipeline/run`, and `/graph/nodes`.

---

## Future Work

| Item | Priority | Notes |
|---|---|---|
| Migrate `BackgroundTasks` pipeline to Celery + Redis | High | Phase 2 post-hackathon |
| JWT authentication + protected routes | High | Phase 2 |
| OpenAPI/Swagger doc enhancements | Low | FastAPI auto-generates; enhance with descriptions |
| Response caching for `/graph/nodes` and `/graph/edges` | Medium | Add Redis cache with 30s TTL |
| GraphQL endpoint as alternative to REST | Low | Phase 3 |

---

## Out of Scope (This Version)

- All agent, NLP, and DB logic — that is Member 1's responsibility
- All React frontend code — that is Member 3's responsibility
- Celery workers
- JWT authentication
- WebSocket real-time updates (polling is sufficient for MVP)

---

*Last updated: 2026-07-11 by Member 2*
