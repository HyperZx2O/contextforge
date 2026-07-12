import Reveal from './Reveal.jsx';
import { navigate } from '../useRoute.js';

// Closing CTA panel (design.md `cta-banner`).
export default function CtaBanner() {
  return (
    <section className="section section--tight">
      <div className="container">
        <Reveal>
          <div className="cta-banner">
          <h2 className="headline cta-banner__title">Start mapping your field.</h2>
          <p className="body-lg cta-banner__sub">
            Point ContextForge at a topic and watch the literature resolve into a graph you can
            read, query, and trust.
          </p>
          <a
            className="btn btn--primary btn--lg"
            href="/app"
            onClick={(e) => { e.preventDefault(); navigate('/app'); }}
          >
            Launch ContextForge
          </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
