import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

os.environ["DEBUG"] = "false"

from app.api.v1.endpoints.ocr import trigger_ocr
from app.api.v1.endpoints.restoration import trigger_llm_correction
from app.core.exceptions import ValidationError
from app.models.document import Document
from app.models.enums import PageStatus, UserRole
from app.models.page import Page
from app.schemas.correction import TriggerCorrectionIn


def _request_context(status: PageStatus):
    page_id = uuid4()
    document_id = uuid4()
    user_id = uuid4()
    page = SimpleNamespace(
        id=page_id,
        document_id=document_id,
        status=status,
        processing_error="old error",
    )
    document = SimpleNamespace(id=document_id, user_id=user_id)
    user = SimpleNamespace(id=user_id, role=UserRole.user)
    db = Mock()

    def get_model(model, _id):
        if model is Page:
            return page
        if model is Document:
            return document
        return None

    db.get.side_effect = get_model
    return page_id, page, user, db


class EndpointJobReservationTests(unittest.TestCase):
    def test_ocr_reserves_page_before_dispatch(self):
        page_id, page, user, db = _request_context(PageStatus.denoised)

        with patch("app.api.v1.endpoints.ocr.enqueue_inference_task") as enqueue:
            trigger_ocr(page_id, user, db=db)

        self.assertEqual(page.status, PageStatus.ocr_running)
        self.assertIsNone(page.processing_error)
        db.commit.assert_called_once()
        enqueue.assert_called_once_with("ocr", page_id=str(page_id))

    def test_ocr_rejects_duplicate_running_job(self):
        page_id, _page, user, db = _request_context(PageStatus.ocr_running)

        with patch("app.api.v1.endpoints.ocr.enqueue_inference_task") as enqueue:
            with self.assertRaises(ValidationError):
                trigger_ocr(page_id, user, db=db)

        enqueue.assert_not_called()

    def test_llm_reserves_page_before_dispatch(self):
        page_id, page, user, db = _request_context(PageStatus.ocr_done)

        with patch(
            "app.api.v1.endpoints.restoration.llm_correct_page_task.delay"
        ) as delay:
            trigger_llm_correction(
                page_id,
                user,
                db=db,
                payload=TriggerCorrectionIn(),
            )

        self.assertEqual(page.status, PageStatus.llm_running)
        self.assertIsNone(page.processing_error)
        db.commit.assert_called_once()
        delay.assert_called_once()

    def test_llm_rejects_duplicate_running_job(self):
        page_id, _page, user, db = _request_context(PageStatus.llm_running)

        with patch(
            "app.api.v1.endpoints.restoration.llm_correct_page_task.delay"
        ) as delay:
            with self.assertRaises(ValidationError):
                trigger_llm_correction(
                    page_id,
                    user,
                    db=db,
                    payload=TriggerCorrectionIn(),
                )

        delay.assert_not_called()


if __name__ == "__main__":
    unittest.main()
