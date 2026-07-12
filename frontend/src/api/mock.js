// Hardcoded mock data for every backend endpoint, matching spec.md §6 exactly.
// Ids are kept consistent across datasets so the graph, gaps, and query
// results all reference the same nodes. client.js (Phase 1) returns these
// when VITE_USE_MOCK_API === 'true'.

// ---------------------------------------------------------------------------
// GET /graph/nodes  (12 nodes: the original 5 referenced by gaps/query, plus
// 7 seeded papers/claims so the graph reads as a real field, not a stub)
// ---------------------------------------------------------------------------
export const graphNodes = {
  nodes: [
    {
      id: '2401.12345',
      label: 'Paper',
      properties: {
        title: 'RAG vs Long Context: A Comparison',
        arxiv_id: '2401.12345',
        publish_date: '2024-01-15',
        citation_count: 42,
        source: 'arxiv',
      },
    },
    {
      id: '2312.09876',
      label: 'Paper',
      properties: {
        title: 'Long-Context Retrieval Under Load',
        arxiv_id: '2312.09876',
        publish_date: '2023-12-14',
        citation_count: 18,
        source: 'arxiv',
      },
    },
    {
      id: '2403.55210',
      label: 'Paper',
      properties: {
        title: 'Extending RAG with Adaptive Retrieval',
        arxiv_id: '2403.55210',
        publish_date: '2024-03-08',
        citation_count: 9,
        source: 'arxiv',
      },
    },
    {
      id: '2309.01234',
      label: 'Paper',
      properties: {
        title: 'A Survey of Retrieval Methods',
        arxiv_id: '2309.01234',
        publish_date: '2023-09-02',
        citation_count: 130,
        source: 'arxiv',
      },
    },
    {
      id: '2405.67890',
      label: 'Paper',
      properties: {
        title: 'Evaluation Benchmarks for RAG',
        arxiv_id: '2405.67890',
        publish_date: '2024-05-21',
        citation_count: 27,
        source: 'arxiv',
      },
    },
    {
      id: '2402.00001',
      label: 'Paper',
      properties: {
        title: 'Dense Retrieval at Scale',
        arxiv_id: '2402.00001',
        publish_date: '2024-02-10',
        citation_count: 55,
        source: 'arxiv',
      },
    },
    {
      id: '2404.11111',
      label: 'Paper',
      properties: {
        title: 'Query Rewriting for Retrieval-Augmented Generation',
        arxiv_id: '2404.11111',
        publish_date: '2024-04-18',
        citation_count: 33,
        source: 'arxiv',
      },
    },
    {
      id: '2406.22222',
      label: 'Paper',
      properties: {
        title: 'GraphRAG: Knowledge Graphs for Generation',
        arxiv_id: '2406.22222',
        publish_date: '2024-06-25',
        citation_count: 61,
        source: 'arxiv',
      },
    },
    {
      id: '2305.33333',
      label: 'Paper',
      properties: {
        title: 'A Survey of Long-Context Transformers',
        arxiv_id: '2305.33333',
        publish_date: '2023-05-30',
        citation_count: 88,
        source: 'arxiv',
      },
    },
    {
      id: '2407.44444',
      label: 'Paper',
      properties: {
        title: 'Mitigating Hallucination in LLM Generation',
        arxiv_id: '2407.44444',
        publish_date: '2024-07-12',
        citation_count: 120,
        source: 'arxiv',
      },
    },
    {
      id: '2410.88888',
      label: 'Paper',
      properties: {
        title: 'Tool Use for Scientific Question Answering',
        arxiv_id: '2410.88888',
        publish_date: '2024-10-05',
        citation_count: 40,
        source: 'arxiv',
      },
    },
    {
      id: '2411.99999',
      label: 'Claim',
      properties: {
        title: 'Long context removes the need for retrieval',
        arxiv_id: '2411.99999',
        publish_date: '2024-11-20',
        source: 'claim',
      },
    },
  ],
  total: 12,
  limit: 500,
  offset: 0,
};

