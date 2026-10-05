"""
Apple Vision OCR Processing Engine
Core pipeline for local, lossless searchable PDF generation and text extraction.
"""

import os
import re
import sys
import time
import shutil
import logging
import subprocess
from pathlib import Path
from typing import Callable, Optional, List, Dict, Any
import pymupdf

logger = logging.getLogger("apple_vision_ocr.engine")

SUPPORTED_LANGUAGES = {
    "ko-en": ("ko-KR", "en-US"),
    "ko": ("ko-KR",),
    "en": ("en-US",),
    "ja-en": ("ja-JP", "en-US"),
    "zh-en": ("zh-Hans", "en-US"),
    "all": ("ko-KR", "en-US", "ja-JP")
}

SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".webp", ".bmp"}


def check_mac_ocr_installed() -> bool:
    """Verify that mac-ocr binary is available in system PATH."""
    return shutil.which("mac-ocr") is not None


def validate_pdf(pdf_path: Path) -> int:
    """
    Validates PDF integrity and encryption status.
    Returns page count if valid.
    """
    try:
        doc = pymupdf.open(str(pdf_path))
    except pymupdf.FileDataError as e:
        raise ValueError(f"손상되었거나 올바르지 않은 PDF 파일입니다: {e}")
    except Exception as e:
        raise ValueError(f"PDF 파일을 열 수 없습니다: {e}")

    try:
        if doc.is_encrypted:
            raise ValueError("암호화된 PDF 파일입니다. 암호를 해제한 후 다시 시도하십시오.")

        page_count = len(doc)
        if page_count == 0:
            raise ValueError("PDF 문서에 페이지가 존재하지 않습니다.")

        return page_count
    finally:
        doc.close()


