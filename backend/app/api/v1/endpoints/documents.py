from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.config import settings
from app.core.exceptions import NotFound, QuotaExceeded
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import DocumentStatus, UserRole
from app.schemas.document import DocumentCreate, DocumentOut

router = APIRouter()


def _get_owned_document(doc_id: UUID, user, db: Session) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Document not found")
    return doc


@router.get("", response_model=list[DocumentOut])
def list_workspaces(user: CurrentUser, db: Session = Depends(get_db)) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.user_id == user.id, Document.status != DocumentStatus.archived)
        .order_by(Document.created_at.desc())
        .all()
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DocumentOut)
def create_workspace(
    payload: DocumentCreate, user: CurrentUser, db: Session = Depends(get_db)
) -> Document:
    if user.role == UserRole.viewer:
        active_count = (
            db.query(func.count(Document.id))
            .filter(
                Document.user_id == user.id,
                Document.status != DocumentStatus.archived,
            )
            .scalar()
        )
        if active_count >= settings.VIEWER_MAX_WORKSPACES:
            raise QuotaExceeded(
                f"Viewer limit reached ({settings.VIEWER_MAX_WORKSPACES} workspaces)"
            )

    doc = Document(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        status=DocumentStatus.draft,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{doc_id}", response_model=DocumentOut)
def get_workspace(doc_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Document:
    return _get_owned_document(doc_id, user, db)


@router.patch("/{doc_id}/ui-state")
def patch_ui_state(doc_id: UUID, user: CurrentUser) -> dict[str, object]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: debounced ui_state save")


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_workspace(doc_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> None:
    doc = _get_owned_document(doc_id, user, db)
    doc.status = DocumentStatus.archived
    db.commit()
