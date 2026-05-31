"""OCR schemas.

`OCRDocument` is the internal document-layout contract (spec §6.2):
`block → paragraph → line → word` with bbox, confidence, reading_order and
char offsets. It is engine-agnostic — any `OCRService` implementation
(Tesseract, PaddleOCR, cloud Document AI) returns this shape.
"""
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# bbox is [x0, y0, x1, y1] in image pixels (spec §6.2).
BBox = list[int]


class OcrWordNode(BaseModel):
    id: str
    text: str
    bbox: BBox
    confidence: float  # 0..1
    start_offset: int
    end_offset: int


class OcrLineNode(BaseModel):
    id: str
    bbox: BBox
    text: str
    confidence: float
    words: list[OcrWordNode] = Field(default_factory=list)


class OcrParagraphNode(BaseModel):
    id: str
    bbox: BBox
    reading_order: int
    lines: list[OcrLineNode] = Field(default_factory=list)


class OcrBlockNode(BaseModel):
    id: str
    type: str = "paragraph"
    bbox: BBox
    reading_order: int
    confidence: float
    paragraphs: list[OcrParagraphNode] = Field(default_factory=list)


class LowConfidenceWord(BaseModel):
    word_id: str
    text: str
    confidence: float
    bbox: BBox
    start_offset: int
    end_offset: int


class OCRDocument(BaseModel):
    page_id: str | None = None
    width: int
    height: int
    blocks: list[OcrBlockNode] = Field(default_factory=list)
    plain_text: str = ""
    low_confidence_words: list[LowConfidenceWord] = Field(default_factory=list)


# ── API output shapes ────────────────────────────────────────────────────────

class OcrWordOut(BaseModel):
    """Flat word row (kept for the image-overlay view / backwards compat)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    word_index: int
    text: str
    confidence: float
    bbox: dict[str, Any] | None
    line_number: int | None
    is_suspicious: bool
    start_offset: int | None = None
    end_offset: int | None = None


class OcrDocumentOut(BaseModel):
    """Returned by GET /pages/{id}/ocr — layout JSON + Tiptap + plain text."""

    page_id: str
    width: int | None = None
    height: int | None = None
    ocr_document: dict[str, Any] | None = None
    tiptap_json: dict[str, Any] | None = None
    plain_text: str = ""
    low_confidence_words: list[LowConfidenceWord] = Field(default_factory=list)
    suspicious_count: int = 0
    blurred: bool = False
