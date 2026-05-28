"""Run denoising inference on a single full-size image."""
from pathlib import Path

import numpy as np
from PIL import Image

from app.ai.denoising.transforms import denormalize, load_grayscale_image, pad_to_patch_size
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def run_inference(model, input_path: str, output_path: str) -> None:
    """Denoise an image without resizing it and save the restored grayscale PNG."""
    patch_size = settings.DENOISING_IMAGE_SIZE
    batch_size = max(1, settings.DENOISING_BATCH_SIZE)

    logger.info("Running denoising: %s -> %s", input_path, output_path)

    noisy_img = load_grayscale_image(input_path)
    padded, (h_orig, w_orig) = pad_to_patch_size(noisy_img, patch_size)
    h_pad, w_pad = padded.shape

    predicted = np.zeros((h_pad, w_pad), dtype=np.float32)
    patches = []
    positions = []

    def predict_pending_patches() -> None:
        if not patches:
            return

        patch_batch = np.asarray(patches, dtype=np.float32)[..., np.newaxis]
        predicted_patches = model.predict(patch_batch, batch_size=batch_size, verbose=0)
        for (y_pos, x_pos), patch in zip(positions, predicted_patches, strict=True):
            predicted[y_pos : y_pos + patch_size, x_pos : x_pos + patch_size] = patch[:, :, 0]
        patches.clear()
        positions.clear()

    for y in range(0, h_pad, patch_size):
        for x in range(0, w_pad, patch_size):
            patches.append(padded[y : y + patch_size, x : x + patch_size])
            positions.append((y, x))
            if len(patches) >= batch_size:
                predict_pending_patches()

    predict_pending_patches()

    predicted = predicted[:h_orig, :w_orig]
    if predicted.shape != noisy_img.shape:
        raise RuntimeError(
            f"Denoising output size mismatch: got {predicted.shape}, expected {noisy_img.shape}"
        )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(denormalize(predicted), mode="L").save(output_path)
