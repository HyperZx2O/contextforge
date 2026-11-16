import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Maximize, Minus, Plus, Waypoints } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import useGraphStore from '../store/graphStore.js';
import { nodeColor, linkColor } from '../constants/colors.js';
import {
  NODE_REL_SIZE,
  atRestLabelIds,
  collideRadius,
  edgeDash,
  edgeKey,
  linkWidth as baseLinkWidth,
  nodeRadius,
  nodeVal,
} from '../constants/graphVisuals.js';
import NodeTooltip from './NodeTooltip.jsx';
import Skeleton from './Skeleton.jsx';
import { useForceGraph } from '../hooks/useForceGraph.js';

// The workspace graph. This is the real product surface, and it was
// carrying none of the behaviour the landing graph got:
//
//   · no d3Force() configuration at all, so the layout ran on library
//     defaults and settled wherever it liked
//   · no ref, so no zoom-to-fit and no way to reheat
//   · NO PERMANENT LABELS. nodeCanvasObject drew only a highlight ring,
//     so the canvas was an unlabelled blob of dots until you hovered it.
//     Labels now come from constants/graphVisuals.js: the top ~35% by
//     citations, capped at 14, collision-culled.
//
// Deliberately NOT carried over from the landing: enableZoomInteraction
// and enablePanInteraction stay at their defaults. The landing disables
// them so it does not hijack page scroll; the workspace is an explorer
// and panning and zooming the graph is the entire point.

const ACCENT = '#5e6ad2';
const DIM_LINK = 'rgba(58,61,71,0.32)';
const TOOLTIP_GAP = 14;
// Below this zoom the layout is too dense for at-rest text to be legible;
// the hover card still names whatever is under the pointer.
const LABEL_MIN_SCALE = 0.7;

export default function GraphCanvas() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const activeFilters = useGraphStore((s) => s.activeFilters);
  const loading = useGraphStore((s) => s.loading);
  const graphError = useGraphStore((s) => s.graphError);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const setHoveredNode = useGraphStore((s) => s.setHoveredNode);

  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

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

  // Place the hover card beside the cursor and flip it back inside the
  // canvas near the right/bottom edge. It used to sit exactly under the
  // pointer, and .graph-canvas clips its overflow, so the card covered the
  // node it described and lost its right-hand half.
  const onMouseMove = useCallback((e) => {
    const tip = tooltipRef.current;
    const box = containerRef.current;
    if (!tip || !box) return;
    const rect = box.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const flipX = x + TOOLTIP_GAP + tip.offsetWidth > rect.width - 8;
    const flipY = y + TOOLTIP_GAP + tip.offsetHeight > rect.height - 8;
    tip.style.left = `${flipX ? Math.max(8, x - TOOLTIP_GAP - tip.offsetWidth) : x + TOOLTIP_GAP}px`;
    tip.style.top = `${flipY ? Math.max(8, y - TOOLTIP_GAP - tip.offsetHeight) : y + TOOLTIP_GAP}px`;
  }, []);

  return (
    <div
      ref={containerRef}
      className="graph-canvas"
      data-testid="graph-canvas"
      role="application"
      aria-label="Interactive knowledge graph visualization. Use the node list panel for keyboard navigation."
      onMouseMove={onMouseMove}
    >
      {graphError ? (
        <div className="error-banner" role="alert" data-testid="graph-error">
          Failed to load: {graphError}
        </div>
      ) : loading && nodes.length === 0 ? (
        <Skeleton rows={5} />
      ) : nodes.length === 0 ? (
        <div className="graph-empty" data-testid="graph-empty">
          <Waypoints size={22} aria-hidden="true" />
          <p>Run the pipeline or load a demo to get started</p>
          <span className="graph-empty__hint">
            Papers, methods, claims and the edges between them appear here.
          </span>
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
        />
      )}
      <NodeTooltip ref={tooltipRef} />
    </div>
  );
}

