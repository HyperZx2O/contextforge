import { navigate } from '../useRoute.js';

// The close band. It repeats the one action and says plainly what a
// reader needs before they click: the demos are free, a new run is not.
// A page that hides that sentence is selling rather than reporting.

export default function CloseBand() {
  return (
    <section className="close" aria-labelledby="close-head">
      <div className="container close__inner">
        <div>
          <h2 id="close-head">Start with a graph, not a search box.</h2>
          <p className="close__line">
            The three demos run with no backend. A new topic needs Postgres, Neo4j and a Groq key.
          </p>
        </div>

        <div className="close__action">
          <a
            className="btn"
            href="/app"
            onClick={(e) => {
              e.preventDefault();
              navigate('/app');
            }}
          >
            Open the workspace
          </a>
        </div>
      </div>
    </section>
  );
}
