// Apple-Vision-OCR Bilingual Web Client

const TRANSLATIONS = {
  ko: {
    navbar_subtitle: "On-Device Searchable PDF Engine powered by Apple Neural Engine",
    tag_accel: "Hardware Accelerated",
    tag_local: "Local Processing",
    section1_title: "1. 파일 선택 (Source Document)",
    drop_primary: "PDF 또는 이미지 파일을 드래그하여 놓거나 클릭하여 선택하십시오.",
    drop_secondary: "지원 형식: PDF, PNG, JPEG, TIFF, WebP",
    btn_change: "변경",
    section2_title: "2. 옵션 설정 (Configuration)",
    split_title: "2페이지 펼침면 분할 (Split Spreads)",
    split_desc: "가로 방향 양면 스캔 페이지를 각각 세로 1페이지로 자동 분할합니다.",
    reading_order_label: "페이지 진행 순서",
    order_ltr: "좌측에서 우측 (Left-to-Right)",
    order_rtl: "우측에서 좌측 (Right-to-Left, 일본 서적/만화)",
    lang_label: "인식 언어 프로필",
    opt_ko_en: "한국어 + 영어 (ko-KR, en-US)",
    opt_ko: "한국어 전용 (ko-KR)",
    opt_en: "영어 전용 (en-US)",
    opt_ja_en: "일본어 + 영어 (ja-JP, en-US)",
    opt_zh_en: "중국어 간체 + 영어 (zh-Hans, en-US)",
    opt_all: "다국어 (한국어 + 영어 + 일본어)",
    output_label: "생성 파일 형식",
    out_pdf: "검색 가능한 PDF (Searchable PDF, 무손실 원본 보존)",
    out_txt: "텍스트 파일 (.txt, 페이지 구분 표기)",
    out_md: "마크다운 문서 (.md, 구조화 헤더)",
    fast_title: "고속 모드 (Fast Mode)",
    fast_desc: "인식 정확도 대신 처리 속도를 우선시합니다.",
    btn_start: "OCR 처리 시작",
    section3_title: "3. 처리 상태 및 결과 (Status & Output)",
    idle_hint: "문서를 선택하고 옵션을 설정한 후 처리 시작 버튼을 클릭하십시오.",
    status_processing: "처리 중 (Processing)",
    metric_pages: "진행 페이지",
    metric_eta: "예상 남은 시간",
    metric_speed: "처리 속도",
    result_completed: "완료됨",
    dl_pdf_desc: "검색 및 텍스트 선택 가능 레이어가 적용된 원본 품질 PDF",
    dl_txt_desc: "페이지별 구분자가 포함된 텍스트 본문",
    dl_md_desc: "구조화된 헤더가 적용된 마크다운 문서",
    action_download: "다운로드",
    btn_open_finder: "Finder에서 파일 보기",
    btn_preview: "텍스트 미리보기",
    preview_header: "인식 텍스트 미리보기",
    uploading: "업로드 중...",
    ready: "준비 완료",
    pages_suffix: "페이지",
    init_engine: "엔진 초기화 중...",
    unit_seconds: "초",
    unit_speed: "초/p",
    summary: (p, s, sp) => `${p}페이지 처리됨 (${s}초 소요, 페이지당 평균 ${sp}초)`
  },
  en: {
    navbar_subtitle: "On-Device Searchable PDF Engine powered by Apple Neural Engine",
    tag_accel: "Hardware Accelerated",
    tag_local: "Local Processing",
    section1_title: "1. Source Document",
    drop_primary: "Drag and drop a PDF or image file, or click to browse.",
    drop_secondary: "Supported formats: PDF, PNG, JPEG, TIFF, WebP",
    btn_change: "Change",
    section2_title: "2. Configuration",
    split_title: "Split 2-Page Spreads",
    split_desc: "Automatically split landscape two-page spreads into individual portrait pages.",
    reading_order_label: "Reading Order",
    order_ltr: "Left-to-Right (Standard)",
    order_rtl: "Right-to-Left (e.g. Manga)",
    lang_label: "Recognition Language Profile",
    opt_ko_en: "Korean + English (ko-KR, en-US)",
    opt_ko: "Korean Only (ko-KR)",
    opt_en: "English Only (en-US)",
    opt_ja_en: "Japanese + English (ja-JP, en-US)",
    opt_zh_en: "Simplified Chinese + English (zh-Hans, en-US)",
    opt_all: "Multilingual (ko-KR, en-US, ja-JP)",
    output_label: "Output Formats",
    out_pdf: "Searchable PDF (Lossless original preservation)",
    out_txt: "Plain Text (.txt, page-delimited)",
    out_md: "Markdown (.md, structured headers)",
    fast_title: "Fast Recognition Mode",
    fast_desc: "Prioritize throughput over maximum recognition accuracy.",
    btn_start: "Start OCR Processing",
    section3_title: "3. Status & Output",
    idle_hint: "Select a document, configure options, and click Start OCR Processing.",
    status_processing: "Processing",
    metric_pages: "Pages Processed",
    metric_eta: "Estimated Time Remaining",
    metric_speed: "Processing Rate",
    result_completed: "Completed",
    dl_pdf_desc: "Lossless PDF with embedded invisible text layer for selection and search",
    dl_txt_desc: "Structured text content partitioned by page number",
    dl_md_desc: "Formatted Markdown document for Notion, Obsidian, and LLMs",
    action_download: "Download",
    btn_open_finder: "Reveal in Finder",
    btn_preview: "Preview Extracted Text",
    preview_header: "Extracted Text Preview",
    uploading: "Uploading...",
    ready: "Ready",
    pages_suffix: "pages",
    init_engine: "Initializing engine...",
    unit_seconds: "s",
    unit_speed: "s/p",
    summary: (p, s, sp) => `${p} pages processed in ${s}s (${sp}s/page avg)`
  }
};

