"""Signed direct-to-Cloudinary upload (spec §3).

The browser uploads the file straight to Cloudinary; the backend only
(1) signs the upload and (2) registers the resulting metadata. The backend
never receives the image binary on this path.
"""
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.config import settings
from app.core.exceptions import NotFound, QuotaExceeded, ValidationError
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import PageStatus, UserRole
from app.models.page import Page
from app.schemas.page import PageOut
from app.schemas.upload import (
    RegisterUploadIn,
    SignatureIn,
    SignatureOut,
)
from app.storage import get_storage
from app.storage.cloudinary_backend import CloudinaryStorage
from app.workers.classify_task import classify_page_task

router = APIRouter()

_SIGNATURE_TTL_SECONDS = 300


def _allowed_types() -> set[str]:
    return {t.strip() for t in settings.ALLOWED_IMAGE_TYPES.split(",") if t.strip()}


def _get_owned_document(doc_id: UUID, user, db: Session) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Workspace not found")
    return doc


@router.post("/uploads/signature", response_model=SignatureOut)
def create_upload_signature(
    payload: SignatureIn, user: CurrentUser, db: Session = Depends(get_db)
) -> SignatureOut:
    """Validate quota/permissions and return signed Cloudinary upload info."""
    _get_owned_document(payload.workspace_id, user, db)

    if payload.content_type not in _allowed_types():
        raise ValidationError(
            f"Unsupported file type '{payload.content_type}'. Allowed: {settings.ALLOWED_IMAGE_TYPES}"
        )
    if payload.file_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise ValidationError(f"File too large (max {settings.MAX_UPLOAD_SIZE_MB} MB)")

    if user.role == UserRole.viewer and (user.images_used or 0) >= settings.VIEWER_MAX_IMAGES:
        raise QuotaExceeded(f"Viewer image limit reached ({settings.VIEWER_MAX_IMAGES} images)")

    storage = get_storage()
    if not isinstance(storage, CloudinaryStorage):
        # Direct browser upload requires Cloudinary; the local-disk fallback
        # cannot accept browser uploads.
        raise ValidationError(
            "Direct upload requires Cloudinary to be configured (CLOUDINARY_*)."
        )

    folder = f"documents/{payload.workspace_id}/original"
    public_id = f"page_{uuid4().hex}_original"
    signed = storage.sign_upload(folder=folder, public_id=public_id)

    return SignatureOut(
        upload_url=signed["upload_url"],
        fields=signed["fields"],
        expires_in=_SIGNATURE_TTL_SECONDS,
    )


@router.post(
    "/documents/{doc_id}/pages/register-upload",
    status_code=status.HTTP_201_CREATED,
    response_model=PageOut,
)
def register_upload(
    doc_id: UUID,
    payload: RegisterUploadIn,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> Page:
    """Persist page metadata after a successful direct upload, then kick off the
    async document/non-document gate.

    The page is created at `classifying` and a classify task is enqueued onto
    the classify_queue worker; the frontend polls until it becomes `uploaded`
    (accepted) or `rejected` (not a document — quota is refunded by the worker).
    No auto-denoise — that stays a separate, user-triggered step.
    """
    doc = _get_owned_document(doc_id, user, db)

    if user.role == UserRole.viewer and (user.images_used or 0) >= settings.VIEWER_MAX_IMAGES:
        raise QuotaExceeded(f"Viewer image limit reached ({settings.VIEWER_MAX_IMAGES} images)")

    next_page_number = (
        db.query(func.coalesce(func.max(Page.page_number), 0))
        .filter(Page.document_id == doc_id)
        .scalar()
        + 1
    )

    page = Page(
        document_id=doc_id,
        page_number=next_page_number,
        cloudinary_public_id=payload.cloudinary_public_id,
        original_url=payload.original_image_url,
        file_size_kb=round(payload.file_size / 1024) if payload.file_size else None,
        width=payload.width,
        height=payload.height,
        status=PageStatus.classifying,
    )
    db.add(page)
    doc.total_pages = (doc.total_pages or 0) + 1
    user.images_used = (user.images_used or 0) + 1
    db.commit()
    db.refresh(page)

    # Run the classifier in the background (classify_queue) so the model never
    # runs in the API process. A rejected page refunds the quota spent above.
    classify_page_task.delay(str(page.id))
    return page


@router.post(
    "/pages/{page_id}/replace-upload",
    response_model=PageOut,
)
def replace_upload(
    page_id: UUID,
    payload: RegisterUploadIn,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> Page:
    """Swap the image of a *rejected* page in place and re-run the classifier.

    A page the classifier rejected (not a document) keeps its row + page_number;
    re-uploading reuses that same slot instead of creating a new page (which
    would leave the rejected page lingering and bump every later page number).
    The new image is classified again, so quota is re-charged here (and refunded
    again by the worker if it's rejected once more).
    """
    page = db.get(Page, page_id)
    if page is None:
        raise NotFound("Page not found")
    doc = _get_owned_document(page.document_id, user, db)

    if page.status != PageStatus.rejected:
        raise ValidationError("Only a rejected page can be replaced.")

    if user.role == UserRole.viewer and (user.images_used or 0) >= settings.VIEWER_MAX_IMAGES:
        raise QuotaExceeded(f"Viewer image limit reached ({settings.VIEWER_MAX_IMAGES} images)")

    # Best-effort: drop the rejected image from Cloudinary so it doesn't linger.
    old_public_id = page.cloudinary_public_id
    if old_public_id:
        try:
            get_storage().delete(old_public_id)
        except Exception:  # noqa: BLE001 - never block replace on a cleanup error
            pass

    page.cloudinary_public_id = payload.cloudinary_public_id
    page.original_url = payload.original_image_url
    page.file_size_kb = round(payload.file_size / 1024) if payload.file_size else None
    page.width = payload.width
    page.height = payload.height
    page.status = PageStatus.classifying
    page.processing_error = None
    page.doc_class = None
    page.doc_class_confidence = None

    # Re-charge the quota that the worker refunded when it rejected this page.
    doc.total_pages = (doc.total_pages or 0) + 1
    user.images_used = (user.images_used or 0) + 1
    db.commit()
    db.refresh(page)

    classify_page_task.delay(str(page.id))
    return page
