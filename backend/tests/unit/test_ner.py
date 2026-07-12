import pytest

try:
    import spacy
    _nlp = spacy.load("en_core_sci_md")
    HAS_SPACY = True
except Exception:
    HAS_SPACY = False

pytestmark = pytest.mark.skipif(not HAS_SPACY, reason="en_core_sci_md not installed")

from nlp.ner import extract_entities


def test_extract_entities_returns_list():
    results = extract_entities("We propose a novel deep learning architecture.")
    assert isinstance(results, list)
    assert len(results) > 0


def test_extract_entities_bert():
    results = extract_entities(
        "We fine-tune BERT on the SQuAD dataset for question answering."
    )
    names = [e["name"] for e in results]
    assert any("BERT" in n for n in names)


def test_extract_entities_types():
    results = extract_entities(
        "We use BERT and evaluate on the GLUE benchmark."
    )
    types = {e["entity_type"] for e in results}
    assert "Method" in types or "Dataset" in types


def test_extract_entities_five_abstracts():
    abstracts = [
        "We fine-tune BERT on SQuAD for extractive question answering.",
        "GANs have shown strong results in image synthesis tasks.",
        "We evaluate ResNet-50 on ImageNet and report top-1 accuracy.",
        "Transformer architectures have replaced RNNs in NLP.",
        "We apply k-means clustering to the MNIST dataset for unsupervised learning.",
    ]
    for abstract in abstracts:
        results = extract_entities(abstract)
        assert len(results) >= 1, f"Expected ≥1 entity for: {abstract[:50]}..."


def test_extract_entities_gpe_ignored():
    results = extract_entities("The model was developed at Stanford in California.")
    for e in results:
        assert e["entity_type"] in ("Method", "Dataset")
