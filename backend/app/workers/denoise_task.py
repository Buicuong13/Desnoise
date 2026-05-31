"""Celery task wrapping the denoise service."""
from app.core.logging import get_logger
from app.services.denoise_service import denoise_page
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="denoise.page", bind=True, max_retries=2, default_retry_delay=10)
def denoise_page_task(self, page_id: str, source: str = "original", params: dict | None = None) -> str:
    """Denoise the image for the given page id.

    `source`: "original" or "current_denoised" (for repeated "Denoise Again").
    """
    logger.info("denoise_page_task started for %s (source=%s)", page_id, source)
    denoise_page(page_id, source=source, params=params)
    return page_id
