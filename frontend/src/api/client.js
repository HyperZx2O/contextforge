import axios from 'axios';
import * as mock from './mock.js';

// Toggle between hardcoded mock data and the real backend.
// Set VITE_USE_MOCK_API=true in .env during development without a backend.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const _apiKey = import.meta.env.VITE_API_KEY;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: Object.assign(
    { 'Content-Type': 'application/json' },
    _apiKey ? { 'X-API-Key': _apiKey } : {},
  ),
});

// Retries a function on 5xx errors with exponential backoff.
async function withRetry(fn, retries = 2, delay = 800) {
  try {
    return await fn();
  } catch (err) {
    const status = err.response?.status;
    if (retries > 0 && status >= 500) {
      await new Promise((r) => setTimeout(r, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

// Typed error thrown by every real API call on failure, so the UI can
// branch on `code`/`status` (e.g. 400 → "could not interpret").
export class APIError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
  }
}

// ---- Graph routes -------------------------------------------------------
export async function getGraphNodes(params = {}) {
  if (USE_MOCK) return mock.graphNodes;
  try {
    const res = await withRetry(() => api.get('/graph/nodes', { params }));
    return res.data;
  } catch (err) {
    throw new APIError('GRAPH_FETCH_FAILED', err.response?.status, err.message);
  }
}

export async function getGraphEdges(params = {}) {
  if (USE_MOCK) return mock.graphEdges;
  try {
    const res = await withRetry(() => api.get('/graph/edges', { params }));
    return res.data;
  } catch (err) {
    throw new APIError('EDGE_FETCH_FAILED', err.response?.status, err.message);
  }
}

export async function getGraphGaps() {
  if (USE_MOCK) return mock.graphGaps;
  try {
    const res = await withRetry(() => api.get('/graph/gaps'));
    return res.data;
  } catch (err) {
    throw new APIError('GAP_FETCH_FAILED', err.response?.status, err.message);
  }
}

// ---- Pipeline routes ----------------------------------------------------
export async function getPipelineStatus(jobId) {
  if (USE_MOCK) return mock.getPipelineStatus(jobId);
  try {
    const res = await withRetry(() => api.get(`/pipeline/status/${jobId}`));
    return res.data;
  } catch (err) {
    throw new APIError('PIPELINE_STATUS_FAILED', err.response?.status, err.message);
  }
}

export async function runPipeline(body) {
  if (USE_MOCK) {
    const jobId = '550e8400-e29b-41d4-a716-446655440000';
    mock.resetPipelineState(jobId);
    return {
      job_id: jobId,
      status: 'pending',
      message: 'Pipeline started. Poll /pipeline/status/{job_id} for updates.',
    };
  }
  try {
    const res = await withRetry(() => api.post('/pipeline/run', body));
    return res.data;
  } catch (err) {
    throw new APIError('PIPELINE_RUN_FAILED', err.response?.status, err.message);
  }
}

// ---- Query routes -------------------------------------------------------
export async function postNLQuery(body) {
  if (USE_MOCK) return mock.nlQueryResponse;
  try {
    const res = await withRetry(() => api.post('/query/natural-language', body));
    return res.data;
  } catch (err) {
    throw new APIError('NL_QUERY_FAILED', err.response?.status, err.message);
  }
}

// ---- Demo routes --------------------------------------------------------
export async function getDemoTopics() {
  if (USE_MOCK) return mock.demoTopics;
  try {
    const res = await withRetry(() => api.get('/demo/topics'));
    return res.data;
  } catch (err) {
    throw new APIError('DEMO_TOPICS_FAILED', err.response?.status, err.message);
  }
}

export async function loadDemoTopic(topicId) {
  if (USE_MOCK) {
    return {
      topic_id: topicId,
      loaded: true,
      papers_loaded: 94,
      edges_loaded: 312,
      gaps_loaded: 7,
    };
  }
  try {
    const res = await withRetry(() => api.post(`/demo/load/${topicId}`));
    return res.data;
  } catch (err) {
    throw new APIError('DEMO_LOAD_FAILED', err.response?.status, err.message);
  }
}

export default api;

