# ContextForge — Frontend

Member 3 frontend reference. Derived from `context/spec.md` §6, §10 and `context/plan.md`.

## Component Tree

```
App
├── PipelineStatus          ← pipeline progress bar + run button (+ Load Demo)
├── GraphCanvas             ← D3 force graph (react-force-graph)
│   ├── NodeTooltip         ← hover tooltip with paper title
│   └── EdgeInspector       ← click edge → evidence panel (modal or sidebar)
├── FilterPanel             ← relationship type toggle checkboxes
├── GapPanel                ← list of gap nodes with descriptions
└── QueryInterface          ← NL query input + answer display
```

### One-sentence render description per component
- **PipelineStatus** — shows a query input with a "Run Pipeline" button and a progress bar that polls job status; also exposes a "Load Demo" dropdown.
- **GraphCanvas** — renders the force-directed node/edge graph, coloring nodes and edges by type and handling hover/click selection.
- **NodeTooltip** — appears on node hover and shows the paper title, publish date, and citation count from `node.properties`.
- **EdgeInspector** — opens when an edge is selected and shows the relationship type, source/target titles, evidence quote, and confidence.
- **FilterPanel** — lists one checkbox per relationship type (all 8) with a colored dot and edge counts, toggling `activeFilters` in the store.
- **GapPanel** — lists detected gaps sorted by severity, each with a typed badge, severity bar, description, and affected papers.
- **QueryInterface** — accepts a natural-language question, displays the generated answer with supporting edges and response time, and supports a "Clear" action.

## Zustand Store Shape (`src/store/graphStore.js`, spec §10.1)

The base shape follows spec §10.1; fields added in later phases are marked `[+N]`.

```javascript
{
  // Graph data
  nodes: [],            // [{id, label, properties}]              [spec §10.1]
  edges: [],            // [{source, target, type, properties}]   [spec §10.1]
  gaps: [],             // [{id, gap_type, description, severity, affected_nodes}]  [spec §10.1]

  // UI state
  selectedNode: null,   // node id or null                         [spec §10.1]
  selectedEdge: null,   // edge object or null                     [spec §10.1]
  activeFilters: [],    // relationship types currently HIDDEN (unchected) [spec §10.1, redefined]
  hoveredNode: null,    // node id or null (drives NodeTooltip)    [+Phase 4]
  graphError: null,     // banner message when a graph fetch fails [+Phase 9]
  globalError: null,    // message for the auto-dismissing toast   [+Phase 9]

  // Pipeline state
  jobId: null,
  jobStatus: null,      // 'pending' | 'ingesting' | 'extracting' | 'synthesizing' | 'gap_finding' | 'done' | 'failed'
  jobProgress: 0,
  jobError: null,       // error_message shown when jobStatus === 'failed'  [+Phase 5]

  // Query state
  queryInput: '',
  queryResult: null,    // {question, answer, supporting_edges, cypher_used, response_time_ms}
  queryLoading: false,
  queryError: null,     // message shown in QueryInterface (incl. 400 "could not interpret")  [+Phase 7/9]

  // Actions
  setNodes, setEdges, setGaps,
  selectNode, selectEdge, clearSelection,
  toggleFilter,
  setHoveredNode,        // [+Phase 4]
  setJob, updateJobStatus,  // updateJobStatus(status, progress, error?)
  setGraphError,         // [+Phase 9]
  setGlobalError, clearGlobalError,  // [+Phase 9]
  setQueryInput, setQueryResult, setQueryLoading, setQueryError, clearQuery
}
```


## Mock vs Real API

All calls go through `src/api/client.js`. During development without a backend, set
`VITE_USE_MOCK_API=true` in `frontend/.env`; `client.js` then returns the hardcoded
datasets from `src/api/mock.js`. On integration day set it to `false` to hit the
live backend at `VITE_API_BASE_URL` (default `http://localhost:8000`).

Mock datasets in `src/api/mock.js` (ids kept consistent across all of them):
- `graphNodes` → `GET /graph/nodes` (5 paper nodes)
- `graphEdges` → `GET /graph/edges` (3 edges, one `CONTRADICTS`)
- `graphGaps` → `GET /graph/gaps` (1 gap)
- `getPipelineStatus(id)` → `GET /pipeline/status/{id}` (done, progress 100)
- `nlQueryResponse` → `POST /query/natural-language`
- `demoTopics` → `GET /demo/topics` (3 topics)

## Color Reference (spec §10.2)

### Node colors
| Label   | Hex       |
|---------|-----------|
| Paper   | `#4A90E2` |
| Author  | `#7ED321` |
| Method  | `#F5A623` |
| Dataset | `#9B59B6` |
| Claim   | `#E74C3C` |
| Gap     | `#FF6B6B` |

### Edge colors
| Type                | Hex       |
|---------------------|-----------|
| CONTRADICTS         | `#E74C3C` |
| EXTENDS             | `#27AE60` |
| REPLICATES          | `#3498DB` |
| REPLICATES_FAILED   | `#E67E22` |
| CHALLENGES          | `#F39C12` |
| CITES               | `#95A5A6` |
| IMPLEMENTS          | `#1ABC9C` |
| DISAGREES_ON_SCOPE  | `#8E44AD` |

### Gap colors (Phase 7)
| gap_type               | Hex       |
|------------------------|-----------|
| unresolved_contradiction | `#E74C3C` |
| stale_claim            | `#E67E22` |
| low_density            | `#F1C40F` |
| bridge_opportunity     | `#3498DB` |

Defined once in `src/constants/colors.js` and imported by `GraphCanvas` (Phase 4).
