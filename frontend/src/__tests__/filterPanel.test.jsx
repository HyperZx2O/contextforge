import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import { EDGE_COLORS } from '../constants/colors.js';
import * as mock from '../api/mock.js';
import FilterPanel from '../components/FilterPanel.jsx';

beforeEach(() => {
  useGraphStore.setState({ edges: mock.graphEdges.edges, activeFilters: [] });
  vi.clearAllMocks();
});

describe('FilterPanel', () => {
  it('renders one checkbox per relationship type (8)', () => {
    render(<FilterPanel />);
    Object.keys(EDGE_COLORS).forEach((type) => {
      expect(screen.getByTestId(`filter-${type}`)).toBeInTheDocument();
    });
  });

  it('shows the edge count per type from the store', () => {
    render(<FilterPanel />);
    const countOf = (type) =>
      String(mock.graphEdges.edges.filter((e) => e.type === type).length);
    expect(screen.getByTestId('filter-count-CONTRADICTS')).toHaveTextContent(
      countOf('CONTRADICTS'),
    );
    expect(screen.getByTestId('filter-count-CITES')).toHaveTextContent(countOf('CITES'));
  });

  it('toggles a filter when its checkbox is clicked', () => {
    const spy = vi.spyOn(useGraphStore.getState(), 'toggleFilter');
    render(<FilterPanel />);
    fireEvent.click(screen.getByTestId('filter-CONTRADICTS'));
    expect(spy).toHaveBeenCalledWith('CONTRADICTS');
    spy.mockRestore();
  });

  it('all checkboxes are checked by default (no active filters)', () => {
    render(<FilterPanel />);
    expect(screen.getByTestId('filter-EXTENDS')).toBeChecked();
    expect(screen.getByTestId('filter-CITES')).toBeChecked();
  });
});
