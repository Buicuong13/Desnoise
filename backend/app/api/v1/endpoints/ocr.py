from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.exceptions import NotFound, ValidationError
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import PageStatus
from app.models.ocr_word import OcrWord
from app.models.page import Page
from app.schemas.ocr import LowConfidenceWord, OcrDocumentOut
from app.schemas.page import PageOut, TiptapPatchIn
from app.services.tiptap_service import tiptap_to_plain_text
from app.workers.ocr_task import ocr_page_task

router = APIRouter()


def _get_owned_page(page_id: UUID, user, db: Session) -> Page:
    page = db.get(Page, page_id)
    if page is None:
        raise NotFound("Page not found")
    doc = db.get(Document, page.document_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Page not found")
    return page


@router.post("/pages/{page_id}/ocr", status_code=status.HTTP_202_ACCEPTED)
def trigger_ocr(
    page_id: UUID, user: CurrentUser, db: Session = Depends(get_db)
) -> dict[str, str]:
    """User TRIGGERS OCR after denoise. Not auto-run."""
    page = _get_owned_page(page_id, user, db)
    if page.status not in (
        PageStatus.denoised,
        PageStatus.ocr_done,
        PageStatus.llm_done,
        PageStatus.reviewing,
        PageStatus.reviewed,
        PageStatus.ocr_running,
        PageStatus.failed,
    ):
        raise ValidationError(f"Page must be denoised first (current status: {page.status.value})")

    ocr_page_task.delay(str(page.id))
    return {"status": "enqueued", "page_id": str(page.id)}


@router.get("/pages/{page_id}/ocr", response_model=OcrDocumentOut)
def get_ocr_result(
    page_id: UUID, user: CurrentUser, db: Session = Depends(get_db)
) -> OcrDocumentOut:
    page = _get_owned_page(page_id, user, db)

    suspicious_count = (
        db.query(OcrWord)
        .filter(OcrWord.page_id == page.id, OcrWord.is_suspicious.is_(True))
        .count()
    )

    doc = page.ocr_document_json or {}
    low_conf = [LowConfidenceWord(**w) for w in doc.get("low_confidence_words", [])]

    return OcrDocumentOut(
        page_id=str(page.id),
        width=page.width,
        height=page.height,
        ocr_document=page.ocr_document_json,
        tiptap_json=page.tiptap_json,
        plain_text=page.ocr_plain_text or "",
        low_confidence_words=low_conf,
        suspicious_count=suspicious_count,
        # Quota already throttles the viewer (10 image cap); no extra blur.
        blurred=False,
    )


@router.patch("/pages/{page_id}/tiptap", response_model=PageOut)
def save_tiptap(
    page_id: UUID,
    payload: TiptapPatchIn,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> Page:
    """Persist a manual edit from the Tiptap editor and recompute final_text."""
    page = _get_owned_page(page_id, user, db)
    page.tiptap_json = payload.tiptap_json
    page.final_text = tiptap_to_plain_text(payload.tiptap_json)
    if page.status in (PageStatus.ocr_done, PageStatus.llm_done):
        page.status = PageStatus.reviewing
    db.commit()
    db.refresh(page)
    return page
