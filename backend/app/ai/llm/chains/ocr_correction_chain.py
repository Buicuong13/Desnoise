"""LangChain LCEL chain for OCR correction.

The chain picks its underlying LLM by **role** (see `app.ai.llm.provider`):
    user/admin → OpenAI (paid)
    viewer     → free tier, configurable via VIEWER_LLM_PROVIDER
                 (default 'ollama' → local/cloud Ollama; or 'openrouter_qwen')

The chain takes a `{context, original}` dict and returns a single
`CorrectionSuggestion` (Pydantic-parsed).
"""
from __future__ import annotations

from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

from app.ai.llm.prompts.ocr_correction_prompt import build_prompt
from app.ai.llm.schemas import CorrectionSuggestion
from app.core.config import settings
from app.models.enums import LLMProvider


def _build_llm(provider: LLMProvider) -> ChatOpenAI:
    if provider == LLMProvider.openai:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not configured")
        return ChatOpenAI(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.1,
        )

    if provider == LLMProvider.ollama:
        # Local/Cloud Ollama via its OpenAI-compatible endpoint. The api_key is
        # ignored by Ollama but ChatOpenAI requires a non-empty value.
        return ChatOpenAI(
            model=settings.OLLAMA_MODEL,
            api_key=settings.OLLAMA_API_KEY or "ollama",
            base_url=settings.OLLAMA_BASE_URL,
            temperature=0.1,
        )

    # openrouter_qwen → OpenRouter free model
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not configured")
    return ChatOpenAI(
        model=settings.OPENROUTER_QWEN_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.1,
    )


def get_model_name(provider: LLMProvider) -> str:
    if provider == LLMProvider.openai:
        return settings.OPENAI_MODEL
    if provider == LLMProvider.ollama:
        return settings.OLLAMA_MODEL
    return settings.OPENROUTER_QWEN_MODEL


def build_chain(provider: LLMProvider) -> Runnable:
    parser = PydanticOutputParser(pydantic_object=CorrectionSuggestion)
    prompt = build_prompt().partial(format_instructions=parser.get_format_instructions())
    llm = _build_llm(provider)
    return prompt | llm | parser
