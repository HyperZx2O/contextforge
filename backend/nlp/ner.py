"""SciSpaCy NER wrapper — extracts Method and Dataset entities from scientific text."""


_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        _nlp = spacy.load("en_core_sci_md")
    return _nlp


def extract_entities(text: str) -> list[dict]:
    """Extract Method and Dataset entities from scientific text using SciSpaCy.

    Args:
        text: Scientific abstract or text to extract entities from.

    Returns:
        List of dicts with keys "entity_type" ("Method" or "Dataset") and "name".

    Side effects:
        None. NLP model is loaded lazily on first call.
    """
    doc = _get_nlp()(text)
    entities = []
    for ent in doc.ents:
        if ent.label_ == "ENTITY":
            entities.append({"entity_type": "Method", "name": ent.text})
        elif ent.label_ == "ORG":
            entities.append({"entity_type": "Dataset", "name": ent.text})
    return entities
