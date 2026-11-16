import { useEffect, useRef } from 'react';

/**
 * Applies the liquid-glass refraction to an element and returns a ref
 * holding the module's handle, so callers can `refresh()` it after the
 * element resizes (the displacement map is rasterised to fit).
 *
 * src/liquid-glass.js is a plain IIFE attaching to window, and it
 * touches CSS.supports and a 2D canvas at import time — neither of
 * which exists under jsdom. So it is imported lazily behind a support
 * check: where it cannot run, the CSS frosted fallback is simply left
 * in place and the page is fully legible without refraction.
 *
 * Refraction is Chromium-only. Safari and Firefox get the module's
 * frosted fallback and pick up `.lg-fallback`, which the CSS styles.
 * Nothing about meaning may depend on the effect working.
 */
export default function useLiquidGlass(targetRef, options) {
  const glassRef = useRef(null);

  // Serialised so a fresh object literal on every render does not tear
  // the filter down and rebuild the displacement map each time.
  const key = JSON.stringify(options ?? {});

  useEffect(() => {
    const canRender =
      typeof window !== 'undefined' &&
      typeof window.CSS?.supports === 'function' &&
      window.CSS.supports('backdrop-filter', 'url(#x)');

    if (!canRender || !targetRef.current) return undefined;

    let cancelled = false;
    // Side-effect-only module: it attaches window.liquidGlass.
    import('../liquid-glass.js').then(() => {
      if (cancelled || typeof window.liquidGlass !== 'function') return;
      const el = targetRef.current;
      if (!el) return;
      glassRef.current = window.liquidGlass(el, JSON.parse(key));
    });

    return () => {
      cancelled = true;
      glassRef.current?.destroy?.();
      glassRef.current = null;
    };
  }, [targetRef, key]);

  return glassRef;
}