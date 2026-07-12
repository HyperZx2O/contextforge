import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import * as mock from '../api/mock.js';
import NodeListView from '../components/NodeListView.jsx';

beforeEach(() => {
  useGraphStore.setState({
    nodes: mock.graphNodes.nodes,
    edges: mock.graphEdges.edges,
    selectedNode: null,
  });
});

describe('NodeListView', () => {
  it('renders nothing when there are no nodes', () => {
    useGraphStore.setState({ nodes: [] });
    const { container } = render(<NodeListView />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the panel with a toggle button', () => {
    render(<NodeListView />);
    expect(screen.getByText('Nodes')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle node list')).toBeInTheDocument();
  });

  it('expands to show node list when toggled', () => {
    render(<NodeListView />);
    fireEvent.click(screen.getByLabelText('Toggle node list'));
    expect(screen.getByRole('listbox', { name: 'Graph nodes' })).toBeInTheDocument();
  });

  it('selects a node when clicked', () => {
    render(<NodeListView />);
    fireEvent.click(screen.getByLabelText('Toggle node list'));
    const firstNode = mock.graphNodes.nodes[0];
    const label = firstNode.properties?.title || firstNode.id;
    fireEvent.click(screen.getByText(label));
    expect(useGraphStore.getState().selectedNode).toBe(firstNode.id);
  });

  it('filters nodes by search input', () => {
    render(<NodeListView />);
    fireEvent.click(screen.getByLabelText('Toggle node list'));
    const input = screen.getByLabelText('Filter nodes');
    fireEvent.change(input, { target: { value: 'RAG' } });
    const items = screen.getAllByRole('option');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveTextContent('RAG');
  });
});
