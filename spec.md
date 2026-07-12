# ContextForge — Technical Specification v2.0

**Status:** Pre-implementation  
**LLM Provider:** Groq (primary) / OpenRouter (fallback)  
**Stack:** FastAPI · Neo4j · PostgreSQL · Redis · React · D3  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Environment Variables](#3-environment-variables)
4. [Docker Compose Configuration](#4-docker-compose-configuration)
5. [Database Schema](#5-database-schema)
6. [API Contract](#6-api-contract)
7. [Agent Pipeline — Detailed Specification](#7-agent-pipeline--detailed-specification)
8. [LLM Prompt Templates](#8-llm-prompt-templates)
9. [Cypher Query Library](#9-cypher-query-library)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Error Handling Strategy](#11-error-handling-strategy)
12. [Performance Targets](#12-performance-targets)
13. [Testing Strategy](#13-testing-strategy)
14. [Development Roadmap](#14-development-roadmap)
15. [Known Limitations](#15-known-limitations)

---

## 1. System Overview

ContextForge ingests research papers, GitHub repositories, and news articles for a given topic query and constructs a typed, evidence-grounded knowledge graph in Neo4j. The system exposes this graph through a D3 force visualization and a natural language query interface.

### Pipeline Summary

```
User Query
    │
    ▼
[Ingestion Agent]         ← arXiv API, Semantic Scholar API, GitHub API, NewsAPI
    │  raw content → PostgreSQL cache
    ▼
[Concept Extractor Agent] ← SciSpaCy NER, sentence-transformers embeddings
    │  structured entities → PostgreSQL
    ▼
[Synthesis Agent]         ← Groq API (OpenRouter fallback)
    │  typed relationships with evidence → Neo4j
    ▼
[Gap Finder Agent]        ← Cypher structural queries + Groq summarization
    │  gap nodes → Neo4j
    ▼
Neo4j Knowledge Graph
    │
    ├── D3 Force Visualization (React frontend)
    └── NL Query Interface (React frontend)
```

### Relationship Vocabulary

| Type | Meaning |
|------|---------|
| `CONTRADICTS` | Conflicting empirical findings |
| `EXTENDS` | Builds on and improves prior work |
| `REPLICATES` | Same experiment, same result |
| `REPLICATES_FAILED` | Same experiment, different result |
| `CHALLENGES` | Questions assumptions without direct contradiction |
| `CITES` | Direct citation reference |
| `IMPLEMENTS` | Code implementation of a paper's method |
| `DISAGREES_ON_SCOPE` | Findings hold in context X but not context Y |

---

## 2. Repository Structure

```
contextforge/
├── backend/
│   ├── main.py                        # FastAPI app entry point
│   ├── config.py                      # Settings loaded from env vars
│   ├── dependencies.py                # Shared FastAPI dependencies (DB sessions, etc.)
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── ingestion.py               # Agent 1: fetch raw content
│   │   ├── extractor.py               # Agent 2: NER + entity dedup
│   │   ├── synthesis.py               # Agent 3: LLM relationship classification
│   │   └── gap_finder.py              # Agent 4: graph gap detection
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── pipeline.py            # POST /pipeline/run, GET /pipeline/status/{job_id}
│   │   │   ├── graph.py               # GET /graph/nodes, GET /graph/edges, GET /graph/gaps
│   │   │   ├── query.py               # POST /query/natural-language
│   │   │   └── demo.py                # GET /demo/topics, POST /demo/load/{topic}
│   │   └── schemas.py                 # All Pydantic request/response models
│   │
│   ├── db/
│   │   ├── neo4j_client.py            # Neo4j driver wrapper
│   │   ├── postgres_client.py         # SQLAlchemy setup
│   │   └── models.py                  # SQLAlchemy ORM models
│   │
│   ├── llm/
│   │   ├── groq_client.py             # Groq API wrapper
│   │   ├── openrouter_client.py       # OpenRouter fallback wrapper
│   │   └── router.py                  # Provider selection + fallback logic
│   │
│   ├── nlp/
│   │   ├── ner.py                     # SciSpaCy NER wrapper
│   │   ├── embeddings.py              # sentence-transformers wrapper
│   │   └── deduplication.py           # Entity dedup using cosine similarity
│   │
│   └── utils/
│       ├── rate_limiter.py            # Token bucket for outbound API calls
│       ├── cache.py                   # LLM output cache keyed by (paper_a_id, paper_b_id)
│       └── backoff.py                 # Exponential backoff decorator
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── store/
│   │   │   └── graphStore.js          # Zustand store
│   │   ├── components/
│   │   │   ├── GraphCanvas.jsx        # D3 force-graph wrapper
│   │   │   ├── NodeTooltip.jsx        # Hover tooltip with evidence quote
│   │   │   ├── EdgeInspector.jsx      # Click edge → show evidence panel
│   │   │   ├── QueryInterface.jsx     # NL query input + response display
│   │   │   ├── FilterPanel.jsx        # Relationship type toggles
│   │   │   ├── GapPanel.jsx           # Gap nodes list + explanations
│   │   │   └── PipelineStatus.jsx     # Pipeline progress indicator
│   │   ├── hooks/
│   │   │   ├── useGraph.js            # Graph data fetching
│   │   │   ├── usePipeline.js         # Pipeline polling
│   │   │   └── useQuery.js            # NL query submission
│   │   └── api/
│   │       └── client.js              # Axios instance pointed at FastAPI
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── data/
│   └── demo/
│       ├── rag_2024.json              # Pre-built demo graph: RAG
│       ├── llms_2024.json             # Pre-built demo graph: LLMs
│       └── diffusion_2024.json        # Pre-built demo graph: Diffusion Models
│
├── docker-compose.yml
├── .env.example
└── requirements.txt
```

---

## 3. Environment Variables

Copy `.env.example` to `.env` before running anything. All variables below are required unless marked optional.

```env
# LLM
GROQ_API_KEY=your_groq_key_here
OPENROUTER_API_KEY=your_openrouter_key_here          # fallback
GROQ_MODEL=llama-3.1-70b-versatile
OPENROUTER_MODEL=mistralai/mixtral-8x7b-instruct
LLM_TIMEOUT_SECONDS=30
LLM_MAX_RETRIES=3

# Neo4j
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=contextforge_neo4j

# PostgreSQL
DATABASE_URL=postgresql://contextforge:contextforge_pg@postgres:5432/contextforge

# Redis
REDIS_URL=redis://redis:6379/0

# External APIs
ARXIV_RATE_LIMIT_PER_SECOND=3
SEMANTIC_SCHOLAR_API_KEY=                            # optional; raises rate limit
GITHUB_TOKEN=your_github_token_here
NEWS_API_KEY=your_newsapi_key_here

# Pipeline
CONFIDENCE_THRESHOLD=0.7
MAX_PAPERS_PER_QUERY=200
ENTITY_DEDUP_SIMILARITY_THRESHOLD=0.85
GAP_DENSITY_THRESHOLD=0.3
GAP_TEMPORAL_YEARS=5

# App
BACKEND_CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO
```

---

## 4. Docker Compose Configuration

```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      - neo4j
      - postgres
      - redis
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
    command: npm run dev

  neo4j:
    image: neo4j:5.15-community
    ports:
      - "7474:7474"   # Neo4j browser
      - "7687:7687"   # Bolt
    environment:
      NEO4J_AUTH: neo4j/contextforge_neo4j
      NEO4J_PLUGINS: '["apoc"]'
    volumes:
      - neo4j_data:/data

  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: contextforge
      POSTGRES_PASSWORD: contextforge_pg
      POSTGRES_DB: contextforge
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  neo4j_data:
  postgres_data:
  redis_data:
```

---

## 5. Database Schema

### 5.1 PostgreSQL (Raw Cache + Job Tracking)

```sql
-- Raw paper cache: avoid re-fetching from external APIs
CREATE TABLE papers_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arxiv_id        TEXT UNIQUE,
    doi             TEXT,
    title           TEXT NOT NULL,
    abstract        TEXT,
    authors         JSONB,          -- list of {name, institution}
    publish_date    DATE,
    citation_count  INT DEFAULT 0,
    source          TEXT NOT NULL,  -- 'arxiv' | 'semantic_scholar' | 'github' | 'news'
    url             TEXT,
    raw_response    JSONB,          -- full API response stored for reprocessing
    fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Entity cache: extracted entities per paper
CREATE TABLE entities_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id        UUID REFERENCES papers_cache(id),
    entity_type     TEXT NOT NULL,  -- 'paper' | 'author' | 'method' | 'dataset' | 'claim'
    name            TEXT NOT NULL,
    properties      JSONB,
    embedding       VECTOR(768),    -- sentence-transformers output; requires pgvector
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- LLM synthesis cache: avoid re-synthesizing same paper pair
CREATE TABLE synthesis_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_a_id      UUID REFERENCES papers_cache(id),
    paper_b_id      UUID REFERENCES papers_cache(id),
    cache_key       TEXT UNIQUE NOT NULL, -- SHA256(arxiv_id_a + arxiv_id_b)
    llm_response    JSONB,
    confidence      FLOAT,
    relationship_type TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (paper_a_id, paper_b_id)
);

-- Pipeline job tracking
CREATE TABLE pipeline_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
                    -- 'pending' | 'ingesting' | 'extracting' | 'synthesizing' | 'gap_finding' | 'done' | 'failed'
    progress        INT DEFAULT 0,    -- 0-100
    papers_found    INT DEFAULT 0,
    papers_processed INT DEFAULT 0,
    relationships_created INT DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_papers_cache_arxiv_id ON papers_cache(arxiv_id);
CREATE INDEX idx_synthesis_cache_key ON synthesis_cache(cache_key);
CREATE INDEX idx_pipeline_jobs_status ON pipeline_jobs(status);
```

### 5.2 Neo4j Schema (Knowledge Graph)

```cypher
// ── Constraints ──────────────────────────────────────────────────────────────

CREATE CONSTRAINT paper_arxiv_id_unique IF NOT EXISTS
  FOR (p:Paper) REQUIRE p.arxiv_id IS UNIQUE;

CREATE CONSTRAINT author_name_institution_unique IF NOT EXISTS
  FOR (a:Author) REQUIRE (a.name, a.institution) IS UNIQUE;

CREATE CONSTRAINT method_name_unique IF NOT EXISTS
  FOR (m:Method) REQUIRE m.name IS UNIQUE;

CREATE CONSTRAINT dataset_name_unique IF NOT EXISTS
  FOR (d:Dataset) REQUIRE d.name IS UNIQUE;

// ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX paper_title_index IF NOT EXISTS FOR (p:Paper) ON (p.title);
CREATE INDEX paper_publish_date_index IF NOT EXISTS FOR (p:Paper) ON (p.publish_date);
CREATE INDEX gap_node_index IF NOT EXISTS FOR (g:Gap) ON (g.gap_type);

// ── Node Definitions (property reference) ────────────────────────────────────

// Paper node
// {
//   arxiv_id:       string (unique)
//   doi:            string (nullable)
//   title:          string
//   authors:        string[]
//   publish_date:   date
//   abstract:       string
//   url:            string
//   citation_count: int
//   source:         string  -- 'arxiv' | 'github' | 'news'
//   embedding:      float[] -- 768-dim sentence-transformer vector
// }

// Author node
// {
//   name:           string
//   institution:    string
//   papers_count:   int
// }

// Method node
// {
//   name:           string
//   description:    string
//   category:       string  -- 'Architecture' | 'Algorithm' | 'Technique'
// }

// Dataset node
// {
//   name:           string
//   domain:         string
//   size:           int     -- number of samples, nullable
//   papers_using:   int
// }

// Claim node
// {
//   text:           string
//   paper_id:       string  -- arxiv_id of source paper
//   metric:         string  -- e.g. 'BLEU', 'F1'
//   value:          float   -- nullable
//   confidence:     float
// }

// Gap node (created by Gap Finder Agent)
// {
//   gap_type:       string  -- 'low_density' | 'unresolved_contradiction' | 'stale_claim' | 'bridge_opportunity'
//   description:    string  -- LLM-generated natural language explanation
//   affected_nodes: string[] -- list of arxiv_ids involved
//   severity:       float   -- 0.0-1.0
//   detected_at:    datetime
// }

// ── Relationship Definitions ──────────────────────────────────────────────────

// (Paper)-[:CONTRADICTS {
//   on_dimension:   string,
//   confidence:     float,
//   evidence_quote: string,
//   timestamp:      datetime
// }]->(Paper)

// (Paper)-[:EXTENDS {
//   method:         string,
//   improvement:    float,   -- nullable, numeric improvement if stated
//   evidence_quote: string
// }]->(Paper)

// (Paper)-[:REPLICATES {
//   evidence_quote: string,
//   confidence:     float
// }]->(Paper)

// (Paper)-[:REPLICATES_FAILED {
//   divergence:     string,
//   evidence_quote: string,
//   confidence:     float
// }]->(Paper)

// (Paper)-[:CHALLENGES {
//   assumption:     string,
//   evidence_quote: string,
//   confidence:     float
// }]->(Paper)

// (Paper)-[:CITES {
//   is_direct:      boolean
// }]->(Paper)

// (Paper)-[:IMPLEMENTS {
//   code_url:       string,
//   completeness:   string  -- 'partial' | 'full'
// }]->(Paper)

// (Paper)-[:DISAGREES_ON_SCOPE {
//   context_a:      string,
//   context_b:      string,
//   evidence_quote: string,
//   confidence:     float
// }]->(Paper)

// (Paper)-[:USES]->(Dataset)
// (Paper)-[:PROPOSES]->(Method)
// (Author)-[:WROTE]->(Paper)
// (Author)-[:COLLABORATES_WITH]->(Author)
// (Method)-[:OUTPERFORMS { on_dataset: string, metric: string, improvement_percent: float }]->(Method)
// (Gap)-[:INVOLVES]->(Paper)
```

---

## 6. API Contract

Base URL: `http://localhost:8000`  
All requests and responses use `application/json`.  
All timestamps are ISO 8601 UTC strings.

---

### 6.1 Pipeline Routes

#### `POST /pipeline/run`

Starts a new ingestion + synthesis pipeline job for a topic query.

**Request body:**
```json
{
  "query": "Retrieval Augmented Generation",
  "year_from": 2023,
  "year_to": 2024,
  "max_papers": 100,
  "sources": ["arxiv", "github", "news"]
}
```

**Field rules:**
- `query`: required, 3–200 chars
- `year_from`, `year_to`: optional integers; default to current year - 1 and current year
- `max_papers`: optional int 10–200; default 100
- `sources`: optional array; default all three

**Response `202 Accepted`:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Pipeline started. Poll /pipeline/status/{job_id} for updates."
}
```

**Error `422 Unprocessable Entity`:** Pydantic validation failure — query too short, max_papers out of range, etc.

---

#### `GET /pipeline/status/{job_id}`

Returns the current status of a running or completed pipeline job.

**Response `200 OK`:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "synthesizing",
  "progress": 62,
  "papers_found": 94,
  "papers_processed": 58,
  "relationships_created": 143,
  "started_at": "2026-01-07T14:30:00Z",
  "completed_at": null,
  "error_message": null
}
```

**`status` values:** `pending` → `ingesting` → `extracting` → `synthesizing` → `gap_finding` → `done` | `failed`

**Error `404`:** Job ID not found.

---

### 6.2 Graph Routes

#### `GET /graph/nodes`

Returns all nodes in the current graph, optionally filtered by type.

**Query parameters:**
- `node_type`: optional — `Paper` | `Author` | `Method` | `Dataset` | `Claim` | `Gap`
- `limit`: int, default 500, max 2000
- `offset`: int, default 0

**Response `200 OK`:**
```json
{
  "nodes": [
    {
      "id": "2401.12345",
      "label": "Paper",
      "properties": {
        "title": "RAG vs Long Context: A Comparison",
        "arxiv_id": "2401.12345",
        "publish_date": "2024-01-15",
        "citation_count": 42,
        "source": "arxiv"
      }
    }
  ],
  "total": 187,
  "limit": 500,
  "offset": 0
}
```

---

#### `GET /graph/edges`

Returns all relationships in the current graph, optionally filtered by type.

**Query parameters:**
- `relationship_type`: optional — any value from the relationship vocabulary
- `min_confidence`: float 0.0–1.0, default 0.0
- `limit`: int, default 1000, max 5000
- `offset`: int, default 0

**Response `200 OK`:**
```json
{
  "edges": [
    {
      "source": "2401.12345",
      "target": "2312.09876",
      "type": "CONTRADICTS",
      "properties": {
        "on_dimension": "retrieval_accuracy",
        "confidence": 0.91,
        "evidence_quote": "Our results show retrieval accuracy drops 18% under long-context conditions, contradicting prior claims.",
        "timestamp": "2026-01-07T15:22:00Z"
      }
    }
  ],
  "total": 312,
  "limit": 1000,
  "offset": 0
}
```

---

#### `GET /graph/gaps`

Returns all detected gap nodes with their explanations.

**Response `200 OK`:**
```json
{
  "gaps": [
    {
      "id": "gap-001",
      "gap_type": "unresolved_contradiction",
      "description": "Papers 2401.12345 and 2312.09876 contradict each other on retrieval accuracy under long context, but no subsequent paper has reconciled this finding as of 2024.",
      "affected_nodes": ["2401.12345", "2312.09876"],
      "severity": 0.84,
      "detected_at": "2026-01-07T16:00:00Z"
    }
  ]
}
```

---

#### `GET /graph/node/{node_id}`

Returns a single node's full properties plus its immediate neighbors (1-hop).

**Response `200 OK`:**
```json
{
  "node": {
    "id": "2401.12345",
    "label": "Paper",
    "properties": { "...": "..." }
  },
  "neighbors": [
    {
      "node": { "id": "2312.09876", "label": "Paper", "properties": { "...": "..." } },
      "relationship": {
        "type": "CONTRADICTS",
        "direction": "outbound",
        "properties": { "...": "..." }
      }
    }
  ]
}
```

---

### 6.3 Query Routes

#### `POST /query/natural-language`

Translates a free-text question into a Cypher query, executes it, and returns a generated answer with supporting evidence.

**Request body:**
```json
{
  "question": "Which papers contradict the findings in 2401.12345?",
  "context_node_id": "2401.12345"
}
```

**Field rules:**
- `question`: required, 5–500 chars
- `context_node_id`: optional; if provided, anchors the query to a specific node

**Response `200 OK`:**
```json
{
  "question": "Which papers contradict the findings in 2401.12345?",
  "answer": "Two papers directly contradict 2401.12345 on retrieval accuracy: paper 2312.09876 (confidence 0.91) and paper 2403.55210 (confidence 0.78). Both cite different experimental conditions as the source of disagreement.",
  "supporting_edges": [
    {
      "source": "2401.12345",
      "target": "2312.09876",
      "type": "CONTRADICTS",
      "evidence_quote": "Our results show retrieval accuracy drops 18%..."
    }
  ],
  "cypher_used": "MATCH (a:Paper {arxiv_id: '2401.12345'})-[r:CONTRADICTS]-(b:Paper) RETURN b, r",
  "response_time_ms": 1240
}
```

**Error `400`:** Question cannot be translated to a safe Cypher query.  
**Error `404`:** `context_node_id` not found in graph.

---

### 6.4 Demo Routes

#### `GET /demo/topics`

Lists available pre-built demo graphs.

**Response `200 OK`:**
```json
{
  "topics": [
    { "id": "rag_2024", "label": "Retrieval Augmented Generation (2024)", "paper_count": 94, "edge_count": 312 },
    { "id": "llms_2024", "label": "Large Language Models (2024)", "paper_count": 120, "edge_count": 445 },
    { "id": "diffusion_2024", "label": "Diffusion Models (2024)", "paper_count": 87, "edge_count": 278 }
  ]
}
```

---

#### `POST /demo/load/{topic_id}`

Loads a pre-built demo graph from `data/demo/` into Neo4j, replacing the current graph.

**Response `200 OK`:**
```json
{
  "topic_id": "rag_2024",
  "loaded": true,
  "papers_loaded": 94,
  "edges_loaded": 312,
  "gaps_loaded": 7
}
```

**Error `404`:** `topic_id` not found in `data/demo/`.

---

## 7. Agent Pipeline — Detailed Specification

### 7.1 Ingestion Agent (`agents/ingestion.py`)

**Inputs:** `query: str`, `year_from: int`, `year_to: int`, `max_papers: int`, `sources: list[str]`  
**Outputs:** list of paper dicts written to `papers_cache` PostgreSQL table  
**Side effects:** Updates `pipeline_jobs` status to `ingesting` and increments `papers_found`

**Processing steps:**

1. Check `papers_cache` for existing results matching the query. If cache hit rate > 80%, skip re-fetch.
2. Query arXiv API:
   - Endpoint: `http://export.arxiv.org/api/query`
   - Params: `search_query=all:{query}`, `submittedDate:[{year_from}0101+TO+{year_to}1231]`, `max_results=min(max_papers, 100)`
   - Rate limit: 3 requests/second using token bucket in `utils/rate_limiter.py`
   - Parse Atom XML response → extract title, abstract, authors, arxiv_id, published date
3. Enrich with Semantic Scholar:
   - For each paper with a DOI or arXiv ID, call `https://api.semanticscholar.org/graph/v1/paper/{id}`
   - Fields: `citationCount,authors,externalIds`
   - Skip if no API key is set (anonymous rate limit is very low)
4. Query GitHub API:
   - `GET https://api.github.com/search/repositories?q={query}&sort=stars&per_page=20`
   - For each result, fetch README via `GET https://api.github.com/repos/{owner}/{repo}/readme`
   - Decode base64 content
5. Query NewsAPI:
   - `GET https://newsapi.org/v2/everything?q={query}&from={year_from}-01-01&sortBy=relevancy`
   - Extract title, description, url, publishedAt
6. Write all results to `papers_cache`, skipping rows with duplicate `arxiv_id`

**Error handling:**
- arXiv 429: wait `2^retry_count` seconds, retry up to 3 times
- Semantic Scholar 429: skip enrichment for that paper, log warning
- GitHub 403 (rate limit): skip remaining GitHub results, log warning
- NewsAPI 426 (plan limit): skip news source entirely, continue pipeline

---

### 7.2 Concept Extractor Agent (`agents/extractor.py`)

**Inputs:** list of `paper_id` UUIDs from `papers_cache`  
**Outputs:** entity rows written to `entities_cache`  
**Side effects:** Updates `pipeline_jobs` status to `extracting`

**Processing steps:**

1. Load SciSpaCy model once at module level: `spacy.load("en_core_sci_md")`
2. For each paper in `papers_cache`:
   a. Run `doc = nlp(paper.abstract)` — extract entities by label:
      - `ENTITY` → candidate Method or Dataset
      - `ORG` → institution, dataset name
      - `GPE` → conference location (ignored at MVP stage)
   b. Run regex over full text:
      - arXiv IDs: `r'arXiv:\d{4}\.\d{4,5}'`
      - DOIs: `r'10\.\d{4,9}/[-._;()/:A-Z0-9]+'` (case-insensitive)
      - GitHub URLs: `r'github\.com/[\w\-]+/[\w\-]+'`
   c. Generate sentence-transformer embedding for the abstract:
      - Model: `paraphrase-multilingual-mpnet-base-v2`
      - Store as `embedding` on the entity row
3. Deduplication (via `nlp/deduplication.py`):
   - For each new entity, compute cosine similarity against all existing entities of the same type
   - If similarity > `ENTITY_DEDUP_SIMILARITY_THRESHOLD` (default 0.85), merge: update existing entity's `papers_count` and skip insert
   - This handles "BERT" vs "Bidirectional Encoder Representations from Transformers"
4. Write deduplicated entities to `entities_cache`

---

### 7.3 Synthesis Agent (`agents/synthesis.py`)

**Inputs:** list of `paper_id` UUIDs from `entities_cache`  
**Outputs:** typed relationships written to Neo4j  
**Side effects:** Updates `pipeline_jobs` status to `synthesizing`, increments `relationships_created`

**Processing steps:**

1. Generate candidate pairs:
   - For N papers, do not generate all N² pairs — this is too slow
   - Instead: for each paper, find its K nearest neighbors by embedding cosine similarity (K=10)
   - This gives roughly N×10 pairs instead of N² pairs
2. For each candidate pair (paper_a, paper_b):
   a. Check `synthesis_cache` by SHA256 hash of `(arxiv_id_a + arxiv_id_b)`. If hit, skip LLM call and write cached result directly to Neo4j.
   b. If miss: call LLM using the relationship classification prompt (see Section 8.1)
   c. Parse JSON response. Validate against Pydantic schema:
      - `relationship_type` must be one of the 8 defined types
      - `confidence` must be float 0.0–1.0
      - `evidence_quote` must be non-empty string
   d. If `confidence < CONFIDENCE_THRESHOLD` (default 0.7): discard, do not write
   e. Write relationship to Neo4j using the appropriate Cypher template (see Section 9.1)
   f. Write result to `synthesis_cache`
3. LLM provider logic (see `llm/router.py`):
   - Try Groq first. If Groq raises a timeout or 5xx, immediately retry on OpenRouter.
   - If both fail after `LLM_MAX_RETRIES`, log the pair as skipped and continue.

---

### 7.4 Gap Finder Agent (`agents/gap_finder.py`)

**Inputs:** Neo4j graph (reads directly via Cypher)  
**Outputs:** `Gap` nodes written to Neo4j  
**Side effects:** Updates `pipeline_jobs` status to `gap_finding`

**Processing steps:**

1. Run all four Cypher gap detection queries (see Section 9.2)
2. For each result set, call the gap summarization prompt (see Section 8.2) to generate a human-readable explanation
3. Validate severity score (float 0.0–1.0) returned by LLM
4. Write `Gap` node to Neo4j with `INVOLVES` relationships to affected `Paper` nodes
5. After all gaps are stored, update `pipeline_jobs` status to `done`

---

## 8. LLM Prompt Templates

### 8.1 Relationship Classification Prompt

Used in: `agents/synthesis.py`  
Provider: Groq (OpenRouter fallback)  
Model: `llama-3.1-70b-versatile` (Groq) / `mistralai/mixtral-8x7b-instruct` (OpenRouter)

**System prompt:**
```
You are a scientific relationship classifier. Your job is to analyze two research papers and determine the relationship between them.

You must respond with a single valid JSON object and nothing else. No explanation, no markdown, no backticks. Only the JSON.

The JSON must follow this exact schema:
{
  "relationship_type": string,   // one of: CONTRADICTS, EXTENDS, REPLICATES, REPLICATES_FAILED, CHALLENGES, CITES, IMPLEMENTS, DISAGREES_ON_SCOPE
  "confidence": float,           // 0.0 to 1.0; how confident you are that this relationship exists
  "evidence_quote": string,      // a direct quote from Paper A or Paper B that supports this relationship. Must not be empty.
  "dimension": string,           // the specific aspect where the relationship holds (e.g. "retrieval accuracy", "training efficiency")
  "direction": string            // "a_to_b" if Paper A is the source of the relationship, "b_to_a" if Paper B is
}

Relationship type definitions:
- CONTRADICTS: Paper A and Paper B report conflicting empirical findings on the same question
- EXTENDS: One paper builds on the other and reports improvement
- REPLICATES: One paper runs the same experiment as the other and gets the same result
- REPLICATES_FAILED: One paper attempts to replicate the other and gets a different result
- CHALLENGES: One paper questions the assumptions or framing of the other without direct empirical conflict
- CITES: One paper directly cites the other with no deeper relationship
- IMPLEMENTS: One paper (or repo) provides a code implementation of the other paper's method
- DISAGREES_ON_SCOPE: Both papers are correct but the finding of one only holds in a specific context that the other does not cover

If no meaningful relationship exists beyond incidental topic overlap, return:
{
  "relationship_type": "NONE",
  "confidence": 0.0,
  "evidence_quote": "",
  "dimension": "",
  "direction": "a_to_b"
}

Do not invent quotes. The evidence_quote must come from the text you are given.
```

**User prompt template:**
```
Paper A:
Title: {paper_a_title}
Published: {paper_a_date}
Abstract: {paper_a_abstract}

Paper B:
Title: {paper_b_title}
Published: {paper_b_date}
Abstract: {paper_b_abstract}

Identify the relationship between Paper A and Paper B.
```

**Expected response example:**
```json
{
  "relationship_type": "CONTRADICTS",
  "confidence": 0.91,
  "evidence_quote": "We demonstrate that retrieval accuracy drops 18% under long-context conditions, which contradicts the findings reported in prior work on RAG benchmarks.",
  "dimension": "retrieval_accuracy_under_long_context",
  "direction": "b_to_a"
}
```

---

### 8.2 Gap Summarization Prompt

Used in: `agents/gap_finder.py`  
Called once per detected gap subgraph.

**System prompt:**
```
You are a research gap analyst. You will be given structured data about a gap in a research knowledge graph. Your job is to write a clear, specific, one-paragraph explanation of the gap that a researcher would find useful.

Respond with a single valid JSON object and nothing else:
{
  "description": string,   // 2-4 sentences explaining the gap in plain academic language
  "severity": float        // 0.0 to 1.0; how significant this gap is. 1.0 = major unresolved question in the field.
}

Do not use phrases like "it is worth noting" or "this represents an important opportunity". Be direct.
```

**User prompt template for `unresolved_contradiction` gap type:**
```
Gap type: Unresolved contradiction

Two papers contradict each other and no subsequent paper has reconciled their findings:

Paper A: {paper_a_title} ({paper_a_date})
Paper B: {paper_b_title} ({paper_b_date})
Contradiction dimension: {dimension}
Evidence from Paper A: {evidence_a}
Evidence from Paper B: {evidence_b}
Years since contradiction first appeared: {years_since}

Explain this gap and assess its severity.
```

**User prompt template for `low_density` gap type:**
```
Gap type: Under-researched subgraph

The following cluster of papers has significantly fewer connections than the rest of the graph, suggesting this area is under-explored:

Papers in cluster:
{paper_list}

Field topic: {query}
Cluster edge density: {density} (graph average: {avg_density})

Explain what this subgraph covers and why its low density suggests a research gap.
```

**User prompt template for `stale_claim` gap type:**
```
Gap type: Stale unvalidated claim

A claim made in an older paper has not been revisited or validated by newer research:

Source paper: {paper_title} ({paper_date})
Claim: {claim_text}
Years since publication: {years_since}
Newer papers that cite this paper: {citing_count}

Explain why this constitutes a gap and what follow-up research would be needed.
```

**User prompt template for `bridge_opportunity` gap type:**
```
Gap type: Missing bridge between subgraphs

Two clusters of papers that should be connected are not:

Cluster A (topic: {cluster_a_topic}): {cluster_a_papers}
Cluster B (topic: {cluster_b_topic}): {cluster_b_papers}
Shortest path between them: {path_length} hops

Explain what connection is missing and what research would bridge these two areas.
```

---

### 8.3 Natural Language to Cypher Prompt

Used in: `api/routes/query.py`

**System prompt:**
```
You are a Neo4j Cypher query generator. Convert the user's natural language question about a research knowledge graph into a safe, read-only Cypher query.

The graph contains these node labels: Paper, Author, Method, Dataset, Claim, Gap
The graph contains these relationship types: CONTRADICTS, EXTENDS, REPLICATES, REPLICATES_FAILED, CHALLENGES, CITES, IMPLEMENTS, DISAGREES_ON_SCOPE, USES, PROPOSES, WROTE, COLLABORATES_WITH, OUTPERFORMS, INVOLVES

Paper nodes have these properties: arxiv_id, title, publish_date, citation_count, source, abstract

Rules:
1. Only generate read-only queries (MATCH, RETURN, WHERE, WITH, ORDER BY, LIMIT). Never generate CREATE, MERGE, DELETE, SET, or REMOVE.
2. Always include LIMIT to prevent runaway queries. Max LIMIT is 100.
3. If the question cannot be answered from this graph schema, return {"error": "cannot_translate", "reason": "..."}.
4. Respond with a single valid JSON object:
   {
     "cypher": string,
     "explanation": string  // one sentence explaining what the query does
   }
```

**User prompt template:**
```
Question: {user_question}
Context node (if any): {context_node_id}

Generate a Cypher query to answer this question.
```

---

## 9. Cypher Query Library

### 9.1 Relationship Write Queries

These are the exact Cypher statements executed when writing relationships to Neo4j.

**Write Paper node:**
```cypher
MERGE (p:Paper {arxiv_id: $arxiv_id})
SET p.title = $title,
    p.authors = $authors,
    p.publish_date = date($publish_date),
    p.abstract = $abstract,
    p.url = $url,
    p.citation_count = $citation_count,
    p.source = $source
RETURN p
```

**Write CONTRADICTS relationship:**
```cypher
MATCH (a:Paper {arxiv_id: $source_arxiv_id})
MATCH (b:Paper {arxiv_id: $target_arxiv_id})
MERGE (a)-[r:CONTRADICTS]->(b)
SET r.on_dimension = $on_dimension,
    r.confidence = $confidence,
    r.evidence_quote = $evidence_quote,
    r.timestamp = datetime()
RETURN r
```

**Write EXTENDS relationship:**
```cypher
MATCH (a:Paper {arxiv_id: $source_arxiv_id})
MATCH (b:Paper {arxiv_id: $target_arxiv_id})
MERGE (a)-[r:EXTENDS]->(b)
SET r.method = $method,
    r.improvement = $improvement,
    r.evidence_quote = $evidence_quote,
    r.confidence = $confidence
RETURN r
```

**Write Gap node:**
```cypher
CREATE (g:Gap {
  gap_type: $gap_type,
  description: $description,
  affected_nodes: $affected_nodes,
  severity: $severity,
  detected_at: datetime()
})
WITH g
UNWIND $affected_arxiv_ids AS arxiv_id
MATCH (p:Paper {arxiv_id: arxiv_id})
MERGE (g)-[:INVOLVES]->(p)
RETURN g
```

---

### 9.2 Gap Detection Queries

**Query 1: Low-density subgraphs (under-explored clusters)**
```cypher
// Find Paper nodes with very few relationships relative to the graph average
MATCH (p:Paper)
WITH p, size([(p)-[r]-() | r]) AS degree
WITH avg(degree) AS avg_degree, collect({paper: p, degree: degree}) AS papers
UNWIND papers AS item
WITH item.paper AS p, item.degree AS degree, avg_degree
WHERE degree < (avg_degree * 0.3)
RETURN p.arxiv_id AS arxiv_id,
       p.title AS title,
       degree,
       avg_degree
ORDER BY degree ASC
LIMIT 20
```

**Query 2: Unresolved contradictions**
```cypher
// Find CONTRADICTS edges where no paper has cited both endpoints (no reconciling paper)
MATCH (a:Paper)-[r:CONTRADICTS]->(b:Paper)
WHERE NOT EXISTS {
  MATCH (c:Paper)
  WHERE (c)-[:CITES]->(a) AND (c)-[:CITES]->(b)
    AND c.publish_date > a.publish_date
    AND c.publish_date > b.publish_date
}
RETURN a.arxiv_id AS paper_a,
       a.title AS title_a,
       b.arxiv_id AS paper_b,
       b.title AS title_b,
       r.on_dimension AS dimension,
       r.evidence_quote AS evidence,
       r.confidence AS confidence
ORDER BY r.confidence DESC
LIMIT 10
```

**Query 3: Stale claims (old papers with no recent follow-up)**
```cypher
// Find papers older than GAP_TEMPORAL_YEARS with no newer citations
MATCH (p:Paper)
WHERE p.publish_date < date() - duration({years: $gap_temporal_years})
AND NOT EXISTS {
  MATCH (newer:Paper)-[:CITES]->(p)
  WHERE newer.publish_date > date() - duration({years: $gap_temporal_years})
}
RETURN p.arxiv_id AS arxiv_id,
       p.title AS title,
       p.publish_date AS publish_date,
       duration.between(p.publish_date, date()).years AS years_since
ORDER BY years_since DESC
LIMIT 10
```

**Query 4: Bridge opportunities (disconnected subgraphs that should be connected)**
```cypher
// Find pairs of Paper nodes with path length > 4 (likely disconnected clusters)
MATCH (a:Paper), (b:Paper)
WHERE a.arxiv_id < b.arxiv_id  // avoid duplicates
AND NOT (a)-[*1..3]-(b)        // not already closely connected
WITH a, b
MATCH path = shortestPath((a)-[*]-(b))
WHERE length(path) > 4
RETURN a.arxiv_id AS arxiv_id_a,
       a.title AS title_a,
       b.arxiv_id AS arxiv_id_b,
       b.title AS title_b,
       length(path) AS path_length
ORDER BY path_length DESC
LIMIT 10
```

---

### 9.3 Common Read Queries

**Get all nodes for D3 visualization:**
```cypher
MATCH (n)
WHERE n:Paper OR n:Author OR n:Method OR n:Dataset OR n:Gap
RETURN n, labels(n) AS label_list
LIMIT $limit
```

**Get all edges for D3 visualization:**
```cypher
MATCH (a)-[r]->(b)
WHERE type(r) IN ['CONTRADICTS','EXTENDS','REPLICATES','REPLICATES_FAILED',
                  'CHALLENGES','CITES','IMPLEMENTS','DISAGREES_ON_SCOPE']
RETURN a.arxiv_id AS source,
       b.arxiv_id AS target,
       type(r) AS rel_type,
       properties(r) AS rel_props
LIMIT $limit
```

**Get 1-hop neighborhood of a node:**
```cypher
MATCH (center:Paper {arxiv_id: $arxiv_id})-[r]-(neighbor)
RETURN center, r, neighbor
LIMIT 50
```

**Get all CONTRADICTS edges (for filtering):**
```cypher
MATCH (a:Paper)-[r:CONTRADICTS]->(b:Paper)
RETURN a.arxiv_id AS source,
       b.arxiv_id AS target,
       r.on_dimension AS dimension,
       r.confidence AS confidence,
       r.evidence_quote AS evidence_quote
ORDER BY r.confidence DESC
```

---

## 10. Frontend Architecture

### 10.1 Zustand Store (`store/graphStore.js`)

```javascript
// State shape
{
  // Graph data
  nodes: [],            // [{id, label, properties}]
  edges: [],            // [{source, target, type, properties}]
  gaps: [],             // [{id, gap_type, description, severity, affected_nodes}]

  // UI state
  selectedNode: null,   // node id or null
  selectedEdge: null,   // edge object or null
  activeFilters: [],    // relationship types currently shown
  hoveredNode: null,

  // Pipeline state
  jobId: null,
  jobStatus: null,      // 'pending' | 'ingesting' | 'extracting' | 'synthesizing' | 'gap_finding' | 'done' | 'failed'
  jobProgress: 0,

  // Query state
  queryInput: '',
  queryResult: null,    // {answer, supporting_edges, cypher_used}
  queryLoading: false,

  // Actions
  setNodes, setEdges, setGaps,
  selectNode, selectEdge, clearSelection,
  toggleFilter,
  setJob, updateJobStatus,
  setQueryInput, submitQuery, clearQuery
}
```

### 10.2 D3 Force Graph Configuration (`components/GraphCanvas.jsx`)

Use `react-force-graph` (wrapper around force-graph, which wraps D3) rather than raw D3.

```javascript
// Key configuration
<ForceGraph2D
  graphData={{ nodes, links: edges }}
  nodeLabel={node => node.properties.title || node.properties.name || node.id}
  nodeColor={node => NODE_COLORS[node.label]}    // see color map below
  linkColor={edge => EDGE_COLORS[edge.type]}
  linkDirectionalArrowLength={4}
  linkDirectionalArrowRelPos={1}
  onNodeClick={node => store.selectNode(node.id)}
  onLinkClick={edge => store.selectEdge(edge)}
  onNodeHover={node => store.hoveredNode = node?.id}
  cooldownTicks={100}                             // stop simulation after 100 ticks
  d3AlphaDecay={0.02}
  d3VelocityDecay={0.3}
/>
```

**Color map:**
```javascript
const NODE_COLORS = {
  Paper: '#4A90E2',
  Author: '#7ED321',
  Method: '#F5A623',
  Dataset: '#9B59B6',
  Claim: '#E74C3C',
  Gap: '#FF6B6B'
};

const EDGE_COLORS = {
  CONTRADICTS: '#E74C3C',
  EXTENDS: '#27AE60',
  REPLICATES: '#3498DB',
  REPLICATES_FAILED: '#E67E22',
  CHALLENGES: '#F39C12',
  CITES: '#95A5A6',
  IMPLEMENTS: '#1ABC9C',
  DISAGREES_ON_SCOPE: '#8E44AD'
};
```

### 10.3 Pipeline Polling (`hooks/usePipeline.js`)

Poll `GET /pipeline/status/{job_id}` every 2 seconds while status is not `done` or `failed`. On `done`, fetch graph data and update the Zustand store. Stop polling on `failed` and display `error_message`.

### 10.4 NL Query Flow (`hooks/useQuery.js`)

1. User types question in `QueryInterface.jsx`
2. On submit: set `queryLoading = true`, POST to `/query/natural-language`
3. On response: set `queryResult`, set `queryLoading = false`
4. Display answer in `QueryInterface.jsx`
5. Highlight `supporting_edges` in `GraphCanvas.jsx` by comparing edge IDs

---

## 11. Error Handling Strategy

### Backend

| Scenario | Handling |
|----------|----------|
| arXiv rate limit (429) | Exponential backoff: wait `2^n` seconds, max 3 retries |
| Semantic Scholar 429 | Skip enrichment for that paper, log warning, continue |
| GitHub rate limit (403) | Skip remaining GitHub results, log warning, continue pipeline |
| NewsAPI error | Skip news source entirely, continue pipeline |
| Groq timeout | Retry on OpenRouter immediately, same prompt |
| OpenRouter timeout | Log pair as skipped, continue to next pair |
| LLM returns invalid JSON | Retry up to 2 times. If still invalid, skip pair and log |
| LLM returns `NONE` relationship | Discard silently (not a failure) |
| Neo4j connection failure | Raise 503 on API, set job status to `failed`, surface error message |
| PostgreSQL connection failure | Raise 503 on API, set job status to `failed` |
| Pydantic validation failure on LLM output | Log malformed response, skip pair |

### Frontend

| Scenario | Handling |
|----------|----------|
| Pipeline job fails | Show error message from `job.error_message`, offer retry button |
| NL query returns 400 | Show "Could not interpret this question. Try rephrasing." |
| Graph fetch returns empty | Show empty state with prompt to run pipeline or load demo |
| Network error on any request | Show toast notification, do not crash the graph canvas |

---

## 12. Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Full pipeline (50 papers) | < 5 minutes | Ingestion + extraction + synthesis + gap detection |
| D3 render (200 nodes) | < 2 seconds | Using react-force-graph, not raw D3 |
| NL query response | < 3 seconds | LLM call + Cypher + response generation |
| Graph load on page open | < 1 second | Pre-fetched and cached, not live query |
| LLM synthesis per pair | < 4 seconds | Groq target; OpenRouter may be slower |
| Demo graph load | < 500ms | Reading from local JSON file, not live synthesis |

---

## 13. Testing Strategy

### Unit Tests (`/backend/tests/unit/`)

- `test_ner.py`: Run SciSpaCy on 5 fixed abstracts, assert at least 3 entities extracted per abstract
- `test_deduplication.py`: Assert that "BERT" and "Bidirectional Encoder Representations from Transformers" merge to the same entity
- `test_synthesis_schema.py`: Assert Pydantic model rejects LLM responses missing `evidence_quote` or with `confidence` outside 0–1
- `test_cypher_gap_queries.py`: Run each gap detection query against a small seeded Neo4j instance, assert expected output
- `test_llm_router.py`: Mock Groq to raise timeout, assert OpenRouter is called as fallback

### Integration Tests (`/backend/tests/integration/`)

- `test_full_pipeline.py`: Run pipeline on query "attention mechanism 2023" with `max_papers=10`. Assert job reaches `done` status, at least 5 papers written to Neo4j, at least 3 relationships written
- `test_cache_hit.py`: Run pipeline twice on same query. Assert second run makes zero arXiv API calls (PostgreSQL cache used)
- `test_api_routes.py`: Test all API endpoints with httpx test client. Assert correct HTTP status codes and response schema

### Manual Spot-Check (before demo)

- Pick 5 random relationships from Neo4j. Open both papers. Confirm the relationship type and evidence quote are accurate.
- Run all 4 gap detection Cypher queries on the demo graph. Confirm results are non-empty and make sense.
- Ask 3 NL questions via the query interface. Confirm answers are grounded in graph data.

---

## 14. Development Roadmap

### Phase 1: MVP (12 days)

**Days 1–2:** FastAPI skeleton, PostgreSQL models, Neo4j constraints + indexes, arXiv API integration, Docker Compose running  
**Days 3–4:** SciSpaCy NER, sentence-transformers embeddings, entity deduplication, PostgreSQL cache  
**Day 5:** Groq client, OpenRouter fallback, synthesis agent, relationship write to Neo4j  
**Days 6–7:** All 4 gap detection Cypher queries, Gap Finder agent, gap nodes written to Neo4j  
**Days 8–9:** React app scaffold, Zustand store, D3 force graph with node/edge colors and tooltips  
**Day 10:** Filter panel (toggle relationship types), edge inspector (click edge → evidence panel)  
**Day 11:** NL query interface, pipeline status polling, demo graph loader  
**Day 12:** Pre-build 3 demo graphs, full integration test, demo script rehearsal  

### Phase 2: Post-Hackathon (4–8 weeks)

- JWT authentication + PostgreSQL user sessions
- Celery + Redis background worker for real-time arXiv monitoring
- Temporal analysis: track how claims evolve across publication dates
- Author collaboration graph
- Full error handling + graceful degradation on all agent failures
- Neo4j query performance optimization (indexing, query caching)

### Phase 3: Production (3–6 months)

- Multi-language support (non-English papers via multilingual embeddings)
- Integration with IEEE Xplore and ACM Digital Library
- Mobile-responsive frontend
- External API for third-party integrations
- PDF upload and analysis

---

## 15. Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Relationship classification depends entirely on LLM inference, not a trained classifier | Classification quality is bounded by prompt quality and model capability | Manual spot-check of 5 relationships before demo; adjust prompts if accuracy is poor |
| NL-to-Cypher step has no injection protection at MVP stage | A crafted query could execute unintended graph operations | Restrict to read-only Neo4j user in connection config; validate that generated Cypher contains no write keywords before execution |
| No rate limiting on inbound FastAPI endpoints | A bad actor or bug could trigger unlimited LLM calls and run up API costs | Add `slowapi` middleware rate limiter on `/pipeline/run` endpoint before any public deployment |
| SciSpaCy + sentence-transformers = ~1.7GB models | Slow cold start on free hosting tiers | Pre-warm models on startup; use ONNX Runtime for SciSpaCy to reduce memory footprint |
| Candidate pair generation uses K=10 nearest neighbors | Some meaningful cross-cluster relationships may be missed | Acceptable tradeoff for MVP; increase K or add full cross-cluster sampling in Phase 2 |
| No verification that LLM evidence quotes actually appear in source text | LLM could fabricate a plausible-sounding quote | Out of scope for MVP; flag as known limitation in demo |
| English-language NER only | Non-English papers processed with reduced accuracy | Use multilingual embeddings for dedup; flag non-English papers in metadata |
| Confidence threshold of 0.7 was chosen without empirical calibration | May be too aggressive (missing real relationships) or too loose (accepting weak ones) | Adjustable via `CONFIDENCE_THRESHOLD` env var; tune during manual spot-check on Day 12 |

---

*End of specification. Build against this document. Every section marked as a decision (env var, threshold, prompt, Cypher query) is intentional and should not be changed without updating this file.*
