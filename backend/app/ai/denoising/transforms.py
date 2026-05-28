"""Image transforms / preprocessing for the denoising pipeline."""
import numpy as np
from PIL import Image


def normalize(image: np.ndarray) -> np.ndarray:
    """Normalize pixel values to [0, 1]."""
    return image.astype(np.float32) / 255.0


def denormalize(image: np.ndarray) -> np.ndarray:
    """Convert back to uint8 [0, 255]."""
    return (image * 255).clip(0, 255).astype(np.uint8)


def load_grayscale_image(path: str) -> np.ndarray:
    """Load an image as a normalized grayscale float32 array."""
    image = Image.open(path).convert("L")
    return normalize(np.array(image, dtype=np.float32))


def pad_to_patch_size(image: np.ndarray, patch_size: int) -> tuple[np.ndarray, tuple[int, int]]:
    """Pad the full-size image with white pixels for patch inference."""
    h_orig, w_orig = image.shape
    h_pad = ((h_orig // patch_size) + 1) * patch_size
    w_pad = ((w_orig // patch_size) + 1) * patch_size

    padded = np.ones((h_pad, w_pad), dtype=np.float32)
    padded[:h_orig, :w_orig] = image
    return padded, (h_orig, w_orig)
