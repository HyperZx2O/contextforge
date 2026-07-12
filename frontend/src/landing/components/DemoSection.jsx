import { demoTopics } from '../../api/mock.js';
import Reveal from './Reveal.jsx';

// Three pre-built demo graphs (spec section 6.4). Each card links into the app
// with a demo preselected via the ?demo= query param.
export default function DemoSection() {
  const topics = demoTopics.topics || [];

  return (
    <section className="section" id="demos">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">Demos</p>
          <h2 className="display-md section__title">Start from a field that already exists.</h2>
          <p className="subhead section__lead">
            Load a pre-built knowledge graph and explore it instantly, no pipeline run required.
          </p>
        </div>
        <div className="demos">
          {topics.map((t, i) => (
            <Reveal key={t.id} delay={i * 80}>
              <article className="demo-card">
                <h3 className="demo-card__title">{t.label}</h3>
                <p className="demo-card__meta">
                  {t.paper_count} papers · {t.edge_count} relationships
                </p>
                <a className="btn btn--secondary demo-card__cta" href={`/app?demo=${t.id}`}>
                  Open demo
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
