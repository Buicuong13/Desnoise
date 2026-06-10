"""Celery application.

Set ``CELERY_TASK_ALWAYS_EAGER=true`` in the environment to run tasks
synchronously in-process (no Redis broker / worker required) — useful for
testing the denoise pipeline through the HTTP API.
"""
import ssl

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

# Upstash / managed Redis dùng TLS qua scheme rediss://. Celery không tự kết nối
# nếu chưa khai báo ssl options. Cert do CA công khai cấp nên yêu cầu verify.
# redis:// (local docker) không bị ảnh hưởng.
if settings.CELERY_BROKER_URL.startswith("rediss://"):
    celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
if settings.CELERY_RESULT_BACKEND.startswith("rediss://"):
    celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_REQUIRED}

# Route each task to its own queue so a worker can be sized per workload: heavy
# CPU/GPU tasks (denoise) get a small pool, network-bound ones (LLM) a bigger
# one, and payment side-effects stay isolated so OCR/denoise can never starve
# them. Run one worker per queue, e.g.:
#   celery -A app.workers.celery_app worker -Q denoise_queue -c 1
# (see celery_redis_pool_deploy_plan.md / Readme_backend.md). Tasks with no
# explicit route fall back to `default`.
celery_app.conf.task_default_queue = "default"
celery_app.conf.task_routes = {
    "classify.page": {"queue": "classify_queue"},
    "denoise.page": {"queue": "denoise_queue"},
    "ocr.page": {"queue": "ocr_queue"},
    "llm.correct_page": {"queue": "llm_queue"},
    "payment.finalize": {"queue": "payment_queue"},
}

# Safety settings for long-running, memory-hungry ML tasks:
#   prefetch=1        → a worker grabs one task at a time (fair dispatch).
#   acks_late         → ack only after success, so a crash re-queues the task.
#   time limits       → kill tasks that hang (prefork only; threads/solo on
#                       Windows can't enforce the hard limit — prod runs Linux).
#   max_tasks_per_child→ recycle the process after N tasks to bound RAM leaks
#                       from torch/tesseract.
celery_app.conf.worker_prefetch_multiplier = 1
celery_app.conf.task_acks_late = True
celery_app.conf.task_time_limit = 600
celery_app.conf.task_soft_time_limit = 540
celery_app.conf.worker_max_tasks_per_child = 50

# Import task modules so they register with the app.
celery_app.autodiscover_tasks(["app.workers"])

from app.workers import (  # noqa: E402,F401  (register tasks)
    classify_task,
    denoise_task,
    llm_correction_task,
    ocr_task,
    payment_task,
)
