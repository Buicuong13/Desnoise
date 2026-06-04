"""OCR engine contract.

Routers and services depend on this interface, never on a concrete engine
(spec §6.3). Swap Tesseract for PaddleOCR PP-Structure or a cloud Document AI
by adding a new implementation and changing `get_ocr_service()` — the rest of
the system (orchestration, Tiptap convert, frontend) is unaffected.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Protocol, runtime_checkable

from app.core.config import settings
from app.schemas.ocr import OCRDocument


@runtime_checkable
class OCRService(Protocol):
    def extract_document_layout(self, image_bytes: bytes) -> OCRDocument:
        """Run OCR and return a full document-layout result."""
        ...


@lru_cache(maxsize=1)
def get_ocr_service() -> OCRService:
    """Resolve the configured OCR engine.

    With `LAYOUT_ENABLED` (default) the layout-aware engine reads multi-column
    pages region-by-region in the correct order; it falls back to whole-page
    Tesseract when no layout model/regions are available.
    """
    if settings.LAYOUT_ENABLED:
        from app.ai.ocr.layout_engine import LayoutAwareEngine

        return LayoutAwareEngine()

    from app.ai.ocr.tesseract_engine import TesseractLayoutEngine

    return TesseractLayoutEngine()
