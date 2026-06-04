"""Load the MobileNetV3-Small document/non-document classifier.

The checkpoint (`best_mobilenetv3_small_document_classifier.pth`) is the dict
saved by the training notebook:
    {model_state_dict, class_names, label2id, id2label, image_size, best_val_acc}

Loading is lazy + cached so the model is built only when the first image is
validated, and torch is only imported when actually needed (the rest of the
backend must run even if torch is not installed — see fail-open in
`classification_service`).
"""
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Fallback class order matching the training notebook (id -> label).
_DEFAULT_CLASS_NAMES = ["documents", "non_documents"]
_DEFAULT_ID2LABEL = {0: "documents", 1: "non_documents"}


@dataclass(slots=True)
class ClassifierBundle:
    model: object  # torch.nn.Module
    id2label: dict[int, str]
    class_names: list[str]
    image_size: int


def _default_weights_path() -> Path:
    app_root = Path(__file__).resolve().parents[2]  # .../backend/app
    return (
        app_root
        / "checkpoints"
        / "classifier"
        / "best_mobilenetv3_small_document_classifier.pth"
    )


def get_weights_path(weights_path: Optional[str] = None) -> Path:
    configured = weights_path or settings.CLASSIFIER_WEIGHTS_PATH
    if not configured:
        return _default_weights_path()
    path = Path(configured).expanduser()
    if path.is_absolute():
        return path
    backend_root = Path(__file__).resolve().parents[3]  # .../backend
    return backend_root / path


@lru_cache(maxsize=1)
def load_classifier(weights_path: Optional[str] = None) -> ClassifierBundle:
    """Build MobileNetV3-Small with a 2-class head and load trained weights."""
    import torch
    import torch.nn as nn
    from torchvision import models

    resolved = get_weights_path(weights_path).resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Classifier weights not found: {resolved}")

    logger.info("Loading document classifier weights from %s", resolved)

    # Newer torch defaults to weights_only=True; the checkpoint is a plain dict
    # of tensors + basic python types, but fall back explicitly for old/new.
    try:
        checkpoint = torch.load(str(resolved), map_location="cpu", weights_only=False)
    except TypeError:  # torch too old to know `weights_only`
        checkpoint = torch.load(str(resolved), map_location="cpu")

    class_names = checkpoint.get("class_names") or _DEFAULT_CLASS_NAMES
    id2label = checkpoint.get("id2label") or {i: n for i, n in enumerate(class_names)}
    # JSON/torch may store keys as str — normalise to int.
    id2label = {int(k): v for k, v in id2label.items()}
    image_size = int(checkpoint.get("image_size") or settings.CLASSIFIER_IMAGE_SIZE)

    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, len(class_names))
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    logger.info("Document classifier loaded (classes=%s, image_size=%s)", class_names, image_size)
    return ClassifierBundle(
        model=model,
        id2label=id2label,
        class_names=list(class_names),
        image_size=image_size,
    )
