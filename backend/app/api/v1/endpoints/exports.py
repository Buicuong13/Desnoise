"""Export a workspace to Word/PDF (spec §16).

Paid users / admins only — the `PaidUser` dependency blocks viewers at the
API layer (acceptance §13), not just in the UI.
"""
import io
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import PaidUser
from app.core.exceptions import NotFound, ValidationError
from app.database.session import get_db
from app.models.document import Document
from app.models.enums import ExportFormat, PageStatus
from app.models.export import Export
from app.models.page import Page
from app.services.export_service import build_docx, build_pdf

router = APIRouter()

_MEDIA = {
    ExportFormat.docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ExportFormat.pdf: "application/pdf",
}


def _get_owned_document(doc_id: UUID, user, db: Session) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None or doc.user_id != user.id:
        raise NotFound("Workspace not found")
    return doc


def _export(doc_id: UUID, fmt: ExportFormat, user, db: Session):
    doc = _get_owned_document(doc_id, user, db)
    pages = (
        db.query(Page).filter(Page.document_id == doc_id).order_by(Page.page_number).all()
    )
    if not pages:
        raise ValidationError("Workspace has no pages to export")

    data = build_docx(pages) if fmt == ExportFormat.docx else build_pdf(pages)
    filename = f"{doc.title or 'document'}_{doc_id}".replace(" ", "_")
    full_name = f"{filename}.{fmt.value}"
    # HTTP headers are latin-1 only, but a Vietnamese title (e.g. "ệ") isn't. Send
    # an ASCII-safe `filename=` fallback plus an RFC 5987 `filename*` with the real
    # UTF-8 name (percent-encoded) so the browser shows the proper name.
    ascii_name = full_name.encode("ascii", "ignore").decode() or f"document.{fmt.value}"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(full_name)}"

    # Stream the file straight to the browser — no Cloudinary upload, no stored
    # copy. The file is built in memory and sent once, so the API stays light
    # (matters on the 2 GB AWS host). The Export row keeps an audit trail (size,
    # time) but holds no download link; re-exporting is cheap.
    export = Export(
        document_id=doc_id,
        user_id=user.id,
        format=fmt,
        file_url="(streamed)",
        file_size_kb=round(len(data) / 1024),
    )
    db.add(export)
    for page in pages:
        page.status = PageStatus.exported
    db.commit()

    return StreamingResponse(
        io.BytesIO(data),
        media_type=_MEDIA[fmt],
        headers={"Content-Disposition": disposition},
    )


@router.post("/documents/{doc_id}/export/docx")
def export_docx(doc_id: UUID, user: PaidUser, db: Session = Depends(get_db)):
    return _export(doc_id, ExportFormat.docx, user, db)


@router.post("/documents/{doc_id}/export/pdf")
def export_pdf(doc_id: UUID, user: PaidUser, db: Session = Depends(get_db)):
    return _export(doc_id, ExportFormat.pdf, user, db)
