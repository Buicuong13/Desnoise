"""Convert OCR document layout ⇄ Tiptap (ProseMirror) JSON (spec §7).

One Tiptap `paragraph` node per OCR paragraph, carrying enough metadata
(`blockId`, `paragraphId`, `bbox`, `confidence`, `range`) for the frontend to
overlay the image, highlight low-confidence spans, and apply LLM suggestions.
"""
from __future__ import annotations

from typing import Any

from app.schemas.ocr import OCRDocument


def _paragraph_text(plain_text: str, para) -> tuple[str, list[int]]:
    """Return (text, [start, end]) for an OCR paragraph using word offsets."""
    words = [w for line in para.lines for w in line.words]
    if not words:
        return "", [0, 0]
    start = words[0].start_offset
    end = words[-1].end_offset
    return plain_text[start:end], [start, end]


def _paragraph_confidence(para) -> float:
    confs = [w.confidence for line in para.lines for w in line.words]
    return round(sum(confs) / len(confs), 4) if confs else 0.0


def ocr_document_to_tiptap(doc: OCRDocument) -> dict[str, Any]:
    """Build a Tiptap `doc` node from the OCR layout."""
    content: list[dict[str, Any]] = []
    for block in doc.blocks:
        for para in block.paragraphs:
            text, rng = _paragraph_text(doc.plain_text, para)
            node: dict[str, Any] = {
                "type": "paragraph",
                "attrs": {
                    "blockId": block.id,
                    "paragraphId": para.id,
                    "bbox": para.bbox,
                    "confidence": _paragraph_confidence(para),
                    "range": rng,
                },
            }
            if text:
                node["content"] = [{"type": "text", "text": text}]
            content.append(node)

    if not content:
        content = [{"type": "paragraph"}]
    return {"type": "doc", "content": content}


def text_to_tiptap(text: str) -> dict[str, Any]:
    """Fallback converter: split plain text into Tiptap paragraphs on blank lines."""
    blocks = [b for b in text.split("\n\n")]
    content = [
        {"type": "paragraph", **({"content": [{"type": "text", "text": b}]} if b.strip() else {})}
        for b in blocks
    ] or [{"type": "paragraph"}]
    return {"type": "doc", "content": content}


def _apply_range(plain: str, start: int, end: int, corrs: list[tuple[int, int, str]]) -> str:
    """Apply offset replacements that fall fully within [start, end)."""
    out: list[str] = []
    cursor = start
    for s, e, suggested in corrs:
        if s < cursor or s < start or e > end:
            continue  # out of range or overlapping a previous replacement
        out.append(plain[cursor:s])
        out.append(suggested)
        cursor = e
    out.append(plain[cursor:end])
    return "".join(out)


def apply_corrections(
    ocr_document_json: dict[str, Any] | None,
    plain_text: str,
    corrections: list[tuple[int | None, int | None, str]],
) -> tuple[str, dict[str, Any]]:
    """Recompute (final_text, tiptap_json) from OCR plain text + kept suggestions.

    Offset-based so the document structure (paragraph ranges from
    `ocr_document_json`) is preserved while only the covered spans change.
    """
    corrs = sorted(
        ((s, e, sug) for s, e, sug in corrections if s is not None and e is not None),
        key=lambda c: c[0],
    )
    final_text = _apply_range(plain_text, 0, len(plain_text), corrs)

    if not ocr_document_json:
        return final_text, text_to_tiptap(final_text)

    doc = OCRDocument(**ocr_document_json)
    content: list[dict[str, Any]] = []
    for block in doc.blocks:
        for para in block.paragraphs:
            words = [w for line in para.lines for w in line.words]
            if not words:
                content.append({"type": "paragraph"})
                continue
            pstart, pend = words[0].start_offset, words[-1].end_offset
            text = _apply_range(plain_text, pstart, pend, corrs)
            node: dict[str, Any] = {
                "type": "paragraph",
                "attrs": {
                    "blockId": block.id,
                    "paragraphId": para.id,
                    "bbox": para.bbox,
                    "confidence": _paragraph_confidence(para),
                    "range": [pstart, pend],
                },
            }
            if text:
                node["content"] = [{"type": "text", "text": text}]
            content.append(node)

    return final_text, {"type": "doc", "content": content or [{"type": "paragraph"}]}


def tiptap_to_plain_text(tiptap: dict[str, Any] | None) -> str:
    """Extract plain text from a Tiptap doc (paragraphs joined by blank lines)."""
    if not tiptap:
        return ""

    def node_text(node: dict[str, Any]) -> str:
        if node.get("type") == "text":
            return node.get("text", "")
        return "".join(node_text(c) for c in node.get("content", []) or [])

    paras = [node_text(n) for n in tiptap.get("content", []) or []]
    return "\n\n".join(paras).strip()
