from fastapi import HTTPException, status


class AppError(HTTPException):
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)


class AuthenticationError(AppError):
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail)


class PermissionDenied(AppError):
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(status.HTTP_403_FORBIDDEN, detail)


class NotFound(AppError):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status.HTTP_404_NOT_FOUND, detail)


class QuotaExceeded(AppError):
    def __init__(self, detail: str = "Quota exceeded"):
        super().__init__(status.HTTP_403_FORBIDDEN, detail)


class ValidationError(AppError):
    def __init__(self, detail: str = "Invalid input"):
        super().__init__(status.HTTP_400_BAD_REQUEST, detail)
