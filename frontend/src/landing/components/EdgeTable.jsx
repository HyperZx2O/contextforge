// The eight relationship types, drawn as a visual vocabulary rather than
// a table: two paper discs joined by a hairline, with the type name and
// a one-line caption beneath. The stroke style is the meaning, so the
// eye learns the set without reading eight sentences.
//
// Types come from backend/agents/synthesis.py.

const TYPES = [
  { code: 'CONTRADICTS', caption: 'The two disagree on the same measured dimension.', accent: true, dash: null, weight: 1.6, arrow: 'end' },
  { code: 'EXTENDS', caption: 'One builds on the other method or result.', accent: false, dash: null, weight: 1.1, arrow: 'end' },
  { code: 'REPLICATES', caption: 'The same result, produced again.', accent: false, dash: null, weight: 1.1, arrow: 'end' },
  { code: 'REPLICATES_FAILED', caption: 'A reproduction that did not hold.', accent: false, dash: '6 4', weight: 1.1, arrow: 'end' },
  { code: 'CHALLENGES', caption: 'Questions a claim without contradicting it outright.', accent: false, dash: '2 4', weight: 1.1, arrow: 'end' },
  { code: 'CITES', caption: 'References the other for background, no claim attached.', accent: false, dash: null, weight: 0.8, arrow: 'end' },
  { code: 'IMPLEMENTS', caption: 'Ships the other method as working code.', accent: false, dash: null, weight: 2, arrow: 'end' },
  { code: 'DISAGREES_ON_SCOPE', caption: 'Both hold, under different conditions.', accent: false, dash: null, weight: 1.1, arrow: 'both' },
];

function EdgeDiagram({ t }) {
  const stroke = t.accent ? 'var(--color-accent)' : 'var(--color-rule-2)';
  const markerId = `arrow-${t.code}`;
  return (
    <svg className="edge-type__diagram" viewBox="0 0 120 40" role="img" aria-hidden="true" focusable="false">
      <defs>
        <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={stroke} />
        </marker>
        {t.arrow === 'both' ? (
          <marker id={`${markerId}-start`} viewBox="0 0 8 8" refX="1" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M8,0 L0,4 L8,8 z" fill={stroke} />
          </marker>
        ) : null}
      </defs>
      <circle cx="20" cy="20" r="6" fill="var(--color-paper-2)" stroke={stroke} strokeWidth="1" />
      <circle cx="100" cy="20" r="6" fill="var(--color-paper-2)" stroke={stroke} strokeWidth="1" />
      <line
        x1="26"
        y1="20"
        x2="94"
        y2="20"
        stroke={stroke}
        strokeWidth={t.weight}
        strokeDasharray={t.dash || undefined}
        markerEnd={`url(#${markerId})`}
        markerStart={t.arrow === 'both' ? `url(#${markerId}-start)` : undefined}
      />
    </svg>
  );
}

export default function EdgeTable() {
  return (
    <section className="section" id="edges" aria-labelledby="edges-head">
      <div className="container">
        <div className="section__head">
          <h2 id="edges-head">Eight kinds of relationship.</h2>
          <p className="lead">The type is the claim. Not related, but how.</p>
        </div>

        <div className="edge-vocab" role="list">
          {TYPES.map((t) => (
            <article className="edge-type" role="listitem" key={t.code}>
              <EdgeDiagram t={t} />
              <span className="edge-type__code mono">{t.code}</span>
              <span className="edge-type__caption">{t.caption}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
