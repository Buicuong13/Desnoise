"""Group consecutive low-confidence OCR words into chunks for LLM correction.

Goal: instead of asking the LLM to fix one bad word at a time (no context),
batch nearby suspicious words together with a few surrounding good words
so the LLM has enough context to suggest a sensible correction.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from app.models.ocr_word import OcrWord


@dataclass(slots=True)
class SuspiciousChunk:
    word_indices: list[int]  # indices of the suspicious words inside this chunk
    original_text: str       # original raw text of the suspicious span
    context_before: str
    context_after: str

    @property
    def context(self) -> str:
        return f"{self.context_before} [{self.original_text}] {self.context_after}".strip()


def detect_chunks(
    words: Sequence[OcrWord],
    *,
    context_window: int = 5,
    max_gap: int = 1,
) -> list[SuspiciousChunk]:
    """Return chunks of suspicious words with surrounding context.

    `max_gap`: a single non-suspicious word between two suspicious ones is
    treated as part of the same chunk (handles "word OK word" patterns).
    `context_window`: number of words on each side included as context.
    """
    ordered = sorted(words, key=lambda w: w.word_index)
    sus_positions = [i for i, w in enumerate(ordered) if w.is_suspicious]
    if not sus_positions:
        return []

    chunks: list[list[int]] = []
    current: list[int] = [sus_positions[0]]
    for pos in sus_positions[1:]:
        if pos - current[-1] <= max_gap + 1:
            current.append(pos)
        else:
            chunks.append(current)
            current = [pos]
    chunks.append(current)

    result: list[SuspiciousChunk] = []
    for chunk in chunks:
        start, end = chunk[0], chunk[-1]
        ctx_before = ordered[max(0, start - context_window) : start]
        ctx_after = ordered[end + 1 : end + 1 + context_window]
        original_words = ordered[start : end + 1]
        result.append(
            SuspiciousChunk(
                word_indices=[ordered[i].word_index for i in chunk],
                original_text=" ".join(w.text for w in original_words),
                context_before=" ".join(w.text for w in ctx_before),
                context_after=" ".join(w.text for w in ctx_after),
            )
        )
    return result
