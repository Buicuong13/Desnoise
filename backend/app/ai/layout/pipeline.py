"""Document layout detection (DocLayout-YOLO) + column assignment.

The region-level building blocks the layout-aware OCR engine
(`app.ai.ocr.layout_engine`) uses to read multi-column pages in reading order:
  * ``detect_regions`` — run DocLayout-YOLO, return classified bboxes.
  * ``assign_columns``  — tag each region full-width / left / right.

Region filtering is keep-list based (``KEEP_CLASSES``): only textual classes
are OCR'd; everything else (figures, tables, captions, page furniture) is
dropped. The DocStructBench checkpoint exposes ``title`` + ``plain text``;
DocLayNet-style labels (``section-header`` / ``text``) are accepted too so
swapping the model still works. Labels are read from ``model.names`` at runtime
and normalised.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from PIL import Image

from app.ai.layout.model_loader import _stdio_with_encoding, load_layout_model
from app.core.config import settings


def _norm(label: str) -> str:
    """Normalise a class label: lowercase + unify spaces/underscores to '-'."""
    return re.sub(r"[\s_]+", "-", label.strip().lower())


# Textual regions we OCR. Anything not here is dropped. Normalised labels.
KEEP_CLASSES = {"title", "section-header", "plain-text", "text"}
# Headings: the engine OCRs these as a single line (psm 7).
TITLE_CLASSES = {"title", "section-header"}


@dataclass(slots=True)
class LayoutRegion:
    cls: str  # normalised label
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2 (image pixels)
    confidence: float
    column: str = "full"  # 'full' | 'left' | 'right'


def detect_regions(image: Image.Image) -> list[LayoutRegion]:
    """Run DocLayout-YOLO and return regions with bbox + normalised class."""
    bundle = load_layout_model()
    # ultralytics' LOGGER/TQDM can read sys.stdout, which is a LoggingProxy
    # (no `.encoding`) under Celery — guard the predict call.
    with _stdio_with_encoding():
        result = bundle.model.predict(
            image,
            imgsz=bundle.image_size,
            conf=settings.LAYOUT_CONF_THRESHOLD,
            device=settings.LAYOUT_DEVICE,
            verbose=False,
        )[0]

    regions: list[LayoutRegion] = []
    for box in result.boxes:
        cls_id = int(box.cls.item())
        raw = bundle.names.get(cls_id, str(cls_id))
        x1, y1, x2, y2 = (int(round(v)) for v in box.xyxy[0].tolist())
        regions.append(
            LayoutRegion(
                cls=_norm(raw),
                bbox=(x1, y1, x2, y2),
                confidence=float(box.conf.item()),
            )
        )
    return regions


def assign_columns(regions: list[LayoutRegion], page_width: int) -> None:
    """Tag each region as left / right / full-width (mutates in place).

    A box wider than ``LAYOUT_FULLWIDTH_RATIO`` of the page spans both columns
    (e.g. a title or a wide table) and stays 'full'. If nothing lands in the
    right column the page is single-column, so everything becomes 'full' and
    reads as one top-to-bottom stream.
    """
    mid = page_width / 2.0
    full_threshold = settings.LAYOUT_FULLWIDTH_RATIO * page_width
    for r in regions:
        x1, _, x2, _ = r.bbox
        if (x2 - x1) >= full_threshold:
            r.column = "full"
        elif (x1 + x2) / 2.0 < mid:
            r.column = "left"
        else:
            r.column = "right"
    if not any(r.column == "right" for r in regions):
        for r in regions:
            r.column = "full"
