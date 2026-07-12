import math
import pytest

from nlp.deduplication import find_duplicate


def _unit_vec(values):
    norm = math.sqrt(sum(v * v for v in values))
    return [v / norm for v in values]


def test_identical_vectors_return_index():
    vec = _unit_vec([1.0, 0.0, 0.0])
    result = find_duplicate(vec, [vec, vec], 0.85)
    assert result == 0


def test_orthogonal_vectors_return_none():
    v1 = _unit_vec([1.0, 0.0, 0.0])
    v2 = _unit_vec([0.0, 1.0, 0.0])
    result = find_duplicate(v1, [v2], 0.85)
    assert result is None


def test_threshold_boundary():
    v1 = _unit_vec([1.0, 0.0, 0.0])
    v2 = _unit_vec([0.7, 0.7, 0.0])
    cos_sim = sum(a * b for a, b in zip(v1, v2))
    result = find_duplicate(v1, [v2], cos_sim - 0.01)
    assert result == 0

    result_high = find_duplicate(v1, [v2], cos_sim + 0.01)
    assert result_high is None


def test_empty_embeddings():
    result = find_duplicate([1.0, 0.0], [], 0.85)
    assert result is None


def test_multiple_candidates():
    v1 = _unit_vec([1.0, 0.0, 0.0])
    v2 = _unit_vec([0.9, 0.1, 0.0])
    v3 = _unit_vec([0.0, 0.0, 1.0])
    result = find_duplicate(v1, [v3, v2], 0.85)
    assert result == 1
