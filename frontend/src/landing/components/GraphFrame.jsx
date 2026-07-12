import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { graphNodes, graphEdges } from '../../api/mock.js';
import { nodeColor, linkColor } from '../../constants/colors.js';

// Read-only embedding of the real knowledge graph (react-force-graph-2d) fed by
// static mock data — the landing page's "product screenshot" per design.md.
// No store, no backend. Livelier than a static shot: drawn node labels,
// citation-sized nodes, and animated relationship particles (the CONTRADICTS
// edge pulsing red is the product's key insight).
export default function GraphFrame() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 440 });
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.clientWidth || 800, height: el.clientHeight || 440 });
    measure();
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () => setAnimated(!mq?.matches);
    sync();
    mq?.addEventListener('change', sync);
    window.addEventListener('resize', measure);
    return () => {
      mq?.removeEventListener('change', sync);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const data = { nodes: graphNodes.nodes, links: graphEdges.edges };

  const truncate = (s, n = 24) =>
    !s ? '' : s.length > n ? `${s.slice(0, n - 1)}…` : s;

  const contextOf = (n) => {
    const p = n.properties || {};
    const year = (p.publish_date || '').slice(0, 4);
    const cit = p.citation_count != null ? `${p.citation_count} cit.` : null;
    return [p.source, year, cit].filter(Boolean).join(' · ');
  };

  // Deterministic node radius from citation count (no reliance on engine-
  // populated node.val, which is undefined on the first paint frames).
  const radiusOf = (n) => 5 + Math.sqrt(n.properties?.citation_count || 1) * 0.7;

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  return (
    <div
      ref={ref}
      className="graph-frame"
      data-testid="landing-graph"
      role="img"
      aria-label="Live preview of the ContextForge knowledge graph: research papers connected by contradiction, extension, and citation relationships."
    >
      <ForceGraph2D
        graphData={data}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(0,0,0,0)"
        nodeRelSize={5}
        nodeVal={(n) => 1 + Math.sqrt(n.properties?.citation_count || 1) / 2}
        nodeLabel={(n) => n.properties?.title || n.properties?.name || n.id}
        nodeColor={(n) => nodeColor(n)}
        nodeCanvasObject={(node, ctx, scale) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
          const r = radiusOf(node);
          const color = nodeColor(node);
          // node body
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          // hairline ring for separation on the dark canvas
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.stroke();

          // two-line label: title + contextual meta, on a legibility plate
          const title = truncate(node.properties?.title || node.id);
          const context = contextOf(node);
          const titlePx = Math.max(10, 12 / scale);
          const ctxPx = Math.max(8, 9.5 / scale);
          const gap = 2 / scale;
          const padX = 5 / scale;
          const padY = 4 / scale;
          const blockH = context ? titlePx + ctxPx + gap : titlePx;

          ctx.font = `500 ${titlePx}px Inter, system-ui, sans-serif`;
          const titleW = ctx.measureText(title).width;
          ctx.font = `${ctxPx}px Inter, system-ui, sans-serif`;
          const ctxW = context ? ctx.measureText(context).width : 0;
          const textW = Math.max(titleW, ctxW);

          const lx = node.x + r + 6 / scale;
          const plateX = lx - padX;
          const plateY = node.y - blockH / 2 - padY;
          const plateW = textW + padX * 2;
          const plateH = blockH + padY * 2;
          // subtle solid plate (not glass) so text stays readable over edges
          ctx.fillStyle = 'rgba(10,10,14,0.82)';
          roundRect(ctx, plateX, plateY, plateW, plateH, 4 / scale);
          ctx.fill();

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `500 ${titlePx}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(240,241,245,0.97)';
          ctx.fillText(title, lx, node.y - (context ? (ctxPx + gap) / 2 : 0));
          if (context) {
            ctx.font = `${ctxPx}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = 'rgba(154,158,167,0.92)';
            ctx.fillText(context, lx, node.y + (titlePx + gap) / 2);
          }
        }}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={(node, paintColor, ctx) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
          const r = radiusOf(node) + 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = paintColor;
          ctx.fill();
        }}
        linkColor={(e) => linkColor(e)}
        linkWidth={(e) => 1 + (e.properties?.confidence || 0.5) * 2.5}
        linkCurvature={0.15}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(e) => (animated ? (e.type === 'CONTRADICTS' ? 3 : 1) : 0)}
        linkDirectionalParticleWidth={(e) => (e.type === 'CONTRADICTS' ? 2.4 : 1.6)}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={(e) => linkColor(e)}
        cooldownTicks={200}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
