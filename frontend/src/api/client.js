import * as mock from './mock.js';
import useAuthStore from '../store/authStore.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

export class APIError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = status;
  }
}

// The backend reports errors as {detail: string} or {detail: {code, message}}.
async function readErrorDetail(res) {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object') {
      return detail.message || detail.code || res.statusText;
    }
  } catch {
    // Response had no JSON body.
  }
  return res.statusText;
}

async function apiCall(method, path, opts = {}) {
  if (USE_MOCK) {
    return typeof opts.mock === 'function' ? opts.mock() : opts.mock;
  }

  let url = `${BASE_URL}${path}`;
  if (opts.params) url += '?' + new URLSearchParams(opts.params);

  const code = opts.code || 'API_ERROR';
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  const isAuthRoute = path.startsWith('/auth/');
  let refreshed = false;

  for (let attempt = 0, delay = 800; ; attempt++) {
    const token = useAuthStore.getState().accessToken;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(url, { method, headers, credentials: 'include', body });
    } catch {
      if (attempt >= 2) throw new APIError(code, 0, 'Network error');
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
      continue;
    }

    if (res.ok) return res.json();

    // Expired access token: refresh once (the HttpOnly cookie authorises it),
    // then replay the original request with the new token.
    if (res.status === 401 && !isAuthRoute && !refreshed) {
      refreshed = true;
      const session = await useAuthStore.getState().refresh();
      if (session) continue;
      throw new APIError('AUTH_REQUIRED', 401, 'Please log in to continue');
    }

    if (res.status < 500 && res.status !== 429 || attempt >= 2) {
      throw new APIError(code, res.status, await readErrorDetail(res));
    }
    await new Promise(r => setTimeout(r, delay));
    delay *= 2;
  }
}

// ---- Graph routes -------------------------------------------------------
export async function getGraphNodes(params = {}) {
  return apiCall('GET', '/graph/nodes', { params, mock: mock.graphNodes, code: 'GRAPH_FETCH_FAILED' });
}

export async function getGraphEdges(params = {}) {
  return apiCall('GET', '/graph/edges', { params, mock: mock.graphEdges, code: 'EDGE_FETCH_FAILED' });
}

export async function getNodeDetail(nodeId) {
  return apiCall('GET', `/graph/node/${encodeURIComponent(nodeId)}`, { code: 'NODE_FETCH_FAILED' });
}

export async function getGraphGaps() {
  return apiCall('GET', '/graph/gaps', { mock: mock.graphGaps, code: 'GAP_FETCH_FAILED' });
}

// ---- Pipeline routes ----------------------------------------------------
export async function getPipelineStatus(jobId) {
  return apiCall('GET', `/pipeline/status/${jobId}`, {
    mock: () => mock.getPipelineStatus(jobId),
    code: 'PIPELINE_STATUS_FAILED',
  });
}

export async function runPipeline(body) {
  return apiCall('POST', '/pipeline/run', {
    body,
    mock: () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440000';
      mock.resetPipelineState(jobId);
      return {
        job_id: jobId,
        status: 'pending',
        message: 'Pipeline started. Poll /pipeline/status/{job_id} for updates.',
      };
    },
    code: 'PIPELINE_RUN_FAILED',
  });
}

// ---- Query routes -------------------------------------------------------
export async function postNLQuery(body) {
  return apiCall('POST', '/query/natural-language', { body, mock: mock.nlQueryResponse, code: 'NL_QUERY_FAILED' });
}

// ---- Demo routes --------------------------------------------------------
export async function getDemoTopics() {
  return apiCall('GET', '/demo/topics', { mock: mock.demoTopics, code: 'DEMO_TOPICS_FAILED' });
}

export async function loadDemoTopic(topicId) {
  return apiCall('POST', `/demo/load/${topicId}`, {
    mock: { topic_id: topicId, loaded: true, papers_loaded: 94, edges_loaded: 312, gaps_loaded: 7 },
    code: 'DEMO_LOAD_FAILED',
  });
}

// ---- Auth routes --------------------------------------------------------
export async function registerUser(email, password, displayName) {
  return apiCall('POST', '/auth/register', {
    body: { email, password, display_name: displayName },
    code: 'REGISTER_FAILED',
  });
}

export async function loginUser(email, password) {
  return apiCall('POST', '/auth/login', {
    body: { email, password },
    code: 'LOGIN_FAILED',
  });
}

export async function refreshToken() {
  return apiCall('POST', '/auth/refresh', { code: 'REFRESH_FAILED' });
}

export async function logoutUser() {
  return apiCall('POST', '/auth/logout', { code: 'LOGOUT_FAILED' });
}