// ---------------------------------------------------------------------------
// GET /graph/edges  (16 edges across 8 relationship types; the original 3
// (incl. the CONTRADICTS referenced by gaps/query) are kept verbatim)
// ---------------------------------------------------------------------------
export const graphEdges = {
  edges: [
    {
      source: '2401.12345',
      target: '2312.09876',
      type: 'CONTRADICTS',
      properties: {
        on_dimension: 'retrieval_accuracy',
        confidence: 0.91,
        evidence_quote:
          'Our results show retrieval accuracy drops 18% under long-context conditions, contradicting prior claims.',
        timestamp: '2026-01-07T15:22:00Z',
      },
    },
    {
      source: '2401.12345',
      target: '2403.55210',
      type: 'EXTENDS',
      properties: {
        confidence: 0.84,
        evidence_quote:
          'Adaptive retrieval builds directly on the RAG comparison framework proposed earlier.',
        timestamp: '2026-01-07T15:24:00Z',
      },
    },
    {
      source: '2312.09876',
      target: '2309.01234',
      type: 'CITES',
      properties: {
        confidence: 0.99,
        evidence_quote: 'Cites the foundational retrieval survey for background.',
        timestamp: '2026-01-07T15:25:00Z',
      },
    },
    {
      source: '2404.11111',
      target: '2401.12345',
      type: 'EXTENDS',
      properties: {
        confidence: 0.8,
        evidence_quote: 'Query rewriting builds on the RAG comparison framework.',
        timestamp: '2026-01-07T15:26:00Z',
      },
    },
    {
      source: '2406.22222',
      target: '2404.11111',
      type: 'EXTENDS',
      properties: {
        confidence: 0.76,
        evidence_quote: 'GraphRAG extends query rewriting with structured retrieval.',
        timestamp: '2026-01-07T15:27:00Z',
      },
    },
    {
      source: '2407.44444',
      target: '2401.12345',
      type: 'CHALLENGES',
      properties: {
        confidence: 0.7,
        evidence_quote: 'Hallucination findings question the reliability of RAG answers.',
        timestamp: '2026-01-07T15:28:00Z',
      },
    },
    {
      source: '2411.99999',
      target: '2309.01234',
      type: 'CONTRADICTS',
      properties: {
        confidence: 0.82,
        evidence_quote: 'The claim conflicts with the retrieval survey conclusions.',
        timestamp: '2026-01-07T15:29:00Z',
      },
    },
    {
      source: '2411.99999',
      target: '2401.12345',
      type: 'DISAGREES_ON_SCOPE',
      properties: {
        confidence: 0.6,
        evidence_quote: 'Holds for short contexts, not long retrieval settings.',
        timestamp: '2026-01-07T15:30:00Z',
      },
    },
    {
      source: '2402.00001',
      target: '2309.01234',
      type: 'CITES',
      properties: { confidence: 0.95, evidence_quote: 'Cites the retrieval survey.', timestamp: '2026-01-07T15:31:00Z' },
    },
    {
      source: '2406.22222',
      target: '2309.01234',
      type: 'CITES',
      properties: { confidence: 0.9, evidence_quote: 'Cites the retrieval survey for grounding.', timestamp: '2026-01-07T15:32:00Z' },
    },
    {
      source: '2407.44444',
      target: '2405.67890',
      type: 'CITES',
      properties: { confidence: 0.88, evidence_quote: 'Cites RAG benchmarks.', timestamp: '2026-01-07T15:33:00Z' },
    },
    {
      source: '2305.33333',
      target: '2309.01234',
      type: 'CITES',
      properties: { confidence: 0.97, evidence_quote: 'Cites the retrieval survey.', timestamp: '2026-01-07T15:34:00Z' },
    },
    {
      source: '2410.88888',
      target: '2407.44444',
      type: 'EXTENDS',
      properties: { confidence: 0.74, evidence_quote: 'Scientific tool use extends hallucination work.', timestamp: '2026-01-07T15:35:00Z' },
    },
    {
      source: '2410.88888',
      target: '2401.12345',
      type: 'CITES',
      properties: { confidence: 0.86, evidence_quote: 'Cites the RAG comparison.', timestamp: '2026-01-07T15:36:00Z' },
    },
    {
      source: '2402.00001',
      target: '2309.01234',
      type: 'REPLICATES',
      properties: { confidence: 0.79, evidence_quote: 'Reproduces the survey retrieval protocol.', timestamp: '2026-01-07T15:37:00Z' },
    },
    {
      source: '2404.11111',
      target: '2403.55210',
      type: 'REPLICATES_FAILED',
      properties: { confidence: 0.55, evidence_quote: 'Query rewriting failed to reproduce adaptive retrieval gains.', timestamp: '2026-01-07T15:38:00Z' },
    },
  ],
  total: 16,
  limit: 1000,
  offset: 0,
};

