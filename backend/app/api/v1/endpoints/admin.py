from fastapi import APIRouter, HTTPException, status

from app.api.deps import AdminUser

router = APIRouter()


@router.get("/users")
def list_users(admin: AdminUser) -> dict[str, object]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: list users with filters")


@router.patch("/users/{user_id}")
def update_user(user_id: str, admin: AdminUser) -> dict[str, object]:
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED, "TODO: change role/ban + write audit_logs"
    )


@router.get("/history")
def history(admin: AdminUser) -> dict[str, object]:
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED, "TODO: join denoise/ocr/corrections across users"
    )


@router.get("/dashboard")
def dashboard(admin: AdminUser) -> dict[str, object]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: counts + revenue stats")
