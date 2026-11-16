import { DEMO_TOPICS } from '../../demoData.js';

// The three graphs that ship with the build. Counts come from the
// arrays in data/demo, never from the illustrative numbers inside the
// JSON, which were wrong once already.
//
// Each row is one link to the workspace with that demo preloaded. The
// whole row is the target, so the hit area is the row, not the word.

export default function DatasetIndex() {
  return (
    <section className="section" id="datasets" aria-labelledby="datasets-head">
      <div className="container">
        <div className="section__head">
          <h2 id="datasets-head">Three graphs are already built.</h2>
          <p className="lead">Open one and the workspace loads it with no backend running.</p>
        </div>

        <ul className="index">
          {DEMO_TOPICS.map((t) => (
            <li key={t.id}>
              <a className="index__row" href={`/app?demo=${t.id}`}>
                <span className="index__label">{t.label}</span>
                <span className="index__counts">
                  <b>{t.paper_count}</b> papers, <b>{t.edge_count}</b> relationships,{' '}
                  <b>{t.gap_count}</b> {t.gap_count === 1 ? 'gap' : 'gaps'}
                </span>
                <span className="index__go">Open</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="index__note">
          These are sample graphs. The papers in them are written for the bundle, so read the
          structure rather than the findings.
        </p>
      </div>
    </section>
  );
}
