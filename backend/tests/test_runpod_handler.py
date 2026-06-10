import os
import unittest
from unittest.mock import patch

os.environ["DEBUG"] = "false"

from app.runpod_handler import handler


class RunPodHandlerTests(unittest.TestCase):
    def test_dispatches_classification(self):
        with patch("app.services.classification_service.classify_page") as classify:
            result = handler(
                {
                    "id": "job-123",
                    "input": {"task": "classify", "page_id": "page-123"},
                }
            )

        classify.assert_called_once_with("page-123")
        self.assertEqual(
            result,
            {"status": "completed", "task": "classify", "page_id": "page-123"},
        )

    def test_rejects_unknown_task(self):
        with self.assertRaisesRegex(ValueError, "Unsupported task"):
            handler(
                {
                    "id": "job-123",
                    "input": {"task": "unknown", "page_id": "page-123"},
                }
            )


if __name__ == "__main__":
    unittest.main()
