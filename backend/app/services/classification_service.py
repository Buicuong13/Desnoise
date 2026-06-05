"""Gate uploads through the document/non-document classifier.

Called by `POST /uploads/validate` between the direct Cloudinary upload and
`register-upload`: if the image is not a document, the frontend asks the user to
re-upload and never registers a page (no quota spent, no rejected rows in the DB).

Fail-open by design: if the classifier is disabled, the weights are missing,
torch is not installed, or inference errors, we return `is_document=True`
(label='unknown') so a model problem never blocks the whole pipeline.
"""
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.database.session import SessionLocal
from app.models.document import Document
from app.models.enums import PageStatus
from app.models.page import Page
from app.models.user import User
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


def classify_page(page_id: str | UUID) -> None:
    """Background document/non-document gate for a freshly uploaded page.

    Runs in the classify_queue worker (not the API process) so a slow or heavy
    model can never stall HTTP requests. The page is created at status
    `classifying`; this resolves it to:
      • `uploaded`  — looks like a document, ready for the user to denoise.
      • `rejected`  — not a document; the upload quota is refunded so the user
                      isn't charged for a rejected page.

    Fail-open: any unexpected error leaves the page `uploaded` (treated as a
    document) so a model problem never strands a page in `classifying`.
    """
    db = SessionLocal()
    try:
        page = db.get(Page, page_id)
        if page is None:
            logger.warning("classify_page: page %s not found", page_id)
            return

        page.status = PageStatus.classifying
        page.processing_error = None
        db.commit()

        verdict = classify_upload(page.cloudinary_public_id or page.original_url)
        page.doc_class = verdict["label"]
        page.doc_class_confidence = verdict["confidence"]

        if verdict["is_document"]:
            page.status = PageStatus.uploaded
            db.commit()
            logger.info("classify_page: page %s accepted as document", page_id)
            return

        # Not a document — reject and refund the quota spent at register time so
        # the user isn't charged for an image we won't process.
        pct = round(verdict["confidence"] * 100)
        page.status = PageStatus.rejected
        page.processing_error = f"Ảnh không phải tài liệu ({pct}% chắc chắn)."
        _refund_quota(db, page)
        db.commit()
        logger.info("classify_page: page %s rejected (non-document)", page_id)

    except Exception:  # noqa: BLE001 - never strand a page in `classifying`
        logger.exception("classify_page failed for %s — failing open", page_id)
        db.rollback()
        page = db.get(Page, page_id)
        if page is not None and page.status == PageStatus.classifying:
            page.status = PageStatus.uploaded
            db.commit()
    finally:
        db.close()


def _refund_quota(db, page: Page) -> None:
    """Give back the image-quota + page-count spent when the page was registered
    (a rejected non-document should not count against the user)."""
    document = db.get(Document, page.document_id)
    if document is not None:
        document.total_pages = max(0, (document.total_pages or 0) - 1)
        user = db.get(User, document.user_id)
        if user is not None:
            user.images_used = max(0, (user.images_used or 0) - 1)
