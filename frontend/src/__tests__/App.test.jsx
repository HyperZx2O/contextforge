import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import * as mock from '../api/mock.js';
import App from '../App.jsx';

// GraphCanvas now imports react-force-graph-2d, which needs a canvas context and
// cannot render under jsdom — mock it for the App-level smoke test.
vi.mock('react-force-graph-2d', async () => ({
  default: (await import('../test/forceGraphMock.jsx')).default,
}));

describe('App (Phase 4 scaffold)', () => {
  beforeEach(() => {
    useGraphStore.setState({
      nodes: [{ id: '2401.12345', label: 'Paper', properties: { title: 't' } }],
      edges: [],
      gaps: [],
      hoveredNode: '2401.12345',
    });
  });

  it('mounts the graph canvas and all stub components', async () => {
    render(<App route={{ page: 'app' }} />);
    expect(await screen.findByTestId('force-graph')).toBeInTheDocument();
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('node-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('edge-inspector')).toHaveTextContent('Edge Inspector');
    expect(screen.getByTestId('pipeline-status')).toHaveTextContent('Pipeline');
    expect(screen.getByTestId('filter-panel')).toHaveTextContent('Filters');
    expect(screen.getByTestId('gap-panel')).toHaveTextContent('Gaps');
    expect(screen.getByTestId('query-interface')).toHaveTextContent('Query');
  });

  it('renders the app shell and header', async () => {
    render(<App route={{ page: 'app' }} />);
    await waitFor(() =>
      expect(useGraphStore.getState().nodes).toHaveLength(mock.graphNodes.nodes.length),
    );
    expect(screen.getByText('ContextForge')).toBeInTheDocument();
  });

  it('populates the store from mock data on mount', async () => {
    render(<App route={{ page: 'app' }} />);
    await waitFor(() => {
      expect(useGraphStore.getState().nodes).toHaveLength(mock.graphNodes.nodes.length);
      expect(useGraphStore.getState().edges).toHaveLength(mock.graphEdges.edges.length);
    });
  });
});
