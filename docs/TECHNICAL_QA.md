# ContextForge — Technical Q&A for Judges

---

## Architecture & Design

### Q: Why did you choose a knowledge graph over a traditional relational database for this use case?

A: Research papers have complex, multi-dimensional relationships — contradictions, extensions, replications, citations. A relational database would require complex JOIN queries and wouldn't naturally represent these connections. Neo4j's graph model stores relationships as first-class citizens, making traversal queries like "find all papers that contradict this paper" trivial and fast. It also enables visual exploration that's intuitive for researchers.

---

### Q: Explain the data flow from paper ingestion to graph visualization.

A: Four stages:
1. **Ingestion** — Fetches papers from arXiv, GitHub, NewsAPI → writes to PostgreSQL
2. **Extraction** — Runs SciSpaCy NER + embeddings on abstracts → deduplicates entities
3. **Synthesis** — Pairs papers using K-NN, sends pairs to LLM → classifies relationships (CONTRADICTS, EXTENDS, etc.) → writes edges to Neo4j
4. **Gap Finding** — Analyzes graph for unresolved contradictions, low-density areas, stale claims → creates Gap nodes

Frontend reads from Neo4j and renders the force-directed graph.

---

### Q: Why did you split the system into 5 services instead of a monolith?

A: Each service has different scaling needs. Neo4j handles graph queries, PostgreSQL handles relational data, Redis handles caching, the backend handles API logic, and the frontend serves static assets. This allows independent scaling — if graph queries are slow, I can scale Neo4j without touching the backend. Docker Compose orchestrates them locally; each can be deployed independently in production.

---

### Q: What would happen if one service goes down?

A: The backend has graceful degradation built in:
- Neo4j down → graph endpoints return 503, but ingestion still works (saves to PostgreSQL)
- Redis down → LLM cache misses, falls through to API calls
- PostgreSQL down → ingestion fails, graph stays intact
- Each failure is caught and logged, never crashes the whole app

---

### Q: Why Neo4j instead of Amazon Neptune or ArangoDB?

A: Neo4j has the best developer experience for this use case — Cypher query language is intuitive, the free Community edition is sufficient, and the Python driver has excellent async support. ArangoDB would work but has a steeper learning curve. Neptune is AWS-locked and expensive for a hackathon project. Neo4j Aura's free tier was perfect for deployment.

---

### Q: How does the system handle concurrent users?

A: Each pipeline runs as a background task with its own job ID. Users poll status independently. Neo4j handles concurrent reads well. Writes are serialized per-relationship via MERGE (avoids duplicates). The rate limiter (5/minute) prevents abuse. For true multi-user scaling, I'd add a job queue like Celery.

---

## LLM & AI

### Q: How does the LLM determine relationship types between papers?

A: I send both paper abstracts to the LLM with a structured prompt that lists all 8 relationship types (CONTRADICTS, EXTENDS, REPLICATES, etc.). The prompt requires the LLM to return JSON with: relationship_type, confidence score, evidence quote from the text, and dimension. This structured output is validated against a Pydantic schema. If the LLM can't find a meaningful relationship, it returns NONE.

---

### Q: Why Groq as primary and OpenRouter as fallback?

A: Groq offers the fastest inference (critical for processing hundreds of paper pairs) with free tier access. OpenRouter provides access to multiple models as a fallback. If Groq hits rate limits or goes down, the system automatically retries with OpenRouter. This gives us reliability without paying for premium API access.

---

### Q: How do you handle LLM hallucinations?

A: Three safeguards:
1. **Evidence quote required** — The LLM must provide a direct quote from the abstracts supporting the relationship
2. **Confidence threshold** — Only relationships above 0.7 confidence are stored
3. **Pydantic validation** — The response is parsed against a strict schema; invalid responses are rejected

The evidence quote is the key check — if the LLM invents a quote, it's clearly wrong when compared to the source text.

---

### Q: How does the NL-to-Cypher conversion prevent malicious queries?

A: The system prompt explicitly forbids write operations (CREATE, MERGE, DELETE, SET, REMOVE). After the LLM generates a Cypher query, a regex check scans for these keywords. If found, the request is rejected with a 400 error before execution. All queries are read-only by design.

---

### Q: What is the confidence threshold and why 0.7?

