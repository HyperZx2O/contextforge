import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import * as mock from '../api/mock.js';
import GapPanel from '../components/GapPanel.jsx';

beforeEach(() => {
  useGraphStore.setState({
    nodes: mock.graphNodes.nodes,
    gaps: mock.graphGaps.gaps,
  });
});

describe('GapPanel', () => {
  it('renders a gap with severity bar, description, and affected titles', () => {
    render(<GapPanel />);
    const gap = mock.graphGaps.gaps[0];
    expect(screen.getByTestId('gap-badge')).toHaveTextContent(gap.gap_type);
    expect(screen.getByTestId('gap-severity')).toHaveTextContent(''); // bar is styled, no text
    expect(screen.getByTestId('gap-description')).toHaveTextContent(gap.description.slice(0, 20));
    expect(screen.getByTestId('gap-affected')).toHaveTextContent('RAG vs Long Context');
  });

  it('shows the empty state when there are no gaps', () => {
    useGraphStore.setState({ gaps: [], loading: false });
    render(<GapPanel />);
    expect(screen.getByTestId('gap-empty')).toHaveTextContent(
      'No gaps detected yet. Run the pipeline to analyze a topic.',
    );
    expect(screen.queryByTestId('gap-item')).not.toBeInTheDocument();
  });

  it('sorts gaps by severity, highest first', () => {
    const gaps = [
      { id: 'g1', gap_type: 'low_density', description: 'low', affected_nodes: [], severity: 0.2 },
      { id: 'g2', gap_type: 'bridge_opportunity', description: 'high', affected_nodes: [], severity: 0.9 },
    ];
    useGraphStore.setState({ gaps });
    render(<GapPanel />);

    const items = screen.getAllByTestId('gap-item');
    expect(items[0]).toHaveTextContent('high');
    expect(items[1]).toHaveTextContent('low');
  });
});
