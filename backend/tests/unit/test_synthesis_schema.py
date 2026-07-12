import pytest
from pydantic import ValidationError

from api.schemas import RelationshipResult


def test_relationship_result_accepts_valid():
    r = RelationshipResult(
        relationship_type="EXTENDS",
        confidence=0.85,
        evidence_quote="Paper A extends Paper B",
        dimension="methodology",
        direction="a_to_b",
    )
    assert r.relationship_type == "EXTENDS"
    assert r.confidence == 0.85


def test_relationship_result_rejects_missing_evidence_quote():
    with pytest.raises(ValidationError):
        RelationshipResult(
            relationship_type="EXTENDS",
            confidence=0.8,
            evidence_quote="",
            dimension="methodology",
            direction="a_to_b",
        )


def test_relationship_result_rejects_confidence_above_one():
    with pytest.raises(ValidationError):
        RelationshipResult(
            relationship_type="EXTENDS",
            confidence=1.5,
            evidence_quote="some evidence",
            dimension="methodology",
            direction="a_to_b",
        )


def test_relationship_result_rejects_confidence_below_zero():
    with pytest.raises(ValidationError):
        RelationshipResult(
            relationship_type="EXTENDS",
            confidence=-0.1,
            evidence_quote="some evidence",
            dimension="methodology",
            direction="a_to_b",
        )
