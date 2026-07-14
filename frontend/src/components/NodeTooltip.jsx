import useGraphStore from '../store/graphStore.js';
import { nodeColor } from '../constants/colors.js';

// Hover tooltip showing paper details including abstract snippet and authors.
export default function NodeTooltip({ style }) {
  const hoveredNode = useGraphStore((s) => s.hoveredNode);
  const nodes = useGraphStore((s) => s.nodes);

  if (!hoveredNode) return null;

  const node = nodes.find((n) => n.id === hoveredNode);
  if (!node) return null;

  const { title, publish_date, citation_count, abstract, authors, source, url } = node.properties || {};
  const tagColor = nodeColor(node);

  const truncate = (text, max = 120) => {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  };

  const authorNames = (authors || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  return (
    <div className="node-tooltip" data-testid="node-tooltip" style={{ position: 'absolute', ...style }}>
      <strong>{title}</strong>
      {node.label && (
        <div className="node-tooltip__type" style={{ color: tagColor }}>
          {node.label}
        </div>
      )}
      {authorNames && <div className="node-tooltip__authors">{authorNames}{authors.length > 3 ? ' et al.' : ''}</div>}
      {publish_date && <div className="node-tooltip__date">Published: {publish_date}</div>}
      {citation_count != null && <div className="node-tooltip__citations">Citations: {citation_count}</div>}
      {source && <span className="node-tooltip__source">{source}</span>}
      {abstract && <p className="node-tooltip__abstract">{truncate(abstract)}</p>}
      {url && (
        <a
          className="node-tooltip__link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Open paper →
        </a>
      )}
    </div>
  );
}
