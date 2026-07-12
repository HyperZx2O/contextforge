import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import useGraphStore from '../store/graphStore.js';
import * as mock from '../api/mock.js';

vi.mock('../api/client.js', async (importOriginal) => ({
  ...(await importOriginal()),
  postNLQuery: vi.fn(),
}));

import { postNLQuery } from '../api/client.js';
import QueryInterface from '../components/QueryInterface.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  useGraphStore.setState({
    nodes: mock.graphNodes.nodes,
    queryInput: '',
    queryResult: null,
    queryLoading: false,
    queryError: null,
  });
});

describe('QueryInterface', () => {
  it('disables Ask when the input is empty and enables it after typing', () => {
    render(<QueryInterface />);
    expect(screen.getByTestId('query-ask')).toBeDisabled();
    fireEvent.change(screen.getByTestId('query-input'), { target: { value: 'question?' } });
    expect(screen.getByTestId('query-ask')).toBeEnabled();
  });

  it('submits the typed question and renders the answer with supporting edges + time', async () => {
    postNLQuery.mockResolvedValue(mock.nlQueryResponse);
    render(<QueryInterface />);
    fireEvent.change(screen.getByTestId('query-input'), {
      target: { value: 'Which papers contradict 2401.12345?' },
    });
    fireEvent.click(screen.getByTestId('query-ask'));

    await waitFor(() =>
      expect(postNLQuery).toHaveBeenCalledWith({
        question: 'Which papers contradict 2401.12345?',
        context_node_id: null,
      }),
    );

    expect(screen.getByTestId('query-answer')).toHaveTextContent(mock.nlQueryResponse.answer);
    expect(screen.getByTestId('query-edges')).toHaveTextContent('CONTRADICTS');
    expect(screen.getByTestId('query-time')).toHaveTextContent('1.2s');
    cleanup();
  });

  it('shows a loading indicator while the query is in flight', async () => {
    let resolve;
    const pending = new Promise((r) => {
      resolve = r;
    });
    postNLQuery.mockReturnValue(pending);
    render(<QueryInterface />);
    fireEvent.change(screen.getByTestId('query-input'), { target: { value: 'q' } });
    fireEvent.click(screen.getByTestId('query-ask'));

    await waitFor(() => expect(screen.getByTestId('query-loading')).toHaveTextContent('Thinking…'));
    resolve({ answer: 'done', supporting_edges: [], response_time_ms: 500 });
    cleanup();
  });

  it('shows an error banner when the query fails', async () => {
    postNLQuery.mockRejectedValue(new Error('boom'));
    render(<QueryInterface />);
    fireEvent.change(screen.getByTestId('query-input'), { target: { value: 'q' } });
    fireEvent.click(screen.getByTestId('query-ask'));

    await waitFor(() => expect(screen.getByTestId('query-error')).toHaveTextContent('boom'));
    cleanup();
  });

  it('shows the "could not interpret" message on a 400 response', async () => {
    const { APIError } = await import('../api/client.js');
    postNLQuery.mockRejectedValue(new APIError('NL_QUERY_FAILED', 400, 'Bad request'));
    render(<QueryInterface />);
    fireEvent.change(screen.getByTestId('query-input'), { target: { value: 'q' } });
    fireEvent.click(screen.getByTestId('query-ask'));

    await waitFor(() =>
      expect(screen.getByTestId('query-error')).toHaveTextContent(
        'Could not interpret this question. Try rephrasing.',
      ),
    );
    cleanup();
  });

  it('Clear removes the answer and error', async () => {
    useGraphStore.setState({
      queryResult: mock.nlQueryResponse,
      queryError: 'boom',
    });
    render(<QueryInterface />);
    fireEvent.click(screen.getByTestId('query-clear'));

    await waitFor(() => expect(useGraphStore.getState().queryResult).toBeNull());
    expect(useGraphStore.getState().queryError).toBeNull();
    cleanup();
  });
});
