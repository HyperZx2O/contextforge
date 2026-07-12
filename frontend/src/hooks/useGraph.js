import { useEffect } from 'react';
import { getGraphNodes, getGraphEdges, getGraphGaps } from '../api/client.js';
import useGraphStore from '../store/graphStore.js';

// Fetches graph data (nodes, edges, gaps) from the API (mock or real,
// depending on VITE_USE_MOCK_API) and populates the Zustand store.
// Module-level and reusable so pipeline/demo flows can refetch after a job
// completes. On success it clears `graphError`; on failure it sets
// `graphError` (the GraphCanvas renders an error banner) instead of throwing.
//
// @returns {Promise<void>} Resolves when the store has been updated (or errored).
export async function fetchGraphData() {
  const { setNodes, setEdges, setGaps, setGraphError } = useGraphStore.getState();
  useGraphStore.setState({ loading: true });
  try {
    const [nodes, edges, gaps] = await Promise.all([
      getGraphNodes(),
      getGraphEdges(),
      getGraphGaps(),
    ]);
    setNodes(nodes.nodes);
    setEdges(edges.edges);
    setGaps(gaps.gaps);
    setGraphError(null);
  } catch (err) {
    setGraphError(err?.message || 'Failed to load graph');
    console.error('[useGraph] failed to load graph data', err);
  } finally {
    useGraphStore.setState({ loading: false });
  }
}

// Mounts the graph data fetch on first render.
//
// @returns {void} No return value; side effect is populating the store via
//   `fetchGraphData()`. Safe against unmount via a cancelled flag (errors are
//   only logged if the component is still mounted).
export function useGraph() {
  useEffect(() => {
    let cancelled = false;

    fetchGraphData().catch((err) => {
      if (!cancelled) console.error('[useGraph] failed to load graph data', err);
    });

    return () => {
      cancelled = true;
    };
  }, []);
}
