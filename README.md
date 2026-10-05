# Apple-Vision-OCR

[ English | [한국어](README.ko.md) ]

A high-performance, on-device OCR tool that creates lossless Searchable PDFs using Apple's native Vision framework and the Apple Neural Engine (ANE). Includes both a minimal Web Dashboard and a scriptable CLI.

---

## Overview

Scanned books and documents are typically image-only files lacking selectable or searchable text. Commercial scanning services often charge per-page fees for cloud or legacy OCR engines that recompress or degrade image quality.

`Apple-Vision-OCR` runs entirely on macOS using on-device Apple Silicon Neural Engine acceleration (`VNRecognizeTextRequest`). It generates industry-standard Searchable PDFs by embedding an invisible, exact-coordinate text layer over the source document without modifying or recompressing the underlying high-resolution images.

---

## Features

- **Lossless Searchable PDF Generation**: Preserves original image DPI, dimensions, and compression artifacts while embedding precise text bounding boxes for selection, copy-pasting, and full-text search (`Cmd+F`).
- **Hardware-Accelerated Recognition**: Leverages the Apple Neural Engine on Apple Silicon (`M1/M2/M3/M4`) to process typical 300-page volumes in 1 to 2 minutes.
- **Two-Page Spread Splitting**: Automatically detects landscape spreads (e.g., two bound book pages scanned into a single page) and segments them into sequential portrait pages in Left-to-Right (LTR) or Right-to-Left (RTL) reading order.
- **Multi-Format Export**: Generates `.pdf` along with structured plain text (`.txt`) and Markdown (`.md`) partitioned by page numbers for Obsidian, Notion, or LLM context ingestion.
- **Web Dashboard & Scriptable CLI**: Offers a minimalist macOS-styled Web UI (FastAPI + Server-Sent Events) with Korean/English dynamic switching and a UNIX-compliant command-line interface.
- **Zero Cloud Dependence**: 100% on-device processing. No data leaves the machine.

---

## Architecture

```
[ Input Document (PDF / Image) ]
              │
              ▼
   [ Integrity & Password Check ]
              │
              ▼
  [ Spread Segmentation (PyMuPDF) ] (Optional)
              │
              ▼
[ Apple Vision Framework (mac-ocr) ] ── (Neural Engine / GPU)
              │
              ▼
  [ Invisible Text Layer Ingestion ]
              │
              ├─► Searchable PDF (OCR_[filename].pdf)
              ├─► Structured Plain Text (OCR_[filename].txt)
              └─► Page-Segmented Markdown (OCR_[filename].md)
```

1. **Document Validation**: Verifies PDF container structure and detects encryption status.
2. **Spread Segmentation**: Splits landscape spreads using PDF stream clipping without rasterization loss.
3. **Vision Recognition**: Passes page frames to Apple's `VNRecognizeTextRequest` pipeline for line- and word-level coordinate detection.
4. **Stream Overlay**: Injects the CoreText invisible glyph layer directly into the PDF content stream.
5. **Text Extraction**: Reads back page boundaries to generate plain text and Markdown files.

---

## Prerequisites

- **Operating System**: macOS 12.0 (Monterey) or later (macOS 14+ Sonoma/Sequoia recommended).
- **Architecture**: Apple Silicon (arm64) recommended; Intel (x86_64) supported.
- **Node.js**: Node 18+ (used to provide the `mac-ocr` binary wrapper).
- **Python**: Python 3.10+ (tested through Python 3.14).

### System Dependency Installation

Install `mac-ocr` globally via npm:

```bash
npm install -g mac-ocr
```

Verify installation:

```bash
mac-ocr --version
```

---

## Installation

Clone the repository and install the Python dependencies into a virtual environment:

```bash
git clone https://github.com/Junseung0526/Apple-Vision-OCR.git
cd Apple-Vision-OCR

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Quick Start

### 1. Web Dashboard

Launch the local web server:

```bash
python3 app.py
```

Or execute the launcher script:

```bash
./start.command
```

Open `http://localhost:8765` in any browser. The dashboard supports real-time switching between English and Korean via the language toggle in the header. Drag and drop the scanned PDF or image, select options, and click **Start OCR Processing**. Real-time progress is streamed via Server-Sent Events (SSE).

### 2. Command-Line Interface (CLI)

The CLI supports single files and batch scripts:

```bash
# Standard conversion (Korean + English, produces PDF, TXT, MD)
python3 cli.py document.pdf

# Split 2-page landscape spreads into individual portrait pages
python3 cli.py scanned_book.pdf --split-spread

# Right-to-Left spread orientation (Japanese books / Manga)
python3 cli.py manga.pdf --split-spread --rtl --lang ja-en

# Fast mode (lower recognition overhead)
python3 cli.py document.pdf --fast

# Specify CLI language (ko or en)
python3 cli.py document.pdf --locale en

# Output to a custom directory and reveal in Finder upon completion
python3 cli.py document.pdf -o ./output --open
```

---

## Configuration & Options

### Language Profiles (`-l`, `--lang`)

| Option Code | BCP-47 Language Tags | Description |
|:---|:---|:---|
| `ko-en` *(Default)* | `ko-KR`, `en-US` | Korean and English bilingual recognition |
| `ko` | `ko-KR` | Korean only |
| `en` | `en-US` | English only |
| `ja-en` | `ja-JP`, `en-US` | Japanese and English |
| `zh-en` | `zh-Hans`, `en-US` | Simplified Chinese and English |
| `all` | `ko-KR`, `en-US`, `ja-JP` | Multi-language composite profile |

### CLI Arguments

```
positional arguments:
  input                 Path to input PDF or image file

options:
  -h, --help            Show help message and exit
  -o, --output-dir DIR  Directory to save output files (default: input file directory)
  -s, --split-spread    Split 2-page landscape spreads into 2 portrait pages
  --rtl                 Set spread reading order to Right-to-Left
  -l, --lang PROFILE    Recognition language profile (default: ko-en)
  --fast                Enable fast mode (prioritize throughput over accuracy)
  --no-txt              Skip .txt file generation
  --no-md               Skip .md file generation
  --open                Reveal output PDF in macOS Finder upon completion
  --locale {ko,en}      Interface language for CLI output
```

---

## License

MIT License. See `LICENSE` for details.
