// Node + edge color maps — the single source of truth for graph styling.
// Values copied verbatim from spec.md §10.2. GraphCanvas (Phase 4) imports
// from here rather than redefining them.
export const NODE_COLORS = {
  Paper: '#4A90E2',
  Author: '#7ED321',
  Method: '#F5A623',
  Dataset: '#9B59B6',
  Claim: '#E74C3C',
  Gap: '#FF6B6B',
};

export const EDGE_COLORS = {
  CONTRADICTS: '#E74C3C',
  EXTENDS: '#27AE60',
  REPLICATES: '#3498DB',
  REPLICATES_FAILED: '#E67E22',
  CHALLENGES: '#F39C12',
  CITES: '#95A5A6',
  IMPLEMENTS: '#1ABC9C',
  DISAGREES_ON_SCOPE: '#8E44AD',
};

// Gap-type badge colors (plan.md Phase 7). Unknown types fall back to gray.
export const GAP_COLORS = {
  unresolved_contradiction: '#E74C3C',
  stale_claim: '#E67E22',
  low_density: '#F1C40F',
  bridge_opportunity: '#3498DB',
};
export const gapColor = (type) => GAP_COLORS[type] || '#888';

// Pure accessors with fallbacks, so colors can be unit-tested without a canvas.
export const nodeColor = (node) => NODE_COLORS[node?.label] || '#888';
export const linkColor = (edge) => EDGE_COLORS[edge?.type] || '#ccc';

// Severity scale (0 = low, 1 = high) mapped to the same red/amber/green the
// graph uses, so a gap's urgency reads with the same semantic vocabulary as a
// CONTRADICTS edge (red) or an EXTENDS edge (green). Single source of truth.
export const severityColor = (severity) => {
  if (severity >= 0.66) return '#E74C3C';
  if (severity >= 0.33) return '#E8A33D';
  return '#27AE60';
};
