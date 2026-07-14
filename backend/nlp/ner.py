"""NER wrapper — extracts entities from scientific text.

Tries SciSpaCy (en_core_sci_md) first, falls back to standard spaCy (en_core_web_sm).
"""

import logging

logger = logging.getLogger(__name__)

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        for model in ["en_core_sci_md", "en_core_web_sm"]:
            try:
                _nlp = spacy.load(model)
                logger.info("NER model loaded: %s", model)
                return _nlp
            except OSError:
                continue
        raise OSError("No spaCy model available. Install en_core_sci_md or en_core_web_sm.")
    return _nlp


def extract_entities(text: str) -> list[dict]:
    """Extract Method and Dataset entities from text.

    Returns:
        List of dicts with keys "entity_type" ("Method" or "Dataset") and "name".
    """
    doc = _get_nlp()(text)
    entities = []
    for ent in doc.ents:
        if ent.label_ in ("ENTITY", "PRODUCT", "TECHNOLOGY"):
            entities.append({"entity_type": "Method", "name": ent.text})
        elif ent.label_ in ("ORG", "NORP"):
            entities.append({"entity_type": "Dataset", "name": ent.text})
    return entities
