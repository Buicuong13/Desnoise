import os
import unittest
from unittest.mock import Mock, patch

os.environ["DEBUG"] = "false"

from app.core.config import settings
from app.workers.inference_dispatch import InferenceDispatchError, enqueue_inference_task


class InferenceDispatchTests(unittest.TestCase):
    def test_runpod_submission_returns_job_id(self):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"id": "job-123"}

        with (
            patch.object(settings, "INFERENCE_BACKEND", "runpod"),
            patch.object(settings, "RUNPOD_ENDPOINT_ID", "endpoint-123"),
            patch.object(settings, "RUNPOD_API_KEY", "secret"),
            patch("app.workers.inference_dispatch.httpx.post", return_value=response) as post,
        ):
            job_id = enqueue_inference_task("ocr", page_id="page-123")

        self.assertEqual(job_id, "job-123")
        self.assertEqual(
            post.call_args.kwargs["json"]["input"],
            {"task": "ocr", "page_id": "page-123"},
        )

    def test_runpod_requires_server_side_credentials(self):
        with (
            patch.object(settings, "INFERENCE_BACKEND", "runpod"),
            patch.object(settings, "RUNPOD_ENDPOINT_ID", ""),
            patch.object(settings, "RUNPOD_API_KEY", ""),
        ):
            with self.assertRaises(InferenceDispatchError):
                enqueue_inference_task("classify", page_id="page-123")


if __name__ == "__main__":
    unittest.main()
