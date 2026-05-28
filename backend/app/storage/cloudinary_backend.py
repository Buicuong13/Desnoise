"""Cloudinary-backed image storage."""
import io

import cloudinary
import cloudinary.api
import cloudinary.uploader
import httpx
from PIL import Image

from app.core.config import settings
from app.core.logging import get_logger
from app.storage.base import StoredImage

logger = get_logger(__name__)


class CloudinaryStorage:
    def __init__(self) -> None:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

    def upload_image(self, data: bytes, *, folder: str, filename: str) -> StoredImage:
        public_id = f"{folder}/{filename}" if folder else filename
        result = cloudinary.uploader.upload(
            io.BytesIO(data),
            public_id=public_id,
            resource_type="image",
            overwrite=True,
        )
        logger.info("Uploaded image to Cloudinary: %s", result.get("public_id"))
        return StoredImage(
            key=result["public_id"],
            url=result["secure_url"],
            width=result.get("width"),
            height=result.get("height"),
            bytes_size=result.get("bytes", len(data)),
        )

    def download(self, key_or_url: str) -> bytes:
        url = key_or_url
        if not key_or_url.lower().startswith("http"):
            # Treat as a public_id and resolve to its delivery URL.
            url = cloudinary.utils.cloudinary_url(key_or_url)[0]
        response = httpx.get(url, timeout=60.0, follow_redirects=True)
        response.raise_for_status()
        return response.content

    def delete(self, key: str) -> None:
        try:
            cloudinary.uploader.destroy(key, resource_type="image")
        except Exception:  # noqa: BLE001 - best-effort cleanup
            logger.warning("Failed to delete Cloudinary asset: %s", key, exc_info=True)


def probe_dimensions(data: bytes) -> tuple[int, int]:
    """Read width/height from raw image bytes (used as a fallback)."""
    with Image.open(io.BytesIO(data)) as img:
        return img.width, img.height
