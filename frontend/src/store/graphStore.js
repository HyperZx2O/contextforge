import { create } from 'zustand';

// Unified store for all graph state. New code should import this store directly.
const useGraphStore = create((set, get) => ({
  // Graph data
  nodes: [],
  edges: [],
  gaps: [],
  loading: true,

  // Errors
  graphError: null,
  globalError: null,

  // UI state
  selectedNode: null,
  selectedEdge: null,
  activeFilters: [],
  hoveredNode: null,
  searchQuery: '',
  matchingNodeIds: new Set(),
  viewMode: 'graph',

  // Pipeline state
  jobId: null,
  jobStatus: null,
  jobProgress: 0,
  jobError: null,
  demoLoading: false,

  // Saved run state (for versioning)
  selectedRun: null,
  setSelectedRun: (run) => set({ selectedRun: run }),

  // Query state
  queryInput: '',
  queryResult: null,
  queryLoading: false,
  queryError: null,

  // Actions
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setGaps: (gaps) => set({ gaps }),
  setGraphError: (error) => set({ graphError: error }),
  setGlobalError: (error) => set({ globalError: error }),
  clearGlobalError: () => set({ globalError: null }),
  selectNode: (id) => set({ selectedNode: id, selectedEdge: null }),
  selectEdge: (edge) => set({ selectedEdge: edge, selectedNode: null }),
  clearSelection: () => set({ selectedNode: null, selectedEdge: null }),
  setSearchQuery: (query) => {
    const q = query.toLowerCase();
    const matching = q
      ? new Set(
          get().nodes
            .filter((n) => {
              const title = (n.properties?.title || '').toLowerCase();
              const label = (n.label || '').toLowerCase();
              const authors = (n.properties?.authors || [])
                .map((a) => (typeof a === 'string' ? a : a?.name || '').toLowerCase())
                .join(' ');
              return title.includes(q) || label.includes(q) || authors.includes(q);
            })
            .map((n) => n.id),
        )
      : new Set();
    set({ searchQuery: query, matchingNodeIds: matching });
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveFilters: (filters) => set({ activeFilters: filters }),
  toggleFilter: (type) =>
    set((s) => ({
      activeFilters: s.activeFilters.includes(type)
        ? s.activeFilters.filter((t) => t !== type)
        : [...s.activeFilters, type],
    })),
  setHoveredNode: (id) => set({ hoveredNode: id }),
  setJob: (jobId) => set({ jobId, jobStatus: 'pending', jobProgress: 0, jobError: null }),
  setDemoLoading: (loading) => set({ demoLoading: loading }),
  updateJobStatus: (status, progress, error = null) =>
    set({ jobStatus: status, jobProgress: progress, jobError: error }),
  setQueryInput: (input) => set({ queryInput: input }),
  setQueryResult: (result) => set({ queryResult: result }),
  setQueryLoading: (loading) => set({ queryLoading: loading }),
  setQueryError: (error) => set({ queryError: error }),
  clearQuery: () => set({ queryInput: '', queryResult: null, queryError: null }),
}));

export default useGraphStore;
