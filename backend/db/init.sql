CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE papers_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arxiv_id        TEXT UNIQUE,
    doi             TEXT,
    title           TEXT NOT NULL,
    abstract        TEXT,
    authors         JSONB,
    publish_date    DATE,
    citation_count  INT DEFAULT 0,
    source          TEXT NOT NULL,
    url             TEXT,
    raw_response    JSONB,
    fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entities_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id        UUID REFERENCES papers_cache(id),
    entity_type     TEXT NOT NULL,
    name            TEXT NOT NULL,
    properties      JSONB,
    embedding       VECTOR(768),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE synthesis_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_a_id      UUID REFERENCES papers_cache(id),
    paper_b_id      UUID REFERENCES papers_cache(id),
    cache_key       TEXT UNIQUE NOT NULL,
    llm_response    JSONB,
    confidence      FLOAT,
    relationship_type TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (paper_a_id, paper_b_id)
);

CREATE TABLE pipeline_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    progress        INT DEFAULT 0,
    papers_found    INT DEFAULT 0,
    papers_processed INT DEFAULT 0,
    relationships_created INT DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_papers_cache_arxiv_id ON papers_cache(arxiv_id);
CREATE INDEX idx_synthesis_cache_key ON synthesis_cache(cache_key);
CREATE INDEX idx_pipeline_jobs_status ON pipeline_jobs(status);
