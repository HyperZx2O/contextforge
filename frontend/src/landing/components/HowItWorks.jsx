// Four-step pipeline explainer (spec section 7). Each step is a surface-1 panel
// with a lavender step number and a mono agent label.
const STEPS = [
  {
    n: 1,
    title: 'Ingestion',
    agent: 'agents/ingestion.py',
    body: 'Fetches raw papers, repos, and news from arXiv, Semantic Scholar, GitHub, and NewsAPI into a PostgreSQL cache.',
  },
  {
    n: 2,
    title: 'Concept extraction',
    agent: 'agents/extractor.py',
    body: 'SciSpaCy NER plus sentence-transformers embeddings extract and de-duplicate entities across the corpus.',
  },
  {
    n: 3,
    title: 'Synthesis',
    agent: 'agents/synthesis.py',
    body: 'An LLM classifies typed relationships with confidence and evidence quotes, written to Neo4j above a threshold.',
  },
  {
    n: 4,
    title: 'Gap finding',
    agent: 'agents/gap_finder.py',
    body: 'Structural Cypher queries plus LLM summarization detect contradictions, stale claims, and missing bridges.',
  },
];

import Reveal from './Reveal.jsx';

export default function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">How it works</p>
          <h2 className="display-md section__title">Four agents, one forged graph.</h2>
          <p className="subhead section__lead">
            Each stage is observable. The graph you explore is the direct output of this pipeline.
          </p>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <article className="step">
                <div className="step__num">{s.n}</div>
                <h3 className="step__title">{s.title}</h3>
                <p className="mono step__agent">{s.agent}</p>
                <p className="body-sm step__body">{s.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
