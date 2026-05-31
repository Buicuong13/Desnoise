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
from app.schemas.upload import RegisterUploadIn, SignatureIn, SignatureOut
from app.storage import get_storage
from app.storage.cloudinary_backend import CloudinaryStorage

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
    """Persist page metadata after a successful direct upload. No auto-denoise."""
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
        status=PageStatus.uploaded,
    )
    db.add(page)
    doc.total_pages = (doc.total_pages or 0) + 1
    user.images_used = (user.images_used or 0) + 1
    db.commit()
    db.refresh(page)
    return page
