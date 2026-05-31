from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AuthenticationError, ValidationError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.database.session import get_db
from app.models.enums import UserRole, UserStatus
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    AuthSessionOut,
    DevLoginIn,
    LoginIn,
    LogoutIn,
    RefreshIn,
    RegisterIn,
    TokenOut,
    UserOut,
)

router = APIRouter()


def _issue_refresh_token(user: User, db: Session, request: Request | None) -> str:
    """Create + persist a rotating refresh token; return the raw value (shown once)."""
    raw, token_hash, expires_at = create_refresh_token()
    user_agent = request.headers.get("user-agent") if request else None
    ip = request.client.host if request and request.client else None
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            user_agent=user_agent[:255] if user_agent else None,
            ip=ip,
        )
    )
    return raw


def _make_session(user: User, db: Session, request: Request | None = None) -> AuthSessionOut:
    access = create_access_token(subject=user.id, role=user.role.value)
    refresh = _issue_refresh_token(user, db, request)
    db.commit()
    return AuthSessionOut(
        access_token=access, refresh_token=refresh, user=UserOut.model_validate(user)
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=AuthSessionOut)
def register(payload: RegisterIn, request: Request, db: Session = Depends(get_db)) -> AuthSessionOut:
    """Register a new free-tier (viewer) account."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise ValidationError("Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.viewer,
        status=UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _make_session(user, db, request)


@router.post("/login", response_model=AuthSessionOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> AuthSessionOut:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AuthenticationError("Invalid email or password")
    if user.status == UserStatus.banned:
        raise AuthenticationError("Account banned")
    return _make_session(user, db, request)


@router.post("/refresh", response_model=TokenOut)
def refresh(payload: RefreshIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    """Exchange a valid refresh token for a fresh access token (rotates refresh)."""
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    now = datetime.now(timezone.utc)
    if stored is None or stored.revoked_at is not None or stored.expires_at <= now:
        raise AuthenticationError("Invalid or expired refresh token")

    user = db.get(User, stored.user_id)
    if user is None or user.status == UserStatus.banned:
        raise AuthenticationError("Account not available")

    # Rotate: revoke the used token and mint a new one (refresh-token rotation).
    stored.revoked_at = now
    new_refresh = _issue_refresh_token(user, db, request)
    access = create_access_token(subject=user.id, role=user.role.value)
    db.commit()
    return TokenOut(access_token=access, refresh_token=new_refresh)


@router.post("/logout")
def logout(payload: LogoutIn | None = None, db: Session = Depends(get_db)) -> dict[str, str]:
    """Revoke the supplied refresh token (best-effort). Access token is stateless."""
    if payload and payload.refresh_token:
        token_hash = hash_refresh_token(payload.refresh_token)
        stored = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = datetime.now(timezone.utc)
            db.commit()
    return {"status": "ok"}


@router.post("/dev-login", response_model=TokenOut)
def dev_login(payload: DevLoginIn, db: Session = Depends(get_db)) -> TokenOut:
    """DEV ONLY: get-or-create a user and return an access token for testing."""
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