// ---------------------------------------------------------------------------
// GET /graph/gaps  (1 gap)
// ---------------------------------------------------------------------------
export const graphGaps = {
  gaps: [
    {
      id: 'gap-001',
      gap_type: 'unresolved_contradiction',
      description:
        'Papers 2401.12345 and 2312.09876 contradict each other on retrieval accuracy under long context, but no subsequent paper has reconciled this finding as of 2024.',
      affected_nodes: ['2401.12345', '2312.09876'],
      severity: 0.84,
      detected_at: '2026-01-07T16:00:00Z',
    },
  ],
};

// ---------------------------------------------------------------------------
// GET /pipeline/status/{job_id}  (stateful, cycles through stages)
// ---------------------------------------------------------------------------
// Advances through the spec §6 status ladder on each poll so the UI progress
// bar animates (plan.md Phase 5 AC: "cycles through statuses over N polls").
const PIPELINE_STAGES = [
  'pending',
  'ingesting',
  'extracting',
  'synthesizing',
  'gap_finding',
  'done',
];
const pipelineStates = new Map();

export function resetPipelineState(jobId) {
  pipelineStates.set(jobId, { idx: 0 });
}

export function getPipelineStatus(jobId = '550e8400-e29b-41d4-a716-446655440000') {
  if (!pipelineStates.has(jobId)) resetPipelineState(jobId);
  const state = pipelineStates.get(jobId);
  const status = PIPELINE_STAGES[state.idx];
  const progress =
    status === 'done'
      ? 100
      : Math.min(95, Math.round((state.idx / (PIPELINE_STAGES.length - 1)) * 100));
  const result = {
    job_id: jobId,
    status,
    progress,
    papers_found: 94,
    papers_processed: 58,
    relationships_created: 143,
    started_at: '2026-01-07T14:30:00Z',
    completed_at: status === 'done' ? '2026-01-07T14:35:00Z' : null,
    error_message: null,
  };
  if (state.idx < PIPELINE_STAGES.length - 1) state.idx += 1;
  return result;
}

// ---------------------------------------------------------------------------
// POST /query/natural-language  (answer + supporting edges)
// ---------------------------------------------------------------------------
export const nlQueryResponse = {
  question: 'Which papers contradict the findings in 2401.12345?',
  answer:
    'Two papers directly contradict 2401.12345 on retrieval accuracy: paper 2312.09876 (confidence 0.91) and paper 2403.55210 (confidence 0.78). Both cite different experimental conditions as the source of disagreement.',
  supporting_edges: [
    {
      source: '2401.12345',
      target: '2312.09876',
      type: 'CONTRADICTS',
      evidence_quote:
        'Our results show retrieval accuracy drops 18% under long-context conditions, contradicting prior claims.',
    },
  ],
  cypher_used:
    "MATCH (a:Paper {arxiv_id: '2401.12345'})-[r:CONTRADICTS]-(b:Paper) RETURN b, r",
  response_time_ms: 1240,
};

// ---------------------------------------------------------------------------
// GET /demo/topics  (3 topics)
// ---------------------------------------------------------------------------
export const demoTopics = {
  topics: [
    {
      id: 'rag_2024',
      label: 'Retrieval Augmented Generation (2024)',
      paper_count: 94,
      edge_count: 312,
    },
    {
      id: 'llms_2024',
      label: 'Large Language Models (2024)',
      paper_count: 120,
      edge_count: 445,
    },
    {
      id: 'diffusion_2024',
      label: 'Diffusion Models (2024)',
      paper_count: 87,
      edge_count: 278,
    },
  ],
};
