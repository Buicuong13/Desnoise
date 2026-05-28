import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"
    viewer = "viewer"


class UserStatus(str, enum.Enum):
    active = "active"
    banned = "banned"
    pending = "pending"


class DocumentStatus(str, enum.Enum):
    draft = "draft"
    processing = "processing"
    ready = "ready"
    archived = "archived"


class PageStatus(str, enum.Enum):
    uploaded = "uploaded"
    denoising = "denoising"
    denoised = "denoised"
    ocr_running = "ocr_running"
    ocr_done = "ocr_done"
    llm_running = "llm_running"
    llm_done = "llm_done"
    failed = "failed"


class CorrectionStatus(str, enum.Enum):
    pending = "pending"
    kept = "kept"
    undone = "undone"


class LLMProvider(str, enum.Enum):
    openai = "openai"
    openrouter_qwen = "openrouter_qwen"


class ExportFormat(str, enum.Enum):
    docx = "docx"
    pdf = "pdf"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class PaymentGateway(str, enum.Enum):
    vnpay = "vnpay"
    momo = "momo"
    stripe = "stripe"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed = "failed"
    refunded = "refunded"
