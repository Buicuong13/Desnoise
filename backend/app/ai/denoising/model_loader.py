"""Load the denoising/restoration generator model."""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _default_weights_path() -> Path:
    app_root = Path(__file__).resolve().parents[2]
    return app_root / "checkpoints" / "denoising" / "best_generator.weights.h5"


def get_weights_path(weights_path: Optional[str] = None) -> Path:
    configured_path = weights_path or settings.DENOISING_WEIGHTS_PATH
    if not configured_path:
        return _default_weights_path()

    path = Path(configured_path).expanduser()
    if path.is_absolute():
        return path

    backend_root = Path(__file__).resolve().parents[3]
    return backend_root / path


def build_generator(input_size: tuple[int, int, int] = (256, 256, 1), biggest_layer: int = 512):
    """Build the same U-Net generator architecture used in `atn-denoise.ipynb`."""
    try:
        import tensorflow as tf
        from tensorflow.keras.layers import Conv2D, Dropout, Input, MaxPooling2D, UpSampling2D
        from tensorflow.keras.layers import concatenate
        from tensorflow.keras.models import Model
    except ImportError as exc:
        raise RuntimeError(
            "TensorFlow is required for denoising. Install backend requirements first."
        ) from exc

    tf.keras.backend.clear_session()

    inputs = Input(input_size)

    c1 = Conv2D(64, 3, activation="relu", padding="same", kernel_initializer="he_normal")(inputs)
    c1 = Conv2D(64, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c1)
    p1 = MaxPooling2D(2)(c1)

    c2 = Conv2D(128, 3, activation="relu", padding="same", kernel_initializer="he_normal")(p1)
    c2 = Conv2D(128, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c2)
    p2 = MaxPooling2D(2)(c2)

    c3 = Conv2D(256, 3, activation="relu", padding="same", kernel_initializer="he_normal")(p2)
    c3 = Conv2D(256, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c3)
    p3 = MaxPooling2D(2)(c3)

    c4 = Conv2D(
        biggest_layer // 2,
        3,
        activation="relu",
        padding="same",
        kernel_initializer="he_normal",
    )(p3)
    c4 = Conv2D(
        biggest_layer // 2,
        3,
        activation="relu",
        padding="same",
        kernel_initializer="he_normal",
    )(c4)
    d4 = Dropout(0.5)(c4)
    p4 = MaxPooling2D(2)(d4)

    c5 = Conv2D(
        biggest_layer,
        3,
        activation="relu",
        padding="same",
        kernel_initializer="he_normal",
    )(p4)
    c5 = Conv2D(
        biggest_layer,
        3,
        activation="relu",
        padding="same",
        kernel_initializer="he_normal",
    )(c5)
    d5 = Dropout(0.5)(c5)

    u6 = Conv2D(512, 2, activation="relu", padding="same", kernel_initializer="he_normal")(
        UpSampling2D(2)(d5)
    )
    m6 = concatenate([d4, u6])
    c6 = Conv2D(512, 3, activation="relu", padding="same", kernel_initializer="he_normal")(m6)
    c6 = Conv2D(512, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c6)

    u7 = Conv2D(256, 2, activation="relu", padding="same", kernel_initializer="he_normal")(
        UpSampling2D(2)(c6)
    )
    m7 = concatenate([c3, u7])
    c7 = Conv2D(256, 3, activation="relu", padding="same", kernel_initializer="he_normal")(m7)
    c7 = Conv2D(256, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c7)

    u8 = Conv2D(128, 2, activation="relu", padding="same", kernel_initializer="he_normal")(
        UpSampling2D(2)(c7)
    )
    m8 = concatenate([c2, u8])
    c8 = Conv2D(128, 3, activation="relu", padding="same", kernel_initializer="he_normal")(m8)
    c8 = Conv2D(128, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c8)

    u9 = Conv2D(64, 2, activation="relu", padding="same", kernel_initializer="he_normal")(
        UpSampling2D(2)(c8)
    )
    m9 = concatenate([c1, u9])
    c9 = Conv2D(64, 3, activation="relu", padding="same", kernel_initializer="he_normal")(m9)
    c9 = Conv2D(64, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c9)
    c9 = Conv2D(2, 3, activation="relu", padding="same", kernel_initializer="he_normal")(c9)

    out = Conv2D(1, 1, activation="sigmoid")(c9)
    return Model(inputs=inputs, outputs=out, name="Generator")


@lru_cache(maxsize=1)
def load_model(weights_path: Optional[str] = None):
    """Load and cache the denoising generator with trained weights."""
    resolved_weights_path = get_weights_path(weights_path).resolve()
    if not resolved_weights_path.exists():
        raise FileNotFoundError(f"Denoising weights not found: {resolved_weights_path}")

    image_size = settings.DENOISING_IMAGE_SIZE
    logger.info("Loading denoising generator weights from %s", resolved_weights_path)

    model = build_generator(input_size=(image_size, image_size, 1), biggest_layer=512)
    model.load_weights(str(resolved_weights_path))
    logger.info("Denoising generator loaded.")
    return model
