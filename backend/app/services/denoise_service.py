"""Orchestrates denoising for a single page.

Flow: load page -> mark `denoising` -> download the original image ->
run model inference -> upload the restored image -> persist `denoised_url`
and mark the page `denoised`. On failure the page is marked `failed` with
the error recorded on `processing_error`.
"""
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from app.core.logging import get_logger
from app.database.session import SessionLocal
from app.models.enums import PageStatus
from app.models.page import Page
from app.storage import get_storage

logger = get_logger(__name__)


def denoise_page(page_id: str | UUID) -> None:
    """Download, denoise, and re-upload the image for ``page_id``."""
    from app.ai.denoising.inference import run_inference
    from app.ai.denoising.model_loader import load_model

    db = SessionLocal()
    try:
        page = db.get(Page, page_id)
        if page is None:
            logger.warning("denoise_page: page %s not found", page_id)
            return

        page.status = PageStatus.denoising
        page.processing_error = None
        db.commit()

        storage = get_storage()
        original_bytes = storage.download(page.cloudinary_public_id or page.original_url)

        with tempfile.TemporaryDirectory(prefix="denoise_") as tmp:
            tmp_path = Path(tmp)
            input_path = tmp_path / "input.png"
            output_path = tmp_path / "denoised.png"
            input_path.write_bytes(original_bytes)

            model = load_model()
            run_inference(model, str(input_path), str(output_path))

            denoised_bytes = output_path.read_bytes()

        stored = storage.upload_image(
            denoised_bytes,
            folder=f"documents/{page.document_id}/denoised",
            filename=f"page_{page.page_number}",
        )

        page.denoised_url = stored.url
        if stored.width and stored.height:
            page.width = stored.width
            page.height = stored.height
        page.status = PageStatus.denoised
        page.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("Denoised page %s -> %s", page_id, stored.url)

    except Exception as exc:  # noqa: BLE001 - record failure on the page
        logger.exception("Denoising failed for page %s", page_id)
        db.rollback()
        page = db.get(Page, page_id)
        if page is not None:
            page.status = PageStatus.failed
            page.processing_error = str(exc)[:2000]
            db.commit()
        raise
    finally:
        db.close()