function GraphInner({ nodes, edges, activeFilters, selectNode, selectEdge, setHoveredNode, size }) {
  const matchingNodeIds = useGraphStore((s) => s.matchingNodeIds);
  const selectedNodeId = useGraphStore((s) => s.selectedNode);
  const selectedEdge = useGraphStore((s) => s.selectedEdge);

  const fgRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [fitPending, setFitPending] = useState(true);
  // Boxes of the labels drawn this frame, in graph coordinates. Reset by
  // onRenderFramePre so the cull is per frame, not cumulative.
  const labelRectsRef = useRef([]);

  const animated = useForceGraph(fgRef, [size, nodes, edges], { collideRadius });

  const visibleEdges = useMemo(() => edges.filter((e) => !activeFilters.includes(e.type)), [edges, activeFilters]);
  const graphData = useMemo(() => ({ nodes, links: visibleEdges }), [nodes, visibleEdges]);

  // Re-fit on resize and on new data (demo load, pipeline completion). NOT on
  // a filter toggle: hiding a relationship type used to snap the camera back
  // to the fitted view under the user's hands, mid-exploration.
  useEffect(() => setFitPending(true), [size, nodes, edges]);

  // The most-cited paper is the natural entry point into the graph.
  const topPaperId = useMemo(() => {
    let best = null;
    let bestCites = -1;
    for (const n of nodes) {
      if (n.label !== 'Paper') continue;
      const c = n.properties?.citation_count || 0;
      if (c > bestCites) {
        bestCites = c;
        best = n.id;
      }
    }
    return best;
  }, [nodes]);

  const labelledIds = useMemo(
    () => atRestLabelIds(nodes, { always: selectedNodeId ? [selectedNodeId] : [] }),
    [nodes, selectedNodeId],
  );

  const hasHighlight = matchingNodeIds.size > 0;
  const hoveredEdgeKey = hoveredEdge ? edgeKey(hoveredEdge) : null;
  const selectedEdgeKey = selectedEdge ? edgeKey(selectedEdge) : null;

  // Frame the layout once it settles, so it fills the canvas rather
  // than sitting as a knot in the middle of it. A short delay lets
  // the force simulation settle into its final positions first.
  const handleEngineStop = () => {
    if (!fitPending) return;
    const fg = fgRef.current;
    if (!fg) return;
    setFitPending(false);
    setTimeout(() => fg.zoomToFit(520, 56), 100);
  };

  // Neighbour set for the hovered node - powers the focus dimming.
  const hoveredNeighbours = useMemo(() => {
    if (hovered == null) return null;
    const set = new Set();
    for (const l of graphData.links) {
      const s = l.source?.id ?? l.source;
      const t = l.target?.id ?? l.target;
      if (s === hovered) set.add(t);
      if (t === hovered) set.add(s);
    }
    return set;
  }, [hovered, graphData.links]);

  // Both ends of the hovered edge, ringed like the landing page does.
  const hoveredEdgeEnds = useMemo(() => {
    if (!hoveredEdge) return null;
    return new Set([
      hoveredEdge.source?.id ?? hoveredEdge.source,
      hoveredEdge.target?.id ?? hoveredEdge.target,
    ]);
  }, [hoveredEdge]);

  const truncate = useCallback((s, n = 26) => (!s ? '' : s.length > n ? `${s.slice(0, n - 1)}…` : s), []);

  const contextOf = useCallback((n) => {
    const p = n.properties || {};
    const year = (p.publish_date || '').slice(0, 4);
    const cit = p.citation_count != null ? `${p.citation_count} cit.` : null;
    return [p.source, year, cit].filter(Boolean).join('  ');
  }, []);

  const roundRect = useCallback((ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }, []);

  const resetLabelRects = useCallback(() => {
    labelRectsRef.current = [];
  }, []);

  // One painter. Discs, rings and labels; the hover card is DOM.
  const paint = useCallback(
    (node, ctx, globalScale) => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

      const isHovered = hovered === node.id;
      const isSelected = selectedNodeId === node.id;
      const isLinkEnd = hoveredEdgeEnds?.has(node.id) ?? false;
      const inSearch = !hasHighlight || matchingNodeIds.has(node.id);
      const nearHover = hovered == null || isHovered || hoveredNeighbours?.has(node.id) || isLinkEnd;
      const dim = !inSearch || !nearHover;

      const r = nodeRadius(node);
      const drawR = isHovered ? r * 1.15 : r;

      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, drawR, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor(node);
      ctx.fill();

      // Most-cited paper: a subtle accent ring at rest, so the graph
      // has a natural entry point. Matches the landing's treatment.
      if (node.id === topPaperId && !dim && hovered == null && hoveredEdgeKey == null && !isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, drawR + 2.5, 0, 2 * Math.PI);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = dim ? 0.25 : 1;
      }

      // Search-match ring - the previous behaviour, preserved.
      if (hasHighlight && matchingNodeIds.has(node.id)) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, drawR + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 2.5 / globalScale;
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 10 / globalScale;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (isHovered || isSelected || isLinkEnd) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, drawR + 2.5, 0, 2 * Math.PI);
        ctx.strokeStyle = isSelected || isLinkEnd ? ACCENT : 'rgba(247,248,248,0.85)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Labels: the selection always, plus the at-rest set. Hover is the DOM
      // card's job — the canvas used to draw a second plate beside it, so a
      // hovered node (selected or not) gets no plate here.
      const labelWanted =
        !isHovered &&
        (isSelected || (labelledIds.has(node.id) && !dim && globalScale >= LABEL_MIN_SCALE));
      if (!labelWanted) return;

      const title = truncate(node.properties?.title || node.properties?.name || node.id, isSelected ? 26 : 22);
      const context = isSelected ? contextOf(node) : '';
      const titlePx = Math.max(10, 12 / globalScale);
      const ctxPx = Math.max(8, 9.5 / globalScale);
      const gap = 2 / globalScale;
      const padX = 5 / globalScale;
      const padY = 3.5 / globalScale;
      const blockH = context ? titlePx + ctxPx + gap : titlePx;

      ctx.font = `500 ${titlePx}px Inter, system-ui, sans-serif`;
      const titleW = ctx.measureText(title).width;
      ctx.font = `${ctxPx}px Inter, system-ui, sans-serif`;
      const ctxW = context ? ctx.measureText(context).width : 0;
      const textW = Math.max(titleW, ctxW);

      const lx = node.x + drawR + 6 / globalScale;
      const plateX = lx - padX;
      const plateY = node.y - blockH / 2 - padY;
      const plateW = textW + padX * 2;
      const plateH = blockH + padY * 2;

      // Greedy cull: a label that would sit on top of one already drawn this
      // frame is skipped. Cheap (≤14 boxes) and stable within a frame.
      if (!isSelected) {
        const crowded = labelRectsRef.current.some(
          (box) =>
            plateX < box.x + box.w &&
            plateX + plateW > box.x &&
            plateY < box.y + box.h &&
            plateY + plateH > box.y,
        );
        if (crowded) return;
      }
      labelRectsRef.current.push({ x: plateX, y: plateY, w: plateW, h: plateH });

      ctx.fillStyle = 'rgba(10,10,13,0.88)';
      roundRect(ctx, plateX, plateY, plateW, plateH, 4 / globalScale);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `500 ${titlePx}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(247,248,248,0.97)';
      ctx.fillText(title, lx, node.y - (context ? (ctxPx + gap) / 2 : 0));
      if (context) {
        ctx.font = `${ctxPx}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(154,158,167,0.92)';
        ctx.fillText(context, lx, node.y + (titlePx + gap) / 2);
      }
    },
    [
      hovered,
      hoveredNeighbours,
      hoveredEdgeEnds,
      hoveredEdgeKey,
      selectedNodeId,
      hasHighlight,
      matchingNodeIds,
      labelledIds,
      nodeRadius,
      truncate,
      contextOf,
      roundRect,
      topPaperId,
    ],
  );

  // Generous hit target. force-graph sizes this from nodeVal/nodeRelSize, so
  // it now matches the disc instead of floating ~6px outside it.
  const pointerAreaPaint = useCallback((node, paintColor, ctx) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius(node) + 8, 0, 2 * Math.PI);
    ctx.fillStyle = paintColor;
    ctx.fill();
  }, []);

  const linkColorFor = useCallback(
    (edge) => {
      const key = edgeKey(edge);
      if (key === hoveredEdgeKey || key === selectedEdgeKey) return ACCENT;
      if (hoveredEdgeKey) return DIM_LINK;
      if (hovered != null) {
        const s = edge.source?.id ?? edge.source;
        const t = edge.target?.id ?? edge.target;
        return s === hovered || t === hovered ? linkColor(edge) : DIM_LINK;
      }
      return linkColor(edge);
    },
    [hovered, hoveredEdgeKey, selectedEdgeKey],
  );

  const linkWidthFor = useCallback(
    (edge) => {
      const key = edgeKey(edge);
      const base = baseLinkWidth(edge);
      if (key === hoveredEdgeKey || key === selectedEdgeKey) return Math.max(2, base * 1.5);
      if (hoveredEdgeKey) return base * 0.5;
      return base;
    },
    [hoveredEdgeKey, selectedEdgeKey],
  );

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
    fg.zoomToFit(520, 56);
  };

  // Clicking a node selects it; if it is near the edge of the viewport, ease
  // the camera onto it so the detail panel and the disc are both in view.
  // Clicking something already on screen must not move anything.
  const handleNodeClick = useCallback(
    (node) => {
      selectNode(node.id);
      const fg = fgRef.current;
      if (!fg || typeof fg.centerAt !== 'function' || typeof fg.graph2ScreenCoords !== 'function') return;
      try {
        const p = fg.graph2ScreenCoords(node.x, node.y);
        const offCentre =
          p.x < size.width * 0.2 ||
          p.x > size.width * 0.8 ||
          p.y < size.height * 0.2 ||
          p.y > size.height * 0.8;
        if (!offCentre) return;
        fg.centerAt(node.x, node.y, 600);
        fg.zoom(Math.max(fg.zoom(), 1.2), 600);
      } catch {
        /* camera is best-effort */
      }
    },
    [selectNode, size.width, size.height],
  );

  return (
    <>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.width}
        height={size.height}
        nodeVal={nodeVal}
        nodeRelSize={NODE_REL_SIZE}
        // A demo graph is five papers, not five hundred. Without a cap,
        // zoomToFit scales it until the nodes are hundreds of pixels
        // across and every label reads as a white slab. The floor stops the
        // opposite failure: zooming out until the graph is a speck.
        maxZoom={3}
        minZoom={0.4}
        nodeColor={(node) => nodeColor(node)}
        linkColor={linkColorFor}
        linkWidth={linkWidthFor}
        linkLineDash={(edge) => edgeDash(edge.type)}
        linkCurvature={0.16}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        // Direction is shown on the edge under the pointer, not on all of
        // them: the old always-on particles made the whole canvas crawl.
        linkDirectionalParticles={(edge) => {
          if (!animated) return 0;
          const key = edgeKey(edge);
          return key === hoveredEdgeKey || key === selectedEdgeKey ? 2 : 0;
        }}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={linkColor}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={paint}
        nodePointerAreaPaint={pointerAreaPaint}
        onRenderFramePre={resetLabelRects}
        onNodeClick={handleNodeClick}
        onLinkClick={(edge) =>
          selectEdge({
            ...edge,
            source: edge.source?.id ?? edge.source,
            target: edge.target?.id ?? edge.target,
          })
        }
        onNodeHover={(node) => {
          const id = node?.id ?? null;
          setHovered(id);
          setHoveredNode(id);
        }}
        onLinkHover={(edge) => setHoveredEdge(edge ?? null)}
        onEngineStop={handleEngineStop}
        // A real layout takes real ticks. 200/decay-0.01 froze the graph
        // before it had spread at all.
        cooldownTicks={200}
        d3AlphaDecay={0.008}
        d3VelocityDecay={0.32}
      />
      <div className="graph-controls" aria-label="Graph view controls">
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
          <Plus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">
          <Minus size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => resetView} aria-label="Reset view" title="Reset view">
          <Maximize size={16} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
