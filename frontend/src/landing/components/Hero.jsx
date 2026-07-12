import GraphFrame from './GraphFrame.jsx';
import FrontierIllustration from './FrontierIllustration.jsx';
import { graphNodes, graphEdges } from '../../api/mock.js';

// Hero: eyebrow + display-xl headline + lead subhead + dual CTAs, followed by
// the live knowledge graph framed as a product screenshot panel. The graph
// stats are derived from the seeded demo data so they never drift from it.
const paperCount = graphNodes.nodes.length;
const edgeCount = graphEdges.edges.length;

export default function Hero() {
  return (
    <header className="hero">
      <div className="container">
        <div className="hero__split">
          <div className="hero__text">
            <p className="eyebrow hero__eyebrow hero-anim" style={{ animationDelay: '0ms' }}>
              Research intelligence, mapped
            </p>
            <h1 className="display-xl hero__title hero-anim" style={{ animationDelay: '80ms' }}>
              See the shape of the research frontier.
            </h1>
            <p className="body-lg hero__sub hero-anim" style={{ animationDelay: '160ms' }}>
              ContextForge ingests papers, code, and news for any topic and forges them into a
               typed, evidence-grounded knowledge graph, then surfaces the contradictions,
               extensions, and open gaps a literature review would miss.
            </p>
            <div className="hero__cta hero-anim" style={{ animationDelay: '240ms' }}>
              <a className="btn btn--primary btn--lg" href="/app">Launch the graph</a>
              <a className="btn btn--secondary btn--lg" href="#demos">Explore a demo</a>
            </div>
          </div>

          <div className="hero__visual hero-anim" style={{ animationDelay: '200ms' }}>
            <FrontierIllustration />
          </div>
        </div>

        <div className="product-shot hero-anim" style={{ animationDelay: '360ms' }}>
          <div className="product-shot__bar">
            <span className="product-shot__meta">
              knowledge-graph · {paperCount} papers · {edgeCount} relationships
            </span>
            <span className="product-shot__live">
              <span className="product-shot__live-dot" aria-hidden="true" />
              live
            </span>
          </div>
          <GraphFrame />
        </div>
      </div>
    </header>
  );
}
