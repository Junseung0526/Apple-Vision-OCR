"""
Apple Vision OCR Web Application Server
FastAPI backend providing REST endpoints and Server-Sent Events (SSE) progress streaming.
"""

import os
import sys
import uuid
import time
import asyncio
import logging
import subprocess
import threading
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from ocr_engine import (
    process_ocr,
    validate_pdf,
    SUPPORTED_LANGUAGES,
    check_mac_ocr_installed
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("apple_vision_ocr.server")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INPUT_DIR = BASE_DIR / "input"
OUTPUT_DIR = BASE_DIR / "output"

INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Apple Vision OCR",
    description="Local lossless Searchable PDF generator powered by Apple Vision Framework",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: Dict[str, Dict[str, Any]] = {}


def run_ocr_worker(
    job_id: str,
    input_file: Path,
    output_dir: Path,
    lang: str,
    split_spreads: bool,
    reading_order: str,
    fast_mode: bool,
    generate_txt: bool,
    generate_md: bool
):
    job = JOBS[job_id]
    job["status"] = "processing"
    job["start_time"] = time.time()
    logger.info("Job %s started for file %s", job_id, input_file.name)

    def progress_callback(curr: int, tot: int, msg: str):
        job["current_page"] = curr
        job["total_pages"] = tot
        job["percent"] = int((curr / tot) * 100) if tot > 0 else 0
        job["message"] = msg
        elapsed = time.time() - job["start_time"]
        if curr > 0 and tot > 0:
            speed = elapsed / curr
            remaining = speed * (tot - curr)
            job["eta_seconds"] = round(remaining, 1)
            job["speed"] = round(speed, 2)

    try:
        selected_langs = list(SUPPORTED_LANGUAGES.get(lang, ("ko-KR", "en-US")))
        result = process_ocr(
            input_path=str(input_file),
            output_dir=str(output_dir),
            languages=selected_langs,
            split_spreads=split_spreads,
            reading_order=reading_order,
            fast_mode=fast_mode,
            generate_txt=generate_txt,
            generate_md=generate_md,
            progress_callback=progress_callback
        )
        job["status"] = "completed"
        job["percent"] = 100
        job["result"] = result
        pages = result.get("total_pages", 0)
        elapsed = result.get("elapsed_seconds", 0)
        job["message"] = f"완료 ({pages}페이지 처리됨, {elapsed}초 소요)"
        logger.info("Job %s completed successfully", job_id)
    except Exception as e:
        logger.error("Job %s failed: %s", job_id, e)
        job["status"] = "failed"
        job["error"] = str(e)
        job["message"] = f"오류 발생: {e}"


@app.get("/api/system-info")
def system_info():
    is_installed = check_mac_ocr_installed()
    return {
        "mac_ocr_installed": is_installed,
        "supported_languages": list(SUPPORTED_LANGUAGES.keys()),
        "output_dir": str(OUTPUT_DIR),
        "input_dir": str(INPUT_DIR)
    }


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 지정되지 않았습니다.")

    safe_name = Path(file.filename).name
    dest = INPUT_DIR / safe_name
    counter = 1
    stem = dest.stem
    ext = dest.suffix
    while dest.exists():
        dest = INPUT_DIR / f"{stem}_{counter}{ext}"
        counter += 1

    with open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024 * 5):
            f.write(chunk)

    page_count = None
    if dest.suffix.lower() == ".pdf":
        try:
            page_count = validate_pdf(dest)
        except ValueError as e:
            if dest.exists():
                dest.unlink()
            raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "filename": dest.name,
        "file_path": str(dest),
        "size_bytes": dest.stat().st_size,
        "page_count": page_count
    }


@app.post("/api/start-ocr")
def start_ocr(
    file_path: str = Form(...),
    lang: str = Form("ko-en"),
    split_spreads: bool = Form(False),
    reading_order: str = Form("ltr"),
    fast_mode: bool = Form(False),
    generate_txt: bool = Form(True),
    generate_md: bool = Form(True)
):
    target_path = Path(file_path).resolve()
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="지정된 파일을 찾을 수 없습니다.")

    # Validation
    if target_path.suffix.lower() == ".pdf":
        try:
            validate_pdf(target_path)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "job_id": job_id,
        "filename": target_path.name,
        "status": "queued",
        "current_page": 0,
        "total_pages": 1,
        "percent": 0,
        "message": "작업 큐 대기 중...",
        "start_time": time.time(),
        "eta_seconds": 0,
        "speed": 0,
        "result": None,
        "error": None
    }

    t = threading.Thread(
        target=run_ocr_worker,
        args=(
            job_id,
            target_path,
            OUTPUT_DIR,
            lang,
            split_spreads,
            reading_order,
            fast_mode,
            generate_txt,
            generate_md
        ),
        daemon=True
    )
    t.start()

    return {"success": True, "job_id": job_id}


@app.get("/api/job/{job_id}")
def get_job_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="작업 정보를 찾을 수 없습니다.")
    return JOBS[job_id]


@app.get("/api/stream/{job_id}")
async def stream_job_progress(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="작업 정보를 찾을 수 없습니다.")

    async def event_generator():
        import json
        while True:
            job = JOBS.get(job_id)
            if not job:
                break
            
            data = json.dumps(job)
            yield f"data: {data}\n\n"

            if job["status"] in ("completed", "failed"):
                break

            await asyncio.sleep(0.3)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/open-finder")
def open_in_finder(path: str = Form(...)):
    target = Path(path).resolve()
    if not target.exists():
        raise HTTPException(status_code=404, detail="경로가 존재하지 않습니다.")

    subprocess.run(["open", "-R", str(target)])
    return {"success": True}


@app.get("/api/download/{job_id}/{file_type}")
def download_result(job_id: str, file_type: str):
    job = JOBS.get(job_id)
    if not job or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail="완료된 작업 결과가 없습니다.")

    result = job.get("result", {})
    file_map = {
        "pdf": result.get("output_pdf"),
        "txt": result.get("output_txt"),
        "md": result.get("output_md"),
    }
    target_file = file_map.get(file_type)
    if not target_file or not Path(target_file).exists():
        raise HTTPException(status_code=404, detail="요청한 파일이 존재하지 않습니다.")

    return FileResponse(
        path=target_file,
        filename=Path(target_file).name,
        media_type="application/octet-stream"
    )


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Apple Vision OCR server on http://localhost:8765")
    uvicorn.run("app:app", host="127.0.0.1", port=8765, reload=False)
