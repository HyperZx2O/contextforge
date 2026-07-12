"""Cosine-similarity deduplication for entity embeddings."""

import numpy as np


def find_duplicate(new_embedding, existing_embeddings, threshold: float) -> int | None:
    """Find an existing entity whose embedding exceeds the cosine similarity threshold.

    Args:
        new_embedding: Embedding vector of the new entity.
        existing_embeddings: List of existing embedding vectors to compare against.
        threshold: Cosine similarity threshold (0.0-1.0). Values above this = duplicate.

    Returns:
        Index of the matching existing entity, or None if no match.

    Side effects:
        None.
    """
    if not existing_embeddings:
        return None
    new_vec = np.array(new_embedding, dtype=np.float32)
    existing_matrix = np.array(existing_embeddings, dtype=np.float32)
    norms = np.linalg.norm(existing_matrix, axis=1) * np.linalg.norm(new_vec)
    norms = np.where(norms == 0, 1.0, norms)
    similarities = existing_matrix @ new_vec / norms
    max_idx = int(np.argmax(similarities))
    if similarities[max_idx] > threshold:
        return max_idx
    return None
