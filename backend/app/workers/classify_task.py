"""Celery task wrapping the document/non-document classifier.

Runs in the classify_queue worker so the (potentially heavy) model never runs
inside the API process — see celery_redis_pool_deploy_plan.md.
"""
from app.core.logging import get_logger
from app.services.classification_service import classify_page
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="classify.page", bind=True, max_retries=1, default_retry_delay=10)
def classify_page_task(self, page_id: str) -> str:
    """Classify the uploaded image for the given page id."""
    logger.info("classify_page_task started for %s", page_id)
    classify_page(page_id)
    return page_id
