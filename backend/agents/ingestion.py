"""Ingestion agent — fetches papers from arXiv, Semantic Scholar, GitHub, and NewsAPI, writes to papers_cache."""

import datetime as _dt
import logging
import xml.etree.ElementTree as ET

import httpx

from agents import ExternalAPIError, PipelineAgentError
from utils.backoff import retry
from utils.rate_limiter import default_limiter as _arxiv_limiter

logger = logging.getLogger(__name__)

_ATOM_NS = "{http://www.w3.org/2005/Atom}"


def _settings():
    from config import settings
    return settings


# ── arXiv ────────────────────────────────────────────────────────────────────

@retry(max_attempts=3, base_delay=1.0, exceptions=(httpx.TimeoutException, httpx.HTTPStatusError))
async def _fetch_arxiv_page(client: httpx.AsyncClient, query: str, year_from: int, year_to: int,
                            start: int, max_results: int) -> list[dict]:
    await _arxiv_limiter.acquire()
    params = {
        "search_query": f"all:{query}",
        "submittedDate": f"[{year_from}0101+TO+{year_to}1231]",
        "start": start,
        "max_results": min(max_results, 100),
    }
    logger.debug("arXiv request start=%d max=%d", start, max_results)
    resp = await client.get("http://export.arxiv.org/api/query", params=params, timeout=30)
    if resp.status_code == 429:
        resp.raise_for_status()
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    papers = []
    for entry in root.findall(f"{_ATOM_NS}entry"):
        arxiv_id_url = entry.findtext(f"{_ATOM_NS}id", "")
        arxiv_id = arxiv_id_url.split("/abs/")[-1] if "/abs/" in arxiv_id_url else arxiv_id_url
        title = entry.findtext(f"{_ATOM_NS}title", "").replace("\n", " ").strip()
        abstract = entry.findtext(f"{_ATOM_NS}summary", "").replace("\n", " ").strip()
        published = entry.findtext(f"{_ATOM_NS}published", "")[:10]

        authors = []
        for author_el in entry.findall(f"{_ATOM_NS}author"):
            name = author_el.findtext(f"{_ATOM_NS}name", "")
            if name:
                authors.append({"name": name, "institution": ""})

        papers.append({
            "arxiv_id": arxiv_id,
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "publish_date": published,
            "source": "arxiv",
            "url": f"https://arxiv.org/abs/{arxiv_id}",
        })
    return papers


async def _fetch_arxiv(client: httpx.AsyncClient, query: str, year_from: int, year_to: int,
                       max_papers: int) -> list[dict]:
    all_papers = []
    start = 0
    remaining = max_papers
    while remaining > 0:
        batch_size = min(remaining, 100)
        try:
            page = await _fetch_arxiv_page(client, query, year_from, year_to, start, batch_size)
        except (httpx.TimeoutException, httpx.HTTPStatusError) as exc:
            logger.warning("arXiv fetch failed at start=%d: %s", start, exc)
            break
        if not page:
            break
        all_papers.extend(page)
        start += len(page)
        remaining -= len(page)
        if len(page) < batch_size:
            break
    return all_papers


# ── Semantic Scholar ─────────────────────────────────────────────────────────

async def _enrich_semantic_scholar(client: httpx.AsyncClient, papers: list[dict]) -> list[dict]:
    import re as _re
    import asyncio
    s = _settings()
    if not s.SEMANTIC_SCHOLAR_API_KEY:
        return papers

    headers = {"x-api-key": s.SEMANTIC_SCHOLAR_API_KEY}
    enriched = []
    for paper in papers:
        arxiv_id = paper.get("arxiv_id")
        if not arxiv_id:
            enriched.append(paper)
            continue
        # Strip version suffix (e.g. "2002.00741v1" → "2002.00741")
        clean_id = _re.sub(r"v\d+$", "", arxiv_id)
        try:
            resp = await client.get(
                f"https://api.semanticscholar.org/graph/v1/paper/arXiv:{clean_id}",
                params={"fields": "citationCount,authors,externalIds"},
                headers=headers,
                timeout=15,
            )
            if resp.status_code == 429:
                logger.warning("Semantic Scholar 429 for %s, waiting 1s", clean_id)
                await asyncio.sleep(1)
                resp = await client.get(
                    f"https://api.semanticscholar.org/graph/v1/paper/arXiv:{clean_id}",
                    params={"fields": "citationCount,authors,externalIds"},
                    headers=headers,
                    timeout=15,
                )
            if resp.status_code == 200:
                data = resp.json()
                paper["citation_count"] = data.get("citationCount", 0) or paper.get("citation_count", 0)
            else:
                logger.warning("Semantic Scholar %d for %s", resp.status_code, clean_id)
        except Exception as exc:
            logger.warning("Semantic Scholar error for %s: %s", clean_id, exc)
        enriched.append(paper)
    return enriched


