"""Build Word/PDF exports from the final reviewed content (spec §16).

Source is `pages.final_text` (which already reflects OCR + kept LLM
corrections + manual Tiptap edits), falling back to the Tiptap doc or OCR
plain text. Pages are emitted in `page_number` order, one page break between.
Never built from raw line-by-line OCR.
"""
from __future__ import annotations

import io
from typing import Sequence

from app.models.page import Page
from app.services.tiptap_service import tiptap_to_plain_text


def _page_text(page: Page) -> str:
    if page.final_text:
        return page.final_text
    if page.tiptap_json:
        return tiptap_to_plain_text(page.tiptap_json)
    return page.ocr_plain_text or ""


def _paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def build_docx(pages: Sequence[Page]) -> bytes:
    from docx import Document as DocxDocument

    docx = DocxDocument()
    for i, page in enumerate(pages):
        if i > 0:
            docx.add_page_break()
        for para in _paragraphs(_page_text(page)) or [""]:
            docx.add_paragraph(para)
    buf = io.BytesIO()
    docx.save(buf)
    return buf.getvalue()


def build_pdf(pages: Sequence[Page]) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    body = styles["BodyText"]
    flow: list = []
    for i, page in enumerate(pages):
        if i > 0:
            flow.append(PageBreak())
        for para in _paragraphs(_page_text(page)) or [" "]:
            # Escape XML-special chars; reportlab Paragraph parses minimal HTML.
            safe = para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            flow.append(Paragraph(safe, body))
            flow.append(Spacer(1, 6))
    doc.build(flow)
    return buf.getvalue()
