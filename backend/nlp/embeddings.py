"""Embeddings — lightweight hash-based vectors for entity deduplication.

No large model downloads required. Uses deterministic hashing for fast startup.
"""

import hashlib


def embed(texts: list[str]) -> list[list[float]]:
    """Generate deterministic pseudo-embeddings using hashing.

    Returns:
        List of 768-element float lists, one per input text.
    """
    dim = 768
    result = []
    for text in texts:
        vec = [0.0] * dim
        words = text.lower().split()
        for i, word in enumerate(words):
            h = hashlib.sha256(f"{word}_{i}".encode()).digest()
            for j in range(min(len(h), dim)):
                vec[j] += (h[j] - 128) / 128.0
        norm = sum(x * x for x in vec) ** 0.5
        if norm > 0:
            vec = [x / norm for x in vec]
        result.append(vec)
    return result
