import { useState } from 'react';
import useGraphStore from '../store/graphStore.js';
import { nodeColor } from '../constants/colors.js';

// Keyboard-accessible text list of graph nodes. Provides a searchable,
// tab-navigable alternative to the canvas-based force graph.
export default function NodeListView() {
  const nodes = useGraphStore((s) => s.nodes);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = nodes.filter((n) => {
    const label = (n.properties?.title || n.properties?.name || n.id).toLowerCase();
    return label.includes(filter.toLowerCase());
  });

  if (nodes.length === 0) return null;

  return (
    <div className="node-list-panel" data-testid="node-list-panel">
      <div className="panel-head">
        <h2>Nodes</h2>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-label="Toggle node list"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '−' : '+'}
        </button>
      </div>
      {open && (
        <>
          <input
            className="node-list__filter"
            type="search"
            placeholder="Filter nodes…"
            aria-label="Filter nodes"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul className="node-list" role="listbox" aria-label="Graph nodes">
            {filtered.map((n) => {
              const label = n.properties?.title || n.properties?.name || n.id;
              const isSelected = selectedNode === n.id;
              return (
                <li key={n.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`node-list__item${isSelected ? ' node-list__item--active' : ''}`}
                    onClick={() => selectNode(n.id)}
                    tabIndex={0}
                  >
                    <span
                      className="node-list__dot"
                      style={{ background: nodeColor(n) }}
                      aria-hidden="true"
                    />
                    <span className="node-list__label">{label}</span>
                    <span className="node-list__type">{n.type}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="node-list__empty">No matching nodes</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
