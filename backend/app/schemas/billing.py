"""Schemas for the billing / subscription flow (Stripe Checkout)."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import PaymentGateway, PaymentStatus, SubscriptionStatus


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    price_vnd: int
    duration_days: int
    features: dict[str, Any] | None = None
    is_active: bool


class SubscriptionOut(BaseModel):
    """The user's current (active) subscription, or null when on the free tier."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: SubscriptionStatus
    starts_at: datetime
    ends_at: datetime
    plan: PlanOut


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    gateway: PaymentGateway
    gateway_txn_id: str
    amount_vnd: int
    status: PaymentStatus
    created_at: datetime
    paid_at: datetime | None = None
    # Plan name resolved for display ("Chuyên nghiệp"); filled by the service.
    plan_name: str | None = None


class CheckoutIn(BaseModel):
    plan_code: str


class CheckoutOut(BaseModel):
    checkout_url: str