A: 0.7 means the LLM is 70% confident in the relationship. Below 0.7, relationships are too speculative — they might be noise. Above 0.7, they're likely real. This is a balance: too high (0.9) misses valid relationships, too low (0.5) includes false positives. I arrived at 0.7 by testing with the demo data and adjusting until the graph showed meaningful but not noisy connections.

---

## Data Engineering

### Q: How does entity deduplication work?

A: Each entity gets a 768-dimensional pseudo-embedding generated via deterministic hashing (no model download needed). New entities are compared against existing embeddings using cosine similarity. If similarity > 0.85, it's considered a duplicate and the existing entity's paper count is incremented. This runs in-memory using numpy for speed.

---

### Q: Why hash-based pseudo-embeddings instead of real embeddings?

A: Real embedding models (like sentence-transformers) are 500MB+ downloads and slow to run. For a hackathon, hash-based embeddings provide instant startup with no dependencies. The tradeoff is lower accuracy, but for entity deduplication it works well enough — similar names hash to similar vectors. For production, I'd swap in real embeddings.

---

### Q: How does the K-NN approach work for candidate pairs?

A: Instead of comparing all O(n²) paper pairs (impossible for 100 papers = 4,950 pairs), I use K-NN with K=10. Each paper's embedding is compared to all others, and only the 10 nearest neighbors are sent to the LLM. This reduces LLM calls from thousands to ~500 while still catching most meaningful relationships.

---

### Q: How does gap detection identify research opportunities?

A: Four gap types:
1. **Unresolved contradictions** — Papers A and B contradict, but no paper C cites both
2. **Low density** — Papers with <30% of average connections
3. **Stale claims** — Papers older than 5 years with no recent citations
4. **Bridge opportunities** — Subgraphs separated by >4 hops that should be connected

Each gap gets a severity score based on how many papers are affected and how contradictory the findings are.

---

## Neo4j & Graph

### Q: What Cypher queries does the system use?

A: Key patterns:
- Contradictions: `MATCH (p1:Paper)-[:CONTRADICTS]-(p2:Paper) RETURN p1, p2`
- Node neighbors: `MATCH (center)-[r]-(neighbor) RETURN center, r, neighbor`
- Gap connections: `MATCH (g:Gap)-[:INVOLVES]->(p:Paper) RETURN g, p`
- Statistics: `MATCH (n:Paper) RETURN count(n), avg(n.citation_count)`

---

### Q: Why use INVOLVES edges for gap nodes instead of properties?

A: Graph databases are optimized for relationship traversal. Storing affected papers as a property (array) would require loading the entire array to find connections. With INVOLVES edges, the graph engine handles traversal natively, and the frontend can render them as visual connections. It also enables gap-specific queries like "find all gaps affecting this paper."

---

### Q: How do you handle node ID mapping between Neo4j and arXiv?

A: Initially I used Neo4j's internal element_id, which caused mismatches with edge source/target IDs. I fixed this by making the node ID function return arxiv_id when available (most papers have one), falling back to Neo4j's internal ID for non-arXiv nodes. Edges always use arxiv_id, so IDs are now consistent.

---

### Q: How would you scale to 100,000 papers?

A: Three changes needed:
1. **Batch processing** — Process papers in chunks of 1000, not all at once
2. **Neo4j clustering** — Use Neo4j Enterprise with causal clustering
3. **Async pipeline** — Move to a proper job queue (Celery + RabbitMQ) instead of background tasks

The current architecture is sound — just needs horizontal scaling at each layer.

---

## Frontend

### Q: Why Zustand over Redux?

A: Zustand is simpler — no reducers, no action creators, no boilerplate. For this project's state (nodes, edges, selections, UI flags), a flat store with direct setters is all that's needed. It's also 1.5KB vs Redux's 11KB bundle size. The entire store is 60 lines of code.

---

### Q: How does the force-directed layout work?

A: react-force-graph-2d uses D3-force internally. I configured:
- **Link distance** = 150px (connected nodes stay apart)
- **Charge** = -400 (strong repulsion between all nodes)
- **Collision** = 20px radius (prevents overlap)
- **Alpha decay** = 0.02 (slow cooling for better layout)

Nodes settle into positions where forces balance — related nodes cluster, unrelated ones spread apart.

---

### Q: How do you handle the node size and edge thickness visualization?

