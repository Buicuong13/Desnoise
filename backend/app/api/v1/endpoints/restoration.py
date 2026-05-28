from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUser, get_llm_provider_for_user
from app.models.enums import LLMProvider

router = APIRouter()


@router.post("/pages/{page_id}/llm-correction", status_code=status.HTTP_202_ACCEPTED)
def trigger_llm_correction(
    page_id: UUID,
    user: CurrentUser,
    provider: LLMProvider = Depends(get_llm_provider_for_user),
) -> dict[str, object]:
    """User TRIGGERS LLM correction after reviewing OCR. Not auto-run."""
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        f"TODO: enqueue llm_correction_task (provider={provider.value})",
    )
