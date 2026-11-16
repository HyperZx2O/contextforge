import { graphNodes, graphEdges } from '../../api/mock.js';

// The record, opened. The quote is the thing a person wrote; everything
// else is what the instrument measured, so it is drawn as a small spec
// strip beneath the quote rather than as a list that competes with it.

const NODE_BY_ID = new Map(graphNodes.nodes.map((n) => [n.id, n]));
const endId = (end) => (end && typeof end === 'object' ? end.id : end);
const titleOf = (id) => NODE_BY_ID.get(id)?.properties?.title ?? id;
const yearOf = (id) => (NODE_BY_ID.get(id)?.properties?.publish_date ?? '').slice(0, 4);

const EDGE =
  graphEdges.edges.find((e) => e.type === 'CONTRADICTS' && e.properties?.evidence_quote) ??
  graphEdges.edges[0];
const PROPS = EDGE.properties || {};
const contradictions = graphEdges.edges.filter((e) => e.type === 'CONTRADICTS').length;
const total = graphEdges.edges.length;

const FROM = titleOf(endId(EDGE.source));
const TO = titleOf(endId(EDGE.target));

export default function RecordSection() {
  return (
    <section className="section" id="record" aria-labelledby="record-head">
      <div className="container">
        <div className="section__head">
          <h2 id="record-head">Each classified edge quotes its evidence.</h2>
          <p className="lead">The model must quote one of the papers, not describe it.</p>
        </div>

        <div className="record">
          <div className="record__diagram" aria-hidden="true">
            <svg viewBox="0 0 260 60" focusable="false">
              <circle cx="30" cy="30" r="10" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
              <circle cx="230" cy="30" r="10" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
              <text x="30" y="34" textAnchor="middle" fontSize="9" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">A</text>
              <text x="230" y="34" textAnchor="middle" fontSize="9" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">B</text>
              <line x1="40" y1="30" x2="220" y2="30" stroke="var(--color-accent)" strokeWidth="1.6" markerEnd="url(#record-arrow)" />
              <defs>
                <marker id="record-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--color-accent)" />
                </marker>
              </defs>
              <text x="130" y="22" textAnchor="middle" fontSize="9" fill="var(--color-accent)" fontFamily="var(--font-mono)">
                {EDGE.type}
              </text>
            </svg>
            <div className="record__diagram-labels">
              <span>{FROM}</span>
              <span>{TO}</span>
            </div>
          </div>

          <div className="record__body">
            <blockquote className="record__quote">
              <p>{PROPS.evidence_quote}</p>
            </blockquote>
            <cite className="record__source">
              {FROM}, {yearOf(endId(EDGE.source))}
            </cite>

            <div className="record__spec" role="group" aria-label="Relationship details">
              <span className="record__spec-item">
                <span className="record__spec-key">relationship</span>
                <span className="record__spec-value mono">{EDGE.type}</span>
              </span>
              <span className="record__spec-item">
                <span className="record__spec-key">judged on</span>
                <span className="record__spec-value">{PROPS.on_dimension || 'no single dimension'}</span>
              </span>
              <span className="record__spec-item">
                <span className="record__spec-key">confidence</span>
                <span className="record__spec-value mono">
                  {typeof PROPS.confidence === 'number' ? PROPS.confidence.toFixed(2) : 'not recorded'}
                </span>
              </span>
            </div>

            <p className="record__gap">
              <span className="mono">{contradictions} of {total}</span> relationships in this sample
              are contradictions. Each one carries the same fields, and the quote is the only one
              written by a person.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
