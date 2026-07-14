import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import useGraphStore from '../store/graphStore.js';
import { nodeColor, linkColor } from '../constants/colors.js';
import NodeTooltip from './NodeTooltip.jsx';
import Skeleton from './Skeleton.jsx';

// react-force-graph canvas. Colored nodes/edges, hover tooltip,
// click selection, and relationship-type filtering.
export default function GraphCanvas() {
  const { nodes, edges, activeFilters, loading, selectNode, selectEdge, setHoveredNode, graphError } =
    useGraphStore();

  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setSize({
        width: el.clientWidth || 800,
        height: el.clientHeight || 600,
      });
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div
      ref={containerRef}
      className="graph-canvas"
      data-testid="graph-canvas"
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        setPointer({
          x: e.clientX - (rect?.left ?? 0),
          y: e.clientY - (rect?.top ?? 0),
        });
      }}
    >
      {graphError ? (
        <div className="error-banner" data-testid="graph-error">
          Failed to load: {graphError}
        </div>
      ) : loading && nodes.length === 0 ? (
        <Skeleton rows={5} />
      ) : nodes.length === 0 ? (
        <div className="graph-empty" data-testid="graph-empty">
          Run the pipeline or load a demo to get started
        </div>
      ) : (
        <GraphInner
          nodes={nodes}
          edges={edges}
          activeFilters={activeFilters}
          selectNode={selectNode}
          selectEdge={selectEdge}
          setHoveredNode={setHoveredNode}
          size={size}
          pointer={pointer}
        />
      )}
    </div>
  );
}

// Extracted so the canvas only mounts when there is data to show.
function GraphInner({ nodes, edges, activeFilters, selectNode, selectEdge, setHoveredNode, size, pointer }) {
  const visibleEdges = edges.filter((e) => !activeFilters.includes(e.type));
  const graphData = { nodes, links: visibleEdges };

  const linkLineDash = (edge) => {
    return edge.type === 'INVOLVES' ? [4, 4] : undefined;
  };

  // Node radius: sqrt of citations for visual hierarchy, min 3
  const nodeVal = useCallback((node) => {
    const citations = node.properties?.citation_count || 1;
    return Math.max(3, Math.sqrt(citations) * 0.4);
  }, []);

  // Edge width: proportional to confidence (1-4px range)
  const linkWidth = useCallback((edge) => {
    const conf = edge.properties?.confidence ?? 0.5;
    return 1 + conf * 3;
  }, []);

  // Configure D3 forces for better spacing
  const d3Force = useCallback((force) => {
    // Access and configure the link force - increase distance between connected nodes
    force.force('link').distance(200);
    // Access and configure the charge force - stronger repulsion
    force.force('charge').strength(-600);
    // Access and configure collision force - prevent node overlap
    force.force('collision').radius(30);
  }, []);

  return (
    <>
      <ForceGraph2D
        graphData={graphData}
        width={size.width}
        height={size.height}
        nodeVal={nodeVal}
        nodeLabel={(node) => node.properties?.title || node.properties?.name || node.id}
        nodeColor={(node) => nodeColor(node)}
        linkColor={(edge) => linkColor(edge)}
        linkWidth={linkWidth}
        linkLineDash={linkLineDash}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        d3Force={d3Force}
        onNodeClick={(node) => selectNode(node.id)}
        onLinkClick={(edge) =>
          selectEdge({
            ...edge,
            source: edge.source?.id ?? edge.source,
            target: edge.target?.id ?? edge.target,
          })
        }
        onNodeHover={(node) => setHoveredNode(node?.id ?? null)}
        cooldownTicks={200}
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
      />
      <NodeTooltip style={{ left: pointer.x, top: pointer.y }} />
    </>
  );
}

