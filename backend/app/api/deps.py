from collections.abc import Sequence
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, PermissionDenied
from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.enums import LLMProvider, UserRole
from app.models.user import User

# Declaring this scheme makes Swagger render an "Authorize" button that
# injects the `Authorization: Bearer <token>` header on every request.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Missing or invalid Authorization header")

    payload = decode_access_token(credentials.credentials)

    if payload.get("type") != "access":
        raise AuthenticationError("Not an access token")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token subject")

    user = db.get(User, user_id)
    if user is None:
        raise AuthenticationError("User not found")
    if user.status.value == "banned":
        raise PermissionDenied("Account banned")

    return user


def require_roles(*roles: UserRole):
    """Dependency factory: ensures current user has one of the listed roles."""

    def _dep(current: User = Depends(get_current_user)) -> User:
        if current.role not in roles:
            raise PermissionDenied(
                f"Required role: {[r.value for r in roles]}, got {current.role.value}"
            )
        return current

    return _dep


def get_llm_provider_for_user(user: User = Depends(get_current_user)) -> LLMProvider:
    """Backend picks LLM provider based on role — never trust client."""
    if user.role in (UserRole.user, UserRole.admin):
        return LLMProvider.openai
    return LLMProvider.openrouter_qwen


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles(UserRole.admin))]
PaidUser = Annotated[User, Depends(require_roles(UserRole.user, UserRole.admin))]


__all__: Sequence[str] = (
    "get_current_user",
    "require_roles",
    "get_llm_provider_for_user",
    "CurrentUser",
    "AdminUser",
    "PaidUser",
)
