# ContextForge — Master Specification

> Single source of truth for the project. Intended to be handed to any AI agent
> or developer as the complete context for ContextForge. Generated from the
> repository state on 2026-11-14.

---

## 1. What ContextForge is

ContextForge is a research intelligence platform. A user enters a research topic and
the system ingests papers, code repositories and news, then builds a **typed,
evidence-grounded knowledge graph** that surfaces contradictions, extensions,
replications, challenges and research gaps that traditional literature reviews
miss. The signature interaction is: every edge carries the sentence it was drawn
from, a relationship type, and a confidence score.

Tagline used in the UI: "Read the disagreement, not the summary."

---

## 2. Tech stack

**Frontend** (`frontend/`)
- React 18 + Vite
- react-force-graph-2d (2D graph canvas)
- zustand (state management)
- Lenis (smooth scroll, landing only)
- Plain CSS with design tokens (no Tailwind, no component library)

**Backend** (`backend/`)
- Python, FastAPI (async), Pydantic
- PostgreSQL via SQLAlchemy (SQLite locally)
- Neo4j (graph storage)
- Redis (optional cache)
- LLM: Groq / OpenRouter (LLM router with fallback)
- NLP: SciSpaCy NER, sentence-transformers embeddings

**Infrastructure**
- Docker Compose for full stack
- Vercel frontend, Render backend (production targets)
- Local dev: backend `.venv` (Python 3.11), Vite dev server

---

## 3. Repository layout

```
ContextForge/
├── .env                       # root env (backend reads this when run from root)
├── start.bat                  # Windows dev launcher
├── backend/
│   ├── main.py                # FastAPI app, router registration, lifespan
│   ├── config.py              # pydantic settings
│   ├── auth.py                # JWT + password hashing
│   ├── db/
│   │   ├── models.py          # SQLAlchemy ORM (users, runs, templates, ...)
│   │   ├── neo4j_client.py
│   │   └── postgres_client.py
│   ├── api/
│   │   ├── routes/            # auth, runs, user_data, versions, pipeline, graph, query, demo, pipeline_stream
│   │   ├── deps.py
│   │   └── schemas.py
│   ├── agents/                # ingestion, extractor, synthesis, gap_finder
│   ├── llm/                   # groq_client, openrouter_client, router
│   ├── nlp/                   # embeddings, ner
│   └── tests/
├── frontend/
│   ├── index.html             # CSP lives here
│   ├── vite.config.js         # dev proxy for all API paths
│   └── src/
│       ├── main.jsx           # global imports: tokens.css, auth.css, index.css
│       ├── Root.jsx           # route switch: landing | account | app
│       ├── App.jsx            # workspace (lazy loaded)
│       ├── AccountPage.jsx    # /account page
│       ├── styles/            # tokens.css, auth.css, account.css, index.css
│       ├── landing/           # landing page + its own tokens.css + landing.css
│       ├── components/        # all UI components
│       ├── store/             # authStore, graphStore
│       ├── api/               # client.js, mock.js
│       ├── hooks/             # usePipeline, useGraph, useForceGraph, useLiquidGlass
│       ├── utils/             # nodes.js, bibtex.js
│       └── __tests__/
└── docs/
    ├── api.md
    ├── schemas.md
    └── MASTER_SPEC.md         # this file
```

---

## 4. Routing (frontend)

`src/landing/useRoute.js` parses `window.location.pathname`:

- `/` → landing page
- `/account` → account page
- `/app`, `/app/node/:id`, `/app/edge/:id` → workspace (lazy App chunk)
- `?demo=<id>` → workspace in demo mode (zero backend required)

Navigation is done with the `navigate(path)` helper, which uses `history.pushState`.

---

## 5. Design system

**Two token sources, one shared palette.**

- `src/styles/tokens.css` — global `:root` tokens used by `/app` and `/account`.
- `src/landing/tokens.css` — scoped under `.landing`, overrides the same names for the marketing page.

