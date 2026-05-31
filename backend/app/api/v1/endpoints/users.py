from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.auth import UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(user: CurrentUser) -> CurrentUser:
    return user
