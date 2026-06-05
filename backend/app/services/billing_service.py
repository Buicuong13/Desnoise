"""Stripe-backed billing: plans, one-time Checkout, and subscription activation.

Model of the world (one-time payment, not Stripe recurring):
  • `subscription_plans` holds the public tiers (seeded in migration 0007).
  • Buying a paid plan creates a Stripe Checkout Session (mode=payment) and a
    `Payment` row (status=pending, gateway_txn_id = the session id).
  • Stripe's `checkout.session.completed` webhook marks the Payment `success`,
    creates/extends a `UserSubscription` for `plan.duration_days`, and promotes
    the user's role to `user` (Pro). Light side-effects (log/email) are pushed to
    the payment_queue so OCR/denoise load can never delay the upgrade itself
    (see celery_redis_pool_deploy_plan.md §17).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import stripe
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import NotFound, ValidationError
from app.core.logging import get_logger
from app.models.enums import PaymentGateway, PaymentStatus, SubscriptionStatus, UserRole
from app.models.payment import Payment
from app.models.subscription import SubscriptionPlan, UserSubscription
from app.models.user import User

logger = get_logger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def list_plans(db: Session) -> list[SubscriptionPlan]:
    return (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.price_vnd.asc(), SubscriptionPlan.id.asc())
        .all()
    )


def current_subscription(db: Session, user: User) -> UserSubscription | None:
    """The user's active, non-expired subscription (most recent first)."""
    return (
        db.query(UserSubscription)
        .filter(
            UserSubscription.user_id == user.id,
            UserSubscription.status == SubscriptionStatus.active,
            UserSubscription.ends_at > _now(),
        )
        .order_by(UserSubscription.ends_at.desc())
        .first()
    )


def list_payments(db: Session, user: User) -> list[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
        .all()
    )


def _get_purchasable_plan(db: Session, plan_code: str) -> SubscriptionPlan:
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == plan_code).first()
    if plan is None or not plan.is_active:
        raise NotFound("Gói không tồn tại")
    if plan.price_vnd <= 0:
        raise ValidationError("Gói này không thể mua trực tuyến")
    return plan


def create_checkout(db: Session, user: User, plan_code: str) -> str:
    """Create a Stripe Checkout Session + pending Payment; return the pay URL."""
    if not settings.STRIPE_API_KEY:
        raise ValidationError("Stripe chưa được cấu hình (STRIPE_API_KEY)")
    plan = _get_purchasable_plan(db, plan_code)

    stripe.api_key = settings.STRIPE_API_KEY
    return_url = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/billing"
    session = stripe.checkout.Session.create(
        mode="payment",
        # VND is a zero-decimal currency, so unit_amount is the integer đồng.
        line_items=[
            {
                "price_data": {
                    "currency": "vnd",
                    "unit_amount": plan.price_vnd,
                    "product_data": {"name": f"{plan.name} ({plan.code})"},
                },
                "quantity": 1,
            }
        ],
        customer_email=user.email,
        metadata={"user_id": str(user.id), "plan_id": str(plan.id)},
        success_url=f"{return_url}?status=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{return_url}?status=canceled",
    )

    db.add(
        Payment(
            user_id=user.id,
            gateway=PaymentGateway.stripe,
            gateway_txn_id=session.id,
            amount_vnd=plan.price_vnd,
            status=PaymentStatus.pending,
            raw_payload={"plan_code": plan.code, "checkout_session": session.id},
        )
    )
    db.commit()
    logger.info("Created Stripe checkout %s for user %s (plan=%s)", session.id, user.id, plan.code)
    return session.url


def handle_webhook(db: Session, payload: bytes, sig_header: str | None) -> str:
    """Verify a Stripe webhook and activate the subscription on success.

    Returns the event type handled (for logging). Raises ValidationError on a
    bad/forged signature so the endpoint can answer 400.
    """
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise ValidationError("Stripe webhook chưa được cấu hình (STRIPE_WEBHOOK_SECRET)")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise ValidationError(f"Chữ ký webhook không hợp lệ: {exc}") from exc

    if event["type"] == "checkout.session.completed":
        _activate_from_session(db, event["data"]["object"])
    else:
        logger.debug("Ignoring unhandled Stripe event %s", event["type"])
    return event["type"]


def _activate_from_session(db: Session, session: dict) -> None:
    """Mark the Payment paid, grant the subscription, and upgrade the user.

    All DB state is updated synchronously here (the upgrade must be instant);
    only light side-effects are deferred to the payment_queue.
    """
    session_id = session.get("id")
    payment = db.query(Payment).filter(Payment.gateway_txn_id == session_id).first()
    if payment is None:
        logger.warning("Stripe webhook: no Payment for session %s", session_id)
        return
    if payment.status == PaymentStatus.success:
        return  # idempotent — Stripe may deliver the event more than once

    plan_id = (session.get("metadata") or {}).get("plan_id")
    plan = db.get(SubscriptionPlan, int(plan_id)) if plan_id else None
    if plan is None:
        logger.error("Stripe webhook: plan %s not found for session %s", plan_id, session_id)
        return

    now = _now()
    subscription = UserSubscription(
        user_id=payment.user_id,
        plan_id=plan.id,
        status=SubscriptionStatus.active,
        starts_at=now,
        ends_at=now + timedelta(days=plan.duration_days or 30),
    )
    db.add(subscription)
    db.flush()  # get subscription.id for the FK below

    payment.status = PaymentStatus.success
    payment.paid_at = now
    payment.subscription_id = subscription.id

    # Pro = role `user` (the app gates features by role viewer/user/admin).
    user = db.get(User, payment.user_id)
    if user is not None and user.role == UserRole.viewer:
        user.role = UserRole.user

    db.commit()
    logger.info(
        "Activated subscription %s (plan=%s) for user %s via %s",
        subscription.id, plan.code, payment.user_id, session_id,
    )

    # Defer non-critical follow-ups (receipt email, invoice sync) to its own
    # queue so they never block on / get blocked by OCR/denoise workers.
    from app.workers.payment_task import payment_finalize_task

    payment_finalize_task.delay(str(payment.id))


def plan_name_for(db: Session, payment: Payment) -> str | None:
    """Best-effort plan name for a payment row (history display)."""
    code = (payment.raw_payload or {}).get("plan_code") if payment.raw_payload else None
    if not code:
        return None
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == code).first()
    return plan.name if plan else None
