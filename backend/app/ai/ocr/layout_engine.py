"""Layout-aware OCR engine (DocLayout-YOLO regions + per-region Tesseract).

Two-column / multi-region pages (e.g. academic papers) are unreadable with a
single whole-page Tesseract pass: ``--psm 6`` reads straight across both
columns and interleaves them. This engine first detects the textual regions
with DocLayout-YOLO, OCRs **each region separately**, and stitches them back
together in the correct reading order.

Crucially it returns the same `OCRDocument` shape (block → paragraph → line →
word, with char offsets + confidence + low-confidence words) as the plain
Tesseract engine, so low-confidence highlighting and LLM correction keep
working unchanged. Per-region OCR reuses `TesseractLayoutEngine` (battle-tested
offset/grouping logic) and the results are merged with shifted offsets/bboxes.

Reading order keeps section headers **in place**: regions are grouped into
full-width / left / right and each group is read top→bottom — headings are
ordinary regions sitting at their vertical position, not hoisted to the top.

Falls back to whole-page Tesseract if layout detection is unavailable (model
missing / not installed) or finds no textual regions.
"""
from __future__ import annotations

from io import BytesIO

import pytesseract
from PIL import Image

from app.ai.layout.pipeline import (
    KEEP_CLASSES,
    TITLE_CLASSES,
    LayoutRegion,
    assign_columns,
    detect_regions,
)
from app.ai.ocr.tesseract_engine import TesseractLayoutEngine, _configure_tesseract, _mean
from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.ocr import (
    LowConfidenceWord,
    OCRDocument,
    OcrBlockNode,
    OcrLineNode,
    OcrParagraphNode,
    OcrWordNode,
)

logger = get_logger(__name__)


def _reading_order(regions: list[LayoutRegion]) -> list[LayoutRegion]:
    """Full-width (top→bottom), then left column, then right column.

    Section headers are ordinary regions here — they keep their column and
    vertical position instead of being pulled to the front of the page.
    """
    def by_y(rs: list[LayoutRegion]) -> list[LayoutRegion]:
        return sorted(rs, key=lambda r: r.bbox[1])

    full = by_y([r for r in regions if r.column == "full"])
    left = by_y([r for r in regions if r.column == "left"])
    right = by_y([r for r in regions if r.column == "right"])
    return full + left + right


def _crop_png(image: Image.Image, region: LayoutRegion) -> tuple[bytes, int, int] | None:
    """Crop the region (with padding) and return (png_bytes, origin_x, origin_y).

    origin_* is the crop's top-left in full-page pixels, used to translate
    Tesseract's crop-relative bboxes back to page coordinates.
    """
    x1, y1, x2, y2 = region.bbox
    pad = settings.LAYOUT_CROP_PADDING
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(image.width, x2 + pad)
    y2 = min(image.height, y2 + pad)
    if x2 <= x1 or y2 <= y1:
        return None
    buf = BytesIO()
    image.crop((x1, y1, x2, y2)).save(buf, format="PNG")
    return buf.getvalue(), x1, y1


