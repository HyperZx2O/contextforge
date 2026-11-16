import { useMemo, useState } from 'react';
import GraphFrame from './GraphFrame.jsx';
import { handleAnchorClick } from '../lenis.js';
import { graphNodes, graphEdges } from '../../api/mock.js';

// Ledge hero: a tall field of the real graph, the head resting at its
// base. Nothing is painted over the canvas, so there is no scrim, no
// gradient and no bloom pretending to be depth.
//
// The band beneath the field is the instrument's readout. It prints the
// edge under the pointer: its type, the dimension it was judged on, the
// confidence, and the sentence the classifier quoted. At rest it prints
// the strongest contradiction in the sample graph, so the page is never
// mute and the interaction is discoverable without being demanded.

const NODE_BY_ID = new Map(graphNodes.nodes.map((n) => [n.id, n]));

const endId = (end) => (end && typeof end === 'object' ? end.id : end);
const titleOf = (id) => NODE_BY_ID.get(id)?.properties?.title ?? id;

// The sample's sharpest edge. Two papers disagree on one measured
// dimension and one of them says so in a single sentence.
const DEFAULT_EDGE =
  graphEdges.edges.find((e) => e.type === 'CONTRADICTS') ?? graphEdges.edges[0];

function readEdge(edge) {
  if (!edge) return null;
  const p = edge.properties || {};
  return {
    type: edge.type,
    from: titleOf(endId(edge.source)),
    to: titleOf(endId(edge.target)),
    dimension: p.on_dimension || null,
    confidence: typeof p.confidence === 'number' ? p.confidence.toFixed(2) : null,
    quote: p.evidence_quote || null,
  };
}

export default function Hero() {
  const [edge, setEdge] = useState(DEFAULT_EDGE);
  const read = useMemo(() => readEdge(edge), [edge]);

  return (
    <header className="hero" id="hero">
      <div className="hero__base">
        <div className="container hero__grid">
          <div className="hero__title-block">
            <h1 className="hero__title">
              Read the <span className="hero__title--accent">disagreement</span>, not the summary.
            </h1>
            <span className="hero__rule" aria-hidden="true" />
          </div>

          <div className="hero__aside">
            <p className="lead hero__lede">
              A topic becomes a graph of claims, contradictions and gaps.
            </p>
            <div className="hero__actions">
              <a className="btn btn--lg" href="/app">
                Open a demo graph
              </a>
              <a
                className="link-quiet"
                href="#record"
                onClick={(e) => handleAnchorClick(e, '#record')}
              >
                See one contradiction
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="hero__field">
        <div className="hero__graph">
          <GraphFrame onEdgeHover={(next) => next && setEdge(next)} />
        </div>
      </div>

      <div className="readout" data-testid="edge-readout">
        <div className="container readout__inner">
          {read?.quote ? (
            <>
              <p className="readout__kind">{read.type}</p>
              <p className="readout__quote">{read.quote}</p>
              <p className="readout__facts">
                {read.dimension ? (
                  <span className="readout__fact">
                    <span className="readout__key">dimension</span>
                    <span className="readout__value readout__value--dimension">
                      {read.dimension}
                    </span>
                  </span>
                ) : null}
                {read.confidence ? (
                  <span className="readout__fact">
                    <span className="readout__key">confidence</span>
                    <span className="readout__value">{read.confidence}</span>
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="readout__idle">
              {read
                ? `${read.type}: ${read.from} to ${read.to}. This edge carries no quoted sentence.`
                : 'Hover an edge to read the sentence it was drawn from.'}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
