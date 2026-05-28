from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    APP_NAME: str = "denoise-backend"
    APP_ENV: Literal["development", "production", "test"] = "development"
    DEBUG: bool = True

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    DATABASE_URL: str

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    # When true, Celery tasks run synchronously in-process (no broker/worker needed).
    # Handy for local testing of the denoise pipeline via Swagger/Postman.
    CELERY_TASK_ALWAYS_EAGER: bool = False

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Uploads / storage
    MAX_UPLOAD_SIZE_MB: int = 20
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp,image/tiff,image/bmp"
    # Used by the local-disk storage fallback when Cloudinary is not configured.
    LOCAL_STORAGE_DIR: str = "storage_data"

    # Denoising model
    DENOISING_IMAGE_SIZE: int = 256
    DENOISING_BATCH_SIZE: int = 8
    # Optional override; empty -> app/checkpoints/denoising/best_generator.weights.h5
    DENOISING_WEIGHTS_PATH: str = ""

    TESSERACT_CMD: str = "tesseract"
    TESSERACT_LANG: str = "vie+eng"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_QWEN_MODEL: str = "qwen/qwen-2.5-7b-instruct:free"
    SUSPICIOUS_CONFIDENCE_THRESHOLD: float = 70.0

    VIEWER_MAX_IMAGES: int = 10
    VIEWER_MAX_WORKSPACES: int = 2

    VNPAY_TMN_CODE: str = ""
    VNPAY_HASH_SECRET: str = ""
    VNPAY_URL: str = ""
    MOMO_PARTNER_CODE: str = ""
    MOMO_ACCESS_KEY: str = ""
    MOMO_SECRET_KEY: str = ""
    STRIPE_API_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
