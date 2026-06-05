"""Single source of truth for picking the LLM provider by user role.

Paid roles (user/admin) may CHOOSE between OpenAI (gpt-4o-mini) and Ollama at
the LLM-correction step; OpenAI is the default when nothing is requested. The
free (viewer) tier is forced onto `VIEWER_LLM_PROVIDER` (default 'ollama') — a
viewer can never pick the paid model. The backend always has the final say, so
the client's choice is only honoured when the role is allowed to make it.

Kept dependency-light (no langchain import) so the API layer can import it.
"""
from app.core.config import settings
from app.core.logging import get_logger
from app.models.enums import LLMProvider, UserRole

logger = get_logger(__name__)

# Providers a paid (user/admin) account may pick between at the correction step.
PAID_SELECTABLE_PROVIDERS: tuple[LLMProvider, ...] = (
    LLMProvider.openai,
    LLMProvider.ollama,
)


def _viewer_provider() -> LLMProvider:
    try:
        return LLMProvider(settings.VIEWER_LLM_PROVIDER)
    except ValueError:
        logger.warning(
            "Invalid VIEWER_LLM_PROVIDER=%r — falling back to ollama.",
            settings.VIEWER_LLM_PROVIDER,
        )
        return LLMProvider.ollama


def resolve_llm_provider(
    role: UserRole, requested: LLMProvider | None = None
) -> LLMProvider:
    """Resolve the effective provider for `role`, honouring `requested` only
    when the role is allowed to choose it.

    - user/admin: may pick OpenAI (gpt-4o-mini) or Ollama; defaults to OpenAI.
    - viewer: always forced to the configured free-tier provider.
    """
    if role in (UserRole.user, UserRole.admin):
        if requested in PAID_SELECTABLE_PROVIDERS:
            return requested
        return LLMProvider.openai

    # Free / viewer tier — client choice is ignored.
    return _viewer_provider()
