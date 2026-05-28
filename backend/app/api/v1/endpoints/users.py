from fastapi import APIRouter

from app.api.deps import CurrentUser

router = APIRouter()


@router.get("/me")
def get_me(user: CurrentUser) -> dict[str, object]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "status": user.status.value,
        "images_used": user.images_used,
        "active_workspace_id": str(user.active_workspace_id) if user.active_workspace_id else None,
    }
