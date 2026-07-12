import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import useGraphStore from '../store/graphStore.js';
import { nodeColor, linkColor } from '../constants/colors.js';
import NodeTooltip from './NodeTooltip.jsx';
import Skeleton from './Skeleton.jsx';

// react-force-graph canvas (spec §10.2). Colored nodes/edges, hover tooltip,
// click selection, and relationship-type filtering via the Zustand store.
export default function GraphCanvas() {
  const { nodes, edges, activeFilters, loading, selectNode, selectEdge, setHoveredNode, graphError } =
    useGraphStore();

  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  // Fill the container; re-measure on resize. Falls back to a default when
  // layout reports zero (e.g. during tests).
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

// Extracted so the canvas only mounts when there is data to show; the
// surrounding container (and its testid) stays mounted in every state.
function GraphInner({ nodes, edges, activeFilters, selectNode, selectEdge, setHoveredNode, size, pointer }) {
  const visibleEdges = edges.filter((e) => !activeFilters.includes(e.type));
  const graphData = { nodes, links: visibleEdges };

  return (
    <>
      <ForceGraph2D
        graphData={graphData}
        width={size.width}
        height={size.height}
        nodeLabel={(node) => node.properties?.title || node.properties?.name || node.id}
        nodeColor={(node) => nodeColor(node)}
        linkColor={(edge) => linkColor(edge)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(node) => selectNode(node.id)}
        onLinkClick={(edge) =>
          selectEdge({
            ...edge,
            source: edge.source?.id ?? edge.source,
            target: edge.target?.id ?? edge.target,
          })
        }
        onNodeHover={(node) => setHoveredNode(node?.id ?? null)}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
      <NodeTooltip style={{ left: pointer.x, top: pointer.y }} />
    </>
  );
}

