"""Admin panel endpoints — dashboard stats, user management, processing logs.

Every route is gated by the `AdminUser` dependency (role == admin); a non-admin
token gets 403 before any handler runs.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import String, case, cast, func, or_
from sqlalchemy.orm import Session

from app.api.deps import AdminUser
from app.core.exceptions import NotFound, ValidationError
from app.database.session import get_db
from app.models.audit_log import AuditLog
from app.models.correction import Correction
from app.models.document import Document
from app.models.enums import PageStatus, PaymentStatus
from app.models.page import Page
from app.models.payment import Payment
from app.models.user import User
from app.schemas.admin import (
    ActivityItemOut,
    AdminUserOut,
    DailyPagePoint,
    DashboardOut,
    DashboardStatsOut,
    HistoryItemOut,
    HistoryListOut,
    UpdateUserIn,
    UserListOut,
)

router = APIRouter()

# Pages that have finished the OCR step (used for the "OCR done" flag + counts).
_OCR_DONE_STATUSES = (
    PageStatus.ocr_done,
    PageStatus.llm_running,
    PageStatus.llm_done,
    PageStatus.reviewing,
    PageStatus.reviewed,
    PageStatus.exported,
)
# Terminal states for success-rate: a page either finished or failed.
_TERMINAL_DONE_STATUSES = (PageStatus.reviewed, PageStatus.exported, PageStatus.ocr_done)


def _documents_count_subquery(db: Session):
    """Map user_id -> number of (non-deleted) documents, for the user table."""
    return (
        db.query(Document.user_id, func.count(Document.id).label("doc_count"))
        .group_by(Document.user_id)
        .subquery()
    )


def _to_admin_user_out(user: User, doc_count: int) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        auth_provider=user.auth_provider,
        images_used=user.images_used,
        documents_count=doc_count,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(admin: AdminUser, db: Session = Depends(get_db)) -> DashboardOut:
    """Aggregate counts, processing health and revenue for the admin home."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)
    new_users_30d = (
        db.query(func.count(User.id)).filter(User.created_at >= cutoff_30d).scalar() or 0
    )

    total_documents = db.query(func.count(Document.id)).scalar() or 0
    total_pages = db.query(func.count(Page.id)).scalar() or 0

    pages_processed = (
        db.query(func.count(Page.id))
        .filter(Page.status.in_(_OCR_DONE_STATUSES))
        .scalar()
        or 0
    )

    # Mean seconds from creation to completion over completed pages.
    avg_seconds = (
        db.query(func.avg(func.extract("epoch", Page.completed_at - Page.created_at)))
        .filter(Page.completed_at.isnot(None))
        .scalar()
    )

    done_count = (
        db.query(func.count(Page.id)).filter(Page.status.in_(_TERMINAL_DONE_STATUSES)).scalar() or 0
    )
    failed_count = (
        db.query(func.count(Page.id)).filter(Page.status == PageStatus.failed).scalar() or 0
    )
    terminal = done_count + failed_count
    success_rate = round((done_count / terminal) * 100, 1) if terminal else 100.0

    revenue_vnd = (
        db.query(func.coalesce(func.sum(Payment.amount_vnd), 0))
        .filter(Payment.status == PaymentStatus.success)
        .scalar()
        or 0
    )

    stats = DashboardStatsOut(
        total_users=total_users,
        new_users_30d=new_users_30d,
        total_documents=total_documents,
        total_pages=total_pages,
        pages_processed=pages_processed,
        avg_processing_seconds=round(float(avg_seconds), 1) if avg_seconds is not None else None,
        success_rate=success_rate,
        revenue_vnd=int(revenue_vnd),
    )

    # Recent users (latest 8) with their document counts.
    doc_counts = dict(
        db.query(Document.user_id, func.count(Document.id)).group_by(Document.user_id).all()
    )
    recent_user_rows = db.query(User).order_by(User.created_at.desc()).limit(8).all()
    recent_users = [_to_admin_user_out(u, doc_counts.get(u.id, 0)) for u in recent_user_rows]

    # Recent activity from the audit log, with the actor's email joined in.
    activity_rows = (
        db.query(AuditLog, User.email)
        .outerjoin(User, AuditLog.actor_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        ActivityItemOut(
            id=log.id,
            actor_email=email,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            created_at=log.created_at,
        )
        for log, email in activity_rows
    ]

    # ── 30-day throughput chart (created vs completed per day) ───────────────
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=29)  # inclusive → 30 buckets

    created_rows = (
        db.query(func.date(Page.created_at), func.count(Page.id))
        .filter(func.date(Page.created_at) >= start_day)
        .group_by(func.date(Page.created_at))
        .all()
    )
    completed_rows = (
        db.query(func.date(Page.completed_at), func.count(Page.id))
        .filter(Page.completed_at.isnot(None), func.date(Page.completed_at) >= start_day)
        .group_by(func.date(Page.completed_at))
        .all()
    )
    created_by_day = {str(d): int(n) for d, n in created_rows if d is not None}
    completed_by_day = {str(d): int(n) for d, n in completed_rows if d is not None}

    daily_pages = [
        DailyPagePoint(
            date=str(start_day + timedelta(days=i)),
            created=created_by_day.get(str(start_day + timedelta(days=i)), 0),
            completed=completed_by_day.get(str(start_day + timedelta(days=i)), 0),
        )
        for i in range(30)
    ]

    return DashboardOut(
        stats=stats,
        recent_users=recent_users,
        recent_activity=recent_activity,
        daily_pages=daily_pages,
    )


