// The four agents as a duration bar rather than a list: the width of each
// segment is proportional to how long it takes, so the slow stage is the
// one the eye lands on first. Stage names sit above, timings and a
// one-line description sit below.

const STAGES = [
  {
    name: 'ingestion',
    what: 'Papers from arXiv and Semantic Scholar, repositories from GitHub.',
    seconds: 5,
    label: 'about 5s',
  },
  {
    name: 'extraction',
    what: 'SciSpaCy entities, hashed vectors, cosine deduplication on PostgreSQL.',
    seconds: 10,
    label: 'about 10s',
  },
  {
    name: 'synthesis',
    what: 'Ten nearest neighbours per paper, classified by llama-3.3-70b on Groq.',
    seconds: 22.5,
    label: '15 to 30s',
  },
  {
    name: 'gap finding',
    what: 'Four Cypher queries, each summarised in one paragraph.',
    seconds: 2.5,
    label: '2 to 3s',
  },
];

const total = STAGES.reduce((a, s) => a + s.seconds, 0);

export default function PipelineTrail() {
  return (
    <section className="section" id="pipeline" aria-labelledby="pipeline-head">
      <div className="container">
        <div className="section__head">
          <h2 id="pipeline-head">Four agents, one graph.</h2>
          <p className="lead">A 30-paper run takes about 30 to 50 seconds.</p>
        </div>

        <div className="pipeline" role="group" aria-label="Pipeline stages by duration">
          <div className="pipeline__names">
            {STAGES.map((s) => (
              <div
                className="pipeline__name"
                key={s.name}
                style={{ flex: `${s.seconds} 1 0` }}
              >
                {s.name}
              </div>
            ))}
          </div>

          <div className="pipeline__bar" role="presentation">
            {STAGES.map((s, i) => (
              <div
                className="pipeline__segment"
                key={s.name}
                style={{ flex: `${s.seconds} 1 0` }}
                aria-label={`${s.name}: ${s.label}`}
              >
                <span className="pipeline__time num">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="pipeline__captions">
            {STAGES.map((s) => (
              <div
                className="pipeline__caption"
                key={s.name}
                style={{ flex: `${s.seconds} 1 0` }}
              >
                {s.what}
              </div>
            ))}
          </div>
        </div>

        <p className="trail__foot">
          Between 10 and 30 papers per run. The result is written to Neo4j, so it can be queried
          rather than read.
        </p>
      </div>
    </section>
  );
}
