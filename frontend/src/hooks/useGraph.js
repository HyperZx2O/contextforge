import { useEffect } from 'react';
import { getGraphNodes, getGraphEdges, getGraphGaps } from '../api/client.js';
import { buildDemoGraph, synthesizeGapEdges } from '../demoData.js';
import useGraphStore from '../store/graphStore.js';

// Fetches graph data from the API and populates the store.
// Module-level and reusable so the pipeline flow can refetch after a job
// completes. On success it clears `graphError`; on failure it sets
// `graphError` (GraphCanvas renders an error banner) instead of throwing.
//
// Demos skip the network entirely — see loadDemoIntoStore.

// @param {boolean} [cancelled] - Optional flag to check before writing to store.
export async function fetchGraphData(isCancelled) {
  const { setNodes, setEdges, setGaps, setGraphError } = useGraphStore.getState();
  useGraphStore.setState({ loading: true });
  try {
    const [nodes, edges, gaps] = await Promise.all([
      getGraphNodes(),
      getGraphEdges(),
      getGraphGaps(),
    ]);

    if (isCancelled && isCancelled()) return;

    setNodes(nodes.nodes);
    setEdges([...edges.edges, ...synthesizeGapEdges(nodes.nodes, gaps.gaps)]);
    setGaps(gaps.gaps);
    setGraphError(null);
  } catch (err) {
    if (isCancelled && isCancelled()) return;
    setGraphError(err?.message || 'Failed to load graph');
    console.error('[useGraph] failed to load graph data', err);
  } finally {
    if (!(isCancelled && isCancelled())) useGraphStore.setState({ loading: false });
  }
}

/**
 * Hydrate the store from a bundled demo. No services, no network.
 *
 * Selection, filters and search are reset because the old behaviour
 * relied on Neo4j's DETACH DELETE to clear the graph — without that, a
 * swap could leave you inspecting a node that no longer exists.
 */
export function loadDemoIntoStore(topicId) {
  const built = buildDemoGraph(topicId);
  const { setNodes, setEdges, setGaps, setGraphError, clearSelection, setSearchQuery } =
    useGraphStore.getState();

  if (!built) {
    setGraphError(`Unknown demo: ${topicId}`);
    return false;
  }

  setNodes(built.nodes);
  setEdges(built.edges);
  setGaps(built.gaps);
  clearSelection();
  setSearchQuery('');
  useGraphStore.setState({ activeFilters: [], loading: false, demoLoading: false, graphError: null });
  return true;
}

// Mounts the graph data fetch on first render.
//
// @param {object} [opts]
// @param {boolean} [opts.skip] - Skip the fetch. Used when a demo is
//   being loaded from the bundle, so a dead backend cannot race the
//   hydration and overwrite it with an error.
export function useGraph({ skip } = {}) {
  useEffect(() => {
    if (skip) return undefined;
    const controller = new AbortController();

    fetchGraphData(() => controller.signal.aborted).catch((err) => {
      if (!controller.signal.aborted) console.error('[useGraph] failed to load graph data', err);
    });

    return () => {
      controller.abort();
    };
  }, [skip]);
}