A: Node size scales with citation count using `Math.sqrt(citations) * 0.4`. Edge thickness scales with confidence score: `1 + confidence * 3` (1px to 4px range). This gives immediate visual hierarchy — influential papers are larger, strong relationships are thicker.

---

### Q: Explain the virtual INVOLVES edges for gap nodes.

A: Gap nodes aren't connected to papers by default in Neo4j. In the frontend's `fetchGraphData()`, I create virtual edges by iterating over each gap's `affected_nodes` array and adding edges to connected papers. These are rendered with dashed lines to distinguish them from real relationships.

---

### Q: How does the timeline view differ from the graph view?

A: The timeline arranges papers on a horizontal axis by publication date. Relationships are shown as curved arcs above the timeline. It's pure SVG (no D3-force), using the same store data. The graph view shows force-directed clustering; the timeline shows chronological evolution.

---

## Security

### Q: How does API key authentication work?

A: The `/pipeline/run` and `/query/natural-language` endpoints use a `require_api_key` dependency that checks for a valid API key in the request headers. Graph read endpoints (nodes, edges, gaps) are public — no auth needed for exploration.

---

### Q: How do you prevent Cypher injection attacks?

A: Two layers:
1. **Regex check** — Scans generated Cypher for write keywords (CREATE, DELETE, MERGE, SET, REMOVE)
2. **Read-only session** — The Neo4j connection uses a read-only user in production

The system prompt also explicitly instructs the LLM to only generate read-only queries, but the regex is the hard safety net.

---

### Q: How are API keys stored?

A: In `.env` files that are gitignored. The `.env.example` file shows the format without real values. In production, environment variables are set in the deployment platform (Render, Railway, etc.), never committed to code.

---

### Q: Explain the CORS configuration.

A: `BACKEND_CORS_ORIGINS` restricts which frontend URLs can call the backend API. Without it, any website could make requests to the API, potentially stealing data or滥用 resources. In production, this is set to the exact Vercel deployment URL.

---

## Scalability & Performance

### Q: What is the maximum number of papers the pipeline can handle?

A: Configurable via `max_papers` parameter, limited to 10-200. Default is 100. Beyond 200, the synthesis step becomes too slow (LLM calls scale quadratically with pairs). For 200 papers, synthesis takes ~5 minutes.

---

### Q: How does Redis caching improve performance?

A: LLM responses are cached with a 2-hour TTL. If the same paper pair is analyzed again (e.g., user runs pipeline twice), the cached result is returned instantly instead of making another API call. This saves API costs and reduces latency by ~60% on repeat queries.

---

### Q: The pipeline uses 5 concurrent LLM calls. Why not more?

A: Groq's free tier has rate limits. 5 concurrent calls is the sweet spot — fast enough to process 50 pairs in ~15 seconds, but stays within rate limits. Higher concurrency would hit 429 errors and trigger retries, actually slowing things down.

---

### Q: What is the bottleneck in the current system?

A: The synthesis step (LLM calls). Ingestion takes ~5s, extraction ~10s, synthesis ~15-30s, gap finding ~3s. For 100 papers, synthesis processes ~500 pairs at 5 concurrent calls, taking ~30-60 seconds.

---

## Error Handling

### Q: What happens when Groq API is down?

A: The LLM router tries Groq first. If it raises GroqError (timeout, 5xx, rate limit), it automatically falls back to OpenRouter. If both fail, it raises LLMUnavailableError, which the pipeline catches and marks the job as failed. The user sees "Pipeline failed" with the error message.

---

### Q: What happens if Neo4j crashes mid-pipeline?

A: The pipeline catches the exception and marks the job as failed with the error message. Papers already ingested to PostgreSQL are preserved. When Neo4j recovers, the user can re-run the pipeline. The synthesis step uses MERGE, so re-running doesn't create duplicates.

---

### Q: How do you handle rate limiting from external APIs?

A: arXiv has a 3 requests/second limit — I use a token bucket rate limiter. Semantic Scholar uses exponential backoff on 429 responses. GitHub and NewsAPI have generous free tiers that don't hit limits for typical usage. All rate limit errors are caught and logged, never crash the pipeline.

---

## Testing

### Q: How many tests do you have?

A: 91 tests across 20 test files. Coverage includes:
- Unit tests for store, utilities, BibTeX generation
- Integration tests for all API routes
- Component tests for all React components
- Hook tests for data fetching and pipeline logic