# ── GitHub ───────────────────────────────────────────────────────────────────

async def _fetch_github(client: httpx.AsyncClient, query: str) -> list[dict]:
    s = _settings()
    headers = {"Authorization": f"Bearer {s.GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    try:
        resp = await client.get(
            "https://api.github.com/search/repositories",
            params={"q": query, "sort": "stars", "per_page": 20},
            headers=headers,
            timeout=15,
        )
        if resp.status_code == 403:
            logger.warning("GitHub 403 rate limit, skipping GitHub results")
            return []
        resp.raise_for_status()
        repos = resp.json().get("items", [])
    except Exception as exc:
        logger.warning("GitHub search error: %s", exc)
        return []

    papers = []
    for repo in repos:
        owner = repo["owner"]["login"]
        name = repo["name"]
        try:
            readme_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{name}/readme",
                headers={**headers, "Accept": "application/vnd.github.v3.raw"},
                timeout=15,
            )
            if readme_resp.status_code == 403:
                logger.warning("GitHub 403 on README %s/%s, skipping remaining", owner, name)
                break
            readme_resp.raise_for_status()
            abstract = readme_resp.text[:2000]
        except Exception:
            abstract = repo.get("description", "") or ""

        papers.append({
            "arxiv_id": None,
            "title": f"{owner}/{name}",
            "abstract": abstract,
            "authors": [{"name": owner, "institution": "GitHub"}],
            "publish_date": repo.get("created_at", "")[:10],
            "source": "github",
            "url": repo["html_url"],
        })
    return papers


# ── NewsAPI ──────────────────────────────────────────────────────────────────

async def _fetch_newsapi(client: httpx.AsyncClient, query: str, year_from: int) -> list[dict]:
    s = _settings()
    if not s.NEWS_API_KEY:
        return []
    try:
        resp = await client.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "from": f"{year_from}-01-01",
                "sortBy": "relevancy",
                "apiKey": s.NEWS_API_KEY,
            },
            timeout=15,
        )
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
    except Exception as exc:
        logger.warning("NewsAPI error: %s, skipping news source", exc)
        return []

    papers = []
    for article in articles:
        papers.append({
            "arxiv_id": None,
            "title": article.get("title", ""),
            "abstract": article.get("description", "") or "",
            "authors": [{"name": article.get("author", "Unknown"), "institution": ""}],
            "publish_date": (article.get("publishedAt") or "")[:10],
            "source": "news",
            "url": article.get("url", ""),
        })
    return papers


# ── DB Write ─────────────────────────────────────────────────────────────────

async def _write_papers(papers: list[dict]) -> list[str]:
    import json as _json
    from db.models import PapersCache
    from db.postgres_client import _get_session_maker
    from sqlalchemy import select

    session_factory = _get_session_maker()
    ids = []
    async with session_factory() as session:
        for paper in papers:
            arxiv_id = paper.get("arxiv_id")
            title = paper.get("title", "")
            if not title:
                continue

            if arxiv_id:
                existing = await session.execute(
                    select(PapersCache.id).where(PapersCache.arxiv_id == arxiv_id)
                )
                row = existing.scalar()
                if row:
                    ids.append(str(row))
                    continue

            pub_date = None
            if paper.get("publish_date"):
                try:
                    pub_date = _dt.date.fromisoformat(paper["publish_date"])
                except (ValueError, TypeError):
                    pass

            authors = paper.get("authors")
            if authors and not isinstance(authors, str):
                authors = _json.dumps(authors)

            new_paper = PapersCache(
                arxiv_id=arxiv_id,
                doi=paper.get("doi"),
                title=title,
                abstract=paper.get("abstract", ""),
                authors=authors,
                publish_date=pub_date,
                citation_count=paper.get("citation_count", 0),
                source=paper.get("source", "unknown"),
                url=paper.get("url"),
            )
            session.add(new_paper)
            await session.flush()
            ids.append(str(new_paper.id))
        await session.commit()
    return ids


