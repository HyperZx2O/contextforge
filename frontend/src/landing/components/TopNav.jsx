import { useEffect, useRef, useState } from 'react';
import BrandMark from '../../components/BrandMark.jsx';
import AccountMenu from '../../components/AccountMenu.jsx';
import useLiquidGlass from '../../hooks/useLiquidGlass.js';
import { navigate } from '../useRoute.js';
import { handleAnchorClick, setNavCloser } from '../lenis.js';

// N10. The nav is a full-width stadium at the top of the page and
// collapses into a shorter pill past MORPH_AT. Same DOM, two states, and
// it keeps its stadium curve in both, so it reads as one object changing
// size rather than a header turning into a pill.
//
// The liquid-glass displacement map is sized to the pill, so it is wrong
// for the length of the morph. .top-nav--morphing falls back to a plain
// blur while the box changes, then the map is rebuilt on transitionend.
const LINKS = [
  { href: '#record', label: 'The record' },
  { href: '#edges', label: 'Edge types' },
  { href: '#gaps', label: 'Gaps' },
  { href: '#datasets', label: 'Datasets' },
];

const GLASS = { scale: -96, chroma: 5, blur: 2, saturate: 1.6, border: 0.05, mapBlur: 10 };

const MORPH_AT = 48;

export default function TopNav() {
  const [open, setOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [morphing, setMorphing] = useState(false);
  const pillRef = useRef(null);
  const navRef = useRef(null);
  const condensedRef = useRef(false);

  const glassRef = useLiquidGlass(pillRef, GLASS);

  useEffect(() => {
    setNavCloser(() => setOpen(false));
    return () => setNavCloser(null);
  }, []);

  // Lenis drives real window scroll, so a plain passive listener sees it.
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > MORPH_AT;
      if (next === condensedRef.current) return;
      condensedRef.current = next;

      setCondensed(next);
      setMorphing(true);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Keyed off the wrapper's own transition rather than a timer, so
  // changing --dur-morph cannot leave the glass stuck on the fallback.
  const handleTransitionEnd = (e) => {
    if (e.target !== navRef.current) return;
    setMorphing(false);
    glassRef.current?.refresh?.();
  };

  useEffect(() => {
    if (condensedRef.current) glassRef.current?.refresh?.();
  }, [glassRef]);

  const toApp = (e) => {
    e.preventDefault();
    setOpen(false);
    navigate('/app');
  };

  const onAnchor = (e) => {
    const handled = handleAnchorClick(e, e.currentTarget.getAttribute('href'));
    if (!handled) setOpen(false);
  };

  const close = () => setOpen(false);

  return (
    <nav
      ref={navRef}
      className={`top-nav${condensed ? ' top-nav--condensed' : ''}${morphing ? ' top-nav--morphing' : ''}`}
      aria-label="Primary"
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="top-nav__pill" ref={pillRef}>
        <a className="top-nav__brand" href="/" onClick={close}>
          <BrandMark className="top-nav__mark" />
          <span className="top-nav__brand-text">ContextForge</span>
        </a>

        <ul className={`top-nav__links${open ? ' top-nav__links--open' : ''}`} id="top-nav-menu">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a className="nav-link" href={l.href} onClick={onAnchor}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="top-nav__actions">
          <AccountMenu />
          <a className="btn btn--quiet" href="/app" onClick={toApp}>
            Open workspace
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
              <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <button
            type="button"
            className="top-nav__toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="top-nav-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true" focusable="false">
              <path
                d="M1 1h13M1 5.5h13M1 10h13"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
