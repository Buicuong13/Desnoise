from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser

router = APIRouter()


@router.post("/pages/{page_id}/ocr", status_code=status.HTTP_202_ACCEPTED)
def trigger_ocr(page_id: UUID, user: CurrentUser) -> dict[str, object]:
    """User TRIGGERS OCR after denoise. Not auto-run."""
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: enqueue ocr_task")


@router.get("/pages/{page_id}/ocr")
def get_ocr_result(page_id: UUID, user: CurrentUser) -> dict[str, object]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: return ocr_words + suspicious flags")
