#!/bin/bash
# Apple-Vision-OCR Web Dashboard Launcher

cd "$(dirname "$0")"

echo "Apple-Vision-OCR: Initializing web service..."

if ! command -v mac-ocr &> /dev/null; then
    echo "Notice: mac-ocr not found in PATH. Attempting npm installation..."
    npm install -g mac-ocr
fi

if [ ! -d ".venv" ]; then
    echo "Setting up Python virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r requirements.txt
fi

echo "Dashboard running at http://localhost:8765"
(sleep 1.2 && open "http://localhost:8765") &

exec .venv/bin/python3 app.py
