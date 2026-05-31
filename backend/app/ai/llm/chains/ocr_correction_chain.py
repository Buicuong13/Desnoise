"""LangChain LCEL chain for OCR correction.

The chain picks its underlying LLM by **role**:
    user/admin → OpenAI (paid)
    viewer     → NVIDIA Nemotron Nano (free) on OpenRouter

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

    # viewer / fallback → OpenRouter free model (NVIDIA Nemotron Nano)
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not configured")
    return ChatOpenAI(
        model=settings.OPENROUTER_QWEN_MODEL,
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.1,
    )


def get_model_name(provider: LLMProvider) -> str:
    return (
        settings.OPENAI_MODEL
        if provider == LLMProvider.openai
        else settings.OPENROUTER_QWEN_MODEL
    )


def build_chain(provider: LLMProvider) -> Runnable:
    parser = PydanticOutputParser(pydantic_object=CorrectionSuggestion)
    prompt = build_prompt().partial(format_instructions=parser.get_format_instructions())
    llm = _build_llm(provider)
    return prompt | llm | parser
