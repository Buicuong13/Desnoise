"""Celery task wrapping the LLM correction service."""
from app.core.logging import get_logger
from app.services.llm_correction_service import llm_correct_page
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="llm.correct_page", bind=True, max_retries=1, default_retry_delay=15)
def llm_correct_page_task(self, page_id: str, user_role: str) -> int:
    logger.info("llm_correct_page_task started for %s (role=%s)", page_id, user_role)
    return llm_correct_page(page_id, user_role)
