"""Single source of truth for picking the LLM provider by user role.

Paid roles (user/admin) → OpenAI. The free (viewer) tier is configurable via
`VIEWER_LLM_PROVIDER` (default 'ollama', so the free tier runs on a local/cloud
Ollama model instead of OpenRouter). The backend always decides — the client
can never choose its provider.

Kept dependency-light (no langchain import) so the API layer can import it.
"""
from app.core.config import settings
from app.core.logging import get_logger
from app.models.enums import LLMProvider, UserRole

logger = get_logger(__name__)


def resolve_llm_provider(role: UserRole) -> LLMProvider:
    if role in (UserRole.user, UserRole.admin):
        return LLMProvider.openai

    # Free / viewer tier — configurable.
    try:
        return LLMProvider(settings.VIEWER_LLM_PROVIDER)
    except ValueError:
        logger.warning(
            "Invalid VIEWER_LLM_PROVIDER=%r — falling back to ollama.",
            settings.VIEWER_LLM_PROVIDER,
        )
        return LLMProvider.ollama
