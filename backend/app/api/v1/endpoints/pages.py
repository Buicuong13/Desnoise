import io
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.config import settings
from app.core.exceptions import NotFound, QuotaExceeded, ValidationError
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import PageStatus, UserRole
from app.models.page import Page
from app.schemas.page import PageOut, PageStatusOut
from app.storage import get_storage
from app.workers.denoise_task import denoise_page_task

router = APIRouter()


def _allowed_types() -> set[str]:
    return {t.strip() for t in settings.ALLOWED_IMAGE_TYPES.split(",") if t.strip()}


def _get_owned_page(page_id: UUID, user, db: Session) -> Page:
    page = db.get(Page, page_id)
    if page is None:
        raise NotFound("Page not found")
    doc = db.get(Document, page.document_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Page not found")
    return page


@router.post(
    "/documents/{doc_id}/pages/upload",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=PageOut,
)
def upload_page(
    doc_id: UUID,
    user: CurrentUser,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Page:
    """Upload an image into a workspace; auto-enqueues the denoise task (NOT OCR/LLM)."""
    doc = db.get(Document, doc_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Document not found")

    if file.content_type not in _allowed_types():
        raise ValidationError(
            f"Unsupported file type '{file.content_type}'. Allowed: {settings.ALLOWED_IMAGE_TYPES}"
        )

    data = file.file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise ValidationError(f"File too large (max {settings.MAX_UPLOAD_SIZE_MB} MB)")
    if not data:
        raise ValidationError("Empty file")

    if user.role == UserRole.viewer and user.images_used >= settings.VIEWER_MAX_IMAGES:
        raise QuotaExceeded(f"Viewer image limit reached ({settings.VIEWER_MAX_IMAGES} images)")

    next_page_number = (
        db.query(func.coalesce(func.max(Page.page_number), 0))
        .filter(Page.document_id == doc_id)
        .scalar()
        + 1
    )

    storage = get_storage()
    stored = storage.upload_image(
        data,
        folder=f"documents/{doc_id}/original",
        filename=f"page_{next_page_number}",
    )

    page = Page(
        document_id=doc_id,
        page_number=next_page_number,
        cloudinary_public_id=stored.key,
        original_url=stored.url,
        file_size_kb=round(stored.bytes_size / 1024),
        width=stored.width,
        height=stored.height,
        status=PageStatus.uploaded,
    )
    db.add(page)
    doc.total_pages = (doc.total_pages or 0) + 1
    user.images_used = (user.images_used or 0) + 1
    db.commit()
    db.refresh(page)

    # Enqueue denoising. With CELERY_TASK_ALWAYS_EAGER=true this runs synchronously.
    denoise_page_task.delay(str(page.id))

    db.refresh(page)
    return page


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