Key tokens: surface ladder (`--surface-0..4`), hairlines (`--hairline`, `--hairline-strong`,
`--hairline-tertiary`), brand accent `--primary` / `--brand-accent` (lavender, hue 275),
`--success`, `--danger-*`, typography (`--font-sans`, `--font-display`, `--font-mono`),
spacing (`--s-*`), radii (`--r-*`), shadows.

**Console atmospheric theme (landing):** graphite in three lightness steps, hairline panels,
grotesk for reading, mono for measured values, lavender only for actions a person takes.

**Rules enforced across the codebase**
- No em dashes, no middle dots in copy.
- No eyebrow labels, no tracked caps.
- No `transition: all`.
- No `vh` (use `dvh`).
- No `#000` / `#fff` outside tokens.
- `/app` palette, layout and typography must NOT be re-skinned. Only landing and account
  page may be styled.

---

## 6. Frontend architecture

### State stores
- `store/authStore.js` — user, accessToken, isAuthenticated, initialized. Handles
  login, register, refresh (cookie-based), logout, `initAuth()`.
- `store/graphStore.js` — nodes, edges, gaps, selectedNode, selectedEdge, selectedRun,
  viewMode, activeFilters, jobStatus, searchQuery.

### API client
- `api/client.js` — typed wrappers around all backend endpoints. Uses `VITE_API_BASE_URL`
  (defaults to `http://localhost:8000`), with `credentials: 'include'`.
- `api/mock.js` — hardcoded mock data, activated by `VITE_USE_MOCK_API=true` (used in tests).

### Components
- `GraphCanvas.jsx` — 2D force graph with monochrome edges, per-type stroke vocabulary,
  arrowheads at rest, top-cited ring, drag-pan, `+ / − / ⊙` controls, `maxZoom={3}`,
  wheel zoom disabled. Paper names visible only on hover.
- `NodeDetailPanel.jsx` - node details, Copy BibTeX, Bookmark, Annotate.
- `EdgeInspector.jsx` - edge evidence, confidence, BibTeX (source/target), Bookmark, Annotate.
- `AccountMenu.jsx` - avatar button (DiceBear) navigating to `/account`, plus login/logout.
- `Avatar.jsx` - shared DiceBear avatar with initial fallback.
- `SavedRuns.jsx`, `TemplatePanel.jsx`, `PreferencesPanel.jsx`, `LibraryPanel.jsx`,
  `GraphVersionsPanel.jsx` - account page panels.
- `FilterPanel.jsx`, `GapPanel.jsx`, `StatsPanel.jsx`, `NodeListView.jsx`, `NodeTooltip.jsx`,
  `TimelineView.jsx`, `SearchBar.jsx`, `PipelineStatus.jsx`, `Skeleton.jsx`,
  `GlobalErrorToast.jsx`, `ErrorBoundary.jsx`, `BookmarkButton.jsx`, `AnnotationButton.jsx`,
  `SaveRunButton.jsx`, `GoogleSignInButton.jsx`, `AuthDialog.jsx`, `Login.jsx`, `Register.jsx`.
- Landing: `TopNav`, `Hero`, `GraphFrame`, `RecordSection`, `EdgeTable`, `GapRows`,
  `PipelineTrail`, `DatasetIndex`, `CloseBand`, `Footer`, `ScrollTop`.

### Landing page (`src/landing/`)
- `LandingPage.jsx` switches between sections.
- Console atmospheric theme, lavender accent (hue 275), liquid-glass nav (56px both states),
  Lenis smooth scroll, one live 2D graph, poster-posture hero, 96px `--text-display`, 8/4 grid.
- Footer: brand link + 5 nav links, no closing statement; floating 40px scroll-to-top pill past 600px.
- Paper names visible only on hover on both graphs; hero text block is the hero.
- Demos work with zero backend (`?demo=<id>`).

### Workspace header (`App.jsx`)
- View toggle (Graph / Timeline)
- Save Run button (conditional on `nodes.length > 0`)
- AccountMenu (avatar only, no name)

---

## 7. Backend architecture

