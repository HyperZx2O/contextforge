import { useState } from 'react';
import useGraphStore from '../store/graphStore.js';
import { EDGE_COLORS } from '../constants/colors.js';
import { useQuery } from '../hooks/useQuery.js';
import { titleOf } from '../utils/nodes.js';

const SUGGESTED_QUERIES = [
  'Which papers contradict each other?',
  'What are the research gaps?',
  'Which paper has the most citations?',
  'What methods are most commonly used?',
  'Which papers extend or build on each other?',
  'What are the key claims in this field?',
];

// Natural-language query box with suggested queries.
export default function QueryInterface() {
  const queryInput = useGraphStore((s) => s.queryInput);
  const queryResult = useGraphStore((s) => s.queryResult);
  const queryLoading = useGraphStore((s) => s.queryLoading);
  const queryError = useGraphStore((s) => s.queryError);
  const nodes = useGraphStore((s) => s.nodes);
  const setQueryInput = useGraphStore((s) => s.setQueryInput);
  const clearQuery = useGraphStore((s) => s.clearQuery);
  const { submitQuery } = useQuery();
  const [open, setOpen] = useState(true);

  const handleSuggestion = (q) => {
    setQueryInput(q);
    submitQuery(q);
  };

  return (
    <div className="query-interface" data-testid="query-interface">
      <div className="panel-head">
        <h2>Query</h2>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-label="Toggle query panel"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '−' : '+'}
        </button>
      </div>

      {open && (
        <>
          <div className="query-suggestions" data-testid="query-suggestions">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                className="query-suggestion"
                onClick={() => handleSuggestion(q)}
                disabled={queryLoading}
              >
                {q}
              </button>
            ))}
          </div>

          <textarea
            data-testid="query-input"
            placeholder="Ask a question about the literature…"
            aria-label="Ask a question about the literature"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
          />

          <div className="query-actions">
            <button
              data-testid="query-ask"
              onClick={() => submitQuery(queryInput)}
              disabled={queryLoading || queryInput.trim().length === 0}
            >
              Ask
            </button>
            <button data-testid="query-clear" onClick={clearQuery}>
              Clear
            </button>
          </div>

          {queryLoading && (
            <div className="query-loading" data-testid="query-loading">
              <span className="query-loading__dot" aria-hidden="true" />
              Thinking…
            </div>
          )}

          {queryError && (
            <div className="query-error" data-testid="query-error">
              {queryError}
            </div>
          )}

          {queryResult && (
            <div className="query-result" data-testid="query-result">
              <p className="query-answer" data-testid="query-answer">
                {queryResult.answer}
              </p>

              {queryResult.supporting_edges?.length > 0 && (
                <ul className="query-edges" data-testid="query-edges">
                {queryResult.supporting_edges.map((edge, i) => (
                  <li key={i}>
                    {titleOf(nodes, edge.source)}{' '}
                    <span
                      className="edge-type"
                      style={{ color: EDGE_COLORS[edge.type] || 'var(--ink-subtle)' }}
                    >
                      {edge.type}
                    </span>{' '}
                    {titleOf(nodes, edge.target)}
                  </li>
                ))}
                </ul>
              )}

              {queryResult.response_time_ms != null && (
                <div className="query-time" data-testid="query-time">
                  {(queryResult.response_time_ms / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
