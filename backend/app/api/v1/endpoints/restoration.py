from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.ai.llm.provider import resolve_llm_provider
from app.api.deps import CurrentUser
from app.core.exceptions import NotFound, ServiceUnavailable, ValidationError
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import PageStatus
from app.models.page import Page
from app.schemas.correction import TriggerCorrectionIn
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
    payload: TriggerCorrectionIn = TriggerCorrectionIn(),
) -> dict[str, str]:
    """User TRIGGERS LLM correction after reviewing OCR.

    A paid user may pick the model (`provider`: openai → gpt-4o-mini, or ollama);
    viewers are always forced onto the free tier. The backend resolves the
    effective provider so the client can never escalate to a paid model.
    """
    page = _get_owned_page(page_id, user, db)
    if page.status not in (PageStatus.ocr_done, PageStatus.llm_done, PageStatus.failed):
        raise ValidationError(
            f"OCR must complete before LLM correction (current status: {page.status.value})"
        )

    provider = resolve_llm_provider(user.role, payload.provider)
    previous_status = page.status
    page.status = PageStatus.llm_running
    page.processing_error = None
    db.commit()

    try:
        llm_correct_page_task.delay(str(page.id), user.role.value, provider.value)
    except Exception as exc:  # noqa: BLE001 - broker/network submission failure
        page.status = previous_status
        page.processing_error = str(exc)[:2000]
        db.commit()
        raise ServiceUnavailable("Could not start the LLM correction job") from exc

    return {
        "status": "enqueued",
        "page_id": str(page.id),
        "provider": provider.value,
    }
