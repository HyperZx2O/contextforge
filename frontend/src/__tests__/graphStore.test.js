import { describe, it, expect, beforeEach } from 'vitest';
import useGraphStore from '../store/graphStore.js';

const sampleEdge = {
  source: '2401.12345',
  target: '2312.09876',
  type: 'CONTRADICTS',
  properties: { confidence: 0.91 },
};

beforeEach(() => {
  useGraphStore.setState({
    nodes: [],
    edges: [],
    gaps: [],
    selectedNode: null,
    selectedEdge: null,
    activeFilters: [],
    hoveredNode: null,
    jobId: null,
    jobStatus: null,
    jobProgress: 0,
    queryInput: '',
    queryResult: null,
    queryLoading: false,
  });
});

describe('graphStore actions (spec §10.1)', () => {
  it('toggleFilter adds then removes a type', () => {
    const { toggleFilter } = useGraphStore.getState();
    toggleFilter('CONTRADICTS');
    expect(useGraphStore.getState().activeFilters).toContain('CONTRADICTS');
    toggleFilter('CONTRADICTS');
    expect(useGraphStore.getState().activeFilters).not.toContain('CONTRADICTS');
  });

  it('selectNode sets selectedNode and clears selectedEdge', () => {
    useGraphStore.getState().selectEdge(sampleEdge);
    useGraphStore.getState().selectNode('2401.12345');
    const s = useGraphStore.getState();
    expect(s.selectedNode).toBe('2401.12345');
    expect(s.selectedEdge).toBeNull();
  });

  it('selectEdge sets selectedEdge and clears selectedNode', () => {
    useGraphStore.getState().selectNode('2401.12345');
    useGraphStore.getState().selectEdge(sampleEdge);
    const s = useGraphStore.getState();
    expect(s.selectedEdge).toBe(sampleEdge);
    expect(s.selectedNode).toBeNull();
  });

  it('clearSelection resets both selections', () => {
    useGraphStore.getState().selectNode('2401.12345');
    useGraphStore.getState().selectEdge(sampleEdge);
    useGraphStore.getState().clearSelection();
    const s = useGraphStore.getState();
    expect(s.selectedNode).toBeNull();
    expect(s.selectedEdge).toBeNull();
  });

  it('setNodes/setEdges/setGaps populate graph data', () => {
    useGraphStore.getState().setNodes([{ id: 'a' }]);
    useGraphStore.getState().setEdges([sampleEdge]);
    useGraphStore.getState().setGaps([{ id: 'g' }]);
    const s = useGraphStore.getState();
    expect(s.nodes).toHaveLength(1);
    expect(s.edges).toHaveLength(1);
    expect(s.gaps).toHaveLength(1);
  });
});
