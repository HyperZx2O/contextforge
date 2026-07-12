import { create } from 'zustand';

// State shape per spec.md §10.1. Actions are trivial setters for now;
// Phase 3 wires them to the mock/real API via hooks.
const useGraphStore = create((set) => ({
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

  // Pipeline state
  jobId: null,
  jobStatus: null,
  jobProgress: 0,
  jobError: null,
  demoLoading: false,

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
