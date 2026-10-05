// Apple-Vision-OCR Web Client

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const fileNameDisplay = document.getElementById('selected-file-name');
  const fileStatsDisplay = document.getElementById('selected-file-stats');
  const changeFileBtn = document.getElementById('change-file-btn');
  const startBtn = document.getElementById('start-btn');

  const splitSpreadsCheck = document.getElementById('split-spreads');
  const readingOrderContainer = document.getElementById('reading-order-container');
  const readingOrderSelect = document.getElementById('reading-order');
  const languageSelect = document.getElementById('language-select');
  const fastModeCheck = document.getElementById('fast-mode');
  const genTxtCheck = document.getElementById('gen-txt');
  const genMdCheck = document.getElementById('gen-md');

  const idleView = document.getElementById('idle-view');
  const processingView = document.getElementById('processing-view');
  const completedView = document.getElementById('completed-view');

  const progressPercent = document.getElementById('progress-percent');
  const progressFill = document.getElementById('progress-fill');
  const pagesMetric = document.getElementById('pages-metric');
  const etaMetric = document.getElementById('eta-metric');
  const speedMetric = document.getElementById('speed-metric');
  const statusMessage = document.getElementById('status-message');

  const statsSummary = document.getElementById('stats-summary');
  const dlPdfBtn = document.getElementById('dl-pdf-btn');
  const dlTxtBtn = document.getElementById('dl-txt-btn');
  const dlMdBtn = document.getElementById('dl-md-btn');
  const openFinderBtn = document.getElementById('open-finder-btn');
  const previewToggleBtn = document.getElementById('preview-toggle-btn');
  const previewPanel = document.getElementById('preview-panel');
  const previewContent = document.getElementById('preview-content');

  let currentUploadedFilePath = null;
  let lastResult = null;
  let activeEventSource = null;

  splitSpreadsCheck.addEventListener('change', () => {
    if (splitSpreadsCheck.checked) {
      readingOrderContainer.classList.remove('hidden');
    } else {
      readingOrderContainer.classList.add('hidden');
    }
  });

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  changeFileBtn.addEventListener('click', () => {
    fileInput.click();
  });

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function handleFileSelection(file) {
    dropZone.classList.add('hidden');
    fileInfo.classList.remove('hidden');
    fileNameDisplay.textContent = file.name;
    fileStatsDisplay.textContent = `${formatBytes(file.size)} (업로드 중...)`;
    startBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        const errorDetail = data.detail || '파일 업로드에 실패했습니다.';
        alert(`오류: ${errorDetail}`);
        resetFileSelection();
        return;
      }

      currentUploadedFilePath = data.file_path;
      const pageInfo = data.page_count ? ` | ${data.page_count} 페이지` : '';
      fileStatsDisplay.textContent = `${formatBytes(data.size_bytes)}${pageInfo} (준비 완료)`;
      startBtn.disabled = false;
    } catch (err) {
      alert(`업로드 통신 오류: ${err.message}`);
      resetFileSelection();
    }
  }

  function resetFileSelection() {
    currentUploadedFilePath = null;
    dropZone.classList.remove('hidden');
    fileInfo.classList.add('hidden');
    startBtn.disabled = true;
    fileInput.value = '';
  }

  startBtn.addEventListener('click', async () => {
    if (!currentUploadedFilePath) return;

    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    idleView.classList.add('hidden');
    completedView.classList.add('hidden');
    processingView.classList.remove('hidden');
    startBtn.disabled = true;

    updateProgressUI(0, 1, 0, '엔진 초기화 중...', '-', '-');

    const formData = new FormData();
    formData.append('file_path', currentUploadedFilePath);
    formData.append('lang', languageSelect.value);
    formData.append('split_spreads', splitSpreadsCheck.checked);
    formData.append('reading_order', readingOrderSelect.value);
    formData.append('fast_mode', fastModeCheck.checked);
    formData.append('generate_txt', genTxtCheck.checked);
    formData.append('generate_md', genMdCheck.checked);

    try {
      const resp = await fetch('/api/start-ocr', {
        method: 'POST',
        body: formData
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        alert(`작업 시작 실패: ${data.detail || '서버 오류'}`);
        showIdleView();
        return;
      }

      connectProgressStream(data.job_id);
    } catch (err) {
      alert(`요청 오류: ${err.message}`);
      showIdleView();
    }
  });

  function updateProgressUI(current, total, percent, message, eta, speed) {
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    pagesMetric.textContent = total > 1 ? `${current} / ${total}` : `${current}`;
    etaMetric.textContent = eta || '-';
    speedMetric.textContent = speed || '-';
    statusMessage.textContent = message || '';
  }

  function connectProgressStream(jobId) {
    activeEventSource = new EventSource(`/api/stream/${jobId}`);

    activeEventSource.onmessage = (event) => {
      const job = JSON.parse(event.data);

      const etaStr = job.eta_seconds !== undefined && job.eta_seconds > 0 ? `${job.eta_seconds}초` : '-';
      const speedStr = job.speed ? `${job.speed}초/p` : '-';

      updateProgressUI(
        job.current_page || 0,
        job.total_pages || 1,
        job.percent || 0,
        job.message || '',
        etaStr,
        speedStr
      );

      if (job.status === 'completed') {
        activeEventSource.close();
        activeEventSource = null;
        onJobCompleted(job);
      } else if (job.status === 'failed') {
        activeEventSource.close();
        activeEventSource = null;
        alert(`작업 실패: ${job.error || '알 수 없는 오류'}`);
        showIdleView();
      }
    };

    activeEventSource.onerror = () => {
      setTimeout(() => pollJobStatus(jobId), 1000);
    };
  }

  async function pollJobStatus(jobId) {
    try {
      const resp = await fetch(`/api/job/${jobId}`);
      if (!resp.ok) return;
      const job = await resp.json();
      if (job.status === 'completed') {
        if (activeEventSource) {
          activeEventSource.close();
          activeEventSource = null;
        }
        onJobCompleted(job);
      } else if (job.status === 'failed') {
        if (activeEventSource) {
          activeEventSource.close();
          activeEventSource = null;
        }
        alert(`작업 실패: ${job.error || '오류'}`);
        showIdleView();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function onJobCompleted(job) {
    processingView.classList.add('hidden');
    completedView.classList.remove('hidden');
    startBtn.disabled = false;

    lastResult = job.result || {};
    const res = lastResult;

    statsSummary.textContent = `${res.total_pages || 0}페이지 처리됨 (${res.elapsed_seconds || 0}초 소요, 페이지당 평균 ${res.seconds_per_page || 0}초)`;

    dlPdfBtn.href = `/api/download/${job.job_id}/pdf`;
    if (res.output_txt) {
      dlTxtBtn.href = `/api/download/${job.job_id}/txt`;
      dlTxtBtn.style.display = 'flex';
    } else {
      dlTxtBtn.style.display = 'none';
    }

    if (res.output_md) {
      dlMdBtn.href = `/api/download/${job.job_id}/md`;
      dlMdBtn.style.display = 'flex';
    } else {
      dlMdBtn.style.display = 'none';
    }

    if (res.preview_text) {
      previewContent.textContent = res.preview_text;
      previewToggleBtn.style.display = 'inline-flex';
    } else {
      previewToggleBtn.style.display = 'none';
    }
  }

  openFinderBtn.addEventListener('click', async () => {
    if (!lastResult || !lastResult.output_pdf) return;
    const formData = new FormData();
    formData.append('path', lastResult.output_pdf);
    try {
      await fetch('/api/open-finder', {
        method: 'POST',
        body: formData
      });
    } catch (e) {
      console.error('Finder 실행 실패:', e);
    }
  });

  previewToggleBtn.addEventListener('click', () => {
    previewPanel.classList.toggle('hidden');
  });

  function showIdleView() {
    processingView.classList.add('hidden');
    completedView.classList.add('hidden');
    idleView.classList.remove('hidden');
    startBtn.disabled = false;
  }
});
