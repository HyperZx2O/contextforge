import { useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import useGraphStore from '../store/graphStore.js';
import useAuthStore from '../store/authStore.js';
import { nodeColor, EDGE_COLORS } from '../constants/colors.js';
import { titleOf } from '../utils/nodes.js';
import { copyBibtex } from '../utils/bibtex.js';
import { logExport } from '../api/client.js';
import BookmarkButton from './BookmarkButton.jsx';
import AnnotationButton from './AnnotationButton.jsx';

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

  const connectedEdges = edges.filter((e) => {
    const src = e.source?.id ?? e.source;
    const tgt = e.target?.id ?? e.target;
    return src === node.id || tgt === node.id;
  });

  const handleCopyBibtex = async () => {
    await copyBibtex(node);
    logExport('bibtex', p?.title || node.id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allAuthors = (p.authors || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean);
  const authorNames = allAuthors.slice(0, 5);

  return (
    <div className="timeline-expanded-card" data-testid="node-detail-panel">
      <div className="timeline-expanded-card__header">
        <span className="timeline-expanded-card__source" style={{ color }}>{node.label}</span>
        <button className="timeline-expanded-card__close" onClick={clearSelection} aria-label="Close details">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="timeline-expanded-card__title">{p.title || 'Untitled'}</div>

      {authorNames.length > 0 && (
        <div className="timeline-expanded-card__authors">
          {authorNames.join(', ')}
          {allAuthors.length > 5 && ` et al. (${allAuthors.length})`}
        </div>
      )}

      <div className="timeline-expanded-card__meta">
        {p.publish_date && <span>{p.publish_date}</span>}
        {p.citation_count != null && <span>{p.citation_count} citations</span>}
        <span>{connectedEdges.length} connection{connectedEdges.length !== 1 ? 's' : ''}</span>
      </div>

      {p.abstract && (
        <p className="timeline-expanded-card__abstract">{p.abstract}</p>
      )}

      {p.arxiv_id && (
        <div style={{ padding: '0 0 var(--s-sm)' }}>
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--ink-subtle)',
          }}>
            arXiv: {p.arxiv_id}
          </span>
        </div>
      )}

      {connectedEdges.length > 0 && (
        <div className="timeline-expanded-card__connections">
          <div className="timeline-expanded-card__connections-title">Relationships</div>
          {connectedEdges.map((e, i) => {
            const srcId = e.source?.id ?? e.source;
            const tgtId = e.target?.id ?? e.target;
            const isSource = srcId === node.id;
            return (
              <div
                key={i}
                className="timeline-expanded-card__conn"
                onClick={() => selectEdge(e)}
                style={{ cursor: 'pointer' }}
              >
                <span
                  className="timeline-expanded-card__conn-dot"
                  style={{ background: EDGE_COLORS[e.type] || '#888' }}
                />
                <div className="timeline-expanded-card__conn-info">
                  <span className="timeline-expanded-card__conn-type">{e.type}</span>
                  <span className="timeline-expanded-card__conn-target">
                    {isSource ? titleOf(nodes, tgtId) : titleOf(nodes, srcId)}
                  </span>
                </div>
                {e.properties?.confidence != null && (
                  <span className="timeline-expanded-card__conn-conf">
                    {Math.round(e.properties.confidence * 100)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="timeline-expanded-card__actions">
        {p.url && (
          <a
            className="timeline-expanded-card__btn timeline-expanded-card__btn--primary"
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open paper <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        )}
        <button className="timeline-expanded-card__btn" onClick={handleCopyBibtex}>
          {copied ? 'Copied!' : 'Copy BibTeX'}
        </button>
        <BookmarkButton nodeId={node.id} />
        <AnnotationButton nodeId={node.id} />
      </div>
    </div>
  );
}
