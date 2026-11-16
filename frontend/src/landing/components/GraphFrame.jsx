import ForceGraph2D from 'react-force-graph-2d';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { graphNodes, graphEdges } from '../../api/mock.js';
import { useForceGraph } from '../../hooks/useForceGraph.js';

// The hero graph. One palette, no rainbow: papers are ink discs sized by
// how often they are cited, relationships are hairlines, and the only
// thing that takes colour is the edge under the pointer. That is the
// page's signature - hover an edge and the sentence it was drawn from is
// printed beneath the field.
//
// The edge's stroke style now carries its type, so the graph reads as a
// map before anyone hovers: contradictions are dashed, challenges dotted,
// implementations thick. The visual vocabulary matches the Edges section
// below, so the two surfaces teach the same set.

const graphData = { nodes: graphNodes.nodes, links: graphEdges.edges };

const INK = 'rgba(233,234,240,0.94)';
const INK_DIM = 'rgba(233,234,240,0.30)';
const NODE = '#c3c5d2';
const NODE_DIM = 'rgba(195,197,210,0.28)';
const NODE_TOP = '#c3c5d2';
const RULE = 'rgba(148,150,168,0.34)';
const RULE_DIM = 'rgba(148,150,168,0.10)';
const ACCENT = '#8a7bf2';
const PLATE = 'rgba(18,18,24,0.94)';
const PLATE_RULE = 'rgba(233,234,240,0.14)';
const SUB = 'rgba(154,156,172,0.95)';

// Per-type stroke vocabulary. Matches the Edges section below.
const EDGE_STYLE = {
  CONTRADICTS: { dash: [6, 4], weight: 1.3 },
  EXTENDS: { dash: null, weight: 1.0 },
  REPLICATES: { dash: null, weight: 1.0 },
  REPLICATES_FAILED: { dash: [6, 4], weight: 1.0 },
  CHALLENGES: { dash: [2, 4], weight: 1.0 },
  CITES: { dash: null, weight: 0.7 },
  IMPLEMENTS: { dash: null, weight: 1.8 },
  DISAGREES_ON_SCOPE: { dash: null, weight: 1.0 },
};

// The most-cited paper is the natural entry point into the graph.
const TOP_NODE = graphData.nodes.reduce((best, n) =>
  (n.properties?.citation_count || 0) > (best.properties?.citation_count || 0) ? n : best,
);

const endId = (end) => (end && typeof end === 'object' ? end.id : end);

