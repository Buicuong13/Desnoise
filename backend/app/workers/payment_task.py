"""Celery task for light, non-critical follow-ups after a successful payment.

Runs on the dedicated payment_queue (isolated from OCR/denoise) so these never
contend with heavy image work. The actual subscription activation happens
synchronously in the webhook (billing_service._activate_from_session) — this
task is ONLY for side-effects that may run a moment later: receipt email,
invoice sync, analytics, etc.
"""
from app.core.logging import get_logger
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="payment.finalize", bind=True, max_retries=3, default_retry_delay=30)
def payment_finalize_task(self, payment_id: str) -> str:
    """Post-payment side-effects. Subscription is already active by now."""
    # TODO: send receipt email / sync invoice. Kept as a logged no-op so the
    # queue + routing are wired end-to-end without external email creds.
    logger.info("payment_finalize_task: payment %s finalized (side-effects)", payment_id)
    return payment_id
