"""seed subscription_plans with the public pricing tiers

Plans shown on the billing page (mirrors the pageflow mockup):
  personal     – Cá nhân (free, not purchasable)
  pro_monthly  – Chuyên nghiệp, billed monthly (Stripe)
  pro_yearly   – Chuyên nghiệp, billed yearly (-20%, Stripe)
  enterprise   – Doanh nghiệp (contact sales, not purchasable)

Only pro_* are purchasable (price_vnd > 0). Idempotent: re-running upserts on
the unique `code` so it is safe on an already-seeded DB.

Revision ID: 0007_seed_subscription_plans
Revises: 0006_page_status_classify_reject
Create Date: 2026-06-05

"""
import json
from typing import Sequence, Union

from alembic import op

revision: str = "0007_seed_subscription_plans"
down_revision: Union[str, None] = "0006_page_status_classify_reject"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (code, name, price_vnd, duration_days, features)
_PLANS = [
    (
        "personal",
        "Cá nhân",
        0,
        0,
        {
            "tier": "free",
            "purchasable": False,
            "highlights": [
                "Tối đa 10 ảnh",
                "OCR cơ bản",
                "Denoise ảnh chuẩn",
            ],
        },
    ),
    (
        "pro_monthly",
        "Chuyên nghiệp",
        490_000,
        30,
        {
            "tier": "pro",
            "purchasable": True,
            "period": "monthly",
            "highlights": [
                "Tài liệu không giới hạn",
                "OCR nâng cao",
                "Tự cấu hình ChatGPT API",
                "Xuất Word/PDF chất lượng",
                "Ưu tiên xử lý cao",
            ],
        },
    ),
    (
        "pro_yearly",
        "Chuyên nghiệp",
        4_704_000,  # 392.000đ/tháng × 12 (giảm 20%)
        365,
        {
            "tier": "pro",
            "purchasable": True,
            "period": "yearly",
            "discount": 20,
            "highlights": [
                "Tài liệu không giới hạn",
                "OCR nâng cao",
                "Tự cấu hình ChatGPT API",
                "Xuất Word/PDF chất lượng",
                "Ưu tiên xử lý cao",
            ],
        },
    ),
    (
        "enterprise",
        "Doanh nghiệp",
        0,
        0,
        {
            "tier": "enterprise",
            "purchasable": False,
            "contact": True,
            "highlights": [
                "Mọi tính năng bản Pro",
                "Quản lý Team & phân quyền",
                "API tích hợp riêng",
                "Hỗ trợ 24/7",
            ],
        },
    ),
]


def upgrade() -> None:
    for code, name, price, days, features in _PLANS:
        op.execute(
            f"""
            INSERT INTO subscription_plans (code, name, price_vnd, duration_days, features, is_active)
            VALUES (
                '{code}', '{name.replace("'", "''")}', {price}, {days},
                '{json.dumps(features)}'::jsonb, true
            )
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                price_vnd = EXCLUDED.price_vnd,
                duration_days = EXCLUDED.duration_days,
                features = EXCLUDED.features,
                is_active = true
            """
        )


def downgrade() -> None:
    codes = ", ".join(f"'{code}'" for code, *_ in _PLANS)
    op.execute(f"DELETE FROM subscription_plans WHERE code IN ({codes})")
