"""Local-disk image storage used when Cloudinary is not configured.

Files live under ``LOCAL_STORAGE_DIR``. The ``url`` returned is the relative
storage key prefixed with ``local://`` so callers can tell the backends apart;
``download`` accepts either that reference or a bare key.
"""
import io
from pathlib import Path

from PIL import Image

from app.core.config import settings
from app.core.logging import get_logger
from app.storage.base import StoredImage

logger = get_logger(__name__)

_LOCAL_PREFIX = "local://"


def _base_dir() -> Path:
    base = Path(settings.LOCAL_STORAGE_DIR)
    if not base.is_absolute():
        backend_root = Path(__file__).resolve().parents[2]
        base = backend_root / base
    return base


def _key_from_reference(key_or_url: str) -> str:
    if key_or_url.startswith(_LOCAL_PREFIX):
        return key_or_url[len(_LOCAL_PREFIX) :]
    return key_or_url


class LocalStorage:
    def upload_image(self, data: bytes, *, folder: str, filename: str) -> StoredImage:
        key = f"{folder}/{filename}" if folder else filename
        dest = _base_dir() / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)

        width = height = None
        try:
            with Image.open(io.BytesIO(data)) as img:
                width, height = img.width, img.height
        except Exception:  # noqa: BLE001
            logger.warning("Could not read dimensions for %s", key)

        logger.info("Stored image locally: %s", dest)
        return StoredImage(
            key=key,
            url=f"{_LOCAL_PREFIX}{key}",
            width=width,
            height=height,
            bytes_size=len(data),
        )

    def download(self, key_or_url: str) -> bytes:
        key = _key_from_reference(key_or_url)
        path = _base_dir() / key
        if not path.exists():
            raise FileNotFoundError(f"Local storage object not found: {key}")
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = _base_dir() / _key_from_reference(key)
        path.unlink(missing_ok=True)
