"""Dispatch heavy inference jobs to Celery or RunPod Serverless."""
from __future__ import annotations

from typing import Any, Literal

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

InferenceTask = Literal["classify", "denoise", "ocr"]


class InferenceDispatchError(RuntimeError):
    """Raised when an inference job cannot be accepted by its queue."""


def enqueue_inference_task(task: InferenceTask, **payload: Any) -> str:
    job_input = {"task": task, **payload}
    if settings.INFERENCE_BACKEND == "runpod":
        return _submit_runpod(job_input)
    return _submit_celery(task, payload)


def _submit_celery(task: InferenceTask, payload: dict[str, Any]) -> str:
    try:
        if task == "classify":
            from app.workers.classify_task import classify_page_task

            result = classify_page_task.delay(payload["page_id"])
        elif task == "denoise":
            from app.workers.denoise_task import denoise_page_task

            result = denoise_page_task.delay(
                payload["page_id"],
                payload.get("source", "original"),
                payload.get("params"),
            )
        elif task == "ocr":
            from app.workers.ocr_task import ocr_page_task

            result = ocr_page_task.delay(payload["page_id"])
        else:
            raise InferenceDispatchError(f"Unsupported inference task: {task}")
    except InferenceDispatchError:
        raise
    except Exception as exc:
        raise InferenceDispatchError(f"Celery rejected {task} job: {exc}") from exc

    return str(result.id)


def _submit_runpod(job_input: dict[str, Any]) -> str:
    if not settings.RUNPOD_ENDPOINT_ID or not settings.RUNPOD_API_KEY:
        raise InferenceDispatchError(
            "RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY are required when "
            "INFERENCE_BACKEND=runpod"
        )

    url = (
        f"{settings.RUNPOD_API_BASE_URL.rstrip('/')}/"
        f"{settings.RUNPOD_ENDPOINT_ID}/run"
    )
    request_body = {
        "input": job_input,
        "policy": {
            "executionTimeout": settings.RUNPOD_EXECUTION_TIMEOUT_MS,
            "ttl": settings.RUNPOD_JOB_TTL_MS,
        },
    }
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {settings.RUNPOD_API_KEY}"},
            json=request_body,
            timeout=settings.RUNPOD_SUBMIT_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise InferenceDispatchError(f"RunPod rejected inference job: {exc}") from exc

    job_id = data.get("id")
    if not job_id:
        raise InferenceDispatchError("RunPod response did not contain a job id")

    logger.info(
        "Submitted RunPod job %s (task=%s, page_id=%s)",
        job_id,
        job_input["task"],
        job_input.get("page_id"),
    )
    return str(job_id)
