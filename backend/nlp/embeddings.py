"""Embeddings - sentence-transformer vectors for entity deduplication and K-NN pairing.

Uses all-MiniLM-L6-v2 (384-dim, 22M params) for semantic similarity.
Model is loaded once and cached in memory.
"""

import logging

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Loaded embedding model: all-MiniLM-L6-v2")
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    """Generate semantic embeddings using sentence-transformers.

    Returns:
        List of 384-element float lists, one per input text.
    """
    if not texts:
        return []
    model = _get_model()
    embeddings = model.encode(
        texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True
    )
    return [e.tolist() for e in embeddings]


def embed_single(text: str) -> list[float]:
    """Convenience wrapper for a single text."""
    return embed([text])[0]
