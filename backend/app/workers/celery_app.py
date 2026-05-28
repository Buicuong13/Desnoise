"""Celery application.

Set ``CELERY_TASK_ALWAYS_EAGER=true`` in the environment to run tasks
synchronously in-process (no Redis broker / worker required) — useful for
testing the denoise pipeline through the HTTP API.
"""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "denoise",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_eager_propagates=settings.CELERY_TASK_ALWAYS_EAGER,
)

# Import task modules so they register with the app.
celery_app.autodiscover_tasks(["app.workers"])

from app.workers import denoise_task  # noqa: E402,F401  (register tasks)
