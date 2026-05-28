"""Storage factory: Cloudinary when configured, otherwise local disk."""
from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger
from app.storage.base import Storage, StoredImage

logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_storage() -> Storage:
    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY:
        from app.storage.cloudinary_backend import CloudinaryStorage

        logger.info("Using Cloudinary storage backend.")
        return CloudinaryStorage()

    from app.storage.local_backend import LocalStorage

    logger.warning("Cloudinary not configured; falling back to local-disk storage.")
    return LocalStorage()


__all__ = ["Storage", "StoredImage", "get_storage"]
