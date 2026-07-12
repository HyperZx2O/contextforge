import { useState } from 'react';
import useGraphStore from '../store/graphStore.js';
import { EDGE_COLORS } from '../constants/colors.js';
import Skeleton from './Skeleton.jsx';

const EDGE_TYPES = Object.keys(EDGE_COLORS);

// Toggles graph edges by relationship type. A checked box means the type is
// shown; unchecking hides it. `activeFilters` holds the hidden types.
export default function FilterPanel() {
  const edges = useGraphStore((s) => s.edges);
  const activeFilters = useGraphStore((s) => s.activeFilters);
  const toggleFilter = useGraphStore((s) => s.toggleFilter);
  const loading = useGraphStore((s) => s.loading);
  const [open, setOpen] = useState(true);

  return (
    <div className="filter-panel" data-testid="filter-panel">
      <div className="panel-head">
        <h2>Filters</h2>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-label="Toggle filters panel"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '−' : '+'}
        </button>
      </div>
      <p className="filter-hint">Uncheck a type to hide those edges.</p>
      {open && (
        loading && edges.length === 0 ? (
          <Skeleton rows={4} />
        ) : (
        <ul className="filter-list">
          {EDGE_TYPES.map((type) => {
            const count = edges.filter((e) => e.type === type).length;
            const checked = !activeFilters.includes(type);
            return (
              <li key={type} className="filter-row">
                <label>
                  <input
                    type="checkbox"
                    data-testid={`filter-${type}`}
                    checked={checked}
                    onChange={() => toggleFilter(type)}
                  />
                  <span
                    className="filter-dot"
                    data-testid={`filter-dot-${type}`}
                    style={{ background: EDGE_COLORS[type] }}
                  />
                  <span className="filter-label">{type}</span>
                  <span className="filter-count" data-testid={`filter-count-${type}`}>
                    {count}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        )
      )}
    </div>
  );
}