### Entry point
`backend/main.py` — FastAPI app with CORS, rate limiting (slowapi), security headers,
request ID middleware, global exception handlers, `/health`, optional `/metrics`.

### Routers (`backend/api/routes/`)
- `auth.py` — register, login, refresh, logout, Google sign-in
- `runs.py` — save run, list, get, delete, patch (saved runs)
- `user_data.py` — templates, preferences, bookmarks, annotations, exports
- `versions.py` — graph versions (per run)
- `pipeline.py` — start pipeline, status
- `pipeline_stream.py` — SSE stream
- `graph.py` — nodes, edges, gaps, node detail
- `query.py` — natural language query
- `demo.py` — demo topics, load demo

### Auth model
- Stdlib-only JWT (HS256) + PBKDF2-HMAC-SHA256 (100k iterations).
- Access token: 15 min, in memory (frontend).
- Refresh token: 7 days, opaque, SHA-256 hashed in DB, httpOnly cookie, rotated on refresh.
- Google Sign-In wired but unconfigured (`GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`).
- Clerk rejected (cost, lock-in).

### Data models (`backend/db/models.py`)
- User (email, password hash, display_name)
- SavedRun (label, query, node/edge/gap counts, created_at)
- Template (query, label, year range, sources)
- Preferences (view_mode, active_filters, theme)
- Bookmark (node_id, edge endpoints, note)
- Annotation (text, node/edge reference)
- Export (kind, target, created_at)
- GraphVersion (run_id, name, filter_settings, layout_state, counts)

### Agents (`backend/agents/`)
- `ingestion.py` — fetches from arXiv, Semantic Scholar, GitHub, NewsAPI.
- `extractor.py` — SciSpaCy NER, entity dedup, claim extraction.
- `synthesis.py` — LLM classification of relationships (contradicts, extends, ...).
- `gap_finder.py` — detects contradictions, low-density areas, stale claims, bridge opportunities.
- `exceptions.py` — shared exceptions.

### LLM layer (`backend/llm/`)
- `groq_client.py`, `openrouter_client.py`, `router.py` — provider abstraction with fallback.

### NLP (`backend/nlp/`)
- `embeddings.py` (sentence-transformers), `ner.py`.

### Graph storage
- Neo4j stores papers (nodes) and typed relationships (edges).
- PostgreSQL/SQLite stores user data and runs.

### Relationship (edge) types
`contradicts`, `extends`, `replicates`, `replicates_failed`, `challenges`, `cites`,
`implements`, `disagrees_on_scope`.

### Gap types
Contradictions, low-density areas, stale claims, bridge opportunities.

### API endpoints (base `/`)

Auth (`/auth`): POST register, login, google, refresh, logout.

Runs (`/runs`): POST create, GET list, GET {id}, PATCH {id}, DELETE {id}.

User data (`/templates`, `/preferences`, `/bookmarks`, `/annotations`, `/exports`):
templates POST/GET/DELETE; preferences GET/PUT; bookmarks POST/GET/DELETE;
annotations POST/GET/PATCH/DELETE; exports POST/GET.

Versions (`/versions`): POST (create), GET {run_id}, GET {run_id}/{version_id},
PATCH {run_id}/{version_id}, DELETE {run_id}/{version_id}.

Pipeline: POST /pipeline/run (202), GET /pipeline/status/{job_id},
GET /stream/{job_id} (SSE).

Graph: GET /graph/nodes, /graph/edges, /graph/gaps, /graph/node/{node_id}.

Query: POST /query/natural-language.

Demo: GET /demo/topics, POST /demo/load/{topic_id}.

Health: GET /health, GET /metrics (optional).

---

## 8. Account page (`/account`)

Reached by clicking the avatar. Dedicated `src/styles/account.css` scoped under
`.account-page`.

**Layout:** sticky glass header (brand + Workspace/Home back + Log out), masthead
(64px avatar + "Account" + email + lede), 12-column grid: Saved runs (7) + View (5),
Templates (7) + stacked Library + Graph versions (5). Responsive: 2 columns at >=56rem,
single column below.

