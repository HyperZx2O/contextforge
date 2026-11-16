import { forwardRef, useImperativeHandle } from 'react';

// Test double for react-force-graph's ForceGraph2D. It cannot run in jsdom
// (needs a canvas 2D context), so we render a stub that exposes the props
// and lets tests fire the interaction callbacks.
//
// forwardRef is load-bearing: GraphCanvas holds the instance to call
// d3Force(), d3ReheatSimulation() and zoomToFit(). Without it every mount
// logs a React warning about refs on function components. The imperative
// handle stands in for the real instance's camera/simulation API.

const forceStub = () => ({
  strength: () => forceStub(),
  distance: () => forceStub(),
});

const handle = {
  d3Force: () => forceStub(),
  d3ReheatSimulation: () => {},
  zoomToFit: () => {},
  cameraPosition: () => {},
};

const MockForceGraph = forwardRef(function MockForceGraph(props, ref) {
  useImperativeHandle(ref, () => handle, []);

  const {
    graphData,
    onNodeClick,
    onLinkClick,
    onNodeHover,
    onLinkHover,
    width,
    height,
    linkColor,
    linkDirectionalArrowLength,
    linkDirectionalParticles,
  } = props;

  // Reading accessors for the second link lets tests assert that hover state
  // actually reaches the canvas styling, not just the store.
  const secondLink = graphData.links[1];

  return (
    <div data-testid="force-graph">
      <span data-testid="fg-width">{width}</span>
      <span data-testid="fg-height">{height}</span>
      <span data-testid="fg-arrow">{linkDirectionalArrowLength}</span>
      <span data-testid="fg-linkcount">{graphData.links.length}</span>
      <span data-testid="fg-linkcolor">
        {typeof linkColor === 'function' ? linkColor(secondLink) : linkColor}
      </span>
      <span data-testid="fg-particles">
        {typeof linkDirectionalParticles === 'function'
          ? linkDirectionalParticles(secondLink)
          : linkDirectionalParticles}
      </span>
      <button data-testid="fg-node" onClick={() => onNodeClick?.(graphData.nodes[0])}>
        node
      </button>
      <button data-testid="fg-link" onClick={() => onLinkClick?.(graphData.links[0])}>
        link
      </button>
      <button data-testid="fg-hover" onClick={() => onNodeHover?.(graphData.nodes[1])}>
        hover
      </button>
      <button data-testid="fg-linkhover" onClick={() => onLinkHover?.(graphData.links[1])}>
        link hover
      </button>
    </div>
  );
});

export default MockForceGraph;