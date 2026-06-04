"""Run document/non-document classification on a single image.

Preprocessing mirrors the notebook's `eval_transform`:
    Resize((256,256)) -> CenterCrop(image_size) -> ToTensor -> Normalize(ImageNet)
"""
import io
from functools import lru_cache

from app.ai.classifier.model_loader import load_classifier
from app.core.logging import get_logger

logger = get_logger(__name__)

_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]


@lru_cache(maxsize=1)
def _build_transform(image_size: int):
    from torchvision import transforms

    return transforms.Compose(
        [
            transforms.Resize((256, 256)),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize(mean=_IMAGENET_MEAN, std=_IMAGENET_STD),
        ]
    )


def classify_image_bytes(data: bytes) -> dict:
    """Classify raw image bytes.

    Returns a dict with the raw model output:
        {label, confidence, prob_documents, prob_non_documents}
    where `label` is one of the training class names ('documents' / 'non_documents').
    """
    import torch
    from PIL import Image

    bundle = load_classifier()
    transform = _build_transform(bundle.image_size)

    image = Image.open(io.BytesIO(data)).convert("RGB")
    x = transform(image).unsqueeze(0)

    with torch.no_grad():
        logits = bundle.model(x)
        probs = torch.softmax(logits, dim=1)[0]

    prob_list = [float(p) for p in probs]
    pred_id = int(torch.argmax(probs).item())
    label = bundle.id2label.get(pred_id, f"class_{pred_id}")

    # Index 0 == documents, 1 == non_documents per training (id2label).
    label_to_prob = {bundle.id2label.get(i, f"class_{i}"): prob_list[i] for i in range(len(prob_list))}

    return {
        "label": label,
        "confidence": prob_list[pred_id],
        "prob_documents": label_to_prob.get("documents", 0.0),
        "prob_non_documents": label_to_prob.get("non_documents", 0.0),
    }
