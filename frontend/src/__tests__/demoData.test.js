import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildDemoGraph, DEMO_TOPICS } from '../demoData.js';
import { loadDemoIntoStore } from '../hooks/useGraph.js';
import useGraphStore from '../store/graphStore.js';

// The point of bundling the demos: they work with no services. The
// fetch stub below rejects for every call, so anything that reaches the
// network in these tests is a bug.
describe('demo graphs without services', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network is down'));
    useGraphStore.setState({
      nodes: [],
      edges: [],
      gaps: [],
      loading: true,
      graphError: 'stale error',
      selectedNode: 'gone',
      selectedEdge: { id: 'gone' },
      searchQuery: 'x',
      matchingNodeIds: new Set(['gone']),
      activeFilters: ['CONTRADICTS'],
      demoLoading: true,
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it.each(DEMO_TOPICS.map((t) => t.id))('%s builds papers, gaps and virtual edges', (id) => {
    const built = buildDemoGraph(id);
    const topic = DEMO_TOPICS.find((t) => t.id === id);
    const papers = built.nodes.filter((n) => n.label === 'Paper');
    const gaps = built.nodes.filter((n) => n.label === 'Gap');

    expect(papers).toHaveLength(topic.paper_count);
    expect(gaps).toHaveLength(built.gaps.length);
    // No paper-to-paper edges offline: INVOLVES is the only kind the
    // client synthesises. Typed edges come from the file.
    expect(built.edges.every((e) => e.type === 'INVOLVES')).toBe(true);
    expect(built.edges.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gap node ids match the gap ids, so INVOLVES edges resolve', () => {
    const built = buildDemoGraph('rag_2024');
    const gapNodeIds = built.nodes.filter((n) => n.label === 'Gap').map((n) => n.id);
    const gapIds = built.gaps.map((g) => g.id);
    expect(gapNodeIds).toEqual(gapIds);

    const nodeIds = new Set(built.nodes.map((n) => n.id));
    for (const e of built.edges) {
      expect(nodeIds.has(e.source)).toBe(true);
      expect(nodeIds.has(e.target)).toBe(true);
    }
  });

  it('gap ids cannot collide with arxiv ids', () => {
    const built = buildDemoGraph('rag_2024');
    const ids = built.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => !id.startsWith('gap:') || id.includes(':rag_2024'))).toBe(true);
  });

  it('populates the store with no network call', () => {
    expect(loadDemoIntoStore('llms_2024')).toBe(true);
    const s = useGraphStore.getState();

    expect(s.nodes.length).toBeGreaterThan(0);
    expect(s.edges.length).toBeGreaterThan(0);
    expect(s.gaps.length).toBeGreaterThan(0);
    expect(s.graphError).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.demoLoading).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resets stale selection, filters and search on swap', () => {
    useGraphStore.getState().selectNode('some-node');
    loadDemoIntoStore('diffusion_2024');
    const s = useGraphStore.getState();

    expect(s.selectedNode).toBeNull();
    expect(s.selectedEdge).toBeNull();
    expect(s.searchQuery).toBe('');
    expect(s.matchingNodeIds.size).toBe(0);
    expect(s.activeFilters).toEqual([]);
  });

  it('reports an unknown topic rather than throwing', () => {
    expect(loadDemoIntoStore('nope')).toBe(false);
    expect(useGraphStore.getState().graphError).toMatch(/Unknown demo/);
  });
});