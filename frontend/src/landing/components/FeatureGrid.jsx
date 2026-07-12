// Six feature highlights (design.md `feature-card`), 3-up grid.
import { Network, Quote, AlertTriangle, Layers, Users, Activity } from 'lucide-react';
import Reveal from './Reveal.jsx';

const FEATURES = [
  {
    Icon: Network,
    title: 'Typed knowledge graph',
    body: 'Papers, authors, methods, datasets, claims, and gaps as first-class nodes, not a flat list of links.',
  },
  {
    Icon: Quote,
    title: 'Evidence-grounded links',
    body: 'Every relationship carries a confidence score and the exact quote that supports it. Nothing is asserted without a source.',
  },
  {
    Icon: AlertTriangle,
    title: 'Research gap detection',
    body: 'Unresolved contradictions, stale claims, under-explored clusters, and missing bridges, surfaced automatically.',
  },
  {
    Icon: Layers,
    title: 'Ask in plain language',
    body: 'Query the graph in natural language. Questions become safe, read-only Cypher and come back with cited evidence.',
  },
  {
    Icon: Users,
    title: 'Multi-source ingestion',
    body: 'Pulls from arXiv, Semantic Scholar, GitHub, and NewsAPI, then de-duplicates entities by embedding similarity.',
  },
  {
    Icon: Activity,
    title: 'Transparent pipeline',
    body: 'Watch ingestion → extraction → synthesis → gap-finding progress live, with paper and relationship counts.',
  },
];

export default function FeatureGrid() {
  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">Product</p>
          <h2 className="display-md section__title">A literature review that reads itself.</h2>
          <p className="subhead section__lead">
            ContextForge turns a topic query into a navigable map of what is known, what conflicts,
            and what is missing.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <article className="feature-card">
                <div className="feature-card__icon" aria-hidden="true">
                  <f.Icon size={24} strokeWidth={1.5} />
                </div>
                <h3 className="card-title feature-card__title">{f.title}</h3>
                <p className="body-sm feature-card__body">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
