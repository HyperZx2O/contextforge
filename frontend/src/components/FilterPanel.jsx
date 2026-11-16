import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import useGraphStore from '../store/graphStore.js';
import { EDGE_COLORS } from '../constants/colors.js';
import { edgeDash, edgeWeight } from '../constants/graphVisuals.js';
import Skeleton from './Skeleton.jsx';

const EDGE_TYPES = Object.keys(EDGE_COLORS);

// Toggles graph edges by relationship type. A checked box means the type is
// shown; unchecking hides it. `activeFilters` holds the hidden types.
//
// Each swatch is a 20px line drawn with the same dash pattern and stroke
// weight the canvas uses (constants/graphVisuals.js), so this panel doubles
// as the legend: the canvas codes contradictions dashed, challenges dotted
// and citations hairline, and there was nowhere to learn that.
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
          {open ? <Minus size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
        </button>
      </div>
      <p className="filter-hint">Uncheck a type to hide those edges.</p>
      {open && (
        loading && edges.length === 0 ? (
          <Skeleton rows={4} />
        ) : (
        <>
        <ul className="filter-list">
          {EDGE_TYPES.map((type) => {
            const count = edges.filter((e) => e.type === type).length;
            const checked = !activeFilters.includes(type);
            const dash = edgeDash(type);
            return (
              <li key={type} className="filter-row">
                <label>
                  <input
                    type="checkbox"
                    data-testid={`filter-${type}`}
                    checked={checked}
                    onChange={() => toggleFilter(type)}
                  />
                  <svg
                    className="filter-swatch"
                    width="20"
                    height="10"
                    data-testid={`filter-swatch-${type}`}
                    aria-hidden="true"
                  >
                    <line
                      x1="1"
                      y1="5"
                      x2="19"
                      y2="5"
                      stroke={EDGE_COLORS[type]}
                      strokeWidth={edgeWeight(type)}
                      strokeDasharray={dash ? dash.join(' ') : undefined}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="filter-label">{type}</span>
                  <span className="filter-count" data-testid={`filter-count-${type}`}>
                    {count}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="filter-hint filter-hint--foot">Disc size reflects citations.</p>
        </>
        )
      )}
    </div>
  );
}
