import { useState } from 'react';
import useGraphStore from '../store/graphStore.js';
import { EDGE_COLORS } from '../constants/colors.js';

export default function StatsPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const gaps = useGraphStore((s) => s.gaps);
  const [open, setOpen] = useState(true);

  const papers = nodes.filter((n) => n.label === 'Paper');

  const edgesByType = edges.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  const authorCounts = {};
  papers.forEach((p) => {
    (p.properties?.authors || []).forEach((a) => {
      const name = typeof a === 'string' ? a : a?.name;
      if (name) authorCounts[name] = (authorCounts[name] || 0) + 1;
    });
  });
  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const avgCitations = papers.length
    ? Math.round(papers.reduce((s, p) => s + (p.properties?.citation_count || 0), 0) / papers.length)
    : 0;

  return (
    <div className="stats-panel" data-testid="stats-panel">
      <div className="panel-head">
        <h2>Statistics</h2>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-label="Toggle statistics panel"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '−' : '+'}
        </button>
      </div>

      {open && (
        <>
          <dl className="stats-grid">
            <dt>Papers</dt>
            <dd>{papers.length}</dd>
            <dt>Relationships</dt>
            <dd>{edges.length}</dd>
            <dt>Gaps</dt>
            <dd>{gaps.length}</dd>
            <dt>Avg Citations</dt>
            <dd>{avgCitations}</dd>
          </dl>

          {Object.keys(edgesByType).length > 0 && (
            <>
              <h3>By Type</h3>
              {Object.entries(edgesByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="stat-row">
                    <span style={{ color: EDGE_COLORS[type] }}>{type}</span>
                    <span>{count}</span>
                  </div>
                ))}
            </>
          )}

          {topAuthors.length > 0 && (
            <>
              <h3>Top Authors</h3>
              {topAuthors.map(([name, count]) => (
                <div key={name} className="stat-row">
                  <span>{name}</span>
                  <span>{count}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
