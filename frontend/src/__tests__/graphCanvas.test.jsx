import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as mock from '../api/mock.js';
import useGraphStore from '../store/graphStore.js';
import GraphCanvas from '../components/GraphCanvas.jsx';

// Mock the canvas-based graph lib; the real one can't render under jsdom.
vi.mock('react-force-graph-2d', async () => ({
  default: (await import('../test/forceGraphMock.jsx')).default,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useGraphStore.setState({
    nodes: mock.graphNodes.nodes,
    edges: mock.graphEdges.edges,
    activeFilters: [],
    selectedNode: null,
    selectedEdge: null,
    hoveredNode: null,
  });
});

describe('GraphCanvas (Phase 4)', () => {
  it('renders the force graph with sizing and arrow props', () => {
    render(<GraphCanvas />);
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    expect(Number(screen.getByTestId('fg-width').textContent)).toBeGreaterThan(0);
    expect(screen.getByTestId('fg-arrow').textContent).toBe('4');
  });

  it('passes all seeded nodes and edges (unfiltered) into the graph', () => {
    render(<GraphCanvas />);
    expect(screen.getByTestId('fg-linkcount').textContent).toBe(
      String(mock.graphEdges.edges.length),
    );
  });

  it('clicking a node sets selectedNode in the store', () => {
    render(<GraphCanvas />);
    fireEvent.click(screen.getByTestId('fg-node'));
    expect(useGraphStore.getState().selectedNode).toBe(mock.graphNodes.nodes[0].id);
  });

  it('clicking a link sets selectedEdge in the store', () => {
    render(<GraphCanvas />);
    fireEvent.click(screen.getByTestId('fg-link'));
    expect(useGraphStore.getState().selectedEdge).toEqual(mock.graphEdges.edges[0]);
  });

  it('hovering a node sets hoveredNode in the store', () => {
    render(<GraphCanvas />);
    fireEvent.click(screen.getByTestId('fg-hover'));
    expect(useGraphStore.getState().hoveredNode).toBe(mock.graphNodes.nodes[1].id);
  });

  it('filters edges by activeFilters (hidden set)', () => {
    // activeFilters holds HIDDEN types; EXTENDS hidden → remaining edges shown.
    const visible = mock.graphEdges.edges.filter((e) => e.type !== 'EXTENDS').length;
    useGraphStore.setState({ activeFilters: ['EXTENDS'] });
    render(<GraphCanvas />);
    expect(screen.getByTestId('fg-linkcount').textContent).toBe(String(visible));
  });

  it('shows an empty state when there are no nodes', () => {
    useGraphStore.setState({ nodes: [], loading: false });
    render(<GraphCanvas />);
    expect(screen.getByTestId('graph-empty')).toHaveTextContent(
      'Run the pipeline or load a demo to get started',
    );
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument();
  });

  it('shows an error banner when graphError is set', () => {
    useGraphStore.setState({ nodes: [], graphError: 'Failed to load graph' });
    render(<GraphCanvas />);
    expect(screen.getByTestId('graph-error')).toHaveTextContent('Failed to load: Failed to load graph');
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument();
  });
});
