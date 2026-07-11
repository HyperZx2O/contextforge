"""Hardcoded mock agent functions matching schemas. Swap for real imports on integration day."""

MOCK_PAPER_IDS = ["2401.00001", "2401.00002", "2401.00003"]
MOCK_ENTITY_IDS = ["entity-001", "entity-002", "entity-003"]


async def run_ingestion(job_id: str, query: str, year_from: int, year_to: int,
                        max_papers: int, sources: list[str]) -> list[str]:
    return MOCK_PAPER_IDS


async def run_extraction(job_id: str, paper_ids: list[str]) -> list[str]:
    return MOCK_ENTITY_IDS[: len(paper_ids)]


async def run_synthesis(job_id: str, paper_ids: list[str]) -> int:
    return len(paper_ids) * 2


async def run_gap_finder(job_id: str) -> int:
    return 1


async def call_llm(system_prompt: str, user_prompt: str) -> dict:
    return {
        "cypher": "MATCH (a:Paper)-[r:CONTRADICTS]->(b:Paper) RETURN a.arxiv_id AS source, b.arxiv_id AS target, type(r) AS rel_type, properties(r) AS rel_props LIMIT 10",
        "explanation": "Finds papers that contradict each other.",
    }


async def call_llm_answer(question: str, results: str) -> str:
    return "Based on the graph data: 3 papers found."
