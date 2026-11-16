import Lenis from 'lenis';

// Lenis is scoped to the landing page only.
//
// /app is a full-height graph workspace with its own panels and scroll
// containers. Interpolating its scroll would fight the canvas and make
// the graph feel laggy to pan around. So the instance is created when
// the landing mounts and destroyed when it unmounts — navigating to
// /app hands scrolling back to the browser untouched.

let instance = null;
// Set by TopNav so anchor navigation can also dismiss the mobile sheet.
let closeMobileNav = null;

// Matches the fixed nav pill's height plus breathing room.
const ANCHOR_OFFSET = -80;

export function startLenis() {
  // Smooth scrolling is motion. Skip it entirely when the reader has
  // asked for less — the page then uses native scrolling, which is
  // what the prefers-reduced-motion branch of the CSS assumes.
  if (typeof window === 'undefined') return null;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return null;
  if (instance) return instance;

  instance = new Lenis({
    duration: 1.1,
    // Exponential-out: fast pickup, long settle. Matches --ease-out.
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
    // Native touch scrolling is already smooth and Lenis's touch
    // emulation feels worse on phones.
    syncTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
  });

  let frame = 0;
  const raf = (time) => {
    instance?.raf(time);
    frame = requestAnimationFrame(raf);
  };
  frame = requestAnimationFrame(raf);
  instance.__cfFrame = frame;

  return instance;
}

export function stopLenis() {
  if (!instance) return;
  cancelAnimationFrame(instance.__cfFrame);
  instance.destroy();
  instance = null;
}

/**
 * Scroll to an in-page section, clearing the fixed nav pill.
 * Falls back to a native jump when Lenis is not running.
 */
export function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return false;

  if (instance) {
    instance.scrollTo(target, { offset: ANCHOR_OFFSET, duration: 1.2 });
  } else {
    const top = target.getBoundingClientRect().top + window.scrollY + ANCHOR_OFFSET;
    window.scrollTo({ top, behavior: 'auto' });
  }
  return true;
}

/** Route an in-page href through the controller. Returns true if handled. */
export function handleAnchorClick(e, href) {
  if (!href?.startsWith('#')) return false;
  const id = href.slice(1);
  if (!id) return false;
  e.preventDefault();
  closeMobileNav?.();
  scrollToId(id);
  return true;
}

export function scrollToTop() {
  if (instance) {
    instance.scrollTo(0, { duration: 1.2 });
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

export function setNavCloser(fn) {
  closeMobileNav = fn;
}