async def _write_papers_to_neo4j(papers: list[dict]):
    """Write ingested papers to Neo4j as Paper nodes (MERGE to avoid duplicates)."""
    try:
        from db.neo4j_client import execute_query
    except Exception as exc:
        logger.warning("Neo4j not available, skipping Neo4j write: %s", exc)
        return

    for paper in papers:
        arxiv_id = paper.get("arxiv_id")
        if not arxiv_id:
            continue
        try:
            authors = paper.get("authors", [])
            if isinstance(authors, list):
                author_names = [a.get("name", "") if isinstance(a, dict) else str(a) for a in authors]
            else:
                author_names = []

            await execute_query(
                "MERGE (p:Paper {arxiv_id: $arxiv_id}) "
                "SET p.title = $title, "
                "    p.abstract = $abstract, "
                "    p.authors = $authors, "
                "    p.publish_date = date($publish_date), "
                "    p.citation_count = $citation_count, "
                "    p.source = $source, "
                "    p.url = $url",
                {
                    "arxiv_id": arxiv_id,
                    "title": paper.get("title", ""),
                    "abstract": paper.get("abstract", ""),
                    "authors": author_names,
                    "publish_date": paper.get("publish_date") or "2024-01-01",
                    "citation_count": paper.get("citation_count", 0),
                    "source": paper.get("source", "unknown"),
                    "url": paper.get("url", ""),
                },
            )
        except Exception as exc:
            logger.warning("Failed to write paper %s to Neo4j: %s", arxiv_id, exc)


async def _update_job(job_id: str, status: str, papers_found: int):
    from db.models import PipelineJobs
    from db.postgres_client import _get_session_maker
    from sqlalchemy import select

    session_factory = _get_session_maker()
    async with session_factory() as session:
        result = await session.execute(select(PipelineJobs).where(PipelineJobs.id == job_id))
        job = result.scalar()
        if job:
            job.status = status
            job.papers_found = papers_found
            await session.commit()


async def _set_job_failed(job_id: str, error_message: str):
    from db.models import PipelineJobs
    from db.postgres_client import _get_session_maker
    from sqlalchemy import select

    session_factory = _get_session_maker()
    async with session_factory() as session:
        result = await session.execute(select(PipelineJobs).where(PipelineJobs.id == job_id))
        job = result.scalar()
        if job:
            job.status = "failed"
            job.error_message = error_message
            await session.commit()


# ── Main Entry Point ─────────────────────────────────────────────────────────

async def run_ingestion(job_id: str, query: str, year_from: int, year_to: int,
                        max_papers: int, sources: list[str]) -> list[str]:
    """Fetch papers from external sources and write to papers_cache.

    Args:
        job_id: Pipeline job UUID.
        query: Search query string.
        year_from: Start year for date range filter.
        year_to: End year for date range filter.
        max_papers: Maximum number of papers to return.
        sources: List of source names to query ("arxiv", "github", "news").

    Returns:
        List of paper UUID strings written to papers_cache.

    Side effects:
        - Writes rows to papers_cache (PostgreSQL).
        - Updates pipeline_jobs status and papers_found.
        - Calls arXiv API, Semantic Scholar API, GitHub API, NewsAPI.

    Raises:
        PipelineAgentError: On unrecoverable failure (DB error, etc.).
    """
    logger.info("ingestion started job_id=%s query='%s'", job_id, query)
    try:
        await _update_job(job_id, "ingesting", 0)

        all_papers = []
        async with httpx.AsyncClient(follow_redirects=True) as client:
            if "arxiv" in sources:
                arxiv_papers = await _fetch_arxiv(client, query, year_from, year_to, max_papers)
                arxiv_papers = await _enrich_semantic_scholar(client, arxiv_papers)
                all_papers.extend(arxiv_papers)

            if "github" in sources:
                github_papers = await _fetch_github(client, query)
                all_papers.extend(github_papers)

            if "news" in sources:
                news_papers = await _fetch_newsapi(client, query, year_from)
                all_papers.extend(news_papers)

        all_papers = all_papers[:max_papers]
        paper_ids = await _write_papers(all_papers)

        # Write papers to Neo4j so synthesis can create edges
        await _write_papers_to_neo4j(all_papers)

        await _update_job(job_id, "ingesting", len(paper_ids))

        logger.info("ingestion complete job_id=%s papers=%d", job_id, len(paper_ids))
        return paper_ids
    except PipelineAgentError:
        raise
    except Exception as exc:
        logger.error("ingestion failed job_id=%s: %s", job_id, exc, exc_info=True)
        await _set_job_failed(job_id, str(exc))
        raise PipelineAgentError(str(exc)) from exc
