"""Orchestrates LLM-based OCR correction for a single page.

Flow: load page + its OCR words → detect suspicious chunks →
build LangChain chain by user role → batch-invoke chain →
insert one `corrections` row per LLM suggestion → mark page `llm_done`.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete

from app.ai.llm.chains.ocr_correction_chain import build_chain, get_model_name
from app.ai.llm.provider import resolve_llm_provider
from app.ai.llm.schemas import CorrectionSuggestion
from app.core.config import settings
from app.core.logging import get_logger
from app.database.session import SessionLocal
from app.models.correction import Correction
from app.models.enums import CorrectionStatus, LLMProvider, PageStatus, UserRole
from app.models.ocr_word import OcrWord
from app.models.page import Page
from app.services.suspicious_detector_service import detect_chunks
from app.services.tiptap_service import apply_corrections

logger = get_logger(__name__)


def llm_correct_page(
    page_id: str | UUID, user_role: str, provider: str | None = None
) -> int:
    """Run LLM correction for `page_id`. Returns the number of suggestions inserted.

    `provider` is the effective provider already resolved at the API layer (the
    paid user's model choice). When omitted, fall back to the role's default so
    the function stays usable on its own.
    """
    role = UserRole(user_role)
    requested = LLMProvider(provider) if provider else None
    provider = resolve_llm_provider(role, requested)
    model_name = get_model_name(provider)

    db = SessionLocal()
    try:
        page = db.get(Page, page_id)
        if page is None:
            logger.warning("llm_correct_page: page %s not found", page_id)
            return 0

        page.status = PageStatus.llm_running
        page.processing_error = None
        db.commit()

        words: list[OcrWord] = (
            db.query(OcrWord)
            .filter(OcrWord.page_id == page.id)
            .order_by(OcrWord.word_index)
            .all()
        )
        if not words:
            raise RuntimeError("No OCR words to correct — run OCR first")

        chunks = detect_chunks(words)
        if not chunks:
            page.status = PageStatus.llm_done
            db.commit()
            logger.info("LLM correction skipped (no suspicious words) for %s", page_id)
            return 0

        # Map word_index -> (start_offset, end_offset) so suggestions carry the
        # char span they cover (used to apply Keep/Undo onto the Tiptap doc).
        offsets = {w.word_index: (w.start_offset, w.end_offset) for w in words}

        # Replace previous corrections for this page (whether pending or kept).
        db.execute(delete(Correction).where(Correction.page_id == page.id))

        chain = build_chain(provider)
        inputs = [{"context": c.context, "original": c.original_text} for c in chunks]
        # Cap parallelism so we don't trip the provider's concurrency limit
        # (Ollama Cloud's free tier returns 429 if every chunk fires at once).
        max_concurrency = (
            settings.OLLAMA_MAX_CONCURRENCY
            if provider == LLMProvider.ollama
            else settings.LLM_MAX_CONCURRENCY
        )
        logger.info(
            "Invoking LLM chain on %s chunks (provider=%s, max_concurrency=%s)",
            len(inputs),
            provider.value,
            max_concurrency,
        )
        # return_exceptions=True: a single malformed suggestion (small/local
        # models sometimes emit invalid JSON, e.g. an unescaped backslash) must
        # not fail the whole page — skip that chunk and keep the rest.
        results: list[CorrectionSuggestion | Exception] = chain.batch(
            inputs, config={"max_concurrency": max_concurrency}, return_exceptions=True
        )

        inserted = 0
        skipped = 0
        for chunk, suggestion in zip(chunks, results):
            if isinstance(suggestion, Exception):
                skipped += 1
                logger.warning(
                    "Skipping chunk %r — LLM output could not be parsed: %s",
                    chunk.original_text,
                    suggestion,
                )
                continue
            if suggestion.suggested.strip() == chunk.original_text.strip():
                # LLM said it's already fine — skip storing.
                continue
            start_offset = offsets.get(chunk.word_indices[0], (None, None))[0]
            end_offset = offsets.get(chunk.word_indices[-1], (None, None))[1]
            db.add(
                Correction(
                    page_id=page.id,
                    ocr_word_id=None,
                    word_indices=chunk.word_indices,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    original_text=chunk.original_text,
                    suggested_text=suggestion.suggested,
                    reason=suggestion.reason or None,
                    llm_provider=provider,
                    llm_model=model_name,
                    confidence_score=float(suggestion.confidence) * 100,
                    status=CorrectionStatus.pending,
                )
            )
            inserted += 1

        page.status = PageStatus.llm_done
        db.commit()
        logger.info(
            "LLM correction done for page %s — %s suggestions (%s chunk(s) skipped)",
            page_id,
            inserted,
            skipped,
        )
        return inserted

    except Exception as exc:  # noqa: BLE001
        logger.exception("LLM correction failed for page %s", page_id)
        db.rollback()
        page = db.get(Page, page_id)
        if page is not None:
            page.status = PageStatus.failed
            page.processing_error = str(exc)[:2000]
            db.commit()
        raise
    finally:
        db.close()


def _kept_corrections(db, page_id: str | UUID) -> list[Correction]:
    return (
        db.query(Correction)
        .filter(
            Correction.page_id == page_id,
            Correction.status == CorrectionStatus.kept,
        )
        .order_by(Correction.start_offset)
        .all()
    )


def recompute_review(db, page: Page) -> None:
    """Rebuild `final_text` + `tiptap_json` from OCR text + kept suggestions.

    Backend-authoritative Keep/Undo (spec §9.2): every accept/reject re-derives
    the document so the frontend just refetches `tiptap_json`.
    """
    # The session uses autoflush=False, so the just-changed correction status
    # (set by the caller) isn't visible to the kept-corrections SELECT below
    # until we flush. Without this, the suggestion you just kept is missed and
    # the recomputed text drops that fix (one-keep-behind bug).
    db.flush()
    plain = page.ocr_plain_text or ""
    kept = _kept_corrections(db, page.id)
    corrs = [(c.start_offset, c.end_offset, c.suggested_text) for c in kept]
    final_text, tiptap_json = apply_corrections(page.ocr_document_json, plain, corrs)
    page.final_text = final_text
    page.tiptap_json = tiptap_json


def build_final_text(db, page_id: str | UUID) -> str:
    """Reconstruct page text using OCR plain text + kept LLM corrections (offsets)."""
    page = db.get(Page, page_id)
    if page is None:
        return ""

    plain = page.ocr_plain_text
    if plain is not None:
        kept = _kept_corrections(db, page_id)
        corrs = [(c.start_offset, c.end_offset, c.suggested_text) for c in kept]
        final_text, _ = apply_corrections(page.ocr_document_json, plain, corrs)
        return final_text

    # Legacy fallback: word-index based (pages OCR'd before the layout upgrade).
    words: list[OcrWord] = (
        db.query(OcrWord).filter(OcrWord.page_id == page_id).order_by(OcrWord.word_index).all()
    )
    if not words:
        return ""
    kept = _kept_corrections(db, page_id)
    replacements: dict[int, str | None] = {}
    for c in kept:
        if not c.word_indices:
            continue
        replacements[c.word_indices[0]] = c.suggested_text
        for idx in c.word_indices[1:]:
            replacements[idx] = None
    out: list[str] = []
    for w in words:
        if w.word_index in replacements:
            r = replacements[w.word_index]
            if r is not None:
                out.append(r)
        else:
            out.append(w.text)
    return " ".join(out)
