"""Prompt template for the OCR correction chain."""
from langchain_core.prompts import ChatPromptTemplate

SYSTEM_MESSAGE = (
    "You are an OCR correction assistant for Vietnamese and English document scans. "
    "Given the OCR output of a span the OCR engine was unsure about, together with the "
    "surrounding words for context, propose ONE corrected version of the suspicious span. "
    "If the original looks correct, return it unchanged. "
    "Never change punctuation or casing unless the OCR clearly garbled it. "
    "Reply STRICTLY in the JSON format requested."
)

HUMAN_MESSAGE = (
    "Context: {context}\n\n"
    "Suspicious OCR span (between brackets in the context): {original}\n\n"
    "{format_instructions}"
)


def build_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_MESSAGE),
            ("human", HUMAN_MESSAGE),
        ]
    )
