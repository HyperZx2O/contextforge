import { describe, it, expect } from 'vitest';
import {
  NODE_REL_SIZE,
  atRestLabelIds,
  edgeDash,
  edgeKey,
  edgeWeight,
  linkWidth,
  nodeRadius,
  nodeVal,
} from '../constants/graphVisuals.js';

const paper = (citations) => ({ id: `p${citations}`, label: 'Paper', properties: { citation_count: citations } });

describe('graphVisuals', () => {
  // force-graph draws an arc of radius sqrt(nodeVal) * nodeRelSize, and reuses
  // that number for link trimming, arrowheads, hit targets and zoomToFit. If
  // this drifts, links stop touching the discs again.
  it('keeps the radius force-graph computes identical to the drawn radius', () => {
    expect(NODE_REL_SIZE).toBe(1);
    for (const citations of [0, 1, 5, 42, 137, 1000, 100000]) {
      const node = paper(citations);
      expect(Math.sqrt(nodeVal(node)) * NODE_REL_SIZE).toBeCloseTo(nodeRadius(node), 10);
    }
  });

  it('scales the disc with citations, within sane bounds', () => {
    expect(nodeRadius(paper(0))).toBeGreaterThan(0);
    expect(nodeRadius(paper(500))).toBeGreaterThan(nodeRadius(paper(5)));
    expect(nodeRadius(paper(10 ** 9))).toBeLessThanOrEqual(18);
    expect(nodeRadius({})).toBeCloseTo(nodeRadius(paper(0)), 10);
  });

  it('codes relationship types by stroke, not only colour', () => {
    expect(edgeDash('CONTRADICTS')).toEqual([6, 4]);
    expect(edgeDash('CHALLENGES')).toEqual([2, 4]);
    expect(edgeDash('CITES')).toBeUndefined();
    expect(edgeDash('NOT_A_TYPE')).toBeUndefined();
    expect(edgeWeight('IMPLEMENTS')).toBeGreaterThan(edgeWeight('CITES'));
    expect(edgeWeight('NOT_A_TYPE')).toBe(1);
  });

  it('lets confidence modulate stroke weight without swamping the type', () => {
    const edge = (confidence) => ({ type: 'EXTENDS', properties: { confidence } });
    const base = edgeWeight('EXTENDS');
    expect(linkWidth(edge(0.5))).toBeCloseTo(base, 10);
    expect(linkWidth(edge(1))).toBeGreaterThan(linkWidth(edge(0.1)));
    expect(linkWidth(edge(1))).toBeLessThanOrEqual(base * 1.3 + 1e-9);
    expect(linkWidth(edge(0))).toBeGreaterThanOrEqual(base * 0.7 - 1e-9);
    expect(linkWidth({ type: 'EXTENDS' })).toBeCloseTo(linkWidth(edge(0.5)), 10);
  });

  it('keys an edge the same before and after the simulation resolves ends', () => {
    const resolved = { source: { id: 'a' }, target: { id: 'b' }, type: 'CITES' };
    const raw = { source: 'a', target: 'b', type: 'CITES' };
    expect(edgeKey(resolved)).toBe(edgeKey(raw));
  });

  it('labels the most-cited nodes at rest, capped at 14', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => paper(i));
    const ids = atRestLabelIds(nodes);
    expect(ids.size).toBe(14);
    expect(ids.has('p99')).toBe(true);
    expect(ids.has('p0')).toBe(false);
  });

  it('always labels the selection, even when it is not a top paper', () => {
    const nodes = [paper(500), paper(400), paper(300), paper(0)];
    const ids = atRestLabelIds(nodes, { always: ['p0'] });
    expect(ids.has('p0')).toBe(true);
    expect(ids.has('p500')).toBe(true);
  });

  it('still labels a small graph', () => {
    const ids = atRestLabelIds([paper(3), paper(1), paper(2)]);
    expect(ids.size).toBeGreaterThanOrEqual(2);
    expect(atRestLabelIds([]).size).toBe(0);
    expect(atRestLabelIds(undefined).size).toBe(0);
  });
});
