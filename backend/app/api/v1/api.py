from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    corrections,
    documents,
    ocr,
    pages,
    restoration,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(pages.router, prefix="", tags=["pages"])
api_router.include_router(ocr.router, prefix="", tags=["ocr"])
api_router.include_router(restoration.router, prefix="", tags=["restoration"])
api_router.include_router(corrections.router, prefix="/corrections", tags=["corrections"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
