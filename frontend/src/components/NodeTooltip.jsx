import useGraphStore from '../store/graphStore.js';
import { nodeColor } from '../constants/colors.js';

// Hover tooltip showing the hovered paper's title, publish date, and citation
// count. Reads `hoveredNode` (id) from the store and looks the node up.
export default function NodeTooltip({ style }) {
  const hoveredNode = useGraphStore((s) => s.hoveredNode);
  const nodes = useGraphStore((s) => s.nodes);

  if (!hoveredNode) return null;

  const node = nodes.find((n) => n.id === hoveredNode);
  if (!node) return null;

  const { title, publish_date, citation_count } = node.properties || {};
  const tagColor = nodeColor(node);

  return (
    <div className="node-tooltip" data-testid="node-tooltip" style={{ position: 'absolute', ...style }}>
      <strong>{title}</strong>
      {node.label && (
        <div className="node-tooltip__type" style={{ color: tagColor }}>
          {node.label}
        </div>
      )}
      {publish_date && <div>Published: {publish_date}</div>}
      {citation_count != null && <div>Citations: {citation_count}</div>}
    </div>
  );
}
