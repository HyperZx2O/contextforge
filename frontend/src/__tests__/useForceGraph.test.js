import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useForceGraph } from '../hooks/useForceGraph.js';

// force-graph wires only link, charge and center
// (force-graph/src/canvas-force-graph.js:462-465). Nothing pulls a
// node back, so a weakly-linked node gets repelled out of frame and
// never returns. These assertions fail if that regresses.
describe('useForceGraph', () => {
  const forces = {};
  let fg;

  beforeEach(() => {
    for (const k of Object.keys(forces)) delete forces[k];
    fg = {
      d3Force: vi.fn((name) => forces[name]),
      d3ReheatSimulation: vi.fn(),
    };
    forces.charge = { strength: vi.fn() };
    forces.link = { distance: vi.fn() };
    forces.x = { strength: vi.fn() };
    forces.y = { strength: vi.fn() };
  });

  it('installs a centring force on both axes', () => {
    const ref = { current: fg };
    renderHook(() => useForceGraph(ref, [{ width: 800, height: 600 }]));

    // A force must be attached, not merely requested.
    expect(fg.d3Force).toHaveBeenCalledWith('x', expect.objectContaining({ initialize: expect.any(Function) }));
    expect(fg.d3Force).toHaveBeenCalledWith('y', expect.objectContaining({ initialize: expect.any(Function) }));
    expect(fg.d3ReheatSimulation).toHaveBeenCalled();
  });

  it('tunes charge and link distance', () => {
    const ref = { current: fg };
    renderHook(() => useForceGraph(ref, [{ width: 800, height: 600 }]));

    expect(forces.charge.strength).toHaveBeenCalledWith(expect.any(Number));
    expect(forces.link.distance).toHaveBeenCalledWith(expect.any(Number));
  });

  it('re-runs when the canvas size changes', () => {
    const ref = { current: fg };
    const { rerender } = renderHook(({ size }) => useForceGraph(ref, [size]), {
      initialProps: { size: { width: 800, height: 600 } },
    });
    fg.d3ReheatSimulation.mockClear();

    rerender({ size: { width: 1200, height: 600 } });
    expect(fg.d3ReheatSimulation).toHaveBeenCalled();
  });

  it('reports motion allowed when reduced-motion is off', () => {
    const ref = { current: fg };
    const { result } = renderHook(() => useForceGraph(ref, []));
    expect(result.current).toBe(true);
  });
});