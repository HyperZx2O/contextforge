import useGraphStore from '../store/graphStore.js';
import { nodeColor, EDGE_COLORS } from '../constants/colors.js';
import { titleOf } from '../utils/nodes.js';
import { copyBibtex } from '../utils/bibtex.js';
import { useState } from 'react';

// Detailed panel shown when a node is clicked on the graph.
export default function NodeDetailPanel() {
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const clearSelection = useGraphStore((s) => s.clearSelection);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const [copied, setCopied] = useState(false);

  if (!selectedNode) return null;

  const node = nodes.find((n) => n.id === selectedNode);
  if (!node) return null;

  const p = node.properties || {};
  const color = nodeColor(node);

  // Find all edges connected to this node
  const connectedEdges = edges.filter((e) => {
    const src = e.source?.id ?? e.source;
    const tgt = e.target?.id ?? e.target;
    return src === node.id || tgt === node.id;
  });

  const handleCopyBibtex = async () => {
    await copyBibtex(node);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const authorNames = (p.authors || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean);

  return (
    <div className="node-detail-panel" data-testid="node-detail-panel">
      <div className="node-detail-panel__card">
        <div className="node-detail-panel__header">
          <span className="node-detail-panel__type" style={{ color }}>{node.label}</span>
          <button
            className="node-detail-panel__close"
            onClick={clearSelection}
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        <h2 className="node-detail-panel__title">{p.title || 'Untitled'}</h2>

        {authorNames.length > 0 && (
          <div className="node-detail-panel__authors">
            {authorNames.join(', ')}
            {authorNames.length > 3 && ` et al. (${authorNames.length} authors)`}
          </div>
        )}

        <div className="node-detail-panel__meta">
          {p.publish_date && (
            <span className="node-detail-panel__meta-item">
              <span className="node-detail-panel__meta-label">Published</span>
              {p.publish_date}
            </span>
          )}
          {p.citation_count != null && (
            <span className="node-detail-panel__meta-item">
              <span className="node-detail-panel__meta-label">Citations</span>
              {p.citation_count}
            </span>
          )}
          {p.source && (
            <span className="node-detail-panel__meta-item">
              <span className="node-detail-panel__meta-label">Source</span>
              {p.source}
            </span>
          )}
        </div>

        {p.abstract && (
          <div className="node-detail-panel__section">
            <h3>Abstract</h3>
            <p className="node-detail-panel__abstract">{p.abstract}</p>
          </div>
        )}

        {p.arxiv_id && (
          <div className="node-detail-panel__section">
            <h3>Identifiers</h3>
            <div className="node-detail-panel__ids">
              <span className="node-detail-panel__id">arXiv: {p.arxiv_id}</span>
            </div>
          </div>
        )}

        <div className="node-detail-panel__actions">
          {p.url && (
            <a
              className="node-detail-panel__btn node-detail-panel__btn--primary"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open paper ↗
            </a>
          )}
          <button className="node-detail-panel__btn" onClick={handleCopyBibtex}>
            {copied ? 'Copied!' : 'Copy BibTeX'}
          </button>
        </div>

        {connectedEdges.length > 0 && (
          <div className="node-detail-panel__section">
            <h3>Relationships ({connectedEdges.length})</h3>
            <ul className="node-detail-panel__edges">
              {connectedEdges.map((e, i) => {
                const srcId = e.source?.id ?? e.source;
                const tgtId = e.target?.id ?? e.target;
                const isSource = srcId === node.id;
                return (
                  <li
                    key={i}
                    className="node-detail-panel__edge"
                    onClick={() => selectEdge(e)}
                  >
                    <span
                      className="node-detail-panel__edge-type"
                      style={{ color: EDGE_COLORS[e.type] || '#888' }}
                    >
                      {e.type}
                    </span>
                    <span className="node-detail-panel__edge-endpoint">
                      {isSource
                        ? `→ ${titleOf(nodes, tgtId)}`
                        : `← ${titleOf(nodes, srcId)}`
                      }
                    </span>
                    {e.properties?.confidence != null && (
                      <span className="node-detail-panel__edge-conf">
                        {(e.properties.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
