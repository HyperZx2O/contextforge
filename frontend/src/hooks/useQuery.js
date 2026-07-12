import { postNLQuery, APIError } from '../api/client.js';
import useGraphStore from '../store/graphStore.js';

const BAD_REQUEST_MESSAGE = 'Could not interpret this question. Try rephrasing.';

// Submits a natural-language question to the backend (mock or real) and
// pushes the answer into the store. A 400 surfaces the specific "could not
// interpret" message; other failures show the error and raise the global toast.
//
// @returns {{ submitQuery: (question: string, contextNodeId?: string|null) => Promise<void> }}
//   `submitQuery` sends `POST /query/natural-language` with `{ question,
//   context_node_id }`. Side effects: sets `queryLoading` (true→false), on
//   success sets `queryResult`; on a 400 `APIError` sets `queryError` to the
//   "Could not interpret this question. Try rephrasing." message; on any other
//   error sets `queryError` and raises the global toast via `globalError`.
export function useQuery() {
  const { setQueryLoading, setQueryResult, setQueryError, setGlobalError } = useGraphStore();

  /**
   * @param {string} question - The natural-language question to ask.
   * @param {string|null} [contextNodeId] - Optional node id to scope the answer.
   * @returns {Promise<void>} Resolves once the store reflects the result/error.
   */
  async function submitQuery(question, contextNodeId = null) {
    setQueryError(null);
    setQueryLoading(true);
    try {
      const result = await postNLQuery({ question, context_node_id: contextNodeId });
      setQueryResult(result);
    } catch (err) {
      const message = err?.message || 'Query failed';
      if (err instanceof APIError && err.status === 400) {
        setQueryError(BAD_REQUEST_MESSAGE);
      } else {
        setQueryError(message);
        setGlobalError(message);
      }
    } finally {
      setQueryLoading(false);
    }
  }

  return { submitQuery };
}

