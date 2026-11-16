// Node + edge color maps — the single source of truth for graph styling.
//
// Retuned for the workspace canvas. The old values were the saturated
// Material palette from spec.md §10.2 (#4A90E2, #7ED321, #F5A623 …), which
// sat next to the landing's monochrome ink like a swatch book. These are the
// same hues expressed in OKLCH at one lightness band (L 0.62–0.80,
// C 0.10–0.14), so they read as one palette, stay distinguishable from each
// other, and clear 4.5:1 as text on --surface-2/--surface-3 — FilterPanel,
// StatsPanel and NodeDetailPanel all print these as small text.
//
// Every family below shares one hex constant, so a hue change propagates to
// node types, edge types, gap badges and severity in one edit.

const BLUE = '#5e9ddc';
const GREEN = '#63b37a';
const GOLD = '#dcb05b';
const VIOLET = '#9d81ce';
const RED = '#d56b64';
const ROSE = '#e58f95';
const TEAL = '#4ab9b2';
const ORANGE = '#de8f57';
const AMBER = '#eab26b';
const GRAY = '#878d93';

export const NODE_COLORS = {
  Paper: BLUE,
  Author: GREEN,
  Method: GOLD,
  Dataset: VIOLET,
  Claim: RED,
  Gap: ROSE,
};

export const EDGE_COLORS = {
  CONTRADICTS: RED,
  EXTENDS: GREEN,
  REPLICATES: BLUE,
  REPLICATES_FAILED: ORANGE,
  CHALLENGES: AMBER,
  CITES: GRAY,
  IMPLEMENTS: TEAL,
  DISAGREES_ON_SCOPE: VIOLET,
  INVOLVES: ROSE,  // Gap connection - matches Gap node color
};

// Gap-type badge colors (plan.md Phase 7). Unknown types fall back to gray.
export const GAP_COLORS = {
  unresolved_contradiction: RED,
  stale_claim: ORANGE,
  low_density: AMBER,
  bridge_opportunity: BLUE,
};
export const gapColor = (type) => GAP_COLORS[type] || GRAY;

// Pure accessors with fallbacks, so colors can be unit-tested without a canvas.
export const nodeColor = (node) => NODE_COLORS[node?.label] || GRAY;
export const linkColor = (edge) => EDGE_COLORS[edge?.type] || '#ccc';

// Severity scale (0 = low, 1 = high) mapped to the same red/amber/green the
// graph uses, so a gap's urgency reads with the same semantic vocabulary as a
// CONTRADICTS edge (red) or an EXTENDS edge (green). Single source of truth.
export const severityColor = (severity) => {
  if (severity >= 0.66) return RED;
  if (severity >= 0.33) return AMBER;
  return GREEN;
};
