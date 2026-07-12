import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import NodeTooltip from '../components/NodeTooltip.jsx';

describe('NodeTooltip (Phase 4)', () => {
  beforeEach(() => {
    useGraphStore.setState({
      hoveredNode: null,
      nodes: [
        {
          id: '2401.12345',
          label: 'Paper',
          properties: {
            title: 'RAG vs Long Context',
            publish_date: '2024-01-15',
            citation_count: 42,
          },
        },
      ],
    });
  });

  it('renders nothing when no node is hovered', () => {
    useGraphStore.setState({ hoveredNode: null });
    const { container } = render(<NodeTooltip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows title, publish date, and citation count for the hovered node', () => {
    useGraphStore.setState({ hoveredNode: '2401.12345' });
    render(<NodeTooltip />);
    expect(screen.getByTestId('node-tooltip')).toHaveTextContent('RAG vs Long Context');
    expect(screen.getByTestId('node-tooltip')).toHaveTextContent('2024-01-15');
    expect(screen.getByTestId('node-tooltip')).toHaveTextContent('42');
  });
});
