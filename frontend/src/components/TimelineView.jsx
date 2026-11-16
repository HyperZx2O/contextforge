import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import useGraphStore from '../store/graphStore.js';
import { EDGE_COLORS } from '../constants/colors.js';

const NODE_BASE_R = 14;
const NODE_MIN_R = 8;
const ROW_HEIGHT = 44;
const NODE_PAD_X = 28;

// Source glyph shapes
function drawSourceGlyph(ctx, source, cx, cy, r) {
  const s = r * 0.35;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  if (source === 'github') {
    // Square
    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
  } else if (source === 'news') {
    // Diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fill();
  } else {
    // Circle (arxiv default)
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export default function TimelineView() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectedNode = useGraphStore((s) => s.selectedNode);

  const [hoveredNode, setHoveredNode] = useState(null);
  const [expandedNode, setExpandedNode] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth || 800);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const papers = useMemo(() => nodes
    .filter((n) => n.label === 'Paper' && n.properties?.publish_date)
    .sort((a, b) => a.properties.publish_date.localeCompare(b.properties.publish_date)),
    [nodes]
  );

  // Group papers by year
  const yearGroups = useMemo(() => {
    const groups = {};
    papers.forEach((p) => {
      const year = new Date(p.properties.publish_date).getFullYear();
      if (!groups[year]) groups[year] = [];
      groups[year].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [papers]);

  // Build edge lookup
  const connections = useMemo(() => {
    const map = {};
    const paperIds = new Set(papers.map((p) => p.id));
    edges.forEach((e) => {
      if (e.type === 'INVOLVES') return;
      const src = e.source?.id ?? e.source;
      const tgt = e.target?.id ?? e.target;
      if (!paperIds.has(src) || !paperIds.has(tgt)) return;
      if (!map[src]) map[src] = [];
      if (!map[tgt]) map[tgt] = [];
      map[src].push({ targetId: tgt, edge: e });
      map[tgt].push({ targetId: src, edge: e });
    });
    return map;
  }, [papers, edges]);

  // Connected IDs for focus mode
  const connectedIds = useMemo(() => {
    const id = hoveredNode || expandedNode || selectedNode;
    if (!id) return new Set();
    const ids = new Set([id]);
    (connections[id] || []).forEach((c) => ids.add(c.targetId));
    return ids;
  }, [hoveredNode, expandedNode, selectedNode, connections]);

  const hasFocus = connectedIds.size > 0;

  // Get node color by strongest relationship type
  const getNodeColor = useCallback((paperId) => {
    const conns = connections[paperId] || [];
    if (conns.length === 0) return '#5e6ad2'; // default lavender
    const strongest = conns.reduce((best, c) => {
      const conf = c.edge.properties?.confidence ?? 0;
      const bestConf = best?.edge.properties?.confidence ?? 0;
      return conf > bestConf ? c : best;
    }, conns[0]);
    return EDGE_COLORS[strongest.edge.type] || '#5e6ad2';
  }, [connections]);

  // Get average confidence for a paper
  const getAvgConfidence = useCallback((paperId) => {
    const conns = connections[paperId] || [];
    if (conns.length === 0) return 0;
    const sum = conns.reduce((s, c) => s + (c.edge.properties?.confidence ?? 0), 0);
    return sum / conns.length;
  }, [connections]);

  // Handle node click
  const handleNodeClick = useCallback((paperId) => {
    setExpandedNode((prev) => (prev === paperId ? null : paperId));
  }, []);

  useEffect(() => {
    if (selectedNode && selectedNode !== expandedNode) {
      setExpandedNode(selectedNode);
    }
  }, [selectedNode]);

  if (papers.length === 0) {
    return (
      <div className="graph-canvas" data-testid="timeline-empty">
        <div className="timeline-empty">
          <svg className="timeline-empty__icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="24" cy="24" r="20" />
            <line x1="12" y1="24" x2="36" y2="24" />
            <circle cx="16" cy="24" r="2" fill="currentColor" />
            <circle cx="24" cy="24" r="2" fill="currentColor" />
            <circle cx="32" cy="24" r="2" fill="currentColor" />
          </svg>
          <div className="timeline-empty__text">No papers with dates to show in timeline.</div>
          <div className="timeline-empty__hint">Run the pipeline or load a demo to populate the graph.</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="graph-canvas timeline-container" data-testid="timeline-view">
      {/* Legend */}
      <div className="timeline-legend">
        <div className="timeline-legend__group">
          <div className="timeline-legend__group-title">Relationship</div>
          {Object.entries(EDGE_COLORS).filter(([k]) => k !== 'INVOLVES').map(([type, color]) => (
            <span key={type} className="timeline-legend__item">
              <span className="timeline-legend__dot" style={{ background: color }} />
              {type.replace(/_/g, ' ').toLowerCase()}
            </span>
          ))}
        </div>
        <div className="timeline-legend__group">
          <div className="timeline-legend__group-title">Source</div>
          <span className="timeline-legend__item">
            <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="rgba(255,255,255,0.85)" /></svg>
            arXiv
          </span>
          <span className="timeline-legend__item">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" fill="rgba(255,255,255,0.85)" /></svg>
            GitHub
          </span>
          <span className="timeline-legend__item">
            <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1 11,6 6,11 1,6" fill="rgba(255,255,255,0.85)" /></svg>
            News
          </span>
        </div>
        <div className="timeline-legend__group">
          <div className="timeline-legend__group-title">Node</div>
          <span className="timeline-legend__item">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" fill="#5e6ad2" />
              <circle cx="8" cy="8" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            </svg>
            Inner ring = confidence
          </span>
          <span className="timeline-legend__item">
            <span style={{ fontSize: '10px', color: 'var(--ink-subtle)' }}>Larger = more citations</span>
          </span>
        </div>
      </div>

      {/* Year sections */}
      {yearGroups.map(([year, yearPapers], sectionIdx) => (
        <YearSection
          key={year}
          year={year}
          papers={yearPapers}
          sectionIdx={sectionIdx}
          containerWidth={containerWidth}
          connections={connections}
          getNodeColor={getNodeColor}
          getAvgConfidence={getAvgConfidence}
          hoveredNode={hoveredNode}
          expandedNode={expandedNode}
          selectedNode={selectedNode}
          connectedIds={connectedIds}
          hasFocus={hasFocus}
          onHover={setHoveredNode}
          onClick={handleNodeClick}
          onSelect={selectNode}
        />
      ))}

      {/* Floating hover card */}
      {hoveredNode && !expandedNode && (
        <HoverCard
          paper={papers.find((p) => p.id === hoveredNode)}
          connections={connections[hoveredNode] || []}
          papers={papers}
        />
      )}

      {/* Expanded detail card (click) */}
      {expandedNode && (
        <ExpandedCard
          paper={papers.find((p) => p.id === expandedNode)}
          connections={connections[expandedNode] || []}
          papers={papers}
          onClose={() => setExpandedNode(null)}
          onViewGraph={(id) => selectNode(id)}
        />
      )}
    </div>
  );
}

// ── Year Section ─────────────────────────────────────────────────────────────

function YearSection({
  year, papers, sectionIdx, containerWidth,
  connections, getNodeColor, getAvgConfidence,
  hoveredNode, expandedNode, selectedNode, connectedIds, hasFocus,
  onHover, onClick, onSelect,
}) {
  const svgRef = useRef(null);
  const [nodePositions, setNodePositions] = useState([]);

  // Layout nodes: horizontal by date, staggered vertically
  useEffect(() => {
    if (!svgRef.current) return;
    const svgWidth = containerWidth - 48; // padding

    // Sort by date within year
    const sorted = [...papers].sort((a, b) =>
      a.properties.publish_date.localeCompare(b.properties.publish_date)
    );

    const positions = [];
    const occupied = []; // track occupied rows to avoid overlap

    sorted.forEach((paper) => {
      const date = new Date(paper.properties.publish_date);
      const monthFrac = (date.getMonth() + date.getDate() / 30) / 12;
      const x = NODE_PAD_X + monthFrac * (svgWidth - 2 * NODE_PAD_X);

      // Find first row that doesn't overlap
      const citations = paper.properties?.citation_count || 0;
      const r = NODE_BASE_R + Math.min(8, Math.sqrt(citations) * 0.2);
      let y = 0;
      for (let row = 0; ; row++) {
        const candidateY = 24 + row * ROW_HEIGHT;
        const overlaps = occupied.some(
          (o) => Math.abs(o.x - x) < (r + o.r + 8) && Math.abs(o.y - candidateY) < (r + o.r + 4)
        );
        if (!overlaps) {
          y = candidateY;
          occupied.push({ x, y, r });
          break;
        }
      }

      positions.push({ paper, x, y, r });
    });

    setNodePositions(positions);
  }, [papers, containerWidth]);

  const svgHeight = Math.max(60, ...nodePositions.map((p) => p.y + p.r + 20));

  return (
    <div className="timeline-section" style={{ animationDelay: `${sectionIdx * 60}ms` }}>
      <div className="timeline-section__header">
        <span className="timeline-section__year">{year}</span>
        <span className="timeline-section__count">
          {papers.length} paper{papers.length !== 1 ? 's' : ''}
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${containerWidth - 48} ${svgHeight}`}
        className="timeline-svg"
        data-testid="timeline-svg"
      >
        <defs>
          <filter id={`glow-${year}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {nodePositions.map(({ paper: srcPaper }) => {
          const conns = connections[srcPaper.id] || [];
          return conns.map((conn, i) => {
            const tgtPos = nodePositions.find((p) => p.paper.id === conn.targetId);
            if (!tgtPos) return null;

            const isHighlighted = hasFocus && connectedIds.has(srcPaper.id) && connectedIds.has(conn.targetId);
            const isDimmed = hasFocus && !isHighlighted;
            const color = EDGE_COLORS[conn.edge.type] || '#555';
            const isPrimary = ['CONTRADICTS', 'EXTENDS', 'CHALLENGES', 'REPLICATES_FAILED'].includes(conn.edge.type);

            const x1 = tgtPos.x > srcPaper.x
              ? nodePositions.find((p) => p.paper.id === srcPaper.id).x + nodePositions.find((p) => p.paper.id === srcPaper.id).r
              : nodePositions.find((p) => p.paper.id === srcPaper.id).x - nodePositions.find((p) => p.paper.id === srcPaper.id).r;
            const y1 = nodePositions.find((p) => p.paper.id === srcPaper.id).y;
            const x2 = tgtPos.x > srcPaper.x
              ? tgtPos.x - tgtPos.r
              : tgtPos.x + tgtPos.r;
            const y2 = tgtPos.y;

            const midX = (x1 + x2) / 2;
            const midY = Math.min(y1, y2) - 20;

            return (
              <g key={`${srcPaper.id}-${conn.targetId}-${i}`}>
                <path
                  d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isPrimary ? undefined : '4 3'}
                  opacity={isDimmed ? 0.08 : isHighlighted ? 0.9 : 0.35}
                  strokeLinecap="round"
                  style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                />
                {isHighlighted && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill={color}
                    style={{ pointerEvents: 'none' }}
                  >
                    {conn.edge.type.replace(/_/g, ' ')}
                  </text>
                )}
              </g>
            );
          });
        })}

        {/* Nodes */}
        {nodePositions.map(({ paper, x, y, r }) => {
          const color = getNodeColor(paper.id);
          const confidence = getAvgConfidence(paper.id);
          const isHovered = hoveredNode === paper.id;
          const isExpanded = expandedNode === paper.id;
          const isSelected = selectedNode === paper.id;
          const isDimmed = hasFocus && !connectedIds.has(paper.id);
          const source = paper.properties?.source || 'arxiv';

          return (
            <g
              key={paper.id}
              onClick={() => onClick(paper.id)}
              onMouseEnter={() => onHover(paper.id)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: 'pointer' }}
              data-testid="timeline-node"
            >
              {/* Glow on hover/selection */}
              {(isHovered || isExpanded || isSelected) && (
                <circle
                  cx={x} cy={y} r={r + 6}
                  fill="none"
                  stroke={isSelected ? 'var(--primary)' : color}
                  strokeWidth={isSelected ? 2 : 1.5}
                  opacity={isSelected ? 0.8 : 0.5}
                  filter={isSelected ? `url(#glow-${year})` : undefined}
                  style={{ transition: 'opacity 0.15s' }}
                />
              )}

              {/* Main node */}
              <circle
                cx={x} cy={y} r={r}
                fill={isDimmed ? '#333' : color}
                opacity={isDimmed ? 0.3 : 1}
                style={{ transition: 'fill 0.2s, opacity 0.2s' }}
              />

              {/* Inner confidence ring */}
              {confidence > 0 && !isDimmed && (
                <circle
                  cx={x} cy={y} r={r * 0.6}
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={1 + confidence * 2}
                  style={{ transition: 'stroke-width 0.2s' }}
                />
              )}

              {/* Source glyph */}
              {!isDimmed && (
                <circle cx={x} cy={y} r={0} fill="none" />
              )}
              {!isDimmed && (() => {
                const s = r * 0.28;
                if (source === 'github') {
                  return (
                    <rect
                      x={x - s} y={y - s}
                      width={s * 2} height={s * 2}
                      fill="rgba(255,255,255,0.85)"
                      rx={1}
                    />
                  );
                }
                if (source === 'news') {
                  return (
                    <polygon
                      points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`}
                      fill="rgba(255,255,255,0.85)"
                    />
                  );
                }
                return (
                  <circle
                    cx={x} cy={y} r={s}
                    fill="rgba(255,255,255,0.85)"
                  />
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Hover Card (follows cursor) ──────────────────────────────────────────────

function HoverCard({ paper, connections: conns, papers }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => {
      setPos({ x: e.clientX + 14, y: e.clientY + 14 });
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  if (!paper) return null;

  const { title, publish_date, citation_count, authors, abstract, source, url } = paper.properties || {};
  const authorNames = (authors || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  return (
    <div
      className="timeline-hover-card"
      style={{ left: pos.x, top: pos.y }}
      data-testid="timeline-hover-card"
    >
      <div className="timeline-hover-card__header">
        <span className="timeline-hover-card__source">{source || 'arxiv'}</span>
        <span className="timeline-hover-card__date">{publish_date}</span>
      </div>
      <div className="timeline-hover-card__title">{title || paper.id}</div>
      {authorNames && (
        <div className="timeline-hover-card__authors">
          {authorNames}{(authors || []).length > 3 ? ' et al.' : ''}
        </div>
      )}
      <div className="timeline-hover-card__stats">
        <span>{citation_count || 0} citations</span>
        <span>{conns.length} connection{conns.length !== 1 ? 's' : ''}</span>
      </div>
      {abstract && (
        <p className="timeline-hover-card__abstract">
          {abstract.length > 140 ? abstract.slice(0, 140) + '…' : abstract}
        </p>
      )}
      {/* Connected papers */}
      {conns.length > 0 && (
        <div className="timeline-hover-card__connections">
          {conns.slice(0, 4).map((c) => {
            const target = papers.find((p) => p.id === c.targetId);
            const relType = c.edge.type;
            const conf = c.edge.properties?.confidence;
            return (
              <div key={c.targetId} className="timeline-hover-card__conn">
                <span
                  className="timeline-hover-card__conn-dot"
                  style={{ background: EDGE_COLORS[relType] || '#888' }}
                />
                <span className="timeline-hover-card__conn-type">{relType.replace(/_/g, ' ')}</span>
                <span className="timeline-hover-card__conn-title">
                  {target?.properties?.title?.slice(0, 40) || c.targetId}
                  {(target?.properties?.title?.length || 0) > 40 ? '…' : ''}
                </span>
                {conf != null && (
                  <span className="timeline-hover-card__conn-conf">
                    {Math.round(conf * 100)}%
                  </span>
                )}
              </div>
            );
          })}
          {conns.length > 4 && (
            <div className="timeline-hover-card__conn-more">
              +{conns.length - 4} more
            </div>
          )}
        </div>
      )}
      {url && (
        <a
          className="timeline-hover-card__link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Open paper <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

// ── Expanded Card (click, persistent) ────────────────────────────────────────

function ExpandedCard({ paper, connections: conns, papers, onClose, onViewGraph }) {
  if (!paper) return null;

  const { title, publish_date, citation_count, authors, abstract, source, url } = paper.properties || {};
  const authorNames = (authors || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean);

  return (
    <div className="timeline-expanded-card" data-testid="timeline-expanded-card">
      <div className="timeline-expanded-card__header">
        <span className="timeline-expanded-card__source">{source || 'arxiv'}</span>
        <button className="timeline-expanded-card__close" onClick={onClose} aria-label="Close details">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="timeline-expanded-card__title">{title || paper.id}</div>
      {authorNames.length > 0 && (
        <div className="timeline-expanded-card__authors">
          {authorNames.slice(0, 5).join(', ')}
          {authorNames.length > 5 ? ` et al. (${authorNames.length})` : ''}
        </div>
      )}
      <div className="timeline-expanded-card__meta">
        <span>{publish_date}</span>
        <span>{citation_count || 0} citations</span>
        <span>{conns.length} connection{conns.length !== 1 ? 's' : ''}</span>
      </div>
      {abstract && (
        <p className="timeline-expanded-card__abstract">
          {abstract.length > 300 ? abstract.slice(0, 300) + '…' : abstract}
        </p>
      )}
      {/* Connections list */}
      {conns.length > 0 && (
        <div className="timeline-expanded-card__connections">
          <div className="timeline-expanded-card__connections-title">Relationships</div>
          {conns.map((c) => {
            const target = papers.find((p) => p.id === c.targetId);
            const relType = c.edge.type;
            const conf = c.edge.properties?.confidence;
            const evidence = c.edge.properties?.evidence_quote;
            return (
              <div key={c.targetId} className="timeline-expanded-card__conn">
                <span
                  className="timeline-expanded-card__conn-dot"
                  style={{ background: EDGE_COLORS[relType] || '#888' }}
                />
                <div className="timeline-expanded-card__conn-info">
                  <span className="timeline-expanded-card__conn-type">{relType.replace(/_/g, ' ')}</span>
                  <span className="timeline-expanded-card__conn-target">
                    {target?.properties?.title || c.targetId}
                  </span>
                  {evidence && (
                    <span className="timeline-expanded-card__conn-evidence">"{evidence.slice(0, 80)}…"</span>
                  )}
                </div>
                {conf != null && (
                  <span className="timeline-expanded-card__conn-conf">
                    {Math.round(conf * 100)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="timeline-expanded-card__actions">
        {url && (
          <a
            className="timeline-expanded-card__btn timeline-expanded-card__btn--primary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Open paper <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        )}
        <button
          className="timeline-expanded-card__btn"
          onClick={() => onViewGraph(paper.id)}
        >
          View in graph
        </button>
      </div>
    </div>
  );
}