export default function GraphFrame({ onEdgeHover, label }) {
  const ref = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ width: 960, height: 420 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [fitPending, setFitPending] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setSize({ width: Math.round(w), height: Math.round(h) });
    };
    measure();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useForceGraph(fgRef, [size]);

  useEffect(() => setFitPending(true), [size]);

  const handleEngineStop = () => {
    if (!fitPending) return;
    const fg = fgRef.current;
    if (!fg) return;
    setFitPending(false);
    fg.zoomToFit(700, 72);
  };

  const neighbours = useMemo(() => {
    if (hoveredNode == null) return null;
    const set = new Set();
    for (const l of graphData.links) {
      const s = endId(l.source);
      const t = endId(l.target);
      if (s === hoveredNode) set.add(t);
      if (t === hoveredNode) set.add(s);
    }
    return set;
  }, [hoveredNode]);

  const edgeKey = (e) => `${endId(e.source)}->${endId(e.target)}:${e.type}`;
  const activeEdge = hoveredEdge ? edgeKey(hoveredEdge) : null;

  const setEdge = (edge) => {
    setHoveredEdge(edge ?? null);
    onEdgeHover?.(edge ?? null);
  };

  const nodeRadius = (n) => 5 + Math.sqrt(n.properties?.citation_count || 1) * 0.62;

  const truncate = (s, n = 30) => (!s ? '' : s.length > n ? `${s.slice(0, n - 1)}…` : s);

  const contextOf = (n) => {
    const p = n.properties || {};
    const year = (p.publish_date || '').slice(0, 4);
    return [p.source, year].filter(Boolean).join('  ');
  };

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const hoveredEdgeEnds = useMemo(() => {
    if (!hoveredEdge) return null;
    return new Set([endId(hoveredEdge.source), endId(hoveredEdge.target)]);
  }, [hoveredEdge]);

  const zoomBy = (factor) => {
    const fg = fgRef.current;
    if (!fg) return;
    try {
      fg.zoom(fg.zoom() * factor, 220);
    } catch {
      /* ignore */
    }
  };

  const resetView = () => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(400, 72);
  };

  return (
    <div
      ref={ref}
      className="graph-frame"
      data-testid="landing-graph"
      role="img"
      aria-label={
        label ??
        `The sample knowledge graph: ${graphData.nodes.length} papers joined by contradictions, extensions, replications and citations.`
      }
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        enableZoomInteraction={false}
        enablePanInteraction={true}
        maxZoom={2.6}
        minZoom={0.6}
        nodeRelSize={4}
        nodeVal={() => 1}
        nodeColor={() => NODE}
        onNodeHover={(n) => setHoveredNode(n?.id ?? null)}
        onLinkHover={(e) => setEdge(e)}
        onEngineStop={handleEngineStop}
        cooldownTicks={420}
        d3AlphaDecay={0.008}
        d3VelocityDecay={0.32}
        linkColor={(e) => {
          if (activeEdge) return edgeKey(e) === activeEdge ? ACCENT : RULE_DIM;
          if (hoveredNode != null) {
            return endId(e.source) === hoveredNode || endId(e.target) === hoveredNode ? RULE : RULE_DIM;
          }
          return RULE;
        }}
        linkWidth={(e) => {
          if (activeEdge) return edgeKey(e) === activeEdge ? 1.8 : 0.5;
          const w = EDGE_STYLE[e.type]?.weight ?? 1.0;
          return hoveredNode != null &&
            !(endId(e.source) === hoveredNode || endId(e.target) === hoveredNode)
            ? w * 0.35
            : w;
        }}
        linkLineDash={(e) => (activeEdge && edgeKey(e) !== activeEdge ? [2, 4] : EDGE_STYLE[e.type]?.dash ?? null)}
        linkCurvature={0.16}
        linkDirectionalArrowLength={() => 4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(e) => (activeEdge && edgeKey(e) === activeEdge ? ACCENT : RULE)}
        nodePointerAreaPaint={(node, paintColor, ctx) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius(node) + 8, 0, 2 * Math.PI);
          ctx.fillStyle = paintColor;
          ctx.fill();
        }}
        nodeCanvasObject={(node, ctx, scale) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

          const isHovered = hoveredNode === node.id;
          const isTop = node.id === TOP_NODE.id;
          const isEndpoint = hoveredEdgeEnds?.has(node.id) ?? false;
          const dimmed =
            hoveredNode != null && !isHovered && !neighbours?.has(node.id) && !isEndpoint;
          const r = nodeRadius(node) * (isHovered ? 1.25 : 1);

          // Disc
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = dimmed ? NODE_DIM : NODE;
          ctx.fill();

          // Ring: top node at rest, hovered node, or edge endpoint
          if (isTop && hoveredNode == null && !hoveredEdge) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 2.5 / scale, 0, 2 * Math.PI);
            ctx.lineWidth = 1 / scale;
            ctx.strokeStyle = ACCENT;
            ctx.globalAlpha = 0.55;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (isHovered || isEndpoint) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3 / scale, 0, 2 * Math.PI);
            ctx.lineWidth = 1.4 / scale;
            ctx.strokeStyle = ACCENT;
            ctx.stroke();
          }

          // Label only on hover — keeps the graph clean at rest.
          if (!isHovered) return;

          const title = truncate(node.properties?.title || node.id);
          const context = contextOf(node);
          const titlePx = Math.max(11, 13 / scale);
          const ctxPx = Math.max(8, 9 / scale);
          const gap = 2 / scale;
          const padX = 5 / scale;
          const padY = 4 / scale;
          const blockH = context ? titlePx + ctxPx + gap : titlePx;

          ctx.font = `500 ${titlePx}px "Host Grotesk", system-ui, sans-serif`;
          const titleW = ctx.measureText(title).width;
          ctx.font = `${ctxPx}px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
          const ctxW = context ? ctx.measureText(context).width : 0;
          const textW = Math.max(titleW, ctxW);

          const lx = node.x + r + 7 / scale;
          const plateX = lx - padX;
          const plateY = node.y - blockH / 2 - padY;
          const plateW = textW + padX * 2;
          const plateH = blockH + padY * 2;

          ctx.fillStyle = PLATE;
          roundRect(ctx, plateX, plateY, plateW, plateH, 3 / scale);
          ctx.fill();
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = PLATE_RULE;
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `500 ${titlePx}px "Host Grotesk", system-ui, sans-serif`;
          ctx.fillStyle = INK;
          ctx.fillText(title, lx, node.y - (context ? (ctxPx + gap) / 2 : 0));

          if (context) {
            ctx.font = `${ctxPx}px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
            ctx.fillStyle = SUB;
            ctx.fillText(context, lx, node.y + (titlePx + gap) / 2);
          }
        }}
        nodeCanvasObjectMode={() => 'replace'}
      />

      <div className="graph-controls" aria-label="Graph view controls">
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
          <Plus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">
          <Minus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={resetView} aria-label="Reset view">
          <Maximize size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
