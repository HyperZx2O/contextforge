import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as mock from '../api/mock.js';

// Mock the API client so useGraph pulls from mock.js instead of a network.
vi.mock('../api/client.js', () => ({
  getGraphNodes: vi.fn(async () => mock.graphNodes),
  getGraphEdges: vi.fn(async () => mock.graphEdges),
  getGraphGaps: vi.fn(async () => mock.graphGaps),
}));

import { getGraphNodes, getGraphEdges, getGraphGaps } from '../api/client.js';
import useGraphStore from '../store/graphStore.js';
import { useGraph } from '../hooks/useGraph.js';

function Harness() {
  useGraph();
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  useGraphStore.setState({ nodes: [], edges: [], gaps: [] });
});

describe('useGraph (data flow)', () => {
  it('populates the store from mock data exactly once', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(useGraphStore.getState().nodes).toHaveLength(mock.graphNodes.nodes.length);
    });

    expect(useGraphStore.getState().edges).toHaveLength(mock.graphEdges.edges.length);
    expect(useGraphStore.getState().gaps).toHaveLength(1);

    // Guard against an infinite re-render / refetch loop.
    expect(getGraphNodes).toHaveBeenCalledTimes(1);
    expect(getGraphEdges).toHaveBeenCalledTimes(1);
    expect(getGraphGaps).toHaveBeenCalledTimes(1);
  });

  it('sets graphError when a fetch fails (instead of crashing)', async () => {
    vi.mocked(getGraphNodes).mockRejectedValueOnce(new Error('boom'));
    render(<Harness />);

    await waitFor(() => expect(useGraphStore.getState().graphError).toBe('boom'));
    // Graph data stays empty; the canvas shows a banner rather than blanking.
    expect(useGraphStore.getState().nodes).toHaveLength(0);
  });
});
