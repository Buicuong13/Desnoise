"""Schemas for the admin panel (dashboard stats, user management, processing logs).

Mirrors `frontend/lib/api/types.ts` (Admin* interfaces) — update both together.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import PageStatus, UserRole, UserStatus


class AdminUserOut(BaseModel):
    """A user row as shown in the admin user table — richer than the public UserOut."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str | None
    role: UserRole
    status: UserStatus
    auth_provider: str
    images_used: int
    documents_count: int = 0
    created_at: datetime
    last_login_at: datetime | None = None


class UserListOut(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int


class UpdateUserIn(BaseModel):
    """Admin edit: change role and/or status. Only provided fields are applied."""

    role: UserRole | None = None
    status: UserStatus | None = None


class DashboardStatsOut(BaseModel):
    total_users: int
    # Users created in the last 30 days (for the "+N%" style trend on the card).
    new_users_30d: int
    total_documents: int
    total_pages: int
    pages_processed: int
    # Mean wall-clock seconds from page creation to completion (None if no data).
    avg_processing_seconds: float | None
    # Share of terminal pages that did NOT fail, as a percentage (0–100).
    success_rate: float
    # Lifetime revenue from successful payments, in VND.
    revenue_vnd: int


class ActivityItemOut(BaseModel):
    """One audit-log entry, flattened for the dashboard activity feed."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_email: str | None
    action: str
    target_type: str | None
    target_id: str | None
    created_at: datetime


class DailyPagePoint(BaseModel):
    """One day in the 30-day processing-throughput chart."""

    # ISO date string (YYYY-MM-DD) — already zero-filled for empty days.
    date: str
    # Pages whose `created_at` falls on this day (work that came in).
    created: int
    # Pages whose `completed_at` falls on this day (work that finished).
    completed: int


class DashboardOut(BaseModel):
    stats: DashboardStatsOut
    recent_users: list[AdminUserOut]
    recent_activity: list[ActivityItemOut]
    # Last 30 days of throughput, oldest → newest, zero-filled.
    daily_pages: list[DailyPagePoint]


class HistoryItemOut(BaseModel):
    """A processed page joined with its owner + document — the processing log row."""

    page_id: UUID
    document_id: UUID
    document_title: str
    owner_email: EmailStr
    page_number: int
    status: PageStatus
    denoise_version: int
    ocr_done: bool
    corrections_count: int
    created_at: datetime
    completed_at: datetime | None


class HistoryListOut(BaseModel):
    items: list[HistoryItemOut]
    total: int
    page: int
    page_size: int
