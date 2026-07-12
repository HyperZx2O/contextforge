import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';

vi.mock('../api/client.js', () => ({
  runPipeline: vi.fn(async () => ({ job_id: 'job-1', status: 'pending' })),
  getPipelineStatus: vi.fn(async () => ({ status: 'done', progress: 100, error_message: null })),
  getDemoTopics: vi.fn(async () => ({
    topics: [
      { id: 'rag_2024', label: 'RAG 2024' },
      { id: 'llms_2024', label: 'LLMs 2024' },
      { id: 'diffusion_2024', label: 'Diffusion 2024' },
    ],
  })),
  loadDemoTopic: vi.fn(async () => ({ loaded: true })),
}));

// Keep the real store; just stub the refetch so no network is touched.
vi.mock('../hooks/useGraph.js', async () => {
  const actual = await vi.importActual('../hooks/useGraph.js');
  return { ...actual, fetchGraphData: vi.fn(async () => {}) };
});

import { runPipeline, loadDemoTopic } from '../api/client.js';
import PipelineStatus from '../components/PipelineStatus.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  useGraphStore.setState({ jobId: null, jobStatus: null, jobProgress: 0, jobError: null });
});

describe('PipelineStatus UI', () => {
  it('renders the panel with the Pipeline heading', () => {
    render(<PipelineStatus />);
    expect(screen.getByTestId('pipeline-status').textContent).toContain('Pipeline');
  });

  it('disables Run when the query is empty', () => {
    render(<PipelineStatus />);
    expect(screen.getByTestId('pipeline-run')).toBeDisabled();
    fireEvent.change(screen.getByTestId('pipeline-query'), { target: { value: 'RAG' } });
    expect(screen.getByTestId('pipeline-run')).toBeEnabled();
  });

  it('runs the pipeline with the typed query', async () => {
    render(<PipelineStatus />);
    fireEvent.change(screen.getByTestId('pipeline-query'), { target: { value: 'retrieval' } });
    fireEvent.click(screen.getByTestId('pipeline-run'));
    await waitFor(() => expect(runPipeline).toHaveBeenCalledWith({ query: 'retrieval' }));
    await waitFor(() => expect(useGraphStore.getState().jobStatus).toBe('pending'));
    cleanup();
  });

  it('shows 3 demo topics and loads the selected one', async () => {
    render(<PipelineStatus />);
    fireEvent.click(screen.getByTestId('pipeline-demo-toggle'));

    await waitFor(() => expect(screen.getByTestId('pipeline-demo-select')).toBeInTheDocument());
    const options = screen.getByTestId('pipeline-demo-select').querySelectorAll('option');
    // 3 topics + the placeholder option = 4.
    expect(options).toHaveLength(4);

    fireEvent.change(screen.getByTestId('pipeline-demo-select'), { target: { value: 'rag_2024' } });
    fireEvent.click(screen.getByTestId('pipeline-demo-load'));

    await waitFor(() => expect(loadDemoTopic).toHaveBeenCalledWith('rag_2024'));
    cleanup();
  });

  it('shows a Retry button on failure that re-runs with the same query', async () => {
    useGraphStore.setState({ jobStatus: 'failed', jobError: 'exploded' });
    render(<PipelineStatus />);
    fireEvent.change(screen.getByTestId('pipeline-query'), { target: { value: 'retrieval' } });

    const retry = await screen.findByTestId('pipeline-retry');
    fireEvent.click(retry);

    await waitFor(() => expect(runPipeline).toHaveBeenCalledWith({ query: 'retrieval' }));
    cleanup();
  });

  it('disables Run while a job is running (ingesting)', () => {
    useGraphStore.setState({ jobStatus: 'ingesting', jobProgress: 33 });
    render(<PipelineStatus />);
    fireEvent.change(screen.getByTestId('pipeline-query'), { target: { value: 'retrieval' } });
    expect(screen.getByTestId('pipeline-run')).toBeDisabled();
    cleanup();
  });

  it('shows "Complete ✓" when the job is done', () => {
    useGraphStore.setState({ jobStatus: 'done', jobProgress: 100 });
    render(<PipelineStatus />);
    expect(screen.getByTestId('pipeline-status-label')).toHaveTextContent('Complete ✓');
    cleanup();
  });

  it('shows the error message when the job failed', () => {
    useGraphStore.setState({ jobStatus: 'failed', jobError: 'pipeline exploded' });
    render(<PipelineStatus />);
    expect(screen.getByTestId('pipeline-status-label')).toHaveTextContent('pipeline exploded');
    cleanup();
  });
});