def split_pdf_spreads(
    input_pdf_path: str,
    output_pdf_path: str,
    reading_order: str = "ltr",
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> int:
    """
    Splits 2-page landscape spreads into individual portrait pages losslessly.
    
    Args:
        input_pdf_path: Source PDF file path.
        output_pdf_path: Destination PDF file path.
        reading_order: 'ltr' (Left-to-Right) or 'rtl' (Right-to-Left).
        progress_callback: Callback for progress updates.
        
    Returns:
        Total number of pages in the resulting PDF.
    """
    logger.info("Starting spread split: %s -> %s (order: %s)", input_pdf_path, output_pdf_path, reading_order)
    src = pymupdf.open(input_pdf_path)
    out = pymupdf.open()
    total_src = len(src)

    for i, page in enumerate(src):
        if progress_callback:
            progress_callback(i + 1, total_src, f"펼침면 분할 중 ({i + 1}/{total_src})")

        w, h = page.rect.width, page.rect.height
        # If width > height * 1.15, consider it a 2-page spread
        if w > h * 1.15:
            half_w = w / 2.0
            rect_left = pymupdf.Rect(0, 0, half_w, h)
            rect_right = pymupdf.Rect(half_w, 0, w, h)

            if reading_order == "rtl":
                first_rect, second_rect = rect_right, rect_left
            else:
                first_rect, second_rect = rect_left, rect_right

            p1 = out.new_page(width=half_w, height=h)
            p1.show_pdf_page(p1.rect, src, page.number, clip=first_rect)

            p2 = out.new_page(width=half_w, height=h)
            p2.show_pdf_page(p2.rect, src, page.number, clip=second_rect)
        else:
            p = out.new_page(width=w, height=h)
            p.show_pdf_page(p.rect, src, page.number)

    out.save(output_pdf_path, garbage=3, deflate=True)
    out_pages = len(out)
    src.close()
    out.close()
    logger.info("Spread split completed: generated %d pages", out_pages)
    return out_pages


def extract_text_and_markdown(
    pdf_path: str,
    output_txt_path: Optional[str] = None,
    output_md_path: Optional[str] = None
) -> Dict[str, str]:
    """
    Extracts text from a searchable PDF and formats it into plain text and markdown.
    """
    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    
    txt_lines = []
    md_lines = [f"# {Path(pdf_path).stem}\n\n"]

    for i, page in enumerate(doc):
        page_num = i + 1
        page_text = page.get_text("text").strip()
        
        if not page_text:
            continue

        txt_lines.append(f"\n--- [Page {page_num} / {total_pages}] ---\n")
        txt_lines.append(page_text)
        txt_lines.append("\n")

        md_lines.append(f"## Page {page_num}\n\n")
        md_lines.append(page_text)
        md_lines.append("\n\n---\n\n")

    doc.close()

    full_txt = "".join(txt_lines).strip()
    full_md = "".join(md_lines).strip()

    if output_txt_path:
        with open(output_txt_path, "w", encoding="utf-8") as f:
            f.write(full_txt)

    if output_md_path:
        with open(output_md_path, "w", encoding="utf-8") as f:
            f.write(full_md)

    return {"text": full_txt, "markdown": full_md}


def process_ocr(
    input_path: str,
    output_dir: Optional[str] = None,
    languages: Optional[List[str]] = None,
    split_spreads: bool = False,
    reading_order: str = "ltr",
    fast_mode: bool = False,
    generate_txt: bool = True,
    generate_md: bool = True,
    ocr_all_pages: bool = True,
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> Dict[str, Any]:
    """
    Executes the full OCR pipeline.
    
    Args:
        input_path: File path of input PDF or image.
        output_dir: Output directory path. Defaults to input file directory.
        languages: List of BCP-47 language identifiers.
        split_spreads: Whether to split landscape spreads.
        reading_order: 'ltr' or 'rtl'.
        fast_mode: Whether to enable fast OCR mode.
        generate_txt: Whether to generate .txt file.
        generate_md: Whether to generate .md file.
        ocr_all_pages: Whether to re-OCR pages that already contain text.
        progress_callback: Callback function receiving (current_page, total_pages, message).
        
    Returns:
        Dictionary containing pipeline results and execution statistics.
    """
    start_time = time.time()
    input_p = Path(input_path).resolve()
    if not input_p.exists():
        raise FileNotFoundError(f"입력 파일이 존재하지 않습니다: {input_path}")

    if not check_mac_ocr_installed():
        raise RuntimeError("mac-ocr CLI가 설치되지 않았습니다. 'npm install -g mac-ocr' 명령어로 설치하십시오.")

    out_dir = Path(output_dir).resolve() if output_dir else input_p.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    base_name = input_p.stem
    final_pdf_path = out_dir / f"OCR_{base_name}.pdf"
    final_txt_path = out_dir / f"OCR_{base_name}.txt" if generate_txt else None
    final_md_path = out_dir / f"OCR_{base_name}.md" if generate_md else None

    if languages is None:
        languages = ["ko-KR", "en-US"]

    is_pdf = input_p.suffix.lower() == ".pdf"
    temp_split_pdf: Optional[Path] = None

    # Step 1: Validation
    if is_pdf:
        total_pages = validate_pdf(input_p)
    else:
        total_pages = 1

    # Step 2: 2-page spread split if enabled
    target_to_ocr = input_p
    if is_pdf and split_spreads:
        temp_split_pdf = out_dir / f"_temp_split_{base_name}.pdf"
        if progress_callback:
            progress_callback(0, total_pages, "2페이지 펼침면 분할 처리 중...")
        total_pages = split_pdf_spreads(
            str(input_p),
            str(temp_split_pdf),
            reading_order=reading_order,
            progress_callback=progress_callback
        )
        target_to_ocr = temp_split_pdf

    if progress_callback:
        progress_callback(0, total_pages, f"Apple Vision OCR 초기화 중 (총 {total_pages}페이지)")

    # Step 3: Run mac-ocr CLI
    cmd = ["mac-ocr", "searchable-pdf", str(target_to_ocr), "-o", str(final_pdf_path)]

    for lang in languages:
        cmd.extend(["-l", lang])

    if ocr_all_pages:
        cmd.append("--ocr-all-pages")

    if fast_mode:
        cmd.append("--fast")

    logger.info("Executing mac-ocr: %s", " ".join(cmd))

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )

    progress_pattern = re.compile(r"\[(\d+)/(\d+)\]")
    buffer = ""
    current_page = 0

    while True:
        char = process.stdout.read(1)
        if not char:
            break
        if char in ("\r", "\n"):
            match = progress_pattern.search(buffer)
            if match:
                current_page = int(match.group(1))
                tot = int(match.group(2))
                if progress_callback:
                    pct = int((current_page / tot) * 100) if tot > 0 else 0
                    progress_callback(
                        current_page,
                        tot,
                        f"OCR 진행 중: {current_page}/{tot} ({pct}%)"
                    )
            buffer = ""
        else:
            buffer += char

    stderr_output = process.stderr.read()
    process.wait()

    if process.returncode != 0:
        err_msg = stderr_output.strip() or f"프로세스 종료 코드: {process.returncode}"
        logger.error("mac-ocr execution failed: %s", err_msg)
        raise RuntimeError(f"OCR 엔진 처리 실패: {err_msg}")

    # Cleanup temporary spread PDF
    if temp_split_pdf and temp_split_pdf.exists():
        try:
            temp_split_pdf.unlink()
        except Exception as e:
            logger.warning("Failed to remove temporary file %s: %e", temp_split_pdf, e)

    # Step 4: Text extraction
    text_data = {}
    if final_pdf_path.exists() and (generate_txt or generate_md):
        if progress_callback:
            progress_callback(total_pages, total_pages, "텍스트 추출 및 구조화 중...")
        text_data = extract_text_and_markdown(
            str(final_pdf_path),
            output_txt_path=str(final_txt_path) if generate_txt else None,
            output_md_path=str(final_md_path) if generate_md else None
        )

    elapsed_time = round(time.time() - start_time, 2)
    avg_speed = round(elapsed_time / max(1, total_pages), 3)

    logger.info("OCR completed successfully in %.2fs (%.3fs/page)", elapsed_time, avg_speed)

    if progress_callback:
        progress_callback(
            total_pages,
            total_pages,
            f"완료 ({total_pages}페이지 처리됨, {elapsed_time}초 소요)"
        )

    return {
        "success": True,
        "input_file": str(input_p),
        "output_pdf": str(final_pdf_path) if final_pdf_path.exists() else None,
        "output_txt": str(final_txt_path) if (final_txt_path and final_txt_path.exists()) else None,
        "output_md": str(final_md_path) if (final_md_path and final_md_path.exists()) else None,
        "total_pages": total_pages,
        "elapsed_seconds": elapsed_time,
        "seconds_per_page": avg_speed,
        "preview_text": text_data.get("text", "")[:1000] if text_data else ""
    }
