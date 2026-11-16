import { forwardRef } from 'react';
import useGraphStore from '../store/graphStore.js';
import { nodeColor } from '../constants/colors.js';

// Hover tooltip showing paper details including abstract snippet and authors.
//
// This is the only hover card on the canvas: the painter used to draw a second
// one (title + source plate) directly beside the disc, so hovering printed the
// same label twice. The canvas now draws at-rest labels only, and this card
// carries the things a canvas plate cannot: authors, abstract, citations.
//
// It is pointer-events: none because it trails the cursor — moving onto it
// would leave the node and unmount it — so it holds no links of its own.
const NodeTooltip = forwardRef(function NodeTooltip(_props, ref) {
  const hoveredNode = useGraphStore((s) => s.hoveredNode);
  const nodes = useGraphStore((s) => s.nodes);

  if (!hoveredNode) return null;

  const node = nodes.find((n) => n.id === hoveredNode);
  if (!node) return null;

  const { title, publish_date, citation_count, abstract, authors, source } = node.properties || {};
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
    <div ref={ref} className="node-tooltip" data-testid="node-tooltip" style={{ position: 'absolute' }}>
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
    </div>
  );
});

export default NodeTooltip;
