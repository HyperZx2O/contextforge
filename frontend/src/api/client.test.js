import { describe, it, expect, vi, beforeAll } from 'vitest';

// Force the REAL (non-mock) branch of client.js by stubbing the env flag
// before the module is imported. Vitest's vite.config.js injects
// VITE_USE_MOCK_API='true' for the component suite, so we override it here.
const get = vi.fn();
const post = vi.fn();

vi.mock('axios', () => ({
  default: { create: () => ({ get, post }) },
  create: () => ({ get, post }),
}));

let client;

beforeAll(async () => {
  vi.stubEnv('VITE_USE_MOCK_API', 'false');
  client = await import('../api/client.js');
});

describe('client.js (real API mode)', () => {
  it('getGraphNodes issues GET /graph/nodes', async () => {
    get.mockResolvedValueOnce({ data: { nodes: [] } });
    const res = await client.getGraphNodes();
    expect(get).toHaveBeenCalledWith('/graph/nodes', { params: {} });
    expect(res).toEqual({ nodes: [] });
  });

  it('getGraphEdges issues GET /graph/edges', async () => {
    get.mockResolvedValueOnce({ data: { edges: [] } });
    await client.getGraphEdges();
    expect(get).toHaveBeenCalledWith('/graph/edges', { params: {} });
  });

  it('getGraphGaps issues GET /graph/gaps', async () => {
    get.mockResolvedValueOnce({ data: { gaps: [] } });
    await client.getGraphGaps();
    expect(get).toHaveBeenCalledWith('/graph/gaps');
  });

  it('getPipelineStatus issues GET /pipeline/status/{jobId}', async () => {
    get.mockResolvedValueOnce({ data: { status: 'done' } });
    await client.getPipelineStatus('job-9');
    expect(get).toHaveBeenCalledWith('/pipeline/status/job-9');
  });

  it('runPipeline issues POST /pipeline/run with the body', async () => {
    post.mockResolvedValueOnce({ data: { job_id: 'job-1' } });
    const body = { query: 'RAG' };
    const res = await client.runPipeline(body);
    expect(post).toHaveBeenCalledWith('/pipeline/run', body);
    expect(res).toEqual({ job_id: 'job-1' });
  });

  it('postNLQuery issues POST /query/natural-language with the body', async () => {
    post.mockResolvedValueOnce({ data: { answer: 'x' } });
    const body = { question: 'q', context_node_id: null };
    await client.postNLQuery(body);
    expect(post).toHaveBeenCalledWith('/query/natural-language', body);
  });

  it('getDemoTopics issues GET /demo/topics', async () => {
    get.mockResolvedValueOnce({ data: { topics: [] } });
    await client.getDemoTopics();
    expect(get).toHaveBeenCalledWith('/demo/topics');
  });

  it('loadDemoTopic issues POST /demo/load/{topicId}', async () => {
    post.mockResolvedValueOnce({ data: { loaded: true } });
    await client.loadDemoTopic('rag_2024');
    expect(post).toHaveBeenCalledWith('/demo/load/rag_2024');
  });

  it('throws a typed APIError on network failure (graph)', async () => {
    const err = Object.assign(new Error('network down'), { response: { status: 500 } });
    get.mockRejectedValue(err); // always reject so all retry attempts fail
    await expect(client.getGraphNodes()).rejects.toMatchObject({
      name: 'APIError',
      code: 'GRAPH_FETCH_FAILED',
      status: 500,
      message: 'network down',
    });
  });

  it('throws a typed APIError on network failure (pipeline run)', async () => {
    post.mockRejectedValue(Object.assign(new Error('bad'), { response: { status: 502 } }));
    await expect(client.runPipeline({ query: 'x' })).rejects.toMatchObject({
      name: 'APIError',
      code: 'PIPELINE_RUN_FAILED',
      status: 502,
    });
  });
});
