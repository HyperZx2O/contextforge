# ContextForge Pydantic Schemas

All models in `backend/api/schemas.py`.

---

## Pipeline

### `PipelineRunRequest`
**Used by:** `POST /pipeline/run`

| Field | Type | Constraints |
|---|---|---|
| `query` | str | 3–200 chars |
| `year_from` | int \| null | optional |
| `year_to` | int \| null | optional |
| `max_papers` | int | 10–200, default 100 |
| `sources` | list[str] | default ["arxiv","github","news"] |

### `PipelineRunResponse`

| Field | Type |
|---|---|
| `job_id` | str |
| `status` | str |
| `message` | str |

### `PipelineStatusResponse`

| Field | Type |
|---|---|
| `job_id` | str |
| `status` | str |
| `progress` | int |
| `papers_found` | int |
| `papers_processed` | int |
| `relationships_created` | int |
| `started_at` | str (ISO 8601) |
| `completed_at` | str \| null |
| `error_message` | str \| null |

---

## Graph

### `NodeProperties`
Base model for node properties. `extra="allow"` — accepts any additional fields.

### `GraphNode`

| Field | Type |
|---|---|
| `id` | str |
| `label` | str |
| `properties` | NodeProperties |

### `GraphNodesResponse`

| Field | Type |
|---|---|
| `nodes` | list[GraphNode] |
| `total` | int |
| `limit` | int |
| `offset` | int |

### `EdgeProperties`
Base model for edge properties. `extra="allow"`.

### `GraphEdge`

| Field | Type |
|---|---|
| `source` | str |
| `target` | str |
| `type` | str |
| `properties` | EdgeProperties |

### `GraphEdgesResponse`

| Field | Type |
|---|---|
| `edges` | list[GraphEdge] |
| `total` | int |
| `limit` | int |
| `offset` | int |

### `GapItem`

| Field | Type |
|---|---|
| `id` | str |
| `gap_type` | str |
| `description` | str |
| `affected_nodes` | list[str] |
| `severity` | float |
| `detected_at` | str |

### `GraphGapsResponse`

| Field | Type |
|---|---|
| `gaps` | list[GapItem] |

### `NeighborItem`

| Field | Type |
|---|---|
| `node` | GraphNode |
| `relationship` | dict |

### `NodeDetailResponse`

| Field | Type |
|---|---|
| `node` | GraphNode |
| `neighbors` | list[NeighborItem] |

---

## Query

### `NLQueryRequest`
**Used by:** `POST /query/natural-language`

| Field | Type | Constraints |
|---|---|---|
| `question` | str | 5–500 chars |
| `context_node_id` | str \| null | optional |

### `NLQueryResponse`

| Field | Type |
|---|---|
| `question` | str |
| `answer` | str |
| `supporting_edges` | list[GraphEdge] |
| `cypher_used` | str |
| `response_time_ms` | int |

---

## Demo

### `DemoTopic`

| Field | Type |
|---|---|
| `id` | str |
| `label` | str |
| `paper_count` | int |
| `edge_count` | int |

### `DemoTopicsResponse`

| Field | Type |
|---|---|
| `topics` | list[DemoTopic] |

### `DemoLoadResponse`

| Field | Type |
|---|---|
| `topic_id` | str |
| `loaded` | bool |
| `papers_loaded` | int |
| `edges_loaded` | int |
| `gaps_loaded` | int |

---

## LLM Output

### `LLMRelationshipResponse`
Shared contract for LLM-extracted relationships.

| Field | Type | Constraints |
|---|---|---|
| `relationship_type` | Literal | One of: CONTRADICTS, EXTENDS, REPLICATES, REPLICATES_FAILED, CHALLENGES, CITES, IMPLEMENTS, DISAGREES_ON_SCOPE, NONE |
| `confidence` | float | 0.0–1.0 |
| `evidence_quote` | str | Required for non-NONE types |
| `dimension` | str | — |
| `direction` | Literal | "a_to_b" or "b_to_a" |

---

## Constants

- `RELATIONSHIP_TYPES`: CONTRADICTS, EXTENDS, REPLICATES, REPLICATES_FAILED, CHALLENGES, CITES, IMPLEMENTS, DISAGREES_ON_SCOPE
- `NODE_TYPES`: Paper, Author, Method, Dataset, Claim, Gap
