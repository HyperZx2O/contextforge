// The four gap queries, each drawn as a small glyph rather than a row
// of prose. The mono name and the detail carry the meaning; the glyph
// is a mnemonic, not a second explanation.

const GAPS = [
  {
    name: 'unresolved_contradiction',
    detail: 'no reconciling paper',
    caption: 'Two papers disagree and no later paper settles it.',
    glyph: (
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle cx="12" cy="22" r="5" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
        <circle cx="32" cy="22" r="5" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
        <path d="M17 17 L27 27 M27 17 L17 27" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'low_density',
    detail: 'below average degree',
    caption: 'A cluster with far fewer connections than the rest.',
    glyph: (
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle cx="10" cy="14" r="2.5" fill="var(--color-rule-2)" />
        <circle cx="10" cy="30" r="2.5" fill="var(--color-rule-2)" />
        <circle cx="34" cy="12" r="2.5" fill="var(--color-rule-2)" />
        <circle cx="30" cy="22" r="2.5" fill="var(--color-rule-2)" />
        <circle cx="34" cy="32" r="2.5" fill="var(--color-rule-2)" />
        <circle cx="24" cy="16" r="2.5" fill="var(--color-rule-2)" />
        <circle cx="24" cy="28" r="2.5" fill="var(--color-rule-2)" />
      </svg>
    ),
  },
  {
    name: 'stale_claim',
    detail: '5 years',
    caption: 'A claim no later paper has tested or extended.',
    glyph: (
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle cx="22" cy="22" r="13" fill="none" stroke="var(--color-rule-2)" strokeWidth="1.2" />
        <line x1="22" y1="22" x2="22" y2="13" stroke="var(--color-instrument)" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="22" y1="22" x2="29" y2="22" stroke="var(--color-instrument)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="22" cy="22" r="1.6" fill="var(--color-instrument)" />
      </svg>
    ),
  },
  {
    name: 'bridge_opportunity',
    detail: 'shortest path',
    caption: 'Two clusters that should connect, and the path between them.',
    glyph: (
      <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle cx="9" cy="14" r="3" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
        <circle cx="9" cy="30" r="3" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
        <circle cx="35" cy="14" r="3" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
        <circle cx="35" cy="30" r="3" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" strokeWidth="1" />
        <path d="M12 22 Q22 14 32 22" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d="M12 22 Q22 30 32 22" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" strokeDasharray="3 3" />
      </svg>
    ),
  },
];

export default function GapRows() {
  return (
    <section className="section section--l" id="gaps" aria-labelledby="gaps-head">
      <div className="container">
        <div className="section__head">
          <h2 id="gaps-head">Four queries find the gaps.</h2>
          <p className="lead">Each is a query over the graph, then one paragraph of summary.</p>
        </div>

        <div className="gap-grid" role="list">
          {GAPS.map((g) => (
            <article className="gap-card" role="listitem" key={g.name}>
              <div className="gap-card__glyph">{g.glyph}</div>
              <div className="gap-card__body">
                <span className="gap-card__name mono">{g.name}</span>
                <span className="gap-card__detail num">{g.detail}</span>
                <span className="gap-card__caption">{g.caption}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
