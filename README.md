# ContextForge

**See the shape of the research frontier.**

ContextForge is a research intelligence platform that transforms how you explore academic literature. Enter a topic — it ingests papers, code repositories, and news, then constructs a typed, evidence-grounded knowledge graph that surfaces contradictions, extensions, replications, challenges, and research gaps that traditional literature reviews miss.

---

## Features

- **Topic-driven pipeline** — submit a research query and get a fully populated knowledge graph in minutes
- **Multi-source ingestion** — arXiv, Semantic Scholar, GitHub, NewsAPI
- **Typed relationships** — 12 semantic edge types: *contradicts*, *extends*, *replicates*, *challenges*, *uses_dataset*, *introduces_method*, and more
- **Research gap detection** — automatically identifies contradictions, low-density areas, stale claims, and scope disagreements
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
                    ├───────────┬──────────────┬───────────┬────────────┤
                    │ PostgreSQL│    Neo4j     │   Redis   │  LLM APIs  │
                    │ (caches,  │ (knowledge   │ (cache +  │ (Groq →    │
                    │  jobs)    │  graph)      │  rate lim)│ OpenRouter)│
                    └───────────┴──────────────┴───────────┴────────────┘
```

---

## Pipeline

The research pipeline runs as four sequential agents:

1. **Ingestion** — Searches arXiv, Semantic Scholar, GitHub, and NewsAPI for the query topic. Stores raw results in PostgreSQL.
2. **Extraction** — Runs SciSpaCy NER to extract entities (methods, datasets, claims, authors). Deduplicates by cosine similarity. Stores in PostgreSQL.
3. **Synthesis** — Pairs entities via K-NN, classifies relationships using Groq/OpenRouter LLM, and writes typed edges to Neo4j.
4. **Gap Finding** — Runs four structural Cypher queries (contradictions, low-density areas, stale claims, scope mismatches) and summarizes each as a `Gap` node in Neo4j.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy (async), Pydantic |
| Frontend | React 18, Vite 5, Zustand, D3.js / react-force-graph |
| Graph DB | Neo4j 5.15 (with APOC) |
| Relational | PostgreSQL 16 (pgvector) / SQLite (dev) |
| Cache | Redis 7 |
| LLM | Groq (llama-3.1-70b) → OpenRouter (Mixtral 8x7b) |
| NLP | SciSpaCy (`en_core_sci_md`) |
| Infra | Docker Compose, Nginx |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose (recommended), or
- Python 3.11, Node.js 18, and a running Neo4j + PostgreSQL + Redis

### Using Docker Compose

```bash
git clone <repo-url>
cd ContextForge

# Copy environment file and fill in your API keys
cp .env.example .env
# Edit .env: set GROQ_API_KEY, GITHUB_TOKEN, NEWS_API_KEY (optional)

docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Neo4j Browser: `http://localhost:7474` (neo4j / contextforge_neo4j)

### Local Development (without Docker)

**Backend:**

```bash
cd backend
python -m venv venv && venv\Scripts\activate  # Windows
source venv/bin/activate                        # Unix

pip install -r requirements.txt
python -m spacy download en_core_sci_md

# Use SQLite for local dev (no PostgreSQL needed)
$env:DATABASE_URL = "sqlite+aiosqlite:///./dev.db"
# Or set your PostgreSQL connection string

uvicorn main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev  # starts on port 3000
```

### Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Primary LLM provider |
| `OPENROUTER_API_KEY` | Fallback | — | Fallback LLM |
| `GITHUB_TOKEN` | Yes | — | GitHub API access |
| `NEWS_API_KEY` | No | — | NewsAPI access |
| `NEO4J_URI` | Yes | `bolt://neo4j:7687` | Neo4j connection |
| `NEO4J_PASSWORD` | Yes | `contextforge_neo4j` | Neo4j password |
| `DATABASE_URL` | Yes | — | PostgreSQL (or `sqlite+aiosqlite:///./dev.db`) |
| `REDIS_URL` | Yes | `redis://redis:6379/0` | Redis connection |
| `API_KEY` | No | *(dev mode)* | Optional API key auth |

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/pipeline/run` | Start a pipeline job |
| `GET` | `/pipeline/status/{job_id}` | Poll pipeline progress |
| `GET` | `/graph/nodes` | List graph nodes |
| `GET` | `/graph/edges` | List graph edges |
| `GET` | `/graph/gaps` | List research gaps |
| `GET` | `/graph/node/{id}` | Node details with neighbors |
| `POST` | `/query/natural-language` | NL → Cypher → answer |
| `GET` | `/demo/topics` | List demo datasets |
| `POST` | `/demo/load/{topic_id}` | Load a demo graph |

### Example

```bash
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
│   ├── config.py                # Pydantic settings
│   ├── dependencies.py          # Shared DB/Neo4j sessions
│   ├── middleware.py             # Request ID + security headers
│   ├── agents/                  # Pipeline agents (1–4)
│   ├── api/                     # Route handlers + schemas
│   ├── db/                      # ORM models, Neo4j client, migrations
│   ├── llm/                     # LLM clients (Groq, OpenRouter)
│   ├── nlp/                     # SciSpaCy NER, embeddings, dedup
│   └── tests/                   # Unit + integration tests
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios client + mock data
│   │   ├── components/          # Graph canvas, panels, UI
│   │   ├── hooks/               # useGraph, usePipeline, useQuery
│   │   ├── landing/             # Marketing landing page
│   │   └── store/               # Zustand state management
│   └── package.json
├── data/                        # Demo datasets (gitignored)
├── docs/                        # API reference + schemas
├── docker-compose.yml           # 5-service orchestration
└── Makefile                     # Test + dev shortcuts
```

---

## Testing

```bash
# All backend tests
make test-all

# Unit tests only
make test-unit

# Integration tests only
make test-integration

# Frontend tests
cd frontend && npm run test
```

---

## Documentation

- [API Reference](docs/api.md)
- [Pydantic Schemas](docs/schemas.md)
- [Technical Specification](context/spec.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)

---

## License

MIT
