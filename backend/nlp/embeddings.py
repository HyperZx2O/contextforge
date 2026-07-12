"""Sentence-transformer embeddings — generates 768-dim vectors via paraphrase-multilingual-mpnet-base-v2."""


_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("paraphrase-multilingual-mpnet-base-v2")
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    """Generate 768-dim sentence-transformer embeddings for a list of texts.

    Args:
        texts: List of strings to embed.

    Returns:
        List of 768-element float lists, one per input text.

    Side effects:
        None. Model is loaded lazily on first call.
    """
    model = _get_model()
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=False)
    return embeddings.tolist()
