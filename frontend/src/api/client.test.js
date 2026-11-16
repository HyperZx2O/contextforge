import { describe, it, expect, vi, beforeAll } from 'vitest';

let client;

beforeAll(async () => {
  vi.stubEnv('VITE_USE_MOCK_API', 'false');
  vi.stubGlobal('fetch', vi.fn());
  client = await import('../api/client.js');
});

describe('client.js (real API mode)', () => {
  it('getGraphNodes issues GET /graph/nodes', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ nodes: [] }) });
    const res = await client.getGraphNodes({ limit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/graph/nodes?limit=10'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(res).toEqual({ nodes: [] });
  });

  it('getGraphEdges issues GET /graph/edges', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ edges: [] }) });
    await client.getGraphEdges();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/graph/edges'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getGraphGaps issues GET /graph/gaps', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ gaps: [] }) });
    await client.getGraphGaps();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/graph/gaps'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getPipelineStatus issues GET /pipeline/status/{jobId}', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'done' }) });
    await client.getPipelineStatus('job-9');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pipeline/status/job-9'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('runPipeline issues POST /pipeline/run with the body', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ job_id: 'job-1' }) });
    const body = { query: 'RAG' };
    const res = await client.runPipeline(body);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pipeline/run'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
    expect(res).toEqual({ job_id: 'job-1' });
  });

  it('postNLQuery issues POST /query/natural-language with the body', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ answer: 'x' }) });
    const body = { question: 'q', context_node_id: null };
    await client.postNLQuery(body);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/query/natural-language'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('getDemoTopics issues GET /demo/topics', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ topics: [] }) });
    await client.getDemoTopics();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/demo/topics'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loadDemoTopic issues POST /demo/load/{topicId}', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ loaded: true }) });
    await client.loadDemoTopic('rag_2024');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/demo/load/rag_2024'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws a typed APIError on network failure (graph)', async () => {
    fetch.mockRejectedValue(new Error('network down'));
    await expect(client.getGraphNodes()).rejects.toMatchObject({
      name: 'APIError',
      code: 'GRAPH_FETCH_FAILED',
    });
  });

  it('throws a typed APIError on 502 (pipeline run)', async () => {
    fetch.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' });
    await expect(client.runPipeline({ query: 'x' })).rejects.toMatchObject({
      name: 'APIError',
      code: 'PIPELINE_RUN_FAILED',
      status: 502,
    });
  });
});
