import { EDGE_COLORS } from '../../constants/colors.js';
import Reveal from './Reveal.jsx';

// The eight relationship types from spec section 5.2, shown as colored chips
// using the product's own EDGE_COLORS. Doubles as the section's product visual.
const RELATIONSHIPS = [
  { type: 'CONTRADICTS', meaning: 'Conflicting empirical findings' },
  { type: 'EXTENDS', meaning: 'Builds on and improves prior work' },
  { type: 'REPLICATES', meaning: 'Same experiment, same result' },
  { type: 'REPLICATES_FAILED', meaning: 'Same experiment, different result' },
  { type: 'CHALLENGES', meaning: 'Questions assumptions without direct conflict' },
  { type: 'CITES', meaning: 'Direct citation reference' },
  { type: 'IMPLEMENTS', meaning: 'Code implementation of a method' },
  { type: 'DISAGREES_ON_SCOPE', meaning: 'Findings hold in context X but not Y' },
];

export default function RelationshipLegend() {
  return (
    <section className="section" id="relationships">
      <div className="container">
        <div className="section__head">
          <p className="eyebrow">Relationship vocabulary</p>
          <h2 className="display-md section__title">Not just links: typed, evidenced edges.</h2>
          <p className="subhead section__lead">
            Each edge in the graph is one of eight relationship types, every one carrying a
            confidence score and the source quote that justifies it.
          </p>
        </div>
        <div className="legend">
          {RELATIONSHIPS.map((r, i) => (
            <Reveal key={r.type} delay={i * 60} className="legend__reveal">
              <span className="legend__chip" title={r.meaning}>
                <span className="legend__dot" style={{ background: EDGE_COLORS[r.type] }} />
                {r.type}
              </span>
            </Reveal>
          ))}
        </div>
        <p className="legend__desc">
           Contradictions are flagged in red, extensions in green, implementations in teal. The
          color is the relationship type, so you can read the structure of a field at a glance.
        </p>
      </div>
    </section>
  );
}
