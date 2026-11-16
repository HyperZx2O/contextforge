import rag from '../../data/demo/rag_2024.json';
import llms from '../../data/demo/llms_2024.json';
import diffusion from '../../data/demo/diffusion_2024.json';

// Demo graphs, bundled. Relationships, confidence scores, evidence
// quotes and gap analyses are all pre-computed in these files, so a
// demo needs no backend, no Neo4j, no Postgres and no LLM call.

const RAW = { rag_2024: rag, llms_2024: llms, diffusion_2024: diffusion };

// Counts derived from the arrays, never read from the JSON's own
// paper_count/edge_count fields. Those are illustrative spec figures
// that already shipped as 94/120/87 and were rendered to visitors.
export const DEMO_TOPICS = Object.entries(RAW).map(([id, d]) => ({
  id,
  label: d.label,
  paper_count: d.papers.length,
  edge_count: d.edges.length,
  gap_count: d.gaps.length,
}));

// Offline there is no Neo4j element_id to identify a Gap node, so ids
// are minted here. They must be identical in the node list and the gap
// list or the virtual edges below will not match up.
const gapId = (topic, i) => `gap:${topic}:${i}`;

/**
 * Virtual INVOLVES edges from each gap to the papers it affects, so gap
 * nodes are not floating islands in the force layout.
 *
 * Shared with the API path in useGraph.js — duplicated, the two would
 * drift and gaps would connect in one mode only.
 */
export function synthesizeGapEdges(nodes, gaps) {
  const ids = new Set(nodes.map((n) => n.id));
  const edges = [];
  for (const gap of gaps) {
    if (!ids.has(gap.id)) continue;
    for (const target of gap.affected_nodes || []) {
      if (!ids.has(target)) continue;
      edges.push({
        source: gap.id,
        target,
        type: 'INVOLVES',
        properties: {
          confidence: gap.severity || 1,
          evidence_quote: gap.description || '',
          is_gap_edge: true,
        },
      });
    }
  }
  return edges;
}

/** Build the exact node/edge/gap shape the /graph endpoints return. */
export function buildDemoGraph(topicId) {
  const d = RAW[topicId];
  if (!d) return null;

  const gaps = d.gaps.map((g, i) => ({ id: gapId(topicId, i), ...g }));
  const nodes = [
    ...d.papers.map((p) => ({ id: p.arxiv_id, label: 'Paper', properties: { ...p } })),
    ...gaps.map((g) => ({
      id: g.id,
      label: 'Gap',
      properties: {
        gap_type: g.gap_type,
        description: g.description,
        affected_nodes: g.affected_nodes,
        severity: g.severity,
      },
    })),
  ];

  return { nodes, edges: synthesizeGapEdges(nodes, gaps), gaps };
}