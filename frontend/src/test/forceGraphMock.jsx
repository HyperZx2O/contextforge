// Test double for react-force-graph's ForceGraph2D. It cannot run in jsdom
// (needs a canvas 2D context), so we render a stub that exposes the props
// and lets tests fire the interaction callbacks.
export default function MockForceGraph(props) {
  const { graphData, onNodeClick, onLinkClick, onNodeHover, width, height, linkDirectionalArrowLength } =
    props;

  return (
    <div data-testid="force-graph">
      <span data-testid="fg-width">{width}</span>
      <span data-testid="fg-height">{height}</span>
      <span data-testid="fg-arrow">{linkDirectionalArrowLength}</span>
      <span data-testid="fg-linkcount">{graphData.links.length}</span>
      <button data-testid="fg-node" onClick={() => onNodeClick?.(graphData.nodes[0])}>
        node
      </button>
      <button data-testid="fg-link" onClick={() => onLinkClick?.(graphData.links[0])}>
        link
      </button>
      <button data-testid="fg-hover" onClick={() => onNodeHover?.(graphData.nodes[1])}>
        hover
      </button>
    </div>
  );
}
