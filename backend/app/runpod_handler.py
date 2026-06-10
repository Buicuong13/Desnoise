"""RunPod Serverless entrypoint for GPU-backed page processing."""
from __future__ import annotations

from typing import Any

from app.core.logging import get_logger, setup_logging

logger = get_logger(__name__)


def handler(job: dict[str, Any]) -> dict[str, str]:
    job_input = job.get("input")
    if not isinstance(job_input, dict):
        raise ValueError("job.input must be an object")

    task = job_input.get("task")
    page_id = job_input.get("page_id")
    if not isinstance(page_id, str) or not page_id:
        raise ValueError("input.page_id is required")

    logger.info(
        "RunPod job %s started (task=%s, page_id=%s)",
        job.get("id"),
        task,
        page_id,
    )

    if task == "classify":
        from app.services.classification_service import classify_page

        classify_page(page_id)
    elif task == "denoise":
        from app.services.denoise_service import denoise_page

        params = job_input.get("params")
        if params is not None and not isinstance(params, dict):
            raise ValueError("input.params must be an object or null")
        denoise_page(
            page_id,
            source=job_input.get("source", "original"),
            params=params,
        )
    elif task == "ocr":
        from app.services.ocr_service import ocr_page

        ocr_page(page_id)
    else:
        raise ValueError(f"Unsupported task: {task}")

    logger.info(
        "RunPod job %s completed (task=%s, page_id=%s)",
        job.get("id"),
        task,
        page_id,
    )
    return {"status": "completed", "task": task, "page_id": page_id}


if __name__ == "__main__":
    import runpod

    setup_logging()
    runpod.serverless.start({"handler": handler})
