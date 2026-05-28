"""Storage backend contract shared by Cloudinary and local-disk implementations."""
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(slots=True)
class StoredImage:
    """Result of persisting an image to a storage backend."""

    key: str  # Cloudinary public_id, or relative path for local storage
    url: str  # Publicly resolvable URL (Cloudinary) or local reference path
    width: int | None
    height: int | None
    bytes_size: int


@runtime_checkable
class Storage(Protocol):
    """Minimal image storage interface used by the page/denoise pipeline."""

    def upload_image(self, data: bytes, *, folder: str, filename: str) -> StoredImage:
        """Persist raw image bytes and return its stored location."""
        ...

    def download(self, key_or_url: str) -> bytes:
        """Fetch raw bytes for a previously stored image (by key or URL)."""
        ...

    def delete(self, key: str) -> None:
        """Remove a stored image. Best-effort; missing objects are ignored."""
        ...
