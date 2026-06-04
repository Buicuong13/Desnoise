"""Gate uploads through the document/non-document classifier.

Called by `POST /uploads/validate` between the direct Cloudinary upload and
`register-upload`: if the image is not a document, the frontend asks the user to
re-upload and never registers a page (no quota spent, no rejected rows in the DB).

Fail-open by design: if the classifier is disabled, the weights are missing,
torch is not installed, or inference errors, we return `is_document=True`
(label='unknown') so a model problem never blocks the whole pipeline.
"""
from app.core.config import settings
from app.core.logging import get_logger
from app.storage import get_storage

logger = get_logger(__name__)

# Frontend-facing labels (singular, friendly).
_LABEL_DOCUMENT = "document"
_LABEL_NON_DOCUMENT = "non_document"
_LABEL_UNKNOWN = "unknown"


def _fail_open(reason: str) -> dict:
    logger.warning("Document validation skipped (%s) — allowing upload through.", reason)
    return {
        "is_document": True,
        "label": _LABEL_UNKNOWN,
        "confidence": 0.0,
        "prob_documents": 0.0,
        "prob_non_documents": 0.0,
        "threshold": settings.CLASSIFIER_CONFIDENCE_THRESHOLD,
    }


def classify_upload(key_or_url: str) -> dict:
    """Download the uploaded image and classify it as document / non-document."""
    if not settings.CLASSIFIER_ENABLED:
        return _fail_open("CLASSIFIER_ENABLED=false")

    try:
        storage = get_storage()
        data = storage.download(key_or_url)
    except Exception:  # noqa: BLE001 - never block pipeline on a download error
        logger.exception("Could not download image for validation: %s", key_or_url)
        return _fail_open("download failed")

    try:
        from app.ai.classifier.inference import classify_image_bytes

        result = classify_image_bytes(data)
    except Exception:  # noqa: BLE001 - torch missing / weights missing / inference error
        logger.exception("Document classification failed for %s", key_or_url)
        return _fail_open("inference error")

    threshold = settings.CLASSIFIER_CONFIDENCE_THRESHOLD
    is_document = result["label"] == "documents" and result["prob_documents"] >= threshold
    friendly = _LABEL_DOCUMENT if is_document else _LABEL_NON_DOCUMENT

    logger.info(
        "Validated upload: label=%s prob_doc=%.4f prob_non=%.4f -> is_document=%s",
        result["label"],
        result["prob_documents"],
        result["prob_non_documents"],
        is_document,
    )

    return {
        "is_document": is_document,
        "label": friendly,
        # Confidence in the decision: P(document) when accepted, P(non-document) when rejected.
        "confidence": result["prob_documents"] if is_document else result["prob_non_documents"],
        "prob_documents": result["prob_documents"],
        "prob_non_documents": result["prob_non_documents"],
        "threshold": threshold,
    }
