import { useRef, useEffect, useState } from 'react';
import useGraphStore from '../store/graphStore.js';
import { nodeColor, EDGE_COLORS } from '../constants/colors.js';

const PADDING = 80;
const BASE_R = 8;

export default function TimelineView() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const [hoveredNode, setHoveredNode] = useState(null);

  const containerRef = useRef(null);
  const [width, setWidth] = useState(1000);
  const height = 520;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || 1000);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const papers = nodes
    .filter((n) => n.label === 'Paper' && n.properties?.publish_date)
    .sort((a, b) => a.properties.publish_date.localeCompare(b.properties.publish_date));

  if (papers.length === 0) {
    return (
      <div className="graph-canvas" data-testid="timeline-empty">
        <div className="graph-empty">No papers with dates to show in timeline.</div>
      </div>
    );
  }

  const dates = papers.map((p) => new Date(p.properties.publish_date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  const xPos = (dateStr) => {
    const t = new Date(dateStr).getTime();
    return PADDING + ((t - minDate) / dateRange) * (width - 2 * PADDING);
  };

  const nodeMap = {};
  papers.forEach((p) => { nodeMap[p.id] = p; });

  // Stagger papers vertically to avoid label overlap
  const getNodeY = (index, total) => {
    const baseY = height - PADDING - 40;
    const stagger = (index % 3) * 22;
    return baseY - stagger;
  };

  // Build arcs with better styling
  const arcs = edges
    .filter((e) => {
      if (e.type === 'INVOLVES') return false; // Skip gap edges in timeline
      const src = e.source?.id ?? e.source;
      const tgt = e.target?.id ?? e.target;
      return nodeMap[src] && nodeMap[tgt];
    })
    .map((e, i) => {
      const srcId = e.source?.id ?? e.source;
      const tgtId = e.target?.id ?? e.target;
      const src = nodeMap[srcId];
      const tgt = nodeMap[tgtId];
      if (!src || !tgt) return null;

      const srcIdx = papers.indexOf(src);
      const tgtIdx = papers.indexOf(tgt);
      const x1 = xPos(src.properties.publish_date);
      const x2 = xPos(tgt.properties.publish_date);
      const y1 = getNodeY(srcIdx, papers.length);
      const y2 = getNodeY(tgtIdx, papers.length);

      const midX = (x1 + x2) / 2;
      const dist = Math.abs(x2 - x1);
      const arcH = Math.min(140, dist * 0.3);
      const midY = Math.min(y1, y2) - arcH;

      const color = EDGE_COLORS[e.type] || '#888';
      const confidence = e.properties?.confidence ?? 0.5;
      const strokeWidth = 1 + confidence * 2;

      return {
        d: `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`,
        color,
        strokeWidth,
        type: e.type,
        key: `${srcId}-${tgtId}-${i}`,
        midX,
        midY: midY + 12,
      };
    })
    .filter(Boolean);

  // Year markers
  const years = [];
  const startYear = new Date(minDate).getFullYear();
  const endYear = new Date(maxDate).getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const t = new Date(`${y}-01-01`).getTime();
    if (t >= minDate && t <= maxDate) {
      years.push({
        year: y,
        x: PADDING + ((t - minDate) / dateRange) * (width - 2 * PADDING),
      });
    }
  }

  const hovered = hoveredNode ? nodeMap[hoveredNode] : null;

  return (
    <div ref={containerRef} className="graph-canvas timeline-container" data-testid="timeline-view">
      {/* Tooltip for hovered node */}
      {hovered && (
        <div className="timeline-tooltip">
          <strong>{hovered.properties.title}</strong>
          <div className="timeline-tooltip__meta">
            {hovered.properties.authors?.slice(0, 2).join(', ')}
            {hovered.properties.authors?.length > 2 ? ' et al.' : ''}
          </div>
          <div className="timeline-tooltip__meta">
            {hovered.properties.publish_date} · {hovered.properties.citation_count || 0} citations
          </div>
          {hovered.properties.url && (
            <a
              className="timeline-tooltip__link"
              href={hovered.properties.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Open paper →
            </a>
          )}
        </div>
      )}

      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Gradient for timeline axis */}
          <linearGradient id="axisGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--hairline)" stopOpacity="0.3" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--hairline)" stopOpacity="0.3" />
          </linearGradient>
          {/* Glow filter for selected node */}
          <filter id="selectedGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Timeline axis */}
        <line
          x1={PADDING - 20} y1={height - PADDING + 10}
          x2={width - PADDING + 20} y2={height - PADDING + 10}
          stroke="url(#axisGradient)" strokeWidth={2}
        />

        {/* Year grid lines and labels */}
        {years.map(({ year, x }) => (
          <g key={year}>
            <line
              x1={x} y1={PADDING - 20}
              x2={x} y2={height - PADDING + 10}
              stroke="var(--hairline)" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.4}
            />
            <line
              x1={x} y1={height - PADDING + 6}
              x2={x} y2={height - PADDING + 14}
              stroke="var(--ink-subtle)" strokeWidth={1.5}
            />
            <text
              x={x} y={height - PADDING + 28}
              textAnchor="middle" fontSize={12} fontWeight="500"
              fill="var(--ink-muted)"
            >
              {year}
            </text>
          </g>
        ))}

        {/* Arcs */}
        {arcs.map(({ d, color, strokeWidth, type, key, midX, midY }) => (
          <g key={key}>
            <path
              d={d} fill="none" stroke={color}
              strokeWidth={strokeWidth} opacity={0.6}
              strokeLinecap="round"
            />
            <text
              x={midX} y={midY}
              textAnchor="middle" fontSize={8} fontWeight="600"
              fill={color} opacity={0.8}
              style={{ pointerEvents: 'none' }}
            >
              {type}
            </text>
          </g>
        ))}

        {/* Paper nodes */}
        {papers.map((p, idx) => {
          const x = xPos(p.properties.publish_date);
          const y = getNodeY(idx, papers.length);
          const isSelected = selectedNode === p.id;
          const isHovered = hoveredNode === p.id;
          const citations = p.properties?.citation_count || 0;
          const r = BASE_R + Math.min(6, Math.sqrt(citations) * 0.25);
          const color = nodeColor(p);

          return (
            <g
              key={p.id}
              onClick={() => selectNode(p.id)}
              onMouseEnter={() => setHoveredNode(p.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Selection/hover ring */}
              {(isSelected || isHovered) && (
                <circle
                  cx={x} cy={y} r={r + 5}
                  fill="none" stroke={isSelected ? 'var(--primary)' : color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={isSelected ? 1 : 0.6}
                  filter={isSelected ? 'url(#selectedGlow)' : undefined}
                />
              )}

              {/* Node shadow */}
              <circle
                cx={x + 1} cy={y + 1} r={r}
                fill="rgba(0,0,0,0.15)"
              />

              {/* Main node */}
              <circle
                cx={x} cy={y} r={r}
                fill={color}
                stroke={isSelected ? 'var(--primary)' : 'var(--surface-0)'}
                strokeWidth={isSelected ? 2 : 1.5}
              />

              {/* Citation badge */}
              {citations > 0 && (
                <g>
                  <circle
                    cx={x + r - 2} cy={y - r + 2} r={8}
                    fill="var(--surface-3)" stroke="var(--hairline)" strokeWidth={0.5}
                  />
                  <text
                    x={x + r - 2} y={y - r + 5}
                    textAnchor="middle" fontSize={7} fontWeight="600"
                    fill="var(--ink-muted)"
                  >
                    {citations > 999 ? `${(citations / 1000).toFixed(1)}k` : citations}
                  </text>
                </g>
              )}

              {/* Title label */}
              <text
                x={x} y={y - r - 10}
                textAnchor="middle" fontSize={10} fontWeight="500"
                fill={isSelected ? 'var(--ink)' : 'var(--ink-muted)'}
                style={{ pointerEvents: 'none' }}
              >
                {(p.properties.title || '').length > 30
                  ? p.properties.title.slice(0, 30) + '…'
                  : p.properties.title}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="timeline-legend">
        <span className="timeline-legend__item">
          <span className="timeline-legend__dot" style={{ background: 'var(--primary)' }} />
          Larger = more citations
        </span>
        <span className="timeline-legend__item">
          <span className="timeline-legend__line" />
          Thicker = higher confidence
        </span>
      </div>
    </div>
  );
}
