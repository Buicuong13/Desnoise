"""Billing / subscription endpoints (Stripe Checkout).

Flow:
  GET  /billing/plans      → public pricing tiers
  GET  /billing/me         → the caller's active subscription (or null = free)
  GET  /billing/payments   → the caller's payment history
  POST /billing/checkout   → create a Stripe Checkout Session, return its URL
  POST /billing/webhook    → Stripe calls this; verified by signature (NO auth)
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.core.logging import get_logger
from app.database.session import get_db
from app.schemas.billing import (
    CheckoutIn,
    CheckoutOut,
    PaymentOut,
    PlanOut,
    SubscriptionOut,
)
from app.services import billing_service

logger = get_logger(__name__)
router = APIRouter()


@router.get("/plans", response_model=list[PlanOut])
def get_plans(db: Session = Depends(get_db)) -> list:
    return billing_service.list_plans(db)


@router.get("/me", response_model=SubscriptionOut | None)
def get_my_subscription(user: CurrentUser, db: Session = Depends(get_db)):
    return billing_service.current_subscription(db, user)


@router.get("/payments", response_model=list[PaymentOut])
def get_my_payments(user: CurrentUser, db: Session = Depends(get_db)) -> list[PaymentOut]:
    payments = billing_service.list_payments(db, user)
    return [
        PaymentOut.model_validate(p).model_copy(
            update={"plan_name": billing_service.plan_name_for(db, p)}
        )
        for p in payments
    ]


@router.post("/checkout", response_model=CheckoutOut)
def create_checkout(
    payload: CheckoutIn, user: CurrentUser, db: Session = Depends(get_db)
) -> CheckoutOut:
    url = billing_service.create_checkout(db, user, payload.plan_code)
    return CheckoutOut(checkout_url=url)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    """Stripe → us. Authenticated by the Stripe signature header, NOT a JWT, so
    the raw request body must be passed to verification untouched."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    event_type = billing_service.handle_webhook(db, payload, sig_header)
    return {"received": True, "type": event_type}
