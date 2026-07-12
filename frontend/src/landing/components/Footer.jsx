// Dense footer link grid (design.md footer token).
import { navigate } from '../useRoute.js';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Graph explorer', href: '/app' },
      { label: 'Query interface', href: '/app' },
      { label: 'Gap finder', href: '/app' },
      { label: 'Pipeline status', href: '/app' },
      { label: 'Demos', href: '#demos' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', disabled: true },
      { label: 'Relationship vocabulary', disabled: true },
      { label: 'API reference', disabled: true },
      { label: 'Changelog', disabled: true },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', disabled: true },
      { label: 'Research', disabled: true },
      { label: 'Contact', disabled: true },
      { label: 'GitHub', disabled: true },
    ],
  },
];

import Reveal from './Reveal.jsx';
import BrandMark from '../../components/BrandMark.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <Reveal>
        <div className="footer__grid">
        <div>
          <div className="footer__brand">
            <BrandMark className="top-nav__mark" />
            ContextForge
          </div>
          <p className="footer__tagline">
            Forge typed, evidence-grounded knowledge graphs from the research frontier.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="footer__col">
            <h4>{col.title}</h4>
            {col.links.map((l) =>
              l.disabled ? (
                <span key={l.label} className="footer-link--disabled">
                  {l.label}
                </span>
              ) : (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={l.href.startsWith('/app') ? (e) => { e.preventDefault(); navigate(l.href); } : undefined}
                >
                  {l.label}
                </a>
              )
            )}
          </div>
        ))}
      </div>
      <div className="footer__bottom">
        {new Date().getFullYear()} ContextForge - Built for researchers mapping fast-moving fields.
      </div>
      </Reveal>
    </footer>
  );
}