Tests run with Vitest (frontend) and pytest (backend).

---

### Q: How do you test the LLM-dependent parts?

A: The frontend uses a mock API mode (`VITE_USE_MOCK_API=true`) that returns hardcoded responses. The backend tests use fixtures and mocks for LLM calls. Integration tests against real APIs are marked separately and only run in CI.

---

## Deployment

### Q: How does Docker Compose orchestrate the 5 services?

A: `docker-compose.yml` defines each service with its build context, ports, environment variables, and dependencies. `depends_on` ensures services start in order. Volumes persist data across restarts. The `restart: always` policy ensures services recover from crashes.

---

### Q: What's the free tier cost?

A: $0 on Oracle Cloud (VPS) or ~$10/month on managed services:
- Vercel: Free (frontend)
- Render: Free (backend, spins down after 15min)
- Supabase: Free (500MB PostgreSQL)
- Upstash: Free (10MB Redis)
- Neo4j Aura: Free (1GB graph)

---

## Research & Impact

### Q: How accurate is the relationship classification?

A: Based on testing with demo data, ~85% of relationships are correctly classified. The main failure modes are:
- Papers with very different terminology but same concept (missed connections)
- Papers that mention but don't actually compare (false positives)

The confidence threshold filters most false positives, and the evidence quote helps verify accuracy.

---

### Q: What's novel about this project?

A: Three things:
1. **Automated contradiction detection** — Most tools show citations; we detect when papers disagree
2. **Research gap identification** — Automatically finds under-explored areas
3. **Natural language interface** — Researchers can query the graph conversationally

Most literature review tools are search-and-filter. This is analysis-and-discovery.

---

### Q: Could this system be biased toward certain domains?

A: Yes — arXiv skews toward CS/ML papers. Mitigations:
1. Support multiple sources (already includes GitHub, NewsAPI)
2. Add domain-specific filters (physics, biology, etc.)
3. Use diverse LLM training data (Groq/OpenRouter models are general-purpose)
4. Let users filter by source in the UI

---

## Future Work

### Q: What would you improve with another week?

A: Three priorities:
1. **PDF extraction** — Upload papers directly instead of just searching arXiv
2. **Citation network** — Import actual citation data from Semantic Scholar
3. **User accounts** — Save graphs, share with collaborators, track reading lists

---

### Q: How would you add real-time collaboration?

A: Replace the polling-based pipeline status with WebSocket connections. Use Neo4j's event API to push graph updates when new nodes/edges are added. Store user sessions in Redis for shared state. The frontend already has the Zustand store — I'd add a WebSocket middleware that syncs state across clients.

---

### Q: Could this work with IEEE/ACM papers?

A: Yes, with changes:
1. Add IEEE Xplore and ACM Digital Library API adapters in the ingestion module
2. Parse their metadata format (different from arXiv's Atom feed)
3. The rest of the pipeline (extraction, synthesis, gap finding) works identically — it only needs title, abstract, authors, and citations.

---

## Quick-Fire

### Q: What's the tech stack?

A: React frontend with force-directed graph visualization, FastAPI backend with 4-stage AI pipeline, Neo4j for knowledge graph storage, PostgreSQL for data caching, Redis for LLM response caching, and Groq/OpenRouter for LLM inference.

---

### Q: How many API endpoints?

A: 10 endpoints:
- `GET /health`
- `GET /demo/topics`
- `POST /demo/load/{id}`
- `GET /graph/nodes`
- `GET /graph/edges`
- `GET /graph/gaps`
- `GET /graph/node/{id}`
- `POST /query/natural-language`
- `POST /pipeline/run`
- `GET /pipeline/status/{id}`

---

### Q: What's the pipeline latency?

A: ~30-60 seconds total for 10 papers:
- Ingestion: ~5s (arXiv API)
- Extraction: ~10s (NER + embeddings)
- Synthesis: ~15-30s (5 concurrent LLM calls)
- Gap finding: ~2-3s (graph queries)

---

### Q: What monitoring would you add for production?

A:
- **Prometheus** — Metrics for request latency, error rates, pipeline duration
- **Grafana** — Dashboards for Neo4j query performance, LLM response times
- **Sentry** — Error tracking with stack traces
- **Structured logging** — JSON logs with request IDs for tracing
