import { useEffect, useRef, useCallback } from 'react';
import { runPipeline, getPipelineStatus } from '../api/client.js';
import { DEMO_TOPICS } from '../demoData.js';
import { fetchGraphData, loadDemoIntoStore } from './useGraph.js';
import useGraphStore from '../store/graphStore.js';

const POLL_INTERVAL_MS = 2000;

// Drives pipeline execution and demo loading for the UI.
//
// Uses SSE (Server-Sent Events) for real-time progress when available,
// falling back to polling if the SSE connection fails.

export function usePipeline() {
  const eventSourceRef = useRef(null);
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const handleStatusUpdate = useCallback(async (status) => {
    useGraphStore.getState().updateJobStatus(
      status.status,
      status.progress,
      status.error_message || null,
    );
    if (status.status === 'done') {
      stopSSE();
      stopPolling();
      await fetchGraphData();
    } else if (status.status === 'failed') {
      stopSSE();
      stopPolling();
    }
  }, [stopSSE, stopPolling]);

  const startSSE = useCallback((jobId) => {
    try {
      const es = new EventSource(`/pipeline/stream/${jobId}`);
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleStatusUpdate(data);
        } catch (err) {
          console.error('[usePipeline] SSE parse error', err);
        }
      };
      es.onerror = () => {
        // Fall back to polling
        stopSSE();
        intervalRef.current = setInterval(() => pollOnce(jobId), POLL_INTERVAL_MS);
      };
    } catch {
      // SSE not supported, use polling
      intervalRef.current = setInterval(() => pollOnce(jobId), POLL_INTERVAL_MS);
    }
  }, [handleStatusUpdate, stopSSE]);

  const pollOnce = useCallback(
    async (jobId) => {
      try {
        const status = await getPipelineStatus(jobId);
        await handleStatusUpdate(status);
      } catch (err) {
        stopPolling();
        useGraphStore.getState().setGlobalError(err?.message || 'Pipeline status poll failed');
        console.error('[usePipeline] status poll failed', err);
      }
    },
    [handleStatusUpdate, stopPolling],
  );

  const runPipelineWith = useCallback(
    async (query) => {
      stopSSE();
      stopPolling();
      try {
        const res = await runPipeline({ query });
        const jobId = res.job_id;
        useGraphStore.getState().setJob(jobId);
        startSSE(jobId);
      } catch (err) {
        useGraphStore.getState().setGlobalError(err?.message || 'Failed to start pipeline');
      }
    },
    [startSSE, stopSSE, stopPolling],
  );

  // Demos hydrate from the bundle - no Neo4j, no backend.
  const loadDemo = useCallback((topicId) => {
    useGraphStore.getState().setDemoLoading(true);
    if (!loadDemoIntoStore(topicId)) {
      useGraphStore.getState().setGlobalError(`Unknown demo: ${topicId}`);
      useGraphStore.getState().setDemoLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSSE();
      stopPolling();
    };
  }, [stopSSE, stopPolling]);

  // Bundled, not fetched. /demo/topics needs a backend; the topic list
  // is already in the client.
  const getDemoTopics = useCallback(async () => ({ topics: DEMO_TOPICS }), []);

  return { runPipeline: runPipelineWith, loadDemo, getDemoTopics };
}