**Panels** (all load their data on mount):
- Saved runs — save/load/delete runs.
- View (preferences) — save/apply view mode + filters.
- Templates — save/rerun/delete query presets.
- Library — tabs for bookmarks, notes, exports; inline edit for notes; bookmark titles
  resolved via `/graph/node/{id}`.
- Graph versions — snapshot/restore filters+layout per run.

**Signed-out state:** centered card with sign-in prompt and AccountMenu.

---

## 9. Environment variables

**Root `.env` (backend)**
```
GROQ_API_KEY, OPENROUTER_API_KEY
GROQ_MODEL, OPENROUTER_MODEL
LLM_TIMEOUT_SECONDS, LLM_MAX_RETRIES
NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
DATABASE_URL (sqlite+aiosqlite:///./contextforge.db locally)
ARXIV_RATE_LIMIT_PER_SECOND, SEMANTIC_SCHOLAR_API_KEY, GITHUB_TOKEN, NEWS_API_KEY
CONFIDENCE_THRESHOLD, GAP_TEMPORAL_YEARS
JWT_SECRET (empty = insecure dev key)
ACCESS_TOKEN_EXPIRE_MINUTES=15, REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_COOKIE_SECURE, REFRESH_COOKIE_SAMESITE
GOOGLE_CLIENT_ID (empty = disabled)
ENV, APP_URL, BACKEND_CORS_ORIGINS, LOG_LEVEL
```

**Frontend `frontend/.env`**
```
VITE_API_BASE_URL=        # empty in dev (uses Vite proxy)
VITE_USE_MOCK_API=true   # for tests
VITE_GOOGLE_CLIENT_ID=   # for Google sign-in
```

---

## 10. Dev setup

```bash
# Backend (from repo root)
backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000

# Frontend
cd frontend && npm run dev   # http://localhost:3000

# Health check
GET http://localhost:8000/health  # {"status":"ok","checks":{"postgres":"ok","neo4j":"ok"}}
```

**Vite dev proxy** (`frontend/vite.config.js`): proxies `/auth`, `/runs`, `/templates`,
`/preferences`, `/bookmarks`, `/annotations`, `/exports`, `/versions`, `/graph`,
`/pipeline`, `/query`, `/demo`, `/health`, `/metrics` to `http://localhost:8000`,
so cookies work cross-origin in dev.

**CSP** (`frontend/index.html`): `img-src` includes `https://api.dicebear.com` for avatars;
`connect-src` allows localhost:8000 and the production backend.

---

## 11. Testing

- Frontend: `npx vitest run` — 116 tests across 22 files (jsdom).
- Tests run with `VITE_USE_MOCK_API=true`.
- Sloplint (landing): `node .../sloplint.mjs src\landing --genre atmospheric --scope page --stage page`
  must stay `0 FAIL, 0 REFLEX, 0 WARN`.
- Backend: `py_compile` only (no runtime test suite). System Python 3.15 + MINGW numpy
  segfaults on `import neo4j`; use `backend\.venv` (3.11).

---

## 12. Conventions and constraints

- Smallest working change; touch only required files.
- Match existing style. No speculative abstractions.
- Never expose/log/commit secrets.
- Validate inputs at trust boundaries.
- Remove only imports/variables/files made unused by your changes.
- No em dashes, no middle dots in copy, no eyebrow labels, no tracked caps.
- No `transition: all`, no `vh` (use `dvh`), no `#000`/`#fff` outside tokens.
- `/app` must not be re-skinned.
- Demos must work with zero backend (`?demo=<id>`).
- Free hosting only ($0 budget); no paid APIs/services.

---

## 13. Known open items

- No backend runtime test suite; only `py_compile`.
- `JWT_SECRET` not documented in `.env.example`.
- No password reset or email verification.
- `backend\.env` is a broken symlink (points to a nonexistent old path); backend still
  reads root `.env` because it runs from repo root.
- Google sign-in unconfigured (needs env vars).
- Auth tests (backend register/login/refresh/logout, frontend authStore) not written.
