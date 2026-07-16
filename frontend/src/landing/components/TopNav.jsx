import { useState } from 'react';
import BrandMark from '../../components/BrandMark.jsx';
import { navigate } from '../useRoute.js';

// Sticky top navigation (design.md `top-nav`): wordmark left, section links
// center, Sign in + Launch app right. Links below 768px collapse to a toggle.
export default function TopNav() {
  const [open, setOpen] = useState(false);

  const handleAppLink = (e) => {
    e.preventDefault();
    navigate('/app');
  };

  return (
    <nav className="top-nav">
      <div className="container top-nav__inner">
        <a className="top-nav__brand" href="/">
          <BrandMark className="top-nav__mark" />
          ContextForge
        </a>

        <div
          id="top-nav-menu"
          className={`top-nav__links${open ? ' top-nav__links--open' : ''}`}
          aria-label="Primary"
        >
          <a className="nav-link" href="#features">Product</a>
          <a className="nav-link" href="#how">How it works</a>
          <a className="nav-link" href="#relationships">Relationships</a>
          <a className="nav-link" href="#demos">Demos</a>
        </div>

        <div className="top-nav__actions">
          <a className="btn btn--primary" href="/app" onClick={handleAppLink}>Launch app</a>
          <button
            className="top-nav__toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="top-nav-menu"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>
    </nav>
  );
}
