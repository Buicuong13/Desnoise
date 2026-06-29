"""Orchestrates OCR for a single page.

Flow: load page → mark `ocr_running` → download the current denoised image →
run the OCR engine to get a document layout → persist `ocr_document_json`,
`ocr_plain_text`, the flat `ocr_words` rows (with offsets + suspicious flag),
and the converted `tiptap_json` → seed `final_text` → mark `ocr_done`.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete

from app.ai.ocr.base import get_ocr_service
from app.core.config import settings
from app.core.logging import get_logger
from app.database.session import SessionLocal
from app.models.enums import PageStatus
from app.models.ocr_word import OcrWord
from app.models.page import Page
from app.schemas.ocr import OCRDocument
from app.services.tiptap_service import ocr_document_to_tiptap
from app.storage import get_storage

logger = get_logger(__name__)


def _iter_words(doc: OCRDocument):
    """Yield (line_number, word_node) over the layout in reading order."""
    line_no = 0
    for block in doc.blocks:
        for para in block.paragraphs:
            for line in para.lines:
                line_no += 1
                for word in line.words:
                    yield line_no, word


def _avg_confidence(doc: OCRDocument) -> float | None:
    """Average per-word OCR confidence on a 0..100 scale (None if no words).

    This is the "restoration / recovery" metric: the OCR engine reports how sure
    it is about each word it read, and a cleaner image yields higher confidence.
    """
    confs = [word.confidence * 100 for _, word in _iter_words(doc)]
    if not confs:
        return None
    return round(sum(confs) / len(confs), 2)


def measure_avg_confidence(image_key: str) -> float | None:
    """OCR a single image and return its average per-word confidence (0..100).

    A lightweight, standalone version of the metric that doesn't persist any
    layout/words — used to seed the "before denoise" readability baseline both
    from the full OCR step and from the upload classifier (so the editor can
    show it the moment a page is accepted, before any denoise).
    """
    storage = get_storage()
    engine = get_ocr_service()
    doc = engine.extract_document_layout(storage.download(image_key))
    return _avg_confidence(doc)


def ocr_page(page_id: str | UUID) -> None:
    """Run document-layout OCR on the page's denoised image (falls back to original)."""
    db = SessionLocal()
    try:
        page = db.get(Page, page_id)
        if page is None:
            logger.warning("ocr_page: page %s not found", page_id)
            return

        page.status = PageStatus.ocr_running
        page.processing_error = None
        db.commit()

        storage = get_storage()
        # OCR uses the CURRENT denoised image when available (spec §4.3).
        source = page.denoised_url or page.cloudinary_public_id or page.original_url
        if not source:
            raise RuntimeError("Page has no image to OCR")
        image_bytes = storage.download(source)

        engine = get_ocr_service()
        doc = engine.extract_document_layout(image_bytes)
        doc.page_id = str(page.id)

        threshold = settings.SUSPICIOUS_CONFIDENCE_THRESHOLD  # 0..100 scale

        # Replace any previous OCR result for this page.
        db.execute(delete(OcrWord).where(OcrWord.page_id == page.id))
        index = 0
        for line_no, word in _iter_words(doc):
            conf_100 = round(word.confidence * 100, 2)
            x0, y0, x1, y1 = word.bbox
            db.add(
                OcrWord(
                    page_id=page.id,
                    word_index=index,
                    text=word.text,
                    confidence=conf_100,
                    bbox={"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0},
                    line_number=line_no,
                    is_suspicious=conf_100 < threshold,
                    start_offset=word.start_offset,
                    end_offset=word.end_offset,
                )
            )
            index += 1

        # ── Restoration metric: "how readable did the pipeline make this page?"
        # `after`  = avg confidence on the image we just OCR'd (denoised when set).
        # `before` = avg confidence OCR'ing the ORIGINAL noisy image. The original
        #   never changes, so we only pay for it ONCE per page (re-OCR keeps it).
        #   A failure here must never fail the OCR itself — it's a bonus metric.
        after_conf = _avg_confidence(doc)
        page.ocr_conf_after = after_conf
        page.recovery_score = after_conf

        if page.ocr_conf_before is None:
            source_is_original = not page.denoised_url
            if source_is_original:
                page.ocr_conf_before = after_conf
            else:
                try:
                    original_key = page.cloudinary_public_id or page.original_url
                    page.ocr_conf_before = measure_avg_confidence(original_key)
                except Exception:  # noqa: BLE001 - metric is best-effort only
                    logger.exception(
                        "Could not OCR the original image for the before-metric (page %s)",
                        page_id,
                    )

        page.ocr_document_json = doc.model_dump()
        page.ocr_plain_text = doc.plain_text
        page.tiptap_json = ocr_document_to_tiptap(doc)
        page.final_text = doc.plain_text
        page.status = PageStatus.ocr_done
        db.commit()
        logger.info("OCR done for page %s — %s words", page_id, index)

    except Exception as exc:  # noqa: BLE001
        logger.exception("OCR failed for page %s", page_id)
        db.rollback()
        page = db.get(Page, page_id)
        if page is not None:
            page.status = PageStatus.failed
            page.processing_error = str(exc)[:2000]
            db.commit()
        raise
    finally:
        db.close()
