import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import * as mock from '../api/mock.js';
import EdgeInspector from '../components/EdgeInspector.jsx';

const contradictEdge = mock.graphEdges.edges[0]; // CONTRADICTS, confidence 0.91

beforeEach(() => {
  useGraphStore.setState({
    nodes: mock.graphNodes.nodes,
    edges: mock.graphEdges.edges,
    selectedEdge: null,
  });
});

describe('EdgeInspector', () => {
  it('shows a placeholder when no edge is selected', () => {
    render(<EdgeInspector />);
    expect(screen.getByTestId('edge-inspector')).toHaveTextContent(
      'Select an edge to inspect its evidence.',
    );
    expect(screen.queryByTestId('edge-evidence')).not.toBeInTheDocument();
  });

  it('renders evidence, confidence, source/target titles, and dimension for the selected edge', () => {
    useGraphStore.setState({ selectedEdge: contradictEdge });
    render(<EdgeInspector />);

    expect(screen.getByTestId('edge-type')).toHaveTextContent('CONTRADICTS');
    expect(screen.getByTestId('edge-evidence')).toHaveTextContent(
      contradictEdge.properties.evidence_quote,
    );
    expect(screen.getByTestId('edge-confidence')).toHaveTextContent('91%');
    expect(screen.getByTestId('edge-dimension')).toHaveTextContent(
      `Dimension: ${contradictEdge.properties.on_dimension}`,
    );
    // Source/target titles resolve from the nodes array.
    expect(screen.getByTestId('edge-endpoints')).toHaveTextContent(
      'RAG vs Long Context: A Comparison',
    );
    expect(screen.getByTestId('edge-endpoints')).toHaveTextContent(
      'Long-Context Retrieval Under Load',
    );
  });

  it('Close button clears the selection', () => {
    useGraphStore.setState({ selectedEdge: contradictEdge });
    const spy = vi.spyOn(useGraphStore.getState(), 'clearSelection');
    render(<EdgeInspector />);
    fireEvent.click(screen.getByTestId('edge-inspector-close'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
