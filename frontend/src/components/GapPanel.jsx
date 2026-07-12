import { useState } from 'react';
import useGraphStore from '../store/graphStore.js';
import { gapColor, severityColor } from '../constants/colors.js';
import { titleOf } from '../utils/nodes.js';
import Skeleton from './Skeleton.jsx';

// Lists detected research gaps from the store, sorted by severity (highest
// first). Each gap shows a colored type badge, a severity bar, its description,
// and the affected paper titles (resolved from the nodes array).
export default function GapPanel() {
  const gaps = useGraphStore((s) => s.gaps);
  const nodes = useGraphStore((s) => s.nodes);
  const loading = useGraphStore((s) => s.loading);
  const [open, setOpen] = useState(true);

  const sorted = [...gaps].sort((a, b) => b.severity - a.severity);

  return (
    <div className="gap-panel" data-testid="gap-panel">
      <div className="panel-head">
        <h2>Gaps</h2>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-label="Toggle gaps panel"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '−' : '+'}
        </button>
      </div>

      {open &&
        (loading && sorted.length === 0 ? (
          <Skeleton rows={3} />
        ) : sorted.length === 0 ? (
          <p className="gap-empty" data-testid="gap-empty">
            No gaps detected yet. Run the pipeline to analyze a topic.
          </p>
        ) : (
          <ul className="gap-list" data-testid="gap-list">
            {sorted.map((gap) => (
              <li key={gap.id} className="gap-item" data-testid="gap-item">
                <span
                  className="gap-badge"
                  data-testid="gap-badge"
                  style={{ background: gapColor(gap.gap_type) }}
                >
                  {gap.gap_type}
                </span>

                <div
                  className="gap-severity"
                  data-testid="gap-severity"
                  title={`severity ${gap.severity}`}
                >
                  <div
                    className="gap-severity-bar"
                    style={{
                      width: `${Math.round(gap.severity * 100)}%`,
                      background: severityColor(gap.severity),
                    }}
                  />
                </div>

                <p className="gap-description" data-testid="gap-description">
                  {gap.description}
                </p>

                <div className="gap-affected" data-testid="gap-affected">
                  {gap.affected_nodes.map((id) => (
                    <span key={id} className="gap-affected-node">
                      {titleOf(nodes, id)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
