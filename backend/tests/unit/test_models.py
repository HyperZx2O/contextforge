from db.models import Base, EntitiesCache, PapersCache, PipelineJobs, SynthesisCache


def test_models_import():
    assert PapersCache is not None
    assert EntitiesCache is not None
    assert SynthesisCache is not None
    assert PipelineJobs is not None


def test_papers_cache_columns():
    cols = {c.name for c in PapersCache.__table__.columns}
    expected = {
        "id", "arxiv_id", "doi", "title", "abstract", "authors",
        "publish_date", "citation_count", "source", "url", "raw_response", "fetched_at",
    }
    assert expected.issubset(cols)


def test_entities_cache_columns():
    cols = {c.name for c in EntitiesCache.__table__.columns}
    expected = {"id", "paper_id", "entity_type", "name", "properties", "embedding", "created_at"}
    assert expected.issubset(cols)


def test_synthesis_cache_columns():
    cols = {c.name for c in SynthesisCache.__table__.columns}
    expected = {
        "id", "paper_a_id", "paper_b_id", "cache_key",
        "llm_response", "confidence", "relationship_type", "created_at",
    }
    assert expected.issubset(cols)


def test_pipeline_jobs_columns():
    cols = {c.name for c in PipelineJobs.__table__.columns}
    expected = {
        "id", "query", "status", "progress", "papers_found",
        "papers_processed", "relationships_created", "error_message",
        "started_at", "completed_at",
    }
    assert expected.issubset(cols)


def test_papers_cache_defaults():
    assert PapersCache.__table__.c.citation_count.default.arg == 0


def test_pipeline_jobs_defaults():
    assert PipelineJobs.__table__.c.status.default.arg == "pending"
    assert PipelineJobs.__table__.c.progress.default.arg == 0
    assert PipelineJobs.__table__.c.papers_found.default.arg == 0
    assert PipelineJobs.__table__.c.papers_processed.default.arg == 0
    assert PipelineJobs.__table__.c.relationships_created.default.arg == 0
