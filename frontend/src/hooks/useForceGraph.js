import { useEffect, useState } from 'react';
import { forceCollide, forceX, forceY } from 'd3-force-3d';

// Shared graph behaviour, so /app and the landing page cannot drift.
//
// react-force-graph sets up only three forces: link, charge and center
// (force-graph/src/canvas-force-graph.js:462-465). There is no force
// pulling a node back toward the middle, so a node with weak or no
// links gets pushed out by the charge force and keeps going — it never
// comes back. `center` only translates the whole layout, it does not
// restrain individual nodes.
//
// That is what the lone dot in the top corner was: a low-citation paper
// that repulsion flung outward. Fix is forceX/forceY, which apply a weak
// spring toward the origin to every node.

const CHARGE = -300;
const LINK_DISTANCE = 70;
const CENTER_PULL = 0.08;

/**
 * Configure forces and return reduced-motion state.
 *
 * @param {object} fgRef - ref to the ForceGraph2D instance
 * @param {object[]} deps - values that should trigger a reheat (size)
 * @param {object} [options]
 * @param {(node: object) => number} [options.collideRadius] - disc radius in
 *   graph pixels. Opt-in, so the landing page's layout is untouched.
 * @returns {boolean} whether motion is allowed
 */
export function useForceGraph(fgRef, deps, { collideRadius } = {}) {
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () => setAnimated(!mq?.matches);
    sync();
    mq?.addEventListener?.('change', sync);
    return () => mq?.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    fg.d3Force('charge')?.strength(CHARGE);
    fg.d3Force('link')?.distance(LINK_DISTANCE);

    // Weak spring back to the middle, so no node escapes the frame.
    // d3-force-3d is the exact package force-graph uses internally
    // (canvas-force-graph.js:462) — already installed, nothing added.
    fg.d3Force('x', forceX(0).strength(CENTER_PULL));
    fg.d3Force('y', forceY(0).strength(CENTER_PULL));

    // Discs have a real radius now, so they can be kept from stacking.
    // forceCollide ships in d3-force-3d, the package force-graph already
    // uses internally — nothing new installed.
    if (typeof collideRadius === 'function') {
      fg.d3Force('collide', forceCollide(collideRadius));
    }

    fg.d3ReheatSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return animated;
}