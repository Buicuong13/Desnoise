from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_llm_provider_for_user
from app.core.exceptions import NotFound, ValidationError
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import LLMProvider, PageStatus
from app.models.page import Page
from app.workers.llm_correction_task import llm_correct_page_task

router = APIRouter()


def _get_owned_page(page_id: UUID, user, db: Session) -> Page:
    page = db.get(Page, page_id)
    if page is None:
        raise NotFound("Page not found")
    doc = db.get(Document, page.document_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Page not found")
    return page


@router.post("/pages/{page_id}/llm-correction", status_code=status.HTTP_202_ACCEPTED)
def trigger_llm_correction(
    page_id: UUID,
    user: CurrentUser,
    db: Session = Depends(get_db),
    provider: LLMProvider = Depends(get_llm_provider_for_user),
) -> dict[str, str]:
    """User TRIGGERS LLM correction after reviewing OCR. Provider chosen by role."""
    page = _get_owned_page(page_id, user, db)
    if page.status not in (PageStatus.ocr_done, PageStatus.llm_done, PageStatus.llm_running, PageStatus.failed):
        raise ValidationError(
            f"OCR must complete before LLM correction (current status: {page.status.value})"
        )

    llm_correct_page_task.delay(str(page.id), user.role.value)
    return {
        "status": "enqueued",
        "page_id": str(page.id),
        "provider": provider.value,
    }
