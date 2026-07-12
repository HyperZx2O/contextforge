# ContextForge API Reference

Base URL: `http://localhost:8000`

All responses include `X-Request-ID` header. Error responses use:
```json
{ "detail": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

---

## Health

### `GET /health`

```bash
curl http://localhost:8000/health
```

**200 OK**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Pipeline

### `POST /pipeline/run`

Start an ingestion + extraction pipeline job. Rate limited: 5 requests/minute/IP.

```bash
curl -X POST http://localhost:8000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"query": "retrieval augmented generation 2024", "max_papers": 50}'
```

**Request body** (`PipelineRunRequest`):
| Field | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `query` | string | yes | — | 3–200 chars |
| `year_from` | int | no | null | |
| `year_to` | int | no | null | |
| `max_papers` | int | no | 100 | 10–200 |
| `sources` | list[str] | no | ["arxiv","github","news"] | |

**202 Accepted**
```json
{ "job_id": "uuid", "status": "pending", "message": "Pipeline job accepted" }
```

**422 Validation Error** — query too short/long, max_papers out of range
**429 Rate Limit** — more than 5 requests/min from same IP

---

### `GET /pipeline/status/{job_id}`

```bash
curl http://localhost:8000/pipeline/status/<job_id>
```

**200 OK** — `PipelineStatusResponse`
**404 Not Found** — job doesn't exist

---

## Graph

### `GET /graph/nodes`

```bash
curl "http://localhost:8000/graph/nodes?limit=10"
curl "http://localhost:8000/graph/nodes?node_type=Paper"
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `node_type` | string | null | Must be: Paper, Author, Method, Dataset, Claim, Gap |
| `limit` | int | 500 | ≤ 2000 |
| `offset` | int | 0 | ≥ 0 |

**200 OK** — `GraphNodesResponse`
**400 Bad Request** — invalid `node_type`
**503 Service Unavailable** — Neo4j unreachable

---

### `GET /graph/edges`

```bash
curl "http://localhost:8000/graph/edges?min_confidence=0.8"
```

| Param | Type | Default | Constraints |
|---|---|---|---|
| `relationship_type` | string | null | Must be valid relationship type |
| `min_confidence` | float | 0.0 | 0.0–1.0 |
| `limit` | int | 1000 | ≤ 5000 |
| `offset` | int | 0 | ≥ 0 |

**200 OK** — `GraphEdgesResponse`
**400 Bad Request** — invalid `relationship_type`
**503 Service Unavailable** — Neo4j unreachable

---

### `GET /graph/gaps`

```bash
curl http://localhost:8000/graph/gaps
```

**200 OK** — `GraphGapsResponse` (empty `gaps` array when none found)
**503 Service Unavailable** — Neo4j unreachable

---

### `GET /graph/node/{node_id}`

```bash
curl http://localhost:8000/graph/node/2401.00001
```

**200 OK** — `NodeDetailResponse` with node + neighbors
**404 Not Found** — node not in graph
**503 Service Unavailable** — Neo4j unreachable

---

## Query

### `POST /query/natural-language`

```bash
curl -X POST http://localhost:8000/query/natural-language \
  -H "Content-Type: application/json" \
  -d '{"question": "Which papers contradict the RAG approach of Smith et al.?"}'
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `question` | string | yes | 5–500 chars |
| `context_node_id` | string | no | arxiv_id of a node for context |

**200 OK** — `NLQueryResponse`
**400 Bad Request** — LLM returned write Cypher, or context node not found
**422 Validation Error** — question too short/long
**503 Service Unavailable** — LLM or Neo4j unreachable

---

## Demo

### `GET /demo/topics`

```bash
curl http://localhost:8000/demo/topics
```

**200 OK** — `DemoTopicsResponse`

---

### `POST /demo/load/{topic_id}`

```bash
curl -X POST http://localhost:8000/demo/load/rag_2024
```

Clears the current graph and loads the specified demo dataset.

**200 OK** — `DemoLoadResponse`
**404 Not Found** — topic_id not found in `data/demo/`
**503 Service Unavailable** — Neo4j unreachable
