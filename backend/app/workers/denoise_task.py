"""Celery task wrapping the denoise service."""
from app.core.logging import get_logger
from app.services.denoise_service import denoise_page
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="denoise.page", bind=True, max_retries=2, default_retry_delay=10)
def denoise_page_task(self, page_id: str) -> str:
    """Denoise the image for the given page id."""
    logger.info("denoise_page_task started for %s", page_id)
    denoise_page(page_id)
    return page_id
