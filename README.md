# ContextForge Backend API

Knowledge graph construction system for research papers. Ingests papers, extracts typed relationships, and stores them in Neo4j.

## Quick Start

```bash
# With Docker Compose
docker compose up --build

# Without Docker (requires running Neo4j + Postgres)
cd backend
pip install -r requirements.txt
export DATABASE_URL="sqlite+aiosqlite:///./dev.db"
uvicorn main:app --reload --port 8000
```

API is available at `http://localhost:8000`.

## Testing

```bash
# All tests
make test-api

# Unit tests only
make test-unit

# Integration tests only
make test-integration
```

Or directly:
```bash
cd backend
$env:DATABASE_URL="sqlite+aiosqlite:///./test.db"
python -m pytest tests/ -v
```

## API Examples

```bash
# Health check
curl http://localhost:8000/health

# Start a pipeline
curl -X POST http://localhost:8000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"query": "retrieval augmented generation 2024"}'

# Get graph nodes
curl "http://localhost:8000/graph/nodes?limit=10"

# Natural language query
curl -X POST http://localhost:8000/query/natural-language \
  -H "Content-Type: application/json" \
  -d '{"question": "Which papers contradict each other?"}'

# Load demo data
curl http://localhost:8000/demo/topics
curl -X POST http://localhost:8000/demo/load/rag_2024
```

## Documentation

- [API Reference](docs/api.md)
- [Pydantic Schemas](docs/schemas.md)
- Full system spec: `spec.md`
- Implementation plan: `plan.md`
