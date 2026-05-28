from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser

router = APIRouter()


@router.post("/{correction_id}/keep")
def keep_correction(correction_id: UUID, user: CurrentUser) -> dict[str, object]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: set status='kept'")


@router.post("/{correction_id}/undo")
def undo_correction(correction_id: UUID, user: CurrentUser) -> dict[str, object]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: set status='undone'")


@router.post("/bulk")
def bulk_review(user: CurrentUser) -> dict[str, object]:
    """Body: {accept_ids: [...], reject_ids: [...]}."""
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: bulk keep/undo")
