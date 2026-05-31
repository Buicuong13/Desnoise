from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.exceptions import NotFound
from app.database.session import get_db
from app.models.correction import Correction
from app.models.document import Document
from app.models.enums import CorrectionStatus, PageStatus, UserRole
from app.models.page import Page
from app.schemas.correction import BulkReviewIn, CorrectionOut, FinalTextOut
from app.services.llm_correction_service import build_final_text, recompute_review

router = APIRouter()


def _get_owned_correction(correction_id: UUID, user, db: Session) -> Correction:
    correction = db.get(Correction, correction_id)
    if correction is None:
        raise NotFound("Correction not found")
    page = db.get(Page, correction.page_id)
    doc = db.get(Document, page.document_id) if page else None
    if doc is None or doc.user_id != user.id:
        raise NotFound("Correction not found")
    return correction


def _verify_page_ownership(page_id: UUID, user, db: Session) -> Page:
    page = db.get(Page, page_id)
    if page is None:
        raise NotFound("Page not found")
    doc = db.get(Document, page.document_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Page not found")
    return page


@router.get("/by-page/{page_id}", response_model=list[CorrectionOut])
def list_corrections(
    page_id: UUID,
    user: CurrentUser,
    db: Session = Depends(get_db),
    status: CorrectionStatus | None = Query(default=None),
) -> list[Correction]:
    """List LLM corrections for a page, optionally filtered by status."""
    _verify_page_ownership(page_id, user, db)
    q = db.query(Correction).filter(Correction.page_id == page_id)
    if status is not None:
        q = q.filter(Correction.status == status)
    return q.order_by(Correction.created_at).all()


@router.get("/by-page/{page_id}/final-text", response_model=FinalTextOut)
def get_final_text(
    page_id: UUID, user: CurrentUser, db: Session = Depends(get_db)
) -> FinalTextOut:
    """Reconstructed text: OCR words with `kept` LLM corrections applied."""
    _verify_page_ownership(page_id, user, db)
    text = build_final_text(db, page_id)
    return FinalTextOut(
        page_id=page_id,
        text=text,
        blurred=user.role == UserRole.viewer,
    )


def _set_status(correction: Correction, status: CorrectionStatus, user, db: Session) -> None:
    """Update a suggestion and re-derive the page's final_text + tiptap_json."""
    correction.status = status
    correction.reviewed_at = datetime.now(timezone.utc)
    correction.reviewed_by = user.id
    page = db.get(Page, correction.page_id)
    if page is not None:
        recompute_review(db, page)
        if page.status in (PageStatus.llm_done, PageStatus.ocr_done):
            page.status = PageStatus.reviewing


@router.post("/{correction_id}/keep", response_model=CorrectionOut)
def keep_correction(
    correction_id: UUID, user: CurrentUser, db: Session = Depends(get_db)
) -> Correction:
    correction = _get_owned_correction(correction_id, user, db)
    _set_status(correction, CorrectionStatus.kept, user, db)
    db.commit()
    db.refresh(correction)
    return correction


@router.post("/{correction_id}/undo", response_model=CorrectionOut)
def undo_correction(
    correction_id: UUID, user: CurrentUser, db: Session = Depends(get_db)
) -> Correction:
    correction = _get_owned_correction(correction_id, user, db)
    _set_status(correction, CorrectionStatus.undone, user, db)
    db.commit()
    db.refresh(correction)
    return correction


@router.post("/bulk", response_model=list[CorrectionOut])
def bulk_review(
    payload: BulkReviewIn, user: CurrentUser, db: Session = Depends(get_db)
) -> list[Correction]:
    """Apply Keep / Undo to many corrections at once."""
    touched: list[Correction] = []

    for cid in payload.accept_ids:
        c = _get_owned_correction(cid, user, db)
        _set_status(c, CorrectionStatus.kept, user, db)
        touched.append(c)

    for cid in payload.reject_ids:
        c = _get_owned_correction(cid, user, db)
        _set_status(c, CorrectionStatus.undone, user, db)
        touched.append(c)

    db.commit()
    for c in touched:
        db.refresh(c)
    return touched
