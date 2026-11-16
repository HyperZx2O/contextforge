// How the workspace graph is drawn: disc size, stroke vocabulary, and which
// nodes carry a label at rest.
//
// The radius lives here rather than in GraphCanvas because force-graph derives
// everything else from it. It computes a node's radius as
// `sqrt(nodeVal) * nodeRelSize` and reuses that number to trim link ends,
// place arrowheads, size the pointer target and pad zoomToFit
// (force-graph.mjs:571, 720-721, 1319). The painter used to draw its own
// unrelated number, so every one of those disagreed with the disc on screen:
// links started in mid-air, arrows floated, and hovering fired well off the
// dot. `nodeVal` is now derived from `nodeRadius`, so there is one number.
//
// FilterPanel renders its swatches from the same vocabulary, so the legend
// cannot drift from the canvas.

/** Smallest disc, in graph pixels. Matches the old 3px floor. */
export const NODE_RADIUS_MIN = 3.2;
/** Largest disc, so a 10k-citation paper cannot swamp the layout. */
export const NODE_RADIUS_MAX = 18;
const NODE_RADIUS_SCALE = 0.55;

/** Disc radius in graph pixels — the number force-graph sees everywhere. */
export const nodeRadius = (node) => {
  const citations = Number(node?.properties?.citation_count) || 0;
  const raw = NODE_RADIUS_MIN + Math.sqrt(Math.max(0, citations)) * NODE_RADIUS_SCALE;
  return Math.min(NODE_RADIUS_MAX, raw);
};

/** force-graph squares nodeVal before scaling, so hand it the area. */
export const nodeVal = (node) => nodeRadius(node) ** 2;

/**
 * nodeRelSize must stay 1: `sqrt(nodeVal) * NODE_REL_SIZE === nodeRadius`.
 * Anything else reintroduces the mismatch this module exists to remove.
 */
export const NODE_REL_SIZE = 1;

/** Collision padding in graph pixels — keeps discs and labels from stacking. */
export const collideRadius = (node) => nodeRadius(node) + 2;

// Stroke vocabulary. Same semantics as the landing page: contradictions
// dashed, challenges dotted, citations a thin hairline. INVOLVES keeps its
// own dash so gap edges stay recognisable.
const EDGE_STYLE = {
  CONTRADICTS: { dash: [6, 4], weight: 1.5 },
  EXTENDS: { dash: null, weight: 1.1 },
  REPLICATES: { dash: null, weight: 1.1 },
  REPLICATES_FAILED: { dash: [6, 4], weight: 1.1 },
  CHALLENGES: { dash: [2, 4], weight: 1.1 },
  CITES: { dash: null, weight: 0.8 },
  IMPLEMENTS: { dash: null, weight: 1.8 },
  DISAGREES_ON_SCOPE: { dash: null, weight: 1.1 },
  INVOLVES: { dash: [4, 4], weight: 1.2 },
};

export const edgeDash = (type) => EDGE_STYLE[type]?.dash ?? undefined;

/** Base stroke weight for a relationship type, before confidence. */
export const edgeWeight = (type) => EDGE_STYLE[type]?.weight ?? 1;

/**
 * Confidence still modulates the stroke, but only within ±30% of the type's
 * base weight — enough to read, not enough to turn a hairline into a slab
 * (the old `1 + conf * 3` drew every edge at 1–4px).
 */
export const linkWidth = (edge) => {
  const conf = Number(edge?.properties?.confidence ?? 0.5);
  const clamped = Math.min(1, Math.max(0, conf));
  return edgeWeight(edge?.type) * (0.7 + 0.6 * clamped);
};

/** Links arrive with either ids or node objects on each end. */
export const endId = (end) => (end && typeof end === 'object' ? end.id : end);

/** Stable identity for an edge while the simulation mutates source/target. */
export const edgeKey = (edge) =>
  `${endId(edge?.source)}->${endId(edge?.target)}:${edge?.type}`;

/** How many at-rest labels the canvas will draw. */
export const LABEL_CAP = 14;
const LABEL_FRACTION = 0.35;

/**
 * Which nodes get a label at rest: the most-cited ~35%, capped, plus the
 * current selection so a clicked node is always named. The old painter
 * labelled nothing at rest, leaving an unlabelled blob until you hovered it.
 */
export const atRestLabelIds = (nodes, { always = [] } = {}) => {
  const ids = new Set(always.filter(Boolean));
  if (!Array.isArray(nodes) || nodes.length === 0) return ids;

  const ranked = [...nodes].sort(
    (a, b) =>
      (Number(b?.properties?.citation_count) || 0) -
      (Number(a?.properties?.citation_count) || 0),
  );
  const budget = Math.min(LABEL_CAP, Math.max(2, Math.round(nodes.length * LABEL_FRACTION)));
  for (const node of ranked.slice(0, budget)) {
    if (node?.id != null) ids.add(node.id);
  }
  return ids;
};
