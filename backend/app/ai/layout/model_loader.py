"""Load the DocLayout-YOLO document-layout detector.

`doclayout_yolo_docstructbench_imgsz1024.pt` is the DocStructBench checkpoint
published by the DocLayout-YOLO project. It detects coarse page regions
(title, plain text, abandon, figure, table, formula, captions ...). The OCR
pipeline (``app.ai.layout.pipeline``) uses it to keep only the *textual*
regions worth OCR-ing, in the correct reading order.

Loading mirrors the classifier loader: lazy + cached, and the heavy import
(`doclayout_yolo`) only happens on first use so the rest of the backend keeps
running even when the layout extra is not installed.
"""
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_WEIGHTS_FILENAME = "doclayout_yolo_docstructbench_imgsz1024.pt"


class _EncodedSink:
    """Minimal stdout/stderr stand-in that carries the attributes noisy libs probe.

    Under Celery, `sys.stdout` is a `LoggingProxy` with no `.encoding`; importing
    `doclayout_yolo` reads `sys.stdout.encoding` at import time (a Windows check)
    and crashes. We swap in this sink (encoding pre-set to 'utf-8' so the lib also
    skips its reconfigure path) only while streams lack `.encoding`.
    """

    encoding = "utf-8"

    def write(self, *_args, **_kwargs) -> int:
        return 0

    def flush(self) -> None:
        pass

    def isatty(self) -> bool:
        return False


@contextmanager
def _stdio_with_encoding():
    saved_out, saved_err = sys.stdout, sys.stderr
    if not hasattr(sys.stdout, "encoding"):
        sys.stdout = sys.__stdout__ or _EncodedSink()
    if not hasattr(sys.stderr, "encoding"):
        sys.stderr = sys.__stderr__ or _EncodedSink()
    try:
        yield
    finally:
        sys.stdout, sys.stderr = saved_out, saved_err


@dataclass(slots=True)
class LayoutModelBundle:
    model: object  # doclayout_yolo.YOLOv10
    names: dict[int, str]  # class id -> label, read from the checkpoint
    image_size: int


def _candidate_paths() -> list[Path]:
    here = Path(__file__).resolve()
    backend_root = here.parents[3]  # .../backend
    project_root = here.parents[4]  # repo root (where the .pt currently sits)
    return [
        backend_root / "app" / "checkpoints" / "layout" / _WEIGHTS_FILENAME,
        project_root / _WEIGHTS_FILENAME,
    ]


def get_weights_path(weights_path: Optional[str] = None) -> Path:
    configured = weights_path or settings.LAYOUT_WEIGHTS_PATH
    if configured:
        path = Path(configured).expanduser()
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[3] / path  # relative to backend/
        return path
    for candidate in _candidate_paths():
        if candidate.exists():
            return candidate
    return _candidate_paths()[0]  # default; load_layout_model raises if missing


@lru_cache(maxsize=1)
def load_layout_model(weights_path: Optional[str] = None) -> LayoutModelBundle:
    """Build the DocLayout-YOLO detector and load trained weights (lazy/cached)."""
    resolved = get_weights_path(weights_path).resolve()
    if not resolved.exists():
        raise FileNotFoundError(
            f"DocLayout-YOLO weights not found: {resolved}. "
            f"Place `{_WEIGHTS_FILENAME}` under backend/app/checkpoints/layout/ "
            f"or set LAYOUT_WEIGHTS_PATH in the environment."
        )

    try:
        # Import + model build under streams that have `.encoding` (Celery's
        # LoggingProxy doesn't), so doclayout_yolo's Windows stdout check works.
        with _stdio_with_encoding():
            from doclayout_yolo import YOLOv10
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise ImportError(
            "doclayout-yolo is not installed. Run `pip install doclayout-yolo` "
            "(see backend/requirements.txt)."
        ) from exc

    logger.info("Loading DocLayout-YOLO weights from %s", resolved)
    with _stdio_with_encoding():
        model = YOLOv10(str(resolved))
    names = {int(k): v for k, v in model.names.items()}
    logger.info("DocLayout-YOLO loaded (classes=%s)", names)
    return LayoutModelBundle(model=model, names=names, image_size=settings.LAYOUT_IMAGE_SIZE)
