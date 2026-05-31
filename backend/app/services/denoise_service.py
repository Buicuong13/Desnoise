"""Orchestrates denoising for a single page.

Flow: load page -> mark `denoising` -> download the source image
(original, or the current denoised image when re-denoising) -> run model
inference -> upload the restored image as a NEW version -> bump
`denoise_version`, overwrite `denoised_url` (history keeps only the latest,
spec §5), and mark the page `denoised`. Each run is also logged to
`denoise_attempts` for debugging only.
"""
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from app.core.logging import get_logger
from app.database.session import SessionLocal
from app.models.denoise_attempt import DenoiseAttempt
from app.models.enums import PageStatus
from app.models.page import Page
from app.storage import get_storage

logger = get_logger(__name__)


def denoise_page(
    page_id: str | UUID,
    *,
    source: str = "original",
    params: dict | None = None,
) -> None:
    """Download, denoise, and re-upload the image for ``page_id``.

    `source`: "original" (default) or "current_denoised" to denoise again from
    the latest result.
    """
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

        # Resolve the source image: the current denoised one when re-denoising,
        # otherwise the original.
        if source == "current_denoised" and page.denoised_url:
            source_key = page.current_denoised_cloudinary_public_id or page.denoised_url
            source_url = page.denoised_url
        else:
            source_key = page.cloudinary_public_id or page.original_url
            source_url = page.original_url

        original_bytes = storage.download(source_key)

        with tempfile.TemporaryDirectory(prefix="denoise_") as tmp:
            tmp_path = Path(tmp)
            input_path = tmp_path / "input.png"
            output_path = tmp_path / "denoised.png"
            input_path.write_bytes(original_bytes)

            model = load_model()
            run_inference(model, str(input_path), str(output_path))

            denoised_bytes = output_path.read_bytes()

        new_version = (page.denoise_version or 0) + 1
        stored = storage.upload_image(
            denoised_bytes,
            folder=f"documents/{page.document_id}/denoised",
            filename=f"page_{page.page_number}_denoised_v{new_version}",
        )

        page.denoised_url = stored.url
        page.current_denoised_cloudinary_public_id = stored.key
        page.denoise_version = new_version
        if stored.width and stored.height:
            page.width = stored.width
            page.height = stored.height
        page.status = PageStatus.denoised
        page.completed_at = datetime.now(timezone.utc)

        # Debug-only attempt log (never shown in the main history).
        db.add(
            DenoiseAttempt(
                page_id=page.id,
                version=new_version,
                source_image_url=source_url,
                output_image_url=stored.url,
                output_cloudinary_public_id=stored.key,
                params_json={"source": source, **(params or {})},
            )
        )
        db.commit()
        logger.info("Denoised page %s -> v%s %s", page_id, new_version, stored.url)

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