// ---- Saved runs ---------------------------------------------------------
export async function saveRun(label, isPublic = false) {
  return apiCall('POST', '/runs', {
    body: { label, is_public: isPublic },
    code: 'SAVE_RUN_FAILED',
  });
}

export async function getSavedRuns() {
  return apiCall('GET', '/runs', { code: 'FETCH_RUNS_FAILED' });
}

export async function getSavedRun(runId) {
  return apiCall('GET', `/runs/${runId}`, { code: 'FETCH_RUN_FAILED' });
}

export async function deleteSavedRun(runId) {
  return apiCall('DELETE', `/runs/${runId}`, { code: 'DELETE_RUN_FAILED' });
}

// ---- Bookmarks & Annotations --------------------------------------------
export async function createBookmark(nodeId, edgeSource, edgeTarget, edgeType, note) {
  return apiCall('POST', '/bookmarks', {
    body: { node_id: nodeId, edge_source: edgeSource, edge_target: edgeTarget, edge_type: edgeType, note },
    code: 'BOOKMARK_FAILED',
  });
}

export async function createAnnotation(data) {
  return apiCall('POST', '/annotations', {
    body: data,
    code: 'ANNOTATION_FAILED',
  });
}

// ---- Templates ---------------------------------------------------------
export async function createTemplate({ query, label, yearFrom, yearTo, maxPapers, sources }) {
  return apiCall('POST', '/templates', {
    body: {
      query,
      label,
      year_from: yearFrom,
      year_to: yearTo,
      max_papers: maxPapers,
      sources,
    },
    code: 'TEMPLATE_CREATE_FAILED',
  });
}

export async function listTemplates() {
  return apiCall('GET', '/templates', { code: 'TEMPLATE_LIST_FAILED' });
}

export async function deleteTemplate(templateId) {
  return apiCall('DELETE', `/templates/${templateId}`, { code: 'TEMPLATE_DELETE_FAILED' });
}

// ---- Preferences -------------------------------------------------------
export async function getPreferences() {
  return apiCall('GET', '/preferences', { code: 'PREFERENCES_FETCH_FAILED' });
}

export async function updatePreferences({ viewMode, activeFilters, theme }) {
  return apiCall('PUT', '/preferences', {
    body: { view_mode: viewMode, active_filters: activeFilters, theme },
    code: 'PREFERENCES_UPDATE_FAILED',
  });
}

// ---- Bookmarks & annotations (list/edit) --------------------------------
export async function listBookmarks() {
  return apiCall('GET', '/bookmarks', { code: 'BOOKMARK_LIST_FAILED' });
}

export async function deleteBookmark(bookmarkId) {
  return apiCall('DELETE', `/bookmarks/${bookmarkId}`, { code: 'BOOKMARK_DELETE_FAILED' });
}

export async function listAnnotations(params) {
  return apiCall('GET', '/annotations', { params, code: 'ANNOTATION_LIST_FAILED' });
}

export async function updateAnnotation(annotationId, text) {
  return apiCall('PATCH', `/annotations/${annotationId}`, {
    body: { text },
    code: 'ANNOTATION_UPDATE_FAILED',
  });
}

export async function deleteAnnotation(annotationId) {
  return apiCall('DELETE', `/annotations/${annotationId}`, { code: 'ANNOTATION_DELETE_FAILED' });
}

// ---- Export log ---------------------------------------------------------
export async function logExport(kind, target) {
  return apiCall('POST', '/exports', {
    body: { kind, target },
    code: 'EXPORT_LOG_FAILED',
  });
}

export async function listExports() {
  return apiCall('GET', '/exports', { code: 'EXPORT_LIST_FAILED' });
}

// ---- Graph versions ----------------------------------------------------
export async function createVersion(runId, versionName, filterSettings, layoutState) {
  return apiCall('POST', `/versions/${runId}`, {
    body: { version_name: versionName, filter_settings: filterSettings, layout_state: layoutState },
    code: 'VERSION_CREATE_FAILED',
  });
}

export async function listVersions(runId) {
  return apiCall('GET', `/versions/${runId}`, { code: 'VERSION_LIST_FAILED' });
}

export async function getVersion(runId, versionId) {
  return apiCall('GET', `/versions/${runId}/${versionId}`, { code: 'VERSION_GET_FAILED' });
}

export async function updateVersion(runId, versionId, versionName, filterSettings, layoutState) {
  return apiCall('PATCH', `/versions/${runId}/${versionId}`, {
    body: { version_name: versionName, filter_settings: filterSettings, layout_state: layoutState },
    code: 'VERSION_UPDATE_FAILED',
  });
}

export async function deleteVersion(runId, versionId) {
  return apiCall('DELETE', `/versions/${runId}/${versionId}`, { code: 'VERSION_DELETE_FAILED' });
}