class LayoutAwareEngine:
    """`OCRService` backed by DocLayout-YOLO region detection + Tesseract."""

    def __init__(self) -> None:
        # Reused per-region (and as the whole-page fallback).
        self._tess = TesseractLayoutEngine()

    def extract_document_layout(self, image_bytes: bytes) -> OCRDocument:
        if not settings.LAYOUT_ENABLED:
            return self._tess.extract_document_layout(image_bytes)
        try:
            return self._run(image_bytes)
        except Exception:  # noqa: BLE001 — never let layout break OCR
            logger.exception("Layout OCR failed — falling back to whole-page Tesseract")
            return self._tess.extract_document_layout(image_bytes)

    def _run(self, image_bytes: bytes) -> OCRDocument:
        _configure_tesseract()
        lang = settings.TESSERACT_LANG or "eng"
        body_psm = settings.TESSERACT_PSM
        threshold = settings.SUSPICIOUS_CONFIDENCE_THRESHOLD / 100.0

        with Image.open(BytesIO(image_bytes)) as img:
            image = img.convert("RGB")
            width, height = image.width, image.height

            detected = detect_regions(image)
            kept = [r for r in detected if r.cls in KEEP_CLASSES]
            if not kept:
                logger.info("Layout: no textual regions detected — using whole-page Tesseract")
                return self._tess.extract_document_layout(image_bytes)

            assign_columns(kept, width)  # assign ALL kept regions (incl. headers)
            ordered = _reading_order(kept)
            logger.info(
                "Layout OCR: %d region(s) kept (full=%d left=%d right=%d)",
                len(kept),
                sum(r.column == "full" for r in kept),
                sum(r.column == "left" for r in kept),
                sum(r.column == "right" for r in kept),
            )

            # Assemble one continuous plain_text + offsets across all regions so
            # the Tiptap paragraph ranges line up exactly as before.
            plain_parts: list[str] = []
            blocks_out: list[OcrBlockNode] = []
            low_conf: list[LowConfidenceWord] = []
            cursor = 0
            wid = lid = pid = bid = 0
            first = True

            for region in ordered:
                crop = _crop_png(image, region)
                if crop is None:
                    continue
                crop_bytes, ox, oy = crop
                # Headings read cleaner as a single line (psm 7) than as a block.
                sub = self._tess.extract_document_layout(
                    crop_bytes, psm=7 if region.cls in TITLE_CLASSES else body_psm
                )
                paras = [p for blk in sub.blocks for p in blk.paragraphs]
                if not paras:
                    continue

                # Separate regions by a blank line in plain_text (same rule the
                # plain engine uses between paragraphs).
                if not first:
                    plain_parts.append("\n\n")
                    cursor += 2
                first = False
                base = cursor
                plain_parts.append(sub.plain_text)
                cursor += len(sub.plain_text)

                bid += 1
                new_paras: list[OcrParagraphNode] = []
                block_confs: list[float] = []
                for para in paras:
                    pid += 1
                    new_lines: list[OcrLineNode] = []
                    for line in para.lines:
                        lid += 1
                        new_words: list[OcrWordNode] = []
                        for w in line.words:
                            wid += 1
                            ns, ne = base + w.start_offset, base + w.end_offset
                            nb = [w.bbox[0] + ox, w.bbox[1] + oy, w.bbox[2] + ox, w.bbox[3] + oy]
                            node = OcrWordNode(
                                id=f"word_{wid}",
                                text=w.text,
                                bbox=nb,
                                confidence=w.confidence,
                                start_offset=ns,
                                end_offset=ne,
                            )
                            new_words.append(node)
                            block_confs.append(w.confidence)
                            if w.confidence < threshold:
                                low_conf.append(
                                    LowConfidenceWord(
                                        word_id=node.id,
                                        text=node.text,
                                        confidence=node.confidence,
                                        bbox=nb,
                                        start_offset=ns,
                                        end_offset=ne,
                                    )
                                )
                        lb = line.bbox
                        new_lines.append(
                            OcrLineNode(
                                id=f"line_{lid}",
                                bbox=[lb[0] + ox, lb[1] + oy, lb[2] + ox, lb[3] + oy],
                                text=line.text,
                                confidence=line.confidence,
                                words=new_words,
                            )
                        )
                    new_paras.append(
                        OcrParagraphNode(
                            id=f"para_{pid}",
                            bbox=list(region.bbox),
                            reading_order=pid,
                            lines=new_lines,
                        )
                    )
                blocks_out.append(
                    OcrBlockNode(
                        id=f"block_{bid}",
                        type="paragraph",
                        bbox=list(region.bbox),
                        reading_order=bid,
                        confidence=_mean(block_confs),
                        paragraphs=new_paras,
                    )
                )

        plain_text = "".join(plain_parts)
        logger.info(
            "Layout OCR done: %d block(s), %d word(s), %d low-confidence",
            len(blocks_out),
            wid,
            len(low_conf),
        )
        return OCRDocument(
            width=width,
            height=height,
            blocks=blocks_out,
            plain_text=plain_text,
            low_confidence_words=low_conf,
        )
