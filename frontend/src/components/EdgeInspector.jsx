import useGraphStore from '../store/graphStore.js';
import { EDGE_COLORS } from '../constants/colors.js';
import { titleOf } from '../utils/nodes.js';

// Shows evidence for the edge selected on the graph canvas. The panel stays
// mounted (App test expects the testid); only the detail body is conditional.
export default function EdgeInspector() {
  const selectedEdge = useGraphStore((s) => s.selectedEdge);
  const nodes = useGraphStore((s) => s.nodes);
  const clearSelection = useGraphStore((s) => s.clearSelection);

  return (
    <div className="edge-inspector" data-testid="edge-inspector">
      <div className="edge-inspector__card">
        <h2>Edge Inspector</h2>
        {!selectedEdge ? (
          <p className="edge-empty">Select an edge to inspect its evidence.</p>
        ) : (
          <div className="edge-detail">
            <span
              className="edge-type-chip"
              data-testid="edge-type"
              style={{ background: EDGE_COLORS[selectedEdge.type] || '#888' }}
            >
              {selectedEdge.type}
            </span>

            <div className="edge-endpoints" data-testid="edge-endpoints">
              <span className="edge-source">{titleOf(nodes, selectedEdge.source)}</span>
              <span className="edge-arrow">→</span>
              <span className="edge-target">{titleOf(nodes, selectedEdge.target)}</span>
            </div>

            {selectedEdge.properties?.evidence_quote && (
              <blockquote className="edge-evidence" data-testid="edge-evidence">
                {selectedEdge.properties.evidence_quote}
              </blockquote>
            )}

            {selectedEdge.properties?.confidence != null && (
              <span className="edge-confidence" data-testid="edge-confidence">
                {(selectedEdge.properties.confidence * 100).toFixed(0)}%
              </span>
            )}

            {selectedEdge.properties?.on_dimension && (
              <div className="edge-dimension" data-testid="edge-dimension">
                Dimension: {selectedEdge.properties.on_dimension}
              </div>
            )}

            <button
              className="edge-close"
              data-testid="edge-inspector-close"
              onClick={clearSelection}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