@router.get("/users", response_model=UserListOut)
def list_users(
    admin: AdminUser,
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, description="Match email or full name"),
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> UserListOut:
    """Paginated user list with search + role/status filters."""
    doc_sub = _documents_count_subquery(db)
    q = (
        db.query(User, func.coalesce(doc_sub.c.doc_count, 0))
        .outerjoin(doc_sub, doc_sub.c.user_id == User.id)
    )

    if search:
        term = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                func.lower(User.email).like(term),
                func.lower(func.coalesce(User.full_name, "")).like(term),
            )
        )
    if role:
        q = q.filter(cast(User.role, String) == role)
    if status:
        q = q.filter(cast(User.status, String) == status)

    total = q.count()
    rows = (
        q.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [_to_admin_user_out(user, int(doc_count)) for user, doc_count in rows]
    return UserListOut(items=items, total=total, page=page, page_size=page_size)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: UUID,
    payload: UpdateUserIn,
    admin: AdminUser,
    request: Request,
    db: Session = Depends(get_db),
) -> AdminUserOut:
    """Change a user's role and/or status; records the change in `audit_logs`.

    Guards against an admin locking themselves out (can't demote or ban self).
    """
    target = db.get(User, user_id)
    if target is None:
        raise NotFound("User not found")

    if target.id == admin.id and (
        (payload.role is not None and payload.role != admin.role)
        or (payload.status is not None and payload.status.value != "active")
    ):
        raise ValidationError("You cannot change your own role or ban yourself")

    changes: dict[str, dict[str, str]] = {}
    if payload.role is not None and payload.role != target.role:
        changes["role"] = {"from": target.role.value, "to": payload.role.value}
        target.role = payload.role
    if payload.status is not None and payload.status != target.status:
        changes["status"] = {"from": target.status.value, "to": payload.status.value}
        target.status = payload.status

    if changes:
        ip = request.client.host if request.client else None
        db.add(
            AuditLog(
                actor_id=admin.id,
                action="admin.update_user",
                target_type="user",
                target_id=str(target.id),
                metadata_=changes,
                ip=ip,
            )
        )
        db.commit()
        db.refresh(target)

    doc_count = (
        db.query(func.count(Document.id)).filter(Document.user_id == target.id).scalar() or 0
    )
    return _to_admin_user_out(target, doc_count)


@router.get("/history", response_model=HistoryListOut)
def history(
    admin: AdminUser,
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, description="Match owner email or document title"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> HistoryListOut:
    """Processing log: every page across all users, joined with owner + document."""
    corr_sub = (
        db.query(Correction.page_id, func.count(Correction.id).label("n"))
        .group_by(Correction.page_id)
        .subquery()
    )

    ocr_done_flag = case((Page.status.in_(_OCR_DONE_STATUSES), True), else_=False)

    q = (
        db.query(
            Page,
            Document.id.label("document_id"),
            Document.title.label("document_title"),
            User.email.label("owner_email"),
            func.coalesce(corr_sub.c.n, 0).label("corrections_count"),
            ocr_done_flag.label("ocr_done"),
        )
        .join(Document, Page.document_id == Document.id)
        .join(User, Document.user_id == User.id)
        .outerjoin(corr_sub, corr_sub.c.page_id == Page.id)
    )

    if search:
        term = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                func.lower(User.email).like(term),
                func.lower(Document.title).like(term),
            )
        )

    total = q.count()
    rows = (
        q.order_by(Page.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        HistoryItemOut(
            page_id=pg.id,
            document_id=document_id,
            document_title=document_title,
            owner_email=owner_email,
            page_number=pg.page_number,
            status=pg.status,
            denoise_version=pg.denoise_version,
            ocr_done=bool(ocr_done),
            corrections_count=int(corrections_count),
            created_at=pg.created_at,
            completed_at=pg.completed_at,
        )
        for pg, document_id, document_title, owner_email, corrections_count, ocr_done in rows
    ]
    return HistoryListOut(items=items, total=total, page=page, page_size=page_size)
