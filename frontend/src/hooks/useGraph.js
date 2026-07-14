import { useEffect } from 'react';
import { getGraphNodes, getGraphEdges, getGraphGaps } from '../api/client.js';
import useGraphStore from '../store/graphStore.js';

// Fetches graph data (nodes, edges, gaps) from the API (mock or real,
// depending on VITE_USE_MOCK_API) and populates the Zustand store.
// Module-level and reusable so pipeline/demo flows can refetch after a job
// completes. On success it clears `graphError`; on failure it sets
// `graphError` (the GraphCanvas renders an error banner) instead of throwing.
//
// Creates virtual INVOLVES edges from Gap nodes to their affected_nodes
// so gaps stay connected to relevant papers in the force layout.
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

    // Create virtual edges from Gap nodes to their affected_nodes
    const gapEdges = [];
    for (const gap of gaps.gaps) {
      if (gap.affected_nodes && gap.affected_nodes.length > 0) {
        for (const affectedId of gap.affected_nodes) {
          // Only add edge if both nodes exist
          const gapNodeExists = nodes.nodes.some(n => n.id === gap.id);
          const targetNodeExists = nodes.nodes.some(n => n.id === affectedId);
          if (gapNodeExists && targetNodeExists) {
            gapEdges.push({
              source: gap.id,
              target: affectedId,
              type: 'INVOLVES',
              properties: {
                confidence: gap.severity || 1.0,
                evidence_quote: gap.description || '',
                is_gap_edge: true,
              },
            });
          }
        }
      }
    }

    setNodes(nodes.nodes);
    setEdges([...edges.edges, ...gapEdges]);
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
