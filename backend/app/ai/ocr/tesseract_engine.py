"""Tesseract OCR engine — reconstructs a document layout.

Tesseract's ``image_to_data`` already returns ``block_num / par_num /
line_num / word_num`` per token. We group those into a
``block → paragraph → line → word`` tree (spec §6) with per-node bbox,
mean confidence, reading order, and char offsets into a rebuilt
``plain_text`` — no extra OCR dependency required.
"""
from __future__ import annotations

from collections import OrderedDict
from io import BytesIO

import pytesseract
from PIL import Image

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.ocr import (
    LowConfidenceWord,
    OCRDocument,
    OcrBlockNode,
    OcrLineNode,
    OcrParagraphNode,
    OcrWordNode,
)

logger = get_logger(__name__)


def _configure_tesseract() -> None:
    """Honor TESSERACT_CMD from settings (Windows often needs an explicit path)."""
    cmd = (settings.TESSERACT_CMD or "").strip()
    # The user's .env may contain literal Python-raw-string quotes: r'C:\...'
    if cmd.startswith("r'") and cmd.endswith("'"):
        cmd = cmd[2:-1]
    elif cmd.startswith('r"') and cmd.endswith('"'):
        cmd = cmd[2:-1]
    elif (cmd.startswith("'") and cmd.endswith("'")) or (cmd.startswith('"') and cmd.endswith('"')):
        cmd = cmd[1:-1]
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd


def _union(boxes: list[list[int]]) -> list[int]:
    if not boxes:
        return [0, 0, 0, 0]
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    return [x0, y0, x1, y1]


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


class TesseractLayoutEngine:
    """`OCRService` implementation backed by Tesseract TSV output."""

    def extract_document_layout(self, image_bytes: bytes) -> OCRDocument:
        _configure_tesseract()
        language = settings.TESSERACT_LANG or "eng"
        psm = settings.TESSERACT_PSM
        threshold = settings.SUSPICIOUS_CONFIDENCE_THRESHOLD / 100.0

        with Image.open(BytesIO(image_bytes)) as img:
            width, height = img.width, img.height
            data = pytesseract.image_to_data(
                img,
                lang=language,
                output_type=pytesseract.Output.DICT,
                config=f"--psm {psm}",
            )

        # ── Group raw tokens into block → paragraph → line → [word dicts]
        tree: "OrderedDict[int, OrderedDict[int, OrderedDict[int, list[dict]]]]" = OrderedDict()
        n = len(data.get("text", []))
        for i in range(n):
            text = (data["text"][i] or "").strip()
            if not text:
                continue
            try:
                conf = float(data["conf"][i])
            except (TypeError, ValueError):
                conf = -1.0
            if conf < 0:
                continue

            block = int(data["block_num"][i] or 0)
            par = int(data["par_num"][i] or 0)
            line = int(data["line_num"][i] or 0)
            x, y = int(data["left"][i]), int(data["top"][i])
            w, h = int(data["width"][i]), int(data["height"][i])

            tree.setdefault(block, OrderedDict()).setdefault(par, OrderedDict()).setdefault(
                line, []
            ).append({"text": text, "conf": conf / 100.0, "bbox": [x, y, x + w, y + h]})

        # ── Assemble plain_text + offsets while building typed nodes
        plain_parts: list[str] = []
        cursor = 0
        blocks_out: list[OcrBlockNode] = []
        low_conf: list[LowConfidenceWord] = []
        wid = lid = pid = bid = 0
        first_para = True

        for block_num, paras in tree.items():
            bid += 1
            para_nodes: list[OcrParagraphNode] = []
            block_word_confs: list[float] = []

            for par_num, lines in paras.items():
                pid += 1
                line_nodes: list[OcrLineNode] = []

                # Separate paragraphs by a blank line in plain_text.
                if not first_para:
                    plain_parts.append("\n\n")
                    cursor += 2
                first_para = False

                first_line = True
                for line_num, word_dicts in lines.items():
                    if not word_dicts:
                        continue
                    lid += 1
                    if not first_line:
                        plain_parts.append(" ")
                        cursor += 1
                    first_line = False

                    word_nodes: list[OcrWordNode] = []
                    first_word = True
                    for wd in word_dicts:
                        wid += 1
                        if not first_word:
                            plain_parts.append(" ")
                            cursor += 1
                        first_word = False

                        start = cursor
                        plain_parts.append(wd["text"])
                        cursor += len(wd["text"])
                        end = cursor

                        word_node = OcrWordNode(
                            id=f"word_{wid}",
                            text=wd["text"],
                            bbox=wd["bbox"],
                            confidence=wd["conf"],
                            start_offset=start,
                            end_offset=end,
                        )
                        word_nodes.append(word_node)
                        block_word_confs.append(wd["conf"])
                        if wd["conf"] < threshold:
                            low_conf.append(
                                LowConfidenceWord(
                                    word_id=word_node.id,
                                    text=word_node.text,
                                    confidence=word_node.confidence,
                                    bbox=word_node.bbox,
                                    start_offset=start,
                                    end_offset=end,
                                )
                            )

                    line_nodes.append(
                        OcrLineNode(
                            id=f"line_{lid}",
                            bbox=_union([w.bbox for w in word_nodes]),
                            text=" ".join(w.text for w in word_nodes),
                            confidence=_mean([w.confidence for w in word_nodes]),
                            words=word_nodes,
                        )
                    )

                if not line_nodes:
                    continue
                para_nodes.append(
                    OcrParagraphNode(
                        id=f"para_{pid}",
                        bbox=_union([ln.bbox for ln in line_nodes]),
                        reading_order=pid,
                        lines=line_nodes,
                    )
                )

            if not para_nodes:
                continue
            blocks_out.append(
                OcrBlockNode(
                    id=f"block_{bid}",
                    type="paragraph",
                    bbox=_union([p.bbox for p in para_nodes]),
                    reading_order=bid,
                    confidence=_mean(block_word_confs),
                    paragraphs=para_nodes,
                )
            )

        plain_text = "".join(plain_parts)
        logger.info(
            "Tesseract layout: %s blocks, %s words, %s low-confidence (lang=%s, psm=%s)",
            len(blocks_out),
            wid,
            len(low_conf),
            language,
            psm,
        )
        return OCRDocument(
            width=width,
            height=height,
            blocks=blocks_out,
            plain_text=plain_text,
            low_confidence_words=low_conf,
        )
