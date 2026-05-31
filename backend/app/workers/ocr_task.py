"""Celery task wrapping the OCR service."""
from app.core.logging import get_logger
from app.services.ocr_service import ocr_page
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="ocr.page", bind=True, max_retries=1, default_retry_delay=10)
def ocr_page_task(self, page_id: str) -> str:
    logger.info("ocr_page_task started for %s", page_id)
    ocr_page(page_id)
    return page_id
