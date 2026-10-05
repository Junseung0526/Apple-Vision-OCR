#!/usr/bin/env python3
"""
Apple-Vision-OCR CLI
Command-line interface for local Apple Silicon Vision OCR processing.
Supports bilingual output (Korean and English).
"""

import sys
import os
import argparse
import time
import locale
import logging
import subprocess
from pathlib import Path
from ocr_engine import process_ocr, SUPPORTED_LANGUAGES, check_mac_ocr_installed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("apple_vision_ocr.cli")

CLI_STRINGS = {
    "ko": {
        "title": "Apple-Vision-OCR (CLI)",
        "target": "대상 파일:   ",
        "size": "파일 크기:   ",
        "languages": "인식 언어:   ",
        "spread_split": "펼침면 분할: ",
        "enabled": "활성화됨",
        "status_done": "상태: 완료",
        "pages": "페이지",
        "seconds": "초",
        "sec_per_page": "초/페이지",
        "generated_files": "생성된 파일:",
        "aborted": "[중단] 사용자에 의해 작업이 취소되었습니다.",
        "error_prefix": "[오류]"
    },
    "en": {
        "title": "Apple-Vision-OCR (CLI)",
        "target": "Target:       ",
        "size": "Size:         ",
        "languages": "Languages:    ",
        "spread_split": "Spread Split: ",
        "enabled": "Enabled",
        "status_done": "Status: Completed",
        "pages": "pages",
        "seconds": "s",
        "sec_per_page": "s/page",
        "generated_files": "Generated files:",
        "aborted": "[ABORTED] Process interrupted by user.",
        "error_prefix": "[ERROR]"
    }
}


def detect_default_locale() -> str:
    try:
        lang, _ = locale.getdefaultlocale()
        if lang and "ko" in lang.lower():
            return "ko"
    except Exception:
        pass
    return "en"


def render_progress_bar(curr: int, tot: int, msg: str):
    pct = int((curr / tot) * 100) if tot > 0 else 0
    bar_len = 24
    filled_len = int(bar_len * curr // max(1, tot))
    bar = "=" * filled_len + " " * (bar_len - filled_len)
    line = f"\r[{bar}] {pct:3d}% ({curr}/{tot}p) {msg[:35]:<35}"
    sys.stdout.write(line)
    sys.stdout.flush()


def main():
    if not check_mac_ocr_installed():
        sys.stderr.write("[ERROR] 'mac-ocr' binary not found. Install via 'npm install -g mac-ocr'.\n")
        sys.exit(1)

    default_loc = detect_default_locale()

    parser = argparse.ArgumentParser(
        prog="apple-vision-ocr",
        description="Local, lossless Searchable PDF generator using Apple Vision Framework.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Standard conversion (Korean + English, Searchable PDF + TXT + MD)
  python cli.py scan.pdf

  # Split 2-page landscape spreads into individual portrait pages
  python cli.py scan.pdf --split-spread

  # Right-to-Left spread order (Japanese / Manga)
  python cli.py manga.pdf --split-spread --rtl --lang ja-en

  # Set CLI interface language
  python cli.py scan.pdf --locale ko

  # Open result in macOS Finder upon completion
  python cli.py scan.pdf --open
"""
    )

    parser.add_argument("input", help="Path to input PDF or image file")
    parser.add_argument("-o", "--output-dir", default=None, help="Directory to save output files (default: input file directory)")
    parser.add_argument("-s", "--split-spread", action="store_true", help="Split 2-page landscape spreads into 2 portrait pages")
    parser.add_argument("--rtl", action="store_true", help="Set spread reading order to Right-to-Left (e.g., Japanese books)")
    parser.add_argument("-l", "--lang", choices=list(SUPPORTED_LANGUAGES.keys()), default="ko-en",
                        help="Language profile (default: ko-en [Korean + English])")
    parser.add_argument("--fast", action="store_true", help="Enable fast recognition mode (prioritize speed over accuracy)")
    parser.add_argument("--no-txt", action="store_true", help="Do not generate .txt file")
    parser.add_argument("--no-md", action="store_true", help="Do not generate .md file")
    parser.add_argument("--open", action="store_true", help="Reveal generated PDF in Finder upon completion")
    parser.add_argument("--locale", choices=["ko", "en"], default=default_loc, help="Interface language (default: system locale)")

    args = parser.parse_args()
    msg = CLI_STRINGS[args.locale]

    input_file = Path(args.input).resolve()
    if not input_file.exists():
        sys.stderr.write(f"{msg['error_prefix']} Input file not found: {args.input}\n")
        sys.exit(1)

    selected_langs = list(SUPPORTED_LANGUAGES.get(args.lang, ("ko-KR", "en-US")))
    reading_order = "rtl" if args.rtl else "ltr"

    print("============================================================")
    print(f" {msg['title']}")
    print("============================================================")
    print(f"{msg['target']}{input_file.name}")
    print(f"{msg['size']}{round(input_file.stat().st_size / (1024 * 1024), 2)} MB")
    print(f"{msg['languages']}{', '.join(selected_langs)}")
    if args.split_spread:
        print(f"{msg['spread_split']}{msg['enabled']} ({reading_order.upper()})")
    print("------------------------------------------------------------")

    last_pct = -1

    def progress_callback(curr: int, tot: int, p_msg: str):
        nonlocal last_pct
        pct = int((curr / tot) * 100) if tot > 0 else 0
        if pct != last_pct or curr == tot:
            last_pct = pct
            render_progress_bar(curr, tot, p_msg)

    try:
        res = process_ocr(
            input_path=str(input_file),
            output_dir=args.output_dir,
            languages=selected_langs,
            split_spreads=args.split_spread,
            reading_order=reading_order,
            fast_mode=args.fast,
            generate_txt=not args.no_txt,
            generate_md=not args.no_md,
            progress_callback=progress_callback
        )
        print("\n------------------------------------------------------------")
        print(f"{msg['status_done']} ({res['total_pages']} {msg['pages']}, {res['elapsed_seconds']}{msg['seconds']}, {res['seconds_per_page']}{msg['sec_per_page']})")
        print(msg["generated_files"])
        if res.get("output_pdf"):
            print(f"  PDF: {res['output_pdf']}")
        if res.get("output_txt"):
            print(f"  TXT: {res['output_txt']}")
        if res.get("output_md"):
            print(f"  MD:  {res['output_md']}")

        if args.open and res.get("output_pdf"):
            subprocess.run(["open", "-R", res["output_pdf"]])

    except KeyboardInterrupt:
        print(f"\n{msg['aborted']}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{msg['error_prefix']} {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
