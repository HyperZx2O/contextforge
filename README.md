# ContextForge

**See the shape of the research frontier.**

ContextForge is a research intelligence platform that transforms how you explore academic literature. Enter a topic — it ingests papers, code repositories, and news, then constructs a typed, evidence-grounded knowledge graph that surfaces contradictions, extensions, replications, challenges, and research gaps that traditional literature reviews miss.

---

## Features

- **Topic-driven pipeline** — submit a research query and get a fully populated knowledge graph in minutes
- **Multi-source ingestion** — arXiv, Semantic Scholar, GitHub, NewsAPI
- **Typed relationships** — 8 semantic edge types: *contradicts*, *extends*, *replicates*, *replicates_failed*, *challenges*, *cites*, *implements*, *disagrees_on_scope*
- **Research gap detection** — automatically identifies contradictions, low-density areas, stale claims, and bridge opportunities
- **Interactive graph visualization** — 2D/3D force-directed graph with filtering, search, and drill-down
- **Natural language query** — ask questions like *"Which papers contradict each other?"* in plain English
- **Demo datasets** — preloaded topic graphs to explore without running the pipeline

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│  Frontend   │     │                   Backend                        │
│  React/Vite │────▶│  FastAPI + 4-Agent Pipeline                      │
│  (Port 3000)│     │                                                  │
└─────────────┘     │  Agent 1: Ingestion  ──▶ arXiv, GitHub, NewsAPI  │
                    │  Agent 2: Extraction  ──▶ SciSpaCy NER + dedup    │
                    │  Agent 3: Synthesis   ──▶ LLM classification      │
                    │  Agent 4: Gap Finder  ──▶ Cypher + LLM gaps       │
                    │                                                  │
                    ├────────────┬──────────────────────┬───────────────┤
                    │ PostgreSQL │        Neo4j         │   LLM APIs    │
                    │ (caches,   │ (knowledge graph,    │ (Groq llama-  │
                    │  jobs)     │  gap nodes)          │  3.3 → GPT-4o │
                    └────────────┴──────────────────────┴───────────────┘
```

**No external caches** — the LLM response cache uses an in-process dict (the pipeline is ephemeral per-job). A job queue (Celery) and Redis should be added for production multi-user deployments.

---

## Pipeline

The research pipeline runs as four sequential agents:

1. **Ingestion** — Searches arXiv, Semantic Scholar, GitHub, and NewsAPI for the query topic. Stores raw results in PostgreSQL.
2. **Extraction** — Runs SciSpaCy NER to extract entities (methods, datasets, claims, authors). Deduplicates by cosine similarity. Stores in PostgreSQL.
3. **Synthesis** — Pairs entities via K-NN (K=10), classifies relationships using Groq (primary) or OpenRouter (fallback) LLM, and writes typed edges to Neo4j.
4. **Gap Finding** — Runs four structural Cypher queries (contradictions, low-density areas, stale claims, bridge opportunities) and summarizes each as a `Gap` node in Neo4j.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy (async), Pydantic v2 |
| Frontend | React 18, Vite 5, Zustand, react-force-graph-2d |
| Graph DB | Neo4j 5.15 (with APOC) |
| Relational | PostgreSQL 16 (pgvector for embeddings) |
| LLM | Groq (`llama-3.3-70b-versatile`) → OpenRouter (`openai/gpt-4o-mini`) |
| NLP | SciSpaCy (`en_core_web_sm`) |
| Infra | Docker Compose |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose, **or**
- Python 3.11+, Node.js 18+, and a running Neo4j + PostgreSQL

### Using Docker Compose

```bash
git clone <repo-url>
cd ContextForge

# Copy environment file and fill in your API keys
cp .env.example .env
# Edit .env: set GROQ_API_KEY, GITHUB_TOKEN, NEWS_API_KEY (optional),
# DATABASE_URL, NEO4J_PASSWORD

docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- Neo4j Browser: `http://localhost:7474` (neo4j / contextforge_neo4j)

### Local Development (without Docker)

**1. Start infrastructure**

Neo4j and PostgreSQL must be running. You can use Docker for just the databases:

```bash
docker run -d --name contextforge-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/contextforge_neo4j \
  -e NEO4J_PLUGINS='["apoc"]' \
  neo4j:5.15-community

docker run -d --name contextforge-pg \
  -p 5432:5432 \
  -e POSTGRES_USER=contextforge \
  -e POSTGRES_PASSWORD=contextforge_pg \
  -e POSTGRES_DB=contextforge \
  postgres:16
```

**2. Backend**

```bash
cd backend
python -m venv venv && venv\Scripts\activate  # Windows
source venv/bin/activate                        # Unix
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Set your PostgreSQL connection string
# Windows:
set DATABASE_URL=postgresql+asyncpg://contextforge:contextforge_pg@localhost:5432/contextforge
# Unix:
export DATABASE_URL=postgresql+asyncpg://contextforge:contextforge_pg@localhost:5432/contextforge

uvicorn main:app --reload --port 8000
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev  # starts on port 3000
```

### Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/contextforge`) |
| `NEO4J_PASSWORD` | Yes | — | Neo4j password |
| `GROQ_API_KEY` | Yes | — | Primary LLM provider |
| `OPENROUTER_API_KEY` | Fallback | — | Fallback LLM (optional if Groq is stable) |
| `GITHUB_TOKEN` | Yes | — | GitHub API access |
| `NEWS_API_KEY` | No | — | NewsAPI access (optional) |
| `SEMANTIC_SCHOLAR_API_KEY` | No | — | Enhances citation counts |
| `API_KEY` | No | *(dev mode)* | Optional API key auth for pipeline/query endpoints |

---

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/pipeline/run` | Optional key | Start a pipeline job |
| `GET` | `/pipeline/status/{job_id}` | — | Poll pipeline progress |
| `GET` | `/graph/nodes` | — | List graph nodes (with pagination & type filter) |
| `GET` | `/graph/edges` | — | List graph edges (with relationship type filter) |
| `GET` | `/graph/gaps` | — | List research gaps |
| `GET` | `/graph/node/{id}` | — | Node details with neighbors |
| `POST` | `/query/natural-language` | Optional key | NL → Cypher → answer |
| `GET` | `/demo/topics` | — | List demo datasets |
| `POST` | `/demo/load/{topic_id}` | Optional key | Load a demo graph into Neo4j |

### Example

```bash
# Load demo data
curl -X POST http://localhost:8000/demo/load/diffusion_2024

# Query the graph
curl http://localhost:8000/graph/nodes

# Start a pipeline
curl -X POST http://localhost:8000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"query": "retrieval augmented generation 2024"}'
```

---

## Project Structure

```
ContextForge/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Pydantic settings (env-based)
│   ├── dependencies.py          # Shared DB/Neo4j sessions, rate limiter
│   ├── middleware.py             # Request ID + security headers
│   ├── agents/                  # Pipeline agents (1–4)
│   │   ├── ingestion.py         # arXiv, GitHub, NewsAPI fetcher
│   │   ├── extractor.py         # NER + embedding + dedup
│   │   ├── synthesis.py         # LLM relationship classification
│   │   └── gap_finder.py        # Cypher gap queries + LLM summarization
│   ├── api/                     # Route handlers + Pydantic schemas
│   │   └── routes/
│   │       ├── pipeline.py      # POST /run, GET /status
│   │       ├── graph.py         # Nodes, edges, gaps, detail
│   │       ├── query.py         # NL → Cypher translation
│   │       └── demo.py          # Preloaded topic datasets
│   ├── db/                      # ORM models, Neo4j client
│   ├── llm/                     # Groq + OpenRouter clients with router
│   ├── nlp/                     # SciSpaCy NER, embeddings, dedup
│   └── tests/
│       ├── unit/                # 101 agent/model/NLP/schema tests (6 Redis-backed skipped)
│       └── integration/         # 56 API + Cypher + pipeline tests
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios client + mock data
│   │   ├── components/          # GraphCanvas, panels, tooltips
│   │   ├── hooks/               # useGraph, usePipeline, useQuery
│   │   ├── landing/             # Marketing landing page (React)
│   │   ├── store/               # Zustand state management
│   │   └── __tests__/           # 91 component/integration tests
│   └── package.json
├── data/                        # Demo datasets (diffusion, llms, rag)
├── docs/                        # API reference + Pydantic schemas
├── docker-compose.yml           # 4-service orchestration
└── start.bat                    # Local dev launcher (Windows)
```

---

## Testing

```bash
# All backend tests
cd backend && python -m pytest

# Frontend tests
cd frontend && npm run test

# Specific test file
cd backend && python -m pytest tests/integration/test_api_routes.py -v

# With coverage
cd backend && python -m pytest --cov=agents --cov=api --cov=db
```

| Suite | Count |
|-------|-------|
| **Backend unit tests** | 101 (excl. 6 Redis-backed cache tests) |
| **Backend integration tests** | 56 (API routes, Cypher queries, pipeline) |
| **Frontend tests** | 91 (20 test files — components, hooks, store) |

Some integration tests require running PostgreSQL and Neo4j — they are automatically skipped when those services are unavailable.

---

## Documentation

- [API Reference](docs/api.md)
- [Pydantic Schemas](docs/schemas.md)
- [Technical Q&A (for judges)](TECHNICAL_QA.md)

---

## Pipeline Performance

For a typical 30-paper run:

| Stage | Time | Description |
|-------|------|-------------|
| Ingestion | ~5s | Fetch from arXiv, Semantic Scholar, GitHub |
| Extraction | ~10s | NER + embedding + deduplication |
| Synthesis | ~15-30s | 5 concurrent LLM calls classifying relationships |
| Gap Finding | ~2-3s | Cypher queries + LLM summarization |
| **Total** | **~30-50s** | For 30 papers with max_papers=30 |

The `max_papers` parameter is configurable from 10–30 per run to stay within API rate limits.

---

## Project Status

All core features implemented and tested:
- ✅ Multi-source ingestion pipeline
- ✅ NER + embedding-based entity extraction
- ✅ LLM-powered relationship classification with confidence scoring
- ✅ 4 gap detection algorithms
- ✅ Interactive force-directed graph visualization
- ✅ Natural language graph querying (NL → Cypher)
- ✅ Demo datasets for instant exploration
- ✅ API key authentication
- ✅ Rate limiting (30/min on pipeline)
- ✅ **248 total tests** (101 backend unit + 56 integration + 91 frontend)

---

## License

MIT
