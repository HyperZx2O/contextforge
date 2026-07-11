import pytest

from api.routes.query import _WRITE_KEYWORDS


def _is_cypher_safe(cypher: str) -> bool:
    return _WRITE_KEYWORDS.search(cypher) is None


class TestCypherSafety:
    def test_safe_read_query(self):
        assert _is_cypher_safe("MATCH (n:Paper) RETURN n LIMIT 10")

    @pytest.mark.parametrize("cypher", [
        "CREATE (n:Paper {title: 'x'})",
        "MERGE (n:Paper {title: 'x'})",
        "MATCH (n) DELETE n",
        "MATCH (n) SET n.title = 'x'",
        "MATCH (n) REMOVE n.title",
        "DROP INDEX my_index",
        "match (n) delete n",
        "MATCH (n) CREATE (m) DELETE n",
        "MATCH (n) SET n.status = 'CREATED'",
    ])
    def test_unsafe_rejected(self, cypher):
        assert not _is_cypher_safe(cypher)
