import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';

vi.mock('../api/client.js', () => ({
  runPipeline: vi.fn(async () => ({ job_id: 'job-1', status: 'pending' })),
  getPipelineStatus: vi.fn(),
  getDemoTopics: vi.fn(async () => ({ topics: [] })),
  loadDemoTopic: vi.fn(async () => ({ loaded: true })),
}));

// Replace fetchGraphData with a spy so we can assert the refetch fires without
// pulling in the real network/client path.
vi.mock('../hooks/useGraph.js', async () => {
  const actual = await vi.importActual('../hooks/useGraph.js');
  return { ...actual, fetchGraphData: vi.fn(async () => {}) };
});

import { runPipeline, getPipelineStatus, loadDemoTopic, getDemoTopics } from '../api/client.js';
import { fetchGraphData } from '../hooks/useGraph.js';
import { usePipeline } from '../hooks/usePipeline.js';

function queueStatuses(responses) {
  let i = 0;
  getPipelineStatus.mockImplementation(async () => responses[Math.min(i++, responses.length - 1)]);
}

beforeEach(() => {
  vi.clearAllMocks();
  useGraphStore.setState({ jobId: null, jobStatus: null, jobProgress: 0, jobError: null });
  vi.useFakeTimers();
});

function tick(ms = 2000) {
  return vi.advanceTimersByTimeAsync(ms);
}

describe('usePipeline', () => {
  it('polls through to done and refetches the graph once', async () => {
    queueStatuses([
      { status: 'ingesting', progress: 33, error_message: null },
      { status: 'synthesizing', progress: 66, error_message: null },
      { status: 'done', progress: 100, error_message: null },
    ]);

    const { result, unmount } = renderHook(() => usePipeline());
    await act(async () => {
      await result.current.runPipeline('RAG');
    });

    expect(useGraphStore.getState().jobStatus).toBe('pending');
    expect(getPipelineStatus).not.toHaveBeenCalled();

    await act(async () => {
      await tick(2000);
    });
    expect(useGraphStore.getState().jobStatus).toBe('ingesting');
    expect(useGraphStore.getState().jobProgress).toBe(33);

    await act(async () => {
      await tick(2000);
    });
    expect(useGraphStore.getState().jobStatus).toBe('synthesizing');

    await act(async () => {
      await tick(2000);
    });
    expect(useGraphStore.getState().jobStatus).toBe('done');
    expect(getPipelineStatus).toHaveBeenCalledTimes(3);
    expect(fetchGraphData).toHaveBeenCalledTimes(1);

    // Interval cleared: further ticks must not poll again.
    await act(async () => {
      await tick(4000);
    });
    expect(getPipelineStatus).toHaveBeenCalledTimes(3);

    unmount();
    vi.useRealTimers();
  });

  it('stops polling and stores the error on failed', async () => {
    queueStatuses([{ status: 'failed', progress: 0, error_message: 'exploded' }]);

    const { result, unmount } = renderHook(() => usePipeline());
    await act(async () => {
      await result.current.runPipeline('RAG');
    });
    await act(async () => {
      await tick(2000);
    });

    expect(useGraphStore.getState().jobStatus).toBe('failed');
    expect(useGraphStore.getState().jobError).toBe('exploded');
    expect(fetchGraphData).not.toHaveBeenCalled();

    await act(async () => {
      await tick(4000);
    });
    expect(getPipelineStatus).toHaveBeenCalledTimes(1);

    unmount();
    vi.useRealTimers();
  });

  it('clears the interval on unmount', async () => {
    queueStatuses([
      { status: 'ingesting', progress: 33, error_message: null },
      { status: 'synthesizing', progress: 66, error_message: null },
      { status: 'done', progress: 100, error_message: null },
    ]);

    const { result, unmount } = renderHook(() => usePipeline());
    await act(async () => {
      await result.current.runPipeline('RAG');
    });
    await act(async () => {
      await tick(2000);
    });
    expect(getPipelineStatus).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await tick(4000);
    });
    expect(getPipelineStatus).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  // Demos hydrate from the bundle now, so loadDemo must NOT touch the
  // network — that independence is the whole point of the change.
  it('loadDemo hydrates from the bundle without any network call', async () => {
    const { result } = renderHook(() => usePipeline());
    act(() => {
      result.current.loadDemo('rag_2024');
    });

    expect(loadDemoTopic).not.toHaveBeenCalled();
    expect(fetchGraphData).not.toHaveBeenCalled();

    const s = useGraphStore.getState();
    expect(s.nodes.length).toBeGreaterThan(0);
    expect(s.edges.length).toBeGreaterThan(0);
    expect(s.gaps.length).toBeGreaterThan(0);
    expect(s.demoLoading).toBe(false);
    vi.useRealTimers();
  });

  it('loadDemo surfaces an error for an unknown topic', async () => {
    const { result } = renderHook(() => usePipeline());
    act(() => {
      result.current.loadDemo('nope');
    });
    expect(useGraphStore.getState().globalError).toMatch(/Unknown demo/);
    vi.useRealTimers();
  });

  // The topic list is bundled, so this must not touch the API either.
  it('getDemoTopics serves the bundled list without a network call', async () => {
    const { result } = renderHook(() => usePipeline());
    const res = await result.current.getDemoTopics();
    expect(res.topics.map((t) => t.id)).toEqual(['rag_2024', 'llms_2024', 'diffusion_2024']);
    res.topics.forEach((t) => {
      expect(t.paper_count).toBeGreaterThan(0);
      expect(t.edge_count).toBeGreaterThan(0);
    });
    expect(getDemoTopics).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
