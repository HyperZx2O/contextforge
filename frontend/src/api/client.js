// Shared Axios instance pointed at the FastAPI backend.
//
// ⚠️  SHARED FILE — base URL config used by every hook/component.
// Add new endpoint wrappers in feature-specific files (hooks/), not here.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Basic response passthrough + centralized error logging.
// Individual hooks (usePipeline, useGraph, useQuery) handle
// user-facing error states themselves.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API error]', error?.response?.status, error?.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default client;
