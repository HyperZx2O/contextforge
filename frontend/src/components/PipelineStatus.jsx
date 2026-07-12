import { useState } from 'react';
import { usePipeline } from '../hooks/usePipeline.js';
import useGraphStore from '../store/graphStore.js';

const RUNNING = ['pending', 'ingesting', 'extracting', 'synthesizing', 'gap_finding'];

// Maps a pipeline status (spec §6) to a human-readable label for the UI.
// `errorMessage` is the failed-state message from the backend.
function pipelineStatusLabel(status, errorMessage = null) {
  switch (status) {
    case 'pending':
      return 'Starting pipeline…';
    case 'ingesting':
      return 'Fetching papers…';
    case 'extracting':
      return 'Extracting relationships…';
    case 'synthesizing':
      return 'Synthesizing knowledge graph…';
    case 'gap_finding':
      return 'Finding research gaps…';
    case 'done':
      return 'Complete ✓';
    case 'failed':
      return errorMessage || 'Pipeline failed';
    default:
      return status ? String(status) : 'Idle';
  }
}

export default function PipelineStatus() {
  const { runPipeline, loadDemo, getDemoTopics } = usePipeline();
  const { jobStatus, jobProgress, jobError, demoLoading } = useGraphStore();
  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('');

  const running = RUNNING.includes(jobStatus);
  const canRun = query.trim().length > 0 && !running;
  const statusLabel = pipelineStatusLabel(jobStatus, jobError);
  const statusKind =
    jobStatus === 'completed' ? 'success'
    : jobStatus === 'failed' ? 'danger'
    : running ? 'running'
    : 'idle';

  const handleRun = async () => {
    if (!canRun) return;
    await runPipeline(query.trim());
  };

  const handleDemoToggle = async () => {
    if (topics) {
      setTopics(null);
      setSelectedTopic('');
      return;
    }
    const res = await getDemoTopics();
    setTopics(res.topics);
  };

  const handleDemoLoad = async () => {
    if (!selectedTopic) return;
    await loadDemo(selectedTopic);
    setTopics(null);
    setSelectedTopic('');
  };

  return (
    <div className="pipeline-status" data-testid="pipeline-status">
      <div className="pipeline__head">
        <h2>Pipeline</h2>
        <span
          className={`status-badge status-badge--${statusKind}`}
          data-testid="pipeline-status-label"
        >
          <span className="status-badge__dot" />
          {statusLabel}
        </span>
      </div>

      <input
        className="pipeline__input"
        data-testid="pipeline-query"
        placeholder="Describe papers to fetch…"
        aria-label="Topic"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <button
        className="btn btn--primary pipeline__run"
        data-testid="pipeline-run"
        onClick={handleRun}
        disabled={!canRun}
      >
        Run Pipeline
      </button>

      <progress
        className="pipeline__progress"
        data-testid="pipeline-progress"
        value={jobProgress || 0}
        max={100}
      />

      {jobStatus === 'failed' && (
        <button
          className="btn btn--secondary"
          data-testid="pipeline-retry"
          onClick={() => runPipeline(query.trim())}
        >
          Retry
        </button>
      )}

      <button
        className="btn btn--secondary pipeline__demo-toggle"
        data-testid="pipeline-demo-toggle"
        onClick={handleDemoToggle}
      >
        Load Demo
      </button>

      {topics && (
        <div className="pipeline__demo">
          <select
            className="pipeline__select"
            data-testid="pipeline-demo-select"
            aria-label="Depth"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
          >
            <option value="">Select a topic…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn--secondary"
            data-testid="pipeline-demo-load"
            onClick={handleDemoLoad}
            disabled={!selectedTopic || demoLoading}
          >
            {demoLoading ? 'Loading…' : 'Load'}
          </button>
        </div>
      )}
    </div>
  );
}