const urlParams = new URLSearchParams(window.location.search);
const langParam = urlParams.get('lang');
let currentLang = (langParam === 'en' || langParam === 'ko') ? langParam : (localStorage.getItem('apple_vision_ocr_lang') || 'ko');

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('apple_vision_ocr_lang', lang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  const t = TRANSLATIONS[lang] || TRANSLATIONS.ko;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  document.documentElement.lang = lang;
}

document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.dataset.lang);
      if (lastResult) {
        renderCompletedSummary();
      }
    });
  });

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
  let uploadedPageCount = null;
  let uploadedSizeBytes = 0;

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
    const t = TRANSLATIONS[currentLang];
    dropZone.classList.add('hidden');
    fileInfo.classList.remove('hidden');
    fileNameDisplay.textContent = file.name;
    fileStatsDisplay.textContent = `${formatBytes(file.size)} (${t.uploading})`;
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
        const errorDetail = data.detail || (currentLang === 'ko' ? '파일 업로드에 실패했습니다.' : 'File upload failed.');
        alert(errorDetail);
        resetFileSelection();
        return;
      }

      currentUploadedFilePath = data.file_path;
      uploadedSizeBytes = data.size_bytes;
      uploadedPageCount = data.page_count;

      const pageInfo = uploadedPageCount ? ` | ${uploadedPageCount} ${t.pages_suffix}` : '';
      fileStatsDisplay.textContent = `${formatBytes(uploadedSizeBytes)}${pageInfo} (${t.ready})`;
      startBtn.disabled = false;
    } catch (err) {
      alert(`Error: ${err.message}`);
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

    const t = TRANSLATIONS[currentLang];
    idleView.classList.add('hidden');
    completedView.classList.add('hidden');
    processingView.classList.remove('hidden');
    startBtn.disabled = true;

    updateProgressUI(0, 1, 0, t.init_engine, '-', '-');

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
        alert(data.detail || 'Error starting process');
        showIdleView();
        return;
      }

      connectProgressStream(data.job_id);
    } catch (err) {
      alert(`Error: ${err.message}`);
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
      const t = TRANSLATIONS[currentLang];

      const etaStr = job.eta_seconds !== undefined && job.eta_seconds > 0 ? `${job.eta_seconds}${t.unit_seconds}` : '-';
      const speedStr = job.speed ? `${job.speed}${t.unit_speed}` : '-';

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
        alert(`Failed: ${job.error || 'Unknown error'}`);
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
        alert(`Failed: ${job.error || 'Error'}`);
        showIdleView();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderCompletedSummary() {
    if (!lastResult) return;
    const t = TRANSLATIONS[currentLang];
    statsSummary.textContent = t.summary(
      lastResult.total_pages || 0,
      lastResult.elapsed_seconds || 0,
      lastResult.seconds_per_page || 0
    );
  }

  function onJobCompleted(job) {
    processingView.classList.add('hidden');
    completedView.classList.remove('hidden');
    startBtn.disabled = false;

    lastResult = job.result || {};
    renderCompletedSummary();

    dlPdfBtn.href = `/api/download/${job.job_id}/pdf`;
    if (lastResult.output_txt) {
      dlTxtBtn.href = `/api/download/${job.job_id}/txt`;
      dlTxtBtn.style.display = 'flex';
    } else {
      dlTxtBtn.style.display = 'none';
    }

    if (lastResult.output_md) {
      dlMdBtn.href = `/api/download/${job.job_id}/md`;
      dlMdBtn.style.display = 'flex';
    } else {
      dlMdBtn.style.display = 'none';
    }

    if (lastResult.preview_text) {
      previewContent.textContent = lastResult.preview_text;
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
      console.error('Finder error:', e);
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
