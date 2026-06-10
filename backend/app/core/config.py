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

    # Heavy inference dispatch. Local/dev keeps using Celery; production can
    # submit classify/denoise/OCR jobs to a queue-based RunPod endpoint.
    INFERENCE_BACKEND: Literal["celery", "runpod"] = "celery"
    RUNPOD_ENDPOINT_ID: str = ""
    RUNPOD_API_KEY: str = ""
    RUNPOD_API_BASE_URL: str = "https://api.runpod.ai/v2"
    RUNPOD_SUBMIT_TIMEOUT_SECONDS: float = 15.0
    RUNPOD_EXECUTION_TIMEOUT_MS: int = 600_000
    RUNPOD_JOB_TTL_MS: int = 3_600_000

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # CORS — comma-separated list of allowed origins for the frontend dev server
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Supabase — used ONLY to verify the OAuth (Google) access token the frontend
    # obtains via supabase-js. The backend stays the single source of authz: it
    # bridges a valid Supabase session into its own access/refresh tokens.
    # Leave blank to disable the /auth/oauth/google endpoint.
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Uploads / storage — max accepted image size, in MB. The authoritative
    # check (see endpoints/uploads.py). Override per environment via .env.
    MAX_UPLOAD_SIZE_MB: int = 5
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp,image/tiff,image/bmp"
    # Used by the local-disk storage fallback when Cloudinary is not configured.
    LOCAL_STORAGE_DIR: str = "storage_data"

    # Denoising model
    DENOISING_IMAGE_SIZE: int = 256
    DENOISING_BATCH_SIZE: int = 8
    # Optional override; empty -> app/checkpoints/denoising/best_generator.weights.h5
    DENOISING_WEIGHTS_PATH: str = ""

    # Document classifier (MobileNetV3-Small) — validates that an uploaded image
    # is a document page before the pipeline runs. Fail-open if disabled/missing.
    CLASSIFIER_ENABLED: bool = True
    CLASSIFIER_IMAGE_SIZE: int = 256
    # Empty -> app/checkpoints/classifier/best_mobilenetv3_small_document_classifier.pth
    CLASSIFIER_WEIGHTS_PATH: str = ""
    # Accept as a document when P(documents) >= threshold.
    CLASSIFIER_CONFIDENCE_THRESHOLD: float = 0.5

    # Document layout detector (DocLayout-YOLO, DocStructBench checkpoint) — used
    # by the layout-aware OCR pipeline to keep only textual regions (title /
    # section-header / plain text) and OCR them in reading order.
    LAYOUT_ENABLED: bool = True
    LAYOUT_IMAGE_SIZE: int = 1024
    # Empty -> app/checkpoints/layout/doclayout_yolo_docstructbench_imgsz1024.pt
    # (falls back to the repo root if the .pt is still sitting there).
    LAYOUT_WEIGHTS_PATH: str = ""
    LAYOUT_CONF_THRESHOLD: float = 0.25
    LAYOUT_DEVICE: str = "cpu"  # "cuda" if a GPU is available
    # A box wider than this fraction of the page is treated as full-width
    # (spans both columns) instead of being forced into a left/right column.
    LAYOUT_FULLWIDTH_RATIO: float = 0.55
    # Pixels of padding added around each crop before OCR (avoids clipping glyphs).
    LAYOUT_CROP_PADDING: int = 4

    TESSERACT_CMD: str = "tesseract"
    TESSERACT_LANG: str = "vie+eng"
    # Page segmentation mode passed via `--psm`. 6 = assume a single uniform
    # block of text, which gives much cleaner line breaks for book pages than
    # the default 3 (auto). Override per environment if you OCR mixed layouts.
    TESSERACT_PSM: int = 6

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    # Free model used for the viewer role (kept env-var name for compatibility).
    OPENROUTER_QWEN_MODEL: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"

    # Local/Cloud Ollama (OpenAI-compatible endpoint at /v1). Used for the free
    # (viewer) tier when VIEWER_LLM_PROVIDER='ollama'. Ollama ignores the api_key
    # (cloud models authenticate via `ollama signin`), so a dummy value is fine.
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"
    OLLAMA_MODEL: str = "gemma4:31b-cloud"
    OLLAMA_API_KEY: str = "ollama"
    # Which provider the free (viewer) tier uses: 'ollama' | 'openrouter_qwen' | 'openai'.
    VIEWER_LLM_PROVIDER: str = "ollama"

    # Per-request timeout (seconds) and retry budget for every LLM call. Without
    # these the OpenAI SDK default is 600s with 2 retries — a stalled Ollama
    # request can freeze a solo-pool worker for minutes. Fail fast instead.
    LLM_REQUEST_TIMEOUT: int = 60
    LLM_MAX_RETRIES: int = 1

    # Max chunks sent in parallel during chain.batch(). LangChain otherwise fires
    # every suspicious chunk concurrently, which trips Ollama Cloud's free-tier
    # concurrency cap (429 'too many concurrent requests'). Ollama gets a tighter
    # cap than the paid OpenAI/OpenRouter providers.
    LLM_MAX_CONCURRENCY: int = 4
    OLLAMA_MAX_CONCURRENCY: int = 1

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
    # Where Stripe Checkout sends the user back after pay/cancel. The billing
    # page reads ?status=success|canceled off this URL.
    FRONTEND_URL: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
