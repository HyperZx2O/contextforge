import { useEffect, useRef, useCallback } from 'react';
import { runPipeline, getPipelineStatus, getDemoTopics, loadDemoTopic } from '../api/client.js';
import { fetchGraphData } from './useGraph.js';
import useGraphStore from '../store/graphStore.js';

const POLL_INTERVAL_MS = 2000;

// Drives pipeline execution and demo loading for the UI.
//
// @returns {{
//   runPipeline: (query: string) => Promise<void>,
//   loadDemo: (topicId: string) => Promise<void>,
//   getDemoTopics: () => Promise<{topics: Array<{id: string, label: string, paper_count: number, edge_count: number}>}>
// }} An object of bound actions (see descriptions below).
//
// - `runPipeline(query)`: calls `POST /pipeline/run`, stores the returned
//   `job_id`, then polls `getPipelineStatus` every 2s (ADR-4) until the job is
//   `done` (refetches the graph via `fetchGraphData`) or `failed` (stores the
//   error). Side effect: starts a `setInterval` that is cleared on a terminal
//   status and on component unmount.
// - `loadDemo(topicId)`: calls `POST /demo/load/{topicId}` then refetches the
//   graph.
// - `getDemoTopics()`: returns the available demo topics for the Load Demo UI.
export function usePipeline() {
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(
    async (jobId) => {
      try {
        const status = await getPipelineStatus(jobId);
        useGraphStore.getState().updateJobStatus(
          status.status,
          status.progress,
          status.error_message || null,
        );
        if (status.status === 'done') {
          stopPolling();
          await fetchGraphData();
        } else if (status.status === 'failed') {
          stopPolling();
        }
      } catch (err) {
        stopPolling();
        useGraphStore.getState().setGlobalError(err?.message || 'Pipeline status poll failed');
        console.error('[usePipeline] status poll failed', err);
      }
    },
    [stopPolling],
  );

    const runPipelineWith = useCallback(
      async (query) => {
        stopPolling();
        const res = await runPipeline({ query });
      const jobId = res.job_id;
      useGraphStore.getState().setJob(jobId);
      intervalRef.current = setInterval(() => pollOnce(jobId), POLL_INTERVAL_MS);
    },
    [pollOnce, stopPolling],
  );

  const loadDemo = useCallback(async (topicId) => {
    useGraphStore.getState().setDemoLoading(true);
    try {
      await loadDemoTopic(topicId);
      await fetchGraphData();
    } finally {
      useGraphStore.getState().setDemoLoading(false);
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  return { runPipeline: runPipelineWith, loadDemo, getDemoTopics };
}
