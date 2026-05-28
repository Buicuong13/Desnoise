from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.database.session import get_db
from app.models.enums import UserStatus
from app.models.user import User
from app.schemas.auth import DevLoginIn, TokenOut

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register() -> dict[str, str]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: implement register")


@router.post("/login")
def login() -> dict[str, str]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: implement login")


@router.post("/refresh")
def refresh() -> dict[str, str]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: implement refresh")


@router.post("/logout")
def logout() -> dict[str, str]:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "TODO: implement logout")


@router.post("/dev-login", response_model=TokenOut)
def dev_login(payload: DevLoginIn, db: Session = Depends(get_db)) -> TokenOut:
    """DEV ONLY: get-or-create a user and return an access token for testing.

    Disabled outside the development environment.
    """
    if settings.APP_ENV != "development":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "dev-login is disabled")

    user = db.query(User).filter(User.email == payload.email).first()
    if user is None:
        user = User(
            email=payload.email,
            password_hash=hash_password("dev-password"),
            full_name="Dev User",
            role=payload.role,
            status=UserStatus.active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.role != payload.role:
        user.role = payload.role
        db.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    return TokenOut(access_token=token)
