import io
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.exceptions import NotFound, ServiceUnavailable, ValidationError
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import PageStatus
from app.models.page import Page
from app.schemas.page import DenoiseIn, PageOut, PageStatusOut
from app.storage import get_storage
from app.workers.inference_dispatch import InferenceDispatchError, enqueue_inference_task

router = APIRouter()

# Statuses from which the user is allowed to (re)run denoise. Denoise is a
# user-triggered, repeatable step — never auto-chained (spec §4).
_DENOISE_ALLOWED = (
    PageStatus.uploaded,
    PageStatus.denoised,
    PageStatus.ocr_done,
    PageStatus.llm_done,
    PageStatus.reviewing,
    PageStatus.reviewed,
    PageStatus.failed,
)


def _get_owned_page(page_id: UUID, user, db: Session) -> Page:
    page = db.get(Page, page_id)
    if page is None:
        raise NotFound("Page not found")
    doc = db.get(Document, page.document_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Page not found")
    return page


@router.post("/pages/{page_id}/denoise", status_code=status.HTTP_202_ACCEPTED)
def trigger_denoise(
    page_id: UUID,
    user: CurrentUser,
    payload: DenoiseIn | None = None,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """User TRIGGERS denoise. Repeatable: pass source=current_denoised to
    "Denoise Again" from the latest result (spec §4.1, §4.3)."""
    page = _get_owned_page(page_id, user, db)
    if page.status not in _DENOISE_ALLOWED:
        raise ValidationError(f"Cannot denoise from status '{page.status.value}'")

    opts = payload or DenoiseIn()
    source = opts.source
    # If asked to denoise from the current denoised image but none exists yet,
    # fall back to the original.
    if source == "current_denoised" and not page.denoised_url:
        source = "original"

    page.status = PageStatus.denoising
    page.processing_error = None
    db.commit()

    try:
        enqueue_inference_task(
            "denoise",
            page_id=str(page.id),
            source=source,
            params=opts.params,
        )
    except InferenceDispatchError as exc:
        page.status = PageStatus.failed
        page.processing_error = str(exc)[:2000]
        db.commit()
        raise ServiceUnavailable("Could not start the denoise job") from exc

    return {"page_id": str(page.id), "status": PageStatus.denoising.value}


@router.get("/documents/{doc_id}/pages", response_model=list[PageOut])
def list_pages(doc_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> list[Page]:
    doc = db.get(Document, doc_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Document not found")
    return (
        db.query(Page)
        .filter(Page.document_id == doc_id)
        .order_by(Page.page_number)
        .all()
    )


@router.get("/pages/{page_id}", response_model=PageOut)
def get_page(page_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Page:
    return _get_owned_page(page_id, user, db)


@router.get("/pages/{page_id}/status", response_model=PageStatusOut)
def get_page_status(page_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Page:
    return _get_owned_page(page_id, user, db)


@router.get("/pages/{page_id}/download")
def download_page(
    page_id: UUID,
    user: CurrentUser,
    type: str = "denoised",
    db: Session = Depends(get_db),
):
    """User chooses to download the denoised (or original) image and STOP here."""
    if type not in ("denoised", "original"):
        raise ValidationError("type must be 'denoised' or 'original'")

    page = _get_owned_page(page_id, user, db)
    url = page.denoised_url if type == "denoised" else page.original_url
    if not url:
        raise NotFound(f"No {type} image available yet")

    # Cloudinary URLs are public — redirect the client straight to them.
    if url.lower().startswith("http"):
        return RedirectResponse(url)

    # Local-disk storage — stream the bytes back through the API.
    storage = get_storage()
    data = storage.download(url)
    media_type = "image/png" if type == "denoised" else "application/octet-stream"
    filename = f"page_{page.page_number}_{type}.png"
    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
