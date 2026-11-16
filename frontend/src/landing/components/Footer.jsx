import BrandMark from '../../components/BrandMark.jsx';
import { handleAnchorClick } from '../lenis.js';

// Ft5. A record band, not a sitemap: the brand, every in-page
// destination, and the licence. No placeholder columns.

const LINKS = [
  { href: '#record', label: 'The record' },
  { href: '#edges', label: 'Edge types' },
  { href: '#gaps', label: 'Gaps' },
  { href: '#pipeline', label: 'Pipeline' },
  { href: '#datasets', label: 'Datasets' },
];

export default function Footer() {
  return (
    <footer className="foot">
      <div className="container">
        <div className="foot__meta">
          <a className="foot__brand" href="#hero" onClick={(e) => handleAnchorClick(e, '#hero')}>
            <BrandMark size={15} />
            ContextForge
          </a>

          <ul className="foot__links">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  className="foot__link"
                  href={l.href}
                  onClick={(e) => handleAnchorClick(e, l.href)}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <span className="foot__legal">
            {new Date().getFullYear()} ContextForge, MIT
          </span>
        </div>
      </div>
    </footer>
  );
}
